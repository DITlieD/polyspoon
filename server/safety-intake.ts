// Worker side of the safety-v1 pre-review. Only an authenticated processor (scoped `pc_` secret whose profiles
// include `safety-v1`) reaches these routes; uploaders never do. The processor PULLS work; nothing here calls out.
//
// Routing is a pre-filter only:
//   pass / flag / incomplete  → version `awaiting_review` + live queue row (humans decide; priority by outcome)
//   reject (policy enforced)  → version `rejected` + a version_auto_rejection row (= the "rejected_auto" state).
//                               Only a moderator appeal can reopen it (to awaiting_review), never to approved.
//   reject (shadow policy)    → treated as a high-priority flag: humans see it, nothing is auto-rejected
// Nothing in this file writes review_record, approves, publishes or grants a capability.
import type {Env,PrivateObjects} from './types.ts';
import {canonical,digest,HttpError,nonempty,secretToken} from './domain.ts';
import {body,bytes,json} from './input.ts';
export const SAFETY_PROFILE='safety-v1',LEASE_MS=20*60*1000,MAX_SCAN_ATTEMPTS=3,CANARY_MAX_AGE_MS=24*3600*1000,MAX_ARTIFACTS=400,MAX_ARTIFACT_BYTES=2*1024*1024,MAX_NORMALIZED_BYTES=50*1024*1024;
export type SafetyProcessor={id:string;owner_id:string;profiles:string};
type Policy={id:string;version:string;thresholds:string;enforce:number};
type Attempt={id:string;upload_id:string;processor_id:string;lease_hash:string;lease_expires_at:number;policy_version:string;detectors_hash:string;report_id:string|null};
type Upload={id:string;owner_id:string;source:string;format:string;object_key:string;declared_bytes:number;declared_sha256:string;status:string;title:string|null;description:string|null;category:string|null;provenance:string|null;scan_attempts:number};
const CATEGORIES=['sexual','child_like','hate_symbol','slur_text','violence','suspicious_instructions','hidden_geometry','invalid_file','analysis_incomplete'];
const BANDS=['low','flag','reject'],OUTCOMES=['pass','flag','incomplete','reject'];
const RANK:Record<string,number>={pass:0,flag:1,incomplete:2,reject:3};
export const ARTIFACT_NAME=/^[a-z0-9][a-z0-9-]{0,98}$/;
/** Owner-facing reason: a coarse label only, never which detector fired or how close it came. */
export function coarseReason(findings:{category:string;band:string}[]){const c=findings.find(f=>f.band==='reject')?.category;return c==='hate_symbol'?'prohibited_symbol':c==='sexual'||c==='child_like'?'sexual_content':c==='slur_text'?'text_policy':'invalid_file';}
export const versionIdFor=(uploadId:string)=>digest('polyspoon-upload-version:'+uploadId);
export async function activePolicy(env:Env){return env.DB.prepare('SELECT id,version,thresholds,enforce FROM safety_policy WHERE enabled=1 ORDER BY created_at DESC,rowid DESC LIMIT 1').first<Policy>();}
const event=(env:Env,version:string,kind:string,detail:unknown,now:number)=>env.DB.prepare('INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) VALUES(?,NULL,?,?,?)').bind(version,kind,JSON.stringify(detail),now);

export interface Finding{category:string;detector:string;band:string;score?:number;artifact?:string;bbox?:number[];textSpan?:string}
/** Structural check of a processor-submitted finding list. The outcome may be stricter than the findings, never laxer. */
export function validateReport(input:{outcome:unknown;findings:unknown;summary:unknown},artifacts:Set<string>){
 if(typeof input.outcome!=='string'||!OUTCOMES.includes(input.outcome))throw new HttpError(400,'invalid_outcome');
 if(!Array.isArray(input.findings)||input.findings.length>200)throw new HttpError(400,'invalid_findings');
 const findings:Finding[]=input.findings.map((raw:unknown)=>{
  const f=raw as Record<string,unknown>;if(!f||typeof f!=='object')throw new HttpError(400,'invalid_findings');
  if(!CATEGORIES.includes(String(f.category))||!BANDS.includes(String(f.band))||typeof f.detector!=='string'||!/^[a-z0-9-]{1,60}$/.test(f.detector))throw new HttpError(400,'invalid_findings');
  if(f.score!==undefined&&!(typeof f.score==='number'&&f.score>=0&&f.score<=1))throw new HttpError(400,'invalid_findings');
  if(f.artifact!==undefined&&(typeof f.artifact!=='string'||!(artifacts.has(f.artifact)||f.artifact==='llm:views')))throw new HttpError(400,'unknown_artifact');
  if(f.bbox!==undefined&&!(Array.isArray(f.bbox)&&f.bbox.length===4&&f.bbox.every(n=>Number.isInteger(n)&&n>=0&&n<=8192)))throw new HttpError(400,'invalid_findings');
  if(f.textSpan!==undefined&&(typeof f.textSpan!=='string'||f.textSpan.length>200))throw new HttpError(400,'invalid_findings');
  return {category:String(f.category),detector:f.detector,band:String(f.band),...(f.score!==undefined?{score:Number(f.score)}:{}),...(f.artifact!==undefined&&f.artifact!=='llm:views'?{artifact:String(f.artifact)}:{}),...(f.bbox?{bbox:f.bbox as number[]}:{}),...(f.textSpan!==undefined?{textSpan:String(f.textSpan)}:{})};
 });
 const floor=findings.some(f=>f.band==='reject')?'reject':findings.some(f=>f.category==='analysis_incomplete')?'incomplete':findings.some(f=>f.band==='flag')?'flag':'pass';
 if(RANK[input.outcome]!<RANK[floor]!)throw new HttpError(400,'outcome_weaker_than_findings');
 if(!input.summary||typeof input.summary!=='object'||Array.isArray(input.summary))throw new HttpError(400,'invalid_summary');
 const summary=JSON.stringify(input.summary);if(summary.length>200_000)throw new HttpError(413,'summary_too_large');
 return {outcome:input.outcome as 'pass'|'flag'|'incomplete'|'reject',findings,summary:input.summary as Record<string,unknown>};
}

/** Build the statements that record an immutable report and route the upload. Used for processor reports and for
 *  server-side fail-closed outcomes (scan attempts exhausted). One D1 batch; any trigger failure aborts all of it. */
export async function routeStatements(env:Env,upload:Upload,policy:Policy,report:{outcome:'pass'|'flag'|'incomplete'|'reject';findings:Finding[];summary:Record<string,unknown>},attemptId:string|null,now:number){
 const versionId=await versionIdFor(upload.id),shadow=policy.enforce===1?0:1,reportId=crypto.randomUUID();
 const autoReject=report.outcome==='reject'&&!shadow;
 const reason=report.outcome==='reject'||report.outcome==='flag'?'flag':report.outcome==='incomplete'?'incomplete':'pass';
 const priority=report.outcome==='reject'?90:report.outcome==='flag'?80:report.outcome==='incomplete'?70:10;
 const sha=await digest(canonical({reportId,uploadId:upload.id,versionId,attemptId,policy:policy.version,outcome:report.outcome,shadow,findings:report.findings,summary:report.summary}));
 const subject={source:'upload',uploadId:upload.id,uploadSource:upload.source,format:upload.format,sha256:upload.declared_sha256,bytes:upload.declared_bytes,category:upload.category,description:upload.description};
 const s=[
  env.DB.prepare("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,?,?,?,'static',?,?)").bind(versionId,'upload-'+upload.id,upload.owner_id,upload.title??'Untitled upload',JSON.stringify(subject),now),
  env.DB.prepare("UPDATE asset_version SET state='submitted' WHERE id=? AND state='draft'").bind(versionId),
  env.DB.prepare("UPDATE asset_version SET state='processing' WHERE id=? AND state='submitted'").bind(versionId),
  env.DB.prepare('INSERT INTO safety_report(id,upload_id,version_id,policy_version,outcome,shadow,summary,report_sha256,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(reportId,upload.id,versionId,policy.version,report.outcome,shadow,JSON.stringify(report.summary),sha,now),
  env.DB.prepare("INSERT INTO safety_finding(report_id,idx,category,detector,band,artifact_path,bbox,text_span) SELECT ?,CAST(key AS INTEGER),json_extract(value,'$.category'),json_extract(value,'$.detector'),json_extract(value,'$.band'),json_extract(value,'$.artifact'),json_extract(value,'$.bbox'),json_extract(value,'$.textSpan') FROM json_each(?)").bind(reportId,JSON.stringify(report.findings)),
  event(env,versionId,'auto_outcome',{outcome:report.outcome,shadow:!!shadow,policy:policy.version,report:reportId},now),
 ];
 if(autoReject)s.push(
  env.DB.prepare('INSERT INTO version_auto_rejection(version_id,report_id,created_at) VALUES(?,?,?)').bind(versionId,reportId,now),
  env.DB.prepare("UPDATE asset_version SET state='rejected' WHERE id=? AND state='processing'").bind(versionId),
  env.DB.prepare("UPDATE uploads SET status='rejected_auto',reason=?,version_id=?,updated_at=? WHERE id=?").bind(coarseReason(report.findings),versionId,now,upload.id),
 );
 else s.push(
  env.DB.prepare("UPDATE asset_version SET state='awaiting_review' WHERE id=? AND state='processing'").bind(versionId),
  env.DB.prepare('INSERT INTO review_queue(version_id,priority,reason,enqueued_at) VALUES(?,?,?,?)').bind(versionId,priority,reason,now),
  event(env,versionId,'enqueued',{reason,priority},now),
  env.DB.prepare("UPDATE uploads SET status='queued',version_id=?,updated_at=? WHERE id=?").bind(versionId,now,upload.id),
 );
 if(attemptId)s.push(env.DB.prepare('UPDATE safety_attempt SET report_id=? WHERE id=? AND report_id IS NULL').bind(reportId,attemptId));
 return {statements:s,versionId,reportId,route:autoReject?'rejected_auto':'human_queue'};
}
async function runRoute(env:Env,statements:ReturnType<Env['DB']['prepare']>[]){try{await env.DB.batch(statements);}catch(error){const m=String((error as Error)?.message??error);if(m.includes('submission_budget_exhausted'))throw new HttpError(409,'submission_budget_exhausted');if(m.includes('authority_changed'))throw new HttpError(409,'owner_inactive');throw error;}}

/** Leases that lapsed go back to pending; after MAX_SCAN_ATTEMPTS the upload goes to humans as `incomplete`. */
export async function sweepSafety(env:Env,now:number){
 const stale=(await env.DB.prepare("SELECT u.* FROM uploads u WHERE u.status='scanning' AND NOT EXISTS(SELECT 1 FROM safety_attempt a WHERE a.upload_id=u.id AND a.report_id IS NULL AND a.lease_expires_at>?)").bind(now).all<Upload>()).results;
 const policy=await activePolicy(env);
 for(const u of stale){
  if(u.scan_attempts<MAX_SCAN_ATTEMPTS||!policy){await env.DB.prepare("UPDATE uploads SET status='pending_scan',updated_at=? WHERE id=? AND status='scanning'").bind(now,u.id).run();continue;}
  const {statements}=await routeStatements(env,u,policy,{outcome:'incomplete',findings:[{category:'analysis_incomplete',detector:'pipeline',band:'flag',textSpan:'scan attempts exhausted'}],summary:{schema:'safety-report-v1',policyVersion:policy.version,reason:'scan_attempts_exhausted',serverGenerated:true}},null,now);
  try{await runRoute(env,statements);}catch{/* budget full: stays scanning, retried on the next sweep */}
 }
}
async function leased(request:Request,env:Env,p:SafetyProcessor,attemptId:string,now:number){
 const header=request.headers.get('x-processor-lease')??'';if(!/^[a-f0-9]{64}$/.test(header))throw new HttpError(409,'processor_lease_required');
 const a=await env.DB.prepare('SELECT * FROM safety_attempt WHERE id=? AND processor_id=? AND lease_hash=?').bind(attemptId,p.id,await digest(header)).first<Attempt>();
 if(!a)throw new HttpError(409,'processor_lease_required');if(a.report_id||a.lease_expires_at<=now)throw new HttpError(409,'processor_lease_stale');
 const u=await env.DB.prepare('SELECT * FROM uploads WHERE id=?').bind(a.upload_id).first<Upload>();if(!u||u.status!=='scanning')throw new HttpError(409,'processor_lease_stale');
 return {a,u};
}
const jobOf=(a:{id:string;lease_expires_at:number},leaseId:string,u:Upload)=>({attemptId:a.id,leaseId,leaseExpiresAt:a.lease_expires_at,uploadId:u.id,format:u.format,bytes:u.declared_bytes,sha256:u.declared_sha256,title:u.title,description:u.description,provenance:u.provenance?JSON.parse(u.provenance):null});

export async function safetyRoutes(request:Request,env:Env,p:SafetyProcessor,path:string,objects:()=>PrivateObjects):Promise<Response|null>{
 if(!path.startsWith('/api/processor/safety/'))return null;
 let profiles:unknown;try{profiles=JSON.parse(p.profiles);}catch{profiles=[];}
 if(!Array.isArray(profiles)||!profiles.includes(SAFETY_PROFILE))throw new HttpError(403,'safety_profile_required');
 const now=Date.now(),method=request.method;
 if(path==='/api/processor/safety/policy'&&method==='GET'){const policy=await activePolicy(env);if(!policy)throw new HttpError(503,'safety_policy_unconfigured');return json({policy:{version:policy.version,enforce:!!policy.enforce,thresholds:JSON.parse(policy.thresholds)}});}
 if(path==='/api/processor/safety/canary'&&method==='POST'){
  const input=await body(request,['policyVersion','detectorsHash','passed','detail']);
  if(!nonempty(input.policyVersion,60)||typeof input.detectorsHash!=='string'||!/^[a-f0-9]{64}$/.test(input.detectorsHash)||typeof input.passed!=='boolean'||!input.detail||typeof input.detail!=='object')throw new HttpError(400,'invalid_canary');
  const detail=JSON.stringify(input.detail);if(detail.length>20000)throw new HttpError(413,'canary_detail_too_large');
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO safety_canary_run(id,processor_id,policy_version,detectors_hash,passed,detail,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,p.id,input.policyVersion,input.detectorsHash,input.passed?1:0,detail,now).run();
  return json({id,passed:input.passed},201);
 }
 if(path==='/api/processor/safety/claims'&&method==='POST'){
  const input=await body(request,['idempotencyKey','policyVersion','detectorsHash']);
  if(!nonempty(input.idempotencyKey,160)||!nonempty(input.policyVersion,60)||typeof input.detectorsHash!=='string'||!/^[a-f0-9]{64}$/.test(input.detectorsHash))throw new HttpError(400,'invalid_safety_claim');
  await sweepSafety(env,now);
  const policy=await activePolicy(env);if(!policy||policy.version!==input.policyVersion)return json({job:null,reason:'policy_mismatch'});
  // Halt switch: the LATEST canary for this exact policy + detector code, from any processor, must have passed.
  const canary=await env.DB.prepare('SELECT passed,created_at FROM safety_canary_run WHERE policy_version=? AND detectors_hash=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(policy.version,input.detectorsHash).first<{passed:number;created_at:number}>();
  if(!canary||canary.passed!==1||canary.created_at<now-CANARY_MAX_AGE_MS)return json({job:null,reason:'canary_required'});
  const prior=await env.DB.prepare('SELECT * FROM safety_attempt WHERE processor_id=? AND claim_key=?').bind(p.id,input.idempotencyKey).first<Attempt>();
  if(prior)throw new HttpError(409,'claim_key_used');
  // A processor never scans an upload owned by its own owner (also enforced by a trigger on safety_attempt).
  const next=await env.DB.prepare("SELECT * FROM uploads WHERE status='pending_scan' AND owner_id!=? ORDER BY updated_at,created_at LIMIT 1").bind(p.owner_id).first<Upload>();if(!next)return json({job:null,reason:'empty'});
  const id=crypto.randomUUID(),leaseId=secretToken(),expires=now+LEASE_MS;
  await env.DB.batch([
   env.DB.prepare("UPDATE uploads SET status='scanning',scan_attempts=scan_attempts+1,updated_at=? WHERE id=? AND status='pending_scan'").bind(now,next.id),
   env.DB.prepare("INSERT INTO safety_attempt(id,upload_id,processor_id,claim_key,lease_hash,lease_expires_at,policy_version,detectors_hash,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM uploads WHERE id=? AND status='scanning' AND scan_attempts=?) AND NOT EXISTS(SELECT 1 FROM safety_attempt WHERE upload_id=? AND report_id IS NULL AND lease_expires_at>?)").bind(id,next.id,p.id,input.idempotencyKey,await digest(leaseId),expires,policy.version,input.detectorsHash,now,next.id,next.scan_attempts+1,next.id,now),
  ]);
  const mine=await env.DB.prepare('SELECT id,lease_expires_at FROM safety_attempt WHERE id=?').bind(id).first<{id:string;lease_expires_at:number}>();
  if(!mine)return json({job:null,reason:'contended'});
  return json({job:jobOf(mine,leaseId,{...next,status:'scanning'})});
 }
 const m=/^\/api\/processor\/safety\/attempts\/([0-9a-f-]{36})\/(file|report|normalized|images\/([a-z0-9][a-z0-9-]{0,98}))$/.exec(path);if(!m)throw new HttpError(404,'not_found');
 const {a,u}=await leased(request,env,p,m[1]!,now);
 if(m[2]==='file'&&method==='GET'){
  const store=objects(),data=store.readUpTo?await store.readUpTo(u.object_key,u.declared_bytes):await store.read(u.object_key);
  if(!data||data.length!==u.declared_bytes||await digest(data)!==u.declared_sha256)throw new HttpError(409,'upload_file_changed');
  return new Response(data as unknown as BodyInit,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }
 if(m[3]&&method==='PUT'){
  const name=m[3],type=request.headers.get('x-image-type');if(type!=='image/png'&&type!=='image/jpeg')throw new HttpError(400,'invalid_image_type');
  const data=await bytes(request,MAX_ARTIFACT_BYTES);
  const png=data.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v),jpeg=data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff;
  if(!(type==='image/png'?png:jpeg))throw new HttpError(400,'image_magic_mismatch');
  const count=await env.DB.prepare('SELECT count(*) AS n FROM safety_artifact WHERE attempt_id=?').bind(a.id).first<{n:number}>();if(Number(count?.n??0)>=MAX_ARTIFACTS)throw new HttpError(413,'artifact_budget_exhausted');
  const sha=await digest(data),key='review/uploads/'+u.id+'/safety/'+a.id+'/'+name;
  const existing=await env.DB.prepare('SELECT sha256 FROM safety_artifact WHERE attempt_id=? AND name=?').bind(a.id,name).first<{sha256:string}>();
  if(existing){if(existing.sha256!==sha)throw new HttpError(409,'artifact_conflict');return json({stored:true});}
  await objects().putIfAbsent(key,data);
  await env.DB.prepare('INSERT INTO safety_artifact(attempt_id,name,object_key,sha256,bytes,media_type,created_at) VALUES(?,?,?,?,?,?,?)').bind(a.id,name,key,sha,data.length,type,now).run();
  return json({stored:true},201);
 }
 if(m[2]==='normalized'&&method==='PUT'){
  // normalized.glb from the jail: the parsed scene re-encoded by three.js, served to moderators instead of the original.
  const data=await bytes(request,MAX_NORMALIZED_BYTES),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(data.length<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.length)throw new HttpError(400,'invalid_normalized_glb');
  const sha=await digest(data),key='review/uploads/'+u.id+'/safety/'+a.id+'/normalized.glb';
  const existing=await env.DB.prepare('SELECT sha256 FROM safety_normalized WHERE attempt_id=?').bind(a.id).first<{sha256:string}>();
  if(existing){if(existing.sha256!==sha)throw new HttpError(409,'artifact_conflict');return json({stored:true});}
  await objects().putIfAbsent(key,data);
  await env.DB.prepare('INSERT INTO safety_normalized(attempt_id,object_key,sha256,bytes,created_at) VALUES(?,?,?,?,?)').bind(a.id,key,sha,data.length,now).run();
  return json({stored:true},201);
 }
 if(m[2]==='report'&&method==='POST'){
  const input=await body(request,['outcome','findings','summary']);
  const names=new Set((await env.DB.prepare('SELECT name FROM safety_artifact WHERE attempt_id=?').bind(a.id).all<{name:string}>()).results.map(r=>r.name));
  const report=validateReport(input as {outcome:unknown;findings:unknown;summary:unknown},names);
  if(report.summary.policyVersion!==a.policy_version||report.summary.detectorsHash!==a.detectors_hash)throw new HttpError(409,'report_policy_mismatch');
  const policy=await env.DB.prepare('SELECT id,version,thresholds,enforce FROM safety_policy WHERE version=?').bind(a.policy_version).first<Policy>();if(!policy)throw new HttpError(409,'report_policy_mismatch');
  const routed=await routeStatements(env,u,policy,report,a.id,now);await runRoute(env,routed.statements);
  return json({route:routed.route,versionId:routed.versionId,reportId:routed.reportId,shadow:policy.enforce!==1},201);
 }
 return null;
}

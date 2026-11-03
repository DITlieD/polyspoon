// Live moderation queue. A claim is a 10-minute lock (extended by heartbeat) so two people never decide the same
// model. Decisions here are recorded human verdicts in an append-only log; the version state still only moves
// through the existing review/publisher endpoints, which keep enforcing review records and capabilities.
import type {Env,PrivateObjects} from './types.ts';
import type {Principal} from './domain.ts';
import {digest,HttpError} from './domain.ts';
import {body,json} from './input.ts';
import {ARTIFACT_NAME} from './safety-intake.ts';
const THUMBS=['view-lit-oppp','view-lit-pz','view-lit-px','view-lit-onpn'];
/** Artifacts of the attempt behind the latest safety report for a version (moderators only). */
const latestArtifacts=(env:Env,id:string)=>env.DB.prepare('SELECT a.name,a.object_key,a.sha256,a.bytes,a.media_type FROM safety_artifact a JOIN safety_attempt t ON t.id=a.attempt_id WHERE t.report_id=(SELECT r.id FROM safety_report r WHERE r.version_id=? ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1) ORDER BY a.name').bind(id);
const parseJson=(value:unknown)=>{if(typeof value!=='string')return value&&typeof value==='object'?value:null;try{return JSON.parse(value) as unknown;}catch{return null;}};

export const CLAIM_MS=10*60*1000,POLL_AFTER_MS=60_000,SIGNED_URL_TTL_S=120;
const SQL_BIND_LIMIT=99;
const REVIEW_CAPS=['admin','moderator','publisher','reviewer:visual','reviewer:portability','reviewer:executable-source'];
const DECISIONS=['approve','changes_requested','reject'];
export function canReview(actor:Principal){return !actor.scopes&&actor.status==='active'&&actor.verified&&actor.capabilities.some(c=>REVIEW_CAPS.includes(c));}
const canOverride=(actor:Principal)=>actor.capabilities.some(c=>c==='admin'||c==='moderator');
type QueueRow={version_id:string;priority:number;reason:string;claimed_by:string|null;claim_expires_at:number|null;revision:number;enqueued_at:number;decided_at:number|null;decided_by:string|null};
const event=(env:Env,version:string,actor:string|null,kind:string,detail:unknown,now:number)=>env.DB.prepare('INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) VALUES(?,?,?,?,?)').bind(version,actor,kind,detail===null?null:JSON.stringify(detail),now);

/** Bring the queue in line with the versions awaiting review, expire stale claims, close rows decided elsewhere. */
export async function syncQueue(env:Env,now=Date.now()){
 const left="version_id NOT IN (SELECT id FROM asset_version WHERE state='awaiting_review')";
 await env.DB.batch([
  env.DB.prepare('DELETE FROM review_queue WHERE decided_at IS NOT NULL AND '+left),
  env.DB.prepare("INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) SELECT version_id,NULL,'decided',json_object('decision','resolved_elsewhere'),? FROM review_queue WHERE decided_at IS NULL AND "+left).bind(now),
  env.DB.prepare('DELETE FROM review_queue WHERE decided_at IS NULL AND '+left),
  env.DB.prepare("INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) SELECT v.id,NULL,'enqueued',json_object('reason',COALESCE((SELECT CASE r.outcome WHEN 'flag' THEN 'flag' WHEN 'reject' THEN 'flag' WHEN 'incomplete' THEN 'incomplete' ELSE 'pass' END FROM safety_report r WHERE r.version_id=v.id ORDER BY r.created_at DESC LIMIT 1),'legacy')),? FROM asset_version v WHERE v.state='awaiting_review' AND NOT EXISTS(SELECT 1 FROM review_queue q WHERE q.version_id=v.id)").bind(now),
  env.DB.prepare("INSERT OR IGNORE INTO review_queue(version_id,priority,reason,enqueued_at) SELECT v.id,CASE json_extract(e.detail,'$.reason') WHEN 'flag' THEN 80 WHEN 'incomplete' THEN 70 ELSE 10 END,json_extract(e.detail,'$.reason'),e.created_at FROM asset_version v JOIN queue_event_log e ON e.version_id=v.id AND e.kind='enqueued' AND e.created_at=? WHERE v.state='awaiting_review' AND NOT EXISTS(SELECT 1 FROM review_queue q WHERE q.version_id=v.id)").bind(now),
  env.DB.prepare("INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) SELECT version_id,claimed_by,'expired',NULL,? FROM review_queue WHERE claim_expires_at<?").bind(now,now),
  env.DB.prepare('UPDATE review_queue SET claimed_by=NULL,claim_expires_at=NULL,revision=revision+1 WHERE claim_expires_at<?').bind(now),
 ]);
}
async function queueRow(env:Env,id:string){if(!/^[a-f0-9]{64}$/.test(id))throw new HttpError(404,'queue_item_not_found');const row=await env.DB.prepare('SELECT * FROM review_queue WHERE version_id=?').bind(id).first<QueueRow>();if(!row||row.decided_at!==null)throw new HttpError(404,'queue_item_not_found');return row;}
const revisionOf=(value:unknown)=>{if(!Number.isSafeInteger(value))throw new HttpError(400,'invalid_revision');return Number(value);};
const cursor=async(env:Env)=>Number((await env.DB.prepare('SELECT COALESCE(max(seq),0) AS seq FROM queue_event_log').first<{seq:number}>())?.seq??0);
const holds=(env:Env,id:string,actor:string,revision:number,now:number)=>env.DB.prepare('SELECT 1 FROM review_queue WHERE version_id=? AND claimed_by=? AND revision=? AND claim_expires_at>=? AND decided_at IS NULL').bind(id,actor,revision,now).first();

export async function reviewQueueRoutes(request:Request,env:Env,actor:Principal,path:string,objects?:()=>PrivateObjects):Promise<Response|null>{
 if(path!=='/api/moderation/queue'&&!path.startsWith('/api/moderation/queue/'))return null;
 if(!canReview(actor))throw new HttpError(403,actor.scopes?'interactive_session_required':'reviewer_required');
 const method=request.method,now=Date.now(),url=new URL(request.url);
 if(path==='/api/moderation/queue'&&method==='GET'){
  const joined="SELECT q.version_id AS versionId,q.priority,q.reason,q.revision,q.enqueued_at AS enqueuedAt,q.claim_expires_at AS claimExpiresAt,q.claimed_by AS claimedBy,cu.name AS claimedByName,v.title,v.kind,v.contributor_id AS contributorId,u.name AS contributorName,r.outcome AS safetyOutcome,r.shadow AS safetyShadow FROM review_queue q JOIN asset_version v ON v.id=q.version_id AND v.state='awaiting_review' LEFT JOIN user u ON u.id=v.contributor_id LEFT JOIN user cu ON cu.id=q.claimed_by LEFT JOIN safety_report r ON r.rowid=(SELECT r2.rowid FROM safety_report r2 WHERE r2.version_id=q.version_id ORDER BY r2.created_at DESC,r2.rowid DESC LIMIT 1) WHERE q.decided_at IS NULL ORDER BY q.priority DESC,q.enqueued_at LIMIT 200";
  const plain="SELECT q.version_id AS versionId,q.priority,q.reason,q.revision,q.enqueued_at AS enqueuedAt,q.claim_expires_at AS claimExpiresAt,q.claimed_by AS claimedBy,cu.name AS claimedByName,v.title,v.kind,v.contributor_id AS contributorId,u.name AS contributorName,NULL AS safetyOutcome,NULL AS safetyShadow FROM review_queue q JOIN asset_version v ON v.id=q.version_id AND v.state='awaiting_review' LEFT JOIN user u ON u.id=v.contributor_id LEFT JOIN user cu ON cu.id=q.claimed_by WHERE q.decided_at IS NULL ORDER BY q.priority DESC,q.enqueued_at LIMIT 200";
  let items:Record<string,unknown>[];
  try{items=(await env.DB.prepare(joined).all<Record<string,unknown>>()).results;}catch(error){if(error instanceof HttpError)throw error;items=(await env.DB.prepare(plain).all<Record<string,unknown>>()).results;}
  const ids=items.map(i=>String(i.versionId)),thumbs=new Map<string,string[]>(),top=new Map<string,unknown>();
  if(ids.length){
   const latest="r.id=(SELECT r2.id FROM safety_report r2 WHERE r2.version_id=r.version_id ORDER BY r2.created_at DESC,r2.rowid DESC LIMIT 1)";
   for(let i=0;i<ids.length;i+=SQL_BIND_LIMIT){
    const part=ids.slice(i,i+SQL_BIND_LIMIT),marks=part.map(()=>'?').join(',');
    try{
     for(const r of (await env.DB.prepare("SELECT r.version_id AS v,a.name FROM safety_report r JOIN safety_attempt t ON t.report_id=r.id JOIN safety_artifact a ON a.attempt_id=t.id WHERE r.version_id IN ("+marks+") AND a.name IN ('"+THUMBS.join("','")+"') AND "+latest).bind(...part).all<{v:string;name:string}>()).results){const l=thumbs.get(r.v)??[];l.push(r.name);thumbs.set(r.v,l);}
     for(const r of (await env.DB.prepare("SELECT r.version_id AS v,f.category,f.band,f.detector FROM safety_report r JOIN safety_finding f ON f.report_id=r.id AND f.idx=0 WHERE r.version_id IN ("+marks+") AND "+latest).bind(...part).all<{v:string;category:string;band:string;detector:string}>()).results)top.set(r.v,{category:r.category,band:r.band,detector:r.detector});
    }catch(error){if(error instanceof HttpError)throw error;}
   }
  }
  return json({items:items.map((item:Record<string,unknown>)=>({...item,mine:item.claimedBy===actor.id,ownContent:item.contributorId===actor.id,thumbnails:(thumbs.get(String(item.versionId))??[]).sort((a,b)=>THUMBS.indexOf(a)-THUMBS.indexOf(b)),topFinding:top.get(String(item.versionId))??null})),cursor:await cursor(env),pollAfterMs:POLL_AFTER_MS});

 }
 if(path==='/api/moderation/queue/events'&&method==='GET'){
  const after=Number(url.searchParams.get('after')??0);
  if(!Number.isSafeInteger(after)||after<0)throw new HttpError(400,'invalid_cursor');
  const events=(await env.DB.prepare('SELECT seq,version_id AS versionId,actor_id AS actorId,kind,detail,created_at AS createdAt FROM queue_event_log WHERE seq>? ORDER BY seq LIMIT 200').bind(after).all<Record<string,unknown>>()).results;
  return json({events:events.map((e:Record<string,unknown>)=>({...e,detail:e.detail?parseJson(e.detail):null})),cursor:events.length?Number(events.at(-1)!.seq):after,pollAfterMs:POLL_AFTER_MS});
 }
 const asset=/^\/api\/moderation\/queue\/([a-f0-9]{64})\/(image|image-url|model)$/.exec(path);
 if(asset&&method==='GET'){
  // Moderator-only byte access. Images come from the latest report's stored artifacts (sha-checked); the model is the
  // uploaded original for the interactive viewer. Never public, never cached, never sniffed.
  if(!objects)throw new HttpError(404,'not_found');await queueRow(env,asset[1]!);const store=objects();
  const headers=(type:string)=>({'content-type':type,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});
  if(asset[2]==='image-url'){
   // Preferred path: a 2-minute signed URL straight to private storage, so image bytes never stream through the
   // Worker. Only for an artifact of the latest report; the moderator check above already ran. In local mode (no
   // signing) the client falls back to the byte route.
   const name=url.searchParams.get('name')??'';if(!ARTIFACT_NAME.test(name))throw new HttpError(400,'invalid_name');
   const row=await env.DB.prepare('SELECT a.object_key,a.media_type FROM safety_artifact a JOIN safety_attempt t ON t.id=a.attempt_id JOIN safety_report r ON r.id=t.report_id WHERE r.version_id=? AND a.name=? ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1').bind(asset[1],name).first<{object_key:string;media_type:string}>();if(!row)throw new HttpError(404,'image_not_found');
   if(!store.signedRead)return json({url:null,mediaType:row.media_type});
   try{return json({url:await store.signedRead(row.object_key,SIGNED_URL_TTL_S),expiresAt:now+SIGNED_URL_TTL_S*1000,mediaType:row.media_type});}catch(error){if(error instanceof HttpError&&error.status!==503)throw error;return json({url:null,mediaType:row.media_type});}
  }
  if(asset[2]==='image'){
   const name=url.searchParams.get('name')??'';if(!ARTIFACT_NAME.test(name))throw new HttpError(400,'invalid_name');
   const row=await env.DB.prepare('SELECT a.object_key,a.sha256,a.bytes,a.media_type FROM safety_artifact a JOIN safety_attempt t ON t.id=a.attempt_id JOIN safety_report r ON r.id=t.report_id WHERE r.version_id=? AND a.name=? ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1').bind(asset[1],name).first<{object_key:string;sha256:string;bytes:number;media_type:string}>();if(!row)throw new HttpError(404,'image_not_found');
   const data=await store.read(row.object_key);if(!data||data.length!==row.bytes||await digest(data)!==row.sha256)throw new HttpError(409,'artifact_missing_or_changed');
   return new Response(data as unknown as BodyInit,{headers:headers(row.media_type)});
  }
  // The viewer gets normalized.glb (the jail's three.js re-encode: no extensions, extras or unknown chunks) when the
  // latest report has one; the uploaded original only as a fallback for uploads scanned before normalization.
  const norm=await env.DB.prepare('SELECT n.object_key,n.bytes,n.sha256 FROM safety_normalized n JOIN safety_attempt t ON t.id=n.attempt_id WHERE t.report_id=(SELECT r.id FROM safety_report r WHERE r.version_id=? ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1)').bind(asset[1]).first<{object_key:string;bytes:number;sha256:string}>();
  if(norm){const data=store.readUpTo?await store.readUpTo(norm.object_key,norm.bytes):await store.read(norm.object_key);if(!data||data.length!==norm.bytes||await digest(data)!==norm.sha256)throw new HttpError(409,'artifact_missing_or_changed');return new Response(data as unknown as BodyInit,{headers:{...headers('model/gltf-binary'),'x-model-source':'normalized'}});}
  const up=await env.DB.prepare('SELECT object_key,declared_bytes,declared_sha256,format FROM uploads WHERE version_id=?').bind(asset[1]).first<{object_key:string;declared_bytes:number;declared_sha256:string;format:string}>();if(!up)throw new HttpError(404,'model_not_found');
  const data=store.readUpTo?await store.readUpTo(up.object_key,up.declared_bytes):await store.read(up.object_key);if(!data||data.length!==up.declared_bytes||await digest(data)!==up.declared_sha256)throw new HttpError(409,'artifact_missing_or_changed');
  return new Response(data as unknown as BodyInit,{headers:headers(up.format==='glb'?'model/gltf-binary':'model/gltf+json')});
 }
 const m=/^\/api\/moderation\/queue\/([a-f0-9]{64})(?:\/(claim|heartbeat|release|decision|override))?$/.exec(path);if(!m)return null;
 const id=m[1]!,action=m[2];
 if(!action&&method==='GET'){
  const row=await queueRow(env,id),version=await env.DB.prepare('SELECT id,asset_id,title,kind,state,contributor_id,created_at FROM asset_version WHERE id=?').bind(id).first();
  const read=async<T>(work:Promise<T>,fallback:T)=>{try{return await work;}catch(error){if(error instanceof HttpError)throw error;return fallback;}};
  const history=await read(env.DB.prepare("SELECT seq,actor_id AS actorId,kind,detail,created_at AS createdAt FROM queue_event_log WHERE version_id=? ORDER BY seq").bind(id).all<Record<string,unknown>>().then(r=>r.results.map((e:Record<string,unknown>)=>({...e,detail:e.detail?parseJson(e.detail):null}))),[]);
  const reports=await read(env.DB.prepare("SELECT id,outcome,shadow,policy_version AS policyVersion,created_at AS createdAt FROM safety_report WHERE version_id=? ORDER BY created_at DESC").bind(id).all<{id:string}>().then(r=>r.results),[] as {id:string}[]);
  const findings=await read(reports.length?env.DB.prepare("SELECT idx,category,detector,band,artifact_path AS artifactPath,bbox,text_span AS textSpan FROM safety_finding WHERE report_id=? ORDER BY idx").bind(reports[0]!.id).all().then(r=>r.results):Promise.resolve([]),[] as Record<string,unknown>[]);
  const latest=await read(reports.length?env.DB.prepare("SELECT summary FROM safety_report WHERE id=?").bind(reports[0]!.id).first<{summary:string}>():Promise.resolve(null),null);
  const summary=latest?parseJson(latest.summary) as Record<string,unknown>|null:null;
  const images=await read(latestArtifacts(env,id).all<{name:string;media_type:string}>().then(r=>r.results.map(row=>({name:row.name,mediaType:row.media_type}))),[] as {name:string;mediaType:string}[]);
  const upload=await read(env.DB.prepare("SELECT id,source,format,declared_bytes AS bytes,provenance,category,description,created_at AS createdAt FROM uploads WHERE version_id=?").bind(id).first<Record<string,unknown>>(),null);
  const coverage=summary&&typeof summary==='object'&&!Array.isArray(summary)?((summary as {coverage?:unknown}).coverage??null):null;
  return json({item:{...row,mine:row.claimed_by===actor.id},version,history,safetyReports:reports,findings:findings.map((f:Record<string,unknown>)=>({...f,bbox:f.bbox?parseJson(f.bbox):null})),images,coverage,upload:upload?{...upload,provenance:upload.provenance?parseJson(upload.provenance):null}:null,hasModel:!!upload});

 }
 if(method!=='POST')return null;
 const input=await body(request,['revision','decision','note','outcome','reason']);
 if(action==='claim'){
  const row=await queueRow(env,id);
  const contributor=await env.DB.prepare('SELECT contributor_id FROM asset_version WHERE id=?').bind(id).first<{contributor_id:string}>();
  if(contributor?.contributor_id===actor.id)throw new HttpError(403,'own_content');
  if(row.claimed_by&&row.claimed_by!==actor.id&&Number(row.claim_expires_at)>=now)throw new HttpError(409,'already_claimed');
  const expires=now+CLAIM_MS;
  await env.DB.batch([
   env.DB.prepare('UPDATE review_queue SET claimed_by=?,claim_expires_at=?,revision=revision+1 WHERE version_id=? AND revision=? AND decided_at IS NULL AND (claimed_by IS NULL OR claimed_by=? OR claim_expires_at<?)').bind(actor.id,expires,id,row.revision,actor.id,now),
   env.DB.prepare("INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) SELECT ?,?,'claimed',NULL,? WHERE EXISTS(SELECT 1 FROM review_queue WHERE version_id=? AND claimed_by=? AND revision=?)").bind(id,actor.id,now,id,actor.id,row.revision+1),
  ]);
  if(!await holds(env,id,actor.id,row.revision+1,now))throw new HttpError(409,'already_claimed');
  return json({claimed:true,revision:row.revision+1,expiresAt:expires});
 }
 const revision=revisionOf(input.revision);
 if(action==='heartbeat'){
  if(!await holds(env,id,actor.id,revision,now))throw new HttpError(409,'claim_lost');
  const expires=now+CLAIM_MS;await env.DB.prepare('UPDATE review_queue SET claim_expires_at=? WHERE version_id=? AND claimed_by=? AND revision=?').bind(expires,id,actor.id,revision).run();
  return json({claimed:true,revision,expiresAt:expires});
 }
 if(action==='release'){
  if(!await holds(env,id,actor.id,revision,now))throw new HttpError(409,'claim_lost');
  await env.DB.batch([env.DB.prepare('UPDATE review_queue SET claimed_by=NULL,claim_expires_at=NULL,revision=revision+1 WHERE version_id=? AND claimed_by=? AND revision=?').bind(id,actor.id,revision),event(env,id,actor.id,'released',null,now)]);
  return json({released:true});
 }
 if(action==='decision'){
  if(typeof input.decision!=='string'||!DECISIONS.includes(input.decision))throw new HttpError(400,'invalid_decision');
  const note=input.note??'';if(typeof note!=='string'||note.length>1000)throw new HttpError(400,'invalid_note');
  if(input.decision!=='approve'&&!note.trim())throw new HttpError(400,'note_required');
  if(!await holds(env,id,actor.id,revision,now))throw new HttpError(409,'claim_lost');
  await env.DB.batch([
   env.DB.prepare("INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) SELECT ?,?,'decided',json_object('decision',?,'note',?,'revision',?),? WHERE EXISTS(SELECT 1 FROM review_queue WHERE version_id=? AND claimed_by=? AND revision=? AND decided_at IS NULL)").bind(id,actor.id,input.decision,note,revision,now,id,actor.id,revision),
   env.DB.prepare('UPDATE review_queue SET decided_at=?,decided_by=?,claimed_by=NULL,claim_expires_at=NULL,revision=revision+1 WHERE version_id=? AND claimed_by=? AND revision=? AND decided_at IS NULL').bind(now,actor.id,id,actor.id,revision),
  ]);
  const after=await env.DB.prepare('SELECT decided_by FROM review_queue WHERE version_id=?').bind(id).first<{decided_by:string|null}>();if(after?.decided_by!==actor.id)throw new HttpError(409,'claim_lost');
  return json({decided:true,decision:input.decision});
 }
 if(action==='override'){
  if(!canOverride(actor))throw new HttpError(403,'moderator_required');
  if(input.outcome!=='clean'&&input.outcome!=='violation')throw new HttpError(400,'invalid_outcome');
  if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)throw new HttpError(400,'invalid_reason');
  if(!await holds(env,id,actor.id,revision,now))throw new HttpError(409,'claim_lost');
  await event(env,id,actor.id,'override',{outcome:input.outcome,reason:input.reason},now).run();return json({recorded:true});
 }
 return null;
}

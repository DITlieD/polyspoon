import {reserveStorage} from './budgets.ts';
import type {Env,PrivateObjects} from './types.ts';
import type {Principal,VersionState} from './domain.ts';
import type {ReviewDraft} from '../src/review/types.ts';
import {createReviewRecord} from '../src/review/records.ts';
import {body,bytes,json} from './input.ts';
import {allowedTransition,canonical,digest,HttpError,nonempty,requireCapability,requireScope,safeArtifactPath,versionIdentity} from './domain.ts';
import {artifactKey,attachmentKey,audit,mediaType,requireUploaded,subjectInput,version} from './repository.ts';
import {checkPublication,capabilityFor} from './authority.ts';
import {verificationProgress,readVerifiedArtifact,readVerifiedAttachment,publicationCompleteSql} from './verification.ts';
import type {VerifiedArtifact} from './verification.ts';
import {inspectReviews,reviewEvidence} from './review-inspection.ts';
import {processingEvidence} from './processing-evidence.ts';
import {processingRequirement} from './processing-result.ts';
import {processingCompleteSql} from './processing-proof.ts';
import {byteResponse} from './delivery.ts';

function canInspect(actor:Principal,author:string){return actor.id===author||(!actor.scopes&&actor.capabilities.some(c=>c==='verifier'||c==='publisher'||c==='admin'||c.startsWith('reviewer:')));}
export async function versionRoutes(request:Request,env:Env,actor:Principal,path:string,objects:()=>PrivateObjects):Promise<Response|null>{
 if(path==='/api/review-queue'&&request.method==='GET'){
  if(actor.scopes)throw new HttpError(403,'review_capability_required');const states:string[]=[];
  if(actor.capabilities.includes('verifier'))states.push('submitted','processing');
  if(actor.capabilities.some(capability=>capability.startsWith('reviewer:')))states.push('awaiting_review');
  if(actor.capabilities.includes('publisher'))states.push('awaiting_review','approved');
  const permitted=[...new Set(states)];if(!permitted.length)throw new HttpError(403,'review_capability_required');
  const rows=(await env.DB.prepare('SELECT id,asset_id,contributor_id,title,kind,state,created_at,processing_requirement,processing_policy_version FROM asset_version WHERE contributor_id!=? AND state IN ('+permitted.map(()=>'?').join(',')+') ORDER BY created_at,id LIMIT 100').bind(actor.id,...permitted).all()).results;return json({versions:rows});
 }
 if(path==='/api/versions'&&request.method==='POST'){
  requireScope(actor,'submissions:write');const input=await body(request,['assetId','title','kind','subject']);if(!nonempty(input.assetId,80)||!/^[a-zA-Z0-9_-]+$/.test(input.assetId)||!nonempty(input.title,160)||!['recipe','preset'].includes(String(input.kind)))throw new HttpError(400,'invalid_recipe_submission');const subject=subjectInput(input.subject);
  const id=await versionIdentity({contributor:actor.id,asset:input.assetId,title:input.title,kind:input.kind,subject,processingRequirement}),existing=await env.DB.prepare('SELECT id FROM asset_version WHERE id=?').bind(id).first();if(existing)return json({id,state:(await version(env,id)).state});
  const files={...subject.artifacts,'report.json':subject.report},descriptors=Object.entries(files).map(([file,data])=>({path:file,sha256:data.sha256,bytes:data.bytes,media_type:mediaType(file)}));
  await reserveStorage(env,'source:'+id,actor.id,'source',descriptors.reduce((sum,file)=>sum+file.bytes,0));
  const statements=[env.DB.prepare("INSERT OR IGNORE INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at,verification_profile,processing_requirement,processing_policy_version) VALUES(?,?,?,?,?,?,?,'receipts-v1','package-replay-v1','linux-bwrap-cgroup-v1')").bind(id,input.assetId,actor.id,input.title,input.kind,canonical(subject),Date.now()),env.DB.prepare("INSERT INTO version_artifact(version_id,path,sha256,bytes,media_type) SELECT ?,json_extract(value,'$.path'),json_extract(value,'$.sha256'),json_extract(value,'$.bytes'),json_extract(value,'$.media_type') FROM json_each(?)").bind(id,JSON.stringify(descriptors)),env.DB.prepare('UPDATE asset_version SET manifest_sealed=1 WHERE id=?').bind(id),await audit(env,actor.id,'version_created',id,{subjectId:subject.subjectId})];
  try{await env.DB.batch(statements);}catch(error){if(!(await env.DB.prepare('SELECT id FROM asset_version WHERE id=?').bind(id).first()))throw error;}
  return json({id,state:'draft'},201);
 }
 const attachment=/^\/api\/review-evidence\/([a-f0-9]{64})$/.exec(path);
 if(attachment&&request.method==='PUT'){
  if(actor.scopes||!actor.capabilities.some(c=>c==='verifier'||c.startsWith('reviewer:')))throw new HttpError(403,'review_capability_required');const data=await bytes(request,2*1024*1024);if(await digest(data)!==attachment[1])throw new HttpError(400,'attachment_digest_mismatch');
  await reserveStorage(env,'evidence:'+actor.id+':'+attachment[1],actor.id,'evidence',data.length);
  await env.DB.prepare("INSERT OR IGNORE INTO review_attachment(owner_id,sha256,bytes) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND c.name IN ('verifier','reviewer:visual','reviewer:portability','reviewer:executable-source'))").bind(actor.id,attachment[1],data.length,actor.id).run();const file=await env.DB.prepare('SELECT bytes,failure_revision FROM review_attachment WHERE owner_id=? AND sha256=?').bind(actor.id,attachment[1]).first<{bytes:number;failure_revision:number}>();if(!file||file.bytes!==data.length)throw new HttpError(409,'attachment_descriptor_changed');const store=objects();await store.putIfAbsent(attachmentKey(actor.id,attachment[1]!),data);await readVerifiedAttachment(env,store,actor.id,attachment[1]!,file,true);return json({sha256:attachment[1],bytes:data.length},201);
 }
 const evidence=/^\/api\/versions\/([a-f0-9]{64})\/reviews\/([a-f0-9]{64})\/files$/.exec(path),match=/^\/api\/versions\/([a-f0-9]{64})(?:\/(artifacts|files|reviews|transition|processing(?:\/files)?))?$/.exec(path);if(!match&&!evidence)return null;
 requireScope(actor,'submissions:write');const row=await version(env,(match??evidence)![1]!);if(!canInspect(actor,row.contributor_id))throw new HttpError(404,'version_not_found');
 if(evidence&&['GET','HEAD'].includes(request.method))return reviewEvidence(request,env,objects(),row.id,evidence[2]!);if(!match)return null;
 if(match[2]==='reviews'&&request.method==='GET')return json(await inspectReviews(env,row.id));
 if(!match[2]&&request.method==='GET')return json({...row,subject:JSON.parse(row.subject),verification:await verificationProgress(env,row.id,row.verification_profile)});
 if(match[2]==='processing/files'&&['GET','HEAD'].includes(request.method))return processingEvidence(request,env,objects(),row.id);
 if(match[2]==='processing'&&request.method==='GET'){const job=await env.DB.prepare("SELECT j.id,j.profile,j.status,j.attempts,a.lease_expires_at AS leaseExpiresAt,j.first_failure AS firstFailure,j.technical_record_id AS technicalRecordId,CASE WHEN a.result_hash!='expired' THEN a.result END AS result,EXISTS(SELECT 1 FROM asset_version v WHERE v.id=j.version_id AND "+processingCompleteSql('v')+" AND "+publicationCompleteSql('v')+") AS ready FROM processing_job j LEFT JOIN processing_attempt a ON a.id=j.current_attempt WHERE j.version_id=?").bind(row.id).first();return json({job:job?{...job,ready:!!job.ready,firstFailure:job.firstFailure?JSON.parse(String(job.firstFailure)):null,result:job.result?JSON.parse(String(job.result)):null}:null});}
 if(match[2]==='files'&&['GET','HEAD'].includes(request.method)){
  const name=new URL(request.url).searchParams.get('path');if(!name||!safeArtifactPath(name))throw new HttpError(400,'invalid_artifact_path');const file=await env.DB.prepare('SELECT * FROM version_artifact WHERE version_id=? AND path=? AND uploaded=1').bind(row.id,name).first<VerifiedArtifact>();if(!file)throw new HttpError(404,'artifact_not_found');const data=await readVerifiedArtifact(env,objects(),row.id,file);return byteResponse(request,data,file.media_type,name.split('/').at(-1));
 }
 if(match[2]==='artifacts'&&request.method==='PUT'){
  if(actor.id!==row.contributor_id||row.state!=='draft')throw new HttpError(403,'draft_owner_required');const name=new URL(request.url).searchParams.get('path');if(!name||!safeArtifactPath(name))throw new HttpError(400,'invalid_artifact_path');const file=await env.DB.prepare('SELECT * FROM version_artifact WHERE version_id=? AND path=?').bind(row.id,name).first<VerifiedArtifact>();if(!file)throw new HttpError(404,'artifact_not_found');
  const data=await bytes(request,2*1024*1024);if(data.length!==file.bytes||await digest(data)!==file.sha256)throw new HttpError(400,'artifact_digest_mismatch');const store=objects();await store.putIfAbsent(artifactKey(row.id,name),data);await readVerifiedArtifact(env,store,row.id,file,actor.id);return json({uploaded:true,verified:true});
 }
 if(match[2]==='reviews'&&request.method==='POST'){
  const input=await body(request,['category','decision','coverage','findings','attachments','sourceInspection','limits']);requireCapability(actor,capabilityFor(String(input.category)));if(actor.id===row.contributor_id)throw new HttpError(403,'contributor_self_review_forbidden');
  const technical=input.category==='technical';if(technical&&row.processing_requirement!=='legacy')throw new HttpError(409,'isolated_processing_required');if(row.state!==(technical?'processing':'awaiting_review'))throw new HttpError(409,'review_state_required');
  let record;try{record=createReviewRecord(JSON.parse(row.subject),{...input,reviewerId:actor.id} as ReviewDraft);}catch{throw new HttpError(400,'invalid_review_record');}
  if(Object.keys(record.attachments??{}).length>4)throw new HttpError(400,'too_many_review_attachments');
  for(const file of Object.values(record.attachments??{})){const found=await env.DB.prepare('SELECT bytes,verified_revision,failure_revision,verification_error FROM review_attachment WHERE owner_id=? AND sha256=?').bind(actor.id,file.sha256).first<{bytes:number;verified_revision:number|null;failure_revision:number;verification_error:string|null}>();if(!found||found.bytes!==file.bytes||(row.verification_profile==='receipts-v1'&&(found.verified_revision===null||found.verified_revision!==found.failure_revision||!!found.verification_error)))throw new HttpError(409,'review_attachment_missing');}
  const table=technical?'technical_attestation':'review_record',columns=technical?'record_id,version_id,reviewer_id,record,created_at':'record_id,version_id,reviewer_id,record,created_at,category';const values:unknown[]=[record.recordId,row.id,actor.id,JSON.stringify(record),Date.now()];if(!technical)values.push(record.category);
  const placeholders=values.map(()=>'?').join(',');const insert=env.DB.prepare('INSERT OR IGNORE INTO '+table+'('+columns+') SELECT '+placeholders+" WHERE EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND c.name=?) AND EXISTS(SELECT 1 FROM asset_version WHERE id=? AND state=? AND contributor_id!=?)").bind(...values,actor.id,capabilityFor(record.category),row.id,row.state,actor.id);
  const result=await env.DB.batch([insert,await audit(env,actor.id,'review_record_attempt',row.id,{recordId:record.recordId,category:record.category})]);if(!result[0]?.meta.changes){const stored=await env.DB.prepare('SELECT record_id FROM '+table+" WHERE record_id=? AND EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND c.name=?)").bind(record.recordId,actor.id,capabilityFor(record.category)).first();if(!stored)throw new HttpError(409,'authority_or_version_changed');}return json({recordId:record.recordId},201);
 }
 if(match[2]==='transition'&&request.method==='POST'){
  const input=await body(request,['state','reason']),to=String(input.state) as VersionState,from=row.state as VersionState;let capability:string;
  if(to==='submitted'||(to==='withdrawn'&&actor.id===row.contributor_id)){if(actor.id!==row.contributor_id)throw new HttpError(403,'contributor_required');capability='contributor';}else{capability=to==='processing'||to==='awaiting_review'?'verifier':to==='changes_requested'||to==='rejected'?'reviewer':'publisher';if(capability==='reviewer'){if(actor.scopes||!actor.capabilities.some(c=>c.startsWith('reviewer:')))throw new HttpError(403,'review_capability_required');}else requireCapability(actor,capability);if(actor.id===row.contributor_id)throw new HttpError(403,'independent_authority_required');}
  if(row.processing_requirement!=='legacy'&&['processing','awaiting_review'].includes(to))throw new HttpError(409,'isolated_processing_required');
  if(!allowedTransition(from,to,capability))throw new HttpError(409,'invalid_transition');if(['changes_requested','rejected','withdrawn'].includes(to)&&!nonempty(input.reason,1000))throw new HttpError(400,'transition_reason_required');
  if(to==='submitted')await requireUploaded(env,row.id);
  if(to==='awaiting_review'){const proof=await env.DB.prepare("SELECT record_id FROM technical_attestation WHERE version_id=? AND json_extract(record,'$.decision')='pass' AND record_id NOT IN(SELECT record_id FROM record_revocation)").bind(row.id).first();if(!proof)throw new HttpError(409,'technical_attestation_required');}
  let epoch:number|null=null,revision:number|null=null;
  if(to==='approved'||to==='published'){const check=await checkPublication(env,objects(),row);epoch=check.epoch;revision=check.reviewRevision;if(to==='published'&&(row.approval_policy_epoch!==epoch||row.approval_review_revision!==revision))throw new HttpError(409,'approval_stale');}
  const processingGuard=['awaiting_review','approved','published'].includes(to)?' AND '+processingCompleteSql('asset_version'):'';
  const completenessGuard=['submitted','processing','awaiting_review','approved','published'].includes(to)?" AND (asset_version.verification_profile='legacy' OR ("+publicationCompleteSql('asset_version')+"))":'';
  const requiredCapabilities=capability==='reviewer'?['reviewer:visual','reviewer:portability','reviewer:executable-source']:[capability];
  const update=env.DB.prepare("UPDATE asset_version SET state=?,approval_policy_epoch=CASE WHEN ?='approved' THEN ? ELSE approval_policy_epoch END,approval_review_revision=CASE WHEN ?='approved' THEN ? ELSE approval_review_revision END,approved_by=CASE WHEN ?='approved' THEN ? ELSE approved_by END,published_at=CASE WHEN ?='published' THEN ? ELSE published_at END WHERE id=? AND state=? AND review_revision=? AND (? IS NULL OR EXISTS(SELECT 1 FROM authority_policy WHERE id=1 AND epoch=?)) AND EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND ((?='contributor' AND asset_version.contributor_id=m.user_id) OR EXISTS(SELECT 1 FROM capability c WHERE c.user_id=m.user_id AND c.name IN ("+requiredCapabilities.map(()=>'?').join(',')+"))))"+completenessGuard+processingGuard).bind(to,to,epoch,to,revision,to,actor.id,to,Date.now(),row.id,from,row.review_revision,epoch,epoch,actor.id,capability,...requiredCapabilities);
  const changed=await env.DB.batch([update,...(to==='submitted'&&row.processing_requirement!=='legacy'?[env.DB.prepare("INSERT OR IGNORE INTO processing_job(id,version_id,profile,created_at) SELECT ?,id,processing_requirement,? FROM asset_version WHERE id=? AND state='submitted'").bind(crypto.randomUUID(),Date.now(),row.id)]:[]),await audit(env,actor.id,'transition_attempt',row.id,{from,to,reason:input.reason??null})]);if(!changed[0]?.meta.changes)throw new HttpError(409,'version_or_authority_changed');return json({id:row.id,state:to});
 }
 return null;
}

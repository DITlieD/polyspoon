// Appeals against an automated rejection (`rejected_auto`). The pre-filter can only reject or flag; an appeal is the
// way back to humans. The owner files one appeal per upload (a short message). A moderator or admin, never the
// owner, then accepts or declines it. Accepting records an `override` event with outcome `appeal_accepted` and moves
// the version rejected → awaiting_review into the live queue (the 0015 trigger refuses the move without that
// moderator event). It does not approve anything: the model still needs a reviewer, a safety clearance (override
// `clean`, required because the latest report is a reject) and the publisher step.
import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError} from './domain.ts';
import {body,json} from './input.ts';
type AppealRow={uploadId:string;versionId:string;title:string|null;reason:string|null;message:string|null;status:string|null;createdAt:number;rejectedAt:number;ownerId:string;ownerName:string|null};
const isModerator=(a:Principal)=>!a.scopes&&a.status==='active'&&a.verified&&a.capabilities.some(c=>c==='moderator'||c==='admin');
export const APPEAL_MAX=500;

/** Owner side, mounted under /api/uploads/:id/appeal by uploads.ts. */
export async function fileAppeal(env:Env,actor:Principal,uploadId:string,input:Record<string,unknown>,now:number){
 const row=await env.DB.prepare('SELECT id,owner_id,status,version_id FROM uploads WHERE id=?').bind(uploadId).first<{id:string;owner_id:string;status:string;version_id:string|null}>();
 if(!row||row.owner_id!==actor.id)throw new HttpError(404,'upload_not_found');
 if(row.status!=='rejected_auto'||!row.version_id)throw new HttpError(409,'appeal_not_available');
 const message=typeof input.message==='string'?input.message.trim():'';if(!message||message.length>APPEAL_MAX)throw new HttpError(400,'invalid_message');
 if(await env.DB.prepare('SELECT 1 FROM upload_appeal WHERE upload_id=?').bind(uploadId).first())throw new HttpError(409,'appeal_already_filed');
 await env.DB.prepare('INSERT INTO upload_appeal(upload_id,version_id,owner_id,message,created_at) VALUES(?,?,?,?,?)').bind(uploadId,row.version_id,actor.id,message,now).run();
 return json({appeal:{status:'open'}},201);
}

export async function appealRoutes(request:Request,env:Env,actor:Principal,path:string):Promise<Response|null>{
 if(path!=='/api/moderation/appeals'&&!path.startsWith('/api/moderation/appeals/'))return null;
 if(!isModerator(actor))throw new HttpError(403,actor.scopes?'interactive_session_required':'moderator_required');
 const now=Date.now(),method=request.method;
 if(path==='/api/moderation/appeals'&&method==='GET'){
  // Every auto-rejection still open to a decision: filed appeals first, then the rest (moderators may reopen
  // proactively, e.g. after a false positive is reported out of band).
  const rows=(await env.DB.prepare("SELECT u.id AS uploadId,u.version_id AS versionId,u.title,u.reason,ap.message,ap.status,COALESCE(ap.created_at,ar.created_at) AS createdAt,ar.created_at AS rejectedAt,u.owner_id AS ownerId,us.name AS ownerName FROM uploads u JOIN version_auto_rejection ar ON ar.version_id=u.version_id LEFT JOIN upload_appeal ap ON ap.upload_id=u.id LEFT JOIN user us ON us.id=u.owner_id WHERE u.status='rejected_auto' AND (ap.status IS NULL OR ap.status='open') ORDER BY (ap.status='open') DESC,COALESCE(ap.created_at,ar.created_at) LIMIT 200").all<AppealRow>()).results;
  const ids=rows.map(r=>r.versionId),findings=new Map<string,{category:string;band:string;detector:string;textSpan:string|null}[]>();
  if(ids.length)for(const f of (await env.DB.prepare("SELECT r.version_id AS v,f.category,f.band,f.detector,f.text_span AS textSpan FROM safety_report r JOIN safety_finding f ON f.report_id=r.id WHERE r.version_id IN ("+ids.map(()=>'?').join(',')+") AND f.band='reject' AND r.id=(SELECT r2.id FROM safety_report r2 WHERE r2.version_id=r.version_id ORDER BY r2.created_at DESC,r2.rowid DESC LIMIT 1) ORDER BY f.idx").bind(...ids).all<{v:string;category:string;band:string;detector:string;textSpan:string|null}>()).results){const l=findings.get(f.v)??[];if(l.length<5)l.push({category:f.category,band:f.band,detector:f.detector,textSpan:f.textSpan});findings.set(f.v,l);}
  return json({appeals:rows.map(r=>({...r,filed:r.status==='open',ownContent:r.ownerId===actor.id,findings:findings.get(r.versionId)??[]}))});
 }
 const m=/^\/api\/moderation\/appeals\/([a-f0-9]{64})$/.exec(path);
 if(!m||method!=='POST')return null;
 const versionId=m[1]!,input=await body(request,['decision','reason']);
 if(input.decision!=='accept'&&input.decision!=='decline')throw new HttpError(400,'invalid_decision');
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)throw new HttpError(400,'invalid_reason');
 const up=await env.DB.prepare("SELECT u.id,u.owner_id FROM uploads u JOIN version_auto_rejection ar ON ar.version_id=u.version_id WHERE u.version_id=? AND u.status='rejected_auto'").bind(versionId).first<{id:string;owner_id:string}>();
 if(!up)throw new HttpError(404,'appeal_not_found');
 if(up.owner_id===actor.id)throw new HttpError(403,'own_content');
 const appeal=await env.DB.prepare('SELECT status FROM upload_appeal WHERE upload_id=?').bind(up.id).first<{status:string}>();
 if(appeal&&appeal.status!=='open')throw new HttpError(409,'appeal_already_decided');
 const outcome=input.decision==='accept'?'appeal_accepted':'appeal_declined',reason=input.reason.trim();
 const s=[env.DB.prepare("INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) VALUES(?,?,'override',json_object('outcome',?,'reason',?),?)").bind(versionId,actor.id,outcome,reason,now)];
 if(appeal)s.push(env.DB.prepare("UPDATE upload_appeal SET status=?,decided_by=?,decided_at=? WHERE upload_id=? AND status='open'").bind(input.decision==='accept'?'accepted':'declined',actor.id,now,up.id));
 if(input.decision==='accept')s.push(
  env.DB.prepare("UPDATE asset_version SET state='awaiting_review' WHERE id=? AND state='rejected'").bind(versionId),
  env.DB.prepare("INSERT OR IGNORE INTO review_queue(version_id,priority,reason,enqueued_at) VALUES(?,85,'appeal',?)").bind(versionId,now),
  env.DB.prepare("INSERT INTO queue_event_log(version_id,actor_id,kind,detail,created_at) VALUES(?,NULL,'enqueued',json_object('reason','appeal','priority',85),?)").bind(versionId,now),
  env.DB.prepare("UPDATE uploads SET status='queued',updated_at=? WHERE id=? AND status='rejected_auto'").bind(now,up.id),
 );
 try{await env.DB.batch(s);}catch(error){if(String((error as Error)?.message??error).includes('appeal_requires_moderator'))throw new HttpError(403,'moderator_required');throw error;}
 return json({decision:input.decision,next:input.decision==='accept'?'in_live_queue_needs_review_and_safety_clearance':'stays_rejected'});
}

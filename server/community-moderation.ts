import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError,nonempty} from './domain.ts';
import {body,json} from './input.ts';

const active="EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1)";
function reviewer(actor:Principal){if(actor.scopes||!actor.capabilities.some(c=>c==='admin'||c==='moderator'))throw new HttpError(403,'moderation_capability_required');}
function authority(actor:Principal,target:string){
 return {sql:"EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND (c.name='admin' OR (c.name='moderator' AND NOT EXISTS(SELECT 1 FROM capability WHERE user_id=? AND name='admin')))) AND ?!=?",args:[actor.id,target,actor.id,target]};
}
function page(request:Request){const value=Number(new URL(request.url).searchParams.get('offset')??0);if(!Number.isSafeInteger(value)||value<0||value>100000)throw new HttpError(400,'invalid_offset');return value;}
export async function communityModeration(request:Request,env:Env,actor:Principal,path:string):Promise<Response|null>{
 if(path==='/api/account/restriction'&&request.method==='GET'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');
  const row=await env.DB.prepare('SELECT reason,restricted_at AS restrictedAt,revision FROM member_restriction WHERE user_id=?').bind(actor.id).first<{reason:string;restrictedAt:number;revision:string}>();
  const appeal=row?await env.DB.prepare('SELECT id,message,current_status AS status,created_at AS createdAt,decision_reason AS decisionReason,restriction_reason AS restrictionReason,restricted_at AS restrictedAt,actionable FROM appeal_state WHERE member_id=? AND restriction_revision=?').bind(actor.id,row.revision).first():null;
  return json({status:actor.status,reason:row?.reason??null,restrictedAt:row?.restrictedAt??null,appeal:appeal?{...appeal,actionable:!!appeal.actionable}:null});
 }
 if(path==='/api/account/appeals'&&request.method==='POST'){
  if(actor.scopes||actor.status!=='suspended')throw new HttpError(403,'restricted_interactive_session_required');const input=await body(request,['message']);if(!nonempty(input.message,1000))throw new HttpError(400,'appeal_message_required');
  const id=crypto.randomUUID();await env.DB.prepare("INSERT OR IGNORE INTO member_appeal(id,member_id,restriction_revision,message,created_at,restriction_reason,restricted_at) SELECT ?,m.user_id,r.revision,?,?,r.reason,r.restricted_at FROM member m JOIN member_restriction r ON r.user_id=m.user_id JOIN user u ON u.id=m.user_id WHERE m.user_id=? AND m.status='suspended' AND u.emailVerified=1").bind(id,input.message,Date.now(),actor.id).run();
  const row=await env.DB.prepare("SELECT a.id,a.current_status AS status FROM appeal_state a JOIN member_restriction r ON r.user_id=a.member_id AND r.revision=a.restriction_revision JOIN member m ON m.user_id=a.member_id WHERE a.member_id=? AND m.status='suspended'").bind(actor.id).first<{id:string;status:string}>();if(!row)throw new HttpError(409,'restriction_changed');return json(row,row.id===id?201:200);
 }
 if(path==='/api/account/reports'&&request.method==='GET'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');const offset=page(request);const reports=(await env.DB.prepare('SELECT id,version_id AS versionId,category,reason,status,created_at AS createdAt,resolution_reason AS decisionReason FROM model_report WHERE reporter_id=? ORDER BY created_at DESC,id LIMIT 50 OFFSET ?').bind(actor.id,offset).all()).results;return json({reports,nextOffset:reports.length===50?offset+50:null});
 }
 const report=/^\/api\/catalog\/([a-f0-9]{64})\/reports$/.exec(path);
 if(report&&request.method==='POST'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');const input=await body(request,['category','reason']);if(!['unsafe','rights','misleading','other'].includes(String(input.category))||!nonempty(input.reason,1000))throw new HttpError(400,'report_reason_required');
  const id=crypto.randomUUID();await env.DB.prepare("INSERT OR IGNORE INTO model_report(id,version_id,reporter_id,category,reason,created_at) SELECT ?,id,?,?,?,? FROM asset_version WHERE id=? AND state='published' AND "+active).bind(id,actor.id,input.category,input.reason,Date.now(),report[1],actor.id).run();
  const row=await env.DB.prepare('SELECT id,status FROM model_report WHERE version_id=? AND reporter_id=?').bind(report[1],actor.id).first<{id:string;status:string}>();if(!row)throw new HttpError(404,'model_not_found');return json(row,row.id===id?201:200);
 }
 if(['/api/moderation/reports','/api/moderation/appeals'].includes(path)&&request.method==='GET'){
  if(path==='/api/moderation/appeals'&&new URL(request.url).searchParams.get('upload')==='1')return null;
  reviewer(actor);const offset=page(request),reports=path.endsWith('/reports');const sql=reports?'SELECT r.id,r.version_id AS versionId,v.title,r.category,r.reason,r.status,r.created_at AS createdAt,r.resolution_reason AS decisionReason FROM model_report r JOIN asset_version v ON v.id=r.version_id ORDER BY (r.status!=\'open\'),r.created_at,r.id LIMIT 50 OFFSET ?':'SELECT id,member_id AS memberId,message,current_status AS status,created_at AS createdAt,decision_reason AS decisionReason,restriction_reason AS restrictionReason,restricted_at AS restrictedAt,actionable FROM appeal_state ORDER BY actionable DESC,created_at,id LIMIT 50 OFFSET ?';const rows=(await env.DB.prepare(sql).bind(offset).all()).results;return json({[reports?'reports':'appeals']:reports?rows:rows.map(row=>({...row,actionable:!!row.actionable})),nextOffset:rows.length===50?offset+50:null});
 }
 const resolve=/^\/api\/moderation\/(reports|appeals)\/([^/]+)\/resolve$/.exec(path);
 if(resolve&&request.method==='POST'){
  reviewer(actor);const input=await body(request,['decision','reason']),reports=resolve[1]==='reports';if(!(reports?['dismiss','withdraw']:['uphold','reinstate']).includes(String(input.decision))||!nonempty(input.reason,1000))throw new HttpError(400,'resolution_reason_required');
  const row=reports?await env.DB.prepare('SELECT r.*,v.contributor_id AS target FROM model_report r JOIN asset_version v ON v.id=r.version_id WHERE r.id=?').bind(resolve[2]).first<Record<string,unknown>>():await env.DB.prepare('SELECT *,member_id AS target FROM member_appeal WHERE id=?').bind(resolve[2]).first<Record<string,unknown>>();if(!row)throw new HttpError(404,'moderation_record_not_found');
  const guard=authority(actor,String(row.target));const allowed=await env.DB.prepare('SELECT '+guard.sql+' AS ok').bind(...guard.args).first<{ok:number}>();if(!allowed?.ok)throw new HttpError(403,'moderation_target_forbidden');
  if(row.status!=='open'){if(row.status===input.decision&&row[reports?'resolution_reason':'decision_reason']===input.reason)return json({resolved:true});throw new HttpError(409,'already_resolved');}
  const table=reports?'model_report':'member_appeal',reason=reports?'resolution_reason':'decision_reason',now=Date.now(),event=crypto.randomUUID();
  const update=env.DB.prepare('UPDATE '+table+' SET status=?, '+reason+'=?,resolved_by=? WHERE id=? AND status=\'open\' AND '+guard.sql+(reports?'':" AND restriction_revision=(SELECT revision FROM member_restriction WHERE user_id=member_id) AND EXISTS(SELECT 1 FROM member WHERE user_id=member_id AND status='suspended')")).bind(input.decision,input.reason,actor.id,row.id,...guard.args);
  const queries=[update,env.DB.prepare('INSERT INTO audit_event(id,actor_id,action,target,data,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(event,actor.id,reports?'report_resolved':'appeal_resolved',row.id,JSON.stringify(input),now)];
  if(reports&&input.decision==='withdraw')queries.push(env.DB.prepare("UPDATE asset_version SET state='withdrawn' WHERE id=? AND state!='withdrawn' AND EXISTS(SELECT 1 FROM audit_event WHERE id=?)").bind(row.version_id,event));
  if(!reports&&input.decision==='reinstate')queries.push(env.DB.prepare("UPDATE member SET status='active' WHERE user_id=? AND EXISTS(SELECT 1 FROM audit_event WHERE id=?)").bind(row.target,event));
  const changed=await env.DB.batch(queries);if(!changed[0]?.meta.changes)throw new HttpError(409,'authority_or_record_changed');return json({resolved:true});
 }
 return null;
}

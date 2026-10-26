import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {digest,HttpError,memberTokenScopes,nonempty,requireCapability,requireScope,secretToken} from './domain.ts';
import {body,json} from './input.ts';
import {audit} from './repository.ts';

const currentAdmin="EXISTS(SELECT 1 FROM capability c JOIN member m ON m.user_id=c.user_id JOIN user u ON u.id=m.user_id WHERE c.user_id=? AND c.name='admin' AND m.status='active' AND u.emailVerified=1)";
const capabilities=['admin','moderator','verifier','reviewer:visual','reviewer:portability','reviewer:executable-source','publisher'];
export async function accountRoutes(request:Request,env:Env,actor:Principal,path:string):Promise<Response|null>{
 if(path==='/api/account/tokens'&&request.method==='GET'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');
  const rows=(await env.DB.prepare('SELECT id,label,scopes,expires_at,revoked_at FROM agent_token WHERE user_id=? ORDER BY expires_at DESC,id LIMIT 100').bind(actor.id).all<{id:string;label:string;scopes:string;expires_at:number;revoked_at:number|null}>()).results;
  return json({tokens:rows.map(row=>({id:row.id,label:row.label,scopes:JSON.parse(row.scopes),expiresAt:row.expires_at,revokedAt:row.revoked_at}))});
 }
 if(path==='/api/account/sessions'&&request.method==='GET'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');
  const rows=(await env.DB.prepare('SELECT id,createdAt,updatedAt,expiresAt FROM session WHERE userId=? ORDER BY createdAt DESC,id LIMIT 100').bind(actor.id).all<{id:string;createdAt:number;updatedAt:number;expiresAt:number}>()).results;
  return json({sessions:rows.map(row=>({...row,current:row.id===actor.sessionId}))});
 }
 if(path==='/api/account/versions'&&request.method==='GET'){
  requireScope(actor,'submissions:write');const rows=(await env.DB.prepare('SELECT id,asset_id,title,kind,state,created_at,published_at FROM asset_version WHERE contributor_id=? ORDER BY created_at DESC,id LIMIT 100').bind(actor.id).all()).results;return json({versions:rows});
 }
 if(path==='/api/admin/members'&&request.method==='GET'){
  requireCapability(actor,'admin');const query=new URL(request.url).searchParams.get('q')??'';if(query.length>100)throw new HttpError(400,'query_too_long');
  const rows=(await env.DB.prepare("SELECT m.user_id AS id,m.status,u.email,u.name AS displayName,u.emailVerified AS verified,COALESCE(json_group_array(c.name) FILTER(WHERE c.name IS NOT NULL),'[]') AS capabilities FROM member m JOIN user u ON u.id=m.user_id LEFT JOIN capability c ON c.user_id=m.user_id WHERE instr(lower(u.email),lower(?))>0 OR instr(lower(u.name),lower(?))>0 GROUP BY m.user_id ORDER BY lower(u.email),m.user_id LIMIT 50").bind(query,query).all<{id:string;status:string;email:string;displayName:string;verified:number;capabilities:string}>()).results;
  return json({members:rows.map(row=>({...row,verified:!!row.verified,capabilities:JSON.parse(row.capabilities)}))});
 }
 if(path==='/api/account/tokens'&&request.method==='POST'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');
  const input=await body(request,['label','scopes','expiresInSeconds']);if(!nonempty(input.label,80))throw new HttpError(400,'token_label_required');const scopes=memberTokenScopes(input.scopes),ttl=Number(input.expiresInSeconds??3600);if(!Number.isSafeInteger(ttl)||ttl<60||ttl>30*86400)throw new HttpError(400,'invalid_token_expiry');
  const id=crypto.randomUUID(),token='ps_'+secretToken(),expiresAt=Date.now()+ttl*1000;
  await env.DB.batch([env.DB.prepare('INSERT INTO agent_token(id,user_id,label,secret_hash,scopes,expires_at) VALUES(?,?,?,?,?,?)').bind(id,actor.id,input.label,await digest(token),JSON.stringify(scopes),expiresAt),await audit(env,actor.id,'agent_token_created',id,{scopes,expiresAt})]);return json({id,token,scopes,expiresAt},201);
 }
 const revoke=/^\/api\/account\/tokens\/([^/]+)$/.exec(path);
 if(revoke&&request.method==='DELETE'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');
  await env.DB.batch([env.DB.prepare('UPDATE agent_token SET revoked_at=? WHERE id=? AND user_id=?').bind(Date.now(),revoke[1],actor.id),await audit(env,actor.id,'agent_token_revoked',revoke[1]!,{})]);return json({revoked:true});
 }
 const sessions=/^\/api\/account\/sessions(?:\/([^/]+))?$/.exec(path);
 if(sessions&&request.method==='DELETE'){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');
  const query=sessions[1]?env.DB.prepare('DELETE FROM session WHERE id=? AND userId=?').bind(sessions[1],actor.id):env.DB.prepare('DELETE FROM session WHERE userId=?').bind(actor.id);await env.DB.batch([query,await audit(env,actor.id,'sessions_revoked',actor.id,{session:sessions[1]??'all'})]);return json({revoked:true});
 }
 const role=/^\/api\/admin\/members\/([^/]+)\/capabilities$/.exec(path);
 if(role&&['PUT','DELETE'].includes(request.method)){
  requireCapability(actor,'admin');if(role[1]===actor.id)throw new HttpError(403,'self_authority_change_forbidden');
  const input=await body(request,['capability']);if(typeof input.capability!=='string'||!capabilities.includes(input.capability))throw new HttpError(400,'unknown_capability');
  const target=await env.DB.prepare('SELECT user_id FROM member WHERE user_id=?').bind(role[1]).first();if(!target)throw new HttpError(404,'member_not_found');
  const query=request.method==='PUT'?env.DB.prepare('INSERT OR IGNORE INTO capability(user_id,name) SELECT ?,? WHERE '+currentAdmin).bind(role[1],input.capability,actor.id):env.DB.prepare('DELETE FROM capability WHERE user_id=? AND name=? AND '+currentAdmin).bind(role[1],input.capability,actor.id);
  const results=await env.DB.batch<{authorized:number}>([query,env.DB.prepare('SELECT '+currentAdmin+' AS authorized').bind(actor.id),await audit(env,actor.id,request.method==='PUT'?'capability_grant_attempt':'capability_revoke_attempt',role[1]!,{capability:input.capability})]);if(results[1]?.results[0]?.authorized!==1)throw new HttpError(409,'authority_changed');return json({updated:true});
 }
 const suspension=/^\/api\/admin\/members\/([^/]+)\/status$/.exec(path);
 if(suspension&&request.method==='PUT'){
  requireCapability(actor,'admin');if(suspension[1]===actor.id)throw new HttpError(403,'self_authority_change_forbidden');const input=await body(request,['status','reason']);if(!['active','suspended'].includes(String(input.status))||!nonempty(input.reason,1000))throw new HttpError(400,'status_reason_required');
  const revision=crypto.randomUUID(),restrictedAt=Date.now();
  const restriction=env.DB.prepare('INSERT INTO member_restriction(user_id,reason,restricted_at,revision) SELECT ?,?,?,? WHERE '+currentAdmin+" AND ?='suspended' AND EXISTS(SELECT 1 FROM member WHERE user_id=?) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,restricted_at=CASE WHEN member_restriction.reason=excluded.reason AND EXISTS(SELECT 1 FROM member WHERE user_id=excluded.user_id AND status='suspended') THEN member_restriction.restricted_at ELSE excluded.restricted_at END,revision=CASE WHEN member_restriction.reason=excluded.reason AND EXISTS(SELECT 1 FROM member WHERE user_id=excluded.user_id AND status='suspended') THEN member_restriction.revision ELSE excluded.revision END").bind(suspension[1],input.reason,restrictedAt,revision,actor.id,input.status,suspension[1]);
  const results=await env.DB.batch<{authorized:number}>([restriction,env.DB.prepare('UPDATE member SET status=? WHERE user_id=? AND '+currentAdmin).bind(input.status,suspension[1],actor.id),env.DB.prepare("DELETE FROM session WHERE userId=? AND EXISTS(SELECT 1 FROM member WHERE user_id=? AND status='suspended') AND EXISTS(SELECT 1 FROM member_restriction WHERE user_id=? AND revision=?) AND "+currentAdmin).bind(suspension[1],suspension[1],suspension[1],revision,actor.id),env.DB.prepare("UPDATE agent_token SET revoked_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM member WHERE user_id=? AND status='suspended') AND "+currentAdmin).bind(Date.now(),suspension[1],suspension[1],actor.id),env.DB.prepare('SELECT '+currentAdmin+' AS authorized').bind(actor.id),await audit(env,actor.id,'member_status_attempt',suspension[1]!,input)]);if(results[4]?.results[0]?.authorized!==1)throw new HttpError(409,'authority_changed');if(!results[1]?.meta.changes)throw new HttpError(404,'member_not_found');return json({updated:true});
 }
 return null;
}

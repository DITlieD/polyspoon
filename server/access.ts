import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {authentication,authenticationHeaders} from './auth.ts';
import {digest,HttpError,requireActive} from './domain.ts';

export async function principal(request:Request,env:Env,allowRestricted=false):Promise<Principal>{
 const authorization=request.headers.get('authorization');let id:string;let scopes:string[]|undefined;let sessionId:string|undefined;let verified:boolean;
 if(authorization){
  if(!authorization.startsWith('Bearer ps_'))throw new HttpError(401,'invalid_agent_token');
  const row=await env.DB.prepare('SELECT user_id,scopes FROM agent_token WHERE secret_hash=? AND revoked_at IS NULL AND expires_at>?').bind(await digest(authorization.slice(7)),Date.now()).first<{user_id:string;scopes:string}>();
  if(!row)throw new HttpError(401,'invalid_agent_token');id=row.user_id;scopes=JSON.parse(row.scopes);const user=await env.DB.prepare('SELECT emailVerified FROM user WHERE id=?').bind(id).first<{emailVerified:number}>();verified=!!user?.emailVerified;
 }else{
  const session=await authentication(env).api.getSession({headers:authenticationHeaders(request,env),query:{disableCookieCache:true}});
  if(!session)throw new HttpError(401,'authentication_required');id=session.user.id;verified=session.user.emailVerified;sessionId=session.session.id;
  if(verified)await env.DB.prepare("INSERT OR IGNORE INTO member(user_id,status,created_at) VALUES(?,'active',?)").bind(id,Date.now()).run();
 }
 const row=await env.DB.prepare('SELECT m.status,COALESCE(json_group_array(c.name) FILTER (WHERE c.name IS NOT NULL),\'[]\') AS capabilities FROM member m LEFT JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? GROUP BY m.user_id').bind(id).first<{status:string;capabilities:string}>();
 const result={id,status:row?.status??'missing',verified,capabilities:JSON.parse(row?.capabilities??'[]'),scopes,sessionId};if(result.status==='suspended'){if(!allowRestricted||scopes||!verified)throw new HttpError(403,'account_restricted');result.capabilities=[];}else requireActive(result);return result;
}
export async function optionalPrincipal(request:Request,env:Env):Promise<Principal|null>{
 if(request.headers.get('authorization'))return principal(request,env,true);
 const session=await authentication(env).api.getSession({headers:authenticationHeaders(request,env),query:{disableCookieCache:true}});
 if(!session)return null;return principal(request,env,true);
}
export function mutationOrigin(request:Request,env:Env,actor:Principal){
 if(['GET','HEAD','OPTIONS'].includes(request.method))return;
 if(!actor.scopes&&request.headers.get('origin')!==env.APP_ORIGIN)throw new HttpError(403,'same_origin_required');
 if(request.headers.has('origin')&&request.headers.get('origin')!==env.APP_ORIGIN)throw new HttpError(403,'same_origin_required');
}

import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {digest,HttpError,nonempty,requireCapability,secretToken} from './domain.ts';
import {body,json} from './input.ts';
import {audit} from './repository.ts';
import {processingRequirement} from './processing-result.ts';

const adminSql="EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND c.name='admin')";
export async function processorAdminRoutes(request:Request,env:Env,actor:Principal,path:string):Promise<Response|null>{
 const match=/^\/api\/admin\/processors(?:\/([^/]+))?$/.exec(path);if(!match)return null;requireCapability(actor,'admin');
 if(!match[1]&&request.method==='GET'){const rows=(await env.DB.prepare('SELECT id,label,owner_id AS ownerUserId,profiles,enabled,created_at AS createdAt FROM processor ORDER BY created_at,id LIMIT 100').all()).results;return json({processors:rows.map(r=>({...r,profiles:JSON.parse(String(r.profiles)),enabled:!!r.enabled}))});}
 if(!match[1]&&request.method==='POST'){
  const input=await body(request,['label','ownerUserId','profiles']);if(!nonempty(input.label,160)||!nonempty(input.ownerUserId,200)||!Array.isArray(input.profiles)||input.profiles.length!==1||![processingRequirement.profile,'safety-v1'].includes(input.profiles[0]))throw new HttpError(400,'invalid_processor_enrollment');
  const id=crypto.randomUUID(),credential='pc_'+secretToken(),createdAt=Date.now();const result=await env.DB.batch([env.DB.prepare('INSERT INTO processor(id,owner_id,label,profiles,secret_hash,created_at) SELECT ?,?,?,?,?,? WHERE '+adminSql+" AND EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1)").bind(id,input.ownerUserId,input.label,JSON.stringify(input.profiles),await digest(credential),createdAt,actor.id,input.ownerUserId),await audit(env,actor.id,'processor_enrollment_attempt',id,{ownerUserId:input.ownerUserId})]);if(!result[0]?.meta.changes)throw new HttpError(409,'processor_enrollment_authority_changed');return json({processor:{id,label:input.label,ownerUserId:input.ownerUserId,profiles:input.profiles,enabled:true,createdAt},credential},201);
 }
 if(match[1]&&request.method==='DELETE'){const result=await env.DB.batch([env.DB.prepare('UPDATE processor SET enabled=0 WHERE id=? AND '+adminSql).bind(match[1],actor.id),await audit(env,actor.id,'processor_disable_attempt',match[1],{})]);if(!result[0]?.meta.changes)throw new HttpError(409,'processor_or_authority_changed');return json({disabled:true});}
 return null;
}

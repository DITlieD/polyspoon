import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError,nonempty} from './domain.ts';
import {body,json} from './input.ts';
import {audit} from './repository.ts';

export async function moderationRoutes(request:Request,env:Env,actor:Principal,path:string){
 const match=/^\/api\/reviews\/([a-f0-9]{64})\/revoke$/.exec(path);if(!match||request.method!=='POST')return null;
 if(actor.scopes||!actor.capabilities.some(c=>c==='admin'||c==='publisher'))throw new HttpError(403,'moderation_capability_required');const input=await body(request,['reason']);if(!nonempty(input.reason,1000))throw new HttpError(400,'revocation_reason_required');
 const record=await env.DB.prepare('SELECT version_id FROM technical_attestation WHERE record_id=? UNION SELECT version_id FROM review_record WHERE record_id=? UNION SELECT version_id FROM processing_attestation WHERE record_id=?').bind(match[1],match[1],match[1]).first<{version_id:string}>();if(!record)throw new HttpError(404,'review_not_found');
 const authority="EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND c.name IN ('admin','publisher'))";
 const changed=await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO record_revocation(record_id,actor_id,reason,created_at) SELECT ?,?,?,? WHERE '+authority).bind(match[1],actor.id,input.reason,Date.now(),actor.id),await audit(env,actor.id,'review_revocation_attempt',match[1]!,{reason:input.reason,version:record.version_id})]);
 if(!changed[0]?.meta.changes){const existing=await env.DB.prepare('SELECT record_id FROM record_revocation WHERE record_id=? AND '+authority).bind(match[1],actor.id).first();if(!existing)throw new HttpError(409,'authority_changed');}return json({revoked:true});
}

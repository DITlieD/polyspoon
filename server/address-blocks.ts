import {normalizedAddress,trustedClientAddress} from './client-address.ts';
import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError,nonempty,requireCapability} from './domain.ts';
import {body,json} from './input.ts';
import {audit} from './repository.ts';

async function addressHash(env:Env,address:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.AUTH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(normalizedAddress(address).toLowerCase())))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function enforceAddress(request:Request,env:Env){
 const address=trustedClientAddress(request,env);if(!address)return;
 const row=await env.DB.prepare('SELECT id FROM address_block WHERE address_hash=? AND expires_at>?').bind(await addressHash(env,address),Date.now()).first();if(row)throw new HttpError(403,'address_temporarily_blocked');
}
const admin="EXISTS(SELECT 1 FROM member m JOIN user u ON u.id=m.user_id JOIN capability c ON c.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.emailVerified=1 AND c.name='admin')";
export async function addressBlockRoutes(request:Request,env:Env,actor:Principal,path:string):Promise<Response|null>{
 const match=/^\/api\/admin\/address-blocks(?:\/([^/]+))?$/.exec(path);if(!match)return null;requireCapability(actor,'admin');
 if(!match[1]&&request.method==='GET'){const offset=Number(new URL(request.url).searchParams.get('offset')??0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new HttpError(400,'invalid_offset');const blocks=(await env.DB.prepare('SELECT id,address_hash AS addressHash,reason,expires_at AS expiresAt,created_at AS createdAt FROM address_block WHERE expires_at>? ORDER BY created_at DESC,id LIMIT 50 OFFSET ?').bind(Date.now(),offset).all()).results;return json({blocks,nextOffset:blocks.length===50?offset+50:null});}
 if(!match[1]&&request.method==='POST'){
  const input=await body(request,['address','reason','expiresInSeconds']),ttl=Number(input.expiresInSeconds);if(typeof input.address!=='string'||!/^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-fA-F0-9:]{3,45}$/.test(input.address)||!nonempty(input.reason,1000)||!Number.isSafeInteger(ttl)||ttl<60||ttl>86400)throw new HttpError(400,'invalid_address_block');
  const id=crypto.randomUUID(),hash=await addressHash(env,input.address),expiresAt=Date.now()+ttl*1000;const results=await env.DB.batch([env.DB.prepare('INSERT INTO address_block(id,address_hash,reason,expires_at,created_at) SELECT ?,?,?,?,? WHERE '+admin+' ON CONFLICT(address_hash) DO UPDATE SET reason=excluded.reason,expires_at=excluded.expires_at').bind(id,hash,input.reason,expiresAt,Date.now(),actor.id),await audit(env,actor.id,'address_block_attempt',hash,{reason:input.reason,expiresAt})]);if(!results[0]?.meta.changes)throw new HttpError(409,'authority_changed');const row=await env.DB.prepare('SELECT id FROM address_block WHERE address_hash=?').bind(hash).first<{id:string}>();return json({id:row!.id,addressHash:hash,expiresAt},201);
 }
 if(match[1]&&request.method==='DELETE'){await env.DB.batch([env.DB.prepare('DELETE FROM address_block WHERE id=? AND '+admin).bind(match[1],actor.id),await audit(env,actor.id,'address_unblock_attempt',match[1],{})]);return json({removed:true});}
 return null;
}

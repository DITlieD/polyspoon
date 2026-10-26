import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {localService} from '../server/local-test.ts';
import {bootstrapOwner} from '../server/owner-bootstrap.ts';

process.env.CLOUDFLARE_SEND_METRICS='false';
test('operator bootstrap grants only one verified active owner and remains idempotent',{timeout:120000},async()=>{
 await mkdir('server/.local',{recursive:true});const directory=await mkdtemp(resolve('server/.local/owner-bootstrap-')),service=await localService(directory,crypto.randomUUID()+crypto.randomUUID(),true,{port:8798});
 const call=(path:string,method='GET',cookie='',value?:unknown)=>fetch(service.origin+path,{method,redirect:'manual',headers:{origin:service.origin,cookie,'content-type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});
 const login=async(email:string)=>{assert.equal((await call('/api/auth/sign-in/magic-link','POST','',{email,callbackURL:'/catalog'})).status,200);const mail=await service.env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=?').bind(email).first<{url:string}>();assert.ok(mail);const signed=await fetch(mail.url,{redirect:'manual'}),cookie=signed.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),me=await (await call('/api/me','GET',cookie)).json() as {id:string};return {id:me.id,cookie};};
 try{
  await assert.rejects(bootstrapOwner(service.env,'owner-bootstrap@polyspoon.invalid'),/owner_bootstrap_unavailable/);const owner=await login('owner-bootstrap@polyspoon.invalid'),other=await login('other-bootstrap@polyspoon.invalid');assert.equal((await call('/api/admin/members','GET',owner.cookie)).status,403);assert.equal((await call('/api/deployment/bootstrap','POST',other.cookie,{email:'owner-bootstrap@polyspoon.invalid'})).status,404);
  await service.env.DB.prepare('UPDATE user SET emailVerified=0 WHERE id=?').bind(owner.id).run();await assert.rejects(bootstrapOwner(service.env,'owner-bootstrap@polyspoon.invalid'),/owner_bootstrap_unavailable/);await service.env.DB.prepare('UPDATE user SET emailVerified=1 WHERE id=?').bind(owner.id).run();
  assert.deepEqual(await bootstrapOwner(service.env,'owner-bootstrap@polyspoon.invalid'),{bootstrapped:true,alreadyConfigured:false});assert.equal((await call('/api/admin/members','GET',owner.cookie)).status,200);assert.deepEqual(await bootstrapOwner(service.env,'owner-bootstrap@polyspoon.invalid'),{bootstrapped:true,alreadyConfigured:true});await assert.rejects(bootstrapOwner(service.env,'other-bootstrap@polyspoon.invalid'),/owner_bootstrap_unavailable/);
  assert.equal((await service.env.DB.prepare("SELECT count(*) AS n FROM capability WHERE name='admin'").first<{n:number}>())?.n,1);assert.equal((await service.env.DB.prepare("SELECT count(*) AS n FROM audit_event WHERE action='deployment_owner_bootstrapped'").first<{n:number}>())?.n,1);await writeFile('server/test-evidence/owner-bootstrap.json',JSON.stringify({synthetic:true,missingOrUnverifiedOwnerDenied:true,publicBootstrapRouteAbsent:true,ordinaryMemberDenied:true,verifiedOwnerGranted:true,idempotentRepeat:true,otherOwnerBlocked:true,adminCount:1,auditCount:1},null,2)+'\n');
 }finally{await service.stop();}
});

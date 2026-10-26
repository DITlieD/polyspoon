import test from 'node:test';
import assert from 'node:assert/strict';
import {privateObjects} from '../server/storage.ts';
import {sendLoginMail} from '../server/mail.ts';
import type {Env} from '../server/types.ts';
import {authentication} from '../server/auth.ts';
import {localService} from '../server/local-test.ts';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';

const production={APP_ENV:'production',APP_ORIGIN:'https://polyspoon.com',AUTH_SECRET:'test-fixture-secret-not-a-production-credential'} as Env;
test('unconfigured production providers fail closed and never use the local mail sink',async()=>{
 assert.throws(()=>privateObjects({...production,LOCAL_MAIL_SINK:'1'}),/private_storage_unconfigured/);await assert.rejects(()=>sendLoginMail({...production,LOCAL_MAIL_SINK:'1'},'fixture@polyspoon.invalid','https://polyspoon.com/fixture'),/mail_provider_unconfigured/);
});
test('Supabase private gateway does not upsert or fall back to public origins',{concurrency:false},async()=>{
 const original=globalThis.fetch,calls:Array<{url:string;method:string;headers:Headers}>=[];let publicBucket=false,quota=false;
 const env={...production,SUPABASE_URL:'https://test-fixture.supabase.co',SUPABASE_SERVICE_KEY:'fixture-key',SUPABASE_PRIVATE_BUCKET:'private-fixture'};
 globalThis.fetch=async(input,init)=>{
  const url=String(input),headers=new Headers(init?.headers);calls.push({url,method:init?.method??'GET',headers});assert.equal(headers.get('apikey'),env.SUPABASE_SERVICE_KEY);assert.equal(headers.get('authorization'),env.SUPABASE_SERVICE_KEY.startsWith('sb_secret_')?null:'Bearer fixture-key');
  if(url.includes('/bucket/'))return Response.json({id:'private-fixture',public:publicBucket});if(quota)return Response.json({message:'quota'},{status:429});if(init?.method==='POST')return Response.json({message:'The resource already exists'},{status:409});return new Response('fixture bytes');
 };
 try{
  const objects=privateObjects(env);assert.equal(await objects.putIfAbsent('versions/fixture/asset.glb',new Uint8Array([1])),false);assert.equal(calls.at(-1)?.headers.get('x-upsert'),'false');assert.equal(new TextDecoder().decode(await objects.read('versions/fixture/asset.glb')??undefined),'fixture bytes');assert.ok(calls.every(call=>!call.url.includes('/public/')&&!call.url.includes('/sign/')));
  env.SUPABASE_SERVICE_KEY='sb_secret_fixture';assert.ok(await privateObjects(env).read('versions/fixture/asset.glb'));publicBucket=true;await assert.rejects(()=>privateObjects(env).read('versions/fixture/asset.glb'),/private_bucket_required/);publicBucket=false;quota=true;await assert.rejects(()=>privateObjects(env).read('versions/fixture/asset.glb'),/storage_quota_reached/);
 }finally{globalThis.fetch=original;}
});
test('Resend quota and service errors fail without leaking provider credentials',{concurrency:false},async()=>{
 const original=globalThis.fetch;let status=429,reservations=0;
 const DB={prepare:()=>({bind:()=>({run:async()=>{reservations++;return {success:true};}})})} as unknown as Env['DB'];
 globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://api.resend.com/emails');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer mail-fixture-key');return Response.json({name:'daily_quota_exceeded'},{status});};
 try{
  const env={...production,DB,RESEND_API_KEY:'mail-fixture-key',MAIL_FROM:'Polyspoon <login@polyspoon.com>'};await assert.rejects(()=>sendLoginMail(env,'fixture@polyspoon.invalid','https://polyspoon.com/fixture'),/mail_quota_reached/);status=503;await assert.rejects(()=>sendLoginMail(env,'fixture@polyspoon.invalid','https://polyspoon.com/fixture'),/mail_provider_unavailable/);status=200;await assert.doesNotReject(()=>sendLoginMail(env,'fixture@polyspoon.invalid','https://polyspoon.com/fixture'));assert.equal(reservations,3);
 }finally{globalThis.fetch=original;}
});

test('maintained auth handler preserves Resend quota and unavailable responses',{concurrency:false,timeout:120000},async()=>{
 await mkdir('server/.local',{recursive:true});const directory=await mkdtemp(resolve('server/.local/mail-boundary-')),service=await localService(directory,crypto.randomUUID()+crypto.randomUUID(),true,{port:8798});
 const original=globalThis.fetch;let providerStatus=429,calls=0;
 globalThis.fetch=async(input,init)=>{if(String(input)!=='https://api.resend.com/emails')return original(input,init);calls++;return Response.json({name:providerStatus===429?'daily_quota_exceeded':'service_error'},{status:providerStatus});};
 try{
  const env={...production,DB:service.env.DB,RESEND_API_KEY:'mail-fixture-key',MAIL_FROM:'Polyspoon <login@polyspoon.com>'},auth=authentication(env);
  for(const [index,status,message] of [[0,429,'mail_quota_reached'],[1,503,'mail_provider_unavailable']] as const){
   providerStatus=status;const response=await auth.handler(new Request(env.APP_ORIGIN+'/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json','x-forwarded-for':'127.0.0.1'},body:JSON.stringify({email:'boundary'+index+'@polyspoon.invalid',callbackURL:'/catalog'})}));
   assert.equal(response.status,status);const body=await response.json() as {message:string};assert.equal(body.message,message);assert.equal(JSON.stringify(body).includes(env.RESEND_API_KEY),false);assert.equal(response.headers.getSetCookie().some(value=>value.includes('session_token=')),false);
  }
  assert.equal(calls,2);
 }finally{globalThis.fetch=original;await service.stop();}
});

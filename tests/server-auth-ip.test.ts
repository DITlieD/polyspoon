import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {localService} from '../server/local-test.ts';
import worker from '../server/worker.ts';
import type {Env} from '../server/types.ts';

process.env.CLOUDFLARE_SEND_METRICS='false';
test('auth throttle ignores spoofed forwarding headers and keys trusted platform address',{timeout:120000},async()=>{
 await mkdir('server/.local',{recursive:true});const directory=await mkdtemp(resolve('server/.local/auth-ip-')),service=await localService(directory,crypto.randomUUID()+crypto.randomUUID(),true,{port:8798});const original=globalThis.fetch;let sends=0;const statuses:number[]=[];
 globalThis.fetch=async(input,init)=>{if(String(input)==='https://api.resend.com/emails'){sends++;return Response.json({id:'synthetic-mail'});}return original(input,init);};
 const env={...service.env,APP_ENV:'production',APP_ORIGIN:'https://polyspoon.com',AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),RESEND_API_KEY:'synthetic-key',MAIL_FROM:'login@polyspoon.com'} as Env;
 const request=(index:number,platform=true,address='203.0.113.10')=>{const r=new Request(env.APP_ORIGIN+'/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json','x-forwarded-for':'198.51.100.'+(index+1),'x-real-ip':'198.51.100.'+(index+1),'x-polyspoon-client-ip':'198.51.100.'+(index+1),'cf-connecting-ip':address},body:JSON.stringify({email:'ip-'+index+'@polyspoon.invalid',callbackURL:'/catalog'})});if(platform)Object.defineProperty(r,'cf',{value:{colo:'SYNTHETIC'}});return r;};
 try{
  for(let i=0;i<6;i++)statuses.push((await worker.fetch(request(i),env)).status);assert.deepEqual(statuses,[200,200,200,200,200,429]);assert.equal(sends,5);
  assert.equal((await worker.fetch(request(10,true,'203.0.113.11'),env)).status,200);assert.equal(sends,6);
  const missingPlatform:number[]=[];for(let i=20;i<26;i++)missingPlatform.push((await worker.fetch(request(i,false,'203.0.113.'+i),env)).status);assert.deepEqual(missingPlatform,[200,200,200,200,200,429]);assert.equal(sends,11);
  await writeFile('server/test-evidence/auth-ip-http.json',JSON.stringify({synthetic:true,trustedAddressRequests:statuses,forwardedHeadersCannotRotate:true,differentTrustedAddressAllowed:true,missingPlatformSharedBucket:missingPlatform,providerCalls:sends},null,2)+'\n');
 }finally{globalThis.fetch=original;await service.stop();}
});

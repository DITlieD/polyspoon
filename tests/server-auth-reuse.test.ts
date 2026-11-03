import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {authentication} from '../server/auth.ts';
import {principal} from '../server/access.ts';
import {localService} from '../server/local-test.ts';
import type {Env} from '../server/types.ts';

test('authentication reuse follows binding and configuration identity while current authority stays fresh',{timeout:120000},async()=>{
 await mkdir('server/.local',{recursive:true});const directory=await mkdtemp(resolve('server/.local/auth-reuse-')),secret=crypto.randomUUID()+crypto.randomUUID(),service=await localService(directory,secret,true,{port:8798});
 const env={...service.env,AUTH_SECRET:secret,APP_ORIGIN:service.origin,LOCAL_MAIL_SINK:'1'};
 const originalFetch=globalThis.fetch;let providerCalls=0;
 globalThis.fetch=async(input,init)=>{if(String(input)==='https://api.resend.com/emails'){providerCalls++;return Response.json({id:'synthetic-unexpected-provider'});}return originalFetch(input,init);};
 try{
  const first=authentication(env),same=authentication({...env});await Promise.all([first.$context,same.$context]);assert.ok(same===first,'same binding and configuration must reuse one auth instance');assert.equal(first.options.session?.cookieCache?.enabled,false);assert.equal(first.options.session?.expiresIn,30*86400);assert.equal(first.options.session?.updateAge,86400);assert.notEqual(first.options.session?.disableSessionRefresh,true);assert.equal(first.options.advanced?.useSecureCookies,false);
  const httpsAuth=authentication({...env,APP_ORIGIN:'https://preflight.polyspoon.com',AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID()});assert.equal(httpsAuth.options.advanced?.useSecureCookies,true);assert.equal(httpsAuth.options.session?.expiresIn,30*86400);
  const changes={APP_ENV:'production',APP_ORIGIN:'https://other.example.invalid',AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),LOCAL_MAIL_SINK:'0',RESEND_API_KEY:'synthetic-other-mail',MAIL_FROM:'Other <other@example.invalid>',SUPABASE_URL:'https://other.supabase.co',SUPABASE_SERVICE_KEY:'synthetic-other-storage',SUPABASE_PRIVATE_BUCKET:'other-private'} as const;
  for(const [key,value] of Object.entries(changes)){
   const current=authentication(env),changed=authentication({...env,[key]:value});await Promise.all([current.$context,changed.$context]);assert.notEqual(changed,current,key);assert.equal(authentication({...env,[key]:value}),changed,key);
  }
  const otherBinding=new Proxy(env.DB,{get(target,key){const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  const current=authentication(env),other=authentication({...env,DB:otherBinding});await Promise.all([current.$context,other.$context]);assert.notEqual(other,current);assert.equal(authentication(env),current);
  const failedEnv={...env,DB:{} as Env['DB']},failed=authentication(failedEnv);await assert.rejects(failed.$context);const retry=authentication(failedEnv);await assert.rejects(retry.$context);assert.ok(failed!==retry,'failed initialization must not remain cached');
  const snapshotEnv={...env,MAIL_FROM:'Snapshot <snapshot@example.invalid>'},snapshot=authentication(snapshotEnv);snapshotEnv.APP_ENV='production';snapshotEnv.RESEND_API_KEY='synthetic-mutated-key';
  const start=await snapshot.handler(new Request(env.APP_ORIGIN+'/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json','x-polyspoon-client-ip':'127.0.0.1'},body:JSON.stringify({email:'first-reuse@polyspoon.invalid',callbackURL:'/catalog'})}));assert.equal(start.status,200);assert.equal(providerCalls,0);
  const login=async(email:string,send=true)=>{
   const auth=authentication(env);
   if(send){const response=await auth.handler(new Request(env.APP_ORIGIN+'/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json','x-polyspoon-client-ip':'127.0.0.1'},body:JSON.stringify({email,callbackURL:'/catalog'})}));assert.equal(response.status,200);}
   const link=await env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=? ORDER BY created_at DESC').bind(email).first<{url:string}>();assert.ok(link);
   const verified=await auth.handler(new Request(link.url));assert.ok([302,303].includes(verified.status));const setCookie=verified.headers.getSetCookie().join('\n');assert.match(setCookie,/session_token=/);assert.match(setCookie,/Max-Age=2592000/);assert.match(setCookie,/HttpOnly/);assert.doesNotMatch(setCookie,/Secure/);const cookie=verified.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
   const request=()=>new Request(env.APP_ORIGIN+'/api/me',{headers:{cookie}}),actor=await principal(request(),env);return {id:actor.id,request,cookie};
  };
  const one=await login('first-reuse@polyspoon.invalid',false),two=await login('second-reuse@polyspoon.invalid');assert.notEqual(one.id,two.id);
  const stored=await env.DB.prepare('SELECT expiresAt FROM session WHERE userId=?').bind(one.id).first<{expiresAt:string|number}>();const left=new Date(String(stored?.expiresAt)).getTime()-Date.now();assert.ok(left>29*86400*1000&&left<31*86400*1000,String(left));
  const interleaved=await Promise.all([principal(one.request(),env),principal(two.request(),env),principal(one.request(),env),principal(two.request(),env)]);assert.deepEqual(interleaved.map(x=>x.id),[one.id,two.id,one.id,two.id]);
  await env.DB.prepare("INSERT INTO capability(user_id,name) VALUES(?,'reviewer:visual')").bind(one.id).run();assert.ok((await principal(one.request(),env)).capabilities.includes('reviewer:visual'));assert.deepEqual((await principal(two.request(),env)).capabilities,[]);
  await env.DB.prepare('DELETE FROM capability WHERE user_id=?').bind(one.id).run();assert.deepEqual((await principal(one.request(),env)).capabilities,[]);
  await env.DB.prepare('UPDATE user SET emailVerified=0 WHERE id=?').bind(one.id).run();await assert.rejects(()=>principal(one.request(),env),/active_verified_membership_required/);await env.DB.prepare('UPDATE user SET emailVerified=1 WHERE id=?').bind(one.id).run();
  await env.DB.prepare("UPDATE member SET status='suspended' WHERE user_id=?").bind(one.id).run();await assert.rejects(()=>principal(one.request(),env),/account_restricted/);assert.equal((await principal(one.request(),env,true)).status,'suspended');assert.equal((await principal(two.request(),env)).id,two.id);
  await env.DB.prepare("UPDATE member SET status='active' WHERE user_id=?").bind(one.id).run();await env.DB.prepare('DELETE FROM session WHERE userId=?').bind(one.id).run();await assert.rejects(()=>principal(one.request(),env),/authentication_required/);assert.equal((await principal(two.request(),env)).id,two.id);
  const signedOut=await authentication(env).handler(new Request(env.APP_ORIGIN+'/api/auth/sign-out',{method:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json',cookie:two.cookie},body:'{}'}));assert.equal(signedOut.status,200);await assert.rejects(()=>principal(two.request(),env),/authentication_required/);
  assert.equal(providerCalls,0);assert.throws(()=>authentication({...env,AUTH_SECRET:''}),/authentication_unconfigured/);
 }finally{globalThis.fetch=originalFetch;await service.stop();}
});

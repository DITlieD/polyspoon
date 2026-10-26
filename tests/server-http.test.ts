import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {localService} from '../server/local-test.ts';

process.env.CLOUDFLARE_SEND_METRICS='false';
test('actual local auth persists and gates private catalog with library-backed verified sessions',{timeout:120000},async()=>{
 await mkdir('server/.local',{recursive:true});const directory=await mkdtemp(resolve('server/.local/http-')),secret=crypto.randomUUID()+crypto.randomUUID();let service=await localService(directory,secret);const observations:unknown[]=[];
 const request=async(path:string,options:RequestInit={})=>fetch(service.origin+path,{...options,redirect:'manual',headers:{origin:service.origin,'content-type':'application/json','cf-connecting-ip':'127.0.0.1',...options.headers}});
 try{
  for(const path of ['/api/catalog','/api/catalog/model','/catalog','/app/private.js','/objects/private.glb','/recipe-packages/index.json']){for(const method of ['GET','HEAD']){const response=await request(path,{method});assert.equal(response.status,401,path+' '+method);assert.equal(response.headers.get('cache-control'),'private, no-store');}}
  const signup=await request('/api/auth/sign-in/magic-link',{method:'POST',body:JSON.stringify({email:'member@polyspoon.invalid',name:'Local fixture member',callbackURL:'/catalog',metadata:{role:'admin'}})});assert.equal(signup.status,200,await signup.text());
  assert.equal((await request('/api/catalog')).status,401);
  const link=await service.env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=? ORDER BY created_at DESC').bind('member@polyspoon.invalid').first<{url:string}>();assert.ok(link);
  const verify=await fetch(link.url,{redirect:'manual'});assert.ok([302,303].includes(verify.status),await verify.text());const cookies=verify.headers.getSetCookie().map(cookie=>cookie.split(';')[0]).join('; ');assert.ok(cookies.includes('session_token'));
  const me=await request('/api/me',{headers:{cookie:cookies}});assert.equal(me.status,200,await me.clone().text());const member=await me.json() as {id:string;capabilities:string[]};assert.deepEqual(member.capabilities,[]);
  assert.equal((await request('/api/catalog',{headers:{cookie:cookies}})).status,200);
  const replay=await fetch(link.url,{redirect:'manual'});assert.equal(replay.headers.getSetCookie().some(cookie=>cookie.includes('session_token=')&&!cookie.includes('Max-Age=0')),false);
  const badCallback=await request('/api/auth/sign-in/magic-link',{method:'POST',body:JSON.stringify({email:'other@polyspoon.invalid',callbackURL:'https://attacker.invalid/steal'})});assert.ok(badCallback.status>=400);
  const expiredStart=await request('/api/auth/sign-in/magic-link',{method:'POST',body:JSON.stringify({email:'expired@polyspoon.invalid',callbackURL:'/catalog'})});assert.equal(expiredStart.status,200);const expired=await service.env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=?').bind('expired@polyspoon.invalid').first<{url:string}>();assert.ok(expired);await service.env.DB.prepare('UPDATE verification SET expiresAt=0').run();const expiry=await fetch(expired.url,{redirect:'manual'});assert.equal(expiry.headers.getSetCookie().some(cookie=>cookie.includes('session_token=')&&!cookie.includes('Max-Age=0')),false);
  await service.stop();service=await localService(directory,secret,false);assert.equal((await request('/api/me',{headers:{cookie:cookies}})).status,200);
  await service.env.DB.prepare('UPDATE user SET emailVerified=0 WHERE id=?').bind(member.id).run();assert.equal((await request('/api/catalog',{headers:{cookie:cookies}})).status,403);await service.env.DB.prepare('UPDATE user SET emailVerified=1 WHERE id=?').bind(member.id).run();
  await service.env.DB.prepare("UPDATE member SET status='suspended' WHERE user_id=?").bind(member.id).run();assert.equal((await request('/api/catalog',{headers:{cookie:cookies}})).status,403);
  const restrictedStart=await request('/api/auth/sign-in/magic-link',{method:'POST',body:JSON.stringify({email:'member@polyspoon.invalid',callbackURL:'/catalog'})});assert.equal(restrictedStart.status,200);const restricted=await service.env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=? ORDER BY created_at DESC').bind('member@polyspoon.invalid').first<{url:string}>();assert.ok(restricted);const restrictedVerify=await fetch(restricted.url,{redirect:'manual'});assert.equal(restrictedVerify.headers.getSetCookie().some(cookie=>cookie.includes('session_token=')&&!cookie.includes('Max-Age=0')),false);
  await service.env.DB.prepare("UPDATE member SET status='active' WHERE user_id=?").bind(member.id).run();const logout=await request('/api/auth/sign-out',{method:'POST',headers:{cookie:cookies},body:'{}'});assert.equal(logout.status,200);assert.equal((await request('/api/catalog',{headers:{cookie:cookies}})).status,401);
  observations.push({anonymousProtectedMethods:true,librarySignupVerified:true,unverifiedDenied:true,registrationMemberOnly:true,singleUseLink:true,expiredLinkDenied:true,maliciousCallbackDenied:true,restartSessionPersistence:true,suspensionImmediate:true,suspendedReloginDenied:true,logoutRevokes:true});
  await writeFile(join(directory,'sanitized-receipt.json'),JSON.stringify({status:'passed',observations,limits:['Local mailbox sink only; no production email/provider/deployment claim.']},null,2)+'\n');
 }finally{await service.stop();}
});

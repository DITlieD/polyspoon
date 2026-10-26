import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {localService} from '../server/local-test.ts';
import {digest} from '../server/domain.ts';

process.env.CLOUDFLARE_SEND_METRICS='false';
test('actual local public allowlist and private app manifest have separate delivery paths',{timeout:120000},async()=>{
 await mkdir('server/.local',{recursive:true});const directory=await mkdtemp(resolve('server/.local/delivery-')),publicDirectory=join(directory,'public');await mkdir(join(publicDirectory,'public-assets'),{recursive:true});await mkdir(join(publicDirectory,'brand'),{recursive:true});
 await writeFile(join(publicDirectory,'index.html'),'public shell fixture');await writeFile(join(publicDirectory,'public-assets','main.js'),'public script fixture');await writeFile(join(publicDirectory,'brand','unlisted.png'),'unlisted bytes');await writeFile(join(publicDirectory,'private-release.json'),'private manifest must stay hidden');
 const release='1'.repeat(64),service=await localService(directory,crypto.randomUUID()+crypto.randomUUID(),true,{port:8795,publicDirectory,publicFiles:['/index.html','/public-assets/main.js'],privateRelease:release});
 const call=(path:string,options:RequestInit={})=>fetch(service.origin+path,{...options,redirect:'manual',headers:{origin:service.origin,'content-type':'application/json',...options.headers}});
 try{
  assert.equal(service.origin,'http://127.0.0.1:8795');for(const path of ['/','/docs','/sign-in','/help','/legal'])assert.equal(await (await call(path)).text(),'public shell fixture');
  assert.equal(await (await call('/public-assets/main.js')).text(),'public script fixture');const publicHead=await call('/public-assets/main.js',{method:'HEAD'});assert.equal(publicHead.status,200);assert.equal(await publicHead.text(),'');
  for(const path of ['/brand/unlisted.png','/private-release.json','/app/index.html','/app/assets/private.js','/editor','/catalog','/api/catalog','/random-page'])assert.equal((await call(path)).status,401,path);
  for(const path of ['/catalog','/asset/'+ 'a'.repeat(64),'/contribute','/editor']){const navigation=await call(path,{headers:{accept:'text/html'}});assert.equal(navigation.status,302);assert.equal(navigation.headers.get('location'),'/sign-in');assert.equal(navigation.headers.get('cache-control'),'private, no-store');assert.equal((await call(path,{headers:{accept:'text/html'},method:'HEAD'})).status,401);assert.equal((await call(path,{headers:{accept:'text/html',range:'bytes=0-3'}})).status,401);}for(const path of ['/api/catalog','/app/assets/private.js'])assert.equal((await call(path,{headers:{accept:'text/html'}})).status,401);
  assert.equal((await call('/api/auth/sign-in/magic-link',{method:'POST',body:JSON.stringify({email:'delivery@polyspoon.invalid',callbackURL:'/editor'})})).status,200);const link=await service.env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=?').bind('delivery@polyspoon.invalid').first<{url:string}>();assert.ok(link);const login=await fetch(link.url,{redirect:'manual'}),cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');const me=await (await call('/api/me',{headers:{cookie}})).json() as {id:string};
  for(const [path,value,type] of [['index.html','private app fixture','text/html'],['assets/private.js','private script fixture','application/javascript']]){
   const data=new TextEncoder().encode(value);await service.env.LOCAL_OBJECTS!.put('applications/'+release+'/'+path,data);await service.env.DB.prepare('INSERT INTO app_asset(release_hash,path,sha256,bytes,media_type) VALUES(?,?,?,?,?)').bind(release,path,await digest(data),data.length,type).run();
  }
  for(const path of ['/editor','/catalog','/app'])assert.equal(await (await call(path,{headers:{cookie}})).text(),'private app fixture');assert.equal(await (await call('/app/assets/private.js',{headers:{cookie}})).text(),'private script fixture');assert.equal((await call('/app/missing.js',{headers:{cookie}})).status,404);
  assert.equal((await call('/api/account/tokens',{method:'POST',headers:{cookie,origin:'https://attacker.invalid'},body:JSON.stringify({label:'bad origin',scopes:['catalog:read']})})).status,403);
  await service.env.DB.prepare("UPDATE member SET status='suspended' WHERE user_id=?").bind(me.id).run();assert.equal((await call('/app/assets/private.js',{headers:{cookie}})).status,403);assert.equal((await call('/editor',{headers:{cookie},method:'HEAD'})).status,403);const restricted=await call('/editor',{headers:{cookie,accept:'text/html'}});assert.equal(restricted.status,403);assert.match(await restricted.text(),/restricted/i);assert.equal((await call('/public-assets/main.js',{headers:{cookie}})).status,200);
 }finally{await service.stop();}
});

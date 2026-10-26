import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {communityRoutes} from '../server/community.ts';
import {collectionRoutes} from '../server/collections.ts';
import {ACCENTS,FLAIRS,checkCosmetic,effective} from '../server/cosmetics.ts';
import type {Principal} from '../server/domain.ts';

const DAY=86400000;
class Stmt{constructor(readonly db:DatabaseSync,readonly sql:string,readonly args:unknown[]=[]){}
 bind(...args:unknown[]){return new Stmt(this.db,this.sql,args);}
 private exec(){return this.db.prepare(this.sql).all(...(this.args as never[])) as Record<string,unknown>[];}
 async first<T>(){return (this.exec()[0]??null) as T|null;}
 async all<T>(){return {results:this.exec() as T[]};}
 async run(){this.exec();return {success:true};}
 _rows(){return this.exec();}}
function database(){
 const db=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const D1={prepare:(sql:string)=>new Stmt(db,sql),batch:async(list:Stmt[])=>{db.exec('BEGIN');try{const out=list.map(s=>({results:s._rows()}));db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
 return {db,env:{DB:D1} as never};
}
function member(db:DatabaseSync,id:string,ageDays=60,caps:string[]=[]){
 const at=Date.now()-ageDays*DAY;db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)').run(id,'Maker '+id,id+'@x.invalid',at,at);db.prepare('INSERT INTO member(user_id,status,created_at) VALUES(?,?,?)').run(id,'active',at);
 for(const c of caps)db.prepare('INSERT INTO capability VALUES(?,?)').run(id,c);
 return {id,status:'active',verified:true,capabilities:caps} as Principal;
}
function model(db:DatabaseSync,creator:string,asset:string,state='published'){
 const id=(asset+'0'.repeat(64)).replace(/[^a-f0-9]/g,'a').slice(0,64);
 db.prepare("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,?,?,?,'preset','{}',0)").run(id,asset,creator,'Model '+asset);
 if(state==='published')for(const s of ['submitted','processing','awaiting_review','approved','published'])db.prepare('UPDATE asset_version SET state=?,published_at=? WHERE id=?').run(s,Date.now()-DAY,id);
 return id;
}
const req=(method:string,path:string,body?:unknown)=>new Request('https://x.invalid'+path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
async function call(env:never,actor:Principal,method:string,path:string,body?:unknown,routes:typeof communityRoutes=communityRoutes){try{const r=(await routes(req(method,path,body),env,actor,path.split('?')[0]!))!;return {status:r.status,body:await r.json() as any};}catch(e:any){if(e.status===undefined)throw e;return {status:e.status,body:{error:e.code}};}}


const col=(env:never,a:Principal,m:string,p:string,b?:unknown)=>call(env,a,m,p,b,collectionRoutes);

test('cosmetics: unlock table and gating helpers',()=>{
 assert.equal(checkCosmetic(ACCENTS,'slate',1,'accent'),'');assert.equal(checkCosmetic(ACCENTS,'prism',5,'accent'),'accent_locked');assert.equal(checkCosmetic(ACCENTS,'prism',6,'accent'),'');
 assert.equal(checkCosmetic(FLAIRS,'bogus',6,'flair'),'invalid_flair');assert.equal(effective(FLAIRS,'crown',3,'none'),'none');
 for(const list of [ACCENTS,FLAIRS])for(let i=1;i<list.length;i++)assert.ok(list[i]!.minLevel>=list[i-1]!.minLevel);
});

test('cosmetics: server rejects locked choices, accepts unlocked ones, and changes nothing else',async()=>{
 const {db,env}=database(),alice=member(db,'alice');
 await call(env,alice,'GET','/api/community/me');
 const locked=await call(env,alice,'PUT','/api/community/me',{accent:'prism'});assert.equal(locked.status,403);assert.equal(locked.body.error,'accent_locked');
 assert.equal((await call(env,alice,'PUT','/api/community/me',{flair:'crown'})).body.error,'flair_locked');
 assert.equal((await call(env,alice,'PUT','/api/community/me',{accent:'nope'})).body.error,'invalid_accent');
 const ok=await call(env,alice,'PUT','/api/community/me',{accent:'slate'});assert.equal(ok.status,200);assert.equal(ok.body.profile.accent,'slate');
 for(let i=0;i<5;i++)model(db,'alice','m'+i);
 assert.equal((await call(env,alice,'PUT','/api/community/me',{accent:'plum',flair:'double'})).status,200);
 const view=await call(env,alice,'GET','/api/community/profiles/'+ok.body.profile.handle);assert.equal(view.body.profile.flair,'double');assert.ok(view.body.cosmetics.accents.some((a:any)=>a.id==='plum'&&a.unlocked));
 const bob=member(db,'bob');assert.equal('cosmetics' in (await call(env,bob,'GET','/api/community/profiles/'+ok.body.profile.handle)).body,false);
 assert.equal((db.prepare('SELECT count(*) AS n FROM capability').get() as {n:number}).n,0);
});

test('collections: login-gated reads, curator-only writes, published models only',async()=>{
 const {db,env}=database(),admin=member(db,'admin',400,['admin']),mod=member(db,'mod',400,['moderator']),alice=member(db,'alice');model(db,'alice','fox');model(db,'alice','draft-thing','draft');
 assert.equal((await col(env,alice,'POST','/api/collections',{slug:'best-foxes',title:'Best foxes'})).body.error,'curator_required');
 assert.equal((await col(env,{...admin,scopes:['catalog:read']},'POST','/api/collections',{slug:'best-foxes',title:'Best foxes'})).body.error,'curator_required');
 assert.equal((await col(env,admin,'POST','/api/collections',{slug:'Bad Slug',title:'x'})).body.error,'invalid_slug');
 assert.equal((await col(env,admin,'POST','/api/collections',{slug:'best-foxes',title:'Best foxes',description:'Foxes'})).status,201);
 assert.equal((await col(env,admin,'POST','/api/collections',{slug:'best-foxes',title:'Again'})).body.error,'slug_taken');
 assert.equal((await col(env,mod,'PUT','/api/collections/best-foxes/items/fox')).status,200);
 assert.equal((await col(env,mod,'PUT','/api/collections/best-foxes/items/draft-thing')).body.error,'model_not_found');
 assert.equal((await col(env,alice,'PUT','/api/collections/best-foxes/items/fox')).body.error,'curator_required');
 const list=await col(env,alice,'GET','/api/collections');assert.equal(list.body.collections[0].models,1);assert.equal(list.body.canCurate,false);
 const one=await col(env,alice,'GET','/api/collections/best-foxes');assert.deepEqual(one.body.models.map((m:any)=>m.asset_id),['fox']);
 assert.equal((await col(env,{...alice,scopes:['assets:read']},'GET','/api/collections')).body.error,'token_scope_required');
 db.prepare("UPDATE asset_version SET state='withdrawn' WHERE asset_id='fox'").run();
 assert.equal((await col(env,alice,'GET','/api/collections/best-foxes')).body.models.length,0);
 assert.equal((await col(env,mod,'DELETE','/api/collections/best-foxes/items/fox')).status,200);
 assert.equal((await col(env,admin,'PUT','/api/collections/best-foxes',{title:'Top foxes'})).body.collection.title,'Top foxes');
});

test('no review bypass: cosmetics and collections never write capability, review or version state',()=>{
 for(const file of ['server/cosmetics.ts','server/collections.ts','server/community.ts','server/reputation.ts']){const src=readFileSync(file,'utf8');assert.doesNotMatch(src,/(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(capability|asset_version|review_record|technical_attestation)\b/i,file);if(!file.includes('community'))assert.doesNotMatch(src,/(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(vote|creator_follow|download_credit)\b/i,file);}
 for(const file of ['server/reputation.ts','server/versions.ts','server/moderation.ts','server/access.ts','server/catalog-queries.ts'])assert.doesNotMatch(readFileSync(file,'utf8'),/cosmetics|collection/,file);
});

test('add to collection: picker only for curators, API refuses members and agent tokens, no review side effects',async()=>{
 const {collectionItemPath,showCollectionPicker}=await import('../hosted/app/collection-picker.ts');
 assert.equal(collectionItemPath('best-foxes','fox/../x'),'/api/collections/best-foxes/items/fox%2F..%2Fx');
 assert.equal(showCollectionPicker({canCurate:true,collections:[{}]}),true);
 for(const d of [{canCurate:false,collections:[{}]},{canCurate:true,collections:[]},{canCurate:'true',collections:[{}]},null])assert.equal(showCollectionPicker(d as never),false);
 const {db,env}=database(),admin=member(db,'admin',400,['admin']),alice=member(db,'alice');model(db,'alice','fox');
 await col(env,admin,'POST','/api/collections',{slug:'best-foxes',title:'Best foxes'});
 assert.equal((await col(env,alice,'GET','/api/collections')).body.canCurate,false);
 assert.equal((await col(env,{...admin,scopes:['catalog:read']},'GET','/api/collections')).body.canCurate,false);
 assert.equal((await col(env,{...admin,scopes:['catalog:read','votes:write']},'PUT',collectionItemPath('best-foxes','fox'))).body.error,'curator_required');
 assert.equal((await col(env,alice,'PUT',collectionItemPath('best-foxes','fox'))).body.error,'curator_required');
 assert.equal((await col(env,{...admin,verified:false},'PUT',collectionItemPath('best-foxes','fox'))).body.error,'curator_required');
 const before=db.prepare('SELECT state,published_at FROM asset_version').all();
 assert.equal((await col(env,admin,'PUT',collectionItemPath('best-foxes','fox'))).status,200);
 assert.equal((await col(env,admin,'GET','/api/collections')).body.collections[0].models,1);
 assert.deepEqual(db.prepare('SELECT state,published_at FROM asset_version').all(),before);
 assert.equal((db.prepare("SELECT count(*) AS n FROM capability WHERE user_id='alice'").get() as {n:number}).n,0);
});

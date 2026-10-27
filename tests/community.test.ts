import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {communityRoutes,castVote} from '../server/community.ts';
import {scoreEvents,summarize,voteWeight,levelFor,moderatorEligible,POINTS,type CommunityFacts} from '../server/reputation.ts';
import {unknownPage} from '../server/worker.ts';
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
async function call(env:never,actor:Principal,method:string,path:string,body?:unknown){try{const r=(await communityRoutes(req(method,path,body),env,actor,path.split('?')[0]!))!;return {status:r.status,body:await r.json() as any};}catch(e:any){if(e.status===undefined)throw e;return {status:e.status,body:{error:e.code}};}}

test('scoring: reviewed publication, weighted votes and capped downloads; penalties outweigh spam',()=>{
 const now=Date.now(),facts:CommunityFacts={publications:[{creator:'a',versionId:'v',assetId:'x',at:now,category:'Props',firstOfAsset:true}],votes:[{voter:'b',creator:'a',versionId:'v',at:now,category:'Props',voterAgeDays:60},{voter:'new',creator:'a',versionId:'v',at:now,category:'Props',voterAgeDays:1},{voter:'a',creator:'a',versionId:'v',at:now,category:'Props',voterAgeDays:60}],remixes:[],downloads:Array.from({length:150},(_,i)=>({creator:'a',assetId:'x',at:now+i,category:'Props'})),penalties:[]};
 const a=summarize(scoreEvents(facts,now),now).get('a')!;
 assert.equal(a.allTime,POINTS.firstPublish+POINTS.voteBase*0.5+100);// self vote + fresh account ignored, downloads capped at 100
 assert.equal(voteWeight(0,1),0);assert.equal(voteWeight(0,10),0.25);assert.equal(voteWeight(10000,365),2);
 const spam=summarize(scoreEvents({publications:[{creator:'s',versionId:'1',assetId:'1',at:now,category:null,firstOfAsset:true}],votes:[],remixes:[],downloads:[],penalties:Array.from({length:6},(_,i)=>({creator:'s',versionId:String(i),at:now,kind:'rejected' as const,category:null}))},now),now).get('s')!;
 assert.equal(spam.allTime,0);assert.equal(levelFor(600).name,'Artisan');
 assert.equal(moderatorEligible({reputation:5000,published:4,removed:0,rejected:0,accountAgeDays:400}),false);
 assert.equal(moderatorEligible({reputation:700,published:6,removed:0,rejected:0,accountAgeDays:120}),true);
});

test('anti-gaming: one vote per member per model, no self votes (API and database), fresh accounts and rate limits',async()=>{
 const {db,env}=database(),author=member(db,'author'),voter=member(db,'voter'),fresh=member(db,'fresh',1);model(db,'author','lantern');
 assert.deepEqual(await castVote(env,voter,'lantern',true),{voted:true,votes:1});
 assert.deepEqual(await castVote(env,voter,'lantern',true),{voted:true,votes:1});
 await assert.rejects(castVote(env,author,'lantern',true),/self_vote_forbidden/);
 assert.throws(()=>db.prepare('INSERT INTO vote VALUES(?,?,?)').run('author','lantern',1),/self_vote_forbidden/);
 assert.throws(()=>db.prepare('INSERT INTO creator_follow VALUES(?,?,?)').run('voter','voter',1),/CHECK/);
 await assert.rejects(castVote(env,fresh,'lantern',true),/account_too_new_to_vote/);
 await assert.rejects(castVote(env,{...voter,scopes:['catalog:read']},'lantern',true),/token_scope_required/);
 for(let i=0;i<60;i++)db.prepare("INSERT INTO audit_event VALUES(?,?,'vote_set','x','{}',?)").run('r'+i,'voter',Date.now());
 await assert.rejects(castVote(env,voter,'lantern',false),/vote_rate_limited/);
});

test('authz: profiles need a member, agent tokens cannot edit or follow, admin-only moderator hint',async()=>{
 const {db,env}=database(),admin=member(db,'admin',400,['admin']),alice=member(db,'alice'),bob=member(db,'bob');model(db,'alice','fox');
 const me=await call(env,alice,'GET','/api/community/me');assert.equal(me.status,200);const handle=me.body.profile.handle;
 assert.equal((await call(env,{...alice,scopes:['catalog:read']},'PUT','/api/community/me',{bio:'x'})).body.error,'interactive_session_required');
 assert.equal((await call(env,alice,'PUT','/api/community/me',{handle:'admin'})).body.error,'invalid_handle');
 assert.equal((await call(env,alice,'PUT','/api/community/me',{handle:'alice-makes',bio:'Low poly props'})).status,200);
 assert.equal((await call(env,alice,'PUT','/api/community/profiles/alice-makes/follow')).body.error,'self_follow_forbidden');
 assert.equal((await call(env,bob,'PUT','/api/community/profiles/alice-makes/follow')).body.followers,1);
 const asBob=await call(env,bob,'GET','/api/community/profiles/alice-makes');assert.equal(asBob.body.following,true);assert.equal('moderatorEligible' in asBob.body,false);assert.equal(JSON.stringify(asBob.body).includes('@x.invalid'),false);
 const asAdmin=await call(env,admin,'GET','/api/community/profiles/alice-makes');assert.equal(asAdmin.body.moderatorEligible,false);
 const feed=await call(env,bob,'GET','/api/community/feed');assert.equal(feed.body.models.length,1);
 const board=await call(env,bob,'GET','/api/community/leaderboard?period=all');assert.equal(board.status,200);assert.equal(board.body.entries[0].creator.handle,'alice-makes');
 assert.ok(handle);
});

test('no review bypass: votes and points never touch capabilities or version state, unpublished models cannot be voted',async()=>{
 const {db,env}=database(),voter=member(db,'voter');member(db,'author');const pending=model(db,'author','pending','draft');
 await assert.rejects(castVote(env,voter,'pending',true),/model_not_found/);
 for(const file of ['server/community.ts','server/reputation.ts']){const src=readFileSync(file,'utf8');assert.doesNotMatch(src,/(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(capability|asset_version|review_record|technical_attestation)\b/i,file);}
 const caps=db.prepare('SELECT count(*) AS n FROM capability').get() as {n:number};assert.equal(caps.n,0);
 assert.equal((db.prepare('SELECT state FROM asset_version WHERE id=?').get(pending) as {state:string}).state,'draft');
});

test('unknown public paths get a 404 page, app and API paths do not',()=>{
 const get=(p:string)=>unknownPage(new Request('https://x.invalid'+p),p);
 assert.equal(get('/nope-404'),true);assert.equal(get('/catalog'),false);assert.equal(get('/api/me'),false);assert.equal(get('/app/main.js'),false);assert.equal(get('/asset/'+'a'.repeat(64)),false);
});

test('suspended members leave no trace: profile downloads and notifications count only active verified members',async()=>{
 const {db,env}=database(),alice=member(db,'alice'),bob=member(db,'bob'),mallory=member(db,'mallory');const version=model(db,'alice','well');
 for(const who of ['bob','mallory'])db.prepare('INSERT INTO download_credit(user_id,asset_id,created_at) VALUES(?,?,?)').run(who,'well',Date.now());
 await castVote(env,bob,'well',true);await castVote(env,mallory,'well',true);
 db.prepare("UPDATE member SET status='suspended' WHERE user_id='mallory'").run();
 const handle=(await call(env,alice,'GET','/api/community/me')).body.profile.handle;
 const profile=await call(env,bob,'GET','/api/community/profiles/'+handle);
 assert.equal(profile.body.stats.downloads,1);assert.equal(profile.body.stats.votesReceived,1);
 const votes=(await call(env,alice,'GET','/api/community/notifications')).body.notifications.filter((n:{kind:string})=>n.kind==='vote');
 assert.equal(votes.length,1);assert.equal(votes[0].actor.id,'bob');assert.ok(version);
});

test('follow reports the stored state, and moderators cannot moderate their own comments',async()=>{
 const {db,env}=database(),mod=member(db,'mod',60,['moderator']),alice=member(db,'alice');const version=model(db,'alice','fox');
 const handle=(await call(env,alice,'GET','/api/community/me')).body.profile.handle;
 assert.deepEqual((await call(env,mod,'PUT','/api/community/profiles/'+handle+'/follow')).body,{following:true,followers:1});
 assert.deepEqual((await call(env,mod,'DELETE','/api/community/profiles/'+handle+'/follow')).body,{following:false,followers:0});
 const posted=await call(env,mod,'POST','/api/community/versions/'+version+'/comments',{body:'Nice silhouette'});assert.equal(posted.status,201);
 const self=await call(env,mod,'PUT','/api/community/comments/'+posted.body.id+'/moderation',{status:'hidden',reason:'test'});
 assert.deepEqual(self,{status:403,body:{error:'self_moderation_forbidden'}});
 assert.equal((await call(env,{...alice,status:'suspended'},'POST','/api/community/versions/'+version+'/comments',{body:'x'})).status,403);
});

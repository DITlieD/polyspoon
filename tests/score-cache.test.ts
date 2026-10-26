import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {communityFacts,castVote,creditDownload} from '../server/community.ts';
import {cachedLeaderboard,cachedScores,refreshScores} from '../server/score-cache.ts';
import {scoreEvents,summarize,leaderboard} from '../server/reputation.ts';
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

async function compare(db:DatabaseSync,env:never){
 const now=Date.now(),events=scoreEvents(await communityFacts(env),now),truth=summarize(events,now),ids=[...truth.keys()];
 const cached=await cachedScores(env,ids);assert.equal(cached.size,truth.size);
 for(const id of ids){const a=truth.get(id)!,b=cached.get(id)!;assert.deepEqual({allTime:b.allTime,reputation:b.reputation,week:b.week,month:b.month,level:b.level,byCategory:b.byCategory},{allTime:a.allTime,reputation:a.reputation,week:a.week,month:a.month,level:a.level,byCategory:a.byCategory},id);}
 for(const period of ['week','month','all'] as const)for(const category of [null,'Unclassified']){assert.deepEqual(await cachedLeaderboard(env,period,category),leaderboard(events,truth,now,period,category),period+String(category));}
 return truth;
}
test('score cache equals a from-scratch recompute and refreshes when inputs change',async()=>{
 const {db,env}=database();
 for(const id of ['a','b','c'])member(db,id);for(const id of ['v1','v2','v3'])member(db,id,id==='v3'?10:400);member(db,'fresh',1);
 const a1=model(db,'a','a1'),b1=model(db,'b','c3');model(db,'a','b2');model(db,'c','d4');model(db,'c','e5','draft');
 db.prepare("UPDATE asset_version SET state='submitted' WHERE asset_id='e5'").run();for(const s of ['processing','awaiting_review','rejected'])db.prepare("UPDATE asset_version SET state=? WHERE asset_id='e5'").run(s);
 for(const v of ['v1','v2','v3'])await castVote(env,{id:v,status:'active',verified:true,capabilities:[]} as never,'a1',true);
 await castVote(env,{id:'v1',status:'active',verified:true,capabilities:[]} as never,'d4',true);
 db.prepare('INSERT INTO vote VALUES(?,?,?)').run('fresh','c3',Date.now());
 await creditDownload(env,{id:'v2',status:'active',verified:true,capabilities:[]} as never,a1,'model.glb');await creditDownload(env,{id:'v1',status:'active',verified:true,capabilities:[]} as never,b1,'model.glb');
 db.prepare('INSERT INTO version_lineage VALUES(?,?,?)').run(b1,'a1',Date.now());
 const first=await compare(db,env);assert.ok(first.get('a')!.allTime>first.get('b')!.allTime);
 const before=(db.prepare('SELECT computed_generation AS g FROM score_state').get() as {g:number}).g;
 await castVote(env,{id:'v2',status:'active',verified:true,capabilities:[]} as never,'c3',true);
 const state=db.prepare('SELECT generation,computed_generation FROM score_state').get() as {generation:number;computed_generation:number};assert.ok(state.generation>state.computed_generation,'vote marks cache stale');
 const second=await compare(db,env);assert.ok(second.get('b')!.allTime>first.get('b')!.allTime);
 assert.ok((db.prepare('SELECT computed_generation AS g FROM score_state').get() as {g:number}).g>before);
 db.prepare("UPDATE member SET status='suspended' WHERE user_id='v1'").run();await compare(db,env);
 await refreshScores(env);const rows=(db.prepare('SELECT count(*) AS n FROM creator_score').get() as {n:number}).n;assert.equal(rows,second.size);
});
test('score cache code never writes permissions, review or version state',()=>{
 assert.doesNotMatch(readFileSync('server/score-cache.ts','utf8'),/(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(capability|asset_version|review_record|technical_attestation|vote|member)\b/i);
 assert.doesNotMatch(readFileSync('migrations/0013_creator_score.sql','utf8'),/UPDATE\s+(capability|asset_version|member|vote|user)\b/i);
});

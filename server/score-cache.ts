// Materialised community scores. Same formula as reputation.ts; this only avoids recomputing on every read.
// Database triggers bump score_state.generation whenever a scoring input changes; reads rebuild the cache
// when it is stale (input changed) or older than SCORE_TTL_MS (time windows and decay move on their own).
import type {Env} from './types.ts';
import {levelFor,scoreEvents,summarize,type CreatorScore,type Period,type ScoreEvent} from './reputation.ts';
import {communityFacts} from './community.ts';

export const SCORE_TTL_MS=5*60*1000;
const DAY=86400000;
type Bucket={all:number;week:number;month:number};
type Row={creator_id:string;all_time:number;reputation:number;week:number;month:number;raw_all:number;raw_week:number;raw_month:number;level:number;buckets:string;computed_at:number};
const round=(value:number)=>Math.round(value*100)/100;

/** Pure: the rows the cache stores for a set of events. Raw sums keep event order so leaderboards match exactly. */
export function materialise(events:ScoreEvent[],now:number){
 const scores=summarize(events,now),raw=new Map<string,{all:number;week:number;month:number;buckets:Record<string,Bucket>}>();
 for(const e of events){
  let r=raw.get(e.creator);if(!r){r={all:0,week:0,month:0,buckets:{}};raw.set(e.creator,r);}
  const c=e.category??'Unclassified',b=r.buckets[c]??(r.buckets[c]={all:0,week:0,month:0}),age=now-e.at;
  r.all+=e.points;b.all+=e.points;if(age<=7*DAY){r.week+=e.points;b.week+=e.points;}if(age<=30*DAY){r.month+=e.points;b.month+=e.points;}
 }
 return [...scores.values()].map(s=>{const r=raw.get(s.creator)!;return {creator_id:s.creator,all_time:s.allTime,reputation:s.reputation,week:s.week,month:s.month,raw_all:r.all,raw_week:r.week,raw_month:r.month,level:s.level.level,buckets:JSON.stringify(r.buckets),computed_at:now} satisfies Row;});
}
export async function refreshScores(env:Env,now=Date.now()){
 const state=await env.DB.prepare('SELECT generation FROM score_state WHERE id=1').first<{generation:number}>(),generation=state?.generation??0;
 const rows=materialise(scoreEvents(await communityFacts(env),now),now);
 const insert='INSERT INTO creator_score(creator_id,all_time,reputation,week,month,raw_all,raw_week,raw_month,level,buckets,computed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)';
 await env.DB.batch([env.DB.prepare('DELETE FROM creator_score'),...rows.map(r=>env.DB.prepare(insert).bind(r.creator_id,r.all_time,r.reputation,r.week,r.month,r.raw_all,r.raw_week,r.raw_month,r.level,r.buckets,r.computed_at)),env.DB.prepare('UPDATE score_state SET computed_generation=?,computed_at=? WHERE id=1').bind(generation,now)]);
}
async function fresh(env:Env){
 const state=await env.DB.prepare('SELECT generation,computed_generation,computed_at FROM score_state WHERE id=1').first<{generation:number;computed_generation:number;computed_at:number}>();
 if(!state||state.computed_generation<state.generation||Date.now()-state.computed_at>SCORE_TTL_MS)await refreshScores(env);
}
function toScore(r:Row):CreatorScore{const buckets=JSON.parse(r.buckets) as Record<string,Bucket>;return {creator:r.creator_id,allTime:r.all_time,reputation:r.reputation,week:r.week,month:r.month,level:levelFor(r.all_time),byCategory:Object.fromEntries(Object.entries(buckets).map(([k,b])=>[k,round(b.all)]))};}
export async function cachedScore(env:Env,creator:string):Promise<CreatorScore|undefined>{
 await fresh(env);const row=await env.DB.prepare('SELECT * FROM creator_score WHERE creator_id=?').bind(creator).first<Row>();return row?toScore(row):undefined;
}
export async function cachedScores(env:Env,creators:string[]){
 await fresh(env);const out=new Map<string,CreatorScore>();if(!creators.length)return out;
 for(const r of (await env.DB.prepare('SELECT * FROM creator_score WHERE creator_id IN ('+creators.map(()=>'?').join(',')+')').bind(...creators).all<Row>()).results)out.set(r.creator_id,toScore(r));return out;
}
/** Same ordering, filtering and rounding as reputation.leaderboard(). */
export async function cachedLeaderboard(env:Env,period:Period,category:string|null,limit=50){
 await fresh(env);const rows=(await env.DB.prepare('SELECT * FROM creator_score').all<Row>()).results;
 const key=period==='week'?'week':period==='month'?'month':'all';
 return rows.map(r=>{const bucket=category?(JSON.parse(r.buckets) as Record<string,Bucket>)[category]:undefined;const points=category?(bucket?.[key]??0):key==='week'?r.raw_week:key==='month'?r.raw_month:r.raw_all;return {creator:r.creator_id,points:round(points),level:levelFor(r.all_time),hasEvents:category?!!bucket:true};})
  .filter(row=>row.hasEvents&&row.points>0).sort((a,b)=>b.points-a.points||a.creator.localeCompare(b.creator)).slice(0,limit).map(({hasEvents,...row},index)=>({rank:index+1,...row}));
}

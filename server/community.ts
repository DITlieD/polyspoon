import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError,nonempty,requireScope} from './domain.ts';
import {body,json} from './input.ts';
import {audit} from './repository.ts';
import {selectPublicDelivery} from './public-delivery.ts';
import {badges,leaderboard,levelFor,moderatorEligible,scoreEvents,summarize,type CommunityFacts,type Download,type Penalty,type Period,type Publication,type Remix,type Vote} from './reputation.ts';
import {voteCountSql} from './catalog-queries.ts';
import {cachedLeaderboard,cachedScore} from './score-cache.ts';
import {ACCENTS,FLAIRS,checkCosmetic,effective,unlocked} from './cosmetics.ts';

const HOUR=3600000,DAY=86400000;
export const COMMUNITY_RULES={minVoterAgeMs:3*DAY,votesPerHour:60,minCommenterAgeMs:DAY,commentsPerHour:10,followsPerHour:100,reportsPerDay:20} as const;
const activeVoter="EXISTS(SELECT 1 FROM member am JOIN user au ON au.id=am.user_id WHERE am.user_id=? AND am.status='active' AND au.emailVerified=1)";
const countedMember=(column:string)=>"EXISTS(SELECT 1 FROM member cm JOIN user cu ON cu.id=cm.user_id WHERE cm.user_id="+column+" AND cm.status='active' AND cu.emailVerified=1)";
type ProfileRow={user_id:string;handle:string;display_name:string;bio:string;avatar_hue:number;links:string;created_at:number;accent?:string;flair?:string};
const interactive=(actor:Principal)=>{if(actor.scopes)throw new HttpError(403,'interactive_session_required');};
const isModerator=(actor:Principal)=>!actor.scopes&&actor.status==='active'&&actor.verified&&actor.capabilities.some(cap=>cap==='moderator'||cap==='admin');
function slug(value:string){const base=value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,16);return base.length>=3?base:'maker';}
export function validHandle(value:unknown):value is string{return typeof value==='string'&&/^[a-z0-9_-]{3,24}$/.test(value)&&!['me','admin','polyspoon','moderator','staff','support'].includes(value);}
export function validLinks(value:unknown):string[]{if(!Array.isArray(value)||value.length>3)throw new HttpError(400,'invalid_links');return value.map(item=>{if(typeof item!=='string'||item.length>200)throw new HttpError(400,'invalid_links');let url:URL;try{url=new URL(item);}catch{throw new HttpError(400,'invalid_links');}if(url.protocol!=='https:'||url.username||url.password)throw new HttpError(400,'invalid_links');return url.href;});}
export async function ensureProfile(env:Env,userId:string):Promise<ProfileRow>{
 const existing=await env.DB.prepare('SELECT * FROM creator_profile WHERE user_id=?').bind(userId).first<ProfileRow>();if(existing)return existing;
 const user=await env.DB.prepare('SELECT name FROM user WHERE id=?').bind(userId).first<{name:string}>();const name=(user?.name||'Polyspoon maker').slice(0,60),base=slug(name),now=Date.now();
 for(let attempt=0;attempt<6;attempt++){const handle=attempt===0?base:base+'-'+[...crypto.getRandomValues(new Uint8Array(2))].map(n=>n.toString(16).padStart(2,'0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO creator_profile(user_id,handle,display_name,avatar_hue,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId,handle,name,[...userId].reduce((sum,c)=>sum+c.charCodeAt(0),0)%360,now,now).run();
  const row=await env.DB.prepare('SELECT * FROM creator_profile WHERE user_id=?').bind(userId).first<ProfileRow>();if(row)return row;}
 throw new HttpError(409,'handle_unavailable');
}
function publicProfile(row:ProfileRow){return {id:row.user_id,handle:row.handle,displayName:row.display_name,bio:row.bio,avatarHue:row.avatar_hue,links:JSON.parse(row.links) as string[],joinedAt:row.created_at,accent:row.accent??'default',flair:row.flair??'none'};}
async function profileByHandle(env:Env,handle:string){const row=await env.DB.prepare("SELECT p.* FROM creator_profile p JOIN member m ON m.user_id=p.user_id WHERE p.handle=? AND m.status='active'").bind(handle).first<ProfileRow>();if(!row)throw new HttpError(404,'profile_not_found');return row;}
async function recent(env:Env,sql:string,userId:string,window:number){return Number((await env.DB.prepare(sql).bind(userId,Date.now()-window).first<{n:number}>())?.n??0);}

/** Collect every fact the scoring math needs. Only currently published work, counted voters and resolved removals contribute. */
export async function communityFacts(env:Env):Promise<CommunityFacts>{
 const [pubs,votes,remixes,downloads,rejected,removed]=await env.DB.batch<Record<string,unknown>>([
  env.DB.prepare("SELECT v.contributor_id AS creator,v.id AS versionId,v.asset_id AS assetId,COALESCE(v.published_at,v.created_at) AS at,v.model_type AS category,NOT EXISTS(SELECT 1 FROM asset_version o WHERE o.asset_id=v.asset_id AND o.state='published' AND (COALESCE(o.published_at,0)<COALESCE(v.published_at,0) OR (COALESCE(o.published_at,0)=COALESCE(v.published_at,0) AND o.id<v.id))) AS firstOfAsset FROM catalog_version_metadata v WHERE v.state='published'"),
  env.DB.prepare("SELECT vt.user_id AS voter,d.contributor_id AS creator,d.id AS versionId,vt.created_at AS at,d.model_type AS category,(?-vm.created_at)/86400000.0 AS voterAgeDays FROM vote vt JOIN catalog_discovery d ON d.asset_id=vt.asset_id JOIN member vm ON vm.user_id=vt.user_id JOIN user vu ON vu.id=vt.user_id WHERE vm.status='active' AND vu.emailVerified=1 AND vt.user_id!=d.contributor_id").bind(Date.now()),
  env.DB.prepare("SELECT p.contributor_id AS creator,c.contributor_id AS remixer,c.id AS versionId,COALESCE(c.published_at,c.created_at) AS at,c.model_type AS category FROM version_lineage l JOIN catalog_version_metadata c ON c.id=l.version_id AND c.state='published' JOIN asset_version p ON p.asset_id=l.parent_asset_id AND p.state='published' AND NOT EXISTS(SELECT 1 FROM asset_version q WHERE q.asset_id=p.asset_id AND q.state='published' AND q.id<p.id) WHERE p.contributor_id!=c.contributor_id"),
  env.DB.prepare("SELECT v.contributor_id AS creator,d.asset_id AS assetId,d.created_at AS at,v.model_type AS category FROM download_credit d JOIN catalog_discovery v ON v.asset_id=d.asset_id WHERE d.user_id!=v.contributor_id AND "+countedMember('d.user_id')),
  env.DB.prepare("SELECT v.contributor_id AS creator,v.id AS versionId,COALESCE((SELECT max(created_at) FROM audit_event a WHERE a.target=v.id AND a.action='transition_attempt' AND json_extract(a.data,'$.to')='rejected'),v.created_at) AS at,v.model_type AS category FROM catalog_version_metadata v WHERE v.state='rejected'"),
  env.DB.prepare("SELECT v.contributor_id AS creator,v.id AS versionId,max(r.created_at) AS at,v.model_type AS category FROM model_report r JOIN catalog_version_metadata v ON v.id=r.version_id WHERE r.status='withdraw' GROUP BY v.id"),
 ]);
 const rowsOf=<T,>(result:{results:Record<string,unknown>[]}|undefined)=>(result?.results??[]) as T[];
 const penalty=(kind:Penalty['kind'])=>(row:Omit<Penalty,'kind'>):Penalty=>({...row,kind});
 return {publications:rowsOf<Omit<Publication,'firstOfAsset'>&{firstOfAsset:number}>(pubs).map(r=>({...r,firstOfAsset:!!r.firstOfAsset})),votes:rowsOf<Vote>(votes),remixes:rowsOf<Remix>(remixes),downloads:rowsOf<Download>(downloads),penalties:[...rowsOf<Omit<Penalty,'kind'>>(rejected).map(penalty('rejected')),...rowsOf<Omit<Penalty,'kind'>>(removed).map(penalty('removed'))]};
}
async function profilesFor(env:Env,ids:string[]){if(!ids.length)return new Map<string,ReturnType<typeof publicProfile>>();const have=new Set((await env.DB.prepare('SELECT user_id FROM creator_profile WHERE user_id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all<{user_id:string}>()).results.map(r=>r.user_id));for(const id of ids)if(!have.has(id))await ensureProfile(env,id);const rows=(await env.DB.prepare('SELECT * FROM creator_profile WHERE user_id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all<ProfileRow>()).results;return new Map(rows.map(row=>[row.user_id,publicProfile(row)]));}
async function modelCards(env:Env,where:string,binds:unknown[],limit:number,offset=0){
 const rows=(await env.DB.prepare("SELECT v.id,v.asset_id,v.title,v.kind,v.published_at,v.contributor_id AS creatorId,v.model_type AS type,v.subject,"+voteCountSql('v.asset_id')+" AS votes FROM catalog_discovery v WHERE "+where+" ORDER BY v.published_at DESC,v.id LIMIT ? OFFSET ?").bind(...binds,limit,offset).all<{id:string;asset_id:string;title:string;kind:string;published_at:number;creatorId:string;type:string|null;subject:string;votes:number}>()).results;
 const files=rows.length?(await env.DB.prepare("SELECT version_id,path,sha256,bytes,media_type FROM version_artifact WHERE uploaded=1 AND version_id IN ("+rows.map(()=>'?').join(',')+") AND (lower(path) LIKE '%.png' OR lower(path) LIKE '%.webp' OR lower(path) LIKE '%.jpg')").bind(...rows.map(r=>r.id)).all<{version_id:string;path:string;sha256:string;bytes:number;media_type:string}>()).results:[];
 return rows.map(({subject,...row})=>{const sel=selectPublicDelivery(JSON.parse(subject),files.filter(f=>f.version_id===row.id)).preview;return {...row,preview:sel?{path:sel.path,sha256:sel.sha256,bytes:sel.bytes,media_type:sel.media_type}:null};});
}
async function stats(env:Env,userId:string){
 const row=await env.DB.prepare("SELECT (SELECT count(*) FROM catalog_discovery WHERE contributor_id=?1) AS published,(SELECT count(*) FROM creator_follow f WHERE f.creator_id=?1 AND "+countedMember('f.follower_id')+") AS followers,(SELECT count(*) FROM creator_follow WHERE follower_id=?1) AS following,(SELECT count(*) FROM vote vt JOIN catalog_discovery d ON d.asset_id=vt.asset_id WHERE d.contributor_id=?1 AND vt.user_id!=?1 AND "+countedMember('vt.user_id')+") AS votesReceived,(SELECT count(*) FROM asset_version WHERE contributor_id=?1 AND state='rejected') AS rejected,(SELECT count(DISTINCT r.version_id) FROM model_report r JOIN asset_version v ON v.id=r.version_id WHERE v.contributor_id=?1 AND r.status='withdraw') AS removed,(SELECT created_at FROM member WHERE user_id=?1) AS memberSince,(SELECT count(*) FROM download_credit d WHERE d.asset_id IN (SELECT asset_id FROM catalog_discovery WHERE contributor_id=?1) AND d.user_id!=?1 AND "+countedMember('d.user_id')+") AS downloads,(SELECT count(*) FROM version_lineage l JOIN asset_version c ON c.id=l.version_id AND c.state='published' WHERE c.contributor_id!=?1 AND l.parent_asset_id IN (SELECT asset_id FROM asset_version WHERE contributor_id=?1 AND state='published')) AS remixedBy,(SELECT count(*) FROM version_lineage l JOIN asset_version c ON c.id=l.version_id AND c.state='published' WHERE c.contributor_id=?1) AS remixesMade").bind(userId).first<Record<string,number>>();
 const categories=(await env.DB.prepare("SELECT COALESCE(model_type,'Unclassified') AS category,count(*) AS n FROM catalog_discovery WHERE contributor_id=? GROUP BY 1").bind(userId).all<{category:string;n:number}>()).results;
 return {rejected:row?.rejected??0,removed:row?.removed??0,memberSince:row?.memberSince??Date.now(),published:row?.published??0,followers:row?.followers??0,following:row?.following??0,votesReceived:row?.votesReceived??0,downloads:row?.downloads??0,remixedBy:row?.remixedBy??0,remixesMade:row?.remixesMade??0,publishedByCategory:Object.fromEntries(categories.map(c=>[c.category,c.n]))};
}

export async function communityRoutes(request:Request,env:Env,actor:Principal,path:string):Promise<Response|null>{
 if(!path.startsWith('/api/community/'))return null;
 const method=request.method,read=()=>requireScope(actor,'catalog:read');
 if(path==='/api/community/me'&&method==='GET'){read();const row=await ensureProfile(env,actor.id);return json({profile:publicProfile(row)});}
 if(path==='/api/community/me'&&method==='PUT'){
  interactive(actor);const input=await body(request,['handle','displayName','bio','avatarHue','links','accent','flair']);const current=await ensureProfile(env,actor.id);
  const handle=input.handle===undefined?current.handle:String(input.handle).toLowerCase();if(!validHandle(handle))throw new HttpError(400,'invalid_handle');
  const name=input.displayName===undefined?current.display_name:input.displayName;if(!nonempty(name,60))throw new HttpError(400,'invalid_display_name');
  const bio=input.bio===undefined?current.bio:input.bio;if(typeof bio!=='string'||bio.length>500)throw new HttpError(400,'invalid_bio');
  const hue=input.avatarHue===undefined?current.avatar_hue:Number(input.avatarHue);if(!Number.isInteger(hue)||hue<0||hue>359)throw new HttpError(400,'invalid_avatar');
  const links=input.links===undefined?JSON.parse(current.links):validLinks(input.links);
  const level=(await cachedScore(env,actor.id))?.level.level??1,accent=input.accent===undefined?(current.accent??'default'):input.accent,flair=input.flair===undefined?(current.flair??'none'):input.flair;
  for(const problem of [input.accent===undefined?'':checkCosmetic(ACCENTS,accent,level,'accent'),input.flair===undefined?'':checkCosmetic(FLAIRS,flair,level,'flair')])if(problem)throw new HttpError(problem.endsWith('_locked')?403:400,problem);
  const taken=await env.DB.prepare('SELECT user_id FROM creator_profile WHERE handle=? AND user_id!=?').bind(handle,actor.id).first();if(taken)throw new HttpError(409,'handle_taken');
  await env.DB.batch([env.DB.prepare('UPDATE creator_profile SET handle=?,display_name=?,bio=?,avatar_hue=?,links=?,accent=?,flair=?,updated_at=? WHERE user_id=?').bind(handle,String(name).trim(),bio,hue,JSON.stringify(links),accent,flair,Date.now(),actor.id),await audit(env,actor.id,'profile_updated',actor.id,{handle})]);
  return json({profile:publicProfile((await env.DB.prepare('SELECT * FROM creator_profile WHERE user_id=?').bind(actor.id).first<ProfileRow>())!)});
 }
 const profile=/^\/api\/community\/profiles\/([a-z0-9_-]{3,24})$/.exec(path);
 if(profile&&method==='GET'){
  read();const row=await profileByHandle(env,profile[1]!),facts=await stats(env,row.user_id),score=await cachedScore(env,row.user_id);
  const following=!!await env.DB.prepare('SELECT 1 FROM creator_follow WHERE follower_id=? AND creator_id=?').bind(actor.id,row.user_id).first();
  const {rejected,removed,memberSince,...shown}=facts,admin=!actor.scopes&&actor.capabilities.includes('admin');
  const hint=admin?{moderatorEligible:moderatorEligible({reputation:score?.reputation??0,published:facts.published,removed,rejected,accountAgeDays:(Date.now()-memberSince)/DAY})}:{};
  const lvl=score?.level??levelFor(0),shownProfile={...publicProfile(row),accent:effective(ACCENTS,row.accent??'default',lvl.level,'default'),flair:effective(FLAIRS,row.flair??'none',lvl.level,'none')};
  const cosmetics=row.user_id===actor.id?{cosmetics:{accents:unlocked(ACCENTS,lvl.level),flairs:unlocked(FLAIRS,lvl.level)}}:{};
  return json({...cosmetics,profile:shownProfile,self:row.user_id===actor.id,following,...hint,stats:shown,points:{allTime:score?.allTime??0,reputation:score?.reputation??0,week:score?.week??0,month:score?.month??0},level:score?.level??levelFor(0),badges:badges(facts),models:await modelCards(env,'v.contributor_id=?',[row.user_id],48)});
 }
 const follow=/^\/api\/community\/profiles\/([a-z0-9_-]{3,24})\/follow$/.exec(path);
 if(follow&&['PUT','DELETE'].includes(method)){
  interactive(actor);const row=await profileByHandle(env,follow[1]!);if(row.user_id===actor.id)throw new HttpError(400,'self_follow_forbidden');
  if(method==='PUT'){if(await recent(env,'SELECT count(*) AS n FROM creator_follow WHERE follower_id=? AND created_at>?',actor.id,HOUR)>=COMMUNITY_RULES.followsPerHour)throw new HttpError(429,'follow_rate_limited');await env.DB.prepare('INSERT OR IGNORE INTO creator_follow(follower_id,creator_id,created_at) SELECT ?,?,? WHERE '+activeVoter).bind(actor.id,row.user_id,Date.now(),actor.id).run();}
  else await env.DB.prepare('DELETE FROM creator_follow WHERE follower_id=? AND creator_id=?').bind(actor.id,row.user_id).run();
  const [state,n]=await env.DB.batch<{n:number}>([env.DB.prepare('SELECT count(*) AS n FROM creator_follow WHERE follower_id=? AND creator_id=?').bind(actor.id,row.user_id),env.DB.prepare('SELECT count(*) AS n FROM creator_follow f WHERE creator_id=? AND '+countedMember('f.follower_id')).bind(row.user_id)]);return json({following:Number(state!.results[0]?.n??0)>0,followers:Number(n!.results[0]?.n??0)});
 }
 if(path==='/api/community/feed'&&method==='GET'){
  read();const offset=Math.max(0,Math.min(10000,Number(new URL(request.url).searchParams.get('offset')??0)|0));
  const models=await modelCards(env,'v.contributor_id IN (SELECT creator_id FROM creator_follow WHERE follower_id=?)',[actor.id],24,offset),people=await profilesFor(env,[...new Set(models.map(m=>m.creatorId))]);
  const following=Number((await env.DB.prepare('SELECT count(*) AS n FROM creator_follow WHERE follower_id=?').bind(actor.id).first<{n:number}>())?.n??0);
  return json({following,models:models.map(m=>({...m,creator:people.get(m.creatorId)})),nextOffset:models.length===24?offset+24:null});
 }
 if(path==='/api/community/leaderboard'&&method==='GET'){
  read();const params=new URL(request.url).searchParams,period=(params.get('period')??'month') as Period,category=params.get('category')||null;if(!['week','month','all'].includes(period))throw new HttpError(400,'invalid_period');if(category&&category.length>40)throw new HttpError(400,'invalid_category');
  const rows=await cachedLeaderboard(env,period,category),people=await profilesFor(env,rows.map(r=>r.creator));
  const categories=(await env.DB.prepare("SELECT DISTINCT COALESCE(model_type,'Unclassified') AS c FROM catalog_discovery ORDER BY 1").all<{c:string}>()).results.map(r=>r.c);
  return json({period,category,categories,entries:rows.map(({creator,...r})=>({...r,creator:people.get(creator)??null}))});
 }
 const versionView=/^\/api\/community\/versions\/([a-f0-9]{64})$/.exec(path);
 if(versionView&&method==='GET'){
  read();const v=await env.DB.prepare("SELECT id,asset_id,contributor_id FROM asset_version WHERE id=? AND state='published'").bind(versionView[1]).first<{id:string;asset_id:string;contributor_id:string}>();if(!v)throw new HttpError(404,'model_not_found');
  const [counts,comments,lineage,remixes]=await env.DB.batch<Record<string,unknown>>([
   env.DB.prepare("SELECT "+voteCountSql('?3')+" AS votes,EXISTS(SELECT 1 FROM vote WHERE asset_id=?3 AND user_id=?2) AS voted,EXISTS(SELECT 1 FROM favorite WHERE asset_id=?3 AND user_id=?2) AS favorited,EXISTS(SELECT 1 FROM creator_follow WHERE follower_id=?2 AND creator_id=?4) AS following,(SELECT count(*) FROM favorite WHERE asset_id=?3) AS favorites").bind(v.id,actor.id,v.asset_id,v.contributor_id),
   env.DB.prepare("SELECT c.id,c.author_id AS authorId,c.body,c.status,c.created_at AS createdAt FROM model_comment c WHERE c.version_id=? AND c.status='visible' AND "+countedMember('c.author_id')+" ORDER BY c.created_at,c.id LIMIT 200").bind(v.id),
   env.DB.prepare("SELECT l.parent_asset_id AS assetId,(SELECT d.id FROM catalog_discovery d WHERE d.asset_id=l.parent_asset_id) AS versionId,(SELECT d.title FROM catalog_discovery d WHERE d.asset_id=l.parent_asset_id) AS title,(SELECT d.contributor_id FROM catalog_discovery d WHERE d.asset_id=l.parent_asset_id) AS creatorId FROM version_lineage l WHERE l.version_id=?").bind(v.id),
   env.DB.prepare("SELECT d.id AS versionId,d.title,d.contributor_id AS creatorId FROM version_lineage l JOIN catalog_discovery d ON d.id=l.version_id WHERE l.parent_asset_id=? ORDER BY d.published_at DESC LIMIT 24").bind(v.asset_id),
  ]);
  const c=counts!.results[0]!,parent=lineage!.results[0] as {assetId:string;versionId:string|null;title:string|null;creatorId:string|null}|undefined,commentRows=comments!.results as Array<{id:string;authorId:string;body:string;createdAt:number}>;
  const people=await profilesFor(env,[...new Set([v.contributor_id,...commentRows.map(r=>r.authorId),...(parent?.creatorId?[parent.creatorId]:[]),...remixes!.results.map(r=>String(r.creatorId))])]),creatorScore=await cachedScore(env,v.contributor_id);
  const moderator=isModerator(actor);
  return json({versionId:v.id,assetId:v.asset_id,creator:{...people.get(v.contributor_id),level:creatorScore?.level??levelFor(0)},self:v.contributor_id===actor.id,votes:Number(c.votes),voted:!!c.voted,favorited:!!c.favorited,favorites:Number(c.favorites),following:!!c.following,canModerate:moderator,
   parent:parent?{assetId:parent.assetId,versionId:parent.versionId,title:parent.title,creator:parent.creatorId?people.get(parent.creatorId)??null:null}:null,
   remixes:remixes!.results.map(r=>({versionId:r.versionId,title:r.title,creator:people.get(String(r.creatorId))??null})),
   comments:commentRows.map(r=>({id:r.id,body:r.body,createdAt:r.createdAt,author:people.get(r.authorId)??null,own:r.authorId===actor.id}))});
 }
 const vote=/^\/api\/community\/versions\/([a-f0-9]{64})\/vote$/.exec(path);
 if(vote&&['PUT','DELETE'].includes(method)){
  const v=await env.DB.prepare("SELECT asset_id FROM asset_version WHERE id=? AND state='published'").bind(vote[1]).first<{asset_id:string}>();if(!v)throw new HttpError(404,'model_not_found');
  return json(await castVote(env,actor,v.asset_id,method==='PUT'));
 }
 const favorite=/^\/api\/community\/favorites\/([a-zA-Z0-9_-]{1,120})$/.exec(path);
 if(favorite&&['PUT','DELETE'].includes(method)){
  interactive(actor);if(method==='PUT'){if(!await env.DB.prepare("SELECT 1 FROM asset_version WHERE asset_id=? AND state='published' LIMIT 1").bind(favorite[1]).first())throw new HttpError(404,'model_not_found');await env.DB.prepare('INSERT OR IGNORE INTO favorite(user_id,asset_id,created_at) VALUES(?,?,?)').bind(actor.id,favorite[1],Date.now()).run();}
  else await env.DB.prepare('DELETE FROM favorite WHERE user_id=? AND asset_id=?').bind(actor.id,favorite[1]).run();return json({favorited:method==='PUT'});
 }
 if(path==='/api/community/favorites'&&method==='GET'){read();const models=await modelCards(env,'v.asset_id IN (SELECT asset_id FROM favorite WHERE user_id=?)',[actor.id],96),people=await profilesFor(env,[...new Set(models.map(m=>m.creatorId))]);return json({models:models.map(m=>({...m,creator:people.get(m.creatorId)}))});}
 const comments=/^\/api\/community\/versions\/([a-f0-9]{64})\/comments$/.exec(path);
 if(comments&&method==='POST'){
  interactive(actor);if(actor.status!=='active'||!actor.verified)throw new HttpError(403,'active_verified_membership_required');const input=await body(request,['body']);if(!nonempty(input.body,2000))throw new HttpError(400,'comment_body_required');
  if(!await env.DB.prepare("SELECT 1 FROM asset_version WHERE id=? AND state='published'").bind(comments[1]).first())throw new HttpError(404,'model_not_found');
  const member=await env.DB.prepare('SELECT created_at FROM member WHERE user_id=?').bind(actor.id).first<{created_at:number}>();if(!member||Date.now()-member.created_at<COMMUNITY_RULES.minCommenterAgeMs)throw new HttpError(403,'account_too_new_to_comment');
  if(await recent(env,'SELECT count(*) AS n FROM model_comment WHERE author_id=? AND created_at>?',actor.id,HOUR)>=COMMUNITY_RULES.commentsPerHour)throw new HttpError(429,'comment_rate_limited');
  const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO model_comment(id,version_id,author_id,body,created_at) SELECT ?,?,?,?,? WHERE '+activeVoter).bind(id,comments[1],actor.id,String(input.body).trim(),Date.now(),actor.id),await audit(env,actor.id,'comment_created',id,{version:comments[1]})]);return json({id},201);
 }
 const comment=/^\/api\/community\/comments\/([0-9a-f-]{36})(?:\/(report|moderation))?$/.exec(path);
 if(comment){
  interactive(actor);const row=await env.DB.prepare('SELECT id,author_id,status FROM model_comment WHERE id=?').bind(comment[1]).first<{id:string;author_id:string;status:string}>();if(!row||row.status==='deleted')throw new HttpError(404,'comment_not_found');
  if(!comment[2]&&method==='DELETE'){if(row.author_id!==actor.id)throw new HttpError(403,'comment_owner_required');await env.DB.batch([env.DB.prepare("UPDATE model_comment SET status='deleted' WHERE id=?").bind(row.id),await audit(env,actor.id,'comment_deleted',row.id,{})]);return json({deleted:true});}
  if(comment[2]==='report'&&method==='POST'){const input=await body(request,['reason']);if(!nonempty(input.reason,1000))throw new HttpError(400,'report_reason_required');if(row.author_id===actor.id)throw new HttpError(400,'self_report_forbidden');if(await recent(env,'SELECT count(*) AS n FROM comment_report WHERE reporter_id=? AND created_at>?',actor.id,DAY)>=COMMUNITY_RULES.reportsPerDay)throw new HttpError(429,'report_rate_limited');await env.DB.prepare('INSERT OR IGNORE INTO comment_report(id,comment_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),row.id,actor.id,input.reason,Date.now()).run();return json({reported:true},201);}
  if(comment[2]==='moderation'&&method==='PUT'){
   if(!isModerator(actor))throw new HttpError(403,'capability_required');if(row.author_id===actor.id)throw new HttpError(403,'self_moderation_forbidden');const input=await body(request,['status','reason']);if(!['hidden','visible'].includes(String(input.status))||!nonempty(input.reason,1000))throw new HttpError(400,'moderation_reason_required');
   await env.DB.batch([env.DB.prepare('UPDATE model_comment SET status=?,moderated_by=?,moderation_reason=? WHERE id=?').bind(input.status,actor.id,input.reason,row.id),env.DB.prepare("UPDATE comment_report SET status=?,resolved_by=? WHERE comment_id=? AND status='open'").bind(input.status==='hidden'?'hidden':'dismissed',actor.id,row.id),await audit(env,actor.id,'comment_moderated',row.id,input)]);return json({status:input.status});
  }
 }
 if(path==='/api/community/moderation/comments'&&method==='GET'){
  interactive(actor);if(!isModerator(actor))throw new HttpError(403,'capability_required');
  const rows=(await env.DB.prepare("SELECT c.id,c.version_id AS versionId,c.body,c.status,count(r.id) AS reports,group_concat(r.reason,' | ') AS reasons FROM comment_report r JOIN model_comment c ON c.id=r.comment_id WHERE r.status='open' GROUP BY c.id ORDER BY min(r.created_at) LIMIT 100").all()).results;return json({comments:rows});
 }
 const lineage=/^\/api\/community\/versions\/([a-f0-9]{64})\/lineage$/.exec(path);
 if(lineage&&method==='PUT'){
  requireScope(actor,'submissions:write');const input=await body(request,['parentAssetId']);if(typeof input.parentAssetId!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(input.parentAssetId))throw new HttpError(400,'invalid_parent');
  const own=await env.DB.prepare("SELECT asset_id,state FROM asset_version WHERE id=? AND contributor_id=?").bind(lineage[1],actor.id).first<{asset_id:string;state:string}>();if(!own)throw new HttpError(404,'version_not_found');if(own.asset_id===input.parentAssetId)throw new HttpError(400,'invalid_parent');
  if(!await env.DB.prepare("SELECT 1 FROM asset_version WHERE asset_id=? AND state='published' LIMIT 1").bind(input.parentAssetId).first())throw new HttpError(404,'parent_not_found');
  await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO version_lineage(version_id,parent_asset_id,created_at) VALUES(?,?,?)').bind(lineage[1],input.parentAssetId,Date.now()),await audit(env,actor.id,'lineage_declared',lineage[1]!,{parent:input.parentAssetId})]);
  const row=await env.DB.prepare('SELECT parent_asset_id FROM version_lineage WHERE version_id=?').bind(lineage[1]).first<{parent_asset_id:string}>();return json({parentAssetId:row?.parent_asset_id});
 }
 if(path==='/api/community/notifications'&&method==='GET'){
  read();const cursor=Number((await env.DB.prepare('SELECT read_before FROM notification_cursor WHERE user_id=?').bind(actor.id).first<{read_before:number}>())?.read_before??0),since=Date.now()-60*DAY;
  const rows=(await env.DB.prepare("SELECT * FROM ("+
   "SELECT 'follower' AS kind,f.follower_id AS actorId,NULL AS versionId,NULL AS title,NULL AS outcome,f.created_at AS at FROM creator_follow f WHERE f.creator_id=?1 AND f.created_at>?2 AND "+countedMember('f.follower_id')+" "+
   "UNION ALL SELECT 'vote',vt.user_id,d.id,d.title,NULL,vt.created_at FROM vote vt JOIN catalog_discovery d ON d.asset_id=vt.asset_id WHERE d.contributor_id=?1 AND vt.user_id!=?1 AND vt.created_at>?2 AND "+countedMember('vt.user_id')+" "+
   "UNION ALL SELECT 'comment',c.author_id,v.id,v.title,NULL,c.created_at FROM model_comment c JOIN asset_version v ON v.id=c.version_id WHERE v.contributor_id=?1 AND c.author_id!=?1 AND c.status='visible' AND c.created_at>?2 AND "+countedMember('c.author_id')+" "+
   "UNION ALL SELECT 'followed_publication',v.contributor_id,v.id,v.title,NULL,v.published_at FROM catalog_discovery v JOIN creator_follow f ON f.creator_id=v.contributor_id AND f.follower_id=?1 WHERE v.published_at>?2 AND v.published_at>f.created_at "+
   "UNION ALL SELECT 'review',NULL,v.id,v.title,v.state,COALESCE(v.published_at,(SELECT max(a.created_at) FROM audit_event a WHERE a.target=v.id AND a.action='transition_attempt' AND json_extract(a.data,'$.to')=v.state)) FROM asset_version v WHERE v.contributor_id=?1 AND v.state IN ('published','rejected','changes_requested','approved')"+
   ") WHERE at>?2 ORDER BY at DESC LIMIT 60").bind(actor.id,since).all<{kind:string;actorId:string|null;versionId:string|null;title:string|null;outcome:string|null;at:number}>()).results;
  const people=await profilesFor(env,[...new Set(rows.flatMap(r=>r.actorId?[r.actorId]:[]))]);
  return json({unread:rows.filter(r=>r.at>cursor).length,notifications:rows.map(r=>({kind:r.kind,actor:r.actorId?people.get(r.actorId)??null:null,versionId:r.versionId,title:r.title,outcome:r.outcome,at:r.at,unread:r.at>cursor}))});
 }
 if(path==='/api/community/notifications/read'&&method==='POST'){interactive(actor);await body(request,[]);await env.DB.prepare('INSERT INTO notification_cursor(user_id,read_before) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET read_before=excluded.read_before').bind(actor.id,Date.now()).run();return json({read:true});}
 return null;
}
export async function creditDownload(env:Env,actor:Principal,versionId:string,path:string){
 if(/\.(png|jpe?g|webp)$/i.test(path))return;
 await env.DB.prepare("INSERT OR IGNORE INTO download_credit(user_id,asset_id,created_at) SELECT ?,asset_id,? FROM asset_version WHERE id=? AND state='published' AND contributor_id!=?").bind(actor.id,Date.now(),versionId,actor.id).run();
}

/** The single vote path used by the catalog and community APIs. Votes only affect discovery and
 * cosmetic points; they are never read by review, publication or capability code. */
export async function castVote(env:Env,actor:Principal,assetId:string,set:boolean){
 requireScope(actor,'votes:write');
 if(actor.status!=='active'||!actor.verified)throw new HttpError(403,'active_verified_membership_required');
 if(!await env.DB.prepare("SELECT 1 FROM asset_version WHERE asset_id=? AND state='published' LIMIT 1").bind(assetId).first())throw new HttpError(404,'model_not_found');
 if(set){
  if(await env.DB.prepare('SELECT 1 FROM asset_version WHERE asset_id=? AND contributor_id=? LIMIT 1').bind(assetId,actor.id).first())throw new HttpError(403,'self_vote_forbidden');
  const member=await env.DB.prepare('SELECT created_at FROM member WHERE user_id=?').bind(actor.id).first<{created_at:number}>();if(!member||Date.now()-member.created_at<COMMUNITY_RULES.minVoterAgeMs)throw new HttpError(403,'account_too_new_to_vote');
 }
 const already=!!await env.DB.prepare('SELECT 1 FROM vote WHERE user_id=? AND asset_id=?').bind(actor.id,assetId).first();
 if(already!==set){
  if(await recent(env,"SELECT count(*) AS n FROM audit_event WHERE actor_id=? AND action IN ('vote_set','vote_removed') AND created_at>?",actor.id,HOUR)>=COMMUNITY_RULES.votesPerHour)throw new HttpError(429,'vote_rate_limited');
  const query=set?env.DB.prepare("INSERT OR IGNORE INTO vote(user_id,asset_id,created_at) SELECT ?,?,? WHERE "+activeVoter).bind(actor.id,assetId,Date.now(),actor.id):env.DB.prepare('DELETE FROM vote WHERE user_id=? AND asset_id=?').bind(actor.id,assetId);
  await env.DB.batch([query,await audit(env,actor.id,set?'vote_set':'vote_removed',assetId,{})]);
 }
 const n=await env.DB.prepare('SELECT '+voteCountSql('?')+' AS votes').bind(assetId).first<{votes:number}>();return {voted:set,votes:n?.votes??0};
}

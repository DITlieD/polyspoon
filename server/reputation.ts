// Pure community scoring. Points are recognition only: nothing here is read by review,
// publication, moderation or capability code, and no score unlocks authority.
export const POINTS={firstPublish:50,versionPublish:10,voteBase:4,remix:20,download:1,rejected:-10,removed:-40} as const;
export const LIMITS={downloadsPerAsset:100,votesPerVoterCreator:5,maxVoteWeight:2,minVoteWeight:0.5,minVoterAgeDays:3,fullWeightAgeDays:30} as const;
export const MODERATOR_HINT={minReputation:600,minPublished:5,minAccountAgeDays:90} as const;
export const DECAY_HALF_LIFE_DAYS=180;
export const LEVELS=[{level:1,name:'Newcomer',min:0},{level:2,name:'Maker',min:50},{level:3,name:'Craftsperson',min:200},{level:4,name:'Artisan',min:600},{level:5,name:'Master',min:1500},{level:6,name:'Legend',min:4000}] as const;
const DAY=86400000;
export type Publication={creator:string;versionId:string;assetId:string;at:number;category:string|null;firstOfAsset:boolean};
export type Vote={voter:string;creator:string;versionId:string;at:number;category:string|null;voterAgeDays:number};
export type Remix={creator:string;remixer:string;versionId:string;at:number;category:string|null};
export type Download={creator:string;assetId:string;at:number;category:string|null};
export type Penalty={creator:string;versionId:string;at:number;kind:'rejected'|'removed';category:string|null};
export interface CommunityFacts {publications:Publication[];votes:Vote[];remixes:Remix[];downloads:Download[];penalties:Penalty[]}
export interface ScoreEvent {creator:string;kind:'publish'|'vote'|'remix'|'download'|'rejected'|'removed';points:number;at:number;category:string|null}
export function decay(at:number,now:number){const age=Math.max(0,now-at)/DAY;return Math.pow(0.5,age/DECAY_HALF_LIFE_DAYS);}
/** Weight from the voter's base reputation (everything except votes received), so vote rings cannot amplify each other. */
export function voteWeight(voterBase:number,voterAgeDays=Infinity){
 if(!(voterAgeDays>=LIMITS.minVoterAgeDays))return 0;
 const reputation=Math.min(LIMITS.maxVoteWeight,Math.max(LIMITS.minVoteWeight,LIMITS.minVoteWeight+Math.sqrt(Math.max(0,voterBase))/20));
 return voterAgeDays<LIMITS.fullWeightAgeDays?reputation*0.5:reputation;
}
/** Admin-only hint. It never grants anything: appointing a moderator stays a manual admin action. */
export function moderatorEligible(f:{reputation:number;published:number;removed:number;rejected:number;accountAgeDays:number}){
 return f.reputation>=MODERATOR_HINT.minReputation&&f.published>=MODERATOR_HINT.minPublished&&f.removed===0&&f.accountAgeDays>=MODERATOR_HINT.minAccountAgeDays&&f.rejected<=f.published/5;
}
export function levelFor(points:number){let current:typeof LEVELS[number]=LEVELS[0];for(const level of LEVELS)if(points>=level.min)current=level;const next=LEVELS.find(level=>level.min>points)??null;return {level:current.level,name:current.name,points,next:next?{level:next.level,name:next.name,min:next.min}:null};}
const round=(value:number)=>Math.round(value*100)/100;
export function scoreEvents(facts:CommunityFacts,now:number):ScoreEvent[]{
 const base:ScoreEvent[]=[];
 for(const p of facts.publications)base.push({creator:p.creator,kind:'publish',points:p.firstOfAsset?POINTS.firstPublish:POINTS.versionPublish,at:p.at,category:p.category});
 for(const r of facts.remixes)if(r.creator!==r.remixer)base.push({creator:r.creator,kind:'remix',points:POINTS.remix,at:r.at,category:r.category});
 const perAsset=new Map<string,number>();
 for(const d of [...facts.downloads].sort((a,b)=>a.at-b.at)){const used=perAsset.get(d.assetId)??0;if(used>=LIMITS.downloadsPerAsset)continue;perAsset.set(d.assetId,used+1);base.push({creator:d.creator,kind:'download',points:POINTS.download,at:d.at,category:d.category});}
 for(const p of facts.penalties)base.push({creator:p.creator,kind:p.kind,points:POINTS[p.kind],at:p.at,category:p.category});
 const baseRep=new Map<string,number>();for(const e of base)baseRep.set(e.creator,(baseRep.get(e.creator)??0)+e.points*decay(e.at,now));
 const pair=new Map<string,number>(),votes:ScoreEvent[]=[];
 for(const v of [...facts.votes].sort((a,b)=>a.at-b.at)){
  if(v.voter===v.creator)continue;const key=v.voter+'\u0000'+v.creator,used=pair.get(key)??0;if(used>=LIMITS.votesPerVoterCreator)continue;pair.set(key,used+1);
  const weight=voteWeight(baseRep.get(v.voter)??0,v.voterAgeDays);if(weight<=0)continue;
  votes.push({creator:v.creator,kind:'vote',points:round(POINTS.voteBase*weight),at:v.at,category:v.category});
 }
 return [...base,...votes];
}
export interface CreatorScore {creator:string;allTime:number;reputation:number;week:number;month:number;level:ReturnType<typeof levelFor>;byCategory:Record<string,number>}
export function summarize(events:ScoreEvent[],now:number):Map<string,CreatorScore>{
 const result=new Map<string,CreatorScore>();
 for(const e of events){
  let s=result.get(e.creator);if(!s){s={creator:e.creator,allTime:0,reputation:0,week:0,month:0,level:levelFor(0),byCategory:{}};result.set(e.creator,s);}
  s.allTime+=e.points;s.reputation+=e.points*decay(e.at,now);if(now-e.at<=7*DAY)s.week+=e.points;if(now-e.at<=30*DAY)s.month+=e.points;const c=e.category??'Unclassified';s.byCategory[c]=(s.byCategory[c]??0)+e.points;
 }
 for(const s of result.values()){s.allTime=Math.max(0,round(s.allTime));s.reputation=Math.max(0,round(s.reputation));s.week=round(s.week);s.month=round(s.month);for(const k of Object.keys(s.byCategory))s.byCategory[k]=round(s.byCategory[k]!);s.level=levelFor(s.allTime);}
 return result;
}
export type Period='week'|'month'|'all';
export function leaderboard(events:ScoreEvent[],scores:Map<string,CreatorScore>,now:number,period:Period,category:string|null,limit=50){
 const window=period==='week'?7*DAY:period==='month'?30*DAY:Infinity,totals=new Map<string,number>();
 for(const e of events){if(now-e.at>window)continue;if(category&&(e.category??'Unclassified')!==category)continue;totals.set(e.creator,(totals.get(e.creator)??0)+e.points);}
 return [...totals].map(([creator,points])=>({creator,points:round(points),level:scores.get(creator)?.level??levelFor(0)})).filter(row=>row.points>0).sort((a,b)=>b.points-a.points||a.creator.localeCompare(b.creator)).slice(0,limit).map((row,index)=>({rank:index+1,...row}));
}
export interface BadgeFacts {published:number;publishedByCategory:Record<string,number>;votesReceived:number;remixedBy:number;remixesMade:number;followers:number}
export function badges(f:BadgeFacts){
 const list:Array<{id:string;name:string;description:string}>=[];
 if(f.published>=1)list.push({id:'first-model',name:'First model',description:'Had a model approved by independent review and published.'});
 if(f.published>=10)list.push({id:'prolific',name:'Prolific',description:'Ten reviewed models published.'});
 if(f.votesReceived>=50)list.push({id:'crowd-favourite',name:'Crowd favourite',description:'Fifty votes from other members.'});
 if(f.remixedBy>=1)list.push({id:'remixed',name:'Remixed',description:'Another creator published a remix of this recipe.'});
 if(f.remixesMade>=1)list.push({id:'remixer',name:'Remixer',description:'Published a credited remix of another recipe.'});
 if(f.followers>=25)list.push({id:'followed',name:'Followed',description:'Twenty-five members follow this creator.'});
 for(const [category,count] of Object.entries(f.publishedByCategory).sort())if(count>=5)list.push({id:'specialist:'+category,name:category+' specialist',description:'Five reviewed '+category.toLowerCase()+' models.'});
 return list;
}

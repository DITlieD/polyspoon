// Outcome merge for safety-v1. Monotonic by construction: the outcome is the strictest band over all findings, so
// adding evidence (e.g. from the optional LLM second opinion) can only keep or raise it, never lower it.
// The strongest possible result is `reject` (appealable auto-rejection). `pass` only means "eligible for human review".
import type {Band,Finding,ImageScore,Outcome,TextHit,Thresholds} from './types.ts';
import {BAND_RANK} from './types.ts';
export interface MergeInput{thresholds:Thresholds;imageScores:ImageScore[];textHits:TextHit[];geometry:{hidden:number;tiny:number;hiddenArtifacts?:string[]};incomplete:string[];invalidFile?:string|null}
export const MAX_FINDINGS=200;
const stricter=(a:Band,b:Band):Band=>BAND_RANK[a]>=BAND_RANK[b]?a:b;
export function mergeOutcome(input:MergeInput):{outcome:Outcome;findings:Finding[]}{
 const t=input.thresholds,f:Finding[]=[];
 const push=(x:Finding)=>f.push(x);
 if(input.invalidFile)push({category:'invalid_file',detector:'ingest-sandbox-v1',band:'reject',textSpan:input.invalidFile.slice(0,200)});
 const byImage=new Map<string,Partial<Record<ImageScore['category'],ImageScore>>>();
 for(const s of input.imageScores){
  if(!(s.score>=0&&s.score<=1))continue;
  const slot=byImage.get(s.image)??{};const prev=slot[s.category];if(!prev||prev.score<s.score)slot[s.category]=s;byImage.set(s.image,slot);
 }
 let sexualMulti=0;
 for(const slot of byImage.values())if((slot.sexual?.score??0)>=t.reject.sexual_multi)sexualMulti++;
 for(const [image,slot] of byImage){
  const sx=slot.sexual,cl=slot.child_like,hs=slot.hate_symbol,vi=slot.violence;
  if(sx){const band:Band=sx.score>=t.reject.sexual_single||(sx.score>=t.reject.sexual_multi&&sexualMulti>=t.reject.sexual_multi_count)?'reject':sx.score>=t.flag.sexual?'flag':'low';if(band!=='low'||sx.score>=0.2)push({category:'sexual',detector:sx.detector,band,score:sx.score,artifact:image,bbox:sx.bbox});}
  if(cl&&cl.score>0){const s=sx?.score??0;const band:Band=cl.score>=t.reject.child_like&&s>=t.reject.child_like_sexual?'reject':cl.score>=t.flag.child_like&&s>=t.flag.child_like_sexual?'flag':'low';if(band!=='low'||cl.score>=0.2)push({category:'child_like',detector:cl.detector,band,score:cl.score,artifact:image,bbox:cl.bbox});}
  if(hs){const band:Band=hs.score>=t.reject.hate_symbol?'reject':hs.score>=t.flag.hate_symbol?'flag':'low';if(band!=='low'||hs.score>=0.25)push({category:'hate_symbol',detector:hs.detector,band,score:hs.score,artifact:image,bbox:hs.bbox});}
  if(vi&&vi.score>=t.flag.violence)push({category:'violence',detector:vi.detector,band:'flag',score:vi.score,artifact:image,bbox:vi.bbox});
 }
 for(const h of input.textHits){
  const band:Band=h.category==='suspicious_instructions'?t.suspiciousInstructions:h.severity==='severe'?t.text.severe:t.text.context;
  const art=h.source.startsWith('ocr:')?h.source.slice(4):undefined;
  push({category:h.category==='sexual'||h.category==='hate_symbol'?h.category:h.category,detector:h.detector,band,artifact:art,textSpan:(h.source.slice(0,40)+': '+h.span).slice(0,200)});
 }
 if(input.geometry.hidden>0)push({category:'hidden_geometry',detector:'geometry-visibility-v1',band:t.hiddenGeometry,textSpan:input.geometry.hidden+' part(s) not visible from any outside view'});
 if(input.geometry.tiny>0)push({category:'hidden_geometry',detector:'geometry-visibility-v1',band:t.tinyIslands,textSpan:input.geometry.tiny+' tiny detached part(s), rendered close up',artifact:input.geometry.hiddenArtifacts?.[0]});
 for(const reason of input.incomplete)push({category:'analysis_incomplete',detector:'pipeline',band:'flag',textSpan:reason.slice(0,200)});
 f.sort((a,b)=>BAND_RANK[b.band]-BAND_RANK[a.band]||(b.score??0)-(a.score??0));
 const top=f.reduce<Band>((m,x)=>stricter(m,x.band),'low');
 const outcome:Outcome=top==='reject'?'reject':input.incomplete.length?'incomplete':top==='flag'?'flag':'pass';
 return {outcome,findings:f.slice(0,MAX_FINDINGS)};
}
/** Strictness order used by the Worker as well: a later opinion may only move an outcome rightwards. */
export function stricterOutcome(a:Outcome,b:Outcome):Outcome{const r={pass:0,flag:1,incomplete:2,reject:3} as const;return r[a]>=r[b]?a:b;}
export function parseThresholds(value:unknown):Thresholds{
 const v=value as Thresholds,num=(x:unknown)=>typeof x==='number'&&x>=0&&x<=1,band=(x:unknown)=>x==='low'||x==='flag'||x==='reject';
 if(!v||typeof v!=='object'||typeof v.version!=='string'||typeof v.enforce!=='boolean'||!Number.isInteger(v.maxImages)||v.maxImages<1||v.maxImages>400)throw new Error('invalid_policy');
 for(const k of ['sexual','hate_symbol','violence','child_like','child_like_sexual'] as const)if(!num(v.flag?.[k]))throw new Error('invalid_policy');
 for(const k of ['sexual_single','sexual_multi','hate_symbol','child_like','child_like_sexual'] as const)if(!num(v.reject?.[k]))throw new Error('invalid_policy');
 if(!Number.isInteger(v.reject.sexual_multi_count)||!band(v.text?.severe)||!band(v.text?.context)||!band(v.hiddenGeometry)||!band(v.tinyIslands)||!band(v.suspiciousInstructions)||v.llm!=='stricter_only')throw new Error('invalid_policy');
 if(v.flag.hate_symbol>v.reject.hate_symbol||v.flag.sexual>v.reject.sexual_multi)throw new Error('invalid_policy');
 return v;
}

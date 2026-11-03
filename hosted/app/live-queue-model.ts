// Pure helpers for the live moderation queue (no DOM), shared by the page and its unit tests.
export interface TopFinding{category:string;band:string;detector:string}
export interface QueueItem{versionId:string;priority:number;reason:string;revision:number;enqueuedAt:number;claimExpiresAt:number|null;claimedBy:string|null;claimedByName:string|null;title:string;kind:string;contributorId:string;contributorName:string|null;safetyOutcome:string|null;safetyShadow:number|null;mine:boolean;ownContent:boolean;thumbnails:string[];topFinding:TopFinding|null}
export interface QueueFinding{idx:number;category:string;detector:string;band:'low'|'flag'|'reject';artifactPath:string|null;bbox:[number,number,number,number]|null;textSpan:string|null}
export interface QueueEvent{seq:number;versionId:string;actorId:string|null;kind:string;detail:Record<string,unknown>|null;createdAt:number}
export interface QueueDetail{item:{version_id:string;revision:number;claimed_by:string|null;claim_expires_at:number|null;reason:string;priority:number;mine:boolean};version:{id:string;title:string;state:string;contributor_id:string;created_at:number}|null;history:QueueEvent[];safetyReports:{id:string;outcome:string;shadow:number;policyVersion:string;createdAt:number}[];findings:QueueFinding[];images:{name:string;mediaType:string}[];coverage:{notMachineChecked?:string[];ocrLanguages?:string[]}|null;upload:{source:string;format:string;bytes:number;provenance:unknown;category:string|null;description:string|null}|null;hasModel:boolean}
export const CATEGORY_LABEL:Record<string,string>={sexual:'Sexual content',child_like:'Child-like figure',hate_symbol:'Hate symbol',slur_text:'Offensive text',violence:'Violence',suspicious_instructions:'Instructions aimed at reviewers',hidden_geometry:'Hidden or tiny parts',invalid_file:'Invalid file',analysis_incomplete:'Check incomplete'};
export const REASON_LABEL:Record<string,string>={flag:'Flagged',incomplete:'Check incomplete',appeal:'Appeal',report:'Reported',pass:'Passed checks',legacy:'Submitted before checks'};
/** Same order as the server: priority first, then the longest-waiting item. */
export function sortQueue(items:QueueItem[]){return [...items].sort((a,b)=>b.priority-a.priority||a.enqueuedAt-b.enqueuedAt);}
export function waiting(ms:number){const m=Math.max(0,Math.floor(ms/60000));if(m<1)return 'just now';if(m<60)return m+' min';const h=Math.floor(m/60);if(h<48)return h+' h';return Math.floor(h/24)+' d';}
export function claimLabel(item:Pick<QueueItem,'claimedBy'|'claimedByName'|'claimExpiresAt'|'mine'>,now:number){if(!item.claimedBy||!item.claimExpiresAt||item.claimExpiresAt<now)return null;const left=Math.max(1,Math.ceil((item.claimExpiresAt-now)/60000));return (item.mine?'You are reviewing':(item.claimedByName??'Another reviewer')+' is reviewing')+' · '+left+' min left';}
export function badge(item:Pick<QueueItem,'reason'|'safetyOutcome'|'topFinding'|'safetyShadow'>){
 if(item.safetyOutcome==='reject'){
  const validTop=item.topFinding&&!(item.topFinding.category==='child_like'&&item.topFinding.band==='low')?item.topFinding:null;
  const finding=validTop?(CATEGORY_LABEL[validTop.category]??validTop.category):null;
  const shadow=Number(item.safetyShadow)===1?'shadow':null;
  const detail=[finding,shadow].filter(Boolean).join(', ');
  return {label:detail?'Auto-check: reject ('+detail+')':'Auto-check: reject',tone:'danger' as const};
 }
 return {label:REASON_LABEL[item.reason]??item.reason,tone:item.reason==='flag'||item.reason==='incomplete'?'warning':item.reason==='appeal'?'info':'neutral'};
}
export type KeyAction='next'|'previous'|'open'|'approve'|'reject'|'changes'|'release';
/** J/K move, Enter opens (and claims), A/R/C decide, Esc releases. Ignored while typing in a field. */
export function keyAction(key:string,typing:boolean,hasClaim:boolean):KeyAction|null{
 if(typing)return key==='Escape'?'release':null;
 switch(key.toLowerCase()){case 'j':return 'next';case 'k':return 'previous';case 'enter':return 'open';case 'escape':return hasClaim?'release':null;case 'a':return hasClaim?'approve':null;case 'r':return hasClaim?'reject':null;case 'c':return hasClaim?'changes':null;default:return null;}
}
export function move(items:QueueItem[],current:string|null,step:1|-1){if(!items.length)return null;const i=items.findIndex(x=>x.versionId===current);if(i<0)return items[0]!.versionId;return items[Math.min(items.length-1,Math.max(0,i+step))]!.versionId;}
/** Risky crops stay blurred until a moderator clicks them (limits exposure to harmful content). */
export function blurByDefault(f:Pick<QueueFinding,'band'|'category'>){return f.band!=='low'||['sexual','child_like','hate_symbol'].includes(f.category);}
export const RISKY_IMAGE=(name:string,findings:QueueFinding[])=>findings.some(f=>f.artifactPath===name&&blurByDefault(f));
/** Square crop around a finding box with a margin, clamped to the image: the zoomed "evidence" view. */
export function cropRect(bbox:[number,number,number,number],w:number,h:number,margin=0.35){
 const [x0,y0,x1,y1]=bbox,bw=x1-x0+1,bh=y1-y0+1,side=Math.min(Math.max(w,h),Math.max(bw,bh)*(1+margin*2),Math.max(w,h));
 const cx=(x0+x1+1)/2,cy=(y0+y1+1)/2,sx=Math.max(0,Math.min(w-Math.min(side,w),cx-side/2)),sy=Math.max(0,Math.min(h-Math.min(side,h),cy-side/2));
 return {x:Math.round(sx),y:Math.round(sy),w:Math.round(Math.min(side,w)),h:Math.round(Math.min(side,h))};
}
export function imageGroup(name:string){const k=name.split('-')[0]!;return ({view:'Full views',pass:'Material passes',slice:'Interior slices',backface:'Interior slices',grid:'Zoomed tiles',crop:'Zoomed close-ups',island:'Small and hidden parts',texture:'Texture sheets'} as Record<string,string>)[k]??'Other';}
export function groupImages(images:{name:string}[]){const out=new Map<string,string[]>();for(const i of images){const g=imageGroup(i.name);const l=out.get(g)??[];l.push(i.name);out.set(g,l);}return out;}
export function historyLine(e:QueueEvent,names:Record<string,string>){
 const who=e.actorId?(names[e.actorId]??'A reviewer'):'System',d=e.detail??{};
 switch(e.kind){
  case 'enqueued':return 'Entered the queue ('+(REASON_LABEL[String(d.reason)]??String(d.reason??''))+')';
  case 'auto_outcome':return 'Automated check: '+String(d.outcome)+(d.shadow?' (shadow mode, not enforced)':'');
  case 'claimed':return who+' started reviewing';
  case 'released':return who+' released the item';
  case 'expired':return 'Claim expired';
  case 'decided':return who+' decided: '+String(d.decision??'')+(d.note?' — '+String(d.note):'');
  case 'override':return who+' marked the automated result as '+String(d.outcome)+(d.reason?' — '+String(d.reason):'');
  default:return e.kind;
 }
}
/** Should a batch of queue events trigger a refetch? Heartbeats are noise; everything else changes the list. */
export function eventsChangeQueue(events:QueueEvent[]){return events.some(e=>e.kind!=='heartbeat');}

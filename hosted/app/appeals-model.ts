// Pure helpers for the appeal UI (moderator panel and the owner's upload list); unit-tested without a DOM.
export interface AppealItem{uploadId:string;versionId:string;title:string|null;reason:string|null;message:string|null;filed:boolean;ownContent:boolean;createdAt:number;rejectedAt:number;ownerName:string|null;findings:{category:string;band:string;detector:string;textSpan:string|null}[]}
export interface OwnUpload{id:string;status:string;reason:string|null;title:string|null;createdAt:number;appeal:string|null}
export const REASON_LABEL:Record<string,string>={prohibited_symbol:'a prohibited symbol',sexual_content:'sexual content',text_policy:'text that breaks the rules',invalid_file:'a file problem'};
/** Owner copy: coarse reason only (never detector names or scores) and what the appeal can and cannot do. */
export function ownerNotice(u:OwnUpload){
 if(u.status!=='rejected')return null;
 const why='The automated check rejected this upload for '+(REASON_LABEL[u.reason??'']??'a policy reason')+'.';
 if(u.appeal==='open')return {text:why+' Your appeal is waiting for a moderator.',canAppeal:false};
 if(u.appeal==='accepted')return {text:'A moderator reopened this upload. It is back in human review.',canAppeal:false};
 if(u.appeal==='declined')return {text:why+' A moderator reviewed your appeal and kept the rejection.',canAppeal:false};
 return {text:why+' If you think this is a mistake, you can ask a moderator to look at it. A person will check it; nothing is published automatically.',canAppeal:true};
}
export function validAppealMessage(v:string){const t=v.trim();return t.length>=1&&t.length<=500;}
export function appealOrder(items:AppealItem[]){return [...items].sort((a,b)=>Number(b.filed)-Number(a.filed)||a.createdAt-b.createdAt);}

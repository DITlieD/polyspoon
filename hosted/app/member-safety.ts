import {el,button,field,status,heading,link} from '../shared/dom.ts';
import {explain} from '../shared/http.ts';
import {reportModel,reportCategories,submitAppeal} from './moderation-actions.ts';
import {messageInput,moderationAction,moderationState,moderationTime} from './moderation-dom.ts';
import {moderationPages} from './moderation-pages.ts';
import type {Context} from './types.ts';
import type {Report,Restriction} from './moderation-types.ts';

export function modelReport(context:Context,versionId:string){
 if(context.member.status==='guest')return el('details','panel moderation-section',el('summary','','Report this model'),el('p','',link('Sign in to report this model','/sign-in')));
 let active=true;context.resources.add(()=>{active=false;});const root=el('details','panel moderation-section',el('summary','','Report this model')),form=el('form'),category=el('select'),reason=messageInput('report-reason'),send=el('button','button-secondary','Send model report'),feedback=status();send.type='submit';category.name='category';for(const [value,label] of reportCategories){const option=el('option','',label);option.value=value;category.append(option);}form.append(field('Report category',category),field('Report reason',reason),el('p','muted','Describe the concern with this version. Reports do not automatically remove models or restrict accounts.'),send);root.append(form,feedback,link('Your report status','/catalog?view=account'));
 form.addEventListener('submit',event=>{event.preventDefault();void moderationAction(send,feedback,async()=>{const result=await reportModel(context.api,versionId,category.value,reason.value);if(!active)return;form.hidden=true;feedback.textContent='Your report is recorded. Status: '+moderationState(result.status)+'. Check your account for the current outcome.';});});return root;
}

export async function restrictionNotice(context:Context){
 let active=true,revision=0;context.resources.add(()=>{active=false;revision++;});const root=el('section','moderation-section'),content=el('div'),feedback=status(),refresh=button('Refresh account access','button-secondary');root.append(content,refresh,feedback);
 async function load(){const own=++revision;refresh.disabled=true;feedback.textContent='Checking account access…';
  try{const data=await context.api.json<Restriction>('/api/account/restriction');if(!active||own!==revision)return;if(data.status!==context.member.status&&context.refreshAccess){context.refreshAccess();return;}content.replaceChildren();feedback.textContent='';
   if(data.status!=='suspended'){content.append(el('section','panel',el('h2','','Account access'),el('p','','Your account is active.')));if(data.appeal)content.append(el('section','panel',el('h3','','Latest appeal'),el('p','',moderationState(data.appeal.status)),el('p','',data.appeal.decisionReason??'No decision reason is available.')));return;}
   content.append(heading('Your account is restricted.','You can read this notice, submit an appeal and sign out. Catalog access is unavailable.'),el('section','panel',el('h2','','Restriction notice'),el('p','',data.reason??'The restriction reason is unavailable. Refresh or contact support.'),el('p','muted','Restricted '+moderationTime(data.restrictedAt))));
   if(data.appeal){content.append(el('section','panel',el('h2','','Your appeal'),el('span','pill',moderationState(data.appeal.status)),el('p','',data.appeal.message),el('p','muted','Submitted '+moderationTime(data.appeal.createdAt)),el('p','',data.appeal.decisionReason??'A decision has not been recorded.')));return;}
   const form=el('form','panel'),message=messageInput('appeal-message'),send=el('button','button','Submit appeal'),result=status();send.type='submit';form.append(el('h2','','Appeal this restriction'),field('Appeal message',message),el('p','muted','Explain why this restriction should be reviewed. One appeal is recorded for this restriction.'),send,result);form.addEventListener('submit',event=>{event.preventDefault();void moderationAction(send,result,async()=>{await submitAppeal(context.api,message.value);if(active)await load();});});content.append(form);
  }catch(error){if(active&&own===revision)feedback.textContent=explain(error);}finally{if(active&&own===revision)refresh.disabled=false;}
 }
 refresh.addEventListener('click',()=>void load());await load();return root;
}

export async function ownReports(context:Context){
 const page=moderationPages<Report>(context,'Your reports',async offset=>{const data=await context.api.json<{reports:Report[];nextOffset:number|null}>('/api/account/reports?offset='+offset);return {items:data.reports,nextOffset:data.nextOffset};},report=>{
  const row=el('article','item',el('div','row',el('h3','','Model report'),el('span','pill',moderationState(report.status))),el('p','asset-path','Version: '+report.versionId),el('p','muted',report.category+' · '+moderationTime(report.createdAt)),el('p','',report.reason),el('p','',report.decisionReason??(report.status==='open'?'No decision yet.':'No decision reason is available.')));if(report.status!=='withdraw')row.append(link('View reported model','/asset/'+encodeURIComponent(report.versionId),'button-secondary'));return row;
 });page.root.classList.add('panel');await page.load();return page.root;
}

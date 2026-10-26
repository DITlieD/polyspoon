import {addressBlocks} from './community-moderation.ts';
import {el,input,field,button,status,heading,empty,action,humanState,when} from '../shared/dom.ts';
import {reviewInspectionView} from './review-inspection.ts';
import {processingView} from './processing.ts';
import {explain} from '../shared/http.ts';
import {uploadReviewEvidence,revokeReview} from './review-actions.ts';
import type {Context,Version} from './types.ts';
export async function reviewQueue(context:Context){
 const root=el('section','review-queue',heading('Review original work.','Review the exact submission and evidence. Votes and contributor-supplied reports do not grant approval.')),list=el('div','list');root.append(list);
 if(context.member.capabilities.some(c=>c==='publisher'||c==='admin'))root.append(revocationForm(context));
 const data=await context.api.json<{versions:Version[]}>('/api/review-queue');
 if(!data.versions.length){list.append(empty('Nothing is waiting for your review.','Submissions appear here when their state and your current capabilities allow action.'));return root;}
 for(const version of data.versions){
  const row=el('article','panel',el('div','row',el('h2','',version.title),el('span','pill',humanState(version.state))),el('p','muted','Submitted '+when(version.created_at))),feedback=status(),details=el('details','',el('summary','','Inspect submission details')),content=el('div');details.append(content);
  details.addEventListener('toggle',()=>{if(details.open&&!content.childNodes.length){content.append(status('Loading exact submission…'));void context.api.json<Record<string,unknown>>('/api/versions/'+version.id).then(value=>content.replaceChildren(el('pre','file-list',JSON.stringify(value,null,2)))).catch(error=>content.replaceChildren(status(explain(error))));}});
  row.append(details,reviewInspectionView(context,version.id));const required=version.processing_requirement==='package-replay-v1';if(required)row.append(await processingView(context,version.id,version.state,true));
  const reason=input('reason','text',false);reason.placeholder='Reason or requested correction';reason.maxLength=1000;row.append(field('Decision note',reason));
  const actions=el('div','actions'),transitions:Array<[string,string]>=[];
  if(!required&&context.member.capabilities.includes('verifier')){if(version.state==='submitted')transitions.push(['Start technical checks','processing']);if(version.state==='processing')transitions.push(['Send to review','awaiting_review']);}
  if(context.member.capabilities.some(c=>c.startsWith('reviewer:'))&&version.state==='awaiting_review')transitions.push(['Request changes','changes_requested'],['Reject submission','rejected']);
  if(context.member.capabilities.includes('publisher')){if(['awaiting_review','approved'].includes(version.state))transitions.push(['Approve exact version','approved']);if(version.state==='approved')transitions.push(['Publish approved version','published']);}
  for(const [label,state] of transitions){const control=button(label,'button-secondary');control.addEventListener('click',()=>void action(control,feedback,async()=>{await context.api.json('/api/versions/'+version.id+'/transition',{method:'POST',body:JSON.stringify({state,...(reason.value.trim()?{reason:reason.value.trim()}:{})})});feedback.textContent='The server changed the submission to '+humanState(state)+'. Refresh the queue to continue.';row.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=true;});}));actions.append(control);}
  if(context.member.capabilities.some(c=>c==='verifier'||c.startsWith('reviewer:')))row.append(evidenceForm(context));
  const canRecord=context.member.capabilities.some(c=>c.startsWith('reviewer:'))&&version.state==='awaiting_review'||!required&&context.member.capabilities.includes('verifier');
  if(!canRecord){row.append(actions,feedback);list.append(row);continue;}
  const draft=input('review-file','file',false);draft.accept='.json,application/json';const record=button('Record inspected review','button-secondary');record.addEventListener('click',()=>void action(record,feedback,async()=>{const file=draft.files?.[0];if(!file){feedback.textContent='Choose a review draft prepared from your actual inspection.';return;}const value=JSON.parse(await file.text());const result=await context.api.json<{recordId:string}>('/api/versions/'+version.id+'/reviews',{method:'POST',body:JSON.stringify(value)});feedback.textContent='Review recorded against this exact version. Record ID: '+result.recordId+'. This is not publication.';}));
  row.append(actions,field('Review draft JSON',draft),el('p','muted','The backend assigns your authenticated identity. Do not put reviewer IDs or claimed authority in the draft. Upload evidence below and use its returned digest and byte count in the review draft.'),record,feedback);list.append(row);
 }
 return root;
}
function evidenceForm(context:Context){
 const panel=el('section','item',el('h3','','Inspection evidence')),file=input('evidence','file',false),upload=button('Upload review evidence','button-secondary'),feedback=status(),descriptor=el('pre','file-list');
 upload.addEventListener('click',()=>void action(upload,feedback,async()=>{const selected=file.files?.[0];if(!selected){feedback.textContent='Choose the file from your actual inspection.';return;}if(selected.size>2*1024*1024){feedback.textContent='Review evidence must be at most 2 MiB.';return;}const record=await uploadReviewEvidence(context.api,selected);descriptor.textContent=JSON.stringify({[selected.name]:record},null,2);feedback.textContent='Evidence uploaded privately. Add this descriptor to the matching review draft.';}));
 panel.append(field('Evidence file (up to 2 MiB)',file),upload,feedback,descriptor);return panel;
}
function revocationForm(context:Context){
 const panel=el('details','panel',el('summary','','Revoke a review record')),id=input('record'),reason=input('revocation-reason'),control=button('Revoke review record','button-secondary danger'),feedback=status();id.pattern='[a-f0-9]{64}';id.maxLength=64;reason.maxLength=1000;
 control.addEventListener('click',()=>void action(control,feedback,async()=>{if(!/^[a-f0-9]{64}$/.test(id.value.trim())||!reason.value.trim()){feedback.textContent='Enter the exact 64-character record ID and a reason.';return;}await revokeReview(context.api,id.value.trim(),reason.value);feedback.textContent='Review revoked. Any dependent approval must be checked again.';}));panel.append(el('p','muted','Use the exact record ID returned when the inspection was recorded. This invalidates its authority; the server checks dependent publication.'),field('Review record ID',id),field('Revocation reason',reason),control,feedback);return panel;
}
interface MemberRow {id:string;status:string;email:string;displayName:string;verified:boolean;capabilities:string[]}
export async function administration(context:Context){
 const root=el('section','',heading('Member administration','Capabilities and account restrictions are checked by the server on every protected request.')),form=el('form','search'),query=input('q','search',false),search=el('button','button-secondary','Find members'),results=el('div','list');search.type='submit';query.placeholder='Search by name or email';query.maxLength=100;query.setAttribute('aria-label','Search members');form.append(query,search);root.append(form,results,revocationForm(context),await addressBlocks(context));
 async function refresh(){
  results.replaceChildren(status('Loading members…'));
  try{const data=await context.api.json<{members:MemberRow[]}>('/api/admin/members?q='+encodeURIComponent(query.value));results.replaceChildren();if(!data.members.length)results.append(empty('No matching members.','Try a different name or email.'));
   for(const member of data.members){
    const row=el('article','panel',el('div','row',el('h2','',member.displayName||member.email),el('span','pill',member.status==='active'?'Active':'Suspended')),el('p','muted',member.email+(member.verified?' · verified':''))),feedback=status(),reason=input('reason','text',false);reason.placeholder='Reason for account change';reason.maxLength=1000;
    if(member.id===context.member.id){row.append(el('p','muted','Your own authority cannot be changed here.'));results.append(row);continue;}
    const toggle=button(member.status==='active'?'Suspend member':'Restore member','button-secondary danger');toggle.addEventListener('click',()=>void action(toggle,feedback,async()=>{if(!reason.value.trim()){feedback.textContent='Give a reason for the account change.';return;}await context.api.json('/api/admin/members/'+encodeURIComponent(member.id)+'/status',{method:'PUT',body:JSON.stringify({status:member.status==='active'?'suspended':'active',reason:reason.value.trim()})});await refresh();}));row.append(field('Reason',reason),toggle);
    const capabilities=[['moderator','Community moderator'],['verifier','Technical verifier'],['reviewer:visual','Visual reviewer'],['reviewer:portability','Portability reviewer'],['reviewer:executable-source','Source reviewer'],['publisher','Publisher'],['admin','Administrator']];
    for(const [capability,label] of capabilities){const check=input(capability!,'checkbox',false);check.checked=member.capabilities.includes(capability!);check.addEventListener('change',async()=>{check.disabled=true;try{await context.api.json('/api/admin/members/'+encodeURIComponent(member.id)+'/capabilities',{method:check.checked?'PUT':'DELETE',body:JSON.stringify({capability})});feedback.textContent='Capability updated.';}catch(error){check.checked=!check.checked;feedback.textContent=explain(error);}finally{check.disabled=false;}});const choice=field(label!,check);choice.classList.add('role-choice');choice.prepend(check);row.append(choice);}
    row.append(feedback);results.append(row);
   }
  }catch(error){results.replaceChildren(status(explain(error)));}
 }
 form.addEventListener('submit',event=>{event.preventDefault();void refresh();});await refresh();return root;
}

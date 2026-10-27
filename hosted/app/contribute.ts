import {el,input,field,button,status,heading,empty,action,humanState,when} from '../shared/dom.ts';
import {processingView} from './processing.ts';
import {explain} from '../shared/http.ts';
import {prepareUpload,resumeUpload,selectedFolder,UploadInputError,uploadManifest} from './upload.ts';
import type {Context,Version,VersionDetail,SubmissionSubject,VerificationProgress} from './types.ts';
async function readSubject(file:File|undefined){if(!file)throw new UploadInputError('Choose the exact sealed review subject JSON.');if(file.size>512*1024)throw new UploadInputError('The review subject exceeds 512 KiB.');const value=JSON.parse(await file.text()) as SubmissionSubject;uploadManifest(value);return value;}
function uploadError(error:unknown){return error instanceof UploadInputError?error.message:error instanceof SyntaxError?'The selected subject is not valid JSON.':explain(error);}
function progressView(title:string){
 const root=el('section','upload-progress'),summary=status(),meter=el('progress'),paths=el('details','',el('summary','','Files needing retry')),list=el('ul','file-list'),profile=el('p','muted');meter.setAttribute('aria-label','Verification progress for '+title);paths.append(list);root.append(summary,meter,profile,paths);
 return {root,update(value:VerificationProgress){meter.max=Math.max(1,value.totalFiles);meter.value=value.verifiedFiles;summary.textContent=value.uploadedFiles+' of '+value.totalFiles+' files uploaded. '+value.verifiedFiles+' of '+value.totalFiles+' files verified by the service. '+(value.totalBytes/1024/1024).toFixed(2)+' MiB total.';profile.textContent=value.profile==='legacy'?'Legacy progress profile. Submission still requires service-confirmed completion.':'Server readback receipts confirm the exact uploaded bytes.';const retry=[...new Set([...value.pendingPaths,...value.failedPaths])];list.replaceChildren(...retry.map(path=>el('li','',path+(value.failedPaths.includes(path)?' · verification failed':''))));paths.hidden=!retry.length;}};
}
export async function contribute(context:Context){
 let active=true;context.resources.add(()=>{active=false;});
 const root=el('section','',heading('Share something you made.','Submit original work with its verification evidence. Uploading creates a private draft; review and publication remain separate.'));
 const form=el('form','panel'),title=input('title'),asset=input('asset'),kind=el('select'),subject=input('subject','file'),folder=input('artifacts','file'),create=el('button','button','Upload private draft'),feedback=status(),initialProgress=progressView('new draft');
 title.maxLength=160;asset.maxLength=80;asset.pattern='[a-zA-Z0-9_-]+';asset.placeholder='my-garden-bench';subject.accept='.json,application/json';folder.multiple=true;folder.setAttribute('webkitdirectory','');create.type='submit';initialProgress.root.hidden=true;
 for(const [value,text] of [['recipe','Editable recipe'],['preset','Preset for a recipe']] as const){const option=el('option','',text);option.value=value;kind.append(option);}
 form.append(field('Model title',title),field('Model handle',asset),el('p','muted','A stable short name for versions of your model. Letters, numbers, hyphens and underscores.'),field('What are you submitting?',kind),field('Verified review subject JSON',subject),field('Verification output folder',folder),el('p','muted','Choose the unchanged sealed subject and its complete output folder. Up to 256 files including the report, 16 MiB total, 2 MiB per file. Empty files are included. Uploaded executable source is not run by this form.'),create,feedback,initialProgress.root);root.append(form);
 form.addEventListener('submit',event=>{event.preventDefault();void action(create,feedback,async()=>{
  let created=false;
  try{
   const selected=await readSubject(subject.files?.[0]);feedback.textContent='Checking the selected folder against all sealed file hashes…';const available=await prepareUpload(selected,selectedFolder(folder.files??[]));if(!active)return;
   const draft=await context.api.json<{id:string;state:string}>('/api/versions',{method:'POST',body:JSON.stringify({assetId:asset.value.trim(),title:title.value.trim(),kind:kind.value,subject:selected})});created=true;if(!active)return;initialProgress.root.hidden=false;
   const result=await resumeUpload(context.api,draft.id,selected,available,value=>{if(active)initialProgress.update(value);},(path,index,total)=>{feedback.textContent='Server verified '+index+' of '+total+' remaining files: '+path;},()=>active);
   if(active)feedback.textContent=result.verification.complete?'All '+result.verification.totalFiles+' files are verified. Submit this private draft below when you are ready for review.':'The draft is incomplete. Reselect its original folder below to resume unverified files.';
  }catch(error){if(active)feedback.textContent=uploadError(error);}finally{if(active&&created)await refresh();}
 });});
 const list=el('div','list');root.append(el('h2','','Your submissions'),list);
 async function refresh(){
  list.replaceChildren(status('Loading your submissions…'));
  try{
   const data=await context.api.json<{versions:Version[]}>('/api/account/versions');if(!active)return;list.replaceChildren();if(!data.versions.length)list.append(empty('No submissions yet.','Your private drafts and review status will appear here.'));
   for(const version of data.versions){
    const row=el('article','item',el('div','row',el('h3','',version.title),el('span','pill',humanState(version.state))),el('p','muted','Created '+when(version.created_at))),message=status(),controls=el('div','actions');list.append(row);
    try{
     const detail=await context.api.json<VersionDetail>('/api/versions/'+version.id);if(!active)return;if(!detail.verification)throw new UploadInputError('Verification progress is unavailable on this service. Refresh before uploading or submitting.');
     let verification=detail.verification;const view=progressView(version.title);view.update(verification);row.append(view.root);
     const required=detail.processing_requirement==='package-replay-v1';
     if(required&&detail.state!=='draft')row.append(await processingView(context,version.id,detail.state));if(!active)return;
     if(required&&detail.state==='changes_requested')row.append(el('p','muted','This version is sealed. Upload a corrected source package and fresh verification evidence as a new version using the form above.'));
     if(detail.state==='draft'||(!required&&detail.state==='changes_requested')){
      const submit=button('Submit for review');submit.disabled=!verification.complete;
      const update=(value:VerificationProgress)=>{verification=value;view.update(value);submit.disabled=!value.complete;};
      submit.addEventListener('click',()=>{void(async()=>{submit.disabled=true;try{const latest=await context.api.json<VersionDetail>('/api/versions/'+version.id);if(!active)return;update(latest.verification);if(!latest.verification.complete){message.textContent='The server has not verified every file. Resume the draft upload first.';return;}await context.api.json('/api/versions/'+version.id+'/transition',{method:'POST',body:JSON.stringify({state:'submitted'})});if(active)await refresh();}catch(error){if(active)message.textContent=uploadError(error);}finally{submit.disabled=!verification.complete;}})();});controls.append(submit);
      if(detail.state==='draft'&&!verification.complete){
       const reselect=input('resume-folder','file',false),resume=button('Resume file upload','button-secondary');reselect.multiple=true;reselect.setAttribute('webkitdirectory','');resume.disabled=true;reselect.addEventListener('change',()=>{resume.disabled=!reselect.files?.length;});
       resume.addEventListener('click',()=>void action(resume,message,async()=>{try{message.textContent='Checking the reselected folder against the unchanged subject…';const available=await prepareUpload(detail.subject,selectedFolder(reselect.files??[]));if(!active)return;const result=await resumeUpload(context.api,version.id,detail.subject,available,value=>{if(active)update(value);},(path,index,total)=>{message.textContent='Server verified '+index+' of '+total+' remaining files: '+path;},()=>active);if(active){message.textContent=result.verification.complete?'All files are verified. This private draft is ready to submit for review.':'The server still has unverified files. Retry with the original folder.';if(result.verification.complete)await refresh();}}catch(error){if(active)message.textContent=uploadError(error);}}));row.append(field('Resume folder for '+version.title,reselect),resume,el('p','muted','Reselect the original output folder after a reload or interruption. Only pending or failed files are sent again.'));
      }
     }
     if(['draft','submitted','published','changes_requested'].includes(detail.state)){const reason=input('reason','text',false);reason.placeholder='Reason for withdrawal';reason.setAttribute('aria-label','Reason to withdraw '+version.title);const withdraw=button('Withdraw','button-secondary');withdraw.addEventListener('click',()=>void action(withdraw,message,async()=>{if(!reason.value.trim()){message.textContent='Give a short reason for withdrawal.';return;}await context.api.json('/api/versions/'+version.id+'/transition',{method:'POST',body:JSON.stringify({state:'withdrawn',reason:reason.value.trim()})});if(active)await refresh();}));controls.append(reason,withdraw);}
    }catch(error){if(active)message.textContent=uploadError(error);}
    row.append(controls,message);
   }
  }catch(error){if(active)list.replaceChildren(status(uploadError(error)));}
 }
 await refresh();
 root.append(await (await import('./my-uploads.ts')).myUploads(context));
 return root;
}

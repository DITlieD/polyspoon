import {el,button,status,action,link} from '../shared/dom.ts';
import {explain,verifyArtifact} from '../shared/http.ts';
import type {Context,ProcessingJob} from './types.ts';

export function processingCopy(job:ProcessingJob|null,state:string){
 if(!job)return {title:'Waiting for technical processing',detail:'Refresh to check whether this submitted version has entered the processing queue.'};
 if(job.status==='failed'){
  const code=job.firstFailure?.code,detail=code==='required_case_unavailable'?'The required coverage cannot be processed. Update the source or supported coverage and create a corrected version with fresh verification evidence.':code==='output_limit_exceeded'||code==='capture_limit_exceeded'?'The generated evidence exceeds the processing limit. Reduce it and create a corrected version with fresh verification evidence.':'The submitted package or generated output failed technical checks. Create a corrected version with fresh verification evidence.';
  return {title:'Technical changes requested',detail};
 }
 if(job.status==='exhausted')return {title:'Processing needs support',detail:'Processing stopped after 3 attempts. Contact support with this version ID. Refresh does not start another attempt.'};
 if(job.status==='passed'&&job.ready&&state==='changes_requested')return {title:'Technical processing passed',detail:'Reviewers requested changes. Create a corrected version with fresh verification evidence.'};
 if(job.status==='passed')return job.ready?{title:'Technical processing passed',detail:'Publication also requires current visual, portability and source reviews.'}:{title:'Processing evidence needs attention',detail:'Current evidence or processor authorization needs verification. Approval remains unavailable.'};
 if(job.status==='running')return {title:'Technical processing is running',detail:'Attempt '+job.attempts+' of 3. Refresh checks the latest status.'};
 return {title:'Queued for technical processing',detail:job.firstFailure?'Processing could not finish. '+job.attempts+' of 3 attempts used. An available processor can retry this version.':'An available processor must claim this version. Refresh checks its latest status.'};
}
export async function processingView(context:Context,versionId:string,state:string,evidence=false){
 let active=true,revision=0;context.resources.add(()=>{active=false;revision++;});
 const root=el('section','item processing-status'),title=el('h3'),message=status(),failure=el('p','muted'),files=el('div','actions'),feedback=status(),refresh=button('Refresh processing','button-secondary');root.append(title,message,failure,files,refresh,feedback);root.setAttribute('aria-label','Technical processing status');
 async function update(){const current=++revision;try{const {job}=await context.api.json<{job:ProcessingJob|null}>('/api/versions/'+versionId+'/processing');if(!active||current!==revision)return;feedback.textContent='';const copy=processingCopy(job,state);title.textContent=copy.title;message.textContent=copy.detail;failure.textContent=job?.firstFailure?'Failure: '+job.firstFailure.code+' ('+job.firstFailure.check+').':'';files.replaceChildren();
  if(evidence&&job?.result){for(const [path,file] of Object.entries(job.result.artifacts)){const download=button('Download '+path,'button-secondary');download.addEventListener('click',()=>void action(download,feedback,async()=>{const bytes=await context.api.bytes('/api/versions/'+versionId+'/processing/files?path='+encodeURIComponent(path));await verifyArtifact(bytes,file);if(!active)return;const url=context.resources.create(new Blob([Uint8Array.from(bytes)],{type:file.media_type})),a=link('',url);a.download=path;a.click();feedback.textContent='Verified processing evidence ready: '+path+'.';}));files.append(download);}}
 }catch(error){if(active&&current===revision){feedback.textContent='';title.textContent='Processing status unavailable';message.textContent=explain(error);files.replaceChildren();}}}
 refresh.addEventListener('click',()=>void action(refresh,feedback,update));await update();return root;
}

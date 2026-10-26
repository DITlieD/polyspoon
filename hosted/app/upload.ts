import {verifyArtifact} from '../shared/http.ts';
import type {MarketplaceClient} from '../shared/http.ts';
import type {SubmissionSubject,VerificationProgress,VersionDetail} from './types.ts';
export class UploadInputError extends Error {}
export function uploadManifest(subject:SubmissionSubject){
 if(!subject||typeof subject.subjectId!=='string'||!subject.artifacts||!subject.report||Object.hasOwn(subject.artifacts,'report.json'))throw new UploadInputError('Choose the exact sealed review subject JSON.');
 const files={...subject.artifacts,'report.json':subject.report},entries=Object.entries(files);
 if(entries.length>256)throw new UploadInputError('A version can contain at most 256 verification files, including its report.');
 let total=0;
 for(const [path,file] of entries){
  if(!path||path.startsWith('/')||path.includes('\\')||path.split('/').some(part=>!part||part==='.'||part==='..')||!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0)throw new UploadInputError('The subject has an invalid file descriptor: '+path);
  if(file.bytes>2*1024*1024)throw new UploadInputError('A verification file exceeds 2 MiB: '+path);total+=file.bytes;
 }
 if(total>16*1024*1024)throw new UploadInputError('Verification files exceed the 16 MiB total limit. The sealed subject has not been changed.');
 return files;
}
export function selectedFolder(files:Iterable<File>){
 const result=new Map<string,File>();for(const file of files){const path=file.webkitRelativePath.split('/').slice(1).join('/');if(!path)continue;if(result.has(path))throw new UploadInputError('The selected folder contains a duplicate path: '+path);result.set(path,file);}return result;
}
export async function prepareUpload(subject:SubmissionSubject,files:Map<string,File>){
 for(const [path,record] of Object.entries(uploadManifest(subject))){const file=files.get(path);if(!file)throw new UploadInputError('The chosen folder is missing '+path+'. Select the original verification output folder.');try{await verifyArtifact(new Uint8Array(await file.arrayBuffer()),record);}catch{throw new UploadInputError('The chosen file does not match the sealed subject: '+path);}}
 return files;
}
export async function resumeUpload(api:MarketplaceClient,id:string,subject:SubmissionSubject,files:Map<string,File>,progress:(value:VerificationProgress)=>void,verified:(path:string,index:number,total:number)=>void=()=>{},active:()=>boolean=()=>true){
 const manifest=uploadManifest(subject);
 const fresh=async()=>{const detail=await api.json<VersionDetail>('/api/versions/'+encodeURIComponent(id));if(detail.subject.subjectId!==subject.subjectId)throw new UploadInputError('The saved version does not match this sealed subject.');const value=detail.verification;if(!value||!['receipts-v1','legacy'].includes(value.profile)||value.pendingPaths.length>256||value.failedPaths.length>256||[...value.pendingPaths,...value.failedPaths].some(path=>!Object.hasOwn(manifest,path)))throw new UploadInputError('The service returned unsupported verification progress. Refresh before trying again.');progress(value);return detail;};
 let detail=await fresh();if(detail.state!=='draft')throw new UploadInputError('Only private drafts can receive verification files.');const paths=[...new Set([...detail.verification.pendingPaths,...detail.verification.failedPaths])];
 try{
  for(let index=0;index<paths.length;index++){
   if(!active())return detail;const path=paths[index]!,file=files.get(path);if(!file)throw new UploadInputError('The chosen folder is missing '+path+'.');
   const bytes=await file.arrayBuffer();if(!active())return detail;
   const result=await api.json<{uploaded:boolean;verified?:boolean}>('/api/versions/'+encodeURIComponent(id)+'/artifacts?path='+encodeURIComponent(path),{method:'PUT',headers:{'content-type':'application/octet-stream'},body:bytes});
   if(!result.uploaded||result.verified!==true)throw new UploadInputError('The server has not confirmed verification for '+path+'. Refresh the draft before retrying.');
   if(!active())return detail;verified(path,index+1,paths.length);if((index+1)%8===0)detail=await fresh();
  }
 }catch(error){if(active())try{await fresh();}catch{}throw error;}
 if(active())detail=await fresh();return detail;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MarketplaceClient} from '../hosted/shared/http.ts';
import {uploadManifest,prepareUpload,resumeUpload,UploadInputError} from '../hosted/app/upload.ts';

const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const subject={subjectId:'original-subject',artifacts:{'a.txt':{sha256:digest('a'),bytes:1},'empty.log':{sha256:digest(''),bytes:0},'verified.txt':{sha256:digest('v'),bytes:1}},report:{sha256:digest('report'),bytes:6}};
const files=new Map([['a.txt',new File(['a'],'a.txt')],['empty.log',new File([],'empty.log')],['verified.txt',new File(['v'],'verified.txt')],['report.json',new File(['report'],'report.json')]]);
const progress=(pendingPaths:string[],failedPaths:string[]=[])=>({profile:'receipts-v1',totalFiles:4,totalBytes:8,uploadedFiles:4-pendingPaths.length,verifiedFiles:4-new Set([...pendingPaths,...failedPaths]).size,complete:!pendingPaths.length&&!failedPaths.length,pendingPaths,failedPaths});

test('unchanged original full subject retains all194files including9empty and exact bounds',async()=>{
 const original=JSON.parse(await readFile('evidence/revision14/final/bench-review-01/subject.json','utf8')),manifest=uploadManifest(original);assert.equal(Object.keys(manifest).length,194);assert.equal(Object.values(manifest).filter(file=>file.bytes===0).length,9);assert.equal(Object.values(manifest).reduce((sum,file)=>sum+file.bytes,0),12032698);
 assert.throws(()=>uploadManifest({...subject,artifacts:Object.fromEntries(Array.from({length:256},(_,i)=>['a'+i,subject.report]))}),UploadInputError);assert.throws(()=>uploadManifest({...subject,report:{...subject.report,bytes:2*1024*1024+1}}),/2 MiB/);
});

test('folder verification rejects a mismatch before any upload and preserves zero-byte files',async()=>{
 assert.equal((await prepareUpload(subject,files)).size,4);await assert.rejects(()=>prepareUpload(subject,new Map([...files,['a.txt',new File(['b'],'a.txt')]])),/a.txt/);await assert.rejects(()=>prepareUpload(subject,new Map()),/missing/);
});

test('resume uses authoritative union of pending and failed paths once and skips verified files',async()=>{
 const puts:string[]=[],messages:unknown[]=[];let current=progress(['a.txt','empty.log'],['a.txt']);const api=new MarketplaceClient('https://polyspoon.example',async(url,options)=>{
  const path=new URL(String(url));if(options?.method==='PUT'){const name=path.searchParams.get('path')!;puts.push(name);assert.ok(['a.txt','empty.log'].includes(name));current=progress(current.pendingPaths.filter(p=>p!==name),current.failedPaths.filter(p=>p!==name));return Response.json({uploaded:true,verified:true});}
  return Response.json({id:'version',state:'draft',subject,verification:current});
 });
 const result=await resumeUpload(api,'version',subject,files,value=>messages.push(value));assert.equal(result.verification.complete,true);assert.deepEqual(puts,['a.txt','empty.log']);assert.ok(messages.length>=2);
});

test('provider failure refreshes progress without declaring unverified bytes successful',async()=>{
 let reads=0;const api=new MarketplaceClient('https://polyspoon.example',async(_url,options)=>{if(options?.method==='PUT')return Response.json({error:'object_provider_unavailable'},{status:503});reads++;return Response.json({id:'version',state:'draft',subject,verification:progress(['a.txt'],['a.txt'])});});
 const observed:unknown[]=[];await assert.rejects(()=>resumeUpload(api,'version',subject,files,value=>observed.push(value)));assert.equal(reads,2);assert.equal((observed.at(-1) as {complete:boolean}).complete,false);
});

test('aggregate upload limit includes every manifest entry and report',()=>{
 const block={sha256:digest('block'),bytes:2*1024*1024};assert.throws(()=>uploadManifest({...subject,artifacts:Object.fromEntries(Array.from({length:8},(_,i)=>['block'+i,block]))}),/16 MiB/);
});

test('uploaded bytes without a server verification receipt do not advance verified progress',async()=>{
 let reads=0,confirmed=0;const api=new MarketplaceClient('https://polyspoon.example',async(_url,options)=>{if(options?.method==='PUT')return Response.json({uploaded:true});reads++;return Response.json({id:'version',state:'draft',subject,verification:progress(['a.txt'])});});
 const observed:unknown[]=[];await assert.rejects(()=>resumeUpload(api,'version',subject,files,value=>observed.push(value),()=>{confirmed++;}),/not confirmed verification/);assert.equal(confirmed,0);assert.equal(reads,2);assert.equal((observed.at(-1) as {complete:boolean}).complete,false);
});

test('a local file read finishing after disposal does not dispatch an upload',async()=>{
 let active=true,puts=0,finish:((bytes:ArrayBuffer)=>void)|undefined,start:()=>void=()=>{};const started=new Promise<void>(resolve=>{start=resolve;}),file=new File(['a'],'a.txt');Object.defineProperty(file,'arrayBuffer',{value:()=>{start();return new Promise<ArrayBuffer>(resolve=>{finish=resolve;});}});
 const api=new MarketplaceClient('https://polyspoon.example',async(_url,options)=>{if(options?.method==='PUT'){puts++;return Response.json({uploaded:true,verified:true});}return Response.json({id:'version',state:'draft',subject,verification:progress(['a.txt'])});});
 const pending=resumeUpload(api,'version',subject,new Map([...files,['a.txt',file]]),()=>{},()=>{},()=>active);await started;active=false;finish!(new Uint8Array([97]).buffer);const result=await pending;assert.equal(puts,0);assert.equal(result.verification.complete,false);
});

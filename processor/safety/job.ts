// Pull-only safety worker. It holds the scoped processor secret, calls OUT to the Worker to claim work, downloads
// the upload, analyses it in jails, and posts an immutable report. There is no listener, no webhook and no port;
// uploaders cannot reach it or pass it parameters. The report can route a model to the human queue or to an
// appealable auto-rejection. It cannot approve or publish anything (the Worker's triggers refuse that).
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {analyzeUpload,detectorsHash,type Deps} from './pipeline.ts';
import {runCanary,type CanaryResult} from './canary.ts';
import {parseThresholds} from './policy.ts';
import type {Thresholds} from './types.ts';
export interface Client{api:string;secret:string;fetch?:typeof fetch}
export interface ClaimedJob{attemptId:string;leaseId:string;uploadId:string;format:'glb'|'gltf';bytes:number;sha256:string;title:string;description:string|null;provenance:unknown}
async function call(c:Client,method:string,path:string,body?:BodyInit|object,headers:Record<string,string>={}){
 const isJson=body!==undefined&&!(body instanceof Uint8Array);
 const r=await (c.fetch??fetch)(c.api.replace(/\/$/,'')+path,{method,headers:{authorization:'Bearer '+c.secret,...(isJson?{'content-type':'application/json'}:body?{'content-type':'application/octet-stream'}:{}),...headers},body:isJson?JSON.stringify(body):body as BodyInit|undefined});
 if(!r.ok){let code='http_'+r.status;try{code=((await r.json()) as {error?:string}).error??code;}catch{}throw new Error('worker_'+code);}
 return r;
}
export async function fetchPolicy(c:Client):Promise<Thresholds>{const r=await call(c,'GET','/api/processor/safety/policy');const v=await r.json() as {policy:{thresholds:unknown}};return parseThresholds(v.policy.thresholds);}
export async function reportCanary(c:Client,result:CanaryResult){const r=await call(c,'POST','/api/processor/safety/canary',{policyVersion:result.policyVersion,detectorsHash:result.detectorsHash,passed:result.passed,detail:{fixtures:result.fixtures,results:result.results,notCovered:result.notCovered}});return (await r.json() as {id:string}).id;}
/** Canary first; a failure is recorded and the worker stops (returns 'halted') without claiming anything. */
export async function canaryGate(c:Client,thresholds:Thresholds,deps:Deps){const result=await runCanary(thresholds,deps);await reportCanary(c,result);return result;}
export async function runOnce(c:Client,deps:Deps,opts:{thresholds?:Thresholds;skipCanary?:boolean}={}):Promise<{status:'halted'|'idle'|'done';reason?:string;uploadId?:string;outcome?:string;canary?:CanaryResult}>{
 const thresholds=opts.thresholds??await fetchPolicy(c);
 let canary:CanaryResult|undefined;
 if(!opts.skipCanary){canary=await canaryGate(c,thresholds,deps);if(!canary.passed)return {status:'halted',reason:'canary_failed',canary};}
 const claim=await (await call(c,'POST','/api/processor/safety/claims',{idempotencyKey:randomUUID(),policyVersion:thresholds.version,detectorsHash:detectorsHash()})).json() as {job:ClaimedJob|null;reason?:string};
 if(!claim.job)return {status:claim.reason==='canary_required'||claim.reason==='policy_mismatch'?'halted':'idle',reason:claim.reason,canary};
 const job=claim.job,lease={'x-processor-lease':job.leaseId};
 const data=new Uint8Array(await (await call(c,'GET','/api/processor/safety/attempts/'+job.attemptId+'/file',undefined,lease)).arrayBuffer());
 if(data.length!==job.bytes||createHash('sha256').update(data).digest('hex')!==job.sha256)throw new Error('download_mismatch');
 const dir=await mkdtemp(join(tmpdir(),'safety-job-'));
 try{
  const file=join(dir,'upload.'+job.format);await writeFile(file,data,{mode:0o600});
  const analysis=await analyzeUpload(file,job.format,{title:job.title,description:job.description,provenance:job.provenance},thresholds,deps);
  for(const image of analysis.images)await call(c,'PUT','/api/processor/safety/attempts/'+job.attemptId+'/images/'+image.name,image.data,{...lease,'x-image-type':image.mime});
  if(analysis.normalized)await call(c,'PUT','/api/processor/safety/attempts/'+job.attemptId+'/normalized',analysis.normalized,lease);
  const routed=await (await call(c,'POST','/api/processor/safety/attempts/'+job.attemptId+'/report',{outcome:analysis.outcome,findings:analysis.findings,summary:analysis.summary},lease)).json() as {route:string};
  return {status:'done',uploadId:job.uploadId,outcome:analysis.outcome+'→'+routed.route,canary};
 }finally{await rm(dir,{recursive:true,force:true});}
}

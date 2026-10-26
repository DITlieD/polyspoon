import {lstat,readFile} from 'node:fs/promises';
import {isAbsolute,join,relative} from 'node:path';
import {buildAsset,disposeAsset,loadDesign,validationCases} from '../catalog/index.ts';
import {designInput} from '../catalog/appearance.ts';
import {descriptor} from '../catalog/index.ts';
import {verificationSnapshot,checkEvidence} from '../../scripts/recipe-verify-evidence.ts';
import {fileInventory} from '../../scripts/verification-run.ts';
import {contained,rejectSymlinks} from '../../scripts/recipe-verify-input.ts';
import type {PreparedVerification} from '../../scripts/recipe-verify-input.ts';
import {currentDeliveryRevision} from '../../scripts/recipe-package-identity.ts';
import {sha256} from '../../scripts/provenance.ts';
import {canonical,identity,withoutIdentity} from './identity.ts';
import {readBytes,readJson,safePath} from './files.ts';
import type {ReviewSubject,ReviewCase,ReviewView} from './types.ts';

function sourcePath(root:string,path:string){const value=isAbsolute(path)?relative(root,path):path;safePath(root,value);return value;}
async function readRun(root:string,run:string){
 const output=safePath(root,run);contained(join(root,'evidence'),output,'review run');await rejectSymlinks(output);if(!(await lstat(output)).isDirectory())throw Error('Expected run directory');
 try{await lstat(join(output,'report.pending.json'));throw Error('Pending report marker exists');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const bytes=await readBytes(output,'report.json'),report=JSON.parse(bytes.toString('utf8')),files=await fileInventory(output);
 for(const path of Object.keys(files))safePath(output,path);
 if(report.formatVersion!==1||canonical(report.files)!==canonical(files))throw Error('Run evidence inventory mismatch');
 return {output,bytes,report,files};
}
function caseFor(id:string,configuration:any):ReviewCase {
 const build=buildAsset(configuration.family,designInput(configuration));try{return {id,configurationHash:identity(configuration),parts:['model',...new Set(build.semantics.parts.flatMap(part=>[part.id,part.node]))]};}finally{disposeAsset(build);}
}
export async function sealReviewSubject(root:string,run:string):Promise<ReviewSubject>{
 const loaded=await readRun(root,run),{report,output,files}=loaded;
 if(report.status!=='technical-success'||report.firstFailure||!Array.isArray(report.stages)||!report.stages.length||report.stages.some((s:any)=>s.status!=='passed'||s.result?.outcome!=='passed'||s.result.exitCode!==0))throw Error('Only successful terminal verification may seal a subject');
 if(new Set(report.stages.map((s:any)=>s.id)).size!==report.stages.length)throw Error('Duplicate verification stages');
 if(!report.before||canonical(report.before)!==canonical(report.after))throw Error('Verification snapshot is missing or unstable');
 const meta=report.metadata;if(!meta||typeof meta.request!=='string'||!meta.request.trim()||typeof meta.behaviorTest!=='string')throw Error('Verification metadata missing');
 const selected=await readJson(output,'selected.design.json'),design=loadDesign(selected);if(canonical(design)!==canonical(selected)||canonical(meta.selectedDesign)!==canonical(design)||meta.family!==design.family||meta.version!==design.familyVersion)throw Error('Selected canonical design mismatch');
 if(meta.output&&sourcePath(root,meta.output)!==run)throw Error('Report run path mismatch');
 const test=sourcePath(root,meta.behaviorTest),configPath=meta.inputFile?join(root,sourcePath(root,meta.inputFile)):undefined;
 const prepared={root,output,family:design.family,design,request:meta.request,test:join(root,test),configPath,inputFileSha256:meta.inputFileSha256,timeoutMs:300000} as PreparedVerification;
 const snapshot=await verificationSnapshot(prepared);if(canonical(snapshot)!==canonical(report.before))throw Error('Verification source or input evidence is stale');
 for(const stage of report.stages)for(const key of ['stdout','stderr']){const path=relative(output,stage.result[key]);safePath(output,path);if(!Object.hasOwn(files,path))throw Error('Stage log is outside manifest');}
 const scope:ReviewSubject['scope']=meta.workflow==='recipe:verify'?'recipe-verification':'bounded-run';
 let deliveryRevision=currentDeliveryRevision;
 if(scope==='recipe-verification'){
  const expected=['typecheck','recipe-tests','behavior-test','validate','render','export','package','package-check'];if(canonical(report.stages.map((s:any)=>s.id))!==canonical(expected))throw Error('Recipe verification stages incomplete');
  const checks=await checkEvidence(prepared,snapshot);if(canonical(checks)!==canonical(report.checks))throw Error('Terminal evidence checks mismatch');deliveryRevision=checks.deliveryRevision;
 }
 const cases:ReviewCase[]=[caseFor('selected',design)],views:ReviewView[]=[];
 if(scope==='recipe-verification'){
  for(const c of validationCases(design.family))cases.push(caseFor('validation:'+c.id,descriptor(design.family).save(c.parameters)));
  const rendered=await readJson(output,'renders/manifest.json');
  for(const capture of rendered.captures){
   const preset=descriptor(design.family).presets.find(p=>capture.file==='preset-'+p.id+'-oblique.png'||capture.file===design.family+'-'+p.id+'.png');
   const caseId=capture.file.startsWith('selected-')?'selected':preset?'preset:'+preset.id:undefined;if(!caseId)throw Error('Unknown render case');
   if(!cases.some(c=>c.id===caseId))cases.push(caseFor(caseId,capture.configuration));views.push({caseId,view:capture.view,evidence:'renders/'+capture.file});
  }
 }
 const packageJson=await readJson(root,'package.json'),lock=await readJson(root,'package-lock.json'),dependencies:ReviewSubject['source']['dependencies']={};
 for(const [name,requested] of Object.entries({...packageJson.dependencies,...packageJson.devDependencies})){
  const version=lock.packages?.['node_modules/'+name]?.version;if(typeof requested!=='string'||typeof version!=='string')throw Error('Pinned dependency identity missing: '+name);dependencies[name]={requested,version};
 }
 const body={formatVersion:1 as const,kind:'review-subject' as const,scope,request:meta.request,recipe:{id:design.family,version:design.familyVersion,deliveryRevision},selectedDesign:design,run,report:{path:'report.json' as const,sha256:sha256(loaded.bytes),bytes:loaded.bytes.length},technical:{status:'technical-success' as const,stages:report.stages.map((s:any)=>s.id) as string[]},source:{sourceHash:snapshot.provenance.sourceHash,lockHash:snapshot.provenance.lockHash!,node:snapshot.provenance.node,dependencies,sources:snapshot.provenance.sources,verificationInputs:snapshot.verificationInputs},coverage:{cases,views},artifacts:files,artifactManifestHash:identity(files),limits:[...report.limits,...(scope==='bounded-run'?['Bounded run only; full recipe verification and publication are not established.']:[])]};
 const again=await readRun(root,run);if(sha256(again.bytes)!==body.report.sha256||canonical(again.files)!==canonical(files)||canonical(await verificationSnapshot(prepared))!==canonical(snapshot))throw Error('Evidence changed while sealing');
 return {...body,subjectId:identity(body)};
}
export async function verifySubjectEvidence(root:string,subject:ReviewSubject){
 if(subject.kind!=='review-subject'||subject.formatVersion!==1||subject.subjectId!==identity(withoutIdentity(subject as unknown as Record<string,unknown>,'subjectId'))||subject.artifactManifestHash!==identity(subject.artifacts))throw Error('Subject identity mismatch');
 const current=await sealReviewSubject(root,subject.run);if(canonical(current)!==canonical(subject))throw Error('Sealed subject differs from current evidence');return subject;
}
export async function retainFailedAttempt(root:string,run:string){
 const {report,bytes,files}=await readRun(root,run);if(!['failed','cancelled'].includes(report.status)||!report.firstFailure||typeof report.firstFailure.stage!=='string'||!report.firstFailure.stage.trim()||typeof report.firstFailure.error!=='string'||!report.firstFailure.error.trim()||!Array.isArray(report.stages))throw Error('Expected terminal failed or cancelled run');
 const body={formatVersion:1,kind:'failed-attempt',run,technicalStatus:report.status,firstFailure:report.firstFailure,report:{sha256:sha256(bytes),bytes:bytes.length},files,limits:['Retained failed attempt only; not a successful review subject or publication approval.']};return {...body,attemptId:identity(body)};
}

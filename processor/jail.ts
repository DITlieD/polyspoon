import {readFile,readdir,lstat,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {readPackageZip} from '../scripts/recipe-check.ts';
import {validatePackageFiles} from '../scripts/recipe-package-core.ts';
import {identity,withoutIdentity} from '../src/review/identity.ts';
import {sourcePackageFilename} from '../scripts/recipe-package-identity.ts';
import {createHash} from 'node:crypto';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const mode=process.argv[2];
class Failure extends Error{constructor(readonly code:string,detail=''){super(detail||code);}}
async function inputCheck(){
 const subject=await json('/input/subject.json');
 if(subject.subjectId!==identity(withoutIdentity(subject,'subjectId'))||subject.artifactManifestHash!==identity(subject.artifacts))throw new Failure('input_manifest_invalid','subject_identity');
 const descriptors={...subject.artifacts,'report.json':subject.report};
 for(const [path,record] of Object.entries(descriptors) as Array<[string,{sha256:string;bytes:number}]>){const bytes=await readFile('/input/files/'+path);if(bytes.length!==record.bytes||hash(bytes)!==record.sha256)throw new Failure('input_digest_mismatch','input_identity:'+path);}
 const source='packages/'+sourcePackageFilename(subject.recipe.id,subject.recipe.version,subject.recipe.deliveryRevision),archive=await readFile('/input/files/'+source),sources=readPackageZip(archive),manifest=validatePackageFiles(sources);
 if(manifest.recipe.id!==subject.recipe.id||manifest.recipe.version!==subject.recipe.version||manifest.deliveryRevision!==subject.recipe.deliveryRevision)throw new Failure('source_package_invalid','source_identity');
 const selected=await json('/input/files/selected.design.json');if(identity(selected)!==identity(subject.selectedDesign))throw new Failure('configuration_mismatch','selected_design_identity');
 const designs=new Map<string,unknown>();let nodes=0;
 function inspect(value:any,depth=0){if(++nodes>200000||depth>24)return;if(value&&typeof value==='object'){if(value.family===subject.recipe.id&&value.familyVersion===subject.recipe.version&&value.requested&&value.applied)designs.set(identity(value),value);for(const child of Object.values(value))inspect(child,depth+1);}}
 inspect(subject.selectedDesign);for(const path of Object.keys(descriptors).filter(path=>path.endsWith('.json')))inspect(await json('/input/files/'+path));
 const cases=subject.coverage.cases.map((value:any,index:number)=>({id:value.id,configHash:value.configurationHash,parts:value.parts,design:designs.get(value.configurationHash),file:'cases/'+String(index).padStart(3,'0')+'.glb'}));
 if(cases.length>64||cases.some((value:any)=>!value.design)){console.log(JSON.stringify({unsupported:'required_case_unavailable',requiredCaseIds:cases.map((value:any)=>value.id)}));return;}
 console.log(JSON.stringify({metadata:{binding:{subjectId:subject.subjectId,artifactManifestHash:subject.artifactManifestHash,reportSha256:subject.report.sha256,sourcePackageSha256:hash(archive),selectedDesignSha256:descriptors['selected.design.json'].sha256},cases,recipe:subject.recipe,sourceHash:manifest.provenance.sourceHash},sources}));
}
async function files(root:string){
 const result:Record<string,string>={};let total=0;
 async function walk(path:string,prefix=''){for(const entry of await readdir(path,{withFileTypes:true})){const name=prefix+entry.name,target=join(path,entry.name);if(entry.isSymbolicLink())throw new Failure('case_output_invalid','output_symlink');if(entry.isDirectory())await walk(target,name+'/');else{const stat=await lstat(target);if(!stat.isFile()||stat.size>2*1024*1024)throw new Failure('output_limit_exceeded','output_size');const bytes=await readFile(target);total+=bytes.length;if(total>4*1024*1024)throw new Failure('output_limit_exceeded','output_total');result[name]=bytes.toString('base64');}}}
 await walk(root);return result;
}
function command(args:string[]){const result=spawnSync('/usr/bin/node',args,{cwd:'/package',encoding:'utf8',maxBuffer:256*1024,timeout:110000,env:{PATH:'/usr/bin',HOME:'/tmp',TMPDIR:'/tmp',LANG:'C.UTF-8'}});if(result.error||result.status!==0){const code=result.error?.code==='ENOBUFS'?'capture_limit_exceeded':result.error?.code==='ETIMEDOUT'?'execution_deadline_exceeded':mode==='compile'?'compile_failed':'replay_process_failed';throw new Failure(code,'command_failed:'+String(result.status)+':'+String(result.error?.message??result.stderr).slice(0,1000));}}
async function compile(){const manifest=await json('/package/manifest.json');await mkdir('/out/compiled');const sources=Object.keys(manifest.files).filter(path=>path.endsWith('.ts'));command(['/deps/node_modules/typescript/bin/tsc','--ignoreConfig','--noCheck','--target','ES2023','--module','ESNext','--moduleResolution','Bundler','--rewriteRelativeImportExtensions','--rootDir','/package','--outDir','/out/compiled',...sources]);console.log(JSON.stringify({files:await files('/out/compiled')}));}
async function replay(){const metadata=await json('/input/metadata.json'),output:Record<string,string>={};for(let index=0;index<metadata.cases.length;index++){const item=metadata.cases[index],target='/out/'+String(index).padStart(3,'0')+'.glb';command(['/package/.recipe-build/runner.js','--config','/input/configs/'+String(index).padStart(3,'0')+'.json','--out',target]);const stat=await lstat(target).catch(error=>{throw new Failure(error.code==='ENOENT'?'case_output_missing':'case_output_invalid');});if(!stat.isFile()||stat.isSymbolicLink())throw new Failure('case_output_invalid');if(stat.size>2*1024*1024)throw new Failure('output_limit_exceeded');output[item.file]=(await readFile(target)).toString('base64');}console.log(JSON.stringify({files:output}));}
async function probe(){
 const {kind}=await json('/input/probe.json');
 if(kind==='escape'){
  const result=spawnSync('/usr/bin/processor-probe',[],{encoding:'utf8'});if(result.status!==0)throw Error('native_probe');
  const checks=JSON.parse(result.stdout),visible=[];for(const path of ['/home','/run/user','/proc/1/root/home'])try{await lstat(path);visible.push(path);}catch{}
  let writeErrno='';try{const fs=await import('node:fs/promises');await fs.writeFile('/usr/bin/write-probe','x');}catch(error:any){writeErrno=error.code;}
  const fds=[];for(const fd of await readdir('/proc/self/fd'))try{const fs=await import('node:fs/promises');fds.push(await fs.readlink('/proc/self/fd/'+fd));}catch{}
  const status=await readFile('/proc/self/status','utf8');console.log(JSON.stringify({checks,visible,writeErrno,capEff:status.match(/CapEff:\s*([0-9a-f]+)/)?.[1],noNewPrivs:status.match(/NoNewPrivs:\s*(\d+)/)?.[1],environmentKeys:Object.keys(process.env).sort(),canaryPresent:!!process.env.PROCESSOR_PARENT_CANARY,canaryFdVisible:fds.some(path=>path.includes('parent-canary'))}));
 }else if(kind==='output'){
  const fs=await import('node:fs/promises');let bytes=0,code='';try{for(let i=0;i<32;i++){await fs.writeFile('/out/'+i,Buffer.alloc(1024*1024,1));bytes+=1024*1024;}}catch(error:any){code=error.code;}console.log(JSON.stringify({bytes,code}));
 }else if(kind==='file'){
  let code='';try{const fs=await import('node:fs/promises');await fs.writeFile('/out/large',Buffer.alloc(3*1024*1024,1));}catch(error:any){code=error.code;}console.log(JSON.stringify({code}));
 }else if(kind==='memory'){const chunks=[];while(true)chunks.push(Buffer.alloc(64*1024*1024,1));}
 else if(kind==='wall'){while(true){}}
 else if(kind==='tasks'){
  const child=await import('node:child_process');const children:any[]=[];let failures=0;for(let i=0;i<80;i++){const process=child.spawn('/usr/bin/node',['-e','setTimeout(()=>{},10000)'],{stdio:'ignore'});process.on('error',()=>{failures++;});children.push(process);}await new Promise(resolve=>setTimeout(resolve,500));for(const process of children)process.kill('SIGKILL');console.log(JSON.stringify({failures,children:children.length}));
 }else if(kind==='survivor'){
  const child=await import('node:child_process');const process=child.spawn('/usr/bin/node',['-e',"setInterval(()=>require('node:fs').appendFileSync('/out/survivor','x'),20)"],{detached:true,stdio:'ignore'});process.unref();await new Promise(resolve=>setTimeout(resolve,250));const bytes=(await lstat('/out/survivor')).size;console.log(JSON.stringify({spawned:true,wroteBytes:bytes}));
 }else throw Error('unknown_probe');
}
async function main(){if(mode==='input-check')await inputCheck();else if(mode==='compile')await compile();else if(mode==='replay-a'||mode==='replay-b')await replay();else if(mode==='probe')await probe();else throw Error('unknown_phase');}
main().catch(error=>{console.error(String(error.message));const fallback=mode==='input-check'?'source_package_invalid':mode==='compile'?'compile_failed':'replay_process_failed';console.log(JSON.stringify({failureCode:error instanceof Failure?error.code:fallback}));process.exitCode=1;});

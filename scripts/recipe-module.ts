import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, lstat, readdir, open, rename, unlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import { catalog, descriptor, buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';
import { collectSources, pinnedDependencies, sha256, declarationFor } from './recipe-package-core.ts';
import { controlMetadata } from '../src/engine/parameters.ts';
import type { Control } from '../src/engine/parameters.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
function parameterType(control:Control):string {
  if(control.kind==='choice')return control.options.map(option=>JSON.stringify(option.value)).join(' | ');
  if(control.kind==='toggle')return 'boolean';
  if(control.kind==='color')return '`#${string}`';
  return 'number';
}
function declarations(controls:Control[],metadata:unknown) {
  return [
    "import type { Group } from 'three';",
    'export interface Parameters {',
    ...controls.map(control=>'  '+JSON.stringify(control.key)+'?: '+parameterType(control)+';'),
    "  appearance?: { version: 1; palette: 'None' | 'Reduced4' | 'GameBoy' | 'PICO8' | 'CGA' | 'Mono'; shading: 'None' | 'Toon3bands' | 'Flat'; partColors: Record<string, `#${string}`> };",
    '}',
    'type ReadonlyMetadata<T> = { readonly [Key in keyof T]: T[Key] extends object ? ReadonlyMetadata<T[Key]> : T[Key] };',
    'export declare const metadata: ReadonlyMetadata<'+JSON.stringify(metadata)+'>;',
    'export interface AssetGroup extends Group { dispose(): void }',
    'export declare function createAsset(parameters?: Parameters): AssetGroup;',
    'export declare function disposeAsset(root: AssetGroup): void;',
    'export declare function setJointPose(root: Group, id: string, angleDegrees: number): void;',
    '',
  ].join('\n');
}
function entry(source:{entry:string;exportName:string},metadata:unknown) {
  return [
    "export { setJointPose } from './src/catalog/semantics.ts';",
    "import { buildRecipeAsset, disposeAsset as disposeBuild } from './src/catalog/build.ts';",
    'import { '+source.exportName+' as selectedRecipe } from '+JSON.stringify('./'+source.entry)+';',
    'function freeze(value){if(value && typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}',
    'export const metadata=freeze('+JSON.stringify(metadata)+');',
    'export function createAsset(parameters={}){const build=buildRecipeAsset(selectedRecipe,parameters);build.root.userData.design=structuredClone(build.config);let disposed=false;Object.defineProperty(build.root,"dispose",{value(){if(!disposed){disposed=true;disposeBuild(build);}}});return build.root;}',
    'export function disposeAsset(root){root.dispose();}',
  ].join('\n');
}
const releaseMembers=['asset.mjs','asset.d.mts','metadata.json','README.md','semantic-contract.md','LICENSE','NOTICE','THIRD-PARTY.txt','example.html'];
export interface ProceduralReleaseEntry {
  id:string;version:string;url:string;sha256:string;bytes:number;
  dependencies:{three:string};configuration:{kind:string};
  files:Record<string,{sha256:string;bytes:number}>;
}
export interface PublishedProceduralRelease {entry:ProceduralReleaseEntry;files:Record<string,string>}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
async function checkModulePath(path:string){
  for(let current=resolve(path);;current=dirname(current)){
    try{if((await lstat(current)).isSymbolicLink())throw new Error('Symlink module path: '+current);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(current===dirname(current))break;
  }
}
export async function readPublishedProceduralReleases(directory:string):Promise<PublishedProceduralRelease[]> {
  const indexPath=join(resolve(directory),'index.json');await checkModulePath(indexPath);
  let text:string;
  try{
    const stat=await lstat(indexPath);if(!stat.isFile()||stat.size>4*1024*1024)throw new Error('Invalid published module index');
    text=await readFile(indexPath,'utf8');
  }catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    try{if((await readdir(directory)).length)throw new Error('Published module index missing');}catch(missing){if((missing as NodeJS.ErrnoException).code!=='ENOENT')throw missing;}
    return [];
  }
  const index:unknown=JSON.parse(text);
  if(!record(index)||index.formatVersion!==1||!Array.isArray(index.packages)||index.packages.length>512)throw new Error('Invalid published module index');
  const releases:PublishedProceduralRelease[]=[],identities=new Set<string>();
  for(const item of index.packages){
    if(!record(item)||typeof item.id!=='string'||! /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(item.id)||typeof item.version!=='string'||! /^\d+\.\d+\.\d+$/.test(item.version)||item.url!=='procedural-modules/'+item.id+'/'+item.version+'/asset.mjs'||typeof item.sha256!=='string'||! /^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.bytes)||Number(item.bytes)<=0||!record(item.dependencies)||item.dependencies.three!==pinnedDependencies.three||Object.keys(item.dependencies).length!==1||!record(item.configuration)||item.configuration.kind!=='default'||Object.keys(item.configuration).length!==1||!record(item.files))throw new Error('Invalid published module entry');
    const identity=item.id+'@'+item.version;if(identities.has(identity))throw new Error('Duplicate published module identity');identities.add(identity);
    if(JSON.stringify(Object.keys(item.files).sort())!==JSON.stringify([...releaseMembers].sort()))throw new Error('Invalid published module members');
    const files:Record<string,string>={};
    for(const [name,expected] of Object.entries(item.files)){
      if(!record(expected)||typeof expected.sha256!=='string'||! /^[a-f0-9]{64}$/.test(expected.sha256)||!Number.isSafeInteger(expected.bytes)||Number(expected.bytes)<0||Number(expected.bytes)>4*1024*1024)throw new Error('Invalid published module member metadata');
      const path=join(directory,item.id,item.version,name);await checkModulePath(path);const stat=await lstat(path);
      if(!stat.isFile()||stat.size!==expected.bytes)throw new Error('Published module member size mismatch: '+path);
      const bytes=await readFile(path);if(sha256(bytes)!==expected.sha256)throw new Error('Published module member digest mismatch: '+path);
      files[name]=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    }
    const module=item.files['asset.mjs'];
    if(!record(module)||module.bytes!==item.bytes||module.sha256!==item.sha256)throw new Error('Published module index payload mismatch');
    const metadata:unknown=JSON.parse(files['metadata.json']!);
    if(!record(metadata)||metadata.formatVersion!==1||metadata.id!==item.id||metadata.version!==item.version||!record(metadata.dependencies)||metadata.dependencies.three!==pinnedDependencies.three||Object.keys(metadata.dependencies).length!==1||!record(metadata.configuration)||metadata.configuration.kind!=='default'||Object.keys(metadata.configuration).length!==1)throw new Error('Published module metadata identity mismatch');
    releases.push({entry:item as unknown as ProceduralReleaseEntry,files});
  }
  return releases;
}
export function filesForProceduralRelease(id:string,version:string,generated:Record<string,string>,published:readonly PublishedProceduralRelease[]):Record<string,string> {
  const release=published.find(p=>p.entry.id===id&&p.entry.version===version);
  if(!release)return generated;
  for(const name of releaseMembers.filter(name=>name!=='README.md'&&name!=='semantic-contract.md'))if(generated[name]!==release.files[name])throw new Error('Procedural module payload changed; recipe version change required: '+id+'@'+version+' '+name);
  return release.files;
}
async function publishProceduralReleases(output:string,releases:PublishedProceduralRelease[]){
  const target=resolve(output),missing:{path:string;content:string}[]=[];
  for(const release of releases)for(const [name,content] of Object.entries(release.files)){
    const path=join(target,release.entry.id,release.entry.version,name);await checkModulePath(path);
    try{
      const stat=await lstat(path);
      if(!stat.isFile()||stat.size!==Buffer.byteLength(content)||sha256(await readFile(path))!==sha256(content))throw new Error('Immutable procedural artifact conflict: '+path);
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;missing.push({path,content});}
  }
  const indexPath=join(target,'index.json');await checkModulePath(indexPath);
  try{if(!(await lstat(indexPath)).isFile())throw new Error('Invalid procedural output index');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  for(const {path,content} of missing){await mkdir(dirname(path),{recursive:true});await checkModulePath(path);await writeFile(path,content,{flag:'wx'});}
  const index={formatVersion:1,packages:releases.map(release=>release.entry)},text=JSON.stringify(index,null,2)+'\n';
  try{if(await readFile(indexPath,'utf8')===text)return index;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await mkdir(target,{recursive:true});await checkModulePath(target);
  const temporary=join(target,'.index-'+randomUUID()+'.tmp'),handle=await open(temporary,'wx');
  try{await handle.writeFile(text);await handle.close();await rename(temporary,indexPath);}
  finally{await handle.close();try{await unlink(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  return index;
}
export async function buildProceduralModules(output=join(root,'public/procedural-modules'),options:{retainPublished?:boolean}={}){
  const published=await readPublishedProceduralReleases(join(root,'public/procedural-modules'));
  if(options.retainPublished&&!published.length)throw new Error('Missing published module records');
  const declarationsMetadata=JSON.parse(await readFile(join(root,'docs/contributing/source-packages.json'),'utf8'));
  const projectLicense=await readFile(join(root,'LICENSE'),'utf8');
  const projectNotice=await readFile(join(root,'NOTICE'),'utf8');
  const thirdPartyLicense=await readFile(join(root,'node_modules/three/LICENSE'),'utf8');
  const installed=JSON.parse(await readFile(join(root,'node_modules/three/package.json'),'utf8'));
  if(installed.version!==pinnedDependencies.three)throw new Error('Installed Three version differs from pinned dependency');
  const prepared:PublishedProceduralRelease[]=[];
  for(const item of catalog){
    const d=descriptor(item.id),r=recipe(d.id);
    const exported=await import(pathToFileURL(join(root,r.source.entry)).href);
    if(exported[r.source.exportName]!==r)throw new Error('Registered recipe source/export mismatch: '+d.id);
    if(options.retainPublished){
      const existing=published.find(release=>release.entry.id===d.id&&release.entry.version===d.version);
      if(existing){prepared.push(existing);continue;}
      try{await lstat(join(root,'public/procedural-modules',d.id,d.version));throw new Error('Missing published module record: '+d.id+'@'+d.version);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    }
    const licensing=declarationFor(declarationsMetadata,d.id);
    const sources=await collectSources(root,[r.source.entry,'src/catalog/build.ts']);
    const sourceFiles=Object.fromEntries(Object.entries(sources).sort(([a],[b])=>a.localeCompare(b)).map(([path,text])=>[path,sha256(text)]));
    const defaultBuild=buildAsset(d.id);
    const semantics=structuredClone(defaultBuild.semantics);disposeAsset(defaultBuild);
    const metadata={formatVersion:1,semantics,id:d.id,version:d.version,title:d.title,description:d.description,controls:controlMetadata(d.controls),defaults:d.defaults,presets:d.presets,palettes:d.palettes,constraints:r.constraints,dependencies:{three:pinnedDependencies.three},configuration:{kind:'default'},source:{...r.source,sha256:sha256(JSON.stringify(sourceFiles)),files:sourceFiles},licenses:{software:'Apache-2.0',content:licensing.contentLicense,thirdParty:'Three ConvexGeometry/ConvexHull and BufferGeometryUtils MIT; see THIRD-PARTY.txt'}};
    const virtual=join(root,'procedural-entry.mjs');
    const bundle=await rolldown({input:virtual,external:['three'],plugins:[{name:'procedural-entry',resolveId(source){if(source===virtual)return virtual;},load(id){if(id===virtual)return entry(r.source,metadata);}}]});
    let code:string;
    try {
      const result=await bundle.generate({format:'es',minify:true,comments:{legal:true,annotation:false,jsdoc:false}});
      if(result.output.length!==1||result.output[0]!.type!=='chunk')throw new Error('Procedural module must be a single chunk');
      code='/*\n'+projectLicense+'\n'+projectNotice+'\n'+thirdPartyLicense+'*/\n'+result.output[0]!.code;
    }finally{await bundle.close();}
    const relative=d.id+'/'+d.version+'/';
    const generated:Record<string,string>={
      'asset.mjs':code,'asset.d.mts':declarations(d.controls,metadata),'metadata.json':JSON.stringify(metadata,null,2)+'\n',
      'README.md':await readFile(join(root,'docs/authoring/procedural-modules.md'),'utf8'),
      'semantic-contract.md':await readFile(join(root,'docs/authoring/semantic-contract.md'),'utf8'),
      'LICENSE':await readFile(join(root,'LICENSE'),'utf8'),'NOTICE':await readFile(join(root,'NOTICE'),'utf8'),'THIRD-PARTY.txt':thirdPartyLicense,
      'example.html':'<!doctype html><meta charset="utf-8"><title>'+d.title+' procedural module</title><script type="importmap">'+JSON.stringify({imports:{three:'./three.module.js'}})+'</script><script type="module">import * as THREE from "three";import {createAsset,disposeAsset,metadata} from "./asset.mjs";const root=createAsset();globalThis.proceduralExample={root,disposeAsset,metadata,synchronous:root instanceof THREE.Group};document.body.textContent=root.name+": "+root.children.length+" children, synchronous "+(root instanceof THREE.Group);</script>\n',
    };
    const files=filesForProceduralRelease(d.id,d.version,generated,published);
    const existing=published.find(p=>p.entry.id===d.id&&p.entry.version===d.version);
    const selected=existing?.entry??{id:d.id,version:d.version,url:'procedural-modules/'+relative+'asset.mjs',sha256:sha256(code),bytes:Buffer.byteLength(code),dependencies:metadata.dependencies,configuration:metadata.configuration,files:Object.fromEntries(Object.entries(files).map(([name,text])=>[name,{sha256:sha256(text),bytes:Buffer.byteLength(text)}]))};
    prepared.push({entry:selected,files});
  }
  return publishProceduralReleases(output,prepared);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length&&!(args.length===2&&args[0]==='--out'))throw new Error('Use --out directory');
  buildProceduralModules(args[1],{retainPublished:true}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
}

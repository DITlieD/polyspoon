// Safe, parallel-friendly batch generator for catalog asset candidates.
// Each worker writes only inside its own --out directory, never deletes,
// resumes idempotently (existing asset dirs are skipped), dedupes, gates every
// asset through glTF validation + geometry QA, and exits non-zero on any failure.
// Everything it writes is status "prepared-not-submitted"; nothing is published.
import './node-platform.ts';
import { mkdir, readFile, writeFile, readdir, access, rename } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { validateBytes } from 'gltf-validator';
import { catalog, buildAsset, disposeAsset, descriptor } from '../src/catalog/index.ts';
import { exportDeliverable } from '../src/catalog/delivery.ts';
import { inspectGeometry, geometrySnapshot } from '../src/lantern/inspect.ts';
import { recipe } from '../src/recipes/index.ts';
import { convertGlbReport, readGlb, exportFormats, type ExportFormat } from '../src/formats/index.ts';
import { geometryQa, nearDuplicate, categoryBudgets, type GeometrySignature } from '../src/formats/qa.ts';
import { controlsDocument } from '../src/formats/controls.ts';
import { sha256, sourceProvenance } from './provenance.ts';
import type { Parameters } from '../src/engine/parameters.ts';

const usage='forge-batch --worker ID --out DIR [--families all|a,b] [--presets all|a,b] [--palettes all|preset|a,b] [--variants N] [--vary 0.15] [--formats all|glb,obj,fbx,usdz] [--shard i/n] [--limit N] [--dedupe-against DIR,DIR] [--facet-floor 0|1|2 (default 1)] [--allow-recolors] [--render] [--dry-run] [--jobs FILE.json: explicit [{family,slug,parameters,preset?,replaces?,note?}] instead of the matrix]';
const flags=new Set(['--render','--dry-run','--allow-recolors']),valued=new Set(['--worker','--out','--families','--presets','--palettes','--variants','--vary','--formats','--shard','--limit','--dedupe-against','--facet-floor','--jobs']);
export function parseArgs(argv:string[]){
 const o=new Map<string,string>();
 for(let i=0;i<argv.length;i++){const k=argv[i]!;if(flags.has(k)){o.set(k,'1');continue;}const v=argv[i+1];if(!valued.has(k)||v===undefined||v.startsWith('--')||o.has(k))throw new Error('Invalid argument '+k+'\n'+usage);o.set(k,v);i++;}
 const worker=o.get('--worker'),out=o.get('--out');
 if(!worker||!/^[a-z0-9][a-z0-9-]{0,40}$/.test(worker))throw new Error('--worker must be a short [a-z0-9-] id\n'+usage);
 if(!out)throw new Error('--out is required\n'+usage);
 const list=(k:string,d:string)=>(o.get(k)??d).split(',').map(s=>s.trim()).filter(Boolean);
 const shard=(o.get('--shard')??'0/1').split('/').map(Number);if(shard.length!==2||!shard.every(Number.isInteger)||shard[1]!<1||shard[0]!<0||shard[0]!>=shard[1]!)throw new Error('--shard must be i/n with 0<=i<n');
 const facetFloor=Number(o.get('--facet-floor')??'1');if(![0,1,2].includes(facetFloor))throw new Error('--facet-floor must be 0, 1 or 2');
 const variants=Number(o.get('--variants')??'0'),vary=Number(o.get('--vary')??'0.15'),limit=Number(o.get('--limit')??'0');
 if(!Number.isInteger(variants)||variants<0||variants>50)throw new Error('--variants must be 0..50');if(!(vary>=0&&vary<=0.5))throw new Error('--vary must be 0..0.5');if(!Number.isInteger(limit)||limit<0)throw new Error('--limit must be a non-negative integer');
 const formats=list('--formats','all').flatMap(f=>f==='all'?['glb','obj','fbx','usdz']:[f]);if(formats.some(f=>f!=='glb'&&!(f in exportFormats)))throw new Error('--formats accepts glb,obj,fbx,usdz,all');
 return {worker,facetFloor,out:resolve(out),families:list('--families','all'),presets:list('--presets','all'),palettes:list('--palettes','preset'),variants,vary,formats:[...new Set(formats)],shard:shard as [number,number],limit,dedupeAgainst:list('--dedupe-against','').map(p=>resolve(p)),allowRecolors:o.has('--allow-recolors'),jobsFile:o.get('--jobs'),render:o.has('--render'),dryRun:o.has('--dry-run')};
}
type Options=ReturnType<typeof parseArgs>;
function lcg(seed:number){let s=seed>>>0||1;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const hash32=(text:string)=>parseInt(sha256(text).slice(0,8),16);
export interface Job {family:string;preset:string;palette:string;variant:number;slug:string;parameters:Parameters;replaces?:string;note?:string}
/** Explicit job list (targeted regeneration, e.g. review fixes). Each entry is validated against its family's controls up front. */
export function explicitJobs(list:unknown):Job[]{
 if(!Array.isArray(list)||!list.length)throw new Error('--jobs must be a non-empty JSON array');
 const seen=new Set<string>();
 return list.map((raw,i)=>{
  const j=raw as Record<string,unknown>,family=String(j.family??''),slug=String(j.slug??''),parameters=(j.parameters??{}) as Parameters;
  if(!catalog.some(d=>d.id===family))throw new Error('--jobs['+i+']: unknown family '+family);
  if(!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)||seen.has(family+'/'+slug))throw new Error('--jobs['+i+']: slug must be a unique [a-z0-9-] id');seen.add(family+'/'+slug);
  descriptor(family).save(parameters);
  return {family,slug,parameters,preset:String(j.preset??'custom'),palette:String(j.palette??'custom'),variant:0,...(typeof j.replaces==='string'?{replaces:j.replaces}:{}),...(typeof j.note==='string'?{note:j.note}:{})};
 });
}
/** Deterministic family x preset x palette x variant matrix. Variant 0 is the exact preset; others jitter shape controls within --vary of their range. */
export function planJobs(o:Pick<Options,'families'|'presets'|'palettes'|'variants'|'vary'|'shard'|'limit'>&{facetFloor?:number}):Job[]{
 const families=o.families.includes('all')?catalog.map(d=>d.id):o.families;
 const jobs:Job[]=[];
 for(const family of families){
  const d=descriptor(family);
  const presets=o.presets.includes('all')?d.presets:d.presets.filter(p=>o.presets.includes(p.id));
  const hasColorway=d.controls.some(c=>c.key==='colorway');
  for(const preset of presets){
   const palettes=o.palettes.includes('preset')||!d.palettes.length?[null]:d.palettes.filter(p=>o.palettes.includes('all')||o.palettes.includes(p.id));
   for(const palette of palettes){
    // A palette that is also a colorway option sets colorway AND its explicit colors (tree palettes carry foliage colors the colorway alone never reached).
    const base:Parameters={...preset.parameters,...(palette?{...(hasColorway&&(d.controls.find(c=>c.key==='colorway') as {options?:Array<{value:unknown}>}|undefined)?.options?.some(x=>x.value===palette.id)?{colorway:palette.id}:{}),...(palette.parameters??{})}:{})};
    // Facet-grade floor: very low-facet stones (e.g. boulder facetGrade 0) look out of place beside the rest of the catalog.
    const facet=d.controls.find(c=>c.key==='facetGrade');
    if(facet&&(o.facetFloor??1)>0)base.facetGrade=Math.max(Number(Object.hasOwn(base,'facetGrade')?base.facetGrade:d.defaults.facetGrade),o.facetFloor??1);
    for(let variant=0;variant<=o.variants;variant++){
     let parameters=base;
     if(variant>0){
      let found:Parameters|undefined;
      for(let attempt=0;attempt<12&&!found;attempt++){
       const random=lcg(hash32([family,preset.id,palette?.id??'',variant,attempt].join('|'))),next:Parameters={...base};
       for(const c of d.controls){
        if(c.kind!=='range'&&c.kind!=='integer')continue;
        const current=Number(Object.hasOwn(next,c.key)?next[c.key]:d.defaults[c.key]);
        if(c.unit==='seed'){next[c.key]=Math.floor(random()*(c.max-c.min+1))+c.min;continue;}
        if(c.group!=='shape'&&c.kind==='range')continue;
        const span=c.max-c.min,raw=current+(random()*2-1)*o.vary*span,stepped=c.min+Math.round((Math.min(c.max,Math.max(c.min,raw))-c.min)/c.step)*c.step;
        next[c.key]=c.kind==='integer'?Math.round(stepped):Number(stepped.toFixed(6));
       }
       try{d.save(next);if(withinLimits(family,next))found=next;}catch{}
      }
      if(!found)continue;parameters=found;
     }
     const slug=[preset.id,palette?.id??'preset',variant?('v'+variant):'base'].join('--');
     jobs.push({family,preset:preset.id,palette:palette?.id??'preset',variant,slug,parameters});
    }
   }
  }
 }
 const sharded=jobs.filter((_,i)=>i%o.shard[1]===o.shard[0]);
 return o.limit?sharded.slice(0,o.limit):sharded;
}
/** Real-world size sanity per family, beyond the category range: [axis or 'longest', min, max] meters. */
export const familyScale:Record<string,{axis:0|1|2|'longest';min:number;max:number;label:string}>={
 'stylized-fox':{axis:'longest',min:0.6,max:1.45,label:'nose-to-tail length'},
 'stylized-humanoid':{axis:1,min:1.5,max:1.95,label:'standing height'},
 'rigged-rabbit':{axis:'longest',min:0.25,max:0.95,label:'longest extent (nose-to-tail or ear tips)'},
 'slime':{axis:1,min:0.25,max:1.6,label:'height'},
};
export function scaleProblem(family:string,bounds:{min:number[];max:number[]}):string|undefined{
 const rule=familyScale[family];if(!rule)return;
 const dims=bounds.max.map((v,i)=>v-bounds.min[i]!),value=rule.axis==='longest'?Math.max(...dims):dims[rule.axis]!;
 return value<rule.min||value>rule.max?family+' '+rule.label+' '+value.toFixed(2)+' m is outside the plausible '+rule.min+'..'+rule.max+' m':undefined;
}
/** Variants must stay inside the QA triangle budget (with 5% headroom) and size range of their category. */
export function withinLimits(family:string,parameters:Parameters):boolean{
 const budget=categoryBudgets[recipe(family).presentation.category];if(!budget)return true;
 const build=buildAsset(family,parameters);
 try{const g=inspectGeometry(build.root),dims=g.bounds.max.map((v,i)=>v-g.bounds.min[i]!),largest=Math.max(...dims);
  return !g.errors.length&&!scaleProblem(family,g.bounds)&&g.triangles<=budget.triangles*0.95&&largest>=budget.minSize&&largest<=budget.maxSize&&Math.abs(g.bounds.min[1]!)<=0.005;}
 finally{disposeAsset(build);}
}
const exists=(p:string)=>access(p).then(()=>true,()=>false);
async function guardOut(o:Options){
 const parts=relative(process.cwd(),o.out);
 if(!parts.startsWith('..')&&!isAbsolute(parts)&&/^(src|scripts|examples)(\/|$)/.test(parts))throw new Error('--out must not be inside src/, scripts/ or examples/ (it would change the source hash)');
 const marker=join(o.out,'.forge-worker');
 if(await exists(o.out)){
  const entries=await readdir(o.out);
  if(entries.length&&!(await exists(marker)))throw new Error(o.out+' exists and is not a forge output dir; refusing to write into it');
  if(await exists(marker)){const owner=(await readFile(marker,'utf8')).trim();if(owner!==o.worker)throw new Error(o.out+' belongs to worker '+owner+', not '+o.worker);}
 }
 await mkdir(o.out,{recursive:true});await writeFile(marker,o.worker+'\n');
}
interface IndexEntry {family:string;slug:string;dir:string;glbSha256:string;geometryHash:string;signature:GeometrySignature;status:string}
/**
 * Known assets for dedupe from any folder layout: forge index.json files, and
 * every *.glb found recursively (seeds/out, batch1 assets/, plan.json dirs...).
 * GLBs get their signature computed directly; the family comes from a sibling
 * manifest/design JSON, else the nearest folder named after a catalog family.
 */
export async function priorEntries(dirs:string[]):Promise<IndexEntry[]>{
 const out:IndexEntry[]=[],seen=new Set<string>(),families=new Set(catalog.map(d=>d.id));
 const familyFor=async(dir:string,file:string,root:string)=>{
  for(const name of await readdir(dir))if(name.endsWith('.json')){try{const j=JSON.parse(await readFile(join(dir,name),'utf8')),f=j.family??j.configuration?.family??j.design?.family;if(typeof f==='string'&&families.has(f))return {family:f as string,geometryHash:typeof j.geometryHash==='string'?j.geometryHash:''};}catch{}}
  for(const part of relative(root,join(dir,file)).split('/').reverse())for(const f of families)if(part===f||part.startsWith(f+'-')||part.startsWith(f+'--')||part===f+'.glb')return {family:f,geometryHash:''};
  return {family:file.replace(/\.glb$/,''),geometryHash:''};
 };
 const walk=async(root:string,dir:string,depth:number):Promise<void>=>{
  if(depth>8)return;let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}
  for(const e of entries){
   const path=join(dir,e.name);
   if(e.isDirectory()){if(!['node_modules','.git','.stale','.tmp','.failed','renders'].includes(e.name))await walk(root,path,depth+1);continue;}
   if(!e.name.endsWith('.glb'))continue;
   try{const bytes=new Uint8Array(await readFile(path)),hash=sha256(bytes);if(seen.has(hash))continue;seen.add(hash);
    const {family,geometryHash}=await familyFor(dir,e.name,root);
    out.push({family,slug:e.name,dir:path,glbSha256:hash,geometryHash,signature:geometryQa(bytes,{category:'Props'}).signature,status:'prepared-not-submitted'});
   }catch{}
  }
 };
 for(const dir of dirs)await walk(dir,dir,0);
 // Candidates a reviewer already superseded (status in the folder's index.json) are history, not live competition for dedupe.
 for(const dir of dirs){let index;try{index=JSON.parse(await readFile(join(dir,'index.json'),'utf8'));}catch{continue;}
  for(const a of Array.isArray(index?.assets)?index.assets:[])if(a?.status==='superseded')for(const rel of [a.dir,a.name&&'assets/'+a.name].filter((x:unknown):x is string=>typeof x==='string'&&!!x)){const prefix=join(dir,rel)+'/';for(const e of out)if(e.dir.startsWith(prefix))e.status='superseded';}}
 return out;
}
async function main(){
 const o=parseArgs(process.argv.slice(2)),jobs=o.jobsFile?explicitJobs(JSON.parse(await readFile(o.jobsFile,'utf8'))):planJobs(o);
 if(o.dryRun){console.log(JSON.stringify(jobs.map(j=>({family:j.family,slug:j.slug,parameters:j.parameters})),null,1));console.error(jobs.length+' jobs');return;}
 await guardOut(o);
 const provenance=await sourceProvenance(),known:IndexEntry[]=[...await priorEntries(o.dedupeAgainst.filter(d=>d!==o.out))];
 const indexPath=join(o.out,'index.json'),previous=(await exists(indexPath))?JSON.parse(await readFile(indexPath,'utf8')).assets as IndexEntry[]:[];
 // Every earlier entry is kept (failures too, for the record); failed jobs are retried and their old entries marked retried.
 const results:Array<IndexEntry&{errors?:string[];warnings?:string[];reason?:string;retried?:boolean}>=[...previous];
 known.push(...previous.filter(p=>p.status==='prepared-not-submitted'&&!known.some(k=>k.glbSha256===p.glbSha256)));
 let failures=0;
 for(const job of jobs){
  const dir=join(o.out,job.family,job.slug),rel=relative(o.out,dir);
  if(results.some(r=>r.dir===rel&&r.status!=='failed')){console.log('skip (already done) '+rel);continue;}
  for(const r of results)if(r.dir===rel&&r.status==='failed')r.retried=true;
  if(await exists(dir)){const stale=join(o.out,'.stale',job.family+'--'+job.slug+'-'+Date.now());await mkdir(join(o.out,'.stale'),{recursive:true});await rename(dir,stale);console.log('redo (unindexed partial dir moved to '+relative(o.out,stale)+') '+rel);}
  const final=dir,work=join(o.out,'.tmp',job.family+'--'+job.slug+'-'+process.pid);
  const r=recipe(job.family),category=r.presentation.category,errors:string[]=[],warnings:string[]=[];
  let build;try{build=buildAsset(job.family,job.parameters);}catch(error){failures++;results.push({family:job.family,slug:job.slug,dir:rel,glbSha256:'',geometryHash:'',signature:null as never,status:'failed',errors:['build: '+(error as Error).message]});console.log('FAIL build '+rel+': '+(error as Error).message);continue;}
  try{
   const inspected=inspectGeometry(build.root);errors.push(...inspected.errors.slice(0,10));
   const glb=await exportDeliverable(build,{stripUnusedUvs:true}),validation=await validateBytes(glb,{uri:'model.glb',maxIssues:100});
   if(validation.issues.numErrors||validation.issues.numWarnings)errors.push('glTF validator: '+validation.issues.numErrors+' errors, '+validation.issues.numWarnings+' warnings');
   const qa=geometryQa(glb,{category});errors.push(...qa.errors);warnings.push(...qa.warnings);
   const scale=scaleProblem(job.family,qa.bounds);if(scale)errors.push(scale);
   // Visual-defect gate: z-fighting coplanar overlaps and floating parts block new candidates.
   errors.push(...qa.warnings.filter(w=>/coplanar overlap|floating part|interpenetrating part|layout defect/.test(w)));
   const glbSha256=sha256(glb),geometryHash=sha256(JSON.stringify(geometrySnapshot(build.root)));
   // A fix that replaces an earlier candidate is compared against everything except the candidate it replaces.
   const [rBatch,...rRest]=(job.replaces??'').split('/'),replaced=(k:IndexEntry)=>!!job.replaces&&k.dir.includes('/'+rBatch+'/')&&k.dir.includes('/'+rRest.join('/')+'/');
   const live=(k:IndexEntry)=>k.status!=='superseded'&&!replaced(k);
   const exact=known.find(k=>live(k)&&(k.glbSha256===glbSha256||(!!k.geometryHash&&k.geometryHash===geometryHash))),near=o.allowRecolors?undefined:known.find(k=>live(k)&&k.family===job.family&&k.signature&&nearDuplicate(k.signature,qa.signature));
   if(!errors.length&&(exact||near)){results.push({family:job.family,slug:job.slug,dir:rel,glbSha256,geometryHash,signature:qa.signature,status:'skipped-duplicate',reason:(exact?'exact duplicate of ':'near duplicate of ')+(exact??near)!.dir});console.log('dup  '+rel+' ~ '+(exact??near)!.dir);continue;}
   if(errors.length){failures++;results.push({family:job.family,slug:job.slug,dir:rel,glbSha256,geometryHash,signature:qa.signature,status:'failed',errors,warnings});console.log('FAIL '+rel+': '+errors.join('; '));continue;}
   await mkdir(work,{recursive:true});
   const stem=join(work,job.family);await writeFile(stem+'.glb',glb,{flag:'wx'});
   const formats:Record<string,{file:string;sha256:string;bytes:number}>={glb:{file:job.family+'.glb',sha256:glbSha256,bytes:glb.byteLength}},skippedFormats:Record<string,string>={};
   const lossy=readGlb(glb).dropped,rigged=lossy.some(l=>l.startsWith('skins')||l==='animations');
   for(const f of o.formats){
    if(f==='glb')continue;
    if(rigged){skippedFormats[f]='rigged/animated asset: '+f+' would drop '+lossy.join('; ')+' (GLB only until the converter carries skins/animations)';continue;}
    const {bytes}=convertGlbReport(glb,f as ExportFormat,job.family);
    if(bytes.byteLength<64)throw new Error(f+' conversion produced '+bytes.byteLength+' bytes');
    if(f==='fbx'&&new TextDecoder().decode(bytes.subarray(0,18))!=='Kaydara FBX Binary')throw new Error('fbx header invalid');
    if((f==='obj'||f==='usdz')&&new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true)!==0x04034b50)throw new Error(f+' zip header invalid');
    const file=job.family+exportFormats[f as ExportFormat].extension;await writeFile(join(work,file),bytes,{flag:'wx'});formats[f]={file,sha256:sha256(bytes),bytes:bytes.byteLength};
   }
   await writeFile(join(work,'design.json'),JSON.stringify(build.config,null,2)+'\n',{flag:'wx'});
   await writeFile(join(work,'controls.json'),JSON.stringify(controlsDocument({design:build.config,glb}),null,2)+'\n',{flag:'wx'});
   let renders:string|undefined;
   if(o.render){const {renderRecipe}=await import('./recipe-render.ts');await renderRecipe({family:job.family,output:resolve(work,'renders'),config:resolve(work,'design.json'),presets:false});renders='renders/';}
   const manifest={status:'prepared-not-submitted',note:'Candidate only. Requires independent human review; not approved or published.',worker:o.worker,family:job.family,familyVersion:build.config.familyVersion,title:r.descriptor.title,category,preset:job.preset,palette:job.palette,variant:job.variant,parameters:job.parameters,...(job.replaces?{replaces:job.replaces}:{}),...(job.note?{fixNote:job.note}:{}),
    triangles:qa.triangles,bounds:qa.bounds,signature:qa.signature,qa:{errors:qa.errors,warnings:qa.warnings,openEdges:qa.openEdges,combinedOpenEdges:qa.combinedOpenEdges,zFight:qa.zFight,floating:qa.floating,nonManifoldEdges:qa.nonManifoldEdges,degenerateTriangles:qa.degenerateTriangles},validator:validation.issues,
    glbSha256,geometryHash,formats,skippedFormats,derivedFormatLosses:lossy,renders,sourceSha256:provenance.sourceHash};
   await writeFile(join(work,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
   await mkdir(join(final,'..'),{recursive:true});await rename(work,final);
   const entry={family:job.family,slug:job.slug,dir:rel,glbSha256,geometryHash,signature:qa.signature,status:'prepared-not-submitted',warnings};
   results.push(entry);known.push(entry);
   console.log('ok   '+rel+' '+qa.triangles+' tris'+(warnings.length?' ('+warnings.length+' warnings)':''));
  }catch(error){if(await exists(work)){await mkdir(join(o.out,'.failed'),{recursive:true});await rename(work,join(o.out,'.failed',job.family+'--'+job.slug+'-'+Date.now()));}failures++;results.push({family:job.family,slug:job.slug,dir:rel,glbSha256:'',geometryHash:'',signature:null as never,status:'failed',errors:[(error as Error).message]});console.log('FAIL '+rel+': '+(error as Error).message);}
  finally{disposeAsset(build);}
  await writeFile(indexPath,JSON.stringify({worker:o.worker,note:'prepared-not-submitted candidates; nothing published',sourceSha256:provenance.sourceHash,assets:results},null,2)+'\n');
 }
 await writeFile(indexPath,JSON.stringify({worker:o.worker,note:'prepared-not-submitted candidates; nothing published',sourceSha256:provenance.sourceHash,assets:results},null,2)+'\n');
 const count=(s:string)=>results.filter(r=>r.status===s).length;
 console.log(JSON.stringify({worker:o.worker,out:o.out,prepared:count('prepared-not-submitted'),duplicates:count('skipped-duplicate'),failed:count('failed')}));
 if(failures)process.exitCode=1;
}
import { pathToFileURL } from 'node:url';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});

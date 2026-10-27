// The safety-v1 analysis for one upload, run by the trusted processor parent:
//   sandboxed parse (no network) → jailed render + image detectors → jailed OCR → text scan → monotonic merge
//   → optional LLM second opinion (stricter only).
// Every stage that crashes, times out or is skipped adds an `analysis_incomplete` reason, which routes the model to a
// human with a flag. Nothing in here can produce an approval.
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {SandboxResult} from '../ingest-sandbox.ts';
import {IMAGE_CLASSIFIERS,nsfwStub} from './detectors.ts';
import {NSFW_DETECTOR} from './nsfw-model-id.ts';
import {LLM_DETECTOR,type LlmResult} from './llm.ts';
import {mergeOutcome} from './policy.ts';
import type {RenderResult} from './render.ts';
import {INSTRUCTION_DETECTOR,TEXT_DETECTOR,scanText} from './text.ts';
import type {DetectorInfo,Finding,Outcome,SafetyImage,TextHit,Thresholds} from './types.ts';
import {OCR_DETECTOR} from './ocr.ts';
export interface Deps{
 ingest(file:string,format:'glb'|'gltf'):Promise<SandboxResult>;
 render(file:string,maxImages:number):Promise<RenderResult>;
 ocr(images:SafetyImage[]):Promise<{texts:{image:string;text:string}[];failed:number;languages:string[]}>;
 llm(images:SafetyImage[],strings:string[]):Promise<LlmResult>;
}
export interface UploadMeta{title:string;description:string|null;provenance:unknown}
export interface Analysis{outcome:Outcome;findings:Finding[];images:SafetyImage[];normalized?:Uint8Array|null;summary:Record<string,unknown>}
const here=dirname(fileURLToPath(import.meta.url));
export const DETECTORS:DetectorInfo[]=[
 {id:'render-v1',version:'1',real:true,categories:[],note:'Headless three.js in a no-network, cgroup-limited jail: 14 views lit+unlit, normal/wireframe passes, 9 slices, backface, 126 saliency-chosen close-ups at two zoom levels, island close-ups, texture tiles, normalized.glb re-encode.'},
 {id:NSFW_DETECTOR,version:'1',real:true,categories:['sexual'],note:'NSFWJS MobileNetV2 (open weights, bundled) on TensorFlow.js inside the jail; score = porn + hentai + 0.5·sexy. Trained on photos/drawings: a coarse signal on low-poly renders.'},
 ...IMAGE_CLASSIFIERS.map(c=>c.info),
 {id:OCR_DETECTOR,version:'1',real:true,categories:['slur_text','sexual','hate_symbol'],note:'Tesseract in a no-network, cgroup-limited jail, English + Japanese (eng+jpn traineddata).'},
 {id:TEXT_DETECTOR,version:'1',real:true,categories:['slur_text','sexual','hate_symbol'],note:'Normalised wordlist match (EN+JA) over file strings, title, description, provenance and OCR.'},
 {id:INSTRUCTION_DETECTOR,version:'1',real:true,categories:['suspicious_instructions'],note:'Instruction-like text aimed at an AI reviewer flags the model.'},
 {id:'geometry-visibility-v1',version:'1',real:true,categories:['hidden_geometry'],note:'Islands never visible from 14 outside views are hidden geometry; tiny detached parts get close-ups.'},
 {id:LLM_DETECTOR,version:'1',real:true,categories:['sexual','child_like','hate_symbol','slur_text','violence','suspicious_instructions'],note:'Vision LLM via the zenov antigravity bridge (OpenAI-compatible; model from ANTIGRAVITY_BRIDGE_MODEL, Gemini Flash low effort). Live cover for sexual/child-like. Stricter-only; unreachable → flag.'},
];
/** Pins detector identities AND the exact source of the safety code + wordlist, so any change needs a fresh canary. */
export function detectorsHash(){
 const h=createHash('sha256');h.update(JSON.stringify(DETECTORS.map(d=>[d.id,d.version,d.real])));
 // The bundled NSFW weights are part of the detector identity too.
 try{h.update('nsfwjs@'+JSON.parse(readFileSync(join(here,'../../node_modules/nsfwjs/package.json'),'utf8')).version);}catch{h.update('nsfwjs@missing');}
 for(const f of readdirSync(here).filter(f=>/\.(ts|json)$/.test(f)).sort())h.update(f+'\0').update(readFileSync(join(here,f)));
 return h.digest('hex');
}
function provenanceStrings(v:unknown,out:string[]=[],depth=0){if(depth>6||out.length>200)return out;if(typeof v==='string')out.push(v.slice(0,200));else if(Array.isArray(v))v.forEach(x=>provenanceStrings(x,out,depth+1));else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){out.push(k.slice(0,80));provenanceStrings(x,out,depth+1);}return out;}
export async function analyzeUpload(file:string,format:'glb'|'gltf',meta:UploadMeta,thresholds:Thresholds,deps:Deps):Promise<Analysis>{
 const incomplete:string[]=[],started=Date.now();
 const ingest=await deps.ingest(file,format).catch(()=>({ok:false as const,reason:'sandbox_failed'}));
 const metaItems=[{source:'title',text:meta.title},...(meta.description?[{source:'description',text:meta.description}]:[]),...provenanceStrings(meta.provenance).map(text=>({source:'provenance',text}))];
 if(!ingest.ok){
  // The jail itself failing is not evidence against the file: fail closed to a human, don't auto-reject.
  const infra=['sandbox_unavailable','sandbox_timeout','sandbox_failed'].includes(ingest.reason);if(infra)incomplete.push('ingest:'+ingest.reason);
  const textHits=scanText(metaItems);
  const merged=mergeOutcome({thresholds,imageScores:[],textHits,geometry:{hidden:0,tiny:0},incomplete,invalidFile:infra?null:ingest.reason});
  return {...merged,images:[],summary:summary(thresholds,merged.outcome,merged.findings,{ingest:{ok:false,reason:ingest.reason},incomplete,ms:Date.now()-started})};
 }
 let render:RenderResult|null=null;
 try{render=await deps.render(file,thresholds.maxImages);}catch(e){incomplete.push('render_failed');}
 if(render){if(render.truncated)incomplete.push('image_budget_exhausted');if(render.errors.length)incomplete.push('render_errors:'+[...new Set(render.errors)].join(',').slice(0,120));}
 const images=render?.images??[];
 let ocr={texts:[] as {image:string;text:string}[],failed:0,languages:[] as string[]};
 if(images.length){try{ocr=await deps.ocr(images);if(ocr.failed===-1)incomplete.push('ocr_unavailable');else if(ocr.failed>0)incomplete.push('ocr_failed:'+ocr.failed);}catch{incomplete.push('ocr_failed');}}
 const items=[...ingest.strings.map(text=>({source:'file',text})),...metaItems,...ocr.texts.map(t=>({source:'ocr:'+t.image,text:t.text}))];
 const textHits:TextHit[]=scanText(items);
 const imageScores=[...(render?.scores??[])];
 const llm=await deps.llm(images,items.map(i=>i.text)).catch(()=>({used:true,ok:false,reason:'llm_failed'}) as LlmResult);
 if(llm.used&&!llm.ok)incomplete.push(llm.reason);
 if(llm.used&&llm.ok){imageScores.push(...llm.scores);if(llm.suspicious)textHits.push({category:'suspicious_instructions',severity:'context',term:'llm',source:'llm',span:'second opinion reported instruction-like content',detector:LLM_DETECTOR});if(llm.slurText>=thresholds.flag.hate_symbol)textHits.push({category:'slur_text',severity:'context',term:'llm',source:'llm',span:'second opinion reported offensive text',detector:LLM_DETECTOR});}
 const merged=mergeOutcome({thresholds,imageScores,textHits,geometry:{hidden:render?.geometry.hidden??0,tiny:render?.geometry.tiny??0,hiddenArtifacts:render?.geometry.closeups},incomplete,invalidFile:null});
 // A category is machine-checked when a real detector for it actually ran. The NSFW classifier can fail to load in
 // the jail (then the renderer reports nsfw_unavailable and its stub stands in); the vision LLM covers everything.
 const nsfwRan=!!render?.nsfw?.ok;
 const stubbed=[...DETECTORS.filter(d=>!d.real).flatMap(d=>d.categories),...(nsfwRan?[]:nsfwStub.info.categories)];
 const notMachineChecked=llm.used&&llm.ok?[]:[...new Set(stubbed)];
 return {...merged,images,normalized:render?.normalized??null,summary:summary(thresholds,merged.outcome,merged.findings,{ingest:{ok:true,triangles:ingest.triangles,nodes:ingest.nodes,images:ingest.images,strings:ingest.strings.length},render:render?{images:images.length,kinds:countKinds(images),nsfw:render.nsfw??null,normalized:render.normalized?render.normalized.length:null,geometry:render.geometry,textures:render.textures,truncated:render.truncated}:null,ocr:{images:ocr.texts.length,failed:ocr.failed,languages:ocr.languages},llm:llm.used?{used:true,ok:llm.ok,model:typeof llm.model==='string'?llm.model.slice(0,80):null}:{used:false,reason:llm.reason},coverage:{notMachineChecked,ocrLanguages:ocr.languages},incomplete,ms:Date.now()-started})};
}
function countKinds(images:SafetyImage[]){const c:Record<string,number>={};for(const i of images)c[i.kind]=(c[i.kind]??0)+1;return c;}
function summary(t:Thresholds,outcome:Outcome,findings:Finding[],extra:Record<string,unknown>){return {schema:'safety-report-v1',policyVersion:t.version,enforce:t.enforce,outcome,detectors:DETECTORS.map(d=>({id:d.id,real:d.real})),detectorsHash:detectorsHash(),findingCount:findings.length,findings,...extra};}

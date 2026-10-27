// Parent side of rendering: bundles render-page.ts, starts Chromium inside the no-network jail, hands it the file
// bytes, and validates everything that comes back (names, image magic bytes, size caps, score ranges) before use.
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readFile,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromeLauncher} from './jail.ts';
import type {ImageKind,ImageScore,SafetyImage} from './types.ts';
export interface RenderResult{normalized?:Uint8Array|null;nsfw?:{ok:boolean;backend:string|null;inputs:number};timing?:Record<string,number>;images:SafetyImage[];scores:ImageScore[];truncated:boolean;errors:string[];geometry:{islands:number;hidden:number;tiny:number;closeups:string[];splitIslands:boolean;triangles:number};textures:number}
const here=dirname(fileURLToPath(import.meta.url));
let bundle:Promise<string>|null=null;
export function pageBundle(){bundle??=build({entryPoints:[here+'/render-page.ts'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,logLevel:'silent',loader:{'.wasm':'binary'}}).then(r=>r.outputFiles[0]!.text);return bundle;}
const KINDS=new Set<ImageKind>(['view-lit','view-unlit','pass-normal','pass-wireframe','slice','backface','grid-crop','island','texture-tile']);
export const IMAGE_NAME=/^[a-z0-9][a-z0-9-]{0,98}$/;
export const MAX_IMAGE_BYTES=2*1024*1024;
export function imageMime(data:Uint8Array):'image/png'|'image/jpeg'|null{
 if(data.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v))return 'image/png';
 if(data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff)return 'image/jpeg';return null;
}
export const MAX_NORMALIZED_BYTES=50*1024*1024;
/** A GLB container header: magic 'glTF', version 2, declared length equal to the byte length. */
export function isGlb(d:Uint8Array){if(d.length<20)return false;const v=new DataView(d.buffer,d.byteOffset,d.byteLength);return v.getUint32(0,true)===0x46546c67&&v.getUint32(4,true)===2&&v.getUint32(8,true)===d.length;}
type RawImage={name:unknown;kind:unknown;mime:unknown;b64:unknown;width:unknown;height:unknown;scores:unknown};
/** Validates the jail's declared output. Anything unexpected is dropped and reported as an error (→ incomplete). */
export function acceptRenderOutput(raw:unknown,maxImages:number):RenderResult{
 const r=raw as {images?:RawImage[];truncated?:unknown;errors?:unknown;geometry?:Record<string,unknown>;textures?:unknown;normalized?:unknown;nsfw?:Record<string,unknown>;timing?:Record<string,unknown>};
 if(!r||!Array.isArray(r.images))throw new Error('render_output_invalid');
 const images:SafetyImage[]=[],scores:ImageScore[]=[],errors:string[]=Array.isArray(r.errors)?r.errors.filter((e):e is string=>typeof e==='string').map(e=>e.slice(0,80)).slice(0,20):[];const names=new Set<string>();
 for(const item of r.images.slice(0,maxImages)){
  if(typeof item?.name!=='string'||!IMAGE_NAME.test(item.name)||names.has(item.name)||!KINDS.has(item.kind as ImageKind)||typeof item.b64!=='string'||item.b64.length>MAX_IMAGE_BYTES*1.4){errors.push('image_rejected');continue;}
  const data=new Uint8Array(Buffer.from(item.b64,'base64')),mime=imageMime(data);
  if(!mime||mime!==item.mime||data.length>MAX_IMAGE_BYTES||!Number.isInteger(item.width)||!Number.isInteger(item.height)||Number(item.width)>4096||Number(item.height)>4096){errors.push('image_rejected');continue;}
  names.add(item.name);images.push({name:item.name,kind:item.kind as ImageKind,mime,data,width:Number(item.width),height:Number(item.height)});
  for(const s of Array.isArray(item.scores)?item.scores.slice(0,8):[]){const v=s as ImageScore;if(['sexual','child_like','hate_symbol','violence'].includes(v?.category)&&typeof v.score==='number'&&v.score>=0&&v.score<=1&&typeof v.detector==='string'&&/^[a-z0-9-]{1,60}$/.test(v.detector)){const bbox=Array.isArray(v.bbox)&&v.bbox.length===4&&v.bbox.every(n=>Number.isInteger(n)&&n>=0&&n<=8192)?v.bbox as [number,number,number,number]:undefined;scores.push({image:item.name,category:v.category,score:v.score,detector:v.detector,...(bbox?{bbox}:{})});}}
 }
 if(r.images.length>maxImages)errors.push('image_budget_exhausted');
 const g=r.geometry??{},int=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0?Number(v):0;
 let normalized:Uint8Array|null=null;
 if(typeof r.normalized==='string'&&r.normalized.length<=MAX_NORMALIZED_BYTES*1.4){const d=new Uint8Array(Buffer.from(r.normalized,'base64'));if(isGlb(d)&&d.length<=MAX_NORMALIZED_BYTES)normalized=d;else errors.push('normalized_rejected');}
 const nsfw={ok:r.nsfw?.ok===true,backend:typeof r.nsfw?.backend==='string'&&/^[a-z]{1,12}$/.test(r.nsfw.backend)?r.nsfw.backend:null,inputs:Number.isSafeInteger(r.nsfw?.inputs)?Number(r.nsfw!.inputs):0};
 const timing:Record<string,number>={};for(const k of ['views','crops','nsfw'])if(Number.isSafeInteger(r.timing?.[k]))timing[k]=Number(r.timing![k]);
 return {normalized,nsfw,timing,images,scores,truncated:r.truncated===true||r.images.length>maxImages,errors,geometry:{islands:int(g.islands),hidden:int(g.hidden),tiny:int(g.tiny),closeups:Array.isArray(g.closeups)?g.closeups.filter((n):n is string=>typeof n==='string'&&names.has(n)).slice(0,32):[],splitIslands:g.splitIslands===true,triangles:int(g.triangles)},textures:int(r.textures)};
}
export async function renderInJail(file:string,maxImages:number,timeoutMs=8*60_000):Promise<RenderResult>{
 const launcher=chromeLauncher(),data=await readFile(file),script=await pageBundle();
 const browser=await chromium.launch({executablePath:launcher,headless:true,timeout:60_000,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-gpu-sandbox','--js-flags=--max-old-space-size=2048']});
 const timer=setTimeout(()=>{void browser.close().catch(()=>{});},timeoutMs);
 try{
  const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1});
  await page.route('**/*',route=>route.abort());
  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0"></body>');await page.addScriptTag({content:script});
  const raw=await page.evaluate(([b64,max])=>(window as unknown as {safetyRender(b:string,m:number):Promise<unknown>}).safetyRender(b64 as string,max as number),[data.toString('base64'),maxImages] as const);
  return acceptRenderOutput(raw,maxImages);
 }finally{clearTimeout(timer);await browser.close().catch(()=>{});await rm(dirname(launcher),{recursive:true,force:true});}
}

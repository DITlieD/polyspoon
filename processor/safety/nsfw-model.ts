// REAL NSFW image classifier (nsfw-mobilenet-v2-v1): the open-weights NSFWJS MobileNetV2 model (224×224, classes
// Drawing/Hentai/Neutral/Porn/Sexy) on TensorFlow.js. Runs INSIDE the jailed, network-less Chromium next to the
// renderer; the weights are bundled into the page script (no fetch, nothing loaded at runtime). The model was trained
// on photos and drawings, so on low-poly renders it is a coarse signal: it feeds flag/reject bands like any other
// detector and humans still review every model. Score = P(porn) + P(hentai) + 0.5·P(sexy), clamped to 0..1.
import * as tf from '@tensorflow/tfjs';
import {setWasmPaths} from '@tensorflow/tfjs-backend-wasm';
import wasmPlain from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm';
import wasmSimd from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm';
import {load} from 'nsfwjs/core';
import {MobileNetV2Model} from 'nsfwjs/models/mobilenet_v2';
import {NSFW_DETECTOR} from './nsfw-model-id.ts';
export {NSFW_DETECTOR};
type Model=Awaited<ReturnType<typeof load>>;
let model:Promise<Model>|null=null;
async function ready(){
 // WebAssembly (SIMD) backend: the binaries are bundled and handed over as blob: URLs, so nothing is fetched from
 // the network. It is ~10× faster than WebGL under SwiftShader. Falls back to WebGL, then the pure-JS CPU backend;
 // the backend used is reported in the summary.
 const blob=(b:Uint8Array)=>URL.createObjectURL(new Blob([b as BlobPart],{type:'application/wasm'}));
 const simd=blob(wasmSimd);setWasmPaths({'tfjs-backend-wasm.wasm':blob(wasmPlain),'tfjs-backend-wasm-simd.wasm':simd,'tfjs-backend-wasm-threaded-simd.wasm':simd});
 let ok=await tf.setBackend('wasm').catch(()=>false);if(!ok)ok=await tf.setBackend('webgl').catch(()=>false);if(!ok)await tf.setBackend('cpu');await tf.ready();
 return load('MobileNetV2',{modelDefinitions:[MobileNetV2Model]} as never);
}
export function nsfwBackend(){return tf.getBackend();}
export function sexualScore(p:{className:string;probability:number}[]){const g=(n:string)=>p.find(x=>x.className===n)?.probability??0;return Math.max(0,Math.min(1,g('Porn')+g('Hentai')+0.5*g('Sexy')));}
const CLASSES=['Drawing','Hentai','Neutral','Porn','Sexy'];
/** Batched inference over 224×224 inputs (one forward pass per batch; much faster than one call per image under
 *  SwiftShader). Same preprocessing as NSFWJS: RGB / 255, no resize needed. */
export async function classifyNsfwBatch(inputs:ImageData[],batch=8):Promise<number[]>{
 model??=ready();const m=await model as unknown as {model:{predict(x:tf.Tensor):tf.Tensor}};const out:number[]=[];
 for(let i=0;i<inputs.length;i+=batch){
  const logits=tf.tidy(()=>m.model.predict(tf.stack(inputs.slice(i,i+batch).map(d=>tf.browser.fromPixels(d).toFloat().div(255)))));
  const v=await logits.data();logits.dispose();
  for(let r=0;r*5<v.length;r++)out.push(sexualScore(CLASSES.map((className,k)=>({className,probability:v[r*5+k]!}))));
 }
 return out;
}
export async function classifyNsfw(src:HTMLCanvasElement|ImageData):Promise<number>{model??=ready();const m=await model;return sexualScore(await m.classify(src as never,5));}

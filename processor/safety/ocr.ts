// OCR (REAL): Tesseract run inside its own no-network jail, one image at a time, over the unlit views, texture
// tiles and close-ups. Output is untrusted text fed to the text scan. English and Japanese (tesseract-ocr-jpn) are
// used when installed; a missing language is reported in the coverage note.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tesseractCommand} from './jail.ts';
import type {SafetyImage} from './types.ts';
export const OCR_DETECTOR='ocr-tesseract-v1',OCR_LIMIT=120;
export function ocrLanguages():string[]{const r=spawnSync('tesseract',['--list-langs'],{encoding:'utf8'});if(r.status!==0)return [];const langs=r.stdout.split('\n').slice(1).map(s=>s.trim());return ['eng','jpn'].filter(l=>langs.includes(l));}
const PRIORITY:Record<string,number>={'texture-tile':0,'view-unlit':1,island:2,'grid-crop':3};
export function ocrCandidates(images:SafetyImage[]){return images.filter(i=>i.kind in PRIORITY).sort((a,b)=>PRIORITY[a.kind]!-PRIORITY[b.kind]!).slice(0,OCR_LIMIT);}
function run(dir:string,file:string,lang:string,timeoutMs:number):Promise<string|null>{return new Promise(done=>{const [cmd,args]=tesseractCommand(dir,file,lang),child=spawn(cmd,args,{stdio:['ignore','pipe','ignore']});let out='';const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);child.stdout.on('data',c=>{out+=c;if(out.length>20000)child.kill('SIGKILL');});child.on('error',()=>{clearTimeout(timer);done(null);});child.on('close',code=>{clearTimeout(timer);done(code===0?out.slice(0,4000):null);});});}
export async function ocrImages(images:SafetyImage[],languages=ocrLanguages(),concurrency=4,timeoutMs=30_000):Promise<{texts:{image:string;text:string}[];failed:number;languages:string[]}>{
 if(!languages.length)return {texts:[],failed:-1,languages};
 const dir=await mkdtemp(join(tmpdir(),'safety-ocr-')),texts:{image:string;text:string}[]=[];let failed=0;
 try{
  const queue=ocrCandidates(images);
  await Promise.all([...Array(concurrency)].map(async()=>{for(let item=queue.shift();item;item=queue.shift()){const file=item.name+(item.mime==='image/png'?'.png':'.jpg');await writeFile(join(dir,file),item.data);const text=await run(dir,file,languages.join('+'),timeoutMs);if(text===null)failed++;else if(text.trim())texts.push({image:item.name,text:text.trim()});}}));
 }finally{await rm(dir,{recursive:true,force:true});}
 return {texts,failed,languages};
}

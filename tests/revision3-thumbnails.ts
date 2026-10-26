import { build,preview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir,writeFile,copyFile,mkdtemp,rename,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceProvenance,sha256 } from '../scripts/provenance.ts';
import { thumbnailInputs,requireUnchanged } from './revision3-thumbnail-inputs.ts';

const output='src/site/previews';
const selected=process.env.THUMBNAIL_FAMILIES?.split(',').filter(Boolean);
const previous=JSON.parse(await readFile(output+'/manifest.json','utf8')) as {records:Array<{family:string;file:string}>};
let kit:undefined|{file:string;sha256:string};
await mkdir('evidence/revision3',{recursive:true});
const run=await mkdtemp('evidence/revision3/thumbnail-refresh-');
const staging=run+'/images';
await mkdir(staging);
const before=await thumbnailInputs();
const {catalog,buildAsset,disposeAsset}=await import('../src/catalog/index.ts');
const {inspectGeometry}=await import('../src/lantern/inspect.ts');
await build({build:{outDir:resolve(run,'build')},logLevel:'error'});
requireUnchanged(before,await thumbnailInputs());
const server=await preview({build:{outDir:resolve(run,'build')},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const records:unknown[]=[];
try {
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:600,height:480},deviceScaleFactor:1});
 await page.goto(server.resolvedUrls!.local[0]+'?diagnostic=1');
 await page.waitForFunction(()=>Boolean(window.workshopDiagnostics));
 for(const d of catalog.filter(d=>!selected||selected.includes(d.id)))for(const preset of d.presets){
  await page.evaluate(({family,input})=>{
   const api=window.workshopDiagnostics as unknown as {select(id:string):boolean;apply(p:unknown,frame:boolean):boolean;view(v:string):void};
   if(!api.select(family)||!api.apply(input,true))throw new Error('Thumbnail input rejected');
   api.view('oblique');
  },{family:d.id,input:preset.parameters});
  await page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);});
  const file=d.id+'-'+preset.id+'.png',bytes=await page.screenshot({path:staging+'/'+file});
  const generated=buildAsset(d.id,preset.parameters);
  try {
   const configuration=generated.config;
   records.push({family:d.id,preset:preset.id,file,sha256:sha256(bytes),configuration,
    configurationSha256:sha256(JSON.stringify(configuration)),
    triangles:inspectGeometry(generated.root).triangles,dimensions:generated.dimensions.toArray()});
  }finally{disposeAsset(generated);}
 }
 if(process.env.THUMBNAIL_UPDATE_KIT){
  await page.goto(server.resolvedUrls!.local[0]+'kit/woodland-workshop');
  await page.locator('canvas').waitFor();await page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);});
  const data=await page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL());
  const bytes=Buffer.from(data.split(',')[1]!,'base64');await writeFile(staging+'/workshop-scene.png',bytes);kit={file:'workshop-scene.png',sha256:sha256(bytes)};
 }
}finally{await browser?.close();await server.close();}
const after=await thumbnailInputs();
await writeFile(run+'/capture-manifest.json',JSON.stringify({before,after,records},null,2));
requireUnchanged(before,after);
await copyFile(output+'/manifest.json',run+'/previous-manifest.json');
await mkdir(output,{recursive:true});
for(const record of records as Array<{file:string}>){
 await copyFile(staging+'/'+record.file,output+'/'+record.file+'.pending');
 await rename(output+'/'+record.file+'.pending',output+'/'+record.file);
}
if(kit)await copyFile(staging+'/'+kit.file,output+'/'+kit.file);
const combined=selected?[...previous.records.filter(record=>!selected.includes(record.family)),...records]:records;
const manifest={formatVersion:2,capture:'retained-production-build',run,before,after,records:combined,refreshedFamilies:selected??catalog.map(d=>d.id),kit};
await writeFile(output+'/manifest.json.pending',JSON.stringify(manifest,null,2));
await rename(output+'/manifest.json.pending',output+'/manifest.json');
await writeFile(run+'/published-source.json',JSON.stringify(await sourceProvenance(),null,2));
console.log(JSON.stringify({run,images:records.length,sourceHash:before.sourceHash}));

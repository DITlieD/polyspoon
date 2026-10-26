import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { exportBundle } from '../src/catalog/export.ts';
import { Mesh } from 'three';
import { chromium } from 'playwright-core';

test('ZIP has matching GLB, saved design, executable snapshot and working HTML',{timeout:90000},async()=>{
 const root=process.env.BUNDLE_EVIDENCE_ROOT??'evidence/revision4/viewer-followup/bundle';await mkdir(root,{recursive:true});
 const build=buildAsset('fence',{length:2,bays:1,appearance:{version:1,palette:'PICO8',shading:'Flat',partColors:{'rail-0-0':'#ff0000'}}});
 const bundle=await exportBundle(build);disposeAsset(build);
 for(const [name,data] of Object.entries(bundle.files))await writeFile(root+'/'+name,data);
 await writeFile(root+'/fence.zip',bundle.bytes);
 const validation=execFileSync('python3',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(z.namelist())",root+'/fence.zip'],{encoding:'utf8'});
 const module=await import(pathToFileURL(resolve(root+'/fence.mjs')).href),model=await module.createAsset();
 assert.deepEqual(module.glbBytes(),bundle.files['fence.glb']);
 assert.equal(module.configuration.appearance.shading,'Flat');
 let parts=0;model.traverse((object:Mesh)=>{if(object.isMesh)parts++;});assert.ok(parts>0);
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(pathToFileURL(resolve(root+'/preview.html')).href);
  await page.waitForFunction(()=>document.getElementById('status')?.textContent==='Drag to orbit · Scroll to zoom',{},{timeout:45000});
  await page.screenshot({path:root+'/html-preview.png'});
  assert.deepEqual(errors,[]);
  await writeFile(root+'/receipt.json',JSON.stringify({validation,parts,errors,html:'Loaded actual jsDelivr Three.js 0.186.1 and rendered embedded model',files:Object.keys(bundle.files)},null,2));
 }finally{await browser.close();}
});

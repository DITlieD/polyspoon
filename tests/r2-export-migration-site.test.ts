import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateBytes} from 'gltf-validator';
import {descriptor,loadDesign} from '../src/catalog/index.ts';
import {zipFiles} from '../src/catalog/export.ts';
import {sha256} from '../scripts/provenance.ts';

function bundleEntries(bytes:Uint8Array){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files:Record<string,Uint8Array>={};let offset=0;while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),length=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+length+extra;assert.equal(view.getUint16(offset+8,true),0);const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+length));assert.ok(!Object.hasOwn(files,name));files[name]=bytes.slice(start,start+size);offset=start+size;}assert.ok(Buffer.from(bytes).equals(Buffer.from(zipFiles(files))),'ZIP byte structure differs');return files;}
test('actual browser GLB ZIP and snapshot downloads retain validated migration and reset clears it',{timeout:60000},async()=>{
 const base=process.env.RECIPE_SITE_URL,evidence=process.env.EXPORT_MIGRATION_SITE_EVIDENCE_ROOT??process.env.RECIPE_SITE_EVIDENCE_ROOT;assert.ok(base&&evidence);assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));assert.ok(resolve(evidence).startsWith(resolve('evidence')+'/'));await mkdir(evidence,{recursive:true});const output=await mkdtemp(join(evidence,'export-migration-')),failures:string[]=[],records:unknown[]=[];
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 function configuration(actual:any,expected:any,label:string){const {migration,...rest}=actual,{migration:notice,...expectedRest}=expected;assert.deepEqual(rest,expectedRest,label);if(JSON.stringify(migration)!==JSON.stringify(notice))failures.push(label+' migration notice differs');}
 async function glb(bytes:Uint8Array,expected:any,label:string){const result=await validateBytes(bytes);assert.equal(result.issues.numErrors,0);assert.equal(result.issues.numWarnings,0);const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,''),root=loaded.scene.getObjectByName('cottage')!;assert.ok(root);configuration(root.userData.configuration,expected,label);records.push({label,bytes:bytes.length,sha256:sha256(bytes),migration:root.userData.configuration.migration,validation:{errors:result.issues.numErrors,warnings:result.issues.numWarnings}});}
 async function snapshot(path:string,expected:any,label:string){const module=await import(pathToFileURL(path).href);configuration(module.configuration,expected,label+' configuration');await glb(module.glbBytes(),expected,label+' embedded GLB');}
 try{
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1000}});await page.goto(new URL('/asset/cottage',base).href);await page.waitForSelector('.asset-workspace');await page.locator('#file').setInputFiles(resolve('tests/fixtures/cottage-colored-prior.design.json'));await page.waitForFunction(()=>document.querySelector('#notice')?.textContent?.includes('Construction revised'));
  await page.getByRole('tab',{name:'Shape',exact:true}).click();await page.locator('#width-slider').fill('6.6');await page.locator('#width-slider').dispatchEvent('change');
  async function download(selector:string,name:string){const event=page.waitForEvent('download');await page.locator(selector).click();const file=await event,path=join(output,name);await file.saveAs(path);await page.waitForFunction(()=>!(document.querySelector('#export') as HTMLButtonElement).disabled);return path;}
  const savedPath=await download('#save','edited.design.json'),edited=JSON.parse(await readFile(savedPath,'utf8'));assert.equal(edited.applied.width,6.6);assert.ok(edited.migration);assert.deepEqual(loadDesign(edited),edited);
  for(const phase of ['edited','reset']){
   if(phase==='reset'){await page.locator('#reset').click();await page.waitForFunction(()=>!(document.querySelector('#export') as HTMLButtonElement).disabled);}
   const expected=phase==='edited'?edited:descriptor('cottage').save({});
   const glbPath=await download('#export',phase+'.glb');await glb(await readFile(glbPath),expected,phase+' GLB');
   const zipPath=await download('#export-bundle',phase+'.zip'),members=bundleEntries(await readFile(zipPath));assert.deepEqual(Object.keys(members).sort(),['README.txt','cottage.design.json','cottage.glb','cottage.mjs','preview.html']);configuration(JSON.parse(new TextDecoder().decode(members['cottage.design.json']!)),expected,phase+' ZIP design');await glb(members['cottage.glb']!,expected,phase+' ZIP GLB');const embedded=join(output,phase+'-zip.mjs');await writeFile(embedded,members['cottage.mjs']!);await snapshot(embedded,expected,phase+' ZIP snapshot');
   const modulePath=await download('#export-module',phase+'.mjs');await snapshot(modulePath,expected,phase+' snapshot');
  }
 }finally{await browser.close();await writeFile(join(output,'receipt.json'),JSON.stringify({base,records,failures,browserClosed:true},null,2)+'\n');}
 assert.deepEqual(failures,[]);await writeFile(join(evidence,'latest.json'),JSON.stringify({output,passed:true},null,2)+'\n');
});

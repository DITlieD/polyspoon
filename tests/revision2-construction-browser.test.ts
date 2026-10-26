import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import type { Design } from '../src/catalog/index.ts';
import { validateBytes } from 'gltf-validator';
import { sourceProvenance,sha256 } from '../scripts/provenance.ts';

test('new construction controls roundtrip through production browser save load and migration',{timeout:90000},async()=>{
 const output=process.env.INTEGRATION_EVIDENCE_ROOT;
 assert.ok(output,'INTEGRATION_EVIDENCE_ROOT must identify a fresh production integration build');
 await mkdir(output+'/construction',{recursive:true});
 const server=await preview({build:{outDir:output+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});
 const errors:string[]=[],records:unknown[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 const config=()=>page.evaluate(()=>(window.workshopDiagnostics as unknown as {configuration():Design}).configuration());
 const old=JSON.parse(await readFile('tests/fixtures/family-v020.json','utf8'));
 try{
  await page.goto(server.resolvedUrls!.local[0]+'?diagnostic=1');
  await page.waitForFunction(()=>Boolean(window.workshopDiagnostics));
  await page.evaluate(()=>{document.body.classList.remove('diagnostic');(window.workshopDiagnostics as unknown as {diagnostic(v:boolean):void}).diagnostic(false);});
  for(const [family,choices] of Object.entries({tree:{growth:'young'},boulder:{form:'standing'},fence:{railStyle:'cross-braced',postHead:'flat',detail:'scene'},crate:{lid:'open-top',brace:'plain',detail:'scene'}})){
   await page.selectOption('#family',family);
   const tab=page.locator('button[data-group="construction"]');
   if(await tab.getAttribute('aria-pressed')!=='true')await tab.click();
   for(const [key,value] of Object.entries(choices))await page.locator('#'+key).selectOption(value);
   const chosen=await config();
   assert.equal(chosen.familyVersion,'0.3.0');
   for(const [key,value] of Object.entries(choices))assert.equal(chosen.applied[key],value);
   const saveEvent=page.waitForEvent('download');await page.locator('#save').click();const saved=await saveEvent;
   const bytes=await readFile((await saved.path())!);assert.deepEqual(JSON.parse(bytes.toString()),chosen);
   await writeFile(output+'/construction/'+family+'.design.json',bytes);
   await page.selectOption('#family','cottage');
   await page.locator('#file').setInputFiles({name:family+'.json',mimeType:'application/json',buffer:bytes});
   await page.waitForFunction(f=>((window.workshopDiagnostics as unknown as {configuration():Design}).configuration()).family===f,family);
   assert.deepEqual(await config(),chosen);
   const exportEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await exportEvent;
   const glb=await readFile((await download.path())!),validation=await validateBytes(glb);
   assert.equal(validation.issues.numErrors,0);assert.equal(validation.issues.numWarnings,0);
   const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString().trim());
   const configured=json.nodes.find((n:{extras?:{configuration?:unknown}})=>n.extras?.configuration)?.extras.configuration;
   assert.deepEqual(configured,chosen);
   await writeFile(output+'/construction/'+family+'.glb',glb);
   const screenshot=await page.screenshot({path:output+'/construction/'+family+'.png',fullPage:true});
   await page.locator('#file').setInputFiles({name:family+'-v020.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old[family]))});
   await page.waitForFunction(()=>Boolean((window.workshopDiagnostics.configuration() as unknown as {migration?:unknown}).migration));
   const migrated=await config();assert.equal(migrated.familyVersion,'0.3.0');
   for(const [key,value] of Object.entries(old[family].requested))assert.equal(migrated.requested[key],value);
   records.push({family,chosen,migrated,designHash:sha256(bytes),glbHash:sha256(glb),imageHash:sha256(screenshot),validation:validation.issues});
  }
  assert.deepEqual(errors,[]);
  await writeFile(output+'/construction/manifest.json',JSON.stringify({provenance:await sourceProvenance(),records,errors},null,2));
 }finally{await browser.close();await server.close();}
});

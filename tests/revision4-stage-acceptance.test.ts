import test from 'node:test';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { sourceProvenance } from '../scripts/provenance.ts';

const root=process.env.INTEGRATION_EVIDENCE_ROOT??'evidence/revision4/editor-acceptance';
const launch=()=>chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
test('website raycast chooses one mesh while orbit dragging does not pick',{timeout:60000},async()=>{
 const output=root+'/website-pointer';await mkdir(output,{recursive:true});
 const server=await preview({build:{outDir:root+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'}),browser=await launch();
 const page=await browser.newPage({viewport:{width:1580,height:810},acceptDownloads:true}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(server.resolvedUrls!.local[0]+'asset/boulder');
  const box=(await page.locator('canvas').boundingBox())!,point={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+70,point.y+20,{steps:10});await page.mouse.up();
  assert.equal(await page.locator('.part-color-editor').isVisible(),false);
  await page.getByRole('button',{name:'Frame asset',exact:true}).click();
  await page.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
  await page.mouse.click(point.x,point.y);await page.locator('.part-color-editor').waitFor();
  const name=await page.getByRole('combobox',{name:'Part to recolor',exact:true}).inputValue();
  const asset=buildAsset('boulder');assert.ok(asset.root.getObjectByName(name));disposeAsset(asset);assert.notEqual(name,'stone');
  await page.getByLabel('Selected part color',{exact:true}).fill('#3f7892');await page.getByLabel('Selected part color',{exact:true}).dispatchEvent('change');
  const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending,design=JSON.parse(await readFile((await download.path())!,'utf8'));
  assert.deepEqual(design.appearance.partColors,{[name]:'#3f7892'});assert.equal(Object.hasOwn(design.requested,'color.stone'),false);
  assert.deepEqual(errors,[]);await page.screenshot({path:output+'/picked-part.png',fullPage:true});
  await writeFile(output+'/receipt.json',JSON.stringify({pickedMesh:name,dragDidNotPick:true,oneOverride:true,errors,provenance:await sourceProvenance()},null,2));
 }catch(error){await page.screenshot({path:output+'/first-failure.png',fullPage:true});await writeFile(output+'/failure.json',JSON.stringify({error:String(error),errors},null,2));throw error;}
 finally{await browser.close();await server.close();}
});

test('GPU allocations stabilize across effects, styled rebuilds and six-family replacement',{timeout:180000},async()=>{
 const output=root+'/'+(process.env.RESOURCE_EVIDENCE_NAME??'resources');await mkdir(output,{recursive:true});
 const server=await preview({build:{outDir:root+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'}),browser=await launch();
 const page=await browser.newPage({viewport:{width:1580,height:810}}),errors:string[]=[],samples:unknown[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(`
  globalThis.__name=value=>value;
  const live={Buffer:new Set(),Texture:new Set(),Program:new Set(),Framebuffer:new Set(),Renderbuffer:new Set()};
  for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
   for(const kind of Object.keys(live)){
    const create=proto['create'+kind],remove=proto['delete'+kind];
    proto['create'+kind]=function(...args){const value=create.apply(this,args);if(value)live[kind].add(value);return value;};
    proto['delete'+kind]=function(value){live[kind].delete(value);return remove.call(this,value);};
   }
  }
  globalThis.__gpuRead=()=>Object.fromEntries(Object.entries(live).map(([key,value])=>[key,value.size]));
 `);
 try{
  await page.goto(server.resolvedUrls!.local[0]+'asset/work-lantern');
  const effect=async(label:string,value:string)=>{await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('combobox',{name:label,exact:true}).selectOption(value);await page.keyboard.press('Escape');};
  const snapshot=async()=>{await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);});return page.evaluate(()=>(window as unknown as {__gpuRead():Record<string,number>}).__gpuRead());};
  for(let cycle=0;cycle<2;cycle++){
   for(const family of ['work-lantern','cottage','tree','fence','crate','boulder']){
    await page.locator('.site-navigation a[href="/"]').click();await page.locator('a.asset-card[href="/asset/'+family+'"]').click();
    for(const [label,value] of [['Outline','Heavy4px'],['Wireframe','Ghost'],['Wobble','PS1'],['Shading','Flat'],['Shading','Toon3bands'],['Underwater','Reef']])await effect(label!,value!);
    for(const label of ['Underwater','Shading','Wobble','Wireframe','Outline'])await effect(label,'None');
   }
   samples.push(await snapshot());
   await writeFile(output+'/progress.json',JSON.stringify({completedCycles:cycle+1,samples,errors},null,2));
  }
  await writeFile(output+'/measurements.json',JSON.stringify({samples,cycles:2,familiesPerCycle:6,errors,provenance:await sourceProvenance()},null,2));
  assert.deepEqual(errors,[]);
  for(const sample of samples.slice(1))assert.deepEqual(sample,samples[0],'GPU live allocations must remain fixed after the warm cycle');
  await writeFile(output+'/receipt.json',JSON.stringify({stable:true,viewport:{width:1580,height:810},samples,errors,provenance:await sourceProvenance()},null,2));
 }catch(error){await writeFile(output+'/first-failure.json',JSON.stringify({error:String(error),samples,errors},null,2));throw error;}
 finally{await browser.close();await server.close();}
});

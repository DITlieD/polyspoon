import {constructionCases} from './revision3-construction-cases.ts';
import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { validateBytes } from 'gltf-validator';
import { descriptor,buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';
import { sourceProvenance,sha256 } from '../scripts/provenance.ts';

const edits=constructionCases;
test('all six production asset pages apply revision3 controls and export complete models',{timeout:180000},async()=>{
 const output=process.env.SITE_EVIDENCE_ROOT;
 assert.ok(output,'Set SITE_EVIDENCE_ROOT to a frozen production build evidence directory.');
 const before=await sourceProvenance();
 const server=await preview({build:{outDir:output+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 const records:unknown[]=[],errors:string[]=[];
 try {
  browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(server.resolvedUrls!.local[0]!).origin});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript('globalThis.__name = (value) => value;');
  await mkdir(output+'/all-controls',{recursive:true});
  for(const [family,values] of Object.entries(edits)){
   await page.goto(server.resolvedUrls!.local[0]+'asset/'+family);
   await page.locator('#reset').click();
   const d=descriptor(family);
   await page.locator('button[data-group="construction"]').click();
   if(family==='fence')assert.equal(await page.locator('#picketSpacing').isDisabled(),true);
   for(const [key,value] of Object.entries(values)){
    const control=d.controls.find(c=>c.key===key);assert.ok(control,'Required revision3 control '+key);
    const field=page.locator('[id="'+key+'"]');
    if(control.kind==='choice')await field.selectOption(String(value));
    else {
     assert.ok(control.kind==='range'||control.kind==='integer');
     await field.fill(String(Number(value)*(control.unit==='cm'?100:1)));await field.press('Enter');
    }
    assert.equal(await page.locator('#error').isVisible(),false,family+'/'+key);
   }
   const color=d.controls.find(c=>c.kind==='color');assert.ok(color);
   await page.locator('button[data-group="colors"]').click();
   await page.locator('[id="'+color.key+'"]').fill('#765b42');await page.locator('[id="'+color.key+'"]').press('Enter');
   await page.locator('[data-usage="design"]').click();
   const snippet=JSON.parse(await page.locator('#usage-design-0').inputValue());
   assert.equal(snippet.applied[color.key],'#765b42');
   for(const [key,value] of Object.entries(values))assert.equal(snippet.applied[key],value);
   assert.ok((await page.locator('#usage-design-1').inputValue()).includes('--config '+family+'.design.json'));
   await page.locator('[data-usage="agent"]').click();
   const calls=JSON.parse(await page.locator('#usage-agent-0').inputValue());
   assert.deepEqual(calls.map((c:{name:string})=>c.name),['get_asset','build_variant','export_asset']);
   assert.deepEqual(calls[1].arguments.parameters,snippet.requested);
   assert.deepEqual(calls[2].arguments.parameters,snippet.requested);
   await page.getByRole('button',{name:'Copy MCP tool calls',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.usage-status')?.textContent==='MCP tool calls copied.');
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.locator('#usage-agent-0').inputValue());
   await page.evaluate(()=>{Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async()=>{throw new Error('Test clipboard denial');}});});
   await page.getByRole('button',{name:'Copy MCP tool calls',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.usage-status')?.textContent?.startsWith('Clipboard unavailable.'));
   assert.equal(await page.locator('#usage-agent-0').evaluate(n=>(n as HTMLTextAreaElement).selectionEnd), (await page.locator('#usage-agent-0').inputValue()).length);
   await page.locator('[data-usage="glb"]').click();
   assert.ok((await page.locator('#usage-glb-0').inputValue()).includes("./"+family+".glb"));
   await page.locator('button[data-group="construction"]').click();
   const saving=page.waitForEvent('download');await page.locator('#save').click();
   const design=JSON.parse(await readFile((await (await saving).path())!,'utf8'));
   for(const [key,value] of Object.entries(values))assert.equal(design.applied[key],value,family+'/'+key);
   const exporting=page.waitForEvent('download');await page.locator('#export').click();
   const bytes=await readFile((await (await exporting).path())!);
   const validation=await validateBytes(bytes);assert.equal(validation.issues.numErrors,0);
   const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString().trim());
   const config=gltf.nodes.find((n:{extras?:{configuration?:unknown}})=>n.extras?.configuration).extras.configuration;
   assert.deepEqual(config.applied,design.applied);
   const generated=buildAsset(family,design.requested);
   try {
    const stats=inspectGeometry(generated.root);
    assert.equal(gltf.nodes.filter((n:{mesh?:number})=>n.mesh!==undefined).length,stats.parts);
    const triangles=gltf.meshes.flatMap((m:{primitives:Array<{indices?:number;attributes:{POSITION:number}}>})=>m.primitives).reduce((sum:number,p:{indices?:number;attributes:{POSITION:number}})=>sum+gltf.accessors[p.indices??p.attributes.POSITION].count/3,0);
    assert.equal(triangles,stats.triangles);
    assert.equal(await page.locator('#triangles').textContent(),stats.triangles.toLocaleString());
    records.push({family,values,configuration:design,sha256:sha256(bytes),triangles,parts:stats.parts,validation:validation.issues});
   }finally{disposeAsset(generated);}
   await writeFile(output+'/all-controls/'+family+'.glb',bytes);
   await writeFile(output+'/all-controls/'+family+'.design.json',JSON.stringify(design,null,2));
   await page.screenshot({path:output+'/all-controls/'+family+'.png',fullPage:true});
   await page.locator('#file').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(design))});
   await page.waitForFunction(()=>document.getElementById('notice')?.textContent==='Design loaded.');
   for(const [key,value] of Object.entries(values)){
    const c=d.controls.find(c=>c.key===key)!;
    assert.equal(await page.locator('[id="'+key+'"]').inputValue(),String(typeof value==='number'&&c.unit==='cm'?value*100:value));
   }
  }
  assert.deepEqual(errors,[]);
  const after=await sourceProvenance();assert.equal(after.sourceHash,before.sourceHash,'Source changed during production verification');
  await writeFile(output+'/all-controls/receipt.json',JSON.stringify({before,after,records,errors},null,2));
 }finally{await browser?.close();await server.close();}
});

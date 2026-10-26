import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { sourceProvenance,sha256 } from '../scripts/provenance.ts';

test('ratio labels and kit layout preserve canonical editing and document state',{timeout:60000},async()=>{
 const output=process.env.INTEGRATION_EVIDENCE_ROOT??'evidence/revision2/editor-polish-r5';
 await mkdir(output+'/polish',{recursive:true});
 const server=await preview({build:{outDir:output+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});
 const errors:string[]=[],files:Record<string,string>={},metrics:unknown[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 const config=()=>page.evaluate(()=>window.workshopDiagnostics.configuration());
 const shot=async(name:string)=>{files[name]=sha256(await page.screenshot({path:output+'/polish/'+name+'.png',fullPage:true}));};
 try{
  await page.goto(server.resolvedUrls!.local[0]+'?diagnostic=1');
  await page.waitForFunction(()=>Boolean(window.workshopDiagnostics));
  await page.evaluate(()=>{document.body.classList.remove('diagnostic');(window.workshopDiagnostics as unknown as {diagnostic(v:boolean):void}).diagnostic(false);});
  await page.selectOption('#family','cottage');
  await page.locator('button[data-group="construction"]').click();
  assert.equal(await page.locator('[data-key="roofCharacter"] .unit').textContent(),'');
  const camera=await page.evaluate(()=> (window.workshopDiagnostics as unknown as {camera():unknown}).camera());
  await page.locator('#roofCharacter').fill('0.65');await page.locator('#roofCharacter').press('Enter');
  assert.equal((await config()).applied.roofCharacter,0.65);
  assert.deepEqual(await page.evaluate(()=>(window.workshopDiagnostics as unknown as {camera():unknown}).camera()),camera);
  await shot('desktop-roof-profile');
  await page.selectOption('#family','boulder');await page.locator('button[data-group="shape"]').click();
  assert.equal(await page.locator('[data-key="lean"] .unit').textContent(),'of width');
  await page.locator('#lean').fill('0.12');await page.locator('#lean').press('Enter');
  assert.equal((await config()).applied.lean,0.12);
  await shot('desktop-width-fraction');
  await page.selectOption('#family','tree');
  assert.equal(await page.locator('[data-key="lean"] .unit').textContent(),'of height');
  await page.locator('#lean').fill('-0.075');await page.locator('#lean').press('Enter');
  assert.equal((await config()).applied.lean,-0.075);
  await shot('desktop-height-fraction');
  for(const size of [{width:1440,height:960},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForTimeout(120);
   const prior=await config(),viewport=await page.locator('.viewport').boundingBox();
   await page.locator('#show-workshop').click();await page.waitForTimeout(120);
   assert.equal(await page.locator('.inspector').isVisible(),false);
   const kit=await page.locator('.viewport').boundingBox();assert.ok(kit&&viewport);
   if(size.width>650)assert.ok(kit.width>viewport.width+200);else assert.ok(kit.height>viewport.height+150);
   assert.equal(await page.locator('#save').isDisabled(),true);
   assert.equal(await page.locator('#export').isDisabled(),true);
   const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
   assert.equal(layout.width,layout.scrollWidth);assert.equal(layout.height,layout.scrollHeight);
   metrics.push({size,viewport,kit,layout});await shot(size.width>650?'desktop-kit':'mobile-kit');
   await page.locator('#back-editor').click();await page.waitForTimeout(120);
   assert.equal(await page.locator('.inspector').isVisible(),true);assert.deepEqual(await config(),prior);
   await shot(size.width>650?'desktop-return':'mobile-return');
  }
  const event=page.waitForEvent('download');await page.locator('#save').click();const download=await event;
  const saved=JSON.parse(await readFile((await download.path())!,'utf8'));assert.equal(saved.applied.lean,-0.075);
  await page.locator('#lean').fill('0.025');await page.locator('#lean').press('Enter');
  await page.locator('#undo').click();assert.equal((await config()).applied.lean,-0.075);
  assert.deepEqual(errors,[]);
  await writeFile(output+'/polish/manifest.json',JSON.stringify({provenance:await sourceProvenance(),files,metrics,errors,browser:browser.version()},null,2));
 }finally{await browser.close();await server.close();}
});

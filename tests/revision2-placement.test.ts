import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { Box3 } from 'three';
import { readFile,writeFile } from 'node:fs/promises';
import { buildWorkshop,arrangement } from '../src/catalog/workshop.ts';
import { sourceProvenance,sha256 } from '../scripts/provenance.ts';

test('placement-only correction capture and source coverage',{timeout:60000},async()=>{
 const directory='evidence/revision2/integration/placement-fix';
 const current=await sourceProvenance();
 const prior=JSON.parse(await readFile('evidence/revision2/integration/after.json','utf8'));
 const changed=Object.keys(current.sources).filter(p=>current.sources[p]!==prior.sources[p]);
 assert.deepEqual(changed,['src/catalog/workshop.ts']);
 const build=buildWorkshop();
 const boxes=build.root.children.map(o=>new Box3().setFromObject(o,true));
 const gap=boxes[2]!.min.z-boxes[0]!.max.z;
 assert.ok(gap>=0.10);
 build.dispose();
 const server=await preview({build:{outDir:directory+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 const files:Record<string,string>={},errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 const capture=async(name:string)=>{
  await page.waitForTimeout(160);
  files[name]=sha256(await page.screenshot({path:directory+'/'+name+'.png',fullPage:true}));
 };
 try{
  await page.goto(server.resolvedUrls!.local[0]+'?diagnostic=1&scene=1');
  await page.waitForFunction(()=>Boolean(window.workshopDiagnostics));
  await page.evaluate(()=>{document.body.classList.remove('diagnostic');(window.workshopDiagnostics as unknown as {diagnostic(v:boolean):void}).diagnostic(false);});
  await capture('kit-desktop');
  await page.setViewportSize({width:390,height:844});
  await capture('kit-mobile');
  const mobile=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  assert.equal(mobile.width,mobile.scrollWidth);assert.equal(mobile.height,mobile.scrollHeight);
  await page.setViewportSize({width:1200,height:1000});
  await page.evaluate(()=>{
   document.body.classList.add('diagnostic');
   const api=window.workshopDiagnostics as unknown as {diagnostic(v:boolean):void;view(v:string):void};
   api.diagnostic(true);api.view('top');
  });
  await capture('kit-plan');
  assert.deepEqual(errors,[]);
  const failed=JSON.parse(await readFile('evidence/revision2/integration/placement-failure.json','utf8'));
  await writeFile(directory+'/manifest.json',JSON.stringify({provenance:current,priorSourceHash:prior.sourceHash,changedProductionFiles:changed,unchangedPriorSources:Object.fromEntries(Object.entries(current.sources).filter(([path])=>!changed.includes(path))),beforeGap:failed.bounds[2].min[2]-failed.bounds[0].max[2],afterGap:gap,shiftZ:0.15,arrangement,bounds:boxes.map(b=>({min:b.min.toArray(),max:b.max.toArray()})),browser:browser.version(),files,mobile,errors,review:'pending main; single authorized placement mutation',priorCoverage:'Engine, editor and MCP source hashes unchanged. Their receipts retain prior aggregate source hash, not this new aggregate.'},null,2));
 }finally{await browser.close();await server.close();}
});


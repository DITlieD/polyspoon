import test from 'node:test';
import assert from 'node:assert/strict';
import {preview} from 'vite';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {sourceProvenance,sha256} from '../scripts/provenance.ts';
test('clean production desktop and mobile presentation capture',{timeout:120000},async()=>{
 const root=process.env.SITE_EVIDENCE_ROOT;assert.ok(root);
 const output=root+'/presentation-reviewed';await mkdir(output,{recursive:false});
 const before=await sourceProvenance(),server=await preview({build:{outDir:root+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1}),errors:string[]=[],shots:Array<{name:string;data:string;sha256:string}>=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 for(const mobile of [false,true]){
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1050});
  for(const route of mobile?['','asset/cottage','kit/woodland-workshop']:['','asset/cottage','asset/tree','asset/work-lantern','asset/fence','asset/crate','asset/boulder','kit/woodland-workshop']){
   await page.goto(server.resolvedUrls!.local[0]+route);
   await page.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<10;i++)await new Promise(requestAnimationFrame);});
   if(route.startsWith('asset/')){await page.locator('#reset').click();const shape=page.locator('button[data-group="shape"]');if(await shape.getAttribute('aria-pressed')!=='true')await shape.click();await page.waitForSelector('.parameter[data-group="shape"]:visible');}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const name=(mobile?'mobile-':'desktop-')+(route.replaceAll('/','-')||'catalog'),bytes=await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
   shots.push({name,data:bytes.toString('base64'),sha256:sha256(bytes)});
  }
 }
 assert.deepEqual(errors,[]);
 const sheet=await browser.newPage({viewport:{width:1600,height:1000}});
 await sheet.setContent('<html><body style="margin:0;background:#f4f5f3;font-family:Arial;padding:24px"><h1>Frozen build · clean catalog, assets and kit</h1><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">'+shots.map(s=>'<section style="background:white;padding:10px"><h2 style="font-size:14px">'+s.name+'</h2><img style="width:100%;height:420px;object-fit:contain;object-position:top" src="data:image/png;base64,'+s.data+'"></section>').join('')+'</div></body></html>');
 await sheet.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(n=>(n as HTMLImageElement).decode())));
 await sheet.screenshot({path:output+'/contact-sheet.png',fullPage:true});
 const after=await sourceProvenance();
 await writeFile(output+'/manifest.json',JSON.stringify({before,after,shots:shots.map(({name,sha256})=>({name,sha256})),errors},null,2));
 assert.equal(after.sourceHash,before.sourceHash);
 }finally{await browser.close();await server.close();}
});

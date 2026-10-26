import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';

test('mobile landing and docs retain visible supplied artwork in header and footer',async()=>{
 const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const records=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:900},deviceScaleFactor:1});
  for(const route of ['/','/docs']){
   await page.goto(server.resolvedUrls!.local[0]!+route.replace(/^\//,''));
   await page.locator('.site-brand').waitFor({state:'attached'});
   await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('.site-brand img,.footer-brand img')].every(image=>image.complete&&image.naturalWidth>0));
   const metrics=await page.evaluate(()=>({route:location.pathname,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,brands:[...document.querySelectorAll<HTMLElement>('.site-brand .brand-art,.footer-brand .brand-art')].map(art=>({header:Boolean(art.closest('.site-header')),width:art.getBoundingClientRect().width,height:art.getBoundingClientRect().height,display:getComputedStyle(art).display,visibility:getComputedStyle(art).visibility}))}));
   records.push(metrics);
   assert.equal(metrics.brands.length,2);
   for(const art of metrics.brands){assert.ok(art.width>=100&&art.height>=25,'mobile supplied brand has zero or unusable size: '+JSON.stringify(metrics));assert.notEqual(art.display,'none');assert.equal(art.visibility,'visible');}
   assert.ok(metrics.scrollWidth<=390);
   if(process.env.BRAND_EVIDENCE){
    const name=route==='/'?'landing':'docs',base=process.env.BRAND_EVIDENCE;
    await page.locator('.site-header').screenshot({path:base+'/mobile-'+name+'-header-390.png'});
    await page.locator('.site-footer').screenshot({path:base+'/mobile-'+name+'-footer-390.png'});
    await page.screenshot({path:base+'/'+name+'-390.png',fullPage:true});
   }
  }
  if(process.env.BRAND_EVIDENCE)await writeFile(process.env.BRAND_EVIDENCE+'/mobile-after-fix.json',JSON.stringify({records,checks:'Visible nonzero brand framing required, not only loaded images.'},null,2)+'\n');
 }finally{await browser.close();await server.close();}
});

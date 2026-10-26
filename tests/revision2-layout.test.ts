import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer, preview } from 'vite';
import { mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceProvenance } from '../scripts/provenance.ts';
test('bounded inspector contains accessible outputs and hides inactive palettes',{timeout:60000},async()=>{
 const integration=process.env.INTEGRATION_EVIDENCE_ROOT;
  const server=integration ? await preview({build:{outDir:integration+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'}) : await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});if('listen' in server) await server.listen();
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const directory=integration?integration+'/editor/pass2':'evidence/revision2/editor/pass2',records:unknown[]=[],shots:Record<string,string>={};
 await mkdir(directory,{recursive:true});
 try{
  await page.goto(server.resolvedUrls!.local[0]!+'editor');await page.selectOption('#family','cottage');
  for(const group of ['shape','construction','colors']){
   if(await page.locator('button[data-group="'+group+'"]').getAttribute('aria-pressed')!=='true')await page.locator('button[data-group="'+group+'"]').click();
   await page.waitForTimeout(120);
   const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,bodyHeight:document.body.getBoundingClientRect().height,appHeight:document.getElementById('app')!.getBoundingClientRect().height,controlsHeight:document.getElementById('controls')!.clientHeight,controlsScrollHeight:document.getElementById('controls')!.scrollHeight,outputAnchors:[...document.querySelectorAll('output.sr-only')].map(n=>({id:n.id,offsetParent:(n as HTMLElement).offsetParent?.className})),font:getComputedStyle(document.querySelector('select')!).fontFamily,bodyFont:getComputedStyle(document.body).fontFamily}));
   records.push({group,metrics});
   await writeFile(directory+'/layout-probe.json',JSON.stringify(records,null,2));
   assert.equal(await page.locator('.palettes').isVisible(),group==='colors');
   assert.ok(metrics.scrollWidth<=metrics.width);
   assert.ok(metrics.scrollHeight<=metrics.height);
   assert.equal(metrics.font,metrics.bodyFont);
   const beforeScroll=await page.evaluate(()=>window.scrollY);
   await page.locator('#controls').evaluate(node=>{node.scrollTop=node.scrollHeight;});
   assert.equal(await page.evaluate(()=>window.scrollY),beforeScroll);
   await page.locator('#controls').evaluate(node=>{node.scrollTop=0;});
   const bytes=await page.screenshot({path:directory+'/mobile-cottage-'+group+'.png',fullPage:true});
   shots['mobile-cottage-'+group]=createHash('sha256').update(bytes).digest('hex');
  }
  assert.equal(await page.locator('[data-key="color.roof"] .region-name').textContent(),'Roof');
  assert.equal(await page.locator('[data-key="color.roof"] input[type=text]').getAttribute('id'),'color.roof');
  await page.setViewportSize({width:1440,height:960});
  await page.locator('button[data-group="construction"]').click();await page.waitForTimeout(120);
  assert.equal(await page.locator('.palettes').isVisible(),false);
  const bytes=await page.screenshot({path:directory+'/desktop-cottage-construction.png',fullPage:true});
  shots['desktop-cottage-construction']=createHash('sha256').update(bytes).digest('hex');
  await writeFile(directory+'/manifest.json',JSON.stringify({provenance:await sourceProvenance(),browser:browser.version(),records,shots,fullPage:true},null,2));
 }finally{await browser.close();await server.close();}
});


import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {preview} from 'vite';
import {chromium} from 'playwright-core';
test('reference-sized asset workspace preserves controls and download',{timeout:90000},async()=>{
 const root=process.env.SITE_EVIDENCE_ROOT;assert.ok(root);await mkdir(root,{recursive:true});
 const server=await preview({build:{outDir:root+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:810},acceptDownloads:true}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(server.resolvedUrls!.local[0]+'asset/fence');
 await page.locator('.download-card').waitFor();
 const view=await page.locator('.viewport').boundingBox(),card=await page.locator('.download-card').boundingBox();assert.ok(view&&card);
 assert.ok(Math.abs(view.x-28)<=2);assert.ok(view.width>=900&&view.width<=970);assert.ok(view.height>=550&&view.height<=580);assert.ok(card.x>=view.x+view.width+16);
 await page.screenshot({path:root+'/desktop-fence.png',fullPage:true});
 const shape=page.getByRole('button',{name:'Proportions',exact:true});await shape.click();await page.locator('.parameter[data-group=shape]:visible').first().waitFor();
 await page.screenshot({path:root+'/desktop-proportions.png',fullPage:true});
 await page.keyboard.press('Escape');assert.equal(await shape.evaluate(e=>document.activeElement===e),true);
 await page.getByRole('button',{name:'Construction',exact:true}).click();await page.locator('.parameter[data-group=construction]:visible').first().waitFor();
 await page.keyboard.press('Escape');
 const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending;assert.ok(download.suggestedFilename().endsWith('.glb'));await download.saveAs(root+'/fence.glb');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/mobile-fence.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shape.click();
 const popup=await page.locator('#inspector').boundingBox();assert.ok(popup&&popup.x>=0&&popup.x+popup.width<=390);
 await page.keyboard.press('Escape');assert.deepEqual(errors,[]);await writeFile(root+'/receipt.json',JSON.stringify({view,card,errors},null,2));
 }catch(error){await page.screenshot({path:root+'/failure.png',fullPage:true});await writeFile(root+'/failure.json',JSON.stringify({errors,message:String(error)},null,2));throw error;}finally{await browser.close();await server.close();}
});

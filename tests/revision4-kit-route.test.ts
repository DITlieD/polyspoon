import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { sourceProvenance } from '../scripts/provenance.ts';

test('kit route hides asset edits and restores the saved asset on return',{timeout:60000},async()=>{
 const output='evidence/revision4/kit-route';await mkdir(output,{recursive:true});
 const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:810},acceptDownloads:true}),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(server.resolvedUrls!.local[0]+'asset/fence');
  await page.getByRole('button',{name:'Material palettes',exact:true}).click();
  await page.locator('.colorway').last().click();await page.keyboard.press('Escape');
  async function saved(){const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending;return JSON.parse(await readFile((await download.path())!,'utf8'));}
  const before=await saved();
  await page.locator('.site-navigation a[href="/kit/woodland-workshop"]').click();
  assert.equal(await page.getByRole('button',{name:'Material palettes',exact:true}).isVisible(),false);
  assert.equal(await page.getByRole('button',{name:'Recolor individual parts',exact:true}).isVisible(),false);
  assert.equal(await page.locator('.tool-rail button:visible').count(),1);
  assert.equal(await page.getByRole('button',{name:'Frame asset',exact:true}).isVisible(),true);
  assert.equal(await page.locator('#view').isVisible(),true);
  assert.equal(await page.getByRole('link',{name:'See the whole kit ↗',exact:true}).isVisible(),false);
  assert.ok(!(await page.locator('.orbit-help').innerText()).includes('color'));
  await page.screenshot({path:output+'/desktop-kit.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/mobile-kit.png',fullPage:true});
  const camera=await page.locator('.kit-camera').boundingBox(),back=await page.locator('#back-editor').boundingBox();assert.ok(camera&&back&&back.y>=camera.y+camera.height);
  await page.locator('#back-editor').click();
  assert.equal(await page.getByRole('button',{name:'Material palettes',exact:true}).isVisible(),true);
  assert.deepEqual(await saved(),before);
  assert.deepEqual(errors,[]);
  await writeFile(output+'/receipt.json',JSON.stringify({restored:true,errors,provenance:await sourceProvenance()},null,2));
 }finally{await browser.close();await server.close();}
});

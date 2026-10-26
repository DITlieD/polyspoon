import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { sha256 } from '../scripts/recipe-package-core.ts';

test('procedural website download preserves identity/current design and exposes failed artifact recovery',{timeout:60000},async()=>{
  const base=process.env.RECIPE_SITE_URL,output=process.env.PROCEDURAL_SITE_EVIDENCE_ROOT;
  assert.ok(base&&output,'Set local RECIPE_SITE_URL and PROCEDURAL_SITE_EVIDENCE_ROOT');
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname));
  assert.ok(resolve(output).startsWith(resolve('evidence')+'/'));
  await mkdir(output,{recursive:false});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1000}});
    const index=await (await page.request.get(new URL('/procedural-modules/index.json',base).href)).json();
    const entry=index.packages.find((p:{id:string})=>p.id==='bench');assert.ok(entry);
    await page.goto(new URL('/asset/bench',base).href);
    await page.locator('#procedural-module').waitFor({state:'visible'});
    assert.match(await page.locator('#procedural-module').innerText(),/family default/);
    assert.equal(await page.locator('#export-module').innerText(),'Snapshot .mjs');
    const pending=page.waitForEvent('download');await page.locator('#procedural-module').click();
    const download=await pending;await download.saveAs(join(output,'bench-1.1.0.mjs'));
    assert.equal(sha256(await readFile(join(output,'bench-1.1.0.mjs'))),entry.sha256);
    const before=await page.locator('#procedural-current-snippet').innerText();
    await page.getByRole('tab',{name:'Shape',exact:true}).click();
    await page.locator('#width-slider').fill('2.1');await page.locator('#width-slider').dispatchEvent('change');
    await page.waitForFunction(previous=>document.querySelector('#procedural-current-snippet')?.textContent!==previous,before);
    const snippet=await page.locator('#procedural-current-snippet').innerText();assert.match(snippet,/"width": 2.1/);
    const jsonPending=page.waitForEvent('download');await page.locator('#procedural-current-design').click();
    const json=await jsonPending;await json.saveAs(join(output,'bench-current.design.json'));
    const design=JSON.parse(await readFile(join(output,'bench-current.design.json'),'utf8'));assert.equal(design.requested.width,2.1);assert.equal(design.applied.width,2.1);
    await page.screenshot({path:join(output,'procedural-download.png'),fullPage:true});
    const failures=[];
    for(const [name,manifest,body,status] of [
      ['missing-index',undefined,undefined,404],
      ['stale-index',{...index,packages:[{...entry,version:'9.0.0'}]},undefined,200],
      ['missing-module',{...index,packages:[entry]},'',404],
      ['size-mismatch',{...index,packages:[entry]},'bad',200],
      ['digest-mismatch',{...index,packages:[{...entry,bytes:3} ]},'bad',200],
      ['html-fallback',{...index,packages:[entry]},'<html></html>',200],
    ] as const){
      const check=await browser.newPage();
      await check.route('**/procedural-modules/index.json',route=>route.fulfill({status:name==='missing-index'?404:200,contentType:'application/json',body:JSON.stringify(manifest??{})}));
      if(body!==undefined)await check.route('**/'+entry.url,route=>route.fulfill({status,contentType:name==='html-fallback'?'text/html':'text/javascript',body}));
      await check.goto(new URL('/asset/bench',base).href);await check.waitForSelector('.download-card');
      await check.waitForLoadState('networkidle');
      assert.equal(await check.locator('.procedural-download').isVisible(),true,name);
      assert.match(await check.locator('.procedural-download-status').innerText(),/unavailable/,name);
      assert.equal(await check.getByRole('button',{name:'Retry procedural download',exact:true}).isVisible(),true,name);
      assert.equal(await check.locator('#procedural-module').getAttribute('href'),null,name);
      failures.push(name);await check.close();
    }
    await writeFile(join(output,'receipt.json'),JSON.stringify({module:entry,currentDesign:design,failures,snippet},null,2));
  }finally{await browser.close();}
});

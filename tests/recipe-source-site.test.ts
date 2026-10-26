import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { sha256 } from '../scripts/provenance.ts';

test('source ZIP download matches metadata and contribution files are discoverable', {timeout:45000}, async()=>{
  const base=process.env.RECIPE_SITE_URL,output=process.env.RECIPE_SITE_EVIDENCE_ROOT;
  assert.ok(base && output,'Use npm run test:browser with RECIPE_SITE_URL and fresh TEST_EVIDENCE_ROOT');
  assert.ok(resolve(output).startsWith(resolve('evidence')+'/'));
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    const index=await (await page.request.get(new URL('/recipe-packages/index.json',base).href)).json();
    const entry=index.packages.find((p:{id:string;version:string})=>p.id==='bench'&&p.version==='1.1.0');
    assert.ok(entry,'Build the default bench source package before this integration check');
    await page.goto(new URL('/asset/bench',base).href);
    await page.locator('#generator-source').waitFor({state:'visible'});
    assert.match((await page.locator('#generator-source').getAttribute('href'))!,/^blob:/);
    assert.match(await page.locator('.source-download').innerText(),/default design.*Save design/s);
    assert.equal(await page.locator('#export-module').innerText(),'Snapshot .mjs');
    const downloadEvent=page.waitForEvent('download');await page.locator('#generator-source').click();
    const download=await downloadEvent;assert.equal(download.suggestedFilename(),entry.url.split('/').at(-1));await download.saveAs(join(output,'bench-source.zip'));
    const bytes=await readFile(join(output,'bench-source.zip'));
    assert.equal(bytes.length,entry.bytes);assert.equal(sha256(bytes),entry.sha256);
    await page.screenshot({path:join(output,'bench-source-download.png'),fullPage:true});
    await page.locator('.site-navigation a[href="/contribute"]').click();
    await page.locator('.contribute-page').waitFor({state:'visible'});
    assert.match(await page.locator('.contribute-page').innerText(),/no configured submission destination/);
    assert.equal(await page.locator('.contribute-page li').count(),4);
    const guideEvent=page.waitForEvent('download');await page.getByRole('link',{name:'Download authoring guide',exact:true}).click();
    const guide=await guideEvent;await guide.saveAs(join(output,'authoring-guide.md'));
    assert.ok((await readFile(join(output,'authoring-guide.md'),'utf8')).length>1000);
    assert.equal(new URL(page.url()).pathname,'/contribute');
    await page.screenshot({path:join(output,'contribute.png'),fullPage:true});
    await writeFile(join(output,'source-download-receipt.json'),JSON.stringify({id:entry.id,version:entry.version,sha256:entry.sha256,bytes:entry.bytes,guideDownloaded:true},null,2),{flag:'wx'});
    for(const [label,manifest,missing] of [
      ['wrong-version',{formatVersion:index.formatVersion,packages:[{...entry,version:'9.0.0'}]},false],
      ['external-url',{formatVersion:index.formatVersion,packages:[{...entry,url:'https://invalid.example/source.zip'}]},false],
      ['missing-file',{formatVersion:index.formatVersion,packages:[entry]},true],
    ] as const) {
      const check=await browser.newPage();
      await check.route('**/recipe-packages/index.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
      if(missing)await check.route('**/'+entry.url,route=>route.fulfill({status:404,body:''}));
      await check.goto(new URL('/asset/bench',base).href);
      await check.waitForSelector('.download-card');
      await check.evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);});
      await check.waitForFunction(()=>document.querySelector('.source-download [role="status"]')?.textContent?.includes('unavailable'));
      assert.equal(await check.locator('.source-download').isVisible(),true,label);
      assert.equal(await check.getByRole('button',{name:'Retry source download',exact:true}).isVisible(),true,label);
      assert.equal(await check.locator('#generator-source').getAttribute('href'),null,label);
      await check.close();
    }
  }finally{await browser.close();}
});

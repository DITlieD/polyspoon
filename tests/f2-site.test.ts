import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { catalog } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';
import { sha256 } from '../scripts/provenance.ts';

test('twelve catalog pages expose real thumbnails presets palettes and verified source downloads',{timeout:180000},async()=>{
  await mkdir('evidence/revision7/catalog/site',{recursive:true});
  const output=await mkdtemp('evidence/revision7/catalog/site/run-');
  const server=process.env.F2_SITE_URL?undefined:await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server?.listen();
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const errors:string[]=[],results:unknown[]=[];
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    const url=process.env.F2_SITE_URL??server!.resolvedUrls!.local[0]!;
    await page.goto(url);await page.waitForSelector('.asset-card');assert.equal(await page.locator('.asset-card').count(),12);
    for (const d of catalog) {
      const card=page.locator('.asset-card[href="/asset/'+d.id+'"]');
      assert.equal(await card.locator('img').count(),1,d.id);
    }
    for (const d of catalog) {
      await page.goto(url+'asset/'+d.id);await page.waitForSelector('#generator-source[href]');
      assert.equal(await page.locator('.preset-grid button').count(),d.presets.length);
      const download=await page.locator('#generator-source').getAttribute('href');assert.ok(download);
      const response=await page.request.get(download);assert.ok(response.ok());const bytes=await response.body();
      assert.equal(sha256(bytes),await page.locator('#generator-source').getAttribute('data-sha256'));
      await page.getByRole('button',{name:'Material palettes',exact:true}).click();
      await page.locator('.colorway').first().click();
      assert.equal(await page.locator('#error').textContent(),'');
      const images=await page.locator('.preset-grid img').evaluateAll(async nodes=>Promise.all(nodes.map(async n=>{const image=n as HTMLImageElement;await image.decode();return image.naturalWidth;})));
      assert.ok(images.every(width=>width>=128));
      for(const preset of d.presets) {
        await page.locator('button[data-preset="'+preset.id+'"]').click();
        assert.equal(await page.locator('button[data-preset="'+preset.id+'"]').getAttribute('aria-pressed'),'true');
      }
      results.push({family:d.id,presets:d.presets.length,sourceSha256:sha256(bytes),kitMember:recipe(d.id).presentation.kitIds.includes('woodland-workshop')});
    }
    await page.goto(url+'kit/woodland-workshop');
    const members=catalog.filter(d=>recipe(d.id).presentation.kitIds.includes('woodland-workshop')).length;
    assert.equal(await page.locator('.version-pill').textContent(),members+' families');
    await page.setViewportSize({width:1264,height:1000});
    await page.goto(url+'asset/treasure-chest');
    for(const key of ['width','depth','bodyHeight','lidRise','lidAngle','boardCount'])assert.equal(await page.locator('.tool-rail [data-control="'+key+'"]').count(),1,key);
    async function descriptionWidths() {
      return page.locator('.preset-grid button').evaluateAll(cards=>cards.map(card=>{
        const text=card.querySelector('span')!.getBoundingClientRect(),bounds=card.getBoundingClientRect();
        return {card:bounds.width,text:text.width};
      }));
    }
    const thumbnailWidths=await descriptionWidths();
    assert.ok(thumbnailWidths.every(x=>x.text>x.card*0.8));
    await page.locator('.tool-rail [data-control="lidAngle"]').click();
    const lid=page.getByRole('spinbutton',{name:'Lid opening',exact:true});
    await lid.fill('100');await lid.press('Enter');assert.equal(await lid.inputValue(),'100');
    await page.locator('#undo').click();assert.equal(await lid.inputValue(),'0');
    await page.locator('.preset-grid img').evaluateAll(images=>images.forEach(image=>{
      const fallback=document.createElement('div');fallback.className='thumbnail-placeholder';fallback.textContent='Preview in editor';image.replaceWith(fallback);
    }));
    const fallbackWidths=await descriptionWidths();
    assert.ok(fallbackWidths.every(x=>x.text>x.card*0.8));
    assert.deepEqual(errors,[]);
    await writeFile(join(output,'coverage.json'),JSON.stringify({families:12,url,results,errors,chest:{viewport:1264,primaryControls:['width','depth','bodyHeight','lidRise','lidAngle','boardCount'],thumbnailWidths,fallbackWidths,lidEditAndUndo:true}},null,2));
    assert.ok((await readFile('src/site/site.ts','utf8')).includes('kitEntries().length'));
  } finally {await browser.close();await server?.close();}
});

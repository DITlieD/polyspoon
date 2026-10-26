import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { catalog, buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';

const poseable=catalog.filter(d=>{const b=buildAsset(d.id);try{return b.semantics.joints.length>0;}finally{disposeAsset(b);}}).map(d=>d.id);
test('individual catalog filters, URLs, model returns and legacy kit redirect preserve discovery',{timeout:60000},async()=>{
  const base=process.env.RECIPE_SITE_URL,output=process.env.DISCOVERY_SITE_EVIDENCE_ROOT??process.env.RECIPE_SITE_EVIDENCE_ROOT;
  assert.ok(base&&output);assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname));
  assert.ok(resolve(output).startsWith(resolve('evidence')+'/'));await mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const errors:string[]=[],requests:string[]=[];
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.resourceType()==='document')requests.push(r.url());});
    await page.goto(new URL('/catalog',base).href);await page.locator('.asset-card').first().waitFor();
    await page.screenshot({path:join(output,'catalog-initial.png'),fullPage:true});
    assert.equal(await page.locator('.site-brand').innerText(),'Polyspoon');
    assert.equal(await page.locator('.asset-card').count(),catalog.length);
    assert.equal(await page.locator('a[href*="/kit/"]').count(),0);
    assert.doesNotMatch(await page.locator('body').innerText(),/Woodland|The kit|Part of Woodland|whole kit/i);
    await page.locator('#catalog-type').selectOption('Props');await page.locator('#catalog-style').selectOption('faceted-low-poly');await page.locator('#catalog-capability').selectOption('poseable');
    const expected=poseable.filter(id=>recipe(id).presentation.category==='Props');
    assert.deepEqual((await page.locator('.asset-card').evaluateAll(cards=>cards.map(c=>c.getAttribute('data-model')))).sort(),expected.sort());
    const filtered=page.url();await page.reload();await page.locator('.asset-card').first().waitFor();assert.equal(page.url(),filtered);
    await page.screenshot({path:join(output,'catalog-combined.png'),fullPage:true});
    await page.locator('.asset-card').first().click();await page.locator('.asset-workspace').waitFor({state:'visible'});
    assert.equal(await page.locator('.viewer-kit').count(),0);assert.equal(await page.locator('.preset-card').count(),descriptorPresetCount(new URL(page.url()).pathname.split('/').pop()!));
    assert.equal(await page.locator('.site-brand').getAttribute('href'),'/');
    assert.equal(await page.locator('.site-navigation').getByRole('link',{name:'Models',exact:true}).getAttribute('href'),'/catalog'+new URL(filtered).search);
    await page.locator('.breadcrumb').click();assert.equal(page.url(),filtered);
    await page.goBack();await page.locator('.asset-workspace').waitFor({state:'visible'});await page.goBack();await page.locator('.catalog-page').waitFor({state:'visible'});assert.equal(page.url(),filtered);
    await page.goForward();await page.locator('.asset-workspace').waitFor({state:'visible'});await page.locator('.breadcrumb').click();
    await page.locator('#catalog-search').fill('zz-no-model');await page.locator('.empty-state').waitFor({state:'visible'});assert.equal(await page.locator('.asset-card').count(),0);
    await page.screenshot({path:join(output,'catalog-empty.png'),fullPage:true});
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();assert.equal(await page.locator('.asset-card').count(),catalog.length);assert.equal(new URL(page.url()).search,'');
    await page.locator('#catalog-search').fill('work-lantern');assert.equal(await page.locator('.asset-card').count(),1);
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.locator('#catalog-sort').selectOption('name-desc');
    const names=await page.locator('.asset-card h2').allTextContents();assert.deepEqual(names,[...names].sort((a,b)=>b.localeCompare(a)));
    await page.goto(new URL('/kit/woodland-workshop?type=Nature',base).href);await page.locator('.asset-card').first().waitFor();assert.equal(new URL(page.url()).pathname,'/catalog');assert.equal(await page.locator('#catalog-type').inputValue(),'Nature');assert.equal(await page.locator('.viewer-kit').count(),0);
    await page.setViewportSize({width:390,height:844});await page.goto(new URL('/catalog?type=Nature&style=faceted-low-poly',base).href);await page.locator('.asset-card').first().waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const id of ['catalog-search','catalog-type','catalog-style','catalog-capability','catalog-sort'])assert.ok(await page.locator('#'+id).isVisible());
    await page.locator('#catalog-search').focus();assert.equal(await page.locator('#catalog-search').evaluate(e=>e===document.activeElement),true);
    await page.screenshot({path:join(output,'catalog-narrow.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});await page.goto(new URL('/asset/bench?type=Props',base).href);await page.locator('.asset-workspace').waitFor({state:'visible'});
    await page.getByRole('tab',{name:'Shape',exact:true}).click();await page.locator('#width-slider').fill('2.1');await page.locator('#width-slider').dispatchEvent('change');
    const saved=page.waitForEvent('download');await page.locator('#save').click();await (await saved).saveAs(join(output,'bench-edited.design.json'));assert.equal(JSON.parse(await readFile(join(output,'bench-edited.design.json'),'utf8')).applied.width,2.1);
    const exported=page.waitForEvent('download');await page.locator('#export').click();await (await exported).saveAs(join(output,'bench-edited.glb'));const bytes=await readFile(join(output,'bench-edited.glb'));assert.equal(bytes.readUInt32LE(0),0x46546c67);
    await page.screenshot({path:join(output,'bench-edited.png'),fullPage:true});await page.locator('.breadcrumb').click();assert.equal(await page.locator('#catalog-type').inputValue(),'Props');
    assert.deepEqual(errors,[]);await writeFile(join(output,'discovery-receipt.json'),JSON.stringify({base,models:catalog.length,presets:catalog.reduce((n,d)=>n+d.presets.length,0),poseable,filtered,requests,errors,glbBytes:bytes.length},null,2)+'\n');
  }finally{await browser.close();}
});
function descriptorPresetCount(id:string){return catalog.find(d=>d.id===id)!.presets.length;}

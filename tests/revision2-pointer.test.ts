import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer, preview } from 'vite';
import { mkdir,writeFile } from 'node:fs/promises';
import { sourceProvenance } from '../scripts/provenance.ts';

test('actual pointer picking selects semantic role and orbit drag never selects',{timeout:60000},async()=>{
  const integration=process.env.INTEGRATION_EVIDENCE_ROOT;
  const server=integration ? await preview({build:{outDir:integration+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'}) : await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
  if('listen' in server) await server.listen();
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    const beforeSource=await sourceProvenance();
    await page.goto(server.resolvedUrls!.local[0]!+'editor');
    await page.selectOption('#family','boulder');
    await page.waitForTimeout(200);
    const canvas=(await page.locator('#canvas-host canvas').boundingBox())!;
    const point={x:canvas.x+canvas.width/2,y:canvas.y+canvas.height/2};
    assert.equal(await page.locator('#selection-note').isHidden(),true);
    await page.mouse.move(point.x,point.y);
    await page.mouse.down();
    await page.mouse.move(point.x+70,point.y+20,{steps:10});
    await page.mouse.up();
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#selection-note').isHidden(),true);
    assert.equal(await page.locator('.parameter.selected').count(),0);
    await page.locator('#frame').click();
    await page.waitForTimeout(200);
    await page.mouse.click(point.x,point.y);
    await page.waitForFunction(()=>!document.getElementById('selection-note')!.hidden);
    assert.equal(await page.locator('.parameter.selected').getAttribute('data-key'),'color.stone');
    assert.match(await page.locator('#selection-note').textContent()??'',/all stone pieces/);
    assert.equal(await page.locator('button[data-group="colors"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[id="color.stone"]').evaluate(node=>document.activeElement===node),true);
    const pickedValue=await page.locator('[id="color.stone"]').inputValue();
    await page.selectOption('#family','crate');
    await page.selectOption('#family','boulder');
    assert.equal(await page.locator('button[data-group="colors"]').getAttribute('aria-pressed'),'true');
    const region=page.locator('[data-key="color.stone"] .region-name');
    await region.focus();await region.press('Enter');
    assert.equal(await page.locator('.parameter.selected').getAttribute('data-key'),'color.stone');
    assert.equal(await page.locator('[id="color.stone"]').inputValue(),pickedValue);
    assert.deepEqual(errors,[]);
    const directory=integration?integration+'/editor':'evidence/revision2/editor';
    await mkdir(directory,{recursive:true});
    await writeFile(directory+'/pointer-verification.json',JSON.stringify({
      beforeSource,afterSource:await sourceProvenance(),browser:browser.version(),family:'boulder',viewport:{width:1440,height:960},canvas,point,
      operations:['left-pointer drag 70px horizontally and 20px vertically in 10 steps','Frame','left-pointer click at canvas center','switch crate then boulder','keyboard Enter on semantic region button'],
      results:{dragDidNotSelect:true,pointerSelectedRole:'stone',colorsInspectorOpened:true,colorInputFocused:true,keyboardSelectionEquivalent:true,selectionDidNotChangeColor:true},
      selectors:{canvas:'#canvas-host canvas',selectedRegion:'.parameter.selected[data-key="color.stone"]',colorInput:'[id="color.stone"]',regionButton:'[data-key="color.stone"] .region-name',scopeNotice:'#selection-note',colorsRail:'button[data-group="colors"]'},
      errors
    },null,2));
  }finally{await browser.close();await server.close();}
});

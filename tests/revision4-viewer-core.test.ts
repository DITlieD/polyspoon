import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { sourceProvenance } from '../scripts/provenance.ts';

test('viewer core renders corrected layout and eight working tools',{timeout:120000},async()=>{
 const output=process.env.VIEWER_EVIDENCE_ROOT??'evidence/revision4/viewer-core';
 await mkdir(output,{recursive:true});
 const server=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/previews/workshop-scene.png']}},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:810},acceptDownloads:true}),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push(message.text());});
 const base=server.resolvedUrls!.local[0]!;
 try{
  await page.goto(base+'kit/woodland-workshop');
  await page.locator('canvas').waitFor();
  if(!process.env.VIEWER_REUSE_THUMBNAIL)await page.locator('canvas').screenshot({path:'src/site/previews/workshop-scene.png'});
  await page.goto(base+'asset/fence');
  await page.locator('.download-card').waitFor();
  assert.equal(await page.locator('.inspector').isVisible(),false);
  assert.equal(await page.locator('.display-popover').isVisible(),false);
  await page.screenshot({path:output+'/desktop-default-fence.png',fullPage:true});
  const fence=buildAsset('fence',{length:2,bays:1,railCount:2,height:1.1});
  const payload=Buffer.from(JSON.stringify(fence.config));disposeAsset(fence);
  await page.locator('#file').setInputFiles({name:'reference.design.json',mimeType:'application/json',buffer:payload});
  await page.waitForFunction(()=>document.getElementById('notice')?.textContent==='Design loaded.');
  await page.screenshot({path:output+'/desktop-reference-fence.png',fullPage:true});
  await page.locator('.tool-rail [data-control]').first().click();
  assert.equal(await page.locator('.parameter:visible').count(),1);
  await page.screenshot({path:output+'/desktop-model-control.png',fullPage:true});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Palette',exact:true}).click();
  await page.getByRole('combobox',{name:'Palette',exact:true}).selectOption('PICO8');
  await page.screenshot({path:output+'/desktop-effect-popover.png',fullPage:true});
  await page.keyboard.press('Escape');
  const checks:Record<string,boolean>={};
  const pixels=()=>page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL());
  for(const [label,choice] of [['Palette','None'],['Shading','Flat'],['Underwater','Reef'],['Dither','Coarse4'],['Wobble','PS1'],['Outline','Heavy4px'],['Wireframe','Ghost'],['Pixelate','eighth']]){
   await page.getByRole('button',{name:label!,exact:true}).click();
   const before=await pixels();
   await page.getByRole('combobox',{name:label!,exact:true}).selectOption(choice!);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:output+'/effect-'+label!.toLowerCase()+'.png',fullPage:true});
   checks[label!]=(await pixels())!==before;
   assert.equal(checks[label!],true,label+' must change rendered output');
   await page.getByRole('combobox',{name:label!,exact:true}).selectOption('None');await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'Recolor individual parts',exact:true}).click();
  await page.getByRole('combobox',{name:'Part to recolor',exact:true}).selectOption('rail-0-0');
  await page.getByLabel('Selected part color',{exact:true}).fill('#ff0000');
  await page.getByLabel('Selected part color',{exact:true}).dispatchEvent('change');
  await page.screenshot({path:output+'/individual-rail-recolor.png',fullPage:true});
  const pending=page.waitForEvent('download');await page.locator('#save').click();const saved=await pending;await saved.saveAs(output+'/recolored.design.json');
  const config=JSON.parse(await (await import('node:fs/promises')).readFile(output+'/recolored.design.json','utf8'));
  assert.deepEqual(config.appearance.partColors,{'rail-0-0':'#ff0000'});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'/mobile-reference-fence.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const kit=await page.locator('.viewer-kit').boundingBox(),card=await page.locator('.download-card').boundingBox(),usage=await page.locator('.usage-panel').boundingBox();
  assert.ok(kit&&card&&usage&&card.y>=kit.y+kit.height&&card.y<kit.y+kit.height+30&&card.y<usage.y);
  assert.deepEqual(errors,[]);
  await writeFile(output+'/receipt.json',JSON.stringify({checks,errors,provenance:await sourceProvenance()},null,2));
 }catch(error){await page.screenshot({path:output+'/failure.png',fullPage:true});await writeFile(output+'/failure.json',JSON.stringify({errors,error:String(error)},null,2));throw error;}
 finally{await browser.close();await server.close();}
});

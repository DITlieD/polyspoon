import '../scripts/node-platform.ts';
import assert from 'node:assert/strict';
import {preview} from 'vite';
import {chromium} from 'playwright-core';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset} from '../src/catalog/export.ts';
import {sourceProvenance,sha256} from '../scripts/provenance.ts';

export async function runMaterialProduction(integration:string){
 const output=integration+'/material';await mkdir(output,{recursive:true});
 const server=await preview({build:{outDir:integration+'/build'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true}),errors:string[]=[],records:unknown[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);});
 const mode=async(value:string)=>{await page.selectOption('#mode',value);await settle();};
 const pixels=()=>page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL());
 try{
  await page.goto(server.resolvedUrls!.local[0]+'?diagnostic=1');
  await page.evaluate(()=>{document.body.classList.remove('diagnostic');(window.workshopDiagnostics as unknown as {diagnostic(v:boolean):void}).diagnostic(false);});
  for(const shading of ['None','Flat','Toon3bands'] as const){
   const input={toneVariation:.1,'color.wood':'#765b42',...(shading==='None'?{}:{appearance:{version:1,palette:'None',shading,partColors:{}}})};
   const built=buildAsset('crate',input),configuration=built.config,expected=await exportAsset(built);
   disposeAsset(built);
   await page.locator('#file').setInputFiles({name:'crate.design.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(configuration))});
   await page.waitForFunction(()=>document.getElementById('notice')?.textContent==='Design loaded.');await mode('shaded');
   const initial=await pixels();
   const outputs:Record<string,string>={shaded:sha256(initial)};
   for(const value of ['clay','color','silhouette','shaded']){await mode(value);outputs[value]=sha256(await pixels());}
   assert.equal(await pixels(),initial,shading+' exact shaded pixels restore');
   assert.notEqual(outputs.clay,outputs.shaded,shading+' clay must be visibly distinct');
   const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending,bytes=await readFile((await download.path())!);
   assert.deepEqual(new Uint8Array(bytes),expected,shading+' browser export equals canonical asset');
   await page.screenshot({path:output+'/'+shading+'-restored.png',fullPage:true});
   records.push({shading,modeHashes:outputs,glbSha256:sha256(bytes),restoredExactly:true});
  }
  await page.goto(server.resolvedUrls!.local[0]+'asset/crate');
  await page.getByRole('button',{name:'More controls',exact:true}).click();
  await page.locator('#toneVariation').fill('0.1');await page.locator('#toneVariation').press('Enter');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Shading',exact:true}).click();await page.getByRole('combobox',{name:'Shading',exact:true}).selectOption('Flat');await page.keyboard.press('Escape');await settle();
  const varied=await pixels();
  await page.getByRole('button',{name:'More controls',exact:true}).click();await page.locator('#toneVariation').fill('0');await page.locator('#toneVariation').press('Enter');await page.keyboard.press('Escape');await settle();
  assert.notEqual(await pixels(),varied,'normal-site tone widget changes unlit board appearance');
  assert.deepEqual(errors,[]);await writeFile(output+'/receipt.json',JSON.stringify({records,normalSiteToneChanged:true,errors,provenance:await sourceProvenance(),adaptations:['Current More controls and Shading Flat replace hidden historical site selectors.','Canonical export bytes replace raw-hex tone expectations that omitted authored timber adjustment.']},null,2));
 }catch(error){await page.screenshot({path:output+'/first-failure.png',fullPage:true});await writeFile(output+'/failure.json',JSON.stringify({error:String(error),errors,records},null,2));throw error;}
 finally{await browser.close();await server.close();}
}

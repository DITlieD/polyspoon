import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
import { sourceProvenance } from '../scripts/provenance.ts';

test('Inspect parts synchronizes Creases and Ghost overlays and restores all lines',{timeout:60000},async()=>{
 const output='evidence/revision4/visibility-lines/corrected';await mkdir(output,{recursive:true});
 const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:810}}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(server.resolvedUrls!.local[0]+'asset/fence');await page.locator('.part-inspector summary').click();
  const mode=async(value:string)=>{await page.getByRole('button',{name:'Wireframe',exact:true}).click();await page.getByRole('combobox',{name:'Wireframe',exact:true}).selectOption(value);await page.keyboard.press('Escape');};
  const capture=async(name:string)=>{await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});const url=await page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL());await writeFile(output+'/'+name+'.png',Buffer.from(url.split(',')[1]!,'base64'));return url;};
  const checks:Record<string,unknown>={};
  for(const value of ['Creases','Ghost']){
   await mode(value);const initial=await capture(value+'-shown');
   await page.locator('.part-list input').evaluateAll(inputs=>{for(const input of inputs as HTMLInputElement[]){input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));}});
   const hidden=await capture(value+'-hidden');await mode('None');const reference=await capture(value+'-hidden-reference');
   assert.equal(hidden,reference,value+' hidden overlays must match the empty ordinary stage');
   await mode(value);await page.getByRole('button',{name:'Show all parts',exact:true}).click();const restored=await capture(value+'-restored');
   assert.equal(restored,initial,value+' restoring visibility must restore all original lines');
   checks[value]={hiddenMatchesEmpty:true,restoredMatchesInitial:true};
  }
  assert.deepEqual(errors,[]);await writeFile(output+'/receipt.json',JSON.stringify({checks,errors,provenance:await sourceProvenance()},null,2));
 }finally{await browser.close();await server.close();}
});

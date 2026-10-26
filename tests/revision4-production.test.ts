import test from 'node:test';
import assert from 'node:assert/strict';
import { build,preview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir,writeFile,readFile,readdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { sourceProvenance,sha256 } from '../scripts/provenance.ts';
import { catalog } from '../src/catalog/index.ts';

test('final production build and six-family catalog capture',{timeout:120000},async()=>{
 const root=process.env.PRODUCTION_EVIDENCE_ROOT??'evidence/revision4/final-production';await mkdir(root,{recursive:true});
 const before=await sourceProvenance();
 if(!process.env.PRODUCTION_REUSE_BUILD)await build({build:{outDir:resolve(root,'build')},logLevel:'error'});
 const server=await preview({build:{outDir:resolve(root,'build')},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:810},deviceScaleFactor:1}),errors:string[]=[],optionalResourceWarnings:string[]=[],files:Record<string,string>={};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{
  if(message.type()!=='error')return;
  const url=message.location().url,text=message.text()+' at '+url;
  if(new URL(url||'about:blank').pathname==='/favicon.ico')optionalResourceWarnings.push(text);else errors.push(text);
 });
 const base=server.resolvedUrls!.local[0]!;
 const capture=async(name:string)=>{
  await page.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
  const bytes=await page.screenshot({path:root+'/'+name+'.png',fullPage:true});files[name+'.png']=sha256(bytes);
 };
 try{
  await page.goto(base);await page.locator('.asset-card').first().waitFor();
  assert.equal(await page.locator('.asset-card').count(),6);
  await page.locator('.asset-card img').evaluateAll(imgs=>Promise.all(imgs.map(image=>(image as HTMLImageElement).decode())));
  await capture('desktop-catalog');
  await page.locator('#catalog-search').fill('tree');assert.equal(await page.locator('.asset-card').count(),1);
  await page.locator('#catalog-search').fill('');
  for(const family of catalog){
   await page.goto(base+'asset/'+family.id);
   await page.locator('.download-card').waitFor();
   assert.equal(await page.locator('.inspector').isVisible(),false);
   assert.equal(await page.locator('.preset-card').count(),3);
   assert.equal(await page.getByRole('button',{name:'Material palettes',exact:true}).count(),1);
   await capture('desktop-'+family.id);
  }
  await page.goto(base+'kit/woodland-workshop');await capture('desktop-kit');
  await page.setViewportSize({width:390,height:844});await page.goto(base);await capture('mobile-catalog');
  for(const family of catalog){
   await page.goto(base+'asset/'+family.id);await capture('mobile-'+family.id);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,family.id);
  }
  await writeFile(root+'/page-errors.json',JSON.stringify(errors,null,2));
  assert.deepEqual(errors,[]);
  const after=await sourceProvenance();assert.equal(before.sourceHash,after.sourceHash,'production inputs must remain frozen');
  const artifacts:Record<string,string>={};
  async function scan(directory:string){
   for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);if(entry.isDirectory())await scan(path);else artifacts[path]=sha256(await readFile(path));
   }
  }
  await scan(root+'/build');
  await writeFile(root+'/manifest.json',JSON.stringify({generatedAt:new Date().toISOString(),before,after,files,artifacts,errors,optionalResourceWarnings,browser:browser.version(),families:catalog.map(family=>({id:family.id,version:family.version,presets:family.presets.map(p=>p.id)}))},null,2));
 }finally{await browser.close();await server.close();}
});

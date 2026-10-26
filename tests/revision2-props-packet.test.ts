import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { descriptor,buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';
import { validateBytes } from 'gltf-validator';
import { sourceProvenance,sha256 } from '../scripts/provenance.ts';
import type { Design } from '../src/catalog/index.ts';

test('prop render packet and production exports',{timeout:120000},async()=>{
 const output='evidence/revision2/props-r5';
 await mkdir(output+'/exports',{recursive:true});await mkdir(output+'/renders',{recursive:true});
 const before=await sourceProvenance(),files:Record<string,string>={},renders:unknown[]=[],exports:unknown[]=[];
 const server=await createServer({cacheDir:'.runtime/r5-props-vite',server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:1});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(server.resolvedUrls!.local[0]+'?diagnostic=1');await page.waitForFunction(()=>Boolean(window.workshopDiagnostics));
  const capture=async(family:string,name:string,input:Record<string,unknown>,view='oblique',mode='shaded')=>{
   const config=await page.evaluate(({family,input,view,mode})=>{
    const api=window.workshopDiagnostics as unknown as {select(id:string):boolean;apply(p:unknown):boolean;view(v:string):void;mode(m:string):void;configuration():Design;render():void};
    if(!api.select(family)||!api.apply(input))throw new Error('Invalid capture configuration');
    api.mode(mode);api.view(view);api.render();return api.configuration();
   },{family,input,view,mode});
   await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
   const path='renders/'+family+'-'+name+'.png';
   files[path]=sha256(await page.screenshot({path:output+'/'+path}));
   renders.push({path,config,configHash:sha256(JSON.stringify(config)),view,mode,framing:'bounds-normalized',size:[900,900]});
  };
  const extra=[
   {family:'fence',name:'braced-flat',input:{railStyle:'cross-braced',postHead:'flat'}},
   {family:'fence',name:'scene',input:{detail:'scene'}},
   {family:'fence',name:'short-braced',input:{length:1.2,height:0.7,bays:2,railStyle:'cross-braced'}},
   {family:'fence',name:'long-braced',input:{length:6,height:1.5,bays:3,railStyle:'cross-braced'}},
   {family:'crate',name:'open-braced',input:{lid:'open-top'}},
   {family:'crate',name:'open-plain',input:{lid:'open-top',brace:'plain',detail:'scene'}},
   {family:'crate',name:'closed-plain',input:{brace:'plain',detail:'scene'}},
   {family:'crate',name:'small-open',input:{width:0.45,height:0.35,depth:0.4,lid:'open-top'}},
   {family:'crate',name:'tall-closed',input:{width:0.75,height:1.2,depth:0.75,lid:'closed'}},
  ];
  for(const family of ['fence','crate']){
   for(const view of ['front','right','oblique'])await capture(family,'default-'+view,{},view);
   for(const mode of ['clay','silhouette'])await capture(family,'default-'+mode,{},'oblique',mode);
   for(const preset of descriptor(family).presets.slice(1))await capture(family,'preset-'+preset.id,preset.parameters);
  }
  for(const entry of extra)await capture(entry.family,entry.name,entry.input);
  const exportCases=[...['fence','crate'].flatMap(family=>descriptor(family).presets.map(p=>({family,name:p.id,input:p.parameters}))),...extra];
  for(const entry of exportCases){
   const build=buildAsset(entry.family,entry.input);
   try{
    const bytes=await exportAsset(build),validation=await validateBytes(bytes);
    assert.equal(validation.issues.numErrors,0);assert.equal(validation.issues.numWarnings,0);
    const path='exports/'+entry.family+'-'+entry.name+'.glb';
    await writeFile(output+'/'+path,bytes);files[path]=sha256(bytes);
    exports.push({path,configuration:build.config,configurationHash:sha256(JSON.stringify(build.config)),anchors:build.anchors,dimensions:build.dimensions.toArray(),geometry:inspectGeometry(build.root),validation:validation.issues});
   }finally{disposeAsset(build);}
  }
  await page.setViewportSize({width:1200,height:900});
  await page.evaluate(()=>{const api=window.workshopDiagnostics as unknown as {showWorkshop():void;mode(m:string):void;view(v:string):void};api.mode('shaded');api.showWorkshop();api.view('oblique');});
  await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
  files['renders/kit-context.png']=sha256(await page.screenshot({path:output+'/renders/kit-context.png'}));
  assert.deepEqual(errors,[]);
  const after=await sourceProvenance();
  const changed=Object.keys(before.sources).filter(path=>before.sources[path]!==after.sources[path]);
  assert.equal(changed.some(path=>['src/families/fence.ts','src/families/crate.ts'].includes(path)),false);
  await writeFile(output+'/manifest.json',JSON.stringify({before,after,changedDuringCapture:changed,files,renders,exports,browser:browser.version(),errors},null,2));
 }finally{await browser.close();await server.close();}
});


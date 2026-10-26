import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { catalog, descriptor } from '../src/catalog/index.ts';
import type { Design } from '../src/catalog/index.ts';
import { sourceProvenance, sha256 } from '../scripts/provenance.ts';
import { validateBytes } from 'gltf-validator';

interface Api {
  select(id:string):boolean; apply(input:unknown):boolean; configuration():Design;
  memory():{geometries:number;textures:number}; render():void; projected():number[][];
  mode(mode:string):void; diagnostic(enabled:boolean):void;
}
test('six-family studio production behavior, races, disposal and viewport evidence', {timeout:120000}, async () => {
  const integration=process.env.INTEGRATION_EVIDENCE_ROOT;
  const production=integration || process.env.STUDIO_BUILD === '1' ? await preview({build:{outDir:integration?integration+'/build':'dist'},preview:{host:'127.0.0.1',port:0}}) : undefined;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
  const errors:string[]=[], files:Record<string,string>={};
  page.on('pageerror',e=>errors.push(e.message));
  const output=integration?integration+'/editor/catalog-regression':'evidence/revision2/editor/catalog-regression';
  await mkdir(output,{recursive:true});
  try {
    await page.goto((production?.resolvedUrls?.local[0] ?? process.env.STUDIO_URL ?? 'http://127.0.0.1:4173/')+'?diagnostic=1');
    await page.waitForFunction(()=>Boolean(window.workshopDiagnostics));
    await page.evaluate(()=>{document.body.classList.remove('diagnostic');(window.workshopDiagnostics as unknown as Api).diagnostic(false);});
    const config=()=>page.evaluate(()=>(window.workshopDiagnostics as unknown as Api).configuration());
    const select=async(id:string)=>{await page.selectOption('#family',id);};
    const capture=async(name:string)=>{
      await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);window.workshopDiagnostics.render();});
      files[name+'.png']=sha256(await page.screenshot({path:output+'/'+name+'.png',fullPage:true}));
    };
    assert.equal(await page.locator('#family option').count(),6);
    await capture('desktop-lantern');
    for(const d of catalog) {
      await select(d.id);
      for(const p of d.presets) {
        await page.selectOption('#preset',p.id);
        assert.deepEqual((await config()).applied,d.save(p.parameters).applied);
      }
      await page.locator('#reset').click();
      await capture('desktop-'+d.id);
    }
    await select('tree');
    await page.evaluate(()=>(window.workshopDiagnostics as unknown as Api).apply({height:5,seed:32}));
    assert.equal(await page.locator('#seed-value').textContent(),'32');
    await select('fence');
    assert.equal(await page.locator('#bays-value').textContent(),'2');
    await select('tree');assert.equal((await config()).applied.height,5);
    const valid=await config();
    assert.equal(await page.evaluate(()=>(window.workshopDiagnostics as unknown as Api).apply({seed:1.5})),false);
    assert.deepEqual(await config(),valid);
    assert.equal(await page.locator('#error').isVisible(),true);
    assert.equal(await page.locator('#save').isDisabled(),true);
    assert.equal(await page.locator('#export').isDisabled(),true);
    await page.locator('#seed').focus();await page.locator('#seed').press('Escape');
    assert.deepEqual(await config(),valid);
    assert.equal(await page.locator('#save').isDisabled(),false);
    const saveEvent=page.waitForEvent('download');await page.locator('#save').click();
    const save=await saveEvent;
    assert.equal(save.suggestedFilename(),'tree.design.json');
    assert.deepEqual(JSON.parse(await readFile((await save.path())!,'utf8')),valid);
    await select('crate');
    await page.locator('#file').setInputFiles({name:'tree.design.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(valid))});
    await page.waitForFunction(()=>(window.workshopDiagnostics as unknown as Api).configuration().family==='tree');
    assert.deepEqual(await config(),valid);
    await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...valid,familyVersion:'wrong'}))});
    await page.waitForFunction(()=>document.getElementById('notice')!.textContent!.startsWith('Load failed:'));
    assert.deepEqual(await config(),valid);
    await page.evaluate(`window.originalText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.releaseText=()=>window.originalText.call(this).then(resolve);});};`);
    await page.locator('#file').setInputFiles({name:'pending.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(descriptor('cottage').save({})))});
    await page.waitForFunction(`typeof window.releaseText==='function'`);
    await select('fence');
    await page.evaluate(`window.releaseText();File.prototype.text=window.originalText;`);
    await page.waitForTimeout(100);assert.equal((await config()).family,'fence');
    await select('tree');
    const snapshot=await config();
    await page.evaluate(`window.originalBuffer=FileReader.prototype.readAsArrayBuffer;FileReader.prototype.readAsArrayBuffer=function(blob){window.releaseBuffer=()=>window.originalBuffer.call(this,blob);};`);
    const exportEvent=page.waitForEvent('download');await page.locator('#export').click();
    await page.waitForFunction(`typeof window.releaseBuffer==='function'`);
    await select('crate');
    await page.evaluate(`FileReader.prototype.readAsArrayBuffer=window.originalBuffer;window.releaseBuffer();`);
    const exported=await exportEvent,bytes=await readFile((await exported.path())!);
    assert.equal(exported.suggestedFilename(),'tree.glb');
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const root=gltf.nodes.find((n:{name:string})=>n.name==='tree');
    assert.deepEqual(root.extras.configuration,snapshot);
    const validation=await validateBytes(bytes);assert.equal(validation.issues.numErrors,0);assert.equal(validation.issues.numWarnings,0);
    await select('work-lantern');
    const before=await page.evaluate(()=>(window.workshopDiagnostics as unknown as Api).memory());
    await page.evaluate(()=>{
      const api=window.workshopDiagnostics as unknown as Api;
      for(let i=0;i<72;i++){api.select(['tree','cottage','fence','crate','boulder','work-lantern'][i%6]!);api.mode(i%2?'shaded':'color');api.render();}
      api.mode('shaded');api.select('work-lantern');api.render();
    });
    const after=await page.evaluate(()=>(window.workshopDiagnostics as unknown as Api).memory());
    assert.deepEqual(after,before);
    await page.setViewportSize({width:390,height:844});
    for(const [family,input] of [['fence',{length:6,bays:3}],['cottage',{width:7.2}]] as const) {
      await select(family);await page.evaluate(input=>(window.workshopDiagnostics as unknown as Api).apply(input),input);
      await page.locator('#frame').click();
      await page.waitForTimeout(100);
      const projected=await page.evaluate(()=>(window.workshopDiagnostics as unknown as Api).projected());
      for(const p of projected) assert.ok(Math.abs(p[0]!)<0.99 && Math.abs(p[1]!)<0.99 && Math.abs(p[2]!)<1,JSON.stringify(p));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await capture('mobile-'+family+'-extreme');
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#show-workshop').click();await capture('workshop-desktop');
    await page.setViewportSize({width:390,height:844});await capture('workshop-mobile');
    await page.locator('#back-editor').click();assert.equal((await config()).family,'cottage');
    assert.deepEqual(errors,[]);
    await writeFile(output+'/manifest.json',JSON.stringify({provenance:await sourceProvenance(),productionBuild:Boolean(production),browser:browser.version(),files,checks:{families:6,presets:18,switches:72,before,after,errors,glbSnapshotFamily:'tree',narrowFraming:['fence-longest','cottage-widest']}},null,2));
    console.log(JSON.stringify({studio:'six-family passed',images:Object.keys(files).length,before,after}));
  } finally {await browser.close();await new Promise<void>((resolve,reject)=>{if(production) production.httpServer.close(error=>error?reject(error):resolve());else resolve();});}
});

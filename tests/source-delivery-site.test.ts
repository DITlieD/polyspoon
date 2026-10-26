import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { descriptor } from '../src/catalog/index.ts';
import { sha256,validatePackageFiles } from '../scripts/recipe-package-core.ts';
import { readPackageZip } from '../scripts/recipe-check.ts';

test('source delivery browser preserves exact revision filenames Retry and readiness',{timeout:45000},async()=>{
  const output=process.env.SOURCE_DELIVERY_SITE_EVIDENCE_ROOT,candidate=process.env.SOURCE_DELIVERY_CANDIDATE;
  assert.ok(output&&resolve(output).startsWith(resolve('evidence')+'/'));assert.ok(candidate&&resolve(candidate).startsWith(resolve('evidence/revision14/packages')+'/'));
  await mkdir(output,{recursive:false});
  const current=JSON.parse(await readFile(join(candidate,'index.json'),'utf8'));
  assert.equal(current.formatVersion,2);assert.equal(current.packages.length,1);
  const entry=current.packages[0];assert.equal(entry.id,'cottage');
  const legacyURL='recipe-packages/cottage-'+entry.version+'.zip',legacyBytes=await readFile(join('public',legacyURL));
  const legacyManifest=validatePackageFiles(readPackageZip(legacyBytes));assert.equal(legacyManifest.formatVersion,1);
  const legacyEntry={id:legacyManifest.recipe.id,version:legacyManifest.recipe.version,url:legacyURL,bytes:legacyBytes.length,sha256:sha256(legacyBytes),configuration:legacyManifest.configuration,licenses:legacyManifest.licenses};
  const legacy={formatVersion:1,packages:[legacyEntry]};
  let mode:'missing'|'current'|'legacy'='missing';const requests:{path:string;cache:string|undefined}[]=[];
  const design=descriptor('cottage').save({}),fixture='<!doctype html><div id="host"></div><script type="module">import {mountSourceDownload} from "/src/site/source-download.ts";let ready=true;const manager=mountSourceDownload(document.querySelector("#host"),()=>('+JSON.stringify(design)+'),()=>ready);window.setReady=value=>{ready=value;return manager.refresh()};manager.refresh();</script>';
  const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:4175,strictPort:true},plugins:[{name:'source-delivery-fixture',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    const path=req.url?.split('?')[0];
    if(path==='/source-delivery-fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
    if(path==='/recipe-packages/index.json'){
      requests.push({path,cache:req.headers['cache-control']});res.setHeader('Cache-Control','public, max-age=3600');
      if(mode==='missing'){res.statusCode=404;res.end('missing');return;}
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(mode==='legacy'?legacy:current));return;
    }
    const selected=mode==='legacy'?legacyEntry:entry;
    if(path==='/'+selected.url){requests.push({path,cache:req.headers['cache-control']});res.setHeader('Content-Type','application/zip');res.end(await readFile(mode==='legacy'?join('public',selected.url):join(candidate,selected.url.split('/').at(-1))));return;}
    next();
  });}}]});
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  try{
    await server.listen();browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--disable-dev-shm-usage']});
    const page=await browser.newPage({acceptDownloads:true});await page.goto('http://127.0.0.1:4175/source-delivery-fixture');
    await page.waitForFunction(()=>document.querySelector('.source-download [role="status"]')?.textContent?.includes('unavailable'));
    assert.equal(await page.locator('#generator-source').getAttribute('href'),null);
    assert.ok(await page.locator('#procedural-current-design').getAttribute('href'));
    await page.evaluate(()=>Reflect.get(window,'setReady')(false));
    assert.equal(await page.locator('#procedural-current-design').getAttribute('href'),null);assert.equal(await page.locator('#procedural-current-snippet').textContent(),'');
    const offset=requests.length;mode='current';await page.getByRole('button',{name:'Retry source download',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#generator-source')?.hasAttribute('href'));
    const event=page.waitForEvent('download');await page.locator('#generator-source').click();const file=await event;
    assert.equal(file.suggestedFilename(),'cottage-0.6.0-source.2.zip');await file.saveAs(join(output,file.suggestedFilename()));
    const bytes=await readFile(join(output,file.suggestedFilename()));assert.equal(sha256(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);
    assert.equal(await page.locator('#procedural-current-design').getAttribute('href'),null);
    const retryRequests=requests.slice(offset);assert.equal(retryRequests.length,2);assert.ok(retryRequests.every(r=>r.cache?.includes('no-cache')));
    await page.evaluate(()=>Reflect.get(window,'setReady')(true));
    const jsonEvent=page.waitForEvent('download');await page.locator('#procedural-current-design').click();const json=await jsonEvent;await json.saveAs(join(output,'current.design.json'));
    assert.equal(await readFile(join(output,'current.design.json'),'utf8'),JSON.stringify(design,null,2)+'\n');
    await page.screenshot({path:join(output,'current-source-delivery.png'),fullPage:true});await page.close();
    mode='legacy';const context=await browser.newContext({acceptDownloads:true}),old=await context.newPage();await old.goto('http://127.0.0.1:4175/source-delivery-fixture');
    await old.waitForFunction(()=>document.querySelector('#generator-source')?.hasAttribute('href'));
    const oldEvent=old.waitForEvent('download');await old.locator('#generator-source').click();const oldFile=await oldEvent;
    assert.equal(oldFile.suggestedFilename(),'cottage-0.6.0.zip');await oldFile.saveAs(join(output,oldFile.suggestedFilename()));assert.equal(sha256(await readFile(join(output,oldFile.suggestedFilename()))),legacyEntry.sha256);
    await context.close();await writeFile(join(output,'receipt.json'),JSON.stringify({current:entry,legacy:legacyEntry,retryRequests,currentDesignSha256:sha256(JSON.stringify(design,null,2)+'\n'),requests},null,2)+'\n');
  }finally{await browser?.close();await server.close();}
});

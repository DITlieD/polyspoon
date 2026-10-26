import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium,type Page } from 'playwright-core';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';

const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
type Kind='source'|'procedural';
type Mode='good'|'index404'|'stale'|'missing'|'size'|'digest'|'html'|'delayed'|'licenses';

test('artifact HTTP failures recover with Retry and current-design readiness stays independent',{timeout:120000},async()=>{
  const output=process.env.ARTIFACT_RECOVERY_EVIDENCE_ROOT;
  assert.ok(output&&resolve(output).startsWith(resolve('evidence')+'/'));
  await mkdir(output,{recursive:false});
  const configs=Object.fromEntries(['bench','crate'].map(id=>{const asset=buildAsset(id);try{return [id,asset.config];}finally{disposeAsset(asset);}}));
  const edited=buildAsset('bench',{width:2.1});try{configs.edited=edited.config;}finally{disposeAsset(edited);}
  const definitions={source:{directory:'recipe-packages',selector:'#generator-source',section:'.source-download',retry:'Retry source download'},procedural:{directory:'procedural-modules',selector:'#procedural-module',section:'.procedural-download',retry:'Retry procedural download'}};
  const indexes=Object.fromEntries(await Promise.all(Object.entries(definitions).map(async([kind,d])=>[kind,JSON.parse(await readFile(join('public',d.directory,'index.json'),'utf8'))])));
  const modes:Record<Kind,Mode>={source:'good',procedural:'good'};
  const requests:{path:string;mode:Mode;cache:string|undefined}[]=[];
  const receipts:unknown[]=[];
  const releases:(()=>void)[]=[];
  const fixture='<!doctype html><div id="host"></div><script type="module">import {mountSourceDownload} from "/src/site/source-download.ts";const configs='+JSON.stringify(configs)+';let current=configs.bench,ready=true;const revoked=[];const original=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{revoked.push(url);original(url)};const manager=mountSourceDownload(document.querySelector("#host"),()=>current,()=>ready);window.fixture={set:(id,value)=>{current=configs[id];ready=value;return manager.refresh()},dispose:()=>manager.dispose(),revoked};manager.refresh();</script>';
  const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:4175,strictPort:true},plugins:[{name:'artifact-recovery-fixture',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    const path=req.url?.split('?')[0]??'';
    if(path==='/artifact-recovery-fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
    const kind=(Object.keys(definitions) as Kind[]).find(k=>path.startsWith('/'+definitions[k].directory+'/'));
    if(!kind){next();return;}
    const mode=modes[kind],index=indexes[kind],entry=index.packages.find((p:{id:string})=>p.id==='bench');
    requests.push({path,mode,cache:req.headers['cache-control']});
    res.setHeader('Cache-Control','public, max-age=3600');
    if(path==='/'+definitions[kind].directory+'/index.json'){
      if(mode==='index404'){res.statusCode=404;res.end('missing');return;}
      let value=index;
      if(mode==='stale')value={...index,packages:[{...entry,version:'9.0.0'}]};
      if(mode==='html'){const body=Buffer.from('<html>fallback</html>');value={...index,packages:[{...entry,bytes:body.length,sha256:hash(body)}]};}
      if(mode==='licenses')value={...index,packages:[{...entry,licenses:{software:'unknown',content:'CC0-1.0',contentPaths:['private.json']}}]};
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
    }
    if(path!=='/'+entry.url){next();return;}
    if(mode==='delayed')await new Promise<void>(done=>releases.push(done));
    if(mode==='missing'){res.statusCode=404;res.end('missing');return;}
    let bytes=await readFile(join('public',entry.url));
    if(mode==='size')bytes=bytes.subarray(1);
    if(mode==='digest'){bytes=Buffer.from(bytes);bytes[bytes.length-1]=bytes[bytes.length-1]!^1;}
    if(mode==='html')bytes=Buffer.from('<html>fallback</html>');
    res.setHeader('Content-Type',kind==='source'?'application/zip':'text/javascript');res.end(bytes);
  });}}]});
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  async function download(page:Page,selector:string,name:string,expected:{bytes:number;sha256:string}){
    const pending=page.waitForEvent('download');await page.locator(selector).click();const file=await pending;
    const path=join(output!,name);await file.saveAs(path);const bytes=await readFile(path);
    assert.equal(bytes.length,expected.bytes);assert.equal(hash(bytes),expected.sha256);
    return {path,bytes:bytes.length,sha256:hash(bytes),filename:file.suggestedFilename()};
  }
  try{
    await server.listen();
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--disable-dev-shm-usage']});
    for(const kind of Object.keys(definitions) as Kind[]){
      const d=definitions[kind],entry=indexes[kind].packages.find((p:{id:string})=>p.id==='bench');
      for(const mode of ['index404','stale','missing','size','digest','html'] as Mode[]){
        modes.source='good';modes.procedural='good';modes[kind]=mode;
        const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage();
        await page.goto('http://127.0.0.1:4175/artifact-recovery-fixture');
        const retry=page.getByRole('button',{name:d.retry,exact:true});await retry.waitFor({state:'visible'});
        await page.waitForFunction(section=>document.querySelector(section)?.textContent?.includes('download unavailable'),d.section);
        assert.equal(await page.locator(d.section).isVisible(),true);
        assert.equal(await page.locator(d.selector).getAttribute('href'),null);
        assert.equal(await page.locator(d.selector).getAttribute('tabindex'),'-1');
        const saved=await download(page,'#procedural-current-design',kind+'-'+mode+'-current.json',{bytes:Buffer.byteLength(JSON.stringify(configs.bench,null,2)+'\n'),sha256:hash(Buffer.from(JSON.stringify(configs.bench,null,2)+'\n'))});
        const offset=requests.length;modes[kind]='good';await retry.click();
        await page.waitForFunction(selector=>document.querySelector(selector)?.hasAttribute('href'),d.selector);
        const artifact=await download(page,d.selector,kind+'-'+mode+(kind==='source'?'.zip':'.mjs'),entry);
        const fetched=requests.slice(offset).filter(r=>r.path.startsWith('/'+d.directory+'/'));
        assert.ok(fetched.some(r=>r.path.endsWith('/index.json')));assert.ok(fetched.some(r=>r.path==='/'+entry.url));
        assert.ok(fetched.every(r=>r.cache?.includes('no-cache')),JSON.stringify(fetched));
        if(kind==='source')assert.match(await page.locator('.source-licenses').innerText(),/Source software: Apache-2.0\. Default parameters: CC0-1.0\./);
        receipts.push({kind,mode,saved,artifact,retryRequests:fetched,url:page.url()});
        await context.close();
      }
    }
    modes.source='good';modes.procedural='good';
    const page=await browser.newPage({acceptDownloads:true});await page.goto('http://127.0.0.1:4175/artifact-recovery-fixture');
    await page.waitForFunction(()=>document.querySelector('#generator-source')?.hasAttribute('href')&&document.querySelector('#procedural-module')?.hasAttribute('href'));
    const previous=await page.locator('#procedural-current-design').getAttribute('href');
    await page.evaluate(()=>Reflect.get(window,'fixture').set('bench',false));
    assert.equal(await page.locator('#procedural-current-design').getAttribute('href'),null);
    assert.equal(await page.locator('#procedural-current-design').getAttribute('tabindex'),'-1');
    assert.equal(await page.locator('#procedural-current-snippet').textContent(),'');
    assert.equal(await page.locator('#procedural-current-snippet').isVisible(),false);
    assert.match(await page.locator('.current-design-readiness').innerText(),/pending or invalid/);
    assert.ok(await page.locator('#generator-source').getAttribute('href'));assert.ok(await page.locator('#procedural-module').getAttribute('href'));
    assert.ok(await page.evaluate(url=>Reflect.get(window,'fixture').revoked.includes(url),previous));
    await page.evaluate(()=>Reflect.get(window,'fixture').set('bench',true));
    const restored=await download(page,'#procedural-current-design','readiness-restored.json',{bytes:Buffer.byteLength(JSON.stringify(configs.bench,null,2)+'\n'),sha256:hash(Buffer.from(JSON.stringify(configs.bench,null,2)+'\n'))});
    assert.match(await page.locator('#procedural-current-snippet').innerText(),/bench-1.1.0.mjs/);
    await page.screenshot({path:join(output,'ready-downloads.png'),fullPage:true});
    await page.evaluate(()=>Reflect.get(window,'fixture').set('bench',false));
    await page.evaluate(()=>Reflect.get(window,'fixture').set('edited',true));
    const corrected=await download(page,'#procedural-current-design','readiness-corrected.json',{bytes:Buffer.byteLength(JSON.stringify(configs.edited,null,2)+'\n'),sha256:hash(Buffer.from(JSON.stringify(configs.edited,null,2)+'\n'))});
    assert.match(await page.locator('#procedural-current-snippet').innerText(),/"width": 2.1/);
    const active=await page.locator('a[href]').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
    await page.evaluate(()=>Reflect.get(window,'fixture').dispose());
    for(const url of active)assert.ok(await page.evaluate(value=>Reflect.get(window,'fixture').revoked.includes(value),url));
    for(const selector of ['#generator-source','#procedural-module','#procedural-current-design'])assert.equal(await page.locator(selector).getAttribute('href'),null);
    receipts.push({readinessRestored:restored,readinessCorrected:corrected,revoked:await page.evaluate(()=>Reflect.get(window,'fixture').revoked)});await page.close();
    for(const kind of Object.keys(definitions) as Kind[]){
      modes.source='good';modes.procedural='good';modes[kind]='delayed';
      const context=await browser.newContext(),check=await context.newPage(),offset=requests.length;
      await check.goto('http://127.0.0.1:4175/artifact-recovery-fixture');
      const deadline=Date.now()+10000;
      while(Date.now()<deadline&&!requests.slice(offset).some(r=>r.mode==='delayed'&&!r.path.endsWith('index.json')))await new Promise(done=>setTimeout(done,10));
      assert.ok(requests.slice(offset).some(r=>r.mode==='delayed'&&!r.path.endsWith('index.json')),'Old artifact request must be pending before switching');
      await check.evaluate(()=>Reflect.get(window,'fixture').set('crate',true));
      const d=definitions[kind];await check.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('download')?.startsWith('crate-'),d.selector);
      for(const release of releases.splice(0))release();
      await check.waitForLoadState('networkidle');
      assert.match((await check.locator(d.selector).getAttribute('download'))!,/^crate-/);
      receipts.push({kind,delayedSwitch:'crate',requests:requests.slice(offset)});await context.close();
    }
    modes.source='licenses';modes.procedural='good';const check=await browser.newPage();await check.goto('http://127.0.0.1:4175/artifact-recovery-fixture');
    await check.waitForFunction(()=>document.querySelector('#generator-source')?.hasAttribute('href'));
    assert.equal(await check.locator('.source-licenses').innerText(),'Source software: unavailable. Default parameters: unavailable.');await check.close();
    await writeFile(join(output,'receipt.json'),JSON.stringify({coverage:'Actual component DOM, HTTP endpoints, Retry and downloaded bytes. Full grouped-inspector integration is separate.',receipts,requests},null,2));
  }finally{for(const release of releases.splice(0))release();await browser?.close();await server.close();}
});

import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SkinnedMesh} from 'three';
import {validateBytes} from 'gltf-validator';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset,exportBundle,snapshotModule} from '../src/catalog/export.ts';
import {exportStudioBundle,exportSnapshotModule} from '../src/studio/export-delivery.ts';

const unpack=(input:Uint8Array)=>{const bytes=Buffer.from(input),files:Record<string,Buffer>={};let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){assert.equal(bytes.readUInt16LE(offset+8),0);const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),start=offset+30+length+extra;files[bytes.subarray(offset+30,offset+30+length).toString()]=bytes.subarray(start,start+size);offset=start+size;}return files;};

test('studio delivery preserves rigid module and bundle bytes',async()=>{
 const build=buildAsset('bench',{width:2.1});try{assert.equal(await exportSnapshotModule(build),snapshotModule(await exportAsset(build),build.config));const actual=await exportStudioBundle(build),expected=await exportBundle(build);assert.deepEqual(actual,expected);}finally{disposeAsset(build);}
});

test('studio rig exports reject mismatched rig metadata instead of falling back to rigid bytes',async()=>{
 const build=buildAsset('stylized-fox');try{build.root.userData.openpolyRig={};await assert.rejects(()=>exportSnapshotModule(build),/authority mismatch/);await assert.rejects(()=>exportStudioBundle(build),/authority mismatch/);}finally{disposeAsset(build);}
});

test('local studio downloads edited rig GLB modules and bundles with skins and available clips',{timeout:120000},async()=>{
 await mkdir('hosted/.local',{recursive:true});const directory=await mkdtemp(resolve('hosted/.local/studio-delivery-')),server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();const origin=server.resolvedUrls!.local[0]!,browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors:string[]=[],records=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.186.1/**',async route=>{const suffix=new URL(route.request().url()).pathname.split('/three@0.186.1/')[1]!;assert.ok(!suffix.includes('..'));await route.fulfill({body:await readFile(resolve('node_modules/three',suffix)),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});});
  for(const [id,key,value] of [['stylized-humanoid','height','2'],['stylized-fox','bodyLength','0.55']] as const){
   await page.goto(new URL('asset/'+id,origin).href);await page.locator('#'+key).fill('999');await page.locator('#'+key).press('Enter');assert.equal(await page.locator('#export').isDisabled(),true);assert.equal(await page.locator('#export-module').isDisabled(),true);assert.equal(await page.locator('#export-bundle').isDisabled(),true);await page.locator('#'+key).fill(value);await page.locator('#'+key).press('Tab');
   const downloaded:Record<string,Buffer>={};
   for(const [button,extension] of [['#export','glb'],['#export-module','mjs'],['#export-bundle','zip']]){const ready=page.waitForEvent('download');await page.locator(button!).click();const file=await ready;assert.equal(file.suggestedFilename(),id+'.'+extension);const path=join(directory,id+'.'+extension);await file.saveAs(path);downloaded[extension!]=await readFile(path);}
   const check=async(bytes:Uint8Array)=>{const report=await validateBytes(bytes);assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');let skins=0;gltf.scene.traverse(object=>{if(object instanceof SkinnedMesh)skins++;});assert.ok(skins>0);assert.deepEqual(gltf.animations.map(clip=>clip.name),['idle','walk']);assert.equal(gltf.scene.userData.configuration.applied[key],Number(value));return {skins,clips:gltf.animations.map(clip=>clip.name)};};
   const measured=await check(downloaded.glb!);const module=await import(pathToFileURL(join(directory,id+'.mjs')).href);assert.equal(module.configuration.applied[key],Number(value));assert.deepEqual(Buffer.from(module.glbBytes()),downloaded.glb);const scene=await module.createAsset();assert.deepEqual(scene.animations.map((clip:{name:string})=>clip.name),['idle','walk']);let moduleSkins=0;scene.traverse((object:unknown)=>{if(object instanceof SkinnedMesh)moduleSkins++;});assert.equal(moduleSkins,measured.skins);
   const files=unpack(downloaded.zip!);assert.deepEqual(Object.keys(files).sort(),[id+'.glb',id+'.design.json',id+'.mjs','preview.html','README.txt'].sort());assert.deepEqual(files[id+'.glb'],downloaded.glb);assert.deepEqual(files[id+'.mjs'],downloaded.mjs);assert.equal(JSON.parse(files[id+'.design.json']!.toString()).applied[key],Number(value));await check(files[id+'.glb']!);
   await page.route('**/export-preview',route=>route.fulfill({body:files['preview.html']!,contentType:'text/html'}));await page.goto(new URL('export-preview',origin).href);await page.locator('canvas').waitFor();await page.getByText(/Drag to orbit.*Static preview/).waitFor();await page.screenshot({path:join(directory,id+'-bundle-preview.png')});await page.unroute('**/export-preview');records.push({id,key,value:Number(value),...measured,generatedModuleClipsAvailable:true,bundlePreviewRendered:true});
  }
  assert.deepEqual(errors,[]);await writeFile(join(directory,'receipt.json'),JSON.stringify({status:'passed',records,pageErrors:errors,scope:'Actual local studio downloads and exported static bundle previews. CDN Three modules served from exact installed dependency for deterministic preview checks.'},null,2)+'\n');console.log('Studio delivery evidence: '+directory);
 }finally{await browser.close();await server.close();}
});

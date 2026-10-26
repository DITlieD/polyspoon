import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {Color} from 'three';
import {sourceProvenance,sha256} from '../scripts/provenance.ts';
test('live WebGL display modes preserve board tones and exact export materials',{timeout:90000},async()=>{
 if(process.env.INTEGRATION_EVIDENCE_ROOT){const {runMaterialProduction}=await import('./revision4-material-production.ts');await runMaterialProduction(process.env.INTEGRATION_EVIDENCE_ROOT);return;}
 const output='evidence/revision3/material-restore';
 await mkdir(output,{recursive:true});
 const before=await sourceProvenance();
 const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{
  name:'material-probe',configureServer(server){server.middlewares.use((req,res,next)=>{
   if(req.url!=='/material-probe')return next();
   res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body style="margin:0"><div id="host" style="width:720px;height:600px"></div></body></html>');
  });}
 }]});await server.listen();
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:720,height:600}}),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript('globalThis.__name = (value) => value;');
  await page.goto(server.resolvedUrls!.local[0]+'material-probe');
  const result=await page.evaluate(async()=>{
   const stagePath='/src/studio/stage.ts',catalogPath='/src/catalog/index.ts',exportPath='/src/catalog/export.ts';
   const {Stage}=await import(stagePath),{buildAsset,disposeAsset}=await import(catalogPath),{exportAsset}=await import(exportPath);
   const stage=new Stage(document.getElementById('host')),b=buildAsset('crate',{toneVariation:.1,'color.wood':'#765b42'});
   const inventory=()=>{const list:Array<{name:string;role:string;key:string;rgb:number[]}>=[];b.root.traverse((o:{isMesh?:boolean;name:string;userData:{materialRole:string};material:{name:string;color:{toArray():number[]}}})=>{if(o.isMesh)list.push({name:o.name,role:o.userData.materialRole,key:o.material.name,rgb:o.material.color.toArray()});});return list;};
   const original=inventory(),renders:Record<string,string>={};
   try{
    stage.setDiagnostic(true);stage.replace(b,true);
    for(const mode of ['shaded','clay','color','shaded'] as const){
     stage.setMode(mode);for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
     if(mode!=='color'&&JSON.stringify(inventory())!==JSON.stringify(original))throw new Error('Material identity changed in '+mode);
     const name=mode==='shaded'&&renders.shaded?'restored':mode;
     renders[name]=stage.renderer.domElement.toDataURL('image/png').split(',')[1];
    }
    const bytes=await exportAsset(b),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const gltf=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+view.getUint32(12,true))));
    for(const entry of original){
     const node=gltf.nodes.find((n:{name:string})=>n.name===entry.name),material=gltf.materials[gltf.meshes[node.mesh].primitives[0].material];
     if(material.name!==entry.key||JSON.stringify(material.pbrMetallicRoughness.baseColorFactor)!==JSON.stringify([...entry.rgb,1]))throw new Error('Export differs from preview: '+entry.name);
    }
    return {original,renders};
   }finally{stage.dispose();disposeAsset(b);}
  });
  await page.setViewportSize({width:1440,height:1050});
  await page.goto(server.resolvedUrls!.local[0]+'asset/crate');
  await page.locator('button[data-group="construction"]').click();
  await page.locator('#toneVariation').fill('0.1');await page.locator('#toneVariation').press('Enter');
  const settle=()=>page.evaluate(async()=>{for(let i=0;i<20;i++)await new Promise(requestAnimationFrame);});
  await page.selectOption('#mode','color');await settle();
  const colored=await page.locator('#canvas-host canvas').screenshot();
  await page.locator('#toneVariation').fill('0');await page.locator('#toneVariation').press('Enter');await settle();
  const flat=await page.locator('#canvas-host canvas').screenshot();
  assert.notDeepEqual(colored,flat,'normal-site tone control must change rendered board colors');
  await page.locator('#toneVariation').fill('0.1');await page.locator('#toneVariation').press('Enter');
  await page.selectOption('#mode','shaded');await settle();
  const initial=await page.locator('#canvas-host canvas').screenshot({path:output+'/normal-shaded.png'});
  for(const mode of ['clay','color','silhouette','shaded']){await page.selectOption('#mode',mode);await settle();}
  const restored=await page.locator('#canvas-host canvas').screenshot({path:output+'/normal-restored.png'});
  assert.deepEqual(initial,restored,'normal-site mode roundtrip must preserve exact shaded pixels');
  const saveEvent=page.waitForEvent('download');await page.locator('#save').click();
  const design=JSON.parse(await readFile((await (await saveEvent).path())!,'utf8'));
  const exportEvent=page.waitForEvent('download');await page.locator('#export').click();
  const exported=await readFile((await (await exportEvent).path())!);
  const doc=JSON.parse(exported.subarray(20,20+exported.readUInt32LE(12)).toString());
  for(let i=0;i<3;i++){
   const material=doc.materials.find((m:{name:string})=>m.name==='wood-tone-'+i);
   assert.deepEqual(material.pbrMetallicRoughness.baseColorFactor,[...new Color(design.applied['color.wood']).multiplyScalar(1+(i-1)*.1).toArray(),1]);
  }
  await writeFile(output+'/normal-export.glb',exported);
  await writeFile(output+'/normal-design.json',JSON.stringify(design,null,2));
  assert.deepEqual(errors,[]);
  assert.equal(result.renders.shaded,result.renders.restored,'same renderer and camera must restore exact pixels');
  assert.notEqual(result.renders.shaded,result.renders.clay);
  assert.equal(new Set(result.original.filter(x=>x.key.startsWith('wood-tone-')).map(x=>JSON.stringify(x.rgb))).size,3);
  const images:Record<string,string>={};
  for(const [name,data] of Object.entries(result.renders)){const bytes=Buffer.from(data,'base64');await writeFile(output+'/'+name+'.png',bytes);images[name]=sha256(bytes);}
  const after=await sourceProvenance();
  await writeFile(output+'/browser-receipt.json',JSON.stringify({before,after,stable:before.sourceHash===after.sourceHash,images,original:result.original,errors},null,2));
  assert.equal(after.sourceHash,before.sourceHash,'Source moved during focused browser run');
 }finally{await browser.close();await server.close();}
});

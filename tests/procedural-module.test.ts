import '../scripts/node-platform.ts';
import { pathToFileURL } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { exportDeliverable } from '../src/catalog/delivery.ts';
import { readSemantics } from '../src/catalog/semantics.ts';
import { spawnSync } from 'node:child_process';
import { parseSync } from 'rolldown/utils';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProceduralModules } from '../scripts/recipe-module.ts';
import { controlMetadata } from '../src/engine/parameters.ts';
import { catalog } from '../src/catalog/index.ts';
import { proceduralPackageFor, verifiedModule } from '../src/site/procedural-download.ts';

test('all registered recipes publish synchronous modules and typed pinned metadata',async()=>{
  const directory=join(process.cwd(),'.runtime/procedural-module');await mkdir(directory,{recursive:true});const output=await mkdtemp(join(directory,'packages-'));
  const index=await buildProceduralModules(output,{retainPublished:true});
  assert.equal(index.packages.length,catalog.length);
  for(const d of catalog){
    const p=proceduralPackageFor(index,d.id,d.version);
    assert.ok(p);
    const code=await readFile(join(output,d.id,d.version,'asset.mjs'),'utf8');
    assert.doesNotMatch(code,/GLTFLoader|GLTFExporter|\/home\/|await /);
    assert.match(code,/from ?["']three["']/);
    const ast=parseSync('asset.mjs',code);assert.equal(ast.errors.length,0);
    const imports=ast.program.body.filter(node=>node.type==='ImportDeclaration').map(node=>(node as {source:{value:string}}).source.value);assert.deepEqual(imports,['three']);
    const metadata=JSON.parse(await readFile(join(output,d.id,d.version,'metadata.json'),'utf8'));
    assert.deepEqual(metadata.defaults,d.defaults);
    assert.deepEqual(metadata.controls,controlMetadata(d.controls));for(const control of d.controls)assert.equal(metadata.controls.find((c:any)=>c.key===control.key).unit,control.unit);
    if(metadata.source.entry.startsWith('examples/')){assert.ok(!Object.keys(metadata.source.files).some(path=>path.startsWith('src/families/')||path.startsWith('src/lantern/')));assert.ok(!Object.keys(metadata.source.files).some(path=>path.startsWith('examples/recipes/')&&!path.startsWith('examples/recipes/'+d.id+'/')));}
    const packaged=await import(pathToFileURL(join(output,d.id,d.version,'asset.mjs')).href);
    const canonical=buildAsset(d.id),root=packaged.createAsset();
    try{assert.deepEqual(root.userData.openpoly,canonical.semantics);assert.deepEqual(packaged.metadata.semantics,canonical.semantics);
     if(canonical.semantics.joints.length)packaged.setJointPose(root,canonical.semantics.joints[0]!.id,60);
     const bytes=await exportDeliverable({...canonical,root,...(root.userData.openpolyRig?{rig:root.userData.openpolyRig}:{})}),loaded=await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer,'');assert.deepEqual(readSemantics(loaded.scene.getObjectByName(root.name)!),readSemantics(root));
    }finally{packaged.disposeAsset(root);disposeAsset(canonical);}
    assert.equal(metadata.dependencies.three,'0.186.1');
    assert.ok((await readFile(join(output,d.id,d.version,'asset.d.mts'),'utf8')).includes('createAsset'));
    assert.equal(await verifiedModule(new TextEncoder().encode(code),p),code);
    await assert.rejects(verifiedModule(new TextEncoder().encode(code+' '),p));
  }
  await writeFile(join(output,'typed-consumer.mts'),catalog.map((d,i)=>`import { createAsset as create${i}, metadata as metadata${i} } from './${d.id}/${d.version}/asset.mjs';
const root${i}=create${i}(metadata${i}.defaults);root${i}.dispose();create${i}(metadata${i}.presets[0].parameters);`).join('\n'));
  const command=['node_modules/typescript/bin/tsc','--ignoreConfig','--noEmit','--skipLibCheck','--strict','--module','NodeNext','--target','ES2023'];
  const typed=spawnSync(process.execPath,[...command,join(output,'typed-consumer.mts')],{encoding:'utf8'});assert.equal(typed.status,0,typed.stdout+typed.stderr);
  await writeFile(join(output,'invalid-consumer.mts'),"import { createAsset } from './bench/1.1.0/asset.mjs'; createAsset({unknown:1});createAsset({width:'wide'});");
  const invalid=spawnSync(process.execPath,[...command,join(output,'invalid-consumer.mts')],{encoding:'utf8'});assert.notEqual(invalid.status,0);assert.match(invalid.stdout,/unknown/);assert.match(invalid.stdout,/string.*number/);
});
test('procedural index rejects wrong versions, duplicate records and malformed metadata',()=>{
  const p={id:'bench',version:'1.0.0',url:'procedural-modules/bench/1.0.0/asset.mjs',bytes:123,sha256:'a'.repeat(64),dependencies:{three:'0.186.1'},configuration:{kind:'default'}};
  const index={formatVersion:1,packages:[p]};
  assert.ok(proceduralPackageFor(index,'bench','1.0.0'));
  for(const invalid of [{...index,formatVersion:2},{...index,packages:[p,p]},{...index,packages:[{...p,version:'2.0.0'}]},...['url','bytes','sha256','dependencies','configuration'].map(key=>({...index,packages:[{...p,[key]:null}]}))])assert.equal(proceduralPackageFor(invalid,'bench','1.0.0'),undefined);
});
test('current-design snippet preserves exact requested parameters and appearance',async()=>{
  const { currentDesignSnippet }=await import('../src/site/procedural-download.ts');
  const { buildAsset,disposeAsset }=await import('../src/catalog/index.ts');
  const build=buildAsset('bench',{width:2.1,appearance:{version:1,palette:'None',shading:'Flat',partColors:{'seat-slat-1':'#aabbcc'}}});
  try{
    const snippet=currentDesignSnippet(build.config);
    assert.match(snippet,/bench-1.1.0.mjs/);
    const parameters=JSON.parse(snippet.slice(snippet.indexOf('createAsset(')+12,-2));
    assert.deepEqual(parameters,{...build.config.requested,appearance:build.config.appearance});
  }finally{disposeAsset(build);}
});

test('packager rejects a registered source/export mismatch before publishing',async()=>{
  const {recipe}=await import('../src/recipes/index.ts');const r=recipe('bench'),previous=r.source.exportName;
  try{r.source.exportName='missingRecipe';await assert.rejects(buildProceduralModules('evidence/revision10/procedural-module/rejected-package',{retainPublished:true}),/source\/export mismatch/);}finally{r.source.exportName=previous;}
});

test('verified artifact modules reject HTML invalid UTF8 and caller mutation',async()=>{
 const {createHash}=await import('node:crypto');const expected=(bytes:Uint8Array)=>({id:'bench',version:'1.1.0',url:'procedural-modules/bench/1.1.0/asset.mjs',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),dependencies:{three:'0.186.1' as const},configuration:{kind:'default' as const}});
 const html=new TextEncoder().encode('<!doctype html><html>fallback</html>');await assert.rejects(verifiedModule(html,expected(html)));const invalid=new Uint8Array([0xc3,0x28]);await assert.rejects(verifiedModule(invalid,expected(invalid)));const bytes=new TextEncoder().encode('export const value=1;'),pending=verifiedModule(bytes,expected(bytes));bytes.fill(32);assert.equal(await pending,'export const value=1;');
});

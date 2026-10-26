import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SkinnedMesh } from 'three';
import { buildProceduralModules,readPublishedProceduralReleases } from '../scripts/recipe-module.ts';

test('candidate modules retain published implementations and add usable skinned rig modules',async()=>{
 const published=await readPublishedProceduralReleases(resolve('public/procedural-modules'));assert.equal(published.length,14);
 const base=resolve('evidence/rigged-catalog');await mkdir(base,{recursive:true});const output=await mkdtemp(join(base,'modules-'));
 const index=await buildProceduralModules(output,{retainPublished:true});assert.equal(index.packages.length,14);
 for(const old of published){
  assert.deepEqual(index.packages.find(entry=>entry.id===old.entry.id),old.entry);
  for(const [name,text] of Object.entries(old.files))assert.equal(await readFile(join(output,old.entry.id,old.entry.version,name),'utf8'),text);
 }
 const rows=[];
 for(const entry of index.packages.filter(item=>item.id.startsWith('stylized-'))){
  const module=await import(pathToFileURL(join(output,entry.id,entry.version,'asset.mjs')).href),root=module.createAsset();
  assert.deepEqual(root.animations.map((clip:{name:string})=>clip.name),['idle','walk']);let skins=0;
  root.traverse((object:unknown)=>{if(object instanceof SkinnedMesh){skins++;assert.equal(object.skeleton.bones.length,root.userData.openpolyRig.bones.length);assert.ok(object.geometry.getAttribute('skinWeight'));}});
  assert.ok(skins>0);assert.equal(module.metadata.source.entry,'src/recipes/rigged.ts');module.disposeAsset(root);root.dispose();
  rows.push({id:entry.id,url:entry.url,sha256:entry.sha256,skins,clips:root.animations.map((clip:{name:string})=>clip.name)});
 }
 await writeFile(join(output,'receipt.json'),JSON.stringify({retained:published.map(item=>({id:item.entry.id,sha256:item.entry.sha256})),rows},null,2)+'\n');
});

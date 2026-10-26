import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Mesh,SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateBytes} from 'gltf-validator';
import {buildAsset,disposeAsset,catalog} from '../src/catalog/index.ts';
import {geometrySnapshot} from '../src/lantern/inspect.ts';
import {sha256} from '../scripts/provenance.ts';
import {exportDeliverable} from '../src/catalog/delivery.ts';

const historicalFamilies=['work-lantern','cottage','tree','fence','crate','boulder','bench','planter','treasure-chest','wheelbarrow','stone-well','conifer'];

test('the twelve accepted construction defaults retain their versioned geometry and materials',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/r2-accepted-construction.json',import.meta.url),'utf8'));
 assert.deepEqual(fixture.cases.map((c:any)=>c.family).sort(),historicalFamilies.toSorted());
 for(const item of fixture.cases){const b=buildAsset(item.family,item.input);try{const materials:unknown[]=[];b.root.traverse(o=>{if(o instanceof Mesh){assert.ok(!Array.isArray(o.material));const {uuid,metadata,...material}=o.material.toJSON();materials.push({name:o.name,material});}});assert.equal(b.config.familyVersion,item.version);assert.equal(sha256(JSON.stringify(geometrySnapshot(b.root))),item.geometryHash,item.family);assert.equal(sha256(JSON.stringify(materials)),item.materialsHash,item.family);assert.deepEqual(b.config,item.config);assert.deepEqual(b.dimensions.toArray(),item.dimensions);assert.equal(b.semantics.parts.length,item.parts);}finally{disposeAsset(b);}}
});
import '../scripts/node-platform.ts';

test('current rig defaults retain independently accepted GLB bytes skins and clips',async()=>{
 const rigs=[
  {id:'stylized-humanoid',version:'1.0.0',skins:5,bones:20,sha256:'6879f01bec5f5e2af88ae24cb4be53f400bd97a7f7c106a16e227dd813ecd8dd'},
  {id:'stylized-fox',version:'1.1.0',skins:3,bones:28,sha256:'e28295a5893c44f8c10b877f6512b7ee2e5e3a0174ed15948e8fab93a29015c3'},
 ];
 assert.deepEqual(catalog.map(d=>d.id).sort(),[...historicalFamilies,...rigs.map(r=>r.id)].sort());
 for(const expected of rigs){
  const build=buildAsset(expected.id);
  try{
   assert.equal(build.config.familyVersion,expected.version);assert.equal(build.semantics.parts.length,expected.skins);
   const bytes=await exportDeliverable(build);assert.equal(sha256(bytes),expected.sha256);
   const validation=await validateBytes(bytes);assert.equal(validation.issues.numErrors,0);assert.equal(validation.issues.numWarnings,0);
   const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');assert.deepEqual(loaded.animations.map(clip=>clip.name),['idle','walk']);
   let skins=0;const resources=new Set<{dispose():void}>();loaded.scene.traverse(node=>{if(node instanceof SkinnedMesh){skins++;assert.equal(node.skeleton.bones.length,expected.bones);resources.add(node.geometry);resources.add(node.skeleton);for(const material of Array.isArray(node.material)?node.material:[node.material])resources.add(material);}});assert.equal(skins,expected.skins);for(const resource of resources)resource.dispose();
  }finally{disposeAsset(build);}
 }
});

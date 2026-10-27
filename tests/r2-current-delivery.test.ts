import { forgeRecipes } from '../src/recipes/forge.ts';
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

// stone-well 1.2.0 only adds the roofStyle choice; its default (gable) keeps the accepted 1.1.0 geometry and materials byte-for-byte.
// conifer 1.2.0 adds lean (default 0) and planter 1.2.0 adds foot pads and a soil/plant fill (defaults off): both defaults keep the accepted 1.1.0 geometry and materials.
const revised:Record<string,string>={'stone-well':'1.2.0',conifer:'1.2.0',planter:'1.2.0'};
// Review round 8 (2026-10-27) fixed detector findings in these defaults: work-lantern vent core inside the body, cottage reveal linings
// (in the backing mesh), course laps and ridge-cap underside, tree branch sockets, planter rim inset and feet, wheelbarrow strap foot,
// stone-well rafters and tie, conifer spray phase. Materials and configuration are unchanged and dimensions hold to 1e-6 m, except stone-well: its rafter feet now run 30 mm past
// the roof-board ends (flush end faces z-fought), so it is 53 mm deeper; conifer's
// rotated outer spray moves its width by 0.06 mm. Geometry needs re-review.
const reviewRound8Dimensions:Record<string,number[]>={'stone-well':[2.9860000610351562,3.237104892730713,2.6682662963867188],conifer:[3.741500973701477,6,3.799999952316284]};
const reviewRound8:Record<string,string>={
 'work-lantern':'540c53b232f8548e0b64e9000c5f35d100f94acca37d1b8c35d02dbaca8182ed',
 'cottage':'392b55e81496a52c35286a68a0e86d5a5e9e384bafe6e7b962e5f2ee3b230a5c',
 'tree':'30aec6d531496e4eaa20f884c43acd3a81605402ee5e8a562af891cfac0926ea',
 'planter':'3472b566d6969ae58c09ee4d2d8044a91d72d9525be5592cdb7c7855bdd7e45c',
 'wheelbarrow':'bc1363fb1ef9a82e2571fa119170081ce893984ed6adb350139d881bce6cf9ec',
 'stone-well':'e886ee927cbf2c56b45501219b8fc777a331bacf6bfee6a1ed04b17f118c24c5',
 'conifer':'c23869f6a586a08aee4207bc3371070cf92efbbdcc16900734ab4a8a0e877ded'
};
test('the twelve accepted construction defaults retain their versioned geometry and materials',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/r2-accepted-construction.json',import.meta.url),'utf8'));
 assert.deepEqual(fixture.cases.map((c:any)=>c.family).sort(),historicalFamilies.toSorted());
 for(const item of fixture.cases){const b=buildAsset(item.family,item.input);try{const materials:unknown[]=[];b.root.traverse(o=>{if(o instanceof Mesh){assert.ok(!Array.isArray(o.material));const {uuid,metadata,...material}=o.material.toJSON();materials.push({name:o.name,material});}});assert.equal(b.config.familyVersion,revised[item.family]??item.version);assert.equal(sha256(JSON.stringify(geometrySnapshot(b.root))),reviewRound8[item.family]??item.geometryHash,item.family);assert.equal(sha256(JSON.stringify(materials)),item.materialsHash,item.family);if(revised[item.family]){const {roofStyle,lean,footPads,fill,...applied}=b.config.applied;if(item.family==='stone-well')assert.equal(roofStyle,'gable');if(item.family==='conifer')assert.equal(lean,0);if(item.family==='planter'){assert.equal(footPads,false);assert.equal(fill,'none');}assert.deepEqual({...b.config,familyVersion:item.version,applied},item.config);}else assert.deepEqual(b.config,item.config);if(reviewRound8[item.family])b.dimensions.toArray().forEach((v,i)=>assert.ok(Math.abs(v-(reviewRound8Dimensions[item.family]??item.dimensions)[i])<1e-6,item.family+' dimensions'));else assert.deepEqual(b.dimensions.toArray(),item.dimensions);assert.equal(b.semantics.parts.length,item.parts);}finally{disposeAsset(b);}}
});
import '../scripts/node-platform.ts';
// Forge families (src/recipes/forge.ts) are new, unpublished additions with no prior baseline.
// Forge families come from the registry list so each new forge family does not need three test edits.
const forgeIds=forgeRecipes.map(r=>r.descriptor.id);

test('current rig defaults retain independently accepted GLB bytes skins and clips',async()=>{
 const rigs=[
  // 1.1.0 adds build/hair/tunic choices (defaults keep the 1.0.0 geometry; bytes change with the saved configuration).
  // Review round 5 (2026-10-27): belt/hem trims stand 0.35% of height proud (was 0.2%, within the 3 mm z-fight tolerance) and the hem band is raised 0.3% of height off the capped hem plane; was 5916ca45….
  // Review round 6 (2026-10-27): hem band wraps the tunic's lower edge (from 0.3% of height below the hem), bracers sit 0.15% of height into the forearm; was 252758f8….
  // Review round 8 (2026-10-27): tunic capped at the collar, neck seated in it and cutting through the head wall, hair and eyes rooted in
  // the skull, nose seated, collar band top 0.4% of height above the collar cap; was b75230fe….
  {id:'stylized-humanoid',version:'1.1.0',skins:5,bones:20,sha256:'6f57224ae678ddd8b29b08198506754f28c0e028e612b429ffe852e836e1cb75'},
  // 1.2.0 adds build/tail/ear choices; the 'sweep' tail option changes the embedded control list, not the default geometry (verified vertex/weight-identical).
  // Review round 6 (2026-10-27): torso 20% shorter on non-stocky builds with a wider waist, nose a closed loft and the muzzle end capped (seam detector); was 89ad8d64….
  // Review round 8 (2026-10-27): skull closed, muzzle rooted inside it and closed, neck root moved into the chest; was 2eafff91….
  {id:'stylized-fox',version:'1.2.0',skins:3,bones:28,sha256:'2ed4ee79dc217c10570a8ac0fe55a7cf32a203ed10ff19edffe2515a3ecbd498'},
  // Lane D (2026-10-27): original rabbit body on the shared four-paw quadruped rig contract.
  {id:'rigged-rabbit',version:'1.0.0',skins:3,bones:28,sha256:'996c681fd4801bf8bc3caacf1848bcdbafbfd80a939afa5320460d393828f9f3'}, // round 7: ears rooted in the skull, inner ear and nose seated; round 8: hind hock ring added to the leg skin, heel ring blended shin/hock, lop inner ear offset along its thickness normal (was 5eba08b5…; needs re-review)
 ];
 assert.deepEqual(catalog.map(d=>d.id).sort(),[...new Set([...historicalFamilies,...rigs.map(r=>r.id),...forgeIds])].sort()); // rigged-rabbit is both a forge recipe and a reviewed rig
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

import test from 'node:test';
import {readFileSync} from 'node:fs';
import {saveFamilyConfiguration as saveRevision2} from '../src/families/revision2-config.ts';
import assert from 'node:assert/strict';
import {Mesh,Vector3} from 'three';
import {buildAsset,disposeAsset,descriptor,loadDesign} from '../src/catalog/index.ts';
test('short narrow tree radius limit rejects oversized requested roots without silently clamping',()=>{
 for(const canopyFullness of [.65,.85]){
  const input={height:3,spread:2.4,trunkGirth:.48,canopyFullness};
  assert.throws(()=>descriptor('tree').save(input),/radius/i);
  const state=descriptor('tree').state(input),limit=state.controls.trunkGirth!.max!;
  assert.ok(limit<.48&&limit>=.22);assert.ok(state.issues.some(i=>i.keys.includes('trunkGirth')));
  const saved=descriptor('tree').save({...input,trunkGirth:limit});assert.equal(saved.requested.trunkGirth,limit);assert.equal(saved.applied.trunkGirth,limit);
 }
 assert.equal(descriptor('tree').save({}).applied.trunkGirth,.22);
});
test('default stone moss has an upper forward visible supporting face',()=>{
 const b=buildAsset('boulder'),direction=new Vector3(2.7,1.85,3.5).normalize();
 try{
  const moss=b.root.getObjectByName('moss-region') as Mesh,p=moss.geometry.getAttribute('position');
  let visible=0,total=0;
  for(let i=0;i<p.count;i+=3){
   const a=new Vector3().fromBufferAttribute(p,i),v=new Vector3().fromBufferAttribute(p,i+1),c=new Vector3().fromBufferAttribute(p,i+2),n=v.sub(a).cross(c.sub(a));const area=n.length()/2;
   total+=area;if(n.normalize().dot(direction)>.15)visible+=area;
  }
  assert.ok(visible/total>.8,'default moss hidden from normal oblique');
 }finally{disposeAsset(b);}
});
test('dependent omitted radius defaults do not mutate catalog metadata or explicit input',()=>{
 const d=descriptor('tree'),control=d.controls.find(c=>c.key==='trunkGirth')!,initial=control.default;
 const small=d.save({height:3,spread:2.4,canopyFullness:.65});
 assert.equal(Object.hasOwn(small.requested,'trunkGirth'),false);assert.ok(Math.abs(Number(small.applied.trunkGirth)-.22)<1e-12);
 assert.equal(control.default,initial);assert.equal(d.save({}).applied.trunkGirth,.22);
 assert.throws(()=>d.save({...small.requested,trunkGirth:.48}),/radius/i);
});
test('old sparse small-tree configurations migrate with an honest derived radius',()=>{
 const oldest={formatVersion:1,family:'tree',familyVersion:'0.1.0',requested:{height:3,spread:2.4},applied:{height:3,spread:2.4,seed:7,colorway:'forest'}};
 const cases=[oldest,JSON.parse(readFileSync('tests/fixtures/family-v020-custom.json','utf8')).tree,saveRevision2('tree',{height:3,spread:2.4})];
 for(const prior of cases){
  const migrated=loadDesign(prior);
  for(const [key,value] of Object.entries(prior.applied))assert.equal(migrated.applied[key],value);
  assert.equal(migrated.familyVersion,'0.5.0');assert.ok(Math.abs(Number(migrated.applied.trunkGirth)-.306)<1e-12);
  assert.equal(Object.hasOwn(migrated.requested,'trunkGirth'),true);
  assert.deepEqual(loadDesign(migrated),migrated);
  assert.throws(()=>descriptor('tree').save({...migrated.requested,trunkGirth:.48}),/radius/i);
 }
});

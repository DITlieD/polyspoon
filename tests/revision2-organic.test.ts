import test from 'node:test';
import {facetedLoft} from '../src/engine/geometry.ts';
test('organic loft rejects collapsed or reversed outlines',()=>{
 const line:Array<[number,number]>=[[0,0],[1,0],[2,0]],reversed:Array<[number,number]>=[[1,0],[0,-1],[-1,0],[0,1]];
 for(const outline of [line,reversed])assert.throws(()=>facetedLoft([{center:[0,0,0],outline},{center:[0,1,0],outline}]));
});

function insideClosedMesh(mesh:Mesh,point:Vector3) {
 const local=mesh.worldToLocal(point.clone()),ray=new Raycaster(local,new Vector3(1,0.371,0.193).normalize()).ray;
 const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,count=index?.count??p.count,distances:number[]=[];
 for(let i=0;i<count;i+=3) {
  const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j));
  const hit=ray.intersectTriangle(vertices[0]!,vertices[1]!,vertices[2]!,false,new Vector3());
  if(hit) {const distance=hit.distanceTo(local);if(!distances.some(d=>Math.abs(d-distance)<1e-6))distances.push(distance);}
 }
 return distances.length%2===1;
}
test('organic boundary variants retain actual crown support and single closed stone bodies',()=>{
 for(const seed of [0,17,91,65535]) {
  for(const growth of ['young','mature'])for(const lean of [-0.10,0.10]) {
   const b=buildAsset('tree',{seed,growth,lean,height:6,spread:3.3});
   try {
    assert.deepEqual(inspectGeometry(b.root).errors,[]);
    for(const crown of b.root.children.filter(o=>o.name.startsWith('crown-'))) {
     const branch=b.root.getObjectByName(crown.name.replace('crown-','branch-')) as Mesh;
     assert.ok(Array.isArray(branch.userData.tip));
     const tip=new Vector3(...branch.userData.tip as [number,number,number]).applyMatrix4(branch.matrixWorld);
     assert.ok(insideClosedMesh(crown as Mesh,tip),crown.name+' unsupported');
    }
    assert.ok(b.dimensions.x<=3.3*1.05);assert.ok(b.dimensions.y<=6*1.001);
   }finally{disposeAsset(b);}
  }
  for(const form of ['slab','standing'])for(const dimensions of [{width:0.6,height:0.35,depth:0.5},{width:2.8,height:0.35,depth:2.4},{width:1.4,height:1.8,depth:1.4}]) {
   const b=buildAsset('boulder',{seed,form,moss:'none',...dimensions});
   try {
    const body=b.root.getObjectByName('stone-mass') as Mesh;
    assert.equal(b.root.children.filter(o=>o instanceof Mesh).length,1);
    assert.ok(insideClosedMesh(body,new Box3().setFromObject(body,true).getCenter(new Vector3())));
    assert.deepEqual(inspectGeometry(b.root).errors,[]);assert.ok(Math.abs(b.bounds.min.y)<1e-6);
   }finally{disposeAsset(b);}
  }
 }
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {descriptor,loadDesign,buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {geometrySnapshot,inspectGeometry} from '../src/lantern/inspect.ts';
import {Box3,Mesh,Vector3,Raycaster} from 'three';

test('R5 controls preserve anchors and distinguish new typed versions',()=>{
 assert.equal(descriptor('tree').state({growth:'young'}).controls['color.foliageLight']?.enabled,true);
 assert.equal(descriptor('tree').state({growth:'mature'}).controls['color.foliageLight']?.enabled,true);
 const additions={tree:{growth:'young',lean:-0.08},fence:{railStyle:'cross-braced',postHead:'flat',detail:'scene'},crate:{lid:'open-top',brace:'plain',detail:'scene'},boulder:{form:'standing',seed:91}};
 for(const [family,input] of Object.entries(additions)) {
  const d=descriptor(family),saved=d.save(input);assert.equal(saved.familyVersion,'0.4.0');
  assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(saved))),saved);
  for(const [key,value] of Object.entries(input))assert.equal(saved.applied[key],value);
  const truncated={...saved.applied};delete truncated[Object.keys(input)[0]!];assert.throws(()=>loadDesign({...saved,applied:truncated}),/applied/i);
  assert.throws(()=>d.save({...input,unknown:true}));
 }
 assert.equal(descriptor('cottage').version,'0.4.0');assert.equal(descriptor('work-lantern').version,'0.4.0');
});
test('R5 migration validates real saved 0.2.0 files before adding defaults',()=>{
 for(const family of ['tree','fence','crate','boulder'])for(const fixtureFile of ['family-v020.json','family-v020-custom.json']) {
  const original=JSON.parse(readFileSync('tests/fixtures/'+fixtureFile,'utf8'))[family];
  assert.equal(original.familyVersion,'0.2.0');
  const next=loadDesign(original);assert.equal(next.familyVersion,'0.4.0');assert.equal(next.migration?.fromVersion,'0.2.0');
  for(const [key,value] of Object.entries(original.applied))assert.equal(next.applied[key],value);
  assert.deepEqual(loadDesign({...next,applied:Object.fromEntries(Object.entries(next.applied).reverse())}),next);
  assert.throws(()=>loadDesign({...original,applied:{...original.applied,colorway:'bad'}}));
  const incomplete={...original.applied};delete incomplete[Object.keys(incomplete).find(k=>k.startsWith('color.'))!];
  assert.throws(()=>loadDesign({...original,applied:incomplete}),/applied/i);
 }
});
test('tree growth and lean change connected construction at equal height',()=>{
 const mature=buildAsset('tree',{growth:'mature',lean:0}),young=buildAsset('tree',{growth:'young',lean:0}),leaning=buildAsset('tree',{growth:'mature',lean:0.1});
 try {
  assert.equal(mature.root.children.filter(o=>o.name.startsWith('crown-')).length,mature.config.applied.branchCount);
  assert.equal(young.root.children.filter(o=>o.name.startsWith('crown-')).length,young.config.applied.branchCount);
  assert.notDeepEqual(geometrySnapshot(mature.root),geometrySnapshot(young.root));
  assert.notDeepEqual(geometrySnapshot(mature.root),geometrySnapshot(leaning.root));
  assert.ok(leaning.anchors.crown![0]!-mature.anchors.crown![0]!>0.35);
  for(const b of [mature,young,leaning]) {
   assert.deepEqual(inspectGeometry(b.root).errors,[]);
   assert.ok(Math.abs(b.bounds.min.y)<1e-6);
   assert.ok(b.dimensions.y<=4.5*1.001);
   assert.ok(b.root.getObjectByName('trunk'));
   for(const crown of b.root.children.filter(o=>o.name.startsWith('crown-'))) {
    const branch=b.root.getObjectByName(crown.name.replace('crown-','branch-')) as Mesh;
    assert.ok(branch,crown.name);
    assert.ok(new Box3().setFromObject(crown,true).intersectsBox(new Box3().setFromObject(branch,true)),crown.name);
   }
  }
 }finally{for(const b of [mature,young,leaning])disposeAsset(b);}
});
test('boulder form and seed change plane organization rather than only object scale',()=>{
 const slab=buildAsset('boulder',{form:'slab',seed:17,height:1,moss:'none'}),standing=buildAsset('boulder',{form:'standing',seed:17,height:1,moss:'none'}),variant=buildAsset('boulder',{form:'slab',seed:91,height:1,moss:'none'});
 try {
  assert.notDeepEqual(geometrySnapshot(slab.root),geometrySnapshot(standing.root));
  assert.notDeepEqual(geometrySnapshot(slab.root),geometrySnapshot(variant.root));
  for(const b of [slab,standing,variant]) {
   assert.deepEqual(inspectGeometry(b.root).errors,[]);assert.ok(Math.abs(b.bounds.min.y)<1e-6);
   assert.ok(Math.abs(b.dimensions.y-1)<1e-6);
   assert.equal(b.root.children.filter(o=>o instanceof Mesh).length,1);
   const stone=b.root.getObjectByName('stone-mass') as Mesh;
   const positions=stone.geometry.getAttribute('position');
   assert.ok(Array.from({length:positions.count},(_,i)=>positions.getY(i)).filter(y=>Math.abs(y)<1e-7).length>=6);
  }
 }finally{for(const b of [slab,standing,variant])disposeAsset(b);}
});

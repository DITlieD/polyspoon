import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import { buildAsset, disposeAsset, descriptor } from '../src/catalog/index.ts';
import type { AssetBuild } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { geometrySnapshot } from '../src/lantern/inspect.ts';
import { validateBytes } from 'gltf-validator';

function bounds(b:AssetBuild,name:string) {
 const object=b.root.getObjectByName(name);assert.ok(object,'Missing '+name);
 return new Box3().setFromObject(object,true);
}
test('fence construction choices preserve exact endpoints and connected rail bays',()=>{
 for(const input of [{length:1.2,height:0.7,bays:2},{length:6,height:1.5,bays:3},{length:2,height:0.9,bays:1}]){
  const b=buildAsset('fence',{...input,railStyle:'cross-braced'});
  try{
   assert.equal(b.anchors.end![0]!-b.anchors.start![0]!,input.length);
   assert.ok(Math.abs(b.bounds.min.y)<1e-6);assert.ok(Math.abs(b.bounds.max.y-input.height)<1e-6);
   const span=input.length/input.bays,post=0.14+input.height*0.035;
   for(let i=0;i<input.bays;i++){
    for(let level=0;level<Number(b.config.applied.railCount);level++){
     const rail=bounds(b,'rail-'+i+'-'+level);
     assert.ok(rail.intersectsBox(bounds(b,'post-'+i)));
     assert.ok(rail.intersectsBox(bounds(b,'post-'+(i+1))));
    }
    const diagonal=bounds(b,'brace-'+i);
    assert.ok(diagonal.intersectsBox(bounds(b,'rail-'+i+'-0')));
    assert.ok(diagonal.intersectsBox(bounds(b,'rail-'+i+'-'+(Number(b.config.applied.railCount)-1))));
    for(const level of [0,Number(b.config.applied.railCount)-1]){
     const overlap=diagonal.clone().intersect(bounds(b,'rail-'+i+'-'+level));
     assert.ok(!overlap.isEmpty());
     let sharedHit=false;
     for(const fx of [.05,.25,.5,.75,.95])for(const fy of [.05,.25,.5,.75,.95]){
      const x=overlap.min.x+(overlap.max.x-overlap.min.x)*fx,y=overlap.min.y+(overlap.max.y-overlap.min.y)*fy;
      const hit=new Raycaster(new Vector3(x,y,2),new Vector3(0,0,-1)).intersectObject(b.root,true);
      if(hit.some(h=>h.object.name==='brace-'+i)&&hit.some(h=>h.object.name==='rail-'+i+'-'+level))sharedHit=true;
     }
     assert.ok(sharedHit,'brace and rail must overlap at a real ray-tested section');
    }
   }
  }finally{disposeAsset(b);}
 }
});
test('fence head and detail choices change authored parts without changing envelope',()=>{
 const flat=buildAsset('fence',{postHead:'flat',detail:'scene'}),head=buildAsset('fence',{postHead:'chamfered',detail:'scene'}),fine=buildAsset('fence',{detail:'inspection'});
 try{
  assert.notDeepEqual(geometrySnapshot(flat.root),geometrySnapshot(head.root));
  assert.deepEqual(flat.dimensions.toArray(),head.dimensions.toArray());
  assert.equal(flat.root.children.some(o=>o.name.startsWith('joint-peg-')),false);
  assert.ok(fine.root.children.some(o=>o.name.startsWith('joint-peg-')));
  assert.equal(flat.root.children.some(o=>o.name.startsWith('brace-')),false);
 }finally{[flat,head,fine].forEach(disposeAsset);}
});
test('crate open top exposes floor and real side walls without a false stack anchor',()=>{
 for(const input of [{width:0.45,height:0.35,depth:0.4},{width:0.75,height:1.2,depth:0.75},{width:1.5,height:0.4,depth:1.2}]){
  const closed=buildAsset('crate',{...input,lid:'closed',brace:'plain',detail:'scene'}),open=buildAsset('crate',{...input,lid:'open-top',brace:'plain',detail:'scene'});
  try{
   assert.deepEqual(closed.anchors.stack,[0,input.height,0]);assert.equal(Object.hasOwn(open.anchors,'stack'),false);
   assert.equal(open.root.children.some(o=>o.name.startsWith('lid-')),false);
   const floorBoards=open.root.children.filter(o=>o.name.startsWith('floor-board-'));
   assert.ok(floorBoards.length>=2);
   const floor=new Box3();for(const board of floorBoards)floor.union(new Box3().setFromObject(board,true));
   assert.ok(floor.getSize(new Vector3()).y>0.015);
   for(const board of floorBoards){
    const center=new Box3().setFromObject(board,true).getCenter(new Vector3());
    const hit=new Raycaster(new Vector3(center.x,2,center.z),new Vector3(0,-1,0)).intersectObject(open.root,true)[0];
    assert.ok(hit);assert.equal(hit.object.name,board.name);assert.ok(Math.abs(hit.point.y-floor.max.y)<1e-6);
    assert.ok(hit.point.y<input.height-Math.min(input.width,input.height,input.depth)*0.115);
   }
   for(const lidPart of closed.root.children.filter(o=>o.name.startsWith('lid-plank-'))){
    const center=new Box3().setFromObject(lidPart,true).getCenter(new Vector3());
    const hit=new Raycaster(new Vector3(center.x,2,center.z),new Vector3(0,-1,0)).intersectObject(lidPart,true)[0]!;
    assert.ok(Math.abs(hit.point.y-input.height)<1e-6);
   }
   for(const sign of [-1,1]){
    const side=bounds(open,'side-plank-'+sign+'-0'),front=bounds(open,'front-plank-'+sign+'-0');
    assert.ok(side.getSize(new Vector3()).x>0.015);assert.ok(front.getSize(new Vector3()).z>0.015);
    assert.ok(floor.intersectsBox(front));
    for(const face of [-1,1]){
     const rim=bounds(open,'face-rim-'+face+'-false'),corner=bounds(open,'corner-'+sign+'-'+face);
     assert.ok(floor.intersectsBox(rim),'floor must rest on bottom frame');
     assert.ok(rim.intersectsBox(corner),'bottom frame must meet corner');
     assert.ok(corner.intersectsBox(side),'side wall must meet supporting corner');
    }
   }
   assert.ok(Math.abs(open.dimensions.x-input.width)<1e-6&&Math.abs(open.dimensions.z-input.depth)<1e-6);
  }finally{disposeAsset(closed);disposeAsset(open);}
 }
});
test('crate braces meet frame and inspection hardware is optional',()=>{
 const b=buildAsset('crate',{brace:'diagonal'}),plain=buildAsset('crate',{brace:'plain',detail:'scene'});
 try{
  for(const sign of [-1,1]){
   const brace=bounds(b,'diagonal-'+sign);
   assert.ok(brace.intersectsBox(bounds(b,'corner--1-'+sign)),'lower diagonal end must meet corner frame');
   assert.ok(brace.intersectsBox(bounds(b,'corner-1-'+sign)),'upper diagonal end must meet corner frame');
  }
  assert.equal(plain.root.children.some(o=>o.name.startsWith('diagonal-')||o.name.startsWith('joint-peg-')),false);
  assert.ok(b.root.children.some(o=>o.name.startsWith('joint-peg-')));
 }finally{disposeAsset(b);disposeAsset(plain);}
});
test('prop inputs fail honestly and semantic recoloring preserves geometry',()=>{
 for(const [family,invalid] of [['fence',{length:6,bays:1}],['fence',{bays:1.5}],['fence',{railStyle:'solid'}],['crate',{width:0.45,height:1.2}],['crate',{lid:'floating'}]] as const)assert.throws(()=>buildAsset(family,invalid));
 for(const family of ['fence','crate']){
  const a=buildAsset(family),b=buildAsset(family,{'color.wood':'#426735'});
  try{assert.deepEqual(geometrySnapshot(a.root),geometrySnapshot(b.root));assert.notEqual(a.materials.wood!.color.getHex(),b.materials.wood!.color.getHex());assert.equal(a.materials.timber!.color.getHex(),b.materials.timber!.color.getHex());}finally{disposeAsset(a);disposeAsset(b);}
 }
});
test('production prop GLBs validate across presets and difficult construction choices',async()=>{
 const cases=[...['fence','crate'].flatMap(family=>descriptor(family).presets.map(p=>({family,input:p.parameters}))),
  {family:'fence',input:{length:1.2,height:0.7,bays:2,railStyle:'cross-braced',postHead:'flat',detail:'scene'}},
  {family:'fence',input:{length:6,height:1.5,bays:3,railStyle:'cross-braced'}},
  {family:'crate',input:{width:0.45,height:0.35,depth:0.4,lid:'open-top',brace:'diagonal'}},
  {family:'crate',input:{width:0.75,height:1.2,depth:0.75,lid:'closed',brace:'plain',detail:'scene'}}];
 for(const entry of cases){
  const b=buildAsset(entry.family,entry.input);
  try{const result=await validateBytes(await exportAsset(b));assert.equal(result.issues.numErrors,0,JSON.stringify(result.issues));assert.equal(result.issues.numWarnings,0,JSON.stringify(result.issues));}finally{disposeAsset(b);}
 }
});


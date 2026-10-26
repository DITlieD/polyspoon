import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Vector3} from 'three';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
test('stone retains broad polygon interiors and bounded moss inside those faces',()=>{
 for(const form of ['slab','standing'])for(const seed of [0,17,65535]){
  const b=buildAsset('boulder',{form,seed,moss:'top'});
  try{
   const stone=b.root.getObjectByName('stone-mass') as Mesh,moss=b.root.getObjectByName('moss-region') as Mesh;
   assert.ok(stone&&moss);
   assert.ok(Array.isArray(stone.userData.majorFaces)&&stone.userData.majorFaces.some((f:any)=>f.vertices.length>=4),'authored polygonal face boundaries');
   for(const patch of moss.userData.patches){
    assert.ok(patch.vertices.length>=4,'bounded polygon patch rather than one complete triangle');
    for(const point of patch.vertices)assert.ok(!patch.outer.some((q:number[])=>new Vector3(...q as [number,number,number]).distanceTo(new Vector3(...point as [number,number,number]))<1e-7),'patch must remain inside supporting face');
   }
  }finally{disposeAsset(b);}
 }
});
test('clipped stone and inset moss together form one outward closed surface',()=>{
 for(const form of ['slab','standing'])for(const angularity of [.3,1])for(const moss of ['none','top']){
  const b=buildAsset('boulder',{form,angularity,moss,mossCoverage:.8,seed:65535});
  try{
   const edges=new Map<string,number>();let volume=0;
   b.root.traverse(o=>{if(!(o instanceof Mesh))return;const p=o.geometry.getAttribute('position');
    const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(6)).join(',');
    for(let i=0;i<p.count;i+=3){
     const a=new Vector3().fromBufferAttribute(p,i),v=new Vector3().fromBufferAttribute(p,i+1),c=new Vector3().fromBufferAttribute(p,i+2);volume+=a.dot(v.cross(c))/6;
     for(let j=0;j<3;j++){const e=[key(i+j),key(i+(j+1)%3)].sort().join('|');edges.set(e,(edges.get(e)??0)+1);}
    }
   });
   assert.ok(volume>0);assert.ok([...edges.values()].every(n=>n===2),'closed exterior has unmatched edges');
  }finally{disposeAsset(b);}
 }
});

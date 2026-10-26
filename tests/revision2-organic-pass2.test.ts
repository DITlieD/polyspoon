import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Vector3} from 'three';
import {facetedLoft} from '../src/engine/geometry.ts';
import {buildAsset,disposeAsset,descriptor} from '../src/catalog/index.ts';
test('loft rejects concave crossing and off-center cap outlines',()=>{
 const outlines:Array<Array<[number,number]>>=[[[2,2],[3,2],[3,3],[2,3]],[[-1,-1],[1,-1],[0,0],[1,1],[-1,1]],[[1,0],[-0.81,0.59],[0.31,-0.95],[0.31,0.95],[-0.81,-0.59]]];
 for(const outline of outlines)assert.throws(()=>facetedLoft([{center:[0,0,0],outline},{center:[0,1,0],outline}]));
});
test('continuous swept trunk has no boundary seam edges',()=>{
 for(const growth of ['young','mature'])for(const lean of [-0.1,0.1]){
  const b=buildAsset('tree',{growth,lean});
  try{
   const trunk=b.root.getObjectByName('trunk');assert.ok(trunk instanceof Mesh);
   const p=trunk.geometry.getAttribute('position'),edges=new Map<string,number>();
   const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(7)).join(',');
   for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
    const edge=[key(i+j),key(i+(j+1)%3)].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
   }
   assert.ok(edges.size>0);assert.ok([...edges.values()].every(n=>n===2),'swept trunk must be watertight through all stations');
  }finally{disposeAsset(b);}
 }
});
test('stone major planes avoid intermediate horizontal perimeter bands',()=>{
 for(const form of ['slab','standing']){
  const b=buildAsset('boulder',{form});
  try {for(const name of ['stone-mass']){const p=(b.root.getObjectByName(name) as Mesh).geometry.getAttribute('position'),levels=new Map<string,Set<string>>();for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<1e-6)continue;const key=y.toFixed(6);if(!levels.has(key))levels.set(key,new Set());levels.get(key)!.add(p.getX(i)+','+p.getZ(i));}assert.ok([...levels.values()].every(v=>v.size<=3),name+' has a level perimeter band');}}finally{disposeAsset(b);}
 }
});

test('stone has one closed surface and an exact supported top anchor',()=>{
 for(const form of ['slab','standing'])for(const seed of [0,17,91,65535]){
  const b=buildAsset('boulder',{form,seed,moss:'none'});
  try {
   assert.equal(b.root.children.filter(o=>o instanceof Mesh).length,1);
   const p=(b.root.getObjectByName('stone-mass') as Mesh).geometry.getAttribute('position'),top=new Vector3(...b.anchors.top!);
   assert.ok(Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i).distanceTo(top)).some(d=>d<1e-6));
   const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(7)).join(',');
   const edges=new Map<string,number>(),vertices=new Set<string>();
   for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
    const a=key(i+j),c=key(i+(j+1)%3);vertices.add(a);const edge=[a,c].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
   }
   assert.ok([...edges.values()].every(n=>n===2),'surface must have no boundary or internal seam edges');
   assert.equal(vertices.size-edges.size+p.count/3,2);
   const body=b.root.getObjectByName('stone-mass') as Mesh;
   const faces=body.userData.majorFaces as Array<{vertices:Array<[number,number,number]>}>;
   assert.ok(Array.isArray(faces)&&faces.length>=4);
   const planes=faces.map(face=>{
    const points=face.vertices.map(v=>new Vector3(...v)),origin=points[0]!;
    const normal=points[1]!.clone().sub(origin).cross(points[2]!.clone().sub(origin)).normalize();
    assert.ok(normal.length()>.99);
    return {origin,normal};
   });
   for(const {origin,normal} of planes)for(let j=0;j<p.count;j++)assert.ok(normal.dot(new Vector3().fromBufferAttribute(p,j).sub(origin))<1e-6,'one convex exterior surface');
   for(let i=0;i<p.count;i+=3){
    const triangle=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,i+j));
    const normal=triangle[1]!.clone().sub(triangle[0]!).cross(triangle[2]!.clone().sub(triangle[0]!)).normalize();
    assert.ok(planes.some(plane=>normal.dot(plane.normal)>1-1e-6&&triangle.every(v=>Math.abs(plane.normal.dot(v.clone().sub(plane.origin)))<1e-6)),'rendered triangle must match an outward supporting face');
   }
  }finally{disposeAsset(b);}
 }
});

test('ratio metadata distinguishes geometric basis and normalized shape',()=>{
 const cases=[['boulder','lean','width'],['tree','lean','height'],['cottage','roofCharacter','normalized']];
 for(const [family,key,basis] of cases){const control=descriptor(family!).controls.find(c=>c.key===key);assert.ok(control&&(control.kind==='range'||control.kind==='integer'));assert.equal(control.ratioBasis,basis);}
});

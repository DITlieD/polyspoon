import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Mesh,Vector3,type Object3D} from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {USDLoader} from 'three/addons/loaders/USDLoader.js';
import {unzipSync} from 'three/addons/libs/fflate.module.js';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportDeliverable} from '../src/catalog/delivery.ts';
import {convertGlb,readGlb,bounds} from '../src/formats/index.ts';

async function benchGlb(){const build=buildAsset('bench',{});try{return await exportDeliverable(build);}finally{disposeAsset(build);}}
const fixtures=async()=>({bench:await benchGlb(),fox:new Uint8Array(await readFile('tests/fixtures/rig-fox-custom-before.glb'))});
function box(object:Object3D){object.updateMatrixWorld(true);return new Box3().setFromObject(object);}
function triangles(object:Object3D){let n=0;object.traverse(o=>{if(o instanceof Mesh){const g=o.geometry;n+=(g.index?g.index.count:g.attributes.position!.count)/3;}});return n;}
function assertBox(actual:Box3,expected:{min:number[];max:number[]},label:string,tolerance=1e-4){
 for(const [k,i] of [['x',0],['y',1],['z',2]] as const){assert.ok(Math.abs(actual.min[k]-expected.min[i]!)<tolerance,label+' min.'+k+' '+actual.min[k]+' vs '+expected.min[i]);assert.ok(Math.abs(actual.max[k]-expected.max[i]!)<tolerance,label+' max.'+k+' '+actual.max[k]+' vs '+expected.max[i]);}
}
// Outward winding check: the geometric face normal of most triangles agrees with the stored vertex normals.
function windingAgreement(object:Object3D){let agree=0,total=0;const a=new Vector3(),b=new Vector3(),c=new Vector3(),n=new Vector3();object.updateMatrixWorld(true);object.traverse(o=>{if(!(o instanceof Mesh)||!o.geometry.attributes.normal)return;const g=o.geometry,p=g.attributes.position!,nn=g.attributes.normal!,count=g.index?g.index.count:p.count;for(let t=0;t<count;t+=3){const [i,j,k]=[t,t+1,t+2].map(x=>g.index?g.index.getX(x):x) as [number,number,number];a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,j);c.fromBufferAttribute(p,k);const face=b.sub(a).cross(c.sub(a));if(face.lengthSq()<1e-14)continue;n.fromBufferAttribute(nn,i).add(new Vector3().fromBufferAttribute(nn,j)).add(new Vector3().fromBufferAttribute(nn,k));total++;if(face.dot(n)>0)agree++;}});return agree/total;}

test('conversion is deterministic and reads the source GLB in meters, +Y up',async()=>{
 const {bench,fox}=await fixtures();
 for(const glb of [bench,fox])for(const f of ['obj','fbx','usdz'] as const)assert.deepEqual(convertGlb(glb,f,'m'),convertGlb(glb,f,'m'));
 const b=bounds(readGlb(bench));assert.ok(b.max[1]!-b.min[1]!>0.2&&b.max[1]!-b.min[1]!<2,'bench height is meters');
});

test('OBJ + MTL zip re-imports with identical bounds, triangles, winding and materials',async()=>{
 for(const [name,glb] of Object.entries(await fixtures())){
  const scene=readGlb(glb),files=unzipSync(convertGlb(glb,'obj',name)),obj=new TextDecoder().decode(files[name+'.obj']!),mtl=new TextDecoder().decode(files[name+'.mtl']!);
  assert.deepEqual(Object.keys(files).sort(),[name+'.mtl',name+'.obj']);assert.match(obj,new RegExp('^mtllib '+name+'.mtl$','m'));
  const materials=new MTLLoader().parse(mtl,'');materials.preload();const loaded=new OBJLoader().setMaterials(materials).parse(obj);
  assertBox(box(loaded),bounds(scene),name+' obj');assert.equal(triangles(loaded),scene.meshes.reduce((s,m)=>s+m.indices.length/3,0));
  assert.ok(windingAgreement(loaded)>0.95,name+' obj winding');
  for(const [i,m] of scene.materials.entries()){if(!scene.meshes.some(mesh=>mesh.material===i))continue;const kd=new RegExp('newmtl [^\\n]*_'+i+'\\nKd ([^\\n]+)').exec(mtl);assert.ok(kd,name+' material '+i);const [r,g,b]=kd[1]!.split(' ').map(Number) as [number,number,number];assert.ok(Math.abs(r-m.color[0])<1e-5&&Math.abs(g-m.color[1])<1e-5&&Math.abs(b-m.color[2])<1e-5,name+' material color '+i);}
 }
});

test('binary FBX 7.4 re-imports with identical bounds, triangles, winding and meter units',async()=>{
 for(const [name,glb] of Object.entries(await fixtures())){
  const scene=readGlb(glb),bytes=convertGlb(glb,'fbx',name);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,18)),'Kaydara FBX Binary');assert.equal(new DataView(bytes.buffer,bytes.byteOffset).getUint32(23,true),7400);
  const loaded=new FBXLoader().parse(Uint8Array.from(bytes).buffer,'');
  assertBox(box(loaded),bounds(scene),name+' fbx');assert.equal(triangles(loaded),scene.meshes.reduce((s,m)=>s+m.indices.length/3,0));
  assert.ok(windingAgreement(loaded)>0.95,name+' fbx winding');
  const text=new TextDecoder('latin1').decode(bytes);assert.ok(text.includes('UnitScaleFactor')&&text.includes('UpAxis'));
 }
});

test('USDZ is 64-byte aligned, declares meters and +Y up, and re-imports with identical bounds',async()=>{
 for(const [name,glb] of Object.entries(await fixtures())){
  const scene=readGlb(glb),bytes=convertGlb(glb,'usdz',name),view=new DataView(bytes.buffer,bytes.byteOffset);
  const nameLength=view.getUint16(26,true),extra=view.getUint16(28,true);assert.equal((30+nameLength+extra)%64,0,'first file data aligned');assert.equal(view.getUint16(8,true),0,'stored, not deflated');
  const usda=new TextDecoder().decode(unzipSync(bytes)[name+'.usda']!);assert.match(usda,/metersPerUnit = 1/);assert.match(usda,/upAxis = "Y"/);assert.match(usda,/UsdPreviewSurface/);
  const loaded=new USDLoader().parse(Uint8Array.from(bytes).buffer);
  assertBox(box(loaded),bounds(scene),name+' usdz');assert.equal(triangles(loaded),scene.meshes.reduce((s,m)=>s+m.indices.length/3,0));
  assert.ok(windingAgreement(loaded)>0.95,name+' usdz winding');
 }
});

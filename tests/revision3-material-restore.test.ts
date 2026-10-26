import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Stage} from '../src/studio/stage.ts';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset} from '../src/catalog/export.ts';
import {Mesh,MeshStandardMaterial,MeshBasicMaterial,Scene} from 'three';

test('Stage shaded/clay/color round trips retain registered per-board colors and match GLB',async()=>{
 const build=buildAsset('crate',{toneVariation:0.1,'color.wood':'#765b42'});
 const originals=new Map<Mesh,MeshStandardMaterial>();
 build.root.traverse(o=>{if(o instanceof Mesh){assert.ok(o.material instanceof MeshStandardMaterial);originals.set(o,o.material);}});
 const stage:Stage=Object.assign(Object.create(Stage.prototype),{
  build,scene:new Scene(),colorMaterials:[],originalMaterials:new WeakMap(),
  clay:new MeshStandardMaterial({color:'#babbb7'}),silhouette:new MeshBasicMaterial({color:'#172119'}),
  render:()=>{},
 });
 try{
  assert.equal(new Set([...originals.values()].filter(m=>m.name.startsWith('wood-tone-')).map(m=>m.color.getHexString())).size,3);
  for(const mode of ['shaded','clay','shaded','color','silhouette','shaded'] as const){
   stage.setMode(mode);
   for(const [mesh,original] of originals){
    assert.equal(mesh.userData.materialRole,original.name.startsWith('wood-tone-')?'wood':original.name);
    assert.equal(build.materials[original.name],original,'actual material key remains registered');
    const current=mesh.material as MeshStandardMaterial|MeshBasicMaterial;
    assert.deepEqual(current.color.toArray(),original.color.toArray(),mode+'/'+mesh.name);
    if(mode!=='color')assert.equal(current,original,'restore exact original material object');
   }
  }
  const bytes=await exportAsset(build),gltf=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+new DataView(bytes.buffer,bytes.byteOffset).getUint32(12,true))));
  for(const [mesh,original] of originals){
   const node=gltf.nodes.find((n:{name:string})=>n.name===mesh.name),primitive=gltf.meshes[node.mesh].primitives[0];
   const material=gltf.materials[primitive.material];
   assert.equal(material.name,original.name);
   assert.deepEqual(material.pbrMetallicRoughness.baseColorFactor,[...original.color.toArray(),1]);
  }
  assert.equal(build.config.applied['color.wood'],'#765b42');
  for(let i=0;i<3;i++)assert.deepEqual(build.materials['wood-tone-'+i]!.color.toArray(),build.materials.wood!.color.clone().multiplyScalar(1+(i-1)*0.1).toArray());
 }finally{disposeAsset(build);}
});

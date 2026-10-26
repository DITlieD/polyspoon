import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAsset, disposeAsset, loadDesign, resolveExport } from '../src/catalog/index.ts';
import { DesignSession } from '../src/catalog/session.ts';
import { Mesh, MeshBasicMaterial } from 'three';
import { exportAsset } from '../src/catalog/export.ts';

const appearance={version:1,palette:'PICO8',shading:'Toon3bands',partColors:{}};
test('appearance survives save, strict load, export resolution and family history',()=>{
 const session=new DesignSession();
 try{
  disposeAsset(session.select('crate'));
  disposeAsset(session.setAppearance(appearance));
  const saved=structuredClone(session.config);
  assert.deepEqual(loadDesign(saved).appearance,appearance);
  const resolved=resolveExport({},saved),rebuilt=buildAsset(resolved.family,resolved.input);
  assert.deepEqual(rebuilt.config.appearance,appearance);disposeAsset(rebuilt);
  disposeAsset(session.select('tree'));disposeAsset(session.select('crate'));
  assert.deepEqual(session.config.appearance,appearance);
  const undone=session.undo();assert.ok(undone);disposeAsset(undone);assert.equal(session.config.appearance,undefined);
  const redone=session.redo();assert.ok(redone);disposeAsset(redone);assert.deepEqual(session.config.appearance,appearance);
  disposeAsset(session.reset());assert.equal(session.config.appearance,undefined);
 }finally{session.dispose();}
});
test('appearance rejects invalid versions, options, unknown fields and parts',()=>{
 for(const invalid of [{...appearance,version:2},{...appearance,palette:'fake'},{...appearance,shading:'fake'},{...appearance,extra:true},{...appearance,partColors:{wood:'red'}}]){
  assert.throws(()=>buildAsset('crate',{appearance:invalid}));
 }
 assert.throws(()=>buildAsset('crate',{bogus:1,appearance}));
});
test('toon exports actual unlit colors without double tint and restores neutral rebuild',async()=>{
 const build=buildAsset('crate',{appearance}),neutral=buildAsset('crate');
 try{
  build.root.traverse(object=>{if(object instanceof Mesh){assert.ok(object.material instanceof MeshBasicMaterial);assert.equal(object.material.color.getHexString(),'ffffff');assert.ok(object.geometry.getAttribute('color'));}});
  const bytes=await exportAsset(build),json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+new DataView(bytes.buffer,bytes.byteOffset).getUint32(12,true))));
  assert.ok(json.extensionsUsed.includes('KHR_materials_unlit'));
  assert.equal(neutral.config.appearance,undefined);
 }finally{disposeAsset(build);disposeAsset(neutral);}
});

test('individual parts retain inactive edits and Flat exports unlit authored tint once',async()=>{
 const neutral=buildAsset('fence',{length:2,bays:1}),flat=buildAsset('fence',{length:2,bays:1,appearance:{version:1,palette:'None',shading:'Flat',partColors:{'rail-0-0':'#ff0000','rail-2-0':'#00ff00'}}});
 try{
  const changed=flat.root.getObjectByName('rail-0-0') as Mesh;
  const sibling=flat.root.getObjectByName('rail-0-1') as Mesh;
  assert.ok(changed.material instanceof MeshBasicMaterial);
  assert.equal(changed.material.color.getHexString(),'ff0000');
  assert.notEqual((sibling.material as MeshBasicMaterial).color.getHexString(),'ff0000');
  assert.deepEqual(flat.root.userData.inactivePartColors,['rail-2-0']);
  const original=neutral.root.getObjectByName('rail-0-1') as Mesh;
  assert.deepEqual((sibling.material as MeshBasicMaterial).color.toArray(),(original.material as MeshBasicMaterial).color.toArray());
  assert.deepEqual(sibling.geometry.getAttribute('color')?.array,original.geometry.getAttribute('color')?.array);
  const restored=buildAsset('fence',{bays:3,appearance:flat.config.appearance});
  assert.equal(((restored.root.getObjectByName('rail-2-0') as Mesh).material as MeshBasicMaterial).color.getHexString(),'00ff00');
  disposeAsset(restored);
  const bytes=await exportAsset(flat),json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+new DataView(bytes.buffer,bytes.byteOffset).getUint32(12,true))));
  assert.ok(json.materials.every((m:{extensions?:Record<string,unknown>})=>m.extensions?.KHR_materials_unlit));
 }finally{disposeAsset(neutral);disposeAsset(flat);}
});
test('session rejects non-object parameter input',()=>{
 const session=new DesignSession();
 try{for(const input of [null,4,'',[],false])assert.throws(()=>session.apply(input));}
 finally{session.dispose();}
});

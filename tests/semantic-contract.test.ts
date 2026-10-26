import {buildPriorAsset} from './historical-public.ts';
import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh,Vector3,Quaternion } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildAsset,catalog,disposeAsset } from '../src/catalog/index.ts';
import { exportDeliverable } from '../src/catalog/delivery.ts';
import { controlMetadata } from '../src/engine/parameters.ts';
import { readSemantics, setJointPose,validateSemantics,jointGroup } from '../src/catalog/semantics.ts';

test('all families expose versioned JSON semantics and preserve anchors through GLB import',async()=>{
 for(const d of catalog){const b=buildAsset(d.id);try{
  const metadata=readSemantics(b.root);assert.equal(metadata.identity.family,d.id);assert.equal(metadata.version,1);
  const meshes:Mesh[]=[];b.root.traverse(node=>{if(node instanceof Mesh)meshes.push(node);});
  assert.deepEqual(metadata.anchors,b.anchors);assert.equal(metadata.parts.length,meshes.length);
  assert.equal(metadata.joints.length,['wheelbarrow','treasure-chest','stone-well'].includes(d.id)?1:0);
  assert.deepEqual(JSON.parse(JSON.stringify(metadata)),metadata);validateSemantics(metadata);
  const bytes=await exportDeliverable(b),loaded=await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer,'');
  const root=loaded.scene.getObjectByName(b.root.name)!;assert.deepEqual(readSemantics(root),metadata);
 }finally{disposeAsset(b);}}
});
test('input units distinguish centimeters for display from meter inputs',()=>{
 const controls=controlMetadata(catalog[0]!.controls);
 const cm=controls.find(c=>c.displayUnit==='cm');assert.ok(cm);assert.equal(cm.inputUnit,'m');
 const chest=controlMetadata(catalog.find(d=>d.id==='treasure-chest')!.controls).find(c=>c.key==='lidAngle');assert.equal(chest?.inputUnit,'degrees');
 const chestControls=controlMetadata(catalog.find(d=>d.id==='treasure-chest')!.controls);assert.equal(chestControls.find(c=>c.key==='bandInset')?.inputUnit,'dimensionless');assert.equal(chestControls.find(c=>c.key==='boardCount')?.inputUnit,'integer');
});
test('declared joints rotate around fixed root-relative pivots while supports remain fixed',()=>{
 for(const [family,id,fixed] of [['wheelbarrow','wheel-axle','handle--1'],['treasure-chest','lid-pivot','base'],['stone-well','windlass-pivot','post--1']] as const){
  const b=buildAsset(family);try{const contract=readSemantics(b.root),joint=contract.joints.find(j=>j.id===id)!;assert.ok(joint);
   const support=b.root.getObjectByName(fixed)!;assert.ok(support);b.root.updateMatrixWorld(true);const before=support.matrixWorld.toArray();
   const group=b.root.getObjectByName(joint.node)!;const center=group.getWorldPosition(new Vector3());
   const moving=b.root.getObjectByName(contract.parts.find(p=>p.group===id)!.node)!;const point=moving.getWorldPosition(new Vector3());
   const mesh=moving as Mesh,positions=mesh.geometry.getAttribute('position');let vertex=0;for(let i=0;i<positions.count;i++){const candidate=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).sub(center);if(candidate.clone().cross(new Vector3(...joint.axis)).length()>0.01){vertex=i;break;}}
   const original=new Vector3().fromBufferAttribute(positions,vertex).applyMatrix4(mesh.matrixWorld);
   const expected=original.clone().sub(center).applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(...joint.axis),Math.PI/3)).add(center);
   setJointPose(b.root,id,60);const articulated=new Vector3().fromBufferAttribute(positions,vertex).applyMatrix4(mesh.matrixWorld);assert.ok(articulated.distanceTo(expected)<1e-10);assert.ok(articulated.distanceTo(original)>0.001);assert.deepEqual(support.matrixWorld.toArray(),before);assert.ok(group.getWorldPosition(new Vector3()).distanceTo(center)<1e-12);
   const distance=moving.getWorldPosition(new Vector3()).distanceTo(center);assert.ok(Math.abs(distance-point.distanceTo(center))<1e-10);
   assert.throws(()=>setJointPose(b.root,id,999));assert.throws(()=>setJointPose(b.root,id,NaN));assert.throws(()=>setJointPose(b.root,'missing',0));
  }finally{disposeAsset(b);}
 }
});
test('invalid semantic anchors and duplicate or dangling references reject',()=>{
 const b=buildAsset('bench');try{const good=readSemantics(b.root);
  for(const bad of [{...good,anchors:{bad:[NaN,0,0]}},{...good,parts:[...good.parts,good.parts[0]]},{...good,parts:[{...good.parts[0],materialId:'missing'}]}])assert.throws(()=>validateSemantics(bad));
 }finally{disposeAsset(b);}
});
test('parts retain semantic identity through structural variants and runtime poses preserve saved parameters',()=>{
 const a=buildAsset('wheelbarrow'),b=buildAsset('wheelbarrow',{trayLength:1.3,wheelStyle:'spoked'});
 try{const first=readSemantics(a.root),next=readSemantics(b.root);
  for(const side of [-1,1])for(const i of [0,1]){const id='strap-'+side+'-'+i;assert.ok(first.parts.some(p=>p.id===id));assert.ok(next.parts.some(p=>p.id===id));}
  assert.ok(!next.parts.some(p=>p.id==='wheel-wood--1'));assert.ok(next.parts.some(p=>p.id==='wheel-spoke-0'));
  const saved=JSON.stringify(b.config);setJointPose(b.root,'wheel-axle',-180);assert.equal(JSON.stringify(b.config),saved);
  const copy=structuredClone(next);copy.parts[0]!.node='missing';copy.parts[0]!.id=copy.parts[1]!.id;assert.throws(()=>validateSemantics(copy));
 }finally{disposeAsset(a);disposeAsset(b);}
});
test('articulated GLB preserves joints, pose and anchors while rejecting damaged mapping',async()=>{
 const b=buildAsset('stone-well');try{
  setJointPose(b.root,'windlass-pivot',75);const bytes=await exportDeliverable(b),loaded=await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer,'');
  const root=loaded.scene.getObjectByName('stone-well')!;assert.equal(readSemantics(root).joints[0]!.angle,75);setJointPose(root,'windlass-pivot',-30);assert.equal(readSemantics(root).joints[0]!.angle,-30);
  b.root.getObjectByName('crank-arm')!.userData.openpoly.partId='missing';await assert.rejects(exportDeliverable(b));
 }finally{disposeAsset(b);}
});
test('semantic JSON ignores object key order and rejects duplicate control references',()=>{
 const b=buildAsset('bench');try{const s=readSemantics(b.root);
  validateSemantics({...s,coordinates:Object.fromEntries(Object.entries(s.coordinates).reverse()),delivery:Object.fromEntries(Object.entries(s.delivery).reverse())});
  assert.throws(()=>validateSemantics({...s,controls:[...s.controls,s.controls[0]]}));
 }finally{disposeAsset(b);}
});
test('actual node material/group identity and joint transform damage reject',()=>{
 for(const damage of [
  (b:ReturnType<typeof buildAsset>)=>{b.root.getObjectByName('post--1')!.name='different-support';},
  (b:ReturnType<typeof buildAsset>)=>{const m=b.root.getObjectByName('post--1') as Mesh;(m.material as any).name='different-material';},
  (b:ReturnType<typeof buildAsset>)=>{b.root.getObjectByName('post--1')!.userData.materialRole='iron';},
  (b:ReturnType<typeof buildAsset>)=>{b.root.getObjectByName('post--1')!.userData.openpoly.group='windlass-pivot';},
  (b:ReturnType<typeof buildAsset>)=>{b.root.getObjectByName('windlass-pivot')!.add(b.root.getObjectByName('post--1')!);},
  (b:ReturnType<typeof buildAsset>)=>{b.root.getObjectByName('windlass-pivot')!.position.y+=0.1;},
  (b:ReturnType<typeof buildAsset>)=>{b.root.getObjectByName('windlass-pivot')!.rotation.x=0.4;},
  (b:ReturnType<typeof buildAsset>)=>{b.semantics.joints[0]!.axis=[0,1,0];},
 ]){const b=buildAsset('stone-well');try{damage(b);assert.throws(()=>readSemantics(b.root));assert.throws(()=>setJointPose(b.root,'windlass-pivot',20));}finally{disposeAsset(b);}}
});
test('control metadata retains legacy units and rejects malformed domains',()=>{
 const b=buildAsset('bench');try{const s=readSemantics(b.root);for(const c of s.controls)assert.equal(c.unit,c.displayUnit);
  for(const patch of [{inputUnit:'furlong'},{displayUnit:'cm'},{kind:'unknown'},{default:NaN},{min:10,max:1},{step:0}]){const controls=structuredClone(s.controls);Object.assign(controls[0]!,patch);assert.throws(()=>validateSemantics({...s,controls}));}
 }finally{disposeAsset(b);}
});
test('semantic export includes hidden preview meshes and complete moving groups',async()=>{
 for(const name of ['floor-0','wheel-axle']){const b=buildAsset('wheelbarrow');try{
  b.root.getObjectByName(name)!.visible=false;const bytes=await exportDeliverable(b),loaded=await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer,'');const root=loaded.scene.getObjectByName('wheelbarrow')!;
  assert.deepEqual(readSemantics(root),b.semantics);assert.ok(root.getObjectByName(name));assert.equal(b.root.getObjectByName(name)!.visible,false);
 }finally{disposeAsset(b);}}
});
test('all reparented cases retain original geometry materials config anchors and dimensions',async()=>{
 const {baselineBuilds,compareBaselineBuild}=await import('./semantic-legacy-payload.ts');
 for(const old of baselineBuilds){const b=await buildPriorAsset(old.family,old.config.requested);try{compareBaselineBuild(b,old);}finally{disposeAsset(b);}}
});

test('portable joint node names round trip and sanitized-name declarations reject',async()=>{
 const b=buildAsset('wheelbarrow');try{
  assert.throws(()=>jointGroup(b.root,'wheel.pivot',[0,0,0],[b.root.getObjectByName('axle')!]),/Portable joint node name/);
  const invalid=structuredClone(b.semantics);invalid.joints[0]!.node='wheel:pivot';assert.throws(()=>validateSemantics(invalid),/Portable joint node name/);
  b.root.getObjectByName('wheel-axle')!.name='wheel_pivot';b.semantics.joints[0]!.node='wheel_pivot';
  const bytes=await exportDeliverable(b),loaded=await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer,'');const root=loaded.scene.getObjectByName('wheelbarrow')!;
  assert.equal(readSemantics(root).joints[0]!.node,'wheel_pivot');setJointPose(root,'wheel-axle',40);assert.equal(readSemantics(root).joints[0]!.angle,40);
 }finally{disposeAsset(b);}
});

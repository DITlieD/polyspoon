import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationMixer,Bone,Matrix4,Mesh,SkinnedMesh,Vector3 } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateBytes } from 'gltf-validator';
import { descriptor } from '../src/catalog/index.ts';
import { buildEnvironment,exportEnvironment,terrainParameters } from '../src/environment/index.ts';
import { exportAsset } from '../src/catalog/export.ts';

function manifest(ids:string[]){return {formatVersion:1,terrain:terrainParameters({cells:16,amplitude:0}),tiles:[{x:0,z:0}],placements:ids.map((id,i)=>({id:['left','right','seat'][i]!,design:descriptor(id).save(id==='stylized-humanoid'?{height:i?1.9:1.7}:id==='stylized-fox'?{bodyLength:.6}:{width:1.8}),x:[4,10,11][i]!,z:[4,10,3][i]!,yaw:i===1?90:0,maxSlopeDegrees:5,maxSupportVariation:.01})),roads:[],water:[]};}
function skins(root:Object3D){const result:SkinnedMesh[]=[];root.traverse(node=>{if(node instanceof SkinnedMesh)result.push(node);});return result;}
function ownedSkins(root:Object3D,wrapper:Object3D){return skins(root).filter(mesh=>mesh.skeleton.bones.every(bone=>contains(wrapper,bone)));}
function corners(mesh:SkinnedMesh){mesh.skeleton.update();const count=mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count;return Array.from({length:count},(_,i)=>mesh.getVertexPosition(mesh.geometry.index?.getX(i)??i,new Vector3()).applyMatrix4(mesh.matrixWorld));}
function contains(root:Object3D,node:Object3D){for(let current:Object3D|null=node;current;current=current.parent)if(current===root)return true;return false;}

for(const families of [['stylized-humanoid','stylized-humanoid'],['stylized-humanoid','stylized-fox','bench']])test('environment exports isolated rig instances: '+families.join(','),async()=>{
 const source=manifest(families),build=buildEnvironment(source),before=source.placements.map(p=>{const wrapper=build.root.getObjectByName('placement-'+p.id)!;return {id:p.id,world:wrapper.matrixWorld.clone(),corners:skins(wrapper).map(corners)};}),sourceNames=skins(build.root).flatMap(mesh=>mesh.skeleton.bones.map(bone=>bone.name)),geometries=skins(build.root).map(mesh=>({mesh,geometry:mesh.geometry,positions:Array.from(mesh.geometry.getAttribute('position').array)}));
 let sourceDisposals=0;for(const geometry of new Set(geometries.map(item=>item.geometry)))geometry.addEventListener('dispose',()=>sourceDisposals++);
 try{
  const bytes=await exportEnvironment(build,{fixture:'rig-instances'});assert.deepEqual(await exportEnvironment(build,{fixture:'rig-instances'}),bytes);const validation=await validateBytes(bytes);assert.equal(validation.issues.numErrors,0,JSON.stringify(validation.issues));assert.equal(validation.issues.numWarnings,0,JSON.stringify(validation.issues));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),document=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+view.getUint32(12,true))));assert.doesNotMatch(JSON.stringify(document),/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  const expectedClips=['left:idle','left:walk','right:idle','right:walk'];assert.deepEqual(document.animations.map((clip:{name:string})=>clip.name),expectedClips);
  for(const clip of document.animations){const placement=clip.name.split(':')[0],index=document.nodes.findIndex((node:{name:string})=>node.name==='placement-'+placement),owned=new Set<number>();const visit=(i:number)=>{owned.add(i);for(const child of document.nodes[i].children??[])visit(child);};visit(index);for(const channel of clip.channels)assert.ok(owned.has(channel.target.node),clip.name+' target ownership');}
  const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');loaded.scene.updateMatrixWorld(true);assert.deepEqual(loaded.animations.map(clip=>clip.name),expectedClips);
  try{
   for(const expected of before){const wrapper=loaded.scene.getObjectByName('placement-'+expected.id)!;assert.ok(wrapper);for(let i=0;i<16;i++)assert.ok(Math.abs(wrapper.matrixWorld.elements[i]!-expected.world.elements[i]!)<1e-6);const actualSkins=ownedSkins(loaded.scene,wrapper);assert.equal(actualSkins.length,expected.corners.length);
    for(let i=0;i<actualSkins.length;i++){const mesh=actualSkins[i]!,actual=corners(mesh);assert.equal(actual.length,expected.corners[i]!.length);for(let j=0;j<actual.length;j++)assert.ok(actual[j]!.distanceTo(expected.corners[i]![j]!)<2e-5,expected.id+' rest vertex '+j);assert.ok(mesh.skeleton.bones.every(bone=>bone instanceof Bone&&contains(wrapper,bone)));}
   }
   const left=ownedSkins(loaded.scene,loaded.scene.getObjectByName('placement-left')!)[0]!,right=ownedSkins(loaded.scene,loaded.scene.getObjectByName('placement-right')!)[0]!;assert.ok(left.skeleton.bones.every(bone=>!right.skeleton.bones.includes(bone)));
   for(const [owner,other] of [[left,right],[right,left]] as [SkinnedMesh,SkinnedMesh][]){const id=owner===left?'left':'right',wrapper=loaded.scene.getObjectByName('placement-'+id)!,originalPosition=wrapper.position.clone(),originalQuaternion=wrapper.quaternion.clone(),oldWorld=wrapper.matrixWorld.clone(),ownBefore=corners(owner),otherBefore=corners(other);assert.equal(owner.userData.placementId,id);wrapper.position.x+=2;wrapper.rotation.y+=.4;loaded.scene.updateMatrixWorld(true);const delta=new Matrix4().multiplyMatrices(wrapper.matrixWorld,oldWorld.invert()),ownAfter=corners(owner),otherAfter=corners(other);for(let i=0;i<ownAfter.length;i++)assert.ok(ownAfter[i]!.distanceTo(ownBefore[i]!.applyMatrix4(delta))<2e-5);for(let i=0;i<otherAfter.length;i++)assert.ok(otherAfter[i]!.distanceTo(otherBefore[i]!)<1e-8);wrapper.position.copy(originalPosition);wrapper.quaternion.copy(originalQuaternion);loaded.scene.updateMatrixWorld(true);}
   for(const [owner,other] of [[left,right],[right,left]] as [SkinnedMesh,SkinnedMesh][]){const id=owner===left?'left':'right',clip=loaded.animations.find(item=>item.name===id+':walk')!,mixer=new AnimationMixer(loaded.scene),ownBefore=owner.skeleton.bones[0]!.getWorldPosition(new Vector3()),otherBefore=other.skeleton.bones[0]!.getWorldPosition(new Vector3());mixer.clipAction(clip).play();mixer.update(clip.duration/4);loaded.scene.updateMatrixWorld(true);assert.ok(owner.skeleton.bones[0]!.getWorldPosition(new Vector3()).distanceTo(ownBefore)>.001);assert.ok(other.skeleton.bones[0]!.getWorldPosition(new Vector3()).distanceTo(otherBefore)<1e-8);mixer.stopAllAction();mixer.uncacheRoot(loaded.scene);loaded.scene.updateMatrixWorld(true);}
  }finally{const resources=new Set<{dispose():void}>();loaded.scene.traverse(node=>{if(node instanceof Mesh){resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])resources.add(material);}if(node instanceof SkinnedMesh)resources.add(node.skeleton);});for(const resource of resources)resource.dispose();}
  assert.equal(sourceDisposals,0);for(const item of geometries){assert.equal(item.mesh.geometry,item.geometry);assert.deepEqual(Array.from(item.geometry.getAttribute('position').array),item.positions);}assert.deepEqual(skins(build.root).flatMap(mesh=>mesh.skeleton.bones.map(bone=>bone.name)),sourceNames);
 }finally{build.dispose();}
});

test('rigid-only environment bytes retain the frozen exporter contract',async()=>{
 const build=buildEnvironment(manifest(['bench']));try{build.root.userData.provenance={fixture:'rigid'};assert.deepEqual(await exportEnvironment(build,{fixture:'rigid'}),await exportAsset(build));}finally{build.dispose();}
});

test('environment rejects damaged source rig clips',async()=>{
 const build=buildEnvironment(manifest(['stylized-humanoid']));try{build.root.getObjectByName('stylized-humanoid')!.animations=[];await assert.rejects(exportEnvironment(build));}finally{build.dispose();}
});

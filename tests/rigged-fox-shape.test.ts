import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster,SkinnedMesh,Vector3 } from 'three';
import { readFile } from 'node:fs/promises';
import { buildFox,buildSavedFox } from '../src/rigging/fox-build.ts';

function surface(build:ReturnType<typeof buildFox>,origin:Vector3,direction:Vector3){return new Raycaster(origin,direction).intersectObjects(build.root.children,true)[0]!.point;}

test('fox default has compact proportions, a defined chest and a tucked belly below a level rump',()=>{
  const build=buildFox();try{
    const L=Number(build.config.applied.bodyLength),H=L*Number(build.config.applied.heightRatio);assert.ok(L<=.45);assert.ok(H>=.34);
    const chestBottom=surface(build,new Vector3(0,-1,L*.36),new Vector3(0,1,0)),waistBottom=surface(build,new Vector3(0,-1,L*.08),new Vector3(0,1,0));assert.ok(waistBottom.y-chestBottom.y>H*.1);
    const chestTop=surface(build,new Vector3(0,2,L*.36),new Vector3(0,-1,0)),rumpTop=surface(build,new Vector3(0,2,-L*.43),new Vector3(0,-1,0));assert.ok(chestTop.y-rumpTop.y>H*.07);
    const chestWidth=surface(build,new Vector3(1,H*.8,L*.36),new Vector3(-1,0,0)).x,waistWidth=surface(build,new Vector3(1,H*.8,L*.08),new Vector3(-1,0,0)).x;assert.ok(chestWidth>waistWidth*1.2);
  }finally{build.dispose();}
});

test('fox upper limbs have shoulder and haunch volume before tapering to the paws',()=>{
  const build=buildFox();try{
    const L=Number(build.config.applied.bodyLength),H=L*Number(build.config.applied.heightRatio),W=H*Number(build.config.applied.chestRatio),mesh=build.root.getObjectByName('fox-fur') as SkinnedMesh,p=mesh.geometry.getAttribute('position'),j=mesh.geometry.getAttribute('skinIndex'),w=mesh.geometry.getAttribute('skinWeight');
    for(const [name,min,max,minimumWidth] of [['front_upper_l',.67,.79,.45],['hind_thigh_l',.68,.82,.65]] as const){
      const bone=mesh.skeleton.bones.findIndex(b=>b.name===name),xs:number[]=[];for(let i=0;i<p.count;i++)if(p.getY(i)>H*min&&p.getY(i)<H*max&&[0,1,2,3].some(k=>j.getComponent(i,k)===bone&&w.getComponent(i,k)>.99))xs.push(p.getX(i));assert.ok(xs.length>0);assert.ok(Math.max(...xs)-Math.min(...xs)>W*minimumWidth);
    }
  }finally{build.dispose();}
});

test('fox ears have substantial depth and the cream tip occupies a broad final tail portion',()=>{
  const build=buildFox();try{
    const L=Number(build.config.applied.bodyLength),head=L*Number(build.config.applied.headRatio),earZ:number[]=[],creamTail:Vector3[]=[];
    build.root.traverse(object=>{if(!(object instanceof SkinnedMesh))return;const p=object.geometry.getAttribute('position'),j=object.geometry.getAttribute('skinIndex'),w=object.geometry.getAttribute('skinWeight');for(let i=0;i<p.count;i++){
      const names=[0,1,2,3].filter(k=>w.getComponent(i,k)>0).map(k=>object.skeleton.bones[j.getComponent(i,k)]!.name);if(names.includes('ear_l'))earZ.push(p.getZ(i));if(object.name==='fox-cream'&&names.some(name=>name.startsWith('tail_')))creamTail.push(new Vector3().fromBufferAttribute(p,i));
    }});assert.ok(Math.max(...earZ)-Math.min(...earZ)>head*.17);const tailLength=L*Number(build.config.applied.tailRatio),radius=L*Number(build.config.applied.tailFullness);assert.ok(Math.max(...creamTail.map(p=>p.z))-Math.min(...creamTail.map(p=>p.z))>tailLength*.28);assert.ok(Math.max(...creamTail.map(p=>Math.abs(p.x)))>radius*.75);
  }finally{build.dispose();}
});

test('prior fox design dimensions load deliberately after the default proportion revision',async()=>{
  const source=JSON.parse(await readFile('evidence/rigged-fox/rejected-first-candidate/candidate-02/fox.glb.design.json','utf8')),build=buildSavedFox(source);try{assert.deepEqual(build.config.applied,source.applied);assert.equal(build.config.familyVersion,'1.1.0');assert.equal(build.config.migration?.fromVersion,'1.0.0');const repeated=buildSavedFox(JSON.parse(JSON.stringify(build.config)));try{assert.deepEqual(repeated.config,build.config);}finally{repeated.dispose();}}finally{build.dispose();}
});

test('cream inner ear panels face forward on both thick ear volumes',()=>{
  const build=buildFox();try{
    const mesh=build.root.getObjectByName('fox-cream') as SkinnedMesh,p=mesh.geometry.getAttribute('position'),j=mesh.geometry.getAttribute('skinIndex'),w=mesh.geometry.getAttribute('skinWeight'),indices=mesh.geometry.index!;
    for(const name of ['ear_l','ear_r']){const bone=mesh.skeleton.bones.findIndex(bone=>bone.name===name);let checked=0;for(let i=0;i<indices.count;i+=3){const slots=[0,1,2].map(k=>indices.getX(i+k));if(!slots.every(slot=>[0,1,2,3].some(k=>j.getComponent(slot,k)===bone&&w.getComponent(slot,k)>.99)))continue;const a=new Vector3().fromBufferAttribute(p,slots[0]!),b=new Vector3().fromBufferAttribute(p,slots[1]!),c=new Vector3().fromBufferAttribute(p,slots[2]!),normal=b.sub(a).cross(c.sub(a)).normalize();assert.ok(normal.z>0);checked++;}assert.ok(checked>0);const origin=build.root.getObjectByName(name)!.getWorldPosition(new Vector3()),head=Number(build.config.applied.bodyLength)*Number(build.config.applied.headRatio),side=name.endsWith('_l')?1:-1,y=origin.y+head*Number(build.config.applied.earRatio)*.5,x=origin.x+side*head*.045*.5,front=new Raycaster(new Vector3(x,y,2),new Vector3(0,0,-1)).intersectObjects(build.root.children,true)[0],rear=new Raycaster(new Vector3(x,y,-2),new Vector3(0,0,1)).intersectObjects(build.root.children,true)[0];assert.equal(front?.object.name,'fox-cream');assert.equal(rear?.object.name,'fox-fur');}
  }finally{build.dispose();}
});

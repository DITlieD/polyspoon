import '../scripts/node-platform.ts';
import test from 'node:test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { AnimationMixer,Group,LoopOnce,SkinnedMesh,Vector3 } from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateBytes } from 'gltf-validator';
import { buildFox,buildSavedFox,applyFoxPawTarget } from '../src/rigging/fox-build.ts';
import { buildHumanoid } from '../src/rigging/build.ts';
import { exportRiggedAsset } from '../src/rigging/export.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';

test('fox has original28bone anatomy, validweighted surfaces and meaningful proportions',()=>{
  for(const input of [{},{bodyLength:.35,heightRatio:.6,chestRatio:.38,headRatio:.38,earRatio:.6,muzzleRatio:.55,tailRatio:1.2,tailFullness:.18},{bodyLength:.75,heightRatio:.8,chestRatio:.25,headRatio:.26,earRatio:.35,muzzleRatio:.35,tailRatio:.8,tailFullness:.1}]){
    const build=buildFox(input);try{
      assert.equal(build.rig.kind,'fox');assert.equal(build.rig.bones.length,28);assert.equal(build.rig.effectors!.length,4);assert.deepEqual(inspectGeometry(build.root).errors,[]);
      assert.ok(build.root.getObjectByName('hind_hock_l')!.getWorldPosition(new Vector3()).y>Number(build.config.applied.bodyLength)*.1);assert.ok(!build.root.getObjectByName('upper_arm_l'));
      assert.ok(build.root.getObjectByName('ear_l'));assert.ok(build.root.getObjectByName('tail_tip'));assert.equal(build.root.animations.length,2);
      const copy=buildSavedFox(JSON.parse(JSON.stringify(build.config)));try{assert.deepEqual(copy.config,build.config);}finally{copy.dispose();}
      let blended=0;build.root.traverse(object=>{if(!(object instanceof SkinnedMesh))return;const w=object.geometry.getAttribute('skinWeight');for(let i=0;i<w.count;i++)if([0,1,2,3].filter(k=>w.getComponent(i,k)>0).length>1)blended++;});assert.ok(blended>50);
    }finally{build.dispose();}
  }
  const small=buildFox({bodyLength:.35}),large=buildFox({bodyLength:.75});try{assert.ok(large.dimensions.z>small.dimensions.z*1.8);}finally{small.dispose();large.dispose();}
  for(const input of [{bodyLength:0},{heightRatio:NaN},{tailFullness:1},{extra:1},{'color.fur':'orange'}])assert.throws(()=>buildFox(input));
});

test('foxgeneratedandimportedclips keepallpawsoles grounded betweenkeys',async()=>{
  const rows=['parameters,source,clip,time,bone,maximumHeightError,maximumDrift'];
  for(const parameters of [{},{bodyLength:.35,heightRatio:.6},{bodyLength:.75,heightRatio:.8}]){
    const build=buildFox(parameters);try{
      const bytes=await exportRiggedAsset(build),report=await validateBytes(bytes);assert.equal(report.issues.numErrors,0);assert.equal(report.issues.numWarnings,0);
      const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
      for(const [root,clips] of [[build.root,build.root.animations],[loaded.scene,loaded.animations]] as const){
        const mesh=root.getObjectByName('fox-dark') as SkinnedMesh,p=mesh.geometry.getAttribute('position'),w=mesh.geometry.getAttribute('skinWeight'),j=mesh.geometry.getAttribute('skinIndex');
        for(const declaration of build.rig.clips){const mixer=new AnimationMixer(root),clip=clips.find(c=>c.name===declaration.name)!,action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();const anchors=new Map<string,Vector3[]>();
          for(let i=1;i<240;i++){const time=clip.duration*i/240;mixer.setTime(time);root.updateMatrixWorld(true);mesh.skeleton.update();for(const contact of declaration.contacts){if(time<contact.start+1e-6||time>contact.end-1e-6)continue;const bone=mesh.skeleton.bones.findIndex(b=>b.name===contact.bone),points:Vector3[]=[];
            for(let v=0;v<p.count;v++)if(Math.abs(p.getY(v))<1e-8&&[0,1,2,3].every(k=>w.getComponent(v,k)===0||j.getComponent(v,k)===bone))points.push(mesh.getVertexPosition(v,new Vector3()));assert.ok(points.length>=6);
            const key=contact.bone+'-'+contact.start;if(!anchors.has(key))anchors.set(key,points.map(point=>point.clone()));rows.push([Object.entries(parameters).map(([k,v])=>k+'='+v).join(';')||'default',root===build.root?'generated':'imported',declaration.name,time,contact.bone,Math.max(...points.map(point=>Math.abs(point.y))),Math.max(...points.map((point,v)=>point.distanceTo(anchors.get(key)![v]!)))].join(','));points.forEach((point,v)=>{assert.ok(Math.abs(point.y)<=.005,`${declaration.name}/${contact.bone}/${time}: ${point.y}`);assert.ok(point.distanceTo(anchors.get(key)![v]!)<=.005);});
          }}mixer.stopAllAction();mixer.uncacheRoot(root);
        }
      }
      loaded.scene.traverse(object=>{if(object instanceof SkinnedMesh){object.geometry.dispose();object.skeleton.dispose();for(const m of Array.isArray(object.material)?object.material:[object.material])m.dispose();}});
    }finally{build.dispose();}
  }
  writeFileSync('evidence/rigged-fox/contact-samples.csv',rows.join('\n')+'\n');
});

test('foxIKrejectsunreachabletargetswithoutmutationandhumanoidexportremains exact',async()=>{
  const fox=buildFox();try{const before=fox.rig.bones.map(b=>fox.root.getObjectByName(b.name)!.quaternion.toArray());assert.throws(()=>applyFoxPawTarget(fox.root,fox.rig,'front_l',new Vector3(100,100,100)));assert.deepEqual(fox.rig.bones.map(b=>fox.root.getObjectByName(b.name)!.quaternion.toArray()),before);}finally{fox.dispose();}
  const humanoid=buildHumanoid();try{assert.deepEqual(Buffer.from(await exportRiggedAsset(humanoid)),await readFile('evidence/rigged-humanoid/portable-normals-candidate/humanoid.glb'));}finally{humanoid.dispose();}
});


test('fox tail deforms and root displacement stays continuous across its own gait loop',()=>{
  const build=buildFox();try{
    const mesh=build.root.getObjectByName('fox-fur') as SkinnedMesh,p=mesh.geometry.getAttribute('position'),w=mesh.geometry.getAttribute('skinWeight'),j=mesh.geometry.getAttribute('skinIndex'),tail=mesh.skeleton.bones.findIndex(bone=>bone.name==='tail_mid_b');let vertex=-1;
    for(let i=0;i<p.count;i++)if([0,1,2,3].some(k=>j.getComponent(i,k)===tail&&w.getComponent(i,k)>.1)){vertex=i;break;}assert.ok(vertex>=0);
    const before=mesh.getVertexPosition(vertex,new Vector3()).clone();build.root.getObjectByName('tail_mid_b')!.rotation.y=.4;build.root.updateMatrixWorld(true);mesh.skeleton.update();assert.ok(mesh.getVertexPosition(vertex,new Vector3()).distanceTo(before)>.001);
    const holder=new Group();holder.add(build.root);const mixer=new AnimationMixer(build.root),clip=build.root.animations.find(clip=>clip.name==='walk')!,delta=build.rig.clips.find(clip=>clip.name==='walk')!.rootDelta;mixer.addEventListener('loop',event=>holder.position.addScaledVector(new Vector3(...delta),event.loopDelta));mixer.clipAction(clip).play();mixer.update(clip.duration-.001);holder.updateMatrixWorld(true);const root=build.root.getObjectByName('motion_root')!,a=root.getWorldPosition(new Vector3());mixer.update(.002);holder.updateMatrixWorld(true);const b=root.getWorldPosition(new Vector3());assert.ok(b.z>=a.z&&b.distanceTo(a)<.005);assert.ok(holder.position.z>0);mixer.stopAllAction();mixer.uncacheRoot(build.root);
  }finally{build.dispose();}
});

test('fox cream throat surfaces face downwards instead of coloring the upper neck',()=>{
  const build=buildFox();try{
    const mesh=build.root.getObjectByName('fox-cream') as SkinnedMesh,p=mesh.geometry.getAttribute('position'),weights=mesh.geometry.getAttribute('skinWeight'),joints=mesh.geometry.getAttribute('skinIndex'),indices=mesh.geometry.index!,neck=mesh.skeleton.bones.findIndex(bone=>bone.name==='neck');let checked=0;
    for(let i=0;i<indices.count;i+=3){const slots=[0,1,2].map(k=>indices.getX(i+k)),neckVertices=slots.filter(slot=>[0,1,2,3].some(k=>joints.getComponent(slot,k)===neck&&weights.getComponent(slot,k)>.99));if(neckVertices.length<2)continue;
      const a=new Vector3().fromBufferAttribute(p,slots[0]!),b=new Vector3().fromBufferAttribute(p,slots[1]!),c=new Vector3().fromBufferAttribute(p,slots[2]!),normal=b.sub(a).cross(c.sub(a)).normalize();assert.ok(normal.y<0);checked++;
    }assert.ok(checked>0);
  }finally{build.dispose();}
});

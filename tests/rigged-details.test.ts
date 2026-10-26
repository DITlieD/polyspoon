import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster,SkinnedMesh,Vector3 } from 'three';
import { buildHumanoid } from '../src/rigging/build.ts';

const front=(mesh:SkinnedMesh,x:number,y:number)=>new Raycaster(new Vector3(x,y,10),new Vector3(0,0,-1)).intersectObject(mesh)[0]?.point;

test('restrained geometric eyes and nose are visible and seated in the parametric head',()=>{
  for(const parameters of [{},{height:1.2,headRatio:.22},{height:2.2,headRatio:.14}]){
    const build=buildHumanoid(parameters);try{
      const h=Number(build.config.applied.height),headH=h*Number(build.config.applied.headRatio),skin=build.root.getObjectByName('humanoid-skin') as SkinnedMesh,eyes=build.root.getObjectByName('humanoid-face') as SkinnedMesh;assert.ok(eyes?.isSkinnedMesh);
      for(const side of [-1,1]){const x=side*headH*.17,y=h-headH*.46,eye=front(eyes,x,y),head=front(skin,x,y);assert.ok(eye&&head);assert.ok(eye.z>head.z);assert.ok(eye.z-head.z<headH*.04);}
      const nose=front(skin,0,h-headH*.64);assert.ok(nose);assert.ok(nose.z>headH*.38&&nose.z<headH*.5);
    }finally{build.dispose();}
  }
});

test('mittens taper to closed shaped fingertips rather than flat cylinder ends',()=>{
  const build=buildHumanoid();try{
    const mesh=build.root.getObjectByName('humanoid-skin') as SkinnedMesh,position=mesh.geometry.getAttribute('position'),weights=mesh.geometry.getAttribute('skinWeight'),indices=mesh.geometry.getAttribute('skinIndex');
    for(const [suffix,side] of [['l',1],['r',-1]] as const){
      const bone=mesh.skeleton.bones.findIndex(bone=>bone.name==='hand_'+suffix),origin=build.root.getObjectByName('hand_'+suffix)!.getWorldPosition(new Vector3()),axis=new Vector3(side*.16,-Math.sqrt(1-.16**2),0),points:{along:number;radius:number}[]=[];
      for(let i=0;i<position.count;i++)if(indices.getX(i)===bone&&weights.getX(i)===1){const point=new Vector3().fromBufferAttribute(position,i).sub(origin),along=point.dot(axis);points.push({along,radius:point.addScaledVector(axis,-along).length()});}
      const length=Math.max(...points.map(point=>point.along)),middle=Math.max(...points.filter(point=>point.along>length*.3&&point.along<length*.75).map(point=>point.radius)),tip=Math.max(...points.filter(point=>point.along>length*.9).map(point=>point.radius));assert.ok(length>Number(build.config.applied.height)*.06);assert.ok(tip<middle*.45);
    }
  }finally{build.dispose();}
});

test('tunic has an open neckline and seated belt and hem edging',()=>{
  const build=buildHumanoid();try{
    const h=Number(build.config.applied.height),hip=h*Number(build.config.applied.legRatio),tunic=build.root.getObjectByName('humanoid-tunic') as SkinnedMesh,boots=build.root.getObjectByName('humanoid-boots') as SkinnedMesh;
    const neck=new Raycaster(new Vector3(0,h+1,0),new Vector3(0,-1,0)).intersectObject(tunic)[0];assert.ok(!neck||neck.point.y<hip);
    for(const y of [hip+h*.035,hip-h*.094]){
      const ray=new Raycaster(new Vector3(10,y,0),new Vector3(-1,0,0)),body=ray.intersectObject(tunic)[0]?.point,trim=ray.intersectObject(boots)[0]?.point;assert.ok(body&&trim);assert.ok(trim.x>body.x&&trim.x-body.x<h*.01);
    }
  }finally{build.dispose();}
});


test('boot cuff profiles sit outside the lower leg surface on both sides',()=>{
  const build=buildHumanoid();try{
    const h=Number(build.config.applied.height),r=h*Number(build.config.applied.limbRatio),boots=build.root.getObjectByName('humanoid-boots') as SkinnedMesh;
    for(const chain of build.rig.chains){const a=build.root.getObjectByName(chain.upper)!.getWorldPosition(new Vector3()),b=build.root.getObjectByName(chain.lower)!.getWorldPosition(new Vector3()),c=build.root.getObjectByName(chain.end)!.getWorldPosition(new Vector3()),point=b.clone().lerp(c,.8495),fraction=(a.distanceTo(b)+b.distanceTo(c)*.8495)/(a.distanceTo(b)+b.distanceTo(c)),baseline=r*(1-.4*fraction),hit=new Raycaster(point.clone().add(new Vector3(baseline+h*.02,0,0)),new Vector3(-1,0,0)).intersectObject(boots)[0]?.point;
      assert.ok(hit);const radius=hit.x-point.x;assert.ok(radius>baseline+h*.002&&radius<baseline+h*.007);
    }
  }finally{build.dispose();}
});

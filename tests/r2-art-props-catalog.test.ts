import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3,DoubleSide,Mesh,Raycaster,Vector3 } from 'three';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';
import type { SemanticAssetBuild } from '../src/catalog/types.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';
import { readSemantics,setJointPose } from '../src/catalog/semantics.ts';

function meshes(build:SemanticAssetBuild,match:(name:string)=>boolean){const values:Mesh[]=[];build.root.traverse(o=>{if(o instanceof Mesh&&match(o.name))values.push(o);});assert.ok(values.length);return values;}
function mesh(build:SemanticAssetBuild,name:string){const value=build.root.getObjectByName(name);assert.ok(value instanceof Mesh,name);return value;}
function distances(origin:Vector3,normal:Vector3,targets:Mesh[]){
 const states=targets.map(o=>{assert.ok(!Array.isArray(o.material));return {material:o.material as any,side:(o.material as any).side};});for(const state of states)state.material.side=DoubleSide;
 try{const ray=new Raycaster(origin,normal.clone().negate());return ray.intersectObjects(targets,false).map(hit=>hit.distance).sort((a,b)=>a-b).filter((n,i,a)=>!i||Math.abs(n-a[i-1]!)>1e-6);}finally{for(const state of states)state.material.side=state.side;}
}
function supported(origin:Vector3,normal:Vector3,hardware:Mesh[],wood:Mesh[],maximumGap=.001){const part=distances(origin,normal,hardware),support=distances(origin,normal,wood);assert.ok(part.length>=2);assert.ok(support.length);const gap=support[0]!-part[1]!;assert.ok(gap<=maximumGap,'unsupported surface gap '+gap);assert.ok(gap>=-.012,'hardware buried beyond a fitted seating '+gap);}
function posed(build:SemanticAssetBuild,point:Vector3,normal:Vector3){const pivot=build.semantics.joints[0]!,group=build.root.getObjectByName(pivot.node)!;return {point:group.localToWorld(point.sub(new Vector3(...pivot.pivot))),normal:normal.transformDirection(group.matrixWorld)};}

for(const input of [{},{width:.7,depth:.45,bodyHeight:.35,lidRise:.4,boardCount:6,bandInset:.3},{width:1.8,depth:1,bodyHeight:.8,lidRise:.15,boardCount:2,bandInset:.15}])test('chest cover hardware is supported and rotates as one assembly '+JSON.stringify(input),()=>{
 const b=buildAsset('treasure-chest',input);try{
  const p=b.config.applied,w=Number(p.width),d=Number(p.depth),h=Number(p.bodyHeight),rise=Number(p.lidRise),inset=Number(p.bandInset),body=mesh(b,'base').matrixWorld.toArray();
  const cover=meshes(b,n=>n==='lid'||n.startsWith('lid-')),woodCover=cover.filter(o=>o.userData.materialRole==='wood'),bodyRear=meshes(b,n=>n.startsWith('body-plank--1-')),bodyFront=meshes(b,n=>n.startsWith('body-plank-1-'));
  for(const sign of [-1,1]){assert.ok(mesh(b,'lid-cheek-'+sign));assert.ok(mesh(b,'lid-hinge-collar-'+sign));supported(new Vector3(sign*(w/2-w*inset),h-.026,-d/2-.1),new Vector3(0,0,-1),[mesh(b,'hinge-'+sign)],bodyRear);}
  for(const angle of [0,85,110]){setJointPose(b.root,'lid-pivot',angle);const sem=readSemantics(b.root);
   for(const object of cover)assert.equal(sem.parts.find(part=>part.node===object.name)!.group,'lid-pivot');
   for(const sign of [-1,1])for(let i=0;i<6;i++)for(const fraction of [.25,.75]){
    const q0=-d/2+d*i/6,q1=-d/2+d*(i+1)/6,y0=h+.012+rise*Math.sin(Math.PI*i/6),y1=h+.012+rise*Math.sin(Math.PI*(i+1)/6),slope=(y1-y0)/(q1-q0),normal=new Vector3(0,1,slope).normalize(),point=new Vector3(sign*(w/2-w*inset),y0+(y1-y0)*fraction,-q0-(q1-q0)*fraction),sample=posed(b,point,normal);
    supported(sample.point.clone().addScaledVector(sample.normal,.1),sample.normal,[mesh(b,'band-lid-'+sign+'-'+i)],woodCover);
   }
   const hasp=posed(b,new Vector3(0,h+.01,d/2),new Vector3(0,0,1));supported(hasp.point.clone().addScaledVector(hasp.normal,.1),hasp.normal,[mesh(b,'latch')],[mesh(b,'lid-front-rail')]);
   const key=posed(b,new Vector3(0,h-.068,d/2+.02),new Vector3(0,0,1));supported(key.point.clone().addScaledVector(key.normal,.1),key.normal,[mesh(b,'keyhole')],[mesh(b,'latch')]);
   for(const sign of [-1,1]){
    const x=sign*(w/2-w*inset),collar=mesh(b,'lid-hinge-collar-'+sign),barrel=mesh(b,'hinge-barrel-'+sign);assert.ok(collar.getWorldPosition(new Vector3()).distanceTo(barrel.getWorldPosition(new Vector3()))<1e-9);supported(new Vector3(x,h+.1,-d/2),new Vector3(0,1,0),[collar],[barrel],.002);
    const surface=posed(b,new Vector3(sign*(w/2-.016),h+.012+rise*(Math.sin(Math.PI*2/6)+Math.sin(Math.PI*3/6))/2-.008,-(-d/2+d*2.5/6)),new Vector3(sign,0,0));supported(surface.point.clone().addScaledVector(surface.normal,.1),surface.normal,[mesh(b,'lid-cheek-'+sign)],[mesh(b,'lid')]);
   }
   for(const name of ['latch','keyhole',...meshes(b,n=>n.startsWith('band-lid-')).map(m=>m.name)])assert.equal(sem.parts.find(part=>part.node===name)!.group,'lid-pivot');
   assert.deepEqual(mesh(b,'base').matrixWorld.toArray(),body);assert.deepEqual(inspectGeometry(b.root).errors,[]);
  }
  setJointPose(b.root,'lid-pivot',0);supported(new Vector3(0,h-.075,d/2+.15),new Vector3(0,0,1),[mesh(b,'latch-receiver')],bodyFront);
  setJointPose(b.root,'lid-pivot',110);const hits=new Raycaster(new Vector3(0,h+2,0),new Vector3(0,-1,0)).intersectObject(b.root,true);assert.equal(hits[0]!.object.name,'base');
 }finally{disposeAsset(b);}
});
for(const input of [{},{width:1.3,height:.4,depth:.8,frameWeight:'light'},{width:.45,height:.35,depth:.4,frameWeight:'stout'},{width:.75,height:1.2,depth:.75,lid:'closed'}])test('crate pegs seat against real rim surfaces '+JSON.stringify(input),()=>{
 const b=buildAsset('crate',input);try{
  const timber=meshes(b,n=>n.startsWith('face-rim-')||n.startsWith('corner-'));
  for(const peg of meshes(b,n=>n.startsWith('joint-peg-'))){const face=peg.name.startsWith('joint-peg--1-')?-1:1,center=peg.getWorldPosition(new Vector3()),normal=new Vector3(0,0,face);supported(center.clone().addScaledVector(normal,.1),normal,[peg],timber,.0005);}
  assert.deepEqual(inspectGeometry(b.root).errors,[]);
 }finally{disposeAsset(b);}
});
test('existing empty interiors and invalid input behavior remain explicit',()=>{
 const b=buildAsset('treasure-chest',{latch:false,lidAngle:110});try{assert.equal(b.root.getObjectByName('latch'),undefined);assert.equal(b.root.getObjectByName('latch-receiver'),undefined);assert.equal(b.semantics.joints[0]!.limits[1],110);}finally{disposeAsset(b);}
 for(const input of [{lidAngle:111},{boardCount:2.5},{bandInset:.4},{width:.6},{unknown:true}])assert.throws(()=>buildAsset('treasure-chest',input));
 for(const input of [{height:1.2,width:.45,depth:.4},{slatGap:.06},{unknown:true}])assert.throws(()=>buildAsset('crate',input));
});

test('surface checks reject a detached chest cheek and crate peg',()=>{
 const chest=buildAsset('treasure-chest');try{
  const p=chest.config.applied,w=Number(p.width),h=Number(p.bodyHeight),rise=Number(p.lidRise),d=Number(p.depth),cheek=mesh(chest,'lid-cheek-1');cheek.position.x+=.02;chest.root.updateMatrixWorld(true);
  const origin=new Vector3(w/2+.1,h+.012+rise*(Math.sin(Math.PI*2/6)+1)/2-.008,d/12);assert.throws(()=>supported(origin,new Vector3(1,0,0),[cheek],[mesh(chest,'lid')]));
 }finally{disposeAsset(chest);}
 const crate=buildAsset('crate');try{const peg=mesh(crate,'joint-peg-1-1-true');peg.position.z+=.02;crate.root.updateMatrixWorld(true);const center=peg.getWorldPosition(new Vector3());assert.throws(()=>supported(center.add(new Vector3(0,0,.1)),new Vector3(0,0,1),[peg],meshes(crate,n=>n.startsWith('face-rim-')||n.startsWith('corner-'))));}finally{disposeAsset(crate);}
});

function chestPartPayloads(build:SemanticAssetBuild){
 const parts=new Map<string,string>();build.root.updateMatrixWorld(true);
 build.root.traverse(object=>{if(!(object instanceof Mesh))return;const vertices:number[][]=[],position=object.geometry.getAttribute('position');for(let i=0;i<position.count;i++)vertices.push(new Vector3().fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld).toArray().map(n=>Math.round(n*1e9)/1e9));parts.set(object.name,JSON.stringify({vertices,index:object.geometry.index?Array.from(object.geometry.index.array):null}));});return parts;
}
function assertChestTargetCoverage(changed:string[],targets:string[]){for(const name of changed)assert.ok(targets.some(target=>name===target||name.startsWith(target+'-')),name+' missing from '+targets.join(','));}
test('chest target metadata covers changed parts and survives export',async()=>{
 const {exportAsset}=await import('../src/catalog/export.ts');const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 for(const context of [{},{lidAngle:110},{latch:false}])for(const [key,value] of Object.entries({width:1.8,depth:1,bodyHeight:.8,lidRise:.4,bandInset:.3,boardCount:6,lidAngle:85,latch:false})){
  const before=buildAsset('treasure-chest',context),after=buildAsset('treasure-chest',{...context,[key]:value});try{
   const a=chestPartPayloads(before),b=chestPartPayloads(after),changed=[...new Set([...a.keys(),...b.keys()])].filter(name=>a.get(name)!==b.get(name)),control=after.semantics.controls.find(c=>c.key===key)!;
   assertChestTargetCoverage(changed,control.targets);
   for(const target of control.targets)assert.ok(changed.some(name=>name===target||name.startsWith(target+'-'))||changed.length===0||![...a.keys(),...b.keys()].some(name=>name===target||name.startsWith(target+'-')),key+' redundant target '+target);
   if(key==='latch'&&context.latch!==false)assert.throws(()=>assertChestTargetCoverage(changed,['latch']));
   if(key==='bandInset')assert.throws(()=>assertChestTargetCoverage(changed,control.targets.filter(t=>t!=='lid-hinge-collar')));
  }finally{disposeAsset(before);disposeAsset(after);}
 }
 const build=buildAsset('treasure-chest',{lidAngle:110});try{
  const bytes=await exportAsset(build),loaded=await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer,''),root=loaded.scene.getObjectByName('treasure-chest')!,metadata=readSemantics(root);
  assert.deepEqual(metadata.controls,build.semantics.controls);for(const name of ['body-rim-front-1','body-rim-side-1','lid-hinge-collar-1'])assert.ok(metadata.parts.some(p=>p.node===name));
 }finally{disposeAsset(build);}
});

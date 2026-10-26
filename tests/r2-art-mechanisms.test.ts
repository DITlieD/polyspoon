import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3,Mesh,Raycaster,Vector3 } from 'three';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';
import { readSemantics,setJointPose } from '../src/catalog/semantics.ts';
import type { SemanticAssetBuild } from '../src/catalog/types.ts';

function bounds(build:SemanticAssetBuild,name:string){const object=build.root.getObjectByName(name);assert.ok(object,name);return new Box3().setFromObject(object,true);}
function collection(build:SemanticAssetBuild,predicate:(name:string)=>boolean){const box=new Box3();build.root.traverse(object=>{if(object instanceof Mesh&&predicate(object.name))box.union(new Box3().setFromObject(object,true));});assert.ok(!box.isEmpty());return box;}
function arcSpan(mesh:Mesh){const p=mesh.geometry.getAttribute('position'),angles=[];for(let i=0;i<p.count;i++)angles.push((Math.atan2(p.getZ(i),p.getX(i))+2*Math.PI)%(2*Math.PI));angles.sort((a,b)=>a-b);let gap=angles[0]!+2*Math.PI-angles.at(-1)!;for(let i=1;i<angles.length;i++)gap=Math.max(gap,angles[i]!-angles[i-1]!);return 2*Math.PI-gap;}

for(const input of [{},{trayWidth:0.5,trayLength:0.65,trayDepth:0.2,wheelRadius:0.16,boardCount:2,wheelStyle:'spoked'},{trayWidth:0.95,trayLength:1.3,trayDepth:0.45,wheelRadius:0.34,boardCount:5}])test('wheelbarrow authored tray and support relationships '+JSON.stringify(input),()=>{
 const b=buildAsset('wheelbarrow',input);try{
  const p=b.config.applied,w=Number(p.trayWidth),l=Number(p.trayLength),h=Number(p.trayDepth),r=Number(p.wheelRadius),count=Number(p.boardCount);
  const tray=collection(b,name=>name.startsWith('tray-side-')||name.startsWith('tray-end-')||name.startsWith('rim-')),size=tray.getSize(new Vector3());
  assert.ok(Math.abs(size.x-w)<1e-6);assert.ok(Math.abs(size.z-l)<1e-6);assert.ok(Math.abs(tray.max.y-b.anchors.tray![1]!-h)<1e-6);
  assert.ok(bounds(b,'tray-side-1-0').max.x<bounds(b,'tray-side-1-'+(count-1)).max.x-w*0.06,'side boards must flare');
  assert.ok(bounds(b,'tray-end-1-0').max.z<bounds(b,'tray-end-1-'+(count-1)).max.z-l*0.05,'front must have an inclined lower profile');
  const floor=collection(b,name=>name.startsWith('floor-')).getSize(new Vector3());assert.ok(floor.x<w*0.8);assert.ok(floor.z<l*0.8);assert.ok(floor.y>=0.04);
  for(const end of [-1,1]){const bearer=bounds(b,'under-tray-bearer-'+end);assert.ok(bearer.max.y>=b.anchors.tray![1]!-0.052);assert.ok(bearer.min.x<0&&bearer.max.x>0);for(const side of [-1,1])assert.ok(bounds(b,'tray-riser-'+side+'-'+end).intersectsBox(bearer));}
  assert.ok(bounds(b,'wheel-hub').getSize(new Vector3()).y<r);assert.ok(Math.abs(bounds(b,'wheel-tread').getSize(new Vector3()).y-2*r)<1e-6);
  const metadata=readSemantics(b.root);assert.equal(metadata.joints[0]!.id,'wheel-axle');assert.deepEqual(metadata.joints[0]!.pivot,b.anchors.axle);const fixed=b.root.getObjectByName('axle')!.matrixWorld.toArray();setJointPose(b.root,'wheel-axle',55);assert.deepEqual(b.root.getObjectByName('axle')!.matrixWorld.toArray(),fixed);
  assert.deepEqual(inspectGeometry(b.root).errors,[]);
 }finally{disposeAsset(b);}
});
for(const input of [{},{diameter:1.8,wallHeight:0.65,roofSize:1.15},{diameter:3.2,wallHeight:1.4,roofSize:1.6}])test('well authored masonry and roof relationships '+JSON.stringify(input),()=>{
 const b=buildAsset('stone-well',input);try{
  const p=b.config.applied,width=Number(p.diameter)*Number(p.roofSize),row0=bounds(b,'stone-0-0'),row1=bounds(b,'stone-1-0');assert.ok(Math.abs(row0.getSize(new Vector3()).y-row1.getSize(new Vector3()).y)>0.008,'masonry rows need a designed height rhythm');
  assert.ok(Math.abs(arcSpan(b.root.getObjectByName('stone-0-0') as Mesh)-arcSpan(b.root.getObjectByName('stone-0-1') as Mesh))>0.015,'blocks need a deliberate width rhythm');
  assert.ok(bounds(b,'coping-0').max.y>=Number(p.wallHeight)-1e-6);const roof=collection(b,name=>name.startsWith('roof-board-'));assert.ok(Math.abs(roof.getSize(new Vector3()).x-width)<1e-6);
  const sections:Mesh[]=[];b.root.traverse(object=>{if(object instanceof Mesh&&object.name.startsWith('roof-board-'))sections.push(object);});assert.ok(sections.length<=64);for(const section of sections){const size=new Box3().setFromObject(section,true).getSize(new Vector3());assert.ok(size.x>=0.28&&size.x<=0.65,'wood cover pieces must have a believable cross-roof scale');}
  const crossing=sections.filter(mesh=>mesh.name.startsWith('roof-board-1-')).map(mesh=>new Box3().setFromObject(mesh,true)).filter(box=>box.min.x<width*0.11&&box.max.x>width*0.11).sort((a,b)=>b.getCenter(new Vector3()).z-a.getCenter(new Vector3()).z);assert.equal(crossing.length,2);const lower=crossing[0]!,upper=crossing[1]!;assert.ok(Math.min(lower.max.z,upper.max.z)-Math.max(lower.min.z,upper.min.z)>0.02);
  for(const side of [-1,1])assert.ok(bounds(b,'post-'+side).intersectsBox(bounds(b,'ridge')));
  assert.equal(readSemantics(b.root).joints[0]!.id,'windlass-pivot');const support=b.root.getObjectByName('post--1')!.matrixWorld.toArray();setJointPose(b.root,'windlass-pivot',65);assert.deepEqual(b.root.getObjectByName('post--1')!.matrixWorld.toArray(),support);assert.deepEqual(inspectGeometry(b.root).errors,[]);
 }finally{disposeAsset(b);}
});
test('open shaft toggles and construction failures remain explicit',()=>{
 const b=buildAsset('stone-well',{roof:false,bucket:false,windlass:false});try{
  const ray=new Raycaster(new Vector3(0,2,0),new Vector3(0,-1,0));assert.equal(ray.intersectObject(b.root,true).length,0);assert.equal(readSemantics(b.root).joints.length,0);assert.equal(b.root.getObjectByName('ridge'),undefined);assert.equal(b.root.getObjectByName('bucket-shell'),undefined);assert.deepEqual(inspectGeometry(b.root).errors,[]);
 }finally{disposeAsset(b);}
 for(const input of [{bucket:true,windlass:false},{diameter:1.7},{wallHeight:NaN},{unknown:true}])assert.throws(()=>buildAsset('stone-well',input));
 for(const input of [{trayWidth:0.49},{boardCount:2.5},{wheelStyle:'unknown'},{unknown:true}])assert.throws(()=>buildAsset('wheelbarrow',input));
});

test('well stones have broad shaped edges and visibly uneven course boundaries',()=>{
 const b=buildAsset('stone-well');try{
  const row:Mesh[]=[];b.root.traverse(o=>{if(o instanceof Mesh&&/^stone-0-[0-9]+$/.test(o.name))row.push(o);});
  const tops=row.map(mesh=>new Box3().setFromObject(mesh,true).max.y);assert.ok(Math.max(...tops)-Math.min(...tops)>0.018);
  const stone=row[0]!,positions=stone.geometry.getAttribute('position'),points=Array.from({length:positions.count},(_,i)=>new Vector3().fromBufferAttribute(positions,i).applyMatrix4(stone.matrixWorld)),minimum=Math.min(...points.map(p=>p.y));
  const baseRadius=Math.max(...points.filter(p=>Math.abs(p.y-minimum)<1e-6).map(p=>Math.hypot(p.x,p.z))),maximum=Math.max(...points.map(p=>Math.hypot(p.x,p.z)));assert.ok(maximum-baseRadius>0.02,'stone edge profile must shape the broad block rather than add tiny chips');
  const coping=collection(b,n=>n.startsWith('coping-')).getSize(new Vector3());assert.ok(Math.abs(coping.x-Number(b.config.applied.diameter))<0.006);
 }finally{disposeAsset(b);}
});

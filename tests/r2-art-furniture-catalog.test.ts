import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,Raycaster,Vector3} from 'three';
import type {Object3D} from 'three';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {inspectGeometry,geometrySnapshot} from '../src/lantern/inspect.ts';

const box=(o:Object3D)=>new Box3().setFromObject(o,true);
const named=(root:Object3D,name:string)=>{const o=root.getObjectByName(name);assert.ok(o,name+' missing');return o;};
const parts=(root:Object3D,prefix:string)=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith(prefix))out.push(o);});return out;};
const interval=(o:Object3D,axis:'x'|'y'|'z',point:Vector3)=>{
 const positive=new Vector3();positive[axis]=1;
 const low=point.clone(),high=point.clone();low[axis]=-10;high[axis]=10;
 const a=new Raycaster(low,positive).intersectObject(o,true)[0]?.point[axis];
 const b=new Raycaster(high,positive.clone().negate()).intersectObject(o,true)[0]?.point[axis];
 assert.ok(a!==undefined&&b!==undefined,'contact surface missing: '+o.name);
 return [a,b] as const;
};
const contact=(a:Object3D,b:Object3D,axis:'x'|'y'|'z',point:Vector3)=>{
 const ia=interval(a,axis,point),ib=interval(b,axis,point);
 assert.ok(Math.min(ia[1],ib[1])-Math.max(ia[0],ib[0])>=-2e-6,'detached contact: '+a.name+' / '+b.name);
};
const benchCases=[{}, {width:.9,depth:.32,seatHeight:.35,slatCount:6,backHeight:.55}, {width:2.4,depth:.65,seatHeight:.55,slatCount:3,backHeight:.25}, {width:2.2,depth:.55,slatCount:5,backHeight:.48,colorway:'painted'}];
const benchContact=(root:Object3D)=>{
 root.updateMatrixWorld(true);
 for(const side of [-1,1]){
  const support=named(root,'seat-support-'+side),x=box(support).getCenter(new Vector3()).x;
  for(const slat of parts(root,'seat-slat-'))contact(slat,support,'y',new Vector3(x,0,box(slat).getCenter(new Vector3()).z));
  for(const end of [-1,1]){
   const leg=named(root,'leg-'+side+'-'+end),top=box(leg).max.y-.01,z=interval(leg,'z',new Vector3(x,top,0));
   contact(leg,support,'y',new Vector3(x,0,(z[0]+z[1])/2));
   contact(leg,named(root,'apron-'+end),'x',new Vector3(0,top-.025,(z[0]+z[1])/2));
  }
  if(root.getObjectByName('back-post-'+side)){
   const post=named(root,'back-post-'+side),leg=named(root,'leg-'+side+'--1');
   contact(post,leg,'z',new Vector3(x,box(post).min.y+.02,0));
   for(const board of parts(root,'back-slat-'))for(const f of [.2,.5,.8])contact(post,board,'z',new Vector3(x,box(board).min.y+box(board).getSize(new Vector3()).y*f,0));
  }
 }
};

test('bench shaped frame and inclined back retain supported joints through combined limits',()=>{
 for(const input of benchCases)for(const backrest of [false,true]){
  const b=buildAsset('bench',{...input,backrest});
  try{
   benchContact(b.root);
   const p=b.config.applied,w=Number(p.width),d=Number(p.depth),h=Number(p.seatHeight);
   assert.deepEqual(b.anchors.seat,[0,h,0]);assert.ok(Math.abs(b.bounds.min.y)<1e-6);
   assert.equal(parts(b.root,'seat-slat-').length,Number(p.slatCount));
   for(const slat of parts(b.root,'seat-slat-')){const s=box(slat);assert.ok(Math.abs(s.max.y-h)<1e-6);assert.ok(Math.abs(s.getSize(new Vector3()).x-w)<1e-6);}
   const slats=parts(b.root,'seat-slat-');assert.ok(Math.abs(box(slats.at(-1)!).max.z-box(slats[0]!).min.z-d)<1e-6);
   for(let i=1;i<slats.length;i++)assert.ok(Math.abs(box(slats[i]!).min.z-box(slats[i-1]!).max.z-.012)<1e-6);
   const leg=named(b.root,'leg-1-1'),lower=interval(leg,'x',new Vector3(0,.01,box(leg).getCenter(new Vector3()).z)),upper=interval(leg,'x',new Vector3(0,h-.07,box(leg).getCenter(new Vector3()).z));
   assert.ok(upper[1]-upper[0]>lower[1]-lower[0]+.012,'leg lacks a shaped supporting shoulder');
   assert.equal(parts(b.root,'back-post-').length,backrest?2:0);
   if(backrest){const post=named(b.root,'back-post-1'),x=box(post).getCenter(new Vector3()).x,low=interval(post,'z',new Vector3(x,h,0)),high=interval(post,'z',new Vector3(x,h+Number(p.backHeight)-.01,0));assert.ok(high[0]<low[0]-.015,'back has no rearward rake');assert.ok(Math.abs(b.bounds.max.y-h-Number(p.backHeight))<1e-6);}
   assert.deepEqual(inspectGeometry(b.root).errors,[]);
  }finally{disposeAsset(b);}
 }
 const b=buildAsset('bench');try{named(b.root,'back-slat-0').position.z+=.12;assert.throws(()=>benchContact(b.root),/detached contact/);}finally{disposeAsset(b);}
});

const planterCases=[{}, {width:.6,depth:.3,height:.25,boardCount:5}, {width:1.8,depth:.8,height:.85,boardCount:2}, {width:1.5,depth:.4,height:.3,boardCount:2}, {width:.7,depth:.7,height:.8,boardCount:5,colorway:'painted'}];
const planterContact=(root:Object3D)=>{
 root.updateMatrixWorld(true);
 const floor=named(root,'floor');
 for(const side of ['front','rear','left','right']){
  const walls=parts(root,'wall-'+side+'-'),rim=named(root,'rim-'+side),long=side==='front'||side==='rear',axis=long?'z':'x';
  const top=walls.at(-1)!,y=box(top).max.y-.001,section=interval(top,axis,new Vector3(0,y,0));
  const point=new Vector3();point[axis]=(section[0]+section[1])/2;
  contact(top,rim,'y',point);
  const low=walls[0]!,bottom=box(low).min.y,span=interval(low,axis,new Vector3(0,bottom+.001,0));point[axis]=(span[0]+span[1])/2;
  contact(low,floor,'y',point);
  for(const wall of walls)for(const end of [-1,1]){
   const wb=box(wall),wy=wb.getCenter(new Vector3()).y,post=named(root,'post-'+(long?end:side==='right'?1:-1)+'-'+(long?side==='front'?1:-1:end));
   const transverse=interval(wall,axis,new Vector3(0,wy,0)),q=new Vector3(0,wy,0);q[axis]=(transverse[0]+transverse[1])/2;
   contact(wall,post,long?'x':'z',q);
  }
 }
 for(const post of parts(root,'post-')){
  const pb=box(post),y=pb.max.y-.001,x=interval(post,'x',new Vector3(0,y,pb.getCenter(new Vector3()).z)),px=(x[0]+x[1])/2,z=interval(post,'z',new Vector3(px,y,0));
  contact(post,named(root,pb.getCenter(new Vector3()).z>0?'rim-front':'rim-rear'),'y',new Vector3(px,0,(z[0]+z[1])/2));
 }
 for(const side of ['left','right'])for(const end of ['front','rear']){
  const rim=named(root,'rim-'+side),rb=box(rim);
  contact(rim,named(root,'rim-'+end),'z',new Vector3(rb.getCenter(new Vector3()).x,rb.getCenter(new Vector3()).y,0));
 }
 for(const foot of parts(root,'foot-')){
  const p=box(foot).getCenter(new Vector3());contact(foot,named(root,foot.name.replace('foot-','post-')),'y',p);contact(foot,floor,'y',p);
 }
};

test('planter fitted rim, tapered walls and floor preserve courses, empty opening and feet',()=>{
 for(const input of planterCases)for(const feet of [false,true]){
  const b=buildAsset('planter',{...input,feet});
  try{
   planterContact(b.root);
   const p=b.config.applied,w=Number(p.width),d=Number(p.depth),h=Number(p.height);
   for(const [axis,value] of [['x',w],['y',h],['z',d]] as const)assert.ok(Math.abs(b.dimensions[axis]-value)<1e-6,'outside '+axis);
   assert.deepEqual(b.anchors.opening,[0,h,0]);assert.ok(Math.abs(b.bounds.min.y)<1e-6);
   assert.equal(parts(b.root,'wall-').length,Number(p.boardCount)*4);assert.equal(parts(b.root,'foot-').length,feet?4:0);assert.equal(parts(b.root,'rim-').length,4);
   for(const side of ['front','rear','left','right']){const walls=parts(b.root,'wall-'+side+'-');for(let i=1;i<walls.length;i++)assert.ok(Math.abs(box(walls[i]!).min.y-box(walls[i-1]!).max.y-.006)<1e-6);}
   const hit=new Raycaster(new Vector3(0,h+1,0),new Vector3(0,-1,0)).intersectObject(b.root,true)[0];assert.equal(hit?.object.name,'floor');
   const lower=box(named(b.root,'wall-front-0')),upper=box(named(b.root,'wall-front-'+(Number(p.boardCount)-1)));assert.ok(upper.max.z>lower.max.z+.004,'body has no tapered wall profile');
   assert.deepEqual(inspectGeometry(b.root).errors,[]);
  }finally{disposeAsset(b);}
 }
 const b=buildAsset('planter');try{named(b.root,'rim-front').position.y+=.08;assert.throws(()=>planterContact(b.root),/detached contact/);}finally{disposeAsset(b);}
});

const fenceContact=(root:Object3D)=>{
 root.updateMatrixWorld(true);
 for(const rail of parts(root,'rail-')){
  const [,bay]=rail.name.split('-'),rb=box(rail),y=rb.getCenter(new Vector3()).y;
  for(const i of [Number(bay),Number(bay)+1])contact(rail,named(root,'post-'+i),'x',new Vector3(0,y,0));
 }
 for(const picket of parts(root,'picket-')){
  const [,bay]=picket.name.split('-'),x=box(picket).getCenter(new Vector3()).x;
  for(const rail of parts(root,'rail-'+bay+'-'))contact(picket,rail,'z',new Vector3(x,box(rail).getCenter(new Vector3()).y,0));
 }
 for(const brace of parts(root,'brace-')){
  const bay=Number(brace.name.split('-')[1]);
  for(const post of [named(root,'post-'+bay),named(root,'post-'+(bay+1))]){
   const x=box(post).getCenter(new Vector3()).x+(post.name==='post-'+bay?1:-1)*.04,z=box(brace).getCenter(new Vector3()).z,ys=interval(brace,'y',new Vector3(x,0,z));
   contact(brace,post,'z',new Vector3(x,(ys[0]+ys[1])/2,0));
  }
 }
};

test('fence retains seated rail, brace and picket connections across valid span and section limits',()=>{
 for(const input of [{length:1.2,bays:2,height:1.5},{length:6,bays:3,height:.7},{length:2.4,bays:4,height:1.1}])for(const memberWeight of ['light','stout'])for(const postHead of ['flat','chamfered','peaked'])for(const railCount of [2,4])for(const weathering of [0,1]){
  const b=buildAsset('fence',{...input,memberWeight,postHead,railCount,weathering,infill:'pickets',railStyle:'cross-braced',picketSpacing:.1,detail:'inspection'});
  try{fenceContact(b.root);assert.deepEqual(b.anchors.start,[-input.length/2,0,0]);assert.deepEqual(b.anchors.end,[input.length/2,0,0]);assert.deepEqual(inspectGeometry(b.root).errors,[]);}finally{disposeAsset(b);}
 }
 const b=buildAsset('fence');try{named(b.root,'rail-0-0').position.z+=.3;assert.throws(()=>fenceContact(b.root),/contact surface missing|detached contact/);}finally{disposeAsset(b);}
});

test('furniture preserves color-independent geometry and rejects invalid control relationships',()=>{
 for(const family of ['bench','planter','fence']){
  const a=buildAsset(family),b=buildAsset(family,family==='fence'?{'color.wood':'#a75f49','color.timber':'#384a42'}:{'color.wood':'#a75f49','color.frame':'#384a42'});
  try{assert.deepEqual(geometrySnapshot(a.root),geometrySnapshot(b.root));}finally{disposeAsset(a);disposeAsset(b);}
 }
 assert.throws(()=>buildAsset('bench',{slatCount:7}));assert.throws(()=>buildAsset('planter',{height:.1}));assert.throws(()=>buildAsset('fence',{length:6,bays:1}),/Post-center length/);
});

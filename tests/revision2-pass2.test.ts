import test from 'node:test';

test('roof course lips sit over the following course rather than floating',()=>{
 for(const roofCharacter of [0,1]) {
  const b=buildAsset('cottage',{roofCharacter});
  try {
   const upperCourses=b.root.children.filter(o=>/^roof-right-course-[0-9]+-[0-9]+$/.test(o.name));
   assert.ok(upperCourses.length>1);let contacts=0;
   for(const upperObject of upperCourses){
    const match=/^roof-right-course-([0-9]+)-([0-9]+)$/.exec(upperObject.name)!;
    const lowerObject=b.root.getObjectByName('roof-right-course-'+(Number(match[1])+1)+'-'+match[2]);
    if(!lowerObject)continue;
    const upper=upperObject as Mesh,lower=lowerObject as Mesh;
    const region=bounds(upper).intersect(bounds(lower));assert.ok(!region.isEmpty());
    const point=region.getCenter(new Vector3());
    const underside=new Raycaster(new Vector3(point.x,0,point.z),new Vector3(0,1,0)).intersectObject(upper)[0];
    const surface=new Raycaster(new Vector3(point.x,10,point.z),new Vector3(0,-1,0)).intersectObject(lower)[0];
    const upperTop=new Raycaster(new Vector3(point.x,10,point.z),new Vector3(0,-1,0)).intersectObject(upper)[0];
    const lowerBottom=new Raycaster(new Vector3(point.x,0,point.z),new Vector3(0,1,0)).intersectObject(lower)[0];
    assert.ok(underside&&surface&&upperTop&&lowerBottom);
    const ub=underside.point.y,ut=upperTop.point.y,lb=lowerBottom.point.y,lt=surface.point.y;
    const penetration=lt-ub,limit=Math.min(ut-ub,lt-lb);
    assert.ok(penetration>=-1e-6,'floating course');assert.ok(penetration<=limit+1e-6,'layer swallowed');
    assert.ok(ut>=lt-1e-6&&ub>=lb-1e-6,'course order inverted');contacts++;
   }
   assert.ok(contacts>0);
  }finally{disposeAsset(b);}
 }
});

import assert from 'node:assert/strict';
import {Box3,Mesh,Raycaster,Vector3} from 'three';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
const mesh=(root:import('three').Group,name:string)=>{const result=root.getObjectByName(name);assert.ok(result instanceof Mesh,name);return result;};
const bounds=(m:Mesh)=>new Box3().setFromObject(m,true);
function contains(m:Mesh,point:Vector3) {
 const p=m.worldToLocal(point.clone()),g=m.geometry,v=g.getAttribute('position'),index=g.index,n=index?.count??v.count;
 for(let i=0;i<n;i+=3) {
  const a=new Vector3().fromBufferAttribute(v,index?index.getX(i):i),b=new Vector3().fromBufferAttribute(v,index?index.getX(i+1):i+1),c=new Vector3().fromBufferAttribute(v,index?index.getX(i+2):i+2);
  const normal=b.sub(a).cross(c.sub(a)).normalize();if(normal.dot(p.clone().sub(a))>1e-7)return false;
 }
 return true;
}
function genuineContact(a:Mesh,b:Mesh) {
 const overlap=bounds(a).intersect(bounds(b));if(overlap.isEmpty())return false;
 for(const x of [0.1,0.5,0.9])for(const y of [0.1,0.5,0.9])for(const z of [0.1,0.5,0.9]) {
  const p=new Vector3(overlap.min.x+(overlap.max.x-overlap.min.x)*x,overlap.min.y+(overlap.max.y-overlap.min.y)*y,overlap.min.z+(overlap.max.z-overlap.min.z)*z);
  if(contains(a,p)&&contains(b,p))return true;
 }return false;
}
test('gable braces meet upright and eave members across supported profiles',()=>{
 for(const width of [3.6,5,7.2])for(const roofCharacter of [0,1]) {
  const b=buildAsset('cottage',{width,roofRise:1.4,roofCharacter});
  try {for(const z of [-1,1])for(const side of [-1,1]) {
   const brace=mesh(b.root,'gable-brace-'+z+'-'+side);
   assert.ok(genuineContact(brace,mesh(b.root,'gable-upright-'+z)),'brace must meet upright');
   assert.ok(genuineContact(brace,mesh(b.root,'eave-beam-'+z)),'brace must meet eave beam');
  }}finally{disposeAsset(b);}
 }
});
test('roof profile is visible and walls remain seated below the roof through limits',()=>{
 const heights:number[]=[];
 for(const width of [3.6,7.2])for(const depth of [3,5.5])for(const roofCharacter of [0,1]) {
  const b=buildAsset('cottage',{width,depth,roofRise:1.4,roofCharacter,eaveOverhang:0.55});
  try {
   const roof=b.root.children.filter(o=>o.name.startsWith('roof-')&&o instanceof Mesh);
   for(const z of [-depth/2,0,depth/2])for(const x of [-width/2,width/2]) {
    const high=new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0)).intersectObjects(roof)[0];
    const low=new Raycaster(new Vector3(x,0,z),new Vector3(0,1,0)).intersectObjects(roof)[0];
    assert.ok(high&&low);
    assert.ok(high.point.y>2.8,'wall protrudes above roof');
    assert.ok(low.point.y<=2.8+0.01,'gap above side-wall top');
   }
   if(width===3.6&&depth===3)heights.push(b.anchors.ridge![1]!);
  }finally{disposeAsset(b);}
 }
 assert.ok(heights[0]!-heights[1]!>0.25,'profile endpoints need visible depth change');
});
test('lantern switch clears plate and guards join retaining frames at both ends',()=>{
 for(const frameWeight of ['light','heavy'])for(const bodyWidth of [0.22,0.44]) {
  const b=buildAsset('work-lantern',{frameWeight,bodyWidth,bodyHeight:0.18,handleClearance:0.075,guardLayout:'crossbar'});
  try {
   const plate=bounds(mesh(b.root,'switch-plate')),button=bounds(mesh(b.root,'switch'));
   assert.ok(button.min.z>=plate.max.z-1e-7,'switch must sit on plate outward face');
   assert.ok(button.max.z>plate.max.z+0.002,'switch requires exposed depth');
   const uprights=b.root.children.filter(o=>o.name.startsWith('guard-upright-'));
   assert.equal(uprights.length,b.config.applied.guardCount);
   for(const object of uprights){
    assert.ok(object instanceof Mesh);
    const vertices=object.geometry.getAttribute('position');
    for(const name of ['lower-frame','upper-frame']){
     const frame=mesh(b.root,name);
     assert.ok(Array.from({length:vertices.count},(_,i):Vector3=>new Vector3().fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld)).some(p=>contains(frame,p)),object.name+' detached from '+name);
    }
   }
   for(const side of [-1,1])assert.ok(mesh(b.root,'guard-crossbar-'+side));
  }finally{disposeAsset(b);}
 }
});

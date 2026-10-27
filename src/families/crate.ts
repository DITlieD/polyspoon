import {CylinderGeometry} from 'three';
import {Assembly} from './assembly.ts';
import {profileSolid,repeatSpan} from '../engine/geometry.ts';
import type {Configuration} from './config.ts';
export function crate(config:Configuration){
 const a=new Assembly(config),p=config.applied,w=Number(p.width),h=Number(p.height),d=Number(p.depth),size=Math.min(w,h,d);
 const frame=size*(p.frameWeight==='light'?.085:.13),plank=Math.min(.045,Math.max(.022,size*.065)),gap=Number(p.slatGap),count=Number(p.plankCourses);
 // Plank outer faces must not be coplanar with the rim outer faces (z-fighting): recess planks 4 mm when they would sit flush.
 // Keep every plank face at least 5 mm from the rim (outer/inner), corner-post inner and crossing plank-end planes, which it would otherwise z-fight at some sizes.
 let pz=plank*.65;for(let k=0;k<16&&[[pz-plank/2,frame*.1],[pz+plank/2,frame],[pz+plank/2,frame*.9],[pz-plank/2,frame*.7],[pz+plank/2,frame*.7]].some(([u,v])=>Math.abs(u!-v!)<.005);k++)pz+=.002;
const rimDrop=p.lid==='open-top'?frame*.40:0;
 const floorTop=frame*.7+plank,wallBottom=floorTop,wallTop=h-frame*.64-rimDrop,row=(wallTop-wallBottom-gap*(count-1))/count;
 function board(name:string,from:[number,number,number],to:[number,number,number],width:number,depth:number,index:number){
  const mesh=a.beam(name,from,to,width,depth,'wood',Math.min(.005,width*.10));
  const tone=(index%3-1)*Number(p.toneVariation),key='wood-tone-'+(index%3);
  if(!a.materials[key]){const material=a.materials.wood!.clone();material.name=key;material.color.multiplyScalar(1+tone);a.materials[key]=material;}
  mesh.material=a.materials[key]!;
 }
 for(const sx of [-1,1])for(const sz of [-1,1]){
  a.mesh('corner-'+sx+'-'+sz,profileSolid([{y:0,width:frame,depth:frame,chamfer:frame*.15},{y:h-frame*.25,width:frame,depth:frame,chamfer:frame*(.15+Number(p.weathering)*.1)},{y:h-(p.lid==='closed'?.006:0),width:frame*.82,depth:frame*.82,chamfer:frame*.14}]),'timber',[sx*(w-frame)/2,0,sz*(d-frame)/2]);
 }
 for(const face of [-1,1]){
  for(let i=0;i<count;i++){
   const y=wallBottom+row/2+i*(row+gap);
   board('front-plank-'+face+'-'+i,[-w/2+frame*.7,y,face*(d/2-pz)],[w/2-frame*.7,y,face*(d/2-pz)],row,plank,i);
   board('side-plank-'+face+'-'+i,[face*(w/2-pz),y,-(d/2-pz-plank/2+.002)],[face*(w/2-pz),y,d/2-pz-plank/2+.002],plank,row,i+1); // ends sink 2 mm into the front/back planks (a 2 mm gap left them floating; the shared strip is under 1 cm²)
  }
  for(const upper of [false,true]){
   // A closed lid's planks top out at h; sink the upper rim 3 mm so their top faces are never coplanar (z-fighting).
   const y=upper?h-frame*.5-rimDrop-(p.lid==='closed'?.010:0):frame*.5; // closed: 4 mm under the corner-post tops (h-6 mm) and 1 cm under the lid planks
   a.beam('face-rim-'+face+'-'+upper,[-w/2+frame*.5,y,face*(d/2-frame*.5)],[w/2-frame*.5,y,face*(d/2-frame*.5)],frame,frame*.8,'timber',frame*.1);
   a.beam('side-rim-'+face+'-'+upper,[face*(w/2-frame*.5),y,-d/2+frame*.5],[face*(w/2-frame*.5),y,d/2-frame*.5],frame*.8,frame-.008,'timber',frame*.1); // 4 mm inside the face rims' top/bottom where they cross
  }
  // The brace runs post to post: ends sit in the corner posts and its back face beds 2 mm into the rims (it stood 5 mm proud, ends short of the posts).
  const bz=d/2-frame*.1-.002+plank*.325;
  // Round 8: the square-cut ends must stop inside the posts' width, not run on across their faces: each end's centre sits just
  // far enough inside the post's inner edge that its outer corner meets the edge (+2 mm), so the whole end face lies over the post.
  if(p.brace==='diagonal'){const bw=frame*.73,y0=frame*.75,y1=h-frame*.75-rimDrop;let xe=w/2-frame*.5;
   for(let k=0;k<3;k++){const th=Math.atan2(y1-y0,2*xe);xe=w/2-frame+.002+bw/2*Math.sin(th);}
   a.beam('diagonal-'+face,[-xe,y0,face*bz],[xe,y1,face*bz],bw,plank*.65,'timber',.004);}
  if(p.detail==='inspection')for(const side of [-1,1])for(const upper of [false,true]){
   const peg=a.mesh('joint-peg-'+face+'-'+side+'-'+upper,new CylinderGeometry(frame*.10,frame*.10,plank*.25,6),'wood',[side*(w/2-frame),upper?h-frame*.5-rimDrop:frame*.5,face*(d/2-frame*.1+plank*.125-Math.min(.0015,plank*.04))]);peg.rotation.x=Math.PI/2;
  }
 }
 const floor=repeatSpan(w-frame*1.25,.18,Math.min(gap,.012));
 for(let i=0;i<floor.count;i++)board('floor-board-'+i,[floor.centers[i]!,floorTop-plank/2,-d/2+frame*.5+.006],[floor.centers[i]!,floorTop-plank/2,d/2-frame*.5-.006],floor.width,plank,i);
 if(p.lid==='closed'){
  const lid=repeatSpan(w-frame*1.45,.18,Math.min(gap,.01));
  for(let i=0;i<lid.count;i++)board('lid-plank-'+i,[lid.centers[i]!,h-plank/2,-d/2+frame*.55],[lid.centers[i]!,h-plank/2,d/2-frame*.55],lid.width,plank,i);
  a.anchors.stack=[0,h,0];
 }else a.anchors.interior=[0,floorTop,0];
 return a.finish();
}

// Geometry QA gate for generated catalog assets. Dependency-free; runs on the
// same ReadScene the format converters use (world space, meters, +Y up).
// Errors block an asset; warnings are recorded for the human reviewer.
import {readGlb,bounds} from './gltf-read.ts';
import type {ReadScene} from './gltf-read.ts';
import {coplanarOverlaps,floatingParts,interpenetrations,layoutDefects,type Overlap,type Interpenetration,type LayoutDefect} from './overlap.ts';

export interface CategoryBudget {triangles:number;minSize:number;maxSize:number}
/** Triangle budget and plausible largest-dimension range (meters) per catalog category. */
export const categoryBudgets:Record<string,CategoryBudget>={
 Props:{triangles:8000,minSize:0.05,maxSize:4},
 Nature:{triangles:14000,minSize:0.05,maxSize:40},
 Structures:{triangles:12000,minSize:0.3,maxSize:20},
 Buildings:{triangles:26000,minSize:1,maxSize:40},
 Characters:{triangles:20000,minSize:0.3,maxSize:4},
 Animals:{triangles:16000,minSize:0.1,maxSize:5},
 Vehicles:{triangles:16000,minSize:0.5,maxSize:20},
 'Sci-fi':{triangles:10000,minSize:0.1,maxSize:6},
};
export interface QaOptions {category:string;groundTolerance?:number;minTriangleArea?:number;openEdges?:'warn'|'error'}
export interface GeometrySignature {triangles:number;meshes:number;materials:number;dimensions:[number,number,number];volume:number;/** Top, front, side occupancy masks (32x32, bbox-normalized), hex. */silhouettes?:string[];/** Skinned template (rigged) asset: every variant shares one topology. */rigged?:boolean}
export interface QaReport {ok:boolean;errors:string[];warnings:string[];triangles:number;nonManifoldEdges:number;openEdges:number;/** Open edges after welding all meshes together: 0 means per-mesh open edges are only seams between parts (e.g. boulder stone/moss) and the assembly is watertight. */combinedOpenEdges:number;/** Same-facing coplanar faces of different parts and materials (z-fighting risk), largest first. */zFight:Overlap[];/** Parts not connected to anything grounded. */floating:string[];/** Tie members running out past the post they stop in, and same-kind pieces (caps, books) cutting into each other. */interpenetrating:Interpenetration[];/** Loose items piercing or overhanging what holds them, uneven or gapped deck boards, leaning feet short of the ground. */layout:LayoutDefect[];/** Down-facing bases stacked on the ground plane (seen only from below); informational. */groundStacked:number;degenerateTriangles:number;invertedMeshes:string[];bounds:{min:number[];max:number[]};signature:GeometrySignature}

export function geometryQa(input:Uint8Array|ReadScene,options:QaOptions):QaReport{
 const scene=input instanceof Uint8Array?readGlb(input):input,errors:string[]=[],warnings:string[]=[];
 const budget=categoryBudgets[options.category];if(!budget)errors.push('no budget for category '+options.category);
 const minArea=options.minTriangleArea??1e-9,ground=options.groundTolerance??0.005;
 let triangles=0,nonManifold=0,open=0,degenerate=0,volume=0;const inverted:string[]=[];
 const globalKey=new Map<string,number>(),globalEdges=new Map<string,number>();
 for(const m of scene.meshes){
  // Weld by quantized position: flat-shaded meshes split vertices per face, so topology must be judged on positions.
  const key=new Map<string,number>(),weld=new Uint32Array(m.positions.length/3);
  for(let v=0;v<weld.length;v++){const k=Math.round(m.positions[v*3]!*1e5)+','+Math.round(m.positions[v*3+1]!*1e5)+','+Math.round(m.positions[v*3+2]!*1e5);let id=key.get(k);if(id===undefined){id=key.size;key.set(k,id);}weld[v]=id;}
  const edges=new Map<string,number>();let meshVolume=0,meshDegenerate=0;
  for(let t=0;t<m.indices.length;t+=3){
   const ia=m.indices[t]!,ib=m.indices[t+1]!,ic=m.indices[t+2]!,p=m.positions;
   const ax=p[ia*3]!,ay=p[ia*3+1]!,az=p[ia*3+2]!,ux=p[ib*3]!-ax,uy=p[ib*3+1]!-ay,uz=p[ib*3+2]!-az,vx=p[ic*3]!-ax,vy=p[ic*3+1]!-ay,vz=p[ic*3+2]!-az;
   const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx,area=Math.hypot(cx,cy,cz)/2;
   triangles++;
   if(area<minArea){meshDegenerate++;continue;}
   meshVolume+=(ax*cx+ay*cy+az*cz)/6;
   const w=[weld[ia]!,weld[ib]!,weld[ic]!];
   const g=[ia,ib,ic].map(i=>{const k=Math.round(p[i*3]!*1e4)+','+Math.round(p[i*3+1]!*1e4)+','+Math.round(p[i*3+2]!*1e4);let id=globalKey.get(k);if(id===undefined){id=globalKey.size;globalKey.set(k,id);}return id;});
   for(let e=0;e<3;e++){const a=g[e]!,c=g[(e+1)%3]!;if(a===c)continue;const k=a<c?a+'-'+c:c+'-'+a;globalEdges.set(k,(globalEdges.get(k)??0)+1);}
   for(let e=0;e<3;e++){const a=w[e]!,b=w[(e+1)%3]!;if(a===b)continue;const k=a<b?a+'-'+b:b+'-'+a;edges.set(k,(edges.get(k)??0)+1);}
  }
  let meshOpen=0,meshNon=0;for(const n of edges.values()){if(n===1)meshOpen++;else if(n>2)meshNon++;}
  degenerate+=meshDegenerate;open+=meshOpen;nonManifold+=meshNon;
  if(meshOpen===0&&meshVolume<-1e-9)inverted.push(m.name);
  volume+=Math.abs(meshVolume);
 }
 const b=bounds(scene),dims=b.max.map((v,i)=>v-b.min[i]!) as [number,number,number],largest=Math.max(...dims);
 if(!scene.meshes.length)errors.push('no meshes');
 if(degenerate)errors.push(degenerate+' degenerate triangle(s) (area < '+minArea+' m²)');
 if(nonManifold)errors.push(nonManifold+' non-manifold edge(s) (shared by more than two faces)');
 let combinedOpen=0;for(const n of globalEdges.values())if(n===1)combinedOpen++;
 if(open&&(options.openEdges==='error'||combinedOpen))(options.openEdges==='error'?errors:warnings).push(open+' open boundary edge(s)'+(combinedOpen<open?' ('+combinedOpen+' after welding parts together)':''));
 const zFight=coplanarOverlaps(scene),floating=floatingParts(scene).map(p=>p.part),interpenetrating=interpenetrations(scene),layout=layoutDefects(scene),groundStacked=coplanarOverlaps(scene,{groundBases:true}).length-zFight.length;
 if(interpenetrating.length)warnings.push(interpenetrating.length+' interpenetrating part(s): '+interpenetrating.slice(0,4).map(o=>o.kind+' '+o.a+' / '+o.b+' '+(o.depth*1000).toFixed(1)+' mm').join(', '));
 if(layout.length)warnings.push(layout.length+' layout defect(s): '+layout.slice(0,4).map(o=>o.kind+' '+o.a+(o.b?' / '+o.b:'')+' '+(o.depth*1000).toFixed(1)+' mm').join(', '));
 if(groundStacked)warnings.push(groundStacked+' stacked base(s) on the ground plane (hidden duplicate faces, visible only from below)');
 if(zFight.length)warnings.push(zFight.length+' coplanar overlap(s) between different pieces (z-fighting or hidden duplicate faces): '+zFight.slice(0,3).map(o=>o.a+' / '+o.b+' '+(o.area*1e4).toFixed(1)+' cm²').join(', '));
 if(floating.length)warnings.push(floating.length+' floating part(s) not connected to the grounded structure: '+floating.slice(0,5).join(', '));
 if(inverted.length)errors.push('inverted winding (negative volume): '+inverted.slice(0,5).join(', '));
 if(Math.abs(b.min[1]!)>ground)errors.push('not grounded: min y = '+b.min[1]!.toFixed(4)+' m (tolerance '+ground+')');
 if(dims[1]<=0)errors.push('flat or inverted up axis');
 if(budget){
  if(triangles>budget.triangles)errors.push(triangles+' triangles exceeds '+options.category+' budget '+budget.triangles);
  else if(triangles>budget.triangles*0.8)warnings.push(triangles+' triangles is above 80% of the '+options.category+' budget');
  if(largest<budget.minSize||largest>budget.maxSize)errors.push('largest dimension '+largest.toFixed(3)+' m is outside '+options.category+' range '+budget.minSize+'..'+budget.maxSize+' m');
 }
 const centerX=(b.max[0]!+b.min[0]!)/2,centerZ=(b.max[2]!+b.min[2]!)/2;
 if(Math.hypot(centerX,centerZ)>Math.max(0.25*largest,0.05))warnings.push('footprint center is '+Math.hypot(centerX,centerZ).toFixed(3)+' m from the origin');
 if(scene.dropped.length)warnings.push('derived formats drop: '+scene.dropped.join('; '));
 const round=(v:number,q:number)=>Math.round(v/q)*q;
 return {ok:!errors.length,errors,warnings,triangles,nonManifoldEdges:nonManifold,openEdges:open,combinedOpenEdges:combinedOpen,zFight,floating,interpenetrating,layout,groundStacked,degenerateTriangles:degenerate,invertedMeshes:inverted,bounds:b,
  signature:{...(scene.dropped.some(d=>d.startsWith('skins'))?{rigged:true}:{}),silhouettes:silhouettes(scene,b),triangles,meshes:scene.meshes.length,materials:new Set(scene.meshes.map(m=>m.material)).size,dimensions:dims.map(d=>round(d,0.001)) as [number,number,number],volume:round(volume,1e-5)}};
}
const GRID=32;
/** Rasterize the model's top (x,z), front (x,y) and side (z,y) silhouettes into bbox-normalized 32x32 masks. */
export function silhouettes(scene:Pick<ReadScene,'meshes'>,b=bounds(scene)):string[]{
 const views:Array<[number,number]>=[[0,2],[0,1],[2,1]];
 return views.map(([u,v])=>{
  const mask=new Uint8Array(GRID*GRID),su=(b.max[u]!-b.min[u]!)||1,sv=(b.max[v]!-b.min[v]!)||1;
  const px=(m:Float64Array,i:number,axis:number,min:number,span:number)=>Math.min(GRID-1e-6,Math.max(0,(m[i*3+axis]!-min)/span*GRID));
  for(const m of scene.meshes)for(let t=0;t<m.indices.length;t+=3){
   const p=[0,1,2].map(k=>{const i=m.indices[t+k]!;return [px(m.positions,i,u,b.min[u]!,su),px(m.positions,i,v,b.min[v]!,sv)] as [number,number];});
   for(const [x,y] of p)mask[Math.floor(y)*GRID+Math.floor(x)]=1;
   const [a,c,d]=p as [[number,number],[number,number],[number,number]],area=(c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]);if(Math.abs(area)<1e-12)continue;
   const x0=Math.floor(Math.min(a[0],c[0],d[0])),x1=Math.floor(Math.max(a[0],c[0],d[0])),y0=Math.floor(Math.min(a[1],c[1],d[1])),y1=Math.floor(Math.max(a[1],c[1],d[1]));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const qx=x+.5,qy=y+.5,e=(p:[number,number],q:[number,number])=>((q[0]-p[0])*(qy-p[1])-(q[1]-p[1])*(qx-p[0]))*Math.sign(area);if(e(a,c)>=0&&e(c,d)>=0&&e(d,a)>=0)mask[y*GRID+x]=1;}
  }
  let hex='';for(let i=0;i<mask.length;i+=4)hex+=(mask[i]!|mask[i+1]!<<1|mask[i+2]!<<2|mask[i+3]!<<3).toString(16);return hex;
 });
}
/** Intersection-over-union of two hex masks. */
export function maskIoU(a:string,b:string):number{let inter=0,union=0;for(let i=0;i<a.length;i++){const x=parseInt(a[i]!,16),y=parseInt(b[i]??'0',16);for(let k=0;k<4;k++){const p=x>>k&1,q=y>>k&1;inter+=p&q;union+=p|q;}}return union?inter/union:1;}
/**
 * Near-duplicate test. Either (a) structurally the same mesh: same parts and
 * materials, triangles within 1%, every dimension and volume within `tolerance`
 * (default 1.5%); or (b) visually the same: all three silhouettes overlap with
 * IoU >= 0.93 and every dimension is within 12%, which catches variants that
 * keep the base triangle count but only nudge proportions.
 */
export function nearDuplicate(a:GeometrySignature,b:GeometrySignature,tolerance=0.015):boolean{
 const close=(x:number,y:number,t:number)=>Math.abs(x-y)<=t*Math.max(Math.abs(x),Math.abs(y),1e-6);
 if(a.meshes===b.meshes&&a.materials===b.materials&&close(a.triangles,b.triangles,0.01)&&a.dimensions.every((d,i)=>close(d,b.dimensions[i]!,tolerance))&&close(a.volume,b.volume,tolerance))return true;
 // Rigged families share one template mesh, so size and triangle tests can't separate a recolour or uniform rescale: compare bbox-normalized silhouettes alone.
 if(a.rigged&&b.rigged&&a.meshes===b.meshes&&close(a.triangles,b.triangles,0.06)&&a.silhouettes?.length===3&&b.silhouettes?.length===3){const iou=a.silhouettes.map((s,i)=>maskIoU(s,b.silhouettes![i]!));return iou.reduce((x,y)=>x+y,0)/3>=0.85&&Math.min(...iou)>=0.8;}
 if(a.silhouettes?.length===3&&b.silhouettes?.length===3&&a.dimensions.every((d,i)=>close(d,b.dimensions[i]!,0.12)))return a.silhouettes.every((s,i)=>maskIoU(s,b.silhouettes![i]!)>=0.93);
 return false;
}

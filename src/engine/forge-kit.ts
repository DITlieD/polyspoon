// Shared construction kit for the forge recipe families (barrel, signpost,
// lamp-post, mushroom-cluster, rock-cluster). It wraps the faceted helpers in
// geometry.ts and the parameter contract so each family file only describes
// its shape. All geometry is closed, convex-per-part, meters, +Y up, grounded.
import { Box3, BufferGeometry as Geometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { facetedLoft, profileSolid, taperedSweep } from './geometry.ts';
import { loadConstructionDesign } from './construction-migration.ts';
import { parseControls, parameterState, plainRecord } from './parameters.ts';
import type { Control, Design, Descriptor, Parameters } from './parameters.ts';
import type { AssetBuild } from '../catalog/types.ts';
import type { Recipe, RecipeCase } from '../recipes/types.ts';

/** Repeatable LCG in [0,1). */
export function rng(seed:number){let s=(seed>>>0)^0x9e3779b9;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
/** Strictly convex outline: points on an ellipse; angle jitter (<1) keeps order so the polygon stays convex. */
export function ellipse(rx:number,rz:number,sides:number,phase=0,jitter=0,random?:()=>number):Array<[number,number]>{
 return Array.from({length:sides},(_,i)=>{const a=phase+(i+(random&&jitter?(random()-.5)*Math.min(jitter,.9):0))*2*Math.PI/sides;return [Math.cos(a)*rx,Math.sin(a)*rz];});
}
/** Faceted lathe: profile is [radius,y] pairs with strictly increasing y. */
export function lathe(profile:Array<[number,number]>,sides:number,o:{center?:[number,number];squash?:number;phase?:number;tilt?:[number,number]}={}):BufferGeometry{
 const [cx,cz]=o.center??[0,0],sq=o.squash??1,[tx,tz]=o.tilt??[0,0];
 return facetedLoft(profile.map(([r,y])=>({center:[cx+tx*y,y,cz+tz*y] as [number,number,number],outline:ellipse(r,r*sq,sides,o.phase??0)})));
}
/** Chamfered box centered at position (profileSolid with two eased stations). */
export function box(size:[number,number,number],position:[number,number,number],chamfer=0.004):BufferGeometry{
 const [w,h,d]=size,c=Math.min(chamfer,Math.min(w,d)*0.2);
 const g=profileSolid([{y:-h/2,width:w,depth:d,chamfer:c},{y:h/2,width:w,depth:d,chamfer:c}]);g.translate(...position);return g;
}
/** Round rod between two points. */
export function rod(from:[number,number,number],to:[number,number,number],radius:number,sides=8,tipRadius=radius):BufferGeometry{
 return taperedSweep([{center:from,radius},{center:to,radius:tipRadius}],sides);
}

/** Thin closed leaf/blade along a path: diamond cross-section (half-width w across `side`, half-thickness t), capped ends. Manifold, any path direction. */
export function blade(stations:Array<{p:[number,number,number];w:number;t:number}>,side:[number,number,number]):BufferGeometry{
 if(stations.length<2||stations.some(s=>!(s.w>0&&s.t>0)))throw new Error('Invalid blade stations');
 const c=stations.map(s=>new Vector3(...s.p)),S=new Vector3(...side),rings:Vector3[][]=[];
 for(let i=0;i<c.length;i++){
  const tan=c[Math.min(i+1,c.length-1)]!.clone().sub(c[Math.max(0,i-1)]!);if(tan.length()<1e-8)throw new Error('Collapsed blade path');tan.normalize();
  let u=S.clone().addScaledVector(tan,-S.dot(tan));if(u.length()<1e-6)u=new Vector3(Math.abs(tan.y)<.9?0:1,Math.abs(tan.y)<.9?1:0,0).cross(tan);u.normalize();
  const v=tan.clone().cross(u),{w,t}=stations[i]!;
  rings.push([c[i]!.clone().addScaledVector(u,w),c[i]!.clone().addScaledVector(v,t),c[i]!.clone().addScaledVector(u,-w),c[i]!.clone().addScaledVector(v,-t)]);
 }
 const pos:number[]=[],tri=(a:Vector3,b:Vector3,d:Vector3)=>pos.push(...a.toArray(),...b.toArray(),...d.toArray());
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<4;j++){const k=(j+1)%4;tri(rings[i]![j]!,rings[i]![k]!,rings[i+1]![k]!);tri(rings[i]![j]!,rings[i+1]![k]!,rings[i+1]![j]!);}
 for(let j=0;j<4;j++){const k=(j+1)%4;tri(c[0]!,rings[0]![k]!,rings[0]![j]!);tri(c.at(-1)!,rings.at(-1)![j]!,rings.at(-1)![k]!);}
 const g=new Geometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
/** Merge closed parts into one mesh geometry (positions + normals only), e.g. a frond and its leaflets. */
export function merge(parts:BufferGeometry[]):BufferGeometry{
 const pos:number[]=[];
 for(const g0 of parts){const g=g0.index?g0.toNonIndexed():g0,a=g.getAttribute('position');for(let i=0;i<a.count;i++)pos.push(a.getX(i),a.getY(i),a.getZ(i));}
 const g=new Geometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
/** Place a part built around the origin (+Y up): rotate by yaw (about Y) after tilting by pitch (about X, toward +Z), then translate. */
export function place(g:BufferGeometry,at:[number,number,number],yaw=0,pitch=0,roll=0):BufferGeometry{g.rotateZ(roll);g.rotateX(pitch);g.rotateY(yaw);g.translate(...at);return g;}
/** Flat oval pad (prickly-pear paddle, lily pad on its side): half-width w, height h along +Y from the origin, half-thickness t. */
export function facetPad(w:number,h:number,t:number,sides=10,stations=6):BufferGeometry{
 return facetedLoft(Array.from({length:stations},(_,i)=>{const v=(i+0.5)/stations,k=Math.max(Math.sin(Math.PI*v),0.18);return {center:[0,v*h,0] as [number,number,number],outline:ellipse(w*k,t*Math.sqrt(k),sides)};}));
}
/** Rest a loose part on the ground: shift it so its lowest vertex is at y=0. */
export function rest(g:BufferGeometry):BufferGeometry{g.computeBoundingBox();g.translate(0,-g.boundingBox!.min.y,0);return g;}
/** Faceted ellipsoid blob (convex, closed) centered at c with radii r; jitter roughens the outline repeatably. */
export function blob(c:[number,number,number],r:[number,number,number],sides=8,rings=6,random?:()=>number,jitter=0):BufferGeometry{
 const phase=random?random()*Math.PI:0;
 const st=Array.from({length:rings+1},(_,i)=>{const a=-Math.PI/2+(i+0.5)*Math.PI/(rings+1),k=Math.cos(a),j=random&&jitter?1+(random()-.5)*jitter:1;return {center:[c[0],c[1]+Math.sin(a)*r[1],c[2]] as [number,number,number],outline:ellipse(r[0]*k*j,r[2]*k*j,sides,i*0.3+phase)};});
 return facetedLoft(st);
}

export interface ForgeSpec {
 id:string;version:string;
 /** Earlier versions with the same controls; their designs load and migrate (geometry is rebuilt by the current version). */
 priorVersions?:string[];
 title:string;description:string;category:string;order:number;
 entry:string;exportName:string;
 roles:Record<string,string>;
 palettes:Record<string,{label:string;colors:Record<string,string>}>;
 controls:Control[];
 presets:Descriptor['presets'];
 constraints:string[];
 check?(p:Parameters):void;
 roughness?:Record<string,number>;metalness?:Record<string,number>;
 /** Organic families: snap the assembled model onto y=0 when its lowest point is within this distance (m) of the ground, instead of failing the grounding check. */
 groundSnap?:number;
 /** Self-lit roles (screens, light strips, glowing cores): emissive strength, emissive color = role color. */
 emissive?:Record<string,number>;
 /** Settle the finished assembly onto y=0 (for faceted round parts whose lowest point is not known exactly). Anchors move with it. */
 autoGround?:boolean;
 build(p:Parameters,add:(name:string,role:string,geometry:BufferGeometry,connectedTo?:string)=>Mesh):Record<string,number[]>;
 extraCases?:RecipeCase[];
}
export function forgeRecipe(spec:ForgeSpec):Recipe{
 const roles=Object.keys(spec.roles),first=Object.keys(spec.palettes)[0]!;
 const controls:Control[]=[...spec.controls,
  {key:'colorway',label:'Palette',kind:'choice',group:'colors',unit:'none',default:first,options:Object.entries(spec.palettes).map(([value,p])=>({value,label:p.label})),hint:'Starting colors; individual roles can override them.',affects:['material'],targets:roles},
  ...roles.map((role):Control=>({key:'color.'+role,label:role[0]!.toUpperCase()+role.slice(1),kind:'color',group:'colors',unit:'color',default:spec.palettes[first]!.colors[role]!,role,hint:spec.roles[role]!,affects:['material'],targets:[role]})),
 ];
 const parse=(input:unknown):Parameters=>{
  const value=plainRecord(input),checked=parseControls(controls,value),colors=spec.palettes[String(checked.colorway)]!.colors;
  for(const role of roles)if(!Object.hasOwn(value,'color.'+role))checked['color.'+role]=colors[role]!;
  spec.check?.(checked);return checked;
 };
 const save=(input:unknown):Design=>{const requested={...plainRecord(input)};return {formatVersion:1,family:spec.id,familyVersion:spec.version,requested,applied:parse(requested)};};
 const loadPrior=(input:unknown):Design=>{const v=plainRecord(input);if(!spec.priorVersions?.includes(String(v.familyVersion)))throw new Error('No prior '+spec.id+' versions');const requested={...plainRecord(v.requested)};return {formatVersion:1,family:spec.id,familyVersion:String(v.familyVersion),requested,applied:parse(requested)};};
 const load=(input:unknown):Design=>loadConstructionDesign(input,spec.id,spec.version,spec.priorVersions??[],save,loadPrior);
 function build(input:unknown):AssetBuild{
  const config=save(input),p=config.applied,root=new Group();root.name=spec.id;
  const materials=Object.fromEntries(roles.map(role=>[role,new MeshStandardMaterial({name:role,color:String(p['color.'+role]),roughness:spec.roughness?.[role]??0.9,metalness:spec.metalness?.[role]??0,flatShading:true,...(spec.emissive?.[role]?{emissive:new Color(String(p['color.'+role])),emissiveIntensity:spec.emissive[role]}:{})})]));
  const add=(name:string,role:string,geometry:BufferGeometry,connectedTo?:string)=>{const m=new Mesh(geometry,materials[role]);m.name=name;m.userData={materialRole:role,...(connectedTo?{connectedTo}:{})};m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
  const built=spec.build(p,add);
  if(spec.autoGround){root.updateMatrixWorld(true);const dy=-new Box3().setFromObject(root,true).min.y;for(const child of root.children)if(child instanceof Mesh)child.geometry.translate(0,dy,0);for(const a of Object.values(built))a[1]=a[1]!+dy;}
  const anchors={ground:[0,0,0],...built};
  root.userData={configuration:config,units:'meters',up:'+Y',forward:'+Z',origin:'ground-center',anchors};
  // connectedTo is the assembly graph reviewers and the floating check rely on: a typo silently detaches a part.
  const names=new Set(root.children.map(c=>c.name));
  // A target may name one part, a group of parts sharing its prefix ('leg' -> leg-0..leg-3), or a declared control target group ('support', 'bent'), as the lane B structures do.
   const groups=new Set(spec.controls.flatMap(c=>c.targets)),known=(to:string)=>names.has(to)||groups.has(to)||[...names].some(n=>n.startsWith(to+'-'));
   for(const c of root.children){const to=c.userData.connectedTo;if(to!==undefined&&!known(String(to)))throw new Error(spec.id+': part '+c.name+' is connected to missing part '+to);}
  root.updateMatrixWorld(true);
  if(spec.groundSnap){const lo=new Box3().setFromObject(root,true).min.y;if(Math.abs(lo)>1e-6&&Math.abs(lo)<=spec.groundSnap){for(const c of root.children)(c as Mesh).geometry.translate(0,-lo,0);for(const a of Object.values(anchors))if(a.length===3)a[1]=a[1]!-lo;}}
  root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(root,true);
  if(Math.abs(bounds.min.y)>1e-4)throw new Error(spec.id+' is not grounded (min y '+bounds.min.y.toFixed(4)+')');
  return {root,config,materials,anchors,bounds,dimensions:bounds.getSize(new Vector3())};
 }
 const boundaries:RecipeCase[]=spec.controls.flatMap(c=>c.kind==='range'||c.kind==='integer'?[
  {id:c.key.toLowerCase()+'-min',name:c.label+' minimum',parameters:{[c.key]:c.min}},
  {id:c.key.toLowerCase()+'-max',name:c.label+' maximum',parameters:{[c.key]:c.max}},
 ]:[]);
 const valid=(c:RecipeCase)=>{try{parse(c.parameters);return true;}catch{return false;}};
 return {
  descriptor:{id:spec.id,version:spec.version,title:spec.title,description:spec.description,controls,defaults:parse({}),presets:spec.presets,
   palettes:Object.entries(spec.palettes).map(([id,p])=>({id,label:p.label,colors:roles.map(r=>p.colors[r]!)})),save,state:input=>parameterState(controls,input)},
  build,load,
  validationCases:[...spec.presets,...boundaries.filter(valid),...(spec.extraCases??[])],
  integrationCases:[{id:'default',name:'Default '+spec.title.toLowerCase(),parameters:{}}],
  constraints:spec.constraints,
  presentation:{category:spec.category,order:spec.order,kitIds:[],thumbnails:Object.fromEntries(spec.presets.map(p=>[p.id,spec.id+'-'+p.id+'.png']))},
  source:{entry:spec.entry,exportName:spec.exportName},
 };
}

export type V3=[number,number,number];
/** Flip a closed triangle soup so its signed volume is positive (outward winding). */
function outward(positions:number[]):Geometry{
 let v=0;for(let i=0;i<positions.length;i+=9){const [ax,ay,az,bx,by,bz,cx,cy,cz]=positions.slice(i,i+9) as number[];v+=ax!*(by!*cz!-bz!*cy!)-ay!*(bx!*cz!-bz!*cx!)+az!*(bx!*cy!-by!*cx!);}
 if(v<0)for(let i=0;i<positions.length;i+=9)for(let k=0;k<3;k++){const t=positions[i+3+k]!;positions[i+3+k]=positions[i+6+k]!;positions[i+6+k]=t;}
 const g=new Geometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
/**
 * Loft through arbitrary 3D loops (all the same length). caps:'fan' closes each end with a
 * centroid fan (convex loops), 'strip' closes a two-sided loop [a0..am-1, bm-1..b0] with quads
 * between its halves (U-shaped shells such as hulls), 'cyclic' joins the last loop to the first.
 * The result is closed and wound outward.
 */
export function loopLoft(loops:V3[][],caps:'fan'|'strip'|'cyclic'='fan'):Geometry{
 const n=loops[0]?.length??0;
 if(loops.length<2||n<3||loops.some(l=>l.length!==n||!l.flat().every(Number.isFinite))||(caps==='strip'&&n%2))throw new Error('Invalid loop loft');
 const pos:number[]=[],tri=(a:V3,b:V3,c:V3)=>pos.push(...a,...b,...c);
 const count=caps==='cyclic'?loops.length:loops.length-1;
 for(let k=0;k<count;k++){const A=loops[k]!,B=loops[(k+1)%loops.length]!;for(let i=0;i<n;i++){const j=(i+1)%n;tri(A[i]!,B[i]!,B[j]!);tri(A[i]!,B[j]!,A[j]!);}}
 const cap=(L:V3[],flip:boolean)=>{
  if(caps==='fan'){const c=L.reduce((s,p)=>[s[0]+p[0]/n,s[1]+p[1]/n,s[2]+p[2]/n] as V3,[0,0,0] as V3);for(let i=0;i<n;i++){const j=(i+1)%n;flip?tri(c,L[j]!,L[i]!):tri(c,L[i]!,L[j]!);}}
  else if(caps==='strip'){const m=n/2;for(let i=0;i<m-1;i++){const a=L[i]!,b=L[i+1]!,c=L[n-2-i]!,d=L[n-1-i]!;if(flip){tri(a,c,b);tri(a,d,c);}else{tri(a,b,c);tri(a,c,d);}}}
 };
 if(caps!=='cyclic'){cap(loops[0]!,false);cap(loops.at(-1)!,true);}
 // Fan caps are wound for one end orientation; outward() fixes the whole soup if it came out inside-out,
 // and per-cap consistency is guaranteed because both caps use the loop order of their own loop.
 return outward(pos);
}
/** Ring of n points around an axis-aligned center. axis: the normal of the ring plane. */
export function circle(center:V3,radius:number,n:number,axis:'x'|'y'|'z'='y',phase=0,squash=1):V3[]{
 return Array.from({length:n},(_,i)=>{const a=phase+i*2*Math.PI/n,u=Math.cos(a)*radius,v=Math.sin(a)*radius*squash;
  return axis==='y'?[center[0]+u,center[1],center[2]+v]:axis==='x'?[center[0],center[1]+v,center[2]+u]:[center[0]+u,center[1]+v,center[2]];});
}
/** Solid of revolution around the X axis (wheels, hubs, axles): profile is [radius,x] pairs, x increasing. */
export function latheX(profile:Array<[number,number]>,sides:number,center:[number,number]=[0,0],phase=0):Geometry{
 return loopLoft(profile.map(([r,x])=>circle([x,center[0],center[1]],r,sides,'x',phase)));
}
/** Torus-like ring around the X axis with a round tube (wheel rims, hoops). */
export function hoopX(center:V3,radius:number,tube:number,segments:number,sides=6):Geometry{
 const loops=Array.from({length:segments},(_,i)=>{const a=i*2*Math.PI/segments,dy=Math.cos(a),dz=Math.sin(a);
  return Array.from({length:sides},(_,j)=>{const b=j*2*Math.PI/sides,r=radius+Math.cos(b)*tube;return [center[0]+Math.sin(b)*tube,center[1]+dy*r,center[2]+dz*r] as V3;});});
 return loopLoft(loops,'cyclic');
}

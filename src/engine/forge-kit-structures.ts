// Structure/building helpers for forge families (windmill, watchtower, bridge,
// market stall, dock, archway, tent). Everything stays closed and convex-per-part.
import { Euler, Matrix4, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { facetedLoft, profileSolid } from './geometry.ts';

type V3=[number,number,number];
/** Rotate (Euler YXZ, radians) then translate. Mutates and returns the geometry. */
export function place(g:BufferGeometry,pos:V3,rot:V3=[0,0,0]):BufferGeometry{
 g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rot[0],rot[1],rot[2],'YXZ')));g.translate(...pos);return g;
}
/** Convex polygon in the XY plane (any winding), extruded `depth` along Z and centered on z=0. */
export function prism(outline:Array<[number,number]>,depth:number):BufferGeometry{
 let o=outline.map(([x,y])=>[x,-y] as [number,number]);
 const area=o.reduce((s,[x,z],i)=>{const n=o[(i+1)%o.length]!;return s+x*n[1]-n[0]*z;},0);if(area<0)o=o.reverse();
 // facetedLoft needs the origin strictly inside: loft around the centroid, then move back.
 const cx=o.reduce((s,p)=>s+p[0],0)/o.length,cz=o.reduce((s,p)=>s+p[1],0)/o.length,local=o.map(([x,z])=>[x-cx,z-cz] as [number,number]);
 const g=facetedLoft([{center:[cx,-depth/2,cz],outline:local},{center:[cx,depth/2,cz],outline:local}]);g.rotateX(Math.PI/2);return g;
}
/** Rectangular chamfered beam between two points; `height` is measured along `up` (orthogonalized), `width` across. */
export function beam(from:V3,to:V3,height:number,width:number,up:V3=[0,1,0],chamfer=0.004):BufferGeometry{
 const a=new Vector3(...from),d=new Vector3(...to).sub(a),len=d.length();if(len<1e-6)throw new Error('Beam span must be positive');
 const x=d.clone().normalize();let y=new Vector3(...up);y.addScaledVector(x,-y.dot(x));
 if(y.length()<1e-6)y=new Vector3(Math.abs(x.y)<.9?0:1,Math.abs(x.y)<.9?1:0,0).addScaledVector(x,-(Math.abs(x.y)<.9?x.y:x.x));
 y.normalize();const z=new Vector3().crossVectors(y,x);
 const c=Math.min(chamfer,Math.min(height,width)*0.2);
 // profileSolid runs along Y with width on X, depth on Z: local Y=length, X=height axis, Z=width axis.
 const g=profileSolid([{y:0,width:height,depth:width,chamfer:c},{y:len,width:height,depth:width,chamfer:c}]);
 g.applyMatrix4(new Matrix4().makeBasis(y,x,z));g.translate(...from);return g;
}
/** Apothem-facing helper: distance from center to a face of an n-gon of circumradius r. */
export const apothem=(r:number,n:number)=>r*Math.cos(Math.PI/n);
/** Phase that puts a face (not a vertex) on +Z for an n-sided lathe. */
export const faceFrontPhase=(n:number)=>Math.PI/2-Math.PI/n;

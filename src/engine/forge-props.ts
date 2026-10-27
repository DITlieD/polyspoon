// Extra shape helpers for the lane-A prop families (anvil, bookcase, dining set,
// campfire, alchemy bench, weapon rack). Every helper returns a closed solid.
import { Euler, Matrix4 } from 'three';
import type { BufferGeometry } from 'three';
import { facetedLoft, taperedSweep } from './geometry.ts';
import { ellipse } from './forge-kit.ts';
export type V3=[number,number,number];
/** Rotate (Z first, then X, then Y: tilt, then yaw) about the origin, then translate. */
export function place(g:BufferGeometry,rot:V3=[0,0,0],at:V3=[0,0,0]):BufferGeometry{
 g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rot[0],rot[1],rot[2],'YXZ')));g.translate(at[0],at[1],at[2]);return g;
}
/** Flat plate in the XZ plane (convex, counter-clockwise outline), centered on y=0. */
export function plate(outline:Array<[number,number]>,thickness:number):BufferGeometry{
 return facetedLoft([{center:[0,-thickness/2,0],outline},{center:[0,thickness/2,0],outline}]);
}
/** Diamond-section blade along +y from 0 to length, tapering to a point. */
export function blade(length:number,width:number,thick:number,tip=0.18,fuller=0.92):BufferGeometry{
 const d=(w:number,t:number):Array<[number,number]>=>[[w/2,0],[0,t/2],[-w/2,0],[0,-t/2]];
 return facetedLoft([{center:[0,0,0],outline:d(width,thick)},{center:[0,length*(1-tip),0],outline:d(width*fuller,thick*0.9)},{center:[0,length,0],outline:d(0.004,0.002)}]);
}
/** Round tube along a circular arc (start..end angle) of radius r in the plane spanned by u and v around c. */
export function arc(c:V3,r:number,a0:number,a1:number,segments:number,tube:number,u:V3=[1,0,0],v:V3=[0,1,0],sides=6):BufferGeometry{
 const pts=Array.from({length:segments+1},(_,i)=>{const a=a0+(a1-a0)*i/segments;return {center:[0,1,2].map(k=>c[k]!+u[k]!*Math.cos(a)*r+v[k]!*Math.sin(a)*r) as V3,radius:tube};});
 return taperedSweep(pts,sides);
}
/** Lift a geometry so its lowest point sits at y (for parts that rest on the ground after rotation). */
export function rest(g:BufferGeometry,y=0):BufferGeometry{g.computeBoundingBox();g.translate(0,y-g.boundingBox!.min.y,0);return g;}
/** Rounded convex pebble/stone: a short faceted lathe with jitter. */
export function stone(w:number,h:number,sides:number,random:()=>number):BufferGeometry{
 const ph=random()*Math.PI,sq=0.65+random()*0.3;
 return facetedLoft(([[w,0],[w*1.06,h*0.35],[w*0.78,h*0.8],[w*0.35,h]] as Array<[number,number]>).map(([r,y])=>({center:[0,y,0] as V3,outline:ellipse(r,r*sq,sides,ph)})));
}

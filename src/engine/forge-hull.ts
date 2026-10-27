// Parametric open boat hull for the forge vehicle families (rowboat, sailboat).
// The hull is a closed U-shaped shell (outer skin, inner skin, gunwale top and
// end strips), +Z is the bow, the keel line rests at y = lift.
import { loopLoft } from './forge-kit.ts';
import type { V3 } from './forge-kit.ts';

export interface HullSpec {length:number;beam:number;depth:number;sheer:number;rocker:number;roundness:number;bow:'pointed'|'square';stern:'pointed'|'transom'|'square';thickness:number;lift:number}
export function halfBeam(h:HullSpec,u:number):number{
 const style=u>=0?h.bow:h.stern,a=Math.abs(u),B=h.beam/2;
 const w=style==='pointed'?B*Math.sqrt(Math.max(0,1-a**2.4)):style==='transom'?B*(1-0.42*a*a):B*(1-0.18*a**6);
 return Math.max(0.02,w);
}
export const hullTop=(h:HullSpec,u:number)=>h.lift+h.depth+h.sheer*u*u;
export const hullKeel=(h:HullSpec,u:number)=>{const style=u>=0?h.bow:h.stern;return h.lift+h.rocker*(style==='square'?Math.abs(u)**2.2:u**4);};
/** Point on the cross-section at u (-1 stern..1 bow), s 0 (port gunwale) .. 1 (starboard gunwale); inset moves to the inner skin. */
export function hullPoint(h:HullSpec,u:number,s:number,inset=0):V3{
 const p=h.roundness,th=Math.PI*s,c=Math.cos(th),sn=Math.sin(th),top=hullTop(h,u),keel=hullKeel(h,u)+inset;
 const w=Math.max(0.004,halfBeam(h,u)-inset);
 return [-Math.sign(c)*Math.abs(c)**(2/p)*w,top-(top-keel)*sn**(2/p),u*h.length/2];
}
/** Inner-skin half width at height y for station u. */
export function hullInnerX(h:HullSpec,u:number,y:number):number{
 const p=h.roundness,top=hullTop(h,u),keel=hullKeel(h,u)+h.thickness,w=Math.max(0.004,halfBeam(h,u)-h.thickness);
 const sn=Math.min(1,Math.max(0,(top-y)/(top-keel)))**(p/2),c=Math.sqrt(Math.max(0,1-sn*sn));return w*c**(2/p);
}
export const hullStations=(n=18)=>Array.from({length:n},(_,i)=>-Math.cos(Math.PI*i/(n-1)));
export function hullShell(h:HullSpec,arc=12){
 const loops=hullStations().map(u=>{
  const outer=Array.from({length:arc},(_,i)=>hullPoint(h,u,i/(arc-1)));
  const inner=Array.from({length:arc},(_,i)=>hullPoint(h,u,1-i/(arc-1),h.thickness));
  return [...outer,...inner];
 });
 return loopLoft(loops,'strip');
}
/** Points along the gunwale (s=0 port or s=1 starboard), slightly inside the rim, for rails. */
export function gunwaleLine(h:HullSpec,side:0|1,inset:number,drop=0):V3[]{
 return hullStations(14).slice(1,-1).map(u=>{const p=hullPoint(h,u,side,inset);return [p[0],p[1]-drop,p[2]] as V3;});
}
/** End board (transom or bow board). It sits 12 mm below the rim so its top edge never shares the hull rim's top face. */
export function hullEndBoard(h:HullSpec,end:-1|1,thick=0.03,arc=12){
 const ring=(dz:number)=>Array.from({length:arc},(_,i)=>{const p=hullPoint(h,end,i/(arc-1),h.thickness*0.5);return [p[0],p[1]-0.012,p[2]-end*dz] as V3;});
 return loopLoft([ring(0.006),ring(0.006+thick)].sort(()=>0));
}

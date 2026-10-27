// Visual-defect detectors for generated assets (world space, meters):
//  - coplanarOverlaps: same-facing, coplanar triangles of DIFFERENT pieces (welded connected components, so two islands inside one
//    part count too) that overlap in area -> z-fighting / hidden duplicate faces.
//  - floatingParts: pieces not connected to anything that reaches the ground. A connection needs the two SURFACES to meet
//    (within `touch`); a piece buried wholly inside another solid, or hovering a few mm off it, is not connected.
import type {ReadScene} from './gltf-read.ts';

type V=[number,number,number];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
interface Tri {part:string;label:string;island:number;material:number;p:[V,V,V];n:V;d:number;area:number}
interface Piece {part:string;group:string;material:number;min:V;max:V;tris:Float64Array}
/** Welded connected components of every mesh (vertices within 10 µm merge), in world space. */
function buildPieces(scene:Pick<ReadScene,'meshes'>):Piece[]{
 const pieces:Piece[]=[];
 for(const m of scene.meshes){
  const P=m.positions,n=P.length/3,parent=new Int32Array(n).map((_,i)=>i),find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]!]!;i=parent[i]!;}return i;},key=new Map<string,number>();
  for(let i=0;i<n;i++){const k=[0,1,2].map(c=>Math.round(P[i*3+c]!*1e5)).join(',');const j=key.get(k);if(j===undefined)key.set(k,i);else parent[find(i)]=find(j);}
  for(let t=0;t<m.indices.length;t+=3){const a=find(m.indices[t]!);parent[find(m.indices[t+1]!)]=a;parent[find(m.indices[t+2]!)]=a;}
  const groups=new Map<number,number[]>();
  for(let t=0;t<m.indices.length;t+=3){const r=find(m.indices[t]!);(groups.get(r)??groups.set(r,[]).get(r)!).push(t);}
  for(const list of groups.values()){const tris=new Float64Array(list.length*9),min:V=[Infinity,Infinity,Infinity],max:V=[-Infinity,-Infinity,-Infinity];
   list.forEach((t,k)=>{for(let e=0;e<3;e++){const i=m.indices[t+e]!;for(let c=0;c<3;c++){const x=P[i*3+c]!;tris[k*9+e*3+c]=x;min[c]=Math.min(min[c]!,x);max[c]=Math.max(max[c]!,x);}}});
   pieces.push({part:m.name,group:m.group??m.name,material:m.material,min,max,tris});}
 }
 return pieces;
}
function triangles(pieces:Piece[]):Tri[]{
 const out:Tri[]=[];
 pieces.forEach((piece,island)=>{const T=piece.tris;
  for(let o=0;o<T.length;o+=9){
   const p=[0,1,2].map(k=>[T[o+k*3]!,T[o+k*3+1]!,T[o+k*3+2]!] as V) as [V,V,V],c=cross(sub(p[1],p[0]),sub(p[2],p[0])),len=Math.hypot(...c);
   if(len<1e-12)continue;const n:V=[c[0]/len,c[1]/len,c[2]/len];out.push({part:piece.group,label:piece.part,island,material:piece.material,p,n,d:dot(n,p[0]),area:len/2});
  }});
 return out;
}
function clip(a:Array<[number,number]>,b:Array<[number,number]>):Array<[number,number]>{
 // Sutherland-Hodgman of convex polygon a against convex polygon b (both counter-clockwise).
 let poly=a;
 for(let i=0;i<b.length&&poly.length;i++){
  const [x1,y1]=b[i]!,[x2,y2]=b[(i+1)%b.length]!,side=(p:[number,number])=>(x2-x1)*(p[1]-y1)-(y2-y1)*(p[0]-x1),next:Array<[number,number]>=[];
  for(let j=0;j<poly.length;j++){const p=poly[j]!,q=poly[(j+1)%poly.length]!,sp=side(p),sq=side(q);
   if(sp>=0)next.push(p);if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
  poly=next;
 }
 return poly;
}
const polyArea=(poly:Array<[number,number]>)=>{let s=0;for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i]!,[x2,y2]=poly[(i+1)%poly.length]!;s+=x1*y2-x2*y1;}return Math.abs(s)/2;};
function clipArea(a:Array<[number,number]>,b:Array<[number,number]>):number{return polyArea(clip(a,b));}
export interface Overlap {a:string;b:string;area:number;normal:V;at:V}
/**
 * Same-facing coplanar faces of different pieces overlapping by more than minArea m² (summed per piece pair). Pieces are welded
 * islands, so hidden duplicate faces inside ONE part (bamboo culm segments, pond blooms, cottage plaster panels) are caught, and so
 * are bottoms stacked on the ground plane (a post base inside a stone base): any material, any part.
 */
export function coplanarOverlaps(scene:Pick<ReadScene,'meshes'>,{minArea=1e-4,planeTolerance=3e-3,angleTolerance=0.9995,groundBases=false}:{minArea?:number;planeTolerance?:number;angleTolerance?:number;/** Also report down-facing bases stacked on the ground plane (hidden unless viewed from below). */groundBases?:boolean}={}):Overlap[]{
 const tris=triangles(buildPieces(scene)),n=tris.length;
 const lo=new Float64Array(n*3),hi=new Float64Array(n*3);
 tris.forEach((t,i)=>{for(let c=0;c<3;c++){lo[i*3+c]=Math.min(t.p[0][c]!,t.p[1][c]!,t.p[2][c]!)-planeTolerance;hi[i*3+c]=Math.max(t.p[0][c]!,t.p[1][c]!,t.p[2][c]!)+planeTolerance;}});
 // Candidate pairs: same-facing triangles of different pieces whose (tolerance-padded) bounds overlap. Grouped by dominant normal
 // axis (a triangle near a 45° boundary joins both groups) and swept along x, so tilted near-coincident planes are not lost to
 // quantised plane buckets.
 const groupsOf=(t:Tri)=>{const m=Math.max(...t.n.map(Math.abs));return [0,1,2].filter(c=>Math.abs(t.n[c]!)>=m-0.05).map(c=>c*2+(t.n[c]!>0?1:0));};
 const groups=new Map<number,number[]>();tris.forEach((t,i)=>{for(const g of groupsOf(t))(groups.get(g)??groups.set(g,[]).get(g)!).push(i);});
 const overlapBox=(i:number,j:number)=>lo[i*3+1]!<=hi[j*3+1]!&&lo[j*3+1]!<=hi[i*3+1]!&&lo[i*3+2]!<=hi[j*3+2]!&&lo[j*3+2]!<=hi[i*3+2]!&&lo[i*3]!<=hi[j*3]!&&lo[j*3]!<=hi[i*3]!;
 const seen=new Set<number>(),pairs=new Map<string,Overlap>();
 const ccw=(poly:Array<[number,number]>)=>{const s=(poly[1]![0]-poly[0]![0])*(poly[2]![1]-poly[0]![1])-(poly[1]![1]-poly[0]![1])*(poly[2]![0]-poly[0]![0]);return s<0?poly.reverse():poly;};
 // Keep the part of a 2D polygon where the affine function f(x,y)=k0+k1 x+k2 y is >= 0.
 const clipLin=(poly:Array<[number,number]>,k:[number,number,number])=>{const f=(p:[number,number])=>k[0]+k[1]*p[0]+k[2]*p[1],out:Array<[number,number]>=[];
  for(let a=0;a<poly.length;a++){const p=poly[a]!,q=poly[(a+1)%poly.length]!,fp=f(p),fq=f(q);if(fp>=0)out.push(p);if((fp>=0)!==(fq>=0)){const t=fp/(fp-fq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out;};
 const test=(i:number,j:number)=>{
  const a=tris[i]!,b=tris[j]!;
  if(a.island===b.island||dot(a.n,b.n)<angleTolerance)return;
  if(!groundBases&&a.n[1]<-0.999&&a.p.every(q=>Math.abs(q[1])<=planeTolerance))return; // bases resting on the ground plane
  const u0=sub(a.p[1],a.p[0]),ul=Math.hypot(...u0),u:V=[u0[0]/ul,u0[1]/ul,u0[2]/ul],v=cross(a.n,u),to2=(p:V):[number,number]=>[dot(sub(p,a.p[0]),u),dot(sub(p,a.p[0]),v)];
  let shared=clip(ccw(a.p.map(to2)),ccw(b.p.map(to2)));if(shared.length<3)return;
  // Separation of b's plane from a's, along a's normal, is affine over a's plane: keep only where |separation| <= planeTolerance,
  // so two slightly tilted faces count exactly where they coincide (a splayed post running into its foot).
  const nn=dot(b.n,a.n),s0=(b.d-dot(b.n,a.p[0]))/nn,su=-dot(b.n,u)/nn,sv=-dot(b.n,v)/nn;
  shared=clipLin(clipLin(shared,[planeTolerance-s0,-su,-sv]),[planeTolerance+s0,su,sv]);if(shared.length<3)return;
  const area=polyArea(shared);if(area<=1e-9)return;
  // Covered contact: a third piece's opposite-facing face on the same plane hides both (two parts resting on a plinth top).
  let cover=0;const og=groups.get(groupsOf(a)[0]!^1)??[];
  for(const c of og){if(cover>=area*0.9)break;const t=tris[c]!;if(t.island===a.island||t.island===b.island||dot(t.n,a.n)>-angleTolerance||!overlapBox(i,c))continue;
   if(t.p.some(q=>Math.abs(dot(a.n,q)-a.d)>planeTolerance))continue;cover+=clipArea(shared,ccw(t.p.map(to2)));}
  if(cover>=area*0.9)return;
  const k=Math.min(a.island,b.island)+','+Math.max(a.island,b.island),[la,lb]=a.island<b.island?[a.label,b.label]:[b.label,a.label],o=pairs.get(k)??{a:la,b:lb,area:0,normal:a.n,at:a.p[0]};o.area+=area;pairs.set(k,o);
 };
 for(const list of groups.values()){
  const order=[...list].sort((x,y)=>lo[x*3]!-lo[y*3]!),active:number[]=[];
  for(const i of order){
   for(let k=active.length-1;k>=0;k--)if(hi[active[k]!*3]!<lo[i*3]!)active.splice(k,1);
   for(const j of active){const key=Math.min(i,j)*n+Math.max(i,j);if(!overlapBox(i,j)||seen.has(key))continue;seen.add(key);test(Math.min(i,j),Math.max(i,j));}
   active.push(i);
  }
 }
 return [...pairs.values()].filter(o=>o.area>=minArea).sort((x,y)=>y.area-x.area);
}
/**
 * Pieces (welded connected components) not connected to the ground through REAL contact.
 * Two pieces connect only if their surfaces meet (some triangle pair within `touch`, or crossing) AND either (a) they share
 * flush, opposite-facing face area (>= minContactArea, gap <= faceGap), or (b) one penetrates the other by >= minDepth.
 * Edge-only touches, visible gaps (12 mm chimney courses, hovering straps, 8 mm toadstool spots) and pieces buried wholly inside
 * another solid (hay tufts inside the hay, spots under the cap skin) do not connect. Interior shade cards (window backings,
 * chimney dark interiors) are not exempt: they must be seated on the wall/flue they darken.
 */
export const tieMember=/(^|[_-])(brace|strap|rod|stretcher|tie|rung|crossbar|diagonal)([_-]|$)/;
function pointTriDistance(p:V,t:Float64Array,o:number):number{
 const a:V=[t[o]!,t[o+1]!,t[o+2]!],b:V=[t[o+3]!,t[o+4]!,t[o+5]!],c:V=[t[o+6]!,t[o+7]!,t[o+8]!];
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 const at=(u:V)=>Math.hypot(p[0]-u[0],p[1]-u[1],p[2]-u[2]);
 if(d1<=0&&d2<=0)return at(a);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return at(b);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return at([a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v]);}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return at(c);
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return at([a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w]);}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return at([b[0]+(c[0]-b[0])*w,b[1]+(c[1]-b[1])*w,b[2]+(c[2]-b[2])*w]);}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return at([a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w]);
}
function segTri(p:V,q:V,t:Float64Array,o:number):boolean{
 const d=sub(q,p),e1:V=[t[o+3]!-t[o]!,t[o+4]!-t[o+1]!,t[o+5]!-t[o+2]!],e2:V=[t[o+6]!-t[o]!,t[o+7]!-t[o+1]!,t[o+8]!-t[o+2]!],h=cross(d,e2),a=dot(e1,h);if(Math.abs(a)<1e-14)return false;
 const f=1/a,s0:V=[p[0]-t[o]!,p[1]-t[o+1]!,p[2]-t[o+2]!],u=f*dot(s0,h);if(u<0||u>1)return false;const qq=cross(s0,e1),v=f*dot(d,qq);if(v<0||u+v>1)return false;const w=f*dot(e2,qq);return w>=0&&w<=1;
}
function segSeg(p1:V,q1:V,p2:V,q2:V):number{
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r),cl=(x:number)=>Math.min(1,Math.max(0,x));let s=0,t=0;
 if(a<1e-18&&e<1e-18)return Math.hypot(...r);
 if(a<1e-18)t=cl(f/e);else{const c=dot(d1,r);if(e<1e-18)s=cl(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=den>1e-18?cl((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=cl(-c/a);}else if(t>1){t=1;s=cl((b-c)/a);}}}
 return Math.hypot(p1[0]+d1[0]*s-p2[0]-d2[0]*t,p1[1]+d1[1]*s-p2[1]-d2[1]*t,p1[2]+d1[2]*s-p2[2]-d2[2]*t);
}
/** Exact triangle/triangle test: do they cross, or come within tol of each other? */
function trisMeet(A:Float64Array,i:number,B:Float64Array,j:number,tol:number):boolean{
 const va=[0,1,2].map(k=>[A[i+k*3]!,A[i+k*3+1]!,A[i+k*3+2]!] as V),vb=[0,1,2].map(k=>[B[j+k*3]!,B[j+k*3+1]!,B[j+k*3+2]!] as V);
 for(let k=0;k<3;k++){if(segTri(va[k]!,va[(k+1)%3]!,B,j)||segTri(vb[k]!,vb[(k+1)%3]!,A,i))return true;}
 for(let k=0;k<3;k++){if(pointTriDistance(va[k]!,B,j)<=tol||pointTriDistance(vb[k]!,A,i)<=tol)return true;}
 for(let k=0;k<3;k++)for(let l=0;l<3;l++)if(segSeg(va[k]!,va[(k+1)%3]!,vb[l]!,vb[(l+1)%3]!)<=tol)return true;
 return false;
}
function triBoxes(t:Float64Array):Float64Array{const n=t.length/9,b=new Float64Array(n*6);for(let k=0;k<n;k++)for(let c=0;c<3;c++){const x=t[k*9+c]!,y=t[k*9+3+c]!,z=t[k*9+6+c]!;b[k*6+c]=Math.min(x,y,z);b[k*6+3+c]=Math.max(x,y,z);}return b;}
/** Do the surfaces of two pieces meet anywhere (cross, or within tol)? A piece buried wholly inside another does not. */
function surfacesMeet(a:Piece,b:Piece,tol:number,boxes:(p:Piece)=>Float64Array):boolean{
 const A=a.tris,B=b.tris,ba=boxes(a),bb=boxes(b),na=A.length/9,nb=B.length/9;
 for(let i=0;i<na;i++){
  let skip=false;for(let c=0;c<3;c++)if(ba[i*6+c]!>b.max[c]!+tol||ba[i*6+3+c]!<b.min[c]!-tol){skip=true;break;}if(skip)continue;
  for(let j=0;j<nb;j++){let far=false;for(let c=0;c<3;c++)if(ba[i*6+c]!>bb[j*6+3+c]!+tol||bb[j*6+c]!>ba[i*6+3+c]!+tol){far=true;break;}if(far)continue;
   if(trisMeet(A,i*9,B,j*9,tol))return true;}
 }
 return false;
}
function inside(p:V,piece:Piece):boolean{
 // Ray parity along a skewed direction (avoids grazing edges of axis-aligned boxes).
 const d:V=[0.8017837,0.5345225,0.2672612],t=piece.tris;let hits=0;
 for(let o=0;o<t.length;o+=9){
  const e1:V=[t[o+3]!-t[o]!,t[o+4]!-t[o+1]!,t[o+5]!-t[o+2]!],e2:V=[t[o+6]!-t[o]!,t[o+7]!-t[o+1]!,t[o+8]!-t[o+2]!],h=cross(d,e2),a=dot(e1,h);if(Math.abs(a)<1e-12)continue;
  const f=1/a,s0:V=[p[0]-t[o]!,p[1]-t[o+1]!,p[2]-t[o+2]!],u=f*dot(s0,h);if(u<0||u>1)continue;const q=cross(s0,e1),v=f*dot(d,q);if(v<0||u+v>1)continue;if(f*dot(e2,q)>1e-9)hits++;
 }
 return hits%2===1;
}
function depthInside(p:V,piece:Piece,minDepth:number):boolean{
 for(let c=0;c<3;c++)if(p[c]!<piece.min[c]!+minDepth||p[c]!>piece.max[c]!-minDepth)return false;
 if(!inside(p,piece))return false;
 for(let o=0;o<piece.tris.length;o+=9)if(pointTriDistance(p,piece.tris,o)<minDepth)return false;
 return true;
}
function samples(piece:Piece,step:number):V[]{
 const out:V[]=[],t=piece.tris;
 for(let o=0;o<t.length;o+=9){
  out.push([(t[o]!+t[o+3]!+t[o+6]!)/3,(t[o+1]!+t[o+4]!+t[o+7]!)/3,(t[o+2]!+t[o+5]!+t[o+8]!)/3]);
  for(let e=0;e<3;e++){const i=o+e*3,j=o+((e+1)%3)*3,len=Math.hypot(t[j]!-t[i]!,t[j+1]!-t[i+1]!,t[j+2]!-t[i+2]!),n=Math.max(1,Math.min(400,Math.ceil(len/step)));
   for(let k=0;k<n;k++){const u=k/n;out.push([t[i]!+(t[j]!-t[i]!)*u,t[i+1]!+(t[j+1]!-t[i+1]!)*u,t[i+2]!+(t[j+2]!-t[i+2]!)*u]);}}
 }
 return out;
}
function faceContactArea(a:Piece,b:Piece,faceGap:number,enough:number):number{
 let area=0;const A=a.tris,B=b.tris;
 const tri=(t:Float64Array,o:number):[V,V,V]=>[[t[o]!,t[o+1]!,t[o+2]!],[t[o+3]!,t[o+4]!,t[o+5]!],[t[o+6]!,t[o+7]!,t[o+8]!]];
 for(let i=0;i<A.length;i+=9){const pa=tri(A,i),c=cross(sub(pa[1],pa[0]),sub(pa[2],pa[0])),l=Math.hypot(...c);if(l<1e-12)continue;const n:V=[c[0]/l,c[1]/l,c[2]/l],d=dot(n,pa[0]);
  const u0=sub(pa[1],pa[0]),ul=Math.hypot(...u0),u:V=[u0[0]/ul,u0[1]/ul,u0[2]/ul],v=cross(n,u),to2=(p:V):[number,number]=>[dot(sub(p,pa[0]),u),dot(sub(p,pa[0]),v)];
  const ccw=(poly:Array<[number,number]>)=>{const s=(poly[1]![0]-poly[0]![0])*(poly[2]![1]-poly[0]![1])-(poly[1]![1]-poly[0]![1])*(poly[2]![0]-poly[0]![0]);return s<0?poly.reverse():poly;};
  for(let j=0;j<B.length;j+=9){const pb=tri(B,j),cb=cross(sub(pb[1],pb[0]),sub(pb[2],pb[0])),lb=Math.hypot(...cb);if(lb<1e-12)continue;
   if((n[0]*cb[0]+n[1]*cb[1]+n[2]*cb[2])/lb>-0.999)continue;if(pb.some(q=>Math.abs(dot(n,q)-d)>faceGap))continue;
   area+=clipArea(ccw(pa.map(to2)),ccw(pb.map(to2)));if(area>=enough)return area;}
 }
 return area;
}
export function floatingParts(scene:Pick<ReadScene,'meshes'>,{ground=0.001,minDepth=0.001,faceGap=0.0002,minContactArea=1e-4,step=0.005,tieDepth=0.004,strapGap=0.001,touch=1e-5}:{ground?:number;minDepth?:number;faceGap?:number;minContactArea?:number;step?:number;tieDepth?:number;strapGap?:number;touch?:number}={}):Array<{part:string;min:V;max:V}>{
 const pieces=buildPieces(scene),boxCache=new Map<Piece,Float64Array>(),boxes=(p:Piece)=>boxCache.get(p)??boxCache.set(p,triBoxes(p.tris)).get(p)!;
 // Open shells split by material (a muzzle running into a nose tip, a sleeve into a glove) share boundary edges: that is one
 // continuous surface, not two parts touching. Closed solids have no open edges, so edge-to-edge contact between solids still floats.
 const openEdges=pieces.map(piece=>{const t=piece.tris,key=(o:number)=>[0,1,2].map(c=>Math.round(t[o+c]!*1e5)).join(','),count=new Map<string,number>();
  for(let o=0;o<t.length;o+=9)for(let e=0;e<3;e++){const a=key(o+e*3),b=key(o+((e+1)%3)*3);if(a===b)continue;const k=a<b?a+'|'+b:b+'|'+a;count.set(k,(count.get(k)??0)+1);}
  return new Set([...count].filter(([,n])=>n===1).map(([k])=>k));});
 const seamed=(i:number,j:number)=>{const a=openEdges[i]!,b=openEdges[j]!;if(!a.size||!b.size)return false;let shared=0;for(const k of a)if(b.has(k)&&++shared>=3)return true;return false;};
 const sampleCache=new Map<number,V[]>(),samplesOf=(i:number)=>sampleCache.get(i)??sampleCache.set(i,samples(pieces[i]!,step)).get(i)!;
 const near=(a:Piece,b:Piece)=>[0,1,2].every(c=>a.min[c]!<=b.max[c]!+faceGap&&b.min[c]!<=a.max[c]!+faceGap);
 const memo=new Map<string,boolean>();
 const connected=(i:number,j:number)=>{const k=i<j?i+','+j:j+','+i;let r=memo.get(k);if(r!==undefined)return r;const a=pieces[i]!,b=pieces[j]!;
  r=near(a,b)&&(seamed(i,j)||surfacesMeet(a,b,touch,boxes)&&(samplesOf(i).some(p=>depthInside(p,b,minDepth))||samplesOf(j).some(p=>depthInside(p,a,minDepth))||faceContactArea(a,b,faceGap,minContactArea)>=minContactArea));memo.set(k,r);return r;};
 const grounded=new Set<number>(),queue:number[]=[];pieces.forEach((p,i)=>{if(p.min[1]<=ground){grounded.add(i);queue.push(i);}});
 while(queue.length){const i=queue.pop()!;pieces.forEach((p,j)=>{if(!grounded.has(j)&&connected(i,j)){grounded.add(j);queue.push(j);}});}
 const out=pieces.filter((p,i)=>!grounded.has(i)).map(({part,min,max})=>({part,min,max})) as Array<{part:string;min:V;max:V;end?:boolean}>;
 // Tying members (rods, straps, braces, ties, stretchers) must be anchored at BOTH ends: one embedded end does not stop the other
 // hovering. Cantilevers (branches, arms, handles) legitimately have a free end, so only members named as ties are checked.
 pieces.forEach((piece,i)=>{
  if(!grounded.has(i)||!tieMember.test(piece.part))return;const t=piece.tris,nv=t.length/3;if(nv>600)return;
  let e0:V=[0,0,0],e1:V=[0,0,0],L=0;
  for(let a=0;a<nv;a++)for(let b=a+1;b<nv;b++){const d=Math.hypot(t[a*3]!-t[b*3]!,t[a*3+1]!-t[b*3+1]!,t[a*3+2]!-t[b*3+2]!);if(d>L){L=d;e0=[t[a*3]!,t[a*3+1]!,t[a*3+2]!];e1=[t[b*3]!,t[b*3+1]!,t[b*3+2]!];}}
  const ax:V=[(e1[0]-e0[0])/L,(e1[1]-e0[1])/L,(e1[2]-e0[2])/L];let th=0;
  for(let a=0;a<nv;a++){const q=sub([t[a*3]!,t[a*3+1]!,t[a*3+2]!],e0),u=dot(q,ax);th=Math.max(th,Math.hypot(q[0]-ax[0]*u,q[1]-ax[1]*u,q[2]-ax[2]*u));}
  if(L<0.05||L<6*th)return;
  const reach=Math.max(th*1.5,0.01),depth=/strap|band/.test(piece.part)?minDepth:tieDepth;
  for(const end of [0,1]){
   const near_=(p:V)=>{const u=dot(sub(p,e0),ax);return end?u>=L-reach:u<=reach;};
   const pts=samplesOf(i).filter(near_);
   const endTris=(()=>{const keep:number[]=[];for(let o=0;o<t.length;o+=9){if(near_([t[o]!,t[o+1]!,t[o+2]!])&&near_([t[o+3]!,t[o+4]!,t[o+5]!])&&near_([t[o+6]!,t[o+7]!,t[o+8]!]))for(let k=0;k<9;k++)keep.push(t[o+k]!);}return {...piece,tris:Float64Array.from(keep)};})();
   const anchored=pieces.some((other,j)=>j!==i&&near(piece,other)&&(pts.some(p=>depthInside(p,other,depth))||samplesOf(j).some(p=>near_(p)&&depthInside(p,piece,depth))||(endTris.tris.length>0&&faceContactArea(endTris,other,faceGap,Math.min(minContactArea,th*th))>=Math.min(minContactArea,th*th))))
     ||(end?e1:e0)[1]<=ground;
   if(!anchored)out.push({part:piece.part+(end?':end-b':':end-a'),min:piece.min,max:piece.max,end:true});
  }
  // Straps and bands lie ON a surface: in every stretch along their length a real share of the strap (its inner face) must be within
  // strapGap of another part. Touching along one edge (a straight strap on a splayed board) is a gap.
  if(/(^|[_-])(strap|band)([_-]|$)/.test(piece.part)){
   // Group side faces by normal; the inner face is the broad side that touches most. Its samples must be close in every stretch.
   const sides=new Map<string,{n:V;pts:V[]}>();
   for(let o=0;o<t.length;o+=9){const a:V=[t[o]!,t[o+1]!,t[o+2]!],c=cross(sub([t[o+3]!,t[o+4]!,t[o+5]!],a),sub([t[o+6]!,t[o+7]!,t[o+8]!],a)),l=Math.hypot(...c);if(l<1e-12)continue;
    const n:V=[c[0]/l,c[1]/l,c[2]/l];if(Math.abs(dot(n,ax))>0.3)continue;const k=n.map(v=>Math.round(v*8)).join(',');const g=sides.get(k)??sides.set(k,{n,pts:[]}).get(k)!;
    const sub1:Piece={...piece,tris:t.slice(o,o+9)};g.pts.push(...samples(sub1,step));}
   const others=pieces.filter((o,j)=>j!==i&&near(piece,o));
   const close=(p:V)=>others.some(o=>{if(inside(p,o))return true;for(let k=0;k<o.tris.length;k+=9)if(pointTriDistance(p,o.tris,k)<=strapGap)return true;return false;});
   let best=0,detail='';
   for(const g of sides.values()){const hit=new Array<number>(8).fill(0),all=new Array<number>(8).fill(0);
    for(const p of g.pts){const b=Math.min(7,Math.max(0,Math.floor(dot(sub(p,e0),ax)/L*8)));all[b]!++;if(close(p))hit[b]!++;}
    const w=Math.min(...hit.map((h,b)=>all[b]?h/all[b]!:0));if(w>best){best=w;detail=hit.map((h,b)=>(h/all[b]!).toFixed(2)).join(' ');}}
   if(best<0.6)out.push({part:piece.part+':gap',min:piece.min,max:piece.max,end:true});
  }
 });
 return out;
}

export interface Interpenetration {a:string;b:string;kind:'poke-through'|'sibling';depth:number;at:V}
/**
 * Visible interpenetrations that are not joints:
 *  - poke-through: a tie member (brace, strap, rod, stretcher, tie, rung, crossbar, diagonal) runs INTO another piece and out the
 *    far side, so its end sticks out 2-50 mm past the post it should stop inside (crate braces). Checked along the member's centre
 *    line at both ends; a tip hidden inside a third piece or below the ground is not visible and not reported.
 *  - sibling: two pieces of the same family (same part-name stem, e.g. cap_0/cap_2, after dropping trailing indices) and the same
 *    material cut into each other by more than siblingDepth, leaving a visible intersection crease (mushroom caps).
 */
export function interpenetrations(scene:Pick<ReadScene,'meshes'>,{step=0.002,minPoke=0.002,maxPoke=0.05,siblingDepth=0.003,siblings=/^(cap|envelope|shield|crate|barrel|book|bottle|jar)$/}:{step?:number;minPoke?:number;maxPoke?:number;siblingDepth?:number;siblings?:RegExp}={}):Interpenetration[]{
 const pieces=buildPieces(scene),out:Interpenetration[]=[];
 const near=(a:Piece,b:Piece,pad=0)=>[0,1,2].every(c=>a.min[c]!<=b.max[c]!+pad&&b.min[c]!<=a.max[c]!+pad);
 const solid=(p:Piece)=>{const t=p.tris,key=(o:number)=>[0,1,2].map(c=>Math.round(t[o+c]!*1e5)).join(','),cnt=new Map<string,number>();
  for(let o=0;o<t.length;o+=9)for(let e=0;e<3;e++){const a=key(o+e*3),b=key(o+((e+1)%3)*3);if(a===b)continue;const k=a<b?a+'|'+b:b+'|'+a;cnt.set(k,(cnt.get(k)??0)+1);}
  return [...cnt.values()].every(n=>n===2);};
 const closed=pieces.map(solid);
 pieces.forEach((piece,i)=>{
  const t=piece.tris,nv=t.length/3;if(nv>600||!tieMember.test(piece.part))return;
  let e0:V=[0,0,0],e1:V=[0,0,0],L=0;
  for(let a=0;a<nv;a++)for(let b=a+1;b<nv;b++){const d=Math.hypot(t[a*3]!-t[b*3]!,t[a*3+1]!-t[b*3+1]!,t[a*3+2]!-t[b*3+2]!);if(d>L){L=d;e0=[t[a*3]!,t[a*3+1]!,t[a*3+2]!];e1=[t[b*3]!,t[b*3+1]!,t[b*3+2]!];}}
  if(L<0.05)return;
  // principal axis from end-cluster centroids (robust for boxes, whose farthest pair is corner to corner)
  const ax0:V=[(e1[0]-e0[0])/L,(e1[1]-e0[1])/L,(e1[2]-e0[2])/L],us:number[]=[];for(let a=0;a<nv;a++)us.push(dot(sub([t[a*3]!,t[a*3+1]!,t[a*3+2]!],e0),ax0));
  const umin=Math.min(...us),umax=Math.max(...us),span=umax-umin,cen=(lo:number,hi:number)=>{const c:V=[0,0,0];let k=0;for(let a=0;a<nv;a++)if(us[a]!>=lo&&us[a]!<=hi){c[0]+=t[a*3]!;c[1]+=t[a*3+1]!;c[2]+=t[a*3+2]!;k++;}return [c[0]/k,c[1]/k,c[2]/k] as V;};
  const c0=cen(umin,umin+span*0.05),c1=cen(umax-span*0.05,umax),La=Math.hypot(...sub(c1,c0));if(La<0.05)return;
  const ax:V=[(c1[0]-c0[0])/La,(c1[1]-c0[1])/La,(c1[2]-c0[2])/La];let th=0;
  for(let a=0;a<nv;a++){const q=sub([t[a*3]!,t[a*3+1]!,t[a*3+2]!],c0),u=dot(q,ax);th=Math.max(th,Math.hypot(q[0]-ax[0]*u,q[1]-ax[1]*u,q[2]-ax[2]*u));}
  if(La<5*th)return;
  pieces.forEach((other,j)=>{
   if(j===i||other.part===piece.part||!closed[j]||!near(piece,other))return;
   for(const end of [0,1]){
    const tip=end?c1:c0,dir:V=end?[-ax[0],-ax[1],-ax[2]]:ax,at=(d:number):V=>[tip[0]+dir[0]*d,tip[1]+dir[1]*d,tip[2]+dir[2]*d];
    // tip outside `other`, then (moving inward) inside it, i.e. the end has passed through and out.
    if(inside(at(0.0005),other)){
     // The end stops inside `other` (a post): its corners must too. A square-cut diagonal brace whose end corners overhang the post
     // "runs past" it.
     let worst=0,wp:V=tip;
     for(let a=0;a<nv;a++){const q:V=[t[a*3]!,t[a*3+1]!,t[a*3+2]!],u=dot(sub(q,tip),dir);if(u>th*1.5)continue;
      if(inside(q,other)||q[1]<0||pieces.some((o,k)=>k!==i&&k!==j&&closed[k]&&inside(q,o)))continue;
      let d=Infinity;for(let o=0;o<other.tris.length;o+=9)d=Math.min(d,pointTriDistance(q,other.tris,o));if(d>worst&&d<maxPoke){worst=d;wp=q;}}
     if(worst>=minPoke)out.push({a:piece.part,b:other.part,kind:'poke-through',depth:worst,at:wp});
     continue;}
    let out0=0.0005;while(out0<La/2&&!inside(at(out0),other))out0+=step;
    if(out0>=La/2||out0<minPoke)continue;let thick=0;while(out0+thick<La/2&&inside(at(out0+thick),other))thick+=step;
    if(out0>maxPoke||thick<step*2||out0+thick>=La/2)continue;
    const tipP=at(0.0005);if(tipP[1]<0||pieces.some((o,k)=>k!==i&&k!==j&&closed[k]&&inside(tipP,o)))continue;
    out.push({a:piece.part,b:other.part,kind:'poke-through',depth:out0,at:at(out0)});
   }
  });
 });
 const stem=(n:string)=>n.replace(/([_-]+\d+)+$/,'').replace(/^.*[_-](?=[a-z]+$)/,'');
 for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
  const a=pieces[i]!,b=pieces[j]!;if(a.part===b.part&&a.group===b.group)continue;
  if(a.material!==b.material||!siblings.test(stem(a.part))||stem(a.part)!==stem(b.part)||!closed[i]||!closed[j]||!near(a,b))continue;
  let deep=0,where:V=[0,0,0];
  for(const [p,q] of [[a,b],[b,a]] as Array<[Piece,Piece]>){for(const s of samples(p,0.004))if(depthInside(s,q,siblingDepth)){deep=siblingDepth;where=s;break;}if(deep)break;}
  if(deep)out.push({a:a.part,b:b.part,kind:'sibling',depth:deep,at:where});
 }
 return out;
}
export interface LayoutDefect {kind:'pierce'|'overhang'|'step'|'gap'|'short-foot';a:string;b?:string;depth:number;at:V}
/** Principal axis of an elongated piece (end-cluster centroids), or undefined when it is not at least `ratio` times longer than thick. */
function memberAxis(t:Float64Array,ratio:number):{c0:V;c1:V;ax:V;length:number;thickness:number}|undefined{
 const nv=t.length/3;if(nv<4||nv>2000)return undefined;
 let e0:V=[0,0,0],e1:V=[0,0,0],L=0;const stride=Math.max(1,Math.floor(nv/300));
 for(let a=0;a<nv;a+=stride)for(let b=a+1;b<nv;b+=stride){const d=Math.hypot(t[a*3]!-t[b*3]!,t[a*3+1]!-t[b*3+1]!,t[a*3+2]!-t[b*3+2]!);if(d>L){L=d;e0=[t[a*3]!,t[a*3+1]!,t[a*3+2]!];e1=[t[b*3]!,t[b*3+1]!,t[b*3+2]!];}}
 if(L<0.05)return undefined;
 const ax0:V=[(e1[0]-e0[0])/L,(e1[1]-e0[1])/L,(e1[2]-e0[2])/L],us:number[]=[];for(let a=0;a<nv;a++)us.push(dot(sub([t[a*3]!,t[a*3+1]!,t[a*3+2]!],e0),ax0));
 const umin=Math.min(...us),umax=Math.max(...us),span=umax-umin,cen=(lo:number,hi:number)=>{const c:V=[0,0,0];let k=0;for(let a=0;a<nv;a++)if(us[a]!>=lo&&us[a]!<=hi){c[0]+=t[a*3]!;c[1]+=t[a*3+1]!;c[2]+=t[a*3+2]!;k++;}return [c[0]/k,c[1]/k,c[2]/k] as V;};
 const c0=cen(umin,umin+span*0.05),c1=cen(umax-span*0.05,umax),length=Math.hypot(...sub(c1,c0));if(length<0.05)return undefined;
 const ax:V=[(c1[0]-c0[0])/length,(c1[1]-c0[1])/length,(c1[2]-c0[2])/length];let thickness=0;
 for(let a=0;a<nv;a++){const q=sub([t[a*3]!,t[a*3+1]!,t[a*3+2]!],c0),u=dot(q,ax);thickness=Math.max(thickness,Math.hypot(q[0]-ax[0]*u,q[1]-ax[1]*u,q[2]-ax[2]*u));}
 return length>=ratio*thickness?{c0,c1,ax,length,thickness}:undefined;
}
/**
 * Layout defects a reviewer sees but the contact detectors miss:
 *  - pierce: part of a piece lies on the far side of a closed piece it should stop against or rest inside. From the piece's centroid
 *    (outside the other piece), a vertex is reached only by entering and leaving the other piece, and it stands >= minPierce past its
 *    far face (leaning books through a bookcase side, a punt pole through the transoms, cockpit benches through the hull planking).
 *    Pieces wrapped around another (centroid inside it) are hoops, not pierces.
 *  - overhang: a piece standing on a thin support (<= 80 mm thick: a shelf or board) reaches > maxOverhang past the support's edge
 *    (flasks wider than their rack shelf).
 *  - step / gap: a run of >= 6 like boards (same name stem and material, thin and horizontal) whose neighbours' tops differ by
 *    stepMin-0.1 m (a trip step) or whose spacing jumps past 1.6x the usual pitch (a missing board exposing the joists).
 *  - short-foot: a leaning member (ladder stile, tail pole) whose foot stops stepMin-0.1 m above the ground with nothing under it.
 */
/** Loose items by full name stem (pole, bench, handles), or by last word for kinds that come prefixed (floor_jar, bottle). */
export const looseItem=/^(book|bottle|jar|crock|pot|urn|flask|vial|pole|bench|oar|paddle|basket|candle|cup|mug|jug|handles)$/,looseKind=/^(book|bottle|jar|crock|urn|flask|vial|oar)$/,deckBoard=/^(plank|board|deck_board|deck_plank|slat|tread)$/;
export function layoutDefects(scene:Pick<ReadScene,'meshes'>,{minPierce=0.002,maxOverhang=0.008,stepMin=0.004,items=looseItem,boards=deckBoard}:{minPierce?:number;maxOverhang?:number;stepMin?:number;items?:RegExp;boards?:RegExp}={}):LayoutDefect[]{
 const pieces=buildPieces(scene),out:LayoutDefect[]=[];
 // name stem without trailing indices and side suffixes (book_12 -> book, floor_jar_2 -> jar, deck_board_3 -> deck_board)
 const stem=(n:string)=>n.replace(/([_-]+-?\d+)+$/,''),tail=(n:string)=>stem(n).replace(/^.*[_-](?=[a-z]+$)/,''),isItem=(n:string)=>items.test(stem(n))||looseKind.test(tail(n));
 const near=(a:Piece,b:Piece,pad=0)=>[0,1,2].every(c=>a.min[c]!<=b.max[c]!+pad&&b.min[c]!<=a.max[c]!+pad);
 const closedEdges=(p:Piece)=>{const t=p.tris,key=(o:number)=>[0,1,2].map(c=>Math.round(t[o+c]!*1e5)).join(','),cnt=new Map<string,number>();
  for(let o=0;o<t.length;o+=9)for(let e=0;e<3;e++){const a=key(o+e*3),b=key(o+((e+1)%3)*3);if(a===b)continue;const k=a<b?a+'|'+b:b+'|'+a;cnt.set(k,(cnt.get(k)??0)+1);}
  return [...cnt.values()].every(n=>n===2);};
 const closed=pieces.map(closedEdges),vertices=(p:Piece)=>{const t=p.tris,seen=new Set<string>(),vs:V[]=[];for(let o=0;o<t.length;o+=3){const v:V=[t[o]!,t[o+1]!,t[o+2]!],k=v.map(x=>Math.round(x*1e5)).join(',');if(!seen.has(k)){seen.add(k);vs.push(v);}}return vs;};
 const verts=pieces.map(vertices),centroid=verts.map(vs=>{const c:V=[0,0,0];for(const v of vs){c[0]+=v[0];c[1]+=v[1];c[2]+=v[2];}return [c[0]/vs.length,c[1]/vs.length,c[2]/vs.length] as V;});
 const crossings=(p:V,q:V,piece:Piece)=>{let n=0;for(let o=0;o<piece.tris.length;o+=9)if(segTri(p,q,piece.tris,o))n++;return n;};
 const surfaceDistance=(p:V,piece:Piece)=>{let d=Infinity;for(let o=0;o<piece.tris.length;o+=9)d=Math.min(d,pointTriDistance(p,piece.tris,o));return d;};
 // pierce
 pieces.forEach((a,i)=>{
  if(verts[i]!.length>1500||!isItem(a.part))return;
  pieces.forEach((b,j)=>{
   if(i===j||a.part===b.part||tail(a.part)===tail(b.part)||!closed[j]||!near(a,b,0.5)||b.tris.length/9>4000)return;
   const c=centroid[i]!;if(inside(c,b))return;
   let worst=0,where:V=c;
   for(const v of verts[i]!){
    if(v[1]<0.001||inside(v,b)||crossings(c,v,b)<2)continue;
    if(pieces.some((o,k)=>k!==i&&k!==j&&closed[k]&&inside(v,o)))continue;
    const d=surfaceDistance(v,b);if(d>worst){worst=d;where=v;}}
   if(worst>=minPierce)out.push({kind:'pierce',a:a.part,b:b.part,depth:worst,at:where});
  });
 });
 // overhang
 pieces.forEach((s,j)=>{
  const th=s.max[1]!-s.min[1]!;if(!closed[j]||th>0.08||Math.min(s.max[0]!-s.min[0]!,s.max[2]!-s.min[2]!)<th*3)return;
  pieces.forEach((r,i)=>{
   if(i===j||r.part===s.part||!isItem(r.part)||tail(r.part)===tail(s.part)||r.min[1]!<s.max[1]!-0.006||r.min[1]!>s.max[1]!+0.003)return;
   const cx=(r.min[0]!+r.max[0]!)/2,cz=(r.min[2]!+r.max[2]!)/2;if(cx<s.min[0]!||cx>s.max[0]!||cz<s.min[2]!||cz>s.max[2]!)return;
   const over=Math.max(s.min[0]!-r.min[0]!,r.max[0]!-s.max[0]!,s.min[2]!-r.min[2]!,r.max[2]!-s.max[2]!);
   if(over>maxOverhang&&over<(r.max[1]!-r.min[1]!)*2)out.push({kind:'overhang',a:r.part,b:s.part,depth:over,at:[cx,s.max[1]!,cz]});
  });
 });
 // step / gap among like boards
const groups=new Map<string,number[]>();
 pieces.forEach((p,i)=>{const e=[0,1,2].map(c=>p.max[c]!-p.min[c]!);if(!boards.test(tail(p.part))&&!boards.test(stem(p.part).replace(/[_-]+\d+$/,''))||e[1]!>0.08||e[1]!>=Math.min(e[0]!,e[2]!)*0.5)return;const k=stem(p.part)+'|'+p.material;(groups.get(k)??groups.set(k,[]).get(k)!).push(i);});
 for(const [key,list] of groups){
  if(list.length<6)continue;
  const ext=(i:number,c:number)=>pieces[i]!.max[c]!-pieces[i]!.min[c]!,mid=(i:number,c:number)=>(pieces[i]!.max[c]!+pieces[i]!.min[c]!)/2;
  const spread=[0,2].map(c=>Math.max(...list.map(i=>mid(i,c)))-Math.min(...list.map(i=>mid(i,c)))),axis=spread[0]!>=spread[1]!?0:2,other=2-axis;
  // runs: boards that overlap across the walkway (same row of the deck)
  const sorted=[...list].sort((a,b)=>mid(a,axis)-mid(b,axis));
  const pitches:number[]=[];for(let k=1;k<sorted.length;k++)pitches.push(mid(sorted[k]!,axis)-mid(sorted[k-1]!,axis));
  const typical=[...pitches].sort((a,b)=>a-b)[Math.floor(pitches.length/2)]!;
  for(let k=1;k<sorted.length;k++){
   const a=sorted[k-1]!,b=sorted[k]!,pa=pieces[a]!,pb=pieces[b]!;
   if(pa.max[other]!<pb.min[other]!||pb.max[other]!<pa.min[other]!)continue;
   if(Math.abs(ext(a,axis)-ext(b,axis))>Math.max(ext(a,axis),ext(b,axis))*0.25)continue;
   const top=(q:number)=>pieces[sorted[q]!]!.max[1]!,inner=k>=2&&k+1<sorted.length,r0=inner?top(k-1)-top(k-2):0,r1=inner?top(k+1)-top(k):0,trend=Math.abs(r0)<Math.abs(r1)?r0:r1,rise=pb.max[1]!-pa.max[1]!,dTop=inner&&Math.abs(rise)>2*Math.abs(trend)?Math.min(Math.abs(rise-trend),Math.abs(rise-(r0+r1)/2)):0,at:V=[(mid(a,0)+mid(b,0))/2,Math.max(pa.max[1]!,pb.max[1]!),(mid(a,2)+mid(b,2))/2];
   // a step breaks the local slope: arched decks rise every board, so the rise must exceed twice the gentler neighbouring rise
   // (one raised board must not set its own trend) and differ from both it and the neighbours' mean (a smooth crown flattens fast)
   if(dTop>=stepMin&&dTop<0.1)out.push({kind:'step',a:pa.part,b:pb.part,depth:dTop,at});
   const gap=mid(b,axis)-mid(a,axis);if(typical>0&&gap>typical*1.6&&gap<typical*4&&pb.min[axis]!-pa.max[axis]!>ext(a,axis)*0.6)out.push({kind:'gap',a:pa.part,b:pb.part,depth:pb.min[axis]!-pa.max[axis]!,at});
  }
  void key;
 }
 // short-foot
 pieces.forEach((p,i)=>{
  const m=memberAxis(p.tris,6);if(!m||Math.abs(m.ax[1])<0.3||Math.abs(m.ax[1])>0.995)return;
  const low=p.min[1]!;if(low<stepMin||low>0.1)return;
  const foot=verts[i]!.filter(v=>v[1]<=low+0.02);
  const held=foot.some(v=>pieces.some((o,k)=>k!==i&&v[0]>=o.min[0]!-0.003&&v[0]<=o.max[0]!+0.003&&v[1]>=o.min[1]!-0.003&&v[1]<=o.max[1]!+0.003&&v[2]>=o.min[2]!-0.003&&v[2]<=o.max[2]!+0.003));
  if(!held)out.push({kind:'short-foot',a:p.part,depth:low,at:foot[0]!});
 });
 return out;
}

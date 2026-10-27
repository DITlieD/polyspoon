// Image detectors. Pure functions over RGBA pixels with no Node or DOM imports, so the SAME code runs inside the
// jailed renderer (where it actually executes, next to the hostile-file decoding) and in unit tests.
//
// What is real and what is a stand-in:
//  - hate-symbol-template-v2  REAL (heuristic). Rotation- and mirror-aware template matching on silhouettes,
//    dark-on-light and light-on-dark blobs, on every render, pass, crop and texture tile. Template bank: swastika
//    (thin to very thick/filled-in), triskelion/three-armed swastika, Wolfsangel, Sonnenrad (black sun).
//    All are chiral, so a chirality gate rejects mirror-symmetric look-alikes (plus signs, frames,
//    windows). Not covered: Odal rune (mirror-symmetric), SS double-sig runes (two separate blobs), Celtic/sun cross (too close to wheels and
//    rifle scopes for a template), stylised or heavily foreshortened forms. Humans and the vision second opinion cover those.
//  - nsfw-mobilenet-v2-v1  REAL. Open-weights NSFWJS MobileNetV2 classifier, run in the jail (see nsfw-model.ts).
//    It is asynchronous, so it lives in the renderer and not in this synchronous list.
//  - child-like-proportion-v1  REAL (heuristic). Head-to-height ratio of upright figure silhouettes; child and
//    chibi proportions score high. The policy only acts on it together with a sexual score, so a big-headed
//    mascot on its own is never flagged.
//  - nsfw-stub-v1 / child-like-stub-v1  kept only as the always-0 fallback the renderer reports when the
//    real classifier failed to load (and then the category is listed as not machine-checked).
import type {DetectorInfo} from './types.ts';
export interface Pixels{width:number;height:number;data:Uint8ClampedArray|Uint8Array}
export interface Detection{score:number;bbox?:[number,number,number,number];symbol?:string}
export interface ImageClassifier{info:DetectorInfo;category:'sexual'|'child_like'|'hate_symbol'|'violence';classify(px:Pixels):Detection}

export const nsfwStub:ImageClassifier={category:'sexual',info:{id:'nsfw-stub-v1',version:'1',real:false,categories:['sexual'],note:'Stub: always 0. Replace with an open-weights NSFW image classifier run in the jail.'},classify:()=>({score:0})};
export const childLikeStub:ImageClassifier={category:'child_like',info:{id:'child-like-stub-v1',version:'1',real:false,categories:['child_like'],note:'Stub: always 0. Replace with a figure-proportion / age-likeness classifier run in the jail.'},classify:()=>({score:0})};

export const childLikeHeuristic:ImageClassifier={category:'child_like',info:{id:'child-like-proportion-v1',version:'1',real:true,categories:['child_like'],note:'Heuristic: head-to-height ratio of upright figure silhouettes (child/chibi proportions). Acts only together with a sexual score.'},classify:childLikeScan};

const N=32,WORDS=N*N/32;
type Bits=Uint32Array;
function pack(grid:Uint8Array):Bits{const b=new Uint32Array(WORDS);for(let i=0;i<N*N;i++)if(grid[i])b[i>>5]!|=1<<(i&31);return b;}
function pop(x:number){x-=(x>>>1)&0x55555555;x=(x&0x33333333)+((x>>>2)&0x33333333);return (((x+(x>>>4))&0x0f0f0f0f)*0x01010101)>>>24;}
function iou(a:Bits,b:Bits){let i=0,u=0;for(let k=0;k<WORDS;k++){i+=pop(a[k]!&b[k]!);u+=pop(a[k]!|b[k]!);}return u?i/u:0;}
/** Resample the pixels of one blob into an N×N grid over its bbox, expanded to a centred square. */
function sample(label:Int32Array,id:number,w:number,box:[number,number,number,number]):Uint8Array{
 const [x0,y0,x1,y1]=box,side=Math.max(x1-x0+1,y1-y0+1),cx=(x0+x1+1)/2,cy=(y0+y1+1)/2,grid=new Uint8Array(N*N);
 for(let gy=0;gy<N;gy++)for(let gx=0;gx<N;gx++){
  let hit=0,total=0;
  for(let sy=0;sy<3;sy++)for(let sx=0;sx<3;sx++){const x=Math.floor(cx-side/2+(gx+(sx+0.5)/3)*side/N),y=Math.floor(cy-side/2+(gy+(sy+0.5)/3)*side/N);total++;if(x>=x0&&x<=x1&&y>=y0&&y<=y1&&label[y*w+x]===id)hit++;}
  grid[gy*N+gx]=hit*2>total?1:0;
 }
 return grid;
}
type Shape=(x:number,y:number,t:number)=>boolean;
const bar=(x:number,y:number,x0:number,y0:number,x1:number,y1:number,t:number)=>{const dx=x1-x0,dy=y1-y0,l=dx*dx+dy*dy,k=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/l)),ex=x0+k*dx-x,ey=y0+k*dy-y;return ex*ex+ey*ey<=t*t;};
/** Swastika; `t` is the half arm width. Hooks are 2t wide, so at t→1/3 the gaps close (very thick, near-filled forms). */
export const swastikaShape:Shape=(x,y,t)=>(Math.abs(x)<=t&&Math.abs(y)<=1)||(Math.abs(y)<=t&&Math.abs(x)<=1)||(y>=1-2*t&&y<=1&&x>=0&&x<=1)||(x>=1-2*t&&x<=1&&y<=0&&y>=-1)||(y<=-1+2*t&&y>=-1&&x<=0&&x>=-1)||(x<=-1+2*t&&x>=-1&&y>=0&&y<=1);
/** Three-armed hooked cross (triskelion form used by white-supremacist groups). */
export const triskelionShape:Shape=(x,y,t)=>{for(let k=0;k<3;k++){const a=k*2*Math.PI/3,c=Math.cos(a),s=Math.sin(a),ex=0.95*c,ey=0.95*s,hx=ex+0.75*Math.cos(a+Math.PI/2),hy=ey+0.75*Math.sin(a+Math.PI/2);if(bar(x,y,0,0,ex,ey,t)||bar(x,y,ex,ey,hx,hy,t))return true;}return false;};
/** Wolfsangel: a Z/N hook with a crossbar through the middle. */
export const wolfsangelShape:Shape=(x,y,t)=>bar(x,y,-0.55,-1,0.55,-1,t)||bar(x,y,0.55,-1,-0.55,1,t)||bar(x,y,-0.55,1,0.55,1,t)||bar(x,y,-0.9,0,0.9,0,t);
/** Sonnenrad / black sun: a disc with twelve bent (sig-rune) arms. */
export const sonnenradShape:Shape=(x,y,t)=>{if(x*x+y*y<=0.12)return true;for(let k=0;k<12;k++){const a=k*Math.PI/6,m=a+0.35,mx=0.6*Math.cos(m),my=0.6*Math.sin(m),ox=0.98*Math.cos(a+0.05),oy=0.98*Math.sin(a+0.05);if(bar(x,y,0.3*Math.cos(a),0.3*Math.sin(a),mx,my,t*0.55)||bar(x,y,mx,my,ox,oy,t*0.55))return true;}return false;};
function raster(shape:Shape,theta:number,t:number,mirror:boolean){
 const R=128,label=new Int32Array(R*R),c=Math.cos(theta),s=Math.sin(theta);let x0=R,y0=R,x1=-1,y1=-1;
 for(let py=0;py<R;py++)for(let px=0;px<R;px++){
  const ux=(px+0.5)/R*3.2-1.6,uy=(py+0.5)/R*3.2-1.6;let x=c*ux+s*uy,y=-s*ux+c*uy;if(mirror)x=-x;
  if(shape(x,y,t)){label[py*R+px]=1;x0=Math.min(x0,px);y0=Math.min(y0,py);x1=Math.max(x1,px);y1=Math.max(y1,py);}
 }
 return pack(sample(label,1,R,[x0,y0,x1,y1]));
}
/** Symbol families: shape, thicknesses, rotational period (degrees) and angle step. */
export const SYMBOLS:{name:string;shape:Shape;thick:number[];period:number;step:number}[]=[
 {name:'swastika',shape:swastikaShape,thick:[0.13,0.19,0.24,0.28,0.31],period:90,step:3},
 {name:'triskelion',shape:triskelionShape,thick:[0.12,0.2,0.28],period:120,step:4},
 {name:'wolfsangel',shape:wolfsangelShape,thick:[0.1,0.16,0.22],period:180,step:4},
 {name:'sonnenrad',shape:sonnenradShape,thick:[0.16,0.24],period:30,step:3},
];
let templates:{bits:Bits;mirror:boolean;symbol:string}[]|null=null;
function allTemplates(){if(!templates){templates=[];for(const f of SYMBOLS)for(const t of f.thick)for(let a=0;a<f.period;a+=f.step)for(const mirror of [false,true])templates.push({bits:raster(f.shape,a*Math.PI/180,t,mirror),mirror,symbol:f.name});}return templates;}
/** Area of the blob over the area of its convex hull, on the N×N grid. A swastika is far from convex (~0.5);
 *  filled faces, rhombi and hexagons from ordinary boxes are ~1, which keeps them from matching. */
function solidity(grid:Uint8Array){
 const pts:[number,number][]=[];let area=0;for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(grid[y*N+x]){area++;pts.push([x,y],[x+1,y],[x,y+1],[x+1,y+1]);}
 if(area<4)return 1;pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o:number[],a:number[],b:number[])=>(a[0]!-o[0]!)*(b[1]!-o[1]!)-(a[1]!-o[1]!)*(b[0]!-o[0]!);
 const lower:number[][]=[],upper:number[][]=[];for(const p of pts){while(lower.length>=2&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p);}for(const p of pts.reverse()){while(upper.length>=2&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p);}
 const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];let h=0;for(let i=0;i<hull.length;i++){const a=hull[i]!,b=hull[(i+1)%hull.length]!;h+=a[0]!*b[1]!-b[0]!*a[1]!;}
 return area/Math.max(1,Math.abs(h)/2);
}
function otsu(lum:Uint8Array){const h=new Array(256).fill(0);for(const v of lum)h[v]++;const total=lum.length;let sum=0;for(let i=0;i<256;i++)sum+=i*h[i];let sb=0,wb=0,best=0,th=128;for(let i=0;i<256;i++){wb+=h[i];if(!wb)continue;const wf=total-wb;if(!wf)break;sb+=i*h[i];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)**2;if(v>best){best=v;th=i;}}return th;}
function components(mask:Uint8Array,w:number,h:number){
 const label=new Int32Array(w*h),out:{id:number;count:number;box:[number,number,number,number]}[]=[];let next=0;const stack:number[]=[];
 for(let i=0;i<w*h;i++){if(!mask[i]||label[i])continue;next++;let count=0,x0=w,y0=h,x1=0,y1=0;stack.push(i);label[i]=next;
  while(stack.length){const p=stack.pop()!,x=p%w,y=(p-x)/w;count++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
   for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]&&!label[q]){label[q]=next;stack.push(q);}}
  out.push({id:next,count,box:[x0,y0,x1,y1]});}
 return {label,out};
}
const M=96;
/** The blob resampled to M×M, eroded at a few depths (chamfer distance transform), each reduced to N×N. */
function eroded(label:Int32Array,id:number,w:number,box:[number,number,number,number]):Uint8Array[]{
 const [x0,y0,x1,y1]=box,side=Math.max(x1-x0+1,y1-y0+1),cx=(x0+x1+1)/2,cy=(y0+y1+1)/2,d=new Float32Array(M*M);
 for(let gy=0;gy<M;gy++)for(let gx=0;gx<M;gx++){const x=Math.floor(cx-side/2+(gx+0.5)*side/M),y=Math.floor(cy-side/2+(gy+0.5)*side/M);d[gy*M+gx]=x>=x0&&x<=x1&&y>=y0&&y<=y1&&label[y*w+x]===id?1e9:0;}
 for(let y=0;y<M;y++)for(let x=0;x<M;x++){const i=y*M+x;if(!d[i])continue;const up=y?d[i-M]!:0,left=x?d[i-1]!:0;d[i]=Math.min(d[i]!,up+1,left+1,y&&x?d[i-M-1]!+1.4:1.4,y&&x<M-1?d[i-M+1]!+1.4:1.4);}
 for(let y=M-1;y>=0;y--)for(let x=M-1;x>=0;x--){const i=y*M+x;if(!d[i])continue;const dn=y<M-1?d[i+M]!:0,rt=x<M-1?d[i+1]!:0;d[i]=Math.min(d[i]!,dn+1,rt+1,y<M-1&&x<M-1?d[i+M+1]!+1.4:1.4,y<M-1&&x?d[i+M-1]!+1.4:1.4);}
 const out:Uint8Array[]=[];
 for(const depth of [3,5,7]){const grid=new Uint8Array(N*N),k=M/N;let any=0;for(let gy=0;gy<N;gy++)for(let gx=0;gx<N;gx++){let hit=0;for(let sy=0;sy<k;sy++)for(let sx=0;sx<k;sx++)if(d[(gy*k+sy)*M+gx*k+sx]!>depth)hit++;if(hit*2>k*k){grid[gy*N+gx]=1;any++;}}
  if(any>=12){// re-centre on the eroded blob's own bbox, like `sample` does for raw blobs
   let a=N,b=N,c=-1,e=-1;for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(grid[y*N+x]){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);e=Math.max(e,y);}
   const lab=new Int32Array(N*N);for(let i=0;i<N*N;i++)lab[i]=grid[i]!;out.push(sample(lab,1,N,[a,b,c,e]));}}
 return out;
}
/** Best symbol match over every candidate blob in the image. Score = rescaled IoU against the template bank. */
export function hateSymbolScan(px:Pixels):Detection{
 const {width:w,height:h,data}=px,n=w*h,lum=new Uint8Array(n),alpha=new Uint8Array(n);let transparent=0;
 for(let i=0;i<n;i++){lum[i]=(data[i*4]!*299+data[i*4+1]!*587+data[i*4+2]!*114)/1000|0;alpha[i]=data[i*4+3]!>=128?1:0;if(!alpha[i])transparent++;}
 const th=otsu(lum),dark=new Uint8Array(n),light=new Uint8Array(n);for(let i=0;i<n;i++){if(!alpha[i])continue;if(lum[i]!<=th)dark[i]=1;else light[i]=1;}
 const masks=[dark,light];if(transparent>n*0.02)masks.unshift(alpha);
 let best:Detection={score:0};const bank=allTemplates();
 for(const mask of masks){
  const {label,out}=components(mask,w,h);
  const candidates=out.filter(c=>{const bw=c.box[2]-c.box[0]+1,bh=c.box[3]-c.box[1]+1,fill=c.count/(bw*bh);return bw>=14&&bh>=14&&c.count>=n*0.001&&c.count<=n*0.9&&bw/bh>0.6&&bw/bh<1.67&&fill>0.12&&fill<0.93;}).sort((a,b)=>b.count-a.count).slice(0,12);
  for(const c of candidates){
   const raw=sample(label,c.id,w,c.box);const solid=solidity(raw);
   // Thin and normal forms are matched directly. Very thick, near-filled forms (where the mirror image overlaps
   // almost as well) are also matched after eroding them with a distance transform, which thins the arms back
   // to a normal stroke while keeping the chiral notches; the filled-face convexity gate still applies first.
   const grids:Uint8Array[]=solid<=0.9?[raw]:[];
   if(solid>0.6&&solid<=0.97)grids.push(...eroded(label,c.id,w,c.box));
   for(const grid of grids){const g=pack(grid);const hand=new Map<string,[number,number]>();
    for(const t of bank){const v=iou(g,t.bits),k=t.mirror?1:0,h=hand.get(t.symbol)??[0,0];if(v>h[k]!)h[k]=v;hand.set(t.symbol,h);}
    // Chirality gate: every template symbol matches one handedness much better than its mirror image. Mirror-symmetric
    // shapes (frames, plus signs, windows, H shapes) match both equally and are discounted to nothing.
    for(const [symbol,h] of hand){const m=Math.max(h[0],h[1]),gap=Math.abs(h[0]-h[1]),score=Math.max(0,Math.min(1,(m-0.45)/0.45))*Math.min(1,gap/0.15);if(score>best.score)best={score,bbox:c.box,symbol};}}
  }
 }
 return best;
}
export const hateSymbol:ImageClassifier={category:'hate_symbol',info:{id:'hate-symbol-template-v2',version:'2',real:true,categories:['hate_symbol'],note:'Heuristic chiral template matcher: swastika (thin to filled), triskelion, Wolfsangel, Sonnenrad. Odal, SS runes and Celtic cross not covered.'},classify:hateSymbolScan};
/** Synchronous pixel classifiers run on every analysed image. The NSFW classifier is asynchronous (TensorFlow.js)
 *  and is run by the renderer separately; nsfwStub is only reported when it failed to load. */
export const IMAGE_CLASSIFIERS:ImageClassifier[]=[childLikeHeuristic,hateSymbol];

/** Child-like proportions on a silhouette (alpha mask of an unlit view). Finds the largest upright blob, walks the
 *  row-width profile from the top to find the neck (a narrowing under the head followed by wider shoulders), and
 *  maps the head-to-height ratio to a score: adult ≈ 1/7–1/8 → 0, child ≈ 1/4–1/5 and chibi → near 1. */
export function childLikeScan(px:Pixels):Detection{
 const {width:w,height:h,data}=px,n=w*h,mask=new Uint8Array(n);let transparent=0;
 for(let i=0;i<n;i++){if(data[i*4+3]!>=128)mask[i]=1;else transparent++;}
 if(transparent<n*0.05)return {score:0};
 const {label,out}=components(mask,w,h);const big=out.sort((a,b)=>b.count-a.count)[0];if(!big||big.count<n*0.01)return {score:0};
 const [x0,y0,x1,y1]=big.box,H=y1-y0+1,W=x1-x0+1;if(H<48||H<1.3*W)return {score:0};
 const rows=new Array<number>(H).fill(0);for(let y=y0;y<=y1;y++){let a=-1,b=-1;for(let x=x0;x<=x1;x++)if(label[y*w+x]===big.id){if(a<0)a=x;b=x;}rows[y-y0]=a<0?0:b-a+1;}
 const smooth=rows.map((_,i)=>{let s=0,c=0;for(let k=Math.max(0,i-1);k<=Math.min(H-1,i+1);k++){s+=rows[k]!;c++;}return s/c;});
 let headMax=0,best=0;
 for(let y=Math.floor(H*0.06);y<Math.floor(H*0.55);y++){
  headMax=Math.max(headMax,...smooth.slice(0,y));const neck=smooth[y]!;
  if(headMax<W*0.12||neck>headMax*0.8)continue;
  const below=Math.max(...smooth.slice(y,Math.min(H,y+Math.ceil(H*0.15))));if(below<neck*1.25)continue;
  let neckY=y;for(let k=y;k<Math.min(H,y+Math.ceil(H*0.08));k++)if(smooth[k]!<smooth[neckY]!)neckY=k;const ratio=neckY/H;best=Math.max(0,Math.min(1,(ratio-0.16)/0.1));break;
 }
 return best>0?{score:best,bbox:[x0,y0,x1,y1]}:{score:0};
}

// Saliency-based crop selection (pure; runs in the jailed renderer and in tests). Replaces the fixed 3×3 grid:
// instead of tiling every view blindly, each view's object pixels (alpha) are scored for local detail (luminance
// gradient) plus colour rarity against the object's mean colour, and the windows with the most saliency are picked
// greedily with overlap suppression at two zoom levels (1/3 and 1/5 of the view). Small painted marks, decals,
// engraved text and protrusions therefore get the close-ups, and empty background gets none. Every view still gets
// at least one wide crop, so coverage never drops to zero on a featureless model.
import type {Pixels} from './detectors.ts';
export interface Window{x:number;y:number;size:number;score:number}
export const CROP_PLAN=[{div:3,count:5},{div:5,count:4}];
export function saliencyMap(px:Pixels){
 const {width:w,height:h,data}=px,n=w*h,lum=new Float32Array(n),mask=new Uint8Array(n),sal=new Float32Array(n);let r=0,g=0,b=0,c=0;
 for(let i=0;i<n;i++){lum[i]=(data[i*4]!*0.299+data[i*4+1]!*0.587+data[i*4+2]!*0.114);if(data[i*4+3]!>=128){mask[i]=1;r+=data[i*4]!;g+=data[i*4+1]!;b+=data[i*4+2]!;c++;}}
 if(!c)return {sal,mask,coverage:0};r/=c;g/=c;b/=c;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!mask[i])continue;
  const gx=lum[i+1]!-lum[i-1]!,gy=lum[i+w]!-lum[i-w]!,edge=Math.min(255,Math.hypot(gx,gy));
  // silhouette edges are already covered by the full views; damp them so interior detail wins
  const border=!mask[i-1]||!mask[i+1]||!mask[i-w]||!mask[i+w];
  const rare=Math.hypot(data[i*4]!-r,data[i*4+1]!-g,data[i*4+2]!-b)/441;
  sal[i]=(border?0.25:1)*edge/255+rare;}
 return {sal,mask,coverage:c/n};
}
function integral(v:Float32Array|Uint8Array,w:number,h:number){const I=new Float64Array((w+1)*(h+1));for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=v[y*w+x]!;I[(y+1)*(w+1)+x+1]=I[y*(w+1)+x+1]!+row;}}return I;}
const sum=(I:Float64Array,w:number,x:number,y:number,s:number)=>I[(y+s)*(w+1)+x+s]!-I[y*(w+1)+x+s]!-I[(y+s)*(w+1)+x]!+I[y*(w+1)+x]!;
const overlap=(a:Window,b:Window)=>{const ix=Math.max(0,Math.min(a.x+a.size,b.x+b.size)-Math.max(a.x,b.x)),iy=Math.max(0,Math.min(a.y+a.size,b.y+b.size)-Math.max(a.y,b.y)),i=ix*iy;return i/(a.size*a.size+b.size*b.size-i);};
/** Square windows (in analysis pixels) to re-render at full resolution, most salient first. */
export function saliencyWindows(px:Pixels,plan=CROP_PLAN):Window[]{
 const {width:w,height:h}=px,{sal,mask,coverage}=saliencyMap(px);if(!coverage)return [];
 const S=integral(sal,w,h),A=integral(mask,w,h),out:Window[]=[];
 for(const {div,count} of plan){
  const size=Math.floor(Math.min(w,h)/div),step=Math.max(1,Math.floor(size/4)),cands:Window[]=[];
  for(let y=0;y+size<=h;y+=step)for(let x=0;x+size<=w;x+=step){const area=sum(A,w,x,y,size)/(size*size);if(area<0.05)continue;cands.push({x,y,size,score:sum(S,w,x,y,size)/(size*size)});}
  cands.sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);const picked:Window[]=[];
  for(const c of cands){if(picked.length>=count)break;if(picked.every(p=>overlap(p,c)<0.25))picked.push(c);}
  out.push(...picked);
 }
 return out;
}

import { box, forgeRecipe, lathe, rod, rng } from '../../../src/engine/forge-kit.ts';
import { beam } from '../../../src/engine/forge-kit-structures.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'layout',label:'Layout',kind:'choice',group:'construction',unit:'none',default:'straight',options:[{value:'straight',label:'Straight jetty'},{value:'t-head',label:'T-head'},{value:'l-bend',label:'L-bend'}],hint:'Plan shape of the deck.',affects:['topology'],targets:['deck','piling']},
 {key:'length',label:'Length',kind:'range',group:'shape',unit:'m',min:5,max:14,step:0.1,default:8,hint:'Shore to the end of the walkway.',affects:['geometry'],targets:['deck','piling']},
 {key:'width',label:'Walkway width',kind:'range',group:'shape',unit:'m',min:1.4,max:3.2,step:0.05,default:2,hint:'Deck width.',affects:['geometry'],targets:['deck']},
 {key:'deckHeight',label:'Deck height',kind:'range',group:'shape',unit:'m',min:0.9,max:2.6,step:0.05,default:1.5,hint:'Bed (y=0) to deck top; water sits somewhere between.',affects:['geometry'],targets:['piling','deck']},
 {key:'bollards',label:'Bollards',kind:'integer',group:'construction',unit:'count',min:0,max:4,step:1,default:2,hint:'Iron mooring bollards along the edge.',affects:['topology'],targets:['bollard']},
 {key:'ropeRail',label:'Rope rail',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Tall end piles with sagging rope between them.',affects:['topology'],targets:['rope']},
 {key:'ladder',label:'Ladder',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Boarding ladder at the far end.',affects:['topology'],targets:['ladder']},
 {key:'seed',label:'Wear seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:3,hint:'Repeatable plank wear and missing boards.',affects:['geometry'],targets:['deck']},
];
type Rect={x0:number;x1:number;z0:number;z1:number;along:'z'|'x'};
export const pierRecipe=forgeRecipe({
 id:'pier',version:'1.0.0',title:'Wooden pier',description:'A timber pier on round pilings with cap beams, plank deck, mooring bollards, rope rail and a boarding ladder; straight, T-head or L-bend.',category:'Structures',order:240,
 entry:'examples/recipes/pier/index.ts',exportName:'pierRecipe',
 roles:{plank:'Deck planks.',timber:'Pilings, caps and stringers.',iron:'Bollards and fittings.',rope:'Mooring rope.'},
 palettes:{
  weathered:{label:'Weathered',colors:{plank:'#9a8f7d',timber:'#5e5347',iron:'#2e3033',rope:'#c8b48a'}},
  tarred:{label:'Tarred',colors:{plank:'#8c6a4a',timber:'#2f2a26',iron:'#3a3d40',rope:'#d8c7a0'}},
  harbor:{label:'Harbor paint',colors:{plank:'#a88d6c',timber:'#3d4c57',iron:'#b33a2d',rope:'#e3d6b4'}},
 },
 roughness:{iron:0.5},metalness:{iron:0.6},
 controls,
 presets:[
  {id:'jetty',name:'Fishing jetty',description:'Long narrow straight jetty with a rope rail.',parameters:{length:10,width:1.6,deckHeight:1.3,bollards:2}},
  {id:'t-pier',name:'T-head pier',description:'Wide walkway ending in a broad T-head landing.',parameters:{layout:'t-head',length:8,width:2.4,deckHeight:1.8,bollards:4,colorway:'tarred'}},
  {id:'l-landing',name:'L-bend landing',description:'Short walkway that turns into a side landing, no rope rail.',parameters:{layout:'l-bend',length:6.5,width:2,deckHeight:1.1,bollards:3,ropeRail:false,colorway:'harbor'}},
 ],
 constraints:['Pilings are spaced at most 2.2 m apart along each edge.'],
 build(p,add){
  const parts:Array<ReturnType<typeof add>>=[],add0=add;add=((...a:Parameters<typeof add>)=>{const m=add0(...a);parts.push(m);return m;}) as typeof add;
  const L=Number(p.length),W=Number(p.width),Hd=Number(p.deckHeight),layout=String(p.layout),random=rng(Number(p.seed));
  const rects:Rect[]=[{x0:-W/2,x1:W/2,z0:-L/2,z1:L/2,along:'z'}];
  if(layout==='t-head')rects.push({x0:-W*1.75,x1:W*1.75,z0:L/2,z1:L/2+Math.max(2.2,W*1.1),along:'x'});
  if(layout==='l-bend')rects.push({x0:W/2+0.09,x1:W/2+Math.max(3.5,W*2),z0:L/2-Math.max(2.2,W*1.1),z1:L/2,along:'x'});
  const plankH=0.06,strH=0.18,capH=0.2,yPlank=Hd-plankH/2,yStr=Hd-plankH-strH/2,yCap=Hd-plankH-strH-capH/2;
  const pileTop=Hd-plankH-strH-0.02;
  let pileCount=0;
  rects.forEach((r,ri)=>{
   const spanL=r.along==='z'?r.z1-r.z0:r.x1-r.x0,spanW=r.along==='z'?r.x1-r.x0:r.z1-r.z0,mapP=(u:number,v:number):[number,number]=>r.along==='z'?[(r.x0+r.x1)/2+v,r.z0+u]:[r.x0+u,(r.z0+r.z1)/2+v];
   // Bents: pairs of piles across the width with a cap beam on top.
   const bents=Math.max(2,Math.ceil((spanL-0.3)/2.2)+1);
   for(let b=0;b<bents;b++){
    if(ri>0&&b===0)continue;
    const u=0.15+b*(spanL-0.3)/(bents-1),[ax,az]=mapP(u,-spanW/2-0.02),[bx,bz]=mapP(u,spanW/2+0.02);
    for(const [k,[x,z]] of [[ax,az],[bx,bz]].entries()){
     const tall=Boolean(p.ropeRail)&&ri===0&&k===0;
     add('pile-'+ri+'-'+b+'-'+k,'timber',lathe([[0.15,0],[0.14,(tall?Hd+0.75:pileTop)*0.5],[0.13,tall?Hd+0.75:pileTop],[0.06,(tall?Hd+0.8:pileTop+0.04)]],8,{center:[x!,z!],phase:random()})); // piles stand on the ground (no parent part)
     pileCount++;
    }
    add('cap-'+ri+'-'+b,'timber',beam([ax,yCap,az],[bx,yCap,bz],capH,0.22),'pile-'+ri+'-'+b);
    if(Hd>1.2)add('cross-brace-'+ri+'-'+b,'timber',beam([ax,0.35,az],[bx,yCap-0.15,bz],0.12,0.08,r.along==='z'?[0,0,1]:[1,0,0]),'pile');
   }
   // Stringers along the span, planks across.
   const strings=Math.max(3,Math.round(spanW/0.6)+1);
   for(let s=0;s<strings;s++){const v=-spanW/2+0.12+s*(spanW-0.24)/(strings-1),[ax,az]=mapP(0.02,v),[bx,bz]=mapP(spanL-0.02,v);add('stringer-'+ri+'-'+s,'timber',beam([ax,yStr,az],[bx,yStr,bz],strH,0.1),'cap');}
   const pitch=0.2,planks=Math.floor(spanL/pitch);
   for(let k=0;k<planks;k++){
    // Every plank is laid at the regular pitch, at one top height, and cut to one length so the ends make a straight line 20 mm past the
    // outer stringers (T-head planks stop 15 mm inside the walkway's edge; L-arm planks end on the walkway's last plank line). Missing boards read as gaps exposing the joists, the 6 mm
    // height jitter as steps, and the ragged ends as an uneven edge.
    const u=(k+0.5)*spanL/planks,head=ri>0&&layout==='t-head',len=head?spanW-0.03:ri>0?spanW-0.025:spanW+0.04,dv=head?0.01:0,[cx,cz]=mapP(u,dv),dy=0;
    add('plank-'+ri+'-'+k,'plank',box(r.along==='z'?[len,plankH,spanL/planks-0.025]:[spanL/planks-0.025,plankH,len],[cx,yPlank-0.005+dy,cz],0.006),'stringer');
   }
  });
  // Rope rail along one edge of the walkway, sagging between the tall piles.
  if(p.ropeRail){
   const r=rects[0]!,bents=Math.max(2,Math.ceil((L-0.3)/2.2)+1),xs=-W/2-0.02;
   for(let b=0;b<bents-1;b++){
    const z0=r.z0+0.15+b*(L-0.3)/(bents-1),z1=r.z0+0.15+(b+1)*(L-0.3)/(bents-1),pts=Array.from({length:7},(_,i)=>{const t=i/6,z=z0+(z1-z0)*t;return {center:[xs,Hd+0.62-0.22*Math.sin(Math.PI*t),z] as [number,number,number],radius:0.022};});
    add('rope-'+b,'rope',taperedSweep(pts,5),'pile');
   }
  }
  const nb=Number(p.bollards),edge=rects.at(-1)!;
  for(let i=0;i<nb;i++){
   const t=(i+0.5)/nb,[x,z]=edge.along==='z'?[W/2-0.2,-L/2+L*t]:[edge.x0+(edge.x1-edge.x0)*t,edge.z1-0.2];
   add('bollard-'+i,'iron',lathe([[0.11,Hd-0.014],[0.09,Hd+0.18],[0.07,Hd+0.24],[0.13,Hd+0.3],[0.12,Hd+0.36],[0.05,Hd+0.38]],10,{center:[x,z]}),'plank');
  }
  if(p.ladder){
   const z=rects[0]!.z1+(layout==='t-head'?Math.max(2.2,W*1.1):0)+0.08,lw=0.5;
   for(const s of [-1,1])add('ladder-rail-'+(s>0?'r':'l'),'iron',rod([s*lw/2,0.05,z],[s*lw/2,Hd+0.75,z],0.025,6),'plank');
   const rungs=Math.round(Hd/0.3);for(let k=1;k<=rungs;k++)add('ladder-rung-'+k,'iron',rod([-lw/2,k*Hd/(rungs+0.3),z],[lw/2,k*Hd/(rungs+0.3),z],0.018,6),'ladder');
   for(const s of [-1,1])add('ladder-hoop-'+(s>0?'r':'l'),'iron',rod([s*lw/2,Hd+0.75,z],[s*lw/2,Hd+0.75,z-0.25],0.025,6),'ladder');
   for(const s of [-1,1])add('ladder-foot-'+(s>0?'r':'l'),'iron',box([0.08,0.05,0.08],[s*lw/2,0.025,z],0.006),'ladder');
  }
  // Center the footprint on the origin (T-heads and L-bends extend one way).
  const cx=(Math.min(...rects.map(r=>r.x0))+Math.max(...rects.map(r=>r.x1)))/2,cz=(Math.min(...rects.map(r=>r.z0))+Math.max(...rects.map(r=>r.z1)))/2;
  for(const m of parts)m.geometry.translate(-cx,0,-cz);
  const z0=(v:number)=>v===0?0:v; // no -0 in anchors
  return {deck:[z0(-cx),Hd,z0(-cz)],end:[z0(-cx),Hd,L/2-cz]};
 },
});

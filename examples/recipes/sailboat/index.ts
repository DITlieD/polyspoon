import { box, forgeRecipe, lathe, loopLoft, rod } from '../../../src/engine/forge-kit.ts';
import type { V3 } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import { gunwaleLine, hullEndBoard, hullInnerX, hullKeel, hullPoint, hullShell, hullTop, type HullSpec } from '../../../src/engine/forge-hull.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'length',label:'Hull length',kind:'range',group:'shape',unit:'m',min:3.5,max:7,step:0.05,default:5,hint:'Stem to transom.',affects:['geometry'],targets:['hull','deck','sail']},
 {key:'beam',label:'Beam',kind:'range',group:'shape',unit:'m',min:1.2,max:2.6,step:0.01,default:1.8,hint:'Widest width.',affects:['geometry'],targets:['hull','deck']},
 {key:'mastRatio',label:'Mast height',kind:'range',group:'shape',unit:'ratio',min:0.8,max:1.4,step:0.01,default:1.15,hint:'Mast height as a multiple of hull length.',affects:['geometry'],targets:['spar','sail']},
 {key:'rig',label:'Rig',kind:'choice',group:'construction',unit:'none',default:'sloop',options:[{value:'sloop',label:'Bermuda sloop'},{value:'cat',label:'Gaff catboat'},{value:'lateen',label:'Lateen'}],hint:'Sail plan: mainsail and jib, a single gaff sail on a forward mast, or a triangular sail on a long slanted yard.',affects:['topology'],targets:['spar','sail']},
 {key:'cabin',label:'Cuddy cabin',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Small cabin with portholes.',affects:['topology'],targets:['deck','trim']},
 {key:'sailBelly',label:'Sail draft',kind:'range',group:'shape',unit:'m',min:0,max:0.3,step:0.01,default:0.16,hint:'How full the sails are.',affects:['geometry'],targets:['sail']},
];
/** Thin sail with draft: corners tack, clew (foot) and head; luff tack->head. */
function sail(tack:V3,clew:V3,head:V3,belly:number,side:number,rows=8,cols=7){
 const lerp=(a:V3,b:V3,t:number)=>a.map((v,i)=>v+(b[i]!-v)*t) as V3,th=0.008;
 const loops=Array.from({length:rows},(_,r)=>{const t=r/(rows-1)*0.94,luff=lerp(tack,head,t),leech=lerp(clew,head,t);
  const pts=(o:number)=>Array.from({length:cols},(_,k)=>{const u=k/(cols-1),p=lerp(luff,leech,u),b=belly*Math.sin(Math.PI*u)*(1-t*0.7);return [p[0]+side*b+o,p[1],p[2]] as V3;});
  return [...pts(th),...pts(-th).reverse()];});
 return loopLoft(loops,'strip');
}
export const sailboatRecipe=forgeRecipe({
 id:'sailboat',version:'1.0.0',title:'Small sailboat',description:'A day sailer on a shore cradle: hollow hull with foredeck, keel and rudder, mast and boom with full sails, stays and an optional cuddy cabin.',category:'Vehicles',order:473,
 entry:'examples/recipes/sailboat/index.ts',exportName:'sailboatRecipe',
 roles:{hull:'Hull topsides.',deck:'Deck, cabin and cradle.',trim:'Rails, boot stripe and portholes.',spar:'Mast, boom, yard and tiller.',sail:'Sailcloth.',rigging:'Stays and fittings.'},
 palettes:{classic:{label:'Classic white',colors:{hull:'#f2efe6',deck:'#b68a5a',trim:'#1f4e79',spar:'#9c6b3c',sail:'#f4ecd8',rigging:'#3a3836'}},navy:{label:'Navy',colors:{hull:'#1e3550',deck:'#c8a171',trim:'#c4402f',spar:'#a87a48',sail:'#f6f1e4',rigging:'#2f2d2b'}},tanbark:{label:'Tanbark',colors:{hull:'#3e6b4f',deck:'#a77b4d',trim:'#e3d7b8',spar:'#7a5131',sail:'#b0563a',rigging:'#2f2d2b'}}},
 roughness:{rigging:0.5,sail:0.95},metalness:{rigging:0.6},autoGround:true,
 controls,
 presets:[
  {id:'sloop',name:'Bermuda sloop',description:'White sloop with a tall mainsail, jib and cuddy cabin.',parameters:{}},
  {id:'catboat',name:'Gaff catboat',description:'Beamy navy catboat with one big gaff sail and the mast far forward.',parameters:{length:4.6,beam:2.0,mastRatio:0.95,rig:'cat',cabin:false,sailBelly:0.12,colorway:'navy'}},
  {id:'felucca',name:'Lateen felucca',description:'Long narrow open boat with a tanbark lateen sail on a slanted yard.',parameters:{length:6.4,beam:1.5,mastRatio:0.85,rig:'lateen',cabin:false,sailBelly:0.22,colorway:'tanbark'}},
 ],
 constraints:['Beam at most 0.45 x length.'],
 check(p){if(Number(p.beam)>0.45*Number(p.length)+1e-9)throw new Error('Beam too wide for the length');},
 build(p,add){
  const L=Number(p.length),B=Number(p.beam),rig=String(p.rig),belly=Number(p.sailBelly);
  const fin=rig==='lateen'?0.12:0.42,cradle=0.32,lift=cradle+0.02;
  const h:HullSpec={length:L,beam:B,depth:0.62+L*0.03,sheer:0.18,rocker:0.12,roundness:rig==='lateen'?2.3:2.6,bow:'pointed',stern:rig==='lateen'?'pointed':'transom',thickness:0.03,lift};
  add('hull','hull',hullShell(h,14));
  if(h.stern==='transom')add('transom','hull',hullEndBoard(h,-1,0.035,14),'hull');
  for(const side of [0,1] as const){
   add('rubrail-'+side,'trim',taperedSweep(gunwaleLine(h,side,0.01,0.005).map(c=>({center:c,radius:0.03})),6),'hull');
   const boot=Array.from({length:14},(_,i)=>{const u=-0.92+1.84*i/13;return {center:hullPoint(h,u,side?0.79:0.21),radius:0.022};});
   add('boot-stripe-'+side,'trim',taperedSweep(boot,5),'hull');
  }
  // Keel fin (ballast) or a shallow keel strip, and a rudder.
  const keelY=hullKeel(h,0);
  if(rig!=='lateen'){
   add('keel-fin','deck',loopLoft([[[-0.05,keelY+0.08,-L*0.12],[0.05,keelY+0.08,-L*0.12],[0.05,keelY+0.08,L*0.12],[-0.05,keelY+0.08,L*0.12]],[[-0.04,keelY-fin+0.1,-L*0.1],[0.04,keelY-fin+0.1,-L*0.1],[0.04,keelY-fin+0.1,L*0.02],[-0.04,keelY-fin+0.1,L*0.02]]] as V3[][]),'hull');
   add('keel-bulb','rigging',lathe([[0.04,-0.0001],[0.1,0.06],[0.1,0.24],[0.05,0.34]].map(([r,z])=>[r,z]) as Array<[number,number]>,8,{}).rotateX(Math.PI/2).translate(0,keelY-fin+0.12,-L*0.12+0.02),'keel-fin');
  }else add('keel-strip','deck',taperedSweep(Array.from({length:11},(_,i)=>{const u=-0.9+1.8*i/10;return {center:[0,hullKeel(h,u)+0.02,u*L/2] as [number,number,number],radius:0.04};}),6),'hull');
  const sternZ=-L/2,sternTop=hullTop(h,-1);
  add('rudder','deck',box([0.04,0.92,0.3],[0,sternTop-0.3,sternZ-0.13],0.01),'hull');
  add('tiller','spar',rod([0,sternTop+0.12,sternZ-0.12],[0,sternTop+0.2,sternZ+0.75],0.025,6,0.018),'rudder');
  // Cradle stands keep the boat level on shore.
  for(const u of [-0.42,0.38]){const z=u*L/2,y=hullKeel(h,u)-lift;const w=hullInnerX(h,u,hullKeel(h,u)+0.25)*1.5;
   add('cradle-beam-'+u,'deck',box([w+0.4,0.1,0.14],[0,0.05,z],0.01));
   for(const s of [-1,1])add('cradle-arm-'+u+'-'+s,'deck',rod([s*(w/2+0.12),0.08,z],[s*(w*0.42),hullKeel(h,u)+0.22,z],0.035,6),'cradle-beam-'+u);
   add('cradle-post-'+u,'deck',box([0.12,Math.max(0.05,hullKeel(h,u)-0.08+0.02),0.12],[0,(hullKeel(h,u)-0.08+0.02)/2+0.08,z],0.01),'cradle-beam-'+u);void y;}
  // Foredeck following the sheer, sunk into the hull rim.
  const deckLoops=Array.from({length:8},(_,i)=>{const u=0.3+0.66*i/7,t=hullTop(h,u),x=hullInnerX(h,u,t-0.02)+0.012,z=u*L/2;return [[-x,t-0.05,z],[x,t-0.05,z],[x,t+0.012,z],[-x,t+0.012,z]] as V3[];});
  add('foredeck','deck',loopLoft(deckLoops),'hull');
  // Cockpit benches.
  // Each bench runs from u=-0.72 to -0.08 and the hull narrows aft. Its outer edge beds halfway into the planking (at least 5 mm short of
  // the outer skin) at the narrowest inner hull width over that length and its 40 mm thickness, so it is carried by the hull (sized at u=-0.4, the aft ends came out through the planking). Benches that would be
  // narrower than 160 mm stop short aft instead.
  for(const s of [-1,1]){const y=hullTop(h,-0.4)-0.3,inner=(u0:number)=>Math.min(...[0,1,2,3,4,5,6,7,8].map(i=>u0+(-0.08-u0)*i/8).flatMap(u=>[hullInnerX(h,u,y-0.02),hullInnerX(h,u,y+0.02)]))+Math.min(h.thickness*0.5,h.thickness-0.005);
   let u0=-0.72;while(u0<-0.3&&inner(u0)<0.2)u0+=0.04;const xo=inner(u0),bw=Math.min(0.26,xo-0.04),z0=u0*L/2,z1=-0.08*L/2;
   add('bench-'+s,'deck',box([bw,0.04,z1-z0],[s*(xo-bw/2),y,(z0+z1)/2],0.008),'hull');}
  if(p.cabin){
   const u=0.16,t=hullTop(h,u),x=hullInnerX(h,u,t)*0.75,cl=L*0.26,z=u*L/2;
   add('cabin','deck',box([x*2,0.34,cl],[0,t+0.12,z],0.03),'foredeck');
   add('cabin-roof','hull',box([x*2+0.06,0.05,cl+0.06],[0,t+0.31,z],0.02),'cabin');
   for(const s of [-1,1])for(const k of [-1,0,1])add('porthole-'+s+'-'+k,'trim',rod([s*(x-0.01),t+0.15,z+k*cl*0.28],[s*(x+0.015),t+0.15,z+k*cl*0.28],0.045,8),'cabin');
  }
  // Spars and sails.
  const mastZ=rig==='cat'?L*0.36:rig==='lateen'?L*0.18:L*0.12,deckY=hullTop(h,mastZ/(L/2)),mastH=L*Number(p.mastRatio)*(rig==='lateen'?0.7:1),mastTop=deckY+mastH;
  add('mast','spar',rod([0,hullKeel(h,mastZ/(L/2))+0.05,mastZ],[0,mastTop,mastZ],0.055,8,0.035),'hull');
  add('masthead','rigging',lathe([[0.045,mastTop-0.04],[0.05,mastTop+0.02],[0.02,mastTop+0.06]],8,{center:[0,mastZ]}),'mast');
  if(rig==='lateen'){
   const yardLen=L*1.15,a=Math.PI*0.2,top:V3=[0.1,mastTop+yardLen*0.42*Math.sin(a)+0.05,mastZ-yardLen*0.42*Math.cos(a)],low:V3=[0.1,mastTop-yardLen*0.58*Math.sin(a)+0.05,mastZ+yardLen*0.58*Math.cos(a)];
   low[1]=Math.max(low[1],deckY+0.35);
   add('yard','spar',rod(low,top,0.04,6,0.025),'mast');
   add('sail','sail',sail([0.12,low[1]-0.02,low[2]-0.05],[0.12,deckY+0.55,-L*0.32],[0.12,top[1]-0.05,top[2]+0.05],belly,1,9,8),'yard');
   add('sheet-line','rigging',rod([0.12,deckY+0.55,-L*0.32],[hullInnerX(h,-0.6,hullTop(h,-0.6)),hullTop(h,-0.6),-L*0.3],0.008,4),'sail');
  } else {
   const boomY=deckY+(p.cabin?0.95:0.75),boomLen=mastZ+L*0.42;
   add('boom','spar',rod([0,boomY,mastZ-0.04],[0,boomY,mastZ-boomLen],0.04,6,0.03),'mast');
   if(rig==='cat'){
    const gaffTop:V3=[0,mastTop+0.45,mastZ-boomLen*0.7];
    add('gaff','spar',rod([0,mastTop-0.25,mastZ-0.04],gaffTop,0.035,6,0.025),'mast');
    add('sail','sail',loopLoft(gaffSail([0.015,boomY+0.02,mastZ-0.03],[0.015,boomY+0.02,mastZ-boomLen+0.08],[0.015,mastTop-0.27,mastZ-0.02],[0.015,gaffTop[1]-0.015,gaffTop[2]+0.06],belly),'strip'),'boom');
   } else {
    add('mainsail','sail',sail([0.015,boomY+0.02,mastZ-0.03],[0.015,boomY+0.02,mastZ-boomLen+0.08],[0.015,mastTop-0.1,mastZ-0.02],belly,1),'boom');
    const stem:V3=[0,hullTop(h,0.98)+0.02,L/2*0.98];
    add('forestay','rigging',rod(stem,[0,mastTop-0.12,mastZ+0.03],0.008,4),'mast');
    add('jib','sail',sail([-0.04,stem[1]+0.12,stem[2]-0.15],[-0.04,deckY+0.6,mastZ-0.15],[-0.04,mastTop*0.82,mastZ+(stem[2]-mastZ)*0.2],belly*0.8,-1),'forestay');
   }
  }
  for(const s of [-1,1]){const u=mastZ/(L/2)-0.03,x=hullInnerX(h,u,hullTop(h,u)-0.01)+0.01;add('shroud-'+s,'rigging',rod([s*x,hullTop(h,u),mastZ-0.05],[s*0.03,mastTop-(rig==='lateen'?0.3:0.6),mastZ],0.008,4),'mast');}
  add('pennant','trim',loopLoft([[[0,mastTop+0.0,mastZ-0.01],[0.004,mastTop+0.0,mastZ-0.01],[0.004,mastTop+0.2,mastZ-0.01],[0,mastTop+0.2,mastZ-0.01]],[[0,mastTop+0.12,mastZ-0.45],[0.004,mastTop+0.12,mastZ-0.45],[0.004,mastTop+0.14,mastZ-0.45],[0,mastTop+0.14,mastZ-0.45]]] as V3[][]),'masthead');
  return {masthead:[0,mastTop,mastZ]};
 },
});
function gaffSail(tack:V3,clew:V3,throat:V3,peak:V3,belly:number,rows=8,cols=7){
 const lerp=(a:V3,b:V3,t:number)=>a.map((v,i)=>v+(b[i]!-v)*t) as V3,th=0.008;
 return Array.from({length:rows},(_,r)=>{const t=r/(rows-1),luff=lerp(tack,throat,t),leech=lerp(clew,peak,t);
  const pts=(o:number)=>Array.from({length:cols},(_,k)=>{const u=k/(cols-1),q=lerp(luff,leech,u),b=belly*Math.sin(Math.PI*u)*(1-t*0.5);return [q[0]+b+o,q[1],q[2]] as V3;});
  return [...pts(th),...pts(-th).reverse()];});
}

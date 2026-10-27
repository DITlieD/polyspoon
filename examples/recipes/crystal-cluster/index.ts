import { blob, forgeRecipe, lathe, merge, place, rest, rng } from '../../../src/engine/forge-kit.ts';
import type { BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';
const controls:Control[]=[
 {key:'arrangement',label:'Arrangement',kind:'choice',group:'construction',unit:'none',default:'radial',options:[{value:'radial',label:'Radial burst'},{value:'spire',label:'Central spire'},{value:'fan',label:'Leaning fan'}],hint:'How the crystals grow out of the rock.',affects:['geometry'],targets:['crystal']},
 {key:'count',label:'Crystals',kind:'integer',group:'construction',unit:'count',min:3,max:24,step:1,default:11,hint:'Number of crystal points.',affects:['topology'],targets:['crystal']},
 {key:'height',label:'Tallest crystal',kind:'range',group:'shape',unit:'m',min:0.15,max:3,step:0.01,default:0.7,hint:'Length of the largest point.',affects:['geometry'],targets:['crystal']},
 {key:'girth',label:'Crystal girth',kind:'range',group:'shape',unit:'ratio',min:0.08,max:0.3,step:0.01,default:0.15,hint:'Crystal radius as a share of its length.',affects:['geometry'],targets:['crystal']},
 {key:'spread',label:'Spread',kind:'range',group:'shape',unit:'ratio',min:0.1,max:1.2,step:0.01,default:0.75,hint:'How far crystals tilt away from vertical.',affects:['geometry'],targets:['crystal']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:17,hint:'Repeatable crystal sizes and angles.',affects:['geometry'],targets:['crystal','rock']},
];
export const crystalClusterRecipe=forgeRecipe({
 id:'crystal-cluster',version:'1.0.0',title:'Crystal cluster',description:'Stylized glowing crystals bursting from a rock bed: hexagonal points with faceted tips, softly self-lit, with scattered glowing shards.',category:'Nature',order:350,
 entry:'examples/recipes/crystal-cluster/index.ts',exportName:'crystalClusterRecipe',
 roles:{crystal:'Main crystal points (self-lit).',core:'Smaller inner crystals (brighter glow).',rock:'Host rock.',shard:'Loose shards on the ground.'},
 palettes:{amethyst:{label:'Amethyst',colors:{crystal:'#9a5fd6',core:'#d4a8ff',rock:'#4a4552',shard:'#b98aee'}},glacier:{label:'Glacier',colors:{crystal:'#7fd4f0',core:'#dff7ff',rock:'#a9b4bd',shard:'#a8e6f8'}},ember:{label:'Ember',colors:{crystal:'#ef6a2a',core:'#ffc65a',rock:'#3b2f2c',shard:'#ff8a3d'}}},
 roughness:{crystal:0.25,core:0.2,shard:0.25,rock:0.95},metalness:{crystal:0.1,core:0.05},emissive:{crystal:0.35,core:0.8,shard:0.5},
 controls,groundSnap:0.03,
 presets:[
  {id:'amethyst-burst',name:'Amethyst burst',description:'Purple points radiating from a dark dome of rock.',parameters:{}},
  {id:'ice-spire',name:'Ice spire',description:'One towering pale-blue spire ringed by short points.',parameters:{arrangement:'spire',count:9,height:1.8,girth:0.13,spread:0.45,colorway:'glacier',seed:4}},
  {id:'ember-fan',name:'Ember fan',description:'Fiery shards leaning one way off a flat slab.',parameters:{arrangement:'fan',count:8,height:0.9,girth:0.2,spread:0.9,colorway:'ember',seed:29}},
 ],
 constraints:['Every crystal base is buried in the rock; loose shards rest on the ground.'],
 build(p,add){
  const n=Number(p.count),H=Number(p.height),g=Number(p.girth),sp=Number(p.spread),random=rng(Number(p.seed)),mode=String(p.arrangement);
  const rockR=mode==='fan'?H*0.55:H*0.5,rockH=mode==='fan'?H*0.26:H*0.32;
  const rock:BufferGeometry[]=[blob([0,rockH*0.48,0],[rockR,rockH*0.5,rockR*0.85],9,5,random,0.25)];
  for(let i=0;i<3;i++){const a=i*2.1+random(),d=rockR*0.7;rock.push(blob([Math.cos(a)*d,rockH*0.28,Math.sin(a)*d*0.85],[rockR*0.45,rockH*0.29,rockR*0.4],7,4,random,0.3));}
  const rockGeometry=merge(rock);rockGeometry.computeBoundingBox();const ground=rockGeometry.boundingBox!.min.y;add('rock','rock',rockGeometry);
  const big:BufferGeometry[]=[],small:BufferGeometry[]=[];
  const crystal=(len:number,r:number,at:[number,number,number],yaw:number,pitch:number,out:BufferGeometry[])=>{
   const sink=Math.min(r*1.2,(at[1]-r*Math.sin(pitch)-0.004)/Math.max(Math.cos(pitch),0.2));
   const tip=0.28+random()*0.12;
   out.push(place(lathe([[r*0.8,-Math.max(sink,r*0.05)],[r,len*0.08],[r*0.97,len*(1-tip)],[r*0.12,len]],6,{phase:random()}),at,yaw,pitch));
  };
  for(let i=0;i<n;i++){
   let len:number,yaw:number,pitch:number,at:[number,number,number];
   if(mode==='spire'){len=i===0?H:H*(0.18+random()*0.3);yaw=i*2.39996;pitch=i===0?0.03:sp*(0.6+random()*0.6);}
   else if(mode==='fan'){len=H*(i===0?1:0.35+random()*0.6);yaw=(random()-.5)*1.1;pitch=sp*(0.35+0.65*(i/n))*(i%2?1:0.8);}
   else{len=H*(i===0?1:0.35+random()*0.55);yaw=i*2.39996+random()*0.4;pitch=i===0?0.08:sp*(0.35+random()*0.65);}
   const ring=i===0?0:rockR*(0.15+0.45*Math.sqrt(i/n));
   const ox=mode==='fan'?(random()-.5)*rockR*0.9:Math.cos(yaw+Math.PI/2)*ring*0+Math.sin(yaw)*ring,oz=mode==='fan'?(random()-.5)*rockR*0.6-rockR*0.2:Math.cos(yaw)*ring;
   at=[ox,rockH*0.7,oz];
   const r=len*g*(i===0?1:0.9+random()*0.2);
   crystal(len,r,at,yaw,pitch,big);
   if(i%2===0&&i>0)crystal(len*0.45,r*0.6,[ox*0.9,rockH*0.75,oz*0.9],yaw+0.6,pitch*1.15,small);
  }
  add('crystals','crystal',merge(big),'rock');add('cores','core',merge(small),'rock');
  const shards:BufferGeometry[]=[];
  // on the rock's lowest level, which becomes the ground (they hovered when the rock dipped below y=0)
  for(let i=0;i<5;i++){const a=random()*6.28,d=rockR*(0.9+random()*0.15),l=H*0.12*(0.6+random()*0.6);shards.push(rest(place(lathe([[l*0.22,0],[l*0.2,l*0.6],[l*0.03,l]],6),[Math.cos(a)*d,0,Math.sin(a)*d*0.8],a,1.1+random()*0.3)).translate(0,ground,0));}
  add('shards','shard',merge(shards),'rock');
  return {top:[0,H,0]};
 },
});

import { box, forgeRecipe, lathe, rng, rod } from '../../../src/engine/forge-kit.ts';
import { closedSweep } from '../../../src/engine/geometry.ts';
import { arc, place, stone } from '../../../src/engine/forge-props.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'rig',label:'Cooking rig',kind:'choice',group:'construction',unit:'none',default:'tripod',options:[{value:'tripod',label:'Tripod and cauldron'},{value:'spit',label:'Forked posts, spit and kettle'},{value:'crane',label:'Fire crane and big cauldron'}],hint:'How the pot hangs over the fire.',affects:['topology'],targets:['pole','iron']},
 {key:'potSize',label:'Pot size',kind:'range',group:'shape',unit:'m',min:0.16,max:0.4,step:0.01,default:0.24,hint:'Pot radius.',affects:['geometry'],targets:['iron','food']},
 {key:'ring',label:'Fire ring radius',kind:'range',group:'shape',unit:'m',min:0.3,max:0.6,step:0.01,default:0.42,hint:'Radius of the stone ring.',affects:['geometry'],targets:['stone','ash']},
 {key:'stones',label:'Ring stones',kind:'integer',group:'construction',unit:'count',min:7,max:16,step:1,default:11,hint:'Stones in the ring.',affects:['topology'],targets:['stone']},
 {key:'logs',label:'Logs',kind:'integer',group:'construction',unit:'count',min:3,max:7,step:1,default:5,hint:'Logs in the teepee.',affects:['topology'],targets:['wood','char']},
 {key:'seat',label:'Log seat',kind:'toggle',group:'construction',unit:'none',default:false,hint:'A split log bench beside the fire.',affects:['topology'],targets:['wood']},
 {key:'seed',label:'Seed',kind:'integer',group:'construction',unit:'seed',min:1,max:999,step:1,default:3,hint:'Shuffles stones, logs and flames.',affects:['geometry'],targets:['stone','wood','flame']},
];
export const campfireCookpotRecipe=forgeRecipe({
 id:'campfire-cookpot',version:'1.0.0',title:'Campfire cookpot',description:'A stone-ringed campfire with a log teepee and flames, and a cauldron or kettle hung on a chain from a tripod, a forked spit or an iron crane.',category:'Props',order:413,
 entry:'examples/recipes/campfire-cookpot/index.ts',exportName:'campfireCookpotRecipe',
 roles:{stone:'Ring stones.',ash:'Ash bed.',wood:'Logs and seat.',char:'Charred log ends.',flame:'Outer flames.',ember:'Inner flames.',pole:'Tripod poles and posts.',iron:'Pot, chain and crane.',food:'Stew.'},
 palettes:{camp:{label:'Camp',colors:{stone:'#8b857c',ash:'#4a4643',wood:'#7b5232',char:'#2a211c',flame:'#f08a24',ember:'#ffd35a',pole:'#8f6a45',iron:'#2c2b2a',food:'#8a5a2b'}},mossy:{label:'Mossy glade',colors:{stone:'#6f7a63',ash:'#3f3c39',wood:'#6a4a30',char:'#241c18',flame:'#ef7b2d',ember:'#ffcf4d',pole:'#7a5a3a',iron:'#33302d',food:'#5f7a3a'}},desert:{label:'Desert camp',colors:{stone:'#b79a72',ash:'#5a4e44',wood:'#8a6240',char:'#2e241e',flame:'#f2932a',ember:'#ffe06b',pole:'#a07a4f',iron:'#3a2f28',food:'#a2552a'}}},
 roughness:{iron:0.6,flame:0.6,ember:0.5},metalness:{iron:0.6},
 controls,
 presets:[
  {id:'tripod',name:'Tripod cauldron',description:'Three lashed poles holding a cauldron on a chain.',parameters:{}},
  {id:'spit',name:'Spit and kettle',description:'Two forked posts with a spit and a hanging kettle.',parameters:{rig:'spit',potSize:0.17,stones:9,logs:4,colorway:'desert',seed:8}},
  {id:'crane',name:'Crane cauldron',description:'An iron fire crane swinging a big cauldron, with a log seat.',parameters:{rig:'crane',potSize:0.32,ring:0.5,stones:14,logs:6,seat:true,colorway:'mossy',seed:15}},
 ],
 constraints:['The pot bottom hangs at least 8 cm above the logs; every hanging part is chained to a grounded pole.'],
 build(p,add){
  const R=Number(p.ring),pr=Number(p.potSize),random=rng(Number(p.seed)),ns=Number(p.stones),nl=Number(p.logs);
  add('ash-bed','ash',lathe([[R-0.03,0],[R-0.08,0.025],[R*0.4,0.04],[0.04,0.045]],12));
  for(let i=0;i<ns;i++){const a=i*2*Math.PI/ns+random()*0.2,w=0.07+random()*0.04,h=0.08+random()*0.07;add('stone-'+i,'stone',place(stone(w,h,6,random),[0,random()*6,0],[Math.cos(a)*R,0,Math.sin(a)*R]),'ash-bed');}
  // log teepee
  const apex=0.32+random()*0.05;
  for(let i=0;i<nl;i++){
   const a=i*2*Math.PI/nl+random()*0.3,r0=R*0.55,b:[number,number,number]=[Math.cos(a)*r0,0.04,Math.sin(a)*r0],tip:[number,number,number]=[Math.cos(a+0.25)*0.03,apex,Math.sin(a+0.25)*0.03];
   const mid:[number,number,number]=[b[0]+(tip[0]-b[0])*0.62,b[1]+(tip[1]-b[1])*0.62,b[2]+(tip[2]-b[2])*0.62],rr=0.032+random()*0.01;
   add('log-'+i,'wood',rod(b,mid,rr,7,rr*0.95),'ash-bed');
   add('log-char-'+i,'char',rod([b[0]+(tip[0]-b[0])*0.58,b[1]+(tip[1]-b[1])*0.58,b[2]+(tip[2]-b[2])*0.58],tip,rr*0.92,7,rr*0.55),'log-'+i);
  }
  // Neighbouring flames alternate 5 and 6 sides so their overlapping sheets never lie in one plane.
  for(let i=0;i<4;i++){const a=i*Math.PI/2+random(),o=i?0.07:0,cx=Math.cos(a)*o,cz=Math.sin(a)*o,h=(i?0.3:0.46)*(0.85+random()*0.3);
   add('flame-'+i,'flame',lathe([[0.075,0.036+i*0.007],[0.09,0.1],[0.06,h*0.55],[0.008,h]],5+i%2,{center:[cx,cz],phase:random()*3,tilt:[(random()-.5)*0.25,(random()-.5)*0.25]}),'ash-bed');
   add('ember-'+i,'ember',lathe([[0.045,0.068+i*0.006],[0.05,0.11],[0.03,h*0.45],[0.006,h*0.72]],5,{center:[cx,cz],phase:random()*3}),'flame-'+i);}
  // chain of alternating links from (x,top) down to y=bottom
  const chain=(x:number,z:number,top:number,bottom:number,parent:string)=>{
   const link=0.05,count=Math.max(2,Math.round((top-bottom)/link));
   for(let i=0;i<count;i++){const y=top-link/2-i*link,q=(count-1-i)%2;
    const st=Array.from({length:8},(_,k)=>{const t=k*Math.PI/4,c=[Math.cos(t)*0.014,Math.sin(t)*link/2];return {center:(q?[x+c[0]!,y+c[1]!,z]:[x,y+c[1]!,z+c[0]!]) as [number,number,number],radius:0.0045};});
    add('chain-'+i,'iron',closedSweep(st,4),i?'chain-'+(i-1):parent);}
   return top-count*link;
  };
  const cauldron=(cx:number,top:number,r:number,parent:string)=>{
   // top = bail apex; pot rim sits r*1.0 below
   const rim=top-r*1.0,base=rim-r*0.95;
   add('pot','iron',lathe([[r*0.42,base],[r*0.78,base+r*0.12],[r,base+r*0.45],[r*0.95,base+r*0.78],[r*0.86,base+r*0.9]],12,{center:[cx,0]}),parent);
   add('stew','food',lathe([[r*0.8,base+r*0.84],[r*0.8,base+r*0.9+0.006]],12,{center:[cx,0]}),'pot');
   add('pot-rim','iron',closedSweep(Array.from({length:12},(_,k)=>({center:[cx+Math.cos(k*Math.PI/6)*r*0.86,base+r*0.92,Math.sin(k*Math.PI/6)*r*0.86] as [number,number,number],radius:r*0.06})),6),'pot');
   for(let k=0;k<3;k++){const a=k*2*Math.PI/3+0.5;add('pot-foot-'+k,'iron',rod([cx+Math.cos(a)*r*0.5,base+r*0.1,Math.sin(a)*r*0.5],[cx+Math.cos(a)*r*0.58,base-r*0.12,Math.sin(a)*r*0.58],r*0.06,5,r*0.04),'pot');}
   add('bail','iron',arc([cx,rim,0],r,-0.03*Math.PI,1.03*Math.PI,12,0.007,[1,0,0],[0,1,0],5),'pot-rim');
   for(const sx of [-1,1])add('pot-lug-'+sx,'iron',box([r*0.22,r*0.16,r*0.12],[cx+sx*r*0.93,rim-r*0.09,0],0.004),'pot-rim');
   add('ladle','iron',rod([cx+r*0.3,base+r*0.8,r*0.2],[cx+r*0.75,rim+r*0.55,r*0.5],0.007,5),'stew');
   return base-r*0.12;
  };
  const kettle=(cx:number,top:number,r:number,parent:string)=>{
   const base=top-1.55*r;
   add('kettle','iron',lathe([[r*0.7,base],[r,base+r*0.35],[r*0.92,base+r*0.8],[r*0.55,base+r*1.05],[r*0.42,base+r*1.1]],10,{center:[cx,0]}),parent);
   add('kettle-lid','iron',lathe([[r*0.46,base+r*1.08],[r*0.4,base+r*1.18],[r*0.08,base+r*1.24],[r*0.12,base+r*1.32]],10,{center:[cx,0]}),'kettle');
   add('kettle-spout','iron',rod([cx+r*0.6,base+r*0.45,0],[cx+r*1.45,base+r*1.05,0],r*0.13,6,r*0.07),'kettle');
   add('bail','iron',arc([cx,base+1.05*r,0],r*0.5,-0.02*Math.PI,1.02*Math.PI,10,0.007,[0,0,1],[0,1,0],5),'kettle');
   return base;
  };
  const pole=(name:string,a:[number,number,number],b:[number,number,number],r=0.03)=>{
   const len=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),ty=Math.abs(b[1]-a[1])/len;const foot:[number,number,number]=[a[0],a[1]===0?r*Math.sqrt(1-ty*ty)+0.0005:a[1],a[2]];
   return add(name,'pole',rod(foot,b,r,7,r*0.85),'ash-bed');};
  if(p.rig==='tripod'){
   const hang=apex+0.12+2.1*pr,top=Math.max(1.35+pr*0.6,hang+0.3),spread=R+0.16;
   for(let k=0;k<3;k++){const a=k*2*Math.PI/3+0.4;pole('tripod-leg-'+k,[Math.cos(a)*spread,0,Math.sin(a)*spread],[-Math.cos(a)*0.07,top+0.08,-Math.sin(a)*0.07]);}
   add('lashing','pole',lathe([[0.06,top-0.04],[0.065,top],[0.06,top+0.04]],8),'tripod-leg-0');
   const bottom=chain(0,0,top,Math.max(top-0.6+pr*0.3,hang),'lashing');
   const lowest=cauldron(0,bottom,pr,'chain-0');if(lowest<apex+0.04)throw new Error('cauldron sits in the flames');
  }else if(p.rig==='spit'){
   const top=0.95,x=R+0.12;
   for(const sx of [-1,1]){pole('post-'+sx,[sx*x,0,0],[sx*x,top-0.05,0],0.035);
    add('fork-a-'+sx,'pole',rod([sx*x,top-0.08,0],[sx*x-0.02*sx,top+0.1,0.07],0.022,6,0.018),'post-'+sx);
    add('fork-b-'+sx,'pole',rod([sx*x,top-0.08,0],[sx*x-0.02*sx,top+0.1,-0.07],0.022,6,0.018),'post-'+sx);}
   const sy=top-0.075;
   add('spit','iron',rod([-x-0.2,sy,0],[x+0.12,sy,0],0.014,6),'post-1');
   add('spit-crank','iron',rod([-x-0.19,sy+0.003,0],[-x-0.19,sy-0.13,0.0],0.012,5),'spit');
   const bottom=chain(0,0,sy,sy-0.15,'spit');
   kettle(0,bottom,pr,'chain-0');
  }else{
   const x=R+0.2,top=Math.max(1.45,apex+0.1+2.1*pr+0.35);
   add('crane-post','iron',rod([x,0,0],[x,top,0],0.03,8),'ash-bed');
   add('crane-foot','iron',lathe([[0.12,0],[0.1,0.04],[0.04,0.08]],8,{center:[x,0]}),'crane-post');
   add('crane-arm','iron',rod([x,top-0.05,0],[-0.12,top-0.05,0],0.022,6),'crane-post');
   add('crane-brace','iron',rod([x,top-0.55,0],[x-0.5,top-0.06,0],0.016,6),'crane-post');
   add('crane-scroll','iron',arc([-0.12,top-0.09,0],0.04,0.5*Math.PI,2.2*Math.PI,10,0.012,[1,0,0],[0,1,0],5),'crane-arm');
   const cb=chain(0,0,top-0.05,top-0.35,'crane-arm');
   const lowest=cauldron(0,cb,pr,'chain-0');if(lowest<apex+0.04)throw new Error('cauldron sits in the flames');
  }
  if(p.seat){
   const sx=-(R+0.55),len=1.0;
   add('seat-log','wood',rod([sx,0.148,-len/2],[sx,0.148,len/2],0.15,9),undefined); // its lowest facet on the ground (it hovered 2 mm up)
   add('seat-top','pole',box([0.2,0.02,len-0.04],[sx,0.28,0],0.004),'seat-log');
  }
  return {pot:[0,1,0]};
 },
});

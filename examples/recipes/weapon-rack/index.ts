import { box, forgeRecipe, lathe, rod } from '../../../src/engine/forge-kit.ts';
import { closedSweep } from '../../../src/engine/geometry.ts';
import { blade, place, plate, rest } from '../../../src/engine/forge-props.ts';
import type { BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'style',label:'Rack style',kind:'choice',group:'construction',unit:'none',default:'linear',options:[{value:'linear',label:'Free-standing rail rack'},{value:'round',label:'Round armory stand'}],hint:'Rack layout.',affects:['topology'],targets:['wood']},
 {key:'width',label:'Rack width',kind:'range',group:'shape',unit:'m',min:0.9,max:2.2,step:0.01,default:1.5,hint:'Length of a rail rack (diameter scale for a round stand).',affects:['geometry'],targets:['wood']},
 {key:'swords',label:'Swords',kind:'integer',group:'construction',unit:'count',min:0,max:6,step:1,default:3,hint:'Swords hung by the guard.',affects:['topology'],targets:['steel','brass','leather']},
 {key:'axes',label:'Axes',kind:'integer',group:'construction',unit:'count',min:0,max:4,step:1,default:2,hint:'Axes standing on their hafts.',affects:['topology'],targets:['steel','wood']},
 {key:'spears',label:'Spears',kind:'integer',group:'construction',unit:'count',min:0,max:4,step:1,default:0,hint:'Spears and halberds.',affects:['topology'],targets:['steel','wood']},
 {key:'shields',label:'Shields',kind:'integer',group:'construction',unit:'count',min:0,max:3,step:1,default:2,hint:'Shields leaning against the rack.',affects:['topology'],targets:['paint','trim']},
 {key:'shieldShape',label:'Shield shape',kind:'choice',group:'construction',unit:'none',default:'round',options:[{value:'round',label:'Round with boss'},{value:'heater',label:'Heater'},{value:'kite',label:'Kite'}],hint:'Shield outline.',affects:['geometry'],targets:['paint','trim']},
];
type V3=[number,number,number];
export const weaponRackRecipe=forgeRecipe({
 id:'weapon-rack',version:'1.0.0',title:'Weapon rack',description:'An armory rack of swords hung by their guards, axes and spears in the rails, and painted shields leaning against the frame.',category:'Props',order:415,
 entry:'examples/recipes/weapon-rack/index.ts',exportName:'weaponRackRecipe',
 roles:{wood:'Rack frame.',haft:'Hafts and shafts.',steel:'Blades and heads.',brass:'Guards and pommels.',leather:'Grips.',paint:'Shield faces.',trim:'Shield rims, bosses and devices.'},
 palettes:{armory:{label:'Armory',colors:{wood:'#6e4b31',haft:'#9a7a52',steel:'#a9adb1',brass:'#b8913f',leather:'#4a3020',paint:'#8e2b25',trim:'#d9c48a'}},northern:{label:'Northern',colors:{wood:'#5a4636',haft:'#8a6a48',steel:'#8f969c',brass:'#6f6a62',leather:'#3a2a20',paint:'#2f5172',trim:'#e4dccb'}},royal:{label:'Royal guard',colors:{wood:'#3d2a20',haft:'#6b4a30',steel:'#c3c8cd',brass:'#d2ad55',leather:'#5a1f22',paint:'#1f3a6e',trim:'#e8c55a'}}},
 roughness:{steel:0.3,brass:0.4},metalness:{steel:0.85,brass:0.75},
 controls,
 presets:[
  {id:'armory',name:'Armory rail',description:'Swords, axes and two round shields on a rail rack.',parameters:{}},
  {id:'round-stand',name:'Round spear stand',description:'A round stand of spears and axes with kite shields.',parameters:{style:'round',width:1.2,swords:2,axes:2,spears:4,shields:3,shieldShape:'kite',colorway:'northern'}},
  {id:'guardroom',name:'Guardroom rack',description:'Short rack of swords and a spear with heater shields.',parameters:{width:1.1,swords:4,axes:0,spears:1,shields:2,shieldShape:'heater',colorway:'royal'}},
 ],
 constraints:['Sword guards rest 4 mm into the top rail; hafts stand in the base; shields lean 14° and touch the ground.'],
 check(p){const n=Number(p.swords)+Number(p.axes)+Number(p.spears);if(n<1)throw new Error('A weapon rack needs at least one weapon');},
 build(p,add){
  const W=Number(p.width),round=p.style==='round';
  const railY=1.0,baseTop=0.2;
  // weapons placed at slots (x,z) facing +z
  const sword=(i:number,x:number,z:number,yaw:number,parent:string)=>{
   const part=(n:string,role:string,g:BufferGeometry,to?:string)=>add('sword-'+i+'-'+n,role,place(g,[0,yaw,0],[x,0,z]),to?'sword-'+i+'-'+to:parent);
   const gy=railY+0.025+0.012-0.004,len=0.7+(i%3)*0.06,w=0.05-(i%2)*0.008;
   part('blade','steel',place(blade(len,w,0.012,0.16),[Math.PI,0,0],[0,gy-0.005,0]));
   part('guard','brass',(i%2?box([0.2,0.024,0.05],[0,gy,0],0.005):rod([-0.11,gy+0.02,0],[0.11,gy+0.02,0],0.012,6)),'blade');
   if(!(i%2)){part('guard-center','brass',box([0.05,0.03,0.032],[0,gy+0.008,0],0.006),'guard');}
   part('grip','leather',lathe([[0.016,gy+(i%2?0.006:0.016)],[0.018,gy+0.08],[0.015,gy+0.15]],7),'guard');
   part('pommel','brass',lathe([[0.012,gy+0.145],[0.03,gy+0.165],[0.024,gy+0.19],[0.008,gy+0.2]],7),'grip');
  };
  const axe=(i:number,x:number,z:number,yaw:number,parent:string)=>{
   const top=1.12+(i%2)*0.08,hy=top-0.1;
   const part=(n:string,role:string,g:BufferGeometry,to?:string)=>add('axe-'+i+'-'+n,role,place(g,[0,yaw,0],[x,0,z]),to?'axe-'+i+'-'+to:parent);
   part('haft','haft',lathe([[0.02,baseTop-0.04],[0.018,top-0.2],[0.022,top]],7));
   const bit=i%2?[[-0.03,-0.05],[0.17,-0.13],[0.22,-0.04],[0.22,0.05],[0.17,0.12],[-0.03,0.05]]:[[-0.03,-0.045],[0.15,-0.1],[0.19,0.0],[0.15,0.09],[-0.03,0.04]];
   part('head','steel',place(plate((bit as Array<[number,number]>),0.026),[Math.PI/2,-Math.PI/2,0],[0.0,hy,0]),'haft');
   if(i%2)part('back-spike','steel',place(lathe([[0.022,0],[0.004,0.08]],5),[-Math.PI/2,0,0],[0,hy,-0.02]),'head');
   part('collar','steel',lathe([[0.03,hy-0.07],[0.03,hy+0.06]],6),'haft');
  };
  const spear=(i:number,x:number,z:number,yaw:number,parent:string)=>{
   const top=1.75+(i%2)*0.1;
   const part=(n:string,role:string,g:BufferGeometry,to?:string)=>add('spear-'+i+'-'+n,role,place(g,[0,yaw,0],[x,0,z]),to?'spear-'+i+'-'+to:parent);
   part('shaft','haft',lathe([[0.017,baseTop-0.04],[0.016,top]],7));
   part('socket','steel',lathe([[0.022,top-0.06],[0.02,top+0.02]],6),'shaft');
   if(i%2){part('head','steel',blade(0.24,0.06,0.014,0.4,0.7).translate(0,top+0.01,0),'socket');}
   else{part('head','steel',blade(0.2,0.04,0.012,0.35).translate(0,top+0.01,0),'socket');
    part('halberd','steel',place(plate([[-0.01,-0.05],[0.14,-0.09],[0.16,0.0],[0.14,0.1],[-0.01,0.05],[-0.02,0]],0.016),[Math.PI/2,0,0],[0.01,top-0.02,0]),'socket');}
   part('butt','steel',lathe([[0.02,baseTop-0.05],[0.022,baseTop-0.02]],6),'shaft');
  };
  const shield=(i:number,x:number,z:number,yaw:number,shape:string,parent:string)=>{
   const lean=0.25,face=(g:BufferGeometry)=>place(g,[Math.PI/2-lean,yaw,0],[0,0,0]);
   const parts:Array<[string,string,BufferGeometry]>=[];
   if(shape==='round'){const R=0.29;
    parts.push(['face','paint',lathe([[R,0],[R,0.018],[R*0.85,0.035],[R*0.2,0.045]],16)]);
    parts.push(['rim','trim',closedSweep(Array.from({length:16},(_,k)=>({center:[Math.cos(k*Math.PI/8)*R,0.012,Math.sin(k*Math.PI/8)*R] as V3,radius:0.014})),5)]);
    parts.push(['boss','trim',lathe([[0.08,0.035],[0.075,0.06],[0.04,0.09],[0.006,0.1]],8)]);
   }else{
    const kite=shape==='kite',h=kite?0.95:0.6,w=kite?0.5:0.52;
    const out:Array<[number,number]>=kite?[[0,-h*0.62],[w*0.32,-h*0.3],[w*0.5,h*0.12],[w*0.42,h*0.3],[w*0.2,h*0.37],[-w*0.2,h*0.37],[-w*0.42,h*0.3],[-w*0.5,h*0.12],[-w*0.32,-h*0.3]]
     :[[0,-h*0.55],[w*0.3,-h*0.38],[w*0.45,-h*0.1],[w*0.5,h*0.2],[w*0.5,h*0.42],[-w*0.5,h*0.42],[-w*0.5,h*0.2],[-w*0.45,-h*0.1],[-w*0.3,-h*0.38]];
    const ccw=out.map(([a,b]):[number,number]=>[a,-b]).reverse();
    parts.push(['face','paint',plate(ccw,0.035).translate(0,0.0175,0)]);
    parts.push(['device','trim',plate(ccw.map(([a,b]):[number,number]=>[a*0.22,b*0.62]),0.016).translate(0,0.041,0)]); // 2 mm into the face (it floated 3 mm above it)
    parts.push(['bar','trim',plate([[-w*0.48,-h*0.06],[w*0.48,-h*0.06],[w*0.48,h*0.04],[-w*0.48,h*0.04]].map(([a,b]):[number,number]=>[a!,-b!]).reverse() as Array<[number,number]>,0.014).translate(0,0.035,0)]); // bar 7 mm into the face, top 7 mm under the device's (it floated 1 mm above the face)
   }
   // lean the stack back, rest it on the ground, and move it in front of the rack
   const gs=parts.map(([,,g])=>face(g));let minY=Infinity;for(const g of gs){g.computeBoundingBox();minY=Math.min(minY,g.boundingBox!.min.y);}
   gs.forEach((g,k)=>{g.translate(x,-minY,z); // the lowest edge stands on the ground (it hovered 2 mm up)
   add('shield-'+i+'-'+parts[k]![0],parts[k]![1],g,k?'shield-'+i+'-face':parent);});
  };
  void rest;
  const list:Array<'s'|'a'|'p'>=[];
  const counts={s:Number(p.swords),a:Number(p.axes),p:Number(p.spears)};
  while(counts.s+counts.a+counts.p){for(const k of ['p','s','a','s'] as const)if(counts[k]>0){list.push(k);counts[k]--;}}
  let si=0,ai=0,pi=0;
  const put=(k:'s'|'a'|'p',x:number,z:number,yaw:number,parent:string)=>k==='s'?sword(si++,x,z,yaw,parent):k==='a'?axe(ai++,x,z,yaw,parent):spear(pi++,x,z,yaw,parent);
  const nShields=Number(p.shields);
  if(!round){
   const half=W/2;
   for(const sx of [-1,1]){
    add('post-'+sx,'wood',box([0.08,1.22,0.08],[sx*half,0.61,0],0.01));
    add('foot-'+sx,'wood',box([0.1,0.07,0.55],[sx*half,0.035,0],0.012),'post-'+sx);
    for(const sz of [-1,1])add('brace-'+sx+sz,'wood',rod([sx*half,0.06,sz*0.22],[sx*half,0.42,0],0.022,6),'foot-'+sx); // ends on the post centre line (at 35 mm out it poked through the post's face)
    add('post-cap-'+sx,'wood',lathe([[0.05,1.215],[0.055,1.24],[0.02,1.29]],8,{center:[sx*half,0],phase:Math.PI/8}),'post-'+sx);
   }
   add('base-box','wood',box([2*half-0.04,0.1,0.22],[0,baseTop-0.05,0],0.01),'post-1');
   for(const sz of [-1,1])add('rail-'+sz,'wood',box([2*half+0.06,0.05,0.04],[0,railY,sz*0.03],0.008),'post-1');
   add('top-bar','wood',box([2*half+0.1,0.06,0.1],[0,1.2,0],0.01),'post-1');
   const n=list.length,span=2*half-0.24;
   list.forEach((k,i)=>{const x=n===1?0:-span/2+span*i/(n-1);put(k,x,0,0,'rail-1');
    if(i<n-1)add('peg-'+i,'wood',rod([x+span/(n-1)/2,railY,-0.07],[x+span/(n-1)/2,railY,0.07],0.012,5),'rail-1');});
   for(let i=0;i<nShields;i++){const x=nShields===1?0:(-1+2*i/(nShields-1))*half*0.55;shield(i,x,0.28+(i%2)*0.07,0,String(p.shieldShape),'base-box');}
  }else{
   const R=0.25*W;
   add('stand-base','wood',lathe([[R+0.06,0],[R+0.06,0.05],[R+0.02,0.08],[R,baseTop]],12));
   add('stand-post','wood',lathe([[0.05,baseTop-0.01],[0.045,1.3],[0.06,1.34],[0.02,1.42]],8),'stand-base');
   add('stand-ring','wood',closedSweep(Array.from({length:14},(_,k)=>({center:[Math.cos(k*Math.PI/7)*R,railY,Math.sin(k*Math.PI/7)*R] as V3,radius:0.025})),6),'stand-post');
   for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;add('spoke-'+k,'wood',rod([Math.cos(a)*0.035,railY,Math.sin(a)*0.035],[Math.cos(a)*R,railY,Math.sin(a)*R],0.018,6),'stand-post');}
   const n=list.length;
   list.forEach((k,i)=>{const a=i*2*Math.PI/n,x=Math.cos(a)*R,z=Math.sin(a)*R;put(k,x,z,-a+Math.PI/2,'stand-ring');});
   for(let i=0;i<nShields;i++){const a=Math.PI/2+(i-(nShields-1)/2)*1.6,d=R+0.32;shield(i,Math.cos(a)*d,Math.sin(a)*d,Math.atan2(Math.cos(a),Math.sin(a)),String(p.shieldShape),'stand-base');}
  }
  return {top:[0,1.2,0]};
 },
});

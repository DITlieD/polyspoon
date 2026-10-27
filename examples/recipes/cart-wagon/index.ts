import { box, forgeRecipe, hoopX, lathe, latheX, loopLoft, rod, rng } from '../../../src/engine/forge-kit.ts';
import type { V3 } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const choice=(key:string,label:string,options:string[],value:string,hint:string,targets:string[]):Control=>({key,label,kind:'choice',group:'construction',unit:'none',default:value,options:options.map(v=>({value:v,label:v[0]!.toUpperCase()+v.slice(1)})),hint,affects:['topology'],targets});
const controls:Control[]=[
 {key:'length',label:'Bed length',kind:'range',group:'shape',unit:'m',min:1.1,max:3.4,step:0.05,default:1.9,hint:'Length of the load bed.',affects:['geometry'],targets:['wood','iron']},
 {key:'width',label:'Bed width',kind:'range',group:'shape',unit:'m',min:0.7,max:1.6,step:0.01,default:1.15,hint:'Inside width of the bed.',affects:['geometry'],targets:['wood','iron']},
 {key:'wheelRadius',label:'Wheel radius',kind:'range',group:'shape',unit:'m',min:0.3,max:0.8,step:0.01,default:0.68,hint:'Rear (or only) wheel radius.',affects:['geometry'],targets:['wheel','iron']},
 {key:'spokes',label:'Spokes',kind:'integer',group:'construction',unit:'count',min:6,max:14,step:1,default:12,hint:'Spokes per wheel.',affects:['topology'],targets:['wheel']},
 {key:'sideHeight',label:'Side height',kind:'range',group:'shape',unit:'m',min:0.1,max:0.6,step:0.01,default:0.45,hint:'Height of the bed sides.',affects:['geometry'],targets:['wood']},
 choice('axles','Axles',['one','two'],'one','A two-wheeled cart or a four-wheeled wagon.',['wheel','iron']),
 choice('sides','Sides',['slats','boards'],'slats','Open stake-and-rail sides or closed plank sides.',['wood']),
 choice('hitch','Hitch',['shafts','tongue','handles'],'shafts','Twin shafts for one horse, a single tongue for a team, or push handles.',['wood']),
 choice('load','Load',['none','hay','sacks','barrels'],'hay','What is in the bed.',['load']),
 {key:'cover',label:'Canvas cover',kind:'toggle',group:'construction',unit:'none',default:false,hint:'Arched canvas bonnet over the bed.',affects:['topology'],targets:['canvas']},
];
export const cartWagonRecipe=forgeRecipe({
 id:'cart-wagon',version:'1.0.0',title:'Cart and wagon',description:'A horse-drawn farm cart or covered wagon with spoked wheels, hubs and axles, stake or plank sides, a hitch and an optional load.',category:'Vehicles',order:472,
 entry:'examples/recipes/cart-wagon/index.ts',exportName:'cartWagonRecipe',
 roles:{wood:'Bed, sides and hitch.',wheel:'Wheel felloes and spokes.',iron:'Tyres, hubs, axles and fittings.',canvas:'Bonnet cover or rolled tarp.',load:'Hay, sacks or barrels.'},
 palettes:{farm:{label:'Farm',colors:{wood:'#9a6a40',wheel:'#b5432f',iron:'#36312d',canvas:'#e9e0c8',load:'#d9b75a'}},prairie:{label:'Prairie',colors:{wood:'#3f5f7a',wheel:'#c0392b',iron:'#2e2b28',canvas:'#f1ead6',load:'#b08a5a'}},market:{label:'Market',colors:{wood:'#6b8f4e',wheel:'#d7a23a',iron:'#3a3632',canvas:'#c9533c',load:'#8c6a44'}}},
 roughness:{iron:0.5,canvas:0.95},metalness:{iron:0.65},autoGround:true,
 controls,
 presets:[
  {id:'hay-cart',name:'Hay cart',description:'Two big wheels, slatted sides, shafts and a mound of hay.',parameters:{}},
  {id:'covered-wagon',name:'Covered wagon',description:'Four-wheeled prairie wagon with plank sides, a tongue and an arched canvas bonnet.',parameters:{length:3.1,width:1.25,wheelRadius:0.72,spokes:14,sideHeight:0.5,axles:'two',sides:'boards',hitch:'tongue',load:'none',cover:true,colorway:'prairie'}},
  {id:'market-handcart',name:'Market handcart',description:'Small two-wheeled push cart with low plank sides, handles and sacks.',parameters:{length:1.25,width:0.8,wheelRadius:0.36,spokes:8,sideHeight:0.22,sides:'boards',hitch:'handles',load:'sacks',colorway:'market'}},
 ],
 constraints:['Wheels sit outside the bed; four-wheeled wagons use front wheels 80% of the rear radius.'],
 build(p,add){
  const L=Number(p.length),W=Number(p.width),R=Number(p.wheelRadius),S=Number(p.spokes),H=Number(p.sideHeight),two=p.axles==='two',random=rng(7);
  const frontR=two?R*0.8:R,bedY=two?R+0.08:R*0.92,floor=0.05,top=bedY+floor+H,wx=W/2+0.12;
  add('bed-floor','wood',box([W+0.06,floor,L],[0,bedY+floor/2,0],0.008));
  for(const s of [-1,1])add('sill-'+s,'wood',box([0.09,0.1,L+0.12],[s*(W/2-0.02),bedY-0.04,0],0.01),'bed-floor');
  const wheel=(name:string,x:number,z:number,r:number)=>{
   const tube=0.032,cy=r,s=Math.sign(x);
   add(name+'-tyre','iron',hoopX([x,cy,z],r-tube,tube,28,6),name+'-hub');
   add(name+'-felloe','wheel',hoopX([x,cy,z],r-tube*2.6,tube*1.1,28,5),name+'-tyre');
   add(name+'-hub','iron',latheX([[0.045,x-s*0.09],[0.085,x-s*0.05],[0.095,x],[0.075,x+s*0.07],[0.04,x+s*0.1]].sort((a,b)=>a[1]!-b[1]!) as Array<[number,number]>,10,[cy,z]),'axle');
   for(let i=0;i<S;i++){const a=(i+0.5)*2*Math.PI/S,dy=Math.cos(a),dz=Math.sin(a);
    add(name+'-spoke-'+i,'wheel',rod([x,cy+dy*0.07,z+dz*0.07],[x,cy+dy*(r-tube*3.2),z+dz*(r-tube*3.2)],0.022,6,0.016),name+'-hub');}
  };
  const axle=(z:number,r:number,name:string)=>{
   add(name,'iron',rod([-wx-0.02,r,z],[wx+0.02,r,z],0.035,8),'bed-floor');
   add(name+'-bolster','wood',box([W*0.9,Math.max(0.04,bedY-r-0.02)+0.04,0.12],[0,(r+bedY)/2-0.01,z],0.01),name);
   wheel(name+'-l',-wx,z,r);wheel(name+'-r',wx,z,r);
  };
  if(two){axle(-L*0.32,R,'axle');axle(L*0.32,frontR,'front-axle');}else axle(-L*0.05,R,'axle');
  // Sides.
  if(p.sides==='boards'){
   const boards=Math.max(1,Math.round(H/0.15)),bh=H/boards;
   for(const s of [-1,1])for(let b=0;b<boards;b++)add('side-'+s+'-'+b,'wood',box([0.035,bh-0.008,L],[s*(W/2+0.0175),bedY+floor+bh*(b+0.5),0],0.006),'bed-floor');
   for(const e of [-1,1])for(let b=0;b<boards;b++)add('end-'+e+'-'+b,'wood',box([W,bh-0.008,0.035],[0,bedY+floor+bh*(b+0.5),e*(L/2-0.0175)],0.006),'bed-floor');
   for(const s of [-1,1])for(const e of [-1,1])add('corner-'+s+'-'+e,'iron',box([0.05,H+0.02,0.05],[s*(W/2+0.03),bedY+floor+H/2,e*(L/2-0.01)],0.006),'bed-floor');
  } else {
   const stakes=Math.max(3,Math.round(L/0.42));
   for(const s of [-1,1]){
    for(let i=0;i<stakes;i++)add('stake-'+s+'-'+i,'wood',box([0.05,H+0.12,0.05],[s*(W/2+0.03),bedY+floor+H/2-0.05,-L/2+0.04+i*(L-0.08)/(stakes-1)],0.008),'bed-floor');
    for(const f of [0.45,1])add('rail-'+s+'-'+f,'wood',box([0.035,0.05,L+0.04],[s*(W/2+0.07),bedY+floor+H*f-0.025,0],0.006),'stake-'+s+'-0');
   }
   for(const e of [-1,1])add('endgate-'+e,'wood',box([W,H*0.5,0.035],[0,bedY+floor+H*0.25,e*(L/2-0.0175)],0.006),'bed-floor');
  }
  // Hitch.
  const hz=L/2+0.06;
  if(p.hitch==='shafts'){
   const len=2.3,endY=bedY+0.2;
   for(const s of [-1,1])add('shaft-'+s,'wood',rod([s*(W/2-0.04),bedY-0.04,L*0.1],[s*0.42,endY,hz+len],0.04,8,0.028),'bed-floor');
   add('shaft-bar','wood',box([0.92,0.06,0.07],[0,bedY+0.02,hz+0.55],0.008),'shaft--1');
   for(const s of [-1,1])add('tug-'+s,'iron',rod([s*0.49,endY-0.08,hz+len*0.55],[s*0.49,endY+0.06,hz+len*0.55],0.02,6),'shaft-'+s);
  } else if(p.hitch==='tongue'){
   const len=2.6,zt=two?L*0.32:0;
   add('tongue','wood',rod([0,frontR+0.02,zt],[0,0.62,hz+len],0.05,8,0.035),'front-axle');
   add('doubletree','wood',box([1.1,0.07,0.08],[0,0.66,hz+len-0.35],0.01),'tongue');
   for(const s of [-1,1])add('singletree-'+s,'wood',box([0.55,0.05,0.06],[s*0.45,0.66,hz+len-0.41],0.008),'doubletree');
  } else {
   for(const s of [-1,1]){
    add('handle-'+s,'wood',rod([s*(W/2-0.06),bedY-0.03,L*0.2],[s*(W/2-0.06),bedY+0.42,hz+0.95],0.032,8,0.026),'bed-floor');
    const ha:[number,number,number]=[s*(W/2-0.06),bedY-0.03,L*0.2],hb:[number,number,number]=[s*(W/2-0.06),bedY+0.42,hz+0.95],hl=Math.hypot(hb[1]-ha[1],hb[2]-ha[2]),at=(t:number):[number,number,number]=>[ha[0],ha[1]+(hb[1]-ha[1])*t,ha[2]+(hb[2]-ha[2])*t];
    // The grip is a sleeve on the handle's last 10%, carrying on 0.2 m past it at 30 mm radius, about 3 mm proud of the handle (coaxial and flush before, so the faces were coplanar)
    add('grip-'+s,'wood',rod(at(0.9),at(1+0.2/hl),0.03,8),'handle-'+s);
    add('leg-'+s,'wood',rod([s*(W/2-0.06),bedY-0.02,L/2-0.12],[s*(W/2-0.06),0,L/2+0.05],0.03,6),'bed-floor');
   }
   add('handle-bar','wood',rod([-(W/2-0.06),bedY+0.3,hz+0.66],[W/2-0.06,bedY+0.3,hz+0.66],0.022,6),'handle--1');
  }
  if(two||p.cover){add('seat','wood',box([W*0.9,0.05,0.3],[0,top+0.12,L/2-0.25],0.01),'bed-floor');for(const s of [-1,1])add('seat-post-'+s,'wood',box([0.05,H+0.13,0.05],[s*W*0.38,(top+0.12+bedY+floor-0.01)/2,L/2-0.25],0.006),'seat');add('footboard','wood',box([W*0.9,0.035,0.34],[0,bedY+floor+H*0.55,L/2+0.16],0.006),'bed-floor');}
  // Load.
  const ly=bedY+floor;
  if(p.load==='hay'){
   add('hay','load',lathe([[W*0.48,ly],[W*0.53,ly+H*0.9],[W*0.6,top+0.12],[W*0.5,top+0.32],[W*0.28,top+0.48],[0.05,top+0.55]],12,{squash:(L*0.98)/(W*1.2),phase:0.2}),'bed-floor');
   for(let i=0;i<5;i++){const z=(random()-0.5)*L*0.6,x=(random()-0.5)*W*0.5;
    // Tufts root inside the hay and poke out past its 0.55 apex, so they cross the hay surface (they floated in the hollow before)
    add('hay-tuft-'+i,'load',rod([x,top+0.3,z],[x+(random()-0.5)*0.4,top+0.62,z+(random()-0.5)*0.4],0.06,5,0.01),'hay');}
  } else if(p.load==='sacks'){
   const n=Math.max(2,Math.round(L/0.42));
   for(let i=0;i<n;i++){const z=-L/2+L*(i+0.5)/n,x=(i%2?0.12:-0.12)*W,tilt:[number,number]=[(random()-0.5)*0.2,(random()-0.5)*0.2];
    add('sack-'+i,'load',lathe([[0.13,ly-0.006],[0.19,ly+0.09],[0.17,ly+0.26],[0.08,ly+0.36],[0.03,ly+0.4]],8,{center:[x,z],squash:0.8,tilt}),'bed-floor');
    
    // The tie shares the sack's squash and tilt, and its band runs from inside the neck to 4 mm proud, so it grips the cloth instead of floating in the hollow neck
    add('sack-tie-'+i,'iron',lathe([[0.08,ly+0.34],[0.1,ly+0.35],[0.066,ly+0.375]],8,{center:[x,z],squash:0.8,tilt}),'sack-'+i);}
  } else if(p.load==='barrels'){
   const n=Math.max(2,Math.round(L/0.6));
   for(let i=0;i<n;i++){const z=-L/2+L*(i+0.5)/n,r=Math.min(0.26,W*0.22);for(const s of [-1,1]){const x=s*W*0.24;
    add('barrel-'+i+'-'+s,'load',lathe([[r*0.85,ly+0.002],[r,ly+0.3],[r*0.85,ly+0.6]],12,{center:[x,z]}),'bed-floor');
    for(const y of [0.08,0.52])add('barrel-hoop-'+i+'-'+s+'-'+y,'iron',lathe([[r*(y<.3?0.9:0.9)+0.008,ly+y],[r*0.96+0.008,ly+y+0.04]],12,{center:[x,z]}),'barrel-'+i+'-'+s);}}
  }
  if(!p.cover){// Rolled tarp strapped behind the front board.
   const ty=bedY+floor+0.09,tz=L/2-0.14;add('tarp-roll','canvas',rod([-W*0.42,ty,tz],[W*0.42,ty,tz],0.085,8),'bed-floor');
   for(const s of [-1,1])add('tarp-strap-'+s,'iron',latheX([[0.093,s*W*0.25-0.02],[0.093,s*W*0.25+0.02]],8,[ty,tz]),'tarp-roll');}
  if(p.cover){
   const arc=12,R0=W/2+0.07,th=0.02,y0=top-0.04,stations=9;
   const loops=Array.from({length:stations},(_,k)=>{const t=k/(stations-1),z=-L/2+0.05+t*(L-0.1),flare=1+0.18*(Math.abs(2*t-1))**3,r=R0*flare,rise=R0*1.05*flare;
    const outer=Array.from({length:arc},(_,i)=>{const a=Math.PI*i/(arc-1);return [Math.cos(a)*r,y0+Math.sin(a)*rise,z] as V3;});
    const inner=Array.from({length:arc},(_,i)=>{const a=Math.PI*(1-i/(arc-1));return [Math.cos(a)*(r-th),y0+Math.sin(a)*(rise-th),z] as V3;});
    return [...outer,...inner];});
   add('bonnet','canvas',loopLoft(loops,'strip'),'bed-floor');
   for(let k=1;k<stations-1;k+=2){const t=k/(stations-1),z=-L/2+0.05+t*(L-0.1),flare=1+0.18*(Math.abs(2*t-1))**3,r=R0*flare+0.008,rise=R0*1.05*flare+0.008;
    add('bow-rib-'+k,'wood',(()=>{const pts=Array.from({length:arc},(_,i)=>{const a=Math.PI*i/(arc-1);return {center:[Math.cos(a)*r,y0+Math.sin(a)*rise,z] as [number,number,number],radius:0.018};});return rodPath(pts);})(),'bonnet');}
  }
  return {hitch:[0,bedY,hz]};
 },
});
import { taperedSweep } from '../../../src/engine/geometry.ts';
function rodPath(stations:Array<{center:[number,number,number];radius:number}>){return taperedSweep(stations,5);}

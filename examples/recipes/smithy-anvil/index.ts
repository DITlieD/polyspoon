import { box, forgeRecipe, lathe, rod } from '../../../src/engine/forge-kit.ts';
import { profileSolid } from '../../../src/engine/geometry.ts';
import { arc, place } from '../../../src/engine/forge-props.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'length',label:'Anvil length',kind:'range',group:'shape',unit:'m',min:0.5,max:0.9,step:0.01,default:0.7,hint:'Heel to horn tip.',affects:['geometry'],targets:['iron','steel']},
 {key:'standHeight',label:'Stand height',kind:'range',group:'shape',unit:'m',min:0.3,max:0.6,step:0.01,default:0.42,hint:'Ground to the anvil foot.',affects:['geometry'],targets:['wood','stone','band']},
 {key:'stand',label:'Stand',kind:'choice',group:'construction',unit:'none',default:'stump',options:[{value:'stump',label:'Banded stump'},{value:'block',label:'Stone block'},{value:'legs',label:'Iron stand'}],hint:'What the anvil sits on.',affects:['topology'],targets:['wood','stone','band']},
 {key:'horns',label:'Horns',kind:'choice',group:'construction',unit:'none',default:'single',options:[{value:'single',label:'Horn and heel'},{value:'double',label:'Double horn (bickern)'}],hint:'London pattern or double-horn anvil.',affects:['topology'],targets:['iron']},
 {key:'tools',label:'Tools',kind:'choice',group:'construction',unit:'none',default:'hammer-tongs',options:[{value:'hammer-tongs',label:'Hammer and tongs'},{value:'horseshoes',label:'Farrier hammer and horseshoes'},{value:'none',label:'None'}],hint:'Tools laid on or around the anvil.',affects:['topology'],targets:['steel','wood']},
 {key:'bucket',label:'Quench bucket',kind:'toggle',group:'construction',unit:'none',default:true,hint:'A staved water bucket beside the stand (holds the tongs).',affects:['topology'],targets:['wood','band','water']},
];
export const smithyAnvilRecipe=forgeRecipe({
 id:'smithy-anvil',version:'1.0.0',title:'Smithy anvil',description:'A forged anvil with horn, heel and hardened face on a banded stump, block or iron stand, with hammer, tongs, horseshoes and a quench bucket.',category:'Props',order:410,
 entry:'examples/recipes/smithy-anvil/index.ts',exportName:'smithyAnvilRecipe',
 roles:{iron:'Anvil body.',steel:'Hardened face and tool heads.',wood:'Stump, handles and bucket staves.',band:'Iron hoops and stand.',stone:'Stone block.',water:'Quench water.'},
 palettes:{forge:{label:'Forge black',colors:{iron:'#2e2f31',steel:'#8d9196',wood:'#7a5233',band:'#3a3633',stone:'#7d7870',water:'#3d6676'}},rusty:{label:'Rusty',colors:{iron:'#5b3a2a',steel:'#9a8f86',wood:'#8c6a48',band:'#4a2f22',stone:'#8b8174',water:'#4f6b62'}},blued:{label:'Blued steel',colors:{iron:'#2b3440',steel:'#a9b3bd',wood:'#6b4a35',band:'#262b31',stone:'#6f7278',water:'#36607a'}}},
 roughness:{iron:0.55,steel:0.35,band:0.5,water:0.1},metalness:{iron:0.75,steel:0.85,band:0.7},
 controls,
 presets:[
  {id:'smithy',name:'Village smithy',description:'Horn anvil on a banded stump with hammer, tongs and a quench bucket.',parameters:{}},
  {id:'farrier',name:'Farrier block',description:'Short anvil on a stone block with horseshoes.',parameters:{length:0.56,standHeight:0.5,stand:'block',tools:'horseshoes',bucket:false,colorway:'rusty'}},
  {id:'bickern',name:'Bickern on iron stand',description:'Long double-horn anvil on a splayed iron stand.',parameters:{length:0.86,standHeight:0.36,stand:'legs',horns:'double',bucket:false,colorway:'blued'}},
 ],
 constraints:['The anvil foot is sunk 1 cm into the stand; the face plate stands 9 mm proud; tools rest 3 mm into the face.'],
 build(p,add){
  const L=Number(p.length),s=Number(p.standHeight),k=L/0.7,R=0.17*k+0.05;
  // Stand
  if(p.stand==='stump'){
   add('stump','wood',lathe([[R+0.04,0],[R+0.015,0.05],[R,s*0.4],[R,s]],11,{phase:0.2}));
   for(const [i,y] of [[0,s-0.075],[1,s*0.35]] as const)add('stump-hoop-'+i,'band',lathe([[R+0.008,y],[R+0.008,y+0.03]],11,{phase:0.2}),'stump');
  }else if(p.stand==='block'){
   add('block','stone',box([R*2.1,s-0.04,R*1.8],[0,(s-0.04)/2,0],0.03));
   add('block-cap','stone',box([R*1.9,0.05,R*1.6],[0,s-0.03,0],0.012),'block');
  }else{
   add('stand-plate','band',box([0.38*k,0.03,0.28*k],[0,s-0.015,0],0.008));
   for(const sx of [-1,1])for(const sz of [-1,1]){
    add('stand-leg-'+sx+sz,'band',rod([sx*0.15*k,s-0.02,sz*0.1*k],[sx*0.24*k,0.016,sz*0.17*k],0.018,6),'stand-plate');
    add('stand-foot-'+sx+sz,'band',box([0.07,0.02,0.07],[sx*0.24*k,0.01,sz*0.17*k],0.004),'stand-leg-'+sx+sz);
   }
   const legAt=(sx:number,sz:number,t:number):[number,number,number]=>[sx*(0.15+0.09*t)*k,s-0.02+(0.016-s+0.02)*t,sz*(0.1+0.07*t)*k];
   for(const sz of [-1,1])add('stand-stretcher-x'+sz,'band',rod(legAt(-1,sz,0.68),legAt(1,sz,0.68),0.012,6),'stand-leg-1'+sz);
   for(const sx of [-1,1])add('stand-stretcher-z'+sx,'band',rod(legAt(sx,-1,0.68),legAt(sx,1,0.68),0.012,6),'stand-leg-'+sx+'1');
  }
  add('whetstone','stone',place(box([0.16,0.035,0.05],[0,0.0175,0],0.006),[0,0.5,0],[R+0.16,0,-0.2]));
  // Anvil
  const y0=s-0.01,yb=y0+0.235,yf=yb+0.06;
  add('anvil-body','iron',profileSolid([{y:y0,width:0.26*k,depth:0.18*k,chamfer:0.02},{y:y0+0.035,width:0.24*k,depth:0.16*k,chamfer:0.02},{y:y0+0.1,width:0.15*k,depth:0.1*k,chamfer:0.015},{y:y0+0.17,width:0.14*k,depth:0.1*k,chamfer:0.015},{y:yb,width:0.22*k,depth:0.125*k,chamfer:0.015}]));
  for(const sx of [-1,1])for(const sz of [-1,1])add('anvil-foot-'+sx+sz,'iron',profileSolid([{y:y0-0.005,width:0.1*k,depth:0.08*k,chamfer:0.01},{y:y0+0.05,width:0.07*k,depth:0.05*k,chamfer:0.01}]).translate(sx*0.135*k,0,sz*0.09*k),'anvil-body');
  const faceLen=(p.horns==='double'?0.36:0.44)*k;
  add('anvil-face','iron',box([faceLen,0.075,0.135*k],[p.horns==='double'?0:-0.03*k,yf-0.0375,0],0.008),'anvil-body');
  add('face-plate','steel',box([faceLen-0.025,0.014,0.122*k],[p.horns==='double'?0:-0.03*k,yf+0.002,0],0.003),'anvil-face');
  const hornLen=(p.horns==='double'?0.25:0.27)*k,hx=(p.horns==='double'?faceLen/2:faceLen/2-0.03*k)-0.02;
  const horn=(sides:number,phase:number)=>lathe([[0.056*k,0],[0.05*k,0.07*k],[0.036*k,0.15*k],[0.02*k,0.22*k],[0.006,hornLen]],sides,{phase,tilt:[0.14,0]});
  add('horn','iron',place(horn(9,0),[0,0,-Math.PI/2],[hx,yf-0.064*k,0]),'anvil-face');
  if(p.horns==='double')add('square-horn','iron',place(horn(4,Math.PI/4),[0,0,Math.PI/2],[-hx,yf-0.064*k,0]),'anvil-face');
  else{
   const heelX=-faceLen/2-0.03*k;
   add('heel','iron',profileSolid([{y:-0.03,width:0.14*k,depth:0.11*k,chamfer:0.008},{y:0.03,width:0.14*k,depth:0.11*k,chamfer:0.008}]).translate(heelX-0.02*k,yf-0.035,0),'anvil-face');
   add('heel-step','iron',box([0.05*k,0.05,0.125*k],[hx-0.03*k,yf-0.03,0],0.006),'anvil-face');
  }
  const top=yf+0.009;
  // Tools
  if(p.tools==='hammer-tongs'){
   const hy=top+0.017;
   add('hammer-head','steel',box([0.038,0.038,0.13],[-0.09*k,hy,-0.01],0.005),'face-plate');
   add('hammer-peen','steel',lathe([[0.016,0],[0.004,0.04]],6).rotateX(-Math.PI/2).translate(-0.09*k,hy,-0.072),'hammer-head'); // root 3 mm inside the head (it butted flush on the end face)
   add('hammer-handle','wood',rod([-0.09*k,hy,0.02],[0.02*k,hy+0.004,0.33],0.014,7,0.012),'hammer-head');
  }else if(p.tools==='horseshoes'){
   for(const [i,cx,cz,rot] of [[0,-0.06*k,0,0.4],[1,0.07*k,0.01,-0.9]] as const){
    const r=0.05,u:[number,number,number]=[Math.cos(rot),0,Math.sin(rot)],v:[number,number,number]=[-Math.sin(rot),0,Math.cos(rot)];
    add('horseshoe-'+i,'band',arc([cx,top+0.006,cz],r,-0.35*Math.PI,1.35*Math.PI,12,0.009,u,v,5),'face-plate');
   }
   add('farrier-hammer','steel',box([0.03,0.03,0.09],[0.0,top+0.012,0.11*k],0.004),'face-plate');
   add('farrier-handle','wood',rod([0,top+0.012,0.14*k],[0.12,top+0.016,0.36*k],0.011,6),'farrier-hammer');
  }
  // Quench bucket holding the tongs
  const tongs=(base:[number,number,number],tip:[number,number,number],parent:string)=>{
   for(const off of [-1,1]){
    const b:[number,number,number]=[base[0]+off*0.018,base[1],base[2]],m:[number,number,number]=[tip[0]-off*0.012,tip[1],tip[2]+off*0.01];
    add('tongs-rein-'+(off>0?'a':'b'),'band',rod(b,m,0.008,5),parent);
    // The jaw root is 12.5 mm against the 8 mm rein so the two near-coaxial rods never share faces.
    add('tongs-jaw-'+(off>0?'a':'b'),'band',rod([b[0]+(m[0]-b[0])*0.94,b[1]+(m[1]-b[1])*0.94,b[2]+(m[2]-b[2])*0.94],[m[0]+off*0.02,m[1]+0.07,m[2]-0.015],0.0125,5,0.007),'tongs-rein-'+(off>0?'a':'b'));
   }
   add('tongs-rivet','band',lathe([[0.012,0],[0.012,0.03]],6).rotateX(Math.PI/2).translate(tip[0],tip[1]-0.004,tip[2]-0.015),'tongs-rein-a');
  };
  if(p.bucket){
   const bx=-(R+0.27),bz=0.1,br=0.15,bh=0.34,n=13,t=0.022;
   for(let i=0;i<n;i++){const a=i*2*Math.PI/n;add('bucket-stave-'+i,'wood',place(box([2*Math.PI*br/n+0.006,bh,t],[0,bh/2,0],0.003),[0,-a+Math.PI/2,0],[bx+Math.cos(a)*br,0,bz+Math.sin(a)*br]));}
   add('bucket-water','water',lathe([[br-t/2+0.004,0.004],[br-t/2+0.004,bh-0.05]],n,{center:[bx,bz]}),'bucket-stave-0');
   for(const [i,y] of [[0,0.05],[1,bh-0.09]] as const)add('bucket-hoop-'+i,'band',lathe([[br+t/2+0.012,y],[br+t/2+0.012,y+0.028]],n,{center:[bx,bz],phase:Math.PI/n}),'bucket-stave-0');
   add('bucket-bail','band',arc([bx,bh-0.076,bz],br+t/2+0.01,-0.02*Math.PI,1.02*Math.PI,12,0.007,[1,0,0],[0,1,0.0],5),'bucket-hoop-1');
   if(p.tools==='hammer-tongs')tongs([bx,0.12,bz],[bx+0.04,0.58,bz+0.04],'bucket-water');
  }else if(p.tools==='hammer-tongs'){
   const r=p.stand==='legs'?0.24*k:R+0.03;
   // Feet within 1 mm of the ground (they hovered 4 mm up) and jaws leaning into the stand's top plate (they stood 4 cm clear of everything).
   tongs([r+0.12,0.0045,0.16],[r-(p.stand==='legs'?0.03:0.01),s-0.04,0.12],p.stand==='stump'?'stump':p.stand==='block'?'block':'stand-plate');
  }
  return {face:[0,top,0]};
 },
});

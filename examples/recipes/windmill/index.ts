import { box, forgeRecipe, lathe, rod } from '../../../src/engine/forge-kit.ts';
import { apothem, beam, faceFrontPhase, place, prism } from '../../../src/engine/forge-kit-structures.ts';
import { closedSweep } from '../../../src/engine/geometry.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'type',label:'Mill type',kind:'choice',group:'construction',unit:'none',default:'tower',options:[{value:'tower',label:'Round stone tower'},{value:'smock',label:'Eight-sided smock'},{value:'post',label:'Post mill on trestle'}],hint:'Tower and smock mills turn only the cap; a post mill turns its whole body on a trestle.',affects:['topology'],targets:['body','cap','trestle']},
 {key:'height',label:'Body height',kind:'range',group:'shape',unit:'m',min:6,max:12,step:0.1,default:8.5,hint:'Ground to the top of the body (cap and sails extra).',affects:['geometry'],targets:['body','cap','sail']},
 {key:'radius',label:'Base radius',kind:'range',group:'shape',unit:'m',min:1.6,max:3,step:0.05,default:2.2,hint:'Body radius at the ground (post mills use it for half the body depth).',affects:['geometry'],targets:['body']},
 {key:'taper',label:'Taper',kind:'range',group:'shape',unit:'ratio',min:0,max:0.4,step:0.01,default:0.28,hint:'How much narrower the top is than the base.',affects:['geometry'],targets:['body']},
 {key:'sails',label:'Sails',kind:'integer',group:'construction',unit:'count',min:4,max:6,step:1,default:4,hint:'Number of lattice sails.',affects:['topology'],targets:['sail']},
 {key:'sailLength',label:'Sail length',kind:'range',group:'shape',unit:'m',min:3,max:6.5,step:0.1,default:4.8,hint:'Hub to sail tip.',affects:['geometry'],targets:['sail']},
 {key:'cap',label:'Cap shape',kind:'choice',group:'construction',unit:'none',default:'cone',options:[{value:'cone',label:'Cone'},{value:'ogee',label:'Ogee dome'},{value:'boat',label:'Boat gable'}],hint:'Roof over the turning machinery.',affects:['topology'],targets:['cap']},
 {key:'gallery',label:'Reefing gallery',kind:'toggle',group:'construction',unit:'none',default:false,hint:'A railed walkway around the body for setting the sails.',affects:['topology'],targets:['gallery']},
];
export const windmillRecipe=forgeRecipe({
 id:'windmill',version:'1.0.0',title:'Windmill',description:'A working windmill with lattice sails and cloth: round stone tower, eight-sided smock, or a post mill on a timber trestle.',category:'Buildings',order:200,
 entry:'examples/recipes/windmill/index.ts',exportName:'windmillRecipe',
 roles:{wall:'Tower or body walls.',roof:'Cap or body roof.',timber:'Stocks, lattice, trestle, gallery and trim.',cloth:'Sail cloth.',dark:'Door and windows.'},
 palettes:{
  flour:{label:'Flour mill',colors:{wall:'#d8cfbd',roof:'#6b4b37',timber:'#5b4130',cloth:'#efe6d2',dark:'#2f2a26'}},
  dutch:{label:'Dutch smock',colors:{wall:'#3f5a4a',roof:'#3a3532',timber:'#e8e3d6',cloth:'#b5523a',dark:'#22251f'}},
  weathered:{label:'Weathered timber',colors:{wall:'#8b7660',roof:'#55504a',timber:'#4a3a2c',cloth:'#cdbfa2',dark:'#2b2622'}},
 },
 roughness:{cloth:1},
 controls,
 presets:[
  {id:'tower-mill',name:'Stone tower mill',description:'Tapered round stone tower, conical cap, four sails.',parameters:{}},
  {id:'smock-mill',name:'Smock mill',description:'Tall eight-sided smock with an ogee cap, reefing gallery and five sails.',parameters:{type:'smock',height:10.5,radius:2.6,taper:0.36,sails:5,sailLength:5.3,cap:'ogee',gallery:true,colorway:'dutch'}},
  {id:'post-mill',name:'Post mill',description:'Boxy timber body with a gable roof on an open trestle.',parameters:{type:'post',height:7,radius:2,taper:0,sailLength:3.8,cap:'boat',colorway:'weathered'}},
 ],
 constraints:['Sail tips must clear the ground by at least 0.6 m.'],
 check(p){
  const H=Number(p.height),L=Number(p.sailLength),hub=p.type==='post'?H*0.3+0.15+H*0.5*0.72:H+0.45;
  if(hub-L<0.6-1e-9)throw new Error('Sails too long for this height: tips would reach the ground');
 },
 build(p,add){
  const H=Number(p.height),R=Number(p.radius),taper=Number(p.taper),n=Number(p.sails),L=Number(p.sailLength),type=String(p.type);
  let hubY:number,hubZ:number,top:number;
  if(type==='post'){
   // Trestle: crossed sills on piers, quarter bars to a central post, body box on top.
   const hb=H*0.3,bh=H*0.5,w=R*1.15,d=R*1.5;
   for(const a of [0,Math.PI/2]){const c=Math.cos(a),s=Math.sin(a),l=R*1.1;add('sill-'+(a?1:0),'timber',beam([-c*l,0.32+(a?0.1:0),-s*l],[c*l,0.32+(a?0.1:0),s*l],0.2,0.22),'trestle');}
   for(const [i,[x,z]] of ([[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]).entries()){
    add('pier-'+i,'wall',box([0.5,0.3,0.5],[x*R*1.0,0.15,z*R*1.0],0.03));
    add('quarter-bar-'+i,'timber',beam([x*R*0.95,0.45,z*R*0.95],[x*0.18,hb*0.72,z*0.18],0.16,0.16),'trestle');
   }
   add('post','timber',lathe([[0.24,0.2],[0.22,hb],[0.2,hb+0.15]],10),'trestle');
   add('body','wall',box([w*2,bh,d*2],[0,hb+0.15+bh/2,0],0.03),'post');
   const ry=hb+0.15+bh;
   add('roof','roof',place(prism([[-w-0.18,0],[w+0.18,0],[0.06,w*0.62],[-0.06,w*0.62]],d*2+0.3),[0,ry-0.02,0]),'body');
   for(const s of [-1,1])for(const k of [0.25,0.62])add('weather-board-'+(s>0?'r':'l')+'-'+k,'timber',box([0.04,0.08,d*2-0.1],[s*(w+0.02),hb+0.15+bh*k,0],0.01),'body');
   // Rear door, steps and tail pole down to the ground.
   add('door','dark',box([0.75,1.3,0.06],[0,hb+0.15+0.75,-d-0.02],0.01),'body');
   const back=-d-0.05;
   // Tilted beams' feet: solve the foot height so the lowest edge (half the beam height times the tilt) lands on y=0. They stopped a few
   // centimetres above the ground.
   const footY=(half:number,top:number,run:number)=>{let y=0.01;for(let it=0;it<5;it++)y=half*Math.abs(run)/Math.hypot(top-y,run);return y;};
   for(const s of [-1,1])add('ladder-stile-'+(s>0?'r':'l'),'timber',beam([s*0.4,footY(0.04,hb+0.15,hb*0.95),back-hb*0.95],[s*0.4,hb+0.15,back],0.08,0.07),'body');
   const steps=Math.max(4,Math.round((hb+0.15)/0.32));
   for(let i=1;i<steps;i++){const t=i/steps;add('ladder-step-'+i,'timber',box([0.76,0.04,0.2],[0,t*(hb+0.15),back-hb*0.95*(1-t)],0.006),'ladder');}
   add('tail-pole','timber',beam([0,footY(0.08,hb+0.4,(-d+0.1)-(back-hb*1.25)),back-hb*1.25],[0,hb+0.4,-d+0.1],0.16,0.14),'body');
   add('window','dark',box([0.5,0.5,0.06],[w*0.35,hb+0.15+bh*0.62,d+0.02],0.01),'body');
   hubY=hb+0.15+bh*0.72;hubZ=d+0.45;top=ry+w*0.62;
  }else{
   const sides=type==='tower'?16:8,ph=faceFrontPhase(sides),rt=R*(1-taper),r=(y:number)=>R-(R-rt)*y/H;
   add('plinth','dark',lathe([[R+0.12,0],[R+0.12,0.35],[R+0.02,0.45]],sides,{phase:ph}),'body');
   if(type==='smock'){
    add('brick-base','wall',lathe([[R+0.06,0.3],[R+0.06,1.2]],sides,{phase:ph}),'body');
    add('body','wall',lathe([[R,1.1],[r(H*0.5),H*0.5],[rt,H]],sides,{phase:ph}));
    for(let i=0;i<sides;i++){const a=ph+i*2*Math.PI/sides;add('corner-post-'+i,'timber',beam([Math.cos(a)*(R+0.03),1.2,Math.sin(a)*(R+0.03)],[Math.cos(a)*(rt+0.03),H-0.05,Math.sin(a)*(rt+0.03)],0.12,0.12),'body');}
   }else{
    add('body','wall',lathe([[R,0.35],[r(H*0.33),H*0.33],[r(H*0.66),H*0.66],[rt,H]],sides,{phase:ph}));
    for(const y of [H*0.33,H*0.66])add('string-course-'+Math.round(y*10),'dark',lathe([[r(y)+0.05,y-0.06],[r(y+0.06)+0.05,y+0.06]],sides,{phase:ph}),'body');
   }
   add('curb','timber',lathe([[rt+0.12,H-0.05],[rt+0.12,H+0.12]],sides,{phase:ph}),'body');
   const cap=String(p.cap),cb=H+0.1;
   if(cap==='boat'){add('cap','roof',place(prism([[-rt-0.25,0],[rt+0.25,0],[0.08,rt*0.95],[-0.08,rt*0.95]],rt*2+0.9),[0,cb,-0.15]),'curb');top=cb+rt*0.95;}
   else if(cap==='ogee'){add('cap','roof',lathe([[rt+0.2,cb],[rt+0.24,cb+0.35],[rt*0.85,cb+0.9],[rt*0.45,cb+1.3],[rt*0.2,cb+1.65],[0.05,cb+1.9]],16),'curb');add('finial','timber',lathe([[0.12,cb+1.85],[0.14,cb+1.98],[0.02,cb+2.25]],8),'cap');top=cb+2.25;}
   else{add('cap','roof',lathe([[rt+0.25,cb],[rt+0.25,cb+0.18],[0.05,cb+rt*1.25]],sides,{phase:ph}),'curb');add('finial','timber',lathe([[0.1,cb+rt*1.22],[0.12,cb+rt*1.25+0.05],[0.02,cb+rt*1.25+0.3]],8),'cap');top=cb+rt*1.25+0.3;}
   // Fantail on the back of the cap keeps it into the wind.
   add('fantail-strut','timber',beam([0,cb+0.3,-rt*0.6],[0,cb+0.6,-rt-1.3],0.1,0.1),'cap');
   for(let i=0;i<6;i++){const a=i*Math.PI/3;add('fantail-blade-'+i,'cloth',place(box([0.05,0.55,0.04],[0,0.3,0],0.008),[0,cb+0.6,-rt-1.3],[0,0,a]),'fantail-strut');}
   // Door and windows on the sail side; they follow the taper.
   const ap=(y:number)=>apothem(r(y),sides);
   // The door is tilted to the wall batter so it stands an even 40 mm proud (upright, its foot sank into the battered wall and left a notch).
   const doorBatter=Math.atan((ap(0.45)-ap(2.4))/1.95),door=box([0.95,1.95,0.14],[0,0,0],0.01);door.rotateX(-doorBatter);door.translate(0,0.45+0.98,ap(1.43)-0.03);
   add('door','dark',door,'body');
   add('door-lintel','timber',box([1.2,0.14,0.2],[0,2.5,ap(2.5)-0.02],0.01),'body');
   for(const [i,y] of [Math.max(H*0.45,3.4),H*0.75].entries())add('window-'+i,'dark',box([0.55,0.75,0.14],[0,y,ap(y)-0.03],0.01),'body');
   add('side-window','dark',place(box([0.5,0.65,0.14],[0,0,ap(H*0.58)-0.03],0.01),[0,H*0.58,0],[0,Math.PI*0.5,0]),'body');
   if(p.gallery){
    const gy=Math.min(H*0.38,H-3),gr=r(gy)+1.0;
    add('gallery-deck','timber',lathe([[gr,gy],[gr,gy+0.12]],sides,{phase:ph}),'body');
    const posts=sides*2;
    for(let i=0;i<posts;i++){const a=ph+(i+0.5)*2*Math.PI/posts,pr=gr*Math.cos(Math.PI/sides)-0.08;add('gallery-post-'+i,'timber',rod([Math.cos(a)*pr,gy+0.1,Math.sin(a)*pr],[Math.cos(a)*pr,gy+1.05,Math.sin(a)*pr],0.035,6),'gallery-deck');}
    add('gallery-rail','timber',closedSweep(Array.from({length:posts},(_,i)=>{const a=ph+(i+0.5)*2*Math.PI/posts;return {center:[Math.cos(a)*(gr*Math.cos(Math.PI/sides)-0.08),gy+1.05,Math.sin(a)*(gr*Math.cos(Math.PI/sides)-0.08)] as [number,number,number],radius:0.045};}),6),'gallery-deck');
    for(let i=0;i<sides;i++){const a=ph+i*2*Math.PI/sides;add('gallery-brace-'+i,'timber',beam([Math.cos(a)*(r(gy-1.1)-0.02),gy-1.1,Math.sin(a)*(r(gy-1.1)-0.02)],[Math.cos(a)*(gr-0.2),gy+0.06,Math.sin(a)*(gr-0.2)],0.1,0.1),'body');} // top ends mid-deck (at 20 mm up its end cut poked out under the deck)
   }
   hubY=H+0.45;
   // Shaft long enough that the sails clear the widest part of the body they sweep past.
   hubZ=Math.max(rt+0.75,r(Math.max(0,hubY-L))+0.45);
  }
  add('windshaft','timber',rod([0,hubY-0.05,hubZ-1.2],[0,hubY,hubZ+0.1],0.17,10),type==='post'?'body':'cap');
  add('hub','dark',place(lathe([[0.32,-0.2],[0.34,0],[0.28,0.2]],8),[0,hubY,hubZ+0.12],[Math.PI/2,0,0]),'windshaft');
  const sz=hubZ+0.3,w=Math.min(1.25,L*0.24),start=L*0.2,len=L-start;
  for(let i=0;i<n;i++){
   const a=Math.PI/4+i*2*Math.PI/n,rot:[number,number,number]=[0,0,a],P:[number,number,number]=[0,hubY,sz];
   add('stock-'+i,'timber',place(box([0.16+i*0.008,L+0.15,0.14+i*0.008],[0,(L+0.15)/2-0.15,0],0.01),P,rot),'hub');
   add('sail-'+i+'-leading-rail','timber',place(box([0.06,len,0.08],[0.08+w,start+len/2,0],0.006),P,rot),'stock-'+i);
   add('sail-'+i+'-cloth','cloth',place(box([w-0.04,len*0.94,0.025],[0.1+w/2,start+len*0.5,-0.04],0.004),P,rot),'stock-'+i);
   const bars=Math.max(5,Math.round(len/0.55));
   for(let k=0;k<=bars;k++)add('sail-'+i+'-bar-'+k,'timber',place(box([w+0.04,0.045,0.05],[0.08+w/2,start+len*k/bars,0.005],0.005),P,rot),'stock-'+i);
  }
  return {top:[0,top,0],hub:[0,hubY,sz]};
 },
});

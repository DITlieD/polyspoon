import { box, forgeRecipe, rod } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import { gunwaleLine, halfBeam, hullEndBoard, hullInnerX, hullKeel, hullPoint, hullShell, hullTop, type HullSpec } from '../../../src/engine/forge-hull.ts';
import type { Control } from '../../../src/engine/parameters.ts';
import { Vector3 } from 'three';

const ends=(key:string,label:string,options:string[],value:string):Control=>({key,label,kind:'choice',group:'construction',unit:'none',default:value,options:options.map(v=>({value:v,label:v[0]!.toUpperCase()+v.slice(1)})),hint:label+' shape.',affects:['geometry'],targets:['hull']});
const controls:Control[]=[
 {key:'length',label:'Length',kind:'range',group:'shape',unit:'m',min:2.2,max:4.6,step:0.05,default:2.7,hint:'Stem to stern.',affects:['geometry'],targets:['hull','rail','seat']},
 {key:'beam',label:'Beam',kind:'range',group:'shape',unit:'m',min:0.4,max:1.3,step:0.01,default:1.1,hint:'Widest outside width.',affects:['geometry'],targets:['hull','rail','seat']},
 {key:'depth',label:'Depth',kind:'range',group:'shape',unit:'m',min:0.25,max:0.55,step:0.01,default:0.42,hint:'Keel to gunwale amidships.',affects:['geometry'],targets:['hull']},
 {key:'sheer',label:'Sheer',kind:'range',group:'shape',unit:'m',min:0,max:0.35,step:0.01,default:0.14,hint:'How much the gunwale rises toward the ends.',affects:['geometry'],targets:['hull','rail']},
 {key:'rocker',label:'Rocker',kind:'range',group:'shape',unit:'m',min:0,max:0.2,step:0.01,default:0.06,hint:'How much the keel lifts toward the ends.',affects:['geometry'],targets:['hull']},
 {key:'roundness',label:'Hull section',kind:'range',group:'shape',unit:'ratio',min:2,max:6,step:0.1,default:2.6,hint:'2 is a round bilge, 6 a flat-bottomed box section.',affects:['geometry'],targets:['hull']},
 ends('bow','Bow',['pointed','square'],'pointed'),ends('stern','Stern',['pointed','transom','square'],'transom'),
 {key:'thwarts',label:'Thwarts',kind:'integer',group:'construction',unit:'count',min:0,max:4,step:1,default:2,hint:'Cross seats.',affects:['topology'],targets:['seat']},
 {key:'gear',label:'Gear',kind:'choice',group:'construction',unit:'none',default:'oars',options:[{value:'none',label:'None'},{value:'oars',label:'Oars'},{value:'paddle',label:'Paddle'},{value:'pole',label:'Punt pole'}],hint:'What lies in the boat.',affects:['topology'],targets:['seat','metal']},
];
export const rowboatRecipe=forgeRecipe({
 id:'rowboat',version:'1.0.0',title:'Rowboat',description:'An open plank boat with a real hollow hull, gunwale rails, thwarts, floorboards and oars, paddle or punt pole.',category:'Vehicles',order:471,
 entry:'examples/recipes/rowboat/index.ts',exportName:'rowboatRecipe',
 roles:{hull:'Hull planking.',rail:'Gunwale rails, keel strip and painted stripe.',seat:'Thwarts, floorboards and oars.',metal:'Oarlocks and bow ring.'},
 palettes:{harbor:{label:'Harbor blue',colors:{hull:'#2f5d7c',rail:'#e8e1cf',seat:'#a9784a',metal:'#3b3a38'}},varnish:{label:'Varnished',colors:{hull:'#9b6537',rail:'#6e4425',seat:'#c39762',metal:'#8a6a35'}},fisher:{label:'Fisher red',colors:{hull:'#a8382c',rail:'#f0e9d8',seat:'#8f6a45',metal:'#3b3a38'}},forest:{label:'Forest green',colors:{hull:'#2f5a3c',rail:'#c9a36a',seat:'#b48956',metal:'#2c2b29'}}},
 roughness:{metal:0.5,hull:0.75},autoGround:true,metalness:{metal:0.7},
 controls,
 presets:[
  {id:'dinghy',name:'Harbor dinghy',description:'Short beamy dinghy with a transom and a pair of oars.',parameters:{}},
  {id:'canoe',name:'Canoe',description:'Long narrow double-ended canoe with high ends and a paddle.',parameters:{length:4.2,beam:0.82,depth:0.34,sheer:0.3,rocker:0.08,roundness:2.2,stern:'pointed',thwarts:2,gear:'paddle',colorway:'varnish'}},
  {id:'punt',name:'Flat punt',description:'Square-ended flat-bottomed punt with raked ends and a pole.',parameters:{length:3.8,beam:1.0,depth:0.3,sheer:0.02,rocker:0.16,roundness:5.5,bow:'square',stern:'square',thwarts:1,gear:'pole',colorway:'forest'}},
 ],
 constraints:['Beam must be at most 0.45 x length.'],
 check(p){if(Number(p.beam)>0.45*Number(p.length)+1e-9)throw new Error('Beam too wide for the length');},
 build(p,add){
  const lift=0.03,h:HullSpec={length:Number(p.length),beam:Number(p.beam),depth:Number(p.depth),sheer:Number(p.sheer),rocker:Number(p.rocker),roundness:Number(p.roundness),bow:p.bow as HullSpec['bow'],stern:p.stern as HullSpec['stern'],thickness:0.024,lift};
  add('hull','hull',hullShell(h));
  if(h.stern!=='pointed')add('transom','hull',hullEndBoard(h,-1),'hull');
  if(h.bow!=='pointed')add('bow-board','hull',hullEndBoard(h,1),'hull');
  // Keel strip: rests on the ground and runs up both ends.
  const keel=Array.from({length:13},(_,i)=>{const u=-0.97+1.94*i/12;return {center:[0,hullKeel(h,u)-lift+0.026,u*h.length/2] as [number,number,number],radius:0.026};});
  add('keel','rail',taperedSweep(keel,6),'hull');
  for(const side of [0,1] as const){
   add('gunwale-'+side,'rail',taperedSweep(gunwaleLine(h,side,0.008,0.004).map(c=>({center:c,radius:0.024})),6),'hull');
   // Painted stripe a third of the way down the topsides.
   const stripe=Array.from({length:12},(_,i)=>{const u=-0.86+1.72*i/11,pt=hullPoint(h,u,side===0?0.09:0.91);return {center:pt,radius:0.013};});
   add('stripe-'+side,'rail',taperedSweep(stripe,5),'hull');
  }
  const seatY=(u:number)=>hullTop(h,u)-Math.min(0.17,h.depth*0.45);
  const n=Number(p.thwarts),seats:number[]=[];
  for(let i=0;i<n;i++){
   const u=n===1?0:-0.5+i/(n-1)*1.0,y=seatY(u),d=0.2,edge=Math.abs(u)+d/h.length;
   const uu=Math.sign(u||1)*edge,half=Math.min(hullInnerX(h,uu,y-0.015),hullInnerX(h,u,y-0.015))+0.01;seats.push(u);
   add('thwart-'+i,'seat',box([half*2,0.03,d],[0,y,u*h.length/2],0.006),'hull');
  }
  // Floorboards on the inner bottom.
  const fy=hullKeel(h,0)+h.thickness+0.02,fl=h.length*0.55;
  for(const x of [-1,0,1]){const fw=Math.min(0.1,hullInnerX(h,0,fy+0.01)*0.3);add('floorboard-'+(x+1),'seat',box([fw,0.018,fl],[x*fw*1.2,fy-(x?0:0.012),0],0.004),'hull');}
  add('bow-ring','metal',rod([0,hullTop(h,0.97)-0.12,h.length/2*0.985],[0,hullTop(h,0.97)-0.12,h.length/2*0.985+0.06],0.018,6),'hull');
  const gear=String(p.gear),gy=Math.max(...seats.map(seatY),fy+0.1)+0.03;
  if(gear==='oars'){
   const u=seats.length?seats[Math.floor(seats.length/2)]!:0,z=u*h.length/2+0.28,top=hullTop(h,u+0.28/h.length*2),x=halfBeam(h,u+0.28/h.length*2)-0.012;
   for(const s of [-1,1]){
    add('oarlock-'+s,'metal',rod([s*x,top-0.02,z],[s*x,top+0.07,z],0.012,6),'gunwale-'+(s<0?0:1));
    const ol=h.length*0.7;
    // Each loom runs from its blade, 75 mm off the centreline, to the inner side of its oarlock pin, where it rests 2 mm into the
    // gunwale top (it used to cut through the gunwale cap beside the pin), and ends 30 mm past it (a longer run-on crossed the
    // planking toward the bow). The blades lie side by side 20 mm
    // apart (they met at the centreline and interpenetrated).
    const A=new Vector3(s*0.075,top+0.03,z-ol*0.55),P=new Vector3(s*(x-0.032),top+0.018,z),B=P.clone().addScaledVector(P.clone().sub(A).normalize(),0.03);
    add('oar-'+s,'seat',rod(A.toArray(),B.toArray(),0.02,6),'hull');
    add('oar-blade-'+s,'seat',box([0.13,0.018,0.4],[A.x,A.y,A.z-0.16],0.006),'oar-'+s);
   }
  } else if(gear==='paddle'){
   const pl=1.4;add('paddle-shaft','seat',rod([0.05,gy-0.02,-pl*0.35],[0.05,gy-0.02,pl*0.5],0.017,6),'seat');
   add('paddle-blade','seat',box([0.18,0.016,0.48],[0.05,gy-0.02,-pl*0.35-0.22],0.006),'paddle-shaft');
   add('paddle-grip','seat',box([0.1,0.04,0.035],[0.05,gy-0.02,pl*0.5],0.006),'paddle-shaft');
  } else if(gear==='pole'){
   // The pole and its shoe lie between the end boards, 20 mm clear of each inner face (the boards' inner faces stand 36 mm in from
   // the hull ends). At 1.15x the hull length it ran out through both transoms.
   const reach=h.length/2-0.036-0.02;add('pole','seat',rod([-0.09,gy,-reach],[-0.09,gy,reach-0.12],0.022,6),'seat');
   add('pole-shoe','metal',rod([-0.09,gy,reach-0.122],[-0.09,gy,reach],0.026,6,0.012),'pole');
  }
  return {bow:[0,hullTop(h,1),h.length/2],stern:[0,hullTop(h,-1),-h.length/2]};
 },
});

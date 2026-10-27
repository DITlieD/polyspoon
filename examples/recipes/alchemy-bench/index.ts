import { box, forgeRecipe, lathe, rng, rod } from '../../../src/engine/forge-kit.ts';
import { closedSweep, taperedSweep } from '../../../src/engine/geometry.ts';
import { place, stone } from '../../../src/engine/forge-props.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'width',label:'Bench width',kind:'range',group:'shape',unit:'m',min:0.9,max:1.8,step:0.01,default:1.35,hint:'Table length.',affects:['geometry'],targets:['wood','top']},
 {key:'bottles',label:'Bottles',kind:'integer',group:'construction',unit:'count',min:3,max:16,step:1,default:9,hint:'Potion bottles, flasks and vials.',affects:['topology'],targets:['glass']},
 {key:'rack',label:'Shelf rack',kind:'toggle',group:'construction',unit:'none',default:true,hint:'A two-shelf rack along the back edge.',affects:['topology'],targets:['wood']},
 {key:'apparatus',label:'Apparatus',kind:'choice',group:'construction',unit:'none',default:'alembic',options:[{value:'alembic',label:'Burner, flask and alembic'},{value:'mortar',label:'Mortar, pestle and herbs'},{value:'cauldron',label:'Bubbling cauldron'}],hint:'The main piece of equipment.',affects:['topology'],targets:['brass','stone','iron']},
 {key:'legs',label:'Legs',kind:'choice',group:'construction',unit:'none',default:'trestle',options:[{value:'trestle',label:'Trestle ends'},{value:'turned',label:'Turned legs'}],hint:'Bench base.',affects:['topology'],targets:['wood']},
 {key:'seed',label:'Seed',kind:'integer',group:'construction',unit:'seed',min:1,max:999,step:1,default:5,hint:'Shuffles bottle shapes, colours and positions.',affects:['geometry'],targets:['glass']},
];
const glass=['glassA','glassB','glassC','glassD'];
const kinds=['flask','tall','cone','vial','jar'] as const;
export const alchemyBenchRecipe=forgeRecipe({
 id:'alchemy-bench',version:'1.0.0',title:'Alchemy bench',description:'An alchemist\'s workbench crowded with potion bottles, flasks and vials, an open grimoire and candle, and a distilling alembic, mortar or bubbling cauldron.',category:'Props',order:414,
 entry:'examples/recipes/alchemy-bench/index.ts',exportName:'alchemyBenchRecipe',
 roles:{wood:'Bench frame and rack.',top:'Bench top.',glassA:'Potion.',glassB:'Potion.',glassC:'Potion.',glassD:'Potion.',cork:'Corks and lids.',brass:'Burner, stand and candlestick.',iron:'Cauldron.',stone:'Mortar.',paper:'Pages.',leather:'Book cover.',wax:'Candle.',flame:'Flames.',herb:'Herbs and brew.'},
 palettes:{arcane:{label:'Arcane',colors:{wood:'#6b4a33',top:'#4e3526',glassA:'#3fae6a',glassB:'#8b4fc4',glassC:'#3b7fd1',glassD:'#d0892e',cork:'#b08a5a',brass:'#c09a46',iron:'#2b2a2a',stone:'#8e8a82',paper:'#eadfbf',leather:'#6d2b2b',wax:'#efe3c4',flame:'#ffb43a',herb:'#5d8a3a'}},hedge:{label:'Hedge witch',colors:{wood:'#5d5140',top:'#6e5c45',glassA:'#7cae3f',glassB:'#b04a6a',glassC:'#4aa3a0',glassD:'#c7b34a',cork:'#8f6d47',brass:'#8f7a4a',iron:'#33302c',stone:'#7d776c',paper:'#ddd1b0',leather:'#3f4a2c',wax:'#e2d6b0',flame:'#ff9a33',herb:'#6f9a2f'}},royal:{label:'Royal laboratory',colors:{wood:'#3c2a22',top:'#2a1d18',glassA:'#2fc2b0',glassB:'#c23a5a',glassC:'#5a6ee0',glassD:'#e6c04a',cork:'#a5845c',brass:'#d8b45a',iron:'#2a2a2e',stone:'#a7a39a',paper:'#f1e8cf',leather:'#24345e',wax:'#f5ecd6',flame:'#ffc04a',herb:'#3f8a5a'}}},
 roughness:{glassA:0.12,glassB:0.12,glassC:0.12,glassD:0.12,brass:0.4,iron:0.6},metalness:{brass:0.75,iron:0.6},
 controls,
 presets:[
  {id:'apothecary',name:'Apothecary bench',description:'Shelf rack, alembic still and a crowd of potions.',parameters:{bottles:11}},
  {id:'hedge-witch',name:'Hedge witch table',description:'Small turned-leg table with a bubbling cauldron and no rack.',parameters:{width:1.0,bottles:6,rack:false,apparatus:'cauldron',legs:'turned',colorway:'hedge',seed:12}},
  {id:'royal-lab',name:'Royal laboratory',description:'Long bench with a rack, mortar and pestle and many vials.',parameters:{width:1.75,bottles:15,apparatus:'mortar',colorway:'royal',seed:31}},
 ],
 constraints:['Bench top at 86 cm; every bottle stands 3 mm into its surface; bottles never intersect each other.'],
 build(p,add){
  const W=Number(p.width),D=0.62,T=0.86,random=rng(Number(p.seed));let nb=Number(p.bottles);
  add('bench-top','top',box([W,0.05,D],[0,T-0.025,0],0.008));
  const lowY=0.2;
  if(p.legs==='trestle'){
   for(const sx of [-1,1]){const x=sx*(W/2-0.12);
    add('trestle-foot-'+sx,'wood',box([0.09,0.06,D-0.04],[x,0.03,0],0.01),'bench-top');
    add('trestle-post-'+sx,'wood',box([0.07,T-0.1,0.1],[x,0.05+(T-0.1)/2-0.004,0],0.008),'trestle-foot-'+sx);
    add('trestle-cleat-'+sx,'wood',box([0.085,0.05,D-0.1],[x,T-0.075,0],0.008),'trestle-post-'+sx);}
   add('low-shelf','wood',box([W-0.24-0.04,0.03,0.3],[0,lowY,0],0.006),'trestle-post-1');
  }else{
   for(const sx of [-1,1])for(const sz of [-1,1])add('leg-'+sx+sz,'wood',lathe([[0.03,0],[0.026,0.06],[0.04,0.1],[0.024,0.3],[0.034,0.6],[0.034,T-0.045]],8,{center:[sx*(W/2-0.07),sz*(D/2-0.07)],phase:Math.PI/8}),'bench-top');
   add('low-shelf','wood',box([W-0.1,0.025,D-0.1],[0,lowY,0],0.006),'leg-11');
  }
  const kind=()=>kinds[Math.floor(random()*kinds.length)]!;
  const bottle=(name:string,k:typeof kinds[number],x:number,z:number,y:number,s:number,parent:string)=>{
   const role=glass[Math.floor(random()*4)]!,P=(pts:Array<[number,number]>)=>pts.map(([r,h])=>[r*s,y+h*s] as [number,number]);
   const body={flask:{pr:P([[0.28,-0.015],[0.46,0.12],[0.5,0.3],[0.38,0.5],[0.13,0.62],[0.11,0.86]]),n:9,ph:0,neck:0.86,nr:0.12},
    tall:{pr:P([[0.26,-0.015],[0.29,0.62],[0.13,0.76],[0.1,0.96]]),n:4,ph:Math.PI/4,neck:0.96,nr:0.11},
    cone:{pr:P([[0.42,-0.015],[0.43,0.06],[0.13,0.58],[0.11,0.76]]),n:8,ph:0,neck:0.76,nr:0.12},
    vial:{pr:P([[0.08,-0.015],[0.1,0.05],[0.1,0.68]]),n:6,ph:0,neck:0.68,nr:0.1},
    jar:{pr:P([[0.3,-0.015],[0.34,0.06],[0.34,0.42],[0.28,0.5]]),n:9,ph:0,neck:0.5,nr:0.3}}[k];
   add(name,role,lathe(body.pr,body.n,{center:[x,z],phase:body.ph}),parent);
   const top=y+body.neck*s;
   if(k==='jar')add(name+'-lid','cork',lathe([[body.nr*s*1.12,top-0.006],[body.nr*s*1.12,top+0.012],[0.02*s+0.004,top+0.03]],9,{center:[x,z]}),name);
   else add(name+'-cork','cork',lathe([[body.nr*s*0.85,top-0.01],[body.nr*s*1.05,top+0.025]],6,{center:[x,z]}),name);
   return {r:Math.max(...body.pr.map(q=>q[0])),h:top-y};
  };
  // Bottle cluster on the right half of the top, non-overlapping
  const placed:Array<[number,number,number]>=[];
  const spot=(x0:number,x1:number,z0:number,z1:number,r:number,list=placed)=>{for(let a=0;a<40;a++){const x=x0+random()*(x1-x0),z=z0+random()*(z1-z0);if(list.every(([px,pz,pr])=>Math.hypot(px-x,pz-z)>pr+r+0.012)){list.push([x,z,r]);return [x,z] as [number,number];}}return undefined;};
  const rackZ=-D/2+0.09,frontZ=D/2-0.07;
  if(p.apparatus==='alembic')placed.push([-W/2+0.25+0.36,0,0.1]);
  placed.push([-W*0.05,0.1,0.2],[-W*0.05-0.06,-0.16,0.07]);
  let i=0;
  const onTop=Math.min(nb,Math.ceil(nb*(p.rack?0.55:1)));
  for(;i<onTop;i++){const k=kind(),s=k==='vial'?0.13:0.12+random()*0.11,r=(k==='cone'?0.43:k==='vial'?0.1:k==='jar'?0.34:0.5)*s;
   const at=spot(W*0.08,W/2-0.06,p.rack?rackZ+0.12:-D/2+0.06,frontZ,r);if(!at)break;bottle('bottle-'+i,k,at[0],at[1],T-0.003,s,'bench-top');}
  // Rack along the back
  if(p.rack){
   const rx=W/2-0.04,top=T+0.72;
   for(const sx of [-1,1])add('rack-side-'+sx,'wood',box([0.03,0.75,0.16],[sx*rx,T-0.01+0.375,rackZ],0.005),'bench-top');
   add('rack-cap','wood',box([2*rx+0.08,0.03,0.2],[0,top+0.025,rackZ+0.005],0.006),'rack-side-1');
   const shelves=[T+0.3,T+0.58];
   shelves.forEach((y,k)=>add('rack-shelf-'+k,'wood',box([2*rx-0.02,0.022,0.15],[0,y-0.011,rackZ+0.004],0.004),'rack-side-1'));
   const lists:Array<Array<[number,number,number]>>=[[],[]];
   // Rack shelves are 150 mm deep (rackZ-0.071..rackZ+0.079): bottles are scaled to at most 130 mm across and centred so the whole body
   // stays 5 mm inside both edges (round flasks up to 170 mm wide used to overhang front and back).
   const rackTotal=nb+Math.round(4+W*4);for(let tries=0;i<rackTotal&&tries<90;tries++){const k=kind(),rf=k==='cone'?0.43:k==='vial'?0.1:k==='jar'?0.34:0.5,s=Math.min(k==='vial'?0.12:0.1+random()*0.07,0.065/rf),r=rf*s,shelf=tries%2;
    if(s*1.0>0.24)continue;const at=spot(-rx+0.04+r,rx-0.04-r,Math.max(rackZ-0.03,rackZ-0.066+r),Math.min(rackZ+0.04,rackZ+0.074-r),r,lists[shelf]);if(!at)continue;bottle('bottle-'+i,k,at[0],at[1],shelves[shelf]!-0.003,s,'rack-shelf-'+shelf);i++;}
  }
  // Big jars on the low shelf
  const gap=(W-0.4)/3;for(let j=0;j<3;j++){const s=Math.min(0.2+random()*0.06,(gap-0.02)/0.7),x=(j-1)*gap;bottle('crock-'+j,'jar',x,0.01*(j-1),lowY+0.015-0.003,s,'low-shelf');}
  nb=i;
  // Open grimoire and candle
  const bx=-W*0.05,bz=0.1,yaw=0.25;
  for(const sx of [-1,1]){
   add('book-cover-'+sx,'leather',box([0.2,0.008,0.28],[sx*0.1,0.004,0],0.003).rotateZ(sx*0.1).rotateY(yaw).translate(bx,T-0.002,bz),'bench-top');
   add('book-pages-'+sx,'paper',box([0.18,0.022,0.26],[sx*0.096,0.018,0],0.003).rotateZ(sx*0.1).rotateY(yaw).translate(bx,T-0.002,bz),'book-cover-'+sx);
  }
  const cx=-W*0.05-0.06,cz=-0.16;
  add('candle-dish','brass',lathe([[0.06,T-0.003],[0.065,T+0.012],[0.02,T+0.02]],8,{center:[cx,cz]}),'bench-top');
  for(let k=0;k<3;k++){const a=k*2*Math.PI/3;add('trivet-leg-'+k,'iron',rod([cx+Math.cos(a)*0.055,T+0.001,cz+Math.sin(a)*0.055],[cx+Math.cos(a)*0.07,T+0.014,cz+Math.sin(a)*0.07],0.005,4),'bench-top');}
  if(p.apparatus!=='mortar'){const mx=-(W-0.4)/6,mz=0.095;
   add('shelf-mortar','stone',lathe([[0.036,lowY+0.008],[0.043,lowY+0.03],[0.05,lowY+0.065],[0.044,lowY+0.075]],9,{center:[mx,mz]}),'low-shelf');
   add('shelf-herbs','herb',lathe([[0.04,lowY+0.07],[0.022,lowY+0.092]],7,{center:[mx,mz]}),'shelf-mortar');}
  add('candle','wax',lathe([[0.022,T+0.012],[0.021,T+0.15],[0.016,T+0.16]],8,{center:[cx,cz]}),'candle-dish');
  add('candle-flame','flame',lathe([[0.01,T+0.155],[0.014,T+0.175],[0.002,T+0.21]],5,{center:[cx,cz]}),'candle');
  // Apparatus on the left
  const ax=-W/2+0.25;
  if(p.apparatus==='alembic'){
   add('burner','brass',lathe([[0.065,T-0.003],[0.065,T+0.02],[0.03,T+0.045],[0.022,T+0.07]],8,{center:[ax,0]}),'bench-top');
   add('burner-flame','flame',lathe([[0.016,T+0.065],[0.022,T+0.09],[0.003,T+0.14]],5,{center:[ax,0]}),'burner');
   const ringY=T+0.2;
   for(let k=0;k<3;k++){const a=k*2*Math.PI/3;add('stand-leg-'+k,'brass',rod([ax+Math.cos(a)*0.12,T+0.005,Math.sin(a)*0.12],[ax+Math.cos(a)*0.085,ringY,Math.sin(a)*0.085],0.006,5),'bench-top');}
   add('stand-ring','brass',closedSweep(Array.from({length:10},(_,k)=>({center:[ax+Math.cos(k*Math.PI/5)*0.085,ringY,Math.sin(k*Math.PI/5)*0.085] as [number,number,number],radius:0.008})),5),'stand-leg-0');
   const fy=ringY-0.035;add('still-flask','glassA',lathe([[0.05,fy],[0.1,fy+0.05],[0.11,fy+0.1],[0.08,fy+0.17],[0.035,fy+0.21],[0.03,fy+0.27]],10,{center:[ax,0]}),'stand-ring');
   const neck:[number,number,number]=[ax,fy+0.26,0],rx=ax+0.36;
   add('alembic-tube','brass',taperedSweep([{center:neck,radius:0.026},{center:[ax+0.02,fy+0.33,0],radius:0.024},{center:[ax+0.12,fy+0.33,0],radius:0.018},{center:[ax+0.26,T+0.25,0],radius:0.012},{center:[rx,T+0.14,0],radius:0.01}],7),'still-flask');
   bottle('receiver','flask',rx,0,T-0.003,0.17,'bench-top');
  }else if(p.apparatus==='mortar'){
   add('mortar','stone',lathe([[0.07,T-0.003],[0.08,T+0.02],[0.1,T+0.07],[0.105,T+0.1],[0.09,T+0.11]],10,{center:[ax,0]}),'bench-top');
   add('mortar-powder','herb',lathe([[0.085,T+0.1],[0.08,T+0.116]],10,{center:[ax,0]}),'mortar');
   add('pestle','stone',rod([ax+0.02,T+0.09,0],[ax+0.12,T+0.26,0.06],0.018,7,0.013),'mortar');
   for(let k=0;k<4;k++)add('herb-'+k,'herb',place(stone(0.03+random()*0.02,0.025+random()*0.02,5,random),[0,random()*6,0],[ax+0.12+random()*0.1,T-0.003-k*0.0035,0.08+random()*0.1]),'bench-top');
   add('scale-post','brass',rod([ax+0.25,T-0.002,-0.1],[ax+0.25,T+0.3,-0.1],0.008,6),'bench-top');
   add('scale-base','brass',lathe([[0.05,T-0.003],[0.04,T+0.02]],8,{center:[ax+0.25,-0.1]}),'scale-post');
   add('scale-beam','brass',rod([ax+0.13,T+0.3,-0.1],[ax+0.37,T+0.3,-0.1],0.006,5),'scale-post');
   for(const sx of [-1,1]){const px=ax+0.25+sx*0.12;
    add('scale-cord-'+sx,'brass',rod([px,T+0.3,-0.1],[px,T+0.16,-0.1],0.003,4),'scale-beam');
    add('scale-pan-'+sx,'brass',lathe([[0.012,T+0.145],[0.05,T+0.165],[0.052,T+0.17]],8,{center:[px,-0.1]}),'scale-cord-'+sx);}
  }else{
   const r=0.15,base=T+0.05;
   for(let k=0;k<3;k++){const a=k*2*Math.PI/3+0.4;add('cauldron-foot-'+k,'iron',rod([ax+Math.cos(a)*r*0.5,base+0.03,Math.sin(a)*r*0.5],[ax+Math.cos(a)*r*0.62,T+0.004,Math.sin(a)*r*0.62],0.014,5,0.012),'bench-top');}
   add('cauldron','iron',lathe([[r*0.45,base],[r*0.8,base+r*0.15],[r,base+r*0.5],[r*0.92,base+r*0.85],[r*0.84,base+r*0.95]],12,{center:[ax,0]}),'cauldron-foot-0');
   add('brew','herb',lathe([[r*0.78,base+r*0.88],[r*0.78,base+r*0.95+0.006]],12,{center:[ax,0]}),'cauldron');
   add('cauldron-rim','iron',closedSweep(Array.from({length:12},(_,k)=>({center:[ax+Math.cos(k*Math.PI/6)*r*0.84,base+r*0.96,Math.sin(k*Math.PI/6)*r*0.84] as [number,number,number],radius:0.012})),6),'cauldron');
   for(let k=0;k<5;k++){const a=random()*6.28,d=random()*r*0.55,bs=0.012+random()*0.018;add('bubble-'+k,'herb',lathe([[bs*0.6,0],[bs,bs*0.6],[bs*0.6,bs*1.3],[bs*0.1,bs*1.5]],6,{center:[ax+Math.cos(a)*d,Math.sin(a)*d]}).translate(0,base+r*0.95,0),'brew');}
   add('stir-stick','wood',rod([ax+0.03,base+r*0.6,0.02],[ax-0.1,base+r*2.2,0.12],0.01,5),'brew');
  }
  void nb;
  return {top:[0,T,0]};
 },
});

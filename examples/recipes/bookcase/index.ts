import { box, forgeRecipe, lathe, rng } from '../../../src/engine/forge-kit.ts';
import { profileSolid } from '../../../src/engine/geometry.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'width',label:'Width',kind:'range',group:'shape',unit:'m',min:0.6,max:1.6,step:0.01,default:1.0,hint:'Outside width.',affects:['geometry'],targets:['wood','trim','back']},
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:0.9,max:2.2,step:0.01,default:1.85,hint:'Floor to top board.',affects:['geometry'],targets:['wood','trim','back']},
 {key:'depth',label:'Depth',kind:'range',group:'shape',unit:'m',min:0.26,max:0.45,step:0.01,default:0.32,hint:'Front to back.',affects:['geometry'],targets:['wood','trim','back']},
 {key:'shelves',label:'Open bays',kind:'integer',group:'construction',unit:'count',min:1,max:6,step:1,default:4,hint:'Number of open book bays.',affects:['topology'],targets:['wood']},
 {key:'fill',label:'Fill',kind:'range',group:'shape',unit:'ratio',min:0.3,max:1,step:0.01,default:0.85,hint:'How full each bay is.',affects:['geometry'],targets:['books']},
 {key:'doors',label:'Cupboard',kind:'toggle',group:'construction',unit:'none',default:false,hint:'Panelled doors below the open bays.',affects:['topology'],targets:['wood','brass']},
 {key:'crown',label:'Crown moulding',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Stepped cornice on top.',affects:['topology'],targets:['trim']},
 {key:'seed',label:'Book seed',kind:'integer',group:'construction',unit:'seed',min:1,max:999,step:1,default:7,hint:'Shuffles book sizes, colours and stacks.',affects:['geometry'],targets:['books']},
];
const bookRoles=['red','green','blue','tan'];
export const bookcaseRecipe=forgeRecipe({
 id:'bookcase',version:'1.0.0',title:'Bookcase',description:'A plinth-and-cornice bookcase whose bays are filled with upright, leaning and stacked books, with an optional panelled cupboard.',category:'Props',order:411,
 entry:'examples/recipes/bookcase/index.ts',exportName:'bookcaseRecipe',
 roles:{wood:'Carcass and shelves.',trim:'Plinth, top and cornice.',back:'Back boards.',red:'Book covers.',green:'Book covers.',blue:'Book covers.',tan:'Book covers.',gilt:'Spine bands and handles.'},
 palettes:{oak:{label:'Oak',colors:{wood:'#9b6d43',trim:'#7c5332',back:'#5a3c25',red:'#8e2f2a',green:'#3f5e3a',blue:'#2f4766',tan:'#b59468',gilt:'#c9a24a'}},walnut:{label:'Walnut',colors:{wood:'#5c3b28',trim:'#43291b',back:'#2e1d13',red:'#7d2a2f',green:'#2f4c3e',blue:'#283a58',tan:'#a88a5f',gilt:'#d2ad55'}},painted:{label:'Painted cottage',colors:{wood:'#6f8a7a',trim:'#e3dccb',back:'#4f6459',red:'#b5543d',green:'#5b7a3c',blue:'#3f6185',tan:'#cfae78',gilt:'#b88b3a'}}},
 roughness:{gilt:0.4},metalness:{gilt:0.7},
 controls,
 presets:[
  {id:'library',name:'Library case',description:'Tall cornice bookcase packed with books.',parameters:{width:1.2,height:2.05,shelves:5,fill:0.92,seed:11}},
  {id:'cottage',name:'Cottage dresser',description:'Low wide painted case with cupboard doors and two bays.',parameters:{width:1.4,height:1.25,depth:0.38,shelves:2,doors:true,crown:false,fill:0.7,seed:4,colorway:'painted'}},
  {id:'scholar',name:"Scholar's case",description:'Narrow walnut case, half-filled with leaning books.',parameters:{width:0.72,height:1.6,depth:0.3,shelves:4,fill:0.55,seed:23,colorway:'walnut'}},
 ],
 constraints:['Boards are 25 mm; books stand 4 mm into each shelf and at least 12 mm behind the shelf edge.'],
 build(p,add){
  const W=Number(p.width),H=Number(p.height),D=Number(p.depth),bays=Number(p.shelves),fill=Number(p.fill),t=0.025,random=rng(Number(p.seed));
  const inner=W/2-t,plinth=0.08;
  for(const sx of [-1,1])add('side-'+(sx<0?'l':'r'),'wood',box([t,H-0.006,D],[sx*(W/2-t/2),(H-0.006)/2,0],0.004));
  add('plinth','trim',box([W+0.02,plinth,D+0.02],[0,plinth/2,0.0],0.006),'side-l');
  add('top','trim',box([W+0.03,t,D+0.025],[0,H-t/2,0.0025],0.006),'side-l');
  if(p.crown)add('cornice','trim',profileSolid([{y:H-0.004,width:W+0.02,depth:D+0.02,chamfer:0.006},{y:H+0.03,width:W+0.1,depth:D+0.065,chamfer:0.012},{y:H+0.055,width:W+0.1,depth:D+0.065,chamfer:0.012}]).translate(0,0,0.01),'top');
  add('back','back',box([2*inner+0.016,H-plinth-t+0.015,0.012],[0,plinth-0.01+(H-plinth-t+0.015)/2,-D/2+0.01]),'side-l');
  const bottom=plinth+t/2-0.004;add('bottom-board','wood',box([2*inner+0.008,t,D-0.02],[0,bottom,0]),'side-l');
  let floor=bottom+t/2;
  if(p.doors){
   const dh=Math.min(0.5,(H-plinth)*0.36),dw=inner-0.006;
   for(const sx of [-1,1]){
    const cx=sx*(dw/2+0.003);
    add('door-'+(sx<0?'l':'r'),'wood',box([dw,dh-0.004,0.02],[cx,floor+dh/2-0.006,D/2-0.002],0.004),'side-l');
    add('door-panel-'+(sx<0?'l':'r'),'trim',box([dw-0.09,dh-0.1,0.012],[cx,floor+dh/2,D/2+0.012],0.004),'door-'+(sx<0?'l':'r'));
    add('door-knob-'+(sx<0?'l':'r'),'gilt',lathe([[0.012,0],[0.018,0.012],[0.012,0.025]],6).rotateX(Math.PI/2).translate(sx*0.03,floor+dh*0.55,D/2+0.004),'door-'+(sx<0?'l':'r'));
   }
   floor+=dh;add('cupboard-top','wood',box([2*inner+0.008,t,D-0.02],[0,floor+t/2-0.004,0]),'side-l');floor+=t-0.004;
  }
  const bayH=(H-t-floor-t*(bays-1))/bays;
  let books=0;const maxBooks=Math.floor(150/Math.max(1,bays))*bays;
  for(let b=0;b<bays;b++){
   const y=floor+b*(bayH+t);
   if(b>0)add('shelf-'+b,'wood',box([2*inner+0.008,t,D-0.03],[0,y-t/2,-0.005]),'side-l');
   const shelf=b>0?'shelf-'+b:p.doors?'cupboard-top':'bottom-board';
   const front=D/2-0.025,limit=inner-0.01;let x=-inner+0.004+random()*0.02,prevK=-1;
   const deep=()=>Math.min(D-0.075,D*(0.55+random()*0.25)),setback=()=>{let k=Math.floor(random()*4);if(k===prevK)k=(k+1)%4;prevK=k;return 0.012+0.007*k;};
   const stop=-inner+2*inner*fill;
   while(x<stop&&books<maxBooks){
    const role=bookRoles[Math.floor(random()*4)]!,r=random();
    if(r<0.1&&x+0.24<limit){ // a lying stack
     let sy=y-0.004;const n=2+Math.floor(random()*3),cx=x+0.128;
     for(let i=0;i<n&&sy<y+bayH-0.08;i++){const bw=0.235-i*0.014-random()*0.004,bt=0.03+random()*0.02,bd=deep()-i*0.008;add('book-'+books++,bookRoles[Math.floor(random()*4)]!,box([bw,bt,bd],[cx+(random()-.5)*0.006,sy+bt/2,front-bd/2-setback()],0.004),shelf);sy+=bt;}
     x+=0.25;continue;
    }
    const bw=0.022+random()*0.035,bh=Math.min(bayH-0.03,bayH*(0.55+random()*0.37)),bd=deep(),z=front-bd/2-setback();
    if(x+bw>limit)break;
    const g=box([bw,bh,bd],[x+bw/2,y-0.004+bh/2,z],0.003);add('book-'+books,role,g,shelf);
    if(random()<0.35){const band=bh*(0.12+random()*0.6);add('book-band-'+books,'gilt',box([bw-0.008,0.012,0.012],[x+bw/2,y-0.004+band,z+bd/2+0.002],0.002),'book-'+books);}
    books++;x+=bw+0.001;
   }
   // a leaning book against the last upright: its top corner rests at the upright's face (it was set 12 mm into that book)
   // Its foot swings out to x+sin(a)*bh+bw*cos(a): the lean is reduced until the foot stays 15 mm inside the side panel's inner
   // face (end books pierced the side), and the book is left out when even a 0.08 rad lean will not fit.
   const leanBh=Math.min(bayH-0.05,bayH*0.8),leanFits=(a:number)=>x+Math.sin(a)*leanBh+0.03*Math.cos(a)<=inner-0.015;
   let lean=0.3+random()*0.15;while(lean>0.08&&!leanFits(lean))lean-=0.02;
   if(leanFits(lean)&&books<maxBooks&&fill<0.97){
    const bw=0.03,bh=leanBh,bd=deep(),k=(prevK+2)%4,a=lean,g=box([bw,bh,bd],[0,0,0],0.003);
    g.translate(bw/2,bh/2,0);g.rotateZ(a);g.translate(x+0.0005+Math.sin(a)*bh,y-0.006-bw*Math.sin(a)*0.0,front-bd/2-0.012-0.007*k);
    g.computeBoundingBox();g.translate(0,y-0.006-g.boundingBox!.min.y,0);
    add('book-'+books++,bookRoles[Math.floor(random()*4)]!,g,shelf);
   }
  }
  return {top:[0,H,0]};
 },
});

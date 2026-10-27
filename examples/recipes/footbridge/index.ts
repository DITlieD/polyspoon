import { box, forgeRecipe, lathe, rod, rng } from '../../../src/engine/forge-kit.ts';
import { beam, place, prism } from '../../../src/engine/forge-kit-structures.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'style',label:'Bridge style',kind:'choice',group:'construction',unit:'none',default:'arched',options:[{value:'arched',label:'Arched footbridge'},{value:'trestle',label:'Plank trestle'},{value:'covered',label:'Covered bridge'}],hint:'Curved log stringers on stone abutments, a flat deck on pile bents, or a roofed truss bridge.',affects:['topology'],targets:['deck','support','roof']},
 {key:'span',label:'Span',kind:'range',group:'shape',unit:'m',min:4,max:12,step:0.1,default:7,hint:'End to end deck length.',affects:['geometry'],targets:['deck','stringer','rail']},
 {key:'width',label:'Deck width',kind:'range',group:'shape',unit:'m',min:1.2,max:3,step:0.05,default:1.7,hint:'Outside width of the deck.',affects:['geometry'],targets:['deck']},
 {key:'rise',label:'Arch rise',kind:'range',group:'shape',unit:'m',min:0,max:1.6,step:0.05,default:0.9,hint:'Height of the arch crown above the ends (arched style).',affects:['geometry'],targets:['deck','stringer']},
 {key:'deckHeight',label:'Deck height',kind:'range',group:'shape',unit:'m',min:0.4,max:2.5,step:0.05,default:0.5,hint:'Deck height at the ends.',affects:['geometry'],targets:['deck','support']},
 {key:'rail',label:'Railing',kind:'choice',group:'construction',unit:'none',default:'lattice',options:[{value:'none',label:'None'},{value:'simple',label:'Post and rail'},{value:'lattice',label:'Lattice'}],hint:'Side railings (covered bridges use their walls).',affects:['topology'],targets:['rail']},
 {key:'seed',label:'Wear seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:11,hint:'Repeatable plank wear.',affects:['geometry'],targets:['deck']},
];
export const footbridgeRecipe=forgeRecipe({
 id:'footbridge',version:'1.0.0',title:'Wooden bridge',description:'A timber bridge: an arched log footbridge on stone abutments, a plank trestle on pile bents, or a roofed covered bridge.',category:'Structures',order:220,
 entry:'examples/recipes/footbridge/index.ts',exportName:'footbridgeRecipe',
 roles:{plank:'Deck planks.',timber:'Stringers, posts and rails.',stone:'Abutment stones.',cap:'Roof and post caps.',accent:'Lattice infill and covered-bridge siding.'},
 palettes:{
  oak:{label:'Oak',colors:{plank:'#a27a52',timber:'#6b4c34',stone:'#8f8b83',cap:'#4a3a2e',accent:'#86603f'}},
  silver:{label:'Silvered',colors:{plank:'#9b968b',timber:'#6d665b',stone:'#a19d94',cap:'#4b4b4d',accent:'#857f74'}},
  lacquer:{label:'Garden lacquer',colors:{plank:'#8a6a4c',timber:'#a8342a',stone:'#7f8079',cap:'#2f3236',accent:'#c9b37a'}},
  barn:{label:'Barn red',colors:{plank:'#9c7a55',timber:'#5e4632',stone:'#8f8b83',cap:'#4d4642',accent:'#8c3b2b'}},
 },
 controls,
 presets:[
  {id:'garden-arch',name:'Arched footbridge',description:'Steep arched log footbridge with lattice railings.',parameters:{}},
  {id:'creek-trestle',name:'Creek trestle',description:'Long flat plank deck on pile bents with post-and-rail sides.',parameters:{style:'trestle',span:10,width:1.5,rise:0,deckHeight:1.4,rail:'simple',colorway:'silver'}},
  {id:'covered',name:'Covered bridge',description:'Roofed bridge with board siding and window openings.',parameters:{style:'covered',span:8,width:2.6,rise:0.2,deckHeight:0.6,rail:'none',colorway:'barn'}},
 ],
 constraints:['Arched bridges rise at most a quarter of their span.'],
 check(p){if(Number(p.rise)>Number(p.span)/4+1e-9)throw new Error('Arch rise exceeds a quarter of the span');},
 build(p,add){
  const style=String(p.style),S=Number(p.span),W=Number(p.width),rise=style==='trestle'?0:Number(p.rise),D=Number(p.deckHeight),rail=style==='covered'?'none':String(p.rail),random=rng(Number(p.seed));
  const yAt=(x:number)=>D+rise*(1-(2*x/S)**2),slope=(x:number)=>-8*rise*x/(S*S);
  const stringerR=0.11,sz=W/2-0.2,pitch=0.21,planks=Math.round(S/pitch);
  // Two stringers (log sweeps following the deck curve).
  for(const s of [-1,1]){
   const pts=Array.from({length:13},(_,i)=>{const x=-S/2+0.05+i*(S-0.1)/12;return {center:[x,yAt(x)-0.06-stringerR,s*sz] as [number,number,number],radius:stringerR};});
   add('stringer-'+(s>0?'r':'l'),'timber',taperedSweep(pts,8),'support');
  }
  for(let i=0;i<planks;i++){
   const x=-S/2+(i+0.5)*S/planks,a=Math.atan(slope(x)),len=W-0.12+(random()-0.5)*0.08,off=(random()-0.5)*0.03;
   add('plank-'+i,'plank',place(box([S/planks-0.025,0.06,len],[0,0,0],0.006),[x,yAt(x)-0.045,off],[0,0,a+(random()-0.5)*0.02]),'stringer');
  }
  if(style==='arched'||style==='covered'){
   for(const s of [-1,1]){
    const x=s*(S/2-0.35);
    add('abutment-'+(s>0?'r':'l'),'stone',box([1.1,D-0.06-2*stringerR+0.08,W+0.5],[x+s*0.2,(D-0.06-2*stringerR+0.08)/2,0],0.04));
    for(let k=0;k<4;k++){const z=-(W+0.4)/2+(k+0.5)*(W+0.4)/4;add('abutment-stone-'+(s>0?'r':'l')+k,'stone',lathe([[0.22,0],[0.2,0.18],[0.08,0.26]],6,{center:[x+s*0.85,z],phase:random()}),'abutment');}
   }
  }
  if(style!=='arched'){
   // Pile bents: pairs of piles with a cap beam and sway braces.
   const bents=Math.max(2,Math.round(S/2.4)+1);
   for(let b=0;b<bents;b++){
    const x=-S/2+0.3+b*(S-0.6)/(bents-1),y=yAt(x)-0.06-2*stringerR;
    if(style==='covered'&&(b===0||b===bents-1))continue;
    for(const s of [-1,1])add('pile-'+b+(s>0?'r':'l'),'timber',lathe([[0.13,0],[0.12,y-0.05],[0.1,y]],8,{center:[x,s*(sz+0.02)],phase:random()}),'bent-cap-'+b);
    add('bent-cap-'+b,'timber',beam([x,y-0.07,-sz-0.2],[x,y-0.07,sz+0.2],0.18,0.2));
    if(y>1)add('sway-brace-'+b,'timber',beam([x+0.15,0.3,-sz],[x+0.15,y-0.2,sz],0.1,0.08,[0,0,1]),'bent-cap-'+b);
   }
  }
  let top=yAt(0);
  if(rail!=='none'){
   const posts=Math.max(3,Math.round(S/1.2)+1),rh=0.95,re=W/2-0.04;
   for(const s of [-1,1]){
    // Posts sit on plank centers so their faces never line up with plank edges.
    const snap=(x:number)=>-S/2+(Math.min(planks-1,Math.max(0,Math.floor((x+S/2)/(S/planks))))+0.5)*S/planks;
    const xs=Array.from({length:posts},(_,k)=>snap(-S/2+0.15+k*(S-0.3)/(posts-1)));
    for(const [k,x] of xs.entries()){
     add('rail-post-'+(s>0?'r':'l')+k,'timber',box([0.09,rh+0.2,0.09],[x,yAt(x)+rh/2,s*re],0.008),'stringer');
     const t=yAt(x)+rh+0.1;add('post-cap-'+(s>0?'r':'l')+k,'cap',lathe([[0.075,t-0.004],[0.075,t+0.03],[0.01,t+0.09]],4,{center:[x,s*re],phase:Math.PI/4}),'rail-post-'+(s>0?'r':'l')+k);
    }
    const pts=(h:number,off:number)=>Array.from({length:11},(_,i)=>{const x=-S/2+0.08+i*(S-0.16)/10;return {center:[x,yAt(x)+h,s*(re+off)] as [number,number,number],radius:0.045};});
    add('handrail-'+(s>0?'r':'l'),'timber',taperedSweep(pts(rh,0),6),'rail-post');
    add('midrail-'+(s>0?'r':'l'),'timber',taperedSweep(pts(rh*0.45,0.06).map(q=>({...q,radius:0.03})),6),'rail-post');
    if(rail==='lattice')for(let k=0;k<posts-1;k++){
     const x0=xs[k]!+0.03,x1=xs[k+1]!-0.03;
     add('lattice-a-'+(s>0?'r':'l')+k,'accent',beam([x0,yAt(x0)+0.12,s*(re-0.012)],[x1,yAt(x1)+rh*0.42,s*(re-0.012)],0.05,0.035,[0,0,1]),'rail-post');
     add('lattice-b-'+(s>0?'r':'l')+k,'accent',beam([x0,yAt(x0)+rh*0.42,s*(re+0.012)],[x1,yAt(x1)+0.12,s*(re+0.012)],0.05,0.035,[0,0,1]),'rail-post');
    }
   }
   top=yAt(0)+rh+0.05;
  }
  if(style==='covered'){
   const wallH=2.1,y0=yAt(0),posts=Math.max(4,Math.round(S/1.3)+1),we=W/2-0.06;
   const xs=Array.from({length:posts},(_,k)=>-S/2+0.12+k*(S-0.24)/(posts-1));
   for(const s of [-1,1]){
    for(const [k,x] of xs.entries())add('wall-post-'+(s>0?'r':'l')+k,'timber',box([0.14,wallH+y0-yAt(x)+0.1,0.14],[x,(yAt(x)-0.1+y0+wallH)/2,s*we],0.01),'stringer');
    add('wall-plate-'+(s>0?'r':'l'),'timber',box([S,0.16,0.18],[0,y0+wallH+0.08,s*we],0.01),'wall-post');
    for(let k=0;k<posts-1;k++){
     const x=(xs[k]!+xs[k+1]!)/2,bw=xs[k+1]!-xs[k]!-0.12,yb=Math.max(yAt(xs[k]!),yAt(xs[k+1]!));
     const window=k%2===1;
     // Full-height siding runs 10 mm up into the straight wall plate: it stopped 40 mm short of y0+wallH while the arched deck dropped
     // its foot, leaving daylight under the plate.
     const lowH=window?0.95:y0+wallH+0.01-yb;
     add('siding-low-'+(s>0?'r':'l')+k,'accent',box([bw,lowH,0.05],[x,yb+lowH/2,s*(we+0.03)],0.006),'wall-post');
     if(window){add('siding-high-'+(s>0?'r':'l')+k,'accent',box([bw,0.53,0.05],[x,y0+wallH-0.255,s*(we+0.03)],0.006),'wall-post');add('sill-'+(s>0?'r':'l')+k,'timber',box([bw+0.1,0.06,0.14],[x,yb+lowH+0.03,s*(we+0.03)],0.006),'wall-post');}
    }
   }
   for(const x of [-S/2+0.12,S/2-0.12])add('portal-beam-'+(x>0?'r':'l'),'timber',box([0.16,0.2,W],[x,y0+wallH+0.11,0],0.01),'wall-plate');
   const ry=y0+wallH+0.16,half=W/2+0.35;
   add('roof','cap',place(prism([[-half,0],[half,0],[0.05,W*0.45],[-0.05,W*0.45]],S+0.6),[0,ry,0],[0,Math.PI/2,0]),'wall-plate');
   add('gable-r','accent',place(prism([[-W/2+0.06,0],[W/2-0.06,0],[0,W*0.4]],0.06),[S/2-0.18,ry+0.005,0],[0,Math.PI/2,0]),'roof');
   add('gable-l','accent',place(prism([[-W/2+0.06,0],[W/2-0.06,0],[0,W*0.4]],0.06),[-S/2+0.18,ry+0.005,0],[0,Math.PI/2,0]),'roof');
   top=ry+W*0.45;
  }
  return {top:[0,top,0],endA:[-S/2,D,0],endB:[S/2,D,0]};
 },
});

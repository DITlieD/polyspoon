import { box, forgeRecipe, lathe, rng } from '../../../src/engine/forge-kit.ts';
import { place, prism } from '../../../src/engine/forge-kit-structures.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'style',label:'Style',kind:'choice',group:'construction',unit:'none',default:'arch',options:[{value:'arch',label:'Voussoir archway'},{value:'colonnade',label:'Colonnade'}],hint:'A dressed-stone arch on coursed piers, or a row of columns carrying an architrave.',affects:['topology'],targets:['arch','column']},
 {key:'span',label:'Opening span',kind:'range',group:'shape',unit:'m',min:1.8,max:5,step:0.05,default:2.8,hint:'Clear width of the arch, or column spacing.',affects:['geometry'],targets:['arch','column']},
 {key:'pierHeight',label:'Pier height',kind:'range',group:'shape',unit:'m',min:1.5,max:4,step:0.05,default:2.4,hint:'Ground to the springing line (or column height).',affects:['geometry'],targets:['pier','column']},
 {key:'depth',label:'Wall depth',kind:'range',group:'shape',unit:'m',min:0.5,max:1.6,step:0.05,default:0.9,hint:'Thickness through the arch.',affects:['geometry'],targets:['arch','pier']},
 {key:'columns',label:'Columns',kind:'integer',group:'construction',unit:'count',min:3,max:7,step:1,default:5,hint:'Columns in a colonnade.',affects:['topology'],targets:['column']},
 {key:'ruin',label:'Ruin',kind:'range',group:'shape',unit:'ratio',min:0,max:0.8,step:0.05,default:0,hint:'How much has collapsed: missing stones, broken columns and fallen blocks.',affects:['geometry'],targets:['arch','column','rubble']},
 {key:'seed',label:'Ruin seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:21,hint:'Repeatable stone jitter and collapse.',affects:['geometry'],targets:['rubble']},
];
export const stoneArchRecipe=forgeRecipe({
 id:'stone-arch',version:'1.0.0',title:'Stone archway',description:'Dressed-stone architecture: a voussoir archway with keystone and cornice on coursed piers, or a colonnade with architrave; can be ruined with fallen blocks and moss.',category:'Structures',order:250,
 entry:'examples/recipes/stone-arch/index.ts',exportName:'stoneArchRecipe',
 roles:{stone:'Main dressed stone.',accent:'Voussoirs, capitals and cornice.',rubble:'Fallen blocks and footing.',moss:'Moss and grass tufts.'},
 palettes:{
  sandstone:{label:'Sandstone',colors:{stone:'#cdb48e',accent:'#b89a70',rubble:'#a8916f',moss:'#6d8a3e'}},
  granite:{label:'Granite',colors:{stone:'#9d9b96',accent:'#83817c',rubble:'#76746f',moss:'#5f7d3a'}},
  marble:{label:'Marble',colors:{stone:'#e7e3da',accent:'#d4cec2',rubble:'#bdb7ab',moss:'#7d9a4a'}},
 },
 controls,
 presets:[
  {id:'gateway',name:'Gateway arch',description:'Intact archway with keystone, imposts and cornice.',parameters:{}},
  {id:'ruined-arch',name:'Ruined arch',description:'Half-collapsed arch with a broken pier, fallen voussoirs and moss.',parameters:{span:3.2,pierHeight:2.8,depth:1,ruin:0.55,seed:9,colorway:'granite'}},
  {id:'colonnade',name:'Ruined colonnade',description:'Marble columns on a stepped stylobate, some broken, with a partial architrave.',parameters:{style:'colonnade',span:1.9,pierHeight:3.2,depth:1.1,columns:5,ruin:0.4,colorway:'marble'}},
 ],
 constraints:['Colonnade length is (columns-1) x span; keep it under 20 m.'],
 check(p){if(p.style==='colonnade'&&(Number(p.columns)-1)*Number(p.span)>18+1e-9)throw new Error('Colonnade too long');},
 build(p,add){
  const style=String(p.style),S=Number(p.span),Hp=Number(p.pierHeight),D=Number(p.depth),ruin=Number(p.ruin),random=rng(Number(p.seed));
  const fallen:Array<[number,number,number]>=[];
  const rubble=(x:number,z:number,s:number)=>{const a=random()*Math.PI,w=s*(0.8+random()*0.5),h=s*(0.45+random()*0.3),dd=s*(0.6+random()*0.4);add('fallen-'+fallen.length,'rubble',place(box([w,h,dd],[0,0,0],0.03),[x,h/2,z],[0,a,0]));fallen.push([x,0,z]);};
  if(style==='arch'){
   const pw=Math.max(0.7,S*0.28),R=S/2,ring=Math.max(0.42,S*0.16),xs=[-1,1];
   add('footing','rubble',box([S+pw*2+0.4,0.2,D+0.3],[0,0.1,0],0.03));
   // Grass tufts where the piers meet the footing.
   for(const s of xs)for(const z of [-1,1])add('tuft-'+(s>0?'r':'l')+(z>0?'f':'b'),'moss',lathe([[0.16,0],[0.12,0.07],[0.04,0.12]],7,{center:[s*(R+pw+0.06),z*(D/2+0.04)],phase:random()}).translate(0,0.2,0),'footing');
   // Coursed piers, shorter on the collapsed (left) side.
   const course=0.36,courses=Math.max(3,Math.round((Hp-0.2)/course)),ch=(Hp-0.2)/courses;
   const broken=ruin>0?Math.max(2,Math.round(courses*(1-ruin*0.9))):courses;
   for(const s of xs){
    const n=s<0?broken:courses;
    for(let c=0;c<n;c++){const j=(random()-0.5)*0.02,off=c%2?0.03:-0.03;add('pier-'+(s>0?'r':'l')+'-'+c,'stone',box([pw+j,ch+0.004,D+(c%2?0.04:0)],[s*(R+pw/2)+off*s*0.3,0.2+ch*(c+0.5),0],0.025),'footing');}
    if(n===courses){
     add('impost-'+(s>0?'r':'l'),'accent',box([pw+0.16,0.16,D+0.16],[s*(R+pw/2),Hp+0.08,0],0.02),'pier');
    }else{
     for(let k=0;k<2;k++)add('moss-pier-'+k,'moss',lathe([[0.22,0],[0.18,0.06],[0.06,0.09]],7,{center:[s*(R+pw/2)+(k-0.5)*0.3,(k-0.5)*0.25],phase:random()}).translate(0,0.2+ch*n-0.02+k*0.005,0),'pier');
    }
   }
   // Voussoirs from right (angle 0) to left (angle pi); ruin removes stones from the left.
   const nv=Math.max(9,Math.round(Math.PI*R/0.42)|1),spring=Hp+0.16,keep=ruin>0?Math.floor(nv*(1-ruin*0.85)):nv;
   const kept:number[]=[];
   for(let i=0;i<nv;i++){
    if(i>=keep){if(i<keep+3)rubble(-R*0.6+random()*R*0.8,(random()-0.5)*D*1.6+(random()<.5?D:-D),0.4);continue;}
    const a0=i*Math.PI/nv-0.002,a1=(i+1)*Math.PI/nv+0.002,key=i===(nv-1)/2,ro=R+ring+(key?0.14:0);
    const pt=(r:number,a:number):[number,number]=>[Math.cos(a)*r,spring+Math.sin(a)*r];
    add('voussoir-'+i,key?'stone':'accent',place(prism([pt(R,a0),pt(R,a1),pt(ro,a1),pt(ro,a0)].map(([x,y])=>[x,y] as [number,number]),D+(key?0.1:i%2?0.04:0.03)),[0,0,0]),i===0?'impost-r':'voussoir-'+(i-1));
    kept.push(i);
   }
   // Spandrel blocks above the ring up to the cornice (convex trapezoids per voussoir).
   const topY=spring+R+ring+0.35;
   for(const i of kept){
    const a0=i*Math.PI/nv,a1=(i+1)*Math.PI/nv,ro=R+ring,x0=Math.cos(a0)*ro,x1=Math.cos(a1)*ro,y0=spring+Math.sin(a0)*ro,y1=spring+Math.sin(a1)*ro;
    if(Math.abs(x0-x1)<0.05)continue;
    const yTop=ruin>0?topY-0.35-random()*ruin*0.8:topY;
    if(yTop<=Math.max(y0,y1)+0.08)continue;
    add('spandrel-'+i,'stone',place(prism([[x0,y0],[x1,y1],[x1,yTop],[x0,yTop]],D-0.06),[0,0,0]),'voussoir-'+i);
   }
   for(const s of xs){
    if(s<0&&ruin>0)continue;
    const hy=ruin>0?spring+(topY-spring)*(1-ruin*0.6):topY;
    add('haunch-'+(s>0?'r':'l'),'stone',box([pw,hy-spring-0.006,D-0.08],[s*(R+pw/2),(hy+spring+0.006)/2,0],0.02), // bottom 6 mm above the springing line: it shared the springer voussoir's bed plane
     'impost-'+(s>0?'r':'l'));
   }
   if(ruin===0){
    add('cornice','accent',box([S+pw*2+0.3,0.18,D+0.24],[0,topY+0.09,0],0.02),'haunch-r');
    add('coping','stone',box([S+pw*2+0.1,0.14,D+0.1],[0,topY+0.25,0],0.02),'cornice');
   }else{
    for(let k=0;k<4;k++)add('moss-top-'+k,'moss',lathe([[0.2,0],[0.16,0.05],[0.05,0.08]],7,{center:[R+pw*(0.2+0.2*k),(random()-0.5)*D*0.5],phase:random()}).translate(0,spring+(topY-spring)*(1-ruin*0.6)-0.02+k*0.005,0),'haunch-r');
   }
  }else{
   const n=Number(p.columns),len=(n-1)*S,r=Math.min(0.32,S*0.17),steps=2;
   for(let k=0;k<steps;k++)add('stylobate-'+k,'rubble',box([len+r*4+0.9-k*0.4,0.18,D+0.9-k*0.4],[0,0.09+k*0.18,0],0.02),k?'stylobate-0':undefined);
   const base=steps*0.18,broken=new Set<number>();
   for(let c=0;c<n;c++)if(ruin>0&&random()<ruin*0.9&&c!==0)broken.add(c);
   const intact=(c:number)=>!broken.has(c);
   for(let c=0;c<n;c++){
    const x=-len/2+c*S,h=intact(c)?Hp:Hp*(0.25+random()*0.45);
    add('plinth-'+c,'accent',box([r*2.6,0.14,r*2.6],[x,base+0.07,0],0.02),'stylobate-1');
    add('base-torus-'+c,'accent',lathe([[r*1.15,base+0.14],[r*1.18,base+0.2],[r*1.02,base+0.26]],12,{center:[x,0]}),'plinth-'+c);
    // Entasis shaft: swells slightly then narrows.
    const sh=h-0.26-(intact(c)?0.42:0),y0=base+0.26;
    const prof:Array<[number,number]>=[[r,y0],[r*1.02,y0+sh*0.3],[r*0.94,y0+sh*0.7],[r*0.86,y0+sh]];
    add('shaft-'+c,'stone',lathe(prof,12,{center:[x,0],phase:c*0.3}),'base-torus-'+c);
    if(intact(c)){
     const yc=y0+sh;
     add('echinus-'+c,'accent',lathe([[r*0.86,yc],[r*1.15,yc+0.16],[r*1.25,yc+0.2]],12,{center:[x,0]}),'shaft-'+c);
     add('abacus-'+c,'accent',box([r*2.7,0.2,r*2.7],[x,yc+0.3,0],0.015),'echinus-'+c);
    }else{
     add('moss-col-'+c,'moss',lathe([[r*0.8,0],[r*0.55,0.05],[0.04,0.08]],8,{center:[x,0],phase:random()}).translate(0,y0+sh-0.02,0),'shaft-'+c);
     const drum=r*0.9,dl=Math.min(0.9,Hp-h);if(dl>0.3){const z=(random()<.5?1:-1)*(D/2+0.6+random()*0.3);add('fallen-drum-'+c,'stone',place(lathe([[drum,-dl/2],[drum,dl/2]],12),[x+(random()-0.5)*0.4,drum,z],[0,random()*0.6-0.3,Math.PI/2]),'stylobate-0');}
    }
   }
   const archY=base+Hp-0.02;
   for(let c=0;c<n-1;c++){
    if(!intact(c)||!intact(c+1))continue;
    const x0=-len/2+c*S,x1=x0+S;
    add('architrave-'+c,'stone',box([S+r*2.4-0.02,0.34,r*2.5],[(x0+x1)/2,archY+0.17,0],0.02),'abacus-'+c);
    add('frieze-'+c,'accent',box([S+r*2.4-0.06,0.24,r*2.3],[(x0+x1)/2,archY+0.46,0],0.02),'architrave-'+c);
   }
   for(let k=0;k<Math.round(ruin*8);k++)rubble(-len/2+random()*len,(random()<.5?1:-1)*(D/2+0.5+random()*0.6),0.35);
  }
  if(style==='arch'&&ruin>0)for(let k=0;k<Math.round(ruin*5);k++)rubble(-S*0.8+random()*S*0.9,(random()<.5?1:-1)*(D/2+0.35+random()*0.6),0.32);
  return {top:[0,Hp,0]};
 },
});

import { blade, blob, facetPad, forgeRecipe, lathe, merge, place, rest, rng } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import type { BufferGeometry } from 'three';
import { Matrix4, Vector3 } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';
type V=[number,number,number];
const controls:Control[]=[
 {key:'form',label:'Form',kind:'choice',group:'construction',unit:'none',default:'saguaro',options:[{value:'saguaro',label:'Saguaro'},{value:'prickly-pear',label:'Prickly pear'},{value:'barrel',label:'Barrel cluster'}],hint:'Cactus species and growth habit.',affects:['topology'],targets:['body','rib','spine','flower']},
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:0.3,max:6,step:0.05,default:3.2,hint:'Height of the tallest stem or pad stack.',affects:['geometry'],targets:['body','rib']},
 {key:'girth',label:'Girth',kind:'range',group:'shape',unit:'ratio',min:0.6,max:1.6,step:0.01,default:1,hint:'Body thickness relative to the species default.',affects:['geometry'],targets:['body','rib']},
 {key:'branches',label:'Arms / pads / heads',kind:'integer',group:'construction',unit:'count',min:0,max:8,step:1,default:3,hint:'Saguaro arms, extra prickly-pear pads, or extra barrel heads.',affects:['topology'],targets:['body']},
 {key:'flowers',label:'Flowers and fruit',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Blossoms on saguaro and barrel crowns; fruit on prickly-pear pads.',affects:['topology'],targets:['flower']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:3,hint:'Repeatable arm heights, pad angles and spine placement.',affects:['geometry'],targets:['body','spine']},
];
export const cactusRecipe=forgeRecipe({
 id:'cactus',version:'1.0.0',title:'Cactus',description:'Desert cacti: a ribbed saguaro with upturned arms, a prickly pear of jointed pads with fruit, or a cluster of spiny barrel cacti with crown blossoms.',category:'Nature',order:320,
 entry:'examples/recipes/cactus/index.ts',exportName:'cactusRecipe',
 roles:{body:'Stems and pads.',rib:'Raised ribs.',spine:'Areoles and spines.',flower:'Blossoms and fruit.',ground:'Sand mound and pebbles.'},
 palettes:{sonoran:{label:'Sonoran',colors:{body:'#4f7f3f',rib:'#5f9149',spine:'#efe6c8',flower:'#f2f0e4',ground:'#d9b98a'}},bloom:{label:'In bloom',colors:{body:'#5d8a46',rib:'#6c9a52',spine:'#f6eccb',flower:'#d6336c',ground:'#e3c79a'}},dusk:{label:'Dusk mesa',colors:{body:'#3f6b4f',rib:'#4d7c5c',spine:'#f0d9a8',flower:'#f4b63f',ground:'#c98f63'}}},
 controls,groundSnap:0.03,
 presets:[
  {id:'saguaro',name:'Saguaro',description:'Tall ribbed column with three upturned arms and white crown blossoms.',parameters:{}},
  {id:'prickly-pear',name:'Prickly pear',description:'Jointed flat pads with magenta fruit.',parameters:{form:'prickly-pear',height:1.3,branches:7,colorway:'bloom',seed:12}},
  {id:'barrel-trio',name:'Barrel cactus trio',description:'Three squat ribbed barrels with golden crown flowers.',parameters:{form:'barrel',height:0.75,girth:1.2,branches:2,colorway:'dusk',seed:8}},
 ],
 constraints:['Every stem, rib and pad starts inside its parent or the sand mound; spines sit half-sunk in the surface.'],
 build(p,add){
  const H=Number(p.height),G=Number(p.girth),N=Number(p.branches),random=rng(Number(p.seed)),form=String(p.form);
  const ribs:BufferGeometry[]=[],spines:BufferGeometry[]=[],flowers:BufferGeometry[]=[],bodies:BufferGeometry[]=[];
  const spine=(at0:Vector3,out:Vector3,s:number)=>{const at=at0.clone().addScaledVector(out,-s*0.9),tip=at0.clone().addScaledVector(out,s*1.4);spines.push(blade([{p:at.toArray() as V,w:s*0.5,t:s*0.5},{p:tip.toArray() as V,w:s*0.08,t:s*0.08}],[0,1,0]));};
  const blossom=(c:V,r:number,petals:number)=>{for(let i=0;i<petals;i++){const a=i*2*Math.PI/petals,dx=Math.cos(a),dz=Math.sin(a);flowers.push(blade([{p:[c[0]+dx*r*0.15,c[1],c[2]+dz*r*0.15],w:r*0.12,t:r*0.05},{p:[c[0]+dx*r*0.6,c[1]+r*0.35,c[2]+dz*r*0.6],w:r*0.28,t:r*0.05},{p:[c[0]+dx*r,c[1]+r*0.55,c[2]+dz*r],w:r*0.06,t:r*0.03}],[-dz,0,dx]));}flowers.push(blob([c[0],c[1]+r*0.12,c[2]],[r*0.22,r*0.18,r*0.22],6,3));};
  let mound=0.4,top:V=[0,H,0];
  // Ribbed column: lathe body + raised rib sweeps that follow the profile; areoles on rib crests.
  const column=(base:V,r:number,h:number,ribN:number,dome:number)=>{
   const prof:Array<[number,number]>=[[r*0.92,0],[r,h*0.12],[r,h-dome*r],[r*0.75,h-dome*r*0.35],[r*0.3,h-dome*r*0.05]];
   bodies.push(lathe(prof.map(([a,y])=>[a,base[1]+y] as [number,number]),ribN*2,{center:[base[0],base[2]],phase:Math.PI/ribN/2}));
   for(let k=0;k<ribN;k++){const a=k*2*Math.PI/ribN,dx=Math.cos(a),dz=Math.sin(a);
    const st=prof.slice(0,-1).map(([a2,y],i)=>({center:[base[0]+dx*a2*0.93,base[1]+y+(i===0?r*0.04:0),base[2]+dz*a2*0.93] as V,radius:r*0.16*(i===3?0.7:1)}));
    ribs.push(taperedSweep(st,6));
    const steps=Math.max(2,Math.round((h-dome*r)/(r*0.9)));
    for(let s=1;s<=steps;s++){const y=base[1]+h*0.12+(h-dome*r-h*0.12)*s/steps*0.95,at=new Vector3(base[0]+dx*r*1.08,y,base[2]+dz*r*1.08);spine(at,new Vector3(dx,0.25,dz).normalize(),r*0.11);}
   }
   return [base[0],base[1]+h,base[2]] as V;
  };
  if(form==='saguaro'){
   const r=0.17*G*Math.max(0.6,H/3.2)**0.5;mound=r*3.2;
   top=column([0,0.02,0],r,H,10,1.6);
   for(let i=0;i<N;i++){
    const a=i*2.3+random()*0.9,ha=H*(0.35+random()*0.25),ra=r*0.68,out=r*0.9+ra*1.8,rise=H*(0.22+random()*0.18)*(i%2?0.8:1),dx=Math.cos(a),dz=Math.sin(a);
    const pts:V[]=[[dx*r*0.3,ha,dz*r*0.3],[dx*out*0.55,ha+ra*0.15,dz*out*0.55],[dx*out*0.92,ha+ra*0.8,dz*out*0.92],[dx*out,ha+ra*2.2,dz*out],[dx*out,ha+rise,dz*out]];
    bodies.push(taperedSweep(pts.map(c=>({center:c,radius:ra})),12));
    bodies.push(lathe([[ra,ha+rise-0.01],[ra*0.75,ha+rise+ra*0.55],[ra*0.3,ha+rise+ra*0.85]],12,{center:[dx*out,dz*out]}));
    for(let k=0;k<6;k++){const b=k*Math.PI/3,ox=Math.cos(b),oz=Math.sin(b);ribs.push(taperedSweep([{center:[dx*out+ox*ra*0.93,ha+ra*2.2,dz*out+oz*ra*0.93],radius:ra*0.16},{center:[dx*out+ox*ra*0.93,ha+rise,dz*out+oz*ra*0.93],radius:ra*0.16},{center:[dx*out+ox*ra*0.6,ha+rise+ra*0.6,dz*out+oz*ra*0.6],radius:ra*0.1}],5));
     spine(new Vector3(dx*out+ox*ra*1.08,ha+ra*2.2+(rise-ra*2.2)*0.5,dz*out+oz*ra*1.08),new Vector3(ox,0.2,oz).normalize(),ra*0.12);}
    if(p.flowers)blossom([dx*out,ha+rise+ra*0.75,dz*out],ra*0.55,6);
   }
   if(p.flowers)for(let k=0;k<4;k++){const b=k*1.6+random();blossom([Math.cos(b)*r*0.45,H-r*0.25,Math.sin(b)*r*0.45],r*0.38,6);}
  } else if(form==='prickly-pear'){
   const w=0.22*G*Math.max(0.5,H/1.3),ph=w*1.45,th=w*0.11;mound=w*2.6;
   const pad=(m:Matrix4,depth:number)=>{
    const g=facetPad(w,ph,th,10,6);g.applyMatrix4(m);bodies.push(g);
    for(const [u,v] of [[-0.45,0.3],[0.4,0.45],[0,0.7],[-0.25,0.55],[0.3,0.2],[0,0.35]] as Array<[number,number]>){for(const sd of [-1,1]){const k=Math.sin(Math.PI*v);const at=new Vector3(u*w*k*0.9,v*ph,sd*th*k*0.95).applyMatrix4(m),n=new Vector3(0,0,sd).transformDirection(m);spine(at,n,w*0.06);}}
    return depth;
   };
   const frontier:Array<{m:Matrix4;depth:number}>=[];
   const roots=Math.min(2,Math.max(1,Math.ceil(N/4)));
   for(let i=0;i<roots;i++){const m=new Matrix4().makeTranslation(i?w*0.9:0,w*0.06,i?w*0.3:0).multiply(new Matrix4().makeRotationY(i*1.3+random()*0.4)).multiply(new Matrix4().makeRotationZ((random()-.5)*0.3));pad(m,0);frontier.push({m,depth:0});}
   let made=0;
   while(made<N&&frontier.length){
    const parent=frontier.shift()!;const kids=parent.depth<2?2:1;
    for(let c=0;c<kids&&made<N;c++){
     const u=(c?0.38:-0.38)*w*0.9,v=ph*(0.84-Math.abs(u/w)*0.25);
     const m=parent.m.clone().multiply(new Matrix4().makeTranslation(u,v,0)).multiply(new Matrix4().makeRotationY((random()-.5)*1.6)).multiply(new Matrix4().makeRotationZ((c?-1:1)*(0.3+random()*0.35))).multiply(new Matrix4().makeScale(0.82,0.82,0.9)).multiply(new Matrix4().makeTranslation(0,-ph*0.12,0));
     pad(m,parent.depth+1);frontier.push({m,depth:parent.depth+1});made++;
     if(p.flowers&&parent.depth>=1){for(const fu of [-0.3,0.25]){const at=new Vector3(fu*w,ph*0.93,0).applyMatrix4(m);flowers.push(blob(at.toArray() as V,[w*0.11,w*0.15,w*0.11],7,4));}}
    }
   }
   top=[0,H,0];
  } else {
   const r=0.32*G*H/0.75;mound=r*2.6;
   const heads:Array<[number,number,number]>=[[0,0,1]];for(let i=0;i<N;i++){const a=i*2.4+random()*0.6;heads.push([Math.cos(a)*r*1.55,Math.sin(a)*r*1.55,0.5+random()*0.25]);}
   for(const [x,z,s] of heads){const rr=r*s,hh=H*s;
    const prof:Array<[number,number]>=[[rr*0.8,0.02],[rr,hh*0.3],[rr*0.95,hh*0.62],[rr*0.65,hh*0.9],[rr*0.25,hh]];
    bodies.push(lathe(prof,24,{center:[x,z]}));
    for(let k=0;k<12;k++){const a=k*Math.PI/6,dx=Math.cos(a),dz=Math.sin(a);ribs.push(taperedSweep(prof.slice(0,-1).map(([q,y],i)=>({center:[x+dx*q*0.93,y+(i===0?0.02:0),z+dz*q*0.93] as V,radius:rr*0.13*(i===3?0.75:1)})),5));
     for(const t of [0.35,0.6,0.85]){const q=t<0.5?rr:t<0.7?rr*0.97:rr*0.72;spine(new Vector3(x+dx*q*1.08,hh*t,z+dz*q*1.08),new Vector3(dx,0.4,dz).normalize(),rr*0.16);}}
    if(p.flowers)for(let k=0;k<5;k++){const a=k*1.25+random()*0.3;blossom([x+Math.cos(a)*rr*0.28,hh-rr*0.08,z+Math.sin(a)*rr*0.28],rr*0.2,7);}
   }
   top=[0,H,0];
  }
  add('mound','ground',lathe([[mound,0],[mound*0.75,mound*0.05],[mound*0.3,mound*0.08]],11,{squash:0.85,phase:random()}));
  // lowest point on the ground (the noise lifted some 1 mm clear)
  const pebbles:BufferGeometry[]=[];for(let i=0;i<5;i++){const a=random()*6.28,d=mound*(0.45+random()*0.4),s=mound*0.05*(0.6+random());pebbles.push(rest(blob([Math.cos(a)*d,s*0.6,Math.sin(a)*d],[s,s*0.6,s*0.85],6,3,random,0.3)));}
  add('pebbles','ground',merge(pebbles),'mound');
  add('body','body',merge(bodies),'mound');if(ribs.length)add('ribs','rib',merge(ribs),'body');add('spines','spine',merge(spines),'body');
  if(flowers.length)add('flowers','flower',merge(flowers),'body');
  return {top};
 },
});

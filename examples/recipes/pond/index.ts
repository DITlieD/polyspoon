import { blade, blob, forgeRecipe, lathe, merge, rng } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import type { BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';
type V=[number,number,number];
const controls:Control[]=[
 {key:'size',label:'Pond size',kind:'range',group:'shape',unit:'m',min:1,max:8,step:0.1,default:2.6,hint:'Longest diameter of the water.',affects:['geometry'],targets:['water','bank']},
 {key:'oval',label:'Oval',kind:'range',group:'shape',unit:'ratio',min:0.45,max:1,step:0.01,default:0.85,hint:'Width as a share of length.',affects:['geometry'],targets:['water','bank']},
 {key:'stones',label:'Stone rim',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Ring of fieldstones around the water.',affects:['topology'],targets:['stone']},
 {key:'reeds',label:'Reed clumps',kind:'integer',group:'construction',unit:'count',min:0,max:10,step:1,default:2,hint:'Clumps of reeds and cattails at the edge.',affects:['topology'],targets:['reed']},
 {key:'lilies',label:'Lily pads',kind:'integer',group:'construction',unit:'count',min:0,max:16,step:1,default:6,hint:'Floating lily pads.',affects:['topology'],targets:['pad']},
 {key:'blooms',label:'Blooms',kind:'integer',group:'construction',unit:'count',min:0,max:8,step:1,default:2,hint:'Water-lily or lotus flowers on the pads.',affects:['topology'],targets:['bloom']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:10,hint:'Repeatable stone, pad and reed placement.',affects:['geometry'],targets:['stone','pad','reed']},
];
export const pondRecipe=forgeRecipe({
 id:'pond',version:'1.0.0',title:'Pond',description:'A small pond with a still water surface on a muddy bank, edged with fieldstones, clumps of reeds and cattails, and floating lily pads with blooms.',category:'Nature',order:370,
 entry:'examples/recipes/pond/index.ts',exportName:'pondRecipe',
 roles:{water:'Water surface.',bank:'Muddy bank.',stone:'Rim stones.',reed:'Reeds and grass.',cattail:'Cattail heads.',pad:'Lily pads.',bloom:'Flower petals.',heart:'Flower hearts.'},
 palettes:{garden:{label:'Garden',colors:{water:'#3f7fa6',bank:'#5c4a36',stone:'#9a968c',reed:'#6d8f3c',cattail:'#5a3a22',pad:'#4f8f3a',bloom:'#f6eef2',heart:'#f2c53d'}},marsh:{label:'Marsh',colors:{water:'#4d6e5e',bank:'#4e4230',stone:'#7d7a6e',reed:'#8a9a4a',cattail:'#4a2e1c',pad:'#5d8a3e',bloom:'#f0e6a0',heart:'#e0a02a'}},lotus:{label:'Lotus',colors:{water:'#2f6f8f',bank:'#6a5a44',stone:'#b0aa9c',reed:'#5f8a46',cattail:'#5a3a22',pad:'#3f8a4a',bloom:'#f08ab0',heart:'#f6d24a'}}},
 roughness:{water:0.12},metalness:{water:0.15},
 controls,groundSnap:0.03,
 presets:[
  {id:'garden-pond',name:'Garden pond',description:'Round stone-rimmed pond with white water lilies.',parameters:{}},
  {id:'marsh-pool',name:'Marsh pool',description:'Long oval reedy pool full of cattails, no stones.',parameters:{size:3.4,oval:0.55,stones:false,reeds:8,lilies:3,blooms:0,colorway:'marsh',seed:3}},
  {id:'lotus-pond',name:'Lotus pond',description:'Pads crowding the water and tall pink lotus blooms.',parameters:{size:2.2,oval:0.95,reeds:1,lilies:14,blooms:6,colorway:'lotus',seed:19}},
 ],
 constraints:['The water disc sits above the bank floor; pads sit 3 mm into the water surface, blooms and hearts bed into the pads; reeds stand in the bank.'],
 build(p,add){
  const S=Number(p.size),O=Number(p.oval),random=rng(Number(p.seed)),A=S/2,B=S/2*O,wy=0.07;
  add('bank','bank',lathe([[A*1.18,0],[A*1.12,0.035],[A*0.98,0.055]],18,{squash:(B+A*0.18)/(A*1.18)}));
  add('water','water',lathe([[A*0.98,0.045],[A*0.98,wy]],18,{squash:B/A,phase:0.09}),'bank');
  const edge=(t:number,k=1):V=>[Math.cos(t)*A*k,0,Math.sin(t)*B*k];
  const stones:BufferGeometry[]=[],reeds:BufferGeometry[]=[],cats:BufferGeometry[]=[],pads:BufferGeometry[]=[],blooms:BufferGeometry[]=[],hearts:BufferGeometry[]=[];
  if(p.stones){const n=Math.max(10,Math.round(Math.PI*(A+B)/0.28));for(let i=0;i<n;i++){const t=i*2*Math.PI/n+(random()-.5)*0.08,e=edge(t,1.02),s=0.12+random()*0.06;stones.push(blob([e[0],s*0.62,e[2]],[s*1.2,s*0.62,s],7,4,random,0.3));}}
  const clumps=Number(p.reeds);
  for(let c=0;c<clumps;c++){const t=c*2*Math.PI/Math.max(clumps,1)+random()*0.5+0.4,e=edge(t,0.9),n=7+Math.floor(random()*5);
   for(let i=0;i<n;i++){const a=random()*6.28,d=random()*0.18,x=e[0]+Math.cos(a)*d,z=e[2]+Math.sin(a)*d,h=0.6+random()*0.7,lx=Math.cos(a)*h*0.12,lz=Math.sin(a)*h*0.12;
    reeds.push(blade([{p:[x,0.03,z],w:0.012,t:0.006},{p:[x+lx*0.4,h*0.5,z+lz*0.4],w:0.011,t:0.005},{p:[x+lx,h,z+lz],w:0.003,t:0.002}],[-Math.sin(a),0,Math.cos(a)]));
    if(i%3===0){const ch=h*0.85;reeds.push(taperedSweep([{center:[x,0.03,z],radius:0.007},{center:[x+lx*0.3,ch,z+lz*0.3],radius:0.006},{center:[x+lx*0.32,ch+0.22,z+lz*0.32],radius:0.003}],5));cats.push(taperedSweep([{center:[x+lx*0.3,ch-0.02,z+lz*0.3],radius:0.022},{center:[x+lx*0.31,ch+0.06,z+lz*0.31],radius:0.026},{center:[x+lx*0.32,ch+0.14,z+lz*0.32],radius:0.021}],7));}
   }}
  const nl=Number(p.lilies),nb=Number(p.blooms);
  const spots:Array<[number,number,number]>=[];
  for(let i=0;i<nl*6&&spots.length<nl;i++){const t=random()*6.28,k=0.25+random()*0.6,r=0.1+random()*0.08,x=Math.cos(t)*A*k,z=Math.sin(t)*B*k;if(Math.hypot(x/A,z/B)+r/B>0.88)continue;if(spots.some(([sx,sz,sr])=>Math.hypot(x-sx,z-sz)<r+sr+0.02))continue;spots.push([x,z,r]);}
  spots.forEach(([x,z,r],i)=>{
   pads.push(lathe([[r,wy-0.003],[r*0.96,wy+0.006]],11,{center:[x,z],phase:random()}));
   if(i<nb){const lotus=p.colorway==='lotus',hy=wy+0.006+(lotus?0.18:0),pr=lotus?0.09:0.07;
    if(lotus)reeds.push(taperedSweep([{center:[x,wy-0.012,z],radius:0.008},{center:[x,hy,z],radius:0.007}],5));
    for(const [ring,count,up,len] of [[0,8,0.5,1],[1,6,1.1,0.8]] as Array<[number,number,number,number]>){for(let q=0;q<count;q++){const a=q*2*Math.PI/count+ring*0.4,dx=Math.cos(a),dz=Math.sin(a),l=pr*len;
     // Each petal gets its own tilt and the inner ring starts 6 mm higher and further in: petal roots are narrow (they overlapped their neighbours); petals at the same lift had overlapping
     // coplanar undersides (lotus/garden-pond blooms).
     const lift=up*(1+(q%2)*0.12+ring*0.05),by=hy-0.014+ring*0.005+(q%3)*0.002,br=0.004; // roots sit deep in the heart at staggered heights
     blooms.push(blade([{p:[x+dx*br,by,z+dz*br],w:l*0.08,t:0.003},{p:[x+dx*l*0.55,hy+l*0.35*lift,z+dz*l*0.55],w:l*0.3,t:0.004},{p:[x+dx*l*0.85,hy+l*0.95*lift,z+dz*l*0.85],w:0.004,t:0.002}],[-dz,0,dx]));}}
    hearts.push(lathe([[0.022,hy-0.003],[0.026,hy+0.02],[0.016,hy+0.035]],7,{center:[x,z]}));}
  });
  if(stones.length)add('stones','stone',merge(stones),'bank');
  if(reeds.length)add('reeds','reed',merge(reeds),'bank');if(cats.length)add('cattails','cattail',merge(cats),'reeds');
  if(pads.length)add('pads','pad',merge(pads),'water');if(blooms.length)add('blooms','bloom',merge(blooms),'pads');if(hearts.length)add('hearts','heart',merge(hearts),'pads');
  return {water:[0,wy,0]};
 },
});

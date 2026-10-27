import { blade, blob, box, forgeRecipe, lathe, merge, rng } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import type { BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';
type V=[number,number,number];
const controls:Control[]=[
 {key:'shape',label:'Bed shape',kind:'choice',group:'construction',unit:'none',default:'rect',options:[{value:'rect',label:'Rectangular, plank edging'},{value:'round',label:'Round, stone edging'}],hint:'Outline and edging of the bed.',affects:['topology'],targets:['edging','soil']},
 {key:'flower',label:'Flowers',kind:'choice',group:'construction',unit:'none',default:'tulip',options:[{value:'tulip',label:'Tulips'},{value:'daisy',label:'Daisies'},{value:'sunflower',label:'Sunflowers'}],hint:'Kind of flower planted.',affects:['topology'],targets:['petal','petalAlt','center']},
 {key:'size',label:'Bed size',kind:'range',group:'shape',unit:'m',min:0.6,max:3,step:0.05,default:1.6,hint:'Length (rectangular) or diameter (round).',affects:['geometry'],targets:['edging','soil']},
 {key:'stemHeight',label:'Stem height',kind:'range',group:'shape',unit:'m',min:0.15,max:2,step:0.01,default:0.42,hint:'Height of the flowers above the soil.',affects:['geometry'],targets:['stem']},
 {key:'density',label:'Density',kind:'range',group:'shape',unit:'ratio',min:0.4,max:1.5,step:0.05,default:1,hint:'Plants per square meter relative to the flower type default.',affects:['topology'],targets:['stem']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:4,hint:'Repeatable plant placement, lean and color mix.',affects:['geometry'],targets:['stem','petal']},
];
export const flowerBedRecipe=forgeRecipe({
 id:'flower-bed',version:'1.0.0',title:'Flower bed',description:'A raised garden bed of tulips, daisies or sunflowers in mounded soil, edged with planks or fieldstones.',category:'Nature',order:330,
 entry:'examples/recipes/flower-bed/index.ts',exportName:'flowerBedRecipe',
 roles:{edging:'Plank or stone edging.',soil:'Mounded soil.',stem:'Stems and leaves.',petal:'Main petals.',petalAlt:'Second petal color.',center:'Flower centers.'},
 palettes:{spring:{label:'Spring',colors:{edging:'#9a7350',soil:'#4a3426',stem:'#4f8a3a',petal:'#e0435a',petalAlt:'#f3c74a',center:'#f7e7a0'}},meadow:{label:'Meadow',colors:{edging:'#8d8a82',soil:'#57402c',stem:'#5a923f',petal:'#f8f6ee',petalAlt:'#f0e6ff',center:'#f2b630'}},harvest:{label:'Harvest',colors:{edging:'#7c5a3c',soil:'#3f2c20',stem:'#4b7d33',petal:'#f5bb1e',petalAlt:'#e89a17',center:'#5a3a1e'}}},
 controls,groundSnap:0.03,
 presets:[
  {id:'tulip-bed',name:'Tulip bed',description:'Plank-edged bed of red and yellow tulips in rows.',parameters:{}},
  {id:'daisy-ring',name:'Daisy ring',description:'Round stone-edged mound of white daisies.',parameters:{shape:'round',flower:'daisy',size:1.4,stemHeight:0.22,colorway:'meadow',seed:9}},
  {id:'sunflower-patch',name:'Sunflower patch',description:'Tall nodding sunflowers with broad leaves.',parameters:{flower:'sunflower',size:1.8,stemHeight:1.6,density:0.8,colorway:'harvest',seed:2}},
 ],
 constraints:['Stems start inside the soil; flower heads attach to their stem tips; soil sits inside the edging.'],
 build(p,add){
  const S=Number(p.size),Hs=Number(p.stemHeight),random=rng(Number(p.seed)),round=p.shape==='round',kind=String(p.flower);
  const W=round?S:S*0.55,L=S,eh=0.16,soilTop=eh+0.05;
  const edge:BufferGeometry[]=[],stems:BufferGeometry[]=[],petals:BufferGeometry[]=[],alt:BufferGeometry[]=[],centers:BufferGeometry[]=[];
  if(round){
   const R=S/2,n=Math.max(9,Math.round(Math.PI*S/0.2));
   for(let i=0;i<n;i++){const a=i*2*Math.PI/n,s=0.11+random()*0.03;edge.push(blob([Math.cos(a)*R,s*0.72,Math.sin(a)*R],[s*1.15,s*0.72,s],7,4,random,0.25));}
   add('soil','soil',lathe([[R*0.97,0],[R*0.94,eh],[R*0.6,soilTop],[R*0.2,soilTop+0.03]],14));
  }else{
   const t=0.05;
   for(const sd of [-1,1]){edge.push(box([L,eh,t],[0,eh/2,sd*(W/2-t/2)],0.006));edge.push(box([t,eh,W-2*t-0.004],[sd*(L/2-t/2),eh/2,0],0.006));}
   for(const sx of [-1,1])for(const sz of [-1,1])edge.push(box([0.07,eh+0.06,0.07],[sx*(L/2-0.02),(eh+0.06)/2,sz*(W/2-0.02)],0.008));
   const iw=L-2*t+0.02,id=W-2*t+0.02;
   add('soil','soil',box([iw,soilTop-0.01,id],[0,(soilTop-0.01)/2+0.006,0],0.03));
  }
  add('edging','edging',merge(edge),'soil');
  const spacing=kind==='sunflower'?0.3:kind==='tulip'?0.17:0.21,dens=Number(p.density);
  const pts:Array<[number,number]>=[];
  const nx=Math.max(1,Math.floor((L-0.2)/spacing*Math.sqrt(dens))),nz=Math.max(1,Math.floor((W-0.2)/spacing*Math.sqrt(dens)));
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const x=((i+0.5)/nx-0.5)*(L-0.24)+(random()-.5)*spacing*0.3,z=((j+0.5)/nz-0.5)*(W-0.24)+(random()-.5)*spacing*0.3+(i%2?spacing*0.25:0);if(round&&Math.hypot(x,z)>S/2-0.16)continue;pts.push([x,z]);}
  // Triangle budget: thin the planting evenly when a large bed would exceed ~11k triangles.
  const cap=Math.floor(11000/(kind==='sunflower'?560:kind==='daisy'?330:240)),plants=pts.length>cap?pts.filter((_,i)=>Math.floor(i*cap/pts.length)!==Math.floor((i-1)*cap/pts.length)):pts;
  let k=0;
  for(const [x,z] of plants){
   const y0=soilTop-0.04,h=Hs*(0.82+random()*0.3),la=random()*6.28,lean=(kind==='sunflower'?0.05:0.08)*h,lx=Math.cos(la)*lean,lz=Math.sin(la)*lean,sr=kind==='sunflower'?0.022:0.007;
   const tip:V=[x+lx,y0+h,z+lz];
   stems.push(taperedSweep([{center:[x,y0,z],radius:sr*1.2},{center:[x+lx*0.3,y0+h*0.5,z+lz*0.3],radius:sr},{center:tip,radius:sr*0.8}],5));
   const leaves=kind==='sunflower'?4:kind==='daisy'?4:2;
   for(let l=0;l<leaves;l++){const ly=y0+h*(kind==='sunflower'?0.25+l*0.17:kind==='daisy'?0.03+l*0.02:0.12+l*0.12),a=la+l*2.2+random(),dx=Math.cos(a),dz=Math.sin(a),ll=kind==='sunflower'?0.3:kind==='tulip'?0.2:0.13;
    stems.push(blade([{p:[x+lx*(ly-y0)/h,ly,z+lz*(ly-y0)/h],w:ll*0.08,t:0.004},{p:[x+dx*ll*0.5,ly+ll*(kind==='tulip'?0.5:0.15),z+dz*ll*0.5],w:ll*0.24,t:0.005},{p:[x+dx*ll,ly+ll*(kind==='tulip'?0.55:-0.05),z+dz*ll],w:0.004,t:0.003}],[0,1,0].map((v,i)=>i===1?0.3:i===0?-dz:dx) as V));}
   const target=(k++%3===1)?alt:petals;
   if(kind==='tulip'){
    const r=0.035+random()*0.008;
    target.push(lathe([[r*0.35,tip[1]-0.005],[r*0.95,tip[1]+r*0.6],[r,tip[1]+r*1.4],[r*0.8,tip[1]+r*2],[r*0.45,tip[1]+r*2.25]],6,{center:[tip[0],tip[2]],phase:random()}));
    centers.push(lathe([[r*0.45,tip[1]-0.012],[r*0.3,tip[1]+r*0.2],[r*0.22,tip[1]+r*1.5],[r*0.08,tip[1]+r*1.7]],5,{center:[tip[0],tip[2]]})); // the pistil's foot cuts through the cup's bottom rim (it floated inside the cup); its base 7 mm under the cup's
    for(let q=0;q<3;q++){const a=q*2.094+0.5,dx=Math.cos(a),dz=Math.sin(a);target.push(blade([{p:[tip[0]+dx*r*0.6,tip[1]+r*0.3,tip[2]+dz*r*0.6],w:r*0.35,t:0.003},{p:[tip[0]+dx*r*1.05,tip[1]+r*1.4,tip[2]+dz*r*1.05],w:r*0.55,t:0.003},{p:[tip[0]+dx*r*0.95,tip[1]+r*2.5,tip[2]+dz*r*0.95],w:0.003,t:0.002}],[-dz,0,dx]));}
   }else{
    const sun=kind==='sunflower',R=sun?0.13+random()*0.04:0.075,np=sun?16:10,face=sun?0.75:0.05;
    // head faces outward-up: local frame (n = facing, e1/e2 in head plane)
    const fa=Math.atan2(z,x)+(random()-.5)*0.6,n:V=[Math.cos(fa)*Math.sin(face),Math.cos(face),Math.sin(fa)*Math.sin(face)];
    const e1:V=[-Math.sin(fa),0,Math.cos(fa)],e2:V=[n[1]*e1[2]-n[2]*e1[1],n[2]*e1[0]-n[0]*e1[2],n[0]*e1[1]-n[1]*e1[0]];
    const at=(u:number,v:number,w:number):V=>[tip[0]+e1[0]*u+e2[0]*v+n[0]*w,tip[1]+e1[1]*u+e2[1]*v+n[1]*w,tip[2]+e1[2]*u+e2[2]*v+n[2]*w];
    const cr=R*(sun?0.45:0.3);
    centers.push(taperedSweep([{center:at(0,0,-cr*0.35),radius:cr*0.85},{center:at(0,0,cr*0.1),radius:cr},{center:at(0,0,cr*0.35),radius:cr*0.7}],sun?10:7));
    for(let q=0;q<np;q++){const a=q*2*Math.PI/np+(sun&&q%2?0.1:0),c=Math.cos(a),s=Math.sin(a);
     target.push(blade([{p:at(c*cr*0.8,s*cr*0.8,0),w:R*0.07,t:0.003},{p:at(c*R*0.65,s*R*0.65,R*0.05),w:R*(sun?0.13:0.11),t:0.003},{p:at(c*R,s*R,-R*0.03),w:0.003,t:0.002}],at(-s,c,0).map((v,i)=>v-tip[i]!) as V));}
    if(sun){stems.push(blade([{p:[tip[0],tip[1]-0.02,tip[2]],w:0.015,t:0.012},{p:at(0,0,-cr*0.3),w:0.02,t:0.015}],[1,0,0]));}
   }
  }
  add('stems','stem',merge(stems),'soil');
  if(petals.length)add('petals','petal',merge(petals),'stems');
  if(alt.length)add('petals-alt','petalAlt',merge(alt),'stems');
  if(centers.length)add('centers','center',merge(centers),'stems');
  return {top:[0,soilTop+Hs,0]};
 },
});

import { blob, box, forgeRecipe, lathe, merge, rng } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3, type BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';
type V=[number,number,number];
const controls:Control[]=[
 {key:'form',label:'Form',kind:'choice',group:'construction',unit:'none',default:'berry',options:[{value:'berry',label:'Wild berry bush'},{value:'hedge',label:'Clipped hedge'},{value:'hydrangea',label:'Flowering hydrangea'}],hint:'Growth habit and what decorates the foliage.',affects:['topology'],targets:['foliage','accent']},
 {key:'width',label:'Width',kind:'range',group:'shape',unit:'m',min:0.4,max:4,step:0.05,default:1.2,hint:'Spread (or hedge length).',affects:['geometry'],targets:['foliage']},
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:0.3,max:2.5,step:0.05,default:0.95,hint:'Overall height.',affects:['geometry'],targets:['foliage']},
 {key:'lumps',label:'Lumpiness',kind:'range',group:'shape',unit:'ratio',min:0,max:1,step:0.05,default:0.6,hint:'How irregular the foliage masses are.',affects:['geometry'],targets:['foliage']},
 {key:'accents',label:'Berries / blooms',kind:'integer',group:'construction',unit:'count',min:0,max:60,step:1,default:28,hint:'Berries or flower heads on the surface.',affects:['topology'],targets:['accent']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:6,hint:'Repeatable lobe and accent placement.',affects:['geometry'],targets:['foliage','accent']},
];
export const shrubRecipe=forgeRecipe({
 id:'shrub',version:'1.0.0',title:'Shrub',description:'A garden shrub built from layered leaf masses: a wild berry bush, a clipped boxwood hedge, or a hydrangea heavy with flower heads.',category:'Nature',order:340,
 entry:'examples/recipes/shrub/index.ts',exportName:'shrubRecipe',
 roles:{foliage:'Outer leaf masses.',shade:'Inner, darker leaf masses.',branch:'Woody stems.',accent:'Berries or flower florets.',ground:'Mulch ring.'},
 palettes:{bramble:{label:'Bramble',colors:{foliage:'#4f8a3c',shade:'#36652c',branch:'#5a4030',accent:'#b8243a',ground:'#5b4532'}},boxwood:{label:'Boxwood',colors:{foliage:'#3f7a3a',shade:'#2b5a2c',branch:'#4e3a2c',accent:'#e9e4c8',ground:'#6a5640'}},hydrangea:{label:'Hydrangea',colors:{foliage:'#4a8048',shade:'#30603a',branch:'#5a4632',accent:'#8aa4e8',ground:'#584432'}}},
 controls,groundSnap:0.03,
 presets:[
  {id:'berry-bush',name:'Berry bush',description:'Loose wild mound studded with red berries.',parameters:{}},
  {id:'boxwood-hedge',name:'Boxwood hedge',description:'Long clipped hedge with crisp squared sides.',parameters:{form:'hedge',width:2.4,height:0.9,lumps:0.2,accents:0,colorway:'boxwood',seed:3}},
  {id:'hydrangea',name:'Hydrangea',description:'Rounded shrub carrying big blue mophead blooms.',parameters:{form:'hydrangea',width:1.3,height:1.1,lumps:0.5,accents:24,colorway:'hydrangea',seed:21}},
 ],
 constraints:['Leaf masses overlap each other and the stems; accents sit half-sunk into the outer masses.'],
 build(p,add){
  const W=Number(p.width),H=Number(p.height),J=Number(p.lumps),A=Number(p.accents),random=rng(Number(p.seed)),form=String(p.form);
  const outer:BufferGeometry[]=[],inner:BufferGeometry[]=[],stems:BufferGeometry[]=[],acc:BufferGeometry[]=[];
  const masses:Array<{c:V;r:V;g?:BufferGeometry}>=[];
  if(form==='hedge'){
   // Clipped hedge: a chamfered core block (crisp silhouette) skinned with half-sunk leaf tufts on the top and sides.
   const D=Math.min(W*0.45,H*0.75),core=H*0.92,r=Math.min(D,H)*0.16,step=r*1.42;
   inner.push(box([W-r,core-0.04,D-r],[0,0.04+(core-0.04)/2,0],r*0.6));
   const tuft=(c:V,s:number,sides=6)=>{const rr:V=[r*s,r*s*0.8,r*s];outer.push(blob(c,rr,sides,3,random,0.3*J+0.1));masses.push({c,r:rr});};
   // Side and end rows space 12% wider (1.59 r, still under the 1.8 r tuft diameter) and use five-sided tufts to stay within the Nature
   // triangle budget.
   // Rows are spread evenly from edge to edge (fixed steps stopped up to a full step short and left a bare front-top strip). An edge
   // row covers each top edge (alternating 8 mm in height and 5 mm in depth so neighbours never share a facet plane), and the other tufts are jittered about 15% in position and scale to break up the grid. Top tufts alternate 6 mm
   // in height in a checkerboard (equal-height neighbours' flat crowns overlapped coplanar); end rows sit 7 mm above the side rows
   // (corner tufts' crowns were coplanar).
   const even=(a:number,b:number,k=1)=>{const n=Math.max(2,Math.ceil((b-a)/(step*k))+1);return Array.from({length:n},(_,i)=>a+(b-a)*i/(n-1));},jit=()=>(random()-.5)*r*0.3;
   even(-W/2+r,W/2-r).forEach((x,ix)=>even(-D/2+r*0.8,D/2-r*0.8).forEach((z,iz)=>tuft([x+jit(),core-r*0.25+(random()-.5)*r*0.4*J+((ix+iz)%2)*0.006,z+jit()*0.5],1+(random()-.5)*0.3)));
   for(const sd of [-1,1])even(-W/2+r,W/2-r).forEach((x,ix)=>tuft([x,core-r*0.45+(ix%2)*0.008,sd*(D/2-r*0.5-(ix%2)*0.005)],0.95));
   for(const sd of [-1,1])for(const x of even(-W/2+r,W/2-r,1.12))for(const y of even(0.04+r*1.2,core-r*0.8,1.12))tuft([x+jit(),y,sd*(D/2-r*0.45)],0.9+(random()-.5)*0.3,5);
   for(const sx of [-1,1])for(const z of even(-D/2+r*0.9,D/2-r*0.9,1.12))for(const y of even(0.04+r*1.2,core-r*0.8,1.12))tuft([sx*(W/2-r*0.45),y+0.007,z],0.9,5);
   stems.push(...[-0.35,0,0.35].map(f=>taperedSweep([{center:[f*W,0.005,0],radius:0.04},{center:[f*W,H*0.25,0],radius:0.03}],6)));
  }else{
   const n=form==='hydrangea'?12:18;
   for(let i=0;i<n;i++){
    const t=i/n,a=i*2.39996+random()*0.5,ring=i===0?0:0.25+0.6*Math.sqrt(t),y=H*(i===0?0.6:0.3+0.45*(1-ring)+random()*0.12*J);
    const r=(i===0?0.4:0.22+random()*0.1*(0.5+J))*Math.min(W,H*1.4);
    const c:V=[Math.cos(a)*ring*(W/2-r*0.55),Math.max(y,r*0.7),Math.sin(a)*ring*(W/2-r*0.55)];
    const rr:V=[r,Math.min(r*0.85,c[1]-0.01),r*0.95];
    if(c[1]+rr[1]>H){rr[1]=H-c[1];}
    {const g=blob(c,rr,7,5,random,0.3*J);(i%3===0?inner:outer).push(g);masses.push({c,r:rr,g});}
    stems.push(taperedSweep([{center:[c[0]*0.15,0.03,c[2]*0.15],radius:0.026-i*0.0008},{center:[c[0]*0.6,c[1]*0.5,c[2]*0.6],radius:0.018},{center:[c[0]*0.85,c[1]*0.75,c[2]*0.85],radius:0.012}],5+i%2)); // every root its own radius, alternating 5/6 sides: the roots met coplanar at the base
   }
  }
  // accents on the upper/outer surface of masses
  for(let i=0,placed=0;placed<A&&i<A*4&&masses.length;i++){
   const m=masses[Math.floor(random()*masses.length)]!,th=random()*6.28,ph=0.2+random()*1.0,d:V=[Math.cos(th)*Math.sin(ph),Math.cos(ph),Math.sin(th)*Math.sin(ph)];
   const o=form==='hydrangea'?Math.min(W,H)*0.012:-Math.min(W,H)*0.045,s:V=[m.c[0]+d[0]*(m.r[0]+o),m.c[1]+d[1]*(m.r[1]+o),m.c[2]+d[2]*(m.r[2]+o)];
   if(masses.some(q=>q!==m&&((s[0]-q.c[0])/q.r[0])**2+((s[1]-q.c[1])/q.r[1])**2+((s[2]-q.c[2])/q.r[2])**2<1.15))continue;
   if(form==='hydrangea'){const R=Math.min(W,H)*0.17;for(let f=0;f<7;f++){const fa=f*0.9,fr=f?R*0.55:0;acc.push(blob([s[0]+Math.cos(fa)*fr,s[1]+R*0.15+(f?0:R*0.25),s[2]+Math.sin(fa)*fr],[R*0.45,R*0.38,R*0.45],6,3,random,0.2));}}
   placed++;
   if(form==='hydrangea'){}else{const r=Math.min(W,H)*0.03;
    // Each berry is cast onto the mass's actual (noisy) leaf surface and sunk 45% of its radius; placed on the ideal ellipsoid,
    // berries floated wherever the noise pulled the leaves inward.
    const mesh=m.g?new Mesh(m.g,new MeshBasicMaterial({side:DoubleSide})):undefined;
    for(let b=0;b<3;b++){let q:V=[s[0]+(b-1)*r*1.6,s[1]+(b===1?r:0),s[2]+(b%2)*r];
     if(mesh){const o=new Vector3(...m.c),dir=new Vector3(...q).sub(o).normalize(),hit=new Raycaster(o,dir,0,10).intersectObject(mesh,false).at(-1);
      if(hit)q=hit.point.clone().addScaledVector(dir,-r*0.45).toArray() as V;}
     acc.push(blob(q,[r,r,r],6,3,random,0.1));}}
  }
  const R0=W*0.55;
  add('mulch','ground',lathe([[R0,0],[R0*0.9,0.03],[R0*0.4,0.05]],12,{squash:form==='hedge'?Math.min(1,H*0.75/W+0.2):0.9}));
  add('stems','branch',merge(stems),'mulch');
  add('inner','shade',merge(inner),'stems');add('outer','foliage',merge(outer),'stems');
  if(acc.length)add('accents','accent',merge(acc),'outer');
  return {top:[0,H,0]};
 },
});

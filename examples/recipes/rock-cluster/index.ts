import { facetedLoft } from '../../../src/engine/geometry.ts';
import { ellipse, forgeRecipe, rng } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'count',label:'Rocks',kind:'integer',group:'construction',unit:'count',min:1,max:9,step:1,default:5,hint:'Main stones in the cluster; pebbles are added around them.',affects:['topology'],targets:['rock','pebble']},
 {key:'size',label:'Largest rock',kind:'range',group:'shape',unit:'m',min:0.3,max:3,step:0.05,default:1.2,hint:'Height of the largest stone.',affects:['geometry'],targets:['rock','pebble']},
 {key:'spread',label:'Spread',kind:'range',group:'shape',unit:'ratio',min:0.6,max:2,step:0.05,default:1.1,hint:'How far stones spread from the center, relative to size.',affects:['geometry'],targets:['rock','pebble']},
 {key:'flatness',label:'Flatness',kind:'range',group:'shape',unit:'ratio',min:0.3,max:1.2,step:0.05,default:0.7,hint:'Height to width of each stone. Low values make slabs.',affects:['geometry'],targets:['rock','pebble']},
 {key:'pebbles',label:'Pebbles',kind:'integer',group:'construction',unit:'count',min:0,max:12,step:1,default:6,hint:'Small scattered stones.',affects:['topology'],targets:['pebble']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:101,hint:'Repeatable facets and layout.',affects:['geometry'],targets:['rock','pebble']},
];
function stone(cx:number,cz:number,w:number,h:number,random:()=>number){
 const sides=6+Math.floor(random()*3),sq=0.65+random()*0.35,yaw=random()*6.283;
 const stations=[[0.82,0],[1,0.28+random()*0.1],[0.86,0.62+random()*0.1],[0.38+random()*0.2,1]] as const;
 return facetedLoft(stations.map(([r,y],k)=>({center:[cx+(k?(random()-.5)*w*0.12:0),y*h,cz+(k?(random()-.5)*w*0.12:0)] as [number,number,number],outline:ellipse(r*w/2,r*w/2*sq,sides,yaw+k*0.35,0.6,random)})));
}
export const rockClusterRecipe=forgeRecipe({
 id:'rock-cluster',version:'1.1.0',priorVersions:['1.0.0'],title:'Rock cluster',description:'A seeded group of faceted stones and pebbles for scattering across terrain.',category:'Nature',order:160,
 entry:'examples/recipes/rock-cluster/index.ts',exportName:'rockClusterRecipe',
 roles:{stone:'Main stones.',accent:'Secondary stones and pebbles.'},
 palettes:{granite:{label:'Granite',colors:{stone:'#8d8a85',accent:'#6f6b66'}},sandstone:{label:'Sandstone',colors:{stone:'#c2a077',accent:'#a07f58'}},basalt:{label:'Basalt',colors:{stone:'#45474b',accent:'#5c5e62'}},mossy:{label:'Mossy',colors:{stone:'#7f8478',accent:'#5d7343'}}},
 controls,
 presets:[
  {id:'outcrop',name:'Outcrop',description:'Five granite stones with pebbles.',parameters:{}},
  {id:'slabs',name:'Slab field',description:'Low sandstone slabs.',parameters:{count:7,size:0.6,flatness:0.35,spread:1.6,colorway:'sandstone',seed:77}},
  {id:'monolith',name:'Monolith',description:'One tall basalt stone with scattered pebbles.',parameters:{count:1,size:2.8,flatness:1.2,pebbles:8,colorway:'basalt',seed:9}},
 ],
 constraints:['Stones are grounded at y = 0 and placed on a golden-angle spiral; spread scales the spiral radius. Pebbles ring the stones within about 1.3x their footprint radius.'],
 build(p,add){
  const n=Number(p.count),S=Number(p.size),spread=Number(p.spread),flat=Number(p.flatness),random=rng(Number(p.seed));
  let reach=0;
  for(let i=0;i<n;i++){
   const s=i===0?1:0.35+random()*0.5,h=S*s,w=h/flat,a=i*2.39996+random()*0.5,d=i===0?0:S*spread*0.45*Math.sqrt(i);
   reach=Math.max(reach,d+w*0.5);
   add('rock-'+i,i%3===2?'accent':'stone',stone(Math.cos(a)*d,Math.sin(a)*d,w,h,random));
  }
  for(let i=0;i<Number(p.pebbles);i++){
   const a=random()*6.283,d=reach*(0.85+random()*0.3*Math.min(1.5,spread)),h=S*(0.05+random()*0.07);
   add('pebble-'+i,'accent',stone(Math.cos(a)*d,Math.sin(a)*d,h/Math.max(0.35,flat*0.7),h,random));
  }
  return {top:[0,S,0]};
 },
});

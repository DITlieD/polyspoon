import { facetedLoft } from '../../../src/engine/geometry.ts';
import { box, forgeRecipe, lathe } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'height',label:'Post height',kind:'range',group:'shape',unit:'m',min:1.4,max:3,step:0.05,default:2.2,hint:'Ground to post cap.',affects:['geometry'],targets:['post','arm','cap']},
 {key:'arms',label:'Sign arms',kind:'integer',group:'construction',unit:'count',min:1,max:4,step:1,default:3,hint:'Stacked pointing boards.',affects:['topology'],targets:['arm']},
 {key:'armLength',label:'Arm length',kind:'range',group:'shape',unit:'m',min:0.5,max:1.2,step:0.05,default:0.8,hint:'Length of each pointing board.',affects:['geometry'],targets:['arm']},
 {key:'seed',label:'Direction seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:7,hint:'Repeatable arm directions.',affects:['geometry'],targets:['arm']},
 {key:'footing',label:'Stone footing',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Adds a stone collar at the base.',affects:['topology'],targets:['footing']},
];
function arrow(length:number,height:number,thick:number){
 // Convex arrow outline in the XZ plane extruded along Y, then stood up so the face looks along +Z.
 const tip=height*0.5,outline:Array<[number,number]>=[[-length/2,-height/2],[length/2-tip,-height/2],[length/2,0],[length/2-tip,height/2],[-length/2,height/2]];
 const g=facetedLoft([{center:[0,-thick/2,0],outline},{center:[0,thick/2,0],outline}]);g.rotateX(-Math.PI/2);return g;
}
export const signpostRecipe=forgeRecipe({
 id:'signpost',version:'1.0.0',title:'Crossroads signpost',description:'A timber post with stacked pointing arms, a pyramid cap and a stone footing.',category:'Structures',order:130,
 entry:'examples/recipes/signpost/index.ts',exportName:'signpostRecipe',
 roles:{post:'Post and cap.',board:'Pointing arms.',stone:'Footing stones.'},
 palettes:{oak:{label:'Oak',colors:{post:'#6b4a33',board:'#c49a63',stone:'#8a8781'}},painted:{label:'Painted',colors:{post:'#3e4a3d',board:'#e2d6b8',stone:'#7d7a74'}},birch:{label:'Birch',colors:{post:'#d9d1c0',board:'#a0643a',stone:'#94918a'}}},
 controls,
 presets:[
  {id:'crossroads',name:'Crossroads',description:'Three arms at a junction.',parameters:{}},
  {id:'trail-marker',name:'Trail marker',description:'Short single-arm marker.',parameters:{height:1.5,arms:1,armLength:0.6,footing:false}},
  {id:'town-square',name:'Town square',description:'Tall painted post with four arms.',parameters:{height:2.8,arms:4,armLength:1,colorway:'painted',seed:42}},
 ],
 constraints:['Arms stack downward from 0.25 m below the cap and need 0.22 m each; the post must fit them above 1.0 m.'],
 check(p){if(Number(p.height)-0.25-Number(p.arms)*0.22<1.0-1e-9)throw new Error('Post too short for the requested arms');},
 build(p,add){
  const h=Number(p.height),arms=Number(p.arms),len=Number(p.armLength),post=0.11;
  let s=(Number(p.seed)>>>0)||1;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  const py=p.footing?0.06:0; // with a footing the post starts 6 cm up inside the stone collar, so its foot and the collar base no longer share the ground plane
  add('post','post',box([post,h-0.06-py,post],[0,(h-0.06+py)/2,0],0.012));
  add('cap','post',lathe([[post*0.75,h-0.07],[post*0.75,h-0.04],[0.004,h]],4,{phase:Math.PI/4}),'post');
  let heading=random()*Math.PI*2;
  for(let i=0;i<arms;i++){
   const q=((heading%(Math.PI/2))+Math.PI/2)%(Math.PI/2);if(Math.abs(q-Math.PI/4)<0.08)heading+=0.12; // an arm at 45 deg lies flat on the post's corner chamfer
   const y=h-0.25-i*0.22,g=arrow(len,0.15,0.03),dir=i%2?-1:1;
   g.translate(len/2-0.02,0,post/2-0.002);g.rotateY(heading);g.translate(0,y,0); // board's back face sits 17 mm into the post (it hovered 1 mm off the post face)
   add('arm-'+i,'board',g,'post');heading+=dir*(0.9+random()*1.6);
  }
  if(p.footing)add('footing','stone',lathe([[0.24,0],[0.22,0.12],[0.15,0.18]],7,{phase:0.3}),'post');
  return {top:[0,h,0]};
 },
});

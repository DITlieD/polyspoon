import { box, forgeRecipe, lathe } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:0.5,max:1.4,step:0.01,default:0.9,hint:'Ground to lid.',affects:['geometry'],targets:['stave','hoop','lid','bung']},
 {key:'radius',label:'Belly radius',kind:'range',group:'shape',unit:'m',min:0.2,max:0.6,step:0.01,default:0.32,hint:'Widest radius at mid height.',affects:['geometry'],targets:['stave','hoop','lid','bung']},
 {key:'bulge',label:'Bulge',kind:'range',group:'shape',unit:'ratio',min:0,max:0.3,step:0.01,default:0.16,hint:'How much narrower the ends are than the belly.',affects:['geometry'],targets:['stave','hoop']},
 {key:'staves',label:'Staves',kind:'integer',group:'construction',unit:'count',min:8,max:20,step:1,default:14,hint:'Number of facets around the body.',affects:['topology'],targets:['stave','hoop']},
 {key:'hoops',label:'Hoops',kind:'integer',group:'construction',unit:'count',min:2,max:6,step:2,default:4,hint:'Iron hoops, placed symmetrically.',affects:['topology'],targets:['hoop']},
 {key:'bung',label:'Bung and tap',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Adds a wooden bung on the belly.',affects:['topology'],targets:['bung']},
];
const belly=(y:number,h:number,r:number,b:number)=>r*(1-b*((2*y/h-1)**2));
export const barrelRecipe=forgeRecipe({
 id:'barrel',version:'1.0.0',title:'Cooper barrel',description:'A bellied stave barrel with iron hoops, a sunk lid and an optional bung.',category:'Props',order:120,
 entry:'examples/recipes/barrel/index.ts',exportName:'barrelRecipe',
 roles:{wood:'Staves and lid.',iron:'Hoops.',dark:'Bung and lid grain.'},
 palettes:{oak:{label:'Oak',colors:{wood:'#a7744a',iron:'#3d3b3a',dark:'#5a3b24'}},weathered:{label:'Weathered',colors:{wood:'#8e8577',iron:'#4f4a45',dark:'#4a443c'}},painted:{label:'Painted red',colors:{wood:'#9a3b2e',iron:'#2f2d2b',dark:'#5e2a20'}}},
 roughness:{iron:0.55},metalness:{iron:0.6},
 controls,
 presets:[
  {id:'cask',name:'Cask',description:'Classic oak cask with four hoops.',parameters:{}},
  {id:'keg',name:'Keg',description:'A short squat keg.',parameters:{height:0.6,radius:0.28,bulge:0.12,hoops:2,staves:12}},
  {id:'rain-barrel',name:'Rain barrel',description:'Tall weathered barrel, no bung.',parameters:{height:1.25,radius:0.4,bulge:0.08,hoops:6,staves:18,bung:false,colorway:'weathered'}},
 ],
 constraints:['Hoops are evenly paired from both ends; the lid is sunk 2 cm inside the top chime.'],
 build(p,add){
  const h=Number(p.height),r=Number(p.radius),b=Number(p.bulge),n=Number(p.staves),hoops=Number(p.hoops);
  const ys=Array.from({length:9},(_,i)=>i*h/8);
  add('stave-body','wood',lathe(ys.map(y=>[belly(y,h,r,b),y]),n));
  add('lid','dark',lathe([[belly(h,h,r,b)*0.86,h-0.02],[belly(h,h,r,b)*0.86,h+0.004]],n),'stave-body');
  for(let i=0;i<hoops;i++){
   const pair=Math.floor(i/2),side=i%2,t=0.08+pair*(0.34/Math.max(1,hoops/2-1||1)),y=(side?1-t:t)*h,w=0.035;
   const y0=Math.max(0.001,y-w/2),y1=Math.min(h-0.001,y+w/2);
   add('hoop-'+i,'iron',lathe([[belly(y0,h,r,b)+0.006,y0],[belly(y1,h,r,b)+0.006,y1]],n),'stave-body');
  }
  if(p.bung){const y=h/2,x=belly(y,h,r,b);add('bung','dark',box([0.05,0.05,0.03],[0,y,x*Math.cos(Math.PI/n)+0.004],0.006),'stave-body'); /* measured from the stave face, not the corner radius: sinks 11 mm (it floated off the flat stave) */}
  return {top:[0,h,0]};
 },
});

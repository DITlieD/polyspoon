import { box, forgeRecipe, lathe, rod } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:2.2,max:4.5,step:0.05,default:3.2,hint:'Ground to finial.',affects:['geometry'],targets:['base','shaft','arm','lantern']},
 {key:'style',label:'Style',kind:'choice',group:'construction',unit:'none',default:'post-top',options:[{value:'post-top',label:'Post top'},{value:'hanging',label:'Hanging arm'}],hint:'Lantern on top of the shaft or hanging from an arm.',affects:['topology'],targets:['arm','lantern']},
 {key:'lanternSize',label:'Lantern size',kind:'range',group:'shape',unit:'m',min:0.22,max:0.5,step:0.01,default:0.34,hint:'Lantern head height.',affects:['geometry'],targets:['lantern']},
 {key:'facets',label:'Lantern facets',kind:'integer',group:'construction',unit:'count',min:4,max:8,step:1,default:6,hint:'Sides of the lantern head.',affects:['topology'],targets:['lantern']},
];
export const lampPostRecipe=forgeRecipe({
 id:'lamp-post',version:'1.0.0',title:'Street lamp post',description:'A cast-iron street lamp with a stepped plinth, fluted shaft and a glazed lantern head.',category:'Structures',order:140,
 entry:'examples/recipes/lamp-post/index.ts',exportName:'lampPostRecipe',
 roles:{iron:'Plinth, shaft, arm and lantern frame.',glass:'Lantern glazing.',trim:'Collars and finial.'},
 palettes:{iron:{label:'Black iron',colors:{iron:'#262a2c',glass:'#f2d98c',trim:'#7b6a3e'}},verdigris:{label:'Verdigris',colors:{iron:'#3f6b5e',glass:'#efe4b0',trim:'#a3884a'}},painted:{label:'Painted green',colors:{iron:'#1f3b2c',glass:'#f6e7a8',trim:'#b59a52'}}},
 roughness:{iron:0.5,glass:0.15,trim:0.4},metalness:{iron:0.7,trim:0.8},
 controls,
 presets:[
  {id:'park-lamp',name:'Park lamp',description:'Post-top lantern.',parameters:{}},
  {id:'harbor-lamp',name:'Harbor lamp',description:'Tall hanging lantern, verdigris.',parameters:{height:4,style:'hanging',lanternSize:0.4,colorway:'verdigris'}},
  {id:'garden-lamp',name:'Garden lamp',description:'Short square lantern.',parameters:{height:2.3,lanternSize:0.26,facets:4,colorway:'painted'}},
 ],
 constraints:['The lantern head must fit below the finial: lanternSize <= 0.2 x height.'],
 check(p){if(Number(p.lanternSize)>0.2*Number(p.height)+1e-9)throw new Error('Lantern too large for the post');},
 build(p,add){
  const h=Number(p.height),L=Number(p.lanternSize),n=Number(p.facets),hanging=p.style==='hanging';
  add('base','iron',lathe([[0.2,0],[0.2,0.06],[0.15,0.1],[0.15,0.28],[0.1,0.34],[0.08,0.4]],8,{phase:Math.PI/8}));
  const shaftTop=hanging?h-0.12:h-L-0.14;
  add('shaft','iron',lathe([[0.06,0.38],[0.05,shaftTop*0.6],[0.04,shaftTop]],8,{phase:Math.PI/8}),'base');
  add('collar','trim',lathe([[0.075,0.42],[0.075,0.48]],8,{phase:Math.PI/8}),'shaft');
  const head=(cx:number,bottom:number)=>{
   const w=L*0.42;
   add('lantern-floor','iron',lathe([[w*0.55,bottom],[w*0.95,bottom+L*0.08]],n,{center:[cx,0]}),hanging?'arm':'shaft');
   add('lantern-glass','glass',lathe([[w*0.85,bottom+L*0.08],[w,bottom+L*0.7]],n,{center:[cx,0]}),'lantern-floor');
   add('lantern-roof','iron',lathe([[w*1.25,bottom+L*0.7],[w*1.2,bottom+L*0.76],[w*0.25,bottom+L*0.96]],n,{center:[cx,0]}),'lantern-glass');
   add('finial','trim',lathe([[0.02,bottom+L*0.95],[0.028,bottom+L*1.0],[0.004,bottom+L*1.08]],6,{center:[cx,0]}),'lantern-roof');
  };
  if(hanging){
   const reach=L*1.1+0.1;
   add('arm','iron',rod([0,shaftTop-0.03,0],[reach,shaftTop-0.03,0],0.022,6),'shaft');
   add('arm-brace','iron',rod([0.02,shaftTop-0.4,0],[reach*0.7,shaftTop-0.04,0],0.014,6),'shaft');
   add('hanger','trim',rod([reach,shaftTop-0.03,0],[reach,shaftTop-0.14,0],0.01,6),'arm');
   head(reach,shaftTop-0.14-L*1.04);
  } else {add('shaft-cap','trim',lathe([[0.06,shaftTop-0.02],[0.09,shaftTop+0.02]],8,{phase:Math.PI/8}),'shaft');head(0,shaftTop+0.02);}
  return {light:[hanging?L*1.1+0.1:0,hanging?shaftTop-0.14-L*0.6:shaftTop+L*0.42,0]};
 },
});

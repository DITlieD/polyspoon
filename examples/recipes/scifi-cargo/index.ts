import { box, forgeRecipe, lathe, loopLoft, rod } from '../../../src/engine/forge-kit.ts';
import type { V3 } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'form',label:'Form',kind:'choice',group:'construction',unit:'none',default:'crate',options:[{value:'crate',label:'Cargo crate'},{value:'case',label:'Equipment case'},{value:'cell',label:'Power cell'}],hint:'A chamfered cargo crate, a long low equipment case, or an upright cylindrical power cell in a cage.',affects:['topology'],targets:['shell','panel','glow']},
 {key:'size',label:'Size',kind:'range',group:'shape',unit:'m',min:0.5,max:1.6,step:0.01,default:1,hint:'Overall height of a crate or cell, length of a case.',affects:['geometry'],targets:['shell','panel']},
 {key:'chamfer',label:'Edge chamfer',kind:'range',group:'shape',unit:'ratio',min:0.04,max:0.2,step:0.005,default:0.12,hint:'Size of the cut corners.',affects:['geometry'],targets:['shell']},
 {key:'lights',label:'Light strips',kind:'integer',group:'construction',unit:'count',min:1,max:4,step:1,default:2,hint:'Glowing strips per face or rings on the cell.',affects:['topology'],targets:['glow']},
 {key:'handles',label:'Handles',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Carry handles on the sides.',affects:['topology'],targets:['metal']},
 {key:'display',label:'Status display',kind:'toggle',group:'construction',unit:'none',default:true,hint:'A small screen panel on the front.',affects:['topology'],targets:['glow','panel']},
];
/** Octagonal-section prism along Z: chamfered box, convex, closed. */
function chamferPrism(w:number,h:number,d:number,c:number,center:V3,axis:'z'|'x'|'y'='z'):ReturnType<typeof loopLoft>{
 const [cx,cy,cz]=center,oct=(z:number,ww=w,hh=h)=>{const a=ww/2,b=hh/2,k=Math.min(c,a*0.45,b*0.45);return [[-a+k,-b],[a-k,-b],[a,-b+k],[a,b-k],[a-k,b],[-a+k,b],[-a,b-k],[-a,-b+k]].map(([x,y])=>axis==='z'?[cx+x!,cy+y!,cz+z]:axis==='x'?[cx+z,cy+y!,cz+x!]:[cx+x!,cy+z,cz+y!]) as V3[];};
 const k=Math.min(c,w*0.2,h*0.2);
 return loopLoft([oct(-d/2,w-2*k,h-2*k),oct(-d/2+k),oct(d/2-k),oct(d/2,w-2*k,h-2*k)]);
}
export const scifiCargoRecipe=forgeRecipe({
 id:'scifi-cargo',version:'1.0.0',title:'Sci-fi cargo',description:'Clean hard-surface sci-fi cargo: chamfered armored shells, inset panels, latches, glowing light strips and status screens.',category:'Sci-fi',order:477,
 entry:'examples/recipes/scifi-cargo/index.ts',exportName:'scifiCargoRecipe',
 roles:{shell:'Armored outer shell.',panel:'Inset panels and trim.',metal:'Latches, handles, feet and frame.',glow:'Light strips, screens and cores.',decal:'Hazard stripes and markings.'},
 palettes:{station:{label:'Station white',colors:{shell:'#e6e9ec',panel:'#8c97a3',metal:'#3a4048',glow:'#39d4ff',decal:'#f2a31b'}},military:{label:'Military',colors:{shell:'#4f5a45',panel:'#2f3530',metal:'#24282b',glow:'#9dff57',decal:'#d8c25a'}},corsair:{label:'Corsair',colors:{shell:'#2a2d36',panel:'#4a4f5c',metal:'#17191d',glow:'#ff3b6b',decal:'#e9e4d8'}}},
 roughness:{shell:0.45,panel:0.55,metal:0.35,glow:0.3,decal:0.6},metalness:{shell:0.3,metal:0.85,panel:0.4},emissive:{glow:1.4},
 controls,
 presets:[
  {id:'cargo-crate',name:'Cargo crate',description:'Chamfered white station crate with side handles, light strips and a status display.',parameters:{}},
  {id:'equipment-case',name:'Equipment case',description:'Long low military case on feet with four latches.',parameters:{form:'case',size:1.4,chamfer:0.07,lights:1,colorway:'military'}},
  {id:'power-cell',name:'Power cell',description:'Upright glowing energy core inside a caged frame.',parameters:{form:'cell',size:1.2,lights:3,handles:false,colorway:'corsair'}},
 ],
 constraints:['Every face detail is set into or proud of the shell by at least 6 mm (no coplanar faces).'],
 build(p,add){
  const S=Number(p.size),form=String(p.form),c=Number(p.chamfer)*S,n=Number(p.lights);
  if(form==='cell'){
   const r=S*0.2,base=S*0.12,top=S-S*0.1;
   add('base','metal',chamferPrism(S*0.62,base,S*0.62,S*0.04,[0,base/2,0],'z'));
   add('cap','metal',chamferPrism(S*0.56,S*0.1,S*0.56,S*0.035,[0,top+S*0.05,0],'z'),'frame-0');
   add('core','glow',lathe([[r*0.9,base-0.01],[r,base+0.05],[r,top-0.05],[r*0.9,top+0.01]],12),'base');
   for(let i=0;i<n;i++){const y=base+(i+1)*(top-base)/(n+1);add('ring-'+i,'panel',lathe([[r+0.012,y-0.03*S],[r+0.03,y],[r+0.012,y+0.03*S]],12),'core');}
   for(let k=0;k<4;k++){const a=Math.PI/4+k*Math.PI/2,x=Math.cos(a)*S*0.27,z=Math.sin(a)*S*0.27;
    add('frame-'+k,'metal',chamferPrism(S*0.06,S*0.06,top-base+0.02,S*0.012,[x,(top+base)/2,z],'y'),'base');
    add('frame-light-'+k,'glow',box([S*0.02,(top-base)*0.6,S*0.02],[x*1.12,(top+base)/2,z*1.12],0.003),'frame-'+k);}
   add('vent','panel',lathe([[S*0.12,top+S*0.1-0.001],[S*0.1,top+S*0.14]],8),'cap');
   for(let k=0;k<4;k++){const a=k*Math.PI/2;add('decal-'+k,'decal',box([S*0.16,base*0.4,0.012],[0,base*0.5,0],0.002).rotateY(a).translate(Math.sin(a)*(S*0.31+0.004),0,Math.cos(a)*(S*0.31+0.004)),'base');}
   if(p.display)add('screen','glow',box([S*0.18,S*0.07,0.014],[0,top+S*0.05,S*0.28+0.003],0.002),'cap');
   return {top:[0,top+S*0.14,0]};
  }
  const W=form==='case'?S*0.55:S,Hh=form==='case'?S*0.32:S,D=form==='case'?S:S,foot=form==='case'?S*0.06:S*0.05,y0=foot;
  add('shell','shell',chamferPrism(W,Hh,D,c,[0,y0+Hh/2,0]));
  // Feet / skids.
  if(form==='case')for(const sx of [-1,1])for(const sz of [-1,1])add('foot-'+sx+sz,'metal',lathe([[S*0.04,0],[S*0.035,foot+0.01]],8,{center:[sx*W*0.34,sz*D*0.38]}),'shell');
  else for(const sx of [-1,1])add('skid-'+sx,'metal',chamferPrism(W*0.16,foot+0.01,D*0.9,S*0.012,[sx*W*0.3,(foot+0.01)/2,0]),'shell');
  // Inset panels: proud plates on four sides and top, each with light strips.
  const plate=0.008;
  const faces:Array<{name:string;size:[number,number,number];pos:V3;strip:(i:number)=>{size:[number,number,number];pos:V3}}>=[
   {name:'front',size:[W-2*c-0.04,Hh-2*c-0.04,plate*2],pos:[0,y0+Hh/2,D/2],strip:i=>({size:[(W-2*c)*0.6,Hh*0.025,plate*3],pos:[0,y0+Hh*(0.25+0.5*(i+0.5)/n)-Hh*0.12,D/2+plate]})},
   {name:'back',size:[W-2*c-0.04,Hh-2*c-0.04,plate*2],pos:[0,y0+Hh/2,-D/2],strip:i=>({size:[(W-2*c)*0.6,Hh*0.025,plate*3],pos:[0,y0+Hh*(0.25+0.5*(i+0.5)/n)-Hh*0.12,-D/2-plate]})},
   {name:'left',size:[plate*2,Hh-2*c-0.04,D-2*c-0.04],pos:[-W/2,y0+Hh/2,0],strip:i=>({size:[plate*3,Hh*0.025,(D-2*c)*0.6],pos:[-W/2-plate,y0+Hh*(0.25+0.5*(i+0.5)/n)-Hh*0.12,0]})},
   {name:'right',size:[plate*2,Hh-2*c-0.04,D-2*c-0.04],pos:[W/2,y0+Hh/2,0],strip:i=>({size:[plate*3,Hh*0.025,(D-2*c)*0.6],pos:[W/2+plate,y0+Hh*(0.25+0.5*(i+0.5)/n)-Hh*0.12,0]})},
  ];
  for(const f of faces){add('panel-'+f.name,'panel',box(f.size,f.pos,0.004),'shell');if(form==='crate'||f.name==='front'||f.name==='back')for(let i=0;i<n;i++){const s=f.strip(i);add('strip-'+f.name+'-'+i,'glow',box(s.size,s.pos,0.002),'panel-'+f.name);}}
  add('panel-top','panel',box([W-2*c-0.04,plate*2,D-2*c-0.04],[0,y0+Hh,0],0.004),'shell');
  add('lid-seam','metal',box([W-2*c-0.08,plate*3.2,S*0.03],[0,y0+Hh,0],0.002),'panel-top');
  // Hazard stripes on the corners of the top.
  for(const sx of [-1,1])add('hazard-'+sx,'decal',box([S*0.12,plate*3,S*0.04],[sx*(W/2-c-S*0.1),y0+Hh,D/2-c-S*0.06],0.002),'panel-top');
  // Latches.
  const latches=form==='case'?2:1;
  for(const sz of [-1,1])for(let k=0;k<latches;k++){const x=latches===1?0:(k?1:-1)*W*0.22;
   add('latch-'+sz+'-'+k,'metal',box([S*0.09,S*0.06,0.03],[x,y0+Hh-c-S*0.02,sz*(D/2+0.012)],0.004),'panel-'+(sz>0?'front':'back'));}
  if(p.handles)for(const sx of [-1,1]){const x=sx*(W/2+0.008),y=y0+Hh*0.62,l=Math.min(D*0.4,0.36);
   add('handle-'+sx,'metal',rod([x+sx*0.045,y,-l/2],[x+sx*0.045,y,l/2],0.016,8),'handle-mount-'+sx+'-0');
   for(const e of [0,1])add('handle-mount-'+sx+'-'+e,'metal',box([0.07,0.04,0.04],[x+sx*0.025,y,(e?1:-1)*l/2],0.004),'panel-'+(sx>0?'right':'left'));}
  if(p.display){const sw=Math.min(W*0.3,0.3);add('screen-bezel','metal',box([sw+0.03,sw*0.6+0.03,0.018],[W*0.22,y0+Hh*0.72,D/2+0.011],0.004),'panel-front');add('screen','glow',box([sw,sw*0.6,0.02],[W*0.22,y0+Hh*0.72,D/2+0.022],0.002),'screen-bezel');}
  return {top:[0,y0+Hh,0]};
 },
});

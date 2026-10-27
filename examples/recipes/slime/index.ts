import { box, forgeRecipe, lathe, rng } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:0.3,max:1.4,step:0.01,default:0.7,hint:'Ground to tip.',affects:['geometry'],targets:['body','eye','pupil']},
 {key:'width',label:'Width',kind:'range',group:'shape',unit:'ratio',min:0.6,max:1.6,step:0.01,default:0.9,hint:'Body diameter as a multiple of height.',affects:['geometry'],targets:['body']},
 {key:'form',label:'Form',kind:'choice',group:'construction',unit:'none',default:'drop',options:[{value:'drop',label:'Dew drop'},{value:'dome',label:'Dome'},{value:'lumpy',label:'Lumpy'}],hint:'Pointed drop with a curled tip, a wide jelly dome, or a lumpy multi-lobed blob.',affects:['geometry'],targets:['body']},
 {key:'mood',label:'Mood',kind:'choice',group:'construction',unit:'none',default:'happy',options:[{value:'happy',label:'Happy'},{value:'sleepy',label:'Sleepy'},{value:'angry',label:'Angry'}],hint:'Eyes and mouth.',affects:['topology'],targets:['eye','pupil']},
 {key:'eyeSize',label:'Eye size',kind:'range',group:'shape',unit:'ratio',min:0.08,max:0.2,step:0.005,default:0.13,hint:'Eye radius as a fraction of height.',affects:['geometry'],targets:['eye','pupil']},
 {key:'crown',label:'Crown',kind:'toggle',group:'construction',unit:'none',default:false,hint:'A little gold crown on top.',affects:['topology'],targets:['accent']},
 {key:'crust',label:'Rock crust',kind:'toggle',group:'construction',unit:'none',default:false,hint:'Cooled rock plates over a glowing body (magma blob).',affects:['topology'],targets:['accent']},
 {key:'seed',label:'Seed',kind:'integer',group:'construction',unit:'seed',min:1,max:999,step:1,default:3,hint:'Drip and bubble layout.',affects:['geometry'],targets:['shine']},
];
type P=Array<[number,number]>;
const forms:Record<string,P>={
 drop:[[1,0],[1.06,0.035],[1,0.16],[0.9,0.34],[0.7,0.54],[0.44,0.72],[0.2,0.86],[0.06,0.96],[0.015,1]],
 dome:[[1.04,0],[1.1,0.04],[1.04,0.2],[0.92,0.42],[0.72,0.64],[0.46,0.84],[0.2,0.96],[0.02,1]],
 lumpy:[[0.96,0],[1.04,0.05],[1,0.22],[0.94,0.42],[0.78,0.62],[0.54,0.8],[0.26,0.94],[0.03,1]],
};
export const slimeRecipe=forgeRecipe({
 id:'slime',version:'1.0.0',title:'Slime creature',description:'A stylized jelly slime with a glossy puddled body, drips and bubbles, expressive eyes and mouth, and optional crown or magma crust.',category:'Animals',order:476,
 entry:'examples/recipes/slime/index.ts',exportName:'slimeRecipe',
 roles:{body:'Jelly body and drips.',shine:'Bubbles and highlights.',eye:'Eye whites.',pupil:'Pupils, brows and mouth.',accent:'Leaf sprout, crown or rock crust.',glow:'Gems, cheeks and lava cracks.'},
 palettes:{lime:{label:'Lime',colors:{body:'#6fcf4f',shine:'#c9f5a8',eye:'#fbfbf6',pupil:'#1f2a24',accent:'#3d8a3a',glow:'#ff8fa3'}},azure:{label:'Azure',colors:{body:'#3f8ee0',shine:'#bfe0ff',eye:'#fbfbf6',pupil:'#1b2233',accent:'#f0c445',glow:'#e8344f'}},magma:{label:'Magma',colors:{body:'#ff6a1a',shine:'#ffd06a',eye:'#fff3c4',pupil:'#2a1410',accent:'#3a302c',glow:'#ffb020'}}},
 roughness:{body:0.25,shine:0.15,eye:0.3,pupil:0.4,accent:0.45},metalness:{accent:0.35},emissive:{glow:0.9},autoGround:true,
 controls,
 presets:[
  {id:'dew',name:'Dew slime',description:'Green happy dew drop with a curled tip.',parameters:{}},
  {id:'king',name:'King slime',description:'Wide sleepy blue dome wearing a gold crown.',parameters:{height:0.95,width:1.45,form:'dome',mood:'sleepy',eyeSize:0.14,crown:true,colorway:'azure',seed:11}},
  {id:'magma',name:'Magma blob',description:'Lumpy angry lava blob with cooled rock plates.',parameters:{height:0.8,width:1.05,form:'lumpy',mood:'angry',eyeSize:0.11,crust:true,colorway:'magma',seed:29}},
 ],
 constraints:['Eyes and mouth sit on the front (+Z) of the body.'],
 build(p,add){
  const H=Number(p.height),R=H*Number(p.width)/2,form=String(p.form),random=rng(Number(p.seed)),sq=0.92;
  const prof:P=forms[form]!.map(([r,y])=>[r*R,y*H]),radiusAt=(y:number)=>{for(let i=1;i<prof.length;i++)if(prof[i]![1]>=y){const [r0,y0]=prof[i-1]!,[r1,y1]=prof[i]!;return r0+(r1-r0)*(y-y0)/(y1-y0);}return 0;};
  const surface=(a:number,y:number,o=0):[number,number,number]=>{const r=radiusAt(y)+o;return [Math.cos(a)*r,y,Math.sin(a)*r*sq];};
  const tip:[number,number]=form==='drop'?[0.05,-0.08]:[0,0];
  add('body','body',lathe(prof,form==='dome'?20:16,{squash:sq,tilt:tip.map(v=>v*0.15) as [number,number]}));
  const sphere=(name:string,role:string,c:[number,number,number],r:[number,number,number],con?:string,n=10)=>add(name,role,lathe([[0.38,-0.93],[0.8,-0.6],[1,0],[0.8,0.6],[0.38,0.93]],n).scale(...r).translate(...c),con);
  if(form==='drop')add('tip-curl','body',taperedSweep([{center:[tip[0]*0.15*H,H*0.97,tip[1]*0.15*H],radius:R*0.05},{center:[R*0.02,H*1.04,-R*0.06],radius:R*0.035},{center:[R*0.1,H*1.08,-R*0.12],radius:R*0.022},{center:[R*0.17,H*1.06,-R*0.1],radius:R*0.008}],7),'body');
  if(form==='drop'){const base:[number,number,number]=[R*0.1,H*1.06,-R*0.11];
   add('leaf','accent',lathe([[0.004,0],[0.5,0.25],[0.55,0.55],[0.3,0.85],[0.02,1]],6,{squash:0.25}).scale(R*0.22,R*0.5,R*0.22).rotateZ(-0.9).rotateY(0.5).translate(...base),'tip-curl');}
  if(form==='lumpy')for(const [a,s,y] of [[0.4,0.55,0.32],[2.5,0.5,0.28],[4.3,0.45,0.22]] as const){const c=surface(a,Math.max(H*y,H*s*0.7*0.93+0.002),-R*s*0.55);sphere('lobe-'+a,'body',[c[0],c[1],c[2]],[R*s,H*s*0.7,R*s*sq],'body',12);}
  // Face.
  const E=H*Number(p.eyeSize),eyeY=H*(form==='dome'?0.42:0.45),mood=String(p.mood);
  for(const s of [-1,1]){
   const a=Math.PI/2-s*0.38,c=surface(a,eyeY,-E*0.45),out:[number,number,number]=[Math.cos(a),0,Math.sin(a)];
   const ey=mood==='sleepy'?0.45:1;
   sphere('eye-'+s,'eye',c,[E*0.95,E*1.2*ey,E*0.8],'body');
   const pc:[number,number,number]=[c[0]+out[0]*E*0.55,c[1]-E*0.1*ey,c[2]+out[2]*E*0.55];
   sphere('pupil-'+s,'pupil',pc,[E*0.55,E*0.75*ey,E*0.4],'eye-'+s);
   if(mood!=='sleepy')sphere('glint-'+s,'shine',[pc[0]+out[0]*E*0.3+E*0.18,pc[1]+E*0.3,pc[2]+out[2]*E*0.32],[E*0.16,E*0.16,E*0.1],'pupil-'+s,6);
   else add('lid-'+s,'body',lathe([[0.4,-0.92],[0.8,-0.6],[1,0],[0.8,0.6],[0.4,0.92]],10).scale(E*1.02,E*0.5,E*0.85).translate(c[0],c[1]+E*0.42,c[2]),'eye-'+s);
   if(mood==='angry')add('brow-'+s,'pupil',box([E*1.5,E*0.28,E*0.4],[0,0,0],0.01).rotateZ(s*0.42).translate(c[0]-s*E*0.05,c[1]+E*1.25,c[2]+out[2]*E*0.5),'eye-'+s);
   if(mood!=='angry')sphere('cheek-'+s,'glow',surface(Math.PI/2-s*0.62,eyeY-E*1.25,-E*0.12),[E*0.45,E*0.25,E*0.22],'body',8);
  }
  // Mouth: an arc sweep set into the front surface.
  const mouthY=eyeY-E*1.6,curve=mood==='happy'?-1:mood==='angry'?1:-0.4;
  add('mouth','pupil',taperedSweep(Array.from({length:7},(_,i)=>{const t=i/6-0.5,a=Math.PI/2+t*0.55;const c=surface(a,mouthY+curve*E*0.5*(1-4*t*t),-E*0.04);return {center:c,radius:E*(0.08+0.1*(1-4*t*t))};}),6),'body');
  // Drips and bubbles.
  for(let i=0;i<6;i++){const a=random()*Math.PI*2;if(Math.abs(Math.sin(a)-1)<0.25)continue;const y0=H*(0.16+random()*0.18),len=H*(0.08+random()*0.08),r=R*(0.05+random()*0.03);
   const c0=surface(a,y0,-r*0.6),c1=surface(a,Math.max(r,y0-len),-r*0.1);add('drip-'+i,'body',taperedSweep([{center:c0,radius:r*0.6},{center:c1,radius:r},{center:[c1[0]*1.02,Math.max(r*0.6,c1[1]-r*0.6),c1[2]*1.02],radius:r*0.5}],7),'body');}
  for(let i=0;i<5;i++){const a=Math.PI/2+(random()<0.5?-1:1)*(0.9+random()*1.6),y=H*(0.15+random()*0.55),r=R*(0.03+random()*0.04);sphere('bubble-'+i,'shine',surface(a,y,-r*0.3),[r,r,r],'body',6);}
  sphere('highlight','shine',surface(Math.PI/2+0.5,H*0.7,-R*0.03),[R*0.09,H*0.06,R*0.05],'body',8);
  if(p.crown){const top=H*0.96,cr=R*0.34;
   add('crown-band','accent',lathe([[cr,top-0.04*H],[cr*1.08,top+0.08*H]],10),'body');
   for(let k=0;k<5;k++){const a=k*2*Math.PI/5+Math.PI/2;add('crown-point-'+k,'accent',lathe([[cr*0.22,top+0.07*H],[cr*0.04,top+0.22*H]],5,{center:[Math.cos(a)*cr*0.95,Math.sin(a)*cr*0.95]}),'crown-band');
    sphere('crown-gem-'+k,'glow',[Math.cos(a)*cr*1.05,top+0.03*H,Math.sin(a)*cr*1.05],[cr*0.12,cr*0.12,cr*0.08],'crown-band',6);}
  }
  if(p.crust){for(let k=0;k<9;k++){const a=Math.PI/2+0.9+k*(2*Math.PI-1.8)/9+random()*0.2,y=H*(0.5+random()*0.38),c=surface(a,y,-R*0.02),s=R*(0.14+random()*0.08);
    add('crust-'+k,'accent',lathe([[s,-s*0.25],[s*1.05,0],[s*0.7,s*0.3],[s*0.2,s*0.38]],5,{phase:random()*3}).rotateX(-Math.cos(a)*0.6).rotateZ(Math.cos(a)*0.6).translate(...c),'body');}
   for(let k=0;k<5;k++){const a=Math.PI/2+1+k*0.9+random()*0.3,y=H*(0.2+random()*0.3),c=surface(a,y,-R*0.015);add('lava-crack-'+k,'glow',taperedSweep([{center:surface(a-0.12,y+H*0.06,-R*0.02),radius:R*0.012},{center:c,radius:R*0.022},{center:surface(a+0.1,y-H*0.07,-R*0.02),radius:R*0.01}],5),'body');}
  }
  return {top:[0,H,0]};
 },
});

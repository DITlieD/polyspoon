import { box, forgeRecipe, lathe, rod } from '../../../src/engine/forge-kit.ts';
import { apothem, beam, faceFrontPhase, place, prism } from '../../../src/engine/forge-kit-structures.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'type',label:'Shelter type',kind:'choice',group:'construction',unit:'none',default:'yurt',options:[{value:'yurt',label:'Yurt'},{value:'bell',label:'Bell tent'},{value:'ridge',label:'Ridge tent'}],hint:'A felt yurt with lattice wall and crown, a round bell tent on a centre pole, or an A-frame ridge tent.',affects:['topology'],targets:['wall','roof','pole']},
 {key:'radius',label:'Radius',kind:'range',group:'shape',unit:'m',min:1.4,max:3.5,step:0.05,default:2.6,hint:'Floor radius (ridge tents: half the length).',affects:['geometry'],targets:['wall','roof']},
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:1.8,max:4,step:0.05,default:3,hint:'Ground to the peak or crown.',affects:['geometry'],targets:['roof','pole']},
 {key:'wall',label:'Wall height',kind:'range',group:'shape',unit:'m',min:0.4,max:1.8,step:0.05,default:1.5,hint:'Vertical wall below the roof (round types).',affects:['geometry'],targets:['wall']},
 {key:'sides',label:'Sides',kind:'integer',group:'construction',unit:'count',min:8,max:18,step:1,default:14,hint:'Facets around round types.',affects:['topology'],targets:['wall','roof']},
 {key:'guyRopes',label:'Guy ropes',kind:'toggle',group:'construction',unit:'none',default:false,hint:'Ropes out to ground stakes.',affects:['topology'],targets:['rope']},
 {key:'doorOpen',label:'Door open',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Door flaps tied back (tents) or door ajar (yurt).',affects:['topology'],targets:['door']},
];
export const tentRecipe=forgeRecipe({
 id:'tent',version:'1.0.0',title:'Tent and yurt',description:'Camp shelters: a felt yurt with banded walls, roof straps and a crown, a canvas bell tent on a centre pole with guy ropes, or an A-frame ridge tent.',category:'Buildings',order:260,
 entry:'examples/recipes/tent/index.ts',exportName:'tentRecipe',
 roles:{canvas:'Main felt or canvas.',trim:'Bands, straps and door frame.',pole:'Poles, crown and stakes.',dark:'Door opening and interior.',rope:'Ropes and lashings.'},
 palettes:{
  steppe:{label:'Steppe felt',colors:{canvas:'#e9e1cf',trim:'#a33a2b',pole:'#c48a3a',dark:'#2c2420',rope:'#7a5a3a'}},
  canvas:{label:'Camp canvas',colors:{canvas:'#d8cba8',trim:'#8a7a5a',pole:'#6e5135',dark:'#2f2a22',rope:'#bfae8a'}},
  forest:{label:'Forest green',colors:{canvas:'#5e6e45',trim:'#3e4a2e',pole:'#7a5c3c',dark:'#1f241a',rope:'#c2b28c'}},
 },
 roughness:{canvas:1},
 controls,
 presets:[
  {id:'yurt',name:'Yurt',description:'Felt yurt with red bands, roof straps, crown and a painted door.',parameters:{}},
  {id:'bell-tent',name:'Bell tent',description:'Canvas bell tent on a centre pole with guy ropes and an open door flap.',parameters:{type:'bell',radius:2.2,height:3,wall:0.6,sides:12,guyRopes:true,colorway:'canvas'}},
  {id:'ridge-tent',name:'Ridge tent',description:'A-frame ridge tent with tied-back flaps and guy lines.',parameters:{type:'ridge',radius:1.6,height:2,guyRopes:true,colorway:'forest'}},
 ],
 constraints:['Round walls must be at least 0.6 m lower than the peak.'],
 check(p){if(p.type!=='ridge'&&Number(p.wall)>Number(p.height)-0.6+1e-9)throw new Error('Wall too tall for the peak height');},
 build(p,add){
  const type=String(p.type),R=Number(p.radius),H=Number(p.height),wh=Number(p.wall),n=Number(p.sides),ph=faceFrontPhase(n),open=Boolean(p.doorOpen);
  let top=H;
  if(type==='ridge'){
   const L=R*2,hw=Math.min(1.4,H*0.75);
   add('groundsheet','dark',box([hw*2+0.1,0.03,L+0.1],[0,0.015,0],0.005));
   add('canvas','canvas',prism([[-hw,0],[hw,0],[0,H]],L).translate(0,0.02,0),'groundsheet');
   for(const s of [-1,1]){
    add('pole-'+(s>0?'f':'b'),'pole',rod([0,0,s*(L/2+0.04)],[0,H+0.2,s*(L/2+0.04)],0.03,6),'canvas');
    add('door-'+(s>0?'f':'b'),'dark',prism([[-hw*0.62,0.02],[hw*0.62,0.02],[0,H*0.7]],0.02).translate(0,0.02,s*(L/2+0.008)),'canvas');
   }
   add('ridge-pole','pole',rod([0,H+0.05,-L/2-0.1],[0,H+0.05,L/2+0.1],0.03,6),'pole-f');
   if(open)for(const s of [-1,1]){
    // Tied-back flap: a triangle swung outward from the front edge.
    add('flap-'+(s>0?'r':'l'),'canvas',place(prism([[0,0.04],[hw*0.62,0.04],[0,H*0.7]],0.02),[0,s>0?0.02:0.027,L/2+0.02],[0,s>0?-0.9:Math.PI+0.9,0]),'canvas');
   }
   if(p.guyRopes)for(const s of [-1,1]){
    const z=s*(L/2+0.06);add('guy-'+(s>0?'f':'b'),'rope',rod([0,H+0.15,z],[0,0.06,z+s*1.1],0.012,4),'pole');add('stake-'+(s>0?'f':'b'),'pole',box([0.04,0.25,0.04],[0,0.125,z+s*1.12],0.006),'guy');
    for(const side of [-1,1]){const zz=s*L*0.3;add('side-guy-'+s+side,'rope',rod([side*hw*0.5,H*0.5,zz],[side*(hw+0.9),0.06,zz],0.012,4),'canvas');add('side-stake-'+s+side,'pole',box([0.04,0.25,0.04],[side*(hw+0.92),0.125,zz],0.006),'side-guy');}
   }
   top=H+0.2;
  }else if(type==='yurt'){
   const ap=apothem(R,n);
   add('platform','pole',lathe([[R+0.12,0],[R+0.12,0.12]],n,{phase:ph}));
   add('wall','canvas',lathe([[R,0.12],[R,wh]],n,{phase:ph}),'platform');
   for(const [i,y] of [0.35,wh*0.62,wh-0.12].entries())add('band-'+i,'trim',lathe([[R+0.03,Math.max(0.14,y-0.06)],[R+0.03,y+0.06]],n,{phase:ph}),'wall');
   // Rope lashing that cinches the felt between the upper bands.
   const ry=(Math.max(0.14,wh*0.62)+wh-0.12)/2;add('wall-rope','rope',lathe([[R+0.045,ry-0.02],[R+0.045,ry+0.02]],n,{phase:ph}),'wall');
   const crownR=Math.max(0.35,R*0.18),eave=R+0.3;
   add('roof','canvas',lathe([[eave,wh-0.12],[eave,wh],[crownR+0.02,H-0.12]],n,{phase:ph}),'wall');
   add('crown','pole',lathe([[crownR+0.08,H-0.18],[crownR+0.08,H-0.05],[crownR*0.6,H+0.08],[0.08,H+0.18]],n,{phase:ph}),'roof');
   add('flue','dark',lathe([[0.1,H+0.1],[0.1,H+0.55],[0.13,H+0.6]],8),'crown');
   top=H+0.6;
   // Roof straps run along the ridgelines (vertex angles) from crown to eave.
   const k=(H-0.12-wh)/(eave-crownR-0.02),yr=(r:number)=>wh+(eave-r)*k+0.003;for(let i=0;i<n;i+=2){const a=ph+i*2*Math.PI/n,c=Math.cos(a),s=Math.sin(a),l=Math.hypot(k,1);add('strap-'+i,'trim',beam([c*(crownR+0.06),yr(crownR+0.06),s*(crownR+0.06)],[c*(eave-0.02),yr(eave-0.02),s*(eave-0.02)],0.02,0.08,[c*k/l,1/l,s*k/l]),'roof');} // flat straps lie on the roof slope along each ridgeline, bedded 7 mm into the felt with their centre line 3 mm above it (round rods floated 6 cm clear near the crown; half sunk, their ends read as poking out of the roof)
   // Door frame and painted door on the front face.
   add('door-frame','pole',box([1.0,1.45,0.1],[0,0.12+0.72,ap+0.02],0.01),'wall');
   if(open){add('door-dark','dark',box([0.78,1.3,0.05],[0,0.12+0.66,ap+0.055],0.006),'door-frame');add('door-leaf','trim',place(box([0.76,1.28,0.05],[0.38,0,0],0.006),[-0.39,0.12+0.66,ap+0.1],[0,-1.1,0]),'door-frame');}
   else add('door-leaf','trim',box([0.78,1.3,0.05],[0,0.12+0.66,ap+0.075],0.006),'door-frame');
   add('door-lintel','trim',box([1.2,0.14,0.16],[0,1.5,ap+0.04],0.01),'door-frame');
  }else{
   // Bell tent: short wall, conical roof up a centre pole.
   const ap=apothem(R,n);
   add('wall','canvas',lathe([[R,0],[R,wh]],n,{phase:ph}));
   add('roof','canvas',lathe([[R+0.08,wh-0.06],[R+0.08,wh],[0.12,H-0.02]],n,{phase:ph}),'wall');
   add('pole','pole',rod([0,H-0.1,0],[0,H+0.3,0],0.035,6),'roof');
   add('peak-cap','trim',lathe([[0.16,H-0.12],[0.12,H+0.02],[0.04,H+0.08]],n),'roof');
   top=H+0.3;
   // Door: dark opening on the front face rising into the roof, with the flap tied back.
   add('door','dark',box([1,wh-0.03,0.04],[0,(wh-0.03)/2+0.002,ap+0.012],0.004),'wall');
   // Upper door leans back with the roof slope.
   const lean=Math.atan((R+0.08-0.12)/(H-wh)),rap=apothem(R+0.08,n);
   add('door-upper','dark',place(prism([[-0.5,0],[0.5,0],[0,0.95/Math.cos(lean)*0.9]],0.03),[0,wh+0.004,rap+0.006],[-lean,0,0]),'roof');
   if(open)add('door-flap','canvas',place(prism([[0,0],[0.55,0],[0,wh+0.7]],0.03),[0.53,0.002,ap+0.02],[0,-0.6,0]),'wall');
   if(p.guyRopes)for(let i=0;i<n;i+=2){const a=ph+(i+0.5)*2*Math.PI/n,c=Math.cos(a),s=Math.sin(a);    if(Math.abs(a-Math.PI/2)<0.4)continue;
    // The rope runs into the stake's centre (ending at its face, an axis-aligned guy only grazed the stake's edge and hung free).
    add('guy-'+i,'rope',rod([c*(R*0.97),wh+0.02,s*(R*0.97)],[c*(R+1.13),0.06,s*(R+1.13)],0.012,4),'roof');
    add('stake-'+i,'pole',box([0.05,0.24,0.05],[c*(R+1.13),0.12,s*(R+1.13)],0.006),'guy-'+i);}
  }
  return {top:[0,top,0],door:[0,0,R]};
 },
});

import { forgeRecipe, lathe, rng } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'count',label:'Mushrooms',kind:'integer',group:'construction',unit:'count',min:1,max:7,step:1,default:4,hint:'Number of mushrooms on the clump.',affects:['topology'],targets:['stem','cap','spot']},
 {key:'size',label:'Tallest',kind:'range',group:'shape',unit:'m',min:0.08,max:1.2,step:0.01,default:0.3,hint:'Height of the tallest mushroom.',affects:['geometry'],targets:['stem','cap','spot','moss']},
 {key:'capStyle',label:'Cap style',kind:'choice',group:'construction',unit:'none',default:'dome',options:[{value:'dome',label:'Dome'},{value:'flat',label:'Flat'},{value:'cone',label:'Cone'}],hint:'Cap silhouette.',affects:['geometry'],targets:['cap']},
 {key:'spots',label:'Spots',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Raised spots on the cap tops.',affects:['topology'],targets:['spot']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:11,hint:'Repeatable placement, lean and size variation.',affects:['geometry'],targets:['stem','cap','spot']},
];
const caps={dome:[[1,0],[0.97,0.18],[0.85,0.42],[0.6,0.7],[0.3,0.9],[0.06,1]],flat:[[1,0],[1,0.22],[0.8,0.5],[0.4,0.7],[0.06,0.75]],cone:[[1,0],[0.8,0.3],[0.5,0.65],[0.2,0.92],[0.03,1.1]]} as const;
export const mushroomClusterRecipe=forgeRecipe({
 id:'mushroom-cluster',version:'1.0.0',title:'Mushroom cluster',description:'A clump of leaning toadstools on a mossy base, with dome, flat or conical caps.',category:'Nature',order:150,
 entry:'examples/recipes/mushroom-cluster/index.ts',exportName:'mushroomClusterRecipe',
 roles:{cap:'Caps.',stem:'Stems and gills.',spot:'Cap spots.',moss:'Mossy base.'},
 palettes:{toadstool:{label:'Toadstool',colors:{cap:'#c0392b',stem:'#efe6d2',spot:'#f7f3ea',moss:'#4f6b35'}},porcini:{label:'Porcini',colors:{cap:'#7a4e2c',stem:'#e3d3b0',spot:'#9a6b40',moss:'#55703a'}},glow:{label:'Glowcap',colors:{cap:'#3d7fb0',stem:'#d9eef0',spot:'#b8f0ff',moss:'#2f4a3c'}}},
 controls,
 presets:[
  {id:'toadstools',name:'Toadstools',description:'Four spotted red domes.',parameters:{}},
  {id:'porcini',name:'Porcini patch',description:'Flat brown caps, no spots.',parameters:{count:3,capStyle:'flat',spots:false,colorway:'porcini',seed:5}},
  {id:'giant-glowcap',name:'Giant glowcaps',description:'Tall conical fantasy mushrooms.',parameters:{count:5,size:1.1,capStyle:'cone',colorway:'glow',seed:23}},
 ],
 constraints:['Mushrooms are placed on a spiral around the base; each stem starts inside the moss pad.'],
 build(p,add){
  const n=Number(p.count),H=Number(p.size),random=rng(Number(p.seed)),profile=caps[p.capStyle as keyof typeof caps];
  const pad=H*0.25+H*0.18*Math.sqrt(n);
  add('moss','moss',lathe([[pad,0],[pad*0.92,H*0.03],[pad*0.6,H*0.06]],9,{squash:0.85,phase:random()}));
  // Moss top height at a point (the pad is a squashed lathe: flat top to 0.6 pad, sloping to its rim).
  const mossTop=(x:number,z:number)=>{const q=Math.hypot(x,z/0.85)/pad;return q<=0.6?H*0.06:q<=0.92?H*0.06-(q-0.6)/0.32*H*0.03:Math.max(0,H*0.03*(1-q)/0.08);};
  const capAt=(r:number)=>{for(let k=1;k<profile.length;k++){const [r0,y0]=profile[k-1]!,[r1,y1]=profile[k]!;if(r<=r0&&r>=r1)return y0+(y1-y0)*(r0-r)/(r0-r1||1);}return profile[profile.length-1]![1];};
  const placed:Array<{x:number;z:number;r:number;y0:number;y1:number}>=[];
  for(let i=0;i<n;i++){
   const s=i===0?1:0.45+random()*0.5,h=H*s,a=i*2.39996+random()*0.4;let d=i===0?0:pad*0.25+pad*0.5*Math.sqrt(i/n);
   const stemR=h*0.09,stemTop=h*0.68,capH=h*0.36;let capR=h*(p.capStyle==='flat'?0.42:0.36);
   const lean=(dd:number)=>0.18*(dd/pad),centre=(dd:number)=>[Math.cos(a)*dd+Math.cos(a)*lean(dd)*stemTop,Math.sin(a)*dd+Math.sin(a)*lean(dd)*stemTop] as const;
   // Caps must not cut into each other: push this mushroom outward (stem kept on the pad), then shrink its cap to clear by 6 mm.
   const y0c=stemTop-capH*0.12,y1c=stemTop+capH*1.02,clash=(dd:number,rr:number)=>{const [x,z]=centre(dd);return placed.some(o=>y0c<o.y1&&o.y0<y1c&&Math.hypot(x-o.x,z-o.z)<rr+o.r+0.006);};
   for(let k=0;k<40&&i>0&&clash(d,capR)&&d<pad*0.86;k++)d+=pad*0.02;
   if(clash(d,capR)){const [x,z]=centre(d);capR=Math.max(stemR*1.3,Math.min(capR,...placed.filter(o=>y0c<o.y1&&o.y0<y1c).map(o=>Math.hypot(x-o.x,z-o.z)-o.r-0.006)));}
   const cx=Math.cos(a)*d,cz=Math.sin(a)*d,tx=Math.cos(a)*lean(d),tz=Math.sin(a)*lean(d);
   // Stems start inside the moss, below its top, not on the ground plane (their feet showed through the pad underside).
   const sy=Math.max(0.003,mossTop(cx,cz)-Math.max(0.004,stemR*0.6));
   add('stem-'+i,'stem',lathe([[stemR*1.25,sy],[stemR,sy+(stemTop-sy)*0.4],[stemR*0.85,stemTop]],7,{center:[cx,cz],tilt:[tx,tz]}),'moss');
   const ox=cx+tx*stemTop,oz=cz+tz*stemTop;placed.push({x:ox,z:oz,r:capR,y0:y0c,y1:y1c});
   add('gills-'+i,'stem',lathe([[stemR*0.9,stemTop-capH*0.12],[capR*0.92,stemTop+capH*0.02]],12,{center:[ox,oz]}),'stem-'+i);
   add('cap-'+i,'cap',lathe(profile.map(([r,y])=>[Math.max(r*capR,0.002),stemTop+capH*0.02+y*capH] as [number,number]),12,{center:[ox,oz],phase:random()}),'stem-'+i);
   if(p.spots&&p.capStyle!=='flat'){
    for(let k=0;k<3;k++){const sa=random()*Math.PI*2,sr=capR*(0.12+0.18*k)*0.8,rr=capR*0.09;
     // Seat each spot on the cap skin at its own radius (they were placed for the nearest profile ring and some sank 20 mm under it).
     const ys=stemTop+capH*0.02+capAt((sr+rr)/capR)*capH,base=ys-Math.max(0.003,capH*0.03)-k*0.0015,tip=stemTop+capH*0.02+capAt(Math.max(0,sr-rr)/capR)*capH+Math.max(0.004,capH*0.05);
     add('spot-'+i+'-'+k,'spot',lathe([[rr,base],[rr*0.7,tip]],6,{center:[ox+Math.cos(sa)*sr,oz+Math.sin(sa)*sr]}),'cap-'+i);} // bases step 1.5 mm apart so neighbouring spots' bases never share a plane
   }
  }
  return {top:[0,H,0]};
 },
});

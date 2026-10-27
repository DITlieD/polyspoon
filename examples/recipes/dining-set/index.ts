import { box, forgeRecipe, lathe, rod } from '../../../src/engine/forge-kit.ts';
import { place } from '../../../src/engine/forge-props.ts';
import type { BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'shape',label:'Table shape',kind:'choice',group:'construction',unit:'none',default:'rect',options:[{value:'rect',label:'Rectangular, four legs'},{value:'round',label:'Round pedestal'}],hint:'Table top and base type.',affects:['topology'],targets:['wood']},
 {key:'length',label:'Table length',kind:'range',group:'shape',unit:'m',min:0.7,max:2.2,step:0.01,default:1.5,hint:'Long side (diameter for round tables).',affects:['geometry'],targets:['wood']},
 {key:'width',label:'Table width',kind:'range',group:'shape',unit:'m',min:0.6,max:1.1,step:0.01,default:0.85,hint:'Short side (ignored for round tables).',affects:['geometry'],targets:['wood']},
 {key:'chairs',label:'Chairs',kind:'integer',group:'construction',unit:'count',min:0,max:6,step:1,default:4,hint:'Seats around the table.',affects:['topology'],targets:['chair']},
 {key:'chairStyle',label:'Chair style',kind:'choice',group:'construction',unit:'none',default:'ladder',options:[{value:'ladder',label:'Ladder-back'},{value:'spindle',label:'Spindle-back with cushion'},{value:'stool',label:'Three-leg stool'}],hint:'Seat design.',affects:['topology'],targets:['chair','cushion']},
 {key:'pulled',label:'Pulled out',kind:'range',group:'shape',unit:'m',min:0,max:0.25,step:0.01,default:0.08,hint:'How far alternate chairs are pulled back.',affects:['geometry'],targets:['chair']},
 {key:'setting',label:'Table setting',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Plates at each seat and a candle or jug in the middle.',affects:['topology'],targets:['ware','brass']},
];
const H=0.76,TT=0.045;
export const diningSetRecipe=forgeRecipe({
 id:'dining-set',version:'1.0.0',title:'Table and chairs',description:'A dining or tavern table with turned legs or a pedestal, ringed by ladder-back chairs, spindle chairs or stools, with an optional place setting.',category:'Props',order:412,
 entry:'examples/recipes/dining-set/index.ts',exportName:'diningSetRecipe',
 roles:{wood:'Table.',chair:'Chair frames.',cushion:'Seat cushions and rush seats.',ware:'Plates and jug.',brass:'Candlestick.',wax:'Candle.'},
 palettes:{farmhouse:{label:'Farmhouse pine',colors:{wood:'#b98a56',chair:'#9c6f42',cushion:'#8a3d33',ware:'#e8e1d2',brass:'#b8913f',wax:'#f1e6c8'}},tavern:{label:'Dark tavern',colors:{wood:'#5b3b26',chair:'#4a3020',cushion:'#6e5a3a',ware:'#8f8a80',brass:'#9a7a3a',wax:'#e9dcb8'}},bistro:{label:'Bistro',colors:{wood:'#3d3a38',chair:'#2f4d43',cushion:'#c9b27c',ware:'#f4f1ea',brass:'#c8a250',wax:'#f6efe0'}}},
 roughness:{ware:0.35,brass:0.4},metalness:{brass:0.75},
 controls,
 presets:[
  {id:'farmhouse',name:'Farmhouse table',description:'Long table, four ladder-back chairs, plates and a candlestick.',parameters:{}},
  {id:'bistro',name:'Bistro pair',description:'Small round pedestal table with two spindle chairs.',parameters:{shape:'round',length:0.8,chairs:2,chairStyle:'spindle',pulled:0.12,colorway:'bistro'}},
  {id:'tavern',name:'Tavern board',description:'Long heavy board with six stools and pewter plates.',parameters:{length:2.1,width:0.9,chairs:6,chairStyle:'stool',pulled:0.04,colorway:'tavern'}},
 ],
 constraints:['Table top at 76 cm; seats at 45 cm; every chair stands on its own legs at the floor.'],
 build(p,add){
  const L=Number(p.length),round=p.shape==='round',Wd=round?L:Number(p.width),n=Number(p.chairs),style=String(p.chairStyle),pulled=Number(p.pulled);
  const under=H-TT;
  // Table
  if(round){
   const R=L/2;
   add('table-top','wood',lathe([[R-0.012,under],[R,under+0.012],[R,H-0.01],[R-0.012,H]],20));
   add('pedestal','wood',lathe([[0.09,0.04],[0.07,0.12],[0.055,0.25],[0.08,0.38],[0.045,0.52],[0.06,0.64],[0.13,under+0.006]],8,{phase:Math.PI/8}),'table-top');
   add('pedestal-base','wood',lathe([[0.16,0],[0.15,0.03],[0.09,0.06]],8,{phase:Math.PI/8}),'pedestal');
   for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;add('foot-'+i,'wood',place(box([0.22,0.05,0.06],[0.19,0.025,0],0.008),[0,a,0],[0,0,0]),'pedestal-base');}
  }else{
   add('table-top','wood',box([L,TT,Wd],[0,H-TT/2,0],0.01));
   const lx=L/2-0.08,lz=Wd/2-0.08;
   for(const sx of [-1,1])for(const sz of [-1,1])add('leg-'+sx+sz,'wood',lathe([[0.034,0],[0.03,0.07],[0.044,0.11],[0.026,0.19],[0.03,0.42],[0.042,0.56],[0.04,0.6],[0.04,under+0.006]],8,{center:[sx*lx,sz*lz],phase:Math.PI/8}),'table-top');
   for(const sz of [-1,1])add('apron-long-'+sz,'wood',box([2*lx-0.04,0.09,0.024],[0,under-0.045+0.012,sz*(lz+0.004)],0.004),'table-top');
   for(const sx of [-1,1])add('apron-end-'+sx,'wood',box([0.024,0.09,2*lz-0.04],[sx*(lx+0.004),under-0.045+0.012,0],0.004),'table-top');
   add('stretcher','wood',rod([-lx,0.16,0],[lx,0.16,0],0.016,7),'leg-11'); // thinner than the 20 mm end rods it stops in (at 22 mm its ends poked out of them)
   for(const sx of [-1,1])add('stretcher-end-'+sx,'wood',rod([sx*lx,0.16,-lz],[sx*lx,0.16,lz],0.02,7),'leg-'+sx+'1');
  }
  // Seat slots: [x, z, yaw] facing the table centre
  const slots:Array<[number,number,number]>=[];
  if(round){for(let i=0;i<n;i++){const a=Math.PI/2+i*2*Math.PI/Math.max(n,1)+(n===2?Math.PI/2:0);slots.push([Math.cos(a),Math.sin(a),a]);}}
  else{
   const ends=n>=5?Math.min(2,n-4):n===3?1:0,side=n-ends,perSide=[Math.ceil(side/2),Math.floor(side/2)];
   for(const [k,sz] of [[0,1],[1,-1]] as const)for(let i=0;i<perSide[k]!;i++){const x=perSide[k]===1?0:(-1+2*i/(perSide[k]!-1))*Math.max(L*0.25,0.25);slots.push([x,sz,0]);}
   for(let i=0;i<ends;i++)slots.push([i?-1:1,0,1]);
  }
  slots.forEach(([a,b,kind],i)=>{
   const out=0.16+(i%2?pulled:pulled*0.3);let cx:number,cz:number,yaw:number;
   if(round){const r=L/2+out;cx=a*r;cz=b*r;yaw=Math.atan2(-cx,-cz);}
   else if(kind===0){cx=a;cz=b*(Wd/2+out);yaw=b>0?Math.PI:0;}
   else{cx=a*(L/2+out);cz=0;yaw=-a*Math.PI/2;}
   yaw+=(i%3-1)*0.06;
   const part=(name:string,role:string,g:BufferGeometry,to?:string)=>add('chair-'+i+'-'+name,role,place(g,[0,yaw,0],[cx,0,cz]),to?'chair-'+i+'-'+to:undefined);
   // chair local frame: seat centred, front toward +z (the table)
   if(style==='stool'){
    part('seat','chair',lathe([[0.15,0.43],[0.165,0.45],[0.16,0.475],[0.14,0.48]],10));
    for(let k=0;k<3;k++){const a=k*2*Math.PI/3+0.3,top:[number,number,number]=[Math.cos(a)*0.08,0.44,Math.sin(a)*0.08],foot:[number,number,number]=[Math.cos(a)*0.17,0.028,Math.sin(a)*0.17];
     part('leg-'+k,'chair',rod(top,foot,0.019,6,0.016),'seat');part('foot-'+k,'chair',lathe([[0.024,0],[0.02,0.02],[0.017,0.032]],6,{center:[foot[0],foot[2]]}),'leg-'+k);}
    part('ring','chair',lathe([[0.135,0.2],[0.135,0.222]],9).translate(0,0,0),'leg-0');
    return;
   }
   const sw=0.42,sd=0.4,sy=0.45;
   part('seat','chair',box([sw,0.04,sd],[0,sy-0.02,0],0.008));
   for(const sx of [-1,1]){
    part('front-leg-'+sx,'chair',box([0.036,sy-0.035,0.036],[sx*(sw/2-0.03),(sy-0.035)/2,sd/2-0.03],0.004),'seat');
    part('back-leg-'+sx,'chair',box([0.04,sy-0.035,0.04],[sx*(sw/2-0.03),(sy-0.035)/2,-sd/2+0.03],0.004),'seat');
    part('post-'+sx,'chair',rod([sx*(sw/2-0.03),sy-0.03,-sd/2+0.03],[sx*(sw/2-0.035),0.97,-sd/2-0.03],0.02,6,0.018),'seat');
    part('finial-'+sx,'chair',lathe([[0.022,0],[0.028,0.025],[0.008,0.05]],6,{center:[sx*(sw/2-0.035),-sd/2-0.03]}).translate(0,0.955,0),'post-'+sx);
    part('side-rung-'+sx,'chair',rod([sx*(sw/2-0.03),0.14,sd/2-0.03],[sx*(sw/2-0.03),0.14,-sd/2+0.03],0.012,6),'front-leg-'+sx);
   }
   part('front-rung','chair',rod([-(sw/2-0.03),0.22,sd/2-0.03],[sw/2-0.03,0.22,sd/2-0.03],0.012,6),'front-leg-1');
   const zAt=(y:number)=>-sd/2+0.03-0.06*(y-sy)/(0.97-sy);
   if(style==='ladder'){
    for(const [k,y] of [[0,0.6],[1,0.73],[2,0.86]] as const)part('slat-'+k,'chair',place(box([sw-0.07,0.055,0.018],[0,0,0],0.004),[0.12,0,0],[0,y,zAt(y)]),'post-1');
    part('rush-seat','cushion',box([sw-0.06,0.014,sd-0.06],[0,sy+0.005,0.005],0.004),'seat');
   }else{
    // Top rail 22 mm thick, 6 mm inside the post's hexagon flats, ending on the post centre lines (its 30 mm faces sat 2 mm from the
    // flats and its ends 7 mm inside the leaning outer flat: z-fighting).
    part('top-rail','chair',place(box([sw-0.064,0.07,0.022],[0,0,0],0.006),[0.12,0,0],[0,0.92,zAt(0.92)]),'post-1');
    for(let k=0;k<4;k++){const x=-0.12+k*0.08;part('spindle-'+k,'chair',rod([x,sy-0.01,zAt(sy)],[x,0.9,zAt(0.9)],0.01,6),'top-rail');}
    part('cushion','cushion',box([sw-0.05,0.04,sd-0.05],[0,sy+0.017,0.01],0.015),'seat');
   }
  });
  // Setting
  if(p.setting&&n>0){
   const plateAt=(x:number,z:number,i:number)=>add('plate-'+i,'ware',lathe([[0.07,H-0.003],[0.1,H+0.012],[0.11,H+0.016]],12,{center:[x,z]}),'table-top');
   slots.forEach(([a,b,kind],i)=>{
    if(round){const r=L/2-0.15;plateAt(a*r,b*r,i);}
    else if(kind===0)plateAt(a,b*(Wd/2-0.16),i);
    else plateAt(a*(L/2-0.16),0,i);
   });
   if(style==='stool'){
    add('jug','ware',lathe([[0.06,H-0.003],[0.08,H+0.06],[0.07,H+0.15],[0.05,H+0.19],[0.058,H+0.215]],10,{center:[0.12,0]}),'table-top');
    add('jug-handle','ware',rod([0.188,H+0.05,0],[0.205,H+0.17,0],0.012,5),'jug');
   }else{
    add('candlestick','brass',lathe([[0.07,H-0.003],[0.07,H+0.012],[0.02,H+0.03],[0.016,H+0.12],[0.035,H+0.14]],8),'table-top');
    add('candle','wax',lathe([[0.017,H+0.13],[0.016,H+0.27]],8),'candlestick');
   }
  }
  return {top:[0,H,0]};
 },
});

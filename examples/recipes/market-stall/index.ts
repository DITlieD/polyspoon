import { box, forgeRecipe, lathe, rod, rng } from '../../../src/engine/forge-kit.ts';
import { place, prism } from '../../../src/engine/forge-kit-structures.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'type',label:'Stall type',kind:'choice',group:'construction',unit:'none',default:'awning',options:[{value:'awning',label:'Sloped striped awning'},{value:'canopy',label:'Peaked canopy'},{value:'cart',label:'Wheeled cart'}],hint:'A counter stall under a sloping awning, a tent-roofed booth, or a two-wheeled vendor cart.',affects:['topology'],targets:['awning','wheels']},
 {key:'width',label:'Width',kind:'range',group:'shape',unit:'m',min:1.6,max:4,step:0.05,default:2.8,hint:'Counter width.',affects:['geometry'],targets:['counter','awning']},
 {key:'depth',label:'Depth',kind:'range',group:'shape',unit:'m',min:1,max:2.2,step:0.05,default:1.5,hint:'Front to back.',affects:['geometry'],targets:['counter','awning']},
 {key:'height',label:'Front post height',kind:'range',group:'shape',unit:'m',min:1.9,max:2.8,step:0.05,default:2.3,hint:'Ground to awning at the front.',affects:['geometry'],targets:['post','awning']},
 {key:'stripes',label:'Stripes',kind:'integer',group:'construction',unit:'count',min:4,max:14,step:1,default:8,hint:'Alternating fabric stripes across the awning.',affects:['topology'],targets:['awning']},
 {key:'goods',label:'Goods',kind:'choice',group:'construction',unit:'none',default:'produce',options:[{value:'produce',label:'Produce crates'},{value:'pottery',label:'Jars and pots'},{value:'none',label:'Empty'}],hint:'What is laid out on the counter.',affects:['topology'],targets:['goods']},
 {key:'seed',label:'Layout seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:5,hint:'Repeatable goods layout.',affects:['geometry'],targets:['goods']},
];
export const marketStallRecipe=forgeRecipe({
 id:'market-stall',version:'1.0.0',title:'Market stall',description:'A timber market stall with a striped fabric awning and scalloped valance, counter goods, or a wheeled vendor cart.',category:'Structures',order:230,
 entry:'examples/recipes/market-stall/index.ts',exportName:'marketStallRecipe',
 roles:{timber:'Posts, counter and cart frame.',cloth:'Main awning fabric.',stripe:'Alternate stripes and valance.',goods:'Produce or glazed pots.',crate:'Crates, baskets and wheels.'},
 palettes:{
  market:{label:'Red market',colors:{timber:'#7a5638',cloth:'#f1e6cf',stripe:'#b8372f',goods:'#d9822b',crate:'#a7814f'}},
  harbor:{label:'Harbor blue',colors:{timber:'#6b5643',cloth:'#eef0ea',stripe:'#2f5d8a',goods:'#7aa046',crate:'#b48c5a'}},
  spice:{label:'Spice bazaar',colors:{timber:'#5a3b26',cloth:'#e7c46a',stripe:'#7d2f5b',goods:'#b8512f',crate:'#8c6a44'}},
 },
 controls,
 presets:[
  {id:'fruit-stall',name:'Fruit stall',description:'Counter under a sloping red-striped awning with produce crates.',parameters:{}},
  {id:'pottery-booth',name:'Pottery booth',description:'Wide booth under a peaked canopy with jars and pots.',parameters:{type:'canopy',width:3.4,depth:2,height:2.2,stripes:10,goods:'pottery',colorway:'spice'}},
  {id:'vendor-cart',name:'Vendor cart',description:'Narrow two-wheeled cart with handles and a small awning.',parameters:{type:'cart',width:1.8,depth:1.1,height:2.1,stripes:6,colorway:'harbor'}},
 ],
 constraints:['Awning overhangs the counter front by 0.45 m.'],
 build(p,add){
  const type=String(p.type),W=Number(p.width),D=Number(p.depth),H=Number(p.height),n=Number(p.stripes),random=rng(Number(p.seed));
  const cart=type==='cart',base=cart?0.5:0,counterY=base+0.9,front=D/2,back=-D/2,post=0.09;
  // Counter: slab top, front skirt panel with batten trim, legs or cart bed.
  add('counter-top','timber',box([W-0.01,0.06,D*0.6-0.01],[0,counterY+0.03,front-D*0.3],0.008),'post');
  add('counter-skirt','crate',box([W-0.12,cart?0.42:0.82,0.04],[0,counterY-(cart?0.21:0.41)-0.005,front-0.04],0.006),'counter-top');
  for(const x of [-W/2+0.25,0,W/2-0.25])add('skirt-batten-'+x.toFixed(2),'timber',box([0.06,cart?0.4:0.78,0.03],[x,counterY-(cart?0.21:0.41),front-0.005],0.004),'counter-skirt');
  add('shelf','timber',box([W-0.1,0.04,D-0.17],[0,base+0.25,(back+0.1+front-0.07)/2],0.006),'post');
  const backH=type==='canopy'?H:H+0.45;
  for(const [i,[x,z,h]] of ([[-1,front,H],[1,front,H],[-1,back,backH],[1,back,backH]] as [number,number,number][]).entries())add('post-'+i,'timber',box([post,h-base,post],[x!*(W/2-post/2),base+(h-base)/2,z!-Math.sign(z!)*post/2],0.008));
  if(cart){
   add('cart-bed','timber',box([W+0.06,0.1,D-0.01],[0,base+0.025,0],0.01),'post');
   for(const s of [-1,1]){
    const wx=s*(W/2+0.12),r=0.5;
    add('wheel-'+(s>0?'r':'l'),'crate',place(lathe([[r,-0.035],[r,0.035]],14),[wx,r,0],[0,0,Math.PI/2]),'axle');
    add('hub-'+(s>0?'r':'l'),'timber',place(lathe([[0.09,-0.07],[0.09,0.07]],8),[wx,r,0],[0,0,Math.PI/2]),'wheel');
    for(let k=0;k<6;k++)add('spoke-'+(s>0?'r':'l')+k,'timber',place(box([0.04,r*0.85,0.04],[0,r*0.45,0],0.005),[wx+s*(0.036+(k%3)*0.005),r,0],[k*Math.PI/3,0,0]),'hub');
    add('handle-'+(s>0?'r':'l'),'timber',rod([s*(W/2-0.05),base+0.03,back+0.06],[s*(W/2-0.05),0.85,back-1.1],0.03,6),'cart-bed');
   }
   add('axle','timber',rod([-W/2-0.1,0.5,0],[W/2+0.1,0.5,0],0.035,6),'cart-bed');
   // The prop leg's foot is lowered until its lowest vertex is on the ground (it stopped 26 mm above it).
   let footY=0.035,leg=beam2([0,base-0.01,back+0.15],[0,footY,back+0.3]);
   for(let it=0;it<4;it++){leg.computeBoundingBox();const low=leg.boundingBox!.min.y;if(Math.abs(low)<1e-6)break;footY-=low;leg.dispose();leg=beam2([0,base-0.01,back+0.15],[0,footY,back+0.3]);}
   add('prop-leg','timber',leg,'cart-bed');
  }else{
   for(const s of [-1,1])add('side-rail-'+(s>0?'r':'l'),'timber',box([0.05,0.06,D-0.18],[s*(W/2-post/2),base+0.7,0],0.005),'post');
  }
  // Awning fabric.
  const over=0.45,fy=H+0.02;
  if(type==='canopy'){
   const ridge=0.75,half=D/2+over,sw=(W+0.3)/n,fy=H-0.01;
   for(let k=0;k<n;k++)add('canopy-stripe-'+k,k%2?'stripe':'cloth',place(prism([[-half,0],[half,0],[0,ridge]],sw-0.004),[-W/2-0.15+(k+0.5)*sw,fy,0],[0,Math.PI/2,0]),'post');
   add('ridge-pole','timber',rod([-W/2-0.25,fy+ridge+0.01,0],[W/2+0.25,fy+ridge+0.01,0],0.035,6),'canopy-stripe-0');
   for(const s of [-1,1])for(let k=0;k<n;k++){const x=-W/2-0.15+(k+0.5)*sw;add('valance-'+(s>0?'f':'b')+k,k%2?'cloth':'stripe',place(prism([[-sw/2+0.002,0],[sw/2-0.002,0],[0,-0.2]],0.02),[x,fy+0.002,s*(half-0.012)]),'canopy-stripe-'+k);}
  }else{
   const z0=back-0.05,z1=front+over,y0=backH+0.02,y1=fy-0.08,len=Math.hypot(z1-z0,y0-y1),ang=Math.atan2(y0-y1,z1-z0),sw=(W+0.2)/n;
   for(let k=0;k<n;k++)add('awning-stripe-'+k,k%2?'stripe':'cloth',place(box([sw-0.004,0.03,len],[0,0,0],0.004),[-W/2-0.1+(k+0.5)*sw,(y0+y1)/2,(z0+z1)/2],[ang,0,0]),'post');
   add('awning-bar','timber',rod([-W/2-0.15,y1-0.03,z1-0.03],[W/2+0.15,y1-0.03,z1-0.03],0.03,6),'awning-stripe-0');
   for(let k=0;k<n;k++){const x=-W/2-0.1+(k+0.5)*sw;add('valance-'+k,k%2?'cloth':'stripe',place(prism([[-sw/2+0.002,0],[sw/2-0.002,0],[0,-0.24]],0.02),[x,y1-0.02,z1-0.02]),'awning-bar');}
   for(const s of [-1,1])add('awning-strut-'+(s>0?'r':'l'),'timber',rod([s*(W/2-post/2),H-0.25,front-post/2],[s*(W/2-post/2),y1-0.04,z1-0.06],0.025,6),'post');
  }
  // Goods on the counter.
  const goods=String(p.goods),gz=front-D*0.3,top=counterY+0.06;
  if(goods==='produce'){
   const crates=Math.max(2,Math.floor((W-0.2)/0.55));
   for(let c=0;c<crates;c++){
    const x=-W/2+0.1+(c+0.5)*(W-0.2)/crates,cw=Math.min(0.48,(W-0.2)/crates-0.06),tilt=c%2?0:0.0;
    add('crate-'+c,'crate',box([cw,0.16,0.36],[x,top+0.08-0.004,gz+tilt],0.01),'counter-top');
    for(let f=0;f<6;f++){const fx=x+(f%3-1)*cw*0.3+(random()-0.5)*0.03,fz=gz+(f<3?-0.08:0.08)+(random()-0.5)*0.03,r=0.055+random()*0.015;
     add('fruit-'+c+'-'+f,'goods',lathe([[r*0.5,0],[r,r*0.7],[r*0.95,r*1.3],[r*0.35,r*1.75]],7,{center:[fx,fz],phase:random()}).translate(0,top+0.16-0.01,0),'crate-'+c);}
   }
   add('basket','crate',lathe([[0.16,0],[0.22,0.18],[0.23,0.2]],10,{center:[W/2-0.35,back+0.4]}),'shelf');
  }else if(goods==='pottery'){
   const pots=Math.max(3,Math.floor((W-0.2)/0.3));
   for(let c=0;c<pots;c++){const x=-W/2+0.1+(c+0.5)*(W-0.2)/pots,s=0.8+random()*0.5,k=c%3;
    const prof:Array<[number,number]>=k===0?[[0.07,0],[0.12,0.1],[0.1,0.22],[0.05,0.27],[0.06,0.3]]:k===1?[[0.08,0],[0.1,0.06],[0.1,0.12],[0.07,0.14]]:[[0.05,0],[0.11,0.12],[0.06,0.3],[0.035,0.38],[0.05,0.4]];
    add('pot-'+c,'goods',lathe(prof.map(([r,y])=>[r*s,top+y*s] as [number,number]),9,{center:[x,gz+(random()-0.5)*0.15]}),'counter-top');}
   // Large jars stand on the lower shelf (base 3 mm into its top, 0.25 m in from its back edge, inside the rear posts and clear of the
   // counter). Behind the stall they read as cut by the shelf and rail and stood half outside the rear posts.
   const shelfTop=base+0.27;
   for(let c=0;c<3;c++)add('floor-jar-'+c,'goods',lathe(([[0.12,0],[0.2,0.25],[0.12,0.5],[0.1,0.56]] as Array<[number,number]>).map(([r,y])=>[r,shelfTop-0.003+y] as [number,number]),10,{center:[-W/2+0.4+c*0.45,back+0.35]}),'shelf');
  }
  return {counter:[0,top,gz],top:[0,type==='canopy'?fy+0.75:Math.max(backH,H),0]};
 },
});
function beam2(a:[number,number,number],b:[number,number,number]){return rod(a,b,0.03,6);}

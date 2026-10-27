import { blob, box, facetPad, forgeRecipe, lathe, merge, place, rest, rng } from '../../../src/engine/forge-kit.ts';
import { taperedSweep, facetedLoft } from '../../../src/engine/geometry.ts';
import type { BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';
type V=[number,number,number];
const controls:Control[]=[
 {key:'layout',label:'Layout',kind:'choice',group:'construction',unit:'none',default:'stack',options:[{value:'stack',label:'Stacked firewood'},{value:'stump',label:'Rooted stump'},{value:'chopping',label:'Chopping block'}],hint:'A pyramid of logs, an old rooted stump, or a chopping block with an axe and split wood.',affects:['topology'],targets:['bark','wood']},
 {key:'radius',label:'Log radius',kind:'range',group:'shape',unit:'m',min:0.06,max:0.6,step:0.01,default:0.13,hint:'Radius of the logs (stack) or of the stump.',affects:['geometry'],targets:['bark','wood']},
 {key:'length',label:'Log length',kind:'range',group:'shape',unit:'m',min:0.3,max:3,step:0.05,default:1.4,hint:'Stacked log length, or stump height.',affects:['geometry'],targets:['bark']},
 {key:'rows',label:'Rows',kind:'integer',group:'construction',unit:'count',min:1,max:5,step:1,default:3,hint:'Rows in the stack; roots on a stump; split pieces by the block.',affects:['topology'],targets:['bark']},
 {key:'extras',label:'Moss and fungus',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Moss patches and shelf fungus on old wood.',affects:['topology'],targets:['moss']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:2,hint:'Repeatable log sizes, offsets and roots.',affects:['geometry'],targets:['bark']},
];
export const logPileRecipe=forgeRecipe({
 id:'log-pile',version:'1.0.0',title:'Log pile and stump',description:'Woodland timber: a staked pyramid of firewood showing growth rings, an old stump with flaring roots and shelf fungus, or a chopping block with an embedded axe and split logs.',category:'Nature',order:360,
 entry:'examples/recipes/log-pile/index.ts',exportName:'logPileRecipe',
 roles:{bark:'Bark.',wood:'Cut end grain.',ring:'Heartwood and growth rings.',moss:'Moss and shelf fungus.',iron:'Axe head.',handle:'Axe handle and stakes.'},
 palettes:{oak:{label:'Oak',colors:{bark:'#5b4331',wood:'#d9b483',ring:'#a87a4a',moss:'#5e7d36',iron:'#6b6f74',handle:'#a07850'}},birch:{label:'Birch',colors:{bark:'#e8e2d4',wood:'#ead2a6',ring:'#4a3f35',moss:'#6f8a3e',iron:'#5d6166',handle:'#8f6a45'}},pine:{label:'Pine',colors:{bark:'#6a4a36',wood:'#e7c48d',ring:'#b9824a',moss:'#4d6e33',iron:'#55595e',handle:'#b48a5a'}}},
 metalness:{iron:0.6},roughness:{iron:0.45},
 controls,groundSnap:0.03,
 presets:[
  {id:'firewood-stack',name:'Firewood stack',description:'Three staked rows of round logs with ringed ends.',parameters:{}},
  {id:'old-stump',name:'Old stump',description:'Wide mossy stump with five flaring roots and shelf fungus.',parameters:{layout:'stump',radius:0.42,length:0.55,rows:5,colorway:'pine',seed:13}},
  {id:'chopping-block',name:'Chopping block',description:'Birch block with an axe bitten in and split pieces around it.',parameters:{layout:'chopping',radius:0.3,length:0.5,rows:4,extras:false,colorway:'birch',seed:7}},
 ],
 constraints:['Logs rest on the logs below or the ground; end-grain discs sit 4+ mm proud of the bark to avoid z-fighting.'],
 build(p,add){
  const R=Number(p.radius),L=Number(p.length),N=Number(p.rows),random=rng(Number(p.seed)),layout=String(p.layout);
  const bark:BufferGeometry[]=[],wood:BufferGeometry[]=[],ring:BufferGeometry[]=[],moss:BufferGeometry[]=[],iron:BufferGeometry[]=[],handle:BufferGeometry[]=[];
  // End grain along an axis: pale disc + heart disc, each stepping out of the end face.
  const endGrain=(c:V,dir:V,r:number)=>{const o=(k:number):V=>[c[0]+dir[0]*k,c[1]+dir[1]*k,c[2]+dir[2]*k];wood.push(taperedSweep([{center:o(-0.01),radius:r*0.86},{center:o(0.006),radius:r*0.86}],10));ring.push(taperedSweep([{center:o(-0.005),radius:r*0.55},{center:o(0.011),radius:r*0.5}],8));wood.push(taperedSweep([{center:o(0),radius:r*0.32},{center:o(0.016),radius:r*0.3}],7));ring.push(taperedSweep([{center:o(0.01),radius:r*0.1},{center:o(0.021),radius:r*0.08}],5));};
  const log=(x0:number,x1:number,y:number,z:number,r:number)=>{const wob=(random()-.5)*r*0.12;bark.push(taperedSweep([{center:[x0,y,z],radius:r},{center:[(x0+x1)/2,y+wob,z],radius:r*1.03},{center:[x1,y,z],radius:r*0.97}],11));endGrain([x1,y,z],[1,0,0],r*0.97);endGrain([x0,y,z],[-1,0,0],r);};
  // Vertical trunk with a ringed top.
  const stump=(r:number,h:number,cx:number,cz:number,flare:number)=>{
   bark.push(lathe([[r*(1+flare),0],[r*(1+flare*0.4),h*0.18],[r*1.02,h*0.5],[r,h]],13,{center:[cx,cz],phase:random()}));
   for(const [k,dy,rr] of [[0.88,0.006,1],[0.62,0.012,0.6],[0.36,0.018,0.4],[0.12,0.024,0.15]] as Array<[number,number,number]>){(k===0.88||k===0.36?wood:ring).push(lathe([[r*k,h-0.012-dy],[r*k*0.98,h+dy]],k>0.5?13:9,{center:[cx,cz]}));void rr;}
  };
  let top:V=[0,0,0];
  if(layout==='stack'){
   for(let row=0;row<N;row++){const n=N-row+1,y=R+row*R*1.66;for(let i=0;i<n;i++){const z=(i-(n-1)/2)*R*2.02,r=R*(1+random()*0.1),dx=(random()-.5)*L*0.06;log(-L/2+dx,L/2+dx,row?y:r,z,r);}top=[0,y+R,0];} // logs >= R thick on a 1.66 R row pitch bed ~7% of R into the pair below (a 1.72 R pitch with thinner logs left them hovering); bottom logs sit on the ground
   const sw=(N+1)*R*1.05+R*0.6;for(const sx of [-1,1])for(const sz of [-1,1])handle.push(box([0.06,R*1.72*N+0.1,0.06],[sx*(L/2-Math.min(0.12,L*0.2)),(R*1.72*N+0.1)/2,sz*sw],0.01));
   // iron caps on the stake tops
   for(const sx of [-1,1])for(const sz of [-1,1])iron.push(box([0.075,0.025,0.075],[sx*(L/2-Math.min(0.12,L*0.2)),R*1.72*N+0.1+0.008,sz*sw],0.004));
   for(const sx of [-1,1])bark.push(box([0.1,0.06,sw*2+0.12],[sx*(L/2-Math.min(0.12,L*0.2)),0.03,0],0.01));
   if(p.extras)for(let i=0;i<4;i++){
    // Moss sits on one of the two top-row logs, centred on the bark top so it straddles the surface (it used to sit 50 mm off the stack)
    const z=(i%2?1:-1)*R*1.01+(random()-.5)*R*0.2,y=R+(N-1)*R*1.66+R*0.98;moss.push(blob([(random()-.5)*L*0.6,y,z],[R*0.6,R*0.18,R*0.4],6,3,random,0.3));}
  }else if(layout==='stump'){
   stump(R,L,0,0,0.35);top=[0,L,0];
   for(let i=0;i<N;i++){const a=i*2*Math.PI/N+random()*0.5,dx=Math.cos(a),dz=Math.sin(a),len=R*(0.75+random()*0.45),rr=R*0.34;
    bark.push(taperedSweep([{center:[dx*R*0.55,L*0.3,dz*R*0.55],radius:rr},{center:[dx*(R*0.95+len*0.2),rr*1.05,dz*(R*0.95+len*0.2)],radius:rr*0.85},{center:[dx*(R+len*0.6),rr*0.55,dz*(R+len*0.6)],radius:rr*0.5},{center:[dx*(R+len),rr*0.32,dz*(R+len)],radius:rr*0.3}],8));}
   bark.push(taperedSweep([{center:[R*0.6,L*0.72,0],radius:R*0.16},{center:[R*1.25,L*0.95,R*0.2],radius:R*0.1}],7));
   ring.push(taperedSweep([{center:[R*1.22,L*0.94,R*0.19],radius:R*0.085},{center:[R*1.29,L*0.965,R*0.21],radius:R*0.06}],6));
   if(p.extras){for(let i=0;i<3;i++){const a=1.8+i*0.5,y=L*(0.35+i*0.15),fr=R*(0.38-i*0.07);moss.push(place(facetPad(fr,fr*0.9,fr*0.16,9,4),[Math.cos(a)*R*0.92,y-fr*0.05,Math.sin(a)*R*1.0],-a+Math.PI/2,Math.PI/2));}
    for(let i=0;i<3;i++){const a=4+i*0.7;moss.push(blob([Math.cos(a)*R*1.0,L*0.12,Math.sin(a)*R*1.0],[R*0.35,R*0.14,R*0.3],6,3,random,0.3));}}
  }else{
   stump(R,L,0,0,0.05);top=[0,L,0];
   if(p.colorway==='birch')for(let b=0;b<5;b++){const y=L*(0.12+b*0.17)+(random()-.5)*0.03;ring.push(lathe([[R*1.04,y],[R*1.04,y+0.012+random()*0.01]],13,{phase:random()}));}
   // axe: blade bitten into the top, handle leaning out
   const hx=R*0.15,hy=L+0.075;
   iron.push(facetedLoft([{center:[hx,L-0.043,0],outline:[[-0.08,-0.003],[0.08,-0.003],[0.08,0.003],[-0.08,0.003]]},{center:[hx,L+0.06,0],outline:[[-0.06,-0.014],[0.05,-0.014],[0.05,0.014],[-0.06,0.014]]},{center:[hx,L+0.1,0],outline:[[-0.035,-0.022],[0.035,-0.022],[0.035,0.022],[-0.035,0.022]]}]));
   // The handle runs through the eye (the head's top section, about 80 mm long and 40 mm deep at L+0.09) along its axis: 15 mm radius,
   // 5 mm inside the eye's sides, its end flush with the eye face. It used to rise out through the top at a 28 mm radius, wider than the
   // head was deep, so it stuck out of the side faces.
   handle.push(taperedSweep([{center:[hx+0.0385,L+0.09,0],radius:0.015},{center:[hx-0.045,L+0.09,0],radius:0.015},{center:[hx-0.3,L+0.15,0],radius:0.02},{center:[hx-0.6,L+0.24,0],radius:0.026}],8));
   
   for(let i=0;i<N;i++){const a=i*2*Math.PI/N+random()*0.6,d=R*1.45+random()*R*0.25,len=L*(0.55+random()*0.2),rr=R*0.3;
    const g=facetedLoft([{center:[0,0,0],outline:[[-rr,-rr*0.45],[rr,-rr*0.45],[rr*0.55,rr*0.5],[0,rr*0.75],[-rr*0.55,rr*0.5]]},{center:[0,len,0],outline:[[-rr,-rr*0.45],[rr,-rr*0.45],[rr*0.55,rr*0.5],[0,rr*0.75],[-rr*0.55,rr*0.5]]}]);
    (i%2?wood:bark).push(rest(place(g,[Math.cos(a)*d,0,Math.sin(a)*d],-a+Math.PI/2,-0.12)));}
   wood.push(rest(blob([R*1.3,0,-R*1.1],[0.05,0.012,0.03],6,2)),rest(blob([-R*1.25,0,R*0.85],[0.04,0.012,0.03],6,2)));
  }
  add('bark','bark',merge(bark));add('end-grain','wood',merge(wood),'bark');add('rings','ring',merge(ring),'bark');
  if(moss.length)add('moss','moss',merge(moss),'bark');if(iron.length)add('axe-head','iron',merge(iron),'bark');if(handle.length)add('handles','handle',merge(handle),'bark');
  return {top};
 },
});

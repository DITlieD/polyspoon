import { box, forgeRecipe, lathe, loopLoft, rod } from '../../../src/engine/forge-kit.ts';
import type { V3 } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'envelopeHeight',label:'Envelope height',kind:'range',group:'shape',unit:'m',min:5,max:13,step:0.1,default:9,hint:'Crown to skirt.',affects:['geometry'],targets:['panelA','panelB']},
 {key:'girth',label:'Girth',kind:'range',group:'shape',unit:'ratio',min:0.5,max:0.9,step:0.01,default:0.72,hint:'Widest diameter as a fraction of envelope height.',affects:['geometry'],targets:['panelA','panelB']},
 {key:'shape',label:'Envelope shape',kind:'choice',group:'construction',unit:'none',default:'teardrop',options:[{value:'teardrop',label:'Teardrop'},{value:'sphere',label:'Round'},{value:'pear',label:'Tall pear'}],hint:'Classic teardrop, a round gas-style sphere, or a tall pear with a long skirt.',affects:['geometry'],targets:['panelA','panelB']},
 {key:'gores',label:'Gores',kind:'integer',group:'construction',unit:'count',min:8,max:20,step:2,default:12,hint:'Vertical panels, alternating colors.',affects:['topology'],targets:['panelA','panelB']},
 {key:'basketSize',label:'Basket size',kind:'range',group:'shape',unit:'m',min:0.9,max:1.8,step:0.05,default:1.3,hint:'Basket width.',affects:['geometry'],targets:['basket']},
 {key:'sandbags',label:'Sandbags',kind:'integer',group:'construction',unit:'count',min:0,max:8,step:1,default:4,hint:'Ballast bags hung on the basket rim.',affects:['topology'],targets:['canvas']},
];
type Profile=Array<[number,number]>;
function envelopeProfile(shape:string,H:number,R:number,y0:number):Profile{
 const t=shape==='sphere'?[[0.2,0],[0.45,0.06],[0.8,0.2],[0.98,0.4],[1,0.55],[0.93,0.72],[0.74,0.86],[0.42,0.96],[0.001,1]]:shape==='pear'?[[0.14,0],[0.18,0.12],[0.34,0.3],[0.66,0.48],[0.93,0.64],[1,0.77],[0.98,0.88],[0.86,0.96],[0.001,1]]:[[0.16,0],[0.3,0.1],[0.55,0.26],[0.82,0.44],[0.98,0.6],[1,0.7],[0.9,0.84],[0.6,0.95],[0.001,1]];
 return t.map(([r,y])=>[r!*R,y0+y!*H]);
}
/** One gore: the slice of the envelope shell between angles a0 and a1, closed by side walls (shell thickness th). */
function gore(profile:Profile,a0:number,a1:number,th:number,steps=3){
 const loops=profile.map(([r,y],i)=>{const rr=Math.max(r,0.002),ri=Math.max(rr-th,0.001),top=i===profile.length-1;
  const arc=(rad:number,yy:number)=>Array.from({length:steps+1},(_,k)=>{const a=a0+(a1-a0)*k/steps;return [Math.cos(a)*rad,yy,Math.sin(a)*rad] as V3;});
  const outer=arc(rr,y),inner=arc(top?rr*0.5:ri,top?y-th:y).reverse();return [...outer,...inner];});
 return loopLoft(loops,'strip');
}
export const hotAirBalloonRecipe=forgeRecipe({
 id:'hot-air-balloon',version:'1.0.0',title:'Hot-air balloon',description:'A tethered hot-air balloon: striped gored envelope with crown and skirt, load cables, burner frame and a wicker basket with sandbags.',category:'Vehicles',order:474,
 entry:'examples/recipes/hot-air-balloon/index.ts',exportName:'hotAirBalloonRecipe',
 roles:{panelA:'Gore panels, first color.',panelB:'Gore panels, second color.',band:'Crown ring and skirt band.',basket:'Wicker basket.',frame:'Burner frame, cables and burner.',canvas:'Sandbags and basket padding.'},
 palettes:{carnival:{label:'Carnival',colors:{panelA:'#d8412f',panelB:'#f3c63f',band:'#2d4f8e',basket:'#a87a46',frame:'#3b3936',canvas:'#c9b58f'}},sky:{label:'Sky',colors:{panelA:'#2f6db5',panelB:'#f2f0e8',band:'#d24a3a',basket:'#9c7040',frame:'#3b3936',canvas:'#bfa984'}},sunset:{label:'Sunset',colors:{panelA:'#6b2f86',panelB:'#f08a3c',band:'#f4d35e',basket:'#8d6a3c',frame:'#2f2d2b',canvas:'#b89f78'}}},
 roughness:{frame:0.45,panelA:0.7,panelB:0.7},metalness:{frame:0.7},
 controls,
 presets:[
  {id:'teardrop',name:'Classic balloon',description:'Teardrop envelope in red and yellow stripes.',parameters:{}},
  {id:'round',name:'Round festival balloon',description:'Fat round envelope with many blue and white gores.',parameters:{shape:'sphere',girth:0.88,envelopeHeight:8,gores:18,sandbags:6,colorway:'sky'}},
  {id:'pear',name:'Tall pear balloon',description:'Tall narrow pear with a long skirt, sunset colors and a small basket.',parameters:{shape:'pear',girth:0.58,envelopeHeight:11.5,gores:8,basketSize:1,sandbags:2,colorway:'sunset'}},
 ],
 constraints:['The skirt opening is wider than the burner frame.'],
 build(p,add){
  const H=Number(p.envelopeHeight),R=H*Number(p.girth)/2,G=Number(p.gores),S=Number(p.basketSize),bh=1.05;
  // Basket: walls, floor, padded rim and corner posts.
  const w=S/2,wall=0.06;
  add('basket-floor','basket',box([S-0.01,0.08,S-0.01],[0,0.04,0],0.01));
  for(const [sx,sz,lx,lz] of [[0,1,S,wall],[0,-1,S,wall],[1,0,wall,S-2*wall],[-1,0,wall,S-2*wall]] as const)add('basket-wall-'+sx+sz,'basket',box([lx,bh-0.08,lz],[sx*(w-wall/2),0.08+(bh-0.08)/2-0.001,sz*(w-wall/2)],0.01),'basket-floor');
  for(const y of [0.3,0.62])for(const [sx,sz] of [[0,1],[0,-1],[1,0],[-1,0]] as const)add('weave-'+y+'-'+sx+sz,'canvas',box(sx?[0.02,0.05,S-0.02]:[S-0.02,0.05,0.02],[sx*(w+0.006),y,sz*(w+0.006)],0.004),'basket-floor');
  for(const [sx,sz] of [[0,1],[0,-1],[1,0],[-1,0]] as const)add('rim-'+sx+sz,'canvas',rod(sx?[sx*(w-0.017),bh+0.017,-w-0.015]:[-(w-0.017),bh+0.017,sz*(w-0.017)],sx?[sx*(w-0.017),bh+0.017,w+0.015]:[w-0.017,bh+0.017,sz*(w-0.017)],0.055,7),'basket-floor');
  // Burner frame: four uprights to a square frame, burner coils.
  const fy=bh+1.9,fw=w*0.75;
  for(const sx of [-1,1])for(const sz of [-1,1])add('upright-'+sx+sz,'frame',rod([sx*(w-0.04),bh-0.1,sz*(w-0.04)],[sx*fw,fy,sz*fw],0.025,6),'basket-floor');
  for(const [sx,sz] of [[0,1],[0,-1],[1,0],[-1,0]] as const)add('frame-'+sx+sz,'frame',rod(sx?[sx*fw,fy+0.007,-fw-0.02]:[-fw,fy,sz*fw],sx?[sx*fw,fy+0.007,fw+0.02]:[fw,fy,sz*fw],0.03,6),'upright-11');
  add('burner','frame',lathe([[0.12,fy-0.3],[0.18,fy-0.18],[0.16,fy+0.05],[0.1,fy+0.12]],10),'frame-01');
  for(const sx of [-1,1])add('burner-arm-'+sx,'frame',rod([sx*fw,fy,0],[sx*0.15,fy-0.08,0],0.02,6),'burner');
  add('gas-tank','frame',lathe([[0.1,0.08],[0.16,0.14],[0.16,0.62],[0.1,0.7],[0.05,0.74]],10,{center:[w*0.5,-w*0.5]}),'basket-floor');
  // Envelope.
  const skirtY=fy+0.9,prof=envelopeProfile(String(p.shape),H,R,skirtY),th=0.05;
  for(let g=0;g<G;g++)add('gore-'+g,g%2?'panelB':'panelA',gore(prof,g*2*Math.PI/G,(g+1)*2*Math.PI/G,th),g?'gore-'+(g-1):undefined);
  const [r0,y0]=prof[0]!,crownY=prof.at(-1)![1];
  add('skirt-band','band',lathe([[r0+0.05,y0-0.02],[r0+0.06,y0+0.35]],G*2),'gore-0');
  const eq=prof.reduce((a,b)=>b[0]>a[0]?b:a);
  add('equator-band','band',lathe([[eq[0]+0.04,eq[1]-0.25],[eq[0]+0.04,eq[1]+0.25]],G*2),'gore-0');
  add('crown-ring','band',lathe([[R*0.12,crownY-0.18],[R*0.11,crownY-0.02],[0.05,crownY+0.04]],G),'gore-0');
  // Load cables from the frame corners to the skirt. The two cables at a corner start 24 mm apart (sharing one start point their
  // faces were coplanar near the frame).
  for(let i=0;i<8;i++){const a=(i+0.5)*Math.PI/4,c=[Math.cos(a)*r0*0.98,y0+0.02,Math.sin(a)*r0*0.98] as V3,f:V3=[Math.sign(Math.cos(a))*fw-Math.sin(a)*0.012,fy,Math.sign(Math.sin(a))*fw+Math.cos(a)*0.012];add('cable-'+i,'frame',rod(f,c,0.012,4),'frame-01');}
  // Sandbags hang from the rim.
  const n=Number(p.sandbags);
  for(let i=0;i<n;i++){const side=i%4,k=Math.floor(i/4),off=(k?0.25:-0.25)*S,[x,z]=side===0?[off,w+0.09]:side===1?[w+0.09,-off]:side===2?[-off,-w-0.09]:[-w-0.09,off];
   add('sandbag-'+i,'canvas',lathe([[0.06,bh-0.55],[0.11,bh-0.48],[0.1,bh-0.33],[0.04,bh-0.26]],7,{center:[x,z]}),'basket-floor');
   add('sandbag-rope-'+i,'frame',rod([x,bh-0.28,z],[x*(w/(w+0.09)),bh,z*(w/(w+0.09))],0.008,4),'sandbag-'+i);}
  return {crown:[0,crownY,0],basket:[0,bh,0]};
 },
});

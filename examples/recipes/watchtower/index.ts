import { box, forgeRecipe, lathe, rod } from '../../../src/engine/forge-kit.ts';
import { beam, place, prism } from '../../../src/engine/forge-kit-structures.ts';
import { profileSolid as boxStations } from '../../../src/engine/geometry.ts';
import type { Control } from '../../../src/engine/parameters.ts';

const controls:Control[]=[
 {key:'type',label:'Tower type',kind:'choice',group:'construction',unit:'none',default:'timber',options:[{value:'timber',label:'Timber lookout'},{value:'stone',label:'Stone keep'},{value:'cabin',label:'Fire-lookout cabin'}],hint:'Open braced timber legs, a solid crenellated stone tower, or legs carrying a glazed cabin.',affects:['topology'],targets:['legs','walls','cabin']},
 {key:'height',label:'Platform height',kind:'range',group:'shape',unit:'m',min:4,max:10,step:0.1,default:6,hint:'Ground to the platform deck.',affects:['geometry'],targets:['legs','walls','deck']},
 {key:'base',label:'Base width',kind:'range',group:'shape',unit:'m',min:2.2,max:4.5,step:0.05,default:3.2,hint:'Footprint at the ground.',affects:['geometry'],targets:['legs','walls']},
 {key:'top',label:'Top width',kind:'range',group:'shape',unit:'m',min:1.8,max:3.5,step:0.05,default:2.2,hint:'Width at the platform (legs splay out from here).',affects:['geometry'],targets:['legs','deck']},
 {key:'levels',label:'Brace levels',kind:'integer',group:'construction',unit:'count',min:1,max:4,step:1,default:2,hint:'Tiers of cross bracing (timber) or string courses (stone).',affects:['topology'],targets:['brace']},
 {key:'roof',label:'Roof',kind:'choice',group:'construction',unit:'none',default:'pyramid',options:[{value:'pyramid',label:'Pyramid'},{value:'gable',label:'Gable'},{value:'none',label:'Open'}],hint:'Roof over the platform.',affects:['topology'],targets:['roof']},
 {key:'ladder',label:'Ladder',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Ladder up the front (stone keeps get a door instead).',affects:['topology'],targets:['ladder']},
];
export const watchtowerRecipe=forgeRecipe({
 id:'watchtower',version:'1.0.0',title:'Watchtower',description:'A lookout tower: splayed timber legs with X bracing, a crenellated stone keep, or a fire-lookout cabin on stilts.',category:'Buildings',order:210,
 entry:'examples/recipes/watchtower/index.ts',exportName:'watchtowerRecipe',
 roles:{timber:'Legs, braces, deck and rails.',stone:'Stone walls and footings.',roof:'Roof covering.',trim:'Glazing, doors and slits.',plank:'Deck boards and cabin walls.'},
 palettes:{
  pine:{label:'Pine',colors:{timber:'#7a5a3c',stone:'#8d8a84',roof:'#4f3a2e',trim:'#2c2a27',plank:'#a8835a'}},
  granite:{label:'Granite',colors:{timber:'#5b4636',stone:'#a7a39a',roof:'#41505a',trim:'#25272a',plank:'#8b6c4d'}},
  ranger:{label:'Ranger green',colors:{timber:'#4b3b2e',stone:'#7f7b74',roof:'#2f4a3a',trim:'#cfe2e6',plank:'#c9b48b'}},
 },
 roughness:{trim:0.4},
 controls,
 presets:[
  {id:'lookout',name:'Timber lookout',description:'Splayed legs, two tiers of X bracing, railed deck and pyramid roof.',parameters:{}},
  {id:'stone-keep',name:'Stone keep',description:'Solid tapered stone tower with corbels, crenellations and arrow slits.',parameters:{type:'stone',height:7.5,base:3.8,top:3.2,levels:3,roof:'none',ladder:false,colorway:'granite'}},
  {id:'fire-lookout',name:'Fire lookout',description:'Tall braced legs carrying a glazed cabin with a hipped roof.',parameters:{type:'cabin',height:8.5,base:4,top:2.6,levels:4,roof:'pyramid',colorway:'ranger'}},
 ],
 constraints:['The top cannot be wider than the base.'],
 check(p){if(Number(p.top)>Number(p.base)+1e-9)throw new Error('Top width cannot exceed base width');},
 build(p,add){
  const H=Number(p.height),B=Number(p.base)/2,T=Number(p.top)/2,levels=Number(p.levels),type=String(p.type),roof=String(p.roof);
  const legAt=(y:number)=>B-(B-T)*y/H;
  let deckTop:number,deckHalf:number;
  if(type==='stone'){
   const cs=0.12;
   add('footing','stone',box([B*2+0.3,0.3,B*2+0.3],[0,0.15,0],0.03));
   add('walls','stone',boxStations([0.3,H*0.5,H].map(y=>({y,width:legAt(y)*2,depth:legAt(y)*2,chamfer:cs}))),'footing');
   for(let i=1;i<=levels;i++){const y=H*i/(levels+1);add('string-course-'+i,'stone',boxStations([{y:y-0.08,width:legAt(y)*2+0.12,depth:legAt(y)*2+0.12,chamfer:cs},{y:y+0.08,width:legAt(y)*2+0.12,depth:legAt(y)*2+0.12,chamfer:cs}]),'walls');}
   // Corbel table under an overhanging parapet.
   const pw=T+0.25,corbels=Math.max(3,Math.round(T*2/0.55));
   for(const [side,ax] of [[1,'z'],[-1,'z'],[1,'x'],[-1,'x']] as const)for(let k=0;k<corbels;k++){
    const u=-T+0.2+(k+0.5)*(T*2-0.4)/corbels,pos:[number,number,number]=ax==='z'?[u,H-0.25,side*(T+0.1)]:[side*(T+0.1),H-0.25,u];
    add('corbel-'+ax+side+'-'+k,'stone',box([ax==='z'?0.22:0.3,0.4,ax==='z'?0.3:0.22],pos,0.02),'walls');
   }
   add('parapet-floor','stone',box([pw*2,0.25,pw*2],[0,H+0.1,0],0.02),'walls');
   for(const [side,ax] of [[1,'z'],[-1,'z'],[1,'x'],[-1,'x']] as const){
    const len=pw*2-(ax==='x'?0.6:0),pos:[number,number,number]=ax==='z'?[0,H+0.55,side*(pw-0.15)]:[side*(pw-0.15),H+0.55,0];
    add('parapet-'+ax+side,'stone',box(ax==='z'?[len,0.65,0.3]:[0.3,0.65,len],pos,0.02),'parapet-floor');
    const merlons=Math.max(3,Math.round(len/0.7)|1);
    for(let k=0;k<merlons;k+=2){const u=-len/2+(k+0.5)*len/merlons;add('merlon-'+ax+side+'-'+k,'stone',box(ax==='z'?[len/merlons,0.45,0.3]:[0.3,0.45,len/merlons],ax==='z'?[u,H+1.1,side*(pw-0.15)]:[side*(pw-0.15),H+1.1,u],0.02),'parapet-'+ax+side);}
   }
   add('door','trim',box([0.9,1.8,0.12],[0,0.3+0.9,legAt(1.2)+0.03],0.01),'walls');
   add('door-arch','stone',place(prism([[-0.6,0],[0.6,0],[0.42,0.3],[0,0.42],[-0.42,0.3]],0.18),[0,2.1,legAt(2.2)+0.04]),'walls');
   for(let i=0;i<levels;i++){const y=H*(i+1.5)/(levels+1);
    for(const [ax,s] of [['z',1],['x',1],['x',-1],['z',-1]] as const){if(i===0&&ax==='z'&&s===1)continue;const r=legAt(y)+0.02,batter=Math.atan((B-T)/H),g=box(ax==='z'?[0.14,0.7,0.1]:[0.1,0.7,0.14],[0,0,0],0.01);
     // Tilted to the wall batter so the slit stands an even 20 mm proud along its height (upright, its top stood about 10 mm further out).
     if(ax==='z')g.rotateX(-s*batter);else g.rotateZ(s*batter);g.translate(...(ax==='z'?[0,y,s*r]:[s*r,y,0]) as [number,number,number]);add('slit-'+i+ax+s,'trim',g,'walls');}}
   deckTop=H+0.22;deckHalf=pw;
  }else{
   for(const [i,[sx,sz]] of ([[1,1],[-1,1],[-1,-1],[1,-1]] as [number,number][]).entries()){
    add('footing-'+i,'stone',box([0.5,0.25,0.5],[sx*B,0.125,sz*B],0.03));
    // Timber legs end inside the deck boards, 20 mm under the deck top. They ran 1 m on as round stubs inside the rail, carrying nothing.
    add('leg-'+i,'timber',rod([sx*B,0.2,sz*B],[sx*T,H+(type==='cabin'?0:0.03),sz*T],0.12,8,0.1),'footing-'+i);
   }
   for(let l=0;l<levels;l++){
    const y0=0.6+(H-0.6)*l/levels,y1=0.6+(H-0.6)*(l+1)/levels-0.2;
    for(const f of [0,1,2,3]){
     const c:[number,number][]=[[1,1],[-1,1],[-1,-1],[1,-1]],[ax,az]=c[f]!,[bx,bz]=c[(f+1)%4]!,n=[(ax+bx)/2,(az+bz)/2];
     const pt=(sx:number,sz:number,y:number,out:number):[number,number,number]=>[sx*legAt(y)+n[0]!*out,y,sz*legAt(y)+n[1]!*out];
     add('girt-'+l+'-'+f,'timber',beam(pt(ax,az,y0,0.1),pt(bx,bz,y0,0.1),0.14,0.1),'leg');
     // Braces sit inside the tapering legs' octagon flats (111 mm at the foot, 92 mm at the top) at their ends (at 80/120 mm out, 100x70 mm, their ends poked out of the legs); now 80x60 mm.
     add('brace-a-'+l+'-'+f,'timber',beam(pt(ax,az,y0,0.01),pt(bx,bz,y1,0.01),0.08,0.06),'leg');
     add('brace-b-'+l+'-'+f,'timber',beam(pt(bx,bz,y0,0.045),pt(ax,az,y1,0.045),0.08,0.06),'leg');
    }
   }
   deckHalf=T+0.45;
   add('deck-joists','timber',box([deckHalf*2-0.1,0.18,T*2+0.2],[0,H-0.09,0],0.01),'leg');
   const boards=Math.round(deckHalf*2/0.2);
   for(let k=0;k<boards;k++)add('deck-board-'+k,'plank',box([deckHalf*2/boards-0.02,0.05,deckHalf*2],[-deckHalf+(k+0.5)*deckHalf*2/boards,H+0.025,0],0.006),'deck-joists');
   deckTop=H+0.05;
   if(p.ladder){
    const z0=B+1.6,z1=T+0.45;
    let ry=0.01;for(let it=0;it<4;it++){const dy=H+0.9-ry,dz=z1-0.03-z0;ry=0.04*Math.abs(dz)/Math.hypot(dy,dz);} // the rail's lowest edge lands exactly on the ground (beam half-height times the tilt)
    for(const s of [-1,1])add('ladder-rail-'+(s>0?'r':'l'),'timber',beam([s*0.28,ry,z0],[s*0.28,H+0.9,z1-0.03],0.08,0.06),'deck-joists');
    // Rungs follow the rails' own line (they drifted up to 30 mm off it near the top and poked out of the rails).
    const rungs=Math.round(H/0.32),railZ=(y:number)=>z0+(z1-0.03-z0)*(y-ry)/(H+0.9-ry);for(let k=1;k<rungs;k++){const t=k/rungs,y=t*(H+0.86);add('ladder-rung-'+k,'timber',rod([-0.3,y,railZ(y)],[0.3,y,railZ(y)],0.025,6),'ladder');}
   }
  }
  if(type==='cabin'){
   const c=T+0.15,wallH=1.0,glassH=1.1;
   add('cabin-wall','plank',box([c*2,wallH,c*2],[0,deckTop+wallH/2,0],0.02),'deck-joists');
   add('cabin-glass','trim',box([c*2-0.08,glassH,c*2-0.08],[0,deckTop+wallH+glassH/2,0],0.01),'cabin-wall');
   for(const s of [-1,1])for(const ax of ['x','z'] as const)for(let k=0;k<=3;k++){const u=-c+0.04+k*(2*c-0.08)/3;add('mullion-'+ax+s+'-'+k,'timber',box(ax==='z'?[0.07,glassH,0.08]:[0.08,glassH,0.07],ax==='z'?[u,deckTop+wallH+glassH/2,s*(c-0.03)]:[s*(c-0.03),deckTop+wallH+glassH/2,u],0.005),'cabin-glass');}
   add('cabin-plate','timber',box([c*2+0.1,0.15,c*2+0.1],[0,deckTop+wallH+glassH+0.075,0],0.01),'cabin-glass');
   deckTop+=wallH+glassH+0.15;
  }
  if(type!=='stone'){
   // Railing around the deck (cabins keep a catwalk rail).
   const rh=1.0,y=H+0.05,r=deckHalf-0.06,posts=Math.max(2,Math.round(r*2/0.9));
   for(const [ax,s] of [['z',1],['z',-1],['x',1],['x',-1]] as const){
    const gap=p.ladder&&ax==='z'&&s===1;
    for(let k=0;k<=posts;k++){const u=-r+k*2*r/posts,corner=ax==='x'&&(k===0||k===posts),pw=corner?0.07:0.08;if(gap&&Math.abs(u)<0.4)continue;add('rail-post-'+ax+s+'-'+k,'timber',box([pw,rh-(corner?0.01:0),pw],ax==='z'?[u,y+rh/2,s*r]:[s*r,y+rh/2,u],0.008),'deck-joists');}
    for(const h of [0.5,0.97]){
     if(gap){for(const side of [-1,1])add('rail-'+ax+s+'-'+h+side,'timber',box([r-0.38,0.07,0.06],[side*(r+0.38)/2,y+rh*h,s*(r+0.015)],0.006),'deck-joists');}
     else add('rail-'+ax+s+'-'+h,'timber',box(ax==='z'?[2*r,0.07,0.06]:[0.06,0.07,2*r-0.1],ax==='z'?[0,y+rh*h,s*(r+0.015)]:[s*(r+0.015),y+rh*h,0],0.006),'deck-joists');
    }
   }
  }
  let top=deckTop;
  if(roof!=='none'){
   const ry=type==='cabin'?deckTop:type==='stone'?H+1.35:H+2.25,half=type==='cabin'?T+0.55:deckHalf+0.25;
   if(type==='timber'){for(const [i,[sx,sz]] of ([[1,1],[-1,1],[-1,-1],[1,-1]] as [number,number][]).entries())add('roof-post-'+i,'timber',box([0.12,ry-H-0.05,0.12],[sx*(deckHalf-0.06),H+0.05+(ry-H-0.05)/2,sz*(deckHalf-0.06)],0.01),'deck-joists');}
   if(type==='stone'){add('roof-drum','stone',box([deckHalf*2-0.8,0.3,deckHalf*2-0.8],[0,H+0.38,0],0.02),'parapet-floor');}
   add('roof-plate','timber',box([half*2-0.4,0.14,half*2-0.4],[0,ry+0.07,0],0.01),'roof');
   if(roof==='pyramid'){add('roof','roof',lathe([[half*Math.SQRT2,ry+0.1],[half*Math.SQRT2,ry+0.2],[0.04,ry+0.2+half*0.95]],4,{phase:Math.PI/4}),'roof-plate');add('finial','trim',rod([0,ry+0.1+half*0.9,0],[0,ry+0.45+half*0.95,0],0.05,6,0.02),'roof');top=ry+0.45+half*0.95;}
   else{add('roof','roof',place(prism([[-half-0.1,0],[half+0.1,0],[0.06,half*0.75],[-0.06,half*0.75]],half*2+0.2),[0,ry+0.12,0]),'roof-plate');top=ry+0.12+half*0.75;}
  }
  return {top:[0,top,0],platform:[0,H+0.05,0]};
 },
});

import { blade, blob, forgeRecipe, lathe, merge, rng } from '../../../src/engine/forge-kit.ts';
import type { Control } from '../../../src/engine/parameters.ts';
type V=[number,number,number];
const controls:Control[]=[
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:1.5,max:12,step:0.1,default:7,hint:'Height of the crown above the ground.',affects:['geometry'],targets:['trunk','frond']},
 {key:'trunks',label:'Trunks',kind:'integer',group:'construction',unit:'count',min:1,max:3,step:1,default:1,hint:'Stems growing from one root mound.',affects:['topology'],targets:['trunk']},
 {key:'lean',label:'Lean',kind:'range',group:'shape',unit:'ratio',min:0,max:0.45,step:0.01,default:0.22,hint:'How far the trunk curves away from upright, as a share of its height.',affects:['geometry'],targets:['trunk']},
 {key:'thickness',label:'Trunk thickness',kind:'range',group:'shape',unit:'m',min:0.1,max:0.6,step:0.01,default:0.2,hint:'Trunk radius at the base.',affects:['geometry'],targets:['trunk']},
 {key:'fronds',label:'Fronds',kind:'integer',group:'construction',unit:'count',min:5,max:14,step:1,default:9,hint:'Leaves in each crown.',affects:['topology'],targets:['frond']},
 {key:'droop',label:'Frond droop',kind:'range',group:'shape',unit:'ratio',min:0,max:1,step:0.01,default:0.65,hint:'0 holds fronds up like a shuttlecock, 1 lets them arch down.',affects:['geometry'],targets:['frond']},
 {key:'fruit',label:'Fruit',kind:'choice',group:'construction',unit:'none',default:'coconuts',options:[{value:'none',label:'None'},{value:'coconuts',label:'Coconuts'},{value:'dates',label:'Date bunches'}],hint:'Fruit hanging under the crown.',affects:['topology'],targets:['fruit']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:7,hint:'Repeatable frond angles and trunk wobble.',affects:['geometry'],targets:['trunk','frond']},
];
export const palmTreeRecipe=forgeRecipe({
 id:'palm-tree',version:'1.0.0',title:'Palm tree',description:'A tropical palm with a ringed, curving trunk, arching feathered fronds and coconuts or date bunches.',category:'Nature',order:310,
 entry:'examples/recipes/palm-tree/index.ts',exportName:'palmTreeRecipe',
 roles:{trunk:'Ringed trunk.',scar:'Leaf-scar rings and crown shank.',frond:'Fronds and leaflets.',fruit:'Coconuts or dates.',ground:'Sand root mound.'},
 palettes:{tropical:{label:'Tropical',colors:{trunk:'#8a6a4a',scar:'#6b4f35',frond:'#3f8f3a',fruit:'#6b4a2a',ground:'#d8c48f'}},desert:{label:'Desert oasis',colors:{trunk:'#9b7b55',scar:'#7a5a3a',frond:'#7a9a4a',fruit:'#c07a2a',ground:'#e0c27a'}},dusk:{label:'Dusk',colors:{trunk:'#6e5848',scar:'#4e3c30',frond:'#2f6e52',fruit:'#4a3a2a',ground:'#c9b08a'}}},
 controls,groundSnap:0.03,
 presets:[
  {id:'coconut',name:'Coconut palm',description:'Tall leaning palm with drooping fronds and coconuts.',parameters:{}},
  {id:'date-palm',name:'Date palm',description:'Thick straight trunk, stiff upswept crown and orange date bunches.',parameters:{height:5.5,lean:0.04,thickness:0.36,fronds:13,droop:0.25,fruit:'dates',colorway:'desert',seed:31}},
  {id:'pygmy-cluster',name:'Pygmy palm cluster',description:'Three short slender stems from one mound.',parameters:{height:2.4,trunks:3,lean:0.3,thickness:0.11,fronds:8,droop:0.5,fruit:'none',colorway:'dusk',seed:5}},
 ],
 constraints:['Trunk segments overlap so the trunk is continuous; fronds and fruit start inside the crown shank.'],
 build(p,add){
  const H=Number(p.height),R=Number(p.thickness),n=Number(p.trunks),F=Number(p.fronds),droop=Number(p.droop),random=rng(Number(p.seed));
  const mound=R*2.2+(n-1)*R*1.6;
  add('mound','ground',lathe([[mound,0],[mound*0.8,R*0.35],[mound*0.35,R*0.7]],10,{squash:0.9,phase:random()}));
  let crownTop:V=[0,H,0];
  for(let t=0;t<n;t++){
   const a=t*2.4+random()*0.6,h=H*(t===0?1:0.62+random()*0.25),r=R*(t===0?1:0.8),off=n>1?R*1.3:0;
   const bx=Math.cos(a)*off,bz=Math.sin(a)*off,dir=n>1?a:random()*Math.PI*2,lean=Number(p.lean)*h;
   const path=(u:number):V=>{const bend=lean*u*u;return [bx+Math.cos(dir)*bend+Math.sin(u*9+t)*R*0.08,r*0.25+u*(h-r*0.25),bz+Math.sin(dir)*bend];};
   const segs=Math.max(8,Math.round(h/(R*1.6))),rad=(u:number)=>r*(1-0.38*u)*(u<0.06?1.35-u*5.8:1);
   const segG=[];
   for(let i=0;i<segs;i++){
    const u0=i/segs,u1=(i+1.12)/segs,c0=path(u0),c1=path(Math.min(u1,1.02)),r0=rad(u0),r1=rad(Math.min(u1,1));
    const mid:V=[c0[0]*0.25+c1[0]*0.75,c0[1]*0.25+c1[1]*0.75,c0[2]*0.25+c1[2]*0.75];
    segG.push(blade([{p:c0,w:r0*0.92,t:r0*0.92},{p:mid,w:r1*1.08,t:r1*1.08},{p:c1,w:r1*0.95,t:r1*0.95}],[1,0,0]));
   }
   add('trunk-'+t,'trunk',merge(segG),'mound');
   // crown shank: bulging sheath where fronds emerge
   const top=path(1);
   add('shank-'+t,'scar',lathe([[r*0.62,top[1]-r*0.6],[r*0.95,top[1]],[r*0.7,top[1]+r*0.9],[r*0.2,top[1]+r*1.5]],9,{center:[top[0],top[2]]}),'trunk-'+t);
   const cy=top[1]+r*0.6,L=h*0.42+0.6;
   for(let f=0;f<F;f++){
    const fa=f*(2*Math.PI/F)+random()*0.3,up=0.9-droop*1.4+(f%2?0.25:0)+(random()-.5)*0.2,len=L*(0.8+random()*0.3);
    const dx=Math.cos(fa),dz=Math.sin(fa),pts:V[]=[];
    for(let k=0;k<=7;k++){const s=k/7,horiz=s*len*0.95,y=cy+Math.sin(up)*s*len-droop*s*s*len*0.55;pts.push([top[0]+dx*horiz,y-(k===0?(f%3)*0.014:0),top[2]+dz*horiz]);} // rachis roots staggered in height inside the shank so neighbouring fronds don't share faces
    const side:V=[-dz,0,dx];
    const fg=[blade(pts.map((q,k)=>({p:q,w:Math.max(r*0.14*(1-k/8),0.006),t:Math.max(r*0.1*(1-k/8),0.005)})),side)];
    // Leaflet stations are staggered per frond so leaflets of neighbouring fronds never root at the same point.
    // Budget: ~375 leaflets (24 tris each) across all fronds of all trunks.
    const leaflets=Math.max(4,Math.min(Math.round(len/0.22),Math.floor(187/(F*n))));
    for(let k=1;k<leaflets;k++){
     const s=(k+(f%3)*0.3)/(leaflets+0.6),idx=s*7,i0=Math.floor(idx),q=pts[i0]!,q1=pts[Math.min(i0+1,7)]!,fr=idx-i0,base:V=[q[0]+(q1[0]-q[0])*fr,q[1]+(q1[1]-q[1])*fr,q[2]+(q1[2]-q[2])*fr];
     const ll=len*0.32*Math.sin(Math.PI*(0.15+0.8*s))+0.05;
     for(const sgn of [-1,1]){
      const out:V=[side[0]*sgn,0,side[2]*sgn],sweep=0.45,fall=-0.25-droop*0.35-(f%2)*0.1-(f%3)*0.04; // neighbouring fronds' leaflets droop differently so overlapping leaflets never share a plane
      const tip:V=[base[0]+(out[0]+dx*sweep)*ll,base[1]+fall*ll,base[2]+(out[2]+dz*sweep)*ll],mid:V=[(base[0]+tip[0])/2,(base[1]+tip[1])/2+ll*0.06,(base[2]+tip[2])/2];
      fg.push(blade([{p:base,w:ll*0.05,t:0.004},{p:mid,w:ll*0.09,t:0.005},{p:tip,w:0.004,t:0.003}],[dx,0,dz]));
     }
    }
    add('frond-'+t+'-'+f,'frond',merge(fg),'shank-'+t);
   }
   if(p.fruit==='coconuts'&&t===0){
    for(let c=0;c<4;c++){const ca=c*1.7+random(),cr=r*0.7;add('fruit-'+t+'-'+c,'fruit',blob([top[0]+Math.cos(ca)*r*1.1,top[1]+cr*0.1,top[2]+Math.sin(ca)*r*1.1],[cr,cr*1.1,cr],8,5),'shank-'+t);}
   }
   if(p.fruit==='dates'){
    for(let c=0;c<3;c++){const ca=c*2.1+random(),sx=top[0]+Math.cos(ca)*r*0.8,sz=top[2]+Math.sin(ca)*r*0.8,hl=r*2.2;
     add('stalk-'+t+'-'+c,'scar',blade([{p:[sx,top[1]+r*0.3,sz],w:0.025,t:0.02},{p:[sx+Math.cos(ca)*hl*0.5,top[1]-hl*0.2,sz+Math.sin(ca)*hl*0.5],w:0.02,t:0.018},{p:[sx+Math.cos(ca)*hl*0.6,top[1]-hl,sz+Math.sin(ca)*hl*0.6],w:0.012,t:0.012}],[-Math.sin(ca),0,Math.cos(ca)]),'shank-'+t);
     for(let d=0;d<6;d++){const dy=top[1]-hl*(0.35+d*0.11),dr=0.06+0.02*(d%2),da=d*2.3;add('fruit-'+t+'-'+c+'-'+d,'fruit',blob([sx+Math.cos(ca)*hl*0.56+Math.cos(da)*0.05,dy,sz+Math.sin(ca)*hl*0.56+Math.sin(da)*0.05],[dr,dr*1.25,dr],6,3),'stalk-'+t+'-'+c);}
    }
   }
   if(t===0)crownTop=[top[0],top[1],top[2]];
  }
  return {top:crownTop};
 },
});

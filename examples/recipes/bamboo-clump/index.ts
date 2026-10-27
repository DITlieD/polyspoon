import { blade, forgeRecipe, lathe, merge, rng } from '../../../src/engine/forge-kit.ts';
import { taperedSweep } from '../../../src/engine/geometry.ts';
import type { BufferGeometry } from 'three';
import type { Control } from '../../../src/engine/parameters.ts';
type V=[number,number,number];
const controls:Control[]=[
 {key:'culms',label:'Culms',kind:'integer',group:'construction',unit:'count',min:2,max:14,step:1,default:9,hint:'Number of bamboo stalks.',affects:['topology'],targets:['culm','node','leaf']},
 {key:'height',label:'Height',kind:'range',group:'shape',unit:'m',min:1,max:9,step:0.1,default:5,hint:'Height of the tallest culm.',affects:['geometry'],targets:['culm']},
 {key:'thickness',label:'Culm radius',kind:'range',group:'shape',unit:'m',min:0.012,max:0.08,step:0.001,default:0.035,hint:'Radius of the tallest culm.',affects:['geometry'],targets:['culm','node']},
 {key:'arch',label:'Arch',kind:'range',group:'shape',unit:'ratio',min:0,max:0.5,step:0.01,default:0.12,hint:'How far culms bow outward near the top.',affects:['geometry'],targets:['culm']},
 {key:'foliage',label:'Foliage',kind:'range',group:'shape',unit:'ratio',min:0.3,max:1.5,step:0.05,default:1,hint:'Leaf sprays per node relative to default.',affects:['topology'],targets:['leaf']},
 {key:'seed',label:'Variation seed',kind:'integer',group:'construction',unit:'seed',min:0,max:65535,step:1,default:14,hint:'Repeatable culm placement, heights and leaf angles.',affects:['geometry'],targets:['culm','leaf']},
];
export const bambooClumpRecipe=forgeRecipe({
 id:'bamboo-clump',version:'1.0.0',title:'Bamboo clump',description:'A clump of jointed bamboo culms with raised nodes, leafy sprays of lance leaves, sheathed young shoots and a leaf-litter base.',category:'Nature',order:380,
 entry:'examples/recipes/bamboo-clump/index.ts',exportName:'bambooClumpRecipe',
 roles:{culm:'Culms (stalks).',node:'Node rings.',leaf:'Leaves and twigs.',sheath:'Shoot sheaths.',ground:'Leaf-litter mound.'},
 palettes:{green:{label:'Green',colors:{culm:'#6f9a3e',node:'#557a2e',leaf:'#4f8a35',sheath:'#a08050',ground:'#6b5a3a'}},golden:{label:'Golden',colors:{culm:'#d7b84a',node:'#9a8a3a',leaf:'#6a9a3a',sheath:'#b08a52',ground:'#7a6644'}},black:{label:'Black',colors:{culm:'#2e2a28',node:'#4a4038',leaf:'#3f7a3a',sheath:'#6a5440',ground:'#4e4232'}}},
 roughness:{culm:0.55,node:0.6},
 controls,groundSnap:0.03,
 presets:[
  {id:'grove',name:'Bamboo grove',description:'Tall dense clump of green culms.',parameters:{}},
  {id:'golden-clump',name:'Golden bamboo',description:'Medium clump of thick golden culms with green nodes.',parameters:{culms:6,height:3.4,thickness:0.045,arch:0.06,foliage:0.8,colorway:'golden',seed:8}},
  {id:'arching-black',name:'Arching black bamboo',description:'Slender black culms bowing out like a fountain.',parameters:{culms:7,height:3,thickness:0.022,arch:0.42,foliage:1.2,colorway:'black',seed:27}},
 ],
 constraints:['Each internode overlaps its node rings; leaf sprays root inside their node; culms start inside the mound.'],
 build(p,add){
  const n=Number(p.culms),H=Number(p.height),T=Number(p.thickness),arch=Number(p.arch),fol=Number(p.foliage),random=rng(Number(p.seed));
  const spread=T*6+n*T*0.9,culm:BufferGeometry[]=[],node:BufferGeometry[]=[],leaf:BufferGeometry[]=[],sheath:BufferGeometry[]=[];
  add('mound','ground',lathe([[spread*1.25,0],[spread*0.95,0.05],[spread*0.4,0.09]],12,{squash:0.9,phase:random()}));
  // Triangle budget (Nature 14k): ~84 tris per culm node, ~144 per leaf spray.
  const nodeCap=Math.max(5,Math.floor(72/n)),estNodes=n*Math.min(nodeCap,Math.round(H*0.8/(0.28+T*6))),leafScale=Math.min(1,5200/(estNodes*0.62*0.62*fol*144+1));
  for(let c=0;c<n;c++){
   const a=c*2.39996+random()*0.3,d=c===0?0:spread*0.75*Math.sqrt(c/n),bx=Math.cos(a)*d,bz=Math.sin(a)*d,h=H*(c===0?1:0.55+random()*0.4),r=T*(0.75+0.25*h/H);
   const dir=d>0?a:random()*6.28,bow=arch*h*(0.6+0.4*d/spread)+h*0.03;
   const at=(u:number):V=>[bx+Math.cos(dir)*bow*u*u,0.03+u*h-bow*u*u*u*0.25*arch*2,bz+Math.sin(dir)*bow*u*u];
   const nodes=Math.min(nodeCap,Math.max(5,Math.round(h/(0.28+r*6))));
   for(let i=0;i<nodes;i++){
    const u0=i/nodes,u1=(i+1)/nodes,p0=at(u0),p1=at(i===nodes-1?u1:u1+0.2/nodes),rr=r*(1-0.45*u0),rr1=r*(1-0.45*u1),mid=at((u0+u1)/2);
    // Internodes stop 0.003 short of their joint, inside the node ring that bridges both (the old 20% overlap made hidden coplanar
    // shells; ending exactly at the joint welded the end rings into non-manifold edges). Only the top internode keeps its overshoot.
    culm.push(taperedSweep([{center:p0,radius:rr},{center:mid,radius:(rr+rr1)/2*0.97},{center:i===nodes-1?p1:at(u1-0.003),radius:rr1}],7));
    // Node-ring ends sink inside the culm (at 1.06 r they lay within 3 mm of its faces).
    if(i>0){const t=at(u0+0.0001),q0=at(u0-0.012),q1=at(u0+0.012);void t;node.push(taperedSweep([{center:q0,radius:rr*0.9},{center:p0,radius:rr*1.16},{center:q1,radius:rr*0.9}],7));}
    if(u0>0.38&&i%1===0&&random()<0.62*fol*leafScale){
     const sa=random()*6.28,sx=Math.cos(sa),sz=Math.sin(sa),tl=0.12+h*0.04,tw:V=[p0[0]+sx*tl,p0[1]+tl*0.6,p0[2]+sz*tl];
     leaf.push(blade([{p:p0,w:0.005,t:0.005},{p:tw,w:0.003,t:0.003}],[0,1,0]));
     const leaves=Math.round(3+random()*2*fol);
     for(let k=0;k<leaves;k++){const la=sa+(k-(leaves-1)/2)*0.55,lx=Math.cos(la),lz=Math.sin(la),ll=0.16+h*0.025;
      leaf.push(blade([{p:tw,w:0.004,t:0.002},{p:[tw[0]+lx*ll*0.35,tw[1]+ll*0.05,tw[2]+lz*ll*0.35],w:ll*0.11,t:0.003},{p:[tw[0]+lx*ll*0.7,tw[1]-ll*0.12,tw[2]+lz*ll*0.7],w:ll*0.08,t:0.002},{p:[tw[0]+lx*ll,tw[1]-ll*0.35,tw[2]+lz*ll],w:0.003,t:0.0015}],[-lz*0.9,0.45,lx*0.9]));}
    }
   }
   // crown spray at the tip
   const tip=at(1);for(let k=0;k<5;k++){const la=k*1.26+random(),lx=Math.cos(la),lz=Math.sin(la),ll=0.2+h*0.02;leaf.push(blade([{p:[tip[0],tip[1]-0.02,tip[2]],w:0.004,t:0.002},{p:[tip[0]+lx*ll*0.4,tip[1]+ll*0.25,tip[2]+lz*ll*0.4],w:ll*0.1,t:0.003},{p:[tip[0]+lx*ll,tip[1]+ll*0.1,tip[2]+lz*ll],w:0.003,t:0.0015}],[-lz,0.3,lx]));}
  }
  for(let s=0;s<Math.max(2,Math.round(n/3));s++){const a=random()*6.28,d=spread*(0.5+random()*0.4),x=Math.cos(a)*d,z=Math.sin(a)*d,h=0.15+random()*0.25,r=T*0.9;
   sheath.push(lathe([[r,0.03],[r*0.85,h*0.4],[r*0.45,h*0.8],[r*0.08,h]],7,{center:[x,z],phase:random()}));
   for(let k=0;k<3;k++){const b=k*2.1+random(),bx=Math.cos(b),bz=Math.sin(b);sheath.push(blade([{p:[x+bx*r*0.7,0.04+h*0.1*k,z+bz*r*0.7],w:r*0.5,t:r*0.12},{p:[x+bx*r*0.9,0.04+h*(0.45+0.12*k),z+bz*r*0.9],w:r*0.35,t:r*0.1},{p:[x+bx*r*0.5,0.04+h*(0.75+0.1*k),z+bz*r*0.5],w:r*0.05,t:r*0.03}],[-bz,0,bx]));}}
  add('culms','culm',merge(culm),'mound');add('nodes','node',merge(node),'culms');add('leaves','leaf',merge(leaf),'culms');add('shoots','sheath',merge(sheath),'mound');
  return {top:[0,H,0]};
 },
});

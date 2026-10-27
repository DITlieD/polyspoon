// Rigged rabbit: an original quadruped body (big haunches, long hind feet, long ears,
// cotton tail) on the shared four-paw quadruped rig contract (rig kind 'fox': four paw
// effectors, two-bone IK chains, idle + walk clips), so it reuses the validated motion.
import { Bone,Box3,Group,MeshStandardMaterial,Skeleton,SkinnedMesh,Vector3 } from 'three';
import type { Control,Design } from '../../../src/engine/parameters.ts';
import { parseControls,parameterState,plainRecord } from '../../../src/engine/parameters.ts';
import { loadConstructionDesign } from '../../../src/engine/construction-migration.ts';
import type { Recipe } from '../../../src/recipes/types.ts';
import { combineSkins,skinGeometry,type SkinStation } from '../../../src/rigging/skin.ts';
import { partitionFoxSkin,type FoxRole } from '../../../src/rigging/fox-geometry.ts';
import type { RawRiggedBuild,RigMetadata } from '../../../src/rigging/types.ts';

const range=(key:string,label:string,min:number,max:number,value:number,unit:'m'|'ratio'='ratio'):Control=>({key,label,kind:'range',group:'shape',unit,min,max,step:.005,default:value,hint:label,affects:['geometry'],targets:['body','skeleton']});
const choice=(key:string,label:string,options:string[],hint:string):Control=>({key,label,kind:'choice',group:'construction',unit:'none',default:options[0]!,options:options.map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)})),hint,affects:['geometry'],targets:['body','skeleton']});
const colors={fur:'#9a7b5c',cream:'#efe6d6',dark:'#2b2624'};
const controls:Control[]=[
 range('bodyLength','Body length',.26,.5,.34,'m'),range('earRatio','Ear length',.45,1.05,.62),range('haunch','Haunch size',.85,1.25,1),range('legRatio','Leg length',.8,1.3,1),range('headRatio','Head size',.85,1.2,1),
 choice('earStyle',"Ears",['upright','lop','swept'],'Upright rabbit ears, lop ears hanging beside the head, or long hare ears swept back.'),
 choice('build','Build',['standard','stocky','lean'],'Body girth.'),
 {key:'earTips',label:'Dark ear tips',kind:'toggle',group:'construction',unit:'none',default:false,hint:'Hare-style black ear tips.',affects:['geometry'],targets:['body']},
 ...Object.entries(colors).map(([role,value]):Control=>({key:'color.'+role,label:role,kind:'color',group:'colors',unit:'color',default:value,role,hint:role+' material',affects:['material'],targets:[role]})),
];
function save(input:unknown):Design {const requested={...plainRecord(input)};return {formatVersion:1,family:'rigged-rabbit',familyVersion:'1.0.0',requested,applied:parseControls(controls,requested)};}
function load(input:unknown):Design {return loadConstructionDesign(input,'rigged-rabbit','1.0.0',[],save,()=>{throw new Error('No earlier rabbit version');});}
const V=(x:number,y:number,z:number)=>new Vector3(x,y,z);
function build(input:unknown):RawRiggedBuild {
 const config=save(input),p=config.applied,L=Number(p.bodyLength),girth=({standard:1,stocky:1.18,lean:.84} as Record<string,number>)[String(p.build)]!,hz=Number(p.haunch),leg=Number(p.legRatio),hs=Number(p.headRatio),E=L*Number(p.earRatio),pawY=L*.02;
 const lift=(leg-1)*L*.22,root=new Group();root.name='rigged-rabbit';const bones:Bone[]=[],byName=new Map<string,Bone>(),points=new Map<string,Vector3>();
 function bone(name:string,point:Vector3,parent?:string){const node=new Bone();node.name=name;points.set(name,point);node.position.copy(point).sub(parent?points.get(parent)!:new Vector3());(parent?byName.get(parent)!:root).add(node);bones.push(node);byName.set(name,node);}
 const hipY=L*.6+lift,chestY=L*.46+lift*.8,headY=L*.8+lift*.8,headZ=L*.46;
 bone('motion_root',V(0,0,0));bone('pelvis',V(0,hipY,-L*.3),'motion_root');bone('spine',V(0,(hipY+chestY)/2,-L*.02),'pelvis');bone('chest',V(0,chestY,L*.24),'spine');bone('neck',V(0,chestY+L*.16,L*.34),'chest');bone('head',V(0,headY,headZ),'neck');
 for(const [s,side] of [['l',1],['r',-1]] as const)bone('ear_'+s,V(side*L*(p.earStyle==='lop'?.13:.075)*hs,headY+L*(p.earStyle==='lop'?.1:.15)*hs,headZ-L*.03),'head');
 const tail=['tail_base','tail_mid_a','tail_mid_b','tail_tip'];tail.forEach((name,i)=>bone(name,V(0,hipY-L*.06+i*L*.025,-L*(.6+i*.035)),i?tail[i-1]:'pelvis'));
 for(const [s,side] of [['l',1],['r',-1]] as const){
  const fx=side*L*.12*girth,hx=side*L*.17*girth*hz;
  bone('scapula_'+s,V(fx*.8,chestY+L*.04,L*.24),'chest');bone('front_upper_'+s,V(fx,chestY-L*.1,L*.28),'scapula_'+s);bone('front_lower_'+s,V(fx,L*.2*leg,L*.2),'front_upper_'+s);bone('front_paw_'+s,V(fx,pawY,L*.34),'front_lower_'+s);
  bone('hind_thigh_'+s,V(hx,hipY-L*.08,-L*.3),'pelvis');bone('hind_shin_'+s,V(hx,L*.26*leg,-L*.1),'hind_thigh_'+s);bone('hind_hock_'+s,V(hx,L*.06,-L*.34),'hind_shin_'+s);bone('hind_paw_'+s,V(hx,pawY,-L*.13),'hind_hock_'+s);
 }
 const index=(name:string)=>bones.indexOf(byName.get(name)!),parts:Record<FoxRole,ReturnType<typeof skinGeometry>[]>={fur:[],cream:[],dark:[]};
 const st=(center:Vector3,rx:number,ry:number,w:Array<[string,number]>,right?:Vector3):SkinStation=>({center,radiusX:rx,radiusY:ry,weights:w.map(([n,v])=>[index(n),v]),...(right?{right}:{})});
 const loft=(stations:SkinStation[],role:FoxRole|((t:number)=>FoxRole),flat=false,seg=8)=>partitionFoxSkin(parts,skinGeometry(stations.map(s=>({...s,right:s.right??V(1,0,0)})),seg,flat),role);
 const belly=(n:number)=>(t:number):FoxRole=>t<(n-1)*20&&[13,14,15,16].includes(Math.floor(t/2)%10)?'cream':'fur';
 // Body: big rounded haunch, narrower chest.
 const g=girth,body=[st(V(0,hipY-L*.04,-L*.62),L*.12*g,L*.12,[['pelvis',1]]),st(V(0,hipY-L*.08,-L*.5),L*.26*g*hz,L*.24*hz,[['pelvis',1]]),st(V(0,hipY-L*.1,-L*.32),L*.3*g*hz,L*.29*hz,[['pelvis',1]]),st(V(0,(hipY+chestY)/2-L*.1,-L*.08),L*.25*g,L*.26,[['pelvis',.4],['spine',.6]]),st(V(0,chestY-L*.06,L*.16),L*.2*g,L*.22,[['spine',.3],['chest',.7]]),st(V(0,chestY,L*.32),L*.15*g,L*.17,[['chest',1]]),st(V(0,chestY+L*.1,L*.38),L*.1*g,L*.11,[['chest',.5],['neck',.5]])];
 loft(body,belly(body.length),false,10);
 // Head: round skull, cheeks, short muzzle, nose.
 const H=hs,head=[st(V(0,headY-L*.06*H,headZ-L*.1*H),L*.1*H,L*.11*H,[['neck',1]]),st(V(0,headY,headZ-L*.03*H),L*.16*H,L*.15*H,[['head',1]]),st(V(0,headY-L*.01*H,headZ+L*.07*H),L*.15*H,L*.13*H,[['head',1]]),st(V(0,headY-L*.035*H,headZ+L*.15*H),L*.09*H,L*.085*H,[['head',1]]),st(V(0,headY-L*.045*H,headZ+L*.19*H),L*.035*H,L*.035*H,[['head',1]])];
 loft(head,'fur');
 // Neck bridges the chest into the back of the skull.
 loft([st(V(0,chestY-L*.02,L*.26),L*.15*g,L*.17,[['chest',1]]),st(V(0,(chestY+headY)/2,L*.33),L*.12*g*H,L*.13*H,[['chest',.4],['neck',.6]]),st(V(0,headY-L*.03*H,headZ-L*.06*H),L*.12*H,L*.12*H,[['neck',.4],['head',.6]])],'fur');
 for(const s of [-1,1]){loft([st(V(s*L*.06*H,headY-L*.07*H,headZ+L*.1*H),L*.05*H,L*.04*H,[['head',1]]),st(V(s*L*.06*H,headY-L*.075*H,headZ+L*.16*H),L*.04*H,L*.035*H,[['head',1]])],'cream');
  const eye=V(s*L*.125*H,headY+L*.03*H,headZ+L*.07*H),n=V(s*.85,.1,.45).normalize();loft([st(eye.clone().addScaledVector(n,-L*.02),L*.025*H,L*.03*H,[['head',1]],V(0,0,-1)),st(eye.clone().addScaledVector(n,L*.012),L*.028*H,L*.034*H,[['head',1]],V(0,0,-1)),st(eye.clone().addScaledVector(n,L*.02),L*.012*H,L*.015*H,[['head',1]],V(0,0,-1))],'dark');}
 loft([st(V(0,headY-L*.035*H,headZ+L*.18*H),L*.02*H,L*.016*H,[['head',1]]),st(V(0,headY-L*.03*H,headZ+L*.215*H),L*.012*H,L*.01*H,[['head',1]])],'dark');
 // Ears.
 for(const [s,side] of [['l',1],['r',-1]] as const){
  const o=points.get('ear_'+s)!,style=String(p.earStyle),dir=(style==='lop'?V(side*.42,-1,.12):style==='swept'?V(side*.18,.8,-.6):V(side*.22,1,-.12)).normalize(),flatAxis=V(0,0,1).cross(dir).normalize().multiplyScalar(-side);
  const right=style==='lop'?V(0,0,1).addScaledVector(dir,-dir.z).normalize():V(side,0,0).addScaledVector(dir,-dir.x*side).normalize();void flatAxis;
  const ear=[[-.15,.36,.3],[.15,.6,.36],[.45,.7,.4],[.75,.55,.33],[.92,.3,.25],[1,.06,.08]].map(([t,w,th])=>st(o.clone().addScaledVector(dir,E*t!),E*.16*w!,E*.16*th!*.55,[['ear_'+s,1]],right));
  // Lop ears hang down, so their t=-0.15 root ran up out of the skull as a flat-cut stub. They start instead with a small rounded
  // station halfway to the head centre (deep inside the skull) and a full-width one at the bone.
  const headCentre=points.get('head')!,prof=style==='lop'?[st(o.clone().lerp(headCentre,.5),E*.16*.12,E*.16*.1,[['ear_'+s,1]],right),st(o.clone().lerp(headCentre,.25),E*.16*.36,E*.16*.3*.55,[['ear_'+s,1]],right),...ear.slice(1)]:ear;
  const tips=!!p.earTips;loft(prof,t=>tips&&t>=4*16&&t<5*16+0?'dark':tips&&t>=80?'dark':'fur');
  // The lop's inner ear sits on the ear's thickness normal (outward), not along its width, where it used to lie on the fur's edge.
  const lopN=dir.clone().cross(right).normalize(),facing=(style==='lop'?lopN.multiplyScalar(Math.sign(lopN.x*side)||1):V(0,0,1)).normalize(),inner=[.12,.4,.7,.88].map((t,i)=>{
   // Lop: the panel is sized from the ear's own half-thickness h at each station. It spans 0.3 h to 1.2 h on the outer side, so it
   // shows 0.2 h proud and its back stays well inside the shell (at a fixed E*0.03 it crossed the thin tip to the far face).
   const h=E*.16*.55*[.354,.393,.342,.274][i]!;
   return style==='lop'?st(o.clone().addScaledVector(dir,E*t).addScaledVector(facing,h*.75),E*.16*[.3,.5,.4,.18][i]!,h*.45,[['ear_'+s,1]],right):st(o.clone().addScaledVector(dir,E*t).addScaledVector(facing,E*.02),E*.16*[.3,.5,.4,.18][i]!,E*.03,[['ear_'+s,1]],right);});
  loft(inner,'cream',false,6);
 }
 // Cotton tail.
 const tp=tail.map(n=>points.get(n)!);loft([st(tp[0]!.clone().add(V(0,0,L*.04)),L*.05,L*.05,[['tail_base',1]]),st(tp[1]!,L*.1,L*.1,[['tail_mid_a',1]]),st(tp[2]!,L*.1,L*.095,[['tail_mid_b',1]]),st(tp[3]!.clone().add(V(0,0,-L*.03)),L*.04,L*.04,[['tail_tip',1]])],'cream');
 // Legs.
 const limb=(names:string[],radii:number[],role:FoxRole)=>{const stations:SkinStation[]=[];
  for(let i=0;i<names.length-1;i++){const a=points.get(names[i]!)!,b=points.get(names[i+1]!)!;
   for(const t of i===0?[0,.5]:[0,.5]){const c=a.clone().lerp(b,t),r=radii[i]!+(radii[i+1]!-radii[i]!)*t,w:Array<[string,number]>=t===0&&i>0?[[names[i-1]!,.5],[names[i]!,.5]]:[[names[i]!,1]];stations.push(st(c,r,r*.9,w));}}
  stations.push(st(points.get(names.at(-1)!)!.clone().add(V(0,L*.02,0)),radii.at(-1)!,radii.at(-1)!*.9,[[names.at(-2)!,.5],[names.at(-1)!,.5]]));loft(stations,role);};
 for(const [s,side] of [['l',1],['r',-1]] as const){
  limb(['front_upper_'+s,'front_lower_'+s,'front_paw_'+s],[L*.095*g,L*.065,L*.05],'fur');
  const fp=points.get('front_paw_'+s)!;loft([st(V(fp.x,L*.02,fp.z-L*.03),L*.04,L*.025,[['front_paw_'+s,1]]),st(V(fp.x,L*.02,fp.z+L*.03),L*.045,L*.028,[['front_paw_'+s,1]]),st(V(fp.x,L*.018,fp.z+L*.07),L*.03,L*.018,[['front_paw_'+s,1]])],'cream',true);
  // Big folded haunch over the thigh, then the long hind foot along the ground.
  const th=points.get('hind_thigh_'+s)!,sh=points.get('hind_shin_'+s)!,hk=points.get('hind_hock_'+s)!,hp=points.get('hind_paw_'+s)!;
  loft([st(th.clone().add(V(-side*L*.04,L*.06,-L*.06)),L*.1*hz,L*.12*hz,[['hind_thigh_'+s,1]]),st(th.clone().lerp(sh,.4),L*.13*hz,L*.17*hz,[['hind_thigh_'+s,1]]),st(sh.clone().add(V(0,0,-L*.04)),L*.08*hz,L*.1*hz,[['hind_thigh_'+s,.5],['hind_shin_'+s,.5]]),st(sh.clone().lerp(hk,.5),L*.05,L*.055,[['hind_shin_'+s,1]]),st(hk.clone().add(V(0,L*.02,0)),L*.045,L*.045,[['hind_shin_'+s,.5],['hind_hock_'+s,.5]]),st(V(hk.x,L*.032,hk.z+L*.012),L*.04,L*.034,[['hind_hock_'+s,1]])],'fur');
  // Hock joint: the fur leg runs on past the hock into the foot (last ring on the hock bone), and the foot's heel ring starts inside the
  // leg end with the same shin/hock blend, so leg and foot rotate together and the heel can't open a gap when the hock flexes.
  loft([st(V(hk.x,L*.045,hk.z-L*.03),L*.04,L*.032,[['hind_shin_'+s,.5],['hind_hock_'+s,.5]]),st(V(hk.x,L*.03,hk.z-L*.005),L*.047,L*.03,[['hind_hock_'+s,1]]),st(V(hk.x,L*.03,(hk.z+hp.z)/2),L*.055,L*.032,[['hind_hock_'+s,.5],['hind_paw_'+s,.5]]),st(V(hp.x,L*.025,hp.z),L*.05,L*.026,[['hind_paw_'+s,1]]),st(V(hp.x,L*.02,hp.z+L*.05),L*.03,L*.018,[['hind_paw_'+s,1]])],'cream',true);
 }
 root.updateMatrixWorld(true);const skeleton=new Skeleton(bones);skeleton.calculateInverses();const materials:Record<string,MeshStandardMaterial>={};
 for(const role of ['fur','cream','dark'] as const){const material=new MeshStandardMaterial({name:role,color:String(p['color.'+role]),roughness:.92,flatShading:true});materials[role]=material;const mesh=new SkinnedMesh(combineSkins(parts[role]),material);mesh.name='rabbit-'+role;mesh.userData.materialRole=role;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);mesh.bind(skeleton);}
 root.updateMatrixWorld(true);skeleton.update();const chains=[] as RigMetadata['chains'],effectors=[] as NonNullable<RigMetadata['effectors']>;
 for(const s of ['l','r'])for(const pair of ['front','hind']){const upper=(pair==='front'?'front_upper_':'hind_thigh_')+s,lower=(pair==='front'?'front_lower_':'hind_shin_')+s,end=(pair==='front'?'front_paw_':'hind_hock_')+s,paw=pair+'_paw_'+s;chains.push({upper,lower,end,side:s==='l'?'left':'right'});effectors.push({id:pair+'_'+s,bone:paw,chain:upper,offset:points.get(end)!.clone().sub(points.get(paw)!).toArray() as [number,number,number],groundOffset:pawY});}
 const bounds=new Box3().setFromObject(root),anchors={ground:[0,0,0],head:points.get('head')!.toArray()},rig:RigMetadata={version:1,kind:'fox',bones:bones.map(node=>({name:node.name,parent:node.parent instanceof Bone?node.parent.name:null})),meshes:['rabbit-fur','rabbit-cream','rabbit-dark'],chains,effectors,clips:[]};
 root.userData={configuration:config,units:'meters',up:'+Y',forward:'+Z',origin:'ground-center',anchors};
 return {root,config,materials,bounds,dimensions:bounds.getSize(new Vector3()),anchors,rig};
}
export const rabbitRecipe:Recipe={descriptor:{id:'rigged-rabbit',version:'1.0.0',title:'Stylized rabbit',description:'Original rigged rabbit with big folded haunches, long hind feet, long ears and a cotton tail; idle and walk clips.',controls,defaults:parseControls(controls,{}),
 presets:[{id:'cottontail',name:'Cottontail',description:'Brown wild rabbit with upright ears and a white cotton tail.',parameters:{}},
  {id:'lop',name:'Lop rabbit',description:'Stocky grey-and-white pet rabbit with lop ears hanging beside a big head.',parameters:{earStyle:'lop',build:'stocky',earRatio:.7,headRatio:1.15,haunch:1.15,legRatio:.85,bodyLength:.32,'color.fur':'#8f8f93','color.cream':'#f4f2ee','color.dark':'#262426'}},
  {id:'hare',name:'Hare',description:'Lean long-legged tawny hare with long swept ears and black tips.',parameters:{earStyle:'swept',build:'lean',earRatio:1,legRatio:1.28,haunch:.95,headRatio:.92,bodyLength:.46,earTips:true,'color.fur':'#b98a52','color.cream':'#efe3cb','color.dark':'#221d1a'}}],
 palettes:[],save,state:input=>parameterState(controls,input)},build,load,
 validationCases:[{id:'default',name:'Default proportions',parameters:{}},{id:'lop',name:'Lop stocky',parameters:{earStyle:'lop',build:'stocky'}},{id:'hare',name:'Swept lean tall',parameters:{earStyle:'swept',build:'lean',legRatio:1.3,earRatio:1.05}}],integrationCases:[],
 constraints:['Flat-ground paw contact only','Shares the four-paw quadruped rig contract with the fox'],presentation:{category:'Animals',order:475,kitIds:[]},source:{entry:'src/recipes/rigged.ts',exportName:'rabbitRecipe'}};

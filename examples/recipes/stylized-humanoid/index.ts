import { loadConstructionDesign } from '../../../src/engine/construction-migration.ts';
import { Bone,Box3,Group,MeshStandardMaterial,Skeleton,SkinnedMesh,Vector3 } from 'three';
import { parseControls,parameterState,plainRecord } from '../../../src/engine/parameters.ts';
import type { Control,Design,Parameters } from '../../../src/engine/parameters.ts';
import type { Recipe } from '../../../src/recipes/types.ts';
import type { RawRiggedBuild,RigMetadata } from '../../../src/rigging/types.ts';
import { combineSkins,skinGeometry,skinBand,skinPolyhedron,type SkinStation } from '../../../src/rigging/skin.ts';

const numbers=[['height','Height',1.2,2.2,1.7],['headRatio','Head proportion',.14,.22,.18],['shoulderRatio','Shoulder width',.22,.32,.27],['hipRatio','Hip width',.16,.24,.2],['legRatio','Leg length',.43,.53,.48],['armRatio','Arm length',.32,.4,.36],['limbRatio','Limb radius',.035,.065,.045]] as const;
const colors={skin:'#c49375',tunic:'#657764',boots:'#473c36',hair:'#3b302b'};
const controls10:Control[]=[...numbers.map(([key,label,min,max,value]):Control=>({key,label,kind:'range',group:'shape',unit:key==='height'?'m':'ratio',min,max,step:.005,default:value,hint:label,affects:['geometry'],targets:['body','skeleton']})),...Object.entries(colors).map(([role,value]):Control=>({key:'color.'+role,label:role,kind:'color',group:'colors',unit:'color',default:value,role,hint:role+' material',affects:['material'],targets:[role]}))];
const choice=(key:string,label:string,options:string[],hint:string):Control=>({key,label,kind:'choice',group:'construction',unit:'none',default:options[0]!,options:options.map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)})),hint,affects:['geometry'],targets:['body']});
const controls:Control[]=[...controls10.slice(0,numbers.length),
  choice('build','Build',['average','slender','sturdy'],'Torso and limb girth; the skeleton joints stay where height and ratios put them.'),
  choice('hair','Hair',['short','bun','crest'],'Short cap, a tied bun at the back, or a raised crest.'),
  choice('tunic','Tunic',['short','long'],'Hip-length tunic or a long robe hem above the knee.'),
  ...controls10.slice(numbers.length)];
function save10(input:unknown):Design {const requested={...plainRecord(input)};return {formatVersion:1,family:'stylized-humanoid',familyVersion:'1.0.0',requested,applied:parseControls(controls10,requested)};}
function load10(input:unknown):Design {return loadConstructionDesign(input,'stylized-humanoid','1.0.0',[],save10,()=>{throw new Error('No prior humanoid version');});}
function save(input:unknown):Design {const requested={...plainRecord(input)};return {formatVersion:1,family:'stylized-humanoid',familyVersion:'1.1.0',requested,applied:parseControls(controls,requested)};}
function load(input:unknown):Design {return loadConstructionDesign(input,'stylized-humanoid','1.1.0',['1.0.0'],save,load10);}

function build(input:unknown):RawRiggedBuild {
  const config=save(input),p=config.applied as Parameters,h=Number(p.height),hipY=h*Number(p.legRatio),headH=h*Number(p.headRatio),shoulderY=h-headH-h*.065,hipX=h*Number(p.hipRatio)*.38,sturdy=p.build==='sturdy',shoulderX=h*Number(p.shoulderRatio)/2*(sturdy?1.16:1),armGirth=sturdy?1.35:1,girth=({average:1,slender:.82,sturdy:1.22} as Record<string,number>)[String(p.build)]!,r=h*Number(p.limbRatio)*girth,hem=p.tunic==='long'?.24:.1,ankleY=.055*h;
  const root=new Group();root.name='stylized-humanoid';
  const bones:Bone[]=[],points=new Map<string,Vector3>(),byName=new Map<string,Bone>();
  function bone(name:string,point:Vector3,parent?:string){const node=new Bone();node.name=name;points.set(name,point);const ancestor=parent?byName.get(parent)!:root;node.position.copy(point).sub(parent?points.get(parent)!:new Vector3());ancestor.add(node);bones.push(node);byName.set(name,node);return node;}
  bone('motion_root',new Vector3());bone('hips',new Vector3(0,hipY,0),'motion_root');bone('spine',new Vector3(0,hipY+(shoulderY-hipY)*.45,0),'hips');bone('chest',new Vector3(0,shoulderY,0),'spine');bone('neck',new Vector3(0,h-headH,0),'chest');bone('head',new Vector3(0,h-headH*.75,0),'neck');
  for(const [suffix,side] of [['l',1],['r',-1]] as const){
    const upper=new Vector3(side*shoulderX,shoulderY,0),length=Number(p.armRatio)*h,elbow=upper.clone().add(new Vector3(side*.45,-Math.sqrt(1-.45**2),0).multiplyScalar(length*.55)),wrist=elbow.clone().add(new Vector3(side*.2,-Math.sqrt(1-.2**2),0).multiplyScalar(length*.45));
    bone('upper_arm_'+suffix,upper,'chest');bone('forearm_'+suffix,elbow,'upper_arm_'+suffix);bone('hand_'+suffix,wrist,'forearm_'+suffix);
    bone('thigh_'+suffix,new Vector3(side*hipX,hipY,0),'hips');bone('shin_'+suffix,new Vector3(side*hipX,ankleY+(hipY-ankleY)*.51,h*.04),'thigh_'+suffix);bone('foot_'+suffix,new Vector3(side*hipX,ankleY,0),'shin_'+suffix);bone('toe_'+suffix,new Vector3(side*hipX,h*.025,h*.09),'foot_'+suffix);
  }
  const index=(name:string)=>bones.indexOf(byName.get(name)!);
  const parts:Record<string,ReturnType<typeof skinGeometry>[]>={skin:[],tunic:[],boots:[],hair:[],face:[]};
  function loft(role:string,stations:SkinStation[],flat=false,caps:{start?:boolean;end?:boolean}={}){parts[role]!.push(skinGeometry(stations,8,flat,caps));}
  function station(center:Vector3,rx:number,ry:number,name:string):SkinStation{return {center,radiusX:rx,radiusY:ry,weights:[[index(name),1]]};}
  function limb(role:string,names:[string,string,string],radius:number){
    const [a,b,c]=names.map(name=>points.get(name)!) as [Vector3,Vector3,Vector3],first=a.distanceTo(b),second=b.distanceTo(c),total=first+second,blend=Math.min(first,second)*.3;
    const distances=[0,first*.4,first-blend,first-blend*.5,first,first+blend*.5,first+blend,first+second*.65,total];
    const stations=distances.map((distance):SkinStation=>{
      const center=distance<=first?a.clone().lerp(b,distance/first):b.clone().lerp(c,(distance-first)/second),upper=Math.max(0,Math.min(1,(first+blend-distance)/(2*blend)));
      return {center,radiusX:radius*(1-.4*distance/total),radiusY:radius*(.9-.35*distance/total),weights:[[index(names[1]),1-upper],[index(names[0]),upper]]};
    });loft(role,stations);return stations;
  }
  const tunicProfile=[
    // Non-default builds keep the tunic outside the thigh tops (sturdy legs cut through the hem); 'average' keeps its accepted geometry.
    station(new Vector3(0,hipY-h*hem,0),Math.max(h*Number(p.hipRatio)*(p.tunic==='long'?.8:.62)*girth,p.build==='average'?0:hipX+r*1.3),h*(p.tunic==='long'?.14:.11),'hips'),
    // Depth must clear the thigh front where it sits off-centre (at x=hipX an r*1.08 ellipse is shallower than the thigh: the monk's thigh poked through).
    station(new Vector3(0,hipY,0),Math.max(h*Number(p.hipRatio)*.52*girth,p.build==='average'?0:hipX+r*1.25),Math.max(h*.09*girth,p.build==='average'?0:r*1.12/Math.sqrt(1-(hipX/(hipX+r*1.25))**2)),'hips'),
    station(new Vector3(0,hipY+(shoulderY-hipY)*.4,0),h*Number(p.shoulderRatio)*.43*girth,h*.095*girth,'spine'),
    station(new Vector3(0,shoulderY-h*.025,0),shoulderX+r*.2,h*.105*(sturdy?1.25:1),'chest'),
    station(new Vector3(0,shoulderY+h*.02,0),shoulderX*.78,h*.08,'chest'),
    station(new Vector3(0,shoulderY+h*.033,0),h*.056,h*.052,'chest'),
    station(new Vector3(0,shoulderY+h*.045,0),h*.049,h*.047,'chest'),
  ];
  loft('tunic',tunicProfile); // capped at the collar so the neck seats inside a closed body
  function between(a:SkinStation,b:SkinStation,t:number):SkinStation {
    const weights=new Map<number,number>();for(const [bone,weight] of a.weights)weights.set(bone,(weights.get(bone)??0)+weight*(1-t));for(const [bone,weight] of b.weights)weights.set(bone,(weights.get(bone)??0)+weight*t);
    return {center:a.center.clone().lerp(b.center,t),radiusX:a.radiusX+(b.radiusX-a.radiusX)*t,radiusY:a.radiusY+(b.radiusY-a.radiusY)*t,weights:[...weights]};
  }
  function atHeight(profile:SkinStation[],y:number):SkinStation {const next=profile.findIndex(station=>station.center.y>=y),a=profile[Math.max(0,next-1)]!,b=profile[Math.max(1,next)]!;return between(a,b,(y-a.center.y)/(b.center.y-a.center.y));}
  function edging(profile:SkinStation[],padding=h*.0035,thickness=h*.0045){parts.boots!.push(skinBand(profile.map(station=>({...station,radiusX:station.radiusX+padding,radiusY:station.radiusY+padding})),thickness));}
  edging([atHeight(tunicProfile,hipY+h*.025),atHeight(tunicProfile,hipY+h*.045)]);
  edging([atHeight(tunicProfile,hipY-h*(hem+.003)),atHeight(tunicProfile,hipY-h*(hem-.008))]); // hem band wraps the tunic's lower edge and hangs 3 mm-per-metre below the capped hem (a tunic sliver showed under it); never shares the hem plane
  parts.boots!.push(skinBand([station(new Vector3(0,shoulderY+h*.032,0),h*.058,h*.054,'chest'),station(new Vector3(0,shoulderY+h*.049,0),h*.052,h*.05,'chest')],h*.004)); // collar band top 0.4% of height above the capped collar (at 0.2% it lay within the 3 mm z-fight band of the cap)
  // Neck: the foot is seated inside the capped tunic and the top is wider than the jaw ring, so it cuts through the head wall
  // (it used to sit wholly inside the open collar and the open head, touching neither).
  loft('skin',[station(new Vector3(0,shoulderY+h*.01,0),h*.042,h*.04,'neck'),station(new Vector3(0,h-headH*.95,0),h*.045,h*.04,'neck'),station(new Vector3(0,h-headH*.84,0),headH*.31,headH*.27,'head')]);
  const headCenter=h-headH*.48,hairline=h-headH*.33;
  const headProfile=[
    station(new Vector3(0,h-headH*.9,0),headH*.28,headH*.24,'head'),
    station(new Vector3(0,headCenter-headH*.1,0),headH*.4,headH*.35,'head'),
    station(new Vector3(0,hairline,0),headH*.42,headH*.34,'head'),
  ];loft('skin',headProfile,false,{end:false});
  loft('hair',[
    station(new Vector3(0,hairline-headH*.08,0),headH*.34,headH*.27,'head'), // starts inside the skull and flares out through it (it met the head ring edge to edge)
    station(new Vector3(0,hairline,0),headH*.44,headH*.36,'head'),
    station(new Vector3(0,h-headH*.08,0),headH*.32,headH*.27,'head'),
    station(new Vector3(0,h,0),headH*.08,headH*.07,'head'),
  ],false,{start:false});
  if(p.hair==='bun')loft('hair',[station(new Vector3(0,h-headH*.3,-headH*.3),headH*.07,headH*.07,'head'),station(new Vector3(0,h-headH*.27,-headH*.42),headH*.15,headH*.14,'head'),station(new Vector3(0,h-headH*.25,-headH*.56),headH*.03,headH*.03,'head')]);
  if(p.hair==='crest')loft('hair',[station(new Vector3(0,h-headH*.12,headH*.22),headH*.03,headH*.03,'head'),station(new Vector3(0,h+headH*.06,headH*.02),headH*.07,headH*.12,'head'),station(new Vector3(0,h+headH*.02,-headH*.22),headH*.06,headH*.1,'head'),station(new Vector3(0,h-headH*.22,-headH*.38),headH*.02,headH*.03,'head')]);
  for(const side of [-1,1]){
    const x=side*headH*.17,y=h-headH*.46,section=atHeight(headProfile,y),z=section.radiusY*(1-(1-Math.SQRT1_2)*Math.abs(x)/(section.radiusX*Math.SQRT1_2));
    loft('face',[station(new Vector3(x,y,z-headH*.05),headH*.04,headH*.05,'head'),station(new Vector3(x,y,z+headH*.004),headH*.042,headH*.05,'head'),station(new Vector3(x,y,z+headH*.012),headH*.025,headH*.035,'head')]);
  }
  parts.skin!.push(skinPolyhedron([new Vector3(-headH*.05,h-headH*.73,headH*.22),new Vector3(headH*.05,h-headH*.73,headH*.22),new Vector3(headH*.0325,h-headH*.48,headH*.22),new Vector3(-headH*.0325,h-headH*.48,headH*.22),new Vector3(0,h-headH*.64,headH*.43)],[0,1,4,1,2,4,2,3,4,3,0,4,0,3,1,1,3,2],index('head')));
  for(const [suffix,side] of [['l',1],['r',-1]] as const){
    // Sturdy (brawler) also widens shoulders, deepens the chest, thickens arms and adds leather pauldrons and bracers.
    const arm=limb('skin',['upper_arm_'+suffix,'forearm_'+suffix,'hand_'+suffix],r*.72*armGirth);
    // Pauldron: a short sleeve cap built from the arm's own stations (same axis and weights), 1.25x the arm radius and lifted
    // 0.15 arm-radii, so it sits ON the shoulder and fully encloses the upper arm instead of floating beside it.
    if(sturdy){const ar=r*.72*armGirth,lift=new Vector3(0,ar*.15,0),cap=[-.6,0,1.2,2].map(t=>between(arm[0]!,arm[1]!,t)).map((st,i)=>({...st,center:st.center.clone().add(lift),radiusX:ar*[.8,1.3,1.28,1.05][i]!,radiusY:ar*[.8,1.3,1.28,1.05][i]!}));
      parts.boots!.push(skinGeometry(cap,8,false,{}));
      parts.boots!.push(skinBand([between(arm.at(-3)!,arm.at(-1)!,.15),between(arm.at(-3)!,arm.at(-1)!,.85)].map(s=>({...s,radiusX:s.radiusX+h*.0045,radiusY:s.radiusY+h*.0045})),h*.006));} /* bracer: inner face 1.5 mm-per-metre into the forearm (it floated 2 mm-per-metre off it) */const leg=limb('boots',['thigh_'+suffix,'shin_'+suffix,'foot_'+suffix],r);edging([between(leg.at(-2)!,leg.at(-1)!, .42),between(leg.at(-2)!,leg.at(-1)!, .72)],h*.004,h*.004);
    const hand=points.get('hand_'+suffix)!;
    const axis=new Vector3(side*.16,-Math.sqrt(1-.16**2),0),length=h*.065;
    loft('skin',[station(hand.clone(),r*.56,r*.38,'hand_'+suffix),station(hand.clone().addScaledVector(axis,length*.35).add(new Vector3(0,0,h*.002)),r*.76,r*.5,'hand_'+suffix),station(hand.clone().addScaledVector(axis,length*.68).add(new Vector3(0,0,h*.004)),r*.7,r*.42,'hand_'+suffix),station(hand.clone().addScaledVector(axis,length).add(new Vector3(0,0,h*.003)),r*.12,r*.1,'hand_'+suffix)]);
    const thumb=hand.clone().addScaledVector(axis,length*.27).add(new Vector3(-side*r*.3,0,r*.15));
    loft('skin',[station(thumb,r*.3,r*.25,'hand_'+suffix),station(thumb.clone().add(new Vector3(-side*r*.35,-length*.13,r*.08)),r*.27,r*.21,'hand_'+suffix),station(thumb.clone().add(new Vector3(-side*r*.45,-length*.24,r*.1)),r*.07,r*.06,'hand_'+suffix)]);
    loft('boots',[
      station(new Vector3(side*hipX,h*.03,-h*.045),r*.78,h*.047,'foot_'+suffix),
      station(new Vector3(side*hipX,h*.03,h*.02),r*.9,h*.047,'foot_'+suffix),
      station(new Vector3(side*hipX,h*.02,h*.12),r*.85,h*.033,'toe_'+suffix),
    ],true);
  }
  root.updateMatrixWorld(true);const skeleton=new Skeleton(bones);skeleton.calculateInverses();
  const materials:Record<string,MeshStandardMaterial>={};
  for(const role of Object.keys(parts)){
    const materialRole=role==='face'?'hair':role,material=materials[materialRole]??new MeshStandardMaterial({name:materialRole,color:String(p['color.'+materialRole]),roughness:.9,flatShading:true});materials[materialRole]=material;
    const mesh=new SkinnedMesh(combineSkins(parts[role]!),material);mesh.name='humanoid-'+role;mesh.userData.materialRole=materialRole;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);mesh.bind(skeleton);
  }
  root.updateMatrixWorld(true);skeleton.update();
  const bounds=new Box3().setFromObject(root),anchors={ground:[0,0,0],head:points.get('head')!.toArray()},rig:RigMetadata={version:1,kind:'humanoid',bones:bones.map(node=>({name:node.name,parent:node.parent instanceof Bone?node.parent.name:null})),meshes:Object.keys(parts).map(role=>'humanoid-'+role),chains:[{upper:'thigh_l',lower:'shin_l',end:'foot_l',side:'left'},{upper:'thigh_r',lower:'shin_r',end:'foot_r',side:'right'}],clips:[]};
  root.userData={configuration:config,units:'meters',up:'+Y',forward:'+Z',origin:'ground-center',anchors};return {root,config,materials,bounds,dimensions:bounds.getSize(new Vector3()),anchors,rig};
}
const defaults=parseControls(controls,{});
export const humanoidRecipe:Recipe={descriptor:{id:'stylized-humanoid',version:'1.1.0',title:'Stylized adventurer',description:'Original clothed humanoid with proportional anatomy and weighted joints.',controls,defaults,presets:[{id:'default',name:'Adventurer',description:'Neutral clothed adventurer.',parameters:{}},{id:'monk',name:'Robed monk',description:'Slender figure in a long robe with a tied bun.',parameters:{build:'slender',hair:'bun',tunic:'long','color.tunic':'#8a5a3c','color.hair':'#1f1b18'}},{id:'brawler',name:'Brawler',description:'Sturdy fighter with a crest and broad shoulders.',parameters:{build:'sturdy',hair:'crest',shoulderRatio:.31,headRatio:.16,'color.tunic':'#7a2f2a','color.hair':'#b8462a'}}],palettes:[],save,state:input=>parameterState(controls,input)},build,load,validationCases:[{id:'default',name:'Default proportions',parameters:{}},{id:'robe-bun',name:'Slender robe bun',parameters:{build:'slender',hair:'bun',tunic:'long'}},{id:'sturdy-crest',name:'Sturdy crest',parameters:{build:'sturdy',hair:'crest',height:2.2}},{id:'small-long',name:'Small long robe',parameters:{height:1.2,tunic:'long',hair:'crest'}}],integrationCases:[],constraints:['Flat ground contact only','No fingers, face animation or retargeting'],presentation:{category:'Characters',order:170,kitIds:[]},source:{entry:'examples/recipes/stylized-humanoid/index.ts',exportName:'humanoidRecipe'}};

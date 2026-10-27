import {loadConstructionDesign} from '../../../src/engine/construction-migration.ts';
import {load as loadPrior} from '../../../src/recipes/legacy-v1/planter.ts';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { profileSolid } from '../../../src/engine/geometry.ts';
import { parseControls, parameterState, plainRecord } from '../../../src/engine/parameters.ts';
import type { Control, Design, Descriptor, Parameters } from '../../../src/engine/parameters.ts';
import type { AssetBuild } from '../../../src/catalog/types.ts';
import type { Recipe, RecipeCase } from '../../../src/recipes/types.ts';

const palette = {
  oak: { wood: '#b88654', frame: '#604532' },
  painted: { wood: '#8ca58b', frame: '#384a42' },
};
// Fill colors are fixed (not palette roles): the default empty box must keep its accepted palette.
const fillColors = { soil: '#4a3628', plant: '#5f8c3e'
};
const controls: Control[] = [
  ...(['width','depth','height'] as const).map(key => ({key,label:key,kind:'range' as const,group:'shape' as const,unit:'m' as const,min:key==='width'?0.6:key==='depth'?0.3:0.25,max:key==='width'?1.8:key==='depth'?0.8:0.85,step:0.05,default:key==='width'?1.1:key==='depth'?0.5:0.5,hint:'Outside '+key+' in meters.',affects:['geometry' as const],targets:['wall','post','floor','foot','rim']})),
  {key:'boardCount',label:'Wall boards',kind:'integer',group:'construction',unit:'count',min:2,max:5,step:1,default:3,hint:'Horizontal board courses with small gaps.',affects:['topology'],targets:['wall','post','floor','foot','rim']},
  {key:'feet',label:'Raised feet',kind:'toggle',group:'construction',unit:'none',default:true,hint:'Adds four ground-supported feet below the floor.',affects:['topology'],targets:['wall','post','floor','foot','rim']},
  {key:'footPads',label:'Foot pads',kind:'toggle',group:'construction',unit:'none',default:false,hint:'Feet 9 mm wider than the posts, so the post/foot joint reads as a step instead of a flush seam.',affects:['geometry'],targets:['foot']},
  {key:'fill',label:'Fill',kind:'choice',group:'construction',unit:'none',default:'none',options:[{value:'none',label:'Empty'},{value:'soil',label:'Soil'},{value:'planted',label:'Soil and plants'}],hint:'Empty box, a soil fill 3 cm below the rim, or soil with low plant tufts.',affects:['topology'],targets:['soil','plant']},
  {key:'colorway',label:'Palette',kind:'choice',group:'colors',unit:'none',default:'oak',options:[{value:'oak',label:'Oak'},{value:'painted',label:'Painted'}],hint:'Board and post colors.',affects:['material'],targets:['wood','frame','rim']},
  {key:'color.wood',label:'Boards',kind:'color',group:'colors',unit:'color',default:palette.oak.wood,role:'wood',hint:'Walls and floor.',affects:['material'],targets:['wall','floor','rim']},
  {key:'color.frame',label:'Posts',kind:'color',group:'colors',unit:'color',default:palette.oak.frame,role:'frame',hint:'Posts and feet.',affects:['material'],targets:['post','foot']},
];
// 1.1.0 had no fill and no soil/plant colors.
const v11Controls=controls.filter(c=>!['footPads','fill'].includes(c.key));

function parse(input: unknown, list: Control[] = controls): Parameters {
  const value = plainRecord(input);
  const checked = parseControls(list, value);
  const colors = palette[checked.colorway as keyof typeof palette];
  for (const role of ['wood','frame'] as const) if (!Object.hasOwn(value, 'color.' + role)) checked['color.' + role] = colors[role];
  return checked;
}

function save(input: unknown): Design {
  const requested = { ...plainRecord(input) };
  return { formatVersion:1, family:"planter", familyVersion:'1.2.0', requested, applied:parse(requested) };
}

function load(input:unknown):Design {
  return loadConstructionDesign(input,'planter','1.2.0',['1.0.0','1.1.0'],save,loadV11);
}
function loadV11(input:unknown):Design {
  const v=plainRecord(input);
  if(v.familyVersion==='1.0.0')return loadPrior(input);
  const requested={...plainRecord(v.requested)},applied=parse(requested,v11Controls),stored=plainRecord(v.applied);
  if(Object.keys(stored).length!==Object.keys(applied).length||Object.entries(applied).some(([k,x])=>stored[k]!==x))throw new Error('Planter 1.1.0 applied parameters mismatch');
  return {formatVersion:1,family:'planter',familyVersion:'1.1.0',requested,applied};
}

function build(input: unknown): AssetBuild {
  const config = save(input), p = config.applied;
  const width = Number(p.width), depth = Number(p.depth), height = Number(p.height), count = Number(p.boardCount);
  const root = new Group(); root.name = 'planter';
  const materials = Object.fromEntries(['wood','frame',...(p.fill==='none'?[]:['soil']),...(p.fill==='planted'?['plant']:[])].map(role => [role, new MeshStandardMaterial({name:role,color:String(p['color.'+role]??fillColors[role as keyof typeof fillColors]),roughness:0.9,flatShading:true})]));
  const bottom = p.feet ? 0.10 : 0;
  const anchors = {ground:[0,0,0],opening:[0,height,0]};
  root.userData = {configuration:config,units:'meters',up:'+Y',forward:'+Z',origin:'ground-center',anchors};
  const availableCourse = (height-bottom-0.04-(count-1)*0.006)/count;
  const rimHeight = Math.min(0.028,availableCourse*0.3), bodyTop = height-rimHeight, postSeat = Math.min(0.006,rimHeight*0.5);
  function part(name:string,role:string,size:[number,number,number],position:[number,number,number],taper=true) {
    const [w,h,d] = size, ease = Math.min(0.002,h*0.1,w*0.08,d*0.08);
    const geometry = profileSolid([
      {y:-h/2,width:w-2*ease,depth:d-2*ease,chamfer:ease},
      {y:-h/2+ease,width:w,depth:d,chamfer:ease},
      {y:h/2-ease,width:w,depth:d,chamfer:ease},
      {y:h/2,width:w-2*ease,depth:d-2*ease,chamfer:ease},
    ]);
    geometry.translate(...position);
    if(taper) {
      const vertices=geometry.getAttribute('position');
      for(let i=0;i<vertices.count;i++) {
        const inset=0.014*(1-Math.max(0,Math.min(1,(vertices.getY(i)-bottom)/(bodyTop-bottom))));
        vertices.setX(i,vertices.getX(i)*(width-2*inset)/width);
        vertices.setZ(i,vertices.getZ(i)*(depth-2*inset)/depth);
      }
      geometry.computeVertexNormals();
    }
    geometry.translate(-position[0],-position[1],-position[2]);
    const mesh = new Mesh(geometry,materials[role]);
    mesh.name=name; mesh.userData={materialRole:role}; mesh.position.set(...position); mesh.castShadow=true; mesh.receiveShadow=true; root.add(mesh);
  }
  // Posts sink 4 mm into their feet so a post bottom is never coplanar with the floor underside (z-fighting).
  const sink=p.feet?0.004:0,footW=p.footPads?0.064:0.047; // pads 4.5 mm wider than the post on each side, plain feet 4 mm narrower (inside the outside dimensions), so the post/foot joint is a visible step, not a coplanar seam
  for (const x of [-1,1]) for (const z of [-1,1]) {
    part('post-'+x+'-'+z,'frame',[0.055,bodyTop-bottom+postSeat+sink,0.055],[x*(width/2-0.0275),(bodyTop+bottom+postSeat-sink)/2,z*(depth/2-0.0275)]);
    if(p.feet) part('foot-'+x+'-'+z,'frame',[footW,bottom+0.003,footW],[x*(width/2-0.0275),(bottom+0.003)/2,z*(depth/2-0.0275)]);
  }
  const boardHeight=(bodyTop+0.002-bottom-0.04-(count-1)*0.006)/count;
  for(let i=0;i<count;i++) {
    const y=bottom+0.04+boardHeight/2+i*(boardHeight+0.006);
    for(const side of [-1,1]) {
      part('wall-'+(side===1?'front':'rear')+'-'+i,'wood',[width-0.102,boardHeight,0.035],[0,y,side*(depth/2-0.0175)]);
      part('wall-'+(side===1?'right':'left')+'-'+i,'wood',[0.035,boardHeight,depth-0.102],[side*(width/2-0.0175),y,0]);
    }
  }
  part('floor','wood',[width-0.025,0.042,depth-0.025],[0,bottom+0.021,0]);
  for(const side of [-1,1]) {
    // The rim's outer face sits 4 mm inside the wall face (the top board runs up past it), so the outside dimensions stay exact;
    // flush, the top board's outer face lay on the rim's outer face and z-fought.
    part('rim-'+(side===1?'front':'rear'),'wood',[width-0.008,rimHeight+0.004,0.061],[0,height-(rimHeight+0.004)/2,side*(depth/2-0.0345)],false);
    part('rim-'+(side===1?'right':'left'),'wood',[0.061,rimHeight+0.004,depth-0.124],[side*(width/2-0.0345),height-(rimHeight+0.004)/2,0],false);
  }
  if(p.fill!=='none'){
    // Soil sits on the floor and stops 3 cm below the rim; it is inset 3 mm from the wall faces so no face is shared.
    const soilTop=height-rimHeight-0.03,soilBase=bottom+0.03;
    part('soil','soil',[width-0.076,soilTop-soilBase,depth-0.076],[0,(soilTop+soilBase)/2,0],false);
    if(p.fill==='planted'){
      const cols=Math.max(2,Math.round((width-0.15)/0.2)),rows=depth>=0.5?2:1;
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const x=-(width-0.15)/2+(c+0.5)*(width-0.15)/cols+(r%2?0.04:-0.04),z=rows===1?0:(r?1:-1)*(depth-0.076)/5,tall=0.1+0.05*((c*7+r*3)%4)/3,spread=0.05+0.02*((c+r)%3)/2;
        const g=profileSolid([{y:-0.012,width:spread*0.7,depth:spread*0.7,chamfer:0.004},{y:tall*0.35,width:spread*2,depth:spread*1.7,chamfer:spread*0.5},{y:tall,width:0.006,depth:0.006,chamfer:0.001}]);
        g.rotateY((c*1.3+r*0.7)%Math.PI);g.translate(x,soilTop,z);
        const mesh=new Mesh(g,materials.plant);mesh.name='plant-'+r+'-'+c;mesh.userData={materialRole:'plant'};mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
      }
    }
  }
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root,true);
  return { root, config, materials, anchors, bounds, dimensions:bounds.getSize(new Vector3()) };
}

const presets: Descriptor['presets'] = [
  {id:'raised-box',name:'Raised box',description:'Three oak board courses with four raised feet.',parameters:{}},
  {id:'herb-trough',name:'Herb trough',description:'A low long oak box resting on the ground.',parameters:{width:1.5,depth:0.4,height:0.3,boardCount:2,feet:false}},
  {id:'patio-box',name:'Patio box',description:'A tall square painted planter on feet.',parameters:{width:0.7,depth:0.7,height:0.8,boardCount:5,feet:true,colorway:'painted'}},
];
const boundaries: RecipeCase[] = controls.flatMap(c => c.kind === 'range' || c.kind === 'integer' ? [
  {id:c.key.toLowerCase()+'-min',name:c.label+' minimum',parameters:{[c.key]:c.min}},
  {id:c.key.toLowerCase()+'-max',name:c.label+' maximum',parameters:{[c.key]:c.max}},
] : []);
export const planterRecipe: Recipe = {
  descriptor: {
    id:"planter",version:'1.2.0',title:"Slatted planter box",description:'An open planter with stacked wall boards, corner posts, a floor and optional feet.',
    controls,defaults:parse({}),presets,
    palettes:Object.entries(palette).map(([id,colors]) => ({id,label:id === 'oak' ? 'Oak' : 'Painted',colors:Object.values(colors)})),
    save,
    state(input) { return parameterState(controls,input); },
  },
  build,load,
  validationCases:[...presets,...boundaries,{id:'smallest',name:'Smallest dense box',parameters:{width:0.6,depth:0.3,height:0.25,boardCount:5}}],
  integrationCases:[{id:'default',name:'Default planter',parameters:{}},...presets],
  constraints:['Dimensions are meters. Open top; optional soil fill 3 cm below the rim (inset 3 mm from the walls) with low plant tufts that rise up to about 12 cm above the rim, so a planted box is taller than its height setting. Board gaps are 6 mm. Feet consume 10 cm of total height. Floor has no drainage holes.'],
  presentation:{category:'Props',order:70,kitIds:[],thumbnails:Object.fromEntries(presets.map(p=>[p.id,'planter-'+p.id+'.png']))},
  source:{entry:'examples/recipes/planter/index.ts',exportName:'planterRecipe'},
};

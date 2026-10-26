import './preview.css';
import { frameEnvironmentObject } from './framing.ts';
import { brandArtwork } from '../site/brand.ts';
import { catalog,descriptor } from '../catalog/index.ts';
import { Scene,Color,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,Box3,Vector3,Raycaster,Vector2,Mesh,PCFShadowMap,ACESFilmicToneMapping } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildEnvironment,exampleEnvironment,saveEnvironment,exportEnvironment,createSurface,type EnvironmentBuild,type EnvironmentManifest } from './index.ts';

const viewport=document.querySelector<HTMLElement>('#environment-viewport')!,status=document.querySelector<HTMLElement>('#environment-status')!,query=document.querySelector<HTMLOutputElement>('#surface-query')!,seed=document.querySelector<HTMLInputElement>('#terrain-seed')!,amplitude=document.querySelector<HTMLInputElement>('#terrain-amplitude')!,save=document.querySelector<HTMLButtonElement>('#save-scene')!,exportButton=document.querySelector<HTMLButtonElement>('#export-scene')!;
const scene=new Scene();scene.background=new Color('#d7e5e6');
const camera=new PerspectiveCamera(45,1,.01,2000),renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;viewport.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;
scene.add(new HemisphereLight('#fffbed','#526b60',1.1));const sun=new DirectionalLight('#fff1d5',3.2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0001;sun.shadow.normalBias=.01;scene.add(sun,sun.target);
let current:EnvironmentBuild|undefined,busy=false,valid=false,revision=0;
function message(text:string,error=false){status.textContent=text;status.dataset.error=String(error);}
document.querySelector('.environment-brand')!.append(brandArtwork('logo'),brandArtwork('wordmark'));
const input=(id:string)=>document.getElementById(id) as HTMLInputElement;
const select=(id:string)=>document.getElementById(id) as HTMLSelectElement;
const chosen={road:'',water:'',placement:''};
let draft:EnvironmentManifest|undefined;
let framedView:'scene'|{placement:string}|undefined;
controls.addEventListener('start',()=>{framedView=undefined;});
for(const family of catalog){const option=document.createElement('option');option.value=family.id;option.textContent=family.title;select('placement-family').append(option);}
function featureFields(){
  if(!draft)return;
  for(const kind of ['road','water','placement'] as const){
    const items=kind==='road'?draft.roads:kind==='water'?draft.water:draft.placements,selection=select(kind+'-selection');
    if(!items.some(item=>item.id===chosen[kind]))chosen[kind]=items[0]?.id??'';
    selection.replaceChildren();for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.id;selection.append(option);}selection.value=chosen[kind];
    const item=items.find(item=>item.id===chosen[kind]);
    for(const field of document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>(`[id^="${kind}-"]`)){
      if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement))continue;
      const key=field.id.slice(kind.length+1),value=item?.[key as keyof typeof item];field.disabled=busy||!item;
      field.value=key==='path'&&item&&'path' in item?item.path.map(p=>p.x+', '+p.z).join('\n'):value===undefined?'':String(value);
    }
    input('remove-'+kind).disabled=busy||!item;
  }
  const placed=current?.root.getObjectByName('placement-'+chosen.placement),support=placed?.userData.support;
  document.querySelector('#placement-support')!.textContent=support?'Support variation '+(support.maximum-support.minimum).toFixed(3)+' m / '+support.maximumVariation.toFixed(3)+' m allowed.':'';
}
function ready(){
  for(const element of document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement>('details input,details select,details textarea,details button'))element.disabled=busy;
  for(const kind of ['road','water','placement'] as const){const selected=!!chosen[kind];for(const field of document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>(`input[id^="${kind}-"],textarea[id^="${kind}-"]`))field.disabled=busy||!selected;input('remove-'+kind).disabled=busy||!selected;}
document.querySelector<HTMLButtonElement>('#frame-selected-asset')!.disabled=busy||!current?.root.getObjectByName('placement-'+chosen.placement);
save.disabled=busy||!valid;exportButton.disabled=busy||!valid;seed.disabled=busy;amplitude.disabled=busy;document.querySelector<HTMLInputElement>('#scene-file')!.disabled=busy;document.querySelector<HTMLButtonElement>('#new-scene')!.disabled=busy;}
function frame(){if(current){frameEnvironmentObject(current.root,camera,controls);framedView='scene';}}
function frameSelected(){const object=current?.root.getObjectByName('placement-'+chosen.placement);if(object&&!busy){frameEnvironmentObject(object,camera,controls);framedView={placement:chosen.placement};}}

function lightScene(build:EnvironmentBuild){
  build.root.traverse(object=>{if(object instanceof Mesh){object.castShadow=true;object.receiveShadow=true;}});
  const bounds=new Box3().setFromObject(build.root),center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3()),span=Math.max(size.x,size.y,size.z,1),radius=span*.9;
  sun.target.position.copy(center);sun.position.copy(center).addScaledVector(new Vector3(1,.9,.65).normalize(),span*1.5);
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.1,far:span*6});sun.shadow.camera.updateProjectionMatrix();
}
function apply(input:unknown,reframe=false){
  if(busy)return;++revision;
  try{const next=buildEnvironment(input),previous=current;scene.add(next.root);if(previous){scene.remove(previous.root);previous.dispose();}current=next;draft=structuredClone(next.config);lightScene(next);featureFields();valid=true;seed.value=String(next.config.terrain.seed);amplitude.value=String(next.config.terrain.amplitude);viewport.dataset.seed=seed.value;viewport.dataset.amplitude=amplitude.value;viewport.dataset.ready='true';if(reframe)frame();message(next.config.tiles.length+' terrain tiles · '+next.config.placements.length+' assets · '+next.config.roads.length+' roads · '+next.config.water.length+' water patches');}
  catch(error){valid=false;viewport.dataset.ready='false';message(error instanceof Error?error.message:String(error),true);}ready();
}
function edited(){if(draft&&!busy){draft.terrain={...draft.terrain,seed:seed.valueAsNumber,amplitude:amplitude.valueAsNumber};apply(draft);}}
function featureEdit(kind:keyof typeof chosen){
  if(!draft||busy)return;
  try{
    if(kind==='road'){
      const road=draft.roads.find(item=>item.id===chosen.road);if(!road)return;road.width=input('road-width').valueAsNumber;
      road.path=[];road.path=(document.getElementById('road-path') as HTMLTextAreaElement).value.trim().split('\n').map(line=>{const parts=line.split(',');if(parts.length!==2||parts.some(part=>!part.trim()))throw new Error('Each road point needs x, z');return {x:Number(parts[0]),z:Number(parts[1])};});
    }else{
      const item=kind==='water'?draft.water.find(item=>item.id===chosen.water):draft.placements.find(item=>item.id===chosen.placement);if(!item)return;
      const keys=kind==='water'?['x','z','width','depth','elevation']:['x','z','yaw','maxSlopeDegrees','maxSupportVariation'];
      for(const key of keys)Object.assign(item,{[key]:input(kind+'-'+key).valueAsNumber});
    }
    apply(draft);
  }catch(error){valid=false;message(error instanceof Error?error.message:String(error),true);ready();}
}
function featureAction(kind:keyof typeof chosen,remove:boolean){
  if(!draft||busy)return;
  const size=draft.terrain.cells*draft.terrain.cellSize,tile=draft.tiles[0]!,x=(tile.x+.5)*size,z=(tile.z+.5)*size;
  const items=kind==='road'?draft.roads:kind==='water'?draft.water:draft.placements;
  if(remove){const index=items.findIndex(item=>item.id===chosen[kind]);if(index>=0)items.splice(index,1);}
  else{
    let suffix=1;while(items.some(item=>item.id===kind+'-'+suffix))suffix++;const id=kind+'-'+suffix;chosen[kind]=id;
    if(kind==='road')draft.roads.push({id,width:Math.min(1,size/4),path:[{x:x-size/4,z},{x:x+size/4,z}]});
    else if(kind==='water')draft.water.push({id,x,z,width:Math.min(4,size/2),depth:Math.min(4,size/2),elevation:Math.min(32,createSurface(draft.terrain).sample(x,z).height+.1)});
    else draft.placements.push({id,design:descriptor(select('placement-family').value).save({}),x,z,yaw:0,maxSlopeDegrees:30,maxSupportVariation:.25});
  }
  featureFields();apply(draft);
}
for(const kind of ['road','water','placement'] as const){
  select(kind+'-selection').addEventListener('change',()=>{chosen[kind]=select(kind+'-selection').value;featureFields();ready();});
  for(const field of document.querySelectorAll(`input[id^="${kind}-"],textarea[id^="${kind}-"]`))field.addEventListener('change',()=>featureEdit(kind));
  document.getElementById('add-'+kind)!.addEventListener('click',()=>featureAction(kind,false));document.getElementById('remove-'+kind)!.addEventListener('click',()=>featureAction(kind,true));
}
seed.addEventListener('change',edited);amplitude.addEventListener('change',edited);
document.querySelector('#new-scene')!.addEventListener('click',()=>apply(exampleEnvironment(),true));document.querySelector('#frame-scene')!.addEventListener('click',frame);document.querySelector('#frame-selected-asset')!.addEventListener('click',frameSelected);
document.querySelector<HTMLInputElement>('#scene-file')!.addEventListener('change',async event=>{const file=(event.target as HTMLInputElement).files?.[0];if(!file||busy)return;const ticket=++revision;try{if(file.size>2*1024*1024)throw new Error('Scene manifest exceeds2MiB');const input=JSON.parse(await file.text());if(ticket===revision&&!busy)apply(input,true);}catch(error){valid=false;message(error instanceof Error?error.message:String(error),true);ready();}});
function download(bytes:BlobPart,name:string,type:string){const url=URL.createObjectURL(new Blob([bytes],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
save.addEventListener('click',()=>{if(current&&valid&&!busy)download(saveEnvironment(current.config),'environment.scene.json','application/json');});
exportButton.addEventListener('click',async()=>{if(!current||!valid||busy)return;const build=current;++revision;busy=true;ready();try{const config=saveEnvironment(build.config),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config)),configHash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join(''),bytes=await exportEnvironment(build,{producer:'Polyspoon environment editor',surfaceVersion:1,configHash});download(Uint8Array.from(bytes),'environment.glb','model/gltf-binary');message('Environment GLB exported.');}catch(error){message(error instanceof Error?error.message:String(error),true);}finally{busy=false;ready();}});
const ray=new Raycaster(),pointer=new Vector2();renderer.domElement.addEventListener('pointermove',event=>{if(!current)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(current.root.children.filter(object=>object.name.startsWith('terrain-')))[0];if(hit){const sample=createSurface(current.config.terrain).sample(hit.point.x,hit.point.z);query.textContent='Height '+sample.height.toFixed(2)+'m · Slope '+sample.slopeDegrees.toFixed(1)+'°';}});
const resize=new ResizeObserver(()=>{const {width,height}=viewport.getBoundingClientRect();camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();renderer.setSize(width,height);const object=framedView==='scene'?current?.root:framedView?current?.root.getObjectByName('placement-'+framedView.placement):undefined;if(object)frameEnvironmentObject(object,camera,controls,true);});resize.observe(viewport);
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});apply(exampleEnvironment(),true);
window.addEventListener('pagehide',()=>{resize.disconnect();renderer.setAnimationLoop(null);controls.dispose();current?.dispose();renderer.dispose();},{once:true});

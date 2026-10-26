import './preview.css';
import { AnimationMixer,Bone,Box3Helper,Color,DirectionalLight,Group,HemisphereLight,Mesh,MeshStandardMaterial,PerspectiveCamera,PlaneGeometry,Scene,SkinnedMesh,Vector3,WebGLRenderer,PCFShadowMap,ACESFilmicToneMapping } from 'three';
import type { AnimationAction,AnimationClip,Object3D } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { brandArtwork } from '../site/brand.ts';
import { designInput } from '../catalog/appearance.ts';
import { frameEnvironmentObject } from '../environment/framing.ts';
import { humanoidRecipe } from '../../examples/recipes/stylized-humanoid/index.ts';
import { buildHumanoid,buildSavedHumanoid } from './build.ts';
import { foxRecipe } from '../../examples/recipes/stylized-fox/index.ts';
import { buildFox,buildSavedFox,applyFoxPawTarget } from './fox-build.ts';
import { riggedMotionBounds } from './bounds.ts';
import { exportRiggedAsset } from './export.ts';
import { solveTwoBone,applyTwoBone } from './ik.ts';
import type { RiggedAssetBuild } from './types.ts';

const foxMode=document.body.dataset.rigFamily==='fox',rigRecipe=foxMode?foxRecipe:humanoidRecipe,buildCurrent=foxMode?buildFox:buildHumanoid,buildSavedCurrent=foxMode?buildSavedFox:buildSavedHumanoid;
const input=(id:string)=>document.getElementById(id) as HTMLInputElement,button=(id:string)=>document.getElementById(id) as HTMLButtonElement,select=(id:string)=>document.getElementById(id) as HTMLSelectElement;
const viewport=document.querySelector<HTMLElement>('#rig-viewport')!,status=document.querySelector<HTMLElement>('#rig-status')!,scene=new Scene(),camera=new PerspectiveCamera(45,1,.01,1000),renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
scene.background=new Color('#dde5df');renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;viewport.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;
const followOffset=new Vector3(),holder=new Group();scene.add(holder,new HemisphereLight('#fff9ee','#4e6559',1.3));const sun=new DirectionalLight('#fff0dd',3);sun.position.set(3,5,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:30});sun.shadow.normalBias=.003;scene.add(sun,sun.target);
const floor=new Mesh(new PlaneGeometry(40,40),new MeshStandardMaterial({color:'#b8c5ae',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
document.querySelector('#rig-brand')!.append(brandArtwork('logo'),brandArtwork('wordmark'));
let current:RiggedAssetBuild|undefined,active:{root:Object3D;clips:AnimationClip[];mixer:AnimationMixer;release:()=>void}|undefined,action:AnimationAction|undefined,busy=false,valid=false,playing=true,framed=true,revision=0;
let envelope:ReturnType<typeof riggedMotionBounds>|undefined,draft:Record<string,unknown>={};
controls.addEventListener('start',()=>{framed=false;});
function message(text:string,error=false){status.textContent=text;status.dataset.error=String(error);}
function ready(){for(const element of document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('aside input,aside button,aside select'))element.disabled=busy;for(const id of ['rig-save','rig-export','rig-reload'])button(id).disabled=busy||!valid;button('rig-play').textContent=playing?'Pause':'Play';}
function moveView(delta:Vector3){camera.position.add(delta);controls.target.add(delta);sun.position.add(delta);sun.target.position.add(delta);}
function resetOrigin(){moveView(followOffset.clone().negate());followOffset.set(0,0,0);holder.position.set(0,0,0);}
function frame(preserveDirection=false){if(!envelope)return;const helper=new Box3Helper(envelope.clone().translate(holder.position));helper.updateMatrixWorld(true);frameEnvironmentObject(helper,camera,controls,preserveDirection);helper.dispose();followOffset.copy(holder.position);framed=true;}
function footFields(){if(!active||!current)return;active.root.updateMatrixWorld(true);const name=current.rig.kind==='fox'?current.rig.effectors!.find(effector=>effector.id===select('rig-foot').value)!.bone:current.rig.chains.find(chain=>chain.side===select('rig-foot').value)!.end,point=active.root.getObjectByName(name)!.getWorldPosition(new Vector3()).sub(holder.position);for(const key of ['x','y','z'] as const)input('ik-'+key).value=point[key].toFixed(4);}
function setClip(){if(!active)return;resetOrigin();active.mixer.stopAllAction();const clip=active.clips.find(clip=>clip.name===select('rig-clip').value)!;action=active.mixer.clipAction(clip);action.reset().play();input('rig-seek').max=String(clip.duration);input('rig-seek').value='0';active.mixer.setTime(0);footFields();}
function activate(root:Object3D,clips:AnimationClip[],release:()=>void,mode:string){
  if(active){active.mixer.stopAllAction();active.mixer.uncacheRoot(active.root);holder.remove(active.root);active.release();}
  resetOrigin();const mixer=new AnimationMixer(root);active={root,clips,mixer,release};holder.add(root);root.traverse(object=>{if(object instanceof Mesh){object.castShadow=true;object.receiveShadow=true;if(object instanceof SkinnedMesh)object.frustumCulled=false;}});
  mixer.addEventListener('loop',event=>{const declaration=current?.rig.clips.find(clip=>clip.name===event.action.getClip().name);if(declaration)holder.position.addScaledVector(new Vector3(...declaration.rootDelta),event.loopDelta);});
  setClip();document.querySelector('#rig-mode')!.textContent=mode;viewport.dataset.mode=mode;viewport.dataset.ready='true';
}
function syncFields(){if(!current)return;for(const control of rigRecipe.descriptor.controls)input('body-'+control.key).value=String(current.config.applied[control.key]);}
function apply(parameters:unknown,reframe=false,migration:RiggedAssetBuild['config']['migration']|null=current?.config.migration){if(busy)return;++revision;try{
  const next=buildCurrent(parameters);if(migration)next.config.migration=structuredClone(migration);const bounds=riggedMotionBounds(next),previous=current;current=next;envelope=bounds;draft=designInput(next.config);activate(next.root,next.root.animations,()=>{},'Generated skin');previous?.dispose();valid=true;syncFields();if(reframe)frame();message(next.rig.bones.length+' bones · '+next.rig.meshes.length+' skinned material parts · idle and walk');
}catch(error){valid=false;message(error instanceof Error?error.message:String(error),true);}ready();}
for(const control of rigRecipe.descriptor.controls){const label=document.createElement('label'),field=document.createElement('input');label.textContent=control.label;field.id='body-'+control.key;if(control.kind==='color')field.type='color';else if(control.kind==='range'||control.kind==='integer'){field.type='number';field.min=String(control.min);field.max=String(control.max);field.step=String(control.step);}field.addEventListener('change',()=>{draft[control.key]=control.kind==='color'?field.value:field.valueAsNumber;apply(draft);});label.append(field);document.querySelector('#body-controls')!.append(label);}
select('rig-clip').addEventListener('change',setClip);select('rig-foot').addEventListener('change',footFields);
button('rig-frame').addEventListener('click',()=>frame());button('rig-play').addEventListener('click',()=>{if(!action?.isRunning()){setClip();playing=true;}else playing=!playing;ready();});
input('rig-seek').addEventListener('input',()=>{if(!active||!action||busy)return;playing=false;resetOrigin();action.reset().play();active.mixer.setTime(input('rig-seek').valueAsNumber);active.root.updateMatrixWorld(true);footFields();ready();});
button('rig-apply-ik').addEventListener('click',()=>{if(!active||!current||busy)return;try{
  const target=new Vector3(input('ik-x').valueAsNumber,input('ik-y').valueAsNumber,input('ik-z').valueAsNumber);
  if(current.rig.kind==='fox'){target.add(holder.position);applyFoxPawTarget(active.root,current.rig,select('rig-foot').value,target);}
  else{if(target.y<Number(current.config.applied.height)*.055-1e-6)throw new Error('Foot target would cross ground plane');target.add(holder.position);
    const chain=current.rig.chains.find(chain=>chain.side===select('rig-foot').value)!,upper=active.root.getObjectByName(chain.upper) as Bone,lower=active.root.getObjectByName(chain.lower) as Bone,end=active.root.getObjectByName(chain.end) as Bone,pose=solveTwoBone(upper,lower,end,target,new Vector3(0,0,1));applyTwoBone(upper,lower,end,pose);}
  playing=false;active.root.updateMatrixWorld(true);message((foxMode?'Paw':'Foot')+' target applied. Export retains canonical clips.');ready();
}catch(error){message(error instanceof Error?error.message:String(error),true);}});
button('rig-reset-pose').addEventListener('click',()=>{if(!active||busy)return;playing=false;resetOrigin();active.mixer.stopAllAction();active.root.updateMatrixWorld(true);footFields();message('Bind pose restored. Select a clip and press Play to resume.');ready();});
input('rig-file').addEventListener('change',async()=>{const file=input('rig-file').files?.[0];if(!file||busy)return;const ticket=++revision;try{if(file.size>1024*1024)throw new Error('Design exceeds1MiB');const loaded=buildSavedCurrent(JSON.parse(await file.text()));try{if(ticket===revision&&!busy)apply(designInput(loaded.config),true,loaded.config.migration??null);}finally{loaded.dispose();}}catch(error){valid=false;message(error instanceof Error?error.message:String(error),true);ready();}});
function download(bytes:BlobPart,name:string,type:string){const url=URL.createObjectURL(new Blob([bytes],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
button('rig-save').addEventListener('click',()=>{if(current&&valid&&!busy)download(JSON.stringify(current.config,null,2)+'\n',rigRecipe.descriptor.id+'.design.json','application/json');});
async function deliver(reload:boolean){if(!current||!valid||busy)return;busy=true;++revision;ready();let fresh:RiggedAssetBuild|undefined;try{fresh=buildCurrent(designInput(current.config));if(current.config.migration)fresh.config.migration=structuredClone(current.config.migration);
  const bytes=await exportRiggedAsset(fresh);
  if(reload){const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');activate(gltf.scene,gltf.animations,()=>{const skeletons=new Set<SkinnedMesh['skeleton']>();gltf.scene.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();if(object instanceof SkinnedMesh)skeletons.add(object.skeleton);for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});for(const skeleton of skeletons)skeleton.dispose();},'Reloaded GLB skin');message('Exported GLB reloaded. Playback uses imported clips.');}
  else{download(Uint8Array.from(bytes),rigRecipe.descriptor.id+'.glb','model/gltf-binary');message('Animated GLB exported from canonical design.');}
}catch(error){message(error instanceof Error?error.message:String(error),true);}finally{fresh?.dispose();busy=false;ready();}}
button('rig-export').addEventListener('click',()=>deliver(false));button('rig-reload').addEventListener('click',()=>deliver(true));
const resize=new ResizeObserver(()=>{const {width,height}=viewport.getBoundingClientRect();camera.aspect=width/Math.max(1,height);renderer.setSize(width,height);camera.updateProjectionMatrix();if(framed)frame(true);});resize.observe(viewport);
let last=performance.now();renderer.setAnimationLoop(now=>{const delta=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(active&&playing&&!busy){const root=active.root.getObjectByName('motion_root')!,before=root.getWorldPosition(new Vector3());active.mixer.update(delta);active.root.updateMatrixWorld(true);if(input('rig-follow').checked){const movement=root.getWorldPosition(new Vector3()).sub(before);moveView(movement);followOffset.add(movement);}}if(action){input('rig-seek').value=String(action.time);document.querySelector('#rig-time')!.textContent=action.time.toFixed(2)+' s';}controls.update();renderer.render(scene,camera);});apply({},true);
window.addEventListener('pagehide',()=>{resize.disconnect();renderer.setAnimationLoop(null);if(active){active.mixer.stopAllAction();active.mixer.uncacheRoot(active.root);active.release();}current?.dispose();floor.geometry.dispose();floor.material.dispose();controls.dispose();renderer.dispose();},{once:true});

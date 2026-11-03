import './live-queue.css';
// Interactive 3D viewer for the moderator detail page. Loaded on demand (code-split) and only on explicit click.
// The bytes come from the moderator-only endpoint; the file already passed the sandboxed structural checks.
// Presentation only: nothing here can change a review decision.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

export type ModelStats={meshes:number;triangles:number;vertices:number;materials:number;size:{x:number;y:number;z:number}};
const BACKGROUNDS=[{name:'Grey',color:0x8a8f99},{name:'Light',color:0xeef1f5},{name:'Dark',color:0x1d2129}];
const VIEWS:Record<string,[number,number,number]>={Front:[0,0,1],Side:[1,0,0],Top:[0,1,0.0001],'3/4':[1,0.8,1]};
export type ReviewShade='lit'|'bright'|'bright-by-part'|'normal'|'height'|'depth-texture'|'depth';
export interface MapChannels{normal:boolean;height:boolean;depthTexture:boolean}
const BRIGHT=0xf4f6f8;
export function partColor(index:number){const color=new THREE.Color();color.setHSL((index*0.61803398875)%1,0.55,0.62);return color;}
function textureRole(key:string,texture:THREE.Texture):'normal'|'height'|'depth'|null{
 const label=(key+' '+(texture.name||'')).toLowerCase();
 if(key==='normalMap'||label.includes('normal'))return 'normal';
 if(key==='bumpMap'||key==='displacementMap'||label.includes('height')||label.includes('displacement')||label.includes('bump'))return 'height';
 if(label.includes('depth'))return 'depth';
 return null;
}
function texturesOf(material:THREE.Material){
 const found:{role:'normal'|'height'|'depth';texture:THREE.Texture}[]=[];
 for(const [key,value] of Object.entries(material as unknown as Record<string,unknown>)){
  if(!(value instanceof THREE.Texture))continue;
  const role=textureRole(key,value);if(role)found.push({role,texture:value});
 }
 return found;
}
export function channelsOf(materials:THREE.Material[]):MapChannels{
 const channels:MapChannels={normal:false,height:false,depthTexture:false};
 for(const material of materials)for(const entry of texturesOf(material)){if(entry.role==='normal')channels.normal=true;else if(entry.role==='height')channels.height=true;else channels.depthTexture=true;}
 return channels;
}
export function reviewModeList(channels:MapChannels):{id:ReviewShade;label:string}[]{
 const modes:{id:ReviewShade;label:string}[]=[{id:'lit',label:'Lit'},{id:'bright',label:'Bright parts'},{id:'bright-by-part',label:'Bright by part'}];
 if(channels.normal)modes.push({id:'normal',label:'Normal map'});
 if(channels.height)modes.push({id:'height',label:'Height'});
 if(channels.depthTexture)modes.push({id:'depth-texture',label:'Depth texture'});
 modes.push({id:'depth',label:'Depth'});
 return modes;
}
export function mapSummary(channels:MapChannels){
 const names=[channels.normal?'normal':null,channels.height?'height':null,channels.depthTexture?'depth texture':null].filter((name):name is string=>!!name);
 return (names.length?names.join(', '):'none')+'. Camera depth is available.';
}
export function applyReviewShade(source:THREE.Material,mode:ReviewShade,partIndex:number):THREE.Material{
 if(mode==='lit')return source;
 if(mode==='bright')return new THREE.MeshBasicMaterial({color:BRIGHT,toneMapped:false});
 if(mode==='bright-by-part')return new THREE.MeshBasicMaterial({color:partColor(partIndex),toneMapped:false});
 if(mode==='depth')return new THREE.MeshDepthMaterial();
 const wanted=mode==='normal'?'normal':mode==='height'?'height':'depth';
 const map=texturesOf(source).find(entry=>entry.role===wanted)?.texture??null;
 return new THREE.MeshBasicMaterial({color:0xffffff,map,toneMapped:false});
}

export function modelStats(root:THREE.Object3D):ModelStats{
 let meshes=0,triangles=0,vertices=0;const materials=new Set<THREE.Material>();
 root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;meshes++;const g=mesh.geometry,count=g.attributes.position?.count??0;vertices+=count;triangles+=Math.floor((g.index?g.index.count:count)/3);for(const m of [mesh.material].flat())if(m)materials.add(m);});
 const s=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
 return {meshes,triangles,vertices,materials:materials.size,size:{x:s.x,y:s.y,z:s.z}};
}
const metres=(v:number)=>v>=10?v.toFixed(1)+' m':v>=1?v.toFixed(2)+' m':Math.round(v*100)+' cm';

export async function mountViewer(host:HTMLElement,bytes:Uint8Array):Promise<()=>void>{
 const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
 const stage=document.createElement('div');stage.className='viewer-stage';
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:false});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label','3D model viewer. Drag or use arrow keys to rotate, plus and minus to zoom, Shift plus arrows to pan, R to reset.');
 stage.append(canvas);
 const scene=new THREE.Scene();let bg=0;scene.background=new THREE.Color(BACKGROUNDS[bg]!.color);
 const hemi=new THREE.HemisphereLight(0xffffff,0x444444,1.3),key=new THREE.DirectionalLight(0xffffff,2),fill=new THREE.DirectionalLight(0xffffff,0.6),ambient=new THREE.AmbientLight(0xffffff,0);
 scene.add(hemi,key,fill,ambient,gltf.scene);
 const box=new THREE.Box3().setFromObject(gltf.scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),radius=Math.max(1e-3,size.length()/2);
 key.position.copy(center).add(new THREE.Vector3(3,5,4).multiplyScalar(radius));fill.position.copy(center).add(new THREE.Vector3(-4,2,-3).multiplyScalar(radius));
 const grid=new THREE.GridHelper(Math.max(size.x,size.z)*2||1,10,0x55606e,0x6f7a88);grid.position.set(center.x,box.min.y,center.z);grid.visible=false;scene.add(grid);
 const camera=new THREE.PerspectiveCamera(35,4/3,radius/200,radius*200);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=0.12;controls.screenSpacePanning=true;controls.minDistance=radius*0.2;controls.maxDistance=radius*20;
 controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
 const view=(dir:[number,number,number])=>{controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(...dir).normalize().multiplyScalar(radius*3));camera.up.set(0,1,0);controls.update();};
 view(VIEWS['3/4']!);

 const resize=()=>{const w=Math.max(200,stage.clientWidth||host.clientWidth||640),box=getComputedStyle(stage),framed=box.height.endsWith('px')&&Number.parseFloat(box.height)>120,h=framed?Math.round(stage.clientHeight):Math.round(Math.min(w*0.75,Math.max(260,innerHeight*0.7)));renderer.setSize(w,h,false);canvas.style.width='100%';canvas.style.height=framed?'100%':h+'px';camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);

 const toolbar=document.createElement('div');toolbar.className='viewer-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Viewer controls');
 const tool=(label:string,run:(b:HTMLButtonElement)=>void,pressed?:boolean)=>{const b=document.createElement('button');b.type='button';b.className='button-secondary viewer-tool';b.textContent=label;if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));b.addEventListener('click',()=>{run(b);canvas.focus({preventScroll:true});});toolbar.append(b);return b;};
 const toggle=(b:HTMLButtonElement)=>{const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));return on;};
 tool('Reset view',()=>view(VIEWS['3/4']!));
 for(const name of ['Front','Side','Top'])tool(name,()=>view(VIEWS[name]!));
 const loaded:THREE.Material[]=[];
 const originals=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
 gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;originals.set(mesh,mesh.material);for(const m of [mesh.material].flat())if(m)loaded.push(m);});
 const channels=channelsOf(loaded);
 let generated:THREE.Material[]=[],shade:ReviewShade='lit',wireOn=false;
 const applyWire=()=>gltf.scene.traverse(o=>{for(const m of [(o as THREE.Mesh).material].flat())if(m&&'wireframe' in m)(m as THREE.MeshStandardMaterial).wireframe=wireOn;});
 const shadeButtons:HTMLButtonElement[]=[];
 const setShade=(mode:ReviewShade)=>{
  for(const material of generated)material.dispose();generated=[];shade=mode;let part=0;
  gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const original=originals.get(mesh)??mesh.material;if(mode==='lit'){mesh.material=original;part++;return;}const next=[original].flat().map(source=>{const made=applyReviewShade(source,mode,part);if(made!==source)generated.push(made);return made;});mesh.material=next.length===1?next[0]!:next;part++;});
  applyWire();for(const button of shadeButtons)button.setAttribute('aria-pressed',String(button.dataset.shade===mode));
 };
 const setWire=(on:boolean)=>{wireOn=on;applyWire();};
 const wire=tool('Wireframe',b=>setWire(toggle(b)),false);
 tool('Flat light',b=>{const flat=toggle(b);hemi.intensity=flat?0.2:1.3;key.intensity=flat?0:2;fill.intensity=flat?0:0.6;ambient.intensity=flat?2.6:0;},false);
 for(const mode of reviewModeList(channels)){if(mode.id==='lit')continue;const button=tool(mode.label,()=>setShade(shade===mode.id?'lit':mode.id),false);button.dataset.shade=mode.id;shadeButtons.push(button);}
 const bgButton=tool('Background: '+BACKGROUNDS[bg]!.name,b=>{bg=(bg+1)%BACKGROUNDS.length;(scene.background as THREE.Color).set(BACKGROUNDS[bg]!.color);b.textContent='Background: '+BACKGROUNDS[bg]!.name;});
 tool('Grid',b=>{grid.visible=toggle(b);},false);
 tool('Spin',b=>{controls.autoRotate=toggle(b);},false);
 if(stage.requestFullscreen)tool('Full screen',()=>{document.fullscreenElement?void document.exitFullscreen():void stage.requestFullscreen().catch(()=>{});});
 void bgButton;

 const s=modelStats(gltf.scene),stats=document.createElement('dl');stats.className='viewer-stats';
 for(const [k,v] of [['Size (W × H × D)',metres(s.size.x)+' × '+metres(s.size.y)+' × '+metres(s.size.z)],['Triangles',s.triangles.toLocaleString()],['Vertices',s.vertices.toLocaleString()],['Meshes',String(s.meshes)],['Materials',String(s.materials)],['File',Math.max(1,Math.round(bytes.byteLength/1024))+' KB']] as const){const d=document.createElement('div');const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;d.append(dt,dd);stats.append(d);}
 {const d=document.createElement('div');const dt=document.createElement('dt');dt.textContent='Maps';const dd=document.createElement('dd');dd.textContent=mapSummary(channels);d.append(dt,dd);stats.append(d);}
 const hint=document.createElement('p');hint.className='viewer-hint';hint.textContent='Drag to rotate · scroll or pinch to zoom · right-drag or two fingers to pan · keys: arrows rotate, + / − zoom, Shift+arrows pan, R reset, W wireframe';

 const orbit=(dTheta:number,dPhi:number)=>{const offset=camera.position.clone().sub(controls.target),sph=new THREE.Spherical().setFromVector3(offset);sph.theta+=dTheta;sph.phi=Math.min(Math.PI-0.01,Math.max(0.01,sph.phi+dPhi));camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));controls.update();};
 const dolly=(f:number)=>{const offset=camera.position.clone().sub(controls.target);const len=Math.min(controls.maxDistance,Math.max(controls.minDistance,offset.length()*f));camera.position.copy(controls.target).add(offset.setLength(len));controls.update();};
 const pan=(dx:number,dy:number)=>{const step=camera.position.distanceTo(controls.target)*0.05,right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1),move=right.multiplyScalar(dx*step).add(up.multiplyScalar(dy*step));camera.position.add(move);controls.target.add(move);controls.update();};
 canvas.addEventListener('keydown',event=>{
  const a=0.12;let handled=true;
  switch(event.key){
   case 'ArrowLeft':event.shiftKey?pan(-1,0):orbit(-a,0);break;case 'ArrowRight':event.shiftKey?pan(1,0):orbit(a,0);break;
   case 'ArrowUp':event.shiftKey?pan(0,1):orbit(0,-a);break;case 'ArrowDown':event.shiftKey?pan(0,-1):orbit(0,a);break;
   case '+':case '=':dolly(0.85);break;case '-':case '_':dolly(1/0.85);break;
   case 'r':case 'R':view(VIEWS['3/4']!);break;case 'w':case 'W':wire.click();break;
   default:handled=false;
  }
  if(handled){event.preventDefault();event.stopPropagation();}
 });

 host.replaceChildren(stage,toolbar,stats,hint);observer.observe(stage);resize();
 let alive=true;const loop=()=>{if(!alive)return;controls.update();renderer.render(scene,camera);requestAnimationFrame(loop);};loop();
 return ()=>{alive=false;observer.disconnect();controls.dispose();const seen=new Set<THREE.Material>();const drop=(material:THREE.Material|THREE.Material[]|undefined)=>{for(const m of [material].flat())if(m&&!seen.has(m)){seen.add(m);m.dispose();}};gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry.dispose();drop(mesh.material);});for(const material of originals.values())drop(material);for(const material of generated)drop(material);grid.dispose();renderer.dispose();host.replaceChildren();};
}

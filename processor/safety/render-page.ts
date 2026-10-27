// Runs INSIDE the jailed, network-less Chromium (see render.ts). This is where the hostile file is decoded:
// three.js parses the glTF and Chromium decodes its textures. Detectors run here on the pixels too, so the parent
// only ever receives bounded PNG/JPEG bytes plus numbers. Deterministic: fixed viewport, cameras and lights.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {IMAGE_CLASSIFIERS,type Pixels} from './detectors.ts';
import {classifyNsfwBatch,nsfwBackend,NSFW_DETECTOR} from './nsfw-model.ts';
import {saliencyWindows} from './saliency.ts';

type Score={category:string;score:number;bbox?:[number,number,number,number];detector:string};
type Out={name:string;kind:string;mime:string;b64:string;width:number;height:number;scores:Score[]};
interface Island{mesh:THREE.Mesh;start:number;count:number;box:THREE.Box3;id:number}
const SIZE=1024,ANALYSIS=512,TILE=1024,STRIDE=768,NSFW_INPUT=224,MAX_NORMALIZED=50*1024*1024;
// Image kinds the NSFW classifier looks at (material passes and wireframes are not photos of anything).
const NSFW_KINDS=new Set(['view-lit','view-unlit','grid-crop','island','slice','backface','texture-tile']);
declare global{interface Window{safetyRender(b64:string,maxImages:number):Promise<unknown>}}

window.safetyRender=async(b64:string,maxImages:number)=>{
 const errors:string[]=[],images:Out[]=[],timing:Record<string,number>={},T0=performance.now();let truncated=false;
 const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
 const root=gltf.scene;root.updateMatrixWorld(true);
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setPixelRatio(1);renderer.setSize(SIZE,SIZE);
 const scene=new THREE.Scene();scene.add(root);
 const lights=new THREE.Group();lights.add(new THREE.HemisphereLight(0xffffff,0x444444,1.2));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(3,5,4);const fill=new THREE.DirectionalLight(0xffffff,0.8);fill.position.set(-4,2,-3);const rim=new THREE.DirectionalLight(0xffffff,0.6);rim.position.set(0,-3,-5);lights.add(key,fill,rim);scene.add(lights);
 const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())throw new Error('empty_scene');
 const center=box.getCenter(new THREE.Vector3()),radius=Math.max(1e-6,box.getSize(new THREE.Vector3()).length()/2);
 const camera=new THREE.PerspectiveCamera(30,1,radius/1000,radius*1000);
 const meshes:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
 const original=new Map(meshes.map(m=>[m,{material:m.material,geometry:m.geometry}]));
 const firstMat=(m:THREE.Mesh)=>(Array.isArray(original.get(m)!.material)?(original.get(m)!.material as THREE.Material[])[0]:original.get(m)!.material) as THREE.MeshStandardMaterial;
 const unlit=new Map(meshes.map(m=>{const s=firstMat(m);return [m,new THREE.MeshBasicMaterial({map:s?.map??null,color:s?.color??new THREE.Color(0xffffff),vertexColors:!!m.geometry.getAttribute('color'),side:THREE.FrontSide})];}));
 const normalMat=new THREE.MeshNormalMaterial(),wireMat=new THREE.MeshBasicMaterial({color:0x000000,wireframe:true});
 const restore=()=>{for(const m of meshes){m.material=original.get(m)!.material;m.geometry=original.get(m)!.geometry;m.visible=true;}};
 const mode=(kind:'lit'|'unlit'|'normal'|'wire'|'double')=>{for(const m of meshes){m.geometry=original.get(m)!.geometry;m.visible=true;if(kind==='lit')m.material=original.get(m)!.material;else if(kind==='unlit'){const u=unlit.get(m)!;u.side=THREE.FrontSide;m.material=u;}else if(kind==='double'){const u=unlit.get(m)!;u.side=THREE.DoubleSide;m.material=u;}else m.material=kind==='normal'?normalMat:wireMat;}lights.visible=kind==='lit';};
 const dirs:[string,THREE.Vector3][]=[['px',new THREE.Vector3(1,0,0)],['nx',new THREE.Vector3(-1,0,0)],['py',new THREE.Vector3(0,1,0)],['ny',new THREE.Vector3(0,-1,0)],['pz',new THREE.Vector3(0,0,1)],['nz',new THREE.Vector3(0,0,-1)]];
 for(const sx of [1,-1])for(const sy of [1,-1])for(const sz of [1,-1])dirs.push(['o'+(sx>0?'p':'n')+(sy>0?'p':'n')+(sz>0?'p':'n'),new THREE.Vector3(sx,sy,sz).normalize()]);
 const aim=(dir:THREE.Vector3,c=center,r=radius)=>{const d=r/Math.sin(THREE.MathUtils.degToRad(15))*1.05;camera.position.copy(c).addScaledVector(dir,d);camera.up.set(0,1,0);if(Math.abs(dir.y)>0.99)camera.up.set(0,0,dir.y>0?-1:1);camera.near=d/1000;camera.far=d*10;camera.clearViewOffset();camera.lookAt(c);camera.updateProjectionMatrix();};
 const analysis=document.createElement('canvas');analysis.width=ANALYSIS;analysis.height=ANALYSIS;const actx=analysis.getContext('2d',{willReadFrequently:true})!;
 const pixelsOf=(src:CanvasImageSource,w:number,h:number):Pixels=>{const s=Math.min(1,ANALYSIS/Math.max(w,h)),aw=Math.max(1,Math.round(w*s)),ah=Math.max(1,Math.round(h*s));actx.clearRect(0,0,ANALYSIS,ANALYSIS);actx.drawImage(src,0,0,aw,ah);return {width:aw,height:ah,data:actx.getImageData(0,0,aw,ah).data};};
 const score=(px:Pixels,scale:number):Score[]=>IMAGE_CLASSIFIERS.map(c=>{const d=c.classify(px);return {category:c.category,score:d.score,detector:c.info.id,bbox:d.bbox?d.bbox.map(v=>Math.round(v*scale)) as [number,number,number,number]:undefined};});
 // NSFW inputs are captured as 224² composites on grey (so transparent silhouettes read as a figure) and classified
 // after rendering, because the classifier is asynchronous.
 const nsfwQueue:{index:number;data:ImageData}[]=[];const nsfwCanvas=document.createElement('canvas');nsfwCanvas.width=nsfwCanvas.height=NSFW_INPUT;const nctx=nsfwCanvas.getContext('2d',{willReadFrequently:true})!;
 const room=()=>{if(images.length>=maxImages){truncated=true;return false;}return true;};
 const emit=(name:string,kind:string,canvas:HTMLCanvasElement,mime:'image/png'|'image/jpeg',analyse=true)=>{
  if(!room())return;const px=analyse?pixelsOf(canvas,canvas.width,canvas.height):null;
  const url=canvas.toDataURL(mime,0.85);images.push({name,kind,mime,b64:url.slice(url.indexOf(',')+1),width:canvas.width,height:canvas.height,scores:px?score(px,canvas.width/px.width):[]});
  if(NSFW_KINDS.has(kind)){nctx.fillStyle='#808080';nctx.fillRect(0,0,NSFW_INPUT,NSFW_INPUT);nctx.drawImage(canvas,0,0,NSFW_INPUT,NSFW_INPUT);nsfwQueue.push({index:images.length-1,data:nctx.getImageData(0,0,NSFW_INPUT,NSFW_INPUT)});}
 };
 const shot=(name:string,kind:string,background:number|null,mime:'image/png'|'image/jpeg'='image/png',analyse=true)=>{if(!room())return;renderer.setClearColor(background??0x000000,background===null?0:1);renderer.render(scene,camera);emit(name,kind,renderer.domElement,mime,analyse);};

 // 1) 14 full views, lit on neutral grey and flat-unlit on transparent (the unlit alpha is the silhouette).
 for(const [n,d] of dirs){aim(d);mode('lit');shot('view-lit-'+n,'view-lit',0x808080);mode('unlit');shot('view-unlit-'+n,'view-unlit',null);}
 // 2) material passes on 4 views: normals and wireframe (content shaped into geometry or hidden by lighting).
 for(const [n,d] of dirs.slice(6,10)){aim(d);mode('normal');shot('pass-normal-'+n,'pass-normal',0x000000);mode('wire');shot('pass-wire-'+n,'pass-wireframe',0xffffff,'image/png',false);}
 // 3) interior: clipping-plane sweep, 3 slices per axis, double-sided so the cut is visible; backface culling off.
 renderer.localClippingEnabled=true;const size=box.getSize(new THREE.Vector3());
 for(const [axis,v] of [['x',new THREE.Vector3(1,0,0)],['y',new THREE.Vector3(0,1,0)],['z',new THREE.Vector3(0,0,1)]] as const)for(const q of [0.25,0.5,0.75]){
  const at=box.min.clone().addScaledVector(size,q).dot(v);renderer.clippingPlanes=[new THREE.Plane(v.clone().negate(),at)];aim(v);mode('double');shot('slice-'+axis+'-'+Math.round(q*100),'slice',0x808080);
 }
 renderer.clippingPlanes=[];for(const [n,d] of [dirs[6]!,dirs[13]!]){aim(d);mode('double');shot('backface-'+n,'backface',0x808080);}

 // 4) connected parts: weld by position per mesh, find islands, then an ID pass from all 14 views shows which
 //    islands can be seen from outside at all. Big parts never seen = hidden geometry; tiny parts get close-ups.
 const islands:Island[]=[];let totalTris=0;for(const m of meshes){const g=original.get(m)!.geometry;totalTris+=(g.index?g.index.count:g.getAttribute('position').count)/3;}
 const idGeometry=new Map<THREE.Mesh,THREE.BufferGeometry>();const splitIslands=totalTris<=500_000;
 for(const m of meshes){
  const g=original.get(m)!.geometry,pos=g.getAttribute('position'),uv=g.getAttribute('uv'),idx=g.index,triCount=Math.floor((idx?idx.count:pos.count)/3),vi=(t:number,k:number)=>idx?idx.getX(t*3+k):t*3+k;
  const weld=new Map<string,number>(),parent:number[]=[],find=(x:number):number=>{while(parent[x]!==x){parent[x]=parent[parent[x]!]!;x=parent[x]!;}return x;};
  const key=(i:number)=>{const e=radius*1e-5;return Math.round(pos.getX(i)/e)+','+Math.round(pos.getY(i)/e)+','+Math.round(pos.getZ(i)/e);};
  const welded=(i:number)=>{const k=key(i);let w=weld.get(k);if(w===undefined){w=parent.length;parent.push(w);weld.set(k,w);}return w;};
  const triRoot:number[]=new Array(triCount);
  if(splitIslands){for(let t=0;t<triCount;t++){const a=find(welded(vi(t,0))),b=find(welded(vi(t,1))),c=find(welded(vi(t,2)));parent[b]=a;parent[find(c)]=find(a);}for(let t=0;t<triCount;t++)triRoot[t]=find(welded(vi(t,0)));}else triRoot.fill(0);
  const groups=new Map<number,number[]>();for(let t=0;t<triCount;t++){const r=triRoot[t]!;let l=groups.get(r);if(!l){l=[];groups.set(r,l);}l.push(t);}
  const P=new Float32Array(triCount*9),U=uv?new Float32Array(triCount*6):null,C=new Float32Array(triCount*9);let cursor=0;const v=new THREE.Vector3();
  for(const tris of groups.values()){
   const id=islands.length+1,col=new THREE.Color((id&0xff)/255,((id>>8)&0xff)/255,((id>>16)&0xff)/255),b=new THREE.Box3(),start=cursor;
   for(const t of tris){for(let k=0;k<3;k++){const i=vi(t,k);v.fromBufferAttribute(pos,i);P.set([v.x,v.y,v.z],cursor*9+k*3);if(U&&uv)U.set([uv.getX(i),uv.getY(i)],cursor*6+k*2);C.set([col.r,col.g,col.b],cursor*9+k*3);b.expandByPoint(v.clone().applyMatrix4(m.matrixWorld));}cursor++;}
   islands.push({mesh:m,start:start*3,count:tris.length*3,box:b,id});
  }
  const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.BufferAttribute(P,3));if(U)ng.setAttribute('uv',new THREE.BufferAttribute(U,2));ng.setAttribute('color',new THREE.BufferAttribute(C,3));idGeometry.set(m,ng);
 }
 const seen=new Set<number>();const idMat=new THREE.MeshBasicMaterial({vertexColors:true});
 // Non-multisampled target in linear space so every pixel holds exactly one island id (no blended edge colours).
 const target=new THREE.WebGLRenderTarget(ANALYSIS,ANALYSIS,{samples:0,colorSpace:THREE.NoColorSpace}),buf=new Uint8Array(ANALYSIS*ANALYSIS*4),out=renderer.outputColorSpace;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
 for(const [,d] of dirs){aim(d);for(const m of meshes){m.geometry=idGeometry.get(m)!;m.material=idMat;}lights.visible=false;renderer.setRenderTarget(target);renderer.setClearColor(0x000000,1);renderer.clear();renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,ANALYSIS,ANALYSIS,buf);for(let i=0;i<buf.length;i+=4){const id=buf[i]!|(buf[i+1]!<<8)|(buf[i+2]!<<16);if(id)seen.add(id);}}
 renderer.setRenderTarget(null);target.dispose();renderer.outputColorSpace=out;
 const sceneDiag=radius*2,hidden=islands.filter(i=>!seen.has(i.id)&&i.box.getSize(new THREE.Vector3()).length()>=sceneDiag*0.02);
 const tiny=islands.filter(i=>islands.length>1&&i.box.getSize(new THREE.Vector3()).length()<sceneDiag*0.05);
 const closeups:string[]=[];
 for(const [n,isl] of [...hidden.map(i=>['hidden',i] as const),...tiny.sort((a,b)=>b.count-a.count).map(i=>['tiny',i] as const)].slice(0,8)){
  for(const m of meshes)m.visible=false;isl.mesh.visible=true;isl.mesh.geometry=idGeometry.get(isl.mesh)!;const u=unlit.get(isl.mesh)!;u.side=THREE.DoubleSide;u.vertexColors=false;isl.mesh.material=u;isl.mesh.geometry.setDrawRange(isl.start,isl.count);lights.visible=false;
  const c=isl.box.getCenter(new THREE.Vector3()),r=Math.max(radius*1e-4,isl.box.getSize(new THREE.Vector3()).length()/2);
  for(const [dn,d] of [dirs[6]!,dirs[9]!,dirs[12]!,dirs[13]!]){aim(d,c,r);const name='island-'+n+'-'+isl.id+'-'+dn;shot(name,'island',0x808080,'image/jpeg');closeups.push(name);}
  isl.mesh.geometry.setDrawRange(0,Infinity);u.vertexColors=!!original.get(isl.mesh)!.geometry.getAttribute('color');
 }
 restore();

 timing.views=Math.round(performance.now()-T0);
 // 5) zoom crops chosen by saliency: each view's object pixels are scored for local contrast/edges and colour
 //    rarity, and the most salient windows (two zoom levels) are re-rendered at full resolution (true detail).
 const sal=document.createElement('canvas');sal.width=sal.height=ANALYSIS;const sctx=sal.getContext('2d',{willReadFrequently:true})!;
 for(const [n,d] of dirs){
  aim(d);mode('lit');renderer.setClearColor(0x000000,0);renderer.render(scene,camera);sctx.clearRect(0,0,ANALYSIS,ANALYSIS);sctx.drawImage(renderer.domElement,0,0,ANALYSIS,ANALYSIS);
  const wins=saliencyWindows({width:ANALYSIS,height:ANALYSIS,data:sctx.getImageData(0,0,ANALYSIS,ANALYSIS).data});
  wins.forEach((w,i)=>{const full=Math.round(SIZE*ANALYSIS/w.size);camera.setViewOffset(full,full,Math.round(w.x*full/ANALYSIS),Math.round(w.y*full/ANALYSIS),SIZE,SIZE);shot('crop-'+n+'-'+i,'grid-crop',0x808080,'image/jpeg');});
  camera.clearViewOffset();
 }

 timing.crops=Math.round(performance.now()-T0);
 // 6) texture sheets: every distinct texture image analysed at full resolution, tiled 1024² with 25% overlap.
 const textures=new Set<THREE.Texture>();for(const m of meshes)for(const mat of [original.get(m)!.material].flat() as unknown as Record<string,unknown>[])for(const v of Object.values(mat))if(v instanceof THREE.Texture&&v.image)textures.add(v);
 let tIndex=0;const tile=document.createElement('canvas'),tctx=tile.getContext('2d')!;
 for(const tex of textures){
  const img=tex.image as CanvasImageSource&{width:number;height:number};const w=Math.min(4096,img.width|0),h=Math.min(4096,img.height|0);if(!w||!h){errors.push('texture_unreadable');continue;}
  const xs=w<=TILE?[0]:[...Array(Math.ceil((w-TILE)/STRIDE)+1)].map((_,i)=>Math.min(i*STRIDE,w-TILE)),ys=h<=TILE?[0]:[...Array(Math.ceil((h-TILE)/STRIDE)+1)].map((_,i)=>Math.min(i*STRIDE,h-TILE));
  for(const y of ys)for(const x of xs){const tw=Math.min(TILE,w),th=Math.min(TILE,h);tile.width=tw;tile.height=th;tctx.clearRect(0,0,tw,th);tctx.drawImage(img,x*img.width/w,y*img.height/h,tw*img.width/w,th*img.height/h,0,0,tw,th);emit('texture-'+tIndex+'-'+x+'-'+y,'texture-tile',tile,'image/png');}
  tIndex++;
 }
 // 7) NSFW classifier over the captured inputs. A load failure is an error (→ incomplete, sexual not machine-checked).
 let nsfwOk=true;
 try{const t0=performance.now(),v=await classifyNsfwBatch(nsfwQueue.map(q=>q.data));if(v.length!==nsfwQueue.length)throw new Error('nsfw_count');nsfwQueue.forEach((q,i)=>images[q.index]!.scores.push({category:'sexual',score:v[i]!,detector:NSFW_DETECTOR}));timing.nsfw=Math.round(performance.now()-t0);}catch{nsfwOk=false;errors.push('nsfw_unavailable');}
 // 8) normalized.glb: the parsed scene re-encoded by three.js (no extensions, extras, unknown chunks or scripts),
 //    which is what the moderator's viewer loads instead of the uploaded original.
 let normalized:string|null=null;
 try{restore();const buf=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false}) as ArrayBuffer;if(buf.byteLength<=MAX_NORMALIZED){let bin='';const u8=new Uint8Array(buf);for(let i=0;i<u8.length;i+=0x8000)bin+=String.fromCharCode(...u8.subarray(i,i+0x8000));normalized=btoa(bin);}else errors.push('normalized_too_large');}catch{errors.push('normalize_failed');}
 renderer.dispose();
 return {images,truncated,errors,normalized,nsfw:{ok:nsfwOk,backend:nsfwOk?nsfwBackend():null,inputs:nsfwQueue.length},timing,geometry:{islands:islands.length,hidden:hidden.length,tiny:tiny.length,closeups,splitIslands,triangles:totalTris},textures:textures.size};
};

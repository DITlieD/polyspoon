// Interactive 3D viewer for the moderator detail page. Loaded on demand (code-split) and only on explicit click.
// The bytes come from the moderator-only endpoint; the file already passed the sandboxed structural checks.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
export async function mountViewer(host:HTMLElement,bytes:Uint8Array):Promise<()=>void>{
 const width=host.clientWidth||640,height=Math.round(width*0.75);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.setSize(width,height);host.replaceChildren(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a8f99);scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.3));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(3,5,4);scene.add(key);
 const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');scene.add(gltf.scene);
 const box=new THREE.Box3().setFromObject(gltf.scene),center=box.getCenter(new THREE.Vector3()),radius=Math.max(1e-3,box.getSize(new THREE.Vector3()).length()/2);
 const camera=new THREE.PerspectiveCamera(35,width/height,radius/100,radius*100);camera.position.copy(center).add(new THREE.Vector3(1,0.8,1).normalize().multiplyScalar(radius*3));
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(center);controls.update();
 let wire=false;const toggle=document.createElement('button');toggle.type='button';toggle.className='button-secondary';toggle.textContent='Toggle wireframe';toggle.addEventListener('click',()=>{wire=!wire;gltf.scene.traverse(o=>{const m=(o as THREE.Mesh).material;for(const x of [m].flat())if(x&&'wireframe' in x)(x as THREE.MeshStandardMaterial).wireframe=wire;});});host.append(toggle);
 let alive=true;const loop=()=>{if(!alive)return;controls.update();renderer.render(scene,camera);requestAnimationFrame(loop);};loop();
 return ()=>{alive=false;controls.dispose();renderer.dispose();host.replaceChildren();};
}

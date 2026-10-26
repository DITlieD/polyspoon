import {exportBundle,snapshotModule,zipFiles} from '../catalog/export.ts';
import {exportDeliverable} from '../catalog/delivery.ts';
import type {SemanticAssetBuild} from '../catalog/types.ts';

const encode=(value:string)=>new TextEncoder().encode(value);
function rigSnapshotModule(bytes:Uint8Array,config:SemanticAssetBuild['config']):string {
 let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
 return "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nexport const configuration="+JSON.stringify(config)+";\nexport function glbBytes(){return Uint8Array.from(atob("+JSON.stringify(btoa(binary))+"),character=>character.charCodeAt(0));}\nexport async function createAsset(){const gltf=await new GLTFLoader().parseAsync(glbBytes().buffer,'');gltf.scene.animations=gltf.animations;return gltf.scene;}\n";
}
export async function exportSnapshotModule(build:SemanticAssetBuild):Promise<string> {
 const bytes=await exportDeliverable(build);return 'rig' in build?rigSnapshotModule(bytes,build.config):snapshotModule(bytes,build.config);
}
export async function exportStudioBundle(build:SemanticAssetBuild){
 if(!('rig' in build))return exportBundle(build);
 const bytes=await exportDeliverable(build),module=rigSnapshotModule(bytes,build.config),name=build.config.family;
 const preview='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+' preview</title><style>body{margin:0;background:#f4f6fa;font:14px system-ui}canvas{display:block}#status{position:fixed;bottom:16px;left:16px;padding:8px 12px;background:#ffffffdd;border-radius:8px}</style><div id="status">Loading online preview…</div><script type="importmap">'+JSON.stringify({imports:{three:'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js','three/addons/':'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/'}})+'</script><script type="module">'+module+`
import {Scene,Color,WebGLRenderer,OrthographicCamera,HemisphereLight,DirectionalLight,Box3,Vector3} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
try {
 const scene=new Scene();scene.background=new Color('#f4f6fa');const renderer=new WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.append(renderer.domElement);
 const camera=new OrthographicCamera(-1,1,1,-1,.001,1000),orbit=new OrbitControls(camera,renderer.domElement);scene.add(new HemisphereLight(0xffffff,0xb6bdb0,1.6));const light=new DirectionalLight(0xfffaf0,2.3);light.position.set(-2,5,3);scene.add(light);
 const model=await createAsset();scene.add(model);const bounds=new Box3().setFromObject(model),center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3()).length();camera.position.copy(center).addScaledVector(new Vector3(2.7,1.85,3.5).normalize(),size*3);camera.lookAt(center);orbit.target.copy(center);orbit.update();
 function resize(){const aspect=innerWidth/innerHeight,span=size*1.25/Math.min(aspect,1);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
 addEventListener('resize',resize);resize();renderer.setAnimationLoop(()=>{orbit.update();renderer.render(scene,camera);});document.getElementById('status').textContent='Drag to orbit · Scroll to zoom · Static preview; clips available in GLB and module.';
} catch(error){document.getElementById('status').textContent='Preview failed: '+error.message;}
`+'</script></html>';
 const files:Record<string,Uint8Array>={[name+'.glb']:bytes,[name+'.design.json']:encode(JSON.stringify(build.config,null,2)),[name+'.mjs']:encode(module),'preview.html':encode(preview),'README.txt':encode('Open preview.html in a current browser. It includes the model and loads Three.js 0.186.1 from jsDelivr, so internet access is required.\nThe preview is static. The GLB and snapshot module retain skeletons and animation clips.\nIn a project with Three.js installed, import createAsset() and add the awaited scene. Its animations array contains the clips for your own AnimationMixer. The module is a GLB snapshot, not a procedural generator.\nThe saved design preserves the selected parameters and appearance. Viewer-only effects are not exported.\n')};
 return {files,bytes:zipFiles(files)};
}

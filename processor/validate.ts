import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {identity} from '../src/review/identity.ts';
import {validateBytes} from 'gltf-validator';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Vector3,Mesh} from 'three';
import {glbExtensionFailure} from './glb-extensions.ts';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
class Failure extends Error{constructor(readonly code:string,detail=''){super(detail||code);}}
async function main(){
 const metadata=JSON.parse(await readFile('/input/metadata.json','utf8')),cases=[];
 for(const item of metadata.cases){
  const a=await readFile('/input/a/'+item.file),b=await readFile('/input/b/'+item.file);if(hash(a)!==hash(b)||a.length!==b.length)throw new Failure('nondeterministic_output','nondeterministic_output:'+item.id);
  if(a.length<20||a.readUInt32LE(0)!==0x46546c67||a.readUInt32LE(4)!==2||a.readUInt32LE(8)!==a.length)throw new Failure('glb_invalid','invalid_glb');
  const document=JSON.parse(a.subarray(20,20+a.readUInt32LE(12)).toString('utf8'));if([...document.buffers??[],...document.images??[]].some(value=>value.uri))throw new Failure('glb_external_resource','external_resource');const extensionFailure=glbExtensionFailure(document);if(extensionFailure)throw new Failure('glb_unsupported_extension',extensionFailure);const jsonLength=a.readUInt32LE(12),binHeader=20+jsonLength;if(binHeader+8>a.length||a.readUInt32LE(binHeader+4)!==0x004e4942)throw new Failure('glb_invalid','missing_embedded_buffer');const binaryLength=a.readUInt32LE(binHeader),binaryOffset=binHeader+8;if(binaryOffset+binaryLength>a.length||document.buffers?.length!==1||document.buffers[0].byteLength>binaryLength)throw new Failure('glb_invalid','invalid_embedded_buffer');if((document.images?.length??0)>16)throw new Failure('glb_image_limit','image_count');for(const image of document.images??[]){const view=document.bufferViews?.[image.bufferView],offset=view?.byteOffset??0,length=view?.byteLength;if(!view||view.buffer!==0||!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<24||length>2097152||offset+length>binaryLength||image.mimeType!=='image/png')throw new Failure('glb_image_limit','unsupported_embedded_image');const png=a.subarray(binaryOffset+offset,binaryOffset+offset+length);if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.toString('ascii',12,16)!=='IHDR'||!png.readUInt32BE(16)||!png.readUInt32BE(20)||png.readUInt32BE(16)>2048||png.readUInt32BE(20)>2048)throw new Failure('glb_image_limit','image_dimensions');}
  const checked=await validateBytes(a,{uri:item.file,maxIssues:100});if(checked.issues.numErrors||checked.issues.numWarnings)throw new Failure('glb_invalid','glb_validation:'+item.id);
  const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(a).buffer,''),names=new Set<string>();let triangles=0,config=false;
  loaded.scene.traverse(node=>{names.add(node.name);if(node.userData.configuration){if(identity(node.userData.configuration)===item.configHash)config=true;}if(node instanceof Mesh){const position=node.geometry.getAttribute('position'),index=node.geometry.getIndex();if(!position||!position.count||Array.from(position.array).some(value=>!Number.isFinite(value)))throw new Failure('geometry_invalid','invalid_positions');const count=index?.count??position.count;if(count%3)throw new Failure('geometry_invalid','invalid_triangles');triangles+=count/3;}});
  const dimensions=new Box3().setFromObject(loaded.scene).getSize(new Vector3()).toArray();if(!triangles||dimensions.some(value=>!Number.isFinite(value)||value<0)||!config||item.parts.some((part:string)=>part!=='model'&&!names.has(part)))throw new Failure('configuration_mismatch','geometry_or_configuration:'+item.id);
  cases.push({id:item.id,configHash:item.configHash,sha256:hash(a),repeatSha256:hash(b),bytes:a.length,dimensions,triangles,parts:[...names].filter(Boolean).sort()});
 }
 console.log(JSON.stringify({cases,checks:['glb-schema','geometry-finite','config-binding','deterministic-output']}));
}
main().catch(error=>{console.error(String(error.message));console.log(JSON.stringify({failureCode:error instanceof Failure?error.code:'glb_invalid'}));process.exitCode=1;});

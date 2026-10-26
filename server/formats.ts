import type {Env,PrivateObjects} from './types.ts';
import {HttpError} from './domain.ts';
import {readVerifiedArtifact} from './verification.ts';
import type {VerifiedArtifact} from './verification.ts';
import {convertGlb,type ExportFormat} from '../src/formats/index.ts';
import {controlsDocument} from '../src/formats/controls.ts';

// Extra download formats are derived on request from the verified, published
// selected.glb. They are deterministic, so the descriptor a member sees in the
// model detail always matches the bytes served by /files.
export const derivedFormats:Record<string,{format:ExportFormat|'controls';media_type:string}>={
 'formats/selected.obj.zip':{format:'obj',media_type:'application/zip'},
 'formats/selected.fbx':{format:'fbx',media_type:'application/octet-stream'},
 'formats/selected.usdz':{format:'usdz',media_type:'model/vnd.usdz+zip'},
 'formats/selected.controls.json':{format:'controls',media_type:'application/json'},
};
export const isDerivedPath=(path:string)=>Object.hasOwn(derivedFormats,path);
async function digest(data:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(data)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function derive(path:string,glb:Uint8Array,design:unknown):Uint8Array{
 const entry=derivedFormats[path];if(!entry)throw new HttpError(404,'artifact_not_found');
 if(entry.format==='controls')return new TextEncoder().encode(JSON.stringify(controlsDocument({design:design as never,glb}),null,2)+'\n');
 try{return convertGlb(glb,entry.format,'selected');}catch{throw new HttpError(422,'format_conversion_failed');}
}
export async function selectedGlb(env:Env,objects:PrivateObjects,id:string){
 const artifact=await env.DB.prepare("SELECT * FROM version_artifact WHERE version_id=? AND path='selected.glb' AND uploaded=1").bind(id).first<VerifiedArtifact>();
 if(!artifact||artifact.media_type!=='model/gltf-binary')return null;return readVerifiedArtifact(env,objects,id,artifact);
}
export async function derivedDescriptors(glb:Uint8Array,design:unknown){
 const out:{path:string;sha256:string;bytes:number;media_type:string}[]=[];
 for(const [path,entry] of Object.entries(derivedFormats)){try{const data=derive(path,glb,design);out.push({path,sha256:await digest(data),bytes:data.length,media_type:entry.media_type});}catch{}}
 return out;
}

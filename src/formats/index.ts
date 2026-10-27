import {readGlb} from './gltf-read.ts';
import {toFbx,toObjZip,toUsdz} from './writers.ts';
export {readGlb,bounds} from './gltf-read.ts';
export type ExportFormat='obj'|'fbx'|'usdz';
export const exportFormats:Record<ExportFormat,{extension:string;mediaType:string;label:string}>={
 obj:{extension:'.obj.zip',mediaType:'application/zip',label:'OBJ + MTL (zip)'},
 fbx:{extension:'.fbx',mediaType:'application/octet-stream',label:'FBX 7.4 binary'},
 usdz:{extension:'.usdz',mediaType:'model/vnd.usdz+zip',label:'USDZ'},
};
/** What a conversion to OBJ/FBX/USDZ will lose. Empty means a faithful static conversion. */
export function conversionLosses(glb:Uint8Array):string[]{return readGlb(glb).dropped;}
/** convertGlb plus the list of dropped features, for callers that must surface them (CLI, batch QA). */
export function convertGlbReport(glb:Uint8Array,format:ExportFormat,name='model'):{bytes:Uint8Array;dropped:string[]}{
 const scene=readGlb(glb);if(!scene.meshes.length)throw Error('glb_no_meshes');
 return {bytes:format==='obj'?toObjZip(scene,name):format==='fbx'?toFbx(scene):toUsdz(scene,name),dropped:scene.dropped};
}
/** Convert verified GLB bytes into another interchange format. Deterministic: same input, same bytes. */
export function convertGlb(glb:Uint8Array,format:ExportFormat,name='model'):Uint8Array{
 const scene=readGlb(glb);if(!scene.meshes.length)throw Error('glb_no_meshes');
 return format==='obj'?toObjZip(scene,name):format==='fbx'?toFbx(scene):toUsdz(scene,name);
}

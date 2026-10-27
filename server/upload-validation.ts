// Structural checks for uploaded GLB / glTF files. Pure and dependency-free so the Worker (pre-check)
// and the no-network sandbox (full check) run the exact same rules. Passing here never approves anything:
// it only makes an upload eligible for the automated pre-review and then human review.
export const UPLOAD_LIMITS={maxBytes:50*1024*1024,maxTriangles:2_000_000,maxImages:64,maxNodes:256,maxStrings:2000,maxStringLength:200};
export const ALLOWED_EXTENSIONS=new Set(['KHR_materials_unlit','KHR_materials_emissive_strength','KHR_texture_transform','KHR_mesh_quantization']);
export type UploadFormat='glb'|'gltf';
export type ValidationResult={ok:true;triangles:number;nodes:number;images:number;strings:string[]}|{ok:false;reason:string};
const fail=(reason:string):ValidationResult=>({ok:false,reason});
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];

export function sniffFormat(data:Uint8Array):UploadFormat|null{
 if(data.length>=12&&data[0]===0x67&&data[1]===0x6c&&data[2]===0x54&&data[3]===0x46)return 'glb';
 let i=0;if(data[0]===0xef&&data[1]===0xbb&&data[2]===0xbf)i=3;while(i<data.length&&[0x20,0x09,0x0a,0x0d].includes(data[i]!))i++;
 return data[i]===0x7b?'gltf':null;
}
function u32(data:Uint8Array,offset:number){return new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(offset,true);}

export function parseDocument(data:Uint8Array,format:UploadFormat):{document:Record<string,unknown>;binaryLength:number}|string{
 if(sniffFormat(data)!==format)return 'magic_mismatch';
 let text:string,binaryLength=0;
 if(format==='glb'){
  if(data.length<20||u32(data,4)!==2)return 'glb_version';
  if(u32(data,8)!==data.length)return 'glb_length';
  const jsonLength=u32(data,12);if(u32(data,16)!==0x4e4f534a||20+jsonLength>data.length)return 'glb_json_chunk';
  text=new TextDecoder('utf-8',{fatal:false}).decode(data.subarray(20,20+jsonLength));
  const bin=20+jsonLength;if(bin<data.length){if(bin+8>data.length||u32(data,bin+4)!==0x004e4942)return 'glb_bin_chunk';binaryLength=u32(data,bin);if(bin+8+binaryLength>data.length)return 'glb_bin_chunk';}
 }else text=new TextDecoder().decode(data);
 let document:unknown;try{document=JSON.parse(text);}catch{return 'json_invalid';}
 if(!record(document)||!record(document.asset)||document.asset.version!=='2.0')return 'gltf_version';
 return {document,binaryLength};
}

export function validateUpload(data:Uint8Array,format:UploadFormat):ValidationResult{
 if(!data.length||data.length>UPLOAD_LIMITS.maxBytes)return fail('size_limit');
 const parsed=parseDocument(data,format);if(typeof parsed==='string')return fail(parsed);
 const {document}=parsed;
 for(const key of ['extensionsUsed','extensionsRequired']){const v=document[key];if(v!==undefined&&(!Array.isArray(v)||v.some(e=>typeof e!=='string'||!ALLOWED_EXTENSIONS.has(e))))return fail('unsupported_extension');}
 for(const [kind,items] of [['buffers',document.buffers],['images',document.images]] as const)for(const item of list(items)){
  if(!record(item))return fail('gltf_structure');
  if(item.uri!==undefined){if(typeof item.uri!=='string'||!/^data:[a-z0-9.+\/-]*;base64,/i.test(item.uri))return fail('external_resource');}
  else if(kind==='buffers'&&format==='gltf')return fail('external_resource');
  if(kind==='images'&&item.mimeType!==undefined&&!['image/png','image/jpeg'].includes(String(item.mimeType)))return fail('image_type');
 }
 const nodes=list(document.nodes).length,images=list(document.images).length;
 if(nodes>UPLOAD_LIMITS.maxNodes)return fail('node_limit');if(images>UPLOAD_LIMITS.maxImages)return fail('image_limit');
 if(JSON.stringify(document).match(/"(?:script|javascript|onload)"/i))return fail('embedded_script');
 const accessors=list(document.accessors);let triangles=0;
 for(const mesh of list(document.meshes)){if(!record(mesh))return fail('gltf_structure');for(const p of list(mesh.primitives)){
  if(!record(p)||!record(p.attributes))return fail('gltf_structure');const mode=p.mode??4;if(mode!==4)continue;
  const ref=p.indices??p.attributes.POSITION;const accessor=typeof ref==='number'?accessors[ref]:undefined;if(!record(accessor)||!Number.isSafeInteger(accessor.count))return fail('gltf_structure');
  triangles+=Math.floor(Number(accessor.count)/3);if(triangles>UPLOAD_LIMITS.maxTriangles)return fail('triangle_limit');
 }}
 if(!triangles)return fail('no_geometry');
 return {ok:true,triangles,nodes,images,strings:extractStrings(document)};
}

/** Every human-readable string in the file (names, extras, generator, copyright), capped, for the text scan. Data, never instructions. */
export function extractStrings(document:Record<string,unknown>):string[]{
 const out=new Set<string>();
 // Everything under `extras` is free-form user data, so every string (and every key) in it is collected.
 const add=(v:string)=>{if(v.trim())out.add(v.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,UPLOAD_LIMITS.maxStringLength));};
 const visit=(v:unknown,key:string,depth:number,free:boolean)=>{
  if(out.size>=UPLOAD_LIMITS.maxStrings||depth>32)return;
  if(typeof v==='string'){if(key==='uri'&&!free)return;add(v);return;}
  if(Array.isArray(v)){for(const x of v)visit(x,key,depth+1,free);return;}
  if(record(v))for(const [k,x] of Object.entries(v)){if(free)add(k);if(free||k==='extras'||k==='name'||k==='generator'||k==='copyright'||record(x)||Array.isArray(x))visit(x,k,depth+1,free||k==='extras');}
 };
 visit(document,'',0,false);return [...out];
}

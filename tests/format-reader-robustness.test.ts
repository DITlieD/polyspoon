import test from 'node:test';
import assert from 'node:assert/strict';
import {convertGlb,readGlb} from '../src/formats/index.ts';
import {toUsda} from '../src/formats/writers.ts';

// Builds a GLB with one triangle; `patch` edits the JSON before packing.
function glb(patch:(json:any)=>void=()=>{},binBytes?:Uint8Array){
 const bin=binBytes??new Uint8Array(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer);
 const json:any={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'tri'}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],bufferViews:[{buffer:0,byteLength:bin.length}],buffers:[{byteLength:bin.length}]};
 patch(json);
 const pad=(b:Uint8Array,fill:number)=>{const o=new Uint8Array(Math.ceil(b.length/4)*4).fill(fill);o.set(b);return o;};
 const j=pad(new TextEncoder().encode(JSON.stringify(json)),0x20),b=pad(bin,0),out=new Uint8Array(12+8+j.length+8+b.length),v=new DataView(out.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);v.setUint32(12,j.length,true);v.setUint32(16,0x4e4f534a,true);out.set(j,20);
 v.setUint32(20+j.length,b.length,true);v.setUint32(24+j.length,0x004e4942,true);out.set(b,28+j.length);return out;
}

test('minimal GLB converts to every format',()=>{
 const scene=readGlb(glb());assert.equal(scene.meshes.length,1);assert.equal(scene.materials.length,1,'fallback material added');
 for(const f of ['obj','fbx','usdz'] as const)assert.ok(convertGlb(glb(),f,'tri').length>0);
});
test('malformed GLBs fail with a named error instead of garbage output',()=>{
 assert.throws(()=>readGlb(new Uint8Array(8)),/glb_invalid/);
 const truncated=glb().subarray(0,40);new DataView(truncated.buffer).setUint32(8,40,true);assert.throws(()=>readGlb(truncated),/glb_truncated/);
 assert.throws(()=>readGlb(glb(j=>{j.accessors[0].count=99;})),/glb_accessor_out_of_range/);
 assert.throws(()=>readGlb(glb(j=>{j.accessors[0].sparse={count:1};delete j.accessors[0].bufferView;})),/glb_sparse_unsupported/);
 assert.throws(()=>readGlb(glb(j=>{j.accessors[0].type='MAT9';})),/glb_accessor_type/);
 assert.throws(()=>readGlb(glb(j=>{j.nodes[0].children=[0];})),/glb_node_cycle/);
 assert.throws(()=>readGlb(glb(j=>{j.nodes[0].mesh=5;})),/glb_mesh_missing/);
});
test('out-of-range indices and material references are caught',()=>{
 const bin=new Uint8Array(36+12);bin.set(new Uint8Array(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer));bin.set(new Uint8Array(new Uint32Array([0,1,7]).buffer),36);
 const withIndices=(j:any)=>{j.bufferViews=[{buffer:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:12}];j.accessors.push({bufferView:1,componentType:5125,count:3,type:'SCALAR'});j.meshes[0].primitives[0].indices=1;};
 assert.throws(()=>readGlb(glb(withIndices,bin)),/glb_indices_invalid/);
 const scene=readGlb(glb(j=>{j.meshes[0].primitives[0].material=4;}));assert.equal(scene.materials[scene.meshes[0]!.material]!.name,'default');
});
test('a mesh named Materials does not collide with the USD material scope',()=>{
 const scene=readGlb(glb(j=>{j.nodes[0].name='Materials';}));assert.equal(scene.meshes[0]!.name,'Materials_1');
 assert.equal((toUsda(scene,'m').match(/"Materials"/g)??[]).length,1);
});

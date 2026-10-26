import test from 'node:test';
import assert from 'node:assert/strict';

const name='KHR_materials_unlit';
const material=()=>({extensions:{[name]:{}}});
test('unlit compatibility accepts only material flags with consistent declarations',async()=>{
 const {glbExtensionFailure}=await import('../processor/glb-extensions.ts');
 for(const document of [{},{materials:[{}]},{extensionsUsed:[],extensionsRequired:[]},{extensionsUsed:[name],materials:[material()]},{extensionsUsed:[name],extensionsRequired:[name],materials:[material(),{}]},{extras:{extensions:{VENDOR_metadata:{uri:'metadata-only'}}}}])assert.equal(glbExtensionFailure(document),undefined);
});

test('unlit compatibility rejects other rendering extensions and malformed flags',async()=>{
 const {glbExtensionFailure}=await import('../processor/glb-extensions.ts');
 const documents=[
  {extensionsUsed:['KHR_materials_clearcoat']},
  {extensionsRequired:['KHR_materials_clearcoat']},
  {extensionsUsed:[name,'VENDOR_unknown'],materials:[material()]},
  {extensionsUsed:[name,name],materials:[material()]},
  {extensionsUsed:[name],extensionsRequired:[name,name],materials:[material()]},
  {extensionsUsed:name,materials:[material()]},
  {extensionsUsed:null,materials:[material()]},
  {extensionsRequired:[name],materials:[material()]},
  {materials:[material()]},
  {extensionsUsed:[name],materials:[{}]},
  {extensionsUsed:[name],extensions:{[name]:{}},materials:[{}]},
  {extensionsUsed:[name],nodes:[{extensions:{[name]:{}}}],materials:[{}]},
  {extensionsUsed:[name],materials:[{pbrMetallicRoughness:{extensions:{[name]:{}}}}]},
  {extensionsUsed:[name],materials:[{extensions:{[name]:{unexpected:1}}}]},
  {extensionsUsed:[name],materials:[{extensions:{[name]:[]}}]},
  {extensionsUsed:[name],materials:[{extensions:{[name]:null}}]},
  {extensionsUsed:[name],materials:[{extensions:{[name]:{},VENDOR_unknown:{}}}]},
  {extensionsUsed:[name],materials:[{extensions:[]}]},
  {materials:[{extensions:{VENDOR_unknown:{}}}]},
 ];
 for(const document of documents)assert.equal(typeof glbExtensionFailure(document),'string',JSON.stringify(document));
});

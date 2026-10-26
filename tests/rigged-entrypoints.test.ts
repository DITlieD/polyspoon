import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Mesh,SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateBytes } from 'gltf-validator';
import { sha256 } from '../scripts/provenance.ts';

const cases=[
 {id:'stylized-humanoid',parameters:{height:1.9},skins:5,bones:20,hash:'228b268364c8ccf461495436a2523e3bb91b4773b085188590fa20a83d9a7483'},
 {id:'stylized-fox',parameters:{bodyLength:.6},skins:3,bones:28,hash:'b5d40fbf316763faae267d060b0a8ef4febcea78e4494a857a2091eaee2686e2'},
 {id:'bench',parameters:{width:2.2,backrest:false},skins:0,bones:0,hash:'b97b2e6dc7886bf85aac1a77473d63fe349869fde05b5e9887fdbc043e7942e5'},
];
async function workspace(prefix:string){const root=resolve('evidence/rigged-catalog/entrypoints');await mkdir(root,{recursive:true});return mkdtemp(join(root,prefix));}
async function inspect(bytes:Uint8Array,expected:typeof cases[number]){
 const checked=await validateBytes(bytes);assert.equal(checked.issues.numErrors,0,JSON.stringify(checked.issues));assert.equal(checked.issues.numWarnings,0);
 assert.equal(sha256(bytes),expected.hash);const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
 assert.deepEqual(loaded.animations.map(clip=>clip.name),expected.skins?['idle','walk']:[]);let skins=0;const resources=new Set<{dispose():void}>();
 loaded.scene.traverse(node=>{if(node instanceof Mesh){resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])resources.add(material);}if(node instanceof SkinnedMesh){skins++;assert.equal(node.skeleton.bones.length,expected.bones);resources.add(node.skeleton);}});assert.equal(skins,expected.skins);for(const resource of resources)resource.dispose();
}

test('actual MCP export tool retains custom rig clips and rigid compatibility',{timeout:60000},async()=>{
 const output=await workspace('mcp-'),transport=new StdioClientTransport({command:process.execPath,args:['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('src/mcp/stdio.ts'),'--output-dir',output],cwd:process.cwd(),stderr:'pipe'}),client=new Client({name:'export-verification',version:'1.0.0'});const errors:string[]=[];transport.stderr?.on('data',data=>errors.push(String(data)));
 try{
  await client.connect(transport);const rows=[];
  for(const expected of cases){
   const response=await client.callTool({name:'export_asset',arguments:{family:expected.id,parameters:expected.parameters,filename:expected.id+'.glb'}});assert.ok(!response.isError,JSON.stringify(response));const content=response.content.find(item=>item.type==='text');assert.ok(content&&content.type==='text');const result=JSON.parse(content.text);assert.deepEqual(response.structuredContent,result);assert.equal(result.path,join(output,expected.id+'.glb'));
   const bytes=await readFile(result.path);assert.equal(result.sha256,sha256(bytes));assert.equal(result.bytes,bytes.length);await inspect(bytes,expected);rows.push(result);
  }
  await writeFile(join(output,'receipt.json'),JSON.stringify({scope:'Actual MCP stdio export responses and written GLB files.',rows},null,2)+'\n');
 }finally{await client.close();await writeFile(join(output,'stderr.log'),errors.join(''));}
});

test('actual bridge response writes valid custom animated rig GLBs',{timeout:60000},async()=>{
 const output=await workspace('bridge-'),rows=[];
 for(const expected of cases){
  const request={protocolVersion:1,operation:'build',family:expected.id,parameters:expected.parameters};await writeFile(join(output,expected.id+'.request.json'),JSON.stringify(request));
  const run=spawnSync(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('scripts/unity-bridge.ts')],{cwd:process.cwd(),input:JSON.stringify(request),encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});assert.equal(run.status,0,run.stdout+run.stderr);const result=JSON.parse(run.stdout),bytes=Buffer.from(result.glbBase64,'base64');assert.equal(result.glbSha256,sha256(bytes));await writeFile(join(output,expected.id+'.glb'),bytes);await inspect(bytes,expected);const {glbBase64,...metadata}=result;rows.push(metadata);
 }
 await writeFile(join(output,'receipt.json'),JSON.stringify({scope:'Actual bridge CLI responses decoded to GLB files. No native Unity import claimed.',rows},null,2)+'\n');
});

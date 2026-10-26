import { setJointPose } from '../src/catalog/semantics.ts';
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hostname, cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Mesh } from 'three';
import type { Group } from 'three';
import { catalog, buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';
import { geometrySnapshot } from '../src/lantern/inspect.ts';
import { sha256 } from './recipe-package-core.ts';
import { buildProceduralModules } from './recipe-module.ts';

const output=resolve(process.argv[2]??'evidence/revision10/procedural-module/consumer');
await mkdir(output,{recursive:false});
const packages=join(output,'packages');
const index=await buildProceduralModules(packages);
const consumer=join(output,'standalone');
await mkdir(join(consumer,'node_modules'),{recursive:true});
await mkdir(join(consumer,'node_modules/three/build'),{recursive:true});
for(const file of ['package.json','LICENSE','build/three.module.js','build/three.core.js'])await cp(resolve('node_modules/three',file),join(consumer,'node_modules/three',file));
function materialSnapshot(root:Group){
  const values:unknown[]=[];
  root.traverse(object=>{if(object instanceof Mesh){const materials=(Array.isArray(object.material)?object.material:[object.material]).map(material=>{const {uuid,metadata,...properties}=material.toJSON();return properties;});values.push({name:object.name,materials});}});
  return values;
}
const cases=[];
for(const d of catalog){
  const base=buildAsset(d.id),baseline=sha256(JSON.stringify(geometrySnapshot(base.root)));
  let firstPart='';base.root.traverse(object=>{if(object instanceof Mesh&&!firstPart)firstPart=object.name;});
  const inputs:{name:string;input:Record<string,unknown>;pose?:{id:string;angle:number}}[]=[{name:'default',input:{}}];
  for(const c of recipe(d.id).validationCases){
    const build=buildAsset(d.id,c.parameters);
    const changed=sha256(JSON.stringify(geometrySnapshot(build.root)))!==baseline;disposeAsset(build);
    if(changed){inputs.push({name:'structural-'+c.id,input:c.parameters});break;}
  }
  if(inputs.length!==2)throw new Error('No structural variant: '+d.id);
  const color=d.controls.find(control=>control.kind==='color');
  if(!color)throw new Error('No semantic color control: '+d.id);
  inputs.push({name:'color',input:{[color.key]:'#ab3def'}},{name:'appearance',input:{...inputs[1]!.input,appearance:{version:1,palette:'PICO8',shading:'Toon3bands',partColors:{[firstPart]:'#e02593'}}}});
  if(base.semantics?.joints.length)inputs.push({name:'runtime-pose',input:{},pose:{id:base.semantics.joints[0]!.id,angle:60}});
  for(const {name,input,pose} of inputs){
    const start=performance.now(),before=process.memoryUsage().heapUsed;
    const build=buildAsset(d.id,input);if(pose)setJointPose(build.root,pose.id,pose.angle);
    try{
      const snapshot=geometrySnapshot(build.root),geometry=sha256(JSON.stringify(snapshot)),materialState=materialSnapshot(build.root),materials=sha256(JSON.stringify(materialState));
      if(name==='color'&&geometry!==baseline)throw new Error('Canonical color changed geometry: '+d.id);
      cases.push({id:d.id,version:d.version,name,input,...(pose?{pose}:{}),geometry,materials,design:build.config,semantics:build.semantics,meshCount:snapshot.length,materialCount:new Set(Object.values(build.materials)).size,canonicalMs:performance.now()-start,heapDelta:process.memoryUsage().heapUsed-before});
    }finally{disposeAsset(build);}
  }
  disposeAsset(base);
  await cp(join(packages,d.id,d.version,'asset.mjs'),join(consumer,d.id+'.mjs'));
  await cp(join(packages,d.id,d.version,'asset.d.mts'),join(consumer,d.id+'.d.mts'));
}
await writeFile(join(consumer,'cases.json'),JSON.stringify(cases));
await writeFile(join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{three:'0.186.1'}}));
const runner=[
  "import assert from 'node:assert/strict';",
  "import {readFile,writeFile} from 'node:fs/promises';",
  "import {createHash} from 'node:crypto';",
  "import {performance} from 'node:perf_hooks';",
  "import {Group,Mesh} from 'three';",
  "const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');",
  "function snapshot(root){root.updateMatrixWorld(true);const parts=[];root.traverse(object=>{if(object instanceof Mesh)parts.push({name:object.name,matrix:object.matrixWorld.toArray(),attributes:Object.fromEntries(Object.entries(object.geometry.attributes).map(([key,value])=>[key,{itemSize:value.itemSize,array:Array.from(value.array)}])),indices:object.geometry.index?Array.from(object.geometry.index.array):null});});return parts;}",
  "function materials(root){const parts=[];root.traverse(object=>{if(object instanceof Mesh)parts.push({name:object.name,materials:(Array.isArray(object.material)?object.material:[object.material]).map(material=>{const {uuid,metadata,...properties}=material.toJSON();return properties;})});});return parts;}",
  "const cases=JSON.parse(await readFile(new URL('./cases.json',import.meta.url),'utf8')),results=[];",
  "for(const c of cases){const module=await import('./'+c.id+'.mjs');const before=process.memoryUsage().heapUsed,start=performance.now();const root=module.createAsset(c.input);if(c.pose)module.setJointPose(root,c.pose.id,c.pose.angle);assert.ok(root instanceof Group);assert.equal(typeof root.then,'undefined');const elapsed=performance.now()-start;assert.equal(hash(snapshot(root)),c.geometry,c.id+'/'+c.name+' geometry');assert.equal(hash(materials(root)),c.materials,c.id+'/'+c.name+' materials');assert.deepEqual(root.userData.design,c.design);assert.deepEqual(root.userData.openpoly,c.semantics);const again=module.createAsset(c.input);if(c.pose)module.setJointPose(again,c.pose.id,c.pose.angle);assert.notEqual(root,again);let a,b;root.traverse(object=>{if(object instanceof Mesh&&!a)a=object;});again.traverse(object=>{if(object instanceof Mesh&&!b)b=object;});assert.notEqual(a.geometry,b.geometry);assert.notEqual(a.material,b.material);let disposed=0;a.geometry.addEventListener('dispose',()=>disposed++);module.disposeAsset(root);module.disposeAsset(root);assert.equal(disposed,1);assert.equal(hash(snapshot(again)),c.geometry);module.disposeAsset(again);for(const bad of [null,[],{unknown:1},{[module.metadata.controls[0].key]:null},{appearance:{version:9}}])assert.throws(()=>module.createAsset(bad));results.push({id:c.id,name:c.name,synchronous:true,geometry:c.geometry,materials:c.materials,ms:elapsed,heapDelta:process.memoryUsage().heapUsed-before});}",
  "await writeFile(new URL('./results.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify({cases:results.length,families:new Set(results.map(r=>r.id)).size,synchronous:true,independentResources:true,malformedInputsRejected:true}));",
].join('\n');
await writeFile(join(consumer,'run.mjs'),runner);
await writeFile(join(consumer,'browser.html'),'<script type="importmap">'+JSON.stringify({imports:{three:'./node_modules/three/build/three.module.js'}})+'</script><script type="module">import { Group } from "three";const cases=await(await fetch("./cases.json")).json();const results=[];for(const c of cases){const m=await import("./"+c.id+".mjs");const root=m.createAsset(c.input);if(c.pose)m.setJointPose(root,c.pose.id,c.pose.angle);if(!(root instanceof Group)||root.then)throw Error(c.id+" is not synchronous");results.push({id:c.id,name:c.name,synchronous:true,children:root.children.length});m.disposeAsset(root);}globalThis.proceduralConsumerResults=results;document.body.textContent=JSON.stringify(results,null,2);</script>');
const result=spawnSync(process.execPath,[join(consumer,'run.mjs')],{cwd:consumer,encoding:'utf8'});
await writeFile(join(output,'consumer.log'),result.stdout+result.stderr);
await writeFile(join(output,'receipt.json'),JSON.stringify({device:{hostname:hostname(),cpu:cpus()[0]?.model,node:process.versions.node},index,canonicalCases:cases,consumer:{status:result.status,signal:result.signal,error:result.error?.message},limits:'Heap deltas include garbage collection and temporary snapshots; they are observations, not allocation counts. No rendering or semantic joint acceptance is established.'},null,2));
if(result.error)throw result.error;
if(result.status!==0)throw new Error('Clean consumer failed; see '+join(output,'consumer.log'));
console.log(result.stdout.trim());

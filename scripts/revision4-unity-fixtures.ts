import './node-platform.ts';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {validateBytes} from 'gltf-validator';
import {descriptor,buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset} from '../src/catalog/export.ts';
import {measurements} from '../src/catalog/measure.ts';
import {inspectGeometry} from '../src/lantern/inspect.ts';
import {sourceProvenance,sha256} from './provenance.ts';
import {constructionCases} from '../tests/revision3-construction-cases.ts';

const revision4Catalog=['work-lantern','cottage','tree','fence','crate','boulder'].map(descriptor);
export const revision4Fixtures=[
 ...revision4Catalog.map(d=>({name:d.id+'-default',family:d.id,input:{}})),
 ...revision4Catalog.flatMap(d=>d.presets.map(p=>({name:d.id+'-preset-'+p.id,family:d.id,input:p.parameters}))),
 ...Object.entries(constructionCases).map(([family,input])=>({name:family+'-construction',family,input})),
 {name:'fence-longest',family:'fence',input:{length:6,bays:3}},
 {name:'cottage-widest',family:'cottage',input:{width:7.2}},
 {name:'lantern-wide-low',family:'work-lantern',input:{bodyWidth:.44,bodyHeight:.18,handleClearance:.075}},
 {name:'appearance-flat-fence',family:'fence',input:{appearance:{version:1,palette:'None',shading:'Flat',partColors:{}}}},
 {name:'appearance-toon-cottage',family:'cottage',input:{appearance:{version:1,palette:'None',shading:'Toon3bands',partColors:{}}}},
 {name:'appearance-palette-tree',family:'tree',input:{appearance:{version:1,palette:'GameBoy',shading:'None',partColors:{}}}},
 {name:'appearance-part-crate',family:'crate',input:{appearance:{version:1,palette:'None',shading:'None',partColors:{'front-plank-1-0':'#3f7892'}}}},

];
export function appearanceExpectations(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.equal(view.getUint32(0,true),0x46546c67);
 const jsonLength=view.getUint32(12,true),gltf=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength)));
 const binary=28+jsonLength;
 const colors=(index:number):Array<{r:number;g:number;b:number;a:number}>=>{
  const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],count=a.type==='VEC3'?3:a.type==='VEC4'?4:0;
  assert.ok(count);assert.ok([5126,5121,5123].includes(a.componentType));
  const size=a.componentType===5126?4:a.componentType===5123?2:1,stride=v.byteStride??size*count;
  const start=binary+(v.byteOffset??0)+(a.byteOffset??0);
  return Array.from({length:a.count},(_,i)=>{
   const channels=Array.from({length:count},(_,j)=>{
    const at=start+i*stride+j*size;
    const n=a.componentType===5126?view.getFloat32(at,true):a.componentType===5123?view.getUint16(at,true):view.getUint8(at);
    return a.normalized&&a.componentType!==5126?n/(a.componentType===5123?65535:255):n;
   });
   assert.ok(channels.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
   return {r:channels[0]!,g:channels[1]!,b:channels[2]!,a:channels[3]??1};
  });
 };
 const parts:Array<{name:string;verifyVertexColors:boolean;vertexColors:Array<{r:number;g:number;b:number;a:number}>}>=[];
 for(const node of gltf.nodes){
  if(node.mesh===undefined)continue;
  const primitives=gltf.meshes[node.mesh].primitives;assert.equal(primitives.length,1);
  const index=primitives[0].attributes.COLOR_0;
  parts.push({name:node.name,verifyVertexColors:true,vertexColors:index===undefined?[]:colors(index)});
 }
 const materials:Array<{name:string;verifyShader:boolean;unlit:boolean}>=gltf.materials.map((m:{name:string;extensions?:Record<string,unknown>})=>({name:m.name,verifyShader:true,unlit:Boolean(m.extensions?.KHR_materials_unlit)}));
 return {verifyAppearance:true,requireUnlit:materials.every(m=>m.unlit),parts,materials};
}

async function main(){
const [flag,location,hashFlag,expectedHash]=process.argv.slice(2);
assert.equal(flag,'--out');assert.ok(location);assert.equal(hashFlag,'--source-hash');assert.match(expectedHash??'',/^[a-f0-9]{64}$/);
const output=resolve(location),before=await sourceProvenance();
assert.equal(before.sourceHash,expectedHash,'Requires the approved frozen source hash.');
await mkdir(output,{recursive:false});
const records:unknown[]=[];
for(const fixture of revision4Fixtures){
 const build=buildAsset(fixture.family,fixture.input);
 try{
  assert.deepEqual(inspectGeometry(build.root).errors,[]);
  const bytes=await exportAsset(build),validation=await validateBytes(bytes);
  assert.equal(validation.issues.numErrors,0,fixture.name);assert.equal(validation.issues.numWarnings,0,fixture.name);
  const digest=sha256(bytes),configuration=build.config;
  const measured=measurements(build),appearance=appearanceExpectations(bytes);
  const expectation={name:fixture.name,sha256:digest,...measured,verifyAppearance:true,requireUnlit:appearance.requireUnlit,
   parts:measured.parts.map(part=>({...part,...appearance.parts.find(p=>p.name===part.name)})),
   materials:measured.materials.map(material=>({...material,...appearance.materials.find(m=>m.name===material.name)})),
   producer:{configuration,configSha256:sha256(JSON.stringify(configuration)),sourceSha256:before.sourceHash,provenance:before}};
  await writeFile(join(output,fixture.name+'.glb'),bytes,{flag:'wx'});
  await writeFile(join(output,fixture.name+'.expected.json'),JSON.stringify(expectation,null,2),{flag:'wx'});
  records.push({name:fixture.name,configuration,sha256:digest,validation:validation.issues});
 }finally{disposeAsset(build);}
}
const after=await sourceProvenance();
assert.equal(after.sourceHash,before.sourceHash,'Sources changed; incomplete directory is not accepted.');
await writeFile(join(output,'manifest.json'),JSON.stringify({before,after,fixtures:records},null,2),{flag:'wx'});
console.log(JSON.stringify({output,fixtures:records.length,sourceHash:before.sourceHash}));

}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();

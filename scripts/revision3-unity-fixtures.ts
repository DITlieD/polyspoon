import './node-platform.ts';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {validateBytes} from 'gltf-validator';
import {catalog,buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset} from '../src/catalog/export.ts';
import {measurements} from '../src/catalog/measure.ts';
import {inspectGeometry} from '../src/lantern/inspect.ts';
import {sourceProvenance,sha256} from './provenance.ts';
import {constructionCases} from '../tests/revision3-construction-cases.ts';

const [flag,location,hashFlag,expectedHash]=process.argv.slice(2);
assert.equal(flag,'--out');assert.ok(location);assert.equal(hashFlag,'--source-hash');assert.match(expectedHash??'',/^[a-f0-9]{64}$/);
const output=resolve(location),before=await sourceProvenance();
assert.equal(before.sourceHash,expectedHash,'Requires the approved frozen source hash.');
await mkdir(output,{recursive:false});
const fixtures=[
 ...catalog.map(d=>({name:d.id+'-default',family:d.id,input:{}})),
 ...catalog.flatMap(d=>d.presets.map(p=>({name:d.id+'-preset-'+p.id,family:d.id,input:p.parameters}))),
 ...Object.entries(constructionCases).map(([family,input])=>({name:family+'-construction',family,input})),
 {name:'fence-longest',family:'fence',input:{length:6,bays:3}},
 {name:'cottage-widest',family:'cottage',input:{width:7.2}},
 {name:'lantern-wide-low',family:'work-lantern',input:{bodyWidth:.44,bodyHeight:.18,handleClearance:.075}},
];
const records:unknown[]=[];
for(const fixture of fixtures){
 const build=buildAsset(fixture.family,fixture.input);
 try{
  assert.deepEqual(inspectGeometry(build.root).errors,[]);
  const bytes=await exportAsset(build),validation=await validateBytes(bytes);
  assert.equal(validation.issues.numErrors,0,fixture.name);assert.equal(validation.issues.numWarnings,0,fixture.name);
  const digest=sha256(bytes),configuration=build.config;
  const expectation={name:fixture.name,sha256:digest,...measurements(build),producer:{configuration,configSha256:sha256(JSON.stringify(configuration)),sourceSha256:before.sourceHash,provenance:before}};
  await writeFile(join(output,fixture.name+'.glb'),bytes,{flag:'wx'});
  await writeFile(join(output,fixture.name+'.expected.json'),JSON.stringify(expectation,null,2),{flag:'wx'});
  records.push({name:fixture.name,configuration,sha256:digest,validation:validation.issues});
 }finally{disposeAsset(build);}
}
const after=await sourceProvenance();
assert.equal(after.sourceHash,before.sourceHash,'Sources changed; incomplete directory is not accepted.');
await writeFile(join(output,'manifest.json'),JSON.stringify({before,after,fixtures:records},null,2),{flag:'wx'});
console.log(JSON.stringify({output,fixtures:records.length,sourceHash:before.sourceHash}));

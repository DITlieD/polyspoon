import './node-platform.ts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { validateBytes } from 'gltf-validator';
import { buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { measurements } from '../src/catalog/measure.ts';
import { inspectGeometry } from '../src/lantern/inspect.ts';
import { sourceProvenance, sha256 } from './provenance.ts';
import { appearanceExpectations } from './revision4-unity-fixtures.ts';

export const revision5Fixtures = [
  {name:'bench-default',family:'bench',input:{}},
  {name:'bench-backless',family:'bench',input:recipe('bench').descriptor.presets.find(p=>p.id==='low-seat')!.parameters},
  {name:'bench-narrow',family:'bench',input:{width:0.9,depth:0.32,seatHeight:0.35,slatCount:6,backHeight:0.55}},
  {name:'bench-flat',family:'bench',input:{appearance:{version:1,palette:'None',shading:'Flat',partColors:{}}}},
];

export async function prepareRevision5(output: string, expectedHash: string) {
  assert.match(expectedHash,/^[a-f0-9]{64}$/);
  const before = await sourceProvenance();
  assert.equal(before.sourceHash,expectedHash,'Requires the frozen source hash.');
  await mkdir(output,{recursive:false});
  const records: unknown[] = [];
  for (const fixture of revision5Fixtures) {
    const build = buildAsset(fixture.family,fixture.input);
    try {
      assert.deepEqual(inspectGeometry(build.root).errors,[]);
      const bytes = await exportAsset(build), validation = await validateBytes(bytes);
      assert.equal(validation.issues.numErrors,0,fixture.name);
      assert.equal(validation.issues.numWarnings,0,fixture.name);
      const digest = sha256(bytes), measured = measurements(build), appearance = appearanceExpectations(bytes);
      const expectation = {
        name:fixture.name,sha256:digest,...measured,verifyAppearance:true,requireUnlit:appearance.requireUnlit,
        parts:measured.parts.map(part=>({...part,...appearance.parts.find(p=>p.name===part.name)})),
        materials:measured.materials.map(material=>({...material,...appearance.materials.find(m=>m.name===material.name)})),
        producer:{configuration:build.config,configSha256:sha256(JSON.stringify(build.config)),sourceSha256:before.sourceHash,provenance:before},
      };
      await writeFile(join(output,fixture.name+'.glb'),bytes,{flag:'wx'});
      await writeFile(join(output,fixture.name+'.expected.json'),JSON.stringify(expectation,null,2),{flag:'wx'});
      records.push({name:fixture.name,configuration:build.config,sha256:digest,validation:validation.issues});
    } finally { disposeAsset(build); }
  }
  const after = await sourceProvenance();
  assert.equal(after.sourceHash,before.sourceHash,'Sources changed; incomplete directory is not accepted.');
  await writeFile(join(output,'manifest.json'),JSON.stringify({before,after,fixtures:records},null,2),{flag:'wx'});
  return {output,fixtures:records.length,sourceHash:before.sourceHash};
}

async function main() {
  const [flag,location,hashFlag,expectedHash] = process.argv.slice(2);
  assert.equal(flag,'--out'); assert.ok(location); assert.equal(hashFlag,'--source-hash'); assert.ok(expectedHash);
  console.log(JSON.stringify(await prepareRevision5(resolve(location),expectedHash)));
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();

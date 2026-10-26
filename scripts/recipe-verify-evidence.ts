import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { validateBytes } from 'gltf-validator';
import { descriptor, validationCases } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';
import { readPackageZip } from './recipe-check.ts';
import { validatePackageFiles } from './recipe-package-core.ts';
import { sha256, sourceProvenance } from './provenance.ts';
import { regularFile } from './recipe-verify-input.ts';
import {selectedSourcePackage} from './recipe-verify-package.ts';
import {sourceDeliveryFor} from './recipe-package-identity.ts';
import type { PreparedVerification } from './recipe-verify-input.ts';

export async function verificationSnapshot(prepared:PreparedVerification) {
  const provenance=await sourceProvenance(),inputs:Record<string,string>={};
  async function walk(path:string) {
    for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const child=join(path,entry.name);
      if(entry.isDirectory())await walk(child);
      else {await regularFile(child);inputs[relative(prepared.root,child)]=sha256(await readFile(child));}
    }
  }
  await walk(join(prepared.root,'tests'));
  for(const path of ['docs/contributing/source-packages.json','docs/licensing-dependencies.json','LICENSE','NOTICE','LICENSES/Apache-2.0.txt','LICENSES/CC0-1.0.txt','evidence/revision5/recipes/legacy-baseline.json','evidence/revision7/catalog/seven-family-baseline.json','evidence/revision7/catalog/reviewed-defaults.json','evidence/revision7/catalog/scene-inputs.json','integrations/unity/ImportFixture/Assets/Editor/FixtureRun.cs','integrations/unity/run-editor.sh']) {
    await regularFile(join(prepared.root,path));
    inputs[path]=sha256(await readFile(join(prepared.root,path)));
  }
  if(prepared.configPath)inputs[relative(prepared.root,prepared.configPath)]=sha256(await readFile(prepared.configPath));
  inputs['selected.design.json']=sha256(await readFile(join(prepared.output,'selected.design.json')));
  return {provenance,verificationInputs:inputs,verificationHash:sha256(JSON.stringify(inputs))};
}
export type VerificationSnapshot=Awaited<ReturnType<typeof verificationSnapshot>>;
export function checkPackagedSources(files:Record<string,string>,sources:Record<string,string>) {
  for(const [path,text] of Object.entries(files))if(/^(src|scripts|examples)\//.test(path))assert.equal(sha256(text),sources[path],'Packaged source mismatch: '+path);
}
export async function checkEvidence(prepared:PreparedVerification,before:VerificationSnapshot) {
  const {output,family,design}=prepared,d=descriptor(family);
  const json=async(path:string)=>JSON.parse(await readFile(join(output,path),'utf8'));
  const identity=(provenance:{sourceHash:string;lockHash:string})=>{
    assert.equal(provenance.sourceHash,before.provenance.sourceHash,'Artifact source hash differs');
    assert.equal(provenance.lockHash,before.provenance.lockHash,'Artifact dependency lock differs');
  };
  const glb=async(path:string,expected:string)=>{
    const bytes=await readFile(join(output,path));
    assert.equal(sha256(bytes),expected,'GLB hash differs: '+path);
    const checked=await validateBytes(bytes,{uri:path,maxIssues:100});
    assert.equal(checked.issues.numErrors,0,path+' errors');
    assert.equal(checked.issues.numWarnings,0,path+' warnings');
  };
  const exported=await json('selected.json');
  assert.deepEqual(exported.configuration,design,'Export does not match selected design');
  assert.equal(exported.configHash,sha256(JSON.stringify(design)));
  identity(exported.provenance);
  await glb('selected.glb',exported.glbHash);
  const validation=await json('validation/report.json'),cases=validationCases(family);
  identity(validation.provenance);
  assert.equal(validation.testedConfigurations,cases.length);
  assert.deepEqual(validation.results.map((item:{name:string})=>item.name),cases.map(c=>family+'-'+c.id));
  for(const result of validation.results) {
    identity(result.provenance);
    assert.deepEqual(result.geometry.errors,[]);
    await glb('validation/'+result.name+'.glb',result.glbHash);
  }
  assert.deepEqual(validation.unityInputs,recipe(family).integrationCases.map(c=>family+'-'+c.id));
  for(const name of validation.unityInputs) {
    const expected=await json('validation/unity-inputs/'+name+'.expected.json');
    identity(expected.producer.provenance);
    await glb('validation/unity-inputs/'+name+'.glb',expected.sha256);
  }
  const rendered=await json('renders/manifest.json');
  assert.equal(rendered.family,family);assert.equal(rendered.version,d.version);
  identity(rendered.before);identity(rendered.after);
  assert.equal(rendered.inputFileSha256,sha256(await readFile(join(output,'selected.design.json'))));
  assert.deepEqual(rendered.stage,{diagnostic:true,ground:false,framing:'orthographic',mode:'shaded',colorSpace:'sRGB',toneMapping:'none'});
  const names=['front','rear','left','right','top','oblique','rear-oblique'].map(view=>'selected-'+view+'.png');
  for(const preset of d.presets)names.push('preset-'+preset.id+'-oblique.png',family+'-'+preset.id+'.png');
  assert.deepEqual(Object.keys(rendered.files).sort(),[...names].sort());
  assert.equal(rendered.captures.length,names.length);
  for(const name of names) {
    const capture=rendered.captures.filter((item:{file:string})=>item.file===name);
    assert.equal(capture.length,1,'Missing or duplicate capture: '+name);
    const image=await readFile(join(output,'renders',name));
    assert.equal(sha256(image),rendered.files[name],name);
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16),capture[0].width);
    assert.equal(image.readUInt32BE(20),capture[0].height);
    assert.deepEqual(capture[0].inspection.errors,[]);
    assert.equal(capture[0].configurationSha256,sha256(JSON.stringify(capture[0].configuration)));
    if(name.startsWith('selected-'))assert.deepEqual(capture[0].configuration,design);
  }
  const index=await json('packages/index.json');
  const packaged=selectedSourcePackage(index,family,d.version);
  const packagePath='packages/'+packaged.filename;
  const bytes=await readFile(join(output,packagePath));
  assert.equal(bytes.length,packaged.bytes);
  assert.equal(sha256(bytes),packaged.sha256);
  const files=readPackageZip(bytes),manifest=validatePackageFiles(files);
  assert.equal(manifest.recipe.id,family);assert.equal(manifest.recipe.version,d.version);assert.equal(sourceDeliveryFor(manifest.formatVersion,manifest.deliveryRevision)?.deliveryRevision,packaged.deliveryRevision);
  checkPackagedSources(files,before.provenance.sources);
  assert.deepEqual(JSON.parse(files['config.json']!),d.save({}),'Package defaults differ');
  return {deliveryRevision:packaged.deliveryRevision,glb:'selected.glb',design:'selected.design.json',sourceZip:packagePath,renders:names.map(name=>'renders/'+name),validatedConfigurations:cases.length,selectedConfigHash:exported.configHash,selectedGlbHash:exported.glbHash,packageHash:sha256(bytes),packageDefaultDesignMatchesSelected:JSON.stringify(JSON.parse(files['config.json']!))===JSON.stringify(design)};
}

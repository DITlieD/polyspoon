import { recipe } from '../src/recipes/index.ts';
import './node-platform.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { validateBytes } from 'gltf-validator';
import { catalog, buildAsset, disposeAsset, resolveExport, validationCases, descriptor } from '../src/catalog/index.ts';
import { exportDeliverable } from '../src/catalog/delivery.ts';
import type { MigrationNotice } from '../src/engine/parameters.ts';
import { measurements } from '../src/catalog/measure.ts';
import { geometrySnapshot, inspectGeometry } from '../src/lantern/inspect.ts';
import { sha256, sourceProvenance } from './provenance.ts';
import { convertGlbReport, exportFormats, type ExportFormat } from '../src/formats/index.ts';
import { controlsDocument } from '../src/formats/controls.ts';

const [command,...args] = process.argv.slice(2);
const options = new Map<string,string>();
for (let i=0;i<args.length;i+=2) {
  const key=args[i]!, value=args[i+1];
  if (!['--family','--preset','--config','--out','--formats'].includes(key) || !value || value.startsWith('--') || options.has(key)) throw new Error('Invalid argument: '+key);
  options.set(key,value);
}
async function exportOne(family: string,input: unknown,output: string,provenance: Awaited<ReturnType<typeof sourceProvenance>>, expectation = false, migration?: MigrationNotice) {
  const build=buildAsset(family,input);
  if(migration)build.config.migration=migration;
  try {
    const geometry=inspectGeometry(build.root);
    if (geometry.errors.length) throw new Error(geometry.errors.join('; '));
    const bytes=await exportDeliverable(build,{stripUnusedUvs:command==='export'});
    const validation=await validateBytes(bytes,{uri:output,maxIssues:100});
    if (validation.issues.numErrors || validation.issues.numWarnings) throw new Error('glTF validation failed: '+JSON.stringify(validation.issues));
    const measured=measurements(build), configHash=sha256(JSON.stringify(build.config));
    const manifest={configuration:build.config,geometry,measurements:measured,handleGap:build.handleGap,geometryHash:sha256(JSON.stringify(geometrySnapshot(build.root))),configHash,glbHash:sha256(bytes),glbBytes:bytes.byteLength,validation,provenance};
    await mkdir(dirname(output),{recursive:true});
    await writeFile(output,bytes);
    await writeFile(output.slice(0,-4)+'.json',JSON.stringify(manifest,null,2));
    if (expectation) await writeFile(output.slice(0,-4)+'.expected.json',JSON.stringify({
      name:output.split('/').at(-1)!.slice(0,-4),sha256:sha256(bytes),...measured,
      producer:{configuration:build.config,configSha256:configHash,sourceSha256:provenance.sourceHash,provenance},
    },null,2));
    return manifest;
  } finally { disposeAsset(build); }
}
async function main() {
  const provenance=await sourceProvenance();
  if (command==='export') {
    const saved=options.has('--config') ? JSON.parse(await readFile(options.get('--config')!,'utf8')) : undefined;
    const resolved=resolveExport({family:options.get('--family'),preset:options.get('--preset')},saved);
    const output=options.get('--out') ?? 'evidence/exports/'+resolved.family+'.glb';
    if (!output.endsWith('.glb')) throw new Error('--out must end in .glb');
    if (options.has('--config') && resolve(options.get('--config')!) === resolve(output.slice(0,-4)+'.json')) throw new Error('Output report would overwrite the input configuration');
    const requested=(options.get('--formats')??'glb').split(',').map(value=>value.trim()).flatMap(value=>value==='all'?['glb','obj','fbx','usdz']:[value]);
    if(requested.some(value=>value!=='glb'&&!(value in exportFormats)))throw new Error('--formats accepts glb, obj, fbx, usdz or all');
    const result=await exportOne(resolved.family,resolved.input,output,provenance,false,resolved.migration);
    await writeFile(output+'.provenance.json',JSON.stringify(provenance,null,2));
    const glb=new Uint8Array(await readFile(output)),stem=output.slice(0,-4),name=stem.split('/').at(-1)!,extra:Record<string,string>={};
    const dropped=new Set<string>();
    for(const format of new Set(requested))if(format!=='glb'){const path=stem+exportFormats[format as ExportFormat].extension,converted=convertGlbReport(glb,format as ExportFormat,name);await writeFile(path,converted.bytes);extra[format]=path;converted.dropped.forEach(d=>dropped.add(d));}
    if(dropped.size)console.error('WARNING: OBJ/FBX/USDZ are lossy for '+resolved.family+': dropped '+[...dropped].join('; ')+'. Ship the GLB for full fidelity.');
    await writeFile(stem+'.controls.json',JSON.stringify(controlsDocument({design:result.configuration,glb}),null,2)+'\n');
    console.log(JSON.stringify({output,formats:extra,controls:stem+'.controls.json',triangles:result.geometry.triangles,bytes:result.glbBytes,issues:result.validation.issues,derivedFormatLosses:[...dropped]},null,2));
    return;
  }
  if (command!=='validate') throw new Error('Use export or validate');
  if (options.has('--config') || options.has('--preset')) throw new Error('validate accepts --family and --out only');
  const directory=options.get('--out') ?? 'evidence/catalog';
  const selected=options.has('--family') ? [descriptor(options.get('--family')!)] : catalog;
  const results: unknown[]=[];
  for (const d of selected) for (const fixture of validationCases(d.id)) {
    const output=join(directory,d.id+'-'+fixture.id+'.glb');
    results.push({name:d.id+'-'+fixture.id, ...await exportOne(d.id,fixture.parameters,output,provenance)});
  }
  const stable=selected.flatMap(d=>recipe(d.id).integrationCases.map(c=>({name:d.id+'-'+c.id,family:d.id,input:c.parameters})));
  for (const c of stable) await exportOne(c.family,c.input,join(directory,'unity-inputs',c.name+'.glb'),provenance,true);
  if ((await sourceProvenance()).sourceHash!==provenance.sourceHash) throw new Error('Source changed during validation; rerun');
  await writeFile(join(directory,'report.json'),JSON.stringify({generatedAt:new Date().toISOString(),provenance,testedConfigurations:results.length,unityInputs:stable.map(c=>c.name),results},null,2));
  console.log(results.length+' real GLBs passed with zero validator errors/warnings; '+stable.length+' Unity expectation pairs. '+directory+'/report.json');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

import '../scripts/node-platform.ts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Mesh } from 'three';
import { buildSourcePackages } from '../scripts/recipe-package.ts';
import { extractPackage } from '../scripts/recipe-check.ts';
import { sha256, validatePackageFiles } from '../scripts/recipe-package-core.ts';
import { buildAsset, disposeAsset, loadDesign } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';
import { designInput } from '../src/catalog/appearance.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { geometrySnapshot } from '../src/lantern/inspect.ts';

const evidence=resolve('evidence/revision5/packages');
await mkdir(evidence,{recursive:true});
const index=await buildSourcePackages();
const workspace=await mkdtemp(join(tmpdir(),'recipe-portability-'));
await writeFile(join(workspace,'tsconfig.json'),JSON.stringify({compilerOptions:{noEmit:true}}));
const results:unknown[]=[];
try{
  for(const entry of index.packages){
    const archive=await readFile(join('public',entry.url)),directory=join(workspace,entry.id);
    await extractPackage(archive,directory);
    const installation=execFileSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund','--offline'],{cwd:directory,encoding:'utf8',timeout:60000});
    const baseline=JSON.parse(await readFile(join(directory,'config.json'),'utf8'));
    const defaultBuild=buildAsset(entry.id,designInput(loadDesign(baseline)));
    const baseDimensions=defaultBuild.dimensions.toArray();
    let part='';
    defaultBuild.root.traverse(object=>{if(!part&&object instanceof Mesh)part=object.name;});
    disposeAsset(defaultBuild);
    const fixture=recipe(entry.id).validationCases.find(candidate=>{
      const build=buildAsset(entry.id,candidate.parameters);
      try{return build.dimensions.toArray().some((value,i)=>Math.abs(value-baseDimensions[i]!)>0.001);}
      finally{disposeAsset(build);}
    });
    assert.ok(fixture,'Recipe must provide a meaningful changed-geometry case');
    const changedBuild=buildAsset(entry.id,{...fixture.parameters,appearance:{version:1,palette:'GameBoy',shading:'Flat',partColors:{[part]:'#cc4422'}}});
    const changed=structuredClone(changedBuild.config);
    disposeAsset(changedBuild);
    await writeFile(join(directory,'changed.json'),JSON.stringify(changed,null,2));
    const variants=[];
    for(const [label,configName] of [['default','config.json'],['changed','changed.json']] as const){
      const log=execFileSync('npm',['run','rebuild','--','--config',configName,'--out',label+'.glb'],{cwd:directory,encoding:'utf8',timeout:60000});
      const actual=JSON.parse(await readFile(join(directory,label+'.glb.report.json'),'utf8'));
      const input=JSON.parse(await readFile(join(directory,configName),'utf8'));
      const config=loadDesign(input),build=buildAsset(entry.id,designInput(config));
      if(config.migration)build.config.migration=config.migration;
      try{
        assert.equal(actual.geometryHash,sha256(JSON.stringify(geometrySnapshot(build.root))));
        assert.equal(actual.glbHash,sha256(await exportAsset(build)));
        assert.deepEqual(actual.config,build.config);
        variants.push({label,geometryHash:actual.geometryHash,glbHash:actual.glbHash,dimensions:actual.dimensions,bytes:actual.glbBytes});
      }finally{disposeAsset(build);}
      await copyFile(join(directory,configName),join(evidence,entry.id+'-'+label+'.design.json'));
      await copyFile(join(directory,label+'.glb.report.json'),join(evidence,entry.id+'-'+label+'.report.json'));
      await writeFile(join(evidence,entry.id+'-'+label+'.log'),log);
    }
    assert.notEqual(variants[0]!.geometryHash,variants[1]!.geometryHash);
    let sourceEdit:unknown;
    if(entry.id==='bench'){
      const path='examples/recipes/bench/index.ts',original=await readFile(join(directory,path),'utf8');
      const modified=original.replace('const gap = 0.012','const gap = 0.024');
      assert.notEqual(modified,original);
      await writeFile(join(directory,path),modified);
      const log=execFileSync('npm',['run','rebuild','--','--config','config.json','--out','source-edited.glb'],{cwd:directory,encoding:'utf8',timeout:60000});
      const report=JSON.parse(await readFile(join(directory,'source-edited.glb.report.json'),'utf8'));
      assert.notEqual(report.geometryHash,variants[0]!.geometryHash);
      assert.deepEqual(report.source.modifiedSourcePaths,[path]);
      assert.equal(report.source.matchesPackagedSource,false);
      const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')),files:Record<string,string>={};
      for(const member of ['manifest.json',...Object.keys(manifest.files)])files[member]=await readFile(join(directory,member),'utf8');
      assert.throws(()=>validatePackageFiles(files),/Integrity mismatch/);
      assert.equal(sha256(await readFile(join('public',entry.url))),sha256(archive));
      assert.equal(await readFile(resolve(path),'utf8'),original);
      sourceEdit={path,originalFileSha256:sha256(original),editedFileSha256:sha256(modified),geometryHash:report.geometryHash,source:report.source,immutableArchiveUnchanged:true,repositorySourceUnchanged:true,integrityCheck:'expected failure after intentional source edit'};
      await copyFile(join(directory,'source-edited.glb.report.json'),join(evidence,'bench-source-edited.report.json'));
      await writeFile(join(evidence,'bench-source-edit.log'),log);
    }
    results.push({id:entry.id,version:entry.version,archiveSha256:sha256(archive),installation:installation.trim(),changedCase:fixture.id,changedParameters:fixture.parameters,appearance:changed.appearance,variants,...(sourceEdit?{sourceEdit}:{})});
    await writeFile(join(evidence,'portability.json'),JSON.stringify({node:process.versions.node,status:'running',results},null,2));
    await rm(directory,{recursive:true,force:true});
    console.log(entry.id+': default and changed design match production bytes; changed geometry confirmed');
  }
  await writeFile(join(evidence,'portability.json'),JSON.stringify({node:process.versions.node,status:'passed',recipes:results.length,configurationBuilds:results.length*2,sourceEditBuilds:1,dependencyInstall:'offline npm ci --ignore-scripts',results},null,2)+'\n');
}finally{
  await rm(workspace,{recursive:true,force:true});
}

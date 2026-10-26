import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceImports, collectSources, safePackagePath, validatePackageFiles, sealPackage, dependencyLock, declarationFor } from '../scripts/recipe-package-core.ts';
import { buildEntry, runnerEntry } from '../scripts/recipe-package-templates.ts';
import { zipFiles } from '../src/catalog/export.ts';
import { readPackageZip } from '../scripts/recipe-check.ts';

test('package paths reject traversal, absolute paths, secrets and private evidence',()=>{
  for(const path of ['../src/a.ts','/src/a.ts','src/../a.ts','src\\engine\\a.ts','.env','evidence/result.json','src/engine/token.secret.ts']) assert.throws(()=>safePackagePath(path));
  assert.equal(safePackagePath('src/engine/shape.ts'),'src/engine/shape.ts');
});

test('source closure rejects unknown imports, dynamic imports and symlinks',async()=>{
  const root=await mkdtemp(join(tmpdir(),'recipe-source-'));
  try{
    await mkdir(join(root,'src/engine'),{recursive:true});
    await writeFile(join(root,'src/engine/a.ts'),"import './b.ts'; export const value=1;");
    await writeFile(join(root,'src/engine/b.ts'),'export const width=2;');
    assert.equal(Object.keys(await collectSources(root,['src/engine/a.ts'])).length,2);
    for(const code of ["import 'unknown-package';","import('../../outside.ts');","import '/private/file.ts';","import '../.env';"]){
      await writeFile(join(root,'src/engine/a.ts'),code);
      await assert.rejects(collectSources(root,['src/engine/a.ts']));
    }
    await writeFile(join(root,'src/engine/a.ts'),"import './link.ts';");
    await symlink(join(root,'src/engine/b.ts'),join(root,'src/engine/link.ts'));
    await assert.rejects(collectSources(root,['src/engine/a.ts']));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('manifest validation rejects changed, missing, extra members and invalid metadata without execution',()=>{
  const files:Record<string,string>={
    'src/engine/a.ts':'throw new Error("must never execute");',
    'config.json':'{}','controls.json':'[]','build.mjs':buildEntry,
    'runner.ts':runnerEntry('crate'),'package.json':JSON.stringify({name:'recipe-crate',type:'module',dependencies:{three:'0.186.1',typescript:'7.0.2'},scripts:{rebuild:'node build.mjs'}}),
    'package-lock.json':JSON.stringify(dependencyLock('recipe-crate')),
    'REBUILD.md':'Review before running.','LICENSE':'Apache','NOTICE':'Scope','LICENSES/Apache-2.0.txt':'Apache','LICENSES/CC0-1.0.txt':'CC0',
    'dependency-licenses.json':'{}',
  };
  for(const path of ['scripts/node-platform.ts','src/catalog/index.ts','src/catalog/appearance.ts','src/catalog/export.ts','src/lantern/inspect.ts'])files[path]='export {};';
  const input={deliveryRevision:2 as const,id:'crate',version:'1.0.0',entry:'src/engine/a.ts',exportName:'testRecipe',dependencies:{three:'0.186.1',typescript:'7.0.2'},nodeVersion:'22.22.1',licensing:{author:'Fixture author',statement:'Original test fixture',softwareLicense:'Apache-2.0' as const,contentLicense:'CC0-1.0' as const,contentDesignation:'config.json fixture'}};
  const sealed=sealPackage(files,input);
  assert.equal(validatePackageFiles(sealed).recipe.id,'crate');
  assert.throws(()=>sealPackage(files,{...input,id:'outside-author',licensing:undefined as any}));
  const metadata={formatVersion:1,recipes:{'outside-author':{...input.licensing,author:'Outside contributor',contentLicense:'Apache-2.0'}}};
  assert.throws(()=>declarationFor({formatVersion:1,recipes:{}},'outside-author'));
  assert.throws(()=>declarationFor({formatVersion:1,recipes:{'outside-author':{...input.licensing,contentLicense:'unknown'}}},'outside-author'));
  const outside=validatePackageFiles(sealPackage({...files,'runner.ts':runnerEntry('outside-author')},{...input,id:'outside-author',licensing:declarationFor(metadata,'outside-author')}));
  assert.equal(outside.provenance.reviewStatus,'not-established-by-packaging');
  assert.equal(outside.licenses.content,'Apache-2.0');
  const zip=zipFiles(Object.fromEntries(Object.entries(sealed).map(([path,text])=>[path,new TextEncoder().encode(text)])));
  assert.equal(readPackageZip(zip)['config.json'],'{}');
  const corrupt=zip.slice();corrupt[14]=corrupt[14]!^1;assert.throws(()=>readPackageZip(corrupt));
  const extraBytes=new Uint8Array(zip.length+1);extraBytes.set(zip);assert.throws(()=>readPackageZip(extraBytes));
  assert.throws(()=>readPackageZip(zipFiles({'../escape.ts':new TextEncoder().encode('escape')})));
  assert.throws(()=>readPackageZip(zipFiles({'.env':new TextEncoder().encode('SECRET')})));
  assert.throws(()=>validatePackageFiles(sealPackage({...files,'build.mjs':"import 'unknown';"},input)));
  const lifecycle=JSON.parse(files['package.json']!);lifecycle.scripts.preinstall='echo unsafe';
  assert.throws(()=>validatePackageFiles(sealPackage({...files,'package.json':JSON.stringify(lifecycle)},input)));
  for(const mutate of [
    (lock:any)=>{lock.packages['node_modules/three'].integrity='sha512-AAAA';},
    (lock:any)=>{lock.packages['node_modules/three'].resolved='https://evil.example/package.tgz';},
    (lock:any)=>{lock.packages['node_modules/extra']={version:'1.0.0'};},
    (lock:any)=>{lock.packages['node_modules/typescript'].hasInstallScript=true;},
    (lock:any)=>{delete lock.packages['node_modules/@typescript/typescript-linux-x64'];},
  ]){
    const lock=JSON.parse(files['package-lock.json']!);mutate(lock);
    assert.throws(()=>validatePackageFiles(sealPackage({...files,'package-lock.json':JSON.stringify(lock)},input)));
  }
  assert.throws(()=>validatePackageFiles({...sealed,'config.json':'{"changed":true}'}));
  const missing={...sealed};delete missing['config.json'];assert.throws(()=>validatePackageFiles(missing));
  assert.throws(()=>validatePackageFiles({...sealed,'extra.txt':'extra'}));
  const bad=JSON.parse(sealed['manifest.json']!);bad.formatVersion=999;
  assert.throws(()=>validatePackageFiles({...sealed,'manifest.json':JSON.stringify(bad)}));
});

test('source closure allows the used pinned geometry utility and rejects unrelated addons',()=>{
 assert.deepEqual(sourceImports('examples/recipes/conifer/index.ts',"import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';"),[]);
 assert.throws(()=>sourceImports('examples/recipes/conifer/index.ts',"import 'three/addons/utils/UnknownUtils.js';"),/Unapproved import/);
});

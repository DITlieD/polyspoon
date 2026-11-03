import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,readFile,writeFile,readdir,symlink,rename,unlink } from 'node:fs/promises';
import { resolve,join,dirname } from 'node:path';
import { buildProceduralModules,readPublishedProceduralReleases,filesForProceduralRelease } from '../scripts/recipe-module.ts';
import { sha256 } from '../scripts/recipe-package-core.ts';

const evidence=resolve('evidence/revision14/delivery/module-repair');
async function workspace(prefix:string){await mkdir(evidence,{recursive:true});return mkdtemp(join(evidence,prefix));}
async function fixture(){
  const directory=await workspace('authority-'),index=JSON.parse(await readFile('public/procedural-modules/index.json','utf8')),entry=index.packages.find((p:{id:string})=>p.id==='bench');
  assert.ok(entry);await writeFile(join(directory,'index.json'),JSON.stringify({formatVersion:1,packages:[entry]},null,2)+'\n');
  for(const name of Object.keys(entry.files)){const path=join(directory,entry.id,entry.version,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,await readFile(join('public/procedural-modules',entry.id,entry.version,name)));}
  return {directory,entry};
}
test('indexed release guide bytes survive repository guide drift and fresh-output generation',async()=>{
  const releases=await readPublishedProceduralReleases(resolve('public/procedural-modules')),release=releases.find(p=>p.entry.id==='bench')!;
  const changed:Record<string,string>={...release.files,'README.md':'current guide changed','semantic-contract.md':'current semantic guide changed'};
  assert.deepEqual(filesForProceduralRelease(release.entry.id,release.entry.version,changed,releases),release.files);
  assert.deepEqual(filesForProceduralRelease('new-recipe','1.0.0',changed,releases),changed);
  for(const name of ['asset.mjs','asset.d.mts','metadata.json','LICENSE','NOTICE','THIRD-PARTY.txt','example.html'])assert.throws(()=>filesForProceduralRelease(release.entry.id,release.entry.version,{...changed,[name]:changed[name]+'\n'},releases),/recipe version change/);
  const output=await workspace('fresh-output-'),index=await buildProceduralModules(output,{retainPublished:true});
  assert.equal(index.packages.length,releases.length);
  for(const item of releases)for(const [name,text] of Object.entries(item.files))assert.equal(await readFile(join(output,item.entry.id,item.entry.version,name),'utf8'),text);
  assert.deepEqual(await buildProceduralModules(output,{retainPublished:true}),index);
  await writeFile(join(evidence,'fresh-output.json'),JSON.stringify({output,packages:index.packages.length,indexSha256:sha256(await readFile(join(output,'index.json'))),exactPublishedFiles:true,idempotent:true},null,2)+'\n');
});
test('published release validation rejects tampered member/index and symlinked paths',async()=>{
  for(const mode of ['member','digest','bytes','path','duplicate','members','missing','symlink','runtime-index'] as const){
    const {directory,entry}=await fixture(),index={formatVersion:1,packages:[structuredClone(entry)]},p=index.packages[0],member=join(directory,entry.id,entry.version,'asset.mjs');
    if(mode==='member'){const bytes=await readFile(member);bytes[bytes.length-1]=bytes[bytes.length-1]!^1;await writeFile(member,bytes);}
    if(mode==='digest')p.sha256='0'.repeat(64);
    if(mode==='bytes')p.files['asset.mjs'].bytes++;
    if(mode==='path')p.url='../bench/asset.mjs';
    if(mode==='duplicate')index.packages.push(structuredClone(p));
    if(mode==='members')p.files['other.txt']={bytes:1,sha256:sha256('x')};
    if(mode==='missing')await unlink(join(directory,entry.id,entry.version,'NOTICE'));
    if(mode==='symlink'){const moved=member+'.original';await rename(member,moved);await symlink(moved,member);}
    if(mode==='runtime-index'){const code='changed runtime';await writeFile(member,code);p.bytes=Buffer.byteLength(code);p.sha256=sha256(code);p.files['asset.mjs']={bytes:p.bytes,sha256:p.sha256};}
    await writeFile(join(directory,'index.json'),JSON.stringify(index));
    if(mode==='runtime-index'){
      const altered=await readPublishedProceduralReleases(directory),original=await readPublishedProceduralReleases(resolve('public/procedural-modules')),files=original.find(x=>x.entry.id===entry.id)!.files;
      assert.throws(()=>filesForProceduralRelease(entry.id,entry.version,files,altered),/recipe version change/);
    }else{
      const errors:Record<string,RegExp>={member:/member digest mismatch/,digest:/index payload mismatch/,bytes:/member size mismatch/,path:/Invalid published module entry/,duplicate:/Duplicate published module identity/,members:/Invalid published module members/,symlink:/Symlink module path/};
      await assert.rejects(readPublishedProceduralReleases(directory),mode==='missing'?{code:'ENOENT'}:errors[mode]!);
    }
  }
});
test('existing destination conflicts preserve every file and mutable index before publication',async()=>{
  const output=await workspace('destination-'),path=join(output,'bench/1.1.0/asset.mjs');await mkdir(dirname(path),{recursive:true});await writeFile(path,'destination conflict');await writeFile(join(output,'index.json'),'index sentinel');
  await assert.rejects(buildProceduralModules(output,{retainPublished:true}),/Immutable procedural artifact conflict/);
  assert.equal(await readFile(path,'utf8'),'destination conflict');assert.equal(await readFile(join(output,'index.json'),'utf8'),'index sentinel');
  assert.deepEqual((await readdir(output)).sort(),['bench','index.json']);
});

test('published index and metadata require exact dependency and default configuration objects',async()=>{
  for(const mode of ['index-dependency','index-configuration','metadata-dependency','metadata-configuration','metadata-kind'] as const){
    const {directory,entry}=await fixture(),index={formatVersion:1,packages:[structuredClone(entry)]},p=index.packages[0];
    if(mode==='index-dependency')p.dependencies.extra='1.0.0';
    if(mode==='index-configuration')p.configuration.path='private.json';
    if(mode.startsWith('metadata-')){
      const path=join(directory,entry.id,entry.version,'metadata.json'),metadata=JSON.parse(await readFile(path,'utf8'));
      if(mode==='metadata-dependency')metadata.dependencies.extra='1.0.0';
      if(mode==='metadata-configuration')metadata.configuration.path='private.json';
      if(mode==='metadata-kind')metadata.configuration.kind='current';
      const text=JSON.stringify(metadata);await writeFile(path,text);p.files['metadata.json']={bytes:Buffer.byteLength(text),sha256:sha256(text)};
    }
    await writeFile(join(directory,'index.json'),JSON.stringify(index));
    await assert.rejects(readPublishedProceduralReleases(directory),mode.startsWith('index-')?/Invalid published module entry/:/Published module metadata identity mismatch/);
  }
});

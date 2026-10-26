import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('environment CLI creates a canonical manifest and exports it without overwriting input',{timeout:30000},async()=>{
 await mkdir('evidence/environment-foundation',{recursive:true});const dir=await mkdtemp(resolve('evidence/environment-foundation/cli-')),config=join(dir,'scene.environment.json'),out=join(dir,'scene.glb');
 const run=(args:string[])=>spawnSync(process.execPath,['--import','tsx','scripts/environment-cli.ts',...args],{encoding:'utf8',timeout:15000});
 const example=run(['example','--out',config]);assert.equal(example.status,0,example.stdout+example.stderr);const input=await readFile(config),exported=run(['export','--config',config,'--out',out]);assert.equal(exported.status,0,exported.stdout+exported.stderr);
 assert.deepEqual(await readFile(config),input);const bytes=await readFile(out),report=JSON.parse(await readFile(out+'.report.json','utf8')),saved=JSON.parse(await readFile(out+'.environment.json','utf8'));assert.equal(report.glbHash,createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(saved,JSON.parse(input.toString()));assert.equal(report.validation.errors,0);assert.equal(report.validation.warnings,0);assert.equal(report.provenance.sourceHash.length,64);
 const invalid=run(['export','--config',config,'--out',config]);assert.notEqual(invalid.status,0);assert.deepEqual(await readFile(config),input);
 const duplicate=run(['export','--config',config,'--config',config,'--out',join(dir,'bad.glb')]);assert.notEqual(duplicate.status,0);await assert.rejects(readFile(join(dir,'bad.glb')),{code:'ENOENT'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('fox CLI entry creates canonical fox configuration and validated animated GLB',async()=>{
  const dir=await mkdtemp(resolve('evidence/rigged-fox/cli-')),config=join(dir,'fox.json'),output=join(dir,'fox.glb'),run=(args:string[])=>spawnSync(process.execPath,['--import','tsx','scripts/fox-cli.ts',...args],{encoding:'utf8',timeout:15000});
  const example=run(['example','--out',config]);assert.equal(example.status,0,example.stderr);const input=await readFile(config,'utf8');assert.equal(JSON.parse(input).family,'stylized-fox');const exported=run(['export','--config',config,'--out',output]);assert.equal(exported.status,0,exported.stderr);
  const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.deepEqual(report.validation,{errors:0,warnings:0});assert.equal(report.rig.kind,'fox');assert.equal(report.rig.bones.length,28);assert.equal(report.rig.effectors.length,4);assert.equal(await readFile(output+'.design.json','utf8'),input);assert.equal(await readFile(config,'utf8'),input);
  assert.notEqual(run(['example','--out',config]).status,0);assert.notEqual(run(['export','--config',config,'--out',config]).status,0);
});

import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { runRiggedCli } from '../scripts/rigged-cli.ts';
import { buildSavedHumanoid } from '../src/rigging/build.ts';
import { riggedMotionBounds } from '../src/rigging/bounds.ts';

test('rigged CLI roundtrips design, animated export and fresh-output protection',async()=>{
  const dir=await mkdtemp(resolve('evidence/rigged-humanoid/cli-')),config=join(dir,'character.json'),output=join(dir,'character.glb');
  await runRiggedCli(['example','--out',config]);const source=await readFile(config,'utf8');await runRiggedCli(['export','--config',config,'--out',output]);
  const report=JSON.parse(await readFile(output+'.report.json','utf8'));assert.deepEqual(report.validation,{errors:0,warnings:0});assert.equal(report.rig.clips.length,2);assert.equal(source,await readFile(output+'.design.json','utf8'));assert.equal(source,await readFile(config,'utf8'));
  await assert.rejects(runRiggedCli(['example','--out',config]));await assert.rejects(runRiggedCli(['export','--config',config,'--out',config]));await assert.rejects(runRiggedCli(['export','--config',config,'--config',config,'--out',output]));
  const build=buildSavedHumanoid(JSON.parse(source));try{const before=build.root.getObjectByName('motion_root')!.position.clone(),bounds=riggedMotionBounds(build);assert.ok(bounds.max.z-bounds.min.z>Number(build.config.applied.height)*.28);assert.deepEqual(build.root.getObjectByName('motion_root')!.position,before);}finally{build.dispose();}
});

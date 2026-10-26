import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { descriptor } from '../src/catalog/index.ts';
test('CLI exports saved family and rejects ambiguous or invalid options', async () => {
  const directory=await mkdtemp(join(tmpdir(),'workshop-cli-'));
  const config=join(directory,'tree.design.json'), output=join(directory,'tree.glb');
  await writeFile(config,JSON.stringify(descriptor('tree').save({seed:21})));
  const run=(args:string[])=>execFileSync(process.execPath,['--import','tsx','scripts/cli.ts',...args],{stdio:'pipe'});
  run(['export','--config',config,'--out',output]);
  const manifest=JSON.parse(await readFile(join(directory,'tree.json'),'utf8'));
  assert.equal(manifest.configuration.family,'tree');
  await writeFile(config,JSON.stringify(descriptor('tree').save({seed:21})));
  for (const args of [
    ['export','--config',config,'--family','crate'],
    ['export','--config',config,'--preset','young'],
    ['export','--family','tree','--preset','bad'],
    ['export','--family','unknown'],
    ['export','--family','tree','--family','tree'],
    ['validate','--preset','field'],
  ]) assert.throws(()=>run(args));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { revision5Fixtures, prepareRevision5 } from '../scripts/revision5-unity-fixtures.ts';
import { sourceProvenance, sha256 } from '../scripts/provenance.ts';

test('revision5 routes are separate and retain the existing fixture verifier', async () => {
  const code = await readFile('integrations/unity/ImportFixture/Assets/Editor/FixtureRun.cs','utf8');
  assert.match(code,/void RunRevision5\(\)/);
  assert.match(code,/InputDirectory = "Assets\/Revision5Inputs"/);
  assert.match(code,/OutputDirectory = "Assets\/VerifiedRevision5"/);
  assert.match(code,/void RunRevision4\(\)/);
  assert.match(code,/InputDirectory = "Assets\/Revision4Inputs"/);
  assert.throws(()=>execFileSync('bash',['integrations/unity/run-editor.sh','LanternFixture.FixtureRun.RunRevision5','test.log','revision4'],{stdio:'pipe'}));
  assert.throws(()=>execFileSync('bash',['integrations/unity/run-editor.sh','LanternFixture.FixtureRun.RunRevision4','test.log','revision5'],{stdio:'pipe'}));
  execFileSync('bash',['-n','integrations/unity/run-editor.sh']);
});

test('four canonical bench fixtures retain geometry and appearance expectations and refuse overwrite', async () => {
  const root = await mkdtemp(join(tmpdir(),'recipe-unity-')), output = join(root,'inputs');
  try {
    const provenance = await sourceProvenance();
    await assert.rejects(prepareRevision5(join(root,'wrong-hash'),'0'.repeat(64)),/frozen source hash/);
    const receipt = await prepareRevision5(output,provenance.sourceHash);
    assert.equal(receipt.fixtures,4);
    await assert.rejects(prepareRevision5(output,provenance.sourceHash),/EEXIST/);
    for(const fixture of revision5Fixtures) {
      const expected = JSON.parse(await readFile(join(output,fixture.name+'.expected.json'),'utf8'));
      const bytes = await readFile(join(output,fixture.name+'.glb'));
      assert.equal(expected.sha256,sha256(bytes));
      assert.equal(expected.sourceRoot,'bench');
      assert.equal(expected.verifyAppearance,true);
      assert.ok(expected.parts.length > 8);
      assert.ok(expected.materials.every((m:{verifyShader:boolean})=>m.verifyShader));
      assert.equal(expected.producer.sourceSha256,provenance.sourceHash);
      if(fixture.name==='bench-flat')assert.equal(expected.requireUnlit,true);
    }
  } finally {
    for(const fixture of revision5Fixtures)for(const extension of ['.glb','.expected.json'])await unlink(join(output,fixture.name+extension)).catch(()=>{});
    await unlink(join(output,'manifest.json')).catch(()=>{});
    await rmdir(output).catch(()=>{});
    await rmdir(root);
  }
});

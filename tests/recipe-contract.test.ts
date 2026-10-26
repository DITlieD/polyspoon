import {buildPriorAsset} from './historical-public.ts';
import { exportLegacyPayload } from './semantic-legacy-payload.ts';
import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { catalog, buildAsset, disposeAsset, loadDesign, validationCases } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { measurements } from '../src/catalog/measure.ts';

const digest = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex');

test('new contributor bench uses production catalog build, save, load and export', async () => {
  assert.ok(catalog.some(d => d.id === 'bench'));
  for (const fixture of validationCases('bench')) {
    const build = buildAsset('bench', fixture.parameters);
    try {
      assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(build.config))), build.config);
      assert.throws(() => loadDesign({ ...build.config, applied: {} }));
      assert.throws(() => loadDesign({ ...build.config, familyVersion: '999.0.0' }));
      const bytes = await exportAsset(build);
      assert.equal(new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true), 0x46546c67);
      assert.ok(measurements(build).parts.length >= 9);
    } finally { disposeAsset(build); }
  }
  assert.throws(() => buildAsset('bench', { width: -1 }));
  assert.throws(() => buildAsset('bench', { secret: true }));
});

test('original six preserve historical payload bytes and measurements beneath added semantics', async () => {
  const baseline = JSON.parse(await readFile(new URL('../evidence/revision5/recipes/legacy-baseline.json', import.meta.url), 'utf8'));
  assert.equal(baseline.length, 80);
  for (const record of baseline) {
    const build = await buildPriorAsset(record.family, record.parameters);
    try {
      assert.deepEqual(build.config, record.config);
      assert.equal(digest(JSON.stringify(measurements(build))), record.measurementHash, record.family + ':' + record.id);
      assert.equal(digest(await exportLegacyPayload(build)), record.glbHash, record.family + ':' + record.id);
    } finally { disposeAsset(build); }
  }
});

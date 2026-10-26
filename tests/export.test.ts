import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBytes } from 'gltf-validator';
import { generateLantern, disposeLantern } from '../src/lantern/generator.ts';
import { exportGlb } from '../src/lantern/export.ts';

test('production GLB is valid, retains named parts and is byte repeatable', async () => {
  const first = generateLantern({});
  const second = generateLantern({});
  const a = await exportGlb(first);
  const b = await exportGlb(second);
  assert.deepEqual(a, b);
  const result = await validateBytes(a, { maxIssues: 100 });
  assert.equal(result.issues.numErrors, 0, JSON.stringify(result.issues));
  assert.equal(result.issues.numWarnings, 0, JSON.stringify(result.issues));
  const view = new DataView(a.buffer, a.byteOffset, a.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  const length = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(a.subarray(20, 20 + length)));
  assert.ok(gltf.nodes.some((n: {name: string}) => n.name === 'handle'));
  assert.ok(!gltf.nodes.some((n: {name: string}) => n.name === 'stage'));
  assert.equal(gltf.materials.length, 4);
  disposeLantern(first);
  disposeLantern(second);
});

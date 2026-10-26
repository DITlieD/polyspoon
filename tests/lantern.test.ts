import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import { defaults, presets, parseParameters, saveConfiguration, loadConfiguration } from '../src/lantern/config.ts';
import { generateLantern, disposeLantern } from '../src/lantern/generator.ts';
import { inspectGeometry, geometrySnapshot } from '../src/lantern/inspect.ts';

test('defaults and explicit requested/applied provenance round trip', () => {
  for(const [key,value] of Object.entries(defaults)) assert.equal(parseParameters({})[key],value);
  const saved = saveConfiguration({ bodyWidth: 0.4 });
  assert.deepEqual(saved.requested, { bodyWidth: 0.4 });
  assert.equal(saved.applied.bodyWidth, 0.4);
  assert.equal(saved.family, 'work-lantern');
  assert.equal(saved.familyVersion, '0.4.0');
  assert.deepEqual(loadConfiguration(JSON.parse(JSON.stringify(saved))), saved);
  assert.throws(() => loadConfiguration({ ...saved, familyVersion: '2.0.0' }), /version/i);
  assert.throws(() => loadConfiguration({ ...saved, applied: defaults }), /applied/i);
  assert.throws(() => loadConfiguration({ ...saved, unexpected: true }), /unknown/i);
});

test('strict inputs reject unknown fields, incorrect types and impossible relationships', () => {
  for (const input of [null, [], 'x', 1, true, { width: 0.3 }, { bodyWidth: '0.3' }, { bodyWidth: NaN }, { bodyHeight: Infinity }, { handleClearance: -Infinity }, { colorway: 'pink' }, { colorway: 2 }, { bodyHeight: undefined }, { bodyWidth: 0.219 }, { bodyHeight: 0.361 }, { handleClearance: 0.074 }]) {
    assert.throws(() => parseParameters(input), Error, JSON.stringify(input));
  }
  assert.throws(() => parseParameters({ bodyWidth: 0.22, bodyHeight: 0.36 }), /bodyHeight.*bodyWidth/);
  assert.throws(() => parseParameters({ bodyWidth: 0.22, handleClearance: 0.19 }), /handleClearance.*bodyWidth/);
});

const cases = [
  ...presets.map(p => ({ name: p.id, input: p.parameters })),
  ...(['bodyWidth', 'bodyHeight', 'handleClearance'] as const).flatMap((key, i) =>
    [[0.22, 0.44], [0.18, 0.36], [0.075, 0.19]][i]!.map(value => ({ name: `${key}-${value}`, input: { [key]: value } }))),
  { name: 'wide-low', input: { bodyWidth: 0.44, bodyHeight: 0.18, handleClearance: 0.075 } },
  { name: 'wide-tall', input: { bodyWidth: 0.44, bodyHeight: 0.36, handleClearance: 0.19 } },
  { name: 'narrow-tall', input: { bodyWidth: 0.22, bodyHeight: 0.297, handleClearance: 0.143 } },
];

for (const fixture of cases) {
  test(`geometry and open carrying gap: ${fixture.name}`, () => {
    const build = generateLantern(fixture.input);
    const report = inspectGeometry(build.root);
    assert.deepEqual(report.errors, []);
    assert.ok(report.triangles > 100);
    assert.ok(Math.abs(build.bounds.min.y) < 1e-7);
    assert.ok(Math.abs(build.bounds.min.x + build.bounds.max.x) < 1e-7);
    assert.ok(build.bounds.max.y > build.config.applied.bodyHeight);
    for (const name of ['enclosure', 'hood', 'base', 'foot', 'handle', 'switch']) {
      assert.ok(build.root.getObjectByName(name), name);
    }
    const guards=build.root.children.filter(p=>p.name.startsWith('guard-upright-'));
    assert.equal(guards.length,build.config.applied.guardCount);
    for(let i=0;i<Number(build.config.applied.guardCount);i++){
      const guard=build.root.getObjectByName('guard-upright-'+i);
      assert.ok(guard,'required enclosure support '+i);
      assert.equal(guard.userData.materialRole,'structure');
    }
    const roles = new Set<string>();
    build.root.traverse(object => {
      if (object instanceof Mesh) {
        assert.ok(!Array.isArray(object.material));
        roles.add(object.material.name);
      }
    });
    assert.deepEqual([...roles].sort(), ['accent', 'body', 'enclosure', 'structure']);
    const enclosure = new Box3().setFromObject(build.root.getObjectByName('enclosure')!);
    assert.ok(Math.abs(enclosure.max.y - enclosure.min.y - build.config.applied.bodyHeight) < 1e-6);
    for (const x of [-0.25, 0, 0.25]) {
      for (const fraction of [0.15, 0.5, 0.85]) {
        const origin = new Vector3(x * build.handleGap.width, build.handleGap.bottom + fraction * build.handleGap.height, 2);
        const ray = new Raycaster(origin, new Vector3(0, 0, -1));
        assert.equal(ray.intersectObject(build.root, true).length, 0, 'carrying gap must remain empty');
      }
    }
    assert.ok(Math.abs(build.handleGap.height - build.config.applied.handleClearance) < 1e-9);
    disposeLantern(build);
  });
}

test('controls change their connected dimensions; color does not affect geometry', () => {
  const base = generateLantern({});
  for (const key of ['bodyWidth', 'bodyHeight', 'handleClearance'] as const) {
    const variant = generateLantern({ [key]: defaults[key] + 0.025 });
    assert.notDeepEqual(geometrySnapshot(variant.root), geometrySnapshot(base.root));
    if (key === 'bodyWidth') {
      for (const name of ['enclosure', 'hood', 'base', 'handle']) {
        const original = new Box3().setFromObject(base.root.getObjectByName(name)!);
        const changed = new Box3().setFromObject(variant.root.getObjectByName(name)!);
        assert.ok(changed.max.x - changed.min.x > original.max.x - original.min.x, name);
      }
    }
    if (key === 'handleClearance') {
      assert.deepEqual(geometrySnapshot(variant.root.getObjectByName('enclosure')!), geometrySnapshot(base.root.getObjectByName('enclosure')!));
    }
    disposeLantern(variant);
  }
  for (const colorway of ['forest', 'harbor', 'ember']) {
    const variant = generateLantern({ colorway });
    assert.deepEqual(geometrySnapshot(variant.root), geometrySnapshot(base.root));
    disposeLantern(variant);
  }
  const again = generateLantern({});
  assert.deepEqual(geometrySnapshot(again.root), geometrySnapshot(base.root));
  disposeLantern(base);
  disposeLantern(again);
});

test('wide low lantern keeps a substantial opening in the intended oblique view', () => {
  const build = generateLantern({ bodyWidth: 0.44, bodyHeight: 0.18, handleClearance: 0.075 });
  const direction = new Vector3(2.7, 1.85, 3.5).normalize();
  let visible = 0;
  for (const x of [-0.18, 0, 0.18]) {
    for (const fraction of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      const point = new Vector3(x * build.handleGap.width, build.handleGap.bottom + fraction * build.handleGap.height, 0);
      const ray = new Raycaster(point.clone().addScaledVector(direction, 2), direction.clone().negate());
      if (!ray.intersectObject(build.root, true).length) visible++;
    }
  }
  disposeLantern(build);
  assert.ok(visible >= 9, `Only ${visible}/15 interior opening samples are visible from the intended view`);
});

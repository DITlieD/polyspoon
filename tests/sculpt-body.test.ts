import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { SculptBody, type SculptRGB } from '../src/engine/sculpt/body.ts';

const fur: SculptRGB = [0.6, 0.5, 0.4];

function creature(legGap: number) {
  const body = new SculptBody({ bone: 0, paint: fur, detail: 1, blend: 0.03 });
  body.root.ellipsoid('torso', new Vector3(0, 0.12, 0), [0.08, 0.07, 0.12], { taper: 0.2 });
  const head = body.root.attach('head', { bone: 1, join: 0.03 });
  head.ellipsoid('skull', new Vector3(0, 0.2, 0.12), [0.045, 0.045, 0.05]);
  for (const side of [1, -1]) {
    const leg = body.root.attach('leg' + side, { bone: side > 0 ? 2 : 3, join: 0.03, blend: 0.01 });
    const x = side * (legGap / 2 + 0.014);
    leg.limb('leg', [new Vector3(x, 0.1, 0.06), new Vector3(x, 0.04, 0.07), new Vector3(x, 0.008, 0.09)], [0.014, 0.012, 0.011]);
  }
  return body;
}

function signedVolume(geometry: ReturnType<ReturnType<SculptBody['build']>['geometry']>): number {
  const position = geometry.getAttribute('position');
  let volume = 0;
  for (let i = 0; i < position.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(position, i), b = new Vector3().fromBufferAttribute(position, i + 1), c = new Vector3().fromBufferAttribute(position, i + 2);
    volume += a.dot(b.cross(c)) / 6;
  }
  return volume;
}

test('blended parts become one closed outward shell inside the triangle budget', () => {
  const result = creature(0.03).build({ triangles: 900, cell: 0.004, floor: 0 });
  assert.deepEqual({ ...result.topology, problems: [] }, { shells: 1, boundaryEdges: 0, nonManifoldEdges: 0, windingErrors: 0, pinchedVertices: 0, problems: [] });
  assert.ok(Math.abs(result.triangles - 900) <= 45, 'triangles ' + result.triangles);
  assert.ok(signedVolume(result.geometry()) > 0);
  assert.ok(Math.abs(result.minY()) < 1e-3);
});

test('sibling limbs closer than their join never weld together', () => {
  const result = creature(0.012).build({ triangles: 900, cell: 0.003, floor: 0 });
  assert.ok(result.separation(2, 3) > 0.006, 'gap ' + result.separation(2, 3));
});

test('a shape floating free of the body fails with its name', () => {
  const body = creature(0.03);
  body.root.attach('floater', { bone: 0, join: 0.002 }).ellipsoid('moon', new Vector3(0, 0.45, 0), [0.02, 0.02, 0.02]);
  assert.throws(() => body.build({ triangles: 900, cell: 0.004, floor: 0 }), /float free of the body: floater\.moon/);
});

test('a decal is rebuilt as concentric rings with an exact pupil fan', () => {
  const pupil: SculptRGB = [0.05, 0.05, 0.05];
  const body = new SculptBody({ bone: 0, paint: fur, detail: 1, blend: 0.02 });
  body.root.ellipsoid('ball', new Vector3(0, 0.1, 0), [0.08, 0.08, 0.08]);
  const seat = body.root.surface(new Vector3(0, 0.1, 0), new Vector3(1, 0, 0));
  body.root.decal('eye', seat, new Vector3(1, 0, 0), [{ radius: 0.02, paint: [0.9, 0.9, 0.85] }, { radius: 0.013, paint: [0.4, 0.25, 0.15] }, { radius: 0.007, paint: pupil }], { segments: 10 });
  const result = body.build({ triangles: 700, cell: 0.004 });
  assert.equal(result.topology.shells, 1);
  assert.equal(result.topology.boundaryEdges + result.topology.nonManifoldEdges + result.topology.windingErrors, 0);
  const color = result.geometry().getAttribute('color');
  let dark = 0;
  for (let i = 0; i < color.count; i += 3) if (Math.abs(color.getX(i) - pupil[0]) < 1e-6) dark++;
  assert.equal(dark, 10);
});

test('a thin leaf keeps its tip through reduction and remeshing', () => {
  const body = new SculptBody({ bone: 0, paint: fur, detail: 1, blend: 0.02 });
  body.root.ellipsoid('head', new Vector3(0, 0.1, 0), [0.05, 0.05, 0.05]);
  const ear = body.root.attach('ear', { bone: 1, join: 0.01, detail: 3 });
  ear.ellipsoid('leaf', new Vector3(0, 0.2, 0), [0.025, 0.008, 0.07], { forward: new Vector3(0, 1, 0), up: new Vector3(0, 0, 1), taper: -0.2 });
  const result = body.build({ triangles: 600, cell: 0.004 });
  const position = result.geometry().getAttribute('position');
  let top = -Infinity;
  for (let i = 0; i < position.count; i++) top = Math.max(top, position.getY(i));
  assert.ok(top > 0.27 - 0.006, 'tip ' + top.toFixed(4));
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, OrthographicCamera } from 'three';
import { buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { fitBounds, corners } from '../src/studio/framing.ts';
test('all bounds stay inside narrow and wide viewports including depth clipping', () => {
  for (const [family, input] of [['fence', { length: 6, bays: 3 }], ['cottage', { width: 7.2 }], ['work-lantern', {}]] as const) {
    const b = buildAsset(family, input);
    for (const aspect of [0.3, 0.8, 2.5]) for (const direction of [new Vector3(2.7,1.85,3.5), new Vector3(0,0,1), new Vector3(0,1,0.00001)]) {
      const camera = new OrthographicCamera();
      const center = b.bounds.getCenter(new Vector3());
      camera.position.copy(center).addScaledVector(direction.normalize(), b.dimensions.length() * 3);
      camera.lookAt(center);
      fitBounds(camera, b.bounds, aspect, 1.32);
      for (const point of corners(b.bounds)) {
        const p = point.project(camera);
        assert.ok(Math.abs(p.x) <= 1 / 1.32 + 1e-6 && Math.abs(p.y) <= 1 / 1.32 + 1e-6);
        assert.ok(p.z > -1 && p.z < 1);
      }
    }
    disposeAsset(b);
  }
});

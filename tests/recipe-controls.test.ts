import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePreset} from '../hosted/app/preset-resolve.ts';

test('published titles resolve to that presets own parameters', () => {
  const fruit = resolvePreset({title: 'Fruit Stall Preset'});
  const pottery = resolvePreset({title: 'Pottery Booth Preset'});
  const smithy = resolvePreset({handle: 'smithy--preset--base'});
  const candidate = resolvePreset({candidate: 'new-final/market-stall/fruit-stall--preset--base'});
  assert.equal(fruit?.family, 'market-stall');
  assert.equal(fruit?.applied.type, 'awning');
  assert.equal(fruit?.applied.goods, 'produce');
  assert.equal(fruit?.applied.width, 2.8);
  assert.equal(pottery?.applied.type, 'canopy');
  assert.equal(pottery?.applied.goods, 'pottery');
  assert.equal(smithy?.family, 'smithy-anvil');
  assert.equal(smithy?.applied.tools, 'hammer-tongs');
  assert.equal(candidate?.family, 'market-stall');
  assert.equal(resolvePreset({title: 'Garden bench 25'}), null);
  assert.equal(resolvePreset({title: 'Fruit Stall Preset', sourceFamily: 'smithy-anvil'}), null);
});

test('market stall parameters rebuild the mesh', async () => {
  const fruit = resolvePreset({title: 'Fruit Stall Preset'});
  assert.ok(fruit);
  const specifier = new URL('../hosted/app/modules/market-stall/1.0.0/asset.mjs', import.meta.url).href;
  const loaded = await import(specifier) as {
    createAsset(input?: Record<string, unknown>): {
      traverse(visit: (object: {isMesh?: boolean; geometry?: {index?: {count: number} | null; attributes?: {position?: {count: number}}}; material?: {color?: {getHexString(): string}} | Array<{color?: {getHexString(): string}}>}) => void): void;
      dispose(): void;
      userData: {design?: {applied?: {type?: string; width?: number}}};
    };
    metadata: {controls: Array<{key: string; label: string}>};
  };
  const labels = loaded.metadata.controls.map(control => control.label);
  assert.ok(labels.includes('Stall type'));
  assert.ok(labels.includes('Width'));
  assert.ok(labels.includes('Stripes'));
  assert.equal(labels.includes('Size'), false);
  const triangles = (root: {traverse: (visit: (object: {isMesh?: boolean; geometry?: {index?: {count: number} | null; attributes?: {position?: {count: number}}}}) => void) => void}) => {
    let count = 0;
    root.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      count += object.geometry.index ? object.geometry.index.count / 3 : (object.geometry.attributes?.position?.count ?? 0) / 3;
    });
    return count;
  };
  const colors = (root: {traverse: (visit: (object: {isMesh?: boolean; material?: {color?: {getHexString(): string}} | Array<{color?: {getHexString(): string}}>}) => void) => void}) => {
    const found = new Set<string>();
    root.traverse(object => {
      if (!object.isMesh || !object.material) return;
      for (const material of [object.material].flat()) {
        if (material?.color) found.add(material.color.getHexString());
      }
    });
    return [...found].sort().join(',');
  };
  const base = loaded.createAsset({...fruit.applied});
  const changed = loaded.createAsset({...fruit.applied, type: 'cart', width: 4, stripes: 14});
  const harborInput = {...fruit.applied, colorway: 'harbor'} as Record<string, string | number | boolean>;
  for (const key of Object.keys(harborInput)) if (key.startsWith('color.')) delete harborInput[key];
  const harbor = loaded.createAsset(harborInput);
  const timber = loaded.createAsset({...fruit.applied, 'color.timber': '#112233'});
  try {
    assert.equal(triangles(base), 2340);
    assert.equal(changed.userData.design?.applied?.type, 'cart');
    assert.equal(changed.userData.design?.applied?.width, 4);
    assert.notEqual(triangles(changed), triangles(base));
    assert.notEqual(colors(harbor), colors(base));
    assert.ok(colors(timber).includes('112233'));
  } finally {
    base.dispose();
    changed.dispose();
    harbor.dispose();
    timber.dispose();
  }
});

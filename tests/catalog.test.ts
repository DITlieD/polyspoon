import { registry } from '../src/recipes/index.ts';
import { families } from '../src/families/index.ts';
import type { Family } from '../src/families/index.ts';
import { Mesh } from 'three';
import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, buildAsset, disposeAsset, loadDesign, resolveExport } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { generateLantern, disposeLantern } from '../src/lantern/generator.ts';
import { exportGlb } from '../src/lantern/export.ts';
import { DesignSession } from '../src/catalog/session.ts';

test('registry builds every preset and round trips strict saved designs', () => {
  assert.equal(catalog.length, registry.descriptors.length);
  assert.ok(catalog.some(d=>d.id==='bench'));
  for(const id of ['work-lantern','cottage','tree','fence','crate','boulder'])assert.ok(catalog.some(d=>d.id===id));
  for (const family of catalog) for (const preset of family.presets) {
    const build = buildAsset(family.id, preset.parameters);
    assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(build.config))), build.config);
    assert.throws(() => loadDesign({ ...build.config, familyVersion: 'bad' }));
    assert.throws(() => loadDesign({ ...build.config, applied: {} }));
    disposeAsset(build);
  }
  assert.throws(() => buildAsset('unknown', {}));
  assert.throws(() => loadDesign(null));
  assert.throws(() => buildAsset('tree', { seed: 1.5 }));
  assert.throws(() => buildAsset('fence', { bays: 1.5 }));
});

test('export resolution rejects conflicts and preserves lantern defaults', () => {
  assert.equal(resolveExport({}).family, 'work-lantern');
  const tree = buildAsset('tree');
  assert.equal(resolveExport({}, tree.config).family, 'tree');
  assert.throws(() => resolveExport({ family: 'crate' }, tree.config), /conflict/i);
  assert.throws(() => resolveExport({ preset: 'young' }, tree.config), /preset/i);
  assert.throws(() => resolveExport({ family: 'tree', preset: 'missing' }), /preset/i);
  disposeAsset(tree);
});

test('shared exporter and lantern alias produce identical current-version bytes', async () => {
  const legacy = generateLantern({}), shared = buildAsset('work-lantern');
  try { assert.deepEqual(await exportAsset(shared), await exportGlb(legacy)); }
  finally { disposeLantern(legacy); disposeAsset(shared); }
});

test('session retains each valid design and invalidates stale loads even after rejected edits', () => {
  const session = new DesignSession();
  session.apply({ bodyWidth: 0.4 });
  session.select('tree'); session.apply({ height: 5 });
  session.select('work-lantern');
  assert.equal(session.config.applied.bodyWidth, 0.4);
  session.select('tree'); assert.equal(session.config.applied.height, 5);
  const before = session.config, ticket = session.beginLoad();
  assert.throws(() => session.apply({ height: -1 }));
  assert.deepEqual(session.config, before);
  assert.equal(session.finishLoad(ticket, before), false);
  const next = session.beginLoad(); session.select('crate');
  assert.equal(session.finishLoad(next, before), false);
  assert.throws(() => session.load({ ...before, familyVersion: 'bad' }));
  assert.equal(session.config.family, 'crate');
  session.load(before); assert.equal(session.config.family, 'tree');
  session.reset(); assert.equal(session.config.applied.height, 4.5);
  session.dispose();
});

test('family swatches represent used roles and relationship errors name repair controls', () => {
  const cases: Record<string, unknown> = {
    cottage: {width:3.6,roofRise:2},
    tree: {height:6,spread:2.4},
    fence: {length:6,bays:1},
    crate: {width:0.45,height:1.2},
    boulder: {width:0.6,height:1.8},
  };
  const directColors:Record<string,Record<string,string>>={
    'stylized-humanoid':{skin:'#c49375',tunic:'#657764',boots:'#473c36',hair:'#3b302b'},
    'stylized-fox':{fur:'#b95b32',cream:'#eadbc4',dark:'#332c2a'},
  };
  for (const family of catalog) {
    const palette=family.palettes[0],usesColorway=family.controls.some(c=>c.key==='colorway');
    if(usesColorway)assert.ok(palette,family.id+' colorway requires a palette');
    const build=buildAsset(family.id,usesColorway?{colorway:palette!.id}:{});
    const roles=family.id==='work-lantern'?['body','enclosure','structure']:Object.hasOwn(families,family.id)?families[family.id as Family].paletteRoles:family.controls.filter(c=>c.kind==='color').map(c=>c.role);
    const used=new Set<string>();
    build.root.traverse(object=>{if(object instanceof Mesh)used.add(object.userData.materialRole);});
    if(palette)assert.deepEqual(palette.colors,roles.map(role=>build.config.applied['color.'+role]),family.id+' authored palette colors');
    else{
      const expected=directColors[family.id];assert.ok(expected,family.id+' declared direct colors');
      assert.deepEqual(roles,Object.keys(expected));
      for(const [role,color] of Object.entries(expected))assert.equal(build.config.applied['color.'+role],color,family.id+':'+role);
    }
    for(const role of roles){
      assert.ok(used.has(role),family.id+': palette role is used: '+role);
      assert.ok(family.controls.some(control=>control.kind==='color'&&control.role===role),family.id+': palette role is editable: '+role);
    }
    disposeAsset(build);
    if (cases[family.id]) assert.throws(() => family.save(cases[family.id]), /relationship:.*(Widen|Increase|Reduce|Lower)/);
  }
});

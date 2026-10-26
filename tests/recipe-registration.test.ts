import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { RecipeRegistry, validateRecipe } from '../src/recipes/registry.ts';
import { registry, recipe } from '../src/recipes/index.ts';
import { benchRecipe } from '../examples/recipes/bench/index.ts';
import type { Recipe } from '../src/recipes/types.ts';
import { catalog, buildAsset, disposeAsset, loadDesign, descriptor } from '../src/catalog/index.ts';
import { measurements } from '../src/catalog/measure.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { sourceProvenance } from '../scripts/provenance.ts';

test('registration rejects duplicate identities and malformed declarations without partial insertion', () => {
  const registry = new RecipeRegistry();
  registry.register(benchRecipe);
  assert.throws(() => registry.register(benchRecipe), /Duplicate recipe/);
  assert.equal(registry.descriptors.length, 1);
  assert.throws(() => registry.get('unknown'), /Unknown family/);
  const bad: Recipe[] = [
    {...benchRecipe,source:{...benchRecipe.source,entry:'../private.ts'}},
    {...benchRecipe,source:{...benchRecipe.source,entry:'/tmp/bench.ts'}},
    {...benchRecipe,source:{...benchRecipe.source,entry:'examples/../secret.ts'}},
    {...benchRecipe,source:{...benchRecipe.source,exportName:'default()'}},
    {...benchRecipe,descriptor:{...benchRecipe.descriptor,controls:[...benchRecipe.descriptor.controls,benchRecipe.descriptor.controls[0]!]}},
    {...benchRecipe,descriptor:{...benchRecipe.descriptor,defaults:{...benchRecipe.descriptor.defaults,width:-1}}},
    {...benchRecipe,descriptor:{...benchRecipe.descriptor,presets:[]}},
    {...benchRecipe,validationCases:[benchRecipe.validationCases[0]!,benchRecipe.validationCases[0]!]},
    {...benchRecipe,presentation:{...benchRecipe.presentation,thumbnails:{garden:'../../private.png'}}},
  ];
  for (const invalid of bad) {
    const target = new RecipeRegistry();
    assert.throws(() => target.register(invalid));
    assert.equal(target.descriptors.length,0);
  }
  validateRecipe(benchRecipe);
});

test('independent recipe registration reaches existing catalog build load and export dispatch', async () => {
  const id = 'registration-test-seat';
  const d = benchRecipe.descriptor;
  const replacement = (input:unknown) => ({...d.save(input),family:id});
  const independent: Recipe = {
    ...benchRecipe,
    descriptor:{...d,id,title:'Independent seat',save:replacement},
    source:{entry:'examples/recipes/registration-test-seat/index.ts',exportName:'seatRecipe'},
    build(input) {
      const result = benchRecipe.build(input);
      result.config.family = id;
      result.root.name = id;
      return result;
    },
    load(input) {
      const value = input as Record<string,unknown>;
      if (value.family !== id) throw new Error('Wrong independent family');
      return {...benchRecipe.load({...value,family:'bench'}),family:id};
    },
  };
  registry.register(independent);
  assert.ok(catalog.some(d => d.id === id));
  assert.equal(descriptor(id),independent.descriptor);
  const build = buildAsset(id,{width:1.2,backrest:false});
  try {
    assert.equal(build.config.family,id);
    assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(build.config))),build.config);
    assert.ok((await exportAsset(build)).length > 1000);
  } finally { disposeAsset(build); }
});

test('bench controls change geometry topology and semantic material roles', () => {
  const configurations = [{},{width:2.4},{slatCount:6},{backrest:false},{'color.wood':'#123456'}];
  const builds = configurations.map(input => buildAsset('bench',input));
  try {
    const [base,wide,slatted,backless,colored] = builds;
    assert.ok(wide!.dimensions.x > base!.dimensions.x);
    assert.equal(measurements(slatted!).parts.length,measurements(base!).parts.length+2);
    assert.equal(measurements(backless!).parts.length,measurements(base!).parts.length-4);
    assert.ok(backless!.dimensions.y < base!.dimensions.y);
    assert.equal(colored!.materials.wood!.color.getHexString(),'123456');
    assert.deepEqual(Object.keys(base!.materials).sort(),['frame','wood']);
    assert.equal(base!.anchors.seat![1],base!.config.applied.seatHeight);
    assert.equal(recipe('bench').descriptor.state({backrest:false}).controls.backHeight!.enabled,false);
    assert.deepEqual(recipe('bench').presentation.kitIds,[]);
    assert.equal(catalog.filter(d=>recipe(d.id).presentation.kitIds.includes('woodland-workshop')).length,6);
  } finally { builds.forEach(disposeAsset); }
});

test('source identity includes the executable contributor entry', async () => {
  const provenance = await sourceProvenance();
  assert.ok(provenance.sources['examples/recipes/bench/index.ts']);
  for(const path of ['CONTRIBUTING.md','docs/authoring/guide.md','docs/authoring/coding-agent.md','docs/contributing/review.md'])assert.ok(provenance.sources[path],path);
});

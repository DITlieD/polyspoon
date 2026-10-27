import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { recipe } from '../src/recipes/index.ts';
import { createDiscoveryModel, filterModels, readDiscoveryState, discoverySearch, modelStyle, styleLabels } from '../src/site/discovery.ts';

const models=catalog.map(d=>{const b=buildAsset(d.id);try{return createDiscoveryModel(d,recipe(d.id).presentation.category,b.semantics,1);}finally{disposeAsset(b);}});
test('discovery keeps one classified record per registered model and derives rigid-pose capability',()=>{
 assert.equal(models.length,catalog.length);assert.equal(new Set(models.map(m=>m.id)).size,catalog.length);
 assert.ok(models.every(m=>m.style!=='unclassified'&&Object.hasOwn(styleLabels,m.style)));
 assert.equal(modelStyle('scifi-cargo'),'clean-hard-surface');
 assert.equal(modelStyle('future-unreviewed-recipe'),'unclassified');assert.equal(modelStyle('constructor'),'unclassified');
 for(const m of models){const b=buildAsset(m.id);try{assert.equal(m.poseable,b.semantics.joints.length>0);}finally{disposeAsset(b);}}
});
test('discovery composes word search, type, one current style and supported capability',()=>{
 const state=readDiscoveryState(new URLSearchParams('q=CHEST&type=Props&style=faceted-low-poly&capability=poseable'),models);
 assert.deepEqual(filterModels(models,state).map(m=>m.id),['treasure-chest']);
 assert.deepEqual(filterModels(models,{...state,query:'work-lantern'}),[]);
 assert.deepEqual(filterModels(models,{...state,type:'Nature'}),[]);
 assert.equal(filterModels(models,readDiscoveryState(new URLSearchParams(),models)).length,catalog.length);
 const byDescription=models.find(m=>m.id==='bench')!;
 assert.ok(filterModels(models,{...state,type:'',capability:'',query:byDescription.description}).some(m=>m.id==='bench'));
});
test('discovery URL state round-trips filters and sorting with safe invalid-value fallback',()=>{
 const state=readDiscoveryState(new URLSearchParams('q=stone+well&type=Props&style=faceted-low-poly&capability=poseable&sort=triangles'),models);
 assert.deepEqual(readDiscoveryState(new URLSearchParams(discoverySearch(state)),models),state);
 const invalid=readDiscoveryState(new URLSearchParams('type=Invented&style=Photoreal&capability=animation&sort=kit'),models);
 assert.deepEqual(invalid,{query:'',type:'',style:'',capability:'',sort:'name'});
 assert.equal(discoverySearch(invalid),'');
 const entries=[{...models[0]!,id:'a',title:'Alpha',triangles:20},{...models[0]!,id:'b',title:'Beta',triangles:10}];
 assert.deepEqual(filterModels(entries,{...invalid,sort:'triangles'}).map(m=>m.id),['b','a']);
 assert.deepEqual(filterModels(entries,{...invalid,sort:'name-desc'}).map(m=>m.id),['b','a']);
});

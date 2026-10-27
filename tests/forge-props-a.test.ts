import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { exportDeliverable } from '../src/catalog/delivery.ts';
import { recipe } from '../src/recipes/index.ts';
import { forgePropsA } from '../src/recipes/forge-props-a.ts';
import { forgeRecipe, box } from '../src/engine/forge-kit.ts';
import { geometryQa, nearDuplicate, categoryBudgets, type GeometrySignature } from '../src/formats/qa.ts';

test('lane-A prop families: every preset is a distinct shape inside the Props budget with no z-fighting or floating parts',async()=>{
 assert.deepEqual(forgePropsA.map(r=>r.descriptor.id),['smithy-anvil','bookcase','dining-set','campfire-cookpot','alchemy-bench','weapon-rack']);
 for(const r of forgePropsA){
  const id=r.descriptor.id,sigs:GeometrySignature[]=[];
  assert.ok(r.descriptor.presets.length>=3,id);
  for(const preset of r.descriptor.presets){
   const b=buildAsset(id,preset.parameters);
   try{const qa=geometryQa(await exportDeliverable(b),{category:recipe(id).presentation.category,openEdges:'error'});
    assert.equal(qa.ok,true,id+'/'+preset.id+': '+qa.errors.join('; '));
    assert.deepEqual(qa.zFight,[],id+'/'+preset.id+' z-fight');assert.deepEqual(qa.floating,[],id+'/'+preset.id+' floating');
    assert.ok(qa.triangles<=categoryBudgets.Props!.triangles*0.95,id+'/'+preset.id+' budget');
    for(const s of sigs)assert.equal(nearDuplicate(s,qa.signature),false,id+'/'+preset.id+' repeats another preset');
    sigs.push(qa.signature);
   }finally{disposeAsset(b);}
  }
 }
});

test('forge families reject a part connected to a missing part',()=>{
 const r=forgeRecipe({id:'probe',version:'1.0.0',title:'Probe',description:'probe',category:'Props',order:9999,entry:'x',exportName:'x',roles:{a:'a'},palettes:{p:{label:'P',colors:{a:'#ffffff'}}},controls:[],presets:[{id:'d',name:'d',description:'d',parameters:{}}],constraints:[],
  build(_p,add){add('base','a',box([0.2,0.2,0.2],[0,0.1,0]));add('lid','a',box([0.2,0.05,0.2],[0,0.22,0]),'bsae');return {};}});
 assert.throws(()=>r.build({}),/connected to missing part bsae/);
});

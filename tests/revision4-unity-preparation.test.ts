import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset} from '../src/catalog/export.ts';
import {revision4Fixtures,appearanceExpectations} from '../scripts/revision4-unity-fixtures.ts';
test('revision4 Unity fixture list preserves families and adds four real appearance cases',()=>{
 assert.equal(revision4Fixtures.length,37);
 assert.equal(new Set(revision4Fixtures.map(f=>f.name)).size,37);
 assert.equal(revision4Fixtures.filter(f=>f.name.endsWith('-default')).length,6);
 assert.equal(revision4Fixtures.filter(f=>f.name.includes('-preset-')).length,18);
});
test('Unity appearance expectations distinguish vertex colors and exported unlit materials',async()=>{
 for(const shading of ['None','Flat','Toon3bands'] as const){
  const b=buildAsset('fence',{appearance:{version:1,palette:'None',shading,partColors:{'post-0':'#aabbcc'}}});
  try{
   const data=appearanceExpectations(await exportAsset(b));
   assert.equal(data.verifyAppearance,true);
   assert.equal(data.requireUnlit,shading!=='None');
   assert.ok(data.parts.every(p=>p.verifyVertexColors&&p.vertexColors.length>0));
   assert.ok(data.materials.every(m=>m.unlit===(shading!=='None')));
   for(const part of data.parts)for(const color of part.vertexColors)assert.ok(Object.values(color).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
   assert.ok(data.materials.some(m=>m.name.includes('post-0')));
  }finally{disposeAsset(b);}
 }
});

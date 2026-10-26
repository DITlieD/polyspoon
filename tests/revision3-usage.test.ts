import test from 'node:test';
import assert from 'node:assert/strict';
import {usageContent} from '../src/site/usage.ts';
import type {Design} from '../src/catalog/index.ts';

test('usage instructions preserve versioned requested parameters, choices and colors',()=>{
 const design:Design={formatVersion:1,family:'cottage',familyVersion:'0.4.0',requested:{roofCover:'shingle','color.roof':'#765b42'},applied:{roofCover:'shingle','color.roof':'#765b42'}};
 const content=usageContent(design);
 assert.deepEqual(JSON.parse(content.design.snippets[0]!.text),design);
 assert.ok(content.design.snippets[1]!.text.includes('--config cottage.design.json --out exports/cottage.glb'));
 const calls=JSON.parse(content.agent.snippets[0]!.text);
 assert.deepEqual(calls.map((c:{name:string})=>c.name),['get_asset','build_variant','export_asset']);
 assert.deepEqual(calls[1].arguments,{family:'cottage',parameters:design.requested});
 assert.deepEqual(calls[2].arguments,{family:'cottage',parameters:design.requested,filename:'cottage.glb'});
 const changed=structuredClone(design);changed.requested.roofCover='thatch';changed.applied.roofCover='thatch';
 assert.equal(JSON.parse(usageContent(changed).agent.snippets[0]!.text)[1].arguments.parameters.roofCover,'thatch');
 assert.ok(content.glb.snippets[0]!.text.includes("loadAsync('./cottage.glb')"));
});

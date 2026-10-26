import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadLabel} from '../hosted/app/download-labels.ts';
import {derivedFormats} from '../server/formats.ts';

test('member downloads get format labels, including every derived format the server lists',()=>{
 assert.equal(downloadLabel('selected.glb'),'Download GLB');
 assert.deepEqual(Object.keys(derivedFormats).map(downloadLabel),['Download OBJ','Download FBX','Download USDZ','Download Controls JSON']);
 assert.equal(downloadLabel('selected.design.json'),null);assert.equal(downloadLabel('packages/bench-1.1.0-source.2.zip'),null);
});

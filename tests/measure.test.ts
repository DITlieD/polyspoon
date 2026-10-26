import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { measurements } from '../src/catalog/measure.ts';
test('Unity expectations use precise transformed vertex bounds and actual linear colors', () => {
  const b=buildAsset('fence',{length:6,bays:3});
  try {
    const result=measurements(b), precise=new Box3().setFromObject(b.root,true);
    assert.deepEqual(result.maximum,{x:precise.max.x,y:precise.max.y,z:precise.max.z});
    assert.ok(result.maximum.z-result.minimum.z<0.2);
    assert.equal(result.parts.length,26);
    assert.equal(result.parts.filter(p=>p.name.startsWith('joint-peg-')).length,12);
    for (const part of result.parts) {
      const object=b.root.getObjectByName(part.name)!;
      const box=new Box3().setFromObject(object,true);
      assert.deepEqual(part.minimum,{x:box.min.x,y:box.min.y,z:box.min.z});
    }
    for (const m of result.materials) {
      const actual=b.materials[m.name]!;
      assert.deepEqual(m.linearColor,{r:actual.color.r,g:actual.color.g,b:actual.color.b,a:1});
    }
  } finally {disposeAsset(b);}
});

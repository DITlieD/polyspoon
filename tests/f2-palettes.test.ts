import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPalette, paletteMatches } from '../src/engine/parameters.ts';
import { validateRecipe } from '../src/recipes/registry.ts';
import { recipe } from '../src/recipes/index.ts';

test('non-colorway palettes require a valid semantic color patch at registration',()=>{
  const r=recipe('treasure-chest'),p=r.descriptor.palettes[0]!;
  for(const parameters of [undefined,{}, {'color.wood':'invalid'}, {'unknown':'#123456'}, {width:1}]) {
    assert.throws(()=>validateRecipe({...r,descriptor:{...r.descriptor,palettes:[{...p,parameters} as typeof p]}}),/palette/i);
  }
  validateRecipe({...r,descriptor:{...r.descriptor,palettes:[{...p,parameters:{'color.wood':'#123456','color.frame':'#234567','color.brass':'#345678'}}]}});
});

test('semantic palette application and comparison are independent of control and preview swatch order',()=>{
  const d=recipe('treasure-chest').descriptor;
  const parameters={'color.wood':'#123456','color.frame':'#234567','color.brass':'#345678'};
  const palette={...d.palettes[0]!,parameters,colors:['#345678','#123456','#234567']};
  const reversed={...d,controls:d.controls.toReversed(),palettes:[palette]};
  const input={lidAngle:85,'color.wood':'#ffffff'};
  assert.deepEqual(applyPalette(reversed,input,palette.id),{lidAngle:85,...parameters});
  assert.deepEqual(input,{lidAngle:85,'color.wood':'#ffffff'});
  assert.equal(paletteMatches(reversed,d.save({lidAngle:85,...parameters}).applied,palette.id),true);
  assert.equal(paletteMatches(reversed,d.save({}).applied,palette.id),false);
});

test('existing colorway application clears overrides and keeps its requested palette path',()=>{
  const d=recipe('bench').descriptor;
  const requested=applyPalette(d,{width:1.2,'color.wood':'#ffffff',colorway:'oak'},'painted');
  assert.deepEqual(requested,{width:1.2,colorway:'painted'});
  assert.equal(paletteMatches(d,d.save(requested).applied,'painted'),true);
  assert.throws(()=>applyPalette(d,{},'missing'),/palette/i);
});

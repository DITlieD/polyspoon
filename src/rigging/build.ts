import { buildRecipeAsset } from '../catalog/build.ts';
import { designInput,parseAppearance } from '../catalog/appearance.ts';
import { plainRecord } from '../engine/parameters.ts';
import { humanoidRecipe } from '../recipes/rigged.ts';
import type { RiggedAssetBuild } from './types.ts';
export function buildHumanoid(input:unknown={}):RiggedAssetBuild {
  return buildRecipeAsset(humanoidRecipe,input) as RiggedAssetBuild;
}

export function loadHumanoidDesign(input:unknown){const source={...plainRecord(input)},appearance=source.appearance;delete source.appearance;const design=humanoidRecipe.load(source);if(appearance!==undefined)design.appearance=parseAppearance(appearance);return design;}
export function buildSavedHumanoid(input:unknown):RiggedAssetBuild {return buildHumanoid(designInput(loadHumanoidDesign(input)));}

import { buildRecipeAsset } from '../catalog/build.ts';
import { designInput,parseAppearance } from '../catalog/appearance.ts';
import { plainRecord } from '../engine/parameters.ts';
import { foxRecipe } from '../recipes/rigged.ts';
import type { RiggedAssetBuild } from './types.ts';
export { applyFoxPawTarget } from './fox-motion.ts';
export function buildFox(input:unknown={}):RiggedAssetBuild {
  return buildRecipeAsset(foxRecipe,input) as RiggedAssetBuild;
}

export function loadFoxDesign(input:unknown){const source={...plainRecord(input)},appearance=source.appearance;delete source.appearance;const design=foxRecipe.load(source);if(appearance!==undefined)design.appearance=parseAppearance(appearance);return design;}
export function buildSavedFox(input:unknown):RiggedAssetBuild {const design=loadFoxDesign(input),build=buildFox(designInput(design));if(design.migration)build.config.migration=design.migration;return build;}

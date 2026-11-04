import { buildRecipeAsset, disposeAsset } from '../catalog/build.ts';
import { designInput, parseAppearance } from '../catalog/appearance.ts';
import { plainRecord } from '../engine/parameters.ts';
import { rabbitRecipe } from '../../examples/recipes/stylized-rabbit/index.ts';
import type { RiggedAssetBuild } from './types.ts';

export function buildRabbit(input: unknown = {}): RiggedAssetBuild {
  const build = buildRecipeAsset(rabbitRecipe, input) as RiggedAssetBuild;
  build.dispose = () => disposeAsset(build);
  return build;
}

export function loadRabbitDesign(input: unknown) {
  const source = {...plainRecord(input)}, appearance = source.appearance;
  delete source.appearance;
  const design = rabbitRecipe.load(source);
  if (appearance !== undefined) design.appearance = parseAppearance(appearance);
  return design;
}

export function buildSavedRabbit(input: unknown): RiggedAssetBuild {
  const design = loadRabbitDesign(input);
  const build = buildRabbit(designInput(design));
  if (design.migration) build.config.migration = design.migration;
  return build;
}

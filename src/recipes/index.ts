import { RecipeRegistry } from './registry.ts';
import { lanternRecipe, cottageRecipe, treeRecipe, fenceRecipe, crateRecipe, boulderRecipe } from './builtins.ts';
import { benchRecipe } from '../../examples/recipes/bench/index.ts';
import { planterRecipe } from '../../examples/recipes/planter/index.ts';
import { treasureChestRecipe } from '../../examples/recipes/treasure-chest/index.ts';
import { wheelbarrowRecipe } from '../../examples/recipes/wheelbarrow/index.ts';
import { stoneWellRecipe } from '../../examples/recipes/stone-well/index.ts';
import { coniferRecipe } from '../../examples/recipes/conifer/index.ts';
import { humanoidRecipe,foxRecipe,rabbitRecipe } from './rigged.ts';
import { forgeRecipes } from './forge.ts';
export type { Recipe, RecipeCase } from './types.ts';

export const registry = new RecipeRegistry();
for (const entry of [lanternRecipe,cottageRecipe,treeRecipe,fenceRecipe,crateRecipe,boulderRecipe,benchRecipe,planterRecipe,treasureChestRecipe,wheelbarrowRecipe,stoneWellRecipe,coniferRecipe,humanoidRecipe,foxRecipe,rabbitRecipe,...forgeRecipes]) registry.register(entry);
export const recipe = (id: string) => registry.get(id);
/** Catalog shelves in display order. Every built-in family must use one, with a unique presentation order. */
export const catalogCategories = ['Buildings','Structures','Props','Nature','Characters','Animals','Vehicles','Sci-fi'] as const;
{
  const orders = new Map<number,string>();
  for (const d of registry.descriptors) {
    const p = registry.get(d.id).presentation;
    if (!(catalogCategories as readonly string[]).includes(p.category)) throw new Error('Unknown catalog category for '+d.id+': '+p.category);
    if (orders.has(p.order)) throw new Error('Duplicate catalog order '+p.order+': '+orders.get(p.order)+' and '+d.id);
    orders.set(p.order,d.id);
  }
}

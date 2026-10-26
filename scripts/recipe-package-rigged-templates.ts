import { buildEntry as staticBuildEntry,runnerEntry as staticRunnerEntry,rebuildInstructions as staticInstructions } from './recipe-package-templates.ts';

export const riggedBuildEntry=staticBuildEntry.replace('catalog|recipes|engine|lantern|families','catalog|recipes|engine|lantern|families|rigging');
export const riggedRebuildInstructions=staticInstructions.replace('All geometry is static.','Rigged recipes retain bound skeletons and animation clips in GLB exports. Other recipes remain static.');
export function riggedRunnerEntry(family:string):string {
  return staticRunnerEntry(family).replace("import { exportAsset } from './src/catalog/export.ts';","import { exportDeliverable } from './src/catalog/delivery.ts';").replace('await exportAsset(build)','await exportDeliverable(build)');
}

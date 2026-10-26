import { exportAsset } from '../catalog/export.ts';
import { attachSemantics } from '../catalog/semantics.ts';
import { lanternControls } from './config.ts';
import type { AssetBuild,Preview } from '../catalog/types.ts';

export function exportGlb(build:Pick<Preview,'root'>){
 const candidate=build as Partial<AssetBuild>;
 if(!build.root.userData.openpoly&&candidate.config?.family==='work-lantern'&&candidate.anchors&&candidate.materials)attachSemantics(candidate as AssetBuild,lanternControls());
 return exportAsset(build);
}

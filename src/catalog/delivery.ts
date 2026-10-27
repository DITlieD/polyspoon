import { exportAsset } from './export.ts';
import { exportRiggedAsset } from '../rigging/export.ts';
import type { SemanticAssetBuild } from './types.ts';
import type { RiggedAssetBuild } from '../rigging/types.ts';

export function exportDeliverable(build:SemanticAssetBuild,options:{stripUnusedUvs?:boolean}={}):Promise<Uint8Array> {
  return 'rig' in build?exportRiggedAsset(build as RiggedAssetBuild,options):exportAsset(build,options);
}

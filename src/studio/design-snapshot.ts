import {buildAsset,resolveExport} from '../catalog/index.ts';
import type {SemanticAssetBuild} from '../catalog/types.ts';

export function buildDesignSnapshot(input:unknown):SemanticAssetBuild {
 const resolved=resolveExport({},input),snapshot=buildAsset(resolved.family,resolved.input);
 if(resolved.migration)snapshot.config.migration=structuredClone(resolved.migration);
 return snapshot;
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Mesh } from 'three';
import type { AssetBuild } from '../src/catalog/types.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { readSemantics } from '../src/catalog/semantics.ts';
import { geometrySnapshot } from '../src/lantern/inspect.ts';

export function exportLegacyPayload(build:AssetBuild){
 readSemantics(build.root);
 const root=build.root.clone(true);root.traverse(node=>{delete node.userData.openpoly;});
 return exportAsset({root});
}
export const baselineBuilds=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/semantic-baseline-builds.json.gz',import.meta.url))).toString());
export function compareBaselineBuild(build:AssetBuild,baseline:any){
 const parts=geometrySnapshot(build.root) as any[];assert.equal(parts.length,baseline.parts.length);assert.deepEqual(parts.map(p=>p.name).sort(),baseline.parts.map((p:any)=>p.name).sort());
 let maximumMatrixError=0;
 for(const original of baseline.parts){const current=parts.find(p=>p.name===original.name)!;assert.equal(JSON.stringify(current.attributes),JSON.stringify(original.attributes),original.name);assert.deepEqual(current.indices,original.indices,original.name);
  const delta=Math.max(...original.matrix.map((n:number,i:number)=>Math.abs(n-current.matrix[i])));maximumMatrixError=Math.max(maximumMatrixError,delta);assert.ok(delta<=1e-12,original.name+' transform');
 }
 const materials:any[]=[];build.root.traverse(node=>{if(node instanceof Mesh)materials.push({name:node.name,materials:(Array.isArray(node.material)?node.material:[node.material]).map(m=>{const {uuid,metadata,...value}=m.toJSON();return value;})});});
 assert.deepEqual(materials.sort((a,b)=>a.name.localeCompare(b.name)),baseline.materials.toSorted((a:any,b:any)=>a.name.localeCompare(b.name)));
 assert.deepEqual(build.config,baseline.config);assert.deepEqual(build.anchors,baseline.anchors);assert.equal(build.dimensions.toArray().length,baseline.dimensions.length);for(const [i,n] of build.dimensions.toArray().entries())assert.ok(Math.abs(n-baseline.dimensions[i])<=1e-12);
 return maximumMatrixError;
}

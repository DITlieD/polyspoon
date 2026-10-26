import { Group,SkinnedMesh } from 'three';
import { exportRiggedEnvironment } from './export.ts';
import { buildSurfaceFeatures } from './features.ts';
import { buildAsset,disposeAsset,type SemanticAssetBuild } from '../catalog/index.ts';
import { designInput } from '../catalog/appearance.ts';
import { exportAsset } from '../catalog/export.ts';
import { buildTerrainTile,createSurface } from './terrain.ts';
import { loadEnvironment,type EnvironmentManifest } from './manifest.ts';
export * from './terrain.ts';
export * from './manifest.ts';
export { exampleEnvironment } from './example.ts';

export function buildEnvironment(input:unknown) {
  const config=loadEnvironment(input),root=new Group(),tiles:ReturnType<typeof buildTerrainTile>[]=[],assets:SemanticAssetBuild[]=[],features:ReturnType<typeof buildSurfaceFeatures>=[];root.name='environment';root.userData.environment=config;
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;for(const tile of [...tiles,...features]){tile.geometry.dispose();tile.material.dispose();}for(const asset of assets)disposeAsset(asset);}
  try{
    for(const t of config.tiles){const tile=buildTerrainTile(config.terrain,t);tiles.push(tile);root.add(tile);}
    features.push(...buildSurfaceFeatures(config));if(features.length)root.add(...features);
    const surface=createSurface(config.terrain);
    for(const p of config.placements){
      const sample=surface.sample(p.x,p.z);if(sample.slopeDegrees>p.maxSlopeDegrees)throw new Error('Placement exceeds slope limit: '+p.id);
      const asset=buildAsset(p.design.family,designInput(p.design));assets.push(asset);if(p.design.migration)asset.config.migration=p.design.migration;
      const center=asset.bounds.getCenter(asset.dimensions.clone()),size=config.terrain.cells*config.terrain.cellSize,stepsX=Math.max(1,Math.ceil(asset.dimensions.x/(config.terrain.cellSize/2))),stepsZ=Math.max(1,Math.ceil(asset.dimensions.z/(config.terrain.cellSize/2)));
      if((stepsX+1)*(stepsZ+1)>20000)throw new Error('Placement footprint sampling budget exceeded');
      let minimum=sample.height,maximum=sample.height;const angle=p.yaw*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
      for(let iz=0;iz<=stepsZ;iz++)for(let ix=0;ix<=stepsX;ix++){
        const u=(ix/stepsX-.5)*asset.dimensions.x,v=(iz/stepsZ-.5)*asset.dimensions.z,x=p.x+u*cos+v*sin,z=p.z-u*sin+v*cos;
        if(!config.tiles.some(t=>x>=t.x*size&&x<=(t.x+1)*size&&z>=t.z*size&&z<=(t.z+1)*size))throw new Error('Placement footprint outside terrain');
        const height=surface.sample(x,z).height;minimum=Math.min(minimum,height);maximum=Math.max(maximum,height);
      }
      if(maximum-minimum>p.maxSupportVariation)throw new Error('Placement support variation exceeded: '+p.id);
      asset.root.position.set(-center.x,-asset.bounds.min.y,-center.z);
      const wrapper=new Group();wrapper.name='placement-'+p.id;wrapper.position.set(p.x,maximum,p.z);wrapper.rotation.y=angle;wrapper.userData.groundAnchor=[p.x,maximum,p.z];wrapper.userData.grounding='upright-sampled-footprint-maximum';wrapper.userData.support={minimum,maximum,samples:(stepsX+1)*(stepsZ+1),maximumVariation:p.maxSupportVariation};wrapper.userData.surface=sample;wrapper.add(asset.root);root.add(wrapper);
    }
    root.updateMatrixWorld(true);return {root,config,dispose};
  }catch(error){dispose();throw error;}
}
export interface EnvironmentBuild {root:Group;config:EnvironmentManifest;dispose:()=>void}
export async function exportEnvironment(build:EnvironmentBuild,provenance:Record<string,unknown>={}):Promise<Uint8Array> {
  build.root.userData.environment=loadEnvironment(build.config);build.root.userData.provenance=structuredClone(provenance);let rigged=false;build.root.traverse(node=>{if(node instanceof SkinnedMesh)rigged=true;});return rigged?exportRiggedEnvironment(build.root):exportAsset(build);
}

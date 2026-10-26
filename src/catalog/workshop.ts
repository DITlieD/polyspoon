import { Box3, Group, Vector3 } from 'three';
import { buildAsset, disposeAsset } from './index.ts';
import type { AssetBuild, Preview } from './index.ts';
export const arrangement = [
  { family:'cottage', input:{}, position:[0,0,-1.8], rotation:0 },
  { family:'tree', input:{height:5,spread:4.2,seed:18}, position:[-5.4,0,0.35], rotation:0.3 },
  { family:'fence', input:{length:3,height:0.9,bays:2}, position:[-2.9,0,2.45], rotation:Math.PI/2 },
  { family:'fence', input:{length:3,height:0.9,bays:2}, position:[4.3,0,2.7], rotation:Math.PI/2 },
  { family:'crate', input:{width:0.8,height:0.6,depth:0.65}, position:[-1.55,0,1.25], rotation:-0.1 },
  { family:'work-lantern', input:{}, position:[-1.55,0.6,1.25], rotation:0 },
  { family:'boulder', input:{width:1.6,height:0.8,depth:1.2}, position:[4.6,0,-0.4], rotation:0.45 },
] as const;
export function buildWorkshop(): Preview & { dispose(): void } {
  const root = new Group(); root.name = 'arranged-workshop';
  const builds: AssetBuild[] = [], materials: Preview['materials'] = {};
  arrangement.forEach((entry,i) => {
    const b = buildAsset(entry.family, entry.input); builds.push(b);
    for (const [role, material] of Object.entries(b.materials)) materials[i + ':' + role] = material;
    b.root.traverse(object => { if (object.userData.materialRole) object.userData.materialRole = i + ':' + object.userData.materialRole; });
    b.root.position.set(entry.position[0], entry.position[1], entry.position[2]); b.root.rotation.y = entry.rotation;
    root.add(b.root);
  });
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root,true);
  return { root, bounds, dimensions: bounds.getSize(new Vector3()), materials, dispose: () => builds.forEach(disposeAsset) };
}

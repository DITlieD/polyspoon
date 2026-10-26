import { Box3, Mesh, Vector3 } from 'three';
import type { AssetBuild } from './index.ts';
export function measurements(build: AssetBuild) {
  build.root.updateMatrixWorld(true);
  const bounds = new Box3(), parts: Array<{ name: string; material: string; minimum: {x:number;y:number;z:number}; maximum: {x:number;y:number;z:number} }> = [];
  const materials = new Map<string,{ name:string; linearColor:{r:number;g:number;b:number;a:number} }>();
  let triangles = 0;
  const xyz = (v: Vector3) => ({ x:v.x,y:v.y,z:v.z });
  build.root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if (Array.isArray(object.material)) throw new Error('Expected one material per mesh');
    const position = object.geometry.getAttribute('position'), partBounds = new Box3();
    for (let i=0;i<position.count;i++) partBounds.expandByPoint(new Vector3().fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld));
    bounds.union(partBounds);
    triangles += (object.geometry.index?.count ?? position.count) / 3;
    const m = object.material;
    if (!('color' in m)) throw new Error('Expected colored material');
    const color = (m as typeof build.materials[string]).color;
    materials.set(m.name,{ name:m.name,linearColor:{r:color.r,g:color.g,b:color.b,a:m.opacity} });
    parts.push({ name:object.name,material:m.name,minimum:xyz(partBounds.min),maximum:xyz(partBounds.max) });
  });
  if (new Set(parts.map(p=>p.name)).size !== parts.length) throw new Error('Duplicate mesh names');
  return { sourceRoot:build.root.name,coordinateSpace:'gltf',lanternChecks:false,minimum:xyz(bounds.min),maximum:xyz(bounds.max),groundAnchor:{x:0,y:0,z:0},up:{x:0,y:1,z:0},front:{x:0,y:0,z:1},triangles,parts,materials:[...materials.values()] };
}

import { Group,Mesh,Scene,SkinnedMesh } from 'three';
import type { AnimationClip,BufferGeometry,Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readSemantics } from '../catalog/semantics.ts';
import { validateRigMotion } from '../rigging/validation.ts';
import type { RigMetadata } from '../rigging/types.ts';

export async function exportRiggedEnvironment(root:Group):Promise<Uint8Array> {
  const rigs:Group[]=[];
  root.traverse(node=>{if(node instanceof Group&&node.userData.openpolyRig){readSemantics(node);validateRigMotion(node,node.userData.openpolyRig as RigMetadata);rigs.push(node);}});
  if(!rigs.length)throw new Error('Environment skin has no rig metadata');
  const copy=clone(root),nodes=new Map<Object3D,Object3D>(),scene=new Scene(),geometries=new Set<BufferGeometry>();
  const pair=(source:Object3D,target:Object3D)=>{nodes.set(source,target);source.children.forEach((child,i)=>pair(child,target.children[i]!));};pair(root,copy);
  scene.name=root.name;scene.userData=structuredClone(root.userData);
  for(const child of [...copy.children])scene.add(child);
  try{
    const animations:AnimationClip[]=[];
    for(const rig of rigs){
      const wrapper=rig.parent;
      if(!wrapper?.name.startsWith('placement-'))throw new Error('Rig placement wrapper missing');
      const placementId=wrapper.name.slice('placement-'.length);
      for(const source of rig.animations){
        const clip=source.clone();clip.name=placementId+':'+source.name;
        for(const track of clip.tracks){const [name,property]=track.name.split('.'),target=nodes.get(rig.getObjectByName(name!)!);if(!target)throw new Error('Rig animation target missing');track.name=target.uuid+'.'+property;}
        animations.push(clip);
      }
      rig.traverse(source=>{const target=nodes.get(source)!;target.animations=[];if(target instanceof SkinnedMesh){target.userData.placementId=placementId;scene.add(target);target.position.set(0,0,0);target.quaternion.identity();target.scale.set(1,1,1);target.updateMatrix();}});
    }
    scene.traverse(node=>{if(node instanceof Mesh&&!Array.isArray(node.material)&&'flatShading' in node.material&&node.material.flatShading){const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometries.add(geometry);geometry.computeVertexNormals();node.geometry=geometry;}});
    scene.updateMatrixWorld(true);
    const result=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:false,trs:true,animations});
    if(!(result instanceof ArrayBuffer))throw new Error('Exporter did not produce animated environment glTF');
    return new Uint8Array(result);
  }finally{const skeletons=new Set<SkinnedMesh['skeleton']>();scene.traverse(node=>{if(node instanceof SkinnedMesh)skeletons.add(node.skeleton);});for(const skeleton of skeletons)skeleton.dispose();for(const geometry of geometries)geometry.dispose();}
}

import { AnimationMixer,Box3,LoopOnce,SkinnedMesh,Vector3 } from 'three';
import type { RiggedAssetBuild } from './types.ts';
export function riggedMotionBounds(build:RiggedAssetBuild):Box3 {
  const bounds=new Box3(),root=build.root,mixer=new AnimationMixer(root);
  try{
    for(const clip of root.animations){const action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
      for(let sample=0;sample<=16;sample++){mixer.setTime(sample/16*clip.duration);root.updateMatrixWorld(true);root.traverse(object=>{if(object instanceof SkinnedMesh){object.skeleton.update();const attribute=object.geometry.getAttribute('position');for(let i=0;i<attribute.count;i++)bounds.expandByPoint(object.getVertexPosition(i,new Vector3()).applyMatrix4(object.matrixWorld));}});}
      mixer.stopAllAction();mixer.uncacheClip(clip);
    }
    return bounds;
  }finally{mixer.stopAllAction();mixer.uncacheRoot(root);root.updateMatrixWorld(true);root.traverse(object=>{if(object instanceof SkinnedMesh)object.skeleton.update();});}
}

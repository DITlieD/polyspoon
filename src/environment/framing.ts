import { Box3,Vector3,type Object3D,type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function frameEnvironmentObject(object:Object3D,camera:PerspectiveCamera,controls:Pick<OrbitControls,'target'|'maxDistance'|'update'>,preserveDirection=false):boolean {
  const bounds=new Box3().setFromObject(object);if(bounds.isEmpty())return false;
  const center=bounds.getCenter(new Vector3()),span=Math.max(bounds.getSize(new Vector3()).length(),.01),direction=preserveDirection?camera.position.clone().sub(controls.target):new Vector3(1.1,1,1.3);
  if(direction.lengthSq()<1e-12)direction.set(1.1,1,1.3);direction.normalize();
  camera.position.copy(center).add(direction);camera.lookAt(center);
  const right=new Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new Vector3(0,1,0).applyQuaternion(camera.quaternion),vertical=Math.tan(camera.getEffectiveFOV()*Math.PI/360)*.85,horizontal=vertical*camera.aspect;
  let distance=span*.1;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const corner=new Vector3(x,y,z).sub(center),depth=corner.dot(direction);
    distance=Math.max(distance,depth+Math.abs(corner.dot(right))/horizontal,depth+Math.abs(corner.dot(up))/vertical);
  }
  camera.position.copy(center).addScaledVector(direction,distance);camera.near=Math.max(.00001,span/10000);camera.far=Math.max(100,distance+span*4);camera.updateProjectionMatrix();
  controls.target.copy(center);controls.maxDistance=Math.max(span*8,distance*4);controls.update();camera.lookAt(center);camera.updateMatrixWorld(true);return true;
}

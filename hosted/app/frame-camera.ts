import * as THREE from 'three';

function cornersOf(box: THREE.Box3) {
  const {min, max} = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

export function frameToView(camera: THREE.PerspectiveCamera, orbit: {target: THREE.Vector3}, object: THREE.Object3D, reset: boolean, fill = 0.9) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 0.05);
  const offset = camera.position.clone().sub(orbit.target);
  if (reset || offset.lengthSq() < 1e-6) offset.set(0.95, 0.55, 1.2);
  const direction = offset.normalize();
  orbit.target.copy(center);
  const corners = cornersOf(box);
  let near = radius * 0.2;
  let far = radius * 14;
  let chosen = far;
  for (let step = 0; step < 18; step++) {
    const distance = (near + far) / 2;
    camera.position.copy(center).add(direction.clone().multiplyScalar(distance));
    camera.lookAt(center);
    camera.near = Math.max(distance / 200, 0.01);
    camera.far = distance * 80;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    let extent = 0;
    for (const corner of corners) {
      const projected = corner.clone().project(camera);
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) { extent = 99; break; }
      extent = Math.max(extent, Math.abs(projected.x), Math.abs(projected.y));
    }
    if (extent > fill) near = distance;
    else { far = distance; chosen = distance; }
  }
  camera.position.copy(center).add(direction.clone().multiplyScalar(chosen));
  camera.lookAt(center);
  camera.near = Math.max(chosen / 200, 0.01);
  camera.far = chosen * 80;
  camera.updateProjectionMatrix();
  return {center, radius, distance: chosen};
}

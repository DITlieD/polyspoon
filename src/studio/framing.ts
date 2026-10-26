import { Box3, Vector3 } from 'three';
import type { OrthographicCamera } from 'three';
export function corners(bounds: Box3): Vector3[] {
  return [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new Vector3(x,y,z))));
}
export function fitBounds(camera: OrthographicCamera, bounds: Box3, aspect: number, margin: number, fixedSpan?: number) {
  camera.updateMatrixWorld(true);
  const projected = new Box3().setFromPoints(corners(bounds).map(p => p.applyMatrix4(camera.matrixWorldInverse)));
  const size = projected.getSize(new Vector3());
  const span = fixedSpan ?? Math.max(size.y, size.x / aspect, 0.01) * margin;
  camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
  camera.top = span / 2; camera.bottom = -span / 2;
  const diagonal = Math.max(bounds.getSize(new Vector3()).length(), 0.1);
  camera.near = Math.max(0.001, -projected.max.z - diagonal);
  camera.far = Math.max(camera.near + diagonal, -projected.min.z + diagonal);
  camera.updateProjectionMatrix();
}

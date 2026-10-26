import { AmbientLight, Box3, Color, DirectionalLight, Group, HemisphereLight, MeshBasicMaterial, NoToneMapping, OrthographicCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { buildAsset, disposeAsset } from '../catalog/index.ts';
import type { AssetBuild } from '../catalog/index.ts';
import { inspectGeometry } from '../lantern/inspect.ts';

type Entry = { family: string; input: unknown; position?: readonly [number,number,number]; rotation?: number };
type Build = AssetBuild;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = NoToneMapping;
document.body.append(renderer.domElement);
const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
scene.add(new HemisphereLight(0xffffff, 0xb6bdb0, 1.6), new AmbientLight(0xffffff, 0.25));
const key = new DirectionalLight(0xfffaf0, 2.3); key.position.set(-2, 5, 3); scene.add(key);
const fill = new DirectionalLight(0xf2f7ff, 0.7); fill.position.set(3, 2, -3); scene.add(fill);
const silhouette = new MeshBasicMaterial({ color: '#172119' });
let root = new Group(), builds: Build[] = [];
scene.add(root);
const directions = { front: [0, 0, 1], side: [1, 0, 0], oblique: [2.7, 1.85, 3.5], rear: [-2.7, 1.85, -3.5] } as const;
function display(entries: Entry[], view: keyof typeof directions = 'oblique', mode = 'shaded', fixedSpan?: number) {
  scene.remove(root);
  for (const b of builds) disposeAsset(b);
  root = new Group(); builds = [];
  let cursor = 0;
  for (const entry of entries) {
    const b = buildAsset(entry.family==='lantern'?'work-lantern':entry.family,entry.input);
    if (entry.position) b.root.position.set(...entry.position);
    else if (entries.length > 1) {
      b.root.position.x = cursor - b.bounds.min.x;
      cursor += b.dimensions.x + 1.0;
    }
    b.root.rotation.y=entry.rotation??0;
    root.add(b.root); builds.push(b);
  }
  scene.add(root); root.updateMatrixWorld(true);
  scene.overrideMaterial = mode === 'silhouette' ? silhouette : null;
  scene.background = new Color(mode === 'silhouette' ? '#ffffff' : '#e6e8e3');
  const bounds = new Box3().setFromObject(root, true), center = bounds.getCenter(new Vector3());
  camera.position.copy(center).addScaledVector(new Vector3(...directions[view]).normalize(), 50);
  camera.lookAt(center); camera.updateMatrixWorld(true);
  const projected = new Box3();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) projected.expandByPoint(new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  const width = innerWidth, height = innerHeight, aspect = width / height;
  const size = projected.getSize(new Vector3()), span = fixedSpan ?? Math.max(size.y, size.x / aspect) * 1.20;
  camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2;
  camera.updateProjectionMatrix(); renderer.setSize(width, height); renderer.render(scene, camera);
  return {
    span, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    entries: builds.map(b => ({ config: b.config, position: b.root.position.toArray(), dimensions: b.dimensions.toArray(), anchors: b.anchors, inspection: inspectGeometry(b.root) })),
  };
}
window.kitReview = { display };
declare global { interface Window { kitReview: { display: typeof display } } }
display([{ family: 'cottage', input: {} }]);

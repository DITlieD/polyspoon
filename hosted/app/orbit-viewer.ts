import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {frameToView} from './frame-camera.ts';
import {mountViewportRails, type RailEntry} from './viewport-rail.ts';

export async function mountOrbit(host: HTMLElement, bytes: Uint8Array): Promise<() => void> {
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  const stage = document.createElement('div');
  stage.className = 'orbit-stage';
  host.replaceChildren(stage);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '3D model. Drag to rotate and scroll to zoom.');
  stage.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6e8e3');
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  const pivot = new THREE.Group();
  scene.add(hemi, key, pivot);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(1e-3, size.length() / 2);
  gltf.scene.position.sub(center);
  pivot.position.copy(center);
  pivot.add(gltf.scene);
  key.position.copy(center).add(new THREE.Vector3(3, 5, 4).multiplyScalar(radius));
  const camera = new THREE.PerspectiveCamera(35, 1, radius / 200, radius * 200);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.12;
  const fit = (reset: boolean) => { frameToView(camera, orbit, pivot, reset); orbit.update(); };
  let fitted = false;
  const controls = document.createElement('div');
  const entries: RailEntry[] = [{key: 'size', label: 'Size', icon: 'shape', side: 'left'}];
  const sizeField = document.createElement('div');
  sizeField.className = 'parameter';
  sizeField.dataset.key = 'size';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'range';
  sizeInput.min = '0.5';
  sizeInput.max = '2';
  sizeInput.step = '0.01';
  sizeInput.value = '1';
  sizeInput.setAttribute('aria-label', 'Size');
  sizeInput.addEventListener('input', () => { pivot.scale.setScalar(Number(sizeInput.value)); });
  sizeField.append(sizeInput);
  controls.append(sizeField);
  const seen = new Set<THREE.Material>();
  let colorIndex = 0;
  gltf.scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of [mesh.material].flat()) {
      if (!material || seen.has(material) || !('color' in material)) continue;
      seen.add(material);
      const colored = material as THREE.MeshStandardMaterial;
      const keyName = 'color-' + colorIndex++;
      const labelText = colored.name || mesh.name || ('Color ' + colorIndex);
      const field = document.createElement('div');
      field.className = 'parameter';
      field.dataset.key = keyName;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = '#' + colored.color.getHexString();
      input.setAttribute('aria-label', labelText);
      input.addEventListener('input', () => { colored.color.set(input.value); });
      field.append(input);
      controls.append(field);
      entries.push({key: keyName, label: labelText, icon: 'palette', side: 'right', swatch: true});
    }
  });
  const rail = mountViewportRails(stage, controls, {
    showControl(key?: string) {
      for (const child of controls.children) {
        const item = child as HTMLElement;
        item.hidden = key !== undefined && item.dataset.key !== key;
      }
    },
  }, entries);
  const resize = () => {
    const width = Math.max(240, stage.clientWidth || host.clientWidth || 640);
    const height = Math.max(240, stage.clientHeight || width);
    renderer.setSize(width, height, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!fitted && (stage.clientWidth || host.clientWidth)) { fitted = true; fit(true); }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  let running = true;
  const loop = () => { if (!running) return; orbit.update(); renderer.render(scene, camera); requestAnimationFrame(loop); };
  loop();
  return () => { running = false; rail.dispose(); observer.disconnect(); orbit.dispose(); renderer.dispose(); host.replaceChildren(); };
}

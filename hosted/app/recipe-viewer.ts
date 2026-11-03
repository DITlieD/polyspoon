import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ControlPanel} from '../../src/studio/controls.ts';
import {applyPalette, parameterState, parseControls, type Control, type Descriptor, type Design, type Palette, type ParameterIssue, type Parameters, type Preset} from '../../src/engine/parameters.ts';
import type {PresetRecord} from './preset-index.ts';
import {appliedOf, describe, loaderFor, ownMaterials, parametersFor} from './recipe-loader.ts';
import {frameToView} from './frame-camera.ts';
import {entriesForControls, mountViewportRails} from './viewport-rail.ts';

function issuesOf(error: unknown): ParameterIssue[] {
  if (error && typeof error === 'object' && 'issues' in error && Array.isArray((error as {issues: unknown}).issues)) return (error as {issues: ParameterIssue[]}).issues;
  return [{code: 'invalid', keys: [], message: 'This change cannot be applied.'}];
}
export async function mountRecipe(preview: HTMLElement, record: PresetRecord, controlsHost: HTMLElement): Promise<() => void> {
  const load = loaderFor(record.family);
  if (!load) throw new Error('Missing recipe module');
  const recipe = await load();
  if (recipe.metadata.id !== record.family) throw new Error('Recipe module mismatch');
  const descriptor = describe(recipe.metadata);
  const stage = document.createElement('div');
  stage.className = 'orbit-stage';
  preview.replaceChildren(stage);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', recipe.metadata.title + '. Drag to rotate, scroll to zoom, and change its parameters.');
  stage.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6e8e3');
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  const pivot = new THREE.Group();
  scene.add(hemi, key, pivot);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.12;
  const initial = Object.keys(record.applied).length ? {...record.applied} : parametersFor(recipe.metadata, record.hint ?? '');
  let current = recipe.createAsset({...initial});
  ownMaterials(current);
  let draft = appliedOf(current, record.applied);
  pivot.add(current);
  const fit = (reset: boolean) => {
    const framed = frameToView(camera, orbit, current, reset);
    key.position.copy(framed.center).add(new THREE.Vector3(3, 5, 4).multiplyScalar(framed.radius));
    orbit.update();
  };
  let fitted = false;
  const design = (): Design => ({formatVersion: 1, family: recipe.metadata.id, familyVersion: recipe.metadata.version, requested: {...draft}, applied: {...draft} as Parameters});
  const pending = new Set<string>();
  const rebuild = (next: Record<string, unknown>, resetCamera: boolean) => {
    const built = recipe.createAsset(next);
    ownMaterials(built);
    pivot.remove(current);
    current.dispose();
    current = built;
    pivot.add(current);
    draft = appliedOf(current, next);
    fit(resetCamera);
  };
  const published = Object.keys(record.applied).length ? {...record.applied} : {...initial};
  controlsHost.classList.add('recipe-controls');
  let panel: ControlPanel;
  panel = new ControlPanel(controlsHost, {
    change(key, value) {
      try {
        rebuild({...draft, [key]: value}, false);
        panel.refresh(descriptor, design(), draft, [], pending);
        return true;
      } catch (error) {
        panel.refresh(descriptor, design(), draft, issuesOf(error), pending);
        return false;
      }
    },
    reset(key) {
      const next = {...draft};
      if (Object.hasOwn(published, key)) next[key] = published[key];
      else delete next[key];
      try { rebuild(next, false); } catch (error) { panel.refresh(descriptor, design(), draft, issuesOf(error), pending); return; }
      panel.refresh(descriptor, design(), draft, [], pending);
    },
    palette(id) {
      try { rebuild(applyPalette(descriptor, draft, id), false); } catch (error) { panel.refresh(descriptor, design(), draft, issuesOf(error), pending); return; }
      panel.refresh(descriptor, design(), draft, [], pending);
    },
    begin() {},
    end() {},
    pending(key, active) { if (active) pending.add(key); else pending.delete(key); },
    select(role) {
      current.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const on = mesh.userData.materialRole === role || mesh.userData.openpoly?.materialId === role;
        for (const material of [mesh.material].flat()) {
          if (!material || !('emissive' in material)) continue;
          (material as THREE.MeshStandardMaterial).emissive.set(on ? '#2f6b45' : '#000000');
        }
      });
      panel.select(role);
    },
  });
  panel.mount(descriptor);
  panel.refresh(descriptor, design(), draft, [], pending);
  const rail = mountViewportRails(stage, controlsHost, panel, entriesForControls(recipe.metadata.controls, recipe.metadata.palettes.length));
  const resize = () => {
    const width = Math.max(240, stage.clientWidth || preview.clientWidth || 640);
    const height = Math.max(240, stage.clientHeight || width);
    renderer.setSize(width, height, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!fitted && (stage.clientWidth || preview.clientWidth)) { fitted = true; fit(true); }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  let running = true;
  const loop = () => { if (!running) return; orbit.update(); renderer.render(scene, camera); requestAnimationFrame(loop); };
  loop();
  return () => {
    running = false;
    rail.dispose();
    observer.disconnect();
    orbit.dispose();
    current.dispose();
    renderer.dispose();
    preview.replaceChildren();
  };
}

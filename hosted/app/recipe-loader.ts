import type * as THREE from 'three';
import {parameterState, parseControls, type Control, type Descriptor, type Design, type Palette, type Parameters, type Preset} from '../../src/engine/parameters.ts';

export interface RecipeMetadata {
  id: string;
  version: string;
  title: string;
  description: string;
  controls: Control[];
  defaults: Parameters;
  presets: Preset[];
  palettes: Palette[];
}
export interface BuiltAsset extends THREE.Object3D {
  dispose(): void;
}
export interface RecipeModule {
  createAsset(input?: Record<string, unknown>): BuiltAsset;
  metadata: RecipeMetadata;
}
const loaders = import.meta.glob('./modules/*/*/asset.mjs') as Record<string, () => Promise<RecipeModule>>;

const sources = import.meta.glob('./modules/*/*/asset.mjs', {query: '?url', import: 'default', eager: true}) as Record<string, string>;

function latestFor<T>(entries: Record<string, T>, family: string) {
  const matches = Object.entries(entries).filter(([path]) => path.includes('/' + family + '/'));
  matches.sort((left, right) => right[0].localeCompare(left[0]));
  return matches[0]?.[1] ?? null;
}
export function sourceUrlFor(family: string) {
  return latestFor(sources, family);
}
export function loaderFor(family: string) {
  return latestFor(loaders, family);
}
export function describe(meta: RecipeMetadata): Descriptor {
  return {
    id: meta.id,
    version: meta.version,
    title: meta.title,
    description: meta.description,
    controls: meta.controls,
    defaults: meta.defaults,
    presets: meta.presets,
    palettes: meta.palettes,
    save(input: unknown): Design {
      const applied = parseControls(meta.controls, input);
      return {formatVersion: 1, family: meta.id, familyVersion: meta.version, requested: {...applied}, applied};
    },
    state(input: unknown) {
      return parameterState(meta.controls, input);
    },
  };
}
export function parametersFor(meta: RecipeMetadata, hint: string) {
  const folded = hint.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  let best: RecipeMetadata['presets'][number] | null = null;
  let bestScore = 0;
  for (const preset of meta.presets) {
    const id = preset.id.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const tokens = id.split(' ').filter(Boolean);
    if (!tokens.length || !tokens.every(token => folded.includes(token))) continue;
    if (id.length > bestScore) { best = preset; bestScore = id.length; }
  }
  return {...(best?.parameters ?? {})};
}
export function appliedOf(asset: BuiltAsset, fallback: Record<string, unknown>) {
  const design = asset.userData.design as {applied?: Record<string, unknown>} | undefined;
  return {...(design?.applied ?? fallback)};
}
export function ownMaterials(root: THREE.Object3D) {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(material => material.clone()) : mesh.material.clone();
  });
}


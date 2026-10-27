import { buildRecipeAsset, disposeAsset } from './build.ts';
export { disposeAsset } from './build.ts';
import { splitAppearance, designInput } from './appearance.ts';
import { registry, recipe } from '../recipes/index.ts';
import type { Design, Control, Descriptor } from '../engine/parameters.ts';
import type { SemanticAssetBuild } from './types.ts';
export type { Design, Control, Descriptor, ParameterValue } from '../engine/parameters.ts';
export type { AssetBuild, SemanticAssetBuild, Preview } from './types.ts';
export const catalog = registry.descriptors;

export function descriptor(id: string): Descriptor {
  return recipe(id).descriptor;
}
export function buildAsset(id = 'work-lantern', input: unknown = {}): SemanticAssetBuild {
  descriptor(id);
  return buildRecipeAsset(recipe(id),input);
}
export function loadDesign(input: unknown): Design {
  if (!input || typeof input !== 'object' || !('family' in input) || typeof input.family !== 'string') throw new Error('Design must identify its family');
  descriptor(input.family);
  const {parameters,appearance}=splitAppearance(input);
  const design=recipe(input.family).load(parameters);
  if(appearance){const checked=buildAsset(design.family,{...design.requested,appearance});disposeAsset(checked);design.appearance=appearance;}
  return design;
}
/**
 * Accept a partial --config: requested values only, as {family, requested},
 * {family, parameters} or a flat parameter object with --family. Missing
 * values take defaults. A full saved design (with "applied") is not partial.
 */
export function partialConfig(familyOption: string | undefined, saved: unknown): { family: string; input: Record<string,unknown>; migration: undefined } | undefined {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('--config must be a JSON object');
  const value = saved as Record<string,unknown>;
  if (Object.hasOwn(value, 'applied')) return undefined;
  const family = typeof value.family === 'string' ? value.family : familyOption;
  if (!family) throw new Error('Partial --config needs a family: add "family" to the JSON or pass --family');
  if (familyOption && familyOption !== family) throw new Error('Family argument ' + familyOption + ' conflicts with config family ' + family);
  if (!registry.descriptors.some(d => d.id === family)) throw new Error('Unknown family in --config: ' + family + ' (known: ' + registry.descriptors.map(d => d.id).join(', ') + ')');
  const d = descriptor(family);
  if (value.familyVersion !== undefined && value.familyVersion !== d.version) throw new Error('Partial --config for ' + family + ' targets version ' + String(value.familyVersion) + ', but only the current ' + d.version + ' accepts partial values; save a full design to migrate');
  const nested = value.requested ?? value.parameters;
  if (nested !== undefined && (typeof nested !== 'object' || nested === null || Array.isArray(nested))) throw new Error('"requested"/"parameters" in --config must be an object');
  const input = { ...(nested as Record<string,unknown> | undefined ?? Object.fromEntries(Object.entries(value).filter(([key]) => !['family','familyVersion','formatVersion'].includes(key)))) };
  const known = new Set(d.controls.map(c => c.key)), unknown = Object.keys(input).filter(key => !known.has(key) && key !== 'appearance');
  if (unknown.length) throw new Error('Unknown ' + family + ' parameter(s) in --config: ' + unknown.join(', ') + '. Known: ' + [...known].join(', '));
  try { const checked = buildAsset(family, input); disposeAsset(checked); } catch (error) {
    const message = error instanceof Error ? error.message : String(error), hints = d.controls.filter(c => message.includes(c.key)).map(c => c.kind === 'range' || c.kind === 'integer' ? c.key + ' allows ' + c.min + '..' + c.max : c.kind === 'choice' ? c.key + ' allows ' + c.options.map(o => o.value).join('|') : c.key + ' is ' + c.kind);
    throw new Error('Invalid ' + family + ' --config: ' + message + (hints.length ? ' (' + hints.join('; ') + ')' : ''));
  }
  return { family, input, migration: undefined };
}
export function resolveExport(options: { family?: string; preset?: string }, saved?: unknown) {
  if (saved !== undefined) {
    if (options.preset) throw new Error('Choose either preset or config');
    const partial = partialConfig(options.family, saved);
    if (partial) return partial;
    const config = loadDesign(saved);
    if (options.family && options.family !== config.family) throw new Error('Family argument conflicts with saved configuration');
    return { family: config.family, input: designInput(config), migration: config.migration };
  }
  const d = descriptor(options.family ?? 'work-lantern');
  const preset = d.presets.find(p => p.id === (options.preset ?? d.presets[0]!.id));
  if (!preset) throw new Error('Unknown preset: ' + options.preset);
  return { family: d.id, input: preset.parameters, migration: undefined };
}
export function validationCases(id: string) { return recipe(id).validationCases; }
export function formatControl(c: Control, value: number): string {
  if (c.kind !== 'range' && c.kind !== 'integer') return String(value);
  if (c.unit === 'cm') return (value * 100).toFixed(1) + ' cm';
  if (c.unit === 'm') return value.toFixed(2) + ' m';
  if (c.unit === 'ratio') return value.toFixed(2) + (c.ratioBasis==='height' ? ' × height' : c.key==='lean' ? ' × width' : '');
  return String(value);
}

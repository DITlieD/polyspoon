import {presetRecords, type PresetRecord} from './preset-index.ts';

export interface PresetQuery {
  title?: string | null;
  handle?: string | null;
  candidate?: string | null;
  sourceFamily?: string | null;
  design?: {family?: string; familyVersion?: string; applied?: Record<string, unknown>} | null;
}

const families = new Set(Object.values(presetRecords).map(record => record.family));

function lookup(key: string | null | undefined): PresetRecord | null {
  if (!key) return null;
  const trimmed = key.trim();
  return presetRecords[trimmed] ?? presetRecords[trimmed.toLowerCase()] ?? null;
}

export function resolvePreset(input: PresetQuery): PresetRecord | null {
  for (const key of [input.candidate, input.handle, input.title]) {
    const found = lookup(key);
    if (!found) continue;
    if (input.sourceFamily && found.family !== input.sourceFamily) continue;
    return found;
  }
  const design = input.design;
  if (design?.family && families.has(design.family) && design.applied && Object.keys(design.applied).length) {
    return {family: design.family, version: design.familyVersion || '1.0.0', applied: design.applied as PresetRecord['applied']};
  }
  return null;
}

export type {PresetRecord};

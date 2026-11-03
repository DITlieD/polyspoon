export const SAFETY_PREVIEW_NAMES = ['view-lit-oppp', 'view-lit-pz', 'view-lit-px', 'view-lit-onpn'] as const;

export function safetyPreviewPath(name: string) {
 return 'safety/' + name + '.png';
}

export function safetyPreviewName(path: string) {
 const match = /^safety\/(view-lit-oppp|view-lit-pz|view-lit-px|view-lit-onpn)\.png$/.exec(path);
 return match ? match[1]! : null;
}

const titleCase = (slug: string) => slug.split('-').filter(Boolean).map(word => word.slice(0, 1).toUpperCase() + word.slice(1)).join(' ');

export function displayTitle(title: string) {
 const kept: string[] = [];
 for (const part of title.split('--').map(item => item.trim()).filter(Boolean)) {
  if (part === 'base' || part === 'preset') continue;
  if (kept.at(-1) === part) continue;
  kept.push(part);
 }
 if (!kept.length) return title;
 const joined = kept.map(part => /^[a-z0-9-]+$/.test(part) ? titleCase(part) : part).join(' ');
 return joined.replace(/\s+preset$/i, '').trim() || joined;
}

export function preferredSafetyPreview<T extends {path: string}>(files: readonly T[]) {
 for (const name of SAFETY_PREVIEW_NAMES) {
  const file = files.find(item => item.path === safetyPreviewPath(name));
  if (file) return file;
 }
 return null;
}

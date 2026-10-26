import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
export async function sourceProvenance() {
  const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'CONTRIBUTING.md', 'docs/authoring/guide.md', 'docs/authoring/coding-agent.md', 'docs/contributing/review.md'];
  async function walk(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const name = join(path, entry.name);
      if (entry.isDirectory()) await walk(name); else files.push(name);
    }
  }
  await walk('src'); await walk('scripts'); await walk('examples/recipes');
  const sources: Record<string, string> = {};
  for (const file of files.sort()) sources[file] = sha256(await readFile(file));
  return { node: process.version, sourceHash: sha256(JSON.stringify(sources)), lockHash: sources['package-lock.json'], sources };
}

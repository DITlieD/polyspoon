import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const [id, title] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || !title?.trim()) throw new Error('Usage: node examples/recipes/starter/scaffold.mjs family-id "Display title"');
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..', id);
const original = await readFile(new URL('../bench/index.ts', import.meta.url), 'utf8');
const exportName = id.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase()) + 'Recipe';
const source = original
  .replaceAll("'bench'", JSON.stringify(id))
  .replaceAll('benchRecipe', exportName)
  .replaceAll("entry:'examples/recipes/bench/index.ts'", 'entry:' + JSON.stringify('examples/recipes/' + id + '/index.ts'))
  .replaceAll("title:'Slatted bench'", 'title:' + JSON.stringify(title));
await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,'index.ts'),source,{flag:'wx'});
console.log('Created examples/recipes/' + id + '/index.ts, export ' + exportName);
console.log('Review and edit the copied bench geometry, controls, presets and validation cases. Then import ' + exportName + ' and add it to the explicit list in src/recipes/index.ts.');

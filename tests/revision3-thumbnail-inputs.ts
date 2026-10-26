import { readFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../scripts/provenance.ts';

export async function thumbnailInputs(root='.') {
 const files=['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html',
  'tests/revision3-thumbnails.ts','tests/revision3-thumbnail-inputs.ts'];
 async function walk(relative:string) {
  for(const entry of await readdir(join(root,relative),{withFileTypes:true})) {
   const name=join(relative,entry.name);
   if(name==='src/site/previews')continue;
   if(entry.isDirectory())await walk(name);else files.push(name);
  }
 }
 await walk('src');await walk('scripts');await walk('examples/recipes');
 const sources:Record<string,string>={};
 for(const name of files.sort())sources[name]=sha256(await readFile(join(root,name)));
 return {node:process.version,sourceHash:sha256(JSON.stringify(sources)),sources};
}
export function requireUnchanged(before:{sourceHash:string},after:{sourceHash:string}) {
 if(before.sourceHash!==after.sourceHash)throw new Error('Thumbnail inputs changed during capture; publication refused.');
}

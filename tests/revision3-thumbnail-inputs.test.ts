import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {thumbnailInputs,requireUnchanged} from './revision3-thumbnail-inputs.ts';

test('thumbnail publication excludes generated files but rejects generator, stage, controls and lock changes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'thumbnail-inputs-'));
 try {
  for(const dir of ['src/site/previews','src/families','src/studio','scripts','tests','examples/recipes/bench'])await mkdir(join(root,dir),{recursive:true});
  const files=['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','tests/revision3-thumbnails.ts','tests/revision3-thumbnail-inputs.ts','src/families/generator.ts','src/studio/stage.ts','src/studio/controls.ts','scripts/provenance.ts','examples/recipes/bench/index.ts'];
  for(const file of files)await writeFile(join(root,file),'initial');
  const before=await thumbnailInputs(root);
  await writeFile(join(root,'src/site/previews/manifest.json'),'new manifest');
  await writeFile(join(root,'src/site/previews/tree.png'),'new image');
  requireUnchanged(before,await thumbnailInputs(root));
  for(const file of ['src/families/generator.ts','src/studio/stage.ts','src/studio/controls.ts','package-lock.json','examples/recipes/bench/index.ts']){
   await writeFile(join(root,file),'changed');
   const after=await thumbnailInputs(root);
   assert.throws(()=>requireUnchanged(before,after),/publication refused/,file);
   await writeFile(join(root,file),'initial');
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildHosted} from '../hosted/build.ts';

test('hosted public output excludes catalog data and private assets are manifest-bound separately',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'polyspoon-hosted-')),output=join(parent,'release');const release=await buildHosted(output);
 const html=await readFile(join(output,'public/index.html'),'utf8');assert.ok(html.includes('/public-assets/'));assert.ok(!html.includes('/app/assets/'));
 assert.equal((await readdir(join(output,'public'))).includes('recipe-packages'),false);assert.equal((await readdir(join(output,'public'))).includes('src'),false);
 const graph=JSON.parse(await readFile(join(output,'public-imports.json'),'utf8')) as string[];assert.ok(graph.length);assert.ok(!graph.some(p=>/src\/(catalog|recipes|families|lantern|studio)|examples\/recipes|site\/previews/.test(p)));
 const index=JSON.parse(await readFile(join(output,'private-release.json'),'utf8'));assert.equal(index.releaseHash,release.releaseHash);assert.ok(index.files['index.html']);assert.ok(Object.keys(index.files).some(path=>path.startsWith('assets/')));
 const app=await readFile(join(output,'app/index.html'),'utf8');assert.ok(app.includes('/app/assets/'));await assert.rejects(()=>buildHosted(output),/exist/i);
});

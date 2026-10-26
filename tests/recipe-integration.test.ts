import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, symlink, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildAsset, disposeAsset, loadDesign } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { registry } from '../src/recipes/index.ts';
import type { Recipe } from '../src/recipes/types.ts';

test('bench is discovered described built and exported through actual MCP stdio', {timeout:30000}, async () => {
  const output = await mkdtemp(join(tmpdir(),'recipe-mcp-'));
  const transport = new StdioClientTransport({command:process.execPath,args:['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('src/mcp/stdio.ts'),'--output-dir',output],cwd:resolve('.'),stderr:'pipe'});
  const client = new Client({name:'recipe-integration-test',version:'1.0.0'});
  const exchanges: unknown[] = [];
  async function call(name:string,args:Record<string,unknown>) {
    const response = await client.callTool({name,arguments:args});
    exchanges.push({name,arguments:args,response});
    assert.ok(!response.isError,JSON.stringify(response));
    const content = response.content.find(c=>c.type==='text');
    assert.ok(content?.type==='text');
    return JSON.parse(content.text);
  }
  try {
    await client.connect(transport);
    const search = await call('search_assets',{query:'bench'});
    assert.deepEqual(search.assets.map((d:{id:string})=>d.id),['bench']);
    const description = await call('get_asset',{family:'bench'});
    assert.ok(description.controls.some((c:{key:string})=>c.key==='slatCount'));
    assert.ok(description.constraints.length);
    assert.deepEqual(description.materialRoles.sort(),['frame','wood']);
    const parameters = {width:1.2,backrest:false};
    const variant = await call('build_variant',{family:'bench',parameters});
    const exported = await call('export_asset',{family:'bench',parameters,filename:'bench.glb'});
    const build = buildAsset('bench',parameters);
    try {
      assert.deepEqual(variant.configuration,build.config);
      assert.deepEqual(new Uint8Array(await readFile(exported.path)),await exportAsset(build));
    } finally { disposeAsset(build); }
    const rejected = await client.callTool({name:'build_variant',arguments:{family:'bench',parameters:{slatCount:0}}});
    assert.equal(rejected.isError,true);
    const evidence = process.env.RECIPE_TEST_EVIDENCE_ROOT;
    assert.ok(evidence,'Run npm run test:integration with a fresh TEST_EVIDENCE_ROOT');
    assert.ok(resolve(evidence).startsWith(resolve('evidence/revision5')+'/'));
    await mkdir(evidence,{recursive:true});
    await writeFile(join(evidence,'mcp-exchanges.json'),JSON.stringify(exchanges,null,2));
  } finally {
    await client.close();
    await unlink(join(output,'bench.glb')).catch(()=>{});
    await rmdir(output);
  }
});

test('starter scaffold creates an independent loadable recipe without overwriting files', async () => {
  const root = await mkdtemp(join(tmpdir(),'recipe-starter-'));
  const recipes = join(root,'examples/recipes');
  await mkdir(join(recipes,'starter'),{recursive:true});
  await mkdir(join(recipes,'bench'));
  await copyFile('examples/recipes/starter/scaffold.mjs',join(recipes,'starter/scaffold.mjs'));
  await copyFile('examples/recipes/bench/index.ts',join(recipes,'bench/index.ts'));
  await symlink(resolve('src'),join(root,'src'));
  await symlink(resolve('node_modules'),join(root,'node_modules'));
  const script = join(recipes,'starter/scaffold.mjs');
  try {
    execFileSync(process.execPath,[script,'fixture-seat','Fixture seat']);
    assert.throws(()=>execFileSync(process.execPath,[script,'fixture-seat','Fixture seat'],{stdio:'pipe'}),/EEXIST/);
    assert.throws(()=>execFileSync(process.execPath,[script,'../escape','Unsafe'],{stdio:'pipe'}));
    const module = await import(pathToFileURL(join(recipes,'fixture-seat/index.ts')).href);
    const recipe = module.fixtureSeatRecipe as Recipe;
    assert.equal(recipe.source.entry,'examples/recipes/fixture-seat/index.ts');
    assert.equal(recipe.source.exportName,'fixtureSeatRecipe');
    registry.register(recipe);
    const build = buildAsset('fixture-seat',{width:1.25,slatCount:5});
    try {
      assert.equal(build.config.family,'fixture-seat');
      assert.deepEqual(loadDesign(build.config),build.config);
      assert.ok((await exportAsset(build)).byteLength > 1000);
    } finally { disposeAsset(build); }
  } finally {
    for(const file of ['starter/scaffold.mjs','bench/index.ts','fixture-seat/index.ts']) await unlink(join(recipes,file)).catch(()=>{});
    for(const directory of ['starter','bench','fixture-seat']) await rmdir(join(recipes,directory)).catch(()=>{});
    for(const link of ['src','node_modules']) await unlink(join(root,link));
    await rmdir(recipes); await rmdir(join(root,'examples')); await rmdir(root);
  }
});

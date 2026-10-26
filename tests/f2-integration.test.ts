import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { catalog, buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { recipe } from '../src/recipes/index.ts';
import { readPackageZip, extractPackage } from '../scripts/recipe-check.ts';
import { sha256 } from '../scripts/provenance.ts';

const root=resolve('evidence/revision7/catalog/integration');
await mkdir(root,{recursive:true});
const run=await mkdtemp(root+'/run-');
const promoted=['planter','treasure-chest','wheelbarrow','stone-well','conifer'];
const changed:Record<string,Record<string,unknown>>={planter:{boardCount:5,feet:false},'treasure-chest':{lidAngle:110,boardCount:6},wheelbarrow:{wheelStyle:'spoked',boardCount:5},'stone-well':{roof:false,bucketDrop:0.6},conifer:{tierCount:5,seed:42}};

test('all twelve families are discovered described built and exported through CLI and actual MCP',{timeout:120000},async()=>{
  assert.equal(catalog.length,12);
  const transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx',resolve('src/mcp/stdio.ts'),'--output-dir',run],cwd:resolve('.'),stderr:'pipe'});
  const client=new Client({name:'catalog-integration',version:'1.0.0'});
  const exchanges:unknown[]=[],results:unknown[]=[];
  async function call(name:string,arguments_:Record<string,unknown>) {
    const response=await client.callTool({name,arguments:arguments_});exchanges.push({name,arguments:arguments_,response});
    assert.ok(!response.isError,JSON.stringify(response));
    const content=response.content.find(c=>c.type==='text');assert.ok(content?.type==='text');return JSON.parse(content.text);
  }
  try {
    await client.connect(transport);
    assert.deepEqual((await call('search_assets',{query:''})).assets.map((x:{id:string})=>x.id).sort(),catalog.map(d=>d.id).sort());
    for (const d of catalog) {
      const description=await call('get_asset',{family:d.id});
      assert.deepEqual(description.controls.map((c:{key:string})=>c.key),d.controls.map(c=>c.key));
      const parameters=changed[d.id]??{},b=buildAsset(d.id,parameters);
      try {
        const expected=await exportAsset(b),config=join(run,d.id+'.design.json');
        await writeFile(config,JSON.stringify(b.config,null,2));
        const variant=await call('build_variant',{family:d.id,parameters});assert.deepEqual(variant.configuration,b.config);
        const exported=await call('export_asset',{family:d.id,parameters,filename:d.id+'-mcp.glb'});
        assert.deepEqual(new Uint8Array(await readFile(exported.path)),expected);
        const output=join(run,d.id+'-cli.glb');
        const log=execFileSync(process.execPath,['--import','tsx','scripts/cli.ts','export','--config',config,'--out',output],{encoding:'utf8',timeout:30000});
        await writeFile(join(run,d.id+'-cli.log'),log);
        assert.deepEqual(new Uint8Array(await readFile(output)),expected);
        results.push({family:d.id,parameters,cliMatches:true,mcpMatches:true,glbSha256:sha256(expected)});
      } finally {disposeAsset(b);}
    }
    const invalid=await client.callTool({name:'build_variant',arguments:{family:'conifer',parameters:{tierCount:11}}});assert.equal(invalid.isError,true);
    await writeFile(join(run,'mcp-exchanges.json'),JSON.stringify(exchanges,null,2));
    await writeFile(join(run,'parity.json'),JSON.stringify({families:12,results},null,2));
  } finally {await client.close();}
});

test('twelve source downloads validate and all five new generators rebuild independent default and construction variants',{timeout:180000},async()=>{
  const index=JSON.parse(await readFile('public/recipe-packages/index.json','utf8'));
  assert.deepEqual(index.packages.map((p:{id:string})=>p.id).sort(),catalog.map(d=>d.id).sort());
  const results:unknown[]=[];
  for (const entry of index.packages) {
    const bytes=await readFile(join('public',entry.url));assert.equal(sha256(bytes),entry.sha256);
    const files=readPackageZip(bytes);assert.equal(JSON.parse(files['manifest.json']!).recipe.entry,recipe(entry.id).source.entry);
    if(!promoted.includes(entry.id))continue;
    const directory=join(run,entry.id+'-source');await extractPackage(bytes,directory);
    const install=execFileSync('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:directory,encoding:'utf8',timeout:60000});
    await writeFile(join(run,entry.id+'-install.log'),install);
    for (const [label,input] of [['default',{}],['changed',changed[entry.id]!]] as const) {
      const b=buildAsset(entry.id,input);
      try {
        await writeFile(join(directory,label+'.json'),JSON.stringify(b.config,null,2));
        const log=execFileSync('npm',['run','rebuild','--','--config',label+'.json','--out',label+'.glb'],{cwd:directory,encoding:'utf8',timeout:60000});
        await writeFile(join(run,entry.id+'-'+label+'-rebuild.log'),log);
        assert.deepEqual(new Uint8Array(await readFile(join(directory,label+'.glb'))),await exportAsset(b));
        results.push({family:entry.id,label,archiveSha256:entry.sha256,glbSha256:sha256(await exportAsset(b)),matches:true});
      } finally {disposeAsset(b);}
    }
  }
  await writeFile(join(run,'source-rebuilds.json'),JSON.stringify({validated:12,rebuilds:results},null,2));
});

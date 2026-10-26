import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';

test('CLI and MCP reproduce the same saved appearance GLB',{timeout:60000},async()=>{
 const root=resolve(process.env.APPEARANCE_INTEGRATION_EVIDENCE_ROOT??'evidence/revision4/viewer-followup/integration');await mkdir(root,{recursive:true});
 const run=await mkdtemp(root+'/run-');
 const appearance={version:1 as const,palette:'CGA' as const,shading:'Toon3bands' as const,partColors:{'rail-0-0':'#ff0000','rail-9-0':'#00ff00'}};
 const build=buildAsset('fence',{length:2,bays:1,appearance});
 const expected=await exportAsset(build),configuration=build.config;disposeAsset(build);
 await writeFile(run+'/source.design.json',JSON.stringify(configuration));
 execFileSync('node_modules/.bin/tsx',['scripts/cli.ts','export','--config',run+'/source.design.json','--out',run+'/cli.glb'],{encoding:'utf8'});
 assert.deepEqual(new Uint8Array(await readFile(run+'/cli.glb')),expected);
 const transport=new StdioClientTransport({command:resolve('node_modules/.bin/tsx'),args:[resolve('src/mcp/stdio.ts'),'--output-dir',run],cwd:resolve('.'),stderr:'pipe'});
 const client=new Client({name:'appearance-parity',version:'1.0.0'});
 try{
  await client.connect(transport);
  const result=await client.callTool({name:'export_asset',arguments:{family:'fence',parameters:{length:2,bays:1},appearance,filename:'mcp.glb'}});
  assert.ok(!result.isError,JSON.stringify(result));
  assert.deepEqual(new Uint8Array(await readFile(run+'/mcp.glb')),expected);
  const invalid=await client.callTool({name:'build_variant',arguments:{family:'fence',appearance:{...appearance,shading:'Unknown'}}});
  assert.equal(invalid.isError,true);
  await writeFile(run+'/receipt.json',JSON.stringify({cliMatches:true,mcpMatches:true,invalidRejected:true,appearance,bytes:expected.length},null,2));
 }finally{await client.close();}
});

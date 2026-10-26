import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateBytes} from 'gltf-validator';
import {descriptor,loadDesign} from '../src/catalog/index.ts';
import {sha256} from '../scripts/provenance.ts';
import {saveFamilyConfiguration as saveRevision3} from '../src/families/revision3-config.ts';

test('production MCP stdio migrates saved designs and preserves parameter mode',{timeout:30000},async()=>{
 const evidence=resolve('evidence/revision12/migration');await mkdir(evidence,{recursive:true});const run=await mkdtemp(join(evidence,'mcp-')),output=join(run,'exports');await mkdir(output);
 const config=JSON.parse(await readFile('examples/mcp-client.json','utf8')).mcpServers['woodland-workshop'],args=[...config.args];args[args.indexOf('--output-dir')+1]=output;
 const transport=new StdioClientTransport({command:config.command,args,cwd:resolve('.'),stderr:'pipe'}),client=new Client({name:'construction-migration-test',version:'1.0.0'}),exchanges:unknown[]=[],stderr:string[]=[];transport.stderr?.on('data',chunk=>stderr.push(String(chunk)));
 const old=JSON.parse(await readFile(join(evidence,'cottage-colored-prior.design.json'),'utf8')),current=loadDesign(old);let pid:number|null=null,closed=false;
 async function call(name:string,input:Record<string,unknown>,failure=false):Promise<any>{const response=await client.callTool({name,arguments:input});exchanges.push({name,arguments:input,response});assert.equal(Boolean(response.isError),failure,JSON.stringify(response));if(failure)return;const content=response.content.find(c=>c.type==='text');assert.ok(content&&content.type==='text');const data=JSON.parse(content.text);assert.deepEqual(data,response.structuredContent);return data;}
 try{
  await client.connect(transport);pid=transport.pid;assert.ok(pid);const tools=await client.listTools();exchanges.push({tools:tools.tools});assert.deepEqual(tools.tools.map(t=>t.name).sort(),['build_variant','export_asset','get_asset','search_assets']);
  const priorParts=JSON.parse(await readFile(join(evidence,'prior-parts.json'),'utf8')),recentFence=priorParts.find((row:any)=>row.family==='fence').oldConfig;
  for(const [design,unchanged] of [[saveRevision3('fence',{}),false],[recentFence,true]] as const){
   const built=await call('build_variant',{design}),notice=built.configuration.migration.notice;
   if(unchanged)assert.match(notice,/fence geometry is unchanged/);else{assert.match(notice,/Construction revised; prior geometry is not reproduced/);assert.doesNotMatch(notice,/geometry is unchanged/);}
   assert.deepEqual((await call('build_variant',{design:built.configuration})).configuration,built.configuration);
  }
  assert.deepEqual((await call('build_variant',{design:old})).configuration,current);assert.deepEqual((await call('build_variant',{family:'cottage',design:current})).configuration,current);
  assert.deepEqual((await call('build_variant',{family:'cottage'})).configuration,descriptor('cottage').save({}));assert.deepEqual((await call('build_variant',{family:'cottage',parameters:{}})).configuration,descriptor('cottage').save({}));
  for(const name of ['build_variant','export_asset'])for(const input of [{design:old,family:'bench'},{design:old,parameters:{}},{design:old,parameters:{width:7}},{design:old,appearance:old.appearance},{design:{...old,applied:{...old.applied,width:6}}},{design:{...old,familyVersion:'99.0.0'}},{design:{...old,unknown:true}},{design:{...old,migration:{fromVersion:'0.1.0',toVersion:'0.5.0',notice:'forged'}}},{}])await call(name,input,true);
  const exported=await call('export_asset',{design:old});assert.ok(basename(exported.path).startsWith('cottage-'));assert.deepEqual(exported.configuration,current);const bytes=await readFile(exported.path);assert.equal(sha256(bytes),exported.sha256);const validation=await validateBytes(bytes);assert.equal(validation.issues.numErrors,0);assert.equal(validation.issues.numWarnings,0);
  const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');const root=loaded.scene.getObjectByName('cottage')!;assert.deepEqual(root.userData.configuration,current);assert.deepEqual(root.userData.inactivePartColors,['roof-left-band-0','actually-missing']);
  const next=await call('export_asset',{family:'cottage',design:current,filename:'current-cottage.glb'});assert.deepEqual(next.configuration,current);await call('export_asset',{design:current,filename:'current-cottage.glb'},true);assert.equal(sha256(await readFile(next.path)),next.sha256);
  const defaults=await call('export_asset',{family:'cottage',filename:'default-cottage.glb'});assert.deepEqual(defaults.configuration,descriptor('cottage').save({}));
  await writeFile(join(run,'export-validation.json'),JSON.stringify({prior:exported,current:next,defaults,validation:validation.issues},null,2)+'\n');
 }finally{await client.close();await transport.close();if(pid){try{process.kill(pid,0);}catch(error){assert.equal((error as NodeJS.ErrnoException).code,'ESRCH');closed=true;}}await writeFile(join(run,'exchanges.json'),JSON.stringify(exchanges,null,2)+'\n');await writeFile(join(run,'process.json'),JSON.stringify({pid,closed,stderr},null,2)+'\n');}
 assert.equal(closed,true);await writeFile(join(evidence,'mcp-latest.json'),JSON.stringify({run,pid,closed},null,2)+'\n');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, stat, copyFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseVerifyOptions, prepareVerification } from '../scripts/recipe-verify-input.ts';
import { runCommand } from '../scripts/verification-process.ts';
import { runStages } from '../scripts/verification-run.ts';
import { verificationSnapshot } from '../scripts/recipe-verify-evidence.ts';

const args = ['--family','bench','--request','A garden bench; $(touch forbidden)','--test','tests/recipe-contract.test.ts','--out','evidence/new-attempt'];
const command = (id:string,code:string) => ({id,command:process.execPath,args:['-e',code],timeoutMs:2000});
async function fixture() {
  const root=await mkdtemp(join(tmpdir(),'recipe-verify-'));
  await mkdir(join(root,'tests')); await mkdir(join(root,'evidence'));
  await writeFile(join(root,'tests/behavior.test.ts'),'export {};');
  return root;
}

test('parser rejects missing, duplicate, unknown and malformed options', () => {
  assert.equal(parseVerifyOptions(args).request,args[3]);
  for(const invalid of [[],args.slice(0,-1),[...args,'--family','crate'],[...args,'--execute','file'],[...args,'--timeout-ms','0'],[...args,'--timeout-ms','Infinity'],args.map(x=>x==='bench'?'unknown':x),args.map(x=>x===args[3]?'   ':x)])assert.throws(()=>parseVerifyOptions(invalid));
});

test('contained test paths and symlink outputs are rejected before writes', async () => {
  const root=await fixture();
  const options={...parseVerifyOptions(args),test:'tests/behavior.test.ts',output:'evidence/new'};
  for(const testPath of ['../escape.test.ts','scripts/behavior.test.ts','tests/../behavior.test.ts'])await assert.rejects(prepareVerification({...options,test:testPath},root));
  await symlink(join(root,'tests/behavior.test.ts'),join(root,'tests/link.test.ts'));
  await assert.rejects(prepareVerification({...options,test:'tests/link.test.ts'},root),/symlink/i);
  await symlink(join(root,'tests'),join(root,'evidence/link'));
  await assert.rejects(prepareVerification({...options,output:'evidence/link/run'},root),/symlink/i);
  await assert.rejects(prepareVerification({...options,output:'../escape'},root),/output/i);
  await assert.rejects(stat(join(root,'evidence/new')),/ENOENT/);
});

test('existing output remains untouched and selected defaults are explicit', async () => {
  const root=await fixture();
  const options={...parseVerifyOptions(args),test:'tests/behavior.test.ts',output:'evidence/new'};
  const prepared=await prepareVerification(options,root);
  assert.equal(prepared.design.family,'bench');
  assert.equal(prepared.design.applied.width,1.6);
  await mkdir(prepared.output); await writeFile(join(prepared.output,'sentinel'),'original');
  await assert.rejects(prepareVerification(options,root),/exist/i);
  assert.equal(await readFile(join(prepared.output,'sentinel'),'utf8'),'original');
  await writeFile(join(root,'wrong.json'),JSON.stringify({...prepared.design,family:'crate'}));
  await assert.rejects(prepareVerification({...options,output:'evidence/other',config:'wrong.json'},root));
  await assert.rejects(stat(join(root,'evidence/other')),/ENOENT/);
});

test('failed subprocess retains stderr, first failure, skipped stages and atomic report', async () => {
  const output=await mkdtemp(join(tmpdir(),'verify-failure-'));
  const report=await runStages({output,metadata:{},stages:[command('broken','console.error("repair this input"); process.exit(7)'),command('later','throw Error("must not run")')],snapshot:async()=>({hash:'fixed'}),inspect:async()=>({}),signal:new AbortController().signal});
  assert.equal(report.status,'failed'); assert.equal(report.firstFailure?.stage,'broken');
  assert.equal(report.stages[0]!.result?.exitCode,7); assert.equal(report.stages[1]!.status,'pending');
  assert.match(await readFile(join(output,'logs/broken.stderr.log'),'utf8'),/repair this input/);
  assert.equal(JSON.parse(await readFile(join(output,'report.json'),'utf8')).status,'failed');
});

test('changed verification inputs and missing artifacts cannot pass after zero exit', async () => {
  for(const stale of [true,false]) {
    const output=await mkdtemp(join(tmpdir(),'verify-invalid-')); let reads=0;
    const report=await runStages({output,metadata:{},stages:[command('ok','')],snapshot:async()=>({hash:stale&&reads++>0?'changed':'initial'}),inspect:async()=>{throw Error('missing selected GLB');},signal:new AbortController().signal});
    assert.equal(report.status,'failed');
    assert.match(report.firstFailure!.error,stale?/changed/:/missing selected GLB/);
  }
});

test('technical success still requires visual review and independent rebuilding', async () => {
  const output=await mkdtemp(join(tmpdir(),'verify-success-'));
  const report=await runStages({output,metadata:{request:'literal request'},stages:[command('ok','console.log("ok")')],snapshot:async()=>({hash:'fixed'}),inspect:async()=>({checked:true}),signal:new AbortController().signal});
  assert.equal(report.status,'technical-success'); assert.equal(report.visualReview,'pending'); assert.equal(report.portableRebuild,'pending');
});

test('timeout and cancellation retain process outcomes without hanging', async () => {
  const output=await mkdtemp(join(tmpdir(),'verify-timeout-'));
  const timed=await runCommand({...command('timeout','setInterval(()=>{},1000)'),timeoutMs:100},process.cwd(),output,new AbortController().signal);
  assert.equal(timed.outcome,'timed-out');
  const controller=new AbortController();
  const pending=runCommand(command('cancelled','setInterval(()=>{},1000)'),process.cwd(),output,controller.signal);
  setTimeout(()=>controller.abort(),100);
  assert.equal((await pending).outcome,'cancelled');
});

test('argv stays literal and no shell expansion occurs', async () => {
  const output=await mkdtemp(join(tmpdir(),'verify-argv-'));
  const value='$(touch forbidden); spaces and "quotes"';
  const result=await runCommand({id:'literal',command:process.execPath,args:['-e','console.log(process.argv[1])',value],timeoutMs:2000},resolve('.'),output,new AbortController().signal);
  assert.equal(result.outcome,'passed');
  assert.equal((await readFile(join(output,'literal.stdout.log'),'utf8')).trim(),value);
});

test('a killed child cannot leave descendants in separate process groups alive', async () => {
  if(process.platform==='win32')return;
  const output=await mkdtemp(join(tmpdir(),'verify-descendant-'));
  const pidPath=join(output,'pid');
  const source='const {spawn}=require("node:child_process");const fs=require("node:fs");const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore",detached:true});fs.writeFileSync(process.argv[1],String(child.pid));setInterval(()=>{},1000)';
  const result=await runCommand({id:'tree',command:process.execPath,args:['-e',source,pidPath],timeoutMs:500},process.cwd(),output,new AbortController().signal);
  assert.equal(result.outcome,'timed-out');
  const pid=Number(await readFile(pidPath,'utf8'));
  let running=true;
  for(let i=0;i<20&&running;i++) {
    try {
      const state=await readFile('/proc/'+pid+'/stat','utf8');
      running=!state.includes(') Z ');
    } catch {running=false;}
    if(running)await new Promise(resolve=>setTimeout(resolve,25));
  }
  assert.equal(running,false,'Owned descendant survived timeout');
});

test('pre-cancelled verification cannot pass even without starting a subprocess', async () => {
  const output=await mkdtemp(join(tmpdir(),'verify-pre-cancel-')),controller=new AbortController();
  controller.abort();
  const report=await runStages({output,metadata:{},stages:[command('never','process.exit(0)')],snapshot:async()=>({hash:'same'}),inspect:async()=>({}),signal:controller.signal});
  assert.equal(report.status,'cancelled');assert.equal(report.stages[0]!.status,'pending');
});

test('saved selection preserves changed dimensions and appearance', async () => {
  const root=await fixture();
  const {buildAsset,disposeAsset}=await import('../src/catalog/index.ts');
  const build=buildAsset('bench',{width:2.2,backrest:false,appearance:{version:1,palette:'PICO8',shading:'Toon3bands',partColors:{'seat-slat-0':'#ff004d'}}});
  try {
    await writeFile(join(root,'changed.json'),JSON.stringify(build.config));
    const prepared=await prepareVerification({...parseVerifyOptions(args),test:'tests/behavior.test.ts',output:'evidence/changed',config:'changed.json'},root);
    assert.deepEqual(prepared.design,build.config);
    assert.match(prepared.inputFileSha256!,/^[a-f0-9]{64}$/);
  } finally {disposeAsset(build);}
});

test('package source comparison excludes generated package metadata but rejects changed source', async () => {
  const {checkPackagedSources}=await import('../scripts/recipe-verify-evidence.ts');
  const {sha256}=await import('../scripts/provenance.ts');
  const source='export const value=1;',sources={'src/catalog/index.ts':sha256(source),'package.json':sha256('repository package')};
  assert.doesNotThrow(()=>checkPackagedSources({'src/catalog/index.ts':source,'package.json':'portable package'},sources));
  assert.throws(()=>checkPackagedSources({'src/catalog/index.ts':'changed source'},sources),/source mismatch/);
  assert.throws(()=>checkPackagedSources({'examples/recipes/unknown/index.ts':source},sources),/source mismatch/);
});

const unityVerificationInputs = [
  'integrations/unity/ImportFixture/Assets/Editor/FixtureRun.cs',
  'integrations/unity/run-editor.sh',
];
const catalogVerificationInputs = [
  'evidence/revision7/catalog/seven-family-baseline.json',
  'evidence/revision7/catalog/reviewed-defaults.json',
  'evidence/revision7/catalog/scene-inputs.json',
];

async function snapshotFixture() {
  const root=await fixture();
  const paths=['docs/contributing/source-packages.json','docs/licensing-dependencies.json','LICENSE','NOTICE','LICENSES/Apache-2.0.txt','LICENSES/CC0-1.0.txt','evidence/revision5/recipes/legacy-baseline.json',...catalogVerificationInputs,...unityVerificationInputs];
  for(const path of paths) {
    await mkdir(dirname(join(root,path)),{recursive:true});
    await copyFile(path,join(root,path));
  }
  const prepared=await prepareVerification({...parseVerifyOptions(args),test:'tests/behavior.test.ts',output:'evidence/run'},root);
  await mkdir(prepared.output);
  await writeFile(join(prepared.output,'selected.design.json'),JSON.stringify(prepared.design));
  return prepared;
}

test('unchanged Unity verification inputs retain a current successful snapshot', async () => {
  const prepared=await snapshotFixture();
  try {
    const before=await verificationSnapshot(prepared);
    assert.deepEqual(await verificationSnapshot(prepared),before);
    const report=await runStages({output:prepared.output,metadata:{},stages:[command('ok','')],snapshot:()=>verificationSnapshot(prepared),inspect:async()=>({checked:true}),signal:new AbortController().signal});
    assert.equal(report.status,'technical-success');
    assert.deepEqual(report.before,report.after);
  } finally {await rm(prepared.root,{recursive:true});}
});

test('catalog fixture changes affect the existing verification hash',async()=>{
  const prepared=await snapshotFixture();
  try {
    const before=await verificationSnapshot(prepared);
    for(const path of catalogVerificationInputs) {
      assert.equal(typeof before.verificationInputs[path],'string',path);
      const original=await readFile(join(prepared.root,path),'utf8');
      await writeFile(join(prepared.root,path),original+'\n');
      const changed=await verificationSnapshot(prepared);
      assert.notEqual(changed.verificationHash,before.verificationHash,path);
      assert.notEqual(changed.verificationInputs[path],before.verificationInputs[path],path);
      await writeFile(join(prepared.root,path),original);
    }
    assert.deepEqual(await verificationSnapshot(prepared),before);
  } finally {await rm(prepared.root,{recursive:true});}
});

for(const path of unityVerificationInputs) {
  for(const change of ['mutation','omission'] as const) {
    test('Unity verification input '+change+' invalidates a successful stage: '+path, async () => {
      const prepared=await snapshotFixture();
      try {
        const before=await verificationSnapshot(prepared);
        const code=change==='mutation'?'require("node:fs").appendFileSync(process.argv[1],"changed verification input")':'require("node:fs").unlinkSync(process.argv[1])';
        const stage={...command('change-input',code),args:['-e',code,join(prepared.root,path)]};
        const report=await runStages({output:prepared.output,metadata:{},stages:[stage,command('later','')],snapshot:()=>verificationSnapshot(prepared),inspect:async()=>({checked:true}),signal:new AbortController().signal});
        assert.equal(report.stages[0]!.result?.exitCode,0);
        assert.equal(report.status,'failed');
        assert.equal(report.firstFailure?.stage,'change-input');
        assert.equal(report.stages[1]!.status,'pending');
        if(change==='mutation') {
          assert.match(report.firstFailure!.error,/verification inputs changed/);
          const after=await verificationSnapshot(prepared);
          assert.notEqual(after.verificationHash,before.verificationHash);
          assert.notEqual(after.verificationInputs[path],before.verificationInputs[path]);
        } else {
          assert.ok(report.firstFailure!.error.includes(path));
          await assert.rejects(verificationSnapshot(prepared),{code:'ENOENT'});
        }
        assert.equal(JSON.parse(await readFile(join(prepared.output,'report.json'),'utf8')).status,'failed');
      } finally {await rm(prepared.root,{recursive:true});}
    });
  }
  test('omitted Unity verification input prevents the initial snapshot: '+path, async () => {
    const prepared=await snapshotFixture();
    try {
      await unlink(join(prepared.root,path));
      const report=await runStages({output:prepared.output,metadata:{},stages:[command('never','')],snapshot:()=>verificationSnapshot(prepared),inspect:async()=>({checked:true}),signal:new AbortController().signal});
      assert.equal(report.status,'failed');
      assert.equal(report.firstFailure?.stage,'inputs');
      assert.ok(report.firstFailure!.error.includes(path));
      assert.equal(report.stages[0]!.status,'pending');
      await assert.rejects(verificationSnapshot(prepared),{code:'ENOENT'});
    } finally {await rm(prepared.root,{recursive:true});}
  });
}

test('verification selection preserves the validated migration notice and fresh defaults remain notice-free',async()=>{
 const root=await fixture(),saved=JSON.parse(await readFile('tests/fixtures/cottage-colored-prior.design.json','utf8'));
 await writeFile(join(root,'legacy.json'),JSON.stringify(saved));
 const selected=await prepareVerification({...parseVerifyOptions(args),family:'cottage',test:'tests/behavior.test.ts',output:'evidence/migrated',config:'legacy.json'},root);
 assert.ok(selected.design.migration);assert.equal(selected.design.migration.toVersion,selected.design.familyVersion);
 const fresh=await prepareVerification({...parseVerifyOptions(args),family:'cottage',test:'tests/behavior.test.ts',output:'evidence/fresh'},root);assert.equal(fresh.design.migration,undefined);
});

test('verification package selection follows actual delivery index and rejects ambiguous identity',async()=>{
 const {selectedSourcePackage}=await import('../scripts/recipe-verify-package.ts');
 const entry={id:'bench',version:'1.1.0',deliveryRevision:2,url:'recipe-packages/bench-1.1.0-source.2.zip',sha256:'a'.repeat(64),bytes:100};
 assert.equal(selectedSourcePackage({formatVersion:2,packages:[entry]},'bench','1.1.0').filename,'bench-1.1.0-source.2.zip');
 const legacy={...entry,deliveryRevision:undefined,url:'recipe-packages/bench-1.1.0.zip'};assert.equal(selectedSourcePackage({formatVersion:1,packages:[legacy]},'bench','1.1.0').deliveryRevision,1);
 for(const index of [{formatVersion:2,packages:[]},{formatVersion:2,packages:[entry,entry]},{formatVersion:2,packages:[legacy]},{formatVersion:2,packages:[{...entry,url:'recipe-packages/bench-1.1.0.zip'}]},{formatVersion:2,packages:[{...entry,bytes:-1}]}])assert.throws(()=>selectedSourcePackage(index,'bench','1.1.0'));
});

import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { catalog, buildAsset, disposeAsset } from '../src/catalog/index.ts';
import { exportDeliverable } from '../src/catalog/delivery.ts';
import { sha256 } from '../scripts/provenance.ts';

function bridge(input:string,limit=30000):Promise<{code:number|null;stdout:string;stderr:string}> {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx','scripts/unity-bridge.ts'],{stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Bridge test timeout'));},limit);
    child.stdout.on('data',chunk=>{stdout+=String(chunk);});
    child.stderr.on('data',chunk=>{stderr+=String(chunk);});
    child.on('error',reject);
    child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});
    child.stdin.on('error',error=>{if((error as NodeJS.ErrnoException).code!=='EPIPE')reject(error);});
    child.stdin.end(input);
  });
}

test('Unity bridge discovers the canonical fourteen recipes and every typed control',async()=>{
  const result=await bridge(JSON.stringify({protocolVersion:1,operation:'catalog'}));
  assert.equal(result.code,0,result.stderr);
  const response=JSON.parse(result.stdout);
  assert.equal(response.protocolVersion,1);
  assert.deepEqual(response.recipes.map((d:{id:string})=>d.id),catalog.map(d=>d.id));
  for(const [index,d] of catalog.entries()) {
    assert.deepEqual(response.recipes[index].controls,d.controls);
    assert.deepEqual(response.recipes[index].presets,d.presets);
  }
  assert.match(response.sourceHash,/^[a-f0-9]{64}$/);
});

test('Unity bridge exports all fourteen canonical defaults and changed geometry/materials',{timeout:180000},async()=>{
  for(const d of catalog) {
    const parameters=d.id==='treasure-chest'?{lidAngle:110,'color.wood':'#735039'}:{};
    const result=await bridge(JSON.stringify({protocolVersion:1,operation:'build',family:d.id,parameters}));
    assert.equal(result.code,0,result.stderr);
    const response=JSON.parse(result.stdout),build=buildAsset(d.id,parameters);
    try {
      const expected=await exportDeliverable(build),actual=Buffer.from(response.glbBase64,'base64');
      assert.deepEqual(actual,Buffer.from(expected));
      assert.deepEqual(response.design,build.config);
      assert.equal(response.glbSha256,sha256(expected));
      assert.equal(response.geometry.errors.length,0);
    } finally {disposeAsset(build);}
  }
});

test('preset overrides and saved appearance designs replay through the canonical exporter',async()=>{
  const d=catalog.find(d=>d.id==='crate')!,preset=d.presets[1]!;
  const result=await bridge(JSON.stringify({protocolVersion:1,operation:'build',family:d.id,preset:preset.id,parameters:{'color.wood':'#946f41'}}));
  assert.equal(result.code,0,result.stderr);
  const design=JSON.parse(result.stdout).design;
  design.appearance={version:1,palette:'Reduced4',shading:'Toon3bands',partColors:{}};
  const replay=await bridge(JSON.stringify({protocolVersion:1,operation:'build',design}));
  assert.equal(replay.code,0,replay.stderr);
  const build=buildAsset(d.id,{...design.requested,appearance:design.appearance});
  try {assert.equal(JSON.parse(replay.stdout).glbBase64,Buffer.from(await exportDeliverable(build)).toString('base64'));}
  finally {disposeAsset(build);}
});

test('malformed oversized unknown and invalid requests fail without a partial asset',async()=>{
  const invalid=[
    '{', 'x'.repeat(1024*1024+1),
    {protocolVersion:2,operation:'catalog'},
    {protocolVersion:1,operation:'catalog',command:'touch unwanted'},
    {protocolVersion:1,operation:'build',family:'absent'},
    {protocolVersion:1,operation:'build',family:'conifer',parameters:{tierCount:11}},
    {protocolVersion:1,operation:'build',family:'crate',parameters:{'color.wood':'red'}},
    {protocolVersion:1,operation:'build',family:'crate',preset:'absent'},
    {protocolVersion:1,operation:'build',family:'crate',design:{family:'crate'}},
  ];
  for(const input of invalid) {
    const result=await bridge(typeof input==='string'?input:JSON.stringify(input));
    assert.equal(result.code,1,result.stdout+result.stderr);
    assert.equal(result.stdout,'');
    assert.match(result.stderr,/^Unity bridge:/);
  }
});

test('saved old and validated cottage designs preserve canonical migration appearance geometry and GLB metadata',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {loadDesign}=await import('../src/catalog/index.ts');
  const {designInput}=await import('../src/catalog/appearance.ts');
  const {inspectGeometry}=await import('../src/lantern/inspect.ts');
  const old=JSON.parse(await readFile('tests/fixtures/cottage-colored-prior.design.json','utf8')),canonical=loadDesign(old);
  assert.ok(canonical.migration);
  const build=buildAsset(canonical.family,designInput(canonical));build.config.migration=canonical.migration;
  try{
    const expected=await exportDeliverable(build);
    for(const design of [old,canonical]){
      const result=await bridge(JSON.stringify({protocolVersion:1,operation:'build',design}));assert.equal(result.code,0,result.stderr);
      const response=JSON.parse(result.stdout),bytes=Buffer.from(response.glbBase64,'base64');
      assert.deepEqual(response.design,canonical);assert.deepEqual(response.design.appearance,canonical.appearance);assert.deepEqual(response.geometry,inspectGeometry(build.root));assert.equal(response.glbSha256,sha256(expected));assert.deepEqual(bytes,Buffer.from(expected));
      assert.equal(bytes.readUInt32LE(0),0x46546c67);const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8')),root=gltf.nodes.find((node:{name:string})=>node.name===canonical.family);
      assert.deepEqual(root.extras.configuration,canonical);
    }
  }finally{disposeAsset(build);}
});

test('fresh Unity bridge builds remain notice-free and forged saved notices fail without an asset',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {loadDesign,descriptor}=await import('../src/catalog/index.ts');
  const old=JSON.parse(await readFile('tests/fixtures/cottage-colored-prior.design.json','utf8')),canonical=loadDesign(old);
  for(const request of [{family:'cottage'},{design:descriptor('cottage').save({})}]){
    const result=await bridge(JSON.stringify({protocolVersion:1,operation:'build',...request}));assert.equal(result.code,0,result.stderr);const response=JSON.parse(result.stdout);assert.equal(response.design.migration,undefined);
    const bytes=Buffer.from(response.glbBase64,'base64'),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));assert.equal(gltf.nodes.find((node:{name:string})=>node.name==='cottage').extras.configuration.migration,undefined);
  }
  const result=await bridge(JSON.stringify({protocolVersion:1,operation:'build',design:{...canonical,migration:{...canonical.migration,notice:'forged'}}}));assert.equal(result.code,1);assert.equal(result.stdout,'');assert.match(result.stderr,/Unity bridge:/);
});

test('resolve validates saved designs without geometry and edited saved builds retain canonical identity',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {loadDesign}=await import('../src/catalog/index.ts');
  const {designInput}=await import('../src/catalog/appearance.ts');
  const old=JSON.parse(await readFile('tests/fixtures/cottage-colored-prior.design.json','utf8')),canonical=loadDesign(old);
  const resolved=await bridge(JSON.stringify({protocolVersion:1,operation:'resolve',design:old}));assert.equal(resolved.code,0,resolved.stderr);
  const response=JSON.parse(resolved.stdout);assert.deepEqual(Object.keys(response).sort(),['design','protocolVersion','sourceHash']);assert.deepEqual(response.design,canonical);assert.match(response.sourceHash,/^[a-f0-9]{64}$/);
  const edits={width:6.6,'color.plaster':'#d4c3aa'},expected=buildAsset('cottage',{...designInput(canonical),...edits});expected.config.migration=canonical.migration;
  try{
    const request=await bridge(JSON.stringify({protocolVersion:1,operation:'build',design:old,edits}));assert.equal(request.code,0,request.stderr);const built=JSON.parse(request.stdout),bytes=Buffer.from(built.glbBase64,'base64');assert.deepEqual(built.design,expected.config);assert.deepEqual(built.design.appearance,canonical.appearance);assert.deepEqual(built.design.migration,canonical.migration);assert.deepEqual(bytes,Buffer.from(await exportDeliverable(expected)));
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));assert.deepEqual(gltf.nodes.find((node:{name:string})=>node.name==='cottage').extras.configuration,expected.config);
    const current=await bridge(JSON.stringify({protocolVersion:1,operation:'build',design:canonical,edits}));assert.equal(current.code,0,current.stderr);assert.equal(JSON.parse(current.stdout).glbBase64,built.glbBase64);
  }finally{disposeAsset(expected);}
});

test('saved edits and resolve remain strict and cannot override identity appearance or validated history',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {loadDesign}=await import('../src/catalog/index.ts');
  const old=JSON.parse(await readFile('tests/fixtures/cottage-colored-prior.design.json','utf8')),canonical=loadDesign(old);
  const invalid=[
    {operation:'resolve'},
    {operation:'resolve',design:old,parameters:{}},
    {operation:'resolve',design:{...canonical,migration:{...canonical.migration,notice:'forged'}}},
    {operation:'build',family:'cottage',edits:{width:6.6}},
    {operation:'build',design:old,parameters:{width:6.6}},
    ...['appearance','familyVersion','migration','retiredControl','__proto__','constructor','prototype'].map(key=>({operation:'build',design:old,edits:JSON.parse('{"'+key+'":1}')})),
    {operation:'build',design:{...canonical,migration:{...canonical.migration,notice:'forged'}},edits:{width:6.6}},
    {operation:'build',design:old,edits:{width:'6.6'}},
    {operation:'build',design:old,edits:{width:999}},
  ];
  for(const request of invalid){const result=await bridge(JSON.stringify({protocolVersion:1,...request}));assert.equal(result.code,1,JSON.stringify(request)+result.stderr);assert.equal(result.stdout,'');assert.match(result.stderr,/Unity bridge:/);}
  const unchanged=await bridge(JSON.stringify({protocolVersion:1,operation:'build',design:old,edits:{}}));assert.equal(unchanged.code,0,unchanged.stderr);assert.deepEqual(JSON.parse(unchanged.stdout).design,canonical);
});

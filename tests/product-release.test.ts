import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,chmod,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {zipFiles} from '../src/catalog/export.ts';
import {prepareRelease,verifyRelease,scanReleaseFile,validateReleasePaths} from '../scripts/product-release.mjs';

test('release copies only explicit product files into independent empty Git and verifies exact bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'product-release-'));await mkdir(join(root,'src'));await mkdir(join(root,'.git'));await writeFile(join(root,'.git','private-parent'),'parent history');await writeFile(join(root,'src','index.ts'),'export const product=1;\n');await chmod(join(root,'src','index.ts'),0o755);await writeFile(join(root,'LICENSE'),'License text\n');await writeFile(join(root,'private.txt'),'Unlisted private context');const out=join(root,'.release','polyspoon'),result=await prepareRelease({root,out,paths:['LICENSE','src/index.ts']});
 assert.equal(await readFile(join(out,'src/index.ts'),'utf8'),'export const product=1;\n');assert.ok((await stat(join(out,'src/index.ts'))).mode&0o111);assert.deepEqual(Object.keys(result.files),['LICENSE','src/index.ts']);assert.equal(execFileSync('git',['rev-parse','--show-toplevel'],{cwd:out,encoding:'utf8'}).trim(),out);assert.equal(execFileSync('git',['remote'],{cwd:out,encoding:'utf8'}),'');assert.equal(execFileSync('git',['rev-list','--all','--count'],{cwd:out,encoding:'utf8'}).trim(),'0');assert.equal((await verifyRelease(out)).valid,true);await assert.rejects(()=>prepareRelease({root,out,paths:['LICENSE']}),/exist/i);await writeFile(join(out,'src','index.ts'),'changed');await assert.rejects(()=>verifyRelease(out),/mismatch/i);
});

test('release rejects private paths, symlinks, escaping destinations and credentials before export',async()=>{
 for(const path of ['../outside','.git/config','.env','PLAN.md','docs/references/vendor.txt','hosted/.local/auth.json'])assert.throws(()=>validateReleasePaths([path]),/forbidden|invalid/i);
 const root=await mkdtemp(join(tmpdir(),'product-release-'));await writeFile(join(root,'file.txt'),'content');await symlink(join(root,'file.txt'),join(root,'link.txt'));await assert.rejects(()=>prepareRelease({root,out:join(root,'.release','linked'),paths:['link.txt']}),/symlink/i);await assert.rejects(()=>prepareRelease({root,out:join(root,'outside'),paths:['file.txt']}),/release/i);
 const token='ghp_'+'x'.repeat(36);await writeFile(join(root,'credential.txt'),token);await assert.rejects(()=>prepareRelease({root,out:join(root,'.release','secret'),paths:['credential.txt']}),/scan/i);
});

test('release privacy scan includes nested archive contents without printing matched credentials',()=>{
 const token='ghp_'+'x'.repeat(36),nested=zipFiles({'credential.txt':new TextEncoder().encode(token)}),archive=zipFiles({'toolkit.zip':nested}),findings=scanReleaseFile('bundle.zip',archive);assert.ok(findings.some((finding:{path:string;rule:string})=>finding.path==='bundle.zip!toolkit.zip!credential.txt'&&finding.rule==='credential'));assert.ok(!JSON.stringify(findings).includes(token));assert.deepEqual(scanReleaseFile('source.ts',new TextEncoder().encode('export const value=1;')),[]);
 assert.ok(scanReleaseFile('fixture.json.gz',gzipSync(token)).some(finding=>finding.rule==='credential'));
});

test('release detects current provider credentials while retaining benign product text',()=>{
 for(const prefix of ['cfat_','sb_secret_','re_']){
  const token=prefix+'a7'.repeat(24),findings=scanReleaseFile('config.json',Buffer.from(JSON.stringify({token})));
  assert.deepEqual(findings,[{path:'config.json',rule:'credential'}]);assert.ok(!JSON.stringify(findings).includes(token));
 }
 for(const value of ['cfat_example','sb_secret_placeholder','re_export','re_123','public model metadata'])assert.deepEqual(scanReleaseFile('source.ts',Buffer.from(value)),[]);
});

test('release inspects parsed GLB JSON metadata and rejects malformed containers',()=>{
 const glb=(value:unknown)=>{const json=Buffer.from(JSON.stringify(value).replaceAll('/',String.fromCharCode(92)+'u002f')),padding=(4-json.length%4)%4,bytes=Buffer.alloc(20+json.length+padding,32);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length+padding,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);return bytes;};
 const secret='sb_secret_'+'a7'.repeat(24);assert.deepEqual(scanReleaseFile('model.glb',glb({asset:{version:'2.0'},extras:{token:secret}})),[{path:'model.glb!json',rule:'credential'}]);
 const privatePath=['','home','lied','private'].join('/'),escaped=glb({extras:{notice:privatePath}});
 assert.ok(scanReleaseFile('model.glb',escaped).some(finding=>finding.rule==='private-path'));
 assert.deepEqual(scanReleaseFile('model.glb',glb({asset:{version:'2.0'},extras:{license:'MIT',notice:'Original model'}})),[]);
 const bad=glb({asset:{version:'2.0'}});bad.writeUInt32LE(bad.length+4,8);assert.throws(()=>scanReleaseFile('model.glb',bad),/GLB/i);assert.throws(()=>scanReleaseFile('model.glb',Buffer.from('invalid')),/GLB/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcePackageFor } from '../src/site/source-download.ts';

const entry={id:'bench',version:'1.0.0',url:'recipe-packages/bench-1.0.0.zip',sha256:'a'.repeat(64),bytes:1234,configuration:{path:'config.json',kind:'default'}};
const index=(value:unknown=entry)=>({formatVersion:1,packages:[value]});
test('source download requires matching identity version and a default-design package',()=>{
  assert.equal(sourcePackageFor(index(),'bench','1.0.0')?.url,entry.url);
  assert.equal(sourcePackageFor(index(),'bench','2.0.0'),undefined);
  assert.equal(sourcePackageFor(index(),'crate','1.0.0'),undefined);
  assert.equal(sourcePackageFor({...index(),formatVersion:2},'bench','1.0.0'),undefined);
  assert.equal(sourcePackageFor({formatVersion:1,packages:[entry,entry]},'bench','1.0.0'),undefined);
  for(const field of [{bytes:-1},{sha256:'bad'},{configuration:{kind:'current',path:'config.json'}}])assert.equal(sourcePackageFor(index({...entry,...field}),'bench','1.0.0'),undefined);
});
test('source download rejects external paths and encoded traversal',()=>{
  for(const url of ['https://evil.example/code.zip','//evil.example/code.zip','/recipe-packages/bench.zip','../bench.zip','recipe-packages/../bench.zip','recipe-packages/%2e%2e/bench.zip','recipe-packages/bench.zip?next=evil','recipe-packages/bench.zip#x','recipe-packages/bench\\file.zip','recipe-packages/other-1.0.0.zip'])assert.equal(sourcePackageFor(index({...entry,url}),'bench','1.0.0'),undefined,url);
  for(const value of [null,[],{},'text',{formatVersion:1,packages:null}])assert.equal(sourcePackageFor(value,'bench','1.0.0'),undefined);
});

test('verified source bytes require size digest and ZIP content',async()=>{
 const module=await import('../src/site/source-download.ts');assert.ok('verifiedSource' in module);const verify=Reflect.get(module,'verifiedSource') as (bytes:Uint8Array,p:typeof entry)=>Promise<Uint8Array>;const {zipFiles}=await import('../src/catalog/export.ts'),{createHash}=await import('node:crypto'),bytes=zipFiles({'config.json':new TextEncoder().encode('{}')}),expected={...entry,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};assert.deepEqual(await verify(bytes,expected),bytes);await assert.rejects(verify(bytes.subarray(1),expected));const altered=bytes.slice();altered[20]=altered[20]!^1;await assert.rejects(verify(altered,expected));const html=new TextEncoder().encode('<html>fallback</html>');await assert.rejects(verify(html,{...expected,bytes:html.length,sha256:createHash('sha256').update(html).digest('hex')}));
});

test('source metadata keeps older indexes compatible without inventing license claims',()=>{
  assert.equal(sourcePackageFor(index(),'bench','1.0.0')?.licenses,undefined);
  const licenses={software:'Apache-2.0',content:'CC0-1.0',contentPaths:['config.json'],thirdParty:'dependency-licenses.json'};
  assert.deepEqual(sourcePackageFor(index({...entry,licenses}),'bench','1.0.0')?.licenses,licenses);
});

test('source delivery selects only supported versioned identities and exact filenames',()=>{
  const current={...entry,deliveryRevision:2,url:'recipe-packages/bench-1.0.0-source.2.zip'};
  assert.equal(sourcePackageFor({formatVersion:2,packages:[current]},'bench','1.0.0')?.url,current.url);
  assert.equal(sourcePackageFor(index(),'bench','1.0.0')?.url,entry.url);
  for(const manifest of [{formatVersion:2,packages:[entry]},{formatVersion:1,packages:[current]},{formatVersion:2,packages:[{...current,deliveryRevision:0}]},{formatVersion:2,packages:[{...current,deliveryRevision:1}]},{formatVersion:2,packages:[{...current,deliveryRevision:3}]},{formatVersion:2,packages:[{...current,deliveryRevision:2.5}]},{formatVersion:2,packages:[{...current,url:entry.url}]},{formatVersion:2,packages:[current,current]}])assert.equal(sourcePackageFor(manifest,'bench','1.0.0'),undefined);
});

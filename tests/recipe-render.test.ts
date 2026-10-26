import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {runInNewContext} from 'node:vm';
import { parseRenderOptions, renderRecipe } from '../scripts/recipe-render.ts';

test('generic render command validates family preset and mutually exclusive saved inputs', () => {
  assert.equal(parseRenderOptions(['--family','bench','--out','evidence/bench']).family,'bench');
  assert.equal(parseRenderOptions(['--family','bench','--out','evidence/bench','--preset','park']).preset,'park');
  for(const args of [
    [],['--family','unknown','--out','any'],['--family','bench','--out','any','--preset','missing'],
    ['--family','bench','--out','any','--preset','park','--config','saved.json'],
    ['--family','bench','--out','any','--family','crate'],['--family','bench','--out'],
    ['--family','bench','--out','any','--unsafe','true'],
  ])assert.throws(()=>parseRenderOptions(args));
});

test('render command refuses an existing output directory before launching browser or altering files', async () => {
  const root=await mkdtemp(join(tmpdir(),'recipe-render-')),sentinel=join(root,'sentinel');
  await writeFile(sentinel,'original');
  try {
    await assert.rejects(renderRecipe({family:'bench',output:root}),/EEXIST/);
    assert.equal(await readFile(sentinel,'utf8'),'original');
  } finally {await unlink(sentinel);await rmdir(root);}
});

test('capture input clears prior appearance while preserving the exact selected design', async () => {
  const {applyRenderInput}=await import('../scripts/recipe-render.ts');
  const {DesignSession}=await import('../src/catalog/session.ts');
  const {buildAsset,disposeAsset}=await import('../src/catalog/index.ts');
  const session=new DesignSession();
  const input={width:2.2,backrest:false,appearance:{version:1,palette:'PICO8',shading:'Toon3bands',partColors:{'seat-slat-0':'#ff004d'}}};
  const selected=buildAsset('bench',input),preset=buildAsset('bench',{});
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  try {
    disposeAsset(session.select('bench'));
    Object.defineProperty(globalThis,'window',{configurable:true,value:{workshopDiagnostics:{apply:(value:unknown)=>{disposeAsset(session.apply(value));return true;}}}});
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:(id:string)=>id==='reset'?{click:()=>disposeAsset(session.reset())}:null}});
    applyRenderInput(input);
    assert.deepEqual(session.config,selected.config);
    applyRenderInput({});
    assert.deepEqual(session.config,preset.config);
    assert.equal(session.config.appearance,undefined);
    applyRenderInput(input);
    assert.deepEqual(session.config,selected.config);
  } finally {
    session.dispose();disposeAsset(selected);disposeAsset(preset);
    if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
    if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');
  }
});

test('render selection binds validated migration without contaminating fresh preset configuration',async()=>{
 const {prepareRenderDesign}=await import('../scripts/recipe-render.ts');
 const {resolveExport,descriptor}=await import('../src/catalog/index.ts');
 const saved=JSON.parse(await readFile('tests/fixtures/cottage-colored-prior.design.json','utf8')),selected=resolveExport({family:'cottage'},saved);
 const design=prepareRenderDesign('cottage',selected.input,selected.migration);assert.deepEqual(design.migration,selected.migration);
 assert.equal(prepareRenderDesign('cottage',descriptor('cottage').presets[0]!.parameters).migration,undefined);
 assert.throws(()=>prepareRenderDesign('cottage',selected.input,{fromVersion:'9.0.0',toVersion:'0.6.0',notice:'forged'}));
});

test('render readiness accepts observed migration appearance key ordering and preserves every JSON value',async()=>{
 const {renderConfigurationReadySource,prepareRenderDesign}=await import('../scripts/recipe-render.ts');
 const {DesignSession}=await import('../src/catalog/session.ts');
 const {resolveExport,disposeAsset}=await import('../src/catalog/index.ts');
 const saved=JSON.parse(await readFile('tests/fixtures/cottage-colored-prior.design.json','utf8')),selected=resolveExport({family:'cottage'},saved),expected=prepareRenderDesign('cottage',selected.input,selected.migration),session=new DesignSession();
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 try{
  disposeAsset(session.select('cottage'));disposeAsset(session.load(expected));let actual:unknown=structuredClone(session.config);
  assert.notEqual(JSON.stringify(actual),JSON.stringify(expected));assert.deepEqual(actual,expected);
  Object.defineProperty(globalThis,'window',{configurable:true,value:{workshopDiagnostics:{configuration:()=>actual}}});
  const ready=(configuration:typeof expected)=>runInNewContext('('+renderConfigurationReadySource+')(expected)',{expected:configuration,window:{workshopDiagnostics:{configuration:()=>actual}}});
  assert.equal(ready(expected),true);
  actual={...expected,migration:{...expected.migration,notice:'changed'}};assert.equal(ready(expected),false);
  actual={...expected,requested:{...expected.requested,width:String(expected.requested.width)}};assert.equal(ready(expected),false);
  actual={...expected,appearance:undefined};assert.equal(ready(expected),false);
  actual={...expected,extraMetadata:true};assert.equal(ready(expected),false);
  const sequenced={...expected,sequence:[1,2]};actual={...expected,sequence:[2,1]};assert.equal(ready(sequenced),false);
 }finally{session.dispose();if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');}
});

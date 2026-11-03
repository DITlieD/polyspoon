import {buildPriorAsset,loadPriorDesign} from './historical-public.ts';
import { exportLegacyPayload,baselineBuilds,compareBaselineBuild } from './semantic-legacy-payload.ts';
import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Mesh, Vector3 } from 'three';
import { validateBytes } from 'gltf-validator';
import { catalog, buildAsset, disposeAsset, loadDesign, validationCases, descriptor } from '../src/catalog/index.ts';
import { exportAsset } from '../src/catalog/export.ts';
import { measurements } from '../src/catalog/measure.ts';
import { geometrySnapshot, inspectGeometry } from '../src/lantern/inspect.ts';
import { recipe } from '../src/recipes/index.ts';
import { sha256 } from '../scripts/provenance.ts';

const promoted = ['planter','treasure-chest','wheelbarrow','stone-well','conifer'];
const original = ['work-lantern','cottage','tree','fence','crate','boulder','bench'];
const geometryHash = (b: ReturnType<typeof buildAsset>) => sha256(JSON.stringify(geometrySnapshot(b.root)));
const count = (b: ReturnType<typeof buildAsset>, prefix: string) => measurements(b).parts.filter(p=>p.name.startsWith(prefix)).length;
function partBounds(b: ReturnType<typeof buildAsset>, name: string) {
  const part = b.root.getObjectByName(name);
  assert.ok(part,name);
  return new Box3().setFromObject(part,true);
}

test('catalog retains twelve construction families and adds the two reviewed rigs',()=>{
  assert.equal(original.length+promoted.length,12);
  assert.deepEqual(catalog.map(d=>d.id).sort(),[...original,...promoted,'stylized-humanoid','stylized-fox'].sort());
  for (const id of promoted) {
    const r = recipe(id), d = r.descriptor;
    assert.ok(d.presets.length>=3,id);
    assert.equal(r.source.entry,'examples/recipes/'+id+'/index.ts');
    assert.ok(d.controls.some(c=>c.group==='construction'&&c.affects.some(a=>a==='geometry'||a==='topology')),id);
    assert.deepEqual(Object.keys(r.presentation.thumbnails??{}).sort(),d.presets.map(p=>p.id).sort());
    assert.ok(r.constraints.length);
  }
});

test('seven existing families retain configurations measurements exports and saved design loading',async()=>{
  const records=JSON.parse(await readFile(new URL('../evidence/revision7/catalog/seven-family-baseline.json',import.meta.url),'utf8'));
  assert.deepEqual([...new Set(records.map((r:any)=>r.family))].sort(),original.toSorted());
  for (const r of records) {
    const b=await buildPriorAsset(r.family,r.parameters);
    try {
      assert.deepEqual(b.config,r.config,r.family+':'+r.id);
      assert.deepEqual(await loadPriorDesign(r.config),r.config);assert.deepEqual(loadDesign(r.config).applied,r.config.applied);
      assert.equal(sha256(JSON.stringify(measurements(b))),r.measurementHash,r.family+':'+r.id);
      assert.equal(sha256(await exportLegacyPayload(b)),r.glbHash,r.family+':'+r.id);
    } finally { disposeAsset(b); }
  }
});

test('promoted defaults preserve the reviewed construction geometry',async()=>{
  const records=JSON.parse(await readFile(new URL('../evidence/revision7/catalog/reviewed-defaults.json',import.meta.url),'utf8'));
  for (const r of records) {
    const b=await buildPriorAsset(r.id);
    try {const baseline=baselineBuilds.find((c:any)=>c.family===r.id&&c.id==='default');if(baseline){assert.equal(sha256(JSON.stringify(baseline.parts)),r.geometryHash,r.id+' original baseline');compareBaselineBuild(b,baseline);}else assert.equal(geometryHash(b),r.geometryHash,r.id);assert.deepEqual(b.dimensions.toArray(),r.dimensions);} finally {disposeAsset(b);}
  }
});

for (const id of promoted) test(id+' supported cases build finite grounded geometry and round-trip exports',async()=>{
  for (const c of [{id:'default',parameters:{}},...validationCases(id)]) {
    const b=buildAsset(id,c.parameters);
    try {
      assert.deepEqual(inspectGeometry(b.root).errors,[],id+':'+c.id);
      assert.ok(Math.abs(b.bounds.min.y)<0.0001,id+':'+c.id+' ground');
      assert.deepEqual(loadDesign(JSON.parse(JSON.stringify(b.config))),b.config);
      assert.throws(()=>loadDesign({...b.config,applied:{}}));
      assert.throws(()=>loadDesign({...b.config,familyVersion:'999.0.0'}));
      const bytes=await exportAsset(b);
      assert.equal(new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true),0x46546c67);
      const validation=await validateBytes(bytes,{maxIssues:100});
      assert.equal(validation.issues.numErrors,0,id+':'+c.id);
      assert.equal(validation.issues.numWarnings,0,id+':'+c.id);
      assert.ok(measurements(b).triangles<12000,id+':'+c.id);
    } finally { disposeAsset(b); }
  }
  for (const invalid of [{unknown:1},{[descriptor(id).controls[0]!.key]:NaN}]) assert.throws(()=>buildAsset(id,invalid));
  const role=descriptor(id).controls.find(c=>c.kind==='color')!;
  const a=buildAsset(id),b=buildAsset(id,{[role.key]:'#123456'});
  try {assert.equal(geometryHash(a),geometryHash(b));assert.notDeepEqual(measurements(a).materials,measurements(b).materials);} finally {[a,b].forEach(disposeAsset);}
});

test('historical shared scene retains its twelve families with an open approach and supported lantern',async()=>{
  const packet=JSON.parse(await readFile(new URL('../evidence/revision7/catalog/scene-inputs.json',import.meta.url),'utf8'));
  const entries=packet.captures.find((c:{id:string})=>c.id==='workshop-garden-oblique').entries;
  assert.deepEqual(entries.map((e:{family:string})=>e.family).sort(),[...original,...promoted].sort());
  const builds:ReturnType<typeof buildAsset>[]=entries.map((e:{family:string;input:unknown;position:[number,number,number];rotation?:number})=>{
    const b=buildAsset(e.family,e.input);b.root.position.set(...e.position);b.root.rotation.y=e.rotation??0;b.root.updateMatrixWorld(true);return b;
  });
  try {
    const bounds=builds.map((b:ReturnType<typeof buildAsset>)=>new Box3().setFromObject(b.root,true));
    const approach=new Box3(new Vector3(...packet.approach.minimum as [number,number,number]),new Vector3(...packet.approach.maximum as [number,number,number]));
    for(let i=1;i<bounds.length;i++)assert.ok(!approach.intersectsBox(bounds[i]!),'approach blocked by '+entries[i].family);
    for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++) {
      const overlap=bounds[i]!.clone().intersect(bounds[j]!);
      if(!overlap.isEmpty())assert.ok(overlap.getSize(new Vector3()).toArray().some(n=>n<0.000001),'overlap '+entries[i].family+'/'+entries[j].family);
    }
    assert.ok(Math.abs(bounds[3]!.min.y-bounds[2]!.max.y)<0.000001);
  } finally {builds.forEach(disposeAsset);}
});

test('planter courses and feet preserve the opening and total height',()=>{
  const a=buildAsset('planter'),b=buildAsset('planter',{boardCount:5}),c=buildAsset('planter',{feet:false});
  try {
    assert.equal(count(b,'wall-')-count(a,'wall-'),8);
    assert.equal(count(c,'foot-'),0);
    assert.ok(Math.abs(a.dimensions.y-c.dimensions.y)<0.000001);
    assert.ok(partBounds(c,'floor').min.y<partBounds(a,'floor').min.y);
  } finally {[a,b,c].forEach(disposeAsset);}
});

test('chest opens the lid and bands around the rear hinge while the hollow body stays fixed',()=>{
  const a=buildAsset('treasure-chest'),b=buildAsset('treasure-chest',{lidAngle:100}),c=buildAsset('treasure-chest',{boardCount:6});
  try {
    assert.ok(partBounds(b,'lid').max.y>partBounds(a,'lid').max.y);
    for (const name of ['base','body-plank-1-0','hinge-1']) assert.deepEqual(partBounds(a,name),partBounds(b,name));
    assert.notDeepEqual(partBounds(a,'band-lid-1-0'),partBounds(b,'band-lid-1-0'));
    assert.notDeepEqual(partBounds(a,'latch'),partBounds(b,'latch'));
    assert.equal(count(c,'body-plank-')-count(a,'body-plank-'),4);
    assert.equal(count(c,'end-plank-')-count(a,'end-plank-'),4);
    assert.ok(partBounds(b,'latch').max.y>Number(b.config.applied.bodyHeight));
    assert.throws(()=>buildAsset('treasure-chest',{lidAngle:111}));
  } finally {[a,b,c].forEach(disposeAsset);}
});

test('wheelbarrow reconstruction changes courses and opens a spoked wheel with supported floor',()=>{
  const a=buildAsset('wheelbarrow'),b=buildAsset('wheelbarrow',{boardCount:5,wheelStyle:'spoked',wheelRadius:0.34,trayLength:1.3});
  try {
    assert.equal(count(b,'tray-side-')-count(a,'tray-side-'),4);
    assert.equal(count(b,'wheel-spoke-'),12);
    assert.equal(count(b,'wheel-wood-'),0);
    assert.equal(count(b,'wheel-hub'),1);
    assert.ok(partBounds(b,'tray-riser-1-1').intersectsBox(partBounds(b,'under-tray-bearer-1')));
    assert.ok(partBounds(b,'under-tray-bearer-1').intersectsBox(partBounds(b,'floor-4')));
    assert.ok(partBounds(b,'wheel-tread').min.y>=-0.0001);
    assert.throws(()=>buildAsset('wheelbarrow',{wheelStyle:'invisible'}));
  } finally {[a,b].forEach(disposeAsset);}
});

test('well options retain masonry and posts and keep bucket connected to its windlass',()=>{
  const a=buildAsset('stone-well'),b=buildAsset('stone-well',{roof:false}),c=buildAsset('stone-well',{bucket:false,windlass:false}),d=buildAsset('stone-well',{bucketDrop:0.6});
  try {
    assert.equal(count(b,'roof-board-'),0);
    assert.equal(count(b,'rafter-'),0);
    assert.equal(count(b,'post-'),2);
    assert.deepEqual(partBounds(a,'stone-0-0'),partBounds(b,'stone-0-0'));
    assert.equal(count(c,'bucket-'),0);assert.equal(count(c,'windlass'),0);assert.equal(count(c,'hanging-rope'),0);
    assert.ok(Math.abs(partBounds(a,'bucket-shell').min.y-partBounds(d,'bucket-shell').min.y-0.6)<0.0001);
    assert.ok(partBounds(d,'hanging-rope').intersectsBox(partBounds(d,'bucket-handle')));
    assert.equal(descriptor('stone-well').state({bucket:false}).controls.bucketDrop!.enabled,false);
    assert.throws(()=>buildAsset('stone-well',{windlass:false,bucket:true}),/bucket.*windlass/i);
  } finally {[a,b,c,d].forEach(disposeAsset);}
});

test('conifer tier density changes construction with connected branches and stable crown bounds',()=>{
  const a=buildAsset('conifer'),b=buildAsset('conifer',{tierCount:5}),c=buildAsset('conifer',{tierCount:10}),d=buildAsset('conifer',{tierCount:10});
  try {
    assert.equal(count(a,'branch-'),35);
    assert.ok(count(b,'branch-')<count(a,'branch-'));
    assert.ok(count(c,'branch-')>count(a,'branch-'));
    assert.equal(geometryHash(c),geometryHash(d));
    for (const item of [a,b,c]) {
      assert.ok(Math.abs(item.dimensions.y-6)<0.0001);
      assert.ok(Math.abs(Math.max(item.dimensions.x,item.dimensions.z)-3.8)<0.0001);
      item.root.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('branch-'))assert.equal(o.userData.connectedTo,'trunk');});
    }
    for (const input of [{tierCount:4},{tierCount:11},{tierCount:5.5}]) assert.throws(()=>buildAsset('conifer',input));
  } finally {[a,b,c,d].forEach(disposeAsset);}
});

import '../scripts/node-platform.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3} from 'three';
import {buildAsset,disposeAsset} from '../src/catalog/index.ts';
import {exportAsset} from '../src/catalog/export.ts';
import {geometrySnapshot} from '../src/lantern/inspect.ts';
import {buildFixture,fixtureFindings} from './fixtures/review-defects/bench-fixtures.ts';
import {invalidGlbBytes,validateFixtureExport} from './fixtures/review-defects/export-check.ts';

test('original bench fixture detects measured disconnected support and fresh production repair',()=>{
 const baseline=buildFixture('baseline'),broken=buildFixture('broken-support'),repaired=buildFixture('repaired');
 try{
  const good=fixtureFindings(baseline,'baseline'),bad=fixtureFindings(broken,'broken-support'),fresh=fixtureFindings(repaired,'repaired');
  assert.ok(good.every(f=>f.status==='passed'));assert.ok(fresh.every(f=>f.status==='passed'));
  const defect=bad.find(f=>f.code==='support-contact')!;
  assert.equal(defect.status,'failed');assert.equal(defect.part,'leg-1-1 / seat-support-1');assert.ok(Number(defect.measured.gapMeters)>.10);assert.ok(defect.expectedRelation.includes('0.002'));assert.ok(defect.proposedCorrection.includes('leg height'));
  assert.ok(Math.abs(new Box3().setFromObject(broken.root.getObjectByName('leg-1-1')!,true).min.y)<1e-6);
  assert.notDeepEqual(geometrySnapshot(broken.root),geometrySnapshot(baseline.root));assert.deepEqual(geometrySnapshot(repaired.root),geometrySnapshot(baseline.root));
  const unmodified=buildAsset('bench',{width:1.6});try{assert.deepEqual(geometrySnapshot(unmodified.root),geometrySnapshot(baseline.root));}finally{disposeAsset(unmodified);}
 }finally{[baseline,broken,repaired].forEach(disposeAsset);}
});

test('actual width request changes measured geometry while ignored adapter fails the same check',()=>{
 const changed=buildFixture('changed-width'),ignored=buildFixture('ignored-width');
 try{
  const good=fixtureFindings(changed,'changed-width').find(f=>f.code==='effective-width-control')!,bad=fixtureFindings(ignored,'ignored-width').find(f=>f.code==='effective-width-control')!;
  assert.equal(good.status,'passed');assert.ok(Math.abs(Number(good.measured.actualMeters)-2.2)<1e-5);
  assert.equal(bad.status,'failed');assert.equal(bad.control,'width');assert.ok(Math.abs(Number(bad.measured.actualMeters)-1.6)<1e-5);assert.ok(Math.abs(Number(bad.measured.deviationMeters)-.6)<1e-5);assert.ok(bad.proposedCorrection.includes('Forward'));
 }finally{[changed,ignored].forEach(disposeAsset);}
});

test('real exporter and validator distinguish structural validity from fixture contact failure',async()=>{
 for(const id of ['baseline','broken-support','repaired','changed-width','ignored-width'] as const){
  const build=buildFixture(id);
  try{const result=await validateFixtureExport(await exportAsset(build),id);assert.equal(result.status,'passed',JSON.stringify(result));assert.equal(result.measured.errors,0);}finally{disposeAsset(build);}
 }
 const failure=await validateFixtureExport(invalidGlbBytes,'invalid-glb');assert.equal(failure.status,'failed');assert.ok('parseError' in failure.measured||Number(failure.measured.errors)>0);assert.ok(failure.proposedCorrection.includes('exportAsset'));
 const changed=invalidGlbBytes.slice();changed[0]=0;
 assert.equal((await validateFixtureExport(changed,'invalid-glb-mutated')).status,'failed');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectPublicDelivery} from '../server/public-delivery.ts';
import type {ReviewSubject} from '../src/review/types.ts';

test('public delivery selects exact primary package and selected oblique before alphabetic presets',async()=>{
 const original=JSON.parse(await readFile('evidence/revision14/final/bench-review-01/subject.json','utf8')) as ReviewSubject,files:Array<{path:string;sha256:string;bytes:number}>=Object.entries({...original.artifacts,'report.json':original.report}).map(([path,d])=>({path,sha256:d.sha256,bytes:d.bytes})).sort((a,b)=>a.path.localeCompare(b.path)),subject={...original,coverage:{...original.coverage,views:[...original.coverage.views].sort((a,b)=>a.evidence.localeCompare(b.evidence))}},selected=selectPublicDelivery(subject,files);
 assert.deepEqual(selected.primary.map(file=>file.path),['selected.glb','selected.design.json','packages/bench-1.1.0-source.2.zip']);assert.equal(selected.previews[0]!.path,'renders/selected-oblique.png');assert.equal(selected.previews.length,13);assert.equal(selected.preview?.path,'renders/selected-oblique.png');assert.equal([...selected.primary,...selected.previews].length,16);
 for(const file of files.filter(file=>file.path.endsWith('.zip')&&!file.path.includes('/bench-1.1.0-source.2.zip')))assert.equal(selectPublicDelivery(subject,[file]).primary.length,0,file.path);
 const unknown={path:'renders/other-family.png',sha256:'a'.repeat(64),bytes:100},unrecognised={...subject,artifacts:{...subject.artifacts,[unknown.path]:{sha256:unknown.sha256,bytes:unknown.bytes}},coverage:{...subject.coverage,views:[...subject.coverage.views,{caseId:'other-family',view:'oblique',evidence:unknown.path}]}};assert.deepEqual(selectPublicDelivery(unrecognised,[unknown]),{primary:[],previews:[],preview:null});assert.equal(selectPublicDelivery(subject,[{...files.find(file=>file.path==='renders/selected-oblique.png')!,sha256:'0'.repeat(64)}]).previews.length,0);
});

test('preset views remain deliverable but cannot stand in for the selected model preview',async()=>{
 const subject=JSON.parse(await readFile('evidence/revision14/final/bench-review-01/subject.json','utf8')) as ReviewSubject;subject.coverage.views=subject.coverage.views.filter(view=>view.caseId!=='selected');const files=Object.entries(subject.artifacts).map(([path,d])=>({path,sha256:d.sha256,bytes:d.bytes})),selected=selectPublicDelivery(subject,files);assert.ok(selected.previews.length>0);assert.equal(selected.preview,null);
});

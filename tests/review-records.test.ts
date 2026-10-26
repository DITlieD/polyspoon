import test from 'node:test';
import assert from 'node:assert/strict';
import {descriptor} from '../src/catalog/index.ts';
import {canonical,identity} from '../src/review/identity.ts';
import {categories,createReviewRecord,validateReviewRecord,eligibilityDecision} from '../src/review/records.ts';
import type {ReviewSubject,ReviewCategory,ReviewDraft,TrustedAuthority} from '../src/review/types.ts';

const digest={sha256:'a'.repeat(64),bytes:1};
const archive='packages/bench-1.1.0-source.2.zip';
function fixture():ReviewSubject {
 const s:ReviewSubject={formatVersion:1,kind:'review-subject',subjectId:'',scope:'recipe-verification',request:'A supported bench',recipe:{id:'bench',version:'1.1.0',deliveryRevision:2},selectedDesign:descriptor('bench').save({}),run:'evidence/synthetic-policy-fixture',report:{path:'report.json',...digest},technical:{status:'technical-success',stages:['fixture']},source:{sourceHash:digest.sha256,lockHash:digest.sha256,node:process.version,dependencies:{},sources:{},verificationInputs:{}},coverage:{cases:[{id:'selected',configurationHash:digest.sha256,parts:['model','seat']}],views:[{caseId:'selected',view:'front',evidence:'renders/selected-front.png'}]},artifacts:{'renders/selected-front.png':digest,'selected.glb':digest,[archive]:digest},artifactManifestHash:'',limits:['Synthetic policy unit fixture; no actual asset approval']};
 s.artifactManifestHash=identity(s.artifacts);s.subjectId=identity({...s,subjectId:undefined});return s;
}
function draft(category:ReviewCategory):ReviewDraft {
 const evidence=category==='technical'?['report.json']:category==='visual'?['renders/selected-front.png']:category==='portability'?[archive,'selected.glb','evidence/replay.json']:[archive];
 return {category,reviewerId:'independent',decision:'pass',coverage:['selected'],findings:[{caseId:'selected',part:'model',view:({technical:'technical',visual:'front',portability:'portable','executable-source':'source'})[category],evidence,observation:'Synthetic policy observation',decision:'pass'}],...(category==='portability'?{attachments:{'evidence/replay.json':digest}}:{}),...(category==='executable-source'?{sourceInspection:{inspected:['dependencies','imports','licenses','provenance','redistribution'],redistributionScope:'Synthetic archive scope'}}:{}),limits:['Synthetic policy fixture']};
}
function authority(s:ReviewSubject):TrustedAuthority {
 const records=categories.map(c=>createReviewRecord(s,draft(c)));
 return {principals:[{id:'independent',active:true,capabilities:categories}],technicalRecords:records.filter(r=>r.category==='technical'),reviewRecords:records.filter(r=>r.category!=='technical'),assignments:{[s.subjectId]:{technical:records.filter(r=>r.category==='technical').map(r=>r.recordId),reviews:records.filter(r=>r.category!=='technical').map(r=>r.recordId)}},revoked:[],replaced:{}};
}
test('canonical identity preserves literal request and rejects non JSON values',()=>{
 assert.equal(identity({a:1,b:2}),identity({b:2,a:1}));assert.notEqual(identity(' a '),identity('a'));assert.throws(()=>canonical(NaN));assert.throws(()=>canonical(new Date()));
});
test('findings bind actual cases parts views and own evidence keys',()=>{
 const s=fixture();assert.equal(validateReviewRecord(s,createReviewRecord(s,draft('visual'))).valid,true);
 for(const change of [{caseId:'unknown'},{part:'unknown'},{view:'back'},{evidence:['constructor']},{evidence:['../outside']}]){
  const d=draft('visual');Object.assign(d.findings[0]!,change);assert.throws(()=>createReviewRecord(s,d));
 }
 assert.throws(()=>createReviewRecord(s,{...draft('visual'),capabilities:['visual']} as ReviewDraft));
});
test('failed observations require repairs; unresolved and contradictory findings cannot pass',()=>{
 const s=fixture(),d=draft('visual');d.decision='fail';d.findings[0]!.decision='fail';assert.throws(()=>createReviewRecord(s,d));Object.assign(d.findings[0]!,{defect:'Unsupported seat',proposedCorrection:'Add support'});assert.doesNotThrow(()=>createReviewRecord(s,d));
 d.decision='pass';assert.throws(()=>createReviewRecord(s,d));d.findings[0]!.decision='uncertain';assert.throws(()=>createReviewRecord(s,d));d.decision='uncertain';d.findings.push({...d.findings[0]!,decision:'pass'});assert.throws(()=>createReviewRecord(s,d));
});
test('source and portability passing records require applicable archive and replay scope',()=>{
 const s=fixture();for(const category of ['portability','executable-source'] as const){const d=draft(category);d.findings[0]!.evidence=['report.json'];assert.throws(()=>createReviewRecord(s,d));}
 const d=draft('executable-source');d.sourceInspection!.inspected=['imports'];assert.throws(()=>createReviewRecord(s,d));d.decision='uncertain';d.findings[0]!.decision='uncertain';assert.doesNotThrow(()=>createReviewRecord(s,d));
 const p=draft('portability');delete p.attachments;assert.throws(()=>createReviewRecord(s,p));
});
test('one independent qualified reviewer may cover all categories with separate technical authority',()=>{
 const s=fixture(),a=authority(s);assert.equal(eligibilityDecision(s,'author',a).eligible,true);
 assert.equal(eligibilityDecision(s,'independent',a).eligible,false);
 for(const change of [{principals:[]},{reviewRecords:[]},{revoked:[a.reviewRecords[0]!.recordId]},{replaced:{[a.reviewRecords[0]!.recordId]:'replacement'}},{assignments:{}}])assert.equal(eligibilityDecision(s,'author',{...a,...change}).eligible,false);
 const forged=structuredClone(a);forged.reviewRecords[0]!.reviewerId='forged';assert.equal(eligibilityDecision(s,'author',forged).eligible,false);
 const caps=structuredClone(a);caps.principals[0]!.capabilities=['technical'];assert.equal(eligibilityDecision(s,'author',caps).eligible,false);
 assert.equal(eligibilityDecision({...s,scope:'bounded-run'},'author',a).eligible,false);
});
test('uncertain or conflicting trusted records block eligibility',()=>{
 const s=fixture(),a=authority(s),d=draft('visual');d.decision='uncertain';d.findings[0]!.decision='uncertain';const record=createReviewRecord(s,d);a.reviewRecords.push(record);a.assignments[s.subjectId]!.reviews.push(record.recordId);assert.equal(eligibilityDecision(s,'author',a).eligible,false);
});

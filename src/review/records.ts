import {sourcePackageFilename} from '../../scripts/recipe-package-identity.ts';
import {canonical,identity,withoutIdentity} from './identity.ts';
import type {ReviewDraft,ReviewRecord,ReviewSubject,ReviewCategory,Eligibility,TrustedAuthority} from './types.ts';

export const categories:ReviewCategory[]=['technical','visual','portability','executable-source'];
function nonempty(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0;}
function list(value:unknown):value is string[]{return Array.isArray(value)&&value.length>0&&value.every(nonempty)&&new Set(value).size===value.length;}
function knownKeys(value:object,keys:string[]){for(const key of Object.keys(value))if(!keys.includes(key))throw Error('Unknown review field: '+key);}
export function validateReviewRecord(subject:ReviewSubject,value:unknown):{valid:true;record:ReviewRecord} {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected review record');
 const r=value as ReviewRecord;knownKeys(r,['formatVersion','kind','recordId','subjectId','artifactManifestHash','reportSha256','category','reviewerId','decision','coverage','findings','attachments','sourceInspection','limits']);
 if(r.formatVersion!==1||!categories.includes(r.category)||r.kind!==(r.category==='technical'?'verification-attestation':'review-record'))throw Error('Invalid review category or kind');
 if(r.recordId!==identity(withoutIdentity(r as unknown as Record<string,unknown>,'recordId')))throw Error('Review record digest mismatch');
 if(r.subjectId!==subject.subjectId||r.artifactManifestHash!==subject.artifactManifestHash||r.reportSha256!==subject.report.sha256)throw Error('Review subject or artifact manifest mismatch');
 if(!nonempty(r.reviewerId)||!['pass','fail','uncertain'].includes(r.decision)||!list(r.coverage)||!Array.isArray(r.findings)||!r.findings.length||!Array.isArray(r.limits)||!r.limits.every(nonempty))throw Error('Incomplete review record');
 for(const id of r.coverage)if(!subject.coverage.cases.some(c=>c.id===id))throw Error('Unknown covered case: '+id);
 const opinions=new Map<string,Set<string>>();
 for(const f of r.findings){
  knownKeys(f,['caseId','part','view','evidence','observation','decision','defect','proposedCorrection']);
  const c=subject.coverage.cases.find(c=>c.id===f.caseId);if(!c||!r.coverage.includes(f.caseId))throw Error('Finding case is not covered');
  if(!nonempty(f.part)||(!c.parts.includes(f.part)&&!['model','package'].includes(f.part)))throw Error('Unknown finding part: '+f.part);
  if(!nonempty(f.observation)||!list(f.evidence)||!['pass','fail','uncertain'].includes(f.decision))throw Error('Incomplete finding');
  if(f.decision==='fail'&&(!nonempty(f.defect)||!nonempty(f.proposedCorrection)))throw Error('Failed finding needs defect and proposed correction');
  for(const path of f.evidence)if(path!=='report.json'&&!Object.hasOwn(subject.artifacts,path)&&!Object.hasOwn(r.attachments??{},path))throw Error('Finding evidence is not bound: '+path);
  if(r.category==='visual'){
   if(!subject.coverage.views.some(v=>v.caseId===f.caseId&&v.view===f.view&&f.evidence.includes(v.evidence)))throw Error('Finding view/evidence is not an exercised view');
  }else if(f.view!==({technical:'technical',portability:'portable','executable-source':'source'} as const)[r.category])throw Error('Invalid finding inspection view');
  const key=canonical([f.caseId,f.part,f.view]);const decisions=opinions.get(key)??new Set();decisions.add(f.decision);opinions.set(key,decisions);
 }
 for(const id of r.coverage)if(!r.findings.some(f=>f.caseId===id))throw Error('Covered case has no findings');
 if([...opinions.values()].some(values=>values.size>1))throw Error('Contradictory findings');
 if(r.decision==='pass'&&r.findings.some(f=>f.decision!=='pass'))throw Error('Passing record contains unresolved findings');
 if(r.category==='executable-source'){
  const inspection=r.sourceInspection,required=['dependencies','imports','licenses','provenance','redistribution'];
  if(!inspection||!list(inspection.inspected)||(r.decision==='pass'&&!required.every(key=>inspection.inspected.includes(key)))||!nonempty(inspection.redistributionScope))throw Error('Executable source review needs dependency/import/license/provenance/redistribution inspection');
  knownKeys(inspection,['inspected','redistributionScope']);
 }
 if(r.decision==='pass'&&['portability','executable-source'].includes(r.category)){
  const archive='packages/'+sourcePackageFilename(subject.recipe.id,subject.recipe.version,subject.recipe.deliveryRevision);
  const references=r.findings.flatMap(f=>f.evidence);
  if(!Object.hasOwn(subject.artifacts,archive)||!references.includes(archive))throw Error('Passing review needs selected source archive evidence');
  if(r.category==='portability'&&(!Object.hasOwn(subject.artifacts,'selected.glb')||!references.includes('selected.glb')||!references.some(path=>Object.hasOwn(r.attachments??{},path))))throw Error('Portability review needs selected GLB and independent replay attachment');
 }
 if(r.attachments)for(const [path,digest] of Object.entries(r.attachments)){if(!path||path.startsWith('/')||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-f0-9]{64}$/.test(digest.sha256)||!Number.isSafeInteger(digest.bytes)||digest.bytes<0)throw Error('Invalid review attachment');}
 return {valid:true,record:r};
}
export function createReviewRecord(subject:ReviewSubject,input:ReviewDraft):ReviewRecord {
 const body={...input,formatVersion:1 as const,kind:input.category==='technical'?'verification-attestation' as const:'review-record' as const,subjectId:subject.subjectId,artifactManifestHash:subject.artifactManifestHash,reportSha256:subject.report.sha256};
 const record={...body,recordId:identity(body)};return validateReviewRecord(subject,record).record;
}
export function eligibilityDecision(subject:ReviewSubject,contributor:string,authority:TrustedAuthority):Eligibility {
 const result:Eligibility={kind:'local-eligibility-evidence',subjectId:subject.subjectId,eligible:false,categories:{technical:'missing',visual:'missing',portability:'missing','executable-source':'missing'},blockers:[],limits:['Local eligibility evidence only; no authenticated publication service.','Trust depends on application-controlled authority records, not contributor JSON.','Checks cover only this exact subject, evidence and declared cases.']};
 if(!nonempty(contributor))result.blockers.push('Application contributor identity missing');
 if(subject.scope!=='recipe-verification')result.blockers.push('Bounded run is not full recipe verification');
 const assignment=authority.assignments[subject.subjectId];if(!assignment){result.blockers.push('No application-assigned trusted records');return result;}
 const selected:Array<{id:string;technical:boolean}>=[...assignment.technical.map(id=>({id,technical:true})),...assignment.reviews.map(id=>({id,technical:false}))];
 if(new Set(selected.map(v=>v.id)).size!==selected.length)result.blockers.push('Duplicate assigned record');
 for(const entry of selected){
  if(authority.revoked.includes(entry.id)||Object.hasOwn(authority.replaced,entry.id)){result.blockers.push('Revoked or replaced record: '+entry.id);continue;}
  const records=entry.technical?authority.technicalRecords:authority.reviewRecords,record=records.find(r=>r.recordId===entry.id);
  if(!record){result.blockers.push('Trusted record missing: '+entry.id);continue;}
  try{validateReviewRecord(subject,record);}catch(error){result.blockers.push(String(error));continue;}
  if(entry.technical!==(record.category==='technical')){result.blockers.push('Technical verification must be separately held');continue;}
  const principal=authority.principals.find(p=>p.id===record.reviewerId);
  if(!principal?.active||!principal.capabilities.includes(record.category)){result.blockers.push('Reviewer capability missing: '+record.reviewerId);continue;}
  if(record.reviewerId===contributor){result.blockers.push('Contributor self-review rejected');continue;}
  const old=result.categories[record.category];if(old!=='missing'&&old!==record.decision)result.blockers.push('Conflicting trusted decisions: '+record.category);
  result.categories[record.category]=record.decision;
  if(record.decision!=='pass')result.blockers.push('Unresolved '+record.category+' review');
  const required=record.category==='technical'?subject.coverage.cases.map(c=>c.id):record.category==='visual'?[...new Set(subject.coverage.views.map(v=>v.caseId))]:['selected'];
  if(!required.every(id=>record.coverage.includes(id)))result.blockers.push('Incomplete '+record.category+' case coverage');
  if(record.category==='visual'&&subject.coverage.views.some(v=>!record.findings.some(f=>f.caseId===v.caseId&&f.view===v.view&&f.evidence.includes(v.evidence))))result.blockers.push('Incomplete visual view coverage');
 }
 for(const category of categories)if(result.categories[category]!=='pass')result.blockers.push(category+' pass is missing');
 result.eligible=result.blockers.length===0;return result;
}

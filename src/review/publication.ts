import {join,relative,isAbsolute,sep} from 'node:path';
import {canonical} from './identity.ts';
import {readJson,safePath,verifyFile} from './files.ts';
import {verifySubjectEvidence} from './subject.ts';
import {categories,eligibilityDecision,validateReviewRecord} from './records.ts';
import type {ReviewSubject,TrustedAuthority,ReviewRecord} from './types.ts';

export async function verifyRecordEvidence(root:string,subject:ReviewSubject,record:ReviewRecord){
 validateReviewRecord(subject,record);
 if(record.category==='portability'&&record.decision==='pass'){
  const referenced=new Set(record.findings.flatMap(f=>f.evidence));
  const independent=Object.keys(record.attachments??{}).some(path=>{
   if(!referenced.has(path))return false;
   const child=relative(join(root,subject.run),safePath(root,path));return child==='..'||child.startsWith('..'+sep)||isAbsolute(child);
  });
  if(!independent)throw Error('Passing portability review needs referenced replay evidence outside its sealed run');
 }
 for(const [path,digest] of Object.entries(record.attachments??{}))await verifyFile(root,path,digest);return record;
}
export async function evaluateEligibility(root:string,subject:ReviewSubject,contributor:string,authority:TrustedAuthority){
 await verifySubjectEvidence(root,subject);
 const assignment=Object.hasOwn(authority.assignments,subject.subjectId)?authority.assignments[subject.subjectId]:undefined;
 for(const id of [...assignment?.technical??[],...assignment?.reviews??[]]){
  const record=[...authority.technicalRecords,...authority.reviewRecords].find(r=>r.recordId===id);if(record)await verifyRecordEvidence(root,subject,record);
 }
 const result=eligibilityDecision(subject,contributor,authority);await verifySubjectEvidence(root,subject);
 for(const id of [...assignment?.technical??[],...assignment?.reviews??[]]){const record=[...authority.technicalRecords,...authority.reviewRecords].find(r=>r.recordId===id);if(record)await verifyRecordEvidence(root,subject,record);}
 return result;
}
export async function loadAuthorityStore(root:string,path:string,subject:ReviewSubject):Promise<TrustedAuthority>{
 const store=safePath(root,path),child=relative(join(root,subject.run),store);if(!child||(!child.startsWith('..'+sep)&&child!=='..'&&!isAbsolute(child)))throw Error('Authority store must be separate from contributor run');
 const index=await readJson(store,'authority.json');if(index.formatVersion!==1||!Array.isArray(index.principals)||!index.assignments||!Array.isArray(index.technical)||!Array.isArray(index.reviews)||!Array.isArray(index.revoked)||!index.replaced)throw Error('Invalid caller authority store');
 const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const ids=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(id=>typeof id==='string'&&id.trim().length>0)&&new Set(value).size===value.length;
 if(!object(index.assignments)||!object(index.replaced)||!ids(index.revoked)||!Object.values(index.replaced).every(id=>typeof id==='string'&&id.trim().length>0))throw Error('Invalid authority assignments or revocations');
 for(const assignment of Object.values(index.assignments))if(!object(assignment)||!ids(assignment.technical)||!ids(assignment.reviews)||Object.keys(assignment).some(key=>!['technical','reviews'].includes(key)))throw Error('Invalid authority assignment');
 const read=async(entries:any[])=>{const result:ReviewRecord[]=[];for(const entry of entries){if(!object(entry)||typeof entry.recordId!=='string'||typeof entry.path!=='string'||typeof entry.sha256!=='string'||typeof entry.bytes!=='number')throw Error('Invalid authority record descriptor');const bytes=await verifyFile(store,entry.path,{sha256:entry.sha256,bytes:entry.bytes}),record=JSON.parse(bytes.toString('utf8'));if(record.recordId!==entry.recordId)throw Error('Authority record identity mismatch');result.push(record);}return result;};
 const technicalRecords=await read(index.technical),reviewRecords=await read(index.reviews);if(new Set([...technicalRecords,...reviewRecords].map(r=>r.recordId)).size!==technicalRecords.length+reviewRecords.length)throw Error('Duplicate authority record identity');
 for(const principal of index.principals)if(!principal||typeof principal.id!=='string'||!principal.id.trim()||typeof principal.active!=='boolean'||!ids(principal.capabilities)||!principal.capabilities.every((category:any)=>categories.includes(category)))throw Error('Invalid authority principal');
 if(new Set(index.principals.map((p:any)=>p.id)).size!==index.principals.length)throw Error('Duplicate authority principal');
 const result={principals:index.principals,technicalRecords,reviewRecords,assignments:index.assignments,revoked:index.revoked,replaced:index.replaced};canonical(result);return result;
}

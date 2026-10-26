import type {Env,PrivateObjects} from './types.ts';
import type {ReviewRecord,ReviewSubject,TrustedAuthority} from '../src/review/types.ts';
import {eligibilityDecision,validateReviewRecord} from '../src/review/records.ts';
import {HttpError} from './domain.ts';
import {requireUploaded} from './repository.ts';
import type {VersionRow} from './repository.ts';
import {processingCompleteSql} from './processing-proof.ts';
import {requireVerified,readVerifiedArtifact,readVerifiedAttachment} from './verification.ts';

export function capabilityFor(category:string){return category==='technical'?'verifier':'reviewer:'+category;}
export async function checkPublication(env:Env,objects:PrivateObjects,row:VersionRow){
 if(row.processing_requirement!=='legacy'&&!await env.DB.prepare('SELECT id FROM asset_version v WHERE id=? AND '+processingCompleteSql('v')).bind(row.id).first())throw new HttpError(409,'isolated_processing_required');
 const epoch=await env.DB.prepare('SELECT epoch FROM authority_policy WHERE id=1').first<{epoch:number}>();if(!epoch)throw new HttpError(503,'authority_unconfigured');
 const technical=(await env.DB.prepare('SELECT record FROM technical_attestation WHERE version_id=? UNION ALL SELECT record FROM processing_attestation WHERE version_id=?').bind(row.id,row.id).all<{record:string}>()).results.map(r=>JSON.parse(r.record) as ReviewRecord);
 const reviews=(await env.DB.prepare('SELECT record FROM review_record WHERE version_id=?').bind(row.id).all<{record:string}>()).results.map(r=>JSON.parse(r.record) as ReviewRecord);
 const revoked=(await env.DB.prepare('SELECT record_id FROM record_revocation WHERE record_id IN (SELECT record_id FROM technical_attestation WHERE version_id=? UNION SELECT record_id FROM review_record WHERE version_id=? UNION SELECT record_id FROM processing_attestation WHERE version_id=?)').bind(row.id,row.id,row.id).all<{record_id:string}>()).results.map(r=>r.record_id);
 const users=(await env.DB.prepare('SELECT m.user_id,m.status,u.emailVerified,COALESCE(json_group_array(c.name) FILTER(WHERE c.name IS NOT NULL),\'[]\') AS capabilities FROM member m JOIN user u ON u.id=m.user_id LEFT JOIN capability c ON c.user_id=m.user_id WHERE m.user_id IN (SELECT reviewer_id FROM technical_attestation WHERE version_id=? UNION SELECT reviewer_id FROM review_record WHERE version_id=?) GROUP BY m.user_id').bind(row.id,row.id).all<{user_id:string;status:string;emailVerified:number;capabilities:string}>()).results;
 const authority:TrustedAuthority={principals:users.map(user=>({id:user.user_id,active:user.status==='active'&&!!user.emailVerified,capabilities:(['technical','visual','portability','executable-source'] as const).filter(category=>JSON.parse(user.capabilities).includes(capabilityFor(category)))})),technicalRecords:technical,reviewRecords:reviews,assignments:{},revoked,replaced:{}};
 for(const record of technical)if(record.reviewerId.startsWith('processor:'))authority.principals.push({id:record.reviewerId,active:true,capabilities:['technical']});
 const subject=JSON.parse(row.subject) as ReviewSubject;authority.assignments[subject.subjectId]={technical:technical.map(r=>r.recordId),reviews:reviews.map(r=>r.recordId)};
 const result=eligibilityDecision(subject,row.contributor_id,authority);if(!result.eligible)throw new HttpError(409,'independent_review_incomplete');
 if(row.verification_profile==='receipts-v1')await requireVerified(env,row.id);else{const files=await requireUploaded(env,row.id);for(const file of files)await readVerifiedArtifact(env,objects,row.id,file);}
 for(const record of [...technical,...reviews]){validateReviewRecord(subject,record);if(Object.keys(record.attachments??{}).length>4)throw new HttpError(400,'too_many_review_attachments');for(const [path,file] of Object.entries(record.attachments??{})){if(!record.findings.some(f=>f.evidence.includes(path)))throw new HttpError(400,'unreferenced_review_attachment');if(row.verification_profile==='legacy'){const stored=await env.DB.prepare('SELECT bytes,failure_revision FROM review_attachment WHERE owner_id=? AND sha256=?').bind(record.reviewerId,file.sha256).first<{bytes:number;failure_revision:number}>();if(!stored||stored.bytes!==file.bytes)throw new HttpError(409,'review_attachment_missing');await readVerifiedAttachment(env,objects,record.reviewerId,file.sha256,stored);}}}
 const after=await env.DB.prepare('SELECT epoch FROM authority_policy WHERE id=1').first<{epoch:number}>();if(after?.epoch!==epoch.epoch)throw new HttpError(409,'authority_changed');
 return {epoch:epoch.epoch,reviewRevision:row.review_revision};
}

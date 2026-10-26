import type {Env,PrivateObjects} from './types.ts';
import type {ReviewRecord} from '../src/review/types.ts';
import {HttpError,safeArtifactPath} from './domain.ts';
import {mediaType} from './repository.ts';
import {readVerifiedArtifact,readVerifiedAttachment} from './verification.ts';
import type {VerifiedArtifact} from './verification.ts';
import {byteResponse} from './delivery.ts';

const recordsSql='SELECT record_id,version_id,reviewer_id,record,created_at FROM review_record UNION ALL SELECT record_id,version_id,reviewer_id,record,created_at FROM technical_attestation UNION ALL SELECT record_id,version_id,reviewer_id,record,created_at FROM processing_attestation';
export async function inspectReviews(env:Env,versionId:string){
 const rows=(await env.DB.prepare('SELECT r.record,r.created_at,x.reason AS revocation_reason,x.created_at AS revoked_at FROM ('+recordsSql+') r LEFT JOIN record_revocation x ON x.record_id=r.record_id WHERE r.version_id=? ORDER BY r.created_at,r.record_id LIMIT 101').bind(versionId).all<{record:string;created_at:number;revocation_reason:string|null;revoked_at:number|null}>()).results;
 return {records:rows.slice(0,100).map(r=>({record:JSON.parse(r.record) as ReviewRecord,createdAt:r.created_at,revocation:r.revoked_at===null?null:{reason:r.revocation_reason,createdAt:r.revoked_at}})),truncated:rows.length>100};
}
export async function reviewEvidence(request:Request,env:Env,objects:PrivateObjects,versionId:string,recordId:string){
 const row=await env.DB.prepare('SELECT record FROM ('+recordsSql+') WHERE version_id=? AND record_id=?').bind(versionId,recordId).first<{record:string}>();if(!row)throw new HttpError(404,'review_not_found');const record=JSON.parse(row.record) as ReviewRecord,path=new URL(request.url).searchParams.get('path')??'';if(!safeArtifactPath(path))throw new HttpError(400,'invalid_artifact_path');if(!record.findings.some(f=>f.evidence.includes(path)))throw new HttpError(404,'review_evidence_not_found');
 const attachment=record.attachments?.[path];if(attachment){const stored=await env.DB.prepare('SELECT bytes,failure_revision FROM review_attachment WHERE owner_id=? AND sha256=?').bind(record.reviewerId,attachment.sha256).first<{bytes:number;failure_revision:number}>();if(!stored||stored.bytes!==attachment.bytes)throw new HttpError(409,'review_attachment_missing');const data=await readVerifiedAttachment(env,objects,record.reviewerId,attachment.sha256,stored);return byteResponse(request,data,mediaType(path),path.split('/').at(-1));}
 const file=await env.DB.prepare('SELECT * FROM version_artifact WHERE version_id=? AND path=? AND uploaded=1').bind(versionId,path).first<VerifiedArtifact>();if(!file)throw new HttpError(404,'review_evidence_not_found');const data=await readVerifiedArtifact(env,objects,versionId,file);return byteResponse(request,data,file.media_type,path.split('/').at(-1));
}

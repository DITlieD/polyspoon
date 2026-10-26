import type {Env} from './types.ts';
import type {ReviewSubject} from '../src/review/types.ts';
import {canonical,digest,HttpError,nonempty,safeArtifactPath} from './domain.ts';
import {identity,withoutIdentity} from '../src/review/identity.ts';

export interface VersionRow {id:string;asset_id:string;contributor_id:string;title:string;kind:string;subject:string;state:string;review_revision:number;approval_policy_epoch:number|null;approval_review_revision:number|null;verification_profile:'legacy'|'receipts-v1';processing_requirement:'legacy'|'package-replay-v1';processing_policy_version:string}
export interface ArtifactRow {path:string;sha256:string;bytes:number;media_type:string;uploaded:number;failure_revision:number;verified_revision:number|null;verification_error:string|null}
export async function version(env:Env,id:string):Promise<VersionRow>{if(!/^[a-f0-9]{64}$/.test(id))throw new HttpError(404,'version_not_found');const row=await env.DB.prepare('SELECT * FROM asset_version WHERE id=?').bind(id).first<VersionRow>();if(!row)throw new HttpError(404,'version_not_found');return row;}
export function subjectInput(value:unknown):ReviewSubject {
 try{
  const s=value as ReviewSubject;
  if(!s||s.formatVersion!==1||s.kind!=='review-subject'||!['recipe-verification','bounded-run'].includes(s.scope)||!nonempty(s.request,10000)||!s.recipe||s.report?.path!=='report.json'||Object.hasOwn(s.artifacts??{},'report.json')||!safeArtifactPath(s.run)||!nonempty(s.recipe.id,80)||!nonempty(s.recipe.version,40)||!s.coverage?.cases.length||(!Array.isArray(s.coverage.views)||s.coverage.views.length>64)||!s.selectedDesign||s.selectedDesign.family!==s.recipe.id||s.selectedDesign.familyVersion!==s.recipe.version||s.technical?.status!=='technical-success'||!s.technical.stages.length)throw Error();
  if(s.subjectId!==identity(withoutIdentity(s as unknown as Record<string,unknown>,'subjectId'))||s.artifactManifestHash!==identity(s.artifacts))throw Error();
  const entries=Object.entries({...s.artifacts,'report.json':s.report});if(entries.length>256||entries.length<2)throw Error();
  if(entries.reduce((sum,[,file])=>sum+file.bytes,0)>16*1024*1024)throw Error();
  for(const [path,file] of entries)if(!safeArtifactPath(path)||!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>2*1024*1024)throw Error();
  return s;
 }catch{throw new HttpError(400,'invalid_or_unsupported_review_subject');}
}
export function artifactKey(versionId:string,path:string):string{return 'versions/'+versionId+'/'+path;}
export function attachmentKey(owner:string,sha:string):string{return 'review-evidence/'+owner+'/'+sha;}
export async function audit(env:Env,actor:string|null,action:string,target:string,data:unknown){return env.DB.prepare('INSERT INTO audit_event(id,actor_id,action,target,data,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,canonical(data),Date.now());}
export async function requireUploaded(env:Env,id:string):Promise<ArtifactRow[]>{const rows=(await env.DB.prepare('SELECT * FROM version_artifact WHERE version_id=?').bind(id).all<ArtifactRow>()).results;if(!rows.length||rows.some(row=>!row.uploaded))throw new HttpError(409,'artifacts_incomplete');return rows;}
export function mediaType(path:string){return path.endsWith('.glb')?'model/gltf-binary':path.endsWith('.png')?'image/png':path.endsWith('.zip')?'application/zip':path.endsWith('.json')?'application/json':'application/octet-stream';}
export async function checkedObject(objects:{read(key:string):Promise<Uint8Array|null>},key:string,expected:{sha256:string;bytes:number}){const value=await objects.read(key);if(!value||value.length!==expected.bytes||await digest(value)!==expected.sha256)throw new HttpError(409,'artifact_missing_or_changed');return value;}

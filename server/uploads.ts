// Upload ingestion: request a slot, PUT the file straight to private storage, then mark it complete.
// One path for everyone (web, agent tokens, zenov). Completion only makes a file eligible for the automated
// pre-review; nothing here creates review records, changes a version state, or skips human review.
import type {Env,PrivateObjects} from './types.ts';
import type {Principal} from './domain.ts';
import {digest,HttpError,nonempty,requireScope} from './domain.ts';
import {body,bytes,json} from './input.ts';
import {audit} from './repository.ts';
import {fileAppeal} from './appeals.ts';
import {UPLOAD_LIMITS,validateUpload,type UploadFormat} from './upload-validation.ts';

export const DAILY_UPLOAD_CAP=20,DAILY_AUTO_REJECT_CAP=5,SLOT_TTL_MS=15*60*1000;
const DAY=86400000;
type UploadRow={id:string;owner_id:string;source:string;format:UploadFormat;object_key:string;declared_bytes:number;declared_sha256:string;status:string;reason:string|null;title:string|null;expires_at:number;created_at:number};
/** Owner-facing status. Never scores, detectors, or raw validator reasons, so thresholds can't be probed. */
const COARSE:Record<string,string>={reserved:'awaiting_file',received:'received',pending_scan:'queued',scanning:'queued',queued:'in_review',rejected_auto:'rejected',failed:'failed',expired:'expired'};
const shape=(row:UploadRow&{appeal_status?:string|null})=>({appeal:row.appeal_status??null,id:row.id,status:COARSE[row.status]??'queued',reason:row.status==='rejected_auto'?(['prohibited_symbol','sexual_content','text_policy'].includes(row.reason??'')?row.reason:'invalid_file'):null,title:row.title,createdAt:row.created_at});

function uploader(actor:Principal){
 if(actor.status!=='active'||!actor.verified)throw new HttpError(403,'verified_member_required');
 if(actor.scopes){requireScope(actor,'uploads:write');}
}
async function owned(env:Env,actor:Principal,id:string){const row=await env.DB.prepare('SELECT * FROM uploads WHERE id=?').bind(id).first<UploadRow>();if(!row||row.owner_id!==actor.id)throw new HttpError(404,'upload_not_found');return row;}

export async function uploadRoutes(request:Request,env:Env,actor:Principal,path:string,objects:()=>PrivateObjects):Promise<Response|null>{
 if(path!=='/api/uploads'&&!path.startsWith('/api/uploads/'))return null;
 uploader(actor);const method=request.method,now=Date.now();
 if(path==='/api/uploads'&&method==='GET'){const rows=(await env.DB.prepare('SELECT u.*,ap.status AS appeal_status FROM uploads u LEFT JOIN upload_appeal ap ON ap.upload_id=u.id WHERE u.owner_id=? ORDER BY u.created_at DESC LIMIT 50').bind(actor.id).all<UploadRow>()).results;return json({uploads:rows.map(shape)});}
 if(path==='/api/uploads'&&method==='POST'){
  const input=await body(request,['format','bytes','sha256','source']);
  if(input.format!=='glb'&&input.format!=='gltf')throw new HttpError(400,'unsupported_format');
  if(!Number.isSafeInteger(input.bytes)||Number(input.bytes)<=0)throw new HttpError(400,'invalid_size');if(Number(input.bytes)>UPLOAD_LIMITS.maxBytes)throw new HttpError(413,'upload_too_large');
  if(typeof input.sha256!=='string'||!/^[a-f0-9]{64}$/.test(input.sha256))throw new HttpError(400,'invalid_sha256');
  if(input.source!==undefined&&input.source!=='zenov')throw new HttpError(400,'invalid_source');
  if(input.source==='zenov'&&!actor.scopes)throw new HttpError(400,'zenov_requires_token');
  const source=input.source==='zenov'?'zenov':actor.scopes?'token':'web';
  const counts=await env.DB.prepare("SELECT count(*) AS total,sum(status='rejected_auto') AS rejected FROM uploads WHERE owner_id=? AND created_at>?").bind(actor.id,now-DAY).first<{total:number;rejected:number|null}>();
  if(Number(counts?.rejected??0)>=DAILY_AUTO_REJECT_CAP)throw new HttpError(429,'upload_restricted');
  if(Number(counts?.total??0)>=DAILY_UPLOAD_CAP)throw new HttpError(429,'daily_upload_cap');
  const id=crypto.randomUUID(),key='ingest/'+id+'/original',expiresAt=now+SLOT_TTL_MS,store=objects();
  const putUrl=store.signedUpload?await store.signedUpload(key):'/api/uploads/'+id+'/content';
  await env.DB.batch([env.DB.prepare('INSERT INTO uploads(id,owner_id,source,format,object_key,declared_bytes,declared_sha256,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,actor.id,source,input.format,key,input.bytes,input.sha256,expiresAt,now,now),await audit(env,actor.id,'upload_reserved',id,{source,format:input.format})]);
  return json({uploadId:id,putUrl,expiresAt,maxBytes:input.bytes},201);
 }
 const content=/^\/api\/uploads\/([0-9a-f-]{36})\/content$/.exec(path);
 if(content&&method==='PUT'){
  if(env.APP_ENV!=='local'||objects().signedUpload)throw new HttpError(404,'not_found');
  const row=await owned(env,actor,content[1]!);if(row.status!=='reserved'||row.expires_at<now)throw new HttpError(409,'upload_slot_closed');
  const data=await bytes(request,row.declared_bytes);if(!await objects().putIfAbsent(row.object_key,data))throw new HttpError(409,'upload_already_sent');return json({stored:true});
 }
 const appeal=/^\/api\/uploads\/([0-9a-f-]{36})\/appeal$/.exec(path);
 if(appeal&&method==='POST')return fileAppeal(env,actor,appeal[1]!,await body(request,['message']),now);
 const complete=/^\/api\/uploads\/([0-9a-f-]{36})\/complete$/.exec(path);
 if(complete&&method==='POST'){
  const row=await owned(env,actor,complete[1]!),input=await body(request,['title','description','category','provenance']);
  if(row.status!=='reserved')throw new HttpError(409,'upload_already_completed');
  if(row.expires_at<now){await env.DB.prepare("UPDATE uploads SET status='expired',updated_at=? WHERE id=?").bind(now,row.id).run();throw new HttpError(410,'upload_slot_expired');}
  if(!nonempty(input.title,80))throw new HttpError(400,'invalid_title');
  const description=input.description??null,category=input.category??null;
  if(description!==null&&(typeof description!=='string'||description.length>500))throw new HttpError(400,'invalid_description');
  if(category!==null&&(typeof category!=='string'||!/^[a-z0-9-]{1,40}$/.test(category)))throw new HttpError(400,'invalid_category');
  let provenance:string|null=null;if(input.provenance!==undefined){provenance=JSON.stringify(input.provenance);if(input.provenance===null||typeof input.provenance!=='object'||provenance.length>4096)throw new HttpError(400,'invalid_provenance');}
  const store=objects(),data=store.readUpTo?await store.readUpTo(row.object_key,row.declared_bytes):await store.read(row.object_key);
  if(!data)throw new HttpError(409,'upload_file_missing');
  let status='pending_scan',reason:string|null=null;
  if(data.length!==row.declared_bytes||await digest(data)!==row.declared_sha256){status='rejected_auto';reason='hash_mismatch';}
  else{const checked=validateUpload(data,row.format);if(!checked.ok){status='rejected_auto';reason=checked.reason;}}
  await env.DB.batch([env.DB.prepare('UPDATE uploads SET status=?,reason=?,title=?,description=?,category=?,provenance=?,updated_at=? WHERE id=?').bind(status,reason,String(input.title).trim(),description,category,provenance,now,row.id),await audit(env,actor.id,'upload_completed',row.id,{status,reason})]);
  return json({upload:shape({...row,status,title:String(input.title).trim()})},202);
 }
 const one=/^\/api\/uploads\/([0-9a-f-]{36})$/.exec(path);
 if(one&&method==='GET')return json({upload:shape(await owned(env,actor,one[1]!))});
 return null;
}

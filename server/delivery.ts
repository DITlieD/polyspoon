import type {Env,PrivateObjects} from './types.ts';
import type {Principal} from './domain.ts';
import {digest,HttpError,requireScope} from './domain.ts';
import {selectPublicDelivery} from './public-delivery.ts';
import {version} from './repository.ts';
import {readVerifiedArtifact} from './verification.ts';
import type {VerifiedArtifact} from './verification.ts';
import {derive,isDerivedPath,selectedGlb} from './formats.ts';
import {safetyPreviewName} from './catalog-presentation.ts';

export function byteResponse(request:Request,data:Uint8Array,type:string,filename?:string){
 const headers=new Headers({'content-type':type,'accept-ranges':'bytes','content-length':String(data.length)});if(filename)headers.set('content-disposition','attachment; filename="'+filename.replace(/[^a-zA-Z0-9_.-]/g,'_')+'"');
 let status=200,start=0,end=data.length-1;const range=request.headers.get('range');
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2])||data.length===0)return new Response(null,{status:416,headers:{'content-range':'bytes */'+data.length}});
  if(!match[1])start=Math.max(0,data.length-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=data.length||end<start)return new Response(null,{status:416,headers:{'content-range':'bytes */'+data.length}});
  status=206;headers.set('content-range','bytes '+start+'-'+end+'/'+data.length);headers.set('content-length',String(end-start+1));
 }
 return new Response(request.method==='HEAD'?null:Uint8Array.from(data.subarray(start,end+1)),{status,headers});
}
export async function deliver(request:Request,env:Env,actor:Principal|null,objects:PrivateObjects,id:string,path:string){
 if(actor)requireScope(actor,'assets:read');const row=await version(env,id);if(row.state!=='published')throw new HttpError(404,'version_not_found');
 const safetyName=safetyPreviewName(path);if(safetyName){const row=await env.DB.prepare("SELECT a.object_key,a.sha256,a.bytes,a.media_type FROM safety_artifact a JOIN safety_attempt attempt ON attempt.id=a.attempt_id JOIN safety_report r ON r.id=attempt.report_id WHERE r.version_id=? AND a.name=? AND r.id=(SELECT r2.id FROM safety_report r2 WHERE r2.version_id=? ORDER BY r2.created_at DESC,r2.rowid DESC LIMIT 1)").bind(id,safetyName,id).first<{object_key:string;sha256:string;bytes:number;media_type:string}>();if(!row)throw new HttpError(404,'artifact_not_found');const data=await objects.read(row.object_key);if(!data||data.length!==row.bytes||await digest(data)!==row.sha256)throw new HttpError(409,'artifact_missing_or_changed');return byteResponse(request,data,row.media_type,safetyName+'.png');}
 if(path==='published.glb'){
  const stored=await env.DB.prepare("SELECT * FROM version_artifact WHERE version_id=? AND path='selected.glb' AND uploaded=1").bind(id).first<VerifiedArtifact>();
  if(stored){const data=await readVerifiedArtifact(env,objects,id,stored);return byteResponse(request,data,'model/gltf-binary','model.glb');}
  const norm=await env.DB.prepare('SELECT n.object_key,n.bytes,n.sha256 FROM safety_normalized n JOIN safety_attempt t ON t.id=n.attempt_id WHERE t.report_id=(SELECT r.id FROM safety_report r WHERE r.version_id=? ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1)').bind(id).first<{object_key:string;bytes:number;sha256:string}>();
  const up=norm?null:await env.DB.prepare('SELECT object_key,declared_bytes AS bytes,declared_sha256 AS sha256 FROM uploads WHERE version_id=?').bind(id).first<{object_key:string;bytes:number;sha256:string}>();
  const source=norm??up;if(!source)throw new HttpError(404,'artifact_not_found');
  const data=objects.readUpTo?await objects.readUpTo(source.object_key,source.bytes):await objects.read(source.object_key);
  if(!data||data.length!==source.bytes||await digest(data)!==source.sha256)throw new HttpError(409,'artifact_missing_or_changed');
  return byteResponse(request,data,'model/gltf-binary','model.glb');
 }
 if(isDerivedPath(path)){const glb=await selectedGlb(env,objects,id);if(!glb)throw new HttpError(404,'artifact_not_found');const subject=JSON.parse(row.subject);const data=derive(path,glb,subject?.selectedDesign);return byteResponse(request,data,path.endsWith('.json')?'application/json':path.endsWith('.zip')?'application/zip':path.endsWith('.usdz')?'model/vnd.usdz+zip':'application/octet-stream',path.split('/').at(-1));}
 const artifact=await env.DB.prepare('SELECT * FROM version_artifact WHERE version_id=? AND path=? AND uploaded=1').bind(id,path).first<VerifiedArtifact>();if(!artifact)throw new HttpError(404,'artifact_not_found');
 const selected=selectPublicDelivery(JSON.parse(row.subject),[artifact]);if(!selected.primary.length&&!selected.previews.length)throw new HttpError(404,'artifact_not_found');
 const data=await readVerifiedArtifact(env,objects,id,artifact);return byteResponse(request,data,artifact.media_type,path.split('/').at(-1));
}

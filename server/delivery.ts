import type {Env,PrivateObjects} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError,requireScope} from './domain.ts';
import {selectPublicDelivery} from './public-delivery.ts';
import {version} from './repository.ts';
import {readVerifiedArtifact} from './verification.ts';
import type {VerifiedArtifact} from './verification.ts';
import {derive,isDerivedPath,selectedGlb} from './formats.ts';

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
export async function deliver(request:Request,env:Env,actor:Principal,objects:PrivateObjects,id:string,path:string){
 requireScope(actor,'assets:read');const row=await version(env,id);if(row.state!=='published')throw new HttpError(404,'version_not_found');
 if(isDerivedPath(path)){const glb=await selectedGlb(env,objects,id);if(!glb)throw new HttpError(404,'artifact_not_found');const subject=JSON.parse(row.subject);const data=derive(path,glb,subject?.selectedDesign);return byteResponse(request,data,path.endsWith('.json')?'application/json':path.endsWith('.zip')?'application/zip':path.endsWith('.usdz')?'model/vnd.usdz+zip':'application/octet-stream',path.split('/').at(-1));}
 const artifact=await env.DB.prepare('SELECT * FROM version_artifact WHERE version_id=? AND path=? AND uploaded=1').bind(id,path).first<VerifiedArtifact>();if(!artifact)throw new HttpError(404,'artifact_not_found');
 const selected=selectPublicDelivery(JSON.parse(row.subject),[artifact]);if(!selected.primary.length&&!selected.previews.length)throw new HttpError(404,'artifact_not_found');
 const data=await readVerifiedArtifact(env,objects,id,artifact);return byteResponse(request,data,artifact.media_type,path.split('/').at(-1));
}

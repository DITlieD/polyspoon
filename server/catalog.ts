import {catalogDiscovery,voteCountSql} from './catalog-queries.ts';
import {castVote,creditDownload} from './community.ts';
import type {Env,PrivateObjects} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError,requireScope} from './domain.ts';
import {body,json} from './input.ts';
import {audit} from './repository.ts';
import {deliver,byteResponse} from './delivery.ts';
import {checkedObject} from './repository.ts';
import {selectPublicDelivery} from './public-delivery.ts';
import {sourcePackageFilename} from '../scripts/recipe-package-identity.ts';
import {derivedDescriptors,selectedGlb} from './formats.ts';

export async function catalogRoutes(request:Request,env:Env,actor:Principal,path:string,objects:()=>PrivateObjects):Promise<Response|null>{
 if(path==='/api/catalog'&&request.method==='GET'){
  requireScope(actor,'catalog:read');return catalogDiscovery(request,env,actor);
 }
 const vote=/^\/api\/catalog\/([a-zA-Z0-9_-]+)\/vote$/.exec(path);
 if(vote&&['PUT','DELETE'].includes(request.method)){
  requireScope(actor,'votes:write');if(request.method==='PUT')await body(request,[]);
  return json(await castVote(env,actor,vote[1]!,request.method==='PUT'));
 }
 const file=/^\/api\/catalog\/([a-f0-9]{64})\/files$/.exec(path);if(file&&['GET','HEAD'].includes(request.method)){const filePath=new URL(request.url).searchParams.get('path')??'',response=await deliver(request,env,actor,objects(),file[1]!,filePath);if(request.method==='GET'&&response.ok&&!actor.scopes)await creditDownload(env,actor,file[1]!,filePath);return response;}
 const model=/^\/api\/catalog\/([a-f0-9]{64})$/.exec(path);
 if(model&&request.method==='GET'){requireScope(actor,'catalog:read');const row=await env.DB.prepare("SELECT v.id,v.asset_id,v.title,v.kind,v.published_at,v.subject,v.model_type AS type,v.style_id AS style,v.metadata_source AS metadataSource,"+voteCountSql('v.asset_id')+" AS votes,EXISTS(SELECT 1 FROM vote WHERE asset_id=v.asset_id AND user_id=?) AS voted FROM catalog_version_metadata v WHERE v.id=? AND v.state='published'").bind(actor.id,model[1]).first();if(!row)throw new HttpError(404,'model_not_found');const subject=JSON.parse(String(row.subject));const candidates=(await env.DB.prepare('SELECT path,sha256,bytes,media_type FROM version_artifact WHERE version_id=? AND uploaded=1').bind(model[1]).all<{path:string;sha256:string;bytes:number;media_type:string}>()).results,selected=selectPublicDelivery(subject,candidates),artifacts=[...selected.primary,...selected.previews],delivery={primary:selected.primary.map(file=>file.path),previews:selected.previews.map(file=>file.path),preview:selected.preview?.path??null};const capabilities:string[]=[];if(artifacts.some(file=>file.path.endsWith('.glb')&&file.media_type==='model/gltf-binary'))capabilities.push('download:glb');if(selected.primary.some(file=>file.path==='selected.glb')){try{const glb=await selectedGlb(env,objects(),model[1]!);const derived=glb?await derivedDescriptors(glb,subject.selectedDesign):[];for(const file of derived){artifacts.push(file as never);delivery.primary.push(file.path);capabilities.push(file.path.endsWith('.controls.json')?'controls':'download:'+(file.path.endsWith('.obj.zip')?'obj':file.path.split('.').at(-1)));}}catch(error){logDerivedFailure(model[1]!,error);}}let recipe:{id:string;version:string;deliveryRevision:number}|null=null,sourcePackage:(typeof artifacts)[number]|null=null;if(['recipe','preset'].includes(String(row.kind))&&subject.recipe){recipe={id:subject.recipe.id,version:subject.recipe.version,deliveryRevision:subject.recipe.deliveryRevision};try{const sourcePath='packages/'+sourcePackageFilename(recipe.id,recipe.version,recipe.deliveryRevision);sourcePackage=artifacts.find(file=>file.path===sourcePath)??null;}catch{}if(sourcePackage)capabilities.push('download:source');}const {subject:privateSubject,...metadata}=row;return json({...metadata,voted:!!row.voted,design:subject.selectedDesign,recipe,sourcePackage,artifacts,delivery,capabilities});}
 if((path==='/app'||path.startsWith('/app/')||path==='/catalog'||path.startsWith('/asset/')||path==='/contribute'||path==='/editor')&&['GET','HEAD'].includes(request.method)){
  if(actor.scopes)throw new HttpError(403,'interactive_session_required');if(actor.status!=='suspended')requireScope(actor,'catalog:read');if(!env.PRIVATE_APP_RELEASE||!/^[a-f0-9]{64}$/.test(env.PRIVATE_APP_RELEASE))throw new HttpError(503,'private_app_unconfigured');const appPath=path.startsWith('/app/')?path.slice(5):'index.html';const row=await env.DB.prepare('SELECT sha256,bytes,media_type FROM app_asset WHERE release_hash=? AND path=?').bind(env.PRIVATE_APP_RELEASE,appPath).first<{sha256:string;bytes:number;media_type:string}>();if(!row)throw new HttpError(404,'app_asset_not_found');const data=await checkedObject(objects(),'applications/'+env.PRIVATE_APP_RELEASE+'/'+appPath,row);return byteResponse(request,data,row.media_type);
 }
 return null;
}
export function logDerivedFailure(versionId:string,error:unknown){const name=error instanceof Error?error.name:'Error';const message=(error instanceof Error?error.message:String(error)).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g,'[email]').replace(/(token|key|secret|signature)=[^&\s]+/gi,'$1=[redacted]').slice(0,200);console.error(JSON.stringify({event:'derived_formats_failed',versionId,error:name,message}));}

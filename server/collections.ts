// Curated collections. Discovery only: collections never change review, publication, capabilities or scoring,
// and only ever list currently published models to signed-in members.
import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError,nonempty,requireScope} from './domain.ts';
import {body,json} from './input.ts';
import {audit} from './repository.ts';
import {voteCountSql} from './catalog-queries.ts';

type Row={id:string;slug:string;title:string;description:string;created_at:number;updated_at:number};
export const MAX_ITEMS=200;
export function validSlug(value:unknown):value is string{return typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length>=3&&value.length<=40;}
export function canCurate(actor:Principal){return !actor.scopes&&actor.status==='active'&&actor.verified&&actor.capabilities.some(cap=>cap==='admin'||cap==='moderator');}
const curator=(actor:Principal)=>{if(!canCurate(actor))throw new HttpError(403,'curator_required');};
const shape=(row:Row&{count?:number})=>({slug:row.slug,title:row.title,description:row.description,models:row.count,updatedAt:row.updated_at});
async function bySlug(env:Env,slug:string){const row=await env.DB.prepare('SELECT * FROM collection WHERE slug=?').bind(slug).first<Row>();if(!row)throw new HttpError(404,'collection_not_found');return row;}
const publishedCount="(SELECT count(*) FROM collection_item i JOIN catalog_discovery d ON d.asset_id=i.asset_id WHERE i.collection_id=c.id)";

export async function collectionRoutes(request:Request,env:Env,actor:Principal,path:string):Promise<Response|null>{
 if(path!=='/api/collections'&&!path.startsWith('/api/collections/'))return null;
 const method=request.method;
 if(path==='/api/collections'&&method==='GET'){requireScope(actor,'catalog:read');const rows=(await env.DB.prepare('SELECT c.*,'+publishedCount+' AS count FROM collection c ORDER BY c.updated_at DESC LIMIT 100').all<Row&{count:number}>()).results;return json({collections:rows.map(shape),canCurate:canCurate(actor)});}
 if(path==='/api/collections'&&method==='POST'){
  curator(actor);const input=await body(request,['slug','title','description']);if(!validSlug(input.slug))throw new HttpError(400,'invalid_slug');if(!nonempty(input.title,80))throw new HttpError(400,'invalid_title');const description=input.description??'';if(typeof description!=='string'||description.length>500)throw new HttpError(400,'invalid_description');
  if(await env.DB.prepare('SELECT 1 FROM collection WHERE slug=?').bind(input.slug).first())throw new HttpError(409,'slug_taken');
  const id=crypto.randomUUID(),now=Date.now();await env.DB.batch([env.DB.prepare('INSERT INTO collection(id,slug,title,description,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,input.slug,String(input.title).trim(),description,actor.id,now,now),await audit(env,actor.id,'collection_created',id,{slug:input.slug})]);
  return json({collection:shape({...(await bySlug(env,input.slug)),count:0})},201);
 }
 const one=/^\/api\/collections\/([a-z0-9-]{3,40})$/.exec(path);
 if(one&&method==='GET'){
  requireScope(actor,'catalog:read');const row=await bySlug(env,one[1]!);
  const models=(await env.DB.prepare("SELECT d.id,d.asset_id,d.title,d.kind,d.published_at,d.model_type AS type,"+voteCountSql('d.asset_id')+" AS votes FROM collection_item i JOIN catalog_discovery d ON d.asset_id=i.asset_id WHERE i.collection_id=? ORDER BY i.position,i.added_at").bind(row.id).all()).results;
  return json({collection:shape({...row,count:models.length}),models,canCurate:canCurate(actor)});
 }
 if(one&&method==='PUT'){
  curator(actor);const row=await bySlug(env,one[1]!),input=await body(request,['title','description']);const title=input.title===undefined?row.title:input.title,description=input.description===undefined?row.description:input.description;
  if(!nonempty(title,80))throw new HttpError(400,'invalid_title');if(typeof description!=='string'||description.length>500)throw new HttpError(400,'invalid_description');
  await env.DB.batch([env.DB.prepare('UPDATE collection SET title=?,description=?,updated_at=? WHERE id=?').bind(String(title).trim(),description,Date.now(),row.id),await audit(env,actor.id,'collection_updated',row.id,{})]);return json({collection:shape(await bySlug(env,row.slug))});
 }
 if(one&&method==='DELETE'){curator(actor);const row=await bySlug(env,one[1]!);await env.DB.batch([env.DB.prepare('DELETE FROM collection_item WHERE collection_id=?').bind(row.id),env.DB.prepare('DELETE FROM collection WHERE id=?').bind(row.id),await audit(env,actor.id,'collection_deleted',row.id,{slug:row.slug})]);return json({deleted:true});}
 const item=/^\/api\/collections\/([a-z0-9-]{3,40})\/items\/([a-zA-Z0-9_-]{1,120})$/.exec(path);
 if(item&&['PUT','DELETE'].includes(method)){
  curator(actor);const row=await bySlug(env,item[1]!),asset=item[2]!;
  if(method==='PUT'){
   if(!await env.DB.prepare('SELECT 1 FROM catalog_discovery WHERE asset_id=?').bind(asset).first())throw new HttpError(404,'model_not_found');
   const n=Number((await env.DB.prepare('SELECT count(*) AS n FROM collection_item WHERE collection_id=?').bind(row.id).first<{n:number}>())?.n??0);if(n>=MAX_ITEMS)throw new HttpError(409,'collection_full');
   await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO collection_item(collection_id,asset_id,position,added_by,added_at) VALUES(?,?,?,?,?)').bind(row.id,asset,n,actor.id,Date.now()),env.DB.prepare('UPDATE collection SET updated_at=? WHERE id=?').bind(Date.now(),row.id),await audit(env,actor.id,'collection_item_added',row.id,{asset})]);
  }else await env.DB.batch([env.DB.prepare('DELETE FROM collection_item WHERE collection_id=? AND asset_id=?').bind(row.id,asset),env.DB.prepare('UPDATE collection SET updated_at=? WHERE id=?').bind(Date.now(),row.id),await audit(env,actor.id,'collection_item_removed',row.id,{asset})]);
  return json({added:method==='PUT'});
 }
 return null;
}

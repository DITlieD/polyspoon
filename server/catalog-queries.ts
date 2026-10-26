import type {Env} from './types.ts';
import type {Principal} from './domain.ts';
import {HttpError} from './domain.ts';
import {json} from './input.ts';
import {selectPublicDelivery} from './public-delivery.ts';
import {styleLabels} from '../src/site/discovery.ts';

type Metadata={recipe_id:string;recipe_version:string;model_type:string;style_id:string|null};
type Row={id:string;asset_id:string;title:string;kind:string;published_at:number|null;votes:number;voted:number;type:string|null;style:string|null;metadataSource:string;subject:string};
type Artifact={version_id:string;path:string;sha256:string;bytes:number;media_type:string};
type Facet={value:string;label:string;count:number};
export function voteCountSql(asset:string){return "(SELECT count(*) FROM vote voter JOIN member voting_member ON voting_member.user_id=voter.user_id JOIN user voting_user ON voting_user.id=voter.user_id WHERE voter.asset_id="+asset+" AND voting_member.status='active' AND voting_user.emailVerified=1)";}
function facets(values:Set<string>,counts:Map<string,number>,label:(value:string)=>string):Facet[]{return [...values].sort((a,b)=>a==='unclassified'?1:b==='unclassified'?-1:a.localeCompare(b)).map(value=>({value,label:label(value),count:counts.get(value)??0}));}
export async function catalogDiscovery(request:Request,env:Env,actor:Principal){
 const params=new URL(request.url).searchParams,allowed=['q','type','style','offset','sort'];
 for(const key of params.keys())if(!allowed.includes(key)||params.getAll(key).length!==1)throw new HttpError(400,'invalid_catalog_query');
 const rawQuery=params.get('q')??'';if(rawQuery.length>100)throw new HttpError(400,'query_too_long');const sort=params.get('sort')??'new';if(!['new','top'].includes(sort))throw new HttpError(400,'invalid_catalog_sort');const query=rawQuery.trim(),type=params.get('type')??'',style=params.get('style')??'',rawOffset=params.get('offset')??'0',offset=Number(rawOffset),limit=24;
 if(!/^(0|[1-9][0-9]*)$/.test(rawOffset)||!Number.isSafeInteger(offset)||offset>100000)throw new HttpError(400,'invalid_catalog_offset');
 const metadata=(await env.DB.prepare('SELECT recipe_id,recipe_version,model_type,style_id FROM catalog_recipe_metadata ORDER BY recipe_id').all<Metadata>()).results,types=new Set([...metadata.map(row=>row.model_type),'unclassified']),styles=new Set(Object.keys(styleLabels));
 if(type&&!types.has(type))throw new HttpError(400,'invalid_catalog_type');if(style&&!styles.has(style))throw new HttpError(400,'invalid_catalog_style');
 const where="instr(lower(d.title),lower(?))>0 AND (?='' OR COALESCE(d.model_type,'unclassified')=?) AND (?='' OR COALESCE(d.style_id,'unclassified')=?)",bindings=[query,type,type,style,style];
 const results=await env.DB.batch<Record<string,unknown>>([
  env.DB.prepare('SELECT d.id,d.asset_id,d.title,d.kind,d.published_at,d.subject,d.model_type AS type,d.style_id AS style,d.metadata_source AS metadataSource,'+voteCountSql('d.asset_id')+' AS votes,EXISTS(SELECT 1 FROM vote WHERE asset_id=d.asset_id AND user_id=?) AS voted FROM catalog_discovery d WHERE '+where+' ORDER BY '+(sort==='top'?'votes DESC,':'')+'COALESCE(d.published_at,0) DESC,d.id DESC LIMIT ? OFFSET ?').bind(actor.id,...bindings,limit,offset),
  env.DB.prepare('SELECT count(*) AS total FROM catalog_discovery d WHERE '+where).bind(...bindings),
  env.DB.prepare('SELECT model_type,style_id,count(*) AS count FROM catalog_discovery GROUP BY model_type,style_id'),
 ]);
 const rows=results[0]!.results as Row[],total=Number(results[1]!.results[0]?.total??0),counts=results[2]!.results as {model_type:string|null;style_id:string|null;count:number}[],typeCounts=new Map<string,number>(),styleCounts=new Map<string,number>();
 for(const row of counts){const typeKey=row.model_type??'unclassified',styleKey=row.style_id??'unclassified';typeCounts.set(typeKey,(typeCounts.get(typeKey)??0)+row.count);styleCounts.set(styleKey,(styleCounts.get(styleKey)??0)+row.count);}
 const files=rows.length?(await env.DB.prepare("SELECT version_id,path,sha256,bytes,media_type FROM version_artifact WHERE uploaded=1 AND version_id IN ("+rows.map(()=>'?').join(',')+") AND (lower(path) LIKE '%.png' OR lower(path) LIKE '%.jpg' OR lower(path) LIKE '%.jpeg' OR lower(path) LIKE '%.webp')").bind(...rows.map(row=>row.id)).all<Artifact>()).results:[],byVersion=new Map<string,Artifact[]>();
 for(const file of files){const group=byVersion.get(file.version_id)??[];group.push(file);byVersion.set(file.version_id,group);}
 const models=rows.map(row=>{const {subject,voted,...model}=row,selected=selectPublicDelivery(JSON.parse(subject),byVersion.get(row.id)??[]).preview;const preview=selected?{path:selected.path,sha256:selected.sha256,bytes:selected.bytes,media_type:selected.media_type}:null;return {...model,voted:!!voted,preview};});
 return json({models,total,offset,limit,nextOffset:offset+rows.length<total?offset+limit:null,facets:{types:facets(types,typeCounts,value=>value==='unclassified'?styleLabels.unclassified!:value),styles:facets(styles,styleCounts,value=>styleLabels[value]!)}});
}

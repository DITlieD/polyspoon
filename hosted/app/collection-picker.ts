import {el,field,status,action} from '../shared/dom.ts';
import {explain,ApiFailure} from '../shared/http.ts';
import type {Context} from './types.ts';
export interface CollectionChoice {slug:string;title:string;models:number}
/** The existing collections add-model API path. Discovery only: never touches review, permissions or scoring. */
export const collectionItemPath=(slug:string,assetId:string)=>'/api/collections/'+encodeURIComponent(slug)+'/items/'+encodeURIComponent(assetId);
/** Shown only when the server says this signed-in session may curate (active, verified moderator/admin, not an agent token). */
export const showCollectionPicker=(data:{canCurate?:unknown;collections?:unknown[]}|null|undefined)=>data?.canCurate===true&&Array.isArray(data.collections)&&data.collections.length>0;
const messages:Record<string,string>={collection_full:'That collection already holds 200 models.',model_not_found:'Only published models can be added.',curator_required:'Only moderators and admins can curate collections.',collection_not_found:'That collection no longer exists.'};
export async function addToCollection(context:Context,assetId:string):Promise<HTMLElement|null>{
 let data:{collections:CollectionChoice[];canCurate:boolean};
 try{data=await context.api.json('/api/collections');}catch{return null;}
 if(!showCollectionPicker(data))return null;
 const form=el('form','add-to-collection'),select=el('select'),feedback=status(),confirm=el('button','button-secondary','Add to collection');confirm.type='submit';select.name='collection';
 for(const c of data.collections){const o=el('option','',c.title+' ('+c.models+')');o.value=c.slug;select.append(o);}
 form.append(field('Collection (curators)',select),confirm,feedback);
 form.addEventListener('submit',e=>{e.preventDefault();const choice=data.collections.find(c=>c.slug===select.value);if(!choice)return;
  void action(confirm,feedback,async()=>{try{await context.api.json(collectionItemPath(choice.slug,assetId),{method:'PUT',body:'{}'});feedback.textContent='Added to “'+choice.title+'”.';}catch(error){feedback.textContent=error instanceof ApiFailure?messages[error.code]??explain(error):explain(error);}});});
 return form;
}

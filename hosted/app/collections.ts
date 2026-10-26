import './community.css';
import {el,link,button,input,field,status,heading,empty,action,when} from '../shared/dom.ts';
import {explain,ApiFailure} from '../shared/http.ts';
import type {Context} from './types.ts';
interface Summary {slug:string;title:string;description:string;models:number;updatedAt:number}
interface Item {id:string;asset_id:string;title:string;type:string|null;votes:number;published_at:number}
const errors:Record<string,string>={slug_taken:'That address is already used.',invalid_slug:'Use 3–40 lowercase letters, numbers and dashes.',invalid_title:'Add a title of up to 80 characters.',model_not_found:'Only published models can be added. Use the model’s asset id.',collection_full:'A collection holds up to 200 models.',curator_required:'Only moderators and admins can curate collections.'};
const say=(error:unknown)=>error instanceof ApiFailure?errors[error.code]??explain(error):explain(error);
export const collectionHref=(slug:string)=>'/catalog?view=collection&slug='+encodeURIComponent(slug);
export async function collectionsPage(context:Context){
 const data=await context.api.json<{collections:Summary[];canCurate:boolean}>('/api/collections'),root=el('section','',heading('Collections','Hand-picked sets of reviewed models, curated by Polyspoon moderators.'));
 if(!data.collections.length)root.append(empty('No collections yet.',data.canCurate?'Create the first one below.':'Curated collections will appear here.'));
 else{const list=el('div','collection-list');for(const c of data.collections)list.append(el('article','collection-card',el('h2','',link(c.title,collectionHref(c.slug))),el('p','muted',c.description||'No description.'),el('p','muted',c.models+(c.models===1?' model':' models')+' · updated '+when(c.updatedAt))));root.append(list);}
 if(data.canCurate){
  const form=el('form','panel curator-tools'),slug=input('slug'),title=input('title'),description=el('textarea'),feedback=status(),create=el('button','button','Create collection');create.type='submit';slug.placeholder='starter-props';slug.pattern='[a-z0-9-]{3,40}';title.maxLength=80;description.maxLength=500;description.rows=2;
  form.append(el('h2','','New collection (moderators and admins)'),field('Address',slug),field('Title',title),field('Description',description),create,feedback);
  form.addEventListener('submit',e=>{e.preventDefault();void action(create,feedback,async()=>{try{await context.api.json('/api/collections',{method:'POST',body:JSON.stringify({slug:slug.value.trim(),title:title.value.trim(),description:description.value})});location.assign(collectionHref(slug.value.trim()));}catch(error){feedback.textContent=say(error);}});});
  root.append(form);
 }
 return root;
}
export async function collectionPage(context:Context){
 const slug=new URLSearchParams(location.search).get('slug')??'';const data=await context.api.json<{collection:Summary;models:Item[];canCurate:boolean}>('/api/collections/'+encodeURIComponent(slug));
 const root=el('section','',link('All collections','/catalog?view=collections','back-link'),heading(data.collection.title,data.collection.description||'A curated collection of reviewed models.')),feedback=status();
 const grid=el('div','community-grid');
 for(const m of data.models){const card=el('article','community-card',el('h3','',link(m.title,'/asset/'+encodeURIComponent(m.id))),el('p','muted',(m.type??'Unclassified')+' · '+m.votes+(m.votes===1?' vote':' votes')));
  if(data.canCurate){const remove=button('Remove','button-secondary');remove.addEventListener('click',()=>void action(remove,feedback,async()=>{try{await context.api.json('/api/collections/'+encodeURIComponent(slug)+'/items/'+encodeURIComponent(m.asset_id),{method:'DELETE'});card.remove();feedback.textContent='Removed from the collection.';}catch(error){feedback.textContent=say(error);}}));card.append(remove);}
  grid.append(card);}
 root.append(data.models.length?grid:empty('This collection is empty.','Models appear here once a curator adds published models.'),feedback);
 if(data.canCurate){
  const form=el('form','panel curator-tools'),asset=input('asset'),title=input('title',undefined,false),description=el('textarea'),add=el('button','button-secondary','Add model'),save=el('button','button','Save details');add.type='button';save.type='submit';asset.required=false;asset.placeholder='asset id, e.g. garden-bench';title.value=data.collection.title;description.value=data.collection.description;description.rows=2;
  add.addEventListener('click',()=>void action(add,feedback,async()=>{try{await context.api.json('/api/collections/'+encodeURIComponent(slug)+'/items/'+encodeURIComponent(asset.value.trim()),{method:'PUT',body:'{}'});location.reload();}catch(error){feedback.textContent=say(error);}}));
  form.addEventListener('submit',e=>{e.preventDefault();void action(save,feedback,async()=>{try{await context.api.json('/api/collections/'+encodeURIComponent(slug),{method:'PUT',body:JSON.stringify({title:title.value.trim(),description:description.value})});location.reload();}catch(error){feedback.textContent=say(error);}});});
  form.append(el('h2','','Curate (moderators and admins)'),field('Add a published model by asset id',asset),add,field('Title',title),field('Description',description),save);root.append(form);
 }
 return root;
}

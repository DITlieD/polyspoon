import {el,button,status,empty} from '../shared/dom.ts';
import {explain} from '../shared/http.ts';
import type {Context} from './types.ts';
export function moderationPages<T>(context:Context,title:string,fetchPage:(offset:number)=>Promise<{items:T[];nextOffset:number|null}>,render:(item:T,refresh:()=>Promise<void>)=>HTMLElement){
 const root=el('section','moderation-section',el('h2','',title)),feedback=status(),list=el('div','list'),previous=button('Previous','button-secondary'),next=button('Next','button-secondary'),reload=button('Refresh','button-secondary');root.setAttribute('aria-label',title);previous.setAttribute('aria-label','Previous '+title.toLowerCase()+' page');next.setAttribute('aria-label','Next '+title.toLowerCase()+' page');reload.setAttribute('aria-label','Refresh '+title.toLowerCase());root.append(feedback,el('div','actions',reload,previous,next),list);let active=true,revision=0,offset=0,nextOffset:number|null=null;
 context.resources.add(()=>{active=false;revision++;});
 async function load(at=0){const own=++revision;previous.disabled=true;next.disabled=true;reload.disabled=true;list.replaceChildren();feedback.textContent='Loading '+title.toLowerCase()+'…';
  try{const data=await fetchPage(at);if(!active||own!==revision)return;offset=at;nextOffset=data.nextOffset;feedback.textContent=data.items.length?'Showing items '+(at+1)+' to '+(at+data.items.length)+'.'+(nextOffset!==null?' More items are available.':''):'';if(!data.items.length)list.append(empty('Nothing here right now.','Refresh to check again, or go back.'));for(const item of data.items)list.append(render(item,()=>load(0)));}
  catch(error){if(active&&own===revision){nextOffset=null;feedback.textContent=explain(error);}}
  finally{if(active&&own===revision){reload.disabled=false;previous.disabled=offset===0;next.disabled=nextOffset===null;}}
 }
 previous.addEventListener('click',()=>void load(Math.max(0,offset-50)));next.addEventListener('click',()=>{if(nextOffset!==null)void load(nextOffset);});reload.addEventListener('click',()=>void load(0));return {root,load:()=>load(0)};
}

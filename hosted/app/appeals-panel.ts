// Moderator panel for automated rejections: filed appeals first, then other auto-rejections a moderator may reopen.
// Accept sends the model to the live queue (it still needs a reviewer, a safety clearance and the publisher);
// decline keeps the rejection. Both need a written reason and are logged.
import {el,button,status,empty} from '../shared/dom.ts';
import {explain} from '../shared/http.ts';
import type {Context} from './types.ts';
import {appealOrder,REASON_LABEL,type AppealItem} from './appeals-model.ts';
import {CATEGORY_LABEL} from './live-queue-model.ts';
export async function appealsPanel(context:Context,onChange:()=>void):Promise<HTMLElement>{
 const root=el('section','queue-appeals'),list=el('div','queue-appeal-list'),feedback=status();
 root.append(el('h2','','Automated rejections and appeals'),el('p','muted','Reopening sends a model to the live queue for normal human review. It does not approve it.'),feedback,list);
 async function load(){
  let items:AppealItem[];
  try{const data=await context.api.json<{appeals:AppealItem[]}>('/api/moderation/appeals?upload=1');const raw=Array.isArray(data?.appeals)?data.appeals:[];items=appealOrder(raw.map(a=>({...a,findings:Array.isArray(a.findings)?a.findings:[]})));}
  catch(error){feedback.textContent=explain(error);return;}
  try{
   const usable=items.filter(a=>typeof a.versionId==='string'&&/^[a-f0-9]{64}$/.test(a.versionId));
   list.replaceChildren();if(items.length&&!usable.length){feedback.textContent='Automated rejection appeals could not be loaded.';return;}
   if(!usable.length){list.append(empty('Nothing to appeal.','Automated rejections show up here.'));return;}
   for(const a of usable){
   const reason=el('textarea');reason.maxLength=500;reason.rows=2;reason.placeholder='Reason (required, logged)';
   const accept=button('Reopen for review','button'),decline=button('Keep rejected','button-secondary');
   const decide=async(decision:'accept'|'decline')=>{if(!reason.value.trim()){feedback.textContent='Write a reason first.';reason.focus();return;}accept.disabled=decline.disabled=true;
    try{await context.api.json('/api/moderation/appeals/'+a.versionId,{method:'POST',body:JSON.stringify({decision,reason:reason.value}),headers:{'content-type':'application/json'}});feedback.textContent=decision==='accept'?'Reopened: it is in the live queue now.':'Rejection kept.';await load();onChange();}
    catch(error){feedback.textContent=explain(error);accept.disabled=decline.disabled=false;}};
   accept.addEventListener('click',()=>void decide('accept'));decline.addEventListener('click',()=>void decide('decline'));
   if(a.ownContent){accept.disabled=decline.disabled=true;reason.disabled=true;}
   list.append(el('article','queue-appeal'+(a.filed?' filed':''),el('h3','',a.title??'Untitled upload'),
    el('div','queue-meta',el('span','queue-badge '+(a.filed?'warning':'neutral'),a.filed?'appeal filed':'no appeal'),el('span','',a.ownerName??'Unknown member'),el('span','','rejected for '+(REASON_LABEL[a.reason??'']??'policy'))),
    a.message?el('blockquote','',a.message):'',
    ...(Array.isArray(a.findings)?a.findings:[]).map(f=>el('div','queue-meta',(CATEGORY_LABEL[f.category]??f.category)+' · '+f.detector+(f.textSpan?' · '+f.textSpan:''))),
    a.ownContent?el('p','queue-meta','Your own upload: another moderator must decide it.'):'',
    reason,el('div','actions',accept,decline)));
   }
  }catch(error){feedback.textContent=explain(error);}
 }
 await load();return root;
}

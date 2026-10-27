// The member's own direct uploads (GLB/glTF via the upload API or zenov) with their coarse status, and the appeal
// form for an automated rejection. Shows no scores or detector names, so thresholds can't be probed.
import './live-queue.css';
import {el,button,status} from '../shared/dom.ts';
import {explain} from '../shared/http.ts';
import type {Context} from './types.ts';
import {ownerNotice,validAppealMessage,type OwnUpload} from './appeals-model.ts';
const LABEL:Record<string,string>={awaiting_file:'Waiting for the file',received:'Received',queued:'Automated check',in_review:'In human review',rejected:'Rejected by the automated check',failed:'Failed',expired:'Expired'};
export async function myUploads(context:Context):Promise<HTMLElement>{
 const root=el('section','panel my-uploads'),list=el('div',''),feedback=status();
 root.append(el('h2','','Your direct uploads'),feedback,list);
 async function load(){
  let uploads:OwnUpload[];try{uploads=(await context.api.json<{uploads:OwnUpload[]}>('/api/uploads')).uploads;}catch(error){feedback.textContent=explain(error);return;}
  list.replaceChildren(...(uploads.length?[]:[el('p','muted','No direct uploads yet.')]));
  for(const u of uploads){
   const notice=ownerNotice(u),row=el('article','my-upload',el('h3','',u.title??'Untitled upload'),el('div','queue-meta',LABEL[u.status]??u.status));
   if(notice){row.append(el('p','',notice.text));
    if(notice.canAppeal){const message=el('textarea');message.maxLength=500;message.rows=3;message.placeholder='What should the moderator know? (max 500 characters)';const send=button('Ask a moderator to review','button-secondary');
     send.addEventListener('click',async()=>{if(!validAppealMessage(message.value)){feedback.textContent='Write a short message first.';return;}send.disabled=true;try{await context.api.json('/api/uploads/'+u.id+'/appeal',{method:'POST',body:JSON.stringify({message:message.value}),headers:{'content-type':'application/json'}});feedback.textContent='Appeal sent.';await load();}catch(error){feedback.textContent=explain(error);send.disabled=false;}});
     row.append(message,el('div','actions',send));}}
   list.append(row);
  }
 }
 await load();return root;
}

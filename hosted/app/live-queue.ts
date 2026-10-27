// Live moderation queue: a big, priority-ordered list that updates whenever any moderator acts (long-poll on the
// queue event log), plus a detail pane with the 3D viewer, the automated screenshots, findings with zoomed crops
// (risky ones blurred until clicked), full decision history and claim/heartbeat/release/decision controls.
// Recording a decision here never approves by itself: approval still goes through the publisher step.
import './live-queue.css';
import {el,button,status,empty} from '../shared/dom.ts';
import {explain} from '../shared/http.ts';
import type {Context} from './types.ts';
import {canModerate} from './member-access.ts';
import {badge,blurByDefault,CATEGORY_LABEL,claimLabel,cropRect,eventsChangeQueue,groupImages,historyLine,keyAction,move,RISKY_IMAGE,sortQueue,waiting,type QueueDetail,type QueueEvent,type QueueItem} from './live-queue-model.ts';
const HEARTBEAT_MS=60_000;
export async function liveQueue(context:Context):Promise<HTMLElement>{
 const root=el('section','moderation-section'),feedback=status(),list=el('div','live-queue-list'),detail=el('div','queue-detail'),layout=el('div','live-queue',list,detail);
 list.setAttribute('role','listbox');list.setAttribute('aria-label','Models waiting for review');
 root.append(el('div','page-heading',el('h1','','Live review queue'),el('p','muted','Flagged models first, then the longest waiting. The list updates when anyone claims, releases or decides.')),feedback,el('p','queue-keys','Keys: ',el('kbd','','J'),' / ',el('kbd','','K'),' move · ',el('kbd','','Enter'),' open · ',el('kbd','','A'),' approve · ',el('kbd','','C'),' request changes · ',el('kbd','','R'),' reject · ',el('kbd','','Esc'),' release'),layout);
 detail.append(empty('Pick a model to review.','Opening a model claims it for 10 minutes so nobody else decides it at the same time.'));
 let active=true,items:QueueItem[]=[],selected:string|null=null,cursor=0,claim:{versionId:string;revision:number}|null=null,heartbeat:ReturnType<typeof setInterval>|null=null,disposeViewer:(()=>void)|null=null,detailRevision=0;
 const urls=new Map<string,string>(),signedUntil=new Map<string,number>();
 // Images come from short-lived signed storage URLs when the deployment can sign (bytes never pass the Worker);
 // local mode has no signing and falls back to the moderator-only byte route.
 const imageUrl=async(versionId:string,name:string)=>{const key=versionId+'/'+name;let u=urls.get(key);if(u&&(signedUntil.get(key)??Infinity)>Date.now())return u;
  try{const signed=await context.api.json<{url:string|null}>('/api/moderation/queue/'+versionId+'/image-url?name='+encodeURIComponent(name));if(signed.url&&/^https:\/\//.test(signed.url)){u=signed.url;urls.set(key,u);signedUntil.set(key,Date.now()+90_000);return u;}}catch{/* fall back */}
  {const bytes=await context.api.bytes('/api/moderation/queue/'+versionId+'/image?name='+encodeURIComponent(name));u=context.resources.create(new Blob([Uint8Array.from(bytes)],{type:name.startsWith('grid-')||name.startsWith('crop-')||name.startsWith('island-')?'image/jpeg':'image/png'}));urls.set(key,u);}return u;};
 const post=(path:string,payload:unknown)=>context.api.json<Record<string,unknown>>(path,{method:'POST',body:JSON.stringify(payload),headers:{'content-type':'application/json'}});
 const stopHeartbeat=()=>{if(heartbeat)clearInterval(heartbeat);heartbeat=null;};
 async function release(){if(!claim)return;const c=claim;claim=null;stopHeartbeat();try{await post('/api/moderation/queue/'+c.versionId+'/release',{revision:c.revision});}catch{/* claim may already be gone */}}
 context.resources.add(()=>{active=false;stopHeartbeat();disposeViewer?.();if(claim){const c=claim;claim=null;void context.api.json('/api/moderation/queue/'+c.versionId+'/release',{method:'POST',body:JSON.stringify({revision:c.revision}),headers:{'content-type':'application/json'},keepalive:true} as RequestInit).catch(()=>{});}document.removeEventListener('keydown',onKey);});

 function renderList(){
  const now=Date.now();list.replaceChildren();
  if(!items.length){list.append(empty('The queue is empty.','New uploads appear here after the automated checks.'));return;}
  for(const item of items){
   const b=badge(item),thumbs=el('div','queue-thumbs'),row=el('button','queue-row'+(item.claimedBy&&!item.mine&&(item.claimExpiresAt??0)>now?' claimed-other':''),thumbs,el('div','',el('h3','',item.title),el('div','queue-meta',el('span','queue-badge '+b.tone,b.label),el('span','',item.contributorName??'Unknown contributor'),el('span','','waiting '+waiting(now-item.enqueuedAt))),item.topFinding?el('div','queue-meta',(CATEGORY_LABEL[item.topFinding.category]??item.topFinding.category)+' · '+item.topFinding.band):'',claimLabel(item,now)?el('div','queue-meta',claimLabel(item,now)!):'',item.ownContent?el('div','queue-meta','Your own upload: someone else must review it'):''));
   row.type='button';row.setAttribute('role','option');row.setAttribute('aria-current',String(item.versionId===selected));row.addEventListener('click',()=>void open(item.versionId));
   for(let i=0;i<4;i++){const name=item.thumbnails[i];if(!name){thumbs.append(el('span',''));continue;}const img=el('img');img.alt='';img.loading='lazy';thumbs.append(img);void imageUrl(item.versionId,name).then(u=>{img.src=u;}).catch(()=>{});}
   list.append(row);
  }
 }
 async function loadList(){
  try{const data=await context.api.json<{items:QueueItem[];cursor:number}>('/api/moderation/queue');if(!active)return;items=sortQueue(data.items);cursor=Math.max(cursor,data.cursor);const flagged=items.filter(i=>i.reason==='flag'||i.reason==='incomplete').length;feedback.textContent=items.length+' waiting · '+flagged+' flagged · updated '+new Date().toLocaleTimeString();renderList();}
  catch(error){if(active)feedback.textContent=explain(error);}
 }
 async function poll(){
  while(active){
   try{const data=await context.api.json<{events:QueueEvent[];cursor:number}>('/api/moderation/queue/events?after='+cursor+'&wait=20');if(!active)return;cursor=data.cursor;if(eventsChangeQueue(data.events)){await loadList();if(selected&&data.events.some(e=>e.versionId===selected))void refreshDetail();}}
   catch{await new Promise(r=>setTimeout(r,5000));}
  }
 }
 async function open(versionId:string){
  if(claim&&claim.versionId!==versionId)await release();
  selected=versionId;renderList();disposeViewer?.();disposeViewer=null;
  const item=items.find(i=>i.versionId===versionId);
  if(item&&!item.ownContent&&!(claim&&claim.versionId===versionId)){
   try{const r=await post('/api/moderation/queue/'+versionId+'/claim',{});claim={versionId,revision:Number(r.revision)};stopHeartbeat();heartbeat=setInterval(()=>{if(!claim)return;void post('/api/moderation/queue/'+claim.versionId+'/heartbeat',{revision:claim.revision}).catch(()=>{feedback.textContent='Your claim on this model lapsed. Open it again to continue.';claim=null;stopHeartbeat();});},HEARTBEAT_MS);}
   catch(error){feedback.textContent=explain(error);}
  }
  await refreshDetail();
 }
 async function refreshDetail(){
  if(!selected)return;const own=++detailRevision,versionId=selected;
  let data:QueueDetail;try{data=await context.api.json<QueueDetail>('/api/moderation/queue/'+versionId);}catch(error){if(own===detailRevision)detail.replaceChildren(el('p','status',explain(error)));return;}
  if(own!==detailRevision||!active)return;
  const names:Record<string,string>={};for(const i of items){if(i.claimedBy&&i.claimedByName)names[i.claimedBy]=i.claimedByName;}names[context.member.id]='You';
  const report=data.safetyReports[0],viewer=el('div','queue-viewer'),loadViewer=button('Open 3D viewer','button-secondary');
  loadViewer.disabled=!data.hasModel;loadViewer.addEventListener('click',async()=>{loadViewer.disabled=true;try{const bytes=await context.api.bytes('/api/moderation/queue/'+versionId+'/model');const {mountViewer}=await import('./queue-viewer.ts');disposeViewer?.();disposeViewer=await mountViewer(viewer,bytes);}catch(error){viewer.replaceChildren(el('p','status',explain(error)));loadViewer.disabled=false;}});
  const parts:Node[]=[el('h2','',data.version?.title??'Model'),el('p','muted',[report?'Automated check: '+report.outcome+(report.shadow?' (shadow mode, findings shown but not enforced)':'')+' · policy '+report.policyVersion:'No automated report (submitted before checks).',data.upload?' · source: '+data.upload.source+' · '+Math.round(data.upload.bytes/1024)+' KB':''].join(''))];
  const notChecked=data.coverage?.notMachineChecked??[];
  if(notChecked.length)parts.push(el('p','queue-coverage','Not machine-checked yet: '+notChecked.map(c=>CATEGORY_LABEL[c]??c).join(', ')+'. Look for these yourself.'));
  parts.push(el('div','actions',loadViewer),viewer);
  // Findings with zoomed, blurred-by-default crops.
  const findings=el('div','queue-findings');
  for(const f of data.findings){
   const crop=el('canvas');crop.width=240;crop.height=240;const blurred=blurByDefault(f);if(blurred)crop.classList.add('blurred');crop.title=blurred?'Select to reveal':'';if(blurred){crop.tabIndex=0;crop.setAttribute('role','button');crop.setAttribute('aria-label','Blurred finding crop. Press Enter to reveal.');}const reveal=()=>{crop.classList.remove('blurred');crop.removeAttribute('role');crop.removeAttribute('aria-label');crop.title='';};crop.addEventListener('click',reveal);crop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal();}});
   if(f.artifactPath){void imageUrl(versionId,f.artifactPath).then(u=>{const img=new Image();img.onload=()=>{const ctx=crop.getContext('2d')!;const r=f.bbox?cropRect(f.bbox,img.naturalWidth,img.naturalHeight):{x:0,y:0,w:img.naturalWidth,h:img.naturalHeight};ctx.drawImage(img,r.x,r.y,r.w,r.h,0,0,240,240);if(f.bbox){const s=240/r.w;ctx.strokeStyle='#ff3b30';ctx.lineWidth=2;ctx.strokeRect((f.bbox[0]-r.x)*s,(f.bbox[1]-r.y)*s,(f.bbox[2]-f.bbox[0]+1)*s,(f.bbox[3]-f.bbox[1]+1)*s);}};img.src=u;}).catch(()=>{});}
   findings.append(el('div','queue-finding band-'+f.band,crop,el('div','',el('strong','',CATEGORY_LABEL[f.category]??f.category),el('div','queue-meta',el('span','queue-badge '+(f.band==='reject'?'danger':f.band==='flag'?'warning':'neutral'),f.band==='reject'?'reject band':f.band==='flag'?'flag band':'low'),el('span','',f.detector)),f.textSpan?el('p','',f.textSpan):'',f.artifactPath?el('div','queue-meta',f.artifactPath):'')));
  }
  if(data.findings.length)parts.push(el('h3','','Findings'),findings);else if(report)parts.push(el('p','muted','No findings from the automated check.'));
  // Screenshot gallery, grouped, lazily loaded, risky images blurred.
  for(const [group,list] of groupImages(data.images)){
   const gallery=el('div','queue-gallery');
   for(const name of list){const shot=el('button','queue-shot'+(RISKY_IMAGE(name,data.findings)?' blurred':''));shot.type='button';shot.title=name;const img=el('img');img.alt=name;img.loading='lazy';shot.append(img);
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void imageUrl(versionId,name).then(u=>{img.src=u;}).catch(()=>{});}});observer.observe(shot);context.resources.add(()=>observer.disconnect());
    shot.addEventListener('click',()=>{if(shot.classList.contains('blurred')){shot.classList.remove('blurred');return;}const box=el('div','queue-lightbox');const big=el('img');big.src=img.src;big.alt=name;box.append(big);box.addEventListener('click',()=>box.remove());document.body.append(box);});gallery.append(shot);}
   parts.push(el('details','',el('summary','',group+' ('+list.length+')'),gallery));
  }
  if(data.upload?.provenance)parts.push(el('details','',el('summary','','Provenance (untrusted, informational only)'),el('pre','',JSON.stringify(data.upload.provenance,null,2).slice(0,4000))));
  const history=el('ol','queue-history');for(const e of data.history)history.append(el('li','',new Date(e.createdAt).toLocaleString()+' — '+historyLine(e,names)));parts.push(el('h3','','History'),history);
  // Decision controls (only while you hold the claim).
  const mine=claim?.versionId===versionId,note=el('textarea');note.placeholder='Note (required for changes or rejection)';note.setAttribute('aria-label','Decision note');
  const decide=async(decision:'approve'|'changes_requested'|'reject')=>{if(!claim)return;try{const r=await post('/api/moderation/queue/'+versionId+'/decision',{revision:claim.revision,decision,note:note.value});claim=null;stopHeartbeat();feedback.textContent=decision==='approve'?'Recorded. Approval still needs the publisher step.':'Decision recorded. Apply it with the review tools.';void r;const nextId=move(items.filter(i=>i.versionId!==versionId),null,1);await loadList();if(nextId)void open(nextId);else{selected=null;detail.replaceChildren(empty('Queue cleared.','Nothing else is waiting.'));}}catch(error){feedback.textContent=explain(error);}};
  const approve=button('Approve (A)'),changes=button('Request changes (C)','button-secondary'),reject=button('Reject (R)','button-secondary danger'),rel=button('Release (Esc)','button-secondary');
  approve.addEventListener('click',()=>void decide('approve'));changes.addEventListener('click',()=>void decide('changes_requested'));reject.addEventListener('click',()=>void decide('reject'));rel.addEventListener('click',async()=>{await release();void refreshDetail();void loadList();});
  const controls=el('div','queue-decision');
  if(mine){controls.append(note,el('div','actions',approve,changes,reject,rel));
   if(context.member.capabilities.some(c=>c==='moderator'||c==='admin')&&report&&report.outcome!=='pass'){const clean=button('Automated result was wrong: clean','button-secondary'),viol=button('Confirm violation','button-secondary');const over=async(outcome:'clean'|'violation')=>{if(!claim)return;if(!note.value.trim()){feedback.textContent='Add a note explaining the override.';return;}try{await post('/api/moderation/queue/'+versionId+'/override',{revision:claim.revision,outcome,reason:note.value});feedback.textContent='Override recorded.';void refreshDetail();}catch(error){feedback.textContent=explain(error);}};clean.addEventListener('click',()=>void over('clean'));viol.addEventListener('click',()=>void over('violation'));controls.append(el('div','actions',clean,viol));}
  }else controls.append(el('p','muted',items.find(i=>i.versionId===versionId)?.ownContent?'This is your own upload, so another reviewer has to decide it.':'Open the model again to claim it before deciding.'));
  parts.push(controls);
  detail.replaceChildren(...parts);
 }
 function onKey(event:KeyboardEvent){
  const target=event.target as HTMLElement|null,typing=!!target&&(target.tagName==='TEXTAREA'||target.tagName==='INPUT'||target.isContentEditable);
  const action=keyAction(event.key,typing,!!claim&&claim.versionId===selected);if(!action)return;event.preventDefault();
  if(action==='next'||action==='previous'){selected=move(items,selected,action==='next'?1:-1);renderList();list.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({block:'nearest'});}
  else if(action==='open'&&selected)void open(selected);
  else if(action==='release')void release().then(()=>{void loadList();void refreshDetail();});
  else{const b=[...detail.querySelectorAll('button')].find(x=>x.textContent?.includes(action==='approve'?'(A)':action==='reject'?'(R)':'(C)'));b?.click();}
 }
 document.addEventListener('keydown',onKey);
 await loadList();void poll();
 if(canModerate(context.member))root.append(await (await import('./appeals-panel.ts')).appealsPanel(context,()=>void loadList()));
 return root;
}

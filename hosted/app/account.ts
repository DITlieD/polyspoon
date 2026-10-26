import {restrictionNotice,ownReports} from './member-safety.ts';
import {el,input,field,button,status,heading,empty,action,when} from '../shared/dom.ts';
import {explain} from '../shared/http.ts';
import type {Context} from './types.ts';
interface Token {id:string;label:string;scopes:string[];expiresAt:number;revokedAt:number|null}
interface Session {id:string;createdAt:string|number;updatedAt:string|number;expiresAt:string|number;current:boolean}
export async function account(context:Context){
 const root=el('section', '',heading('Your account','Manage this session and the access you grant your own tools.'));
 root.append(el('section','panel',el('h2','',context.member.displayName||'Member account'),el('p','muted',context.member.email||'Verified member'),el('p','',context.member.verified?'Email verified':'Email verification required')));
 root.append(await restrictionNotice(context),await ownReports(context));
 const tokenPanel=el('section','panel',el('h2','','Agent access')),feedback=status(),form=el('form'),label=input('label'),ttl=input('expires','number');label.maxLength=80;label.placeholder='My project agent';ttl.value='24';ttl.min='1';ttl.max='720';
 const scopes=[['catalog:read','Browse models'],['assets:read','Download files'],['votes:write','Vote'],['submissions:write','Submit work']],checks=el('div','checkboxes');
 for(const [scope,name] of scopes){const check=input(scope!,'checkbox',false);check.value=scope!;check.checked=['catalog:read','assets:read'].includes(scope!);checks.append(field(name!,check));}
 const create=el('button','button-secondary','Create access token');create.type='submit';const secret=status();
 form.append(field('Token name',label),field('Expires after (hours)',ttl),checks,create,feedback,secret);tokenPanel.append(el('p','muted','Choose only the actions this tool needs. The secret is shown once and is never stored in this page’s history.'),form);
 const tokens=el('div','list');tokenPanel.append(tokens);root.append(tokenPanel);
 async function refreshTokens(){
  try{const data=await context.api.json<{tokens:Token[]}>('/api/account/tokens');tokens.replaceChildren();if(!data.tokens.length)tokens.append(empty('No agent tokens yet.','Create a scoped token when your own tool needs catalog access.'));
   for(const token of data.tokens){const row=el('article','item',el('h3','',token.label),el('p','muted',token.revokedAt?'Revoked':'Expires '+when(token.expiresAt)),el('p','muted',token.scopes.map(s=>scopes.find(([id])=>id===s)?.[1]??s).join(', ')));
    if(!token.revokedAt){const revoke=button('Revoke token','button-secondary');revoke.addEventListener('click',()=>void action(revoke,feedback,async()=>{await context.api.json('/api/account/tokens/'+encodeURIComponent(token.id),{method:'DELETE'});feedback.textContent='Token revoked.';await refreshTokens();}));row.append(revoke);}tokens.append(row);
   }
  }catch(error){tokens.replaceChildren(status(explain(error)));}
 }
 form.addEventListener('submit',event=>{event.preventDefault();void action(create,feedback,async()=>{
  const selected=[...checks.querySelectorAll<HTMLInputElement>('input:checked')].map(c=>c.value);if(!selected.length){feedback.textContent='Choose at least one action.';return;}
  const result=await context.api.json<{token:string}>('/api/account/tokens',{method:'POST',body:JSON.stringify({label:label.value.trim(),scopes:selected,expiresInSeconds:Number(ttl.value)*3600})});
  const value=input('new-token','text',false);value.value=result.token;value.readOnly=true;value.setAttribute('aria-label','New token secret, copy now');value.addEventListener('focus',()=>value.select());secret.replaceChildren(el('strong','','Copy this secret now. It will not be shown again.'),value);feedback.textContent='Access token created.';await refreshTokens();
 });});
 await refreshTokens();
 const sessionsPanel=el('section','panel',el('h2','','Signed-in devices')),sessions=el('div','list'),sessionFeedback=status();sessionsPanel.append(sessions,sessionFeedback);root.append(sessionsPanel);
 try{
  const data=await context.api.json<{sessions:Session[]}>('/api/account/sessions');
  for(const session of data.sessions){const row=el('article','item',el('h3','',session.current?'This session':'Another signed-in session'),el('p','muted','Started '+when(session.createdAt)+' · expires '+when(session.expiresAt))),revoke=button(session.current?'Sign out here':'Revoke session','button-secondary');revoke.addEventListener('click',()=>void action(revoke,sessionFeedback,async()=>{await context.api.json('/api/account/sessions/'+encodeURIComponent(session.id),{method:'DELETE'});if(session.current)location.assign('/sign-in');else{row.remove();sessionFeedback.textContent='Session revoked.';}}));row.append(revoke);sessions.append(row);}
 }catch(error){sessions.append(status(explain(error)));}
 const all=button('Sign out all devices','button-secondary danger');all.addEventListener('click',()=>void action(all,sessionFeedback,async()=>{await context.api.json('/api/account/sessions',{method:'DELETE'});context.resources.clear();location.assign('/sign-in');}));sessionsPanel.append(el('div','actions',all));
 return root;
}

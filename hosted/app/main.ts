import '../shared/style.css';
import {MarketplaceClient,explain,ApiFailure} from '../shared/http.ts';
import {el,link,button,status,shell,heading} from '../shared/dom.ts';
import {Resources} from './types.ts';
import type {Context,Member} from './types.ts';
import {catalog,model} from './catalog.ts';
import {account} from './account.ts';
import {memberNavigation,canModerate,canAdminister,canReview} from './member-access.ts';
import {restrictionNotice} from './member-safety.ts';
import {communityModeration} from './community-moderation.ts';
import {contribute} from './contribute.ts';
import {profilePage,followingFeed,leaderboardPage} from './community.ts';
import {collectionsPage,collectionPage} from './collections.ts';
import {reviewQueue,administration} from './moderation.ts';
import {liveQueue} from './live-queue.ts';
const PRIMARY:Array<[string,string]>=[['Models','/catalog'],['Contribute','/contribute'],['Docs','/docs']];
function accountMenu(member:Member,links:Array<[string,string]>,logout:HTMLButtonElement){
 const name=member.displayName?.trim()||member.email?.split('@')[0]||'Account',menu=el('details','account-menu',el('summary','account-button',el('span','account-avatar',name.slice(0,1).toUpperCase()),el('span','account-name',name)),el('div','account-list',...links.map(([label,path])=>link(label,path)),logout));
 document.addEventListener('click',event=>{if(!menu.contains(event.target as Node))menu.open=false;});
 return menu;
}
const resources=new Resources();let generation=0;
const expired=()=>{generation++;resources.clear();document.body.replaceChildren(heading('Your session ended.','Sign in again to continue.'),link('Sign in','/sign-in','button'));location.replace('/sign-in?reason=session-expired');};
const refreshAccess=()=>{generation++;resources.clear();document.body.replaceChildren(heading('Checking your account access…','Your current permissions are being refreshed.'));void start();};
const api=new MarketplaceClient(location.origin,fetch,expired,refreshAccess);
window.addEventListener('pagehide',()=>{generation++;resources.clear();});
async function readMember(){
 const response=await fetch(new URL('/api/me',location.origin),{credentials:'same-origin',cache:'no-store'});
 if(response.status===401)return null;
 const value=await response.json().catch(()=>null) as {error?:string}|Member|null;
 if(!response.ok)throw new ApiFailure(response.status,value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'?value.error:'request_failed');
 return value as Member;
}
function openBrowse(){
 const params=new URLSearchParams(location.search),asset=/^\/asset\/([a-f0-9]{64})$/.exec(location.pathname);
 if(asset)return params.get('edit')==='1'?null:{kind:'model' as const,id:asset[1]!};
 if(location.pathname==='/catalog'&&!params.get('view'))return {kind:'catalog' as const};
 return null;
}
async function renderGuest(own:number){
 const browse=openBrowse();if(!browse){location.replace('/sign-in');return;}
 const guest:Member={id:'',status:'guest',verified:false,capabilities:[],scopes:null},main=shell([...PRIMARY,['Sign in','/sign-in']],true),context:Context={api,member:guest,resources};
 main.append(status('Loading…'));
 const content=browse.kind==='model'?await model(context,browse.id):await catalog(context);
 if(own===generation)main.replaceChildren(content);
}
async function start(){
 const own=++generation;
 try{
  const member=await readMember();if(own!==generation||!member){if(own===generation&&!member)await renderGuest(own);return;}
  const navigation=memberNavigation(member);if(member.status==='suspended')history.replaceState(null,'','/catalog?view=notice');
  const restricted=member.status==='suspended',main=shell(restricted?navigation:PRIMARY,true),logout=button('Sign out','account-signout');document.querySelector('.navigation')?.append(restricted?logout:accountMenu(member,navigation.filter(([,path])=>!PRIMARY.some(([,primary])=>primary===path)),logout));logout.addEventListener('click',async()=>{logout.disabled=true;try{await api.json('/api/auth/sign-out',{method:'POST',body:'{}'});resources.clear();location.assign('/sign-in');}catch(error){logout.disabled=false;main.prepend(status(explain(error)));}});
  main.append(status('Loading…'));const context:Context={api,member,resources,refreshAccess},view=new URLSearchParams(location.search).get('view');
  const selected=/^\/asset\/([a-f0-9]{64})$/.exec(location.pathname);
  const denied=(name:string)=>el('section','',heading(name+' access is required.','Your current account cannot open this page.'),link('Account','/catalog?view=account','button-secondary'));
  const content=member.status==='suspended'?await restrictionNotice(context):view==='moderation'?(canModerate(member)?await communityModeration(context):denied('Moderator')):view==='admin'?(canAdminister(member)?await administration(context):denied('Administrator')):selected?(new URLSearchParams(location.search).get('edit')==='1'?await (await import('./editor.ts')).editor(context,selected[1]!):await model(context,selected[1]!)):location.pathname==='/contribute'?await contribute(context):view==='account'?await account(context):view==='review'?(canReview(member)?await reviewQueue(context):denied('Review')):view==='queue'?(canReview(member)||canModerate(member)?await liveQueue(context):denied('Review')):view==='notice'?await restrictionNotice(context):view==='profile'?await profilePage(context):view==='following'?await followingFeed(context):view==='leaderboard'?await leaderboardPage(context):view==='collections'?await collectionsPage(context):view==='collection'?await collectionPage(context):await catalog(context);
  if(own===generation)main.replaceChildren(content);
 }catch(error){if(own!==generation)return;const main=shell([['Sign in','/sign-in'],['Help','/help']]);main.append(heading('We could not open this page.',explain(error)),link('Try again',location.pathname+location.search,'button-secondary'));}
}
void start();

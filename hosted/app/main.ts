import '../shared/style.css';
import {MarketplaceClient,explain} from '../shared/http.ts';
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
const resources=new Resources();let generation=0;
const expired=()=>{generation++;resources.clear();document.body.replaceChildren(heading('Your session ended.','Sign in again to continue.'),link('Sign in','/sign-in','button'));location.replace('/sign-in?reason=session-expired');};
const refreshAccess=()=>{generation++;resources.clear();document.body.replaceChildren(heading('Checking your account access…','Your current permissions are being refreshed.'));void start();};
const api=new MarketplaceClient(location.origin,fetch,expired,refreshAccess);
window.addEventListener('pagehide',()=>{generation++;resources.clear();});
async function start(){
 const own=++generation;
 try{
  const member=await api.json<Member>('/api/me');if(own!==generation)return;
  const navigation=memberNavigation(member);if(member.status==='suspended')history.replaceState(null,'','/catalog?view=notice');
  const main=shell(navigation,true),logout=button('Sign out','button-secondary');document.querySelector('.navigation')!.append(logout);logout.addEventListener('click',async()=>{logout.disabled=true;try{await api.json('/api/auth/sign-out',{method:'POST',body:'{}'});resources.clear();location.assign('/sign-in');}catch(error){logout.disabled=false;main.prepend(status(explain(error)));}});
  main.append(status('Loading…'));const context:Context={api,member,resources,refreshAccess},view=new URLSearchParams(location.search).get('view');
  const selected=/^\/asset\/([a-f0-9]{64})$/.exec(location.pathname);
  const denied=(name:string)=>el('section','',heading(name+' access is required.','Your current account cannot open this page.'),link('Account','/catalog?view=account','button-secondary'));
  const content=member.status==='suspended'?await restrictionNotice(context):view==='moderation'?(canModerate(member)?await communityModeration(context):denied('Moderator')):view==='admin'?(canAdminister(member)?await administration(context):denied('Administrator')):selected?(new URLSearchParams(location.search).get('edit')==='1'?await (await import('./editor.ts')).editor(context,selected[1]!):await model(context,selected[1]!)):location.pathname==='/contribute'?await contribute(context):view==='account'?await account(context):view==='review'?(canReview(member)?await reviewQueue(context):denied('Review')):view==='notice'?await restrictionNotice(context):view==='profile'?await profilePage(context):view==='following'?await followingFeed(context):view==='leaderboard'?await leaderboardPage(context):view==='collections'?await collectionsPage(context):view==='collection'?await collectionPage(context):await catalog(context);
  if(own===generation)main.replaceChildren(content);
 }catch(error){if(own!==generation)return;const main=shell([['Sign in','/sign-in'],['Help','/help']]);main.append(heading('We could not open this page.',explain(error)),link('Try again',location.pathname+location.search,'button-secondary'));}
}
void start();

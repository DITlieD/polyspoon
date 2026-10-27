import './community.css';
import {el,link,button,input,field,status,heading,empty,action,when} from '../shared/dom.ts';
import {explain,ApiFailure} from '../shared/http.ts';
import type {Context} from './types.ts';
import {addToCollection} from './collection-picker.ts';

export interface Profile {id:string;handle:string;displayName:string;bio:string;avatarHue:number;links:string[];joinedAt:number;accent?:string;flair?:string}
interface CosmeticOption {id:string;label:string;minLevel:number;unlocked:boolean}
interface Level {level:number;name:string;points:number;next:{level:number;name:string;min:number}|null}
interface Card {id:string;asset_id:string;title:string;votes:number;published_at:number;type:string|null;creator?:Profile}
interface ProfilePage {cosmetics?:{accents:CosmeticOption[];flairs:CosmeticOption[]};profile:Profile;self:boolean;following:boolean;moderatorEligible?:boolean;stats:{published:number;followers:number;following:number;votesReceived:number;downloads:number;remixedBy:number;remixesMade:number};points:{allTime:number;reputation:number;week:number;month:number};level:Level;badges:Array<{id:string;name:string;description:string}>;models:Card[]}
interface Board {period:string;category:string|null;categories:string[];entries:Array<{rank:number;points:number;level:Level;creator:Profile|null}>}
interface ModelCommunity {assetId:string;creator:Profile&{level:Level};self:boolean;votes:number;voted:boolean;favorited:boolean;favorites:number;following:boolean}

export const profileHref=(handle:string)=>'/catalog?view=profile&handle='+encodeURIComponent(handle);
export function initials(name:string){const parts=name.trim().split(/\s+/).filter(Boolean);return ((parts[0]?.[0]??'?')+(parts.length>1?parts.at(-1)![0]:'')).toUpperCase();}
export function avatar(profile:Pick<Profile,'displayName'|'avatarHue'>,size:'sm'|'lg'='sm'){const node=el('span','avatar avatar-'+size,initials(profile.displayName));node.style.background='hsl('+profile.avatarHue+' 55% 42%)';node.setAttribute('aria-hidden','true');return node;}
const levelPill=(level:Level,flair='none')=>el('span','pill level-pill'+(['glow','crown'].includes(flair)?' level-pill-animated flair-pill-'+flair:''),(flair==='crown'?'♛ ':'')+'Level '+level.level+' · '+level.name);
const plural=(n:number,one:string,many=one+'s')=>n+' '+(n===1?one:many);
function creatorLine(profile:Profile){const a=link('',profileHref(profile.handle),'creator-line');a.append(avatar(profile),el('span','',profile.displayName));return a;}
function cards(models:Card[]){const grid=el('div','community-grid');for(const m of models){grid.append(el('article','community-card',el('h3','',link(m.title,'/asset/'+encodeURIComponent(m.id))),m.creator?creatorLine(m.creator):el('span',''),el('p','muted',(m.type??'Unclassified')+' · '+plural(m.votes,'vote')+' · '+when(m.published_at))));}return grid;}
function followButton(context:Context,handle:string,state:{following:boolean},feedback:HTMLElement,onChange?:(followers:number)=>void){
 const b=button(state.following?'Following':'Follow',state.following?'button-secondary':'button');b.setAttribute('aria-pressed',String(state.following));
 b.addEventListener('click',()=>void action(b,feedback,async()=>{const r=await context.api.json<{following:boolean;followers:number}>('/api/community/profiles/'+encodeURIComponent(handle)+'/follow',{method:state.following?'DELETE':'PUT',...(state.following?{}:{body:'{}'})});state.following=r.following;b.textContent=r.following?'Following':'Follow';b.className=r.following?'button-secondary':'button';b.setAttribute('aria-pressed',String(r.following));feedback.textContent=r.following?'You now follow this creator.':'You unfollowed this creator.';onChange?.(r.followers);}));return b;
}

export async function profilePage(context:Context){
 let handle=new URLSearchParams(location.search).get('handle');
 if(!handle){const me=await context.api.json<{profile:Profile}>('/api/community/me');handle=me.profile.handle;history.replaceState(null,'',profileHref(handle));}
 const data=await context.api.json<ProfilePage>('/api/community/profiles/'+encodeURIComponent(handle)),root=el('section','community-profile'),feedback=status();
 const followerLabel=(n:number)=>n===1?'follower':'followers',followerCount=el('strong','',String(data.stats.followers)),followers=el('span','muted',followerLabel(data.stats.followers));
 const accent=data.profile.accent??'default',flair=data.profile.flair??'none',head=el('header','panel profile-head accent-'+accent,el('span','avatar-frame flair-'+flair,avatar(data.profile,'lg')),el('div','profile-copy',el('h1','',data.profile.displayName),el('p','muted','@'+data.profile.handle+' · joined '+when(data.profile.joinedAt)),data.profile.bio?el('p','',data.profile.bio):el('p','muted',data.self?'Add a short bio so people know what you make.':'No bio yet.'),el('div','actions',levelPill(data.level,flair),el('span','pill',Math.round(data.points.allTime)+' points'),...(data.moderatorEligible?[el('span','pill admin-hint','Moderator eligible (admin hint only)')]:[]))));
 if(data.profile.links.length){const links=el('p','profile-links');for(const url of data.profile.links){const a=link(new URL(url).host,url);a.rel='nofollow noopener noreferrer';a.target='_blank';links.append(a);}head.querySelector('.profile-copy')!.append(links);}
 if(!data.self)head.append(followButton(context,data.profile.handle,{following:data.following},feedback,n=>{followerCount.textContent=String(n);followers.textContent=followerLabel(n);}));
 root.append(head,feedback);
 const s=data.stats;root.append(el('div','stat-row',...[[String(s.published),'published models'],[String(s.votesReceived),'votes received'],[String(s.downloads),'downloads'],[String(s.remixedBy),data.self?'remixes of your work':'remixes of their work']].map(([n,l])=>el('div','stat',el('strong','',n!),el('span','muted',l!))),el('div','stat',el('strong','',String(s.following)),el('span','muted','following')),el('div','stat',followerCount,followers)));
 if(data.level.next)root.append(el('p','muted level-next',(data.level.next.min-Math.round(data.points.allTime))+' points to level '+data.level.next.level+' ('+data.level.next.name+'). Points come from reviewed, published models and from other members’ votes, remixes and downloads. They are recognition only and never skip review.'));
 const badgeList=el('section','panel',el('h2','','Badges'));if(data.badges.length){const ul=el('ul','badge-list');for(const b of data.badges){const li=el('li','badge',el('strong','',b.name),el('span','muted',b.description));ul.append(li);}badgeList.append(ul);}else badgeList.append(el('p','muted','Badges appear once reviewed models are published.'));root.append(badgeList);
 const work=el('section','panel',el('h2','','Published models'));work.append(data.models.length?cards(data.models):el('p','muted',data.self?'Your reviewed and published models will appear here.':'No published models yet.'));root.append(work);
 if(data.self)root.append(profileEditor(context,data.profile,data.cosmetics,data.level));
 return root;
}
function profileEditor(context:Context,profile:Profile,cosmetics:ProfilePage['cosmetics'],level:Level){
 const form=el('form','panel profile-edit'),feedback=status(),name=input('displayName'),handle=input('handle'),bio=el('textarea'),hue=input('avatarHue','range',false),links=input('links','text',false),preview=avatar(profile,'lg');
 name.value=profile.displayName;name.maxLength=60;handle.value=profile.handle;handle.pattern='[a-z0-9_-]{3,24}';bio.name='bio';bio.maxLength=500;bio.rows=3;bio.value=profile.bio;hue.min='0';hue.max='359';hue.value=String(profile.avatarHue);links.value=profile.links.join(' ');links.placeholder='https://… (up to 3, separated by spaces)';
 const repaint=()=>{preview.textContent=initials(name.value||profile.displayName);preview.style.background='hsl('+hue.value+' 55% 42%)';};name.addEventListener('input',repaint);hue.addEventListener('input',repaint);
 const picker=(name:string,options:CosmeticOption[],value:string)=>{const sel=el('select');sel.name=name;for(const o of options){const opt=el('option','',o.unlocked?o.label:o.label+' — unlocks at level '+o.minLevel);opt.value=o.id;opt.disabled=!o.unlocked;sel.append(opt);}sel.value=value;return sel;};
 const accentPick=picker('accent',cosmetics?.accents??[],profile.accent??'default'),flairPick=picker('flair',cosmetics?.flairs??[],profile.flair??'none');
 const save=el('button','button','Save profile');save.type='submit';
 form.append(el('h2','','Edit your profile'),el('div','row avatar-edit-row',preview,el('p','muted','Your avatar uses your initials and a colour you choose.')),field('Display name',name),field('Handle',handle),field('Bio',bio),field('Avatar colour',hue),field('Links',links),el('h3','','Cosmetic unlocks'),el('p','muted','You are level '+level.level+' ('+level.name+'). Higher levels unlock more profile colours and frames. They are decoration only and never affect review or votes.'),field('Profile accent',accentPick),field('Avatar frame',flairPick),save,feedback);
 form.addEventListener('submit',e=>{e.preventDefault();void action(save,feedback,async()=>{
  try{const r=await context.api.json<{profile:Profile}>('/api/community/me',{method:'PUT',body:JSON.stringify({displayName:name.value.trim(),handle:handle.value.trim().toLowerCase(),bio:bio.value,avatarHue:Number(hue.value),links:links.value.split(/\s+/).filter(Boolean),accent:accentPick.value,flair:flairPick.value})});location.assign(profileHref(r.profile.handle));}
  catch(error){feedback.textContent=error instanceof ApiFailure?({handle_taken:'That handle is taken.',invalid_handle:'Handles use 3–24 lowercase letters, numbers, - or _.',invalid_links:'Use up to three https:// links.',invalid_display_name:'Add a display name of up to 60 characters.',accent_locked:'That colour unlocks at a higher level.',flair_locked:'That frame unlocks at a higher level.'} as Record<string,string>)[error.code]??explain(error):explain(error);}
 });});return form;
}

export async function followingFeed(context:Context){
 const root=el('section','',heading('Following','New published models from the creators you follow.')),data=await context.api.json<{following:number;models:Card[]}>('/api/community/feed');
 if(!data.following)root.append(empty('You are not following anyone yet.','Open a creator’s profile from any model page or the leaderboard and press Follow.'),link('See the leaderboard','/catalog?view=leaderboard','button-secondary'));
 else if(!data.models.length)root.append(empty('Nothing new yet.','Models from the '+plural(data.following,'creator')+' you follow will appear here after review.'));
 else root.append(cards(data.models));return root;
}

export async function leaderboardPage(context:Context){
 const params=new URLSearchParams(location.search),period=['week','month','all'].includes(params.get('period')??'')?params.get('period')!:'month',category=params.get('category')??'';
 const data=await context.api.json<Board>('/api/community/leaderboard?period='+period+(category?'&category='+encodeURIComponent(category):'')),root=el('section','community-board',heading('Leaderboard','Creators ranked by points from reviewed models, votes, remixes and downloads. Rankings are for recognition only and never affect review.'));
 const form=el('form','board-filters');form.action='/catalog';form.method='get';const view=input('view','hidden',false);view.value='leaderboard';
 const select=(name:string,options:Array<[string,string]>,value:string)=>{const s=el('select');s.name=name;for(const [v,t] of options){const o=el('option','',t);o.value=v;s.append(o);}s.value=value;s.addEventListener('change',()=>form.requestSubmit());return s;};
 form.append(view,field('Period',select('period',[['week','This week'],['month','This month'],['all','All time']],period)),field('Category',select('category',[['','All categories'],...data.categories.map(c=>[c,c] as [string,string])],category)));root.append(form);
 if(!data.entries.length){root.append(empty('No ranked creators yet.','Rankings fill in as reviewed models are published and voted on.'));return root;}
 const list=el('ol','board-list');for(const entry of data.entries){if(!entry.creator)continue;list.append(el('li','board-row',el('span','board-rank','#'+entry.rank),creatorLine(entry.creator),levelPill(entry.level),el('strong','board-points',Math.round(entry.points)+' pts')));}root.append(list);return root;
}

/** Creator, follow and favourite controls for a published model page. */
export async function modelCommunity(context:Context,versionId:string){
 const box=el('div','model-community'),feedback=status();
 try{
  const data=await context.api.json<ModelCommunity>('/api/community/versions/'+encodeURIComponent(versionId));
  box.append(el('span','muted','By'),creatorLine(data.creator),levelPill(data.creator.level));
  if(!data.self)box.append(followButton(context,data.creator.handle,{following:data.following},feedback));
  const fav=button(data.favorited?'Saved':'Save to favourites','button-secondary');fav.setAttribute('aria-pressed',String(data.favorited));
  fav.addEventListener('click',()=>void action(fav,feedback,async()=>{const r=await context.api.json<{favorited:boolean}>('/api/community/favorites/'+encodeURIComponent(data.assetId),{method:data.favorited?'DELETE':'PUT',...(data.favorited?{}:{body:'{}'})});data.favorited=r.favorited;fav.textContent=r.favorited?'Saved':'Save to favourites';fav.setAttribute('aria-pressed',String(r.favorited));feedback.textContent=r.favorited?'Saved to your favourites.':'Removed from favourites.';}));
  box.append(fav,feedback);
  const curate=await addToCollection(context,data.assetId);if(curate)box.append(curate);
 }catch(error){box.append(el('span','muted','Creator details are unavailable: '+explain(error)));}
 return box;
}

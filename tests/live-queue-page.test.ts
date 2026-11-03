import test from 'node:test';
import assert from 'node:assert/strict';
import {communityModeration} from '../server/community-moderation.ts';
import {HttpError,type Principal} from '../server/domain.ts';
import type {Env} from '../server/types.ts';
import type {Context,Member} from '../hosted/app/types.ts';
import {register} from 'node:module';

class DomNode {
 tagName: string;
 className='';
 children: unknown[]=[];
 attrs: Record<string,string>={};
 _text: string | null = null;
 disabled=false; value=''; placeholder=''; rows=0; maxLength=0; type=''; decoding=''; alt=''; src=''; title='';
 classList={add(){},remove(){},contains(){return false;}};
 constructor(tag: string){this.tagName=tag.toUpperCase();}
 append(...kids: unknown[]){this.children.push(...kids);}
 setAttribute(name: string, value: string){this.attrs[name]=value;}
 getAttribute(name: string){return this.attrs[name] ?? null;}
 addEventListener(){}
 removeEventListener(){}
 focus(){}
 replaceChildren(...kids: unknown[]){this.children=[...kids]; this._text=null;}
 get textContent(){return this._text ?? '';}
 set textContent(value: string){this._text=String(value);}
}

function installDom(){
 const document={createElement:(tag: string)=>new DomNode(tag),body:new DomNode('body'),addEventListener(){},removeEventListener(){}};
 Object.assign(globalThis,{document});
}

function textOf(node: unknown): string{
 if(typeof node==='string')return node;
 if(!node||typeof node!=='object')return '';
 const item=node as DomNode;
 return [item._text ?? '',...item.children.map(textOf)].filter(Boolean).join('\n');
}

const member: Member={id:'moderator',status:'active',verified:true,capabilities:['moderator'],scopes:null};
const actor={id:'moderator',status:'active',verified:true,capabilities:[],scopes:undefined} as Principal;

test('upload appeal list bypasses the member appeal route',async()=>{
 const response=await communityModeration(new Request('https://preflight.polyspoon.com/api/moderation/appeals?upload=1'),{} as Env,actor,'/api/moderation/appeals');
 assert.equal(response,null);
});

test('member appeal list still requires moderation access',async()=>{
 await assert.rejects(()=>communityModeration(new Request('https://preflight.polyspoon.com/api/moderation/appeals'),{} as Env,actor,'/api/moderation/appeals'),(error: unknown)=>error instanceof HttpError&&error.status===403&&error.code==='moderation_capability_required');
});

test('live queue stays up when appeals and a thumbnail fail',async()=>{
 installDom();
 register('./css-stub-hook.mjs', {parentURL: import.meta.url});
 const {liveQueue}=await import('../hosted/app/live-queue.ts');
 const {appealsPanel}=await import('../hosted/app/appeals-panel.ts');
 let stop=()=>{};
 let events=0;
 const version='a'.repeat(64);
 let appeals:unknown[]=[{id:'member-appeal',message:'Please reinstate',createdAt:1}];
 const api={async json(path: string){
  if(path==='/api/moderation/queue')return {cursor:3,items:[{versionId:version,priority:80,reason:'flag',revision:1,enqueuedAt:1,claimExpiresAt:null,claimedBy:null,claimedByName:null,title:'Waiting chair',kind:'prop',contributorId:'c',contributorName:'Ada',safetyOutcome:null,safetyShadow:null,mine:false,ownContent:false,thumbnails:undefined,topFinding:null},{versionId:'b'.repeat(64),priority:10,reason:'pass',revision:1,enqueuedAt:2,claimExpiresAt:null,claimedBy:null,claimedByName:null,title:'Thumb fails',kind:'prop',contributorId:'c',contributorName:'Ada',safetyOutcome:null,safetyShadow:null,mine:false,ownContent:false,thumbnails:['view.png'],topFinding:null}]};
  if(path.startsWith('/api/moderation/queue/events')){events+=1;if(events>1)stop();return {events:[],cursor:3};}
  if(path.startsWith('/api/moderation/queue/')&&path.includes('image-url'))throw new Error('image down');
  if(path==='/api/moderation/appeals?upload=1')return {appeals};
  throw new Error('unexpected '+path);
 },async bytes(){throw new Error('bytes down');}};
 const context={api,member,resources:{add(fn: ()=>void){stop=fn;return ()=>{};},create(){return 'blob:test';},clear(){},release(){}}} as unknown as Context;
 const page=await liveQueue(context);
 stop();
 const text=textOf(page);
 assert.match(text,/Live review queue/);
 assert.match(text,/Waiting chair/);
 assert.match(text,/Thumb fails/);
 assert.match(text,/Automated rejection appeals could not be loaded/);
 assert.doesNotMatch(text,/We could not open this page/);
 appeals=[{uploadId:'u',versionId:version,title:'Chair',reason:'sexual_content',message:null,filed:true,ownContent:false,createdAt:1,rejectedAt:1,ownerName:'Ada',findings:[{category:'sexual_content',band:'reject',detector:'stub',textSpan:null}]}];
 const appeal=await appealsPanel(context,()=>{});
 const appealText=textOf(appeal);
 assert.match(appealText,/Reopen for review/);
 assert.match(appealText,/Chair/);
 assert.match(appealText,/sexual content/);
});

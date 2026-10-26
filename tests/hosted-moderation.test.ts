import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketplaceClient,ApiFailure,explain} from '../hosted/shared/http.ts';
import {reportModel,submitAppeal,resolveReport,resolveAppeal,addAddressBlock,removeAddressBlock,ModerationInputError} from '../hosted/app/moderation-actions.ts';
import {memberNavigation,canModerate,canAdminister,canReview} from '../hosted/app/member-access.ts';
import type {Member} from '../hosted/app/types.ts';

test('moderation actions send only contract fields and exact reasoned decisions',async()=>{
 const calls:Array<{path:string;method:string;body:unknown}>=[],api=new MarketplaceClient('https://polyspoon.example',async(url,options)=>{calls.push({path:new URL(String(url)).pathname,method:options?.method??'GET',body:options?.body?JSON.parse(String(options.body)):null});return Response.json({id:'record',status:'open',resolved:true,removed:true});});
 await reportModel(api,'a'.repeat(64),'rights','  Ownership issue  ');await submitAppeal(api,'  Please review the evidence  ');await resolveReport(api,'report-id','withdraw','Evidence confirms the report');await resolveAppeal(api,'appeal-id','reinstate','Restriction reversed');await addAddressBlock(api,' 192.0.2.1 ','Temporary abuse control',60);await removeAddressBlock(api,'block-id');
 assert.deepEqual(calls,[{path:'/api/catalog/'+'a'.repeat(64)+'/reports',method:'POST',body:{category:'rights',reason:'Ownership issue'}},{path:'/api/account/appeals',method:'POST',body:{message:'Please review the evidence'}},{path:'/api/moderation/reports/report-id/resolve',method:'POST',body:{decision:'withdraw',reason:'Evidence confirms the report'}},{path:'/api/moderation/appeals/appeal-id/resolve',method:'POST',body:{decision:'reinstate',reason:'Restriction reversed'}},{path:'/api/admin/address-blocks',method:'POST',body:{address:'192.0.2.1',reason:'Temporary abuse control',expiresInSeconds:60}},{path:'/api/admin/address-blocks/block-id',method:'DELETE',body:null}]);
});

test('empty, oversized and unsupported moderation inputs make no request',async()=>{
 let calls=0;const api=new MarketplaceClient('https://polyspoon.example',async()=>{calls++;return Response.json({});});
 for(const work of [()=>reportModel(api,'bad','rights','Reason'),()=>reportModel(api,'a'.repeat(64),'ban','Reason'),()=>reportModel(api,'a'.repeat(64),'other',' '),()=>submitAppeal(api,'x'.repeat(1001)),()=>resolveReport(api,'id','suspend','Reason'),()=>resolveAppeal(api,'id','withdraw','Reason'),()=>addAddressBlock(api,'192.0.2.1','Reason',59),()=>addAddressBlock(api,'192.0.2.1','Reason',86401),()=>removeAddressBlock(api,' ')])await assert.rejects(work,ModerationInputError);
 assert.equal(calls,0);
});

test('maximum message and expiring block bounds stay available',async()=>{
 const api=new MarketplaceClient('https://polyspoon.example',async()=>Response.json({}));await submitAppeal(api,'x'.repeat(1000));await addAddressBlock(api,'2001:db8::1','Reason',86400);
});

test('restricted and scoped members never receive moderator/admin/catalog navigation',()=>{
 const member:Member={id:'member',status:'active',verified:true,capabilities:['admin','moderator'],scopes:null};assert.equal(canModerate(member),true);assert.equal(canAdminister(member),true);assert.ok(memberNavigation(member).some(([,path])=>path.includes('moderation')));
 const restricted={...member,status:'suspended'};assert.equal(canModerate(restricted),false);assert.equal(canAdminister(restricted),false);assert.deepEqual(memberNavigation(restricted),[['Account notice','/catalog?view=notice']]);assert.equal(canModerate({...member,scopes:['catalog:read']}),false);assert.equal(canAdminister({...member,capabilities:['moderator']}),false);assert.equal(canReview({...member,capabilities:['publisher']}),true);assert.equal(canReview({...member,capabilities:[]}),false);assert.equal(canReview({...member,status:'suspended',capabilities:['publisher']}),false);
});

test('restriction and role loss invalidate stale data without impersonating expired authentication',async()=>{
 let lost=0,changed=0;const api=new MarketplaceClient('https://polyspoon.example',async url=>Response.json({error:String(url).endsWith('/restricted')?'account_restricted':'moderation_capability_required'},{status:403}),()=>lost++,()=>changed++);
 await assert.rejects(()=>api.json('/api/restricted'),ApiFailure);await assert.rejects(()=>api.json('/api/moderator'),ApiFailure);assert.equal(lost,0);assert.equal(changed,2);
 const network=new MarketplaceClient('https://polyspoon.example',async()=>Response.json({error:'address_temporarily_blocked'},{status:403}),()=>lost++,()=>changed++);await assert.rejects(()=>network.json('/api/report'),ApiFailure);assert.equal(changed,2);assert.match(explain(new ApiFailure(403,'address_temporarily_blocked')),/network|address/i);
});

test('an authority change rejects a successful private response that arrived from the prior access state',async()=>{
 let finish:((value:Response)=>void)|undefined,changed=0,lost=0;const api=new MarketplaceClient('https://polyspoon.example',async url=>String(url).endsWith('/slow')?new Promise(done=>{finish=done;}):Response.json({error:'capability_required'},{status:403}),()=>lost++,()=>changed++);
 const pending=api.json('/api/slow');await new Promise(done=>setTimeout(done,0));await assert.rejects(()=>api.json('/api/admin'),ApiFailure);finish!(Response.json({privateQueue:['old authority']}));await assert.rejects(()=>pending,/session_changed/);assert.equal(changed,1);assert.equal(lost,0);
});

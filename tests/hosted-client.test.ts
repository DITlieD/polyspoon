import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketplaceClient,ApiFailure} from '../hosted/shared/http.ts';

test('hosted requests include real session credentials and no-store, and cannot fetch another origin',async()=>{
 let called:RequestInit|undefined;const client=new MarketplaceClient('https://polyspoon.example',async(_url,options)=>{called=options;return Response.json({id:'member'});});
 assert.deepEqual(await client.json('/api/me'),{id:'member'});assert.equal(called?.credentials,'same-origin');assert.equal(called?.cache,'no-store');
 await assert.rejects(()=>client.json('https://other.example/api/me'),/same-origin/);
});

test('session loss clears private resources and rejects stale successful requests',async()=>{
 let finish:((response:Response)=>void)|undefined,lost=0;
 const client=new MarketplaceClient('https://polyspoon.example',async url=>String(url).endsWith('/slow')?new Promise(resolve=>{finish=resolve;}):Response.json({error:'authentication_required'},{status:401}),()=>{lost++;});
 const pending=client.json('/api/slow');await new Promise(resolve=>setTimeout(resolve,0));await assert.rejects(()=>client.json('/api/me'),ApiFailure);assert.equal(lost,1);finish!(Response.json({models:['private']}));await assert.rejects(()=>pending,/session/i);
});

test('unavailable and restricted APIs retain truthful error codes rather than sample data',async()=>{
 const client=new MarketplaceClient('https://polyspoon.example',async()=>Response.json({error:'mail_provider_unconfigured'},{status:503}));
 await assert.rejects(()=>client.json('/api/auth/sign-in/magic-link',{method:'POST',body:JSON.stringify({email:'member@example.test'})}),(error:unknown)=>error instanceof ApiFailure&&error.status===503&&error.code==='mail_provider_unconfigured');
});

test('default transport calls native fetch without a client receiver',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async function(this:unknown){assert.equal(this,undefined);return Response.json({ok:true});};
 try{assert.deepEqual(await new MarketplaceClient('https://polyspoon.example').json('/api/me'),{ok:true});}finally{globalThis.fetch=original;}
});

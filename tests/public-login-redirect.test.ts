import test from 'node:test';
import assert from 'node:assert/strict';
import {publicResponse} from '../server/public.ts';
import type {Env} from '../server/types.ts';

test('common login paths redirect to the email sign-in page without touching assets',async()=>{
 for(const path of ['/login','/signin','/log-in'])for(const method of ['GET','HEAD']){
  const response=await publicResponse(new Request('https://preflight.polyspoon.test'+path,{method}),{} as Env);
  assert.ok(response,path);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/sign-in');assert.equal(response.headers.get('cache-control'),'no-store');
 }
 assert.equal(await publicResponse(new Request('https://preflight.polyspoon.test/login',{method:'POST'}),{} as Env),null);
 assert.equal(await publicResponse(new Request('https://preflight.polyspoon.test/login/extra'),{} as Env),null);
});

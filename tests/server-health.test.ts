import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import worker from '../server/worker.ts';
import type {Env} from '../server/types.ts';

test('health distinguishes storage configuration from unverified live readiness',async()=>{
 const original=globalThis.fetch;let providerCalls=0,databaseCalls=0;globalThis.fetch=async()=>{providerCalls++;throw Error('Health must not contact a provider');};
 const base={APP_ENV:'production',APP_ORIGIN:'https://polyspoon.com',AUTH_SECRET:'synthetic-not-a-production-secret',DB:{prepare(){databaseCalls++;throw Error('Health must not query the database');}}} as unknown as Env;
 const configured={...base,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_KEY:'synthetic-not-a-real-key',SUPABASE_PRIVATE_BUCKET:'fixture-private'};
 const cases:[string,Env,string][]=[['production configured',configured,'supabase-configured'],['production absent',base,'unconfigured'],['production missing key',{...configured,SUPABASE_SERVICE_KEY:''},'unconfigured'],['production invalid URL',{...configured,SUPABASE_URL:'http://fixture.supabase.co'},'unconfigured'],['production invalid bucket',{...configured,SUPABASE_PRIVATE_BUCKET:'invalid/path'},'unconfigured'],['production cannot use local bucket',{...base,LOCAL_OBJECTS:{} as Env['LOCAL_OBJECTS']},'unconfigured'],['local simulation',{...base,APP_ENV:'local',APP_ORIGIN:'http://127.0.0.1:8798',LOCAL_OBJECTS:{} as Env['LOCAL_OBJECTS']},'local-simulation']];
 const evidence:unknown[]=[];
 try{
  for(const [name,env,expected] of cases){const response=await worker.fetch(new Request(env.APP_ORIGIN+'/health'),env);assert.equal(response.status,200);const body=await response.json() as {status:string;privateStorage:string;privateStorageCheck:string};assert.equal(body.status,'ok');assert.equal(body.privateStorage,expected);assert.equal(body.privateStorageCheck,'configuration-only');const text=JSON.stringify(body);for(const value of ['synthetic-not-a-real-key','fixture.supabase.co','fixture-private','synthetic-not-a-production-secret'])assert.ok(!text.includes(value));evidence.push({case:name,status:response.status,body});}
  assert.equal(providerCalls,0);assert.equal(databaseCalls,0);await writeFile('server/test-evidence/health-configuration.json',JSON.stringify({synthetic:true,evidence,providerCalls,databaseCalls,liveReadinessVerified:false},null,2)+'\n');
 }finally{globalThis.fetch=original;}
});

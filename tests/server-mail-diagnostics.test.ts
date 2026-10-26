import test from 'node:test';
import assert from 'node:assert/strict';
import {sendLoginMail} from '../server/mail.ts';
import type {Env} from '../server/types.ts';

test('failed login mail records bounded provider diagnostics without private values or retry',{concurrency:false},async()=>{
 const originalFetch=globalThis.fetch,originalError=console.error;
 const diagnostics:unknown[][]=[];let reservations=0,calls=0;
 const DB={prepare:()=>({bind:()=>({run:async()=>{reservations++;return {success:true};}})})} as unknown as Env['DB'];
 const env={APP_ENV:'production',APP_ORIGIN:'https://polyspoon.com',DB,RESEND_API_KEY:'private-key-marker',MAIL_FROM:'Polyspoon <login@polyspoon.com>'} as Env;
 const privateEmail='private-recipient-marker@example.invalid',privateUrl='https://polyspoon.com/private-token-marker';
 let provider=async()=>Response.json({name:'validation_error',message:privateEmail+' '+privateUrl+' '+env.RESEND_API_KEY},{status:403});
 globalThis.fetch=async()=>{calls++;return provider();};console.error=(...args)=>{diagnostics.push(args);};
 try{
  await assert.rejects(()=>sendLoginMail(env,privateEmail,privateUrl),/mail_provider_unavailable/);
  assert.deepEqual(diagnostics.at(-1),['Login mail provider failed',{stage:'http',status:403,code:'validation_error'}]);
  provider=async()=>new Response('error code: 1010',{status:403});
  await assert.rejects(()=>sendLoginMail(env,privateEmail,privateUrl),/mail_provider_unavailable/);
  assert.deepEqual(diagnostics.at(-1),['Login mail provider failed',{stage:'http',status:403,code:'cloudflare_1010'}]);
  provider=async()=>Response.json({name:env.RESEND_API_KEY,message:privateUrl},{status:429});
  await assert.rejects(()=>sendLoginMail(env,privateEmail,privateUrl),/mail_quota_reached/);
  assert.deepEqual(diagnostics.at(-1),['Login mail provider failed',{stage:'http',status:429,code:'unknown_provider_error'}]);
  provider=async()=>new Response('x'.repeat(5000),{status:503});
  await assert.rejects(()=>sendLoginMail(env,privateEmail,privateUrl),/mail_provider_unavailable/);
  assert.deepEqual(diagnostics.at(-1),['Login mail provider failed',{stage:'http',status:503,code:'unknown_provider_error'}]);
  provider=async()=>{throw TypeError(privateUrl+' '+env.RESEND_API_KEY);};
  await assert.rejects(()=>sendLoginMail(env,privateEmail,privateUrl),/mail_provider_unavailable/);
  assert.deepEqual(diagnostics.at(-1),['Login mail provider failed',{stage:'transport',status:null,code:'TypeError'}]);
  provider=async()=>Response.json({id:'synthetic-success'});
  await sendLoginMail(env,privateEmail,privateUrl);
  assert.equal(diagnostics.length,5);assert.equal(calls,6);assert.equal(reservations,6);
  const log=JSON.stringify(diagnostics);for(const value of [privateEmail,privateUrl,env.RESEND_API_KEY])assert.equal(log.includes(value!),false);
 }finally{globalThis.fetch=originalFetch;console.error=originalError;}
});

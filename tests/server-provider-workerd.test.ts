import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Response as RuntimeResponse} from '../server/node_modules/miniflare/dist/src/index.js';

test('production provider adapters use supported Worker redirects and never forward credentials to redirect targets',{timeout:30000},async()=>{
 const bundled=await build({stdin:{resolveDir:process.cwd(),contents:`
import {sendLoginMail} from './server/mail.ts';
import {privateObjects} from './server/storage.ts';
let reservations=0;
const DB={prepare(){return {bind(){return {async run(){reservations++;return {success:true};}};}};}};
const env={DB,APP_ENV:'production',APP_ORIGIN:'https://polyspoon.com',AUTH_SECRET:'synthetic-secret-not-a-production-credential',RESEND_API_KEY:'synthetic-mail-key',MAIL_FROM:'Polyspoon <login@polyspoon.com>',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_KEY:'synthetic-storage-key',SUPABASE_PRIVATE_BUCKET:'private-fixture'};
export default {async fetch(request){try{const path=new URL(request.url).pathname;if(path==='/mail'){await sendLoginMail(env,'fixture@example.invalid','https://polyspoon.com/synthetic-link');return Response.json({sent:true,reservations});}const objects=privateObjects(env);if(path==='/read')return Response.json({bytes:Array.from(await objects.read('fixture')??[])});return Response.json({stored:await objects.putIfAbsent('fixture',new Uint8Array([1,2,3]))});}catch(error){return Response.json({error:error.code,reservations}, {status:error.status??500});}}};
`},bundle:true,write:false,format:'esm',platform:'browser',external:['node:*'],target:'es2022',legalComments:'none'});
 let status=200,bucketRedirect=false;
 const outbound:Array<{host:string;path:string;method:string;authorization:boolean;apiKey:boolean}>=[];
 const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-23',compatibilityFlags:['nodejs_compat'],script:bundled.outputFiles[0]!.text,outboundService:async request=>{
  const url=new URL(request.url);outbound.push({host:url.hostname,path:url.pathname,method:request.method,authorization:request.headers.has('authorization'),apiKey:request.headers.has('apikey')});
  if(url.hostname==='redirect.invalid')return new RuntimeResponse('credential leak',{status:500});
  if(url.pathname.includes('/bucket/')&&!bucketRedirect)return new RuntimeResponse(JSON.stringify({public:false}),{headers:{'content-type':'application/json'}});
  if(status>=300&&status<400)return new RuntimeResponse(null,{status,headers:{location:'https://redirect.invalid/leak'}});
  return new RuntimeResponse(url.hostname==='api.resend.com'?'{}':new Uint8Array([1,2,3]),{status});
 }}));
 try{
  const sent=await runtime.dispatchFetch('https://fixture.invalid/mail');assert.equal(sent.status,200);assert.equal((await sent.json() as {sent:boolean}).sent,true);assert.equal(outbound.length,1);
  const read=await runtime.dispatchFetch('https://fixture.invalid/read');assert.equal(read.status,200);assert.deepEqual(await read.json(),{bytes:[1,2,3]});
  const stored=await runtime.dispatchFetch('https://fixture.invalid/put');assert.equal(stored.status,200);assert.deepEqual(await stored.json(),{stored:true});
  for(const redirect of [301,302,303,307,308]){
   status=redirect;
   for(const path of ['/mail','/read','/put']){const response=await runtime.dispatchFetch('https://fixture.invalid'+path);assert.equal(response.status,503);assert.ok(['mail_provider_unavailable','storage_provider_unavailable'].includes((await response.json() as {error:string}).error));}
   bucketRedirect=true;const bucket=await runtime.dispatchFetch('https://fixture.invalid/read');assert.equal(bucket.status,503);bucketRedirect=false;
  }
  status=429;assert.equal((await runtime.dispatchFetch('https://fixture.invalid/mail')).status,429);assert.equal((await runtime.dispatchFetch('https://fixture.invalid/read')).status,503);
  assert.equal(outbound.filter(x=>x.host==='redirect.invalid').length,0);assert.ok(outbound.filter(x=>x.host==='api.resend.com').every(x=>x.authorization&&!x.apiKey));assert.ok(outbound.filter(x=>x.host==='fixture.supabase.co').every(x=>x.authorization&&x.apiKey));
 }finally{await runtime.dispose();}
});

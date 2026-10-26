import type {Env} from './types.ts';
import {reserveMail} from './budgets.ts';
import {HttpError} from './domain.ts';
import {bytes} from './input.ts';
async function providerErrorCode(response:Response){
 try{
  const body=new TextDecoder().decode(await bytes(response,4096));if(/^error code: 1010\s*$/.test(body))return 'cloudflare_1010';const value=JSON.parse(body) as {name?:unknown};
  const codes=['validation_error','missing_required_field','restricted_api_key','invalid_api_key','not_found','method_not_allowed','invalid_attachment','invalid_access','invalid_parameter','rate_limit_exceeded','daily_quota_exceeded','monthly_quota_exceeded','application_error','internal_server_error'];
  if(typeof value?.name==='string'&&codes.includes(value.name))return value.name;
 }catch{}
 return 'unknown_provider_error';
}
export function localMailEnabled(env:Env):boolean {
 const host=new URL(env.APP_ORIGIN).hostname;
 return env.APP_ENV==='local'&&env.LOCAL_MAIL_SINK==='1'&&['127.0.0.1','localhost','[::1]'].includes(host);
}
export function mailConfigured(env:Env){return localMailEnabled(env)||(env.APP_ENV==='production'&&!!env.RESEND_API_KEY&&!!env.MAIL_FROM);}
export async function sendLoginMail(env:Env,email:string,url:string){
 if(!mailConfigured(env))throw new HttpError(503,'mail_provider_unconfigured');
 await reserveMail(env);
 if(localMailEnabled(env)){
  await env.DB.prepare('INSERT INTO local_mail_outbox(id,recipient,url,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),email,url,Date.now()).run();return;
 }
 if(env.APP_ENV!=='production'||!env.RESEND_API_KEY||!env.MAIL_FROM)throw new HttpError(503,'mail_provider_unconfigured');
 let response:Response;try{response=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'manual',headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:'Sign in to Polyspoon',text:'Use this single-use link to sign in to Polyspoon. It expires in five minutes.\n\n'+url})});}catch(error){const name=error instanceof Error&&['Error','TypeError','AbortError','TimeoutError'].includes(error.name)?error.name:'unknown_transport_error';console.error('Login mail provider failed',{stage:'transport',status:null,code:name});throw new HttpError(503,'mail_provider_unavailable');}
 if(!response.ok){console.error('Login mail provider failed',{stage:'http',status:response.status,code:await providerErrorCode(response)});if(response.status===429)throw new HttpError(429,'mail_quota_reached');throw new HttpError(503,'mail_provider_unavailable');}
}

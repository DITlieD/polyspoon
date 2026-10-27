import type {Env,PrivateObjects} from './types.ts';
import {HttpError} from './domain.ts';
import {bytes} from './input.ts';

export function privateObjects(env:Env):PrivateObjects {
 if(env.APP_ENV==='local'&&env.LOCAL_OBJECTS){
  const bucket=env.LOCAL_OBJECTS;
  return {
   async read(key){const object=await bucket.get(key);if(object&&object.size>2*1024*1024)throw new HttpError(413,'object_too_large');return object?new Uint8Array(await object.arrayBuffer()):null;},
   async putIfAbsent(key,data){return (await bucket.put(key,Uint8Array.from(data),{onlyIf:{etagDoesNotMatch:'*'}}))!==null;},
   async readUpTo(key,limit){const object=await bucket.get(key);if(object&&object.size>limit)throw new HttpError(413,'object_too_large');return object?new Uint8Array(await object.arrayBuffer()):null;},
  };
 }
 if(env.APP_ENV!=='production'||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_KEY||!env.SUPABASE_PRIVATE_BUCKET)throw new HttpError(503,'private_storage_unconfigured');
 let origin:URL;try{origin=new URL(env.SUPABASE_URL);}catch{throw new HttpError(503,'private_storage_unconfigured');}
 if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co')||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!/^[a-zA-Z0-9_.-]{1,63}$/.test(env.SUPABASE_PRIVATE_BUCKET))throw new HttpError(503,'private_storage_unconfigured');
 const key=env.SUPABASE_SERVICE_KEY,bucket=encodeURIComponent(env.SUPABASE_PRIVATE_BUCKET),headers:Record<string,string>={apikey:key};if(!key.startsWith('sb_secret_'))headers.authorization='Bearer '+key;
 const endpoint=origin.origin+'/storage/v1';let privateChecked:Promise<void>|undefined;
 async function provider(path:string,options:RequestInit={}){
  let response:Response;try{response=await fetch(endpoint+path,{...options,redirect:'manual',headers:{...headers,...options.headers}});}catch{throw new HttpError(503,'storage_provider_unavailable');}
  if(response.status===429||response.status===402)throw new HttpError(503,'storage_quota_reached');return response;
 }
 async function checkPrivate(){
  privateChecked??=(async()=>{const response=await provider('/bucket/'+bucket);if(!response.ok)throw new HttpError(503,'storage_provider_unavailable');const value=await response.json() as {public?:boolean};if(value.public!==false)throw new HttpError(503,'private_bucket_required');})();await privateChecked;
 }
 const objectPath=(path:string)=>'/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/');
 return {
  async read(path){await checkPrivate();const response=await provider(objectPath(path));if(response.status===404)return null;if(!response.ok)throw new HttpError(503,'storage_provider_unavailable');return bytes(response,2*1024*1024);},
  async readUpTo(path,limit){await checkPrivate();const response=await provider(objectPath(path));if(response.status===404)return null;if(!response.ok)throw new HttpError(503,'storage_provider_unavailable');return bytes(response,limit);},
  async signedUpload(path){await checkPrivate();const response=await provider('/object/upload/sign/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{'content-type':'application/json','x-upsert':'false'},body:'{}'});if(!response.ok)throw new HttpError(503,'storage_provider_unavailable');const value=await response.json() as {url?:string};if(typeof value.url!=='string'||!value.url.startsWith('/object/upload/sign/'))throw new HttpError(503,'storage_provider_unavailable');return endpoint+value.url;},
  async signedRead(path,ttlSeconds){await checkPrivate();const ttl=Math.max(10,Math.min(300,Math.floor(ttlSeconds)));const response=await provider('/object/sign/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expiresIn:ttl})});if(!response.ok)throw new HttpError(503,'storage_provider_unavailable');const value=await response.json() as {signedURL?:string};if(typeof value.signedURL!=='string'||!value.signedURL.startsWith('/object/sign/'))throw new HttpError(503,'storage_provider_unavailable');return endpoint+value.signedURL;},
  async putIfAbsent(path,data){await checkPrivate();const response=await provider(objectPath(path),{method:'POST',headers:{'content-type':'application/octet-stream','x-upsert':'false'},body:Uint8Array.from(data)});if(response.status===409)return false;if(response.status===400){const error=await response.json().catch(()=>({})) as {error?:string;message?:string;code?:string};if([error.error,error.message,error.code].some(value=>typeof value==='string'&&/already.?exists|duplicate/i.test(value)))return false;}if(!response.ok)throw new HttpError(503,'storage_provider_unavailable');return true;},
 };
}

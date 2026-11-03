import type {Env} from './types.ts';
import {HttpError,safeArtifactPath} from './domain.ts';

const publicDocuments=new Set(['/','/docs','/sign-in','/help','/legal']);
export function protectedDocument(path:string){return ['/catalog','/contribute','/editor'].includes(path)||/^\/asset\/[a-f0-9]{64}$/.test(path);}
export function publicCatalogRead(method:string,path:string){return (method==='GET'||method==='HEAD')&&(path==='/catalog'||path.startsWith('/app/')||/^\/asset\/[a-f0-9]{64}$/.test(path)||path==='/api/catalog'||/^\/api\/catalog\/[a-f0-9]{64}$/.test(path)||/^\/api\/catalog\/[a-f0-9]{64}\/files$/.test(path));}
export function documentNavigation(request:Request){return request.method==='GET'&&!request.headers.has('range')&&request.headers.get('accept')?.split(',').some(value=>value.trim().split(';')[0]==='text/html');}
export async function publicResponse(request:Request,env:Env):Promise<Response|null>{
 if(!['GET','HEAD'].includes(request.method))return null;
 const requested=new URL(request.url).pathname;if(['/login','/signin','/log-in'].includes(requested))return new Response(null,{status:302,headers:{location:'/sign-in','cache-control':'no-store'}});
 const path=requested,isDocument=publicDocuments.has(path),isStatic=['/public-assets/','/brand/','/agent-bundles/'].some(prefix=>path.startsWith(prefix))||['/llms.txt','/prompt.txt'].includes(path);
 if(!isDocument&&!isStatic)return null;
 if(!env.PUBLIC_ASSETS&&!env.PUBLIC_FILES)return null;
 if(!env.PUBLIC_ASSETS||!env.PUBLIC_FILES)throw new HttpError(503,'public_assets_unconfigured');
 let files:unknown;try{files=JSON.parse(env.PUBLIC_FILES);}catch{throw new HttpError(503,'public_assets_unconfigured');}
 if(!Array.isArray(files)||files.some(file=>typeof file!=='string'||!file.startsWith('/')||!safeArtifactPath(file.slice(1))))throw new HttpError(503,'public_assets_unconfigured');
 const target=isDocument?'/index.html':path;if(!files.includes(target)){if(isDocument)throw new HttpError(503,'public_index_unconfigured');return null;}
 const url=new URL(request.url);url.pathname=target;url.search='';const headers=new Headers();for(const key of ['range','if-none-match','if-modified-since']){const value=request.headers.get(key);if(value)headers.set(key,value);}
 const response=await env.PUBLIC_ASSETS.fetch(new Request(url,{method:request.method,headers}));const resultHeaders=new Headers(response.headers);resultHeaders.set('x-content-type-options','nosniff');if(isDocument)resultHeaders.set('cache-control','no-store');
 return new Response(response.body,{status:response.status,headers:resultHeaders});
}

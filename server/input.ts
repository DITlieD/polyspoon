import {HttpError,strictObject} from './domain.ts';
export async function bytes(request:Pick<Request,'headers'|'body'>,limit:number):Promise<Uint8Array>{
 const declared=request.headers.get('content-length');if(declared&&Number(declared)>limit)throw new HttpError(413,'request_too_large');
 if(!request.body)return new Uint8Array();const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new HttpError(413,'request_too_large');}chunks.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function body(request:Request,keys:string[]){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'json_required');
 let value:unknown;try{value=JSON.parse(new TextDecoder().decode(await bytes(request,512*1024)));}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'invalid_json');}
 return strictObject(value,keys);
}
export function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8'}});}

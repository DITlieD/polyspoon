import type {Env} from './types.ts';
import {HttpError} from './domain.ts';

export function normalizedAddress(value:string){try{if(value.includes(':'))return new URL('http://['+value+']/').hostname.slice(1,-1);const parts=value.split('.');if(parts.length===4&&parts.every(v=>/^(0|[1-9][0-9]{0,2})$/.test(v)&&Number(v)<=255))return parts.join('.');}catch{}throw new HttpError(400,'invalid_address_block');}
export function trustedClientAddress(request:Request,env:Env):string|null {
 if(env.APP_ENV!=='production'||!(request as Request&{cf?:unknown}).cf)return null;const value=request.headers.get('cf-connecting-ip');return value?normalizedAddress(value):null;
}

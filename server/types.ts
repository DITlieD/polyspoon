import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
export interface Env {
 DB:D1Database;
 PUBLIC_ASSETS?:{fetch(request:Request):Promise<Response>};
 PUBLIC_FILES?:string;
 LOCAL_OBJECTS?:R2Bucket;
 APP_ENV:'local'|'production';
 APP_ORIGIN:string;
 PRIVATE_APP_RELEASE?:string;
 AUTH_SECRET:string;
 LOCAL_MAIL_SINK?:string;
 RESEND_API_KEY?:string;
 MAIL_FROM?:string;
 SUPABASE_URL?:string;
 SUPABASE_SERVICE_KEY?:string;
 SUPABASE_PRIVATE_BUCKET?:string;
}
export interface PrivateObjects {
 read(key:string):Promise<Uint8Array|null>;
 putIfAbsent(key:string,bytes:Uint8Array):Promise<boolean>;
}

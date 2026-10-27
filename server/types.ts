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
 /** Read an object up to `limit` bytes (uploads can exceed the 2 MB artifact cap). */
 readUpTo?(key:string,limit:number):Promise<Uint8Array|null>;
 /** A short-lived, single-object signed PUT URL. Absent in local mode, where the Worker accepts the PUT itself. */
 signedUpload?(key:string):Promise<string>;
 /** A short-lived signed GET URL for one private object (moderator image serving). Absent in local mode. */
 signedRead?(key:string,ttlSeconds:number):Promise<string>;
}

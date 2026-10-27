import {canonical} from '../src/review/identity.ts';
export {canonical};
export class HttpError extends Error {
 constructor(readonly status:number,readonly code:string){super(code);}
}
export interface Principal {id:string;status:string;verified:boolean;capabilities:string[];scopes?:string[];sessionId?:string}
export type VersionState='draft'|'submitted'|'processing'|'awaiting_review'|'changes_requested'|'rejected'|'approved'|'published'|'withdrawn';
export function requireActive(value:Principal|null):asserts value is Principal {
 if(!value)throw new HttpError(401,'authentication_required');
 if(value.status!=='active'||!value.verified)throw new HttpError(403,'active_verified_membership_required');
}
export function requireCapability(value:Principal|null,capability:string){requireActive(value);if(value.scopes||!value.capabilities.includes(capability))throw new HttpError(403,'capability_required');}
export function requireScope(value:Principal,scope:string){if(value.scopes&&!value.scopes.includes(scope))throw new HttpError(403,'token_scope_required');}
export function allowedTransition(from:VersionState,to:VersionState,capability:string):boolean {
 const transitions:Record<string,string[]>={contributor:['draft:submitted','changes_requested:submitted','changes_requested:withdrawn','draft:withdrawn','submitted:withdrawn','published:withdrawn'],verifier:['submitted:processing','processing:awaiting_review'],reviewer:['awaiting_review:changes_requested','awaiting_review:rejected'],publisher:['awaiting_review:approved','approved:approved','approved:published','published:withdrawn']};
 return Object.hasOwn(transitions,capability)&&transitions[capability]!.includes(from+':'+to);
}
export function strictObject(value:unknown,keys:string[]):Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'json_object_required');
 for(const key of Object.keys(value))if(!keys.includes(key))throw new HttpError(400,'unknown_field');
 return value as Record<string,unknown>;
}
export function memberTokenScopes(value:unknown):string[] {
 const allowed=['catalog:read','assets:read','votes:write','submissions:write','uploads:write'];
 if(!Array.isArray(value)||!value.length||value.some(scope=>typeof scope!=='string'||!allowed.includes(scope)))throw new HttpError(400,'invalid_token_scope');
 return [...new Set(value)].sort();
}
export async function digest(bytes:Uint8Array|string):Promise<string>{const data=typeof bytes==='string'?new TextEncoder().encode(bytes):Uint8Array.from(bytes);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function versionIdentity(value:unknown):Promise<string>{return digest(canonical(value));}
export function secretToken():string{return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function nonempty(value:unknown,max=200):value is string{return typeof value==='string'&&value.trim().length>0&&value.length<=max;}
export function safeArtifactPath(value:string):boolean{return value.length>0&&value.length<=250&&!value.includes('\\')&&!value.includes('\0')&&!value.startsWith('/')&&value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');}

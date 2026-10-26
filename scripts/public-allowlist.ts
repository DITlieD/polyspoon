// Derives the hosted PUBLIC_FILES allowlist from a release's public-files.json and
// proves every asset the public HTML (and its CSS) references is on that list.
// A stale allowlist served the home page unstyled once; this check makes that a
// preparation failure instead of a live outage.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export function allowlistFromManifest(value:unknown):string[]{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_public_manifest');
 const files=(value as {files?:unknown}).files;if(!files||typeof files!=='object'||Array.isArray(files))throw Error('invalid_public_manifest');
 const list=Object.keys(files).map(path=>'/'+path.replace(/^\/+/,'')).sort();if(!list.includes('/index.html'))throw Error('invalid_public_manifest');return list;
}
const local=(ref:string)=>{const trimmed=ref.trim();if(!trimmed||/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(trimmed))return null;return trimmed.split(/[?#]/)[0]!;};
export function htmlReferences(html:string):string[]{
 const refs=new Set<string>();for(const m of html.matchAll(/<(?:script|link|img|source)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)){const ref=local(m[1]!);if(ref)refs.add(ref.startsWith('/')?ref:'/'+ref);}return [...refs].sort();
}
export function cssReferences(css:string,base:string):string[]{
 const refs=new Set<string>();for(const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)){const ref=local(m[1]!);if(ref)refs.add(new URL(ref,'https://x'+base).pathname);}return [...refs].sort();
}
export function missingFromAllowlist(references:string[],allowlist:string[]){const set=new Set(allowlist);return references.filter(ref=>!set.has(ref));}
/** Reads <release>/public-files.json and public/index.html; throws public_allowlist_missing:<paths> on any gap. */
export async function deriveAndCheckPublicFiles(releaseRoot:string){
 const allowlist=allowlistFromManifest(JSON.parse(await readFile(join(releaseRoot,'public-files.json'),'utf8')));
 const html=await readFile(join(releaseRoot,'public','index.html'),'utf8');const references=htmlReferences(html);
 for(const ref of references.filter(r=>r.endsWith('.css')&&allowlist.includes(r)))references.push(...cssReferences(await readFile(join(releaseRoot,'public',ref.slice(1)),'utf8'),ref));
 const unique=[...new Set(references)].sort(),missing=missingFromAllowlist(unique,allowlist);
 if(missing.length)throw Error('public_allowlist_missing:'+missing.join(','));
 return {allowlist,references:unique};
}

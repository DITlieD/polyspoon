// zenov → Polyspoon upload CLI. Uses the SAME public upload API as everyone else, with an agent token that has the
// `uploads:write` scope (create it under Account → Tokens with only uploads:write [+ catalog:read]). There is no
// fast path: every upload goes through the sandboxed checks, the automated safety pre-review and human review.
//
//   POLYSPOON_URL=https://preflight.example POLYSPOON_TOKEN=… tsx scripts/zenov-upload.ts model.glb --title "Oak barrel" \
//     [--description "…"] [--category props] [--provenance provenance.json] [--no-wait]
//
// The token is read from the environment and never printed. Provenance (generator, seed, prompt hash…) is attached
// as untrusted metadata: humans can read it, and it is text-scanned like everything else; it never affects a gate.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
export interface Options{file:string;title:string;description?:string;category?:string;provenance?:unknown;wait:boolean}
export interface Env{url:string;token:string;fetch?:typeof fetch;sleep?:(ms:number)=>Promise<void>;log?:(line:string)=>void}
const FINAL=new Set(['in_review','rejected','failed','expired']);
export function parseArgs(argv:string[]):Omit<Options,'provenance'>&{provenancePath?:string}{
 const [file,...rest]=argv;if(!file||file.startsWith('--'))throw new Error('usage: zenov-upload <file.glb|file.gltf> --title "…" [--description …] [--category …] [--provenance file.json] [--no-wait]');
 const out:{file:string;title?:string;description?:string;category?:string;provenancePath?:string;wait:boolean}={file,wait:true};
 for(let i=0;i<rest.length;i++){const k=rest[i],v=rest[i+1];if(k==='--no-wait'){out.wait=false;continue;}if(v===undefined)throw new Error('missing value for '+k);if(k==='--title')out.title=v;else if(k==='--description')out.description=v;else if(k==='--category')out.category=v;else if(k==='--provenance')out.provenancePath=v;else throw new Error('unknown option '+k);i++;}
 if(!out.title)throw new Error('--title is required');return out as Omit<Options,'provenance'>&{provenancePath?:string};
}
export async function upload(env:Env,opts:Options){
 const f=env.fetch??fetch,log=env.log??(()=>{}),sleep=env.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));
 const base=new URL(env.url);if(base.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw new Error('POLYSPOON_URL must be https (or loopback for local testing)');
 const ext=extname(opts.file).toLowerCase(),format=ext==='.glb'?'glb':ext==='.gltf'?'gltf':null;if(!format)throw new Error('only .glb or .gltf files are accepted');
 const data=new Uint8Array(await readFile(opts.file)),sha256=createHash('sha256').update(data).digest('hex');
 const auth={authorization:'Bearer '+env.token};
 const api=async(method:string,path:string,body?:unknown)=>{const r=await f(new URL(path,base),{method,headers:{...auth,...(body!==undefined?{'content-type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined});const v=await r.json().catch(()=>({})) as Record<string,unknown>;if(!r.ok)throw new Error('upload failed: '+(v.error??r.status));return v;};
 const slot=await api('POST','/api/uploads',{format,bytes:data.length,sha256,source:'zenov'}) as {uploadId:string;putUrl:string};
 log('reserved upload '+slot.uploadId);
 // The signed storage URL is single-object and short-lived; the local Worker URL needs the token, storage URLs don't.
 const put=new URL(slot.putUrl,base),sameOrigin=put.origin===base.origin;
 const sent=await f(put,{method:'PUT',headers:{...(sameOrigin?auth:{}),'content-type':format==='glb'?'model/gltf-binary':'model/gltf+json'},body:data as unknown as BodyInit});
 if(!sent.ok)throw new Error('file transfer failed: '+sent.status);
 const done=await api('POST','/api/uploads/'+slot.uploadId+'/complete',{title:opts.title,...(opts.description?{description:opts.description}:{}),...(opts.category?{category:opts.category}:{}),...(opts.provenance!==undefined?{provenance:opts.provenance}:{})}) as {upload:{status:string}};
 let state=done.upload.status;log('status: '+state);
 if(opts.wait)for(let i=0;i<120&&!FINAL.has(state);i++){await sleep(15_000);state=((await api('GET','/api/uploads/'+slot.uploadId)) as {upload:{status:string}}).upload.status;log('status: '+state);}
 return {uploadId:slot.uploadId,status:state,sha256};
}
async function main(){
 const url=process.env.POLYSPOON_URL,token=process.env.POLYSPOON_TOKEN;if(!url||!token)throw new Error('Set POLYSPOON_URL and POLYSPOON_TOKEN (an uploads:write agent token)');
 const args=parseArgs(process.argv.slice(2)),provenance=args.provenancePath?JSON.parse(await readFile(args.provenancePath,'utf8')):undefined;
 const result=await upload({url,token,log:line=>console.error(line)},{file:args.file,title:args.title,description:args.description,category:args.category,provenance,wait:args.wait});
 console.log(JSON.stringify(result));
}
if(import.meta.url===`file://${process.argv[1]}`)await main();

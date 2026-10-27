// Parses an untrusted upload in a Bubblewrap jail: every namespace unshared (no network), read-only system,
// the upload bind-mounted read-only, a tmpfs workdir, and a wall-clock limit. The parent only reads one JSON line.
import {spawn} from 'node:child_process';
import {existsSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export type SandboxResult={ok:true;triangles:number;nodes:number;images:number;strings:string[];validatorWarnings?:number}|{ok:false;reason:string};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function jailArgs(file:string,format:'glb'|'gltf'){
 const node=realpathSync(process.execPath),args=['--unshare-all','--die-with-parent','--new-session','--clearenv','--setenv','PATH','/usr/bin:/bin','--proc','/proc','--dev','/dev','--tmpfs','/tmp'];
 for(const dir of ['/usr','/lib','/lib64','/bin','/etc/ssl'])if(existsSync(dir))args.push('--ro-bind',dir,dir);
 args.push('--ro-bind',dirname(node),dirname(node),'--ro-bind',realpathSync(root),'/work',...(realpathSync(root+'/node_modules')!==realpathSync(root)+'/node_modules'?['--ro-bind',realpathSync(root+'/node_modules'),realpathSync(root+'/node_modules')]:[]),'--ro-bind',file,'/input/upload','--chdir','/work');
 args.push(node,'--max-old-space-size=512','--import','tsx','processor/ingest-check.ts',format);
 return args;
}
export function sandboxedCheck(file:string,format:'glb'|'gltf',timeoutMs=60_000):Promise<SandboxResult>{
 return new Promise(done=>{
  const child=spawn('bwrap',jailArgs(file,format),{stdio:['ignore','pipe','ignore']});let out='';
  const timer=setTimeout(()=>{child.kill('SIGKILL');},timeoutMs);
  child.stdout.on('data',chunk=>{out+=chunk;if(out.length>1_000_000)child.kill('SIGKILL');});
  child.on('error',()=>{clearTimeout(timer);done({ok:false,reason:'sandbox_unavailable'});});
  child.on('close',code=>{clearTimeout(timer);try{const line=out.trim().split('\n').at(-1)!;const value=JSON.parse(line);if(typeof value?.ok!=='boolean')throw 0;done(code===0||!value.ok?value:{ok:false,reason:'sandbox_failed'});}catch{done({ok:false,reason:code===null?'sandbox_timeout':'sandbox_failed'});}});
 });
}

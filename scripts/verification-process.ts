import { readdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { open } from 'node:fs/promises';
import { join } from 'node:path';

export interface VerificationCommand { id:string; command:string; args:string[]; timeoutMs:number }
export interface CommandResult {
  outcome:'passed'|'failed'|'timed-out'|'cancelled';
  exitCode:number|null;
  signal:NodeJS.Signals|null;
  error?:string;
  stdout:string;
  stderr:string;
  startedAt:string;
  durationMs:number;
}
function processIdentity(pid:number) {
  try {
    const fields=readFileSync('/proc/'+pid+'/stat','utf8').split(') ').at(-1)!.split(' ');
    return {parent:Number(fields[1]),start:fields[19]!};
  } catch {return undefined;}
}
function descendants(parent:number) {
  const identities=new Map<number,{parent:number;start:string}>();
  for(const name of readdirSync('/proc'))if(/^\d+$/.test(name)) {
    const identity=processIdentity(Number(name));
    if(identity)identities.set(Number(name),identity);
  }
  const owned=new Map<number,string>(),parents=new Set([parent]);
  let added=true;
  while(added) {
    added=false;
    for(const [pid,item] of identities)if(parents.has(item.parent)&&!parents.has(pid)) {
      parents.add(pid);owned.set(pid,item.start);added=true;
    }
  }
  return owned;
}
export async function runCommand(command:VerificationCommand,cwd:string,logs:string,signal:AbortSignal):Promise<CommandResult> {
  if(!/^[a-z][a-z0-9-]*$/.test(command.id)||!Number.isSafeInteger(command.timeoutMs)||command.timeoutMs<1)throw Error('Invalid bounded command');
  const started=Date.now(),stdout=join(logs,command.id+'.stdout.log'),stderr=join(logs,command.id+'.stderr.log');
  const out=await open(stdout,'wx'),err=await open(stderr,'wx');
  try {
    if(signal.aborted)return {outcome:'cancelled',exitCode:null,signal:null,stdout,stderr,startedAt:new Date(started).toISOString(),durationMs:Date.now()-started};
    return await new Promise<CommandResult>((finish)=>{
      let outcome:CommandResult['outcome']|undefined,error:string|undefined,killTimer:ReturnType<typeof setTimeout>|undefined;
      let owned=new Map<number,string>();
      const child=spawn(command.command,command.args,{cwd,shell:false,detached:process.platform!=='win32',stdio:['ignore',out.fd,err.fd],env:{...process.env}});
      const kill=(kind:NodeJS.Signals)=>{
        if(!child.pid)return;
        for(const [pid,start] of owned)if(processIdentity(pid)?.start===start) {
          try{process.kill(pid,kind);}catch(value){if((value as NodeJS.ErrnoException).code!=='ESRCH')error=String(value);}
        }
        try{if(process.platform==='win32')child.kill(kind);else process.kill(-child.pid,kind);}
        catch(value){if((value as NodeJS.ErrnoException).code!=='ESRCH')error=String(value);}
      };
      const stop=(reason:'timed-out'|'cancelled')=>{
        if(outcome)return;
        outcome=reason;
        if(process.platform==='linux'&&child.pid)owned=descendants(child.pid);
        kill('SIGTERM');
        killTimer=setTimeout(()=>kill('SIGKILL'),1000);
      };
      const abort=()=>stop('cancelled');
      const timer=setTimeout(()=>stop('timed-out'),command.timeoutMs);
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted)abort();
      child.on('error',value=>{error=value.message;});
      child.on('close',(exitCode,termination)=>{
        clearTimeout(timer);if(killTimer)clearTimeout(killTimer);
        signal.removeEventListener('abort',abort);
        kill('SIGKILL');
        finish({outcome:outcome??(exitCode===0&&!error?'passed':'failed'),exitCode,signal:termination,error,stdout,stderr,startedAt:new Date(started).toISOString(),durationMs:Date.now()-started});
      });
    });
  } finally {await out.close();await err.close();}
}

// Bubblewrap argument builders for the safety stage. Every namespace is unshared (so there is NO network), the
// host filesystem is read-only and only the pieces a tool needs are bound in, /tmp is a fresh tmpfs, and the jail
// dies with its parent. One jail per job; it is gone when the process exits.
import {existsSync,writeFileSync,mkdtempSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
/** Resource limits for every jail, applied as a transient systemd user scope (cgroup v2): memory with no swap,
 *  CPU quota, and a task cap (fork bombs). Override with SAFETY_JAIL_MEMORY / SAFETY_JAIL_CPU / SAFETY_JAIL_TASKS.
 *  SAFETY_JAIL_CGROUP=off disables it (tests on hosts without a user systemd only); production keeps it on and a
 *  missing systemd-run makes the jail fail to start, which fails the stage closed (→ human review). */
export interface JailLimits{memory:string;cpu:string;tasks:number}
export function jailLimits(env:Record<string,string|undefined>=process.env,kind:'chrome'|'ocr'='chrome'):JailLimits|null{
 if(env.SAFETY_JAIL_CGROUP==='off')return null;
 const memory=env.SAFETY_JAIL_MEMORY??(kind==='chrome'?'3G':'768M'),cpu=env.SAFETY_JAIL_CPU??(kind==='chrome'?'200%':'100%'),tasks=Number(env.SAFETY_JAIL_TASKS??(kind==='chrome'?512:64));
 if(!/^[1-9][0-9]{0,5}[KMG]$/.test(memory)||!/^[1-9][0-9]{0,4}%$/.test(cpu)||!Number.isInteger(tasks)||tasks<8||tasks>4096)throw new Error('invalid_jail_limits');
 return {memory,cpu,tasks};
}
/** systemd-run prefix: a transient scope keeps the caller's stdio and pipes (Playwright's fd 3/4), and the cgroup
 *  is destroyed when the jail exits. */
export function cgroupPrefix(l:JailLimits|null):string[]{return l?['systemd-run','--user','--scope','--quiet','--collect','-p','MemoryMax='+l.memory,'-p','MemorySwapMax=0','-p','CPUQuota='+l.cpu,'-p','TasksMax='+l.tasks,'--']:[];}
const BASE=['--unshare-all','--die-with-parent','--new-session','--clearenv','--setenv','PATH','/usr/bin:/bin','--setenv','HOME','/tmp','--proc','/proc','--dev','/dev','--tmpfs','/tmp'];
export function systemBinds(extra:string[]=[]){const out:string[]=[];for(const dir of ['/usr','/lib','/lib64','/bin',...extra])if(existsSync(dir))out.push('--ro-bind',dir,dir);return out;}
export const CHROME=process.env.SAFETY_CHROME??'/opt/google/chrome/chrome';
/** Chromium in the jail. Chromium's own sandbox is disabled because bwrap already is the sandbox (nested user
 *  namespaces are not available inside it). Playwright talks to it over a pipe, so no port is ever opened. */
export function chromeJailArgs(){return [...BASE,'--tmpfs','/dev/shm',...systemBinds(['/etc/fonts','/opt/google']),CHROME,'--no-sandbox','--no-zygote'];}
/** Writes a tiny launcher Playwright can use as its `executablePath`. Returns the launcher path. */
export function chromeLauncher(){
 const dir=mkdtempSync(join(tmpdir(),'safety-chrome-')),file=join(dir,'chrome-jail.sh');
 const quote=(s:string)=>"'"+s.replace(/'/g,"'\\''")+"'";
 writeFileSync(file,'#!/bin/sh\nexec '+[...cgroupPrefix(jailLimits()),'bwrap',...chromeJailArgs()].map(quote).join(' ')+' "$@"\n');chmodSync(file,0o700);return file;
}
/** Command + args for Tesseract in its cgroup-limited jail. */
export function tesseractCommand(dir:string,file:string,lang:string):[string,string[]]{const p=[...cgroupPrefix(jailLimits(process.env,'ocr')),'bwrap',...tesseractJailArgs(dir,file,lang)];return [p[0]!,p.slice(1)];}
/** Tesseract in the jail: reads one image from a read-only bind, prints text to stdout. */
export function tesseractJailArgs(dir:string,file:string,lang:string){return [...BASE,...systemBinds(['/etc/alternatives']),'--ro-bind',dir,'/in','tesseract','/in/'+file,'stdout','-l',lang,'--psm','11'];}

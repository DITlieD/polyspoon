import { mkdir, writeFile, rename, readdir, readFile, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { sha256 } from './provenance.ts';
import { runCommand } from './verification-process.ts';
import type { CommandResult, VerificationCommand } from './verification-process.ts';

interface Stage extends VerificationCommand { status:'pending'|'running'|'passed'|'failed'; result?:CommandResult }
export interface VerificationReport {
  formatVersion:1;
  status:'running'|'technical-success'|'failed'|'cancelled';
  visualReview:'pending';
  portableRebuild:'pending';
  metadata:unknown;
  before?:unknown;
  after?:unknown;
  stages:Stage[];
  firstFailure?:{stage:string;error:string};
  checks?:unknown;
  files:Record<string,{sha256:string;bytes:number}>;
  nextAction:string;
  limits:string[];
}
export async function fileInventory(directory:string):Promise<Record<string,{sha256:string;bytes:number}>> {
  const files:Record<string,{sha256:string;bytes:number}>=Object.create(null);
  async function walk(path:string) {
    for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const target=join(path,entry.name),name=relative(directory,target);
      if(['report.json','report.pending.json'].includes(name))continue;
      const info=await lstat(target);
      if(info.isSymbolicLink())throw Error('Unexpected symlink in evidence: '+name);
      if(info.isDirectory())await walk(target);
      else if(info.isFile()){const bytes=await readFile(target);files[name]={sha256:sha256(bytes),bytes:bytes.length};}
      else throw Error('Unexpected evidence entry: '+name);
    }
  }
  await walk(directory);return files;
}
export async function runStages(input:{output:string;cwd?:string;metadata:unknown;stages:VerificationCommand[];snapshot:()=>Promise<unknown>;inspect:()=>Promise<unknown>;signal:AbortSignal}) {
  const report:VerificationReport={
    formatVersion:1,status:'running',visualReview:'pending',portableRebuild:'pending',metadata:input.metadata,
    stages:input.stages.map(stage=>({...stage,status:'pending'})),files:{},
    nextAction:'Wait for a terminal report. Running or interrupted reports are not verified.',
    limits:['Technical checks do not establish visual quality.','Portable rebuilding requires source inspection and a separate explicit execution.','Target import/use is not established by this command.'],
  };
  const save=async()=>{
    const pending=join(input.output,'report.pending.json');
    await writeFile(pending,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    await rename(pending,join(input.output,'report.json'));
  };
  let active='inputs';
  try {
    await mkdir(join(input.output,'logs'),{recursive:false});
    await save();
    report.before=await input.snapshot();
    const stable=async()=>{
      report.after=await input.snapshot();
      if(JSON.stringify(report.before)!==JSON.stringify(report.after))throw Error('Sources or verification inputs changed during the run. Freeze changes and rerun into a fresh directory.');
      if(input.signal.aborted)throw Error('Verification cancelled. Rerun into a fresh directory.');
    };
    await save();
    for(const stage of report.stages) {
      active=stage.id;
      await stable();
      stage.status='running';await save();
      stage.result=await runCommand(stage,input.cwd??process.cwd(),join(input.output,'logs'),input.signal);
      stage.status=stage.result.outcome==='passed'?'passed':'failed';
      await save();
      if(stage.status==='failed')throw Error(stage.result.error??('Command '+stage.result.outcome+' (exit '+stage.result.exitCode+', signal '+stage.result.signal+'). Inspect '+relative(input.output,stage.result.stderr)+' and '+relative(input.output,stage.result.stdout)+'.'));
      await stable();
    }
    active='artifacts';
    report.checks=await input.inspect();
    await stable();
    report.files=await fileInventory(input.output);
    await stable();
    report.status='technical-success';
    report.nextAction='Inspect the actual neutral renders, record visual findings separately, then explicitly verify the inspected source package with this selected design and the requested target.';
  } catch(error) {
    report.status=input.signal.aborted?'cancelled':'failed';
    report.firstFailure={stage:active,error:error instanceof Error?error.message:String(error)};
    report.nextAction='Repair the first failure using retained logs, then rerun into a new output directory. Do not accept partial artifacts.';
    try{report.files=await fileInventory(input.output);}catch(inventoryError){report.limits.push('Evidence inventory incomplete: '+String(inventoryError));}
  }
  await save();
  return report;
}

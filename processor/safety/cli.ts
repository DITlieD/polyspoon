// Safety processor CLI (operator-run, pull-only):
//   POLYSPOON_API=https://preflight… POLYSPOON_PROCESSOR_SECRET=pc_… tsx processor/safety/cli.ts canary|once|loop
// The secret is read from the environment and never printed. Exit code 3 = halted by a failing canary.
import {sandboxedCheck} from '../ingest-sandbox.ts';
import {renderInJail} from './render.ts';
import {ocrImages} from './ocr.ts';
import {llmConfig,secondOpinion} from './llm.ts';
import {canaryGate,fetchPolicy,runOnce,type Client} from './job.ts';
import type {Deps} from './pipeline.ts';
export function liveDeps():Deps{const llm=llmConfig();return {ingest:(f,fmt)=>sandboxedCheck(f,fmt),render:(f,max)=>renderInJail(f,max),ocr:i=>ocrImages(i),llm:(i,s)=>secondOpinion(llm,i,s)};}
async function main(){
 const [command]=process.argv.slice(2),api=process.env.POLYSPOON_API,secret=process.env.POLYSPOON_PROCESSOR_SECRET;
 if(!api||!secret||!/^pc_[a-f0-9]{64}$/.test(secret))throw new Error('Set POLYSPOON_API and POLYSPOON_PROCESSOR_SECRET');
 const client:Client={api,secret},deps=liveDeps();
 if(command==='canary'){const r=await canaryGate(client,await fetchPolicy(client),deps);console.log(JSON.stringify({passed:r.passed,results:r.results}));process.exitCode=r.passed?0:3;return;}
 if(command==='once'){const r=await runOnce(client,deps);console.log(JSON.stringify({status:r.status,reason:r.reason,uploadId:r.uploadId,outcome:r.outcome}));process.exitCode=r.status==='halted'?3:0;return;}
 if(command==='loop'){let canaryOk=false;for(;;){const r=await runOnce(client,deps,{skipCanary:canaryOk});if(r.status==='halted'&&r.reason==='canary_required'&&canaryOk){canaryOk=false;continue;}if(r.status==='halted'){console.error('halted: '+r.reason);process.exitCode=3;return;}canaryOk=true;if(r.status==='idle')await new Promise(res=>setTimeout(res,30_000));}}
 throw new Error('Choose canary, once or loop');
}
if(import.meta.url===`file://${process.argv[1]}`)await main();

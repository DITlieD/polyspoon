import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseVerifyOptions, prepareVerification, rejectSymlinks } from './recipe-verify-input.ts';
import { verificationSnapshot, checkEvidence } from './recipe-verify-evidence.ts';
import { runStages } from './verification-run.ts';
import type { VerificationCommand } from './verification-process.ts';

export async function verifyRecipe(args:string[],signal:AbortSignal) {
  if(process.platform!=='linux')throw Error('This workflow currently requires Linux for owned browser descendant cleanup');
  const root=fileURLToPath(new URL('../',import.meta.url));
  if(resolve(process.cwd())!==resolve(root))throw Error('Run recipe:verify from the project root');
  const prepared=await prepareVerification(parseVerifyOptions(args),root);
  await rejectSymlinks(prepared.output);
  await mkdir(dirname(prepared.output),{recursive:true});
  await rejectSymlinks(prepared.output);
  await mkdir(prepared.output,{recursive:false});
  await writeFile(join(prepared.output,'selected.design.json'),JSON.stringify(prepared.design,null,2)+'\n',{flag:'wx'});
  const selected=join(prepared.output,'selected.design.json'),stages:VerificationCommand[]=[];
  const add=(id:string,args:string[])=>stages.push({id,command:process.execPath,args,timeoutMs:prepared.timeoutMs});
  add('typecheck',['node_modules/typescript/bin/tsc','--noEmit']);
  add('recipe-tests',['--import','tsx','scripts/test-current.ts','recipes']);
  add('behavior-test',['--import','tsx','--test',prepared.test]);
  add('validate',['--import','tsx','scripts/cli.ts','validate','--family',prepared.family,'--out',join(prepared.output,'validation')]);
  add('render',['--import','tsx','scripts/recipe-render.ts','--family',prepared.family,'--config',selected,'--out',join(prepared.output,'renders')]);
  add('export',['--import','tsx','scripts/cli.ts','export','--family',prepared.family,'--config',selected,'--out',join(prepared.output,'selected.glb')]);
  add('package',['--import','tsx','scripts/recipe-package.ts','--out',join(prepared.output,'packages')]);
  add('package-check',['--import','tsx','scripts/recipe-verify-package.ts',join(prepared.output,'packages/index.json'),prepared.family,prepared.design.familyVersion]);
  let baseline:Awaited<ReturnType<typeof verificationSnapshot>>|undefined;
  const snapshot=async()=>{
    const current=await verificationSnapshot(prepared);
    baseline??=current;
    if(prepared.inputFileSha256&&current.verificationInputs[relative(root,prepared.configPath!)]!==prepared.inputFileSha256)throw Error('Input config changed after selection');
    return current;
  };
  return runStages({
    output:prepared.output,cwd:root,signal,stages,snapshot,
    inspect:()=>checkEvidence(prepared,baseline!),
    metadata:{workflow:'recipe:verify',family:prepared.family,version:prepared.design.familyVersion,request:prepared.request,behaviorTest:prepared.test,selectedDesign:prepared.design,inputFile:prepared.configPath,inputFileSha256:prepared.inputFileSha256,output:prepared.output},
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const controller=new AbortController(),cancel=()=>controller.abort();
  process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
  try {
    const report=await verifyRecipe(process.argv.slice(2),controller.signal);
    console.log(JSON.stringify({status:report.status,visualReview:report.visualReview,portableRebuild:report.portableRebuild,firstFailure:report.firstFailure,nextAction:report.nextAction,metadata:report.metadata},null,2));
    process.exitCode=report.status==='technical-success'?0:controller.signal.aborted?130:1;
  } catch(error){console.error(error);process.exitCode=controller.signal.aborted?130:1;}
  finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
}

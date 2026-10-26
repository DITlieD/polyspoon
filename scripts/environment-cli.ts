import './node-platform.ts';
import { readFile,writeFile,mkdir,lstat } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateBytes } from 'gltf-validator';
import { buildEnvironment,exportEnvironment,saveEnvironment,exampleEnvironment } from '../src/environment/index.ts';
import { geometrySnapshot } from '../src/lantern/inspect.ts';
import { sha256,sourceProvenance } from './provenance.ts';

async function freshOutputs(paths:string[]){
  for(const path of paths)try{await lstat(path);throw new Error('Output already exists: '+path);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
export async function runEnvironmentCli(args:string[]) {
  const [command,...flags]=args,options=new Map<string,string>();
  for(let i=0;i<flags.length;i+=2){const key=flags[i]!,value=flags[i+1];if(!['--config','--out'].includes(key)||!value||value.startsWith('--')||options.has(key))throw new Error('Invalid environment CLI arguments');options.set(key,value);}
  const output=options.get('--out');if(!output)throw new Error('--out is required');
  if(command==='example'){
    if(options.has('--config')||!output.endsWith('.json'))throw new Error('Use example --out scene.json');
    const text=saveEnvironment(exampleEnvironment());await freshOutputs([output]);await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,text,{flag:'wx'});return {output};
  }
  if(command!=='export'||!options.has('--config')||!output.endsWith('.glb'))throw new Error('Use export --config scene.json --out scene.glb');
  const input=options.get('--config')!,paths=[output,output+'.environment.json',output+'.report.json'];
  if(paths.some(path=>resolve(path)===resolve(input)))throw new Error('Output conflicts with input');
  await freshOutputs(paths);
  const source=await sourceProvenance(),build=buildEnvironment(JSON.parse(await readFile(input,'utf8')));
  try{
    const text=saveEnvironment(build.config),configHash=sha256(text),bytes=await exportEnvironment(build,{sourceHash:source.sourceHash,lockHash:source.lockHash,configHash}),validation=await validateBytes(bytes,{uri:output,maxIssues:100});
    if(validation.issues.numErrors||validation.issues.numWarnings)throw new Error('Environment GLB validation failed: '+JSON.stringify(validation.issues));
    if((await sourceProvenance()).sourceHash!==source.sourceHash)throw new Error('Source changed during environment export');
    const report={configuration:build.config,configHash,geometryHash:sha256(JSON.stringify(geometrySnapshot(build.root))),glbHash:sha256(bytes),glbBytes:bytes.length,validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings},provenance:source,grounding:'upright sampled footprint maximum; not collision/clearance proof'};
    await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,bytes,{flag:'wx'});await writeFile(paths[1]!,text,{flag:'wx'});await writeFile(paths[2]!,JSON.stringify(report,null,2)+'\n',{flag:'wx'});return {output,bytes:bytes.length,configHash,glbHash:report.glbHash};
  }finally{build.dispose();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runEnvironmentCli(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});

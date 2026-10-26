import './node-platform.ts';
import { readFile,writeFile,mkdir,lstat } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateBytes } from 'gltf-validator';
import { buildHumanoid,buildSavedHumanoid } from '../src/rigging/build.ts';
import { exportRiggedAsset } from '../src/rigging/export.ts';
import { riggedMotionBounds } from '../src/rigging/bounds.ts';
import { sha256 } from './provenance.ts';
export async function runRiggedCli(args:string[],family={build:buildHumanoid,load:buildSavedHumanoid}){
  const [command,...flags]=args,options=new Map<string,string>();for(let i=0;i<flags.length;i+=2){const key=flags[i]!,value=flags[i+1];if(!['--config','--out'].includes(key)||!value||value.startsWith('--')||options.has(key))throw new Error('Invalid rigged CLI arguments');options.set(key,value);}
  const output=options.get('--out');if(!output||!['example','export'].includes(command??''))throw new Error('Use example --out design.json or export --config design.json --out model.glb');
  if(command==='example'&&(options.has('--config')||!output.endsWith('.json'))||command==='export'&&(!options.has('--config')||!output.endsWith('.glb')))throw new Error('Invalid rigged CLI output');
  const paths=command==='example'?[output]:[output,output+'.design.json',output+'.report.json'];for(const path of paths){if(options.has('--config')&&resolve(path)===resolve(options.get('--config')!))throw new Error('Output conflicts with input');try{await lstat(path);throw new Error('Output already exists: '+path);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  const build=command==='example'?family.build():family.load(JSON.parse(await readFile(options.get('--config')!,'utf8')));
  try{
    const config=JSON.stringify(build.config,null,2)+'\n';await mkdir(dirname(resolve(output)),{recursive:true});if(command==='example'){await writeFile(output,config,{flag:'wx'});return {output};}
    const bytes=await exportRiggedAsset(build),validation=await validateBytes(bytes);if(validation.issues.numErrors||validation.issues.numWarnings)throw new Error('Animated GLB failed validation');
    const bounds=riggedMotionBounds(build),report={configuration:build.config,configHash:sha256(config),glbHash:sha256(bytes),glbBytes:bytes.length,rig:build.rig,animatedBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings},limits:['Flat ground only','Generic root-motion loop resets unless viewer accumulates declared root displacement','Visual and engine acceptance not established by export']};
    await writeFile(output,bytes,{flag:'wx'});await writeFile(paths[1]!,config,{flag:'wx'});await writeFile(paths[2]!,JSON.stringify(report,null,2)+'\n',{flag:'wx'});return {output,bytes:bytes.length,glbHash:report.glbHash};
  }finally{build.dispose();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runRiggedCli(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});

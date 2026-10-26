import { lstat, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { descriptor, buildAsset, disposeAsset, resolveExport } from '../src/catalog/index.ts';
import { sha256 } from './provenance.ts';

export interface VerifyOptions { family:string; request:string; test:string; output:string; config?:string; timeoutMs:number }
export function parseVerifyOptions(args:string[]):VerifyOptions {
  const values=new Map<string,string>();
  for(let i=0;i<args.length;i+=2) {
    const key=args[i]!,value=args[i+1];
    if(!['--family','--request','--test','--out','--config','--timeout-ms'].includes(key)||!value?.trim()||value.startsWith('--')||values.has(key))throw Error('Use --family ID --request TEXT --test tests/ID.test.ts --out evidence/FRESH [--config DESIGN] [--timeout-ms 300000]');
    values.set(key,value);
  }
  for(const key of ['--family','--request','--test','--out'])if(!values.has(key))throw Error('Required option: '+key);
  const family=values.get('--family')!;
  descriptor(family);
  const timeoutMs=Number(values.get('--timeout-ms')??300000);
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>3600000)throw Error('Timeout must be an integer from 1 to 3600000 milliseconds');
  return {family,request:values.get('--request')!,test:values.get('--test')!,output:values.get('--out')!,config:values.get('--config'),timeoutMs};
}

export function contained(root:string,path:string,label:string):string {
  if(path.includes('\0')||path.includes('\\')||path.split('/').includes('..'))throw Error('Unsafe '+label+' path');
  const target=resolve(root,path),child=relative(root,target);
  if(!child||child==='..'||child.startsWith('..'+sep)||isAbsolute(child))throw Error(label+' must be contained in '+root);
  return target;
}
export async function rejectSymlinks(path:string) {
  for(let current=resolve(path);;current=dirname(current)) {
    try {if((await lstat(current)).isSymbolicLink())throw Error('Symlink path rejected: '+current);}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(current===dirname(current))break;
  }
}
export async function regularFile(path:string) {
  await rejectSymlinks(path);
  if(!(await lstat(path)).isFile())throw Error('Expected regular file: '+path);
}
export async function prepareVerification(options:VerifyOptions,root:string) {
  const test=contained(root,options.test,'test');
  contained(join(root,'tests'),test,'test');
  if(!test.endsWith('.test.ts'))throw Error('Test must end in .test.ts');
  await regularFile(test);
  const output=contained(root,options.output,'output');
  contained(join(root,'evidence'),output,'output');
  await rejectSymlinks(output);
  try {await lstat(output);throw Error('Output already exists: '+output);}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  let input:unknown={},configPath:string|undefined,inputFileSha256:string|undefined,migration:ReturnType<typeof resolveExport>['migration'];
  if(options.config) {
    configPath=contained(root,options.config,'config');
    await regularFile(configPath);
    const bytes=await readFile(configPath);
    inputFileSha256=sha256(bytes);
    const resolved=resolveExport({family:options.family},JSON.parse(bytes.toString('utf8')));input=resolved.input;migration=resolved.migration;
  }
  const build=buildAsset(options.family,input);
  try{if(migration)build.config.migration=structuredClone(migration);return {...options,root,test,output,configPath,inputFileSha256,design:build.config};}
  finally{disposeAsset(build);}
}
export type PreparedVerification=Awaited<ReturnType<typeof prepareVerification>>;

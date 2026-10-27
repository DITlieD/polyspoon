import {unstable_dev,getPlatformProxy} from 'wrangler';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Env} from './types.ts';

export interface LocalServiceOptions {port?:number;appOrigin?:string;publicDirectory?:string;publicFiles?:string[];privateRelease?:string}
export async function localService(directory:string,secret:string,initialize=true,options:LocalServiceOptions={}){
 const port=options.port??8793;if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid local port');const origin=new URL(options.appOrigin??'http://127.0.0.1:'+port);
 if(origin.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||Number(origin.port||80)!==port||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Local origin must match loopback port');
 if(!!options.publicDirectory!==!!options.publicFiles)throw new Error('Public directory and exact allowlist required together');
 const state=resolve(directory);await mkdir(state,{recursive:true});
 const config=JSON.parse(await readFile('server/wrangler.json','utf8'));config.main=resolve('server/worker.ts');config.d1_databases[0].migrations_dir=resolve('migrations');config.vars.APP_ORIGIN=origin.origin;
 if(options.privateRelease)config.vars.PRIVATE_APP_RELEASE=options.privateRelease;
 if(options.publicDirectory){config.assets={directory:resolve(options.publicDirectory),binding:'PUBLIC_ASSETS',run_worker_first:true,html_handling:'none',not_found_handling:'none'};config.vars.PUBLIC_FILES=JSON.stringify(options.publicFiles);}
 const configPath=resolve(state,'wrangler.local.json');await writeFile(configPath,JSON.stringify(config));
 const proxy=await getPlatformProxy<Env>({configPath,persist:{path:resolve(state,'v3')},remoteBindings:false,envFiles:[]});
 try{
  if(initialize){for(const path of (await readdir('migrations')).filter(path=>path.endsWith('.sql')).sort().map(path=>'migrations/'+path))await proxy.env.DB.exec((await readFile(path,'utf8')).split('\n').filter(line=>!/^\s*--/.test(line)&&line.trim()).join('\n'));}
  const worker=await unstable_dev(resolve('server/worker.ts'),{config:configPath,ip:'127.0.0.1',port,local:true,persist:true,persistTo:state,vars:{AUTH_SECRET:secret},logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});
  return {env:proxy.env,origin:origin.origin,async stop(){await worker.stop();await proxy.dispose();}};
 }catch(error){await proxy.dispose();throw error;}
}

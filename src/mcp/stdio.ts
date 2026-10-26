import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { mkdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssetServer } from './server.ts';

async function main() {
  const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
  const args=process.argv.slice(2);
  if(args.length!==0 && (args.length!==2 || args[0]!=='--output-dir' || !args[1] || !isAbsolute(args[1])))throw new Error('Usage: node --import /absolute/path/to/tsx/loader.mjs /absolute/path/to/src/mcp/stdio.ts [--output-dir /absolute/directory]');
  const requested=args[1]??resolve(project,'exports');
  await mkdir(requested,{recursive:true});
  const outputRoot=await realpath(requested);
  process.chdir(project);
  const server=await createAssetServer(outputRoot);
  const handle=serveStdio(()=>server,{onerror:error=>console.error(error.message)});
  process.once('SIGINT',()=>{void handle.close();});
  process.once('SIGTERM',()=>{void handle.close();});
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});

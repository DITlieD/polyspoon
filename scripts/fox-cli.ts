import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runRiggedCli } from './rigged-cli.ts';
import { buildFox,buildSavedFox } from '../src/rigging/fox-build.ts';
export function runFoxCli(args:string[]){return runRiggedCli(args,{build:buildFox,load:buildSavedFox});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runFoxCli(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});

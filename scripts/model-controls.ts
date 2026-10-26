// Writes src/formats/model-controls.json: the machine-readable control (knob)
// definitions for every built-in recipe family. The Worker and the agent
// bundle read this file; they never load the procedural generators.
import './node-platform.ts';
import {writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {catalog} from '../src/catalog/index.ts';
import {controlMetadata} from '../src/engine/parameters.ts';
export const controlsManifestPath='src/formats/model-controls.json';
export function controlsManifest(){
 return {formatVersion:1,kind:'polyspoon.recipe-controls',units:{length:'m',up:'+Y',handedness:'right'},families:Object.fromEntries([...catalog].sort((a,b)=>a.id.localeCompare(b.id)).map(d=>[d.id,{title:d.title,version:d.version,description:d.description,defaults:d.defaults,presets:d.presets.map(p=>({id:p.id,name:p.name,description:p.description,parameters:p.parameters})),palettes:d.palettes.map(p=>({id:p.id,label:p.label,colors:p.colors})),controls:controlMetadata(d.controls)}]))};
}
export const controlsManifestText=()=>JSON.stringify(controlsManifest(),null,1)+'\n';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const text=controlsManifestText();
 if(process.argv.includes('--check')){if((await readFile(controlsManifestPath,'utf8'))!==text){console.error(controlsManifestPath+' is stale; run npm run controls:manifest');process.exitCode=1;}}
 else{await writeFile(controlsManifestPath,text);console.log('wrote '+controlsManifestPath);}
}

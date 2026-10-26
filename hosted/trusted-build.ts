import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {readPackageZip} from '../scripts/recipe-check.ts';
import {validatePackageFiles,pinnedDependencies} from '../scripts/recipe-package-core.ts';
import {sourceDeliveryFor,sourcePackageFilename} from '../scripts/recipe-package-identity.ts';
import type {TrustedRecipe} from './app/trusted-types.ts';
interface PackageEntry {id:string;version:string;deliveryRevision:number;url:string;sha256:string;bytes:number}
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export async function verifyTrustedRecipe(entry:PackageEntry,bytes:Uint8Array,readSource:(path:string)=>Promise<Uint8Array>):Promise<TrustedRecipe>{
 if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw Error('Trusted archive identity mismatch: '+entry.id);
 const files=readPackageZip(bytes),manifest=validatePackageFiles(files),delivery=sourceDeliveryFor(manifest.formatVersion,manifest.deliveryRevision);
 if(manifest.recipe.id!==entry.id||manifest.recipe.version!==entry.version||delivery?.deliveryRevision!==entry.deliveryRevision||entry.url!=='recipe-packages/'+sourcePackageFilename(entry.id,entry.version,entry.deliveryRevision))throw Error('Trusted recipe identity mismatch: '+entry.id);
 for(const [path,record] of Object.entries(manifest.files)){
  if(!/^(src\/|examples\/recipes\/).*\.ts$/.test(path))continue;
  const current=await readSource(path);if(current.length!==record.bytes||hash(current)!==record.sha256)throw Error('Trusted implementation identity mismatch: '+path);
 }
 const notices=Object.fromEntries(Object.entries(files).filter(([path])=>path==='LICENSE'||path==='NOTICE'||path==='dependency-licenses.json'||path.startsWith('LICENSES/')));
 return {id:entry.id,version:entry.version,deliveryRevision:entry.deliveryRevision,sourceHash:manifest.provenance.sourceHash,archive:{path:'packages/'+sourcePackageFilename(entry.id,entry.version,entry.deliveryRevision),sha256:entry.sha256,bytes:entry.bytes},licenses:manifest.licenses,notices};
}
export async function trustedRecipes(root=process.cwd(),packageDirectory=resolve(root,'public/recipe-packages')){
 const directory=resolve(packageDirectory);
 const index=JSON.parse(await readFile(resolve(directory,'index.json'),'utf8')) as {formatVersion:number;packages:PackageEntry[]};
 if(index.formatVersion!==2||!Array.isArray(index.packages)||new Set(index.packages.map(entry=>entry.id)).size!==index.packages.length)throw Error('Invalid trusted recipe package index');
 const lock=JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8'));
 for(const [name,version] of Object.entries(pinnedDependencies)){
  const installed=JSON.parse(await readFile(resolve(root,'node_modules',name,'package.json'),'utf8'));
  if(installed.version!==version||lock.packages?.['node_modules/'+name]?.version!==version)throw Error('Trusted runtime dependency mismatch: '+name);
 }
 const records:TrustedRecipe[]=[];
 for(const entry of index.packages){if(!/^[a-z][a-z0-9-]*$/.test(entry.id))throw Error('Invalid built-in recipe id');const filename=sourcePackageFilename(entry.id,entry.version,entry.deliveryRevision);records.push(await verifyTrustedRecipe(entry,await readFile(resolve(directory,filename)),path=>readFile(resolve(root,path))));}
 return records;
}

import {readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceDeliveryFor,sourcePackageFilename} from './recipe-package-identity.ts';
import {readPackageZip} from './recipe-check.ts';
import {validatePackageFiles} from './recipe-package-core.ts';
import {sha256} from './provenance.ts';
import {regularFile} from './recipe-verify-input.ts';

export function selectedSourcePackage(index:any,family:string,version:string){
 if(!index||!Array.isArray(index.packages))throw Error('Invalid source package index');
 const entries=index.packages.filter((entry:any)=>entry?.id===family&&entry?.version===version);if(entries.length!==1)throw Error('Selected source package missing or ambiguous');
 const entry=entries[0],delivery=sourceDeliveryFor(index.formatVersion,entry.deliveryRevision);if(!delivery)throw Error('Unsupported source delivery identity');
 const filename=sourcePackageFilename(family,version,delivery.deliveryRevision);if(entry.url!=='recipe-packages/'+filename||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<1)throw Error('Source package index identity mismatch');
 return {...entry,...delivery,filename};
}
export async function checkSelectedPackage(indexPath:string,family:string,version:string){
 await regularFile(indexPath);const entry=selectedSourcePackage(JSON.parse(await readFile(indexPath,'utf8')),family,version),path=join(dirname(indexPath),entry.filename);await regularFile(path);const bytes=await readFile(path);
 if(bytes.length!==entry.bytes||sha256(bytes)!==entry.sha256)throw Error('Source package bytes do not match index');
 const manifest=validatePackageFiles(readPackageZip(bytes));if(manifest.recipe.id!==family||manifest.recipe.version!==version||sourceDeliveryFor(manifest.formatVersion,manifest.deliveryRevision)?.deliveryRevision!==entry.deliveryRevision)throw Error('Source package manifest identity mismatch');
 return {valid:true,executed:false,path,deliveryRevision:entry.deliveryRevision};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [index,family,version,...extra]=process.argv.slice(2);if(!index||!family||!version||extra.length)throw Error('Use index.json FAMILY VERSION');console.log(JSON.stringify(await checkSelectedPackage(index,family,version)));}

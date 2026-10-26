import { readFile, mkdir, writeFile, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zipFiles } from '../src/catalog/export.ts';
import { safePackagePath, sha256, validatePackageFiles } from './recipe-package-core.ts';
import type { PackageFiles } from './recipe-package-core.ts';

export function readPackageZip(bytes:Uint8Array):PackageFiles{
  if(bytes.length>32*1024*1024)throw new Error('Package exceeds 32 MiB limit');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files:PackageFiles={};
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let offset=0;
  while(offset+4<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
    if(offset+30>bytes.length)throw new Error('Truncated ZIP header');
    const flags=view.getUint16(offset+6,true),method=view.getUint16(offset+8,true),compressed=view.getUint32(offset+18,true),size=view.getUint32(offset+22,true),length=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
    const start=offset+30+length+extra,end=start+size;
    if(flags!==0x800||method!==0||compressed!==size||extra!==0||size>4*1024*1024||end>bytes.length)throw new Error('Unsupported or oversized ZIP entry');
    const name=safePackagePath(decoder.decode(bytes.subarray(offset+30,offset+30+length)));
    if(Object.hasOwn(files,name)||Object.keys(files).length>=512)throw new Error('Duplicate or excessive members');
    files[name]=decoder.decode(bytes.subarray(start,end));
    offset=end;
  }
  const canonical=zipFiles(Object.fromEntries(Object.entries(files).map(([path,text])=>[path,new TextEncoder().encode(text)])));
  if(sha256(bytes)!==sha256(canonical))throw new Error('Invalid ZIP structure, CRC or metadata');
  validatePackageFiles(files);
  return files;
}
export async function extractPackage(bytes:Uint8Array,directory:string){
  const files=readPackageZip(bytes);
  const target=resolve(directory);
  for(let parent=dirname(target);;parent=dirname(parent)){
    if((await lstat(parent)).isSymbolicLink())throw new Error('Symlink extraction parent');
    if(parent===dirname(parent))break;
  }
  await mkdir(target,{recursive:false});
  for(const [path,text] of Object.entries(files)){
    const parts=path.split('/');parts.pop();
    if(parts.length)await mkdir(join(target,...parts),{recursive:true});
    await writeFile(join(target,path),text,{flag:'wx'});
  }
  return validatePackageFiles(files);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(!args[0]||!(args.length===1||args.length===3&&args[1]==='--extract'))throw new Error('Use package.zip [--extract new-directory]');
  const bytes=await readFile(args[0]);
  const manifest=args[2]?await extractPackage(bytes,args[2]):validatePackageFiles(readPackageZip(bytes));
  console.log(JSON.stringify({valid:true,executed:false,recipe:manifest.recipe,files:Object.keys(manifest.files).length},null,2));
}

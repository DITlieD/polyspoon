import {readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,sep} from 'node:path';
import {contained,regularFile,rejectSymlinks} from '../../scripts/recipe-verify-input.ts';
import {sha256} from '../../scripts/provenance.ts';
import type {FileDigest} from './types.ts';

export function safePath(root:string,path:string):string {
 if(!path||isAbsolute(path)||path.includes('\\')||path.includes('\0')||path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe review evidence path: '+path);
 return contained(root,path,'review evidence');
}
export async function readBytes(root:string,path:string){const target=safePath(root,path);await regularFile(target);const bytes=await readFile(target);await regularFile(target);return bytes;}
export async function readJson(root:string,path:string){const target=safePath(root,path);await regularFile(target);if((await lstat(target)).size>16*1024*1024)throw Error('Review JSON exceeds16MiB');return JSON.parse((await readBytes(root,path)).toString('utf8'));}
export async function verifyFile(root:string,path:string,expected:FileDigest){
 if(!expected||!Number.isSafeInteger(expected.bytes)||expected.bytes<0||!/^[a-f0-9]{64}$/.test(expected.sha256))throw Error('Invalid evidence digest: '+path);
 const bytes=await readBytes(root,path);if(bytes.length!==expected.bytes||sha256(bytes)!==expected.sha256)throw Error('Evidence bytes changed: '+path);return bytes;
}
export async function writeEvidence(root:string,path:string,value:unknown,run?:string){
 const target=safePath(root,path);contained(join(root,'evidence'),target,'review output');
 if(run){const child=relative(join(root,run),target);if(!child||(!child.startsWith('..'+sep)&&child!=='..'&&!isAbsolute(child)))throw Error('Review output must not mutate its sealed run');}
 await rejectSymlinks(target);await mkdir(dirname(target),{recursive:true});await rejectSymlinks(target);await writeFile(target,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return target;
}

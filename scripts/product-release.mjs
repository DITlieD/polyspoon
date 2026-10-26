import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile,readdir,realpath} from 'node:fs/promises';
import {resolve,relative,dirname,join,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const verificationInputs=new Set(['evidence/revision5/recipes/legacy-baseline.json','evidence/revision7/catalog/seven-family-baseline.json','evidence/revision7/catalog/reviewed-defaults.json','evidence/revision7/catalog/scene-inputs.json']);
const blocked=/^(?:\.git(?:\/|$)|\.env(?:\.|\/|$)|PLAN\.md$|OUTPUTS\.md$|AGENTS\.md$|docs\/(?:references|review|implementation|pilot)(?:\/|$)|(?:hosted|server)\/\.local(?:\/|$)|(?:evidence|exports|dist|node_modules|\.runtime|\.wrangler)(?:\/|$))/;
const rules=[['credential',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|\bAKIA[A-Z0-9]{16}\b|\b(?:cfat_|sb_secret_|re_)[A-Za-z0-9_-]{20,}\b/],['private-path',/\/home\/[a-z][a-z0-9_-]*\/|\.codex\/task-state/],['private-context',/\b01[a-f0-9]{6}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b|codex[_]delegation|source[_]thread[_]id|vendor\/polyfork/i]];

export function validateReleasePaths(paths){
 if(!Array.isArray(paths)||!paths.length||new Set(paths).size!==paths.length)throw Error('Invalid release file list');
 for(const path of paths)if(typeof path!=='string'||!path||path.includes('\\')||path.startsWith('/')||path.split('/').some(part=>!part||part==='.'||part==='..')||(blocked.test(path)&&!verificationInputs.has(path))||path.split('/').some(part=>part.startsWith('.')&&part!=='.gitignore'))throw Error('Forbidden or invalid release path: '+path);
 return [...paths].sort();
}

export function scanReleaseFile(path,input,depth=0){
 const bytes=Buffer.from(input),findings=[];
 if(path.endsWith('.gz')){if(depth>=3)throw Error('Archive scan limit: '+path);return scanReleaseFile(path.slice(0,-3),gunzipSync(bytes,{maxOutputLength:64*1024*1024}),depth+1);}
 if(path.endsWith('.zip')){
  if(depth>=3||bytes.length>32*1024*1024)throw Error('Archive scan limit: '+path);
  let offset=0,members=0;
  while(offset+30<=bytes.length&&bytes.readUInt32LE(offset)===0x04034b50){
   const method=bytes.readUInt16LE(offset+8),size=bytes.readUInt32LE(offset+22),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),start=offset+30+length+extra,end=start+size;
   if(method!==0||size!==bytes.readUInt32LE(offset+18)||size>4*1024*1024||end>bytes.length||++members>512)throw Error('Unsupported release archive: '+path);
   const name=bytes.subarray(offset+30,offset+30+length).toString('utf8');validateReleasePaths([name]);findings.push(...scanReleaseFile(path+'!'+name,bytes.subarray(start,end),depth+1));offset=end;
  }
  if(!members||offset+4>bytes.length||bytes.readUInt32LE(offset)!==0x02014b50)throw Error('Invalid release archive: '+path);
  return findings;
 }
 if(path.endsWith('.glb')){
  if(bytes.length<20||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid release GLB: '+path);
  let offset=12,json;
  while(offset<bytes.length){
   if(offset+8>bytes.length)throw Error('Invalid release GLB chunk: '+path);
   const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),start=offset+8,end=start+length;
   if(length%4||end>bytes.length||(offset===12&&type!==0x4e4f534a))throw Error('Invalid release GLB chunk: '+path);
   if(type===0x4e4f534a){if(json!==undefined)throw Error('Duplicate release GLB JSON: '+path);try{json=JSON.parse(bytes.subarray(start,end).toString('utf8'));}catch{throw Error('Invalid release GLB JSON: '+path);}}
   offset=end;
  }
  if(!json||typeof json!=='object'||Array.isArray(json))throw Error('Invalid release GLB JSON: '+path);
  return scanReleaseFile(path+'!json',Buffer.from(JSON.stringify(json)),depth);
 }
 if(bytes.subarray(0,8192).includes(0))return findings;
 const text=bytes.toString('utf8');for(const [rule,pattern] of rules)if(pattern.test(text))findings.push({path,rule});return findings;
}

async function regularFile(root,path){
 const target=resolve(root,path);if(!target.startsWith(root+sep))throw Error('Source escapes root');
 let current=root;for(const part of path.split('/')){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('Symlink source: '+path);}
 if(!(await lstat(target)).isFile())throw Error('Not a regular release file: '+path);return readFile(target);
}

export async function prepareRelease({root,out,paths}){
 root=await realpath(resolve(root));out=resolve(out);const child=relative(root,out);if(!child.startsWith('.release'+sep)||child.split(sep).includes('..'))throw Error('Destination must be a fresh child of .release');
 let parent=dirname(out);while(parent!==root){try{if((await lstat(parent)).isSymbolicLink())throw Error('Symlink release destination');}catch(error){if(error.code!=='ENOENT')throw error;}parent=dirname(parent);}
 try{await lstat(out);throw Error('Release destination already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 const files={},contents=new Map(),findings=[];
 for(const path of validateReleasePaths(paths)){const bytes=await regularFile(root,path),stat=await lstat(join(root,path));findings.push(...scanReleaseFile(path,bytes));contents.set(path,bytes);files[path]={sha256:digest(bytes),bytes:bytes.length,executable:!!(stat.mode&0o111)};}
 if(findings.length)throw Error('Release scan failed: '+JSON.stringify(findings));
 for(const [path,record] of Object.entries(files))if(digest(await regularFile(root,path))!==record.sha256)throw Error('Release inputs changed: '+path);
 const manifest={formatVersion:1,files,contentHash:digest(JSON.stringify(files)),scan:{rules:rules.map(([name])=>name),findings:0,archiveContentsIncluded:true}};
 await mkdir(dirname(out),{recursive:true});await mkdir(out);
 for(const [path,bytes] of contents){await mkdir(dirname(join(out,path)),{recursive:true});await writeFile(join(out,path),bytes,{flag:'wx',mode:files[path].executable?0o755:0o644});}
 await writeFile(join(out,'.release-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 execFileSync('git',['init','--quiet','-b','codex/release-preparation',out],{stdio:'pipe'});if(execFileSync('git',['rev-parse','--show-toplevel'],{cwd:out,encoding:'utf8'}).trim()!==out)throw Error('Standalone Git root mismatch');
 await verifyRelease(out);return manifest;
}

export async function verifyRelease(root){
 root=await realpath(resolve(root));const manifest=JSON.parse(await readFile(join(root,'.release-manifest.json'),'utf8'));if(manifest.formatVersion!==1||manifest.contentHash!==digest(JSON.stringify(manifest.files)))throw Error('Release manifest mismatch');
 for(const path of validateReleasePaths(Object.keys(manifest.files))){const bytes=await regularFile(root,path),record=manifest.files[path],stat=await lstat(join(root,path));if(digest(bytes)!==record.sha256||bytes.length!==record.bytes||!!(stat.mode&0o111)!==record.executable)throw Error('Release file mismatch: '+path);if(scanReleaseFile(path,bytes).length)throw Error('Release scan failed: '+path);}
 async function walk(directory){for(const item of await readdir(directory,{withFileTypes:true})){const path=join(directory,item.name),name=relative(root,path).split(sep).join('/');if(item.isSymbolicLink())throw Error('Symlink in release: '+name);if(item.isDirectory()){if(!['.git','node_modules','server/node_modules','dist','.release','.runtime','hosted/build','hosted/.local'].includes(name))await walk(path);}else if(name!=='.release-manifest.json'&&!Object.hasOwn(manifest.files,name))throw Error('Unexpected release file: '+name);}}
 await walk(root);return {valid:true,files:Object.keys(manifest.files).length,contentHash:manifest.contentHash,scanFindings:0};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [command,...args]=process.argv.slice(2),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 if(command==='prepare'&&args.length===2&&args[0]==='--out'){const list=JSON.parse(await readFile(join(root,'scripts/product-release-files.json'),'utf8'));console.log(JSON.stringify(await prepareRelease({root,out:args[1],paths:list.files}),null,2));}
 else if(command==='verify'&&args.length===1)console.log(JSON.stringify(await verifyRelease(args[0]),null,2));
 else throw Error('Use prepare --out .release/NEW_DIRECTORY or verify SNAPSHOT_DIRECTORY');
}

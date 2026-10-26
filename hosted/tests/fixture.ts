import '../../scripts/node-platform.ts';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {localService} from '../../server/local-test.ts';
import {buildAsset,disposeAsset} from '../../src/catalog/index.ts';
import {exportAsset} from '../../src/catalog/export.ts';
import {buildHosted} from '../build.ts';
import {sourcePackageFilename} from '../../scripts/recipe-package-identity.ts';
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export async function hostedFixture(directory:string,port=8794,options:{packageDirectory?:string}={}){
 process.env.CLOUDFLARE_SEND_METRICS='false';
 const root=resolve(directory);await mkdir(root,{recursive:true});const built=await buildHosted(join(root,'release'),options);
 const publicManifest=JSON.parse(await readFile(join(root,'release/public-files.json'),'utf8'));
 const service=await localService(join(root,'state'),crypto.randomUUID()+crypto.randomUUID(),true,{port,appOrigin:'http://127.0.0.1:'+port,publicDirectory:join(root,'release/public'),publicFiles:Object.keys(publicManifest.files).map(p=>'/'+p),privateRelease:built.releaseHash});
 try{
  for(const [path,record] of Object.entries(built.files)){await service.env.LOCAL_OBJECTS!.put('applications/'+built.releaseHash+'/'+path,await readFile(join(root,'release/app',path)));await service.env.DB.prepare('INSERT INTO app_asset(release_hash,path,sha256,bytes,media_type) VALUES(?,?,?,?,?)').bind(built.releaseHash,path,record.sha256,record.bytes,record.media_type).run();}
 }catch(error){await service.stop();throw error;}
 const startMember=async(email:string,name:string)=>{
  const response=await fetch(service.origin+'/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:service.origin,'content-type':'application/json'},body:JSON.stringify({email,name,callbackURL:'/catalog'})});if(!response.ok)throw Error('Fixture library login failed: '+await response.text());
  const mail=await service.env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=? ORDER BY created_at DESC').bind(email).first<{url:string}>();if(!mail)throw Error('Fixture mail missing');
  const verified=await fetch(mail.url,{redirect:'manual'}),cookie=verified.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),me=await fetch(service.origin+'/api/me',{headers:{cookie}});if(!me.ok)throw Error('Fixture session missing');
  return {cookie,...await me.json() as {id:string}};
 };
 const author=await startMember('fixture-author@polyspoon.invalid','Fixture creator'),build=buildAsset('bench');
 let glb:Uint8Array,design:unknown;try{glb=await exportAsset(build);design=build.config;}finally{disposeAsset(build);}
 const packageDirectory=options.packageDirectory??resolve('public/recipe-packages'),packageIndex=JSON.parse(await readFile(join(packageDirectory,'index.json'),'utf8')),entry=packageIndex.packages.find((entry:{id:string})=>entry.id==='bench');if(!entry)throw Error('Fixture bench package missing');const filename=sourcePackageFilename(entry.id,entry.version,entry.deliveryRevision),archive='packages/'+filename,files:Record<string,Uint8Array>={'selected.glb':glb,'selected.design.json':new TextEncoder().encode(JSON.stringify(design,null,2)),[archive]:await readFile(join(packageDirectory,filename)),'renders/oblique.png':await readFile('src/site/previews/bench-garden.png')};
 const modelId=hash('operator-ui-fixture-'+author.id),title='Garden bench fixture';
 await service.env.DB.prepare("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,state,created_at,published_at) VALUES(?,?,?,?,?,?,'published',?,?)").bind(modelId,'garden-bench-fixture',author.id,title,'recipe',JSON.stringify({selectedDesign:design,recipe:{id:entry.id,version:entry.version,deliveryRevision:entry.deliveryRevision},artifacts:Object.fromEntries(Object.entries(files).map(([path,data])=>[path,{sha256:hash(data),bytes:data.length}])),coverage:{cases:[{id:'selected',configurationHash:hash(JSON.stringify(design)),parts:['model']}],views:[{caseId:'selected',view:'oblique',evidence:'renders/oblique.png'}]}}),Date.now(),Date.now()).run();
 for(const [path,bytes] of Object.entries(files)){await service.env.LOCAL_OBJECTS!.put('versions/'+modelId+'/'+path,bytes);await service.env.DB.prepare('INSERT INTO version_artifact(version_id,path,sha256,bytes,media_type,uploaded) VALUES(?,?,?,?,?,1)').bind(modelId,path,hash(bytes),bytes.length,path.endsWith('.glb')?'model/gltf-binary':path.endsWith('.png')?'image/png':path.endsWith('.zip')?'application/zip':'application/json').run();}
 await service.env.DB.prepare('UPDATE asset_version SET manifest_sealed=1 WHERE id=?').bind(modelId).run();
 await writeFile(join(root,'fixture-scope.json'),JSON.stringify({scope:'Local browser fixture only. A real original bench export and private app bytes are operator-provisioned directly into isolated local storage. This is not publication/review-workflow approval.',modelId,glbSha256:hash(glb),releaseHash:built.releaseHash},null,2)+'\n');
 return {...service,modelId,title,glbSha256:hash(glb),releaseHash:built.releaseHash,root,startMember,files};
}

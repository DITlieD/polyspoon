// Operator step "upload-and-readback-immutable-private-release" + "register-private-manifest".
// Usage: node --import tsx scripts/upload-private-release.ts --release .release/hosted-X --bindings $POLYSPOON_DEPLOY_DIR/bindings.json --sql OUT.sql < service-key
// Reads the Supabase service key from stdin only, uploads each private app file to
// applications/<releaseHash>/<path>, reads it back and checks SHA-256 and size,
// then writes the app_asset INSERT statements to --sql for `wrangler d1 execute --remote --file`.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),opt=(k:string)=>{const i=args.indexOf(k);if(i<0||!args[i+1])throw Error('missing '+k);return args[i+1]!;};
const release=opt('--release'),bindings=JSON.parse(await readFile(opt('--bindings'),'utf8')),sqlPath=opt('--sql'),bucket='polyspoon-private';
let key='';for await(const chunk of process.stdin)key+=chunk;key=key.trim();if(!key)throw Error('service key required on stdin');
const origin=new URL(bindings.supabase_url);if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co'))throw Error('invalid supabase_url');
const manifest=JSON.parse(await readFile(join(release,'private-release.json'),'utf8')) as {releaseHash:string;files:Record<string,{sha256:string;bytes:number;media_type:string}>};
const headers:Record<string,string>={apikey:key};if(!key.startsWith('sb_secret_'))headers.authorization='Bearer '+key;
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex'),q=(v:string)=>"'"+v.replaceAll("'","''")+"'",rows:string[]=[];
for(const [path,file] of Object.entries(manifest.files)){
 const data=new Uint8Array(await readFile(join(release,'app',path)));if(sha(data)!==file.sha256||data.length!==file.bytes)throw Error('local mismatch '+path);
 const object=new URL('/storage/v1/object/'+bucket+'/applications/'+manifest.releaseHash+'/'+path,origin);
 const put=await fetch(object,{method:'POST',headers:{...headers,'content-type':file.media_type,'x-upsert':'false'},body:data});
 if(!put.ok&&put.status!==409&&put.status!==400)throw Error('upload failed '+path+' '+put.status);
 const back=new Uint8Array(await (await fetch(new URL('/storage/v1/object/authenticated/'+bucket+'/applications/'+manifest.releaseHash+'/'+path,origin),{headers})).arrayBuffer());
 if(sha(back)!==file.sha256||back.length!==file.bytes)throw Error('readback mismatch '+path);
 rows.push('INSERT OR IGNORE INTO app_asset(release_hash,path,sha256,bytes,media_type) VALUES('+[q(manifest.releaseHash),q(path),q(file.sha256),String(file.bytes),q(file.media_type)].join(',')+');');
 console.log('verified '+path);
}
await writeFile(sqlPath,rows.join('\n')+'\n',{mode:0o600});console.log(JSON.stringify({releaseHash:manifest.releaseHash,files:rows.length,sql:sqlPath}));

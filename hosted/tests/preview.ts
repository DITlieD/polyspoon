import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hostedFixture} from './fixture.ts';
await mkdir('hosted/.local',{recursive:true});
const directory=await mkdtemp(resolve('hosted/.local/preview-')),fixture=await hostedFixture(directory);
try{
 const email='local-review@polyspoon.invalid',response=await fetch(fixture.origin+'/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:fixture.origin,'content-type':'application/json'},body:JSON.stringify({email,name:'Local review',callbackURL:'/catalog'})});
 if(!response.ok)throw Error('Local review sign-in request failed');
 const mail=await fixture.env.DB.prepare('SELECT url FROM local_mail_outbox WHERE recipient=? ORDER BY created_at DESC').bind(email).first<{url:string}>();if(!mail)throw Error('Local review mail missing');
 await writeFile(join(directory,'operator-sign-in.json'),JSON.stringify(mail)+'\n',{mode:0o600});
 console.log(JSON.stringify({origin:fixture.origin,directory,operatorSignInFile:join(directory,'operator-sign-in.json'),limits:'Local mailbox and operator-provisioned original model. No publication acceptance.'}));
 await new Promise<void>(done=>{process.once('SIGINT',done);process.once('SIGTERM',done);});
}finally{await fixture.stop();}

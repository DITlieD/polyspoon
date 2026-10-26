import {getPlatformProxy} from 'wrangler';
import {getMigrations} from 'better-auth/db/migration';
import {mkdir,writeFile} from 'node:fs/promises';
import {authentication} from './auth.ts';
import type {Env} from './types.ts';

await mkdir('server/.local/schema',{recursive:true});
const proxy=await getPlatformProxy({configPath:'server/wrangler.json',persist:{path:'server/.local/schema'},remoteBindings:false,envFiles:[]});
try{
 const env={...proxy.env,AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID()} as unknown as Env;
 const migration=await getMigrations(authentication(env).options);
 const sql=await migration.compileMigrations();
 await writeFile('migrations/0001_auth.sql',sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n')+'\n',{flag:'wx'});
 console.log(JSON.stringify({authTables:migration.toBeCreated.map(table=>table.table),sqlBytes:sql.length}));
}finally{await proxy.dispose();}

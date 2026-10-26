import type {Env} from './types.ts';

export async function bootstrapOwner(env:Pick<Env,'DB'>,inputEmail:string){
 const email=inputEmail.trim().toLowerCase();if(email.length>254||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(email))throw Error('invalid_deployment_owner');
 const owner="SELECT m.user_id FROM member m JOIN user u ON u.id=m.user_id WHERE u.email=? AND u.emailVerified=1 AND m.status='active'";
 const results=await env.DB.batch([
  env.DB.prepare("INSERT OR IGNORE INTO capability(user_id,name) SELECT user_id,'admin' FROM ("+owner+") WHERE NOT EXISTS(SELECT 1 FROM capability WHERE name='admin') RETURNING user_id").bind(email),
  env.DB.prepare("INSERT INTO audit_event(id,actor_id,action,target,data,created_at) SELECT ?,user_id,'deployment_owner_bootstrapped',user_id,'{}',? FROM ("+owner+") WHERE changes()=1").bind(crypto.randomUUID(),Date.now(),email),
  env.DB.prepare("SELECT user_id FROM ("+owner+") AS owner_member WHERE EXISTS(SELECT 1 FROM capability c WHERE c.user_id=owner_member.user_id AND c.name='admin')").bind(email),
 ]);
 if(!results[2]?.results.length)throw Error('owner_bootstrap_unavailable');return {bootstrapped:true,alreadyConfigured:!results[0]?.results.length};
}

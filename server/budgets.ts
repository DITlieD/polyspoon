import type {Env} from './types.ts';
import {HttpError} from './domain.ts';

export function admissionError(error:unknown):never {
 const message=error instanceof Error?error.message:String(error);
 if(message.includes('authority_changed'))throw new HttpError(409,'authority_changed');
 for(const code of ['mail_budget_exhausted','storage_budget_exhausted','submission_budget_exhausted','token_budget_exhausted','job_budget_exhausted','report_budget_exhausted'])if(message.includes(code))throw new HttpError(429,code);
 throw error;
}
export async function reserveStorage(env:Env,id:string,owner:string,kind:'source'|'evidence'|'processing',bytes:number){
 try{await env.DB.prepare('INSERT OR IGNORE INTO storage_reservation(id,owner_id,kind,bytes) VALUES(?,?,?,?)').bind(id,owner,kind,bytes).run();}catch(error){admissionError(error);}
 const row=await env.DB.prepare('SELECT owner_id,kind,bytes FROM storage_reservation WHERE id=?').bind(id).first<{owner_id:string;kind:string;bytes:number}>();
 if(!row||row.owner_id!==owner||row.kind!==kind||row.bytes!==bytes)throw new HttpError(409,'storage_reservation_conflict');
}
export async function reserveMail(env:Env){
 const now=new Date().toISOString();
 try{await env.DB.prepare('INSERT INTO mail_reservation(id,day,month) VALUES(?,?,?)').bind(crypto.randomUUID(),now.slice(0,10),now.slice(0,7)).run();}catch(error){admissionError(error);}
}

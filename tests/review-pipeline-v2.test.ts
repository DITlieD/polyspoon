import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {realpathSync} from 'node:fs';
const realNode=()=>realpathSync(process.execPath);
import {uploadRoutes,DAILY_UPLOAD_CAP} from '../server/uploads.ts';
import {reviewQueueRoutes,CLAIM_MS} from '../server/review-queue.ts';
import {validateUpload,sniffFormat} from '../server/upload-validation.ts';
import {jailArgs,sandboxedCheck} from '../processor/ingest-sandbox.ts';
import {memberTokenScopes,type Principal} from '../server/domain.ts';

class Stmt{constructor(readonly db:DatabaseSync,readonly sql:string,readonly args:unknown[]=[]){}
 bind(...args:unknown[]){return new Stmt(this.db,this.sql,args);}
 private exec(){return this.db.prepare(this.sql).all(...(this.args as never[])) as Record<string,unknown>[];}
 async first<T>(){return (this.exec()[0]??null) as T|null;}
 async all<T>(){return {results:this.exec() as T[]};}
 async run(){this.exec();return {success:true};}
 _rows(){return this.exec();}}
function setup(){
 const db=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').sort())db.exec(readFileSync('migrations/'+f,'utf8'));
 const D1={prepare:(sql:string)=>new Stmt(db,sql),batch:async(list:Stmt[])=>{db.exec('BEGIN');try{const out=list.map(s=>({results:s._rows()}));db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const store=new Map<string,Uint8Array>();
 const objects={async read(k:string){return store.get(k)??null;},async readUpTo(k:string){return store.get(k)??null;},async putIfAbsent(k:string,d:Uint8Array){if(store.has(k))return false;store.set(k,d);return true;}};
 return {db,store,objects:()=>objects,env:{DB:D1,APP_ENV:'local'} as never};
}
function member(db:DatabaseSync,id:string,caps:string[]=[],scopes?:string[]){
 db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)').run(id,'Member '+id,id+'@x.invalid');db.prepare("INSERT INTO member(user_id,status,created_at) VALUES(?,'active',0)").run(id);
 for(const c of caps)db.prepare('INSERT INTO capability VALUES(?,?)').run(id,c);
 return {id,status:'active',verified:true,capabilities:caps,scopes} as Principal;
}
function awaiting(db:DatabaseSync,creator:string,n:number){
 const id=String(n).padStart(64,'a');db.prepare("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,?,?,?,'static','{}',0)").run(id,'asset-'+n,creator,'Model '+n);
 for(const s of ['submitted','processing','awaiting_review'])db.prepare('UPDATE asset_version SET state=? WHERE id=?').run(s,id);return id;
}
function glb(doc:Record<string,unknown>,bin=new Uint8Array(36)){
 let json=Buffer.from(JSON.stringify(doc));const pad=(4-json.length%4)%4;json=Buffer.concat([json,Buffer.alloc(pad,0x20)]);
 const total=12+8+json.length+8+bin.length,out=Buffer.alloc(total);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
 out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);const b=20+json.length;out.writeUInt32LE(bin.length,b);out.writeUInt32LE(0x004e4942,b+4);Buffer.from(bin).copy(out,b+8);return new Uint8Array(out);
}
const triangle=(extra:Record<string,unknown>={})=>{const bin=new Float32Array([0,0,0,1,0,0,0,1,0]);return glb({asset:{version:'2.0',generator:'zenov'},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{name:'tri',primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0,name:'root'}],scenes:[{nodes:[0]}],scene:0,...extra},new Uint8Array(bin.buffer));};
const sha=(d:Uint8Array)=>createHash('sha256').update(d).digest('hex');
async function call(routes:(r:Request,e:never,a:Principal,p:string)=>Promise<Response|null>,env:never,actor:Principal,method:string,path:string,body?:unknown){
 const init:RequestInit={method,headers:{'content-type':'application/json'}};if(body instanceof Uint8Array){init.body=body as unknown as BodyInit;init.headers={'content-type':'application/octet-stream'};}else if(body!==undefined)init.body=JSON.stringify(body);
 try{const r=await routes(new Request('https://x.invalid'+path,init),env,actor,path.split('?')[0]!);if(!r)return {status:404,body:{}};return {status:r.status,body:await r.json() as any};}catch(e:any){if(e.status===undefined)throw e;return {status:e.status,body:{error:e.code}};}
}
const up=(s:ReturnType<typeof setup>,a:Principal,m:string,p:string,b?:unknown)=>call((r,e,ac,pa)=>uploadRoutes(r,e,ac,pa,s.objects),s.env,a,m,p,b);
const q=(s:ReturnType<typeof setup>,a:Principal,m:string,p:string,b?:unknown)=>call(reviewQueueRoutes,s.env,a,m,p,b);

test('migration 0014 has no comment lines and its logs are append-only',()=>{
 assert.ok(!readFileSync('migrations/0014_review_pipeline_v2.sql','utf8').split('\n').some(l=>l.trim().startsWith('--')));
 const s=setup();s.db.prepare("INSERT INTO queue_event_log(version_id,kind,created_at) VALUES('x','enqueued',0)").run();
 assert.throws(()=>s.db.prepare('UPDATE queue_event_log SET kind=?').run('claimed'),/append_only/);
 assert.throws(()=>s.db.prepare('DELETE FROM queue_event_log').run(),/append_only/);
 assert.throws(()=>s.db.prepare("INSERT INTO safety_report(id,upload_id,version_id,policy_version,outcome,summary,report_sha256,created_at) VALUES('r',NULL,NULL,'p','csam_hold','{}',?,0)").run('a'.repeat(64)));
});

test('GLB and glTF structural validation',()=>{
 const ok=triangle();assert.equal(sniffFormat(ok),'glb');const r=validateUpload(ok,'glb');assert.ok(r.ok);if(r.ok){assert.equal(r.triangles,1);assert.ok(r.strings.includes('zenov')&&r.strings.includes('root'));}
 assert.deepEqual(validateUpload(ok,'gltf'),{ok:false,reason:'magic_mismatch'});
 assert.deepEqual(validateUpload(triangle({images:[{uri:'https://evil.invalid/x.png'}]}),'glb'),{ok:false,reason:'external_resource'});
 assert.deepEqual(validateUpload(triangle({extensionsUsed:['EXT_evil']}),'glb'),{ok:false,reason:'unsupported_extension'});
 const bad=triangle();bad[8]=1;assert.deepEqual(validateUpload(bad,'glb'),{ok:false,reason:'glb_length'});
 const gltf=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'data:application/octet-stream;base64,'+Buffer.from(new Float32Array(9).buffer).toString('base64'),byteLength:36}],accessors:[{count:3}],meshes:[{primitives:[{attributes:{POSITION:0}}]}]}));
 assert.ok(validateUpload(gltf,'gltf').ok);
 assert.deepEqual(validateUpload(new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'scene.bin'}]})),'gltf'),{ok:false,reason:'external_resource'});
});

test('upload slot -> PUT -> complete; owner-only status; coarse reasons; tokens need uploads:write',async()=>{
 const s=setup(),web=member(s.db,'web'),other=member(s.db,'other'),data=triangle();
 const slot=await up(s,web,'POST','/api/uploads',{format:'glb',bytes:data.length,sha256:sha(data)});assert.equal(slot.status,201);
 assert.match(slot.body.putUrl,/^\/api\/uploads\/[0-9a-f-]{36}\/content$/);const id=slot.body.uploadId;
 assert.equal(s.db.prepare('SELECT object_key FROM uploads WHERE id=?').get(id)!.object_key,'ingest/'+id+'/original');
 assert.equal((await up(s,other,'PUT','/api/uploads/'+id+'/content',data)).status,404);
 assert.equal((await up(s,web,'PUT','/api/uploads/'+id+'/content',data)).status,200);
 assert.equal((await up(s,other,'GET','/api/uploads/'+id)).status,404);
 const done=await up(s,web,'POST','/api/uploads/'+id+'/complete',{title:'Triangle'});assert.equal(done.status,202);assert.equal(done.body.upload.status,'queued');
 assert.equal(s.db.prepare('SELECT status FROM uploads WHERE id=?').get(id)!.status,'pending_scan');
 assert.equal((await up(s,web,'POST','/api/uploads/'+id+'/complete',{title:'Again'})).status,409);
 const evil=triangle({images:[{uri:'https://evil.invalid/x.png'}]});const slot2=await up(s,web,'POST','/api/uploads',{format:'glb',bytes:evil.length,sha256:sha(evil)});
 await up(s,web,'PUT','/api/uploads/'+slot2.body.uploadId+'/content',evil);const rej=await up(s,web,'POST','/api/uploads/'+slot2.body.uploadId+'/complete',{title:'Evil'});
 assert.deepEqual([rej.body.upload.status,rej.body.upload.reason],['rejected','invalid_file']);
 const liar=await up(s,web,'POST','/api/uploads',{format:'glb',bytes:data.length,sha256:'0'.repeat(64)});await up(s,web,'PUT','/api/uploads/'+liar.body.uploadId+'/content',data);
 assert.equal((await up(s,web,'POST','/api/uploads/'+liar.body.uploadId+'/complete',{title:'Liar'})).body.upload.status,'rejected');
 assert.equal((await up(s,web,'POST','/api/uploads',{format:'blend',bytes:5,sha256:sha(data)})).body.error,'unsupported_format');
 assert.equal((await up(s,web,'POST','/api/uploads',{format:'glb',bytes:60*1024*1024,sha256:sha(data)})).status,413);
 assert.equal((await up(s,web,'POST','/api/uploads',{format:'glb',bytes:5,sha256:sha(data),source:'zenov'})).body.error,'zenov_requires_token');
 const voter={...member(s.db,'voter'),scopes:['votes:write']};assert.equal((await up(s,voter,'POST','/api/uploads',{format:'glb',bytes:5,sha256:sha(data)})).body.error,'token_scope_required');
});

test('zenov token uploads take the same path and gain no review, vote or queue powers',async()=>{
 const s=setup();member(s.db,'owner',['admin']);const zenov={...member(s.db,'owner2'),capabilities:['admin'],scopes:memberTokenScopes(['uploads:write','catalog:read'])},data=triangle();
 const slot=await up(s,zenov,'POST','/api/uploads',{format:'glb',bytes:data.length,sha256:sha(data),source:'zenov'});assert.equal(slot.status,201);
 await up(s,zenov,'PUT','/api/uploads/'+slot.body.uploadId+'/content',data);
 const done=await up(s,zenov,'POST','/api/uploads/'+slot.body.uploadId+'/complete',{title:'Gen',provenance:{generator:'zenov',seed:7}});
 assert.equal(done.body.upload.status,'queued');assert.equal(s.db.prepare('SELECT source,status,version_id FROM uploads').get()!.source,'zenov');
 assert.equal(s.db.prepare('SELECT version_id FROM uploads').get()!.version_id,null);
 assert.equal(s.db.prepare('SELECT count(*) AS n FROM review_record').get()!.n,0);
 assert.equal((await q(s,zenov,'GET','/api/moderation/queue')).body.error,'interactive_session_required');
});

test('daily upload cap',async()=>{
 const s=setup(),a=member(s.db,'a'),d=triangle();
 for(let i=0;i<DAILY_UPLOAD_CAP;i++)assert.equal((await up(s,a,'POST','/api/uploads',{format:'glb',bytes:d.length,sha256:sha(d)})).status,201);
 assert.equal((await up(s,a,'POST','/api/uploads',{format:'glb',bytes:d.length,sha256:sha(d)})).body.error,'daily_upload_cap');
});

test('queue: claim lock, heartbeat, no double decision, own content, history, polling events',async()=>{
 const s=setup(),maker=member(s.db,'maker'),ana=member(s.db,'ana',['reviewer:visual']),ben=member(s.db,'ben',['moderator']),plain=member(s.db,'plain');
 const v=awaiting(s.db,'maker',1),own=awaiting(s.db,'ana',2);
 assert.equal((await q(s,plain,'GET','/api/moderation/queue')).body.error,'reviewer_required');
 const list=await q(s,ana,'GET','/api/moderation/queue');assert.equal(list.body.items.length,2);
 assert.equal((await q(s,ana,'POST','/api/moderation/queue/'+own+'/claim',{})).body.error,'own_content');
 const c=await q(s,ana,'POST','/api/moderation/queue/'+v+'/claim',{});assert.equal(c.status,200);
 assert.equal((await q(s,ben,'POST','/api/moderation/queue/'+v+'/claim',{})).body.error,'already_claimed');
 assert.equal((await q(s,ben,'POST','/api/moderation/queue/'+v+'/decision',{revision:c.body.revision,decision:'approve'})).body.error,'claim_lost');
 assert.equal((await q(s,ana,'POST','/api/moderation/queue/'+v+'/heartbeat',{revision:c.body.revision})).status,200);
 const seen=await q(s,ben,'GET','/api/moderation/queue');assert.equal(seen.body.items.find((i:any)=>i.versionId===v).claimedByName,'Member ana');
 assert.equal((await q(s,ana,'POST','/api/moderation/queue/'+v+'/decision',{revision:c.body.revision,decision:'reject'})).body.error,'note_required');
 const d=await q(s,ana,'POST','/api/moderation/queue/'+v+'/decision',{revision:c.body.revision,decision:'approve'});assert.equal(d.body.next,'publisher_review_required');
 assert.equal((await q(s,ana,'POST','/api/moderation/queue/'+v+'/decision',{revision:c.body.revision,decision:'approve'})).status,409);
 assert.equal(s.db.prepare('SELECT state FROM asset_version WHERE id=?').get(v)!.state,'awaiting_review');
 assert.equal((await q(s,ben,'GET','/api/moderation/queue')).body.items.length,1);
 const ev=await q(s,ben,'GET','/api/moderation/queue/events?after=0');assert.deepEqual(ev.body.events.filter((e:any)=>e.versionId===v).map((e:any)=>e.kind),['enqueued','claimed','decided']);
 const empty=await q(s,ben,'GET','/api/moderation/queue/events?after='+ev.body.cursor);assert.deepEqual(empty.body.events,[]);
 const detail=await q(s,ben,'GET','/api/moderation/queue/'+own);assert.equal(detail.body.history[0].kind,'enqueued');
});

test('queue: expired claims are released and can be taken over; only moderators override',async()=>{
 const s=setup();member(s.db,'maker');const ana=member(s.db,'ana',['reviewer:visual']),ben=member(s.db,'ben',['moderator']);const v=awaiting(s.db,'maker',3);
 await q(s,ana,'GET','/api/moderation/queue');const c=await q(s,ana,'POST','/api/moderation/queue/'+v+'/claim',{});
 assert.equal((await q(s,ana,'POST','/api/moderation/queue/'+v+'/override',{revision:c.body.revision,outcome:'clean',reason:'fine'})).body.error,'moderator_required');
 s.db.prepare('UPDATE review_queue SET claim_expires_at=? WHERE version_id=?').run(Date.now()-1,v);
 const b=await q(s,ben,'POST','/api/moderation/queue/'+v+'/claim',{});assert.equal(b.status,200);
 assert.equal((await q(s,ana,'POST','/api/moderation/queue/'+v+'/heartbeat',{revision:c.body.revision})).body.error,'claim_lost');
 assert.equal((await q(s,ben,'POST','/api/moderation/queue/'+v+'/override',{revision:b.body.revision,outcome:'clean',reason:'false positive'})).status,200);
 assert.equal(s.db.prepare('SELECT state FROM asset_version WHERE id=?').get(v)!.state,'awaiting_review');
 assert.ok(CLAIM_MS===600000);
 s.db.prepare("UPDATE asset_version SET state='changes_requested' WHERE id=?").run(v);assert.equal((await q(s,ben,'GET','/api/moderation/queue')).body.items.length,0);
});

const hasBwrap=spawnSync('bwrap',['--unshare-all','--ro-bind','/','/','--dev','/dev','true']).status===0;
test('sandboxed parse runs with no network and rejects hostile files',{skip:!hasBwrap&&'bwrap unavailable'},async()=>{
 const args=jailArgs('/dev/null','glb');assert.ok(args.includes('--unshare-all')&&args.includes('--clearenv'));
 const dir=mkdtempSync(join(tmpdir(),'ingest-')),good=join(dir,'good.glb'),bad=join(dir,'bad.glb');writeFileSync(good,triangle());writeFileSync(bad,triangle({buffers:[{byteLength:36,uri:'http://169.254.169.254/'}]}));
 const ok=await sandboxedCheck(good,'glb');assert.equal(ok.ok,true,JSON.stringify(ok));
 assert.deepEqual(await sandboxedCheck(bad,'glb'),{ok:false,reason:'external_resource'});
 const ifaces=spawnSync('bwrap',[...jailArgs(good,'glb').slice(0,jailArgs(good,'glb').indexOf(realNode())),'/bin/sh','-c','tail -n +3 /proc/net/dev | cut -d: -f1']);
 assert.equal(String(ifaces.stdout).trim(),'lo');
});

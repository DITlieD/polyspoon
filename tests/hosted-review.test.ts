import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketplaceClient} from '../hosted/shared/http.ts';
import {uploadReviewEvidence,revokeReview} from '../hosted/app/review-actions.ts';

test('review evidence uploads exact bytes under their calculated digest',async()=>{
 const bytes=new TextEncoder().encode('actual inspection evidence');let path='',body:BodyInit|null|undefined;
 const api=new MarketplaceClient('https://polyspoon.example',async(url,options)=>{path=new URL(String(url)).pathname;body=options?.body;return Response.json({sha256:path.split('/').at(-1),bytes:bytes.length},{status:201});});
 const record=await uploadReviewEvidence(api,new File([bytes],'inspection.txt'));
 assert.match(record.sha256,/^[a-f0-9]{64}$/);assert.equal(path,'/api/review-evidence/'+record.sha256);assert.deepEqual(new Uint8Array(body as ArrayBuffer),bytes);assert.equal(record.bytes,bytes.length);
});

test('oversized attachments and malformed revocations make no request',async()=>{
 let calls=0;const api=new MarketplaceClient('https://polyspoon.example',async()=>{calls++;return Response.json({});});
 await assert.rejects(()=>uploadReviewEvidence(api,new File([new Uint8Array(2*1024*1024+1)],'large.bin')),/2 MiB/);
 await assert.rejects(()=>revokeReview(api,'invalid','Reason'),/record/);await assert.rejects(()=>revokeReview(api,'a'.repeat(64),' '),/reason/);assert.equal(calls,0);
});

test('review revocation sends the exact record and required reason',async()=>{
 const api=new MarketplaceClient('https://polyspoon.example',async(url,options)=>{assert.equal(new URL(String(url)).pathname,'/api/reviews/'+'a'.repeat(64)+'/revoke');assert.equal(options?.method,'POST');assert.deepEqual(JSON.parse(String(options?.body)),{reason:'New evidence invalidates this inspection'});return Response.json({revoked:true});});
 await revokeReview(api,'a'.repeat(64),' New evidence invalidates this inspection ');
});

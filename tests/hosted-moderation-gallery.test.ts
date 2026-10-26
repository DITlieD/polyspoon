import test from 'node:test';
import assert from 'node:assert/strict';
import {galleryViewPlan} from '../hosted/app/review-gallery.ts';
import {Resources} from '../hosted/app/types.ts';
import {MarketplaceClient} from '../hosted/shared/http.ts';

test('gallery keeps all thirteen views and limits duplicate and excessive declarations explicitly',()=>{
 const views=Array.from({length:13},(_,i)=>({caseId:'selected',view:'view-'+i,evidence:'renders/'+i+'.png'}));
 const complete=galleryViewPlan(views);assert.deepEqual(complete.views,views);assert.equal(complete.duplicates,0);assert.equal(complete.excess,0);
 const duplicates=galleryViewPlan([...views,...views]);assert.deepEqual(duplicates.views,views);assert.equal(duplicates.duplicates,13);assert.equal(duplicates.excess,0);
 const many=galleryViewPlan(Array.from({length:1000},(_,i)=>({caseId:'selected',view:'view-'+i,evidence:'renders/'+i+'.png'})));assert.equal(many.views.length,64);assert.equal(many.excess,936);
});

test('individual URL release and session cleanup revoke each owned resource once',()=>{
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL,revoked:string[]=[];let count=0;
 URL.createObjectURL=()=> 'blob:gallery-'+(++count);URL.revokeObjectURL=url=>{revoked.push(url);};
 try{const resources=new Resources(),first=resources.create(new Blob(['first'])),second=resources.create(new Blob(['second']));resources.release(first);resources.release(first);assert.deepEqual(revoked,[first]);resources.clear();assert.deepEqual(revoked,[first,second]);resources.release(second);assert.deepEqual(revoked,[first,second]);}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});

test('gallery byte requests preserve abort signals and reject cancelled image downloads',async()=>{
 const controller=new AbortController();let signal:AbortSignal|null|undefined;
 const api=new MarketplaceClient('https://polyspoon.example',async(_url,options)=>{signal=options?.signal;return new Promise((_resolve,reject)=>{options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});});
 const pending=api.bytes('/api/versions/version/files?path=image.png',{signal:controller.signal});controller.abort();await assert.rejects(pending,/Aborted/);assert.equal(signal,controller.signal);
});

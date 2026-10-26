import {MarketplaceClient,verifyArtifact} from '../shared/http.ts';
export async function uploadReviewEvidence(api:MarketplaceClient,file:File){
 if(file.size>2*1024*1024)throw Error('Review evidence must be at most 2 MiB.');
 const bytes=await file.arrayBuffer(),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
 const record=await api.json<{sha256:string;bytes:number}>('/api/review-evidence/'+sha256,{method:'PUT',headers:{'content-type':'application/octet-stream'},body:bytes});
 await verifyArtifact(new Uint8Array(bytes),record);return record;
}
export async function revokeReview(api:MarketplaceClient,id:string,reason:string){
 if(!/^[a-f0-9]{64}$/.test(id))throw Error('Choose a valid review record ID.');
 if(!reason.trim()||reason.trim().length>1000)throw Error('Give a reason of at most 1000 characters.');
 return api.json('/api/reviews/'+id+'/revoke',{method:'POST',body:JSON.stringify({reason:reason.trim()})});
}

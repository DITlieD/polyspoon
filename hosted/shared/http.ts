export class ApiFailure extends Error {
 constructor(readonly status:number,readonly code:string){super(code);this.name='ApiFailure';}
}
export type Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
export class MarketplaceClient {
 private epoch=0;
 constructor(readonly origin:string,private readonly fetcher:Fetcher=fetch,private readonly lost:()=>void=()=>{},private readonly changed:()=>void=()=>{}){}
 async request(path:string,options:RequestInit={}):Promise<Response>{
  const url=new URL(path,this.origin);
  if(!path.startsWith('/api/')||url.origin!==new URL(this.origin).origin)throw Error('Only same-origin API requests are allowed');
  const epoch=this.epoch,headers=new Headers(options.headers);
  if(options.body&&typeof options.body==='string')headers.set('content-type','application/json');
  const fetcher=this.fetcher,response=await fetcher(url,{...options,headers,credentials:'same-origin',cache:'no-store',redirect:'error'});
  if(epoch!==this.epoch)throw new ApiFailure(401,'session_changed');
  if(!response.ok){
   const value=await response.clone().json().catch(()=>({}));
   const code=typeof value.error==='string'?value.error:typeof value.code==='string'?value.code:'request_failed';
   if(response.status===401||code==='active_verified_membership_required'){this.epoch++;this.lost();}
   else if(['account_restricted','capability_required','moderation_capability_required','review_capability_required','authority_changed','authority_or_record_changed'].includes(code)){this.epoch++;this.changed();}
   throw new ApiFailure(response.status,code);
  }
  return response;
 }
 async json<T=unknown>(path:string,options:RequestInit={}):Promise<T>{const epoch=this.epoch,response=await this.request(path,options),value=await response.json();if(epoch!==this.epoch)throw new ApiFailure(401,'session_changed');return value as T;}
 async bytes(path:string,options:RequestInit={}):Promise<Uint8Array>{const epoch=this.epoch,response=await this.request(path,options),value=new Uint8Array(await response.arrayBuffer());if(epoch!==this.epoch)throw new ApiFailure(401,'session_changed');return value;}
}
export function explain(error:unknown){
 if(!(error instanceof ApiFailure))return 'The service could not be reached. Please try again.';
 const known:Record<string,string>={review_capability_required:"Your account does not have review access. Current permissions are being checked.","account_restricted":"This account is restricted. Your notice and appeal remain available.","address_temporarily_blocked":"This network address is temporarily blocked from new submissions and reports. Sign-in, account notices and appeals remain available.","moderation_capability_required":"Your moderation permission changed. Your current account access is being checked.","moderation_target_forbidden":"You cannot moderate your own content or this protected account.","already_resolved":"This case already has a different final decision. Refresh to see its current state.","authority_or_record_changed":"Your authority or this case changed. Refresh before acting again.","authority_changed":"Your permissions changed. Your current account access is being checked.","restriction_changed":"The restriction changed. Refresh your account notice before appealing.","invalid_address_block":"Enter a valid IP address, a reason, and an expiry from 1 minute to 24 hours.","report_reason_required":"Choose a report category and give a reason of up to 1000 characters.","resolution_reason_required":"Choose a decision and give a reason of up to 1000 characters.","appeal_message_required":"Give an appeal message of up to 1000 characters.",authentication_required:'Your session has ended. Sign in again.',session_changed:'Your session changed. Sign in again.',active_verified_membership_required:'This account cannot access the catalog. Contact support if you need help.',mail_provider_unconfigured:'Email sign-in is not configured on this service yet.',mail_provider_unavailable:'The email service is unavailable. Try again later.',mail_quota_reached:'Email delivery is temporarily limited. Try again later.',artifact_digest_mismatch:'The selected file does not match its verification record.',artifact_integrity_mismatch:'The downloaded file did not match its verified identity. Nothing was saved.',invalid_transition:'This submission changed state. Refresh before trying again.',version_or_authority_changed:'The submission or your permissions changed. Refresh and try again.',capability_required:'Your account does not have permission for this action.',contributor_self_review_forbidden:'You cannot review your own submission.',isolated_processing_required:'This version requires completed isolated technical processing. Refresh its processing status.',artifact_missing_or_changed:'The stored evidence is missing or changed. Refresh its status and contact support.',approval_stale:'Review or authority changed. The version must be reviewed again before publication.'};
 return known[error.code]??(error.status===429?'Too many requests. Wait a moment and try again.':error.status===404?'The requested item or feature is not available.':error.status===403?'Your account cannot perform this action.':error.status===503?'This part of the service is not configured or available yet.':'The request could not be completed. Check the input and try again.');
}
export async function verifyArtifact(bytes:Uint8Array,expected:{sha256:string;bytes:number}){
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes)))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(bytes.length!==expected.bytes||digest!==expected.sha256)throw new ApiFailure(409,'artifact_integrity_mismatch');return bytes;
}

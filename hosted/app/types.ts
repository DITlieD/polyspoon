import type {MarketplaceClient} from '../shared/http.ts';
export interface Member {id:string;email?:string;displayName?:string;status:string;verified:boolean;capabilities:string[];scopes:string[]|null}
export interface Model {id:string;asset_id:string;title:string;kind:string;published_at:number|null;votes:number;voted:boolean;type:string|null;style:string|null;metadataSource:'registered-recipe'|'unclassified';preview:Artifact|null}
export interface CatalogFacet {value:string;label:string;count:number}
export interface CatalogPage {models:Model[];total:number;offset:number;limit:number;nextOffset:number|null;facets:{types:CatalogFacet[];styles:CatalogFacet[]}}
export interface Artifact {path:string;sha256:string;bytes:number;media_type:string}
export interface ModelDetail extends Omit<Model,'preview'> {design:{family:string;familyVersion:string;applied:Record<string,unknown>};artifacts:Artifact[];capabilities:string[];recipe:{id:string;version:string;deliveryRevision:number}|null;sourcePackage:Artifact|null;delivery:{primary:string[];previews:string[];preview:string|null}}
export interface Version {id:string;asset_id:string;title:string;kind:string;state:string;created_at:number;published_at?:number;contributor_id?:string;processing_requirement?:'legacy'|'package-replay-v1';processing_policy_version?:string}
export interface VerificationProgress {profile:'receipts-v1'|'legacy';totalFiles:number;totalBytes:number;uploadedFiles:number;verifiedFiles:number;complete:boolean;pendingPaths:string[];failedPaths:string[]}
export interface SubmissionSubject {subjectId:string;artifacts:Record<string,{sha256:string;bytes:number}>;report:{sha256:string;bytes:number};[key:string]:unknown}
export interface VersionDetail extends Version {subject:SubmissionSubject;verification:VerificationProgress}
export class Resources {
 private readonly urls=new Set<string>();
 private readonly cleanup=new Set<()=>void>();
 add(cleanup:()=>void){this.cleanup.add(cleanup);return ()=>this.cleanup.delete(cleanup);}
 create(blob:Blob){const url=URL.createObjectURL(blob);this.urls.add(url);return url;}
 release(url:string){if(this.urls.delete(url))URL.revokeObjectURL(url);}
 clear(){for(const cleanup of this.cleanup)cleanup();this.cleanup.clear();for(const url of this.urls)URL.revokeObjectURL(url);this.urls.clear();}
}
export interface Context {api:MarketplaceClient;member:Member;resources:Resources;refreshAccess?:()=>void}
export interface ProcessingJob {id:string;profile:string;status:'pending'|'running'|'passed'|'failed'|'exhausted';attempts:number;leaseExpiresAt:number|null;firstFailure:{check:string;code:string}|null;technicalRecordId:string|null;ready:boolean;result:{status:string;artifacts:Record<string,{sha256:string;bytes:number;media_type:string}>}|null}

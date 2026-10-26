import type {Design} from '../catalog/index.ts';

export interface FileDigest {sha256:string;bytes:number}
export type ReviewCategory='technical'|'visual'|'portability'|'executable-source';
export type Decision='pass'|'fail'|'uncertain';
export interface ReviewCase {id:string;configurationHash:string;parts:string[]}
export interface ReviewView {caseId:string;view:string;evidence:string}
export interface ReviewSubject {
 formatVersion:1;
 kind:'review-subject';
 subjectId:string;
 scope:'recipe-verification'|'bounded-run';
 request:string;
 recipe:{id:string;version:string;deliveryRevision:number};
 selectedDesign:Design;
 run:string;
 report:FileDigest & {path:'report.json'};
 technical:{status:'technical-success';stages:string[]};
 source:{sourceHash:string;lockHash:string;node:string;dependencies:Record<string,{requested:string;version:string}>;sources:Record<string,string>;verificationInputs:Record<string,string>};
 coverage:{cases:ReviewCase[];views:ReviewView[]};
 artifacts:Record<string,FileDigest>;
 artifactManifestHash:string;
 limits:string[];
}
export interface Finding {caseId:string;part:string;view:string;evidence:string[];observation:string;decision:Decision;defect?:string;proposedCorrection?:string}
export interface SourceInspection {inspected:string[];redistributionScope:string}
export interface ReviewDraft {
 category:ReviewCategory;
 reviewerId:string;
 decision:Decision;
 coverage:string[];
 findings:Finding[];
 attachments?:Record<string,FileDigest>;
 sourceInspection?:SourceInspection;
 limits:string[];
}
export interface ReviewRecord extends ReviewDraft {formatVersion:1;kind:'verification-attestation'|'review-record';recordId:string;subjectId:string;artifactManifestHash:string;reportSha256:string}
export interface Principal {id:string;capabilities:ReviewCategory[];active:boolean}
export interface TrustedAuthority {
 principals:Principal[];
 technicalRecords:ReviewRecord[];
 reviewRecords:ReviewRecord[];
 assignments:Record<string,{technical:string[];reviews:string[]}>;
 revoked:string[];
 replaced:Record<string,string>;
}
export interface Eligibility {kind:'local-eligibility-evidence';subjectId:string;eligible:boolean;categories:Record<ReviewCategory,Decision|'missing'>;blockers:string[];limits:string[]}

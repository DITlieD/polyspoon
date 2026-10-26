import {z} from 'zod';
import {canonical,HttpError} from './domain.ts';

export const processingRequirement={profile:'package-replay-v1',policyVersion:'linux-bwrap-cgroup-v1'} as const;
export const requiredArtifacts={'outputs.zip':{media_type:'application/zip',minBytes:128,maxBytes:2097152},'validation.json':{media_type:'application/json',minBytes:64,maxBytes:2097152},'execution.json':{media_type:'application/json',minBytes:64,maxBytes:2097152}} as const;
export const stageIds=['input-check','compile','replay-a','replay-b','validate'] as const;
export const checkIds=['sandbox-policy','input-integrity','source-package','case-bindings','compile','replay-repeat','glb-schema','geometry-finite','config-binding','deterministic-output','process-teardown'] as const;
const sha=z.string().regex(/^[a-f0-9]{64}$/),cases=z.array(z.string().min(1).max(120)).max(64).refine(v=>new Set(v).size===v.length);
const runtime=z.strictObject({capsuleSha256:sha,harnessSha256:sha,dependencyManifestSha256:sha,nodeVersion:z.literal('22.22.1')}),policy=z.strictObject({id:z.literal('linux-bwrap-cgroup-v1'),sha256:sha});
export const profileSchema=z.strictObject({runtime,policy});
const descriptor=z.strictObject({sha256:sha,bytes:z.number().int().min(0).max(2097152),media_type:z.enum(['application/json','application/zip','text/plain'])});
const schema=z.strictObject({formatVersion:z.literal(1),profile:z.literal('package-replay-v1'),status:z.enum(['passed','failed','unsupported','cancelled']),binding:z.strictObject({versionId:sha,subjectId:sha,artifactManifestHash:sha,reportSha256:sha,sourcePackageSha256:sha,selectedDesignSha256:sha}),runtime,policy,execution:z.strictObject({terminated:z.boolean(),wallMs:z.number().int().min(0),stages:z.array(z.strictObject({id:z.enum(stageIds),exitCode:z.number().int(),terminated:z.boolean()})).max(5)}),checks:z.array(z.strictObject({id:z.enum(checkIds),status:z.enum(['passed','failed','unsupported','not-run'])})).max(16),coverage:z.strictObject({requiredCaseIds:cases,completedCaseIds:cases}),artifacts:z.strictObject({'outputs.zip':descriptor.optional(),'validation.json':descriptor.optional(),'execution.json':descriptor.optional()}),firstFailure:z.strictObject({check:z.string().max(80),code:z.string().max(160)}).nullable(),limits:z.array(z.string().max(500)).max(16)});
export type ProcessingResult=z.infer<typeof schema>;
export function validateProcessingResult(value:unknown,expected:{binding:ProcessingResult['binding'];runtime:ProcessingResult['runtime'];policy:ProcessingResult['policy'];cases:string[]}):ProcessingResult {
 const parsed=schema.safeParse(value);if(!parsed.success)throw new HttpError(400,'invalid_processing_result');const r=parsed.data;
 if(canonical(r.binding)!==canonical(expected.binding)||canonical(r.runtime)!==canonical(expected.runtime)||canonical(r.policy)!==canonical(expected.policy))throw new HttpError(409,'processing_binding_mismatch');
 const same=(a:string[],b:string[])=>canonical([...a].sort())===canonical([...b].sort());
 if(!same(r.coverage.requiredCaseIds,expected.cases)||r.coverage.completedCaseIds.some(id=>!expected.cases.includes(id)))throw new HttpError(409,'processing_coverage_mismatch');
 if(r.execution.stages.some((s,i)=>s.id!==stageIds[i]))throw new HttpError(400,'invalid_processing_stages');
 if(r.status==='passed'){
  if(r.execution.wallMs>120000||!r.execution.terminated||r.execution.stages.length!==5||r.execution.stages.some(s=>s.exitCode!==0||!s.terminated)||r.firstFailure!==null||!same(r.coverage.completedCaseIds,expected.cases)||r.checks.length!==checkIds.length||new Set(r.checks.map(c=>c.id)).size!==checkIds.length||r.checks.some(c=>c.status!=='passed'))throw new HttpError(400,'processing_pass_incomplete');
  if(Object.keys(r.artifacts).length!==3)throw new HttpError(400,'processing_artifacts_incomplete');
 }
 for(const [name,file] of Object.entries(r.artifacts)){const required=requiredArtifacts[name as keyof typeof requiredArtifacts];if(file&&(file.media_type!==required.media_type||file.bytes<required.minBytes))throw new HttpError(400,'invalid_processing_artifact');}
 return r;
}

export const semanticFailureCodes=['input_manifest_invalid','input_digest_mismatch','source_package_invalid','required_case_unavailable','compile_failed','replay_process_failed','case_output_missing','case_output_invalid','output_limit_exceeded','glb_external_resource','glb_unsupported_extension','glb_image_limit','glb_invalid','geometry_invalid','configuration_mismatch','nondeterministic_output','execution_deadline_exceeded','memory_limit_exceeded','task_limit_exceeded','capture_limit_exceeded'];
export const infrastructureFailureCodes=['sandbox_unavailable','runtime_identity_mismatch','supervisor_unavailable','process_teardown_unconfirmed','service_unavailable','lease_expired','cancelled'];
export function semanticProcessingFailure(result:ProcessingResult){
 if(result.status==='passed')return false;const code=result.firstFailure?.code;if(code&&!semanticFailureCodes.includes(code)&&!infrastructureFailureCodes.includes(code))throw new HttpError(400,'unknown_processing_failure_code');return !!code&&semanticFailureCodes.includes(code);
}

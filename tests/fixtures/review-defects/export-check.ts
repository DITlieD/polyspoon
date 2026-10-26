import {validateBytes} from 'gltf-validator';

export const invalidGlbBytes=new TextEncoder().encode('Intentionally invalid GLB fixture: no glTF header or chunks.');
export async function validateFixtureExport(bytes:Uint8Array,caseId:string){
 try{
  const report=await validateBytes(bytes,{maxIssues:100});
  return {caseId,code:'glb-validation',status:report.issues.numErrors===0?'passed':'failed',measured:{bytes:bytes.byteLength,errors:report.issues.numErrors,warnings:report.issues.numWarnings},expectedRelation:'GLB bytes parse successfully and contain zero glTF validation errors.',proposedCorrection:report.issues.numErrors?'Regenerate a binary glTF through exportAsset and validate the exact returned bytes.':'No structural export correction required.',validator:report};
 }catch(error){
  return {caseId,code:'glb-validation',status:'failed',measured:{bytes:bytes.byteLength,parseError:error instanceof Error?error.message:String(error)},expectedRelation:'GLB bytes parse successfully and contain zero glTF validation errors.',proposedCorrection:'Regenerate a binary glTF through exportAsset and validate the exact returned bytes.'};
 }
}

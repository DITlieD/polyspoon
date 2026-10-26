import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sealReviewSubject,verifySubjectEvidence,retainFailedAttempt} from '../src/review/subject.ts';
import {createReviewRecord} from '../src/review/records.ts';
import {evaluateEligibility,loadAuthorityStore,verifyRecordEvidence} from '../src/review/publication.ts';
import {readJson,writeEvidence} from '../src/review/files.ts';

export async function reviewCommand(args:string[],root=process.cwd()){
 const [command,...rest]=args,options=new Map<string,string>();
 const contracts:Record<string,{required:string[];optional:string[]}>={seal:{required:['run','out'],optional:[]},attempt:{required:['run','out'],optional:[]},record:{required:['subject','input','out'],optional:[]},'validate-record':{required:['subject','record'],optional:[]},eligibility:{required:['subject','trusted-store','contributor'],optional:['out']}};
 const contract=contracts[command??''];if(!contract)throw Error('Use seal, attempt, record, validate-record or eligibility');
 for(let i=0;i<rest.length;i+=2){const key=rest[i]?.replace(/^--/,''),value=rest[i+1];if(!rest[i]?.startsWith('--')||!key||!value||value.startsWith('--')||options.has(key)||![...contract.required,...contract.optional].includes(key))throw Error('Invalid review command option');options.set(key,value);}
 for(const key of contract.required)if(!options.has(key))throw Error('Missing --'+key);
 const get=(key:string)=>options.get(key)!;
 if(command==='seal'||command==='attempt'){
  const value=command==='seal'?await sealReviewSubject(root,get('run')):await retainFailedAttempt(root,get('run'));await writeEvidence(root,get('out'),value,get('run'));return {kind:value.kind,id:'subjectId' in value?value.subjectId:value.attemptId,output:get('out'),localOnly:true};
 }
 const subject=await readJson(root,get('subject'));await verifySubjectEvidence(root,subject);
 if(command==='record'){
  const record=createReviewRecord(subject,await readJson(root,get('input')));await verifyRecordEvidence(root,subject,record);await writeEvidence(root,get('out'),record,subject.run);return {valid:true,recordId:record.recordId,decision:record.decision,output:get('out'),publication:false};
 }
 if(command==='validate-record'){
  const record=await readJson(root,get('record'));await verifyRecordEvidence(root,subject,record);return {valid:true,recordId:record.recordId,category:record.category,decision:record.decision,publication:false};
 }
 const authority=await loadAuthorityStore(root,get('trusted-store'),subject),result=await evaluateEligibility(root,subject,get('contributor'),authority);if(options.has('out'))await writeEvidence(root,get('out'),result,subject.run);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=fileURLToPath(new URL('../',import.meta.url));
 try{if(resolve(process.cwd())!==resolve(root))throw Error('Run recipe:review from project root');const result=await reviewCommand(process.argv.slice(2),root);console.log(JSON.stringify(result,null,2));if('eligible' in result&&!result.eligible)process.exitCode=2;}
 catch(error){console.error(JSON.stringify({error:error instanceof Error?error.message:String(error),localOnly:true}));process.exitCode=1;}
}

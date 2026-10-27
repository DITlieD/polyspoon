// Runs INSIDE the no-network bwrap jail (see ingest-sandbox.ts). Reads /input/upload, prints one JSON line.
import {readFile} from 'node:fs/promises';
import {validateBytes} from 'gltf-validator';
import {validateUpload,type UploadFormat} from '../server/upload-validation.ts';
const format=process.argv[2] as UploadFormat;
try{
 if(format!=='glb'&&format!=='gltf')throw new Error('format');
 const data=new Uint8Array(await readFile('/input/upload'));
 const structural=validateUpload(data,format);
 if(!structural.ok){console.log(JSON.stringify(structural));process.exit(0);}
 const report=await validateBytes(data,{maxIssues:50,externalResourceFunction:()=>Promise.reject(new Error('external_resource'))});
 if(report.issues.numErrors)console.log(JSON.stringify({ok:false,reason:'gltf_validator_errors'}));
 else console.log(JSON.stringify({...structural,validatorWarnings:report.issues.numWarnings}));
}catch{console.log(JSON.stringify({ok:false,reason:'parse_failed'}));}

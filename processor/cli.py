import argparse
import base64
import json
import os
import re
import sys
import time
import zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from processor.policy import canonical,digest,policy,safe_path
from processor.runtime import prepare,verify
from processor.sandbox import run

CHECKS=['sandbox-policy','input-integrity','source-package','case-bindings','compile','replay-repeat','glb-schema','geometry-finite','config-binding','deterministic-output','process-teardown']

SEMANTIC_CODES=['input_manifest_invalid','input_digest_mismatch','source_package_invalid','required_case_unavailable','compile_failed','replay_process_failed','case_output_missing','case_output_invalid','output_limit_exceeded','glb_external_resource','glb_unsupported_extension','glb_image_limit','glb_invalid','geometry_invalid','configuration_mismatch','nondeterministic_output','execution_deadline_exceeded','memory_limit_exceeded','task_limit_exceeded','capture_limit_exceeded']
INFRASTRUCTURE_CODES=['sandbox_unavailable','runtime_identity_mismatch','supervisor_unavailable','process_teardown_unconfirmed','service_unavailable','lease_expired','cancelled']
STAGE_CODES={'input-check':{'input_manifest_invalid','input_digest_mismatch','source_package_invalid','configuration_mismatch'},'compile':{'compile_failed','output_limit_exceeded','capture_limit_exceeded','execution_deadline_exceeded'},'replay-a':{'replay_process_failed','case_output_missing','case_output_invalid','output_limit_exceeded','capture_limit_exceeded','execution_deadline_exceeded'},'replay-b':{'replay_process_failed','case_output_missing','case_output_invalid','output_limit_exceeded','capture_limit_exceeded','execution_deadline_exceeded'},'validate':{'glb_external_resource','glb_unsupported_extension','glb_image_limit','glb_invalid','geometry_invalid','configuration_mismatch','nondeterministic_output'}}

class Failure(Exception):
 def __init__(self,code):self.code=code;super().__init__(code)


def read_regular(root,path,maximum):
 descriptor=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  parts=safe_path(path).split('/')
  for part in parts[:-1]:
   child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=descriptor);os.close(descriptor);descriptor=child
  file=os.open(parts[-1],os.O_RDONLY|os.O_NOFOLLOW,dir_fd=descriptor)
  try:
   import stat
   if not stat.S_ISREG(os.fstat(file).st_mode) or os.fstat(file).st_size>maximum:raise ValueError('input_file_size')
   result=bytearray()
   while True:
    block=os.read(file,65536)
    if not block:break
    result.extend(block)
    if len(result)>maximum:raise ValueError('input_file_size')
   return bytes(result)
  finally:os.close(file)
 finally:os.close(descriptor)

def write_files(root,files,encoded=False):
 root=Path(root);root.mkdir(parents=True,exist_ok=False);total=0
 for name,value in files.items():
  safe_path(name);data=base64.b64decode(value,validate=True) if encoded else value.encode();total+=len(data)
  if len(data)>2*1024**2 or total>8*1024**2 or len(files)>512:raise ValueError('materialized_file_limit')
  target=root/name;target.parent.mkdir(parents=True,exist_ok=True)
  with target.open('xb') as stream:stream.write(data)
 return root

def local(args):
 runtime=Path(args.runtime).resolve();metadata=verify(runtime);out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=False);work=out/'.scratch';work.mkdir(mode=0o700);inputs=work/'inputs';(inputs/'files').mkdir(parents=True)
 raw=read_regular(Path(args.subject).resolve().parent,Path(args.subject).name,512*1024);subject=json.loads(raw);(inputs/'subject.json').write_bytes(raw);descriptors={**subject['artifacts'],'report.json':subject['report']}
 source_path='packages/'+subject['recipe']['id']+'-'+subject['recipe']['version']+'-source.'+str(subject['recipe']['deliveryRevision'])+'.zip'
 result={'formatVersion':1,'profile':'package-replay-v1','status':'failed','binding':{'versionId':args.version_id,'subjectId':subject['subjectId'],'artifactManifestHash':subject['artifactManifestHash'],'reportSha256':subject['report']['sha256'],'sourcePackageSha256':descriptors[source_path]['sha256'],'selectedDesignSha256':descriptors['selected.design.json']['sha256']},'runtime':{k:metadata[k] for k in ['capsuleSha256','harnessSha256','dependencyManifestSha256','nodeVersion']},'policy':{'id':policy()['id'],'sha256':metadata['policySha256']},'execution':{'terminated':False,'wallMs':0,'stages':[]},'checks':[{'id':name,'status':'not-run'} for name in CHECKS],'coverage':{'requiredCaseIds':[case['id'] for case in subject['coverage']['cases']],'completedCaseIds':[]},'artifacts':{},'firstFailure':None,'limits':['Local execution evidence only; service authority requires an approved claimed job and allowlisted runtime/policy.','Portable compilation uses the package compiler flags; this is not full repository typechecking or the existing eight-stage verification.','Checks cover package/configuration integrity, required-case execution, finite structural geometry and deterministic raw GLB bytes.','Visual quality, functional meaning of every control, source licensing/provenance and independent portability approval remain separate.']}
 stages=[];start=time.monotonic();active='input-check'
 def passed(*names):
  for check in result['checks']:
   if check['id'] in names:check['status']='passed'
 def stage(name,folder,source=None,compiled=None):
  nonlocal active
  active=name;remaining=int(policy()['wallSeconds']-(time.monotonic()-start))
  if remaining<1:raise Failure('execution_deadline_exceeded')
  entry=run(runtime,folder,name,source,compiled,limits={'wallSeconds':remaining});stages.append(entry);result['execution']['stages'].append({k:entry[k] for k in ['id','exitCode','terminated']});(out/(name+'.stderr.log')).write_bytes(entry['stderr'])
  if entry['exitCode']!=0:
   if entry['oomKillCount'] or entry.get('managerResult')=='oom-kill':raise Failure('memory_limit_exceeded')
   if entry.get('managerResult')=='timeout' or entry['failure']=='supervisor_deadline':raise Failure('execution_deadline_exceeded')
   if entry['failure']=='capture_limit':raise Failure('capture_limit_exceeded')
   if entry['pidLimitEvents']:raise Failure('task_limit_exceeded')
   try:code=json.loads(entry['stdout']).get('failureCode')
   except (ValueError,AttributeError):code=None
   if code in STAGE_CODES[name]:raise Failure(code)
   raise Failure({'input-check':'source_package_invalid','compile':'compile_failed','replay-a':'replay_process_failed','replay-b':'replay_process_failed','validate':'glb_invalid'}[name] if entry['effectiveLimits'] else 'sandbox_unavailable')
  try:return json.loads(entry['stdout'])
  except ValueError:raise Failure({'input-check':'input_manifest_invalid','compile':'compile_failed','replay-a':'replay_process_failed','replay-b':'replay_process_failed','validate':'glb_invalid'}[name])
 try:
  if len(descriptors)>256 or sum(item['bytes'] for item in descriptors.values())>16*1024**2:raise Failure('input_manifest_invalid')
  for name,record in descriptors.items():
   data=read_regular(Path(args.input).resolve(),name,2*1024**2)
   if len(data)!=record['bytes'] or digest(data)!=record['sha256']:raise Failure('input_digest_mismatch')
   target=inputs/'files'/safe_path(name);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  checked=stage('input-check',inputs);passed('sandbox-policy','input-integrity','source-package')
  if checked.get('unsupported'):
   result['status']='unsupported';raise Failure('required_case_unavailable')
  data=checked['metadata']
  if [case['id'] for case in data['cases']]!=result['coverage']['requiredCaseIds'] or any(data['binding'][key]!=result['binding'][key] for key in data['binding']):raise Failure('configuration_mismatch')
  passed('case-bindings');source=write_files(work/'source',checked['sources']);(source/'.recipe-build').mkdir();os.symlink('/deps/node_modules',source/'node_modules');compiled_data=stage('compile',inputs,source)
  if any(not name.endswith('.js') for name in compiled_data['files']):raise Failure('compile_failed')
  compiled=write_files(work/'compiled',compiled_data['files'],True);passed('compile');replay_inputs=work/'replay-inputs';(replay_inputs/'configs').mkdir(parents=True);(replay_inputs/'metadata.json').write_bytes(canonical(data))
  for index,case in enumerate(data['cases']):(replay_inputs/'configs'/(str(index).zfill(3)+'.json')).write_bytes(canonical(case['design']))
  copies=[]
  for name in ['replay-a','replay-b']:
   value=stage(name,replay_inputs,source,compiled)
   if sorted(value['files'])!=sorted(case['file'] for case in data['cases']):raise Failure('case_output_missing')
   copies.append(write_files(work/name,value['files'],True))
  passed('replay-repeat');validation_inputs=work/'validation-inputs';validation_inputs.mkdir();(validation_inputs/'metadata.json').write_bytes(canonical(data))
  import shutil
  shutil.copytree(copies[0],validation_inputs/'a');shutil.copytree(copies[1],validation_inputs/'b');validated=stage('validate',validation_inputs)
  if [case['id'] for case in validated['cases']]!=result['coverage']['requiredCaseIds']:raise Failure('configuration_mismatch')
  for case,expected in zip(validated['cases'],data['cases']):
   if case['sha256']!=digest((copies[0]/expected['file']).read_bytes()) or case['repeatSha256']!=digest((copies[1]/expected['file']).read_bytes()) or case['configHash']!=expected['configHash']:raise Failure('configuration_mismatch')
  passed('glb-schema','geometry-finite','config-binding','deterministic-output','process-teardown');result['coverage']['completedCaseIds']=[case['id'] for case in validated['cases']]
  (out/'validation.json').write_bytes(canonical(validated));archive=out/'outputs.zip'
  with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_STORED) as bundle:
   for case in data['cases']:
    info=zipfile.ZipInfo(case['file'],date_time=(1980,1,1,0,0,0));bundle.writestr(info,(copies[0]/case['file']).read_bytes())
  if archive.stat().st_size>2*1024**2:result['status']='unsupported';raise Failure('output_limit_exceeded')
  (out/'execution.json').write_bytes(canonical({'stages':result['execution']['stages'],'observedStages':[{key:stage[key] for key in ['id','wallMs','effectiveLimits','observedMemoryPeakBytes','oomKillCount','pidLimitEvents']} for stage in stages],'policy':policy(),'profile':'package-replay-v1'}))
  for name,media in [('outputs.zip','application/zip'),('validation.json','application/json'),('execution.json','application/json')]:
   value=(out/name).read_bytes();result['artifacts'][name]={'sha256':digest(value),'bytes':len(value),'media_type':media}
  if time.monotonic()-start>policy()['wallSeconds']:raise Failure('execution_deadline_exceeded')
  result['status']='passed'
 except Exception as error:
  result['artifacts']={};result['firstFailure']={'check':active,'code':error.code if isinstance(error,Failure) else 'process_teardown_unconfirmed' if str(error)=='process_teardown_unconfirmed' else 'supervisor_unavailable'}
 finally:
  result['execution']['terminated']=all(stage['terminated'] for stage in stages);result['execution']['wallMs']=round((time.monotonic()-start)*1000);(out/'result.json').write_bytes(canonical(result))
 return result

def main():
 parser=argparse.ArgumentParser();commands=parser.add_subparsers(dest='command',required=True);build=commands.add_parser('prepare');build.add_argument('--out',required=True);execute=commands.add_parser('run-local');execute.add_argument('--runtime',required=True);execute.add_argument('--subject',required=True);execute.add_argument('--input',required=True);execute.add_argument('--out',required=True);execute.add_argument('--version-id');args=parser.parse_args()
 if not os.environ.get('HOSTQ_JOB_ID'):raise SystemExit('hostq_admission_required')
 if args.command=='prepare':value=prepare(args.out);print(json.dumps({'capsuleSha256':value['capsuleSha256']}))
 else:value=local(args);print(json.dumps({'status':value['status'],'result':str(Path(args.out)/'result.json'),'firstFailure':value['firstFailure']}));sys.exit(0 if value['status']=='passed' else 1)

if __name__=='__main__':main()

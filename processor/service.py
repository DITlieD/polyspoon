import argparse
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
from urllib.parse import urlsplit,urlencode,quote
import uuid
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from processor.cli import Failure,read_regular,local
from processor.policy import canonical,digest,policy,safe_path
from processor.runtime import verify

ROOT=Path(__file__).resolve().parents[1]
REQUIRED_ARTIFACTS={'outputs.zip':{'media_type':'application/zip','minBytes':128,'maxBytes':2097152},'validation.json':{'media_type':'application/json','minBytes':64,'maxBytes':2097152},'execution.json':{'media_type':'application/json','minBytes':64,'maxBytes':2097152}}

def private_write(path,value):
 descriptor=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600)
 with os.fdopen(descriptor,'wb') as stream:stream.write(canonical(value))

def credential(path):
 descriptor=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(descriptor,'r') as stream:
  info=os.fstat(stream.fileno())
  if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.getuid() or info.st_mode&0o077 or info.st_size>4096:raise Failure('credential_file_invalid')
  value=stream.read(4097).strip()
 if not re.fullmatch(r'pc_[A-Za-z0-9_-]{1,256}',value):raise Failure('credential_file_invalid')
 return value

class Client:
 def __init__(self,origin,secret):
  parsed=urlsplit(origin)
  try:loopback=ipaddress.ip_address(parsed.hostname or '').is_loopback
  except ValueError:loopback=False
  if parsed.scheme not in ('http','https') or parsed.scheme=='http' and not loopback or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('','/') or not parsed.hostname:raise Failure('service_origin_invalid')
  self.origin=(parsed.scheme,parsed.hostname,parsed.port);self.secret=secret;self.job=None
 def exchange(self,method,path,data,headers,maximum):
  scheme,host,port=self.origin;timeout=30
  if self.job:
   remaining=(self.job['leaseExpiresAt']-time.time()*1000)/1000
   if remaining<=0:raise Failure('lease_expired')
   timeout=min(timeout,max(1,remaining))
  connection=(http.client.HTTPSConnection if scheme=='https' else http.client.HTTPConnection)(host,port,timeout=timeout)
  try:
   connection.request(method,path,body=data,headers=headers);response=connection.getresponse();length=response.getheader('Content-Length')
   if length is not None and (not length.isdigit() or int(length)>maximum):raise Failure('service_response_invalid')
   value=response.read(maximum+1);return response.status,dict(response.getheaders()),value
  except (OSError,http.client.HTTPException):raise Failure('service_unavailable') from None
  finally:connection.close()
 def request(self,method,path,data=None,maximum=512*1024,media='application/json'):
  if not path.startswith('/api/') or '\r' in path or '\n' in path:raise Failure('service_path_invalid')
  headers={'Authorization':'Bearer '+self.secret,'Content-Type':media}
  if self.job:
   for key,name in [('leaseId','X-Processor-Lease'),('attemptId','X-Processor-Attempt')]:headers[name]=self.job[key]
  status,_,value=self.exchange(method,path,data,headers,maximum)
  if status not in (200,201) or len(value)>maximum:raise Failure('service_unavailable' if status>=500 else 'service_response_invalid')
  return value
 def json(self,method,path,value=None):
  try:return json.loads(self.request(method,path,None if value is None else canonical(value)))
  except ValueError:raise Failure('service_response_invalid') from None

def validate_job(job,local):
 expected={key:local[key] for key in ['capsuleSha256','harnessSha256','dependencyManifestSha256','nodeVersion']}
 if job.get('runtime')!=expected or job.get('policy')!={'id':policy()['id'],'sha256':local['policySha256']} or job.get('profile')!='package-replay-v1':raise Failure('runtime_identity_mismatch')
 if job.get('requiredArtifacts')!=REQUIRED_ARTIFACTS:raise Failure('runtime_identity_mismatch')
 for key in ['id','attemptId','leaseId']:
  if not isinstance(job.get(key),str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,256}',job[key]):raise Failure('claim_invalid')
 if not isinstance(job.get('leaseExpiresAt'),int) or job['leaseExpiresAt']<=time.time()*1000:raise Failure('lease_expired')
 subject=job['subject'];version=job['version']
 if not re.fullmatch('[a-f0-9]{64}',version['id']) or version['subjectId']!=subject['subjectId'] or version['artifactManifestHash']!=subject['artifactManifestHash'] or version['recipe']!=subject['recipe'] or job['requiredCoverage']!=subject['coverage']:raise Failure('claim_invalid')
 if digest(canonical(subject['artifacts']))!=subject['artifactManifestHash']:raise Failure('input_manifest_invalid')
 descriptors={**subject['artifacts'],'report.json':subject['report']}
 if len(descriptors)>256:raise Failure('input_manifest_invalid')
 total=0
 for name,record in descriptors.items():
  safe_path(name)
  if not isinstance(record['bytes'],int) or isinstance(record['bytes'],bool) or not 0<=record['bytes']<=2097152 or not re.fullmatch('[a-f0-9]{64}',record['sha256']):raise Failure('input_manifest_invalid')
  total+=record['bytes']
 if total>16*1024**2:raise Failure('input_manifest_invalid')
 source='packages/'+subject['recipe']['id']+'-'+subject['recipe']['version']+'-source.'+str(subject['recipe']['deliveryRevision'])+'.zip'
 for key,path in [('report','report.json'),('sourcePackage',source),('selectedDesign','selected.design.json')]:
  descriptor=version[key]
  if descriptor['path']!=path or any(descriptor[field]!=descriptors[path][field] for field in ['bytes','sha256']):raise Failure('claim_invalid')
 return descriptors

def once(args):
 if not os.environ.get('HOSTQ_JOB_ID'):raise Failure('hostq_admission_required')
 runtime=Path(args.runtime).resolve();metadata=verify(runtime);secret=credential(args.credential_file);client=Client(args.origin,secret)
 folder=Path(args.work).resolve();folder.mkdir(mode=0o700,parents=True,exist_ok=True)
 if folder.is_symlink() or folder.stat().st_mode&0o077:raise Failure('work_directory_invalid')
 state_path=folder/'state.json'
 if state_path.exists():state=json.loads(read_regular(folder,'state.json',512*1024))
 else:state={'idempotencyKey':uuid.uuid4().hex};private_write(state_path,state)
 if state.get('accepted'):return {'status':state['accepted']['status'],'accepted':True,'result':str(folder/'output/result.json')}
 if 'job' not in state:
  response=client.json('POST','/api/processor/claims',{'idempotencyKey':state['idempotencyKey'],'profile':'package-replay-v1'})
  if response.get('job') is None:return {'status':'idle','reason':response.get('reason','no_claim')}
  state['job']=response['job'];private_write(state_path,state)
 job=state['job'];descriptors=validate_job(job,metadata);client.job=job;inputs=folder/'inputs';inputs.mkdir(mode=0o700,exist_ok=True)
 for name,record in descriptors.items():
  target=inputs/safe_path(name)
  if target.exists():value=read_regular(inputs,name,record['bytes'])
  else:
   value=client.request('GET','/api/versions/'+quote(job['version']['id'],safe='')+'/files?'+urlencode({'path':name}),maximum=record['bytes'])
   if len(value)!=record['bytes'] or digest(value)!=record['sha256']:raise Failure('input_digest_mismatch')
   target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
   with target.open('xb') as stream:stream.write(value)
  if len(value)!=record['bytes'] or digest(value)!=record['sha256']:raise Failure('input_digest_mismatch')
 subject=folder/'subject.json';private_write(subject,job['subject']);output=folder/'output'
 if not (output/'result.json').exists():
  local(argparse.Namespace(runtime=str(runtime),subject=str(subject),input=str(inputs),out=str(output),version_id=job['version']['id']))
 result=json.loads(read_regular(output,'result.json',512*1024))
 expected_binding={'versionId':job['version']['id'],'subjectId':job['subject']['subjectId'],'artifactManifestHash':job['subject']['artifactManifestHash'],'reportSha256':job['version']['report']['sha256'],'sourcePackageSha256':job['version']['sourcePackage']['sha256'],'selectedDesignSha256':job['version']['selectedDesign']['sha256']}
 if result['binding']!=expected_binding or result['runtime']!=job['runtime'] or result['policy']!=job['policy']:raise Failure('runtime_identity_mismatch')
 if result['status']=='passed' and set(result['artifacts'])!=set(REQUIRED_ARTIFACTS):raise Failure('supervisor_unavailable')
 receipts={}
 for name,record in result['artifacts'].items():
  required=REQUIRED_ARTIFACTS[name];value=read_regular(output,name,required['maxBytes'])
  if digest(value)!=record['sha256'] or len(value)!=record['bytes'] or not required['minBytes']<=len(value)<=required['maxBytes'] or record['media_type']!=required['media_type']:raise Failure('supervisor_unavailable')
  receipt=json.loads(client.request('PUT','/api/processor/jobs/'+quote(job['id'],safe='')+'/artifacts?'+urlencode({'path':name}),value,media=record['media_type']))
  if receipt.get('verified') is not True or receipt.get('path')!=name or any(receipt.get(key)!=record[key] for key in ['sha256','bytes','media_type']):raise Failure('service_response_invalid')
  receipts[name]=receipt
 private_write(folder/'receipts.json',receipts);response=client.json('POST','/api/processor/jobs/'+quote(job['id'],safe='')+'/result',result)
 if response.get('accepted') is not True or response.get('status')!=result['status']:raise Failure('service_response_invalid')
 state['accepted']=response;private_write(state_path,state);return {'status':result['status'],'accepted':True,'result':str(output/'result.json')}

def main():
 parser=argparse.ArgumentParser();commands=parser.add_subparsers(dest='command',required=True);run=commands.add_parser('run');run.add_argument('--once',action='store_true',required=True);run.add_argument('--origin',required=True);run.add_argument('--credential-file',required=True);run.add_argument('--runtime',required=True);run.add_argument('--work',required=True);args=parser.parse_args()
 try:print(json.dumps(once(args)))
 except Failure as error:print(json.dumps({'status':'error','code':error.code}));raise SystemExit(1)
 except Exception:print(json.dumps({'status':'error','code':'supervisor_unavailable'}));raise SystemExit(1)

if __name__=='__main__':main()

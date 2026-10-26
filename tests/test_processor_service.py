import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from processor.service import Client,validate_job,credential,Failure,REQUIRED_ARTIFACTS,once
from processor.policy import canonical,digest
import argparse
import time
from urllib.parse import urlsplit,parse_qs

class ProcessorServiceTests(unittest.TestCase):
 def test_origin_rejects_external_cleartext_credentials_query_and_redirect(self):
  for url in ['http://example.com','https://user:password@example.com','https://example.com?token=x','https://example.com/path']:
   with self.assertRaises(Failure):Client(url,'pc_test')
  client=Client('http://127.0.0.1:8797','pc_test')
  with patch.object(client,'exchange',return_value=(302,{},b'')):
   with self.assertRaises(Failure):client.request('POST','/api/processor/claims',b'{}')
 def test_credential_requires_private_regular_file(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'credential';path.write_text('pc_private');path.chmod(0o644)
   with self.assertRaises(Failure):credential(path)
   path.chmod(0o600);self.assertEqual(credential(path),'pc_private');link=Path(folder)/'link';link.symlink_to(path)
   with self.assertRaises((Failure,OSError)):credential(link)
 def test_claim_refuses_mismatched_runtime_before_payload(self):
  local={'capsuleSha256':'a'*64,'harnessSha256':'b'*64,'dependencyManifestSha256':'c'*64,'nodeVersion':'22.22.1','policySha256':'d'*64}
  job={'runtime':{},'profile':'package-replay-v1'}
  with self.assertRaises(Failure) as error:validate_job(job,local)
  self.assertEqual(error.exception.code,'runtime_identity_mismatch')
 def test_claim_runs_parent_supervisor_and_accepted_retry_does_not_reexecute(self):
  metadata={'capsuleSha256':'a'*64,'harnessSha256':'b'*64,'dependencyManifestSha256':'c'*64,'nodeVersion':'22.22.1','policySha256':'d'*64}
  runtime={key:metadata[key] for key in ['capsuleSha256','harnessSha256','dependencyManifestSha256','nodeVersion']}
  files={'report.json':b'report','selected.design.json':b'{}','packages/r-1-source.1.zip':b'archive'}
  descriptors={name:{'sha256':digest(value),'bytes':len(value)} for name,value in files.items()}
  artifacts={name:value for name,value in descriptors.items() if name!='report.json'}
  subject={'subjectId':'e'*64,'artifactManifestHash':digest(canonical(artifacts)),'artifacts':artifacts,'report':descriptors['report.json'],'recipe':{'id':'r','version':'1','deliveryRevision':1},'coverage':{'cases':[]}}
  descriptor=lambda name:{'path':name,**descriptors[name]}
  job={'id':'job','attemptId':'attempt','leaseId':'lease','leaseExpiresAt':int(time.time()*1000)+600000,'profile':'package-replay-v1','runtime':runtime,'policy':{'id':'linux-bwrap-cgroup-v1','sha256':metadata['policySha256']},'requiredArtifacts':REQUIRED_ARTIFACTS,'requiredCoverage':subject['coverage'],'subject':subject,'version':{'id':'f'*64,'subjectId':subject['subjectId'],'artifactManifestHash':subject['artifactManifestHash'],'recipe':subject['recipe'],'report':descriptor('report.json'),'sourcePackage':descriptor('packages/r-1-source.1.zip'),'selectedDesign':descriptor('selected.design.json')}}
  def run_parent(args):
   self.assertNotIn('pc_private',vars(args).values());output=Path(args.out);output.mkdir();binding={'versionId':job['version']['id'],'subjectId':subject['subjectId'],'artifactManifestHash':subject['artifactManifestHash'],'reportSha256':descriptors['report.json']['sha256'],'sourcePackageSha256':descriptors['packages/r-1-source.1.zip']['sha256'],'selectedDesignSha256':descriptors['selected.design.json']['sha256']};(output/'result.json').write_bytes(canonical({'status':'failed','binding':binding,'runtime':runtime,'policy':job['policy'],'artifacts':{}}))
  def json_request(client,method,path,value=None):return {'job':job} if path.endswith('/claims') else {'accepted':True,'status':'failed'}
  def file_request(client,method,path,*args,**kwargs):return files[parse_qs(urlsplit(path).query)['path'][0]]
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'credential';path.write_text('pc_private');path.chmod(0o600);args=argparse.Namespace(runtime=folder,work=str(Path(folder)/'work'),credential_file=str(path),origin='http://127.0.0.1:8797')
   with patch.dict('os.environ',{'HOSTQ_JOB_ID':'test'}),patch('processor.service.verify',return_value=metadata),patch.object(Client,'json',autospec=True,side_effect=json_request),patch.object(Client,'request',autospec=True,side_effect=file_request),patch('processor.service.local',side_effect=run_parent) as supervisor:
    self.assertTrue(once(args)['accepted']);self.assertTrue(once(args)['accepted']);supervisor.assert_called_once()
 def test_response_bound_is_applied_before_json(self):
  client=Client('http://127.0.0.1:8797','pc_test')
  with patch.object(client,'exchange',return_value=(200,{},b'x'*33)):
   with self.assertRaises(Failure):client.request('GET','/api/versions/id/files?path=x',maximum=32)

if __name__=='__main__':unittest.main()

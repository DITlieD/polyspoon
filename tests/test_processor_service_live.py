import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from processor.policy import canonical

ROOT=Path(__file__).resolve().parents[1]

def main():
 parser=argparse.ArgumentParser()
 for name in ['origin','credential-file','runtime','work','version-id']:parser.add_argument('--'+name,required=True)
 args=parser.parse_args()
 if not os.environ.get('HOSTQ_JOB_ID'):raise SystemExit('hostq_admission_required')
 folder=Path(args.work).resolve();folder.mkdir(mode=0o700,parents=True,exist_ok=False)
 command=[sys.executable,str(ROOT/'processor/service.py'),'run','--once','--origin',args.origin,'--credential-file',args.credential_file,'--runtime',args.runtime,'--work',str(folder)]
 def invoke(name):
  started=time.monotonic();process=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=180);(folder/(name+'.log')).write_text(process.stdout+process.stderr);assert process.returncode==0,process.stdout;value=json.loads(process.stdout);assert value['accepted'] is True and value['status']=='passed';return {'response':value,'wallMs':round((time.monotonic()-started)*1000)}
 first=invoke('first');state=json.loads((folder/'state.json').read_text());job=state['job'];result=json.loads((folder/'output/result.json').read_text());assert job['version']['id']==args.version_id==result['binding']['versionId'];assert result['status']=='passed';assert len(result['coverage']['completedCaseIds'])==19
 descriptors={**job['subject']['artifacts'],'report.json':job['subject']['report']};downloads={}
 for name,record in descriptors.items():
  value=(folder/'inputs'/name).read_bytes();descriptor={'bytes':len(value),'sha256':hashlib.sha256(value).hexdigest()};assert descriptor['bytes']==record['bytes'] and descriptor['sha256']==record['sha256'];downloads[name]=descriptor
 receipts=json.loads((folder/'receipts.json').read_text());assert set(receipts)=={'outputs.zip','validation.json','execution.json'}
 for name,record in result['artifacts'].items():assert receipts[name]['verified'] is True and all(receipts[name][key]==record[key] for key in ['bytes','sha256','media_type'])
 def snapshot():return {str(path.relative_to(folder/'output')):{'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mtimeNs':path.stat().st_mtime_ns} for path in (folder/'output').rglob('*') if path.is_file()}
 before=snapshot();second=invoke('second');after=snapshot();assert before==after
 (folder/'downloads.json').write_bytes(canonical(downloads));(folder/'retry-evidence.json').write_bytes(canonical({'first':first,'second':second,'outputFilesUnchanged':before==after,'fileSnapshots':before}));(folder/'claim-summary.json').write_bytes(canonical({key:job[key] for key in ['id','attemptId','profile','version','runtime','policy','requiredCoverage','requiredArtifacts']}))
 print(json.dumps({'status':'passed','versionId':args.version_id,'downloadedFiles':len(downloads),'completedCases':len(result['coverage']['completedCaseIds']),'receipts':len(receipts),'secondInvocationReexecuted':False,'work':str(folder)}))

if __name__=='__main__':main()

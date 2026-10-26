import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import unittest
import zipfile
import zlib
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from processor.policy import canonical,digest
from processor.runtime import verify
from processor.sandbox import run

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=Path(sys.argv[1]).resolve()
EVIDENCE=Path(sys.argv[2]).resolve()
SOURCE=ROOT/'evidence/revision14/final/bench-review-01/subject.json'
SUBJECT=json.loads(SOURCE.read_text())
INPUT=ROOT/SUBJECT['run']
ARCHIVE='packages/bench-1.1.0-source.2.zip'

def stored_zip(entries):
 local=[];central=[];offset=0
 for name,data in entries:
  filename=name.encode();crc=zlib.crc32(data)&0xffffffff
  header=struct.pack('<IHHHHHIIIHH',0x04034b50,20,0x800,0,0,0,crc,len(data),len(data),len(filename),0)+filename
  record=struct.pack('<IHHHHHHIIIHHHHHII',0x02014b50,20,20,0x800,0,0,0,crc,len(data),len(data),len(filename),0,0,0,0,0,offset)+filename
  local.extend([header,data]);central.append(record);offset+=len(header)+len(data)
 end=struct.pack('<IHHHHIIH',0x06054b50,0,0,len(entries),len(entries),sum(map(len,central)),offset,0)
 return b''.join(local+central+[end])

def fixture(name,archive):
 root=EVIDENCE/name;root.mkdir();source=root/'inputs';shutil.copytree(INPUT,source);(source/ARCHIVE).write_bytes(archive)
 subject=json.loads(SOURCE.read_text());subject['artifacts'][ARCHIVE]={'sha256':digest(archive),'bytes':len(archive)};subject['artifactManifestHash']=digest(canonical(subject['artifacts']));subject.pop('subjectId');subject['subjectId']=digest(canonical(subject));path=root/'subject.json';path.write_bytes(canonical(subject));return path,source

def execute(name,subject=SOURCE,inputs=INPUT):
 output=EVIDENCE/name
 result=subprocess.run([sys.executable,str(ROOT/'processor/cli.py'),'run-local','--runtime',str(RUNTIME),'--subject',str(subject),'--input',str(inputs),'--out',str(output)],cwd=ROOT,capture_output=True,text=True,timeout=650)
 (EVIDENCE/(name+'.log')).write_text(result.stdout+result.stderr)
 return result,json.loads((output/'result.json').read_text())

class ProcessorIntegration(unittest.TestCase):
 def test_original(self):
  process,result=execute('original');self.assertEqual(process.returncode,0,process.stdout+process.stderr);self.assertEqual(result['status'],'passed');self.assertEqual(result['coverage']['requiredCaseIds'],result['coverage']['completedCaseIds']);self.assertEqual(len(result['coverage']['completedCaseIds']),19)
  self.assertEqual([stage['id'] for stage in result['execution']['stages']],['input-check','compile','replay-a','replay-b','validate']);self.assertTrue(all(stage['exitCode']==0 and stage['terminated'] for stage in result['execution']['stages']));self.assertTrue(all(check['status']=='passed' for check in result['checks']));self.assertEqual(len(result['checks']),11)
  validation=json.loads((EVIDENCE/'original/validation.json').read_text());self.assertTrue(all(case['sha256']==case['repeatSha256'] for case in validation['cases']));self.assertAlmostEqual(validation['cases'][0]['dimensions'][0],1.6,places=5)
  with zipfile.ZipFile(EVIDENCE/'original/outputs.zip') as archive:self.assertEqual(len(archive.namelist()),19);self.assertIsNone(archive.testzip())
 def test_forged_success(self):
  with zipfile.ZipFile(INPUT/ARCHIVE) as archive:files={name:archive.read(name) for name in archive.namelist()}
  manifest=json.loads(files['manifest.json']);entry=manifest['recipe']['entry'];files[entry]=b'process.stdout.write("{\\"status\\":\\"passed\\",\\"technical\\":\\"success\\"}\\n");process.exit(0);\n'+files[entry]
  manifest['files'][entry]={'sha256':digest(files[entry]),'bytes':len(files[entry])};manifest['provenance']['sourceHash']=digest(json.dumps(manifest['files'],separators=(',',':'),ensure_ascii=False).encode());files['manifest.json']=json.dumps(manifest,indent=2,ensure_ascii=False).encode()+b'\n'
  subject,inputs=fixture('forged-input',stored_zip(list(files.items())));process,result=execute('forged-result',subject,inputs);self.assertNotEqual(process.returncode,0);self.assertEqual(result['status'],'failed');self.assertEqual(result['execution']['stages'][0]['exitCode'],0);self.assertEqual(result['execution']['stages'][1]['exitCode'],0);self.assertEqual(result['firstFailure']['check'],'replay-a');self.assertEqual(result['firstFailure']['code'],'case_output_missing');self.assertFalse(result['coverage']['completedCaseIds']);self.assertFalse(result['artifacts'])
 def test_output_spoof_is_semantic_failure(self):
  with zipfile.ZipFile(INPUT/ARCHIVE) as archive:files={name:archive.read(name) for name in archive.namelist()}
  manifest=json.loads(files['manifest.json']);entry=manifest['recipe']['entry'];files[entry]=b"process.getBuiltinModule('fs').writeFileSync('/proc/'+process.ppid+'/fd/1','spoof');\n"+files[entry]
  manifest['files'][entry]={'sha256':digest(files[entry]),'bytes':len(files[entry])};manifest['provenance']['sourceHash']=digest(json.dumps(manifest['files'],separators=(',',':'),ensure_ascii=False).encode());files['manifest.json']=json.dumps(manifest,indent=2,ensure_ascii=False).encode()+b'\n'
  subject,inputs=fixture('spoof-input',stored_zip(list(files.items())));process,result=execute('spoof-result',subject,inputs);self.assertNotEqual(process.returncode,0);self.assertEqual(result['status'],'failed');self.assertEqual(result['firstFailure'],{'check':'replay-a','code':'replay_process_failed'})
 def test_owner_death(self):
  folder=EVIDENCE/'owner-death';folder.mkdir();inputs=folder/'inputs';inputs.mkdir();(inputs/'probe.json').write_text('{"kind":"wall"}')
  helper=subprocess.Popen([sys.executable,'-c',"from processor.sandbox import run;import sys;run(sys.argv[1],sys.argv[2],'probe')",str(RUNTIME),str(inputs)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  unit=None;started=time.monotonic()
  try:
   while time.monotonic()-started<5:
    control=folder/'probe.unit'
    if control.exists():
     unit=control.read_text().strip();state=subprocess.run(['systemctl','--user','is-active',unit],capture_output=True,text=True)
     if state.stdout.strip()=='active':
      group=subprocess.run(['systemctl','--user','show',unit,'--property=ControlGroup','--value'],capture_output=True,text=True).stdout.strip();cgroup=Path('/sys/fs/cgroup')/group.lstrip('/');payloads=[]
      try:
       for pid in (cgroup/'cgroup.procs').read_text().split():
        try:
         command=(Path('/proc')/pid/'cmdline').read_bytes()
         if b'/runner/processor/jail.js' in command:payloads.append(pid)
        except FileNotFoundError:pass
      except FileNotFoundError:pass
      if payloads:break
    time.sleep(.05)
   else:self.fail('payload_not_active')
   helper.kill();helper.wait(timeout=2);killed=time.monotonic()
   while time.monotonic()-killed<5:
    state=subprocess.run(['systemctl','--user','show',unit,'--property=ActiveState','--value'],capture_output=True,text=True)
    if state.stdout.strip() in ('','inactive','failed'):break
    time.sleep(.05)
   else:self.fail('payload_survived_owner')
   (folder/'result.json').write_bytes(canonical({'unit':unit,'ownerExitCode':helper.returncode,'terminalState':state.stdout.strip(),'cleanupMs':round((time.monotonic()-killed)*1000),'livePayloadPidsBeforeKill':payloads,'remainingTasks':(cgroup/'cgroup.procs').read_text().split() if (cgroup/'cgroup.procs').exists() else []}))
  finally:
   if helper.poll() is None:helper.kill();helper.wait(timeout=2)
   if unit:subprocess.run(['systemctl','--user','stop',unit],capture_output=True,timeout=5)
 def test_final_profile(self):
  records={};folder=EVIDENCE/'probes';folder.mkdir();(folder/'parent-canary').write_text('private-test-canary');canary=open(folder/'parent-canary','rb');os.set_inheritable(canary.fileno(),True);os.environ['PROCESSOR_PARENT_CANARY']='probe-only'
  try:
   for kind in ['escape','output','file','tasks','survivor','wall','memory']:
    inputs=folder/kind;inputs.mkdir();(inputs/'probe.json').write_text(json.dumps({'kind':kind}));limits={'wallSeconds':2} if kind=='wall' else None;entry=run(RUNTIME,inputs,'probe',limits=limits);records[kind]={key:value.decode(errors='replace') if isinstance(value,bytes) else value for key,value in entry.items()}
   escape=json.loads(records['escape']['stdout']);self.assertEqual(escape['visible'],[]);self.assertFalse(escape['canaryPresent']);self.assertFalse(escape['canaryFdVisible']);self.assertEqual(escape['writeErrno'],'EROFS');self.assertEqual(escape['capEff'],'0000000000000000');self.assertEqual(escape['noNewPrivs'],'1');self.assertEqual(escape['checks'],{'socketErrno':1,'mountErrno':1,'usernsErrno':1,'ptraceErrno':1,'clone3Errno':38});self.assertEqual(json.loads(records['output']['stdout'])['code'],'ENOSPC');self.assertEqual(json.loads(records['file']['stdout'])['code'],'EFBIG');self.assertGreater(json.loads(records['tasks']['stdout'])['failures'],0);self.assertNotEqual(records['wall']['exitCode'],0);self.assertLess(records['wall']['wallMs'],8000);self.assertNotEqual(records['memory']['exitCode'],0);self.assertIn('oom-kill',records['memory']['stderr']);self.assertIn('timeout',records['wall']['stderr']);self.assertEqual(records['memory']['effectiveLimits']['memory.max'],str(2*1024**3));self.assertEqual(records['tasks']['effectiveLimits']['pids.max'],'64');self.assertTrue(all(record['terminated'] and not record['remainingTasks'] for record in records.values()));self.assertGreater(json.loads(records['survivor']['stdout'])['wroteBytes'],0)
  finally:
   canary.close();os.environ.pop('PROCESSOR_PARENT_CANARY',None);(EVIDENCE/'sandbox-probes.json').write_bytes(canonical(records))
 def test_external_resources(self):
  source=EVIDENCE/'original/.scratch/validation-inputs';metadata=json.loads((source/'metadata.json').read_text());metadata['cases']=metadata['cases'][:1];name=metadata['cases'][0]['file'];original=(source/'a'/name).read_bytes();length=struct.unpack_from('<I',original,12)[0];document=json.loads(original[20:20+length]);binary=original[20+length:];records={}
  for kind in ['external-image','external-buffer','unsupported-extension','oversized-image']:
   binary=original[20+length:];doc=json.loads(json.dumps(document))
   if kind=='external-image':doc['images']=[{'uri':'https://example.invalid/never-fetch.png'}]
   elif kind=='external-buffer':doc['buffers'][0]['uri']='https://example.invalid/never-fetch.bin'
   elif kind=='unsupported-extension':doc['extensionsUsed']=['EXT_external_resources']
   else:
    import binascii
    def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',binascii.crc32(name+data)&0xffffffff)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',4096,4096,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes((4096*4+1)*4096)))+chunk(b'IEND',b'');old=struct.unpack_from('<I',binary,0)[0];body=binary[8:]+png;body+=b'\x00'*((-len(body))%4);binary=struct.pack('<II',len(body),0x004e4942)+body;doc['bufferViews'].append({'buffer':0,'byteOffset':old,'byteLength':len(png)});doc['buffers'][0]['byteLength']=len(body);doc['images']=[{'mimeType':'image/png','bufferView':len(doc['bufferViews'])-1}]
   text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4);value=struct.pack('<III',0x46546c67,2,20+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+binary;folder=EVIDENCE/kind;folder.mkdir();(folder/'metadata.json').write_bytes(canonical(metadata))
   for copy in ['a','b']:(folder/copy/'cases').mkdir(parents=True);(folder/copy/name).write_bytes(value)
   entry=run(RUNTIME,folder,'validate');records[kind]={key:item.decode(errors='replace') if isinstance(item,bytes) else item for key,item in entry.items()};self.assertNotEqual(entry['exitCode'],0,kind);self.assertTrue(entry['terminated']);expected='external_resource' if kind.startswith('external-') else 'unsupported_extension' if kind=='unsupported-extension' else 'image_dimensions';self.assertIn(expected,entry['stderr'].decode())
  (EVIDENCE/'external-resource-probes.json').write_bytes(canonical(records))
 def test_archive_rejections(self):
  with zipfile.ZipFile(INPUT/ARCHIVE) as archive:entries=[(name,archive.read(name)) for name in archive.namelist()]
  good=(INPUT/ARCHIVE).read_bytes();symlink=bytearray(good);central=symlink.find(b'PK\x01\x02');struct.pack_into('<H',symlink,central+4,0x0314);struct.pack_into('<I',symlink,central+38,0o120777<<16)
  corrupt=bytearray(good);corrupt[30+struct.unpack_from('<H',good,26)[0]+8]^=1
  bomb=EVIDENCE/'compressed.zip'
  with zipfile.ZipFile(bomb,'x',compression=zipfile.ZIP_DEFLATED) as archive:archive.writestr('bomb',bytes(8*1024**2))
  cases={'traversal':stored_zip(entries+[('../escape',b'x')]),'duplicate':stored_zip(entries+[entries[0]]),'symlink':bytes(symlink),'corrupt':bytes(corrupt),'compressed':bomb.read_bytes()}
  for name,archive in cases.items():
   subject,inputs=fixture('archive-'+name,archive);process,result=execute('rejected-'+name,subject,inputs);self.assertNotEqual(process.returncode,0,name);self.assertEqual(len(result['execution']['stages']),1,name);self.assertEqual(result['firstFailure']['check'],'input-check',name);self.assertFalse(result['artifacts'])

if not os.environ.get('HOSTQ_JOB_ID'):raise SystemExit('hostq_admission_required')
EVIDENCE.mkdir(parents=True,exist_ok=False);verify(RUNTIME);suite=unittest.TestSuite(ProcessorIntegration(name) for name in (sys.argv[3:] or ['test_original','test_forged_success','test_output_spoof_is_semantic_failure','test_owner_death','test_final_profile','test_external_resources','test_archive_rejections']));outcome=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(0 if outcome.wasSuccessful() else 1)

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from processor.policy import canonical,digest,policy,seccomp_filter,safe_path

ROOT=Path(__file__).resolve().parents[1]

def file_hash(path):
 import hashlib
 result=hashlib.sha256()
 with open(path,'rb') as stream:
  for block in iter(lambda:stream.read(1024*1024),b''):result.update(block)
 return result.hexdigest()

def prepare(target):
 target=Path(target).resolve();target.mkdir(parents=True,exist_ok=False);fs=target/'rootfs';fs.mkdir()
 for directory in ['usr/bin','proc','dev','tmp','work','out','input','package','runner','deps/node_modules']: (fs/directory).mkdir(parents=True,exist_ok=True)
 version=subprocess.run(['/usr/bin/node','--version'],capture_output=True,text=True,check=True).stdout.strip()
 if version!='v22.22.1':raise ValueError('unsupported_node')
 lock=json.loads((ROOT/'package-lock.json').read_text());packages={}
 def dependency(name,required=True):
  if name in packages:return
  source=ROOT/'node_modules'/name
  if not (source/'package.json').is_file():
   if required:raise ValueError('missing_dependency:'+name)
   return
  metadata=json.loads((source/'package.json').read_text())
  if any(metadata.get(key) and value not in metadata[key] for key,value in [('os','linux'),('cpu','x64'),('libc','glibc')]):
   if required:raise ValueError('unsupported_dependency_platform:'+name)
   return
  record=lock['packages'].get('node_modules/'+name)
  if not record or record['version']!=metadata['version'] or not record.get('integrity'):raise ValueError('unapproved_dependency:'+name)
  packages[name]={'version':metadata['version'],'integrity':record['integrity']}
  destination=fs/'deps/node_modules'/name;destination.parent.mkdir(parents=True,exist_ok=True)
  
  if any(path.is_symlink() for path in source.rglob('*')):raise ValueError('dependency_symlink:'+name)
  shutil.copytree(source,destination,symlinks=False)
  for child in metadata.get('dependencies',{}):dependency(child)
  for child in metadata.get('optionalDependencies',{}):dependency(child,False)
 for name in ['three','typescript','gltf-validator','rolldown','@types/three','@types/node']:dependency(name)
 if packages['three']['version']!='0.186.1' or packages['typescript']['version']!='7.0.2':raise ValueError('unsupported_toolchain')
 for path in (fs/'deps/node_modules').rglob('*'):
  if path.is_symlink():raise ValueError('runtime_symlink')
 subprocess.run(['/usr/bin/cc',str(ROOT/'processor/probe.c'),'-O2','-o',str(fs/'usr/bin/processor-probe')],check=True,capture_output=True)
 binaries=[Path('/usr/bin/node'),fs/'usr/bin/processor-probe']
 for path in (fs/'deps/node_modules').rglob('*'):
  if path.is_file():
   with path.open('rb') as stream:
    if stream.read(4)==b'\x7fELF':binaries.append(path)
 libraries=set(['/lib64/ld-linux-x86-64.so.2'])
 for path in binaries:
  result=subprocess.run(['ldd',str(path)],capture_output=True,text=True)
  if result.returncode and 'not a dynamic executable' not in result.stdout+result.stderr:raise RuntimeError('runtime_dependency_scan:'+result.stdout+result.stderr)
  libraries.update(re.findall(r'(/[A-Za-z0-9_./+-]+)',result.stdout))
 configured=re.findall(r'NODE_SHARED_BUILTIN_[A-Z_]+_PATH=([^\"\s]+)',Path('/usr/include/node/config.gypi').read_text())
 if len(configured)!=6 or any(not value.startswith('/usr/share/nodejs/') for value in configured):raise ValueError('unsupported_externalized_builtins')
 for original in [Path('/usr/bin/node'),*[Path(p) for p in libraries],*[Path(p) for p in configured]]:
  destination=fs/str(original).lstrip('/');destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original.resolve(),destination);destination.chmod(0o555)
 command=['/usr/bin/node',str(ROOT/'node_modules/typescript/bin/tsc'),'--ignoreConfig','--noCheck','--target','ES2023','--module','ESNext','--moduleResolution','Bundler','--rewriteRelativeImportExtensions','--rootDir',str(ROOT),'--outDir',str(fs/'runner'),str(ROOT/'processor/jail.ts'),str(ROOT/'processor/validate.ts')]
 subprocess.run(command,cwd=ROOT,check=True,capture_output=True)
 (fs/'runner/package.json').write_text('{"type":"module"}\n');shutil.copyfile(ROOT/'package-lock.json',fs/'runner/package-lock.json');os.symlink('/deps/node_modules',fs/'runner/node_modules')
 seccomp_filter(target/'policy.bpf');(target/'policy.json').write_bytes(canonical(policy()))
 files={str(path.relative_to(target)):{'sha256':file_hash(path),'bytes':path.stat().st_size} for path in sorted(target.rglob('*')) if path.is_file() and not path.is_symlink()}
 supervisor={name:{'sha256':file_hash(ROOT/name),'bytes':(ROOT/name).stat().st_size} for name in ['processor/policy.py','processor/runtime.py','processor/launch.py','processor/sandbox.py','processor/cli.py','processor/service.py']}
 dependencies=digest(canonical(packages));harness=digest(canonical({k:v for k,v in files.items() if k.startswith('rootfs/runner/')}));harness=digest(canonical({'node':harness,'supervisor':supervisor}));manifest={'formatVersion':1,'files':files,'supervisor':supervisor,'dependencies':packages,'dependencyManifestSha256':dependencies,'harnessSha256':harness,'nodeVersion':'22.22.1','policySha256':digest(canonical({'limits':policy(),'seccomp':files['policy.bpf']['sha256'],'supervisor':supervisor}))};manifest['capsuleSha256']=digest(canonical(manifest));(target/'runtime.json').write_bytes(canonical(manifest));return manifest

def verify(target):
 target=Path(target).resolve();manifest=json.loads((target/'runtime.json').read_text());expected=manifest.pop('capsuleSha256')
 if digest(canonical(manifest))!=expected:raise ValueError('runtime_manifest_changed')
 manifest['capsuleSha256']=expected
 actual={str(path.relative_to(target)) for path in target.rglob('*') if path.is_file() and not path.is_symlink() and str(path.relative_to(target))!='runtime.json'}
 if actual!=set(manifest['files']):raise ValueError('runtime_unlisted_files')
 links={str(path.relative_to(target)):os.readlink(path) for path in target.rglob('*') if path.is_symlink()}
 if links!={'rootfs/runner/node_modules':'/deps/node_modules'}:raise ValueError('runtime_symlink_changed')
 for name,record in manifest.get('supervisor',{}).items():
  safe_path(name)
  if file_hash(ROOT/name)!=record['sha256']:raise ValueError('supervisor_changed:'+name)
 for path,record in manifest['files'].items():
  safe_path(path);file=target/path
  if not file.is_file() or file.is_symlink() or file.stat().st_size!=record['bytes'] or file_hash(file)!=record['sha256']:raise ValueError('runtime_file_changed:'+path)
 return manifest

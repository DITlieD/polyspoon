import ctypes
import ctypes.util
import errno
import hashlib
import json
import os
from pathlib import PurePosixPath

def canonical(value):
 return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()

def digest(value):
 return hashlib.sha256(value).hexdigest()

def safe_path(value):
 if not isinstance(value,str) or not value or len(value)>240 or '\\' in value or '\x00' in value or value.startswith('/') or any(p in ('','..','.') for p in value.split('/')):
  raise ValueError('unsafe_path')
 return str(PurePosixPath(value))

def policy():
 return {'id':'linux-bwrap-cgroup-v1','memoryBytes':2*1024**3,'swapBytes':0,'coreBytes':0,'tasks':64,'cpuPercent':100,'wallSeconds':120,'scratchBytes':256*1024**2,'outputBytes':16*1024**2,'artifactBytes':2*1024**2,'captureBytes':8*1024**2,'diagnosticBytes':256*1024,'network':'none','stages':['input-check','compile','replay-a','replay-b','validate']}

def seccomp_filter(path):
 lib=ctypes.CDLL(ctypes.util.find_library('seccomp'),use_errno=True)
 lib.seccomp_init.argtypes=[ctypes.c_uint32];lib.seccomp_init.restype=ctypes.c_void_p
 lib.seccomp_syscall_resolve_name.argtypes=[ctypes.c_char_p];lib.seccomp_syscall_resolve_name.restype=ctypes.c_int
 lib.seccomp_rule_add.argtypes=[ctypes.c_void_p,ctypes.c_uint32,ctypes.c_int,ctypes.c_uint]
 lib.seccomp_export_bpf.argtypes=[ctypes.c_void_p,ctypes.c_int]
 lib.seccomp_release.argtypes=[ctypes.c_void_p]
 context=lib.seccomp_init(0x7fff0000)
 if not context:raise RuntimeError('seccomp_init_failed')
 try:
  deny=['mount','umount2','pivot_root','move_mount','open_tree','fsopen','fsmount','fspick','mount_setattr','setns','unshare','ptrace','process_vm_readv','process_vm_writev','bpf','perf_event_open','userfaultfd','keyctl','add_key','request_key','open_by_handle_at','name_to_handle_at','kexec_load','kexec_file_load','init_module','finit_module','delete_module','socket','connect','bind','listen','accept','accept4']
  for name in deny+['clone3']:
   number=lib.seccomp_syscall_resolve_name(name.encode())
   if number>=0 and lib.seccomp_rule_add(context,0x50000|(errno.ENOSYS if name=='clone3' else errno.EPERM),number,0)!=0:raise RuntimeError('seccomp_rule_failed')
  with open(path,'xb') as output:
   if lib.seccomp_export_bpf(context,output.fileno())!=0:raise RuntimeError('seccomp_export_failed')
 finally:lib.seccomp_release(context)

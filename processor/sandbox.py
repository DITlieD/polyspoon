import json
import os
import selectors
import subprocess
import time
import uuid
from pathlib import Path
from processor.policy import policy

ROOT=Path(__file__).resolve().parents[1]

def run(runtime,inputs,mode,source=None,compiled=None,limits=None):
 base=policy()
 for key,value in (limits or {}).items():
  if key not in ['memoryBytes','tasks','wallSeconds','cpuPercent'] or not isinstance(value,int) or value<1 or value>base[key]:raise ValueError('invalid_limit_override')
 limits={**base,**(limits or {})};unit='polyspoon-processing-'+uuid.uuid4().hex+'.service'
 (Path(inputs).parent/(mode+'.unit')).write_text(unit)
 launcher=['/usr/bin/python3',str(ROOT/'processor/launch.py'),'--runtime',str(runtime),'--input',str(inputs),'--mode',mode,'--owner-pid',str(os.getpid())]
 if source:launcher+=['--source',str(source)]
 if compiled:launcher+=['--compiled',str(compiled)]
 properties=['MemoryMax='+str(limits['memoryBytes']),'MemorySwapMax=0','TasksMax='+str(limits['tasks']),'CPUQuota='+str(limits['cpuPercent'])+'%','RuntimeMaxSec='+str(limits['wallSeconds']),'TimeoutStopSec=1','KillMode=control-group','OOMPolicy=kill','LimitFSIZE='+str(limits['artifactBytes']),'NoNewPrivileges=yes','LimitCORE=0']
 command=['systemd-run','--user','--wait','--pipe','--unit='+unit,'--slice=hostq-batch.slice',*['--property='+p for p in properties],'--',*launcher]
 environment={key:os.environ[key] for key in ['PATH','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS'] if key in os.environ}
 slice_group=subprocess.run(['systemctl','--user','show','hostq-batch.slice','--property=ControlGroup','--value'],capture_output=True,text=True,env=environment,check=True).stdout.strip()
 if not slice_group.startswith('/'):raise RuntimeError('missing_scheduler_slice')
 cgroup=Path('/sys/fs/cgroup')/slice_group.lstrip('/')/unit
 started=time.monotonic();child=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=environment,close_fds=True);streams=selectors.DefaultSelector();streams.register(child.stdout,selectors.EVENT_READ,'stdout');streams.register(child.stderr,selectors.EVENT_READ,'stderr');captured={'stdout':bytearray(),'stderr':bytearray()};failure=None;manager_result='';effective=None;peak=0;oom=0;pid_events=0
 def observe():
  nonlocal effective,peak,oom,pid_events,manager_result
  status=subprocess.run(['systemctl','--user','show',unit,'--property=Result','--value'],capture_output=True,text=True,env=environment,timeout=3).stdout.strip()
  if status and status!='success':manager_result=status
  try:
   effective={name:(cgroup/name).read_text().strip() for name in ['memory.max','memory.swap.max','pids.max','cpu.max']}
   peak=max(peak,int((cgroup/'memory.peak').read_text()))
   counts=dict(line.split() for line in (cgroup/'memory.events').read_text().splitlines());oom=max(oom,int(counts.get('oom_kill','0')))
   counts=dict(line.split() for line in (cgroup/'pids.events').read_text().splitlines());pid_events=max(pid_events,int(counts.get('max','0')))
  except FileNotFoundError:pass
 try:
  while streams.get_map():
   observe()
   if time.monotonic()-started>limits['wallSeconds']+5:raise TimeoutError('supervisor_deadline')
   for key,_ in streams.select(.1):
    block=os.read(key.fileobj.fileno(),65536)
    if not block:streams.unregister(key.fileobj);continue
    captured[key.data].extend(block);bound=limits['captureBytes'] if key.data=='stdout' else limits['diagnosticBytes']
    if len(captured[key.data])>bound:raise ValueError('capture_limit')
  child.wait(timeout=2)
 except Exception as error:failure=str(error)
 finally:
  observe()
  subprocess.run(['systemctl','--user','stop',unit],capture_output=True,env=environment,timeout=5)
  if child.poll() is None:child.kill();child.wait(timeout=2)
  state=subprocess.run(['systemctl','--user','show',unit,'--property=ActiveState','--value'],capture_output=True,text=True,env=environment,timeout=5)
  tasks=(cgroup/'cgroup.procs').read_text().strip() if (cgroup/'cgroup.procs').exists() else ''
  terminated=state.stdout.strip() in ('','inactive','failed') and not tasks
  subprocess.run(['systemctl','--user','reset-failed',unit],capture_output=True,env=environment,timeout=5)
  streams.close();child.stdout.close();child.stderr.close()
 if not terminated:raise RuntimeError('process_teardown_unconfirmed')
 return {'id':mode,'exitCode':child.returncode if not failure else 125,'terminated':terminated,'wallMs':round((time.monotonic()-started)*1000),'stdout':bytes(captured['stdout']),'stderr':bytes(captured['stderr']),'failure':failure,'remainingTasks':tasks.split() if tasks else [],'effectiveLimits':effective,'observedMemoryPeakBytes':peak,'oomKillCount':oom,'pidLimitEvents':pid_events,'managerResult':manager_result}

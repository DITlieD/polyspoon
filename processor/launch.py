import argparse
import os
import select
import signal
from pathlib import Path

parser=argparse.ArgumentParser();parser.add_argument('--owner-pid',required=True,type=int);parser.add_argument('--runtime',required=True);parser.add_argument('--input',required=True);parser.add_argument('--source');parser.add_argument('--compiled');parser.add_argument('--mode',required=True,choices=['input-check','compile','replay-a','replay-b','validate','probe']);args=parser.parse_args()
runtime=Path(args.runtime).resolve();os.closerange(3,65536);descriptor=os.open(runtime/'policy.bpf',os.O_RDONLY);os.set_inheritable(descriptor,True)
command=['/usr/bin/bwrap','--unshare-all','--unshare-user','--disable-userns','--assert-userns-disabled','--die-with-parent','--new-session','--cap-drop','ALL','--clearenv','--setenv','PATH','/usr/bin','--setenv','HOME','/tmp','--setenv','TMPDIR','/tmp','--setenv','LANG','C.UTF-8','--ro-bind',str(runtime/'rootfs'),'/','--proc','/proc','--dev','/dev','--size','268435456','--tmpfs','/work','--size','16777216','--tmpfs','/out','--size','16777216','--tmpfs','/tmp','--ro-bind',str(Path(args.input).resolve()),'/input','--seccomp',str(descriptor)]
if args.source:command+=['--ro-bind',str(Path(args.source).resolve()),'/package']
if args.compiled:command+=['--ro-bind',str(Path(args.compiled).resolve()),'/package/.recipe-build']
script='/runner/processor/validate.js' if args.mode=='validate' else '/runner/processor/jail.js';command+=['--chdir','/work','/usr/bin/node',script,args.mode]
owner=os.pidfd_open(args.owner_pid);payload=os.fork()
if payload==0:
 os.close(owner);os.environ.clear();os.execv(command[0],command)
os.close(descriptor);payload_fd=os.pidfd_open(payload);poll=select.poll();poll.register(owner,select.POLLIN);poll.register(payload_fd,select.POLLIN)
ready=dict(poll.poll())
if owner in ready:
 try:os.kill(payload,signal.SIGKILL)
 except ProcessLookupError:pass
_,status=os.waitpid(payload,0);os.close(owner);os.close(payload_fd);code=os.waitstatus_to_exitcode(status);raise SystemExit(code if code>=0 else 128-code)


#define _GNU_SOURCE
#include <errno.h>
#include <stdio.h>
#include <sys/socket.h>
#include <sys/mount.h>
#include <sys/ptrace.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <sched.h>
int main(void){
 int a,b,c,d,e;
 errno=0;socket(AF_INET,SOCK_STREAM,0);a=errno;
 errno=0;mount("tmpfs","/tmp","tmpfs",0,0);b=errno;
 errno=0;unshare(CLONE_NEWUSER);c=errno;
 errno=0;ptrace(PTRACE_TRACEME,0,0,0);d=errno;
 errno=0;syscall(SYS_clone3,0,0);e=errno;
 printf("{\"socketErrno\":%d,\"mountErrno\":%d,\"usernsErrno\":%d,\"ptraceErrno\":%d,\"clone3Errno\":%d}\n",a,b,c,d,e);
 return 0;
}

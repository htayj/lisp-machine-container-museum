#define _GNU_SOURCE

#include <dlfcn.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>

/*
 * The computer-use harness configures its private tun0 before launching the
 * VLM.  Suppress only the historical command that would otherwise repeat that
 * work through a host-absolute /sbin/ifconfig path.  Every other system(3)
 * request retains the libc behavior.
 */
int system(const char *command) {
  static int (*real_system)(const char *) = NULL;
  static const char expected[] =
      "/sbin/ifconfig tun0 10.0.0.1 dstaddr 10.0.0.2 "
      "netmask 255.255.255.0";

  if (command != NULL && strcmp(command, expected) == 0) {
    return 0;
  }

  if (real_system == NULL) {
    real_system = (int (*)(const char *))dlsym(RTLD_NEXT, "system");
    if (real_system == NULL) {
      errno = ENOSYS;
      return -1;
    }
  }
  return real_system(command);
}

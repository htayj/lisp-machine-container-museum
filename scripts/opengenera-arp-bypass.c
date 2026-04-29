#define _GNU_SOURCE

#include <dlfcn.h>
#include <net/if_arp.h>
#include <stddef.h>
#include <stdarg.h>
#include <sys/ioctl.h>

int ioctl(int fd, unsigned long request, ...) {
  static int (*real_ioctl)(int, unsigned long, void *) = NULL;
  va_list ap;
  void *argp;

  if (real_ioctl == NULL) {
    real_ioctl = (int (*)(int, unsigned long, void *))dlsym(RTLD_NEXT, "ioctl");
  }

  va_start(ap, request);
  argp = va_arg(ap, void *);
  va_end(ap);

  if (request == SIOCSARP) {
    return 0;
  }

  return real_ioctl(fd, request, argp);
}

#define _GNU_SOURCE
#include <dirent.h>
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#ifndef SUPERVISOR_PATH
#error SUPERVISOR_PATH must be fixed by the Guix build
#endif

static void fail(const char *message) {
  (void)write(STDERR_FILENO, message, strlen(message));
  (void)write(STDERR_FILENO, "\n", 1);
  _exit(125);
}

static void reject_extra_descriptors(void) {
  DIR *directory = opendir("/proc/self/fd");
  if (directory == NULL) fail("M7 service entry cannot inspect inherited descriptors");
  const int inspection_fd = dirfd(directory);
  errno = 0;
  for (struct dirent *entry = readdir(directory); entry != NULL; entry = readdir(directory)) {
    char *end = NULL;
    const long fd = strtol(entry->d_name, &end, 10);
    if (end == entry->d_name || *end != '\0') continue;
    if (fd > STDERR_FILENO && fd != inspection_fd) {
      (void)closedir(directory);
      fail("M7 service entry inherited a nonstandard descriptor");
    }
  }
  if (errno != 0 || closedir(directory) != 0) {
    fail("M7 service entry descriptor inspection failed");
  }
}

int main(int argc, char **argv) {
  (void)argv;
  if (argc != 1) fail("M7 service entry takes no caller arguments");
  reject_extra_descriptors();
  char *const child_argv[] = { (char *)SUPERVISOR_PATH, NULL };
  char *const child_env[] = { "HOME=/var/empty", "LANG=C", "LC_ALL=C",
    "PATH=/var/empty", "TZ=UTC", NULL };
  execve(SUPERVISOR_PATH, child_argv, child_env);
  fail("M7 service entry could not exec the immutable supervisor");
  return 125;
}

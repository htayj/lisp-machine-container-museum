/* M14 descriptor-relative publication helper.  Build statically; it accepts
 * one already JS-validated safe basename and links fd 3 into directory fd 4. */
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static int safe_name(const char *name) {
  size_t length = strlen(name);
  if (length == 0 || length > 128 || !(('A' <= name[0] && name[0] <= 'Z') || ('a' <= name[0] && name[0] <= 'z') || ('0' <= name[0] && name[0] <= '9'))) return 0;
  for (size_t i = 1; i < length; i++) if (!((('A' <= name[i] && name[i] <= 'Z') || ('a' <= name[i] && name[i] <= 'z') || ('0' <= name[i] && name[i] <= '9') || name[i] == '.' || name[i] == '_' || name[i] == '-'))) return 0;
  return strcmp(name, ".") != 0 && strcmp(name, "..") != 0;
}

int main(int argc, char **argv) {
  if (argc != 2 || !safe_name(argv[1])) return 64;
  if (linkat(AT_FDCWD, "/proc/self/fd/3", 4, argv[1], AT_SYMLINK_FOLLOW) != 0) { fprintf(stderr, "linkat errno=%d\n", errno); return 1; }
  return 0;
}

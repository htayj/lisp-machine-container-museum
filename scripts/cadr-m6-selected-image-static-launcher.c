/*
 * Minimal x86-64 Linux authority-reducing launcher for the CADR M6 selected
 * image negative gate.  It has no libc, dynamic loader, constructors, or
 * inherited environment.  The build supplies one reviewed absolute Node path.
 */
#ifndef M6_NODE_PATH
#error M6_NODE_PATH must name the reviewed absolute Node executable
#endif

typedef unsigned long m6_word;

static long
m6_execve(const char *path, char *const argv[], char *const envp[])
{
  register long rax __asm__("rax") = 59;
  register const char *rdi __asm__("rdi") = path;
  register char *const *rsi __asm__("rsi") = argv;
  register char *const *rdx __asm__("rdx") = envp;
  __asm__ volatile("syscall"
                   : "+a"(rax)
                   : "D"(rdi), "S"(rsi), "d"(rdx)
                   : "rcx", "r11", "memory");
  return rax;
}

__attribute__((noreturn))
static void
m6_exit(long status)
{
  register long rax __asm__("rax") = 60;
  register long rdi __asm__("rdi") = status;
  __asm__ volatile("syscall" : : "a"(rax), "D"(rdi) : "rcx", "r11", "memory");
  __builtin_unreachable();
}

static int
m6_equal(const char *left, const char *right)
{
  while (*left != 0 && *left == *right) {
    left++;
    right++;
  }
  return *left == *right;
}

static int
m6_hex(char value)
{
  return (value >= '0' && value <= '9') || (value >= 'a' && value <= 'f');
}

static int
m6_unit(const char *value)
{
  static const char prefix[] = "cadr-m6-selected-image-negative-";
  static const char suffix[] = ".service";
  unsigned long index = 0;
  while (prefix[index] != 0) {
    if (value[index] != prefix[index]) return 0;
    index++;
  }
  for (unsigned long count = 0; count < 32; count++, index++) {
    if (!m6_hex(value[index])) return 0;
  }
  for (unsigned long count = 0; suffix[count] != 0; count++, index++) {
    if (value[index] != suffix[count]) return 0;
  }
  return value[index] == 0;
}

__attribute__((noreturn, used))
void
m6_start(m6_word *initial_stack)
{
  long argc = (long)initial_stack[0];
  char **argv = (char **)&initial_stack[1];
  static char unit_environment[128] =
    "M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_UNIT=";
  static char lang[] = "LANG=C";
  static char locale[] = "LC_ALL=C";
  static char child[] = "M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_CHILD=1";
  static char timezone[] = "TZ=UTC";
  static char umask[] = "UMASK=0077";
  char *envp[7];
  unsigned long output = sizeof("M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_UNIT=") - 1;
  unsigned long input = 0;

  if (argc < 4 || !m6_unit(argv[1]) || !m6_equal(argv[2], M6_NODE_PATH)) {
    m6_exit(126);
  }
  while (argv[1][input] != 0 &&
         output + 1 < sizeof(unit_environment)) {
    unit_environment[output++] = argv[1][input++];
  }
  if (argv[1][input] != 0) m6_exit(126);
  unit_environment[output] = 0;

  envp[0] = lang;
  envp[1] = locale;
  envp[2] = child;
  envp[3] = unit_environment;
  envp[4] = timezone;
  envp[5] = umask;
  envp[6] = (char *)0;
  m6_execve(M6_NODE_PATH, &argv[2], envp);
  m6_exit(127);
}

__asm__(
  ".global _start\n"
  ".type _start,@function\n"
  "_start:\n"
  "mov %rsp,%rdi\n"
  "andq $-16,%rsp\n"
  "call m6_start\n"
  ".size _start,.-_start\n"
  ".section .note.GNU-stack,\"\",@progbits\n"
);

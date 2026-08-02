/*
 * Minimal x86-64 Linux authority-reducing launcher for the captured M8/M9
 * Python oracle.  Bubblewrap enters the namespaces first and executes this
 * immutable Guix-store program before CPython.  There is no libc, dynamic
 * loader, constructor, environment lookup, or pathname search.
 */
#if !defined(__x86_64__)
#error cadr-m8-m9-python-seal-launcher requires x86-64 Linux
#endif

typedef unsigned long seal_word;
struct seal_rlimit {
  unsigned long current;
  unsigned long maximum;
};

static long
seal_syscall1(long number, long first)
{
  register long rax __asm__("rax") = number;
  register long rdi __asm__("rdi") = first;
  __asm__ volatile("syscall"
                   : "+a"(rax)
                   : "D"(rdi)
                   : "rcx", "r11", "memory");
  return rax;
}

static long
seal_prctl(long option, long argument)
{
  register long rax __asm__("rax") = 157;
  register long rdi __asm__("rdi") = option;
  register long rsi __asm__("rsi") = argument;
  register long rdx __asm__("rdx") = 0;
  register long r10 __asm__("r10") = 0;
  register long r8 __asm__("r8") = 0;
  __asm__ volatile("syscall"
                   : "+a"(rax)
                   : "D"(rdi), "S"(rsi), "d"(rdx), "r"(r10), "r"(r8)
                   : "rcx", "r11", "memory");
  return rax;
}

static long
seal_prlimit(struct seal_rlimit *limit)
{
  register long rax __asm__("rax") = 302;
  register long rdi __asm__("rdi") = 0;
  register long rsi __asm__("rsi") = 4;
  register struct seal_rlimit *rdx __asm__("rdx") = limit;
  register long r10 __asm__("r10") = 0;
  __asm__ volatile("syscall"
                   : "+a"(rax)
                   : "D"(rdi), "S"(rsi), "d"(rdx), "r"(r10)
                   : "rcx", "r11", "memory");
  return rax;
}

static long
seal_execve(const char *path, char *const argv[], char *const envp[])
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

static int
seal_equal(const char *left, const char *right)
{
  while (*left != 0 && *left == *right) {
    left++;
    right++;
  }
  return *left == *right;
}

static int
seal_prefix(const char *value, const char *prefix)
{
  while (*prefix != 0) {
    if (*value++ != *prefix++) return 0;
  }
  return *value == '/';
}

static int
seal_suffix(const char *value, const char *suffix)
{
  const char *cursor = value;
  const char *tail = suffix;
  unsigned long value_length = 0, suffix_length = 0;
  while (*cursor++ != 0) value_length++;
  while (*tail++ != 0) suffix_length++;
  if (value_length < suffix_length) return 0;
  return seal_equal(value + value_length - suffix_length, suffix);
}

__attribute__((noreturn, used))
void
seal_start(seal_word *initial_stack)
{
  long argc = (long)initial_stack[0];
  char **argv = (char **)&initial_stack[1];
  char **inherited_env = &argv[argc + 1];
  char *python_argv[134];
  static char python[] = "/tmp/cadr-captured/python";
  static char no_user_site[] = "-s";
  static char no_bytecode[] = "-B";
  static char program_prefix[] = "/__cadr_m8_m9_captured_python__";
  static char preload[] =
    "LD_PRELOAD=/tmp/cadr-captured/prepython-guard.so";
  static char pythonpath[] = "PYTHONPATH=/tmp/cadr-captured";
  char *envp[8];
  struct seal_rlimit no_core = { 0, 0 };
  long index, environment_count = 0;
  unsigned long environment_fields = 0;

  if (argc < 2 || argc > 128 ||
      !seal_prefix(argv[1], program_prefix) || !seal_suffix(argv[1], ".py")) {
    seal_syscall1(60, 126);
  }
  while (inherited_env[environment_count] != (char *)0) {
    char *entry = inherited_env[environment_count];
    unsigned long field = 0;
    if (seal_equal(entry, "LANG=C")) field = 1;
    else if (seal_equal(entry, "LC_ALL=C")) field = 2;
    else if (seal_equal(entry, "TZ=UTC")) field = 4;
    else if (seal_equal(entry,
             "CADR_M8_M9_PYTHON_PROGRAM_ROOT=/__cadr_m8_m9_captured_python__")) {
      field = 8;
    }
    if (field == 0 || (environment_fields & field) != 0 ||
        environment_count >= 4) {
      seal_syscall1(60, 126);
    }
    environment_fields |= field;
    envp[environment_count] = entry;
    environment_count++;
  }
  if (environment_fields != 15 || environment_count != 4) {
    seal_syscall1(60, 126);
  }
  envp[environment_count++] = pythonpath;
  envp[environment_count++] = preload;
  envp[environment_count] = (char *)0;

  /* PR_SET_DUMPABLE, PR_SET_PTRACER(none), PR_SET_NO_NEW_PRIVS, umask. */
  if (seal_prlimit(&no_core) != 0 ||
      seal_prctl(4, 0) != 0 ||
      seal_prctl(0x59616d61L, 0) != 0 ||
      seal_prctl(38, 1) != 0) {
    seal_syscall1(60, 125);
  }
  (void)seal_syscall1(95, 0077);
  python_argv[0] = python;
  /* `site` loads the immutable sitecustomize gate through the one exact
   * PYTHONPATH supplied above before the real root becomes __main__.  The
   * launcher replaces (rather than inherits) the whole environment, so -s
   * suppresses user-site state without -E hiding the sealed startup hook. */
  python_argv[1] = no_user_site;
  python_argv[2] = no_bytecode;
  python_argv[3] = argv[1];
  for (index = 2; index < argc; index++) {
    python_argv[index + 2] = argv[index];
  }
  python_argv[argc + 2] = (char *)0;
  (void)seal_execve(python, python_argv, envp);
  seal_syscall1(60, 127);
  __builtin_unreachable();
}

__asm__(
  ".global _start\n"
  ".type _start,@function\n"
  "_start:\n"
  "mov %rsp,%rdi\n"
  "andq $-16,%rsp\n"
  "call seal_start\n"
  ".size _start,.-_start\n"
  ".section .note.GNU-stack,\"\",@progbits\n"
);

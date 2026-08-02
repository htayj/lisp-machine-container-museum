/*
 * Runs from the dynamic loader before CPython main.  Linux resets dumpability
 * during execve, so the static inner launcher alone cannot preserve its seal.
 * This constructor restores the authority-reducing state before Python starts.
 */
#if !defined(__x86_64__)
#error cadr-m8-m9-prepython-guard requires x86-64 Linux
#endif

struct seal_rlimit {
  unsigned long current;
  unsigned long maximum;
};

static long
seal_guard_prctl(long option, long argument)
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
seal_guard_prlimit(struct seal_rlimit *limit)
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

__attribute__((noreturn))
static void
seal_guard_exit(void)
{
  register long rax __asm__("rax") = 60;
  register long rdi __asm__("rdi") = 124;
  __asm__ volatile("syscall" : : "a"(rax), "D"(rdi) : "rcx", "r11", "memory");
  __builtin_unreachable();
}

__attribute__((constructor))
static void
seal_guard_initialize(void)
{
  struct seal_rlimit no_core = { 0, 0 };
  if (seal_guard_prlimit(&no_core) != 0 ||
      seal_guard_prctl(38, 1) != 0 ||
      seal_guard_prctl(4, 0) != 0 ||
      seal_guard_prctl(3, 0) != 0) {
    seal_guard_exit();
  }
}

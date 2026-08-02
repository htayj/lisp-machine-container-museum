/*
 * Descriptor-only authority dropper for the M7 P4 host-root foundation.
 *
 * This program intentionally has no production launcher yet.  A future
 * independently recomputed Phase-A authority may invoke it with exactly one
 * literal argument and these inherited descriptors:
 *
 *   fd 3  fixed M7HDPV1 binary configuration, opened by the supervisor
 *   fd 4  exact Guix Node executable, identity and SHA-256 in fd 3
 *   fd 5  signed-captured unprivileged JavaScript runner, likewise pinned
 *
 * It never resolves a caller pathname, reads caller environment, searches
 * PATH, or accepts caller-selected uid, gid, executable, or runner.  The
 * synthetic mode is deliberately incompatible with production evidence; it
 * exists only to exercise the authority-reducing transition without claiming
 * that the not-yet-implemented Phase-A recomputation has occurred.
 */
#define _GNU_SOURCE
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <inttypes.h>
#include <linux/capability.h>
#include <linux/limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/sysmacros.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <unistd.h>

#if !defined(__linux__)
#error cadr-m7-p4-host-dropper requires Linux
#endif

enum {
  CONFIG_FD = 3,
  NODE_FD = 4,
  RUNNER_FD = 5,
  CONFIG_VERSION = 1,
  CONFIG_FLAG_SYNTHETIC = 1,
  CONFIG_FLAG_ALLOW_NONINITIAL_USERNS = 2,
  EXIT_USAGE = 64,
  EXIT_CONFIGURATION = 65,
  EXIT_AUTHORITY = 125,
  EXIT_EXEC = 126,
};

struct __attribute__((packed)) m7_host_dropper_config {
  unsigned char magic[8];             /* M7HDPV1 followed by NUL */
  uint32_t version;
  uint32_t flags;
  uint64_t target_uid;
  uint64_t target_gid;
  uint64_t node_dev;
  uint64_t node_ino;
  uint64_t runner_dev;
  uint64_t runner_ino;
  uint64_t userns_dev;
  uint64_t userns_ino;
  unsigned char node_sha256[32];
  unsigned char runner_sha256[32];
  /* Retained signed-capture metadata.  This native program does not verify a
   * signature: the future Phase-A root must authenticate this field before it
   * creates fd 3.  The dropper's independent claim is only the fd-5 identity
   * and SHA-256 binding below.  production_evidence:false until then. */
  unsigned char signed_capture_metadata_sha256[32];
};

struct sha256_state {
  uint32_t h[8];
  uint64_t bytes;
  unsigned char buffer[64];
  size_t buffered;
};

static const unsigned char config_magic[8] = {
  'M', '7', 'H', 'D', 'P', 'V', '1', 0
};

static void
die(int status, const char *message)
{
  (void)dprintf(STDERR_FILENO, "cadr-m7-p4-host-dropper: %s\n", message);
  _exit(status);
}

static uint32_t
rotr32(uint32_t value, unsigned int shift)
{
  return (value >> shift) | (value << (32U - shift));
}

static uint32_t
load_be32(const unsigned char *bytes)
{
  return ((uint32_t)bytes[0] << 24) | ((uint32_t)bytes[1] << 16) |
    ((uint32_t)bytes[2] << 8) | (uint32_t)bytes[3];
}

static void
store_be32(unsigned char *bytes, uint32_t value)
{
  bytes[0] = (unsigned char)(value >> 24);
  bytes[1] = (unsigned char)(value >> 16);
  bytes[2] = (unsigned char)(value >> 8);
  bytes[3] = (unsigned char)value;
}

static void
sha256_transform(struct sha256_state *state, const unsigned char *block)
{
  static const uint32_t k[64] = {
    0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U,
    0x3956c25bU, 0x59f111f1U, 0x923f82a4U, 0xab1c5ed5U,
    0xd807aa98U, 0x12835b01U, 0x243185beU, 0x550c7dc3U,
    0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U, 0xc19bf174U,
    0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU,
    0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU,
    0x983e5152U, 0xa831c66dU, 0xb00327c8U, 0xbf597fc7U,
    0xc6e00bf3U, 0xd5a79147U, 0x06ca6351U, 0x14292967U,
    0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU, 0x53380d13U,
    0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U,
    0xa2bfe8a1U, 0xa81a664bU, 0xc24b8b70U, 0xc76c51a3U,
    0xd192e819U, 0xd6990624U, 0xf40e3585U, 0x106aa070U,
    0x19a4c116U, 0x1e376c08U, 0x2748774cU, 0x34b0bcb5U,
    0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU, 0x682e6ff3U,
    0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
    0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U
  };
  uint32_t words[64];
  uint32_t a, b, c, d, e, f, g, h;
  size_t index;

  for (index = 0; index < 16; index++) words[index] = load_be32(block + (index * 4));
  for (index = 16; index < 64; index++) {
    uint32_t s0 = rotr32(words[index - 15], 7) ^ rotr32(words[index - 15], 18) ^
      (words[index - 15] >> 3);
    uint32_t s1 = rotr32(words[index - 2], 17) ^ rotr32(words[index - 2], 19) ^
      (words[index - 2] >> 10);
    words[index] = words[index - 16] + s0 + words[index - 7] + s1;
  }
  a = state->h[0]; b = state->h[1]; c = state->h[2]; d = state->h[3];
  e = state->h[4]; f = state->h[5]; g = state->h[6]; h = state->h[7];
  for (index = 0; index < 64; index++) {
    uint32_t s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
    uint32_t choice = (e & f) ^ ((~e) & g);
    uint32_t temporary1 = h + s1 + choice + k[index] + words[index];
    uint32_t s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
    uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
    uint32_t temporary2 = s0 + majority;
    h = g; g = f; f = e; e = d + temporary1;
    d = c; c = b; b = a; a = temporary1 + temporary2;
  }
  state->h[0] += a; state->h[1] += b; state->h[2] += c; state->h[3] += d;
  state->h[4] += e; state->h[5] += f; state->h[6] += g; state->h[7] += h;
}

static void
sha256_init(struct sha256_state *state)
{
  static const uint32_t initial[8] = {
    0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U, 0xa54ff53aU,
    0x510e527fU, 0x9b05688cU, 0x1f83d9abU, 0x5be0cd19U
  };
  memcpy(state->h, initial, sizeof(initial));
  state->bytes = 0; state->buffered = 0;
}

static void
sha256_update(struct sha256_state *state, const unsigned char *bytes, size_t count)
{
  state->bytes += count;
  while (count != 0) {
    size_t available = 64 - state->buffered;
    size_t copied = count < available ? count : available;
    memcpy(state->buffer + state->buffered, bytes, copied);
    state->buffered += copied; bytes += copied; count -= copied;
    if (state->buffered == 64) {
      sha256_transform(state, state->buffer); state->buffered = 0;
    }
  }
}

static void
sha256_final(struct sha256_state *state, unsigned char output[32])
{
  uint64_t bits = state->bytes * 8U;
  unsigned char length[8];
  size_t index;
  for (index = 0; index < 8; index++) length[7 - index] = (unsigned char)(bits >> (index * 8));
  sha256_update(state, (const unsigned char *)"\x80", 1);
  while (state->buffered != 56) sha256_update(state, (const unsigned char *)"\0", 1);
  sha256_update(state, length, sizeof(length));
  for (index = 0; index < 8; index++) store_be32(output + (index * 4), state->h[index]);
}

static int
read_full(int fd, void *buffer, size_t bytes)
{
  unsigned char *cursor = buffer;
  while (bytes != 0) {
    ssize_t read_bytes = read(fd, cursor, bytes);
    if (read_bytes == 0) return 0;
    if (read_bytes < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    cursor += (size_t)read_bytes; bytes -= (size_t)read_bytes;
  }
  return 1;
}

static int
all_zero(const unsigned char *bytes, size_t count)
{
  unsigned char folded = 0;
  size_t index;
  for (index = 0; index < count; index++) folded |= bytes[index];
  return folded == 0;
}

static void
read_configuration(struct m7_host_dropper_config *config, int synthetic)
{
  unsigned char trailing;
  int result = read_full(CONFIG_FD, config, sizeof(*config));
  if (result != 1 || read(CONFIG_FD, &trailing, 1) != 0 ||
      memcmp(config->magic, config_magic, sizeof(config_magic)) != 0 ||
      config->version != CONFIG_VERSION ||
      (config->flags & ~(CONFIG_FLAG_SYNTHETIC | CONFIG_FLAG_ALLOW_NONINITIAL_USERNS)) != 0 ||
      ((config->flags & CONFIG_FLAG_ALLOW_NONINITIAL_USERNS) != 0 &&
       (config->flags & CONFIG_FLAG_SYNTHETIC) == 0) ||
      ((config->flags & CONFIG_FLAG_SYNTHETIC) != 0) != synthetic ||
      config->target_uid > UINT32_MAX || config->target_gid > UINT32_MAX ||
      (!synthetic && (config->target_uid == 0 || config->target_gid == 0)) ||
      all_zero(config->node_sha256, sizeof(config->node_sha256)) ||
      all_zero(config->runner_sha256, sizeof(config->runner_sha256)) ||
      all_zero(config->signed_capture_metadata_sha256,
               sizeof(config->signed_capture_metadata_sha256))) {
    die(EXIT_CONFIGURATION, "fixed inherited configuration is malformed or non-production-safe");
  }
}

static void
verify_hashed_regular_fd(int fd, uint64_t expected_dev, uint64_t expected_ino,
                         const unsigned char expected_sha256[32], const char *label)
{
  struct stat before, after;
  struct sha256_state hash;
  unsigned char buffer[32768];
  unsigned char actual[32];
  ssize_t count;
  if (fstat(fd, &before) != 0 || !S_ISREG(before.st_mode) ||
      (uint64_t)before.st_dev != expected_dev || (uint64_t)before.st_ino != expected_ino ||
      lseek(fd, 0, SEEK_SET) < 0) {
    die(EXIT_CONFIGURATION, label);
  }
  sha256_init(&hash);
  for (;;) {
    count = read(fd, buffer, sizeof(buffer));
    if (count == 0) break;
    if (count < 0) {
      if (errno == EINTR) continue;
      die(EXIT_CONFIGURATION, label);
    }
    sha256_update(&hash, buffer, (size_t)count);
  }
  sha256_final(&hash, actual);
  if (fstat(fd, &after) != 0 || before.st_dev != after.st_dev || before.st_ino != after.st_ino ||
      before.st_size != after.st_size || before.st_mtim.tv_sec != after.st_mtim.tv_sec ||
      before.st_mtim.tv_nsec != after.st_mtim.tv_nsec ||
      before.st_ctim.tv_sec != after.st_ctim.tv_sec ||
      before.st_ctim.tv_nsec != after.st_ctim.tv_nsec ||
      memcmp(actual, expected_sha256, sizeof(actual)) != 0 || lseek(fd, 0, SEEK_SET) < 0) {
    die(EXIT_CONFIGURATION, label);
  }
}

static int
read_cap_last_cap(void)
{
  int fd = open("/proc/sys/kernel/cap_last_cap", O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  char value[32];
  char *end = NULL;
  long parsed;
  ssize_t count;
  if (fd < 0) die(EXIT_AUTHORITY, "cannot read cap_last_cap");
  count = read(fd, value, sizeof(value) - 1);
  (void)close(fd);
  if (count <= 0 || (size_t)count == sizeof(value) - 1) die(EXIT_AUTHORITY, "cap_last_cap is malformed");
  value[count] = 0; errno = 0; parsed = strtol(value, &end, 10);
  if (errno != 0 || end == value || (*end != '\n' && *end != 0) || parsed < 0 || parsed > 1024) {
    die(EXIT_AUTHORITY, "cap_last_cap is malformed");
  }
  return (int)parsed;
}

static void
drop_bounding_capabilities(void)
{
  int capability;
  int last = read_cap_last_cap();
  for (capability = 0; capability <= last; capability++) {
    if (prctl(PR_CAPBSET_DROP, capability, 0, 0, 0) != 0) {
      die(EXIT_AUTHORITY, "cannot remove a capability from the bounding set");
    }
  }
}

static void
clear_current_capabilities(void)
{
  struct __user_cap_header_struct header = { _LINUX_CAPABILITY_VERSION_3, 0 };
  struct __user_cap_data_struct data[2] = {{0, 0, 0}, {0, 0, 0}};
  if (prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_CLEAR_ALL, 0, 0, 0) != 0 ||
      syscall(SYS_capset, &header, data) != 0) {
    die(EXIT_AUTHORITY, "cannot clear inheritable permitted effective or ambient capabilities");
  }
}

static int
line_value(const char *status, const char *field, const char **value, size_t *length)
{
  size_t field_length = strlen(field);
  const char *cursor = status;
  while (*cursor != 0) {
    const char *end = strchr(cursor, '\n');
    if (end == NULL) end = cursor + strlen(cursor);
    if (strncmp(cursor, field, field_length) == 0 && cursor[field_length] == ':') {
      const char *start = cursor + field_length + 1;
      while (start < end && (*start == ' ' || *start == '\t')) start++;
      while (end > start && (end[-1] == ' ' || end[-1] == '\t')) end--;
      *value = start; *length = (size_t)(end - start); return 1;
    }
    cursor = *end == 0 ? end : end + 1;
  }
  return 0;
}

static int
parse_exact_quad(const char *value, size_t length, uint64_t expected)
{
  char copy[160];
  char *cursor, *end;
  int index;
  if (length == 0 || length >= sizeof(copy)) return 0;
  memcpy(copy, value, length); copy[length] = 0; cursor = copy;
  for (index = 0; index < 4; index++) {
    unsigned long long parsed;
    errno = 0; parsed = strtoull(cursor, &end, 10);
    if (errno != 0 || end == cursor || parsed != expected) return 0;
    if (index != 3) {
      if (*end != ' ' && *end != '\t') return 0;
      while (*end == ' ' || *end == '\t') end++;
      cursor = end;
    } else if (*end != 0) return 0;
  }
  return 1;
}

static int
all_zero_hex(const char *value, size_t length)
{
  size_t index;
  if (length == 0) return 0;
  for (index = 0; index < length; index++) if (value[index] != '0') return 0;
  return 1;
}

static void
verify_proc_state(const struct m7_host_dropper_config *config)
{
  int fd = open("/proc/self/status", O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  char status[32769];
  const char *value;
  size_t length;
  ssize_t count;
  struct stat self_namespace, initial_namespace;
  if (fd < 0) die(EXIT_AUTHORITY, "cannot inspect dropped child credentials");
  count = read(fd, status, sizeof(status) - 1); (void)close(fd);
  if (count <= 0 || (size_t)count == sizeof(status) - 1) die(EXIT_AUTHORITY, "dropped child status is malformed");
  status[count] = 0;
  if (!line_value(status, "Uid", &value, &length) ||
      !parse_exact_quad(value, length, config->target_uid) ||
      !line_value(status, "Gid", &value, &length) ||
      !parse_exact_quad(value, length, config->target_gid) ||
      !line_value(status, "Groups", &value, &length) || length != 0) {
    die(EXIT_AUTHORITY, "dropped child uid gid or supplementary groups differ from policy");
  }
  if (!line_value(status, "CapInh", &value, &length) || !all_zero_hex(value, length) ||
      !line_value(status, "CapPrm", &value, &length) || !all_zero_hex(value, length) ||
      !line_value(status, "CapEff", &value, &length) || !all_zero_hex(value, length) ||
      !line_value(status, "CapBnd", &value, &length) || !all_zero_hex(value, length) ||
      !line_value(status, "CapAmb", &value, &length) || !all_zero_hex(value, length) ||
      !line_value(status, "NoNewPrivs", &value, &length) || length != 1 || value[0] != '1') {
    die(EXIT_AUTHORITY, "dropped child capabilities or no_new_privs differ from policy");
  }
  if (stat("/proc/self/ns/user", &self_namespace) != 0 ||
      stat("/proc/1/ns/user", &initial_namespace) != 0 ||
      (uint64_t)self_namespace.st_dev != config->userns_dev ||
      (uint64_t)self_namespace.st_ino != config->userns_ino ||
      ((config->flags & CONFIG_FLAG_ALLOW_NONINITIAL_USERNS) == 0 &&
       (self_namespace.st_dev != initial_namespace.st_dev ||
        self_namespace.st_ino != initial_namespace.st_ino))) {
    die(EXIT_AUTHORITY, "dropped child user namespace differs from policy");
  }
}

static void
verify_standard_descriptors(int synthetic)
{
  struct stat input, output, error;
  int output_size, error_size;
  if (fstat(STDIN_FILENO, &input) != 0 || !S_ISCHR(input.st_mode) ||
      major(input.st_rdev) != 1 || minor(input.st_rdev) != 3) {
    die(EXIT_CONFIGURATION, "fd 0 is not the supervisor-owned /dev/null");
  }
  if (fstat(STDOUT_FILENO, &output) != 0 || fstat(STDERR_FILENO, &error) != 0) {
    die(EXIT_CONFIGURATION, "fd 1 or fd 2 is not a bounded supervisor-owned pipe");
  }
  /* Node's test child-process plumbing is a socket pair, not a pipe.  It is
   * accepted only by this permanently non-production synthetic mode. */
  if (synthetic && S_ISSOCK(output.st_mode) && S_ISSOCK(error.st_mode)) return;
  if (!S_ISFIFO(output.st_mode) || !S_ISFIFO(error.st_mode) || output.st_uid != 0 ||
      error.st_uid != 0 || (output.st_mode & 0077) != 0 || (error.st_mode & 0077) != 0 ||
      (output_size = fcntl(STDOUT_FILENO, F_GETPIPE_SZ)) < 1 ||
      (error_size = fcntl(STDERR_FILENO, F_GETPIPE_SZ)) < 1 || output_size > 1048576 ||
      error_size > 1048576) {
    die(EXIT_CONFIGURATION, "fd 1 or fd 2 is not a bounded supervisor-owned pipe");
  }
}

static void
close_non_allowlisted_fds(void)
{
  struct rlimit limit;
  unsigned long fd;
  (void)close(CONFIG_FD);
#ifdef SYS_close_range
  if (syscall(SYS_close_range, (unsigned int)(RUNNER_FD + 1), ~0U, 0) == 0) return;
  if (errno != ENOSYS) die(EXIT_AUTHORITY, "cannot close non-allowlisted descriptors");
#endif
  if (getrlimit(RLIMIT_NOFILE, &limit) != 0 || limit.rlim_cur == RLIM_INFINITY ||
      limit.rlim_cur > 1048576UL) die(EXIT_AUTHORITY, "descriptor bound is unavailable");
  for (fd = (unsigned long)RUNNER_FD + 1; fd < limit.rlim_cur; fd++) (void)close((int)fd);
}

static void
set_close_on_exec(int fd, int enabled)
{
  int flags = fcntl(fd, F_GETFD);
  if (flags < 0 || fcntl(fd, F_SETFD, enabled ? flags | FD_CLOEXEC : flags & ~FD_CLOEXEC) != 0) {
    die(EXIT_AUTHORITY, "cannot establish descriptor inheritance policy");
  }
}

/* This is deliberately argv data compiled into the immutable dropper, not a
 * caller-controlled --eval string.  It proves that the first unprivileged
 * Node realm checks the credentials, groups, capability vectors,
 * no_new_privs, namespace, and closed environment again before importing the
 * exact runner descriptor. */
static const char child_verifier_common[] =
  "const f=require('node:fs'),s=f.readFileSync('/proc/self/status','utf8'),"
  "l=n=>{const m=s.match(new RegExp('^'+n+':\\\\s*(.*)$','m'));return m&&m[1].trim()},"
  "z=n=>/^[0]+$/.test(l(n)||''),q=n=>{const v=l(n)||'';return /^([0-9]+) \\1 \\1 \\1$/.test(v)},"
  "e=Object.keys(process.env).sort().join('\\n');"
  "if(!q('Uid')||!q('Gid')||l('Groups')!==''||!z('CapInh')||!z('CapPrm')||"
  "!z('CapEff')||!z('CapBnd')||!z('CapAmb')||l('NoNewPrivs')!=='1'||"
  "e!=='HOME\\nLANG\\nLC_ALL\\nPATH\\nTZ')process.exit(125);";
static const char child_verifier_initial[] =
  "if(l('Uid').startsWith('0 ')||l('Gid').startsWith('0 '))process.exit(125);"
  "if(f.statSync('/proc/self/ns/user').ino!==f.statSync('/proc/1/ns/user').ino)process.exit(125);"
  "import('file:///proc/self/fd/5').catch(()=>process.exit(126));";
static const char child_verifier_synthetic[] =
  "if(!f.statSync('/proc/self/ns/user').isFile())process.exit(125);"
  "import('file:///proc/self/fd/5').catch(()=>process.exit(126));";

int
main(int argc, char **argv)
{
  struct m7_host_dropper_config config;
  int synthetic;
  uid_t actual_uid, effective_uid, saved_uid;
  gid_t actual_gid, effective_gid, saved_gid;
  char child_program[sizeof(child_verifier_common) + sizeof(child_verifier_initial) + 1];
  char *node_argv[] = {
    (char *)"cadr-m7-p4-host-node", (char *)"--no-addons",
    (char *)"--disable-proto=throw", (char *)"--eval", child_program, NULL
  };
  char *closed_environment[] = {
    (char *)"HOME=/var/empty", (char *)"LANG=C", (char *)"LC_ALL=C",
    (char *)"TZ=UTC", (char *)"PATH=/var/empty", NULL
  };

  if (argc != 2 || (strcmp(argv[1], "--inherited-v1") != 0 &&
                    strcmp(argv[1], "--synthetic-test-v1") != 0)) {
    die(EXIT_USAGE, "usage is exactly --inherited-v1 or --synthetic-test-v1");
  }
  synthetic = strcmp(argv[1], "--synthetic-test-v1") == 0;
  (void)snprintf(child_program, sizeof(child_program), "%s%s", child_verifier_common,
                 synthetic ? child_verifier_synthetic : child_verifier_initial);
  read_configuration(&config, synthetic);
  verify_hashed_regular_fd(NODE_FD, config.node_dev, config.node_ino,
                           config.node_sha256, "inherited Node descriptor differs from capture");
  verify_hashed_regular_fd(RUNNER_FD, config.runner_dev, config.runner_ino,
                           config.runner_sha256, "inherited runner descriptor differs from capture");
  verify_standard_descriptors(synthetic);

  if (setgroups(0, NULL) != 0) die(EXIT_AUTHORITY, "cannot clear supplementary groups");
  /* Bounding capabilities must be removed while CAP_SETPCAP is still
   * effective.  A bounding-set drop does not remove the current permitted
   * capability, so setres* may still make its exact, non-root transition.
   * capset follows that transition. */
  drop_bounding_capabilities();
  if (setresgid((gid_t)config.target_gid, (gid_t)config.target_gid,
                (gid_t)config.target_gid) != 0 ||
      setresuid((uid_t)config.target_uid, (uid_t)config.target_uid,
                (uid_t)config.target_uid) != 0) {
    die(EXIT_AUTHORITY, "cannot set exact real effective and saved uid gid");
  }
  if (getresuid(&actual_uid, &effective_uid, &saved_uid) != 0 ||
      getresgid(&actual_gid, &effective_gid, &saved_gid) != 0 ||
      actual_uid != (uid_t)config.target_uid || effective_uid != (uid_t)config.target_uid ||
      saved_uid != (uid_t)config.target_uid || actual_gid != (gid_t)config.target_gid ||
      effective_gid != (gid_t)config.target_gid || saved_gid != (gid_t)config.target_gid) {
    die(EXIT_AUTHORITY, "exact real effective and saved uid gid verification failed");
  }
  clear_current_capabilities();
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 || prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0) != 1) {
    die(EXIT_AUTHORITY, "cannot set no_new_privs");
  }
  verify_proc_state(&config);
  close_non_allowlisted_fds();
  set_close_on_exec(NODE_FD, 1);
  set_close_on_exec(RUNNER_FD, 0);
  (void)syscall(SYS_execveat, NODE_FD, "", node_argv, closed_environment, AT_EMPTY_PATH);
  die(EXIT_EXEC, "cannot execute exact inherited Guix Node descriptor");
}

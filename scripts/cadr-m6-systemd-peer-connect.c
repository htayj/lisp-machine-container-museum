/*
 * One-shot descriptor-bound D-Bus launcher for the selected-image M6 gate.
 * The caller first selects the user manager through the root system bus.  This
 * helper connects one user-bus AF_UNIX pathname, verifies that the connected
 * peer is that exact process, retains a live SO_PEERPIDFD, installs the stream
 * at fd 3, and execs one already-retained systemd client.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/un.h>
#include <unistd.h>

#ifndef SO_PEERPIDFD
#define SO_PEERPIDFD 77
#endif

static int owned_socket = -1;
static int owned_pidfd = -1;
static void die(void);

#ifdef M6_PEER_CONNECT_TEST_HOOKS
static const char *test_mode = NULL;

static int test_mode_is(const char *expected) {
  return test_mode != NULL && strcmp(test_mode, expected) == 0;
}

static void configure_test_mode(void) {
  test_mode = getenv("M6_PEER_CONNECT_TEST_MODE");
  if (test_mode == NULL || test_mode[0] == '\0') return;
  if (!test_mode_is("pidfd-unavailable") && !test_mode_is("pidfd-dead") &&
      !test_mode_is("fdinfo-mismatch")) die();
}
#else
static int test_mode_is(const char *expected) {
  (void)expected;
  return 0;
}

static void configure_test_mode(void) { }
#endif

static void close_owned(void) {
  if (owned_pidfd >= 0) { close(owned_pidfd); owned_pidfd = -1; }
  if (owned_socket >= 0) { close(owned_socket); owned_socket = -1; }
}

static void die(void) { close_owned(); _exit(125); }
static void die_pidfd_unavailable(void) { close_owned(); _exit(124); }

static unsigned long long number(const char *text) {
  char *end = NULL;
  errno = 0;
  unsigned long long value = strtoull(text, &end, 10);
  if (errno || text[0] == '\0' || end == NULL || *end != '\0') die();
  return value;
}

static size_t path_for(char *output, size_t size, pid_t pid,
                       const char *leaf) {
  int count = snprintf(output, size, "/proc/%ld/%s", (long)pid, leaf);
  if (count <= 0 || (size_t)count >= size) die();
  return (size_t)count;
}

static size_t read_exact_file(pid_t pid, const char *leaf,
                              unsigned char *buffer, size_t capacity) {
  char path[96];
  if (pid == 0) {
    int count = snprintf(path, sizeof(path), "%s", leaf);
    if (count <= 0 || (size_t)count >= sizeof(path)) die();
  } else path_for(path, sizeof(path), pid, leaf);
  int descriptor = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) die();
  size_t used = 0;
  for (;;) {
    if (used == capacity) { close(descriptor); die(); }
    ssize_t count = read(descriptor, buffer + used, capacity - used);
    if (count < 0) {
      if (errno == EINTR) continue;
      close(descriptor); die();
    }
    if (count == 0) break;
    used += (size_t)count;
  }
  if (close(descriptor) != 0 || used == 0) die();
  return used;
}

static void process_stat(pid_t pid, unsigned long long *ppid,
                         unsigned long long *began) {
  unsigned char raw[4096];
  size_t count = read_exact_file(pid, "stat", raw, sizeof(raw) - 1);
  raw[count] = '\0';
  char *cursor = strrchr((char *)raw, ')');
  if (cursor == NULL || cursor[1] != ' ') die();
  cursor += 2; /* field 3 (state). */
  for (unsigned int field = 3; field <= 22; ++field) {
    char *end = strchr(cursor, ' ');
    if (end == NULL) die();
    if (field == 4 || field == 22) {
      char saved = *end; *end = '\0';
      unsigned long long value = number(cursor);
      *end = saved;
      if (field == 4) *ppid = value; else *began = value;
    }
    cursor = end + 1;
  }
}

struct sha256_state {
  uint32_t h[8];
  uint64_t total;
  unsigned char block[64];
  size_t used;
};

static uint32_t rotate(uint32_t value, unsigned int count) {
  return (value >> count) | (value << (32U - count));
}

static void sha256_block(struct sha256_state *state,
                         const unsigned char input[64]) {
  static const uint32_t constants[64] = {
    0x428a2f98U,0x71374491U,0xb5c0fbcfU,0xe9b5dba5U,0x3956c25bU,0x59f111f1U,0x923f82a4U,0xab1c5ed5U,
    0xd807aa98U,0x12835b01U,0x243185beU,0x550c7dc3U,0x72be5d74U,0x80deb1feU,0x9bdc06a7U,0xc19bf174U,
    0xe49b69c1U,0xefbe4786U,0x0fc19dc6U,0x240ca1ccU,0x2de92c6fU,0x4a7484aaU,0x5cb0a9dcU,0x76f988daU,
    0x983e5152U,0xa831c66dU,0xb00327c8U,0xbf597fc7U,0xc6e00bf3U,0xd5a79147U,0x06ca6351U,0x14292967U,
    0x27b70a85U,0x2e1b2138U,0x4d2c6dfcU,0x53380d13U,0x650a7354U,0x766a0abbU,0x81c2c92eU,0x92722c85U,
    0xa2bfe8a1U,0xa81a664bU,0xc24b8b70U,0xc76c51a3U,0xd192e819U,0xd6990624U,0xf40e3585U,0x106aa070U,
    0x19a4c116U,0x1e376c08U,0x2748774cU,0x34b0bcb5U,0x391c0cb3U,0x4ed8aa4aU,0x5b9cca4fU,0x682e6ff3U,
    0x748f82eeU,0x78a5636fU,0x84c87814U,0x8cc70208U,0x90befffaU,0xa4506cebU,0xbef9a3f7U,0xc67178f2U
  };
  uint32_t words[64];
  for (unsigned int i = 0; i < 16; ++i) {
    words[i] = ((uint32_t)input[i*4] << 24) |
      ((uint32_t)input[i*4+1] << 16) |
      ((uint32_t)input[i*4+2] << 8) | input[i*4+3];
  }
  for (unsigned int i = 16; i < 64; ++i) {
    uint32_t s0 = rotate(words[i-15],7) ^ rotate(words[i-15],18) ^ (words[i-15] >> 3);
    uint32_t s1 = rotate(words[i-2],17) ^ rotate(words[i-2],19) ^ (words[i-2] >> 10);
    words[i] = words[i-16] + s0 + words[i-7] + s1;
  }
  uint32_t a=state->h[0],b=state->h[1],c=state->h[2],d=state->h[3];
  uint32_t e=state->h[4],f=state->h[5],g=state->h[6],h=state->h[7];
  for (unsigned int i = 0; i < 64; ++i) {
    uint32_t s1=rotate(e,6)^rotate(e,11)^rotate(e,25);
    uint32_t choice=(e&f)^((~e)&g);
    uint32_t t1=h+s1+choice+constants[i]+words[i];
    uint32_t s0=rotate(a,2)^rotate(a,13)^rotate(a,22);
    uint32_t majority=(a&b)^(a&c)^(b&c);
    uint32_t t2=s0+majority;
    h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
  }
  state->h[0]+=a; state->h[1]+=b; state->h[2]+=c; state->h[3]+=d;
  state->h[4]+=e; state->h[5]+=f; state->h[6]+=g; state->h[7]+=h;
}

static void sha256_init(struct sha256_state *state) {
  static const uint32_t initial[8] = {0x6a09e667U,0xbb67ae85U,0x3c6ef372U,0xa54ff53aU,
    0x510e527fU,0x9b05688cU,0x1f83d9abU,0x5be0cd19U};
  memcpy(state->h, initial, sizeof(initial)); state->total=0; state->used=0;
}

static void sha256_update(struct sha256_state *state,
                          const unsigned char *data, size_t count) {
  state->total += count;
  while (count > 0) {
    size_t room=64-state->used, take=count<room?count:room;
    memcpy(state->block+state->used,data,take);
    state->used+=take; data+=take; count-=take;
    if (state->used==64) { sha256_block(state,state->block); state->used=0; }
  }
}

static void sha256_final(struct sha256_state *state, unsigned char output[32]) {
  uint64_t bits=state->total*8U;
  state->block[state->used++]=0x80;
  if (state->used>56) { memset(state->block+state->used,0,64-state->used); sha256_block(state,state->block); state->used=0; }
  memset(state->block+state->used,0,56-state->used);
  for (unsigned int i=0;i<8;++i) state->block[63-i]=(unsigned char)(bits>>(i*8));
  sha256_block(state,state->block);
  for (unsigned int i=0;i<8;++i) { output[i*4]=(unsigned char)(state->h[i]>>24); output[i*4+1]=(unsigned char)(state->h[i]>>16); output[i*4+2]=(unsigned char)(state->h[i]>>8); output[i*4+3]=(unsigned char)state->h[i]; }
}

static int hash_matches(const unsigned char *bytes, size_t count,
                        const char *expected) {
  static const char digits[]="0123456789abcdef";
  unsigned char digest[32]; char hex[65]; struct sha256_state state;
  sha256_init(&state); sha256_update(&state,bytes,count); sha256_final(&state,digest);
  for (unsigned int i=0;i<32;++i) { hex[i*2]=digits[digest[i]>>4]; hex[i*2+1]=digits[digest[i]&15]; }
  hex[64]='\0'; return strcmp(hex,expected)==0;
}

static void verify_boot_id(const char *expected) {
  unsigned char bytes[64];
  size_t count=read_exact_file(0,"/proc/sys/kernel/random/boot_id",bytes,sizeof(bytes));
  if (count!=37 || bytes[36]!='\n' || strlen(expected)!=36 ||
      memcmp(bytes,expected,36)!=0) die();
}

static void verify_process(pid_t pid, unsigned long long expected_ppid,
                           unsigned long long expected_start,
                           const char *boot_id, const char *comm,
                           unsigned long long argv_bytes,
                           unsigned long long argv_count, const char *argv_sha,
                           unsigned long long cgroup_bytes,
                           const char *cgroup_sha) {
  unsigned long long ppid=0,began=0; unsigned char bytes[8192];
  process_stat(pid,&ppid,&began);
  if (ppid!=expected_ppid || began!=expected_start) die();
  verify_boot_id(boot_id);
  size_t count=read_exact_file(pid,"comm",bytes,sizeof(bytes));
  if (count!=strlen(comm)+1 || bytes[count-1]!='\n' || memcmp(bytes,comm,count-1)!=0) die();
  count=read_exact_file(pid,"cmdline",bytes,sizeof(bytes));
  unsigned long long arguments=0;
  for (size_t i=0;i<count;++i) if (bytes[i]=='\0') ++arguments;
  if (bytes[count-1]!='\0' || count!=argv_bytes || arguments!=argv_count ||
      !hash_matches(bytes,count,argv_sha)) die();
  count=read_exact_file(pid,"cgroup",bytes,sizeof(bytes));
  if (count!=cgroup_bytes || !hash_matches(bytes,count,cgroup_sha)) die();
}

static int connect_checked(const char *socket_path, struct ucred *peer) {
  if (socket_path[0]!='/' || strlen(socket_path)>=sizeof(((struct sockaddr_un *)0)->sun_path)) die();
  owned_socket=socket(AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0);
  if (owned_socket<0) die();
  struct sockaddr_un address; memset(&address,0,sizeof(address));
  address.sun_family=AF_UNIX; memcpy(address.sun_path,socket_path,strlen(socket_path)+1);
  if (connect(owned_socket,(struct sockaddr *)&address,sizeof(address))!=0) die();
  socklen_t size=sizeof(*peer);
  if (getsockopt(owned_socket,SOL_SOCKET,SO_PEERCRED,peer,&size)!=0 || size!=sizeof(*peer)) die();
  return owned_socket;
}

static void verify_pidfd(pid_t expected_pid) {
  if (test_mode_is("pidfd-unavailable")) die_pidfd_unavailable();
  socklen_t size=sizeof(owned_pidfd);
  if (getsockopt(owned_socket,SOL_SOCKET,SO_PEERPIDFD,&owned_pidfd,&size)!=0) {
    if (errno==ENOPROTOOPT || errno==EINVAL) die_pidfd_unavailable();
    die();
  }
  if (size!=sizeof(owned_pidfd) || owned_pidfd<0) die();
  char path[64]; int count=snprintf(path,sizeof(path),"/proc/self/fdinfo/%d",owned_pidfd);
  if (count<=0 || (size_t)count>=sizeof(path)) die();
  int descriptor=open(path,O_RDONLY|O_CLOEXEC); if (descriptor<0) die();
  char bytes[2048]; ssize_t got=read(descriptor,bytes,sizeof(bytes)-1); close(descriptor);
  if (got<=0 || (size_t)got>=sizeof(bytes)) die();
  bytes[got]='\0';
  pid_t fdinfo_pid = test_mode_is("fdinfo-mismatch") ?
    expected_pid == INT32_MAX ? expected_pid - 1 : expected_pid + 1 :
    expected_pid;
  char expected[64]; count=snprintf(expected,sizeof(expected),"Pid:\t%ld\n",(long)fdinfo_pid);
  if (count<=0 || strstr(bytes,expected)==NULL) die();
  struct pollfd pollfd={.fd=owned_pidfd,.events=POLLIN};
  if (test_mode_is("pidfd-dead")) pollfd.revents=POLLIN;
  else if (poll(&pollfd,1,0)!=0) die();
  if (pollfd.revents!=0) die();
}

int main(int argc, char **argv) {
  configure_test_mode();
  if (argc<28 || strcmp(argv[1],"--socket")!=0 || strcmp(argv[3],"--peer-uid")!=0 ||
      strcmp(argv[5],"--peer-gid")!=0 || strcmp(argv[7],"--peer-pid")!=0 ||
      strcmp(argv[9],"--peer-ppid")!=0 || strcmp(argv[11],"--peer-start-time")!=0 ||
      strcmp(argv[13],"--boot-id")!=0 || strcmp(argv[15],"--peer-comm")!=0 ||
      strcmp(argv[17],"--peer-argv-byte-count")!=0 || strcmp(argv[19],"--peer-argv-count")!=0 ||
      strcmp(argv[21],"--peer-argv-sha256")!=0 || strcmp(argv[23],"--peer-cgroup-byte-count")!=0 ||
      strcmp(argv[25],"--peer-cgroup-sha256")!=0) die();
  unsigned long long uid=number(argv[4]),gid=number(argv[6]),pid=number(argv[8]);
  unsigned long long ppid=number(argv[10]),began=number(argv[12]);
  unsigned long long argv_bytes=number(argv[18]),argv_count=number(argv[20]);
  unsigned long long cgroup_bytes=number(argv[24]);
  if (uid==0 || pid==0 || began==0 || argv_bytes==0 || argv_count==0 || cgroup_bytes==0 ||
      strlen(argv[14])!=36 || strlen(argv[16])==0 || strlen(argv[22])!=64 || strlen(argv[26])!=64) die();
  struct ucred peer; int descriptor=connect_checked(argv[2],&peer);
  if ((unsigned long long)peer.uid!=uid || (unsigned long long)peer.gid!=gid ||
      (unsigned long long)peer.pid!=pid) die();
  verify_process(peer.pid,ppid,began,argv[14],argv[16],argv_bytes,argv_count,argv[22],cgroup_bytes,argv[26]);
  verify_pidfd(peer.pid);
  if (strcmp(argv[27],"--probe")==0) {
    if (argc!=28 || dprintf(STDOUT_FILENO,"pidfd_profile=so-peerpidfd-v1\n")<0) die();
    close_owned(); return 0;
  }
  if (strcmp(argv[27],"--")!=0 || argc<29) die();
  if (descriptor!=3) { if (dup2(descriptor,3)!=3) die(); close(descriptor); }
  owned_socket=-1;
  if (close(owned_pidfd)!=0) die();
  owned_pidfd=-1;
  if (fcntl(3,F_SETFD,0)!=0) die();
  execv(argv[28],&argv[28]); die();
}

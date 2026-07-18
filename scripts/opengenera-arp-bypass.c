#define _GNU_SOURCE

#include <arpa/inet.h>
#include <dlfcn.h>
#include <errno.h>
#include <linux/if_tun.h>
#include <net/if_arp.h>
#include <stdint.h>
#include <stddef.h>
#include <stdarg.h>
#include <string.h>
#include <stdio.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <sys/uio.h>
#include <time.h>
#include <unistd.h>

#define ETH_HEADER_LEN 14
#define ETHERTYPE_IPV4 0x0800
#define IP_PROTO_UDP 17
#define UDP_TIME_PORT 37
#define RFC868_UNIX_EPOCH_OFFSET 2208988800UL
#define MAX_TIME_REPLY_FRAME 128

#define X_SET_MODIFIER_MAPPING 118
#define X_REPLY 1
#define X_MAPPING_SUCCESS 0
#define X_PACKET_LEN 32

static int tap_fd = -1;
static unsigned char queued_time_reply[MAX_TIME_REPLY_FRAME];
static size_t queued_time_reply_len = 0;

static int (*real_ioctl_fn)(int, unsigned long, void *) = NULL;
static ssize_t (*real_read_fn)(int, void *, size_t) = NULL;
static ssize_t (*real_write_fn)(int, const void *, size_t) = NULL;
static ssize_t (*real_recv_fn)(int, void *, size_t, int) = NULL;
static ssize_t (*real_readv_fn)(int, const struct iovec *, int) = NULL;

static void resolve_symbols(void) {
  if (real_ioctl_fn == NULL) {
    real_ioctl_fn = (int (*)(int, unsigned long, void *))dlsym(RTLD_NEXT, "ioctl");
  }
  if (real_read_fn == NULL) {
    real_read_fn = (ssize_t (*)(int, void *, size_t))dlsym(RTLD_NEXT, "read");
  }
  if (real_write_fn == NULL) {
    real_write_fn = (ssize_t (*)(int, const void *, size_t))dlsym(RTLD_NEXT, "write");
  }
  if (real_recv_fn == NULL) {
    real_recv_fn = (ssize_t (*)(int, void *, size_t, int))dlsym(RTLD_NEXT, "recv");
  }
  if (real_readv_fn == NULL) {
    real_readv_fn = (ssize_t (*)(int, const struct iovec *, int))dlsym(RTLD_NEXT, "readv");
  }
}

static uint16_t read_be16(const unsigned char *p) {
  return (uint16_t)(((uint16_t)p[0] << 8) | p[1]);
}

static void write_be16(unsigned char *p, uint16_t value) {
  p[0] = (unsigned char)(value >> 8);
  p[1] = (unsigned char)value;
}

static void write_be32(unsigned char *p, uint32_t value) {
  p[0] = (unsigned char)(value >> 24);
  p[1] = (unsigned char)(value >> 16);
  p[2] = (unsigned char)(value >> 8);
  p[3] = (unsigned char)value;
}

static uint16_t ipv4_header_checksum(const unsigned char *header, size_t len) {
  uint32_t sum = 0;

  for (size_t i = 0; i + 1 < len; i += 2) {
    sum += read_be16(header + i);
  }
  if (len & 1) {
    sum += (uint16_t)(header[len - 1] << 8);
  }
  while (sum >> 16) {
    sum = (sum & 0xffffU) + (sum >> 16);
  }
  return (uint16_t)~sum;
}

static int is_broadcast_mac(const unsigned char *mac) {
  for (size_t i = 0; i < 6; ++i) {
    if (mac[i] != 0xff) {
      return 0;
    }
  }
  return 1;
}

static int is_ipv4_broadcast(const unsigned char *ip) {
  return ip[0] == 255 && ip[1] == 255 && ip[2] == 255 && ip[3] == 255;
}

static void log_tap_packet(const char *direction, const void *buf, size_t count) {
  const unsigned char *frame = (const unsigned char *)buf;
  const unsigned char *ip;
  const unsigned char *l4;
  size_t ip_header_len;
  uint16_t src_port;
  uint16_t dst_port;

  if (count < ETH_HEADER_LEN + 20 || read_be16(frame + 12) != ETHERTYPE_IPV4) {
    return;
  }

  ip = frame + ETH_HEADER_LEN;
  ip_header_len = (size_t)(ip[0] & 0x0fU) * 4;
  if ((ip[0] >> 4) != 4 || ip_header_len < 20 || count < ETH_HEADER_LEN + ip_header_len) {
    return;
  }

  if (ip[9] != IP_PROTO_UDP && ip[9] != 6) {
    return;
  }

  if (count < ETH_HEADER_LEN + ip_header_len + 4) {
    return;
  }

  l4 = ip + ip_header_len;
  src_port = read_be16(l4);
  dst_port = read_be16(l4 + 2);
  if (src_port != 21 && src_port != 37 && src_port != 111 && src_port != 2049 &&
      dst_port != 21 && dst_port != 37 && dst_port != 111 && dst_port != 2049) {
    return;
  }

  fprintf(stderr,
          "tap %s ip %u.%u.%u.%u -> %u.%u.%u.%u proto %s %u -> %u len=%zu\n",
          direction,
          ip[12], ip[13], ip[14], ip[15],
          ip[16], ip[17], ip[18], ip[19],
          ip[9] == IP_PROTO_UDP ? "udp" : "tcp",
          src_port, dst_port, count);
  fflush(stderr);
}

static void maybe_queue_time_reply(const void *buf, size_t count) {
  const unsigned char *frame = (const unsigned char *)buf;
  const unsigned char fallback_host_mac[6] = {0x02, 0x00, 0x00, 0x00, 0x00, 0x25};
  const unsigned char fallback_host_ip[4] = {10, 0, 0, 1};
  const unsigned char *ip;
  const unsigned char *udp;
  unsigned char *reply = queued_time_reply;
  unsigned char *reply_ip;
  unsigned char *reply_udp;
  size_t ip_header_len;
  size_t total_len;
  size_t udp_len;
  uint32_t rfc868_time;

  if (count < ETH_HEADER_LEN + 20 || read_be16(frame + 12) != ETHERTYPE_IPV4) {
    return;
  }

  ip = frame + ETH_HEADER_LEN;
  ip_header_len = (size_t)(ip[0] & 0x0fU) * 4;
  if ((ip[0] >> 4) != 4 || ip_header_len < 20 ||
      count < ETH_HEADER_LEN + ip_header_len + 8 || ip[9] != IP_PROTO_UDP) {
    return;
  }

  total_len = read_be16(ip + 2);
  if (total_len < ip_header_len + 8 || count < ETH_HEADER_LEN + total_len) {
    return;
  }

  udp = ip + ip_header_len;
  udp_len = read_be16(udp + 4);
  if (udp_len < 8 || ip_header_len + udp_len > total_len ||
      read_be16(udp + 2) != UDP_TIME_PORT) {
    return;
  }

  memset(reply, 0, MAX_TIME_REPLY_FRAME);

  memcpy(reply, frame + 6, 6);
  if (is_broadcast_mac(frame)) {
    memcpy(reply + 6, fallback_host_mac, 6);
  } else {
    memcpy(reply + 6, frame, 6);
  }
  write_be16(reply + 12, ETHERTYPE_IPV4);

  reply_ip = reply + ETH_HEADER_LEN;
  reply_ip[0] = 0x45;
  reply_ip[1] = 0;
  write_be16(reply_ip + 2, 20 + 8 + 4);
  write_be16(reply_ip + 4, 0);
  write_be16(reply_ip + 6, 0);
  reply_ip[8] = 64;
  reply_ip[9] = IP_PROTO_UDP;
  if (is_ipv4_broadcast(ip + 16)) {
    memcpy(reply_ip + 12, fallback_host_ip, 4);
  } else {
    memcpy(reply_ip + 12, ip + 16, 4);
  }
  memcpy(reply_ip + 16, ip + 12, 4);
  write_be16(reply_ip + 10, ipv4_header_checksum(reply_ip, 20));

  reply_udp = reply_ip + 20;
  write_be16(reply_udp, UDP_TIME_PORT);
  write_be16(reply_udp + 2, read_be16(udp));
  write_be16(reply_udp + 4, 8 + 4);
  write_be16(reply_udp + 6, 0);

  rfc868_time = (uint32_t)((uint64_t)time(NULL) + RFC868_UNIX_EPOCH_OFFSET);
  write_be32(reply_udp + 8, rfc868_time);

  queued_time_reply_len = ETH_HEADER_LEN + 20 + 8 + 4;
}

static void write_x_timestamp(unsigned char *p, uint32_t value) {
  p[0] = (unsigned char)value;
  p[1] = (unsigned char)(value >> 8);
  p[2] = (unsigned char)(value >> 16);
  p[3] = (unsigned char)(value >> 24);
}

static void normalize_x_event_timestamps(void *buf, ssize_t count) {
  unsigned char *packet = (unsigned char *)buf;
  uint32_t now = (uint32_t)(time(NULL) * 1000U);

  for (ssize_t offset = 0; offset + X_PACKET_LEN <= count; offset += X_PACKET_LEN) {
    unsigned char *event = packet + offset;
    unsigned char event_type = event[0] & 0x7fU;

    if (event_type >= 2 && event_type <= 8 &&
        event[4] == 0 && event[5] == 0 && event[6] == 0 && event[7] == 0) {
      write_x_timestamp(event + 4, now++);
    }
  }
}

static void suppress_x_set_modifier_mapping_error(void *buf, ssize_t count) {
  unsigned char *packet = (unsigned char *)buf;

  normalize_x_event_timestamps(buf, count);

  for (ssize_t offset = 0; offset + X_PACKET_LEN <= count; offset += X_PACKET_LEN) {
    unsigned char *reply = packet + offset;

    if (reply[0] == 0 && reply[10] == X_SET_MODIFIER_MAPPING) {
      unsigned char sequence0 = reply[2];
      unsigned char sequence1 = reply[3];

      memset(reply, 0, X_PACKET_LEN);
      reply[0] = X_REPLY;
      reply[1] = X_MAPPING_SUCCESS;
      reply[2] = sequence0;
      reply[3] = sequence1;
    }
  }
}

int ioctl(int fd, unsigned long request, ...) {
  va_list ap;
  void *argp;
  int result;

  resolve_symbols();

  va_start(ap, request);
  argp = va_arg(ap, void *);
  va_end(ap);

  if (request == SIOCSARP) {
    return 0;
  }

  result = real_ioctl_fn(fd, request, argp);
#ifdef TUNSETIFF
  if (request == TUNSETIFF && result == 0) {
    tap_fd = fd;
  }
#endif
  return result;
}

ssize_t read(int fd, void *buf, size_t count) {
  ssize_t result;

  resolve_symbols();

  if (fd == tap_fd && queued_time_reply_len > 0) {
    if (count < queued_time_reply_len) {
      errno = EMSGSIZE;
      return -1;
    }
    memcpy(buf, queued_time_reply, queued_time_reply_len);
    result = (ssize_t)queued_time_reply_len;
    log_tap_packet("rx", queued_time_reply, queued_time_reply_len);
    queued_time_reply_len = 0;
    return result;
  }

  result = real_read_fn(fd, buf, count);
  if (result > 0) {
    suppress_x_set_modifier_mapping_error(buf, result);
    log_tap_packet("rx", buf, (size_t)result);
  }
  return result;
}

ssize_t recv(int fd, void *buf, size_t count, int flags) {
  ssize_t result;

  resolve_symbols();

  result = real_recv_fn(fd, buf, count, flags);
  if (result > 0) {
    suppress_x_set_modifier_mapping_error(buf, result);
    log_tap_packet("rx", buf, (size_t)result);
  }
  return result;
}

ssize_t readv(int fd, const struct iovec *iov, int iovcnt) {
  ssize_t result;

  resolve_symbols();

  result = real_readv_fn(fd, iov, iovcnt);
  if (result > 0 && iovcnt > 0) {
    suppress_x_set_modifier_mapping_error(iov[0].iov_base, (ssize_t)iov[0].iov_len < result ? (ssize_t)iov[0].iov_len : result);
    log_tap_packet("rx", iov[0].iov_base, (size_t)(((ssize_t)iov[0].iov_len < result) ? (ssize_t)iov[0].iov_len : result));
  }
  return result;
}

ssize_t write(int fd, const void *buf, size_t count) {
  resolve_symbols();

  if (fd == tap_fd) {
    maybe_queue_time_reply(buf, count);
    log_tap_packet("tx", buf, count);
  }

  return real_write_fn(fd, buf, count);
}

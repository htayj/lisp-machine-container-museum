#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  printf 'Usage: inside-genera-computer-use-netns.sh COMMAND [ARG ...]\n' >&2
  exit 2
fi

if [[ $(id -u) -ne 0 ]]; then
  printf 'This helper must run as uid 0 inside the unprivileged Bubblewrap sandbox.\n' >&2
  exit 1
fi

# The historical VLM insists on a TAP device named tun0.  This interface lives
# only in Bubblewrap's throwaway network namespace.  No default route or
# physical interface is added.  A supervised, one-shot responder on 10.0.0.1
# supplies the early RFC 868 reply.  Narrow compatibility hooks bypass the
# obsolete ifconfig subprocess and adapt three identified Xlib operations;
# neither rewrites network packets, X protocol reads, nor arbitrary I/O.  Xvfb's
# compatible core modifier map is prepared before this helper launches the VLM.
ip link set lo up
ip link add eth0 type dummy
ip link set eth0 address 02:00:00:00:00:01
ip addr add 192.0.2.1/24 dev eth0
ip link set eth0 up
ip tuntap add dev tun0 mode tap user 0
ip addr add 10.0.0.1/24 dev tun0
ip link set tun0 up

exec "$@"

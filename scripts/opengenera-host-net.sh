#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: opengenera-host-net.sh COMMAND [--user USER]

Commands:
  print
      Show the host networking commands Open Genera typically needs.

  up
      Create and configure a persistent tun0 device owned by USER.
      This command must run as root.

  down
      Delete the persistent tun0 device.
      This command must run as root.

  status
      Show the current state of tun0, if present.

Examples:
  ./scripts/opengenera-host-net.sh print
  sudo ./scripts/opengenera-host-net.sh up --user "$USER"
  ./scripts/opengenera-host-net.sh status
EOF
}

COMMAND=${1:-print}
shift || true

TARGET_USER=${SUDO_USER:-${USER:-$(id -un)}}
TUN_DEVICE=${OPENGENERA_TUN_DEVICE:-tun0}
HOST_IP=${OPENGENERA_HOST_IP:-10.0.0.1}
GUEST_IP=${OPENGENERA_GUEST_IP:-10.0.0.2}
LINK_MODE=${OPENGENERA_LINK_MODE:-tap}
PREFIX_LEN=${OPENGENERA_PREFIX_LEN:-24}

while (($#)); do
  case "$1" in
    --user)
      TARGET_USER=${2:?missing user value}
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unexpected argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    printf 'This command must be run as root.\n' >&2
    exit 1
  fi
}

current_link_mode() {
  if ! ip tuntap show dev "$TUN_DEVICE" >/dev/null 2>&1; then
    return 1
  fi

  ip tuntap show dev "$TUN_DEVICE" | awk '{print $2}'
}

print_commands() {
  cat <<EOF
sudo ip tuntap add dev $TUN_DEVICE mode $LINK_MODE user $TARGET_USER
sudo ip addr replace $HOST_IP/$PREFIX_LEN dev $TUN_DEVICE
sudo ip link set dev $TUN_DEVICE up
EOF
}

case "$COMMAND" in
  print)
    print_commands
    ;;
  up)
    require_root
    if ip link show "$TUN_DEVICE" >/dev/null 2>&1; then
      existing_mode=$(current_link_mode || true)
      if [[ "$existing_mode" != "$LINK_MODE" ]]; then
        ip link delete dev "$TUN_DEVICE"
      fi
    fi
    if ! ip link show "$TUN_DEVICE" >/dev/null 2>&1; then
      ip tuntap add dev "$TUN_DEVICE" mode "$LINK_MODE" user "$TARGET_USER"
    fi
    ip addr replace "$HOST_IP/$PREFIX_LEN" dev "$TUN_DEVICE"
    ip link set dev "$TUN_DEVICE" up
    ip addr show dev "$TUN_DEVICE"
    ;;
  down)
    require_root
    if ip link show "$TUN_DEVICE" >/dev/null 2>&1; then
      ip link delete dev "$TUN_DEVICE"
    fi
    ;;
  status)
    if ip link show "$TUN_DEVICE" >/dev/null 2>&1; then
      ip addr show dev "$TUN_DEVICE"
    else
      printf '%s is not present.\n' "$TUN_DEVICE" >&2
      exit 1
    fi
    ;;
  *)
    printf 'Unknown command: %s\n' "$COMMAND" >&2
    usage >&2
    exit 1
    ;;
esac

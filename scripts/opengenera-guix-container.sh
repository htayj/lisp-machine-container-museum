#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: opengenera-guix-container.sh --mode MODE [--archive PATH] [--verify] [--prepare-only] [-- ARGS...]

Examples:
  ./scripts/opengenera-guix-container.sh --mode run --archive ~/opengenera2.tar.bz2
  ./scripts/opengenera-guix-container.sh --mode run --prepare-only --archive ~/opengenera2.tar.bz2
  ./scripts/opengenera-guix-container.sh --mode run --verify --archive ~/opengenera2.tar.bz2
  ./scripts/opengenera-guix-container.sh --mode shell --archive ~/opengenera2.tar.bz2
  ./scripts/opengenera-guix-container.sh --mode tool --archive ~/opengenera2.tar.bz2 -- pwd
EOF
}

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
CONTAINER_ROOT=/workspace
MANIFEST_FILE="$ROOT_DIR/manifest.scm"
LM_HOME_DIR="$ROOT_DIR/.lm-home"
DEFAULT_ARCHIVE_PATH="${OPENGENERA_ARCHIVE:-$HOME/opengenera2.tar.bz2}"
SBIN_OVERLAY_DIR="$LM_HOME_DIR/opengenera/container-sbin"

mode=
archive_path=$DEFAULT_ARCHIVE_PATH
extra_args=()

while (($#)); do
  case "$1" in
    --mode)
      mode=${2:?missing mode value}
      extra_args+=("$1" "$2")
      shift 2
      ;;
    --archive)
      archive_path=${2:?missing archive path}
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      extra_args+=("$1")
      shift
      ;;
  esac
done

if [[ -z "${mode:-}" ]]; then
  usage >&2
  exit 1
fi

mkdir -p "$LM_HOME_DIR"

has_arg() {
  local needle=$1
  local arg

  for arg in "${extra_args[@]}"; do
    if [[ "$arg" == "$needle" ]]; then
      return 0
    fi
  done

  return 1
}

prepare_sbin_overlay() {
  local container_bash

  container_bash=$(guix shell -m "$MANIFEST_FILE" -- bash -lc 'readlink -f "$(command -v bash)"')
  mkdir -p "$SBIN_OVERLAY_DIR"
  printf '#!%s\n' "$container_bash" >"$SBIN_OVERLAY_DIR/ifconfig"
  cat >>"$SBIN_OVERLAY_DIR/ifconfig" <<'EOF'
set -euo pipefail

netmask_to_prefix() {
  case "$1" in
    255.255.255.255) printf '32\n' ;;
    255.255.255.254) printf '31\n' ;;
    255.255.255.252) printf '30\n' ;;
    255.255.255.248) printf '29\n' ;;
    255.255.255.240) printf '28\n' ;;
    255.255.255.224) printf '27\n' ;;
    255.255.255.192) printf '26\n' ;;
    255.255.255.128) printf '25\n' ;;
    255.255.255.0) printf '24\n' ;;
    255.255.254.0) printf '23\n' ;;
    255.255.252.0) printf '22\n' ;;
    255.255.248.0) printf '21\n' ;;
    255.255.240.0) printf '20\n' ;;
    255.255.224.0) printf '19\n' ;;
    255.255.192.0) printf '18\n' ;;
    255.255.128.0) printf '17\n' ;;
    255.255.0.0) printf '16\n' ;;
    255.254.0.0) printf '15\n' ;;
    255.252.0.0) printf '14\n' ;;
    255.248.0.0) printf '13\n' ;;
    255.240.0.0) printf '12\n' ;;
    255.224.0.0) printf '11\n' ;;
    255.192.0.0) printf '10\n' ;;
    255.128.0.0) printf '9\n' ;;
    255.0.0.0) printf '8\n' ;;
    *)
      printf 'Unsupported netmask for compat ifconfig wrapper: %s\n' "$1" >&2
      exit 1
      ;;
  esac
}

if (($# == 0)); then
  exec ip addr show
fi

device=$1
shift

device_is_tap=0
if ip -details link show dev "$device" 2>/dev/null | grep -q 'tun type tap'; then
  device_is_tap=1
fi

if (($# == 0)); then
  exec ip addr show dev "$device"
fi

case "$1" in
  up)
    if ((device_is_tap)); then
      exit 0
    fi
    exec ip link set dev "$device" up
    ;;
  down)
    if ((device_is_tap)); then
      exit 0
    fi
    exec ip link set dev "$device" down
    ;;
esac

local_address=$1
shift
peer_address=
netmask=255.255.255.255

while (($#)); do
  case "$1" in
    dstaddr)
      peer_address=${2:?missing peer address}
      shift 2
      ;;
    netmask)
      netmask=${2:?missing netmask}
      shift 2
      ;;
    up)
      shift
      ;;
    *)
      shift
      ;;
  esac
done

prefix=$(netmask_to_prefix "$netmask")
if ((device_is_tap)); then
  if ip -o -4 addr show dev "$device" | grep -q " $local_address/$prefix "; then
    exit 0
  fi
  printf 'tap device %s must be preconfigured as %s/%s on the host\n' "$device" "$local_address" "$prefix" >&2
  exit 1
elif [[ -n "$peer_address" ]]; then
  ip addr replace "$local_address/$prefix" peer "$peer_address" dev "$device"
else
  ip addr replace "$local_address/$prefix" dev "$device"
fi
exec ip link set dev "$device" up
EOF
  chmod +x "$SBIN_OVERLAY_DIR/ifconfig"
}

need_archive() {
  if [[ "$mode" != "run" ]]; then
    return 1
  fi

  if has_arg --verify; then
    return 1
  fi

  return 0
}

if need_archive && [[ ! -f "$archive_path" ]]; then
  printf 'Open Genera archive not found: %s\n' "$archive_path" >&2
  exit 1
fi

prepare_sbin_overlay

container_args=(
  shell
  -C
  -N
  -m "$MANIFEST_FILE"
  --share="$ROOT_DIR=$CONTAINER_ROOT"
)

if [[ -d /tmp ]]; then
  container_args+=(--share=/tmp=/tmp)
fi

if [[ -d /tmp/.X11-unix ]]; then
  container_args+=(--share=/tmp/.X11-unix=/tmp/.X11-unix)
fi

xauth_path=${XAUTHORITY:-"$HOME/.Xauthority"}
if [[ -f "$xauth_path" ]]; then
  container_args+=(--expose="$xauth_path=$xauth_path")
fi

if [[ -f "$archive_path" ]]; then
  container_args+=(--expose="$archive_path=$archive_path")
fi

container_args+=(--share="$SBIN_OVERLAY_DIR=/sbin")

if [[ -e /dev/net/tun ]]; then
  container_args+=(--expose=/dev/net/tun=/dev/net/tun)
fi

display_value=${DISPLAY:-}
if [[ "$mode" == "run" ]] && ! has_arg --verify && ! has_arg --prepare-only && [[ -z "$display_value" ]]; then
  printf 'DISPLAY is not set; run mode needs an X11 display.\n' >&2
  exit 1
fi

exec guix "${container_args[@]}" -- env \
  HOME="$CONTAINER_ROOT/.lm-home" \
  TERM="${TERM:-xterm-256color}" \
  DISPLAY="$display_value" \
  XAUTHORITY="$xauth_path" \
  OPENGENERA_ARCHIVE="$archive_path" \
  bash -lc 'cd /workspace && exec bash ./scripts/inside-opengenera-guix-container.sh "$@"' bash \
  "${extra_args[@]}"

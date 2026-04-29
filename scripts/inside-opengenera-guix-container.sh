#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: inside-opengenera-guix-container.sh --mode MODE [--verify] [--prepare-only] [-- ARGS...]

Modes:
  run        Stage Open Genera and start the Linux VLM
  shell      Open an interactive shell in the prepared runtime
  tool       Run an arbitrary command in the shared workspace

Flags:
  --verify        Print runtime status and exit
  --prepare-only  With --mode run, stop after staging the runtime tree
EOF
}

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
WORK_DIR="$ROOT_DIR/.lm-home/opengenera"
DOWNLOAD_DIR="$WORK_DIR/downloads"
EXTRACT_DIR="$WORK_DIR/extracted"
OFFICIAL_DIR="$WORK_DIR/official"
OFFICIAL_PAYLOAD_DIR="$OFFICIAL_DIR/VLMBASE200"
REFERENCE_DIR="$WORK_DIR/reference"
RUNTIME_DIR="$WORK_DIR/runtime"
VLM_FILE="$RUNTIME_DIR/.VLM"
ARP_BYPASS_SOURCE="$ROOT_DIR/scripts/opengenera-arp-bypass.c"
ARP_BYPASS_SO="$WORK_DIR/arp-bypass.so"
SNAP4_URL=${OPENGENERA_SNAP4_URL:-http://www.unlambda.com/download/genera/snap4.tar.gz}
SNAP4_TARBALL="$DOWNLOAD_DIR/snap4.tar.gz"
SNAP4_DIR="$EXTRACT_DIR/snap4"
ARCHIVE_PATH=${OPENGENERA_ARCHIVE:-}
TUN_DEVICE=${OPENGENERA_TUN_DEVICE:-tun0}
NETWORK_SPEC=${OPENGENERA_NETWORK_SPEC:-10.0.0.2;mask=255.255.255.0;gateway=10.0.0.1}
VIRTUAL_MEMORY=${OPENGENERA_VIRTUAL_MEMORY:-2048}
ENABLE_IDS=${OPENGENERA_ENABLE_IDS:-yes}
COLDLOAD_GEOMETRY=${OPENGENERA_COLDLOAD_GEOMETRY:-1024x768}

mkdir -p "$DOWNLOAD_DIR" "$EXTRACT_DIR" "$REFERENCE_DIR"

mode=run
verify=0
prepare_only=0
pass_args=()

while (($#)); do
  case "$1" in
    --mode)
      mode=${2:?missing mode value}
      shift 2
      ;;
    --verify)
      verify=1
      shift
      ;;
    --prepare-only)
      prepare_only=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      pass_args+=("$@")
      break
      ;;
    *)
      pass_args+=("$1")
      shift
      ;;
  esac
done

archive_fingerprint() {
  stat -c '%n|%s|%Y' "$1"
}

stale_name() {
  local path=$1
  printf '%s.stale.%s\n' "$path" "$(date +%Y%m%d-%H%M%S)"
}

stash_stale_path() {
  local path=$1

  if [[ -e "$path" ]]; then
    mv "$path" "$(stale_name "$path")"
  fi
}

require_archive() {
  if [[ -z "$ARCHIVE_PATH" ]]; then
    printf 'OPENGENERA_ARCHIVE is not set.\n' >&2
    exit 1
  fi

  if [[ ! -f "$ARCHIVE_PATH" ]]; then
    printf 'Open Genera archive not found: %s\n' "$ARCHIVE_PATH" >&2
    exit 1
  fi
}

ensure_official_payload() {
  local expected_stamp
  local current_stamp=

  require_archive
  expected_stamp=$(archive_fingerprint "$ARCHIVE_PATH")
  if [[ -f "$OFFICIAL_DIR/.archive-stamp" ]]; then
    current_stamp=$(<"$OFFICIAL_DIR/.archive-stamp")
  fi

  if [[ "$current_stamp" == "$expected_stamp" ]] &&
     [[ -f "$OFFICIAL_PAYLOAD_DIR/usr/opt/VLM200/lib/symbolics/Genera-8-5.vlod" ]] &&
     [[ -f "$OFFICIAL_PAYLOAD_DIR/usr/opt/VLM200/lib/symbolics/VLM_debugger" ]] &&
     [[ -d "$OFFICIAL_DIR/og2/sys.sct" ]]; then
    return 0
  fi

  stash_stale_path "$OFFICIAL_DIR"
  mkdir -p "$OFFICIAL_DIR"
  tar -xjf "$ARCHIVE_PATH" -C "$OFFICIAL_DIR" \
    og2/AXP/OSF/VLMBASE200 \
    og2/sys.sct \
    og2/README \
    og2/quickstart.text
  mkdir -p "$OFFICIAL_PAYLOAD_DIR"
  gzip -dc "$OFFICIAL_DIR/og2/AXP/OSF/VLMBASE200" | tar -xf - -C "$OFFICIAL_PAYLOAD_DIR"
  printf '%s\n' "$expected_stamp" >"$OFFICIAL_DIR/.archive-stamp"
}

ensure_snap4_payload() {
  if [[ ! -f "$SNAP4_TARBALL" ]]; then
    curl -L --fail --output "$SNAP4_TARBALL" "$SNAP4_URL"
  fi

  if [[ -x "$SNAP4_DIR/snap4/genera" ]]; then
    return 0
  fi

  stash_stale_path "$SNAP4_DIR"
  mkdir -p "$SNAP4_DIR"
  tar -xzf "$SNAP4_TARBALL" -C "$SNAP4_DIR"
}

write_vlm_file() {
  cat >"$VLM_FILE" <<EOF
genera.network: $NETWORK_SPEC
genera.virtualMemory: $VIRTUAL_MEMORY
genera.enableIDS: $ENABLE_IDS
genera.world: $RUNTIME_DIR/Genera-8-5.vlod
genera.debugger: $RUNTIME_DIR/VLM_debugger
genera.worldSearchPath: $RUNTIME_DIR
genera.coldLoad.geometry: $COLDLOAD_GEOMETRY
EOF
}

ensure_runtime_tree() {
  local source_stamp
  local current_stamp=

  ensure_official_payload
  ensure_snap4_payload

  source_stamp="$(archive_fingerprint "$ARCHIVE_PATH")|$(stat -c '%n|%s|%Y' "$SNAP4_TARBALL")"
  if [[ -f "$RUNTIME_DIR/.sources-stamp" ]]; then
    current_stamp=$(<"$RUNTIME_DIR/.sources-stamp")
  fi

  if [[ "$current_stamp" != "$source_stamp" ]] ||
     [[ ! -x "$RUNTIME_DIR/genera" ]] ||
     [[ ! -f "$RUNTIME_DIR/Genera-8-5.vlod" ]] ||
     [[ ! -f "$RUNTIME_DIR/VLM_debugger" ]] ||
     [[ ! -d "$RUNTIME_DIR/sys.sct" ]]; then
    stash_stale_path "$RUNTIME_DIR"
    mkdir -p "$RUNTIME_DIR" "$RUNTIME_DIR/rel-8-5"
    cp -f "$SNAP4_DIR/snap4/genera" "$RUNTIME_DIR/genera"
    cp -f "$OFFICIAL_PAYLOAD_DIR/usr/opt/VLM200/lib/symbolics/Genera-8-5.vlod" "$RUNTIME_DIR/Genera-8-5.vlod"
    cp -f "$OFFICIAL_PAYLOAD_DIR/usr/opt/VLM200/lib/symbolics/VLM_debugger" "$RUNTIME_DIR/VLM_debugger"
    cp -a "$OFFICIAL_DIR/og2/sys.sct" "$RUNTIME_DIR/sys.sct"
    chmod -R u+w "$RUNTIME_DIR/sys.sct"
    ln -s ../sys.sct "$RUNTIME_DIR/rel-8-5/sys.sct"
    cp -f "$SNAP4_DIR/snap4/README" "$REFERENCE_DIR/snap4-README.txt"
    cp -f "$OFFICIAL_DIR/og2/README" "$REFERENCE_DIR/opengenera2-README.txt"
    cp -f "$OFFICIAL_DIR/og2/quickstart.text" "$REFERENCE_DIR/opengenera2-quickstart.text"
    printf '%s\n' "$source_stamp" >"$RUNTIME_DIR/.sources-stamp"
  fi

  write_vlm_file
}

ensure_arp_bypass_shim() {
  if [[ ! -f "$ARP_BYPASS_SOURCE" ]]; then
    printf 'Missing Open Genera ARP compatibility source: %s\n' "$ARP_BYPASS_SOURCE" >&2
    exit 1
  fi

  if [[ ! -f "$ARP_BYPASS_SO" || "$ARP_BYPASS_SOURCE" -nt "$ARP_BYPASS_SO" ]]; then
    gcc -shared -fPIC -O2 -ldl -o "$ARP_BYPASS_SO" "$ARP_BYPASS_SOURCE"
  fi
}

print_verify_status() {
  printf 'bash: %s\n' "$(command -v bash)"
  printf 'curl: %s\n' "$(command -v curl)"
  printf 'ifconfig: %s\n' "$(command -v ifconfig)"
  printf 'archive: %s\n' "${ARCHIVE_PATH:-<unset>}"
  if [[ -n "$ARCHIVE_PATH" && -f "$ARCHIVE_PATH" ]]; then
    printf 'archive-present: yes\n'
  else
    printf 'archive-present: no\n'
  fi
  if [[ -f "$SNAP4_TARBALL" ]]; then
    printf 'snap4-cache: %s\n' "$SNAP4_TARBALL"
  else
    printf 'snap4-cache: missing\n'
  fi
  if [[ -e /dev/net/tun ]]; then
    printf '/dev/net/tun: present\n'
  else
    printf '/dev/net/tun: missing\n'
  fi
  if command -v ip >/dev/null 2>&1 && ip link show "$TUN_DEVICE" >/dev/null 2>&1; then
    printf '%s: present\n' "$TUN_DEVICE"
  else
    printf '%s: missing\n' "$TUN_DEVICE"
  fi
}

warn_if_host_network_missing() {
  if [[ ! -e /dev/net/tun ]]; then
    cat >&2 <<EOF
/dev/net/tun is not available inside the container.
Expose it from the host and rerun.
EOF
    return 0
  fi

  if command -v ip >/dev/null 2>&1 && ! ip link show "$TUN_DEVICE" >/dev/null 2>&1; then
    cat >&2 <<EOF
$TUN_DEVICE is not present on the host network namespace.
Open Genera's Linux VLM usually needs a persistent $TUN_DEVICE owned by your user.
Try:
  sudo ./scripts/opengenera-host-net.sh up --user "${USER:-$(id -un)}"
EOF
  fi
}

resolve_loader() {
  ldd "$(command -v bash)" | awk '
    /ld-linux/ && $3 ~ /^\// { print $3; exit }
    /^[[:space:]]*\/gnu\/store\/.*ld-linux/ { print $1; exit }
  '
}

launch_genera() {
  local loader
  local library_path
  local profile_dir
  local preload_value

  loader=$(resolve_loader)
  if [[ -z "$loader" || ! -x "$loader" ]]; then
    printf 'Unable to resolve the dynamic loader for the Open Genera runtime.\n' >&2
    exit 1
  fi

  ensure_arp_bypass_shim
  profile_dir=$(cd -- "$(dirname -- "$(command -v bash)")/.." && pwd)
  library_path="$(dirname "$loader"):$profile_dir/lib"
  preload_value="$ARP_BYPASS_SO"
  if [[ -n "${LD_PRELOAD:-}" ]]; then
    preload_value="$preload_value:${LD_PRELOAD}"
  fi

  exec env LD_PRELOAD="$preload_value" \
    "$loader" --library-path "$library_path" "$RUNTIME_DIR/genera" "${pass_args[@]}"
}

case "$mode" in
  run)
    if ((verify)); then
      print_verify_status
      exit 0
    fi
    ensure_runtime_tree
    if ((prepare_only)); then
      exit 0
    fi
    warn_if_host_network_missing
    cd "$RUNTIME_DIR"
    launch_genera
    ;;
  shell)
    if [[ -n "$ARCHIVE_PATH" && -f "$ARCHIVE_PATH" ]]; then
      ensure_runtime_tree
      cd "$RUNTIME_DIR"
    else
      cd "$ROOT_DIR"
    fi
    exec bash -i
    ;;
  tool)
    cd "$ROOT_DIR"
    if ((${#pass_args[@]} == 0)); then
      printf 'tool mode needs a command after --\n' >&2
      exit 1
    fi
    exec "${pass_args[@]}"
    ;;
  *)
    printf 'Unknown mode: %s\n' "$mode" >&2
    usage >&2
    exit 1
    ;;
esac

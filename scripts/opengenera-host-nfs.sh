#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: opengenera-host-nfs.sh COMMAND

Commands:
  print
      Show the host NFS export and daemon setup Open Genera site configuration needs.

  up
      Create the writable export tree, publish it via NFS, and ensure rpcbind/
      mountd/nfsd are available. This command must run as root.

  down
      Remove the dedicated Open Genera exports and reload exports. This command
      must run as root. It intentionally leaves shared rpcbind/nfsd services
      running if the host already uses them.

  status
      Show current export configuration, daemon state, and the Genera-facing
      default paths for site files and saved worlds.

Environment overrides:
  OPENGENERA_NFS_CLIENT_ADDR   Client IP allowed to mount the export (default 10.0.0.2)
  OPENGENERA_EXPORTS_FILE      exports.d fragment path (default /etc/exports.d/opengenera.exports)
  OPENGENERA_NFSD_THREADS      rpc.nfsd thread count (default 8)
  OPENGENERA_NFSD_VERSION_ARGS Extra rpc.nfsd version flags (default --nfs-version 2)
  OPENGENERA_RPC_MOUNTD_ARGS   Extra rpc.mountd version flags (default --nfs-version 2)
  OPENGENERA_SITE_HOST_DIR     Host site directory exported to Genera
  OPENGENERA_WORLD_HOST_DIR    Host world directory exported to Genera

Examples:
  ./scripts/opengenera-host-nfs.sh print
  sudo ./scripts/opengenera-host-nfs.sh up
  ./scripts/opengenera-host-nfs.sh status
EOF
}

COMMAND=${1:-print}
CLIENT_ADDR=${OPENGENERA_NFS_CLIENT_ADDR:-10.0.0.2}
EXPORTS_FILE=${OPENGENERA_EXPORTS_FILE:-/etc/exports.d/opengenera.exports}
NFSD_THREADS=${OPENGENERA_NFSD_THREADS:-8}
NFSD_VERSION_ARGS=${OPENGENERA_NFSD_VERSION_ARGS:---nfs-version 2}
RPC_MOUNTD_ARGS=${OPENGENERA_RPC_MOUNTD_ARGS:---nfs-version 2}
SITE_HOST_DIR=${OPENGENERA_SITE_HOST_DIR:-/var/lib/symbolics/sys.sct/site}
WORLD_HOST_DIR=${OPENGENERA_WORLD_HOST_DIR:-/usr/opt/VLM200/lib/symbolics}
SITE_DIR_GENERA="HOST:${SITE_HOST_DIR}/"
WORLD_DIR_GENERA="HOST:${WORLD_HOST_DIR}/"
EXPORT_OPTIONS="rw,sync,no_subtree_check,insecure,no_root_squash,crossmnt"

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    printf 'This command must be run as root.\n' >&2
    exit 1
  fi
}

have_mountd() {
  command -v rpc.mountd >/dev/null 2>&1
}

ensure_daemon() {
  local pattern=$1
  shift
  if pgrep -f -- "$pattern" >/dev/null 2>&1; then
    return 0
  fi
  "$@"
}

ensure_nfsd_mount() {
  mkdir -p /proc/fs/nfsd
  if ! grep -qs ' /proc/fs/nfsd nfsd ' /proc/mounts; then
    mount -t nfsd nfsd /proc/fs/nfsd
  fi
}

write_exports_file() {
  mkdir -p "$(dirname -- "$EXPORTS_FILE")"
  cat >"$EXPORTS_FILE" <<EOF
${SITE_HOST_DIR} ${CLIENT_ADDR}(${EXPORT_OPTIONS})
${WORLD_HOST_DIR} ${CLIENT_ADDR}(${EXPORT_OPTIONS})
EOF
}

print_commands() {
  cat <<EOF
sudo mkdir -p "${SITE_HOST_DIR}" "${WORLD_HOST_DIR}"
sudo mkdir -p /etc/exports.d
sudo sh -c 'cat >"${EXPORTS_FILE}" <<EOT
${SITE_HOST_DIR} ${CLIENT_ADDR}(${EXPORT_OPTIONS})
${WORLD_HOST_DIR} ${CLIENT_ADDR}(${EXPORT_OPTIONS})
EOT'
sudo rpcbind -w
sudo rpc.mountd ${RPC_MOUNTD_ARGS}
sudo mount -t nfsd nfsd /proc/fs/nfsd
sudo rpc.nfsd ${NFSD_VERSION_ARGS} ${NFSD_THREADS}
sudo exportfs -rav

Genera site directory: ${SITE_DIR_GENERA}
Genera world directory: ${WORLD_DIR_GENERA}
EOF
}

show_status() {
  printf 'site-host-dir: %s\n' "$SITE_HOST_DIR"
  printf 'world-host-dir: %s\n' "$WORLD_HOST_DIR"
  printf 'site-dir: %s\n' "$SITE_DIR_GENERA"
  printf 'world-dir: %s\n' "$WORLD_DIR_GENERA"
  printf 'client-addr: %s\n' "$CLIENT_ADDR"
  if [[ -f "$EXPORTS_FILE" ]]; then
    printf 'exports-file: %s\n' "$EXPORTS_FILE"
    sed 's/^/exports-entry: /' "$EXPORTS_FILE"
  else
    printf 'exports-file: missing\n'
  fi
  printf 'rpcbind: %s\n' "$(pgrep -x rpcbind >/dev/null 2>&1 && echo running || echo stopped)"
  printf 'rpc.mountd: %s\n' "$(pgrep -f 'rpc.mountd' >/dev/null 2>&1 && echo running || echo stopped)"
  printf 'nfsd-mounted: %s\n' "$(grep -qs ' /proc/fs/nfsd nfsd ' /proc/mounts && echo yes || echo no)"
  printf 'nfs-v2: %s\n' "$(rpcinfo -p 127.0.0.1 2>/dev/null | awk '$1==100003 && $2==2 {found=1} END {print found ? "available" : "unavailable"}')"
  if [[ ${EUID:-$(id -u)} -eq 0 ]] && command -v exportfs >/dev/null 2>&1; then
    exportfs -s | sed 's/^/exportfs: /' || true
  fi
  if command -v showmount >/dev/null 2>&1; then
    showmount -e 127.0.0.1 2>/dev/null | sed 's/^/showmount: /' || true
  fi
}

case "$COMMAND" in
  print)
    print_commands
    ;;
  up)
    require_root
    mkdir -p "$SITE_HOST_DIR" "$WORLD_HOST_DIR"
    write_exports_file
    ensure_daemon '^rpcbind$' rpcbind -w
    if have_mountd; then
      ensure_daemon 'rpc\\.mountd' rpc.mountd ${RPC_MOUNTD_ARGS}
    fi
    ensure_nfsd_mount
    rpc.nfsd ${NFSD_VERSION_ARGS} "$NFSD_THREADS"
    exportfs -rav
    show_status
    ;;
  down)
    require_root
    if [[ -f "$EXPORTS_FILE" ]]; then
      rm -f "$EXPORTS_FILE"
      exportfs -rav
    fi
    show_status
    ;;
  status)
    show_status
    ;;
  --help|-h|help)
    usage
    ;;
  *)
    printf 'Unknown command: %s\n' "$COMMAND" >&2
    usage >&2
    exit 1
    ;;
esac

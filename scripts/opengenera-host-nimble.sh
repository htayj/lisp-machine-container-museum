#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: opengenera-host-nimble.sh COMMAND

Commands:
  print
      Show the host NFSv2 Nimble setup Open Genera can use.

  up
      Stop conflicting kernel RPC/NFS services if present and start the bundled
      Nimble userspace NFSv2 server. This command must run as root.

  down
      Stop Nimble and restart any systemd services that this helper stopped.
      This command must run as root.

  status
      Show whether Nimble is running and which exports it serves.

Environment overrides:
  OPENGENERA_NIMBLE_BIN         Nimble executable path
  OPENGENERA_NIMBLE_PIDFILE     PID file path
  OPENGENERA_NIMBLE_LOG         Log path
  OPENGENERA_NIMBLE_STATEFILE   Service state file path
  OPENGENERA_NIMBLE_SITE_DIR    Exported site directory (default /var/lib/symbolics/sys.sct/site)
  OPENGENERA_NIMBLE_WORLD_DIR   Exported world directory (default /usr/opt/VLM200/lib/symbolics)
  OPENGENERA_NIMBLE_EXTRA_ARGS  Extra Nimble arguments (default -v)

The helper exports these host paths under the same names, so inside Genera use:
  DIS-EMB-HOST:/var/lib/symbolics/sys.sct/site/
  DIS-EMB-HOST:/usr/opt/VLM200/lib/symbolics/
EOF
}

COMMAND=${1:-status}
ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
NIMBLE_BIN=${OPENGENERA_NIMBLE_BIN:-$ROOT_DIR/.lm-home/opengenera/third-party/nimble/build/nimble}
PIDFILE=${OPENGENERA_NIMBLE_PIDFILE:-$ROOT_DIR/.lm-home/opengenera/host-nimble.pid}
LOGFILE=${OPENGENERA_NIMBLE_LOG:-$ROOT_DIR/.lm-home/opengenera/host-nimble.log}
STATEFILE=${OPENGENERA_NIMBLE_STATEFILE:-$ROOT_DIR/.lm-home/opengenera/host-nimble.state}
SITE_DIR=${OPENGENERA_NIMBLE_SITE_DIR:-/var/lib/symbolics/sys.sct/site}
WORLD_DIR=${OPENGENERA_NIMBLE_WORLD_DIR:-/usr/opt/VLM200/lib/symbolics}
EXTRA_ARGS=${OPENGENERA_NIMBLE_EXTRA_ARGS:--v}
SERVICES=(rpcbind.socket rpcbind.service nfs-server.service)

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    printf 'This command must be run as root.\n' >&2
    exit 1
  fi
}

is_running() {
  [[ -f "$PIDFILE" ]] || return 1
  local pid
  pid=$(<"$PIDFILE")
  [[ -n "$pid" ]] || return 1
  ps -p "$pid" >/dev/null 2>&1
}

print_setup() {
  cat <<EOF
sudo ./scripts/opengenera-host-nimble.sh up

Genera site directory: DIS-EMB-HOST:${SITE_DIR}/
Genera world directory: DIS-EMB-HOST:${WORLD_DIR}/
EOF
}

show_status() {
  printf 'nimble-bin: %s\n' "$NIMBLE_BIN"
  printf 'pidfile: %s\n' "$PIDFILE"
  printf 'logfile: %s\n' "$LOGFILE"
  printf 'statefile: %s\n' "$STATEFILE"
  printf 'site-dir: DIS-EMB-HOST:%s/\n' "$SITE_DIR"
  printf 'world-dir: DIS-EMB-HOST:%s/\n' "$WORLD_DIR"
  if is_running; then
    printf 'status: running (pid %s)\n' "$(<"$PIDFILE")"
  else
    printf 'status: stopped\n'
  fi
}

stop_services() {
  : >"$STATEFILE"
  for svc in "${SERVICES[@]}"; do
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$svc"; then
      printf '%s\n' "$svc" >>"$STATEFILE"
      systemctl stop "$svc"
    fi
  done
  pkill -x rpcbind 2>/dev/null || true
  pkill -x rpc.nfsd 2>/dev/null || true
  pkill -f rpc.mountd 2>/dev/null || true
}

restart_services() {
  [[ -f "$STATEFILE" ]] || return 0
  if command -v systemctl >/dev/null 2>&1; then
    while IFS= read -r svc; do
      [[ -n "$svc" ]] || continue
      systemctl start "$svc" || true
    done <"$STATEFILE"
  fi
  rm -f "$STATEFILE"
}

case "$COMMAND" in
  print)
    print_setup
    ;;
  up)
    require_root
    [[ -x "$NIMBLE_BIN" ]] || { printf 'Nimble binary not found: %s\n' "$NIMBLE_BIN" >&2; exit 1; }
    mkdir -p "$(dirname -- "$PIDFILE")" "$(dirname -- "$LOGFILE")"
    mkdir -p "$SITE_DIR" "$WORLD_DIR"
    if is_running; then
      show_status
      exit 0
    fi
    stop_services
    # shellcheck disable=SC2086
    nohup "$NIMBLE_BIN" $EXTRA_ARGS "$SITE_DIR" "$SITE_DIR" "$WORLD_DIR" "$WORLD_DIR" >"$LOGFILE" 2>&1 &
    echo $! >"$PIDFILE"
    sleep 1
    if ! is_running; then
      printf 'Nimble failed to start; see %s\n' "$LOGFILE" >&2
      exit 1
    fi
    show_status
    ;;
  down)
    require_root
    if is_running; then
      kill "$(<"$PIDFILE")" || true
      rm -f "$PIDFILE"
    fi
    restart_services
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

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: opengenera-host-ftp.sh COMMAND

Commands:
  print
      Show the host FTP setup Open Genera can use as a writable file service.

  up
      Start the bundled FTP server on the host-side TAP address. This command
      must run as root because classic FTP uses port 21.

  down
      Stop the bundled FTP server if it is running. This command must run as root.

  status
      Show whether the bundled FTP server is running.

Environment overrides:
  OPENGENERA_FTP_BIND      Bind address (default 10.0.0.1)
  OPENGENERA_FTP_PORT      Bind port (default 21)
  OPENGENERA_FTP_USER      Username (default anonymous)
  OPENGENERA_FTP_PASSWORD  Password (default genera)
  OPENGENERA_FTP_ROOT      Exposed root directory (default /)
  OPENGENERA_FTP_PIDFILE   PID file path
  OPENGENERA_FTP_LOG       Log path

Genera path examples once running:
  TUNFTP:/var/lib/symbolics/sys.sct/site/
  TUNFTP:/usr/opt/VLM200/lib/symbolics/
EOF
}

COMMAND=${1:-status}
ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
BIND=${OPENGENERA_FTP_BIND:-10.0.0.1}
PORT=${OPENGENERA_FTP_PORT:-21}
USER_NAME=${OPENGENERA_FTP_USER:-anonymous}
PASSWORD=${OPENGENERA_FTP_PASSWORD:-genera}
FTP_ROOT=${OPENGENERA_FTP_ROOT:-/}
PIDFILE=${OPENGENERA_FTP_PIDFILE:-$ROOT_DIR/.lm-home/opengenera/host-ftp.pid}
LOGFILE=${OPENGENERA_FTP_LOG:-$ROOT_DIR/.lm-home/opengenera/host-ftp.log}
SERVER_SCRIPT="$ROOT_DIR/scripts/opengenera-host-ftp.py"

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
sudo ./scripts/opengenera-host-ftp.sh up

Genera host name to create: TUNFTP
Genera site directory: TUNFTP:/var/lib/symbolics/sys.sct/site/
Genera world directory: TUNFTP:/usr/opt/VLM200/lib/symbolics/
EOF
}

show_status() {
  printf 'bind: %s\n' "$BIND"
  printf 'port: %s\n' "$PORT"
  printf 'root: %s\n' "$FTP_ROOT"
  printf 'pidfile: %s\n' "$PIDFILE"
  printf 'logfile: %s\n' "$LOGFILE"
  if is_running; then
    printf 'status: running (pid %s)\n' "$(<"$PIDFILE")"
  else
    printf 'status: stopped\n'
  fi
}

case "$COMMAND" in
  print)
    print_setup
    ;;
  up)
    require_root
    mkdir -p "$(dirname -- "$PIDFILE")" "$(dirname -- "$LOGFILE")"
    if is_running; then
      show_status
      exit 0
    fi
    nohup "$SERVER_SCRIPT" --bind "$BIND" --port "$PORT" --user "$USER_NAME" --password "$PASSWORD" --root "$FTP_ROOT" >"$LOGFILE" 2>&1 &
    echo $! >"$PIDFILE"
    sleep 1
    if ! is_running; then
      printf 'FTP server failed to start; see %s\n' "$LOGFILE" >&2
      exit 1
    fi
    show_status
    ;;
  down)
    require_root
    if is_running; then
      kill "$(<"$PIDFILE")"
      rm -f "$PIDFILE"
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

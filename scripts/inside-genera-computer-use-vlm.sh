#!/usr/bin/env bash
set -euo pipefail

VLM_EXECUTABLE=${GENERA_COMPUTER_USE_VLM:?GENERA_COMPUTER_USE_VLM is required}
LAUNCH_CWD=${GENERA_COMPUTER_USE_CWD:?GENERA_COMPUTER_USE_CWD is required}
PRELOADS=${GENERA_COMPUTER_USE_PRELOADS:?GENERA_COMPUTER_USE_PRELOADS is required}
TIME_SERVER=${GENERA_COMPUTER_USE_TIME_SERVER:?GENERA_COMPUTER_USE_TIME_SERVER is required}
TIME_READY=${GENERA_COMPUTER_USE_TIME_READY:?GENERA_COMPUTER_USE_TIME_READY is required}
TIME_EVIDENCE=${GENERA_COMPUTER_USE_TIME_EVIDENCE:?GENERA_COMPUTER_USE_TIME_EVIDENCE is required}
TIME_COMPLETE=${GENERA_COMPUTER_USE_TIME_COMPLETE:?GENERA_COMPUTER_USE_TIME_COMPLETE is required}
TIME_FAILURE=${GENERA_COMPUTER_USE_TIME_FAILURE:?GENERA_COMPUTER_USE_TIME_FAILURE is required}

resolve_loader() {
  ldd "$(command -v bash)" | awk '
    /ld-linux/ && $3 ~ /^\// { print $3; exit }
    /^[[:space:]]*\/gnu\/store\/.*ld-linux/ { print $1; exit }
  '
}

loader=$(resolve_loader)
if [[ -z "$loader" || ! -x "$loader" ]]; then
  printf 'Unable to resolve the dynamic loader for the Open Genera runtime.\n' >&2
  exit 1
fi
if [[ ! -x "$VLM_EXECUTABLE" ]]; then
  printf 'Open Genera VLM executable is missing or not executable: %s\n' "$VLM_EXECUTABLE" >&2
  exit 1
fi
if [[ ! -d "$LAUNCH_CWD" ]]; then
  printf 'Open Genera launch directory does not exist: %s\n' "$LAUNCH_CWD" >&2
  exit 1
fi
if [[ ! -x "$TIME_SERVER" ]]; then
  printf 'RFC 868 responder is missing or not executable: %s\n' "$TIME_SERVER" >&2
  exit 1
fi
if [[ -L "$TIME_READY" || -L "$TIME_EVIDENCE" || -L "$TIME_COMPLETE" || -L "$TIME_FAILURE" ]]; then
  printf 'Refusing symbolic-link RFC 868 evidence paths.\n' >&2
  exit 1
fi

record_time_failure() {
  python3 - "$TIME_FAILURE" "$1" <<'PY'
import datetime as dt
import json
import os
from pathlib import Path
import sys
import uuid

destination = Path(sys.argv[1])
payload = {
    "schema": 1,
    "failed_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    "reason": sys.argv[2],
}
temporary = destination.with_name(
    f".{destination.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
)
flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
if hasattr(os, "O_NOFOLLOW"):
    flags |= os.O_NOFOLLOW
descriptor = os.open(temporary, flags, 0o600)
try:
    with os.fdopen(descriptor, "w", encoding="ascii") as output:
        json.dump(payload, output, indent=2, sort_keys=True)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, destination)
finally:
    temporary.unlink(missing_ok=True)
PY
}

profile_dir=$(cd -- "$(dirname -- "$(command -v bash)")/.." && pwd)
library_path="$(dirname "$loader"):$profile_dir/lib"

cd "$LAUNCH_CWD"

time_pid=
vlm_pid=
cleanup() {
  trap - HUP INT TERM
  if [[ -n $vlm_pid ]] && kill -0 "$vlm_pid" 2>/dev/null; then
    kill -TERM "$vlm_pid" 2>/dev/null || true
  fi
  if [[ -n $vlm_pid ]]; then
    wait "$vlm_pid" 2>/dev/null || true
  fi
  if [[ -n $time_pid ]] && kill -0 "$time_pid" 2>/dev/null; then
    kill -TERM "$time_pid" 2>/dev/null || true
  fi
  if [[ -n $time_pid ]]; then
    wait "$time_pid" 2>/dev/null || true
  fi
}
terminate() {
  trap - HUP INT TERM
  if [[ -n $vlm_pid ]] && kill -0 "$vlm_pid" 2>/dev/null; then
    kill -TERM "$vlm_pid" 2>/dev/null || true
  fi
  if [[ -n $vlm_pid ]]; then
    wait "$vlm_pid" 2>/dev/null || true
    vlm_pid=
  fi
  exit 143
}
trap cleanup EXIT
trap terminate HUP INT TERM

python3 "$TIME_SERVER" \
  --interface tun0 \
  --host-ip 10.0.0.1 \
  --host-mac 02:00:00:00:00:25 \
  --port 37 \
  --ready-file "$TIME_READY" \
  --evidence-file "$TIME_EVIDENCE" \
  </dev/null &
time_pid=$!

for _attempt in $(seq 1 100); do
  if [[ -f "$TIME_READY" ]]; then
    break
  fi
  if ! kill -0 "$time_pid" 2>/dev/null; then
    set +e
    wait "$time_pid"
    time_status=$?
    set -e
    record_time_failure "RFC 868 responder exited before readiness with status $time_status" || true
    exit 1
  fi
  sleep 0.05
done
if [[ ! -f "$TIME_READY" ]]; then
  record_time_failure "RFC 868 responder did not become ready" || true
  printf 'RFC 868 responder did not become ready.\n' >&2
  exit 1
fi

env LD_BIND_NOW=1 LD_PRELOAD="$PRELOADS" \
  "$loader" --library-path "$library_path" "$VLM_EXECUTABLE" "$@" <&0 &
vlm_pid=$!

# The VLM request is what lets the one-shot responder finish.  Do not declare the
# helper healthy merely because the responder opened its sockets: reap it and
# publish a completion record only after its evidence file was written and it
# exited successfully.  On any error, EXIT cleanup requests VLM termination but
# deliberately never hides a SIGKILL; the outer supervisor owns bounded forcing
# and records it.
while kill -0 "$vlm_pid" 2>/dev/null; do
  if ! kill -0 "$time_pid" 2>/dev/null; then
    set +e
    wait "$time_pid"
    time_status=$?
    set -e
    time_pid=
    if [[ $time_status -ne 0 ]]; then
      record_time_failure "RFC 868 responder exited with status $time_status" || true
      printf 'RFC 868 responder exited with status %s.\n' "$time_status" >&2
      exit 1
    fi
    if [[ ! -f "$TIME_EVIDENCE" ]]; then
      record_time_failure "RFC 868 responder exited successfully without evidence" || true
      printf 'RFC 868 responder exited successfully without an evidence record.\n' >&2
      exit 1
    fi
    if ! python3 - "$TIME_EVIDENCE" "$TIME_COMPLETE" <<'PY'
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
import uuid

evidence = Path(sys.argv[1])
complete = Path(sys.argv[2])
payload = {
    "schema": 1,
    "completed_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    "responder_exit_status": 0,
    "evidence_sha256": hashlib.sha256(evidence.read_bytes()).hexdigest(),
}
temporary = complete.with_name(f".{complete.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
if hasattr(os, "O_NOFOLLOW"):
    flags |= os.O_NOFOLLOW
descriptor = os.open(temporary, flags, 0o600)
try:
    with os.fdopen(descriptor, "w", encoding="ascii") as destination:
        json.dump(payload, destination, indent=2, sort_keys=True)
        destination.write("\n")
        destination.flush()
        os.fsync(destination.fileno())
    os.replace(temporary, complete)
finally:
    temporary.unlink(missing_ok=True)
PY
    then
      record_time_failure "RFC 868 completion record could not be written" || true
      printf 'RFC 868 completion record could not be written.\n' >&2
      exit 1
    fi
    break
  fi
  sleep 0.02
done

if [[ -n $time_pid ]]; then
  record_time_failure "Open Genera VLM exited before RFC 868 responder completion" || true
  printf 'Open Genera VLM exited before RFC 868 responder completion.\n' >&2
fi
set +e
wait "$vlm_pid"
status=$?
set -e
vlm_pid=
exit "$status"

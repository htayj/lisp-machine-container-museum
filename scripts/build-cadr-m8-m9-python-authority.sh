#!/bin/sh
set -eu

IFS= read -r ptrace_scope < /proc/sys/kernel/yama/ptrace_scope ||
  { echo "cannot read host Yama ptrace_scope" >&2; exit 2; }
case "$ptrace_scope" in
  3) ;;
  *) echo "host Yama ptrace_scope must be exactly 3 before authority build" >&2
     exit 2 ;;
esac

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
exec node "$root/scripts/build-cadr-m8-m9-python-authority.mjs" "$@"

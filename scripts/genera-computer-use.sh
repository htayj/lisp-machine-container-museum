#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

exec guix shell -m "$ROOT_DIR/manifest.scm" -- env \
  CC=gcc \
  PYTHONDONTWRITEBYTECODE=1 \
  python3 "$ROOT_DIR/scripts/genera-computer-use.py" "$@"

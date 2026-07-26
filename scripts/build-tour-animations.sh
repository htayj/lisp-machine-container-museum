#!/usr/bin/env bash
set -euo pipefail

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"

require_sha256() {
  local expected=$1
  local path=$2
  printf '%s  %s\n' "$expected" "$path" | sha256sum --check --status
}

# Inputs are already reviewed, tracked runtime captures. The animations preserve
# every source pixel and alternate complete frames; they do not synthesize
# intermediate runtime states or imply real-time latency.
require_sha256 \
  2abdb00ff42c3d032744785b2964d144b62e468ea92815becb5f479d78519d82 \
  docs/assets/mit-cadr-screenshots/system-menu.png
require_sha256 \
  f96bf56b32e26334545e0c3b69c86f7eb8626e358d5d874d6f1ddad8d605a18c \
  docs/assets/mit-cadr-screenshots/zmacs-text-mode.png
require_sha256 \
  ccd97819c88c1cc4c9cc5acf017c54a5dd3dd551239ac5b8a1bdf433a4d7530c \
  docs/assets/mit-cadr-screenshots/zmacs-lisp-mode.png
require_sha256 \
  e1a8a968d891e68e9f4315ee7d943d4b0b1fb70b103226402ba64d23f91a5d66 \
  docs/assets/genera-screenshots/system-menu.png
require_sha256 \
  39061d7b9ea5b55428020cfaf7558b5566c101ab56822cbd951905c520c3ebac \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png

magick \
  -delay 240 docs/assets/mit-cadr-screenshots/zmacs-text-mode.png \
  -delay 240 docs/assets/mit-cadr-screenshots/zmacs-lisp-mode.png \
  -loop 0 -layers Optimize \
  docs/assets/mit-cadr-screenshots/zmacs-mode-switch.gif

magick \
  -delay 240 docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  -delay 240 docs/assets/genera-screenshots/system-menu.png \
  -loop 0 -layers Optimize \
  docs/assets/genera-screenshots/open-system-menu.gif

identify docs/assets/mit-cadr-screenshots/zmacs-mode-switch.gif
identify docs/assets/genera-screenshots/open-system-menu.gif

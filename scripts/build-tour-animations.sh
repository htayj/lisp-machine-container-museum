#!/usr/bin/env bash
set -euo pipefail

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"

require_sha256() {
  local expected=$1
  local path=$2
  printf '%s  %s\n' "$expected" "$path" | sha256sum --check --status
}

build_loop() {
  local output=$1
  shift
  local -a frames=()
  local frame
  for frame in "$@"; do
    frames+=(-delay 240 "$frame")
  done
  magick "${frames[@]}" -loop 0 -layers Optimize "$output"
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
require_sha256 \
  139d66a2ddc3230e46781610a079a0e0134bf440becaa665f9c2042d514d551c \
  docs/assets/mit-cadr-screenshots/lisp-listener-multiple-values.png
require_sha256 \
  ed9cbcd15f31e3248ab4521eddc64b265465b070de20d515dc7bfeb18b62e710 \
  docs/assets/mit-cadr-screenshots/zmacs-lisp-buffer.png
require_sha256 \
  e0d6bf39d9de90b8c94ba93aeb2a70bbe1bec1e8ebbefebf80ffa371ac420c48 \
  docs/assets/mit-cadr-screenshots/zwei-help-menu.png
require_sha256 \
  a8c104631118a10749f4b0a6b6059dfe902c190e4c20075d8f94fcb683c137b3 \
  docs/assets/mit-cadr-screenshots/inspector-list.png
require_sha256 \
  3685ff9b1c43a40d7992abcc2f3d54e4e1ba7d43a8a4c7d4413bc3fa3368881d \
  docs/assets/mit-cadr-screenshots/peek-processes.png
require_sha256 \
  87cb86efce54505176e82157a09aab6a0ba693359012afefc02f33e01c525c6e \
  docs/assets/mit-cadr-screenshots/screen-editor-menu.png
require_sha256 \
  42f691c9b82dd411ee2643ca55ce418563db0fe4063e3f69207b162bcf9f1aae \
  docs/assets/mit-cadr-screenshots/trace-step-and-who-calls.png
require_sha256 \
  e9af453164e75dccc90a4fe12a12b231e3308af9212b9c3b005a927e09f919ce \
  docs/assets/mit-cadr-screenshots/emergency-break-cold-load-evaluation.png
require_sha256 \
  fc8917d449d376d2cca2b498d530f9b491332fda48f9f4a2e861bba0125d53b6 \
  docs/assets/mit-cadr-screenshots/error-handler-dynamic-choices.png
require_sha256 \
  812a7a2a218e0974899fc49cd46f85a903aa98f07083b6a82b759c4dcad95690 \
  docs/assets/genera-screenshots/zmacs-two-window-layout.png
require_sha256 \
  3bb262dd10fbc7e641a749a9047af753fc7886774815d88321e8c5a925a26c28 \
  docs/assets/genera-screenshots/zmacs-help-dispatcher.png
require_sha256 \
  723851fb4b7b20cc6c0c6aa966c7be6326e82d3934ce2de5a3dddeb7b036c69c \
  docs/assets/genera-screenshots/zmacs-editor-menu.png
require_sha256 \
  970c299ec6f091dd2895022bd24935abb897931110b592e8c3517cde6a936963 \
  docs/assets/genera-screenshots/zmacs-list-buffers.png
require_sha256 \
  21bc8582103ceca9cb77b8c4201afb3f5795e4cb1346751141a55bb409fde3eb \
  docs/assets/genera-screenshots/zmacs-list-buffers-pointer-documentation.png
require_sha256 \
  4aa320fc70babdaff198cccb13f64731780faf71ee07de6bd7da0badc090585f \
  docs/assets/genera-screenshots/zmacs-list-buffers-generic-operation-menu.png
require_sha256 \
  e83d3cd7c59bdae6c6b3d2054af57602aa2f9e99cb07378ac497ca1755bbcf09 \
  docs/assets/genera-screenshots/zmacs-character-style-prompt.png
require_sha256 \
  2579d041983693aec1a794ba1efa23ca70e21421c2a2ca5b7eaab8d39e908834 \
  docs/assets/genera-screenshots/document-examiner-initial.png
require_sha256 \
  240d4984b574d3abe11db37a11da8007efa39ff387ffda7147c63230bc76da06 \
  docs/assets/genera-screenshots/presentation-inspector-integer.png
require_sha256 \
  ed1f6ebeca006ef2bcb32cf583e5612bd1de37dd986042718f633c4a3652828c \
  docs/assets/genera-screenshots/presentation-inspector-handler-report.png
require_sha256 \
  74925b70d33db0041b024d9fd68c2132d10f071839fc9cd688d09c0385966bb0 \
  docs/assets/genera-screenshots/frame-up-split-layout.png
require_sha256 \
  2b768105e7f32ded7bfc746669184d7e0d46fcc683d2c97217d94afbfe88044d \
  docs/assets/genera-screenshots/debugger-dynamic-choices.png
require_sha256 \
  9fe2a3f5b81a8f42f57a3af663b6a9d1f0476a7f01887adb5a8be1e6e807f408 \
  docs/assets/genera-screenshots/accepting-values-gc-options.png
require_sha256 \
  9513c57e3828fcbe9e0eb462a3a23028ee21839cc2b5647edf3fe0163a8e9c54 \
  docs/assets/genera-screenshots/compiler-macroexpand-disassembly.png

build_loop \
  docs/assets/mit-cadr-screenshots/zmacs-mode-switch.gif \
  docs/assets/mit-cadr-screenshots/zmacs-text-mode.png \
  docs/assets/mit-cadr-screenshots/zmacs-lisp-mode.png

build_loop \
  docs/assets/mit-cadr-screenshots/open-system-menu.gif \
  docs/assets/mit-cadr-screenshots/lisp-listener-multiple-values.png \
  docs/assets/mit-cadr-screenshots/system-menu.png
build_loop \
  docs/assets/mit-cadr-screenshots/open-zmacs-help.gif \
  docs/assets/mit-cadr-screenshots/zmacs-lisp-buffer.png \
  docs/assets/mit-cadr-screenshots/zwei-help-menu.png
build_loop \
  docs/assets/mit-cadr-screenshots/select-inspector.gif \
  docs/assets/mit-cadr-screenshots/lisp-listener-multiple-values.png \
  docs/assets/mit-cadr-screenshots/inspector-list.png
build_loop \
  docs/assets/mit-cadr-screenshots/select-peek.gif \
  docs/assets/mit-cadr-screenshots/lisp-listener-multiple-values.png \
  docs/assets/mit-cadr-screenshots/peek-processes.png
build_loop \
  docs/assets/mit-cadr-screenshots/open-screen-editor.gif \
  docs/assets/mit-cadr-screenshots/system-menu.png \
  docs/assets/mit-cadr-screenshots/screen-editor-menu.png
build_loop \
  docs/assets/mit-cadr-screenshots/trace-a-function.gif \
  docs/assets/mit-cadr-screenshots/lisp-listener-multiple-values.png \
  docs/assets/mit-cadr-screenshots/trace-step-and-who-calls.png
build_loop \
  docs/assets/mit-cadr-screenshots/enter-error-handler.gif \
  docs/assets/mit-cadr-screenshots/lisp-listener-multiple-values.png \
  docs/assets/mit-cadr-screenshots/error-handler-dynamic-choices.png
build_loop \
  docs/assets/mit-cadr-screenshots/enter-emergency-break.gif \
  docs/assets/mit-cadr-screenshots/lisp-listener-multiple-values.png \
  docs/assets/mit-cadr-screenshots/emergency-break-cold-load-evaluation.png

build_loop \
  docs/assets/genera-screenshots/open-system-menu.gif \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  docs/assets/genera-screenshots/system-menu.png
build_loop \
  docs/assets/genera-screenshots/select-editor.gif \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  docs/assets/genera-screenshots/zmacs-two-window-layout.png
build_loop \
  docs/assets/genera-screenshots/open-zmacs-help.gif \
  docs/assets/genera-screenshots/zmacs-two-window-layout.png \
  docs/assets/genera-screenshots/zmacs-help-dispatcher.png
build_loop \
  docs/assets/genera-screenshots/open-zmacs-editor-menu.gif \
  docs/assets/genera-screenshots/zmacs-two-window-layout.png \
  docs/assets/genera-screenshots/zmacs-editor-menu.png
build_loop \
  docs/assets/genera-screenshots/operate-on-buffer.gif \
  docs/assets/genera-screenshots/zmacs-list-buffers.png \
  docs/assets/genera-screenshots/zmacs-list-buffers-pointer-documentation.png \
  docs/assets/genera-screenshots/zmacs-list-buffers-generic-operation-menu.png
build_loop \
  docs/assets/genera-screenshots/prompt-character-style.gif \
  docs/assets/genera-screenshots/zmacs-two-window-layout.png \
  docs/assets/genera-screenshots/zmacs-character-style-prompt.png
build_loop \
  docs/assets/genera-screenshots/select-document-examiner.gif \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  docs/assets/genera-screenshots/document-examiner-initial.png
build_loop \
  docs/assets/genera-screenshots/inspect-presentation.gif \
  docs/assets/genera-screenshots/presentation-inspector-integer.png \
  docs/assets/genera-screenshots/presentation-inspector-handler-report.png
build_loop \
  docs/assets/genera-screenshots/reshape-screen.gif \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  docs/assets/genera-screenshots/frame-up-split-layout.png
build_loop \
  docs/assets/genera-screenshots/enter-debugger.gif \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  docs/assets/genera-screenshots/debugger-dynamic-choices.png
build_loop \
  docs/assets/genera-screenshots/open-gc-options.gif \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  docs/assets/genera-screenshots/accepting-values-gc-options.png
build_loop \
  docs/assets/genera-screenshots/macroexpand-and-disassemble.gif \
  docs/assets/genera-screenshots/dynamic-lisp-listener-multiple-values.png \
  docs/assets/genera-screenshots/compiler-macroexpand-disassembly.png

identify docs/assets/mit-cadr-screenshots/*.gif
identify docs/assets/genera-screenshots/*.gif

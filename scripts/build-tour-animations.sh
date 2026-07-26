#!/usr/bin/env bash
set -euo pipefail

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"

# Curated runtime animations are built from ignored harness sessions.  A clean
# checkout intentionally cannot rebuild licensed Genera frames, and must never
# replace an interaction with an alternation of unrelated tracked stills.  This
# command therefore verifies the reviewed publication set.  Use
# curate-runtime-animation.sh against a local session to make a candidate.

verify() {
  local path=$1
  local frames=$2
  local expected=$3
  test -f "$path"
  test "$(identify "$path" | wc -l)" -eq "$frames"
  printf '%s  %s\n' "$expected" "$path" | sha256sum --check --status
  printf 'verified %s (%s frames)\n' "$path" "$frames"
}

verify docs/assets/mit-cadr-screenshots/open-system-menu.gif 70 e260cb05d6a30e6ab28b21d713409eb19807bdb5f9d5c366109652e857840885
verify docs/assets/mit-cadr-screenshots/zmacs-mode-switch.gif 6 7ae0ded653430ceadfabba0d83a825c3b8d299c8a7ab34d811483eab82ce1043
verify docs/assets/mit-cadr-screenshots/open-zmacs-help.gif 3 3be75932ca82cde4298d473fea1b9a0bd9a742627aacca1f91a07d1b2edb2755
verify docs/assets/mit-cadr-screenshots/select-inspector.gif 3 4ec4a22e3875183088271c0c6f4eff8ff8555cffb8b606d9e689ae52f5b5a802
verify docs/assets/mit-cadr-screenshots/select-peek.gif 3 d4bb81191da635b842f1bd511f11949e3a7bc542b577645847a74613f9420a3d
verify docs/assets/mit-cadr-screenshots/open-screen-editor.gif 3 58322e69b2f507f94348bae05193fa253cad2a52384fe8ca5b1de9b18b8c3495
verify docs/assets/mit-cadr-screenshots/trace-a-function.gif 4 4d016bc18494f6ea1d213b056d6cbfd6b7b9302e2a7d6af2cc337eb2a05ea4cb
verify docs/assets/mit-cadr-screenshots/enter-error-handler.gif 3 8e21441629778e9b4f0d8a7b156ad045a199090c6e9fe21005ab41da688fd61c
verify docs/assets/mit-cadr-screenshots/enter-emergency-break.gif 5 5f33479b4983b7da32d7f8bdbb1fa336bba1441795504277320c11f7ca25a90a
verify docs/assets/mit-cadr-screenshots/qix-full.gif 180 b3ebd3acc10c044b8ff86c81775f2ebdd7239a3dcfec452d15548bcca844e85a

verify docs/assets/genera-screenshots/open-system-menu.gif 2 a8c4cb479c7b804afa70ac9a33228b774a77dadd9b8032e28ca402258f4ca9ce
verify docs/assets/genera-screenshots/select-editor.gif 3 33aeae918fc2735240cca79c53bb10b327b399771d519ca08011a870c4743939
verify docs/assets/genera-screenshots/open-zmacs-help.gif 2 bc78eaf5d455778df6a8d34ff288d9b381ef5f5175e4789b952b3c5821d5f05d
verify docs/assets/genera-screenshots/open-zmacs-editor-menu.gif 2 c7ac8802ee7cb64a5308cc24c8cedc768a9d194999fc22a410a6b5cceb77ec70
verify docs/assets/genera-screenshots/operate-on-buffer.gif 4 d109f0c0892863ba1c32f5ba6f2fb4da0176bd58d8a415fae1b777d59f721c3d
verify docs/assets/genera-screenshots/prompt-character-style.gif 4 82fce2a6bf04e3bcd91873e1dbdcadff0c6527e4cc63685c6d2d6ed5d36419c4
verify docs/assets/genera-screenshots/select-document-examiner.gif 3 f45801299dd2af736ad433c1fddc4854d594ba6f2a513ebec626fea9bbb3b2da
verify docs/assets/genera-screenshots/enter-debugger.gif 3 f0445943483a8228f5f91e5293f4c545069d289b9e7648767339b5655c1f7c8a
verify docs/assets/genera-screenshots/open-gc-options.gif 4 3284022bb14e2b35a199ed1fb6c8da539e026c18bdfe437edc5fbb1c565bab3a
verify docs/assets/genera-screenshots/macroexpand-and-disassemble.gif 5 310eea1cbbca44d767a7ad32738e494e1ff1c6cb0ced1816dc70ef1288f99a65

test ! -e docs/assets/genera-screenshots/inspect-presentation.gif
test ! -e docs/assets/genera-screenshots/reshape-screen.gif
printf 'verified: no endpoint-only Presentation Inspector or Frame-Up GIF is published\n'

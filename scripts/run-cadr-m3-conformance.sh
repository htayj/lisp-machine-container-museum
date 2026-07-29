#!/bin/sh
# Execute the independent CADR-U01..U05 oracle under each required compiler/opt.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
web="$root/cadr-web"
sources="core/cadr_core.c core/cadr_state_v2.c core/cadr_state_v3.c core/cadr_snapshot.c trace/cadr_trace_engine.c core/usim-port/cadr_processor_memory.c core/usim-port/bus-adaptor.c core/usim-port/bus-interface.c core/usim-port/unibus-mapping.c core/usim-port/diagnostic-interface.c core/usim-port/tv.c core/usim-port/colortv.c core/usim-port/iob.c core/usim-port/disk-controller.c core/usim-port/tape-controller.c core/usim-port/uch11.c"
flags="-std=c11 -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wformat=2 -Iinclude -Icore -Icore/usim-port -Itrace"
cd "$web"
test "$(cc -dumpfullversion)" = 16.1.1
guix shell clang-toolchain -- sh -eu -c 'test "$(clang --version | sed -n "1s/.* \([0-9][0-9.]*\).*/\1/p")" = 21.1.5'
for opt in O0 O2; do
  cc $flags -"$opt" -o "build/cadr-m3-u-gcc-$opt" tests/test_cadr_m3_conformance.c $sources
  "build/cadr-m3-u-gcc-$opt"
  guix shell clang-toolchain -- sh -eu -c "clang $flags -$opt -o build/cadr-m3-u-clang-$opt tests/test_cadr_m3_conformance.c $sources; build/cadr-m3-u-clang-$opt"
done
guix shell node -- node --version | grep -x 'v22.14.0'
guix shell node -- node ../tests/test_cadr_m3_conformance_wasm.mjs

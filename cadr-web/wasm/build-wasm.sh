#!/bin/sh
# Reproducible M3 bare wasm32 build.  This has no WASI or browser imports.
set -eu

usage() {
    echo "usage: $0 [--conformance] [--m4|--m5|--m5-oracle] --opt O0|O2 [OUTPUT]" >&2
    exit 2
}

opt=
mode=core
profile=m3
if test "${1-}" = --conformance; then mode=conformance; shift; fi
if test "${1-}" = --m4; then profile=m4; shift; fi
if test "${1-}" = --m5; then profile=m5; shift; fi
if test "${1-}" = --m5-oracle; then profile=m5-oracle; shift; fi
case ${1-} in
    --opt) opt=${2-}; shift 2 ;;
    *) usage ;;
esac
case "$opt" in O0|O2) ;; *) usage ;; esac
case $# in
    0) out= ;;
    1) out=$1 ;;
    *) usage ;;
esac

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
out=${out:-"$root/build/cadr-web-m3-${opt}.wasm"}
mkdir -p "$(dirname -- "$out")"
out_dir=$(CDPATH= cd -- "$(dirname -- "$out")" && pwd)
out="$out_dir/$(basename -- "$out")"

# This is a build identity check, not a request to mutate the user's Guix
# profile.  M3's output is reviewed only under this exact channel/toolchain.
expected_channel=230aa373f315f247852ee07dff34146e9b480aec
actual_channel=$(guix describe -f channels | sed -n 's/.*"\([0-9a-f]\{40\}\)".*/\1/p' | head -n 1)
test "$actual_channel" = "$expected_channel" || {
    echo "M3 requires Guix channel $expected_channel; found ${actual_channel:-none}" >&2
    exit 1
}

exec guix shell clang-toolchain lld -- sh -eu -c '
  root=$1 out=$2 opt=$3 mode=$4 profile=$5
  cd "$root"
  test "$(clang --version | sed -n "1s/.* \([0-9][0-9.]*\).*/\1/p")" = 21.1.5
  test "$(wasm-ld --version | sed -n "1s/.* \([0-9][0-9.]*\).*/\1/p")" = 21.1.5
  sources="wasm/cadr_wasm_runtime.c wasm/cadr_wasm_adapter.c"
  extra_defines=""
  if test "$profile" = m4; then extra_defines="-DCADR_M4_WASM"; fi
  if test "$profile" = m5; then extra_defines="-DCADR_M5_WASM"; fi
  if test "$profile" = m5-oracle; then extra_defines="-DCADR_M5_WASM -DCADR_M5_ORACLE_TEST"; fi
  if test "$mode" = conformance; then
    sources="wasm/cadr_wasm_runtime.c tests/test_cadr_m3_conformance.c"
    extra_defines="-DCADR_M3_WASM_CONFORMANCE"
  fi
  clang --target=wasm32-unknown-unknown -std=c11 -"$opt" -ffreestanding \
    -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes \
    -Wmissing-prototypes -Wformat=2 -fno-builtin -fno-stack-protector $extra_defines \
    -fno-fast-math -fno-strict-overflow -fvisibility=hidden -nostdinc \
    -Iwasm/include -Iinclude -Icore -Icore/usim-port -Itrace \
    $sources \
    core/cadr_core.c core/cadr_state_v2.c core/cadr_state_v3.c \
    core/cadr_state_v4.c core/cadr_state_v5.c core/cadr_m4_media.c core/cadr_disk_evidence.c \
    core/cadr_snapshot.c \
    trace/cadr_trace_engine.c core/usim-port/cadr_processor_memory.c \
    core/usim-port/bus-adaptor.c core/usim-port/bus-interface.c \
    core/usim-port/unibus-mapping.c core/usim-port/diagnostic-interface.c \
    core/usim-port/tv.c core/usim-port/colortv.c core/usim-port/iob.c \
    core/usim-port/disk-controller.c core/usim-port/tape-controller.c \
    core/usim-port/uch11.c -nostdlib -Wl,--no-entry -Wl,--export-memory \
    -Wl,--initial-memory=134217728 -Wl,--max-memory=134217728 \
    -Wl,-z,stack-size=1048576 \
    -Wl,--gc-sections -Wl,--strip-all -o "$out"
' sh "$root" "$out" "$opt" "$mode" "$profile"

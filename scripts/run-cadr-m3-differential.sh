#!/bin/sh
# C-M3 exact, local-input gate.  It never copies or alters the excluded disk.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
slots=1000000
config=${CADR_M3_CONFIG:-"$root/cadr-web/profiles/cadr-web-303.ini.in"}
prom=${CADR_M3_PROM:-"$root/l/sys/ubin/promh.mcr"}
prom_symbols=${CADR_M3_PROM_SYMBOLS:-"$root/l/sys/ubin/promh.sym"}
ucode_symbols=${CADR_M3_UCODE_SYMBOLS:-"$root/l/sys/ubin/ucadr.sym"}
disk=${CADR_M3_DISK:-"$root/l/usim/disk-sys-303-0.img"}
output="$root/build/cadr-m3-differential"
wasm_transcripts="$output/wasm-O0-1.cadrm3 $output/wasm-O0-2.cadrm3 $output/wasm-O2-1.cadrm3 $output/wasm-O2-2.cadrm3"
native_transcripts="$output/native-gcc-O0.cadrm3 $output/native-gcc-O2.cadrm3 $output/native-clang-O0.cadrm3 $output/native-clang-O2.cadrm3"
wasm_binaries="$output/cadr-web-O0.wasm $output/cadr-web-O2.wasm"
native_binaries="$output/cadr-m3-native-gcc-O0 $output/cadr-m3-native-gcc-O2 $output/cadr-m3-native-clang-O0 $output/cadr-m3-native-clang-O2"

for input in "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk"; do
    test -r "$input" || { echo "C-M3 requires local input: $input" >&2; exit 2; }
done
mkdir -p "$output"
git -C "$root" check-ignore -q -- "build/cadr-m3-differential/" || {
    echo "refusing to write raw M3 transcripts outside an ignored tree" >&2
    exit 1
}
rm -f $wasm_transcripts $native_transcripts
before=$(sha256sum "$disk" | awk '{print $1}')
make -C "$root/cadr-web" build/cadr-headless
"$root/cadr-web/build/cadr-headless" "$config" "$prom" "$prom_symbols" \
    "$ucode_symbols" "$disk" 100000 "$output/m1-boundaries.txt"
python3 "$root/scripts/compare-cadr-web-trace.py" \
    "$root/build/cadr-oracle/m1-identity-final-capture-1/trace.cdrtrc1" \
    "$output/m1-boundaries.txt" \
    --expected-identity-bundle \
      5e31742c67576a291dc071b91673c5e4ef3952edb2a1d9c3081a4f4adbc01390 \
    --expected-profile-sha256 \
      1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a \
    --expected-boundaries 100001
test "$(cc -dumpfullversion)" = 16.1.1
guix shell clang-toolchain -- sh -eu -c 'test "$(clang --version | sed -n "1s/.* \([0-9][0-9.]*\).*/\1/p")" = 21.1.5'
guix shell node -- node --version | grep -x 'v22.14.0'
sources='core/cadr_core.c core/cadr_state_v2.c core/cadr_state_v3.c core/cadr_state_v4.c core/cadr_state_v5.c core/cadr_m4_media.c core/cadr_disk_evidence.c core/cadr_m4_controller_transcript.c core/cadr_snapshot.c trace/cadr_trace_engine.c core/usim-port/cadr_processor_memory.c core/usim-port/bus-adaptor.c core/usim-port/bus-interface.c core/usim-port/unibus-mapping.c core/usim-port/diagnostic-interface.c core/usim-port/tv.c core/usim-port/colortv.c core/usim-port/iob.c core/usim-port/disk-controller.c core/usim-port/tape-controller.c core/usim-port/uch11.c'
flags='-std=c11 -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wformat=2 -DCADR_M3_NATIVE_OBSERVER -Iinclude -Icore -Icore/usim-port -Itrace -Ihost'
native_sources="host/cadr_m3_native.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c $sources"
cd "$root/cadr-web"
for compiler in gcc clang; do for opt in O0 O2; do
    binary="$output/cadr-m3-native-$compiler-$opt"
    if test "$compiler" = gcc; then
        cc $flags -"$opt" -o "$binary" $native_sources
    else
        guix shell clang-toolchain -- sh -eu -c "clang $flags -$opt -o '$binary' $native_sources"
    fi
done; done

for opt in O0 O2; do
    sh "$root/cadr-web/wasm/build-wasm.sh" --opt "$opt" "$output/cadr-web-$opt.wasm"
    for run in 1 2; do
        wasm="$output/wasm-$opt-$run.cadrm3"
        guix shell node -- node "$root/scripts/cadr-m3-wasm-runner.mjs" "$output/cadr-web-$opt.wasm" \
            "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk" "$slots" "$wasm" &
        pids="${pids-} $!"
    done
done
for compiler in gcc clang; do for opt in O0 O2; do
    native="$output/native-$compiler-$opt.cadrm3"
    "$output/cadr-m3-native-$compiler-$opt" "$config" "$prom" "$prom_symbols" \
        "$ucode_symbols" "$disk" "$slots" "$native" &
    pids="${pids-} $!"
done; done
parallel_status=0
for pid in $pids; do
    wait "$pid" || parallel_status=1
done
test "$parallel_status" = 0 || {
    echo "one or more C-M3 transcript producers failed" >&2
    exit 1
}

for opt in O0 O2; do
    cmp "$output/wasm-$opt-1.cadrm3" "$output/wasm-$opt-2.cadrm3"
done
cmp "$output/wasm-O0-1.cadrm3" "$output/wasm-O2-1.cadrm3"
for compiler in gcc clang; do for opt in O0 O2; do
    native="$output/native-$compiler-$opt.cadrm3"
    for wasm_opt in O0 O2; do
        python3 "$root/scripts/compare-cadr-m3-transcripts.py" "$native" "$output/wasm-$wasm_opt-1.cadrm3" --expected-slots "$slots"
    done
done; done
sha256sum $wasm_binaries $native_binaries $wasm_transcripts $native_transcripts
after=$(sha256sum "$disk" | awk '{print $1}')
test "$before" = "$after" || { echo "excluded disk changed during C-M3 gate" >&2; exit 1; }
echo "C-M3 differential gate: all GCC16/Clang21 O0/O2 natives matched both Wasm variants at S0..S$slots; Wasm repeats and disk $before unchanged"

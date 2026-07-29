#!/bin/sh
# M4-D0 exact S0..S1000000 native/worker service schedule gate.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
slots=1000000
config=${CADR_M4_CONFIG:-"$root/cadr-web/profiles/cadr-web-303.ini.in"}
prom=${CADR_M4_PROM:-"$root/l/sys/ubin/promh.mcr"}
prom_symbols=${CADR_M4_PROM_SYMBOLS:-"$root/l/sys/ubin/promh.sym"}
ucode_symbols=${CADR_M4_UCODE_SYMBOLS:-"$root/l/sys/ubin/ucadr.sym"}
disk=${CADR_M4_DISK:-"$root/l/usim/disk-sys-303-0.img"}
output="$root/build/cadr-m4-differential"

for input in "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk"; do
    test -r "$input" || { echo "M4 requires local input: $input" >&2; exit 2; }
done
mkdir -p "$output"
git -C "$root" check-ignore -q -- "build/cadr-m4-differential/" || {
    echo "refusing M4 evidence outside ignored build tree" >&2; exit 1;
}
before=$(sha256sum "$disk" | awk '{print $1}')
make -C "$root/cadr-web" build/cadr-m4-native
sh "$root/cadr-web/wasm/build-wasm.sh" --opt O2 "$output/cadr-web-m4.wasm"
"$root/cadr-web/build/cadr-m4-native" "$config" "$prom" "$prom_symbols" \
    "$ucode_symbols" "$disk" "$slots" "$output/native.cdrm4" &
native_pid=$!
guix shell node -- node "$root/scripts/cadr-m4-wasm-runner.mjs" "$output/cadr-web-m4.wasm" \
    "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk" "$slots" \
    "$output/wasm.cdrm4" &
wasm_pid=$!
wait "$native_pid"
wait "$wasm_pid"
python3 "$root/scripts/compare-cadr-m4-transcripts.py" "$output/native.cdrm4" \
    "$output/wasm.cdrm4" --required-final-boundary "$slots"
after=$(sha256sum "$disk" | awk '{print $1}')
test "$before" = "$after" || { echo "excluded disk changed during M4 gate" >&2; exit 1; }
echo "M4 native/worker transcript and host schedule match through S$slots; disk $before unchanged"

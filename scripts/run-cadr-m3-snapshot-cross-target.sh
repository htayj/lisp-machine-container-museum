#!/bin/sh
# Bidirectional native/Wasm CDRSNAP1 ABI1.2 (D0) continuation gate.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
out="$root/build/cadr-m3-snapshot-cross-target"
mkdir -p "$out"
git -C "$root" check-ignore -q -- "build/cadr-m3-snapshot-cross-target/" || {
    echo "refusing to write raw M3 snapshots outside an ignored tree" >&2
    exit 1
}
config="$root/cadr-web/profiles/cadr-web-303.ini.in"
prom="$root/l/sys/ubin/promh.mcr"
ps="$root/l/sys/ubin/promh.sym"
us="$root/l/sys/ubin/ucadr.sym"
disk="$root/l/usim/disk-sys-303-0.img"
for input in "$config" "$prom" "$ps" "$us" "$disk"; do test -r "$input" || exit 2; done
before=$(sha256sum "$disk" | awk '{print $1}')
guix shell node -- node --version | grep -x 'v22.14.0'
make -C "$root/cadr-web" build/test_cadr_m2_public build/cadr-m3-snapshot-restore
"$root/cadr-web/build/test_cadr_m2_public" --assert-minor0-compatibility
"$root/cadr-web/build/cadr-m3-snapshot" "$config" "$prom" "$ps" "$us" "$disk" 128 1024 "$out/native.cdrsnap1" "$out/native.cadrm3"
python3 "$root/scripts/assert-cadr-m3-snapshot.py" "$out/native.cdrsnap1"
"$root/cadr-web/build/cadr-m3-trace-native" 0 "$out/native.cdrsnap1" 128 \
    "$out/native-full.trace" "$out/native-full.cdrgtrc1"
"$root/cadr-web/build/cadr-m3-trace-native" 1 "$out/native.cdrsnap1" 128 "$out/native-hash.trace"
cmp "$out/native-full.trace" "$out/native-hash.trace"
guix shell node -- node "$root/scripts/cadr-m3-trace-parity.mjs" \
    "$root/cadr-web/build/cadr-web-m3-O0.wasm" "$out/native.cdrsnap1" \
    "$out/wasm.trace" "$out/wasm.cdrgtrc1"
cmp "$out/native-full.trace" "$out/wasm.trace"
python3 "$root/scripts/compare-cadr-general-trace.py" \
    "$out/native-full.cdrgtrc1" "$out/wasm.cdrgtrc1"
guix shell node -- node "$root/scripts/cadr-m3-snapshot-runner.mjs" "$root/cadr-web/build/cadr-web-m3-O0.wasm" "$out/native.cdrsnap1" 1024 "$out/wasm-from-native.cadrm3" "$out/wasm.cdrsnap1"
python3 "$root/scripts/assert-cadr-m3-snapshot.py" "$out/wasm.cdrsnap1"
python3 "$root/scripts/compare-cadr-m3-transcripts.py" "$out/native.cadrm3" "$out/wasm-from-native.cadrm3" --expected-slots 1024
guix shell node -- node "$root/scripts/cadr-m3-snapshot-runner.mjs" "$root/cadr-web/build/cadr-web-m3-O0.wasm" "$out/wasm.cdrsnap1" 1024 "$out/wasm-from-wasm.cadrm3"
"$root/cadr-web/build/cadr-m3-snapshot-restore" "$out/wasm.cdrsnap1" 1024 "$out/native-from-wasm.cadrm3"
python3 "$root/scripts/compare-cadr-m3-transcripts.py" "$out/wasm-from-wasm.cadrm3" "$out/native-from-wasm.cadrm3" --expected-slots 1024
after=$(sha256sum "$disk" | awk '{print $1}')
test "$before" = "$after"
echo "minor0 compatibility and bidirectional ABI1.2/D0 CDRSNAP1 continuations passed; disk $before unchanged"

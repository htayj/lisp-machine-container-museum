#!/bin/sh
# C-M4-BOOT-MEDIA through the source-identified S1029996 terminal,
# with a short post-terminal stability suffix.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
slots=1030044
config=${CADR_M4_CONFIG:-"$root/cadr-web/profiles/cadr-web-303.ini.in"}
prom=${CADR_M4_PROM:-"$root/l/sys/ubin/promh.mcr"}
prom_symbols=${CADR_M4_PROM_SYMBOLS:-"$root/l/sys/ubin/promh.sym"}
ucode_symbols=${CADR_M4_UCODE_SYMBOLS:-"$root/l/sys/ubin/ucadr.sym"}
disk=${CADR_M4_DISK:-"$root/l/usim/disk-sys-303-0.img"}
usim_oracle=${CADR_M4_USIM_ORACLE:-}
output="$root/build/cadr-m4-differential"

for input in "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk"; do
    test -r "$input" || { echo "M4 requires local input: $input" >&2; exit 2; }
done
test -n "$usim_oracle" && test -r "$usim_oracle" || {
    echo "C-M4 requires CADR_M4_USIM_ORACLE pointing to a CDRM4USIM1 witness" >&2
    exit 2
}
mkdir -p "$output"
git -C "$root" check-ignore -q -- "build/cadr-m4-differential/" || {
    echo "refusing M4 evidence outside ignored build tree" >&2; exit 1;
}
before=$(sha256sum "$disk" | awk '{print $1}')
make -C "$root/cadr-web" build/cadr-m4-native
sh "$root/cadr-web/wasm/build-wasm.sh" --opt O2 "$output/cadr-web-m4.wasm"
"$root/cadr-web/build/cadr-m4-native" "$config" "$prom" "$prom_symbols" \
    "$ucode_symbols" "$disk" "$slots" "$output/native.cdrm4" \
    "$output/native.cdrm4media" "$output/native.cdrdiskevid" \
    "$output/native.cdrm3proj" \
    "$output/native.cdrm3bus" "$output/native.cdrm3disk" &
native_pid=$!
wasm_pid=
cleanup_children()
{
    test -z "$native_pid" || kill "$native_pid" 2>/dev/null || true
    test -z "$wasm_pid" || kill "$wasm_pid" 2>/dev/null || true
    test -z "$native_pid" || wait "$native_pid" 2>/dev/null || true
    test -z "$wasm_pid" || wait "$wasm_pid" 2>/dev/null || true
}
trap cleanup_children EXIT
trap 'cleanup_children; exit 130' HUP INT TERM
guix shell node -- node "$root/scripts/cadr-m4-wasm-runner.mjs" "$output/cadr-web-m4.wasm" \
    "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk" "$slots" \
    "$output/wasm.cdrm4" "$output/wasm.cdrm4media" \
    "$output/wasm.cdrdiskevid" &
wasm_pid=$!
set +e
wait "$native_pid"
native_status=$?
native_pid=
wait "$wasm_pid"
wasm_status=$?
wasm_pid=
set -e
if test "$native_status" -ne 0 || test "$wasm_status" -ne 0; then
    after=$(sha256sum "$disk" | awk '{print $1}')
    test "$before" = "$after" || {
        echo "excluded disk changed during failed M4 gate" >&2
        exit 1
    }
    echo "M4 runner failure: native=$native_status wasm=$wasm_status" >&2
    exit 1
fi
trap - EXIT HUP INT TERM
python3 "$root/scripts/compare-cadr-m4-transcripts.py" "$output/native.cdrm4" \
    "$output/wasm.cdrm4" --required-final-boundary "$slots"
"$root/cadr-web/build/cadr-m4-media-compare" \
    "$output/native.cdrm4media" "$output/wasm.cdrm4media"
cmp "$output/native.cdrdiskevid" "$output/wasm.cdrdiskevid"
set -- "$root/scripts/validate-cadr-m4-gate.py" \
    "$output/native.cdrdiskevid" "$output/native.cdrm4media"
set -- "$@" --usim "$usim_oracle"
python3 "$@"
after=$(sha256sum "$disk" | awk '{print $1}')
test "$before" = "$after" || { echo "excluded disk changed during M4 gate" >&2; exit 1; }
echo "M4 native/worker state, media actors, and host schedule match through S$slots; disk $before unchanged"

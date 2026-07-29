#!/bin/sh
# Fail-closed C-M5 native/Wasm differential and repeat gate.
#
# A producer is deliberately supplied by the private test build instead of this
# script.  Its positional interface is:
#   CONFIG PROM PROM-SYMBOLS UCODE-SYMBOLS DISK DUE LAST CDRM5D1-OUTPUT DISK-SHA256
# It must use scheduler events for clock/keyboard/sequence-break and the
# private source-oracle disk/Xbus latch named below.  Keyboard ingress is raw
# 16-bit value 1; the existing IOB path projects that to visible 0x10001.  The
# public ABI must not grow a generic DISK_READY control merely to satisfy this
# gate.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output="$root/build/cadr-m5-differential"
due=500000
last=565536
config=${CADR_M5_CONFIG:-"$root/cadr-web/profiles/cadr-web-303.ini.in"}
prom=${CADR_M5_PROM:-"$root/l/sys/ubin/promh.mcr"}
prom_symbols=${CADR_M5_PROM_SYMBOLS:-"$root/l/sys/ubin/promh.sym"}
ucode_symbols=${CADR_M5_UCODE_SYMBOLS:-"$root/l/sys/ubin/ucadr.sym"}
disk=${CADR_M5_DISK:-"$root/l/usim/disk-sys-303-0.img"}
oracle_capture=${CADR_M5_ORACLE_CAPTURE:-"$root/build/cadr-oracle/m5-earlier-500000-a"}
hook_symbol=${CADR_M5_ORACLE_LATCH_SYMBOL:-cadr_m5_oracle_latch_disk_result}
native_runner=${CADR_M5_NATIVE_RUNNER:-"$output/cadr-m5-native-runner"}
wasm_runner=${CADR_M5_WASM_RUNNER:-"$root/scripts/cadr-m5-wasm-runner.mjs"}

for input in "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk"; do
    test -r "$input" || { echo "C-M5 requires local input: $input" >&2; exit 2; }
done
mkdir -p "$output"
git -C "$root" check-ignore -q -- build/cadr-m5-differential/ || {
    echo "refusing C-M5 evidence outside ignored build tree" >&2; exit 1;
}

# The current public ABI exposes only the three scheduler event kinds.  Require
# the separately named source-oracle latch before running; a normal host
# completion is not equivalent to this selected simultaneous disk/Xbus probe.
rg -q -- "$hook_symbol" "$root/cadr-web/core" "$root/cadr-web/include" \
    "$root/cadr-web/wasm" || {
    echo "C-M5 blocked: missing private $hook_symbol hook. Need the CADR_M5_ORACLE_TEST-only source-oracle latch that sets the existing disk interrupt-result latch and asserts the existing Xbus latch; do not add public DISK_READY." >&2
    exit 2
}
before=$(sha256sum "$disk" | awk '{print $1}')
python3 "$root/scripts/cadr-m5-differential-runner.py" validate-oracle \
    --oracle-capture "$oracle_capture" > "$output/oracle-preflight.json"
cleanup()
{
    after=$(sha256sum "$disk" | awk '{print $1}')
    test "$before" = "$after" || {
        echo "excluded disk changed during C-M5 differential gate" >&2; exit 1;
    }
}
trap cleanup EXIT HUP INT TERM
rm -f "$output/native-a.cdrm5d1" "$output/native-b.cdrm5d1" \
    "$output/wasm-a.cdrm5d1" "$output/wasm-b.cdrm5d1" \
    "$output/native-a.cdrm5d1.cdrm5tr1" "$output/native-b.cdrm5d1.cdrm5tr1" \
    "$output/wasm-a.cdrm5d1.cdrm5tr1" "$output/wasm-b.cdrm5d1.cdrm5tr1" \
    "$output/result.json"
if test -z "${CADR_M5_NATIVE_RUNNER:-}"; then
    cd "$root/cadr-web"
    cc -std=c11 -O2 -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow \
        -Wstrict-prototypes -Wmissing-prototypes -Wformat=2 -DCADR_M5_ORACLE_TEST \
        -Iinclude -Icore -Icore/usim-port -Itrace -Ihost -o "$native_runner" \
        "$root/scripts/cadr-m5-native-runner.c" core/cadr_core.c core/cadr_state_v2.c \
        core/cadr_state_v3.c core/cadr_state_v4.c core/cadr_state_v5.c core/cadr_m4_media.c \
        core/cadr_disk_evidence.c core/cadr_snapshot.c trace/cadr_trace_engine.c \
        core/usim-port/cadr_processor_memory.c core/usim-port/bus-adaptor.c \
        core/usim-port/bus-interface.c core/usim-port/unibus-mapping.c \
        core/usim-port/diagnostic-interface.c core/usim-port/tv.c core/usim-port/colortv.c \
        core/usim-port/iob.c core/usim-port/disk-controller.c core/usim-port/tape-controller.c \
        core/usim-port/uch11.c
fi
test -x "$native_runner" || { echo "C-M5 native producer is not executable: $native_runner" >&2; exit 2; }
test -x "$wasm_runner" || { echo "C-M5 Wasm producer is not executable: $wasm_runner" >&2; exit 2; }
sh "$root/cadr-web/wasm/build-wasm.sh" --m5-oracle --opt O2 "$output/cadr-web-m5-oracle.wasm"
cd "$root"
"$native_runner" "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk" \
    "$due" "$last" "$output/native-a.cdrm5d1" "$before"
python3 "$root/scripts/cadr-m5-transcript.py" validate "$output/native-a.cdrm5d1.cdrm5tr1"
"$native_runner" "$config" "$prom" "$prom_symbols" "$ucode_symbols" "$disk" \
    "$due" "$last" "$output/native-b.cdrm5d1" "$before"
python3 "$root/scripts/cadr-m5-transcript.py" validate "$output/native-b.cdrm5d1.cdrm5tr1"
guix shell node -- node "$wasm_runner" "$output/cadr-web-m5-oracle.wasm" "$config" \
    "$prom" "$prom_symbols" "$ucode_symbols" "$disk" "$due" "$last" \
    "$output/wasm-a.cdrm5d1" "$before"
python3 "$root/scripts/cadr-m5-transcript.py" validate "$output/wasm-a.cdrm5d1.cdrm5tr1"
guix shell node -- node "$wasm_runner" "$output/cadr-web-m5-oracle.wasm" "$config" \
    "$prom" "$prom_symbols" "$ucode_symbols" "$disk" "$due" "$last" \
    "$output/wasm-b.cdrm5d1" "$before"
python3 "$root/scripts/cadr-m5-transcript.py" validate "$output/wasm-b.cdrm5d1.cdrm5tr1"
python3 "$root/scripts/cadr-m5-differential-runner.py" compare \
    --native-a "$output/native-a.cdrm5d1" --native-b "$output/native-b.cdrm5d1" \
    --wasm-a "$output/wasm-a.cdrm5d1" --wasm-b "$output/wasm-b.cdrm5d1" \
    --native-a-transcript "$output/native-a.cdrm5d1.cdrm5tr1" \
    --native-b-transcript "$output/native-b.cdrm5d1.cdrm5tr1" \
    --wasm-a-transcript "$output/wasm-a.cdrm5d1.cdrm5tr1" \
    --wasm-b-transcript "$output/wasm-b.cdrm5d1.cdrm5tr1" \
    --oracle-capture "$oracle_capture" --disk-sha256 "$before" > "$output/result.json"
trap - EXIT HUP INT TERM
cleanup
echo "C-M5 native/Wasm CDRSTATE5 and CDRM5TR1-current agree through S$last; repeats, projected S502997/S505102 clear markers, and base-disk immutability verified"

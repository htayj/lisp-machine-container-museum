#!/bin/sh
# C-M4 native-compiler and Node/Wasm portability evidence; all outputs stay ignored.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
out="$root/build/cadr-m4-portability"
slots=1030044
config=${CADR_M4_CONFIG:-"$root/cadr-web/profiles/cadr-web-303.ini.in"}
prom=${CADR_M4_PROM:-"$root/l/sys/ubin/promh.mcr"}
psym=${CADR_M4_PROM_SYMBOLS:-"$root/l/sys/ubin/promh.sym"}
usym=${CADR_M4_UCODE_SYMBOLS:-"$root/l/sys/ubin/ucadr.sym"}
disk=${CADR_M4_DISK:-"$root/l/usim/disk-sys-303-0.img"}
for f in "$config" "$prom" "$psym" "$usym" "$disk"; do test -r "$f" || exit 2; done
git -C "$root" check-ignore -q -- build/cadr-m4-portability/ || exit 1
rm -rf "$out"
mkdir -p "$out"
preflight="$out/preflight-provenance.json"
provenance="$root/scripts/cadr-m4-portability-provenance.py"
# Freeze every source and input byte before any compiler or producer runs.  The
# preflight file is ignored operational state, never a matrix semantic output.
python3 "$provenance" capture --root "$root" --config "$config" --prom "$prom" \
    --prom-symbols "$psym" --microcode-symbols "$usym" --disk "$disk" \
    --preflight "$preflight"
preflight_sha=$(sha256sum "$preflight" | awk '{print $1}')
before=$(sha256sum "$disk" | awk '{print $1}')
cd "$root/cadr-web"
sources='core/cadr_core.c core/cadr_state_v2.c core/cadr_state_v3.c core/cadr_state_v4.c core/cadr_state_v5.c core/cadr_m4_media.c core/cadr_disk_evidence.c core/cadr_m4_controller_transcript.c core/cadr_snapshot.c trace/cadr_trace_engine.c core/usim-port/cadr_processor_memory.c core/usim-port/bus-adaptor.c core/usim-port/bus-interface.c core/usim-port/unibus-mapping.c core/usim-port/diagnostic-interface.c core/usim-port/tv.c core/usim-port/colortv.c core/usim-port/iob.c core/usim-port/disk-controller.c core/usim-port/tape-controller.c core/usim-port/uch11.c'
host='host/cadr_m4_native.c host/cadr_m4_block_service.c host/cadr_m4_file_range_reader.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c'
flags='-std=c11 -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wformat=2 -DCADR_M3_NATIVE_OBSERVER -Iinclude -Icore -Icore/usim-port -Itrace -Ihost'
for ccname in gcc clang; do for opt in O0 O2; do
 bin="$out/cadr-m4-$ccname-$opt"
 if test "$ccname" = gcc; then guix shell gcc-toolchain -- sh -c "gcc $flags -$opt -o '$bin' $host $sources"; else guix shell clang-toolchain -- sh -c "clang $flags -$opt -o '$bin' $host $sources"; fi
done; done
for opt in O0 O2; do
 sh wasm/build-wasm.sh --opt "$opt" "$out/cadr-m4-$opt.wasm"
done
pids=
cleanup_children()
{
    for pid in $pids; do kill "$pid" 2>/dev/null || true; done
    for pid in $pids; do wait "$pid" 2>/dev/null || true; done
}
trap cleanup_children EXIT
trap 'cleanup_children; exit 130' HUP INT TERM
for ccname in gcc clang; do for opt in O0 O2; do
 "$out/cadr-m4-$ccname-$opt" "$config" "$prom" "$psym" "$usym" \
    "$disk" "$slots" "$out/$ccname-$opt.cdrm4" \
    "$out/$ccname-$opt.media" "$out/$ccname-$opt.evidence" &
 pids="$pids $!"
done; done
for opt in O0 O2; do
 guix shell node -- node "$root/scripts/cadr-m4-wasm-runner.mjs" \
    "$out/cadr-m4-$opt.wasm" "$config" "$prom" "$psym" "$usym" "$disk" \
    "$slots" "$out/wasm-$opt.cdrm4" "$out/wasm-$opt.media" \
    "$out/wasm-$opt.evidence" &
 pids="$pids $!"
done
parallel_status=0
for pid in $pids; do wait "$pid" || parallel_status=1; done
pids=
trap - EXIT HUP INT TERM
after=$(sha256sum "$disk" | awk '{print $1}')
test "$before" = "$after" || {
    echo "excluded disk changed during C-M4 portability gate" >&2
    exit 1
}
test "$parallel_status" = 0 || {
    echo "one or more C-M4 portability producers failed" >&2
    exit 1
}
for f in "$out"/*.cdrm4; do cmp "$out/gcc-O0.cdrm4" "$f"; done
ref="$out/gcc-O0.media"
for f in "$out"/*.media; do cmp "$ref" "$f"; done
for f in "$out"/*.evidence; do cmp "$out/gcc-O0.evidence" "$f"; done
python3 "$root/scripts/validate-cadr-m4-gate.py" "$out/gcc-O0.evidence" "$ref"
gcc_version=$(guix shell gcc-toolchain -- gcc --version | sed -n '1p')
clang_version=$(guix shell clang-toolchain -- clang --version | sed -n '1p')
node_version=$(guix shell node -- node --version)
wasm_clang_version=$(guix shell clang-toolchain lld -- clang --version |
    sed -n '1p')
wasm_ld_version=$(guix shell clang-toolchain lld -- wasm-ld --version |
    sed -n '1p')
chromium_version=$(/usr/bin/chromium --version)
# A release manifest may only name the exact sources and five input artifacts
# frozen before compilation. Rehash them after every producer, comparison,
# validator, and tool probe, immediately before consuming the sealed preflight.
python3 "$provenance" verify --root "$root" --config "$config" --prom "$prom" \
    --prom-symbols "$psym" --microcode-symbols "$usym" --disk "$disk" \
    --preflight "$preflight"
python3 - "$out" "$before" "$after" "$gcc_version" "$clang_version" \
    "$node_version" "$wasm_clang_version" "$wasm_ld_version" \
    "$chromium_version" "$preflight" "$preflight_sha" <<'PY'
import hashlib
import json
import pathlib
import sys

directory = pathlib.Path(sys.argv[1])
preflight = pathlib.Path(sys.argv[10])
preflight_bytes = preflight.read_bytes()
if hashlib.sha256(preflight_bytes).hexdigest() != sys.argv[11]:
    raise SystemExit("verified C-M4 portability preflight record changed")
record = json.loads(preflight_bytes)
artifacts = {}
for path in sorted(directory.iterdir()):
    if path.is_file() and path.name not in {"manifest.json", preflight.name}:
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        artifacts[path.name] = {
            "bytes": path.stat().st_size,
            "sha256": digest.hexdigest(),
        }
manifest = {
    "schema": "cadr-m4-portability",
    "schema_version": 1,
    "preflight_sha256": sys.argv[11],
    "source_state_sha256": record["source_state_sha256"],
    "source_files": record["source_files"],
    "input_artifacts": record["input_artifacts"],
    "selected_boundary": 1030044,
    "disk_sha256_before": sys.argv[2],
    "disk_sha256_after": sys.argv[3],
    "tools": {
        "gcc": sys.argv[4],
        "clang": sys.argv[5],
        "node": sys.argv[6],
        "wasm_clang": sys.argv[7],
        "wasm_ld": sys.argv[8],
        "chromium": sys.argv[9],
    },
    "profiles": ["gcc-O0", "gcc-O2", "clang-O0", "clang-O2",
                 "wasm-O0", "wasm-O2"],
    "semantic_outputs_byte_identical": True,
    "artifacts": artifacts,
}
(directory / "manifest.json").write_text(
    json.dumps(manifest, indent=2, sort_keys=True) + "\n")
PY
python3 "$provenance" verify --root "$root" --config "$config" --prom "$prom" \
    --prom-symbols "$psym" --microcode-symbols "$usym" --disk "$disk" \
    --preflight "$preflight" || {
        rm -f "$out/manifest.json"
        exit 1
    }
echo "C-M4 portability matrix passed; manifest $out/manifest.json"

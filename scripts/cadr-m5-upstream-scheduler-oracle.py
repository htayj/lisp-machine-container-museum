#!/usr/bin/env python3
"""Build and run a disposable maintained-usim M5 scheduler witness.

This is a test-only, explicitly scheduled adapter for the pinned maintained
``usim`` closure.  At one requested outer-slot boundary it applies four
synthetic, already-accepted stimuli in the reconstruction order
``INF-M5-PRE-SLOT-v1``: disk completion, 60 Hz TV/clock, raw keyboard, then
the direct sequence-break request.  The latter is deliberately routed through
the copied ``mfwrite`` INTERRUPT-CONTROL path, which also updates the coupled
LOCATION-COUNTER representation.  It is not a claim that maintained-usim has
this host operation or this arrival order.

The script never alters the prepared closure, configuration, or input disk.
It copies both source and disk below the ignored ``build/cadr-oracle`` tree,
records identities rather than disk bytes, and fails on a changed base disk,
non-exact source anchors, malformed witness framing, or an incomplete event
sequence.  A captured trace is evidence for this named inferred schedule only;
it is deliberately not reported as C-M5 closure.
"""
from __future__ import annotations

import argparse
import configparser
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ALLOWED_OUTPUT = (ROOT / "build" / "cadr-oracle").resolve()
USIM_PIN = "330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d"
SYS_PIN = "4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91"
DEFAULT_POST_SLOTS = 256
DEFAULT_TIMEOUT = 3600


class OracleError(ValueError):
    """The requested schedule does not meet this oracle's evidence boundary."""


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True) + "\n").encode("ascii")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def tree_identity(root: Path) -> str:
    items: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise OracleError("disposable source must not contain symlinks")
        if path.is_file():
            items.append({"path": path.relative_to(root).as_posix(),
                          "bytes": path.stat().st_size,
                          "sha256": sha256_file(path)})
    return hashlib.sha256(canonical_json(items)).hexdigest()


def load_base() -> Any:
    path = ROOT / "scripts" / "cadr-oracle.py"
    spec = importlib.util.spec_from_file_location("cadr_m5_oracle_base", path)
    if spec is None or spec.loader is None:
        raise OracleError("cannot load the mandatory native-oracle helper")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def disk_from_config(config: Path) -> Path:
    parser = configparser.ConfigParser(interpolation=None)
    with config.open(encoding="utf-8") as stream:
        parser.read_file(stream)
    try:
        disk = Path(parser["disk"]["disk0"].split(",", 1)[1])
    except (KeyError, IndexError, configparser.Error) as error:
        raise OracleError("config lacks [disk] disk0 with an absolute image") from error
    if not disk.is_absolute() or disk.is_symlink() or not disk.is_file():
        raise OracleError("disk0 must be an absolute regular non-symlink file")
    return disk


def replace_exact(path: Path, before: str, after: str, name: str) -> None:
    text = path.read_text(encoding="utf-8")
    if text.count(before) != 1:
        raise OracleError(f"{name} anchor is not exact")
    path.write_text(text.replace(before, after), encoding="utf-8")


# Textually appended only to copied source.  It has no general host API and
# accepts no host paths, times, or payload bytes.  The raw format is deliberately
# plain canonical NDJSON so the Python parser can reject deviations exactly.
UCODE_WITNESS = r'''

/* CDRM5USIM1: disposable INF-M5-PRE-SLOT-v1 witness; not maintained-usim API. */
#include <errno.h>
#include <inttypes.h>
#include <stdbool.h>

void cadr_m5_oracle_disk_completion(void);
void cadr_m5_oracle_sequence_break(uint32_t *, uint32_t *, uint32_t *, uint32_t *);
void cadr_m5_oracle_state(uint32_t *, uint32_t *);
void cadr_m5_oracle_conditions(uint64_t *, uint64_t *);
extern void kbd_event(int, int);

struct cadr_m5_snapshot {
    uint32_t interrupt_control;
    uint32_t location_counter;
    uint32_t interrupt_status;
    uint32_t interrupt_pending;
    uint32_t tv_mode;
    uint32_t iob_csr;
    uint32_t keyboard_scancode;
    uint32_t sixty_cycle_clock;
    uint32_t p0_pc;
    uint32_t p1_pc;
    uint32_t next_pc;
    uint64_t interrupt_condition_5_true;
    uint64_t interrupt_condition_6_true;
};

static FILE *cadr_m5_stream;
static uint64_t cadr_m5_due;
static uint64_t cadr_m5_post_slots;
static bool cadr_m5_opened;
static bool cadr_m5_injected;
static bool cadr_m5_finished;
static uint64_t cadr_m5_sequence;
static bool cadr_m5_slot_before_valid;
static struct cadr_m5_snapshot cadr_m5_slot_before;

static uint64_t
cadr_m5_parse_u64(const char *name)
{
    char *end = NULL;
    const char *value = getenv(name);
    unsigned long long parsed;
    if (value == NULL || *value == '\0') errx(1, "CDRM5USIM1 requires %s", name);
    errno = 0;
    parsed = strtoull(value, &end, 10);
    if (errno != 0 || end == value || *end != '\0') errx(1, "invalid %s", name);
    return (uint64_t)parsed;
}

static void
cadr_m5_open(void)
{
    const char *path = getenv("CADR_M5_RAW");
    if (cadr_m5_opened) return;
    if (path == NULL || *path == '\0') errx(1, "CDRM5USIM1 requires CADR_M5_RAW");
    cadr_m5_due = cadr_m5_parse_u64("CADR_M5_DUE_SLOT");
    cadr_m5_post_slots = cadr_m5_parse_u64("CADR_M5_POST_SLOTS");
    if (cadr_m5_post_slots == 0) errx(1, "CDRM5USIM1 post-slot count is zero");
    if (cadr_m5_due > UINT64_MAX - cadr_m5_post_slots)
        errx(1, "CDRM5USIM1 due slot plus post-slot count overflows");
    cadr_m5_stream = fopen(path, "wb");
    if (cadr_m5_stream == NULL) errx(1, "cannot open CDRM5USIM1 stream");
    (void)fprintf(cadr_m5_stream,
        "{\"due_slot\":%" PRIu64 ",\"generation\":1,\"post_slots\":%" PRIu64
        ",\"schedule\":\"INF-M5-PRE-SLOT-v1\",\"schema\":\"CDRM5USIM1\",\"schema_version\":1}\n",
        cadr_m5_due, cadr_m5_post_slots);
    cadr_m5_opened = true;
}

static void
cadr_m5_snapshot(struct cadr_m5_snapshot *state)
{
    cadr_m5_oracle_state(&state->interrupt_control, &state->location_counter);
    tv_control_read(0u, &state->tv_mode);
    state->interrupt_status = (uint32_t)interrupt_status_reg;
    state->interrupt_pending = (uint32_t)interrupt_pending_flag;
    state->iob_csr = iob_csr;
    state->keyboard_scancode = kbd_scancode;
    state->sixty_cycle_clock = (uint32_t)the_60_cycle_clock;
    state->p0_pc = p0_pc;
    state->p1_pc = p1_pc;
    state->next_pc = npc;
    cadr_m5_oracle_conditions(&state->interrupt_condition_5_true,
                              &state->interrupt_condition_6_true);
}

static void
cadr_m5_record(const char *phase, uint32_t kind, uint32_t profile_order,
               uint32_t value, const struct cadr_m5_snapshot *before,
               const struct cadr_m5_snapshot *after)
{
    (void)fprintf(cadr_m5_stream,
        "{\"due_boundary\":%" PRIu64 ",\"flags\":0,\"generation\":1"
        ",\"interrupt_control_after\":%" PRIu32 ",\"interrupt_control_before\":%" PRIu32
        ",\"interrupt_pending_after\":%" PRIu32 ",\"interrupt_pending_before\":%" PRIu32
        ",\"interrupt_status_after\":%" PRIu32 ",\"interrupt_status_before\":%" PRIu32
        ",\"iob_csr_after\":%" PRIu32 ",\"iob_csr_before\":%" PRIu32
        ",\"keyboard_scancode_after\":%" PRIu32 ",\"keyboard_scancode_before\":%" PRIu32
        ",\"kind\":%" PRIu32 ",\"location_counter_after\":%" PRIu32
        ",\"location_counter_before\":%" PRIu32 ",\"machine_cycles\":%" PRIu64
        ",\"micro_pc_after\":%" PRIu32 ",\"micro_pc_before\":%" PRIu32
        ",\"next_micro_pc_after\":%" PRIu32 ",\"next_micro_pc_before\":%" PRIu32
        ",\"p1_micro_pc_after\":%" PRIu32 ",\"p1_micro_pc_before\":%" PRIu32
        ",\"phase\":\"%s\",\"profile_order\":%" PRIu32 ",\"sequence\":%" PRIu64
        ",\"external_interrupt_consumed\":%u,\"sequence_break_consumed\":%u"
        ",\"interrupt_condition_5_true_after\":%" PRIu64
        ",\"interrupt_condition_5_true_before\":%" PRIu64
        ",\"interrupt_condition_6_true_after\":%" PRIu64
        ",\"interrupt_condition_6_true_before\":%" PRIu64
        ",\"external_interrupt_condition_observed\":%u,\"sequence_break_condition_observed\":%u"
        ",\"sixty_cycle_clock_after\":%" PRIu32 ",\"sixty_cycle_clock_before\":%" PRIu32
        ",\"tv_mode_after\":%" PRIu32 ",\"tv_mode_before\":%" PRIu32
        ",\"value\":%" PRIu32 "}\n",
        cadr_m5_due, after->interrupt_control, before->interrupt_control,
        after->interrupt_pending, before->interrupt_pending,
        after->interrupt_status, before->interrupt_status,
        after->iob_csr, before->iob_csr,
        after->keyboard_scancode, before->keyboard_scancode,
        kind, after->location_counter, before->location_counter,
        machine_cycles, after->p0_pc, before->p0_pc, after->next_pc, before->next_pc,
        after->p1_pc, before->p1_pc, phase, profile_order, cadr_m5_sequence++,
        ((before->interrupt_status & 0140000u) != 0u &&
         (after->interrupt_status & 0140000u) == 0u) ? 1u : 0u,
        ((before->interrupt_control & (1u << 26)) != 0u &&
         (after->interrupt_control & (1u << 26)) == 0u) ? 1u : 0u,
        after->interrupt_condition_5_true, before->interrupt_condition_5_true,
        after->interrupt_condition_6_true, before->interrupt_condition_6_true,
        after->interrupt_condition_5_true > before->interrupt_condition_5_true ? 1u : 0u,
        after->interrupt_condition_6_true > before->interrupt_condition_6_true ? 1u : 0u,
        after->sixty_cycle_clock, before->sixty_cycle_clock,
        after->tv_mode, before->tv_mode, value);
    if (ferror(cadr_m5_stream)) errx(1, "cannot write CDRM5USIM1 event");
}

static bool
cadr_m5_before_slot(uint64_t current_slot)
{
    uint32_t tv_mode = 0, ic_before = 0, lc_before = 0, ic_after = 0, lc_after = 0;
    struct cadr_m5_snapshot before, after;
    cadr_m5_open();
    if (!cadr_m5_injected && current_slot == cadr_m5_due) {
        cadr_m5_snapshot(&before);
        cadr_m5_record("before", 0u, 0u, 0u, &before, &before);
        cadr_m5_oracle_disk_completion();
        cadr_m5_snapshot(&after);
        cadr_m5_record("disk-completion", 1u, 1u, 0u, &before, &after);
        before = after;
        tv_control_read(0u, &tv_mode);
        tv_control_write(0u, tv_mode | 010u);
        tv_assert_interrupt();
        the_60_cycle_clock++;
        cadr_m5_snapshot(&after);
        cadr_m5_record("clock", 2u, 2u, 1u, &before, &after);
        before = after;
        iob_csr |= (1u << 2);
        kbd_event(1, 1);
        cadr_m5_snapshot(&after);
        cadr_m5_record("keyboard", 3u, 3u, 0x10001u, &before, &after);
        before = after;
        cadr_m5_oracle_sequence_break(&ic_before, &lc_before, &ic_after, &lc_after);
        cadr_m5_snapshot(&after);
        if (before.interrupt_control != ic_before || before.location_counter != lc_before ||
            after.interrupt_control != ic_after || after.location_counter != lc_after)
            errx(1, "CDRM5USIM1 IC/LC transition observation disagrees");
        cadr_m5_record("sequence-break", 4u, 4u, 1u << 26, &before, &after);
        cadr_m5_injected = true;
    }
    if (cadr_m5_injected && current_slot >= cadr_m5_due &&
        current_slot < cadr_m5_due + cadr_m5_post_slots) {
        cadr_m5_snapshot(&cadr_m5_slot_before);
        cadr_m5_slot_before_valid = true;
    }
    if (cadr_m5_injected && current_slot >= cadr_m5_due + cadr_m5_post_slots)
        return true;
    return false;
}

static void
cadr_m5_after_slot(void)
{
    struct cadr_m5_snapshot after;
    if (cadr_m5_injected && machine_cycles >= cadr_m5_due &&
        machine_cycles < cadr_m5_due + cadr_m5_post_slots) {
        if (!cadr_m5_slot_before_valid)
            errx(1, "CDRM5USIM1 missing pre-slot micro-PC witness");
        cadr_m5_snapshot(&after);
        cadr_m5_record("after-slot", 0u, 5u, 0u, &cadr_m5_slot_before, &after);
        cadr_m5_slot_before_valid = false;
    }
}

static void
cadr_m5_finish(bool halted)
{
    struct cadr_m5_snapshot state;
    if (!cadr_m5_opened || cadr_m5_finished) return;
    cadr_m5_snapshot(&state);
    cadr_m5_record(halted ? "halted" : "stopped", 0u, 6u, 0u, &state, &state);
    if (fflush(cadr_m5_stream) != 0 || fclose(cadr_m5_stream) != 0)
        errx(1, "cannot finalize CDRM5USIM1 stream");
    cadr_m5_stream = NULL;
    cadr_m5_finished = true;
}
'''


UEXEC_WITNESS = r'''

/* CDRM5USIM1 test-only canonical IC/LC transition; not maintained-usim API. */
void
cadr_m5_oracle_state(uint32_t *ic, uint32_t *lc_value)
{
    *ic = interrupt_control;
    *lc_value = lc;
}

void
cadr_m5_oracle_conditions(uint64_t *condition_5_true, uint64_t *condition_6_true)
{
    *condition_5_true = cadr_m5_condition_5_true;
    *condition_6_true = cadr_m5_condition_6_true;
}

void
cadr_m5_oracle_sequence_break(uint32_t *ic_before, uint32_t *lc_before,
                               uint32_t *ic_after, uint32_t *lc_after)
{
    *ic_before = interrupt_control;
    *lc_before = lc;
    /* Exact source-visible SB idiom: IC <- LC OR bit 26, via mfwrite case 2. */
    mfwrite(2u << 5, ((uint64_t)lc) | (UINT64_C(1) << 26));
    *ic_after = interrupt_control;
    *lc_after = lc;
}
'''


DISK_WITNESS = r'''

/* CDRM5USIM1 test-only accepted-completion latch; no disk bytes are read or written. */
void
cadr_m5_oracle_disk_completion(void)
{
    status.interrupt_request = true;
    assert_xbus_interrupt();
}
'''


ORACLE_STUBS = r'''#include "cadr_oracle_native.h"
void cadr_oracle_start(uint64_t x){(void)x;} void cadr_oracle_slot_begin(bool x){(void)x;}
void cadr_oracle_slot_end(bool x){(void)x;} void cadr_oracle_finish(bool x){(void)x;}
void cadr_oracle_write_u32(uint32_t a,uint32_t b,uint32_t c,uint32_t d){(void)a;(void)b;(void)c;(void)d;}
void cadr_oracle_write_u64(uint32_t a,uint32_t b,uint64_t c,uint64_t d){(void)a;(void)b;(void)c;(void)d;}
void cadr_oracle_event_u32(uint32_t a,uint32_t b,uint32_t c,uint32_t d){(void)a;(void)b;(void)c;(void)d;}
void cadr_oracle_main_memory_page_changed(uint32_t x){(void)x;}
void cadr_oracle_external_event(uint32_t a,uint32_t b,const char *c){(void)a;(void)b;(void)c;}
void cadr_oracle_latch_fetched(uint64_t a,uint32_t b,bool c){(void)a;(void)b;(void)c;}
void cadr_oracle_latch_decoded(uint64_t a,uint32_t b,bool c,uint32_t d,uint32_t e,bool f,uint32_t g,uint32_t h)
{(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;(void)g;(void)h;}
void cadr_oracle_latch_inhibited(void){} uint32_t cadr_oracle_alu_behavior(uint32_t a,uint32_t b,uint32_t c){(void)a;(void)b;return c;}
void cadr_oracle_snapshot_begin(uint32_t x){(void)x;} void cadr_oracle_snapshot_u32(uint32_t a,uint32_t b){(void)a;(void)b;}
void cadr_oracle_snapshot_u64(uint32_t a,uint64_t b){(void)a;(void)b;} void cadr_oracle_snapshot_bytes(uint32_t a,const void *b,size_t c){(void)a;(void)b;(void)c;}
void cadr_oracle_snapshot_end(void){} void cadr_oracle_refresh_device_states(void){}
'''


def patch_source(prepared: Path, destination: Path, oracle_slot_limit: int) -> dict[str, str]:
    source = prepared / "source"
    if not source.is_dir() or source.is_symlink():
        raise OracleError("prepared source tree is unavailable or unsafe")
    shutil.copytree(source, destination, symlinks=False)
    ucode = destination / "usim" / "ucode.c"
    uexec = destination / "usim" / "uexec.c"
    disk = destination / "usim" / "disk-controller.c"
    oracle = destination / "usim" / "cadr_oracle_native.c"
    for path in (ucode, uexec, disk, oracle):
        if not path.is_file() or path.is_symlink():
            raise OracleError(f"required maintained-usim source is unavailable: {path.name}")
    replace_exact(ucode, '#include "iob.h"\n',
                  '#include "iob.h"\n#include "kbd.h"\n'
                  'static bool cadr_m5_before_slot(uint64_t);\n'
                  'static void cadr_m5_after_slot(void);\n'
                  'static void cadr_m5_finish(bool);\n',
                  "ucode keyboard header")
    replace_exact(ucode, '        uexec_step();\n',
                  '        if (cadr_m5_before_slot(machine_cycles)) break;\n'
                  '        uexec_step();\n'
                  '        cadr_m5_after_slot();\n',
                  "ucode pre-slot hook")
    replace_exact(uexec, 'uint32_t interrupt_control;\n',
                  'uint32_t interrupt_control;\n'
                  'uint64_t cadr_m5_condition_5_true;\n'
                  'uint64_t cadr_m5_condition_6_true;\n',
                  "uexec condition-counter declarations")
    replace_exact(uexec,
                  'case 5:\n\t\tDEBUG(TRACE_MICROCODE, "jump i|pf\\n");\t/* pgf.or.int */\n\t\treturn (!machine_state.vmaok) | (interrupt_control & (1 << 27) ? interrupt_pending_flag : 0);\n',
                  'case 5:\n\t\tDEBUG(TRACE_MICROCODE, "jump i|pf\\n");\t/* pgf.or.int */\n'
                  '        { int result = (!machine_state.vmaok) | (interrupt_control & (1 << 27) ? interrupt_pending_flag : 0);\n'
                  '          if (result) cadr_m5_condition_5_true++; return result; }\n',
                  "uexec external-interrupt condition marker")
    replace_exact(uexec,
                  'case 6:\n\t\tDEBUG(TRACE_MICROCODE, "jump i|pf|sb\\n");\t/* pgf.or.int.sb */\n\t\treturn (!machine_state.vmaok) | (interrupt_control & (1 << 27) ? interrupt_pending_flag : 0) | (interrupt_control & (1 << 26));\n',
                  'case 6:\n\t\tDEBUG(TRACE_MICROCODE, "jump i|pf|sb\\n");\t/* pgf.or.int.sb */\n'
                  '        { int result = (!machine_state.vmaok) | (interrupt_control & (1 << 27) ? interrupt_pending_flag : 0) | (interrupt_control & (1 << 26));\n'
                  '          if (result) cadr_m5_condition_6_true++; return result; }\n',
                  "uexec sequence-break condition marker")
    replace_exact(ucode, '    const uint64_t oracle_slot_limit = 100000;\n',
                  f'    const uint64_t oracle_slot_limit = {oracle_slot_limit};\n',
                  "ucode oracle ceiling")
    replace_exact(ucode, '    machine_control_performance_report_stop();\n',
                  '    machine_control_performance_report_stop();\n'
                  '    cadr_m5_finish(machine_state.halted);\n',
                  "ucode finalizer")
    ucode.write_text(ucode.read_text(encoding="utf-8") + UCODE_WITNESS,
                     encoding="utf-8")
    uexec.write_text(uexec.read_text(encoding="utf-8") + UEXEC_WITNESS,
                     encoding="utf-8")
    disk.write_text(disk.read_text(encoding="utf-8") + DISK_WITNESS,
                    encoding="utf-8")
    oracle.write_text(ORACLE_STUBS, encoding="utf-8")
    result = {
        "schedule": "INF-M5-PRE-SLOT-v1",
        "oracle_slot_limit": oracle_slot_limit,
        "ucode_witness_sha256": hashlib.sha256(UCODE_WITNESS.encode()).hexdigest(),
        "uexec_witness_sha256": hashlib.sha256(UEXEC_WITNESS.encode()).hexdigest(),
        "disk_witness_sha256": hashlib.sha256(DISK_WITNESS.encode()).hexdigest(),
        "oracle_stubs_sha256": hashlib.sha256(ORACLE_STUBS.encode()).hexdigest(),
        "patched_source_tree_sha256": tree_identity(destination),
    }
    result["patch_sha256"] = hashlib.sha256(canonical_json({
        key: result[key] for key in ("schedule", "oracle_slot_limit",
                                     "ucode_witness_sha256", "uexec_witness_sha256",
                                     "disk_witness_sha256", "oracle_stubs_sha256")
    })).hexdigest()
    return result


def build(source: Path) -> tuple[Path, dict[str, str]]:
    source_path = str(source.resolve())
    template = ("-std=gnu99 -Wall -Wextra -I. -O3 -ggdb3 -DNDEBUG=1 "
                "-ffile-prefix-map=<copied-source>=/usr/src/cadr-m5-scheduler "
                "-fdebug-prefix-map=<copied-source>=/usr/src/cadr-m5-scheduler "
                "-fmacro-prefix-map=<copied-source>=/usr/src/cadr-m5-scheduler")
    cflags = template.replace("<copied-source>", source_path)
    process = subprocess.run(
        ["make", "-f", "Makefile.usim", "USIM_BACKEND=oracle",
         "USIM_BUILD_TYPE=release", "CHAOSDIR=../chaos", f"CFLAGS={cflags}",
         "LDFLAGS=-no-pie -Wl,--build-id=sha1"], cwd=source / "usim",
        env={**os.environ, "SOURCE_DATE_EPOCH": "0"}, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if process.returncode:
        raise OracleError("M5 disposable usim build failed: " + process.stderr[-2400:])
    executable = source / "usim" / "usim"
    if not executable.is_file():
        raise OracleError("M5 disposable build produced no usim executable")
    return executable, {"cflags_template": template,
                        "ldflags": "-no-pie -Wl,--build-id=sha1",
                        "source_date_epoch": "0"}


EVENT_KEYS = {"due_boundary", "flags", "generation", "interrupt_control_after",
              "interrupt_control_before", "interrupt_pending_after",
              "interrupt_pending_before", "interrupt_status_after",
              "interrupt_status_before", "iob_csr_after", "iob_csr_before",
              "keyboard_scancode_after", "keyboard_scancode_before", "kind",
              "location_counter_after", "location_counter_before", "machine_cycles",
              "micro_pc_after", "micro_pc_before", "next_micro_pc_after",
              "next_micro_pc_before", "p1_micro_pc_after", "p1_micro_pc_before",
              "phase", "profile_order", "sequence", "external_interrupt_consumed",
              "sequence_break_consumed", "interrupt_condition_5_true_after",
              "interrupt_condition_5_true_before", "interrupt_condition_6_true_after",
              "interrupt_condition_6_true_before", "external_interrupt_condition_observed",
              "sequence_break_condition_observed", "sixty_cycle_clock_after",
              "sixty_cycle_clock_before", "tv_mode_after", "tv_mode_before", "value"}


def parse_trace(raw: Path, normalized: Path, due: int, post_slots: int) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    with raw.open("r", encoding="ascii", newline="") as stream:
        first = stream.readline()
        if not first.endswith("\n"):
            raise OracleError("M5 raw stream lacks an LF-terminated metadata record")
        metadata = json.loads(first)
        expected_metadata = {"due_slot": due, "generation": 1, "post_slots": post_slots,
                             "schedule": "INF-M5-PRE-SLOT-v1",
                             "schema": "CDRM5USIM1", "schema_version": 1}
        if metadata != expected_metadata:
            raise OracleError("M5 raw stream metadata is not the requested profile")
        for line_number, line in enumerate(stream, 2):
            if not line.endswith("\n"):
                raise OracleError(f"M5 raw stream line {line_number} lacks LF")
            item = json.loads(line)
            if set(item) != EVENT_KEYS or not isinstance(item["phase"], str):
                raise OracleError(f"M5 raw stream line {line_number} has the wrong schema")
            for key, value in item.items():
                if key == "phase":
                    continue
                if (isinstance(value, bool) or not isinstance(value, int) or
                        value < 0 or value > 0xffffffffffffffff):
                    raise OracleError(f"M5 raw stream line {line_number} has invalid {key}")
            if item["sequence"] != len(records):
                raise OracleError("M5 raw stream sequence is not contiguous")
            records.append(item)
    expected_prefix = ["before", "disk-completion", "clock", "keyboard", "sequence-break"]
    if [item["phase"] for item in records[:5]] != expected_prefix:
        raise OracleError("M5 injection order does not equal INF-M5-PRE-SLOT-v1")
    if any(item["machine_cycles"] != due for item in records[:5]):
        raise OracleError("M5 pre-slot event group straddles its requested boundary")
    expected_events = [(0, 0, 0, 0), (1, 1, 0, 0), (2, 2, 0, 1),
                       (3, 3, 0, 0x10001), (4, 4, 0, 1 << 26)]
    observed_events = [(item["kind"], item["profile_order"], item["flags"], item["value"])
                       for item in records[:5]]
    if observed_events != expected_events or any(item["due_boundary"] != due or item["generation"] != 1
                                                 for item in records):
        raise OracleError("M5 canonical event fields disagree with the selected injection profile")
    sequence_break = records[4]
    if not (sequence_break["interrupt_control_after"] & (1 << 26)):
        raise OracleError("M5 direct sequence-break did not set IC bit 26")
    if ((sequence_break["location_counter_after"] >> 26) & 0o17) != ((sequence_break["interrupt_control_after"] >> 26) & 0o17):
        raise OracleError("M5 direct sequence-break did not preserve canonical IC/LC coupling")
    after = [item for item in records if item["phase"] == "after-slot"]
    if len(after) != post_slots or [item["machine_cycles"] for item in after] != list(range(due, due + post_slots)):
        raise OracleError("M5 post-slot witness does not cover the requested contiguous interval")
    if records[-1]["phase"] not in ("stopped", "halted"):
        raise OracleError("M5 raw stream lacks its terminal disposition")
    if any(item["external_interrupt_consumed"] not in (0, 1) or
           item["sequence_break_consumed"] not in (0, 1) or
           item["external_interrupt_condition_observed"] not in (0, 1) or
           item["sequence_break_condition_observed"] not in (0, 1)
           for item in records):
        raise OracleError("M5 interrupt-consumption markers are not Boolean")
    with normalized.open("wb") as target:
        target.write(canonical_json({"due_slot": due, "post_slots": post_slots,
                                     "schedule": "INF-M5-PRE-SLOT-v1",
                                     "schema": "cadr-m5-upstream-scheduler-oracle",
                                     "schema_version": 1}))
        for item in records:
            target.write(canonical_json(item))
    first_after = after[0]
    last_after = after[-1]
    return {"raw_event_count": len(records), "raw_sha256": sha256_file(raw),
            "normalized_sha256": sha256_file(normalized),
            "terminal_phase": records[-1]["phase"],
            "pre_slot_phases": expected_prefix,
            "interrupt_consumption": {
                "external_interrupt_consumed_slots": [item["machine_cycles"] for item in after
                                                       if item["external_interrupt_consumed"]],
                "sequence_break_consumed_slots": [item["machine_cycles"] for item in after
                                                    if item["sequence_break_consumed"]],
                "external_interrupt_condition_slots": [item["machine_cycles"] for item in after
                                                        if item["external_interrupt_condition_observed"]],
                "sequence_break_condition_slots": [item["machine_cycles"] for item in after
                                                     if item["sequence_break_condition_observed"]],
            },
            "terminal_micro_pc": {
                "first_post_slot": {key: first_after[key] for key in (
                    "machine_cycles", "micro_pc_before", "p1_micro_pc_before",
                    "next_micro_pc_before", "micro_pc_after", "p1_micro_pc_after",
                    "next_micro_pc_after")},
                "last_post_slot": {key: last_after[key] for key in (
                    "machine_cycles", "micro_pc_before", "p1_micro_pc_before",
                    "next_micro_pc_before", "micro_pc_after", "p1_micro_pc_after",
                    "next_micro_pc_after")},
            },
            "sequence_break_transition": {
                "interrupt_control_before": sequence_break["interrupt_control_before"],
                "location_counter_before": sequence_break["location_counter_before"],
                "interrupt_control_after": sequence_break["interrupt_control_after"],
                "location_counter_after": sequence_break["location_counter_after"],
            }}


def capture(prepared_value: str, config_value: str, output_value: str,
            due_slot: int, post_slots: int, timeout: int) -> dict[str, Any]:
    base = load_base()
    prepared, marker = base.load_prepare_marker(ROOT, prepared_value)
    closure = marker.get("source_closure")
    if not isinstance(closure, list) or not any(
            entry.get("id") == "usim" and entry.get("expected_source_revision", {}).get("revision") == USIM_PIN
            for entry in closure):
        raise OracleError("prepared source is not pinned to the selected maintained-usim check-in")
    config = (ROOT / config_value).resolve()
    if not config.is_file() or config.is_symlink():
        raise OracleError("config must be a regular repository file")
    disk = disk_from_config(config)
    output = (ROOT / output_value).resolve()
    try:
        output.relative_to(ALLOWED_OUTPUT)
    except ValueError as error:
        raise OracleError("output must be below ignored build/cadr-oracle") from error
    if output == ALLOWED_OUTPUT or output.exists():
        raise OracleError("output must be a new ignored build/cadr-oracle directory")
    base_disk = {"bytes": disk.stat().st_size, "sha256": sha256_file(disk)}
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".m5-scheduler-", dir=output.parent))
    try:
        disk_copy = stage / "disk.img"
        shutil.copyfile(disk, disk_copy)
        copy_before = {"bytes": disk_copy.stat().st_size, "sha256": sha256_file(disk_copy)}
        if copy_before != base_disk:
            raise OracleError("disposable disk does not match the selected base identity")
        runtime_config = stage / "oracle.ini"
        text = config.read_text(encoding="utf-8")
        if text.count(str(disk)) != 1:
            raise OracleError("config must name the selected disk exactly once")
        runtime_config.write_text(text.replace(str(disk), str(disk_copy)), encoding="utf-8")
        source = stage / "source"
        instrumentation = patch_source(prepared, source, due_slot + post_slots)
        executable, build_policy = build(source)
        raw = stage / "scheduler.raw.ndjson"
        process = subprocess.run(
            [str(executable), "-c", str(runtime_config)], cwd=executable.parent,
            env={**os.environ, "LANG": "C", "LC_ALL": "C", "TZ": "UTC",
                 "CADR_M5_RAW": str(raw), "CADR_M5_DUE_SLOT": str(due_slot),
                 "CADR_M5_POST_SLOTS": str(post_slots)}, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=False)
        (stage / "stdout.log").write_text(process.stdout, encoding="utf-8")
        (stage / "stderr.log").write_text(process.stderr, encoding="utf-8")
        if process.returncode:
            raise OracleError(f"M5 disposable usim exited {process.returncode}: {process.stderr[-1200:]}")
        base_after = {"bytes": disk.stat().st_size, "sha256": sha256_file(disk)}
        copy_after = {"bytes": disk_copy.stat().st_size, "sha256": sha256_file(disk_copy)}
        if base_after != base_disk:
            raise OracleError("base disk changed during M5 capture")
        if not raw.is_file():
            raise OracleError("M5 run produced no scheduler witness stream")
        normalized = stage / "scheduler.cdrm5usim1.ndjson"
        events = parse_trace(raw, normalized, due_slot, post_slots)
        input_record = {"due_slot": due_slot, "post_slots": post_slots,
                        "keyboard_scancode": 0x10001,
                        "direct_sequence_break": "mfwrite(IC, LC | (1 << 26))"}
        input_record["sha256"] = hashlib.sha256(canonical_json(input_record)).hexdigest()
        metadata = {
            "schema": "cadr-m5-upstream-scheduler-oracle", "schema_version": 1,
            "capture_status": "instrumented-schedule-captured-not-c-m5-closure",
            "profile": {"maintained_usim_fossil": USIM_PIN,
                        "lm3_system_fossil": SYS_PIN,
                        "schedule": "INF-M5-PRE-SLOT-v1"},
            "prepared": {"path": prepared_value,
                         "prepare_sha256": sha256_file(prepared / "prepare.json"),
                         "profile_sha256": marker.get("profile_sha256")},
            "config": {"sha256": sha256_file(config),
                       "runtime_copy_sha256": sha256_file(runtime_config)},
            "disk": {"base_pre": base_disk, "base_post": base_after,
                     "disposable_copy_pre": copy_before, "disposable_copy_post": copy_after,
                     "bytes_emitted": False},
            "instrumentation": instrumentation, "deterministic_build": build_policy,
            "executable": {"bytes": executable.stat().st_size, "sha256": sha256_file(executable)},
            "input": input_record,
            "raw_event_stream": {"path": raw.name, "bytes": raw.stat().st_size,
                                 "sha256": sha256_file(raw)},
            "normalized_event_stream": {"path": normalized.name,
                                        "bytes": normalized.stat().st_size,
                                        "sha256": sha256_file(normalized)},
            "events": events,
            "closure_blockers": [
                "The disk completion is a source-local test latch, not a replay of an M4 copied completion transaction.",
                "The host-selected pre-slot order is INF-M5-PRE-SLOT-v1, not an observed native asynchronous arrival order.",
                "This witness records injection and bounded machine state only; guest handler consumption and native/Wasm equality require separate gates.",
            ],
        }
        (stage / "capture.json").write_bytes(canonical_json(metadata))
        os.replace(stage, output)
        return metadata
    except subprocess.TimeoutExpired as error:
        raise OracleError(f"M5 probe exceeded {timeout} seconds") from error
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def compare(first_value: str, second_value: str) -> dict[str, Any]:
    def read(value: str) -> tuple[Path, dict[str, Any], bytes]:
        path = (ROOT / value).resolve()
        try:
            path.relative_to(ALLOWED_OUTPUT)
        except ValueError as error:
            raise OracleError("repeat capture path must be below build/cadr-oracle") from error
        capture_path = path / "capture.json"
        normalized = path / "scheduler.cdrm5usim1.ndjson"
        if not capture_path.is_file() or not normalized.is_file():
            raise OracleError("repeat capture lacks capture.json or normalized stream")
        metadata = json.loads(capture_path.read_text(encoding="ascii"))
        return path, metadata, normalized.read_bytes()
    first_path, first, first_bytes = read(first_value)
    second_path, second, second_bytes = read(second_value)
    for key in ("profile", "input", "instrumentation", "deterministic_build"):
        if first.get(key) != second.get(key):
            raise OracleError(f"repeat captures disagree in {key}")
    if first_bytes != second_bytes:
        raise OracleError("repeat normalized scheduler witnesses differ")
    return {"schema": "cadr-m5-upstream-scheduler-repeat", "schema_version": 1,
            "status": "identical-instrumented-witness-not-c-m5-closure",
            "first": first_path.name, "second": second_path.name,
            "normalized_sha256": hashlib.sha256(first_bytes).hexdigest(),
            "normalized_bytes": len(first_bytes)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    capture_parser = commands.add_parser("capture")
    capture_parser.add_argument("--prepared", required=True)
    capture_parser.add_argument("--config", required=True)
    capture_parser.add_argument("--output", required=True)
    capture_parser.add_argument("--due-slot", type=int, required=True)
    capture_parser.add_argument("--post-slots", type=int, default=DEFAULT_POST_SLOTS)
    capture_parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    compare_parser = commands.add_parser("compare")
    compare_parser.add_argument("--first", required=True)
    compare_parser.add_argument("--second", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "capture":
            if args.due_slot < 0 or args.post_slots <= 0 or args.timeout <= 0:
                raise OracleError("due slot must be nonnegative; post slots and timeout must be positive")
            result = capture(args.prepared, args.config, args.output,
                             args.due_slot, args.post_slots, args.timeout)
        else:
            result = compare(args.first, args.second)
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
        return 0
    except (OracleError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"cadr-m5-upstream-scheduler-oracle: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

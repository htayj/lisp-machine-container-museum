#!/usr/bin/env python3
"""Capture the first maintained-usim System 303 disk data transfer.

This is deliberately an event-only reference probe.  It builds a disposable
copy of the already prepared native-oracle source, replaces the native oracle
with no-op linkage stubs (the oracle backend is retained solely to stay
headless), and adds narrow witnesses to its copied disk controller.  It copies
the selected image into its ignored output stage, permits exactly the first
System 303 boot scratch write (unit 0, LBA 1), and rejects any other write.
A transferred block is identified by its LBA and a SHA-256 computed by this
host script after the run; no block bytes are emitted.

The frozen terminal predicate is source-local and exact for the selected
maintained-usim profile: after FIRST-START-0405-v1, the executed micro-PC is
0355 while p1 becomes 0356 and next PC becomes 0357.  The disk completion
events remain separate from this microcode terminal witness.
All raw and normalized evidence remains below the ignored build/cadr-oracle/
tree.  This script does not change the pinned usim checkout or media input.
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
ALLOWED_OUTPUT = ROOT / "build" / "cadr-oracle"
DEFAULT_SLOTS = 20_000_000
BLOCK_BYTES = 1024


class MediaError(ValueError):
    pass


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True) + "\n").encode("ascii")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_identity(root: Path) -> str:
    entries: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise MediaError("disposable source must not retain symlinks")
        if path.is_file():
            entries.append({"path": path.relative_to(root).as_posix(),
                            "bytes": path.stat().st_size,
                            "sha256": sha256_file(path)})
    return hashlib.sha256(canonical_json(entries)).hexdigest()


def load_base() -> Any:
    path = ROOT / "scripts" / "cadr-oracle.py"
    spec = importlib.util.spec_from_file_location("cadr_m4_oracle_base", path)
    if spec is None or spec.loader is None:
        raise MediaError("cannot load the mandatory native-oracle helper")
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
        raise MediaError("config lacks the absolute [disk] disk0 image") from error
    if not disk.is_absolute() or disk.is_symlink() or not disk.is_file():
        raise MediaError("selected disk must be an absolute regular non-symlink file")
    return disk


def replace_exact(path: Path, before: str, after: str, description: str) -> None:
    text = path.read_text(encoding="utf-8")
    if text.count(before) != 1:
        raise MediaError(f"{description} anchor is not exact")
    path.write_text(text.replace(before, after), encoding="utf-8")


ORACLE_STUBS = r'''#include "cadr_oracle_native.h"
void cadr_oracle_start(uint64_t v) {(void)v;}
void cadr_oracle_slot_begin(bool v) {(void)v;}
void cadr_oracle_slot_end(bool v) {(void)v;}
void cadr_oracle_finish(bool v) {(void)v;}
void cadr_oracle_write_u32(uint32_t a,uint32_t b,uint32_t c,uint32_t d)
{(void)a;(void)b;(void)c;(void)d;}
void cadr_oracle_write_u64(uint32_t a,uint32_t b,uint64_t c,uint64_t d)
{(void)a;(void)b;(void)c;(void)d;}
void cadr_oracle_event_u32(uint32_t a,uint32_t b,uint32_t c,uint32_t d)
{(void)a;(void)b;(void)c;(void)d;}
void cadr_oracle_main_memory_page_changed(uint32_t v) {(void)v;}
void cadr_oracle_external_event(uint32_t a,uint32_t b,const char *c)
{(void)a;(void)b;(void)c;}
void cadr_oracle_latch_fetched(uint64_t a,uint32_t b,bool c)
{(void)a;(void)b;(void)c;}
void cadr_oracle_latch_decoded(uint64_t a,uint32_t b,bool c,uint32_t d,
 uint32_t e,bool f,uint32_t g,uint32_t h)
{(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;(void)g;(void)h;}
void cadr_oracle_latch_inhibited(void) {}
uint32_t cadr_oracle_alu_behavior(uint32_t a,uint32_t b,uint32_t c)
{(void)a;(void)b;return c;}
void cadr_oracle_snapshot_begin(uint32_t v) {(void)v;}
void cadr_oracle_snapshot_u32(uint32_t a,uint32_t b) {(void)a;(void)b;}
void cadr_oracle_snapshot_u64(uint32_t a,uint64_t b) {(void)a;(void)b;}
void cadr_oracle_snapshot_bytes(uint32_t a,const void *b,size_t c)
{(void)a;(void)b;(void)c;}
void cadr_oracle_snapshot_end(void) {}
void cadr_oracle_refresh_device_states(void) {}
'''


# This is textually included at the end of the copied disk-controller.c, where
# it can observe the controller's otherwise file-local state without widening
# a maintained-usim public interface.
MEDIA_WITNESS = r'''
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>

static FILE *cadr_m4_media_stream;
static uint64_t cadr_m4_media_cycle = UINT64_MAX;
static uint64_t cadr_m4_media_sequence;
static bool cadr_m4_media_stop;
static uint32_t cadr_m4_media_register_offset;
static uint32_t cadr_m4_media_register_value;
static uint32_t cadr_m4_media_micro_executed;
static uint32_t cadr_m4_media_p1_pc;
static uint32_t cadr_m4_media_next_pc;
static bool cadr_m4_media_first_start_0405;
static bool cadr_m4_media_allowed_write_seen;

static const char *
cadr_m4_media_direction(void)
{
    if (xfer_req.ready)
        return xfer_req.read ? (xfer_req.compare ? "compare" : "read") : "write";
    switch (cmd & 017) {
    case 000: return "read";
    case 010: return "compare";
    case 011: return "write";
    default: return "none";
    }
}

static void
cadr_m4_media_open(void)
{
    const char *path = getenv("CADR_M4_MEDIA_RAW");
    const char *slots = getenv("CADR_M4_MAX_SLOTS");
    if (path == NULL || *path == '\0' || slots == NULL || *slots == '\0')
        errx(1, "CDRM4USIM1 output and slot limit are required");
    cadr_m4_media_stream = fopen(path, "wb");
    if (cadr_m4_media_stream == NULL)
        errx(1, "cannot open CDRM4USIM1 output");
    (void)fprintf(cadr_m4_media_stream,
        "{\"max_post_slot_s\":%s,\"schema\":\"CDRM4USIM1\",\"schema_version\":1}\n", slots);
}

static void
cadr_m4_media_event(const char *action, uint32_t ccw, uint32_t page,
                    uint32_t page_result)
{
    struct disk_unit_s *p = xfer_req.ready ? xfer_req.p : SELECTED_UNIT_PTR();
    if (strcmp(action, "start") == 0 && cmd == 0405)
        cadr_m4_media_first_start_0405 = true;
    if (cadr_m4_media_stream == NULL)
        cadr_m4_media_open();
    if (cadr_m4_media_cycle != machine_cycles) {
        cadr_m4_media_cycle = machine_cycles;
        cadr_m4_media_sequence = 0;
    }
    (void)fprintf(cadr_m4_media_stream,
        "{\"action\":\"%s\",\"ccw\":%" PRIu32
        ",\"clp\":%" PRIu32 ",\"command\":%" PRIu32
        ",\"controller_status\":%" PRIu32
        ",\"cylinder\":%" PRIu32 ",\"da\":%" PRIu32
        ",\"direction\":\"%s\",\"done_interrupt_enable\":%u"
        ",\"head\":%" PRIu32 ",\"intra_slot_sequence\":%" PRIu64
        ",\"lba\":%" PRIu32 ",\"lma\":%" PRIu32
        ",\"page_address\":%" PRIu32 ",\"page_result\":%" PRIu32
        ",\"post_slot_s\":%" PRIu64 ",\"record\":\"media\""
        ",\"register_offset\":%" PRIu32 ",\"register_value\":%" PRIu32
        ",\"micro_executed\":%" PRIu32 ",\"p1_pc\":%" PRIu32
        ",\"next_pc\":%" PRIu32
        ",\"selected_unit\":%" PRIu32
        ",\"xbus_interrupt_status\":%" PRIu32 "}\n",
        action, ccw, clp, cmd, encode_status(),
        xfer_req.ready ? xfer_req.cylinder : p->cylinder, da,
        cadr_m4_media_direction(), done_interrupt_enable ? 1u : 0u,
        xfer_req.ready ? xfer_req.head : p->head, cadr_m4_media_sequence++,
        p->lba, p->last_memory_address, page, page_result,
        machine_cycles + 1u, cadr_m4_media_register_offset,
        cadr_m4_media_register_value, cadr_m4_media_micro_executed,
        cadr_m4_media_p1_pc, cadr_m4_media_next_pc, p->unit,
        (uint32_t)interrupt_status_reg);
    cadr_m4_media_register_offset = 0u;
    cadr_m4_media_register_value = 0u;
    cadr_m4_media_micro_executed = 0u;
    cadr_m4_media_p1_pc = 0u;
    cadr_m4_media_next_pc = 0u;
    if (ferror(cadr_m4_media_stream)) errx(1, "cannot write CDRM4USIM1 event");
}

bool cadr_m4_media_stop_requested(void) { return cadr_m4_media_stop; }

static void
cadr_m4_media_register(const char *action, uint32_t offset, uint32_t value)
{
    cadr_m4_media_register_offset = offset;
    cadr_m4_media_register_value = value;
    cadr_m4_media_event(action, 0u, 0u, 1u);
}

static bool
cadr_m4_media_guard_write(struct disk_unit_s *p, uint32_t ccw, uint32_t page)
{
    if (!cadr_m4_media_allowed_write_seen && p->unit == 0u && p->lba == 1u &&
            (cmd & 017) == 011 && ccw == 0u && page == 0u) {
        cadr_m4_media_allowed_write_seen = true;
        return true;
    }
    cadr_m4_media_event("write-blocked", ccw, page, 0u);
    cadr_m4_media_stop = true;
    return false;
}

void
cadr_m4_media_observe_micro(uint32_t executed, uint32_t p1, uint32_t next)
{
    if (!cadr_m4_media_first_start_0405 || executed != 0355 ||
            p1 != 0356 || next != 0357)
        return;
    cadr_m4_media_micro_executed = executed;
    cadr_m4_media_p1_pc = p1;
    cadr_m4_media_next_pc = next;
    cadr_m4_media_event("terminal-micro-pc", 0u, 0u, 1u);
    cadr_m4_media_stop = true;
}

void
cadr_m4_media_finish(bool halted)
{
    if (cadr_m4_media_stream == NULL) return;
    (void)halted;
    if (fflush(cadr_m4_media_stream) != 0 || fclose(cadr_m4_media_stream) != 0)
        errx(1, "cannot finalize CDRM4USIM1 output");
    cadr_m4_media_stream = NULL;
}
'''


def patch_source(prepared: Path, destination: Path, max_slots: int) -> dict[str, str]:
    source = prepared / "source"
    if not source.is_dir():
        raise MediaError("prepared source tree is unavailable")
    shutil.copytree(source, destination, symlinks=False)
    ucode = destination / "usim" / "ucode.c"
    controller = destination / "usim" / "disk-controller.c"
    oracle = destination / "usim" / "cadr_oracle_native.c"
    oracle.write_text(ORACLE_STUBS, encoding="utf-8")

    declaration_anchor = "// cycles do not reset even with reset\n"
    replace_exact(ucode, declaration_anchor,
                  "bool cadr_m4_media_stop_requested(void);\n"
                  "void cadr_m4_media_observe_micro(uint32_t, uint32_t, uint32_t);\n"
                  "void cadr_m4_media_finish(bool halted);\n\n" + declaration_anchor,
                  "ucode media declaration")
    old_start = """#ifdef WITH_CADR_ORACLE
    const uint64_t oracle_slot_limit = 100000;
    cadr_oracle_start(oracle_slot_limit);
#endif"""
    new_start = """#ifdef WITH_CADR_ORACLE
    const uint64_t oracle_slot_limit = """ + str(max_slots) + """u;
    cadr_oracle_start(oracle_slot_limit);
#endif"""
    replace_exact(ucode, old_start, new_start, "ucode fixed oracle limit")
    replace_exact(ucode, "           && machine_cycles < oracle_slot_limit\n#endif\n          )",
                  "           && machine_cycles < oracle_slot_limit\n"
                  "           && !cadr_m4_media_stop_requested()\n#endif\n          )",
                  "ucode media stop condition")
    replace_exact(ucode, "        uexec_step();\n\n        if (idle_enabled)",
                  "        uexec_step();\n"
                  "        cadr_m4_media_observe_micro(p0_pc, p1_pc, npc);\n\n"
                  "        if (idle_enabled)",
                  "ucode micro-PC terminal witness")
    replace_exact(ucode, "#ifdef WITH_CADR_ORACLE\n    cadr_oracle_finish(machine_state.halted);\n#endif",
                  "#ifdef WITH_CADR_ORACLE\n    cadr_oracle_finish(machine_state.halted);\n"
                  "    cadr_m4_media_finish(machine_state.halted);\n#endif",
                  "ucode media finalization")

    declaration = ("static void cadr_m4_media_event(const char *, uint32_t, uint32_t, uint32_t);\n"
                   "static void cadr_m4_media_register(const char *, uint32_t, uint32_t);\n"
                   "static bool cadr_m4_media_guard_write(struct disk_unit_s *, uint32_t, uint32_t);\n")
    replace_exact(controller, "// implementation may support >8 disks, \n",
                  declaration + "// implementation may support >8 disks, \n",
                  "disk witness declarations")
    changes = (
        ("    status.interrupt_request = true;",
         "    status.interrupt_request = true;\n"
         "    cadr_m4_media_event(\"interrupt-assert\", 0u, 0u, 1u);"),
        ("    deassert_xbus_interrupt();",
         "    deassert_xbus_interrupt();\n"
         "    cadr_m4_media_event(\"interrupt-deassert\", 0u, 0u, 1u);"),
        ("        xfer_req.ready = false;\n\n        set_status_not_active();",
         "        xfer_req.ready = false;\n\n        set_status_not_active();\n"
         "        cadr_m4_media_event(\"transfer-end\", 0u, 0u, 1u);"),
        ("    xfer_req.ready = true;\n\n#ifndef WITH_NONBLOCKING_DISKIO",
         "    xfer_req.ready = true;\n"
         "    cadr_m4_media_event(\"transfer-start\", 0u, 0u, 1u);\n\n"
         "#ifndef WITH_NONBLOCKING_DISKIO"),
        ("        status.ccw_cycle = false;\n\n        const uint32_t paddr",
         "        status.ccw_cycle = false;\n"
         "        cadr_m4_media_event(\"ccw-read\", ccw, 0u, 1u);\n\n"
         "        const uint32_t paddr"),
        ("            if (disk_unit_read(p, buffer))\n            {",
         "            if (disk_unit_read(p, buffer))\n            {\n"
         "                cadr_m4_media_event(\"block-read\", ccw, paddr, 1u);"),
        ("                        p->last_memory_address = paddr + 255;\n\n                        if (memcmp(buffer, buffer_compare, 1024)",
         "                        p->last_memory_address = paddr + 255;\n"
         "                        cadr_m4_media_event(\"page-dma-result\", ccw, paddr, 1u);\n\n"
         "                        if (memcmp(buffer, buffer_compare, 1024)"),
        ("                        p->last_memory_address = paddr + 255;\n                    }\n                    else\n                    {\n                        WARNING(TRACE_DISK, \"disk-controller: read, main_memory_write_page failed",
         "                        p->last_memory_address = paddr + 255;\n"
         "                        cadr_m4_media_event(\"page-dma-result\", ccw, paddr, 1u);\n"
         "                    }\n                    else\n                    {\n"
         "                        cadr_m4_media_event(\"page-dma-result\", ccw, paddr, 0u);\n"
         "                        WARNING(TRACE_DISK, \"disk-controller: read, main_memory_write_page failed"),
        ("                // write to disk\n                if (disk_unit_write(p, buffer))",
         "                // write to disk: only the frozen boot scratch write is allowed.\n"
         "                if (cadr_m4_media_guard_write(p, ccw, paddr) && disk_unit_write(p, buffer))"),
        ("                p->last_memory_address = paddr + 255;\n\n                // write to disk",
         "                p->last_memory_address = paddr + 255;\n"
         "                cadr_m4_media_event(\"page-dma-result\", ccw, paddr, 1u);\n\n"
         "                // write to disk"),
        ("                if (cadr_m4_media_guard_write(p, ccw, paddr) && disk_unit_write(p, buffer))\n                {\n                    // success, write completed",
         "                if (cadr_m4_media_guard_write(p, ccw, paddr) && disk_unit_write(p, buffer))\n"
         "                {\n"
         "                    cadr_m4_media_event(\"block-write\", ccw, paddr, 1u);\n"
         "                    // success, write completed"),
        ("        *pv = 0;\n        return;\n    }\n\tswitch (offset)",
         "        *pv = 0;\n"
         "        cadr_m4_media_register(\"register-read\", offset, *pv);\n"
         "        return;\n    }\n\tswitch (offset)"),
        ("\t}\n}\n\nvoid\ndisk_controller_write",
         "\t}\n"
         "    cadr_m4_media_register(\"register-read\", offset, *pv);\n"
         "}\n\nvoid\ndisk_controller_write"),
        ("void\ndisk_controller_write(uint32_t offset, uint32_t v)\n{\n\tswitch (offset)",
         "void\ndisk_controller_write(uint32_t offset, uint32_t v)\n{\n"
         "    cadr_m4_media_register(\"register-write\", offset, v);\n"
         "\tswitch (offset)"),
        ("static void\nstart(void)\n{\n    idle_disk_activity();",
         "static void\nstart(void)\n{\n    cadr_m4_media_event(\"start\", 0u, 0u, 1u);\n"
         "    idle_disk_activity();"),
    )
    for before, after in changes:
        replace_exact(controller, before, after, "disk-controller media witness")
    controller.write_text(controller.read_text(encoding="utf-8") +
                          "\n" + MEDIA_WITNESS, encoding="utf-8")
    return {"oracle_stubs_sha256": hashlib.sha256(ORACLE_STUBS.encode()).hexdigest(),
            "media_witness_sha256": hashlib.sha256(MEDIA_WITNESS.encode()).hexdigest(),
            "source_tree_sha256": tree_identity(destination)}


def build(source: Path) -> tuple[Path, dict[str, str]]:
    source_path = str(source.resolve())
    common_template = ("-std=gnu99 -Wall -Wextra -I. -O3 -ggdb3 -DNDEBUG=1 "
                       "-ffile-prefix-map=<copied-source>=/usr/src/cadr-m4-media "
                       "-fdebug-prefix-map=<copied-source>=/usr/src/cadr-m4-media "
                       "-fmacro-prefix-map=<copied-source>=/usr/src/cadr-m4-media")
    cflags = common_template.replace("<copied-source>", source_path)
    result = subprocess.run(
        ["make", "-f", "Makefile.usim", "USIM_BACKEND=oracle",
         "USIM_BUILD_TYPE=release", "CHAOSDIR=../chaos", f"CFLAGS={cflags}",
         "LDFLAGS=-no-pie -Wl,--build-id=sha1"], cwd=source / "usim",
        env={**os.environ, "SOURCE_DATE_EPOCH": "0"}, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise MediaError("M4 disposable usim build failed: " + result.stderr[-2000:])
    executable = source / "usim" / "usim"
    return executable, {"cflags_template": common_template,
                        "ldflags": "-no-pie -Wl,--build-id=sha1",
                        "source_date_epoch": "0"}


def parse_events(raw: Path, normalized: Path, disk: Path) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    with raw.open(encoding="ascii", newline="") as stream:
        metadata_line = stream.readline()
        if not metadata_line.endswith("\n"):
            raise MediaError("raw event stream lacks metadata")
        metadata = json.loads(metadata_line)
        if metadata.get("schema") != "CDRM4USIM1" or metadata.get("schema_version") != 1:
            raise MediaError("raw event metadata has the wrong schema")
        for line_number, line in enumerate(stream, 2):
            if not line.endswith("\n"):
                raise MediaError(f"raw event line {line_number} is not LF terminated")
            item = json.loads(line)
            if item.get("record") != "media" or not isinstance(item.get("action"), str):
                raise MediaError(f"raw event line {line_number} is malformed")
            items.append(item)
    previous = (-1, -1)
    for item in items:
        current = (item["post_slot_s"], item["intra_slot_sequence"])
        if current < previous:
            raise MediaError("media witness ordering decreased")
        previous = current
    disk_size = disk.stat().st_size
    with normalized.open("wb") as target:
        target.write(canonical_json({"disk_bytes": disk_size,
                                     "event_only": True,
                                     "schema": "CDRM4USIM1",
                                     "schema_version": 1}))
        for item in items:
            if item["action"] in ("block-read", "block-write"):
                lba = item["lba"]
                offset = lba * BLOCK_BYTES
                if offset + BLOCK_BYTES > disk_size:
                    raise MediaError("block event LBA exceeds the disposable image")
                with disk.open("rb") as source:
                    source.seek(offset)
                    block = source.read(BLOCK_BYTES)
                if len(block) != BLOCK_BYTES:
                    raise MediaError("cannot hash the observed block")
                item = {**item, "media_block_bytes": BLOCK_BYTES,
                        "media_block_sha256": hashlib.sha256(block).hexdigest()}
            target.write(canonical_json(item))
    actions: dict[str, int] = {}
    for item in items:
        actions[item["action"]] = actions.get(item["action"], 0) + 1
    transfer_indices = [i for i, item in enumerate(items)
                        if item["action"] == "transfer-start"]
    terminal_index = next((i for i, item in enumerate(items)
                           if item["action"] == "terminal-micro-pc"), None)
    chains: list[list[dict[str, Any]]] = []
    for ordinal, transfer_index in enumerate(transfer_indices):
        start_index = max((i for i in range(transfer_index + 1)
                           if items[i]["action"] == "start"), default=transfer_index)
        following = (transfer_indices[ordinal + 1] if ordinal + 1 < len(transfer_indices)
                     else (terminal_index + 1 if terminal_index is not None else len(items)))
        chains.append(items[start_index:following])
    transfer_profiles: list[dict[str, Any]] = []
    for chain in chains:
        transfer = next(item for item in chain if item["action"] == "transfer-start")
        block = next(item for item in chain
                     if item["action"] in ("block-read", "block-write", "write-blocked"))
        transfer_profiles.append({
            "direction": transfer["direction"], "command": transfer["command"],
            "clp": transfer["clp"], "da": transfer["da"], "lba": block["lba"],
            "block_action": block["action"], "ccw": block["ccw"],
            "page_address": block["page_address"],
        })
    starts = [item for item in items if item["action"] == "start"]
    status = ("captured" if transfer_indices and terminal_index is not None
              else "slot-limit-before-transfer" if not transfer_indices
              else "transfer-lacks-terminal")
    if actions.get("write-blocked"):
        status = "immutable-write-refused"
    return {"capture_status": status, "raw_event_count": len(items),
            "event_counts": actions, "raw_sha256": sha256_file(raw),
            "normalized_sha256": sha256_file(normalized),
            "transfer_chains": chains,
            "transfer_chain_count": len(chains),
            "transfer_profiles": transfer_profiles,
            "first_start_0405": bool(starts and starts[0]["command"] == 0o405),
            "terminal_event": items[terminal_index] if terminal_index is not None else None}


def capture(prepared_value: str, config_value: str, output_value: str,
            max_slots: int, timeout: int) -> dict[str, Any]:
    base = load_base()
    prepared, marker = base.load_prepare_marker(ROOT, prepared_value)
    config = (ROOT / config_value).resolve()
    if not config.is_file() or config.is_symlink():
        raise MediaError("config must be a regular repository file")
    disk = disk_from_config(config)
    output = (ROOT / output_value).resolve()
    try:
        output.relative_to(ALLOWED_OUTPUT.resolve())
    except ValueError as error:
        raise MediaError("output must be below ignored build/cadr-oracle") from error
    if output == ALLOWED_OUTPUT.resolve() or output.exists():
        raise MediaError("output must be a new ignored directory")
    before = {"bytes": disk.stat().st_size, "sha256": sha256_file(disk)}
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".m4-media-", dir=output.parent))
    try:
        media_copy = stage / "disk.img"
        shutil.copyfile(disk, media_copy)
        copy_before = {"bytes": media_copy.stat().st_size,
                       "sha256": sha256_file(media_copy)}
        if copy_before != before:
            raise MediaError("disposable disk copy does not reproduce the base identity")
        runtime_config = stage / "oracle.ini"
        config_text = config.read_text(encoding="utf-8")
        if config_text.count(str(disk)) != 1:
            raise MediaError("config does not name the selected base image exactly once")
        runtime_config.write_text(config_text.replace(str(disk), str(media_copy)),
                                  encoding="utf-8")
        source = stage / "source"
        instrument = patch_source(prepared, source, max_slots)
        executable, policy = build(source)
        raw = stage / "media.raw.ndjson"
        run = subprocess.run([str(executable), "-c", str(runtime_config)], cwd=executable.parent,
                             env={**os.environ, "LANG": "C", "LC_ALL": "C", "TZ": "UTC",
                                  "CADR_M4_MEDIA_RAW": str(raw),
                                  "CADR_M4_MAX_SLOTS": str(max_slots)},
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                             timeout=timeout, check=False)
        (stage / "stdout.log").write_text(run.stdout, encoding="utf-8")
        (stage / "stderr.log").write_text(run.stderr, encoding="utf-8")
        if run.returncode:
            raise MediaError("M4 disposable usim exited %d: %s" %
                             (run.returncode, run.stderr[-1000:]))
        after = {"bytes": disk.stat().st_size, "sha256": sha256_file(disk)}
        if after != before:
            raise MediaError("immutable base disk changed during M4 capture")
        copy_after = {"bytes": media_copy.stat().st_size,
                      "sha256": sha256_file(media_copy)}
        if not raw.is_file():
            raise MediaError("M4 run produced no disk witness stream")
        normalized = stage / "media.cdrm4usim1.ndjson"
        events = parse_events(raw, normalized, media_copy)
        expected_actions = {
            "transfer-start": 3, "block-write": 1, "block-read": 2,
            "terminal-micro-pc": 1,
        }
        if any(events["event_counts"].get(name, 0) != count
               for name, count in expected_actions.items()) or events["transfer_chain_count"] != 3:
            raise MediaError("frozen M4 media profile did not reach the expected three-transfer terminal")
        expected_transfers = [
            ("write", 0o11, 1, "block-write"),
            ("compare", 0o10, 1, "block-read"),
            ("read", 0o0, 0, "block-read"),
        ]
        observed_transfers = [
            (item["direction"], item["command"], item["lba"], item["block_action"])
            for item in events["transfer_profiles"]]
        terminal = events["terminal_event"]
        if (not events["first_start_0405"] or observed_transfers != expected_transfers or
                terminal is None or
                (terminal["micro_executed"], terminal["p1_pc"], terminal["next_pc"]) !=
                (0o355, 0o356, 0o357) or
                (terminal["command"], terminal["da"], terminal["xbus_interrupt_status"]) !=
                (0, 0, 0)):
            raise MediaError("frozen M4 media terminal/profile witness disagrees")
        metadata = {"schema": "cadr-m4-upstream-media-oracle", "schema_version": 1,
                    "max_post_slot_s": max_slots,
                    "mandatory_100k_oracle": {
                        "prepared": prepared_value,
                        "prepare_sha256": sha256_file(prepared / "prepare.json"),
                        "build_sha256": sha256_file(prepared / "build.json")},
                    "prepared_profile_sha256": marker["profile_sha256"],
                    "config": {"sha256": sha256_file(config),
                               "runtime_copy_config_sha256": sha256_file(runtime_config)},
                    "disk": {"base_pre": before, "base_post": after,
                             "disposable_copy_pre": copy_before,
                             "disposable_copy_post": copy_after,
                             "write_policy": "permit only first unit-0 LBA-1 CCW-0 page-0 write"},
                    "instrumentation": instrument,
                    "deterministic_build": policy,
                    "executable": {"bytes": executable.stat().st_size,
                                   "sha256": sha256_file(executable)},
                    "raw_event_stream": {"path": raw.name, "bytes": raw.stat().st_size,
                                         "sha256": sha256_file(raw)},
                    "normalized_event_stream": {"path": normalized.name,
                                                "bytes": normalized.stat().st_size,
                                                "sha256": sha256_file(normalized)},
                    "terminal_predicate":
                        "after FIRST-START-0405-v1: executed=0355, p1=0356, next=0357",
                    "events": events}
        (stage / "capture.json").write_bytes(canonical_json(metadata))
        os.replace(stage, output)
        return metadata
    except subprocess.TimeoutExpired as error:
        raise MediaError(f"M4 probe exceeded {timeout} seconds") from error
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", nargs="?", default="capture")
    parser.add_argument("--prepared", required=True,
                        help="prepared mandatory 100k oracle under build/cadr-oracle")
    parser.add_argument("--config", required=True, help="repository-relative oracle config")
    parser.add_argument("--output", required=True, help="new ignored build/cadr-oracle directory")
    parser.add_argument("--max-slots", type=int, default=DEFAULT_SLOTS)
    parser.add_argument("--timeout", type=int, default=3600)
    args = parser.parse_args(argv)
    try:
        if args.capture != "capture" or args.max_slots <= 0 or args.timeout <= 0:
            raise MediaError("capture, positive --max-slots, and positive --timeout are required")
        result = capture(args.prepared, args.config, args.output,
                         args.max_slots, args.timeout)
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
        return 0
    except (MediaError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"cadr-m4-upstream-media-oracle: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

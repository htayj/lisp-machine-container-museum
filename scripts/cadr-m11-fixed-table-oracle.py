#!/usr/bin/env python3
"""Independently check C-M11's fixed-table semantic and Wasm artifacts.

``CDRM11FIX1`` is the small, wholly synthetic semantic fixture.  The Python
reference below deliberately constructs its CDRAUD1 records, CDRAUDS1 bytes,
witness chain, and PCM without loading the C model or a Wasm module.  Native
and selected-M12 Wasm output must therefore agree byte-for-byte with a third
implementation, rather than merely agreeing with each other.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import struct
import subprocess
import sys
import tempfile
from typing import Any, NoReturn


ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "cadr-web" / "core" / "cadr_audio_model.c"
ORACLE = ROOT / "cadr-web" / "oracle" / "native" / "cadr_m11_fixed_table_oracle.c"
SCRIPT = Path(__file__).resolve()
MAKEFILE = ROOT / "cadr-web" / "Makefile"
WASM_BUILD = ROOT / "cadr-web" / "wasm" / "build-wasm.sh"

SEMANTIC_SCHEMA = "CDRM11FIX1"
REPORT_SCHEMA = "CDRM11FIX2"
SAMPLE_RATE = 8000
FRAMES_PER_PACKET = 512
SINE32 = (0, 6393, 12539, 18204, 23170, 27245, 30273, 32137,
          32767, 32137, 30273, 27245, 23170, 18204, 12539, 6393,
          0, -6393, -12539, -18204, -23170, -27245, -30273, -32137,
          -32767, -32137, -30273, -27245, -23170, -18204, -12539, -6393)
EXPECTED_SHORT_SAMPLES = [0, 23170, 32767, 23170, 0, -23170, -32767, -23170, 0]
EXPECTED_SHORT_SHA256 = "8184a534d19b4bc250487a11cb896191d3d34837af8c91cd3536af9e9c1d06cb"
EXPECTED_LONG_HASHES = {
    "0..511": "295b2a187b03b4cd96cbbf3f46e189f20e6b0453d4df67bd3b3f10a200ed88dd",
    "200..511": "5468d03d776da739f624a63ce3a85dc8a0d6c1f01838cacf6bda5a51a6f05563",
    "512..1023": "18057f330bac60216ca485aa36eabeaf1343bfa22b55bfe1875eddd895734f38",
    "frame1024": "8f96c15501bef61baf5bd943201979595736b66b6a7e3b35c353729ab8d9a561",
}

# This list is deliberately the M12 branch of wasm/build-wasm.sh, plus the
# headers that the Makefile declares as its C closure.  It is not an inferred
# "M11-only" subset: the selected Wasm module executes the composed M12 build.
WASM_M12_SOURCES = (
    "cadr-web/wasm/cadr_wasm_runtime.c",
    "cadr-web/wasm/cadr_wasm_adapter.c",
    "cadr-web/core/cadr_display.c",
    "cadr-web/core/cadr_audio_model.c",
    "cadr-web/core/cadr_m12_debugger.c",
    "cadr-web/core/cadr_m12_machine_adapter.c",
    "cadr-web/core/cadr_core.c",
    "cadr-web/core/cadr_state_v2.c",
    "cadr-web/core/cadr_state_v3.c",
    "cadr-web/core/cadr_state_v4.c",
    "cadr-web/core/cadr_state_v5.c",
    "cadr-web/core/cadr_m4_media.c",
    "cadr-web/core/cadr_disk_evidence.c",
    "cadr-web/core/cadr_snapshot.c",
    "cadr-web/trace/cadr_trace_engine.c",
    "cadr-web/core/usim-port/cadr_processor_memory.c",
    "cadr-web/core/usim-port/bus-adaptor.c",
    "cadr-web/core/usim-port/bus-interface.c",
    "cadr-web/core/usim-port/unibus-mapping.c",
    "cadr-web/core/usim-port/diagnostic-interface.c",
    "cadr-web/core/usim-port/tv.c",
    "cadr-web/core/usim-port/colortv.c",
    "cadr-web/core/usim-port/iob.c",
    "cadr-web/core/usim-port/disk-controller.c",
    "cadr-web/core/usim-port/tape-controller.c",
    "cadr-web/core/usim-port/uch11.c",
)


WASM_RUNNER = r'''import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const [expectedPath, wasmPath] = process.argv.slice(1);
if (typeof expectedPath !== "string" || typeof wasmPath !== "string") {
  throw new Error("CDRM11FIX1 requires expected report and Wasm paths");
}
const expected = JSON.parse(await readFile(expectedPath, "utf8"));
const wasm = await WebAssembly.compile(await readFile(wasmPath));
const decoder = new TextDecoder();

function fail(message) { throw new Error(`CDRM11FIX1 ${message}`); }
function exact(value, wanted, label) {
  if (JSON.stringify(value) !== JSON.stringify(wanted)) fail(`${label} differs`);
}
function hex(bytes) { return Buffer.from(bytes).toString("hex"); }
function fromHex(value) {
  if (typeof value !== "string" || !/^[0-9a-f]*$/.test(value) || value.length % 2 !== 0) {
    fail("invalid hexadecimal fixture");
  }
  return new Uint8Array(Buffer.from(value, "hex"));
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function u32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) fail(`${label} is not u32`);
  return value;
}
function u64low(value) { return Number(value & 0xffffffffn); }
function u64high(value) { return Number((value >> 32n) & 0xffffffffn); }
function snapshotState(bytes) {
  if (bytes.byteLength < 188 || decoder.decode(bytes.subarray(0, 8)) !== "CDRAUDS1") {
    fail("snapshot is not CDRAUDS1");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== bytes.byteLength) {
    fail("snapshot header differs");
  }
  return Object.freeze({
    headSequence: view.getBigUint64(24, true), nextSequence: view.getBigUint64(32, true),
    queuedFrames: view.getBigUint64(56, true), packetCount: view.getUint32(88, true),
  });
}
function postAck(bytes) {
  const state = snapshotState(bytes);
  return {
    snapshot_cdrauds1_hex: hex(bytes), head_sequence: Number(state.headSequence),
    next_sequence: Number(state.nextSequence), packet_count: state.packetCount,
    queued_frames: Number(state.queuedFrames),
  };
}
function pause(bytes, ackFrames) {
  const state = snapshotState(bytes);
  return {
    ack_frames: ackFrames, snapshot_cdrauds1_hex: hex(bytes),
    head_sequence: Number(state.headSequence), next_sequence: Number(state.nextSequence),
    packet_count: state.packetCount, queued_frames: Number(state.queuedFrames),
  };
}
async function instantiate(snapshotHex) {
  const { exports: e } = await WebAssembly.instantiate(wasm, {});
  if (e.cadr_wasm_create() !== 0) fail("create failed");
  const output = e.cadr_wasm_output_pointer() >>> 0;
  const meta = e.cadr_wasm_meta_pointer() >>> 0;
  const input = e.cadr_wasm_input_reserve(4284) >>> 0;
  if (output === 0 || meta === 0 || input === 0) fail("required M11 transfer buffer missing");
  const bytes = fromHex(snapshotHex);
  new Uint8Array(e.memory.buffer, input, bytes.byteLength).set(bytes);
  if (e.cadr_wasm_m11_audio_snapshot_restore(bytes.byteLength) !== 0) fail("CDRAUDS1 import failed");
  const saved = save(e, input, meta);
  exact(hex(saved), snapshotHex, "CDRAUDS1 import/export");
  return Object.freeze({ e, output, meta, input });
}
function save(e, input, meta) {
  if (e.cadr_wasm_m11_audio_snapshot_save() !== 0) fail("CDRAUDS1 save failed");
  const length = Number(new DataView(e.memory.buffer, meta, 16).getBigUint64(0, true));
  if (length < 188 || length > 4284) fail("CDRAUDS1 save length invalid");
  return new Uint8Array(e.memory.buffer, input, length).slice();
}
function peekRender(instance, wanted) {
  const { e, output, meta } = instance;
  if (e.cadr_wasm_m11_audio_peek() !== 0) fail("audio peek failed");
  const cursor = new Uint8Array(e.memory.buffer, output, 88).slice();
  const view = new DataView(cursor.buffer, cursor.byteOffset, cursor.byteLength);
  const eventHex = hex(cursor.subarray(0, 64));
  const generation = view.getBigUint64(64, true);
  const sequence = view.getBigUint64(72, true);
  const frameOffset = view.getUint32(80, true);
  const frames = view.getUint32(84, true);
  exact(eventHex, wanted.event_hex, "canonical event");
  exact(frameOffset, wanted.frame_offset, "frame offset");
  exact(frames, wanted.frames, "frame count");
  if (e.cadr_wasm_m11_audio_render(u64low(generation), u64high(generation),
      u64low(sequence), u64high(sequence), frameOffset, u32(frames, "frames")) !== 0) {
    fail("audio render failed");
  }
  const rendered = Number(new DataView(e.memory.buffer, meta, 16).getBigUint64(0, true));
  exact(rendered, frames, "rendered frame count");
  const pcm = new Uint8Array(e.memory.buffer, output, rendered * 2).slice();
  const packet = {
    event_hex: eventHex, frame_offset: frameOffset, frames: rendered,
    pcm_s16le_sha256: sha256(pcm),
  };
  exact(packet.pcm_s16le_sha256, wanted.pcm_s16le_sha256, "PCM hash");
  return Object.freeze({ generation, sequence, frameOffset, frames: rendered, pcm, packet });
}
function acknowledge(instance, rendered, frames) {
  const { e } = instance;
  if (e.cadr_wasm_m11_audio_ack(u64low(rendered.generation), u64high(rendered.generation),
      u64low(rendered.sequence), u64high(rendered.sequence), rendered.frameOffset,
      u32(frames, "ack frames")) !== 0) fail("audio acknowledgement failed");
}

const shortExpected = expected.fixtures[0];
const shortInstance = await instantiate(shortExpected.snapshot_cdrauds1_hex);
const shortInitial = save(shortInstance.e, shortInstance.input, shortInstance.meta);
const shortInitialState = snapshotState(shortInitial);
const shortRendered = peekRender(shortInstance, shortExpected.packets[0]);
const shortSamples = [];
for (let index = 0; index < shortRendered.frames; ++index) {
  shortSamples.push(new DataView(shortRendered.pcm.buffer, shortRendered.pcm.byteOffset,
    shortRendered.pcm.byteLength).getInt16(index * 2, true));
}
acknowledge(shortInstance, shortRendered, shortRendered.frames);
const shortPost = save(shortInstance.e, shortInstance.input, shortInstance.meta);
const shortActual = {
  name: shortExpected.name, job: shortExpected.job, snapshot_cdrauds1_hex: hex(shortInitial),
  events_hex: [shortRendered.packet.event_hex], packets: [shortRendered.packet],
  pcm_s16le_samples: shortSamples, head_witness_sha256: hex(shortInitial.subarray(156, 188)),
  final_witness_sha256: hex(shortInitial.subarray(124, 156)), post_ack: postAck(shortPost),
};

const multiExpected = expected.fixtures[1];
const multiStart = await instantiate(multiExpected.initial_snapshot_cdrauds1_hex);
const multiInitial = save(multiStart.e, multiStart.input, multiStart.meta);
const prePause = peekRender(multiStart, multiExpected.pre_pause_packet);
acknowledge(multiStart, prePause, multiExpected.pause.ack_frames);
const paused = save(multiStart.e, multiStart.input, multiStart.meta);
exact(pause(paused, multiExpected.pause.ack_frames), multiExpected.pause, "partial acknowledgement pause state");

const resumed = await instantiate(hex(paused));
const resumedPackets = [];
for (const wanted of multiExpected.resumed_packets) {
  const rendered = peekRender(resumed, wanted);
  resumedPackets.push(rendered.packet);
  acknowledge(resumed, rendered, rendered.frames);
}
const multiPost = save(resumed.e, resumed.input, resumed.meta);
const multiActual = {
  name: multiExpected.name, job: multiExpected.job,
  initial_snapshot_cdrauds1_hex: hex(multiInitial), events_hex: multiExpected.events_hex,
  pre_pause_packet: prePause.packet, pause: pause(paused, multiExpected.pause.ack_frames),
  resumed_packets: resumedPackets, head_witness_sha256: hex(multiInitial.subarray(156, 188)),
  final_witness_sha256: hex(multiInitial.subarray(124, 156)), post_ack: postAck(multiPost),
};

const actual = { schema: "CDRM11FIX1", schema_version: 1,
  identities: expected.identities, fixtures: [shortActual, multiActual] };
process.stdout.write(`${JSON.stringify(actual)}\n`);
'''


class OracleError(RuntimeError):
    """A deliberate CDRM11FIX mismatch or malformed evidence record."""


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_identities() -> dict[str, str]:
    return {
        "core_source_sha256": sha256_file(CORE),
        "oracle_source_sha256": sha256_file(ORACLE),
        "script_source_sha256": sha256_file(SCRIPT),
    }


def canonical_json(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode("ascii") + b"\n"


def run(command: list[str], *, cwd: Path | None = None) -> bytes:
    completed = subprocess.run(command, cwd=cwd, check=False, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE)
    if completed.returncode != 0:
        rendered = shlex.join(command)
        message = completed.stderr.decode("utf-8", "replace").strip()
        raise OracleError(f"command failed ({completed.returncode}): {rendered}\n{message}")
    return completed.stdout


def require_regular(path: Path, label: str) -> None:
    if not path.is_file() or path.is_symlink():
        raise OracleError(f"{label} must be a regular non-symlink file: {path}")


def compiler_command() -> list[str]:
    command = shlex.split(os.environ.get("CC", "cc"))
    if not command:
        raise OracleError("CC must name a compiler")
    return command


def compile_native(destination: Path, optimization: str, identities: dict[str, str]) -> None:
    command = [*compiler_command(), "-std=c11", f"-{optimization}", "-Wall", "-Wextra", "-Werror",
               "-Wpedantic", "-Wconversion", "-Wshadow", "-Wstrict-prototypes",
               "-Wmissing-prototypes", "-Wformat=2", "-I", str(CORE.parent)]
    for macro, value in {
        "CDR_M11_CORE_SHA256": identities["core_source_sha256"],
        "CDR_M11_ORACLE_SHA256": identities["oracle_source_sha256"],
        "CDR_M11_SCRIPT_SHA256": identities["script_source_sha256"],
    }.items():
        command.append(f'-D{macro}="{value}"')
    command.extend(["-o", str(destination), str(ORACLE), str(CORE)])
    run(command, cwd=ROOT)
    require_regular(destination, f"native {optimization} comparator")


def build_selected_wasm(optimization: str) -> Path:
    target = f"build/cadr-web-m12-{optimization}.wasm"
    # A stale ordinary output cannot satisfy C-M11: both variants are rebuilt by
    # the selected build recipe immediately before their identities are recorded.
    run(["make", "-B", "-C", str(ROOT / "cadr-web"), target], cwd=ROOT)
    wasm = ROOT / "cadr-web" / target
    require_regular(wasm, f"selected M12 Wasm {optimization}")
    if wasm.stat().st_size == 0:
        raise OracleError(f"selected M12 Wasm {optimization} is empty")
    return wasm


def run_wasm(expected_report: Path, wasm: Path) -> bytes:
    return run(["guix", "shell", "node", "--", "node", "--input-type=module", "--eval",
                WASM_RUNNER, str(expected_report), str(wasm)], cwd=ROOT)


def le32(value: int) -> bytes:
    return struct.pack("<I", value)


def le64(value: int) -> bytes:
    return struct.pack("<Q", value)


def total_frames(duration_us: int) -> int:
    return (duration_us * SAMPLE_RATE + 999_999) // 1_000_000


def canonical_beep_event(sequence: int, post_slot: int, intra_slot: int, frame_count: int,
                         half_wavelength_us: int, duration_us: int, frame_offset: int) -> bytes:
    """Construct one CDRAUD1-v1 beeper record without calling the C model."""
    return struct.pack("<QQQIIIIIIQII", sequence, 1, post_slot, intra_slot, 1,
                       frame_count, 1, half_wavelength_us, duration_us,
                       frame_offset, 1, 0)


def initial_witness(generation: int) -> bytes:
    return hashlib.sha256(b"CDRAUDW1" + le32(1) + le32(6) + le64(generation)).digest()


def witness_step(previous: bytes, event: bytes) -> bytes:
    return hashlib.sha256(b"CDRAUDW1" + previous + event).digest()


def fixed_sine32_pcm(*, half_wavelength_us: int, event_frame_offset: int,
                     cursor_frame_offset: int, frames: int) -> bytes:
    """Return CDRM11FIX1 PCM under the normative fixed-table phase formula.

    `phase_step = floor((1_000_000 * 2^32) / (2 * half_wavelength_us * 8000))`.
    For rendered index `i`, table index is
    `(((event_frame_offset + cursor_frame_offset + i) mod 2^32) *
      (phase_step mod 2^32) mod 2^32) >> 27`.
    The signed samples are then encoded little-endian int16.  This is a
    clean-room reference for the fixed table, not a claim about host-libm SDL.
    """
    if half_wavelength_us <= 0 or frames < 0:
        raise OracleError("invalid fixed-table reference arguments")
    denominator = half_wavelength_us * 2 * SAMPLE_RATE
    phase_step = (1_000_000 << 32) // denominator
    samples = []
    for index in range(frames):
        frame = (event_frame_offset + cursor_frame_offset + index) & 0xFFFFFFFF
        phase = (frame * (phase_step & 0xFFFFFFFF)) & 0xFFFFFFFF
        samples.append(SINE32[phase >> 27])
    return struct.pack("<" + "h" * len(samples), *samples)


def event_timing(event: bytes) -> tuple[int, int]:
    """Decode the timing fields that the fixed-table renderer must honor."""
    if len(event) != 64:
        raise OracleError("CDRAUD1 event is not 64 bytes")
    half_wavelength_us = int.from_bytes(event[40:44], "little")
    event_frame_offset = int.from_bytes(event[48:56], "little")
    if half_wavelength_us == 0 or event_frame_offset > 0xFFFFFFFF:
        raise OracleError("CDRAUD1 event has invalid fixed-table timing")
    return half_wavelength_us, event_frame_offset


def pcm_from_event(event: bytes, cursor_frame_offset: int, frames: int) -> bytes:
    """Render using timing decoded from canonical event bytes and cursor state."""
    half_wavelength_us, event_frame_offset = event_timing(event)
    return fixed_sine32_pcm(half_wavelength_us=half_wavelength_us,
                            event_frame_offset=event_frame_offset,
                            cursor_frame_offset=cursor_frame_offset, frames=frames)


def zero_offset_mutant_pcm(event: bytes, frames: int) -> bytes:
    """Deliberately broken renderer that erases encoded and cursor offsets."""
    half_wavelength_us, _event_frame_offset = event_timing(event)
    return fixed_sine32_pcm(half_wavelength_us=half_wavelength_us,
                            event_frame_offset=0, cursor_frame_offset=0, frames=frames)


def packet(event: bytes, offset: int, frames: int) -> dict[str, object]:
    pcm = pcm_from_event(event, offset, frames)
    return {
        "event_hex": event.hex(),
        "frame_offset": offset,
        "frames": frames,
        "pcm_s16le_sha256": hashlib.sha256(pcm).hexdigest(),
    }


def snapshot(*, events: list[bytes], post_slot: int, duration_us: int, queued_frames: int,
             head_sequence: int, next_sequence: int, head_frame_offset: int,
             witness: bytes, head_witness: bytes, last_intra_slot: int | None = None,
             have_last: int = 1, slot_open: int = 1) -> bytes:
    """Encode CDRM11FIX1's selected CDRAUDS1 state independently of C."""
    if len(events) > 64 or len(witness) != 32 or len(head_witness) != 32:
        raise OracleError("invalid independent CDRAUDS1 reference state")
    result = bytearray(188 + len(events) * 64)
    result[0:8] = b"CDRAUDS1"
    result[8:12] = le32(1)
    result[12:16] = le32(len(result))
    fields64 = (1, head_sequence, next_sequence, post_slot, post_slot, queued_frames,
                0, 0, 0)
    offset = 16
    for value in fields64:
        result[offset:offset + 8] = le64(value)
        offset += 8
    if last_intra_slot is None:
        last_intra_slot = len(events) - 1 if events else 0
    fields32 = (len(events), head_frame_offset, last_intra_slot,
                have_last, slot_open, 2, 0, 0, 0)
    for value in fields32:
        result[offset:offset + 4] = le32(value)
        offset += 4
    result[offset:offset + 32] = witness
    offset += 32
    result[offset:offset + 32] = head_witness
    offset += 32
    for event in events:
        if len(event) != 64:
            raise OracleError("independent CDRAUD1 record is not 64 bytes")
        result[offset:offset + 64] = event
        offset += 64
    if offset != len(result):
        raise OracleError("independent CDRAUDS1 length calculation failed")
    return bytes(result)


def post_ack_state(snapshot_bytes: bytes) -> dict[str, object]:
    return {
        "snapshot_cdrauds1_hex": snapshot_bytes.hex(),
        "head_sequence": int.from_bytes(snapshot_bytes[24:32], "little"),
        "next_sequence": int.from_bytes(snapshot_bytes[32:40], "little"),
        "packet_count": int.from_bytes(snapshot_bytes[88:92], "little"),
        "queued_frames": int.from_bytes(snapshot_bytes[56:64], "little"),
    }


def reference_job(*, post_slot: int, half_wavelength_us: int,
                  duration_us: int) -> tuple[list[bytes], bytes, bytes]:
    frames = total_frames(duration_us)
    events = []
    offset = 0
    while offset < frames:
        count = min(FRAMES_PER_PACKET, frames - offset)
        events.append(canonical_beep_event(len(events), post_slot, len(events), count,
                                           half_wavelength_us, duration_us, offset))
        offset += count
    head = initial_witness(1)
    final = head
    for event in events:
        final = witness_step(final, event)
    return events, head, final


def build_reference_semantic_report(identities: dict[str, str]) -> dict[str, object]:
    """Return the closed synthetic fixture without invoking native or Wasm code."""
    short_events, short_head, short_final = reference_job(post_slot=1,
                                                           half_wavelength_us=500,
                                                           duration_us=1058)
    short_initial = snapshot(events=short_events, post_slot=1, duration_us=1058,
                             queued_frames=9, head_sequence=0, next_sequence=1,
                             head_frame_offset=0, witness=short_final, head_witness=short_head)
    short_after = snapshot(events=[], post_slot=1, duration_us=1058, queued_frames=0,
                           head_sequence=1, next_sequence=1, head_frame_offset=0,
                           witness=short_final, head_witness=short_final,
                           last_intra_slot=0, have_last=1, slot_open=1)
    short_pcm = pcm_from_event(short_events[0], 0, 9)
    short_samples = list(struct.unpack("<9h", short_pcm))

    multi_events, multi_head, multi_final = reference_job(post_slot=2,
                                                           half_wavelength_us=499,
                                                           duration_us=128125)
    multi_initial = snapshot(events=multi_events, post_slot=2, duration_us=128125,
                             queued_frames=1025, head_sequence=0, next_sequence=3,
                             head_frame_offset=0, witness=multi_final, head_witness=multi_head)
    multi_pause = snapshot(events=multi_events, post_slot=2, duration_us=128125,
                           queued_frames=825, head_sequence=0, next_sequence=3,
                           head_frame_offset=200, witness=multi_final, head_witness=multi_head)
    multi_after = snapshot(events=[], post_slot=2, duration_us=128125, queued_frames=0,
                           head_sequence=3, next_sequence=3, head_frame_offset=0,
                           witness=multi_final, head_witness=multi_final,
                           last_intra_slot=2, have_last=1, slot_open=1)
    multi_pause_record = {
        "ack_frames": 200,
        "snapshot_cdrauds1_hex": multi_pause.hex(),
        "head_sequence": 0,
        "next_sequence": 3,
        "packet_count": 3,
        "queued_frames": 825,
    }
    report = {
        "schema": SEMANTIC_SCHEMA,
        "schema_version": 1,
        "identities": {
            **identities,
            "event_encoding": "CDRAUD1-v1",
            "renderer": "fixed-sine32-q0.15-v1",
            "renderer_profile": "USIM-SDL3-SINE-330D8248-CANONICAL-v1",
            "tool": "cadr-m11-fixed-table-oracle-v1",
        },
        "fixtures": [
            {
                "name": "short-500us-1058us",
                "job": {"post_slot": 1, "half_wavelength_us": 500, "duration_us": 1058},
                "snapshot_cdrauds1_hex": short_initial.hex(),
                "events_hex": [short_events[0].hex()],
                "packets": [packet(short_events[0], 0, 9)],
                "pcm_s16le_samples": short_samples,
                "head_witness_sha256": short_head.hex(),
                "final_witness_sha256": short_final.hex(),
                "post_ack": post_ack_state(short_after),
            },
            {
                "name": "multi-packet-partial-ack-pause",
                "job": {"post_slot": 2, "half_wavelength_us": 499, "duration_us": 128125},
                "initial_snapshot_cdrauds1_hex": multi_initial.hex(),
                "events_hex": [event.hex() for event in multi_events],
                "pre_pause_packet": packet(multi_events[0], 0, 512),
                "pause": multi_pause_record,
                "resumed_packets": [packet(multi_events[0], 200, 312),
                                    packet(multi_events[1], 0, 512),
                                    packet(multi_events[2], 0, 1)],
                "head_witness_sha256": multi_head.hex(),
                "final_witness_sha256": multi_final.hex(),
                "post_ack": post_ack_state(multi_after),
            },
        ],
    }
    # These constants stop a self-consistent but wrong reference renderer from
    # silently ratcheting the long, partial-resume cases.
    if short_samples != EXPECTED_SHORT_SAMPLES or report["fixtures"][0]["packets"][0]["pcm_s16le_sha256"] != EXPECTED_SHORT_SHA256:
        raise OracleError("independent short fixed-table reference changed")
    multi = report["fixtures"][1]
    actual_hashes = {
        "0..511": multi["pre_pause_packet"]["pcm_s16le_sha256"],
        "200..511": multi["resumed_packets"][0]["pcm_s16le_sha256"],
        "512..1023": multi["resumed_packets"][1]["pcm_s16le_sha256"],
        "frame1024": multi["resumed_packets"][2]["pcm_s16le_sha256"],
    }
    if actual_hashes != EXPECTED_LONG_HASHES:
        raise OracleError(f"independent long fixed-table hashes changed: {actual_hashes}")
    resumed_packets = multi["resumed_packets"]
    if not isinstance(resumed_packets, list):
        raise OracleError("independent multi fixture packets are malformed")
    zero_offset_hashes = [
        hashlib.sha256(zero_offset_mutant_pcm(event, int(rendered["frames"]))).hexdigest()
        for event, rendered in zip(multi_events, resumed_packets, strict=True)
    ]
    actual_resumed_hashes = [str(rendered["pcm_s16le_sha256"]) for rendered in resumed_packets]
    if any(actual == mutant for actual, mutant in zip(actual_resumed_hashes, zero_offset_hashes,
                                                       strict=True)):
        raise OracleError("zero-offset mutant unexpectedly matches a resumed packet")
    return report


def no_duplicate_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise OracleError(f"duplicate JSON object key: {key}")
        result[key] = value
    return result


def parse_json_exact(report_bytes: bytes, label: str) -> object:
    if report_bytes.count(b"\n") != 1 or not report_bytes.endswith(b"\n"):
        raise OracleError(f"{label} must end in exactly one newline")
    try:
        value = json.loads(report_bytes, object_pairs_hook=no_duplicate_object)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise OracleError(f"{label} is invalid JSON") from error
    if canonical_json(value) != report_bytes:
        raise OracleError(f"{label} is not canonical JSON with exactly one newline")
    return value


def strict_equal(actual: object, expected: object, label: str) -> None:
    if type(actual) is not type(expected):
        raise OracleError(f"{label} type differs: expected {type(expected).__name__}, got {type(actual).__name__}")
    if isinstance(expected, dict):
        if list(actual) != list(expected):
            raise OracleError(f"{label} keys or key order differ")
        for key in expected:
            strict_equal(actual[key], expected[key], f"{label}.{key}")
    elif isinstance(expected, list):
        if len(actual) != len(expected):
            raise OracleError(f"{label} list length differs")
        for index, (received, wanted) in enumerate(zip(actual, expected, strict=True)):
            strict_equal(received, wanted, f"{label}[{index}]")
    elif actual != expected:
        raise OracleError(f"{label} differs")


def validate_semantic_report_bytes(report_bytes: bytes, identities: dict[str, str]) -> dict[str, object]:
    report = parse_json_exact(report_bytes, SEMANTIC_SCHEMA)
    expected = build_reference_semantic_report(identities)
    strict_equal(report, expected, SEMANTIC_SCHEMA)
    return report  # type: ignore[return-value]


def closure_paths() -> list[Path]:
    root_relative = {
        Path("cadr-web/Makefile"), Path("cadr-web/wasm/build-wasm.sh"),
        Path("cadr-web/wasm/cadr_wasm_adapter.c"), Path("cadr-web/wasm/cadr_wasm_adapter.h"),
        Path("cadr-web/wasm/cadr_wasm_runtime.c"), Path("cadr-web/wasm/cadr_wasm_runtime.h"),
        Path("cadr-web/wasm/cadr_wasm_memory.h"), Path("cadr-web/oracle/native/cadr_m11_fixed_table_oracle.c"),
        Path("scripts/cadr-m11-fixed-table-oracle.py"), *map(Path, WASM_M12_SOURCES),
    }
    # Makefile's CORE_HEADERS is intentionally broad.  Hash all of it and the
    # freestanding standard headers rather than claiming a hand-curated include set.
    for directory in (ROOT / "cadr-web" / "core", ROOT / "cadr-web" / "trace",
                      ROOT / "cadr-web" / "wasm" / "include"):
        for header in directory.rglob("*.h"):
            root_relative.add(header.relative_to(ROOT))
    root_relative.add(Path("cadr-web/include/cadr_host_api.h"))
    paths = sorted(ROOT / item for item in root_relative)
    for path in paths:
        require_regular(path, "executed M12 source closure entry")
    return paths


def file_record(path: Path) -> dict[str, object]:
    require_regular(path, "provenance input")
    return {"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size,
            "sha256": sha256_file(path)}


def first_line(command: list[str], label: str) -> str:
    output = run(command, cwd=ROOT).decode("utf-8", "replace").strip().splitlines()
    if not output or not output[0]:
        raise OracleError(f"{label} produced no version line")
    return output[0]


def build_toolchain_record() -> dict[str, object]:
    channel = run(["guix", "describe", "-f", "json"], cwd=ROOT).decode("utf-8", "replace")
    match = re.search(r'"commit"\s*:\s*"([0-9a-f]{40})"', channel)
    if match is None:
        raise OracleError("cannot identify current Guix channel commit")
    compiler = compiler_command()
    return {
        "build_profile": "cadr-web-m12-wasm32-unknown-unknown",
        "guix_channel_commit": match.group(1),
        "native_compiler": first_line([*compiler, "--version"], "native compiler"),
        "clang": first_line(["guix", "shell", "clang-toolchain", "lld", "--", "clang", "--version"],
                            "clang"),
        "wasm_ld": first_line(["guix", "shell", "clang-toolchain", "lld", "--", "wasm-ld", "--version"],
                              "wasm-ld"),
    }


def build_provenance(native: dict[str, Path], wasm: dict[str, Path]) -> dict[str, object]:
    return {
        "source_closure": [file_record(path) for path in closure_paths()],
        "native_builds": [
            {"variant": variant, "bytes": native[variant].stat().st_size,
             "sha256": sha256_file(native[variant])}
            for variant in ("O0", "O2")
        ],
        "wasm_builds": [file_record(wasm[variant]) | {"variant": variant}
                        for variant in ("O0", "O2")],
        "toolchain": build_toolchain_record(),
    }


def validate_provenance(value: object) -> None:
    if not isinstance(value, dict) or list(value) != ["source_closure", "native_builds", "wasm_builds", "toolchain"]:
        raise OracleError("provenance keys differ")
    closure = value["source_closure"]
    if not isinstance(closure, list) or not closure:
        raise OracleError("provenance source closure is absent")
    previous = ""
    for entry in closure:
        if not isinstance(entry, dict) or list(entry) != ["path", "bytes", "sha256"]:
            raise OracleError("provenance closure entry shape differs")
        if type(entry["path"]) is not str or type(entry["bytes"]) is not int or type(entry["sha256"]) is not str:
            raise OracleError("provenance closure entry types differ")
        if entry["bytes"] <= 0 or not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]) or entry["path"] <= previous:
            raise OracleError("provenance closure entry is invalid")
        previous = entry["path"]
    for key, require_path in (("native_builds", False), ("wasm_builds", True)):
        builds = value[key]
        if not isinstance(builds, list) or len(builds) != 2:
            raise OracleError(f"provenance {key} shape differs")
        for wanted, entry in zip(("O0", "O2"), builds, strict=True):
            keys = ["variant", "bytes", "sha256"] if not require_path else ["path", "bytes", "sha256", "variant"]
            if not isinstance(entry, dict) or list(entry) != keys or type(entry["variant"]) is not str or entry["variant"] != wanted or type(entry["bytes"]) is not int or entry["bytes"] <= 0 or type(entry["sha256"]) is not str or not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]):
                raise OracleError(f"provenance {key} entry differs")
            if require_path and (type(entry["path"]) is not str or not entry["path"].startswith("cadr-web/build/cadr-web-m12-")):
                raise OracleError("Wasm provenance path differs")
    toolchain = value["toolchain"]
    if not isinstance(toolchain, dict) or list(toolchain) != ["build_profile", "guix_channel_commit", "native_compiler", "clang", "wasm_ld"]:
        raise OracleError("provenance toolchain keys differ")
    for key in toolchain:
        if type(toolchain[key]) is not str or not toolchain[key]:
            raise OracleError(f"provenance toolchain {key} type differs")
    if toolchain["build_profile"] != "cadr-web-m12-wasm32-unknown-unknown" or not re.fullmatch(r"[0-9a-f]{40}", toolchain["guix_channel_commit"]):
        raise OracleError("provenance toolchain identity differs")


def validate_report_bytes(report_bytes: bytes, identities: dict[str, str],
                          expected_provenance: dict[str, object] | None = None) -> dict[str, object]:
    report = parse_json_exact(report_bytes, REPORT_SCHEMA)
    if not isinstance(report, dict) or list(report) != ["schema", "schema_version", "semantic_results", "provenance"]:
        raise OracleError("CDRM11FIX2 report keys differ")
    if type(report["schema"]) is not str or report["schema"] != REPORT_SCHEMA or type(report["schema_version"]) is not int or report["schema_version"] != 2:
        raise OracleError("wrong CDRM11FIX2 schema")
    semantic = report["semantic_results"]
    semantic_bytes = canonical_json(semantic)
    validate_semantic_report_bytes(semantic_bytes, identities)
    validate_provenance(report["provenance"])
    if expected_provenance is not None:
        strict_equal(report["provenance"], expected_provenance, "provenance")
    return report


def run_oracle(output: Path | None) -> bytes:
    identities = source_identities()
    reference = build_reference_semantic_report(identities)
    reference_bytes = canonical_json(reference)
    validate_semantic_report_bytes(reference_bytes, identities)
    with tempfile.TemporaryDirectory(prefix="cadr-m11-fixed-table-") as temporary:
        work = Path(temporary)
        expected_path = work / "independent-reference.json"
        expected_path.write_bytes(reference_bytes)
        native: dict[str, Path] = {}
        for optimization in ("O0", "O2"):
            binary = work / f"native-{optimization}"
            compile_native(binary, optimization, identities)
            native_report = run([str(binary)], cwd=ROOT)
            validate_semantic_report_bytes(native_report, identities)
            if native_report != reference_bytes:
                raise OracleError(f"native {optimization} semantic result differs from independent reference")
            native[optimization] = binary
        wasm: dict[str, Path] = {}
        for optimization in ("O0", "O2"):
            selected = build_selected_wasm(optimization)
            wasm_report = run_wasm(expected_path, selected)
            validate_semantic_report_bytes(wasm_report, identities)
            if wasm_report != reference_bytes:
                raise OracleError(f"selected M12 Wasm {optimization} semantic result differs from independent reference")
            wasm[optimization] = selected
        provenance = build_provenance(native, wasm)
        report = {"schema": REPORT_SCHEMA, "schema_version": 2,
                  "semantic_results": reference, "provenance": provenance}
        report_bytes = canonical_json(report)
        validate_report_bytes(report_bytes, identities, provenance)
    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(report_bytes)
    return report_bytes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="write the verified canonical report here")
    arguments = parser.parse_args(argv)
    try:
        report = run_oracle(arguments.output)
    except OracleError as error:
        print(f"cadr-m11-fixed-table-oracle: {error}", file=sys.stderr)
        return 1
    if arguments.output is None:
        sys.stdout.buffer.write(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

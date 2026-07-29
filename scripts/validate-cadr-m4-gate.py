#!/usr/bin/env python3
"""Strict selected-profile validator for C-M4 controller and media witnesses."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from dataclasses import dataclass
from pathlib import Path

EMPTY = hashlib.sha256(b"").digest()
PROFILE = bytes.fromhex(
    "1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a")
ARTIFACTS = bytes.fromhex(
    "e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941")
BASE = bytes.fromhex(
    "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5")
WRITE_PAGE = bytes.fromhex(
    "5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef")
LABEL_PAGE = bytes.fromhex(
    "2002734fa44f32c7f74fc00bdee9f8ef1021a84a073bad86d814e30d7e03dc79")


def sha(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def u64(data: bytes, offset: int) -> int:
    return struct.unpack_from("<Q", data, offset)[0]


def zero(data: bytes, start: int, end: int) -> bool:
    return not any(data[start:end])


@dataclass(frozen=True)
class TupleState:
    lba: int
    generation: int
    request_id: int
    expected: int
    command: int
    clp: int
    da: int
    lma: int
    ccw_address: int
    ccw_index: int
    status: int
    enables: int
    bus_irq: int
    operation: int
    queued: int


@dataclass(frozen=True)
class ControllerEvent:
    sequence: int
    slot: int
    intra: int
    kind: int
    flags: int
    value: int
    detail: int
    first: int
    second: int
    delivered: int
    before: TupleState
    after: TupleState
    descriptor_hash: bytes
    payload_hash: bytes
    delivery_hash: bytes
    page_hash: bytes


def tuple_state(record: bytes, offset: int) -> TupleState:
    values = struct.unpack_from("<QQQQIIIIIIIIIIII", record, offset)
    if values[-1] != 0:
        raise ValueError("nonzero controller-tuple reserved field")
    return TupleState(*values[:-1])


def controller(path: Path) -> tuple[list[ControllerEvent], bytes]:
    data = path.read_bytes()
    if len(data) < 512 or data[:10] != b"CDRM4CTRL1" or data[10:12] != b"\0\0":
        raise ValueError("invalid CDRM4CTRL1 magic")
    if (u32(data, 12), u32(data, 16), u32(data, 20),
            u32(data, 24), u32(data, 28)) != (1, 256, 384, 256, 512):
        raise ValueError("invalid controller schema geometry")
    count = u64(data, 48)
    if count == 0 or count > 512 or len(data) != 512 + count * 384:
        raise ValueError("invalid controller extent")
    if u64(data, 32) != 269562880 or u64(data, 40) != 1030044:
        raise ValueError("wrong selected base or final boundary")
    expected_hashes = (
        PROFILE, ARTIFACTS, BASE,
        sha(b"C-M4-ZERO-TICK-SCHEDULE-v1"),
        sha(b"FIRST-START-0405-v1"),
        sha(b"FIRST-START-0405-v1/EXECUTED-0355-P1-0356-NEXT-0357-v1"),
    )
    for offset, expected in zip(range(64, 256, 32), expected_hashes):
        if data[offset:offset + 32] != expected:
            raise ValueError(f"wrong controller identity at {offset}")
    if not zero(data, 56, 64):
        raise ValueError("nonzero controller header reserved field")

    records = data[256:256 + count * 384]
    events: list[ControllerEvent] = []
    last_slot = -1
    last_intra = 0
    for index in range(count):
        record = records[index * 384:(index + 1) * 384]
        event = ControllerEvent(
            u64(record, 0), u64(record, 8), u32(record, 16),
            u32(record, 20), u32(record, 24), u32(record, 28),
            u32(record, 32), u64(record, 40), u64(record, 48),
            u64(record, 56), tuple_state(record, 64),
            tuple_state(record, 144), record[224:256], record[256:288],
            record[288:320], record[320:352])
        if event.sequence != index or event.kind not in range(1, 10):
            raise ValueError("invalid controller event identity")
        if event.slot > 1029996 or event.slot < last_slot:
            raise ValueError("invalid controller event slot")
        if event.intra != (last_intra + 1 if event.slot == last_slot else 0):
            raise ValueError("invalid intra-slot sequence")
        if not zero(record, 36, 40) or not zero(record, 352, 384):
            raise ValueError("nonzero controller record reserved bytes")
        last_slot, last_intra = event.slot, event.intra
        events.append(event)

    footer = data[256 + count * 384:]
    if footer[:9] != b"CDRM4END1" or not zero(footer, 9, 12):
        raise ValueError("invalid controller footer magic")
    if u32(footer, 12) != 1 or (
        u64(footer, 16), u64(footer, 24), u64(footer, 32),
        u64(footer, 40), u64(footer, 48), u64(footer, 56),
        u64(footer, 64), u64(footer, 72)
    ) != (count, 1030044, 1029996, 0o355, 0o356, 0o357, 0, 0x1F):
        raise ValueError("controller footer predicate mismatch")
    if footer[128:160] != sha(records) or footer[160:192] != sha(data[:-256]):
        raise ValueError("controller chain hash mismatch")
    if footer[192:224] != sha(records[-384 + 144:-384 + 224]):
        raise ValueError("final controller tuple hash mismatch")
    if not zero(footer, 80, 96) or not zero(footer, 224, 256):
        raise ValueError("nonzero controller footer reserved bytes")
    return events, footer[96:128]


@dataclass(frozen=True)
class MediaTurn:
    ordinal: int
    actor: int
    disposition: int
    operation: int
    status: int
    generation: int
    request_id: int
    descriptor_hash: bytes
    payload_hash: bytes
    page_hash: bytes
    overlay_generation: int
    overlay_root: bytes
    state_hash: bytes


def media(path: Path) -> list[MediaTurn]:
    data = path.read_bytes()
    if len(data) < 64 or data[:11] != b"CDRM4MEDIA1" or data[11] != 0:
        raise ValueError("invalid CDRM4MEDIA1 magic")
    if u32(data, 12) != 1 or u64(data, 16) != 269562880 or data[24:56] != BASE:
        raise ValueError("wrong media identity")
    if not zero(data, 56, 64) or (len(data) - 64) % 352:
        raise ValueError("invalid media extent")
    turns = []
    for index in range((len(data) - 64) // 352):
        record = data[64 + index * 352:64 + (index + 1) * 352]
        turn = MediaTurn(
            u64(record, 0), u32(record, 8), u32(record, 12),
            u32(record, 16), u32(record, 20), u64(record, 32),
            u64(record, 40), record[144:176], record[176:208],
            record[208:240], u64(record, 240), record[248:280],
            record[280:312])
        if turn.ordinal != index or not zero(record, 312, 352):
            raise ValueError("noncanonical media turn")
        turns.append(turn)
    if len(turns) != 13 or turns[-1].actor != 5:
        raise ValueError("wrong selected media actor count")
    return turns


def selected_profile(events: list[ControllerEvent], turns: list[MediaTurn],
                     controller_state_hash: bytes) -> None:
    if turns[-1].state_hash != controller_state_hash:
        raise ValueError("final CDRSTATE4 disagreement")
    starts = [event for event in events if event.kind == 2 and
              event.first == 3 and event.value == 0 and
              event.before.command == 0o405]
    if not starts:
        raise ValueError("FIRST-START-0405 missing")
    requests = [event for event in events if event.kind == 4]
    deliveries = [event for event in events if event.kind == 5]
    applications = [event for event in events if event.kind == 6]
    pages = [event for event in events if event.kind == 7]
    expected = [(0o11, 1, 2, 1), (0o10, 1, 1, 2), (0, 0, 1, 3)]
    for name, group in (("request", requests), ("delivery", deliveries),
                        ("application", applications)):
        observed = [(event.after.command, event.after.lba,
                     event.after.operation, event.after.request_id)
                    for event in group]
        if observed != expected:
            raise ValueError(f"wrong selected {name} chain: {observed}")
    if [(event.flags, event.after.command, event.after.lba, event.page_hash)
            for event in pages] != [
                (1, 0o11, 1, WRITE_PAGE),
                (0, 0o10, 1, WRITE_PAGE),
                (0, 0, 0, LABEL_PAGE)]:
        raise ValueError("wrong selected page-transfer chain")
    interrupts = [event for event in events if event.kind == 9]
    if [(event.slot, event.flags, event.before.bus_irq,
         event.after.bus_irq) for event in interrupts] != [
            (505103, 0, 0, 0),
            (505222, 0, 0, 0),
            (1029639, 0, 0, 0),
            (1029756, 0, 0, 0)]:
        raise ValueError("wrong selected interrupt transition sequence")
    states = [event for event in events if event.kind == 8]
    if [(event.slot, event.intra, event.flags, event.value, event.detail,
         event.after.command, event.before.status, event.after.status,
         event.after.da) for event in states] != [
            (505199, 0, 1, 0, 0, 0o405, 1, 0, 0),
            (505199, 1, 0, 1, 0, 0o405, 0, 1, 0),
            (505199, 2, 1, 0, 0, 0o405, 1, 0, 0),
            (505199, 3, 0, 1, 0, 0o405, 0, 1, 0),
            (505318, 0, 1, 0, 0, 0o10001005, 1, 0, 0),
            (505318, 1, 0, 1, 0, 0o10001005, 0, 1, 0),
            (505318, 2, 1, 0, 0, 0o10001005, 1, 0, 0),
            (505318, 3, 0, 7, 0, 0o10001005, 0, 7, 0),
            (1029735, 0, 1, 6, 1, 0o11, 7, 6, 1),
            (1029736, 2, 0, 7, 1, 0o11, 6, 7, 1),
            (1029852, 0, 1, 6, 1, 0o10, 7, 6, 1),
            (1029853, 3, 0, 7, 1, 0o10, 6, 7, 1),
            (1029972, 0, 1, 6, 0, 0, 7, 6, 0),
            (1029973, 3, 0, 7, 0, 0, 6, 7, 0)]:
        raise ValueError("wrong selected controller-state transition sequence")
    ccws = [event for event in events if event.kind == 3]
    if [(event.first, event.value, event.after.command, event.after.da)
            for event in ccws[-3:]] != [
                (511, 0, 0o11, 1), (511, 0, 0o10, 1), (511, 0, 0, 0)]:
        raise ValueError("wrong selected CCW chain")

    actor_groups = [turns[index:index + 4] for index in range(0, 12, 4)]
    for index, (group, request, delivery, application) in enumerate(
            zip(actor_groups, requests, deliveries, applications)):
        if [turn.actor for turn in group] != [1, 2, 3, 4]:
            raise ValueError("wrong media actor ordering")
        for turn in group:
            if (turn.operation, turn.generation, turn.request_id,
                    turn.descriptor_hash, turn.payload_hash) != (
                    request.after.operation, request.after.generation,
                    request.after.request_id, request.descriptor_hash,
                    request.payload_hash):
                raise ValueError("controller/media request identity mismatch")
        if group[2].page_hash != delivery.page_hash or (
                group[3].page_hash != application.page_hash):
            raise ValueError("controller/media delivery hash mismatch")
        if index == 0:
            if group[2].disposition != 1 or group[2].overlay_generation != 1:
                raise ValueError("write overlay did not commit exactly once")
        elif group[2].disposition != 0 or group[2].overlay_generation != 1:
            raise ValueError("read changed overlay identity")
    if turns[-1].overlay_generation != 1:
        raise ValueError("wrong final overlay generation")


def usim_projection(path: Path, events: list[ControllerEvent]) -> None:
    """Compare only observations that both the maintained-usim hook and core expose.

    Host request actors, copied payloads, and portable-only state transitions are
    deliberately absent: this projection is ordered register/CCW/page/IRQ and
    terminal evidence, not a fabricated full-trace equivalence.
    """
    rows = [json.loads(line) for line in path.read_text().splitlines() if line]
    if not rows or rows[0] != {
            "disk_bytes": 269562880,
            "event_only": True,
            "schema": "CDRM4USIM1",
            "schema_version": 1}:
        raise ValueError("invalid CDRM4USIM1 metadata")
    upstream = rows[1:]

    capture_path = path.with_name("capture.json")
    if not capture_path.is_file():
        raise ValueError("CDRM4USIM1 capture.json is required")
    capture = json.loads(capture_path.read_text())
    if (capture.get("schema"), capture.get("schema_version")) != (
            "cadr-m4-upstream-media-oracle", 1) or (
            capture.get("max_post_slot_s", 0) < 1030044):
        raise ValueError("invalid maintained-usim capture identity")
    disk = capture.get("disk", {})
    expected_disk = {"bytes": 269562880, "sha256": BASE.hex()}
    for name in ("base_pre", "base_post", "disposable_copy_pre",
                 "disposable_copy_post"):
        if disk.get(name) != expected_disk:
            raise ValueError(f"maintained-usim disk identity mismatch: {name}")
    normalized = capture.get("normalized_event_stream", {})
    if (normalized.get("bytes"), normalized.get("sha256")) != (
                len(path.read_bytes()), sha(path.read_bytes()).hex()):
        raise ValueError("maintained-usim normalized witness identity mismatch")

    terminal = [row for row in upstream
                if row.get("action") == "terminal-micro-pc"]
    if len(terminal) != 1 or (
            terminal[0].get("post_slot_s"),
            terminal[0].get("micro_executed"),
            terminal[0].get("p1_pc"),
            terminal[0].get("next_pc")) != (
                1029996, 0o355, 0o356, 0o357):
        raise ValueError("upstream terminal predicate mismatch")
    upstream = [row for row in upstream
                if row.get("post_slot_s", 0) <= 1029996]

    # The upstream hook labels the enclosing register write before recording
    # the interrupt side effect.  The portable core captures its completed
    # before/after tuple after that side effect.  Canonicalize those two
    # records within their shared post-slot; do not claim raw-hook ordering.
    core_registers = []
    for event in events:
        if event.kind in (1, 2):
            core_registers.append((
                event.slot, 0, event.intra,
                "register-read" if event.kind == 1 else "register-write",
                event.first, event.value))
        elif event.kind == 9 and event.flags == 0:
            core_registers.append(
                (event.slot, 1, event.intra, "interrupt-deassert", 0, 0))
    core_registers.sort(key=lambda item: item[:3])
    observed_registers = []
    for row in upstream:
        action = row.get("action")
        if action in ("register-read", "register-write"):
            observed_registers.append((
                row["post_slot_s"], 0, row["intra_slot_sequence"], action,
                row["register_offset"], row["register_value"]))
        elif action == "interrupt-deassert":
            observed_registers.append((
                row["post_slot_s"], 1, row["intra_slot_sequence"],
                action, 0, 0))
    observed_registers.sort(key=lambda item: item[:3])
    # Intra-slot ordinals are hook-local.  Ordered action and value identity,
    # including the exact guest boundary, is the common surface.
    core_registers = [item[:2] + item[3:] for item in core_registers]
    observed_registers = [item[:2] + item[3:] for item in observed_registers]
    if core_registers != observed_registers:
        raise ValueError("CDRM4USIM1 register/interrupt projection mismatch")

    core_ccws = [(event.slot, event.first, event.value,
                  event.after.command, event.after.da,
                  event.value & 0x00ffff00)
                 for event in events if event.kind == 3]
    upstream_ccws = [(row["post_slot_s"], row["clp"], row["ccw"],
                      row["command"], row["lba"], row["page_address"])
                     for row in upstream if row.get("action") == "ccw-read"]
    if core_ccws[-3:] != upstream_ccws:
        raise ValueError("CDRM4USIM1 CCW projection mismatch")

    core_pages = [(event.slot, "block-write" if event.flags else "block-read",
                   event.after.command, event.second, event.value,
                   event.page_hash.hex())
                  for event in events if event.kind == 7]
    upstream_pages = [(row["post_slot_s"], row["action"], row["command"],
                       row["lba"], row["media_block_bytes"],
                       row["media_block_sha256"])
                      for row in upstream
                      if row.get("action") in ("block-write", "block-read")]
    if len(core_pages) != len(upstream_pages):
        raise ValueError("CDRM4USIM1 page-transfer count mismatch")
    for core_page, upstream_page in zip(core_pages, upstream_pages):
        # The maintained usim media access is synchronous.  A portable host
        # read may be applied at the issuing boundary or the next boundary.
        if (core_page[0] not in (upstream_page[0], upstream_page[0] + 1)
                or core_page[1:] != upstream_page[1:]):
            raise ValueError("CDRM4USIM1 page-transfer projection mismatch")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("controller", type=Path)
    parser.add_argument("media", type=Path)
    parser.add_argument("--usim", type=Path,
                        help="optional maintained-usim CDRM4USIM1 NDJSON witness")
    args = parser.parse_args()
    events, state_hash = controller(args.controller)
    turns = media(args.media)
    selected_profile(events, turns, state_hash)
    if args.usim is not None:
        usim_projection(args.usim, events)
    print(f"C-M4 selected controller/media profile: ok "
          f"({len(events)} events, {len(turns)} actor turns)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

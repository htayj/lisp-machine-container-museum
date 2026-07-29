#!/usr/bin/env python3
"""Strict verifier and sole release-record writer for native M6 captures.

Each argument is an atomic capture directory containing exactly
``metadata.json``, ``capture.ndjson``, and ``idle.bin``.  The producer owns
those raw files; this program only validates them and writes the canonical
release record after three independent clean captures agree.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCHEDULE_SCRIPT = ROOT / "scripts" / "cadr-m6-witness-schedule.py"

CAPTURE_SCHEMA = "cadr-m6-native-debug-ir-capture-bundle-v1"
RAW_SCHEMA = "cadr-m6-native-raw-v2"
RELEASE_SCHEMA = "cadr-m6-native-debug-ir-release-record-v1"
CONTRACT = "C-M6-DEBUG-IR-LISTENER-READY-ABC-v1"
TARGET = "CADR-WEB-303/ABI1.4/protocol-v4/M6"
MAPPING_SHA256 = "2881102e8a8883379cf7da06251501b3c75f453d8fe0bff0d7e9f649198e1cd8"
# These are release-profile pins, not merely well-formed provenance labels.
#
# Changing either the native patch or native executable legitimately requires a
# new evidence run, but it must not silently broaden the accepted M6 capture
# population.  Update the corresponding constant only with the reviewed
# producer change, three new captures, and the newly derived release record.
SYSTEM_FOSSIL_SHA256 = "4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91"
USIM_FOSSIL_SHA256 = "330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d"
ORACLE_PATCH_SHA256 = "a646dd94a71a508799280d4756708d62817e2afa397046dac36ebbce8a72b924"
NATIVE_EXECUTABLE_SHA256 = "9c4fc4cc1771fb53cd1dae0c2fdc974c7e78726bc86fa2a04594ec2fcb717666"
FROZEN_IDENTITIES = {
    "system_fossil": SYSTEM_FOSSIL_SHA256,
    "usim_fossil": USIM_FOSSIL_SHA256,
    "oracle_patch_sha256": ORACLE_PATCH_SHA256,
    "native_executable_sha256": NATIVE_EXECUTABLE_SHA256,
    "cadet_mapping_sha256": MAPPING_SHA256,
}
MINIMAL_EXECUTION_ENVIRONMENT = {
    "policy_id": "cadr-m6-native-minimal-environment-v1",
    "inherited": False,
    "variables": {"LANG": "C", "LC_ALL": "C", "TZ": "UTC"},
}
FORM_A = [0x4D36, 0x4131, 0xA55A]
FORM_B = [0x4D36, 0x4232, 0x5AA5]
FORM_C = [0x4D36, 0x4944, 0x4C45]
FORM_C_UTF8_SHA256 = "046c90e9d5421ef2d23d9483889659066f9e71e8dd8aa1be31e0f5a413cc2969"
RETAINED_ALLUP_SCANCODE = 0x18000
FORM_A_START_BOUNDARY = 50_000_000
INPUT_CHUNK_CHARACTERS = 16
INPUT_CHUNK_PAUSE_BOUNDARIES = 10_000_000
FORM_B_HOLD_BOUNDARIES = 20_000_000
LISTENER_IDLE_C_TIMEOUT_BOUNDARIES = 100_000_000
LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES = 1_000_000
SCHEDULE_SHA256 = "e91958d37bc4dc05618efd30317817e0728f8a47e7fb996ab3d3bb4facafef30"
A_WRITE_BOUNDARIES = [328_589_384, 328_606_313, 328_623_242]
A_BOUNDARY = 328_623_243
B_WRITE_BOUNDARIES = [980_279_676, 980_296_605, 980_313_534]
B_BOUNDARY = 980_313_535
C_WRITE_BOUNDARIES = [982_955_347, 982_972_780, 982_990_213]
C_BOUNDARY = 982_990_214
C_SETTLED_BOUNDARY = 983_990_214
SAFE_ADDRESSES = [257024, 257026, 257028]  # 0766000, 0766002, 0766004
FORBIDDEN_ADDRESS = 257030                 # 0766006
CLOCK_POLICY = "C-M6-CEIL-N-1000000-OVER-60-GUEST-BOUNDARY-v1"
CLOCK_FORMULA = "due(n)=ceil(n*1000000/60), n=1..event_count"
REQUIRED_FILES = frozenset({"metadata.json", "capture.ndjson", "idle.bin"})
HEX = re.compile(r"^[0-9a-f]{64}$")
U64 = re.compile(r"^(0|[1-9][0-9]*)$")
LISTENER_IDLE_OBSERVER = {
    "schema": "cadr-m6-listener-idle-observer-v1",
    "spawner": "process-run-function",
    "wait": "process-wait-for-lisp-listener-idle",
    "critical_section": "without-interrupts",
    "source_form": "b",
    "marker_form": "c",
    "identity_checks": [
        "initial-lisp-listener", "selected-window", "lisp-listener-type",
        "exposed", "owner-process", "owner-stack-group", "lisp-listener-idle",
    ],
    "nonclaims": [
        "tagged-pointer-identity", "read-for-top-level", "input-empty",
    ],
    "cleanup": {
        "hold_boundaries": "1000000",
        "stable_invariants": [
            "debug-ir-c", "keyboard-all-up", "keyboard-fifo-empty",
            "iob-cclk-clear", "disk-not-busy", "host-no-request",
        ],
        "residual_nonclaim": "observer-process-inactivity-not-decoded",
    },
}
ABI_ARTIFACTS = [
    {"kind": 1, "byte_count": "854",
     "sha256": "1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f"},
    {"kind": 2, "byte_count": "20480",
     "sha256": "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6"},
    {"kind": 4, "byte_count": "3130",
     "sha256": "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d"},
    {"kind": 5, "byte_count": "83270",
     "sha256": "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a"},
    {"kind": 3, "byte_count": "269562880",
     "sha256": "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"},
]
NATIVE_INPUTS = [
    {"id": "usite-extra-hosts", "byte_count": "262",
     "sha256": "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438"},
]
PRIVATE_DISK_ARTIFACT_SHA256 = next(
    item["sha256"] for item in ABI_ARTIFACTS if item["kind"] == 3)


class WitnessError(ValueError):
    """A capture is incomplete, non-canonical, or outside the M6 contract."""


def reject_duplicate_members(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name, value in pairs:
        if name in result:
            raise WitnessError(f"duplicate JSON member {name!r}")
        result[name] = value
    return result


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def clock_due(ordinal: int) -> int:
    return (ordinal * 1_000_000 + 59) // 60


def clock_transcript_sha256(event_count: int) -> str:
    payload = bytearray(16 + event_count * 16)
    payload[:9] = b"CDRM6CLK1"
    payload[12:16] = event_count.to_bytes(4, "little")
    for ordinal in range(1, event_count + 1):
        offset = 16 + (ordinal - 1) * 16
        payload[offset:offset + 8] = ordinal.to_bytes(8, "little")
        payload[offset + 8:offset + 16] = clock_due(ordinal).to_bytes(8, "little")
    return sha256_bytes(bytes(payload))


def exact_keys(value: Any, keys: list[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != set(keys):
        raise WitnessError(f"{label} has missing or unknown fields")
    return value


def sha256(value: Any, label: str) -> str:
    if not isinstance(value, str) or not HEX.fullmatch(value):
        raise WitnessError(f"{label} must be a lowercase SHA-256")
    return value


def decimal_u64(value: Any, label: str, *, nonzero: bool = False) -> int:
    if not isinstance(value, str) or not U64.fullmatch(value):
        raise WitnessError(f"{label} must be a canonical u64 decimal string")
    number = int(value)
    if number > 0xFFFFFFFFFFFFFFFF or (nonzero and number == 0):
        raise WitnessError(f"{label} is outside the permitted u64 range")
    return number


def integer(value: Any, label: str, low: int, high: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise WitnessError(f"{label} is outside its permitted integer range")
    return value


def read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"),
                           object_pairs_hook=reject_duplicate_members)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WitnessError(f"{label} is not valid UTF-8 JSON") from exc
    if not isinstance(value, dict):
        raise WitnessError(f"{label} must be an object")
    return value


def frozen_schedule() -> dict[str, Any]:
    spec = importlib.util.spec_from_file_location("cadr_m6_schedule_contract", SCHEDULE_SCRIPT)
    if spec is None or spec.loader is None:
        raise WitnessError("cannot load frozen M6 schedule generator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    value = module.schedule()
    if value["mapping"]["sha256"] != MAPPING_SHA256:
        raise WitnessError("checked-in Cadet mapping differs from frozen M6 mapping")
    expected_timing = {
        "clock_policy": "ceil(n*1000000/60)",
        "initial_return_boundary": "25000000",
        "form_a_start_boundary": str(FORM_A_START_BOUNDARY),
        "form_b_hold_boundaries": str(FORM_B_HOLD_BOUNDARIES),
        "input_chunk_characters": INPUT_CHUNK_CHARACTERS,
        "input_chunk_pause_boundaries": str(INPUT_CHUNK_PAUSE_BOUNDARIES),
        "intra_chunk_frame_policy": "ceil(n*1000000/60)",
        "listener_idle_c_timeout_boundaries": str(LISTENER_IDLE_C_TIMEOUT_BOUNDARIES),
        "listener_idle_c_cleanup_hold_boundaries":
            str(LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES),
    }
    if (canonical(value.get("timing")) != canonical(expected_timing) or
            value["schedule"].get("sha256") != SCHEDULE_SHA256 or
            value["schedule"].get("event_count") != 3118):
        raise WitnessError("checked-in M6 schedule differs from frozen paced timing")
    return value


def validate_identities(value: Any) -> dict[str, Any]:
    result = exact_keys(value, ["system_fossil", "usim_fossil", "oracle_patch_sha256",
                                "native_executable_sha256", "cadet_mapping_sha256"], "identities")
    for name in result:
        sha256(result[name], f"identities.{name}")
    for name, expected in FROZEN_IDENTITIES.items():
        if result[name] != expected:
            raise WitnessError(f"identities.{name} differs from the exact M6 release-profile pin")
    return result


def validate_artifacts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) != 5:
        raise WitnessError("artifacts must contain the exact five M6 artifacts")
    result: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        item = exact_keys(item, ["kind", "byte_count", "sha256"], f"artifacts[{index}]")
        if integer(item["kind"], f"artifacts[{index}].kind", 1, 0xffffffff) != [1, 2, 4, 5, 3][index]:
            raise WitnessError("artifacts are not exact ordered kinds 1,2,4,5,3")
        decimal_u64(item["byte_count"], f"artifacts[{index}].byte_count", nonzero=True)
        sha256(item["sha256"], f"artifacts[{index}].sha256")
        result.append(item)
    if canonical(result) != canonical(ABI_ARTIFACTS):
        raise WitnessError("artifacts differ from the exact ABI 1,2,4,5,3 profile identities")
    return result


def validate_native_inputs(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) != 1:
        raise WitnessError("native_inputs must contain exactly the hosts identity")
    item = exact_keys(value[0], ["id", "byte_count", "sha256"], "native_inputs[0]")
    decimal_u64(item["byte_count"], "native_inputs[0].byte_count", nonzero=True)
    sha256(item["sha256"], "native_inputs[0].sha256")
    if canonical(value) != canonical(NATIVE_INPUTS):
        raise WitnessError("native_inputs differs from the exact non-ABI hosts identity")
    return value


def validate_execution_environment(value: Any) -> dict[str, Any]:
    environment = exact_keys(value, ["policy_id", "inherited", "variables"],
                             "execution_environment")
    exact_keys(environment["variables"], ["LANG", "LC_ALL", "TZ"],
               "execution_environment.variables")
    if canonical(environment) != canonical(MINIMAL_EXECUTION_ENVIRONMENT):
        raise WitnessError(
            "execution_environment differs from the exact M6 minimal-environment policy")
    return environment


def validate_forms(value: Any, frozen: dict[str, Any]) -> dict[str, Any]:
    forms = exact_keys(value, ["a", "b", "c"], "forms")
    for name, words, magic in (
            ("a", FORM_A, "a55a41314d36"),
            ("b", FORM_B, "5aa542324d36"),
            ("c", FORM_C, "4c4549444d36")):
        form = exact_keys(forms[name], ["utf8", "utf8_sha256", "magic48", "words16"], f"forms.{name}")
        if (canonical(form) != canonical(frozen["forms"][name]) or form["magic48"] != magic or
                form["words16"] != words or sha256(form["utf8_sha256"], f"forms.{name}.utf8_sha256") !=
                sha256_bytes(form["utf8"].encode("utf-8"))):
            raise WitnessError(f"forms.{name} differs from the frozen exact form")
    if forms["c"]["utf8_sha256"] != FORM_C_UTF8_SHA256:
        raise WitnessError("forms.c differs from the frozen atomic Listener-idle observer")
    return forms


def validate_schedule(value: Any, frozen: dict[str, Any]) -> dict[str, Any]:
    keys = ["schema", "sha256", "event_count", "pre_a_batches", "post_a_batches"]
    schedule = exact_keys(value, keys, "schedule")
    pre_a = schedule.get("pre_a_batches")
    post_a = schedule.get("post_a_batches")
    if (not isinstance(pre_a, list) or len(pre_a) < 3 or
            not isinstance(post_a, list) or not post_a):
        raise WitnessError("schedule does not contain the exact all-up event tree")
    try:
        groups = [pre_a[0], pre_a[1],
                  [event for batch in pre_a[2:] for event in batch],
                  [event for batch in post_a for event in batch]]
    except TypeError as exc:
        raise WitnessError("schedule does not contain the exact all-up event tree") from exc
    modifiers = {0o24: 1, 0o104: 4, 0o44: 2}
    for group_index, group in enumerate(groups):
        if not isinstance(group, list) or not group:
            raise WitnessError("schedule does not contain the exact all-up event tree")
        wire = []
        for event in group:
            if not isinstance(event, dict):
                raise WitnessError("schedule does not contain the exact all-up event tree")
            wire.append(event.get("scancode"))
        index = 0
        while index < len(wire):
            code = wire[index]
            if isinstance(code, bool) or not isinstance(code, int) or not 0 <= code <= 0xffff:
                raise WitnessError("schedule wire events must be exact uint16 values")
            if code in modifiers:
                mask = modifiers[code]
                if (index + 3 >= len(wire) or isinstance(wire[index + 1], bool) or
                        not isinstance(wire[index + 1], int) or
                        not 0 <= wire[index + 1] <= 0x7f or
                        wire[index + 2] != 0x8000 | mask or
                        wire[index + 3] != 0x8000):
                    raise WitnessError(
                        f"schedule group {group_index} violates shifted held-mask/all-up semantics")
                index += 4
            else:
                if code > 0x7f or index + 1 >= len(wire) or wire[index + 1] != 0x8000:
                    raise WitnessError(
                        f"schedule group {group_index} uses retired SCC-release instead of all-up")
                index += 2
    if canonical(schedule) != canonical(frozen["schedule"]):
        raise WitnessError("schedule differs from the frozen Return,N,Return and Form A/B schedule")
    return schedule


def validate_metadata(value: dict[str, Any], frozen: dict[str, Any]) -> dict[str, Any]:
    keys = ["schema", "contract", "target", "identities", "artifacts", "native_inputs",
            "execution_environment", "forms",
            "schedule", "timing", "clock_policy",
            "host", "listener_idle_observer",
            "session_id", "private_disk_instance_id", "private_disk_sha256_at_start",
            "private_disk_sha256_at_end", "forced_stop", "state_may_be_incomplete",
            "unexpected_input_count", "forbidden_debug_write_count"]
    if "execution_environment" not in value:
        raise WitnessError("metadata.execution_environment is required")
    metadata = exact_keys(value, keys, "metadata")
    if (metadata["schema"] != CAPTURE_SCHEMA or metadata["contract"] != CONTRACT or
            metadata["target"] != TARGET):
        raise WitnessError("wrong M6 capture-bundle identity")
    metadata["identities"] = validate_identities(metadata["identities"])
    metadata["artifacts"] = validate_artifacts(metadata["artifacts"])
    metadata["native_inputs"] = validate_native_inputs(metadata["native_inputs"])
    metadata["execution_environment"] = validate_execution_environment(
        metadata["execution_environment"])
    metadata["forms"] = validate_forms(metadata["forms"], frozen)
    metadata["schedule"] = validate_schedule(metadata["schedule"], frozen)
    timing = exact_keys(metadata["timing"], [
        "clock_policy", "initial_return_boundary", "form_a_start_boundary",
        "form_b_hold_boundaries", "input_chunk_characters",
        "input_chunk_pause_boundaries", "intra_chunk_frame_policy",
        "listener_idle_c_timeout_boundaries",
        "listener_idle_c_cleanup_hold_boundaries",
    ], "timing")
    if canonical(timing) != canonical(frozen["timing"]):
        raise WitnessError("timing differs from frozen 50M/16-character/10M-pause/20M-hold policy")
    clock = exact_keys(metadata["clock_policy"], ["policy_id", "formula", "numerator", "denominator", "source"], "clock_policy")
    if (clock != {"policy_id": CLOCK_POLICY, "formula": CLOCK_FORMULA,
                  "numerator": 1_000_000, "denominator": 60, "source": "guest-boundary"}):
        raise WitnessError("clock_policy must be the frozen guest-boundary rational 60Hz policy, never a host timer")
    host = exact_keys(metadata["host"], [
        "request_pending", "completion_queued", "outstanding_request_id",
    ], "metadata.host")
    if host != {
            "request_pending": 0, "completion_queued": 0,
            "outstanding_request_id": 0}:
        raise WitnessError("metadata.host must prove no pending host request, completion, or outstanding request")
    if canonical(metadata["listener_idle_observer"]) != canonical(LISTENER_IDLE_OBSERVER):
        raise WitnessError("metadata.listener_idle_observer differs from the exact source-bound C observer contract")
    for field in ("session_id", "private_disk_instance_id"):
        if not isinstance(metadata[field], str) or not metadata[field]:
            raise WitnessError(f"metadata.{field} must be a non-empty string")
    for field in ("private_disk_sha256_at_start", "private_disk_sha256_at_end"):
        sha256(metadata[field], f"metadata.{field}")
        if metadata[field] != PRIVATE_DISK_ARTIFACT_SHA256:
            raise WitnessError(
                f"metadata.{field} must equal the exact ABI kind-3 private-disk artifact")
    for field in ("forced_stop", "state_may_be_incomplete"):
        if metadata[field] is not False:
            raise WitnessError(f"metadata.{field} must be false for a clean native run")
    for field in ("unexpected_input_count", "forbidden_debug_write_count"):
        if integer(metadata[field], f"metadata.{field}", 0, 0xffffffff) != 0:
            raise WitnessError(f"metadata.{field} must be zero")
    return metadata


def read_ndjson(path: Path) -> list[dict[str, Any]]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as exc:
        raise WitnessError("capture.ndjson is not valid UTF-8 NDJSON") from exc
    if not lines:
        raise WitnessError("capture.ndjson is empty")
    result = []
    for index, line in enumerate(lines):
        if not line:
            raise WitnessError(f"capture.ndjson line {index + 1} is empty")
        try:
            item = json.loads(line, object_pairs_hook=reject_duplicate_members)
        except json.JSONDecodeError as exc:
            raise WitnessError(f"capture.ndjson line {index + 1} is not JSON") from exc
        if not isinstance(item, dict):
            raise WitnessError(f"capture.ndjson line {index + 1} must be an object")
        result.append(item)
    return result


def validate_sample(sample: bytes, index: int) -> None:
    if len(sample) != 96 or sample[:8] != b"CDRM6I1\0":
        raise WitnessError(f"idle.bin sample {index} is not CDRM6I1")
    u64 = lambda offset: int.from_bytes(sample[offset:offset + 8], "little")
    u32 = lambda offset: int.from_bytes(sample[offset:offset + 4], "little")
    if (u64(8) != 0x4C4549444D36 or u64(16) >> 48 or u64(24) >> 48 or
            u32(60) & (1 << 5) or u32(64) or
            u32(68) != RETAINED_ALLUP_SCANCODE or u32(72) != 3 or
            u32(76) or u32(80) or u32(84) != 1 or u32(88) or u32(92)):
        raise WitnessError(f"idle.bin sample {index} is not quiescent Listener-idle Form C")


def validate_boundary(record: Any, label: str, *, kind: str = "boundary") -> dict[str, Any]:
    keys = ["kind", "ordinal", "debug_ir_words", "state"]
    record = exact_keys(record, keys, label)
    if record["kind"] != kind:
        raise WitnessError(f"{label} is not a {kind} record")
    integer(record["ordinal"], f"{label}.ordinal", 0, 0xffffffffffffffff)
    if (not isinstance(record["debug_ir_words"], list) or len(record["debug_ir_words"]) != 3):
        raise WitnessError(f"{label}.debug_ir_words must contain three words")
    for index, word in enumerate(record["debug_ir_words"]):
        integer(word, f"{label}.debug_ir_words[{index}]", 0, 0xffff)
    state = exact_keys(record["state"], ["scheduler", "keyboard", "iob", "disk", "host", "completion"], f"{label}.state")
    scheduler = exact_keys(state["scheduler"], ["machine_cycles", "halted", "pending_count"], f"{label}.state.scheduler")
    keyboard = exact_keys(state["keyboard"], ["scancode", "ready", "fifo_count"], f"{label}.state.keyboard")
    iob = exact_keys(state["iob"], ["csr", "sixty_cycle_clock"], f"{label}.state.iob")
    disk = exact_keys(state["disk"], ["status", "busy", "outstanding_operation", "interrupt_request", "fault"], f"{label}.state.disk")
    host = exact_keys(state["host"], ["request_pending", "completion_queued", "outstanding_request_id"], f"{label}.state.host")
    completion = exact_keys(state["completion"], ["schedule_consumed", "debug_ir_writes"], f"{label}.state.completion")
    for field, high in (("machine_cycles", 0xffffffffffffffff), ("halted", 1),
                        ("pending_count", 0xffffffff)):
        integer(scheduler[field], f"{label}.state.scheduler.{field}", 0, high)
    for owner, name, high in ((keyboard, "scancode", 0x1ffff), (keyboard, "ready", 1),
                              (keyboard, "fifo_count", 0xffffffff), (iob, "csr", 0xffffffff),
                              (iob, "sixty_cycle_clock", 0xffff), (disk, "busy", 0xffffffff),
                              (disk, "status", 0xffffffff), (disk, "outstanding_operation", 0xffffffff),
                              (disk, "interrupt_request", 1), (disk, "fault", 1),
                              (host, "request_pending", 0xffffffff),
                              (host, "completion_queued", 0xffffffff),
                              (host, "outstanding_request_id", 0xffffffffffffffff),
                              (completion, "schedule_consumed", 0xffffffff),
                              (completion, "debug_ir_writes", 0xffffffff)):
        integer(owner[name], f"{label}.state.{name}", 0, high)
    if scheduler["machine_cycles"] != record["ordinal"] or scheduler["halted"] != 0:
        raise WitnessError(f"{label} has noncanonical scheduler state")
    return record


def validate_settled(record: Any, label: str) -> dict[str, Any]:
    record = exact_keys(record, [
        "kind", "ordinal", "cleanup_hold_boundaries", "debug_ir_words", "state",
    ], label)
    if record["kind"] != "settled":
        raise WitnessError(f"{label} is not a settled record")
    if integer(record["cleanup_hold_boundaries"], f"{label}.cleanup_hold_boundaries",
               0, 0xffffffffffffffff) != LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES:
        raise WitnessError("settled record does not bind the exact 1M-boundary cleanup hold")
    validate_boundary({
        "kind": "settled", "ordinal": record["ordinal"],
        "debug_ir_words": record["debug_ir_words"], "state": record["state"],
    }, label, kind="settled")
    return record


def require_quiescent_boundary(boundary: dict[str, Any], label: str) -> None:
    state = boundary["state"]
    if (state["scheduler"]["halted"] != 0 or state["scheduler"]["pending_count"] != 0 or
            state["keyboard"] != {
                "scancode": RETAINED_ALLUP_SCANCODE, "ready": 0, "fifo_count": 0} or
            state["iob"]["csr"] & (1 << 5) or state["disk"] != {
                "status": 3, "busy": 0, "outstanding_operation": 0,
                "interrupt_request": 1, "fault": 0} or
            state["host"] != {
                "request_pending": 0, "completion_queued": 0,
                "outstanding_request_id": 0}):
        raise WitnessError(f"{label} is not fully device/scheduler quiescent")


def check_bundle(directory: Path, frozen: dict[str, Any]) -> dict[str, Any]:
    if not directory.is_dir() or directory.is_symlink():
        raise WitnessError("capture argument must be a regular capture directory")
    entries = {entry.name for entry in directory.iterdir()}
    if entries != REQUIRED_FILES:
        raise WitnessError("capture bundle must contain exactly metadata.json, capture.ndjson, and idle.bin; current raw producer output is unsupported")
    files = {name: directory / name for name in REQUIRED_FILES}
    if any(not path.is_file() or path.is_symlink() for path in files.values()):
        raise WitnessError("capture bundle files must be regular non-symlink files")
    metadata = validate_metadata(read_json(files["metadata.json"], "metadata.json"), frozen)
    records = read_ndjson(files["capture.ndjson"])
    samples = files["idle.bin"].read_bytes()
    if len(samples) != 64 * 96:
        raise WitnessError("idle.bin must contain exactly 64 CDRM6I1 samples of 96 bytes")
    for index in range(64):
        validate_sample(samples[index * 96:(index + 1) * 96], index)

    event_count = metadata["schedule"]["event_count"]
    expected_events = [event for batch in metadata["schedule"]["pre_a_batches"] + metadata["schedule"]["post_a_batches"] for event in batch]
    meta = exact_keys(records[0], ["kind", "schema", "schedule_sha256", "schedule_events", "session_id"], "capture meta")
    if (meta["kind"] != "meta" or meta["schema"] != RAW_SCHEMA or
            meta["schedule_sha256"] != metadata["schedule"]["sha256"] or
            meta["schedule_events"] != event_count or meta["session_id"] != metadata["session_id"]):
        raise WitnessError("capture meta does not bind this v2 raw stream to metadata")
    complete = exact_keys(records[-1], ["kind", "clean_shutdown", "schedule_consumed", "debug_ir_writes"], "complete")
    if (complete["kind"] != "complete" or complete["clean_shutdown"] is not True or
            integer(complete["schedule_consumed"], "complete.schedule_consumed", 0, 0xffffffff) != event_count or
            integer(complete["debug_ir_writes"], "complete.debug_ir_writes", 0, 0xffffffff) != 9):
        raise WitnessError("capture did not end with a clean complete record")
    body = records[1:-1]
    allowed = {"clock", "event", "write", "boundary", "settled"}
    if any(record.get("kind") not in allowed for record in body):
        raise WitnessError("capture.ndjson has fabricated, missing, or host-timer records")
    boundary_field = {"clock": "due_boundary", "event": "due_boundary",
                      "write": "boundary", "boundary": "ordinal",
                      "settled": "ordinal"}
    same_boundary_priority = {
        "clock": 0, "event": 1, "write": 2, "boundary": 3, "settled": 4,
    }
    prior_effective = -1
    prior_priority = -1
    for index, record in enumerate(body):
        kind = record["kind"]
        field = boundary_field[kind]
        effective = record.get(field)
        integer(effective, f"capture.ndjson body[{index}].{field}",
                0, 0xffffffffffffffff)
        priority = same_boundary_priority[kind]
        if (effective < prior_effective or
                (effective == prior_effective and priority < prior_priority)):
            raise WitnessError(
                "capture.ndjson raw rows violate global boundary/order chronology")
        prior_effective = effective
        prior_priority = priority
    events = [record for record in body if record["kind"] == "event"]
    if len(events) != event_count:
        raise WitnessError("input events do not consume the exact frozen schedule once in order")
    for index, (record, expected) in enumerate(zip(events, expected_events)):
        record = exact_keys(record, ["kind", "ordinal", "due_boundary", "scancode", "phase"], f"event[{index}]")
        phase = {"boot": 0, "form-a": 1, "form-b": 2}[expected["phase"]]
        if (record["kind"] != "event" or record["ordinal"] != expected["index"] or
                record["due_boundary"] != int(expected["due_boundary"]) or record["scancode"] != expected["scancode"] or
                record["phase"] != phase):
            raise WitnessError("input events do not consume the exact frozen schedule once in order")
        integer(record["ordinal"], f"event[{index}].ordinal", 0, 0xffffffff)
        integer(record["due_boundary"], f"event[{index}].due_boundary", 0, 0xffffffffffffffff)
        integer(record["scancode"], f"event[{index}].scancode", 0, 0xffff)
        integer(record["phase"], f"event[{index}].phase", 0, 2)
    writes = [record for record in body if record["kind"] == "write"]
    if len(writes) != 9:
        raise WitnessError("DEBUG-IR transcript must contain exactly nine A/B/C writes")
    for index, (record, address, value) in enumerate(
            zip(writes, SAFE_ADDRESSES * 3, FORM_A + FORM_B + FORM_C)):
        record = exact_keys(record, ["kind", "boundary", "address", "value"], f"write[{index}]")
        if (record["kind"] != "write" or record["address"] != address or record["value"] != value or
                isinstance(record["boundary"], bool) or not isinstance(record["boundary"], int) or record["boundary"] < 0):
            raise WitnessError("DEBUG-IR writes must be exactly A then B then C at decimal 257024/257026/257028")
    if not (writes[0]["boundary"] <= writes[1]["boundary"] <= writes[2]["boundary"] <
            writes[3]["boundary"] <= writes[4]["boundary"] <= writes[5]["boundary"] <
            writes[6]["boundary"] <= writes[7]["boundary"] <= writes[8]["boundary"]):
        raise WitnessError("DEBUG-IR A/B/C write ordering is not source-correct")
    first_b_event = next(record["due_boundary"] for record in events if record["phase"] == 2)
    last_a_event = int(metadata["schedule"]["pre_a_batches"][-1][-1]["due_boundary"])
    last_b_event = int(metadata["schedule"]["post_a_batches"][-1][-1]["due_boundary"])
    boundaries = [validate_boundary(record, f"boundary[{index}]") for index, record in enumerate(body) if record["kind"] == "boundary"]
    settled_rows = [validate_settled(record, f"settled[{index}]")
                    for index, record in enumerate(body)
                    if record["kind"] == "settled"]
    if len(settled_rows) != 1:
        raise WitnessError("capture must contain exactly one Listener-idle cleanup settled record")
    settled = settled_rows[0]
    if len(boundaries) != 67:
        raise WitnessError("capture has missing or extra A/B/C/suffix boundary records")
    a_boundary, b_boundary, c_boundary, suffix = boundaries[0], boundaries[1], boundaries[2], boundaries[3:]
    if (a_boundary["debug_ir_words"] != FORM_A or
            b_boundary["debug_ir_words"] != FORM_B or
            c_boundary["debug_ir_words"] != FORM_C):
        raise WitnessError("capture does not contain exact A then B then Listener-idle C witness boundaries")
    a, b, c = a_boundary["ordinal"], b_boundary["ordinal"], c_boundary["ordinal"]
    if not a < b < c:
        raise WitnessError("A boundary must precede B boundary and Listener-idle C boundary")
    if (not last_a_event < a < first_b_event or
            first_b_event != last_a_event + FORM_B_HOLD_BOUNDARIES):
        raise WitnessError(
            "Form B timing must use the exact 20M hold after Form A, with A observed in between")
    if (any(write["boundary"] <= last_a_event or write["boundary"] >= a for write in writes[:3]) or
            any(write["boundary"] <= last_b_event or write["boundary"] >= b for write in writes[3:6]) or
            any(write["boundary"] <= b or write["boundary"] >= c for write in writes[6:])):
        raise WitnessError("DEBUG-IR writes violate exact post-input/pre-boundary A/B/C chronology")
    if writes[8]["boundary"] > writes[5]["boundary"] + LISTENER_IDLE_C_TIMEOUT_BOUNDARIES:
        raise WitnessError("Listener-idle C arrived after the exact 100M-boundary observer timeout")
    pre_a_event_count = sum(len(batch) for batch in metadata["schedule"]["pre_a_batches"])
    require_quiescent_boundary(a_boundary, "A boundary")
    require_quiescent_boundary(b_boundary, "B boundary")
    require_quiescent_boundary(c_boundary, "Listener-idle C boundary")
    require_quiescent_boundary(settled, "Listener-idle cleanup settled boundary")
    if (a_boundary["state"]["completion"] != {"schedule_consumed": pre_a_event_count, "debug_ir_writes": 3} or
            b_boundary["state"]["completion"] != {"schedule_consumed": event_count, "debug_ir_writes": 6} or
            c_boundary["state"]["completion"] != {"schedule_consumed": event_count, "debug_ir_writes": 9} or
            settled["state"]["completion"] != {"schedule_consumed": event_count, "debug_ir_writes": 9}):
        raise WitnessError("A/B/C boundaries do not report the exact source-correct completion counts")
    settled_ordinal = settled["ordinal"]
    if (settled_ordinal != c + LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES or
            settled["debug_ir_words"] != FORM_C):
        raise WitnessError("Listener-idle settled record is not the exact retained-C 1M-boundary cleanup hold")
    if ([write["boundary"] for write in writes[:3]] != A_WRITE_BOUNDARIES or
            a != A_BOUNDARY or
            [write["boundary"] for write in writes[3:6]] != B_WRITE_BOUNDARIES or
            b != B_BOUNDARY or
            [write["boundary"] for write in writes[6:]] != C_WRITE_BOUNDARIES or
            c != C_BOUNDARY or settled_ordinal != C_SETTLED_BOUNDARY):
        raise WitnessError("A/B/C writes, boundaries, or settled point differ from the frozen r6w observation")
    for index, boundary in enumerate(suffix):
        expected_ordinal = settled_ordinal + index + 1
        state = boundary["state"]
        require_quiescent_boundary(boundary, f"post-C boundary {index}")
        if (boundary["ordinal"] != expected_ordinal or boundary["debug_ir_words"] != FORM_C or
                state["completion"] != {"schedule_consumed": event_count, "debug_ir_writes": 9}):
            raise WitnessError("post-C suffix is not an exact quiescent retained-C sequence")
    clocks = [record for record in body if record["kind"] == "clock"]
    expected_clock_count = ((settled_ordinal + 64) * 60) // 1_000_000
    if len(clocks) != expected_clock_count or expected_clock_count == 0:
        raise WitnessError("clock transcript does not cover the full capture")
    for index, record in enumerate(clocks, 1):
        record = exact_keys(record, ["kind", "ordinal", "due_boundary", "color_enabled", "policy"], f"clock[{index}]")
        if (record["kind"] != "clock" or record["ordinal"] != index or record["due_boundary"] != clock_due(index) or
                record["color_enabled"] not in (0, 1) or record["policy"] != "ceil(n*1000000/60)"):
            raise WitnessError("clock transcript is missing, reordered, non-rational, or host-derived")
        integer(record["ordinal"], f"clock[{index}].ordinal", 1, 0xffffffffffffffff)
        integer(record["due_boundary"], f"clock[{index}].due_boundary", 1, 0xffffffffffffffff)
        integer(record["color_enabled"], f"clock[{index}].color_enabled", 0, 1)
    clock_positions = {record["ordinal"]: position for position, record in enumerate(body) if record["kind"] == "clock"}
    for position, event in enumerate(body):
        if event["kind"] == "event":
            ordinal = (event["due_boundary"] * 60) // 1_000_000
            if ordinal > 0 and clock_due(ordinal) == event["due_boundary"] and clock_positions.get(ordinal, len(body)) > position:
                raise WitnessError("coincident guest clock must dispatch before keyboard event")
    return {"metadata": metadata, "capture_sha256": sha256_file(files["capture.ndjson"]),
            "input_transcript_sha256": sha256_bytes(canonical(events)),
            "debug_write_transcript_sha256": sha256_bytes(canonical(writes)),
            "a_boundary": str(a), "b_boundary": str(b),
            "listener_idle_c_boundary": str(c),
            "listener_idle_settled_boundary": str(settled_ordinal),
            "suffix_first_boundary": str(settled_ordinal + 1),
            "suffix_sha256": sha256_bytes(samples), "samples": samples,
            "clock_schedule": {"policy_id": CLOCK_POLICY, "formula": CLOCK_FORMULA,
                               "numerator": 1_000_000, "denominator": 60,
                               "event_count": expected_clock_count,
                               "transcript_sha256": clock_transcript_sha256(expected_clock_count)}}


def verify(paths: list[Path]) -> dict[str, Any]:
    if len(paths) != 3:
        raise WitnessError("exactly three fresh atomic capture directories are required")
    if len({path.resolve() for path in paths}) != 3:
        raise WitnessError("three capture directories must be distinct")
    frozen = frozen_schedule()
    reports = [check_bundle(path, frozen) for path in paths]
    baseline = reports[0]["metadata"]
    for report in reports[1:]:
        for field in (
                "identities", "artifacts", "native_inputs", "execution_environment", "forms",
                "schedule", "timing",
                "clock_policy", "host", "listener_idle_observer"):
            if report["metadata"][field] != baseline[field]:
                raise WitnessError(f"native runs disagree on pinned {field}")
        if report["samples"] != reports[0]["samples"]:
            raise WitnessError("native runs have differing CDRM6I1 suffix bytes")
        if (report["a_boundary"], report["b_boundary"],
                report["listener_idle_c_boundary"],
                report["listener_idle_settled_boundary"]) != (
                reports[0]["a_boundary"], reports[0]["b_boundary"],
                reports[0]["listener_idle_c_boundary"],
                reports[0]["listener_idle_settled_boundary"]):
            raise WitnessError("native runs disagree on A/B/C/settled boundaries")
        if report["clock_schedule"] != reports[0]["clock_schedule"]:
            raise WitnessError("native runs disagree on rational clock policy or transcript")
    sessions = [report["metadata"]["session_id"] for report in reports]
    disks = [report["metadata"]["private_disk_instance_id"] for report in reports]
    captures = [report["capture_sha256"] for report in reports]
    if len(set(sessions)) != 3 or len(set(disks)) != 3:
        raise WitnessError("native runs must have unique session and private-disk IDs")
    if len(set(captures)) != 3:
        raise WitnessError("native captures must be byte-distinct")
    idle_sha256 = reports[0]["suffix_sha256"]
    metadata = baseline
    native_runs = []
    for report in reports:
        source = report["metadata"]
        native_runs.append({
            "session_id": source["session_id"], "private_disk_instance_id": source["private_disk_instance_id"],
            "capture_sha256": report["capture_sha256"], "input_transcript_sha256": report["input_transcript_sha256"],
            "debug_write_transcript_sha256": report["debug_write_transcript_sha256"],
            "private_disk_sha256_at_start": source["private_disk_sha256_at_start"],
            "private_disk_sha256_at_end": source["private_disk_sha256_at_end"],
            "a_boundary": report["a_boundary"], "b_boundary": report["b_boundary"],
            "listener_idle_c_boundary": report["listener_idle_c_boundary"],
            "listener_idle_settled_boundary": report["listener_idle_settled_boundary"],
            "suffix_first_boundary": report["suffix_first_boundary"], "suffix_sha256": report["suffix_sha256"],
            "schedule_consumed": True, "unexpected_input_count": 0, "forbidden_debug_write_count": 0,
            "forced_stop": False, "state_may_be_incomplete": False,
        })
    return {
        "schema": RELEASE_SCHEMA, "contract": CONTRACT, "target": TARGET,
        "identities": metadata["identities"], "artifacts": metadata["artifacts"],
        "native_inputs": metadata["native_inputs"],
        "execution_environment": metadata["execution_environment"], "forms": metadata["forms"],
        "schedule": metadata["schedule"], "timing": metadata["timing"],
        "listener_idle_observer": metadata["listener_idle_observer"],
        "clock_schedule": reports[0]["clock_schedule"],
        "idle_oracle": {"wire_schema": "CDRM6I1", "sample_bytes": 96, "sample_count": 64,
                        "first_boundary_delta_from_settled": "1",
                        "samples_sha256": idle_sha256,
                        "samples": [reports[0]["samples"][offset:offset + 96].hex() for offset in range(0, 64 * 96, 96)]},
        "expected_debug_writes": [{"address": address, "value": value}
                                  for address, value in
                                  zip(SAFE_ADDRESSES * 3, FORM_A + FORM_B + FORM_C)],
        "native_runs": native_runs,
    }


def write_release(path: Path, record: dict[str, Any]) -> str:
    # This function is deliberately the only release-record writer.  Defend
    # that boundary as well as the capture validator so an imported caller
    # cannot serialize a release with provenance that the verifier would
    # reject.
    if not isinstance(record, dict) or record.get("schema") != RELEASE_SCHEMA:
        raise WitnessError("release record is not the exact M6 release schema")
    validate_identities(record.get("identities"))
    validate_execution_environment(record.get("execution_environment"))
    payload = canonical(record)
    temporary = path.with_name("." + path.name + ".tmp")
    temporary.write_bytes(payload)
    os.replace(temporary, path)
    return sha256_bytes(payload)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", nargs=3, type=Path, metavar="CAPTURE_DIR")
    parser.add_argument("--output", required=True, type=Path, help="canonical release-record JSON written only after acceptance")
    arguments = parser.parse_args(argv)
    try:
        record = verify(arguments.captures)
        release_sha256 = write_release(arguments.output, record)
    except (OSError, WitnessError) as exc:
        print(json.dumps({"schema": RELEASE_SCHEMA, "status": "blocked", "error": str(exc)}, sort_keys=True))
        return 2
    print(json.dumps({"status": "accepted", "release_record": str(arguments.output), "release_sha256": release_sha256}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

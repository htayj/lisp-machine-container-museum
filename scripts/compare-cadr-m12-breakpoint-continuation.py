#!/usr/bin/env python3
"""Compare the four selected M12 breakpoint-continuation captures.

This verifier accepts only the source-level CDRM12N2 and CDRM12W2 capture
schemas.  It does not produce captures and it does not turn the older
CDRM12USIM1 candidate-loop witness into breakpoint-continuation evidence.
The ``--expected-*`` options are caller-supplied selection gates, not an
authority statement; the canonical receipt labels them ``caller_expectation``.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
from typing import Any, Callable


NATIVE_SCHEMA = "CDRM12N2"
WASM_SCHEMA = "CDRM12W2"
SCHEMA_VERSION = 2
RECEIPT_SCHEMA = "CDRM12CMP1"
RECEIPT_SCHEMA_VERSION = 1
MAX_CAPTURE_BYTES = 256 * 1024
READ_CHUNK_BYTES = 16 * 1024
ARM_SPECS = {
    "native-uninterrupted": (NATIVE_SCHEMA, "native", False),
    "native-intervened": (NATIVE_SCHEMA, "native", True),
    "wasm-uninterrupted": (WASM_SCHEMA, "wasm", False),
    "wasm-intervened": (WASM_SCHEMA, "wasm", True),
}
TOP_FIELDS = (
    "schema",
    "schema_version",
    "arm",
    "identity",
    "breakpoint",
    "pre_boundary",
    "pause",
    "actions",
    "post_resume",
    "cleanup",
)
IDENTITY_FIELDS = (
    "profile_sha256",
    "campaign_sha256",
    "source_revision",
    "source_tree_sha256",
    "fixture_sha256",
    "base_state_sha256",
    "snapshot_sha256",
    "input_schedule_sha256",
    "artifact_sha256",
    "runner_sha256",
)
COMMON_IDENTITY_FIELDS = (
    "profile_sha256",
    "campaign_sha256",
    "fixture_sha256",
    "base_state_sha256",
    "snapshot_sha256",
    "input_schedule_sha256",
)
BACKEND_IDENTITY_FIELDS = (
    "source_revision",
    "source_tree_sha256",
    "artifact_sha256",
    "runner_sha256",
)
BREAKPOINT_FIELDS = ("slot", "kind", "value", "occurrence")
PRE_BOUNDARY_FIELDS = (
    "boundary_ordinal",
    "clock_slot",
    "micro_pc_before",
    "raw_lc_before",
)
PAUSE_FIELDS = ("observed", "operation_slots")
POST_RESUME_FIELDS = ("boundary_count", "semantic_hashes", "trace_sha256")
SEMANTIC_HASH_FIELDS = ("boundary", "semantic_sha256")
CLEANUP_FIELDS = (
    "status",
    "process_exit_code",
    "forced_stop",
    "state_may_be_incomplete",
    "fixture_sha256",
    "base_state_sha256_before",
    "base_state_sha256_after",
    "snapshot_sha256_before",
    "snapshot_sha256_after",
    "private_state_disposition",
)
INSPECT_ACTION_FIELDS = (
    "sequence",
    "op",
    "array_kind",
    "index",
    "value",
)
RESUME_ACTION_FIELDS = ("sequence", "op", "breakpoint_slot")
INSPECTOR_LENGTHS = {1: 1024, 2: 32, 3: 2048, 4: 1024, 5: 32}
INPUT_RECEIPT_FIELDS = (
    "byte_size",
    "byte_sha256",
    "schema",
    "schema_version",
    "identity",
)
COMPARATOR_RECEIPT_FIELDS = (
    "contract",
    "identity_kind",
    "execution_identity_nonclaim",
    "source_bytes",
    "source_sha256",
)
RECEIPT_CLEANUP_FIELDS = ("fixture", "arms")
RECEIPT_FIXTURE_FIELDS = (
    "fixture_sha256",
    "base_state_sha256",
    "snapshot_sha256",
)
RECEIPT_POST_FIELDS = (
    "first_boundary",
    "boundary_count",
    "semantic_hashes",
    "trace_sha256",
)
RECEIPT_RESULT_FIELDS = (
    "status",
    "claim",
    "post_resume_boundaries",
    "semantic_trace_sha256",
)
RECEIPT_FIELDS = (
    "schema",
    "schema_version",
    "validation_scope",
    "comparator",
    "inputs",
    "caller_expectation",
    "breakpoint",
    "pre_boundary",
    "pause",
    "actions",
    "cleanup",
    "post_resume",
    "result",
    "receipt_sha256",
)
EXPECTED_FIELDS = (
    *COMMON_IDENTITY_FIELDS,
    *(f"{backend}_{field}" for backend in ("native", "wasm") for field in BACKEND_IDENTITY_FIELDS),
    *(f"breakpoint_{field}" for field in BREAKPOINT_FIELDS),
    "post_resume_boundaries",
)
RECEIPT_VALIDATION_SCOPE = (
    "structural-only-unless-exact-comparator-and-four-capture-preimages-are-validated"
)
SHA256_RE = re.compile(r"[0-9a-f]{64}\Z")
REVISION_RE = re.compile(r"[0-9a-f]{40}\Z")
U32_MAX = (1 << 32) - 1
U64_MAX = (1 << 64) - 1


class ComparisonError(ValueError):
    """A capture is malformed, unselected, incomplete, or divergent."""


class DivergenceError(ComparisonError):
    """Two individually valid captures disagree at a semantic boundary."""

    def __init__(self, comparison: str, field: str, boundary: int | None = None):
        self.comparison = comparison
        self.field = field
        self.boundary = boundary
        detail = f"first divergence: {comparison} field={field}"
        if boundary is not None:
            detail += f" boundary={boundary}"
        super().__init__(detail)


class MissingBoundaryError(DivergenceError):
    """One arm ended before the first boundary available in the other arms."""

    def __init__(self, arm: str, boundary: int):
        self.arm = arm
        self.missing_boundary = boundary
        ComparisonError.__init__(
            self,
            f"first divergence: arm={arm} field=post_resume.semantic_hashes "
            f"missing_boundary={boundary}",
        )


class RejectRepeatedAction(argparse.Action):
    """Argparse action that rejects a second spelling of the same option."""

    def __call__(self, parser, namespace, values, option_string=None):
        if getattr(namespace, self.dest, None) is not None:
            raise argparse.ArgumentError(self, f"option {option_string} may appear only once")
        setattr(namespace, self.dest, values)


def _reject_constant(value: str) -> None:
    raise ComparisonError(f"non-finite JSON number {value} is forbidden")


def _pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ComparisonError(f"duplicate JSON key {key!r}")
        result[key] = value
    return result


def _object(value: Any, fields: tuple[str, ...], path: str) -> dict[str, Any]:
    if type(value) is not dict:
        raise ComparisonError(f"{path} must be an object")
    actual = set(value)
    expected = set(fields)
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    if missing:
        raise ComparisonError(f"{path} missing field {missing[0]}")
    if extra:
        raise ComparisonError(f"{path} has reserved or unknown field {extra[0]}")
    return value


def _exact(value: Any, expected: Any, path: str) -> None:
    if type(value) is not type(expected) or value != expected:
        raise ComparisonError(f"{path} must be exactly {expected!r}")


def _uint(value: Any, maximum: int, path: str, *, positive: bool = False) -> int:
    if type(value) is not int or value < (1 if positive else 0) or value > maximum:
        qualifier = "positive " if positive else ""
        raise ComparisonError(f"{path} must be a {qualifier}unsigned integer <= {maximum}")
    return value


def _sha256(value: Any, path: str) -> str:
    if (
        type(value) is not str
        or SHA256_RE.fullmatch(value) is None
        or value == "0" * 64
    ):
        raise ComparisonError(f"{path} must be a nonzero lowercase SHA-256")
    return value


def _revision(value: Any, path: str) -> str:
    if (
        type(value) is not str
        or REVISION_RE.fullmatch(value) is None
        or value == "0" * 40
    ):
        raise ComparisonError(f"{path} must be a nonzero lowercase 40-hex source revision")
    return value


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")


def semantic_trace_sha256(records: list[dict[str, Any]]) -> str:
    return hashlib.sha256(canonical_json(records)).hexdigest()


def _stable_stat_tuple(metadata: os.stat_result) -> tuple[int, ...]:
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_mode,
        metadata.st_nlink,
        metadata.st_uid,
        metadata.st_gid,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
    )


def _open_capture(path: Path) -> int:
    flags = os.O_RDONLY | os.O_CLOEXEC | os.O_NONBLOCK | os.O_NOFOLLOW
    try:
        return os.open(path, flags)
    except OSError as error:
        raise ComparisonError(f"cannot safely open capture {path}: {error}") from error


def _validate_open_descriptor(
    descriptor: int, path: Path
) -> os.stat_result:
    try:
        metadata = os.fstat(descriptor)
    except OSError as error:
        raise ComparisonError(f"cannot fstat capture {path}: {error}") from error
    if not stat.S_ISREG(metadata.st_mode):
        raise ComparisonError(f"capture {path} is not a regular file")
    if metadata.st_size > MAX_CAPTURE_BYTES:
        raise ComparisonError(
            f"capture {path} exceeds the {MAX_CAPTURE_BYTES}-byte limit"
        )
    return metadata


def _read_open_descriptor(
    descriptor: int, path: Path, before: os.stat_result
) -> bytes:
    data = bytearray()
    try:
        while True:
            remaining_with_sentinel = MAX_CAPTURE_BYTES + 1 - len(data)
            if remaining_with_sentinel <= 0:
                raise ComparisonError(
                    f"capture {path} did not reach EOF within {MAX_CAPTURE_BYTES} bytes"
                )
            chunk = os.read(
                descriptor,
                min(READ_CHUNK_BYTES, remaining_with_sentinel),
            )
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > MAX_CAPTURE_BYTES:
                raise ComparisonError(
                    f"capture {path} did not reach EOF within {MAX_CAPTURE_BYTES} bytes"
                )
        after = os.fstat(descriptor)
    except OSError as error:
        raise ComparisonError(f"cannot safely read capture {path}: {error}") from error
    if _stable_stat_tuple(before) != _stable_stat_tuple(after):
        raise ComparisonError(f"capture {path} changed while it was read")
    if len(data) != after.st_size:
        raise ComparisonError(f"capture {path} byte count does not match fstat size")
    return bytes(data)


def _close_descriptors(descriptors: dict[str, int]) -> list[tuple[str, BaseException]]:
    failures: list[tuple[str, BaseException]] = []
    for arm in reversed(tuple(descriptors)):
        try:
            os.close(descriptors[arm])
        except BaseException as error:
            failures.append((arm, error))
    return failures


def _cleanup_failure_summary(
    cleanup_failures: list[tuple[str, BaseException]],
) -> str:
    return "descriptor cleanup failed: " + "; ".join(
        f"{arm}: {type(error).__name__}: {error}"
        for arm, error in cleanup_failures
    )


def _cleanup_exception(
    cleanup_failures: list[tuple[str, BaseException]],
) -> BaseException:
    summary = _cleanup_failure_summary(cleanup_failures)
    for arm, error in cleanup_failures:
        error.add_note(f"descriptor close failed for {arm}")
    interrupt = next(
        (error for _arm, error in cleanup_failures if not isinstance(error, Exception)),
        None,
    )
    if interrupt is not None:
        remaining = [
            error for _arm, error in cleanup_failures if error is not interrupt
        ]
        if remaining:
            interrupt.__cause__ = BaseExceptionGroup(
                "additional descriptor cleanup failures",
                remaining,
            )
        interrupt.add_note(summary)
        return interrupt
    grouped = ExceptionGroup(
        "descriptor cleanup failures",
        [error for _arm, error in cleanup_failures],
    )
    result = ComparisonError(summary)
    result.__cause__ = grouped
    return result


def _finish_descriptor_transaction(
    primary_error: BaseException | None,
    cleanup_failures: list[tuple[str, BaseException]],
) -> None:
    if primary_error is not None:
        if cleanup_failures:
            summary = _cleanup_failure_summary(cleanup_failures)
            primary_error.add_note(summary)
            raise primary_error from _cleanup_exception(cleanup_failures)
        raise primary_error
    if cleanup_failures:
        raise _cleanup_exception(cleanup_failures)


def safe_read_capture(path: Path) -> tuple[bytes, tuple[int, int]]:
    """Read one bounded regular file without following its final path component."""
    descriptor = _open_capture(path)
    result: tuple[bytes, tuple[int, int]] | None = None
    primary_error: BaseException | None = None
    try:
        before = _validate_open_descriptor(descriptor, path)
        data = _read_open_descriptor(descriptor, path, before)
        result = data, (before.st_dev, before.st_ino)
    except BaseException as error:
        primary_error = error
    cleanup_failures = _close_descriptors({"single": descriptor})
    _finish_descriptor_transaction(primary_error, cleanup_failures)
    assert result is not None
    return result


def safe_read_four(paths: dict[str, Path]) -> dict[str, dict[str, Any]]:
    """Read all four inputs before parsing any input bytes."""
    if set(paths) != set(ARM_SPECS):
        raise ComparisonError("exactly the four named M12 capture paths are required")
    normalized_paths: dict[str, str] = {}
    for arm in ARM_SPECS:
        normalized = os.path.normcase(os.path.abspath(os.fspath(paths[arm])))
        normalized_paths[arm] = normalized
    descriptors: dict[str, int] = {}
    metadata: dict[str, os.stat_result] = {}
    result: dict[str, dict[str, Any]] | None = None
    primary_error: BaseException | None = None
    try:
        # Acquisition phase: no descriptor is read or closed until every input
        # has been opened, fstat-validated, and checked for duplicate identity.
        for arm in ARM_SPECS:
            path = Path(normalized_paths[arm])
            descriptor = _open_capture(path)
            descriptors[arm] = descriptor
            before = _validate_open_descriptor(descriptor, path)
            metadata[arm] = before

        # Cross-input identity is checked only after all four descriptors have
        # passed their individual open/fstat validation.
        seen_paths: dict[str, str] = {}
        for arm in ARM_SPECS:
            normalized = normalized_paths[arm]
            if normalized in seen_paths:
                raise ComparisonError(
                    f"duplicate capture path for {seen_paths[normalized]} and {arm}"
                )
            seen_paths[normalized] = arm
        seen_inodes: dict[tuple[int, int], str] = {}
        for arm in ARM_SPECS:
            before = metadata[arm]
            inode = (before.st_dev, before.st_ino)
            if inode in seen_inodes:
                raise ComparisonError(
                    f"duplicate capture inode for {seen_inodes[inode]} and {arm}"
                )
            seen_inodes[inode] = arm

        result = {}
        for arm in ARM_SPECS:
            path = Path(normalized_paths[arm])
            data = _read_open_descriptor(descriptors[arm], path, metadata[arm])
            result[arm] = {
                "data": data,
                "byte_sha256": hashlib.sha256(data).hexdigest(),
            }
    except BaseException as error:
        primary_error = error
    cleanup_failures = _close_descriptors(descriptors)
    _finish_descriptor_transaction(primary_error, cleanup_failures)
    assert result is not None
    return result


def _validate_identity(value: Any) -> dict[str, Any]:
    identity = _object(value, IDENTITY_FIELDS, "identity")
    for field in IDENTITY_FIELDS:
        if field == "source_revision":
            _revision(identity[field], f"identity.{field}")
        else:
            _sha256(identity[field], f"identity.{field}")
    return identity


def _validate_breakpoint(value: Any) -> dict[str, Any]:
    breakpoint = _object(value, BREAKPOINT_FIELDS, "breakpoint")
    _uint(breakpoint["slot"], 63, "breakpoint.slot")
    kind = _uint(breakpoint["kind"], 5, "breakpoint.kind", positive=True)
    target = _uint(breakpoint["value"], U64_MAX, "breakpoint.value")
    _uint(breakpoint["occurrence"], U64_MAX, "breakpoint.occurrence", positive=True)
    if kind in (1, 2) and target > U32_MAX:
        raise ComparisonError("breakpoint.value exceeds the selected uint32 pre-boundary target")
    if kind in (4, 5) and target != 1:
        raise ComparisonError("boolean post-boundary breakpoint.value must be exactly 1")
    return breakpoint


def _validate_pre_boundary(value: Any) -> dict[str, Any]:
    pre = _object(value, PRE_BOUNDARY_FIELDS, "pre_boundary")
    _uint(pre["boundary_ordinal"], U64_MAX, "pre_boundary.boundary_ordinal")
    _uint(pre["clock_slot"], U64_MAX, "pre_boundary.clock_slot")
    _uint(pre["micro_pc_before"], U32_MAX, "pre_boundary.micro_pc_before")
    _uint(pre["raw_lc_before"], U32_MAX, "pre_boundary.raw_lc_before")
    return pre


def _validate_pause(value: Any, intervened: bool) -> dict[str, Any]:
    pause = _object(value, PAUSE_FIELDS, "pause")
    _exact(pause["observed"], intervened, "pause.observed")
    _exact(pause["operation_slots"], 0, "pause.operation_slots")
    return pause


def _validate_actions(value: Any, intervened: bool, breakpoint_slot: int) -> list[dict[str, Any]]:
    if type(value) is not list:
        raise ComparisonError("actions must be an array")
    if not intervened:
        if value:
            raise ComparisonError("uninterrupted arm actions must be empty")
        return value
    if len(value) != 2:
        raise ComparisonError("intervened arm must have exactly inspect then resume actions")
    inspect = _object(value[0], INSPECT_ACTION_FIELDS, "actions[0]")
    _exact(inspect["sequence"], 0, "actions[0].sequence")
    _exact(inspect["op"], "debug-inspect-read", "actions[0].op")
    array_kind = _uint(
        inspect["array_kind"], 5, "actions[0].array_kind", positive=True
    )
    index = _uint(inspect["index"], U32_MAX, "actions[0].index")
    if index >= INSPECTOR_LENGTHS[array_kind]:
        raise ComparisonError(
            f"actions[0].index exceeds array kind {array_kind} bound "
            f"{INSPECTOR_LENGTHS[array_kind]}"
        )
    _uint(inspect["value"], U32_MAX, "actions[0].value")
    resume = _object(value[1], RESUME_ACTION_FIELDS, "actions[1]")
    _exact(resume["sequence"], 1, "actions[1].sequence")
    _exact(resume["op"], "debug-resume-one-boundary", "actions[1].op")
    _exact(resume["breakpoint_slot"], breakpoint_slot, "actions[1].breakpoint_slot")
    return value


def _validate_post_resume(value: Any) -> dict[str, Any]:
    post = _object(value, POST_RESUME_FIELDS, "post_resume")
    count = _uint(post["boundary_count"], U32_MAX, "post_resume.boundary_count", positive=True)
    records = post["semantic_hashes"]
    if type(records) is not list:
        raise ComparisonError("post_resume.semantic_hashes must be an array")
    if len(records) != count:
        raise ComparisonError("post_resume.boundary_count does not match semantic_hashes")
    previous = None
    for index, value_record in enumerate(records):
        record = _object(value_record, SEMANTIC_HASH_FIELDS, f"post_resume.semantic_hashes[{index}]")
        boundary = _uint(record["boundary"], U64_MAX, f"post_resume.semantic_hashes[{index}].boundary")
        _sha256(record["semantic_sha256"], f"post_resume.semantic_hashes[{index}].semantic_sha256")
        if previous is not None and boundary != previous + 1:
            raise ComparisonError("post_resume semantic boundaries must be contiguous")
        previous = boundary
    digest = _sha256(post["trace_sha256"], "post_resume.trace_sha256")
    if digest != semantic_trace_sha256(records):
        raise ComparisonError("post_resume.trace_sha256 does not bind semantic_hashes")
    return post


def _validate_cleanup(value: Any, identity: dict[str, Any]) -> dict[str, Any]:
    cleanup = _object(value, CLEANUP_FIELDS, "cleanup")
    _exact(cleanup["status"], "verified-clean", "cleanup.status")
    _exact(cleanup["process_exit_code"], 0, "cleanup.process_exit_code")
    _exact(cleanup["forced_stop"], False, "cleanup.forced_stop")
    _exact(cleanup["state_may_be_incomplete"], False, "cleanup.state_may_be_incomplete")
    fixture = _sha256(cleanup["fixture_sha256"], "cleanup.fixture_sha256")
    before = _sha256(cleanup["base_state_sha256_before"], "cleanup.base_state_sha256_before")
    after = _sha256(cleanup["base_state_sha256_after"], "cleanup.base_state_sha256_after")
    if before != after:
        raise ComparisonError("cleanup base state changed")
    snapshot_before = _sha256(
        cleanup["snapshot_sha256_before"], "cleanup.snapshot_sha256_before"
    )
    snapshot_after = _sha256(
        cleanup["snapshot_sha256_after"], "cleanup.snapshot_sha256_after"
    )
    if snapshot_before != snapshot_after:
        raise ComparisonError("cleanup selected snapshot changed")
    if fixture != identity["fixture_sha256"]:
        raise ComparisonError("cleanup fixture does not match identity.fixture_sha256")
    if before != identity["base_state_sha256"]:
        raise ComparisonError(
            "cleanup base state does not match identity.base_state_sha256"
        )
    if snapshot_before != identity["snapshot_sha256"]:
        raise ComparisonError(
            "cleanup snapshot does not match identity.snapshot_sha256"
        )
    _exact(cleanup["private_state_disposition"], "discarded", "cleanup.private_state_disposition")
    return cleanup


def parse_capture_bytes(data: bytes, expected_schema: str, expected_arm: str) -> dict[str, Any]:
    if len(data) > MAX_CAPTURE_BYTES:
        raise ComparisonError(
            f"capture exceeds the {MAX_CAPTURE_BYTES}-byte parser limit"
        )
    if data.startswith(b'{"schema":"CDRM12USIM1"') or b'"schema":"CDRM12USIM1"' in data[:256]:
        raise ComparisonError("CDRM12USIM1 is an old candidate-loop witness and is not admissible")
    if data.startswith(b"\xef\xbb\xbf"):
        raise ComparisonError("UTF-8 BOM is forbidden")
    if not data.endswith(b"\n") or data.endswith(b"\n\n") or b"\r" in data or b"\n" in data[:-1]:
        raise ComparisonError("capture framing must be exactly one UTF-8 JSON line ending in LF")
    try:
        text = data[:-1].decode("utf-8", errors="strict")
        value = json.loads(text, object_pairs_hook=_pairs, parse_constant=_reject_constant)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ComparisonError(f"invalid JSON capture: {error}") from error
    capture = _object(value, TOP_FIELDS, "capture")
    _exact(capture["schema"], expected_schema, "schema")
    _exact(capture["schema_version"], SCHEMA_VERSION, "schema_version")
    _exact(capture["arm"], expected_arm, "arm")
    spec = ARM_SPECS.get(expected_arm)
    if spec is None or spec[0] != expected_schema:
        raise ComparisonError("internal expected arm/schema pairing is invalid")
    intervened = spec[2]
    identity = _validate_identity(capture["identity"])
    breakpoint = _validate_breakpoint(capture["breakpoint"])
    pre_boundary = _validate_pre_boundary(capture["pre_boundary"])
    if (
        breakpoint["kind"] == 1
        and breakpoint["value"] != pre_boundary["micro_pc_before"]
    ):
        raise ComparisonError("breakpoint target does not match pre_boundary.micro_pc_before")
    if (
        breakpoint["kind"] == 2
        and breakpoint["value"] != pre_boundary["raw_lc_before"]
    ):
        raise ComparisonError("breakpoint target does not match pre_boundary.raw_lc_before")
    _validate_pause(capture["pause"], intervened)
    _validate_actions(capture["actions"], intervened, breakpoint["slot"])
    post_resume = _validate_post_resume(capture["post_resume"])
    if pre_boundary["boundary_ordinal"] == U64_MAX:
        raise ComparisonError("pre_boundary.boundary_ordinal has no successor")
    expected_first = pre_boundary["boundary_ordinal"] + 1
    if post_resume["semantic_hashes"][0]["boundary"] != expected_first:
        raise ComparisonError(
            "post_resume first semantic boundary must equal pre_boundary.boundary_ordinal + 1"
        )
    _validate_cleanup(capture["cleanup"], identity)
    return capture


def parse_capture(path: Path, expected_schema: str, expected_arm: str) -> dict[str, Any]:
    data, _inode = safe_read_capture(path)
    return parse_capture_bytes(data, expected_schema, expected_arm)


def _compare_field(left: dict[str, Any], right: dict[str, Any], field: str, comparison: str) -> None:
    if left[field] != right[field]:
        raise DivergenceError(comparison, field)


def _compare_breakpoint_pre_boundary(
    left: dict[str, Any],
    right: dict[str, Any],
    comparison: str,
) -> None:
    for field in BREAKPOINT_FIELDS:
        if left["breakpoint"][field] != right["breakpoint"][field]:
            raise DivergenceError(comparison, f"breakpoint.{field}")
    boundary = left["pre_boundary"]["boundary_ordinal"]
    for field in PRE_BOUNDARY_FIELDS:
        if left["pre_boundary"][field] != right["pre_boundary"][field]:
            raise DivergenceError(comparison, f"pre_boundary.{field}", boundary)


def _compare_all_trace_prefixes(captures: dict[str, dict[str, Any]]) -> None:
    relations = (
        ("native-uninterrupted", "native-intervened", "native intervention/control"),
        ("wasm-uninterrupted", "wasm-intervened", "Wasm intervention/control"),
        ("native-uninterrupted", "wasm-uninterrupted", "native/Wasm control"),
    )
    counts = {
        arm: captures[arm]["post_resume"]["boundary_count"]
        for arm in ARM_SPECS
    }
    common_count = min(counts.values())
    for index in range(common_count):
        for left_arm, right_arm, comparison in relations:
            left_record = captures[left_arm]["post_resume"]["semantic_hashes"][index]
            right_record = captures[right_arm]["post_resume"]["semantic_hashes"][index]
            if left_record["boundary"] != right_record["boundary"]:
                raise DivergenceError(
                    comparison,
                    f"post_resume.semantic_hashes[{index}].boundary",
                    min(left_record["boundary"], right_record["boundary"]),
                )
            if left_record["semantic_sha256"] != right_record["semantic_sha256"]:
                raise DivergenceError(
                    comparison,
                    f"post_resume.semantic_hashes[{index}].semantic_sha256",
                    left_record["boundary"],
                )
    if len(set(counts.values())) != 1:
        arm = next(candidate for candidate in ARM_SPECS if counts[candidate] == common_count)
        first = captures[arm]["post_resume"]["semantic_hashes"][0]["boundary"]
        raise MissingBoundaryError(arm, first + common_count)
    for left_arm, right_arm, comparison in relations:
        if (
            captures[left_arm]["post_resume"]["trace_sha256"]
            != captures[right_arm]["post_resume"]["trace_sha256"]
        ):
            raise DivergenceError(comparison, "post_resume.trace_sha256")


def _compare_actions(left: list[dict[str, Any]], right: list[dict[str, Any]], comparison: str) -> None:
    if len(left) != len(right):
        raise DivergenceError(comparison, "actions.length")
    for index, (left_action, right_action) in enumerate(zip(left, right)):
        for field in left_action:
            if left_action[field] != right_action[field]:
                raise DivergenceError(comparison, f"actions[{index}].{field}")


def _compare_identity(
    left: dict[str, Any], right: dict[str, Any], fields: tuple[str, ...], comparison: str
) -> None:
    for field in fields:
        if left["identity"][field] != right["identity"][field]:
            raise DivergenceError(comparison, f"identity.{field}")


def _validate_expected(value: Any) -> dict[str, Any]:
    expected = _object(value, EXPECTED_FIELDS, "caller_expectation")
    for field in COMMON_IDENTITY_FIELDS:
        _sha256(expected[field], f"caller_expectation.{field}")
    for backend in ("native", "wasm"):
        for field in BACKEND_IDENTITY_FIELDS:
            key = f"{backend}_{field}"
            if field == "source_revision":
                _revision(expected[key], f"caller_expectation.{key}")
            else:
                _sha256(expected[key], f"caller_expectation.{key}")
    breakpoint = {
        field: expected[f"breakpoint_{field}"] for field in BREAKPOINT_FIELDS
    }
    _validate_breakpoint(breakpoint)
    _uint(
        expected["post_resume_boundaries"],
        U32_MAX,
        "caller_expectation.post_resume_boundaries",
        positive=True,
    )
    return expected


def comparator_source_preimage() -> bytes:
    """Capture the current source path; this does not identify loaded bytecode."""
    data, _inode = safe_read_capture(Path(__file__))
    return data


def receipt_sha256(receipt: dict[str, Any]) -> str:
    payload = {field: receipt[field] for field in RECEIPT_FIELDS if field != "receipt_sha256"}
    return hashlib.sha256(canonical_json(payload)).hexdigest()


def compare_four(
    input_preimages: dict[str, bytes],
    expected: dict[str, Any],
    comparator_source: bytes,
) -> dict[str, Any]:
    if type(input_preimages) is not dict or set(input_preimages) != set(ARM_SPECS):
        raise ComparisonError("exactly four input byte preimages are required")
    expected = _validate_expected(expected)
    input_byte_sha256: dict[str, str] = {}
    captures: dict[str, dict[str, Any]] = {}
    for arm in ARM_SPECS:
        data = input_preimages[arm]
        if type(data) is not bytes:
            raise ComparisonError(f"input preimage {arm} must be exact bytes")
        if len(data) > MAX_CAPTURE_BYTES:
            raise ComparisonError(f"input preimage {arm} exceeds parser limit")
        input_byte_sha256[arm] = hashlib.sha256(data).hexdigest()
        captures[arm] = parse_capture_bytes(data, ARM_SPECS[arm][0], arm)

    native_control = captures["native-uninterrupted"]
    native_intervened = captures["native-intervened"]
    wasm_control = captures["wasm-uninterrupted"]
    wasm_intervened = captures["wasm-intervened"]

    _compare_identity(native_control, native_intervened, IDENTITY_FIELDS, "native intervention/control")
    _compare_identity(wasm_control, wasm_intervened, IDENTITY_FIELDS, "Wasm intervention/control")
    _compare_identity(native_control, wasm_control, COMMON_IDENTITY_FIELDS, "native/Wasm control")
    _compare_breakpoint_pre_boundary(
        native_control,
        native_intervened,
        "native intervention/control",
    )
    _compare_breakpoint_pre_boundary(
        wasm_control,
        wasm_intervened,
        "Wasm intervention/control",
    )
    _compare_breakpoint_pre_boundary(
        native_control,
        wasm_control,
        "native/Wasm control",
    )
    _compare_all_trace_prefixes(captures)
    _compare_actions(
        native_intervened["actions"],
        wasm_intervened["actions"],
        "native/Wasm intervention",
    )

    for arm, (_schema, backend, _intervened) in ARM_SPECS.items():
        capture = captures[arm]
        for field in COMMON_IDENTITY_FIELDS:
            if capture["identity"][field] != expected[field]:
                raise ComparisonError(
                    f"{arm} identity.{field} does not match caller_expectation"
                )
        for field in BACKEND_IDENTITY_FIELDS:
            expected_key = f"{backend}_{field}"
            if capture["identity"][field] != expected[expected_key]:
                raise ComparisonError(
                    f"{arm} identity.{field} does not match caller_expectation"
                )
        for field in BREAKPOINT_FIELDS:
            if capture["breakpoint"][field] != expected[f"breakpoint_{field}"]:
                raise ComparisonError(
                    f"{arm} breakpoint.{field} does not match caller_expectation"
                )
        if capture["post_resume"]["boundary_count"] != expected["post_resume_boundaries"]:
            raise ComparisonError(
                f"{arm} post_resume.boundary_count is not the caller-expected fixed count"
            )

    if type(comparator_source) is not bytes:
        raise ComparisonError("comparator source preimage must be exact bytes")
    source_bytes = len(comparator_source)
    source_sha256 = hashlib.sha256(comparator_source).hexdigest()
    _uint(source_bytes, MAX_CAPTURE_BYTES, "comparator.source_bytes", positive=True)
    _sha256(source_sha256, "comparator.source_sha256")
    receipt: dict[str, Any] = {
        "schema": RECEIPT_SCHEMA,
        "schema_version": RECEIPT_SCHEMA_VERSION,
        "validation_scope": RECEIPT_VALIDATION_SCOPE,
        "comparator": {
            "contract": "cadr-m12-breakpoint-continuation-comparator-v1",
            "identity_kind": "observed-path-source-preimage",
            "execution_identity_nonclaim": (
                "does-not-prove-bytes-loaded-before-observed-path-acquisition"
            ),
            "source_bytes": source_bytes,
            "source_sha256": source_sha256,
        },
        "inputs": {
            arm: {
                "byte_size": len(input_preimages[arm]),
                "byte_sha256": input_byte_sha256[arm],
                "schema": captures[arm]["schema"],
                "schema_version": captures[arm]["schema_version"],
                "identity": captures[arm]["identity"],
            }
            for arm in ARM_SPECS
        },
        # This records the caller's selection.  It is not an authority receipt.
        "caller_expectation": expected,
        "breakpoint": native_control["breakpoint"],
        "pre_boundary": native_control["pre_boundary"],
        "pause": {arm: captures[arm]["pause"] for arm in ARM_SPECS},
        "actions": {arm: captures[arm]["actions"] for arm in ARM_SPECS},
        "cleanup": {
            "fixture": {
                field: native_control["identity"][field]
                for field in RECEIPT_FIXTURE_FIELDS
            },
            "arms": {arm: captures[arm]["cleanup"] for arm in ARM_SPECS},
        },
        "post_resume": {
            "first_boundary": native_control["post_resume"]["semantic_hashes"][0]["boundary"],
            **native_control["post_resume"],
        },
        "result": {
            "status": "equal",
            "claim": "four-arm-breakpoint-continuation-semantic-equality",
            "post_resume_boundaries": native_control["post_resume"]["boundary_count"],
            "semantic_trace_sha256": native_control["post_resume"]["trace_sha256"],
        },
    }
    receipt["receipt_sha256"] = receipt_sha256(receipt)
    validate_receipt_structure(receipt)
    return receipt


def validate_receipt_structure(value: Any) -> dict[str, Any]:
    """Validate shape and internal links, not evidence preimages or authority."""
    receipt = _object(value, RECEIPT_FIELDS, "receipt")
    _exact(receipt["schema"], RECEIPT_SCHEMA, "receipt.schema")
    _exact(
        receipt["schema_version"],
        RECEIPT_SCHEMA_VERSION,
        "receipt.schema_version",
    )
    _exact(
        receipt["validation_scope"],
        RECEIPT_VALIDATION_SCOPE,
        "receipt.validation_scope",
    )
    comparator = _object(
        receipt["comparator"], COMPARATOR_RECEIPT_FIELDS, "receipt.comparator"
    )
    _exact(
        comparator["contract"],
        "cadr-m12-breakpoint-continuation-comparator-v1",
        "receipt.comparator.contract",
    )
    _exact(
        comparator["identity_kind"],
        "observed-path-source-preimage",
        "receipt.comparator.identity_kind",
    )
    _exact(
        comparator["execution_identity_nonclaim"],
        "does-not-prove-bytes-loaded-before-observed-path-acquisition",
        "receipt.comparator.execution_identity_nonclaim",
    )
    _uint(
        comparator["source_bytes"],
        MAX_CAPTURE_BYTES,
        "receipt.comparator.source_bytes",
        positive=True,
    )
    _sha256(
        comparator["source_sha256"], "receipt.comparator.source_sha256"
    )

    inputs = _object(receipt["inputs"], tuple(ARM_SPECS), "receipt.inputs")
    identities: dict[str, dict[str, Any]] = {}
    for arm, (schema, _backend, _intervened) in ARM_SPECS.items():
        input_record = _object(
            inputs[arm], INPUT_RECEIPT_FIELDS, f"receipt.inputs.{arm}"
        )
        _uint(
            input_record["byte_size"],
            MAX_CAPTURE_BYTES,
            f"receipt.inputs.{arm}.byte_size",
            positive=True,
        )
        _sha256(input_record["byte_sha256"], f"receipt.inputs.{arm}.byte_sha256")
        _exact(input_record["schema"], schema, f"receipt.inputs.{arm}.schema")
        _exact(
            input_record["schema_version"],
            SCHEMA_VERSION,
            f"receipt.inputs.{arm}.schema_version",
        )
        identities[arm] = _validate_identity(input_record["identity"])

    expected = _validate_expected(receipt["caller_expectation"])
    for arm, (_schema, backend, _intervened) in ARM_SPECS.items():
        for field in COMMON_IDENTITY_FIELDS:
            if identities[arm][field] != expected[field]:
                raise ComparisonError(
                    f"receipt.inputs.{arm}.identity.{field} does not match caller_expectation"
                )
        for field in BACKEND_IDENTITY_FIELDS:
            if identities[arm][field] != expected[f"{backend}_{field}"]:
                raise ComparisonError(
                    f"receipt.inputs.{arm}.identity.{field} does not match caller_expectation"
                )

    breakpoint = _validate_breakpoint(receipt["breakpoint"])
    for field in BREAKPOINT_FIELDS:
        if breakpoint[field] != expected[f"breakpoint_{field}"]:
            raise ComparisonError(
                f"receipt.breakpoint.{field} does not match caller_expectation"
            )
    pre = _validate_pre_boundary(receipt["pre_boundary"])
    if pre["boundary_ordinal"] == U64_MAX:
        raise ComparisonError("receipt pre-boundary ordinal has no successor")
    if breakpoint["kind"] == 1 and breakpoint["value"] != pre["micro_pc_before"]:
        raise ComparisonError("receipt breakpoint does not match pre-boundary micro PC")
    if breakpoint["kind"] == 2 and breakpoint["value"] != pre["raw_lc_before"]:
        raise ComparisonError("receipt breakpoint does not match pre-boundary raw LC")

    pauses = _object(receipt["pause"], tuple(ARM_SPECS), "receipt.pause")
    for arm, (_schema, _backend, intervened) in ARM_SPECS.items():
        _validate_pause(pauses[arm], intervened)

    actions = _object(receipt["actions"], tuple(ARM_SPECS), "receipt.actions")
    for arm, (_schema, _backend, intervened) in ARM_SPECS.items():
        _validate_actions(actions[arm], intervened, breakpoint["slot"])
    _compare_actions(
        actions["native-intervened"],
        actions["wasm-intervened"],
        "receipt native/Wasm intervention",
    )

    cleanup = _object(
        receipt["cleanup"], RECEIPT_CLEANUP_FIELDS, "receipt.cleanup"
    )
    fixture = _object(
        cleanup["fixture"], RECEIPT_FIXTURE_FIELDS, "receipt.cleanup.fixture"
    )
    for field in RECEIPT_FIXTURE_FIELDS:
        selected = _sha256(fixture[field], f"receipt.cleanup.fixture.{field}")
        if selected != expected[field]:
            raise ComparisonError(
                f"receipt.cleanup.fixture.{field} does not match caller_expectation"
            )
    cleanup_arms = _object(cleanup["arms"], tuple(ARM_SPECS), "receipt.cleanup.arms")
    for arm in ARM_SPECS:
        _validate_cleanup(cleanup_arms[arm], identities[arm])
        for field in RECEIPT_FIXTURE_FIELDS:
            if identities[arm][field] != fixture[field]:
                raise ComparisonError(
                    f"receipt cleanup fixture relationship differs for {arm}.{field}"
                )

    post = _object(receipt["post_resume"], RECEIPT_POST_FIELDS, "receipt.post_resume")
    first = _uint(post["first_boundary"], U64_MAX, "receipt.post_resume.first_boundary")
    validated_post = _validate_post_resume(
        {field: post[field] for field in POST_RESUME_FIELDS}
    )
    if first != pre["boundary_ordinal"] + 1:
        raise ComparisonError("receipt first boundary does not immediately follow pre-boundary")
    if validated_post["semantic_hashes"][0]["boundary"] != first:
        raise ComparisonError("receipt first boundary does not bind semantic_hashes")
    if validated_post["boundary_count"] != expected["post_resume_boundaries"]:
        raise ComparisonError("receipt fixed trace count does not match caller_expectation")

    result = _object(receipt["result"], RECEIPT_RESULT_FIELDS, "receipt.result")
    _exact(result["status"], "equal", "receipt.result.status")
    _exact(
        result["claim"],
        "four-arm-breakpoint-continuation-semantic-equality",
        "receipt.result.claim",
    )
    _exact(
        result["post_resume_boundaries"],
        validated_post["boundary_count"],
        "receipt.result.post_resume_boundaries",
    )
    _exact(
        result["semantic_trace_sha256"],
        validated_post["trace_sha256"],
        "receipt.result.semantic_trace_sha256",
    )
    digest = _sha256(receipt["receipt_sha256"], "receipt.receipt_sha256")
    if digest != receipt_sha256(receipt):
        raise ComparisonError("receipt.receipt_sha256 does not bind the canonical receipt")
    return receipt


def validate_receipt_bytes_structure(data: bytes) -> dict[str, Any]:
    """Validate canonical receipt bytes structurally, without evidence authority."""
    if len(data) > MAX_CAPTURE_BYTES:
        raise ComparisonError("receipt exceeds the bounded output size")
    if not data.endswith(b"\n") or data.endswith(b"\n\n") or b"\r" in data or b"\n" in data[:-1]:
        raise ComparisonError("receipt framing must be one canonical JSON line ending in LF")
    try:
        value = json.loads(
            data[:-1].decode("ascii", errors="strict"),
            object_pairs_hook=_pairs,
            parse_constant=_reject_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ComparisonError(f"invalid receipt JSON: {error}") from error
    if canonical_json(value) + b"\n" != data:
        raise ComparisonError("receipt JSON is not canonical")
    return validate_receipt_structure(value)


def validate_receipt_authoritative(
    value: Any,
    *,
    comparator_source_bytes: bytes,
    capture_bytes: dict[str, bytes],
) -> dict[str, Any]:
    """Reproduce a receipt from every exact preimage and require byte equality."""
    receipt = validate_receipt_structure(value)
    if type(comparator_source_bytes) is not bytes:
        raise ComparisonError("authoritative comparator source preimage must be bytes")
    if not comparator_source_bytes or len(comparator_source_bytes) > MAX_CAPTURE_BYTES:
        raise ComparisonError("authoritative comparator source preimage size is invalid")
    if receipt["comparator"]["source_bytes"] != len(comparator_source_bytes):
        raise ComparisonError("comparator source preimage size does not match receipt")
    if receipt["comparator"]["source_sha256"] != hashlib.sha256(
        comparator_source_bytes
    ).hexdigest():
        raise ComparisonError("comparator source preimage hash does not match receipt")
    if type(capture_bytes) is not dict or set(capture_bytes) != set(ARM_SPECS):
        raise ComparisonError("authoritative validation requires exactly four capture preimages")
    for arm in ARM_SPECS:
        data = capture_bytes[arm]
        if type(data) is not bytes:
            raise ComparisonError(f"authoritative capture preimage {arm} must be bytes")
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != receipt["inputs"][arm]["byte_size"]:
            raise ComparisonError(f"capture preimage size does not match receipt for {arm}")
        if digest != receipt["inputs"][arm]["byte_sha256"]:
            raise ComparisonError(f"capture preimage hash does not match receipt for {arm}")
    reproduced = compare_four(
        capture_bytes,
        receipt["caller_expectation"],
        comparator_source_bytes,
    )
    if canonical_json(reproduced) != canonical_json(receipt):
        raise ComparisonError("receipt is not reproduced from the exact preimages")
    return receipt


def validate_receipt_bytes_authoritative(
    data: bytes,
    *,
    comparator_source_bytes: bytes,
    capture_bytes: dict[str, bytes],
) -> dict[str, Any]:
    receipt = validate_receipt_bytes_structure(data)
    return validate_receipt_authoritative(
        receipt,
        comparator_source_bytes=comparator_source_bytes,
        capture_bytes=capture_bytes,
    )


def _sha256_argument(value: str) -> str:
    if SHA256_RE.fullmatch(value) is None or value == "0" * 64:
        raise argparse.ArgumentTypeError("expected a nonzero lowercase SHA-256")
    return value


def _revision_argument(value: str) -> str:
    if REVISION_RE.fullmatch(value) is None or value == "0" * 40:
        raise argparse.ArgumentTypeError("expected a nonzero lowercase 40-hex source revision")
    return value


def _uint_argument(maximum: int, *, positive: bool = False) -> Callable[[str], int]:
    def parse(value: str) -> int:
        try:
            result = int(value, 0)
        except ValueError as error:
            raise argparse.ArgumentTypeError("expected an integer") from error
        if result < (1 if positive else 0) or result > maximum:
            raise argparse.ArgumentTypeError(f"expected integer <= {maximum}")
        return result
    return parse


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify selected native and Wasm M12 breakpoint continuation without running either system.",
        allow_abbrev=False,
    )
    for arm in ARM_SPECS:
        parser.add_argument(
            f"--{arm}", required=True, type=Path, action=RejectRepeatedAction
        )
    for field in COMMON_IDENTITY_FIELDS:
        parser.add_argument(
            f"--expected-{field.replace('_', '-')}",
            required=True,
            type=_revision_argument if field == "source_revision" else _sha256_argument,
            action=RejectRepeatedAction,
        )
    for backend in ("native", "wasm"):
        for field in BACKEND_IDENTITY_FIELDS:
            parser.add_argument(
                f"--expected-{backend}-{field.replace('_', '-')}",
                required=True,
                type=_revision_argument if field == "source_revision" else _sha256_argument,
                action=RejectRepeatedAction,
            )
    parser.add_argument(
        "--expected-breakpoint-slot",
        required=True,
        type=_uint_argument(63),
        action=RejectRepeatedAction,
    )
    parser.add_argument(
        "--expected-breakpoint-kind",
        required=True,
        type=_uint_argument(5, positive=True),
        action=RejectRepeatedAction,
    )
    parser.add_argument(
        "--expected-breakpoint-value",
        required=True,
        type=_uint_argument(U64_MAX),
        action=RejectRepeatedAction,
    )
    parser.add_argument(
        "--expected-breakpoint-occurrence",
        required=True,
        type=_uint_argument(U64_MAX, positive=True),
        action=RejectRepeatedAction,
    )
    parser.add_argument(
        "--expected-post-resume-boundaries",
        required=True,
        type=_uint_argument(U32_MAX, positive=True),
        action=RejectRepeatedAction,
    )
    args = parser.parse_args(argv)
    expected = {
        field: getattr(args, f"expected_{field}") for field in COMMON_IDENTITY_FIELDS
    }
    for backend in ("native", "wasm"):
        for field in BACKEND_IDENTITY_FIELDS:
            expected[f"{backend}_{field}"] = getattr(args, f"expected_{backend}_{field}")
    for field in BREAKPOINT_FIELDS:
        expected[f"breakpoint_{field}"] = getattr(args, f"expected_breakpoint_{field}")
    expected["post_resume_boundaries"] = args.expected_post_resume_boundaries
    try:
        # This is an observed path preimage acquired for the receipt.  The
        # receipt explicitly makes no claim that Python loaded these bytes.
        source_preimage = comparator_source_preimage()
        admitted = safe_read_four(
            {
                arm: getattr(args, arm.replace("-", "_"))
                for arm in ARM_SPECS
            }
        )
        result = compare_four(
            {arm: admitted[arm]["data"] for arm in ARM_SPECS},
            expected,
            source_preimage,
        )
        output = canonical_json(result) + b"\n"
        validate_receipt_bytes_authoritative(
            output,
            comparator_source_bytes=source_preimage,
            capture_bytes={arm: admitted[arm]["data"] for arm in ARM_SPECS},
        )
    except ComparisonError as error:
        print(f"comparison rejected: {error}", file=sys.stderr)
        return 1
    print(output.decode("ascii"), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

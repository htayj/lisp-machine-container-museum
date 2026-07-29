#!/usr/bin/env python3
"""Create the canonical, guest-bound raw-Cadet M6 DEBUG-IR schedule.

The emitted schedule is intentionally data, not a best-effort typing macro:
every raw transition has one exact guest-cycle deadline.  Form B transitions
are marked as gated and the native producer refuses to dispatch them until
the complete Form-A DEBUG-IR triplet was observed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "l/usim/cadet.defs"
SCHEMA = "cadr-m6-raw-cadet-boundary-schedule-v1"
TICK = 1_000_000
BOOT_START = 25_000_000
N_START = 27_000_000
# The successful native witness evaluates both full forms from this anchor;
# later anchors remain available only for discovery variants.
FORM_A_START = 50_000_000
FORM_B_HOLD = 20_000_000
INPUT_CHUNK_CHARS = 16
INPUT_CHUNK_PAUSE = 10_000_000
C_LISTENER_IDLE_TIMEOUT = 100_000_000
C_LISTENER_IDLE_CLEANUP_HOLD = 1_000_000

FORM_A = "(let ((l tv::initial-lisp-listener)) (and l (eq l tv::selected-window) (send l :exposed-p) (typep l 'tv:lisp-listener) (let ((p (send l :process))) (and (eq p si::current-process) (typep p 'si:process) (typep (process-stack-group p) 'stack-group) (eq (send l :lisp-listener-p) :busy) (eq *terminal-io* l) (progn (%unibus-write #o766000 #o{0}) (%unibus-write #o766002 #o{1}) (%unibus-write #o766004 #o{2}) t)))))"
WORDS = (("46466", "40461", "122532"), ("46466", "41062", "55245"),
         ("46466", "44504", "46105"))
# The listener executes Form B while :BUSY.  It captures its actual window,
# owner process, and owner stack group, starts an observer, and only then emits
# B.  The observer yields until :IDLE, then rechecks the same objects inside a
# scheduling-inhibited critical section before emitting C.  It deliberately
# makes no claim about tagged pointers, READ-FOR-TOP-LEVEL, or input emptiness.
C_OBSERVER = "(lambda (l p sg) (process-wait \"M6\" #'(lambda (l) (eq (send l :lisp-listener-p) :idle)) l) (without-interrupts (and (eq l tv::initial-lisp-listener) (eq l tv::selected-window) (typep l 'tv:lisp-listener) (send l :exposed-p) (eq (send l :process) p) (typep p 'si:process) (eq (process-stack-group p) sg) (typep sg 'stack-group) (eq (send l :lisp-listener-p) :idle) (progn (%unibus-write #o766000 #o46466) (%unibus-write #o766002 #o44504) (%unibus-write #o766004 #o46105) t))))"
FORM_B = "(let ((l tv::initial-lisp-listener)) (and l (eq l tv::selected-window) (send l :exposed-p) (typep l 'tv:lisp-listener) (let ((p (send l :process))) (let ((sg (process-stack-group p))) (and (eq p si::current-process) (typep p 'si:process) (typep sg 'stack-group) (eq (send l :lisp-listener-p) :busy) (eq *terminal-io* l) (progn (process-run-function \"M6\" #'" + C_OBSERVER + " l p sg) (%unibus-write #o766000 #o46466) (%unibus-write #o766002 #o41062) (%unibus-write #o766004 #o55245) t))))))"
SPECIAL = {"(": "parenleft", ")": "parenright", ":": "colon", "'": "apostrophe", "\"": "quotedbl", "-": "minus", " ": "space", "#": "numbersign", "%": "percent", "*": "asterisk"}
MODIFIER = {"CADET_IX_SHIFT": (0o24, 1), "CADET_IX_TOP": (0o104, 4), "CADET_IX_GREEK": (0o44, 2)}


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def mapping(path: Path) -> dict[str, tuple[int, str]]:
    if not path.is_file() or path.is_symlink():
        raise ValueError("pinned Cadet mapping is not a regular file")
    values = {name.strip(): (int(value, 8), shift) for name, value, shift in re.findall(r"X\(([^,]+),\s*(0[0-7]+),\s*(CADET_IX_[A-Z]+)\)", path.read_text(encoding="utf-8"))}
    if len(values) < 40 or "return" not in values:
        raise ValueError("pinned Cadet mapping is incomplete")
    return values


def transitions(text: str, values: dict[str, tuple[int, str]]) -> list[int]:
    result: list[int] = []
    for character in text:
        name = SPECIAL.get(character, character if character in values else character.lower())
        if name not in values:
            raise ValueError(f"no pinned Cadet mapping for {character!r}")
        code, want = values[name]
        if want == "CADET_IX_UNSHIFT": result.extend((code, 0x8000))
        else:
            modifier, mask = MODIFIER[want]
            result.extend((modifier, code, 0x8000 | mask, 0x8000))
    return result


def character_transitions(text: str, values: dict[str, tuple[int, str]]) -> list[list[int]]:
    """Encode one raw-Cadet all-up frame sequence per source character."""
    return [transitions(character, values) for character in text]


def batch(phase: str, start: int, codes: list[int]) -> list[dict[str, Any]]:
    # ceil(n*1,000,000/60): selected M5 rational 60 Hz policy.
    return [{"phase": phase, "due_boundary": str(start + ((index * TICK + 59) // 60)), "scancode": code}
            for index, code in enumerate(codes)]


def chunked_batch(phase: str, start: int, text: str,
                  values: dict[str, tuple[int, str]],
                  chunk_chars: int, chunk_pause: int) -> list[dict[str, Any]]:
    """Keep a bounded Listener typeahead burst, then wait guest boundaries.

    The release schedule uses a 16-character burst and a 10M-boundary pause.
    Raw events within a chunk retain the selected rational 60 Hz spacing; the
    pause is a named guest-boundary interval after each complete character
    chunk, never a host-time sleep.
    """
    if chunk_chars < 1 or chunk_pause < 1:
        raise ValueError("chunk_chars and chunk_pause must be positive")
    result: list[dict[str, Any]] = []
    chunk_start = start
    in_chunk = 0
    for character_index, frames in enumerate(character_transitions(text, values)):
        for frame_index, code in enumerate(frames):
            result.append({"phase": phase,
                           "due_boundary": str(chunk_start +
                                               ((frame_index * TICK + 59) // 60)),
                           "scancode": code})
        in_chunk += 1
        if in_chunk == chunk_chars and character_index + 1 != len(text):
            chunk_start = int(result[-1]["due_boundary"]) + chunk_pause
            in_chunk = 0
        elif character_index + 1 != len(text):
            chunk_start = int(result[-1]["due_boundary"]) + ((TICK + 59) // 60)
    return result


def chunks(events: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """The frozen transport admits batches of one through 64 raw events."""
    return [events[offset:offset + 64] for offset in range(0, len(events), 64)]


def schedule(form_a_start: int = FORM_A_START, *,
             discovery_form_a: str | None = None,
             form_b_hold: int = FORM_B_HOLD,
             discovery_chunk_chars: int | None = INPUT_CHUNK_CHARS,
             discovery_chunk_pause: int | None = INPUT_CHUNK_PAUSE) -> dict[str, Any]:
    """Build the frozen schedule, or an explicitly marked discovery variant.

    The optional arguments exist only to diagnose a native run.  The no-argument
    result is the release candidate consumed by the strict verifier.
    """
    if form_b_hold < 1:
        raise ValueError("form_b_hold must be positive")
    if ((discovery_chunk_chars is None) != (discovery_chunk_pause is None)):
        raise ValueError("discovery chunk character count and pause must be paired")
    values = mapping(SOURCE)
    boot = batch("boot", BOOT_START, transitions("\r", {**values, "\r": values["return"]}))
    n = batch("boot", N_START,
              transitions("N\r", {**values, "N": values["N"], "\r": values["return"]}))
    form_a_text = (FORM_A.format(*WORDS[0]) if discovery_form_a is None
                   else discovery_form_a)
    a_text = form_a_text + "\r"
    expanded = {**values, "\r": values["return"]}
    a = (batch("form-a", form_a_start, transitions(a_text, expanded))
         if discovery_chunk_chars is None else
         chunked_batch("form-a", form_a_start, a_text, expanded,
                       discovery_chunk_chars, discovery_chunk_pause))
    # B has its own exact deadlines, but the native producer additionally
    # requires Form A's observed triplet before it will send the first event.
    b_start = int(a[-1]["due_boundary"]) + form_b_hold
    form_b_text = FORM_B
    b_text = form_b_text + "\r"
    b = (batch("form-b", b_start, transitions(b_text, expanded))
         if discovery_chunk_chars is None else
         chunked_batch("form-b", b_start, b_text, expanded,
                       discovery_chunk_chars, discovery_chunk_pause))
    index = 0
    for item in (boot, n, a, b):
        for event in item:
            event["index"] = index; index += 1
    schedule_value = {"schema": SCHEMA, "event_count": index,
                      "pre_a_batches": chunks(boot) + chunks(n) + chunks(a),
                      "post_a_batches": chunks(b)}
    forms = {"a": {"utf8": form_a_text, "utf8_sha256": hashlib.sha256(form_a_text.encode()).hexdigest(), "magic48": "a55a41314d36", "words16": [0x4d36, 0x4131, 0xa55a]},
             "b": {"utf8": form_b_text, "utf8_sha256": hashlib.sha256(form_b_text.encode()).hexdigest(), "magic48": "5aa542324d36", "words16": [0x4d36, 0x4232, 0x5aa5]},
             "c": {"utf8": C_OBSERVER, "utf8_sha256": hashlib.sha256(C_OBSERVER.encode()).hexdigest(), "magic48": "4c4549444d36", "words16": [0x4d36, 0x4944, 0x4c45]}}
    return {"schedule": {**schedule_value, "sha256": hashlib.sha256(canonical(schedule_value)).hexdigest()},
            "mapping": {"path": "l/usim/cadet.defs", "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest()},
            "forms": forms,
            "timing": {
                "clock_policy": "ceil(n*1000000/60)",
                "initial_return_boundary": str(BOOT_START),
                "form_a_start_boundary": str(form_a_start),
                "form_b_hold_boundaries": str(form_b_hold),
                "input_chunk_characters": discovery_chunk_chars,
                "input_chunk_pause_boundaries": str(discovery_chunk_pause),
                "intra_chunk_frame_policy": "ceil(n*1000000/60)",
                "listener_idle_c_timeout_boundaries": str(C_LISTENER_IDLE_TIMEOUT),
                "listener_idle_c_cleanup_hold_boundaries": str(C_LISTENER_IDLE_CLEANUP_HOLD),
            }}


def write_native(schedule_value: dict[str, Any], path: Path) -> None:
    phases = {"boot": 0, "form-a": 1, "form-b": 2}
    schedule = schedule_value["schedule"]
    events = [event for batch in schedule["pre_a_batches"] + schedule["post_a_batches"] for event in batch]
    lines = [f"CADR-M6-SCHEDULE-v1 {schedule['sha256']} {len(events)}"]
    lines += [f"{event['due_boundary']} {event['index']} {event['scancode']:o} {phases[event['phase']]}" for event in events]
    temporary = path.with_name("." + path.name + ".tmp")
    temporary.write_text("\n".join(lines) + "\n", encoding="ascii")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--native-output", type=Path)
    parser.add_argument("--form-a-start", type=int, help="discovery-only guest boundary override")
    parser.add_argument("--discovery-form-a",
                        help="replace Form A with an exact diagnostic input; never a release schedule")
    parser.add_argument("--form-b-hold", type=int, default=FORM_B_HOLD,
                        help="guest-boundary delay after Form A; discovery-only when not the frozen default")
    parser.add_argument("--discovery-chunk-chars", type=int, default=INPUT_CHUNK_CHARS,
                        help="maximum form characters per raw 60Hz burst; discovery only")
    parser.add_argument("--discovery-chunk-pause", type=int, default=INPUT_CHUNK_PAUSE,
                        help="guest-boundary pause after each form burst; discovery only")
    arguments = parser.parse_args()
    if arguments.form_a_start is not None and arguments.form_a_start < FORM_A_START:
        parser.error("--form-a-start cannot precede the frozen default")
    if arguments.discovery_form_a is not None and not arguments.discovery_form_a:
        parser.error("--discovery-form-a must not be empty")
    if arguments.form_b_hold < 1:
        parser.error("--form-b-hold must be positive")
    if ((arguments.discovery_chunk_chars is None) !=
            (arguments.discovery_chunk_pause is None)):
        parser.error("--discovery-chunk-chars and --discovery-chunk-pause must be used together")
    if ((arguments.discovery_chunk_chars is not None and
         (arguments.discovery_chunk_chars < 1 or arguments.discovery_chunk_pause < 1))):
        parser.error("discovery chunk size and pause must be positive")
    result = schedule(arguments.form_a_start or FORM_A_START,
                      discovery_form_a=arguments.discovery_form_a,
                      form_b_hold=arguments.form_b_hold,
                      discovery_chunk_chars=arguments.discovery_chunk_chars,
                      discovery_chunk_pause=arguments.discovery_chunk_pause)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = arguments.output.with_name("." + arguments.output.name + ".tmp")
    temporary.write_bytes(canonical(result) + b"\n"); temporary.replace(arguments.output)
    if arguments.native_output is not None:
        arguments.native_output.parent.mkdir(parents=True, exist_ok=True)
        write_native(result, arguments.native_output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

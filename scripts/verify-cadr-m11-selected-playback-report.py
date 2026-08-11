#!/usr/bin/env python3
"""Independent verifier for sealed-source M11 browser evidence reports."""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import re
import stat
import struct
import subprocess
import sys
import tempfile

EXPECTED_PATHS = {
    "/cadr-web/browser/cadr-m11-selected-playback.html": "cadr-web/browser/cadr-m11-selected-playback.html",
    "/cadr-web/browser/cadr-m11-selected-playback.mjs": "cadr-web/browser/cadr-m11-selected-playback.mjs",
    "/cadr-web/browser/cadr-m13-audio-boundary.mjs": "cadr-web/browser/cadr-m13-audio-boundary.mjs",
    "/cadr-web/browser/cadr-m13-browser-audio-factory.mjs": "cadr-web/browser/cadr-m13-browser-audio-factory.mjs",
    "/cadr-web/browser/cadr-m13-audio-reducer.mjs": "cadr-web/browser/cadr-m13-audio-reducer.mjs",
    "/cadr-web/browser/cadr-m13-audio-record.mjs": "cadr-web/browser/cadr-m13-audio-record.mjs",
    "/cadr-web/browser/cadr-m13-audio-worklet.mjs": "cadr-web/browser/cadr-m13-audio-worklet.mjs",
    "/cadr-web/wasm/cadr-m13-audio-source.mjs": "cadr-web/wasm/cadr-m13-audio-source.mjs",
    "/cadr-web/build/cadr-web-m13-audio-O2.wasm": "cadr-web/build/cadr-web-m13-audio-O2.wasm",
}
REQUIRED_EXACT = {".gitignore", "cadr-web/Makefile", "cadr-web/wasm/build-wasm.sh",
    "cadr-web/wasm/cadr_wasm_adapter.c", "cadr-web/wasm/cadr_wasm_adapter.h",
    "cadr-web/wasm/cadr_wasm_runtime.c", "cadr-web/wasm/cadr_wasm_runtime.h",
    "scripts/cadr-m11-fixed-table-oracle.py",
    "scripts/verify-cadr-m11-selected-playback-report.py",
    "tests/test_cadr_m11_selected_playback.py",
    *(path for path in EXPECTED_PATHS.values() if not path.startswith("cadr-web/build/"))}
PREFIXES = ("cadr-web/core/", "cadr-web/include/", "cadr-web/trace/", "cadr-web/wasm/include/")
WASM_SHA256 = "0768c02a0be066cd71ded1882e00e0cdae64e4d1a7197bf89a23801190722c76"
CHROMIUM_LAUNCH_FLAGS = [
    "--disable-background-networking", "--disable-component-update",
    "--disable-domain-reliability", "--disable-sync", "--metrics-recording-only",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
]


def unique(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON key {key}")
        value[key] = item
    return value


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def exact_keys(value, keys, label):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(f"{label} has missing or unknown fields")


CLAIM_KEYS = ["selectedWasm", "syntheticCdrauds1", "realAudioWorklet",
              "guestGeneratedPcm", "physicalDevice", "votrax", "cM11Closed"]
STATE_KEYS = ["sha256", "bytes", "headSequence", "nextSequence", "queuedFrames", "packetCount"]
DELIVERY_KEYS = ["generation", "consumerEpoch", "sequence", "frameOffset", "frames",
                 "pcmSha256", "cursorSha256"]
RECEIPT_KEYS = ["kind", "generation", "consumerEpoch", "sequence", "frameOffset"]
BOUNDARY_KEYS = ["state", "generation", "consumerEpoch", "queuePackets", "queuedFrames"]
TERMINAL_KEYS = ["closeRejections", "contextCloseCalls", "contextState",
                 "disconnectPasses", "kind", "nodeAllocatedAfterFirstDisconnect",
                 "nodeDisconnects", "openStatus", "phaseTrace", "terminalState"]
NEVER_TERMINAL_KEYS = ["closeRejections", "contextCloseCalls", "contextState",
                       "disconnectPasses", "nodeAllocatedAfterFirstDisconnect",
                       "nodeDisconnects", "openStatus", "phaseTrace", "stage", "startStillPending",
                       "terminalState"]
TERMINAL_KINDS = ["reject", "resolve"]
NEVER_TERMINAL_STAGES = ["after-module", "after-node", "before-module"]


def validate_report_shapes(report):
    exact_keys(report, ["claims", "cleanup", "evidence", "observation", "schema"], "report")
    exact_keys(report["claims"], CLAIM_KEYS, "report claims")
    exact_keys(report["cleanup"], ["isolated_stage_removed"], "report cleanup")
    evidence = report["evidence"]
    exact_keys(evidence, ["schema", "source", "tools", "wasm"], "evidence")
    source = evidence["source"]
    exact_keys(source, ["base_commit", "base_signature", "base_tree", "closure_entries",
        "closure_manifest_sha256", "patch", "proposed_tree", "untracked_count",
        "worktree_matches_index"], "source evidence")
    exact_keys(source["base_signature"], ["verified", "fingerprint"], "base signature")
    exact_keys(source["patch"], ["bytes", "mode", "sha256"], "patch evidence")
    for index, entry in enumerate(source["closure_entries"]):
        exact_keys(entry, ["path", "bytes", "sha256"], f"closure entry {index}")
    tools = evidence["tools"]
    exact_keys(tools, ["guix_channel_commit", "clang", "wasm_ld", "chromium", "python",
        "playwright", "git"], "tool evidence")
    for name in ["clang", "wasm_ld"]:
        exact_keys(tools[name], ["path", "version", "sha256"], f"{name} evidence")
    exact_keys(tools["chromium"], ["launcher", "payload", "launch_flags"], "Chromium evidence")
    for name in ["launcher", "payload"]:
        exact_keys(tools["chromium"][name], ["path", "bytes", "sha256", "command_version"],
            f"Chromium {name} evidence")
    if tools["chromium"]["launch_flags"] != CHROMIUM_LAUNCH_FLAGS:
        raise ValueError("Chromium launch flags differ")
    exact_keys(tools["playwright"], ["version", "sync_api"], "Playwright evidence")
    exact_keys(tools["playwright"]["sync_api"], ["path", "bytes", "sha256"],
        "Playwright sync API identity")
    exact_keys(evidence["wasm"], ["bytes", "sha256", "forced_build", "isolated_stage"],
        "Wasm evidence")
    observation = report["observation"]
    exact_keys(observation, ["browser", "browser_process", "browser_version", "cleanup", "errors", "network"],
        "observation")
    exact_keys(observation["browser_process"], ["payload_path"], "browser process observation")
    exact_keys(observation["cleanup"], ["browser_closed", "context_closed", "server_closed",
        "server_thread_stopped"], "observation cleanup")
    network = observation["network"]
    exact_keys(network, ["blocked_requests", "cdp_request_paths", "loopback_only", "policy",
        "request_paths", "response_sha256", "websockets"], "network observation")
    exact_keys(network["response_sha256"], [*EXPECTED_PATHS, "/m11-selected-fixture.json"],
        "response identity map")
    result = observation["browser"]
    exact_keys(observation["errors"], ["pageErrors", "unhandledRejections"], "browser errors")
    if observation["errors"] != {"pageErrors": [], "unhandledRejections": []}: raise ValueError("browser errors")
    exact_keys(result, ["activation", "boundary", "calls", "claimBoundary", "contexts",
        "deliveries", "fixture", "observations", "statuses", "terminal", "terminalNever", "wasm"], "browser observation")
    exact_keys(result["boundary"], BOUNDARY_KEYS, "browser boundary")
    exact_keys(result["claimBoundary"], CLAIM_KEYS, "browser claim boundary")
    exact_keys(result["fixture"], ["name", "snapshotBytes", "snapshotSha256",
        "oracleSourceIdentities"], "browser fixture")
    exact_keys(result["fixture"]["oracleSourceIdentities"], ["core_source_sha256",
        "oracle_source_sha256", "script_source_sha256"], "oracle source identities")
    exact_keys(result["wasm"], ["bytes", "sha256"], "browser Wasm")
    for index, context in enumerate(result["contexts"]):
        exact_keys(context, ["state", "sampleRate", "disconnected", "staged", "acknowledgements"],
            f"browser context {index}")
    exact_keys(result["terminal"], TERMINAL_KINDS, "terminal observation")
    for kind, terminal in result["terminal"].items():
        exact_keys(terminal, TERMINAL_KEYS, f"terminal {kind}")
    exact_keys(result["terminalNever"], NEVER_TERMINAL_STAGES, "never-settling terminal observation")
    for stage, terminal in result["terminalNever"].items():
        exact_keys(terminal, NEVER_TERMINAL_KEYS, f"never-settling terminal {stage}")
    for index, delivery in enumerate(result["deliveries"]):
        exact_keys(delivery, DELIVERY_KEYS, f"browser delivery {index}")
    call_keys = [["op"], ["op"], ["op", "generation", "sequence", "frameOffset", "requestedFrames"],
        ["op"], ["op"], ["op", "generation", "sequence", "frameOffset", "requestedFrames"],
        ["op", "generation", "sequence", "frameOffset", "frames"]]
    if len(result["calls"]) != len(call_keys):
        raise ValueError("browser calls have missing or unknown entries")
    for index, (call, keys) in enumerate(zip(result["calls"], call_keys, strict=True)):
        exact_keys(call, keys, f"browser call {index}")
    observations = result["observations"]
    exact_keys(observations, ["committed", "final", "initial", "paused", "resumed", "staged"],
        "browser state observations")
    for phase in ["initial", "paused", "final"]:
        exact_keys(observations[phase], STATE_KEYS, f"{phase} snapshot")
    for phase in ["staged", "resumed"]:
        exact_keys(observations[phase], ["delivery", "staged"], f"{phase} wrapper")
        exact_keys(observations[phase]["delivery"], DELIVERY_KEYS, f"{phase} delivery")
        exact_keys(observations[phase]["staged"], RECEIPT_KEYS, f"{phase} receipt")
    exact_keys(observations["committed"], ["receipt", "sourceInFlightRecords", "boundary"],
        "committed wrapper")
    exact_keys(observations["committed"]["receipt"], [*RECEIPT_KEYS, "queuePackets", "queuedFrames"],
        "committed receipt")
    exact_keys(observations["committed"]["boundary"], BOUNDARY_KEYS, "committed boundary")


def nested(value, path):
    for component in path:
        value = value[component]
    return value


WRAPPER_SHAPE_PATHS = (
    (), ("claims",), ("cleanup",), ("evidence",), ("evidence", "source"),
        ("evidence", "source", "base_signature"), ("evidence", "source", "patch"),
        ("evidence", "source", "closure_entries", 0), ("evidence", "tools"),
        ("evidence", "tools", "clang"), ("evidence", "tools", "wasm_ld"),
        ("evidence", "tools", "chromium"), ("evidence", "wasm"), ("observation",),
        ("observation", "cleanup"), ("observation", "network"),
        ("observation", "network", "response_sha256"), ("observation", "browser"),
        ("observation", "browser", "boundary"), ("observation", "browser", "claimBoundary"),
        ("observation", "browser", "fixture"),
        ("observation", "browser", "fixture", "oracleSourceIdentities"),
        ("observation", "browser", "wasm"), ("observation", "browser", "contexts", 0),
        ("observation", "browser", "contexts", 1),
        ("observation", "browser", "deliveries", 0),
        ("observation", "browser", "deliveries", 1), ("observation", "browser", "calls", 0),
        ("observation", "browser", "observations"),
        ("observation", "browser", "observations", "initial"),
        ("observation", "browser", "observations", "paused"),
        ("observation", "browser", "observations", "final"),
        ("observation", "browser", "observations", "staged"),
        ("observation", "browser", "observations", "staged", "delivery"),
        ("observation", "browser", "observations", "staged", "staged"),
        ("observation", "browser", "observations", "resumed"),
        ("observation", "browser", "observations", "resumed", "delivery"),
        ("observation", "browser", "observations", "resumed", "staged"),
        ("observation", "browser", "observations", "committed"),
        ("observation", "browser", "observations", "committed", "receipt"),
        ("observation", "browser", "observations", "committed", "boundary"))

PHYSICAL_AUDIBLE_MUTANT_PATHS = frozenset((
    ("claims",),
    ("observation", "browser", "claimBoundary"),
    ("observation", "browser", "observations", "staged"),
    ("observation", "browser", "observations", "resumed"),
))


def verify_shape_mutants(report):
    if len(WRAPPER_SHAPE_PATHS) != 41:
        raise RuntimeError("M11 report verifier must enumerate exactly 41 wrapper paths")
    for path in WRAPPER_SHAPE_PATHS:
        for missing in [False, True]:
            mutant = copy.deepcopy(report); target = nested(mutant, path)
            if missing:
                target.pop(next(iter(target)))
            else:
                target["physicalDeviceAudible" if path in PHYSICAL_AUDIBLE_MUTANT_PATHS
                       else "unknownField"] = True
            try:
                validate_report_shapes(mutant)
            except (KeyError, TypeError, ValueError):
                continue
            raise ValueError(f"independent verifier accepted shape mutant at {path}")


def terminal_leaf_paths():
    paths = [("observation", "browser", "terminal", kind) for kind in TERMINAL_KINDS]
    paths.extend(("observation", "browser", "terminalNever", stage)
                 for stage in NEVER_TERMINAL_STAGES)
    return paths


def verify_terminal_shape_mutants(report):
    """Reject a missing and a replacement unknown field for every terminal leaf.

    This is intentionally separate from wrapper mutations: terminal evidence is a
    finite decision matrix, and each field of each resolve/reject and each
    never-settling stage is a distinct observable claim.
    """
    for path in terminal_leaf_paths():
        terminal = nested(report, path)
        for field in tuple(terminal):
            missing = copy.deepcopy(report); nested(missing, path).pop(field)
            try:
                validate_report_shapes(missing)
            except (KeyError, TypeError, ValueError):
                pass
            else:
                raise ValueError(f"independent verifier accepted missing terminal field {path}/{field}")
            unknown = copy.deepcopy(report); target = nested(unknown, path)
            value = target.pop(field); target[field + "Unknown"] = value
            try:
                validate_report_shapes(unknown)
            except (KeyError, TypeError, ValueError):
                continue
            raise ValueError(f"independent verifier accepted unknown terminal field {path}/{field}")


def digest_bytes(value):
    return hashlib.sha256(value).hexdigest()


def digest_file(path):
    with path.open("rb") as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def regular_identity(path):
    info = path.lstat()
    if path.is_symlink() or not stat.S_ISREG(info.st_mode):
        raise ValueError(f"identity path is not a regular non-symlink file: {path}")
    return {"path": str(path), "bytes": info.st_size, "sha256": digest_file(path)}


def chromium_payload(launcher):
    launcher = launcher.resolve(strict=True)
    matches = set()
    for value in re.findall(rb"(/[A-Za-z0-9._/+@%=-]+/chromium)\x00", launcher.read_bytes()):
        try:
            candidate = Path(value.decode()).resolve(strict=True)
            regular_identity(candidate)
        except (OSError, ValueError):
            continue
        matches.add(candidate)
    if len(matches) != 1:
        raise ValueError("Chromium launcher has no single absolute payload path")
    return next(iter(matches))


def playwright_identity():
    module = importlib.util.find_spec("playwright.sync_api")
    if module is None or module.origin is None:
        raise ValueError("Playwright sync API module is unavailable")
    return {"version": importlib.metadata.version("playwright"),
            "sync_api": regular_identity(Path(module.origin).resolve(strict=True))}


def run(args, cwd, *, binary=False):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True,
                          text=not binary)


def load(path):
    raw = path.read_bytes()
    value = json.loads(raw, object_pairs_hook=unique)
    if raw != canonical(value):
        raise ValueError("report is not canonical JSON plus one newline")
    return raw, value


def source_facts(stage, expected_base):
    untracked = run(["git", "ls-files", "--others", "--exclude-standard"], stage).stdout.splitlines()
    worktree_delta = run(["git", "diff", "--name-only"], stage).stdout
    return {"base_tree": run(["git", "rev-parse", f"{expected_base}^{{tree}}"], stage).stdout.strip(),
            "untracked_count": len(untracked),
            "worktree_matches_index": not worktree_delta and not untracked}


def require_source_facts(source, facts):
    for field, actual in facts.items():
        if source[field] != actual:
            raise ValueError(f"report source {field} differs from independently replayed fact")


def verify_source_fact_mutants(source, facts):
    for field, replacement in [
        ("base_tree", "0" * 40),
        ("untracked_count", facts["untracked_count"] + 1),
        ("worktree_matches_index", not facts["worktree_matches_index"]),
    ]:
        mutant = copy.deepcopy(source); mutant[field] = replacement
        try:
            require_source_facts(mutant, facts)
        except ValueError:
            continue
        raise ValueError(f"independent verifier accepted source fact mutant: {field}")


def verify_source(report, repository, patch, expected_base, expected_tree, stage):
    source = report["evidence"]["source"]
    if source["base_commit"] != expected_base or source["proposed_tree"] != expected_tree:
        raise ValueError("report source identity differs from verifier selection")
    patch_info = patch.lstat()
    if patch.is_symlink() or not stat.S_ISREG(patch_info.st_mode):
        raise ValueError("patch is not regular")
    actual_patch = {"bytes": patch_info.st_size, "mode": stat.S_IMODE(patch_info.st_mode),
                    "sha256": digest_file(patch)}
    if source["patch"] != actual_patch:
        raise ValueError("report patch identity differs")
    verified = run(["git", "verify-commit", "--raw", expected_base], repository)
    signature = verified.stdout + verified.stderr
    match = re.search(r"\[GNUPG:\] VALIDSIG ([0-9A-F]{40}) ", signature)
    if match is None or source["base_signature"] != {"verified": True,
                                                       "fingerprint": match.group(1)}:
        raise ValueError("base signature identity differs")
    run(["git", "clone", "--no-hardlinks", "--quiet", str(repository), str(stage)], repository)
    run(["git", "checkout", "--detach", "--quiet", expected_base], stage)
    base_facts = source_facts(stage, expected_base)
    require_source_facts(source, base_facts)
    verify_source_fact_mutants(source, base_facts)
    run(["git", "apply", "--check", str(patch)], stage)
    run(["git", "apply", str(patch)], stage); run(["git", "add", "-A"], stage)
    tree = run(["git", "write-tree"], stage).stdout.strip()
    if tree != expected_tree:
        raise ValueError("replayed patch tree differs")
    replayed = run(["git", "diff", "--cached", "--binary", "HEAD"], stage,
                   binary=True).stdout
    if digest_bytes(replayed) != actual_patch["sha256"]:
        raise ValueError("replayed base-to-tree patch differs")
    tracked = run(["git", "ls-files"], stage).stdout.splitlines()
    selected = sorted(path for path in tracked if path in REQUIRED_EXACT or path.startswith(PREFIXES))
    if not REQUIRED_EXACT.issubset(selected):
        raise ValueError("required transitive source is absent")
    entries = []
    for relative in selected:
        path = stage / relative; info = path.lstat()
        if path.is_symlink() or not stat.S_ISREG(info.st_mode):
            raise ValueError(f"closure path is not regular: {relative}")
        entries.append({"path": relative, "bytes": info.st_size, "sha256": digest_file(path)})
    if entries != source["closure_entries"] or digest_bytes(canonical(entries)) != source["closure_manifest_sha256"]:
        raise ValueError("transitive source manifest differs")
    replay_facts = source_facts(stage, expected_base)
    require_source_facts(source, replay_facts)
    if replay_facts["untracked_count"] != 0 or not replay_facts["worktree_matches_index"]:
        raise ValueError("replay worktree differs from its exact proposed index")


def expected_semantics(stage):
    path = stage / "scripts/cadr-m11-fixed-table-oracle.py"
    spec = importlib.util.spec_from_file_location("independent_m11_oracle", path)
    module = importlib.util.module_from_spec(spec); assert spec.loader is not None
    spec.loader.exec_module(module)
    multi = module.build_reference_semantic_report(module.source_identities())["fixtures"][1]
    initial = bytes.fromhex(multi["initial_snapshot_cdrauds1_hex"])
    events = [bytes.fromhex(value) for value in multi["events_hex"]]
    head = bytes.fromhex(multi["head_witness_sha256"])
    final_witness = bytes.fromhex(multi["final_witness_sha256"])
    after_first = module.snapshot(events=events[1:], post_slot=2, duration_us=128125,
        queued_frames=513, head_sequence=1, next_sequence=3, head_frame_offset=0,
        witness=final_witness, head_witness=module.witness_step(head, events[0]),
        last_intra_slot=2, have_last=1, slot_open=1)
    cursor = events[0] + struct.pack("<QQII", 1, 0, 0, 512)
    fixture = json.dumps({"name": multi["name"],
        "initial_snapshot_cdrauds1_hex": multi["initial_snapshot_cdrauds1_hex"],
        "oracle_source_identities": module.source_identities()},
        sort_keys=True, separators=(",", ":")).encode()
    state = lambda value, head_sequence, packet_count, frames: {
        "sha256": digest_bytes(value), "bytes": len(value),
        "headSequence": str(head_sequence), "nextSequence": "3",
        "queuedFrames": str(frames), "packetCount": packet_count}
    return {"fixture_bytes": fixture,
        "fixture": {"name": multi["name"], "snapshotBytes": len(initial),
            "snapshotSha256": digest_bytes(initial),
            "oracleSourceIdentities": module.source_identities()},
        "initial": state(initial, 0, 3, 1025), "final": state(after_first, 1, 2, 513),
        "pcm_sha256": multi["pre_pause_packet"]["pcm_s16le_sha256"],
        "cursor_sha256": digest_bytes(cursor), "generation": "1", "sequence": "0",
        "frame_offset": 0, "frames": 512,
        "consumer_epochs": [str(int.from_bytes(initial[48:56], "little") + 1),
                            str(int.from_bytes(initial[48:56], "little") + 2)]}


def verify_tools(report, stage, chromium_invoked):
    expected = report["evidence"]["tools"]
    channel = run(["guix", "describe", "-f", "channels"], stage).stdout
    commits = re.findall(r'\(commit\s+"([0-9a-f]{40})"\)', channel)
    script = r'''
set -eu
clang_path=$(readlink -f "$(command -v clang)")
lld_path=$(readlink -f "$(command -v wasm-ld)")
printf '%s\n' "$clang_path" "$(clang --version | sed -n '1p')" "$(sha256sum "$clang_path" | cut -d' ' -f1)"
printf '%s\n' "$lld_path" "$(wasm-ld --version | sed -n '1p')" "$(sha256sum "$lld_path" | cut -d' ' -f1)"
'''
    lines = run(["guix", "shell", "clang-toolchain", "lld", "--", "sh", "-c", script],
                stage).stdout.splitlines()
    if not chromium_invoked.is_absolute():
        raise ValueError("expected Chromium executable must be an absolute path")
    regular_identity(chromium_invoked)
    chromium_launcher = chromium_invoked.resolve(strict=True)
    chromium_real = chromium_payload(chromium_launcher)
    actual = {"guix_channel_commit": commits[0] if len(commits) == 1 else None,
        "clang": {"path": lines[0], "version": lines[1], "sha256": lines[2]},
        "wasm_ld": {"path": lines[3], "version": lines[4], "sha256": lines[5]},
        "chromium": {"launcher": {**regular_identity(chromium_launcher),
                                  "command_version": run([str(chromium_launcher), "--version"],
                                                         stage).stdout.strip()},
                     "payload": {**regular_identity(chromium_real),
                                 "command_version": run([str(chromium_real), "--version"],
                                                        stage).stdout.strip()},
                     "launch_flags": CHROMIUM_LAUNCH_FLAGS},
        "python": sys.version.split()[0], "playwright": playwright_identity(),
        "git": run(["git", "--version"], stage).stdout.strip()}
    def require_identity(value):
        if value != actual:
            raise ValueError("toolchain or externally selected browser executable identity differs")
    require_identity(expected)
    for path, replacement in [
        (("chromium", "launcher", "path"), "/forged/chromium"),
        (("chromium", "launcher", "sha256"), "0" * 64),
        (("chromium", "payload", "path"), "/forged/chromium-payload"),
        (("chromium", "payload", "sha256"), "1" * 64),
        (("chromium", "launch_flags"), []),
        (("playwright", "version"), "0.0.0"),
        (("playwright", "sync_api", "sha256"), "2" * 64),
    ]:
        mutant = copy.deepcopy(expected); target = mutant
        for component in path[:-1]:
            target = target[component]
        target[path[-1]] = replacement
        try:
            require_identity(mutant)
        except ValueError:
            continue
        raise ValueError("independent verifier accepted a browser identity mutant")


def verify_browser_semantics(result, semantics, wasm_identity):
    observations = result["observations"]
    if result["fixture"] != semantics["fixture"]:
        raise ValueError("browser fixture identity differs from independent oracle")
    if observations["initial"] != semantics["initial"] or observations["paused"] != semantics["initial"]:
        raise ValueError("initial or paused snapshot differs from independent oracle")
    deliveries = result["deliveries"]
    expected_deliveries = [{"generation": semantics["generation"], "consumerEpoch": epoch,
        "sequence": semantics["sequence"], "frameOffset": semantics["frame_offset"],
        "frames": semantics["frames"], "pcmSha256": semantics["pcm_sha256"],
        "cursorSha256": semantics["cursor_sha256"]} for epoch in semantics["consumer_epochs"]]
    if deliveries != expected_deliveries:
        raise ValueError("delivery PCM, cursor, or exact identity differs from independent oracle")
    for phase, delivery in zip(["staged", "resumed"], deliveries, strict=True):
        observed = observations[phase]
        staged = observed["staged"]
        expected_staged = {"kind": "worklet-staged", "generation": int(delivery["generation"]),
            "consumerEpoch": int(delivery["consumerEpoch"]), "sequence": int(delivery["sequence"]),
            "frameOffset": delivery["frameOffset"]}
        if observed["delivery"] != delivery or staged != expected_staged:
            raise ValueError("delivery-to-Worklet staging identity differs")
    committed = observations["committed"]
    resumed = deliveries[1]
    expected_receipt = {"kind": "ack-committed", "generation": int(resumed["generation"]),
        "consumerEpoch": int(resumed["consumerEpoch"]), "sequence": int(resumed["sequence"]),
        "frameOffset": resumed["frameOffset"], "queuePackets": 2, "queuedFrames": 513}
    expected_boundary = {"state": "READY", "generation": 1,
        "consumerEpoch": int(resumed["consumerEpoch"]), "queuePackets": 2, "queuedFrames": 513}
    if committed != {"receipt": expected_receipt, "sourceInFlightRecords": 0,
                      "boundary": expected_boundary} or result["boundary"] != expected_boundary:
        raise ValueError("staging-to-committed identity or committed counts differ")
    if observations["final"] != semantics["final"]:
        raise ValueError("final snapshot hash, head, next, or queue state differs from independent oracle")
    expected_calls = [{"op": "audio-open-private"}, {"op": "audio-peek"},
        {"op": "audio-render", "generation": "1", "sequence": "0", "frameOffset": 0,
         "requestedFrames": 512}, {"op": "audio-open-private"}, {"op": "audio-peek"},
        {"op": "audio-render", "generation": "1", "sequence": "0", "frameOffset": 0,
         "requestedFrames": 512}, {"op": "audio-ack", "generation": "1", "sequence": "0",
         "frameOffset": 0, "frames": 512}]
    if result["calls"] != expected_calls:
        raise ValueError("selected-core delivery and acknowledgement order differs")
    expected_contexts = [
        {"state": "closed", "sampleRate": 48000, "disconnected": True,
         "staged": 1, "acknowledgements": 0},
        {"state": "running", "sampleRate": 48000, "disconnected": False,
         "staged": 1, "acknowledgements": 1},
    ]
    if result["activation"] != [True, True]:
        raise ValueError("browser user-activation observations differ")
    if result["contexts"] != expected_contexts:
        raise ValueError("browser AudioContext state, rate, disconnect, or receipt counts differ")
    expected_terminal = {kind: {"kind": kind, "phaseTrace": ["start-deferred-before-node",
        "terminal-first-pass", "node-after-first-pass"], "openStatus": 9,
        "nodeAllocatedAfterFirstDisconnect": True, "disconnectPasses": 2, "nodeDisconnects": 1,
        "contextCloseCalls": 1, "contextState": "closed", "closeRejections": 0,
        "terminalState": "DEVICE_LOST"} for kind in TERMINAL_KINDS}
    if result["terminal"] != expected_terminal:
        raise ValueError("terminal late-allocation observation differs")
    expected_terminal_never = {stage: {
        "stage": stage, "phaseTrace": [stage + "-entered", "terminal-first-pass"],
        "openStatus": 9, "startStillPending": True,
        "nodeAllocatedAfterFirstDisconnect": False, "disconnectPasses": 1,
        "nodeDisconnects": 1 if stage == "after-node" else 0,
        "contextCloseCalls": 1, "contextState": "closed", "closeRejections": 0,
        "terminalState": "DEVICE_LOST"} for stage in NEVER_TERMINAL_STAGES}
    if result["terminalNever"] != expected_terminal_never:
        raise ValueError("never-settling terminal observation differs")
    if result["statuses"] != ["CADR audio ready", "CADR audio ready"]:
        raise ValueError("browser audio status sequence differs")
    if result["wasm"] != wasm_identity:
        raise ValueError("browser-reported Wasm identity differs from independent rebuild")


def verify_semantic_mutants(result, semantics, wasm_identity):
    mutations = [
        lambda value: value["deliveries"][0].__setitem__("pcmSha256", "0" * 64),
        lambda value: value["deliveries"][0].__setitem__("cursorSha256", "1" * 64),
        lambda value: value["observations"]["staged"]["staged"].__setitem__("generation", 2),
        lambda value: value["observations"]["committed"]["receipt"].__setitem__("consumerEpoch", 3),
        lambda value: value["observations"]["committed"]["receipt"].__setitem__("queuePackets", 3),
        lambda value: value["observations"]["final"].__setitem__("sha256", "0" * 64),
        lambda value: value["observations"]["final"].__setitem__("headSequence", "0"),
        lambda value: value["observations"]["final"].__setitem__("nextSequence", "4"),
        lambda value: value["activation"].__setitem__(0, False),
        lambda value: value["contexts"][0].__setitem__("state", "suspended"),
        lambda value: value["contexts"][1].__setitem__("sampleRate", 44100),
        lambda value: value["contexts"][0].__setitem__("disconnected", False),
        lambda value: value["terminal"]["resolve"].__setitem__("nodeAllocatedAfterFirstDisconnect", False),
        lambda value: value["terminal"]["reject"].__setitem__("contextCloseCalls", 2),
        lambda value: value["statuses"].__setitem__(0, "CADR audio blocked pending user activation"),
        lambda value: value["wasm"].__setitem__("bytes", wasm_identity["bytes"] + 1),
        lambda value: value["wasm"].__setitem__("sha256", "0" * 64),
    ]
    for mutate in mutations:
        mutant = copy.deepcopy(result); mutate(mutant)
        try:
            verify_browser_semantics(mutant, semantics, wasm_identity)
        except ValueError:
            continue
        raise ValueError("independent verifier accepted a semantic evidence mutant")
    for report_path in terminal_leaf_paths():
        path = report_path[2:]
        for field, observed in nested(result, path).items():
            mutant = copy.deepcopy(result); target = nested(mutant, path)
            if isinstance(observed, bool): target[field] = not observed
            elif isinstance(observed, int): target[field] = observed + 1
            elif isinstance(observed, str): target[field] = observed + "-mutant"
            elif isinstance(observed, list): target[field] = [*observed, "mutant"]
            else: raise RuntimeError(f"terminal field has no semantic mutant: {path}/{field}")
            try:
                verify_browser_semantics(mutant, semantics, wasm_identity)
            except ValueError:
                continue
            raise ValueError(f"independent verifier accepted terminal semantic mutant {path}/{field}")


def verify_runtime(report, stage, chromium_invoked):
    evidence = report["evidence"]; observation = report["observation"]
    exact_keys(observation, ["browser", "browser_process", "browser_version", "cleanup", "errors", "network"],
        "observation")
    exact_keys(observation["browser_process"], ["payload_path"], "browser process observation")
    exact_keys(observation["network"], ["blocked_requests", "cdp_request_paths", "loopback_only",
        "policy", "request_paths", "response_sha256", "websockets"], "network observation")
    exact_keys(observation["browser"], ["activation", "boundary", "calls", "claimBoundary",
        "contexts", "deliveries", "fixture", "observations", "statuses", "terminal", "terminalNever", "wasm"], "browser observation")
    exact_keys(observation["browser"]["observations"], ["committed", "final", "initial", "paused",
        "resumed", "staged"], "browser state observations")
    verify_tools(report, stage, chromium_invoked)
    subprocess.run(["make", "-B", "-C", str(stage / "cadr-web"),
        "build/cadr-web-m13-audio-O2.wasm"], check=True, stdout=subprocess.DEVNULL)
    wasm = stage / EXPECTED_PATHS["/cadr-web/build/cadr-web-m13-audio-O2.wasm"]
    actual_wasm = {"bytes": wasm.stat().st_size, "sha256": digest_file(wasm),
                   "forced_build": True, "isolated_stage": True}
    if actual_wasm != evidence["wasm"] or actual_wasm["sha256"] != WASM_SHA256:
        raise ValueError("forced Wasm identity differs")
    network = observation["network"]
    expected = sorted([*EXPECTED_PATHS, "/m11-selected-fixture.json",
        "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
        "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
        "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
        "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
        "/cadr-web/browser/cadr-m13-audio-worklet.mjs"])
    expected_cdp = sorted([path for path in EXPECTED_PATHS
        if path != "/cadr-web/browser/cadr-m13-audio-worklet.mjs"] +
        ["/m11-selected-fixture.json"])
    if network != {"policy": "playwright-route-plus-cdp-network-v1", "loopback_only": True,
        "blocked_requests": [], "websockets": [], "request_paths": expected,
        "cdp_request_paths": expected_cdp, "response_sha256": network["response_sha256"]}:
        raise ValueError("closed network evidence differs")
    responses = {path: digest_file(stage / relative) for path, relative in EXPECTED_PATHS.items()}
    semantics = expected_semantics(stage)
    responses["/m11-selected-fixture.json"] = digest_bytes(semantics["fixture_bytes"])
    if responses != network["response_sha256"]:
        raise ValueError("served response identities differ")
    result = observation["browser"]; observations = result["observations"]
    payload = evidence["tools"]["chromium"]["payload"]
    if observation["browser_process"] != {"payload_path": payload["path"]}:
        raise ValueError("live browser payload differs from evidence payload")
    command_version = re.match(r"Chromium ([0-9.]+)", payload["command_version"])
    if command_version is None or observation["browser_version"] != command_version.group(1):
        raise ValueError("runtime browser version differs from executable")
    browser_wasm = {"bytes": actual_wasm["bytes"], "sha256": actual_wasm["sha256"]}
    if network["response_sha256"].get("/cadr-web/build/cadr-web-m13-audio-O2.wasm") != browser_wasm["sha256"]:
        raise ValueError("served Wasm response differs from independent rebuild")
    verify_browser_semantics(result, semantics, browser_wasm)
    verify_semantic_mutants(result, semantics, browser_wasm)
    claims = {"selectedWasm": True, "syntheticCdrauds1": True, "realAudioWorklet": True,
              "guestGeneratedPcm": False, "physicalDevice": False, "votrax": False,
              "cM11Closed": False}
    if report["claims"] != claims or result["claimBoundary"] != claims:
        raise ValueError("claim boundary differs")
    if observation["cleanup"] != {"browser_closed": True, "context_closed": True,
            "server_closed": True, "server_thread_stopped": True} or report[
            "cleanup"] != {"isolated_stage_removed": True}:
        raise ValueError("cleanup evidence differs")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path); parser.add_argument("--repository", type=Path, required=True)
    parser.add_argument("--patch", type=Path, required=True); parser.add_argument("--expected-base", required=True)
    parser.add_argument("--expected-tree", required=True)
    parser.add_argument("--chromium-executable", type=Path, required=True)
    options = parser.parse_args()
    raw, report = load(options.report.resolve())
    validate_report_shapes(report)
    verify_shape_mutants(report)
    verify_terminal_shape_mutants(report)
    if report.get("schema") != "cadr-m11-selected-playback-v3":
        raise ValueError("wrong report schema")
    if report["evidence"].get("schema") != "cadr-m11-selected-source-evidence-v3":
        raise ValueError("wrong source evidence schema")
    with tempfile.TemporaryDirectory(prefix="verify-cadr-m11-selected-") as temporary:
        stage = Path(temporary) / "stage"
        verify_source(report, options.repository.resolve(), options.patch.resolve(),
                      options.expected_base, options.expected_tree, stage)
        verify_runtime(report, stage, options.chromium_executable)
    print(f"verified cadr-m11-selected-playback-v3 {digest_bytes(raw)}")


if __name__ == "__main__":
    main()

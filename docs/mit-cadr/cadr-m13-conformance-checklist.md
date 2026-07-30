---
type: Conformance Checklist
title: CADR-WEB-303 M13 conformance campaign checklist
description: A case-by-case evidence ledger for the M13 browser-hardening gate, including partial probes and the remaining runtime-only work.
tags: [mit-cadr, cadr-web, browser, m13, conformance, security, accessibility]
timestamp: 2026-07-30T03:47:00-04:00
---

# CADR-WEB-303 M13 conformance campaign checklist

`CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2` remains **open**. This
checklist records exactly what was exercised in the current dirty working tree and
what that evidence does *not* establish. It is a ledger for the conformance matrix
in the [M13 specification](cadr-browser-hardening-and-accessibility-reimplementation-specification.md),
not a substitute for its requirements or a claim that a System 303 session ran.

The only fully passed results cited here belong to their narrower stated boundaries:
the M10 Chromium persistence/process-loss campaigns, the focused M12 generated-
Wasm panel probe, and a one-operation M13 selected-Wasm/worker composition probe.
The last proves neither persistence nor a booted machine. A source-level or
synthetic test is marked **partial** even when it passes.

## Evidence snapshot

The source hashes below identify the exact evidence programs at this snapshot.
They are not hashes of a durable test-result record: the focused tests print their
result to the invoking terminal and clean their disposable browser profiles or
build artifacts. Re-run the named command and recompute the hash after any source
edit. `E21` is a retained local report with an exact, currently matching source
closure; it records its dirty-worktree status, so it remains evidence for that
identified local tree rather than a clean-release result. All paths are
repository-relative and all inputs are synthetic/public code.

| ID | Evidence path | SHA-256 | Last observed command/result |
| --- | --- | --- | --- |
| `E01` | [`tests/test_cadr_m13_shell.mjs`](../../tests/test_cadr_m13_shell.mjs) | `f19f94401a0563c811695ae86e22e34c07e9b07e3e5b9a2c635711af529621eb` | `node tests/test_cadr_m13_shell.mjs` — passed |
| `E02` | [`tests/test_cadr_m13_admission_fuzz.mjs`](../../tests/test_cadr_m13_admission_fuzz.mjs) | `3e1484548a67823d8609e9009cdddf135938f4e81cd5648343eb79317c1a9374` | `node tests/test_cadr_m13_admission_fuzz.mjs` — passed: seed `0x6d313346`, 4,096 candidates, 1,801 accepted and 2,295 rejected |
| `E03` | [`tests/test_cadr_m13_artifact.mjs`](../../tests/test_cadr_m13_artifact.mjs) | `4bb6709900dd4063c8de52782c181e525554a87636d58e970a49b28fc7b91ebf` | `node tests/test_cadr_m13_artifact.mjs` — passed |
| `E04` | [`tests/test_cadr_m13_provisional_browser.py`](../../tests/test_cadr_m13_provisional_browser.py) | `e54a3f5551134519b54e45c7e9473ebb1f2f40292c88f89ccfc047115af4c77e` | `python3 tests/test_cadr_m13_provisional_browser.py` — passed (Chromium, one provisional artifact test) |
| `E05` | [`tests/test_cadr_m12_debugger_browser.py`](../../tests/test_cadr_m12_debugger_browser.py) | `0d3985561a0c1cd44618c618d9e7535a742d5b7e0fd38704e77cd7c33669066e` | `python3 tests/test_cadr_m12_debugger_browser.py` — passed (Chromium, 1 test) |
| `E06` | [`tests/test_cadr_m13_audio_reducer.mjs`](../../tests/test_cadr_m13_audio_reducer.mjs) | `0cf5a4f72e7faa3f6e337226a5dd81457fbbc3b0060192b1e26124c423f2f203` | `node tests/test_cadr_m13_audio_reducer.mjs` — passed |
| `E07` | [`tests/test_cadr_m11_audio_bridge.mjs`](../../tests/test_cadr_m11_audio_bridge.mjs) | `abaf3cbe2afbf1f32f89a30f372c8e0db5eb43e702220930ceb902205ab2937c` | `node tests/test_cadr_m11_audio_bridge.mjs` — passed |
| `E08` | [`tests/test_cadr_m11_audio_worklet.mjs`](../../tests/test_cadr_m11_audio_worklet.mjs) | `75e9d701ec3bcacba6b79315c0c36f85a8ae986bcdc6ad9d71e70367899c213c` | `node tests/test_cadr_m11_audio_worklet.mjs` — passed |
| `E09` | [`tests/test_cadr_m11_audio_protocol.mjs`](../../tests/test_cadr_m11_audio_protocol.mjs) | `98b75bcc37005d118984b9afed720f52cc831202ef4db5a78d0878b59b362264` | `node tests/test_cadr_m11_audio_protocol.mjs` — passed |
| `E10` | [`scripts/run-cadr-m10-indexeddb-browser.mjs`](../../scripts/run-cadr-m10-indexeddb-browser.mjs) | `d218cd85c1b97cc0321ebf4ba59e449151e7d12359eaed5181b3b18657dc7c45` | `node scripts/run-cadr-m10-indexeddb-browser.mjs` — passed: Chromium, exact HTTP allowlist, six seams times abort/terminate/reload |
| `E11` | [`scripts/run-cadr-m10-process-kill-browser.mjs`](../../scripts/run-cadr-m10-process-kill-browser.mjs) | `256dee714a5f6eea33066f3f904d6ebd9c016dd74c651bf6d5e94fc1f4e7e304` | `node scripts/run-cadr-m10-process-kill-browser.mjs` — passed: eight process-group kills; limitation `process-kill-not-os-power-removal` |
| `E12` | [`cadr-web/browser/cadr-m13-shell.mjs`](../../cadr-web/browser/cadr-m13-shell.mjs) | `7080bf58ef97b23a74f37e0dcdb263ccdddc3383cad9196ec05764f9c5f28600` | source identity for `E01`, `E02`, `E16`, and `E19` |
| `E13` | [`cadr-web/browser/cadr-m13-artifact-shell.mjs`](../../cadr-web/browser/cadr-m13-artifact-shell.mjs) | `d52880440cf485ffe74a6c6e9c5e52f6b1eab2577f60b63ab51819dc3e0e0f23` | source identity for `E03`/`E04` |
| `E14` | [`cadr-web/browser/cadr-m13-audio-reducer.mjs`](../../cadr-web/browser/cadr-m13-audio-reducer.mjs) | `a4a8fd231d10bbe263570f189ca5f85fc42a061ded057e06868ffcc92c699a98` | source identity for `E06` |
| `E15` | [`tests/test_cadr_m13_named_parser_corpus.mjs`](../../tests/test_cadr_m13_named_parser_corpus.mjs) | `5ed672805ac699dac0de9dcc91891764296fc04ed4b41caba4d1286b7fe54c99` | `node tests/test_cadr_m13_named_parser_corpus.mjs` — passed: seed `0x6d313346`, 780 bounded hostile cases across named public parser/validator ingress plus private M4 diagnostic ingress through its public serializer |
| `E16` | [`tests/test_cadr_m13_worker_browser.py`](../../tests/test_cadr_m13_worker_browser.py) | `b8728b74b34f0b148a9541a954468916b1445591ec94392a7cff0363a890e323` | `python3 tests/test_cadr_m13_worker_browser.py` — passed (Chromium, v1--v7 rejection, detached-body timing, reply/loss races, and all three maximum-ID outcomes) |
| `E17` | [`tests/test_cadr_m13_admission_ledger.mjs`](../../tests/test_cadr_m13_admission_ledger.mjs) | `2d20814356542830a9421af4673b3e222072d8d047b739ec48bb26dc7db37aa9` | `node tests/test_cadr_m13_admission_ledger.mjs` — passed (metadata/body/window limits and atomic injected allocation points) |
| `E18` | [`scripts/verify-cadr-m13-provisional.mjs`](../../scripts/verify-cadr-m13-provisional.mjs) | `62f2e2d17cb225cceca5224dd31a8515c8137c0000988c56c53d5d5edf34c04e` | invoked by `E03`: exact closed inventory, output-hash, nonce, and bounded private-path/secret/capability scan; deliberate tamper rejected |
| `E19` | [`tests/test_cadr_m13_lifecycle.mjs`](../../tests/test_cadr_m13_lifecycle.mjs) | `afd25d7a5c50e2c3764703a8c8b291afbe654c2714224e47e28c88b85d395f5e` | `node tests/test_cadr_m13_lifecycle.mjs` — passed (synchronous release, chord, direct lower loss/malformed reply/messageerror/timeout matrix) |
| `E20` | [`tests/test_cadr_m13_audio_browser.py`](../../tests/test_cadr_m13_audio_browser.py) | `0119645427974b2a61091a10cb086e0f569058f4abac2bbb43983241bf3199a5` | `python3 tests/test_cadr_m13_audio_browser.py` — passed (Chromium user activation, real Worklet acknowledgement/loss/processorerror, actual 8,192-frame Worklet-queue rejection, and browser task reducer turns) |
| `E21` | [`scripts/run-cadr-m13-f03-sanitizer.mjs`](../../scripts/run-cadr-m13-f03-sanitizer.mjs), local ignored `build/cadr-m13-f03-profile-aware-1785396620/report.json` | script `9f29527c78567d55c33fecf93f2dd93377f0be5b78f3050bae3e1d15e7c1afb8`; report `c59e819e5033414c34821d62dbdb8fd8cd23a77b397478160b98841acca1fdd9`; binary `0a92e190d0a6fac4d6d191ba13b68efbe0b91d7a64a4204842989b666372cfec` | current local `passed-native-f03-only` run: clang `21.1.5` ASan+UBSan ABI1.10 M7/M9/M11/M12 profile, with `clang -E` active-profile source-location enumeration. Its exact dirty-tree closure currently verifies and contains 13 active selected allocation sites; each injected failure was `no-memory-atomic`. |
| `E22` | [`scripts/run-cadr-m13-f05b-browser-oom.mjs`](../../scripts/run-cadr-m13-f05b-browser-oom.mjs), [`tests/test_cadr_m13_f05b_browser_oom.mjs`](../../tests/test_cadr_m13_f05b_browser_oom.mjs), local ignored `build/cadr-m13/f05b-agent-oom-v4-1785395828/report.json` | script `37570924e8655188dcffea5bf12dfc9eb52fc8f8d5f242754cfae98975c9da2f`; schema test `7f646a93ad814117566a455d6456c1355ff20ba659cf18c3852a596f1a502837`; report `f47a7d83ef7f15188eaa27f3ea13d09847c4a1c196039a57c1f517450ee062cc` | local Chromium 150 disposable-profile run: fixed 128 MiB Wasm growth refused, while a V8 32 MiB / 128 MiB target heap stress was watchdog-terminated after 30 s; report records both as non-`NO_MEMORY` component outcomes and proves selected-base plus synthetic-durable-fixture hashes unchanged. |
| `E23` | [`tests/test_cadr_m13_selected_wasm_browser.py`](../../tests/test_cadr_m13_selected_wasm_browser.py), [`cadr-m13-selected-wasm-browser.mjs`](../../cadr-web/browser/cadr-m13-selected-wasm-browser.mjs) | test `7e0ef7115f15fca26ac25715c7125d626c097c1e9dafcc0c7df23e9199397eb3`; browser source `046731f52c0d32ddae46e13b2229073d102d401a35952217fb4f98e6fc2cf5d2` | `make -C cadr-web build/cadr-web-m12-O2.wasm && python3 tests/test_cadr_m13_selected_wasm_browser.py` — passed: disposable Chromium page with a narrow self-only CSP fetches the selected M12 O2 module, v8 compiles and structured-clones it to the real v7 module Worker, and the worker instantiates it. The server allowlist observes exactly the 14-module/Wasm self closure. A second real worker returns the normal `terminal:true` maximum-ID bootstrap response; cold power reports lower `NOT_READY` without terminalizing; absent M10 storage rejects base import with v8 `NOT_READY`, and no base-media path is requested. |

`E11` is intentionally described as process loss, not physical power loss. The
separate M10 specification records its source and Chromium version evidence; this
page does not expand that result into M13 coverage.

## Required-case ledger

“Pass” below means the listed narrow program passed, not that the full conformance
case passed. A row can become **closed** only with a retained, exact-artifact,
build-local result report satisfying the complete required-result column in the M13
specification.

| Case | Evidence and bounded observation | Status | Exact remaining work |
| --- | --- | --- | --- |
| `M13-F01` | `E01`, `E02`, `E12`: descriptor admission and deterministic 4,096-case source corpus reject malformed source candidates; every admitted candidate is post-clone checked and `M13META1` encoded. | Partial — source only | Deliver hostile structured-cloned messages to the real v8 worker, retain crashing inputs, and cover every prescribed boundary/type/parser fixture. |
| `M13-F02` | `E15` drives valid records, required-field corruption, hostile-type cases, and 48 deterministic mutations per byte record through every currently exported M6--M13 untrusted parser/validator; it also reaches the private M4 `CDRDISKEVID1` parser through its public serializer. `E10` separately reaches M10 IndexedDB record parsing in Chromium. | Partial — named source/parser ingress | Cover private M6 machine-info/scheduler and M10 IndexedDB import/range/activation paths under the one M13 harness; retain every crashing input and prove no partial adoption through the composed shell. |
| `M13-F03` | `E21` records a current, source-closure-verified ASan+UBSan run with deterministic injected allocation failure at each of 13 active selected native allocation sites: machine creation/completion, `CDRSNAP1` restore, `CDRM4MEDIA1` compare/root construction, and `CDRGTRC1` trace start. Every injected point returned `no-memory-atomic`; the report records no sanitizer diagnostic. `CDRAUDS1` adoption and `CDRM12C1` configuration restoration executed with zero selected allocation sites. | Partial — current selected native ABI1.10 slice | Cover the JavaScript v8 and M10 parsers/state machines, browser base-import/range/clone/CSP/lifecycle/accessibility paths, Wasm arena/fixed-memory exhaustion, and complete M13 fuzz corpus. C-M13 remains open. |
| `M13-F04` | `E16` uses a real Chromium Worker with synthetic v7 peer outcomes: v1--v7/wrong common values, source detachment before/during/after handoff, delayed/duplicate/error/malformed/status-21 replies, and normal/error/protocol terminal outcomes at ID `0xffffffff`. `E23` adds a normal v8 bootstrap of the selected M12 O2 module into the real v7 Worker, a nonterminal lower `NOT_READY` cold-power result, and the normal `terminal:true` maximum-ID bootstrap outcome against a second real worker. | Partial — real boundary, only normal selected-worker paths | Run the prescribed hostile clone/reply/maximum-ID loss/protocol matrix against the selected Wasm/v7 worker and retain a result artifact. |
| `M13-F05a` | `E17` checks metadata and ordinary/stream body one-byte boundaries, mutual exclusion, two live windows, metadata aggregate, release, and every currently named injected allocation point before counter mutation. | Partial — deterministic ledger | Add raw/complete snapshot classes and browser/Wasm allocation points; execute the named snapshot sizes through the composed shell. |
| `M13-F05b` | `E22` has one operation per disposable Chromium profile/origin. The selected M12 O2 module's fixed 128 MiB memory rejects `grow(1)` with a `RangeError`; selected Wasm is served only for that case. A V8 `--max-old-space-size=32` heap stress aiming at 128 MiB reached the 30 s harness watchdog and is recorded as `watchdog-terminated-cap-stress`, not browser loss or `NO_MEMORY`. In both cases the selected base and a 64 KiB synthetic durable fixture were never served and their before/after hashes match. | Partial — destructive browser component probe | Exercise selected M13 shell operations one at a time past actual heap/fixed-Wasm capacity. Preserve this distinction between injected `NO_MEMORY`, browser/renderer loss, fixed-capacity refusal, and watchdog action; verify the actual durable namespace and selected-base immutability after each case. |
| `M13-F06` | `E10` passed M10’s six-seam IndexedDB abort/terminate/reload campaign, but it is not invoked through the M13 shell. | Partial lower-milestone evidence | Compose the real M13 shell with M10 and execute all import/read/write/reopen/export/restore failure-algebra cases. |
| `M13-F07` | `E10` exercises M10 namespace behavior, not M13-selected storage through the M13 port. | Partial lower-milestone evidence | Attack the selected M13 namespace with traversal, foreign UUID, malformed-key, and cross-collection cases. |
| `M13-F08` | `E04` uses CDP `Network.requestWillBeSent` in a fresh `--disable-background-networking` Chromium profile and observes only the three normal bootstrap entries while every provisional control is keyboard-activated. Hostile CSP probes run afterward and are intentionally excluded from that normal-workflow baseline. `E23` additionally asserts that its selected-Wasm normal bootstrap requests the selected module and real worker but never a base-media path; its server allowlist/CSP is test-local rather than release policy evidence. | Partial browser-stack policy harness | Compare before/after bootstrap sealing during an actual composed M13/Wasm/M10 workflow. |
| `M13-F09` | `E04` executes inline, `eval`, `Function`, dynamic self/data script, Worker, object, frame, form, and connection attacks under the exact artifact CSP; all are blocked while minimal `WebAssembly.compile` succeeds under `wasm-unsafe-eval`. | Partial exact-artifact CSP evidence | Add selected-Wasm and complete application policy probes plus retained browser policy report. |
| `M13-F10` | `E19` proves synchronous DOM-side capture/blur/focus release, the exact Control-Alt-Shift-physical-R chord, 250 ms best-effort neutralization, and terminal lower worker error/messageerror/timeout/correlated-malformed-reply behavior for run/input/pause/debug source operations. `E11` remains M10 process-loss evidence only. | Partial — source shell plus lower M10 evidence | Inject commit/export/restore/audio failures through an actual M10/Wasm composition while captured; prove `IN_DOUBT` reread and volatile-state treatment there. |
| `M13-F11` | `E04` keyboard-walks the skip link, framebuffer focus target, and all 13 provisional host controls in DOM order; `E19` exercises the exact release chord and synchronous focus route. | Partial provisional host UI | Walk full M8 and M9 alternatives, focus restoration, and status behavior in the composed application. |
| `M13-F12` | `E04` verifies all 13 current buttons' names, status role/live properties, framebuffer non-transcription, visible focus, and the full Tab route. | Partial automated provisional audit | Run automated complete-app state checks and a recorded manual screen-reader review. |
| `M13-F13` | `E03`/`E18` verify exact output inventory/hash, deterministic nonce binding, no unlisted/symlinked artifact, bounded capability/private-path/secret scan, and tamper rejection. | Partial build-local evidence | Scan selected Wasm, Worklet, source maps, and the complete application artifact; record final release identities. |
| `M13-F14` | `E07`–`E09` pass focused M11 model/browser-boundary tests and `E05` passes a generated M12 panel check. They are not lower conformance runs *through* the M13 shell; `C-M11` and `C-M12` remain open. | Partial lower-test evidence | Run every available lower test through the composed M13 shell after M11/M12 native/runtime gates close. |
| `M13-F15` | `E20` supplies genuine Chromium click activation (without an autoplay bypass), a real AudioContext and AudioWorklet, one Worklet-originated acknowledgement, immediate context closure after a post without a fabricated acknowledgement, an intentionally throwing Worklet with `processorerror`, one deterministic rejection of a second 8,192-frame packet by the actual M11 Worklet queue, and a fresh second epoch. The PCM is a fixed test fixture. | Partial browser component evidence | Wire a selected M11 worker/core, test partial/stale acknowledgements and worker/device loss, and retain event/provenance trace through the v8 shell. |
| `M13-F15b` | `E06`, `E14`, and `E20` cover the source reducer plus actual browser `queueMicrotask`/separate `setTimeout` turns: same-task device-error precedence, committed deadline fencing across tasks, and eight-record high water. | Partial browser-task component evidence | Integrate it into the v8 shell and run every required pairwise/equal-time/reentrant/epoch order against real audio callbacks. |

## Blocking dependencies and runtime reservation

`C-M13` also depends on `C-M11` and `C-M12`. The following lower milestones are
not closed by the synthetic/browser tests above:

| Gate | Exact blocker | Why it is not interchangeable with the listed evidence |
| --- | --- | --- |
| `C-M11` | A fresh isolated native capture must observe the M11 sound witness and validate the canonical event and PCM hashes; the real browser AudioWorklet/autoplay/device-loss campaign remains unrun. | Source queue/bridge tests do not prove native sound events or browser playback lifecycle. |
| `C-M12` | A fresh isolated System 303 runtime observation must prove debugger breakpoint/pause/inspection/resume/macro-step behavior and hashes. The candidate pause/resume witness is instrumentation evidence, not historical macro-step semantics. | Generated Wasm scalar inspection proves the host panel only, not the preserved runtime. |
| M13 composition | The live M13 shell is still a policy foundation, not the complete M8–M12/M10 application controller. | Lower campaigns cannot establish session fencing, persistence, lifecycle, accessibility, or audio behavior through an absent composed workflow. |

Native M11/M12 captures must not reuse an active private runtime or mutable disk. At
the time this ledger was prepared, separate M6/M7 native campaigns owned their
private runtime; obtain a fresh `0700` run directory, a verified regular
non-symlink `usim.ini`, and a private disk copy before invoking either native oracle.
For M12, the candidate pause/resume option only validates the witness control-file
round trip; it must remain explicitly separate from the preserved-runtime debugger
claim.

## Reproduction and disposition

Run the focused evidence programs recorded above, then use the M13 specification’s
full conformance matrix as the acceptance procedure. Recompute this page’s source
hash table with:

```text
sha256sum tests/test_cadr_m13_shell.mjs tests/test_cadr_m13_admission_fuzz.mjs \
  tests/test_cadr_m13_artifact.mjs tests/test_cadr_m13_provisional_browser.py \
  tests/test_cadr_m12_debugger_browser.py tests/test_cadr_m13_audio_reducer.mjs \
  tests/test_cadr_m11_audio_bridge.mjs tests/test_cadr_m11_audio_worklet.mjs \
  tests/test_cadr_m11_audio_protocol.mjs tests/test_cadr_m13_named_parser_corpus.mjs \
  tests/test_cadr_m13_worker_browser.py tests/test_cadr_m13_admission_ledger.mjs \
  tests/test_cadr_m13_lifecycle.mjs tests/test_cadr_m13_audio_browser.py \
  tests/test_cadr_m13_selected_wasm_browser.py \
  tests/test_cadr_m13_f05b_browser_oom.mjs \
  scripts/run-cadr-m13-f03-sanitizer.mjs \
  scripts/run-cadr-m13-f05b-browser-oom.mjs \
  scripts/run-cadr-m10-indexeddb-browser.mjs \
  scripts/run-cadr-m10-process-kill-browser.mjs cadr-web/browser/cadr-m13-shell.mjs \
  cadr-web/browser/cadr-m13-artifact-shell.mjs cadr-web/browser/cadr-m13-audio-reducer.mjs \
  cadr-web/browser/cadr-m13-selected-wasm-browser.mjs \
  scripts/verify-cadr-m13-provisional.mjs cadr-web/browser/cadr-m13-audio-browser.mjs \
  cadr-web/browser/cadr-m13-audio-fault-worklet.mjs
```

This page records source and local test observations, not a public-release claim.
It contains no licensed Genera or private CADR runtime payload.

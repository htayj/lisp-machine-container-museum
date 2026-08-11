---
type: Conformance Checklist
title: CADR-WEB-303 M13 conformance campaign checklist
description: A case-by-case evidence ledger for the M13 browser-hardening gate, including partial probes and the remaining runtime-only work.
tags: [mit-cadr, cadr-web, browser, m13, conformance, security, accessibility]
timestamp: 2026-08-11T09:25:05-04:00
---

# CADR-WEB-303 M13 conformance campaign checklist

`CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2` remains **open**. This
checklist records exactly what was exercised in the current dirty working tree and
what that evidence does *not* establish. It is a ledger for the conformance matrix
in the [M13 specification](cadr-browser-hardening-and-accessibility-reimplementation-specification.md),
not a substitute for its requirements or a claim that a preserved System 303 runtime
session ran.

The only fully passed results cited here belong to their narrower stated boundaries:
the M10 Chromium persistence/process-loss campaigns, the focused M12 generated-
Wasm panel probe, and the selected-media/M10 witness. The latter mounts the stated
System 303 inputs, performs its selected worker's cold-power-on/boot/visibility/start
sequence, and runs it to its first real guest host wait; it proves neither changed
overlay persistence nor a complete M13 workflow. A source-level or synthetic test
is marked **partial** even when it passes.

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
| `E01` | [`tests/test_cadr_m13_shell.mjs`](../../tests/test_cadr_m13_shell.mjs) | `60d932218d3a7432dc251959e3b350d6ae47ea3be325a3ef6ff620986c1bb388` | `node tests/test_cadr_m13_shell.mjs` — passed; v8 `machine-run` rejects 4,097 before lower dispatch and maps the 4,096 maximum only to `scheduler-run-v7-slice`; mutation after mount is rejected; every artifact and all 258 lower stream-chunk failure ordinals, all 258 backing-range failures after `stream-begin`, and post-`stream-finish` adoption failure terminally discard the worker. |
| `E02` | [`tests/test_cadr_m13_admission_fuzz.mjs`](../../tests/test_cadr_m13_admission_fuzz.mjs) | `3e1484548a67823d8609e9009cdddf135938f4e81cd5648343eb79317c1a9374` | `node tests/test_cadr_m13_admission_fuzz.mjs` — passed: seed `0x6d313346`, 4,096 candidates, 1,636 accepted and 2,460 rejected |
| `E03` | [`tests/test_cadr_m13_artifact.mjs`](../../tests/test_cadr_m13_artifact.mjs) | `4bb6709900dd4063c8de52782c181e525554a87636d58e970a49b28fc7b91ebf` | `node tests/test_cadr_m13_artifact.mjs` — passed |
| `E04` | [`tests/test_cadr_m13_provisional_browser.py`](../../tests/test_cadr_m13_provisional_browser.py) | `e54a3f5551134519b54e45c7e9473ebb1f2f40292c88f89ccfc047115af4c77e` | `python3 tests/test_cadr_m13_provisional_browser.py` — passed (Chromium, one provisional artifact test) |
| `E05` | [`tests/test_cadr_m12_debugger_browser.py`](../../tests/test_cadr_m12_debugger_browser.py) | `0d3985561a0c1cd44618c618d9e7535a742d5b7e0fd38704e77cd7c33669066e` | `python3 tests/test_cadr_m12_debugger_browser.py` — passed (Chromium, 1 test) |
| `E06` | [`tests/test_cadr_m13_audio_reducer.mjs`](../../tests/test_cadr_m13_audio_reducer.mjs) | `0cf5a4f72e7faa3f6e337226a5dd81457fbbc3b0060192b1e26124c423f2f203` | `node tests/test_cadr_m13_audio_reducer.mjs` — passed |
| `E07` | [`tests/test_cadr_m11_audio_bridge.mjs`](../../tests/test_cadr_m11_audio_bridge.mjs) | `abaf3cbe2afbf1f32f89a30f372c8e0db5eb43e702220930ceb902205ab2937c` | `node tests/test_cadr_m11_audio_bridge.mjs` — passed |
| `E08` | [`tests/test_cadr_m11_audio_worklet.mjs`](../../tests/test_cadr_m11_audio_worklet.mjs) | `75e9d701ec3bcacba6b79315c0c36f85a8ae986bcdc6ad9d71e70367899c213c` | `node tests/test_cadr_m11_audio_worklet.mjs` — passed |
| `E09` | [`tests/test_cadr_m11_audio_protocol.mjs`](../../tests/test_cadr_m11_audio_protocol.mjs) | `98b75bcc37005d118984b9afed720f52cc831202ef4db5a78d0878b59b362264` | `node tests/test_cadr_m11_audio_protocol.mjs` — passed |
| `E10` | [`scripts/run-cadr-m10-indexeddb-browser.mjs`](../../scripts/run-cadr-m10-indexeddb-browser.mjs) | `d218cd85c1b97cc0321ebf4ba59e449151e7d12359eaed5181b3b18657dc7c45` | `node scripts/run-cadr-m10-indexeddb-browser.mjs` — passed: Chromium, exact HTTP allowlist, six seams times abort/terminate/reload |
| `E11` | [`scripts/run-cadr-m10-process-kill-browser.mjs`](../../scripts/run-cadr-m10-process-kill-browser.mjs) | `256dee714a5f6eea33066f3f904d6ebd9c016dd74c651bf6d5e94fc1f4e7e304` | `node scripts/run-cadr-m10-process-kill-browser.mjs` — passed: eight process-group kills; limitation `process-kill-not-os-power-removal` |
| `E12` | [`cadr-web/browser/cadr-m13-shell.mjs`](../../cadr-web/browser/cadr-m13-shell.mjs) | `5355fde137a81c4a18bbf81b13c406536c051cce6e8623d1efc111a827cf554c` | source identity for `E01`, `E02`, `E16`, `E19`, `E25`, and `E26` |
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
| `E23` | [`tests/test_cadr_m13_selected_wasm_browser.py`](../../tests/test_cadr_m13_selected_wasm_browser.py), [`cadr-m13-selected-wasm-browser.mjs`](../../cadr-web/browser/cadr-m13-selected-wasm-browser.mjs) | test `466b38b1c279361eed1553ad2b713a74141e24669f64c58a82832ddabad2b31f`; browser source `3e980cc4c00ab00b8b6780641fc2396d5ed5b4a174f5a6cad87ee37c2f702d8e` | `make -C cadr-web build/cadr-web-m12-O2.wasm && python3 tests/test_cadr_m13_selected_wasm_browser.py` — passed: disposable Chromium page with a narrow self-only CSP fetches the selected M12 O2 module, v8 compiles and structured-clones it to the real v7 module Worker, and the worker instantiates it. The server allowlist observes exactly the 14-module/Wasm self closure. A second real worker returns the normal `terminal:true` maximum-ID bootstrap response; a third is actually terminated after its selected-worker bootstrap and while its lower request is pending, producing terminal v8 `WORKER_LOST` (24). The primary worker's cold power reports lower `NOT_READY` without terminalizing; absent M10 storage rejects base import with v8 `NOT_READY`, and no base-media path is requested. |
| `E24` | [`scripts/run-cadr-m13-f06-f07-composition.mjs`](../../scripts/run-cadr-m13-f06-f07-composition.mjs), [`tests/test_cadr_m13_f06_f07_composition.mjs`](../../tests/test_cadr_m13_f06_f07_composition.mjs), local ignored `build/cadr-m13/f06-f07-remediation-20260730/report.json` | runner `45bed21eaf5be150a02ca3d613569c9bce786489f5f7a4a12da3bae706e9f2b9`; static receipt test `cadeac99aa25f374cd5f5b1367b809f776ee7b2e7f2e36aeed05dfea54d2317f`; report `866d3ebea77ddc9dbcf3ec9521e3af43af784e686230d8174d0c0ce0d83543d3` | `node scripts/run-cadr-m13-f06-f07-composition.mjs --execute --output=build/cadr-m13/f06-f07-remediation-20260730` — passed: retained Chromium 150 disposable-IDB run. The runner loads the real `C-M10-IDB-v1` backend/controller and `createCadrM10WorkerDiskBridge`, which services one exact synthetic M4 block-write request; it records the selected M12 O2 module only as an independent byte-identical state witness and does **not** load the M13 shell or its composite dispatch. Four receipt-validated cases cover pre-guest stage failure, post-guest durable-publication failure, lost host-complete response, and foreign-binding rejection. This is not a C-M13 completion claim. |
| `E25` | [`tests/test_cadr_m13_m10_dispatch_browser.py`](../../tests/test_cadr_m13_m10_dispatch_browser.py), [`cadr-m13-m10-dispatch-browser.mjs`](../../cadr-web/browser/cadr-m13-m10-dispatch-browser.mjs) | test `a4b3fe508f4c4011d888c67c0c749d4fc3c98ec784aafb5324850050a19c77f8`; browser source `fcb02a51b3f4ea3346cfea39926cc17fc0a66afdf2c1cbf47ea0c42cf7514571` | `python3 -m unittest -v tests.test_cadr_m13_m10_dispatch_browser` — Chromium composes the shared v8 shell with real `C-M10-IDB-v1` through its bridge factory. A synthetic exact M4 write drives sealed `scheduler-run-v7-slice → host-next-request → host-complete` dispatch and durable overlay readback. The v8 synthetic peer and recursive browser module allowlist are current with the signed M12 shell imports. A controller staging failure before guest acceptance returns nonterminal v8 status `7`, leaves `CLEAN`, sends one failed completion, and does not replace/terminate the worker. A post-completion IDB publication fault instead yields status `7`, `terminal:true`, controller `IN_DOUBT`, exactly one replacement callback, and worker termination. It supplies neither selected Wasm nor selected-base bytes, so it is not a boot or selected-artifact claim. |
| `E26` | [`cadr-worker.js`](../../cadr-web/wasm/cadr-worker.js), [`cadr-m13-shell.mjs`](../../cadr-web/browser/cadr-m13-shell.mjs), [`tests/test_cadr_m5_worker_protocol.mjs`](../../tests/test_cadr_m5_worker_protocol.mjs), [`tests/test_cadr_m12_worker.mjs`](../../tests/test_cadr_m12_worker.mjs), [`tests/test_cadr_m13_selected_media_m10_browser.py`](../../tests/test_cadr_m13_selected_media_m10_browser.py), [`cadr-m13-selected-media-m10-browser.mjs`](../../cadr-web/browser/cadr-m13-selected-media-m10-browser.mjs) | worker `c702a42eab9b3e941207eb2ed48b9babc89609b4d03b4c051f94ef0ac5d9a691`; shell `5355fde137a81c4a18bbf81b13c406536c051cce6e8623d1efc111a827cf554c`; M5 test `36ab859c1ddd3edde0ecadcb9a1000571be31e510761f6f4898d3828c0415bc9`; M12 test `02a088d928b8208a4201ef0550b3d4b3874fcfc693dc11932b9101a6f7010091`; browser test `80e76b58548a54973f604ceb6a3333119f5cc8e870e72560352bfc16884a45e8`; browser source `9412a78c9513d905adca6616415e90d3f57f0b3daae0de1c6c0c25162df37857` | `CADR_M13_RUN_SELECTED_MEDIA=1 python3 -m unittest -v tests.test_cadr_m13_selected_media_m10_browser` — passed in 17.448 s on local selected inputs (the test skips unless explicitly opted in): v4--v6 reject the new lower name; `scheduler-run` retains queued pause/stop control after a complete slot; v8 bounds `machine-run` to 4,096 and emits only v7 `scheduler-run-v7-slice`. The real selected M12 O2 witness mounted the exact base, exposed M10 identity only from the mounted binding, reached the first host wait at tick 1,029,735 in 252 slices (251 full plus a final 1,639-slot/1,636-microinstruction status-8 slice), and serviced one actual block-1 write request. The write bytes equal selected base block 1, so M10 reports `durable:true,changed:false` and creates no overlay page. A fresh controller then reopens the same binding `CLEAN`, reads the same base-equivalent 1,024 bytes, and performs no worker replacement. This is not evidence of overlay persistence. The final lower order is `scheduler-run-v7-slice → host-next-request → host-complete`; no generic lower `run*` or `scheduler-run` appears. |
| `E27` | [`tests/test_cadr_m13_selected_media_m10_browser.py`](../../tests/test_cadr_m13_selected_media_m10_browser.py), [`cadr-m13-selected-media-m10-browser.mjs`](../../cadr-web/browser/cadr-m13-selected-media-m10-browser.mjs), local ignored `build/cadr-m13/public-selected-runtime-6bad935/report.json` | test `16c92404d7444dc1f56ba5bf66371c5c9bfa62568853fd3c7ce029fe83e58e07`; browser source `df513715f6684e240432b83f9db27575059feba91ee4dfa62e1b2fc085d355cb`; shell `560a7acdd13193e03fe01ac9ce2b96929f1a4e1dc4161bd5aa5860720986d52b`; worker `2ffc09c275224e7a43511a329b317cac745902fbc9cfcd8a560890ed82eb2023`; report `3ec41f03fd525d53788a99a01681d2295814a83eccd3260d4cb814e68bb18b26` | Chromium 150 passed the public v8 selected path on signed base `6bad935`: 258 public import chunks, public mount/reopen, selected cold/boot/start, and the real first guest block-1 no-change request in 252 bounded slices. The worker is `RUNNING` after completion. A separately labelled synthetic controller write survives read and public reopen. Public export/restore names dispatch only to `M13-E27-CDRM10W1-DISPATCH-ADAPTER-v1`, which roundtrips one real synthetic `CDRM10W1` but emits no normative pinned-object records, adopts nothing, and performs no paused/reset restore. |
| `E28` | ABI1.11 audio source, exact-record, Worklet, reducer, shell, real-worker/actual-Wasm, and O0/O2 export tests | source-only; hashes are bound by the eventual commit | Core-issued epochs, independent `CDRM11O1`/`CDRPCM1` literal vectors, nonmutating epoch exhaustion to status 22, zero-frame UART, private frame authority, greater-than-512-frame packet repump, a 64-packet automatic-pump bound, stale generation rejection before Worklet/deadline, eight-record high water, autoplay-before-open, pause/resume, deadline/device loss, worker-loss teardown, and a real worker call into the actual empty O0 ABI1.11 core pass. No licensed media, selected guest PCM, or selected guest/browser playback run was used. |
| `E29` | [`tests/test_cadr_m13_selected_audio_runtime.py`](../../tests/test_cadr_m13_selected_audio_runtime.py), [`cadr-m13-selected-audio-runtime.mjs`](../../cadr-web/browser/cadr-m13-selected-audio-runtime.mjs), [`cadr-m13-audio-boundary.mjs`](../../cadr-web/browser/cadr-m13-audio-boundary.mjs), ignored `build/cadr-m13/selected-audio-runtime-779812a/report.json` | test `7437e02e8fdeced447f726291931d64a569566f69edb4621894dea263371cf0f`; harness `02d422e69b42764946b105d390ea3615cd78fd9dc05b12bf7ed43bab9ffdc251`; boundary `4052e0568be4230af8fbb17db73f13ca2ced29bdf5c3fcb4886cbebdfa3cfe75`; report `7371cce80f3987030521713d1d85c6ef70642d16f90891a2b7854cd9e64be836` | Chromium `150.0.7871.124` on signed base `779812a`: selected ABI1.11 O2 Wasm, actual worker, public shell, three synchronous-click 48 kHz AudioContexts, and real AudioWorklet compose successfully. Open is epoch 2; pause/resume is epoch 3. One synthetic 512-frame fixture in epoch 3 completes exactly one stale status-3 acknowledgement and device-loss response before a fresh click opens epoch 4; one synthetic 88-frame fixture then completes the same sequence. Exact request/response order and two sequence identities are asserted; three fresh reports are byte-identical. The selected core remains empty, so no selected-core acknowledgement or guest progress is invented. This does not prove guest-generated PCM, successful greater-than-512 repump, `C-M11`, or `C-M13`. |
| `E30` | [`tests/test_cadr_m13_production_app.mjs`](../../tests/test_cadr_m13_production_app.mjs), [`cadr-m13-production-app.mjs`](../../cadr-web/browser/cadr-m13-production-app.mjs), [`cadr-m13-shell.mjs`](../../cadr-web/browser/cadr-m13-shell.mjs), and [`cadr-m13-production-shell.html`](../../cadr-web/browser/cadr-m13-production-shell.html) | test `9d72a5105d432ac4409894e8ddebb0e1e6f5ffd34fdb907379b21ced4477fdd8`; app `1f6394b1f8d903ab6129b493dea8e28efb0857661d2f8da9dfc8d9a40898b30c`; shell `1999b355945c50aebbe5c212ab73954bd0dc86fb78b0260da33d17de3e09fa06`; HTML `f16d45124f56c7f92c3a9d6b12f58b349845dd26111ed5dc15481df51754597d` | `node tests/test_cadr_m13_production_app.mjs` — passed in this isolated base checkout: covers all reducer states and independently proves every public method is inert in each absorbing state; rejects all common authority overrides and operation escalation before state/ID changes; proves one injected worker/shell and monotonic public IDs; keeps `BASE_IMPORTING` observable until mount success; exercises coordinator and real-shell duplicate/reentrant resume/restore single-flights, the real-shell neutral-ready race, stale input before/after release, partial and reentrant factory cleanup, exact ingress/handle/shell/worker terminal ordering, recovery/ambiguous-failure labels, stale-reply non-rearm, and a recursive transitive closure scan. An actual `CadrM13Shell` with synthetic selected identity, injected storage/controller, and fake event Worker additionally raises `error`/`messageerror` during instantiate, base import, mount, M10 reopen, clean/uncertain/recovery running states, pending input, and pending audio acceptance under both standalone and P1 external ownership: every promise settles within the bound, the pending audio generation-fence rejection is consumed without an unhandled rejection, original cause survives, pre-M10-clean loss remains `FAILED`, later M10 disposition selects the terminal phase, all handles fence before exactly one ownership-appropriate termination, and input never rearms. Delayed canonicalizer, SHA-256, compiler, base, mount, M10, and audio-acceptance continuations are released after error/messageerror or coordinator stop/release; the loss generation prevents every post-terminal lower post and retains exact terminal cause and one termination. It does not instantiate real selected Wasm/media, browser storage, or a browser Worker. |
| `E31` | [`tests/test_cadr_m13_production_browser.py`](../../tests/test_cadr_m13_production_browser.py), [`cadr-m13-production-browser.html`](../../cadr-web/browser/cadr-m13-production-browser.html), [`cadr-m13-production-browser.mjs`](../../cadr-web/browser/cadr-m13-production-browser.mjs), and [`cadr-m13-production-browser-worker.mjs`](../../cadr-web/browser/cadr-m13-production-browser-worker.mjs) | test `e45e446b6575ff1da0fac5fd66793e67567e1b1a54ba4348cdecfac5ab11a0c0`; HTML `909f4ed7b4f13d800064980726eca5bdc49e13af845896d44395be25fc9cd7cd`; browser `97a3ced2e1ac726cb3f221c291459e96768566eb882b8099e568847692f69d34`; Worker `6429d96b0ef6a958741d39ad72fa779a0f6a1596f915a723a9737d1948f65a44`; local report `631f458e3a760fa6d60edbbb29b42f3e083ad0d7e61177f948a5c7e003c26a50` | `python3 -m unittest -v tests.test_cadr_m13_production_browser` — passed on signed M12 parent `ba8d490c186afb8cdc5905923a60611772256b73`: one actual module Worker and current P1/shell complete public-synthetic bootstrap, all 258 identity-only mount ranges, supplied-controller `CLEAN`, pause/resume, delayed-start stop, and Worker-loss fencing. CDP/page observers see only the self source/module/fixture closure and no WebSocket; page, browser, server thread, and fixture cleanup are asserted. It does not load M12 P2, selected media/runtime, M10, or IndexedDB. |
| `E32` | [`tests/test_cadr_m13_m10_review_adapter_browser.py`](../../tests/test_cadr_m13_m10_review_adapter_browser.py), [`cadr-m13-m10-review-adapter.mjs`](../../cadr-web/browser/cadr-m13-m10-review-adapter.mjs), [`cadr-m13-m10-review-adapter-browser.html`](../../cadr-web/browser/cadr-m13-m10-review-adapter-browser.html), and [`cadr-m13-m10-review-adapter-browser.mjs`](../../cadr-web/browser/cadr-m13-m10-review-adapter-browser.mjs) | test `72cbef5ed59cf13ae5b85a669c7c21a14c26117d8d8fd0ac7ab580198dce2395`; adapter `4e54e40388ac14d34b27d32669600e0d9d084310a48c77e311cb32aa8d0f93a8`; HTML `0fdcacc56f83ac73b9ae509b952fca13811c54220a9bb49d03e87267847a1279`; browser `1f29c6d64ca2b2d1d27971282b61fef144e6a44f518d30d83e82aba64589ed30` | `python3 -m unittest -v tests.test_cadr_m13_m10_review_adapter_browser` — real Chromium with synthetic base and disposable `C-M10-IDB-v1`: binding mutation cannot change the retained namespace; one review pin exists during a generic review; digest-gated ambiguity rejects stale chunk/reopen; pre-operation rollback loss retains a real pin through failed explicit cleanup, while actual-IDB post-commit/session-rollover loss leaves zero refs but requires same-authority idempotent recovery, temporary lease release, and one revoke. A no-lease acquire rejection uses synchronous same-authority revoke first: both invalidation-before-pin and successful post-pin rollback terminate without recovery, whereas failed rollback retains opaque recovery. Ordinary pre-operation and post-commit unpin loss are distinct. Both active-lease and lease-free replacement failure remain `UNKNOWN` until their exact retry reaches fresh replacement/release as applicable, synchronous revoke, and close; the lease-free case also injects a failed synchronous revoke and proves it stays `UNKNOWN` on the recorded revoke step until its retry closes it. Concurrent successful replacement cleanup shares one Promise/result/replacement/revoke/close; concurrent failure shares one error and needs a later explicit retry. CDP sees self-only requests and no WebSocket. It is not selected media/runtime, a M13 pinned-object record/export, restore adoption, paused/reset restore, or `C-M13`. |

`E11` is intentionally described as process loss, not physical power loss. The
separate M10 specification records its source and Chromium version evidence; this
page does not expand that result into M13 coverage.

### E26 exact commands and selected-input identities

The following three commands were run separately for the E26 evidence described in
this snapshot:

1. `guix shell node -- node tests/test_cadr_m5_worker_protocol.mjs`
2. `guix shell node -- node tests/test_cadr_m12_worker.mjs`
3. `CADR_M13_RUN_SELECTED_MEDIA=1 python3 -m unittest -v tests.test_cadr_m13_selected_media_m10_browser`

Before the third command, the local selected inputs below were checked with
`sha256sum`; their bytes remain local inputs and this table records metadata only.

| Witness role | Repository-relative input | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| selected M12 O2 Wasm module | `cadr-web/build/cadr-web-m12-O2.wasm` | 215,572 | `b4f3c7986b92aea03232d973f1badb21d130914a6c3a8f1b664af6390b0cdfbf` |
| selected profile artifact | `cadr-web/profiles/cadr-web-303.ini.in` | 854 | `1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f` |
| PROMH microcode artifact | `l/sys/ubin/promh.mcr` | 20,480 | `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6` |
| PROMH symbol artifact | `l/sys/ubin/promh.sym` | 3,130 | `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d` |
| UCADR symbol artifact | `l/sys/ubin/ucadr.sym` | 83,270 | `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |

The 269,562,880-byte base remains separately bound as
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The browser witness derives two **non-historical, witness-local** M10 binding
identities rather than hashing descriptive labels. `profileSha256`
`58ea88164b0156f8dbcd83f172d0e2b3e641f44575aa1473793745b97a7efdf6` is
SHA-256 of the versioned `CADR-M13-SELECTED-PROFILE-v1` length-framed record for
the kind-1 `cadr-web-303-profile` bytes. `artifactSetSha256`
`c3dafc6a6ed9ddb440e0f61db5f111503925bdf115494b4777f6eb9c0e9f8e12` is
SHA-256 of the versioned `CADR-M13-SELECTED-ARTIFACT-SET-v1` record containing,
in fixed order, the M12 O2 module (kind 0) and the four tabled artifacts (kinds 1,
2, 4, and 5), each with its role, byte count, and SHA-256. The browser test asserts
both values. The disposable witness deletes its test disk; M10's existing binding
validation, rather than this single-run test, is what distinguishes a future
same-UUID reopen using changed inputs.

### E27 public-path selected-runtime report

E27 ran from signed commit `6bad935cf4293638df0e719d85f3cd0a1eff58d0`
(tree `814ec398ca9fab0596bd367ca2af181d3bf3cd38`) with the exact command:

```text
CADR_M13_RUN_SELECTED_MEDIA=1 \
CADR_M13_SELECTED_INPUT_DIR=build/cadr-m13/public-selected-runtime-6bad935/inputs \
CADR_M13_SELECTED_REPORT=build/cadr-m13/public-selected-runtime-6bad935/report.json \
python3 -m unittest -v tests.test_cadr_m13_selected_media_m10_browser
```

The ignored report is `cadr-m13-public-selected-runtime-v1`, 19,222 bytes, and
SHA-256 `3ec41f03fd525d53788a99a01681d2295814a83eccd3260d4cb814e68bb18b26`.
It embeds no licensed bytes or private paths. It records Chromium
`150.0.7871.124`, 804 HTTP requests and
781 exact base ranges. Every selected input is recorded unchanged before/after:

| E27 role | Bytes | SHA-256 |
| --- | ---: | --- |
| current selected M12 O2 Wasm | 217,914 | `62062a742c34aea8e0f7e49d48b19adefe4dd715795869557e1a085cbebb6396` |
| System 303 base | 269,562,880 | `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` |
| selected profile | 854 | `1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f` |
| PROMH microcode | 20,480 | `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6` |
| PROMH symbols | 3,130 | `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d` |
| UCADR symbols | 83,270 | `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |

The profile identity remains
`58ea88164b0156f8dbcd83f172d0e2b3e641f44575aa1473793745b97a7efdf6`;
the current M12 module changes the derived artifact-set identity to
`3e676e43de78e389f32f7c5efaef944a20a49b9c4695c81a2659dfc989059da2`.
The selected guest's actual write is base-identical (`changed:false`). E27's changed
block is explicitly synthetic: the harness flips one byte only after public mount
and the real no-change receipt, then uses that fixture only for real-controller read
and public reopen. The worker remains `RUNNING` after host completion. The subsequent
public operation names dispatch to `M13-E27-CDRM10W1-DISPATCH-ADAPTER-v1`; that test
adapter roundtrips the real M10 `CDRM10W1` serializer/parser with synthetic inner
state. It does **not** implement or prove pinned canonical-object export records,
does not adopt the parsed wrapper, and does not pause/reset/restore the worker. It is
neither a guest-generated changed write nor normative export/restore evidence.

### E29 selected audio composition report

E29 ran from signed commit `779812aff56a030a208d23fef925aa55e4c27d37`
(tree `1ea86d88530bf05ee54fee0c573bc279d12b92a0`) with:

```text
make -C cadr-web m13-audio-unit
CADR_M13_AUDIO_RUNTIME_REPORT=build/cadr-m13/selected-audio-runtime-779812a/report.json \
  python3 tests/test_cadr_m13_selected_audio_runtime.py
```

The 8,316-byte deterministic ignored report has schema
`cadr-m13-selected-audio-runtime-v1` and SHA-256
`7371cce80f3987030521713d1d85c6ef70642d16f90891a2b7854cd9e64be836`.
Three fresh Chromium sessions produced byte-identical reports. It records Chromium
`150.0.7871.124` and the selected 218,335-byte ABI1.11 O2 Wasm SHA-256
`11794b191dd355e6577133f293b591f065bb695b07ff0b3c41c2597c8c6bcd35`.
All three context preparations observed active user activation and each real context
reported 48,000 Hz. Open returned generation 1/epoch 2 with an empty queue; pause
retired that context; resume returned generation 1/epoch 3 with an empty queue.
After epoch 3 completed its stale-ack/loss handshake, another direct-click resume
returned generation 1/epoch 4 with an empty queue.

The two `CDRPCM1` records are not guest output. They are labelled
`synthetic-downstream-fixture`, contain 512 and 88 frames, and have record hashes
`00d2289545a3284dfe03256ead582b218b0624969b745b1124f5a1722e4e8388` and
`ad3a73bea2cfd11000dbdbea77cf258f92c5879d4c7a7e3fcf2c5ae7c91cc712`.
The first is sequence 10/epoch 3 and the second is sequence 11/epoch 4. Each runs
alone and exercises the shell-to-real-Worklet seam only. Because the actual worker
did not issue either record, each Worklet acknowledgement receives status 3
(`STALE`) and is followed by one completed device-loss response before the next
fixture begins. The exact eight-operation lifecycle is open, pause, open, ack,
loss, open, ack, loss; every response retains lifecycle `NEW`. No selected-core
packet is acknowledged or removed. No guest instruction ran, so this run cannot
establish guest-time behavior. E28's greater-than-512 automatic repump remains
source/unit evidence, not an E29 runtime observation.

For pin cross-checking, the public selected-media test was run separately on the
same commit with its ignored input directory and report. Its exact 19,222-byte
report has SHA-256
`96074a8625ab7cafd63c55876bcd2bd742a3b987d55ec047ffc2726ad0290c65`.
It passed in Chromium 150, found the same ABI1.11 O2 Wasm hash, and verified the
269,562,880-byte System 303 base plus four boot artifacts unchanged. It reached one
real base-identical host write after 252 slices, not a Listener or `%BEEP`;
therefore it cannot be combined with E29 into a guest-audio claim.

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
| `M13-F04` | `E16` uses a real Chromium Worker with synthetic v7 peer outcomes: v1--v7/wrong common values, source detachment before/during/after handoff, delayed/duplicate/error/malformed/status-21 replies, and normal/error/protocol terminal outcomes at ID `0xffffffff`. `E23` adds a normal v8 bootstrap of the selected M12 O2 module into the real v7 Worker, a nonterminal lower `NOT_READY` cold-power result, the normal `terminal:true` maximum-ID bootstrap outcome against a second real worker, and real selected-worker termination while an accepted lower request is pending. `E31` adds the current P1/shell's real-browser normal, delayed-stop, and Worker-loss paths with a public synthetic lower Worker. | Partial — selected normal/max/loss paths; hostile peer still synthetic | Run the prescribed hostile clone/reply/maximum-ID protocol matrix against the selected Wasm/v7 worker and retain a result artifact. |
| `M13-F05a` | `E17` checks metadata and ordinary/stream body one-byte boundaries, mutual exclusion, two live windows, metadata aggregate, release, and every currently named injected allocation point before counter mutation. | Partial — deterministic ledger | Add raw/complete snapshot classes and browser/Wasm allocation points; execute the named snapshot sizes through the composed shell. |
| `M13-F05b` | `E22` has one operation per disposable Chromium profile/origin. The selected M12 O2 module's fixed 128 MiB memory rejects `grow(1)` with a `RangeError`; selected Wasm is served only for that case. A V8 `--max-old-space-size=32` heap stress aiming at 128 MiB reached the 30 s harness watchdog and is recorded as `watchdog-terminated-cap-stress`, not browser loss or `NO_MEMORY`. In both cases the selected base and a 64 KiB synthetic durable fixture were never served and their before/after hashes match. | Partial — destructive browser component probe | Exercise selected M13 shell operations one at a time past actual heap/fixed-Wasm capacity. Preserve this distinction between injected `NO_MEMORY`, browser/renderer loss, fixed-capacity refusal, and watchdog action; verify the actual durable namespace and selected-base immutability after each case. |
| `M13-F06` | `E10` passed M10’s six-seam IndexedDB abort/terminate/reload campaign. `E24` and `E25` cover the real controller/bridge failure algebra with synthetic M4 peers. The current source adds public v8 `base-media-mount`, exact selected Wasm authority, bootstrap/import ordering, same-storage binding, all 258 retained/revalidated ranges, and terminal lower-mutation failure coverage. E27 runs that public path with selected Wasm/base/artifacts: the real first guest request is a no-change write and a separate synthetic changed write survives read/public reopen. Its `CDRM10W1` dispatch adapter is explicitly non-normative. `E32` separately validates copied binding, opaque review pins, revoke-first no-lease classification, post-pin same-authority recovery, sticky invalidation, digest-before-cursor, pre-operation versus post-commit unpin loss, and single-flight active-lease versus lease-free replacement retry in real Chromium IndexedDB, only for a synthetic-base generic-overlay review adapter. | Partial — selected public mount and guest no-change request; synthetic changed read/reopen | Obtain a guest-generated changed write; implement pinned-object export and paused/reset composite restore; complete selected pre/post-completion, browser/process-loss, interruption, and power-loss algebra. |
| `M13-F07` | `E10` exercises M10 namespace behavior. `E24` adds a real foreign-binding rejection before any accepted host completion or replacement, with the durable receipt unchanged across recovery. `E25` keeps the M10 bridge channel closed to caller-supplied host records and paths. | Partial — foreign-binding case outside selected shell workflow | Attack the selected M13 namespace with traversal, foreign UUID, malformed-key, and cross-collection cases through the M13 port. |
| `M13-F08` | `E04` uses CDP `Network.requestWillBeSent` in a fresh `--disable-background-networking` Chromium profile and observes only the three normal bootstrap entries while every provisional control is keyboard-activated. Hostile CSP probes run afterward and are intentionally excluded from that normal-workflow baseline. `E23` additionally asserts that its selected-Wasm normal bootstrap requests the selected module and real worker but never a base-media path; its server allowlist/CSP is test-local rather than release policy evidence. `E31` and `E32` add self-only request/WebSocket assertions for their public-synthetic browser paths. | Partial browser-stack policy harness | Compare before/after bootstrap sealing during an actual composed M13/Wasm/M10 workflow. |
| `M13-F09` | `E04` executes inline, `eval`, `Function`, dynamic self/data script, Worker, object, frame, form, and connection attacks under the exact artifact CSP; all are blocked while minimal `WebAssembly.compile` succeeds under `wasm-unsafe-eval`. | Partial exact-artifact CSP evidence | Add selected-Wasm and complete application policy probes plus retained browser policy report. |
| `M13-F10` | `E19` proves synchronous DOM-side capture/blur/focus release, the exact Control-Alt-Shift-physical-R chord, 250 ms best-effort neutralization, and terminal lower worker error/messageerror/timeout/correlated-malformed-reply behavior for run/input/pause/debug source operations. `E11` remains M10 process-loss evidence only. | Partial — source shell plus lower M10 evidence | Inject commit/export/restore/audio failures through an actual M10/Wasm composition while captured; prove `IN_DOUBT` reread and volatile-state treatment there. |
| `M13-F11` | `E04` keyboard-walks the skip link, framebuffer focus target, and all 13 provisional host controls in DOM order; `E19` exercises the exact release chord and synchronous focus route. | Partial provisional host UI | Walk full M8 and M9 alternatives, focus restoration, and status behavior in the composed application. |
| `M13-F12` | `E04` verifies all 13 current buttons' names, status role/live properties, framebuffer non-transcription, visible focus, and the full Tab route. | Partial automated provisional audit | Run automated complete-app state checks and a recorded manual screen-reader review. |
| `M13-F13` | `E03`/`E18` verify exact output inventory/hash, deterministic nonce binding, no unlisted/symlinked artifact, bounded capability/private-path/secret scan, and tamper rejection. | Partial build-local evidence | Scan selected Wasm, Worklet, source maps, and the complete application artifact; record final release identities. |
| `M13-F14` | `E07`–`E09` pass focused M11 model/browser-boundary tests and `E05` passes a generated M12 panel check. They are not lower conformance runs *through* the M13 shell; `C-M11` and `C-M12` remain open. | Partial lower-test evidence | Run every available lower test through the composed M13 shell after M11/M12 native/runtime gates close. |
| `M13-F15` | `E20` supplies genuine Chromium click activation, real AudioContext/AudioWorklet component behavior, processor/context loss, and Worklet queue rejection. `E28` adds worker-owned ABI1.11 source, actual empty-core export calls, frame authority, greater-than-512 repump, stale acknowledgement, worker/device loss, and bounded-pump source tests. `E29` composes selected ABI1.11 O2 Wasm, actual worker, public shell, click-created real contexts, pause/resume epochs, and real Worklet; two separately fenced synthetic downstream acknowledgements are each rejected stale by the empty selected core, proving deterministic order and no invented progress. | Partial selected composition with synthetic downstream PCM | Reach a Listener in the selected-media runtime, generate `%BEEP`, and run that guest PCM through successful partial acknowledgement/repump plus selected processor/context/worker-loss and backpressure cases. |
| `M13-F15b` | `E06`, `E14`, and `E20` cover the source reducer plus actual browser `queueMicrotask`/separate `setTimeout` turns: same-task device-error precedence, committed deadline fencing across tasks, and eight-record high water. E29 proves that this boundary can be reached through the selected v8 shell, but does not run the ordering matrix there. | Partial browser-task component plus selected seam | Run every required pairwise/equal-time/reentrant/epoch order through the selected v8 shell against real audio callbacks. |

## Blocking dependencies and runtime reservation

`C-M13` also depends on `C-M11` and `C-M12`. The following lower milestones are
not closed by the synthetic/browser tests above:

| Gate | Exact blocker | Why it is not interchangeable with the listed evidence |
| --- | --- | --- |
| `C-M11` | A source-bound System 303 `%BEEP` session establishes native job/PCM ordering, and the independent fixed-table oracle closes narrow `C-M11-04-PCM`. E29 validates selected-Wasm worker/shell/real-Worklet composition and pause/resume only with an empty core and labelled downstream fixtures. Guest-generated playback, successful partial acknowledgements/repump, and selected processor/context/worker-loss semantics remain open. | Native and clean-room witnesses do not prove selected browser playback; E29's synthetic records do not prove selected guest generation or successful core acknowledgement. |
| `C-M12` | A fresh isolated System 303 runtime observation must prove debugger breakpoint/pause/inspection/resume/macro-step behavior and hashes. The candidate pause/resume witness is instrumentation evidence, not historical macro-step semantics. | Generated Wasm scalar inspection proves the host panel only, not the preserved runtime. |
| M13 composition | E27 authenticates public v8 selected import/mount/reopen/boot and the real first guest no-change request. E29 separately authenticates selected ABI1.11 worker/shell/real-Worklet composition with an empty core and synthetic downstream PCM. E26 remains the exact older private-seam observation. | The two separate runs do not compose media boot with audio. No guest-generated changed write or PCM, normative pinned-object export, paused/reset composite restore, or complete selected failure/power-loss algebra exists; lifecycle and accessibility remain unproven. |
| M13 P1 production composition | E30 is a source/synthetic reducer and coordinator proof. E31 adds exactly one real Chromium module Worker, current P1/shell, identity-only selected-profile stream, supplied `CLEAN` controller, stop, and Worker-loss boundary. | E31 does not substitute for E27/E29, M13-F06/F07/F08/F10/F11, an M10 adapter/IndexedDB run, `C-M13`, or any M14 package/release conclusion. |
| M13 M10 review adapter | E32 uses real Chromium `C-M10-IDB-v1` with synthetic base bytes. It covers binding mutation, one opaque review pin, digest-gated invalidation without cursor advance, terminal reopen rejection, revoke-first classification of no-lease pre-pin and successful-rollback races, same-authority post-pin recovery, ordinary pre-operation and post-commit unpin loss, plus single-flight active-lease and lease-free replacement retry. | It is neither selected-media/runtime evidence nor the normative M13 export/restore protocol. Guest-generated changed writes, paused/reset restore, and composed power-loss algebra remain open. |

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
  tests/test_cadr_m13_selected_media_m10_browser.py \
  tests/test_cadr_m13_f06_f07_composition.mjs \
  tests/test_cadr_m13_m10_dispatch_browser.py \
  tests/test_cadr_m13_f05b_browser_oom.mjs \
  tests/test_cadr_m13_production_app.mjs \
  scripts/run-cadr-m13-f03-sanitizer.mjs \
  scripts/run-cadr-m13-f06-f07-composition.mjs \
  scripts/run-cadr-m13-f05b-browser-oom.mjs \
  scripts/run-cadr-m10-indexeddb-browser.mjs \
  scripts/run-cadr-m10-process-kill-browser.mjs cadr-web/browser/cadr-m13-shell.mjs \
  cadr-web/browser/cadr-m13-artifact-shell.mjs cadr-web/browser/cadr-m13-audio-reducer.mjs \
  cadr-web/browser/cadr-m13-selected-wasm-browser.mjs \
  cadr-web/browser/cadr-m13-selected-media-m10-browser.mjs \
  cadr-web/browser/cadr-m13-m10-dispatch-browser.mjs \
  scripts/verify-cadr-m13-provisional.mjs cadr-web/browser/cadr-m13-audio-browser.mjs \
  cadr-web/browser/cadr-m13-audio-fault-worklet.mjs \
  cadr-web/browser/cadr-m13-production-app.mjs \
  cadr-web/browser/cadr-m13-production-shell.html \
  tests/test_cadr_m13_production_browser.py \
  cadr-web/browser/cadr-m13-production-browser.html \
  cadr-web/browser/cadr-m13-production-browser.mjs \
  cadr-web/browser/cadr-m13-production-browser-worker.mjs \
  tests/test_cadr_m13_m10_review_adapter_browser.py \
  cadr-web/browser/cadr-m13-m10-review-adapter.mjs \
  cadr-web/browser/cadr-m13-m10-review-adapter-browser.html \
  cadr-web/browser/cadr-m13-m10-review-adapter-browser.mjs
```

This page records source and local test observations, not a public-release claim.
It contains no licensed Genera or private CADR runtime payload.

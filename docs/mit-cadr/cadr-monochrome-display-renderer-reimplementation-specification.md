---
type: Reimplementation Specification
title: CADR-WEB-303 ABI 1.5 monochrome display and browser renderer reimplementation specification
description: A release-bounded contract for transferring, validating, rendering, and testing the System 303 monochrome framebuffer without claiming an unrecorded native Listener-pixel oracle.
tags: [mit-cadr, lm-3, system-303, webassembly, display, framebuffer, renderer, reimplementation]
timestamp: 2026-08-02T05:37:12-04:00
---

# CADR-WEB-303 ABI 1.5 monochrome display and browser renderer reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303/ABI1.5/protocol-v5/M7` defines a new, browser-facing transfer and presentation layer for the selected LM-3 System 303 monochrome display. It preserves the declared logical screen shape, raw-word bit order, black-on-white control bit, and selected source-visible redraw effects. Nonclaim: it excludes X11-window, phosphor, browser-chrome, CSS-layout, monitor-timing, and color-TV compatibility.

The implementation and synthetic cross-target checks described here are complete. The M7-only native-capture support, strict private-record verifier, portable Form-C checkpoint wrapper, and fail-closed P4/P5 campaign orchestrators are implemented and unit-tested, but `C-M7` is **not yet closed**. It has two independent runtime obligations: raw native/Wasm identity at one real System 303 boundary (`TODO-RUNTIME-M7-01`) and a real-browser presentation capture proving integral fit and fullscreen behavior (`TODO-RUNTIME-M7-02`). Neither long campaign has run. The current native/Wasm comparison uses a deliberately synthetic two-word frame. That is useful evidence for bit order and transfer correctness, but not evidence that a real Listener screen has identical pixels in the two machines or that a browser presents it correctly.

This specification claims the following compatibility levels only:

| Level | Claim | Status |
| --- | --- | --- |
| `M7-P0` | fixed 768 by 963 raw-framebuffer representation and source bit order | closed for the selected `monitor = other` profile |
| `M7-P1` | defined `CDRDISP1` core-to-renderer record, dirty transfer, lifecycle replacement, and rejection semantics | closed by C and Node tests |
| `M7-P2` | deterministic logical and displayed-pixel rendering at integral scale | closed for synthetic records |
| `M7-P3` | selected native `tv.c` and Wasm/browser logical pixels agree for the declared synthetic fixture | closed |
| `M7-P4` | real selected-System-303 native and Wasm framebuffer checkpoint identity | open as `TODO-RUNTIME-M7-01` |
| `M7-P5` | real-browser integral fit and user-gesture fullscreen presentation evidence | open as `TODO-RUNTIME-M7-02` |

No level above is historical binary, source, X11, or full-system compatibility. In particular, `CDRDISP1` is a new portable record, not a Lisp Machine file format or a historical device protocol.

## Normative language, selected profile, and evidence

The terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` state requirements for an independent implementation of this reconstruction. They do not attribute the new worker protocol or dirty-record representation to historical CADR hardware.

| Code | Evidence | Establishes | Does not establish |
| --- | --- | --- | --- |
| `U303-TV` | public `usim` Fossil check-in `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`, [`tv.c`](https://tumbleweed.nu/r/usim/file?name=tv.c&ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d), SHA-256 `26b017bee040648edd5ade643f5777f819513f71639171207e40c06c3425a7d7` | selected source's monitor dimensions, raw bit walk, and polarity handling | a particular live System 303 screen or portable-core equivalence |
| `M0-RUN` | [`CADR-WEB-303 profile`](../../cadr-web/profiles/cadr-web-303.json) and runnable template | the selected native profile uses `monitor = other`, nearest scaling, and a 768 by 963 native window | raw guest framebuffer words or a portable continuation |
| `M7-SRC` | [`cadr_display.c`](../../cadr-web/core/cadr_display.c), [`cadr-display-renderer.mjs`](../../cadr-web/wasm/cadr-display-renderer.mjs), worker, and adapter | current portable transfer and renderer behavior | a historical implementation |
| `M7-UNIT` | M7 C and Node tests named below | exercised synthetic, malformed-input, and presentation behavior | an unexercised real guest screen |
| `M7-XTARGET` | direct native `tv.c` fixture and Wasm worker comparison | raw logical pixels agree for two selected source words | a native System 303 Listener checkpoint |
| `M7-DEVID-RAW` | retained, ignored receipt-bound 776a427 child envelope and outer-failure record | the bounded intervention child reached its recorded nonterminal 1,130,000-boundary state under the recorded systemd accounting | publication of an ordinary final receipt, a raw native frame, or browser presentation |
| `M7-EPI-UNIT` | [`test_cadr_m7_effective_page_identity.mjs`](../../tests/test_cadr_m7_effective_page_identity.mjs) | the selected synthetic M4/M6-to-M7 acknowledgement state machine and receipt validation | a historical disk protocol, a P4 run, or a framebuffer checkpoint |
| `INF-M7` | this specification | new wire format, dirty coalescing, generation, and browser ownership rules | a historical CADR device detail |
| `TODO-RUNTIME-M7-01` | the explicit oracle procedure below | the missing real-screen claim once run | a result before the capture exists |
| `TODO-RUNTIME-M7-02` | the explicit real-browser procedure below | integral fit/fullscreen presentation once run | raw native/Wasm identity |

The selected source profile is public LM-3/System 303 source revision `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` with `usim` revision `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`. The runnable profile template fixes `monitor = other`; source initialization then selects width 768 and height 963. The System 303 disk is an excluded local input with the identity recorded in the profile, never a tracked test fixture.

## Evidence-derived display model

`U303-TV` stores a 32K-word monochrome screen backing array. For the selected monitor, only the first `768 * 963 / 32 = 23,112` words constitute visible pixels; the remaining backing words MUST NOT appear in a logical-frame transfer. For a pixel at `(x, y)`, where coordinates are zero based and the rectangle is `0 <= x < 768`, `0 <= y < 963`, the raw bit is:

```text
word-index = y * 24 + floor(x / 32)
raw-bit    = (screen[word-index] >> (x mod 32)) & 1
```

Thus bit zero is the leftmost pixel of each 32-pixel word. The native screenshot routine walks the same word/bit pair in increasing linear-pixel order. Its textual PBM uses `1` for a set raw bit; that observation says nothing by itself about the displayed black/white palette.

TV mode bit 2 is the source's black-on-white (`BOW`) control. It leaves the raw screen words unchanged and changes only displayed polarity:

| `BOW` | raw bit 0 | raw bit 1 |
| --- | --- | --- |
| 0 | black | white |
| 1 | white | black |

The portable core retains the raw 32K-word backing state and mode/control state in its existing machine state. It does not import the source's X11 bitmap, callback, or host-time state. Color TV is not an alternative M7 presentation profile.

## Architecture and state model

```text
guest TV writes / snapshot restore
             |
             v
portable cadr_machine state (authoritative raw words and tv_mode)
             |
             +--> derived cadr_display_tracker --CDRDISP1--> dedicated worker
                                                          |
                                                          v
                                      CadrMonochromeFramebuffer -> canvas/export
```

The machine state is authoritative. `cadr_display_tracker` is a derived cache with a 23,112-word mirror, per-row dirty word intervals, last observed BOW bit, a framebuffer generation, and a permanent overflow-failure bit. It is deliberately absent from `CDRSTATE*` digests and `CDRSNAP1`; it MUST NOT change a pre-M7 snapshot or canonical-machine digest.

The framebuffer generation belongs to the host machine instance, not to snapshotted guest state. Creating a new host machine, including a standalone restore that returns a new machine, initializes the tracker from the current raw screen with `framebuffer_generation = 1` and requires a full refresh. Cold power-on and reset on an existing machine reserve the strictly next framebuffer generation before mutating core state, rebuild the tracker at that reserved generation, and require a full refresh. A same-worker restore creates the replacement core but adopts the old host instance's strictly next framebuffer generation before the worker swaps machines. It therefore does not resurrect a snapshotted dirty cache or restart the renderer-visible counter.

Before every display query, the tracker first counts changed active words and a possible BOW edge without mutating tracker state. If all increments fit, a second pass updates the mirror and dirty intervals atomically and advances the generation by that count. A BOW edge invalidates all row intervals and requires a full refresh. The scan-and-coalesce rule, number of generation increments, and row-rectangle strategy are `INF-M7` transport policy; they are not claims about a historical dirty-region API.

An unchanged TV-word write can still be visible to other core observations, but it does not change a display word. It MUST yield an empty `CDRDISP1` delta and MUST NOT advance the derived framebuffer generation. If synchronization, lifecycle replacement, or recovery-full generation would overflow, the tracker latches failed and returns `NOT_READY`; it MUST NOT wrap or partially change the mirror, dirty set, lifecycle state, or published bytes.

## `CDRDISP1` transfer record

All multi-byte fields are little endian. C structure layout, alignment, pointers, and typed-array host byte order are never part of the record.

| Offset | Width | Field | Requirement |
| --- | ---: | --- | --- |
| 0 | 8 | magic | ASCII `CDRDISP1` |
| 8 | 2 | version | exactly 1 |
| 10 | 2 | header bytes | exactly 80 |
| 12 | 4 | flags | only `FULL = 1` and `ZERO_IS_BLACK = 2` |
| 16 | 8 | machine generation | nonzero machine generation at capture |
| 24 | 8 | framebuffer generation | nonzero derived generation at capture |
| 32 | 4 | width | 768 |
| 36 | 4 | height | 963 |
| 40 | 4 | stride words | 24 |
| 44 | 4 | backing words | 32,768 |
| 48 | 4 | active words | 23,112 |
| 52 | 4 | TV mode | captured raw TV mode |
| 56 | 4 | rectangle count | 0 through 963 |
| 60 | 4 | payload word count | exact sum of rectangle words |
| 64 | 8 | payload bytes | `payload_word_count * 4` |
| 72 | 8 | encoded bytes | exact record length |
| 80 | `16*n` | rectangles | `x, y, width, height` u32 records |
| following | `4*m` | words | rectangle rows, then words left to right |

`ZERO_IS_BLACK` MUST be set exactly when BOW is clear. `FULL` requires exactly one rectangle covering `(0, 0, 768, 963)`. Every rectangle has nonzero word-aligned `x` and width; it lies wholly inside the logical display; records are canonical row-disjoint order; and their exact payload sum is required. A non-full record may have zero rectangles and zero payload. That canonical empty record is a successful no-changed-visible-pixels observation, not a failed request.

The tracker constructs each row interval from the least and greatest changed word. Adjacent rows with identical intervals coalesce into one rectangle. The resulting rectangle can include unchanged words inside the same dirty span; this is intentional over-transfer, not a claim that every payload word changed.

## Core and Wasm operation contract

The ABI major remains 1. M5 and the M6 protocol extension both use ABI minor
`4` (`ABI1.4`); M7 is exactly ABI minor `5` (`ABI1.5`) and protocol version 5.
The literal values are a conformance surface, not derived from a milestone count.
The tracker field, public display declarations, lifecycle hooks, display source,
and active minor are compiled only with `CADR_M7_CORE`. The ordinary library and
M3--M6 Wasm profiles retain ABI1.4, the pre-M7 `cadr_machine` shape, and no display
symbols; M7 uses a dedicated native library and Wasm source closure. M6-DEVID keeps
its separately selected source and export behavior.
Protocol v5 retains M3--M6 operations and adds only:

```text
display-update -> CDRDISP1 delta, possibly empty
display-full   -> one full CDRDISP1 record
```

Versions 1 through 4 MUST reject both operations with `INVALID_ARGUMENT`. A protocol-v5 instantiation MUST verify that the Wasm module exports both display entry points before it creates the machine. The worker owns the module and serializes requests; the main thread owns its received transferable byte array and browser UI.

`display-info` first synchronizes the derived tracker and returns its exact machine and framebuffer generations. `display-update-size` synchronizes and reports the required byte count. `display-update-take` synchronizes again, requires both caller generations to equal the current values and sufficient destination capacity, then encodes, validates, publishes, and clears the dirty set. A stale generation or short buffer writes zero result bytes and retains the dirty set. `display-full` synchronizes first, reserves the strictly next framebuffer generation, encodes and validates one full record with that generation, commits it, and clears the pending dirty/full state. A size failure, short capacity, validation failure, or overflow commits neither the generation nor pending-state acknowledgement.

The Wasm adapter obtains a fresh `display-info`, reserves a bounded host-owned arena, then calls one of those core operations. It transfers a copy, never a live Wasm-memory view. The worker validates `CDRDISP1` again before exposing the frame. Invalid core output becomes `INVALID_ARGUMENT`; an empty delta returns no `frame` property.

## Failure, abort, and recovery semantics

Malformed records, wrong fixed dimensions, unsupported flags, noncanonical rectangles, arithmetic-size disagreement, missing/full-inconsistent payload, stale generation, undersized output capacity, ABI mismatch, and a failed tracker are all rejected without publishing a partial transfer. A caller that loses or rejects a delta recovers by requesting `display-full`; its successful strictly newer full record supersedes and acknowledges the pending dirty state. A restored machine starts with a mandatory full record, so a renderer never merges a delta from a prior core with a restored raw screen.

The worker treats a malformed Wasm transfer as an `INVALID_ARGUMENT` response rather than passing it to the renderer. A browser renderer treats malformed or stale input as a synchronous exception and retains its previous complete framebuffer. None of these recovery paths writes guest memory, saves a snapshot, or labels volatile state as persistent.

## Browser framebuffer and presentation contract

`CadrMonochromeFramebuffer.apply` first parses and validates the complete record. Every record, including `FULL`, MUST have a framebuffer generation strictly greater than the last accepted record. A change in machine generation additionally requires `FULL`; that full may represent reset or restored guest state, so the machine generation itself need not increase. `FULL` replaces all 23,112 words atomically. An initial delta, an equal or stale full, a stale delta, or a machine-generation-changing delta is rejected. Rejection MUST leave the old pixels, generations, and BOW state unchanged. A valid delta copies the old array and patches only its declared word rectangles.

The renderer exposes two separate evidence products:

| Product | Meaning | Encoding rule |
| --- | --- | --- |
| raw framebuffer PBM | raw CADR word bits | P4 output serializes each visual row most-significant-bit first as required by PBM, after explicitly extracting CADR least-significant-bit-first source words |
| displayed-pixel PPM/RGBA | post-BOW black/white pixels | black is RGB 0,0,0 and white is RGB 255,255,255 |

The PBM container's bit order is an export-format rule; it does not invert CADR word bits. The displayed-pixel products are presentation observations and must not be used as a substitute for the raw frame when diagnosing device state.

`integerPresentation(viewportWidth, viewportHeight)` chooses the largest positive integer scale that fits the full logical screen and centers it with integer left and top letterbox margins. If either dimension cannot admit scale 1, it returns `fits = false`; a caller MUST offer scrolling, another viewport, or an explicit failure state rather than fractionally resampling the guest. Full-screen and fit-to-window hosts use this same rule with their chosen viewport. Entering browser fullscreen remains a caller-controlled, user-gesture-sensitive browser operation, not a capability of the guest or worker.

Canvas presentation allocates its backing canvas at the selected viewport dimensions, disables image smoothing, and sets `image-rendering: pixelated`. Its CSS width and height MUST equal the backing dimensions or an integer multiple. Device-pixel ratio, window manager composition, and other browser behavior are outside logical framebuffer conformance; the raw PBM and deterministic pixel buffers are the conformance surfaces.

## Conformance suite and evidence limits

Run the implementation-level gate with:

```sh
make -C cadr-web m7-unit
```

The canonical target includes both campaign-schema regressions; neither starts
a private runtime without a separate explicit `--execute`.

| Test | Discriminating cases |
| --- | --- |
| `test_cadr_m7_display` | literal ABI values (M6 = 4, M7 = 5), layout and boundaries, dirty spans, BOW full refresh, stale generation, short output, ABI rejection, monotonic cold-power/reset and fresh standalone-restore initialization, recovery-full advancement, digest exclusion, empty delta, and transactional synchronization/lifecycle/recovery overflow |
| `test_cadr_m7_profile_isolation` | exact pre-M7 native ABI/module shape, no display symbols or tracker storage in the ABI1.4 library, reviewed pre-M7 M5 Wasm SHA-256, and exact M5/M6-DEVID export inventories without pinning unstable native host bytes |
| `test_cadr_m7_native_tv` in checkout-only `m7-native-source-unit` | exact-pinned native `tv.c` closure, monitor selection, source raw-bit walk, source BOW palette transition, and native P1 screenshot bits |
| `test_cadr_m7_renderer.mjs` | raw PBM/displayed PPM hashes, LSB-first extraction, BOW polarity, strictly monotonic full/delta application, stale/equal full, old-machine stale full, old-machine high delta, malformed-record atomic rejection, integral letterboxing, and canvas smoothing policy |
| `test_cadr_m7_worker.mjs` | protocol-v4 rejection, protocol-v5 export admission, initial/full/empty response shape, same-renderer restore at exactly the next framebuffer generation, recovery-full advancement, and full 739,584-pixel O0/O2 equality against the independent zero-plus-three-bit logical fixture; checkout-only runs additionally compare both builds to a fresh native PBM |
| `test_cadr_m7_frame_checkpoint.mjs` | synthetic Form-C boundary wrapper sequencing, portable witness validation, strict frame comparison, and first-difference reporting |
| `test_cadr_m7_effective_page_identity.mjs` | default-disabled M4 preservation; first-write replay precedence; selected boot-scratch arm; exact effective-page acknowledgement; independent receipt validation; changed, malformed, reread-failure, targeted-fault, and detach rejection without media mutation |
| `test_cadr_m7_native_frame_witness.py` in checkout-only `m7-native-source-unit` | source-local private capture writer framing, one-shot behavior, and failure rollback against the pinned native `tv.h` declaration |
| `test_cadr_m7_native_frame_oracle.py` in checkout-only `m7-native-source-unit` | private-record parser, isolated M6-then-M7 source closure, build-marker integrity, and inert capture-plan validation |
| `test_run_cadr_m7_frame_conformance.mjs` | P4 hashes-only manifest schema and substitutions of every release, source, support, artifact, schedule, session, disk, process, native-frame, portable-module, contemporaneous adapter observation, staged worker closure, checkpoint, comparison, and summary binding |
| `test_run_cadr_m7_browser_conformance.py` | P5 full-record parser, P4 browser-input/schema rejection, 767px zero-fit/real-fullscreen result schema, and malformed-result rejection without launching Xvfb or Chromium |

The M7 cross-target fixture writes source-native words `0x80000001` at word zero and `0x00000002` at word 25, then writes the same values into a portable snapshot. The test compares all 739,584 raw logical pixels from native P1 output and from the Wasm `CDRDISP1` record, not an interpolated canvas. It proves source-bit-order agreement for those selected values, including positions 0, 31, and `(33, 1)`. It is intentionally synthetic and must never be relabeled as a System 303 boot or Listener screenshot.

`m7-unit` is the self-contained clean-archive gate and is a prerequisite of
ordinary `make test`. It has no dependency on the ignored native checkout and
compares every O0/O2 logical pixel to an independently constructed expected
array. Ordinary `make test` also requires `m7-native-source-unit`. That
checkout-only differential target rejects a missing, symlinked, or
hash-mismatched `tv.c`, `tv.h`, `bus-interface.h`, `ucode.h`, `utrace.h`,
`usym.h`, `trace.h`, or BSD notice; it generates a fresh private native PBM
and compares all of its pixels to both Wasm builds. A source release without
Git history or the separately pinned public native checkout can run the clean
milestone targets, but cannot claim the full checkout suite.

Neither target invokes a long private runtime campaign. The two explicit
runners refuse to start without `--execute`, so schema tests cannot
accidentally cold-boot a private CADR session. Those remain the separately
named `TODO-RUNTIME-M7-01` and `TODO-RUNTIME-M7-02` gates below.

The test PBM/PPM outputs are transient synthetic test artifacts. They are not curated runtime screenshots and are not embedded in this knowledge base. No visible System 303 claim is made on this page, so no published screenshot is substituted for the open runtime oracle; this follows the repository's [screenshot-publication review](../screenshot-publication-rights-review.md).

## Receipt-bound M7-DEVID intervention evidence and offline recovery

The retained 776a427 M7-DEVID intervention child completed its bounded
1,130,000-guest-boundary run, but the ordinary final receipt was not
published. This is a validator defect in the outer publication path, not a
failed guest run. It is recoverable only by a separately committed,
no-replace offline recovery tool. That recovery completed from commit
`97a95ae62d779cfca5a8059b7679947ff21bb64a` and published only the separately
labeled ignored recovery receipt described below. The intervention remains
narrower than `M7-P4` and does not close `C-M7`.

`M7-DEVID-RAW` is local, ignored evidence. The child envelope is
`.8cdaef46c7a239112b4352d01fb06c87.m7-canary-envelope.json`, 28,023 bytes,
SHA-256 `efd29682e90adfa6413412aa051787802cbdd3fd571180cc73ca1d53ed1061ba`.
It names base `ab6536353360d48bb6620e7da04275935f51f37a`, its sole-parent
candidate `776a427b71a52911df531e1c2aaef29089300be4`, and the two-file textual
patch (`cadr-web/Makefile` and `tests/test_cadr_m7_devid_o2_canary.mjs`) with
SHA-256 `2b747c58932c2a51896555ff3b8522a05ea2c0cac22b260e364473d54c250b17`.
The retained child record reports persistent status zero, no outstanding
request, 535 accepted disk-evidence events, 23 tail events, and completed
boundary `1130000`. These facts are bounded to that recorded child and do not
establish native-frame or browser behavior.

The accompanying outer failure is `final-receipt.json.failure.json`, 1,170
bytes, SHA-256 `6646a8f81747d9c5c8e3097c3559a5a0c564f0d90c4dc67f21d78aaa6301bea7`.
It records successful submission and child exit status, successful accounted
systemd completion, retained child envelope, successful cleanup (no cleanup
failure), and the two original reasons: outer
`final-receipt-publication-failed` and validator
`candidate-identity-failed`. The outer wrapper performs its cleanup before it
attempts final-receipt validation/publication; this record therefore supports
reconstructing the two cleanup booleans only after the raw pair and wrapper
semantics are revalidated together.

The defect was in `sourceClosureFromGit`: it selected candidate bytes for
*every* path in the base tree. The staged tree, however, is the base archive
overlaid only by the two-file payload patch; the candidate additionally changes
the fixed manifest, whose bytes are not staged by that overlay. The faulty
all-candidate recomputation produces SHA-256
`26bbbee0a17688ff82a5b42f16ced571d490e3c5a4fb988affc76d620122418f`.
The actual staged closure and the candidate's closed manifest agree on
`81a13568e95fdf6cd951ac50bb07a4f9045d09684b5ca4ddd83cb8caeb5bb2f1`
(1,154 files and 22,896,951 bytes). The corrected validator reads candidate
bytes only for payload-patch paths and base bytes for every other path.

[`recover-cadr-m7-devid-o2-canary.mjs`](../../scripts/recover-cadr-m7-devid-o2-canary.mjs)
implements the only authorized recovery procedure. It requires an explicit
`--execute`, and an exact committed two-module local ESM closure: the entry
point and the crypto/record-only
[`cadr-m7-devid-o2-recovery-core.mjs`](../../scripts/cadr-m7-devid-o2-recovery-core.mjs),
in that order. It does not import the M6/M7 runner, stage executor, systemd
wrapper, or any guest-capable module. Each verification opens both retained raw
records as owned mode-0600 nonsymlink files, checks their fixed identities and
canonical UTF-8 JSON encodings, derives `source_evidence` and the reconstructed
final receipt only from those freshly read records, then exact-deep-compares the
candidate receipt to that derivation. It independently repeats the raw-derived
comparison immediately before publication and again after reopening the
published canonical no-replace receipt. Thus a caller-supplied embedded
`source_evidence` or `reconstructed_final_receipt` cannot substitute for the
retained raw pair.

The verifier also requires the sole base/candidate/manifest lineage, successful
accounted unit/submission/child/cleanup invariants, and both the faulty and
corrected closure digests. It writes only inside the existing private 0700
evidence directory, rejects an ordinary `final-receipt.json`, an existing or
symlinked output, and any output outside that directory. It never invokes a
system manager, guest, native emulator, or browser; its focused tests include a
successful PATH-spy derivation and coordinated mutations of repeated unit,
accounting, guest, gate, launcher, toolchain, control-plane, frozen-release,
and helper-module fields.

`EVIDENCE-M7-03` completed once with the exact committed two-module tool
closure at `97a95ae62d779cfca5a8059b7679947ff21bb64a`. It created the ignored
mode-0600 file `recovery-receipt.json`, 30,836 bytes, SHA-256
`5e5e389a3d7d536535066ab65209de6d6dedfad33cca0e3744bf6f08cf46ce4a`.
The receipt has schema `cadr-m7-devid-o2-canary-recovery-v2`, outcome
`recovered-final-receipt`, and the exact root keys `schema`, `outcome`,
`source_evidence`, `recovery_tool`, `diagnosis`, and
`reconstructed_final_receipt`. It binds the unchanged raw pair, candidate
`776a427b71a52911df531e1c2aaef29089300be4`, completed boundary `1130000`,
the corrected and faulty closure digests above, verified unit cleanup and root
removal, and the ordered committed identities of both recovery modules. The
ordinary `final-receipt.json` remains absent and both raw inputs retain their
original identities. This bookkeeping repair was not a retry and does not
claim `M7-P4`, `M7-P5`, or `C-M7` closure.

## `TODO-RUNTIME-M7-01`: close raw native/Wasm checkpoint identity

The support described in steps 1--3 exists as an M7-only, unexecuted capture path; the supervised runtime campaign remains planned. It closes `M7-P4` only if both halves name the same completed Form-C guest slot and compare the raw words. It cannot by itself close `C-M7`, because it does not exercise a real browser's layout or fullscreen path.

### 1. Native capture at the Form-C mutation boundary

[`0003-m7-frame-witness.patch`](../../cadr-web/oracle/patches/0003-m7-frame-witness.patch) applies **after** the existing M6 witness patch in a disposable native-source copy. It adds the `m7-frame-oracle` / `WITH_CADR_M7_FRAME_ORACLE` build mode and source-local [`cadr_m7_frame_witness.c`](../../cadr-web/oracle/native/cadr_m7_frame_witness.c). It does not edit `0002-m6-debug-ir-witness.patch`, the M6 runner, or the frozen M6 release record. Its only changes to M6 support are inside that disposable source closure; they mark an already accepted Form-C write pending and expose failure to the M7-only backend. It also changes the disposable `tv.h` declaration to an explicit 32,768-word backing type and adds a `tv.c` compile-time size assertion. Thus an incompatible source backing declaration fails the M7 native build rather than merely being trusted through an incomplete `extern` declaration.

`cadr_m6_witness_debug_write` accepts the ninth expected write only after it has formed and validated the complete Form-C value (`seen_b` is true, `match == CADR_M6_WITNESS_C`, and no prior C was accepted). That Debug-IR hook observes the **pre-increment** `machine_cycles` value: `982990213` in the frozen M6 schedule. It therefore only marks the M7 capture pending. In `ucode_run`, after `uexec_step`, idle checking, and `machine_cycles++`, the M7 call is the first operation in `cadr_m6_witness_boundary`, before M6's clock/cleanup policy. The recorded `CDRM7N1` boundary is consequently the completed-C-slot value `982990214`; it is neither the pre-increment write value, `c_cleanup_start`, the later settled event, nor a 64-sample idle suffix. A successful capture leaves the M6 witness's ordinary completion policy intact. A capture error marks the M7-only witness failed and halts that M7 source run rather than spinning to a later, ambiguous state.

The witness must copy `tv_screen_buffer` directly, never an X11 surface, palette-expanded bitmap, or `tv_save_screenshot` output. It verifies `tv_width == 768`, `tv_height == 963`, 32-bit source words, active-word count `768 / 32 * 963 == 23112`, and the compile-time-proven backing count `32768`, then writes exactly one private, newly-created `CDRM7N1` capture. Its little-endian 64-byte header is:

| Offset | Field |
| --- | --- |
| 0 | ASCII `CDRM7N1` in bytes 0--6, with required zero byte 7 (an 8-byte slot) |
| 8 | `u32` format version `1` |
| 12 | `u32` header byte count `64` |
| 16 | `u64` accepted Form-C write boundary |
| 24 | `u32` width (`768`) |
| 28 | `u32` height (`963`) |
| 32 | `u32` source TV mode |
| 36 | `u32` `tv_is_black_on_white()` result (`0` or `1`) |
| 40 | `u32` backing words (`32768`) |
| 44 | `u32` active words (`23112`) |
| 48 | `u32` payload bytes (`92448`) |
| 52 | `u32` flags (`0`) |
| 56 | eight zero reserved bytes |

The header is followed by exactly 23,112 `u32` raw screen words in source word order. The capture writer requires an absolute output pathname, rejects an existing output, creates `<output>.tmp-<pid>` with `O_EXCL`, `O_NOFOLLOW`, and mode 0600, verifies it is a singly linked regular file, completes both writes, `fsync`s and closes it, then publishes using no-replace `link(2)`, removes the temporary name, and `fsync`s the parent directory. If temporary-name removal or the final directory sync fails after the link is visible, it retracts the published output and attempts the directory sync again; it never returns a successful capture with that failure path. Malformed dimensions, a BOW/control-bit disagreement, an existing or symlink output, a short write, or any I/O error fails the **M7** run. [`cadr-m7-native-frame-oracle.py`](../../scripts/cadr-m7-native-frame-oracle.py) prepares the M6-then-M7 disposable closure, builds only the no-window backend, and strictly verifies a private `CDRM7N1` file under ignored `build/cadr-oracle/`; its verifier opens the final component with `O_NOFOLLOW`/`O_CLOEXEC`, `fstat`s that descriptor, and requires a current-owner, singly linked, exact-0600 regular file before reading its fixed byte count. Its marker loader applies the same current-owner/non-symlink and safe-mode rule, checks exact source/usim containment, canonical marker JSON, current source/patch/support hashes, and rehashes the exact executable named by the closed build marker before it will report a capture plan. Marker publication itself is temporary-file, file-sync, no-replace-link, directory-sync, and rollback-on-late-failure, not a direct final-file write. It never starts a boot. Its inert `capture-plan` command names the future private-run integration sequence without executing it. The `cadr-m7-native-frame-minimal-environment-v1` policy adds only `CADR_M7_FRAME_OUTPUT` to the explicit M6 schedule/log/idle/session variables, with `LANG`, `LC_ALL`, and `TZ` fixed and no inherited host environment. A future runner must validate that pathname as fresh and inside its newly created private run directory before launch.

### 2. Portable capture at the same boundary

[`cadr-m7-frame-checkpoint.mjs`](../../cadr-web/wasm/cadr-m7-frame-checkpoint.mjs) is the separate M7 wrapper; it does not change `run-cadr-m6-wasm-conformance.mjs` or M6 evidence. It wraps the frozen M6 headless-boot driver's generic client surface. After an initial `machine-info`, it updates its own last boundary after **every** successful `run-digest-batch-m5` response, so consecutive batches cannot reuse a stale machine-info value. If a completed batch is below C it returns normally; if it crosses C without an exact stop it fails closed. At exactly the native `CDRM7N1` completed-C boundary, before it resolves that batch response (and therefore before the M6 driver can dispatch a later guest boundary), it requires the complete Form-C `boot-witness` and requests protocol-v5 `display-full`. The wrapper captures the 96-byte M6 witness sample, explicit boundary, and full display record as one portable checkpoint. It is test-covered but has not been used with the real artifact boot.

The accepted portable record must be a full `CDRDISP1` frame with width `768`, height `963`, stride `24`, active words `23112`, and one full rectangle. Its control-derived BOW state and 23,112 raw words are decoded to a canonical little-endian word stream. The portable run must also reach the ordinary M6 completion predicate after the capture, but later state is not substituted for the named C-boundary frame.

### 3. Comparator and retained evidence

The M7-only comparator requires the wrapper-produced portable checkpoint object, not a bare `CDRDISP1` record. The native parser accepts only the frozen M6 completed-C boundary `982990214` (which is explicitly checked not to be a 60 Hz due boundary), not an arbitrary nonzero Form-C-looking state. It first requires the portable object's explicit boundary to equal that value, its M6 release-record SHA-256 to equal the compiled frozen M6 release digest, and its retained 96-byte sample to be a fully framed quiescent `CDRM6I1`: magic and zero slot, embedded Form C, 48-bit `p0`/`p1`, IOB CCLK clear, FIFO empty, all-up scancode `0x18000`, disk status `3`, inactive transfer and outstanding operation, retained disk IRQ `1`, and zero host-pending/completion fields are all parsed before it is retained. The comparison hashes that complete sample as evidence. A full display record alone cannot establish cross-target boundary or release equality. It then requires identical dimensions, active-word count, TV mode, and BOW state and compares all 23,112 raw `u32` words before deriving pixels. On failure it reports the first differing word index, its `(x-word, y)` location, all differing bit positions with their `(x, y)` coordinates, native and Wasm words, and both capture-record hashes. It fails on a raw mismatch even if palette-expanded RGB happens to agree. On success it records both raw-stream SHA-256 values, both record hashes, the frozen release digest, and witness-sample hash; the future campaign evidence must additionally bind the M7 patch/executable/module hashes, source pin, artifact and private-disk identities, schedule hash, session IDs, start/end disk hashes, and termination status.

Raw captures, decoded PBM/PPM/PNG comparison products, logs, and sidecars remain in the ignored M7 oracle/session tree. The tracked result may contain only a schema-validated evidence summary and hashes; it must not include raw screen words, a disk, or a private snapshot.

The P4 boot campaign uses the distinct `m7-devid` Wasm build. It combines the
M7 display exports with the M6 prefix-and-tail evidence continuation policy so
the frozen 512th evidence record does not turn the next successful disk event
into terminal status 12. Ordinary `m7` remains a separate snapshot-compatible
test profile. A receipt-bound O2 intervention canary must cross boundary
`1130000` with persistent status zero, no
outstanding request, 535 accepted events, and 23 tail events before the long
P4 campaign is admissible. Its closed manifest binds the named base and
single-parent candidate, selective patch, every postimage, staged source
closure, builder, worker, headless runner, toolchain/environment identities,
and produced Wasm bytes. That source-bound canary is still narrower than the
M14 reproducible release, and a failed or preliminary earlier receipt cannot
substitute for it. This profile split is a preservation/testing contract, not
a historical CADR distinction.

[`run-cadr-m7-frame-conformance.mjs`](../../scripts/run-cadr-m7-frame-conformance.mjs) is the P4 campaign entrypoint. It requires a fresh explicit `--execute` invocation, and the subordinate native-capture CLI independently requires the same explicit authority and treats `captured` as its sole successful runtime result. The campaign requires an M7 prepared/build closure, a native configuration, and a new 0700 ignored session below `build/cadr-oracle/`. Before starting the child it constructs the native expectation from the parent-generated session and disk IDs, pinned release source/schedule/artifact/native-input records, tracked patch and support bytes, prepared-tree/build markers, and a fresh executable hash. It materializes the native half as exactly `native/frame.cdrm7n1`, `native/capture.ndjson`, `native/idle.bin`, and newline-free canonical `native/metadata.json`, all 0600. The parent independently parses and hashes those outputs, waits for the child `close` event so both pipes have drained, records its exit code and signal, and requires the stdout and file metadata to equal the parent expectation exactly. It then creates a separate protocol-v5 worker and writes the portable half as exactly `portable/frame.cdrdisp1`, `portable/witness.cdrm6i1`, `portable/ready.json`, and `portable/worker.ndjson`, all 0600. The ready record and every worker-log response bind the actual portable session identity; the native result retains both its session and private-disk instance identities. Only `comparison.json` and canonical `manifest.json` appear at the session root. Validation requires the native capture, portable checkpoint, comparison, and summary redundant hashes all to name the same fresh receipts. Its hashes-only summary binds both Fossil pins, M6 release digest, M6/M7 patch and support hashes, prepared-tree and executable identities, five artifacts and native hosts input, canonical schedule/transcript, the session and disk identities, private-disk before/after identities, Wasm identity, the private staged worker closure, contemporaneous adapter-file observations, completed Form-C boundary, witness/raw-frame/`CDRDISP1` hashes, and clean native-process/worker termination with no pending work. The adapter observations name files present at execution time; they are not a claim that those files produced the already-built Wasm module. Producing-source closure remains a reproducible release-build obligation. It rejects an existing result name, changed disk, stale/partial boundary, missing worker termination, or a substitution of any binding. This is harness evidence only, not a P4 runtime result before an operator completes the campaign.

### 4. Screenshot and publication boundary

An image rendered from the M7 raw comparator is an oracle by-product, not automatically a publishable screenshot. If a visual is needed to support a substantive historical claim, reproduce the selected state through the CADR Xvfb computer-use harness and complete the repository's per-image four-factor rights review. A selected asset belongs only in `docs/assets/mit-cadr-screenshots/` with its copyright basis, attribution/no-endorsement notice, exact session and artifact provenance, input sequence, dimensions, PNG and pixel hashes, and shutdown status. Otherwise retain the image only in the ignored session tree and leave the prose without a decorative screenshot.

### 5. M6 release isolation

The current M6 release remains immutable. `0003`, the frame-witness executable, its environment policy, capture bundle, comparator, and M7 evidence record are a new M7-only lineage that references the frozen M6 release by SHA-256. It neither rewrites M6 evidence nor broadens the M6 verifier's accepted output. Do not begin this long native/portable campaign until the supervised M6 campaign has finished and its release artifacts are stable.

### 6. M7 effective-page identity acknowledgement companion

The additive, default-disabled profile
`CADR-WEB-303/ABI1.5/protocol-v5/C-M7-P4-EFFECTIVE-PAGE-IDENTITY-v1`
recognizes one later write whose bytes already equal an effective in-range
1,024-byte disk page, without mutating that page or inventing a second M4
commit. It is not a general CADR disk protocol claim.

The M7 wrapper supplies the exact policy to the M6 fast driver, which retains
its frozen M4 and `CDRM6FAST1` representations.  The companion first observes
the selected M4 sequence: the normal initial LBA-1 `COMMIT`, its overlay-backed
comparison read, and the LBA-0 base read.  It then requires the next qualifying
M6 quiet suffix at or after boundary `1030044`: reason `1`, persistent status
`0`, and no outstanding host request. That state creates a typed arm binding
all three completed boot requests, their boundaries and page hashes, and the
quiet record. It neither writes a page nor changes M4 staging, generation,
root, dirty, or persistence state.

An armed companion accepts at most one non-replay write only when its descriptor
is exactly one in-range 1,024-byte block, transaction ID equals request ID, and
its `(generation, request ID)` is newer than the initial commit. It compares
LBA 1 with the effective overlay and every other LBA with an overflow-safe
bounded base read. Exact replay of the initial LBA-1 descriptor and payload has
precedence and remains M4 replay; same-ID descriptor or payload changes fail.
Successful delivery produces only an internal candidate. M6 then rereads the
effective page from the trusted service and validates the adjacent issue and
completion records in the serialized `CDRM6HS1` transcript before it constructs
the public `IDENTITY_ACK`.

That v3 receipt binds the selected base, full arm, request LBA and bounds,
generation/request/transaction identities, descriptor and payload hashes,
issue/due/completion boundaries, host status, effective source, unchanged
overlay generation/root, and transcript plus record digests. The record excludes
page bytes. Validation requires the transcript again and exactly one independent
page authority: trusted reread bytes for general tests, or the separately pinned
effective-page hash for selected P4. The authority also supplies the expected
base byte count and hash. The validator independently bounds the page and
derives the canonical overlay root from that base plus the initial committed
LBA-1 page; receipt-provided base and root values are not authorities. Each of
the three arm operations must have exactly one matching `CDRM6HS1`
issue/completion pair, distinct from the candidate pair.

Changed, stale, malformed, or out-of-range input, a second candidate, any
selected M4 fault, short or throwing reread, completion failure, detach, or
forged receipt/transcript produces no acknowledgement and does not fall back to
staging, committing, generating a root, persisting, or creating a sparse
overlay.

Selected P4 requires exactly one non-null acknowledgement for generation `1`,
request and transaction `135`, LBA `1299`, issue/due/completion boundary
`1366722`, effective-page SHA-256
`ba1b1cc2228edbe5028760e47687c6889023fc72221bd5c5f5be85c4cfbb6a00`,
selected-base SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`,
and unchanged overlay generation `1`. The campaign execution receipt includes
the canonical acknowledgement digest. These are selected compatibility
requirements derived from retained request evidence, not proof that the new
acknowledgement path has completed a real P4 run. `M7-EPI-UNIT` remains
synthetic unit evidence; no new P4 campaign was run, and `M7-P4`, `M7-P5`, and
`C-M7` remain open.

The selected arm is additionally pinned to generation/request/transaction/LBA
tuples `(1,1,1,1)`, `(1,2,0,1)`, and `(1,3,0,0)` for initial commit,
comparison read, and base read respectively, plus the exact reason-1 quiet
record at boundary `1030044`. Self-consistent substitutions remain invalid.

This oracle will discriminate an accidental word-endianness agreement in the synthetic fixture from actual machine-state equivalence. Until it exists, neither the M0 native Listener pixel hash nor this page's synthetic PBM hashes establish native/Wasm System 303 display identity.

## `TODO-RUNTIME-M7-02`: verify a real browser presentation

After `TODO-RUNTIME-M7-01` supplies the source-bound portable full record, load that record through the production worker and renderer in a real supported browser, not a Node canvas mock. Retain browser/version, OS/display scale, device-pixel ratio, viewport and screen dimensions, module and renderer hashes, input-record hash, and the ordered operator actions.

The run MUST exercise and capture both an ordinary fit viewport and fullscreen entered through a real user gesture. For each state, inspect the canvas backing dimensions and bounding rectangle; prove that the entire 768 by 963 frame is visible, the selected scale is a positive integer, each source pixel maps to an exact integral rectangle, letterbox margins match `integerPresentation`, image smoothing is disabled, and no CSS or device-pixel-ratio transform introduces fractional resampling. A deliberately too-small viewport MUST expose the defined non-fit behavior rather than silently scaling fractionally.

Retain raw screenshot bytes, PNG and decoded-pixel hashes, browser automation log, fullscreen entry/result, and exit result in the ignored session tree. Any selected image for `docs/assets/mit-cadr-screenshots/` additionally requires the repository's per-image rights review and catalog provenance. This campaign closes `M7-P5`; `C-M7` closes only when both `M7-P4` and `M7-P5` are closed.

[`run-cadr-m7-browser-conformance.py`](../../scripts/run-cadr-m7-browser-conformance.py) is the P5 entrypoint. It binds the manifest session ID to the supplied directory basename and revalidates the complete closed P4 schema, including unchanged private disk, clean native/oracle/portable termination, session evidence, every redundant checkpoint hash, and fresh hashes of all nine P4 sidecars. It independently parses the rehashed fixed-size `CDRM7N1`, types every header field, and derives BOW from the uint32 TV mode before accepting the manifest capture identity. Before starting its server it snapshots the exact `CDRDISP1`, generated HTML, production JavaScript, renderer, and CSS bytes. GET and HEAD share one explicit loopback allowlist with `Cache-Control: no-store`; every other repository path returns 404, and no request rereads changing repository assets or falls back to `m7-synthetic-record.mjs`. On explicit `--execute`, it requires nonempty hashed Chromium and Xvfb command identities and the reviewed Chromium 150 profile, creates a new 0700 ignored session and a fresh 0600 Xauthority cookie, passes that cookie to Xvfb with `-auth`, and exposes `XAUTHORITY` only to Chromium. It starts headed Chromium on isolated 1920-by-1200 Xvfb with `devicePixelRatio = 1`, and binds the served host, renderer, and CSS snapshots by exact path and hash in the closed result. It independently recalculates integral fit, validates and retains integral canvas/stage/source-clip bounds, proves the source placement from stage origin plus letterbox offsets, verifies canvas backing and computed CSS dimensions, pixelated/no-smoothing policy, full source-frame pixel rectangles, and decoded ordinary/fullscreen PNG hashes. It requires a 767px zero-fit result. Fullscreen entry and exit are trusted host-control clicks and both must succeed; denial, a fallback message, fractional coordinate, cacheable frame route, missing full-frame capture, or failed exit invalidates the campaign. Raw captures and logs remain 0600 ignored session payloads. No P5 browser run has yet been performed.

## Artifact boundary and sources

Tracked implementation material is the portable C/JavaScript code, synthetic fixtures, tests, and this specification. The public `usim` source is BSD-2-Clause under the exact source-map provenance. The System 303 disk, PROM and microcode payloads, raw native captures, private snapshots, and any real display capture remain outside this M7 tracked deliverable unless their separate rights and provenance reviews permit a narrowly selected image.

Primary sources and local witnesses:

- `usim`, [`tv.c`](https://tumbleweed.nu/r/usim/file?name=tv.c&ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d), lines 21--75, 169--245, and 283--366; verified 2026-07-29.
- [CADR core source map](../../cadr-web/core/usim-port/source-map.json), selected revision and public-source identity record; verified 2026-07-29.
- [CADR-WEB-303 profile](../../cadr-web/profiles/cadr-web-303.json) and [runnable template](../../cadr-web/profiles/cadr-web-303.ini.in), selected monitor and private-artifact boundary; verified 2026-07-29.
- [M7 core transfer implementation](../../cadr-web/core/cadr_display.c), [browser renderer](../../cadr-web/wasm/cadr-display-renderer.mjs), and [native/Wasm fixture test](../../tests/test_cadr_m7_worker.mjs); verified 2026-07-29.

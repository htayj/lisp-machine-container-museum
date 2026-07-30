---
type: Reimplementation Specification
title: CADR-WEB-303 C-M8 keyboard input reimplementation specification
description: Phase 1 host-only contract for a 100-key DOM-code Space Cadet map and canonical 16-bit Cadet input transitions under the selected System 303 X11 profile.
tags: [mit-cadr, lm-3, cadr-web, keyboard, x11, reimplementation]
timestamp: 2026-07-29T21:50:00-04:00
---

# CADR-WEB-303 C-M8 keyboard input reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303/ABI1.5/protocol-v6/C-M8-KBD-X11-INFO16-v1` is a Phase 1,
host-only input contract. It recreates a selected **16-bit Cadet event stream**:
an explicit 100-physical-key `KeyboardEvent.code` map, an 18-key physical held
modifier model collapsed to the 11-bit Cadet all-up mask, bounded queueing,
canonical state bytes, and the dedicated host-side protocol operations that a
later v6 worker integration may call.

It claims semantic and selected wire-representation compatibility for those
synthetic host-controller rules. The table preserves the System 46 Cadet values
for Macro (`0100`), Call (`0107`), and Repeat (`0115`) and the source-visible
all-up bit assignments. It does **not** claim that a browser, a physical USB
keyboard, a preserved System 303 band, or an original keyboard controller has
run this exact DOM map. It does not wire the controller into the dirty worker,
widen the core ABI, send generic scheduler keyboard events under protocol v6,
close C-M8, or confirm any guest-visible runtime behavior.

The M8 onscreen view is a host accessibility representation of the same 100
descriptors, not a screenshot or a claim about a CADR screen. It consequently
has no CADR runtime screenshot. A future visible guest-input claim requires an
isolated System 303 Xvfb-computer-use run and the repository's capture and
rights review.

## Normative language and evidence

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` define this selected reconstruction
profile. They do not silently modify either historical source profile.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `S46-KBD` | Public System 46 readable source | New-keyboard conversion, 16-bit all-up discrimination, table entries for Macro/Call/Repeat, and the historical table's key roles | That System 303-0 loaded that exact source or that it accepts browser DOM input |
| `S303-X11` | Pinned maintained `usim` readable source | X11 key/release flow, modifier query, all-up decision, and `kbd_event` low-word conventions | Browser event semantics, runtime loading, or a USB layout |
| `S303-CADET` | Pinned maintained `usim` readable source | 11 all-up modifier bit positions and left/right modifier scan codes | A complete physical browser layout |
| `ALT-SDL3` | Pinned maintained alternate backend source | The 24-bit NKB representation and its Macro/Call collision and Repeat-zero table defects | The selected C-M8 value or wire representation |
| `DEC-M8` | Frozen reconstruction decision | Profile name, DOM `code` selection, all 100 host descriptors, v6 host-only boundary, bounded queue, and focus-loss transaction | A historical browser or CADR API |
| `INF-M8` | Explicit reconstruction inference | Canonical `CDRM8KB1` record and rejection/atomicity rules not exposed by a historical source | Original storage or locking implementation |
| `TEST-M8` | Synthetic Node conformance test | Exhaustively exercised map, masks, rollover, failure, bytes, and protocol boundary | A preserved-system runtime result |
| `OPEN-M8` | Open oracle class | Identifies the exact runtime obligations below | Any result before a named experiment runs |

When sources differ, the profile does not average them: `S46-KBD` supplies the
selected legacy Cadet numbers, `S303-X11`/`S303-CADET` supply the selected
maintained X11 transition model, and `ALT-SDL3` remains an explicit alternate
defect record. `DEC-M8` selects a browser transport that none of those sources
could have implemented.

## Exact profile and evidence ledger

| Profile or witness | Exact identity | Relevant result | Status |
| --- | --- | --- | --- |
| Selected C-M8 | `CADR-WEB-303/ABI1.5/protocol-v6/C-M8-KBD-X11-INFO16-v1` | 100 host keys; lower 16-bit Cadet words; no worker wiring | normative Phase 1 |
| System 46 | Git `8e978d7d1704096a63edd4386a3b8326a2e584af` | `KBD-CONVERT-NEW` consumes all-up words and its 200-entry table assigns Macro `0100`, Call `0107`, Repeat `0115` | source cross-check, not selected runtime |
| maintained System 303 system tree | Fossil `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | selected system source boundary; restoration check-in, not a historical release date | profile identity only here |
| maintained `usim` X11 | Fossil `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` | X11 `KeyPress`/`KeyRelease`, modifier scan, and all-up path | selected event-model source |
| maintained `usim` SDL3 | same `330d8248…` check-in | 24-bit NKB builder; broken `call` and `repeat` table values | alternate, deliberately excluded |

The local System 46 checkout was inspected at Git commit `8e978d7d…`.
The local maintained LM-3 inventory verifies the `system-303` Fossil check-in
`4df393c…` against its recorded manifest; the CADR-WEB profile records both it
and the `usim` check-in. The materialized, independently hash-checked `usim`
sources below were inspected rather than treating the profile pin as source-body
evidence.

| Claim | Witness and portable identity | Status |
| --- | --- | --- |
| X11 receives both edges and invokes Cadet processing after modifier lookup | `l/usim/x11.c`, 10,174 bytes, SHA-256 `05f1f3ed15214ff454da6b0be83a557153fe6baa815a38b112c2887de8a11794`, lines 92–200 | `S303-X11` |
| X11 emits all-up only when no non-modifier remains after modifier removal | same `x11.c`, lines 95–150 | `S303-X11` |
| Cadet all-up low bits and left/right modifier scans | `l/usim/cadet.c`, 6,896 bytes, SHA-256 `e8974b1bbee8f30a4d55ea76bff8e9b519a02d32056997bf9c5089f2b217860b`, lines 23–74 | `S303-CADET` |
| ordinary up/down wire form and the historical ten-entry downstream queue | `l/usim/kbd.c`, 11,245 bytes, SHA-256 `718bb78231dc40586073dd659c0c46950dcbcf5ad226b1d6dadf2297b8413d9e`, lines 17–90 | `S303-X11` |
| System 46 conversion and table | `src/lmio/kbd.123`, 20,599 bytes, SHA-256 `66045877c6cfcda78f6be28c3df1121c1fc1424133bae7b018c613ab3a4fa6e8`, lines 368–556 | `S46-KBD` |
| SDL3 collision and zero Repeat | `l/usim/sdl3-keyboard-cadet-scancodes.defs`, 2,333 bytes, SHA-256 `913fa9ef9452f6b9bc32e3ac7f7b911680839258c0be9ac75fb770890173a149`, lines 14–119 | `ALT-SDL3` |
| SDL3 all-up scan and 24-bit NKB fields | `l/usim/sdl3-keyboard.c`, 16,891 bytes, SHA-256 `4d72d35ed04656e2dadf7224c221cc246b4d6c2070ca7b25f490d847d87287c7`, lines 414–599 | `ALT-SDL3` |

The historical `kbd.c` downstream queue is evidence for consumer pressure, not
the M8 host queue's capacity or transaction policy. The latter is a selected
bounded handoff seam (`DEC-M8`/`INF-M8`).

## Architecture and ownership

```text
DOM key edge or onscreen action ──> host-originated v6 operation ──> worker C-M8 controller
                                                                      │
                                                                      ├─ bounded u16 FIFO
                                                                      └─ canonical CDRM8KB1 state

CADR core / ABI / generic scheduler  <── no C-M8 Phase 1 call path
```

- The browser host preserves physical identity as `code`, carries DOM's repeat
  flag, and submits only the dedicated v6 operations. Its onscreen view may
  use the same operation callback. It MUST NOT infer worker held state. Its
  only retained ownership is a delivery obligation for a pointer down whose
  matching up has not yet been accepted or definitively reconciled by the
  exact canonical `keyboard-up`/`not-held` response.
- The **worker** owns C-M8 held state, queue capacity, focus-loss recovery,
  canonical state, and every accepted unsigned 16-bit word. The controller
  owns no CADR core memory and does not invoke generic scheduler ingress.
- A later worker integration owns delivery timing, core calls, and failure after
  it drains a word. C-M8 does not promise rollback once another layer accepts a
  drained word.

## Complete physical-input inventory

The normative inventory is
[`CADR_M8_PHYSICAL_KEYS`](../../cadr-web/wasm/cadr-m8-keyboard.mjs): 100
immutable descriptors, each with a unique `KeyboardEvent.code`, physical ID,
label, row, 7-bit Cadet scan code, and (when applicable) semantic modifier bit.
`CADR_M8_ONSCREEN_ROWS` partitions that exact inventory into rows of
`12, 21, 21, 18, 19, 9`; the onscreen renderer creates one button per
descriptor. The test enumerates all 100 descriptors, so the executable table
rather than a manually abbreviated prose table is normative.

There are 82 ordinary/function keys and these 18 physical modifiers:

| Semantic bit | Physical descriptors | Scan codes (octal) |
| --- | --- | --- |
| Shift `0` | left, right | `024`, `025` |
| Greek `1` | left, right | `044`, `035` |
| Top `2` | left, right | `104`, `155` |
| Caps Lock `3` | one | `125` |
| Control `4` | left, right | `020`, `026` |
| Meta `5` | left, right | `045`, `165` |
| Super `6` | left, right | `005`, `065` |
| Hyper `7` | left, right | `145`, `175` |
| Alt Lock `8` | one | `015` |
| Mode Lock `9` | one | `003` |
| Repeat `10` | one | `115` |

The browser selects by `code`, never by a localized character value. Thus the
host’s layout-dependent character production is outside C-M8; an unmapped code
is rejected without changing held state or queue. The actual physical Repeat
descriptor is a normal mapped down/up source even while repeated browser
keydown notifications are suppressed. There are no C-M8 application command
bindings, prefixes, pointer translators, menus, numeric argument rules, or
Help bindings: this is below the CADR application binding layer.

### Selected map differences

| Key | Selected C-M8 source-profile value | SDL3 alternate source value | Decision |
| --- | ---: | ---: | --- |
| Macro | `0100` | `0100` | same |
| Call | `0107` | `0100` | retain System 46 distinction; do not inherit collision |
| Repeat | `0115` | `0000` | retain System 46 distinction; do not inherit zero |
| wire container | 16-bit word | 24-bit NKB header plus payload | selected profile is 16-bit only |

The legacy System 46 source recognizes the same selected Macro, Call, and Repeat
rows in its new-keyboard table. The SDL3 file is a maintained-source defect
witness, not a reason to rewrite System 46 or the selected X11 input profile.

## State model and invariants

The worker-owned `CadrM8KeyboardController` state is:

| Field | Meaning | Constraint |
| --- | --- | --- |
| `held` | Set of physical descriptor IDs currently accepted down | At most one instance of each of the 100 IDs |
| `queue` | FIFO of accepted unsigned 16-bit output words | Length is at most selected `queueCapacity` |
| `queueCapacity` | Host handoff bound | Unsigned 16-bit range `1..65535`; default 64 |
| semantic mask | OR of modifier bits for `held` | Exact 11-bit result; left/right duplicates collapse |

Invariants:

1. Every map descriptor has a unique physical `id` and DOM `code`; all scan
   codes fit seven bits. The map has exactly 100 descriptors, 82 ordinary and
   18 modifiers.
2. A duplicate down, DOM repeat, unknown code, unheld up, invalid field, or
   full queue MUST leave state unchanged.
3. An accepted down queues its seven-bit scan code. A key release first removes
   its descriptor from a staged held set. If an ordinary key remains, it queues
   `0x0100 | scancode`; otherwise it queues `0x8000 | semantic-mask(staged-held)`.
4. The 11-bit semantic mask orders bits Shift, Greek, Top, Caps Lock, Control,
   Meta, Super, Hyper, Alt Lock, Mode Lock, Repeat from bit 0 through bit 10.
   Its high five bits MUST be zero.
5. Focus loss first reserves one queue slot. Only then it clears every held
   descriptor and appends exactly one `0x8000`; a failed reservation preserves
   both held state and queue.
6. An onscreen pointer release remains host-owned until the worker confirms its
   `keyboard-up`. Acceptance or the exact canonical rejected `keyboard-up`
   response with `reason: "not-held"` proves convergence. Queue-full, another
   rejection, an asynchronous pending result, an unknown transport result, or a
   raw controller subresult MUST NOT erase that ownership. A known rejected
   down is the only down path that proves no corresponding release is owed.

## Normative controller transitions

### Host down edge

Preconditions: `code` names a descriptor; `repeat` is boolean. `repeat: true`
is not a Cadet Repeat-key edge.

```text
if no descriptor: reject unmapped
if repeat: reject dom-repeat
if descriptor already held: reject already-held
if no free FIFO slot: reject queue-full
add descriptor to held
append descriptor.scancode
return accepted down and that u16 word
```

### Host up edge

```text
if no descriptor: reject unmapped
if descriptor is not held: reject not-held
if no free FIFO slot: reject queue-full
staged-held := held minus descriptor
if staged-held contains an ordinary descriptor:
    word := 0x0100 OR descriptor.scancode
else:
    word := 0x8000 OR OR(modifier bit of every staged-held descriptor)
commit staged-held and append word
return accepted up or all-up and that u16 word
```

The decision is made after removing the released key. It intentionally keeps
physical modifiers held until the all-up word reports their semantic state,
matching the source-visible X11 all-up predicate. This contract uses a
controller-owned held set instead of X11 global keymap queries (`DEC-M8`), so it
does not claim identical behavior across unrelated browser focus domains.

### Focus loss and draining

`focusLost()` has no conditional “nothing held” shortcut. After successful
capacity reservation, it appends exactly one zero-modifier all-up word and
clears the held set. `drain(n)` removes at most `n` FIFO words in order; it
does not contact the core. A future worker bridge MUST treat failure after
drain as an integration failure, not ask M8 to infer guest rollback.

### Onscreen release ownership and retry

The onscreen view retains one ownership record from pointer down until a known
rejected down, a confirmed accepted up, or a definitive canonical
`keyboard-up` response whose nested result is `accepted: false` with
`reason: "not-held"`. That last response proves the worker already has no held
key after atomic focus recovery or reconciliation of an unknown down transport
outcome. The response MUST have the complete M8 canonical envelope, including
protocol version, valid request ID, `keyboard-up` operation, numeric invalid-
argument status, `ok: false`, and matching top-level and nested `not-held`
reasons. A raw subresult, queue-full, another rejection, or an unknown result is
not equivalent.

Pointer up, cancel, leave, and dispose mark release requested before attempting
`keyboard-up`. A synchronous queue-full result leaves the record pending. If
down or up returns a promise, release waits for the down result and retains
ownership until the asynchronous up result proves acceptance or the exact
converged-not-held condition. A rejected promise or an unrecognized result is
unknown, not proof of release.

`pendingReleaseCodes()` returns the deterministic pending set.
`retryPendingReleases()` retries every requested release and resolves after all
current attempts settle. `dispose()` removes the host view, marks every owned
key for release, retries immediately, and returns a promise for those attempts;
it does not discard an unaccepted ownership record. The integration MUST retry
after making worker queue capacity available, or submit the separately atomic
`keyboard-focus-lost` operation.

## Canonical state representation

`CDRM8KB1` is an `INF-M8` host-state record, not a historical CADR image or
keyboard-device layout. Multi-byte fields are little-endian. Its parser MUST
reject a bad magic/schema/key count, zero capacity, queue count beyond capacity,
length mismatch, an unknown held descriptor, duplicate held code in input
object form, or nonzero unused bits in the final held bitset byte.

| Offset | Width | Field | Rule |
| ---: | ---: | --- | --- |
| 0 | 8 | magic | ASCII `CDRM8KB1` |
| 8 | 2 | schema | `1` |
| 10 | 2 | physical key count | exactly `100` |
| 12 | 2 | queue capacity | `1..65535` |
| 14 | 2 | queued word count | no larger than capacity |
| 16 | 13 | held bitset | descriptor-index order; only bits 0–99 legal |
| 29 | `2*n` | FIFO words | `n` canonical little-endian u16 words |

Held keys serialize in descriptor-index order regardless of down order. The FIFO
retains queue order. Re-parsing and reserializing valid bytes MUST reproduce the
same bytes.

## Protocol v6 host-only inventory

`CadrM8KeyboardProtocolSubhandler` is a testable M8 branch of the future v6
worker endpoint, not a complete worker and not a browser-main-thread state
owner. The outer worker remains solely responsible for request-ID sequencing,
lifecycle, and non-M8 dispatch. A well-formed host-originated request contains
protocol version `6`, a positive u32 ID, and one of the operations below.
Each operation accepts only the fields listed below plus `version`, `id`, and
`op`; extra fields are rejected before controller mutation.

Handled requests use the canonical worker response core:
`type: "cadr-response"`, version, ID, operation, unsigned numeric `status`, and
boolean `ok`. Status `0` is success, `2` invalid argument, and `9` queue
capacity not ready. The sub-handler adds `result` or `reason` but does not
invent a separate M8 response envelope. It returns `null` for requests owned by
the outer worker.

| Operation | Inputs | Result | Failure |
| --- | --- | --- | --- |
| `keyboard-down` | `code`, optional boolean `repeat` | controller down result and one word on acceptance | invalid input, mapped-state, or capacity rejection |
| `keyboard-up` | `code` | controller up result and one word on acceptance | invalid input, held-state, or capacity rejection |
| `keyboard-focus-lost` | none | atomic final-all-up result | queue-full leaves state unchanged |
| `keyboard-drain` | optional nonnegative integer maximum | ordered host words | invalid maximum rejected |
| `keyboard-state` | none | immutable controller snapshot | none |

For `scheduler-events`, the sub-handler inspects only the keyboard boundary. A
batch containing any event of generic kind `3` is rejected as a whole with
status `2` and `v6-keyboard-is-host-only`. Batches containing only sequence
break kind `1` and/or clock kind `2` return `null` unchanged for the existing
generic scheduler handler. Malformed and unknown-kind batches also delegate so
that existing validation remains authoritative. The legacy singular
`scheduler-keyboard-event` name is always rejected. The module imports no core
or adapter surface. This is an exact Phase 1 boundary; it does not change an
ABI function, scheduler record, or the existing worker’s request tree.

## Failure and recovery behavior

- Map and event validation occur before a queue or held-state mutation.
- Capacity failure is a retryable host result, not a dropped historical key.
- An onscreen up that receives queue-full remains pending. Removing its
  ownership before accepted delivery is forbidden; disposal is another retry
  boundary, not permission to forget it.
- After an accepted atomic `keyboard-focus-lost`, a later onscreen up may
  receive canonical `not-held`; that exact response clears stale ownership and
  permits the physical code to be pressed again. The same rule reconciles an
  unknown down transport result when the worker definitively reports it never
  held the code.
- `focusLost` is the only recovery operation. It does not try to synthesize
  per-key ups after focus loss, and it does not preserve modifiers from an
  untrusted browser focus domain.
- The canonical parser makes no best-effort repair. Invalid state bytes cannot
  construct a controller.
- Onscreen pointer cancellation emits only a corresponding host `keyboard-up`
  operation; disposal does the same for its pointer-held descriptors. Global
  focus loss remains a future host integration responsibility, whose worker
  operation is `keyboard-focus-lost`.

## Conformance suite

[`tests/test_cadr_m8_keyboard.mjs`](../../tests/test_cadr_m8_keyboard.mjs)
uses only synthetic DOM-code records and no CADR media.

| ID | Setup and action | Objective pass condition |
| --- | --- | --- |
| `M8-MAP-100` | Iterate all 100 physical rows and independent down/up edges | Each code resolves to its descriptor, exact scan word, then `0x8000`; row partition is `12/21/21/18/19/9` |
| `M8-MASK-2P18` | Enumerate all `2^18` physical modifier subsets | Each collapses exactly to its 11-bit semantic OR mask |
| `M8-ORDINARY-2P11` | For every 82 ordinary target under every `2^11` semantic modifier mask | Last ordinary up emits exactly `0x8000 | mask` |
| `M8-ORDER` | Multi-key rollover and modifier release while ordinary remains held | Intermediate releases use `0x0100 | scancode`; final ordinary release uses all-up |
| `M8-FOCUS-CAPACITY` | Focus loss with queued words, no held keys, and a full queue | Exactly one final `0x8000` after reservation; failed reservation changes nothing |
| `M8-ONSCREEN-RETRY` | Capacity-one KeyQ down, rejected/full up, drain, and dispose; up-before-async-down-settlement; focus clear followed by canonical not-held; unknown down transport followed by canonical not-held | Ownership remains pending through retryable or unknown failure, exact canonical not-held converges stale ownership, each reconciled code can be pressed again, and worker held state ends empty |
| `M8-FAILURE` | Repeats, duplicate down, unmapped code, unheld up, malformed repeat, and capacity-full up | Correct rejection and byte-for-byte unchanged snapshot |
| `M8-CANONICAL` | Permute held insertion order; parse/re-encode and corrupt padding | Stable bytes, canonical order, strict malformed-byte rejection |
| `M8-ALT-SDL3` | Compare Macro/Call/Repeat to the recorded alternate values | Call and Repeat remain distinct from the SDL3 defects |
| `M8-CODE-NOT-KEY` | Submit `{code: "KeyQ", key: "KeyZ"}` | Q scan code wins; direct or computed character-key selection fails |
| `M8-V6-BOUNDARY` | Submit sequence-break, clock, combined kind-1/2, keyboard, and mixed batches | Kind-1/2 batches delegate unchanged; any batch containing kind 3 is rejected; dedicated v6 operations return canonical numeric responses |

## Preserved-system comparison procedure

No runtime comparison has run for C-M8. When wiring starts, run only through a
fresh private System 303-0 Xvfb computer-use session, preserve the required
load-band, disk, `usim`, toolchain, input-action, screenshot, and shutdown
provenance, and keep raw payloads ignored. Compare a small, safe input trace to
the selected X11 executable before treating any outcome as a System 303 claim.

| Obligation | Setup and action | Discriminating result | Claim closed |
| --- | --- | --- | --- |
| `TODO-RUNTIME-M8-1` | Send one mapped ordinary down/up through the future worker bridge in a fresh System 303 X11 session | Guest IOB receives the selected lower-16-bit sequence versus a rejected/misframed word | M8-to-worker framing only |
| `TODO-RUNTIME-M8-2` | Hold each class of modifier, release the last ordinary key, inspect guest input trace | Guest sees the 11-bit selected all-up mask versus another encoding | selected mask survives integration |
| `TODO-RUNTIME-M8-3` | Trigger browser focus loss while keys are held, then resume input | One all-up reaches guest and no stuck modifier remains | host focus wiring, not source provenance |
| `TODO-RUNTIME-M8-4` | Exercise Call and Repeat in the selected System 303 environment | Their guest effects distinguish `0107`/`0115` from the SDL3 defect values | runtime applicability of selected numbers |
| `TODO-RUNTIME-M8-5` | Verify the pinned native X11 `usim` executable/source/artifact identities; in one fresh isolated System 303-0 session establish a zero-held baseline before each case, configure and record the exact X11 keycode/keysym/modifier mapping, inject down/up for each of all 100 C-M8 physical descriptors through XTEST, and capture the ordered pre-IOB lower-16-bit transition trace plus final all-up state; run the same 100 independent cases through C-M8 and compare descriptor by descriptor | Exact match; left/right or special-key divergence; native-unreachable mapping; or different all-up sequence are retained separately rather than averaged | All-100 selected-map applicability to the pinned native X11 path, including explicit exceptions; not browser-worker integration or another `usim` build |

## Known unknowns and nonclaims

- The source inspection does not establish a System 303-0 runtime execution of
  this new browser controller or its DOM code choices.
- Keyboard layout, IME, browser-reserved shortcuts, accessibility remapping,
  multi-window focus order, and USB hardware availability are host-integration
  policy, not historical Cadet behavior.
- The ten-entry `kbd.c` queue does not determine the Phase 1 queue default of
  64, eventual worker drain cadence, or guest backpressure policy.
- C-M8 does not specify cold/warm boot combinations, machine-control shortcuts,
  mouse input, display focus styling, guest input echo, source compatibility,
  binary compatibility, timing identity, or pixel identity.

## Artifact identities and sources

All inspection used public source or tracked reconstruction code; no licensed
Genera or local System 303 media is included.

- System 46 [`kbd.123`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/kbd.123), Git `8e978d7d1704096a63edd4386a3b8326a2e584af`.
- maintained [`x11.c`](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9f&name=x11.c), [`cadet.c`](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9f&name=cadet.c), [`kbd.c`](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9f&name=kbd.c), and [SDL3 key map](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9f&name=sdl3-keyboard-cadet-scancodes.defs), Fossil `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`.
- maintained [LM-3 System 303 check-in](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), Fossil `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
- Selected implementation: [`cadr-m8-keyboard.mjs`](../../cadr-web/wasm/cadr-m8-keyboard.mjs) and [`cadr-m8-onscreen-keyboard.mjs`](../../cadr-web/browser/cadr-m8-onscreen-keyboard.mjs).

Last verified: 2026-07-29.

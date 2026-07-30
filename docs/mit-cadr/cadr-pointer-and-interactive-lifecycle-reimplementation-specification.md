---
type: Reimplementation Specification
title: CADR browser pointer and interactive lifecycle reimplementation specification
description: A release-bounded browser-to-core contract for EDGE32 pointer ingress, focus and capture deactivation, accessible controls, and an ABI 1.8 IOB subset without a claim of CW2 interactive closure.
tags: [mit-cadr, cadr-web, input, pointer, lifecycle, reimplementation]
timestamp: 2026-07-31T00:35:00-04:00
---

# CADR browser pointer and interactive lifecycle reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303/controller-C-M9.1/core-ABI1.8/protocol-v6/PTR-X11-EDGE32-v1` defines the
dedicated-worker browser-host and browser-to-core pointer boundary for the System 303
reconstruction. A conforming implementation produces the selected finite EDGE32
event representation, applies the defined browser coordinate/capture/lifecycle
rules, then emits a typed record to the selected ABI 1.8 IOB subset. The worker now owns
the dedicated v6 pointer controller; the browser channel shares request IDs
with M8 rather than allowing separate adapters to collide.

It claims tested synthetic host semantics and a reconstructed browser/core
delivery boundary. It does not claim that an unmodified `usim` binary consumes
these entries; that `CDRINP1` is historical; or that a `CDRSTATE6` snapshot
block, historical source/API/binary compatibility, Pointer Lock behavior, a saved
DOM state, runnable System 303 application workflow, or the `CW2-INTERACTIVE`
exit gate has been established.
The direct-core tests are not a native input trace or a guest workflow observation.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative.  `EDGE32`, host operations,
and the lifecycle state names below are reconstruction contracts, not assertions
that the selected historical executable used these JavaScript objects.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `S46-SRC` | Public System 46 source pin | A release-bounded public CADR ancestor | This browser representation or a System 303 runtime result |
| `C303-SRC` | Public maintained System 303 Fossil pin | The selected maintained source profile | That its source is a complete input specification |
| `USIM-X11-SRC` | Public X11 `usim` source pin | The selected X11 mapping witness/profile basis | A browser event, DOM capture, or live runtime observation |
| `P1-INF` | Explicit reconstruction inference | The finite host bridge and `CDRINP1` record needed by the selected web profile | A historical implementation expression |
| `P1-CORE` | Tracked ABI 1.8 core/IOB implementation and direct C conformance test | Exact record validation, completed-boundary delivery, mouse word packing, readiness behavior, and post-delivery witness | Native `usim` equivalence or a preserved-machine behavior claim |
| `P1-TEST` | Synthetic Node, worker, and direct-core conformance tests | The exact implemented host behavior, dedicated-worker dispatch, core delivery, and shared browser request ordering | Preserved-machine behavior |
| `TODO-RUNTIME` | Unperformed harness oracle | Nothing yet | A claim that the branch has been exercised |

`USIM-X11-SRC` controls the chosen three-button mapping where this contract needs
one. Browser mechanics and `CDRINP1` serialization are reconstruction choices;
the direct core behavior is `P1-CORE`.
If a preserved runtime differs, the result becomes a separate selectable profile;
it is not silently folded into this one.

## Compatibility profile and level

| Profile | Exact target | Compatibility level | Reserved |
| --- | --- | --- | --- |
| `CADR-WEB-303/controller-C-M9.1/core-ABI1.8/protocol-v6/PTR-X11-EDGE32-v1` | C-M9 controller version 1 over combined core ABI 1.8; System 303-oriented browser host, X11 three-button profile, 768×963 logical display | L1 host semantics plus a tested reconstructed IOB boundary | historical API, native runtime, visual/timing identity, snapshot compatibility, CW2 |

The profile has no fallback SDL mapping.  The selected mapping is tail/middle/head
bit `0/1/2`, X11 button `1/2/3`, and DOM `PointerEvent.button` `0/1/2`.

## Evidence ledger

| Contract | Source witness | Runtime witness | Status |
| --- | --- | --- | --- |
| X11 event surface | [`x11.c` lines 22–26](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=x11.c&ln=22-26) and [244–263](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=x11.c&ln=244-263), `USIM-X11-SRC` | None in this phase | selects motion/press/release, dispatches x/y/button, and performs a pending X warp |
| Mouse state and mapping | [`mouse.c` lines 13–69](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=mouse.c&ln=13-69), `USIM-X11-SRC` | None in this phase | names tail/middle/head, maps X buttons 1/2/3, and requests warp on transition to cursor state `Son` |
| IOB mouse words/readiness | [`iob.c` lines 149–171](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=iob.c&ln=149-171) and [201–210](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=iob.c&ln=201-210), `USIM-X11-SRC` | None in this phase | source-visible IOB packing, readiness, vector, and read-clearing behavior; not a browser mapping or runtime result |
| Profile selection | `C303-SRC`, exact `USIM-X11-SRC` witnesses above, `S46-SRC` pins below | None in this phase | selected evidence boundary |
| EDGE32, queue, coalescing, lifecycle, transforms, controls | `P1-INF` | `P1-TEST` only | normative reconstruction |
| `CDRINP1` / ABI 1.8 IOB subset | `P1-INF`, selected `iob.c` source witness | `P1-CORE` only | reconstructed delivery, not native equivalence |
| `CDRSTATE6` block | `P1-INF` | None | proposed future contract; not serialized by ABI 1.8 |
| Listener/editor/window workflow | None | `TODO-RUNTIME-CW2-01` | open |

## Architecture and ownership

```text
DOM PointerEvent / accessible control
        -> M9 adapter: exact layout transform, focus, capture, rebase
        -> shared browser v6 channel and worker M9 controller
        -> EDGE32 queue, buttons, generations, emergency tail
        -> exact CDRINP1 at a completed core boundary
        -> ABI 1.8 IOB mouse state; future CDRSTATE6 remains absent
```

The browser owns DOM focus, capture, layout epoch, pointer identity, physical
coordinates, the temporary logical rebase, separate physical and accessibility
source-held masks, and their aggregate nonserialized worker-accepted button mask.
The aggregate bit is the union of its two source bits: the first source acquisition
emits the guest down and the final source release emits the guest up.  DOM capture
depends only on the physical mask.  Production submit mode updates these mirrors
only after a positive worker response; rejected first-down submission rolls back
its provisional DOM capture. Those host details are never serialized. The ABI 1.8
core owns the selected legacy IOB input state. A future scheduler kind is `4`, but generic
`scheduler-events` rejects both keyboard kind `3` and pointer kind `4`; only
the named dedicated subhandlers may emit `CDRINP1` records.

## Semantic data model

| Entity | Fields | Invariants |
| --- | --- | --- |
| Logical point | `x`, `y` | `0 <= x < 768`, `0 <= y < 963` |
| Guest button state | `buttonsAfter`, aggregate held-order stack | 3-bit union of physical and accessibility source masks; one guest down at first source acquisition and one guest up at final source release |
| Physical capture state | physical-held mask, capture-owner pointer ID | capture exists exactly while the physical mask is nonzero; accessibility alone never acquires or preserves capture |
| Ingress entry | `kind`, EDGE32 or all-up value, tick, generation, ingress ordinal | generation must equal the current host epoch on acceptance |
| Queue | 64 entries | ordinary input is at most 60; four entries remain for three pointer ups and M8 all-up |
| Transform | content origin, letterbox origin, integer scale, epoch | unrotated exact `768*S` by `963*S`; stale/invalid transforms accept no input |
| Rebase | target, physical logical basis, generation | local only; discarded on epoch change; never causes an OS warp |

An EDGE32 word is exactly:

| Bits | Field | Meaning |
| --- | --- | --- |
| `0..9` | `x` | logical x coordinate |
| `10..19` | `y` | logical y coordinate |
| `20..22` | `buttonsAfter` | button mask after the event |
| `23..25` | `changedMask` | zero for motion, otherwise one-hot changed button bit |
| `26..27` | `cause` | `physical=0`, `capture-loss=1`, `lifecycle=2`, `accessibility=3` |
| `28..31` | reserved | MUST be zero |

Motion has `changedMask=0` and the current `buttonsAfter`.  An edge has a one-hot
`changedMask`, and `buttonsAfter XOR changedMask` is the immediately preceding
button mask.  Duplicate down, unheld up, unmapped button, reserved bits, invalid
coordinate, or stale generation is rejected without a partial button mutation.

### ABI 1.8 delivery and selected IOB subset

Each accepted keyboard or pointer entry is delivered in a little-endian,
exactly 40-byte `CDRINP1` record: magic `CDRINP1` plus zero byte; schema `1`;
kind `1` keyboard or `2` EDGE32 pointer; zero flags; exact machine generation;
strictly-next shared ingress ordinal; payload; and zero reserved word. The core
accepts it only while the machine is `RUNNING` at a completed `BOUNDARY_READY`
phase. It validates all of those fields before dispatch and advances its input
sequence/ordinal only after the target IOB operation succeeds.

For an accepted EDGE32 record, the ABI 1.8 subset writes its reconstruction
coordinate `x` to IOB address `0764106`, and reconstruction `y` plus
tail/middle/head after-state bits to `0764104`. The browser has no raw
mouse-encoder source, so it supplies no raw-encoder transition behavior.
Mouse Y read clears CSR mouse-ready bit 4; mouse X read does not. Delivery sets
bit 4 and unconditionally requests Unibus vector `0264`, matching the selected
X11 `mouse.c`. The maintained SDL3 route through `iob_set_mouse_ready` instead
gates that request on CSR mouse-interrupt-enable bit 1; that is a classified
alternate-source difference, not silently averaged behavior. The direct core
test deliberately clears CSR bit 1 while enabling the Unibus receiver and
observes pending vector `0264`. The addresses, switch packing, readiness, and vector are selected from
the pinned `iob.c` witness; direct EDGE32-coordinate packing is an explicit
reconstruction inference, not a claim that browser EDGE32 reproduces native
encoder timing, raw bits, or native interrupt ordering.

`CDRIOB91` is a 64-byte, read-only post-delivery observation: magic/schema/size,
CSR, keyboard scancode, mouse X/Y words, input sequence, keyboard FIFO count,
shared ordinal, generation, and lifecycle. It helps test browser/core behavior
but cannot replace the separate native pre-IOB witness. ABI 1.8 M9 input state
is not in the M5 snapshot wire layout; v6 snapshot operations return `NOT_READY`.

For the direct all-100 campaign's final shared-deactivation probe, the producer
is specifically `KeyboardEvent.code = KeyQ` (the frozen M8 descriptor derives
scancode `0x52`) followed by tail down at EDGE32 `(60,70)`, then capture-loss
neutralization at that retained point. Its down and release payloads are derived
from the selected key descriptor and `encodeCadrM9Edge32`, including each one-hot
changed mask and the capture-loss cause; they are not duplicated numeric fixtures.
The receipt verifier derives the four resulting `CDRINP1` records and, after each
one, compares every `CDRIOB91` field. The final `input-state` must exactly equal
the state after the final all-up delivery. `P1-TEST` establishes this reconstructed
worker/core transition only; it does not establish historical device timing.

## Complete Phase 1 input and control inventory

M9 owns no CADR application keyboard table, prefix key, numeric argument, menu
accelerator, presentation translator, CLIM binding, or Dynamic Windows command
binding.  Those remain System 303/TV behavior outside this host bridge.  M8 owns
keyboard normalization separately.  M9's complete local gesture/control surface is:

| Context | Gesture/control | Exact effect | Fallthrough/unbound behavior |
| --- | --- | --- | --- |
| Valid frame, uncaptured | DOM mouse down `0/1/2` inside | focus, capture, then matching physical EDGE32 down | other DOM button: reject; outside: no event |
| Valid frame | DOM mouse move inside | current-button EDGE32 motion | outside: no motion, even while captured |
| Captured frame | DOM mouse up `0/1/2` | matching physical EDGE32 up; outside uses last in-bounds point | other/unheld: reject |
| Captured frame | `lostpointercapture` | direct mode atomically deactivates; submit mode atomically commits remote neutralization and remote generation advance, then adopts that exact generation locally, enters `SUSPENDED/PAUSED`, and invalidates the transform | rejection or generation disagreement: absorbing `TERMINAL/FAILED` |
| Host state | blur, focus-out-group, hidden, manual pause, invalid layout | idempotent lifecycle deactivation using `lifecycle` cause | repeated trigger: no second tail |
| Future cursor input | cursor-state `3`, x/y | generation-tagged clamped logical rebase | no Pointer Lock or OS warp; other cursor state: reject |
| Accessible control | Tail/Middle/Head toggle | acquire/release the accessibility source bit; emit the matching `accessibility` edge only on aggregate zero-to-one/one-to-zero transition | unknown name: reject; never owns DOM capture |
| Accessible control | Up/Left/Right/Down | one logical-pixel motion, clamped to EDGE32 | diagonal/zero/more-than-one vector: reject |
| Accessible control | Release All | same atomic reverse mouse release plus M8 all-up tail; clear both source masks and physical capture only after acceptance | any rejection or exception enters absorbing `TERMINAL/FAILED` |
| Accessible control | Focus Guest | focus/activate without guest click/motion | does not acquire capture |

No local modifier, chord inference, double-click, wheel, touch, pen, browser key,
or pointer-lock operation exists in this profile.  DOM physical ingress accepts
only `pointerType="mouse"` with `isPrimary=true`; while captured, only the exact
capture-owner `pointerId` may move, release, or report capture loss.  Browser focus
is acquired before the first intended edge, so the edge remains guest input rather
than a consumed focus click.

## Coordinate and capture contract

For a transform with integer scale `S >= 1`, use exactly:

```text
px := clientX - contentLeft - letterboxLeft
py := clientY - contentTop  - letterboxTop
inside := 0 <= px < 768*S and 0 <= py < 963*S
if inside: x := floor(px/S); y := floor(py/S)
otherwise: emit nothing (except an up may use the saved last in-bounds x/y)
```

No `devicePixelRatio`, CSS rotation, rounding-to-nearest, or clamp of an ordinary
outside point is permitted.  Capture is acquired only while at least one mapped
physical button is held.  It is released after the final physical up even if an
accessibility source still owns an aggregate guest bit.  Conversely, a physical
down acquires capture even when the same guest bit was already acquired through
accessibility.  A stale transform/epoch disables input rather than mapping with
guessed geometry.

The first down transaction is ordered: validate inside/mapped button; focus guest;
activate when idle/neutral; call DOM capture; append the down edge; then mark
captured.  If focus/capture/down fails, no accepted guest edge results and any
temporary DOM capture is released.  An asynchronous first-down fence covers both
focus and worker acceptance, so later motion/up/capture-loss cannot overtake it.
A later motion cannot cross an edge, keyboard, clock, lifecycle, warp, tick, or
generation barrier by coalescing.

## Queue, ordering, and pressure

All accepted entries carry a shared ingress ordinal.  Adjacent motion entries with
the same tick and generation coalesce by retaining the first ordinal and replacing
only x/y/current button value.  Each entry also records a monotonic host barrier
token.  Any keyboard entry, edge, clock, lifecycle tail, warp request, tick
difference, or generation difference advances that token and is a barrier.  Thus
the future bridge orders same-tick input as clock first, then keyboard/pointer by
their shared ingress ordinal, then sequence break.

The queue is 64 entries.  Ordinary motion/edges stop at 60.  At pressure, an
adjacent eligible motion coalesces; otherwise the operation returns `pause-stall`
without mutation.  Deactivation first proves room for all remaining held pointer
buttons in reverse physical-down order plus exactly one typed M8 all-up word
`0x8000`; it then commits every release and all-up, or commits none and fail-stops.
There is no partial neutralization and no guest instruction boundary between its
tail and pause.

## Interactive lifecycle

Browser state is one of `DISABLED`, `IDLE`, `ACTIVE`, `CAPTURED`, `SUSPENDED`, or
`TERMINAL`.  Worker state is independently one of `NEUTRAL`, `ACTIVE`,
`DEACTIVATING`, `PAUSED`, `FAILED`, or `STOPPED`.

```text
DISABLED + visible valid layout -> IDLE / NEUTRAL
IDLE + visible valid layout focused -> ACTIVE / ACTIVE
ACTIVE + first accepted physical down -> CAPTURED / ACTIVE
CAPTURED + final accepted physical up -> ACTIVE / ACTIVE
ACTIVE or CAPTURED + deactivation trigger
  -> DEACTIVATING -> reverse mouse ups, M8 all-up, epoch++
  -> SUSPENDED / PAUSED
SUSPENDED / PAUSED + visible valid layout focus neutral-ack -> ACTIVE / ACTIVE
any active state + worker crash -> TERMINAL / FAILED
any nonterminal state + stop -> TERMINAL / STOPPED
```

`blur`, group focus-out, visibility hidden, lost capture, manual pause, and layout
invalidation share the same idempotent deactivation transaction.  Lost capture
uses cause `capture-loss`; all other listed triggers use `lifecycle`.  A repeated
trigger while suspended/paused is a no-op.  The old generation tags its release
tail; incrementing epoch makes late DOM events and old rebase requests stale.
For a submitted lost-capture operation, local input is fenced while the remote
neutralization is pending.  The remote transaction preflights generation exhaustion,
commits the complete old-generation release/all-up tail, advances the remote
controller, and returns both `priorGeneration` and committed `nextGeneration`.
Only that accepted response permits the local lifecycle to validate and adopt the
exact same next generation, invalidate the transform, and commit
`SUSPENDED/PAUSED`.  A missing, nonconsecutive, mismatched, negative, exceptional,
or otherwise locally unbridgeable result fail-stops instead.  After the remote tail
is drained and neutralization acknowledged, resume plus a new transform at that
generation must accept new ingress without a stale-generation split.
`enable` is legal only from `DISABLED/NEUTRAL`; it cannot rewrite an active,
paused, failed, or stopped lifecycle.  Invalidating an enabled layout routes
through deactivation rather than directly rewriting active state.

Resume requires visible frame, valid current layout, focus, zero held buttons,
drained neutral queues, and explicit future bridge acknowledgment.  Reset is legal
only while paused: a future core reset and M7 full refresh must both succeed, host
capture/rebase/queues are then cleared, and the result remains paused.  Failure in
that sequence is fail-stop, not an asserted reset.  An exception or negative result
from neutralization is likewise fail-stop.  `TERMINAL/FAILED` is absorbing:
subsequent enable/layout/stop/crash calls cannot relabel it as stopped.  Stop/crash
discard host state and MUST NOT append fictitious guest ups after terminal
transition.

Release All uses the same failure rule even though successful Release All remains
an active accessibility operation rather than a pause trigger.  After any direct or
submitted rejection, both adapter and lifecycle reject every later input as
terminal; draining an old queue cannot restore usability.

The only reload/close warning predicate is exactly M10 private-overlay state
`DIRTY`; a paused, failed, stopped, volatile, or unknown state is not called saved
or dirty by this contract.

## Failure, abort, and recovery

Malformed EDGE32 or ingress fields, invalid mapping, duplicate down, unheld up,
stale generation or ordinal, and an outside motion leave cursor/button/queue state
and next ingress ordinal unchanged.  Parsing, cause/coordinate validation, semantic
button validation, capacity preflight, and ordinal acceptance precede commit.  A
pressure rejection also leaves it unchanged, except that the host records that it
must pause or stall; it does not discard a held button to make room.  First-down
failure releases any temporary DOM capture and emits no edge.

Neutralization is the one multi-entry transaction.  Its preflight has a complete
tail count before it mutates held order or queue.  Failure is `FAILED/TERMINAL`,
with recovery requiring an explicit reset/reload policy; it is not acceptable to
continue as though only some mouse-ups occurred.  Terminal stop/crash has the
opposite rule: it discards host state and emits no after-the-fact all-up event.

Restore and reset are recovery boundaries, not successful persistence claims.
They discard DOM details, advance host epoch, retain paused state, and demand a new
layout/focus/neutral acknowledgment; restore additionally demands its fresh warp
handshake.  M10 alone determines whether a durable-state warning is appropriate.

## Future snapshot/core contract

`CDRSTATE6` is not current ABI.  Its proposed 24-byte little-endian pointer block
is intentionally future-facing:

| Offset | Field |
| --- | --- |
| `0` | legacy y, `u16` |
| `2` | legacy x, `u16` |
| `4` | buttons, `u8` |
| `5` | warp pending, `u8` |
| `6` | reserved `u16`, zero |
| `8` | previous cursor state, `u32` |
| `12` | warp x, `u16` |
| `14` | warp y, `u16` |
| `16` | warp generation, `u32` |
| `20` | reserved `u32`, zero |

Snapshot requires `SUSPENDED/PAUSED`, no held pointer bits, drained neutral queue,
and no pending rebase.  Restore creates fresh host epochs, retains no DOM identity
or transform, and requires a new warp handshake before resume.  The future block
does not serialize browser focus, capture, physical pointer ID, layout geometry,
or host logical rebase.

## Reference semantic protocol inventory

| Operation | Inputs | Effect | Failure |
| --- | --- | --- | --- |
| `pointer-motion` | inside x/y, tick, generation | EDGE32 motion or eligible coalesce | stale/outside/pressure: no mutation |
| `pointer-down` | mapped DOM button, mandatory x and y, tick, generation | matching button edge, held-order push | missing coordinate/duplicate/unmapped/pressure: no mutation |
| `pointer-up` | mapped DOM button, either both x/y or neither | matching button edge, held-order removal; omission uses the controller cursor | one coordinate only/unheld/unmapped/pressure: no mutation |
| `pointer-neutralize` | cause, tick, current generation | shared worker transaction: atomic LIFO pointer ups then exactly one typed M8 all-up; only after complete core delivery clears M8 held keys; `capture-loss` additionally advances remote generation | insufficient whole tail or generation exhaustion: fail-stop, no partial tail/advance or M8 clear |
| `pointer-warp-request` | cursor-state 3, x/y, generation | clamped generation-tagged logical rebase request | other state/stale: reject |
| `pointer-state`, `pointer-drain` | none / max count | host observation or typed ingress drain | malformed request: reject |

## Exact source-interface and module closure

No package namespace, historical function signature, macro grammar, return values
or multiple values convention, condition/restart, module/load contract, or binary
calling convention is claimed compatible with System 46, System 303, or `usim`.
This is a semantic browser-host protocol, not a source compatibility layer.

| Selected module | Coverage | Missing closure |
| --- | --- | --- |
| `cadr-m9-pointer.mjs` | normative synthetic controller and dedicated v6 branch | historical pointer-device API |
| `cadr-m9-interactive-lifecycle.mjs` | normative host lifecycle and proposed CDRSTATE6 parser | snapshot serializer |
| `cadr-m9-pointer-adapter.mjs` | normative browser transform/capture/rebase seam and shared-ID hook | a System 303 pointer-device callback |
| `cadr-m9-pointer-controls.mjs` | normative accessibility control view | production DOM styling and application integration |
| `cadr-m8-m9-worker-channel.mjs` | shared v6 request IDs, physical-key binding, and pointer event binding | layout/lifecycle acknowledgement from a CADR pointer device |
| `cadr_m9_input.h`, `cadr_core.c`, and `usim-port/iob.c` | ABI 1.8 strict ingress and selected IOB keyboard/mouse delivery | native `usim` timing, raw encoder behavior, or snapshot compatibility |
| `cadr-worker.js` | instantiates and dispatches the M8/M9 v6 subhandlers; rejects generic kinds 3/4; delivers only after core preflight | historical guest input API or snapshot integration |

## Conformance suite

| ID | Scope | Objective pass condition |
| --- | --- | --- |
| `T-M9-EDGE32` | all 768×963 coordinates; masks/causes; malformed mutants | exact decode/encode and reserved/one-hot rejection |
| `T-M9-BUTTONS` | all 3! down × 3! up permutations | every after-mask and changed bit is exact |
| `T-M9-ORDER` | explicit edge/keyboard/clock/lifecycle/warp/tick/generation barrier tokens, stale generation/ordinal, generic v6 scheduler kinds | only legal adjacency coalesces; malformed ingress is mutation-free; kind 3/4 generic ingress rejects |
| `T-M9-PRESSURE` | 60 ordinary entries plus all three buttons | exactly four emergency cells produce LIFO ups and all-up |
| `T-M9-LIFE` | every deactivation trigger, submitted capture-loss accept/reject/mismatched generation, drain/ack/resume/new-transform ingress, duplicate trigger, active re-enable, invalid layout, injected neutralization failure | remote and local generations remain equal across resumed epoch-1 motion, or the bridge absorbing-fail-stops; paused state, invalid old transform, no interposed guest instruction |
| `T-M9-SNAPSHOT` | CDRSTATE6 mutants, reset/restore/terminal/dirty states | proposed-block reserved bytes reject; ABI 1.8 worker snapshot requests reject rather than serialize non-restorable input state |
| `T-M9-TRANSFORM` | all 768×963 transform coordinates and boundary mutants | floor/half-open exact map; stale/outside disable |
| `T-M9-ADAPTER` | direct and production-submit focus/capture/down ordering, rejection rollback, async fencing, pointer-owner filtering, mixed physical/accessibility ownership in both orders, outside move/up, warp rebase | source and aggregate mirrors are exact; capture follows only physical ownership; no first-click loss/overtake, outside or foreign-pointer motion, or OS cursor warp |
| `T-M9-A11Y` | direct and production-submit button toggles, rejected toggle, directions, Release All accept/reject, release/focus/live controls | state updates only after acceptance; Release All rejection remains terminal after queue drain |
| `T-M9-WORKER-CHANNEL` | v6 display-capable worker, M8/M9 interleaving, and DOM binding seams | pointer state is owned by the worker, generic kind 4 remains rejected, and shared request IDs are monotonic |
| `T-M9-IOB` | Direct ABI 1.8 machine receives pointer, keyboard, all-up, stale ordinal, malformed record, and out-of-range coordinate cases | Pointer words/readiness, keyboard FIFO, and ordinal/sequence commit are exact and failure is mutation-free |
| `T-M8-M9-DEACTIVATE` | key→pointer→blur and pointer→key→capture-loss interleavings, exact `KeyQ`/`(60,70)` derived payloads, and a mutant of each post-delivery observation | M8 remains held before delivery commit; the tail contains pointer-up then exactly one all-up; every CDRIOB91 transition and the final state are CDRINP-derived; commit clears both controllers |

The executable tests are [pointer queue and EDGE32 tests](../../tests/test_cadr_m9_pointer.mjs),
[interactive lifecycle tests](../../tests/test_cadr_m9_interactive_lifecycle.mjs), and
[browser adapter/accessibility tests](../../tests/test_cadr_m9_pointer_adapter.mjs).
[`tests/test_cadr_m8_m9_worker.mjs`](../../tests/test_cadr_m8_m9_worker.mjs) and
[`tests/test_cadr_m8_m9_worker_channel.mjs`](../../tests/test_cadr_m8_m9_worker_channel.mjs)
add the actual v6 worker and shared browser-channel seam. The direct
[`test_cadr_m9_input_bridge.c`](../../cadr-web/tests/test_cadr_m9_input_bridge.c)
adds ABI 1.8 IOB delivery coverage; neither test claims a native runtime result.

## Preserved-system comparison procedure and open probes

`TODO-RUNTIME-M9-X11-01`: using the CADR Xvfb computer-use harness, record an
isolated System 303 run from the pinned base/private artifact identity.  Send each
X11 button transition and move at inside/outside edges, capture typed input and
resulting state, and shut down according to the harness policy.  This discriminates
the selected X11 mapping, source-visible chord order, and actual legacy cursor
encoding from this inferred host bridge.

`TODO-RUNTIME-M9-WARP-01`: in the same isolated harness, cause cursor state `3` if
reachable and compare the next physical move with a no-warp control.  It closes only
the profile's rebase/warp behavior; it must record exact source and runtime evidence
and cannot be inferred from a screenshot.

`TODO-RUNTIME-CW2-01`: complete a harmless Listener/editor/window workflow through
both the native and browser machines, retaining equivalent logical input trace,
framebuffer checkpoints, Lisp results, base/private artifact checksums, session,
and clean/forced termination status.  Only this closes `CW2-INTERACTIVE`.

The tracked [`cadr-m8-m9-native-input-oracle.py`](../../scripts/cadr-m8-m9-native-input-oracle.py)
now has a fail-closed `native-capture` entry point. It creates a fresh private
runtime, copies and hashes the five M6 artifacts plus the base disk, records every
native call in 64-byte `CDRM8N1` records before `kbd_event` or `mouse_event`
mutates IOB state, and removes the transient runtime after it copies only reviewed
0600 sidecars into the requested 0700 output directory. The M6 completion halt is
intentionally deferred only until the complete post-idle M8/M9 script is witnessed;
it then halts through the original M6 completion condition. A missing record, an
early exit, a changed private disk, or any non-private path fails the capture.

[`run-cadr-m8-m9-input-conformance.mjs`](../../scripts/run-cadr-m8-m9-input-conformance.mjs)
is the direct-boundary, explicitly non-CW2 campaign entry point. After explicit `--execute`, it uses
a newly allocated ignored 0700 session; materializes one native script covering all
100 selected physical keys (down and up), motion, all three button transitions,
and capture-loss neutralization; runs the strict native capture; then independently
boots the protocol-v6 M9 Wasm machine to the frozen M6 READY contract and sends the
same controller-derived actions through the real worker. It retains `CDRM8N1`,
`CDRINP1`, `CDRIOB91` state receipts, the M6/raw receipts, hashes, private-disk
identity, and worker shutdown record. There is no synthetic/native fallback.

The frozen adapter expands an EDGE32 one-hot changed mask to native
`mouse_event(x, y, selector)`: motion `0`, tail `1`, middle `2`, head `3`; native
input does not receive EDGE32's after-mask directly. Therefore the paired result
records the representations and their shared action schedule, but does not claim
their bytes are equal or native behavioral equivalence. After the source closure
has been prepared and built, run this direct-boundary command once for each selected
Wasm optimization variant. Each invocation forcibly rebuilds **both** M9 Wasm
outputs before it creates the private runtime, then records the candidate/base source
closure, all selected profile/release artifact identities, both output identities, and
the exact worker/module identities in its result manifest. The two recorded output
paths, not merely their byte counts and digests, must equal the staged joined O0/O2
paths. It remains a direct,
explicitly non-X11/non-CW2 path.

The closure is not a hand-maintained list of the immediate M8/M9 files. The
provenance builder recursively follows every literal repository-local ESM import
from the direct runner, worker, M6 replay driver, and exposed M8/M9 browser seams,
then hashes both the sorted file identities and the resolved import graph. In
particular, the recorded closure contains the worker's M5 batch and display
renderer, M11 audio and M12 debugger protocol subhandlers, and the M6 driver's M4
block service. A literal non-local import is rejected rather than treated as an
unrecorded implementation dependency; `node:` imports remain a separately recorded
host-tool/runtime surface. Thus changing a transitive local module changes the join
instead of leaving a stale direct receipt apparently applicable.

Each direct result is an exact current-owner 0700 session with a fixed 0600 sidecar
layout. Before a later consumer accepts it, it verifies the complete source binding
(candidate/base commits and trees, every resolved local module, plus the exact ordered
11-authority direct-runner list and its scoped Git status); the profile source pins;
the frozen release record; the five selected artifacts and native-host input; the
prepared source/build markers and recorded native toolchain; the rendered-private-
config fingerprint; the immutable private-disk start/end identity; and the frozen M6
schedule **and Cadet mapping**. The direct command records one complete join before
the native/browser work and one after it, without rebuilding between them; both must
be identical. Thus a source, prepared closure, or either selected O0/O2 Wasm output
that changes during the run makes the result nonconforming.

The raw M6 validation is the producer contract, not a superficial header check: the
selected meta row, every frozen schedule event, rational guest-boundary clock row and
same-boundary priority, exact nine A/B/C `DEBUG-IR` writes, 67 A/B/C/suffix boundaries,
one retained-C settled row, quiescent state/counter conditions, and all 64 96-byte
`CDRM6I1` idle samples are required. The browser half derives every expected
`CDRIOB91` state from the accepted `CDRINP1` stream, checks all 100 bounded keyboard
consumption transitions, requires the complete pointer-up plus one-all-up
deactivation tail, compares every deactivation `CDRIOB91` transition and final state,
and accepts only the exact post-READY M8/M9 worker-log sequence. The public static
test materializes a complete **synthetic** raw transcript and idle stream from the
tracked release record solely to adversarially exercise this grammar; it does not
open an ignored runtime capture and does not constitute a native observation. The
explicit `--execute` direct campaign still requires the native capture—there is no
synthetic/native fallback in that command.
Host tool identity is recorded by bytes and hash, not by a machine-specific absolute
path.

All receipt locators that the verifier opens are fixed relative, non-traversing paths
confined below the direct session; every live path component, including the prepared
native root and session ancestry, must be non-symlinked. The outer session identifier
must name its directory. Path substitutions, including absolute, `..`, and symlinked-
ancestor forms, are nonconforming. `child_argv` and path-valued child-environment entries in
the native metadata are different: they are capture-time provenance strings (and may
be absolute), are compared as metadata where relevant, and are never re-opened or
treated as locator authority by the join verifier. These checks make an incomplete or
path-substituted result nonconforming; they do not turn a same-user ignored output
directory into a cryptographic evidence store.

```sh
guix shell node -- node scripts/run-cadr-m8-m9-input-conformance.mjs --execute --native-config build/cadr-oracle/m6-run-smoke/usim.ini --prepared build/cadr-oracle/m8-m9-x11-prepared-v4 --variant O0 --wasm cadr-web/build/cadr-web-m9-O0.wasm

guix shell node -- node scripts/run-cadr-m8-m9-input-conformance.mjs --execute --native-config build/cadr-oracle/m6-run-smoke/usim.ini --prepared build/cadr-oracle/m8-m9-x11-prepared-v4 --variant O2 --wasm cadr-web/build/cadr-web-m9-O2.wasm
```

This command was not launched while the M6 benchmark was active. `make -C cadr-web
m8-m9-unit` is the public static preflight only. The campaign cannot replace
`TODO-RUNTIME-M9-X11-01`, `TODO-RUNTIME-M9-WARP-01`, or `TODO-RUNTIME-CW2-01`:
it contains no native X11 observation, screenshot review, Listener/editor/window
workflow, or Lisp-result equivalence claim.

The separate
[`run-cadr-m8-m9-x11-campaign.mjs`](../../scripts/run-cadr-m8-m9-x11-campaign.mjs)
uses a witness-enabled X11 build with the established computer-use harness.
It injects only the descriptors which the selected source maps to an
unmodified keysym present in the captured live Xvfb map. Each applicable key
must produce exactly its down record followed by one all-up record after a
bounded witness-quiescence poll; a source-unmapped browser descriptor is
explicitly not applicable to this native subcampaign and is never fallback
injected. The separately joined worker/core campaign remains the all-100
browser proof. A selected-source keysym present only in a shifted live X column
is separately classified `native-modifier-chord-not-exercised`; it is an open,
non-closing exception rather than “unreachable.” Before the first measured
case, the runner records `xinput --query-state` for the live Virtual Core
keyboard and requires zero held keys. The native run also requires one exact
record for motion and each press and release of all three mouse buttons. This
is deliberately not an all-100 native acceptance claim.
A separate fresh session captures Listener evaluation, `(ED T)` Zmacs entry,
editor input, framebuffer screenshots, and the harness shutdown record. The
entry point is implemented and statically tested but unexecuted. It captures
the live X keycode/keysym and modifier maps, rendered `Mod4 = Super` profile,
and source identities before accepting a disposition. The currently prepared
ignored closure has patch SHA-256
`76244361da1d1306503e6ff81bfa3b4bafe23f15d0e03286ac40406b27bc0c06`,
source-tree SHA-256
`d8499d015cf5edf778adb7519f5e2081c982e14a5841b494cec519475a342fe2`,
and X11 executable SHA-256
`dc86d6cfaee2ef2bb7e19aea0e3e6e7f27045d0844ddc457ac93c0e0f2cb3b6e`
(1,243,768 bytes).
Its build marker also records the exact `pkg-config` executable and version,
the resolved X11 cflags, libs and libdir queries, and the resolved `libX11`
file identity. Each runtime campaign additionally binds the runner, imported
modules, harness, patch, Git revision, and scoped dirty status.

In the selected source, `x11.c` SHA-256
`05f1f3ed15214ff454da6b0be83a557153fe6baa815a38b112c2887de8a11794`
passes `e.xbutton.button` unchanged to `mouse_event`. The selected `mouse.c`
SHA-256
`abb8746fd2b8e63456fd93d3187b4ecb2bbcc4f5e0a9c994058f3b0f7f1cc198`
then toggles tail, middle, or head state for selector `1`, `2`, or `3`.
Consequently the pre-mutation native witness field named `buttons` is a
changed-button selector (`0` motion; `1` tail; `2` middle; `3` head), not the
browser EDGE32 accumulated post-event mask. Press and release deliberately
carry the same selector.
Its exact run command requires the two manifest paths emitted by those successful
direct commands. The legacy single `--browser-manifest` option is rejected: a
self-consistent 208-record receipt cannot stand in for a reciprocal source-closure
join. Before opening X11, the runner recomputes the staged/current closure and
requires each direct receipt to match it byte-for-byte, including candidate/base
commits and trees, complete M8/M9 source set, worker, selected profile/release media,
the prepared direct and X11 witnesses, and both M9 Wasm outputs at their exact joined
paths. O0 and O2 receipts must name distinct outer direct-session IDs, native-session
IDs, portable-worker session IDs, private-disk instance IDs, and result roots. After both native X11
sessions have stopped, the runner recomputes the complete closure and requires it to
equal the pre-launch binding before it writes its campaign receipt; a source, Wasm,
prepared-witness, or static-import drift during the live run is therefore a failure.
All manifest-referenced paths must be relative, non-traversing, contained paths;
absolute or `..` substitutions are rejected.

This reciprocal join is an integrity check under the local account, not a signature
scheme. A user able to rewrite both ignored direct result trees and the working tree
can construct mutually consistent records. A future claim resistant to that actor
requires a separately described trust root such as signed immutable receipts or an
independent capture service; no such trust root is claimed here.

```sh
guix shell node -- node scripts/run-cadr-m8-m9-x11-campaign.mjs --execute --prepared build/cadr-oracle/m8-m9-x11-prepared-v4 --browser-o0-manifest build/cadr-oracle/REPLACE-WITH-O0-DIRECT-CAMPAIGN/manifest.json --browser-o2-manifest build/cadr-oracle/REPLACE-WITH-O2-DIRECT-CAMPAIGN/manifest.json
```

Even a successful native run does not close CW2 until a separate browser run
retains and compares the same logical workflow, framebuffer checkpoints, and
Lisp result.

## Known unknowns and nonclaims

- The selected historical X11 source/runtime's exact pointer queue/chord timing,
  legacy cursor storage, `MOUSE-SEIZE` routing, and warp behavior are not yet
  independently exercised in a named System 303 session.
- `MOUSE-SEIZE` is represented here only as a future guest routing concern; it is
  never authority to request browser Pointer Lock.
- No source-level API/module closure, native pointer import, binary
  compatibility, snapshot compatibility, timing guarantee, or full CADR UI workflow
  has been established.
- The named source pins are intentionally not averaged: System 46 is a historical
  source witness and maintained System 303/`usim` is the selected profile basis.

## Artifact identities and sources

| Role | Identity | Publication boundary |
| --- | --- | --- |
| System 303 source profile | LM-3 Fossil `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | public source evidence; no runtime claim |
| X11 emulator source profile | `usim` Fossil `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` | public source evidence; no binary/runtime claim |
| Selected `x11.c` witness | SHA-256 `05f1f3ed15214ff454da6b0be83a557153fe6baa815a38b112c2887de8a11794` | locally hashed public source copy; event selection/dispatch and warp witness only |
| Selected `mouse.c` witness | SHA-256 `92075bb5a5a45d6b18aad0413628f95c16fb8e73fb42de2b04962a695fff5b65` | locally hashed public source copy; state/button/warp witness only |
| Selected `iob.c` witness | 11,717 bytes, SHA-256 `2b1ffa8c8c0cf146f0ece08ec5e09659db76b97b0866fb48ec01bd7d024fedc9` | locally hashed public source copy; IOB address/packing/readiness witness only |
| System 46 source profile | Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | public source evidence; distinct historical release |
| Browser/core implementation | `cadr-web/wasm/cadr-m9-pointer.mjs`, lifecycle/adapter/control modules, browser channel, worker dispatch, and `cadr-web/core/cadr_m9_input.h` | independently written, tracked source; reconstructed ABI 1.8 IOB boundary, no native equivalence claim |

- MIT CADR System Software, [System 46 source pin](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af), verified as the selected public reference on 2026-07-29.
- Maintained LM-3 System 303 and `usim` Fossil pins listed above are separate selected source profiles. The two `usim` files were hashed from the prepared public-source copy on 2026-07-29; the preparation record asserted the Fossil identity from its pinned manifest but did not live-verify the unavailable local Fossil administrative database. Their exact pointer runtime behavior remains a `TODO-RUNTIME`, not an asserted observation.
- The staged browser deliverable and its future `CW2-INTERACTIVE` gate are defined in the [CADR browser WebAssembly implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md).

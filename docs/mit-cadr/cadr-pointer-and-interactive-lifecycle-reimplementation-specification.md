---
type: Reimplementation Specification
title: CADR browser pointer and interactive lifecycle reimplementation specification
description: A release-bounded, host-side Phase 1 contract for EDGE32 pointer ingress, focus and capture deactivation, and accessible controls without a claim of CW2 interactive closure.
tags: [mit-cadr, cadr-web, input, pointer, lifecycle, reimplementation]
timestamp: 2026-07-29T21:06:55-04:00
---

# CADR browser pointer and interactive lifecycle reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303/ABI1.6/protocol-v6/C-M9-PTR-X11-EDGE32-v1` defines the Phase 1
browser-host pointer boundary for the System 303 reconstruction.  A conforming
implementation produces the selected finite EDGE32 event representation, applies
the defined browser coordinate/capture/lifecycle rules, and leaves a typed queue
for a future core/worker bridge.

It claims a tested semantic contract for synthetic host input only.  It does not
claim that current CADR core ABI 1.5 contains pointer ingress or `CDRSTATE6`, that
an unmodified `usim` binary consumes these entries, historical source/API/binary
compatibility, Pointer Lock behavior, a saved DOM state, a runnable System 303
application workflow, or the `CW2-INTERACTIVE` exit gate.  No licensed or private
runtime was opened for this work.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative.  `EDGE32`, host operations,
and the lifecycle state names below are reconstruction contracts, not assertions
that the selected historical executable used these JavaScript objects.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `S46-SRC` | Public System 46 source pin | A release-bounded public CADR ancestor | This browser representation or a System 303 runtime result |
| `C303-SRC` | Public maintained System 303 Fossil pin | The selected maintained source profile | That its source is a complete input specification |
| `USIM-X11-SRC` | Public X11 `usim` source pin | The selected X11 mapping witness/profile basis | A browser event, DOM capture, or live runtime observation |
| `P1-INF` | Explicit reconstruction inference | The finite host bridge needed by the selected web profile | A historical implementation expression |
| `P1-TEST` | Synthetic conformance tests | The exact implemented Phase 1 behavior | Preserved-machine behavior |
| `TODO-RUNTIME` | Unperformed harness oracle | Nothing yet | A claim that the branch has been exercised |

`USIM-X11-SRC` controls the chosen three-button mapping where this contract needs
one.  Browser mechanics and all serialization proposed for ABI 1.6 are `P1-INF`.
If a preserved runtime differs, the result becomes a separate selectable profile;
it is not silently folded into this one.

## Compatibility profile and level

| Profile | Exact target | Compatibility level | Reserved |
| --- | --- | --- | --- |
| `CADR-WEB-303/ABI1.6/protocol-v6/C-M9-PTR-X11-EDGE32-v1` | System 303-oriented browser host, X11 three-button profile, 768×963 logical display | L1 synthetic host-input semantics | current core ABI, historical API, native runtime, visual/timing identity, CW2 |

The profile has no fallback SDL mapping.  The selected mapping is tail/middle/head
bit `0/1/2`, X11 button `1/2/3`, and DOM `PointerEvent.button` `0/1/2`.

## Evidence ledger

| Contract | Source witness | Runtime witness | Status |
| --- | --- | --- | --- |
| X11 event surface | [`x11.c` lines 22–26](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=x11.c&ln=22-26) and [244–263](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=x11.c&ln=244-263), `USIM-X11-SRC` | None in this phase | selects motion/press/release, dispatches x/y/button, and performs a pending X warp |
| Mouse state and mapping | [`mouse.c` lines 13–69](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=mouse.c&ln=13-69), `USIM-X11-SRC` | None in this phase | names tail/middle/head, maps X buttons 1/2/3, and requests warp on transition to cursor state `Son` |
| Profile selection | `C303-SRC`, exact `USIM-X11-SRC` witnesses above, `S46-SRC` pins below | None in this phase | selected evidence boundary |
| EDGE32, queue, coalescing, lifecycle, transforms, controls | `P1-INF` | `P1-TEST` only | normative reconstruction |
| `CDRSTATE6` block | `P1-INF` | None | proposed future contract |
| Listener/editor/window workflow | None | `TODO-RUNTIME-CW2-01` | open |

## Architecture and ownership

```text
DOM PointerEvent / accessible control
        -> M9 adapter: exact layout transform, focus, capture, rebase
        -> M9 controller: EDGE32 queue, buttons, generations, emergency tail
        -> future dedicated protocol-v6 host subhandler
        -> future complete-boundary core/worker bridge
        -> CADR input/device state and future CDRSTATE6 block
```

The browser owns DOM focus, capture, layout epoch, pointer identity, physical
coordinates, the temporary logical rebase, separate physical and accessibility
source-held masks, and their aggregate nonserialized worker-accepted button mask.
The aggregate bit is the union of its two source bits: the first source acquisition
emits the guest down and the final source release emits the guest up.  DOM capture
depends only on the physical mask.  Production submit mode updates these mirrors
only after a positive worker response; rejected first-down submission rolls back
its provisional DOM capture.  Those host details are never serialized.  The future
core owns legacy cursor/input state.  A future scheduler kind is `4`, but generic
`scheduler-events` rejects both keyboard kind `3` and pointer kind `4`; only
dedicated host-originated subhandlers may accept them.

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
| `pointer-neutralize` | cause, tick, current generation | atomic LIFO pointer ups then typed M8 all-up; `capture-loss` additionally advances remote generation and returns exact prior/next generations | insufficient whole tail or generation exhaustion: fail-stop, no partial tail/advance |
| `pointer-warp-request` | cursor-state 3, x/y, generation | clamped generation-tagged logical rebase request | other state/stale: reject |
| `pointer-state`, `pointer-drain` | none / max count | host observation or typed ingress drain | malformed request: reject |

## Exact source-interface and module closure

No package namespace, historical function signature, macro grammar, return values
or multiple values convention, condition/restart, module/load contract, or binary
calling convention is claimed compatible with System 46, System 303, or `usim`.
This is a semantic browser-host protocol, not a source compatibility layer.

| Selected Phase 1 module | Coverage | Missing closure |
| --- | --- | --- |
| `cadr-m9-pointer.mjs` | normative synthetic controller and dedicated v6 branch | worker dispatch/core kind-4 application |
| `cadr-m9-interactive-lifecycle.mjs` | normative host lifecycle and proposed CDRSTATE6 parser | current ABI field and snapshot serializer |
| `cadr-m9-pointer-adapter.mjs` | normative browser transform/capture/rebase seam | actual browser shell/worker transport |
| `cadr-m9-pointer-controls.mjs` | normative accessibility control view | production DOM styling and application integration |

## Conformance suite

| ID | Scope | Objective pass condition |
| --- | --- | --- |
| `T-M9-EDGE32` | all 768×963 coordinates; masks/causes; malformed mutants | exact decode/encode and reserved/one-hot rejection |
| `T-M9-BUTTONS` | all 3! down × 3! up permutations | every after-mask and changed bit is exact |
| `T-M9-ORDER` | explicit edge/keyboard/clock/lifecycle/warp/tick/generation barrier tokens, stale generation/ordinal, generic v6 scheduler kinds | only legal adjacency coalesces; malformed ingress is mutation-free; kind 3/4 generic ingress rejects |
| `T-M9-PRESSURE` | 60 ordinary entries plus all three buttons | exactly four emergency cells produce LIFO ups and all-up |
| `T-M9-LIFE` | every deactivation trigger, submitted capture-loss accept/reject/mismatched generation, drain/ack/resume/new-transform ingress, duplicate trigger, active re-enable, invalid layout, injected neutralization failure | remote and local generations remain equal across resumed epoch-1 motion, or the bridge absorbing-fail-stops; paused state, invalid old transform, no interposed guest instruction |
| `T-M9-SNAPSHOT` | CDRSTATE6 mutants, reset/restore/terminal/dirty states | reserved bytes reject; host state remains excluded; warning only for M10 `DIRTY` |
| `T-M9-TRANSFORM` | all 768×963 transform coordinates and boundary mutants | floor/half-open exact map; stale/outside disable |
| `T-M9-ADAPTER` | direct and production-submit focus/capture/down ordering, rejection rollback, async fencing, pointer-owner filtering, mixed physical/accessibility ownership in both orders, outside move/up, warp rebase | source and aggregate mirrors are exact; capture follows only physical ownership; no first-click loss/overtake, outside or foreign-pointer motion, or OS cursor warp |
| `T-M9-A11Y` | direct and production-submit button toggles, rejected toggle, directions, Release All accept/reject, release/focus/live controls | state updates only after acceptance; Release All rejection remains terminal after queue drain |

The executable tests are [pointer queue and EDGE32 tests](../../tests/test_cadr_m9_pointer.mjs),
[interactive lifecycle tests](../../tests/test_cadr_m9_interactive_lifecycle.mjs), and
[browser adapter/accessibility tests](../../tests/test_cadr_m9_pointer_adapter.mjs).

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

## Known unknowns and nonclaims

- The selected historical X11 source/runtime's exact pointer queue/chord timing,
  legacy cursor storage, `MOUSE-SEIZE` routing, and warp behavior are not yet
  independently exercised in a named System 303 session.
- `MOUSE-SEIZE` is represented here only as a future guest routing concern; it is
  never authority to request browser Pointer Lock.
- No source-level API/module closure, existing ABI 1.5 pointer import, binary
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
| System 46 source profile | Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | public source evidence; distinct historical release |
| Phase 1 implementation | `cadr-web/wasm/cadr-m9-pointer.mjs`, lifecycle/adapter/control modules | independently written, tracked source |

- MIT CADR System Software, [System 46 source pin](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af), verified as the selected public reference on 2026-07-29.
- Maintained LM-3 System 303 and `usim` Fossil pins listed above are separate selected source profiles. The two `usim` files were hashed from the prepared public-source copy on 2026-07-29; the preparation record asserted the Fossil identity from its pinned manifest but did not live-verify the unavailable local Fossil administrative database. Their exact pointer runtime behavior remains a `TODO-RUNTIME`, not an asserted observation.
- The staged browser deliverable and its future `CW2-INTERACTIVE` gate are defined in the [CADR browser WebAssembly implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md).

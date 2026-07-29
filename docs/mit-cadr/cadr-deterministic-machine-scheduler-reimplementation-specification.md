---
type: Reimplementation Specification
title: CADR-WEB-303 ABI 1.4 deterministic machine scheduler reimplementation specification
description: Release-bounded contract for guest-time event scheduling, the selected CADR I/O-board subset, worker lifecycle controls, and simultaneous disk, clock, keyboard, and sequence-break conformance.
tags: [mit-cadr, lm-3, system-303, scheduler, iob, keyboard, clock, webassembly, reimplementation]
timestamp: 2026-07-29T06:34:00-04:00
---

# CADR-WEB-303 ABI 1.4 deterministic machine scheduler reimplementation specification

## Conclusion, target, and nonclaims

`CADR-WEB-303/ABI1.4/C-M5-SCHED-v1` replaces asynchronous host arrival
timing with an explicit guest-clock-slot event schedule. It specifies the
run/yield lifecycle, a bounded event queue, the System 303 I/O-board subset
needed for clock and raw-keyboard injection, and the exact pre-slot order used
when disk, clock, keyboard, and a synthetic sequence-break request share a due
boundary.

The selected same-boundary order is a deterministic reconstruction policy,
`INF-M5-PRE-SLOT-v1`. It is not presented as a historical CADR hardware
priority or as an order supplied by maintained `usim`: that host receives
wall-clock signals and window-system events asynchronously. Historical guest
service order remains a separate sourced property.

This profile does not provide the complete CADR key vocabulary or host keyboard
map, mouse input, audio, serial, Chaosnet, color display, arbitrary Unibus
devices, historical real-time frequency, a Listener-ready boot, or renderer.
Those belong to later roadmap milestones. A direct sequence-break event exists
only as a conformance stimulus; it is not the keyboard Break key and not a
claim that historical hardware exposed such a host operation.

The subsystem has no user-visible application state. Screenshots would not add
evidence to this headless contract, so the repository screenshot obligation is
not applicable. Canonical scheduler, device, and boundary transcripts are its
runtime evidence.

## Normative language and reconstruction profile

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` constrain an independent
implementation of this selected reconstruction profile. They do not convert an
inferred scheduling choice or new browser protocol into a claim about
historical hardware.

## Reconstruction claims and selected evidence

Compatibility boundary: claims on this page stop at the named ABI1.4
System 303 scheduler, selected pinned-X11 I/O-board subset, protocol-v3 worker,
and injected C-M5 conformance schedule. They do not extend to later display,
complete input, filesystem, networking, or museum-release profiles.

| Code | Kind | Establishes | Does not establish |
| --- | --- | --- | --- |
| `M5-USIM-IOB` | maintained `usim` `iob.c`, `kbd.c`, `usim.c`, and bus interrupt code | I/O addresses, CSR bits, FIFO capacity, vectors, register side effects, 60 Hz host callback effects | deterministic host arrival order |
| `M5-SYS303-INT` | maintained System 303 `ucadr/uc-interrupt.lisp` and page-fault/sequence-break microcode | guest interrupt classification and service paths | worker protocol or browser lifecycle |
| `M5-CORE` | portable ABI1.4 core and tests | selected queue, lifecycle, and I/O-board transitions | independent historical agreement |
| `M5-WORKER` | dedicated-worker protocol v3 tests | serialized browser control, yielding, and version isolation | guest microcode correctness by itself |
| `M5-ORACLE` | patched, explicitly scheduled maintained-`usim` injection run | agreement under the named reconstruction schedule | a naturally occurring native host order |
| `INF-M5` | rules introduced by this specification | deterministic browser-hosting policy | historical fact |

The selected source identities remain:

| Source | Identity |
| --- | --- |
| LM-3 System source | Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` |
| Maintained `usim` | Fossil check-in `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` |
| Public System 46 comparison | Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` |
| Processor profile | `CADR-U303` |
| Scheduler profile | `C-M5-SCHED-v1` |
| Same-boundary schedule | `INF-M5-PRE-SLOT-v1` |

Public System 46 remains comparison evidence rather than the selected runtime
profile. Maintained LM-3 restoration changes and historical System 46 behavior
must not be silently averaged.

## Architecture and state model

```text
version-3 worker control
  -> worker lifecycle + pause/visibility policy
  -> atomic timestamped event batch
      -> state-owned queue ordered by boundary/profile/sequence
          -> preflight complete trace capacity
          -> pre-slot dispatch
              -> accepted M4 completion
              -> TV/clock
              -> raw keyboard/IOB
              -> synthetic sequence break
          -> one portable-core outer slot
  -> CDRSTATE5 + CDRSNAP1 ABI1.4 scheduler chunk
```

The core owns the event queue, generation, insertion sequence, scheduler phase,
and I/O-board state. The worker owns control lifecycle, hidden-tab policy, and
bounded host yielding. The M4 range service retains ownership of staged and
committed volatile media. No host promise, JavaScript object, timer handle,
wall-clock timestamp, pathname, or pointer enters canonical guest state.

## Time and boundary model

The only correctness clock is the monotonically increasing outer
`clock_slots_completed` count. Boundary `S0` precedes the first slot. An event
due at boundary `S` is applied after the complete state for `S` is observable
and before execution of the slot that produces `S+1`.

Host wall time, animation frames, promise resolution, browser timer cadence,
network latency, CPU load, and tab visibility MUST NOT change an event's due
boundary. Host code may decide how quickly to request more work, but not what
guest state results from a fixed input schedule.

One M5 scheduler tick is exactly one completed outer clock slot. M5 scheduling
is enabled only through the ABI1.4/protocol-v3 surface; legacy ABI1.2/1.3 runs
do not advance new scheduler state or change the frozen M3/M4 transcripts.

The guest microsecond clock in this bounded profile advances only by selected
clock events. `INF-M5-USEC-1M-OVER-60-v1` adds 1,000,000 to a rational phase
for each event, advances the u32 microsecond counter by the quotient divided by
60, and retains the remainder modulo 60. It therefore produces a deterministic
sequence of 16,666- and 16,667-microsecond increments without rounded fixed-step
drift. A clock event also increments the 16-bit sixty-cycle counter once. These
counters are compatibility values, not claims of host `gettimeofday` or
crystal parity.

## Lifecycle state machine

The worker owns this control state separately from the core's existing
`COLD`, `POWERED`, `RUNNING`, and terminal/result states:

```text
NEW --cold-power-on--> CORE_RESET --boot--> PAUSED --scheduler-start--> RUNNING
RUNNING --host request--> WAITING_FOR_HOST --accepted completion--> RUNNING
RUNNING|WAITING_FOR_HOST --pause or hide--> PAUSED
RUNNING|PAUSED|WAITING_FOR_HOST --stop or shutdown--> STOPPED
RUNNING|WAITING_FOR_HOST --fatal machine status--> FAILED
```

Artifact validation occurs inside the import and boot operations and has no
separate worker lifecycle state. Single-step is an operation that temporarily
runs the core and returns the worker to `PAUSED`, or to `WAITING_FOR_HOST` if
service is required; there is no separately observable stepping state.
Likewise, reset is an atomic operation while `PAUSED`, and stop is a direct
transition to `STOPPED`, without intermediate lifecycle states. Only one
request transaction may run at a time. Every well-formed, in-order request
consumes one monotonically increasing worker request identifier even when
rejected.

- `scheduler-start` is valid only from `PAUSED`, after a current-tab visibility
  handshake, while visible and while the core reports running.
- `pause` is idempotent in `PAUSED`; when requested during a batch, it takes
  effect at the next complete outer boundary.
- `single-step` is valid only in `PAUSED` and produces at most one complete
  outer slot. If host service is required before that slot can complete, the
  result is `WAITING_FOR_HOST`, not a fabricated step.
- `reset` is valid only after execution has stopped at a complete boundary. It
  performs core reset and the selected queue policy as one transaction, then
  leaves the worker paused; core reset and boot remain distinct operations.
- `stop` or `shutdown` observed during a batch takes effect after the current
  complete boundary. It prevents later budgets and reaches `STOPPED`; it does
  not claim that the core queue was drained or cancelled.
- `STOPPED` is terminal for that worker machine. A new machine requires a new
  worker. `FAILED` is likewise terminal except for evidence retrieval through
  `scheduler-state`.

An operation rejected for lifecycle state has no machine or queue side effect
beyond consumption of its valid worker request identifier.

## Event queue and identity

Each event has fixed-width fields:

```text
u32 kind
u32 flags
u64 due-boundary
u64 generation
u32 value
u32 reserved-zero
```

The caller supplies the current machine generation; stale generation returns
the fixed stale-completion status. The queue is bounded and owned by machine
state. Insertion sequence is core-assigned only after complete batch validation
and is monotonically increasing without reuse; it is observable in state and
transcripts, not caller-controlled.
The queue sorts by `(due-boundary, profile-priority, insertion-sequence)`.
Capacity rejection is atomic. A due boundary earlier than the current boundary,
integer overflow, unknown kind or flags, a nonzero reserved field, or an event
whose payload is invalid for its kind returns a fixed error without partial
insertion.

Batch insertion validates every event, duplicate-producer rule, generation, and
total capacity before assigning any sequence or mutating the queue. Trace
transport reserves the complete same-boundary event, interrupt, and slot record
set before due-event dispatch. A full or unavailable trace transport therefore
causes zero event, I/O-board, CPU, queue, or clock mutation.

The selected kinds are:

| Kind | Payload | Scope |
| --- | --- | --- |
| 60 Hz clock | count exactly one | TV interrupt assertion and counter tick |
| raw keyboard | one 16-bit CADR I/O-board event | injection only; physical mapping is M8 |
| direct sequence break | zero | synthetic conformance stimulus only |

Accepted disk completion is not a scheduler-ingress event kind. It remains the
existing ABI1.3 copied-completion transaction and enters the same-boundary order
only after M4 identity and payload acceptance. Protocol v3 MUST NOT advertise a
`DISK_READY` event that the core deliberately rejects.

At most one keyboard/Unibus producer may be due at one boundary in this profile.
The source interrupt register contains one Unibus vector field and a later
assertion can overwrite it; M5 rejects ambiguous multi-producer schedules
instead of inventing a historical vector-priority queue.

## Normative same-boundary order

At a due boundary `S`, before executing the next outer slot, the scheduler MUST:

1. apply an already accepted disk completion, including any resulting disk Xbus
   assertion;
2. apply one 60 Hz event through the monochrome TV transition: when TV mode bit
   3 enables interrupt, set TV request bit 4 and assert Xbus; when disabled,
   create no phantom interrupt; then increment the 16-bit sixty-cycle counter;
3. deliver one raw keyboard event into the I/O-board register or FIFO and
   assert Unibus vector `0260` if enabled;
4. set interrupt-control bit 26 for an explicitly requested synthetic
   sequence-break stimulus through the same canonical interrupt-control write
   path, including its coupled location-counter representation;
5. execute exactly one outer slot.

Color-TV assertion is absent from this selected profile. Same-kind duplicates
retain insertion order, subject to the one-keyboard rule. A host completion not
yet accepted at `S` is not retroactively due there.

Guest consumption order is not the queue order. Source-visible macro/microcode
tests page fault before external interrupt before sequence break. Within the
external interrupt path, Unibus is checked before Xbus; the selected Xbus
handler services TV before disk when both are pending. Buffered Unibus input
may request a sequence break only when both its channel sequence-break enable
and the corresponding source-enable bit permit it.

## Selected I/O-board contract

The portable I/O-board subset implements:

| Octal Unibus address | Access | Required behavior |
| --- | --- | --- |
| `764100` | read | keyboard low 16 bits; clear CSR keyboard-ready bit |
| `764102` | read | keyboard high 16 bits; clear CSR keyboard-ready bit |
| `764112` | read/write | CSR; writes replace only low enable bits selected by source |
| `764120` | read | latch/read low microsecond-clock word |
| `764122` | read | high word of the latched clock |
| `764124` | read | 16-bit sixty-cycle counter |

CSR bit 5 is keyboard ready, bit 2 enables keyboard interrupt generation, and
the selected keyboard Unibus vector is octal `0260`. The FIFO contains ten raw
events. Under the selected pinned-X11 behavior, an event arriving while the
visible register is free updates the scancode, but latches ready and asserts
the vector only when CSR bit 2 is enabled; an event arriving while ready is set
enters the FIFO. FIFO overflow returns queue-full without overwriting older
input. Reading either keyboard half clears ready.

`INF-M5-X11-POLL-v1` services the FIFO at the source-visible 65,536-outer-slot
poll cadence, independently of 60 Hz clock events. If ready is clear, one event
is removed, installed as the scancode, and latches ready/asserts only when
keyboard interrupt is enabled. This policy follows the selected X11 path; it
must not silently substitute the SDL push path, which sets ready directly.

All omitted I/O-board addresses return the selected unimplemented-device status;
they do not silently return plausible zeros.

## Run budgets, yielding, and host service

A run budget is a positive bounded number of outer slots. The worker processes
events and core execution one boundary transaction at a time, stops no later
than the budget, and reports completed slots exactly. It may yield to the host
between chunks for responsiveness, but chunk size cannot change the transcript.

An issued M4 request moves the scheduler to `WAITING_FOR_HOST`. No guest slot is
invented while the core cannot proceed. Completion delivery uses the existing
generation/request identity and is placed at its explicit due boundary.
Rejected, stale, duplicate, short, or wrong-operation completions retain M4
failure semantics.

The worker must check pause and stop intent between complete boundary
transactions. It must never interrupt mutation halfway through an event group
or outer slot.

## Worker protocol version 3

The first valid, in-order request pins a worker session to exactly one protocol
version. Version 1 remains the exhaustive M3 tree and version 2 remains the M4
media tree. M5 operations exist only in version 3; older sessions reject them
with `INVALID_ARGUMENT`, and a mixed-version request is malformed without
consuming the expected identifier.

Version 3 inherits the non-execution version-2 import, stream, media, host,
trace, observation, snapshot, machine-information, and digest operations. It
does **not** inherit the version-1/version-2 execution entry points:
`run`, `run-digest-batch`, `run-digest-batch-v3`, and
`run-digest-batch-m4` are `INVALID_ARGUMENT` in a version-3 session and are
replaced by the scheduler operations below.

| Request | Payload | Acceptance and response |
| --- | --- | --- |
| `scheduler-events` | nonempty array of at most 64 `{kind:u32, flags:u32, dueTick:u64, generation:u64, value:u32, reserved0:u32}` records | core validates and atomically inserts; response adds `delivered`, zero on rejection |
| `scheduler-state` | none | valid in every lifecycle, including terminal states; returns visibility and `CDRM5C1` metadata, plus failure evidence in `FAILED` |
| `scheduler-visibility` | `hidden:boolean` | records a changed value at the current boundary; first accepted request also completes the visibility handshake; hiding pauses `RUNNING` or `WAITING_FOR_HOST` |
| `scheduler-start` | none | `PAUSED`, visible, visibility initialized, core running; returns `RUNNING` |
| `scheduler-run` | positive `clockSlots:u32` | `RUNNING`, visible, visibility initialized, and no unsettled host boundary; returns status and exact slot/microinstruction totals |
| `scheduler-pause` | none | valid and idempotent in `PAUSED`; changes `RUNNING` or `WAITING_FOR_HOST` to `PAUSED` |
| `scheduler-single-step` | none | `PAUSED`, visible, visibility initialized, and no unsettled host boundary; returns `PAUSED` after one completed slot or `WAITING_FOR_HOST` |
| `scheduler-reset` | none | `PAUSED`; core reset succeeds atomically, leaves `PAUSED`, and discards an unsettled boundary marker |
| `scheduler-stop` | none | `RUNNING`, `PAUSED`, or `WAITING_FOR_HOST`; returns terminal `STOPPED` |
| `scheduler-shutdown` | none | same states as stop; returns `STOPPED`, reports `discardedUnsavedState:true`, then discards the instance and closes the worker |
| `scheduler-transcript-start` / `scheduler-transcript-finish` | none | `PAUSED`; start or finish the bounded core transcript |
| `scheduler-transcript-drain` | none | returns raw `CDRM5TR1` bytes and record count when available |
| `boundary-digest-v5` | none | returns one 32-byte `CDRSTATE5` digest when the core output buffer is ready |
| `run-digest-batch-m5` | `clockSlots:u32` in 1--4096 | `RUNNING`, visible, and visibility initialized; unlike `scheduler-run`, it accepts an unsettled marker so completion-only turns can settle it; returns `boundaryCount`, `terminalStatus`, `boundaryPendingHost`, and 128 bytes per emitted boundary |

`host-complete` retains the M4 generation/request/length checks. An accepted
completion while the worker is `WAITING_FOR_HOST` returns it to `RUNNING`; if
the worker was already paused by a control request, it remains `PAUSED`.

Every ordinary response is a `cadr-response` containing `version`, `id`, `op`,
numeric `status`, Boolean `ok`, and the version-3 lifecycle. Payload-shape
errors and lifecycle/fence rejection are respectively `INVALID_ARGUMENT` and
`NOT_READY`; core statuses are passed through. The fixed status vocabulary is
`OK=0`, `ABI_MISMATCH=1`, `INVALID_ARGUMENT=2`, `STALE_GENERATION=3`,
`DUPLICATE_COMPLETION=4`, `WRONG_COMPLETION=5`, `WRONG_LENGTH=6`,
`HOST_FAILURE=7`, `WAITING_FOR_HOST=8`, `NOT_READY=9`,
`PROFILE_MISMATCH=10`, `ARTIFACT_MISMATCH=11`, `GUEST_FAULT=12`,
`UNIMPLEMENTED_DEVICE=13`, `REENTRANT=14`, `NO_MEMORY=15`, `HALTED=16`,
`QUEUE_FULL=17`, and `AMBIGUOUS_SCHEDULE=18`. A malformed envelope or mixed
version produces a `cadr-error` with `malformed-message`; a wrong request ID
produces `non-monotonic-id`; an uncaught worker exception produces
`worker-failure`. Malformed and non-monotonic requests do not consume the
expected ID. No request contains a host timestamp.

Fatal `HOST_FAILURE`, `GUEST_FAULT`, `UNIMPLEMENTED_DEVICE`, or `HALTED`
changes the lifecycle to `FAILED`. The failing scheduler response carries the
last complete boundary, `CDRM5Q1`, and the failed-state `CDRSTATE5` digest.
The subsequent `scheduler-state` is the normative same-session evidence join:
it repeats those fields and co-reports `CDRM5C1` ordinal, boundary, and witness.
This is a serialized-session binding, not a compound cryptographic digest.

## Canonical M5 witnesses

### Raw scheduler transcript `CDRM5TR1`

`CDRM5TR1` version 4 is the normative core scheduler transcript. Its 16-byte
header is magic `CDRM5TR1`, little-endian u32 version 4, and little-endian u32
record count. It contains at most 256 fixed 120-byte records and has exact
length `16 + count * 120`.

Each record is little-endian `<QQQ24I>`: due boundary, generation, insertion
sequence, then kind, same-boundary order, flags, value, and before/after pairs
for interrupt, I/O-board CSR, interrupt control, location counter, TV mode,
sixty-cycle count, microsecond clock, microsecond phase, scancode, and FIFO
count. `scripts/cadr-m5-transcript.py` is the shared native/Wasm parser. It
rejects wrong magic/version/count/length, changing or zero generation,
duplicate insertion identity, invalid kind/value/flags, more than one keyboard
event per boundary, scalar-domain violations, decreasing due/order/priority,
broken same-boundary continuity, and a transition inconsistent with its event
kind. Native and Wasm `CDRM5D1` producers MUST store the raw sidecar and bind
its exact SHA-256; a JSON projection is not normative.

### Companion visibility witness `CDRM5C1`

Visibility is worker-owned and is intentionally absent from `CDRM5TR1` and
core `CDRSTATE5`. The normative companion chain begins with 32 zero bytes.
For each changed visibility value, its next SHA-256 input is exactly:

```text
ASCII "CDRM5C1" (7 bytes)
previous witness (32 bytes)
next control ordinal (u64 little-endian)
current complete guest boundary (u64 little-endian)
hidden (u32 little-endian, 0 or 1)
protocol request ID (u32 little-endian)
```

An unchanged value creates no chain record, although its first accepted
request establishes the current-tab visibility handshake. The
`scheduler-state` response exposes the current ordinal, boundary, witness,
hidden value, and initialization flags. Conformance evidence binds these
values to the same serialized version-3 worker session and request sequence;
failure evidence uses the same-session join described above.

`CDRM5WK1` version 3 is the normative snapshot envelope that cryptographically
binds this companion state to the raw core snapshot. Its 104-byte header is:

| Offset | Field |
| ---: | --- |
| 0 | eight-byte `CDRM5WK1` magic |
| 8 | u32 version 3 |
| 12 | u32 flags: bit 0 hidden, bit 1 source visibility initialized |
| 16 | u64 raw inner length |
| 24 | u64 control ordinal |
| 32 | u64 control boundary |
| 40 | 32-byte control witness |
| 72 | 32-byte SHA-256 |

The raw `CDRSNAP1` begins at offset 104. The envelope digest is SHA-256 of
header bytes 0--71 followed by the raw snapshot. It is unkeyed integrity, not
origin authentication. Import rejects flag, length, zero-witness/ordinal,
boundary, digest, inner-version, and inner-clock inconsistencies.

### Pending-queue witness `CDRM5Q1`

`CDRM5Q1` is SHA-256 over ASCII `CDRM5Q1`, then little-endian scheduler phase
u32, hidden-policy u32, next insertion sequence u64, and pending count u32.
Pending events follow in canonical
`(due boundary, priority clock < keyboard < sequence break, insertion sequence)`
order. Each contributes due boundary u64, generation u64, insertion sequence
u64, kind u32, flags u32, value u32, and reserved-zero u32. Host transport
transcripts are excluded. `CDRM5Q1` is the queue witness in terminal failure
evidence.

## Hidden tabs, termination, and shutdown

The default browser policy is pause-on-hidden. A visibility change is a host
control request observed at the next complete boundary; it does not advance
guest time. An explicitly selected continue-while-hidden policy may request
ordinary budgets, but it still cannot derive correctness ticks from frame rate
or elapsed wall time. In this profile, the actual worker implements
pause-on-hidden. The selected value and transition boundary enter the
`CDRM5C1` companion witness and `CDRM5WK1` save envelope, not `CDRM5TR1`.

Worker termination is fail-stop. In-memory queue, raw input, and unsaved machine
state are discarded; termination does not claim a guest shutdown or snapshot.
Bounded shutdown waits only for the current boundary transaction and already
accepted host-delivery point of no return. It does not wait for arbitrary
future events or promises that have not crossed that boundary.

## Reset, snapshot, and failure semantics

Cold power-on clears I/O-board registers, FIFO, counters, queue, insertion
sequence, and scheduler transcript. Selected warm/core reset behavior must be
encoded explicitly and tested; it cannot be inferred from a C structure
`memset`. Core reset increments generation and invalidates outstanding requests,
completions, and generation-tagged future host events, but preserves scheduler
virtual time and already latched I/O-board/FIFO state. Cold power clears them.
Applying an accepted completion is a zero-slot transition and does not satisfy
a single-step request.

A one-slot batch that reaches `WAITING_FOR_HOST` records only an
`unsettled-boundary` marker, never a pre-completion digest. Accepted completion
turns are zero-slot transitions. The marker remains through a completion chain
until a zero-slot completion reaches quiescence, when exactly one post-
completion 128-byte boundary row is emitted. While it is set,
`scheduler-run`, `scheduler-single-step`, snapshot size/save/restore/import are
`NOT_READY`. A paused caller can settle it by starting and continuing the M5
batch. Successful reset explicitly discards it; stop and shutdown discard it
on entry to `STOPPED`. A fatal result wins over queued pause, visibility, stop,
or shutdown controls; those requests then return `NOT_READY` and cannot mutate
the failed machine.

Snapshot save requires `PAUSED`, a current visibility handshake, no busy,
dirty, or snapshot-blocked media fence, and no unsettled boundary. Snapshot
restore requires `PAUSED` and the same media/boundary fences; size inquiry is
also fenced by media and the unsettled marker but leaves lifecycle readiness
to the core. Snapshot import is accepted only in `NEW` or `PAUSED` under those
fences. ABI1.4 uses `CDRSNAP1` version 1.2 and required scheduler chunk type 10
for the pending queue, scheduler phase/policy, generation and insertion
sequence, I/O-board latch/FIFO, clock counters, and rational microsecond
remainder. Hidden-tab state and the control witness are not in type 10;
`CDRM5WK1` owns them. CDRSTATE1 through CDRSTATE4 and older CDRSNAP1 minor
bytes remain unchanged. Restore always leaves the worker `PAUSED`. Import
preserves source companion metadata but requires a fresh current-tab visibility
handshake before execution.

Validation is fail-closed and atomic. It covers required/duplicate scheduler
chunks, known optional chunks, directory reserved bits, type-10 size and
reserved fields, disk witness integrity, I/O-board CSR/scancode/FIFO domains,
queue count and relationships, event generation/identity/order, transcript
continuity and per-kind transitions, total witness invariants, the
`CDRM5WK1` fields and digest, and the control boundary not exceeding the inner
snapshot clock. A rejected restore leaves the destination unchanged.

Malformed queue records, impossible lifecycle transitions, queue overflow,
ambiguous simultaneous Unibus producers, past-due events, counter overflow
where the selected modulo rule does not apply, and source/worker profile
mismatch fail closed. A failure report includes the last complete boundary,
lifecycle, queue digest, and core state digest without host paths or wall-clock
timestamps.

## Conformance matrix

| ID | Stimulus | Required result | Current evidence |
| --- | --- | --- | --- |
| `M5-Q01` | insert out of due order and across yield chunk sizes | identical sorted dispatch and boundary transcript | core scheduler and differential tests pass |
| `M5-Q02` | full queue then one more event | atomic queue-full; earlier queue unchanged | core scheduler test passes |
| `M5-Q03` | past event, unknown kind/flags, nonzero reserved field, duplicate Unibus producer | fixed rejection with no partial insertion | core scheduler test passes |
| `M5-I01` | keyboard enabled/disabled, visible register occupied, ten queued, low/high reads | exact CSR, vector, FIFO, and consumption behavior | core scheduler test passes |
| `M5-C01` | clock tick and counter wrap | TV assertion precedes modulo counter update; no host time read | core scheduler and raw-parser tests pass |
| `M5-P01` | accepted disk, clock, keyboard, direct SB all due at `S` | `INF-M5-PRE-SLOT-v1` order and identical native/portable restart state | native/Wasm/repeat differential passes |
| `M5-L01` | start, pause mid-budget, single-step, resume | transitions occur only at complete boundaries and transcript is chunk-independent | worker runnable matrix reaches this result |
| `M5-L02` | wait for host, pause/stop/reset races and chained completions | one specified winner, no orphaned completion, half-applied slot, or pre-completion digest | production batch helper covers `[1+WAIT] -> [0+WAIT] -> [0+OK]`; worker protocol exits normally |
| `M5-H01` | hide and show under default policy | guest boundary unchanged while hidden; `CDRM5C1` advances and snapshot preserves it | worker and visibility-adapter tests pass |
| `M5-S01` | queued events and nondefault I/O-board state at snapshot | exact continuation or explicit not-ready; never silent loss | core corruption and worker-envelope tests pass |
| `M5-V01` | protocol v1/v2/v3 sessions and mixed version | frozen older trees, rejected legacy execution in v3, and version-pinned responses | worker tests pass |
| `M5-F01` | fatal execution followed by state query; staged write in failure digest | immediate `CDRM5Q1` + failed `CDRSTATE5`; same-session state joins `CDRM5C1`; staged payload remains hashable | actual pre-HALT worker fixture and separate production-helper/core staged-write tests pass |
| `M5-O01` | patched maintained-`usim` simultaneous injection | canonical event, interrupt, restart, and final-state witnesses equal | normalized oracle plus native/Wasm/repeat differential passes |

`C-M5` closes only when every row has an executable gate, the patched oracle
records the named inferred schedule, native and Wasm agree at every affected
boundary, repeated runs are byte-identical, and the full M4/M3 regression
suite remains green.

## Release record

Status: **closed** for `CADR-WEB-303/ABI1.4/C-M5-SCHED-v1`.

The implementation and portable differential are otherwise present. The
captured differential result reports
`native-wasm-and-repeats-identical` through boundary 565,536, with simultaneous
input due at boundary 500,000, sequence break cleared at 502,997, and external
interrupt cleared at 505,102. Its raw `CDRM5TR1` SHA-256 is
`7aa2732272762a1f43e7aa322b75555a7eba047953120a30d2711bed7d62f1ed`;
native `CDRM5D1` is
`566d6d09403a21109bacffe0b17acd53a01e7304562c47baaa498076cc01e2e8`,
Wasm `CDRM5D1` is
`7c52051b2359a0b0cb987d9d0733629b789eada79d0d41aa137109f14cce0712`,
and the independently normalized source-oracle witness is
`7e0febe5752e546379d67faf0df765010616c445e29f3a59dafc1df982ddd5c8`.
The source oracle is evidence of the instrumented selected schedule, not by
itself a C-M5 closure claim.

The examined artifacts and tools are:

| Item | Identity |
| --- | --- |
| repository source examined | base Git `a95507556add968cec345b59ad83e34b230031f8`; closing worktree was uncommitted, with the changed worker and tests bound individually below |
| version-3 worker / batch helper | SHA-256 `2fed83533c6a62313e23911d9c46f2a60145c5adc16c25c783d598b973cb26d0` / `be2af9f596939ee66f6f99b53341906081143b4b7df7e9f14f61d53068c5d55e` |
| worker protocol / core scheduler tests | SHA-256 `36ab859c1ddd3edde0ecadcb9a1000571be31e510761f6f4898d3828c0415bc9` / `193d267cb4dc6d9863fffb166fd20cb9a88a2ecfa23fab00904bcbfe4dc25b35` |
| raw parser | `scripts/cadr-m5-transcript.py`, SHA-256 `59aaf8cbd4cd078ee05e413720f4b36e8e3854f81382402bb9f6fc8ee825a03f` |
| differential driver | `scripts/cadr-m5-differential-runner.py`, SHA-256 `44f42c50d94f6ed6fc53e80d9fc8c6579a06d4690fcfdea0a3fbd29aa30f6106` |
| native/Wasm producer sources | SHA-256 `0fd34c4b338062b54784f06d4fe1d4be36e14487f8ee2b0d3c18f59fcef0401e` / `2994f3760f68d44632078ac06955cd3289b18a624f06ea69fe53fec90a2e1232` |
| native runner | 190,408 bytes, SHA-256 `83f277da21174f37ad4511a496d3440160c2a7574440a59e16bfbc85b61c8ac5` |
| worker Wasm O0 | 191,483 bytes, SHA-256 `444443e29e4b39fd3ff4846653a17027d34d0aa5313c58cc3bfe2aaba523da0c` |
| differential Wasm oracle | 174,659 bytes, SHA-256 `9c93298ecef98f70741351ca46e980d5167a7e7d2a0cfd36101fb91aae60ab00` |
| toolchain | GCC 16.1.1, build-selected Clang/wasm-ld 21.1.5, Node 22.14.0, Python 3.14.6, Guix channel `230aa75bfa47fb119197675b9cc0609512494aec` |

Executable evidence commands are:

```sh
./scripts/run-cadr-m5-differential.sh
python3 scripts/cadr-m5-transcript.py validate build/cadr-m5-differential/native-a.cdrm5d1.cdrm5tr1
python3 -m unittest tests.test_cadr_m5_differential_runner tests.test_cadr_m5_transcript
guix shell node -- node tests/test_cadr_m5_worker.mjs
guix shell node -- node tests/test_cadr_m5_visibility_adapter.mjs
guix shell node -- node tests/test_cadr_m5_wasm_exports.mjs
guix shell node -- node tests/test_cadr_m5_worker_protocol.mjs
```

All listed commands and `make -C cadr-web m5-unit` pass in the recorded
checkout, including the normally completing worker-protocol gate. Its
production `cadr-m5-batch.mjs` helper
fixture proves `[1 slot + WAITING] -> [0 slots + WAITING] -> [0 slots + OK]`
publishes no intermediate row and exactly one settled row; it also proves a
`[1 slot + GUEST_FAULT]` result collects failure evidence before any ordinary
digest callback. The actual core/Wasm test independently proves that the
failure-safe `CDRSTATE5` digest accepts a staged write payload that the ordinary
digest correctly fences.

The closing terminal fixture imports an actual ABI1.4 snapshot positioned one
slot before HALT, records two real visibility changes, and executes that slot
through the version-3 worker. The immediate batch response reports
`terminalStatus=HALTED`, lifecycle `FAILED`, zero ordinary boundary rows, last
complete boundary 1, and 32-byte `CDRM5Q1` and failed-state `CDRSTATE5`
witnesses. A subsequent `scheduler-state` in the same serialized worker repeats
the boundary and both digests, reports control ordinal 2 and a nonzero
`CDRM5C1`, and the terminal-operation matrix rejects every non-state operation.
This closes the former failure-join gate without substituting synthetic
JavaScript witness bytes for the published worker protocol.

No M5 real-browser lifecycle run is claimed. The closing commit is the
repository commit containing this release record. Its own hash is not embedded
here because that would be self-referential; the examined source and test
files are bound above by content hash.

## Sources

- [Maintained LM-3 System check-in
  `4df393c6`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
  and [maintained `usim` check-in
  `330d8248`](https://tumbleweed.nu/r/usim/info/330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d),
  verified 2026-07-29.
- Public System 46 comparison source at commit
  [`8e978d7d`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src),
  not merged into the System 303 profile.
- Repository evidence: `l/usim/iob.c`, `l/usim/kbd.c`, `l/usim/usim.c`,
  `l/usim/ucode.c`, `l/sys/ucadr/uc-interrupt.lisp`,
  `l/sys/ucadr/uc-page-fault.lisp`, and the ABI1.4 implementation and tests.
- [CADR browser/WebAssembly implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md).
- [ABI1.3 boot-media controller specification](cadr-boot-media-controller-reimplementation-specification.md).
- [ABI1.2 headless WebAssembly core specification](cadr-webassembly-headless-core-reimplementation-specification.md).

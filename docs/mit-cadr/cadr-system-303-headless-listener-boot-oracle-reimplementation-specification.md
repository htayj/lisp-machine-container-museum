---
type: Reimplementation Specification
title: CADR-WEB-303 ABI 1.4 headless System 303 Listener boot oracle reimplementation specification
description: Release-bounded contract for artifact preflight, raw Cadet boot input, source-defined Listener busy and idle witnesses, post-observer quiescence, bounded failures, and three-run native and WebAssembly conformance.
tags: [mit-cadr, lm-3, system-303, listener, boot, oracle, webassembly, reimplementation]
timestamp: 2026-08-02T05:37:12-04:00
---

# CADR-WEB-303 ABI 1.4 headless System 303 Listener boot oracle reimplementation specification

## Conclusion, reconstruction claim, and compatibility boundary

`CADR-WEB-303/ABI1.4/protocol-v4/M6` defines a repeatable behavioral, headless
System 303 boot oracle. It starts from the selected five-artifact profile,
answers the two cold-boot questions with raw Cadet transitions, submits two
source-bound diagnostic forms to the actual initial Lisp Listener, observes
three ordered 48-bit markers, waits through a bounded cleanup interval, and
compares 64 native-derived machine projections. The release contract is
`C-M6-DEBUG-IR-LISTENER-READY-ABC-v1`.

Marker C establishes a deliberately narrow Listener-ready fact: the same
retained object that Form B identified as the initial, selected, exposed
`TV:LISP-LISTENER`, with the same owner process and stack group, directly
returned the System 303 source predicate `:IDLE` inside the observer's
no-reschedule critical section. This is stronger than recognizing a
framebuffer or waiting a guessed number of host seconds. It is not a decoded
tagged pointer and it does not prove that the process is already blocked at a
particular reader program counter, that the input editor is empty, that no
partial form exists, or that a prompt is visible.

The selected profile is a behavioral reconstruction contract. It does not
promise that another implementation's source or executable artifacts can be
loaded, nor does it promise historical real-time timing, display equivalence,
complete input, persistent storage, networking, or a distributable System 303
disk. ABI1.4 and worker protocol v4 add M6 operations without changing the
frozen ABI1.2, ABI1.3, or protocol-v2/v3 behavior.

Compatibility stops at the exact artifact-ingress, schedule, marker,
quiescence, normalized-state, failure, and READY behavior specified here.

## Normative language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` constrain an independent
implementation of this selected profile. They do not turn a reconstruction
instrument, a browser protocol, or an inferred scheduling policy into a claim
about original CADR hardware.

## Release identity

The canonical release record is
[`cadr-m6-release-record.json`](../../cadr-web/oracle/cadr-m6-release-record.json).
Its canonical UTF-8 JSON SHA-256 is
`5e90866967905acb22c21abb1dc40ada01e134ef6ce1be372e1a6bae63546c4a`.
The record is produced only by the strict verifier after accepting three
independent atomic native capture bundles. It contains identities, diagnostic
forms, schedules, Wasm artifact identities, native-only input identities,
hashes, and normalized samples; it contains no private disk bytes.

| Item | Selected identity |
| --- | --- |
| LM-3 System source | Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` |
| maintained `usim` | Fossil check-in `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` |
| raw Cadet map | SHA-256 `2881102e8a8883379cf7da06251501b3c75f453d8fe0bff0d7e9f649198e1cd8` |
| native M6 patch | SHA-256 `a646dd94a71a508799280d4756708d62817e2afa397046dac36ebbce8a72b924` |
| native M6 executable | SHA-256 `9c4fc4cc1771fb53cd1dae0c2fdc974c7e78726bc86fa2a04594ec2fcb717666` |
| release-record schema | `cadr-m6-native-debug-ir-release-record-v1` |
| release contract | `C-M6-DEBUG-IR-LISTENER-READY-ABC-v1` |
| worker target | `CADR-WEB-303/ABI1.4/protocol-v4/M6` |

The five required inputs occur in the fixed order `1, 2, 4, 5, 3`:

| Kind | Meaning | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| 1 | canonical runnable-template identity token | 854 | `1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f` |
| 2 | PROM control store | 20,480 | `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6` |
| 4 | PROM symbols | 3,130 | `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d` |
| 5 | microcode symbols | 83,270 | `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |
| 3 | System 303 disk | 269,562,880 | `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` |

Kind 1 is the unrendered `cadr-web-303.ini.in` template, including its
private-runtime placeholders. The native producer verifies that exact template
before rendering a separate private `usim.ini`. The portable M6 path verifies
kind 1 as a profile-identity token; it does not parse or apply the template's
path, UI, or other configuration settings to the Wasm machine.

The native emulator additionally consumes one input that is not a Wasm ABI
artifact and has no artifact kind:

| Native input | Bytes | SHA-256 |
| --- | ---: | --- |
| `usite-extra-hosts` | 262 | `6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438` |

The release record carries this identity only in `native_inputs`. Treating the
hosts file as kind 5, or shifting the control store and symbol files into
different kinds, is a semantic artifact mismatch even when every byte and hash
is otherwise genuine.

The disk remains an excluded local input with unresolved distribution
provenance. Its identity is a compatibility requirement, not permission to
bundle it.

## Reconstruction claims and selected evidence

| Code | Kind | Establishes | Does not establish |
| --- | --- | --- | --- |
| `M6-SOURCE-LISTENER` | selected System 303 `baswin.lisp` and `ltop.lisp` | meaning of `:BUSY` and `:IDLE`, initial Listener ownership, top-level evaluation boundary | browser transport or native marker chronology |
| `M6-SOURCE-PROCESS` | selected `proces.lisp` | observer creation, waiting, no-reschedule section, normal cleanup path | decoded proof that the observer completed cleanup in a captured run |
| `M6-USIM-INPUT` | selected `cadet.defs`, `cadet.c`, `kbd.c`, and `iob.c` | raw key edges, held modifier masks, all-up state, ten-entry FIFO, ready-bit read effect | complete physical keyboard profile |
| `M6-NATIVE` | patched maintained `usim` and three strict raw captures | actual System 303 evaluation of Forms A and B, guest emission of C, exact boundaries, cleanup hold, native sample suffix | independence from the selected instrumentation |
| `M6-PORTABLE` | ABI1.4 core, adapter, protocol-v4 worker, and Wasm boot driver | exact record consumption, artifact preflight, host service state, Wasm marker/sample parity | historical hardware timing |
| `M6-STRICT` | sole-writer verifier and adversarial fixtures | closed schemas, chronology, exact writes, three fresh identities, canonical release | facts absent from the raw capture |
| `INF-M6` | selected reconstruction rules | paced raw input, finite timeouts, READY digest domain | original hardware policy |

Source, native instrumentation, and portable execution are complementary.
The diagnostic forms are new reconstruction probes. Their successful execution
is direct guest behavior, but the marker protocol itself is not historical
software.

## Architecture

```text
five immutable Wasm artifact sources (kind 1 is an opaque template token)
  -> snapshot + exact length/SHA-256 preflight
  -> ABI1.4 machine import and cold boot
  -> protocol-v4 deterministic scheduler
       -> rational 60 Hz clock events
       -> raw Cadet Return, N, Return
       -> paced Form A input
       -> A marker gate
       -> paced Form B input
            -> source Listener checks
            -> separate idle observer
       -> B marker
       -> C marker from retained-object observer
       -> 1,000,000-boundary cleanup hold
       -> 64 CDRM6I1 samples
  -> READY3 digest + bounded report
```

The native producer and Wasm driver consume the same canonical schedule and
release record. The native producer may write raw capture files; it may not
write a release record. The strict verifier may read raw captures and is the
sole release-record writer. The portable driver accepts only the compiled
release-record digest and cannot accept a caller-defined success predicate.

## Artifact preflight and mutation boundary

The production conformance runner MUST complete source preflight before it
constructs a Node worker or instantiates its Wasm machine. The reusable M6
driver accepts a caller-supplied protocol client, so a generic caller may
already have created a worker; its required boundary is instead before
artifact import, private-media mutation, cold power-on, or guest execution.
The preflight itself MUST:

1. require exactly one source for each kind `1, 2, 4, 5, 3`;
2. require the exact byte count declared by the release record;
3. read each source into an immutable private snapshot;
4. reject a short, long, missing, duplicate, or changing source;
5. compute SHA-256 over the exact snapshotted bytes;
6. compare every digest with the release record; and
7. reject any record whose canonical bytes do not match the compiled digest.

The validator MUST also compare the complete ordered artifact objects with the
semantic kind mapping above. Kind-only validation is insufficient. The
native-only hosts identity MUST appear exactly once in `native_inputs` and MUST
NOT be imported into the Wasm machine.

Preflight validates the kind-1 template's exact identity, not configuration
semantics. In particular, the portable driver does not parse, render, or apply
that template's path or UI settings.

The snapshot, rather than the original callback, is the source for subsequent
hashing, import, and disk reads. This closes a hash/read time-of-check versus
time-of-use gap. A wrong or truncated artifact produces
`artifact-preflight-mismatch` and reports `mutationStarted: false`; it cannot
cause artifact ingress, private-media mutation, cold power-on, or guest
execution. The production runner's negative case additionally records that no
worker was created. For a generic driver caller, `mutationStarted: false` does
not assert that its supplied worker had never existed. There is no fallback
disk or best-effort boot profile.

## Raw Cadet input contract

M6 injects raw Cadet wire transitions, not host text. Each unshifted character
is:

```text
key-down SCC
all-up 0x8000
```

Each shifted character is:

```text
modifier-down SCC
key-down SCC
all-up with held modifier mask
all-up 0x8000
```

The selected modifier codes and masks are Shift octal `024`/mask 1, Greek
octal `044`/mask 2, and Top octal `104`/mask 4. Uppercase ASCII uses Shift
with the lowercase physical key. A double quote uses Shift plus the apostrophe
key at octal `0133`. The terminal retained all-up value is `0x18000`: the I/O
board's high word plus the Cadet `0x8000` all-up code.

The keyboard FIFO has ten entries. M6 therefore limits each form burst to 16
source characters and waits 10,000,000 guest boundaries between bursts. Raw
frames inside a burst use
`ceil(n * 1,000,000 / 60)`. This pacing was selected after unpaced complete
forms overflowed Listener typeahead; it is a release requirement, not a claim
about human typing.

The fixed schedule contains 3,118 raw events and has SHA-256
`e91958d37bc4dc05618efd30317817e0728f8a47e7fb996ab3d3bb4facafef30`.
It sends:

1. Return at boundary 25,000,000;
2. `N` and Return beginning at boundary 27,000,000;
3. Form A and Return beginning at boundary 50,000,000; and
4. Form B and Return beginning exactly 20,000,000 boundaries after the final
   Form A frame.

Form B input MUST remain gated on complete observation of A. A missed input
deadline, FIFO overflow, non-all-up release, wrong mapping, extra input, or
partial schedule is fatal.

## Clock contract

The native and portable runs use
`C-M6-CEIL-N-1000000-OVER-60-GUEST-BOUNDARY-v1`:

```text
due(n) = ceil(n * 1,000,000 / 60), n = 1..59,039
```

A coincident clock edge is dispatched before a keyboard event. The transcript
ends at the final suffix boundary and has SHA-256
`7ce6f9b747b38927cefb7c3d23ce343fe9d8313335161616c1ce2025c660251c`.
Wall-clock time, animation frames, browser timers, CPU speed, and tab
visibility MUST NOT choose correctness boundaries.

## Listener predicates and forms

System 303 implements `LISP-LISTENER :LISP-LISTENER-P` by reading
`SI:LISP-TOP-LEVEL-INSIDE-EVAL` from the Listener process's stack group. It
returns `:BUSY` when that variable is non-null and `:IDLE` otherwise.
`PROCESS-WAIT` evaluates a predicate in scheduler context and may restart it,
so the predicate MUST be free of mutating side effects. `PROCESS-RUN-FUNCTION`
creates or reuses a separate process, presets it, enables it, applies the
function, then on normal return flushes the background stream, returns the
process to the spare pool, and kills it.

The exact form text and hashes are in the release record. Retyping a logically
similar form does not satisfy this profile.

### Form A

Form A executes in the initial Listener and requires:

- non-null `TV::INITIAL-LISP-LISTENER`;
- identity with `TV::SELECTED-WINDOW`;
- `TV:LISP-LISTENER` type;
- exposed state;
- owner identity with `SI::CURRENT-PROCESS`;
- owner process and stack-group types;
- direct `:LISP-LISTENER-P` result `:BUSY`; and
- `*TERMINAL-IO*` identity with the Listener.

Only after the conjunction succeeds does it write marker A. Its source-text
SHA-256 is
`4a0513ec624096317237c8091fdde668a89407aeedfc0cb00927c9c9967829ad`.

### Form B and observer capture

Form B repeats the busy-evaluation checks, retains the exact Listener `l`,
owner process `p`, and owner stack group `sg`, and starts one separate process
with `PROCESS-RUN-FUNCTION`. It then writes marker B and returns. Its
source-text SHA-256 is
`2e3d5d814deb92566fa45175fb51b0a1ce830d2ba68e93eae9ed3a03ea190107`.

The observer calls `PROCESS-WAIT` with only the retained Listener as explicit
predicate data. When the source predicate returns `:IDLE`, the observer enters
`WITHOUT-INTERRUPTS` and atomically rechecks:

- `l` is still `TV::INITIAL-LISP-LISTENER`;
- `l` is still `TV::SELECTED-WINDOW`;
- `l` is still a `TV:LISP-LISTENER`;
- `l` is exposed;
- `(SEND l :PROCESS)` is the retained `p`;
- `p` is an `SI:PROCESS`;
- `(PROCESS-STACK-GROUP p)` is the retained `sg`;
- `sg` is a stack group; and
- `(SEND l :LISP-LISTENER-P)` is still `:IDLE`.

Only the same no-reschedule section that accepts all checks may write marker C.
The observer source SHA-256 is
`046c90e9d5421ef2d23d9483889659066f9e71e8dd8aa1be31e0f5a413cc2969`.
C must arrive no later than 100,000,000 guest boundaries after the final B
write.

The causal preservation and atomic recheck establish same-object continuity
without exporting a pointer. They do not establish a visible tagged object
identity. A future profile that requires cross-process pointer comparison MUST
add an opaque guest-exported identity token rather than reinterpret the
current record.

## DEBUG-IR witness protocol

M6 reserves three data registers:

| Register | Decimal | Purpose |
| --- | ---: | --- |
| octal `0766000` | 257,024 | low 16 bits |
| octal `0766002` | 257,026 | middle 16 bits |
| octal `0766004` | 257,028 | high 16 bits |

Octal `0766006` is excluded from the M6 witness protocol because it is the
clock-control register. This is not a claim that every diagnostic interface
profile forbids that register.

| Marker | Words, low to high | 48-bit value | Meaning |
| --- | --- | --- | --- |
| A | `4d36 4131 a55a` | `a55a41314d36` | exact selected Listener is busy in first evaluation |
| B | `4d36 4232 5aa5` | `5aa542324d36` | retained-object observer was spawned during second busy evaluation |
| C | `4d36 4944 4c45` | `4c4549444d36` | retained exact Listener passed the atomic source-defined idle checks |

The transcript MUST contain exactly nine writes in A, B, C order. A marker is
recognized only after its complete three-word write; shared low words and
partial register contents are never markers. A missing, duplicate,
out-of-order, extra, wrong-address, or wrong-value write fails boundedly.

The native frozen observations are:

| State | Write boundaries | Complete-marker boundary |
| --- | --- | ---: |
| A | 328,589,384; 328,606,313; 328,623,242 | 328,623,243 |
| B | 980,279,676; 980,296,605; 980,313,534 | 980,313,535 |
| C | 982,955,347; 982,972,780; 982,990,213 | 982,990,214 |

## Cleanup and settled state

Marker C is emitted before the observer function returns. Source shows the
normal cleanup path, but M6 does not decode the observer process object after
C. The contract therefore makes
`observer-process-inactivity-not-decoded` an explicit residual nonclaim.

Instead, the native and portable runs continue for exactly 1,000,000 guest
boundaries. At every boundary they require:

- DEBUG-IR retains C;
- keyboard scancode retains all-up;
- keyboard FIFO is empty;
- I/O-board keyboard-ready and CCLK bits are clear as selected;
- disk transfer is not busy;
- no host request is pending; and
- no new diagnostic write occurs.

The settled boundary is 983,990,214. The 64-sample suffix begins one boundary
later and covers 983,990,215 through 983,990,278. A state change during the
hold resets nothing and cannot be waved through: it fails the run.

## CDRM6I1 normalized sample

Each suffix sample is exactly 96 little-endian bytes:

| Offset | Width | Field |
| ---: | ---: | --- |
| 0 | 8 | `CDRM6I1\0` |
| 8 | 8 | DEBUG-IR, upper 16 bits zero; must be C |
| 16 | 8 | P0, upper 16 bits zero |
| 24 | 8 | P1, upper 16 bits zero |
| 32 | 4 | P0 PC |
| 36 | 4 | P1 PC |
| 40 | 4 | next micro-PC |
| 44 | 4 | location counter |
| 48 | 4 | interrupt control |
| 52 | 4 | interrupt status |
| 56 | 4 | interrupt pending |
| 60 | 4 | I/O-board CSR |
| 64 | 4 | keyboard FIFO count |
| 68 | 4 | retained scancode, exactly `0x18000` |
| 72 | 4 | compact disk status: not-active bit 0 plus interrupt-request bit 1; exactly 3 |
| 76 | 4 | disk transfer active; zero |
| 80 | 4 | outstanding disk operation; zero |
| 84 | 4 | retained guest disk interrupt request; exactly one |
| 88 | 4 | host request pending; zero |
| 92 | 4 | host completion queued; zero |

The guest disk interrupt at offset 84 is not host-service residue. “No pending
host callback” means offsets 88 and 92 are zero and the worker has no
outstanding request identifier. It does not mean the guest disk interrupt
latch must be clear.

The 64 concatenated samples have SHA-256
`69cd9f9454dcebfe96a8fd70698d34768fb5a349ba7ecb8bec4dc6e13d5180c7`.
The portable adapter MUST construct the same normalization rather than hashing
host pointers or implementation-specific structs.

## Native capture and strict release construction

Each native run uses a fresh private disk instance and an atomic directory
containing exactly:

```text
metadata.json
capture.ndjson
idle.bin
```

Raw session content stays under ignored `build/cadr-oracle/`. Metadata binds
the source, executable, patch, artifact, mapping, schedule, form, clock, host,
observer, private-disk, and closed execution-environment identities. The child
environment has `LANG=C`, `LC_ALL=C`, and `TZ=UTC`, with no inherited variables
and only the run-local `CADR_M6_*` paths added for the native witness. NDJSON
rows have one global
boundary/order chronology. Duplicate JSON members are rejected recursively.
The final row must state a clean shutdown, all 3,118 input events, and nine
writes.

The three accepted `capture.ndjson` SHA-256 values are:

- `bfd1b9f702b6c0b2b1238ca2675e2d7ac60c8538c4e8ae1a6629ff0f41d1c5d5`;
- `14844989685a54fda9571da7da078bdfae50a7645eee594b2cbc855fdb37027f`; and
- `4697313cc9ef61631cfe4f90404868ea19a211b6bd97aad695949f606e725f25`.

They have distinct session and private-disk identifiers, unchanged
start/end disk hashes, identical input and write transcripts, identical
A/B/C/settled boundaries, identical suffix bytes, no unexpected input, no
forced stop, and complete state. `forbidden_debug_write_count` is retained in
the closed metadata schema, but has a deliberately narrow meaning: it counts
out-of-protocol addresses *delivered to the witness API*. The pinned native
patch dispatches that API only from the three data-register case bodies
`0766000`, `0766002`, and `0766004`; consequently its observed zero is
structural. It is not evidence that `0766006` (clock control) or any other
diagnostic address was monitored.

The direct linked transition harness in
[`cadr_m6_witness_transition_harness.c`](../../cadr-web/tests/cadr_m6_witness_transition_harness.c)
is compiled with the native witness implementation. It exercises the live
initializer and parser failures for a missing required environment field, an
invalid schedule header, a malformed row, and each checked noncanonical row
field (phase, scancode, and ordinal). It also exercises incomplete, partial,
duplicate, reordered, late-C, and independently varied direct cleanup guards
(Form-C drift, retained-all-up scancode, keyboard FIFO, IOB ready bit, disk
busy, and host request) after a real C transition. It does not synthesize a
write to `0766006`, because that is not a production-reachable witness call.
The current native cleanup function emits outstanding-disk state for strict
post-hoc validation but has no separate direct outstanding-disk branch; native
host completion is an architectural constant zero rather than a queue; and a
missing keyboard projection cannot be made a normal linked post-C transition
without changing the pinned producer, because C's selected boundary
serialization calls that projection before the later cleanup check. Those are
explicit coverage boundaries, not inferred rejection behavior.

The strict verifier MUST reject:

- fewer or more than three bundles;
- reused paths, session identities, disk identities, or capture bytes;
- symlinked, missing, extra, or non-regular bundle entries;
- unknown or duplicate JSON fields;
- source, artifact, patch, executable, mapping, form, schedule, timing,
  observer, or clock drift;
- any input or clock chronology error;
- any marker or boundary mismatch;
- any keyboard, disk, scheduler, or host residue outside the selected values;
- changed private disk bytes;
- a non-clean or incomplete finish; and
- any suffix not equal to the canonical CDRM6I1 bytes.

## Portable run state machine

The driver uses these logical phases:

```text
await-a
  -- complete A at native A boundary --> await-b
await-b
  -- complete B at native B boundary --> await-c
await-c
  -- complete C at native C boundary --> await-settled
await-settled
  -- retained C at native settled boundary --> suffix
suffix
  -- 64 exact native samples --> READY
```

Input batches are inserted only when the scheduler queue is empty. Form B
cannot be scheduled before A. C is guest-produced and has no host input batch.
The driver stops at each frozen observation boundary and rejects an overshoot,
premature marker, partial marker, unexpected marker change, device residue, or
sample mismatch.

The worker MUST remain visible according to the M5 lifecycle contract during
the run. Pause, failure, terminal machine status, host-request overflow,
malformed service, and boundary exhaustion produce failure, not READY.

## READY digest

The successful protocol-v4 result uses the domain `CDRM6READY3`. Its canonical
preimage binds:

- release-record SHA-256;
- artifact-set SHA-256;
- immutable private-disk base SHA-256;
- Wasm A, B, C, settled, and final READY boundaries;
- native A, B, C, settled, and final READY boundaries;
- terminal `CDRSTATE5` SHA-256;
- terminal `CDRM5Q1` SHA-256; and
- host-transaction transcript SHA-256.

All five Wasm boundaries MUST equal their corresponding frozen native
boundaries. Changing any component changes READY. A caller cannot supply a
replacement predicate or accepted digest.

The final report also records a fresh run session identity, a fresh
private-disk instance identity, bounded last host transactions, machine and
queue evidence, lifecycle, and failure phase. A result object that lacks the
READY digest or exact release identity is not success.

The production three-run campaign owns one worker at a time. It MUST dispose
the current worker before it reports that run complete or asks the factory for
the next worker. Disposal failure aborts the campaign before READY evidence can
be serialized. A progress callback is operational telemetry only: it runs
after disposal and per-run freshness validation, is absent from canonical
evidence, and its failure also aborts the campaign. This ordering bounds live
worker resources without changing any guest boundary, witness, or digest.

## M6-DEVID1 evidence continuation and READY4 boundary

`CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1` is a separately selected
continuation-evidence profile, not a revision of the READY3 release profile
above. It retains the frozen M4 `CDRDISKEVID1` prefix through event 511 and
commits later complete final records in the fixed `CDRM6E1` summary. The exact
policy identifier is `M6-PREFIX512-TAILSHA256-v1`; it retains ABI minor 4,
rejects every snapshot endpoint, and must be selected explicitly at worker
instantiation. The detailed record, atomic final-event rule, and conformance
matrix are in [the M6-DEVID1 disk-evidence continuation policy](cadr-m6-disk-evidence-continuation-policy.md).

`CDRM6READY4` is not an alternative success result for this document's READY3
campaign. If a future reviewed M6-DEVID1 release envelope selects it, its
domain-separated `CDRM6READY4` binding MUST additionally commit the frozen
READY3 witness, NUL-terminated exact M6-DEVID1 target, exact policy ID,
little-endian selected maximum, and SHA-256 of one exact `CDRM6E1` record. Until then,
`TODO-RUNTIME-M6-DEVID-READY4` remains open and no READY4 result may be
reported.

The selected M6 build now provides a bounded, C-owned fast-stop primitive for
that future campaign. Protocol-v4 `run-until-event-m6` accepts 1 through
1,048,576 slots and returns one fixed `CDRM6FAST1` record, stopping at the
first endpoint, any 48-bit debug delta, `WAIT`, or terminal status, in that
fatal/WAIT/debug/endpoint priority. Each record is followed by separately
obtained `CDRSTATE5` and `CDRM5Q1` digests and linked with domain
`CDRM6FASTCHAIN1\0`; therefore fast progress does not replace the frozen M5
state/queue evidence. The direct, campaign, independent-validator, benchmark,
and systemd scripts are control-plane scaffolding with explicit `--execute`,
not observed boot evidence. In particular, their O0/O2 comparator's
1,130,000-slot receipt check and its 25,000 slots/second, twelve-hour
projection threshold have not been run against licensed System 303 media.

The M7-only
`CADR-WEB-303/ABI1.5/protocol-v5/C-M7-P4-EFFECTIVE-PAGE-IDENTITY-v1`
companion may explicitly observe the returned fast record after each M6 call;
it is disabled unless the M7 wrapper selects its exact typed policy.  It can
arm only after the M4 boot-scratch commit, comparison, and base-read suffix,
and only on the selected terminal quiet suffix at or after boundary `1030044`:
a returned reason-1 record with zero persistent status and no outstanding
request. This observation does not alter `CDRM6FAST1`, the M6 chain, the frozen
M6 release, or ordinary M6 behavior.

The block service never publishes the acknowledgement by itself. After a
matching write completes, the M6 fast driver first serializes its adjacent
issue/completion events into the exact `CDRM6HS1` transcript, obtains a fresh
effective-page reread from the trusted service, and only then constructs the
receipt. It binds both record ordinals and digests, all request identity and
boundary fields, host status, selected-base identity, effective source,
overlay generation/root, and unique record pairs for all three arm operations.
The validator receives the selected base identity independently and derives
the canonical overlay root from it and the transcript-authoritative initial
commit page hash. A missing, duplicate, or forged arm pair, missing or second candidate, failed
reread, or mismatch aborts publication. This is unit-tested M7 control-plane
support, not a frozen M6 release result or a new P4 runtime observation.

The O2 continuation canary has a deliberately separate, non-default
systemd entry point:
`scripts/run-cadr-m6-devid-o2-canary-systemd.mjs`. The underlying launcher
refuses an unsupervised live child. Before artifact access it stages only
`git archive` output from the named base, applies the selective M6 patch,
verifies a closed post-patch byte manifest, and runs the frozen M3, M4, M5,
and focused M6 gates. M7/display paths are rejected.

Its dedicated loop does not call the READY-oriented `runM6HeadlessBoot`. Its
exact bound is `machine-info.clock_slots_completed == 1,130,000`, not a
digest-row count. A `WAITING_FOR_HOST` published at that value fails without
host-service drain; success also requires no outstanding request. The private
disk is a new per-invocation, initially empty, generation-zero in-memory M4
block-one overlay over a read-only artifact-root base, not a copied or
artifact-root-backed writable disk. The supervised child emits an atomic
result envelope; the outer wrapper queries the retained unit's actual
resource and exit accounting before it alone publishes the receipt.

Runtime observation, 2026-07-29: the reviewed O2 procedure completed at
exactly 1,130,000 clock slots with no outstanding host request, 535 accepted
disk-evidence events, and 23 events in the SHA-256 tail. The private receipt
was 18,609 bytes with SHA-256
`47131339865ae4c07eb4b88603d6feceb0c5889b7a9bc27cf30a9c3f4a1ec2ac`;
it binds base `8eb4c536a8ff9c29ee5e288d55deda8f77fb06da`, candidate
`b55bfa76b7c39d33277fcb7457e9d5f84e2c3e4a`, and payload SHA-256
`17425d22fe44dbb7869444827e1110218a31f6d56ab6b87ad2d2275efaaaf4de`.
The immutable base disk remained unchanged, the fresh private overlay
advanced from generation zero to one, and the transient unit plus both
outer-owned roots were absent after cleanup. This is an M6-DEVID1
continuation result, not READY4 and not `CW1-BOOT`.

Runtime observation, 2026-08-02 UTC: one pinned-Node production execution at
repository commit `8519fc3de65f8aba98a67842d1340c1374cc58a0` produced the
canonical `cadr-m6-selected-image-negative-supervised-v3` receipt
`selected-image-negative-8519fc3-20260802T005017Z.json`. It is 9,575 bytes
with SHA-256
`5159e672660285dcb252db65a325cb40c38037dd494f0607074ee520565cef0b`.
The receipt binds accounting SHA-256
`f527a583b35abf1f61f3ffc0e7a629afa8fbec3a0d0daf476ca27b3d7a3a5833`
and effective-policy SHA-256
`a85b39ec4234494ffe7c353b1ac1b0c211f955cdf04b739502e2dfc809b97625`.
It sets `transient_unit_absent`, `source_stage_removed`, and
`private_root_removed` to true, records equal before/after base identities, and
sets `guest_execution_attempted`, `wasm_build_attempted`, and
`worker_constructed` to false with `materialized_image_bytes` zero. The two
negative views were a same-length wrong-hash view and a one-byte-truncated
view, both rejected before mutation. This observation closes exactly the
production wrong/truncated/pre-mutation negative sub-obligation. READY4 and
`CW1-BOOT` remain open until the required three actual boots complete.

The selected supervisor's systemd grammar is source-bounded to v261.1 commit
[`eff9446d505d62c075bed37d606860b38cfe51fb`](https://github.com/systemd/systemd/commit/eff9446d505d62c075bed37d606860b38cfe51fb).
`systemd-run` resolves the executable before transient-unit bus dispatch and
serializes that path with the literal argument vector
([`run.c` lines 2863--2888](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/run/run.c#L2863-L2888),
[`run.c` lines 1395--1439](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/run/run.c#L1395-L1439)).
With expansion disabled it uses `ExecStartEx` and the `no-env-expand` flag
([`run.c` lines 1215--1223](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/run/run.c#L1215-L1223)).
`systemctl show` emits a bare status number for `CLD_EXITED` and number/name for
a terminating signal
([`systemctl-show.c` lines 1535--1559](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/systemctl/systemctl-show.c#L1535-L1559));
the signal formatter emits realtime names only as `RTMIN+N`
([`signal-util.c` lines 148--161](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/basic/signal-util.c#L148-L161)).
This is a deliberately nonportable Linux x86-64/glibc profile: realtime signal
numbers 34 through 64 must be spelled `RTMIN+0` through `RTMIN+30`; `RTMAX`
aliases accepted by systemd's inverse parser are not accepted as emitted
`systemctl show` evidence.

## Failure and abort semantics

M6 failures are fail-closed and bounded:

| Phase | Examples | Required evidence |
| --- | --- | --- |
| preflight | wrong length, hash, kind, record, or canonical JSON | diagnostic plus `mutationStarted: false`; no artifact ingress, cold power-on, or guest execution (the production runner also has no worker) |
| ingress | import/boot/visibility/start failure | current machine info if available; no fabricated marker |
| run | missed event, FIFO error, bad marker, timeout, host limit, sample drift | last complete state and queue digests plus bounded device transactions |
| terminal | core halt/error or worker failure | actual terminal status, lifecycle, `CDRSTATE5`, `CDRM5Q1`, and transaction tail |

The driver MUST pause or stop only through declared worker operations. Boundary
exhaustion, a missing C at its 100,000,000-boundary limit, and a cleanup
invariant change are ordinary bounded failures. None may be reported as a
partial READY.

Preflight failure precedes all guest mutation. Later failure may leave volatile
machine or overlay state in memory, but it does not imply persistence. M6 never
exports or commits a private disk overlay.

The one-run diagnostic builder separately requires a full
`--receipt-base`. It archives that commit and records its tree object before
applying the diagnostic delta; it never derives the diagnostic base from the
mutable index.

### Local M6 diagnostic observation

The private diagnostic observation used to investigate M6 remains a local,
non-public cause record under the ignored M6 diagnostic session tree. It may
establish only its recorded fixed-capacity disposition and hashes; it does not
establish the licensed disk contents, a reusable receipt, or READY4. Any future
public description must retain the private-session provenance and rights
boundary while publishing no raw disk or diagnostic payload.

**Local observation, not a release result:** the ignored file
`build/cadr-m6-diagnostic/cadr-m6-one-run-cause-witness-2026-07-29.json` was
22,842 bytes with SHA-256
`3952de2f863c22255fccf6d0db15996a29f5a024aa8ad69f73feb961962253ee`.
The private receipt records the disposition
`disk-evidence-capacity-exhaustion-guest-fault-observed` at terminal completed
guest boundary `1125883`. Its supervised unit was
`cadr-m6-diagnostic-20260729.service`, with invocation
`75561e67c48541ff84af67a2ac8412eb`; its exact source-bound build provenance
names staged tree
`23937bfc4e1278325d64095e967c11b0082743d0`, diagnostic delta `0004` SHA-256
`35d690d33a4ee815f476b7893c31276f50f7f34c90709fb61aca65b418d5d2fd`, builder
SHA-256 `0de81d37bac1adfdaf4e95fb178c989551671fdf8f0a926c7b76fb08c1e0e992`,
launcher SHA-256 `c0cd977c7db2658fcc9dea8e83b13b6c8a60891b6446148136040436f79d62e2`,
and release-record SHA-256
`5e90866967905acb22c21abb1dc40ada01e134ef6ce1be372e1a6bae63546c4a`.

The recorded execution consumed 39m25.198 wall time, 19m27.982 CPU time, and
877.3M peak memory. Publication was canonical JSON via a mode-0600 no-replace
path, with the temporary staged tree removed after the run. This paragraph
deliberately does not reproduce the private receipt or licensed disk bytes.
Its `last_observed_attempt_slot` is neither a claim that the tuple was the last
accepted event nor a claim that it was the first rejected event: it is only
the local diagnostic field named by that schema.

## Conformance requirements

An independent implementation conforms only if it passes all of these groups.

### Record and parser tests

1. Accept the canonical record and recompute its SHA-256.
2. Reject every unknown, missing, duplicate, reordered-where-ordered, or
   noncanonical field.
3. Mutate each identity, artifact, form, marker, observer property, timing
   constant, schedule event, native boundary, sample, and digest in isolation.
4. Prove that Python and JavaScript parse the same exact record.
5. Reject old AB/two-form records and the stale
   `first_boundary_delta_from_b` field.

### Input and clock tests

1. Encode the complete A and B text from `cadet.defs`.
2. Exercise uppercase `N` and `M`, double quote, apostrophe, every modifier
   family present in the forms, and terminal all-up.
3. Reject SCC-release substitution, a missing held mask, overflow, wrong
   chunk size, wrong pause, or host-time scheduling.
4. Compare all 3,118 event rows and all 59,039 clock rows.
5. Prove clock-before-keyboard order for coincident boundaries.

### Native tests

1. Build the exact patched executable from the pinned maintained source.
2. Run three fresh private-disk boots.
3. Require exact A/B/C writes and observation boundaries.
4. Require the 1,000,000-boundary cleanup hold and exact suffix.
5. Verify unchanged private disks and clean stops.
6. Run negative native executions for missing environment or schedule, partial,
   duplicate, reordered, late, and each production-reachable direct
   quiescence violation. Do not present a synthetic `0766006` call as a
   native producer test.

### Wasm tests

1. Run three fresh worker boots against the canonical record.
2. Require exact marker boundaries, 64 sample comparisons, and distinct
   session/private-disk identities.
3. Recompute READY3 independently and mutate every bound component.
4. Prove wrong and truncated artifacts stop before mutation.
5. Prove missing C, late C, changed C, unsettled cleanup, residue, sample
   mismatch, host-service failure, and boundary exhaustion fail boundedly.
6. Rerun the M3, M4, and M5 conformance suites to prove frozen compatibility.
7. Prove exact `create -> dispose -> validated progress -> next create`
   ordering, exactly-once disposal for ready, failed, and throwing runs, and
   fail-closure when disposal or progress reporting rejects.
8. Validate the tracked outer evidence as canonical, duplicate-free,
   closed-schema JSON; pass its nested summary through the production READY
   serializer; bind the exact release, artifact, negative-preflight, and Wasm
   identities; and separately rehash the fixed local Wasm module when that
   ignored build product is available.

### Release gate

`CW1-BOOT` closes only when the tracked record, compiled record digest, three
native captures, and three actual Wasm boots all agree; all focused and prior
milestone suites pass; and an independent review accepts the evidence and
nonclaims. Synthetic fake-worker tests are necessary but are not substitutes
for three actual Wasm executions.

## Input bindings and UI substrate

M6 is a headless infrastructure subsystem, not an interactive application. It
has no application-specific keybindings, prefix tree, pointer bindings, menu
accelerators, presentation translators, CLIM dependency, Dynamic Windows
frame, or TV command loop. Its only input is the exact machine-readable raw
Cadet schedule specified above. Complete interactive keyboard and pointer
coverage belongs to M8 and M9.

## Screenshot applicability

No screenshot is normative for this specification. The tested surface is
headless marker chronology and machine/device state; substituting a picture of
a Listener would weaken the oracle and would not show A/B/C identity checks,
host-request emptiness, or sample equality. Raw diagnostic screen captures
used during schedule discovery remain ignored local evidence.

The repository already has separately reviewed System 303 Listener screenshots
in the Listener and computer-use documentation. They establish appearance and
interactive observations, not this headless compatibility result. M7 will
introduce framebuffer and displayed-pixel screenshots as a conformance
surface.

## Rights and preservation

The selected disk is never tracked. Each native capture uses a private copy and
records only its non-secret identity. Raw capture bundles remain ignored
because they are large research payloads. The tracked release record contains
original reconstruction metadata and probes, hashes, and normalized machine
state, not recovered documentation, font data, or disk content.

The public maintained LM-3 source and selected System 46 comparison remain
distinct evidence. No claim here transfers a maintained restoration behavior
to historical System 46 without separate evidence.

## Extension points and profile changes

A later profile MAY add:

- an opaque guest-exported Listener identity token;
- a decoded observer-process lifecycle witness;
- a reader-PC or explicit input-editor-empty predicate;
- a prompt or framebuffer checkpoint;
- another System 303 disk identity;
- another emulator;
- another clock policy; or
- a display/input/persistence profile.

Each addition requires a new contract or selectable profile, new canonical
record, new native and Wasm evidence, and release-discriminating tests. It MUST
NOT silently broaden `C-M6-DEBUG-IR-LISTENER-READY-ABC-v1`.

## Open questions and explicit nonclaims

- The observer's process object is not decoded after C. The stable cleanup hold
  does not prove its inactive status.
- Source `:IDLE` does not prove `READ-FOR-TOP-LEVEL`, prompt visibility, empty
  edited input, or absence of a partial form.
- Same-object continuity is causal and source-checked; no tagged pointer value
  is exported.
- The native emulator has no Wasm host completion queue. Its zero host fields
  are an architectural projection; the portable worker separately proves its
  real queue and outstanding-request state.
- The retained guest disk interrupt is expected and is not an orphaned host
  callback.
- Native behavior is repeatable only under the specified minimal child
  environment and observed host ABI. M6 does not claim a hermetic or
  bit-reproducible native build or runtime.
- The exact disk's distribution provenance remains unresolved.
- The selected guest-boundary clock is deterministic reconstruction policy,
  not historical wall-clock fidelity.

## Primary sources and implementation evidence

Verified 2026-07-29:

- LM-3 System check-in
  [`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91):
  [`window/baswin.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbaswin.lisp),
  [`sys/ltop.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fltop.lisp),
  and
  [`sys2/proces.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys2%2Fproces.lisp).
- Maintained `usim` check-in
  [`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`](https://tumbleweed.nu/r/usim/info/330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d):
  `cadet.defs`, `cadet.c`, `kbd.c`, `iob.c`, and the selected boot/device
  implementation.
- [`cadr-m6-witness-schedule.py`](../../scripts/cadr-m6-witness-schedule.py),
  canonical raw Cadet schedule and diagnostic forms.
- [`cadr_m6_debug_ir_witness.c`](../../cadr-web/oracle/native/cadr_m6_debug_ir_witness.c),
  native marker, clock, cleanup, and sample producer.
- [`cadr-m6-native-witness.py`](../../scripts/cadr-m6-native-witness.py),
  strict verifier and sole release-record writer.
- [`cadr-m6-headless-boot.mjs`](../../cadr-web/wasm/cadr-m6-headless-boot.mjs),
  portable record validator and headless boot state machine.
- [`run-cadr-m6-wasm-conformance.mjs`](../../scripts/run-cadr-m6-wasm-conformance.mjs),
  three-fresh-worker production campaign and atomic evidence writer.
- [`validate-cadr-m6-wasm-evidence.mjs`](../../scripts/validate-cadr-m6-wasm-evidence.mjs),
  independent outer-envelope and optional local-Wasm validator.
- [`cadr_wasm_adapter.c`](../../cadr-web/wasm/cadr_wasm_adapter.c),
  CDRM6I1 and M6 metadata projection.
- [ABI1.4 deterministic scheduler specification](cadr-deterministic-machine-scheduler-reimplementation-specification.md),
  normative underlying scheduler and worker lifecycle.
- [Lisp Listener dossier](lisp-listener.md) and
  [Listener reimplementation specification](../lisp-listeners-reimplementation-specification.md),
  broader visible and interactive Listener behavior.

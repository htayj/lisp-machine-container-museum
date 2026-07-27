---
type: Architecture Decision
title: Native CADR instruction-boundary oracle design
description: A reproducible, rights-conscious design for freezing the pinned usim execution oracle before extracting the portable CADR core.
tags: [mit-cadr, system-303, usim, emulator, trace, conformance]
timestamp: 2026-07-27T17:47:00-04:00
---

# Native CADR instruction-boundary oracle design

## Decision

The pre-refactor `CADR-WEB-303` oracle is frozen. It is produced by a tracked, versioned
instrumentation patch and a tracked Python preparation, build, capture, and compare
wrapper. The wrapper applies the patch only to a verified disposable copy of the
pinned `usim` source under ignored `build/cadr-oracle/`.

The repository will not vendor a second emulator core, modify the ignored
`l/usim` checkout in place, or rely on a link-time shim. Important execution state
is file-static and several observable values are mutated before an end-of-step
observer could recover them. A source patch is therefore the smallest mechanism
that can place observation at the real boundaries without making an unmaintainable
fork the new reference implementation.

This decision records the frozen native reference, not production-core parity. The
tracked `libcadrcore` must still reproduce every selected boundary before `C-M1` can
close.

## Source and rights boundary

Preparation must verify the exact `usim` check-in
`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`,
an independent manifest of every copied source file, the selected
[`CADR-WEB-303` profile](../../cadr-web/profiles/cadr-web-303.json), and a
zero-fuzz patch application. It must prove that the original checkout is unchanged.

The wrapper, trace schema, patch, and BSD-derived emulator instrumentation may be
tracked. The following remain ignored under `build/cadr-oracle/`:

- raw boundary and range traces;
- decoded microinstruction or guest-memory values;
- reconstructed or checkpointed machine state;
- disk and load-band bytes; and
- private runtime copies and logs.

Tracked evidence may record source identities, tool versions, commands, byte counts,
aggregate hashes, and pass/fail summaries. An evidence manifest must not embed
instruction words or guest-memory content.

The tracked [`cadr-oracle.py`](../../scripts/cadr-oracle.py) first establishes this
source-preparation stage. Its
[`source-files.json`](../../cadr-web/oracle/source-files.json) version-two closure
pins 122 `usim` and 138 directly required Chaos source/build inputs—260 files in
all—by byte length and SHA-256. It rejects missing, altered, unexpected, or
symlinked files from the named roots and copies only those public emulator inputs.

The local checkout administration points to an unavailable repository location, so
preparation cannot live-query the Fossil repository.
Its output consequently records the expected check-in as
`asserted-not-live-verified`, sets `vcs_live_verified` to false, and treats the
independent complete file manifest as the fail-closed identity. This is sufficient
to reproduce the exact audited bytes, but it is not represented as fresh VCS
provenance.

## Exact execution boundary

`ucode_run` in the pinned source calls `uexec_step`, performs idle work and periodic
I/O polling, then increments `machine_cycles`. A trace boundary is the complete
outer-loop clock slot:

1. begin with state `S(n)`;
2. call `uexec_step`;
3. perform the existing same-slot idle and periodic polling;
4. perform existing dump and diagnostic checks;
5. increment `machine_cycles`; and
6. emit `S(n+1)`.

`S0` is captured immediately after `machine_control_boot` and before the first
`uexec_step`. A 100,000-slot oracle therefore contains 100,001 boundary records,
`S0` through `S100000`, and stops before another step.

Within `uexec_step`, `incNPC` runs unconditionally and delayed MD may complete
before the inhibit test. An inhibited slot clears inhibit and suppresses OA,
source-latch, decoded-class, and POPJ execution, but it can still change canonical
pipeline or delayed-memory state and can still own a transcript event. The record
therefore classifies the slot as `EXECUTED` or `INHIBITED`; neither classification
implies a particular mutation count or state equality. Documentation and comparison
output must call these **clock-slot boundaries**, not silently count every
inhibited slot as a retired microinstruction.

The lower-level probe needs a begin latch as well as an end hook. `mdata` is mutated
by dispatch, byte, and jump execution, while OA modification changes the effective
instruction. The latch therefore records the raw fetched word, OA-effective word,
PC and store selector, decoded source addresses, and pre-operation A/M values before
execution.

## Canonical boundary state

All fields use explicit little-endian encodings; no C structure is written directly.
Each boundary includes:

- ordinal, `machine_cycles`, and executed, inhibited, and halted flags;
- `p0`, `p1`, diagnostic instruction, and `iwr`, masked to 48 bits;
- `p0_pc`, `p1_pc`, `npc`, `opc`, and PROM/IMEM selectors;
- `lc`, `q`, `old_q`, VMA, MD, delayed MD, and delay phase;
- dispatch constant, interrupt control, interrupt status, and pending state;
- SPC, PDL pointer, and PDL index;
- OA low/high values and pending flags;
- decoded operation and source addresses, latched A/M values, POPJ, ALU output,
  carry, and output;
- machine halted, VMA-valid, and PROM-disabled state;
- allocated main-memory page count; and
- an ordered mutation/event transcript range for that slot.

The transcript covers writes to IMEM, A and M memory, dispatch memory, PDL, SPC,
virtual maps, physical memory, interrupts, and guest-visible device registers.
Virtual-memory and bus events record operation, canonical address, value,
success/NXM/fault disposition, and resulting interrupt transition. Because a slot
may have zero or several transactions, there is no single “device transaction”
scalar.

Initial hashes cover PROM, IMEM, every mutable memory/map, and reset device state.
Full arrays are not repeated at every boundary. Ordered write events plus periodic
full-state recomputation make a missing mutation hook detectable. A zero event
count means only that none of the enumerated transcript families wrote during that
slot; ordinary processor and latch state may still change, and only the canonical
state digest determines equality.

## Host nondeterminism rule

The first 100,000 slots are valid only if no uncontrolled keyboard, pointer,
wall-clock, Chaos, signal, disk-worker, or other asynchronous host input reaches the
machine. An occurrence emits `ORACLE_EXTERNAL_EVENT` and invalidates the run; it is
not normalized away.

This matters because the current native host installs a wall-time 60 Hz timer and
periodically polls I/O. The oracle build must replace those sources with an explicit
deterministic schedule or establish that none can affect the measured prefix.
Locale and timezone settings alone do not solve guest-visible host timing.

The frozen oracle build uses deterministic idle, controller, and device behavior and
rejects uncontrolled external input. **Local runtime observation (`O1-RUN`):** all
three accepted prefixes recorded zero external events. This establishes the selected
100,000-slot run only; it does not generalize to the ordinary interactive X11 host.

## Trace modes

The normative envelope is
[`CADR native-oracle trace format, version 1`](../../cadr-web/oracle/trace-format.md).
The tracked Python reference codec validates its byte layout, Castagnoli CRC-32C,
typed extensions, predecessor hash chain, terminal counts, and fail-closed parsing.
It has no filesystem-writing API.

The binary header carries a 16-byte UUID derived from the complete identity bundle.
`S0` contains exactly nine reserved noncritical identity TLVs, types 100 through
108: the bundle followed by the profile, unpatched source manifest, patch,
executable, configuration, disk, prepared-source, and input-aggregate SHA-256
values. The parser derives the bundle again from those eight components and requires
the header UUID to equal its first 16 bytes. A selected comparison additionally
requires the expected full bundle and profile hash, so a self-consistent trace for
another build or profile is not accepted merely because its bytes match another
copy of itself. Reserved identity TLVs are valid only on `S0`; unrelated unknown
noncritical extensions remain forward-compatible outside that range.

Each canonical record has a kind, payload version and length, ordinal, event
sequence, and CRC-32C. The complete file has a terminal SHA-256.

- `hash` records the boundary and mutation-transcript digest for all 100,001
  states and is the ordinary golden comparison.
- `checkpoint N` additionally recomputes full canonical state every `N` boundaries;
  the initial value is `N=1024`.
- production `range FIRST:LAST` event rendering remains deferred to M2 and is not
  claimed as part of the frozen native oracle.

Comparison first finds the earliest unequal boundary digest. The implemented
component dump then exposes canonical scalar and root inputs at selected boundaries;
production M2 still owns general event-range rendering. Text is a renderer, never
the normative comparison format.

An opt-in diagnostic component dump supports production parity work without changing
the normative trace. For each requested boundary, including mandatory `S0`, its
ASCII NDJSON record contains all canonical tagged scalars 1 through 60, tree-root
families 14, 1 through 13, and 15, device-root families 31 through 37, and the
boundary state SHA-256. The tracked validator reconstructs the exact
`CDRSTATE1` byte stream from those components, recomputes the digest, and rejects
schema, inventory, order, width, selection, or digest disagreement. The dump is an
ignored diagnostic artifact; it is not incorporated into trace identity.

Successful termination distinguishes guest state from capture control. A real
guest halt requires the final boundary's `HALT` flag and the `COMPLETE_HALT`
terminal reason. The ordinary 100,000-slot witness stops because its requested
limit was reached while the guest remains runnable, so it uses `COMPLETE_LIMIT`
without inventing `HALT`. Parser success, oracle failure, an aborted capture, and
guest halt are not interchangeable.

## Acceptance gates

The oracle is frozen only when:

1. wrong check-ins, source drift, wrong profile artifacts, fuzzy patching, dirty
   destinations, and source/destination aliasing fail before compilation;
2. the ignored original checkout remains byte-identical;
3. three independent captures produce identical 100,001 boundary digests,
   checkpoint hashes, terminal trace hashes, and zero external-event records;
4. disk and source inputs remain unchanged;
5. the parser rejects truncation, bad lengths and CRCs, unknown required versions,
   and wrong profile identities;
6. a one-bit ALU mutation diverges at the first exercising fixture instruction;
7. fixtures exercise every mutation-hook family; and
8. checkpoint recomputation equals incremental state at every checkpoint.

All eight oracle gates are closed for the selected `CADR-WEB-303` prefix.

### Frozen-oracle evidence

The evidence classes in this section are deliberately separate:

- `O1-SRC` is inspection of the tracked patch, preparation/build wrapper, native
  instrumentation, source manifest, and trace codec.
- `O1-RUN` is local execution of the ignored prepared native build against the
  selected configuration and exact local disk.
- `O1-TEST` is the tracked synthetic, parser, identity, mutation, and diagnostic
  test suite.

**Local compiled-artifact observation (`O1-RUN`):** the final prepared native
executable has SHA-256
`b4d2d16351af5984a6229243c469a58af9fc24ba76a62b7bc6c7e51f12d56b2c`.
Three fresh, independently invoked captures each produced a 24,000,792-byte trace
with 100,002 records: 100,001
clock-slot boundaries from `S0` through `S100000`, followed by the terminal record.
All three files are byte-identical, with trace SHA-256
`97c8dbf8d7bd0f3a896fecfdcb8161c5a2d2ad0a77b7c25d14c5091f21ecd0d5`
and final boundary-chain hash
`6df4eef12c062ae63b082d8428e0a966b8e85af00fa0745aebb801ca3f3ad791`.
Their validated identity bundle is
`5e31742c67576a291dc071b91673c5e4ef3952edb2a1d9c3081a4f4adbc01390`.

**Identity and integrity observation (`O1-RUN`):** the profile, source manifest,
instrumentation patch, canonical configuration, prepared source, exact input
aggregate, executable, and disk identities were bound into `S0`. Original source,
prepared source, executable, configuration, capture inputs, and disk were rechecked
before and after capture and did not change. This is an equality claim about the
recorded inputs, not a fresh live verification of the unavailable Fossil repository.

**Diagnostic observation (`O1-RUN`, `O1-TEST`):** a component dump at boundaries
0, 78, 79, and 80 has SHA-256
`542642d25fad3842740efe30d65bb3f23cbe14ac6a381656b3e031b8bf2eb30b`.
The validator independently recomputed all four state digests, and focused tests
also matched each dumped digest to the corresponding trace state field. Enabling
the dump produced a trace byte-for-byte identical to an ordinary capture from the
same executable.

**Tracked test evidence (`O1-TEST`):** 40 oracle and trace-codec tests passed. They
include exhaustive synthetic mutation-family coverage, checkpoint detection of an
unhandled device mutation, identity-component and stale-source negatives, strict
trace parser failures, begin-latch sensitivity, diagnostic-schema and digest-tamper
failures, malformed half-byte identity rejection, and a behavioral one-bit ALU
mutation that diverges at its first exercising fixture boundary. Identity tests also
reject missing, duplicate, reordered, misplaced, wrong-component, wrong-profile,
and unrelated-UUID cases, including a synthetically self-consistent trace selected
against a different expected profile and bundle.

These results freeze `O1`, the pre-refactor native oracle. O1 evidence alone does
not establish production parity. The separate fail-closed production comparison
has since reproduced all 100,001 selected boundaries and closed `C-M1` for this
bounded prefix; that later result and its production evidence are recorded in the
[implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md#m1-implementation-status).

## Rejected alternatives

- A vendored `usim` copy would create a second reference implementation before
  extraction begins.
- In-place edits to `l/usim` are neither a tracked deliverable nor a safe provenance
  boundary.
- A link shim cannot observe file-static state or latch values before mutation.
- Raw structure dumps are host-endian, padding-dependent, and can include pointers.
- A framebuffer hash is a user-visible checkpoint, not an instruction oracle.

Last verified against pinned `ucode.c`, `uexec.c`, virtual-memory, bus, and build
sources: 2026-07-27.

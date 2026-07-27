---
type: Architecture Decision
title: CADR-WEB portable core, host ABI, trace, and snapshot boundary
description: Normative M1-M3 architecture decisions for separating the System 303 machine from native and browser host services.
tags: [mit-cadr, system-303, webassembly, emulator, architecture, abi]
timestamp: 2026-07-27T17:47:00-04:00
---

# CADR-WEB portable core, host ABI, trace, and snapshot boundary

## Decision

`CADR-WEB-303` will use one platform-neutral, single-machine-instance
`libcadrcore`. Native headless tests and the WebAssembly worker will execute the
same core sources through the same versioned C ABI. The browser is a host for that
machine, not a second emulator implementation.

This is an implementation decision for roadmap M1-M3. It does not claim that the
current `usim` tree already has this boundary. The file allocation below is an
inferred refactoring plan grounded in the pinned `usim` build graph and device
dependencies; processor behavior remains normative in the
[System 303 processor specification](cadr-macroinstruction-and-microarchitecture-reimplementation-specification.md).

## Ownership boundary

One opaque `cadr_machine` instance exclusively owns all mutable guest-visible
state:

- the microengine, registers, control stores, dispatch store, A and M memories,
  PDL, Q, maps, and main memory;
- bus, Unibus-map, I/O-board, interrupt, and device-controller state;
- guest-visible monochrome and color display memory;
- guest clock, event ordering, pending-request descriptors, and generation
  counters; and
- trace position and snapshot-visible transaction state.

The host owns external resources: files, immutable disk sources, durable overlays,
display and audio presentation, browser input, Chaos transport, configuration
parsing, process lifecycle, sockets, signals, and wall time. The core may describe a
pending external operation, but it never owns a host file descriptor, pointer,
thread, promise, pathname, or browser handle.

One worker thread owns an instance, and all ABI calls for that instance are
serialized on it. The scaffold is deliberately not internally synchronized;
concurrent calls from multiple host threads would be a host contract violation, not
a supported completion mechanism.

Existing mixed modules must be split at that line. CPU, memory, deterministic
device models, tracing, and snapshot code enter the core. X11, SDL2, SDL3, disk
files, the external Chaos library, signal timers, and command-line/debugger
presentation remain adapters. `usim.c` becomes a thin native host. Backend headers,
backend macros, and `main` are forbidden in core compilation units.

## ABI contract

The public ABI exposes `typedef struct cadr_machine cadr_machine;`, not its layout.
All cross-boundary integers have an explicit width. Public constants use fixed-width
fields rather than relying on a compiler's C `enum` representation. Every public
record begins with:

```c
uint32_t abi_major;
uint32_t abi_minor;
uint32_t struct_size;
```

A major-version mismatch rejects the operation. Every field in the understood
record prefix is validated, and every known reserved field must be zero. A receiver
may accept a newer minor version only by ignoring bytes beyond the structure size it
understands; a newer minor does not relax validation within the known prefix. ABI,
snapshot, and trace versions are independent.

The operation families are creation and destruction, bounded execution, host
completion delivery, reset, snapshot, and restore. No public record contains
`long`, `time_t`, `FILE *`, a host handle, native structure padding, or a buffer
retained past the call. Input bytes are copied before return. Status values
distinguish at least:

- ABI mismatch or malformed call;
- guest fault or halt;
- host failure;
- unknown, stale, duplicate, wrong-kind, or wrong-length completion;
- corrupt snapshot or trace; and
- a deliberately unimplemented execution path during staged integration.

## Asynchronous device protocol

Each external request is identified by `(machine_generation, request_id)`.
Request IDs increase monotonically within a generation and are not immediately
reused. A core device records a request internally; the host drains a copied typed
descriptor with `cadr_machine_next_host_request` or its successor. The public ABI
does not let the host invent a guest request. A completion supplies a transient
byte span of the exact declared length, which the core copies before returning.

A pending dependency yields execution. The core must not execute past it.
Completion delivery copies into a core-owned queue; it does not resume the machine
reentrantly. The completion becomes visible only at the next defined clock-slot or
device boundary.

Unknown IDs, old generations, duplicates, wrong kinds, wrong byte counts, and
invalid ordering are rejected without mutating guest state and are traceable.
Reset advances the generation and invalidates every older completion. Disk overlay
commits use transaction IDs and prepare/commit semantics; partial block visibility
is forbidden.

## Canonical trace

The normative trace is a binary record stream. Human-readable output is a rendering
of that stream and is not itself the comparison format. Its header records a magic
value, trace-schema version, profile and artifact identities, selector mask, and
initial-state hash.

Every boundary record contains:

```text
record_kind
payload_version
payload_length
boundary_ordinal
clock_slot_ordinal
ordered_mutation_range
canonical_state_digest
payload
record_crc
```

Selected detail payloads include micro-PC, 48-bit decoded word, A and M
sources, destination, Q, VMA, MD, macro-PC, fault, and interrupt information.
Device records cover request issue, completion, rejection, transaction commit,
display/audio/Chaos output, clock decisions, and halt. Hashes cover the exact
canonical bytes. Host paths, addresses, thread identifiers, wall time, padding,
locale-sensitive text, and nondeterministic logging are prohibited.

`S0` precedes the first outer clock slot. Later boundaries classify the slot as
executed or inhibited, but both may change canonical state and own mutation events:
the pinned engine advances the PC pipeline and delayed MD before testing inhibit.
Likewise, an empty enumerated mutation range does not imply an unchanged processor
state. A bounded successful prefix terminates with `COMPLETE_LIMIT`; only an actual
guest halt may set `HALT` and use `COMPLETE_HALT`.

## Snapshot and restore

A snapshot is taken only at an instruction boundary with no callback active. Its
canonical little-endian, chunked representation contains:

- format and exact profile identity;
- architectural processor and microcode state;
- memory, map, bus, and device-model state;
- guest time, interrupt decisions, and generation counters;
- pending requests as semantic descriptors;
- trace sequence position; and
- overlay transaction metadata, but not host-owned overlay bytes.

Every chunk has a type, version, byte length, and checksum. An unknown required
chunk fails restore; an explicitly optional chunk may be skipped. Restore first
constructs and validates replacement state, then atomically swaps it into the
machine. Failure never leaves a partially restored old machine.

## Build and verification order

1. Freeze a 100,001-boundary pre-refactor oracle (`S0` through `S100000`) under
   one exact native binary, input set, and deterministic outer-slot schedule.
2. Split the build into core, headless host, and graphical/transport adapters.
3. Compile the core without backend macros or host libraries and audit linked
   symbols for filesystem, socket, signal, wall-clock, X11, and SDL dependencies.
4. Exercise the opaque ABI through a synchronous in-memory native host.
5. Compare all 100,000 instruction-boundary states with the frozen oracle.
6. Add pending/completion paths and rejection tests.
7. Add canonical tracing and compare hashes across native builds.
8. Add snapshot/restore and compare uninterrupted and restored continuations.
9. Compile those same core sources to WebAssembly and run native/WASM differential
   tests.

Current portability hazards requiring explicit tests include signed shifts, rotates,
shift counts at or above 32, failure to mask imported or exported microinstructions
to 48 bits, signed-carry extraction, host-endian raw serialization, C structure
padding, signed `char`, incorrect `printf` formats, and host-sized file offsets.

## M1 validation result

The production implementation now closes the bounded `C-M1` gate for the frozen
`CADR-WEB-303` profile. The same `libcadr_core.a` used by the native headless host
owns the processor, memory, canonical Merkle caches, mutation transcript, bus, and
prefix-relevant controller state. The core has no mutable global or thread-local
machine state.

The final native run completed 100,000 outer clock slots and 82,149 executed
microinstructions. The tracked comparator matched all 100,001 production boundary
records against the frozen oracle, including canonical state and ordered-mutation
digests and mutation ranges. The comparison command requires the selected frozen
identity-bundle and profile SHA-256 values and passes both to the trace validator
before comparing any boundary. Focused negative tests reject a changed state digest,
changed mutation digest, wrong boundary count, missing or malformed selection
arguments, and a structurally valid self-consistent trace under the wrong selected
identity or profile. The gate also rejects every external-event record; abort,
oracle-failure, and guest-halt terminals; missing, duplicate, or early terminals;
and unknown, ambiguous, or otherwise invalid production boundary flags. The only
accepted ending is one `TERMINAL_COMPLETE`/`COMPLETE_LIMIT` record immediately after
the exact final selected boundary. ABI tests verify that nonzero known `reserved0`
fields on run and completion inputs fail before changing the output record,
generation, outstanding request, completion queue, or complete machine state. Build
audits reject forbidden host symbols, backend headers, public resource handles,
unexpected exports, and mutable globals; a two-machine interleaving test checks that
the canonical cache and machine state remain instance-owned.

This result is deliberately limited to M1's selected prefix. The constant
prefix-inactive device roots and typed stubs do not specify later disk payload,
tape, Chaos transport, color-TV, audio, snapshot, restore, or general trace
behavior. Those remain later milestone work.

## Rejected alternatives

The selected profile rejects:

- compile-time X11/SDL/Emscripten selection inside the core;
- direct Emscripten imports from device models;
- exporting internal C structures as the ABI;
- raw memory or native-structure snapshots;
- callbacks that retain core pointers;
- continuing the CPU directly from a promise or completion callback;
- guest time derived from host wall time;
- JSON as the normative trace or snapshot representation; and
- building a separate Wasm execution path before native determinism is established.

These alternatives either create two semantic implementations, expose
platform-dependent state, or make ordering and replay depend on the host.

## Open implementation obligations

- Broader processor conformance beyond the frozen M1 prefix remains distinct from
  the completed 100,001-boundary extraction-parity result.
- General selectable tracing, snapshot, and restore remain M2 work; the M1
  boundary witness is a conformance artifact, not that general facility.
- Disk-controller integration belongs after the deterministic core boundary; the
  current threaded disk-unit implementation must not be pulled into M1 unchanged.
- Fixed Wasm memory sizing and growth policy remain to be measured after the
  machine-state layout is explicit.

Last verified against the selected roadmap and pinned `usim` build graph:
2026-07-27.

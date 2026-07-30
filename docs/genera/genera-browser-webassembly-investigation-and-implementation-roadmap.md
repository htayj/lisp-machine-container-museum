---
type: Implementation Roadmap
title: Open Genera 8.5 browser and WebAssembly investigation and implementation roadmap
description: A gated roadmap for validating an Ivory WebAssembly engine, reconstructing browser Life Support, and locally booting a user-supplied licensed Genera 8.5 world.
tags: [symbolics, genera, open-genera, ivory, vlm, webassembly, browser, roadmap]
timestamp: 2026-07-30T07:32:05-04:00
---

# Open Genera 8.5 browser and WebAssembly investigation and implementation roadmap

## Outcome and present confidence

Open Genera in a browser is feasible, but its roadmap cannot yet honestly be closed
to the same level as CADR. The Ivory instruction architecture is well specified and
the public VLM descendant contains generated C instruction handlers. The unresolved
critical path is the exact relationship among those handlers, the preserved
historical VLM executable, Open Genera's coprocessor operations, Life Support queues,
paging, and the guest X11 display stream.

The target profile is `OG85-WEB-LOCAL`:

- the user supplies a licensed Genera 8.5 generation-zero VLOD locally;
- the user supplies the matching VLM Debugger locally;
- neither artifact is uploaded or incorporated into the public application;
- the WebAssembly engine implements the Ivory version 5 guest-visible architecture;
- browser Life Support provides only the services required by the selected world;
- the main Genera display remains a guest X11 protocol endpoint;
- persistent writes use a private local copy or overlay; and
- networking is absent by default.

The selected private artifact identities for research are recorded in the
[Ivory/VLM specification](ivory-i-machine-and-vlm-reimplementation-specification.md).
They identify the oracle but are not distributable application inputs.

## Compatibility levels and decision gates

| Level | Outcome | Confidence now |
| --- | --- | --- |
| `GW0-ISA` | Rights-safe Ivory interpreter passes synthetic instruction corpus | High |
| `GW1-WORLD` | Browser loads/maps the selected VLOD and debugger without executing | High |
| `GW2-COLD` | Browser reaches a functional Cold Load/VLM Debugger state | Medium |
| `GW3-BOOT` | Selected world completes boot and exposes its main X connection | Medium-low |
| `GW4-INTERACTIVE` | Genera Listener and core UI accept complete keyboard/pointer input | Medium-low |
| `GW5-PERSISTENT` | Private world/disk state saves, exports, recovers, and remains local | Low until Save World oracle closes |
| `GW6-MUSEUM` | Reproducible, hardened local-input browser release | Conditional on G0–G9 gates |
| `GW7-OPTIMIZED` | Optional dynamic translation with exact interpreter fallback | Later extension |

Three gates can stop or redirect the implementation:

- `DG-ENGINE`: choose generated C handlers, the older C emulator, or a new
  specification-derived interpreter.
- `DG-LIFE`: prove the minimum Life Support and coprocessor surface sufficient for
  the selected world.
- `DG-X11`: prove that a bounded browser X server can implement the request/event
  subset used by Genera.

Failure at a gate does not prove impossibility. It changes the next research task and
prevents an unsupported boot claim.

## Evidence codes

| Code | Meaning |
| --- | --- |
| `IMA` | Public I-Machine Architecture Specification revision 2 |
| `G85-SRC` | Licensed Genera source witnesses, summarized without source publication |
| `G85-RUN` | Exact preserved world and historical VLM harness observation |
| `PVLM` | Public VLM descendant at commit `55b2a3b1cf884f827d85829713587657c435cb29` |
| `WASM` | New browser implementation observation |
| `INF-WEB` | Browser design choice not attributed to Symbolics |
| `TODO-ORACLE` | Named unresolved differential probe |

## Candidate engine paths

### Path A — Generated public C handlers

The public VLM tree generates `stub/i*.c` instruction handlers from
`alpha-emulator/*.as` and Lisp translator inputs. Its active build links those
handlers with the emulator interface and Life Support.

Advantages:

- broad instruction coverage already expressed in C;
- generated source can be regenerated and audited;
- closer lineage to the public VLM execution path;
- easier differential symbol/opcode mapping.

Risks:

- generated C emulates Alpha register conventions and uses GNU-C-style control
  patterns;
- host-size, alignment, floating-point, signal, and `setjmp` assumptions need audit;
- public-fork behavior is not automatically the preserved historical profile;
- large dispatch functions may compile poorly to WebAssembly.

### Path B — Older portable `c-emulator`

The public tree also contains a roughly 10,000-line standalone C interpreter.

Advantages:

- explicit interpreter control flow and processor state;
- potentially easier to instrument and single-step;
- fewer generated-code dependencies.

Risks:

- it is not selected by the active public build;
- comments show incomplete or provisional host fault behavior;
- its release and instruction coverage may predate required VLM fixes;
- equivalence to the selected world is unproved.

### Path C — New specification-derived interpreter

Advantages:

- clean state model and WASM-first host ABI;
- simplest rights and portability story;
- conformance can be designed from the start.

Risks:

- highest implementation cost;
- easiest path to subtle trap, memory-cycle, stack-cache, and GC-barrier errors;
- duplicates working public implementation knowledge;
- delays Life Support investigation.

### `DG-ENGINE` decision procedure

Build the same rights-safe synthetic corpus for all viable candidates. Compare:

1. packed and full-word decode;
2. every legal and illegal opcode position;
3. operand addressing and pop order;
4. call/return, bind/catch, and multiple-value state;
5. every memory-cycle × tag class;
6. instruction and memory trap frames;
7. PHT and stack-cache transitions;
8. floating-point result, exception, and rounding state;
9. VLM-only instruction candidates; and
10. generated-code reproducibility.

Select Path A if it compiles without semantic rewrites and passes the corpus. Select
Path B only if it closes equivalent or broader behavior and its provenance gap is
bounded. Start Path C only if neither public path can be made deterministic and
conformant.

## Target architecture

```text
browser main thread
  UI shell, local file selection, canvas, accessibility
                       |
                       v
machine worker
  deterministic host scheduler
                       |
                       v
Ivory WebAssembly engine
  processor, stack cache, PHT, traps, memory cycles
                       |
         +-------------+-------------+
         |                           |
         v                           v
browser Life Support             guest X11 endpoint
  VLOD/paging/disks                 protocol parser
  communication areas              resources/events
  coprocessor services              canvas renderer
  clock/network policy
         |
         v
private browser storage
```

The initial implementation is planned as single-owner and message-driven. Historical
Life Support used multiple host threads, locks, and conditions; the browser may use a
deterministic event scheduler if differential traces show identical guest-visible
queue, signal, completion, and interrupt order. This is an `INF-WEB` implementation,
not a historical-threading claim.

## Investigation and milestone sequence

### G0 — Freeze profiles, evidence, and publication boundary

Deliverables:

- `OG85-WEB-LOCAL` profile manifest;
- hashes and byte sizes for the research-only world, debugger, historical VLM,
  configuration, and public VLM source;
- a public/private/generated disposition table;
- local-file handling threat model;
- native harness checkpoint set from launch through usable Listener.

Exit gate `G-G0`:

- the public application can be built without any licensed bytes;
- local artifact validation occurs before mapping or mutation;
- research fixtures stay ignored; and
- native checkpoints are repeatable from fresh private copies.

### G1 — Generate the rights-safe Ivory conformance corpus

Deliverables:

- assembler/fixture generator independent of licensed compiled functions;
- legal opcode vectors and explicit illegal holes;
- object/tag/memory-cycle matrices;
- initial and expected final processor-state records;
- native public-VLM and, where safe, preserved-VLM trace adapters;
- deterministic comparison format.

The corpus implements `IVY-W01` through `IVY-G01` from the processor specification.
It must include both `halt=057` and the guaranteed undefined `%halt=377` case.

Exit gate `GW0-ISA-A`: at least one native engine passes all architectural vectors,
and disagreements are classified as fixture defect, profile delta, implementation
defect, or unresolved oracle.

### G2 — Complete `DG-ENGINE`

Deliverables:

- generated-handler WASM compile experiment;
- older C-emulator compile experiment;
- portability audit for integer widths, pointer casts, struct layout, unaligned
  loads, host floating point, signals, threads, and nonlocal jumps;
- instruction-boundary performance and trace comparison;
- written engine selection record.

Stop rules:

- do not patch away a semantic difference merely to make a test green;
- do not use the preserved world as the first opcode fixture;
- do not select an engine that cannot expose exact restart state;
- do not interpret “boots farther” as instruction correctness.

Exit gate `DG-ENGINE`: one reference WASM interpreter passes the complete synthetic
corpus and can snapshot/restore every guest-visible processor field.

### G3 — Specify and implement the world-memory substrate

Deliverables:

- VLOD v2 parser with overflow, bounds, parent, timestamp, and architecture checks;
- generation-zero load-map implementation;
- incremental-world parent resolver kept optional until required;
- 40-bit word storage preserving all tags/cdr codes;
- sparse virtual-memory mapping;
- wired, mapped, unmapped, and ephemeral region classification;
- PHT/page-request interface;
- VLM Debugger loader.

The selected base VLOD contains 6,690 blocks, 114 wired load-map entries, and
10,952,704 tagged Qs. Those observations are fixture constraints, not universal
format limits.

Exit gate `GW1-WORLD`:

- browser and native tools produce the same mapped-region and word hashes;
- malformed maps and parent mismatches fail before execution;
- no licensed content leaves local browser storage; and
- a snapshot round-trip preserves every 40-bit word.

### G4 — Inventory and specify communication areas

Deliverables:

- exact Boot, FEP, System, and Embedding area field maps;
- owner, direction, units, initialization, and lifetime for every field used by the
  selected boot;
- ring/queue schemas with producer/consumer and wrap rules;
- signal allocation, pending/live/reawaken masks, acknowledgement, and wakeup order;
- corruption and stale-completion behavior;
- native trace hooks at every queue and signal transition.

Required probes:

| Probe | Action | Claim closed |
| --- | --- | --- |
| `GQ-INIT` | Trace initialization before any worker is released | Initial values and publication order |
| `GQ-WRAP` | Drive a disposable synthetic queue through wrap | Full/empty and index arithmetic |
| `GQ-WAIT` | Delay one host completion while other signals arrive | Wait predicate and priority |
| `GQ-REMOVE` | Remove a handler with pending signal | Final acknowledgement and cleanup |
| `GQ-CORRUPT` | Inject invalid index in a synthetic public fixture | Failure containment |

Exit gate `G-G4`: a single-thread event model and the native threaded model produce
the same guest-visible transition trace for all probes, or the browser adopts the
minimum necessary worker/shared-memory structure.

### G5 — Close the minimum coprocessor surface

Deliverables:

- complete trace of coprocessor reads/writes from reset through Listener;
- register/operation inventory;
- per-operation inputs, outputs, commit point, retry behavior, signals, and host
  errors;
- browser service handler or explicit unsupported result;
- exactly-once test at every side-effecting commit boundary.

Start with boot-used operations, then classify the remaining public/source-visible
operations:

```text
required-for-boot
required-for-normal-operation
required-for-save-or-administration
optional-hardware/product
unknown/unobserved
```

Exit gate `DG-LIFE-A`: every boot-used operation has a tested browser implementation
or a documented native result proving it is not reached in the selected profile.

### G6 — Implement paging and virtual disks

Deliverables:

- page request/completion state machine;
- host paging store;
- virtual disk geometry and request queue;
- deterministic completion schedule;
- immutable base plus private overlay;
- backpressure, cancellation, and host-storage failure behavior.

The engine must distinguish:

- guest memory already mapped from the VLOD;
- host paging for evicted guest pages;
- guest-visible virtual disk blocks;
- VLOD/world persistence;
- temporary session swap.

Exit gate `G-G6`: native and browser issue the same page/disk transactions through
the first Cold Load checkpoint, and a host failure produces a bounded guest or
operator-visible failure without corrupting the active overlay generation.

### G7 — Implement clock, reset, signals, and Cold Load display

Deliverables:

- guest monotonic and time-of-day services;
- supervised local RFC 868-equivalent startup response if the selected world
  requires it;
- reset, high/low priority sequence-break, pause, resume, and stop state;
- Cold Load window renderer and input protocol;
- VLM Debugger command/input path;
- deterministic test-clock mode.

Time received by the guest is a recorded input. Browser wall time cannot enter
instruction tests implicitly.

Exit gate `GW2-COLD`: the selected world reaches a usable Cold Load/VLM Debugger state,
accepts a harmless read-only command, pauses/resumes, and reproduces the native
checkpoint trace.

### G8 — Inventory the Genera X11 protocol subset

Deliverables:

- byte-exact native capture from connection setup through representative core
  applications;
- parser inventory of every request/reply/event/error;
- visuals, depths, pixmap formats, colormaps, fonts, cursors, atoms, properties,
  selections, grabs, and extension probes;
- modifier and keyboard map transactions;
- ordering and sequence-number model;
- request corpus for a standalone test client.

The existing harness proves only a sensitive startup subset: selected server grabs,
modifier-map requests, `SetModifierMapping`, and ordinary guest traffic. It does not
establish the complete application-era X11 surface.

Exit gate `DG-X11`: every request in the selected trace is classified as required,
optional/fallback, or unsupported-with-observed-recovery, and the request corpus can
replay without the Genera guest.

### G9 — Implement a bounded browser X server

Deliverables:

- connection setup and resource-ID allocation;
- request decoder with strict bounds and byte order;
- windows, pixmaps, GCs, fonts, cursors, properties, atoms, selections, colormaps,
  and event masks required by `DG-X11`;
- expose, configure, focus, keyboard, pointer, and grab ordering;
- Canvas/WebGL renderer preserving logical pixels;
- deterministic server trace and framebuffer checkpoints.

The implementation is an X server endpoint, not a translation of Dynamic Windows or
CLIM into DOM widgets. Genera remains responsible for its UI.

Exit gate `G-G9`: the captured request corpus and a live native-VLM relay session
produce matching replies/events and logical framebuffer checkpoints.

### G10 — Complete keyboard and pointer integration

Deliverables:

- browser physical-event normalization;
- Symbolics keymap including Control, Meta, Super, Hyper, Shift, Symbol, Function,
  Help, Select/System, Network, Complete, Abort, Resume, and other selected keys;
- byte-exact modifier-map behavior expected by the guest;
- on-screen keyboard and remapping for browser-reserved gestures;
- pointer motion/button/grab/focus handling;
- event provenance viewer.

Exit gate `G-G10`: enumerate and inject the selected X keyboard and pointer maps,
verify modifier chords and focus/grab transitions, and execute a harmless Listener
and Zmacs input workflow with the same guest-visible events as native.

### G11 — Complete boot to the main Genera UI

Deliverables:

- automated semantic boot markers;
- native-versus-browser processor, communication, coprocessor, page/disk, X, and
  input traces around each marker;
- bounded diagnostic bundle on divergence;
- stable Listener-ready snapshot for testing, not public distribution.

Exit gate `GW3-BOOT`:

- three fresh boots reach the same selected system identity and Listener state;
- no unknown coprocessor or X request was treated as success;
- all host queues are internally consistent at idle;
- the base VLOD and debugger remain unchanged; and
- licensed snapshots remain local and disposable.

### G12 — Interactive core workflow

Deliverables:

- run/pause/resume/reset controls;
- integral display scaling and full-screen presentation;
- input-capture escape and accessibility shell;
- synthetic Listener, editor, Inspector, Help, file, and window workflows;
- reviewed logical framebuffer and semantic result checkpoints.

Exit gate `GW4-INTERACTIVE`: the browser completes the defined workflow with
equivalent values, guest event traces, activity/window transitions, and logical
pixels for the selected states.

### G13 — Persistence and Save World investigation

This milestone begins with an oracle, not an implementation claim.

Deliverables:

- disposable private-world Save World probe;
- complete coprocessor, file, page, disk, and hash trace;
- identification of every modified artifact;
- success, failure, and interrupted-commit state;
- browser persistence design chosen from the result.

The browser storage model still uses immutable base plus versioned private state, but
it must distinguish:

- VLOD changes requested by Save World;
- virtual disk changes;
- paging/session state;
- browser-level suspend snapshot;
- exported recovery bundle.

Exit gate `GW5-PERSISTENT`:

- native successful Save World is independently established;
- the browser reproduces its durable artifacts and guest acknowledgement;
- crash injection yields a previous or new valid generation;
- resume from a browser snapshot is never mislabeled as a historical Save World; and
- export/import validates all parent and base identities.

### G14 — Networking as an optional profile

Deliverables:

- offline default that satisfies guest boot without an external route;
- local RFC 868 response if still required;
- browser packet queue matching Life Support;
- explicit broker framing for optional Ethernet/Chaos/IP traffic;
- origin, peer, protocol, size, and rate policy;
- loopback-only conformance environment.

Exit gate `G-G14`: ordinary offline use emits no network traffic beyond loading the
application itself; optional loopback traffic matches native packet and signal order.

### G15 — Hardening, performance, and release

Deliverables:

- fuzzing of VLOD maps, X requests, disk imports, queue messages, and save manifests;
- memory ceilings and controlled out-of-memory behavior;
- no licensed content in logs, crash reports, caches exposed to the site, or build
  artifacts;
- instruction and subsystem profiling;
- reproducible build;
- browser compatibility matrix;
- `GW0`–`GW6` conformance report showing every open gate.

Exit gate `GW6-MUSEUM`: a user can load their own validated licensed artifacts,
operate the selected world locally, persist only private state, and reproduce the
declared conformance report without any licensed input entering the public build.

### G16 — Optional dynamic translation

Interpretation remains normative. Candidate translated blocks terminate at:

- instruction or memory exceptions;
- page/PHT activity;
- stack-cache scroll;
- allocation or GC transport;
- preemption checks;
- calls, returns, binding/catch cleanup where restart state changes;
- coprocessor operations;
- code or mapping generation changes.

Each block records source guest PCs, word/tag hashes, memory-map generation,
assumptions, and exact deoptimization state.

Exit gate `GW7-OPTIMIZED`: interpreter and translated modes pass randomized
instruction, trap, boot, and application differential traces, including mutation
and forced deoptimization.

## Required browser Life Support services

The final table is produced by G4–G7. The present planning classification is:

| Service | Minimum profile | Evidence status |
| --- | --- | --- |
| VLOD and debugger mapping | `GW1` | Format and selected artifact mapped; browser implementation pending |
| Guest paging | `GW2/GW3` | Public source structure known; queue/order oracle pending |
| Virtual disks | `GW2/GW3` | Public structure known; selected boot trace pending |
| Boot/FEP/System areas | `GW2` | Layout partly closed; field lifecycle audit pending |
| Coprocessor | `GW2`–`GW5` | Architectural instructions known; complete operation semantics open |
| Cold Load display | `GW2` | Native path known; browser renderer pending |
| Main X display | `GW3/GW4` | Relay established; complete request subset open |
| Clock/RFC 868 | `GW2/GW3` | Selected harness behavior known; browser ordering pending |
| Network packet queues | optional `G14` | Native structure known; browser policy and trace pending |
| Save World | `GW5` | Source path known; successful native oracle still open |
| Host shutdown | `GW6` | Historical deadlock observed; safety-corrected browser path needed |

## Conformance suites

| Suite | Coverage |
| --- | --- |
| `GT-ISA` | `IVY-W01`, `F01`, `O01`, `S01`, `B01`, `C01`, `U01`, `M01`, `P01`, `G01` |
| `GT-WORLD` | VLOD headers, maps, parents, 40-bit words, debugger placement |
| `GT-QUEUE` | init, wrap, full/empty, signals, wait/wakeup, removal, corruption |
| `GT-COPROC` | every selected read/write, exact once, retry, host failure |
| `GT-PAGE` | mapped/wired/unmapped, request order, storage error, cancellation |
| `GT-COLD` | reset, debugger load, read-only command, pause/resume |
| `GT-X11` | request parsing, resources, ordering, errors, events, grabs, pixels |
| `GT-INPUT` | complete keymap, modifier map, reserved chords, pointer/focus |
| `GT-SAVE` | Save World success/failure/interruption and browser generation commit |
| `GT-END` | cold boot through Listener and defined application workflow |

Each test records the exact profile and keeps `PVLM`, preserved historical binary,
licensed source, and selected world observations separate.

## Performance and memory investigation

No browser performance claim is made yet. Measure in this order:

1. resident 40-bit memory representation overhead;
2. VLOD load and page-fault working set;
3. generated-handler versus C-interpreter instruction rate;
4. X request and framebuffer update volume;
5. communication queue and worker-message overhead;
6. persistence write amplification;
7. trace-disabled steady state.

Possible optimizations, after conformance:

- split tags and 32-bit payloads into compact typed arrays;
- cache translated virtual pages with generation invalidation;
- cache decoded instructions;
- batch X rendering without changing event/order boundaries;
- lazily map VLOD pages;
- use optional shared memory only when the deployment environment supports the
  required isolation policy and a message-based fallback remains tested.

## Risk register and stop rules

| Risk | Response |
| --- | --- |
| Generated handlers diverge from historical VLM | Differential corpus and explicit profile; never patch by intuition |
| C emulator is incomplete | Treat it as candidate evidence, not fallback authority |
| Coprocessor side effect repeats on retry | Record commit token and inject faults around every boundary |
| Single-thread scheduler changes queue semantics | G4 transition comparison; adopt workers only where required |
| X11 subset grows without bound | Trace representative core plus explicit optional-product profiles |
| Browser memory is insufficient | Measure working set early; lazy mapping; stop before false boot claim |
| Save World semantics remain unclear | Keep persistence as browser snapshot/overlay and label it accurately |
| Shutdown historical binary deadlocks | Preserve observation; implement safety-corrected browser shutdown profile |
| Licensed bytes escape | Local-only input, isolated storage, redacted diagnostics, build scan |
| Network exposes unsafe services | Offline default and explicit bounded broker |

## Dependency graph

```text
G0 -> G1 -> G2(DG-ENGINE) -> G3
                          -> G4 -> G5(DG-LIFE-A) -> G6 -> G7 -> GW2
G7/G8(DG-X11) -> G9 -> G10 -> G11 -> G12
G5/G6/G11 -> G13
G12/G13 -> G15
G15 -> G14 optional
G15 -> G16 optional
```

G8 can begin alongside G3–G7 using the native harness. G13 must not begin until the
coprocessor and disk/page traces can distinguish Save World from unrelated private
file mutation.

## Definition of done and honest partial outcomes

The preferred completion is `OG85-WEB-LOCAL/GW6-MUSEUM`. It requires:

1. synthetic Ivory conformance;
2. validated local VLOD/debugger loading;
3. Cold Load and full main-display boot;
4. complete selected keyboard and pointer path;
5. correct paging, disk, communication, and coprocessor behavior;
6. explicitly labeled persistence semantics;
7. reproducible build and local-only licensed inputs;
8. offline-safe default and bounded failure behavior.

Useful partial outcomes may ship separately:

- `GW0`: a public Ivory ISA playground with synthetic programs;
- `GW1`: a rights-safe local VLOD map/inspection tool;
- `GW2`: a browser VLM Debugger/Cold Load research environment;
- `GW3`: a nonpersistent full-world boot demonstrator using local inputs.

Each partial release must state its missing level. A boot screenshot alone cannot
promote it to `GW4`, and a changed VLOD cannot promote it to `GW5`.

## Primary implementation references

- [Ivory I-machine and Open Genera VLM specification](ivory-i-machine-and-vlm-reimplementation-specification.md)
- [Ivory, FEP, and Open Genera VLM implementation layers](../ivory-fep-and-open-genera-vlm-implementation-layers.md)
- [World loads and VLOD](world-loads-and-vlod.md)
- [Genera computer-use harness](genera-computer-use-harness.md)
- Public VLM descendant at
  [`55b2a3b1cf884f827d85829713587657c435cb29`](https://github.com/LdBeth/osx-vlm/tree/55b2a3b1cf884f827d85829713587657c435cb29)
- Public I-Machine Architecture Specification identified in the processor spec

Last verified: 2026-07-27.

---
type: Implementation Roadmap
title: MIT CADR System 303 browser and WebAssembly implementation roadmap
description: A milestone-complete plan for porting the pinned System 303 CADR emulator to a deterministic, locally persistent, browser-hosted WebAssembly machine.
tags: [mit-cadr, lm-3, system-303, webassembly, browser, emulator, roadmap]
timestamp: 2026-08-01T20:55:00-04:00
---

# MIT CADR System 303 browser and WebAssembly implementation roadmap

## Status and reconstruction claim

The shortest faithful route to CADR in a browser is to port the existing `usim`
machine implementation to WebAssembly, not to translate Lisp source or compiled FEFs
directly. The selected machine profile is:

- LM-3 System 303 source check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`;
- `usim` check-in
  `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`;
- the repository's System 303-0 base disk and load-band profile; and
- the processor contract in the
  [System 303 macroinstruction and microarchitecture specification](cadr-macroinstruction-and-microarchitecture-reimplementation-specification.md).

The planned first public profile, `CADR-WEB-303`, boots the selected public system,
accepts the complete CADR keyboard and pointer vocabulary, displays the native
framebuffer at integral scale, persists a private copy-on-write disk, and can export
and re-import that private state. It starts offline and does not require a server
after its application assets have loaded.

The roadmap is complete for that profile. Hardware-cycle identity, physical tape,
PROM programming, external CADR debuggee control, and unrestricted historical
networking are later selectable profiles rather than hidden prerequisites.
Until its conformance gates pass, an implementation following this roadmap is not
claimed to be compatible with the selected System 303 profile.

## Compatibility levels

| Level | User-visible outcome | Required milestone gate |
| --- | --- | --- |
| `CW0-CORE` | Headless WASM executes CADR microinstructions deterministically | M0–M3 |
| `CW1-BOOT` | Selected disk reaches the known System 303 stable boot state | M4–M6 |
| `CW2-INTERACTIVE` | Native display, full keyboard, mouse, reset, pause, and resume | M7–M9 |
| `CW3-PERSISTENT` | Private disk overlay survives reload and exports atomically | M10 |
| `CW4-MUSEUM` | Audio, provenance, debugger, accessibility, and reproducible release | M11–M14 |
| `CW5-CONNECTED` | Explicitly enabled, isolated Chaos networking through a broker | M15 |
| `CW6-OPTIMIZED` | Optional macroinstruction or microinstruction block translation | M16 |

`CW4` is the primary completion target. `CW5` and `CW6` are independent extensions:
network access is not a prerequisite for faithful offline interaction, and
translation is not a prerequisite for correctness.

## Evidence and implementation rules

The normative language in this roadmap uses **MUST** and **MUST NOT** for conditions
required by the stated exit gate, **SHOULD** and **SHOULD NOT** for the preferred
implementation unless a documented equivalent preserves the contract, and **MAY**
for optional behavior. Historical observations are evidence, not normative
requirements, unless a selected compatibility profile incorporates them.

| Code | Meaning |
| --- | --- |
| `U-SRC` | Pinned public `usim` and System 303 source |
| `U-NATIVE` | Native `usim` trace from the selected disk and configuration |
| `U-WASM` | Browser/WASM trace from the same fixture |
| `RUN303` | Existing Xvfb harness observation under its recorded provenance |
| `INF-WEB` | New browser-host design choice, not attributed to CADR |
| `TODO-ORACLE` | Exact discriminating test still to be run |

Historical machine state and browser host state MUST remain separate. The WebAssembly
core owns CADR registers, memories, maps, devices, and guest time. JavaScript or
browser APIs own presentation, file selection, persistent storage, audio scheduling,
network brokerage, and page lifecycle. A browser callback MUST enter the machine
only through a typed host-adapter operation.

## Target architecture

```text
browser main thread
  canvas, controls, file picker, accessibility
              |
              | typed messages
              v
dedicated machine worker
  scheduler and host adapters
              |
              v
WebAssembly `usim` core
  microengine -> maps/memory -> CADR devices
              |
              +-> framebuffer dirty regions
              +-> disk block requests
              +-> keyboard/mouse FIFO
              +-> audio samples/events
              +-> optional Chaos frames

browser persistence
  immutable base identity + private block overlay + metadata journal
```

The machine worker is the only owner of mutable CADR state. The main thread never
reads or writes emulator memory directly. If shared memory is later adopted for
performance, ownership and commit markers remain identical to the message-based
profile.

## Repository workstreams

The implementation SHOULD separate these modules even if the exact filenames change:

| Workstream | Responsibility | Existing source boundary |
| --- | --- | --- |
| `core` | 48-bit engine, registers, A/M/PDL/dispatch/control stores | `l/usim/uexec.c`, `ucode.c`, `usym.c`, `udiss.c` |
| `memory` | Main memory, virtual maps, delayed MD and faults | `main-memory.c`, `uvmem.c`, `m32.c` |
| `devices` | Disk, IOB, bus, TV, color TV, tape, Chaos | corresponding `l/usim/*.c` device modules |
| `host-api` | Stable C ABI between WASM and worker | new inferred boundary |
| `worker` | Scheduling, browser lifecycle, request serialization | new browser code |
| `display` | Dirty-region upload, integral scaling, screenshots | TV data plus browser renderer |
| `input` | Physical browser event to CADR key/mouse event | existing keyboard maps and new policy |
| `storage` | Base image reader, overlay journal, export/import | disk-unit contract plus browser persistence |
| `audio` | CADR audio and optional VOTRAX profiles | `sdl3-audio.c` and documented device evidence |
| `network` | Offline stub and optional brokered Chaos | `uch11*` and explicit broker protocol |
| `conformance` | Native/WASM fixtures, trace comparison, release gates | processor spec and existing harness |

## Milestone sequence

### M0 — Freeze the target and golden artifacts

Deliverables:

- `CADR-WEB-303` profile manifest containing all pinned revisions;
- SHA-256 identities for the selected disk, microload/control-store inputs,
  configuration, keyboard map, and initial machine state;
- native build command and toolchain identity;
- immutable golden boot log and initial framebuffer hash;
- disposition record for every candidate artifact: public, generated, local-only, or
  unresolved.

Tasks:

1. Rebuild or verify the native `usim` from the pinned tree.
2. Run the existing System 303 harness from a clean private copy.
3. Record stable checkpoints: reset, microcode loaded, disk boot underway, first
   usable screen, and idle Listener.
4. Establish whether the exact distributable disk can be regenerated entirely from
   material with established license provenance. If not, the public browser requires
   local disk import even though the emulator is public.
5. Freeze a manifest schema before creating browser saves.

Exit gate `C-M0`:

- every input is identified and classified;
- native boot is repeatable three times;
- base bytes remain unchanged; and
- no unresolved artifact is silently placed on a public distribution path.

#### M0 implementation status

M0 is **closed** for the `CADR-WEB-303` local-import profile. The tracked
[`CADR-WEB-303` profile manifest](../../cadr-web/profiles/cadr-web-303.json) and
[`verify-cadr-web-profile.py`](../../scripts/verify-cadr-web-profile.py) now freeze
the selected source identities, artifact dispositions, constructed cold initial
state, runnable configuration template, and three-run golden series. Run:

```text
python3 scripts/verify-cadr-web-profile.py
```

The verifier is deliberately usable in a clean checkout. Local-only inputs are not
silently made distribution dependencies. Every present input must match its byte
length and SHA-256 identity, and artifact paths cannot be absolute or escape the
repository. `status: "ok"` means the manifest and present bytes are internally
valid. `milestone_ready: true` additionally means the three-run evidence validates
and no M0-scoped blocker remains open.

The selected local `disk-sys-303-0.img` has the same length as the current LM-3
Fossil unversioned disk but a different SHA-256 identity; its first differing byte
is at zero-based offset 1026. It therefore remains an unresolved, excluded local
import. M0 closes without treating it as redistributable: a public application must
ask the user to supply these exact bytes unless a separately licensed or
reproducible disk is established. The broader distribution-rights investigation
remains open, but it is not an M0 blocker because no unresolved payload enters the
tracked or public distribution path.

GCC 16.1.1 built the pinned `usim` source as the selected `x11-release` executable:
1,215,344 bytes with SHA-256
`a1d88a5b0ba3d477adfd8e3f9296ad282aa8a1fdc0118b3b27defeffafa53bd6`.
The audited host required `LDFLAGS=-no-pie` because its existing Chaos static
archive was not position independent. This host-specific exception is a portability
finding to remove, not part of the intended browser ABI.

The portable
[`cadr-web-303.ini.in`](../../cadr-web/profiles/cadr-web-303.ini.in) template is the
normative configuration source. The verifier expands only its fixed path
placeholders, parses the exact INI subset used by `ucfg`, and reduces a rendered
session configuration back to one canonical byte sequence. Its canonical SHA-256
is `86c5500509b1c18e67a3f74071069761a1725656cedf955858e5f46bff2bf3c4`.
The older `l/usim/usim-303-0.ini` is retained as historical repository material,
not asserted to be a runnable configuration for this selected parser and harness.

[`cadr-m0-golden.py`](../../scripts/cadr-m0-golden.py) made three fresh X11 sessions
with one fail-closed input schedule: make a new private disk copy, start with no
saved state, wait 25 seconds, press Return at the date-and-time prompt, wait two
seconds, enter `N` and Return, wait six seconds, capture `Lisp Listener 1`, and stop
normally within 45 seconds. All three recorded the candidate executable unchanged
at start and execution, used the same canonical configuration, left base and
private disks at SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`,
and stopped with exit status zero, no forced stop, and no incomplete-state flag.

The three 768 by 963 captures are byte-identical PNGs with SHA-256
`e5aedfcbbceaa1d83122c7a029697b5d8d0fd4f8def710f9ce5beb37a5788828`
and decoded-pixel SHA-256
`2c8985aaee1418cc43f0938f1b3ce2031bc624ee681a15de4f9da1fd28f94fda`.
The three selected X11 windows also agree on the observed title `usim`, geometry
`0,0 768x963`, screen zero, and generation one. The evidence-only boot
normalization is intentionally narrower than a guest boot trace: it retains the
ordered host-emulator phases actually present in the logs, from emulator and
device setup through power-on, boot request, stop, state write, and framebuffer
write. Its canonical SHA-256 is
`fbfaff07bf9293f745513cdcff9770d9dfec512add9005443ed4844bd6d2cf51`.
It does not claim reset, microcode-load, initial-PC, or guest execution
checkpoints; those belong to the M1 instruction oracle. Raw logs, screenshots,
private disks, and session paths remain under ignored `build/cadr-computer-use/`.

The initial-state identity is constructed rather than inferred from a saved-state
blob: the exact executable, canonical configuration, PROM and microcode inputs,
fresh exact disk bytes, exact `extra.hosts` bytes, pinned source revisions,
private-copy source-tree hashes, unchanged-copy flags, the generated private
filesystem-root layout, generation one, and `resume_requested: false` jointly
identify S0. The generated executable and filesystem root are classified
`generated-local`; incidental files beneath the private root are not silently
promoted into inputs. This closes `C-M0`; the 100,000-boundary instruction trace is
deliberately the separate `C-M1` gate.

### M1 — Define the portable core and host ABI

Deliverables:

- a platform-neutral core library build;
- `cadr_host_api.h` or equivalent versioned ABI;
- one headless native host using that ABI;
- compile-time rejection of direct X11, SDL, socket, filesystem, signal, or wall-clock
  calls from core modules.

The host ABI should contain explicit operations such as:

```text
read_base_blocks(request_id, first_block, count)
read_overlay_blocks(request_id, first_block, count)
commit_overlay_blocks(transaction_id, blocks)
present_framebuffer(generation, dirty_rectangles)
emit_audio(generation, guest_timestamp, samples_or_event)
emit_chaos_frame(frame)
monotonic_guest_tick()
log_event(category, payload)
halt(reason, recoverability)
```

Rules:

- callbacks that can complete asynchronously return a request identifier;
- guest execution yields until the matching completion is delivered;
- stale generation/request completions are rejected;
- no callback receives a raw mutable pointer with a lifetime beyond the call;
- a host failure becomes a typed machine-host condition, never an arbitrary partial
  write.

Exit gate `C-M1`: native headless execution reaches the same 100,001 outer
clock-slot boundary states `S0` through `S100000` as the pre-refactor build. This
includes inhibited slots, the same-slot polling schedule, canonical state hashes,
and every ordered mutation range. It does not silently equate a clock slot with a
retired microinstruction.

#### M1 implementation status

The M1 production core is present under `cadr-web/`. It provides an opaque machine
instance, fixed-width versioned records, typed status values, copied request and
completion payloads, reset generation invalidation, a real outer-clock-slot run
loop, instance-owned processor and memory state, and prefix-scoped bus/controller
models. The archive build audits exported symbols, mutable globals, undefined
dependencies, public-header resources, and direct host/backend dependencies.

Oracle gate `O1` is **closed**. The final disposable native oracle executable has
SHA-256
`b4d2d16351af5984a6229243c469a58af9fc24ba76a62b7bc6c7e51f12d56b2c`.
Three fresh, independently invoked captures each produced the same
24,000,792-byte, 100,002-record trace. Its SHA-256 is
`97c8dbf8d7bd0f3a896fecfdcb8161c5a2d2ad0a77b7c25d14c5091f21ecd0d5`;
its final boundary-chain hash is
`6df4eef12c062ae63b082d8428e0a966b8e85af00fa0745aebb801ca3f3ad791`,
and its validated identity bundle is
`5e31742c67576a291dc071b91673c5e4ef3952edb2a1d9c3081a4f4adbc01390`.
The selected profile SHA-256 is
`1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a`.
Each file contains `S0` through `S100000` plus one terminal record, and all three
accepted runs recorded zero uncontrolled external events.

The final capture revalidated its profile, source manifest, exact patch, executable,
canonical configuration, prepared source, input aggregate, and disk bindings.
Source, configuration, executable, inputs, and disk identities were unchanged across
capture. An opt-in NDJSON component dump emits all 60 canonical tagged scalars,
tree-root families 14, 1 through 13, and 15, device-root families 31 through 37,
and the state digest at selected boundaries including `S0`. The tracked validator
independently recomputes that digest. Enabling the dump did not change ordinary trace
bytes, and the 40-test oracle/codec suite passed its positive, negative, mutation,
identity, parser, checkpoint, and diagnostic-tamper cases. Those oracle results
alone do not prove production parity; the separate production comparison below
supplies that evidence.

The codec now requires exactly reserved identity TLVs 100 through 108 on `S0`,
derives their bundle, binds the header UUID to that bundle, and rejects those TLVs
on any other record. Comparison also requires the selected expected full bundle and
profile hash; a synthetically self-consistent trace for another profile therefore
fails selection. Native identity parsing rejects malformed half-byte pairs. General
event-range rendering remains deferred to M2; O1 claims only its implemented
boundary hashes, checkpoints, and selected-boundary component dump.

The source-grounded M1 sequence first freezes the pre-refactor oracle, then extracts
one tracked BSD-derived production core. The oracle is a disposable, exactly
patched copy of the pinned source; native and WebAssembly production hosts will
instead link the same reviewed `libcadrcore`. M1 ports all processor, memory, bus,
reset, and controller state plus every host-backed operation actually exercised by
the measured prefix. It does not fake an operation or shorten the gate merely to
defer complete disk integration to M4.

The boundary contract follows the pinned `uexec_step` order. PC pipeline advance
and delayed-MD completion occur before the inhibit test. `INHIBITED` therefore
means that class execution was suppressed; it does not mean the canonical state or
mutation range is unchanged. Likewise, zero enumerated mutation events makes no
claim that processor or latch state is unchanged. A successful bounded prefix uses
an explicit limit-reached terminal reason without synthesizing a guest halt.

Before the ABI version is frozen, its public vocabulary must use clock-slot budgets
and report both completed slots and executed microinstructions. The core, not the
host, issues requests; the host only drains typed descriptors and returns copied
completion bytes. Cold power-on, boot, and reset remain separate transitions.

`C-M1` is **closed for the frozen `CADR-WEB-303` prefix**. A fresh headless
production run completed 100,000 outer clock slots and executed 82,149
microinstructions. The fail-closed comparator matched all 100,001 boundaries,
`S0` through `S100000`, including every canonical state SHA-256, ordered mutation
SHA-256, first-mutation ordinal, mutation count, and executed/inhibited/halt flag.
It also has negative tests for a changed state digest, changed ordered-mutation
digest, wrong boundary count, missing or malformed selection arguments, and a
structurally valid self-consistent trace selected with the wrong identity bundle or
profile. The comparator requires both frozen selection digests on every invocation;
it does not infer the target from the trace being tested. It also rejects external
events, abort, failure, or guest-halt terminals, a missing, duplicate, or early
terminal, and malformed production boundary flags. The selected prefix must contain
exactly the expected boundaries followed immediately by one
`TERMINAL_COMPLETE`/`COMPLETE_LIMIT` record. Known ABI reserved fields are rejected
before execution or completion delivery mutates result, request, queue, generation,
or guest state. The two-machine interleaving test and forbidden dependency and
mutable-global audits pass.

The verified local build identities were:

| Item | Bytes | SHA-256 |
| --- | ---: | --- |
| `cadr-web/build/cadr-headless` | 64,176 | `fcbb7e7d51338c9faecf95e73545b2cdf681bbc4682958c020788d849b066b98` |
| `cadr-web/build/libcadr_core.a` | 71,516 | `2deb56c440bb15e5172c67e1142b5775283a3649bfb83170da6bd6c062af82cf` |
| frozen oracle trace | 24,000,792 | `97c8dbf8d7bd0f3a896fecfdcb8161c5a2d2ad0a77b7c25d14c5091f21ecd0d5` |
| ignored boundary witness | 20,674,527 | `34023f108424d9f9a92621f6e70dbf034d0235d6919f7b4a307864aee3e33c90` |

The exact selected inputs were configuration
`1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f`,
PROM
`2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6`,
PROM symbols
`e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d`,
microcode symbols
`9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a`,
and base disk
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The reproducible local command was:

```sh
cadr-web/build/cadr-headless \
  cadr-web/profiles/cadr-web-303.ini.in \
  l/sys/ubin/promh.mcr l/sys/ubin/promh.sym l/sys/ubin/ucadr.sym \
  l/usim/disk-sys-303-0.img 100000 \
  build/cadr-web-m1-final-boundaries.txt
python scripts/compare-cadr-web-trace.py \
  build/cadr-oracle/m1-identity-final-capture-1/trace.cdrtrc1 \
  build/cadr-web-m1-final-boundaries.txt \
  --expected-identity-bundle \
    5e31742c67576a291dc071b91673c5e4ef3952edb2a1d9c3081a4f4adbc01390 \
  --expected-profile-sha256 \
    1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a \
  --expected-boundaries 100001
```

This is a bounded M1 compatibility result, not M2 general tracing, snapshot, or
restore. Prefix-inactive disk payload service, tape, Chaos transport, color TV,
audio, and other later device behaviors remain explicit typed stubs until their
roadmap milestones.

### M2 — Establish deterministic instruction tracing

Deliverables:

- compact binary and human-readable trace formats;
- trace selectors for micro PC, decoded word, A/M source, destination, Q, VMA, MD,
  macro PC, faults, interrupts, and device transactions;
- deterministic trace hashing;
- snapshot and restore of all core-owned state at an instruction boundary.

The default trace MUST omit host paths and nondeterministic timestamps. Guest clock
and interrupt decisions are explicit trace events. A full trace can be large, so the
tooling needs range, event, and hash-only modes.

Exit gate `C-M2`:

- save/restore produces an identical continuation trace;
- two native runs with the same input schedule have identical trace hashes; and
- a deliberately perturbed ALU, byte, jump, and dispatch result is detected at the
  first differing boundary.

#### M2 implementation status

The ABI1.1 implementation now supplies the bounded `CDRGTRC1` trace producer,
semantic hash-only transport, and `CDRSNAP1` fresh atomic snapshot restore in
`cadr-web/`. This is a new portable-core reconstruction boundary, not a claim about
a historical CADR save format. Its normative record/state inventory, compound-slot
ordering, host hand-off rules, versioning, failure semantics, and test obligations
are in the [CADR-WEB-303 ABI1.1 tracing and snapshot specification](cadr-deterministic-tracing-and-snapshot-reimplementation-specification.md).

`C-M2` is **closed for the native portable-core and synthetic ABI1.1 profile**. The
implementation has focused tests for selector/event ordering, full
versus hash-only parity, raw-ring backpressure, terminal reservation, trace
cross-parsing, CDRSTATE2 mutation coverage and cache verification, CDRSNAP1
malformation rejection, queued-completion restoration, restore-continuation parity,
repeat-run trace identity, and the four injected M2 mutants. A clean `make test`
passed every C and Python gate, and the final production core again matched all
100,001 boundaries of the frozen M1 oracle. The exact commands, results, binary
hashes, remaining runtime unknowns, and conformance matrix are recorded in the
normative companion specification. These are implementation tests, not System 303
runtime observations, and do not close the M3 browser/WASM parity gate or expand the
selected historical compatibility claim.

### M3 — Compile and run the headless core as WebAssembly

Deliverables:

- reproducible WASM build;
- machine worker bootstrap;
- no-display, read-only-memory test runner;
- native-versus-WASM differential test command;
- explicit integer-width, sign, shift, byte-order, and overflow assertions.

Tasks:

1. Replace nonportable undefined C behavior before enabling optimization.
2. Represent 48-bit microinstructions in a stable 64-bit carrier with the high
   sixteen bits masked at every import/export boundary.
3. Audit host-size assumptions involving `long`, pointers, `time_t`, file offsets,
   and structure padding.
4. Compile without SDL/X11/Chaos host services.
5. Run every `CADR-U01` through `CADR-U05` conformance test from the processor spec.

Exit gate `C-M3`: all core conformance vectors and a minimum one-million-step boot
prefix match native boundary state exactly.

#### M3 implementation status

M3 is **closed** for the bounded `CADR-WEB-303/ABI1.2/M3` profile.  The tracked ABI1.2 work adds a bare
`wasm32` adapter and runtime, a dedicated-worker protocol, bounded streamed
verification of the excluded local disk, a fixed-width portability probe, native
and worker CDRSTATE1/2 transcript runners, U01--U05 processor vectors, and
reproducible-build plus Node/Chromium test entry points.  Its normative ownership,
integer rules, signed-carry portability decision, worker request tree, artifact
failure semantics, transcript grammar, and release-evidence requirements are in
the [CADR-WEB-303 ABI1.2 headless WebAssembly core specification](cadr-webassembly-headless-core-reimplementation-specification.md).

The release record in the companion specification closes U01--U05 under GCC and
Clang at O0/O2 and Wasm, the 100,001-boundary M1 identity regression, ABI1.2
snapshot continuation in both directions, Node worker and Chromium smoke tests,
the one-million-slot native/Wasm transcript gate, and the maintained-usim M3-P2
oracle.  It records the exact commands, local-input boundary, toolchain, artifact
and transcript hashes, and the selected browser version.  This closure is a
headless prefix claim; it does not extend to the M4 media profile below.

Direct native-usim observation established a forward dependency which the original
linear graph concealed.  The startup reaches the page-zero parity probe at raw
cycle 505,068, diagnostic control at 505,074, its first disk-status read at 505,078,
and its first disk START at 505,198.  The named `M4-D0` slice therefore covers every
real disk operation exercised through S1,000,000; substituting a synthetic
processor-only fixture would not close this gate.  The measured slice is narrower
than the rest of M4: seven register reads, nine writes, two interrupt-deassert
attempts, and no CCW, DMA, request, block, completion, or interrupt assertion.
Those validated zero media counts do not close the implemented media path.

The closed `C-M3` record remains deliberately narrower than an M4 claim: the
observed M3-P2 prefix has seven disk-register reads, nine writes, two interrupt
deassert attempts, and zero CCW, DMA, request, block, completion, and interrupt
assertion events.  A source build, portable-native self-comparison, or isolated
browser smoke was not used as a substitute for the named one-million-slot and
pinned-usim comparisons.

### M4 — Port disk-controller execution without persistence

Deliverables:

- asynchronous block-reader adapter over an immutable in-memory or streamed image;
- deterministic disk latency model;
- controller request/completion trace;
- malformed/truncated/wrong-image errors.

The first implementation may preload the image. The final interface MUST support
range reads so large images do not require duplication in JavaScript and WASM memory.
Controller timing is expressed in guest scheduler ticks, not fetch latency from the
browser cache.

Exit gate `C-M4-BOOT-MEDIA`: for the selected immutable System 303 image, native
and Wasm emit the same ordered register accesses, CCW reads, block requests and
completions, page-transfer witnesses, controller-state changes, and interrupts
from disk START through the first source-identified terminal boot-media read chain.
The release record names exact start and terminal predicates, leaves no pending or
orphaned host request, and proves the selected base-image SHA-256 unchanged.  This
is not a filesystem-mount claim.

`C-LMFS-MOUNT` is a later, separate `CADR-WEB-303-LMFS-OVERLAY` profile.  It uses
identified media containing the selected LMFS partition and a private copy-on-write
overlay; native and Wasm then reach `FILE-SYSTEM-RUNNING` with expected
`PACK-LIST` membership and identical ordered mount reads and writes, including
pack-header incarnation and clean-flag changes.  The base image remains unchanged
and every write enters the overlay.  It is neither an M3 result nor a prerequisite
for `C-M4-BOOT-MEDIA`.

#### M4 implementation status

M4 is **closed** for
`CADR-WEB-303/ABI1.3/C-M4-BOOT-MEDIA-v1`, the selected zero-latency controller
chain from the first disk START through S1,030,044. The implementation supplies
typed asynchronous range requests, a volatile boot-scratch overlay, exact replay
and stale-generation rejection, reset/detach/snapshot fencing, CDRSTATE4,
canonical media and controller witnesses, targeted faults, native and worker
runners, and a real-Chromium adapter smoke.

The release gate matched every one of the 1,030,045 native/Wasm boundary records,
the complete host actor schedule, and the 67-event/13-turn controller witness. An
independently rebuilt maintained-`usim` oracle repeated byte-for-byte, the selected
base and disposable copies remained unchanged, and GCC/Clang O0/O2 plus Wasm
O0/O2 emitted identical semantic artifacts. The M3 compiler matrix, M3
cross-target snapshot continuation, and full repository test target were rerun as
regressions. Exact commands, tool versions, hashes, selected-profile limits, and
nonclaims are in the
[ABI1.3 boot-media controller specification](cadr-boot-media-controller-reimplementation-specification.md).

This closure is not an LMFS mount, persistent overlay, nonzero-latency scheduler,
arbitrary disk command, full live-browser boot, or filesystem compatibility claim.
Those remain later profiles and milestones.

### M5 — Implement the deterministic machine scheduler

Deliverables:

- run-budget/yield loop in the worker;
- guest tick source;
- device event priority queue;
- pause, single-step, reset, stop, and bounded shutdown operations;
- tab-hidden and worker-termination policy.

State machine:

```text
NEW --cold-power-on--> CORE_RESET --boot--> PAUSED --start--> RUNNING
RUNNING --host request--> WAITING_FOR_HOST --completion--> RUNNING
RUNNING|WAITING_FOR_HOST --pause or hide--> PAUSED
RUNNING|PAUSED|WAITING_FOR_HOST --stop or shutdown--> STOPPED
RUNNING|WAITING_FOR_HOST --fatal status--> FAILED
```

The scheduler MUST NOT derive guest correctness from host frame rate. When a tab is
throttled, guest time either pauses or advances by an explicit configured policy;
the choice is recorded in the save metadata and trace.

Exit gate `C-M5`: injected simultaneous disk, clock, keyboard, and sequence-break
events reproduce the native priority and restart results.

#### M5 implementation status

M5 is **closed** for
`CADR-WEB-303/ABI1.4/C-M5-SCHED-v1`. The implementation supplies the
guest-boundary queue and selected I/O-board subset, fixed simultaneous-event
order, rational 60 Hz clock, protocol-v3 lifecycle, pause-on-hidden policy,
deferred boundary controls, M4 host-completion integration, CDRSTATE5,
CDRSNAP1 1.2 scheduler state, and the normative `CDRM5TR1`, `CDRM5Q1`, and
companion `CDRM5C1`/`CDRM5WK1` witnesses. Protocol v3 replaces and rejects the
legacy execution operations; it does not add scheduler behavior invisibly to
the frozen v1/v2 trees.

The portable gate is strong: native and Wasm repeated byte-identically through
boundary 565,536 under the selected simultaneous schedule, and the shared raw
`CDRM5TR1` v4 parser accepted the sidecars. Core scheduler, snapshot-corruption,
worker envelope, visibility adapter, Wasm export, parser, and differential
tests pass, including the complete M5 unit target. The worker protocol exits
normally. Its production batch-helper
fixture proves the exact one-slot-wait, chained zero-slot-wait, zero-slot-settle
sequence and proves fatal evidence is collected before an ordinary digest;
the actual core/Wasm test separately proves the staged-write-safe failure
digest. The closing pre-HALT ABI1.4 worker fixture reaches `FAILED` through the
real version-3 batch path, returns immediate `CDRM5Q1` and failed-state
`CDRSTATE5`, and proves the terminal `scheduler-state` co-reports those same
values with the actual two-record `CDRM5C1` chain. Exact schemas, hashes,
commands, and release evidence are recorded in the
[ABI1.4 scheduler specification](cadr-deterministic-machine-scheduler-reimplementation-specification.md).

This status is not a natural-host-arrival priority claim, complete keyboard or
pointer profile, historical real-time clock claim, renderer, Listener-ready
boot, filesystem, persistence, networking, full live-browser lifecycle, or
museum release. The patched maintained-`usim` capture proves only the named
instrumented reconstruction schedule. The closing commit is the repository
commit containing this status record; the specification binds the examined
source and tests by content hash rather than embedding a self-referential
commit identity.

### M6 — Reach a headless System 303 boot oracle

M6-DEVID1 is a separate, non-ready evidence-continuation profile: it preserves
the frozen M4 512-event record and commits later final events through `CDRM6E1`.
It deliberately disables snapshots and does not change this M6 Listener-ready
exit gate. See [the M6-DEVID1 disk-evidence continuation policy](cadr-m6-disk-evidence-continuation-policy.md).

Implementation foundation, not M6 closure: the M6-DEVID1-only C fast runner
advances bounded slots internally and returns `CDRM6FAST1` at the first
endpoint, debug delta, host wait, or terminal status. Its protocol-v4 wrapper
chains each stop with `CDRSTATE5` and `CDRM5Q1`; READY4 additionally binds the
selected target and `CDRM6E1` summary without changing READY3. Direct and
three-run campaign tools preflight all bytes before a worker exists, and their
receipt comparator requires legacy, O0 fast, and O2 fast identity equality at
1,130,000 slots before a measured O2 rate can support a twelve-hour projection.
Those tools have only synthetic/static validation at this revision, so this
does not alter the M6 exit gate or claim a READY4 campaign.

The production benchmark and READY4 supervisors now define the executable
source boundary rather than trusting the caller's checkout after validation.
The boundary covers the collector, campaign, evidence, validator, benchmark,
identity, direct and systemd runners; the headless driver; the worker and its
unconditional renderer and batch imports; the block service; the build files;
the selected core, adapter, runtime, include, and trace sources; and the
canonical release record. The outer process rejects any worktree byte that
differs from the selected commit, extracts that commit into a private stage,
builds there, rechecks the staged closure immediately before each launch, and
executes only the staged entrypoint and imports. Tests prove both a dirty
pre-stage executable and a changed staged executable fail closed.

Benchmark child results remain private and are not comparator inputs. A
separate outer receipt binds the actual transient-unit invocation and its
private nonce, validated effective policy and accounting, unit absence, private
root removal, and final shared-source-stage removal. Only that outer-attested
schema is accepted for the three-way comparison; setting the child environment
marker or presenting a plausible raw child record is insufficient. The
comparison and READY4 handoff also bind both the byte-exact canonical release
record and the input schedule derived from it. This is a control-plane and
provenance closure, not evidence that the private long benchmark or READY4
campaign has run.

Benchmark observation, 2026-07-30: the clean `a42cfd6` source closure completed
the outer-attested legacy/O0/O2 comparison with identical residue and state
receipts at 1,130,000 slots. Legacy took 2,572,494,326,894 ns, fast O0 took
85,978,795,596 ns, and fast O2 took 11,465,958,791 ns. The measured O2 rate was
98,552 slots/s and projected the selected READY4 bound at 9,985 seconds. The
private `benchmark.json` is 1,506 bytes with SHA-256
`d358fb32f2618b196b40c6409cf07d1510cd5a9188e18d69906c21b220448344`.
This validates the benchmark and performance handoff for that exact commit; it
does not close `CW1-BOOT`, and a final READY4 campaign must bind the later
joined M8--M13 source closure used by the museum release rather than silently
reusing this earlier benchmark.

Deliverables:

- automated WASM boot test;
- semantic boot markers independent of framebuffer pixels;
- captured Listener-ready state identity;
- bounded failure report containing the last state hashes and device transactions.

Exit gate `CW1-BOOT`:

- three clean boots reach the selected semantic marker;
- the expected macro/microcode and disk identities are visible in the test record;
- no host callback is pending or orphaned at idle; and
- a wrong or truncated image stops before guest mutation with a useful diagnostic.

M6-DEVID1 runtime status, 2026-07-29: the separate O2 evidence-continuation
canary completed at exactly 1,130,000 nonterminal clock slots, with 535
accepted disk events, 23 committed tail events, no outstanding host request,
an unchanged base disk, and verified unit/root cleanup. The private receipt is
18,609 bytes with SHA-256
`47131339865ae4c07eb4b88603d6feceb0c5889b7a9bc27cf30a9c3f4a1ec2ac`.
This closes the named continuation canary only. It does not supply READY4, a
Listener-ready semantic marker, or the three clean boots required by
`CW1-BOOT`; those M6 exit-gate obligations remain open.

Selected-image negative production observation, 2026-08-02 UTC: one execution
of the pinned-Node supervisor at repository commit
`8519fc3de65f8aba98a67842d1340c1374cc58a0` produced the canonical
`cadr-m6-selected-image-negative-supervised-v3` receipt
`selected-image-negative-8519fc3-20260802T005017Z.json`. The receipt is 9,575
bytes with SHA-256
`5159e672660285dcb252db65a325cb40c38037dd494f0607074ee520565cef0b`;
its accounting and effective-policy SHA-256 values are respectively
`f527a583b35abf1f61f3ffc0e7a629afa8fbec3a0d0daf476ca27b3d7a3a5833`
and
`a85b39ec4234494ffe7c353b1ac1b0c211f955cdf04b739502e2dfc809b97625`.
The supervised record sets `transient_unit_absent`, `source_stage_removed`, and
`private_root_removed` to true, records equal before/after base identities, and
sets `guest_execution_attempted`, `wasm_build_attempted`, and
`worker_constructed` to false with `materialized_image_bytes` zero. This closes
only the production wrong-image, truncated-image, pre-mutation negative
sub-obligation.
It is not READY4 or `CW1-BOOT`; the required three actual boots remain open.

Implementation evidence for this supervisor is pinned to systemd v261.1 commit
[`eff9446d505d62c075bed37d606860b38cfe51fb`](https://github.com/systemd/systemd/commit/eff9446d505d62c075bed37d606860b38cfe51fb).
Its `systemd-run` implementation resolves the executable before transient-unit
bus dispatch and serializes the resulting path plus literal argument vector
([`run.c` lines 2863--2888](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/run/run.c#L2863-L2888),
[`run.c` lines 1395--1439](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/run/run.c#L1395-L1439)).
Disabling environment expansion selects `ExecStartEx` and records the
`no-env-expand` execution flag
([`run.c` lines 1215--1223](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/run/run.c#L1215-L1223)).
`systemctl show` renders an exited status without a signal suffix and a signaled
status as number/name
([`systemctl-show.c` lines 1535--1559](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/systemctl/systemctl-show.c#L1535-L1559));
the pinned signal formatter spells every realtime signal `RTMIN+N`
([`signal-util.c` lines 148--161](https://github.com/systemd/systemd/blob/eff9446d505d62c075bed37d606860b38cfe51fb/src/basic/signal-util.c#L148-L161)).
The selected validator profile is intentionally nonportable: on its Linux
x86-64/glibc ABI it accepts realtime numbers 34 through 64 only as
`RTMIN+0` through `RTMIN+30`, not the inverse parser's `RTMAX` aliases.

### M7 — Render the CADR display

Deliverables:

- browser renderer for the native monochrome framebuffer;
- dirty-page or dirty-rectangle transfer;
- exact logical dimensions and bit order;
- integer scaling with nearest-neighbor sampling;
- full-screen and fit-to-window modes that letterbox rather than fractionally sample;
- raw framebuffer and displayed-pixel screenshot tests.

The logical framebuffer is the conformance surface. Browser chrome, CSS scaling, and
monitor density are host presentation choices. A “fit” mode may choose the largest
integer scale that fits; it MUST NOT blur one-bit fonts.

Exit gate `C-M7` has two independent required prongs: a known real-System-303
native framebuffer checkpoint has identical raw logical words and pixels at the
same portable Wasm guest boundary (`TODO-RUNTIME-M7-01`), and a real supported
browser proves ordinary-fit and user-gesture fullscreen presentation with every
source pixel preserved as an integral rectangle (`TODO-RUNTIME-M7-02`). Neither
prong alone closes the gate.

Implementation status, 2026-07-29: M6 remains ABI1.4/protocol-v4; M7 is
ABI1.5/protocol-v5. The M7 transfer and renderer implementation closes the synthetic
layout, dirty-transfer, lifecycle replacement, bit-order, polarity,
integer-presentation, O0/O2 Wasm, and direct-native-fixture checks. Its contract is recorded in
[the monochrome display and browser renderer specification](cadr-monochrome-display-renderer-reimplementation-specification.md).
`C-M7` remains open: the fixture is intentionally synthetic, no source-bound native
System 303 framebuffer checkpoint has yet been paired with portable Wasm at the
same guest boundary, and no real-browser ordinary/fullscreen capture has verified
integral presentation. `TODO-RUNTIME-M7-01` and `TODO-RUNTIME-M7-02` in that
specification define these separate obligations; completing the raw identity
oracle alone cannot close `C-M7`.

Failure-evidence hardening, 2026-07-30: the private P4 runner now preserves a
canonical, bounded status-12 M6 diagnostic when the portable machine terminates
before Form C, and preserves the frame, witness, frozen-release binding, and
identical-or-first-difference comparison when a later failure occurs after Form C.
The worker is executed from a private immutable staged JavaScript closure whose
only permitted Node built-in is `node:worker_threads`; token-aware import discovery
rejects commented, nonliteral, and non-local import evasions. The receipt calls the
two adapter-file hashes a `contemporaneous_adapter_observation`: they describe the
repository files present at execution time and are deliberately **not** claimed to
be the producing source of the already-built Wasm module. Executable provenance is
the bound Wasm byte hash at this gate; a reproducible producing-source closure is a
separate release-build obligation. These stronger failure receipts do not close
either runtime prong of `C-M7`.

Root-cause and intervention observation, 2026-07-30: an independent clean M5
O0 run reproduced the M7 failure exactly at boundary `1125883`, with terminal
status 12 and no post-call attempted boundary. Its private 22,140-byte failure
receipt has SHA-256
`a740226ac3da14ca265dc2fee94462667fe0f57972e80192d875c41d26fc7c10`.
The matching post-terminal witness records the frozen evidence array at
count/capacity 512 with overflow set, CPU guest-fault clear, canonical overflow
clear, and no outstanding disk operation. Source inspection establishes the
transition: the 513th evidence event returns `GUEST_FAULT`, and the disk
controller makes that the persistent machine status. This is inherited M5
diagnostic exhaustion, not a display fault.

The P4 runtime now selects a distinct `m7-devid` profile rather than changing
ordinary M7's snapshot contract or merely enlarging the fixed array. The
receipt-validated O2 composition canary crossed the former fault at the exact
boundary `1130000`: lifecycle remained runnable, persistent status and
outstanding request were zero, all 535 evidence events were accepted, 23 were
in the continuation tail, and source/private base identities were unchanged.
The ordinary final receipt was not published because the outer verifier
incorrectly recomputed the staged base-plus-selective-patch closure from all
candidate bytes. A separately committed, read-only recovery tool validated the
retained success envelope and outer accounting record and produced the explicitly
labeled 30,836-byte private recovery receipt with SHA-256
`5e5e389a3d7d536535066ab65209de6d6dedfad33cca0e3744bf6f08cf46ce4a`;
its committed recovery-tool revision is
`97a95ae62d779cfca5a8059b7679947ff21bb64a`, and its Wasm identity is
`a3537ccaa6e8c953060f2354c8f8678734fdd583e2bf635afc52a247bf42f986`.
This recovered-after-publication-failure evidence closes the specific
M7-plus-continuation intervention check, but it is not an ordinary final receipt
and does not close the long Form-C native/portable identity or
browser-presentation prongs of `C-M7`.

### M8 — Implement complete keyboard input

Deliverables:

- physical-event normalization layer;
- complete CADR key vocabulary including Control, Meta, Super, Hyper, Shift, Top,
  Greek, System, Network, Help, Break, Return, Rubout, and special function keys;
- on-screen keyboard for inaccessible or browser-reserved combinations;
- configurable physical mapping stored outside guest state;
- event-trace viewer showing physical event, normalized key, and delivered scan code.

Rules:

- matching uses physical `code` where position matters and explicit text input only
  where the CADR expects a character;
- browser-reserved chords have discoverable alternatives;
- keyup loss on focus change releases all host-held keys without inventing guest
  repeats;
- repeat is generated by the selected guest/host contract, not accidentally by both.

Exit gate `C-M8`: enumerate and inject every scan-code/key transition accepted by the
pinned maps and verify modifier chord press/release order against native `usim`.

Implementation status, 2026-07-30: M8 now has its complete 100-key physical
map, accessible onscreen surface, focus-loss all-up transaction, a shared
browser request-ID channel, and an installed dedicated v6 worker branch. The
ABI 1.8 M9 Wasm profile now transfers a strict 40-byte `CDRINP1` record only at
a completed core boundary, calls the selected keyboard IOB subset, and exposes
a post-delivery `CDRIOB91` observation. Generic scheduler kind `3` remains
closed. A disposable, exact native pre-IOB witness/driver patch prepares and
compiles against the pinned public source without launching a machine. `C-M8`
remains open until the all-100 browser/core trace and the source-mapped native
X11 subset are recorded and compared in their isolated runtime campaigns.
Source-unmapped descriptors and live shifted-key modifier chords remain
explicit native exceptions; the latter still require their own ordered chord
campaign. The static native build and direct-core tests do not close the
runtime gate.

### M9 — Implement pointer and interactive lifecycle

Deliverables:

- pointer motion, button, capture, and coordinate conversion;
- exact inside/outside clipping and button chord order;
- focus acquisition that does not consume the first intended guest click;
- pause/resume/reset confirmations and recovery UI;
- browser reload/close warning only when private state is dirty.

Exit gate `CW2-INTERACTIVE`: complete a synthetic Listener/editor/window workflow
through both native and browser machines with equivalent logical input trace,
framebuffer checkpoints, and Lisp results.

Implementation status, 2026-07-30: M9 now has tested EDGE32/capture/lifecycle
host contracts, accessible controls, a shared browser request-ID channel, and
an installed dedicated v6 worker branch. Its ABI 1.8 core ingress validates
generation and one shared ordinal per `CDRINP1`, maps EDGE32 after-state to the
selected mouse IOB words/readiness/vector subset, and deliberately rejects v6
snapshots because that input state is not in the M5 snapshot wire layout.
Generic kinds `3` and `4` remain rejected. The native oracle patch records
pre-IOB keyboard/pointer calls at a driver-selected post-M6-idle boundary. The
tracked strict `native-capture` and paired
`run-cadr-m8-m9-input-conformance.mjs` entry points make a bounded direct-driver
native pre-IOB campaign and browser worker/core campaign executable with fresh
private copies, provenance, and cleanup. The browser half retains distinct
expected and actual worker `CDRINP1` bytes and one actual post-core `CDRIOB91`
receipt for every record. The direct native driver does **not** traverse
Xvfb/XTEST, X11, or Cadet and therefore cannot close `C-M8` or `CW2`; its
records are never labeled X11-observed. No native session has been launched
for this change. A separate unexecuted
`run-cadr-m8-m9-x11-campaign.mjs` route selects a witness-enabled X11 `usim`
inside the existing Xvfb computer-use harness, gives all 100 mappings an explicit
source-bounded disposition, exercises pointer transitions, and retains
Listener/Zmacs screenshots plus shutdown provenance. Its native evidence still
requires a matched browser workflow. `CW2-INTERACTIVE` remains open until an isolated native
and browser Listener/editor/window campaign retains the same logical input trace,
framebuffer checkpoints, Lisp results, and required harness provenance. The public
preflight is `make -C cadr-web m8-m9-unit`; it is not the native/runtime oracle.

The committed campaign join now requires reciprocal O0/O2 provenance manifests
rather than accepting two independently plausible reports. It binds the same exact
11 source authorities, recursive import closure, selected media and O0/O2 executable
identities, direct start/end observations, M6 transcript/idle/mapping evidence, all
208 derived input states, all 100 key transitions, and the exact worker-message
suffix. A rights-safe synthetic M6 producer exercises that join without private
media. This closes the report-composition and provenance mechanism only; the live
direct and X11 campaigns described above remain unexecuted.

### M10 — Add private persistent disk overlays

Deliverables:

- immutable base image identity;
- sparse block overlay;
- journal with schema version, generation, base hash, dirty set, and commit checksum;
- atomic save generation;
- import/export format and verifier;
- explicit discard, clone, compact, and recover operations.

Commit order:

1. validate base and current overlay generation;
2. write new/changed blocks under a new generation;
3. verify block hashes;
4. write and verify the generation manifest;
5. atomically advance the active-generation pointer;
6. only then report durable success to the user.

Browser termination before step 5 leaves the previous generation active. Base media
is never writable. Guest writes can be acknowledged before durable host commit only
if the UI clearly distinguishes machine-completed from browser-persisted state and a
later flush is mandatory.

Exit gate `CW3-PERSISTENT`: power-loss injection at every commit step yields either
the old complete generation or the new complete generation, never a mixed disk.

#### M10 implementation status

M10 is closed for the selected
`CADR-WEB-303/ABI1.5/protocol-v6/C-M10-PERSIST-v1` synthetic opaque-page
profile and `CW3-PERSISTENT/process-loss`. The browser controller performs real
radix-tree copy-on-write planning under a durable writer lease acquired before
the active snapshot, stages and verifies immutable objects before
guest completion, publishes the head and activation in one strict IndexedDB
transaction, and terminates/replaces the worker into `IN_DOUBT` recovery if
publication becomes uncertain after guest advance or the host-complete response
is lost. The existing worker
host-request protocol is the integration surface; no private-disk state is
added to the worker.

The maintenance surface supplies strict canonical overlay export/import,
discard-to-base, clone-to-new-UUID with a mandatory destination replacement
callback and cleanup on failure, epoch/head-conditional durable
unreachable-object compaction, and
bounded recover/reopen. A disposable Chromium campaign passes abort, worker
termination, and reload at all six durable seams. A separate host supervisor
also killed the complete Chromium process group with `SIGKILL` at each seam
and restarted the same profile: the three pre-publication seams selected the
complete old generation and the three post-publication seams selected the
complete new generation. It additionally ran the production controller and IDB
adapter in a dedicated Worker whose synchronous probe blocked in `Atomics.wait`
while the stage and head transactions retained outstanding requests. Two repeated
eight-kill runs selected complete old state at both barriers. The guest endpoint in
this campaign is an explicitly synthetic protocol responder, not production
`cadr-worker.js` or a running CADR Wasm machine. The host independently hashes the
exact selected base and serves its actual requested pages; it does not attest that
identity while serving unrelated fixture bytes.

This process-loss result is not physical machine or storage-device power
removal, device-cache-loss evidence, quota exhaustion, LMFS transaction
compatibility, or a private System 303 media run. Those stronger claims remain
separate from the closed browser process-restart gate.

### M11 — Audio and speech profiles

Deliverables:

- core audio event/sample stream;
- browser audio adapter with guest timestamps and bounded buffering;
- deterministic capture mode independent of realtime playback;
- documented profiles: base CADR sound, optional restored audio, and VOTRAX speech.

Unknown physical-device behavior remains selectable. Silence is acceptable only in a
declared `NO-AUDIO` profile; it cannot be reported as complete hardware emulation.

Exit gate `C-M11`: deterministic sample/event hashes match the selected native
software model, and pause/resume neither duplicates nor loses queued guest events.

Implementation status, 2026-07-30: M11 now has a machine-owned core mapping for
IOB `0764110`, pointer-free `CDRAUDS1` queue-state save/restore, an isolated
protocol-v7 M12-Wasm subhandler, deterministic fixed-table signed-16 PCM, and a
bounded AudioWorklet queue/acknowledgement bridge. Strict C, Node, and O0/O2 Wasm
tests pass. The v7 path composes M8/M9 `CDRINP1` ingress before M11 post-slot
beeper events and keeps their sequence domains separate. The M12 direct-Wasm
`CDRM12S1` envelope stages frozen `CDRSNAP1`, `CDRAUDS1`, and `CDRM12C1` in that
order and rolls back before publication on any malformed component. Bare
`CDRSNAP1` does not include audio state, and protocol-v7 generic restore remains
blocked on M9 continuation. A source-bound System 303 session evaluated
`(SI:%BEEP 500. 100000.)` and retained 199 ordered job/PCM pairs; the independent
`CDRM11FIX2` clean-room oracle also closes narrow `C-M11-04-PCM` across native
O0/O2 and freshly rebuilt selected-M12 Wasm O0/O2. These results do not exercise
selected-Wasm browser playback, pause/device-loss semantics, Votrax serial output,
or a guest-generated browser audio workflow, so full `C-M11` remains open.

### M12 — Debugger, trace, and preservation controls

Deliverables:

- register/memory/control-store inspector;
- micro and macro single-step;
- breakpoints and trace filters;
- machine-state export for bug reports without disk contents;
- provenance panel showing all public artifact hashes and browser build identity;
- opt-in local diagnostic bundle with privacy review.

The museum debugger controls this emulator instance. It MUST NOT be confused with the
historical `CC` console, whose full profile assumes a separate debuggee.

Exit gate `C-M12`: each control stops at the documented boundary and resume produces
the same continuation as a run with the equivalent preinstalled breakpoint.

Implementation status, 2026-07-30: a narrow cumulative M12 ABI 1.10/protocol-v7 profile has a
real one-slot core adapter, source-bounded QMLP/DMLP candidate-loop map, O0/O2 Wasm
export checks, an installed closed v7 worker branch, and pointer-free `CDRM12C1`
breakpoint-configuration save/restore through direct Wasm and the worker. Direct
generic M12 Wasm snapshots now use `CDRM12S1`: restore stages `CDRSNAP1`, adopts
`CDRAUDS1`, validates `CDRM12C1`, and only then publishes the replacement while
staling old audio cursors and inspector leases. Malformed-envelope and successful
publication tests pass in O0 and O2 without changing lower snapshot formats. A separate
public-usim candidate-loop witness prepared and compiled without being run. Native
and worker tests establish the selected source-level
M8/M11 order, but not a runtime observation. Generic snapshot configuration
composition is closed at the direct-Wasm boundary; M9 protocol-v7 continuation,
a selected load-band macro trace, and historical console behavior remain open;
`C-M12` remains open.

### M13 — Hardening and accessibility

Deliverables:

- fuzz tests for disk imports, configuration, save manifests, and host messages;
- resource ceilings and clean out-of-memory handling;
- keyboard-only host controls;
- accessible labels and status announcements outside the guest framebuffer;
- no network by default;
- content-security and dependency inventory;
- worker-crash recovery that never labels volatile guest state as saved.

Exit gate `C-M13`: malformed host inputs cannot write outside their overlay, mutate
the immutable base, issue network traffic, or wedge the page without a bounded stop.

Implementation status, 2026-07-30: committed evidence E23 through E26 loads the
selected M12 O2 Wasm in the real worker, exercises a bounded synthetic M10
composition, dispatches a synthetic M4 write through the real M13 shell/M10
controller seam, and boots selected base media to the first real host wait at tick
1,029,735. The selected-media witness services one base-equivalent block-1 write;
it reports `durable:true, changed:false`, creates no overlay page, and a fresh
controller rereads the same base bytes. These are bounded worker, dispatch, and
selected-base observations. They do not prove changed-overlay persistence, a
complete composed M8--M12 workflow, final accessibility, or the full F06/F07 failure
algebra, so `C-M13` remains open.

### M14 — Reproducible museum release

Deliverables:

- deterministic build manifest and source map policy;
- browser compatibility test matrix;
- offline application packaging;
- user guide covering import, controls, save/export, reset, and rights boundary;
- release conformance report for `CW0`–`CW4`;
- generated artifacts carrying their exact source/license provenance.

Exit gate `CW4-MUSEUM`: a clean checkout can build the same logical WASM artifact,
load only policy-permitted inputs, pass all conformance gates, and complete the
guided smoke workflow without a network.

Scaffolding status, 2026-07-30: the tracked
[M14 release note](cadr-web-reproducible-museum-release-scaffolding.md) and
`cadr-web/release/` policies define a deterministic logical manifest, complete
source map, closed no-network package, three-engine evidence matrix, rights
inventory, and deterministic guide/report generators. The scaffold omits the
final Wasm/worklet and leaves CW0–CW4 and all browser rows `not-evaluated`. It
is not a CW4 claim.

### M15 — Optional isolated Chaos networking

Deliverables:

- versioned WebSocket or WebTransport-style frame-broker protocol;
- explicit address and peer policy;
- offline loopback fixture;
- packet capture with guest and broker timestamps;
- rate, size, origin, and peer limits;
- UI that makes connection and remote peers visible.

The browser never receives raw host networking privileges. The broker MUST NOT expose
the historical EVAL, file, remote-disk, or debugging services to untrusted peers by
default.

Exit gate `CW5-CONNECTED`: a loopback-only synthetic peer passes packet-order,
retransmission, disconnect, and malformed-frame tests; external connection remains
an explicit user action.

### M16 — Optional dynamic translation

Interpretation remains the reference. Optimization proceeds only after `CW4`.

Candidate tiers:

1. cache decoded 48-bit microinstructions;
2. translate straight-line microinstruction blocks terminating at jumps, dispatch,
   memory faults, interrupts, device accesses, OA modification, or writable-control-
   store operations;
3. translate stable macroinstruction blocks while preserving a microcode fallback.

Every translated block carries:

- control-store and code generation numbers;
- source PC range and decoded-word hash;
- assumptions about maps, interrupt checks, and restart phase;
- deoptimization exit mapping to exact interpreter state.

Exit gate `CW6-OPTIMIZED`: randomized and application workloads produce identical
boundary traces with translation enabled and disabled; control-store writes and code
mutation invalidate all affected blocks before reuse.

## Complete conformance matrix

| Suite | Required coverage |
| --- | --- |
| `CT-CORE` | Processor-spec `CADR-D01`–`D04`, `M01`–`M03`, `U01`–`U05` |
| `CT-BOOT` | Reset, ROM/control-store selection, disk boot, filesystem, Listener |
| `CT-SCHED` | Simultaneous events, pause, yield, retry, reset, stop |
| `CT-DISPLAY` | Bit order, stride, dirty regions, clipping, integral scaling |
| `CT-INPUT` | Every key transition, modifier chord, repeat, focus loss, pointer edge |
| `CT-STORAGE` | Block bounds, stale generation, crash injection, import corruption |
| `CT-AUDIO` | Event/sample identity, underflow policy, pause and deterministic capture |
| `CT-NET` | Offline guarantee, broker framing, loopback, disconnect, abuse limits |
| `CT-END-TO-END` | Listener evaluation, compile/disassemble, editor, window workflow |

Each differential test records the same logical fixture and input schedule for
`U-NATIVE` and `U-WASM`. Pixel comparison alone cannot close processor, scheduler,
storage, or input-routing claims.

## Performance plan

Performance work follows correctness:

1. measure microinstructions per guest second and worker yield overhead;
2. reduce trace and framebuffer transfer when disabled or unchanged;
3. batch disk and display operations without changing guest-visible completion;
4. profile memory-map and dispatch hot paths;
5. add decoded-instruction caching;
6. consider block translation only after profiling proves need.

Release performance targets should be expressed as a usable interaction envelope on
named browser/device classes, not as a claim of historical CADR cycle accuracy.

## Failure, recovery, and stop rules

| Risk | Mitigation and stop rule |
| --- | --- |
| Undefined C behavior changes WASM state | Differential trace; stop optimization at first divergence |
| Disk asset rights unresolved | Require local import; do not delay emulator work or bundle the image |
| Browser throttling changes guest time | Explicit pause/advance policy and scheduler trace |
| Reserved shortcuts make keys unreachable | On-screen keyboard plus remapping; exhaustive key test |
| Persistence reports false success | Two-phase generation commit and crash injection |
| Network recreates unsafe historical services | Offline default and narrowly scoped broker |
| Translation hides interpreter defects | Interpreter remains reference and every block deoptimizes exactly |

## Open questions, limitations, and nonclaims

The selected disk's redistribution provenance remains unresolved, so the public
profile requires exact local import. Browser scheduling is not claimed to reproduce
CADR wall-clock timing, and the initial interpreter is not claimed to reproduce
hardware-cycle timing. M15 networking and M16 translation remain separate extension
profiles even after the offline museum profile is complete. Each milestone retains
its explicit `TODO-ORACLE` items until the named comparison has actually run; a
planned test or passing static build is not a runtime compatibility result.

## Work packages and dependency graph

```text
M0
└─ M1 -> M2 -> C-M3 (closed) -> C-M4-BOOT-MEDIA -> M5 -> M6
                                  └─ C-LMFS-MOUNT (later overlay profile)
                                                                  ├─ M7 -> M8 -> M9
                                                                  └─ M10
M7/M9 ─> M11
M2/M6/M9/M10 ─> M12 -> M13 -> M14
M14 ─> M15
M14 ─> M16
```

M7 and M10 can proceed in parallel after the disk/controller boundary is stable.
M15 and M16 never block the offline museum release.

## Definition of done

`CADR-WEB-303/CW4-MUSEUM` is done when:

1. the selected System 303 profile boots reproducibly in a browser worker;
2. native and WASM processor/device traces pass the declared differential suites;
3. every CADR key and pointer operation is reachable;
4. the logical framebuffer is pixel-identical at selected checkpoints;
5. private disk state is crash-consistent, exportable, and tied to an immutable base;
6. pause, reset, failure, and worker termination cannot be mistaken for saved state;
7. the default build performs no network traffic;
8. all bundled artifacts have established distribution provenance;
9. the build and conformance report are reproducible; and
10. remaining physical-device or timing gaps are named optional profiles.

## Primary implementation references

- [System 303 processor specification](cadr-macroinstruction-and-microarchitecture-reimplementation-specification.md)
- [CADR microcode, microassembler, and console debugger](cadr-microcode-microassembler-and-console-debugger.md)
- [CADR computer-use harness](cadr-computer-use-harness.md)
- [TV window-system specification](tv-window-system-reimplementation-specification.md)
- Pinned `usim` modules under repository `l/usim/`

Last verified: 2026-07-30.

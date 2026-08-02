---
type: Implementation Roadmap
title: MIT CADR System 303 browser and WebAssembly implementation roadmap
description: A milestone-complete plan for porting the pinned System 303 CADR emulator to a deterministic, locally persistent, browser-hosted WebAssembly machine.
tags: [mit-cadr, lm-3, system-303, webassembly, browser, emulator, roadmap]
timestamp: 2026-08-02T10:26:15-04:00
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
and re-import that private state. Its intended default starts without a network
dependency after its application assets have loaded; the runtime no-network claim
remains an M13/M14 gate, not current scaffold evidence.

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

Later source-grounded failure observation, 2026-08-02: the retained P4 session
`m7-p4-6d768e3efc634183aba025c9a13f109b`, bound to M6 report
`137b28193d13b6b6f7a1fd473da4e91baf9ba085597a2899f768657adfc374ac`,
reached boundary `1352885` and microinstruction `1262797` before its
CDRM7U1 site-3 guarded-bus read rejected physical word `017772045` with a zero
result. The pinned [System 46 PROM source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lcadr/ucadr.683#L2200-L2211)
reads that exact physical word, branches cold when bit 5 is clear, and then reads
the keyboard data word to distinguish RETURN from RUBOUT. The CADR bus formula
maps the physical word to IOB CSR `0764112`; the selected maintained
[`usim` `iob.c`](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d&name=iob.c&ln=222-228)
returns the CSR latch at that address, and the pinned [System 46 IOB
description](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/iob.9#L35-L50)
defines CSR bit 5 as Keyboard Ready. The narrowly selected compatibility repair
therefore admits only that M7 physical **read** through the pre-existing bus/IOB
route. It does not admit an IOB range or a write, keeps the M3 prefix fail-closed,
and does not close either M7 runtime prong.

Subsequent source-grounded failure observation, 2026-08-02: the clean authority
session `m7-p4-d9c4a33528164d79859a2a920d6cf411` retained a complete native Form-C
frame, then terminated the portable M7-DEVID run at boundary `1364498` and
microinstruction `1271773`. Its canonical M6 failure record has SHA-256
`46ad5bfddf8a48d3e1acd5df002ab8d7f984d31dbf6cc3831026c2ce2b91926e`;
the diagnostic wire record has SHA-256
`01b09b9982e5027ead1890d5186cf820d1d9e791f9c4d67d530cda90987ab966`
and reports a site-4 write of `0xffffffff` to physical word `017051765`.
The pinned `usim` `uvmem.c` source explicitly uses that address as its TV-remap
example; its bus adaptor maps the complete `017000000..017077777` 32K-word range
to the monochrome TV backing store. The portable lower bus and TV model already
implement the same range and canonical state update. M7 therefore admits exactly
that source-defined range, for reads and writes, through the normal bus route;
adjacent Xbus space and the pre-M7 profile remain fail-closed. The native transcript
does not serialize every bus transaction, so this classification is a pinned-source
conclusion rather than a claim that the same-boundary native write was captured.
This repair still does not close either M7 runtime prong.

Effective-page identity hardening, 2026-08-02: the default-disabled P4
companion now preserves the original M4 LBA-1 commit and exact replay first,
then, only after the exact selected boot suffix and a reason-1 quiet record at
or after boundary `1030044`, can acknowledge one strictly newer,
byte-identical one-block write anywhere within the selected base. LBA 1 is
checked against the effective overlay; all other LBAs use an overflow-safe
bounded base read. M6, not the block service, creates the public receipt after
successful completion, an independent effective-page reread, and exact linkage
to unique adjacent `CDRM6HS1` issue/completion records for the candidate and
all three arm operations. The validator independently receives the expected
base identity, checks page bounds, and derives the canonical overlay root from
that base plus the authoritative initial LBA-1 commit hash.

The selected target is the retained generation-1 request/transaction `135` for
LBA `1299` at boundary `1366722`, page SHA-256
`ba1b1cc2228edbe5028760e47687c6889023fc72221bd5c5f5be85c4cfbb6a00`,
with overlay generation `1` unchanged. P4 now requires exactly one such receipt
and the selected arm tuples `(1,1,1,1)`, `(1,2,0,1)`, and `(1,3,0,0)` plus
the exact boundary-`1030044` quiet record. It binds the receipt's canonical
digest into the campaign execution receipt. Synthetic
positive and adversarial tests establish the state-machine and verifier rules;
the corrected wiring has not yet completed a successful long campaign, so it
does not close either runtime prong of `C-M7`.

Failed runtime observation, 2026-08-02: signed release
`652756f9d5d6b08b18f45d4aee43f1581c9d2392` produced clean native Form-C
capture `cf59250db3acc33fe0b72e6b3c126cf708b3ba0cb3225ba66b3c03f2921aea42`
in ignored session `m7-p4-cb196332a04b4ba889f9d832178ecf70`, with selected
private disk SHA-256 unchanged at
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The portable half nevertheless issued and completed request `135` with legacy
host status `1`, then terminated at the old boundary `1366780` with machine
status `16`. Its top, portable, M6, and worker-log failure hashes are
`74a8461b8e86a098347040748d8123d528c879f62e74e0b11b9ef44050a762d8`,
`019012c5c21ad46332ebe7931da80ff9488d9964253fc6f8c631a215501d509b`,
`209bc3e1b75aa827fa4563a40ff495c0248f1ff2088bc6294b13190a4650acfb`,
and `c9a09e571d123aafb4752bce12be8987ab77b069d13a4f77e573da027897f8d2`.
The 270-record transcript ends with request `135`; no request `136` or later
base-different write was issued. Source inspection established the cause:
the ordinary checkpoint campaign still selected frozen `runM6HeadlessBoot`,
whose block service did not receive the default-disabled M7 policy. The M7
checkpoint entrypoint now selects a dedicated exact companion that supplies
that policy, derives base authority from preflighted selected media, forces
the authoritative quiet-boundary observation, and binds the resulting arm,
transcript-linked receipt, and digest. Ordinary M6 still deletes any
caller-supplied M7 policy before entering its frozen path. A new long campaign
remains required. The later M12 and M13 source status below is unchanged.

Second failed runtime observation and bounded v2 response, 2026-08-02: ignored
session `m7-p4-6db56e8355ca42c9b9975896b766bf1c` directly observed that the
stream continues beyond request `135`. Request `134` read LBA `187956` at
boundary `1366543` with status `0` and completion hash
`ba1b1cc2228edbe5028760e47687c6889023fc72221bd5c5f5be85c4cfbb6a00`;
request `135` wrote the identical page to LBA `1299` at boundary `1366722` and
succeeded. Request `136` then read LBA `187957` at boundary `1366946` with
status `0` and completion hash
`566dc7dd89247cf44f8784741c4400ca28b25d69b836fbfb8ff67729b34d6f1a`;
request `137` wrote those bytes to LBA `1300` at boundary `1367125` but retained
legacy host status `1`. Machine status `16` followed at boundary `1367183`.
The native capture remained
`cf59250db3acc33fe0b72e6b3c126cf708b3ba0cb3225ba66b3c03f2921aea42`
and the private disk remained
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The top, portable, M6, and worker-log failure hashes were respectively
`8a00abea95ae2f1314430228a0a611a09a8e900705902393a36d64d95978dfcd`,
`fbdc542f17188056a9ca4b5df22c91e579c17b196892a8a4be31053222a8bd04`,
`539d992645fa0243575ea728655f1600d467414c82a0d4f199885818715e6a49`,
and `05187da6c4c154180580455ffbbb939619c18f95fbdce588f1c9a4b25c70a1ee`.

Source v2 therefore retains the exact v1 arm and request-135 anchor, then
streams ordered identity acknowledgements. It requires generation `1`,
transaction ID equal to request ID, equality to fresh pre-success and
post-completion target rereads, a global completed-host-request high-water
including reads, no acknowledgement-member replay, and at most 1,024 total
host transactions. The exact committed request-1 LBA-1 descriptor-and-payload
replay remains the sole exception even after streaming begins and creates no
acknowledgement member. Any
malformation, mismatch, read/fault/completion failure, detach/reset, drift, or
exhaustion poisons the stream without media/root/generation mutation. M6 emits
candidate v3, acknowledgement v4, and `IDENTITY_ACK_STREAM` v1 evidence with
ordered witnesses and optional adjacent-read provenance. P4 retains private
0600 canonical stream and transcript sidecars; P5 hashes and validates but
never serves them. The observed future stream length remains unknown, so a
fresh campaign is still required and no P4 or P5 gate is closed.

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

The M8/M9 READY4 campaign selects the additive `m9-devid` Wasm build rather
than the ordinary M9 module. It retains the M7 display/core route and the M9
input ABI while adding only the M6 DEVID runner and fixed evidence export; its
O0/O2 byte identities and exact export surfaces are pinned by the M8/M9 unit
gate. In particular, the inherited CDRM7U1 guarded physical read of `017772045`
continues to route only to IOB CSR `0764112`; it is not replaced by an IOB
range or a write capability. It also retains CDRM7TV1's normal-bus TV range;
the M9 profile must route reads and writes within `017000000..017077777` to the
TV backing store without widening either adjacent Xbus space or pre-M7 profiles.

Source-A rebaseline, 2026-08-02: the four O0/O2 M9 identities below were rebuilt
from signed M7-TV receipt head `51d5426c1691bdd00783e15fb6fd44f6ddbfff56` plus
this M8/M9 source closure. They are deterministic build-test identities, not
native-campaign evidence. The M8/M9 DEVID unit gate runs the inherited CSR and TV
boundary tests compiled against the additive M9 profile before checking these bytes.

| Profile | Optimization | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| M9 ordinary | O0 | 204402 | `f65c08e50aa3440f014016adc3ae252cdf7ca626323276f7deaac338c718b9b1` |
| M9-DEVID | O0 | 167232 | `ac32ee309ca6f10368dd3317fb31ef70c5642896eda441306169b5fe21e325d8` |
| M9 ordinary | O2 | 182384 | `c1b4c70c20317bd156b7e79e35ea4d245f1fdde46143727f5600c0da58c09570` |
| M9-DEVID | O2 | 122282 | `f5accbe7fa33c8208b3d5a4874a75b90c59ea4bec721741ff3b84196e762a62a` |

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

Unfulfilled native-authority prerequisite, 2026-08-02: building the immutable
captured-Python authority and starting either native campaign require the
**host-global** Yama policy `/proc/sys/kernel/yama/ptrace_scope` to be exactly
`3`. Mode `2` is rejected at every authority layer: Yama permits
`CAP_SYS_PTRACE` in that mode, while this Bubblewrap design creates a child user
namespace whose parent-namespace owner retains all child-namespace capabilities.
Neither the child user/PID namespaces nor a fresh `/proc` mount removes that
parent-creator relationship or independently roots a Yama decision. The outer
host preflight, canonical builder receipt, in-child bootstrap, native runner,
and browser/X11 receipt join all demand `3`; the in-child reread is a coherence
check, not a substitute authority. The regression uses static and receipt
adversaries rather than faking `/proc`.

The current development host was observed at scope `1` on 2026-08-02. No sysctl was changed,
the authority was not built or executed, and no CADR runtime was launched.
Consequently this prerequisite and every dependent `C-M8`/`CW2-INTERACTIVE`
runtime gate remain open. Meeting this host-policy prerequisite alone would
authorize no compatibility claim: the isolated native and matched browser
campaigns still have to complete and pass their evidence checks. See the
[pointer and lifecycle specification](cadr-pointer-and-interactive-lifecycle-reimplementation-specification.md)
for the bounded kernel evidence and inference.

The authority is not selected by a caller-provided Guix store directory. Its
canonical builder opens and hashes the exact reviewed wrapper, builder,
derivation, launcher, guard, and bootstrap sources; opens the Guix client
before resolving it; invokes that descriptor under a closed build environment;
and records the derivation and output paths. The resulting receipt records the
copied bootstrap hash, a launcher ELF64 identity with neither `PT_INTERP` nor
`PT_DYNAMIC`, and a guard ELF64 shared-object identity with `PT_DYNAMIC` and
no `PT_INTERP`. Before native execution, the runner independently evaluates
the same derivation and dry-run output through the receipt-bound Guix client,
then descriptor-walks and rehashes every selected output. The legacy
`CADR_M8_M9_PYTHON_AUTHORITY` direct selector is rejected; a future authorized
run must name the canonical receipt with
`CADR_M8_M9_PYTHON_AUTHORITY_RECEIPT`.

The child receipt also fixes `sys.path` to the immutable stdlib,
platstdlib, and `lib-dynload` directories, removes archive import hooks, and
permits only the recorded built-in, frozen, and `FileFinder` import surfaces.
Every stdlib `FileLoader` target is descriptor-walked and hashed. Captured
programs that request `zipimport`, directly request `__main__` or
`sitecustomize`, use the enumerated frame/function reflection attributes, mutate
the importer namespace, or leave that surface changed fail closed at the selected
source-admission or exit checks.

The authority bootstrap is a sealed `sitecustomize` gate, not the program's
`__main__`. The static launcher replaces its entire environment, adds only its
literal startup `PYTHONPATH`, and starts the sealed root pathname as CPython's
actual script after `sitecustomize` returns. The gate validates the root and every
helper's byte/hash identity, replaces `runpy.run_path`, `io.open_code`, and the
built-in `compile`, `exec`, and `eval` entries, then leaves no saved original
`compile` or `exec` object in the gate's module dictionary or a Python caller frame.
Captured helpers are subsequently loaded by the ordinary guarded loader from their
own validated sealed mounts. The adversarial regression attempts recovery through
`__main__`, `sys.modules`, the startup module dictionary, a guarded-loader
function's globals, and a caller frame; each must fail before it can run an injected
code string.

This is a narrowly bounded source-closure authority reduction, not a claim that
arbitrary hostile Python is a generally safe sandbox. In particular, the selected
seven reviewed sources remain trusted inputs, the filesystem/namespace/ptrace
boundary is enforced independently, and a successful static regression cannot
substitute for a future authorized native capture at Yama scope `3`.

The selected native child begins below a new tmpfs `/` and Bubblewrap's fresh
minimal `/dev`; it never receives a host-root or repository bind, nor even a
repository-root environment locator. It also does not receive the whole Guix
store. The parent obtains the selected store interpreter's recursive
`guix gc --requisites` closure through the receipt-bound Guix descriptor,
canonicalizes that exact store-item list, opens each item as a held directory,
and mounts only those directories individually. The synthetic device receipt
enumerates `null`, `full`, `zero`, `random`, `urandom`, `tty`, and `pts/ptmx`;
the `pts` and `shm` directories; and Bubblewrap's `core`, `fd`, standard-stream,
and `ptmx` symlinks.
All remaining mounts are a fixed descriptor-held permit: native configuration,
every prepared file individually, five configuration-selected media files, selected static
profile/template/release/patch/mapping evidence, input script and campaign,
and the one private output directory. The prepared receipt rejects symlinks,
non-regular leaves, and execute bits outside the exact three selected `usim`
executables. The seven reviewed Python programs cross as one root pipe plus one
separate helper pipe per non-root source; Bubblewrap materializes those bytes as
read-only files below the sealed program root rather than exposing a repository
tree or retaining an in-memory source bundle. The child descriptor-walks its
actually mounted startup gate, launcher, and guard and requires their identities to
equal the canonical receipt; after exit the parent requires an explicit
bootstrap-start token, then rehashes its retained Python, Bubblewrap, authority,
every Guix-store directory, every prepared file, and all other permit descriptors and
again compares the authority artifacts and ELF profiles to that same receipt.

The committed campaign join now requires reciprocal O0/O2 provenance manifests
rather than accepting two independently plausible reports. It binds the same exact
ordered source-authority set, recursive import closure, selected media and O0/O2 executable
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

Implementation status, 2026-08-02: M11 now has a machine-owned core mapping for
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
An opt-in ABI1.11 source slice now adds core-issued `CDRM11O1` epochs, exact
`CDRPCM1`, private retention of acknowledgement frame counts, zero-frame UART
handling, an eight-record Worklet, a worker-owned adapter that calls the actual
ABI1.11 export and pumps at most 64 semantic packets per automatic turn, and
synthetic shell lifecycle coverage. The real worker/empty-core seam is exercised,
but no selected guest PCM was available in that test. It
does not alter ABI1.10/v7 and is not runtime closure.

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

Implementation status, 2026-08-02: a narrow cumulative M12 ABI 1.10/protocol-v7 profile has a
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
`C-M12` remains open. The formerly open pure-source ABI 1.10 lifetime boundary is
now covered in the composed adapter: nonmutating failed-initial-boundary retry,
semantic-zero first initialization, normal teardown retaining a monotonic domain
counter, same-address adapter reuse that keeps the old lease stale after new-owner
publication, copied-adapter rejection before copied-machine access, and nonmutating
owner-incarnation exhaustion preflight all have native tests. Internal C-M12 status
21 is not a v7 debugger result and cannot be
mistaken for terminal debugger statuses 19/20; direct Wasm lifecycle and composed
snapshot bridges map it to existing public status 15 before mutation/publication,
while a v7 backend-protocol attempt to emit 21 is closed as status 2 without a result.
The native boundary vector also issues `UINT64_MAX-1` exactly once, reaches the
unissued sentinel, and proves that the immediately following status-21 attempt leaves
the final owner and its lease unchanged.

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

Implementation status, 2026-08-02: the tracked source now promotes the former
selected-media setup seam to public v8 `base-media-mount`. The operation is fenced
behind the selected adopted import ID, v8 bootstrap, one same-boundary range binding,
the four selected artifacts, an exact factory-owned selected-Wasm digest, and clean
M10 reopen; selected import calls are rejected before bootstrap. Its synthetic contract matrix
checks every lower mutation/read/adoption failure position and terminally discards a
partially mutated worker, while the production binding test covers all 258 retained
and revalidated range indexes including the final 77-block range. Maximum public ID
terminalization is common to mount success, precondition rejection, and worker-loss
failure. E27 now runs the public import/mount/reopen path in Chromium 150 against the
current selected M12 O2 module and exact local base/artifacts. The real guest reaches
its first base-identical block-1 write in 252 bounded slices and public reopen reads
the same bytes. An explicitly synthetic controller write after that public mount
then survives immediate read and public reopen. The worker remains `RUNNING` after
host completion. Public export/restore names are exercised only through an E27 test
adapter which streams and parses a real synthetic `CDRM10W1`; it emits no normative
pinned-object records, adopts no snapshot, and performs no paused/reset composite
restore. All source inputs remain byte-identical. This closes neither a guest-
generated changed write, normative export/restore, the complete F06/F07 power-loss/
failure algebra, composed M8--M12 accessibility/audio workflows, nor final `C-M13`.
The `M13-AUDIO1` source profile now composes optional audio dispatch through the
public shell and retains the no-audio default. Its real private v8 worker owns the
ABI1.11 source, calls the actual open export, and pumps at most 64 semantic packets
after open or acknowledgement. O0/O2, exact-record, overflow, source, worker, and
synthetic lifecycle tests remain implementation evidence. A separate Chromium 150
probe on signed base `779812a` now composes the selected ABI1.11 O2 module, actual
worker, public shell, click-created 48 kHz AudioContexts, and real AudioWorklet;
pause/resume changes epoch 2 to 3. The selected core remains empty. One explicitly
synthetic 512-frame downstream record reaches the Worklet in epoch 3; its one
acknowledgement reaches the actual worker, is rejected stale, and completes loss
fencing. A new click-created context and epoch 4 then repeat the exact sequence with
one synthetic 88-frame record. Three fresh captures have identical request/response
order and canonical report bytes. Thus the run proves no selected guest PCM or
successful automatic repump. The current public selected-media harness was rerun
separately on the same
signed base and byte-identical selected inputs and still stops at the first host
wait rather than a Listener `%BEEP`. Guest-generated selected-media playback,
composed autoplay denial, accessibility review, and the remaining failure campaign
therefore remain open.

### M14 — Reproducible museum release

Deliverables:

- deterministic build manifest and source map policy;
- browser compatibility test matrix;
- offline application packaging;
- user guide covering import, controls, save/export, reset, and rights boundary;
- release conformance report for `CW0`–`CW4`;
- generated artifacts carrying their exact source/license provenance.

Exit gate `CW4-MUSEUM`: two independent clean source extractions can build the same logical WASM artifact,
load only policy-permitted inputs, pass all conformance gates, and complete the
guided smoke workflow without a network.

Scaffolding status, 2026-08-02: the tracked
[M14 release note](cadr-web-reproducible-museum-release-scaffolding.md) and
`cadr-web/release/` policies define a deterministic logical manifest, complete
direct-input source map, closed static inventory, three-engine evidence matrix, rights
inventory, deterministic guide/report generators, and a v1 receipt-admission policy.
The candidate is derived from the exact canonical logical manifest; stable M6--M14
cases and blockers map to the existing definition-of-done clauses. The production
adapter registry is intentionally empty, so any supplied receipt rejects and a
zero-receipt aggregation remains entirely `not-evaluated` with release claim `none`.
Runtime no-network behavior is still `not-evaluated`. The scaffold omits the final
Wasm/worklet and leaves CW0–CW4 and all browser rows `not-evaluated`; it is not a
CW4 claim.

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
- Linux kernel, [Yama ptrace_scope](https://docs.kernel.org/admin-guide/LSM/Yama.html), verified 2026-08-02.
- Linux man-pages, [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html), verified 2026-08-02.
- Pinned `usim` modules under repository `l/usim/`

Last verified: 2026-08-02.

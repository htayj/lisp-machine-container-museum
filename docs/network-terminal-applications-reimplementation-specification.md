---
type: Reimplementation Specification
title: Network terminal applications reimplementation specification
description: A release-bounded reconstruction contract for MIT CADR Supdup and Telnet and the Symbolics Genera Terminal activity, including complete effective input trees, connection state, protocol filters, simulators, failure order, runtime evidence, and conformance tests.
tags: [lisp-machine, mit-cadr, lm-3, genera, supdup, telnet, terminal, network, dynamic-windows, reimplementation, specification]
timestamp: 2026-07-19T21:25:12-04:00
---

# Network terminal applications reimplementation specification

## Status and reconstruction claim

This specification defines D10 as a family of selectable, release-bounded network
terminal profiles. It is intended to be sufficient to build an independent
implementation of the selected observable behavior without copying either historical
implementation. The profiles are:

- `NT-C46-LMWIN-105-SRC`, the canonical public System 46 LMWIN source profile selected
  by `LMWIN; SUPDUP 105` at MIT CADR source revision
  `8e978d7d1704096a63edd4386a3b8326a2e584af`, including that selected file's older
  Telnet engine and the LMWIN System-S/System-T/Create registrations;
- `NT-C46-LMIO-196-SHADOW`, nonnormative comparison evidence from the shadow System 46
  `LMIO; SUPDUP 196` implementation and the `LMIO1; ESCAPE 6` Escape-N dispatcher;
- `NT-C303-4DF-SRC`, maintained LM-3 Supdup and Telnet source at Fossil check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`;
- `NT-C303-303-0-RUN`, the exact System `303-0` load-band observation, including the
  missing System-S/System-T registrations, compiled-image definitions, and the
  separately identified source-injected Supdup and Telnet shell captures;
- `NT-G4521-U445-SRC`, licensed readable source selected by the Utilities 445
  component directory generated under System 452.1;
- `NT-G-MAN-R7-I440`, the installed-440 keyboard material and Network User's Guide,
  whose own release identity is Release 7.0; and
- `NT-G85-S45222-RUN`, bounded behavior observed in the preserved Genera 8.5,
  System 452.22 world.

These profiles are not aliases. A conforming implementation MUST select one or more
profiles explicitly and MUST expose every selected release delta described here. In
particular, it MUST NOT silently average System 46, maintained System 303, readable
Genera System 452.1 source, Release 7.0 manual prose, and the System 452.22 world.

The contract is implementation-independent. A recreation MAY replace Flavors, TV
sheets, processes, Chaosnet connections, Dynamic Windows output records, Command
Processor arguments, state blocks, and stream filters with host-language equivalents.
It MUST preserve the selected profile's externally observable state, effective input
tree, dispatch priority, ordering, byte transformations, partial failures, reset and
abort behavior, window relationships, and selected historical defects.

This specification does **not** claim source, QFASL, ABI, world-image, memory-layout,
packet-timing, font, or pixel compatibility. It does not claim that the maintained
LM-3 tree is a pristine historical System 303 release, or that the licensed System
452.1 source bodies reside unchanged in the Genera 8.5 world. The CADR runtime did
not establish a network peer; the Genera runtime did not connect to one. Connected
runtime interoperability, timing, and destructive display effects therefore remain
named oracles unless a test below is satisfied by a deterministic isolated peer.

Licensed Genera source, manuals, the VLOD, and raw captures remain evidence-only
local inputs. This original-language contract and one capture-specific reviewed
screenshot do not authorize redistribution of those inputs, decoded Help, fonts,
protocol transcripts containing licensed prose, or extracted assets.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` carry their usual requirements
meanings. A requirement qualified by a profile applies only when that profile or its
named feature closure is selected.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C46-SRC` | public System 46 source | canonical `LMWIN` NVT, Supdup, older Telnet, and selected System-key/Create behavior | System 303 behavior, live execution, or the authority of shadow copies |
| `C46-LINEAGE` | public comparison source | earlier/lateral implementations and Escape-N selection history | a second normative System 46 profile unless separately specified |
| `C303-SRC` | maintained LM-3 source | shared NVT, Supdup, Telnet, protocol, window, command, and parser behavior | historical originality or exact compiled-band residency |
| `C303-RUN` | isolated CADR harness | exact band registration, compiled definition presence, source-load boundary, two disconnected surfaces, and shutdown result | a successful peer session or pristine source-to-band identity |
| `G452-SRC` | licensed selected source | Genera Terminal state, filters, commands, protocols, simulators, failure order, and source-visible defects | redistribution rights or definition identity with System 452.22 |
| `G7-MAN` | licensed installed manual | contemporary user terminology, intended workflows, and documented limits | exhaustive commands, exact implementation order, or later-world behavior |
| `G85-RUN` | isolated Genera harness | `Select T`, exact disconnected prompt/label/chrome, harness boundary, and shutdown result | connected behavior, source identity, site configuration, or peer interoperability |
| `RFC` | RFC Editor primary standards | protocol vocabulary and standards cross-checks | proof that either Lisp-machine implementation conforms |
| `INTERP` | stated reconstruction interpretation | a portable representation justified by named evidence | a historical implementation fact |
| `TODO-ORACLE-*` | named unresolved oracle | the exact experiment still required | permission to guess, normalize, or promote source behavior to runtime fact |

Source controls strict source-profile branches that were not executed. Runtime
controls only the exact observed compiled-world state. Manual/source and
source/runtime disagreement MUST remain a profile delta, strict defect, or named
oracle. An implementation MUST NOT resolve it by unlabelled preference.

## Compatibility profiles and levels

### Release profiles

| Profile | Normative surface | Required substrate | Explicit exclusions |
| --- | --- | --- | --- |
| `NT-C46-LMWIN-105-SRC` | canonical System 46 LMWIN NVT, Supdup, its older Telnet engine, local commands, Intelligent Terminal Protocol input, display operations, System-S/System-T, and Create entries | System 46 TV/stream/process/Chaos adapters | maintained System 303 Telnet additions; Genera Terminal; LMIO/LMIO1 shadow-copy differences unless selected |
| `NT-C46-LMIO-196-SHADOW` | comparison-only `LMIO` and Escape-N behavior | a report capable of labeling the exact source file | automatic compatibility status; averaging with `LMWIN` |
| `NT-C303-4DF-SRC` | separate/bound Supdup and Telnet, shared `BASIC-NVT`, host parser, complete Network-prefix tree, protocol/display engines, optional recording flavor | maintained TV, process, Chaos/gateway and stream adapters | System-S/System-T registration; Genera CP/DW behavior |
| `NT-C303-303-0-RUN` | observed base-band registration plus source-injected disconnected shell appearance | exact recorded System `303-0` band, private source bridge and harness | successful connection; unmodified source-to-band equivalence; System 46 runtime |
| `NT-G4521-U445-SRC` | outgoing Terminal application, commands, filters, protocols, simulators, output records, wallpaper, and file transfer | TV, Dynamic Windows, Command Processor, network-service, process and filesystem adapters | incoming Remote Terminal server commands; CLIM; System 452.22 identity |
| `NT-G-MAN-R7-I440` | documented Release 7 user workflow as an optional compatibility overlay | explicit manual-profile selector | authority over contradictory source/runtime details |
| `NT-G85-S45222-RUN` | observed initial Terminal state and `Select T` route | exact recorded Genera 8.5/System 452.22 world and harness | connected state; configured Symbolics site; exact readable-source identity |

`NT-C303-303-0-RUN` and `NT-G85-S45222-RUN` are witness profiles. They MAY accompany
a source profile in a comparison report, but their claim sets MUST remain separate.
For example, `NT-G4521-U445-SRC + NT-G85-S45222-RUN` means “implement the selected
source contract and compare the bounded world state,” not “prove that all source
bodies are loaded unchanged in the world.”

### Conformance levels

| Level | Required closure |
| --- | --- |
| `L1` disconnected shell | profile-tagged state; entry, reuse/create policy, disconnected label and prompt, cancellation, no-peer lifecycle, and rights-safe visible layout |
| `L2` local interaction | `L1` plus every effective direct, prefix, numeric, repeat, Help, menu, pointer, presentation, mode/context, shadowing, fallthrough, and unbound path normatively incorporated below; process and local-option transitions |
| `L3` protocol and display | `L2` plus byte-exact host parsing, connection ordering, negotiation, character translation, display effectors, simulators, file transfer, journaling, fault injection, and deterministic recording peers |
| `L4` preservation comparison | `L3` plus comparison against the exact preserved runtime profile, byte traces from both endpoints, visual checkpoints, timing tolerances, selected defects, and closure of every mandatory connected-runtime oracle for the claimed feature |

An `L1` or `L2` implementation MUST identify an inert or absent network adapter and
MUST NOT describe the resulting shell as a successful remote terminal. An `L3`
implementation MAY use a project-owned scripted peer. `L4` requires a peer inside
the preserved harness's isolated namespace and a complete provenance record; it MUST
NOT add an external route or expose a real login service.

### Feature closures

| Closure | Profiles | Requirement when selected |
| --- | --- | --- |
| `CADR-NVT-CORE` | C46/C303 | shared window, prompt, two-path or two-process lifecycle, output locking, error handoff |
| `CADR-SUPDUP` | C46/C303 | ITP input, terminal-variable greeting, display/graphics effectors, logout and strict unsupported slots |
| `CADR-TELNET` | C46/C303 | release-specific NVT translation, IAC negotiation, local echo, and Imlac behavior; optional SUPDUP-OUTPUT and its pointer reports exist only in C303 |
| `CADR-RECORDING` | C303 | alternate recording/local-editing flavor only; not the default Supdup flavor |
| `GENERA-TERMINAL` | Genera source/runtime | outgoing `NVT-WINDOW`, Terminal command table, CP/DW interaction and state lifecycle |
| `GENERA-PROTOCOLS` | Genera source | seven selected login protocols and their exact input/output filter composition |
| `GENERA-SIMULATORS` | Genera source | Glass, Imlac, Ambassador, and VT100 selected-source subset |
| `GENERA-FILE-TRANSFER` | Genera source | raw and serial send/receive coordination and failure behavior |
| `GENERA-WALLPAPER` | Genera source | output journal approximation and its lossy replacement/error semantics |
| `VISUAL-L1` | runtime profiles | bounded geometry and sparse disconnected-screen relationships, not pixel identity |

A conformance declaration MUST name its selected closures. `GENERA-TERMINAL` is the
outgoing client. The incoming `REMOTE-TERMINAL`, network-terminal server flavors,
and their Set/Show/Halt commands are dependencies or a separate future closure; they
MUST NOT be merged into the outgoing Terminal command table.

## Evidence ledger

### Public CADR and LM-3 evidence

The System 46 Git revision is
`8e978d7d1704096a63edd4386a3b8326a2e584af`. The maintained LM-3 Fossil check-in is
[`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).
They are distinct historical lineages and MUST NOT be described as two directories
within one release.

| Evidence | Artifact | Role |
| --- | --- | --- |
| `C46-SRC` | `src/lmwin/supdup.105` | selected System 46 NVT, Supdup, and older Telnet behavior |
| `C46-LINEAGE` | `src/lmio/supdup.196` | shadow lineage; comparison only |
| `C46-LINEAGE` | `src/lmio1/escape.6` | historical Escape-N instance dispatcher |
| `C303-SRC` | [`window/supdup.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsupdup.lisp) | maintained shared NVT, Supdup, Telnet, parsers and display protocols |
| `C303-SRC` | [`window/sysmen.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsysmen.lisp) | Create-menu entry; absence of current System-key registration |
| `C303-SRC` | [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp) | declared `SUPDUP` system and module boundary |
| `C303-SRC` | `window/telnet-code.lisp` | Lisp-machine-character Telnet server/client experiment |
| `C303-SRC` | `window/telnet-front-hack.lisp` | copied compatibility front end, not a separate application |

The maintained `window/supdup.lisp` is 110,143 bytes with SHA-256
`e329911a2860d69976890f05c4a1c5fbf69f44b7831cb9fd72fe07fa81e28ca4`.
The CADR companion records the remaining byte identities and exact source regions.

### Licensed Genera evidence-only artifacts

These artifacts remain local and untracked. Their identities permit an authorized
researcher to reproduce the audit without reproducing their contents.

| Artifact | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `network/telnet.lisp.~1600~` | 142,464 | `8560d82fc6327e1638769d200c6b9aa32b47a486de4ecdeb7484b1715e8239e5` | outgoing Terminal application |
| `network/network-terminal.lisp.~1542~` | 28,756 | `1d40d93a67f145040fe6792e3153ddcada6feb99739f2ee212fab344d3e1e630` | incoming server and shared constants |
| `network/remote-terminal.lisp.~1597~` | 63,584 | `1a28e88823a10d65616244ad816337658770a16f29886d6dfd7c4a749d2298b1` | incoming remote-terminal substrate |
| `sys/utility-sysdcl.lisp.~133~` | 8,922 | `fa1a9008314855cc991457131fbcb5b46a8746db5aa22078abf7f7911e81baa0` | network-application load order |
| `utilities.system-dir.~214~` | 7,861 | `eb400788b288d981abd3c8170a548a9600b438a866db2c68c3079886d29463b1` | System 452.1 / Utilities 445 witness |
| `utilities-445.component-dir.~2~` | 5,541 | `99484f1129de054b862bfa33022fe822231c354a5e6d8b72bd8cdd44a7789061` | exact selected source versions |
| `cp/comtab.lisp.~103~` | 36,295 | `f60724c8e2526950000f090f2dae4745b3394079713b3601606be865c23b98e1` | command-table inheritance and case rules |
| `cp/read-accelerated-command.lisp.~142~` | 37,639 | `8107cf4e993068344e624ec924c8d0cf0327158a927c1962666d22eb81494388` | argument, accelerator, Help and error semantics |
| `cp/substrate-commands.lisp.~6~` | 14,731 | `558f085cc3953de3f831e4e9e195104303e9e6331861a9ed629b550870fb4f44` | Network-Meta-W behavior |
| installed Network topic | 10,688 | `172e25d09c4a94aba0e74b20afe2098139ab77bbebe3499fd83083995aac3fef` | Release 7 manual profile |
| installed keyboard topic | 32,831 | `12cc014888759edb02a506da346803e05f2b6f758959a1f0a0d8ac690bfdbd1d` | documented keys and gestures |

Optional cross-system handlers are identified in the Genera companion. Their presence
in source does not prove residency in the System 452.22 world.

### Standards cross-checks

The primary standards layer consists of RFC Editor copies of
[RFC 734, SUPDUP](https://www.rfc-editor.org/rfc/rfc734.html),
[RFC 746, SUPDUP graphics](https://www.rfc-editor.org/rfc/rfc746.html),
[RFC 747, SUPDUP extensions](https://www.rfc-editor.org/rfc/rfc747.html),
[RFC 736, the Telnet SUPDUP option](https://www.rfc-editor.org/rfc/rfc736.html),
[RFC 749, Telnet SUPDUP-OUTPUT](https://www.rfc-editor.org/rfc/rfc749.html),
[RFC 854, Telnet](https://www.rfc-editor.org/rfc/rfc854.html),
[RFC 855, Telnet option negotiation](https://www.rfc-editor.org/rfc/rfc855.html),
and the implemented Logout, Binary, Echo, Suppress-Go-Ahead, and Timing-Mark options
in [RFC 727](https://www.rfc-editor.org/rfc/rfc727.html),
[RFC 856](https://www.rfc-editor.org/rfc/rfc856.html),
[RFC 857](https://www.rfc-editor.org/rfc/rfc857.html),
[RFC 858](https://www.rfc-editor.org/rfc/rfc858.html), and
[RFC 860](https://www.rfc-editor.org/rfc/rfc860.html).

These documents establish vocabulary and expected protocol shapes. Exact Lisp-machine
behavior is determined by the selected implementation source and runtime tests. A
standards discrepancy MUST be reported; it MUST NOT be silently “corrected” in a
strict historical profile.

### Normative evidence map

| Contract area | CADR owner | Genera owner |
| --- | --- | --- |
| complete effective input | [CADR companion](mit-cadr/supdup-telnet-bindings-and-protocol-semantics.md) | [Genera companion](genera/terminal-bindings-protocols-and-simulators.md) |
| entry and reuse | selected System 46 LMWIN System-S/System-T/Create and Lisp routes; separately labeled Escape-N shadow lineage; maintained `supdup.lisp`, `sysmen.lisp`; runtime | `telnet.lisp`, Peek optional handler; runtime |
| state and lifecycle | `BASIC-NVT`, separate/bound helpers, protocol flavors | `NVT-WINDOW`, state blocks, filter construction and process top levels |
| host/service selection | `PARSE-PATH`, `EXPAND-PATH`, protocol connect methods | network service selection and Terminal `Connect` parser |
| local commands | `TYPEIN-TOP-LEVEL`, protocol method availability | CP Telnet table and accelerated-command reader |
| wire transforms | Supdup/ITP/Telnet methods | input/output filter flavors and state blocks |
| display simulation | Supdup effect dispatch, graphics, GT40/ARDS/SUDS; Telnet/Imlac | Supdup/3600 decoders; Glass/Imlac/ANSI/Ambassador/VT100 simulators |
| visual witness | `d10-network-terminal-cadr-20260719` | `d10-network-terminal-genera-20260719` |

The [historical dossier](network-terminal-applications.md) is an evidence narrative,
not a substitute for this normative contract.

## Architecture and ownership boundaries

### User-interface substrate and CLIM nonrelationship

System 46 and maintained System 303 use TV sheets/streams, Flavors, process objects,
I/O buffers, full-screen window mixins, and direct display operations. They predate
CLIM. `SUPDUP`, `TELNET`, and the shared `BASIC-NVT` are not CLIM application frames
and do not use CLIM ports, grafts, panes, command tables, presentations, or redisplay.

Genera Terminal combines TV stream/select/graphics/minimum-window facilities with a
Dynamic Windows typeout surface and Command Processor tables, arguments,
presentations, input contexts, Accepting Values, output records, and marking. This is
also not CLIM: the selected source defines no CLIM application frame or CLIM
port/graft dependency. Shared vocabulary such as presentation, command table, frame,
or redisplay does not change that ownership. A recreation MAY use CLIM as its porting
substrate, but MUST describe CLIM as the recreation technology rather than a
historical Terminal dependency.

### Functional layers

A recreation MUST keep these layers independently observable:

1. **Application selection and window ownership:** find, create, force-create, bury,
   deselect, reactivate, and kill.
2. **Disconnected argument acquisition:** host/contact/service/options parsing and
   cancellation before a stream is committed.
3. **Local control dispatch:** the Network prefix, numeric arguments, Help, long
   commands, pointer menus, and literal escape transmission.
4. **Keyboard translation:** Lisp-machine character/list-event conversion to a
   protocol input alphabet.
5. **Connection and negotiation:** service selection, stream acquisition, option
   state, greetings, and protocol writes.
6. **Remote-output decoding:** network bytes to display operations or an intermediate
   simulator language.
7. **Viewport and recording:** screen mutation, scrolling, saved bits, Dynamic
   Windows records, optional history and journaling.
8. **Process/error ownership:** type-in, type-out, locks, interrupts, ticks, teardown,
   and propagation of partial failure.

A host prompt is not a connected terminal. A completed network open is not completed
protocol negotiation. An output record is not a faithful screen image. A wallpaper
journal is not a terminal transcript. A source-injected shell is not a pristine
compiled-band application. These distinctions are normative.

### Required adapters

| Adapter | Minimum contract |
| --- | --- |
| `Display` | character output; cursor state; clearing, insertion/deletion, regions, attributes, bell, graphics; deterministic capture |
| `Keyboard` | full Lisp-machine character and list-event identity, modifier bits, prefix timing, pointer gestures, and input queue clearing |
| `WindowManager` | create/find/select/expose/bury/deselect/kill; current/superior/alias relationships; saved-bits policy |
| `Scheduler` | independently controllable type-in/type-out actors, reset/run/wait/interrupt, deterministic fault and race injection |
| `Network` | service/path resolution, open/close/abort, character and packet streams, interrupt/break operations, byte recording |
| `HostDatabase` | host type, addresses, associated-machine/default path, service desirability and explicit gateway/contact resolution |
| `Filesystem` | open/write/close journal and transfer streams with fault injection at every operation |
| `CommandUI` | profile-selected input editor, CP argument reader, accelerated reader, Accepting Values and presentation resolver |
| `Clock` | bounded timeouts, output tick, process waits, and reproducible timeout injection |
| `Trace` | ordered state transitions, bytes, display effects, process actions, errors and provenance without licensed payload publication |

Each adapter MUST support a no-network test configuration. `Network` MUST support
scripted peers that can send malformed and truncated byte streams and record exact
responses. The scheduler and filesystem MUST expose faults at every order-sensitive
stage named below.

## Common semantic state model

### Terminal instance record

A portable implementation MUST expose a terminal-instance state logically equivalent
to:

```text
TerminalInstance {
  profile, application_kind, instance_id, window_state,
  connection_state, target, stream, input_chain, output_chain,
  typein_actor, typeout_actor, output_enabled, output_lock,
  escape_character, more_state, echo_state, overstrike_state,
  recording_state, journal_state, simulator_state, protocol_states,
  label, cursor, dimensions, saved_display_state,
  pending_argument, last_error, generation, trace
}
```

Fields MAY be represented differently, but every observable transition MUST be
queryable by a test oracle. `stream` MUST be either absent or owned by exactly one
connection generation. A filter or protocol state MUST name the generation for which
it is set up. Errors MUST retain the stage and whether ownership was acquired,
committed, reset, or released.

### Connection states

The minimum common state machine is:

```text
DISCONNECTED
  -> ACQUIRING
  -> BUILDING
  -> COMMITTED
  -> NEGOTIATING
  -> CONNECTED
  -> DISCONNECTING
  -> DISCONNECTED

Any intermediate state -> PARTIAL-FAILURE
PARTIAL-FAILURE -> profile-defined recovery, debugger, or explicit teardown
```

The historical sources do not implement this enumeration literally. It is an
`INTERP` test model. A strict result MUST retain the profile's real commit point and
partial-state behavior; it MUST NOT use the model as permission to make an
historically nontransactional transition atomic.

### Core invariants

1. A disconnected instance MUST not transmit ordinary keyboard input to a peer.
2. Local prefix input MUST be consumed locally except for the explicit literal-escape
   leaf.
3. A protocol logout request MUST precede the profile's close operation.
4. Bytes emitted by concurrent local-command and type-in paths MUST observe the
   selected output-lock rule; ordinary nonmatching paths MUST not be reordered.
5. A filter state MUST NOT be used before its selected setup stage or after its reset
   stage, except where a strict selected-source defect explicitly requires that
   result.
6. A disconnected label MUST not claim a remote peer. A connected label MUST be
   derived from committed connection state, not merely a pending target.
7. Bury/deselect MUST preserve a live connection unless the selected command also
   requests disconnect.
8. Kill, process failure, abort, and peer close are distinct events and MUST be
   separately traceable.
9. A strict source profile MUST preserve nontransactional partial mutations and
   source-visible bounds defects selected by the conformance label.
10. Runtime witness images establish visible relationships only. They MUST NOT be
    used as evidence for hidden state, peer I/O, or source identity.

## Complete effective input and gesture trees

### Normative companion incorporation

The exact CADR input, parser, protocol, and effect inventory is normatively
incorporated from
[Supdup and Telnet bindings and protocol semantics](mit-cadr/supdup-telnet-bindings-and-protocol-semantics.md).
The exact Genera tree is normatively incorporated from
[Terminal bindings, protocols, and simulators](genera/terminal-bindings-protocols-and-simulators.md).

Those companions are part of this specification. A product cannot claim D10 `L2` by
implementing only the summary tables below. It MUST enumerate and inject every leaf
in the companions, including inherited context trees, unavailable-method filtering,
pointer cells, menu-only handlers, presentation actions, numeric argument states,
Help paths, case aliases, collisions, shadowing, cancellation, fallthrough, and
unbound input.

Shared entry and inherited interaction are incorporated from:

- [program selection, activities, and window management](program-selection-activities-and-window-management-reimplementation-specification.md);
- [TV window system](mit-cadr/tv-window-system-reimplementation-specification.md);
- [Dynamic Windows](genera/dynamic-windows-reimplementation-specification.md); and
- the complete Input Editor and Command Processor trees named by the Genera companion.

Incorporation is profile-specific. It MUST NOT make a Genera Dynamic Windows gesture
available in CADR, or a CADR TV action available in Genera when the selected runtime
does not inherit it.

### Entry context tree

```text
CADR System 46 selected LMWIN
|-- System S -> Supdup
|-- System T -> Telnet
|-- System Menu Create -> Supdup / Telnet
`-- selected LMWIN Lisp entry paths

CADR System 46 LMIO/LMIO1 shadow lineage only
`-- Escape N
    |-- no argument or zero -> find/create old Supdup
    |-- argument 1 -> old Telnet
    |-- argument 2 -> create new old Supdup
    |-- argument 3 -> create new old Telnet
    `-- list/precomma argument -> select indexed existing old window

Maintained System 303 source
|-- System Menu/Create menu -> Supdup
|-- System Menu/Create menu -> Telnet
|-- Lisp SUPDUP / TELNET -> separate or bound by mode
|-- SUPDUP-SEPARATE / TELNET-SEPARATE -> reuse connected or idle/create
|-- SUPDUP-BIND / TELNET-BIND -> overlay caller window
`-- Peek host action -> protocol-specific remote login

Genera Terminal
|-- Select T -> generic activity selection/reuse/create
|-- Control-Select T -> force new Terminal through shared Select semantics
|-- Create menu -> always construct and select a fresh Terminal
|-- GET-NVT-WINDOW-TO-HOST -> reserve first eligible idle or create fresh; return only
`-- Peek network-host menu -> Remote Login -> direct lookup, then caller selects
```

The System 303 source profile MUST NOT advertise System-S or System-T. The live
System Help in `NT-C303-303-0-RUN` listed only Top-L, E, I, L, and P. Historical
`supdup.lisp.322` registrations are lineage evidence, not the maintained profile.

### CADR Network-prefix summary

The maintained System 303 default escape character is Network. One suffix is read
after a temporary bottom-line `CMND-->` prompt. Required C303 leaves are Call/P, A,
B/Break, C, D, E, I, L, M, O, Q, Help/?, Rubout, literal escape, and unknown.
Availability is method-sensitive: the effective Help list and behavior depend on the
selected flavor's implemented messages. `E` is implemented but omitted from computed
Help in the maintained source. The selected System 46 LMWIN profile instead defaults
to Break, also recognizes physical Network as a prefix while connected, and lacks
the C303 A/E/O leaves; its exact tree is in the CADR companion.

No numeric-argument tree is owned by this prefix. Bound-window exit and
separate-window bury/deselect MUST follow the selected entry mode. The companion
specifies exact dispatch, cursor restoration, beep, output lock and protocol-specific
leaves.

### Genera Network-prefix summary

The fixed Genera accelerated-command denominator contains 63 normalized cells:

- 37 Standard Arguments cells;
- 12 Unshifted Arguments cells;
- 3 Colon Full Command cells; and
- 11 Terminal-local cells: A, B, D, F, L, M, Q, X, Help, Control-Y, and Meta-W.

Lookup is case-insensitive. Fixed cells are tested before the configurable literal
escape. A configured escape that collides with any fixed cell is shadowed. Rubout
normally cancels, but becomes literal when it is the configured escape because that
test precedes the ordinary Rubout branch. Help reprompts; other successful commands
leave the prefix. Unknown input beeps, clears pending input and argument state,
reports the local error, and reprompts.

Only Network-M accepts a numeric argument among local leaves: absent toggles, zero
disables, and every nonzero integer including a negative one enables. Control-Meta-Y
belongs to full-command history and accepts its inherited argument. The companion
specifies the exact sign, repeated Control-U, Infinity, and digit-composition rules.

### Contexts beyond the prefix

The disconnected Genera `Connect` prompt is a CP command-argument reader, not the
63-cell Terminal table. It MUST inherit the full selected Input Editor and Dynamic
Windows completion, activation, Help, history, Rubout, Abort, pointer, and typed-value
tree. Space after the host advances into keyword/value parsing; Return accepts
defaults. Colon, Meta-X, Control-Meta-Y, command-name presentations, pathname
arguments, and serial-format arguments enter their respective CP contexts.

Network-X enters the full Accepting Values transaction tree. Connected ordinary
remote input bypasses input editing. Recorded text creates only the narrow
`(OR SI:INPUT-EDITOR TERMINAL-INPUT)` presentation context. A conformance report MUST
test these context transitions separately rather than calling the Network tree the
whole application binding set.

### Pointer, menu, presentation, and Help completeness

CADR pointer behavior is direct TV behavior plus the protocol-specific SUPDUP-OUTPUT
mouse report described in the companion. It is not a presentation database.

Genera MUST inject all 96 raw Dynamic Windows pointer cells through the resolver and
evaluate the applicable Marking-and-Yanking, generic window, System Menu, optional
Hardcopy, optional Image Substrate, and presentation-debugging handlers. Terminal's
relevant base gestures include Control-Left marking, Control-Shift-Middle mark word,
Control-Middle yank word, and Control-Right menu. Application-specific marked-text
send, shared kill-ring, unmark, clear, save, extend, and conditional hardcopy actions
are exact leaves, not prose examples.

The reader-commented mouse-position translator in the Genera source is inactive.
Help is curated and not exhaustive. Network-F is live but omitted. The seven
single-key Help rows that are presentations and the six long command-name
presentations MUST be tested as pointer paths; the Control-Y presentation lacks the
accelerator-supplied string argument and remains `TODO-ORACLE-G-HELP-CY` for the
System 452.22 world.

### Exhaustive enumeration requirement

An `L2` test harness MUST generate the effective tree from the selected registries,
not from Help prose. For every reachable leaf it MUST record:

- raw event and normalized event;
- context, mode/pane/window and selected profile;
- prefix and argument state before and after;
- winning binding and all shadowed candidates;
- enabled/disabled predicate and inherited owner;
- emitted local transition, display effect and network bytes;
- Help exposure and presentation/menu reachability; and
- unbound, cancel, beep, error, fallthrough or repeat result.

The harness MUST fail when the generated denominator changes without an explicit
profile update. Genera's 63 fixed prefix cells and 96 raw pointer cells are independent
denominators. Letter case aliases do not increase the fixed-cell denominator.

## Entry, reuse, and window lifecycle

### CADR separate and bound operation

Maintained separate Supdup/Telnet entry without a path first selects any connected
window of the required kind. Otherwise it reuses an idle window or constructs one,
sets the target, exposes it cleanly, and selects it. The default Supdup mode chooses
separate operation.

Bound operation creates a resource window that overlays the caller's selected window,
uses the caller's current process for type-in, assigns a resource type-out process,
connects, runs type-in under a selection substitution, and returns when Network-Q or
an abort exits the catch. A strict recreation MUST distinguish this borrowed-process
path from a separate window with two owned processes.

Selection or exposure lazily resets/runs owned type-in and type-out processes. The
initial label is `<name> -- not connected`. A connected size change is rejected where
the selected protocol's advertised geometry would become false.

The maintained default `SUPDUP-FLAVOR` is ordinary `SUPDUP`. Recording/local editing
belongs to an alternate flavor state. A recreation MUST NOT describe the default
Supdup window as recording or SUDS-local-editing merely because that machinery occurs
in the same source file.

### Genera creation, reuse, and initial state

An `NVT-WINDOW` is considered in use when it has either a committed network stream
or a pending target. Direct remote-login lookup scans the previously selected array
in order under interrupt suppression and MUST reserve the first window with neither;
its setter flushes typein before storing the target. If none qualifies, construction
occurs after leaving the protected scan. The lookup returns without selecting; Peek
selects its result. Generic Select-T follows the incorporated D02 activity policy,
including Control force-create, while Create always constructs and selects a fresh
window. Construction allocates separate type-in/type-out processes and presets their
top levels.

The selected source initializes overstrike true, output recording true, wallpaper
off, character attribute NIL, echo row zero, output tick zero, saved bits, disabled
asynchronous characters, ragged border, left scrollbar, bottom Swiss-bold label,
white margins, end-of-page scrolling, and a disconnected label tag; the constructor
does not visibly call label recomputation. Separately, the live
`NT-G85-S45222-RUN` initial frame displayed `Terminal 1`. A strict source profile MUST
preserve the initialized field, and a runtime-witness profile MUST preserve the
visible label, but the screenshot cannot reveal hidden state or establish when
recomputation occurred. That relationship is `TODO-ORACLE-G-INITIAL-LABEL`.

Function-bury and the Bury Window command preserve connection state. The command may
wait indefinitely for deexposure followed by reexposure. Kill terminates the two
selected-source processes; whether inherited cleanup reliably closes every stream is
`TODO-ORACLE-G-KILL-CLEANUP`.

## Target parsing and connection selection

### CADR path grammar

The maintained parser accepts:

| Form | Selected meaning |
| --- | --- |
| empty/NIL | associated machine or configured default |
| fixnum | Chaos address when resolvable, otherwise raw address |
| `host` | Chaos host, Internet host through inferred gateway, or raw host name |
| `chaos-host/contact` | explicit Chaos contact |
| `internet-host/socket` | explicit Internet socket |
| `gateway` Altmode `internet-host` | explicit gateway and default contact/socket |
| `gateway` Altmode `internet-host/socket` | explicit gateway and socket |

The maintained executable parser reads a slash-suffixed Internet socket in decimal,
although its source comment and Help say octal. `NT-C303-4DF-SRC` strict behavior is
decimal. The discrepancy MUST be exposed; it MUST NOT be “fixed” from the prose.

Supdup and Telnet apply protocol-specific default contact/socket values after parsing.
Resolution failure, gateway failure, contact refusal, timeout, and nonresponding host
MUST remain distinguishable error values.

### Genera service and option resolution

The source-defined `Connect` command is an argument template. Calling its body
signals an error. Terminal top-level reads its arguments and invokes the window's
real connect method. The complete keyword surface is Login Protocol, Connection
Protocol, Terminal Simulator, Echo, Overstrike, Record Output, and Wallpaper File.

Selection MUST follow this matrix:

1. With neither protocol override, request the most desirable applicable `LOGIN`
   service.
2. With only Login Protocol, find a path for that named login protocol.
3. With explicit Connection Protocol, default a missing Login Protocol to
   LISPM-null-Telnet, replace the connection path's arguments with the simulator
   service arguments, and invoke the connection through the login path.
4. Wrap character services in the selected adapter required by the historical
   generic-network limitation. A wrong stream kind signals the selected continuable
   error.

Simulator string names compare case-sensitively; symbol names use identity membership.
VMS-family host types default to VT100, other ordinary hosts default to Ambassador,
and a failed registry substitution leaves Glass. CTERM is a manual example of a
host-provided protocol, not one of the seven builtin declarations in this source.

## Process, connection, and teardown ordering

### CADR process and error handoff

Separate NVT windows own type-in and type-out processes. The type-in actor prompts,
connects, reads local input, dispatches Network commands, and writes remote input.
The type-out actor reads remote output, interprets it, and reports EOF or network
state to the type-in side. Local commands that write protocol bytes acquire the
output lock used by type-in/type-out paths.

The type-out actor MUST distinguish remote close, connection loss, host down, and
unknown connection state and hand an error reason to type-in. A strict implementation
MUST reproduce the source's process-reset and flushed-process handling. It MUST test
failure before window creation, after creation but before process setup, during
connect, during greeting, during display effect, during logout, and during close.

### Genera connect order

`NT-G4521-U445-SRC` connection is nontransactional. A strict implementation MUST
execute and trace this order:

1. acquire stream, input/output filter flavor lists, and provisional label while
   suppressing typeout completion;
2. assign the provisional label;
3. select overstrike from explicit option, otherwise false for Unix/VMS-family hosts,
   otherwise the global true default;
4. set output recording;
5. clear character attribute;
6. remove the typeout helper;
7. reset the echo row;
8. clear recorded history;
9. construct and wire the input chain;
10. construct and wire the output chain;
11. commit `NETWORK-STREAM`;
12. recompute the label;
13. set up input filters from keyboard outward;
14. set up output filters from screen inward;
15. set up every accumulated state block;
16. optionally enable local echo;
17. optionally open the wallpaper journal; and
18. reset and enable the type-out process.

There is no unwind cleanup around the complete sequence. A precommit acquisition or
construction fault may leak a stream or helper. A postcommit fault may leave a
partially connected window. A corrected transactional implementation MAY be offered
only under an explicit non-strict label.

### Genera connected loop and output process

Host parsing and the whole connect method execute outside the connected loop's local
condition handler. Acquisition/build/setup failures therefore are not converted to
the ordinary displayed “connection closed” reason by that handler.

Once connected, unrecovered command or protocol failures cross the connected restart,
run disconnect cleanup, and become a displayed reason. Network EOF/error injects a
local error indication and disables output. Accelerator-reader errors are narrower:
they beep, clear local reader state, report, and reprompt without disconnecting.

Negotiation and ordinary type-in writes share the selected write lock. Filter setup,
simulator splicing, and output-tick rebuild are not all protected by that lock. An
`L3` strict test MUST explore the resulting race windows; it MUST NOT silently add an
atomic chain replacement while claiming exact source behavior.

### Genera disconnect order

A strict disconnect MUST:

1. disable the type-out process;
2. close the wallpaper journal;
3. abort-close the network stream;
4. reset input filters from keyboard outward;
5. reset output filters from screen inward;
6. clear the network stream;
7. reset every accumulated state block;
8. install and recompute the disconnected label; and
9. reset and enable the type-out process.

This path also lacks a complete unwind guard. Injected close/reset failure may leave
output disabled, the stream committed, and a later outer cleanup attempting a second
disconnect. Logout bytes are written immediately before abortive close; the source
waits for no acknowledgement.

More belongs to the window and survives reconnect. Recording, overstrike, echo,
escape filter, wallpaper, simulator and history are rebuilt or reset by the connect
path. State-block objects persist but receive reset/setup transitions.

## Local options, transfer, recording, and journals

### Genera option application

Network-X snapshots displayed values, enters Accepting Values, and on successful exit
applies wallpaper, escape, More, overstrike, output recording, echo, simulator, then
output tick. The transaction is not atomic. A failure preserves all earlier mutations.

Replacing wallpaper closes the previous file before opening the replacement. Open
failure therefore loses the previous journal. Replacing the simulator clears input
translation, constructs and splices the new simulator, sets it up, replaces the
output-chain root, and recomputes the label. The old simulator is not reset and the
splice has no encompassing output lock or tick transaction.

### More processing

The More/Escape input filter treats local `:ERROR` as a thrown connection error and
stores/releases `:MORE` state. With More pending, the next non-escape input releases
and consumes the event. The escape character instead enters local command mode and
does not release More. Exact nested, repeated, disconnect and error cases are required
tests.

Maintained CADR Supdup refuses local More because the source identifies an output
process wedge. CADR Telnet and Genera protocols expose profile-specific More support.
A recreation MUST NOT apply one global More policy.

### Send String and file transfer

Genera `Send String` and raw Send File bypass the outer More/Escape filter while
retaining their selected downstream path. Marked or recorded text yanked as Terminal
input traverses the full input chain; an embedded current escape may therefore invoke
local command mode. This observable distinction MUST be tested.

Raw Send File restores the progress label through its selected unwind path but lets
other errors propagate. Nonraw transfer operates on the raw network stream: type-in
interrupts type-out into a wait, performs transfer, signals completion, waits for an
acknowledgement, sleeps, and wakes type-out. A missing callback acknowledgement can
deadlock. Send defaults to raw text; Receive defaults to XMODEM. Cancellation,
type-out failure, callback loss, partial file I/O, disconnect, and label restoration
MUST each have independent tests using project-owned data.

### Output recording and wallpaper

Dynamic Windows output recording enables retained output and marked-text interaction,
but destructive remote cursor protocols may restrict meaningful history to one
screen. The exact connected-world limit remains `TODO-ORACLE-G-HISTORY-*` per
protocol.

Wallpaper is an output journal, not screen serialization. It writes characters and
format effectors before or with rendering. Same-row left movement emits backspaces;
same-row right emits spaces. Row change emits at most one newline when moving down,
none when moving up, followed by spaces to the requested column. More handling
temporarily disables journaling. A journal write error offers the selected close
restart and then closes/disables the file. Tests MUST compare exact bytes for left,
right, multirow up/down, newline, format control, write failure and replacement
failure.

## Protocol composition and byte semantics

### Genera login-protocol registry

`NT-G4521-U445-SRC` declares seven extensible login protocols:

| Protocol | Desirability | Input path after outer local escape | Output path |
| --- | ---: | --- | --- |
| 3600-LOGIN | 0.85 | 3600 input encoder | 3600 effector decoder |
| SUPDUP | 0.80 | Intelligent Terminal Protocol | Supdup display decoder |
| TELSUP | 0.75 | ITP-over-Telnet, NVT ASCII | IAC negotiation, Imlac simulator |
| TELNET | 0.70 | Telnet character translation, NVT ASCII, optional local echo | IAC negotiation, echo, selected simulator |
| CHAT | 0.70 | Telnet translation and no-interrupt filter | BSP-mark handling and Glass |
| TTY-LOGIN | 0.50 | Telnet translation, echo, serial control | parity, echo and Glass |
| LISPM-NULL-TELNET | 0 | local escape and echo over character stream | echo only |

Desirability participates in service selection; it is not a performance ranking.
Registry order and content remain extension points. The selected source's builtin
simulator registration ends in front-pushed order VT100, Ambassador, Imlac, Glass,
but a live world registry census is required before claiming that exact runtime list.

### Telnet negotiation

Both families implement historical Telnet subsets, not an abstract modern terminal
library. A strict profile MUST preserve its exact negotiation state transitions,
including duplicate or asymmetric responses.

Genera negotiation begins upon the first received IAC. Before consuming that command,
it emits DO Echo and DO Suppress-Go-Ahead. If the same command is WILL Echo, the
initial false-to-true echo transition emits a second DO Echo. The conformance matrix
MUST cross first-IAC/steady-state with WILL, WONT, DO, DONT and each supported or
unknown option; it MUST include Binary opt-in, Echo state, Suppress-Go-Ahead, Timing
Mark, Logout, SUPDUP-OUTPUT, subnegotiation termination, doubled IAC, malformed input,
and unknown command.

Selecting remote echo stops new local-echo enqueueing but does not clear an existing
queue. In the selected scalar output filter, queued echo can replace an already-read
peer value rather than requeueing it. The Genera companion makes this strict defect,
fast/listen behavior, and corrected-profile boundary normative.

The companion specifies every response. Standards RFCs are a cross-check; strict
selected-source output wins even when redundant or unusual.

### NVT character translation

Genera Telnet begins with an ASCII identity table and named Lisp-machine overrides.
Control reduces the base code to five bits. Meta flips ASCII letter case before
setting bit 7. Super and Hyper are not encoded by this filter. Unmapped codes are
consumed. Scroll moves locally forward; Meta-Scroll and Back-Scroll move locally
backward. Return emits CRLF when transmit-binary is false; IAC doubles.

The selected bounds check rejects values greater than octal 400, not greater than or
equal. Exact octal 400 can index past the 256-element table. `NT-G4521-U445-SRC`
strict-defect mode MUST reproduce the fault; corrected mode MUST be explicitly
labeled.

CADR character tables, modifier folding and gateway behavior are specified in the
CADR companion. Manual Lisp signatures and default Break/Network wording are not
authoritative when they contradict maintained code.

### SUPDUP and Intelligent Terminal Protocol

Strict SUPDUP tests MUST cover:

- terminal-variable count, packing, dimensions, option bits and location bytes;
- ASCII greeting consumption through the no-operation delimiter;
- literal protocol-escape quoting and nonzero bucky-bit encoding;
- logout and cursor-position reports;
- every implemented and explicit no-op display-code slot;
- old/new cursor coordinates and screen-bound behavior;
- erase, insertion/deletion, regions, reverse/attribute and reset;
- bell coalescing;
- GT40, ARDS, SUDS/local-editing and graphics state only in profiles that select
  those mechanisms; and
- malformed, truncated and out-of-range sequences with partial-render state.

RFC 734 describes SUPDUP as independent of Telnet and defines the initial terminal
variables, ITP quoting, display codes, and logout/location conventions. RFCs 736 and
749 describe distinct Telnet option paths. A recreation MUST keep native SUPDUP,
Telnet SUPDUP negotiation, and SUPDUP-OUTPUT framing distinct.

Genera ITP's complete octal 200–377 table and CADR's release-specific mapping are
normative companion inventories. Unmapped positions are consumed. Boundary handling
and malformed bucky quoting require byte tests.

### Other Genera protocol inputs

- 3600 ordinary characters emit the selected tag/modifier/code triple; only Logout
  among list events emits zero.
- TTY Interrupt flushes/finishes output and sends Break; other list events beep;
  codes at or above 128 become Escape plus low seven bits.
- CHAT consumes and beeps for every list event, so interrupt/logout list signals are
  unavailable through that filter.
- LISPM-null passes full Lisp characters to a character stream; exact list-event
  failure remains `TODO-ORACLE-G-LISPM-LIST`.

### 3600 output and SUPDUP-OUTPUT

The Genera 3600 decoder has eight selected opcodes and an initial geometry/location
exchange. Every opcode, operand length, cursor/display effect, malformed/truncated
case and initial exchange byte MUST be tested.

SUPDUP-OUTPUT is framed within Telnet negotiation and feeds counted Supdup display
records into the Supdup state block. Every counted-stream read, including effector
operands, decrements the count. Negative count is a hard error without success-trailer
consumption. Exact zero discards two arbitrary bytes, then short-circuits its trailer
check: a non-IAC candidate fails without reading another byte; only IAC causes one
more read, which must be SE. Prior display effects are not rolled back. It MUST NOT be
treated as a native SUPDUP connection. CADR's optional mouse report and who-line
change belong to its source profile; equivalent Genera behavior must be proven
separately.

## Display simulators

### Glass

Glass masks ordinary data to seven bits and implements printing, wrapping, tab,
bell, backspace, CR/LF and the selected CR lookahead. The lookahead MUST distinguish
LF, NUL, timeout, repeated CR and other-byte recursion. Tests MUST include end-of-
stream and error during lookahead.

### Imlac and old display facilities

Imlac, GT40, ARDS and SUDS names denote different historical mechanisms. A
recreation MUST use the selected companion inventory and MUST NOT collapse them into
one “graphics terminal” switch. That inventory includes Imlac's unchecked lower and
upper dispatch bounds and GT40's ten-cell item array, mutation-before-error order, and
checksum boundaries. CADR `telnet-front-hack.lisp` does not establish a separate user
application. Genera's remote-terminal server files do not expand the outgoing
simulator command table.

### ANSI, Ambassador, and VT100

The selected Genera ANSI parser implements an explicit subset. Unknown or unsupported
sequences are consumed/ignored. Cursor operations are delegated to the viewport
without an extra parser-level bounds check. SGR examines only the first parameter:
0, 1, 4, 5 and 7 select ordinary, bold, underline, blink and reverse state;
unsupported first values yield NIL/ordinary behavior. Blink is stored but has no
selected drawing branch, so source-profile rendering is ordinary.

VT100 installs only four directional input translations to ESC `[A`, `[B`, `[C`, and
`[D`. ESC `=` and `>` mutate a keypad-mode slot that this selected file never reads.
Device reports, cursor-position reports, broad keypad/function translation, tab
controls, REP, many modes, and many VT52 operations are not established features.
An implementation MUST test the dead keypad state and MUST NOT infer commented or
unread behavior.

The Genera companion gives the exact supported CSI/ESC inventory and Ambassador
deltas. Connected System 452.22 timing and pixels remain runtime oracles.

## Failure, abort, and recovery semantics

### Failure classes

Every test result MUST classify failure as one of:

- argument/parser cancellation or local accelerator error;
- host/path/service resolution failure;
- stream acquisition failure;
- greeting/negotiation failure;
- input translation failure;
- output decoding or display-effect failure;
- local command or option-application failure;
- file/journal failure;
- peer EOF/close/network state transition;
- process reset, interrupt, wait, acknowledgement or lock failure;
- disconnect/logout/close/reset failure; or
- window selection, exposure, bury, kill or reuse failure.

The trace MUST record the last completed stage, owned resources, bytes already sent,
display effects already committed, pending process wakeups, label, connection state,
and next recovery path.

### Strict partial-state behavior

Historical strict profiles MUST preserve effects committed before a fault. They MUST
not roll back display mutations, sent bytes, closed old wallpaper, earlier Network-X
options, committed stream, or already reset filter blocks unless the selected source
does so. Corrected atomic behavior MAY be offered as a separately named profile.

The test suite MUST inject a fault immediately before and after each connect and
disconnect stage, each simulator splice stage, every journal/transfer I/O call,
output-lock acquisition/release, process wait/acknowledgement, Telnet negotiation
write, Supdup operand read, and viewport mutation. Deadlock-prone cases require a
bounded harness timeout and an explicit “historical stall reproduced” result rather
than an unbounded test hang.

### Unbound and unsupported behavior

An unbound local key MUST follow the selected beep/cancel/fallthrough behavior. An
unsupported protocol operation MUST follow its explicit no-op, WONT/DONT, beep,
consume, error, or remote-pass rule. A missing optional menu handler MUST be absent,
not disabled-looking unless the historical resolver produces that state. A strict
profile MUST preserve source-visible table-boundary errors and stale Help where
selected; a corrected profile MUST list each correction.

## Visible interface requirements and runtime evidence

### CADR source-injected witness

![A sparse MIT CADR Supdup window with a white terminal surface and bottom label “Supdup 1 -- not connected”.](assets/mit-cadr-screenshots/supdup-disconnected.png)

*Runtime observation: a maintained-source Supdup window injected into the isolated
System 303-0 band, captured 2026-07-19. The sparse frame establishes the selected
surface, who-line, and disconnected label only. Underlying software and
display material remain the property of their respective rightsholders; reproduced
for criticism, scholarship, and historical documentation under 17 U.S.C. section
107. No affiliation or endorsement is implied.*

![A sparse MIT CADR Telnet window with a white terminal surface, top-left cursor, and bottom label “Telnet 2 -- not connected”.](assets/mit-cadr-screenshots/telnet-disconnected.png)

*Runtime observation: an explicitly constructed maintained-source Telnet shell in
the same isolated System 303-0 session. It establishes only the distinct Telnet label
and shared full-screen relationship. It does not prove successful process startup or
connection behavior. The same attribution, scholarly-purpose, no-endorsement, and
asset-license exclusions apply.*

The base band already reported prior definitions from `SYS: WINDOW; SUPDUP`, but its
live System Help exposed no System-S/System-T registrations. Loading the pinned
maintained source through the isolated FILE bridge accepted redefinitions. Supdup
could expose a window; its background type-in later encountered the expected absent
peer/path boundary. Ordinary `TELNET-SEPARATE` after source injection reached an
unbound `TYPEIN-PROCESS` state, so the second image was made by explicitly constructing
a Telnet window with NIL process slots and selecting its disconnected shell. These
facts MUST accompany the images; neither is a pristine compiled-band behavior claim.

System 46 remains a screenshot blocker: no matching runnable System 46 band is
configured. `TODO-ORACLE-C46-VISUAL` requires a legally sourced matching band and a
fresh reviewed capture rather than treating System 303 pixels as System 46.

### Genera runtime witness

![The Genera 8.5 Terminal activity: a blank full-screen terminal with a left scrollbar, prompt “Connect: (the name of a host)”, bottom label “Terminal 1”, and the who-line below.](assets/genera-screenshots/terminal-disconnected.png)

*Runtime observation: Genera 8.5/System 452.22 immediately after local login and
`Select T`, captured 2026-07-19. It establishes only the disconnected prompt, blank
surface, scrollbar, bottom label, who-line, and their relative geometry. Underlying
Symbolics software and display material remain the property of their respective
rightsholders; reproduced for criticism, scholarship, and historical documentation
under 17 U.S.C. section 107. No affiliation or endorsement is implied.*

The live prompt is `Connect: (the name of a host)`, not the manual article's wording,
and the rendered label is `Terminal 1`. The image cannot reveal the source-profile's
hidden label tag or prove when label recomputation occurred; that relationship remains
`TODO-ORACLE-G-INITIAL-LABEL`. The image contains no Help prose, source, peer data,
manual, artwork or private content. It does not establish completion choices,
connection, negotiation, commands, scrollback depth, simulator behavior, or
source-to-world identity.

### Runtime provenance

The CADR session `d10-network-terminal-cadr-20260719`, generation 1, ran from
2026-07-19 20:18:02 through 20:37:43 EDT. It used load band `System 303-0`; public and
private-start disk SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`;
System source check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`;
unchanged private System tree SHA-256
`21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`;
and `usim` start/execution SHA-256
`707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be`.
The 768-by-963 client was `LOCAL-CADR [running]`, XID 2097202. The final run record is
6,999 bytes with SHA-256
`6b5e4ce28ae58c4a0acf51e77e381b4abc33e26875abc89201112a7bb66a12b4`.
Shutdown was clean: `forced_stop=false`, `state_may_be_incomplete=false`, emulator
and Xvfb exit status zero, and public base disk unchanged.

The Supdup raw capture `0020-supdup-connect-prompt.png` is 768 by 963, PNG SHA-256
`52c53d7b51c3298a7eb037c815bbbb6c76dcfd19dd54ebf3549abb1e16bead02`,
pixel SHA-256
`3205f9174f16cdda83ce66ba03778e2452b9ee5f04c56411f83613ee1996e9e8`,
with 4,438-byte sidecar SHA-256
`244ed5b6c81790dfd00d39438bded3acea6124bf01cac62fcfe7305b072c3c52`.
The Telnet raw capture `0025-telnet-disconnected-shell.png` is 768 by 963, PNG
SHA-256
`310c63af5118102151afe2e9dd7025f2ddf564f34fb999762fee247aeb1dd802`,
pixel SHA-256
`bf54d03936d07b0c74d3071f124f53d7f923f3969ac75371ec172b61d3b7b6d9`,
with 4,442-byte sidecar SHA-256
`e5b78a6bfe6d2a244da3d3955f3d2f9f325a672bc110e4f4db7f4343f1d95cea`.

The Genera session `d10-network-terminal-genera-20260719`, generation 1, ran from
2026-07-19 20:18:06 through 20:38:02 EDT. The base/private-start world is 54,804,480
bytes with SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`;
VLM SHA-256
`9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`;
debugger SHA-256
`2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`;
and harness Python execution SHA-256
`c47ca320afb058d802ebd469fd9183e60ce5106eea15044295e98412700a5fcc`.
The 1200-by-900 main client was `Genera on DIS-LOCAL-HOST`, XID 2097158 at `(72,55)`.

The screenshot is an exact copy of raw `0003-terminal-disconnected.png`: 1,364 bytes,
PNG SHA-256
`767a9da73f8ec9c24b778cca9337a1f4cfcd66ed69527f48ac6a79edd4b2616c`,
pixel SHA-256
`33a071812b9d5467d9b94df81cc367a3012f1f88c778a464c31359174feddbca`,
with 13,757-byte sidecar SHA-256
`0dd4484920d5e20fa96f11ea4e30dba32c9823e170a9422cb20ed09eb1ad1e9b`.
The sidecar freezes the four-record action prefix at SHA-256
`e0cdc56994bf9a29b69d4c5f08391df47821eeec0ff418d11f5561bc2437dc52`:
local login and `Select T`, each with a successful linked outcome. A later Network-
Help probe stayed raw and untracked. The final six-record action log is 3,158 bytes,
SHA-256
`96928167fa6e35b4810ad2bfe6c9c9fdd639be084c09e44df8ac902266b84d83`.

The final Genera run record is 26,230 bytes with SHA-256
`dff005f4dfd273ccdb95bff977bdea5750765af25ff79aa4ac6e697129087b3c`.
The shutdown prompt was observed, `yes` sent and accepted, and cleanup progress
observed. The current VLM then reproduced its confirmed Cold Load mutex stall and
required bounded termination: `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`. The private world remained byte-identical. The
harness invoked no Save World and created no process checkpoint; save/checkpoint
state remains unknown except for those negative harness facts.

### Visual compatibility rules

`VISUAL-L1` requires semantic regions and relative relationships, not exact pixels:

- one full-screen terminal surface;
- logical cursor at the selected initial output position; a raster comparison MUST
  accept both blink phases, and the approved Supdup witness happens to show no visible
  cursor while the Telnet witness shows one;
- bottom application label and separate system who-line;
- CADR disconnected program/name suffix where selected;
- Genera left output-record scrollbar and prompt placement where selected; and
- no peer transcript in the disconnected state.

A product MUST NOT claim font, exact raster, gray level, cursor blink timing, border
thickness or pixel identity from these images. A screenshot comparison MUST mask the
host X position and compare semantic bounding relationships with recorded tolerances.

## Release deltas and strict defects

| Subject | Selected difference |
| --- | --- |
| System 46 selected entry | LMWIN System-S/System-T and Create-menu Supdup/Telnet routes; the selected file also supplies Lisp entry paths |
| System 46 shadow entry | LMIO1 Escape-N numeric dispatcher only; it is not grafted onto selected LMWIN or System 303 |
| System 303 entry | Create-menu and Lisp routes; no current System-S/System-T registrations |
| System 303 escape | maintained source default is Network; stale manual text may say Break; selected System 46 LMWIN instead defaults to Break and also recognizes physical Network while connected |
| explicit Internet socket | maintained parser is decimal despite octal Help/comment |
| Lisp signatures | maintained source differs from stale manual forms |
| CADR recording | alternate flavor only, not default Supdup |
| `telnet-code` / `telnet-front-hack` | compatibility experiments, not third applications; LM-character server work belongs to `telnet-code` |
| Genera prompt | runtime `Connect: (the name of a host)` |
| Genera initial label | source initializes a disconnected tag; runtime renders `Terminal 1`; their relationship is `TODO-ORACLE-G-INITIAL-LABEL` |
| Meta-Scroll | source intercepts backward local scroll despite manual limitation |
| Meta-W | source pushes/unmarks marked strings; manual “wipes” wording is misleading |
| Record Output | live source keyword omitted from manual keyword table |
| Help | curated and incomplete; Network-F and commands omitted |
| presentations | remote text has no semantic app objects, but CP/DW uses typed presentations and a narrow Terminal-input context |
| VT100 | four arrow translations and an unread keypad slot; no general report/function-key claim |
| simulator registry | selected source initial order is not proof of live mutable world registry |
| source/world | System 452.1 selected source and System 452.22 runtime stay separate |

Strict-defect modes MUST expose the Genera exact-octal-400 input table fault, dead
keypad-mode state, nontransactional connect/disconnect/options/simulator behavior,
first-IAC duplicate DO-Echo case, journal cursor approximation, and any CADR bounds or
protocol defects listed in its companion. Corrected modes MUST name each divergence.

## Extension points and module closure

The following are selected extension points rather than fixed enumerations:

- host database and network service protocols;
- Genera login-protocol declarations and desirability;
- terminal simulator registry and host substitutions;
- CP command table and command-name presentations;
- Dynamic Windows pointer/presentation handlers;
- Hardcopy and Image Substrate marking handlers;
- serial transfer formats;
- CADR protocol-specific method availability and window flavors; and
- site-defined menu/Peek host operations.

An extension MUST declare its owner, priority, applicability predicate, event or name,
state-block/filter insertion position, setup/reset order, Help exposure, failure
semantics, and profile. It MUST NOT change a strict profile's fixed denominator or
dispatch priority without creating a new profile.

The D10 module closure includes the outgoing CADR NVT and outgoing Genera Terminal
paths plus the shared dependencies required to explain them. It excludes incoming
Genera Remote Terminal administration, general networking implementation, site/host
database editing, printer internals, full Dynamic Windows, full TV, and generic CP
implementation except where normatively incorporated. Those belong to their own
dossiers/specifications.

## Conformance test suite

### Profile, artifact, and registration tests

- `NT-PROFILE-01`: reject an untagged mixture of release profiles.
- `NT-PROFILE-02`: verify every public pin and evidence-only artifact identity.
- `NT-PROFILE-03`: prove System 46 canonical/shadow separation.
- `NT-PROFILE-04`: prove Genera source/manual/runtime separation.
- `NT-ENTRY-C46-01`: enumerate selected LMWIN System-S/System-T, Create and Lisp
  routes; prove the Escape-N numeric tree exists only under the shadow-lineage label.
- `NT-ENTRY-C303-01`: enumerate maintained Create-menu/Lisp/Peek routes and absence
  of current System-S/System-T.
- `NT-ENTRY-G-01`: enumerate Select-T, force-create, Create, direct and Peek routes;
  test idle/pending/connected reuse.
- `NT-CLIM-01`: assert TV/Flavors on CADR and TV/DW/CP on Genera; reject a historical
  CLIM-use claim.

### Complete input tests

- `NT-C-BIND-01`: inject every CADR Network suffix, protocol availability variant,
  literal escape, Help/? alias, Rubout, unknown, cursor restoration and beep.
- `NT-C-BIND-02`: test separate versus bound exit/bury/return behavior.
- `NT-C-BIND-03`: inject every Lisp-machine character/list-event/modifier combination
  through Supdup and Telnet translators including table boundaries.
- `NT-G-BIND-01`: enumerate all 63 normalized fixed cells, case aliases and collision
  priority.
- `NT-G-BIND-02`: generate the exact `(kind,value)` argument automaton, including
  minus resets after Control-U/digits, minus then repeated Control-U, zero then
  Infinity, C-U/Infinity first-digit replacement, minus-zero sign loss, repeated
  digits, accepted/rejected leaves and Control-Meta-Y history modes.
- `NT-G-BIND-03`: Help repeat, ordinary successful exit, unknown reprompt, Rubout,
  literal escape, and escape-shadowing matrix.
- `NT-G-BIND-04`: test disconnected CP/Input Editor and Network-X Accepting Values
  incorporated trees.
- `NT-G-BIND-05`: exhaust all 96 raw pointer cells, winning handlers, optional
  Hardcopy/Image handlers, application marked-text behavior and unbound fallthrough.
- `NT-G-BIND-06`: execute Help command presentations and command-name presentations,
  including `TODO-ORACLE-G-HELP-CY`.

### Lifecycle and state tests

- `NT-C-LIFE-01`: initial label, lazy process start, select/expose, reuse, connected
  resize rejection and process list.
- `NT-C-LIFE-02`: separate versus resource-bound ownership and selection substitute.
- `NT-G-LIFE-01`: all initial fields and the bounded live label/prompt; Create-fresh,
  generic Select reuse/Control-force-create, direct/Peek first-eligible lookup,
  process-flush-before-target order, pending-target exclusion, and no-eligible fresh
  allocation as distinct routes.
- `NT-G-CONNECT-01`: option precedence and all 18 ordered connect stages.
- `NT-G-CONNECT-02`: fault immediately before/after each stage and assert leaks/
  partial state.
- `NT-G-DISCONNECT-01`: all nine teardown stages, logout order, second-cleanup and
  fault matrix.
- `NT-G-PERSIST-01`: reconnect persistence/reset of More, recording, overstrike,
  echo, escape, wallpaper, simulator, history and state blocks.
- `NT-PROC-01`: two actors, write lock, type-out error handoff, output tick, simulator
  race, reset and bounded deadlock behavior.

### Host, command, option, and file tests

- `NT-C-PATH-01`: every host/contact/gateway/socket form, associated machine,
  decimal/octal discrepancy and failure class.
- `NT-G-PATH-01`: all seven connection keywords, service selection, wrong stream kind,
  case-sensitive simulator names and host defaults.
- `NT-G-CMD-01`: all 16 unique command definitions; parser-only Connect; Help
  omissions; numeric rejection.
- `NT-G-OPTION-01`: Accepting Values cancel/success and exact nontransactional apply
  order with every failure position.
- `NT-G-MORE-01`: pending More with ordinary event, escape, repeated state, error and
  disconnect.
- `NT-G-SEND-01`: Send String versus recorded-text yank with embedded escape.
- `NT-G-FILE-01`: raw/nonraw send, receive, format defaults, partial I/O, cancel,
  callback stall, disconnect and label restoration.
- `NT-G-WALL-01`: exact journal bytes for text/effectors/cursor moves and all failures.

### Protocol and simulator tests

- `NT-TELNET-01`: full first-IAC and steady-state command/option matrix, binary,
  local echo including retained queue and scalar replacement, CR, IAC, malformed
  subnegotiation and unknowns for each selected family.
- `NT-SUPDUP-01`: terminal variables, greeting, every display slot, ITP table,
  modifiers, logout, graphics/old-display closures, malformed/truncated input and
  partial effects.
- `NT-SUPDUP-OUTPUT-01`: Telnet negotiation versus native SUPDUP; count every opcode
  and operand read, exact-zero trailer success, negative-count no-trailer failure,
  non-IAC short-circuit versus IAC/non-SE consumption, truncation at every read, and
  retained partial display effects.
- `NT-G-3600-01`: input triples, logout, initial exchange and all eight output opcodes.
- `NT-G-TTY-01`: ordinary, high-bit, Break, unsupported list event and flush order.
- `NT-G-CHAT-01`: ordinary and every list-event beep/consume path.
- `NT-G-LISPM-01`: character-stream behavior and `TODO-ORACLE-G-LISPM-LIST`.
- `NT-G-GLASS-01`: all controls and CR lookahead cases.
- `NT-G-IMLAC-01`: binary/CR paths, literal escape operand 1, valid operands 2
  through octal 201, lower/upper unchecked bounds, and force-before-index-error order.
- `NT-G-ANSI-01`: exact supported ESC/CSI inventory, unsupported consumption, defaults,
  first-only SGR, attributes, bounds, ordinary blink and malformed input.
- `NT-G-VT100-01`: four arrow translations, keypad-slot mutation/no-read, and absence
  of unimplemented report/function behavior.

### Runtime, visual, rights, and provenance tests

- `NT-RUN-C303-01`: reproduce System Help registration result and source bridge load;
  distinguish compiled definition, source-injected Supdup, and explicit Telnet shell.
- `NT-RUN-G85-01`: local login plus `Select T`; compare prompt, label, scrollbar,
  surface, who-line and geometry.
- `NT-RUN-PEER-TELNET-*`: deterministic no-route peer with exact byte trace, display
  checkpoints, faults and cleanup.
- `NT-RUN-PEER-SUPDUP-*`: equivalent native SUPDUP peer.
- `NT-RUN-PEER-TELSUP-*` and `NT-RUN-PEER-3600-*`: profile-selected peers.
- `NT-RIGHTS-01`: exact reviewed asset bytes, limited scholarly placement,
  attribution/no endorsement, project-license exclusion and no raw/build links.
- `NT-PROVENANCE-C-01`: join CADR sidecars to final `run.json`, including
  `usim_sha256_at_exec`, clean stop and unchanged base.
- `NT-PROVENANCE-G-01`: join Genera sidecar prefix to final action/run records,
  isolation, exact substitutions, time reply, forced shutdown stages, unchanged
  world and Save World/checkpoint unknowns.

### Acceptance rule

A conformance report MUST list every selected test ID as pass, fail, not applicable,
or unresolved oracle. `L1` may leave connected tests unresolved. `L2` may not omit an
input leaf. `L3` may not leave a selected protocol byte grammar or fault stage
untested. `L4` may not claim a connected closure while any corresponding
`NT-RUN-PEER-*` or source/runtime identity oracle is unresolved.

## Preserved-system comparison procedure

### CADR

1. Start a fresh named CADR harness session and record load band, public revisions,
   private copy-time revisions/tree hashes, disk hashes, microcode/symbol hashes,
   toolchain and both start/execution `usim` hashes.
2. Complete boot without configuring an external peer.
3. Record live System Help before source injection.
4. If a source-profile comparison is required, load only the exact pinned public
   file through the private FILE bridge and record every redefinition/error.
5. Exercise disconnected entry and local commands with an inert network adapter.
6. For `L3/L4`, start a scripted peer inside the isolated environment and record both
   byte directions and display checkpoints.
7. Stop cleanly where possible and join every screenshot sidecar with `run.json`.
8. Label source-injected, compiled-band, partial-definition and historical-source
   observations independently.

### Genera

1. Start a fresh named Genera harness generation from the licensed local archive and
   record every base/private artifact, helper, preload, responder and configuration
   hash.
2. Verify the Bubblewrap filesystem/process/network boundary, absent external route,
   absent guest-visible file service, absent MIT-SHM, and both exact X-protocol
   substitutions before accepting `running`.
3. Log in locally and use `Select T`; record every intent before XTEST dispatch and
   its linked outcome afterward.
4. Capture only sparse states required by a predeclared scholarly claim. Keep Help,
   manuals, peer content and raw sequences ignored absent separate review.
5. For connected testing, install only a deterministic project-owned peer inside the
   throwaway namespace. Do not add a host route or real login credentials.
6. Stop through the harness and record prompt, confirmation, acceptance, cleanup,
   forced-stall, orderly-host-shutdown and world-change fields separately.
7. Keep `save_world_performed` and `guest_checkpoint_created` unknown unless another
   oracle proves them; a changed world hash alone is insufficient.

## Known unknowns and nonclaims

- `TODO-ORACLE-C46-VISUAL`: matching System 46 runtime surface and entry behavior.
- `TODO-ORACLE-C303-BASE-NVT`: pristine base-band route to compiled Supdup/Telnet
  without source injection, if one exists beyond direct internal construction.
- `TODO-ORACLE-C303-PEER-*`: successful CADR native Supdup, gateway Telnet,
  SUPDUP-OUTPUT, interrupt, logout, More and display-effect runtime behavior.
- `TODO-ORACLE-C303-SOURCE-BAND`: definition-by-definition relationship between the
  private System `303-0` band and maintained source.
- `TODO-ORACLE-G-SOURCE-WORLD`: definition-by-definition relationship between
  selected System 452.1 source and System 452.22 world.
- `TODO-ORACLE-G-REGISTRIES`: exact live login-protocol, simulator, presentation and
  optional pointer-handler residency.
- `TODO-ORACLE-G-HELP-CY`: pointer activation of the argument-less Control-Y Help
  command presentation.
- `TODO-ORACLE-G-KILL-CLEANUP`: inherited stream cleanup after killing Terminal.
- `TODO-ORACLE-G-LISPM-LIST`: list-event behavior on the character-stream protocol.
- `TODO-ORACLE-G-HISTORY-*`: connected scrollback depth and destructive-output
  behavior for each protocol/simulator combination.
- `TODO-ORACLE-G-PEER-*`: all connected System 452.22 negotiation, transfer,
  wallpaper, interrupt, logout, simulator and failure behavior.
- `TODO-ORACLE-G-BLINK`: runtime rendering/timing of selected blink state.
- `TODO-ORACLE-G-IMAGE-HANDLER`: Image Substrate handler residency in the exact world.

No claim is made that an Internet host is reachable, that the preserved world is a
configured Symbolics site, that any real credential works, that remote login is safe
against an uncontrolled peer, that the journals or output records are durable, or
that the screenshots establish a complete application appearance. No incoming Remote
Terminal server specification is included. No manual prose, licensed source, decoded
Help, world data, font, or peer transcript is redistributed.

## Sources

- [MIT CADR System 46 source snapshot](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src), including the canonical `LMWIN`
  and comparison `LMIO`/`LMIO1` files; verified 2026-07-19.
- Maintained LM-3 [`window/supdup.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsupdup.lisp),
  [`window/sysmen.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsysmen.lisp), and
  [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp), pinned at check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`;
  verified 2026-07-19.
- [Recovered System 46 Supdup Help contexts](assets/mit-cadr-online-help/source/lmwin/supdup.105.help.lisp)
  and [Escape-N dispatcher](assets/mit-cadr-online-help/source/lmio1/escape.6.help.lisp).
- Licensed local Genera artifacts identified in the evidence ledger, inspected
  2026-07-19; not redistributed.
- RFC Editor primary copies of [734](https://www.rfc-editor.org/rfc/rfc734.html),
  [736](https://www.rfc-editor.org/rfc/rfc736.html),
  [746](https://www.rfc-editor.org/rfc/rfc746.html),
  [747](https://www.rfc-editor.org/rfc/rfc747.html),
  [749](https://www.rfc-editor.org/rfc/rfc749.html),
  [727](https://www.rfc-editor.org/rfc/rfc727.html),
  [854](https://www.rfc-editor.org/rfc/rfc854.html),
  [855](https://www.rfc-editor.org/rfc/rfc855.html),
  [856](https://www.rfc-editor.org/rfc/rfc856.html),
  [857](https://www.rfc-editor.org/rfc/rfc857.html),
  [858](https://www.rfc-editor.org/rfc/rfc858.html), and
  [860](https://www.rfc-editor.org/rfc/rfc860.html); verified 2026-07-19.
- [CADR computer-use harness](mit-cadr/cadr-computer-use-harness.md),
  [Genera computer-use harness](genera/genera-computer-use-harness.md), and
  [screenshot publication rights review](screenshot-publication-rights-review.md).

Last verified: 2026-07-19.

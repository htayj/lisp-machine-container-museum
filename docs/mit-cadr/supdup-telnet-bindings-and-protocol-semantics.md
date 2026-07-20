---
type: Reimplementation Specification
title: CADR Supdup and Telnet bindings and protocol semantics
description: Normative release-bounded CADR and LM-3 contract for Supdup and Telnet input trees, lifecycle, host parsing, wire protocols, display simulators, failures, and conformance tests.
tags: [mit-cadr, lm-3, supdup, telnet, chaosnet, terminal, tv, reimplementation, protocol]
timestamp: 2026-07-19T21:52:51-04:00
---

# CADR Supdup and Telnet bindings and protocol semantics

## Status and reconstruction claim

This page is the normative CADR companion to the
[network-terminal applications reimplementation specification](../network-terminal-applications-reimplementation-specification.md).
It separates four evidence and compatibility boundaries which must never be averaged:

- `C46-LMWIN-105`, the selected public System 46 implementation in
  `LMWIN; SUPDUP 105`;
- `C46-LMIO-196` and `C46-ESCAPE6`, comparison-only shadow lineage in
  `LMIO; SUPDUP 196` and `LMIO1; ESCAPE 6`;
- `C303-4DF-SRC`, maintained LM-3 System 303 source at the exact Fossil check-in
  named below; and
- `C303-3030-RUN`, the exact preserved `System 303-0` runtime witness, including
  its missing System-S/System-T registrations and the separately source-injected
  Supdup and Telnet shells.

These are aliases for, or subdivisions of, the main specification's profiles:

| Companion profile | Main D10 profile | Relation |
| --- | --- | --- |
| `C46-LMWIN-105` | `NT-C46-LMWIN-105-SRC` | Identical selected-source profile |
| `C46-LMIO-196` | `NT-C46-LMIO-196-SHADOW` | Shadow NVT implementation only |
| `C46-ESCAPE6` | `NT-C46-LMIO-196-SHADOW` | Old-window Escape-N subdivision of the same shadow-lineage profile |
| `C303-4DF-SRC` | `NT-C303-4DF-SRC` | Identical maintained-source profile |
| `C303-3030-RUN` | `NT-C303-303-0-RUN` | Identical bounded runtime-witness profile |

For `C46-LMWIN-105` and `C303-4DF-SRC`, this document is sufficient to recreate the
source-visible architecture, application-owned input and pointer behavior, window
reuse, connection ordering, host grammar, SUPDUP and Telnet byte transformations,
display effectors, graphics engines, persistence, partial failures, and selected
historical defects. It defines tests needed to promote those source contracts to
behavioral compatibility.

“Complete input tree” means complete for the selected application files and the
finite inherited TV surfaces explicitly incorporated here. It includes connected and
disconnected contexts, every local prefix leaf, modifiers, pointer routing, Help,
numeric and repeat behavior, shadowing, fallthrough, and unbound input. It does not
mean that a source tree proves which definitions were resident in every load band.

This page does **not** claim:

- that maintained LM-3 source is pristine MIT release media;
- that `C303-4DF-SRC` was compiled unchanged into `System 303-0`;
- a successful Supdup or Telnet peer session in either preserved runtime;
- source, QFASL, ABI, memory-layout, packet-timing, font, or pixel compatibility;
- that the old LMIO and selected LMWIN implementations were simultaneously active;
- CLIM, Dynamic Windows, presentation-system, or command-table behavior; or
- that the two source-injected shell screenshots prove process, connection, parser,
  key-dispatch, protocol, or cleanup behavior.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. “Then” specifies observable
order and does not imply rollback. Octal numbers use an `0o` prefix in this document,
even where the historical file instead established Base 8 for bare literals.

A strict source profile preserves the selected source's order and defects. A safer
implementation MAY offer corrected behavior only through a separately named option
listed under [Safety-corrected options](#safety-corrected-options).

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C46-SRC` | Public System 46 readable source at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | Selected LMWIN NVT, Supdup, Telnet, System-key and Create-menu source behavior | Runtime residence or LMIO behavior |
| `C46-LINEAGE` | Public source at the same commit | Old LMIO NVT and Escape-N lineage | Selection in the LMWIN profile |
| `C46-MAN` | Public System 46 operator-manual source | Documented local commands and user vocabulary | Exhaustive implementation behavior |
| `C303-SRC` | Maintained LM-3 source at Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | Exact selected source bodies, state, dispatch, order, and defects | Historical originality or load-band residence |
| `C303-SUB` | TV, process, Chaos, keyboard, menu, Peek, and microcode source at that check-in | Inherited routing, menu registration, connection states, and signed BITBLT meaning | Application-owned behavior absent from those files |
| `C303-MAN` | Maintained manuals and release notes at that check-in | Intended operation and historical vocabulary | Completeness or authority over contradictory source |
| `C303-RUN` | Isolated Xvfb sessions named below | Exact exercised band state and bounded visible shells | Unexercised dispatch, hidden state, peer I/O, or source identity |
| `INTERP` | Implementation-independent test model | A portable representation preserving established observations | Historical representation |
| `TODO-RUNTIME-*` | Named runtime obligation | The exact probe still required | A result |

When witnesses disagree, `C46-SRC` controls `C46-LMWIN-105`, `C303-SRC` controls
`C303-4DF-SRC`, and `C303-RUN` controls only the exact action and frame recorded in
`C303-3030-RUN`. Manual and runtime differences remain explicit; they are not resolved
by choosing the newest or most convenient witness.

## Compatibility levels

This companion uses the main D10 cumulative levels:

| Level | CADR closure required |
| --- | --- |
| `L1` disconnected shell | Profile-tagged window creation/reuse, disconnected label and prompt, cancellation, no-peer lifecycle, and bounded visible layout |
| `L2` local interaction | `L1` plus every effective key, prefix, modifier, context, pointer, menu, Help, shadow, fallthrough, numeric, repeat, and unbound path defined here |
| `L3` protocol and display | `L2` plus exact host parsing, lifecycle order, ITP/Telnet wire bytes, effectors, graphics, simulators, malformed input, and deterministic peer tests |
| `L4` preservation comparison | `L3` plus exact preserved-runtime comparison, endpoint traces, selected defect results, visual checkpoints, and closure of all mandatory runtime oracles |

`C46-LMWIN-105/L3` and `C303-4DF-SRC/L3` remain source-profile targets until their
test suites pass. `C303-3030-RUN` currently establishes a narrow registration and
static-shell boundary, not even a pristine source-profile `L1` application run.

## Release and artifact profiles

### Public System 46

The public Git revision is
[`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af).
Paths below are relative to its `src/` directory.

| Artifact | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| [`lmwin/supdup.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/supdup.105) | 45,341 | `71e93d749b5a0857ef04a79d0258df30119961d7e5e20837169aecd3024806fb` | Selected LMWIN NVT, Supdup, and Telnet implementation |
| [`lmwin/stream.14`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/stream.14) | 41,227 | `3a41c4752da5b84f2ed88b1b8e3c215c54ceda75f4db28d3bb461fdc2e30b499` | Selected TV stream and rubout-handler behavior |
| [`lispm/qfctns.438`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qfctns.438) | 74,495 | `3cecf056aec73028852814edfa0acf0226495226604721c56a98a323c43ea764` | `READLINE` dispatch and line termination |
| [`lispm/qmisc.281`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qmisc.281) | 62,028 | `ed80c13e4d51f5d9b3132a8f193673f081f25d310835087c40cc8c9b08d063ad` | Selected `FILLARRAY` list-tail semantics |
| [`lispm/qcom.437`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qcom.437) | 45,842 | `f991be2020b3b5123919d57ef7451483e88cb49f8d94c31db6882c6678365681` | Eight-bit keyboard code and four modifier-bit fields |
| [`lmio/supdup.196`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/supdup.196) | 44,797 | `f221549a84e3c1db5634e5bb06a87a1eab17ff8baa470b10bdfc57105aa3ac64` | Shadow old-window implementation |
| [`lmio1/escape.6`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/escape.6) | 18,149 | `67f279a52db74340df57c4d1e1c8e83d454287aac1d8058b77412fdd63328f32` | Shadow Escape-N dispatcher |
| `lispm/pkgdcl.230` | 12,516 | `2d08a109871868990f10e1334a8b4d5199ac7c530bb50b04b93d5f552a83e1b9` | Selected module inventory |
| `lmdoc/lispm.files` | 3,373 | `8d7edb5327f1f54235946ca053f289881b9df04eb84d72f3228b74175172d396` | Load-list cross-check |
| [`lmwin/basstr.163`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/basstr.163) | 37,385 | `19e0771ff876d5325f18b97a2ccbf392f7d5950d3a89751d633d27d7cbe01e72` | Initial System-key registry |
| [`lmwin/sysmen.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sysmen.105) | 28,436 | `c203bc08b5550edefb1928349179fc54c483655d273077294211eb778daff6f1` | Create-menu registry |
| [`lmwind/operat.27`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/operat.27) | 85,337 | `a5ab658210dc09891b0886b58af705368e33a41f013073c8b9a637d99ab0f02d` | Operator-manual cross-check |

`lispm/pkgdcl.230:96-98` and `lmdoc/lispm.files:148-149` select
`AI: LMWIN; SUPDUP QFASL`. Therefore `lmwin/supdup.105`, not the similarly named
LMIO file, controls `C46-LMWIN-105`. The LMWIN file includes its own older Telnet
engine. It is part of the selected file even though later C303 Telnet features are
absent.

### Maintained LM-3 System 303

The public Fossil check-in is
[`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
tagged `system-303` and dated 2025-01-06. It is a maintained restoration branch, not
a claim that the check-in itself is an original MIT release artifact.

| Artifact | Bytes | SHA-256 | Principal role |
| --- | ---: | --- | --- |
| [`window/supdup.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsupdup.lisp) | 110,143 | `e329911a2860d69976890f05c4a1c5fbf69f44b7831cb9fd72fe07fa81e28ca4` | NVT, Supdup, Telnet, graphics and optional local editing |
| [`sys/qmisc.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fqmisc.lisp) | 83,123 | `d8c022999c40033b0073c0bec364fbe28ac20c4aa4ecb77afa4c70d1bfc9d840` | Maintained `FILLARRAY` list-tail semantics |
| [`doc/common.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fcommon.lisp) | 147,574 | `1df840d3244c01c3fd12dce6a96aae6e7d1c4cad90547f69c30ab027bf7562de` | `CHAR-CODE-LIMIT = 0o400` and `CHAR-BITS-LIMIT = 0o40` |
| historical `window/supdup.lisp.322` | 114,866 | `5889fbf54bc675517454c643f5343a1d5c431dcde87b000103a4208e72c6c180` | Immediate source predecessor retaining S/T registration |
| [`window/telnet-code.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Ftelnet-code.lisp) | 4,841 | `148391ab294efe5f2c099352226cbc0e785185c473b5e4f08212903cf6ac20bf` | Unselected LM-character stream/server experiment |
| [`window/telnet-front-hack.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Ftelnet-front-hack.lisp) | 110,413 | `199a901c0d6da0fcf68ee6d8e9244cfd015f15fe1ca877e39eff126e1feeccc9` | Unselected compatibility copy |
| [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp) | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` | Selected system declaration |
| [`window/basstr.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbasstr.lisp) | 81,846 | `8ba3a16e726ed043e6585c7a68b7096bb2dcc5d6f05476afd89f84a48dff2645` | System-key infrastructure |
| [`window/sysmen.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsysmen.lisp) | 43,408 | `b53b7c3d5a59040f3180d5be0d2072b2a334bb386fa5e19dd6abbd945148b40c` | Create-menu registry |
| [`window/mouse.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fmouse.lisp) | 57,256 | `facf7f3dd979a758bd70b0644120ccceb0f243188acd180dcbf0a70a836ec6b2` | Generic pointer routing |
| [`window/peek.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fpeek.lisp) | 46,418 | `fa0f22439888127aa59a1dbea1efe57d3587f4663fd8fdce6a647c852a88b9ff` | Peek host action integration |
| [`network/chaos/peekch.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=network%2Fchaos%2Fpeekch.lisp) | 17,890 | `0078cfd4571e238440ce2c8704e9a2f2ba0464ab5b9f10bf4510d5e194c32f35` | Peek host menu construction |
| [`man/chaos.text`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Fchaos.text) | 67,976 | `d8219acd0c11c046b7c865b053a5ed6fb34598f2def50a3671cae3d5b2339e6b` | Chaos/Supdup manual cross-check |
| [`wind/operat.text`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=wind%2Foperat.text) | 105,069 | `3129801c6193035feb527c24ec65942a9b5b6b57cbaf9dcddc4372214ad47a97` | Operator-manual cross-check |

`sys/sysdcl.lisp:174-176` loads only `SYS: WINDOW; SUPDUP`. The current
`window/supdup.lisp` is byte-identical to revision `.323`; it compiles the flavors
and preactivates one Supdup at lines 2941-2945 but does not register System-S or
System-T. Revision `.322:3097-3098` did. The current Create menu still contains
Supdup and Telnet at `window/sysmen.lisp:155-169`.

All sizes and hashes in these two ledgers were rechecked with GNU `stat` and
`sha256sum` on 2026-07-19.

## Evidence map

| Contract | C46 witness | C303 witness | Status |
| --- | --- | --- | --- |
| Flavor/state model | `lmwin/supdup.105:15-77,298-376,969-1007` | `window/supdup.lisp:6-123,859-963,2538-2647` | Source normative |
| Entry and reuse | `lmwin/supdup.105:305-350,982-992`; `basstr.163:690-697`; `sysmen.105:121-128` | `supdup.lisp:859-951,2554-2630`; `sysmen.lisp:155-169` | Source normative; runtime registration differs |
| Typein/lifecycle | `lmwin/supdup.105:82-200,276-296` | `supdup.lisp:120-396,490-546` | Source normative |
| Complete Network tree | `lmwin/supdup.105:203-262` | `supdup.lisp:324-488` | Source normative |
| Disconnected input editing | `lmwin/supdup.105:150-196`; `lmwin/stream.14:242-348`; `lispm/qfctns.438:1376-1405` | `supdup.lisp:298-359` | Release-specific source normative |
| Character code/modifier domain | `lispm/qcom.437:185-188` | `doc/common.lisp:1272-1286` | Eight-bit codes; four versus five character-bit values |
| SUPDUP input/display | `lmwin/supdup.105:378-968` | `supdup.lisp:964-2536` | Release-specific source normative |
| Array initializer tails | `lispm/qmisc.281:621-634` | `sys/qmisc.lisp:582-600,643-647` | Source normative: final list element repeats |
| Telnet | `lmwin/supdup.105:969-1197` | `supdup.lisp:2538-2912` | Release-specific source normative |
| Pointer | Generic TV plus no C46 Telnet mouse handler | `window/mouse.lisp:824-843`; `supdup.lisp:2649-2678,2847-2870` | Source normative |
| Manual UI | `lmwind/operat.27:1609-1656` | `wind/operat.text:1878-1925`; `man/chaos.text:1488-1503` | Conflicts recorded below |
| Runtime registration and static shells | none | `software-catalog-20260718` and `d10-network-terminal-cadr-20260719` | Narrow runtime witness |

## Architecture and ownership boundary

```text
TV keyboard and mouse routing
  -> selectable full-screen NVT window or temporary selection substitute
      -> BASIC-NVT
          -> typein process: keyboard / local prefix -> locked peer writes
          -> typeout process: peer reads -> buffered display mutation
          -> BASIC-SUPDUP -> ITP + %TD + graphics/GT40/ARDS
          -> BASIC-TELNET -> NVT/IAC + optional Imlac/SUPDUP-OUTPUT
      -> Chaos connection or Chaos-to-Internet gateway contact
```

The applications use Flavors and the TV window system. System 46 explicitly uses
TV label, stream, window, save-bits, I/O-buffer, window-bind, and full-screen-hack
facilities. C303 uses the same family with process resources, selection substitutes,
TV Help streams, raw display primitives, and generic mouse blips. No selected source
dependency defines or invokes a CLIM application frame, CLIM port or graft, pane,
presentation type, translator, command table, or redisplay protocol. No Dynamic
Windows substrate is present. `[C46-SRC] [C303-SRC] [C303-SUB]`

The inherited TV contracts are normative by reference:

- [the TV window-system specification](tv-window-system-reimplementation-specification.md)
  controls sheets, selection, saved bits, process ownership, I/O buffers, More,
  mouse overseer, menus, and full-screen relationships; and
- [D02's CADR keyboard-prefix trees](../program-selection-activities-and-window-management-reimplementation-specification.md#cadr-keyboard-prefixes)
  control global Terminal and System interception, typeahead transfer, System Help,
  selection, Create menus, and unknown global suffixes.

This application companion controls only the behavior below those inherited dispatch
points. A recreation using CLIM as a porting technology MUST describe CLIM as its own
implementation choice, not as historical CADR behavior.

## Semantic objects and state

### NVT instance

A portable reconstruction MUST expose an equivalent of this state record for tests:

```text
NvtInstance {
  profile
  protocol                   // Supdup or Telnet
  window_identity
  label
  selected, exposed, active
  escape_character
  pending_target             // historical CONNECT-TO
  connection                 // NIL or Chaos connection object
  stream                     // may retain a closed stream after disconnect
  typein_process, typeout_process
  terminal_stream_or_window
  output_buffer
  output_lock_owner
  return_to_caller
  overprint                  // C303 only
  black_on_white             // C303 only
  alias_window               // bound overlay, C303
  program_name
  protocol_state
  display_state
}
```

The historical source does not use this aggregate literally; it is `INTERP`. Fields
MUST remain independently observable because the strict source permits combinations
such as a label changed before greeting completion, a non-NIL stream with no
published connection, or a closed stream retained after disconnect.

### Process and connection invariants

1. A normal separate C303 window has one typein and one typeout process. A bound
   overlay borrows the caller's current process for typein and a process resource for
   typeout. `[C303-SRC]`
2. Both local typein and protocol commands may write the peer. `OUTPUT-LOCK` MUST
   serialize each historical lock scope and MUST unwind only when the current process
   owns it. `[C46-SRC] [C303-SRC]`
3. `CONNECTED-P` is true only when `CONNECTION` is non-NIL and its Chaos state is
   `OPEN-STATE`; a non-NIL object alone is insufficient.
4. Deselect/bury through Call or P MUST retain a live connection. Q, D, and successful
   L paths close it.
5. Disconnected state MUST not send ordinary keyboard input. Prefix commands that do
   not require a peer may still run in C303.
6. C303 typeout MUST not begin reading peer output before `CONNECTION` is published.
7. A strict profile MUST preserve mutations before later failure; none of the
   connection, graphics, GT40, ARDS, local-edit, or Telnet parsers is transactional.

### Protocol-specific state

Supdup adds cursor/display state, output-buffer contents, graphics bounds and modes,
and global GT40/ARDS compatibility state. Optional `RECORDING-SUPDUP` adds a recorded
screen model; `LOCAL-EDITING-SUPDUP` adds resynchronization, local command tables,
margins, word syntax, and insertion mode.

C303 Telnet adds:

```text
new_telnet
more_waiting
echo_flag
simulate_imlac
binary_output
supdup_output
```

System 46 Telnet has only `NEW-TELNET-P`, `MORE-FLAG`, `ECHO-FLAG`, and
`SIMULATE-IMLAC-FLAG`. Its echo flag has different source-visible use and MUST not be
interpreted through C303 semantics.

## Entry, selection, and reuse

### System 46 selected profile

`C46-LMWIN-105` has these routes:

| Route | Exact result |
| --- | --- |
| System-S | TV selects or creates flavor `SUPDUP:SUPDUP` |
| System-T | TV selects or creates flavor `SUPDUP:TELNET` |
| Create / Supdup | TV creates a `SUPDUP:SUPDUP` window |
| Create / Telnet | TV creates a `SUPDUP:TELNET` window |
| `(SUPDUP path mode)` | True mode chooses `SUPDUP-SEPARATE`; NIL chooses a bound overlay |
| `(TELNET path simulate-imlac window)` | Always runs a temporary bound Telnet overlay |

The initial System registry is at `lmwin/basstr.163:690-697`; Create choices are at
`lmwin/sysmen.105:121-128`. `SUPDUP-SEPARATE` selects an already-connected Supdup
when path is NIL; otherwise it reuses an idle Supdup or creates one, assigns the path,
exposes cleanly, and selects it. It returns NIL for connected reuse and true for the
new/reconnect path (`lmwin/supdup.105:312-350`).

The selected file has no `TELNET-SEPARATE` function. Generic TV System/Create
construction can instantiate its `TELNET` flavor, while the callable `TELNET`
function itself is bound-only (`lmwin/supdup.105:969-992`). A reconstruction MUST
not borrow C303's later Telnet window list or `TELNET-SEPARATE` semantics.

### C303 source profile

`C303-4DF-SRC` has these source-defined routes:

| Route | Exact result |
| --- | --- |
| Create / Supdup | Creates the registered Supdup flavor through TV's Create menu |
| Create / Telnet | Creates the registered Telnet flavor through TV's Create menu |
| `(SUPDUP path mode)` | True mode selects separate behavior; NIL uses a bound overlay |
| `(TELNET path mode)` | True mode selects separate behavior; NIL uses a bound overlay |
| `SUPDUP-SEPARATE`, `TELNET-SEPARATE` | Connected reuse for NIL path; otherwise idle reuse or creation |
| `SUPDUP-BIND`, `TELNET-BIND` | Selection-substitute overlay over the caller's selected window |
| Peek host actions | Invoke Supdup or Telnet for the selected host when the handler is present |

The default `SUPDUP-MODE` is true, despite its contradictory docstring saying
“NIL => New window default” (`window/supdup.lisp:859-890`). Separate functions first
search the appropriate ordinary-window list. With NIL path and a connected match,
they select it and return NIL. Otherwise they reuse an idle instance or construct
one, choose `path`, configured default, or associated machine in that order, assign
`CONNECT-TO`, expose cleanly, select, and return true (`894-905`, `2565-2577`).

Bound mode creates a resource window with the caller's edges, aliases it to the
caller, borrows the current process for typein, presets a resource typeout process,
and runs within `WITH-SELECTION-SUBSTITUTE` (`907-931`, `2588-2630`). Q or an abort
restart returns through the bound call rather than leaving a separate selected
instance.

Current source has Create-menu entries but no S/T System-key registrations. The
manual's S/T claim and `.322` registration do not authorize adding them to
`C303-4DF-SRC`.

## Complete effective input and gesture trees

### Dispatch precedence

For C303 connected input, precedence is:

```text
hardware input
  -> inherited TV global Terminal/System/asynchronous handling
  -> NVT ANY-TYI
      -> cons/error/More/pointer branch
      -> scalar Chaos-state check
      -> configured escape comparison after CHAR-UPCASE
          -> local Network-command prefix
          -> otherwise protocol translation
```

Super-image mode removes the ordinary asynchronous-character table and suppresses
normal Abort/Break handling, but it does not replace the inherited global Terminal
and System prefix contract. `[C303-SRC] [C303-SUB]`

### C303 connected scalar and blip input

`BASIC-NVT :TYPEIN-TOP-LEVEL` at `window/supdup.lisp:253-320` MUST behave as follows:

| Input | Result |
| --- | --- |
| `(:ERROR reason)` | Exit connected loop with `reason` |
| `(:MORE)` | Invoke protocol `:MORE-TYI` |
| Other cons/blip | Invoke protocol `:NET-OUTPUT-TRANSLATED` |
| Scalar while Chaos state is open | Continue with escape comparison or protocol translation |
| Scalar after host-down, close, LOS, or unknown state | Exit with the corresponding source string |
| Scalar whose uppercased value equals `ESCAPE-CHAR` | Enter local prefix; do not transmit prefix |
| Any other scalar | Invoke protocol translation |

The default `ESCAPE-CHAR` is physical Network (`supdup.lisp:6-8`). If C changes it,
physical Network becomes ordinary protocol input unless the chosen character mapping
itself gives Network a remote meaning. Unlike C46, C303 does not retain Network as an
unconditional second prefix.

### C303 disconnected input

Disconnected mode disables super-image and binds
`SUPDUP-IO-BUFFER-OUTPUT-FUNCTION` while reading the host line
(`supdup.lisp:298-342`). Its exact application layer is:

```text
Help, when top-level Help is not recursively inhibited
  -> display host-syntax Help and consume the key

uppercased scalar = ESCAPE-CHAR
  -> run the complete local prefix and consume the key

character in TV:KBD-INTERCEPTED-CHARACTERS
  -> invoke inherited TV input-editor handler

other input
  -> return to READLINE
```

The prompt trims Space and Tab at both ends and reprompts until the resulting string
is nonempty. Therefore API-level NIL reaches the parser, but prompt-level empty input
does not. During the More wait, `ALLOW-ESCAPE` similarly consumes any sequence of
configured escapes or Help keys before untying the first other event (`344-359`).

### C303 complete Network-command prefix

The first key is the configured escape, Network by default. The prefix displays
`CMND-->` on the bottom line, reads one suffix, applies `CHAR-UPCASE`, executes the
table below, and in an outer unwind restores the saved cursor and clears the prompt
(`supdup.lisp:402-488`).

| Suffix | Connected | Disconnected | Help exposure | Exact local effect |
| --- | --- | --- | --- | --- |
| Call | same | same | Always | Deselect and maybe bury; retain connection |
| `P` | same | same | Always | Alias of Call |
| `A` | `:SEND-IP` if handled | No-op | Only if a `:SEND-IP` handler exists | Telnet interrupt path; no error for missing handler |
| `B` | same | same | Always | Set super-image NIL, enter Lisp `BREAK`, then set it T on normal return |
| Break | same | same | Shown as Break with B | Exact alias of B |
| `C` | same | same | Always | Show second prompt, set super-image NIL, read and uppercase one third-stage key, assign it to `ESCAPE-CHAR`, then set super-image T on normal return |
| `D` | Disconnect and return `"Disconnected"` | Return `"(Already disconnected.)"` | Always | Ends current typein iteration |
| `E` | same | same | **Omitted** | Disable super-image mode and leave it disabled |
| `L` | Protocol logout, then Quit | Quit | Always | Logout failure prevents Quit/disconnect |
| `Q` | same | same | Always | Disconnect, set return-to-caller, return `"Quit"` |
| `M` | Toggle More if handled | No-op | Only if a `:USER-SET-MORE-P` handler exists | Default Supdup has no user-set handler and separately refuses direct `:SET-MORE-P`; Telnet delegates to `:SET-MORE-P` |
| `I` | Toggle Imlac if handled | No-op | Only if handler exists | Telnet-specific in default flavors |
| `O` | Toggle overprint if handled | Same | Only if handler exists | Available on C303 BASIC-NVT, including disconnected state |
| Help | same | same | Self | Open computed Help stream |
| `?` | same | same | Self | Alias of Help |
| Rubout | same | same | Not listed as command | Silent no-op/cancel |
| exact configured escape | transmit and flush | Attempts protocol send with current stream | Printed as literal-send leaf | Reached only if no earlier command case shadows it |
| any other suffix | beep | beep | Not listed | No protocol output |

The prefix has exactly one third stage: `escape C new-character`. There are no other
multi-stage leaves.

Modifier, numeric, repeat, and shadow rules:

1. `CHAR-UPCASE` normalizes alphabetic case but does not strip modifier bits.
   Shift-derived case equivalents match; Control, Meta, Super, Hyper, and their
   combinations otherwise remain distinct and fall through to beep unless they are
   exactly the configured escape.
2. There is no numeric-argument state, sign state, digit accumulation, universal
   argument, or repeat facility. Digits are ordinary unbound suffixes and beep.
3. If C assigns A, B, C, D, E, I, L, M, O, P, Q, Help, `?`, Rubout, Call, or Break as
   the escape, the earlier command case shadows the literal-send leaf. A strict
   profile MUST preserve that inability to quote the selected reserved suffix.
4. A cons or mouse blip arriving while the prefix waits for its suffix is passed to
   `CHAR-UPCASE` without a type guard. A strict profile MAY signal the resulting
   condition; it MUST NOT silently discard the blip as if source did so.
5. B and C set super-image true only on ordinary control flow; they do not restore a
   saved prior value. Thus a normal disconnected invocation changes the prompt from
   normal mode to super-image mode. Their internal mode changes are not separately
   unwind-protected. The outer unwind only restores the bottom line and cursor.
6. Help's dynamic predicates describe handler presence, not successful execution.
   It omits E even though E is live.

### C46 disconnected `READLINE` and rubout contract

When `CONNECTION` and `CONNECT-TO` are both NIL, C46 selects the ordinary I/O
buffer, prints a newline followed by `Connect to host: `, and calls `READLINE` with
no options (`lmwin/supdup.105:150-192`). `TERMINAL-IO` is dynamically bound to the
NVT window. `READLINE` detects its `:RUBOUT-HANDLER` operation and enters it with the
empty option list; therefore there is no `:PROMPT`, `:REPROMPT`, `:INITIAL-INPUT`,
`:PASS-THROUGH`, or `:FULL-RUBOUT` behavior
(`lispm/qfctns.438:1376-1405`; `lmwin/stream.14:242-348`).

At rubout-handler entry, any unread typeahead suffix is compacted to the start of
the edit buffer; otherwise the active length becomes zero. The read index becomes
zero, the cursor after the already printed host prompt becomes the starting cursor,
and retained typeahead is re-echoed. The following is the complete application-local
editing tree:

| Input | Exact transition |
| --- | --- |
| ordinary character, including digits and otherwise unclaimed function codes | If the edit buffer is empty, refresh the starting cursor first; echo the character, append it, and return it to the line reader. After a prior edit, reset the read index and restart the protected line read so the retained buffer is reparsed |
| Carriage Return | Take the ordinary echo/append path in the rubout handler; terminate the line read, but exclude Return from the returned host string |
| Rubout with a nonempty buffer | Remove the final buffered character and mark the input edited; compute the truncated string's endpoint from the starting cursor, clear from there to the current cursor, and move back. If reparsing previously failed, instead reset to the start and redraw the retained buffer |
| Rubout with an empty buffer | Do nothing and continue waiting; do not beep, return NIL, or exit the host prompt |
| Clear | Set active length to zero, mark input edited, clear the rendered range from the starting cursor through the current cursor, restore that cursor, and continue waiting. Because the option list is empty, do not take the generic full-rubout return path |
| Form | Echo Form, clear the screen, invoke no reprompt callback, update the starting cursor, re-echo the complete retained buffer, and continue waiting |
| Vertical Tab | Echo Vertical Tab, output Carriage Return, invoke no reprompt callback, update the starting cursor, re-echo the complete retained buffer, and continue waiting |
| any other character with Control and/or Meta bits | Beep and continue waiting without echoing or appending it; the absent full-rubout option means it does not end the read |

There is no C46 disconnected application prefix, application Help branch, numeric
argument, repeat state, sign state, or blank-line reprompt loop. Direct Help, Break,
Network, and other special keys receive only the table above unless inherited TV
global Terminal/System routing consumes them first. In particular, physical Network
does not enter the connected C46 local prefix while disconnected. A zero-length line
is returned to `:CONNECT` after Return rather than being rejected locally.

The rubout routine performs numeric equality and modifier-field operations without
a character/list guard. If a non-character or cons reaches it, the first applicable
comparison or bit extraction may signal the historical type condition; strict mode
MUST NOT invent a C303-style cons ignore, application Help action, or safe coercion.
Global Terminal and System prefixes remain governed by the inherited D02 TV contract
before this application-level path.

### C46 complete local prefix

In `C46-LMWIN-105`, default escape is Break. Connected input treats either the
uppercased configured escape **or physical Network** as the local prefix
(`lmwin/supdup.105:150-186`).

The complete selected LMWIN prefix (`lmwin/supdup.105:203-262`) is:

| Suffix | Effect |
| --- | --- |
| Call or `P` | Deselect; retain connection |
| `B` | Switch to ordinary I/O buffer, enter `BREAK`, restore NVT buffer on normal return |
| `C` | Prompt, switch to ordinary buffer, read and uppercase one new escape character, restore NVT buffer on normal return |
| `D` | Disconnect and return `"Disconnected"` |
| `L` | Protocol logout, then Quit |
| `Q` | Quit/disconnect |
| `M` | Directly toggle the sheet's More flag |
| `I` | Directly call Imlac toggle |
| Help or `?` | Print inline Help and literal-escape documentation |
| Rubout | Silent no-op |
| configured escape or Network | Translate, transmit, and force output |
| anything else | Beep |

There are no A, E, or O leaves. C is the sole third-stage prefix. There is no numeric
or repeat state. Modifiers remain part of the suffix after uppercasing and otherwise
fall through. Setting the escape to a command character shadows literal transmission.
B/C can fail to restore the NVT buffer. Direct I may signal when the current flavor
lacks `:TOGGLE-IMLAC-SIMULATION`. The Help text includes M and I together based only
on presence of the I handler, while M itself directly invokes generic sheet More.

### C46 Escape-N lineage tree

`C46-ESCAPE6` is not part of `C46-LMWIN-105`. Its exact old-window dispatcher at
`lmio1/escape.6:215-234` is retained only for a separately selected lineage report:

```text
Escape N
├── no argument or numeric 0 -> find or make an old SUPDUP-CLASS instance
├── numeric 1 -> find or make an old TELNET-CLASS instance
├── numeric 2 -> make a new old SUPDUP-CLASS instance
├── numeric 3 -> make a new old TELNET-CLASS instance
└── list/precomma argument -> select the Nth existing instance for the requested mode
```

Its recovered public Help fragment is available at
[`assets/mit-cadr-online-help/source/lmio1/escape.6.help.lisp`](../assets/mit-cadr-online-help/source/lmio1/escape.6.help.lisp).
An implementation MUST NOT graft this Escape-N tree onto the LMWIN or C303 profiles.

### SUPDUP remote character mapping

Both selected systems implement Maclisp-style list filling: when a nonempty list is
shorter than the destination array, `FILLARRAY` repeats the list's final element
through every remaining cell. System 46 advances its list cursor with
`(OR (CDR L) L)`; C303 states “it sticks at the last element” and advances only when
the cdr is non-NIL (`lispm/qmisc.281:621-634`; `sys/qmisc.lisp:582-600,643-647`).
That rule is normative for every table below; an initializer listing is not the
whole array.

C303's `SUPDUP-KEYS` is an `0o201`-cell (129-cell) array. Its 32 explicit cells are
exactly (`supdup.lisp:1038-1047`):

```text
indices 0o00..0o37, for source character codes 0o177..0o236:
0o4177,
0, 0o4102, 0o4103, 0o32,
0o4101, 0o37, 0o4110, 0o177,
0o10, 0o11, 0o12, 0o13,
0o14, 0o15, 0o4102, 0o323,
0o37, 0o4103, 0o310, 0,
0o233, 0, 0, 0, 0,
0, 0, 0, 0, 0,
0o4102
```

The final explicit `0o4102` repeats through indices `0o40..0o200`, so source
characters `0o237..0o377` all map to `0o4102`. For a scalar input, C303 extracts the
character code, preserves code `0o33` as a special case, maps every other code below
`0o40` to ITS control form by setting `0o4000`, leaves codes below `0o177`
unchanged, otherwise indexes at `code - 0o177`, and then ORs all Lisp-machine
character bits shifted by seven. Thus the exact table-driven domain is
`0o177..0o377`: `0o176` bypasses the table, `0o177` selects the integral cell, and
`0o377` selects the repeated final cell. `CHAR-CODE-LIMIT` is `0o400`, so a valid
C303 character code is always below `0o400` and cannot index beyond this array.
Passing a non-character may signal during `CHAR-CODE` instead; the selected entry
point supplies no reachable array-bounds path. Cons/blips are ignored before
translation by `BASIC-SUPDUP` (`supdup.lisp:1049-1056`).

System 46 instead allocates `0o200` (128) cells and supplies these 31 explicit
values (`lmwin/supdup.105:433-440`):

```text
indices 0o00..0o36, for source character codes 0o200..0o236:
0, 0o4102, 0o4103, 0o32,
0o4101, 0o37, 0o4110, 0o177,
0o10, 0o11, 0o12, 0o13,
0o14, 0o15, 0o4102, 0o323,
0o37, 0o4103, 0o310, 0,
0o233, 0, 0, 0, 0,
0, 0, 0, 0, 0, 0o4102
```

Its repeated tail is indices `0o37..0o177`, so source codes `0o237..0o377` map to
`0o4102`. After its whole-character raw-Escape clause, System 46 extracts the low
eight-bit code, preserves extracted code `0o33`, maps every other code below `0o40`
by setting `0o4000`, and indexes only codes at or above `0o200`: `0o177` bypasses
the table unchanged, `0o200` selects index zero, and `0o377` selects the final
repeated cell. `%%KBD-CHAR` is an eight-bit field, so even an arbitrary packed
integer cannot produce extracted code `0o400`; a valid scalar cannot reach an array
bounds fault. The raw unmodified Escape clause invokes `TV:KBD-ESC` and returns NIL;
the source comment says it is not expected to fire, and normal-return behavior at
the caller remains a runtime condition oracle rather than a fabricated send.

System 46 ORs the four-bit historical `%%KBD-CONTROL-META` field shifted by seven.
Despite its name, that field contains Control, Meta, Super, and Hyper; C303's
`CHAR-BITS` additionally admits the Mouse bit. Table origin, array length, integral
handling, raw-Escape interception, and Mouse-bit handling are release deltas
(`lmwin/supdup.105:443-454`; `lispm/qcom.437:185-188`).

### Telnet remote character mapping

C303 and System 46 each allocate `TELNET-KEYS` with `0o200` (128) cells and the same
32 explicit initializer cells (`supdup.lisp:2649-2655`;
`lmwin/supdup.105:1009-1015`):

```text
indices 0o00..0o37:
0, 0o100101, 0o100370, 0o100364,
0, 0o37, 0o37, 0o177, 0o10, 0o11, 0o12,
0o13, 0o14, 0o15, 0o21, 0,
0o100365, 0o100363, 0, 0o100366,
0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
0o100101, 0
```

The final explicit zero repeats through indices `0o40..0o177`. The lookup condition
is strictly `code > 0o200`, with index `code - 0o200`. Consequently index zero is
unreachable through this branch; source code `0o200` bypasses the table, codes
`0o201..0o237` use explicit cells 1 through `0o37`, and codes `0o240..0o377` use the
repeated zero tail. That intermediate zero transmits as NUL without Meta and becomes
`0o200` when Meta is subsequently added. `0o377` is the last valid lookup. C46's
eight-bit `%%KBD-CHAR` extraction and C303's `CHAR-CODE-LIMIT = 0o400` make a table
index beyond `0o177` unreachable from a valid scalar; malformed non-characters fail
at extraction/comparison rather than establishing an application array-bounds path.

For C303, local echo occurs when `ECHO-FLAG` is NIL. It first displays the local
Control marker for a Control-modified character and then displays the extracted
character. If SUPDUP-OUTPUT mode is active and that extracted code is End, it sends
Control-X then Control-S and skips the remaining table/Meta path. Neither the marker
nor the End special case exists in C46.

For every non-special-case scalar in either profile, the shared transform order is:

1. Extract the character code.
2. Control replaces the value with its low five bits.
3. A resulting special code greater than `0o200` indexes the full 128-cell
   `TELNET-KEYS` at `code - 0o200`. A zero explicit or repeated-tail entry remains a
   real intermediate zero; it is not locally unbound.
4. Meta adds `0o200`.
5. Super and Hyper have no separate protocol encoding after character-code
   extraction.
6. Send the result through Telnet output translation.

System 46 echoes only the extracted character when `ECHO-FLAG` is true. Both
profiles echo before controlification and table lookup. The older negotiation
transitions remain specified below (`lmwin/supdup.105:1017-1055`).

### Pointer, menu, and presentation closure

Generic C303 TV pointer routing at `window/mouse.lisp:824-843` precedes the
application:

```text
double-right
  -> invoke the TV System Menu; never deliver the second click to the NVT

single-left on an unselected NVT
  -> select it and consume the click

otherwise, when its input is handled
  -> enqueue (:MOUSE-BUTTON encoded-click window x y)
```

`TV:LIST-MOUSE-BUTTONS-MIXIN` is a compatibility no-op in the selected System 303
source/release notes. Supdup ignores the cons. Telnet serializes it only when
`SUPDUP-OUTPUT-FLAG` is true; otherwise it is ignored (`supdup.lisp:2649-2662`).

When enabled, Telnet mouse output is exactly:

```text
0o33
three decimal characters for truncate(x / TV:CHAR-WIDTH)
three decimal characters for truncate(y / TV:LINE-HEIGHT)
#/0 + 1 + low-three encoded button bits
    + (1 if encoded bits 3 through 5 are nonzero, else 0)
0o33 0o12
```

Each coordinate uses hundreds, tens, and units with decimal divisors `100.` and
`10.` (`supdup.lisp:2853-2870`). There is no range or sign validation. Values outside
0–999 can therefore emit nondigit or truncated-looking fields. The who-line text
“Left: Move point. Middle: Select buffer. Right: Get buffer editor” states the remote
peer's expected interpretation; the CADR sends all accepted clicks and performs none
of those editor operations locally.

System 46 selected Telnet has no corresponding mouse-report method. Other pointer
events are therefore generic TV behavior or ignored input blips.

Neither selected profile owns an application menu, menu accelerator, presentation,
presentation translator, or CLIM gesture. The Create menu, System Menu, System-key
Help, and Peek host menu are TV-owned and incorporated from D02/TV. The exact
application-owned presentation denominator is zero.

## Host and contact grammars

### C303 grammar

`PARSE-PATH` and `EXPAND-PATH` at `window/supdup.lisp:139-226` define the following
API grammar:

| Input | Parse result |
| --- | --- |
| symbol | Convert with `STRING`, then parse as string |
| fixnum | Known Chaos host for that address when available; otherwise raw numeric host |
| NIL | Associated machine |
| other nonstring object | Pass through as host |
| known Chaos host string | Chaos host with protocol default contact |
| string parsable wholly in radix 8 | Known Chaos host for address when available; otherwise numeric Chaos address |
| otherwise plain host string | Internet host through the default gateway |
| `host/contact` where suffix is not decimal | Explicit Chaos contact string |
| `host/socket` where suffix parses in decimal | Internet host/socket through default gateway |
| `gateway` Altmode `host` | Explicit Internet gateway and protocol default socket |
| `gateway` Altmode `host/socket` | Explicit gateway and decimal socket; nonnumeric suffix signals an error |

The default gateway is the first `:ARPA-GATEWAYS` site option. For a gateway route,
`EXPAND-PATH` connects to the gateway's Chaos identity and constructs contact
`TCP host socket` using historical octal printing rules; for a direct Chaos route it
uses the contact unchanged. Supdup supplies contact `SUPDUP` and source literal
`0o137`; Telnet supplies `TELNET` and `0o27` (`supdup.lisp:964-973,2632-2640`).

The parser's slash-number calls explicitly select decimal radix `10.` at lines 181
and 197. The nearby comment and Help claim octal sockets at lines 148, 370, and
378-379. Strict `C303-4DF-SRC` MUST parse decimal and MAY reproduce the stale Help;
a manual-overlay profile MUST expose the disagreement rather than silently choosing.

At the disconnected prompt, leading/trailing Space and Tab are trimmed and empty
input reprompts. Programmatic NIL still means associated machine. Replacing a live
connection first invokes the before-connect disconnect and only then parses this
grammar, so malformed replacement syntax destroys the old session before failure.

### System 46 grammar

System 46's earlier `PARSE-PATH` at `lmwin/supdup.105:97-121` is separately
normative. Its ordered algorithm is:

1. Convert a numeric path through `CHAOS:HOST-DATA`; convert a symbol to its print
   name; replace NIL with `"AI"`.
2. For a string, split the first Altmode into `bridge` and `path` when present.
3. Test `(bridge or path)` in `CHAOS:HOST-ALIST`.
4. If that host is not known, an explicit bridge is moved into the direct-host slot,
   the former target becomes the explicit ARPA contact/name, and bridge defaults to
   `"AI"`.
5. If no bridge remains, connect directly to the path using an explicit contact when
   found or the protocol contact otherwise.
6. If a bridge remains, connect to it with contact text `ARPA target socket-or-name`;
   absent explicit name uses the caller's ARPA socket rendered in octal.
7. Build the visible label from protocol name plus direct host or bridge-arrow-target.

There is no C303 slash/address decision tree and NIL means AI rather than associated
machine. A recreation MUST not use C303 parsing for this profile.

## Initialization, processes, and lifecycle order

### C303 definition through activation

The strict phase order is:

```text
define/load
  -> compile flavor methods
  -> preactivate one Supdup window at file load
  -> instantiate window
      -> allocate/preset typein and typeout processes if slots unbound
      -> set disconnected label
  -> select or expose
      -> reset a process only when waiting in SI:FLUSHED-PROCESS
      -> add window as process run reason
  -> typein and typeout top levels run
```

See `supdup.lisp:82-112,933-951,2941-2945`. Preactivation does not prove the
subsystem is loaded in `System 303-0`; that is exactly the source/runtime boundary.

### C303 connection transaction

The source-visible order (`supdup.lisp:120-245`) is normative:

```text
CONNECT(target)
  1. if CONNECTION is non-NIL, DISCONNECT it completely
  2. parse target
  3. expand host/gateway/contact and label
  4. CHAOS:CONNECT
  5. if the result is an error object, return it
  6. set the visible connected-target label
  7. reset typein process
  8. reset typeout process
  9. STREAM := CHAOS:MAKE-STREAM(new-connection)
 10. send/read the protocol greeting
 11. CONNECTION := new-connection        // publication/commit point
 12. BLACK-ON-WHITE := NIL
```

The new connection is deliberately not published until after greeting. Typeout waits
for non-NIL `CONNECTION`, preventing premature peer reads. However, failure at steps
9–10 leaves an acquired connection or stream outside the `CONNECTION` slot. Ordinary
`DISCONNECT` cannot close it. The label may already describe the target. Strict
compatibility MUST retain this partial failure; `C303-SAFE-CONNECT` may stage and
close it explicitly.

`CONNECT-TO` is cleared with `PROG1` before the connection attempt. A failed pending
target is not automatically retried; control returns to prompting/error handling.

### C303 connected typein machine

```text
begin iteration
  RETURN-TO-CALLER := NIL
  result := :ABORT

  if CONNECTION:
    enable super-image
    loop:
      if no local input, force peer output under OUTPUT-LOCK
      event := ANY-TYI
      route event through the complete input tree
      remote state/error may throw a reason string

  else if CONNECT-TO:
    clear screen
    target := CONNECT-TO
    CONNECT-TO := NIL
    attempt CONNECT(target)

  else:
    disable super-image
    bind disconnected input hook
    prompt until nonblank line
    attempt CONNECT(line)

after protected body:
  nonstring condition object -> report string
  :ABORT with live connection -> ask whether to disconnect
  string result -> DISCONNECT, print string
  if RETURN-TO-CALLER -> return; otherwise repeat
```

Abort with a live connection and a “no” answer resumes without disconnect. Abort with
no connection produces no disconnect reason. Q sets `RETURN-TO-CALLER`; D does not.

### C303 typeout and error handoff

The typeout process (`supdup.lisp:507-546`) waits until `CONNECTION` is non-NIL,
blocks for one byte, drains additional immediately available bytes, applies protocol
output, and flushes its local output buffer. Before normal output it honors the
selected black-on-white/overprint rule.

Peer EOF injects `(:ERROR "Closed by foreign host")` into typein and then waits
forever. A remote-network condition injects `(:ERROR report-string)` and also waits
forever. The process is recovered by the later disconnect/reset; it does not close
the connection itself. This wait is intentional lifecycle behavior, not a missing
return value.

### C303 disconnect and kill

`DISCONNECT` orders effects as follows:

```text
flush typein process
flush typeout process
if CONNECTION:
  close Chaos connection
  remove Chaos connection
  CONNECTION := NIL
reset typein process
reset typeout process
run protocol after-disconnect method
```

The method does not clear `STREAM`. Telnet's after-method resets echo, new-Telnet,
SUPDUP-OUTPUT, and binary flags and restores the disconnected label
(`supdup.lisp:2645-2647`). Supdup restores its disconnected label
(`1035-1036`). Window process ownership is reported through `:PROCESSES`; generic TV
kill owns final process termination.

### System 46 lifecycle differences

System 46 allocates distinct ordinary and super-image NVT I/O buffers and two
processes during initialization (`lmwin/supdup.105:15-68`). Selection lazily resets
them. Its kill wrapper runs inherited/body cleanup first and then kills both processes
(`70-77`).

Most importantly, System 46 `:SET-CONNECTION` publishes `CONNECTION` and constructs
`STREAM` **before** greeting (`123-130`):

```text
flush processes
CONNECTION := new
STREAM := CHAOS:STREAM(CONNECTION)
gobble greeting
reset processes
```

A greeting failure therefore leaves the connection visible to ordinary disconnect,
unlike C303's unpublished-resource defect. Its disconnected branch performs one
plain `READLINE`; its string error result is then disconnected and printed. Typeout
EOF/error injects an error blip and waits forever as in the later lineage
(`276-296`).

## Reset and persistence matrix

| State | Initialization | Successful C303 connect | Disconnect | Peer reset/clear |
| --- | --- | --- | --- | --- |
| `ESCAPE-CHAR` | C46 Break; C303 Network | Preserve | Preserve | Preserve |
| `OVERPRINT` | C303 NIL | Preserve | Preserve | Preserve |
| `BLACK-ON-WHITE` | NIL | Force NIL after greeting | Not explicitly reset | `0o227` sets; `0o230` clears |
| `CONNECTION` | NIL | Publish after greeting | Clear after close/remove | Unchanged |
| `STREAM` | Unbound/old | Replace before greeting | Retained, possibly closed | Unchanged |
| `CONNECT-TO` | caller/default | Cleared before attempt | Not restored | Unchanged |
| output buffer | empty at construction | Not explicitly cleared | Process flush/reset only | Flushed before effectors |
| general graphics | reset on graphics-mixin init | Preserve | Preserve | `0o230` resets only general graphics/BOW |
| GT40 display list | global array | Preserve | Preserve | `0o220` clears list; `0o230` does not |
| ARDS coordinates/scale | global defaults | Preserve | Preserve | No general reset effector |
| Telnet echo/new/SUPDUP-output/binary | NIL | Negotiation mutates | Reset to NIL | Protocol negotiation mutates |
| Telnet Imlac simulation | NIL or bound argument | Preserve | Preserve | Network I toggles |
| More state | default/mixin state | Preserve | Telnet wait flag cleared through handling, not blanket disconnect assignment | Network M / More flow |
| local-edit counters/enable | flavor init | after-set-connection resets key counters/flags | No separate full reset | resync/control effectors mutate |

General graphics, GT40, ARDS, recording, and local-edit state are not one unified
terminal reset domain. A reimplementation MUST not treat disconnect or `0o230` as a
full terminal-object reconstruction.

## SUPDUP connection and input wire

### Terminal-variable greeting

C303 Supdup (`supdup.lisp:964-1033`) sends seven 36-bit terminal words, represented
as these ordered pairs of 18-bit halves:

| 36-bit word | Left 18 bits | Right 18 bits |
| --- | --- | --- |
| count header | `-6` | zero |
| TCTYP | zero | terminal type 7 |
| TTYOPT | base capabilities plus overprint and optional character insertion/deletion | `0o54` |
| TCMXV | zero | maximum character row minus one |
| TCMXH | zero | maximum character column minus one |
| TTYROL | zero | zero, advertising no scrolling |
| TTYSMT/local edit | packed line-height and character-width metrics | `0o040000`, plus `0o100000` when local editing is advertised |

Each 18-bit half is emitted as three six-bit bytes in bit ranges 12–17, 6–11, then
0–5 (`supdup.lisp:1021-1024`). The method then emits Finger identification
`0o300 0o302`, the local Finger location string, NUL, and a flush.

The greeting reader begins with a synthetic CR, reads bytes until EOF or `0o210`,
maps control values below `0o40` by adding `0o200`, suppresses `0o212` linefeeds, and
displays all others. EOF ends greeting without separately proving a healthy peer.

System 46 sends six 36-bit words: header `(-5, 0)`, TCTYP `(0, 7)`, TTYOPT
`(option, 0o54)`, TCMXV `(0, max-row)`, TCMXH `(0, max-column)`, and TTYROL
`(0, 0)`. It has no TTYSMT cell-metric/local-edit pair
(`lmwin/supdup.105:394-417`). Its Finger location is derived through the older local
address/Finger table (`419-431`).

### ITS Intelligent Terminal Protocol output

After translating a local key to an ITS 12-bit character, both profiles use this
wire rule:

```text
bits := modifier/function bits
if bits != 0:
  write 0o34
  write 0o100 OR bits
  write low seven bits
else if character == 0o34:
  write 0o34, 0o34
else:
  write character
```

C303 holds `OUTPUT-LOCK` around every multi-byte case and the ordinary one-byte case
(`supdup.lisp:1060-1071`). System 46's ordinary one-byte branch does not explicitly
take the lock, while its multi-byte branches do (`lmwin/supdup.105:456-469`); this is
a release-specific concurrency surface.

Supdup logout is a release-specific ordered transaction under `OUTPUT-LOCK`:

```text
C46-LMWIN-105: TYO 0o300 -> TYO 0o301 -> stream :FORCE-OUTPUT
C303-4DF-SRC:  TYO 0o300 -> TYO 0o301 -> stream :FINISH
```

System 46 Network L invokes that transaction and then `QUIT "Logout"`. C303 does
the same when `CONNECTION` is non-NIL, but calls plain `QUIT` without logout when it
is NIL (`lmwin/supdup.105:224-226,471-475`;
`supdup.lisp:431-436,1073-1077`). A strict implementation MUST preserve
`:FORCE-OUTPUT` versus `:FINISH`; their completion guarantees are not declared
equivalent here. Failure of either byte write or the final stream operation prevents
the subsequent Quit/disconnect. Bytes accepted before the failure remain accepted,
and the output lock unwinds according to the common lock contract.

## SUPDUP display-effect protocol

### Text buffering and dispatch

For C303, bytes below `0o200` append to a 128-character output buffer; a full buffer
is flushed to the sheet before retrying the append. A byte at or above `0o200`
first flushes all buffered text, subtracts `0o200`, and dispatches when the resulting
index is within the 32-entry table. Values `0o240` and above therefore flush pending
text and are otherwise ignored (`supdup.lisp:1079-1117`). This establishes exact
text-before-effector ordering.

No effector transaction buffers all its operands. A truncated operand sequence may
block or signal after earlier text, cursor, pixels, flags, peer replies, or nested
state have already changed.

### Exact effector table

| Byte | Operands | `C46-LMWIN-105` | `C303-4DF-SRC` |
| --- | --- | --- | --- |
| `0o200` | four | discard two, then V/H move | same |
| `0o201` | V, H | cursor move | cursor move |
| `0o202` | none | clear to end of screen | same |
| `0o203` | none | clear to end of line | same |
| `0o204` | none | clear character | same |
| `0o205` | none | no-op | no-op |
| `0o206` | variable | GT40 interpreter | GT40 interpreter |
| `0o207` | none | CRLF | CRLF |
| `0o210` | none | no-op | no-op |
| `0o211` | none | no-op | backward character |
| `0o212` | none | no-op | linefeed/increment Y |
| `0o213` | none | no-op | carriage return to X=0 |
| `0o214` | none | send cursor report | send `0o34 0o20 V H`, then flush |
| `0o215` | one raw byte | quote directly to sheet | same |
| `0o216` | none | space | space |
| `0o217` | V, H | cursor move | cursor move |
| `0o220` | none | clear sheet and global GT40 list | same |
| `0o221` | none | bell | remote bell and coalesce adjacent `0o221` |
| `0o222` | none | no-op | no-op |
| `0o223` | count | insert lines | insert lines |
| `0o224` | count | delete lines | delete lines |
| `0o225` | count | insert character positions | insert character positions |
| `0o226` | count | delete character positions | delete character positions |
| `0o227` | none | no-op | set black-on-white |
| `0o230` | none | no-op | clear black-on-white and reset general graphics |
| `0o231` | variable | no-op | general graphics interpreter |
| `0o232` | region height, scroll amount | region up | region up |
| `0o233` | region height, scroll amount | region down | region down |
| `0o234` | none | no-op | no-op |
| `0o235` | ARDS stream | enter ARDS set-position form | same |
| `0o236` | ARDS stream | enter ARDS long-vector form | same |
| `0o237` | ARDS stream | enter ARDS short-vector form | same |

Cursor moves interpret peer order as vertical position then horizontal position and
scale by line height and character width. Cursor report performs the inverse integer
division. Bell coalescing reads nonblocking until the first nonbell and unreads that
one byte (`supdup.lisp:1119-1171`).

Region operations clamp the affected bottom and scroll amount to the visible
line-grid region, move retained pixels, then erase the newly exposed band. Region
down passes a negative height to BITBLT to select bottom-up copy order. The selected
microcode documents signed dimensions and reverse traversal at
`ucadr/uc-tv.lisp:429-434`; the negative height is not a defect.

## General SUPDUP graphics

General graphics exists only in the C303 dispatch slot `0o231`. The state consists of
logical current X/Y, inclusive logical bounds, physical offsets, virtual scale,
virtual/physical mode, and XOR/IOR mode (`supdup.lisp:562-606`). Initialization rounds
the inside rectangle down to whole character cells, centers its coordinate origin,
sets inclusive limits, selects physical coordinates and IOR mode, and starts at 0,0.

### Command grammar

The decoder repeatedly reads one byte through `GRAPHICS-NETI`:

- any byte with bit `0o200` exits graphics and is unread for the outer SUPDUP
  decoder;
- a byte with bit `0o100` selects a drawing command by low nibble; and
- otherwise the full byte selects a state/control command.

Control commands are exact:

| Code | Effect |
| --- | --- |
| 1 or 17 | Read one point and move current position |
| 2 | Set persistent XOR mode |
| 8 | Erase current bounded graphics region |
| 9 | Enter nested push scope; restore coordinates, bounds, XOR, and virtual mode on exit |
| 10 | Select virtual coordinate scaling |
| 13 | Read two points and replace inclusive bounds with their minima/maxima |
| 18 | Clear persistent XOR mode, selecting ordinary IOR/command ALU behavior |
| 26 | Select physical coordinate mode |
| other | No-op |

Drawing low nibbles are exact:

| Low nibble | Effect and extra grammar |
| --- | --- |
| 1 | Line from old current point to one newly read point |
| 2 | Read one point and draw a one-point line |
| 3 | Read one point and fill the inclusive rectangle between old and new positions |
| 4 | Read bytes until zero and draw the string at current position |
| 5 | Read packed bit groups until a byte with bit `0o100`; groups cycle six, six, then four bits and advance X |
| 6 | Read run bytes until zero; low six bits advance X and bit `0o100` draws that run |
| other | No-op |

If command bit `0o20` is set, each point is four seven-bit bytes: low-X, high-X,
low-Y, high-Y, sign-extended from 14 bits. Otherwise each point is two signed
seven-bit deltas added to current position (`supdup.lisp:649-668`). Coordinates are
optionally scaled, clamped to inclusive logical bounds, offset to the sheet, and Y is
inverted. Persistent XOR wins ALU selection; otherwise command bit `0o40` selects
ANDCA and its absence selects IOR (`670-686`).

Nested push is dynamic state restoration, not a peer-visible stack object. A
truncated nested stream may have already drawn pixels before the exit byte restores
the dynamic variables.

## GT40 and ARDS compatibility engines

### GT40

`0o206` invokes the GT40/SUDS interpreter at `supdup.lisp:1276-1504`. It maintains a
global ten-item display-list array, a global current item number, and a global
blinker. Display objects contain strings or typed vector/point triples. Commands
consume packed 16-bit words represented by three bytes in 6-4-6 layout; insert and
delete consume count/item words and trailing checksum words.

Strict behavior includes:

- command 0 chooses insert or delete from the low two bits of a packed word;
- command 1 inserts/replaces the current display item;
- command 2 deletes one or more items;
- character, short-vector, long-vector, point, and relative-point modes mutate and
  draw the current display object incrementally;
- draw/erase uses XOR, so redisplaying an active item erases it;
- blinking toggles every global item whose leader state is `ON` or `OFF`; and
- checksum words are consumed but never validated.

Source-visible GT40 defects are normative in strict mode:

1. `SUPDUP-GT40` globally assigns `SI:KBD-NEW-TABLE` to its SUDS table and never
   restores the prior table (`1301-1306`).
2. Because the file is Base 8, `(MAKE-ARRAY 17)` has length 15 decimal, while
   `(LOGAND 17 BYTE)` can produce decimal index 15, one beyond valid indices 0–14.
3. The display-list array has fixed decimal length 10 and trusts peer item numbers
   without bounds checking (`1451-1456`).
4. Insert deletes the target before reading the replacement (`1386-1395`); truncated
   input leaves the old display erased and the replacement partial.
5. The state is global rather than per window, permitting cross-window interference.

### ARDS

`0o235`–`0o237` enter the ARDS compatibility loops at
`supdup.lisp:1506-1590`. ARDS X/Y, scale, and screen-position variables are global.
Each invocation derives window dimensions and offsets, then reads only bytes in
`0o100`–`0o177`. A control or `%TD` byte exits, unreads that byte, and moves the text
cursor to the last ARDS screen position.

- Set form reads long X then long Y and plots the resulting point when its flag says
  visible.
- Long-vector form repeatedly reads signed long X/Y deltas.
- Short-vector form repeatedly reads signed short X/Y deltas.
- Coordinate conversion shifts the nominal -512..511 range to 0..1023, scales by the
  smaller window dimension, applies a centering offset, clips, inverts Y, and draws
  visible vectors with IOR.

The source itself states that the variables should be instance variables and that
scaling/offset is wrong (`1508-1510`). Strict mode preserves those defects and global
cross-window state.

## Optional recording and local editing

These facilities are **not** the default C303 Supdup. `SUPDUP-FLAVOR` defaults to
`SUPDUP` (`supdup.lisp:892`). They form a separately selected
`C303-LOCAL-EDIT` compatibility axis.

### Recording allocation and observable state

Let `H = truncate(inside-height / line-height) - 1` and
`W = truncate(inside-width / character-width)`. On initialization, and after every
size-or-margin change, `RECORDING-SUPDUP` performs these exact allocations in order
(`supdup.lisp:1610-1646`):

1. `SCREEN-LINE-ARRAY` becomes an `H + 1` element vector; its row strings do not yet
   exist.
2. `OLD-SCREEN-LINE-ARRAY` becomes an `H`-element vector.
3. `LAST-COL-TO-SAVE+1` becomes `W`; `FIRST-COL-TO-SAVE` is not reset.
4. `SAVED-LINE-ARRAY` becomes a new `LINE-LABEL-MAX` vector. The default maximum is
   bare `2000`, hence `0o2000` or 1,024 cells; resize discards all prior saved lines.
5. `REDISPLAY-STRING` becomes a `W`-cell fat string with a one-cell leader.
6. Finally, for every screen-vector cell, allocate a `W`-cell fat string with a
   three-cell leader and set leader cell zero to `W`; cells one and two are the
   line-begin and line-end continuation flags.

The first `H` rows are displayable by the recording code and row `H` is the extra
record-only row. New row contents and continuation cells receive only their array
type's default initialization; this method does not explicitly fill them with
Return or reset `CURRENT-XPOS`, `CURRENT-YPOS`, the first save column, or the
multiposition bounds. A strict implementation MUST preserve that omission. Invalid
small geometry can make `H`, `H + 1`, or `W` unsuitable for allocation; there is no
prevalidation. A failure during the final row loop occurs after the screen/old/saved/
redisplay vectors and last-save-column mutation have already been published.

Each recorded row cell holds a fat character. Return marks unused text, `0o211` is
the tab placeholder, and the high marker bits distinguish the first and subsequent
cells of a multiposition character. The leader accessors treat cells one and two as
boolean continuation flags.

### Recording receive loop

For each received value below `0o200`, the implementation MUST (`1704-1735`):

1. index row `CURRENT-YPOS` and cell `CURRENT-XPOS`, and store the value;
2. increment X, then decrement it only when it became exactly `W`, causing later
   ordinary bytes to overwrite the final cell repeatedly;
3. when the resulting X equals `MULTI-POS-CHAR-END`, add `0o400` to the first cell
   in `[MULTI-POS-CHAR-BEG, MULTI-POS-CHAR-END)` and `0o1000` to each remaining
   cell; and
4. append the byte to the visible output buffer only when Y is less than `H`.

The bounds check occurs only after the initial row/cell store. X already greater
than or equal to `W`, Y outside `0..H`, or an invalid multiposition range can signal
an array condition before any corrective clamp. Row `H` records without drawing.

For every value at or above `0o200`, the implementation MUST first flush buffered
text, reset both multiposition bounds to zero, subtract `0o200`, dispatch any index
below the 64-cell table length, and, only after the handler returns normally,
recompute logical X/Y from the TV cursor. Values `0o300` and above therefore flush,
reset, and otherwise do nothing. A handler failure prevents the final cursor sync;
earlier text, operands, array mutations, pixels, replies, and marker reset remain.

### Complete recording effector table

`REC-SUPDUP-%TD-DISPATCH` has bare length `100`, hence `0o100` or 64 cells. Its
initializer has 44 decimal cells (`0o00..0o53`); because `FILLARRAY` repeats the last
element, every remaining slot dispatches `REC-SUPDUP-SET-LOCAL-LABEL`. This is the
exact table (`supdup.lisp:1648-1702`):

| Byte | Operand bytes | Handler and required effect |
| --- | ---: | --- |
| `0o200` | 4 | Discard two, read V then H, and move the TV cursor |
| `0o201` | 2 | Read V then H and move the TV cursor |
| `0o202` | 0 | Recording EOF, then visible clear-to-end-of-screen |
| `0o203` | 0 | Recording EOL, then visible clear-to-end-of-line |
| `0o204` | 0 | Store Return at the current recorded cell, then visibly clear that cell |
| `0o205` | 0 | No-op |
| `0o206` | variable | Enter the GT40 interpreter; operand grammar is normative above |
| `0o207` | 0 | Visible CRLF, cursor resync, then recording EOL on the new row |
| `0o210` | 0 | No-op |
| `0o211` | 0 | No-op; unlike basic C303 Supdup, it does not move backward |
| `0o212` | 0 | No-op; unlike basic C303 Supdup, it does not linefeed |
| `0o213` | 0 | No-op; unlike basic C303 Supdup, it does not carriage-return |
| `0o214` | 0 | Send locked cursor report `0o34 0o20 V H`, then force output |
| `0o215` | 1 | Draw the next raw byte directly on the sheet |
| `0o216` | 0 | Invoke TV sheet-space; it has no dedicated recorded-cell mutation |
| `0o217` | 2 | Read V then H and move the TV cursor |
| `0o220` | 0 | Recording clear, visible clear, and global GT40-list clear |
| `0o221` | 0 plus lookahead | Ring once, consume adjacent immediately available `0o221` bytes, and unread the first different byte |
| `0o222` | 0 | No-op |
| `0o223` | 1 | Recording insert-lines transaction |
| `0o224` | 1 | Recording delete-lines transaction |
| `0o225` | 1 | Visible then recorded insert-characters transaction |
| `0o226` | 1 | Visible then recorded delete-characters transaction |
| `0o227` | 0 | Set black-on-white true through the basic Supdup handler |
| `0o230` | 0 | Set black-on-white false, then reset the general graphics defaults |
| `0o231` | variable | Enter the general graphics grammar specified above |
| `0o232` | 2 | Read region height and count; recording region-up, then visible region-up |
| `0o233` | 2 | Read region height and count; recording region-down, then visible region-down |
| `0o234` | 0 | No-op |
| `0o235` | variable | ARDS absolute-set loop |
| `0o236` | variable | ARDS long-vector loop |
| `0o237` | variable | ARDS short-vector loop |
| `0o240` | 2 | Local flavor: resync-reply transition below. Standalone recording flavor at its default disallowed state consumes both bytes, calls its NIL-returning allow method, and leaves state unchanged |
| `0o241` | 0 | Allow-local-edit transition; standalone recording flavor returns NIL |
| `0o242` | 2 | Define-command transition; standalone recording flavor merely consumes both bytes |
| `0o243` | 0 | Stop-local-edit transition; standalone recording flavor has no such method and signals the normal no-handler condition |
| `0o244` | 0 | Store tab placeholder at the current cell, then invoke TV sheet-space |
| `0o245` | 0 | Set current row's begin-continuation flag true |
| `0o246` | 0 | Set current row's end-continuation flag true |
| `0o247` | 2 | Set multiposition begin to X and end to X plus the first operand; consume and ignore the second operand |
| `0o250` | 3 | Read count, low label, high label and save lines |
| `0o251` | 3 | Read count, low label, high label and restore lines |
| `0o252` | 2 | Replace first and exclusive-last save columns with the two raw operands |
| `0o253` | 2 | Consume local-label operands; no other effect |
| `0o254`, `0o255`, `0o256`, `0o257`, `0o260`, `0o261`, `0o262`, `0o263`, `0o264`, `0o265`, `0o266`, `0o267`, `0o270`, `0o271`, `0o272`, `0o273`, `0o274`, `0o275`, `0o276`, `0o277` | 2 each | Repeated `FILLARRAY` tail: consume local-label operands; no other effect |

The operand count is a sequencing contract, not a validation promise. A truncated
fixed operand sequence blocks or signals at the missing read after all earlier
effects. Variable grammars retain their separately specified exit and unread rules.

### Recording mutation algorithms and failure order

The extended handlers MUST preserve these operations, including their order
(`supdup.lisp:1737-2003`):

| Operation | Exact recorded and visible transition |
| --- | --- |
| EOL | Clear the current row's end-continuation flag; fill cells X through `W - 1` with Return; then clear visible EOL |
| EOF | Perform recording EOL; for every later row through extra row `H`, clear both continuation flags and fill the row with Return; then clear visible EOF |
| CRLF | Move the visible cursor first, recompute X/Y, then perform recording EOL at that new position |
| clear | With dynamically bound X=0/Y=0, perform recording EOF; then clear the visible sheet and fill the process-global GT40 list with NIL. Row zero's begin-continuation flag is not explicitly cleared |
| insert lines `N` | First clear the bottom `N` recorded rows plus the extra row, copy the first `H` screen-row references to the old vector, rotate the lower recorded rows into their insertion positions, then invoke visible insert-lines |
| delete lines `N` | Copy the first `H` row references, rotate rows upward and deleted row objects to the bottom, clear the bottom `N` rows plus extra row, then invoke visible delete-lines |
| region down `(height, N)` | Clear the last `N` rows of the requested recorded region, snapshot row references, rotate the region downward, then invoke the basic visible region-down handler |
| region up `(height, N)` | Snapshot and rotate the requested recorded region upward, clear its last `N` rows, then invoke the basic visible region-up handler |
| insert characters `N` | Invoke visible insertion first; then copy the recorded row backward from `W - 1` to X, using Space for newly opened cells |
| delete characters `N` | Invoke visible deletion first; then copy the recorded row forward from X, using Return after the surviving source range |
| redisplay | Clear the sheet; render rows `0..H-1` only through each last non-Return cell; mask each fat cell to eight bits and display Return or `0o211` placeholders as Space; finally restore the logical cursor |
| save lines | For at most `N` rows from Y through extra row `H`, allocate an eight-bit saved row lazily, fill it with Return, and copy the unchecked half-open save-column range; increment and mask the label after each row |
| restore lines | For at most `N` rows from Y through `H`, copy a non-NIL saved row over the unchecked save range; for visible rows, clear EOL and redraw the entire resulting line; restore the original cursor only after the loop |

For valid nonnegative ranges, the row-reference permutations are exactly:

```text
insert-lines N:
  clear rows H-N .. H; snapshot screen[0:H] into old[0:H]
  old[Y:H-N] -> screen[Y+N:H]
  old[H-N:H] -> screen[Y:Y+N]

delete-lines N:
  snapshot screen[0:H] into old[0:H]
  old[Y+N:H] -> screen[Y:H-N]
  old[Y:Y+N] -> screen[H-N:H]
  clear rows H-N .. H

region-down (R = Y + region-height):
  clear rows R-N .. R-1; snapshot screen[0:H] into old[0:H]
  old[Y:R-N] -> screen[Y+N:R]
  old[R-N:R] -> screen[Y:Y+N]

region-up (R = Y + region-height):
  snapshot screen[0:H] into old[0:H]
  old[Y+N:R] -> screen[Y:R-N]
  old[Y:Y+N] -> screen[R-N:R]
  clear rows R-N .. R-1
```

These are half-open copy ranges; the earlier prose states where the visible TV
operation occurs. Save/restore copies row cells only, not continuation leaders.
During visible restore, the implementation positions the cursor at
`FIRST-COL-TO-SAVE`, clears from there, but then sends the reconstructed substring
beginning at recorded column zero. A nonzero first-save column therefore draws that
prefix starting at the first-save column rather than its original X coordinate; a
strict implementation MUST preserve this ordering and displacement.

The initial label is `low + (high << 7)` and is indexed **before** masking. For
nominal seven-bit operands it is 14 bits, but values `0o2000` and above exceed the
1,024-cell save vector and fail on the first active row. Only subsequent increments
use `label = (label + 1) & 0o1777`. Save-column bounds, row counts, region heights,
character counts, coordinates, and multiposition spans are not validated. Recording
line and region copies are not constrained by the later visible TV handler's
clipping. In particular, insert/delete character pixels move before a recorded-array
fault, while line and region array mutations precede their visible operations. No
handler rolls back.

Zero is itself a discriminating unchecked region count. With `N = 0`, both region
handlers dynamically set X=0/Y=`R`, call recording EOF with exclusive region end
also `R`, clear EOL at row `R` if that row is indexable, then start an
equality-terminated loop at `R + 1` which can never increment back to `R`; it runs
until an array fault. Region-down reaches that fault before its snapshot. Region-up
has already snapshotted the first `H` row references and performed its two empty or
self-copy ranges. Neither reaches the visible region operation.

### Local-edit state and exact input transaction

`LOCAL-EDITING-SUPDUP` subclasses the recording flavor and adds these fields
(`supdup.lisp:2005-2024`):

```text
input_char_count, last_resync_char_count, last_resync_code
resync_reply_code, resync_reply_char_count
send_resync_now = NIL, local_editing_enable = NIL, local_edit_meter = 0
char_table[0o2000]              // 1,024 general cells
word_syntax_table[0o200]        // 128 one-bit cells
top/bottom/left/right margins = 0
insert_mode = INSERT
```

After `:SET-CONNECTION` it sets input count and meter to zero, last resync code to
NIL, `SEND-RESYNCH-NOW` true, and allowed/enabled false. It does **not** reset the
last resync count, reply fields, command tables, word table, margins, or insert mode.
The greeting advertises the local-edit bit. The command-table initializer described
below is peer-invoked, not automatic. Process-global `JOURNAL-STREAM` defaults to
NIL; when non-NIL, its writes are part of the strict transition order rather than
diagnostically invisible side effects (`supdup.lisp:872-873`).

For a cons/blip, the override calls `:NET-OUTPUT` with the cons directly. The base
Supdup numeric bit extraction then signals a type condition before incrementing the
input count; unlike `BASIC-SUPDUP`, this flavor does not ignore the cons.

For a scalar, the exact transaction is (`2032-2086`):

1. If editing is allowed but not enabled and either `SEND-RESYNCH-NOW` is true or
   more than decimal 200 inputs separate the counters, send logical ITS character
   `TOP-BIT | S`; then choose the next resync code (`0o40` initially, incrementing
   through `0o176` and wrapping to `0o40`), send it, and only then copy the current
   input count to the last-resync count.
2. Translate the key by the C303 SUPDUP table and modifiers specified above.
3. Only when editing is enabled and the translated code is below `0o1000` (512),
   invoke `CHAR-TABLE[code]`, substituting `NOT-HANDLED` for NIL.
4. On a true result, optionally beep, increment the local meter, write `"L:"` to a
   non-NIL journal, recompute X/Y from the TV cursor, send logical ITS
   `TOP-BIT | E`, then send `1`. On a false result, set enabled false.
5. In every non-signaling scalar path, send the original translated character even
   after successful local execution or local refusal, format the original Lisp
   character plus a Space to a non-NIL journal, then increment input count.

The pre-echo notice therefore precedes rather than replaces the original character.
A translated code at or above `0o1000` skips local handling without disabling it.
Writes and local display mutations are incremental: failure of the `S`, resync-code,
`E`, `1`, original-character, or journal write preserves every earlier state
change. In particular, a journal failure after the original remote send prevents
the input-count increment.

`SEND-RESYNCH-NOW` is never cleared anywhere in the selected file. Once
`0o241` allows editing, every scalar input while editing is not enabled takes the
resync branch, regardless of the intended decimal-200 fallback. This executable
behavior, rather than the “from time to time” source comment, controls strict mode.

### Resynchronization state machine

The following table is normative for `LOCAL-EDITING-SUPDUP`. It does not replace
the standalone recording-flavor `0o240..0o243` deltas in the complete effector
table.

| Event | Exact transition |
| --- | --- |
| `0o241` allow | Set allowed true and `SEND-RESYNCH-NOW` true; do not enable immediately |
| `0o243` stop | Set allowed and enabled false; preserve counters, code, tables, mode, and margins |
| `0o240` while not allowed | Consume two bytes, ignore their values, then perform the allow transition |
| `0o240` while allowed | Read reply code; set reply count to the second byte plus last-resync count |
| matching reply | After optional journal text `"Resynch: "`, require non-NIL last code, equal reply/code, and reconstructed count equal to input count; dynamically bind enabled true, optionally journal `"Enable: "`, and wait |
| wait sees local handler disable | Exit with enabled false and retain allowed true, permitting another resync on later input |
| wait sees peer input | Probe with nonblocking read and unread the byte; set allowed false, then unwind the dynamic enabled binding back to its prior value |
| mismatching reply | After `"Resynch: "`, optionally format last code, reply code, reply count, and input count to the journal; then set `SEND-RESYNCH-NOW` true and otherwise preserve allowed/enabled state |

A reply while allowed but before a successful resync can attempt to add its count
byte to an unset last-resync count. The exact condition is implementation-defined at
the Lisp runtime level, but no fallback value is supplied. The stream probe does not
consume peer data permanently because it immediately unreads a non-NIL byte. A
journal failure occurs after reply-field mutation but before the subsequent match,
wait, or resend-flag transition at its source position; there is no rollback.

### Exact definition-code table

`0o242` reads two raw bytes and constructs `ARG = (first << 7) + second`. The low
nine bits select `CH` (`0o000..0o777`); the high five bits select one of the following
32 cells. An atomic cell, including NIL, is assigned to `CHAR-TABLE[CH]`. A list cell
invokes its named meta-operation with CH and does not assign the character table.

| Code | Exact table cell | Definition effect |
| --- | --- | --- |
| `0o00` | NIL | Unbind CH |
| `0o01` | `L-E-SUPDUP-FORWARD-CHAR` | Bind handler |
| `0o02` | `L-E-SUPDUP-BACKWARD-CHAR` | Bind handler |
| `0o03` | `L-E-SUPDUP-FORWARD-DELETE-CHAR` | Bind handler |
| `0o04` | `L-E-SUPDUP-BACKWARD-DELETE-CHAR` | Bind handler |
| `0o05` | `L-E-SUPDUP-BACKWARD-CHAR-NO-TABS` | Bind handler |
| `0o06` | `L-E-SUPDUP-BACKWARD-DELETE-CHAR-NO-TABS` | Bind handler |
| `0o07` | `L-E-SUPDUP-INSERT-CHAR` | Bind handler |
| `0o10` | NIL | Unbind CH; vertical-up comment has no implementation |
| `0o11` | NIL | Unbind CH; vertical-down comment has no implementation |
| `0o12` | NIL | Unbind CH; vertical-up/no-tabs comment has no implementation |
| `0o13` | NIL | Unbind CH; vertical-down/no-tabs comment has no implementation |
| `0o14` | NIL | Unbind CH; up-to-line-begin comment has no implementation |
| `0o15` | NIL | Unbind CH; down-to-line-begin comment has no implementation |
| `0o16` | NIL | Unbind CH; CRLF-after-point comment has no implementation |
| `0o17` | NIL | Unbind CH; CRLF-before-point comment has no implementation |
| `0o20` | `L-E-SUPDUP-BEG-OF-LINE` | Bind handler |
| `0o21` | `L-E-SUPDUP-END-OF-LINE` | Bind handler |
| `0o22` | `L-E-SUPDUP-EQUIVALENCE` | Bind handler |
| `0o23` | `L-E-SUPDUP-FORWARD-WORD` | Bind handler |
| `0o24` | `L-E-SUPDUP-BACKWARD-WORD` | Bind handler |
| `0o25` | `L-E-SUPDUP-FORWARD-KILL-WORD` | Bind handler |
| `0o26` | `L-E-SUPDUP-BACKWARD-KILL-WORD` | Bind handler |
| `0o27` | NIL | Unbind CH; argument-digit comment has no implementation |
| `0o30` | NIL | Unbind CH; argument-starter comment has no implementation |
| `0o31` | `(L-E-SUPDUP-SET-WORD-SYNTAX)` | Set `WORD-SYNTAX[CH & 0o177]` to bit `0o200` of CH |
| `0o32` | `(L-E-SUPDUP-SET-INSERT-MODE)` | CH=1 sets INSERT, CH=2 sets REPLACE, every other CH sets NIL |
| `0o33` | `(L-E-SUPDUP-INITIALIZE)` | Ignore CH and perform the exact initialization below |
| `0o34` | `(L-E-SUPDUP-SET-MARGIN)` | Bits `0o600` select left/top/right/bottom; low seven bits become the value |
| `0o35` | NIL | Unbind CH |
| `0o36` | NIL | Repeated final initializer cell; unbind CH |
| `0o37` | NIL | Repeated final initializer cell; unbind CH |

The table has bare length `40`, hence `0o40` or 32. The initializer explicitly ends
at code `0o35`; `FILLARRAY` supplies the NIL cells at `0o36` and `0o37`
(`supdup.lisp:2167-2264`). The five-bit extraction makes every resulting code index
valid. The operands are not checked or masked before the shift and addition, so
non-seven-bit values can overlap or carry into the selected low-nine/high-five
fields; the resulting field values, not a sanitized 14-bit pair, control dispatch.

### Definition-code `0o33` initialization

The initializer performs this complete state transition (`supdup.lisp:2266-2295`):

| State | Exact contents afterward |
| --- | --- |
| `CHAR-TABLE[0o0000..0o1777]` | NIL everywhere first |
| self-insert bindings | `0o040..0o176`, except lowercase `0o141..0o172` which are overwritten below |
| equivalence bindings | `0o141..0o172`, `0o341..0o372`, `0o541..0o572`, and `0o741..0o772` |
| modified digits | NIL; the apparent initialization loop is commented out |
| `WORD-SYNTAX[0o000..0o177]` | zero except digits `0o060..0o071`, uppercase `0o101..0o132`, and lowercase `0o141..0o172`, which are one |
| insert mode | `INSERT` |
| all four margins | zero |

Only `CHAR-TABLE[0o000..0o777]` is addressable by a nine-bit definition and eligible
under the local-input threshold; the upper half of the allocated 1,024-cell array is
source-visible but unreachable through this protocol. The scanners interpret
word-syntax one as a word constituent, despite the nearby comment calling one a
separator. Initialization does not alter allow/enable, resync fields, counts, meter,
recorded rows, or cursor.

### Implemented local command transitions

In this table, “marked” means that `LDB-TEST 0o1010` detects multiposition metadata,
and “tab ahead” searches the current row from X through `W - 1` for placeholder
`0o211`. A false result disables local editing before the original key is sent; a
true result produces the pre-echo notice and original key described above.

| Code | Success transition and exact refusal conditions |
| --- | --- |
| `0o01` forward character | Refuse when `X >= W - 1 - right-margin`, current cell is marked, Return, or tab placeholder. Otherwise move to X+1 and return true |
| `0o02` backward character | Refuse when `X <= left-margin`, previous cell is marked, or previous cell is a tab placeholder. Otherwise move to X-1; the raw cursor-set result is the handler result |
| `0o03` forward delete | Refuse for marked current cell, Return, tab placeholder, end-continuation, or any tab ahead. Otherwise visibly delete one first, shift the recorded row left, fill its tail with Return, and return true |
| `0o04` backward delete | Refuse at/before left margin, for any tab ahead, end-continuation, marked previous cell, a previous tab, or the synthetic marked `-1` used just right of the left margin on a continued line. Otherwise move X left, visibly delete one, shift the record, and return true |
| `0o05` backward character “no tabs” | Calls code `0o02` with `NO-TABS` true, which skips rather than strengthens the previous-tab rejection; it can move over a tab placeholder |
| `0o06` backward delete “no tabs” | Calls code `0o04` with `NO-TABS` true. The tab-ahead scan still applies from current X, but the immediately previous tab check is skipped, so it can delete across that placeholder |
| `0o07` insert/replace | Use the low seven bits of the original translated input, not the handler's CH. Refuse on end-continuation, exactly `end-x == W - 1`, NIL mode, or any tab ahead. INSERT mode, or another non-NIL mode when X equals end-x, visibly inserts one then shifts the record and emits the character. Otherwise a nonmarked current cell is cleared and replaced. Each successful branch forces display output and returns true |
| `0o20` beginning of line | Refuse whenever **Y is zero** or the row begins continued; otherwise move to X=0. The Y test is the selected source defect |
| `0o21` end of line | Refuse on end-continuation; otherwise move to one past the last non-Return cell, or X=0 for an all-Return row |
| `0o22` equivalence | If `(CH & 0o140) == 0o140`, XOR `0o40`; else, if bit `0o200` is set, AND with `0o477`; otherwise refuse. Recursively invoke the resulting character's current table binding or `NOT-HANDLED` |
| `0o23` forward word | Scan only the current row, stopping before `W - 1` when end-continued. Refuse on a marked cell or if no separator follows a found word; otherwise move to that separator |
| `0o24` backward word | Scan only the current row. Refuse on a marked cell; on a separator after a found word move to the following word's first cell. Reaching X=0 succeeds only when a word was found and begin-continuation is false |
| `0o25` forward kill word | Refuse on end-continuation, any tab ahead, a marked cell, or when no separator follows the word. On success visibly and logically delete from X up to but not including that separator |
| `0o26` backward kill word | Refuse on end-continuation, any tab ahead, or a marked cell. On a preceding separator, move and delete through old X. Reaching X=0 additionally requires **Y > 0**, a found word, and no begin-continuation; the top-row Y restriction is the selected source defect |

Top and bottom margins are settable but unused by every implemented handler. The
right margin is consulted only by forward-character; the left margin only by the two
backward character/delete handlers. Word motion, word killing, beginning/end of
line, and insertion do not enforce those margins. The exact-equality fullness test
in insert/replace is not `>=`: a row whose sole unused cell is its final cell has
`end-x = W - 1` and is refused despite that space, while a completely full row has
`end-x = W`, passes, and can lose its tail cell during insertion. Forward
motion/kill also refuses at end rather than accepting a final word without a
following separator.

### Strict bounds and recovery summary

The `C303-LOCAL-EDIT` profile MUST preserve all of these source-visible boundaries:

- the 64-cell recording effector table, including the two-operand repeated tail at
  every byte `0o254..0o277` and ignore-only behavior beginning at `0o300`;
- allocation, record, saved-label, save-range, region, line, character-count,
  multiposition, and cursor bounds exactly at their first array or TV operation;
- standalone `RECORDING-SUPDUP`'s distinct `0o240..0o243` behavior;
- no automatic definition-code `0o33` initialization and no restoration of tables
  or margins at reconnect;
- NIL definition cells as active unbindings, plus the exact `0o36/0o37` repeated
  table tail;
- the unreachable upper half of `CHAR-TABLE`, inverted “no-tabs” checks, BOL and
  backward-kill Y tests, unused top/bottom margins, and exact-equality insert bound;
- `SEND-RESYNCH-NOW` remaining true, with resync/output/local mutation order as
  specified; and
- no rollback after any missing operand, bounds condition, handler condition, peer
  write failure, or visible operation failure.

A safety-oriented implementation MAY validate and stage these operations only under
separately named options. It MUST NOT report strict `C303-LOCAL-EDIT` conformance
after silently changing a tail cell, consuming a different number of operands,
normalizing a range, initializing a table early, clearing the resync flag, or making
an incremental operation atomic.

## Telnet state and wire semantics

### C303 input and ordinary output

C303 Telnet is `BASIC-NVT + TV:FULL-SCREEN-HACK-MIXIN +
TV:LIST-MOUSE-BUTTONS-MIXIN`, with a saved-bits `TELNET` window
(`supdup.lisp:2538-2552`). Its key mapping and pointer rules are specified above.

`BASIC-TELNET :NET-OUTPUT` (`2697-2706`) holds the output lock and:

1. if the value contains protocol modifier bits, emits IAC first only in new-Telnet
   mode and reduces the value to its low eight bits;
2. emits the byte;
3. emits LF after CR; and
4. doubles a literal IAC in new-Telnet mode.

Binary negotiation does not disable outgoing CR-to-CRLF conversion.

Incoming ordinary output (`2708-2731`) obeys this priority:

1. IAC enters option negotiation.
2. A byte at or above `0o200` is ignored as old-Telnet negotiation.
3. Control-G rings the local remote-terminal bell unless both Imlac simulation and
   binary output are active.
4. CR reads one more byte: LF continues normal newline display; NUL is suppressed
   after moving to column zero; another byte moves to column zero and then processes
   that byte as output.
5. `0o177` enters Imlac escape only when Imlac simulation is active.
6. Formatting controls `0o10` through `0o15` except vertical tab are converted to
   Lisp-machine control characters by adding `0o200`, unless binary Imlac mode is
   active.
7. Other bytes buffer for display.

### C303 IAC negotiation

Constants are IAC `0o377`, DONT `0o376`, DO `0o375`, WONT `0o374`, WILL `0o373`,
SB `0o372`, SE `0o360`; options are SUPDUP-OUTPUT `0o26`, Logout `0o22`, Timing Mark
6, Suppress Go Ahead 3, Echo 1, Binary 0 (`supdup.lisp:2680-2695`).

Connect first calls `TELNET-ECHO T`, normally sending `IAC DO ECHO`. On the first
incoming IAC, before reading its command, the source sends DO ECHO **again**, sends
DO Suppress Go Ahead, and sets `NEW-TELNET-P` true (`2733-2738`). The duplicate is
strict behavior.

| Peer command | Option | C303 response/state |
| --- | --- | --- |
| WILL | Echo | Set remote-echo state through `TELNET-ECHO T` |
| WILL | Suppress Go Ahead | Ignore because requested |
| WILL | Binary | Set binary-output true; send DO Binary |
| WILL | SUPDUP-OUTPUT | Start SUPDUP-OUTPUT negotiation |
| WILL | other | Send DONT option |
| DO | Echo | Set local-echo state through `TELNET-ECHO NIL` |
| DO | SGA, Timing Mark, or Binary | Send WILL option |
| DO | other | Send WONT option |
| DONT | Echo | Set remote-echo state through `TELNET-ECHO T` |
| DONT | Binary | Send WONT Binary; source does not clear binary-output here |
| WONT | Echo | Set local-echo state through `TELNET-ECHO NIL` |
| WONT | Binary | Clear binary-output and send DONT Binary |
| SB | any | Enter subnegotiation parser |

There is no case for command byte IAC following IAC. An escaped literal IAC is
therefore consumed by the negotiation parser and produces no display byte. Unknown
subnegotiation scans until IAC SE; a truncated stream blocks or fails without
rollback (`2739-2771,2815-2825`).

### System 46 Telnet deltas

System 46's selected Telnet (`lmwin/supdup.105:969-1197`) lacks C303 binary-output
and SUPDUP-output state flags, pointer reports, Send-IP, overprint, separate-window
entry helper, and `ALLOW-ESCAPE` in its More wait.

Its echo transitions are source-visibly different:

- input is echoed locally when `ECHO-FLAG` is true;
- connect toggles the initially false flag through `TELNET-ECHO T`;
- `TELNET-ECHO T` sends DO Echo, while false sends WILL Echo;
- WILL Echo calls `TELNET-ECHO NIL`; DO Echo calls true; DONT Echo calls NIL; WONT
  Echo calls true.

Its complete IAC option delta is:

| Peer command | Option | System 46 response/state |
| --- | --- | --- |
| WILL | Echo | `TELNET-ECHO NIL`, including WILL Echo when the flag changes |
| WILL | Suppress Go Ahead | Ignore because requested |
| WILL | Binary | Send DO Binary; retain no binary flag |
| WILL | SUPDUP-OUTPUT | Send the SUPDUP-OUTPUT terminal-description reply; retain no enabled flag |
| WILL | other | Send DONT option |
| DO | Echo | `TELNET-ECHO T`, including DO Echo when the flag changes |
| DO | SGA or Timing Mark | Send WILL option |
| DO | other, including Binary | Send WONT option |
| DONT | Echo | `TELNET-ECHO NIL` |
| DONT | Binary | Send WONT Binary |
| WONT | Echo | `TELNET-ECHO T` |
| WONT | Binary | Send DONT Binary |
| SB | any | Use the same count/framing parser family, without a persistent SUPDUP-output mode |

Its bell is always local, without C303's binary-Imlac exception. Its More typein
branch consumes one key directly and does not call `ALLOW-ESCAPE`; Network/Help
therefore receive no special prepass during that wait. These are strict C46 results,
not behaviors to normalize through C303.

### Imlac compatibility

C303 Imlac output sees `0o177`, forces pending display output, reads one byte, adds
`0o176`, and either quotes a literal `0o177` with simulation temporarily disabled or
subtracts `0o200` and dispatches through the SUPDUP `%TD` table
(`supdup.lisp:2773-2780`). Only the upper bound is tested. A malformed small operand
can make the resulting index negative and signal an array error.

### SUPDUP-OUTPUT subnegotiation

On WILL SUPDUP-OUTPUT, C303:

1. sets `SUPDUP-OUTPUT-FLAG` true;
2. emits `IAC SB SUPDUP-OUTPUT 1`;
3. emits terminal variables with character insertion/deletion forced on;
4. emits `IAC SE`; and
5. flushes (`supdup.lisp:2802-2813`).

The flag mutation precedes all writes. A write failure leaves it true.

For incoming `SB SUPDUP-OUTPUT 2`, the parser reads one byte as a remaining byte
count, temporarily wraps the stream so each `:TYI` decrements that count, and sends
bytes through the SUPDUP display decoder. When the count reaches zero it consumes
two advertised cursor bytes, then requires IAC SE. Rendering occurs before count,
cursor, and footer validation; malformed framing may leave partial pixels or state
before signaling `SUPDUP-OUTPUT subnegotiation out of phase`
(`supdup.lisp:2827-2845`).

### More, logout, and interrupt

C303 Telnet More (`supdup.lisp:2879-2895`) sets `MORE-FLAG`. If called in typeout it
injects `(:MORE)` and waits for typein to clear the flag. Typein calls
`ALLOW-ESCAPE`, then consumes **any one** other event, not specifically Space, and
clears the flag.

Network L sends `IAC DO LOGOUT` before Quit. Network A flushes ordinary output,
allocates a Chaos packet, writes `IAC IP IAC DM`, sets its length to four, and sends
it with Chaos opcode `0o201` (`2897-2912`). Packet allocation or send failure may
leave cleanup to Chaos internals; no local unwind cleanup is present in this method.

## Failure, abort, and recovery contract

| Failure point | Strict result |
| --- | --- |
| Replacement target malformed | Existing connection was already disconnected |
| Chaos connect returns error object | Return/report it; no new connection publication |
| C303 stream creation/greeting fails | Label may be changed; acquired connection is unpublished and ordinary disconnect cannot find it |
| C46 greeting fails | Published connection remains available to disconnect cleanup |
| Network B debugger exits abnormally | Super-image/NVT-buffer restoration may not run |
| Network C second read fails | Same restoration gap; old/new escape state follows mutation point |
| Network L logout byte/final-stream operation fails | Preserve the accepted prefix; do not run Quit/disconnect. C46's final operation is `:FORCE-OUTPUT`; C303's is `:FINISH` |
| Peer EOF or remote output error | Inject error blip into typein; typeout waits forever for reset |
| Truncated `%TD`, graphics, GT40, ARDS, Imlac, or subnegotiation | Preserve all prior bytes, pixels, cursor moves, state, and writes; then block or signal |
| Output-lock body fails | Release lock only if current process owns it; prior writes remain |
| Telnet SUPDUP-OUTPUT start write fails | Enabled flag remains true in C303 |
| Telnet More has no further input | Typeout or typein remains waiting according to branch |
| Unknown Network suffix | Beep; restore bottom prompt/cursor |
| Unsupported `%TD` slot | Explicit no-op or ignored out-of-table code, never an invented modern behavior |

`SYS:ABORT` at the C303 top-level is distinct from peer failure. With a live
connection it asks whether to disconnect. “No” resumes; “yes” produces
`"Connection aborted"`, disconnects, prints, and either returns or reprompts. A bound
call also has its surrounding exit restart. A strict test MUST record which boundary
handled an abort.

## Source/manual/runtime disagreements

| Question | Selected source | Manual or other source | Runtime | Normative decision |
| --- | --- | --- | --- | --- |
| C303 System-S/T | Current `.323` has no registration | `.322` and `wind/operat.text:1878-1882` have/claim them | `System 303-0` Help omits S/T | Absent in `C303-4DF-SRC` and runtime witness; present only in named historical/profile source |
| Default C303 escape | Network | operator manual says Break | Not exhaustively probed | Network in strict source profile |
| Network E | Implemented | computed Help omits it | Not probed | Implement and preserve stale Help |
| Slash socket radix | Decimal at parser calls | comment/Help says octal | Not probed | Decimal in strict source profile |
| Callable API | Current Supdup/Telnet functions accept mode; Imlac argument belongs to `TELNET-BIND` | `man/chaos.text:1488-1503` documents older signatures | Not probed | Selected source signatures only for source-profile report |
| C303 mode default | True selects separate | variable docstring says NIL is new-window default | Not probed | Executable branch controls |
| Preserved application presence | Source declares/preactivates subsystem | source tree alone cannot establish band residence | base Help lacks S/T; source bridge was required | Keep source and runtime profiles separate |

## Unselected maintained-tree variants

`window/telnet-code.lisp` and `window/telnet-front-hack.lisp` are not loaded by the
selected `SUPDUP` declaration. They are not additional applications.

`telnet-code.lisp` adds a four-byte Lisp-machine-character stream, globally replaces
`CHAOS:MAKE-STREAM`, adds Telnet server initialization, overrides the LM Telnet
flavor, and supplies only a `TELNET-SEPARATE` override. Its `LM-CHAR-STREAM :TYI`
wrapper at lines 37-44 appears to reconstruct a character and then clear/return NIL
on one branch while retaining the communication value on the untyi branch. This is
`TODO-RUNTIME-TELNET-CODE-TYI` pending macro expansion or execution, not yet a
definitive defect claim.

`telnet-front-hack.lisp` is instead a near-copy of Supdup/Telnet. Relative to current
source it defaults overprint true, removes overprint accessors, enables a login check,
uses `:characters nil`, retains older process/multiple-value syntax, and has direct
wrappers that bypass normal Telnet translation. It does **not** contain the same
LM-character server/front-end work as `telnet-code.lisp`.

## Safety-corrected options

A safer reconstruction MAY expose these independent selectors. None may be silently
enabled by a strict historical conformance label.

| Option | Permitted correction |
| --- | --- |
| `C303-SAFE-CONNECT` | Keep the acquired connection in temporary ownership and close it if stream/greeting fails |
| `NVT-SAFE-MODE-RESTORE` | Unwind-protect super-image or C46 I/O-buffer restoration around B/C |
| `NVT-SAFE-ESCAPE-QUOTE` | Provide an explicit quote path even when escape equals a reserved command |
| `SUPDUP-SAFE-OPERANDS` | Bound and stage variable-length effectors before display mutation |
| `GT40-SAFE-BOUNDS` | Reject invalid command and item indices; keep keyboard table per instance and restore it |
| `ARDS-SAFE-INSTANCE` | Make ARDS state per terminal and correct scaling through an explicit profile delta |
| `LOCAL-EDIT-SAFE-BOUNDS` | Validate saved labels and column ranges; correct top-row beginning/kill behavior |
| `TELNET-SAFE-IAC` | Handle IAC-IAC as literal data and bound Imlac dispatch |
| `TELNET-SAFE-SUBNEG` | Validate complete SUPDUP-OUTPUT framing before committing display mutations |
| `TELNET-SAFE-MOUSE` | Validate coordinate range and sign before serializing |

The corrected profile MUST report both strict expected result and corrected result for
every selected option.

## Runtime and screenshot boundary

### Clean registration observation

The clean session `software-catalog-20260718`, generation 1, booted `System 303-0`
and displayed System Help containing only Top-L Lisp(Edit), E Editor, I Inspector,
L Lisp, and P Peek. No S/T registration was present. The System Help frame remains
local and unpublished under the ignored session tree, pending a separate
image-specific publication review; it MUST NOT be described as reviewed or linked
as a curated asset. It is local runtime evidence only for that exact registry state.
Its PNG SHA-256 is
`06253bde02161f986fccd80f084a60dbbb7174e60c92c91f2aacdeaec4938aa6` and
decoded-pixel SHA-256 is
`1344fd3d9e779aa2df89a6f255c444005a6883ed12ab72273339d904b77a7617`.
The session stopped cleanly with unchanged base disk. Full provenance is recorded in
[D02](../program-selection-activities-and-window-management-reimplementation-specification.md#c303-system-303-0-runtime-and-pinned-source).

### Source-injected static shells

Session `d10-network-terminal-cadr-20260719`, generation 1, used load band
`System 303-0` and a local read-only FILE bridge to inject maintained source after
ordinary subsystem loading failed. Raw capture `0020-supdup-connect-prompt.png`
shows only a sparse frame labeled `Supdup 1 -- not connected`; despite its filename,
the source-predicted `Supdup. Type the HELP key ... Connect to host:` prompt was not
visible. Raw `0025-telnet-disconnected-shell.png` shows an explicitly constructed
Telnet shell with NIL process slots after ordinary `TELNET-SEPARATE` reached an
unbound `TYPEIN-PROCESS` failure.

These two images are presented by the main D10 specification only as
**source-injected/static shell visual evidence**. They establish bounded surface,
who-line, labels, the Telnet shell's visible text cursor, and shared full-screen
relationships. They are not pristine
compiled-band application observations and do not establish:

- ordinary subsystem load or initialization;
- successful typein/typeout process creation;
- the disconnected prompt loop;
- any key or pointer dispatch;
- host parsing, connection, greeting, Telnet negotiation, or SUPDUP output;
- cleanup behavior; or
- identity between pinned source and compiled `System 303-0` definitions.

The CADR session stopped cleanly with `forced_stop=false`,
`state_may_be_incomplete=false`, emulator/Xvfb exit status zero, and unchanged base
disk. Its source injection and failures nevertheless make application state
contaminated for behavioral-oracle purposes. The main specification records exact
session, disk, source, emulator, image, pixel, sidecar, and run-record identities.
Raw sessions remain ignored. Curated use is governed by the
[screenshot publication review](../screenshot-publication-rights-review.md) and the
[CADR harness contract](cadr-computer-use-harness.md).

### Named runtime blockers

| Obligation | Required setup and action | Claim closed |
| --- | --- | --- |
| `TODO-RUNTIME-C46-VISUAL` | Boot a checksum-pinned matching System 46 band; invoke S/T and Create entries; capture clean disconnected Supdup and Telnet | C46 entry, labels, prompts, geometry |
| `TODO-RUNTIME-C303-CLEAN-LOAD` | Build or boot a compatible band containing `C303-4DF-SRC` without interactive source injection | Source initialization and process ownership |
| `TODO-RUNTIME-C303-BINDINGS` | In clean C303, enumerate every physical/modifier input in connected and disconnected states against a recording peer | Effective input tree and runtime Help |
| `TODO-RUNTIME-C303-PEER` | Attach a deterministic isolated Chaos/Telnet peer with no external route | Connect, greeting, negotiation, disconnect, error order |
| `TODO-RUNTIME-C303-DISPLAY` | Replay synthetic finite streams covering every `%TD`, graphics, GT40, ARDS, Imlac, and local-edit branch | Pixel/state and malformed-input behavior |
| `TODO-RUNTIME-C303-POINTER` | Exercise all buttons, click counts, modifiers, selection states, and SUPDUP-OUTPUT modes | TV-to-Telnet pointer tree and wire |
| `TODO-RUNTIME-C303-QFASL` | Inventory compiled definitions in `System 303-0` and compare their selected methods/constants with current source | Compiled/source relationship |
| `TODO-RUNTIME-TELNET-CODE-TYI` | Macroexpand and execute the unselected stream wrapper in a disposable process | Apparent wrapper defect |

No clean representative application screenshot exists for System 46 or the full C303
behavioral profile. A future page about visible connected behavior MUST either close
the appropriate obligation and publish a reviewed minimal image or retain the
blocker explicitly.

## Conformance suite

### Profile and module selection

| ID | Test | Distinguishing result |
| --- | --- | --- |
| `CADR-NT-P01` | Inspect System 46 load inventory | LMWIN `SUPDUP 105` selected; LMIO shadow excluded |
| `CADR-NT-P02` | Inspect C46 initial System and Create registries | S/T and Supdup/Telnet present |
| `CADR-NT-P03` | Inspect current C303 declaration/source | Only `WINDOW; SUPDUP` loaded; Create entries present; S/T registration absent |
| `CADR-NT-P04` | Compare current file with `.322` | Current byte identity `.323`; `.322` alone retains S/T calls |
| `CADR-NT-P05` | Search selected declaration for variant files | `telnet-code` and `telnet-front-hack` unselected |

### Complete input enumeration

For every selected profile, the harness MUST enumerate every physical keyboard
character/function key across all modifier combinations representable by the target
keyboard. It must run the matrix in disconnected Supdup, connected Supdup,
disconnected Telnet, connected Telnet, Telnet More, and C303 prefix-second-stage
contexts.

| ID | Test | Required observation |
| --- | --- | --- |
| `CADR-NT-K01` | Terminal/System prefixes while NVT selected | Inherited D02 tree wins before ordinary protocol input |
| `CADR-NT-K02` | Every C303 Network suffix | Exact table, context gates, beep/no-op, Help predicates and E omission |
| `CADR-NT-K03` | Every C46 escape/Network suffix | Exact C46 table; Network remains prefix after escape change |
| `CADR-NT-K04` | `escape C` followed by every modified key | Exact stored character and restoration/failure result |
| `CADR-NT-K05` | Digits, minus, universal-argument-like keys, repeats | No numeric/repeat state; ordinary unbound/beep or protocol mapping |
| `CADR-NT-K06` | Escape assigned to each reserved command | Command shadows literal-send branch |
| `CADR-NT-K07` | Cons/mouse blip as prefix suffix | Strict condition/failure, no invented ignore rule |
| `CADR-NT-K08` | Every SUPDUP table cell, repeated tail, modifier combination, and extraction boundary | Compare all 128 C46 and 129 C303 cells. Require C46 codes `0o177`, `0o200`, `0o236`, `0o237`, `0o377`, raw Escape, and packed high bits; require C303 codes `0o33`, `0o176`, `0o177`, `0o236`, `0o237`, `0o377`, and a non-character. Prove bypass, special case, explicit cell, repeated `0o4102` tail, last-valid cell, exact ITP bytes, C46 four-bit modifier field versus C303 Mouse bit, and that no valid extracted code can reach an array-bounds condition |
| `CADR-NT-K09` | Every Telnet table cell, repeated tail, modifier combination, and extraction boundary | Compare all 128 cells in each profile. Require codes `0o200`, `0o201`, `0o237`, `0o240`, `0o377`, C46 packed high bits, and a C303 non-character; prove unreachable index zero/bypass, explicit cells, repeated-zero tail, NUL without Meta versus `0o200` with Meta, last-valid cell, low-five Control mapping, Super/Hyper collapse, C303-only Control-marker/End branch, echo polarity, and absence of a valid array-OOB input |
| `CADR-NT-K10` | Disconnected Help, escape, editor interception, blank line | Exact prompt hook and reprompt behavior |
| `CADR-NT-K11` | C46 disconnected ordinary/CR, empty and nonempty Rubout, Clear, Form, VT, every Control/Meta combination, direct Help/Break/Network, inherited global prefixes, and a cons fixture | Exact echo, edit buffer, rendered clear/redraw, cursor, restart, returned string, beep, global interception, zero-length line, or source-visible type condition; no application Help/prefix/numeric/repeat/full-rubout behavior |

`CADR-NT-K11` boundary sequences MUST include Return at length zero; Rubout at
lengths zero and one; `A B Rubout C Return` returning `"AC"`; `A Clear Return`
returning the empty string; retained input across Form and Vertical Tab; modified
Clear/Form/VT/Rubout; an edit followed by a parse restart; input spanning the
rubout buffer's initial `0o1000`-cell allocation; and a non-character fixture at
each comparison boundary. The report MUST distinguish bytes in the returned host
string from characters merely echoed or retained in the edit buffer.

### Pointer and selection

`CADR-NT-M01` MUST cross product selected/unselected state, left/middle/right, every
available click count, and Control/Meta/Super/Hyper encodings. It MUST prove that the
first unselected left click selects and is consumed, double-right invokes System Menu,
Supdup ignores delivered blips, Telnet ignores them with SUPDUP-OUTPUT false, and
Telnet emits exact bytes when true. Boundary fixtures MUST include -1, 0, 9, 10, 99,
100, 999, and 1000 cell coordinates.

### Entry and lifecycle

| ID | Fixture/action | Required observation |
| --- | --- | --- |
| `CADR-NT-L01` | Separate call, NIL path, connected match | Select existing; return NIL |
| `CADR-NT-L02` | Separate call with idle match | Reuse idle; set pending target; expose/select; return true |
| `CADR-NT-L03` | No existing window | Construct exact selected flavor and processes |
| `CADR-NT-L04` | Bound call | Borrow caller typein; allocate typeout resource; selection substitute; return/cleanup |
| `CADR-NT-L05` | Replacement path parse failure | Old connection closed before parse failure |
| `CADR-NT-L06` | Fault each C303 connect stage | Exact label, stream, connection publication, leak, process and BOW state |
| `CADR-NT-L07` | Same faults in C46 | Connection published before greeting and available to disconnect |
| `CADR-NT-L08` | Peer EOF/host-down/CLS/LOS/unknown state | Exact reason injection, typeout wait, typein disconnect/reset |
| `CADR-NT-L09` | Abort with yes/no and connected/disconnected | Exact prompt, continuation, disconnect and return behavior |
| `CADR-NT-L10` | D/Q/L/Call/P in separate and bound modes, faulting each logout step | Exact logout/close/return/bury distinctions; `0o300`, then `0o301`, then C46 `:FORCE-OUTPUT` versus C303 `:FINISH`; no Quit after any failed step and no rollback of accepted bytes |
| `CADR-NT-L11` | Disconnect and reconnect | Persistence/reset matrix exactly preserved |

### Host grammar

`CADR-NT-H01` MUST test NIL, symbol, known and unknown fixnum, host object, known
Chaos string, unknown Internet string, valid octal numeric string, invalid numeric
string, slash contact, decimal socket, leading-zero socket, explicit gateway, missing
gateway, nonnumeric explicit-gateway suffix, whitespace-only prompt, programmatic
empty string, and C46 Return on an empty edit buffer. It MUST compare C46 and C303
results independently and capture actual Chaos target, contact string, label,
condition, prompt repetition or absence, and whether an old connection was already
closed.

### SUPDUP wire and display

| ID | Test | Required observation |
| --- | --- | --- |
| `CADR-NT-S01` | Known geometry/metrics | Exact C46 `-5` and C303 `-6` terminal-variable byte streams |
| `CADR-NT-S02` | Greeting controls/LF/delimiter/EOF | Exact conversion and stop behavior |
| `CADR-NT-S03` | Every ITS input/modifier plus Supdup logout | Exact ITP, literal `0o34`, lock scopes, ordered logout bytes, and distinct C46 `:FORCE-OUTPUT`/C303 `:FINISH` completion calls |
| `CADR-NT-S04` | Each byte `0o000`–`0o377` | Exact buffer/effect/ignore behavior for both release profiles |
| `CADR-NT-S05` | Truncate each effector after every operand | Exact prior pixels/state and failure/wait |
| `CADR-NT-S06` | Repeated bells followed by another byte | One bell; first nonbell unread and processed next |
| `CADR-NT-S07` | Region overlaps and bounds | Exact clipping, erase band, signed BITBLT direction |
| `CADR-NT-S08` | `0o227`, `0o230`, `0o220`, disconnect | Distinct BOW, graphics, screen and GT40 reset domains |

### Graphics, GT40, ARDS, and local editing

| ID | Test | Required observation |
| --- | --- | --- |
| `CADR-NT-G01` | Every general command/draw nibble and flag combination | Exact point consumption, ALU, inclusive bounds, virtual scaling and exit unread |
| `CADR-NT-G02` | Nested push plus truncation | Dynamic-state restoration and already-drawn pixels |
| `CADR-NT-G03` | GT40 command indices 0–15 | Exact handlers and index-15 strict bounds failure |
| `CADR-NT-G04` | GT40 item -1/0/9/10, checksum variants | Exact unchecked bounds and checksum indifference |
| `CADR-NT-G05` | Two Supdup windows using GT40 | Global list/blinker/keyboard cross-window effect |
| `CADR-NT-G06` | ARDS set/long/short in two windows | Exact coordinate decode and global cross-window state |
| `CADR-NT-G07` | Every recording byte `0o200..0o300`, truncated after every operand | Exact 64-cell dispatch, operand consumption, standalone/local flavor delta, all twenty `0o254..0o277` repeated local-label leaves, cursor sync only on normal return, and ignore boundary at `0o300` |
| `CADR-NT-G08` | Final-column writes; every line/region/character bound including region `N=0`; saved labels 1023/1024; invalid save ranges and multiposition spans | Exact last-cell overwrite, equality-loop array fault and pre-fault snapshot delta, operation order, first strict array/TV failure, prior pixels/rows/operands, label wrap only after first index, and no rollback |
| `CADR-NT-G09` | All 32 definition codes and definition-code `0o33` | Exact atom assignment versus meta-call; NIL at every listed cell including repeated `0o36/0o37`; exact 1,024-cell character table, 128-bit word table, mode and margins; prove initialization is not automatic |
| `CADR-NT-G10` | Every implemented handler across margins, continuation, Return, tab, marker, empty/full/final word, top row, and insert modes | Exact true/false transition, cursor/record/pixel change, original remote send, no-tabs inversion, BOL/back-kill Y defects, unused margins, and equality-only fullness check |
| `CADR-NT-G11` | Allow/stop, matching/mismatching/spurious resync, local refusal, high translated code, and intervening output | Exact counters/code wrap, dynamic enable/wait/unread, allow/enable outcomes, and `SEND-RESYNCH-NOW` remaining true so every eligible non-enabled scalar input resynchronizes |
| `CADR-NT-G12` | Fault every resync, pre-echo, original-send, journal, recording-display, and definition step | Exact accepted byte prefix, journal prefix, counter/meter/table/cursor/record state at failure, and absence of rollback |

### Telnet

| ID | Test | Required observation |
| --- | --- | --- |
| `CADR-NT-T01` | Initial connect then first IAC | Duplicate DO Echo plus DO SGA in C303 |
| `CADR-NT-T02` | Full WILL/WONT/DO/DONT × option table | Exact replies and state for C46 and C303 separately |
| `CADR-NT-T03` | IAC IAC | Strict C303 loses literal byte |
| `CADR-NT-T04` | CRLF, CR-NUL, CR-other, bare controls | Exact cursor/display and buffering |
| `CADR-NT-T05` | Binary negotiation plus outgoing CR | CR remains CRLF; incoming bell/Imlac gates change only as specified |
| `CADR-NT-T06` | Imlac valid/literal/malformed-small operand | Exact dispatch or negative-index failure |
| `CADR-NT-T07` | SUPDUP-OUTPUT enable fault after every write | Flag and partial output state |
| `CADR-NT-T08` | Exact/short/long/malformed subnegotiation | Count, rendered prefix, cursor/footer consumption and condition |
| `CADR-NT-T09` | More with ordinary, Help, escape-command, and pointer input | Any nonescape event clears wait; Help/escape loop first |
| `CADR-NT-T10` | Network A and Telnet L with injected write/send failures | Exact packet bytes/opcode, `IAC DO LOGOUT` before close, and missing cleanup |

### Acceptance

A conformance report MUST name the exact profile, level, optional axes, corrected
options, source identities, adapter versions, and every skipped test. `L2` requires
the exhaustive input and pointer denominator, not a hand-picked command list. `L3`
requires byte/state traces and malformed-input tests. `L4` additionally requires the
preserved comparison procedure below and closure of every relevant runtime blocker.

## Preserved-system comparison procedure

1. Verify the base load-band checksum and exact emulator checksum.
2. Copy the disk into an isolated harness session; do not write the base.
3. Record public System 46 or LM-3 revisions and private copy-time source tree hash.
4. Prefer a band already containing the selected subsystem. If source injection is
   unavoidable, label every result source-injected and do not use it as a pristine
   compiled-band oracle.
5. Attach a project-owned deterministic Chaos/Telnet peer inside the isolated
   environment, with no external route or real credentials.
6. Execute one discriminating input/protocol sequence at a time. Record ordered
   keyboard/pointer actions, peer bytes, connection states, process states, display
   state, screenshot and decoded-pixel hashes.
7. Exercise clean disconnect and separately exercise peer close, abort, and injected
   failures.
8. Stop through the harness, recording `forced_stop` and
   `state_may_be_incomplete`; verify the public base disk remains unchanged.
9. Keep raw sessions ignored. Publish only the minimum reviewed screenshot needed for
   a substantive claim, with the asset catalog and rights review.

Screenshot sidecars do not contain the execution-time `usim` hash; join it from
`run.json`. A screenshot proves only the visible state and exact action prefix
recorded with it.

## Known unknowns and nonclaims

- No configured matching System 46 runtime has been exercised.
- No clean C303 band containing the current source profile has been exercised.
- No deterministic isolated peer has completed C303 Supdup or Telnet negotiation.
- The current source and compiled definitions in `System 303-0` have not been
  reconciled method by method.
- Scheduler races, connection-object reclamation, and packet cleanup after failures
  remain unobserved.
- GT40, ARDS, recording/local editing, Imlac, SUPDUP-OUTPUT, pointer reports, and all
  malformed protocol paths remain source-only claims.
- The exact condition/restart objects for several malformed streams remain runtime
  obligations; this page specifies only source-visible mutation order.
- Create-menu behavior when the declared subsystem is absent from a band remains an
  inherited TV/runtime question.
- The unselected `telnet-code.lisp` wrapper requires macro-expansion/runtime review.
- No timing or pixel-identity claim is made.

## Primary sources

- MIT CADR System 46 selected
  [`LMWIN; SUPDUP 105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/supdup.105),
  [`LMWIN; STREAM 14`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/stream.14),
  [`LISPM; QFCTNS 438`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qfctns.438), and
  [`LISPM; QMISC 281`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qmisc.281), plus `QCOM 437`, the
  System-key registry, Create menu, package declaration, operator manual, and
  separately labeled LMIO/Escape lineage at Git commit `8e978d7d…`.
- Maintained LM-3
  [`window/supdup.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsupdup.lisp),
  [`sys/qmisc.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fqmisc.lisp), `doc/common.lisp`, TV/Chaos support files, manuals, variants, and
  microcode at Fossil check-in `4df393c…`.
- [Network terminal historical dossier](../network-terminal-applications.md).
- [Network terminal applications reimplementation specification](../network-terminal-applications-reimplementation-specification.md).
- [MIT CADR and LM-3 TV window-system specification](tv-window-system-reimplementation-specification.md).
- [Program selection, activities, and window-management specification](../program-selection-activities-and-window-management-reimplementation-specification.md).
- [Operating CADR through the Xvfb computer-use harness](cadr-computer-use-harness.md).
- [Publishing runtime screenshots for museum documentation](../screenshot-publication-rights-review.md).

Last verified: 2026-07-19.

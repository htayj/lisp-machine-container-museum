---
type: Reimplementation Specification
title: CADR QSend, Converse, SHOUT, and NOTIFY bindings and semantics
description: Normative public-source profiles for System 46 direct messaging and maintained LM-3 System 303 Converse, including complete local input trees, state, ordering, failures, and runtime gaps.
tags: [mit-cadr, lm-3, converse, qsend, notifications, chaosnet, zwei, reimplementation]
timestamp: 2026-07-19T20:08:26-04:00
---

# CADR QSend, Converse, SHOUT, and NOTIFY bindings and semantics

## Status and reconstruction claim

This companion specifies two deliberately separate public-source profiles:

- `C46-QSEND`, the direct-message sender, receiver, reply pop-up, and received-message
  history selected by MIT CADR System 46; and
- `C303-CONVERSE`, the later Converse editor, QSend compatibility entry points,
  SHOUT, and network NOTIFY facilities selected by the maintained LM-3 System 303
  source tree.

A conforming source-profile implementation can reconstruct their application-owned
state, input routing, network transaction order, partial failures, and release
differences from this page. The System 303 profile also normatively incorporates the
complete parent ZWEI trees named below. “Complete” means complete for the selected
files, profiles, and finite denominators stated here; it does not mean that every MIT
band contained the facility or that the tested System `303-0` world had Converse
resident.

This page claims:

- architectural and semantic compatibility for both selected source profiles;
- exact application-owned input, named-command, transient-query, pointer, and
  fallthrough closure for those profiles; and
- source-profile behavioral compatibility after the listed conformance tests pass.

It does **not** claim:

- that System 46 contained a Converse editor, SHOUT, or the later NOTIFY service;
- that maintained System 303 source is pristine MIT release media;
- that the System `303-0` load band exercised the source bodies described here;
- exact historical Lisp source API, QFASL/binary, timing, or pixel compatibility;
- successful delivery without an isolated Chaosnet peer; or
- CLIM, Dynamic Windows, or presentation-system behavior.

The broader historical and Genera comparison remains in
[Converse, direct messages, and notifications](../converse-direct-messages-and-notifications.md).
This page is the normative public CADR/LM-3 companion for D09.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. “Then” specifies observable
order and does not imply rollback. A source-visible defect remains part of a strict
profile unless an explicitly named corrected profile says otherwise.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C46-SRC` | Readable System 46 source at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | Selected QSend definitions, direct-message order, pop-up construction, and negative source search | Presence or behavior in every System 46 band |
| `C46-SUB` | System 46 shared query/editor source at the same commit | Inherited yes/no and rubout-reader behavior | An application-owned binding |
| `C303-SRC` | Readable maintained LM-3 source at Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | Selected Converse/Chaos definitions and source-visible order | Residence in the tested world |
| `C303-SUB` | ZWEI, FQUERY, TV window/stream/menu/mouse, string, and system-declaration source at the same check-in | Parent dispatch, case folding, prefixes, notification and menu input, coercion, and load contracts | Converse-specific ownership |
| `C303-MAN` | Maintained manual and release-note source at the same check-in | Documented entry paths and intended behavior | Exhaustive or bug-free implementation behavior |
| `C303-RUN` | Isolated Xvfb session `d09-converse-20260718`, generation 1 | The exact load-band boundary and failed load paths exercised in that session | Visible Converse behavior or network delivery |
| `INF` | Implementation-independent reconstruction rule | A testable host-side model preserving established behavior | Historical internal representation |
| `TODO-RUNTIME` | Named oracle obligation | Nothing until performed | Permission to fill the result by inference |

When witnesses disagree, `C46-SRC` controls the strict System 46 source profile and
`C303-SRC` controls the strict maintained-source profile. `C303-RUN` controls only
the exact attempted paths in its recorded band. Manual intent is retained beside a
source defect rather than silently replacing it.

## Compatibility profiles and levels

### Release profiles

| Profile | Exact target | Configuration boundary | Deliberate deltas |
| --- | --- | --- | --- |
| `C46-QSEND` | Latest `src/lmio/chsaux.113` selected by the System 46 `>` load inventory at Git commit `8e978d7d…` | Early TV pop-up and Chaos `SEND`; no full Converse module found | None |
| `C303-CONVERSE` | `io1/conver.lisp`, `network/chaos/chsaux.lisp`, and named support files at Fossil check-in `4df393c…`, tag `system-303` | TV + ZWEI + Chaos; `CONVERSE` is an `OUTER-SYSTEM` component but separately loadable | Preserve selected-source defects |
| `C303-SAFE` | Optional reconstruction extension over `C303-CONVERSE` | Same public behavior unless a correction is selected | May repair only defects listed in [Safety-corrected options](#safety-corrected-options), and MUST expose the choice |
| `C303-WORLD-303-0` | Preserved `System 303-0` load band exercised in session `d09-converse-20260718` | No configured peer; ordinary source service unavailable; local read-only bridge used for a bounded attempt | Observation-only; not a source/body substitute |

These short names are exact aliases for the main D09 identifiers, not parallel
profile systems:

| Companion label | Main D09 identifier | Normative relation |
| --- | --- | --- |
| `C46-QSEND` | `DM-C46-SRC` | identical source profile |
| `C303-CONVERSE` | `DM-C303-SRC` | identical source profile |
| `C303-WORLD-303-0` | `DM-C303-3030-RUN` | identical bounded runtime-witness profile |
| `C303-SAFE` | none | optional correction overlay on `DM-C303-SRC`; never an independent historical profile |

The maintained Fossil branch was created in 2025 from historical material. Its
check-in is a maintained restoration target, not evidence that the exact selected
bytes were installed in an original 1980s band. `[C303-SRC]`

### Conformance levels

This companion uses the main specification's levels unchanged:

| Level | Required closure |
| --- | --- |
| `L1` semantic core | Profile-tagged state; deterministic direct-message, queue, history, and notification transitions; complete error values; explicit clock, filesystem, address, network, mail, display, and scheduler adapters; inert peer permitted |
| `L2` interactive application | `L1` plus every effective direct, inherited, prefix, transient, menu, pointer, presentation, numeric-argument, repeat, Help, shadowing, fallthrough, and unbound path; frame/view lifecycles; rights-safe visual relationships |
| `L3` preservation fidelity | `L2` plus preserved-system comparison; exact selected wire serialization and acknowledgement order; timing-visible queue/popup behavior; isolated real peers; profile-specific defect results; closure of every mandatory oracle for the claimed feature |

`C46-QSEND/L2` means exactly `DM-C46-SRC/L2`, and `C303-CONVERSE/L2` means exactly
`DM-C303-SRC/L2`. Both are source-profile goals. `C303-WORLD-303-0` currently closes
only the negative load-boundary observation, not `L3`.

## Evidence ledger

| Contract area | Direct witness | Cross-check | Status |
| --- | --- | --- | --- |
| System 46 sender, prompt, receiver, lock, and history | `lmio/chsaux.113:542-676` | `lispm/lfl.192:55-73`; `lmdoc/lispm.files:142` | Normative `C46-SRC`/`C46-SUB` |
| System 46 absence boundary | full-text search of the pinned snapshot | no `CONVERSE`, `SHOUT`, `NOTIFY`, or `NOTIFY-ALL-LMS` definition found | Narrow negative evidence |
| System 303 state and buffer | `io1/conver.lisp:11-519` | System 94 release note | Normative `C303-SRC` |
| Direct and named commands | `io1/conver.lisp:521-930` | hard-coded Converse Help, which disagrees in two places | Normative source; disagreement explicit |
| Frame, process, entry, queue, and initialization phases | `io1/conver.lisp:26-63,110-112,419-459,932-987,1086-1095,1412-1419`; [`sys/ltop.lisp:647-654,691-721,727-776`](https://tumbleweed.nu/r/sys/file?name=sys%2Fltop.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91); `sys/sysdcl.lisp:383-386,713-727` | public `sys/ltop.lisp`, 42,225 bytes, SHA-256 `57dd2591cfeb84ee00f1d9cb51c17b5c30f22e36026074117e3420f4e3dc943e`; failed load attempts in `C303-RUN` | Source normative; residence open |
| QSend, receiver, simple reply | `io1/conver.lisp:991-1417` | Chaos manual and System 93 notes | Normative source; peer runtime open |
| SHOUT | `network/chaos/chsaux.lisp:341-362`; `sys2/string.lisp:124-170` | Chaos manual | Normative defect; runtime open |
| NOTIFY | `network/chaos/chsaux.lisp:1314-1373`; `io1/conver.lisp:1159-1182` | System 86 release note | Normative; omitted-message defect open at runtime |
| Parent key and pointer dispatch | `zwei/stream.lisp`; D05 inventory | source-constructed comtab indirection | Normatively incorporated |
| TV notification ingress and pop-ups | `window/basstr.lisp:561-779,1208-1259`; `window/baswin.lisp:1738-1918` | `window/stream.lisp:145-213`; `window/cometh.lisp:43-62`; System 94 note | Normative TV-owned surface used by C303 notify modes |
| Ambiguous-host momentary menu | `window/menu.lisp:5-99,570-611,1091-1140,1262-1320`; `window/mouse.lisp:176-238,720-780,824-858` | `io1/conver.lisp:1217-1272`; TV specification menu contract | Normative TV-owned pointer normalization used by C303 host choice |
| Visible System 303 frame | session `d09-converse-20260718` | source-load initialization error | `TODO-RUNTIME-C303-VISIBLE` |

## Architecture, ownership, and CLIM boundary

```text
C46 listener or incoming Chaos request
    -> QSEND/SEND-MSG or SEND server
        -> Chaos stream
        -> TV POP-UP-TEXT-WINDOW + shared Y-OR-N-P

C303 listener / System-C / incoming Chaos request
    -> QSend compatibility layer or Converse request queue
        -> CONVERSE-FRAME (TV flavor + ZWEI-FRAME)
            -> sparse Converse comtab -> Standard ZWEI comtab
        -> Chaos SEND / NOTIFY services
```

System 46 owns the destination split, `SEND` contact, sender header, received string,
pop-up lifetime, and reply decision. It delegates text editing and yes/no parsing to
shared stream facilities. `[C46-SRC] [C46-SUB]`

System 303 Converse owns conversation records, structural diagrams, the local sparse
comtab, outgoing/incoming records, request queue, and receive-mode policy. ZWEI owns
ordinary editing, numeric-prefix construction, generic Help and Meta-X dispatch;
TV owns window selection, menus, notification presentation, and low-level pointer
routing; Chaos owns connection state and delivery. Mail submission invoked by
`Control-M` is an external adapter. `[C303-SRC] [C303-SUB]`

Neither profile is CLIM. The selected modules define TV flavors, a `ZWEI-FRAME`,
ZWEI comtabs, TV menus, and FQUERY choices; the system declarations and source spans
contain no CLIM application-frame, port, presentation type, command table, or
translator dependency. They also do not use the later Dynamic Windows presentation
framework. Therefore the application-owned presentation-translator denominator is
exactly zero for both profiles. This is a claim about the selected files, not every
later program called Converse. `[C46-SRC] [C303-SRC]`

## Semantic objects and invariants

### `C46-QSEND` objects

| Object | Required fields/state | Ownership and lifetime | Evidence |
| --- | --- | --- | --- |
| saved sends | extensible text string and fill pointer | global; append-only in the selected file; no cold reset or file writer there | `C46-SRC` |
| receiver pop-up | name `QSend`, height 400, save-bits, active/exposed state | lazily allocated and reused | `C46-SRC` |
| pop-up lock | `NIL` or owning process | one reply interaction at a time; cleared on normal completion and unwind | `C46-SRC` |
| outbound transaction | destination, person, host, optional body, connection, stream | one `SEND` connection | `C46-SRC` |
| inbound transaction | RFC recipient, remote first line, derived sender, body, start offset | server invocation | `C46-SRC` |

`SAVED-SENDS` MUST retain messages in arrival order because the receiver appends at
its active end. Mutation is incremental: the local heading, remote first line, and
each body prefix copied before a stream failure remain in the active string. There
is no transaction rollback or delimiter repair; because the two final returns are
appended only after successful copy and close, a mid-copy failure leaves an
unterminated partial tail that `PRINT-SENDS` exposes and the next receive extends.
The source gives no persistence promise across world save or cold boot.
`PRINT-SENDS` writes the entire active string and returns true. `[C46-SRC]`

### `C303-CONVERSE` objects

| Object | Required fields/state | Ownership and lifetime | Evidence |
| --- | --- | --- | --- |
| conversation | first/last line, peer `WHO`, node, active `To:` delimiter, header flag, append mode, `OLDMSGS` list | Converse frame; one exact peer string per ordinary conversation | `C303-SRC` |
| headerless composer | first element of `*CONVERSE-LIST*`, no peer header, initial `To: ` | frame initialization and regeneration | `C303-SRC` |
| message divider | `BLACK-LINE-DIAGRAM`, one-quarter current sheet line height | structural interval line; file rendering is hyphens | `C303-SRC` |
| conversation header | `CONVERSE-HEADER-DIAGRAM`, peer name and thick split line | structural interval line; file rendering names peer | `C303-SRC` |
| request queue | FIFO list of `(function . copied-arguments)` | Converse frame; mutation guarded only by interrupt inhibition | `C303-SRC` |
| saved sends | empty extensible string when first source-bound; `NIL` after the selected before-cold initializer; a new string after a receive | global compatibility history, newest received entry prepended | `C303-SRC`, `C303-SUB` |
| last sender | most recent accepted inbound sender | global; used as `REPLY`'s default destination; retained unchanged when the selected before-cold initializer runs | `C303-SRC` |
| receive policy | mode, append flag, beep count, extra hosts, wait flag, gag value | global user options | `C303-SRC` |
| TV notification history | newest-first `(time, message)` entries | global; inserted before display attempt; the selected TV before-cold initializer sets this list to NIL | `C303-SUB` |
| TV pending/deferred notifications | `(time, message, window-of-interest)` entries in two global lists | TV-owned delayed presentation state; Terminal-N detaches both; the TV before-cold initializer leaves both exact list identities untouched | `C303-SUB` |
| network duplicate register | NIL initially, then immediately previous nonduplicate NOTIFY text | global; duplicate suppression leaves it unchanged; no selected reset form found | `C303-SRC` |

The following invariants are normative for the strict source profile:

1. The first conversation is the headerless composer; ordinary conversations follow
   it in `*CONVERSE-LIST*`. `[C303-SRC]`
2. Each conversation's first line reaches its active `To:` delimiter, which reaches
   its last line; adjacent conversations share the expected line adjacency. The
   integrity predicates check those facts before structural commands. `[C303-SRC]`
3. `OLDMSGS` stores each recorded display string independently of visible unsent
   edits; regeneration can reconstruct recorded messages but cannot reconstruct
   unsent text. `[C303-SRC]`
4. A peer is grouped by case-insensitive `EQUALP` comparison of the exact canonical
   destination string returned by the parser. Multiple recipients are processed as
   separate peers and records. `[C303-SRC]`
5. Network processes MUST NOT directly edit the interval. They enqueue work; the
   frame's forced internal keyboard event, expose hook, or post-command hook drains
   it. `[C303-SRC]`
6. Compatibility saved-send history and per-conversation `OLDMSGS` are distinct.
   Updating the first does not prove that a delayed Converse request was drained.
   `[C303-SRC]`
7. TV notification history is distinct from both Converse histories. A display or
   careful-delivery failure does not roll back its already-pushed history entry.
   `[C303-SUB]`
8. The selected before-cold initializer does not assign the last-sender register.
   Invoking that operation MUST retain its exact prior value in strict mode. This is
   an operation-level guarantee only; it does not claim survival through every cold
   boot or world-loading mechanism. `[C303-SRC]`
9. The distinct TV before-cold initializer sets notification history to NIL but does
   not assign pending or deferred queues. Strict invocation MUST preserve exact
   sentinel identities in both queues; this does not assert their survival through
   every complete cold-boot mechanism. `[C303-SUB]`

The selected file registers four distinct operations. A cold-only action sets gag
state NIL. One before-cold action sets saved sends NIL and leaves last sender and
receive mode untouched. A separate before-cold action calls `FIND-CONVERSE-WINDOW`:
it chooses a Converse ancestor, finds an existing frame, or creates one; ensures the
frame process has a run reason; and then clears that frame's request queue. The
`:ONCE` action initializes the comtab, creates and activates a frame, and gives its
process a run reason. Strict mode MUST expose these independently and MUST NOT equate
`:ONCE` with every cold operation. Receive mode is untouched by all four.

On the first receive after the saved-sends `NIL` reset, selected `STRING-APPEND`
coerces the old symbol value to its name, so the new history ends in the literal
characters `NIL`. A fresh source load that first binds the variable to its empty
extensible string does not add that suffix unless the before-cold initializer runs.
It contains no automatic transcript writer and no equally explicit cold-reset form
for all conversation `OLDMSGS`; a reimplementation MUST NOT invent one under the
strict profile. That initializer also leaves the last-sender reply register
untouched; strict mode retains a sentinel value across this operation, while an
explicitly labelled correction may clear it. `[C303-SRC] [C303-SUB]`

The separately registered TV before-cold operation clears only retained notification
history. Pending and deferred queues remain untouched. A correction that clears all
three is permissible only as an explicitly reported option. `[C303-SUB]`

## Complete effective input and gesture trees

### Normative incorporation of D05 parent trees

For `C303-CONVERSE`, the complete effective clean-profile parent is incorporated,
not summarized, from these exact in-repository D05 sections:

- [System 303 standard ZWEI table](zwei-zmacs-keybindings.md#system-303-standard-zwei-table);
- [System 303 standard Control-X table](zwei-zmacs-keybindings.md#system-303-standard-control-x-table);
- [System 303 effective ingress and pointer overlays](zwei-zmacs-keybindings.md#system-303-effective-ingress-and-pointer-overlays); and
- [System 303 Help subtree](zwei-zmacs-keybindings.md#system-303-help-subtree).

Those mappings are normative here wherever the local sparse table falls through.
The local table's indirection points directly to `*STANDARD-COMTAB*`; its clean
editor closure selects Text mode. An implementation MUST compose the local cells
below over the incorporated parent, retain D05's alias restart and explicit
`:UNDEFINED` semantics, and attach reader context to TV interception. User/profile
mutations and later mode activation form a separate mutable-tree profile and MUST be
reported by a runtime dump rather than folded into this static denominator.

`Terminal` is a host-global TV asynchronous prefix above that D05 editor lookup, as
the incorporated [effective-ingress section](zwei-zmacs-keybindings.md#system-303-effective-ingress-and-pointer-overlays)
already establishes. Converse installs zero Terminal-prefix cells. The TV-owned
`Terminal N` leaf and notification windows are nevertheless enumerated below because
the selected C303 receive modes enqueue and display through that facility.

For the `C46-QSEND` rubout-handler editor path, the applicable parent is incorporated
from [the complete preserved System 46 Standard table](zwei-zmacs-keybindings.md#complete-preserved-system-46-standard-table)
and [System 46 Control-X and recursive contexts](zwei-zmacs-keybindings.md#complete-preserved-system-46-control-x-and-recursive-contexts).
Only the pass-through terminators below are application registrations.

### Deterministic denominators

| Context | Exact application-owned denominator |
| --- | --- |
| C46 body reader | 3 declared pass-through character literals; EOF is a fourth terminating input value; all other input is parent editing or literal append |
| C46 reply query | 8 accepted key spellings from shared `Y-OR-N-P`; invalid-input complement retries; 0 application pointer cells |
| C46 reply-error pause | 1 wildcard class: any next input dismisses the error pause |
| C303 main Converse table | 8 direct cells, of which 7 resolve to selected definitions and 1 shadows the parent with an undefined target |
| C303 Meta-X registry | 9 exact names |
| C303 local Help extension | 1 exact second-stage leaf, `Help M` |
| C303 system entry | 1 exact system key, `System C` |
| C303 main pointer/presentation surface | 0 application-owned pointer cells and 0 presentation translators; D05 parent pointer cells remain effective |
| C303 QSend body reader | 4 declared editing-command cells; fallback has 2 character terminators plus EOF, 1 conditional Return terminator, 1 transfer action, and 1 yank action |
| C303 simple-reply query | 9 literal choice registrations yielding 14 case-folded accepted key values, plus inherited `Help` and `Clear-Screen` control behavior and one invalid-input complement |
| C303 simple-reply pointer | 2 exact click cells; every other button has no locally defined effect |
| C303 host chooser with `N` candidates | `N` semantic rows; `3N` normalized single-primary row/button operations; `96N` row/button/modifier tuples over 3 buttons × 32 Shift/Control/Meta/Super/Hyper states; `224N` full raw tuples when all 7 nonzero simultaneous button-down masks are included; 0 local keyboard cells |
| C303 SHOUT/NOTIFY prompt | the C303 QSend body-reader tree, subject to the NOTIFY omitted-stream defect |
| C303 TV notification ingress | 1 TV-owned `Terminal N` leaf; 5 handler argument classes: `NIL`, `T`, integer `1`, integer `2`, and every other value; physical Terminal input can produce only `NIL` or an integer |
| C303 Terminal-N task window | 0 notification-specific key cells, 0 notification-specific pointer cells; 1 stream-delivered-character wildcard, selection loss, and new-pending restart |
| C303 fallback notification window | 0 local key cells; 1 `:ANY-TYI` wildcard plus forced `:DEEXPOSE`; exactly 1 local pointer cell, `Mouse-1-1` |

`T-BIND-DENOMINATORS` MUST reproduce every number and tuple above from the pinned
forms. Counts are source-cell counts unless the row explicitly says effective
case-folded values.

### `C46-QSEND` body-reader tree

```text
QSEND or SEND-MSG with no body
└─ SEND-MSG-GET-MESSAGE
   ├─ stream supports rubout handler and no handler is already active
   │  ├─ #/END       -> pass through -> finish body
   │  ├─ legacy Control-c literal -> pass through -> finish body
   │  ├─ legacy Control-C literal -> pass through -> finish body
   │  └─ every other editing input -> incorporated System 46 rubout editor
   └─ fallback character loop
      ├─ End, either encoded Control-c form, or EOF -> finish body
      └─ every other value -> append exactly that value
```

The source contains no local yank, edit-in-Converse, pointer, prefix, numeric, or
repeat binding in this prompt. `Abort` is not an application-owned leaf. A global
keyboard abort can still nonlocally leave the inherited stream interaction, but its
semantics belong to the TV/editor substrate. `[C46-SRC] [C46-SUB]`

### `C46-QSEND` incoming reply query

The receiver calls the selected System 46 `Y-OR-N-P`; these are effective inherited
keys, not registrations in `chsaux.113`:

| Exact input | Result | Further effect |
| --- | --- | --- |
| `Y`, `y`, `T`, `t`, `Space` | true | show `To:` and call `SEND-MSG` to the derived sender |
| `N`, `n`, `Rubout` | false | do not reply |
| every other input | no result | repeat the question and print the allowed choice hint |

If reply sending returns an error string, the receiver prints it and consumes one
arbitrary input value before continuing cleanup. There is no application pointer or
menu table. Programmatic `:MOUSE-SELECT` exposes/selects the pop-up; it is not a user
gesture binding. `[C46-SRC] [C46-SUB]`

### `C303-CONVERSE` main direct table

| Cell | Stored target | Strict source-profile result | Numeric/repeat behavior | Evidence |
| --- | --- | --- | --- | --- |
| `End` | `COM-CONVERSE-HANDLE-END` | send and stay when `*CONVERSE-END-EXITS*` is false; send and exit when true | numeric ignored; one invocation | `C303-SRC` |
| `Control-Z` | `COM-CONVERSE-SEND-WITH-EXIT` | **not implemented in the selected tree**: the stored target has no definition; do not fall through to parent `Quit` | numeric irrelevant because dispatch fails | `C303-SRC` |
| `Abort` | `COM-CONVERSE-ABORT` | deselect and maybe bury without sending | numeric ignored | `C303-SRC` |
| `Control-End` | `COM-CONVERSE-HANDLE-CONTROL-END` | send and exit when the option is false; send and stay when true | numeric ignored | `C303-SRC` |
| `Meta-{` | `COM-CONVERSE-PREVIOUS-CONVERSATION` | move to this or previous conversation's active `To:` position | numeric ignored; no source loop by count | `C303-SRC` |
| `Meta-}` | `COM-CONVERSE-NEXT-CONVERSATION` | move to this or next conversation's active `To:` position | numeric ignored; no source loop by count | `C303-SRC` |
| `Control-M` | `COM-CONVERSE-MAIL-MESSAGE` | remove and mail the current composer through the mail adapter | numeric ignored | `C303-SRC` |
| `Control-Meta-Y` | `COM-CONVERSE-YANK-LAST-MSG-TEXT` | insert the last received body; with no saved receive, pass `NIL` through the selected insert/string coercion and insert the literal symbol name `NIL` | numeric ignored | `C303-SRC`, `C303-SUB` |

The `Control-Z` spelling is not a typo in this page. `io1/conver.lisp` defines
`CONVERSE-SEND-WITH-EXIT` but stores the different symbol
`COM-CONVERSE-SEND-WITH-EXIT` in the comtab; a full-tree search found no definition
for the latter. Because the local nonempty cell shadows D05's parent `Control-Z`, the
strict result is the editor's distinct “not implemented” path, not inherited Quit
and not a guessed send. `TODO-RUNTIME-C303-CONTROL-Z` tests whether an unrecorded
resident alias changes the preserved world. `[C303-SRC] [C303-SUB]`

Every other direct input falls through to the incorporated D05 Standard/Text-mode
tree. An absent cell continues to the parent; an explicit undefined parent cell
stops; a final unbound input clears queued input and reports not-defined. A stored
symbol without a function binding, such as the strict `Control-Z` target, reports
not-implemented instead. `[C303-SUB]`

### `C303-CONVERSE` exact Meta-X registry

`Meta-X` itself is inherited from D05. The application adds exactly these nine
completion names:

| ID | Exact name | Ordered application effect | Failure/abort boundary |
| --- | --- | --- | --- |
| `CX-01` | `Regenerate Buffer` | save the old head conversation reference; reverse the remaining conversation list; delete the visible interval; create a fresh headerless composer; rebuild recorded conversations; move point to the first composer | unsent text is deleted before rebuild completes; a mid-rebuild error leaves partial reconstruction |
| `CX-02` | `Delete Conversation` | validate structure and locate owner at point; call destructive `DELQ`; delete that conversation's visible interval | for a non-head member, destructive splice removes it; for the head member, the ignored returned head leaves `*CONVERSE-LIST*` pointing at deleted lines and damages the invariant |
| `CX-03` | `Write Buffer` | read pathname; open output with reprompt policy; render the whole interval including diagram file strings | no mail state mutation; partial file output is possible after open |
| `CX-04` | `Write Conversation` | validate point; read pathname; output the source-selected interval from the line preceding the conversation first line to the start of its last line | invalid point aborts before open; first/headerless conversation edge remains a runtime oracle |
| `CX-05` | `Append Buffer` | read pathname; open output; try opening prior input; copy prior bytes when present; then render whole interval | not atomic; an input error occurs after output open and is reported through `BARF` |
| `CX-06` | `Append Conversation` | validate point; establish exact conversation boundary; open output; copy prior input; render selected boundary | validation precedes open; later failure can leave partial output |
| `CX-07` | `Disable Converse` | set gag state to true; report disabled | mutation precedes reporting |
| `CX-08` | `Enable Converse` | set gag state to `NIL`; report enabled | mutation precedes reporting |
| `CX-09` | `Gag Converse` | if numeric argument is an integer at least 2, disable; otherwise toggle using current gag truth | only command in this registry with application-specific numeric interpretation |

The registry contains no aliases, menu accelerators, or hidden tenth entry. Aborting
Meta-X completion before a name resolves is inherited D05 behavior and precedes an
application command. `[C303-SRC] [C303-SUB]`

### `C303-CONVERSE` Help tree

The editor closure prepends exactly one entry to the inherited Help dispatch alist:

```text
Help (also inherited C-Help and C-M-? dispatcher entries)
├─ M -> COM-CONVERSE-HELP
├─ C, D, A, U, V, W, conditional L, Space, Help, C-G, Rubout
│     -> exact incorporated D05 Help leaves
├─ ? -> inherited invalid-input path (beep and retry)
└─ every other input -> inherited invalid-input path (beep and retry)
```

The local Help operation displays the Converse explanation and returns to the editor
after any continuation input required by the ordinary typeout path. Its prose is not
normative where it conflicts with executable cells: it reverses the default `End`
and `Control-End` meanings and omits `Control-Z`. The handlers, mode-line strings,
and System 94 release note agree on `End`/`Control-End`; the `Control-Z` table target
is nevertheless unresolved as specified above. `[C303-SRC] [C303-MAN]`

### Main-editor pointer, prefixes, presentations, and menus

Converse installs no application mouse comtab and no local `Control-X` subtable.
Therefore:

- D05's Standard `Mouse-1-1`, `Mouse-1-2`, `Mouse-2-1`, and `Mouse-2-2` cells and
  pane-selection precedence remain effective in the main editor;
- `Control-X` and every reachable child are exactly the incorporated D05 Standard
  prefix tree, subject only to separately reported active modes;
- no Converse-specific `Control-X` leaf exists;
- no presentation translator, command-button gesture, right-click menu, or menu
  accelerator exists in the selected main-editor source; and
- an unrecognized local direct key follows D05 parent lookup rather than a separate
  Converse beep rule.

These are zero-count conclusions from the selected construction, not omissions.
`[C303-SRC] [C303-SUB]`

### `C303` QSend transient body reader

```text
QSEND/REPLY with destination but no body
└─ QSEND-GET-MESSAGE
   ├─ active stream offers :RUBOUT-HANDLER and no handler is already active
   │  ├─ End              -> return current body
   │  ├─ Control-Z        -> return current body
   │  ├─ Control-Meta-Y   -> request insertion of last received body
   │  ├─ Control-Meta-E   -> return current body plus transfer=true
   │  └─ other input      -> stream/rubout editor, including inherited Abort
   └─ fallback loop
      ├─ End, Control-Z, or EOF -> return body
      ├─ Return and END-WITH-RETURN-OK=true -> return body
      ├─ Control-Meta-Y -> append last body (or empty string) and force those bytes as input
      ├─ Control-Meta-E -> return body plus transfer=true
      └─ other input -> append exactly that input value
```

The selected current file does **not** register or test `Control-C`, although the
historical `system-98-26` patch file did. Strict `C303-CONVERSE` follows the selected
current file; a patch-resident world profile MUST disclose any restored `Control-C`
leaf. `Abort` is promised by the prompt/manual but is inherited from the active
stream/editor rather than listed as a local editing-command cell. `[C303-SRC]
[C303-SUB] [C303-MAN]`

If transfer is false, QSend sends. If true, it sets the exposure-wait flag, enqueues
an edit-and-send request, waits until the frame is exposed, waits for window
exposure, and then clears the flag. The transferred text is inserted into only the
first parsed recipient's composer; this edit path does not initialize one composer
per listed destination despite the function's broader docstring. `[C303-SRC]`

### `C303` simple-reply pop-up tree

The application registers nine literal FQUERY choice inputs. FQUERY compares
characters with `CHAR-EQUAL`, so five letters also accept their opposite case:

| Effective input values | Result | Ordered effect |
| --- | --- | --- |
| `Y/y`, `R/r`, `T/t`, `Space`, `Hand-Up` | Reply | invoke `REPLY` with the captured sender, interactive delivery, and `WAIT-P=NIL` |
| `N/n`, `Rubout`, `Hand-Down` | Nothing | no send; proceed to cleanup |
| `C/c` | Enter Converse | deactivate pop-up, then select frame |
| `Help` | inherited FQUERY control | list the first key and echo label for each choice, then reread |
| `Clear-Screen` | inherited FQUERY control | clear when supported, then reread |
| every other input | invalid complement | beep, clear pending input, move to fresh line, list choices, and retry |

The pointer method adds exactly:

| Gesture | Effect |
| --- | --- |
| `Mouse-1-1` | start a `Select Converse` process that deactivates the pop-up and selects the frame |
| `Mouse-2-1` | start a `Kill Reply Window` process that deactivates the pop-up |
| every other button/chord | no locally defined effect; the method returns `NIL` and does not explicitly call a parent method |

The who-line text's `L:` and `M:` are labels for left and middle pointer choices,
not keyboard letters. There is no keyboard `L` or `M` choice in the FQUERY table.
The pop-up is a TV window, not a CLIM dialog. `[C303-SRC] [C303-SUB]`

### Ambiguous-host chooser

For a bare user with more than one discovered host, Converse creates one dynamic
menu item per candidate, labeled `USER@official-host-name` and valued by that host.
A single host bypasses the menu; no host reports a Converse problem. The application
owns item construction and consumes the selected value; TV's `MOMENTARY-MENU` owns
the interaction. It installs no local keyboard reader or comtab, hence has zero
menu-local Help, prefix, numeric, repeat, and unbound-key leaves. Global TV
asynchronous keys remain global rather than falling through a chooser keymap.

For a fixture containing `N` candidates, the selected pointer tree is:

```text
pointer over current selectable row i
└─ :MOUSE-BUTTONS(BD), for any nonzero three-button down mask
   ├─ item is not a :BUTTONS item -> ignore BD completely
   ├─ chosen-item := row i; last-item := row i
   ├─ deactivate momentary menu before execution
   └─ execute (label . host) -> return host

pointer over blank interior
└─ no current item -> no choice

pointer leaves hysteretic menu / menu deactivates without a choice
└─ execute NIL -> abort the choice transaction -> return NIL
```

The current-row branch does **not** call `MOUSE-BUTTON-ENCODE`. Left, Middle, and
Right therefore select the same row; held Shift, Control, Meta, Super, and Hyper
states are never merged into a button character, and Shift does not become a double
click on this path. Simultaneous newly-down masks also select because the normal-item
branch tests only that a current item exists and ignores `BD` after dispatch.

Accordingly the exact denominators are:

- `N` semantic returned host values;
- `3N` normalized single-primary row/button operations;
- `96N` single-primary raw state tuples: `N × 3 × 32` combinations of the five
  Shift/Control/Meta/Super/Hyper state bits; and
- `224N` full raw physical tuples when the four additional nonzero multi-button
  masks are included: `N × 7 × 32`.

Every tuple in the latter two sets maps to its row's same host value. These are
TV-owned effective gestures, not Converse-owned cells, but they are normative for
the selected chooser. Strict source cancellation returns `NIL`; parsing then emits
the `<undetermined-host>` destination plus a `NIL` host, so the caller follows its
ordinary no-host failure/omission path. `TODO-RUNTIME-C303-HOST-CANCEL` is retained
only to detect a resident-world divergence. `[C303-SRC] [C303-SUB]`

### SHOUT and NOTIFY prompt surfaces

`SHOUT` supplies `*QUERY-IO*` to the C303 QSend reader and therefore reaches its
exact transient tree. It has no optional message parameter in the selected function,
despite the manual signature. `NOTIFY` and `NOTIFY-ALL-LMS` have no input surface
when a message argument is supplied. If omitted, their default form calls
`NOTIFY-GET-MESSAGE`, whose selected body passes its default `NIL` `STREAM` as an
explicit first argument to `QSEND-GET-MESSAGE`; the callee's `*STANDARD-INPUT*`
default is therefore bypassed. Strict source behavior is a stream-operation failure
before the documented prompt unless an unverified runtime definition repairs it.
`TODO-RUNTIME-C303-NOTIFY-PROMPT` distinguishes those outcomes. `[C303-SRC]
[C303-MAN]`

### `C303` TV notification ingress and dismissal trees

Converse owns no cell in this surface. In hidden `:NOTIFY` and
`:NOTIFY-WITH-MESSAGE` modes it calls `TV:NOTIFY` with the Converse frame as the
window of interest, thereby entering this exact TV-owned tree:

```text
global Terminal prefix
├─ zero or more decimal digits and optional `-` characters -> accumulate signed ARG
└─ N (case folded to uppercase) -> KBD-ESC-NOTIFICATIONS(ARG), with :TYPEAHEAD
   ├─ ARG = NIL -> detach pending+deferred; always open task window
   ├─ ARG = T   -> detach; open only when detached list is nonempty
   │               (programmatic handler class; physical parser cannot make T)
   ├─ ARG = 1   -> detach; open and include retained old history
   ├─ ARG = 2   -> detach; move detached list to deferred; do not open
   └─ any other integer/value -> detach and neither display nor requeue
```

The physical prefix parser passes `NIL` when no digits or minus were entered. Digits
are decimal; a minus makes the accumulated number negative, defaulting to `-1` when
there were no digits. It uppercases the final command character, so `n` and `N`
reach the same single leaf. `Terminal Help` and `Terminal ?` show global Terminal
help, not notification-window Help. An unknown final Terminal key follows TV's
global quote-or-beep rule; it never falls through to the Converse or D05 comtab.
`[C303-SUB]`

The `T` handler class has another prose/source disagreement. Its docstring says
pending notifications only, but once a nonempty pending set opens the window, the
shared `WHEN ARG` branch also prints every retained history entry left after the
detached entries are skipped. Strict `TV-NOTIFY-C303` preserves that extra old-history
section for `T`, just as it does for integer `1`. `[C303-SUB]`

The Terminal-N task window detaches `pending ++ deferred` atomically and clears both
globals before branching. When displayed, each iteration first puts newly pending
items before its current list, clears pending, redraws newest first, and prompts
`Type a space to flush`. The executable input loop is broader than that prompt:

```text
Terminal-N task window (POP-UP-FINGER-WINDOW)
├─ a new pending notification -> redraw/restart; do not yet dismiss
├─ selected window changes -> return and deactivate
├─ any ordinary character reaching :TYI-NO-HANG
│  ├─ Space -> consume one value; return and deactivate
│  ├─ Help or any other nonintercepted character -> identical dismissal
│  └─ no command lookup, unbound-key error, prefix, numeric, or repeat behavior
└─ Abort/Meta-Abort/Break/Meta-Break -> standard TV stream intercept, not a local leaf
```

Only one queued character is consumed on the dismissal path. If new pending work is
observed first, the loop redraws; a still-queued character can dismiss the next
iteration. This window defines zero notification-specific pointer methods, so
pointer behavior belongs to its generic temporary-window substrate and is not
invented as a notification binding. The prompt's claim that Space flushes is thus
help text, not an exclusivity rule. `[C303-SUB]`

When the global wait-for-notifications flag is false, or a selected notification
stream cannot fit the message, TV uses the separate fallback window:

```text
fallback POP-UP-NOTIFICATION-WINDOW
├─ before input -> beep; select blank window; wait until the 180-tick protection
│                  interval; move preexisting typeahead back to the old window;
│                  clear this window's input; print its prompt
├─ any ordinary value returned by :ANY-TYI, including Space or Help
│                  -> finish the wait and deactivate
├─ forced :DEEXPOSE input -> wake the wait; deactivate
├─ Mouse-1-1 -> MOUSE-SELECT self -> deexpose; if non-NIL, mouse-select the
│                  recorded window of interest
├─ every other pointer button/chord -> local :MOUSE-CLICK returns NIL
└─ Abort/Meta-Abort/Break/Meta-Break -> standard TV stream intercept, not local Help
```

The fallback window has no local Help replacement, no unbound-key state, no local
prefix, and no numeric/repeat interpretation. Under the standard stream output
function, Abort is intercepted before `:ANY-TYI`; the selected code has no local
abort cleanup clause, so post-abort exposure/resource state remains
`TODO-RUNTIME-C303-NOTIFY-ABORT`. Deexposure forces the synthetic value solely to
wake the waiting process. `[C303-SUB]`

## Entry, construction, selection, and process lifecycle

### System 46

| Entry/phase | Required order | Failure boundary |
| --- | --- | --- |
| `QSEND` macro | quote destination and optional message; expand to `SEND-MSG` | arguments are not ordinarily evaluated; malformed designators reach `SEND-MSG` parsing |
| `SEND-MSG` | split destination; force login; read body if absent; connect; write header; write body; emit EOF; close | connect error string returns before stream writes; a later stream failure has no rollback |
| inbound `SEND` server | listen; inspect state; non-RFC skips accept/read/history/UI/reply and attempts one registry removal; accepted RFC appends heading/first line/body, closes, appends separator, allocates/beeps/locks/selects/displays, removes, queries reply, releases lock, deselects/deactivates | LISTEN/state failure precedes ordinary removal; mid-copy failure leaves an open, registered connection and an unterminated partial history tail; close and removal are distinct; reply failure occurs after removal; unwind guarantees only owned-lock release |
| `PRINT-SENDS` | write the complete string; return true | output may be partial; history unchanged |

The server registration is named `SEND` and starts `POP-UP-RECEIVE-SEND-MSG` through
the Chaos server alist. The pop-up is allocated on first accepted message and reused.
`[C46-SRC]`

### System 303

Source construction proceeds as follows:

1. `INIT-CONVERSE-COMTAB` creates the sparse table and installs direct indirection to
   Standard ZWEI.
2. one-time `START-CONVERSE` initialization creates an active `CONVERSE-FRAME` and
   gives its process a run reason;
3. frame initialization creates/selects one `ZWEI-WINDOW-PANE`, inserts the initial
   return, constructs the headerless composer, and moves point after `To: `;
4. the frame process loops forever calling its editor;
5. `System C` is registered for `CONVERSE-FRAME`; and
6. `CONVERSE` is declared as a separately compile/loadable system and an
   `OUTER-SYSTEM` component after ZWEI and ZMail. `[C303-SRC] [C303-SUB]`

These frame properties are normative source state even though visible pixels remain
blocked by `TODO-RUNTIME-C303-VISIBLE`:

| Property | Exact `C303-CONVERSE` requirement |
| --- | --- |
| frame composition | Converse editor state, `ZWEI-FRAME`, then TV process and select mixins |
| process | `CONVERSE-WINDOW-TOP-LEVEL`, special PDL size octal `4000`, regular PDL size decimal `4000`, infinite edit loop |
| saved display | `:SAVE-BITS T` |
| mode line | `Converse `; conditional `[Disabled] `; parenthesized mode-name list; then exactly one of `   End sends and exits, Abort just exits, Control-End just sends` or `   End just sends, Abort just exits, Control-End sends and exits` |
| editor closure | Converse comtab, Text major mode, Converse post-command hook, and local Meta-M Help documentation entry |
| pane | exactly one exposed and selected `ZWEI-WINDOW-PANE` named `Converse`; base tick set at initialization |
| initial interval | insert one return with batch undo save, create exactly one headerless `To:` composer, move point to the end of the first line |
| exposure | when not already exposed, force `INITIALIZE-FOR-USER` through the frame keyboard path before exposure |

The source-visible entry paths are:

| Entry | Effect |
| --- | --- |
| `System C` | select/create the Converse frame through TV's system-key mechanism |
| `(QSEND)` | find/create and select the frame |
| `(QSEND destination)` | read a transient body, then send or transfer to Converse |
| `(QSEND destination message [mail-p [wait-p]])` | send/mail without body input |
| `(REPLY [message [destination [mail-p [wait-p]]]])` | use the last sender by default, then delegate to QSend; if that sender is `NIL` and no destination is supplied, select Converse without reading or sending a body |
| incoming simple reply `C/c` or left click | select Converse after deactivating pop-up |
| programmatic `FIND-CONVERSE-WINDOW` | find selected/screen-resident frame or make one; ensure process run reason |

The manual and global symbol declaration mention `QREPLY` as a synonym for `REPLY`,
but no defining or alias form was found in the selected current source files. It is
not part of strict source-level callable closure until `TODO-RUNTIME-C303-QREPLY`
finds a resident definition or another pinned defining artifact. `[C303-MAN]
[C303-SRC]`

### Request serialization

`ENTER-REQUEST` copies arguments, appends a request under interrupt inhibition, and
forces internal keyboard input `(:EXECUTE CONVERSE-EXECUTE-QUEUE)`. A delayed request
does the same append without waking the frame. Exposure forces a queue execution if
anything is pending; the post-command hook also drains the queue at priority 64.
The executor applies each request and removes it from the live queue only after its
function returns. Therefore a failing request remains queued, and later requests may
remain behind it; there is no rollback or per-request condition handler in this
method. `[C303-SRC]`

The executor's `DOLIST` begins at the live FIFO head, and enqueue extends the same
list tail with destructive `NCONC`. A request appended during a successful handler
is therefore reachable in the same traversal. For initial `[A,B]`, if A enqueues C,
strict execution is A, B, C in one drain. Snapshotting the initial length and
deferring C is not source-compatible. `[C303-SRC]`

Incoming hidden-mode `:SIMPLE`, `:POP-UP`, `:NOTIFY`, and
`:NOTIFY-WITH-MESSAGE` work is delayed. Compatibility history and last-sender state
change immediately, but the conversation interval changes only when a later wake or
exposure drains the queue. `:AUTO` or already-exposed work uses the waking path.
`[C303-SRC]`

## Direct-message protocol and ordered effects

### `C46-QSEND` outbound transaction

1. If a nonnumeric destination contains `@`, split at the last at-sign, uppercase the
   person component, and use the suffix as host. Otherwise use person `anyone` and the
   destination as host.
2. Force a user login.
3. If body is `NIL`, run the C46 body reader.
4. connect to Chaos contact `SEND <person>`.
5. If connection returns an error string, return it without stream output.
6. Write one sender/time header, then body bytes, then stream EOF; close with an empty
   reason and return `NIL`. `[C46-SRC]`

The transaction does not record outbound messages in `SAVED-SENDS` and is not
atomic after connection opens.

### `C46-QSEND` inbound transaction

1. Record the current saved-string end as the display start.
2. Listen for `SEND`. If state is not `RFC-RECEIVED-STATE`, skip every RFC/history/
   close/UI/reply operation, attempt `REMOVE-CONN` exactly once, and normally return
   NIL. If an RFC is present, derive recipient from contact suffix or
   use `anyone`, append a local display heading, accept, and read the remote first
   line into `SAVED-SENDS`.
3. Derive sender user from text before `@`, from text after `from `, or from the empty
   string; append the connected host name.
4. Copy remaining stream bytes incrementally into `SAVED-SENDS`.
5. After the copy reaches EOF successfully, close the connection and append two
   returns.
6. Lazily allocate the window; beep `SEND-BELLCOUNT` times **before** acquiring the
   pop-up lock.
7. Acquire the global lock. A waiter may notify the current screen once before
   sleeping.
8. Select the pop-up, clear it only if newly exposed, and show this message's slice.
9. Remove the already closed Chaos connection.
10. Run the inherited reply query; an affirmative answer calls `SEND-MSG` back to the
   captured sender.
11. Clear the lock, allow scheduling, then deselect/deactivate only if no successor
   already acquired the lock. `[C46-SRC]`

The local heading and remote first line are already committed before body copy, and
the stream copier mutates the same string as bytes arrive. A failure during that copy
therefore leaves the connection open and registered, preserves the copied prefix
without the final two-return separator, performs no window allocation or beep, and
does not roll back history. A later `PRINT-SENDS` exposes that partial tail, and a
later receive appends directly after it. `[C46-SRC]`

After successful copy, `CLOSE` and the two-return history terminator occur before
window allocation, beeping, locking, selection, and display, but `REMOVE-CONN`
occurs only after the slice's `:STRING-OUT` returns and immediately before the reply
query. Thus a failure after close but before completed display leaves a complete,
terminated history record and a closed but registered connection; a query or reply
failure observes it already removed. The unwind clause clears the lock if the
current process still owns it, but does not close or remove the connection and never
rolls back history. `[C46-SRC]`

A LISTEN or state-access/comparison failure exits before ordinary `REMOVE-CONN`.
The unwind clause still performs only conditional owner-lock release; it does not
close or remove the connection. `[C46-SRC]`

### `C303-CONVERSE` destination and send transaction

Comma parsing trims each field and preserves order. An explicit `user@host` uses the
first at-sign in `PARSE-SINGLE-DEST`, parses the host, and returns the official
address form. A bare user searches logged-in Lisp Machines plus configured extra
hosts; no match yields `<undetermined-host>`, one match selects directly, and several
invoke the chooser. `[C303-SRC]`

The editor send path MUST preserve this order:

1. validate the whole structural buffer and locate the conversation at point;
2. require the selected text to begin with `To:` and contain a nonblank body;
3. parse every comma field far enough to reject a nonexistent explicit host;
4. **restore/clear the composer before attempting any delivery**;
5. for each recipient in order, resolve the bare user, send or mail if a host exists,
   and append one success/failure record to that recipient's conversation;
6. move point to the resulting conversation's active composer for an in-frame send;
7. return true only if no recipient set the sticky aggregate loss flag. `[C303-SRC]`

Thus validation failures preserve the draft, but a connection failure occurs after
the unsent draft has been removed. Its text survives only in the inserted failed-send
record. Earlier recipient records remain after a later failure; there is no group
rollback. For interactive delivery, each `SEND-MSG` result replaces the current
recipient's failure reason. In mail mode, a prior no-host failure reason is not
cleared before a later mail call, so a later mailed recipient can be recorded with
the stale failure reason. Strict compatibility preserves this ordering defect.
`[C303-SRC]`

The in-frame loop attempts and records recipients in comma-input order. Each newly
created peer block is inserted immediately after the headerless composer, however,
so several all-new peer blocks finish in reverse creation order even though their
network attempts occurred in input order. Existing peer blocks are not reordered.
`[C303-SRC]`

`End` staying in Converse ignores the boolean send result. The exit variants bury
only after an all-success result. `Control-M` uses the mail adapter but otherwise
shares draft clearing and per-recipient recording. `[C303-SRC]`

### `C303` out-of-frame QSend ordering

`QSEND-FORCE-MESSAGE` parses candidates in comma-input order but `PUSH`es each
resolved recipient, producing a reversed work list. `QSEND-FORCE-MESSAGE-1` therefore
attempts valid recipients and appends their delayed record requests in reverse input
order. It also `PUSH`es each success, so its synchronous returned success list is
back in the successful recipients' original relative input order. The request queue
is FIFO. If all peer blocks are new, draining reverse-ordered record requests through
front-inserting `SETUP-CONVERSATION` happens to restore their original block order;
that does not change the reverse wire-attempt order. `[C303-SRC]`

### `C303` raw `SEND-MSG`

Raw `SEND-MSG` accepts one destination only. An integer in the selected Chaos address
range is converted to a Chaos host. A string is split at the **last** at-sign; person
case is preserved for Unix and Multics host types and uppercased otherwise. Without
an at-sign, the person is `anyone`. It opens `SEND <person>`, writes
`user@local-host` plus date/time, writes the body, closes, and returns `NIL`; an open
error object is returned unchanged. It warns when this machine has locally gagged
incoming messages but still attempts the outbound send. It does not create a
Converse record by itself. `[C303-SRC]`

### `C303` receive transaction and policy

The server listens on `SEND`, rejects a connection classified as Symbolics by the
selected compatibility predicate, and otherwise rejects while gagged. A string gag
value is the rejection text; true synthesizes a user-not-accepting message. If
accepted, it derives requested recipient from the RFC, reads the first line, derives
sender user, resolves the remote Chaos host or formats its numeric address, and
builds the display record. It includes a `To:` line only when the request recipient
differs from the logged-in user. A caught connection drop appends an explicit trouble
marker to the partial body. `[C303-SRC]`

`CONVERSE-RECEIVE-FROM-NETWORK` then:

1. prepends the record and two newlines to compatibility saved sends, coercing an
   old `NIL` value to the literal suffix `NIL`;
2. replaces last sender;
3. finds/creates the frame and samples its exposed state;
4. for hidden simple/notify modes, beeps, queues delayed insertion, and opens the
   pop-up or calls `TV:NOTIFY`;
5. otherwise queues waking insertion; and
6. insertion finds/creates the peer conversation, pushes `OLDMSGS`, adds the visible
   record according to append mode, moves point when appropriate, and redisplays.
   `[C303-SRC]`

Receive modes are `:AUTO`, `:NOTIFY`, `:NOTIFY-WITH-MESSAGE`, and `:SIMPLE`; the body
also accepts undocumented alias `:POP-UP`. In `:NOTIFY-WITH-MESSAGE`, the selected
format has one substitution labeled as the sender but supplies the trimmed message
body instead. The strict profile therefore preserves the misleading notification.
`[C303-SRC] [C303-MAN]`

## History, regeneration, deletion, and export

| Operation | `C46-QSEND` | `C303-CONVERSE` |
| --- | --- | --- |
| receive-history insertion | append incrementally; oldest first; failed body copy retains an unterminated heading/first-line/body prefix | prepend compatibility text; newest first; first post-reset entry has trailing `NIL` |
| per-peer records | none | push display record on `OLDMSGS` and render it |
| outgoing records | none | QSend/Converse records success or failure; raw `SEND-MSG` does not |
| last-sender state | derived only inside current pop-up | global last sender replaced on accepted receive |
| automatic file persistence | none found | none found |
| explicit export | `PRINT-SENDS` only to caller stream | `PRINT-SENDS`, Write/Append Buffer, Write/Append Conversation |
| initialization behavior explicitly visible | no reset in selected file | cold clears gag only; saved-send before-cold stores `NIL` and retains last sender; queue before-cold finds/creates frame, ensures run reason, then clears; `:ONCE` constructs; receive mode remains |

Immediately after the selected before-cold reset and before any receive,
`PRINT-SENDS` sends `NIL` as the argument to the output stream's `:STRING-OUT`
operation. This audit did not close the receiving stream method's treatment of that
non-string value; `TODO-RUNTIME-C303-PRINT-NIL` therefore controls whether the
preserved world signals, coerces, or accepts it. After a receive, the value is a
string and the source-level export order above is closed. `[C303-SRC]`

Regeneration destroys the interval before reconstructing it from `OLDMSGS`. The old
headerless conversation reference is saved in `*BUFFER-MUNGED-SAVED-CONVERSATION*`,
and `REGEN-FIRST-CONVER` can later turn that object into an ordinary reconstructed
conversation, but the command does not automatically restore its unsent text.
`[C303-SRC]`

Deleting an ordinary non-head conversation destructively splices it from the list,
then deletes its interval. Deleting the headerless head exposes a source bug: the
return of `DELQ` is ignored, so the global list still points to the deleted head.
Strict `C303-CONVERSE` preserves the resulting damaged state; `C303-SAFE` may reject
head deletion before mutation. `[C303-SRC]`

## SHOUT contract

Strict `C303-CONVERSE` implements the selected zero-argument `CHAOS:SHOUT` body, not
the manual's optional-message signature:

1. force login;
2. read one message with the QSend transient reader;
3. construct body from a fixed everybody prefix, the typed message, local `PERSON`,
   and `anyone`;
4. iterate every entry in `SI:MACHINE-LOCATION-ALIST` in order;
5. open one `SEND <person>` output connection; silently skip error streams; otherwise
   write sender/time, body, and close. `[C303-SRC] [C303-MAN]`

The local `PERSON` is never assigned. The selected `STRING-APPEND` coerces symbols by
their names, so `NIL` contributes `NIL`: the body ends in `NILanyone`, while the
contact becomes `SEND NIL`. This is actual selected-source behavior, not corrected
to the docstring's apparent intention. SHOUT creates no shared conversation, sender
history, or aggregate result. `TODO-RUNTIME-C303-SHOUT` checks whether a resident
patch replaces this definition. `[C303-SRC] [C303-SUB]`

## NOTIFY contract

### Receiver

The NOTIFY server reads the request text after the seven-character contact prefix
and compares it with one global `LAST-NOTIFICATION` string using `STRING-EQUAL`. If
case-insensitively different, it stores the string, resolves the remote host, and
calls `TV:NOTIFY`; if equal under that comparison, it suppresses the presentation
and returns the duplicate string storage. Both branches answer `Done`. The guard
compares only the immediately previous message text: it has no host or time field.
Consequently consecutive `A` then `a` requests are duplicates even across different
hosts, while `A`, `B`, `A` presents all three. The register begins NIL and changes
only for a nonduplicate; suppression leaves it unchanged. No selected initializer
resets it, so a reset extension MUST be labelled rather than folded into strict
source behavior. `[C303-SRC]`

### One host

With an explicit message, `CHAOS:NOTIFY` calls the simple request protocol using
`NOTIFY <message>`. A string response is returned directly; a packet response is
copied to a new string and the packet returned to its pool. There is no Converse
record. `[C303-SRC]`

### All Lisp Machines

With an explicit message, `NOTIFY-ALL-LMS` assures Chaos is enabled, opens one
connection per parseable location-alist host, waits at most 300 ticks (five seconds)
for every connection to leave RFC-sent state, then prints each host with its answer,
timeout, or unexpected state. Host traversal and connection opening follow
`SI:MACHINE-LOCATION-ALIST` order, but each returned connection is `PUSH`ed onto
`CONNS`. Waiting, reporting, and unwind cleanup therefore traverse the parseable
connections in the reverse of source-host order. A host for which `ADDRESS-PARSE`
returns `NIL` creates no connection, report row, or cleanup call. If reporting
signals partway through, already printed reverse-order rows remain and unwind cleanup
still removes every collected connection in that same reverse order. `[C303-SRC]`

The omitted-message source path is defective as specified in the prompt-surface
section. A safety-corrected implementation may default `NOTIFY-GET-MESSAGE`'s stream
to `*STANDARD-INPUT*`, but MUST expose that it is not strict `C303-CONVERSE`.

## Failure and recovery matrix

| Operation/state | First committed effect | Later failure result | Recovery |
| --- | --- | --- | --- |
| C46 outbound connect | none | return error string | retry caller-controlled |
| C46 body stream after connect | remote bytes may exist | partial delivery; no local rollback | close/unwind behavior delegated to Chaos stream |
| C46 inbound heading/body copy | heading, remote first line, and copied body prefix are appended as reached | copy failure leaves no final returns; connection remains open and registered; no UI phase is entered | no local history rollback, close, remove, or delimiter repair; cleanup is external |
| C46 inbound non-RFC/listen-state | connection returned but no RFC effect | non-RFC attempts one removal and normally returns NIL; LISTEN/state failure occurs before removal | owner-lock unwind only; no inferred close/remove on early failure |
| C46 inbound after close but before completed slice display | connection closed and terminated history committed | `REMOVE-CONN` not reached; connection remains registered; display may be absent or partial | owner-lock unwind only if acquired; explicit connection cleanup is external |
| C46 inbound query/reply | connection closed, history displayed, and connection removed | query or outbound-reply failure leaves history | owner-lock unwind; next server invocation continues |
| C303 editor validation | none | `CONVERSE-BARF` reports and throws to command loop | edit draft remains before composer restore |
| C303 recipient send | composer already cleared; earlier records may exist | append failure record and keep aggregate failure | stay in editor; resend requires copying record text |
| C303 send-and-exit partial failure | same | frame remains selected because send result false | user may edit a new draft |
| C303 delayed request function errors | prior immediate compatibility history remains; request remains at queue head | later requests can remain blocked | explicit salvage/queue clear or corrected handler |
| C303 Regenerate Buffer | old interval deleted | partial rebuilt interval/list | `SALVAGE-CONVERSE`; optional saved-first reconstruction |
| C303 Delete head | interval deleted, list head stale | structural invariant broken | strict profile requires regeneration/salvage; safe profile forbids |
| C303 append export | output stream already open | partial/new file state possible | filesystem version/retry policy; no application rollback |
| SHOUT host failure | prior hosts may have received malformed send | silently skip failed stream | none; no aggregate report |
| NOTIFY one-host request | network request issued | return error/response as simple protocol provides | caller retries |
| NOTIFY all-host timeout/report error | some parseable hosts may have answered | print and remove collected connections in reverse source-host order; unparseable hosts remain absent | cleanup always walks the collected reverse-order list; caller may retry selected hosts |
| TV Terminal-N unsupported argument | pending and deferred queues already detached and cleared | no display and no requeue; detached list becomes unreachable on return | strict profile preserves destructive branch; caller uses only documented classes |
| TV fallback notification Abort | history already committed; popup may be selected | standard stream intercept signals outside the local wait | cleanup state is the named runtime oracle |

## Safety-corrected options

`C303-SAFE` MAY select these independent, reported corrections:

| Option | Corrected behavior | Required strict-profile distinction |
| --- | --- | --- |
| `control-z-target` | bind `Control-Z` to the defined send-with-exit operation | tree dump identifies corrected target |
| `protect-head-delete` | reject deletion of the headerless composer before mutation | test strict damage versus safe rejection |
| `notify-default-stream` | omit the stream argument or supply `*STANDARD-INPUT*` | omitted-message prompt succeeds only in safe profile |
| `shout-person` | set person to `anyone` and do not append the stray local | wire contact/body fixture differs from strict |
| `mail-reason-reset` | clear per-recipient reason before each mail attempt | mixed invalid/valid recipient record differs |
| `last-sender-reset` | clear the last-sender register in the before-cold initializer | strict invocation retains the exact prior sentinel value |
| `tv-before-cold-queues` | clear pending/deferred together with notification history | strict TV initializer retains both queue identities while clearing history |
| `notify-duplicate-reset` | reset the immediately-previous-text register | strict selected source provides no such reset |
| `initialization-phase-combine` | combine cold, both before-cold, and `:ONCE` mutations | strict phase calls and frame/run-reason side effects remain independently observable |
| `queue-error-pop` | remove or quarantine a failing request and continue | strict queue retains failing head |

These are reconstruction policies, not claims about an uninspected historical patch.

## Reference semantic operation inventory

| Operation | Inputs | Result/effect | Failure result | Evidence |
| --- | --- | --- | --- | --- |
| send one direct message | destination, body | one Chaos `SEND` transaction | error string/object or partial stream | `C46-SRC`, `C303-SRC` |
| receive one direct message | RFC, header, body | history plus pop-up or queued conversation | reject, partial trouble marker, or queued failure | same |
| select Converse | no peer required | select/create frame | construction/load error | `C303-SRC`, `C303-RUN` |
| send editor draft | composer text | per-recipient records; optional exit | cleared draft and partial records | `C303-SRC` |
| mail editor draft | composer text | mail adapter plus records | signaled adapter error or stale reason defect | `C303-SRC` |
| export history | interval/pathname | rendered file/stream | partial output | `C303-SRC` |
| broadcast direct send | typed body | one malformed strict-profile send attempt per location entry | silent per-host skip | `C303-SRC` |
| notify host(s) | host set, short text | TV notification at receiver, textual sender results | timeout/error/duplicate suppression | `C303-SRC` |

This is a semantic protocol inventory, not a promise that old client source compiles
unchanged.

## Selected callable surface and source-compatibility boundary

| Profile | Package/name | Kind and selected signature | Source-profile result | Closure status |
| --- | --- | --- | --- | --- |
| C46 | `QSEND` | macro `(destination &optional message)` | quotes both operands and calls `SEND-MSG` | exact selected form |
| C46 | `SEND-MSG` | function `(destination &optional msg)` | `NIL` success or connection error string | exact selected form |
| C46 | `PRINT-SENDS` | function `(&optional stream)` | writes full received string, true | exact selected form |
| C303 | `ZWEI:QSEND` / global `QSEND` | function `(&optional destination message (mail-p nil) (wait-p *converse-wait-p*))` | frame selection, transient edit, sync result list, or async `NIL` | exact selected form |
| C303 | `ZWEI:REPLY` / global `REPLY` | function `(&optional message (destination *last-converse-sender*) mail-p (wait-p *converse-wait-p*))` | QSend delegation | exact selected form |
| C303 | `QREPLY` | documented/global symbol | claimed REPLY synonym | defining form not found; reserved |
| C303 | `QSENDS-OFF` | function `(&optional (gag-message t))` | replace gag state | exact selected form |
| C303 | `QSENDS-ON` | function `()` | clear gag state | exact selected form |
| C303 | `SEND-MSG` | function `(destination message)` | `NIL` success or error object | exact selected form |
| C303 | `PRINT-SENDS` | function `(&optional stream)` | write compatibility history | exact selected form |
| C303 | `CHAOS:SHOUT` | function `()` | malformed strict-profile fan-out | manual signature differs |
| C303 | `CHAOS:NOTIFY` | function `(host &optional message)` | simple-protocol result | explicit-message path closed |
| C303 | `CHAOS:NOTIFY-ALL-LMS` | function `(&optional message)` | per-host printed results | explicit-message path closed |

No general historical-source compatibility claim is made. Exact exported-package
resolution, all conditions/restarts, patch-resident aliases, and every downstream
mail/network signature are not closed by this bounded module audit.

## Conformance test suite

Every test records profile, source revision, parent-tree revision, initial state,
logical inputs, application trace, final state, and cleanup. Peer tests use only an
isolated disposable Chaos site.

| ID | Profile/level | Setup and action | Objective pass condition |
| --- | --- | --- | --- |
| `T-BIND-DENOMINATORS` | both/L1 | parse selected construction forms and compare every context row above | exact counts, names, cells, and zero-count surfaces match |
| `T-C46-BODY` | C46/L2 | inject each of 3 declared pass-through values, EOF, and one ordinary character | terminators return; ordinary character is edited/appended; no extra local leaf exists |
| `T-C46-QUERY` | C46/L2 | inject all 8 accepted spellings and one invalid value | five yes, three no, invalid retries; no pointer leaf |
| `T-C46-SEND-FAIL` | C46/L2 | synthetic connector returns an error string | no header/body write; identical string returned |
| `T-C46-RECEIVE-ORDER` | C46/L2 | deliver two synthetic accepted messages | saved string and `PRINT-SENDS` show arrival order; two returns separate messages |
| `T-C46-NON-RFC` | C46/L2 | return a non-RFC connection, then inject LISTEN and state-access failures separately | non-RFC attempts exactly one registry removal and has no accept/read/history/close/UI/reply effects; LISTEN/state failures precede removal and unwind only an owned lock |
| `T-C46-CLEANUP-PHASES` | C46/L2 | inject failures (a) during body copy after a known prefix, (b) after close but before slice display completes, and (c) during reply query or outbound reply | (a) heading, first line, and exact body prefix remain without final two returns while connection is open and registered and no UI phase ran; (b) complete terminated history remains with close but no remove and absent/partial display; (c) close, completed display, and remove precede failure; every phase retains committed history, and only an acquired owned lock unwinds |
| `T-C46-LOCK` | C46/L2 | overlap two receive interactions | both histories commit; only one reply query owns pop-up; successor prevents premature deactivate |
| `T-C303-PARENT-COMPOSE` | C303/L2 | compose local table over every incorporated D05 cell and mode/context edge | 8 local cells shadow; all other effective leaves equal D05; 0 local main pointer cells |
| `T-C303-DIRECT` | C303/L2 | invoke all 8 direct cells with and without numeric state | 7 reach named effects and ignore number; `Control-Z` reaches not-implemented, not parent Quit |
| `T-C303-YANK-EMPTY` | C303/L2 | invoke direct `Control-Meta-Y` before any receive and invoke the transient-reader equivalent | direct editor command inserts `NIL`; transient reader inserts no bytes |
| `T-C303-NAMED` | C303/L2 | enumerate completion registry and all DEFCOM definitions | exactly 9 Meta-X names; with 7 defined direct handlers plus Help they account for all 17 DEFCOM forms |
| `T-C303-HELP` | C303/L2 | traverse local `Help M`, every D05 inherited leaf, `?`, and an unknown value | local M reaches Converse Help; inherited tuples remain exact; invalid paths retry |
| `T-C303-PREFIX` | C303/L2 | traverse every D05 `Control-X` leaf from Converse and one unbound child | tree is isomorphic to D05; no local child; unbound result is D05's result |
| `T-C303-QSEND-INPUT` | C303/L2 | exercise 4 declared editing cells, fallback terminators/actions, conditional Return, inherited Abort, and one ordinary value | exact transient tree; no selected-current `Control-C` local leaf |
| `T-C303-SIMPLE-QUERY` | C303/L2 | exercise 14 effective accepted values, Help, Clear-Screen, and one invalid value | exact choice result/order and retry behavior |
| `T-C303-SIMPLE-POINTER` | C303/L2 | inject every supported button code and one other button | left selects via process; middle deactivates; other has no local effect |
| `T-C303-HOST-MENU-MODIFIERS` | C303/L2 | create `N=3` host rows; for each row inject every 3 single-button and 7 nonzero button-mask cases under all 32 Shift/Control/Meta/Super/Hyper states; also test blank interior and deactivation | 9 normalized, 288 single-primary raw, and 672 full-mask raw tuples; every row tuple returns that host; blank does not choose; deactivation returns `NIL`; zero keyboard cells |
| `T-C303-TV-N-ARG` | C303/L2 | enumerate handler arguments `NIL`, `T`, `1`, `2`, `0`, `-1`, and another integer against pending, deferred, and old fixtures; separately drive the physical Terminal parser | exact detach/display/defer/drop branch; `T` displays residual old history when it opens; keyboard produces only `NIL` or integers; one TV-owned N leaf and zero Converse cells |
| `T-C303-TV-N-TASK` | C303/L2 | while the task window is selected, inject Space, Help, an ordinary key, selection loss, new pending work, and a pending-plus-queued-key race | every delivered ordinary key dismisses; selection loss dismisses; pending redraws first; one value consumed; zero local pointer cells or keymap errors |
| `T-C303-TV-N-FALLBACK` | C303/L2 | with protected old typeahead, inject Space, Help, another ordinary value, forced deexpose, `Mouse-1-1`, and every other supported button code | old typeahead returns to old window; ordinary values dismiss; deexpose wakes; left selects interest after deexposure; all other local click results are `NIL` |
| `T-C303-SEND-VALIDATE` | C303/L2 | use damaged structure, missing `To:`, blank body, and nonexistent explicit host | every failure precedes composer restore |
| `T-C303-SEND-PARTIAL` | C303/L2 | in-frame send to three all-new success/failure/success synthetic recipients | composer clears first; attempts and record calls use input order; peer blocks use reverse creation order; all-success false; no rollback |
| `T-C303-QSEND-ORDER` | C303/L2 | out-of-frame QSend to three valid synthetic recipients with the middle failing | wire attempts and queued records use reverse input order; returned successes retain original relative order; FIFO drain is observed separately |
| `T-C303-REPLY-EMPTY` | C303/L2 | set last sender to `NIL`, then invoke zero-argument REPLY | Converse is selected; no body prompt and no delivery occurs |
| `T-C303-MAIL-STALE` | C303/L2 | mail first to unresolved bare user, then valid explicit host | strict later record retains stale reason; safe option clears it |
| `T-C303-QUEUE` | C303/L2 | enqueue A then B; first make A signal, then in a clean run make A append C while executing | failure leaves A queued and does not falsely report B complete; successful live-chain traversal executes A, B, C in the same drain |
| `T-C303-RECEIVE-MODES` | C303/L2 | inject one message in every mode, hidden and exposed | immediate/delayed state, beeps, point, notification, and pop-up follow policy table |
| `T-C303-HISTORY` | C303/L2 | set a distinct last-sender sentinel; test fresh source binding and invoke the selected before-cold initializer; receive twice, QSend once, raw SEND-MSG once, then print/regenerate | strict initialization retains the exact sender sentinel; fresh-load history lacks a suffix; post-reset first receive adds trailing `NIL`; entries otherwise newest first; outgoing QSend only in peer records; raw send absent; regeneration loses unsent edits; corrected last-sender clear is tested separately |
| `T-C303-INIT-PHASES` | C303/L2 | seed gag, receive mode, saved sends, last sender, and queue; invoke cold, saved-send before-cold, queue before-cold, and `:ONCE` separately, including queue-clear with no frame | cold clears gag only; saved action retains sender/policies; queue action finds or creates frame, ensures run reason, then clears; once constructs; receive mode remains in every case |
| `T-C303-FRAME-PROPERTIES` | C303/L2 | construct a source-profile frame and dump flavor order, process/PDL/save-bits, mode-line variants, closure bindings, pane properties, initial interval/point, and pre-expose action | every property matches the exact source table; actual pixel appearance remains a named runtime oracle |
| `T-C303-DELETE-HEAD` | C303/L2 | delete ordinary then headerless conversation in disposable state | ordinary splice succeeds; strict head path leaves stale list; safe path rejects unchanged |
| `T-C303-EXPORT` | C303/L2 | write/append whole and one peer around synthetic diagrams | exact source interval and diagram strings; append order; partial failure recorded |
| `T-C303-SHOUT` | C303/L2 | two synthetic location entries, one open failure | strict contacts are `SEND NIL`; body suffix is `NILanyone`; successful host receives; failure silent |
| `T-C303-NOTIFY-DUP` | C303/L2 | begin from NIL, send `A` from host 1, `a` from host 2, `B`, then `A`, varying timestamps; invoke each selected reset operation between sentinel cases | lower-case `a` is suppressed despite case, host, and time changes and leaves prior text `A`; `B` and final nonconsecutive `A` are presented and replace it; every request answers `Done`; selected reset operations do not clear the register |
| `T-C303-TV-BEFORE-COLD` | C303/L2 | seed distinct history, pending, and deferred sentinels; invoke only the selected TV before-cold initializer | history becomes NIL while pending/deferred retain exact identities; labelled corrected all-clear differs |
| `T-C303-NOTIFY-ALL` | C303/L2 | traverse source hosts `H1`, unparseable `BAD`, `H2`, `H3`; return answered, RFC-pending, and unexpected connections for the three valid hosts | opens `H1,H2,H3`; omits `BAD` completely; waits 300 ticks maximum; reports `H3,H2,H1` with three distinct results; removes `H3,H2,H1` even on injected mid-report failure |

### Exhaustive effective-tree procedure

`T-C303-PARENT-COMPOSE` MUST enumerate the complete character domain and mouse-array
domain represented by D05, then compute lookup from the local top table. It MUST also
enumerate every prefix path, every Help leaf, all nine completion names, all dynamic
host-menu items and all `224N` raw row/button/modifier tuples in the fixture, the
QSend task context, the simple-reply context,
the five Terminal-N argument classes, and both TV notification-window contexts.
For each tuple it records source owner (`Converse`, `D05 parent`, `TV/FQUERY`, or
unbound), stored target, resolved function status, numeric state, and result. Comparing
only the eight local cells is insufficient.

`T-C46-BODY` and `T-C46-QUERY` perform the equivalent exhaustive class check for the
early stream contexts. Each test includes an invalid/complement value so an
implementation cannot pass by recognizing only the successful leaves.

## Preserved-system comparison and screenshot obligations

The existing run `d09-converse-20260718`, generation 1, used the System `303-0` load
band in the repository's CADR Xvfb harness. Its base/private disk SHA-256 was
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`
at start and clean stop. `forced_stop=false`, `state_may_be_incomplete=false`, and
the base remained unchanged. The source snapshot recorded System check-in
`4df393c…`; the run's execution-time `usim` SHA-256 was
`707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be`.
`[C303-RUN]`

The run established:

- System Help did not list Converse in that world;
- the normal `MAKE-SYSTEM`/SYS path required unavailable `AMS-BRIDGE-1`;
- loading the public source through the local bridge reached initialization but
  failed when `INTERVAL-LAST-BP` received a `NIL` interval; and
- a compile attempt fell back to an unavailable remote data connection.

It did **not** expose a working Converse frame. The raw blocker captures remain in
the ignored session tree and are not representative application views. No image is
published on this page.

| Obligation | Safe setup and action | Discriminating outcomes | Claim closed |
| --- | --- | --- | --- |
| `TODO-RUNTIME-C303-VISIBLE` | boot a checksum-pinned compatible band or reproducibly corrected public build; select `System C`; capture empty composer and one synthetic local record; stop cleanly | visible frame versus construction failure | layout, labels, divider rendering, screenshot |
| `TODO-RUNTIME-C303-CONTROL-Z` | in a disposable empty draft, inspect effective cell and invoke `Control-Z` without a peer | not-implemented versus resident alias/send path | source/world disagreement |
| `TODO-RUNTIME-C303-NOTIFY-PROMPT` | invoke no-message NOTIFY without a network peer, stopping after prompt/error | stream error versus repaired prompt | omitted-stream defect |
| `TODO-RUNTIME-C303-PRINT-NIL` | after the selected before-cold reset and before any receive, direct `PRINT-SENDS` to a disposable string-capable stream | signal, coercion, or accepted empty output | stream handling of reset history |
| `TODO-RUNTIME-C303-NOTIFY-ABORT` | expose each TV notification window with synthetic local text, press Abort, inspect process/resource/window state, then clean up | clean deactivation, retained exposure, or debugger/reset path | inherited abort cleanup |
| `TODO-RUNTIME-C303-QREPLY` | inspect function binding without invoking delivery | absent versus synonym definition and provenance | alias closure |
| `TODO-RUNTIME-C303-HOST-CANCEL` | stub host search to two synthetic hosts; leave/deactivate chooser without a choice | selected-source `NIL` followed by `<undetermined-host>`/no-host handling versus resident divergence | world/source cancellation agreement |
| `TODO-RUNTIME-C303-SHOUT` | isolated two-peer Chaos site; intercept exact contact/body; do not route externally | selected malformed bytes versus resident repair | SHOUT definition in world |
| `TODO-RUNTIME-C303-PEER` | two disposable CADR instances on isolated Chaosnet; send one synthetic direct message, reply, and notify | delivery, identity, ordering, and duplicate trace | end-to-end behavioral L3 |
| `TODO-RUNTIME-C46-VISIBLE` | obtain a checksum-pinned System 46-compatible band; receive one synthetic local message | exact QSend pop-up layout and reply interaction | C46 visible behavior |

A future curated screenshot MUST follow the CADR harness provenance schema and
[screenshot publication review](../screenshot-publication-rights-review.md): session
and generation, load-band/disk/source/emulator identities, input sequence, window
geometry, PNG and pixel hashes, clean/forced stop state, image-specific four-factor
analysis, and minimal scholarly use. A blocker or error screen MUST NOT be substituted
for the application view.

## Known unknowns and nonclaims

- No compatible System 46 runtime was exercised; all `C46-QSEND` behavior here is
  source-profile behavior.
- The System `303-0` band did not load Converse, so the selected source's
  `Control-Z`, head-delete, NOTIFY prompt, and SHOUT defects have no world result yet.
- The exact historical release that first introduced Converse is not established by
  the System 46/System 303 bracket.
- `QREPLY` is documented and globalized but lacks a selected defining form.
- TV menu cancellation and every user-mutated comtab/profile are outside static
  closure until dumped by the named oracle.
- File-version and low-level stream semantics remain owned by the filesystem spec;
  this page specifies Converse's call and mutation order only.
- No network timing, retransmission schedule, packet encoding, or Chaos ABI claim is
  made here.
- No screenshot supports a visible CADR Converse claim yet.

## Artifact identities

All LM-3 sizes and hashes below were recomputed from `fossil cat -R sys.fossil -r
4df393c… <path>` or from the byte-identical harness source snapshot on 2026-07-19.

| Role | Portable identity | Bytes | SHA-256 | Boundary |
| --- | --- | ---: | --- | --- |
| System 46 direct messaging | `src/lmio/chsaux.113`, Git `8e978d7d…` | 47,474 | `1990f30c37def0129f7f36faac310f68b303687571d46ff8057b93ac0b6e316d` | public snapshot |
| System 46 query substrate | `src/lispm/lfl.192`, Git `8e978d7d…` | 15,463 | `b2da667d3bf2bd211717accfc984fbdf01309912155815d0bc32e3ca05901759` | public snapshot |
| System 46 load inventory | `src/lmdoc/lispm.files`, Git `8e978d7d…` | 3,373 | `8d7edb5327f1f54235946ca053f289881b9df04eb84d72f3228b74175172d396` | public snapshot |
| System 303 Converse | `io1/conver.lisp`, Fossil `4df393c…` | 60,328 | `0142dd413d30445c63fa8347ecf802418a8089066bbc69b66f168d3f8d4904ba` | maintained public browser; no blanket derivative-rights inference |
| System 303 Chaos auxiliaries | `network/chaos/chsaux.lisp`, Fossil `4df393c…` | 67,218 | `29fb941e5147b5f7ae51331f90dd11ffbf9ed93058c1e0835d6c6900f3803a05` | same |
| System declaration | `sys/sysdcl.lisp`, Fossil `4df393c…` | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` | same |
| FQUERY substrate | `io1/fquery.lisp`, Fossil `4df393c…` | 15,618 | `3e4a519f9a0f44f87db2c6e594cb21a9bca5cde983df21fbdf9e6237fffdcf23` | same |
| editor-stream substrate | `zwei/stream.lisp`, Fossil `4df393c…` | 66,047 | `c2f7b82430381c9bfca34806276671f02bb56f1364916943f072e2590e8d6a66` | same |
| TV Terminal/notification caller | `window/basstr.lisp`, Fossil `4df393c…` | 81,846 | `8ba3a16e726ed043e6585c7a68b7096bb2dcc5d6f05476afd89f84a48dff2645` | same |
| TV notification windows | `window/baswin.lisp`, Fossil `4df393c…` | 82,708 | `3b86ca413528046887da8371433d656ecd9d5f9130d6eadd764fc54f137b42f1` | same |
| TV stream input | `window/stream.lisp`, Fossil `4df393c…` | 26,023 | `3159e4aa22a77a71a2d603cb5fe9ec78c1674af0615dd9ad83d238195613cef8` | same |
| TV pop-up resources | `window/cometh.lisp`, Fossil `4df393c…` | 2,717 | `c6f3474835eb8529273302e5ae555b8f1a2de6933a47a04d22b128f37142cb4f` | same |
| TV momentary-menu substrate | `window/menu.lisp`, Fossil `4df393c…` | 60,809 | `4821fb9b3d4541a371ad106f7042d8c59dbb33daf8d9a27ffb24b3141aa796e9` | same |
| TV physical mouse substrate | `window/mouse.lisp`, Fossil `4df393c…` | 57,256 | `facf7f3dd979a758bd70b0644120ccceb0f243188acd180dcbf0a70a836ec6b2` | same |
| string coercion | `sys2/string.lisp`, Fossil `4df393c…` | 49,754 | `070c8f058bca3410ba5871ac1dbf00cb53d0d01b077111925d1fd314c29b12a5` | same |
| ZWEI insertion | `zwei/insert.lisp`, Fossil `4df393c…` | 25,890 | `6ddb621348af571898d0d3b00ad4d788c53c605094acfdde3cd3c8e3932b8ddb` | same |
| Chaos manual source | `man/chaos.text`, Fossil `4df393c…` | 67,976 | `d8219acd0c11c046b7c865b053a5ed6fb34598f2def50a3671cae3d5b2339e6b` | same |
| System 86 note | `doc/sys86.msg`, Fossil `4df393c…` | 38,939 | `43e7c93109b974f96aa2a5e083d8c83dfb262fc9703afed2dd6cdfec61fd1a0f` | same |
| System 93 note | `doc/sys93.msg`, Fossil `4df393c…` | 64,263 | `68fe3ca6038969f7da964387e3b8c2b589f84cd63b8c7512fda95ca31bb04d55` | same |
| System 94 note | `doc/sys94.msg`, Fossil `4df393c…` | 28,681 | `85043055f5e4d7545fc9dd1fa9cef81ac467bf48a8f9060e0c003c663cb71846` | same |

The System 46 Git commit is dated 2019-02-14. The selected Fossil check-in is tagged
`system-303`, dated 2025-01-06, and must remain labeled maintained restoration work.

## Sources

- MIT CADR System 46, pinned
  [`lmio/chsaux.113`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/chsaux.113),
  [`lispm/lfl.192`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/lfl.192), and
  [`lmdoc/lispm.files`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/lispm.files).
- LM-3 maintained System 303, pinned
  [`io1/conver.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Fconver.lisp),
  [`network/chaos/chsaux.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=network%2Fchaos%2Fchsaux.lisp),
  [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp),
  [`io1/fquery.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Ffquery.lisp),
  [`zwei/stream.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Fstream.lisp), and
  [`zwei/insert.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Finsert.lisp),
  [`window/basstr.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbasstr.lisp),
  [`window/baswin.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbaswin.lisp),
  [`window/stream.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fstream.lisp),
  [`window/cometh.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fcometh.lisp),
  [`window/menu.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fmenu.lisp),
  [`window/mouse.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fmouse.lisp), and
  [`sys2/string.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys2%2Fstring.lisp).
- LM-3 maintained manual and release-note source, pinned
  [`man/chaos.text`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Fchaos.text),
  [`doc/sys86.msg`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fsys86.msg),
  [`doc/sys93.msg`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fsys93.msg), and
  [`doc/sys94.msg`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fsys94.msg).
- In-repository D05 parent-tree authority,
  [MIT ZWEI and Zmacs keybindings](zwei-zmacs-keybindings.md), at the exact anchors
  incorporated above.
- Isolated public System 303 harness session `d09-converse-20260718`, generation 1,
  observed 2026-07-18; raw session payload remains ignored.

Last verified: 2026-07-19.

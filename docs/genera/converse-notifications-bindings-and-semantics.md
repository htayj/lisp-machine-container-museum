---
type: Reimplementation Specification
title: System 452.1 and Zmail 442.0 Converse and Notifications bindings and semantics
description: A rights-safe normative companion for the System 452.1 and Zmail 442.0 source profile, kept distinct from bounded Genera 8.5 System 452.22 runtime evidence.
tags: [genera, converse, qsend, notifications, dynamic-windows, zwei, command-processor, reimplementation]
timestamp: 2026-07-19T20:08:26-04:00
---

# System 452.1 and Zmail 442.0 Converse and Notifications bindings and semantics

This companion closes the `DM-G452-SRC` application contract for Converse,
one-shot and reply sends, the `SEND` service adapters, host notification fan-out,
central notification delivery, the Notifications activity, and the `Show Messages`
and `Show Notifications` reports. It is normative under the [D09 main
specification](../converse-direct-messages-and-notifications-reimplementation-specification.md)
and intentionally more mechanical than the historical [Converse and notifications
dossier](../converse-direct-messages-and-notifications.md): an implementation can
use the state machines, finite input inventories, failure rules, and tests here
without access to licensed Symbolics source.

The principal conclusion is exact but bounded: Converse is a ZWEI/TV application
which selectively uses Dynamic Windows facilities; Notifications is a Dynamic
Windows program framework; neither application is a CLIM application. The selected
System 452.1/Zmail 442.0 source is sufficient for a source-profile behavioral
reconstruction. The separate Genera 8.5 System 452.22 world has so far established
only two local visual states and one synthetic notification path, not peer delivery,
source residency, or binary identity with that source tree.

## Status, scope, and reconstruction claim

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
normative. “Source behavior” means behavior required by `DM-G452-SRC` below.
“Observed behavior” means the bounded `DM-G85-RUN` run. A `TODO-RUNTIME` identifies
an oracle gap; it never grants permission to substitute a guess.

This companion uses the main specification's compatibility levels unchanged:

- **L1 semantic core** requires profile-tagged deterministic state, transitions,
  failure values, and explicit clock, filesystem, address, network, mail, display,
  and scheduler adapters. An inert recording peer is permitted and must be named.
- **L2 interactive application** adds every effective direct, inherited, prefix,
  transient, menu, pointer, presentation, numeric, repeat, Help, shadowing,
  fallthrough, and unbound input path; frame/view lifecycles; and rights-safe visual
  relationships.
- **L3 preservation fidelity** adds preserved-system comparison, exact selected wire
  serialization and acknowledgement order, timing-visible queue/popup behavior,
  isolated real peers, strict-defect results, and closure of every mandatory oracle
  for the claimed feature.

This document supplies the `DM-G452-SRC` L1/L2 contract and bounded L2 visual
evidence from `DM-G85-RUN`. The two reviewed screenshots do **not** satisfy L3.
Peer exchange, timing oracles, source-to-world residency, and every applicable open
oracle must be closed before an L3 preservation claim.

It does not claim source compatibility, package-complete API compatibility, ABI or
compiled-file compatibility, world-image compatibility, network interoperability
outside the specified grammar, or equivalence to every Genera patch level. A
reimplementation MUST report those stronger claims separately if it makes them.

### Selected profiles

| Profile | Exact target | Permitted claim |
| --- | --- | --- |
| `DM-G452-SRC` | Licensed System 452.1 / Zmail 442.0 selected source set in the evidence ledger | Normative source-profile state, ordering, interfaces, input trees, and failures described here |
| `DM-G85-RUN` | Genera 8.5 System 452.22 under Open Genera 2.0, session `d09-converse-notifications-genera-20260718`, generation 2 | Only the visual and local notification observations named in this document; bounded L2 evidence, never an L3 claim |

The System 452.1/Zmail 442.0 source tree and System 452.22 world image have not been
proven load-identical. A conforming report MUST identify one profile per result and
MUST NOT use a source fact as proof that the same code was loaded in `DM-G85-RUN`.
Conversely, a screenshot is not proof of an unexercised source branch. Combining
`DM-G452-SRC + DM-G85-RUN` means implementing the selected source contract and
comparing only the bounded world states, not asserting version or body identity.

This companion closes the main specification's `CONVERSE-G452`,
`CENTRAL-NOTIFY-G452`, `NOTIFICATIONS-ACTIVITY-G452`, `CP-REPORTS-G452`, and
`NET-NOTIFY-G452` feature inventories. Its Write/Append and Hardcopy rows close only
the Converse-facing portions of `EXPORT` and `HARDCOPY-G452`; filesystem and printer
implementation remain owned by their subsystem specifications. A conformance label
MUST name the selected closures and strict/corrected status of every applicable
main-specification defect.

### Normative companion incorporation

The following exact in-repository sections are part of this contract rather than
background reading:

| Owner | Normatively incorporated section | Use here |
| --- | --- | --- |
| ZWEI/Zmacs | [Complete effective input and gesture trees](../eine-zwei-and-zmacs-editor-family-reimplementation-specification.md#complete-effective-input-and-gesture-trees) | Common tree schema, inherited editor behavior, numeric state, staged prefixes, aliases, and source-profile ownership |
| Genera Zmacs | [Effective lookup and failure tree](zmacs-keybindings.md#effective-lookup-and-failure-tree) | Sparse-table precedence, `NIL` fallthrough, hard undefined, aliases, and terminal errors |
| Genera Zmacs | [Help dispatcher tree](zmacs-keybindings.md#help-dispatcher-tree) | The inherited editor Help tree when an application-local leaf does not shadow it |
| Genera Zmacs | [Pointer and Dynamic Windows presentation tree](zmacs-keybindings.md#pointer-and-dynamic-windows-presentation-tree) | The complete editor content-area pointer and presentation overlay |
| Dynamic Windows | [Typed input and `ACCEPT`](dynamic-windows-reimplementation-specification.md#typed-input-and-accept) | `message-string`, address correction, activation characters, and input histories |
| Dynamic Windows | [Gestures and handler resolution](dynamic-windows-reimplementation-specification.md#gestures-and-handler-resolution) | Raw pointer normalization, type/context gating, menu-only handlers, and precedence |
| Dynamic Windows | [Command Processor integration](dynamic-windows-reimplementation-specification.md#command-processor-integration) | Command-name, keyword, presentation, completion, common-output, and error contexts |
| Dynamic Windows | [Program frameworks](dynamic-windows-reimplementation-specification.md#program-frameworks) | Notifications frame, panes, menu cells, command loop, and inherited command tables |
| Dynamic Windows | [FQUERY and query-stream compatibility](dynamic-windows-reimplementation-specification.md#fquery-and-query-stream-compatibility) | Common Help, pointer selection, invalid-input, scrolling, and abort behavior for every query below |
| Listener/Input Editor | [Input-editor compatibility surface](../lisp-listeners-reimplementation-specification.md#input-editor-compatibility-surface) | Generic correction, Help, Abort, history, completion, and editing under one-shot message and address readers |

The local overlays in this document win only in the contexts and order stated. If a
local cell is absent, the incorporated parent remains effective. If a local cell is
hard undefined, lookup stops. A reimplementation MUST preserve the owner and lookup
path for every effective result; flattening the tables without that provenance is
not conforming.

## Evidence and provenance

### Evidence vocabulary

| Code | Meaning |
| --- | --- |
| `G452-SRC` | Direct inspection of the selected licensed System 452.1/Zmail 442.0 source; paraphrased here |
| `G85-RUN` | Direct observation in the distinct Genera 8.5 System 452.22 world through the isolated Xvfb harness |
| `G8-MAN` | Installed or contemporary Genera documentation, used as secondary evidence |
| `INTERP` | Clean-room interpretation or safety rule, explicitly not a historical claim |
| `TODO-RUNTIME` | Behavior requires a further runtime oracle; equivalent to a main-specification `TODO-ORACLE` |

### Licensed source identity ledger

The source files remain untracked local licensed inputs. Paths below are portable
archive-relative identities; hashes permit a licensee to reproduce the audit without
publishing the files. Sizes are bytes and hashes are SHA-256.

| Artifact-relative source | Size | SHA-256 | Contract evidence |
| --- | ---: | --- | --- |
| `sys.sct/zmail/converse/converse.lisp.~1564~` | 89,288 | `bd15925898941848626bb4fa051a56d70f23e9547aff58deb8bf2c6a1e493bd9` | Converse state, commands, QSend/QReply, SEND/CONVERSE adapters, reports |
| `sys.sct/window/notification.lisp.~116~` | 28,978 | `b845b2795f279919e853d50668bba9f4dcb185b18f0019b347726ec6b81ac10e` | Notification records, delivery process, selected-stream handshake, popup |
| `sys.sct/window/notifications-activity.lisp.~4011~` | 8,339 | `41f5deee29753d0a0fc26c513818cb4e125315d8be6afc5f4cbd8bada5881f02` | Notifications framework, cache, keys, menu, panes |
| `sys.sct/network/protocols.lisp.~134~` | 42,657 | `3fb78acff2b08ee38be796bb4c90825c4a3e89bfc822456251fb94266ca64d64` | Host-level NOTIFY sender, fan-out, receiver, duplicate suppression |
| `sys.sct/cp/info-commands.lisp.~129~` | 19,303 | `7183e0229b3be5c2e60b4d2ec50e9c2c839d3e2c131882c3aaec359a8d3c42fc` | `Show Notifications` and `Show GC Status` |
| `sys.sct/zmail/system.lisp.~81~` | 5,673 | `7a76f3f99df71721376e5cddb247b616568ddbc420fa17cc13aa5fd3804be17b` | Converse system composition |
| `sys.sct/zmail/definitions.lisp.~1552~` | 98,226 | `f5c96f713e3105acb78d1a79de3d0739afd361f297b3a9b6b647fd4638144aa6` | Zmail definitions used by Converse |
| `sys.sct/zmail/headers.lisp.~1534~` | 66,205 | `6cd3f2217511c8a7d453806ef97d7cf7ad01c399b3affcfa32e9b69d8f796c49` | Missing-address rendering and address-string failure boundary |
| `sys.sct/zmail/commands.lisp.~1600~` | 120,174 | `4b00879c28268561def2e2ee34a34026f73aca9dc8f5a4cb6077a66af342adf1` | Exact Compile File and Load File targets installed by Converse |
| `sys.sct/zmail/smtp.lisp.~1537~` | 38,265 | `8f01f92630a0683b0ab25902b6dee6a1b4d936c2ebbd3e857f8ca89cf5471a0d` | SMTP `:send` path and styled-text fallback |
| `sys.sct/cp/comtab.lisp.~103~` | 36,295 | `f60724c8e2526950000f090f2dae4745b3394079713b3601606be865c23b98e1` | Command-table construction and inheritance |
| `sys.sct/cp/read-accelerated-command.lisp.~142~` | 37,639 | `8107cf4e993068344e624ec924c8d0cf0327158a927c1962666d22eb81494388` | Accelerator and numeric-argument reader |
| `sys.sct/cp/substrate-commands.lisp.~6~` | 14,731 | `558f085cc3953de3f831e4e9e195104303e9e6331861a9ed629b550870fb4f44` | Standard Arguments, Scrolling, Marked Text, Input Editor Compatibility |
| `sys.sct/dynamic-windows/dynamic-input.lisp.~498~` | 55,058 | `a79805ece6844ccb568ecf97e2d818a0c6095e539e51fbf74423944a32b6dd8f` | Pointer gestures and typed-input contexts |
| `sys.sct/io1/fquery.lisp.~104~` | 13,320 | `022823ae8dddbf64c598ab59bde00945c9b5e621191617b1374a84f020730e0f` | FQUERY choice dispatch |
| `sys.sct/sys2/string.lisp.~326~` | 94,076 | `d688c5011f5f6f194a8351da03ea2acbf43c50253ad5748653f374ebc925cec7` | Zetalisp symbol-to-string coercion in missing-`TO` comparison |
| `sys.sct/window/tvdefs.lisp.~488~` | 68,717 | `8d4f22284a36e6e465ffda185279415a00cb3234251a6a769bd260d61ba79a5a` | Notification history, TV last tick, delivery-tail definitions, and temporary-window mouse-call lifecycle |
| `sys.sct/sys/ltop.lisp.~754~` | 25,132 | `18f1cc03e5a5aefc06b97eaa5649cffdf2717b824f994422d8ea2111f1db6ebb` | Distinct before-cold-before-save and once/first initialization scheduler phases |
| `sys.sct/window/menu.lisp.~223~` | 82,347 | `73c5e594a77bbbba81e630dee92724c7ec72d1fe22740b5e2eda3c466b3241d1` | Momentary host chooser and command-menu pointer behavior |
| `sys.sct/dynamic-windows/dynamic-window-mixins.lisp.~204~` | 139,058 | `d1c9db01f37982f10efdd5f7f21dff938a437c4b1f80633c04054158be87a482` | Complete margin-scroll-bar hit regions, buttons, motion, and auto-repeat |
| `sys.sct/zmail/patch/zmail.system-dir.~262~` | 8,075 | `27366e60fbc6760d2fa937008c9f1883549b6089786fbdfa7230557943d56383` | Release-context header naming System 452.1 and Zmail 442.0 |

The release-context row is the direct version evidence for `DM-G452-SRC`. It names
System 452.1 and Zmail 442.0 in the licensed source distribution. The separate VLOD
runtime reports System 452.22; this specification does not infer equivalence between
those versions.

The purchased Open Genera archive used by the harness is 206,213,430 bytes,
SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
The base and private `Genera-8-5.vlod` were each 54,804,480 bytes, SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`,
at both run boundaries.

### Runtime witness boundary

`DM-G85-RUN` began 2026-07-18 06:39:03 EDT and ended 06:42:39 EDT. Its run record
is 26,055 bytes, SHA-256
`1ffacb2809fa4aee90e12fb7ff65413d1e443e0471adc82e1af2265743ad15f7`;
its 14-record action log is 6,881 bytes, SHA-256
`742d8554f5273038b99e555d1262afbbbdb4dc2f0096f2a55f1357d7827eec03`.
The local login, `Select C`, local Converse Help, `Select N`, and a researcher-owned
`TV:NOTIFY` call with fallback popups disabled were observed.

The shutdown prompt was observed, `yes` was accepted, and cleanup began. The known
Cold Load channel mutex stall then required bounded termination. The final flags
were `forced_stop=true`, `forced_after_confirmed_shutdown_stall=true`,
`state_may_be_incomplete=true`, and `orderly_vlm_host_shutdown=false`. The harness
performed neither Save World nor a host checkpoint; both world hashes remained
unchanged. This witness MUST NOT be described as an orderly shutdown or as evidence
of persistence.

## Architecture and user-interface substrate

### Component graph

```text
Listener / Command Processor
├─ QSend / QReply / Send Message
│  └─ Converse send preflight -> background sender -> Converse request queue
├─ Show Messages -> Converse object histories
└─ Show Notifications -> TV notification history

Converse frame (ZWEI + TV)
├─ one ZWEI window pane in Text mode
├─ ZWEI interval plus structural diagram lines
├─ Dynamic Windows margin components, including scroll bar
├─ optional temporary Dynamic Window incoming-message popup
└─ network :send adapters (:converse, Chaos :send, SMTP)

TV notification service
├─ newest-first retained history
├─ oldest-pending cursor
├─ central delivery process
├─ selected-stream handshake
├─ fallback popup and remote-terminal delivery
└─ Notifications Dynamic Windows program framework
```

### Converse is ZWEI/TV, not CLIM

`DM-G452-SRC` composes the main frame from a Converse top-level editor, Converse
state, `new-panes-zwei-frame`, and TV process/select mixins. It creates one
`zwei-window-pane`, installs the Converse comtab, and enables Text mode. Its pane
uses Dynamic Windows ragged-border, white-border, and scroll-bar margin components,
but the editor and command loop remain ZWEI/TV.

The incoming-message popup is explicitly a temporary `dw:dynamic-window`, and its
queries are FQUERY interactions. Listener message entry uses `SCL:ACCEPT` with a
custom presentation type. Those are Dynamic Windows integrations, not evidence of
CLIM.

### Notifications is Dynamic Windows, not CLIM

Notifications is defined by `dw:define-program-framework`. Its frame contains a
title pane, a two-cell command menu, and a scrolling typeout/display pane with a
left margin scroll bar. `TV:NOTIFY` formats its text into a Dynamic Windows
presentation-recording string, allowing sensitive content to survive in a record.
Neither fact creates a CLIM application frame.

No selected file declares a CLIM application frame, CLIM port, CLIM command table,
or direct CLIM protocol dependency. A conforming reconstruction MUST identify the
main Converse frame as ZWEI/TV, the popup and typed readers as Dynamic Windows
facilities, and Notifications as a Dynamic Windows framework. It MUST NOT market
either as a CLIM application merely because the systems share terms such as
presentations, commands, frames, panes, or redisplay.

### Source-defined frame and pane properties

The following are source-profile contracts; they do not claim pixel identity with
the separate Genera 8.5 witness.

| Converse property | Exact `DM-G452-SRC` requirement |
| --- | --- |
| frame composition | `converse-top-level-editor`, Converse state, `new-panes-zwei-frame`, TV process mixin, then TV select mixin |
| process/save bits | process top level `converse-window-top-level`; initial `:save-bits :delayed`, changed to true before editing or deexposed typeout |
| mode line | `Converse `; conditional `[Gagged] `; parenthesized mode-name list; optional `  Style: <style>`; then exactly one of `    End sends and exits, Abort just exits, Control-End just sends` or `    End just sends, Abort just exits, Control-End sends and exits` |
| editor/pane | Text mode; exactly one exposed `zwei-window-pane` named `Converse`, attached to the shared Converse interval node |
| ordered margins | `margin-ragged-borders` with thickness 1; `margin-white-borders`; `margin-scroll-bar` with history noun `conversations`; the selected scroll bar omits `:visibility :if-requested` |
| initial interval | insert one return; construct exactly one headerless `To:` composer; move point to the end of the first line |
| exit | bury the frame, then wait forever; do not destroy histories |

| Notifications property | Exact `DM-G452-SRC` requirement |
| --- | --- |
| framework | Dynamic Windows program `notifications`, Select N, command definer enabled, accelerator-enabled table inheriting `standard arguments` and `input editor compatibility` |
| title | output-sized title pane, text `Notifications`, style `(:EUREX :ITALIC :HUGE)`, height one line, no redisplay after commands |
| menu | centered command menu with two rows in order: `Help`, `Exit` |
| display pane | display plus typeout window, no redisplay after commands, notification mode `:IGNORE`, `:MORE-P NIL`, end-of-page mode `:SCROLL` |
| ordered display margins | `margin-borders`; `margin-scroll-bar`; left `margin-whitespace` thickness 2; `margin-ragged-borders` thickness 1 with `:HORIZONTAL-TOO NIL` |
| layout constraints | main column is two-line `row-1` above even Notifications pane; `row-1` is title plus menu, with menu share 0.2 then title taking the remainder |

## State model and invariants

### Conversation object

An implementation MUST retain at least this logical state per conversation:

```text
Conversation {
  first_line
  last_line
  recipients[]
  ident | NIL
  private
  node
  to_line_delimiter
  with_header_p
  append_mode_at_creation
  oldmsgs[]
}

OldMessage {
  before_header | NIL
  text
  id_or_extra_args
}
```

`before_header=NIL` denotes incoming content; an outgoing record has a generated
status/header marker. `oldmsgs` is pushed newest first. The append-mode captured by
the conversation controls how records are materialized and later normalized; it is
not merely a viewer preference.

A conversation matches another message by non-NIL identity first. Without a usable
identity, it matches only when recipient-set lengths are equal and every recipient's
rendered address has a case-insensitive textual match. Incoming grouping uses the
sender plus any `ALSO` recipients. Address comparison may cache rendered strings,
but the cache MUST NOT change equality.

The strict comparison does not consume a counterpart after a match. Equal-length
lists containing duplicate address `A` can therefore compare equal when each `A`
finds the same single `A` in the other list even though another element differs.
This is the main specification's `G452-RECIPIENT-MULTIPLICITY` defect. Strict mode
MUST retain it; a consuming multiset comparison MUST be labelled with that defect's
permitted correction rather than presented as source identity.

The headerless anonymous composer is always the initial conversation. Each new named
conversation is inserted immediately after it, so the newest conversation appears
at the top of the named list. Every structural first/last/delimiter line MUST remain
reachable with reciprocal ZWEI links. Commands that require a current named
conversation MUST reject the anonymous composer and damaged structures.

### Histories and reply registers

Genera maintains three distinct histories:

| State | Order and content | Reset/lifetime |
| --- | --- | --- |
| Conversation `oldmsgs` | Newest-first records containing incoming bodies and outgoing temporary/final status | Before-cold removes all old frame/list/display state and rebuilds exactly one fresh headerless composer when a frame exists |
| `*saved-sends*` | Newest-first `(date, incoming-text)` pairs for non-notification receives | Cleared before cold; `PRINT-SENDS` reverses and prints bodies chronologically |
| TV notification history | Newest-first three-field notification records | The selected `:BEFORE-COLD` operation clears history and its delivery-tail pointer only; it retains the TV last-notification tick and current process identity |

`*last-recipients*` and `*last-ident*` are updated before an incoming direct message
is queued into the Converse frame. `QREPLY` MUST snapshot both registers before any
prompt or asynchronous work so a later receive cannot retarget an in-progress reply.
The before-cold Converse reset is ordered: clear saved sends; clear last recipients;
look up an already existing frame without starting one; and, if found, send
delete-all-conversations. Delete-all sets the conversation list NIL before
regeneration, so the old-list snapshot is empty. It deletes the interval, inserts a
return, constructs exactly one fresh headerless `To:` composer, installs that
singleton list, moves point to the end of the new first line, and requests text
redisplay. No old anonymous/named conversation, old-message record, or unsent
interval text remains reachable from the rebuilt frame. With no frame, only the
first two clears occur.

The operation does not assign last identity, request stack, receive mode, gag,
append/end policies, or beep count. Strict mode MUST retain exact sentinel values;
queued work may later run against the rebuilt frame. A corrected mode MAY clear
additional state only as a named deviation. The sequence has no rollback: failure
at frame lookup/send, list-NIL, interval deletion/insertion, composer construction,
list install, point move, or redisplay preserves every preceding effect and may
leave NIL/partial/singleton frame structure according to that boundary.

There is no automatic transcript file. Write and Append commands are explicit user
exports. A world save is outside this contract and MUST NOT be inferred from any
history mutation.

### Notification record and cursor

```text
NotificationRecord {
  universal_time
  presentation_recording_string
  window_of_interest | NIL
}

NotificationState {
  history                 // newest record first
  next_note_tail           // list-tail identity, not numeric index
  tv_last_notification_tick
  central_process
  popup_times_by_console   // process-local alist: console identity -> successful popup tick
}

NetworkNotifyFilter {
  text_buffer[1500]
  packet_length = 0
  packet_tick = 0
  resolved_host = NIL
}
```

`TV:NOTIFY` follows a non-NIL synonym stream, validates the resulting window as NIL
or a sheet and the format control as a string or list, then formats the complete
record before mutating shared state. Validation or formatting error MUST create no
record. Its no-interrupt body then pushes history, sets the TV last-notification
tick, uniquely registers a non-NIL window in background-interest state, conditionally
activates that window, and wakes the central process, in that order.

The sequence is not rollback-protected. Tick failure may leave history alone;
interest registration or activation failure leaves history/tick and possibly the
interest entry; wake failure leaves every prior mutation. Normal return preserves
the optional window-interest branch's multiple values—usually NIL without a
window—rather than returning the record or process-wakeup value.

The delivery cursor is a retained list tail. Selecting the oldest undelivered tail
while history is pushed at the head produces FIFO delivery from a newest-first
archive. Identity, not equality, determines whether a viewer cache or cursor has
reached a prior history head.

`popup_times_by_console` is lexical state of the central delivery loop, not the TV
global last-notification/delivery tick or network packet tick. It has at most one current entry per console,
updates only after that console's fallback popup is successfully selected, and drops
entries once their delay has elapsed. Two consoles therefore have independent popup
throttles.

## Converse lifecycle, processes, and concurrency

### Initialization and selection

Zmail initialization MUST:

1. build the Converse direct and `C-X` comtabs;
2. install `Select C` for the Converse frame;
3. create and activate one frame;
4. force delayed save bits to true before editing or background typeout;
5. create one ZWEI pane and one headerless anonymous composer;
6. place point after its `To:` line; and
7. enable Text mode.

Quitting buries the frame and leaves its process waiting forever. Later selection or
activity reset reuses that frame/process and retained object state. Quitting does
not create a new transcript and does not clear history.

### Frame request queue

Network and Listener callers MUST NOT mutate the ZWEI interval concurrently. They
submit an `:enter-request`, which pushes one request under interrupt exclusion and
forces keyboard input. The post-command hook traverses the pushed list, removes each
request before execution, and executes it within the ZWEI command-loop catch.

Consequences which a strict implementation MUST preserve:

- the queue is LIFO, not FIFO;
- “queue empty” means every observed request has been claimed, not completed;
- a command-loop error is caught around the request body;
- a receive waits at most 1,000 ticks for the pending queue to become empty; and
- timeout produces a TV notification that a message is pending, even though an
  already dequeued request may still be executing.

The traversal follows the list chain captured at hook entry. A request PUSHed by a
running handler becomes a new live head outside that chain and is deferred. If A is
pushed then B and B pushes C, the current pass executes B then A and leaves C; the
next pass executes C. This differs from System 303's tail-extending FIFO traversal.

An implementation MAY replace this mechanism with a serialized actor or event loop
only if its observable claim/dequeue ordering and all races below remain selectable
under the strict profile.

## Converse commands and message semantics

### Parse and conversation validation

Sending from the editor first verifies structural reachability, locates the
conversation containing point, extracts the active `To:` region and body, parses at
least one address, and canonicalizes each host. A missing host triggers logged-in
user discovery; no match is an error, one match is selected directly, and several
matches open the transient host chooser specified below. An unknown explicit host,
empty recipient set, point outside a conversation, or damaged buffer MUST fail
before a network call.

### Ordered send transaction

For an editor send or one-shot send, strict behavior is:

1. Force a user login and canonicalize recipients.
2. If receiving is gagged, run the gag preflight query. If services are disabled,
   run the service preflight query.
3. Determine whether the text requires fat/styled transport.
4. Find a `:send` service path for every recipient and reject a missing path or a
   protocol unable to represent required text.
5. Find or create the conversation.
6. Insert a temporary outgoing record with a unique identity and a “being sent” or
   “being mailed” state.
7. For an editor send, restore the composer template, remove the submitted edit,
   move point to the selected append/prepend active position, and request redisplay.
8. Spawn the `Sending Message` process.
9. For mail, call the Zmail string sender and treat its ordinary return as success;
   for interactive send, invoke every recipient and collect per-recipient network
   errors. A user abort becomes the distinct `:sending-aborted` result.
10. If errors exist while Converse is hidden, issue a TV notification for list-form
    delivery failures.
11. Queue completion back into the Converse process.
12. Replace the matching temporary record when the original conversation still
    exists. If it was deleted meanwhile, find or recreate the matching conversation
    and add the final record there. When exposed, list-form errors also reach the
    typein error surface.

Preflight refusal is passed to the background path after the temporary record is
inserted, so a short-lived sending status remains source behavior. `:add-msg` pushes
its `oldmsgs` record before completing every structural check; a damaged buffer can
therefore retain a history mutation even though visible insertion fails. These are
historical partial effects, not recommended transaction design.

The mail branch deliberately cannot report ordinary Zmail failures through its
return value. A signaled condition during the body is protected by completion
cleanup; the selected ordering can queue a success-looking final status before the
background process condition is otherwise handled. That exact visible result is
`TODO-RUNTIME-CN-01`; `DM-G452-SRC` MUST retain the cleanup ordering, while an
explicit corrected mode MAY record an unknown/failure status instead.

### Incoming direct messages

The receiver rejects, in order, when no user is logged in, a private recipient does
not match the logged-in user, or Converse is gagged. A network-server property
notification bypasses all Converse histories and invokes `TV:NOTIFY` directly. That
early branch formats the sender, date, and body after trimming trailing Return and
Space characters. It does not inspect the `ENCRYPTED` property: a message carrying
both `NOTIFICATION YES` and `ENCRYPTED` still includes the body in the TV
notification. This source-visible disclosure is distinct from hidden-frame receive
mode dispatch below, where the catch-all branch suppresses an encrypted body.

For a normal accepted message, processing MUST first push saved-send state and set
the last-recipient/identity registers, then find the Converse frame and enqueue
visible insertion. The queued operation finds or creates the conversation, adds an
incoming record, and requests redisplay. If the selected, visible editor point is
inside a partial unsent composer, point stays there; otherwise it moves to the
conversation's reply position selected by append mode.

The exact hidden-frame receive-mode value classes are:

| Value class | Hidden-frame behavior |
| --- | --- |
| `:AUTO` | Mouse-select Converse and process the queued message |
| `:NOTIFY` | Retain the message and issue a sender-only TV notification |
| `:POP-UP` | Serialize the incoming-message popup inside the Converse process |
| Every other value, including `:NOTIFY-WITH-MESSAGE` and unrecognized “garbage” | Retain the message; issue a sender-and-body notification for ordinary text, but a sender-only encrypted-message notice when `ENCRYPTED` is non-NIL |

The selected-source defaults are `:POP-UP` receive mode, NIL prepend mode, two
beeps, NIL End-exits policy, and no gag. Thus a fresh source-profile frame prepends
new records and End sends/remains while Control-End sends/buries.

Obsolete option variables are translated once on the next receive and then cleared
or normalized. The direct Converse beep count runs immediately only when the frame
is visible or the mode is `:AUTO`/`:POP-UP`; notification modes rely on the TV
notification route. Receive-mode dispatch is intentionally not an enum validator:
an unknown value reaches the same catch-all behavior as `:NOTIFY-WITH-MESSAGE` and
does not signal a protocol error.

### One-shot sends, replies, and saved receives

| Entry | Required behavior |
| --- | --- |
| `(QSEND)` | Select Converse |
| `(QSEND destination)` | Quote the macro argument, canonicalize it, and read one `message-string` until End or Control-End |
| `(QSEND destination message)` | Quote both macro arguments and enqueue a one-shot send |
| `QSEND-MSG` | Function-level dispatcher used by the macro; catches editor-style parse errors for display |
| `QREPLY [message]` | Snapshot last recipients and identity, error if no recipients, and send with that identity |
| `PRINT-SENDS [stream]` | Reverse saved incoming pairs, print bodies from oldest to newest, and return NIL |
| `QSENDS-OFF [reason]` / `QSENDS-ON` | Set or clear the receive gag used by server rejection and send preflight |

“Saved sends” MUST NOT be implemented as an outgoing queue: it contains received
non-notification bodies. One-shot sends still produce Converse temporary and final
records through the frame request queue.

## Complete Converse input-binding inventory

### Lookup and denominator

`Select C` is the TV activity-selection entry for the frame, not a cell in the
Converse editor comtab. `(QSEND)` reaches the same frame by function entry. These
entry routes are tested separately from the following in-frame denominator.

The application contributes exactly 12 direct fixed cells: eleven in its initial
table plus the later `C-X` prefix cell. It contributes five local `C-X` leaves and
11 named-command strings resolving to ten unique command functions. Its local
overlay is:

```text
Converse input
├─ transient reader or popup active -> that context's tree below
├─ local Converse direct cell
│  ├─ command -> execute locally
│  ├─ C-X -> Converse C-X, then inherited Standard C-X
│  └─ :UNDEFINED -> terminal not-defined error
├─ inherited Standard ZWEI direct tree
├─ active Text-mode and editor presentation overlays incorporated above
└─ exhausted -> editor not-defined error
```

A `NIL` local lookup falls through. A local `:UNDEFINED` does not. The incorporated
Genera editor lookup, alias, prefix, numeric, pointer, and failure trees are
normative for every inherited leaf; referring to them as “normal editor keys”
without preserving their exact path is nonconforming.

### Direct fixed cells

| Exact key | Command | Ordered effect | Numeric/repeat behavior |
| --- | --- | --- | --- |
| End | Converse Send | Run the send transaction; remain when `*CONVERSE-END-EXITS*` is false, otherwise bury | Does not explicitly consume numeric argument; one command per dispatch |
| Control-End | Converse Send | Same transaction; bury policy is the complement of End | Same |
| Abort | Converse Abort | Bury frame; retained state remains | Does not inspect the numeric argument; executes once |
| Help | Converse Help | Print local Converse explanation directly | Shadows the standard Help dispatcher; argument not consumed |
| Control-Meta-`[` | Previous Conversation | Validate structure; move to current/previous active composer or beep at top | Argument not consumed; no counted repeat |
| Control-Meta-`]` | Next Conversation | Validate structure; move to current/next active composer or beep at bottom | Argument not consumed; no counted repeat |
| Control-M | Mail Current Message | Run the same transaction with the Zmail mail path | Argument not consumed |
| Meta-Q | Converse Fill Paragraph | Fill the current/next paragraph while preserving point; a positive supplied numeric argument requests adjustment instead | This is the only local command that reads numeric state |
| Control-X | Converse Control-X prefix | Read one child through the local-plus-Standard prefix chain | Numeric state follows incorporated ZWEI prefix rules |
| Control-Z | hard undefined | Stop lookup and report not defined | Never inherits |
| Meta-Z | hard undefined | Stop lookup and report not defined | Never inherits |
| Control-Meta-Z | hard undefined | Stop lookup and report not defined | Never inherits |

There is no application-local automatic repeat wrapper. ZWEI numeric state remains
dynamically visible to a command: Meta-Q inspects it, `C-X` carries it into the child
lookup, and every other terminal local direct command ignores it and executes once.
Repeated physical input repeats dispatch only through the TV/editor mechanism; it
is not a counted Converse operation unless an inherited command says so.

### Complete local `C-X` subtree

```text
C-X
├─ 1 -> One Window
├─ 2 -> Two Windows
├─ 3 -> View Two Windows
├─ ^ -> Grow Window
├─ O -> Other Window
├─ Help -> inherited Standard C-X prefix documentation
├─ Abort -> inherited Standard C-X abort
├─ C-G -> inherited Standard C-X failure/keyboard-macro termination
└─ every other child -> exact Standard C-X lookup incorporated from D05/G85
   ├─ inherited command or alias
   ├─ inherited hard undefined
   └─ exhausted -> prefix not-defined error
```

The five listed local leaves shadow same-key Standard leaves. The prefix table has
Standard C-X as its parent, so an absent child MUST NOT be reported unbound until
that complete parent is exhausted. The frame also points its mode `C-X` indirection
at this Converse prefix, preventing Text mode from bypassing it.

### Complete local named-command table

| Exact command name | Effect |
| --- | --- |
| Regenerate Buffer | Rebuild the structural buffer from retained object history; unsent edits are not recoverable |
| Delete Conversation | Delete the current named conversation, its visible interval, and its retained records |
| Write Buffer | Prompt for a path and replace/write the entire buffer |
| Write Conversation | Prompt for a path and replace/write only the current named conversation |
| Append Buffer | Preserve existing file content when readable, then append the entire buffer; create when missing |
| Append Conversation | Preserve existing file content when readable, then append the current named conversation |
| Compile File | Prompt for a Lisp source path, compile it, and report completion; when any numeric argument is present, also prompt for the binary output path |
| Load File | Prompt for a path using the current default/type rules, bind output to the typein window, load it, and report completion |
| Hardcopy Buffer | Submit the entire interval to hardcopy with title `Converse` |
| Bug | Prompt for a system, force login, and start the bug-report mail path |
| Report Bug | Exact alias of `Bug`, resolving to the same function |

The two encryption rows visible only as source comments are not installed commands
and MUST NOT be counted. The local denominator is 11 names/10 functions. Named
completion also sees inherited editor candidates according to the incorporated
Zmacs tree; a conforming dump MUST retain table provenance and duplicate-name
shadowing.

Of the 11 local names, only `Compile File` explicitly tests numeric-argument
presence; the value itself is not used, and any present value selects the extra
output-path prompt. The other local named command bodies do not implement counted
repeat. Inherited candidates retain their own numeric policies.

### Help, unbound, and shadowing behavior

The local Help command is not the standard multi-stage Help dispatcher. It shadows
that entire tree in the main Converse context and prints a fixed explanation. It
omits Meta-Q, the five local `C-X` leaves, all three hard-undefined keys,
Compile File, Load File, Hardcopy Buffer, and the Bug/Report Bug alias pair. Help is
therefore useful but not an exhaustive binding inventory.

In an inherited child context where local Help is absent, the complete standard
Help dispatcher incorporated above remains normative. An unknown direct key follows
Standard ZWEI and mode lookup; only exhaustion reports not defined. Hard-undefined
keys report the same terminal class without consulting a parent. A command symbol
without an implementation remains a distinct not-implemented error.

### Main editor pointer and presentation tree

Converse defines no application-local mouse comtab, output presentation translator,
or pointer menu. Over editor content, the complete Genera Zmacs pointer and Dynamic
Windows presentation tree is normatively incorporated. Structural diagrams support
editor copying through their ZWEI representation; this does not create a new
application gesture. Blank text, buffer text, diagram, mode-line, and margin hits
MUST remain distinct contexts.

The margin component receives a margin hit before editor-content dispatch. For the
default vertical left scroll bar, the source-visible logical cells are:

| Hit portion | Exact pointer | Required call-level effect |
| --- | --- | --- |
| Start box | Mouse-L | Vertical `scroll-to +1 :relative-jump` |
| Start box | Mouse-R | Vertical `scroll-to -1 :relative-jump` |
| Start box | Mouse-M | Absolute minimum scroll position |
| Middle shaft | Mouse-L | Scroll relative from pointer position to top |
| Middle shaft | Mouse-R | Scroll relative from top to pointer position |
| Middle shaft | Shift-Mouse-L | Scroll relative from pointer position to bottom |
| Middle shaft | Shift-Mouse-R | Scroll relative from bottom to pointer position; source notes the physical gesture may be unavailable |
| Middle shaft | Mouse-M | Make the proportional position the viewport top |
| End box | Mouse-L | Scroll one screen relation from bottom to top |
| End box | Mouse-R | Reverse that screen relation |
| End box | Shift-Mouse-L | Invoke the source's bottom-to-bottom relative path, then enter shifted auto-repeat if enabled |
| End box | Shift-Mouse-R | Invoke the source's bottom-to-bottom relative path, then enter the opposite shifted auto-repeat if physically produced |
| End box | Mouse-M | Absolute maximum scroll position |

That is 13 handled component cells. Start-box shifted Left/Right, shifted Middle,
modified combinations not listed, and non-mouse characters have no scroll-bar
handler. The horizontal top/bottom variant substitutes X/left/right for
Y/top/bottom; Converse and Notifications use the default vertical form in the
selected world.

When global scroll-bar auto-repeat is enabled, holding an accepted Left/Right cell
waits the configured initial delay and repeats until all buttons are released.
Pressing the opposite button reverses direction. Screenful regions use a fixed
screen interval; line regions derive rate from pointer position, with configured
minimum/maximum rates, and synchronize ZWEI repeats with input/redisplay waits.
Middle-button absolute motion returns before auto-repeat. A conforming
implementation MUST preserve these distinctions and MUST export the logical
Shift-Mouse-R cells even on hardware that cannot generate one.

## Complete transient Converse input contexts

### Gag and service preflight FQUERY trees

The gag query runs before the service query. Each has exactly five local key cells
and three semantic choices:

| Context | Exact keys | Choice/result |
| --- | --- | --- |
| Receiving gag | `Y`, Space | Yes; continue without changing gag |
| Receiving gag | `N`, Rubout | No; return `:receiving-disabled` |
| Receiving gag | `E` | Enable receiving, clear gag, and continue |
| Services disabled | `Y`, Space | Yes; continue without globally enabling |
| Services disabled | `N`, Rubout | No; return `:services-disabled` |
| Services disabled | `E` | Enable Converse/SEND services and continue |

FQUERY adds its normative common context: Help describes the choices; exact
unmodified Select/Mouse-L on a presented choice returns that semantic object;
invalid keyboard input beeps, lists or re-prompts according to query options, and
does not select a default; Dynamic Windows scrolling may intercept scroll keys;
Abort follows the enclosing query/command abort path. The local denominator is ten
registered key cells and six displayed semantic-choice instances across the two
queries. FQUERY compares registered choice keys with `SI:MEM-CHAR`/`CHAR-EQUAL`, so
each registered letter also accepts its opposite case. Each five-cell preflight map
therefore has eight effective character values: `Y/y`, Space, `N/n`, Rubout, and
`E/e`. The two preflights together have 16 effective values.

### Incoming-message popup trees

The temporary window is 400 pixels high, labelled `Incoming Message`, and operated
through `TV:WINDOW-MOUSE-CALL`; it is always deactivated and the prior activity is
restored after the call. It defines no local pointer comtab beyond FQUERY choices.

Encrypted text first enters this four-cell tree:

```text
Encrypted action
├─ D/d -> decrypt in the popup, then continue to ordinary action
├─ C/c -> select Converse after popup cleanup
├─ N/n -> do nothing and close
└─ Rubout -> do nothing and close
```

Visible or successfully decrypted text then enters this seven-cell tree:

```text
Ordinary action
├─ R/r | Space | T/t | Y/y -> verify recipients and open one-shot reply input
├─ C/c -> select Converse after popup cleanup
├─ N/n | Rubout -> do nothing and close
└─ failed reply -> display the error and read one arbitrary acknowledgement input
```

Each tree has three semantic choices presented through FQUERY, so exact unmodified
Select/Mouse-L can also choose one. With both preflight queries, the application
provides exactly `5 + 5 + 4 + 7 = 21` registered transient key cells and
`8 + 8 + 7 + 12 = 35` effective character values after case folding. It displays
`3 + 3 + 3 + 3 = 12` semantic-choice instances. Generic FQUERY Help, pointer,
abort, scroll, and invalid-input branches are additional inherited context paths,
not local choice cells. A conformance dump MUST preserve both the registered-cell
and effective-value denominators rather than counting lowercase aliases as new
source registrations.

### Ambiguous-user host chooser

When several Lisp Machines report the unqualified recipient as logged in, Converse
builds one TV momentary-menu row per result. Each row contains the host plus available
identity, idle, and location details. There is no local keyboard-sensitive menu
mixin. On a current highlighted row, the base menu handler ignores the complete
button descriptor; Left, Middle, and Right therefore select the same host under all
32 modifier states. Moving out/deexposure returns NIL.

For a fixture with `N` rows, there are `3N` accepted normalized primary-button
operations. The single-primary raw subset contains `96N` selecting tuples (`N` rows
by three buttons by 32 modifier states). Because the complete button descriptor is
ignored, every nonzero button mask also selects: Left, Middle, Right, Left+Middle,
Left+Right, Middle+Right, and Left+Middle+Right. The full raw denominator is therefore
`224N` selecting tuples (`N` rows by seven nonzero masks by 32 modifier states), all
mapping to the same row value. Conformance MUST choose and report `N`, all three
denominators, and the rejected outside/deexposure complement rather than call this an
unbounded inventory.

### One-shot message and address readers

The custom `message-string` presentation type expands to string and owns a separate
history so long message bodies do not pollute ordinary string history. Its two local
activation leaves are exactly End and Control-End; both accept the current body.
The encompassing Input Editor provides its complete correction, movement, deletion,
history, Help, Abort, pointer, and unbound behavior through the normative companions.

Recipient correction uses generic `SCL:ACCEPT` of string with no local accelerator
additions. A parse/canonicalization error beeps, prints the error, and re-enters that
reader. `TODO-RUNTIME-CN-02` remains for a live dump proving every world-installed
Input Editor override; source-profile conformance uses the selected-source parent
tree.

## Command Processor Conversation area

### Area and invocation tree

The `Conversation` command subset is a child of `Communication`; the selected
Communication subset contributes no direct command. Conversation contributes
exactly two commands and no fixed keyboard accelerator, prefix, or menu accelerator:

```text
Command Processor input
├─ typed/completed command name or eligible command presentation
│  ├─ Send Message
│  └─ Show Messages
├─ common CP command/menu/presentation paths incorporated from D28
└─ unknown/ambiguous name -> CP correction and completion, never arbitrary choice
```

`Send Message` takes one required `(sequence address)` positional argument, prompts
as recipient, defaults from the last-recipient register, forces login,
canonicalizes, then enters QSend message input and asynchronous send. It explicitly
suppresses the common Output Destination keyword. Parse/editor errors are rendered
on the error stream rather than partially sending.

### Complete `Show Messages` keyword surface

The command has exactly ten specialized keywords, plus common Command Processor
output/pagination processing inherited from D28:

| Keyword | Type/default | Required semantics |
| --- | --- | --- |
| Direction | member Incoming/Outgoing/All/Default; Default | Explicit selection, otherwise derive from From/To and people presence |
| From | sequence of addresses; empty | Select conversations matching any From address and default toward incoming |
| Recent | boolean; false, mentioned true | Keep only the newest contiguous exchange-direction sequence |
| Mention Empty Sequences | Yes/No/Default; Default, mentioned true | Default true for From, To, or Summarize; otherwise false |
| Order | Forward/Reverse; Forward | Apply the source order transform after recent-direction filtering |
| Query | Yes/No/Default; Default, mentioned true | Default false when From, To, or Recent is supplied; otherwise true |
| Start | integer at least 1; 1 | First one-based selected message |
| To | sequence of addresses; empty | Select conversations matching any To address and default toward outgoing |
| Stop | integer at least 0; absent | Exclusive subsequence endpoint corresponding to inclusive one-based display number |
| Summarize | boolean; false, mentioned true | Mention conversation/range without bodies unless Query forces it false |

Before those filters, source traversal is global and ordered:

1. visit `TV:ALL-THE-SCREENS` in list order;
2. visit each screen's direct `:INFERIORS` in returned order, without recursion;
3. select every direct inferior of type `ZWEI:CONVERSE-FRAME`, with no selected-frame
   restriction or deduplication; and
4. visit each selected frame's `*CONVERSE-LIST*` in list order.

The source wraps every mention, query, and output operation in a non-NIL-recipient
guard. The headerless composer, and any other conversation whose `:RECIPIENTS` is
NIL, is therefore silent even when Mention Empty Sequences resolves true.

Precedence is normative:

1. concatenate From and To as the person filter;
2. resolve Query and Mention Empty defaults;
3. if Query is true, force Summarize false;
4. derive incoming/outgoing flags from explicit Direction, or choose incoming when
   there are no people, otherwise From drives incoming and To drives outgoing;
5. keep conversations where any filter address matches any recipient by name and,
   when supplied, host;
6. normalize `oldmsgs` relative to the conversation's captured append mode;
7. apply Recent as the newest contiguous exchange sequence;
8. apply Order and then Start/Stop subsequence selection; and
9. optionally query per nonempty conversation, then print descriptors and bodies or
   summaries.

The per-conversation yes/no query registers `Y`, `T`, or Space for yes and `N` or
Rubout for no, with generic FQUERY Help and exact unmodified presented-choice
selection. Character-equal matching also accepts lowercase `y`, `t`, and `n`, so
the five registered cells yield eight effective character values. This tree is
conditionally reachable only when Query resolves true.

The selected source's Forward result is oldest-first when append mode is NIL (the
default) and newest-first when append mode is true. That contradicts installed Help
and MUST remain selectable in strict mode. A Stop below Start can reach an invalid
subsequence edge for some combinations; strict mode MUST report the source failure,
while an explicit corrected mode MAY reject the range during argument validation.

## Direct-message service adapters

### Path selection and per-recipient failure

`SEND-MSG` visits recipients in request order. For each host it asks for a `:send`
path with automatic retry enabled and collects `(network-error, recipient)` for
failures. `:CONVERSE`, Chaos `:SEND`, and SMTP can satisfy the service. Styled/fat
text is allowed only on selected Converse or SMTP paths at preflight.

If a remote Converse endpoint rejects `CHARACTER-TYPE-MAPPINGS`, the sender strips
style and performs one new generic `NET:INVOKE-SERVICE-ON-HOST :SEND` invocation.
The selected `STRING-SEARCH` predicate is case-insensitive, so case variants of that
property name trigger the same branch. The generic invocation permits automatic path
reselection; it neither pins legacy SEND nor promises reuse of the path that produced
the error.

The source wraps that invocation in `PROG1`: thinning and the complete second send
run first, and only a normal return from that send emits the warning that style was
removed. If thinning would lose nonrepresentable characters, it raises a new remote
Converse error before invoking a second path and emits no warning. If the retry
itself signals, its failure propagates and likewise skips the warning. Ordinary
nonmatching errors MUST NOT trigger thinning, retry, or warning.

### CONVERSE byte-stream grammar

The outbound grammar and phase ordering are:

```text
DATE <formatted-time> CR
FROM <address> CR
TO <address> CR
ALSO <address> CR                 ; zero or more
IDENT <text> CR                   ; optional
PRIVATE YES CR                    ; optional
ENCRYPTED <keyword> CR            ; optional
NOTIFICATION YES CR              ; optional
CHARACTER-TYPE-MAPPINGS <forms> CR ; optional styled text
FONTS <comma-separated-fonts> CR   ; paired with mappings when emitted
CR
force-output
read first response
body bytes
EOF
read second response
abort-close stream
```

`DATE`, `FROM`, and `TO` are emitted first in that order. `ALSO` preserves recipient
iteration order after excluding the selected `TO`. Style headers follow other
optional properties. The first response grants or refuses body transmission; the
second confirms delivery processing.

Response interpretation is exact: first character `+` succeeds; `-` raises a remote
error from the remainder; `%` issues a warning notification and continues; any other
first character raises a remote error containing the whole line. An empty response
line reaches an indexing failure in strict source behavior and MUST NOT be silently
treated as success.

The server accepts exactly ten property names: `DATE`, `FROM`, `TO`, `ALSO`,
`IDENT`, `PRIVATE`, `ENCRYPTED`, `NOTIFICATION`, `CHARACTER-TYPE-MAPPINGS`, and
`FONTS`. An unknown property or parse failure returns a `-` syntax response. A
network failure while reading headers returns silently. Repeated `ALSO` lines are
reversed back into input order. Every normally singleton property may also repeat;
the last parsed value wins rather than producing a cardinality error. An empty
parsed `CHARACTER-TYPE-MAPPINGS` sequence is accepted as empty/NIL.

Property-name lexing splits at the first Space, uppercases only the name substring,
and interns it in the keyword package. Upper-, lower-, and mixed-case property names
therefore select the same ten keys. A nonblank property line with no Space fails the
key/value split and follows the syntax-error response path. This name normalization
does not imply one uniform rule for property values: each property's parser above
governs its own value case and syntax.

Zero occurrences of `DATE`, `FROM`, or `TO` are not rejected by a required-field
validator; they flow into different downstream operations and MUST NOT be described
as uniformly optional:

- Missing `DATE` is the only explicit clean default. After the first response and
  immediately before body construction, it becomes the current universal time.
- Missing `TO` remains NIL. In the ordinary logged-in, nonprivate, ungagged case,
  Zetalisp `STRING-EQUAL` coerces that NIL symbol to its print name, so a normal user
  ID compares unequal and the server sends the `%` “deliver to logged-in user”
  response. Body construction then emits a `To: NIL` line and continues. A private
  message instead compares the logged-in name with an explicit empty-string fallback
  and is normally rejected before the body. The degenerate user ID `NIL` follows the
  literal case-insensitive comparison and therefore does not take the ordinary `%`
  branch.
- Missing `FROM` acquires only the connection host property during claimed-host
  normalization; it still has no user/name field, so address rendering returns NIL.
  A property notification formats that NIL as the visible sender and completes
  synchronously. A normal direct message first mutates saved-send/reply state and is
  queued. An existing identity or exceptional matching recipient set can let the
  queued message use an existing conversation. Otherwise new-conversation header
  construction passes the NIL address rendering to `CL:WRITE-STRING`, raises a
  string-type error after partial editor-structure mutation, and does not append the
  new conversation object to the conversation list. Because the request is claimed
  before execution, the network server can still reach its final delivery response;
  the exact loaded-world condition presentation is `TODO-RUNTIME-CN-10`.

For a logged-in, nonprivate, ungagged fixture whose user ID is not `NIL`, whose
present `TO` equals that ID, whose present `FROM` is valid, and which has no matching
identity or recipient set, the complete presence matrix is:

| `DATE` | `FROM` | `TO` | Strict path |
| --- | --- | --- | --- |
| present | present | present | Ordinary two-response processing |
| missing | present | present | Ordinary processing after current-time default |
| present | missing | present | First response proceeds; normal queued insertion reaches missing-address failure |
| present | present | missing | `%` first response, `To: NIL`, then ordinary processing |
| missing | missing | present | Current-time default plus missing-address queued failure |
| missing | present | missing | Current-time default plus `%`/`To: NIL`, then ordinary processing |
| present | missing | missing | `%`/`To: NIL`, then missing-address queued failure |
| missing | missing | missing | Current-time default plus `%`/`To: NIL`, then missing-address queued failure |

No row licenses a reimplementation to add an unstated parser-level cardinality
check. Private, no-login, gagged, property-notification, and existing-identity
fixtures override the downstream portions only in the explicitly ordered ways above.

After parsing, the server rejects no-login/private/gag with `-`; a nonprivate `TO`
mismatch warns with `%` that delivery will use the logged-in user; otherwise it
responds `+` to request the body. It records a claimed-host mismatch in the body,
adds non-notification sender/date and optional recipient headers, decodes style when
possible, invokes incoming processing, and responds `+` for delivered processing.
Errors while flushing the final response are ignored.

### Chaos SEND and SMTP

The legacy Chaos `SEND` path transmits a thin sender/time line, optional `Also-to`,
and thin body. Its server may reject before accepting; after accept it derives the
sender from the first line, captures the body, submits a normal incoming message,
and adds a compatibility service path when needed. It carries less identity and
style information than CONVERSE.

SMTP is a service adapter, not the Converse interactive protocol. It may carry
styled mappings or fall back according to its own mail encoding. The editor's
Control-M mail command uses Zmail string sending and the limited error reporting
already specified.

## Host-level NOTIFY service

The exact public functional surface is:

| Entry | Required behavior |
| --- | --- |
| `NET:NOTIFY` | Send one thin host notice |
| `NET:NOTIFY-HOSTS` | Select a best path per host, invoke in parallel with a ten-second multi-host timeout, return nonresponders, optionally report each host |
| `NET:NOTIFY-LOCAL-LISPMS` | Resolve the local site's Lisp Machines and call multi-host notify |
| `NET:NOTIFY-LISPMS-AT-SITE` | Resolve one or more explicit sites and call multi-host notify |
| obsolete Chaos aliases | Delegate to local-site notify while preserving compatibility naming |

When no body argument is supplied, the sender invokes the same two-leaf
`message-string` input described above. The wire message is thin and limited to one
Chaos packet. With error reporting enabled, an
overlong notice offers a continuable truncation error; without it, truncation is
automatic. This implementation performs explicit per-host fan-out, not one network
broadcast packet. No Genera `SHOUT` operation was found in the selected
Converse/notification source set; a reconstruction MUST NOT invent one here.

The receiver accepts only trusted requests. It suppresses a notice only when the
same resolved host, same packet length, and `STRING-EQUAL` content recur within 600
ticks (ten seconds). `STRING-EQUAL` makes the content comparison case-insensitive:
same-host payloads differing only as `A` versus `a` suppress. Suppression does not
refresh the stored timestamp. An unknown host cannot satisfy the same-host gate.
This is distinct from the System 303 rule, which compares only the immediately prior
case-insensitively equal text and has no host or elapsed-time scope. A body already
beginning with a sender-style prefix and delimiter is retained; otherwise the
receiver prefixes the host. It then calls `TV:NOTIFY`, marks the host available, and
returns its completion response.

Fresh filter state is an allocated 1,500-character buffer, zero packet length, zero
packet tick, and NIL host. A successfully accepted nonduplicate first assigns the
new tick, resolved host, and length in that order, then copies the payload into the
retained buffer. A suppressed duplicate changes none of the four fields and does not
refresh the window. The selected source registers no reset for this tuple.

The update and delivery are not transactional. A buffer-copy failure leaves the new
scalar tuple plus whatever old/new byte prefix the failed copy produced. After a
complete cache update, `TV:NOTIFY` runs before the resolved host is marked available;
only then can the server return `Done`. A TV failure therefore leaves the duplicate
cache committed without central-history delivery, and a later host-mark failure
leaves both cache and central history committed without acknowledgement. Strict
tests MUST inject each boundary; reset extensions or rollback MUST be labelled.

## Central notification delivery semantics

### Selected-stream handshake

For each oldest pending record, a selected stream follows this exact state machine:

```text
mode :ALWAYS-IGNORE -> handled immediately
mode :ALWAYS-POP-UP -> skip stream and request fallback
otherwise
├─ missing notification cell -> fallback
├─ compare-and-store loses because cell occupied -> fallback
└─ store record; wake selected process; wait 180 ticks
   ├─ cell consumed/NIL -> handled
   └─ timeout
      ├─ CAS reclaims record
      │  ├─ mode :IGNORE -> handled
      │  ├─ mode :BLAST -> asynchronous stream display, handled
      │  ├─ mode NIL or :POP-UP -> fallback
      │  └─ other mode -> notification-protocol error
      ├─ late consumer changed cell to NIL -> handled
      └─ alien remaining value -> notification-protocol error
```

The compare-and-store and late-consumer branches prevent a timeout race from
delivering the same record twice through ordinary fallback. A reimplementation MUST
distinguish a missing cell, occupied cell, consumed record, reclaimed record, and
protocol-corrupt cell.

### Console loop, fallback, and remote terminals

The central process waits up to 1,200 ticks (twenty seconds) for a selected
window/screen and for a fallback popup to become selected. It throttles successive
successful fallback popups by 600 ticks **per console**, using the process-local
console-to-time alist. A popup on console A does not throttle console B. An adjacent
source comment says five seconds, but executable timing is ten seconds at 60 ticks
per second; strict behavior uses ten. The global last-notification tick is updated
for other notification bookkeeping and MUST NOT be substituted for this per-console
throttle state.

On successful console delivery, the process advances the cursor before delivering
to remote terminals. Each remote terminal gets the same selected-stream offer and,
if not accepted, asynchronous stream output; individual blast errors are ignored.
Thus a remote failure does not put the console record back into the pending queue.

If fallback cannot deliver, the source recursively creates a system-failure
notification and advances the cursor to the newest history head, potentially
skipping older queued records. `DM-G452-SRC` MUST preserve this edge for comparison.
The main specification's `G452-POPUP-FAILURE-TAIL` correction MAY isolate the failure
record and continue older FIFO delivery, but MUST label the divergence. If no
console is available, the 3600 build target and selected native IMACH cases print to
Cold Load and record delivery; other targets sleep for the popup-delay interval and
retry. Here “3600” names a platform feature, not a tick count.

Notification initialization has two independently testable registrations:

1. `:BEFORE-COLD` sets history and the delivery-tail pointer to NIL. It leaves the
   exact TV last-notification tick and current process identity untouched.
2. A distinct `:ONCE` action calls the process initializer. It kills a non-NIL prior
   process, sets the slot to NIL, allocates a priority-five system process into the
   slot, enables `:NO-KBD-ARREST`, presets the notification delivery top level, and
   enables the process. It leaves history, delivery-tail identity, and TV last tick
   untouched. This specification does not equate `:ONCE` with every cold operation.

Process recreation is nontransactional. Failure after any step preserves preceding
effects: allocation failure can leave a NIL slot and no process; later setup failure
can leave a referenced but only partly configured process. No selected rollback is
present. Strict phase tests MUST seed all state sentinels and inject every process
setup boundary.

### Notification popup input tree

The reusable popup is 400 pixels high. Its input behavior is temporal:

```text
selected at t0
├─ at any time: mouse-button blip + window of interest
│  -> deactivate popup and mouse-select that window
├─ at any time: mouse/list blip without that match -> ignore; popup remains
├─ first 180 ticks
│  ├─ Abort -> force popup down through the window's abort path
│  ├─ ordinary character + prior input buffer -> forward there; popup remains
│  └─ ordinary character + no prior input buffer -> ignore; popup remains
└─ after 180 ticks
   ├─ Help -> clear popup and show local Help; remain until next non-Help input
   ├─ any other ordinary character -> dismiss
   └─ manual deselect -> close
```

A new record displayed in the active popup appends to its output, refreshes the
dismissal prompt, and resets the fifteen-minute inactivity deadline. It does not
reset the original three-second selected-at time. The three-second and ten-second
timings remain `TODO-RUNTIME-CN-03`; they are source-profile requirements, not claims
from the current screenshot.

### `PRINT-NOTIFICATIONS`

The newest record is index zero. The printer clamps From at zero, converts a negative
To to its absolute value, swaps endpoints when From exceeds To, clips the high end,
and prints the resulting range newest first. When the printed range contains the
pending cursor, the exact mechanism is list-tail based: `range` is `(nthcdr From
history)`, while `To` controls only the print count. If the current delivery cursor
is a tail of `range`, the function updates the TV last-notification tick and assigns
the cursor to `range` itself. It does not assign the tail after the printed subset.
Consequently `From=0, To=0` can move the cursor to the history head and mark other
unprinted pending records delivered. This identity/predicate/assignment side effect
MUST be testable separately from formatting.

## Notifications activity state and output

The notification pane uses `:notification-mode :IGNORE`. That prevents fallback
popup delivery into the viewer; it does not suppress history. The activity keeps a
list-head cache. The framework also declares a `last-notification-time` state
variable initialized to zero, but the selected activity file never reads or writes
it; a port MUST NOT silently make that unused slot control refresh. On first display
the activity snapshots all history and renders the reversed snapshot in
chronological order. On later wake or polling, it walks the newest-first history to
the old head, reverses only the new batch, and appends oldest to newest. If history
changes during display, it recurses until cache and history heads agree.

The source polling interval is one tick-unit expression. The notification cell and
head-identity comparison can also wake the loop. Queries route to the typeout overlay
rather than the viewer pane. Abort deselects and buries the frame but its handler
returns NIL so enclosing abort handlers may continue.

## Complete Notifications activity input inventory

### Effective keyboard denominator and precedence

`Select N` is the framework's global activity-selection key. The
`DISPLAY-NOTIFICATIONS` function executes the system Select Activity command for
`Notifications`. Neither route is an idle command-table cell, so neither is included
in the 70-cell in-frame denominator below.

The program inherits `Standard Arguments` and `Input Editor Compatibility`; the
latter inherits `Standard Scrolling` and `Marked Text`. There are no collisions
between the selected fixed inherited cells and the four local cells. The complete
source-profile denominator is:

| Table owner | Fixed effective cells |
| --- | ---: |
| Standard Arguments | 37 |
| Standard Scrolling | 18 |
| Marked Text | 5 |
| Input Editor Compatibility direct | 6 |
| Notifications local | 4 |
| **Total** | **70** |

Lookup checks the local Notifications table, then its two named parents in their
configured inheritance, then terminates in the Command Processor unknown-accelerator
path. There is no Colon Full Command or Unshifted Arguments parent in this program.

### Four local fixed cells

| Exact key | Effect | Numeric policy |
| --- | --- | --- |
| Help | Show activity-specific Help in typeout | Disallowed |
| `?` | Same Help command | Disallowed |
| End | Deselect and bury Notifications | Disallowed |
| Abort | Same Exit command; outer abort handling may continue | Disallowed |

### Thirty-seven Standard Arguments cells and staged tree

The exact generated cells are:

- `C-0` through `C-9`, `M-0` through `M-9`, and `C-M-0` through `C-M-9`
  (30 cells);
- `C--`, `M--`, and `C-M--` (three cells);
- the Control, Meta, and Control-Meta variants of the implementation's special
  infinity-argument base character, represented by source octet `016` (three cells);
  and
- `C-U` (one cell).

```text
idle
├─ C-U -> argument 4
│  └─ repeated C-U -> multiply by four each time
├─ modified minus -> negative-sign state
├─ modified digit -> signed decimal accumulation
├─ modified infinity character -> signed infinity state
└─ next accelerator
   ├─ argument-aware scrolling leaf -> consume argument
   ├─ Input Editor Compatibility no-op -> accept and ignore argument
   ├─ another argument cell -> continue
   └─ local, marked-text, Refresh, Help, Exit, or unknown disallowing leaf
      -> accelerator error; do not execute leaf
```

Unmodified digits, minus, and infinity are not effective argument cells because the
program does not inherit Unshifted Arguments.

### Eighteen Standard Scrolling cells

| Exact key cell(s) | Effect | Numeric policy |
| --- | --- | --- |
| Scroll | Vertical forward | none/sign-only: one screen; finite digits: lines; infinity: end |
| Meta-Scroll; Back-Scroll | Vertical backward | none/sign-only: one screen; otherwise lines |
| Meta-`<`; Home | Beginning | Disallowed |
| Meta-`>` | End | Disallowed |
| Super-Scroll | Horizontal forward | none/sign-only: one screen; finite digits: columns; infinity: end |
| Meta-Super-Scroll; Super-Back-Scroll | Horizontal backward | none/sign-only: one screen; otherwise columns |
| Control-Scroll | Typeout vertical forward | none/sign-only: one screen; finite digits: lines; infinity: end |
| Control-Meta-Scroll; Control-Back-Scroll | Typeout vertical backward | none/sign-only: one screen; otherwise lines |
| Control-Meta-S | Read one further semantic character and save this window/viewport under it | Disallowed before the second-stage character read |
| Control-Meta-R | Read one further semantic character and restore a position saved for this same window | Disallowed; missing/mismatched register is command error |
| Control-S; Super-S | Search displayed strings forward | Disallowed |
| Control-R; Super-R | Search displayed strings backward | Disallowed |

The table has 18 physical/logical key cells even though several rows share commands.
Save and Restore each form a two-stage prefix-like tree with every semantic character
as a possible register; the child is data, not another command-table lookup.

### Five Marked Text and six compatibility cells

| Owner | Exact key | Effect |
| --- | --- | --- |
| Marked Text | Super-W; Meta-W | Push marked text to the kill ring |
| Marked Text | Keyboard Cut | Cut marked text through the TV marking protocol |
| Marked Text | Keyboard Copy | Copy marked text through the TV marking protocol |
| Marked Text | Super-G | Clear marked text |
| Input Editor Compatibility | Return | No operation |
| Input Editor Compatibility | Space | No operation |
| Input Editor Compatibility | Clear-Input | No operation |
| Input Editor Compatibility | Rubout | No operation |
| Input Editor Compatibility | Tab | No operation |
| Input Editor Compatibility | Refresh | Refresh/redisplay the program |

The five no-op cells are deliberately bound and are not unbound fallthrough. Their
accelerator generator has a nonempty two-argument lambda list, so the command-reader
macro derives `:ARGUMENT-ALLOWED T`: a numeric prefix is accepted and ignored, and
the cell remains a no-op. Marked-text cells and Refresh use empty accelerator lambda
lists; a numeric prefix before one of those cells is an accelerator error and the
leaf does not execute.

### Menu, named command, pointer, and presentation contexts

The fixed command menu contains exactly two semantic cells, Help and Exit. Exact
unmodified Mouse-L or Mouse-R on either cell executes the same zero-argument command,
for four handled menu pointer leaves. Mouse-M and every modified raw gesture have no
command-menu handler.

The program installs exactly one additional named command, `Show GC Status`. It has
no local key or menu accelerator; typed/completed or presentation-produced command
invocation calls the system GC status reporter, emits a fresh line, and returns no
command values. It is distinct from the two fixed menu commands.

The notifications output loop establishes an `SI:INPUT-EDITOR` presentation input
context. Over compatible displayed raw text, these inherited candidates are
effective:

| Exact gesture | Contextual result |
| --- | --- |
| Control-Mouse-L | Hold-and-mark a displayed region |
| Control-Mouse-R | Open the marking/yanking operation menu |
| Control-Mouse-M | Yank the displayed word through the Input Editor context |
| Control-Shift-Mouse-M | Mark the displayed word |

Applicability, nested presentation type, current marking state, and the full 96-cell
raw gesture map are governed by the incorporated D28/G85 tree. The activity defines
no local translator. Its Help mentions only the two Control Left/Right marking
gestures and therefore is not exhaustive.

The left margin scrollbar has the same 13-cell component tree specified for
Converse. Margin hit testing wins before output-text presentations. Its `history`
noun is not customized by this activity. The main specification's first reviewed
witness proves the analogous Converse left scroll bar and its second proves the
Notifications left-scrollbar geometry; exact live Shift-Mouse and auto-repeat remains
`TODO-RUNTIME-CN-04` despite the complete source contract.

### Activity Help and unbound behavior

Activity Help documents Scroll/Meta-Scroll, Super-S/Super-R, Control-Mouse-L and
Control-Mouse-R, Super-W/Meta-W, End, Help/`?`, Refresh, and the left scrollbar. It
omits the remaining inherited scroll aliases, horizontal and typeout scrolling,
save/restore registers, Control-S/Control-R aliases, numeric argument families,
Cut/Copy/Clear mark, five no-op cells, Control-Mouse-M,
Control-Shift-Mouse-M, and `Show GC Status`.

An unlisted key is not automatically unbound: lookup must exhaust all four effective
table families. An unknown accelerator then beeps, clears accelerated input,
displays the diagnostic, and reprompts. Colon has no hidden full-command prefix.
A presentation-produced command blip remains a separate valid route.

## Complete `Show Notifications` command

`Show Notifications` belongs to the Session Command Processor area, not to the
Notifications program table. It has no local fixed key, prefix, or Notifications
menu cell. It is reached through the Command Processor's typed/completed name,
eligible presentation, or inherited menu path.

It has exactly eight specialized keywords, plus common output destination and more
processing from the Command Processor:

| Keyword | Required semantics |
| --- | --- |
| Newest | Select at most the requested count from the history head |
| Oldest | Select at most the requested count from the history tail, preserving newest-first report order within the selection |
| From | Begin at a zero-based history index, clamped to at least zero |
| Through | End at the inclusive history index; implemented as a subsequence endpoint clipped to history length |
| Since | Retain records with timestamp strictly greater than the boundary |
| Before | Retain records with timestamp strictly less than the boundary |
| Matching | Retain a record when any supplied string occurs case-insensitively in its rendered notification text |
| Excluding | Retain a record only when none of the supplied strings occurs case-insensitively |

Selection precedence is Newest, else Oldest, else From/Through. Time filters follow,
then Matching and Excluding. Negative Newest or Oldest counts produce an empty
selection. Without a paired lower time default, Since uses the relevant login-history
boundary: when Before is supplied but Since is absent and login history is nonempty,
the lower value is the third field of its first record. The source does not establish
a nonempty-history invariant: with empty login history that expression yields NIL,
and the subsequent strict numeric `<` comparison fails. Strict mode MUST preserve
that failure rather than invent an epoch. When Since is supplied but Before is
absent, the upper value is current universal time. With no restrictions, all history
prints newest first. Matching and Excluding use the implementation's
case-insensitive `STRING-SEARCH` substring operation, not regular expressions, so
case variants such as `A` and `a` match each other.

Installed wording suggests an inclusive Since boundary, but the source comparisons
for both Since and Before are strict. Strict conformance MUST exclude records exactly
equal to either boundary.

## Failure, abort, and recovery matrix

| Failure point | Required strict result | Evidence |
| --- | --- | --- |
| Damaged Converse line structure | Command error; no reparsing fiction; Regenerate remains available | `G452-SRC` |
| Point outside a named conversation | Command error and preserved buffer | `G452-SRC` |
| Empty/invalid address | Error before service invocation; correction reader where applicable | `G452-SRC` |
| No host for unqualified user | Error; zero hosts never becomes local-host guess | `G452-SRC` |
| Ambiguous user and chooser cancellation | NIL host result reaches the existing canonicalization/error path | `G452-SRC`; exact visible wording `TODO-RUNTIME` |
| Gag/service query decline | Temporary send record may appear, then final `:receiving-disabled` or `:services-disabled` status | `G452-SRC` |
| Missing send path | Final no-path status; no invocation on that recipient | `G452-SRC` |
| Styled text on thin-only path | Final text-must-be-fat status | `G452-SRC` |
| Per-recipient network error | Continue other recipients, collect address-associated errors, finalize one Converse record | `G452-SRC` |
| User abort in interactive background send | Final `:sending-aborted` status through cleanup | `G452-SRC` |
| Ordinary Zmail send failure | Not reliably represented by mail return; do not claim delivery proof | `G452-SRC` |
| Conversation deleted during send | Completion recreates/finds matching conversation and inserts final record | `G452-SRC` |
| Converse before-cold reset failure | Saved-send and recipient clears precede frame work; list-NIL, interval deletion/return insertion, composer install, point move, and redisplay are ordered with no rollback | `G452-SRC` |
| `:add-msg` after history push but before valid insertion | Retained history may outlive visible insertion failure | `G452-SRC` |
| Incoming server no login/private mismatch/gag | Reject before body processing according to adapter phase | `G452-SRC` |
| Incoming queue wait timeout | Issue pending-message notification; request may already be running | `G452-SRC` |
| Unknown CONVERSE property or syntax | Send `-` parse response and suppress body processing | `G452-SRC` |
| Network failure during CONVERSE header read | Return silently without syntax response | `G452-SRC` |
| Empty CONVERSE response | Strict indexing/error path; never success | `G452-SRC` |
| Missing CONVERSE `DATE` | Default to current universal time after the first response; do not reject at parse time | `G452-SRC` |
| Missing CONVERSE `TO` in ordinary logged-in delivery | NIL participates in Zetalisp string coercion; normally warn with `%`, synthesize `To: NIL`, and continue rather than issue a required-field error | `G452-SRC` plus selected string substrate |
| Missing CONVERSE `FROM` during unmatched normal delivery | Mutate receive registers/history, then queued new-conversation rendering raises on NIL address output after a partial structure change; exact visible condition is `TODO-RUNTIME-CN-10` | `G452-SRC` plus selected header substrate |
| Case-variant character-mapping refusal | Case-insensitive match enters the same thin-and-retry branch | `G452-SRC` |
| Lossy thinning during character-mapping fallback | Raise replacement remote Converse error before retry; emit no style-removal warning | `G452-SRC` |
| Character-mapping retry failure | Propagate/collect retry failure; emit no style-removal warning | `G452-SRC` |
| `Show Notifications Before` without Since and with empty login history | Lower default becomes NIL and strict `<` signals; never assume an epoch or hidden login record | `G452-SRC` |
| Notification formatting failure | No history mutation | `G452-SRC` |
| `TV:NOTIFY` after record construction | History push, TV tick, background-interest registration, optional activation, then wake are ordered with no rollback; return comes from interest branch | `G452-SRC` |
| Host NOTIFY cache-copy/TV/host-mark failure | Scalar tuple precedes buffer copy; cache precedes TV history; host-available mark precedes `Done`; every earlier effect remains | `G452-SRC` |
| Notification process recreation failure | Prior process kill and NIL slot precede allocation/no-kbd/preset/enable; no rollback, so NIL or partially configured process state remains | `G452-SRC` |
| Selected-stream timeout race | CAS reclaim/late-consumer/alien-cell branches exactly distinguished | `G452-SRC` |
| Unrecognized Converse receive-mode value | Use the notify-with-message catch-all; suppress body only when encrypted; do not signal an enum/protocol error | `G452-SRC` |
| Popup delivery failure | Strict recursive failure record and cursor jump; labelled correction may isolate | `G452-SRC`/`INTERP` |
| Activity Abort | Deselect and bury; handler returns NIL for outer abort propagation | `G452-SRC` |
| Invalid Notifications accelerator | Beep, diagnostic, clear accelerator state, reprompt | `G452-SRC` plus D28 |
| Forced VLM shutdown | Record incomplete/forced status separately; infer no guest persistence | `G85-RUN` |

Every nonlocal exit MUST release temporary window selection, FQUERY state, menu
grab, Input Editor localization, and background stream bindings. That cleanup rule
is `INTERP` where the historical source branch is not explicit; it does not authorize
changing an enumerated source partial effect.

## Visual and interaction references

This companion does not republish either D09 PNG. The capture-specific rights review
approves their use on the main D09 specification, not a second embedding here. The
main specification's reviewed [Genera Converse
witness](../converse-direct-messages-and-notifications-reimplementation-specification.md#genera-converse-witness)
is the normative visual reference for the headerless `To:` composer, structural
line, left scrollbar, `Converse (Text)` role, and send/exit mode-line roles. Its
reviewed [Genera Notifications
witness](../converse-direct-messages-and-notifications-reimplementation-specification.md#genera-notifications-witness)
is the normative visual reference for the distinct Dynamic Windows activity,
two-cell Help/Exit menu, left scrollbar, and one retained researcher-authored local
notification.

The main specification records the [screenshot rights and exact
identities](../converse-direct-messages-and-notifications-reimplementation-specification.md#screenshot-rights-and-exact-identities);
portable capture provenance remains in the [Genera screenshot
catalog](../assets/genera-screenshots/index.md). Those images establish only the
roles named there. They do not establish peer delivery, multiple-record order,
popup timing, or remote-terminal behavior. Peer exchange, encrypted popup, host
chooser, notification popup, and failure screens remain `TODO-RUNTIME`; no
unreviewed raw capture may be substituted into publishable documentation.

## Conformance and oracle test suite

Each test report MUST identify profile, implementation revision, source-evidence
revision, initial state, complete input/action sequence, actual state delta, result,
and whether a historical runtime oracle was available.

| ID | Fixture/action | Required oracle |
| --- | --- | --- |
| `CN-C01` | Create fresh frame | One anonymous composer, Text mode, point after `To:`, new named list empty |
| `CN-C02` | Dump fixed main cells | Exactly 12 local cells with keys and owners listed above |
| `CN-C03` | Enumerate `C-X` | Exactly five local leaves, then every incorporated Standard C-X child with provenance |
| `CN-C04` | Test C-Z/M-Z/C-M-Z | All terminate hard undefined without parent dispatch |
| `CN-C05` | Dump named candidates | 11 local names/10 functions; encryption comments absent |
| `CN-C06` | Invoke local Help then standard Help in child context | Main Help is fixed and incomplete; child parent dispatcher remains exact |
| `CN-C07` | Compare identity and recipient lists, including `[A,A]` against `[A,B]` | Non-NIL matching identity wins; strict equal-length/nonconsuming membership reproduces the duplicate false positive; corrected multiset mode differs and is labelled |
| `CN-C08` | Send success with deterministic fake adapter | Temporary record precedes async invocation; final record replaces by ID |
| `CN-C09` | Delete conversation while adapter blocked | Completion recreates/finds conversation and records result |
| `CN-C10` | Push A then B; have B push C while running; observe both drain passes | First pass claims/executes B then A and leaves C outside the captured chain; next pass executes C; claimed-versus-completed distinction remains observable |
| `CN-C11` | Decline/enable each preflight with upper/lowercase letters | Ten registered cells, 16 effective values, and ordered gag-before-service effects match |
| `CN-C12` | Exercise encrypted and ordinary popup maps with upper/lowercase letters | Four plus seven registered cells, 7+12 effective values, 3+3 presented choices, and prior activity restoration match |
| `CN-C13` | Exhaust the full raw pointer space of a host chooser with three rows, then leave/deexpose | Nine normalized primary-button operations, 288 selecting single-primary tuples, and 672 selecting full-mask tuples; every modifier variant of all seven nonzero button masks selects the same row host; outside/deexposure returns NIL |
| `CN-C14` | Dump message input context | End and Control-End activate; separate history; exact parent Input Editor recorded |
| `CN-C15` | Receive normal, notification-property, and encrypted-plus-notification-property messages | Normal mutates saved/reply/conversation state; notification mutates only the TV notification path; the early encrypted-plus-notification case still formats the trimmed body |
| `CN-C16` | QReply while a second receive races | Snapshotted first recipients/identity remain target |
| `CN-C17` | Seed saved sends/recipients, last identity, request stack, all receive-policy fields, old conversations/messages, and unsent text; invoke Converse before-cold with and without a frame and inject every rebuild failure boundary | Clears occur first; strict identity/queue/policies remain; successful frame reset leaves exactly one fresh headerless `To:` composer, point at the new first-line end, and redisplay request; partial failures retain ordered effects; corrected clears are labelled |
| `CN-C18` | Show Messages matrix, including query choice casefold | Ten specialized keywords, common CP fields, defaults, direction precedence, five registered/eight effective query values match |
| `CN-C18A` | Two ordered screens with multiple direct Converse frames, one nested frame, repeated fixture identities, the anonymous composer, and another NIL-recipient fixture | Output follows screen, direct-inferior, then frame-conversation order; nested frame is absent; no selected-frame restriction/deduplication; NIL-recipient objects remain silent even with Mention Empty Sequences true |
| `CN-C19` | Toggle append mode and request Forward | Source-profile order reversal is reproduced and labelled against Help |
| `CN-C20` | Encode/decode each CONVERSE property, case variants of every property name, and a nonblank line without Space | Ten-property grammar, order, case-insensitive property-key selection, per-value parsing, repeated `ALSO`, repeated normally-singleton last-write-wins fields, empty mappings, missing-separator syntax failure, and response phases match |
| `CN-C21` | Feed `+`, `-`, `%`, other, and empty responses | Exact success/warning/error/indexing classes match |
| `CN-C22` | Inject upper-, lower-, and mixed-case character-mapping refusals, a nonmatching refusal, lossy thinning, retry failure, and retry success | Case-insensitive matches thin then retry; nonmatch does neither; thinning and retry failures emit no warning; success emits the style-removal warning only after the second invocation returns |
| `CN-C23` | Start from buffer/0/0/NIL; run the Host NOTIFY duplicate matrix including `A`/`a`, selected reset operations, and failures at scalar assignment, buffer copy, TV delivery, and host-available marking | Same resolved host+length+case-insensitive `STRING-EQUAL` text within 600 ticks suppresses and changes none of the tuple; nonduplicate assigns tick/host/length then copies; selected resets do not clear; partial-copy, cache-without-history, and cache+history-without-ack states follow the exact failure order |
| `CN-C24` | Enqueue three TV notifications | History is newest-first while delivery is FIFO |
| `CN-C25` | Exhaust selected-stream handshake races | All mode, CAS, late-consumer, and alien-cell branches match |
| `CN-C26` | Force fallback failure | Strict cursor jump and recursive failure; safe divergence separately labelled |
| `CN-C27` | Print ranges around pending cursor, including `From=0, To=0` with additional pending records and a non-tail cursor fixture | Clamp/absolute/swap/clip match; To limits output only; tail predicate sets TV tick and assigns cursor to `(nthcdr From history)`, so the narrow print can skip unprinted records; non-tail leaves state unchanged |
| `CN-C28` | Dump Notifications fixed map | Exactly 70 effective cells with 37/18/5/6/4 ownership denominator |
| `CN-C29` | Traverse numeric tree before every command family | Scrolling consumes arguments; five no-op cells accept and ignore them; marked-text, Refresh, local Help/Exit, and other disallowed leaves error; no unshifted arguments |
| `CN-C30` | Test Save/Restore scroll position | Second-stage register character, same-window requirement, and missing-register error match |
| `CN-C31` | Hit command menu with all 96 raw cells per item | Only unmodified Left/Right execute; four handled leaves total |
| `CN-C32` | Hit displayed text with four marking gestures | Exact type/context gating and effects match; other cells follow D28 |
| `CN-C33` | Hit scrollbar portions with accepted and rejected cells | 13 handled logical cells, margin precedence, middle absolute return, repeat distinctions match |
| `CN-C34` | Append history while activity displays | Each new record appears once in chronological display order; head-race recursion closes gap |
| `CN-C35` | Invoke Show GC Status | Available by command name, absent from fixed menu/keys, output routed to typeout |
| `CN-C36` | Show Notifications filter matrix, including `A`/`a`, nonempty login-history default, and empty-history Before-without-Since | Eight specialized keywords, selection/time/string precedence, case-insensitive Matching/Excluding, strict boundaries, first-record lower default, and NIL-comparison failure match |
| `CN-C37` | Compare the main specification's reviewed witnesses | Required visual roles present; incidental text and exact pixels are not asserted; companion contains no second image embed |
| `CN-C38` | Deliver fallback notifications on two consoles with controlled clocks | Popup spacing is tracked independently per console; successful popup updates/pruning match; global last-notification time does not become throttle state |
| `CN-C39` | Receive while hidden under `:AUTO`, `:NOTIFY`, `:POP-UP`, `:NOTIFY-WITH-MESSAGE`, and at least two otherwise-unrecognized mode values, with ordinary and encrypted bodies | The three named branches remain distinct; every other value shares catch-all delivery; encrypted catch-all notices suppress the body; no unknown-value protocol error occurs |
| `CN-C40` | Exhaust all eight present/missing combinations of `DATE`, `FROM`, and `TO`; then repeat missing `TO` under private/no-login/gag states and missing `FROM` under property-notification and matching-identity states | No parser-level cardinality rejection; current-time default, `%`/`To: NIL`, ordered policy rejection, synchronous NIL-sender notification, existing-conversation success, and unmatched queued string-type failure occur in their specified phases |
| `CN-C41` | Seed history, delivery-tail, TV tick, and process sentinels; invoke `:BEFORE-COLD` and `:ONCE` separately | Before-cold clears only history/tail and retains tick/process identity; once recreates only the process and retains history/tail/tick; no blanket cold equivalence is claimed |
| `CN-C42` | Inject failure after every process-initializer step | Prior kill/NIL/allocation/no-kbd/preset effects remain committed exactly; no rollback is invented |
| `CN-C43` | Construct a source-profile Converse frame and dump flavor order, process/save-bits transitions, mode-line segments for every gag/style/end state, pane name/count/mode, ordered margins, initial interval, point, and exit | Every property matches the exact Converse layout table; pixel identity is not asserted |
| `CN-C44` | Construct Notifications and dump framework/table inheritance, pane properties, menu rows, ordered margins, and solved layout constraints | Title/menu/display roles, exact styles/flags, two-line top row, 0.2 menu share, and even display pane match; pixel identity is not asserted |
| `CN-C45` | Inject `TV:NOTIFY` failure after history push, tick update, interest insertion, activation, and wake; test with/without a window | Every preceding mutation remains; pre-format failures mutate nothing; normal return is the window-interest branch's values, usually NIL without a window, never the record/wakeup value |

For finite exhaustive input tests, the denominator MUST be printed before results.
Tests over the common Dynamic Windows single-primary raw pointer space use 96 cells
per hit target (32 modifier states by three buttons), even where only a small
accepted subset is listed here. The full nonzero button-mask space is 224 cells per
target (32 modifier states by seven masks). Menu tests use two targets; a three-row
host chooser uses three targets, so `CN-C13` reports the 288 single-primary subset
and exhausts all 672 full-mask row-hit tuples. Scrollbar tests use three portions.
The report MUST distinguish an unproducible physical chord from a logically
configured source tuple.

## Unknowns, nonclaims, and closure probes

| ID | Open oracle | Why it remains open |
| --- | --- | --- |
| `TODO-RUNTIME-CN-01` | Visible final status when a mail/send body signals before cleanup completes | Source ordering is clear; loaded-world condition presentation is not |
| `TODO-RUNTIME-CN-02` | Complete live installed Input Editor overlay in QSend/address contexts | Selected source gives the base; patches/site state were not dumped |
| `TODO-RUNTIME-CN-03` | Three-second popup input gate and ten-second fallback throttle | Source constants and stale comment are known; no timed VLM run |
| `TODO-RUNTIME-CN-04` | Scrollbar Shift-Mouse and auto-repeat on the preserved world | Source tree is complete; current screenshots prove geometry only |
| `TODO-RUNTIME-CN-05` | Peer CONVERSE/SEND delivery, reply identity, private rejection, group recipients | Harness has no configured peer |
| `TODO-RUNTIME-CN-06` | Multiple-record notification FIFO/display ordering and selected-stream race timing | Current run created one synthetic record |
| `TODO-RUNTIME-CN-07` | Encrypted popup/decryptor and ambiguous-user momentary menu visuals | States were not safely reached or reviewed |
| `TODO-RUNTIME-CN-08` | Exact loaded-world command-table additions from patches, site, or user state | No live registry dump; base profile remains selected-source exact |
| `TODO-RUNTIME-CN-09` | Proof that selected licensed source compiled into the preserved VLOD | Source and world identities are separate artifacts |
| `TODO-RUNTIME-CN-10` | Loaded-world debugger/typeout presentation after an unmatched normal message omits `FROM` | Source and selected string/header dependencies establish the partial state and type failure; no malformed-peer runtime was performed |

No current evidence establishes a configured Symbolics site, external service peer,
remote terminal, actual mail delivery, or broadcast datagram. No conformance claim
may promote these TODOs to observed facts.

## Rights and publication boundary

This specification contains original behavioral paraphrase, identifiers needed for
compatibility, portable hashes, and links to two captures whose publication was
reviewed specifically for the main D09 specification. It does not republish those
images and does not claim that their existing review authorizes reuse on this page.
It also does not reproduce licensed source bodies, installed Help prose, message
payloads, fonts, icons, or extracted documentation. The licensed archive, VLOD,
source tree, raw captures, and harness session stay ignored local inputs.

A clean-room implementation SHOULD keep evidence access separate from implementer
work and SHOULD retain a claim-to-test ledger. Publication of any additional runtime
image requires image-specific review under the repository's [screenshot publication
policy](../screenshot-publication-rights-review.md). A screenshot is evidence for a
specific scholarly claim, not permission to publish a gallery or extracted asset.

## Sources

- [Converse, direct messages, and notifications on CADR and Genera](../converse-direct-messages-and-notifications.md), the evidence-oriented historical dossier.
- [Genera 8.5 Zmacs keybindings](zmacs-keybindings.md), the normative inherited editor inventory.
- [Dynamic Windows reimplementation specification](dynamic-windows-reimplementation-specification.md), the normative typed input, presentation, program, command, FQUERY, and gesture substrate.
- [Lisp machine text editor family reimplementation specification](../eine-zwei-and-zmacs-editor-family-reimplementation-specification.md), the shared ZWEI/Zmacs model and effective-tree schema.
- [Lisp Listeners reimplementation specification](../lisp-listeners-reimplementation-specification.md), the Input Editor compatibility boundary.
- [Genera screenshot catalog](../assets/genera-screenshots/index.md), portable capture provenance and asset identities.

The licensed artifacts in the evidence ledger were verified locally on 2026-07-19.
They are identified for reproducibility but are neither linked nor redistributed.

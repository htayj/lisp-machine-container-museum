---
type: Reimplementation Specification
title: ZMail and mail composition reimplementation specification
description: A release-bounded reconstruction contract for the MIT CADR and Genera ZMail readers, their ZWEI composition modes, message and collection state, storage formats, complete input trees, transport boundary, failures, visuals, and conformance tests.
tags: [lisp-machine, mit-cadr, lm-3, genera, zmail, mail, zwei, dynamic-windows, reimplementation, specification]
timestamp: 2026-07-19T18:44:32-04:00
---

# ZMail and mail composition reimplementation specification

## Status and reconstruction claim

This specification defines D08 as five selectable compatibility targets rather than
one timeless program:

- `ZM-C46-COMPOSE`, the public MIT CADR System 46 ZWEI Mail mode and standalone
  `MAIL`/`BUG` entry functions at Git revision
  `8e978d7d1704096a63edd4386a3b8326a2e584af`;
- `ZM-C303-ZMAIL`, the maintained LM-3 System 303 ZMail reader at Fossil check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`;
- `ZM-C303-COMPOSE`, the separate System 303 ZWEI Mail minor mode in that same
  check-in;
- `ZM-G85-ZMAIL`, the full System 452.1 / Zmail 442.0 source-profile Zmail activity,
  with the locally preserved `Genera-8-5.vlod` world providing only the bounded
  runtime witness below; and
- `ZM-G85-COMPOSE`, the source profile's separate Zmacs/standalone Zwei Mail mode,
  with the named world providing the bounded runtime witness below.

The contract is implementation-independent. A conforming port MAY replace flavors,
special variables, linked lines, adjustable arrays, TV sheets, processes, and
Dynamic Windows internals with host-language objects, but it MUST preserve the
selected profile's observable state, ordering, effective commands, menus, pointer
operations, persistence decisions, partial failures, and visible relationships.

The specification does **not** claim source, package, ABI, QFASL, world-image, pixel,
network-protocol, or configured-site compatibility. It does not require or authorize
redistribution of licensed Genera source, decoded Help, mail data, or world content.
It does not turn a System 303 restoration checkout into a claim about every historic
System 303 site, and it does not invent a full System 46 ZMail reader absent from the
public snapshot. Store-and-forward queue operation belongs to D21; network protocol
engines belong to D19/D21 except for the D08 submission interface specified here.

An implementation claiming all five profiles MUST expose them as separately
selectable modes. It MUST NOT silently combine System 46 request-file transmission,
System 303 ZMail, and Genera service discovery into a synthetic default.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` have their usual requirements
meanings. A requirement qualified by a profile applies only when that profile or its
named feature closure or adapter is selected.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C46-SRC` | public System 46 source | source-present Mail-mode state, local keys, request-file grammar, `MAIL`/`BUG` entry, and source-visible failures | a full ZMail reader, the missing Zmacs overlay, or matching-band runtime behavior |
| `C46-QF` | public `dired.qfasl` | compiled module presence and artifact identity | source-to-QFASL identity or decoded function semantics |
| `C303-SRC` | maintained LM-3 System 303 source | reader/composer objects, tables, formats, defaults, algorithms, ordering, and failure paths | pristine historical provenance or residency in the tested base band |
| `C303-MAN` | ZMail 50/System 94 manual | contemporary user model and intended operations | exact System 303 implementation behavior |
| `C303-RUN` | CADR Xvfb harness | System `303-0` menu entry, missing resident flavor, attempted load boundary, and clean stop | a running ZMail frame or populated mailbox |
| `G85-SRC` | licensed local System 452.1 / Zmail 442.0 source | exact selected source-profile behavior, tables, registrations, object protocols, defaults, and failure order | redistribution permission, configured-site behavior, or function-level identity with the preserved world |
| `G8-MAN` | public Genera 8 *Editing and Mail* manual | contemporary user terminology, workflows, and command descriptions | every 8.5 source delta or runtime fact |
| `G85-RUN` | isolated Genera harness | live empty reader, 20-cell menu, 21-item auxiliary menu, site failure, distinct Zmacs Mail mode, and capture geometry | delivery, populated-message behavior, every menu predicate, or physical Symbolics keyboard identity |
| `INTERP` | stated reconstruction interpretation | a portable semantic choice supported by named evidence | a historical fact |
| `TODO-RUNTIME-*` | named oracle gap | an exact test still required | permission to guess |

If source, manual, runtime, and this interpretation disagree, the implementation
MUST retain the disagreement as a profile delta or open oracle. Runtime observation
does not silently override source for an unexercised branch, and source presence does
not silently claim load-band residency.

## Compatibility profiles and levels

### Release profiles

| Profile | Normative application surface | Required substrate | Explicit exclusions |
| --- | --- | --- | --- |
| `ZM-C46-COMPOSE` | ZWEI Mail mode, standalone `MAIL`, `BUG`, draft template, request-file writer | System 46 Standard ZWEI and TV | full ZMail reader; missing Zmacs overlay; configured ITS mail pickup |
| `ZM-C303-ZMAIL` | ZMail reader, summary, message, filter/universe, profile, draft, file and background-worker surfaces | System 303 ZWEI, TV, file and process protocols | independent Mailer daemon and configured transport peers |
| `ZM-C303-COMPOSE` | Zmacs Mail minor mode and programmatic `MAIL`/`BUG` composition | System 303 Zmacs/ZWEI plus the ZMail sending interface | reader UI unless `ZM-C303-ZMAIL` is also selected |
| `ZM-G85-ZMAIL` | unique Zmail activity, TV command panes and summary blips, selected Dynamic Windows presentation surfaces, reader, collections, calendar, integrated drafts, formats, background work | System 452.1 / Zmail 442.0 Flavors, ZWEI, TV, selected Dynamic Windows/CP, filesystem and network-service interfaces | CLIM; separate Mailer queue internals; arbitrary site patches |
| `ZM-G85-COMPOSE` | Zmacs and standalone Zwei Mail mode, draft chooser presentations and shared send machinery | same source profile's ZWEI, TV and selected Dynamic Windows presentation services | reader UI unless `ZM-G85-ZMAIL` is selected |

The public System 46 snapshot contains no full ZMail system. Consequently
`ZM-C46-ZMAIL` is not a valid profile name. A runner MUST reject it rather than
substituting System 303 behavior.

### Conformance levels

| Level | Required closure |
| --- | --- |
| `L1` semantic core | profile-tagged message, sequence, draft and view state; deterministic command dispatch; in-memory reader/composer behavior; explicit service and storage adapters; failures before external mutation |
| `L2` interactive application | `L1` plus the complete effective keyboard/prefix/menu/pointer/presentation trees, numeric arguments, Help exposure, window configurations, selected storage-format parser/writer overlays, foreground/background ordering, and rights-safe visual relationships |
| `L3` preservation fidelity | `L2` plus preserved-system comparison, exact selected format bytes, timing-visible background behavior, profile-selected partial-failure results, live Help/table enumeration, and closure of every `TODO-RUNTIME` required by the claimed profile |

An `L2` claim MUST name which storage overlays and transport adapter are enabled. It
MAY use an inert recording transport. It MUST NOT claim successful historical mail
delivery merely because the application accepted a draft.

### Feature closures and selectable adapters

Rows labeled as storage or transport adapters can be selected independently for a
conformance claim. Calendar is different: it is in the historical G85 declared
build and normative application surface. `CALENDAR` names its conformance subset;
it does not load or unload `calendar.lisp`. Every `ZM-G85-ZMAIL L2` claim MUST
include that subset.

| Overlay | Profiles | Requirement when selected |
| --- | --- | --- |
| `STORAGE-C303-{BABYL,RMAIL,TENEX,UNIX,VMS,TEXT}` | `ZM-C303-ZMAIL` | exact source-selected recognition, parse, capability, rewrite/append, status and error behavior |
| `STORAGE-G85-{BABYL,RMAIL,KBIN,TENEX,UNIX,DIRECTORY,TEXT}` | `ZM-G85-ZMAIL` | exact 8.5 registration, capability and persistence behavior; `KBIN` also requires its declared subsystem |
| `CALENDAR` | `ZM-G85-ZMAIL L2` | required Calendar, Month, Four Weeks, Week and Year layouts, reminder commands, state, translators and tests; conformance label only, not a build-graph switch |
| `ENCRYPTION` | both full readers | source-defined encrypt/decrypt commands and selected crypto-provider failures; no claim about cryptographic suitability |
| `HARDCOPY` | both full readers | D35 printer abstraction and message/file/selection routing |
| `CONVERSE` | `ZM-G85-ZMAIL` | declared subsystem closure and shared message facilities only; Converse UI remains D09 |
| `TRANSPORT-RECORDING` | all composers | inert adapter recording normalized envelope, message and submission order |
| `TRANSPORT-LIVE-*` | selected profile | an explicitly named configured service; never implied by base conformance |

## Evidence ledger

### Public CADR and LM-3 artifacts

All public source observations use portable repository-relative paths. Byte counts
and SHA-256 values were recomputed from the pinned local copies.

| Profile | Artifact | Bytes | SHA-256 | Role |
| --- | --- | ---: | --- | --- |
| `C46` | `src/nzwei/dired.55` | 34,913 | `fc5f0853854383b4c6dc81949b67fb452a478fd728b8b6eae88112ec3e40c3eb` | Mail mode, standalone editor, request-file writer, `MAIL`/`BUG` |
| `C46` | `src/nzwei/dired.qfasl` | 37,597 | `6e49c95f79d813faaea647383725fef60f2b48b761dc8d5de03734c7bfddf15f` | compiled-module corroboration only |
| `C46` | `src/nzwei/comtab.115` | 42,847 | `a40bcc9389cad426faf50ee7aaa507e40c569c90226ba5f53115b53f5f316834` | Standard ZWEI parent tables; no recovered Zmacs overlay |
| `C303` | `sys/sysdcl.lisp` | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` | active 18-path ZMail system declaration |
| `C303` | `zwei/dired.lisp` | 110,561 | `34155fec3311a969cfbed31c640b59159f28251b179f51b4c4a6c08b19c9eb34` | separate Mail minor mode and composer entry |
| `C303` | `zwei/zmacs.lisp` | 115,156 | `513f39d440a6612ff7d3d540a62b397fe6348456bd36a450262ff6fa372799d0` | complete Zmacs `Control-X M` entry and parent table |
| `C303` | `zmail/defs.lisp` | 49,882 | `6f0b1401d0e48f049671088286685311f38e72a623f94ce242fa8df05431b00e` | objects, tables, layouts, defaults |
| `C303` | `zmail/top.lisp` | 45,891 | `dcd33f0810c687a30c4d1a2758ee4781eb58975093116cc7cb47b620353eec87` | frame, foreground/background loops, entry |
| `C303` | `zmail/comnds.lisp` | 114,870 | `9a9e0d68cc3a3bbc358aa48ff407feaaba406bd717ec61d6d32681297d75ea93` | top-level dispatch and message operations |
| `C303` | `zmail/mfiles.lisp` | 68,281 | `663346b2927fbd9988b9fd754747ed472430d8a25ed90732e2a60bad3a6456e4` | load, save, expunge and Text format |
| `C303` | `zmail/mfhost.lisp` | 48,590 | `4f388328fb4554d6f6d9979ba72981d2ac93bd14efa52d490cbf39c1cca8fce0` | Rmail, Babyl, Tenex, Unix and VMS formats |
| `C303` | `zmail/mail.lisp` | 83,733 | `9bcf41074afa3524fee48f5b61af130a0115223c447db778f12b79ef138b7705` | integrated drafts, reply/forward and submission |
| `C303` | `zmail/window.lisp` | 41,968 | `df732df25f9da4aeded86dedec7c5adeebc7e40882d293c9e7337249c627db6e` | message/summary rendering and pointer behavior |
| `C303` | `zmail/filter.lisp` | 92,892 | `97e7dd830fd71d621b6aca7517e1cd5e1f138c741d64c57a152cdb202e788a31` | filters, universes, survey and bulk operations |
| `C303` | `zmail/profil.lisp` | 45,394 | `be6d2632a8fbb82e8244714939824921031e84c27c18fc2811ba472a7c14d0c3` | profile editor and option types |
| `C303-MAN` | `zmail/manual/manual.text` | 163,179 | `ac360407be2d99ffd3b80cbac0e823072366105b98808a94250b7182780017ba` | ZMail 50/System 94 manual source |
| `C303-MAN` | `zmail/manual/top.txt` | 3,360 | `215ee37501c25d6909dbb989bf1d30b1393c9aa6078173fbf2c1f77fd3569f5a` | First Edition, ZMail 50/System 94, April 1983 identity |

The remaining selected System 303 files are `mfhost2`, `refer`, `lmfile`,
`file/zmail`, `mult`, `button`, `cometh`, `rfc733`, and `lex733`. The 18 unique
system paths total 666,208 bytes; their pathname/byte/hash manifest has SHA-256
`03fba3258c2baa74d618a6e6d0e3eb2407ca115b04f2d9fd64db7937bf147115`.
`lmfile` is selected but entirely commented; the active local-filesystem integration
is `file/zmail`. `lm.lisp` is not selected, `PARSE` is commented out in the system
declaration, and `cometh` installs methods/resources but no transport. These are
closure facts, not optional code a clone may silently activate.

### Licensed Genera evidence-only artifacts

These files remain untracked local inputs. The table records identity and factual
ownership only; it does not reproduce their bodies.

| Artifact | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `sys.sct/zmail/patch/zmail.system-dir.~262~` | 8,075 | `27366e60fbc6760d2fa937008c9f1883549b6089786fbdfa7230557943d56383` | System 452.1 / Zmail 442.0 source-profile identity dated 1997-09-10 |
| `sys.sct/zmail/system.lisp.~81~` | 5,673 | `7a76f3f99df71721376e5cddb247b616568ddbc420fa17cc13aa5fd3804be17b` | module/dependency closure |
| `sys.sct/zmail/definitions.lisp.~1552~` | 98,226 | `f5c96f713e3105acb78d1a79de3d0739afd361f297b3a9b6b647fd4638144aa6` | data objects, tables, menus, layouts, options |
| `sys.sct/zmail/top.lisp.~1561~` | 76,649 | `814f6571649adda39594b006cb9375f23c48f6d32da7bb158a0acefbdc09d089` | unique frame, processes, entry and foreground loop |
| `sys.sct/zmail/window.lisp.~1538~` | 60,659 | `4e81d597dbf3d6453ddad7efe70a9b2787fb8c8f9c586fd5116117feac535afc` | summary/message rendering and gestures |
| `sys.sct/zmail/commands.lisp.~1600~` | 120,174 | `4b00879c28268561def2e2ee34a34026f73aca9dc8f5a4cb6077a66af342adf1` | complete top-level table and command behavior |
| `sys.sct/zmail/collections.lisp.~1552~` | 123,015 | `96ec840410068e90b18d3008cecc346905c93af01bd2b1a2d8d73e79eb1ca345` | sequences, selection, movement, filing |
| `sys.sct/zmail/headers.lisp.~1534~` | 66,205 | `6cd3f2217511c8a7d453806ef97d7cf7ad01c399b3affcfa32e9b69d8f796c49` | parse ownership, typed headers, compaction and reformatting |
| `sys.sct/zmail/filter.lisp.~1549~` | 99,538 | `368e8846de981b91fa4d5e03a6714bb9b2b6c009f6ebc8fb01b77a1a6a113cd0` | filters and surveys |
| `sys.sct/zmail/universe.lisp.~1511~` | 55,488 | `2500d0ca328476e5e7cac343b7cf13cd01b64f1f61524fd47e4b09c87333c2a5` | multi-sequence universes |
| `sys.sct/zmail/profile.lisp.~1517~` | 48,182 | `55af687c2b52606472544722a9ee5fd3a06534e5496dc5111baadeec84cfddd3` | profile task frame and typed options |
| `sys.sct/zmail/calendar.lisp.~1522~` | 63,648 | `56b4c387f6e8e0ee4d18a606de86b0604ef84ae1dcba1f991b00a18016dc763c` | calendar/reminder layouts and presentations |
| `sys.sct/zmail/references.lisp.~1515~` | 51,440 | `db8288cedf8463e1a52aaad7e8766875e7c8b7461c1379d0783be06b412a2c37` | reference chains/conversations |
| `sys.sct/zmail/mail.lisp.~1571~` | 152,833 | `6885d44e951270f9b9b4ebde5a2500fd674d4282599ba7c81e1fce017cb38c3a` | integrated draft and sending policy |
| `sys.sct/zmail/mail-files.lisp.~1566~` | 205,514 | `1ade0babfa463a4c2780165f64f59ce4d25191d93af7770f7bf571d440ef3648` | mail-file/inbox/background state |
| `sys.sct/zmail/mailbox-pathnames.lisp.~1507~` | 25,415 | `86aba9f0cc4b2f2366ceddfbe5c272875f2d51460c9a170289ca0406c3cb9fb7` | host-family format selection and pathname defaults |
| `sys.sct/zmail/foreign-mail-file-formats.lisp.~1520~` | 57,759 | `6eabd4f8ce57fa85b48542a8c415528c331f78d37101b2e89db23642e91f32ee` | Babyl/Rmail/Tenex/Unix formats |
| `sys.sct/zmail/directory-mail.lisp.~1505~` | 11,544 | `d5b62077554e07496313aea9a864181d2db04cb60246def44ad7740e1e36debe` | directory-backed format |
| `sys.sct/zmail/kbin/buffer.lisp.~1511~` | 14,113 | `07c45298489141b5c75492b733c826c5468a2a0efbbad6db926058592319efc6` | KBIN format integration |
| `sys.sct/zmail/mail-access-paths.lisp.~1517~` | 18,387 | `85d12d2141a66feeb852ef2ccb9a5e0401f51e65b53336a3e697b4f22d7b9103` | transport adapter selection |
| `sys.sct/zmail/smtp.lisp.~1537~` | 38,265 | `8f01f92630a0683b0ab25902b6dee6a1b4d936c2ebbd3e857f8ca89cf5471a0d` | SMTP adapter/client/server evidence |
| `sys.sct/zwei/mail.lisp.~38~` | 31,024 | `533278201f8538e9709cea2415491543bcc52a250c00acf9a387d391cd8ff93b` | separate Zmacs/standalone Mail mode |
| `sys.sct/zwei/comtab.lisp.~589~` | 100,220 | `5101f5a25a7222d6d0f8f48401522fa418576eb27d145f659513eb80660ca2b1` | parent lookup, prefix and undefined-command behavior |
| `sys.sct/zwei/macros.lisp.~276~` | 71,023 | `c7db63e24f706e2fa102db25026a8556ebfbc950d18592c0817f7b48274ad59d` | presentation-handler registration semantics |
| `sys.sct/mailer/system.lisp.~76~` | 3,802 | `7e7a7aaaddd478a2da0b7a29ab811705b934e15df044d2106e92d4e780695fd9` | separate Mailer boundary |

The 37-file analytical Zmail application-core subset totals 1,781,224 bytes and has
sorted portable-manifest SHA-256
`263df1e5a3329d60daf5cb5c931eb656c682cf405777a44a087601f582388e45`.
The system declaration additionally serializes its parser dependency on RTC, the
Converse subsystem, and all eight KBIN implementation files. That exact declared
build closure contains 47 files totaling 2,076,239 bytes, manifest SHA-256
`327c325390e71dbc45ae8da530921134da2e524b0bc70503819d941ac2898eae`.
The exact per-member records and canonical serialization are incorporated
normatively from the
[declared-build source manifest](genera/zmail-declared-build-source-manifest.md).
Its generation-binding `selection-v1` digests are
`925a26d7f23c3eb8c40f39ddb2821b200f321860809169acc3b454eaefe293f8`
for the 37-member analytical core and
`d0b7ccf46f870005dcdfb676cf55cce6ba9ab6122f0d2bd7994de4ea70630306`
for all 47 selected files.
The patch directory identifies the inspected source as System 452.1 / Zmail 442.0.
The runtime witness identifies a Genera 8.5 world, but no function-by-function
source-to-loaded-bytecode comparison has proved that every selected source body is
resident in that world. Source and compiled-world profiles therefore remain separate
even when their visible behavior agrees.

### Normative evidence map

| Contract area | `C46` owner | `C303` owner | `G85` owner |
| --- | --- | --- | --- |
| entry and local composer table | `dired.55:719-886` | `zwei/zmacs.lisp:2401-2470`; `zwei/dired.lisp:1935-2151` | `zwei/mail.lisp.~38~:55-143,250-420`; Zmacs parent in D05 |
| reader frame, panes and startup | absent | `zmail/top.lisp:201-829`; `defs.lisp:617-689` | `zmail/top.lisp.~1561~`; `definitions.lisp.~1552~` |
| top-level commands and fixed tables | absent | `zmail/comnds.lisp`; `defs.lisp:6-124,693-879` | `zmail/commands.lisp.~1600~`; `definitions.lisp.~1552~` |
| messages, sequences and drafts | simple editor buffer | `defs.lisp:268-495`; `mail.lisp` | `definitions.lisp.~1552~`; `collections.lisp.~1552~`; `mail.lisp.~1571~` |
| file/inbox state and formats | request-file output only | `mfiles.lisp`; `mfhost.lisp`; active `file/zmail.lisp`; comment-only `lmfile.lisp` | `mail-files.lisp.~1566~`; `foreign-mail-file-formats.lisp.~1520~`; `directory-mail.lisp.~1505~`; KBIN |
| filter/universe/reference behavior | absent | `filter.lisp`; `refer.lisp` | `filter.lisp.~1549~`; `universe.lisp.~1511~`; `references.lisp.~1515~` |
| submission and transport selection | `dired.55:764-830` | `mail.lisp`; `cometh.lisp` | `mail.lisp.~1571~`; `mail-access-paths.lisp.~1517~`; service adapters |
| runtime visuals and reachability | unavailable | missing-flavor/load-boundary session | `zmail-d08-genera-20260718`, generation 1 |

## Architecture and ownership boundaries

### User-interface substrates and CLIM nonrelationship

`ZM-C46-COMPOSE` and both System 303 profiles are ZWEI applications hosted by the
TV window system. Their command tables, editor closures, sheets, menus and
mouse-sensitive summary items predate CLIM.

`ZM-G85-ZMAIL` is a Flavors/ZWEI application combining TV frames with selected
Dynamic Windows presentation/margin services and Command Processor hooks. Its active
summary rows still use the older TV
scroll-window `SUMMARY-MOUSE` blip protocol; the source's proposed Dynamic Windows
conversion is disabled commentary, not an active translator. `ZM-G85-COMPOSE` is a
ZWEI mode; its zero-argument draft chooser does emit Dynamic Windows buffer
presentations. The Genera system
declaration has no CLIM dependency, the selected source defines no CLIM application
frame or port, and the runtime surfaces are the Zmail/TV/Dynamic Windows ones.
Therefore a conforming implementation MUST identify the substrate as
Flavors + ZWEI + TV + selected Dynamic Windows/Command Processor integration,
**not CLIM**. A port MAY use CLIM internally, but that is
an implementation choice and MUST NOT change the selected observable tree.

The [TV window-system specification](mit-cadr/tv-window-system-reimplementation-specification.md),
[Dynamic Windows specification](genera/dynamic-windows-reimplementation-specification.md), and
[editor-family specification](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md)
own their generic event, sheet, presentation, editor and redisplay protocols. D08
owns the mail-specific objects, table overlays, panes, menus, presentation handlers,
state transitions and service calls.

### Five related but distinct program layers

~~~text
ZWEI/Zmacs Mail mode ── draft buffer ──┐
                                      ├─ message parser and D08 submission interface
full ZMail/Zmail reader ─ integrated draft ┘
             │
             ├─ mail-file/inbox adapters and background file worker
             ├─ transport-access-path adapters
             └─ optional store-and-forward Mailer service (D21, separate process/system)
~~~

The System 46 composer writes a request file for another facility to consume. The
System 303 composer delegates actual transmission to ZMail's send function. The
Genera composer checks that Zmail is loaded and shares its parser and submission
machinery. None of those facts makes the interactive Zmail background process a
Mailer daemon.

### Required subsystem interfaces

| Interface | Required operations | Owner |
| --- | --- | --- |
| editor | select/create special buffer, intervals and points, mode table, parent lookup, redisplay, modified/undo state | D05 |
| window/presentation | frame selection, pane geometry, menu/pointer events, typed presentations, typeout/minibuffer | D02/D28 |
| filesystem | identify/open/read/write/rename/delete/version pathnames; report partial failure | D17/D45 plus selected D08 format adapter |
| process | foreground input, background request/response queues, locks, yields and shutdown | D30 |
| header parser | normalize typed header fields, addresses, dates and references while retaining original text where required | D08 |
| format adapter | recognize, load, append/rewrite, serialize attributes/options, expose capabilities | D08 overlay |
| submission adapter | accept normalized envelope and message; return per-recipient/service outcomes without pretending success | D08 boundary; protocol execution D19/D21 |
| hardcopy adapter | print message/file/selection and surface errors | D35 |

## Semantic data and state model

### Message

A message MUST retain at least:

| Field | Meaning |
| --- | --- |
| `real-interval` | source extent in the owning file representation |
| `display-interval` | parsed or reformatted text shown to the user |
| `buffer` | owning message buffer, or absent for an unsaved draft |
| `summary` | cached summary row and its source tick |
| `displayed-index` | current row number in a displayed sequence |
| `status` | persistent/transient attributes and keywords |
| `parse-state` | unparsed, in progress, parsed, or profile-specific failure |
| `tick` | last semantic mutation tick |
| `header-model` | typed normalized headers plus required original text/intervals |
| `reference-model` | message identifiers, backward/forward links and conversation metadata |

`ZM-G85-ZMAIL` additionally retains insertion tick and flags including the
fattened-message bit. A clone MAY use immutable values internally, but it MUST expose
the same state changes and cache invalidation.

Its exact parse-state domain is not merely `unparsed`/`in progress`: `NIL` means use
the owning buffer as format provenance; a message-buffer object means use that
specific provenance; `T` means parsed; `:KILLED` means dead or errored unless a
caller explicitly permits it; and a process object owns an active parse while other
processes wait. Parse acquisition is compare-and-swap-like. Nonlocal exit restores
the prior null/buffer provenance rather than publishing success. The Unparseable
restart, status/header compaction, hook, reformat and summary stages occur in source
order, and Deleted is always represented after parsing. Shared compaction excludes
the scroll displayer, original-header interval, Deleted, Recent and Unseen state.

Creating an empty message constructs a top interval and display child. Copying
forces parse and deep-copies text, status, boundary pointers and summary. Killing
marks the message killed before destroying text, sets interval/summary/tick to the
killed sentinel, and retains only reference and identifier information. A file-buffer
insertion copies a message rather than sharing it across file owners, marks the
origin Filed and optionally Deleted; a temporary collection may instead share
identity. Insertion rejects indexes greater than length, accepts length as append,
and grows the underlying array by approximately one quarter. These semantic results
must hold even if a clone uses different storage.

Header names are not an untyped dictionary. Address, sender/recipient, date,
reference, single-line and internal properties have distinct parsers and printers.
A changed header MUST invalidate every derived value whose source interval changed.

### Sequence, collection and buffer

A sequence is an ordered, mutable message population with:

- an adjustable array or equivalent ordered store and active length;
- a current/saved message;
- a name and property set;
- a point/history stack;
- a mutation tick and, for Genera, expunge/save-requiring ticks; and
- a read/write lock domain.

Disk-backed message buffers add pathname, header/file interval, format, stream,
status and format-specific options. Temporary collections MUST NOT masquerade as
disk-backed files; actions such as Remove operate on collection membership without
implying deletion from permanent storage.

Genera sequence modification has hard and current-source “soft” paths, but both
currently require save; a comment suggesting future differentiation is not active
behavior. Expunge selects a nearby undeleted message before compaction, clears its
expunge tick during partial work, compacts in place, kills buffer-owned deleted
messages but merely drops shared collection references, repairs save/Recent/current
state, and kills an empty temporary collection. A file-buffer wrapper first flushes
or requeues parse work and finishes I/O or aborts an active save.

`ZM-C303-ZMAIL` distinguishes ordinary ZMail buffers, disk buffers, mail-file
buffers, inbox buffers and temporary buffers. `ZM-G85-ZMAIL` distinguishes sequence,
collection, message buffer, file-mail buffer, inbox and format-specific subclasses.
Equivalent host types are conforming if the same predicates and transitions remain
observable.

### Disk and background status

The implementation MUST model status as a state machine, not a boolean busy flag.

| Profile | Stable state | Required transient/awaiting states |
| --- | --- | --- |
| `C303` old-mail buffer | `NIL` | `:LOADING`, `:SAVING`, `:SAVING-REQUIRED`, `:AWAITING-NEW-MAIL` |
| `C303` new-mail/inbox | profile-defined idle | `:NEW-MAIL`, `:LOADING-NEW-MAIL`, `:AWAITING-SAVE` |
| `G85` file-mail buffer | `:IDLE` | `:LOADING`, `:LOADED`, `:READING-NEW-MAIL`, `:SAVING`, `:SAVED`, terminal `:KILLED` |
| `G85` inbox buffer | `:IDLE` | `:LOADING`, `:LOADED`, `:PARSING`, `:INSERTED`, terminal `:KILLED` |

The Genera `:LOADED` and `:SAVED` states are foreground-notification boundaries:
background work has completed, but the foreground has not yet incorporated the
response. A port MUST NOT collapse them if a test can observe response ordering.
The C303 comment beside the status slot spells two states `:SAVE-REQUIRED` and
`:AWAIT-NEW-MAIL`; executable branches instead use the longer names in the table.
Strict compatibility follows executable state symbols and records the stale comment
as documentation evidence, not an alias declaration.

### Draft

An integrated draft MUST contain header and body intervals, a summary string/cache
tick, source messages for reply/forward, sent state or per-recipient submission
record, last window configuration, optional draft pathname/saved message,
per-window points, and a starting tick.

A standalone ZWEI/Zmacs Mail buffer is a separate editor object. It contains a
header region, the profile's exact separator line, body region, Mail-mode state,
modified state, and in Genera a retained recipient/submission property for
retransmission handling. It MUST NOT become a reader sequence merely because both
paths share the sender.

### Frame and view state

The full reader state includes:

- unique/selectable frame identity within the profile's selection domain;
- foreground editor closure and input queue;
- background worker, request cell/queue, response queue and locks;
- current/default/primary sequence, list of open buffers and current message/index;
- message point stack, drafts, filters, universes, keywords and profile values;
- current configuration and panes;
- typeout/overlying/minibuffer state;
- default move/select menus and command-button identity; and
- dirty, saving, parsing, shutdown and error state.

The core reading configurations are Summary only, Both, Message only and the
filter-oriented view. Integrated composition, filter construction and profile
editing are task configurations over the same frame state, not separate reader
processes.

For G85, exact public labels include Summary only, Both, two distinct entries both
printed `Message only`, Filtering commands, Summary//Message only, Send, Calendar,
Month, Four weeks, Week and Year. The second Message-only entry omits the command
menu; that explanatory distinction is not additional visible label text.

### Filter, universe and reference state

A filter is a named predicate over parsed message properties. A universe supplies
the candidate population, potentially spanning multiple sequences. Applying a
filter produces a stable ordered selection for the duration of a command unless the
selected command explicitly mutates that population. A reference index maps message
identifiers and reply links into conversations and MUST be invalidated when its
source sequences change.

The selected executable filter languages, universe grammars, definition recovery,
mapping order, cache invalidation and partial-failure behavior are the exact
contracts in the incorporated [C303](mit-cadr/zmail-filter-universe-profile-semantics.md)
and [G85](genera/zmail-filter-universe-profile-semantics.md) companions. They are not
an abstract predicate API. In particular, a strict implementation retains each
profile's executable-input boundary and source-visible defects; a safer parser or
transactional evaluator is a separately named overlay.

### Profile options

Profile definitions are typed metadata, not arbitrary strings. The implementation
MUST support the selected release's boolean/inverted-boolean, menu choice, number,
pathname, pathname list, address list, string list and Lisp-form-equivalent value
classes. Validation MUST occur before committing a changed value. Profile-dependent
commands MUST read the effective value at invocation time; a menu label alone does
not freeze the action.

The exact selected denominators are 69 active textual option declarations in C303
and 81 textual forms in G85: 80 active forms plus one form inside a block comment.
The inactive G85 form is evidence in the inventory but MUST NOT become an active
runtime option. Each companion's applicability restrictions, persistence class,
derived-documentation updates, Save/Compile/Reset order and failure prefixes are
normative; a count-only option implementation is nonconforming.

### Invariants

1. The current message, when non-null, belongs to the current sequence at the
   recorded index.
2. Every disk-backed message has one owning message buffer; a temporary collection
   references messages without stealing ownership.
3. A sequence write mutation occurs under its selected write lock; read operations
   MUST NOT observe a partially resized active array.
4. Parse state `in progress` is never published as successfully parsed.
5. A derived header, summary or reference cache is valid only for its recorded
   source tick.
6. Delete/undelete changes status; expunge changes membership/storage. They are not
   synonyms.
7. Removing a message from a temporary selection does not delete it from its owning
   file.
8. A draft is marked sent only from an adapter result that satisfies the selected
   profile's success rule. Opening or closing a draft is not success.
9. A failed save or send MUST retain enough draft/buffer state for the profile's
   recovery path; it MUST NOT report clean state merely because a stream closed.
10. Background requests and responses are applied in the selected profile's exact
    ordering; an implementation MUST NOT replace that ordering with an assumed FIFO.
11. The reader background worker and the store-and-forward Mailer remain distinct
    processes and state domains.
12. User/site/profile overlays are applied after the pristine release graph and are
    reported separately in conformance output.

### Locking contract

C303 uses a recursive owner lock whose unwind releases only when the current
invocation acquired it. G85 uses multi-reader/single-writer sequence locks: a writer
is reentrant; the same process may read under its write lock; a sole reader may
upgrade; and a multi-lock writer waits until every requested lock is available, then
acquires all interrupt-atomically and restores them on unwind. Parent plus inbox
operations request parent then inboxes, while inbox plus parent operations request
inbox then parent; all-or-none acquisition prevents a partially held deadlock.
G85 warm boot clears locks on every live sequence and each inbox being inserted. No
equivalent C303 warm-boot reset is established by the selected source. Tests MUST
cover C303 owner reentry, non-owner contention and acquisition-owning unwind, plus
G85 reentrancy, upgrade, contention, all-lock acquisition, unwind and warm-boot
reset, rather than replacing either profile with an unobservable generic mutex claim.

## Complete effective input and gesture trees

### Normative companion incorporation

The exact finite mappings and detailed semantic contracts are normatively
incorporated from these repository companions:

| Profile/context or contract | Normative companion |
| --- | --- |
| C46 Standard ZWEI parent | [System 46 Standard and Control-X tables](mit-cadr/zwei-zmacs-keybindings.md#system-46-boundary-and-canonical-built-listing) |
| C303 Standard/Zmacs parent and Mail minor mode | [System 303 tables and Mail overlay](mit-cadr/zwei-zmacs-keybindings.md#application-and-task-mode-tables-in-system-303) |
| C303 ZMail local tables, menus and summary mouse surface | [System 303 ZMail command and keybinding inventory](mit-cadr/zmail-keybindings.md) |
| G85 Standard/Zmacs parent and Mail minor mode | [Genera Zmacs complete binding tree](genera/zmacs-keybindings.md) |
| G85 Zmail local tables, menus, summaries and drafts | [Genera 8.5 Zmail commands and bindings](genera/zmail-commands-and-bindings.md) |
| C303 and G85 named top-level commands | [86-row and 152-row command-effect closure](zmail-command-effect-closure.md) |
| C303 Filter, Universe, Profile and selected options | [System 303 filter/universe/Profile semantic contract](mit-cadr/zmail-filter-universe-profile-semantics.md) |
| G85 Filter, Universe, Profile and selected options | [System 452.1 / Zmail 442.0 filter/universe/Profile semantic contract](genera/zmail-filter-universe-profile-semantics.md) |
| C303 and G85 mail-file adapters | [Exact parser, serializer, recognition and failure semantics](zmail-mail-file-format-semantics.md) |

Incorporation means that every exact row, generated digit range, ordered menu,
completion-name list, declaration denominator, grammar, state transition, failure
prefix and stated parent edge in those pages is normative for the named profile.
The effect contracts below are also required. A companion is not permission to
ignore numeric arguments, applicability predicates, profile-driven button meanings,
prefix fallthrough, unbound behavior, source/runtime separation or runtime overlays.
The command denominator is exactly 86 C303 definitions and 152 G85 completion
candidates; passing those counts without matching every ordered effect and failure
boundary in the command-effect closure is nonconforming.

Every incorporated companion's conformance suite and profile-applicable
`TODO-RUNTIME-*` backlog is also normative without renumbering. `L2` requires all
source-profile tests applicable to the selected feature set. `L3` additionally
requires closure of the union of applicable runtime obligations in this page and
those companions; this page's later short backlog is not permission to ignore a
companion oracle.

### Entry tree

~~~text
ZM-C46-COMPOSE
├─ Lisp (MAIL [who [what]]) -> reusable standalone ZWEI Mail editor
├─ Lisp (BUG [program]) -> same editor, initialized as bug mail
└─ source-present COM-MAIL -> current editor Mail mode
   └─ exact System 46 Zmacs key ingress: TODO-RUNTIME-ZM-C46-ZMACS-ENTRY

ZM-C303-ZMAIL
├─ System M, only if M was unclaimed when ZMail initialized
│  └─ select/create ZMAIL-FRAME
├─ System Menu > Mail -> select/create ZMAIL-FRAME
└─ programmatic selection of ZMAIL-FRAME

ZM-C303-COMPOSE
├─ Zmacs Control-X M -> COM-MAIL
├─ extended command Mail -> COM-MAIL
├─ Lisp MAIL user text call-editor-anyway
└─ Lisp BUG program text call-editor-anyway

ZM-G85-ZMAIL
├─ Select M -> SETUP-ZMAIL-FRAME, primary label Zmail, alias Mail
├─ System Menu > Zmail -> same activity
└─ Select Activity Zmail/Mail -> same unique selectable frame

ZM-G85-COMPOSE
├─ Zmacs Control-X M -> Mail
├─ extended command Mail -> same command
├─ Lisp/ZL:MAIL or bug-report caller -> standalone/reusable Mail editor
└─ numeric argument zero -> presented list of existing Mail and bug-mail-frame drafts
~~~

System 46's public snapshot proves the command and standalone functions but lacks the
Zmacs overlay which would prove a `Control-X M` cell. A clone MAY offer that familiar
route as a labeled extension; it MUST NOT call it `ZM-C46-COMPOSE` source fidelity.

### System 46 Mail-mode local tree

The source defines Mail as a ZWEI major mode whose local table is sparse. Its local
delta is complete:

| Input | Effect | Argument behavior |
| --- | --- | --- |
| `Control-Altmode` | transmit through the request-file writer | inherited numeric state is not consumed as a count |
| `End` | same transmit command | same |
| `Control-]` | exit without sending and explain how to resume | same |
| `Tab` | Tab To Tab Stop | parent command semantics |
| every other input | inherit the selected Standard/current-mode table | exact parent result or unbound |

There is no source-local special `Abort` cell. The command's prose says
`Control-G` quits, but the active local table binds `Control-]`; strict conformance
follows the table and records the prose discrepancy. Mail mode clears Lisp comment
syntax, adds `-` as a paragraph delimiter so filling respects the body separator,
and appends the visible End/Control-] reminder to the mode line.

### System 303 ZMail top-level table

The incorporated System 303 companion supplies 47 ordinary direct cells, 44
generated numeric cells, the fixed main/filter menus, principal summary gestures and
86 completion definitions. The transient filter, universe, profile, chooser and
typeout contexts added below are also normative. The effective local tree has these
branches:

~~~text
ZMAIL-COMTAB
├─ direct character -> local command from companion
├─ minus/digit under plain, Control, Meta, Control-Meta -> numeric argument state
├─ pointer in summary -> SUMMARY-MOUSE dispatcher
├─ pointer on command/menu/mode-line item -> item-specific left/middle/right action
├─ named command completion -> one of the 86 release definitions
├─ Help/self-documentation -> D07 over this effective table
└─ absent cell -> unbound ZMail command error; no Standard text-insertion fallback
~~~

The top-level reader is not an ordinary editable Zmacs buffer. Printable letters such
as `D`, `M`, `R`, `S`, `U` and `X` are commands, not insertion. The `N` and `P`
commands consult profile movement policy; direct `Control-N`/`Control-P` select their
source-defined down/up commands. `Space`, `Control-V`, Hand-Down and their backward
counterparts scroll the message surface. Summary scrolling is a distinct command.

### System 303 ZMail message and draft tables

The message-editing table delegates absent cells to the active ZWEI mode. Its local
leaves are `End`, `Control-Escape`, and `Abort` to leave message editing. Its
`Control-X` child adds `A`, `C`, `S`, and `T` for More Text, Cc, Subject and To, then
delegates absent child cells to the Standard/Zmacs `Control-X` table.

The integrated reply/new-draft table overlays:

| Input | Effect |
| --- | --- |
| `End` | policy-sensitive Mail End |
| `Control-Escape` | Send Message directly |
| `Control-Meta-Y` | yank the selected/current message |
| `Abort`, `Control-]` | ordinary Abort Send |
| `Super-Abort` | stronger Really Abort Send path |
| `Control-X` | enter the reply child table |

The reply child adds `1`, `2`, `3`, `M`, `O`, `Y`, `Control-R`, `Control-S`,
`Control-W`, and `Control-Meta-S` for one/two/three-window layout, recursive mail,
other window, prune, restore/save/write draft, and save draft as message. It then
inherits the message child and ordinary ZWEI child tables. Reply direct-key misses
delegate to the selected mode, not to the message direct table; only its
`Control-X` child chains through message `Control-X` and then the selected mode's
child. A port MUST preserve those parent edges.

The C303 reply extended-command list has this exact 17-item order: Add To Field,
Add Cc Field, Add FTo Field, Add Fcc Field, Add Subject Field, Add In-Reply-To
Field, Add More Text, Add From Field, Zmail Yank Current Msg, Prune Yanked
Headers, Send Message, Abort Send, Restore Draft File, Write Draft File, Save Draft
File, Save Draft As Msg, Change Subject Pronouns. Its right-button list has this
exact 15-item order: Add To, Add Cc, Add Fcc, Add Subject, Add In-Reply-To, Add More
Text, Add From, Prune Yanked Headers, Send Message, Abort Send, Restore Draft File,
Write Draft File, Save Draft File, Save Draft As Msg, Change Subject Pronouns.
Thus FTo and Yank Current are completion-only in this comparison.

C303 Reply chooses the product of seven recipient policies—All, All-Cc, Cc-All, To,
To-Cc, Cc-To, Sender—and three view/yank policies—Like Mail, Show Original, Yank—for
exactly 21 choices. Left uses the primary profile pair, middle the middle profile
pair, and right presents that ordered product. Numeric 1 substitutes the one-recipient
profile; numeric 3 or 4 forces Yank; other numeric values are accepted without
changing the default pair. The G85-only Prune dimension below MUST NOT be backported
to this 21-choice C303 tree.

### System 303 separate ZWEI Mail-mode tree

This mode is not the integrated ZMail draft table. Its complete local delta is:

| Input | Effect |
| --- | --- |
| `Control-Altmode`, `End` | validate the separator and submit via ZMail's sender |
| `Abort`, `Control-]` | quit/retain or kill according to modification and caller state |
| `Tab` | Tab To Tab Stop |
| `Hyper-F`, `Hyper-B` | move forward/backward by address |
| `Hyper-K`, `Hyper-Rubout` | kill forward/backward address |
| `Hyper-T` | exchange addresses |
| `Control-X` | enter the Mail child table |

The child table adds `A`, `C`, `S`, and `T` for More Text, Cc, Subject and To. Its
named list also exposes In-Reply-To, From and Change Subject Pronouns. Absent child
cells inherit the Zmacs `Control-X` table; absent top-level cells inherit Text mode,
active minor modes, Zmacs and Standard ZWEI in the D05 order.

`Control-X M` in top-level Zmacs enters this mode. `Control-X M` inside an integrated
ZMail draft instead means Recursive Mail. Context MUST therefore participate in key
identity.

### Genera 8.5 Zmail top-level tree

The incorporated Genera companion supplies the fixed reader table, 44 generated
numeric cells, eight-cell `Control-X` child, ordered 20-cell normal menu,
calendar/filter variants, the principal submenus, the 21-item right-button auxiliary
menu, summary-row gestures, and 152 clean-release completion candidates. The
presentation translators and transient filter/calendar contexts added below are also
normative. Neither companion alone is claimed to be the full live tree.

Top-level dispatch has the same broad shape as System 303 but includes Genera named
keys, Undo/Redo, separate typeout scrolling, mini-buffer-repeat commands, and Dynamic
Windows/TV event dispatch. The `Control-X` child is Zmail-owned and MUST NOT be
replaced with the Zmacs child:

| Child | Command |
| --- | --- |
| `B` | Select Sequence |
| `Control-B` | List Sequences |
| `Control-F` | Edit Mail File |
| `Control-Shift-F` | Edit ordinary File |
| `K` | Kill Sequence |
| `M` | recursive Mail in the Zmail context |
| `Control-R` | Examine Mail File |
| `Control-S` | Save Mail File |

Missing Zmail child cells are unbound unless the selected source explicitly installs
an indirection; they MUST NOT inherit Zmacs solely because the spelling is
`Control-X`.

The main menu's visual `Jump` cell invokes Goto, while keyboard `J` invokes Jump.
The former selects through filter interaction; the latter uses a numeric message
number when present and otherwise the first undeleted message. A clone MUST retain
that label/command distinction.

### Genera command panes, modes and pointer tree

The normal command pane is the exact four-row, five-column matrix in the companion.
Calendar retains its geometry but substitutes Compose and blank cells. Filter mode
has a six-command no-message form and a 15-position full form with one deliberate
blank. The Next, Previous, Map Over, Mail and Other submenus are ordered arrays, not
sets.

Command-pane button identity is dynamically bound during invocation:

- left performs the item's primary/default action;
- middle uses the applicable profile-selected quick action where one exists;
- right opens the item's option menu where one exists; and
- an inapplicable item MUST remain unavailable rather than dispatching a stale
  command.

Active Genera summary rows use the older TV `SUMMARY-MOUSE` blip protocol. The exact
tree is:

| Gesture | Required effect |
| --- | --- |
| left on row | select the message; leave summary-only view when body display is required |
| middle on row | run the current profile's summary-middle action |
| right on row | construct the conditional 13-entry summary menu |

The conditional menu filters Continue to drafts, Delete/Undelete by status, Remove
to temporary collections, and Reply away from drafts. The profile-middle menu omits
the draft-only Continue choice. Source text proposing Dynamic Windows translators
for these rows is disabled and MUST NOT replace the active blip protocol in strict
`G85` mode.

### Genera integrated message and draft trees

The shared address/header overlay adds Hyper Forward, Backward, Kill, backward Kill
and Exchange Address, `Control-Shift-W` Whois Address, and `Control-X A/C/S/T` for
More Text, Cc, Subject and To. `Mark Address` is named but has no literal local
cell. Setup copies these address/header cells into the active mode and its active
`Control-X` child; they are not four leaves owned by the otherwise-empty message
`Control-X` overlay.

Editing an existing message always selects Text major mode, then overlays
`End`/`Control-Altmode` to Quit, `Abort` to Zmail Abort, and Mouse-R to the
ordered 22-action message-edit menu. Its extended list has one additional entry,
Show Expanded Mailing List.

Reply/new-message composition defaults to Text but accepts the source-supported Text,
Fundamental, or Lisp draft major mode before applying the following overlay:

| Input | Required effect |
| --- | --- |
| `End`, `Control-End` | profile-sensitive Mail End |
| `Control-Altmode` | Send Message immediately |
| `Abort`, `Control-Z`, `Control-]` | Abort Send |
| Mouse-R | ordered 34-action reply menu |
| `Control-X` | reply child below, then selected inherited editor child |

The reply child maps `1`, `2`, `0`, `M`, `O`, `Y`, `Control-R`, `Control-S`,
`Control-W`, `Control-Y`, and `Control-Meta-S` exactly as inventoried. Its extended
list adds Show Expanded Mailing List to the 34 menu actions. The 41 defined draft
commands, including unkeyed entries, are the exact completion denominator in the
companion.

### Genera separate Zmacs Mail-mode tree

The local fixed delta is complete:

| Input | Required effect |
| --- | --- |
| `Control-Altmode`, `End` | Exit Mail and submit |
| `Abort`, `Control-Z`, `Control-]` | Quit Mail without submission |
| `Meta-Help` | Show Patch Mail Example |
| editor menu | Add File References |
| every other input | inherit Text/active-minor/Zmacs/Standard behavior |

Invocation distinguishes three numeric states:

| State | Result |
| --- | --- |
| no numeric argument | create and initialize a new Mail buffer |
| nonzero argument | reselect the most recently selected Mail buffer without initialization |
| zero | list existing Mail and bug-mail-frame drafts as selectable buffer presentations; if none, report that fact and change no selection |

The zero-argument list uses Dynamic Windows buffer presentations. This does not make
the surrounding Zmail summary a Dynamic Windows presentation surface.

### System 303 transient input tree

These contexts complete the fixed companion inventory. They do not consult the
top-level ZMail comtab unless a branch explicitly requeues an event to that loop.

The shared utility-frame parent accepts these atomic keys:

| Input | Effect |
| --- | --- |
| `Clear-Screen` | refresh the frame |
| `Control-R` | select/edit the current pane |
| `Break` | ZMail Break |
| `Abort` | throw to the child frame's top-level tag |
| any other atomic key | `BARF` |

Its special-event parent executes `SUMMARY-EXECUTE`, `:TYPEOUT-EXECUTE`, and
`:EXECUTE`; consumes background-response, redisplay, and configuration-change
events; scrolls the named window; enters a pane for `SELECT-WINDOW`; and requeues a
raw mouse-button event before selecting the current pane. An unknown special event
is requeued only when the active dispatcher advertises that operation; otherwise the
handler declines it. There is no universal unknown-event beep.

The C303 reader mode line has three dynamic selectable regions. The buffer filename
appears only while a buffer exists and invokes Rename Buffer. The current-keywords
region invokes Keywords: left repeats the last stored add/remove sets or barfs if
none, middle derives keywords from matching filters, and right chooses the complete
set and updates the stored default. The message-more region invokes Mode Line Scroll:
left advances one screen less one line, middle goes backward by that amount, and
right opens Forward, Backward, Beginning, End in that order. A single left click on
the summary pane's label has a separate geometric tree: in the central half it
toggles Both to Summary and every other state to Both; in either outer quarter it
selects Message. Other label buttons do not invoke that transition.

Marking mode first clears marks and exposes Summary. `SUMMARY-MOUSE` toggles the
clicked message; `End` commits a temporary buffer; any other compound blip commits,
requeues that blip, and returns; `Abort` or `Control-]` aborts; any other atomic key
beeps and remains. Unwind always removes marks and restores documentation and the
old layout. Compound-blip commit precedes atomic abort testing.

The filter-selection frame has no keyboard table: every atomic key beeps. Pointer
button identity is ignored for Abort, Not, and Universe. Abort aborts; Not toggles
accent/state; Universe opens its chooser and commits only a non-null result. Keyword,
System and user-filter menu events return the selected predicate; System choices are
All, Deleted, Unseen, Recent, Answered, Filed, Search, From/To and Subject. New Filter
enters the definition frame, and canceling it aborts selection. Other compound or
random nonaccent clicks are ignored.

The filter-definition task uses the utility parent outside its editor. The editor
binds `End`/`Control-Escape` to finish standalone edit, `Abort` to leave only the
editor, and otherwise inherits Standard ZWEI; it additionally copies the extended
search `Control-H` prefix. Menu insertions cover Any/named keyword, named user
filter, Deleted/Unseen/Recent/Answered/Filed, Search, To, To/Cc, From, Subject,
Other, and Before/On/After date predicates. `Not`, `And`, `Or`, and `Close` perform
the same insertion/navigation on all buttons. `Sample` left/middle uses the current
sequence while right chooses a universe. `Done` parses/evaluates/compiles; `Abort`
returns null. `Name` left prompts for a new name, while both middle and right open
the existing-filter menu despite documentation mentioning only right. Summary click
extracts a predicate; typeout/summary execute events explicitly barf.

The universe-definition task has the same outer/editor parent, though its mode line
incorrectly says Editing Filter. File/temporary-buffer menu items insert buffer-name
strings; Primary and Current insert those symbols; named universes insert a one-item
list; All inserts `(ALL)`. `Union`, `Intersection`, `Not`, `Close`, `Done`, and
`Abort` ignore button identity; `Name` uses left for new and middle/right for the
existing menu. The `(ALL)` representation versus direct symbol expansion is
`TODO-RUNTIME-ZM-C303-UNIVERSE-ALL`.

The profile task uses the utility parent before editing and standalone ZWEI while
editing. `Control-R`, selecting the editor pane, or clicking Edit enters it.
Application buttons have this exact left / middle / right policy:

| Button | Left or keyboard | Middle | Right |
| --- | --- | --- | --- |
| Filters | edit remembered list | filter associations | menu of those two |
| Universes | edit remembered list | universe-filter associations | menu of those two |
| Mail Files | edit remembered files | file-filter associations | menu of those two |
| Keywords | edit file keywords | keyword-filter associations | menu of those two |
| Save | insert changes, save, maybe compile | make init compiled | Save file / Make init compiled / Insert changes / Reap file / Recompile file |
| Hardcopy | choose hardcopy options | same | same |
| File Options | choose buffer and edit options | same | same |
| Exit | leave profile task | same | same |
| Reset | restore init-file values, optionally text | same | same |
| Defaults | restore system defaults | same | same |
| Edit | synchronize values, edit, then reread | same | same |

Variable-choice events delegate the actual button to the TV value pane, tick profile
state, and refresh associated documentation. The Keywords popup uses the same
standalone `End`/`Abort` editing contract. Random nonaccent clicks are ignored.

`CHOOSE-MSG-FROM-SUMMARY` consumes exactly one event: `SUMMARY-MOUSE` returns the
message; anything else barfs and is not requeued. The typed-or-summary chooser uses
ordinary minibuffer editing, returns a clicked summary message, and substitutes its
default for empty typed input.

System 303 typeout presentations have exact left defaults/right menus:

| Item | Left default | Right menu, in order |
| --- | --- | --- |
| ZMail buffer | Select | Kill; Save; Expunge; Expunge & Save; Select |
| file | Select | Select; Arbitrary format; View |
| unloaded mail file | Read in | Read in |
| summary line | Select message | Select |
| saved point | Select point | Select |
| message line | Select containing message | Select |
| minibuffer string | Insert | Insert |
| sender/recipient/subject predicate | Insert predicate | Insert |

Left emits a typeout-execute event, right chooses an operation, and other single
buttons beep. The typeout reader returns only numeric/keyboard input or the named
typeout, summary, menu, mouse, mode-line and mouse-button opcodes; it discards other
compound events. Multiple-header and single-field selectors accept exactly one
typeout-execute event and barf otherwise. Filter extraction accepts typeout actions,
changes source message on summary click, returns on Space, and requeues any other
input before returning.

Extended-search minibuffer input inherits the ordinary minibuffer but adds Help and
this exact `Control-H` child: `(` open, `)` close, `Control-_`/`Control-O` Or,
`Control-D`/`&`/`Control-A` And, `Control-N`/`~`/`Control-E` Not, Space whitespace,
`-` delimiter, `A` alphabetic, `*` repeat-next, `Control-X` any character, and Help
documentation. The ordinary parent accepts Return, Control-Return, End, Control-G,
Abort, Control-Shift-Y, Control-Meta-Y, Control-Shift-S, Meta-Shift-Y, and double
left click; `Control-Z`, `Meta-Z`, and `Control-Meta-Z` are hard undefined before
Standard fallthrough.

The experimental `:NEW` task is a multi-stage tree. Universe left reuses the last
universe, middle chooses current buffer, and right chooses/saves a new default;
Filter left reuses the last filter, middle always barfs, and right chooses/saves. A
filter selected while scoped to one message promotes scope to the current buffer.
A menu event terminates operand collection, resolves Other Commands repeatedly, then
dispatches in this order: current-message command; current-buffer associated-all;
other-buffer associated-all under dynamic selection; materialized filtered temporary
buffer for associated-all without map form; associated map command; otherwise barf.
An input that is neither menu nor mouse-button is requeued and exits. Unwind restores
the labels Just current message and All.

Mark Survey is a distinct transient loop, not a synonym for ordinary summary
selection:

| Input | Exact effect |
| --- | --- |
| summary left | toggle the clicked message mark |
| summary middle | abort |
| summary right | commit |
| `Space` | toggle current message |
| `Control-M` / `Control-Shift-M` | mark all / unmark all |
| `Control-N` / `Control-P` | move next / previous |
| `Control-Shift-N` / `Control-Shift-P` | toggle, then move next / previous |
| `Control-V`, `Control-Meta-V` | scroll forward one screen and repair the cursor |
| `Meta-V`, `Control-Meta-Shift-V` | scroll backward one screen and repair the cursor |
| Help | display Mark Survey help; in Summary-only, wait at the help display |
| End | commit |
| Abort, `Control-]` | abort |
| other atomic input | beep and remain in the loop |

`SELECT-WINDOW`, `WINDOW-WAKEUP-SELECT`, `WINDOW-WAKEUP-EXPOSE`,
`WINDOW-WAKEUP-REFRESH`, `WINDOW-WAKEUP-REDISPLAY`, and
`WINDOW-WAKEUP-VIEWPORT-POSITION-CHANGED` are ignored. Any other
compound blip commits, requeues that exact blip for the enclosing loop, and returns.
Commit with no marks is an error. Unwind always clears transient marks and restores
the prior configuration and documentation state.

The G85 default special-event dispatcher is also an input tree:

| Opcode | Ordered result |
| --- | --- |
| `SUMMARY-EXECUTE`, `:TYPEOUT-EXECUTE`, `:EXECUTE` | apply the supplied function to its remaining arguments |
| `REDISPLAY`, `CONFIGURATION-CHANGED` | request redisplay while preserving typein |
| raw `:MOUSE-BUTTON` | if the window is typein or mode line, reselect the current application window; then beep and return no redisplay |
| `:MENU`, `MODE-LINE`, `SUMMARY-MOUSE` | beep and return no redisplay |
| `SCROLL` | process the scroll request, redisplay the target window, return no further redisplay |
| `SELECT-WINDOW` | preserve typein only when selecting the already current window; otherwise no redisplay |
| `PRESENTATION-COMMAND` | clear typein, show the command name in italic, bind the mouse-gesture comtab, apply the supplied command form, return no redisplay |
| `SI:INPUT-EDITOR` | reject the gesture as undefined in this context |
| the five `DW::WINDOW-WAKEUP-*` opcodes named above | ignore and return no redisplay |
| `:EXECUTE-AS-COMMAND` | bind gesture comtab/current command, apply the callback, pass all three returned display values to the redisplay accumulator, return no further redisplay |

The main Zmail frame overrides only these leaves and inherits the rest:

| Opcode | Main-frame override |
| --- | --- |
| `:MENU` | set command-button identity, resolve the menu item without side effects, execute it |
| raw `:MOUSE-BUTTON` | typein/mode-line: reselect and beep; elsewhere requeue the exact event and enter Command With Universe Or Filter |
| `SUMMARY-MOUSE` | set button identity, derive the row message, dispatch the active TV summary handler |
| `MODE-LINE` | set supplied button identity and execute supplied command |
| `BACKGROUND` | incorporate the supplied background response and return no redisplay |

Callback or command failure retains any prior callback-visible effect; the dispatcher
does not invent a transaction. Requeued input MUST preserve the original compound
event rather than reconstructing an approximate pointer action.

### Genera noneditor, pointer, and presentation tree

Before a filter, universe or profile editor is entered, the standalone frame accepts
only Refresh, `Control-R` to enter editing, Break, and Abort; other keys barf. Its
table is an input-loop sentinel, not an editor parent. Stray menu, mode-line and
summary blips beep; input-editor requests barf; Dynamic Windows wakeups are ignored.
Filter, Universe and Profile all use Lisp as their clean major mode. Entering edit
dynamically rebinds the standalone table to that mode comtab; the sentinel never
becomes a normal editor parent.

The G85 filter task exposes Not, And, Or, Close, Sample, Done, Abort,
Documentation, keyword/user/system/header/date menus and Name. It copies only the
extended-search `Control-H` delta into Lisp mode. Sample right chooses a universe;
other buttons sample the current sequence. Name left creates a name, while middle
and right select an old one. This executable branch disagrees with the pane
documentation that groups left and middle as “new”: `READ-NEW-NAME` compares the
mouse character by exact identity with `MOUSE-1-1`. Summary click inserts extracted
filter material. The universe
task exposes Union, Intersection, Not, Close, Buffer, Collection, Universe, Name,
Done and Abort; an evaluation error from Done reports the error and stays in the
task. The profile task exposes Filters, Universes, Mail files, Keywords, Hardcopy,
File options, typed choose-variable-values, Exit, Reset, Defaults, Save and Edit;
its left/middle/right associations and Save menu are part of the effective graph,
not generic editor input.

Normal/calendar/filter command-pane items use a common button policy. Middle requires
a configured quick default, rewrites the effective button to left and invokes it.
Right opens the options menu at the prior choice; cancel is a no-op, while a choice
updates the remembered value and button. Left or keyboard with no default barfs.
Summary rows are a separate TV path: left selects; middle invokes the profile summary
operation but leaves the global button recorded as right while the local action sees
left; right opens the conditional menu.

The clean source profile registers exactly 44 executable application-owned
Dynamic Windows forms. This denominator excludes the commented proposal in
`window.lisp` to replace the live TV summary-blip path: commentary is not an
effective translator. The 37 presentation-to-editor-command forms are:

| Owner | Exact translator names |
| --- | --- |
| calendar (5) | `SET-CONTAINING-WEEK-CONFIGURATION`, `SHOW-REMINDERS`, `ADD-REMINDER`, `SET-CURRENT-MSG-START-DATE`, `SET-MONTH-CONFIGURATION` |
| collections (4) | `KILL-SEQUENCE`, `SELECT-SEQUENCE`, `MSG-POINT-PDL-MOVE`, `SELECT-MSG-FROM-LINE` |
| commands (11) | `RE-EXECUTE-ZMAIL-MINI-BUFFER-COMMAND-FROM-MOUSE`, `EDIT-CURRENT-MSG`, `ZMAIL-SHOW-FILE`, `ZMAIL-EDIT-FILE`, `DRAFT-EDIT-FILE`, `EDIT-MSG-EDIT-FILE`, `ZMAIL-EDIT-CODE-FRAGMENT`, `ZMAIL-SHOW-MAILING-LIST`, `ZMAIL-SHOW-MAILING-LIST-ALL-LEVELS`, `EDITOR-SHOW-MAILING-LIST`, `EDITOR-SHOW-MAILING-LIST-ALL-LEVELS` |
| filter (8) | `MINI-BUFFER-STRING`, `INSERT-RECIPIENT-FIELD`, `INSERT-SENDER-OR-RECIPIENT-FROM-RECIPIENT-FIELD`, `INSERT-SENDER-FIELD`, `INSERT-SENDER-OR-RECIPIENT-FROM-SENDER-FIELD`, `INSERT-SENDER-OR-RECIPIENT-FIELD`, `INSERT-SUBJECT-FIELD-SEARCH`, `INSERT-SUBJECT-FIELD-EXACT-MATCH` |
| mail files (4) | `EDIT-MAIL-FILE`, `EXAMINE-MAIL-FILE`, `EXPUNGE-SEQUENCE`, `SAVE-MAIL-FILE` |
| mail (2) | `CONTINUE-DRAFT`, `REVOKE-DRAFT` |
| top level (1) | `ZMAIL-STANDALONE-EDIT` |
| universe (2) | `SELECT-MSG-CONVERSATION-COLLECTION`, `SELECT-MSG-AND-POSSIBLY-BUFFER` |

Two additional Command Processor presentation-to-command forms are
`COM-SHOW-EXPANDED-MAILING-LIST` and
`COM-SHOW-EXPANDED-MAILING-LIST-ALL-LEVELS`. The remaining five are pure
presentation converters:
`DAY-TO-UNIVERSAL-TIME`, `DAY-TO-REMINDER-DATE-TIME`,
`ADDRESS-TO-FILE`, `USER-AT-HOST-OR-SITE-TO-ADDRESS`, and
`ADDRESS-TO-USER-AT-HOST-OR-SITE`. A registry export MUST report these groups
as 37 + 2 + 5, as well as any site/world additions in a separate effective
denominator.

Their application-visible gesture tree is:

| Presentation and gesture | Applicability and effect |
| --- | --- |
| buffer point or blank / Select | enter standalone edit; message-edit variant requires current pane/node tester |
| minibuffer command / Select | reexecute command |
| pathname / no specific gesture | Show File operation-menu candidate |
| pathname / Edit Definition | Edit File in Zmail, Reply and message-edit contexts |
| expression / Edit Function | edit function in top-level Zmail |
| address / Select | expand mailing list; no-specific-gesture supplies all-levels menu; disabled while minibuffer owns input where specified |
| sequence / Select | select sequence |
| sequence / no specific gesture | Kill or Expunge candidates from distinct owners; operation menu resolves both |
| saved point / Select | move to saved point |
| message line / Select | select containing message |
| pathname / Select | Edit Mail File |
| pathname / Select and Activate | Examine Mail File |
| message buffer / no specific gesture | Save operation-menu candidate |
| message / Select | select its buffer/message unless killed |
| message / no specific gesture | construct/select conversation collection |
| draft / Select | Continue only if live |
| draft / no specific gesture | Revoke only if sent |
| week-containing-day / Select | Week layout |
| day / Select | show reminders |
| day / Describe compatibility gesture | add reminder |
| day / no specific gesture | set current message start date only when a current message exists |
| day to universal-time conversion | encode midnight at the day/month/year represented by the day |
| day to reminder-date-time conversion | wrap that midnight with the explicit date-only flag |
| month / Select | Month layout |
| minibuffer string / Select | insert filter form |
| recipient/sender/combined/subject fields | Select and selected source-defined Select-and-Activate insertion/predicate actions |

`no specific gesture` means an operation-menu candidate, not an implicit Select.
Header/address/path/subject presentation nodes are generated on demand. Parse failure
may suppress them, and merging a file recipient suppresses namespace lookup; absence
can therefore be the correct applicability result. Address/path/user-host and day
converters, and the two CP address-command translators, are part of the graph and
MUST report conversion failure separately from command inapplicability.

Calendar's duplicate labels are normative: the configuration registry contains two
literal `Message only` entries, one for the ordinary message layout and one for the
no-command-menu layout. `Summary//Message only` is a pseudo-toggle which alternates
the real Summary and Message configurations rather than a constraint layout.

### Genera numeric, prefix, Help, and unbound details

The G85 main loop resets the argument to one, presence false, digit count zero and
argument tag `NIL` before each command. The top reader preserves five tags, not
four collapsed values: `NIL`, `:SIGN`, `:DIGITS`, `:CONTROL-U`, and
`:INFINITY`. `Control-U` multiplies by four while retaining
`:CONTROL-U`; `Z` creates signed positive or negative octal `37777777` and
tags it `:INFINITY`; minus and digits exist in all four modifier banks. Each
command's registration independently accepts or rejects the resulting value and
tag. C303 retains the same five-way top-reader distinction.

The top Zmail table has no parent indirection. A null or hard-undefined cell clears
pending input and reports that the key is undefined; a symbol without a function
reports not implemented. Prefix input rejects mouse characters. When it must prompt,
it uppercases unmodified letters; when the next character was already typeahead it
does not, an exact historical quirk tested at `ZM-G85-PREFIX-CASE-01`.

Message/reply editor tables differ. During setup, address/header bindings are copied
into the active mode and mode-Control-X tables. Existing-message editing selects
Text; integrated drafts select their configured Text/Fundamental/Lisp mode, cleanly
defaulting to Text. Message direct keys then inherit that mode, and the empty message
Control-X overlay points to the mode child. Reply direct keys also inherit the mode;
its eleven Control-X leaves fall through the empty message child and then the mode
child. Complete effective enumeration therefore includes the pinned D05 parent and
live site/user changes; a list of D08 local cells alone is not a conformance result.

Zmail Help on `?`/Help accepts a key, menu item or `*`. Star sorts the command-name
association list in place and documents all. Character lookup uses the active Zmail
table and reports undefined input. Selecting Extended Command prompts for a command.
Help can descend the Map Over and Other submenus through their right-button behavior,
but it does not recursively flatten arbitrary menus. A report names membership in
main/Other/Map and prints at most four key paths, falling back to Meta-X. Generic
self-documentation mechanics belong to D07; this app-owned traversal is D08. G85
prints a post-report prompt saying that Space removes the display and another
character or command-menu click executes a command. The application body contains
no second input read; it runs inside a relative typeout-window wrapper. Exact event
reading, dismissal and forwarding therefore remain
`TODO-RUNTIME-ZM-G85-HELP-FORWARD` rather than a source-closed MUST. C303 has no
corresponding post-report prompt.

### Numeric arguments, repeat and unbound behavior

Numeric reachability is dispatcher-specific:

| Ingress/context | Reachable tags |
| --- | --- |
| C303 and G85 top Zmail command readers | `NIL`, `:SIGN`, `:DIGITS`, `:CONTROL-U`, `:INFINITY` |
| C46 editor and C303/G85 integrated or separate editor readers | `NIL`, `:SIGN`, `:DIGITS`, `:CONTROL-U` through the incorporated D05 reader |
| pointer, menu, summary, calendar, presentation and transient utility loops | no locally created numeric state; retain a state explicitly carried from a top/editor ingress, otherwise inapplicable |
| minibuffer input | the incorporated D05 minibuffer parent, not a D08-invented reader |

`:DIGITS` and `:CONTROL-U` MUST remain distinct even when their integer values
are equal: summary scrolling branches on that provenance in both full-reader
profiles. `:INFINITY` is top-Zmail-only because Large Argument is not installed in
the editor comtabs. A local command which rejects an argument MUST fail before its
semantic mutation. Commands whose source ignores the argument MAY behave identically
but MUST remain distinguishable to Help/testing from a command that consumes it.
Utility-loop tests MUST NOT synthesize numeric variants merely to fill the table.

For G85 Repeat Last Mini Buffer Command, numeric zero lists prior commands and
positive `N` selects the Nth prior command. Repeat Last Matching first restricts
history by the accepted substring and applies the same selection. Negative and
out-of-range behavior is inherited normatively from the selected D05 mini-input
history contract; D08 preserves the incoming numeric tag when delegating.

An absent fixed cell follows only the selected parent edge. A hard undefined cell
stops lookup. A named command without a key remains reachable by completion but MUST
NOT acquire a guessed binding. Menu accelerators, presentation gestures and System or
Select entry keys are separate ingress classes.

### Exhaustive enumeration requirement

For each selected context, an `L2` runner MUST enumerate the release's complete
character/modifier domain, recursively descend every prefix, enumerate each menu and
pointer-button variant, and enumerate typed presentation or TV blip handlers. Each
row MUST record:

1. active frame, pane, editor mode and task state;
2. candidate table/handler chain in lookup order;
3. numeric-argument state and applicability predicates;
4. chosen, shadowed, hard-undefined or unbound result;
5. owner and effect-contract section;
6. Help's effective report; and
7. pristine-release versus site/profile/user provenance.

The runner MUST separately cover top-level reader, summary, message editing,
integrated draft headers/body, separate Mail mode, filter, universe, profile,
calendar and typeout/minibuffer contexts present in the selected profile. A static
list of direct keys without these contexts is not a complete D08 binding tree.

## Genera Calendar and reminder overlay contract

The `CALENDAR` conformance subset is source-closed for the selected G85 source profile even
though its populated runtime views remain an oracle gap. It is not a generic modern
calendar: it is a Zmail view over messages whose parsed headers make them reminders.
Its date arithmetic and holiday results use the selected Genera Time subsystem. The
clean source defaults to hiding Year-view reminder highlights and to weeks beginning
on Monday.

### Calendar state and day-grid representation

Every calendar day grid MUST have shape `(N, 3)` plus two leader cells. Leader 0
is the exclusive active-range end and leader 1 is the inclusive active-range start.
All collection, rendering and hit-test loops use the half-open interval
`[start, end)`. The three row cells have these exact profile-dependent meanings:

| Cell | Pane-backed Month/Four Weeks/Week grids | Year month grid |
| ---: | --- | --- |
| 0 | interned day-pane identity | Boolean XOR-highlight state |
| 1 | `(midnight-universal-time day month canonical-year)`, or `NIL` outside the active range | the same date tuple |
| 2 | adjustable ordered item collection containing holiday strings and message identities | list of messages valid on that day, used only to decide highlighting |

Month and Four Weeks share a 42-row backing grid even when only four or five rows are
visible. Week uses seven rows. Each of the twelve Year month panes uses 31 rows and
sets its exclusive end to that month's actual length. Pane-backed frames also retain
the current message identity; Year retains the selected year, while Month retains
month/year and Four Weeks and Week retain a start day/month/year. Reset clears those
date selectors but does not invent a replacement date.

The minimum observable state machine is:

| State | Entry | Required transition |
| --- | --- | --- |
| reset | frame construction or explicit reset, no selected date | a configuration command chooses date state before rendering |
| configured | year, month, or start-date fields and active grid bounds installed | populate holidays, then reminders from the current sequence |
| populated | panes/highlights correspond to sequence and current message | message change performs per-day add/delete/current-style update; sequence change rebuilds |
| geometry-changed | pane size or Month row count changes | choose the matching constraint, preserve date state, and recompute scrolling |
| week-origin-dirty | Sunday/Monday option changed | strict profile updates Year, Month and Four Weeks only; the Week omission is preserved below |

For a full rebuild of a pane-backed grid, retain the leading holiday strings, remove
the prior message suffix beginning at the first non-string, traverse the selected
sequence, append every message valid for each date, then stable-sort each day's
items. The exact ascending sort key is:

| Item/header state | Key |
| --- | ---: |
| holiday or other non-message item | -3 |
| message has neither Reminder-time nor Start-date | -2 |
| selected header exists but has no explicit time | -1 |
| Reminder-time, or a Start-date explicitly containing time | seconds since midnight |

Reminder-time takes precedence over Start-date when both are present. Equal keys
retain the holiday-source or message-universe traversal order. An incremental add
uses the same stable order; a delete removes the identical message. The left scroll
bar exists exactly when item count exceeds the pane's inside-line count. The exact
source styling is bold text plus an arrow for the current message and italic text
for holiday strings.

### Reminder headers, parsing, and day predicate

The overlay adds these parsed message properties:

| Property | Required semantic representation |
| --- | --- |
| `:REMINDER-PERIOD` | a Time-package date-expression form |
| `:REMINDER-TIME` | seconds since midnight |
| `:START-DATE` | one or more `(universal-time includes-time-p)` pairs |
| `:EXPIRATION-DATE` | a universal time, with the existing multiple-value header representation accepted |
| `EXPANDED-REMINDER-PERIOD` | an internal expansion cached on the parsed-status object, not a serialized header |

Period input is read in the Time package and MUST expand as a valid date expression;
an invalid expression signals the Time parse condition. Reminder-period serializes
as the Time-package printed Lisp form after its header name. Reminder-time parsing
retains seconds, not merely hours and minutes, but its serialized header prints only
two-digit hour and minute and therefore does not preserve nonzero seconds.
Start-date parsing retains whether a time was explicitly supplied so its standard
date printer includes clock time only for a time-bearing value; repeated values use
the selected header layer's separate-field convention. Replacing or invalidating
the parsed status MUST also discard its expanded-period cache.

For a candidate day represented by midnight `D0`, civil day/month/year and
`D1 = D0 + 86,400`, the validity predicate MUST evaluate the present properties
in Expiration, Period, Start order. Every property that is present MUST pass, and at
least Period or Start MUST be present:

1. Expiration passes only when `D0 < expiration`; equality is expired.
2. Period lazily expands and caches the expression, then invokes it against the
   candidate civil day/month/year. A nonexpandable malformed in-memory value fails.
3. Start selects the last represented start value and passes only when its universal
   time is strictly less than `D1`.
4. Expiration alone never makes a message a reminder. A failed present property
   terminates with false.

The Start comparison intentionally has no lower bound. Thus a start-only reminder
continues to match later days unless Expiration or Period constrains it. A clone MUST
preserve this source behavior rather than silently turn Start into a one-day event.

The reminder-date-time accepted value is a one-element list containing
`(universal-time time-specified-p)`. Its printer distinguishes no date, date only,
and date with time. Reminder-time input accepts no value or a time of day and returns
`NIL` or seconds since midnight. Expiration input defaults to no expiration when
there is no Start; when Start exists, it defaults to midnight of the following civil
day. Explicit no-expiration input becomes `NIL`. Survey-date input defaults to
today's local midnight.

### Reminder commands and composition templates

These commands are part of the overlay's effect closure:

| Command | Preconditions and ordered effect |
| --- | --- |
| Set Expiration Date | require a current message; prompt using its parsed headers; after acceptance replace or delete Expiration and create the source undo record |
| Set Start Date | require a current message; accept reminder date/time; after acceptance replace or delete Start and create the source undo record |
| Compose Reminder | choose a template from the exact button branch below and enter ordinary local-mail composition |
| Add Reminder on Day | pass the selected day to the on-day template, then prompt for optional time and expiration |
| Survey Reminders | accept a day, print its civil heading and holidays, then survey the current sequence through the reminder predicate; it does not change user-visible message content, status, or selection, although parsing may populate the internal expanded-period cache |

Compose Reminder has this exact input branch:

| Effective button | Template decision |
| --- | --- |
| keyboard | use the keyboard indirection, whose default asks periodic versus once-only |
| left | once-only |
| middle | periodic |
| right or another command-button value | invoke the Reminder template chooser |

All reminder templates compose via local mail and the selected source profile's
shared draft machinery. Their mail payload starts from the basic reminder template,
which selects RFC733 headers plus standard Date and Message-ID:

| Template | Additional ordered fields |
| --- | --- |
| periodic | required Reminder-period; optional Reminder-time; optional Expiration |
| once-only | required Start; optional Expiration, defaulting from Start |
| on selected day | Start derived from selected day plus optional prompted time; optional Expiration, defaulting from the derived Start |

When no time is supplied for an on-day reminder, encode midnight and set
`includes-time-p` false. The summary printer gives Reminder-time precedence over
Start-date, displays a Start day/month when present or a period marker for periodic
messages, and displays clock time only when a time was explicit.

### Layout, rendering, and hit regions

Year is twelve equal month panes arranged as three rows of four. Each pane draws a
month heading, a weekday heading adjusted for Sunday- versus Monday-first operation,
and a seven-column date grid. It refuses geometry smaller than margins plus 24
character widths by margins plus nine line heights. Its requested vertical extent
is the lesser of the remaining height and
`16 + 27 * (TVFONT character height + 2)`. A day with at least one valid reminder
is XOR-highlighted only when the Show Reminders in Year Mode option is true.
Rebuilding with that option false clears old highlight state. Year never renders
message text inside a day.

Year hit testing returns a Day over a real date cell, Week-containing-day over the
valid partial row surrounding date cells, and Month over the rest of the month
presentation. It MUST NOT turn leading/trailing blank cells into nonexistent dates.

Month and Four Weeks use a two-line header followed by equal seven-column rows.
Month selects an exact four-, five-, or six-week constraint from month length,
starting weekday and configured week origin; inactive cells remain blank. Four Weeks
uses four rows and a heading that names the inclusive start and end dates. The
weekday header begins Monday when the option is true and Sunday otherwise. The
requested pane height is the lesser of three quarters of the remaining height and
two line heights plus `number-of-weeks * (inside-width / 7)`.

Week contains seven equal day panes for consecutive dates beginning at its stored
start date. Each pane has a full weekday/date label and renders the ordinary message
summary line. Month/Four Weeks day panes label only the day number and choose
short-subject, then Subject, then first text line. All day panes place holidays
before reminders through the sort keys above, visually mark the current message,
truncate sensitive item text to the pane, and recompute scroll-bar presence after
contents or geometry change.

These relationships are source-derived but have not been visually exercised in the
named G85 runtime. A conforming source-profile implementation MUST implement them;
a claim of pixel or preserved-world visual fidelity remains blocked by
`TODO-RUNTIME-ZM-G85-CALENDAR-VISUAL`.

### Calendar presentations and navigation

The Day presentation is `(day month year)`; Month is `(month year)`;
Week-containing-day carries `(first-day month year last-day)`, though the Week
translator normalizes from its first day and ignores the fourth element. Day parses
through the Time date parser. Month prepends day 1 to typed input; with neither typed
input nor default it reports missing month. The pure Day conversions are normative:
Day to universal time returns midnight, while Day to reminder-date-time returns the
one-element date-only representation.

The five calendar editor-command translators have these exact branches:

| Presentation/gesture | Result |
| --- | --- |
| Week-containing-day / Select | floor its first date to the configured Sunday/Monday week origin, set Week state, select Week configuration, refresh from sequence/current message |
| Day / Select | survey that day |
| Day / Describe | compose an on-day reminder |
| Day / no specific gesture | offer Set Current Message Start Date only while a current message is dynamically bound and non-`NIL` |
| Month / Select | set the selected month/year, select Month configuration, refresh |

Entering a named calendar configuration through its command-pane item derives a
starting value from the current clock, then applies this exact button tree:

| Configuration | Left | Middle | Right or keyboard |
| --- | --- | --- | --- |
| Year | current year | next year | accept integer 0–99 or 1900–2100 inclusive; the latter stores year minus 1900 |
| Month | current month | next month, with December-to-January year rollover | accept a Month presentation |
| Four Weeks | current date floored to configured week origin | start 21 days before that floored date | accept an arbitrary start date |
| Week | current date floored to configured week origin | start seven days after that floored date | accept an arbitrary start date |

Right/keyboard dates for Four Weeks and Week are used as entered and are not
renormalized. After date state is installed, post-setup repopulates from the current
sequence/current message. Choosing the same date may avoid redundant geometry
reconstruction, but configuration selection and required refresh behavior remain
observable.

Changing the week-origin option has an exact historical asymmetry. The ordinary
profile update method recomputes Year, Month and Four Weeks but omits Week; an
already displayed Week may therefore retain its old start. The separate full
recompute method resets and restores all four views, including Week. Strict
compatibility MUST reproduce the omission. An implementation MAY offer a labeled
safe extension that updates Week too, but its results MUST NOT be reported as the
strict profile.

### Calendar failure, abort, and mutation order

- Period acceptance rejects parse/expansion failures before template mutation and
  repeats until the Time confirmation succeeds. Declining confirmation returns to
  the period prompt.
- Date, reminder-date-time, time, Month and Year acceptance errors leave calendar
  and message state unchanged. The Year accepted ranges above are exact.
- A Year month pane that cannot fit its minimum dimensions refuses the new edges
  with a pane-too-small error; it does not silently clip into a different layout.
- The Day operation candidate for changing Start is absent when there is no current
  message. When present, it completes both the time and expiration prompts before
  mutating. It then writes Start followed by Expiration inside delayed redisplay.
  This is not a transaction and creates no command-level undo record in the selected
  source: failure of the second header write can expose the first.
- Set Start and Set Expiration each finish their one prompt before their one
  undo-recorded header update. Prompt abort therefore performs no header mutation.
- Rebuilding a calendar calls message parsing while traversing the sequence. A parse
  failure may leave earlier day collections updated; there is no overlay-wide
  rollback. The implementation MUST surface the failing message and partial result.
- An empty or absent sequence still permits the configured dates and holidays, but
  contributes no reminder messages.

## Lifecycle, failure, and recovery model

### Reader selection and startup

Reader construction and reader invocation are separate profile-specific transactions.
Neither C303 nor G85 waits for a completed login and opened mailbox before making its
newly initialized frame selectable.

`ZM-C303-ZMAIL` initialization kills an old frame if present, creates the frame and
its editor/background state, initializes the command table, conditionally registers
System `M`, registers the Mail System Menu item, resets pathname/user/view state, and
then activates the frame. Programmatic `ZMAIL` separately handles `:RELOAD`, forces
login, queues `STARTUP-ZMAIL-BUFFER`, selects the already active frame and waits for
exposure. Selection through the frame process can force login after selection, install
the null-startup view when no ZMail user is set, run the command loop, then deselect
and bury the frame.

`ZM-G85-ZMAIL` initialization kills an old frame unless invoked from one of its
inferiors, resets declared initialization state, creates the unique frame, initializes
both ordinary and `Control-X` tables, snapshots pathname/template state, resets the
user and background worker, and activates the frame. `SETUP-ZMAIL-FRAME` initializes
if absent, moves the unique frame to the usable default screen, and reinitializes it
if it is not selectable. Programmatic `ZMAIL` rejects a remote terminal, optionally
reloads, forces login, queues sequence selection, selects, and waits for exposure.
The frame process may itself wait for selection or login enablement, force login in
its message-pane typeout window, install the null-startup view, run the command loop,
and bury the still reusable frame on return.

Only after those entry-specific steps do profile loading, default-sequence selection,
inbox discovery, and an initial configured view occur. Failure at login or file-host
resolution leaves exactly the empty/prior/selectable state produced by the selected
entry; it MUST NOT invent a mailbox or retroactively claim that activation waited for
login. The Genera runtime proved that local login can reach an empty reader, while
integrated Mail immediately failed on unavailable `DIS-SYS-HOST` file operations.

### Foreground command transaction

For one reader command:

1. Finish any prior response incorporation and required redisplay.
2. Reset per-command argument/button/current-command state.
3. Read a keyboard, TV blip, menu, pointer or presentation event.
4. Resolve it through the effective context tree.
5. Validate sequence/message requirements and dangerous-command policy.
6. Execute under required sequence/buffer locks.
7. Update ticks, caches, status, current selection and point stack in source order.
8. Enqueue background or service work only after its request object is complete.
9. Return a redisplay degree and update panes/typeout/mode line.

An editor `BARF`, unbound input, parse condition, file condition or explicit abort
returns through the selected command-loop recovery. Mutations completed before the
failure remain unless the command itself records and performs an inverse. D08 does
not promise transaction-wide rollback.

### Background worker ordering

The foreground and background worker communicate through explicit request/response
state. They MUST NOT concurrently mutate a sequence outside its lock domain.

For `ZM-G85-ZMAIL`, ordinary background requests are pushed and selected from the
front, making them **LIFO** despite a nearby source comment calling the queue FIFO.
Preload requests alone are appended and therefore FIFO. The runner MUST test both
orders. The process is named `Zmail background`, has priority -1 and scheduler
quantum 10. Independently, background load processes at most 20 messages per work
quantum; save and parse
process at most 10 before yielding. A port MAY use different scheduling primitives,
but at an `L3` observation point it MUST reproduce these ordering and yield
boundaries.

Background work MUST yield for the selected interaction policy. Genera requires at
least five seconds of keyboard inactivity for ordinary work, pauses for pointer
speed above 2.5, reserves at least 12 response-buffer entries and 25 percent of the
buffer for foreground work, permits configured work while deexposed, and separately
requires exposure for periodic mail checks.

`ZM-C303-ZMAIL` has a separate background process, lock, request cell, response queue
and preload queue. Ordinary requests are pushed onto the request-cell list and the
worker selects its first element, so they are LIFO. Preloads are appended and popped
from the front, so they are FIFO. One load or active preload quantum reads at most
five messages, one parse quantum parses at most five previously unparsed messages,
and one save quantum emits at most 50 lines. The clean source gives the process
default priority -5. Its selected defaults enable background checks and saves because
the inhibit options are false. Exact live scheduling, pauses and finish races remain
`TODO-RUNTIME-ZM-C303-BACKGROUND`; queue order and the 5/5-message/50-line work limits
are source-closed requirements, not part of that oracle gap.

### Composer entry and initialization

Composer entry MUST decide reuse before changing text:

- C46 no numeric argument resets `*MAIL*`; a numeric argument preserves it.
- C303 no argument invokes the default Zmacs mail template; resume preserves the
  special buffer.
- G85 uses the three-way numeric behavior specified above and refuses entry if
  Zmail is not loaded.

On initialization, construct the To field, optional recipient/subject/other headers,
the exact profile separator and optional body. Select point by this priority:
missing recipient, required missing subject, caller-provided body index, otherwise
body end. Run a selected template only after the base structure exists. The clean
C303 path discards undo history and marks the new template unmodified; later edits
make it modified.

### Quit and abort

Quit without transmission is profile-sensitive:

- C46 announces a resume route and exits the special buffer; it does not erase the
  draft.
- C303 kills an unmodified freshly initialized buffer after exit; a modified draft
  is retained and the user is told how to resume. A caller requesting top-level exit
  also leaves the editor after cleanup.
- G85 rejects a pending numeric argument with a beep. During keyboard-macro entry it
  aborts to top level rather than abandoning composition. Otherwise it may save a
  parseable standalone draft into a Zmacs buffer, reports the appropriate resume
  route, and exits without update.
- Integrated ZMail/Zmail Abort Send follows its ordinary confirmation/preservation
  policy; the C303 Super-Abort path is the explicitly stronger variant.

No abort path may be reported as a send. If the user cancels a destructive prompt,
message, draft and file state MUST remain at the prompt's pre-mutation boundary.

### Reader quit, bury, kill, and reinitialize

Ordinary Quit is not frame destruction. In C303 it selects Save, Ask, or Don't Save,
then deselects and maybe buries the reusable frame; optional Logout occurs afterward.
In G85 it performs the selected save policy, optionally logs out, throws from the
command loop, and the process top level buries the reusable frame. Neither ordinary
Quit kills the background worker or makes the frame permanently unselectable.

Frame kill/reinitialization is a separate operation. It abort-closes owned streams as
the selected source specifies, unlinks/kills auxiliary frames, and in G85 explicitly
kills the Zmail background process. Reinitialization may kill the old frame and create
a new unique frame. A failed save prevents any success claim and leaves exactly the
source-produced dirty/partial state. Force closing the host VLM or emulator is neither
ordinary Quit nor orderly frame kill and says nothing about mail persistence.

## Reader, collection, and message contracts

### Selection and movement

Selecting a sequence MUST save the prior sequence's current message, install the new
ordered population, restore its saved current message when valid, otherwise apply the
selected first-message policy, update displayed indexes, invalidate summary state and
select/redraw the required panes.

Movement commands select by predicate and direction over the current sequence:
ordinary, undeleted, unseen and recent variants MUST remain distinct. First/last
variants scan from the corresponding endpoint. If no matching message exists, the
command reports failure without changing current message. The message point stack
stores sequence plus message identity, not merely a row number, so a pop can return
across sequences or report that the target no longer exists.

`Jump` with a numeric message number validates the displayed range before selection.
Filter-based Goto constructs a predicate/selection interaction. Those are distinct
operations in `G85` even where a menu prints `Jump`.

### Message and summary display

The message pane displays the current message's selected header view and body. Header
reformatting MUST preserve an accessible original-header representation until the
selected command explicitly discards/restores it. Changing a message, header style,
character style or parsed property invalidates the message and summary caches which
depend on it.

The summary is an ordered projection. Each row MUST retain message identity independent
of its displayed ordinal. Its template controls fields such as number, length, date,
sender/recipient and subject/text. Rebuild MUST update displayed indexes atomically
with the row list so a pointer event cannot select the wrong message after a sort or
filter change.

Summary-only, message-only and Both configurations preserve one current sequence and
message. Changing configuration changes visibility and input routing, not logical
ownership. Message scroll and summary scroll maintain separate positions and
increments; the clean C303/G85 summary increment is 20 percent of the summary pane.

### Delete, undelete, remove and expunge

Delete sets the message's deleted status and then applies the configured movement
direction. Undelete removes that status. A profile may bind Delete And Up or choose a
different post-delete direction; the exact command decides whether movement occurs
before or after an error.

Remove is valid only for a temporary collection. It removes the reference from that
collection, selects the next valid row and leaves the owning mail-file message/status
unchanged unless the selected command separately modifies it.

Expunge is a persistence operation:

1. Determine affected disk-backed sequences.
2. Apply the selected confirmation policy before deleting membership or rewriting a
   file.
3. Lock each affected sequence in source order.
4. Remove deleted messages from the persistent representation and in-memory sequence
   according to the selected format's safe ordering.
5. Repair current/saved messages, indexes, reference caches and ticks.
6. Commit replacement/append state and release streams/locks.
7. Report each failed file distinctly and leave it dirty/retryable.

The clean C303 and G85 sources default to no expunge confirmation. A configured
profile may change that. A multi-file failure MUST NOT be reported as an all-files
success; completed files remain completed unless the source uses a replacement
rollback for that format.

### Filing, concatenation and buffer lifecycle

Move copies/appends the selected message to the destination buffer through that
buffer's format adapter. Only after the destination accepts the message may the
source apply its delete-after-move policy; the clean sources enable that policy.
Failure before destination acceptance leaves the source undeleted. Failure after
destination acceptance but before source deletion is a partial move and MUST be
reported without deleting the accepted destination copy.

Concatenate combines message content with the selected destination message in the
source-defined order. Append/Move relative to a referenced message first resolves a
unique live reference; missing or ambiguous references fail before mutation.

Killing a temporary collection releases only collection state. Killing a dirty
disk-backed buffer follows save/confirm policy and MUST NOT silently discard changes.
Rename changes the sequence's user-facing identity; whether it renames a backing file
is a separate explicit operation.

### Get new mail and inboxes

The primary mail buffer and its inboxes are distinct objects. Get New Mail identifies
configured and recovery inbox sources, establishes the selected status, reads complete
messages through the inbox adapter, inserts them in the selected append/prepend/reverse
order, marks new/unseen/recent state, invalidates caches, and publishes completion in
the selected foreground/background order. Source-file rename, insertion, destination
save, and source deletion are not one transaction and MUST follow the selected profile.

C303 may rename an inbox source before reading it. It retains pending inserted-source
records through destination save, but after that save its delete loop prints a deletion
error and clears the pending list even when deletion failed; a clone MUST reproduce
that retry-loss edge in strict mode. G85 tracks renamed/inserted identities through
its inbox-buffer `:PARSING` and `:INSERTED` states and deletes them during save finish;
a non-file-not-found deletion error occurs after output close while `:SAVED` and the
pending identities remain observable. The Genera option to complete inbox reading in
the background is enabled by default, and automatic jump after retrieval is disabled
by default. Both profiles may retain already inserted complete messages after a later
failure, but they do not share one universal recovery invariant.

### Search, filters and universes

This section gives the cross-profile application contract. The complete executable
languages, exact option inventories and release-specific defects are incorporated
from the [System 303](mit-cadr/zmail-filter-universe-profile-semantics.md) and
[System 452.1 / Zmail 442.0](genera/zmail-filter-universe-profile-semantics.md)
semantic companions.

Find String searches from the current message position. Occur searches a selected
population and produces a report/selection without confusing text matches with
message identities.

A filter evaluation MUST:

1. freeze the chosen universe and traversal order;
2. parse only the properties required by the predicate, exposing parse errors;
3. evaluate the predicate once per candidate unless the source explicitly retries;
4. preserve source order unless a selected sort follows; and
5. return a temporary collection or summary selection with stable message identity.

Map Over takes that result and applies the chosen command in order. Delete, Undelete,
Type, Find String, Keywords, Unkeywords, Move, Forward, Redistribute, Reply,
Concatenate and the profile-specific additions remain distinct command adapters.
Commands which require one message versus a population MUST validate that distinction
before mutation. Exact continue/stop behavior after an injected mid-map command error
is `TODO-RUNTIME-ZM-C303-MAP-FAILURE` and `TODO-RUNTIME-ZM-G85-MAP-FAILURE`; a port
MUST declare its interim policy rather than claiming `L3` fidelity.

Named-command behavior is not inferred from labels. Every one of the 86 C303 and
152 G85 completion candidates follows the ordered validation, mutation, delegation,
partial-failure and ownership record in the
[named-command effect closure](zmail-command-effect-closure.md). Rules, undo/redo,
encryption, ECO restore, GMSGS and other multi-step commands deliberately expose
nontransactional prefixes where that source does; a reconstruction MUST NOT silently
roll them back or advertise a downstream subsystem as ZMail-owned.

### Keywords, sorting and references

Keyword addition/removal updates message status, persistent-format capability,
summary cache and modified ticks. A format unable to persist a property MUST expose
that limitation before claiming a clean save. Keyword-list editing changes the
available vocabulary separately from applying a keyword.

Sort computes keys from parsed fields and changes sequence order while preserving
current message identity. Equal keys MUST use the selected release's stable/tie
ordering; where not runtime-verified, exact tie order remains
`TODO-RUNTIME-ZM-SORT-TIES`.

Reference operations build conversation membership from message identifiers and
reply/reference headers. They MUST tolerate missing ancestors, detect duplicate
identifiers and invalidate the reference index after relevant message/header changes.
Select, append, move, delete, compare, survey and merge-keyword operations over a
conversation use the same resolved ordered member set but retain their distinct
mutation semantics.

### Digests, duplicate detection, reformatting and rules

Undigestify is profile-specific. C303 first recognizes two separators, and when its
clip option is enabled it deletes the original body tail **before** constructing and
inserting children one at a time immediately after the original. Each child receives
the inherited destination header and optional derived subject. Only after the loop
finishes does the default delete option mark the original deleted. A mid-loop failure
can therefore leave a clipped original plus partial children, but not the final delete
mark from this invocation.

G85 first recognizes and constructs the complete child list, saves undo state,
optionally selects a recycled collection containing the original, completes pending
input on the owning buffer, and then inserts children in order into the buffer and any
active collection. It updates character mappings and child To headers, adds the child
message identifiers to the original's References header, and rearranges affected
sequences. It retains the original; it has no C303 delete/clip step. A construction
failure precedes insertion, while a later insertion/header failure can leave the
source-visible partial prefix. Strict implementations MUST NOT average these orders.

Duplicate detection compares the selected source identifiers/content criteria. When
deleting a duplicate, Genera inherits Answered, Filed, Forwarded, Sent, Keywords and
Redirected state from the retained message as defined by source; it does not blindly
copy deletion, file-format or display-cache properties.

Reformat/Unreformat changes derived header display and saved state according to the
format's capabilities. A source Rule operation is an explicit profile overlay and
MUST report each message/action result; it MUST NOT be treated as a hidden background
filter.

## Composition and draft contracts

### System 46 request-file composer

`ZM-C46-COMPOSE` initializes this editable structure:

~~~text
To: [optional initial recipient]
--Text follows this line--
[optional initial body]
~~~

The header scan is line-ordered and stops at the body boundary. For each requested
prefix, `MAIL-PARSE` returns the first case-insensitive prefix match only when the
line is strictly longer than the prefix; a bare `To:`, for example, is ignored.
`From:` and the first line matching either `Subject:` or `S:` return the raw
substring after the prefix, without generic whitespace trimming. Unknown header
lines are ignored.

To collection starts at the first header line, resumes at the line after each match,
and therefore emits all To lines in their header order. Cc collection then starts
again at the first header line and emits all Cc lines in their header order. Within
each matched line, split literally on commas, trim only space and tab from each
piece, omit a piece empty at that point, and strip exactly one outer parenthesis pair
when both ends match. Do not implement quoted-comma syntax. The nonempty test
precedes parenthesis stripping, so `()` is still emitted as an empty parenthesized
recipient and counts as a To result in the strict profile.

Transmission validates the separator before opening the request output. If the
current default file host is not ITS-flavored, it changes the default to `AI`. It
then opens `DSK:.MAIL.;MAIL >` and emits, in order:

~~~text
FROM-JOB:LISP-MACHINE
SENT-BY:<current-user-id>
[CLAIMED-FROM:<From value>]
[SUBJECT:<Subject or S value>]
TO:"(<recipient>)"
[more TO records; Cc records include the R-OPTION CC marker]
TEXT;-1
<body lines>
~~~

At least one emitted To piece is required; Cc alone does not satisfy that check.
Separator validation precedes output open, but the no-To check occurs only after the
request file has been opened and the initial, optional From, and optional Subject
records have been written. A no-recipient failure can therefore leave that prefix
of the request file. The request file is the delivery handoff. Successful close then
exits the special editor. Missing separator or recipient, open/write/close failure,
or abort does not exit through the successful-send path. A failure after output
begins MAY leave a partial request file; strict compatibility MUST expose the exact
written prefix and MUST NOT label it delivered.

### System 303 separate Mail mode

The System 303 editor uses the configured mail header delimiter and initializes Text
mode plus Mail minor mode. It recognizes structured address navigation and its
`Control-X` field commands. `MAIL` has two noninteractive cases:

- when text is supplied and editor use is false, submit the supplied string directly;
- otherwise enter Zmacs Mail composition, with `T` as the recipient meaning resume.

Send requires the delimiter bounded by line breaks. It passes header and body
intervals to ZMail's `SEND-MESSAGE`; on successful return it exits the special buffer
with update true. A missing delimiter fails before submission. A send failure retains
the buffer and MUST NOT run successful exit.

### Genera separate Mail mode

Genera first verifies that Zmail is loaded, then forces user login, selects/creates a
Mail special buffer and initializes Text/Mail state when required. Failure of the
loaded check occurs before login or buffer selection.

New buffers contain To, optional Subject/other headers, the exact editor separator
alone on a line, and body. Filling treats the separator as a paragraph boundary.
The Add File References command chooses a default from the recent buffer history but
accepts an explicit pathname and inserts a typed File-References header.

On send:

1. locate the separator as a trimmed whole line;
2. if the buffer has prior recipient results, run the configured retransmission
   policy, optionally adding Supersedes and Comments;
3. call the shared Zmail sender with header and body intervals;
4. copy returned recipient state from the generated draft into the Mail buffer;
5. for a standalone mail frame, preserve the parseable draft in Zmacs; and
6. exit with update true.

The clean retransmission policy is Ask. If the user declines Supersedes, submission
continues without it; if the user cancels the containing query, the selected abort
semantics apply. A send error after adding headers leaves those edits visible and the
draft resumable.

### Integrated draft creation

Mail, Reply, Forward, Redistribute, Redirect, Continue, Local and Bug operations
create or reuse a draft object and switch the reader frame to Send or a reply
configuration. Header, body and original-message panes share the reader's editor
closure. Recursive Mail pushes the enclosing draft/task state and restores it after
the child finishes or aborts.

Reply construction has three independent dimensions in Genera:

- seven recipient policies: All, All-Cc, Cc-All, To, To-Cc, Cc-To, Sender;
- three original-message policies: Two Windows, One Window, Yank; and
- two header policies: Prune, Do Not Prune.

The resulting 42 combinations MUST be generated from the dimensions so profile
defaults and button choices remain composable. System 303 retains its release's
recipient/display/header dimensions, including its one/two/three-window controls.

Forward, redirect and redistribute are not aliases:

- Forward creates a new message body containing or referring to the original;
- Redistribute transmits the original with redistribution metadata; and
- Redirect changes the destination path while preserving the selected source-defined
  origin semantics.

The implementation MUST update Answered, Forwarded, Redistributed, Redirected or Sent
status only at the source-defined success boundary.

In G85, composition unwind always swaps out/saves window state and removes no-fill
mode. It discards only a truly unused draft whose node tick has not advanced beyond
its creation tick and which has no transmission timestamp; edited or used drafts are
retained. Split/merged header/body transitions find the blank separator or force a
newline, and their pane points must round-trip. Abort Send has exact guards: a
numeric argument beeps and does not abort; an active mark makes the command a no-op;
keyboard-macro execution barfs; an unused draft is abandoned; an edited/used draft
is retained before control returns to the reader. Blanket manual wording does not
override these branches.

### Draft field and body editing

Header-field commands create or select a correctly typed field and leave point at
the source-defined edit position. Address movement respects parsed address boundaries,
not word syntax. Add More Text restores body editing. Yank Current/Replied Messages
inserts selected text and optionally prunes headers according to the effective
profile.

Draft save, restore, write and Save As Message are separate operations:

- Save Draft File updates the associated default draft pathname;
- Write Draft File obtains a new pathname without silently changing unrelated mail
  files;
- Restore replaces or merges the selected saved draft per source behavior; and
- Save As Message stores a message object in the selected mail file/sequence.

Failure after a file write begins is reported with the draft still live. A port MUST
NOT mark the draft clean unless the selected save operation completed its commit.

### End, send and abort policy

`Mail End` is not an unconditional Send key. Its effective profile value selects
Send, a two-choice send query, Add More Text, or a two-choice text query. The
implementation MUST evaluate that policy at key time. Direct `Control-Altmode`
bypasses Mail End and invokes Send Message.

Sending validates required headers and subject policy, normalizes addresses, derives
reply/message identifiers, selects header-output style, constructs the envelope,
applies file-copy requests, and calls the transport adapter. Prompts occur before the
mutation they authorize. An adapter's partial recipient success MUST remain attached
to the draft so retry/retransmission can avoid a false all-or-nothing account.

G85 canonicalizes file recipients, clears prior recipient/status/timestamp state,
expands headers, and prompts on repeated expansion. A nonempty unhandled header or
empty recipient set aborts before service selection. A per-expansion before-hook may
suppress transmission; if it returns normally, it has taken ownership, and normal
after methods may still mark source messages Answered/Forwarded and the draft Sent.
Each recipient moves through Transmitting to its returned disposition. Earlier
recipient success remains if a later service fails, but source/draft success marking
occurs only after the whole primary operation returns normally. Programmatic
`SEND-MESSAGE` parses a fresh Zmacs draft; make-draft-and-transmit sends before dummy
message/undo registration, so failure leaves no dummy to imply persistence.

## Mail-file and persistence contracts

The cross-profile protocol below is refined normatively by the
[mail-file format semantic companion](zmail-mail-file-format-semantics.md). That
companion controls exact recognition order, logical-character grammars, parser
states, option/property mappings, serializers, partial writes and fixture results.
This section controls how those adapters participate in the wider application.

### Format adapter protocol

Every selected format implements:

| Operation | Required result |
| --- | --- |
| `recognize(path, prefix)` | format identity or explicit no-match/ambiguous result |
| `new-buffer(path, options)` | typed empty buffer and initial file header/trailer |
| `parse-next(stream, state)` | one complete message, next state, or typed EOF/parse error |
| `parse-options` | supported file/message attributes with unknown-field preservation policy |
| `capabilities` | append/rewrite, reparse, persistent attributes/options, inbox behavior |
| `serialize-message` | exact selected representation and property mapping |
| `save/append` | committed result plus partial-write state |
| `expunge` | safe replacement/commit result and recovery pathname/state |

There is no release-independent “pathname, signature, override” pipeline.
`ZM-C303-ZMAIL` and `ZM-G85-ZMAIL` MUST use these separate transactions.

For an existing C303 file:

1. merge/translate the pathname and open its input stream;
2. reuse the matching open buffer, or handle its changed-file conflict, before
   constructing another buffer;
3. when the caller supplied a buffer flavor, use it without detection; otherwise
   pass the already-open stream to the pathname host's format computer;
4. let that host method combine its content signature and host default, returning
   append state where defined, and restore the stream pointer after every probe; and
5. construct the chosen flavor and begin loading.

For a new C303 file, an existing default buffer supplies flavor/sticky options when
selected; otherwise explicit flavor precedes the pathname host's no-stream default.
The append/prepend profile is then applied, and the right-button options path may
replace the selected flavor/options. These new-file decisions are not content
recognition.

For an existing G85 pathname, buffer reuse and changed-file conflict resolution
occur first. Only when a new buffer is needed does selection proceed:

1. explicit interactive Select Format and Options, when requested;
2. otherwise explicit `FORMAT`;
3. otherwise the pathname-derived default; and
4. otherwise the pathname host's default-default format.

The buffer is constructed before content/apparent-format checking. Automatic format
error handling is enabled only when neither explicit Format nor interactive
selection fixed the choice. On the first wrong-format condition, abort the current
load; when the condition supplies an apparent format, change the buffer flavor and
retry. A missing apparent format propagates to the ordinary retry UI. Subsequent
attempts offer the user a different-format restart and the normal retry loop; they
do not silently keep auto-changing forever.

For a new G85 file the distinct default chain is explicit Format, pathname-derived
default, compatible current/default-buffer flavor, then host default-default.
Caller options win over copied sticky options; the append policy is applied, then an
explicit Select Format and Options request may replace the result. A forced format
MUST remain recorded, and an apparent-format mismatch MUST follow the selected
restart path rather than silently rewriting file content.

### System 303 registered formats

The active source registers six selectable buffer flavors:

| Name | Source-established representation |
| --- | --- |
| Rmail | ITS RMAIL message file |
| Babyl | Babyl versions 4–5 with file/message options |
| Tenex | TENEX-family length/count-oriented message file |
| Unix | Unix mailbox with `From ` boundary/header handling |
| VMS | VMS mail-file adapter selected by VMS pathname behavior |
| Text | write-only export separated by the configured text separator; not reparsable as a ZMail input file |

The active non-Symbolics local-filesystem integration defaults mail files to Babyl,
with `BABYL TEXT >` as the possible main file and `MAIL TEXT 0` as the new-mail
pathname. ITS-path recognition distinguishes a leading Babyl options line from
Rmail. TENEX- and Unix-family pathnames can also recognize Babyl. The comment-only
`lmfile` and unselected `lm.lisp` do not define strict-profile behavior. The
format's `possible` set is host-specific; the global registry is not a promise that
every pathname offers all six.

Strict format behavior includes these release-specific rules:

- Rmail and Babyl are distinguished on ITS by whether the first line is exactly the
  Babyl options marker. An ITS message boundary is a line beginning with
  Control-Underscore and containing only space, tab or formfeed afterward.
- Babyl accepts versions 4 and 5. Another version signals a continuable error rather
  than being silently upgraded. Its original/status header and display header are
  divided by the `*** EOOH ***` sentinel; version-5 status and file options are
  parsed and serialized as distinct grammars.
- Tenex consumes the received-date line, decimal byte count and octal status bits.
  Its damaged-boundary/count recovery is observable and MUST be selected separately
  from strict rejection.
- Unix recognizes candidate `From ` boundaries with the source's weekday/date
  heuristic. A line that merely begins with those bytes but fails that test is
  message content. The selected source has no general mboxrd unescaper or matching
  serializer escape pass: its adjacent `From `/`>From ` test is only part of the
  envelope-candidate heuristic. Strict compatibility MUST preserve that limitation;
  safe mboxrd escaping is a separately named extension.
- VMS recognizes formfeed boundaries and either fixed fields or a CHAOSMAIL header.
  The ZMail 50/System 94 manual calls VMS and Multics unimplemented; the selected
  maintained source implements VMS but has no Multics adapter. This is a release
  delta, not permission to add Multics to `ZM-C303-ZMAIL`.
- Text has serialization support but its `mail-file-reparsable` predicate is false.
  The supported arbitrary-format UI therefore excludes it. An adjacent source
  comment says a forced read should produce no messages, but executable control flow
  disagrees. Consecutive nonblank lines each set the common reader's start and become
  one-line messages. On an initial or intervening blank/space-tab-only line, the
  always-true callback reports an end while start remains null, and buffer-pointer
  construction faults before another message is published. Strict source semantics
  MUST reproduce both boundaries; the exact runtime condition/cleanup and whether an
  outer wrapper ever enforces the comment remain
  `TODO-RUNTIME-ZM-C303-TEXT-FORCED`. A port MAY reject or prominently label
  reopening as a separately selected safety extension, but MUST NOT call that
  extension strict source behavior or pretend the export round-trips.

### Genera 8.5 registered formats

Genera registers Babyl, Rmail, KBin, Tenex, Unix, Directory and Text. The public
Genera 8 manual names the first five; Directory and Text are 8.5 source-visible
extensions. Directory stores one message per file. Text uses blank/configured
separators on output, reads an input file as one large message, is explicitly
non-reparsable, and is consequently filtered out of the arbitrary-format chooser.
KBIN is a preparsed 16-bit binary representation
supplied by the optional KBIN subsystem.

Recognition is host-family specific and every content probe MUST restore the stream
position. The strict possible/default sets are:

| Host family | Possible formats | Default |
| --- | --- | --- |
| LMFS/native | Babyl, Rmail, Directory, KBIN, Text | Babyl |
| ITS | Rmail, Babyl, KBIN, Text | Rmail |
| Tenex family | Tenex, Babyl, KBIN, Text | Babyl, append enabled |
| Unix | Unix, Babyl, KBIN, Text | Unix, append enabled; pathname `RMAIL` maps Babyl |
| Macintosh | Babyl, Rmail, KBIN, Text | Babyl |

KBIN magic/bounds/endian recognition and the Babyl first-line marker precede
fallback. Source comments saying that some defaults “should” be KBIN are not active
behavior.

Exact KBIN bytes remain licensed-oracle work. An implementation MAY mark KBIN
unavailable at `L1` and under the companion's `FMT-L2-G85-TEXT` claim, but MUST NOT
expose an in-memory stub under the historical name. Only a selected
`STORAGE-G85-KBIN` / `FMT-L2-G85-KBIN` claim requires the source's recognized bytes,
upgrade/reparse command behavior and failure semantics under
`TODO-RUNTIME-ZM-G85-KBIN-BYTES`.

### Loading, saving and commit ordering

Load publishes only complete messages. A parse error attaches to the source position
and buffer; previously loaded messages remain available unless the format explicitly
requires whole-file rejection. The buffer does not enter idle/complete state until
the foreground consumes the completion response.

Save chooses append versus rewrite from format capability, buffer options, mutation
type, host/version semantics, and the selected profile's actual implementation. The
adapter MUST expose whether it writes in place, creates a new host version, or uses a
temporary/replacement identity; D08 imposes no universal rename transaction. Append
records only the accepted suffix. Unknown options/headers are preserved, rejected or
normalized according to the selected format—not silently discarded by a generic
serializer.

An interrupted save records the selected source-visible stream, status, last accepted
unit, file identity, pending inbox identities and any recovery pathname. Authority and
dirty state change only at that adapter/profile's commit boundary. Close, versioning,
deletion, or rename failures retain the exact partial state below; a clone MUST NOT
invent a recovery artifact which the selected source never created.

### System 303 persistence order and partial results

The maintained implementation does not provide one transaction around multi-file
mail handling. Strict `C303` mode MUST preserve these observable boundaries:

1. An inbox source MAY be renamed before its messages are read. A later parse or
   insertion failure therefore leaves the renamed source as recovery evidence.
2. Pending inbox files are deleted only after the destination mailbox save. A delete
   error is printed, but the pending list is then cleared; the same process does not
   automatically retry that deletion.
3. Merge first splices interval/node structures and then updates message arrays. An
   injected failure can expose a partially merged in-memory structure; no whole-merge
   rollback is promised.
4. Save All expunges every selected buffer before saving any of them. A later save
   failure therefore follows already completed in-memory expunging.
5. Expunge applies expiration deletion before its expunge confirmation. Declining
   the later prompt need not undo messages already marked deleted by expiration.
6. Foreground-save unwind calls the saving-aborted transition only while the buffer
   remains in the expected saving state. The foreground/background finish path can
   abort-close a `:SAVING` buffer and set it to `NIL` rather than restore
   `:SAVING-REQUIRED`; this source-visible edge remains a required fault test.

A safer clone MAY offer a transactional extension, but its strict profile must emit
the historical intermediate results or reject that compatibility claim.

### Genera load, new-mail, and save state machines

G85 load accepts `:IDLE`, or `:LOADING` only when pending inboxes justify it, and
publishes `:LOADING` before open, identity verification, file header and background
queue work. A background quantum adds at most 20 complete messages. Normal completion
reaches transient `:LOADED`; foreground finish closes the stream, captures file
identity, clears stream state, queues old parse work, restores options/selection and
enters `:READING-NEW-MAIL` for pending inboxes or `:IDLE` otherwise. Default load
abort kills the new sequence/mail file. Its survival path flushes load/parse work,
destroys partial messages with nested aborts masked, repairs the active array and
parse queue, abort-closes the stream, and reaches `:IDLE` or intentionally remains
`:LOADING` for pending inbox work.

Read New Mail first completes transient loads/saves and aborts an active save because
a fresh save follows. Under background, write and all-inbox locks, it flushes parse
work, enters `:READING-NEW-MAIL`, loads and inserts inbox messages, then reparses and
selects. Completion waits until every inbox has been inserted. Finish closes inbox
buffers, runs hooks/sort, clears compaction state, enters `:IDLE`, and background
saves unless inhibited. Abort flushes new-message parsing, aborts every inbox load,
kills/compacts only additions from this attempt with aborts masked, and repairs
selection, list and status. Ask, Auto and Stop policies for inbox-save queries and
their restarts are distinct.

Save acquires the write lock and offers retry, fix and skip restarts. With no tick
newer than the last save, it reaches transient `:SAVED` without writing, but finish
still performs pending inbox cleanup and announcements. Otherwise it enters
`:SAVING` before open/header work and processes at most ten messages per quantum.
Finish closes output first, updates file identity, then deletes inserted inbox true
names; only file-not-found is ignored; only afterward does it clear pending
identities/tick and enter `:IDLE`. A different deletion error can therefore occur
after output close while state still records `:SAVED` and pending inboxes. Abort
flushes work, abort-closes, clears the stream and returns to `:IDLE`. Strict G85 MUST
NOT invent a universal temporary-file/rename transaction. Genera 8.2's guarantee
that saving to a Unix host creates a new version retaining prior contents is a
release-specific compatibility rule, not a rule for every adapter.

## Submission and external-service boundary

### Normalized submission interface

All non-C46 senders call a semantic adapter with:

- immutable normalized header/body content or a readable interval snapshot;
- envelope sender and ordered recipient groups with To/Cc/Bcc distinctions;
- first-hop host/site grouping and requested service constraints;
- file-copy destinations and blind-copy policy;
- message/reference/retransmission identity;
- interactive versus background permission; and
- a result sink for per-recipient attempt, acceptance, rejection, retry and
  diagnostic records.

The adapter MUST return a structured result. `accepted-for-queue`, `delivered`,
`temporarily failed`, `permanently rejected`, and `not attempted` are distinct.
Interactive ZMail/Zmail MUST NOT claim final delivery from queue acceptance.

### System 303 transport profile

The maintained source exposes COMSAT/file-job, Chaos mail-server, direct Chaos,
Ethernet and SMTP-related paths depending on site support. The UI/profile selects
only modes whose dependencies are present. A recording adapter MAY emulate the handoff
for conformance. Exact protocol bytes and remote retry policy remain D19/D21.

The selected tree is not self-contained for every advertised choice. No active
`ETHER-SEND-IT` body is present, and SMTP delegates to a provider outside the
selected ZMail closure. Selecting either without its provider MUST produce an
unavailable-transport result before claiming acceptance; it MUST NOT fall through to
an unrelated transport.

System 303 ordering is deliberately non-atomic:

1. Validate headers, optionally obtain and insert a subject, and generate the
   message identifier.
2. File requested `FTo`, `FCC`, and `BFCC` copies before network submission. When
   destinations overlap, `FTo` takes precedence over `FCC`, which takes precedence
   over `BFCC`.
3. Invoke the selected network/file transport.
4. Only after its success return mark the draft sent and mark source messages
   Answered or Forwarded.

Consequently a transport failure can leave committed local copies while the draft
remains unsent, and a naive retry can duplicate those copies. Chaos submission uses
separate visible-recipient and blind-recipient sessions, so visible success may
precede Bcc failure. Direct Chaos sends per host before gateway retry, allowing
earlier hosts to succeed before a later host fails. File submission is a no-op when
both To and Cc are absent; an `FTo`-only draft can therefore complete as local filing.
The programmatic Zmacs `SEND-MESSAGE` interface bypasses integrated-draft bookkeeping.
All of these partial results MUST remain distinguishable in the result record.

### Genera service discovery

Genera's active default is network submission rather than the older block-commented
fixed transport option table. It groups recipients by first hop, asks the network
service framework for candidate paths, prefers store-and-forward where available,
may try a host-local mail-to-user path, can retry candidates, can offer a service
believed unavailable, and may prompt before direct delivery fallback.

A conforming adapter MUST make candidate order, prompt decisions and per-recipient
outcomes observable. It MUST distinguish an unavailable file host needed to prepare
the draft from an unavailable mail transport after preparation. The preserved world
failed at the former `DIS-SYS-HOST` boundary; no live delivery behavior was observed.

One G85 mail-access-path attempt has a five-minute timeout and the lifecycle
`start -> verify each recipient -> receive message -> finish -> close(normal)`,
followed by an outer unwind `close(abort)`. Close MUST therefore be idempotent and
the trace MUST retain both calls. Attempt count increments before verify; success
count increments only after verify returns. If zero recipients verify, receive still
drains both message streams to a null sink so the peer is not left waiting. At least
one accepted recipient triggers the message-sent callback, but acceptance is not
evidence of final delivery. Abort/timeout at every phase retains verified and
completed recipient dispositions.

### Mailer separation

The separate Genera Mailer owns queues, logs, counters, persistent messages,
mailboxes, hosts and delivery processes. D08 may submit to it and display a returned
status. D08 MUST NOT create or inspect its internal queue as part of base Zmail
conformance. The interactive `Zmail background` worker owns file parsing/saving and
mail checks for its frame; naming similarity is not shared process identity.

## Visible interface requirements and runtime evidence

### Genera empty-reader witness

![Genera 8.5 Zmail after local login, showing the empty summary and message panes, the functional 20-cell command pane, mode line, and three short operating hints.](assets/genera-screenshots/zmail-reader-empty.png)

*Runtime observation — Genera 8.5, session `zmail-d08-genera-20260718`,
generation 1, verified 2026-07-18 after `Select M` and local
`LISP-MACHINE` login. The reviewed 1200 by 900 image is 4,471 bytes; PNG
SHA-256 `a947dc4d80238ef0bea331d383603865a4eb653cd2903c2b23cd65217742aab7`;
normalized-pixel SHA-256
`b4d8c37c43d839b0983d35c244950c1649668bd70ace82a2c2b5bd9ffab12d66`;
the 24-record action prefix has SHA-256
`31f193b620c8d0cf62cbe9bbcc7744c6582f3d16db47aa4a93a84ec17ff0a150`.
It establishes the one-frame empty layout, visible pane relationships, menu labels
and concise entry hints. It does not establish populated summary rows, message
rendering, command effects, menu predicates, mail transport, site configuration, or
source-to-world identity. Symbolics and other applicable rightsholders retain
interests in the licensed screen; this minimum image is published under the
page-specific fair-use review for historical criticism and reconstruction, and no
endorsement is implied.*

The visible relationship required by `ZM-G85-ZMAIL` at 1200 by 900 is a full-width
summary region above a horizontal functional command pane, a large message region
below, and the Zmail mode line at the bottom. The screenshot is an oracle for this
relationship and short labels, not an exact pixel/font/color contract. At `L2`, a
port MUST preserve pane identity, relative ordering, the four-by-five menu topology,
current-selection indication and separate message/summary scroll state. Pixel
identity remains outside the claim.

### Genera separate Mail-mode witness

![A blank Genera 8.5 Zmacs Text Mail template, with To and Subject fields, body separator, and a mode line identifying transmit and quit operations.](assets/genera-screenshots/zmacs-text-mail-template.png)

*Runtime observation — Genera 8.5 in the same session and generation, verified
2026-07-18 after `Select E` and `Control-X M`. The reviewed 1200 by 900 image is
3,180 bytes; PNG SHA-256
`6462902049b81435b2fb7cff480be055f660978bb12a4d5ea49dea091bb7c62c`;
normalized-pixel SHA-256
`945ae06da781538b6def4937592b1bee5fbbd9d6f0ad0117b276f757ec846e67`;
the 38-record action prefix has SHA-256
`b9f03911419f23c845e23fcc0739984c42e667daf7ec3176d89c399b486a7064`.
It establishes the left-hand blank editor's header/body template, separator and
Text Mail mode line. The right-hand residual Zmail/dithered area is incidental prior
state and is not a specified two-pane Mail layout. No address, body, delivery or
resume behavior is shown. Symbolics and other applicable rightsholders retain
interests in the licensed screen; this minimum image is published under the
page-specific fair-use review for historical criticism and reconstruction, and no
endorsement is implied.*

The two images are deliberately not a sequence teaching operation. They compare two
architecturally distinct surfaces and contain no user mail, address book, mailbox,
substantial Help prose, source listing, font sheet, artwork or third-party media.
Their exact-page reuse is recorded in the screenshot policy and curated asset
catalog. No other capture from the session is approved by implication.

### Genera runtime scope and shutdown

The selected world was an unconfigured isolated Genera 8.5 world, not a configured
Symbolics site. The base and private `Genera-8-5.vlod` were each 54,804,480 bytes
with SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`
at start and stop. The selected client was `Genera on DIS-LOCAL-HOST`, XID 4194310,
at `(72,55)`, 1200 by 900. The complete run and action records, licensed archive,
debugger, VLM, compatibility preload, responder, configuration, sandbox, Xvfb,
input and shutdown identities remain in the ignored session and are summarized in
the [Zmail evidence dossier](genera/zmail.md#runtime-observations-in-genera-85) and
[curated catalog](assets/genera-screenshots/).

The run reached the shutdown prompt, sent and had `yes` accepted, then observed
cleanup progress before the known current-VLM cold-load mutex stall required bounded
host termination. It is `forced-stopped`, not orderly;
`state_may_be_incomplete=true`. The private world remained byte-identical, but that
does not prove whether an in-guest Save World or checkpoint occurred; both remain
unknown. No source semantic claim is derived from the shutdown result.

### CADR visual boundary and blockers

The System `303-0` session `zmail-dossier-20260718`, generation 1, showed a System
Menu Mail entry, but the band lacked the `ZWEI:ZMAIL-FRAME` flavor. Loading the
maintained source stopped at the unsited `AMS-BRIDGE-1` file-host/login dependency.
Its ignored menu and error captures therefore show **absence**, not the application,
and their older provenance is intermediate evidence. Publishing them would not make
the ZMail layout more reconstructable.

`TODO-SCREENSHOT-ZM-C303-ZMAIL` requires a fresh disposable run which loads the
exact maintained closure, uses an inert local host and synthetic Babyl mailbox,
reaches `:BOTH`, and records a current-schema provenance join before one minimal
image receives a separate four-factor review. `TODO-SCREENSHOT-ZM-C303-DRAFT`
similarly requires a blank integrated `:SEND` or `:REPLY` state. Neither may display
real correspondence or substantial Help prose.

No runnable System 46 band is currently available. `TODO-SCREENSHOT-ZM-C46-COMPOSE`
requires entering `(MAIL)` with synthetic text, capturing the blank/template state,
exiting with `Control-]`, and proving draft retention without opening the request
file. Until then its geometry and exact mode-line pixels are source requirements,
not runtime claims. These explicit blockers satisfy the repository rule against
silently shipping a visible-behavior page without a screenshot.

## Release deltas, defaults, and historical defects

### Selectable differences

| Area | `C46-COMPOSE` | `C303-ZMAIL` / composer | `G85-ZMAIL` / composer |
| --- | --- | --- | --- |
| application extent | standalone outgoing editor only | full reader plus separate composer | full reader, calendar, integrated and separate composers |
| UI substrate | ZWEI major mode + TV | ZWEI + TV frames/blips | ZWEI + TV; selected Dynamic Windows services; not CLIM |
| default reader layout | absent | `:BOTH`, summary 45 percent | `Both`; runtime-visible empty summary/menu/message |
| local request/send | writes ITS-style request file | ZMail sender with site-selected adapters | network-service discovery and optional Mailer handoff |
| reader top-level commands | absent | 86 clean definitions | 152 clean completion candidates |
| registered storage | request file only | Rmail, Babyl, Tenex, Unix, VMS, Text | Babyl, Rmail, KBIN, Tenex, Unix, Directory, Text |
| reply layout | absent | one/two/three windows | zero/one/two windows plus independent recipient/yank/prune dimensions |
| summary interaction | absent | TV `SUMMARY-MOUSE` | active TV `SUMMARY-MOUSE`; proposed DW conversion disabled |
| ordinary background request order | absent | one request cell; runtime scheduling open | LIFO; preload FIFO |
| standalone Mail resume | numeric argument preserves C46 draft at entry | retained special buffer | absent/new, zero chooser presentations, nonzero most recent |

Defaults are compatibility data. C303 begins in Both, uses 45 percent for summary,
scrolls summary by 20 percent, moves forward after delete, deletes after filing,
does not confirm expunge, enables background checks/saves, replies to all by default,
and generates Message-ID/In-Reply-To. G85 begins in Both, discovers transport through
the network-service framework, uses Ask for retransmission handling, permits
background inbox completion/checks by default, and evaluates profile-selected menu,
movement, reply and End behavior at invocation time. A profile file may change them;
the runner MUST report pristine versus effective values.

### Source-visible defects and deliberate strictness

The following are not silently repaired in strict compatibility:

- C46 command prose names `Control-G` to quit while the local mode table binds
  `Control-]`; the table wins and the inherited `Control-G` result remains a runtime
  oracle.
- C46 opens the request stream before discovering that To is empty, so a rejected
  draft can leave partial output.
- C303's status-slot comment uses two state names not used by executable code.
- A C303 message-header parse waiter sleeps for state `T`; if the owning parser
  unwinds and restores `NIL`, the waiter may never wake. Strict testing uses a
  watchdog; a safe extension may wake with a parse-failed condition.
- C303 filing precedes transport and is not rolled back, while visible and blind
  Chaos sessions and per-host direct sends can succeed independently.
- C303 Save All/expunge, inbox rename/delete, merge and foreground/background
  completion have the nontransactional boundaries specified above.
- G85 ordinary background work is LIFO despite a nearby source comment calling it
  FIFO. Only preload requests are appended FIFO.
- G85's active summary dispatcher remains the older TV blip code even though a
  disabled source block proposes Dynamic Windows conversion.
- The preserved G85 site's integrated Mail failure at `DIS-SYS-HOST` is a site
  dependency, not a product defect and not a transport failure.

A conforming implementation MAY expose corrected modes such as
`safe-header-wait`, transactional filing or FIFO ordinary work. It MUST label them
extensions and MUST NOT report their traces as strict historical results.

### Genera 8.0–8.3 documented deltas retained by the 8.5 target

The selected 442.0 source follows a history of user-visible corrections. These notes
are cross-checks, not alternate code to layer over the selected source:

| Release evidence | Compatibility delta |
| --- | --- |
| 8.0 Zmail notes | Unix save/header inconsistency gains fix-and-retry; KBIN is not automatically reparsed after parser fixes and requires numeric `Reparse All Loaded Messages`; Get Inbox timing and Meta-Left file-reference editing change; malformed Tenex byte count produces one partial message while bad status can leave a permanently unparseable message |
| 8.1 release notes | answering No to one expunge skips that expunge, saves that file and continues later files instead of aborting all; keyword-copy, Reply-To default, reference formats, Set Key, Add Message References pointer behavior, RMAIL/background/buffer-full fixes and Merge Keywords arrive |
| 8.1 ECO | Abort stops Show Mail and Show File typeout |
| 8.2 Zmail notes | saving to a Unix host retains prior contents in a new version; Merge Keywords conflict scope changes |
| 8.3 release notes | pane-exposure abort recovery; CP/FSEdit KBIN-to-Zmail routes; Save Draft As Message accepts bitwise arguments 2, 4 and 6 and prefers current buffer; 16-bit ECO decode fix |

No separate local 8.4 or 8.5 Zmail release-note/design paper was found. The absence
is an evidence gap, not permission to attribute later behavior to an invented note.
Where a note describes older behavior that conflicts with selected 442.0 source,
strict G85 follows 442.0 and exposes the older result only as an optional historical
comparison profile.

## Reference semantic protocol inventory

These names define an implementation-independent reconstruction API. They do not
claim historical package names, calling conventions or flavor messages. Every
operation returns a typed result plus an ordered trace of externally visible
mutations; a thrown host-language exception without that partial trace is
insufficient for `L2`.

| Protocol | Inputs | Required result and effects | Failure boundary |
| --- | --- | --- | --- |
| `select-mail-application` | profile, console, create flag | reused or new frame, activation/selection trace and selected view | console, frame-init, login or host failure retains the profile-specific active/selectable/prior state and invents no mailbox |
| `enter-mail-composer` | profile, recipient/body, numeric state, caller | new, reset, resumed or presented draft per profile | loaded/login/buffer failure before inappropriate mutation |
| `enumerate-effective-inputs` | frame, pane, mode, task, profile overlays | every key/prefix/menu/pointer/presentation winner, shadow and unbound row | cycle/malformed table reported, never silently omitted |
| `dispatch-mail-input` | context, event, numeric state | chosen command and ordered command trace | unbound/barf/abort with completed prior mutations retained |
| `select-sequence` | current and target sequence | saved old position, installed target, restored/selected current message | invalid/locked target leaves selection coherent |
| `select-message` | sequence, identity/index, display policy | current identity/index and required view/redisplay | missing/stale row leaves old current message |
| `move-message-point` | predicate, direction, count | next matching identity or bounded failure | no match changes no current identity |
| `project-summary` | sequence, template, ticks | ordered rows tied to stable message identities | parse/render error cannot retarget another row |
| `parse-message-headers` | message and requested properties | typed header model and cache tick | owner failure publishes failure/NIL, never success; C303 waiter hazard traceable |
| `apply-message-status` | message, add/remove statuses | persistent/transient status and dirty/cache ticks | unsupported persistent attribute reported |
| `build-filter-selection` | universe, filter, traversal | stable ordered temporary collection | per-message parse error and partial candidate trace |
| `map-over-selection` | frozen selection, operation | ordered per-message results and final collection | source-selected stop/continue policy after partial effects |
| `resolve-conversation` | reference index, seed | ordered live conversation and diagnostics | missing/duplicate/cyclic identifiers explicit |
| `create-integrated-draft` | operation, source messages, reply dimensions | typed header/body draft and selected task layout | construction failure restores enclosing task state |
| `edit-draft-field` | draft, typed field, operation | new/select field and point | validation failure before committing invalid typed value |
| `finish-draft` | draft, End policy/button | add-text, query, abort or send branch | canceled prompt preserves preauthorized state |
| `save-draft` | draft, operation, pathname | file/message association and clean tick only after commit | partial bytes and live draft retained |
| `normalize-envelope` | typed headers, profile | sender and ordered To/Cc/Bcc/file-copy groups | missing/invalid required fields before external work |
| `submit-message` | content snapshot, envelope, adapter | per-recipient/service result and source/draft status at success boundary | local-copy and transport partial effects retained |
| `recognize-mail-format` | profile, pathname, prefix, override | one registered adapter or explicit ambiguous/no-match | unavailable/unselected format, no generic fallback |
| `load-mail-file` | adapter, stream, options | complete messages, parser position and buffer status | prior complete messages and recovery location retained |
| `save-mail-file` | buffer, adapter, append/rewrite policy | commit identity, accepted messages and clean tick | original/recovery identity plus partial write state |
| `expunge-sequence` | sequence, expiration/profile policy | membership, storage, current-message repair and dirty state | completed prior phases visible; no invented global rollback |
| `incorporate-inbox` | destination, inboxes, order policy | complete inserted messages and pending deletion work | renamed/read/inserted/deleted phases individually recorded |
| `enqueue-background-work` | profile, request class | request identity and source-defined queue position | full queue/rejected request changes no file state |
| `run-background-quantum` | worker state, interaction telemetry | bounded load/save/parse progress and response records | locked/aborted work leaves typed resumable status |
| `incorporate-background-response` | foreground state, response | selected status, sequence and redisplay updates | stale/duplicate response diagnosed |
| `quit-mail-reader` | dirty buffers, drafts, worker, policy | selected save/logout result followed by deselection/bury of the reusable frame | failed save or active work retains the exact pre-bury/partial state; worker is not mislabeled terminated |
| `kill-mail-reader-frame` | frame, streams, auxiliaries, worker | source-selected abort-closes, unlinking and terminal process/frame state | partial cleanup is distinct from ordinary Quit and from host-process termination |

Extension registration MUST be explicit. A format registers a name, recognition
priority, host applicability, capabilities and implementation identity. A transport
registers discovery/service identity and structured result semantics. A command,
menu item, template, profile option or presentation handler registers its owner,
priority/applicability and provenance. Enumeration MUST show pristine entries and
site/profile/user additions separately.

## Exact source-interface and module closure boundary

### Semantic closure required at `L2`

`ZM-C46-COMPOSE` requires the selected `dired.55` Mail section plus the exact
System 46 Standard ZWEI parent graph incorporated from D05. Its `dired.qfasl`
corroborates a compiled module but is not a decoded body oracle. The public snapshot
does not supply a reader, transport daemon, Zmacs overlay or matching runnable band;
none may be inferred into this closure.

`ZM-C303-ZMAIL` requires the exact 18-path system declaration in the evidence
ledger. The closure includes a comment-only `lmfile`, active `file/zmail`, and
method/resource-only `cometh`; excludes the commented `PARSE`, unselected `lm.lisp`,
and every advertised transport provider not present in the tree. The separate
`ZM-C303-COMPOSE` additionally requires the selected `zwei/dired` and Zmacs parent
graph. The ZMail 50/System 94 manual is a comparison profile, never a substitute
module. Maintained check-in `4df393c...` includes later restoration/history and MUST
be labeled maintained LM-3, not pristine 1983 media.

The historical Zmail system declaration's exact build closure is the 47-file manifest
in the ledger: the 37-file application-core subset plus RTC, Converse, and all eight
KBIN implementation files. Behavioral/conformance overlays may let a host clone omit
or separately claim KBIN byte behavior, Converse integration, live transports, or
other optional capabilities, but those switches do not rewrite the declared
historical build graph or turn the 37-file analytical subset into its exact closure.
Calendar may be omitted only below the full `ZM-G85-ZMAIL L2` claim; every such L2
claim includes the mandatory Calendar subset defined above. The separate `zwei/mail`
module is additionally required for
`ZM-G85-COMPOSE`; the separately declared Mailer system is not. Dynamic Windows, TV,
ZWEI, filesystem, process, network-service and selected adapter dependencies are
external interfaces, not evidence of CLIM.

The exact 37-file analytical application-core manifest denominator is:

~~~text
zmail/multiple-choice-menus.lisp
zmail/button-panes.lisp
zmail/mail-access-paths.lisp
zmail/local-mail.lisp
zmail/chaos-mail.lisp
zmail/smtp.lisp
zmail/parser-generator.lisp
zmail/lexer-generator.lisp
zmail/rfc822-date-time-parser.lisp
zmail/headers-parser-rfc822.lisp
zmail/headers-lexer-rfc822.lisp
zmail/definitions.lisp
zmail/top.lisp
zmail/window.lisp
zmail/fat-strings.lisp
zmail/headers.lisp
zmail/collections.lisp
zmail/mail-files.lisp
zmail/mailbox-pathnames.lisp
zmail/foreign-mail-file-formats.lisp
zmail/commands.lisp
zmail/references.lisp
zmail/mail.lisp
zmail/template.lisp
zmail/message-encryption.lisp
zmail/filter.lisp
zmail/universe.lisp
zmail/profile.lisp
zmail/undo.lisp
zmail/eco-commands.lisp
zmail/date-expressions.lisp
zmail/directory-mail.lisp
zmail/calendar.lisp
zmail/rule.lisp
zmail/digest.lisp
zmail/compile-flavor-methods.lisp
zmail/template-library.lisp
~~~

The declared 47-file build denominator adds:

~~~text
io/rtc.lisp
zmail/converse/converse.lisp
zmail/kbin/level-1-defs.lisp
zmail/kbin/defs.lisp
zmail/kbin/trace.lisp
zmail/kbin/load-defs.lisp
zmail/kbin/load.lisp
zmail/kbin/dump-defs.lisp
zmail/kbin/dump.lisp
zmail/kbin/buffer.lisp
~~~

A manifest checker MUST report every path, selected version, byte count and hash; a
digest without its member list is not an exact closure claim.

At `L2`, host implementations may rename functions, objects and errors while
preserving the semantic protocols and all selected observable effects. No D08 level
claims historical source/package/API compatibility. `L3` means the preservation
fidelity defined in the conformance-level table: preserved-system comparison, exact
selected format bytes where included, timing-visible behavior, source-selected
partial failures, live registry enumeration and closure of the claimed runtime
oracles. A separate source-API compatibility project would need package/symbol,
signature, multiple-value, special-variable, flavor-method, condition/restart,
representation and load/patch inventories; it is outside this specification rather
than silently being redefined as `L3`.

### Binary, byte and network exclusions

No level here provides QFASL ABI, world-image, pointer layout, compiled instruction,
raw Chaos/SMTP/Ethernet, Mailer queue, KBIN byte or pixel compatibility unless an
optional overlay and test explicitly names it. Semantic format tests for public C303
formats MAY compare exact generated bytes. Licensed G85 golden bytes remain local
and evidence-only. A clone can be behaviorally conforming without reading a VLOD or
hosting a historical network.

## Conformance test suite

Every test record includes profile and overlays, pristine/effective registry
generation, synthetic fixture identity, initial digest, ordered event/mutation/I/O
trace, result, final digest and preserved-runtime oracle identity where used. Fault
injection occurs at every enumerated external boundary. A watchdog result is the
expected observation for a historical hang test, never an unbounded test-runner hang.

### Artifact, profile, and entry tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-ART-01` | verify C46/C303 public sources and manuals | commit/check-in, path, bytes, hashes and 18-path manifest match; maintained and historical evidence remain distinct |
| `ZM-ART-02` | run the incorporated G85 declared-build manifest check without staging local inputs | every one of the 37 analytical-core and 10 declared-build-addition records matches; core/full content-v1 and selection-v1 digests match; output contains identities only, no source or decoded payload |
| `ZM-ART-03` | compare System 452.1/Zmail 442.0 source profile with Genera-8-5 world record | profiles remain distinct unless each tested compiled function is independently tied to source; visible agreement does not collapse them |
| `ZM-PROFILE-01` | request each of five profiles plus nonexistent `C46-ZMAIL` | five select independently; nonexistent reader is rejected, never substituted |
| `ZM-FEATURE-01` | vary selectable format/service/hardcopy/converse claims and inspect Calendar | only selected adapter/claim requirements activate; Calendar remains in the G85 build/registry and is mandatory at G85 L2 |
| `ZM-ENTRY-C46-01` | `MAIL` with absent versus present numeric argument | reset/template versus retained draft exactly; caller values placed at selected point |
| `ZM-ENTRY-C303-01` | initialize, System M free/claimed, System Menu, programmatic entry and login failure | frame activates before programmatic login/mailbox startup; conditional key registration and all valid routes select/reuse one frame in exact source order |
| `ZM-ENTRY-C303-02` | current 303-0 band | menu exists, flavor is absent, load stops at recorded host boundary; no source-profile behavior inferred |
| `ZM-ENTRY-G85-01` | initialize, main/nonmain console, login enablement, existing/stale frame, Zmail/Mail aliases | activation precedes login-dependent sequence setup; process wait/null-startup/bury and unique-frame reuse/reconstruction are exact |
| `ZM-COMPOSE-G85-01` | Zmail unloaded, login failure, then new/nonzero/zero argument | failure order and three-way draft behavior match; zero with no drafts changes no selection |

### Effective input and transient-context tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-KEY-01` | exhaust complete character/modifier domain in every named context | each row has winner/shadow/undefined/unbound, owner, Help result and profile provenance; no sampled domain |
| `ZM-KEY-02` | recursively enumerate every prefix | every reachable leaf and fallback edge appears exactly once; no guessed Zmacs fallback for closed Zmail `Control-X` |
| `ZM-KEY-03` | every dispatcher-reachable `NIL`/`:SIGN`/`:DIGITS`/`:CONTROL-U`/`:INFINITY` tag on every command | tags remain distinct; consume/ignore/reject/repeat occurs before mutation; editors never gain Infinity and utility loops never synthesize numeric state |
| `ZM-KEY-04` | compare keyboard, command pane, completion, summary and presentation ingress | same labels with different commands remain distinct; G85 menu Jump is Goto while key `J` is Jump |
| `ZM-KEY-05` | load profile/template/site/user overlays | effective graph records additions, priority, shadow and pristine denominator separately |
| `ZM-CMD-SUITE-01` | execute the incorporated command-effect companion's `ZM-CMD-01` through `ZM-CMD-13` without renumbering or sampling | exact 86/152 tuples, applicability, buttons, effect/failure prefixes, completion dispatch, Set Key, Undo/Redo, rules, encryption, ECO, GMSGS, Calendar and every external-adapter boundary pass at the companion's stated level; count-only equality fails |
| `ZM-C46-K01` | End, C-Altmode, C-], Tab, C-G and unknown input | local table exact; prose discrepancy and inherited/unbound C-G recorded |
| `ZM-C303-K01` | top-level, message edit, reply, separate Mail and every child prefix | incorporated fixed rows, 21-choice Reply, exact extended/right menus and direct/child parent fallthrough match |
| `ZM-C303-K02` | utility, marking, filter select/build, universe, profile, chooser, typeout and `:NEW` | every transient leaf, pointer variant, commit/abort/requeue and unbound path matches the explicit tree |
| `ZM-C303-K03` | filename/keywords/more mode-line regions and summary-label quarters | dynamic presence, L/M/R keyword and scroll behavior, four-item menu, and center/outer layout transitions match |
| `ZM-MENU-ORDER-01` | enumerate every C303/G85 main, Other, summary, reply and dynamic menu under all predicates | exact ordered sequences, separators, blank cells and nested submenus match; set membership alone fails |
| `ZM-G85-K01` | reader/main-button/calendar/filter/draft/separate Mail | every L/M/R/KBD, numeric, conditional and profile-selected branch matches; blank cells are nonselectable |
| `ZM-G85-K02` | every typed presentation/TV blip gesture and accepted application type | active summary uses TV blip; parsers, completion, defaults, subtype filtering, button behavior, translators and priorities match |
| `ZM-G85-MARK-01` | every Mark Survey atomic/compound input, no marks, commit and unwind | exact toggle/move/scroll/help/ignore/requeue result; no-marks error and full state restoration match |
| `ZM-G85-EVENT-01` | every parent special opcode and main-frame override, including callback fault | exact return/redisplay/requeue/button binding, three-value propagation and retained partial effects match |
| `ZM-G85-PREFIX-CASE-01` | same lowercase prefix leaf prompted versus already queued as typeahead | prompted input uppercases; queued typeahead retains case and may select a different/unbound cell |
| `ZM-HELP-01` | ask Help in every context, mutate registry, then send Space/key/menu after the G85 report | Help describes effective winners and prefixes, exposes named-only commands, never claims a shadowed key; G85 prints its post-report prompt, while the wrapper's exact dismissal/forwarding trace closes the named runtime oracle rather than being inferred from that prose |

### Composer and draft tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-C46-C01` | initialize recipient/body with/without numeric argument | exact fields/separator/point, reset and retention behavior |
| `ZM-C46-C02` | mixed-case/repeated To/Cc, Subject/S/From, unknown and bare-prefix lines | first raw scalar match, strict-longer-than-prefix rule, To-then-Cc family ordering, resume point and ignored lines match |
| `ZM-C46-C03` | comma, spaces/tabs, empty pieces, one parenthesis pair, `()`, nested parentheses and quoted comma | exact trim/split/one-pair order and post-strip empty-recipient edge match; quoted comma demonstrates documented non-support |
| `ZM-C46-C04` | missing separator; Cc-only; no emitted To; non-ITS default | separator fails before open; no-To fails after initial records; persistent AI default-host mutation and partial-file prefix match |
| `ZM-C46-C05` | inject open/write/close failure at every record | partial request bytes and retained editor state are reported; never marked delivered |
| `ZM-DRAFT-01` | generate every C303/G85 reply dimension | recipient, window/yank and pruning choices compose independently; no collapsed presets |
| `ZM-DRAFT-02` | nested recursive composition success/ordinary abort/strong abort/error | enclosing panes, points, layout, message selection and locks restore in source order |
| `ZM-DRAFT-03` | invoke every typed field command | field inserted/selected and point placed correctly; address motion follows addresses, not words |
| `ZM-DRAFT-04` | End under every profile policy and direct C-Altmode | query/add-text/send choice exact; direct send bypasses End policy |
| `ZM-DRAFT-05` | save/restore/write/Save As Message with injected faults | associations and clean ticks change only at operation-specific commit; live draft survives partial work |
| `ZM-DRAFT-G85-01` | retransmit with Ask choices/cancel | returned recipient state, optional Supersedes/Comments edits and resumable error state match |
| `ZM-DRAFT-STATUS-01` | reply/forward/redirect/redistribute success and partial failure | source status changes only at selected success boundary and uses the correct distinct status |

### Reader, collection, and parser tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-SEQ-01` | select sequence with valid/stale saved current | old point saved, target identity restored or first policy applied; indexes/caches coherent |
| `ZM-SEQ-02` | next/previous by undeleted/unseen/recent and no-match | predicate/direction/count exact; no-match leaves current identity unchanged |
| `ZM-SEQ-03` | set/pop points across sort/filter/expunge | identity, not stale row number, determines return or explicit missing result |
| `ZM-SUM-01` | rebuild, then pointer event racing sort/filter | row identity remains correct; message and summary scroll positions independent |
| `ZM-PARSE-C303-01` | two processes parse one header, owner succeeds | one owner and waiting consumer publish one coherent cache |
| `ZM-PARSE-C303-02` | owner fails while waiter sleeps | strict watchdog exposes NIL-versus-T waiter hazard; safe extension wakes with labeled failure |
| `ZM-LOCK-C303-01` | acquire recursively in one process, unwind inner and outer normally and by injected error, then contend from another process | the nested call does not reacquire or release; only the invocation that acquired unlocks on unwind; the other process waits and then acquires after outer release; no unproved warm-boot reset is asserted |
| `ZM-LOCK-G85-01` | read/write reentry, sole-reader upgrade, competing readers and multi-lock sets | permissions, all-or-none acquisition, unwind restoration and warm-boot clearing match the lock contract |
| `ZM-FILTER-01` | typed predicates over frozen multi-sequence universe | each candidate evaluated in stable source order with only required parses |
| `ZM-FUP-C303-01` | run the incorporated C303 filter/universe/Profile suite and inert option enumerator | filter and universe grammars, strict defects, persistence/update order and all 69 active declaration tuples match exactly |
| `ZM-FUP-G85-01` | run the incorporated G85 filter/universe/Profile suite and inert option enumerator | filter and universe grammars, persistence/update order and all 81 textual forms match; exactly 80 are active and the block-commented form remains inactive |
| `ZM-MAP-01` | every map command plus injected failure after item N | completed effects and stop/continue oracle are explicit; no whole-map rollback claim |
| `ZM-REF-01` | missing/duplicate/cyclic identifiers and mutation | conversation result/diagnostics exact; relevant edits invalidate index |
| `ZM-DUP-01` | G85 duplicate deletion | only source-listed Answered/Filed/Forwarded/Sent/Keywords/Redirected state merges |
| `ZM-DIGEST-C303-01` | clip on/off, delete on/off, fail while constructing/inserting child N | clipping precedes the child loop, inserted prefix remains, and original deletion occurs only after normal loop completion |
| `ZM-DIGEST-G85-01` | collection on/off, fail during child-list construction versus insertion/header N | construction precedes insertion; inserted prefixes, collection membership and References update follow source order; original is retained |

### Calendar and reminder tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-CAL-STATE-01` | construct Year, Month, Four Weeks and Week, reset and reconfigure | exact 31/42/42/7 day-grid shapes, three-cell meanings, two leader bounds and retained selector state match |
| `ZM-CAL-PRED-01` | exhaust absent/present Expiration, Period and Start combinations | all present constraints pass, Period-or-Start requirement, strict Expiration boundary and end-of-day Start boundary match |
| `ZM-CAL-PRED-02` | use start-only message on days before, containing and after Start | before fails; containing and later pass, demonstrating the source's intentional lack of lower bound after Start |
| `ZM-CAL-PARSE-01` | valid/invalid period, time, date-only, date-time and expiration input | representations, seconds, explicit-time bit, one-day expiration default, Time parse conditions and confirmation retry match |
| `ZM-CAL-CMD-01` | invoke Set Start, Set Expiration, Survey and Compose Reminder by keyboard/L/M/R | exact template choice, field order, undo behavior, holiday/survey output class and no-mutation survey result match |
| `ZM-CAL-SORT-01` | mix holidays and reminders with no type, no time, equal times and distinct times | stable -3/-2/-1/seconds ordering and Reminder-time precedence match |
| `ZM-CAL-GEOM-01` | vary month length, start weekday, week origin and pane dimensions | Year 3-by-4, Month 4/5/6 by 7, Four Weeks 4 by 7, Week seven-pane geometry and minimum-size refusal match |
| `ZM-CAL-VIS-01` | toggle year reminders, change current message, overflow a day pane | XOR transitions, current/holiday distinction, incremental add/delete and left-scroll-bar threshold match |
| `ZM-CAL-PRES-01` | enumerate Day, Week-containing-day and Month hit regions/gestures plus both Day converters | 5 editor-command forms and 2 converters produce the exact objects, applicability and normalized dates |
| `ZM-CAL-NAV-01` | L/M/R/KBD on all four configurations at year/month/week boundaries | accepted year ranges, year rollover, -21/+7 offsets, normalization and unnormalized accepted starts match |
| `ZM-CAL-ABORT-01` | abort each prompt and fail each of two Set-current-message header writes | prompt abort has no mutation; second-write failure retains the first Start update and reports partial state |
| `ZM-CAL-WEEK-ORIGIN-01` | change Sunday/Monday option in strict and safe modes | strict ordinary update omits Week while full recompute includes it; labeled safe extension is never reported as strict |
| `ZM-CAL-RUNTIME-01` | future populated preserved-world run | source relationships are checked visually; pixel/runtime claim remains open until reviewed evidence exists |

### Storage, inbox, and persistence tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-FMT-C303-01` | open every host/signature pair with and without explicit flavor | reuse/conflict occurs first; explicit flavor wins; otherwise host format computer selects and every probe restores stream position |
| `ZM-FMT-C303-02` | create each new host file with default buffer, append profile and right-button options | default-buffer/explicit/host-default and options ordering match without a content probe |
| `ZM-C303-BABYL-01` | versions 4/5/unsupported, EOOH, status/options, final delimiter | golden parse/write and continuable unsupported-version behavior match |
| `ZM-C303-RMAIL-01` | first-line detection and Control-Underscore boundaries | Rmail/Babyl selection and whitespace-only boundary rule exact |
| `ZM-C303-TENEX-01` | valid and damaged date/count/status/boundaries | normal golden result plus each source recovery branch exact |
| `ZM-C303-UNIX-01` | valid/false `From ` and adjacent `>From` fixtures | weekday/date and adjacent-line heuristics select boundaries exactly; the strict source performs no general mboxrd unescape/escape, while an optional safety overlay is labeled separately |
| `ZM-C303-VMS-01` | formfeed, fixed and CHAOSMAIL variants | messages/properties exact; Multics selection rejected |
| `ZM-C303-TEXT-01` | export, exercise the supported UI, force two consecutive nonblank lines, then initial and intervening blank/space-tab-only lines | separator output exact; capability/UI says non-reparsable; nonblank input yields two one-line messages; each blank fixture reaches null-start pointer failure at the specified position; exact runtime condition/cleanup and optional reject/label path remain separately identified |
| `ZM-G85-FMT-01` | seven registered formats, existing-buffer conflict, explicit/interactive/path/host choices and wrong-format conditions | source registry and choice order match; only eligible first failure auto-switches to apparent format; later/user retry remains explicit |
| `ZM-G85-FMT-02` | create a new file with explicit/path/default-buffer/host choices, sticky options and append policies | distinct new-file precedence, caller-option override and chooser result match; no content recognizer runs |
| `ZM-G85-KBIN-01` | selected local licensed fixtures | byte/reparse/upgrade/failure results stay local; no recovered bytes enter report/repository |
| `ZM-FMT-EXACT-01` | execute every logical-character fixture and parser-state transition in the incorporated format companion | recognition, messages, properties, diagnostics, final position and partial state match exactly for C303 and G85; G85 expected bytes remain local evidence only |
| `ZM-SAVE-01` | append/rewrite faults at every message, close, selected host-version/commit and optional rename boundary | accepted suffix, authority, recovery identity and dirty state follow the adapter/profile; no universal temporary rename is assumed |
| `ZM-C303-SAVEALL-01` | fail saving buffer N after all expunges | prior in-memory expunges remain and per-buffer results prevent all-success claim |
| `ZM-C303-INBOX-01` | fail rename/read/insert/destination-save/source-delete | every source-order partial state exact; deletion failure prints then clears pending list |
| `ZM-C303-MERGE-01` | fail between interval splice and array update | historical partial structure/watchdog result recorded; safe extension separately labeled |
| `ZM-C303-FGBG-01` | abort foreground/background finish while saving | exact direct-NIL versus saving-required edge and pending inbox state recorded |
| `ZM-G85-STATUS-01` | drive file and inbox buffers through normal, abort and kill paths | file `:IDLE/:LOADING/:LOADED/:READING-NEW-MAIL/:SAVING/:SAVED/:KILLED` and inbox `:IDLE/:LOADING/:LOADED/:PARSING/:INSERTED/:KILLED` transitions remain distinct |

### Submission and background tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-SEND-01` | recording transport with To/Cc/Bcc/file copies | normalized ordered envelope/content and queue-versus-delivery statuses distinct |
| `ZM-C303-SEND-01` | overlapping FTo/FCC/BFCC and transport failure | precedence exact; local copy persists; draft remains unsent; retry duplication observable |
| `ZM-C303-SEND-02` | visible Chaos success then Bcc failure | per-session recipients/results and unsent/partial state retained |
| `ZM-C303-SEND-03` | direct per-host success then failure/gateway retry | earlier host success is not rolled back or mislabeled |
| `ZM-C303-SEND-04` | FTo-only; neither To nor Cc; programmatic send | local-only success and draft-bookkeeping bypass match source |
| `ZM-C303-SEND-05` | choose Ether or SMTP with provider absent | typed unavailable result; no silent substitute or success |
| `ZM-G85-SEND-01` | service candidates unavailable/retry/local/direct fallback | candidate and prompt order plus per-recipient outcomes observable |
| `ZM-G85-SEND-02` | unavailable draft file host versus unavailable transport | failures occur at distinct preparation/submission boundaries |
| `ZM-BG-G85-01` | enqueue A/B/C ordinary and preload | ordinary completion C/B/A; preload A/B/C; nearby FIFO comment cannot alter trace |
| `ZM-BG-G85-02` | load 21, save 11, parse 11 messages | load yields after 20; save and parse after 10, then finish next quantum |
| `ZM-BG-G85-03` | vary keyboard idle, pointer speed, exposure and response capacity | 5-second, 2.5-speed, 12-entry, 25-percent and exposure gates match |
| `ZM-BG-G85-04` | inspect clean worker construction | process name, priority -1 and scheduler quantum 10 remain distinct from 20/10/10 work quanta |
| `ZM-BG-C303-01` | enqueue A/B/C ordinary and preload requests | ordinary completion C/B/A; preload A/B/C; no assumed FIFO replacement |
| `ZM-BG-C303-02` | load 6, parse 6 messages and save 51 lines | load/parse yield after 5 messages and save after 50 lines, then finish in the next quantum |
| `ZM-BG-C303-03` | checks/saves enabled then inhibited | request/status/response transitions exact; live pause/timing fidelity remains reserved until runtime oracle |
| `ZM-QUIT-01` | dirty files, failed save, active worker and drafts, then ordinary Quit | prompts/order and partial state exact; frame is deselected/buried but reusable and worker is not claimed terminated |
| `ZM-KILL-01` | explicit frame kill/reinitialize with streams, auxiliaries and worker | kill cleanup and terminal state are distinct from Quit; G85 worker kill is observed; forced host-process kill is never called orderly |

### Visual, rights, and provenance tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `ZM-VIS-G85-01` | compare empty reader at 1200 by 900 | summary/menu/message/mode-line relationship, four-by-five labels and hints match; no populated-message inference |
| `ZM-VIS-G85-02` | compare separate Text Mail capture | blank template/separator/mode line match; residual right-side state excluded from layout contract |
| `ZM-VIS-C303-01` | attempt current band | result remains absence/load-boundary evidence; no application image substituted |
| `ZM-VIS-C303-02` | future loaded synthetic mailbox/draft run | publication stays blocked until current provenance and image/page four-factor review pass |
| `ZM-RIGHTS-01` | scan staged files | no licensed source, decoded Help, mail, address, raw session, KBIN bytes, font/picture asset or unreviewed image tracked |
| `ZM-RIGHTS-02` | validate each embedded image | exact file/page approval, analytical caption, hash, attribution/no-endorsement and repository-license exclusion present |
| `ZM-PROV-CADR-01` | ingest future CADR oracle | band/disks, public/private revisions/tree hashes, both usim hashes, inputs, image hashes and shutdown flags complete; old sidecars labeled intermediate |
| `ZM-PROV-G85-01` | ingest recorded G85 oracle | VLOD/debugger/VLM/preloads/responder/config/sandbox/Xvfb/window/actions/images/shutdown complete; Save World/checkpoint not inferred |

## Preserved-system comparison procedure

### CADR and LM-3

1. Verify Git `8e978d7...`, Fossil `4df393c...`, the chosen band/disk, emulator and
   all copied-source revision/tree identities independently.
2. Create a fresh named private Xvfb session. For C46, use a matching band if one is
   lawfully available; for C303, load the exact selected closure into a disposable
   System 303 session with inert local host mappings and synthetic Babyl mail.
3. Record each input intent and outcome. Do not configure external mail delivery;
   use the recording adapter or an isolated fake service.
4. Export pristine and effective comtabs, prefixes, menus, TV blips, profile/template
   additions and Help descriptions from the running system. Enumerate every domain
   rather than sampling familiar keys.
5. Run one semantic fixture at a time, capturing ordered state and file/service
   traces. Keep injected fault files and correspondence synthetic.
6. Join screenshot sidecars with `run.json` for the execution-time usim hash; never
   claim that old sidecars contain it. Stop cleanly where possible and retain
   `forced_stop` and `state_may_be_incomplete` exactly.
7. Keep raw payloads ignored. Curate only a minimal application state after an
   image-and-page review.

### Genera

1. Verify all licensed input and tracked harness/helper hashes, then make a private
   working-world copy. Never write to the purchased base.
2. Launch only through the documented isolated harness: separate namespaces,
   read-only store/helpers/X socket, private writable runtime, no external route,
   disabled/live-absent MIT-SHM, exact fail-closed X request substitutions and one
   supervised local RFC 868 response.
3. Require every running marker, select/record the exact client and record each input
   intent before XTEST plus its linked outcome after dispatch.
4. Use only synthetic addresses/messages/files. For binding tests, export semantic
   names, owners, priorities and applicability without copying source or Help prose.
5. Compare source profile and world result side by side. A site failure, patch,
   presentation registry addition or world-resident command changes the runtime
   profile; it does not rewrite the clean-source contract.
6. Record shutdown prompt, confirmation, cleanup, stall and forced cleanup
   independently. Neither confirmation nor world hash change proves Save World or a
   checkpoint.
7. Keep every raw payload ignored and review each proposed still for its exact use.

### Recorded runtime witnesses

| Witness | Establishes | Does not establish |
| --- | --- | --- |
| `zmail-dossier-20260718`, generation 1 | System 303-0 Mail menu entry, absent ZMAIL-FRAME, host-bound load failure, clean harness stop | running C303 ZMail, C46, maintained-source residency, application pixels or bindings |
| `zmail-d08-genera-20260718`, generation 1 | empty G85 reader, 20-cell menu, 21-item auxiliary menu, local-login/site boundary, distinct blank Zmacs Text Mail surface | delivery, populated message/summary, all menu predicates, full binding tree or orderly VLM shutdown |

## Known unknowns and nonclaims

The following page-level list is read together with every incorporated companion's
profile-applicable `TODO-RUNTIME-*` backlog. That union, not this list by itself,
defines the open runtime work that gates a selected `L3` claim.

- `TODO-RUNTIME-ZM-C46-ZMACS-ENTRY`: the public snapshot does not establish an exact
  Zmacs ingress for the source-present Mail major mode.
- `TODO-RUNTIME-ZM-C46-CONTROL-G`: inherited `Control-G` versus the command prose has
  not been exercised on a matching System 46 band.
- `TODO-SCREENSHOT-ZM-C46-COMPOSE`, `TODO-SCREENSHOT-ZM-C303-ZMAIL`, and
  `TODO-SCREENSHOT-ZM-C303-DRAFT` remain the visual blockers specified above.
- `TODO-RUNTIME-ZM-C303-BACKGROUND` reserves exact live pause/scheduling timing and
  foreground/background finish races for a loaded source profile. LIFO ordinary
  requests, FIFO preloads and 5-message load/parse plus 50-line save work quanta are
  source-closed and are not reserved by this TODO.
- `TODO-RUNTIME-ZM-C303-HEADER-WAITER` reserves confirmation of the parse-waiter
  deadlock and any scheduler-specific wakeup.
- `TODO-RUNTIME-ZM-C303-TEXT-FORCED` reserves a matching-environment low-level load
  that checks consecutive nonblank publication plus initial/intervening blank-line
  null-start failure, records the exact condition and partial cleanup, and tests
  whether any outer wrapper enforces the adjacent zero-message source comment. Text
  remains excluded from the supported reparsable-format chooser either way.
- `TODO-RUNTIME-ZM-G85-HELP-FORWARD` reserves the relative typeout wrapper's exact
  Space, ordinary-key, command-menu and unrelated-compound-event behavior after the
  source-visible Help prompt; the application body itself performs no second read.
- `TODO-RUNTIME-ZM-C303-MAP-FAILURE` and `TODO-RUNTIME-ZM-G85-MAP-FAILURE` reserve
  exact continuation after an operation fails midway through Map Over.
- `TODO-RUNTIME-ZM-SORT-TIES` reserves equal-key ordering where source/runtime proof
  is incomplete.
- `TODO-RUNTIME-ZM-G85-KBIN-BYTES` reserves exact licensed KBIN representation,
  reparse/upgrade and damaged-input behavior. It does not authorize publication.
- Exact runtime arbitrary-format menu membership for G85 Directory and Text remains
  open even though their source registration is closed.
- Populated G85 summary/message rendering, calendar/reminder layouts, filter and
  universe task frames, profile editor, typed presentation applicability and all
  site/patch overlays remain source-only until the named probes run.
- The ambiguous G85 nonzero `Control-X M` probe does not prove retained-buffer
  reselection. Source behavior remains specified; runtime confirmation is open.
- The System 303 maintained source, ZMail 50/System 94 manual and 303-0 band are
  separate profiles. No exact original release manifest connecting all three is
  claimed.
- Exact historical packages, signatures, conditions/restarts, QFASL/world residency,
  timing/performance, raw network bytes, Mailer queue internals, ABI and pixel
  identity remain outside `L2`.
- This specification does not claim modern RFC conformance, security suitability,
  configured delivery, or interoperability with a public network.
- No licensed Genera source, decoded Help, user/site mail, address data, extracted
  fonts/assets, KBIN bytes, world or unreviewed screenshot is redistributed.

Open items limit the stated runtime, binary, site, visual or source-compatibility
grain. They do not authorize guessing, and they do not invalidate the closed
source-semantic requirements at `L2`.

## Artifact identities

The public revisions and all primary source hashes are normative in the evidence
ledger. The manual witnesses are:

| Artifact | Bytes | SHA-256 | Use |
| --- | ---: | --- | --- |
| C303 `zmail/manual/top.txt` | 3,360 | `215ee37501c25d6909dbb989bf1d30b1393c9aa6078173fbf2c1f77fd3569f5a` | First Edition, ZMail 50/System 94, April 1983 identity |
| C303 `zmail/manual/manual.text` | 163,179 | `ac360407be2d99ffd3b80cbac0e823072366105b98808a94250b7182780017ba` | contemporary workflow and command comparison |
| Symbolics *Editing and Mail*, Genera 8 | 1,965,567 | `80e77cb08b287635f47a781f68ce4ea8a14e05aaf7f19e0df81685d262b81d0d` | public reader/composer/storage/manual comparison |
| *Genera 8.0 Release Notes* PDF | 553,577 | `c0259d6f0c5dac8802344e95e6ef33f0384567830b44316cee74e28ed5f17cb6` | public release-delta cross-check |
| *Genera 8.1 Release Notes* PDF | 1,020,591 | `4b26763c71ada2ddd3dc4019e83f70df9ff242857a99e5d5326ca68f0be23225` | public release-delta cross-check |
| *Genera 8.3 Release Notes* PDF | 171,772 | `d1497d0f9c5244985057228afda9e2f5e4c1989aedec6993054128e9f04fcd68` | public release-delta cross-check |
| installed 8.0 `zmail.txt` | 9,931 | `75b804aa76941d2f3b1369580e98c3534e4db3afd5daab1a76f479c92854cd09` | local decoded evidence for detailed 8.0 Zmail changes |
| installed 8.1 ECO `zwei.txt` | 1,696 | `b755efaad0c695a13e49708b85b6bef616f867ed4b302439cedc2e178b05fb45` | local decoded evidence for Abort/typeout correction |
| installed 8.2 `zwei.txt` | 876 | `01b7aca52a09706200011b854d7e2f1fe4d1b0aacad30c116b8d76bbd431893d` | local decoded evidence for Unix-save version retention |
| installed 8.3 `intro.txt` | 36,876 | `90f8a630fb5ef944b2c8e373ea2f3789e855168ab7d2723254d3e8449802a523` | local decoded evidence for 8.3 deltas |

The System 46 public tree is pinned to Git
`8e978d7d1704096a63edd4386a3b8326a2e584af`; maintained LM-3 `sys` is pinned to
Fossil
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
The tested `303-0` band is independently identified in the CADR dossier. The licensed
Genera source paths are portable suffixes; the 37-member analytical-core and
47-member declared-build-closure sorted
manifest identities in the ledger permit local verification without publishing
source bytes.

Curated images are independently cataloged in
[Genera runtime screenshot evidence](assets/genera-screenshots/). PNG/pixel hashes
prove image identity, not implementation or world identity. The exact reuse decision
is in [the screenshot publication review](screenshot-publication-rights-review.md).
All raw session artifacts remain in ignored `build/` trees; licensed source/worlds
remain in ignored local input trees.

## Sources

- MIT CADR System 46,
  [`nzwei/dired.55`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/dired.55),
  Mail major mode, entry functions and request-file writer.
- MIT CADR System 46,
  [`nzwei/comtab.115`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/comtab.115),
  parent ZWEI command tables.
- LM-3 maintained System 303,
  [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp),
  exact ZMail module selection.
- LM-3 maintained System 303,
  [`zmail/defs.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fdefs.lisp),
  state objects, tables and defaults.
- LM-3 maintained System 303,
  [`zmail/top.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Ftop.lisp),
  frame, task layouts, foreground/background entry and parse ownership.
- LM-3 maintained System 303,
  [`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp),
  reader command dispatch, lifecycle and bulk operations.
- LM-3 maintained System 303,
  [`zmail/mail.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmail.lisp),
  integrated drafts and partial submission order.
- LM-3 maintained System 303,
  [`zmail/mfiles.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmfiles.lisp),
  file/inbox state, load/save and Text export.
- LM-3 maintained System 303,
  [`zmail/mfhost.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmfhost.lisp),
  Rmail, Babyl, Tenex, Unix and VMS adapters.
- LM-3 maintained System 303,
  [`zmail/window.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fwindow.lisp),
  summary/message rendering and TV pointer behavior.
- LM-3 maintained System 303,
  [`zmail/filter.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Ffilter.lisp),
  filter, universe and transient task contexts.
- LM-3 maintained System 303,
  [`zmail/profil.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fprofil.lisp),
  typed profile editor and button behavior.
- LM-3 ZMail 50/System 94 manual source at the same pinned check-in,
  [`zmail/manual/top.txt`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmanual%2Ftop.txt)
  and
  [`manual.text`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmanual%2Fmanual.text).
- Symbolics, [*Editing and Mail*, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  reader, composition, profile and mail-file comparison; verified 2026-07-19.
- Symbolics, [*Genera 8.0 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.0_Release_Notes.pdf),
  [*Genera 8.1 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.1_Release_Notes.pdf),
  and [*Genera 8.3 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Release_Notes.pdf),
  public release-delta witnesses; verified 2026-07-19.
- Licensed local Genera 8.5 source artifacts named and hashed in the ledger,
  including Zmail definitions, top, commands, collections, filters, universes,
  references, drafts, mail files/formats/access paths, calendar, profile, KBIN and
  ZWEI Mail. These are evidence only and are not reproduced.
- [MIT CADR/LM-3 ZMail evidence dossier](mit-cadr/zmail.md),
  [Genera 8.5 Zmail evidence dossier](genera/zmail.md), and the incorporated binding,
  command-effect, filter/universe/Profile, option, storage-format, and declared-build
  companions, for broader historical analysis and portable runtime provenance.

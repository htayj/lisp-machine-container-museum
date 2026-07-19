---
type: Artifact Analysis
title: ZMail on the MIT CADR and LM-3
description: Source-, manual-, and runtime-grounded study of the System 46 mail composer, maintained System 303 ZMail, and the tested 303-0 load-band boundary.
tags: [mit-cadr, lm-3, zmail, mail, zwei, application, runtime]
timestamp: 2026-07-19T18:44:32-04:00
---

# ZMail on the MIT CADR and LM-3

ZMail is a mail-reading, filing, searching, and composition environment built on
ZWEI rather than a thin command for sending text. The maintained LM-3 tree gives it
message and summary panes, selectable window layouts, mail-file buffers, filters and
universes, keywords, reference-thread operations, a profile editor, drafts, multiple
delivery paths, hardcopy, and a separate background process. Its effective command
environment is documented in the [binding companion](zmail-keybindings.md).
The normative, implementation-ready contract is the
[ZMail and mail-composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md).
The [filter, universe, Profile, and option companion](zmail-filter-universe-profile-semantics.md),
[named-command effect closure](../zmail-command-effect-closure.md), and
[mail-file format semantics](../zmail-mail-file-format-semantics.md) provide the
exact finite and failure-order contracts behind this historical overview.

The preserved evidence has an important boundary. The public System 46 snapshot does
not contain the ZMail implementation used here. The maintained System 303 tree does,
and the tested `303-0` load band lists **Mail** in the System Menu, but that base band
does not have the `ZWEI:ZMAIL-FRAME` flavor loaded. Thus source presence and a static
menu entry do not establish a runnable application in that exact unsited world.

These are three selectable evidence profiles, not successive observations of one
artifact:

| Profile | What the evidence establishes | What it does not establish |
| --- | --- | --- |
| Public System 46 at Git `8e978d7` | ZWEI Mail major mode, standalone `MAIL` and `BUG`, draft template, and request-file writer | a full ZMail reader or the missing Zmacs key overlay |
| Maintained System 303 at Fossil `4df393c` | readable ZMail reader/composer source and its source-visible algorithms | pristine historical provenance or residency in the tested band |
| System `303-0` load band | a Mail System Menu entry, absent resident `ZWEI:ZMAIL-FRAME`, and a load attempt stopped at the unsited file-host boundary | a running reader, maintained-source residency, or application pixels |

The ZMail 50/System 94 manual is a fourth, version-qualified intended-behavior
witness. None of these profiles is silently substituted for another.

## Evidence sets

### Maintained LM-3 source and contemporary manual

The source analysis pins the LM-3 System repository at check-in
[`4df393c`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
tag `system-303`. This is maintained preservation work, so it is not silently treated
as a pristine 1980s release checkout.

The active `DEFSYSTEM ZMAIL` declaration selects 18 unique Lisp source paths. They
total 666,208 bytes. A manifest made from each repository-relative pathname, byte
size, and SHA-256 in expanded declaration order has SHA-256
`03fba3258c2baa74d618a6e6d0e3eb2407ca115b04f2d9fd64db7937bf147115`.
The principal files are:

| File | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `zmail/defs.lisp` | 49,882 | `6f0b1401d0e48f049671088286685311f38e72a623f94ce242fa8df05431b00e` | message, buffer, command, menu, option, and window-layout definitions |
| `zmail/top.lisp` | 45,891 | `dcd33f0810c687a30c4d1a2758ee4781eb58975093116cc7cb47b620353eec87` | frame, panes, command loop, background process, and startup |
| `zmail/comnds.lisp` | 114,870 | `9a9e0d68cc3a3bbc358aa48ff407feaaba406bd717ec61d6d32681297d75ea93` | top-level command tables and most message commands |
| `zmail/mfiles.lisp` | 68,281 | `663346b2927fbd9988b9fd754747ed472430d8a25ed90732e2a60bad3a6456e4` | mail-file buffers, saving, expunging, and hardcopy |
| `zmail/mail.lisp` | 83,733 | `9bcf41074afa3524fee48f5b61af130a0115223c447db778f12b79ef138b7705` | composition, replies, forwarding, drafts, and delivery |
| `zmail/window.lisp` | 41,968 | `df732df25f9da4aeded86dedec7c5adeebc7e40882d293c9e7337249c627db6e` | message/summary windows, mouse behavior, and configuration switching |
| `zmail/filter.lisp` | 92,892 | `97e7dd830fd71d621b6aca7517e1cd5e1f138c741d64c57a152cdb202e788a31` | filters, universes, sorting, surveying, and map-over-message operations |
| `zmail/profil.lisp` | 45,394 | `be6d2632a8fbb82e8244714939824921031e84c27c18fc2811ba472a7c14d0c3` | non-programmer profile editor and option display |
| `zmail/rfc733.lisp` | 39,136 | `ac6fdf35fbc4db9b270dd8eec4787193795eb67687dc21d046ff074052426f69` | RFC 733-era address and header parsing |
| `file/zmail.lisp` | 1,255 | `9dc404499b5ff07b400c1739ccbf808b1ecea9e253966a2ae1760e0fcd6a17a9` | file-system integration loaded as part of ZMail |

The active local-filesystem integration is `file/zmail.lisp`. Although selected by
the system declaration, `zmail/lmfile.lisp` is entirely commented out. The separate
`zmail/lm.lisp` is not selected at all, and its pathname defaults are therefore not
part of the strict System 303 profile.

The tree also contains the first-edition *ZMail Manual*, labeled ZMail 50 on
System 94 and dated April 1983. Its 163,179-byte source has SHA-256
`ac360407be2d99ffd3b80cbac0e823072366105b98808a94250b7182780017ba`.
It is contemporary product documentation, but its version label differs from the
maintained System 303 source and the tested band. Claims below are therefore
cross-checked against code, not copied from the manual as though all three artifacts
were identical.

### System 46 boundary

The museum's pinned public System 46 snapshot is
[`8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src).
Its ZWEI files contain a mail-composition mode, but the snapshot has no ZMail system
or `ZMAIL-FRAME` implementation. ZWEI Mail mode and ZMail are therefore separate
catalog entries: one edits outgoing mail text; the other manages mail stores and the
complete reading/sending workflow.

The System 46 composer is itself behaviorally substantial. It is a sparse ZWEI
major mode: `Control-Altmode` and `End` send, `Control-]` exits while retaining the
draft for later resumption, and `Tab` retains the parent tab-stop operation. A fresh
entry clears and initializes the draft, while an argument retains its contents.
Sending requires the literal body separator and at least one nonempty To recipient;
Cc alone is insufficient. Recipient splitting is comma-based without quoted-comma
syntax, surrounding spaces and tabs are removed, and one surrounding parenthesis
pair is stripped. The writer opens its request stream before the empty-recipient
check, so strict emulation must permit a rejected draft to leave partial request
output. The command prose names `Control-G` as quit, but the executable table binds
`Control-]`; the table is authoritative for this source profile.

## ZMail is a specialized ZWEI application

ZMail uses ZWEI's editor closures, intervals, redisplay protocol, command tables,
keyboard macros, and editor windows, then adds mail-specific state. A `ZMAIL-FRAME`
combines the ZMail command-loop mixins with a process, stream, selection, macro, and
bordered constraint-frame machinery. The frame's editor closure retains the current
message, current mail-file buffer, every open ZMail buffer, a point history, drafts,
filter state, menus, and the panes belonging to the frame.

This is not merely reuse of ZWEI's keys. The same frame can temporarily switch among
message reading, summary browsing, profile editing, filter construction, and draft
composition while sharing editor state between the message, header, and draft-text
windows. The code deliberately gives the three composition-related panes the same
editor closure so commands can move among them without constructing unrelated editor
sessions.

The CADR interfaces here use ZWEI editor machinery and the TV window/event system.
They are not CLIM applications: the selected system and application sources contain
no CLIM application-frame or port dependency, and summary interaction is delivered
as TV `SUMMARY-MOUSE` blips. Similar vocabulary such as frames, menus, and typed
typeout items does not make this a CLIM or Dynamic Windows program.

The frame also creates a separate `Zmail background` process. Its default priority is
`-5`; request, response, and lock cells connect it to the foreground application.
Source options independently control background mail checks and background saves,
and both are enabled by default because their inhibit flags default to false.

## Visible pane and layout model

The frame defines these persistent panes:

| Pane | Purpose |
| --- | --- |
| Mode line | mail-file name, current message, keywords, macro depth, and more/scroll state |
| Message window | displays or edits the selected message |
| Summary window | scrollable message list with mouse-sensitive entries |
| Command menus | the ordinary command set or the filter-aware command set |
| Universe/filter buttons | choose which messages a command can affect |
| Draft header and text windows | compose outgoing headers and body |
| Filter frame | construct or select a message predicate |
| Profile and profile-editor windows | inspect and edit user options |

The reading layouts are not cosmetic presets. They determine which interaction
surface receives commands:

| Source name | User-facing meaning | Composition |
| --- | --- | --- |
| `:SUMMARY` | summary only | summary pane plus mode line |
| `:BOTH` | summary above the selected message | default initial layout |
| `:MSG` | message only | message pane plus command menu |
| `:NEW` | experimental filter-oriented layout | separate global and filter-aware menus plus universe/filter buttons |
| `:SEND` | new message | headers, draft body, and editor mode line |
| `:REPLY` | reply with original visible | original message, draft headers, and draft body |
| `:FILTER` | filter construction | summary and filter frame |
| `:PROFILE` | profile editing | profile option display and an editor pane |

The `:NEW` configuration is a source-visible experimental design the short System
Menu cannot reveal. It makes the selection universe and filter explicit parts of the
main reading UI rather than treating every command as operating only on the current
message.

## Message and mail-file model

A ZMail buffer owns an adjustable array of messages and buffer options. Disk-backed
subclasses add pathname and stream state, while temporary buffers can represent a
filtered or constructed set without pretending to be a mail file. The current
message is an element of the current buffer, but a summary can step across related
inbox and mail-file buffers.

Message headers are normalized to keyword-like internal names. The inspected source
recognizes sender and recipient fields, dates, references, expiration data,
forwarding/redistribution metadata, file copies, message identifiers, subjects, and
font information. Address-valued fields are parsed separately from dates and
message-reference fields. This typing supports filtering and reply construction; the
program is not limited to searching unstructured header strings.

The source retains RFC 733-specific parsing and offers header-output modes named
RFC733, Network, ITS, and None. That is evidence for the era and interoperability
targets of this source, not a claim that it implements every later Internet-mail
standard.

### Status vocabulary and parser ownership

The executable System 303 old-mail-buffer state machine uses `NIL` for stable state
and `:LOADING`, `:SAVING`, `:SAVING-REQUIRED`, and `:AWAITING-NEW-MAIL` while work is
pending. New-mail/inbox work additionally uses `:NEW-MAIL`,
`:LOADING-NEW-MAIL`, and `:AWAITING-SAVE`. A nearby source comment instead spells
two states `:SAVE-REQUIRED` and `:AWAIT-NEW-MAIL`; those comment-only spellings are
not executable status values.

Header-parse ownership is claimed with an atomic `%STORE-CONDITIONAL` transition on
the message's parse-state cell; it is not protected by the separate recursive
disk-buffer lock. A source-visible failure edge remains important: a waiter sleeps
for the owner to publish `T`, but an owner that unwinds restores `NIL`, so that waiter
can remain asleep. This is a strict compatibility fault case, not a recommendation
for a modern implementation; D08 defines a separately labeled safe extension which
wakes the waiter with failure.

### Registered System 303 mail-file formats

The selected source registers six formats:

| Format | Source-visible representation boundary |
| --- | --- |
| Rmail | ITS-style control-underscore message boundaries and whitespace handling |
| Babyl | versions 4 and 5, with `*** EOOH ***` separating original and canonicalized headers; other versions enter a continuable-error path |
| Tenex | date, decimal byte count, octal status, and malformed-record recovery |
| Unix | candidate `From ` separators selected by weekday/date and adjacent-line heuristics; no general mboxrd unescape/escape pass |
| VMS | formfeed/fixed-header or CHAOSMAIL-header variants |
| Text | write-only export separated by the configured separator and excluded from supported input; a forced low-level read publishes consecutive nonblank lines separately, then faults on an initial/intervening blank line because the message start is null, despite an adjacent zero-message comment |

This corrects two tempting inferences. The manual says VMS and Multics are
unimplemented, while the maintained source implements VMS but not Multics. And the
inactive `lm.lisp` file must not be used to invent a seventh strict-profile adapter
or LM-host default. The active local-file integration chooses Babyl for ordinary
local files.

The Text result is another compatibility trap. Rejecting or clearly labeling an
attempt to reopen an export matches the supported non-reparsable UI boundary. If a
strict source profile exposes the low-level load anyway, executable control flow
publishes one message for each consecutive nonblank line, but an initial or
intervening blank/space-tab-only line reaches buffer-pointer construction with a null
start and faults before publication. The adjacent comment instead predicts zero
messages. The maintained source and its untested band behavior must remain separate
until the forced-load runtime oracle records the exact condition and cleanup.

## Feature inventory

### Reading, navigation, and display

- move to next or previous messages, with variants for unseen, undeleted, first, and
  last messages;
- jump or go to a message selected by a filter, move between saved points, and set a
  message-position mark;
- switch among summary-only, message-only, combined, and experimental filtered
  configurations;
- scroll the message and summary panes separately, recenter, refresh, and move to the
  start or end of a message;
- show the parsed or original header, type messages to a typeout window, and edit the
  current message through ZWEI;
- list, select, rename, and kill ZMail buffers.

### Filing and lifecycle

- mark messages deleted or undeleted, remove them from a temporary result buffer,
  expunge disk-backed buffers, and choose the direction of movement after deletion;
- save changed mail files, move a message to another file, concatenate it to an
  existing message, append or move relative to a referenced message, and save a
  message into the ZWEI kill ring;
- get new mail, optionally jump after retrieval, handle append-versus-prepend policy,
  and keep the primary inbox distinct from other mail-file buffers;
- assign expiration dates and optionally delete expired messages per file;
- detect duplicate messages and turn a digest into individual messages, with options
  for deleting or clipping the original digest;
- print one message or a whole selected set through the hardcopy abstraction.

### Searching, classification, and bulk operations

- find a string from the current position and perform an occurrence search over a
  selected message population;
- attach or remove keywords and build reusable filters from typed message attributes;
- define *universes*, which name the population to which a filter and command apply;
- sort messages and survey a filtered set in a summary;
- map Delete, Undelete, Type, Find String, Keywords, Unkeywords, Move, Forward,
  Redistribute, Reply, or Concatenate across the selected population;
- select, delete, or move messages connected by reference headers, including an
  entire reference conversation.

The universe/filter distinction is historically notable. It separates “which
messages may be considered” from “which predicate selects among them,” then applies a
command to the result. That is closer to a small interactive query system than a
folder-only mail reader.

### Composition and delivery

- compose ordinary mail, replies, forwards, redistributions, local messages, and bug
  reports;
- choose reply-recipient policies such as sender only, original recipients, or
  sender plus recipients, with independent display policies for the original message;
- add To, Cc, FTo, FCC, From, Subject, In-Reply-To, and additional text fields;
- generate or suppress Message-ID and In-Reply-To fields, require a subject, and
  format addresses with short, long, personal-name, or original-text policies;
- yank the current message, prune selected headers, inherit or transform subjects,
  and use mail/reply/bug/forwarding templates;
- save, restore, write, and preserve drafts as messages; switch between one-, two-,
  and three-window reply arrangements; recursively start another mail operation;
- send through a file-job/COMSAT path, a Chaos mail server, direct Chaos delivery,
  Ethernet mail, or SMTP when the relevant site support is available.

The transport menu is capability metadata in this audit. It does not prove that an
SMTP server, Chaos mail server, or Ethernet interface was configured in the tested
load band.

The maintained source also fixes the send order, including its partial results.
Headers are validated, a subject may be requested, and a message identifier is
generated first. Requested FTo, FCC, and BFCC copies are then filed locally, with
overlap precedence FTo over FCC over BFCC, *before* the network/file transport is
called. Only transport success marks the draft sent and marks source messages
Answered or Forwarded. A transport failure can therefore leave committed local
copies and an unsent draft; retry can duplicate those copies. Visible and blind
Chaos recipients use separate sessions, and direct Chaos submission proceeds per
host, so earlier recipients or hosts may succeed before a later failure. The selected
tree advertises Ethernet and SMTP-related choices but contains no active Ethernet
sender and delegates SMTP outside the selected closure. They are unavailable without
their providers, not aliases for another transport. An FTo-only draft can count as a
successful local filing because file submission is a no-op when both To and Cc are
empty.

### Profiles and self-description

ZMail's profile editor exposes user options without requiring Lisp code. The source
turns option definitions into editable values with types such as boolean, menu
choice, number, pathname, pathname list, address list, string list, and Lisp form.
Options cover layout, summary proportions, deletion direction, reply behavior,
headers, file copies, templates, mail checking, saving, filtering, and mouse-button
semantics.

The selected `defs.lisp` contains exactly 69 active textual user-option forms. The
[semantic companion](zmail-filter-universe-profile-semantics.md) records every
name, type, default, applicability restriction, persistence class, update hook, and
the source-visible filter/universe/Profile defects. That finite denominator excludes
separately declared site, hardcopy, backup, and patch options.

The command system is also self-describing. `?`, Help, `Meta-X`, `X`, `Meta-?`, and
the named Apropos command reach different combinations of key help, full help,
extended-command completion, and command-name searching. Menu buttons carry dynamic
mouse documentation, and mode-line elements for keywords and scroll state are
selectable. The implementation registers 86 distinct top-level ZMail command
functions in the active source set; not all have a direct key.

### Persistence and inbox failure boundaries

System 303 does not wrap mail retrieval, merge, expunge, and save in one transaction.
Strict compatibility preserves these source-visible orderings:

1. An inbox source may be renamed before messages are read; a later parse or insert
   failure leaves that renamed source as recovery evidence.
2. Pending inbox files are deleted only after the destination mailbox save. A delete
   error is printed, but the pending list is then cleared, so that process does not
   automatically retry the deletion.
3. Merge splices interval/node structures before updating message arrays; a failure
   can expose a partially merged in-memory structure.
4. Save All expunges every selected buffer before saving any buffer. A later save
   failure follows already completed in-memory expunges.
5. Expunge applies expiration deletion before its confirmation; declining the later
   prompt need not undo those newly applied delete marks.
6. A foreground/background save-finish edge can abort-close a `:SAVING` buffer and
   leave status `NIL` instead of `:SAVING-REQUIRED`.

A reconstruction may offer transactional behavior as an explicit safety extension,
but that behavior is not the strict System 303 profile.

## Defaults and implementation findings not evident from a menu

| Finding | Source-visible behavior | Interpretation |
| --- | --- | --- |
| Initial layout | `:BOTH` | summary and current message are intended to be visible together by default |
| Summary height | 45 percent of the frame | the split is configurable, not hard-wired to one pixel geometry |
| Summary scrolling | 20 percent per summary-scroll operation | message and summary scrolling have independent increments |
| Delete then move | forward | ordinary deletion advances unless the profile changes it |
| Delete after filing | enabled | moving a message to a file also marks it deleted by default |
| Expunge confirmation | disabled | the inspected source does not ask by default before expunging |
| Background checks/saves | enabled | options are phrased as inhibit flags and default to false |
| Reply addressing | all | the normal reply default includes sender and original recipient fields |
| Reply presentation | like ordinary mail | showing or yanking the original is a separate profile choice |
| Message identity | Message-ID and In-Reply-To generation enabled | conversation/reference operations have structured metadata to work from |
| Draft UI | dedicated header and body panes plus one/two/three-window commands | composition is a layout transition inside ZMail, not an external editor process |

These are exact defaults in the pinned maintained source. A user's profile can alter
them, and the runtime audit did not establish the effective profile of a configured
historical site.

## Runtime observation: advertised but not resident

Fresh harness session `zmail-dossier-20260718`, generation 1, booted System `303-0`.
The System Menu visibly offered **Mail**. Source identifies that item as a call to
select or create `ZWEI:ZMAIL-FRAME`.

The runtime result was narrower:

1. The researcher dismissed the cold-boot date questions and opened the System Menu
   with Mouse-3.
2. Selecting the Mail row did not expose a mail frame.
3. Evaluating the menu's target directly produced an error that
   `ZWEI:ZMAIL-FRAME` was not a valid type specifier, establishing that its flavor was
   not loaded in this world.
4. `(MAKE-SYSTEM 'ZMAIL)` entered the login/file-host path and attempted to reach the
   band's `AMS-BRIDGE-1` default. The unsited isolated environment could not reach
   that host. A later attempt to point the session at the private local bridge did
   not complete the login, so the system was not loaded.

This is a useful correction to the static catalog: the menu entry is real, the
source system is real, and the program is not resident in the exact base band. The
failed load is attributable to site/file-host configuration in this run; it is not
evidence that ZMail itself is broken.

| Runtime field | Portable record |
| --- | --- |
| Load band and disk | System `303-0`; base/private disk SHA-256 at start `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`; base disk unchanged after stop |
| Source and emulator | System check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; usim check-in `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`; execution SHA-256 `707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be` |
| Source copies | System, Chaos, and usite trees matched their public copy-time revisions; tree SHA-256 values were respectively `21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`, `34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87`, and `adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81` |
| System Menu capture | `0004-system-menu.png`, 768 by 963; PNG SHA-256 `be43767534312f0e3147de49776d7da26c5aa3da702f4c895773c5c1a8618a4e`; pixel SHA-256 `a2fd2d6b8e1508bf5f9a0484f74b2a9c63007bb2f9017d25d5fd31fea0b2f70a` |
| Missing-flavor capture | `0009-zmail-direct.png`, 768 by 963; PNG SHA-256 `8cb35887bf05da2337d7d2a425bec51decfdb61e05b64e1922913e1f289d92ff`; pixel SHA-256 `dacbf9d2241cba33ab285265950fcfbfe2ff1f7d703b84846593ec19cf21a86a` |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`, channel commit `230aa373f315f247852ee07dff34146e9b480aec`; this exploratory run invoked the Python entry point directly and recorded Python 3.14.6 plus host X/ImageMagick tools rather than the wrapper's fully resolved Guix profile |
| Termination | clean harness stop; `forced_stop: false`; `state_may_be_incomplete: false`; usim and Xvfb exit 0 |

The captures remain in the ignored session tree. They establish the load boundary but
do not show ZMail itself, so publishing either would add little visual evidence to an
application study.

**Screenshot TODO:** prepare a fresh, non-persistent session with the repository's
local file-host translations loaded, load ZMail without saving the world, open an
empty or synthetic mail file containing no private correspondence, and capture the
combined summary/message layout plus one draft-composition layout. Each selected
image then needs the repository's
[capture-specific publication review](../screenshot-publication-rights-review.md)
before tracking.

## Open questions

- Which precise ZMail version was intended to accompany the tested `303-0` band? The
  source tree, manual labels, startup system numbers, and maintained checkout are not
  one release manifest.
- Can the current harness provide a disposable local mail store and mail/file server
  without broadening its isolation boundary? That is required for safe end-to-end
  reading and filing tests.
- Which transport modes can be exercised against an inert local test peer while
  preserving the museum's no-external-route policy?
- Do the experimental `:NEW` universe/filter panes work completely in this source,
  or are they a partially integrated interface generation? Source defines the layout,
  but this audit has not run it.

## Sources

- MIT CADR System 46
  [`nzwei/dired.55`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/dired.55),
  Mail major mode, entry functions, request grammar, and writer.
- LM-3 System 303
  [`DEFSYSTEM ZMAIL`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp).
- LM-3 System 303
  [`zmail/top.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Ftop.lisp),
  frame and process architecture.
- LM-3 System 303
  [`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp),
  command tables and command implementations.
- LM-3 System 303
  [`zmail/mail.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmail.lisp),
  draft, filing, send, and transport ordering.
- LM-3 System 303
  [`zmail/mfiles.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmfiles.lisp),
  save/inbox state, persistence ordering, and Text export.
- LM-3 System 303
  [`zmail/mfhost.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmfhost.lisp),
  Rmail, Babyl, Tenex, Unix, and VMS adapters.
- LM-3 System 303
  [`file/zmail.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file%2Fzmail.lisp),
  active local-file integration.
- Richard Stallman,
  [*ZMail Manual*, first edition](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmanual%2Fmanual.text),
  April 1983, ZMail 50/System 94 source.
- [Operating CADR through the Xvfb computer-use harness](cadr-computer-use-harness.md),
  runtime method and provenance requirements.

Last verified: 2026-07-19.

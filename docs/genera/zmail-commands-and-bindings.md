---
type: Reference
title: Genera 8.5 Zmail commands and bindings
description: Evidence-only inventory of Zmail top-level keys, prefixes, menus, summary gestures, draft-editor commands, and Zwei Mail-mode bindings in the inspected Genera 8.5 release.
tags: [genera, zmail, mail, zwei, keybindings, commands, reference]
timestamp: 2026-07-19T18:44:32-04:00
---

# Genera 8.5 Zmail commands and bindings

This reference inventories the command surfaces configured by the inspected
Genera 8.5 Zmail and Zwei Mail-mode source: every direct Zmail key entry, every
Zmail `Control-X` entry, the right-button and command-pane menus, summary-row
gestures, integrated draft-editor deltas, Zwei Mail-mode deltas, and all 152
clean-release top-level completion candidates.

It contains factual command names and original summaries, not proprietary source
or copied manual prose. See [the application study](zmail.md) for architecture,
features, storage and transport boundaries, artifact identities, manual
cross-checks, runtime observations, and rights handling. The normative
cross-system contract is the
[ZMail and mail-composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md).

When D08 incorporates this page, `MUST`, `MUST NOT`, `SHOULD`, and `MAY` state
normative requirements for the selected source profile. Descriptive source and
runtime claims remain bounded by the evidence labels and unresolved oracles below.

## Scope and notation

- `C-`, `M-`, and `H-` mean Control, Meta, and Hyper. `Sh-` means Shift where
  case matters.
- `Mouse-L`, `Mouse-M`, and `Mouse-R` are the left, middle, and right buttons.
- Named Genera characters such as `Abort`, `Altmode`, `Back-Scroll`, `Break`,
  `End`, `Find`, `Help`, `Home`, `Redo`, `Refresh`, `Resume`, `Scroll`, and
  `Undo` are not guesses about PC keyboard labels.
- “Direct” means a literal entry in the Zmail table. It is not synonymous with
  “effective.” Editor contexts inherit the exact D05 ZWEI/Zmacs parents in
  [the Genera binding tree](zmacs-keybindings.md); typed presentations, task
  loops, patches, profile choices, site files, and user-installed keys can add,
  shadow, or make behavior inapplicable.
- The core source contains 150 direct top-level command definitions. KBIN adds
  `Reparse All Loaded Messages`; Zmail adopts generic `Show Printer Status`.
  The 152-name list below is the clean declared release closure, not a live-site
  dump.
- The source also defines 41 Zmail draft-editor commands. They are distributed
  across address editing, message editing, reply composition, and draft handling;
  they are not all direct keys in one table.
- The inspected source profile is System 452.1 / Zmail 442.0. Runtime evidence
  comes from a Genera 8.5 world; no exhaustive comparison yet proves that every
  source definition is the bytecode resident in that world.

## Effective-tree boundary

This page is complete only when read as an effective graph, not as a flat key
list. The top-level Zmail table has no ordinary text-mode parent. Its local direct
cells, generated numeric cells, Zmail-owned `Control-X` child, menu events, TV
blips, presentation translators, and transient task loops form the reader graph.
An absent or explicitly undefined top-level cell reports an undefined Zmail key;
it does not insert text through Standard ZWEI.

The owning interface substrate is ZWEI + TV with selected Dynamic Windows and
Command Processor services. It is not CLIM. In particular, shared words such as
presentations and commands do not change the active summary-row mechanism from
TV `SUMMARY-MOUSE` blips into CLIM or Dynamic Windows rows.

Editor contexts are different. Message and reply tables inherit the active ZWEI
mode from D05; their otherwise-empty `Control-X` overlays inherit the selected
mode's `Control-X` child after the Zmail-local leaves. Separate Zmacs Mail mode is
a Text-mode-derived minor overlay and likewise inherits Text, other active minor
modes, Zmacs, and Standard ZWEI in the D05 order. Thus every complete enumeration
must include both this page's local deltas and the pinned D05 parent graph.

The other application contexts do not all inherit an editor table. Before their
editors are entered, the Filter, Universe, and Profile frames accept only Refresh,
`Control-R` to enter editing, Break, and Abort; other keys barf. Their pointer and
presentation handlers are separate branches described below. Calendar, typeout,
minibuffer, command-pane, and summary contexts likewise retain their own dispatch
and applicability rules.

## Zmail top-level direct table

### Message and summary movement

| Binding(s) | Command |
| --- | --- |
| `Down` | Next |
| `C-Down`, `C-N` | Down To Next |
| `M-Down`, `M-N` | Next Unseen |
| `Up` | Previous |
| `C-Up`, `C-P` | Up To Previous |
| `M-Up`, `M-P` | Previous Unseen |
| `Home`, `M-<`, `.` | Start Of Message |
| `M->` | End Of Message |
| `C-Home`, `C-M-<` | Start Of Summary Window |
| `C-M->` | End Of Summary Window |
| `C-M-L` | Select Previous Sequence |
| `C-Space` | Set Pop Mark |
| `C-M-Space` | Move To Previous Point |

### Scrolling, redisplay, and search

| Binding(s) | Command |
| --- | --- |
| `Scroll`, `Space`, `C-V` | Scroll Message Next Screen |
| `Back-Scroll`, `Backspace`, `M-Scroll`, `M-V` | Scroll Message Previous Screen |
| `C-M-V` | Scroll Summary Window |
| `C-M-Sh-V` | Scroll Summary Window Backward |
| `C-Scroll` | Scroll Typeout Window |
| `C-Back-Scroll`, `C-M-Scroll` | Scroll Back Typeout Window |
| `C-L` | Recenter Message Or Summary Window |
| `Refresh` | Refresh |
| `Find`, `C-F` | Find String |

### Editing, command dispatch, and Help

| Binding(s) | Command |
| --- | --- |
| `Undo` | Undo |
| `Redo` | Redo |
| `C-D` | Delete And Up |
| `C-R` | Edit Current Message |
| `C-G` | Beep |
| `C-U` | Quadruple Numeric Arg |
| `C-Z` | generic Quit |
| `M-X`, `X` | Extended Command |
| `M-?` | Self Document |
| `C-M-?` | Documentation |
| `M-Sh-D` | Show Documentation |
| `?`, `Help` | Zmail Help |
| `C-M-Y` | Repeat Last Mini Buffer Command |
| `C-M-Sh-Y` | Repeat Last Matching Mini Buffer Command |
| `M-W` | Save Region |
| `Break` | Zmail Break |
| `Resume` | Continue |
| `M-~` | Not Modified |

### Single-letter commands

These are uppercase command characters, not Control combinations.

| Binding | Command | Binding | Command |
| --- | --- | --- | --- |
| `C` | Continue | `D` | Delete |
| `E` | Expunge Sequence | `F` | Forward |
| `G` | Get New Mail From Inbox | `H` | Reformat Headers |
| `J` | Jump | `L` | Keywords |
| `M` | Mail | `N` | Next |
| `O` | Move | `P` | Previous |
| `Q` | Quit | `R` | Reply |
| `S` | Save All Mail Files | `U` | Undelete |
| `X` | Extended Command | `Z` | Large Argument |

The main menu label `Jump` is not the same command as keyboard `J`. The menu
invokes `Goto`, a filter-based search with mouse-button-dependent defaults;
keyboard `J` invokes `Jump`, which uses a numeric message number when supplied
and otherwise moves to the first undeleted message. This distinction is visible
only by following the two source registrations.

### Numeric argument cells

`-`, `C--`, `M--`, and `C-M--` negate the numeric argument. Digits `0` through
`9` are installed with no modifier, Control, Meta, and Control-Meta. The source
range forms install all ten digits for each modifier set.

### Zmail Control-X table

| Binding | Command |
| --- | --- |
| `C-X B` | Select Sequence |
| `C-X C-B` | List Sequences |
| `C-X C-F` | Edit Mail File |
| `C-X C-Sh-F` | Edit ordinary File |
| `C-X K` | Kill Sequence |
| `C-X M` | Mail recursively from a Zmail draft context |
| `C-X C-R` | Examine Mail File |
| `C-X C-S` | Save Mail File |

The Zmail prefix is independent of Zmacs's `Control-X` overlay. In particular,
Zmacs `Control-X M` enters the separate Zwei Mail mode described below, while
Zmail draft `Control-X M` composes recursively and returns to the higher-level
draft afterward. A missing Zmail `Control-X` child is unbound; it does not inherit
the same-spelled Zmacs child merely because both use `Control-X`.

### Numeric, prefix, unbound, and Help behavior

Before each top-level command, Zmail resets the numeric value to one, the
argument-present flag to false, and the digit count to zero. `C-U` multiplies the
value by four. `Z` produces signed octal `37777777` and marks the argument as
infinite. Minus and digits are installed in the plain, Control, Meta, and
Control-Meta banks; each selected command independently accepts, rejects, or
ignores the resulting argument.

The argument-present flag is a five-state provenance tag, not a Boolean:

| Tag | Reader action | Value semantics |
| --- | --- | --- |
| `NIL` | no argument command | initial value `1` |
| `:SIGN` | a minus command without a following digit | negative unit/sign state |
| `:DIGITS` | one or more digit commands | entered signed decimal integer |
| `:CONTROL-U` | `C-U` without subsequent digits | preceding value multiplied by four |
| `:INFINITY` | top-level Large Argument | signed octal `37777777` |

The shared reader establishes the first four tags at
`zwei/coma.lisp.~148~:858-886`; `FORMAT-ARGUMENT` preserves all five at
`zwei/comtab.lisp.~589~:480-487`; Zmail adds `:INFINITY` at
`zmail/commands.lisp.~1600~:422-427`; and the
main loop resets the state at `zmail/top.lisp.~1561~:1075-1086`. The distinction
is observable even where a command groups states: summary scrolling maps `NIL` and
`:SIGN` to screen units and every other tag to line units
(`zmail/commands.lisp.~1600~:1192-1200`).

Reachability is scoped by dispatcher. The top-level reader reaches all five states.
Integrated message/reply editing, separate Zmacs Mail mode, and the standalone
Filter/Universe/Profile editors use the inherited editor reader and reach `NIL`,
`:SIGN`, `:DIGITS`, and `:CONTROL-U`; clean editor comtabs do not install Large
Argument, so they do not reach `:INFINITY`. Command-pane, summary, calendar,
typeout, pointer, and noneditor utility loops own no independent numeric state and
must not synthesize button × numeric variants. Minibuffer argument semantics belong
to D05's minibuffer parent.

Prefix lookup rejects mouse characters. If it has to read the next key
interactively, it uppercases an unmodified letter before lookup; if that key was
already waiting as typeahead, it does not uppercase it. This is an observable
historical quirk, not a normalization rule. At top level a null or hard-undefined
cell clears pending input and reports the key undefined. A cell naming a symbol
without a function reports that the command is not implemented.

Zmail Help on `?` or `Help` accepts a key, menu item, or `*`. Star sorts the
command-name association list in place and describes the whole list. Key lookup
uses the active Zmail table. Help can descend the Map Over and Other menus through
their right-button behavior, but it does not recursively flatten every arbitrary
menu. A command report states main/Other/Map membership and prints no more than
four key paths before falling back to the `M-X` name. Generic self-documentation
behavior is inherited from D07; these traversal choices are Zmail-specific.

After producing the report, the source-visible prompt says that Space removes the
display and any other character or command-menu click executes a command
(`zmail/commands.lisp.~1600~:293-342`). The report is inside a relative typeout
window call, so exact event forwarding after that prompt remains a runtime oracle;
an implementation must verify it rather than infer forwarding mechanics from the
wording alone. This post-report contract is specific to G85 and must not be copied
into C303, whose Help implementation lacks it.

The two minibuffer-repeat wrappers preserve the current numeric value and provenance
tag and dynamically bind only `*COMTAB*` to the Zmail top-level table before calling
the inherited D05 commands. With no argument they repeat the most recent recorded
minibuffer command. Numeric zero lists the remembered commands; positive *N* selects
the Nth prior command. The matching variant first accepts a substring and restricts
the history to commands containing it, then applies the same zero/*N* rule. Because
the wrappers are top-level Zmail commands, all five tags can reach the delegation;
the wrappers do not reinterpret `:INFINITY`, negative values, or out-of-range
indices. Those cases retain D05's selected minibuffer-history behavior and remain an
explicit runtime oracle until that inherited implementation is enumerated. The
bindings and wrappers are at `zmail/commands.lisp.~1600~:113-114,450-466`.

## Top-level right-button menu

`Mouse-R` in the Zmail message context opens these 21 actions, in source order:

1. Select Conversation By References
2. Forward
3. Redirect Message
4. Redistribute Message
5. Hardcopy Message
6. Kill Ring Save Message
7. Set Expiration Date
8. Set Start Date
9. Set Message Default Character Style
10. Explain Bad Header
11. Show Received Path
12. Encrypt Message
13. Decrypt Message
14. Undigestify
15. Add File References
16. Show File
17. Hardcopy File
18. Edit File
19. Compile File
20. Load File
21. Show Mailing List

A fresh runtime session displayed this same 21-item menu, establishing that it
is active in the preserved 8.5 world.

## Command-pane menus

### Normal 20-cell menu

The normal command pane is a four-by-five grid. Source order and runtime layout
agree:

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
| --- | --- | --- | --- | --- |
| Profile | Quit | Delete | Undelete | Reply |
| Configure | Save | Next | Previous | Continue |
| Survey | Get inbox | Jump | Keywords | Mail |
| Sort | Map over | Move | Select | Other |

The compact labels route to fuller commands: Save means Save All Mail Files;
Select means Select Sequence; Get inbox means Get New Mail From Inbox; and, as
noted above, menu Jump means Goto rather than the keyboard Jump command.

`KBD` below means a direct-key or extended-command invocation with command-button
state `:KBD`. “Remembered” is mutable session state; “profile” is a user option.
The shared chooser treats KBD/left as the remembered default, middle as its profile
default, and right as the visible menu. A missing KBD/left default barfs; a missing
middle profile value also barfs; right cancellation aborts. A successful right
selection updates the remembered item and changes the effective command button to
the button used on that selected leaf (`zmail/window.lisp.~1538~:1194-1239`).

### Exact 20-command button matrix

| Main label | KBD | Mouse-L | Mouse-M | Mouse-R |
| --- | --- | --- | --- | --- |
| Profile | enter Profile task | same | same | same; command ignores button identity |
| Quit | confirm dangerous command, then Save + Quit | Save + Quit | Save + Quit | choose save policy × exit policy |
| Delete | use `*NEXT-AFTER-DELETE*` | same | use `*DELETE-MIDDLE-MODE*` | choose six-way delete mode |
| Undelete | scan backward through current position for first deleted message | same | same | same; command ignores button identity |
| Reply | default or message-supplied reply template | same | `REPLY-MIDDLE-TEMPLATE` | `REPLY-RIGHT-TEMPLATE`, which exposes the reply chooser |
| Configure | computed left transition | same | configured middle transition | choose one of ten configurations |
| Save | confirm dangerous command, then expunge/save all | expunge/save all | expunge current sequence | dynamic per-sequence action matrix |
| Next | Next undeleted | same | profile next mode | eight-item Next chooser |
| Previous | Previous undeleted | same | profile previous mode | eight-item Previous chooser |
| Continue | newest draft | same | newest unsent reply to current message, otherwise newest unsent draft | two-stage draft chooser |
| Survey | all messages in current universe | same | current message's conversation | choose universe/filter |
| Get inbox | current/default buffer and its default inboxes | same | current buffer and a prompted arbitrary inbox | choose buffer, then use its default inboxes |
| Jump | repeat saved Goto filter or barf | same | point-PDL chooser | choose and remember filter |
| Keywords | typed/history input, unless `*KBD-SAME-AS-MIDDLE*` | remembered add/remove sets or barf | derive from matching keyword filters | choose full keyword set and remember delta |
| Mail | ordinary Mail template | same | profile mail mode, then its template rule | choose Bug/Mail/Forward/Redistribute/Local, then template rule |
| Sort | remembered key and direction | same | sequence sort key and append-derived direction | choose key × direction and remember both |
| Map over | remembered operation or barf | same | profile operation, executed with effective right-button semantics | choose one of 16 operations and remember it |
| Move | pathname prompt, or typed sequence/unloaded file with a numeric argument; `*KBD-SAME-AS-MIDDLE*` instead selects by filters | remembered target or barf | target(s) derived from current-message filters | dynamic target chooser |
| Select | accept a sequence or unloaded mail file | most recently selected other sequence or barf | create collection by filtering | dynamic sequence chooser |
| Other | remembered auxiliary command or barf | same | profile auxiliary command, executed with effective right-button semantics | current auxiliary registry and remember selection |

Delete's numeric argument precedes button dispatch: it selects message number *N*
and forces movement mode `:NONE` (`zmail/collections.lisp.~1552~:545-573`). Undelete
likewise uses *N* as the exact message and otherwise scans backward; buttons are not
examined (`collections:622-644`). Mail maps only `1` to Redistribute and `3`/`4` to
Bug; every other numeric value barfs (`zmail/mail.lisp.~1571~:75-127`). Reply maps
only `1` to `1R-REPLY-TEMPLATE` and `3`/`4` to `3R-REPLY-TEMPLATE`; every other
numeric value barfs before button selection (`mail:242-290`).

Source anchors for the matrix are
`zmail/definitions.lisp.~1552~:323-342,1378-1564,1801-1819`;
`zmail/window.lisp.~1538~:215-256`;
`zmail/collections.lisp.~1552~:545-644,1023-1088,1568-1618,1884-1905,2051-2269,2573-2609,2839-2911`;
`zmail/commands.lisp.~1600~:854-948,1222-1266,1879-1921,2064-2089`;
`zmail/filter.lisp.~1549~:57-222,470-501`; `zmail/universe.lisp.~1511~:1231-1253`;
`zmail/mail.lisp.~1571~:60-127,242-290,883-951`;
`zmail/mail-files.lisp.~1566~:1583-1701,2147-2229,2355-2397`; and
`zmail/profile.lisp.~1517~:58-79`.

### Fixed option trees

The order here is normative; tests must compare ordered leaves rather than set
membership.

- Configure: Summary only; Both; Message only; Filtering commands;
  Summary//Message only; Calendar; Month; Four weeks; Week; Year. `Send` and the
  second visible `Message only` (`:MSG-NO-MENU`) are registered configurations but
  are deliberately absent from this chooser.
- Delete: Backward; Forward; Remove; No; Forward//Remove; Backward//Remove.
- Next: Next undeleted; Next; Next unseen; Next recent; Last undeleted; Last; Last
  unseen; Last recent.
- Previous: Previous undeleted; Previous; Previous unseen; Previous recent; First
  undeleted; First; First unseen; First recent.
- Mail: Bug; Mail; Forward; Redistribute; Local.
- Sort is a 10 × 2 product. Keys are Date, To, From, Start-date,
  Expiration-date, Subject, Keywords, Text, Length, Position; directions are
  Forward, Backward. The first nine keys are appended through sort registrations;
  Position remains the fixed tail (`zmail/collections.lisp.~1552~:1652-1835`).
- Quit is a 3 × 2 product. Save policies are Don't Save, Ask, Save; exit policies
  are Quit, Logout.
- Map over: Delete; Undelete; Type; Find string; Keywords; Unkeywords; Move;
  Hardcopy; Forward; Redistribute; Reply; Concatenate; Reformat; Unreformat;
  Select Conversation; Undigestify.
- Other begins exactly Hardcopy Message; Rename Sequence; Show File; Whois.
  `ADD-OTHER-COMMANDS` appends later registrations in load order, so patches and
  sites extend rather than redefine the clean denominator
  (`zmail/commands.lisp.~1600~:265-268,1879-1882`).

Configure's KBD/left transition is stateful: any detailed calendar view—Month,
Four weeks, Week, or Year—goes to Calendar; Both goes to Message; every other mode
goes to Both. Middle uses `*CONFIGURE-MIDDLE-MODE*`; if that option is the
Summary//Message pseudo-mode, Summary goes to Message, Message goes to Summary, and
every other current mode goes to Summary. Calendar setup occurs before applying the
configuration and post-setup occurs afterward (`zmail/window.lisp.~1538~:218-256`).

### Dynamic chooser schemas

- **Save:** buffer rows precede collection rows in the order returned by
  `GET-SEQUENCE-ALISTS`. Display columns are Expunge, UnModify, Save, Kill. A buffer
  row has Expunge, Kill, and—unless saves are disabled—Save and UnModify; a
  collection row has only Expunge and Kill. Save and Kill exclude UnModify.
  Execution order is Expunge (skipped for Kill-without-Save), UnModify, Save, Kill
  (`zmail/mail-files.lisp.~1566~:2355-2397`).
- **Select:** loaded buffers, unloaded mail files, collections, an optional
  nonselectable separator when collections exist, then Read//Create file, Examine
  file, Mark survey, Filter, Abort. A buffer-only caller omits collections, Mark
  survey, and Filter (`zmail/filter.lisp.~1549~:141-222`).
- **Move:** loaded buffers and unloaded files, then collections, then an optional
  separator, optional New collection and Recycled collection, Read//Create file,
  Just text, optional Hardcopy, optional By individual filters, Abort. Buffer-only
  mode omits collections, new/recycled collection, Hardcopy, and By individual
  filters. The Hardcopy leaf maps left to last options, middle to default options,
  and right to an options chooser (`zmail/collections.lisp.~1552~:2115-2269`).
- **Continue:** stage one is Unsent drafts; Sent drafts; All drafts. Stage two is
  matching draft rows in draft-list order, then Restore draft file and Restore draft
  message. The latter maps left to the current message, middle to no value, and right
  to a Summary chooser (`zmail/mail.lisp.~1571~:898-951`).
- **Keywords:** right displays the current keyword registry as a multiple chooser.
  Commit stores ordered newly-added and newly-removed sets for the next left action.
  KBD typed entry uses keyword history and confirms every unknown keyword before
  creation (`zmail/commands.lisp.~1600~:854-912`).
- **Get inbox:** right reuses Select's **buffer-only** menu, then resolves default
  inboxes. Middle instead accepts one arbitrary inbox pathname for the current
  buffer. KBD/left resolve current buffer, default buffer, or default mail file in
  that order (`zmail/mail-files.lisp.~1566~:1583-1701`).
- **Survey and Jump/Goto:** right enters the universe/filter selector. Survey does
  not store a quick default; Goto stores its filter function and argument. Middle is
  conversation versus point-PDL respectively
  (`zmail/universe.lisp.~1511~:1231-1253`;
  `zmail/filter.lisp.~1549~:470-501`).
- **Mail and templates:** after mail-mode selection, template rows are restricted by
  command type and sorted by menu font, then menu name; the selected row is cached as
  that command type's last item. Because Mail passes a non-null default template,
  KBD/left uses it. Middle changes its effective template button to right only for
  Bug and otherwise to left. Right uses the template menu. The separate Bug command
  passes no default: KBD accepts a known template or a string and may create a
  Bug-recipient after confirmation; pointer invocation uses the ordered menu
  (`zmail/mail.lisp.~1571~:102-127`; `zmail/template.lisp.~1525~:203-298`).
- **Other:** rows are the current append-only registry. KBD/left uses the remembered
  row, middle the profile row with effective right-button semantics, and right the
  menu; selection updates the remembered row
  (`zmail/commands.lisp.~1600~:1879-1921`).
- **Replay Keyboard Macro:** outside the 20-cell pane, this is the registered macro
  list in registration order. KBD/left uses the remembered row; right displays the
  list. Missing stream support, default, registration, or macro property barfs
  (`zmail/commands.lisp.~1600~:2064-2089`).
- **Hardcopy:** KBD uses last options without a prompt only when they equal the
  defaults; otherwise its exact choices are Yes (last), No (abort), Default. Left
  uses last, middle uses default, right chooses options, and a nonidentical result is
  normalized into the remembered last options
  (`zmail/collections.lisp.~1552~:2839-2911`).

### Calendar menu

Calendar mode retains the same 20-cell geometry. Reply, Continue, and Get inbox
become blank, nonselectable cells; Compose replaces Mail. All other labels keep
their normal positions.

### Filtering menus

With no current filtered message, the six available commands are Configure,
Get inbox, Save, Sort, Profile, and Quit.

The full filtering command pane has 15 positions, one deliberately blank:
Concatenate; Survey; Delete; Undelete; Reply; Other; Type; Next; Previous;
Continue; blank; Select; Keywords; Move; Mail.

### Other and Mail menus

`Other` contains Hardcopy Message, Rename Sequence, Show File, and Whois.

The Mail menu offers Bug, Mail, Forward, Redistribute, and Local. Button choice
and template selection can further affect these entries; they are one menu over
several composition paths, not five independent applications.

### Next and Previous menus

The complete Next menu is: Next undeleted, Next, Next unseen, Next recent, Last
undeleted, Last, Last unseen, and Last recent.

The complete Previous menu is: Previous undeleted, Previous, Previous unseen,
Previous recent, First undeleted, First, First unseen, and First recent.

Profile options select which item the middle button uses by default.

### Map Over menu

Map Over applies one of these 16 operations across the selected messages:
Delete, Undelete, Type, Find string, Keywords, Unkeywords, Move, Hardcopy,
Forward, Redistribute, Reply, Concatenate, Reformat, Unreformat, Select
Conversation, and Undigestify.

### Command-pane button dispatch

Normal, calendar, and filtering panes emit a `:MENU` blip containing the item,
button, and source window. The main-frame dispatcher records that button and invokes
the item's command; the command-specific matrix above then governs behavior. Only
commands which call `ZMAIL-MENU-CHOOSE` acquire its remembered/profile/right-menu
policy. In that helper, middle resolves a configured row and rewrites the effective
button to left; Map over and Other deliberately rewrite it again to right before
running their middle-selected operations. Right cancellation aborts rather than
silently running a stale default. Summary rows do not use this path: their TV blip
dispatcher has the separate rules below. The ingress is
`zmail/top.lisp.~1561~:1140-1164`; the helper is
`zmail/window.lisp.~1538~:1194-1239`.

### Reply-choice dimensions

The reply chooser is a generated cross product rather than a short flat list:

- recipient policy: All, All-Cc, Cc-All, To, To-Cc, Cc-To, or Sender;
- display/yank policy: Two-windows, One-window, or Yank;
- header policy: Prune or Don't prune.

That gives 42 combinations before profile defaults. The draft-ending policy is
separate and can offer Send, both sending choices, Add text, or both text choices.
The ordered dimensions are fixed at `zmail/definitions.lisp.~1552~:1455-1473`;
template precedence and numeric rejection are at `zmail/mail.lisp.~1571~:242-290`.
This 42-product is G85-specific. C303 has only its 21 recipient × view/yank
products and must not inherit the Prune dimension.

## Summary TV blips

Active rows in this profile are TV scroll-window items which deliver a
`SUMMARY-MOUSE` blip. They are **not** Dynamic Windows presentations. The source
contains a proposed presentation conversion only as commented text; a strict
System 452.1 / Zmail 442.0 implementation keeps the active blip dispatcher.

### Mouse gestures

| Gesture | Behavior |
| --- | --- |
| `Mouse-L` on a row | select that message; a summary-only layout changes to a message-displaying layout |
| `Mouse-M` on a row | apply the profile's summary-middle operation, defaulting to delete/undelete behavior |
| `Mouse-R` on a row | open the conditional summary menu |

### Right-button summary menu

The 13 conditional entries are Continue, Keywords, Delete, Undelete, Remove,
Reply, Move, Concatenate, Filter, Forward, Redistribute, Survey conversation,
and Select conversation. Continue appears only for a draft; Delete and Undelete
are mutually filtered; Remove is for a temporary sequence; Reply excludes drafts.

The profile's middle-button choices are Delete/Undelete,
Delete/Undelete/Remove, and every summary operation from Keywords onward. It
does not include the draft-only Continue entry.

### Mark Survey transient tree

`Mark Survey` leaves the ordinary summary dispatcher and enters a complete local
event loop. It first rejects a missing current sequence, clears all existing marks,
makes the Summary visible if necessary, selects the current message as its cursor,
and installs temporary mode-line and who-line text. Its input tree is:

| Input | Exact result |
| --- | --- |
| `Mouse-L` on a summary row | make the clicked row current and toggle its mark |
| `Mouse-M` on a summary row | translate to Abort |
| `Mouse-R` on a summary row | translate to End/commit |
| `Space` | toggle the current row |
| `C-M` | mark all messages |
| `C-Sh-M` | unmark all messages and force redisplay |
| `C-N` | move the cursor one row forward, clamped at the end |
| `C-Sh-N` | toggle current, then move one row forward |
| `C-P` | move the cursor one row backward, clamped at the beginning |
| `C-Sh-P` | toggle current, then move one row backward |
| `C-V`, `C-M-V` | scroll Summary one screen forward and move the cursor into the visible range if needed |
| `M-V`, `C-M-Sh-V` | scroll one screen backward and move the cursor into the visible range if needed |
| `Help` | print local Help; in Summary-only layout, consume one further event before continuing |
| `End` | commit the marked messages, in sequence order, to a recycled collection and return it |
| `Abort`, `C-]` | abort the current command |
| other atomic key | beep and stay in the loop |

`SELECT-WINDOW` and the five Dynamic Windows wakeups (`WINDOW-WAKEUP-SELECT`,
`-EXPOSE`, `-REFRESH`, `-REDISPLAY`, and `-VIEWPORT-POSITION-CHANGED`) are ignored.
Any other compound blip commits, requeues that blip, and returns. Commit with no
marks records an error; unwind still clears marks, current-mark state, temporary
documentation and typeout, restores the previous configuration, then reports the
error. The exact order matters: ignored compound events are tested before the
general compound-commit branch, while End shares that commit branch. This contract
comes from `zmail/filter.lisp.~1549~:295-468`.

## Compound-event dispatcher

The command-loop mixin owns this default opcode table
(`zmail/top.lisp.~1561~:224-275`):

| Opcode | Default action and result |
| --- | --- |
| `SUMMARY-EXECUTE`, `:TYPEOUT-EXECUTE`, `:EXECUTE` | apply the supplied function to its arguments; return its values |
| `REDISPLAY`, `CONFIGURATION-CHANGED` | consume and return `:REDISPLAY-PRESERVE-TYPEIN` |
| raw `:MOUSE-BUTTON` | if the target is typein or mode line, reselect the current editor window; in every case beep and return `DIS-NONE` |
| `:MENU`, `MODE-LINE`, `SUMMARY-MOUSE` | beep and return `DIS-NONE` |
| `SCROLL` | process the supplied window/count/type, redisplay that window, return `DIS-NONE` |
| `SELECT-WINDOW` | return `:REDISPLAY-PRESERVE-TYPEIN` only when it names the current window; otherwise `DIS-NONE` |
| `PRESENTATION-COMMAND` | clear typein, display the supplied command name in italic, bind the loop's mouse-gesture comtab, apply the command value, return `DIS-NONE` |
| `SI:INPUT-EDITOR` | barf that the supplied gesture is undefined in this context |
| five `DW::WINDOW-WAKEUP-*` opcodes | ignore and return `DIS-NONE` |
| `:EXECUTE-AS-COMMAND` | bind gesture comtab/current-command state, apply the function, pass its `(value, line, index)` values to `MUST-REDISPLAY`, return `DIS-NONE` |

The five ignored wakeups are Select, Expose, Refresh, Redisplay, and Viewport
Position Changed. Unknown opcodes remain subject to the command-loop unknown-special
condition/requeue protocol at `zmail/top.lisp.~1561~:206-211`; they are not silently
classified as one of the listed cases.

The main Zmail frame inherits that table but overrides these opcodes
(`zmail/top.lisp.~1561~:1136-1164`):

| Opcode | Main-frame override |
| --- | --- |
| `:MENU` | set command-button state from the blip and execute the item's command |
| raw `:MOUSE-BUTTON` | on typein/mode line, reselect current window and beep; elsewhere requeue the blip and enter `COMMAND-WITH-UNIVERSE-OR-FILTER` |
| `SUMMARY-MOUSE` | set command button from the row gesture and call the Summary dispatcher for that message |
| `MODE-LINE` | set the supplied button and execute the supplied command |
| `BACKGROUND` | execute the queued background response and return `DIS-NONE` |

These tables are a precedence rule: a main-frame override wins, then the default
table handles its remaining known opcodes. Filter, Universe, Profile, Mark Survey,
and minibuffer loops can add narrower handlers and must be enumerated in their own
contexts rather than assumed to share the main override.

## Window and task configurations

The user-visible configuration names registered by the source are:

- Summary only;
- Both summary and message;
- Message only;
- Filtering commands;
- Summary or Message toggle;
- Send;
- Message only;
- Calendar;
- Month;
- Four weeks;
- Week;
- Year.

Reply, Filter, Universe, and Profile are additional internal task layouts. The
initial ordinary configuration is Both; new integrated composition uses Send.
The two `Message only` rows above are intentionally identical visible labels:
one is the ordinary message layout and the other omits the command menu.

### Calendar configuration and Compose branches

Selecting a calendar configuration runs the following button-specific setup before
the frame changes and refreshes reminders afterward:

| Configuration | KBD | Mouse-L | Mouse-M | Mouse-R |
| --- | --- | --- | --- | --- |
| Year | prompt for `0..99` or `1900..2100`; the latter is canonicalized to the internal year | current year | next year | same prompt as KBD |
| Month | accept `MONTH`, defaulting to current month | current month | next month, carrying December into the next year | same acceptor as KBD |
| Four weeks | accept a starting date, defaulting to the aligned start of the current week | four weeks starting with current week | subtract 21 days so the four-week display ends with current week | same acceptor as KBD |
| Week | accept a starting date, defaulting to the aligned start of the current week | current week | next week | same acceptor as KBD |

Week alignment honors `*CALENDAR-MODE-WEEK-STARTS-ON-MONDAY*`. Calendar itself
does not run a date acceptor. The source order is setup, main configuration change,
post-setup (`zmail/window.lisp.~1538~:245-256`); exact date branches are
`zmail/calendar.lisp.~1522~:1404-1494`.

The Calendar menu's Compose cell is separately button-sensitive: KBD uses
`KBD-REMINDER-TEMPLATE`, left `LEFT-REMINDER-TEMPLATE`, middle
`MIDDLE-REMINDER-TEMPLATE`, and right or any other button chooses among templates of
command type `:REMINDER` (`zmail/calendar.lisp.~1522~:77-106`). Day, week, and month
presentations can also enter calendar behavior without passing through Configure;
their typed and translator contracts are inventoried below.

## Standalone Filter, Universe, and Profile task trees

Before an editor pane is entered, these frames share a deliberately tiny command
loop: `Refresh` redraws, `Control-R` enters the current editor, `Break` invokes
Zmail Break, `Abort` exits the task, and every other atomic key barfs. A left
Select presentation on a buffer point or editor blank also enters editing. Once
inside, all three clean flavors use Lisp major mode: Profile at
`zmail/definitions.lisp.~1552~:138-153`, Filter at
`zmail/filter.lisp.~1549~:1082-1093`, and Universe at
`zmail/universe.lisp.~1511~:71-82`. Their outer top-level-editor state names
`*STANDALONE-COMTAB*`; separately, noneditor mouse gestures use
`*ZMAIL-STANDALONE-COMTAB*`. The latter exists only to enter an editor and is
explicitly forbidden as an editor comtab or as another comtab's indirection target.
`ZMAIL-STANDALONE-EDIT` rebinds `*COMTAB*` to the actual `*MODE-COMTAB*` for the
duration of `:EDIT` (`zmail/top.lisp.~1561~:143-173`). The Filter editor additionally
copies only the extended-search `Control-H` child into Lisp mode. Profile or site
code can change modes later, but that is an overlay, not the clean default.

Stray menu, mode-line, or summary blips beep; an input-editor request barfs; the
named Dynamic Windows wakeup events are ignored. This sentinel table is never a
general editor parent.

### Filter task

The Filter task exposes Not, And, Or, Close, Sample, Done, Abort,
Documentation, Name, and keyword, user-filter, system-filter, header, and date
menus. Not/And/Or/Close insert or navigate the corresponding form. Done reads,
evaluates, and compiles the definition; Abort returns no filter. Documentation
inserts entered documentation. Sample uses the current sequence for left or
middle and asks for a universe on right. A summary click extracts and inserts
filter material; typeout- or summary-execute blips barf in this task. Name creates
a new name only on left; middle and right open the existing-filter menu. The pane
documentation says left or middle creates and right chooses, but executable
`READ-NEW-NAME` tests an exact left mouse character, and `CHAR-MOUSE-EQUAL` is
exact identity. Strict compatibility follows the executable branch.

### Universe task

The Universe task exposes Union, Intersection, Not, Close, Buffer, Collection,
Universe, Name, Done, and Abort. Buffer and collection choices insert their names;
universe choices insert the selected universe form. Union, Intersection, Not, and
Close modify the form independent of button identity. Name creates on left and
chooses an existing universe on middle or right; its pane documentation has the
same contradicted left/middle claim as Filter. Done reports an evaluation error
and remains in the task rather than falsely completing; Abort returns no universe.

### Profile task

Profile variable-choice presentations delegate the actual button to the TV
choose-variable-values pane, mark the profile changed, refresh dependent choices,
and update option documentation. Its fixed buttons have this exact policy:

| Button | Left or keyboard | Middle | Right |
| --- | --- | --- | --- |
| Filters | edit remembered filters | edit filter associations | menu: edit filter list; filter associations; edit existing filter |
| Universes | edit remembered universes | edit universe/filter associations | menu: edit universe list; filter associations; edit existing universe |
| Mail files | edit remembered mail files | edit mail-file/filter associations | menu of those two actions |
| Keywords | edit mail-file keywords | edit keyword/filter associations | menu of those two actions |
| Hardcopy | choose hardcopy options | same | same |
| File options | choose a mail file and edit its options | same | same |
| Exit | leave Profile | same | same |
| Reset | restore profile-file values, optionally reverting edited text | same | same |
| Defaults | restore system defaults | same | same |
| Edit | synchronize options, edit the profile text, then reread it | same | same |
| Save | insert changes, save, and possibly recompile | compile after reconciling unsaved state | menu: Insert changes; Save; Compile; Reap |

Random nonaccent clicks are ignored after cleanup; clicks on panes which cannot
accent beep. The pane/button graph, not the top-level Zmail key table, owns these
operations.

## Integrated Zmail draft-editor tables

### Shared address and header overlay

| Binding | Command |
| --- | --- |
| `H-F` | Forward Address |
| `H-B` | Backward Address |
| `H-K` | Kill Address |
| `H-Rubout` | Backward Kill Address |
| `H-T` | Exchange Addresses |
| `C-Sh-W` | Whois Address |
| `C-X A` | Add More Text |
| `C-X C` | Add Cc Field |
| `C-X S` | Add Subject Field |
| `C-X T` | Add To Field |

These tables inherit their ordinary editing behavior from the active Zwei mode.
The address command `Mark Address` is a source-defined draft command but has no
literal cell in this overlay. During setup the source copies these header cells
directly into the active mode and mode-`Control-X` tables
(`zmail/commands.lisp.~1600~:61-72`). They are therefore leaves of those mode tables,
not four leaves of the otherwise-empty message `Control-X` overlay. Effective
enumeration must continue through the exact D05 parents and retain the fact that the
mode tables were mutated.

### Editing an existing message

| Binding | Command |
| --- | --- |
| `End`, `C-Altmode` | generic Quit from message editing |
| `Abort` | Zmail Abort back to the top level |
| `Mouse-R` | the 22-item Editing Message menu |

The 22 menu and extended-command actions are Add To Field, Add Cc Field, Add
Bcc Field, Add Fcc Field, Add Bfcc Field, Add Subject Field, Add In Reply To
Field, Add References Field, Add More Text, Add From Field, Add File Reference
Field, Add Reply To Field, Add Start Date Field, Add Expiration Date Field, Set
Message Default Character Style, Show File, Hardcopy File, Edit File, Compile
File, Load File, Show Mailing List, and Whois.

The extended-command list adds `Show Expanded Mailing List`, for 23 entries.
The source intentionally omits that synonym from the right-button menu.
Editing an existing message always establishes Text mode before installing the
message comtab (`zmail/commands.lisp.~1600~:600-628`, especially lines 615-617).
The message table's absent direct cells inherit that active mode. Its own
`Control-X` overlay is empty and delegates directly to the active mode's
`Control-X` child (`commands:200-212`), where the copied `A`/`C`/`S`/`T` leaves
already reside.

### Reply and new-message editor

| Binding | Command |
| --- | --- |
| `End`, `C-End` | Mail End, whose action follows the configured ending policy |
| `C-Altmode` | Send Message immediately |
| `Abort`, `C-Z`, `C-]` | Abort Send |
| `Mouse-R` | the 34-item Reply menu |

The Reply `Control-X` table is:

| Binding | Command |
| --- | --- |
| `C-X 1` | Reply One Window |
| `C-X 2` | Reply Two Windows |
| `C-X 0` | Reply Zero Windows |
| `C-X M` | Recursive Mail |
| `C-X O` | Other Window |
| `C-X Y` | Prune Yanked Headers |
| `C-X C-R` | Restore Draft File |
| `C-X C-S` | Save Draft File |
| `C-X C-W` | Write Draft File |
| `C-X C-Y` | Yank Replied Messages |
| `C-X C-M-S` | Save Draft As Message |

The 34 right-button actions are the 14 header/text additions listed for Editing
Message; Set Default Character Style; Yank Replied Messages; Yank Current
Message; Prune Yanked Headers; Send Message; Abort Send; Restore Draft File;
Write Draft File; Save Draft File; Save Draft As Message; Change Subject
Pronouns; Encrypt Text; Decrypt Text; Show File; Hardcopy File; Edit File;
Compile File; Load File; Show Mailing List; and Whois.

The extended-command list again adds `Show Expanded Mailing List`, for 35. The
source deliberately includes Yank Replied Messages in both `Control-X` and the
menu/extended list so that it stays alongside Yank Current Message.
Integrated drafts choose their major mode through
`*DEFAULT-MAIL-BUFFER-MAJOR-MODE*`; the clean default is Text and the registered
choices are Text, Fundamental, and Lisp
(`zmail/definitions.lisp.~1552~:752-763,2031-2033`;
`zmail/mail.lisp.~1571~:1205-1237`). Absent reply direct cells inherit
that active mode, not the message direct table. An absent reply `Control-X` child
falls through the reply-local child, the empty message child, and then the active
mode child in that order (`zmail/commands.lisp.~1600~:211-227,251-263`).

### All 41 source-defined draft commands

The 41 `DEFCOM-FOR-ZMAIL` definitions, regardless of whether they are key,
menu, prefix, or extended-command entries in a particular draft state, are:

- address editing: Forward Address; Backward Address; Kill Address; Backward
  Kill Address; Exchange Addresses; Mark Address; Whois Address;
- lifecycle and navigation: Zmail Abort; Abort Send; Mail End; Send Message;
  Recursive Mail; Other Window;
- field and text insertion: Add To Field; Add Cc Field; Add Bcc Field; Add Fcc
  Field; Add Bfcc Field; Add Subject Field; Add From Field; Add Reply To Field;
  Add More Text; Add In Reply To Field; Add References Field; Add Start Date
  Field; Add Expiration Date Field; Add File Reference Field;
- reply and draft work: Change Subject Pronouns; Prune Yanked Headers; Yank
  Replied Messages; Yank Current Message; Reply One Window; Reply Zero Windows;
  Reply Two Windows; Restore Draft File; Save Draft File; Write Draft File; Save
  Draft As Message;
- style and encryption: Set Default Character Style; Encrypt Text; Decrypt Text.

## Zwei Mail mode in Zmacs

Zmacs `Control-X M` is `Mail` in the Zmacs prefix table. It creates or selects a
special Mail buffer, initializes Text mode, and turns on the Mail minor mode.
The local delta is small because ordinary editing comes from Text/Zmacs:

| Binding | Mail-mode command |
| --- | --- |
| `C-Altmode`, `End` | Exit Mail and transmit |
| `Abort`, `C-Z`, `C-]` | Quit Mail without transmitting |
| `M-Help` | Show Patch Mail Example |
| editor menu | Add File References |

Every other input follows Text mode, other active minor modes, Zmacs, and
Standard ZWEI in the D05 lookup order; a hard undefined cell in that chain stops
lookup. This inherited closure includes the ordinary Zmacs `Control-X` tree and
must not be replaced with Zmail's top-level `Control-X` table.

The mode line dynamically displays the active End and Abort characters. Its
paragraph rules treat the body-separator line as a delimiter so filling commands
do not merge headers with message text.

The `Mail` command's numeric argument has three source-defined cases:

| Invocation | Source behavior |
| --- | --- |
| no numeric argument | create and initialize a Mail buffer |
| nonzero numeric argument | request the most recently selected Mail buffer without reinitializing it |
| zero numeric argument | list existing Mail and bug-mail-frame drafts as selectable buffer presentations |

The source also defines `Add File References`, `Quit Mail`, and `Exit Mail` as
the four Mail-specific commands alongside `Mail` itself. The observed `Control-]`
quit path returned to Fundamental mode and advertised numeric-argument resume;
the later XTEST prefix probe did not unambiguously verify actual reselection, so
that one behavior remains source-established rather than runtime-confirmed.

## Accepted presentation-type contracts

The translator list below is only half of typed interaction. These are the
application-owned object types which Zmail itself accepts or presents; parser,
completion, printer, default, and failure behavior are normative where the source
defines them.

| Presentation type | Parse/completion and default contract | Printed/presented form and boundary |
| --- | --- | --- |
| `SEQUENCE` | complete over live `*SEQUENCE-LIST*`; restrict candidates to buffers or collections when the requested subtype requires it; callers such as Select supply the previously selected sequence as default | buffers use their pathname's editor string; collections use sequence name; no arbitrary-name fallback |
| `UNLOADED-MAIL-FILE` | recompute unloaded-file suggestions through `GET-SEQUENCE-ALISTS T`; completion returns the stored pathname | pathname editor string; only known unloaded files are suggested |
| `SEQUENCE-OR-UNLOADED-MAIL-FILE` | accept the explicit union, forwarding the caller's optional sequence flavor, default, and “initially display possibilities” flag | dispatch printing by runtime type to `SEQUENCE` or `UNLOADED-MAIL-FILE`; a pathname result is loaded by the calling command |
| `POINT-PDL-ELEMENT` | no application parser or completion; created as a presented history row | print message number plus sequence; Select moves to the saved message/sequence/start position |
| `MSG-LINE` | no application parser or completion; output associates a text line with a message | print as the message containing that line; Select searches current sequence and barfs if the line is no longer found |
| `HEADER-NAME` | complete over the current header-type registry but allow arbitrary input; a noncompleted token is uppercased and interned as a keyword | registered entries use their pretty name when present and otherwise an invalid-header placeholder; values outside the registry use capitalized keyword spelling |
| `MINI-BUFFER-STRING` | ordinary String expansion; no Zmail-specific completion or default | Select inserts the string into the Filter editor |
| `RECIPIENT-FIELD`, `SENDER-FIELD`, `SENDER-OR-RECIPIENT-FIELD`, `SUBJECT-FIELD` | ordinary String expansions; no Zmail-specific parser/default | typed wrappers distinguish predicate translators and gestures; they are not interchangeable solely because all contain strings |
| `ADDRESS` | read one standard token and pass it to the mail-address parser; parse failures become presentation parse errors; presentation history is enabled | require a cons whose first property is `:USER`, `:NAME`, `:PERSONAL-NAME`, `:HOST`, `:HOST-DEFAULTED`, `:INFERIORS`, `:INITIAL-STRING`, `:FINAL-STRING`, `:ORIGINAL-STRING`, `:INTERVAL`, or `:ORIGINAL-INTERVAL`; print through the requested address format, default Short |
| `BASIC-DRAFT-MSG` | accept `unsent`, `sent`, or a decimal row number spanning live then dummy draft lists; the `SENT` parameter admits only matching draft states; invalid or disallowed input is a parse error | print index plus draft summary; Select is applicable only to live drafts, while the no-gesture operation candidate Revoke requires sent state |
| `TEMPLATE` | complete only templates which advertise the requested command type; menu data is cached against the template-list identity and sorted by menu font then name | print template menu name; default selection is call-site behavior: a non-null supplied default wins for KBD/left, otherwise KBD accepts the typed completion, and pointer paths use the cached menu/last item |
| `MSG` | no application parser or completion; messages are presented by surveys/typeout | print number in current sequence, else number in owning buffer, else expunged-message text; Select rejects killed messages, while the no-gesture operation candidate selects its conversation |
| `REMINDER-DATE-TIME` | parse one token through universal-time syntax and preserve whether a time was explicitly supplied; no Zmail completion/default | represent the value as one nested `(time, time-specified)` pair; print date plus optional time, or `never` for null |
| `WEEK-CONTAINING-DAY` | parse one date token; no call-site default in its parser | present a day-bearing object and print the aligned containing week; Select switches to Week |
| `DAY` | parse one date token into day/month/year; no Zmail completion/default | print canonical date; convert to universal time or reminder-date-time; Select surveys reminders, Describe adds one, and a no-gesture candidate sets current-message start date when applicable |
| `MONTH` | if text is present, parse it by prefixing day 1; otherwise use a list or universal-time default; empty input without a default is a parse error | print month and canonical year; Select switches to Month |

Source anchors are `zmail/collections.lisp.~1552~:60-132,1403-1506`;
`zmail/filter.lisp.~1549~:1420-1449,1544-1551,1694-1784`;
`zmail/headers.lisp.~1534~:1505-1527`; `zmail/mail.lisp.~1571~:783-833`;
`zmail/template.lisp.~1525~:203-298`; `zmail/universe.lisp.~1511~:1284-1317`;
and `zmail/calendar.lisp.~1522~:241-274,731-765,928-974,1362-1402`.
Inherited types such as pathname and universal time retain their owning subsystem's
parser; this table does not redefine them as Zmail types.

## Dynamic Windows and Command Processor translator tree

Zmail uses selected Dynamic Windows/Command Processor presentation services,
although the surrounding reader remains a ZWEI/TV application and its summary
rows remain TV blips. In the gesture column, **`NIL` means no specific gesture**:
the translator contributes an operation-menu candidate. It does not mean Select.
Applicability tests can suppress a candidate.

| Presentation | Gesture | Context and result |
| --- | --- | --- |
| buffer point or editor blank | Select | enter standalone editing; the message-edit variant additionally requires the current pane or node |
| minibuffer command | Select | reexecute that command |
| pathname | `NIL` | offer Show File in the Zmail operation menu |
| pathname | Edit Definition | edit the file in top-level Zmail, Reply, or message-edit context |
| expression | Edit Function | edit the corresponding definition at top-level Zmail when conversion succeeds |
| address | Select | expand/show the mailing list |
| address | `NIL` | offer all-level mailing-list expansion; the Standard-editor variant is suppressed while the minibuffer owns input |
| sequence | Select | select the sequence |
| sequence | `NIL` | offer Kill Sequence and Expunge Sequence as separate operation-menu candidates |
| saved point | Select | move to the saved message point |
| message line | Select | select the message containing that line |
| pathname | Select | edit or create that mail file |
| pathname | Select and Activate | examine that mail file with saving disabled |
| message buffer | `NIL` | offer Save Mail File |
| message | Select | select its buffer and message; killed messages are inapplicable |
| message | `NIL` | offer selection of the containing conversation |
| live draft | Select | continue the draft |
| sent draft | `NIL` | offer Revoke Draft |
| week containing day | Select | switch to the Week configuration |
| day | Select | show reminders for that day |
| day | Describe | add a reminder; this is the source's compatibility gesture |
| day | `NIL` | offer setting the current message's start date, only when a current message exists |
| month | Select | switch to the Month configuration |
| minibuffer string | Select | insert the string into the Filter editor |
| recipient field | Select | insert a recipient predicate |
| recipient field | Select and Activate | insert a combined sender-or-recipient predicate |
| sender field | Select | insert a sender predicate |
| sender field | Select and Activate | insert a combined sender-or-recipient predicate |
| sender-or-recipient field | Select | insert a combined predicate |
| subject field | Select | insert a subject substring-search predicate |
| subject field | Select and Activate | insert an exact-subject predicate |

Header, address, pathname, and subject presentation nodes are generated on
demand. Header parse failure may suppress them, and merging a file recipient
suppresses namespace lookup. Address/path/user-host converters and the Command
Processor address-command translators are part of this graph; conversion failure
is distinct from command inapplicability. These typed translators are Dynamic
Windows/Command Processor behavior, not evidence that Zmail uses CLIM.

### Exhaustive effective-tree qualification

A Genera 8.5 implementation conforming to this companion must produce an
effective-tree record for every requirement below, not merely demonstrate a few
representative commands:

1. enumerate every finite character/modifier cell of the top reader, expand all
   four ten-digit ranges, recursively descend Zmail `Control-X`, and distinguish
   absent, hard-undefined, prefix, nonfunction symbol, and callable leaves;
2. enumerate the D05 parent chain separately for existing-message direct and
   `Control-X` input, integrated-draft direct and `Control-X` input, and Zmacs Mail
   mode. Preserve the copied header leaves in the active mode tables and reject a
   graph which inserts the message direct table into the reply direct path;
3. compare the normal, calendar, and filtering command panes as ordered geometry,
   then invoke all 20 normal commands with KBD, left, middle, and right under
   fixtures where each remembered/profile default is present and absent. Compare
   every fixed list and Cartesian product in order;
4. construct dynamic fixtures with zero, one, and multiple buffers, unloaded files,
   collections, drafts, keywords, filters, templates, macros, and appended Other
   commands. Compare category order, separators, selectable state, button-valued
   leaves, cancellation, and remembered-state changes. For Save, compare the
   visible column order `Expunge, UnModify, Save, Kill` independently from the
   execution phase order `Expunge, UnModify, Save, Kill`, including the
   Kill-without-Save expunge suppression and Save/Kill exclusion of UnModify;
5. enumerate all 42 Reply products in recipient-major, display/yank-middle, and
   prune-minor order, then test KBD/left/middle/right defaults and the numeric
   `1`, `3`, `4`, and rejecting-other precedence before button selection;
6. drive Mark Survey with every listed atomic key, all three summary buttons, every
   ignored compound opcode, an unknown atomic key, an unknown compound blip, zero
   marks, and multiple marks. Verify clamp, toggle, scroll, Help's extra event,
   commit/requeue, abort, cleanup, and error ordering;
7. drive every parent special opcode and every main-frame override with valid and
   invalid operands. Record override-before-parent precedence, return redisplay
   degree, typein clearing, command-button state, consume/requeue behavior, and the
   unknown-special condition path rather than treating unknown opcodes as beeps;
8. exercise Calendar configuration through KBD, left, middle, and right at year,
   December, aligned-week, and Monday/Sunday-boundary fixtures. Exercise Compose
   with all four reminder-template defaults and a missing/defaultless template list;
9. for every application-owned presentation type above, test accepted and rejected
   syntax, completion candidate ordering and filtering, supplied/empty/no-default
   behavior, printer output class, conversions, and parameterized subtype/state
   restrictions. Then enumerate every translator with its named gesture and with
   applicability true and false; distinguish conversion failure from
   inapplicability and from parse failure;
10. enumerate standalone Filter, Universe, and Profile before editing and after
    entry into clean Lisp mode, proving that `*ZMAIL-STANDALONE-COMTAB*` is not an
    editor parent. Enumerate existing-message Text mode, each registered draft mode,
    and separate Zmacs Mail mode through their complete D05 parents;
11. run Zmail Help for every direct and reachable prefix leaf, `*`, Map Over, and
    Other. After each report, inject Space, an ordinary key, a command-menu blip,
    and an unrelated compound event, recording exact dismissal or forwarding and
    effective context; this is the runtime oracle for the source-visible
    post-report prompt;
12. run the top reader with `NIL`, `:SIGN`, `:DIGITS`, `:CONTROL-U`, and
    `:INFINITY`, retaining tag and integer separately. Run inherited editors only
    with their first four reachable tags and prove that menu, summary, calendar,
    presentation, typeout, and utility loops do not invent numeric variants; and
13. exercise both minibuffer-repeat wrappers with no argument, zero, positive one,
    positive *N*, matching and nonmatching substrings, negative, out-of-range, and
    `:INFINITY` inputs. Verify history selection and listing separately from the
    replayed command's own effects, and classify the final three cases against D05
    rather than assigning a Zmail-local behavior.

Each record must include release profile, frame, pane, editor mode, task state,
input path, button, numeric tag and integer, ordered parent/handler path,
applicability state, selected and shadowed leaves, state changes, redisplay degree,
Help result, parser/completion/default result, failure or abort, event consumption
or requeue, and clean-source versus patch/site/profile/user origin. The required
contexts are top-level reader, command pane, summary, message editing, integrated
draft header and body, separate Zmacs Mail mode, Filter, Universe, Profile,
calendar, typeout, minibuffer, and presentation-command dispatch. Passing only the
152 completion-name count or the local-cell count does not satisfy this requirement.

These tables are the complete clean selected-source denominator for the
application-owned layers. They are not a claim that the licensed runtime world or
a patched site's effective graph is identical before that enumeration runs.

## All 152 top-level completion candidates

Names below are the humanized values generated by Zmail's command-name
constructor. It removes internal `COM`/`ZMAIL` prefixes, expands Message and
Messages abbreviations, replaces hyphens with spaces, and capitalizes words.
`Set Key` was manually recovered across its embedded font-change escape.

- **A–B:** Abort Background Save; Add File References; Add Message References;
  Append Conversation By References; Append To Referenced Message; Apropos;
  Break; Bug.
- **C–D:** Change Mail File Options; Check For New Mail; Compile File; Compose
  Reminder; Concatenate; Concatenate All; Configure; Construct Digest; Continue;
  Decode Eco; Decrypt Message; Delete; Delete All; Delete And Save Message;
  Delete And Up; Delete Conversation By References; Delete Duplicate Messages;
  Delete Referenced Messages; Describe Command; Disable Background Process When
  Deexposed; Disable Saves For Buffer; Down To Next.
- **E–H:** Edit Current Message; Edit File; Edit Keywords List; Edit Mail File;
  Enable Background Process When Deexposed; Enable Saves For Buffer; Encrypt
  Message; End Of Message; End Of Summary Window; Examine Mail File; Explain Bad
  Header; Expunge Sequence; Extended Command; Find String; Forward; Forward All;
  Get New Mail From Inbox; Gmsgs; Goto; Hardcopy All; Hardcopy File; Hardcopy
  Message; Help.
- **J–M:** Jump; Keywords; Keywords All; Kill Current Sequence; Kill Ring Save
  Message; Kill Ring Yank Message; Kill Sequence; Large Argument; List Sequences;
  Load File; Mail; Mail Eco; Make Encoded Eco File; Map Over; Mark Survey; Merge
  Keywords In Conversation; Mouse Point Pdl; Move; Move All To File; Move In Place
  Of Referenced Message; Move To Default Previous Point; Move To Previous Point.
- **N–R:** Next; Next Unseen; Not Modified; Occur; Other Commands; Previous;
  Previous Unseen; Profile; Quit; Recenter Message Or Summary Window; Redirect
  Message; Redistribute All; Redistribute Message; Redo; Reformat All; Reformat
  Headers; Refresh; Remove; Rename Sequence; Reparse All Loaded Messages; Repeat
  Last Matching Mini Buffer Command; Repeat Last Mini Buffer Command; Replay
  Keyboard Macro; Reply; Reply All; Report Bug; Reverse Sequence; Revoke Message;
  Run Rules All; Run Rules Message.
- **S:** Save All Mail Files; Save Current Buffer; Save Mail File; Scroll Message
  Next Screen; Scroll Message Previous Screen; Scroll Summary Window; Scroll
  Summary Window Backward; Select; Select All Conversations By References; Select
  Arbitrary Format Mail File; Select Conversation By References; Select Previous
  Sequence; Select Referenced Message; Select References; Select Sequence; Self
  Document; Set Expiration Date; Set Key; Set Message Default Character Style;
  Set Pop Mark; Set Start Date; Show Draft Dispositions; Show Expanded Mailing
  List; Show File; Show Mail; Show Mailing List; Show Printer Status; Show Received
  Path; Sort; Source Compare Referenced Message; Start Background Save; Start Of
  Message; Start Of Summary Window; Survey; Survey Reminders.
- **T–Y:** Type; Type All; Undelete; Undelete All; Undigestify; Undigestify All
  Messages; Undo; Unkeywords All; Unreformat All; Up To Previous; Whois; Yank
  Message.

Two internal synonym functions, Save and Expunge, copy the command names and
documentation of Save All Mail Files and Expunge Sequence. They do not add two
new completion names and are therefore not counted as 154.

## Source-visible subtleties

- The menu label Jump and keyboard `J` invoke different commands, Goto and Jump.
- `Show Expanded Mailing List` is deliberately extended-command-only in both
  integrated message and reply editing.
- Zmail's `Control-X M` and Zmacs's `Control-X M` share a spelling but enter
  different recursive contexts.
- The address overlay has Hyper commands that do not appear in an ordinary
  Emacs-style summary of Mail mode.
- `Mail End` is policy-driven; treating End as an unconditional Send key loses
  profile-defined behavior.
- Summary Mouse-M is profile-driven and can include temporary-sequence Remove;
  it is not a universal Delete toggle.
- Command names are installed into mutable registries. Literal source counts
  are a release denominator, not a claim about a patched or site-customized live
  system.

## Sources

- Symbolics, [*Editing and Mail*, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  printed pages 2426–2499 and the command dictionary; verified 2026-07-18.
- Licensed local Genera 8.5 `zmail/definitions`, `zmail/commands`,
  `zmail/window`, `zmail/top`, `zmail/collections`, `zmail/filter`, `zmail/mail`,
  `zmail/mail-files`, `zmail/universe`, `zmail/profile`, `zmail/calendar`,
  `zmail/template`, `zmail/headers`, `zmail/references`, `zmail/kbin/buffer`,
  `zwei/mail`, `zwei/coma`, `zwei/comtab`, and mouse-character support source,
  identities in
  [the application study](zmail.md#evidence-and-rights-boundary); inspected
  2026-07-19.
- Ignored non-evaluating source-Help extraction and fresh
  `zmail-d08-genera-20260718` runtime evidence, counts and provenance in the
  [application study](zmail.md#runtime-observations-in-genera-85); verified
  2026-07-18.

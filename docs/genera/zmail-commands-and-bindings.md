---
type: Reference
title: Genera 8.5 Zmail commands and bindings
description: Evidence-only inventory of Zmail top-level keys, prefixes, menus, summary gestures, draft-editor commands, and Zwei Mail-mode bindings in the inspected Genera 8.5 release.
tags: [genera, zmail, mail, zwei, keybindings, commands, reference]
timestamp: 2026-07-18T06:16:06-04:00
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
cross-checks, runtime observations, and rights handling.

## Scope and notation

- `C-`, `M-`, and `H-` mean Control, Meta, and Hyper. `Sh-` means Shift where
  case matters.
- `Mouse-L`, `Mouse-M`, and `Mouse-R` are the left, middle, and right buttons.
- Named Genera characters such as `Abort`, `Altmode`, `Back-Scroll`, `Break`,
  `End`, `Find`, `Help`, `Home`, `Redo`, `Refresh`, `Resume`, `Scroll`, and
  `Undo` are not guesses about PC keyboard labels.
- “Direct” means a literal entry in the Zmail table. Mode inheritance, Dynamic
  Windows presentations, patches, profile choices, site files, and user-installed
  keys can add or shadow behavior.
- The core source contains 150 direct top-level command definitions. KBIN adds
  `Reparse All Loaded Messages`; Zmail adopts generic `Show Printer Status`.
  The 152-name list below is the clean declared release closure, not a live-site
  dump.
- The source also defines 41 Zmail draft-editor commands. They are distributed
  across address editing, message editing, reply composition, and draft handling;
  they are not all direct keys in one table.

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
draft afterward.

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

### Reply-choice dimensions

The reply chooser is a generated cross product rather than a short flat list:

- recipient policy: All, All-Cc, Cc-All, To, To-Cc, Cc-To, or Sender;
- display/yank policy: Two-windows, One-window, or Yank;
- header policy: Prune or Don't prune.

That gives 42 combinations before profile defaults. The draft-ending policy is
separate and can offer Send, both sending choices, Add text, or both text choices.

## Summary presentations

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

## Window and task configurations

The user-visible configuration names registered by the source are:

- Summary only;
- Both summary and message;
- Message only;
- Filtering commands;
- Summary or Message toggle;
- Send;
- Message only without the command menu;
- Calendar;
- Month;
- Four weeks;
- Week;
- Year.

Reply, Filter, Universe, and Profile are additional internal task layouts. The
initial ordinary configuration is Both; new integrated composition uses Send.

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
literal cell in this overlay.

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
  `zmail/collections`, `zmail/filter`, `zmail/mail`, `zmail/mail-files`,
  `zmail/references`, `zmail/kbin/buffer`, and `zwei/mail` source, identities in
  [the application study](zmail.md#evidence-and-rights-boundary); inspected
  2026-07-18.
- Ignored non-evaluating source-Help extraction and fresh
  `zmail-d08-genera-20260718` runtime evidence, counts and provenance in the
  [application study](zmail.md#runtime-observations-in-genera-85); verified
  2026-07-18.

---
type: Artifact Analysis
title: ZMail command and keybinding inventory for the maintained LM-3 tree
description: Complete static inventory of ZMail's top-level, message-editing, reply, address-field, mouse, menu, and named-command surfaces in the pinned System 303 source.
tags: [mit-cadr, lm-3, zmail, mail, keybindings, commands]
timestamp: 2026-07-18T04:03:04-04:00
---

# ZMail command and keybinding inventory for the maintained LM-3 tree

This page records the command environment constructed by the active ZMail source at
LM-3 System check-in `4df393c`. It is a static source inventory, not a claim that the
tested `303-0` world had loaded ZMail or that a user's profile and patches left every
binding unchanged. The [application study](zmail.md) explains the architecture,
features, release boundary, and failed runtime load attempt.

## How command lookup is composed

ZMail does not use one flat keymap. `INITIALIZE-ZMAIL-COMTABS` constructs related
tables and explicit indirections:

1. the top-level ZMail table handles mail-reading commands;
2. the message-editing table delegates unhandled input to the selected ZWEI mode;
3. its `Control-X` table delegates to ZWEI's standard `Control-X` table;
4. the reply table adds send/abort/yank operations and delegates to the message table;
5. the reply `Control-X` table adds window and draft operations, then delegates to the
   message `Control-X` table;
6. a right-click in reply composition opens a menu over the principal header, draft,
   send, and abort commands.

The effective composition editor therefore inherits ordinary ZWEI editing and mode
behavior. The bindings below are ZMail's additions and overrides; they should be read
alongside the [ZWEI/Zmacs binding audit](zwei-zmacs-keybindings.md), not as a complete
keyboard for inserting and editing text.

## Top-level mail-reading table

### Direct message and application commands

| Key | Command | Effect |
| --- | --- | --- |
| `C-D` | Delete and Up | delete current message and move in the source-defined upward direction |
| `C-F` | Find String | search message text forward |
| `C-G` | Beep | cancel/error feedback through the shared ZWEI command |
| `C-L` | Recenter Window | recenter the active display |
| `C-N` | Down to Next | move to the next displayed message |
| `C-P` | Up to Previous | move to the previous displayed message |
| `C-R` | Edit Current Msg | edit the selected message |
| `C-U` | Universal Argument | start a numeric argument |
| `C-V` | Next Screen | scroll the current message forward |
| `C-Z` | Quit | invoke the inherited generic quit command from the ZMail table |
| `C-Space` | Set Pop Mark | push the current message position |
| `M-V` | Previous Screen | scroll backward |
| `M-X` | Extended Command | complete and invoke a named ZMail command |
| `M-?` | Self Document | use ZWEI line self-help with the ZMail table |
| `M-~` | Not Modified | clear the current buffer's modified state through the ZMail command |
| `M-<` | Start of Msg | move to the start of the message |
| `M->` | End of Msg | move to the end of the message |
| `C-M-V` | Scroll Summary Window | scroll the summary independently of the message |
| `C-M-Space` | Move to Previous Point | pop a saved message position |
| `.` | Start of Msg | printable alias for message start |
| `?` | Documentation | enter ZMail's key/help dispatcher |
| `C` | Continue | resume a saved draft |
| `D` | Delete | mark current message deleted |
| `E` | Expunge | rewrite affected mail files without deleted messages |
| `F` | Forward | begin forwarding the current message |
| `G` | Get New Mail | retrieve new mail into the primary buffer |
| `J` | Jump | select a message using jump/filter interaction |
| `L` | Keywords | edit keywords on the current message |
| `M` | Mail | begin a mail, bug, forward, redistribute, or local-message operation |
| `N` | Next | select the next message according to current policy |
| `O` | Move | file/move the current message |
| `P` | Previous | select the previous message |
| `Q` | Quit | quit ZMail |
| `R` | Reply | begin a reply |
| `S` | Save | save changed mail files |
| `U` | Undelete | remove the deleted mark |
| `X` | Extended Command | printable alias for named-command completion |
| `Z` | Large Argument | ZMail-specific large numeric argument |
| `Break` | Break | enter the ZMail break/debug path |
| `Backspace` | Previous Screen | scroll backward |
| `Rubout` | Previous Screen | scroll backward |
| `Hand-Down` | Next Screen | scroll forward |
| `Hand-Up` | Previous Screen | scroll backward |
| `Help` | Documentation | enter ZMail help |
| `Form` | Refresh | refresh the ZMail display |
| `Resume` | Continue | resume a draft |
| `Space` | Next Screen | scroll forward |

`N` and `P` are not simple array increments in every case. Profile/menu choices can
select unseen or undeleted messages and first/last variants. The table binds the
entry commands; those commands interpret the current policy.

### Numeric arguments

| Keys | Command |
| --- | --- |
| `-`, `C--`, `M--`, `C-M--` | negate numeric argument |
| `0` through `9` | enter a digit |
| `C-0` through `C-9` | enter a digit |
| `M-0` through `M-9` | enter a digit |
| `C-M-0` through `C-M-9` | enter a digit |

The four ten-key ranges are generated by range entries in `SET-COMTAB`; they are 40
effective bindings, not four literal keys.

## Address-field editing additions

The mode table supplied to ZMail gains five Hyper bindings for editing structured
address lists:

| Key | Command |
| --- | --- |
| `Hyper-F` | Forward Address |
| `Hyper-B` | Backward Address |
| `Hyper-K` | Kill Address |
| `Hyper-Rubout` | Backward Kill Address |
| `Hyper-T` | Exchange Addresses |

These commands operate at address boundaries rather than ordinary word boundaries,
which reflects ZMail's structured treatment of recipient headers.

## Message-editing and composition tables

### General message editing

| Key | Command | Delegation |
| --- | --- | --- |
| `End` | Quit ZMail Edit | ZMail override |
| `C-Escape` | Quit ZMail Edit | ZMail override |
| `Abort` | Quit ZMail Edit | ZMail override |
| all other applicable keys | current mode/ZWEI command | through table indirection |

The message `Control-X` prefix adds:

| Key | Command |
| --- | --- |
| `C-X A` | Add More Text |
| `C-X C` | Add Cc Field |
| `C-X S` | Add Subject Field |
| `C-X T` | Add To Field |

Unrecognized `Control-X` keys continue into ZWEI's standard prefix table.

### Reply/draft composition

| Key | Command | Effect |
| --- | --- | --- |
| `End` | Mail End | finish according to the current draft/send state |
| `C-Escape` | Send Message | send the draft |
| `C-M-Y` | ZMail Yank | insert the referenced/current message into the draft |
| `Abort` | Abort Send | abandon with the ordinary confirmation path |
| `Super-Abort` | Really Abort Send | force the stronger abort path |
| `C-]` | Abort Send | keyboard alias for aborting composition |

The reply `Control-X` table adds:

| Key | Command |
| --- | --- |
| `C-X 1` | Reply One Window |
| `C-X 2` | Reply Two Windows |
| `C-X 3` | Reply Three Windows |
| `C-X M` | Recursive Mail |
| `C-X O` | Other Window |
| `C-X Y` | Prune Yanked Headers |
| `C-X C-R` | Restore Draft File |
| `C-X C-S` | Save Draft File |
| `C-X C-W` | Write Draft File |
| `C-X C-M-S` | Save Draft as Msg |

It then inherits the message additions and standard ZWEI `Control-X` commands. The
right-button composition menu exposes header insertion, pruning, send/abort, draft
save/restore, and subject-pronoun transformation without requiring their key names.

## Main command menus

The ordinary source-defined command menu has these 20 labels in order:

| Row | Labels |
| ---: | --- |
| 1 | Profile; Quit; Delete; Undelete; Reply |
| 2 | Configure; Save Files; Next; Previous; Continue |
| 3 | Survey; Get New Mail; Jump; Keywords; Mail |
| 4 | Sort; Map Over; Move; Select; Other |

The experimental filter-oriented layout separates commands which do not require a
message filter—Configure, Get New Mail, Save Files, Sort, Profile, and Quit—from the
filter-aware menu: Concatenate, Survey, Delete, Undelete, Reply, Other, Type, Next,
Previous, Continue, Select, Keywords, Move, and Mail.

`Map Over` offers this complete source-defined bulk-command list:

| Delete | Undelete | Type | Find String | Keywords | Unkeywords |
| --- | --- | --- | --- | --- | --- |
| Move | Forward | Redistribute | Reply | Concatenate | |

The Mail menu offers Bug, Mail, Forward, Redistribute, and Local. The last creates a
new message in the current buffer for editing instead of sending it through a network
transport.

## Summary-pane mouse behavior

Summary lines are mouse-sensitive message objects.

| Gesture | Source behavior |
| --- | --- |
| Left click | select the message; if necessary leave summary-only layout so its body can be shown |
| Middle click | perform the profile-selected middle action; the default is delete-or-undelete |
| Right click | open the summary-message menu |

The right-button menu can Continue, edit Keywords, Delete, Undelete, Remove from a
temporary buffer, Reply, Move, Append relative to another message, or construct a
Filter from the message. Its exact enabled entries depend on whether the current
buffer is disk-backed and on message state.

Menu buttons also distinguish left, middle, and right actions. Consequently, a label
such as Reply or Move can have a quick default action and a right-button option menu;
the visible label alone is not a complete interaction specification.

## Complete named top-level command inventory

The active 18-path system defines 86 distinct commands through
`DEFINE-ZMAIL-TOP-LEVEL-COMMAND`. Macro names become human-readable completion names
by removing `COM-` or `COM-ZMAIL-`, replacing hyphens with spaces, and capitalizing
words. The following grouping is editorial; the denominator and names are exact.

### Navigation, display, and help

`Apropos`; `Break`; `Configure`; `Documentation`; `Down to Next`; `End of Msg`;
`Extended Command`; `Find String`; `Help`; `Mode Line Scroll`; `Mouse Point PDL`;
`Move to Default Previous Point`; `Move to Previous Point`; `Next`; `Previous`;
`Refresh`; `Replay Keyboard Macro`; `Scroll Summary Window`; `Self Document`; `Set
Pop Mark`; `Start of Msg`; `Up to Previous`.

### Message lifecycle and filing

`Delete`; `Delete All`; `Delete and Save Msg`; `Delete and Up`; `Delete Duplicate
Msgs`; `Expunge`; `Get New Mail`; `Kill Current Buffer`; `Kill Ring Save Msg`; `List
Buffers`; `Move`; `Move All to File`; `Not Modified`; `Remove`; `Rename Buffer`;
`Save`; `Select`; `Select Arbitrary Format Mail File`; `Set Expiration Date`;
`Undelete`; `Undelete All`; `Undigestify Message`; `View File`.

### Composition, reply, and transport-facing commands

`Bug`; `Continue`; `Edit Current Msg`; `Forward`; `Forward All`; `Mail`;
`Redistribute All`; `Redistribute Msg`; `Reply`; `Reply All`; `Yank Msg`.

### Classification, search, and bulk operations

`Goto`; `Jump`; `Keywords`; `Keywords All`; `Large Argument`; `Map`; `Occur`;
`Other Commands`; `Profile`; `Select References`; `Sort`; `Survey`; `Type`; `Type
All`; `Unkeywords All`.

### Reference and conversation operations

`Append to Referenced Msg`; `Concatenate`; `Concatenate All`; `Delete Conversation by
References`; `Delete Referenced Msgs`; `Move in Place of Referenced Msg`; `Select
Conversation by References`; `Select Referenced Msg`.

### Output, integration, and session control

`Enable Background Process When Deexposed`; `Gmsgs`; `Hardcopy All`; `Hardcopy Msg`;
`Quit`; `View Original Header`; `Whois`.

The groups account for all 86 definitions. Some named commands call shared ZWEI
commands or open secondary menus; some direct bindings such as scrolling use generic
ZWEI commands and therefore do not appear in this ZMail-macro denominator.

## Source/runtime boundary

The bindings are established by source inspection of
[`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp)
and the menu/default definitions in `zmail/defs.lisp`. They have not been enumerated
from a live ZMail frame. The fresh System `303-0` session described in the
[application article](zmail.md#runtime-observation-advertised-but-not-resident)
proved that the static System Menu advertised Mail while `ZWEI:ZMAIL-FRAME` was not
loaded. Loading the source was blocked by the unsited world's file-host configuration.

**Runtime TODO:** after a disposable local file host is configured, evaluate the live
command-table indirections and completion alist, compare them with this static list,
exercise Help and the three mouse buttons in a synthetic empty mailbox, and retain
capture-specific provenance for any reviewed screenshots.

## Sources

- LM-3 System 303
  [`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp),
  command-table construction and top-level commands.
- LM-3 System 303
  [`zmail/defs.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fdefs.lisp),
  menus, options, and layout names.
- Richard Stallman,
  [*ZMail Manual*, first edition](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmanual%2Fmanual.text),
  April 1983, used as version-qualified intended-behavior evidence.

Last verified: 2026-07-18.

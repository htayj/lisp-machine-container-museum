---
type: Artifact Analysis
title: ZMail command and keybinding inventory for the maintained LM-3 tree
description: Release-bounded static inventory of System 303 ZMail's local key, menu, pointer, named-command, and transient-task surfaces and their inherited-tree boundary.
tags: [mit-cadr, lm-3, zmail, mail, keybindings, commands]
timestamp: 2026-07-19T18:44:32-04:00
---

# ZMail command and keybinding inventory for the maintained LM-3 tree

This page records the command environment constructed by the active ZMail source at
LM-3 System check-in `4df393c`. It is a static source inventory, not a claim that the
tested `303-0` world had loaded ZMail or that a user's profile and patches left every
binding unchanged. The [application study](zmail.md) explains the architecture,
features, release boundary, and failed runtime load attempt. The normative
multi-profile contract is the
[ZMail and mail-composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md).

“Complete” on this page means complete for the application-owned mappings and
transient contexts found in the selected maintained System 303 source. A complete
*effective* keyboard requires this page together with D08's context, numeric,
applicability, Help, and unbound rules and D05's
[System 303 ZWEI/Zmacs parent tables](zwei-zmacs-keybindings.md#application-and-task-mode-tables-in-system-303).
The public System 46 composer is a different profile whose sparse local tree is
specified in D08; the tested System `303-0` band did not have the System 303 reader
resident. Neither is merged into this denominator.

When D08 incorporates this page, `MUST`, `MUST NOT`, `SHOULD`, and `MAY` state
normative requirements for the selected maintained-source profile. Static source
closure remains distinct from the unavailable loaded-band runtime oracle.

## How command lookup is composed

ZMail does not use one flat keymap. `INITIALIZE-ZMAIL-COMTABS` constructs related
tables and explicit indirections:

1. the top-level ZMail table handles mail-reading commands;
2. the message-editing table delegates an absent direct cell to the selected ZWEI
   mode;
3. its `Control-X` table delegates an absent child to ZWEI's standard `Control-X`
   table;
4. the reply table adds send/abort/yank operations, but an absent **direct** reply
   cell delegates straight to the selected ZWEI mode, not through the message table;
5. the reply `Control-X` table adds window and draft operations, then delegates to the
   message `Control-X` table and from there to ZWEI's standard `Control-X` table;
6. a right-click in reply composition opens a menu over the principal header, draft,
   send, and abort commands.

The effective composition editor therefore inherits ordinary ZWEI editing and mode
behavior, but its two direct paths are siblings rather than a reply-to-message parent
chain. The reply-to-message chain exists only below `Control-X`. The bindings below
are ZMail's additions and overrides; they should be read alongside the
[ZWEI/Zmacs binding audit](zwei-zmacs-keybindings.md) and D08, not as a standalone
keyboard for inserting and editing text. The top-level reader differs: its table has
no ordinary text-insertion fallback, so an absent cell reaches ZMail's unbound-command
path rather than inserting the character. These edges are constructed in
`zmail/comnds.lisp.602:76-143`; in particular, the direct indirections are at lines
80 and 143 and the reply-prefix indirection is at line 105.

The selected System 303 implementation is a ZWEI/TV application, not CLIM and not
the later Dynamic Windows presentation framework. A search of the pinned Zmail
source finds no application-owned `DEFINE-PRESENTATION-TYPE` or presentation
translator definitions. Sensitive output instead uses TV typeout-item registries
and the special blips enumerated below; minibuffer readers remain D05 ZWEI
contracts. G85's typed parser/completion/default table therefore must not be copied
back into this profile.

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
effective bindings, not four literal keys. Together with the four minus variants,
the reader table has 44 generated numeric cells in addition to its 47 ordinary
direct cells.

The argument is not adequately represented by “present plus an integer.” The source
retains five provenance tags:

| Tag | How it is reached | Initial or resulting value |
| --- | --- | --- |
| `NIL` | no argument command | `1` |
| `:SIGN` | one of the four minus cells before a digit | `-1` until digits replace the magnitude |
| `:DIGITS` | one or more numeric cells | the entered signed decimal integer |
| `:CONTROL-U` | `C-U` without a following digit | four times the preceding value |
| `:INFINITY` | top-level `Z` / Large Argument | `MOST-POSITIVE-FIXNUM` |

The top-level loop resets value and tag before each command
(`zmail/top.lisp.566:95-103`); Large Argument installs `:INFINITY`
(`zmail/comnds.lisp.602:269-273`). Provenance is observable: Summary scrolling tests
`:DIGITS` and `:CONTROL-U` as explicit line counts and treats the other tags as
screen counts (`zmail/comnds.lisp.602:1687-1701`).

Reachability is context-specific. The top-level ZMail reader reaches all five tags.
The message and reply editors use the inherited System 303 editor argument reader,
which reaches `NIL`, `:SIGN`, `:DIGITS`, and `:CONTROL-U`
(`zwei/modes.lisp.164:995-1024`); Large Argument is not installed in those editor
tables, so `:INFINITY` is not an editor state in the clean profile. Summary, menu,
pointer, typeout, and transient utility loops do not synthesize a separate numeric
state of their own. A command reached after returning to the top reader receives the
top reader's state; a command executed wholly inside one of those loops does not.
Minibuffer argument behavior belongs to D05's minibuffer parent.

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

An absent reply-prefix child then inherits the message-prefix additions and Standard
ZWEI `Control-X` commands. Direct reply cells instead go straight to the active mode,
as described above.

The reply extended-command registry has these 17 entries in source order:

1. Add To Field
2. Add Cc Field
3. Add FTo Field
4. Add Fcc Field
5. Add Subject Field
6. Add In-Reply-To Field
7. Add More Text
8. Add From Field
9. ZMail Yank Current Msg
10. Prune Yanked Headers
11. Send Message
12. Abort Send
13. Restore Draft File
14. Write Draft File
15. Save Draft File
16. Save Draft As Msg
17. Change Subject Pronouns

`Mouse-3-1` opens this separate 15-entry menu, also in exact source order:

1. Add To
2. Add Cc
3. Add Fcc
4. Add Subject
5. Add In-Reply-To
6. Add More Text
7. Add From
8. Prune Yanked Headers
9. Send Message
10. Abort Send
11. Restore Draft File
12. Write Draft File
13. Save Draft File
14. Save Draft As Msg
15. Change Subject Pronouns

Thus `Add FTo Field` and `ZMail Yank Current Msg` are extended-command-only in this
profile. The two lists and their deliberate difference are constructed at
`zmail/comnds.lisp.602:107-142`; they must not be normalized into one synthetic
menu.

## Main command menus

The ordinary source-defined command menu has these 20 labels in order:

| Row | Labels |
| ---: | --- |
| 1 | Profile; Quit; Delete; Undelete; Reply |
| 2 | Configure; Save Files; Next; Previous; Continue |
| 3 | Survey; Get New Mail; Jump; Keywords; Mail |
| 4 | Sort; Map Over; Move; Select; Other |

`KBD` below means invocation from a direct key or extended command with
`*ZMAIL-COMMAND-BUTTON*` set to `:KBD`; it is not another mouse button. “Remembered”
means mutable session state, while “profile” means a user option. For the generic
`ZMAIL-MENU-CHOOSE` path, KBD and left use the remembered item and barf when it is
absent; middle uses its profile item when non-null but otherwise exposes the same
chooser as right; right exposes the chooser and updates the remembered item. That
policy is implemented at `zmail/window.lisp.361:965-993`. Commands which branch
directly are recorded explicitly rather than forced into that policy.

### Exact 20-command button matrix

| Main label | KBD | Mouse-L | Mouse-M | Mouse-R |
| --- | --- | --- | --- | --- |
| Profile | enter Profile task | same | same | same; command ignores button identity |
| Quit | save all, quit | same | same | choose save policy × exit policy |
| Delete | use `*NEXT-AFTER-DELETE*` | same | use `*DELETE-MIDDLE-MODE*` | choose delete direction |
| Undelete | scan backward through current position for first deleted message | same | same | same; command ignores button identity |
| Reply | use default recipient × view/yank pair | same | use middle pair | choose one of 21 recipient × view/yank combinations |
| Configure | toggle Both to Message, every other mode to Both | same | same | choose Summary only, Both, Message only, or Experimental |
| Save Files | expunge/save all | same | expunge current buffer | dynamic per-buffer Expunge/Save/Kill matrix |
| Next | Next undeleted | same | profile next mode, or chooser if unset | six-item Next chooser |
| Previous | Previous undeleted | same | profile previous mode, or chooser if unset | six-item Previous chooser |
| Continue | newest draft | same | newest unsent draft | dynamic draft chooser |
| Survey | all messages in current buffer | same | repeat saved survey filter or barf | choose filter/universe and save it |
| Get New Mail | selected eligible buffer, otherwise primary/default route | same | same | prompt for alternate inbox file; do not delete that file |
| Jump | repeat saved Goto filter or barf | same | point-PDL chooser | choose Goto filter and save it |
| Keywords | derive through filter-keyword associations | repeat remembered add/remove sets or barf | derive through filter-keyword associations | choose complete keyword set and remember its add/remove delta |
| Mail | ordinary Mail | same | profile mail type, or chooser if unset | Bug/Mail/Forward/Redistribute/Local chooser |
| Sort | remembered key and direction | same | buffer sort key and append-derived direction | choose key × direction and remember both |
| Map Over | remembered operation or barf | same | profile operation, or chooser if unset | choose one of 11 map operations and remember it |
| Move | prompt for pathname and remember it | remembered target buffer/path or barf | target derived from current-message filters | dynamic target chooser |
| Select | most recently selected other buffer or barf | same | create subset by filtering | dynamic selection chooser |
| Other | remembered auxiliary command or barf | same | profile auxiliary command, or chooser if unset | current auxiliary-command registry and remember selection |

Numeric arguments take precedence where the command explicitly tests them. Delete
uses the argument to select message number *N* and forces no movement, regardless of
button (`zmail/comnds.lisp.602:354-382`). Undelete uses *N* as the exact message and
otherwise performs the backward scan (`comnds.lisp.602:411-426`). Reply's numeric
rules are specified below. Other commands reject or consume arguments according to
their `DEFINE-ZMAIL-TOP-LEVEL-COMMAND` options; the table does not manufacture a
button variant for them.

Source anchors for the matrix are `zmail/defs.lisp.284:75-95,691-727,780-832`;
`zmail/window.lisp.361:199-217`;
`zmail/comnds.lisp.602:275-426,699-842,1172-1242,1319-1475,1724-1744,2023-2077,2606-2634`;
`zmail/mail.lisp.313:10-36,248-290,558-619`;
`zmail/filter.lisp.364:5-70,216-299`;
`zmail/mfiles.lisp.336:837-880`; and `zmail/profil.lisp.131:118-135`.

### Fixed option trees

The following order is normative; an implementation must compare ordered leaves,
not merely set membership.

- Next: Next undeleted; Next unseen; Next; Last undeleted; Last unseen; Last.
- Previous: Previous undeleted; Previous unseen; Previous; First undeleted; First
  unseen; First.
- Delete: Backward; Forward; Remove; No.
- Configure: Summary only; Both; Message only; Experimental.
- Mail: Bug; Mail; Forward; Redistribute; Local.
- Sort is an 8 × 2 product. Keys are Date, To, From, Subject, Keywords, Text,
  Length, Position; directions are Forward, Backward.
- Quit is a 3 × 2 product. Save policies are Don't Save, Ask, Save; exit policies
  are Quit, Logout.
- Map Over: Delete; Undelete; Type; Find string; Keywords; Unkeywords; Move;
  Forward; Redistribute; Reply; Concatenate.
- Other starts with exactly View File; Whois. `ADD-OTHER-COMMANDS` appends new
  command-name entries in registration order, so a patched or site-loaded image has
  a larger registry rather than a different clean denominator
  (`zmail/comnds.lisp.602:144,2606-2609`).

### Reply's 21-choice tree

System 303 Reply is a 7 × 3 product, not the later Genera 7 × 3 × 2 tree:

~~~text
recipient
├─ All
├─ All-Cc
├─ Cc-All
├─ To
├─ To-Cc
├─ Cc-To
└─ Sender
   × view/yank
     ├─ Like Mail
     ├─ Show Original
     └─ Yank
~~~

Left and KBD use `*REPLY-MODE*` × `*REPLY-WINDOW-MODE*`; middle uses the two
middle-profile values; right exposes all 21 products. A numeric argument bypasses
the button branch: `1` substitutes `*1R-REPLY-MODE*`; `3` or `4` forces Yank;
every other numeric value leaves the default pair unchanged. This exact ordering and
precedence come from `zmail/defs.lisp.284:712-727` and
`zmail/mail.lisp.313:558-619`.

### Dynamic chooser schemas

Dynamic values vary, but their construction order and terminal actions are fixed:

- **Save Files:** rows are buffers sorted by display name. A disk-buffer row offers
  Expunge, Save, Kill; a temporary-buffer row offers Expunge, Kill. Initial checks
  reflect pending expunge/save work. Execution is Expunge, then Save, then Kill for
  each chosen row; after any disk expunge, unchanged temporary buffers receive the
  source's cleanup expunge (`zmail/comnds.lisp.602:801-842`).
- **Select:** loaded disk buffers, then loaded temporary buffers, then an optional
  nonselectable balancing cell, followed by Read or create file, Mark summary,
  Abort, Subset (`zmail/filter.lisp.364:26-70`).
- **Move:** loaded disk buffers, then loaded temporary buffers, then an optional
  balancing cell; next comes By Filters for a single message or By Individual
  Filters for a whole-buffer operation; then New Temporary, Generated Temporary,
  Find file, Text Mail File, Abort, Hardcopy. Hardcopy maps left to ordinary
  hardcopy, middle to no value, and right to hardcopy options
  (`zmail/comnds.lisp.602:1367-1475`).
- **Continue:** draft rows in `*DRAFT-LIST*` order, followed by Restore draft file
  and Restore draft message. On Restore draft message, left uses the current
  message, middle has no value, and right invokes the one-message Summary chooser
  (`zmail/mail.lisp.313:248-290`).
- **Keywords:** the multiple-choice rows come from the current keyword registry.
  Committing computes and stores two ordered sets—newly added and newly removed—as
  the next left-button default (`zmail/comnds.lisp.602:1172-1242`).
- **Survey and Jump/Goto:** their right branches enter the filter/universe selector
  described under [Filter selection](#filter-selection). Survey stores all four map
  and filter values; Goto stores its filter function and argument. Cancellation and
  a missing remembered value retain the source's abort/barf behavior
  (`zmail/filter.lisp.364:216-299`).
- **Other:** its rows are the current append-only auxiliary registry, beginning with
  the two clean leaves above. Left and middle resolution use exact command identity,
  and the selected menu item becomes the remembered left default
  (`zmail/comnds.lisp.602:2611-2634`).
- **Replay Keyboard Macro:** although not one of the 20 pane cells, it has the same
  dynamic shape: registered macro names in registration order, a remembered default
  for KBD/left, and a menu for right. An absent/invalid default or a stream without
  macro execution support barfs (`zmail/comnds.lisp.602:2660-2684`).

The experimental filter-oriented layout separates commands which do not require a
message filter—Configure, Get New Mail, Save Files, Sort, Profile, and Quit—from the
filter-aware menu: Concatenate, Survey, Delete, Undelete, Reply, Other, Type, Next,
Previous, Continue, Select, Keywords, Move, and Mail.

The Mail menu's Local leaf creates a new message in the current buffer for editing
instead of sending it through a network transport.

## Summary-pane mouse behavior

Summary lines are mouse-sensitive message objects.

| Gesture | Source behavior |
| --- | --- |
| Left click | select the message; if necessary leave summary-only layout so its body can be shown |
| Middle click | perform the profile-selected middle action; the default is delete-or-undelete |
| Right click | open the summary-message menu |

The static registry is Continue, Keywords, Delete, Undelete, Remove, Reply, Move,
Append, Filter, but that is not the exact right-button display order. The dispatcher
synthesizes this ordered list for each clicked row:

1. Keywords;
2. Delete **or** Undelete, according to the clicked message's deleted state;
3. Remove, only for a temporary buffer;
4. Continue for a draft **or** Reply for any other message;
5. Move;
6. Append;
7. Filter.

The middle-button chooser is a separate exact list: Delete/Undelete;
Delete/Remove; Keywords; Delete; Undelete; Remove; Reply; Move; Append; Filter.
The first two entries resolve conditionally at execution. The static registries are
at `zmail/defs.lisp.284:848-875`; the synthesized right list and middle dispatch are
at `zmail/window.lisp.361:734-759`.

Menu buttons also distinguish left, middle, and right actions. Consequently, a label
such as Reply or Move can have a quick default action and a right-button option menu;
the visible label alone is not a complete interaction specification.

## Transient task and presentation trees

The main table is only one input context. System 303 installs separate input loops
for marking, filter and universe work, profile editing, one-shot choosers, typeout
items, extended search, and the experimental `:NEW` layout. These branches do not
fall through to the top-level reader unless the named branch explicitly requeues an
event.

### Utility-frame parent

Filter, universe, and profile tasks share this noneditor outer loop:

| Atomic input | Effect |
| --- | --- |
| `Clear-Screen` | refresh the frame |
| `Control-R` | select and edit the current pane |
| `Break` | enter ZMail Break |
| `Abort` | throw to the child frame's top-level tag |
| any other atomic key | `BARF`; there is no Standard-editor fallthrough |

The parent compound-event dispatcher is exact and ordered by opcode:

| Opcode | Parent action and result |
| --- | --- |
| `SUMMARY-EXECUTE`, `:TYPEOUT-EXECUTE`, `:EXECUTE` | apply the supplied function and arguments; return its values |
| `READ-BACKGROUND-RESPONSE-QUEUE` | consume and return `DIS-NONE`; the outer loop services the queue |
| `REDISPLAY`, `CONFIGURATION-CHANGED` | consume and return `DIS-NONE` |
| `SCROLL` | preserve relative scrolling, otherwise convert the requested line to an absolute start; redisplay that window and return `DIS-NONE` |
| `SELECT-WINDOW` | temporarily select the named window, enter its editor under the standalone-abort catch, then return `DIS-NONE` |
| raw `:MOUSE-BUTTON` | requeue the complete event and recursively issue `SELECT-WINDOW` for the current editor window |

The main ZMail frame uses that table as its fallback but overrides these opcodes:

| Opcode | Main-frame override |
| --- | --- |
| `:MENU` | set command-button state from the blip, resolve the menu item without side effects, and execute its command |
| raw `:MOUSE-BUTTON` on the command-buttons frame | requeue the event and enter the experimental universe/filter operand collector |
| raw `:MOUSE-BUTTON` on the current editor window | requeue the event and invoke the main `SELECT-WINDOW` branch |
| raw `:MOUSE-BUTTON` on any other window | ignore and return `DIS-NONE` |
| `SUMMARY-MOUSE` | set command-button state from the row gesture and dispatch the clicked message |
| `SELECT-WINDOW` | clear pending input when there is no current message, make the named window current, and execute Edit Current Message |
| `GET-NEW-MAIL` | invoke Get New Mail directly |
| `MODE-LINE` | set the supplied button and execute the supplied command |
| `READ-BACKGROUND-RESPONSE-QUEUE` | consume and return `DIS-NONE` |

Main-frame matches take precedence; unlisted opcodes fall through to the parent.
An unknown compound event is requeued only when the active dispatcher's
`:WHICH-OPERATIONS` result advertises that opcode, then the current loop is
restarted. Otherwise the unknown-special condition declines it; there is no
universal “unknown event beeps” rule. These branches are at
`zmail/top.lisp.566:135-185,694-727`.

### Reader mode line and summary label

The mode line has three dynamic selectable regions:

| Region | Gesture tree |
| --- | --- |
| buffer filename | present only while a buffer exists; invoke Rename Buffer |
| current keywords | left repeats the last stored add/remove sets or barfs if none; middle derives keywords from matching filters; right chooses the complete set and updates the stored default |
| message more/scroll | left advances one screen less one line; middle moves backward by that amount; right opens Forward, Backward, Beginning, End in that order |

The Summary pane's label has a separate geometry-dependent action. A single left
click in its central half toggles Both to Summary and every other configuration to
Both. A single left click in either outer quarter selects Message. Other mouse
buttons on the label do not invoke this transition.

### Marking mode

Marking first clears message marks and exposes the Summary configuration. Its entire
task-local tree is:

| Input | Effect |
| --- | --- |
| `SUMMARY-MOUSE` | toggle the clicked message's mark |
| `End` | commit the marked set as a temporary buffer |
| any other compound blip | commit, requeue that blip, and return |
| `Abort`, `Control-]` | abort without committing |
| any other atomic key | beep and remain in marking mode |

Compound-blip commit is tested before atomic abort. Unwind always removes the marks
and restores the prior documentation and layout.

### Filter selection

The filter-selection frame owns no keyboard table: every atomic key beeps. Its
pointer/event tree is:

| Item or event | Button policy and result |
| --- | --- |
| Abort | every button aborts selection |
| Not | every button toggles the Not accent/state |
| Universe | every button opens the universe chooser; commit only a non-null result |
| keyword menu | return the selected keyword predicate |
| system menu | return All, Deleted, Unseen, Recent, Answered, Filed, Search, From/To, or Subject |
| user-filter menu | return the selected stored filter |
| New Filter | enter filter definition; canceling definition aborts selection |
| other compound or random nonaccent click | ignore |

### Filter definition

Outside the editor, filter definition inherits the utility-frame parent. Inside the
editor, `End` and `Control-Escape` finish the standalone edit, `Abort` leaves only
the editor, and all other input inherits Standard ZWEI plus the extended-search
`Control-H` prefix listed below.

The insertion menus cover Any or a named keyword, a named user filter,
Deleted/Unseen/Recent/Answered/Filed, Search, To, To/Cc, From, Subject, Other, and
Before/On/After date predicates. The application buttons are exact:

| Button | Left | Middle | Right |
| --- | --- | --- | --- |
| Not, And, Or, Close | same insertion or navigation action | same | same |
| Sample | sample the current sequence | sample the current sequence | choose a universe, then sample |
| Done | parse, evaluate, and compile | same | same |
| Abort | return null | same | same |
| Name | prompt for a new name | open existing-filter menu | open existing-filter menu |

A summary click extracts filter material. Typeout-execute and summary-execute events
explicitly barf. The middle-button Name behavior is source-visible even though its
documentation mentions only the right button.

### Universe definition

Universe definition uses the same utility parent and standalone editor contract;
its mode line incorrectly says `Editing Filter`. File and temporary-buffer menu
items insert buffer-name strings, Primary and Current insert those symbols, named
universes insert a one-item list, and All inserts `(ALL)`.

`Union`, `Intersection`, `Not`, `Close`, `Done`, and `Abort` perform the same action
for every button. `Name` uses left for a new name and middle/right for the existing
universe menu. D08 retains a runtime oracle for the `(ALL)` representation versus
direct symbol expansion instead of guessing.

### Profile task

The profile task uses the utility parent before editing and standalone ZWEI while
editing. `Control-R`, selecting the editor pane, or clicking Edit enters the editor.
The application buttons form this tree:

| Button | Left or keyboard | Middle | Right |
| --- | --- | --- | --- |
| Filters | edit remembered list | filter associations | menu of those two |
| Universes | edit remembered list | universe-filter associations | menu of those two |
| Mail Files | edit remembered files | file-filter associations | menu of those two |
| Keywords | edit file keywords | keyword-filter associations | menu of those two |
| Save | insert changes, save, maybe compile | make init compiled | Save file; Make init compiled; Insert changes; Reap file; Recompile file |
| Hardcopy | choose hardcopy options | same | same |
| File Options | choose buffer and edit options | same | same |
| Exit | leave profile task | same | same |
| Reset | restore init-file values, optionally text | same | same |
| Defaults | restore system defaults | same | same |
| Edit | synchronize values, edit, then reread | same | same |

Variable-choice events delegate the actual button to the TV value pane, mark profile
state changed, and refresh its documentation. The Keywords popup uses the same
standalone `End`/`Abort` edit contract. Random nonaccent clicks are ignored.

### Message choosers and typeout items

`CHOOSE-MSG-FROM-SUMMARY` consumes exactly one event: `SUMMARY-MOUSE` returns its
message; every other input barfs and is not requeued. The typed-or-summary chooser
uses ordinary minibuffer editing, accepts a clicked summary message, and substitutes
its default when typed input is empty.

Typeout items have these left defaults and ordered right menus:

| Item | Left default | Right menu, in order |
| --- | --- | --- |
| ZMail buffer | Select | Kill; Save; Expunge; Expunge & Save; Select |
| file | Select | Select; Arbitrary format; View |
| unloaded mail file | Read in | Read in |
| summary line | Select message | Select |
| saved point | Select point | Select |
| message line | Select containing message | Select |
| minibuffer string | Insert | Insert |
| sender, recipient, or subject predicate | Insert predicate | Insert |

Left emits a typeout-execute event, right chooses an operation, and any other single
button beeps. The typeout reader returns only numeric/keyboard input or the named
typeout, summary, menu, mouse, mode-line, and mouse-button opcodes; it discards other
compound events. Multiple-header and single-field selectors accept exactly one
typeout-execute event and barf otherwise. Filter extraction accepts typeout actions,
changes its source message on a summary click, returns on Space, and requeues any
other input before returning.

### Extended-search minibuffer

Extended search inherits the ordinary minibuffer and adds Help plus this complete
`Control-H` child:

| `Control-H` leaf | Search expression |
| --- | --- |
| `(` | open |
| `)` | close |
| `Control-_`, `Control-O` | Or |
| `Control-D`, `&`, `Control-A` | And |
| `Control-N`, `~`, `Control-E` | Not |
| `Space` | whitespace |
| `-` | delimiter |
| `A` | alphabetic |
| `*` | repeat next |
| `Control-X` | any character |
| `Help` | documentation |

The ordinary parent accepts Return, Control-Return, End, Control-G, Abort,
Control-Shift-Y, Control-Meta-Y, Control-Shift-S, Meta-Shift-Y, and a double left
click. `Control-Z`, `Meta-Z`, and `Control-Meta-Z` are hard undefined before Standard
fallthrough.

### Experimental `:NEW` layout

The experimental layout gathers a universe, filter, and command through a staged
tree:

~~~text
Universe
├─ left   -> reuse last universe
├─ middle -> current buffer
└─ right  -> choose universe and save it as the default

Filter
├─ left   -> reuse last filter
├─ middle -> BARF
└─ right  -> choose filter and save it as the default

Command/menu event
├─ repeatedly resolve Other Commands
├─ current-message command
├─ current-buffer associated-all command
├─ other-buffer associated-all command under dynamic selection
├─ materialize filtered temporary buffer, then associated-all command
├─ associated map command
└─ otherwise BARF
~~~

A filter chosen while scope is one message promotes scope to the current buffer. An
input which is neither a menu nor mouse-button event is requeued and exits operand
collection. Unwind restores the labels `Just current message` and `All`.

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

## Conformance enumeration requirements

A System 303 implementation conforming to this companion must produce an
effective-tree record for every row below, not just demonstrate a few representative
keys:

1. enumerate every finite character/modifier cell of the top reader, recursively
   descend `Control-X`, expand all four ten-digit ranges, and distinguish absent,
   hard-undefined, prefix, nonfunction symbol, and callable leaves;
2. enumerate message direct -> selected mode and message `Control-X` -> Standard
   `Control-X` independently, then enumerate reply direct -> selected mode and reply
   `Control-X` -> message `Control-X` -> Standard `Control-X`; reject an
   implementation which inserts the message direct table into the reply direct path;
3. compare the reply extended registry and `Mouse-3-1` menu as ordered 17- and
   15-leaf sequences, including the two extended-only leaves;
4. invoke all 20 main commands with KBD, left, middle, and right under fixtures for
   every remembered/profile default being present and absent, and compare all fixed
   lists and Cartesian products in order;
5. construct dynamic fixtures with zero, one, and multiple disk and temporary
   buffers, drafts, keywords, filters, macro registrations, and appended Other
   commands; compare category order, balancing cells, button-valued leaves,
   cancellation, remembered-state updates, and Save's Expunge -> Save -> Kill
   execution order;
6. enumerate Summary left/middle/right with draft/non-draft, deleted/undeleted, and
   disk/temporary states, comparing the synthesized list rather than the static
   registry;
7. drive the parent compound dispatcher, every main-frame override, and every
   transient context on this page with each accepted atomic key and compound opcode,
   including an unknown atomic and unknown compound value. Verify
   override-before-parent precedence, consume, beep, barf, abort, commit, requeue,
   and fallthrough separately; also prove that TV typeout items, not a synthesized
   Dynamic Windows presentation-type graph, own this profile's sensitive output;
8. test the top reader with `NIL`, `:SIGN`, `:DIGITS`, `:CONTROL-U`, and
   `:INFINITY`, retaining tag and value separately. Test inherited editor contexts
   only with the first four reachable tags, and prove that utility loops do not
   manufacture numeric variants;
9. query Help for every direct leaf and every reachable prefix leaf, then traverse
   the explicit Map and Other right-button branches. Record the source-visible
   four-key-path display limit and do not infer recursive traversal of unrelated
   menus; and
10. repeat the graph after applying a controlled profile default, appended Other
    command, and installed key, recording clean-source and overlay origins separately.

Each record must include context, active pane/mode, input path, button, numeric tag
and value, applicability state, ordered parent path, selected leaf, state change,
redisplay degree, Help result, error/abort result, and whether the event was consumed
or requeued. Passing only command-name counts does not satisfy these requirements.

## Source/runtime boundary

The fixed reader/editor bindings are established by source inspection of
[`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp)
and the menu/default definitions in `zmail/defs.lisp`; `top.lisp`, `filter.lisp`, and
`profil.lisp` establish the transient loops, choosers, search grammar, and button
policies. They have not been enumerated from a live ZMail frame. The fresh System
`303-0` session described in the
[application article](zmail.md#runtime-observation-advertised-but-not-resident)
proved that the static System Menu advertised Mail while `ZWEI:ZMAIL-FRAME` was not
loaded. Loading the source was blocked by the unsited world's file-host configuration.

**Runtime TODO:** after a disposable local file host is configured, evaluate the live
command-table indirections and completion alist, compare them with this static list,
exercise Help and the three mouse buttons in a synthetic empty mailbox, and retain
capture-specific provenance for any reviewed screenshots.

Until that oracle runs, this is complete selected-source mapping rather than a claim
about site/profile overlays in a live historical frame. A conformance enumerator must
walk every parent edge and prefix from D05, each table and transient branch here, and
the precedence, argument, Help, applicability, and unbound rules in D08.

## Sources

- LM-3 System 303
  [`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp),
  command-table construction and top-level commands.
- LM-3 System 303
  [`zmail/defs.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fdefs.lisp),
  menus, options, and layout names.
- LM-3 System 303
  [`zmail/top.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Ftop.lisp),
  utility-frame dispatch, transient-frame entry, choosers, and the experimental
  `:NEW` command loop.
- LM-3 System 303
  [`zmail/filter.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Ffilter.lisp),
  marking, filter/universe tasks, extended-search prefix, and typeout handlers.
- LM-3 System 303
  [`zmail/profil.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fprofil.lisp),
  profile button and editor behavior.
- Richard Stallman,
  [*ZMail Manual*, first edition](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmanual%2Fmanual.text),
  April 1983, used as version-qualified intended-behavior evidence.

Last verified: 2026-07-19.

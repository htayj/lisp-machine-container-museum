---
type: Historical Article
title: Uses of the Hyper modifier on the MIT CADR and LM-3
description: Release-bounded catalog of every established Hyper keyboard and pointer role in the public System 46 and maintained System 303 software, grouped by application.
tags: [mit-cadr, lm-3, keyboard, hyper, keybindings, interaction]
timestamp: 2026-07-26T05:07:57-04:00
---

# Uses of the Hyper modifier on the MIT CADR and LM-3

## Bottom line

Hyper has no single system-wide meaning. Its strongest recurring application-level
idea is “operate on a domain-specific structural unit”:

- ZMail treats an address as a unit larger and more structured than a word;
- C mode uses `Hyper-.` to find a C definition;
- Inspector uses held Hyper plus left click to modify a field; and
- Spacewar uses the physical Hyper switch for left rotation.

In the System 303 standard editor, however, Hyper is most often numeric-argument
syntax or an alias-generation device. Many other subsystems preserve, strip, or
discard it without assigning an action.

## Evidence boundary and notation

The profiles and source pins are the same as in the companion
[Super catalog](super-modifier-uses.md):

| Profile | Evidence |
| --- | --- |
| `C46` | Public System 46 source at Git `8e978d7d1704096a63edd4386a3b8326a2e584af` |
| `C303-SRC` | Maintained LM-3 System 303 source at Fossil `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` |
| `C303-RUN` | Explicitly recorded museum harness observations |

`H-` means Hyper; combinations such as `C-H-5` appear here because Hyper remains
one of their constituent bits. “Hyper” in hyperlinks, HyperCard, hyper-pages, or
Spacewar hyperspace is excluded unless it denotes the keyboard modifier.

## Application summary

| Application or substrate | Hyper role | Confidence |
| --- | --- | --- |
| ZWEI/Zmacs command loop | Numeric digits/minus; generated Hyper-letter compatibility aliases | Complete selected-source algorithm |
| ZWEI C mode | `Hyper-.` edits a C definition | Selected source |
| ZMail draft editor | Address-scale forward/backward/kill/exchange operations | Selected source |
| Inspector | Hold Hyper and left-click a settable field to modify it | Selected source; runtime TODO |
| Spacewar | Left Hyper turns the left ship left; Hyper also participates in the start gate | System 46 source and runtime dossier |
| System key and TV menus | Preserved or normalized modifier state without a general action | Selected source |
| Supdup and Telnet | No independent wire representation | Selected source |
| EINE and System 46 standard ZWEI | No standard Hyper editing row established | Negative source result |

## ZWEI and Zmacs

### Numeric arguments

System 303 installs digit ranges for every listed Hyper-bearing modifier family:

| Family | Effect |
| --- | --- |
| `H-0` through `H-9` | Decimal numeric argument |
| `C-H-0` through `C-H-9` | Same |
| `M-H-0` through `M-H-9` | Same |
| `C-M-H-0` through `C-M-H-9` | Same |
| Every corresponding family also containing Super | Same |

Minus is installed for the same families except for one strict source defect:
`C-H--` is absent even though `C-H-0` through `C-H-9` exist. The constructor
spells `C--` twice where the missing entry would be expected. This hole is part of
the selected source profile.

### Generated Hyper aliases

When System 303 constructs a named comtab, it generates compatibility aliases for
uppercase letters under the seven Hyper-containing states:

```text
H-C, H-M, H-S, H-C-M, H-C-S, H-M-S, H-C-M-S
```

Each candidate aliases the corresponding lowercase letter after removing Hyper,
provided the source cell is still `NIL`. Lookup restarts at the original top
comtab, so a local explicit binding, an explicit `:UNDEFINED`, or later parent
resolution still matters.

This is not a semantic “Hyper version” of the destination command. It is a
case/keyboard compatibility rule that often causes an otherwise unbound
Hyper-letter chord to behave like the non-Hyper lowercase chord.

### Special error text

The System 303 ZWEI command executor recognizes unbound `Hyper-Space` in its
illegal-command message table and appends the joke:

> Perhaps you should engage warp drive first.

This is an error-reporting special case, not a bound command.

## ZWEI C mode

The C major mode installs:

| Chord | Command | Effect |
| --- | --- | --- |
| `Hyper-.` | `Edit C Definition` | Prompt for a C function, consult the C tag machinery, and edit its definition. |

This is a domain-local analogue of definition navigation. It does not change the
meaning of Hyper in Lisp, text, or mail modes. The named `Read C Tags File` command
has no direct Hyper binding.

## ZMail address editing

The ZMail mode comtab adds five commands:

| Chord | Command | Structured unit |
| --- | --- | --- |
| `Hyper-F` | Forward Address | Next address boundary |
| `Hyper-B` | Backward Address | Previous address boundary |
| `Hyper-K` | Kill Address | Address forward from point |
| `Hyper-Rubout` | Backward Kill Address | Address behind point |
| `Hyper-T` | Exchange Addresses | Adjacent address units |

The grammar is intentionally parallel to Meta word editing, but the unit is a
parsed mail address rather than a word. The same overlay is used by the relevant
ZMail message/reply editing contexts. See [ZMail keybindings](zmail-keybindings.md).

## Inspector

System 303 Inspector checks held modifier state rather than binding a distinct
character in a comtab:

```text
Hyper held + left click on a settable slot
└─ enter the direct slot-modification path
```

The field must advertise a setter or otherwise be marked modifiable. Inspector asks
for the replacement by evaluated form or by pointing at another displayed value,
then recomputes the inspected object display. The menu's **Modify** mode reaches the
same family of operations without requiring Hyper.

This is a particularly strong Hyper semantic: it converts selection into mutation.
The source and help text establish it, but the museum has not yet completed a live
Hyper-left mutation probe. See [Inspector](inspector.md).

## Spacewar

Spacewar consumes the left physical Hyper switch as one game control:

| Player | Physical key | Effect |
| --- | --- | --- |
| Left ship `FOO` | Left Hyper | Turn left |

The right ship instead uses Right Meta to turn left. Super turns both ships right.
Shift—not Hyper—enters hyperspace. The naming coincidence is explicitly not the
control mapping. Any of Control, Meta, Super, or Hyper starts play while the
instructions are visible, so an otherwise unused Right Hyper can still dismiss the
instructions.

## System selection, menus, and pointer representation

| Context | Hyper behavior |
| --- | --- |
| C46 System prefix | Modifier bits are preserved and require an exact registered chord. |
| C303 System prefix | Hyper is stripped with all non-Control modifier bits; the base suffix is selected. |
| C303 Terminal prefix | Exact modifier bits are preserved for registered suffixes. |
| Generic TV row menus | Hyper is represented in the 32-state pointer space but normally does not change row selection. |

The distinction between representation and assignment matters. A pointer event with
Hyper is not equivalent at the character level to an unmodified event, even when a
specific chooser normalizes both to the same row.

## Supdup and Telnet

The selected terminal encoders have no independent Hyper representation. Control
affects low character bits and Meta affects the transmitted high-bit convention;
Super and Hyper do not acquire additional protocol bits. A compatibility
implementation must reproduce that collapse rather than map Hyper to an invented
escape sequence.

## Negative and archival findings

- EINE's audited table has no Hyper row.
- The public System 46 standard ZWEI table does not establish a general Hyper
  command family.
- No Hyper proceed-choice bank parallels the Error Handler's Super-letter bank.
- System 303's `Hyper-Space` joke is not a command.
- Reader examples such as `Hyper-Meta-System` or `Hyper-Super-A` prove character
  syntax, not a binding.
- Inspector's Hyper-left is source/help established but still a runtime TODO.
- The maintained tree's later bug archives mention experimental or site software;
  those records are not silently promoted into the selected System 303 load profile.

## Interpretation

Hyper is best read as an application-reserved structural modifier. When an
application has a meaningful unit not covered by character, word, or Lisp
expression, Hyper is available for it: mail addresses, C definitions, inspectable
slots, or a game-control switch. When no application claims it, the editor can
reuse it for arguments and compatibility aliases.

## Sources and verification

- Public System 46 source at Git `8e978d7d…`.
- Maintained System 303 `zwei/comtab.lisp`, `zwei/modes.lisp`,
  `zmail/comnds.lisp`, `window/inspct.lisp`, `window/mouse.lisp`, and manuals at
  Fossil `4df393c…`.
- [MIT ZWEI and Zmacs keybindings](zwei-zmacs-keybindings.md).
- [ZMail keybindings](zmail-keybindings.md).
- [Inspector](inspector.md).
- [Spacewar](spacewar-on-the-lisp-machine.md).
- [Supdup and Telnet binding semantics](supdup-telnet-bindings-and-protocol-semantics.md).

Last verified: 2026-07-26.

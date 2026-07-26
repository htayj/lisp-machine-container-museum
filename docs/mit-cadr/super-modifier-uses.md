---
type: Historical Article
title: Uses of the Super modifier on the MIT CADR and LM-3
description: Release-bounded catalog of every established Super keyboard and pointer role in the public System 46 and maintained System 303 software, grouped by application.
tags: [mit-cadr, lm-3, keyboard, super, keybindings, interaction]
timestamp: 2026-07-26T05:07:57-04:00
---

# Uses of the Super modifier on the MIT CADR and LM-3

## Bottom line

Super was an independent character modifier, not a uniform “more Meta” level. In
the audited CADR software its meaningful roles cluster into four groups:

1. entering ZWEI numeric arguments without inserting a digit;
2. choosing condition-specific Error Handler recovery actions;
3. requesting an unusually strong ZMail composition abort; and
4. controlling one direction of rotation in Spacewar.

Other subsystems preserve and compare the Super bit but intentionally normalize,
ignore, or discard it. System selection strips it, ordinary TV menus generally do
not assign it a distinct row action, and the selected network-terminal encoders do
not transmit it. These negative paths are uses of the modifier in the dispatch
sense and are included below.

## Evidence boundary and notation

This article separates three profiles:

| Profile | Evidence | Boundary |
| --- | --- | --- |
| `C46` | Public MIT CADR System 46 source at Git commit [`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src) | Complete public snapshot, but the Zmacs overlay and some later applications are absent. |
| `C303-SRC` | Maintained LM-3 source at Fossil check-in [`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), tag `system-303` | Readable maintained source, not a pristine historical distribution tape. |
| `C303-RUN` | Museum System 303 load band exercised through the CADR Xvfb harness | Establishes only the explicitly recorded runtime observations. |

`C-`, `M-`, `S-`, and `H-` mean Control, Meta, Super, and Hyper. `Sh-` means
Shift. A chord containing Super is cataloged here even when other modifiers are
also held. File and character-reader syntax varies between `#/S-A`, `#\s-A`, and
long names such as `Super-Abort`; the normalized spelling here is `Super-A`.

The source audit searched character literals, character-bit operations, comtab
constructors, System/Terminal dispatch, pointer modifier extraction, manuals, and
the already completed application binding audits. Bug archives and superseded
patch bodies were checked for leads but are not promoted to active release
bindings without selected-source evidence.

## Application summary

| Application or substrate | Super role | Confidence |
| --- | --- | --- |
| ZWEI and Zmacs | Numeric-argument digits and minus in System 303 | Complete selected-source table |
| Error Handler | Dynamic `Super-A` through `Super-Z` recovery/special choices | Source, manual, and runtime |
| ZMail composition | `Super-Abort` invokes the stronger abort-send path | Selected source |
| Spacewar | Left Super turns the left ship right; Right Super turns the right ship right | System 46 source and runtime dossier |
| System key and window selection | Modifier is preserved in C46 exact dispatch but stripped in C303; it does not mean “new” | Selected source |
| TV menus and chooser rows | Modifier bit is represented, but ordinary row selection generally normalizes it away | Selected source |
| Supdup and Telnet | No independent wire encoding; modifier is consumed/collapsed | Selected source |
| EINE and System 46 standard ZWEI | No standard Super editing family established | Negative source result |

## ZWEI and Zmacs

### Numeric arguments

System 303 uses Super primarily as an argument-introducing modifier. Modified
digits invoke `Numbers`; modified minus invokes `Negate Numeric Arg`.

| Super-containing family | Effect |
| --- | --- |
| `S-0` through `S-9` | Enter a decimal numeric argument. |
| `C-S-0` through `C-S-9` | Same numeric reader. |
| `M-S-0` through `M-S-9` | Same numeric reader. |
| `C-M-S-0` through `C-M-S-9` | Same numeric reader. |
| Every corresponding family also containing Hyper | Same numeric reader; cataloged in both modifier articles because both bits are significant. |
| `S--`, `C-S--`, `M-S--`, `C-M-S--` | Establish a negative argument. |
| Corresponding Super+Hyper minus families | Establish a negative argument. |

Unmodified digits still self-insert. Thus Super has no special semantic command
here: it changes digits and minus from text into command-loop argument syntax.
The exact numeric state machine is in the
[ZWEI/Zmacs binding audit](zwei-zmacs-keybindings.md#system-303-standard-zwei-table).

System 46's preserved standard table does not establish this Super argument
family. EINE's older table has only plain, Control, Meta, and Control-Meta rows.

### No general Super editing level

The fixed System 303 standard table contains no general family in which, for
example, `Super-F` means motion by a unit larger than the Control/Meta units.
Application modes may bind individual Super characters, but that is a local
namespace rather than a standard editor grammar.

A ZWEI bug archive records an experimental three-command set:
`Super-/;` End of Expression Line, `Super-N` Down Expression Line, and
`Super-P` Up Expression Line. It is not in the selected canonical System 303
comtab and is therefore archival evidence, not part of this profile.

## Error Handler

System 303 assigns the clearest system-level meaning to Super letters:

```text
Super-A ... Super-Z
└─ select entry 0 ... 25 from the choices constructed for the current condition
```

The letters are positions, not fixed commands. The Error Handler combines current
proceed types, nonlocal resume handlers, and special choices, prints the available
Super letters, and dispatches the selected position. A static statement such as
“Super-A means Abort” is false across conditions.

The museum's synthetic runtime condition produced:

| Runtime chord | Choice in that condition |
| --- | --- |
| `Super-A` | Abort to top level |
| `Super-B` | Restart the Initial Process |
| `Super-C` | Reset and arrest the Initial Process |

That observation proves dynamic dispatch in the tested band, not those three
meanings for every condition. The source also installs `Super-Shift-C` as the
`:STORE-NEW-VALUE` special choice when that recovery is offered.

See [Error Handler and graphical debuggers](error-handler-and-debuggers.md) for the
complete table, condition construction, and reviewed runtime screenshot.

## ZMail composition

The System 303 reply comtab distinguishes:

| Chord | Command | Meaning |
| --- | --- | --- |
| `Abort` or `Control-]` | `Abort Send` | Ordinary composition abort path |
| `Super-Abort` | `Really Abort Send` | Stronger, explicitly separate abort path |

This is an application-local intensifier: Super selects the more forceful member of
an abort pair. It does not establish a general rule that Super always means
“really.” The complete reply and message-editor inheritance is in
[ZMail keybindings](zmail-keybindings.md).

## Spacewar

Spacewar reads the physical modifier-key switch bits as game controls rather than
as character prefixes:

| Player | Physical key | Effect |
| --- | --- | --- |
| Left ship `FOO` | Left Super | Turn right |
| Right ship `BAR` | Right Super | Turn right |

Hyper turns in the opposite direction, Shift enters hyperspace, Meta fires, and
Control accelerates. While the instruction display is still visible, pressing any
Control, Meta, Super, or Hyper key starts play. The complete control/physics audit
is [Spacewar on the MIT Lisp Machine](spacewar-on-the-lisp-machine.md).

## System selection and window management

Super participates differently in the two source profiles:

| Profile | Super-bearing System suffix |
| --- | --- |
| `C46` | Modifier bits are preserved. Only an exact modifier-bearing registration can match; an ordinary base registration is not automatically selected. |
| `C303-SRC` | System records whether Control was present, then strips all modifier bits. Super therefore resolves to the base registered suffix. Only Control changes the branch by requesting valid flavor creation. |

Consequently, `Super-System-L` is not a higher-level Listener command in System
303. It normalizes to `System-L`; `Control-System-L` is the meaningful “force a
new instance” variation. The Terminal prefix, by contrast, preserves exact
modifier bits for any explicitly registered suffix.

See the [program-selection specification](../program-selection-activities-and-window-management-reimplementation-specification.md#cadr-keyboard-prefixes).

## TV menus, mouse rows, and generic pointer dispatch

System 303 pointer characters have five modifier bits: Shift, Control, Meta, Super,
and Hyper. A three-button menu can therefore be tested under 32 modifier states per
button. The modifier is real and survives input encoding, but ordinary momentary
menu rows select by normalized primary button and do not give Super a distinct row
meaning.

This matters for compatibility: a clone must preserve the bit and pass it to
application code, while a generic chooser must not invent a Super alternate action.
Applications such as Inspector can separately inspect held modifier state; that
specific use belongs to [the Hyper catalog](hyper-modifier-uses.md).

## Supdup, Telnet, and character transmission

The selected CADR terminal filters encode Control and Meta but do not allocate
independent Super or Hyper wire bits. A Super-bearing input either reaches the same
translation indexed by its base/remaining encoded state or is consumed according to
the active table; it is never sent as a portable “Super” modifier.

“Super-image” mode in the NVT sources is unrelated to the Super key. It names a raw
keyboard/input-buffer mode and must not be counted as a modifier use. See
[Supdup and Telnet bindings and protocol semantics](supdup-telnet-bindings-and-protocol-semantics.md).

## Negative and nonbinding results

- No standard EINE Super row is present in the audited late-1977 table.
- The complete public System 46 standard ZWEI table establishes no general Super
  argument or editing family.
- System 303 generated lowercase/Hyper aliases do not create Super aliases.
- Generic menu enumeration covers Super states, but coverage is not a distinct
  action.
- `:SUPER-IMAGE`, “superior” windows, superpackages, and file supersession are
  lexical false positives, not keyboard uses.
- The source reader accepts names such as `Hyper-Super-A`; accepting a character
  name does not bind it.

## Interpretation

Across the established CADR uses, Super is best understood as spare semantic
capacity rather than a consistent editing scale. The Error Handler uses it as a
dynamic choice bank, ZMail as an intensifier, Spacewar as a physical game switch,
and ZWEI as an argument marker. Software that merely preserves or strips the bit
must remain distinguishable from software that assigns it an action.

## Sources and verification

- Public System 46 source, especially `lispm/qcom`, `nzwei`, `lmwin`, and
  `lmio1/swar.2`, pinned at Git `8e978d7d…`.
- Maintained System 303 `zwei/comtab.lisp`, `eh/ehc.lisp`,
  `zmail/comnds.lisp`, `window/basstr.lisp`, `window/mouse.lisp`, and manuals,
  pinned at Fossil `4df393c…`.
- [MIT ZWEI and Zmacs keybindings](zwei-zmacs-keybindings.md).
- [Error Handler and graphical debuggers](error-handler-and-debuggers.md).
- [Spacewar on the MIT Lisp Machine](spacewar-on-the-lisp-machine.md).
- [Program selection, activities, and window management](../program-selection-activities-and-window-management-reimplementation-specification.md).

Last verified: 2026-07-26.

---
type: Historical Article
title: Uses of the Hyper modifier in Symbolics Genera
description: Genera 8.5 catalog of established Hyper keyboard and pointer uses, grouped by application and separated into active, inherited, normalized, compiled, and inactive source evidence.
tags: [genera, symbolics, keyboard, hyper, keybindings, interaction]
timestamp: 2026-07-26T05:07:57-04:00
---

# Uses of the Hyper modifier in Symbolics Genera

## Bottom line

Hyper remains rarer and more application-specific than Super in Genera. Its active
uses fall into four principal groups:

1. Zmacs numeric arguments;
2. address-scale editing in Zmail;
3. dense compound pointer chords in the NS electronic-design tools; and
4. isolated product commands such as CL-HTTP's `Hyper-Shift-W`.

At the system boundary, `Hyper-Control-Function` is a swallowed keyboard-process
sentinel. Dynamic Windows represents every Hyper pointer state but leaves ordinary
Hyper-only gestures unbound. Several tempting NSage Hyper definitions are inside
block comments and are not active.

## Evidence boundary and method

This catalog uses the same Genera 8.5 licensed source profile and audit method as
the companion [Super catalog](super-modifier-uses.md). The source archive identity
is SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
Licensed source and generated extracts remain untracked.

`H-` means Hyper; compound chords appear here whenever Hyper is one of their bits.
HyperCard, hypertext, hyper-pages, and type supertypes are lexical false positives
and are excluded.

## Application summary

| Application or substrate | Short summary of Hyper use |
| --- | --- |
| Zmacs/ZWEI | Numeric-argument digits and minus across every Hyper-containing modifier combination |
| Zmail | Forward/backward/kill/exchange operations over structured addresses |
| NS electronic design | Alternate selection, hierarchy, simulation, net matching, constraints, and virtual-grid operations |
| CL-HTTP Showable Procedures | `Hyper-Shift-W` runs Show WWW Procedures |
| Low-level keyboard/FEP input | `Hyper-Control-Function` is intercepted and swallowed |
| Dynamic Windows pointer encoding | Hyper states exist in the 32-state matrix but have no standard Hyper-only gesture |
| Select/Terminal protocols | Hyper is stripped by Select and not transmitted by selected terminal filters |
| NSage/Concordia experimental code | Hyper translators/search commands exist only in comments and are inactive |

## Zmacs and ZWEI numeric arguments

Genera installs all 15 nonempty combinations of Control, Meta, Super, and Hyper for
digits and minus. The Hyper-bearing families are:

| Family | Effect |
| --- | --- |
| `H-0`…`H-9` | Decimal numeric argument |
| `C-H-0`…`C-H-9` | Same |
| `M-H-0`…`M-H-9` | Same |
| `C-M-H-0`…`C-M-H-9` | Same |
| Every corresponding family also containing Super | Same |
| Corresponding Hyper-bearing minus chords | Establish negative argument state |

Unlike the maintained CADR System 303 source, Genera includes `Control-Hyper--`;
there is no equivalent missing-minus hole in the selected table. Unmodified digits
still insert text.

Genera does not generate the System 303 Hyper-letter lowercase aliases. Its named
comtab creation path installs only unmodified lowercase-to-uppercase aliases, while
the standard Control-X table installs its separate Control/Meta indirection.

## Zmail address editing

The shared Zmail draft mode adds:

| Chord | Command | Effect |
| --- | --- | --- |
| `Hyper-F` | Forward Address | Move to the next structured address boundary |
| `Hyper-B` | Backward Address | Move to the previous structured address boundary |
| `Hyper-K` | Kill Address | Kill the following address unit |
| `Hyper-Rubout` | Backward Kill Address | Kill the preceding address unit |
| `Hyper-T` | Exchange Addresses | Transpose adjacent addresses |

The overlay applies to address/header editing contexts and inherits ordinary
ZWEI behavior for everything else. It is the clearest Genera example of Hyper
meaning “operate on an application-specific structured unit.” See
[Zmail commands and bindings](zmail-commands-and-bindings.md).

## NS electronic-design applications

NS uses Hyper as a dense alternate-operation namespace. The following tables
partition every Hyper-bearing chord in the recovered core gesture inventories.
In this section, as in the underlying NS dossier, `Super` is written out in full;
none of the `Hyper-Super-...` spellings means Shift.

### Shared graphics selection and manipulation

| Chord | Effect |
| --- | --- |
| `Hyper-Right` | View Menu |
| `Hyper-Super-Right` | Location |
| `Hyper-Left` | Select Other overlapping object |
| `Hyper-Meta-Left` | Region Select Other |
| `Hyper-Control-Left` | Select Connected |
| `Hyper-Super-Left` | Add Select Other |
| `Hyper-Middle` | Kill |
| `Hyper-Super-Middle` | Wipe |
| `Hyper-Control-Middle` | Yank |

### Schematic hierarchy and node operations

| Chord | Effect |
| --- | --- |
| `Hyper-Meta-Right` | Pop one hierarchy level |
| `Hyper-Control-Right` | Push into hierarchy |
| `Hyper-Super-Meta-Left` | Select Node |
| `Hyper-Super-Meta-Middle` | Match Node |
| `Hyper-Super-Meta-Right` | Surround Nodes |

### RSIM

| Chord | Effect |
| --- | --- |
| `Hyper-Left` | Select Other |
| `Hyper-Control-Left` | Select Connected |
| `Hyper-Middle` | `!` operation |
| `Hyper-Super-Middle` | Simulate |
| `Hyper-Meta-Right`, `Hyper-Control-Right` | Pop; Push |
| `Hyper-Super-Meta-Left` | Select related extracted node |
| `Hyper-Super-Meta-Middle` | Match corresponding node |
| `Hyper-Super-Meta-Right` | Surround nodes |

### Gate array

| Chord | Effect |
| --- | --- |
| `Hyper-Super-Meta-Middle` | Swap Gates |
| `Hyper-Super-Meta-Control-Middle` | Swap Pins |

### PCB net and mask modes

| Context | Chord | Effect |
| --- | --- | --- |
| Divider/net | `Hyper-Super-Left` | Corresponding Net |
| Mask | `Hyper-Meta-Right`, `Hyper-Control-Right` | Pop; Push |
| Mask | `Hyper-Super-Meta-Left/Middle/Right` | Select Node; Match Node; Surround Nodes |
| Mask | `Hyper-Super-Meta-Control-Left` | What Layer |
| Mask | `Hyper-Super-Meta-Control-Middle` | Match Creator |
| Mask | `Hyper-Super-Meta-Control-Right` | Compactor Tools Menu |

### PCB virtual-grid mode

| Chord | Effect |
| --- | --- |
| `Hyper-Meta-Middle` | Disconnect |
| `Hyper-Super-Left` | Path Under |
| `Hyper-Meta-Right`, `Hyper-Control-Right` | Pop; Push |
| `Hyper-Meta-Control-Left/Middle` | Remove X/Y virtual grid |
| `Hyper-Super-Control-Left/Middle` | Add X/Y virtual grid |
| `Hyper-Super-Meta-Left/Middle/Right` | Select Node; Match Node; Surround Nodes |
| `Hyper-Super-Meta-Control-Middle` | Import Ports |

These commands are contextual pointer gestures, not global mouse meanings. Several
also contain Super and are therefore cross-listed in the Super catalog at a higher
summary grain. See [The NS electronic-design family](../ns-electronic-design-family.md)
for panes, modes, command ownership, and compiled-artifact evidence.

## CL-HTTP Showable Procedures

The contributed CL-HTTP source installs:

| Chord | Named command | Effect |
| --- | --- | --- |
| `Hyper-Shift-W` | `Show WWW Procedures` | Browse the B-tree of procedures defined for the WWW Lisp system. |

The key is attached by the Showable Procedures definition family and is conditional
on Genera. Related procedure categories share the command infrastructure rather
than each installing a new Hyper chord. See
[CL-HTTP and contributed Web systems](../cl-http-and-contributed-web-systems.md).

## Low-level keyboard and FEP paths

`Hyper-Control-Function` is registered as a keyboard-process escape character and
recognized by the cold-load/FEP input path. The selected handlers consume it and
return no ordinary input character.

It is therefore a real system-reserved chord but not a user command with a visible
application action. A compatibility implementation must preserve its precedence
over ordinary character delivery. See the
[Emergency Break specification](../emergency-break-and-degraded-interaction-paths-reimplementation-specification.md).

## Dynamic Windows pointer state

Dynamic Windows represents Shift, Control, Meta, Super, and Hyper as five
independent pointer modifier bits: 32 states for each of Left, Middle, and Right.
The standard named gesture map assigns no Hyper-only semantic gesture. Unlisted
Hyper combinations are unbound unless an application handler claims them.

A source comment gives `Hyper-Mouse-Left` as an example of how a site could remap
the `Yank Word` gesture. It is documentation of the gesture setter, not the active
default mapping.

## Select, Function, and terminal boundaries

| Context | Hyper behavior |
| --- | --- |
| Select prefix | Suffix is uppercased and all modifier bits are stripped; only Control is retained as force-create state. |
| Function prefix | Exact modifier bits can reach a registered Function chord. |
| Telnet/ITP filters | Hyper receives no independent wire encoding. |
| Raw pointer character | Hyper remains represented until an application or generic dispatcher handles it. |

These negative mappings prevent a modern compatibility layer from inventing
Alt-like escape sequences for Hyper.

## Inactive and commented Hyper forms

The selected tree contains several Hyper-looking definitions that are block-commented:

| Source area | Inactive form |
| --- | --- |
| NSage candidate search | `Hyper-Super-D` Find Any Candidates; `Hyper-D` Find Whole Word Candidates |
| NSage Page Previewer | `Hyper-Left` convert microns to inches |
| Concordia editor debugging | `Hyper-Right` test-searching translator |
| CL-HTTP Showable Procedures comment | Example `Hyper-Super-S`, superseded by the active `Hyper-Shift-W` definition |

These forms are valuable design history but are not active bindings in the selected
source profile.

## Negative findings

- No standard Dynamic Windows Hyper-only pointer gesture is assigned.
- No Hyper equivalent of the debugger's dynamic Super-letter bank is established.
- Genera does not inherit System 303's generated Hyper-letter alias family.
- The selected Zmacs standard table uses Hyper for arguments, not a general
  structural-editing scale.
- HyperCard and hypertext product names do not imply Hyper-key bindings.
- Optional product source presence does not prove that its command was resident in
  the tested base world.

## Interpretation

Hyper is best understood as reserved application vocabulary. Zmail assigns it to
address structure, NS assigns it to alternate and topology-aware pointer actions,
CL-HTTP claims one memorable command, and the low-level input system reserves one
escape chord. Where no application claims it, the standard interface generally
leaves it unbound or uses it only to form an argument.

## Sources and verification

- Genera 8.5 selected source including `zwei/comtab.lisp.~589~`,
  `zmail/commands.lisp.~1600~`, `dynamic-windows/dynamic-input.lisp.~498~`,
  `window/basstr.lisp.~645~`, `sys/ifepio.lisp.~239~`,
  `contributed/cl-http/server/preliminary.lisp.~33~`, and the inspected NS/NSage
  modules. Licensed source remains untracked.
- [Genera Zmacs keybindings](zmacs-keybindings.md).
- [Zmail commands and bindings](zmail-commands-and-bindings.md).
- [Dynamic Windows specification](dynamic-windows-reimplementation-specification.md).
- [NS electronic-design family](../ns-electronic-design-family.md).
- [Emergency Break specification](../emergency-break-and-degraded-interaction-paths-reimplementation-specification.md).

Last verified: 2026-07-26.

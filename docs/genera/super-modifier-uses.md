---
type: Historical Article
title: Uses of the Super modifier in Symbolics Genera
description: Genera 8.5 catalog of established Super keyboard and pointer uses, grouped by application and separated into active, inherited, normalized, compiled, and inactive source evidence.
tags: [genera, symbolics, keyboard, super, keybindings, dynamic-windows]
timestamp: 2026-07-26T05:07:57-04:00
---

# Uses of the Super modifier in Symbolics Genera

## Bottom line

Super acquires a more recognizable visual-interface role in Genera than it had in
the public CADR software. Its strongest recurring patterns are:

- horizontal rather than vertical scrolling;
- operations on marked screen text;
- operations on Dynamic Windows presentations rather than raw text;
- application-local structural editing in Concordia, Compare/Merge, VC, and NS;
- condition-specific debugger choices; and
- Macintosh Command-key equivalents in the Mac integration layer.

It still is not one universal semantic tier. Zmacs also uses Super merely to form
numeric arguments, and several dispatchers deliberately strip or ignore it.

## Evidence boundary and method

The selected source profile is the Genera 8.5 licensed `sys.sct` tree from the
museum's Open Genera media. The tree contains 5,075 files and is identified by the
licensed archive SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
No licensed source is reproduced here.

The audit searched the selected logical source versions for:

- abbreviated and long character literals containing the Super bit;
- keyboard accelerators, ZWEI comtabs, Function/Select registrations, and
  Command Processor tables;
- Dynamic Windows gestures, presentation translators, and pointer-character maps;
- direct modifier-bit tests and modifier-normalizing dispatchers;
- compiled-only application inventories already reconstructed in the museum; and
- commented compatibility/debugging blocks, which are labeled inactive below.

The result is source-profile complete for explicit character literals and named
gestures in the inspected tree. Optional patches, site/user initialization, world
mutation, and compiled products without readable definitions remain distinct
oracle layers.

`S-` means Super and `Sh-` means Shift. A chord appears here if Super is one of its
bits, even when Control, Meta, Hyper, or Shift are also held.

## Application summary

| Application or substrate | Short summary of Super use |
| --- | --- |
| Zmacs/ZWEI | Numeric argument families; presentation-oriented debugging gestures on buffer pointers |
| Dynamic Windows/Input Editor | Horizontal scroll, displayed-string search, marked-text operations, maximal completion, and the standard presentation gesture family |
| Select and Function dispatch | Select strips Super to the base activity; Function preserves it for exact registrations |
| Debugger | Dynamic Super-letter proceed choices and `Super-Shift-C` store-new-value |
| Concordia/Writer Tools | Large structural-document command namespace under Super |
| Compare/Merge and VC | Take-choice prefix, merge state, hard-section navigation, and contextual VC menu |
| Metering Interface | Horizontal scrolling, wipe text, re-meter, and call-tree navigation |
| NS electronic design | Selection alternatives, simulation, hierarchy, constraints, geometry, and node operations |
| Mac UI/RPC integration | Mac Command-Q/W/Z/X/C/V equivalents |
| Bitmap and Graphic Editors | Inactive strict-compatibility screen-capture bindings; one inactive debugging gesture |
| Conversion Tools | Search displayed conversion output forward/backward |
| Document Examiner and Converse | Inherit Dynamic Windows search/marked-text/horizontal-scroll accelerators |
| Macsyma 421 | Compiled gestures open or close/elide mathematical expressions |
| Joshua | Rule documentation and metering-tree presentation gesture |
| NSage/Sage | Hyphenation/line commands and Document Examiner-compatible controls |
| CLIM and presentation-aware programs | Usually inherit or reuse Dynamic Windows/CLIM presentation gestures; no blanket Super meaning |
| Network Terminal protocols | Super is not transmitted by the selected filters |

## Zmacs and ZWEI

### Numeric arguments

The standard Genera comtab installs digits and minus under all 15 nonempty
combinations of Control, Meta, Super, and Hyper. The Super-containing subsets are:

| Family | Effect |
| --- | --- |
| `S-0`…`S-9`, `C-S-0`…`C-S-9`, `M-S-0`…`M-S-9`, `C-M-S-0`…`C-M-S-9` | Enter decimal argument digits |
| The same families also containing Hyper | Enter decimal argument digits |
| Corresponding modified minus chords | Establish the argument's negative sign |

Unmodified digits insert text. Super has no larger-unit editing meaning in these
rows; it is one way to distinguish argument syntax from insertion.

### Presentation-oriented pointer operations

ZWEI adds typed presentation handlers for buffer pointers:

| Gesture | Presented object | Effect |
| --- | --- | --- |
| `Super-Middle` | Buffer pointer | Describe the line containing the pointer |
| `Super-Meta-Left` | Buffer pointer | Display its top-level node |
| `Super-Left` | Buffer pointer | Display its immediate node |

These are contextual Dynamic Windows translators, not raw global mouse bindings.
Their tester requires an eligible mapped ZWEI window. See
[Genera Zmacs keybindings](zmacs-keybindings.md).

## Dynamic Windows and the Input Editor

### Keyboard accelerators

| Chord | Operation | Semantic pattern |
| --- | --- | --- |
| `Super-Scroll` | Scroll horizontally forward | Super changes the scroll axis |
| `Meta-Super-Scroll`, `Super-Back-Scroll` | Scroll horizontally backward | Meta/back direction variant |
| `Super-S` | Search displayed strings forward | Search rendered/typeout text |
| `Super-R` | Search displayed strings backward | Reverse rendered-text search |
| `Super-W` | Push marked TV-region strings | Operate on marked display text |
| `Super-G` | Clear marked TV-region strings | Operate on marked display text |
| `Super-Complete` | Maximal/strongest completion | Stronger completion policy |

These commands occur in the Command Processor accelerator tables, Dynamic Windows
scroll dispatch, and the older-compatible Input Editor. Numeric argument semantics
differ by command: horizontal scroll can interpret a finite argument as columns,
while displayed-string search rejects one.

### Standard presentation gestures

| Gesture | Standard meaning |
| --- | --- |
| `Super-Left` | Select Object |
| `Super-Middle` | Describe Presentation |
| `Super-Right` | Presentation Debugging Menu |
| `Super-Shift-Left` | Reprint/represent differently |
| `Super-Shift-Middle` | Edit viewspecs |

This is Genera's strongest coherent Super grammar. Control gestures generally mark
or yank text, Meta gestures commonly edit/evaluate source objects, and Super
gestures address the presentation record or how it is represented.

The pointer array nevertheless has 32 modifier states for each button. Unlisted
Super combinations remain unbound unless an application or loaded handler claims
them. See the [Dynamic Windows specification](dynamic-windows-reimplementation-specification.md).

## Select and Function prefixes

Genera's activity selector uppercases the suffix, records whether Control was
present, then strips all modifier bits:

```text
Super-Select E -> Select E
Control-Super-Select E -> Control-Select E -> force creation when valid
```

Super does not request a distinct application. The Function prefix instead
preserves modifier bits for exact registry matching, so a loaded subsystem may
register a genuinely Super-bearing Function suffix.

Concordia separately watches `Super-Select` as an application-switching chord;
its selected hook recognizes only `E`, `P`, and `G`, despite a manual describing
four destinations.

## Debugger

The Genera debugger constructs condition-specific choices beginning with
`Super-A`. As on System 303, letters are positions in the current choice vector,
not fixed global commands. The display policy can prefer `Resume`, Super choices,
or both. The base source also associates `Super-Shift-C` with
`:STORE-NEW-VALUE`.

A museum runtime probe confirmed two dynamically constructed Super choices for its
synthetic condition. See [Genera debugger and Display Debugger](debugger-and-display-debugger.md).

## Concordia and Writer Tools

Concordia makes Super its primary structural-document modifier:

| Chord | Writer Tools operation |
| --- | --- |
| `Super-A`, `Super-E`, `Super-H` | Beginning of Record; End of Record; Mark Record |
| `Super-.`, `Super-P` | Edit Record; Preview Record |
| `Super-L`, `Super-M`, `Super-^` | Make Language Form; Create Markup; Remove Markup |
| `Super-K` | Kill Environment |
| `Super-F`, `Super-B` | Forward/Backward Environment |
| `Super-(`, `Super-)` | Beginning/End of Environment |
| `Super-W` | What Record Am I |
| `Super-I` | Insert Multilevel Index Entry |
| `Super-Tab`, `Super-_` | Insert tab-stop directive; insert em dash |
| `Super-=`, `Super->` | Insert collect-centering/right-flushing directive |
| `Super-Help` | Writer Tools help |
| `Super-S`, `Super-R` | Find markup string forward/backward |
| `Super-Space`, `Super-Backspace` | Again; Reverse Again, installed globally in standard ZWEI |

NSage also installs `Super-Meta-L` for **Process Line at Point** and `Super-$` for
**Hyphenate This Word**. The complete command and source/manual discrepancy audit is
[Concordia, structured documentation, and book design](../concordia-document-and-book-design.md).

## Compare/Merge and Version Control

### Compare/Merge

| Chord or sequence | Effect |
| --- | --- |
| `Super-Z`, then `A`…`Z` | Take the corresponding merge tag |
| `Super-Z`, then `Super-A`…`Super-Z` | Take the tag, hide annotations, and confirm |
| `Super-C` | Prompt for a tag/merge choice |
| `Super-Control-S` | Swap/toggle merge difference information |

`Super-Z` is a true prefix with 52 reachable letter leaves, not a single command.
The source also retains a superseded `Super-Right` spelling for taking a presented
tag, but the later source branch and manual agree on `Meta-Right`; it is therefore
recorded as edit history rather than the selected binding.

### Version Control file-buffer mode

| Chord | Effect |
| --- | --- |
| `Super-<`, `Super->` | Go to hard-section beginning/end |
| `Super-O` | Split hard section |
| `Super-Mouse-Left` | Open the contextual VC menu |

See [Source comparison, Compare/Merge, and version control](../source-comparison-compare-merge-and-version-control.md).

## Metering Interface

| Chord or gesture | Effect |
| --- | --- |
| `Super-Scroll`, `Meta-Super-Scroll` | Horizontal forward/backward scroll |
| `Super-W` or `Meta-W` | Wipe selected results text to the kill ring |
| `Super-Middle` on a run | Re-meter it with editable parameters |
| `Super-Meta-Left` on a call-tree node | Hoist it, or dehoist if already root |
| `Super-Left` on a call-tree node | Open the high-percentage descendant ladder |
| `Super-Control-Left` on a call-tree node | Show all descendants |
| `Super-Meta-Middle` on a call-tree node | Set zero-indentation depth from the node |

Installed documentation assigns `Super-Left` to Show All Descendants, while the
inspected component source assigns that operation to `Super-Control-Left` and uses
`Super-Left` for the thresholded ladder. The disagreement remains a runtime oracle.
See [Metering and performance analysis](../metering-and-performance-analysis.md).

## NS electronic-design applications

The NS family uses Super extensively in pointer chords. These tables contain every
Super-bearing chord in the recovered core inventories.

### Shared graphics and schematic editing

| Context | Super chord | Effect |
| --- | --- | --- |
| View | `Super-Meta-Right` | Zoom Out |
| View | `Super-Right` | Surround |
| Selection | `Super-Left` | Unselect |
| Selection | `Super-Middle` | Value |
| Selection | `Super-Control-Middle` | Properties |
| Selection | `Super-Meta-Control-Middle` | Move To |
| Orient | `Super-Left` | Mirror Y |
| Drawing a line | `Super-Left`, `Super-Middle` | Jog; Angle |
| Schematic | `Super-Meta-Middle` | Plot/Unplot Node |

### RSIM

| Chord | Effect |
| --- | --- |
| `Super-Middle` | `?` operation |
| `Super-Control-Middle`, `Super-Control-Right` | Plot; Unplot node |
| `Super-Meta-Middle`, `Super-Meta-Control-Middle` | Trace; Untrace node |
| `Super-Meta-Left`, `Super-Meta-Control-Left` | Watch; Unwatch node |

### Gate array, PCB, and VLSI

| Application/context | Chord | Effect |
| --- | --- | --- |
| Gate array | `Super-Meta-Middle` | Identify |
| PCB Mask | `Super-Meta-Left` | Describe Constraint |
| PCB Mask | `Super-Meta-Control-Left`, `Super-Control-Left` | Find vertical/horizontal constraint |
| PCB virtual grid | `Super-Meta-Left`, `Super-Meta-Middle` | Describe Constraint; Connect |

### Compound Hyper-Super chords

These remain Super uses even though Hyper is also held:

| Context | Compound chord | Effect |
| --- | --- | --- |
| View | `Hyper-Super-Right` | Location |
| Shared selection | `Hyper-Super-Left` | Add Select Other |
| Shared editing | `Hyper-Super-Middle` | Wipe |
| Schematic/RSIM | `Hyper-Super-Meta-Left/Middle/Right` | Select Node; Match Node; Surround Nodes |
| RSIM | `Hyper-Super-Middle` | Simulate |
| Gate array | `Hyper-Super-Meta-Middle` | Swap Gates |
| Gate array | `Hyper-Super-Meta-Control-Middle` | Swap Pins |
| PCB divider/net | `Hyper-Super-Left` | Corresponding Net |
| PCB Mask | `Hyper-Super-Meta-Control-Left` | What Layer |
| PCB Mask | `Hyper-Super-Meta-Control-Middle` | Match Creator |
| PCB Mask | `Hyper-Super-Meta-Control-Right` | Compactor Tools Menu |
| PCB virtual grid | `Hyper-Super-Left` | Path Under |
| PCB virtual grid | `Hyper-Super-Control-Left/Middle` | Add X/Y virtual grid |
| PCB virtual grid | `Hyper-Super-Meta-Control-Middle` | Import Ports |

The same chords are grouped from Hyper's perspective in the
[Hyper catalog](hyper-modifier-uses.md). The complete context and inheritance
tables are in the [NS family dossier](../ns-electronic-design-family.md).

## Macintosh integration

Genera's remote Macintosh UI treats Super as the local analogue of the Mac Command
key:

| Genera chord | Mac presentation | Operation |
| --- | --- | --- |
| `Super-Q` | Command-Q | Quit |
| `Super-W` | Command-W | Close the front viewer |
| `Super-Z` | Command-Z | Undo menu template entry |
| `Super-X` | Command-X | Cut |
| `Super-C` | Command-C | Copy |
| `Super-V` | Command-V | Paste |

Undo is named by the standard Edit template, but the audited remote editing path
does not establish a direct handler for every template entry. See
[RPC, embedding, UX, and Macintosh integration](../rpc-embedding-ux-and-macintosh-integration.md).

## Bitmap Editor and Graphic Editor

The selected files contain strict-compatibility forms inside block comments:

| Inactive chord | Intended compatibility action |
| --- | --- |
| `Super-Q` | Capture rectangle/screen/window/who-line into Bitmap Editor |
| `Super-Shift-Q` | Capture the same source into Graphic Editor |
| `Super-Left` | Graphic Editor “Where Am I” debugging translator |

Because the forms are inside `#|| ... ||#`, they are not active selected-source
bindings. They are preserved as optional compatibility/debugging evidence, not
reported as live commands. The visible products and their other active controls are
documented in [Bitmap editors](../bitmap-stipple-and-raster-paint-editors.md) and
[Graphic Editor](../genera-graphic-editor-and-structured-drawing.md).

## Other applications inheriting or specializing Super

| Application | Super use |
| --- | --- |
| Conversion Tools | `Super-S`/Find and `Super-R`/Meta-Find search displayed conversion output. |
| Document Examiner | `Super-S/R` search viewer text; `Super-G/W` clear or push marked text. |
| Converse/Notifications | Inherits horizontal scroll, displayed-string search, and marked-text commands from Dynamic Windows. |
| NSage Document Examiner | Installs documentation for `Super-S/R/G/W` compatible with that substrate. |
| Macsyma 421 | Compiled gesture records map `Super-Left` to open/reveal and `Super-Right` to close/elide an expression. |
| Joshua Zmacs mode | `Super-Meta-D` shows rule documentation. |
| Joshua Metering | `Super-Control-Left` is a match-tree-node presentation gesture; its exact operation remains bounded by the Joshua dossier. |
| CLIM tutorial/presentation demos | `Super-Middle` describes a presentation where the Genera port exposes the standard semantic gesture. |
| Presentation Inspector | Reached from the `Super-Right` Presentation Debugging menu rather than owning a separate direct chord. |

Macsyma's entries are compiled-gesture evidence, not readable 421 source. Joshua,
CLIM, and optional products can be absent from the base world even though their
media/source records exist.

## Network terminals and normalized dispatch

Genera's selected Telnet/ITP filters do not encode Super. Select dispatch also
normalizes it to the base suffix. These are intentional negative mappings, not
missing catalog entries.

## Interpretation

Genera's most coherent Super idea is “operate on what the display means or how it
is displayed”: presentations, marked screen regions, horizontal view position, or
structural document/drawing objects. Applications are still free to repurpose it,
as the debugger, Macintosh bridge, numeric reader, and specialized engineering
tools demonstrate.

## Sources and verification

- Genera 8.5 selected source files including `zwei/comtab.lisp.~589~`,
  `cp/substrate-commands.lisp.~6~`, `dynamic-windows/dynamic-input.lisp.~498~`,
  `dynamic-windows/dynamic-window.lisp.~625~`, `debugger/debugger.lisp.~784~`,
  `concordia/comtab.lisp.~52~`, Compare/Merge/VC, Metering, NSage, and embedding
  modules. Licensed source remains untracked.
- [Genera Zmacs keybindings](zmacs-keybindings.md).
- [Dynamic Windows reimplementation specification](dynamic-windows-reimplementation-specification.md).
- The application dossiers linked from each section above.

Last verified: 2026-07-26.

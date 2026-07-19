---
type: Museum Guide
title: CLIM 2 on Symbolics Genera
description: A manual-, declaration-, media-, Help-, and runtime-grounded study of the portable Common Lisp Interface Manager, its Genera, CLX, and PostScript ports, architecture, complete facility map, default Genera gestures, and preservation boundary.
tags: [genera, clim, clim-2, user-interface, presentations, silica, common-lisp]
timestamp: 2026-07-18T13:59:33-04:00
---

# CLIM 2 on Symbolics Genera

CLIM 2 is an optional, portable, CLOS-based user-interface management system and
toolkit delivered for Genera. It is not another name for Dynamic Windows, not the
underlying Genera window system, and not loaded in the museum's preserved base
world. The release supplies a portable CLIM core, the Silica sheet/window substrate,
a native Genera port, an explicitly unsupported sample CLX port, a PostScript port,
documentation, and demonstrations. Applications can coexist with Dynamic Windows
applications in one Genera world, but the contemporary manual says there is no
direct compatibility and no mixed programming model between the two APIs.

The media inspected here contains CLIM family patch directories released at version
72 and 125 compiled implementation modules totaling 2,634,250 bytes. It does **not**
contain the corresponding portable implementation source beside the six inspected
implementation directories: the implementation bodies are `.vbin` files, while
readable Lisp there is limited to the main declaration and the three port
declarations. Tutorial, demo, conversion, and patch files elsewhere are separate
evidence, not the missing core bodies. That boundary matters.
This dossier can establish the product architecture, documented behavior, declared
modules, port composition, installed documentation, patch lineage, and saved-world
load state; it cannot pretend to have reviewed absent function bodies.

This article is complete at the **CLIM 2 facility-family, declared-module, Genera
integration, and default-interaction grain**. It covers every major CLIM II facility
family, all 106 core compiled modules by declared group, all 19 port modules, all
documented Genera default gestures and 36 input-editor commands, the 16 release-note
feature additions and 19 named fix families, and every CLIM family installed in the
release inventory. [CLIM demonstrations and tutorial programs](clim-demonstrations-and-tutorial.md)
are D59: they are not silently counted as features of the core product.
The companion [sixty-dossier CLIM-use audit](clim-use-across-lisp-machine-software.md)
then follows this boundary across the complete CADR and Genera application catalog.

## Evidence and rights boundary

| Evidence | Boundary | What it establishes |
| --- | --- | --- |
| Symbolics CLIM Release 2.0 manual | Contemporary Genera 8.3-era user and programmer documentation | Product model, Dynamic Windows comparison, APIs, application construction, panes, gadgets, presentations, drawing, input, commands, ports, and complete default Genera key table |
| CLIM 2.0 release notes | Contemporary installation and compatibility guide | Load order, product roster, new features, named fixes, CLIM 1.1 incompatibilities, and Genera-specific limitations |
| Licensed Genera 8.5 declarations and patch directories | Installed System 452.22 archive | Exact module graph, implementation/port split, conditional features, compiled-only boundary, and media patch versions |
| Recovered licensed Help catalog | 34 `doc/clim/` SAB files represented only by metadata here | Presence and division of installed on-line documentation without republishing its prose |
| Fresh isolated Genera 8.5 runtime | `d28-d29-ui-clim-20260718`, generation 3 | Absence of CLIM system registration, package, and feature in the preserved base world |
| CLIM II specification | Portable protocol boundary | Cross-check that the facility map includes the protocol layers as well as high-level application conveniences |

The Genera source declarations, compiled objects, recovered Help, raw runtime
screens, and world remain licensed local inputs. This page records names, counts,
hashes, short interface facts, and original analysis. It does not reproduce source,
compiled content, Help prose, or manual pages. No CLIM application screenshot is
published because no CLIM frame was available in the saved world; a generic Listener
showing `NIL` would add no distinctive visual-interface evidence.

## Product identity and historical position

CLIM expands to **Common Lisp Interface Manager**. Release 2.0 describes itself as a
portable high-level toolkit for Common Lisp developers, built around four connected
ideas:

1. a portable abstraction over host window systems and toolkits;
2. typed presentations that keep application objects linked to displayed objects;
3. high-level output, graphics, input, command, and application-frame facilities;
4. exposed CLOS protocols that ports and advanced applications can extend.

The manual names portability, host look-and-feel, presentations, formatted output,
graphics, windowing, typed commands, and application-building as the central value.
It also sets two important negative boundaries. CLIM 2 supplies neither a high-level
interface builder nor a general high-level graphical or text-editing substrate, and
it is not intended as the rendering engine for high-performance paint, animation,
or video work. An application could use CLIM for its surrounding interface while a
lower-level facility owns a demanding canvas.

### Dynamic Windows relationship

Dynamic Windows and CLIM share a semantic presentation philosophy, a broadly similar
graphics model, program/application frames, command processing, completion, and
context-sensitive help. The manual nevertheless distinguishes their architectures:

| Question | Dynamic Windows | CLIM 2 |
| --- | --- | --- |
| Portability | Genera-specific | Designed to span Common Lisp implementations and host window systems |
| Window role | Both Genera window system facilities and UIMS | An abstract window/UIMS layer over a host window system |
| Extension model | Broad Genera interface, including window flavors/messages | CLOS API plus exposed class protocols |
| Presentation lattice | Can be computed at runtime | Fixed at load time, like a CLOS class lattice |
| Character styles | Characters, strings, and displayed text may carry style | Style belongs to displayed text |
| Input editor | Full Genera input editor | Deliberately simplified portable editor |
| Coexistence | Remains supported in Genera | Can run in the same world |
| Direct interoperability | None promised | No mixed DW/CLIM programming approach |

The manual says Genera applications need not be converted merely because CLIM exists.
Portability or use of CLIM's higher-level facilities are reasons to convert; TV-era
programs often require redesign because their low-level event and window-flavor
architecture has no mechanical CLIM analogue. The separate
[Dynamic Windows dossier](dynamic-windows-and-presentation-based-interaction.md)
documents the native Genera lineage.

## Installation, system families, and load state

### Documented installation sequence

CLIM 2.0 was distributed with Genera 8.3. The release notes require a world without
CLIM 1.0 or 1.1 already loaded; CLIM 2 cannot be overlaid on those releases. The
documented sequence is:

1. restore `CLIM`, `Genera-CLIM`, and any desired `CLX-CLIM`, `PostScript-CLIM`,
   and `CLIM-Demo` systems from distribution media;
2. load `CLIM` first;
3. load `Genera-CLIM` for the native port;
4. optionally load the CLX, PostScript, and demo systems; and
5. save a new world if CLIM should survive reboot.

`CLIM-Doc` supplies the installed documentation family. The six release families
therefore have distinct jobs:

| System | Role | Required or optional relationship |
| --- | --- | --- |
| `CLIM` | Portable utilities, Silica, and standalone CLIM implementation | Foundation; load first |
| `Genera-CLIM` | Native Genera port and activity/window integration | Normal Genera display port |
| `CLX-CLIM` | CLX/X port | Optional, and documented as an unsupported sample port on Genera |
| `PostScript-CLIM` | Hardcopy/output port with printer metrics | Optional |
| `CLIM-Doc` | Document Examiner/Help payload | Documentation, not implementation |
| `CLIM-Demo` | Tutorial and demonstration applications | Optional; analyzed in D59 |

### Media versions are not one number

Two installed records describe different release moments:

- `sys.sct/sct/system-info.lisp.~206~` lists all six VLM CLIM families at version
  64.0. The adjacent 8.3 VBin declaration repeats that baseline.
- Each inspected CLIM-family patch system directory says `:RELEASED 72 :LATEST 72`.

This is not evidence that the binaries are simultaneously version 64 and 72. The
system-info roster is a baseline/release inventory; the patch directories describe
the later media patch lineage. The museum reports both and does not overwrite the
older roster with the newest patch-directory number.

### What the fresh world actually contains

The preserved `Genera-8-5.vlod` did not have CLIM loaded or registered. Two read-only
Listener queries produced these results:

- scanning `SCT::*ALL-SYSTEMS*` for names containing `CLIM` returned `NIL`;
- `(LIST (FIND-PACKAGE "CLIM") (MEMBER :CLIM *FEATURES*))` returned `(NIL NIL)`.

The declaration itself pushes `:CLIM`, `:CLIM-2`, `:CLIM-2.0`, and `:SILICA` when
loaded, so the absent package and features independently support the conclusion.
No `Load System CLIM` attempt was made: the isolated museum session has no
guest-visible host file service, and optional-system loading through `SYS:` would
either block or test site configuration rather than CLIM behavior. A runnable CLIM
frame therefore remains `runtime-blocked`, not inferred from media presence.

## Declared architecture

The main declaration divides the implementation into three portable systems. Port
declarations then connect that core to a display or output device:

```text
CLIM-UTILS
  -> CLIM-SILICA
       -> CLIM-STANDALONE
            -> GENERA-CLIM
            -> CLX-CLIM
            -> POSTSCRIPT-CLIM
```

This graph is more accurate than treating `CLIM` as one file or `Genera-CLIM` as the
whole product.

### `CLIM-UTILS`: portability and mathematical substrate

The 23 compiled utility modules normalize Lisp, CLOS, conditions, streams, processes,
queues, timers, protocols, transformations, regions, and designs across supported
implementations. Declared groups are:

| Group | Representative declared modules | Responsibility |
| --- | --- | --- |
| Lisp environment | package fixups, packages, reader, definition utilities, CLOS patches | A predictable Common Lisp/CLOS substrate |
| General utilities | utilities, processes, queues, timers, protocols | Portable runtime services |
| Streams | CLIM streams plus implementation-specific stream adapters | A Gray-stream-style model over vendor differences |
| Geometry/design | transformations, regions, region arithmetic, extended regions, base designs, designs | Coordinate, clipping, and ink/design foundation |

The declaration says CLIM follows the Gray stream proposal's split between ordinary
stream entry points and generic stream methods. Conditional features decide whether
CLIM supplies stream classes, trampoline functions, or vendor adapters. Genera uses
its own stream adapter and existing stream functions.

### `CLIM-SILICA`: sheets, ports, media, and gadgets

Silica has 23 compiled modules. Its first layer declares macros, classes, text
styles, sheets, mirrors, events, ports, media, frame managers, graphics, and pixmaps.
Its second layer—called Windshield/Dashboard in comments—implements portable layout
and physical gadgets: boxes, tables, borders, scroll panes, buttons, sliders, and
other standard sheets. Standard sheets and image support complete the declared set.

Silica terminology separates concerns:

| Object | Role |
| --- | --- |
| Sheet | Node in the CLIM window hierarchy; receives events and participates in layout |
| Port | Connection between CLIM and a host display/window system |
| Graft | Root sheet representing a host display surface |
| Mirror | Host-system resource corresponding to a mirrored sheet |
| Medium | Drawing state and operations for a sheet or output target |
| Frame manager | Policy and service layer that adopts/manages application frames |
| Pane/gadget | Application-visible sheet with layout, stream, or control behavior |

### `CLIM-STANDALONE`: the application-facing system

The standalone layer contains 60 compiled modules. All declared groups are included
below; this is the core module inventory at a useful museum grain:

| Declared group | Modules or facilities |
| --- | --- |
| Basic tools | gestures, protocol definition, stream protocols, resources, temporary strings, base CLIM definitions, stipples |
| Protocol definitions | stream classes, interactive definitions, cursor, views, input/output protocols |
| Output recording | record definitions/protocol, text, graphics, and design records |
| Input editing | interactive protocol and input-editor commands |
| Incremental redisplay | updating-output and redisplay support |
| Window streams | coordinate-sorted set, R-tree, window streams, pixmap streams |
| Presentations | type layers, completion, presentation records, translators, histories, standard types |
| Formatted output | tables, graphs, surrounding borders, text formatting |
| Pointer interaction | pointer tracking and dragging output |
| Gadget integration | gadget streams and gadget output |
| Application construction | accept/present, commands and processor, translators, frames, activities, menus/lists/text, progress notes, accepting values, drag-and-drop, item-list management |
| Bootstrap | stream trampolines and implementation prefill/epilog modules |

### Genera, CLX, and PostScript ports

| Port | Compiled modules | Declared composition | Evidence boundary |
| --- | ---: | --- | --- |
| Genera | 8 | package declaration, port, mirror, medium, pixmaps, frames, activities, prefill | Native Genera display and activity integration |
| CLX | 7 | package declaration, port, mirror, medium, pixmaps, frames, prefill | X/CLX sample port; contemporary manual says unsupported on Genera |
| PostScript | 4 | package declaration, port, medium, LaserWriter metrics | Output port, not an interactive window system |

The main declaration also contains Allegro-only Xlib, Motif, and OpenLook toolkit
systems. They are conditional and include explicitly ignored source paths; they are
not Genera toolkit implementations. Genera instead uses CLIM's portable gadgets.

## Complete facility map

The following table accounts for the full CLIM II conceptual surface rather than
reducing the product to widgets or presentations:

| Facility family | What CLIM supplies | Main declared layer |
| --- | --- | --- |
| Conventions and protocols | packages, names, generic-function protocols, argument conventions, implementation portability | Utilities and protocol definitions |
| Coordinates and geometry | points, bounding rectangles, transformations, regions, intersections/unions, clipping | Utilities |
| Sheets and events | sheet hierarchy, parenting, enabling, allocation, event delivery, repaint, pointer focus | Silica |
| Ports, grafts, mirrors, media | host-system connection, root display, host resources, drawing state | Silica and ports |
| Frame managers | adoption, placement, layout negotiation, dialogs and application-frame policy | Silica |
| Drawing | points, lines, polygons, rectangles, ellipses, paths/arcs, text, clipping and transformations | Silica medium/graphics |
| Designs, inks, and color | foreground/background/flipping inks, colors, opacity, patterns, composites, contrast | Utilities and Silica |
| Line and text styles | thickness, dashes, joints/caps; family, face, size and host mappings | Silica and standalone output |
| Extended streams | cursor/pointer state, end-of-line/page policy, drawing and recording streams | Utilities and standalone |
| Output records | recorded text/graphics/design output, hierarchy, replay, hit testing and spatial indexes | Standalone |
| Formatted output | tables, item lists, graphs, filling/indenting, borders and surrounding output | Standalone |
| Incremental redisplay | cache/update records, identifiers, comparison, selective repaint | Standalone |
| Input editing | editable input buffer, rescanning, typeout coordination, histories and kill ring | Standalone |
| Gestures and pointer tracking | portable keyboard/pointer gesture names, modifier state, tracking loops, dragging | Standalone |
| Presentations | type lattice, views, typed output/input, records, context matching and highlighting | Standalone |
| Translators | presentation-to-object, command, and drag-and-drop translation with tests/priorities | Standalone |
| Completion and accepting | type-directed parsing, completion, possibilities, prompts, defaults, accepting-values dialogs | Standalone |
| Commands | command objects, tables, inheritance, menus, keystrokes, parsing and execution | Standalone |
| Application frames | stateful CLOS frames, panes, layouts, top levels, redisplay and command loops | Standalone plus port |
| Panes and gadgets | application/interactor/accept-values streams; layout panes; buttons, toggles, radio/check boxes, sliders, scroll bars, lists, options and text editing | Silica and standalone |
| Menus and dialogs | textual/gadget views, menu choosing, notifications, accepting values | Standalone and frame manager |
| CLIM-SYS | portable multiprocessing and locks | Utilities |
| Hardcopy and pixmaps | pixmap streams/copying, bitmap input, PostScript medium and font metrics | Silica, standalone, PostScript port |

### Presentation-based interaction

CLIM keeps application objects linked to their text or graphical display records.
An input context asks for a presentation type. CLIM can then recognize eligible
displayed objects, highlight them, translate them to another object or a command,
or accept typed input through the same type. Views let one type have textual,
dialog, menu, or gadget presentations. The type lattice is fixed at load time; type
methods and translators specialize through CLOS-like inheritance.

This is semantic interaction rather than an active-region-only model. It also is
not identical to a widget callback: a presentation may be any recorded application
output, nested within other presentations and reusable in multiple contexts.

### Output, spatial lookup, and redisplay

Output-record streams retain a hierarchy of recorded text, graphics, and designs.
The declaration's coordinate-sorted set and R-tree modules reveal that visible
record lookup is a spatial problem, not a linear repaint transcript. Formatted tables,
graphs, text, and borders build output-record structure. Incremental redisplay then
uses update records and application-supplied identities/state to decide which regions
can be retained, moved, or repainted.

The release notes name fixes to clipping, overlapping records, tables, graph output,
multiline highlighting, and design reconstruction. These are evidence that recording,
hit testing, layout, and redisplay interact; a screenshot of final pixels cannot by
itself establish the retained record structure.

### Commands and application frames

`DEFINE-APPLICATION-FRAME` defines a CLOS frame with application state, panes,
layouts, command tables, a top-level loop, and display functions. The ordinary
programmatic path is `MAKE-APPLICATION-FRAME` followed by
`RUN-FRAME-TOP-LEVEL`; `FIND-APPLICATION-FRAME` can combine creation, activation,
process choice, and port/frame-manager selection.

On Genera, `DEFINE-GENERA-APPLICATION` registers a frame with Select Activity and
can assign a Select key, pretty name, geometry, and size. It is a Genera-only
integration form, not part of a portable application's core definition. CLIM-created
application frames appear in Genera's System Menu under their application names.

Standard pane families include application, interactor, command-menu, pointer
documentation, accepting-values, title/status, layout, scrolling, and portable
gadgets. Applications may use textual or gadget views. The release notes emphasize
that Genera has portable CLIM gadgets rather than a Motif binding.

## CLIM 2.0 additions and fixes

### Sixteen named feature additions

| Addition | Result |
| --- | --- |
| Window/event model | Portable sheet/event management and adaptation to host toolkits |
| Portable gadgets on Genera | Scroll bars, buttons, toggles, radio/check boxes, pull-down menus, sliders, text editors, list and option panes |
| Gadget/Accepting Values integration | Typed dialogs can use gadget views |
| Completion customization | Completion presentation types gain printer and highlighter options |
| Multiple-object drawing | Batched line, rectangle, and related drawing operations |
| Pixmaps | Off-screen output plus area copying for reusable display content |
| X11 bitmap input | Bitmap files can become CLIM patterns |
| Richer input editor | The 36-command Genera table below |
| Pointer cursor control | Cursor can be set on a pointer or associated with a sheet |
| Inherited command menus | Superior command-table menu items can flow into subordinates |
| Keyword-default Help | Command reading can expose current keyword defaults |
| Portable gesture syntax | Key names and modifiers are represented independently of host character encodings |
| Drag-and-drop translators | A dedicated translator definition form |
| Border drawing options | Surrounding-output borders accept drawing options |
| Graph formatting | Expanded graph-layout behavior |
| CLIM-SYS and demos | Portable system utilities plus new teaching applications; demos remain D59 |

### Nineteen named fix or enhancement families

The release notes separately identify 19 changes: string accept/present conversion;
sensitive inferiors; multiline highlighting; completion over union types;
parameterized identity translators; clipping regions; input-buffer clear-and-click;
input-editor typeout placement; dialog Help windows; automatic argument delimiters;
faster text and diacritics; partially improved coordinate-sorted sets; incremental
redisplay for tables, graphs, and overlap; faster filling output; button-up handling
in pointer tracking; repeated-border alignment; design reconstruction from records;
Genera Suspend/Meta-Suspend behavior; and PostScript font metrics. “Partially
improved” is retained for coordinate-sorted sets because the release notes explicitly
do not claim a complete fix.

## Complete default Genera interaction inventory

This inventory is for CLIM 2's default input editor and command/accepting surfaces on
Genera. Application command tables may add, remove, or shadow bindings. Host-key
translations in the museum harness are not rewritten as Symbolics keyboard facts.

### Activation, completion, and command entry

| Interaction | Default Genera gesture | Meaning |
| --- | --- | --- |
| Activate input | Return/Newline; End | Finish the current accepted input sentence |
| Abort input | Abort | Invoke the abort restart caught by the default frame top level |
| Complete | Tab; Complete | Extend partial type-directed input as far as possible |
| Show possibilities | Control-?; Help; pointer Right | Display or menu the possible completions |
| Dispatch a command in command-or-form input | Colon | Treat following input as a command rather than a Lisp form |
| Complete/terminate command name | Space | End the command-name field |
| Terminate command argument | Space | Move to the next argument field |
| Preview command as a dialog | Meta-Complete | Enter the command through a dialog rather than the ordinary line |

There is no global delimiter gesture for all types. Recursive `ACCEPT` methods choose
their own delimiters; Space is the command processor's default. Numeric arguments to
editor commands use digits or minus with Control, Meta, Super, or Hyper.

### All 36 built-in input-editor commands on Genera

| Command | Genera key |
| --- | --- |
| Forward character | Control-F |
| Forward word | Meta-F |
| Forward s-expression | Control-Meta-F |
| Backward character | Control-B |
| Backward word | Meta-B |
| Backward s-expression | Control-Meta-B |
| Beginning of line | Control-A |
| End of line | Control-E |
| Next line | Control-N |
| Previous line | Control-P |
| Beginning of buffer | Meta-`<` |
| End of buffer | Meta-`>` |
| Delete character | Control-D |
| Delete word | Meta-D |
| Delete s-expression | Control-Meta-D |
| Rubout character | Rubout |
| Rubout word | Meta-Rubout |
| Rubout s-expression | Control-Meta-Rubout |
| Kill line | Control-K |
| Clear all input | Clear Input |
| Insert new line | Control-O |
| Insert parentheses | Control-`(` |
| Transpose characters | Control-T |
| Transpose words | Meta-T |
| Transpose s-expressions | Control-Meta-T |
| Upcase word | Meta-U |
| Downcase word | Meta-L |
| Capitalize word | Meta-C |
| Show argument list | Control-Shift-A |
| Show variable value | Control-Shift-V |
| Show documentation string | Control-Shift-D |
| Yank from kill ring | Control-Y |
| Yank from history | Control-Meta-Y |
| Yank next thing | Meta-Y |
| Scroll forward | Control-V or Scroll |
| Scroll backward | Meta-V or Meta-Scroll |

### Dialogs and menus

| Surface | Command | Genera key |
| --- | --- | --- |
| Accepting Values dialog | Abort dialog | Abort |
| Accepting Values dialog | Exit, when not editing a field | End |
| Menu | Special menu-only keyboard command | None in this release |

The absence of special menu commands does not mean menus are pointer-only in every
application: command tables and accelerators can still bind application commands.
It means CLIM 2's default menu surface adds no separate universal key set.

## Genera port behavior and limitations

### Debugger placement

The Genera Debugger cannot render itself inside a full-screen CLIM window. An error
there produces a notification; the developer selects a Listener to use the Debugger,
then reselects the application—through its window, activity, System Menu entry, or
Select key—after arranging a suitable restart. This is a port/UI boundary, not a
claim that CLIM has its own independent debugger.

### Color

On a two-headed Genera system, an application explicitly finds the color screen,
creates a CLIM port for that server path, and supplies the port when constructing the
frame. On native-color Ivory platforms, the port detects color support without that
special selection. The current museum VLM display is monochrome, so neither path was
runtime-verified here.

### CLX and PostScript

`CLX-CLIM` is present but the manual calls it an unsupported sample port for people
studying how to implement a port. That warning prevents “included” from being
rewritten as “supported production X client.” `PostScript-CLIM` is an output port
with its own medium and LaserWriter metrics; release notes report corrected font
metrics, but no configured printer or output comparison was exercised.

## CLIM 1.1 to CLIM 2.0 compatibility boundary

The release notes contain 73 incompatible-change bullets. They cover these complete
families:

| Family | Nature of change |
| --- | --- |
| Frames and layouts | New pane/layout clauses, setters replacing removed functions, sheet terminology, keyword-aware top levels |
| Ports and windows | Root-window removal, port discovery, window-to-sheet naming, placement and viewport names |
| Presentations and views | Required arguments, generic-function call split, textual view names, translator/context argument changes |
| Color, graphics, and text | ink/color constructor names, text replacing character/string drawing, pattern drawing, style mappings and argument order |
| Streams, cursors, and pointers | Removal of star-suffixed position names, setter naming, spacing, end-action argument order, pointer/event terminology |
| Formatted output and menus | spacing/minimum option names, recording option names, menu/table/item-list keyword changes |
| Commands | enablement protocol, command-table test removal, command-reader keystroke-test removal, inherited menu behavior |
| Output records and redisplay | child/count/map/replay/history/add/delete names, position terminology, redisplay and drag names |
| Gestures and input editing | portable gesture syntax, activation/delimiter renaming, global gesture variables, scan/insertion pointer names |
| Geometry and transformations | position terminology, required bounding arguments, and renamed composition/transform operations |

This table is complete at incompatible-change-family grain, not a substitute for the
73-symbol migration checklist. The release directs users to the Zmacs Conversion
Tools' CLIM 1.1-to-2.0 converter. The installed licensed converter source further
shows that conversion is conditional and sometimes lossy: it warns about unsupported
options and cases where layout, presentation, text-style, or command semantics lack
an exact equivalent. Those comments are implementation evidence against describing
conversion as a source-to-source proof of behavioral identity.

## Source, manual, Help, and runtime findings

### Findings established across layers

- CLIM is optional and layered; the portable core, native port, output ports,
  documentation, and demos are separate systems.
- The native integration is through a Genera port and activity registration, not by
  renaming Dynamic Windows.
- Presentations, command tables, output records, formatted output, incremental
  redisplay, application frames, panes, and gadgets form one connected architecture.
- The saved museum world lacks the package/features that the declaration installs,
  so media presence does not establish live availability.

### Declaration/media findings the manual does not make obvious

- The 106 core compiled modules divide exactly into 23 utilities, 23 Silica modules,
  and 60 standalone modules; the three ports add 19 more.
- The inspected media exposes declaration source but only compiled implementation
  bodies. This prevents a function-body audit even though the module architecture is
  unusually well preserved.
- The declaration conditionally extends CLOS presentation-type method inheritance on
  Genera and conditionally adapts vendor condition and stream facilities.
- Allegro-only Motif/OpenLook/Xlib declarations coexist in the portable declaration
  but are not Genera facilities; some are explicitly ignored source paths.
- The patch directories say released 72 while the VLM system-info roster says 64.
  These records describe different inventory/patch layers and must not be flattened.
- Recovered Help contains 34 CLIM SAB files, 1,297 records, and 2,545,599 source
  bytes across applications, geometry, color, commands, drawing, graphs/tables,
  redisplay, panes, presentations, regions, Silica, streams, toolkit use, tutorials,
  user guide, dictionary, glossary, release notes, and hardcopy. Those are local
  documentation-presence counts, not permission to publish the decoded text.

### Runtime record and screenshot decision

| Field | Result |
| --- | --- |
| Session | `d28-d29-ui-clim-20260718`, generation 3 |
| Window | `Genera on DIS-LOCAL-HOST`, 1200 by 900 |
| Isolation | Separate user, mount, network, PID, IPC, and hostname namespaces; no external route or guest-visible host file service |
| World | 54,804,480-byte `Genera-8-5.vlod`; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` before and after |
| Query result | No registered system name containing `CLIM`; no `CLIM` package; no `:CLIM` feature |
| Shutdown | Confirmation and cleanup progress observed; known cleanup stall required bounded forced stop; unsaved state discarded |
| Published screenshot | None; the two raw Listener status screens remain ignored |

The raw status screens are retained only as local provenance: `0010-clim-system-status-runtime.png`
is 11,748 bytes with PNG SHA-256
`50cfae39733ca7815ca0dd150aa1d659987ada8a2961f593610fe43dcab97b0c`
and normalized-pixel SHA-256
`82dca042cd4c94cc0560999ff96836a0aa6c571898387a68c73e6d6f6ef0d6e1`;
`0011-clim-package-feature-status.png` is 11,852 bytes with PNG SHA-256
`cc64888a59e7850ae526ca08cc17ba050d4d8832eb1b9df8d2a9a724e5abbccc`
and normalized-pixel SHA-256
`8de9dc9ccbb2da887f29f57cdeb265aac1a2517f29942d9efa6a3b85af4056bc`.
Neither image depicts CLIM, so neither passed the museum's usefulness threshold for
publication.

## Preservation and reproduction notes

- Keep the archive, `.vbin` modules, declarations, recovered Help, raw screenshots,
  and any future loaded world untracked.
- Treat the six CLIM systems separately in inventories. Restoring documentation or
  demos does not load the portable core or native port.
- A future runnable study should start from a fresh private world, restore/load CLIM
  into disposable state through a deliberately configured read-only media service,
  and never save over the base world.
- Record both the CLIM core and selected port version. A CLIM frame without a port
  is not a complete runtime configuration.
- Do not use modern McCLIM, LispWorks CLIM, or Allegro CLIM behavior as proof of a
  Genera 8.5 default. They implement related specifications on different substrates.
- Curate screenshots only when a real CLIM frame proves a facility that prose and
  declarations cannot; review each image separately and do not publish installed
  tutorial or Help text as a gallery.

## Open questions and deferred tests

- Configure a disposable, read-only guest file-service path and load `CLIM` followed
  by `Genera-CLIM` into unsaved state; verify exact loaded versions and features.
- Run a researcher-owned minimal frame that exercises application, interactor,
  command-menu, pointer-documentation, accepting-values, and portable gadget panes.
- Verify typed presentation selection, command preview, all default editor gestures,
  incremental redisplay, pointer tracking, and dialog abort against synthetic data.
- Compare native Genera and CLX port rendering only after a supported isolated X
  path exists; retain the contemporary unsupported-port warning.
- Render one synthetic page through `PostScript-CLIM` and compare geometry/font
  metrics without configuring a physical printer.
- Determine whether corresponding portable CLIM 2 source survives elsewhere with
  clear redistribution rights; the inspected archive's `.vbin` bodies are not a
  source release.

## Artifact identities

### Contemporary public manuals

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Common_Lisp_Interface_Manager__CLIM__Release_2.0.pdf` | 1,638,498 | `41f54457eceeb875a9f1f2a735b289fcbd4e9ad95dc6a844924192674e40598c` |
| `CLIM_2.0_Release_Notes_and_Installation_Guide.pdf` | 72,819 | `e4790963787a032ae6241f9475ae4dd9e3db5d20255366e1a78f3950faead1ec` |

### Licensed declarations and inventories

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `sys.sct/clim/rel-2/sys/sysdcl.lisp.~216~` | 21,137 | `6c3053a983262b527895f17abb72a6978fe13072cf445359d4a615fa2f9d2afa` |
| `sys.sct/clim/rel-2/genera/sysdcl.lisp.~10~` | 3,833 | `df10180278f2d9fe2da608460a1c9c87d5d4b86a1639900e2ff86a7a17dbf780` |
| `sys.sct/clim/rel-2/clx/sysdcl.lisp.~11~` | 4,430 | `3fa2a9c6be50d609f7fe5702a50644529809d5e5a7f03c206c0ceedd216161ac` |
| `sys.sct/clim/rel-2/postscript/sysdcl.lisp.~11~` | 3,826 | `946b986c235687541d014d5d0e6d167024287e77273cbd5c26ed6e0c89f8bafc` |
| `sys.sct/sct/system-info.lisp.~206~` | 85,747 | `8f3196dbadb0c6eb77c35e148aa8618fd05a6cd36b2e68bbe671c0dcd4f95607` |
| `sys.sct/patch/define-vbin-for-8-3.lisp.~1~` | 5,722 | `a74678bfc71a58ff125d551613f85c7755b9e2004588df6a2a47ebffc04c4a50` |
| Ignored recovered-Help `catalog.json` | 577,696 | `a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed` |

### Compiled module census

| Directory/system layer | `.vbin` modules | Aggregate bytes |
| --- | ---: | ---: |
| `utils` / `CLIM-UTILS` | 23 | 367,266 |
| `silica` / `CLIM-SILICA` | 23 | 430,826 |
| `clim` / `CLIM-STANDALONE` | 60 | 1,475,222 |
| `genera` / `Genera-CLIM` | 8 | 151,190 |
| `clx` / `CLX-CLIM` | 7 | 108,208 |
| `postscript` / `PostScript-CLIM` | 4 | 101,538 |
| **Total** | **125** | **2,634,250** |

The counts select versioned `.vbin` files directly within each named directory. They
do not count declarations, patch metadata, documentation, tutorial code, demos, or
tests as implementation modules.

## Sources

- Symbolics, [*Common Lisp Interface Manager (CLIM), Release 2.0*](https://bitsavers.org/pdf/symbolics/software/genera_8/Common_Lisp_Interface_Manager__CLIM__Release_2.0.pdf),
  for the product model, Dynamic Windows comparison, API families, Genera port,
  application construction, and complete default interaction table.
- Symbolics, [*CLIM 2.0 Release Notes and Installation Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/CLIM_2.0_Release_Notes_and_Installation_Guide.pdf),
  for installation order, new features, fixes, compatibility changes, and port notes.
- [CLIM II Specification](https://dept-info.labri.fr/~strandh/Teaching/PFS/Common/CLIM-spec/cover.html),
  for the portable protocol/facility boundary; consulted as a specification map, not
  as evidence for Genera-specific defaults.
- Licensed local Genera 8.5 declarations, compiled-module inventory, patch metadata,
  recovered Help catalog, and isolated runtime session identified above; inspected
  2026-07-18.

Last verified: 2026-07-18.

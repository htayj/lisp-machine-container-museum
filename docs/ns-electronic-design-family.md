---
type: Artifact Analysis
title: The NS electronic-design family
description: An evidence-graded study of Basic-NS, Schematic-NS, Gate-Array-NS, PCB-NS, and VLSI-NS, including their shared editor, commands, gestures, workflows, simulators, formats, and preservation limits.
tags: [genera, ns, electronic-design, schematic, simulation, pcb, vlsi, gate-array, preservation]
timestamp: 2026-07-18T11:12:52-04:00
---

# The NS electronic-design family

## Conclusion

The five preserved NS systems form one integrated electronic-design environment,
not five unrelated applications. `Basic-NS` supplies a graphical, hierarchical
editor built around libraries, modules, aspects, diagrams, buffers, and one or two
views. `Schematic-NS` adds schematics, icon construction, network extraction,
electrical-rule checking, switch-level simulation, waveform plots, and timing
analysis. `Gate-Array-NS` adds gate-array technologies, utilization counting, and
statistical wire-capacitance annotation. `PCB-NS` adds packaging, pinout and
electrical aspects, board-level simulation, PC-layout editing, ratsnests, gate and
pin swapping, production reports, and SCICARDS/Cadnetix interchange. `VLSI-NS` adds
transistor-level schematic primitives, virtual-grid and mask layout, floorplanning,
compaction, pitch matching, network comparison, transistor checks, power analysis,
and SPICE integration.

The user interface is an older Dynamic Windows/TV and New Flavors application, not
a CLIM program. The same `NS` frame changes mode and aspect as the user moves from a
schematic to simulation, board layout, virtual-grid layout, mask layout, or a
floorplan. Its compiled definitions preserve an unusually detailed interaction
surface: a Select key, one- and two-view configurations, command menus, a Lisp
interactor, a live modifier-key legend, and mode-specific three-button mouse
bindings.

The expansion of **NS** is not established by the inspected primary evidence. The
1987 implementation paper and the shipped systems consistently call the environment
“NS” without defining the initials. Suggestions such as “New Schematic” must remain
a **TODO**, not be promoted from secondary repetition into fact.

The inspected release is proprietary compiled media. Its five declarations mark
version 36 as released and request binary distribution without source distribution.
All 104 base implementation files are 16-bit L-BIN format-5 loader programs. A
read-only parser reconstructed their load-time data without evaluating code, and the
results below are original analysis rather than redistributed implementation text.
The separately named documentation, tutorial, routers, DRC, SPICE, Compose, HP, and
Timberwolf systems named by the distribution manifest are not present in this media
boundary.

No NS frame was launched for this article. The clean Genera world has not been shown
to have these contributed systems registered or loaded, `Basic-NS` contains explicit
password-protection machinery, and loading proprietary compiled objects was outside
this bounded audit. A fresh read-only probe was attempted, but its sandbox failed
before the VLM executed; it therefore says nothing about guest registration.
Consequently no runtime screenshot is published and no source-visible menu is
represented as having been exercised. Reaching a licensed NS world through the
Genera harness is a future preservation task.

## Scope and evidence notation

This page keeps five evidence classes separate:

- **Licensed declaration** means the plain Lisp system declarations and the
  system, component, and patch records in the locally purchased Open Genera media.
- **Compiled evidence** means inert decoding of the local `.vbin` loader programs.
  Names, literal parameters, definitions, menu structures, and load-time forms were
  inspected without evaluating them in Genera.
- **Paper** means Neil Weste and colleagues' contemporary paper,
  [“The Symbolics Ivory Design and Verification Strategy”](https://www.bitsavers.org/pdf/symbolics/I_Machine/Ivory_Design_Verification_198707.pdf),
  *Proceedings of the 1987 IEEE International Conference on Computer Design*, pages
  506–511.
- **Public source** means the MIT System 46 Git snapshot or the maintained LM-3
  System 303 Fossil tree, pinned below. Those trees are comparison witnesses, not
  source for Symbolics NS.
- **Runtime observation** is deliberately absent. Details that need a loaded NS
  world are marked `TODO`.

“Complete command inventory” below means every NS-specific command registered in the
shared `NS` command table by the 104 inspected base VBins. It excludes inherited
Genera commands, site patches, separately distributed systems, and commands which
could be created only after loading user libraries. “Complete gesture inventory”
means every binding in the eight mode tables, the common view and edit tables, and
their temporary tracking submodes. It does not claim an effective runtime keymap in
an unloaded world.

The resulting command census is 104 `NS`-table registrations: 36 from Basic, 19 from
Schematic, one from Gate Array, 30 from PCB, and 18 from VLSI. Basic also registers
the NS-specific `Install NS Password` in the global command table; it is listed but
not added to the 104. A generic global `Set Command Table` helper is not counted as
an NS product command. Separately, 29 named menu-action registrations and all pointer
tables are inventoried below.

## Release identity and media boundary

All five system directories advertise released and latest system version 36. Patch
directories supply the more specific version pairs shown below. The installed
component records were written either in a 1997 Genera 8.0 VLM build environment or
a 1998 Open Genera 2.0 / Genera 8.5 environment; that write date is not the design
date of NS. The patch histories reach back to 1990–1992 release worlds and describe
an environment already used on 3600-family, XL, NXP, MacIvory, and X displays.

The final column is SHA-256 of a deterministic stream containing every file's
relative pathname and SHA-256 within that one system directory. It identifies the
exact local evidence set without publishing its contents.

| System | Dependency | Base VBins | Patch VBins | Files / bytes | Released patch evidence | Evidence-set SHA-256 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `Basic-NS` | Genera, New Flavors, Common Lisp | 32 / 767,652 | 35 / 156,248 | 72 / 946,131 | 36.35 | `57107b3b58e441c5045f64788d464e237f940944c79941d9d29ddffc0506edaf` |
| `Schematic-NS` | `Basic-NS` | 15 / 547,358 | 7 / 14,518 | 27 / 577,732 | 36.7 | `2079ca934dfd3deede9435f14b5a5c7d79b6385999b66c19319e00c6281f1caa` |
| `Gate-Array-NS` | `Schematic-NS` | 4 / 36,068 | 0 | 8 / 42,490 | 36.0 | `0f013c98622769ed5ce436f2a35934f46dbb1fae8771368908327790b8d31905` |
| `PCB-NS` | `Schematic-NS` | 29 / 530,230 | 1 / 1,162 | 35 / 545,108 | 36.1 | `aabc7caa238982bd6604a00c4b36427973a772fc8145e844c142ddbf0373a97b` |
| `VLSI-NS` | `Schematic-NS` | 24 / 772,722 | 29 / 151,814 | 58 / 948,664 | 36.29 | `131b57afd6dbd6794ae02d8905237e995549f35db77604e1920a0c5cd2737c73` |

The dependency shape matters:

```text
Basic-NS
   |
   +-- Schematic-NS
          |
          +-- Gate-Array-NS
          +-- PCB-NS
          +-- VLSI-NS
```

`Gate-Array-NS`, `PCB-NS`, and `VLSI-NS` are peers above the schematic layer; PCB
does not depend on VLSI, and VLSI does not depend on PCB. Their code can nevertheless
recognize related aspects through the shared library/module/aspect model.

### What is and is not installed

The latest plain declarations identify these base implementation groups:

| System | Declared base modules |
| --- | --- |
| Basic | protection, definitions, transforms, color, basic frame, file support, library, attributes, modules, aspects, object primitives, geometry, diagrams, instances, quad trees, buffers, views, trackers, editing, debugging, hardcopy, technologies, initial modules, picture editing, Concordia integration, startup, conversion, and tests |
| Schematic | schematic editor, icon builder, extraction definitions and extractor, primitive icons, schematic ERC, functional models, RSIM, RSIM interface and plotter, UNIX-server and Mach1000 support, timing analyzer, integration, and tests |
| Gate Array | gate-array core, gate counting, statistical wire capacitance, and technology definitions |
| PCB | utilities, PCB support and libraries, power pins, physical attributes, aspect interface, extraction, board simulation, pinout, package assignment, SCICARDS and Cadnetix EDIF, EDIF parser, pinout editor, primitives, schematic/icon builders, electrical aspects, ERC, annotation, reports, part numbers, PC layout, ratsnest, swapping, back annotation, conversion, and final registration |
| VLSI | primitive icons, IC technologies, plotting, SPICE, virtual-grid primitives/editor/extractor, mask editor, layout language, two compactors and their interfaces, pitch matching, floorplanning, network comparison, transistor and mask ERC, place-and-route output reader, RSIM resistance, integration, SPICE delay paths, and tests |

The Basic declaration also lists a larger NS distribution: `ns-routers`, `spice`,
`drc`, `hp`, `timberwolf`, `compose`, `ns-doc`, `ns-tutorial`,
`lsi-logic-support`, `vlsi-hacks`, and several site/distribution files. Those names
prove that the full product family could be larger. They do **not** prove that the
missing systems are embedded in these five directories. A search of the purchased
release and the locally decoded Help corpus found no installed NS documentation or
tutorial payload at this boundary.

Four declarations also define separately issuable `*-sources` distribution recipes
which enumerate expected `.lisp` names. That does not turn those names into source
files in this release. The ordinary product systems set `distribute-sources` to
false and `distribute-binaries` to true, and the inspected directories contain VBins
instead. Basic's newer source recipe even names encrypted protection, basic-editor,
and file-support inputs. The safe conclusion is “a separate source-delivery path was
designed,” not “the purchased VBin set contains the source under another extension.”

`PCB-NS` also declares `symbolics-part-number-data.bin` in its source-distribution
list, but the binary is absent from the inspected directory. Code for the part-number
table remains, so the feature is present while the vendor data set is missing.

## How the compiled evidence was inspected

The base implementation is not a string archive or a serialized live world. Each
VBin begins with little-endian word `0xf013`: L-BIN format 5. Its contents are loader
instructions that reserve object-table entries and construct symbols, strings,
lists, arrays, definitions, and compiled functions when Genera loads the file.

The format was reconstructed from three licensed but untracked L-BIN implementation
files:

| Local media identity | Bytes | SHA-256 | Role in this audit |
| --- | ---: | --- | --- |
| `l-bin/defs.lisp.~97~` | 10,641 | `f1f25b75ec26e308fb4309f63620f7bd7d0ca598d0e05e73731cea7188ab61fd` | format numbers, command tags, storage classes |
| `l-bin/load.lisp.~310~` | 50,295 | `0edc78081aaebde6bbeef62096085ed87ae84f1f0ff017eae60893e4c1d48f3e` | loader semantics and table allocation |
| `l-bin/unbin.lisp.~85~` | 15,783 | `a56824c724fca243196c71de233df67ef1e0b6ad6f1705d6c60be5a4483f9158` | reference disassembler and object reconstruction |

The audit used a purpose-built in-memory parser which implemented the format-5
reservation rules and Ivory compiled-function framing. It consumed all 104 base
VBins through both logical and physical end-of-file. It did not intern symbols,
construct Genera objects, call compiled functions, or write decoded forms to the
repository. GNU binutils string extraction was used only as a cross-check.
The host-side verification tools were Python 3.14.6, GNU Binutils 2.46.1, Git
2.55.0, and Fossil 2.28.

This distinction is important. Genera's `UNBIN` is a loader-based inspection tool,
not a pure byte decoder: it can intern and construct live objects. The inert parser
is sufficient to recover declarative UI and architecture evidence, but it is not a
source-code recovery claim. Function bodies remain compiled instructions, original
comments and macro structure are absent, and a runtime-dependent branch cannot be
settled merely because its symbols occur in the VBin.

## What “NS” means

**Open question:** no inspected declaration, compiled documentation string, patch
record, or primary paper expands the name. The 1987 paper says that NS was written
in Common Lisp using New Flavors and then consistently calls it “NS.” “New Flavors”
is an implementation fact, not an acronym expansion.

Until a contemporary manual, title page, author statement, or source comment defines
the initials, the museum should write **NS**, `Basic-NS`, `Schematic-NS`, and so on,
without inventing a long form.

## The shared editor model

### Libraries, modules, aspects, and diagrams

The central hierarchy is:

1. a **library** owns named modules, library options, technology choices, generators,
   and persistent definitions;
2. a **module** is a reusable design unit;
3. an **aspect** is one representation of a module, such as its schematic, icon,
   functional behavior, pinout, PC layout, virtual grid, mask, or floorplan;
4. a **diagram** holds editable objects and instances for a graphical aspect;
5. a **buffer** adds mode, selection, prior-mode state, view state, damage tracking,
   highlights, and temporary interaction state;
6. one or two **views** display the same or different buffers at independent centers
   and scales.

This model explains why “edit the schematic” and “edit the mask” are not separate
launcher applications. They are aspect and mode changes within one editor. It also
allows comparison and cross-selection: two views can show corresponding logical and
physical representations while commands locate callers, signals, nodes, parts, or
physical supports.

The compiled media names the following representation surface:

| Representation | Purpose established by implementation |
| --- | --- |
| Picture | general structured diagram; also supports slides and simple charts |
| Schematic | connected electronic components and signals |
| Schematic-Icon | graphical icon used when a module is instantiated hierarchically |
| Functional-Model | Lisp/NS behavior substituted during extraction or simulation |
| Pin-Out | package sections, physical pins, common pins, NC pins, and swap sets |
| Electrical | electrical direction, current, logic-level, and loading attributes |
| PC-Layout | board outline, packages, layers, placement, and ratsnest relationships |
| Virtual-Grid | symbolic IC layout using grid logs, contacts, devices, terminals, and supports |
| Mask | physical IC geometry and layers in micron-oriented coordinates |
| Floor-Plan | slicing hierarchy, dividers, ports, and placement relationships |
| RSIM Plot | switch-level node-history waveform view |
| SPICE Plot | analog waveform view from SPICE output |

### Frame and entry point

**Compiled evidence:** loading Basic-NS registers Select-`S` (`ASCII 83`) as “NS”
and calls `SELECT-NS-FRAME`. The frame is a bordered constraint frame with a shared
I/O buffer. It has four compiled configurations:

| Frame | Configuration | Pane layout |
| --- | --- | --- |
| Main | One View | `VIEW1`, one-line `BUCKYS`, command `MENU`, ten-line `INTERACTOR` |
| Main | Two Views | side-by-side `VIEW1` and `VIEW2`, then `BUCKYS`, `MENU`, and `INTERACTOR` |
| Slave | One View | `VIEW1`, `BUCKYS`, `MENU`; no interactor |
| Slave | Two Views | side-by-side views, `BUCKYS`, `MENU`; no interactor |

The `BUCKYS` pane is not decorative. Mouse motion updates documentation for the
current modifier/button combination, making the dense chords discoverable. Basic-NS
patches specifically repaired its highlighting, warm-boot behavior, X modifier
handling, and mouse trackers on X displays. Other patches add initial color-X
support and controller-specific color paths. These records establish that the
interface evolved beyond a monochrome 3600-only prototype.

The interactor provides a Lisp command route beside pointing. The implementation
also defines Dynamic Windows presentation types for libraries, modules, aspects,
diagram instances, and related design objects. That makes typed object selection and
command argument completion part of the design, even though the frame predates CLIM.

### Menu button convention

Many NS menu items assign different meanings to the three buttons. The compiled
documentation strings explicitly use `[L]`, `[M]`, and `[R]`:

| Menu family | Left | Middle | Right |
| --- | --- | --- | --- |
| Draw Instance / Edit Aspect | accept by name or pointing | accessible-library menu | module menu |
| Previous Diagram | rotate forward | rotate backward | choose from menu |
| Rat's-nest | all nodes | selected nodes | submenu |
| Visible Layers | all | top | bottom |
| Compact | normal run | debug run | compactor tools/menu |

That pattern is a semantic part of the interface. A later runtime study should not
describe a menu item as a single action until all three button paths have been
checked.

### Complete compiled menu-action inventory

These 29 `NEW-MENU-COMMAND` registrations are distinct from the command-processor
commands inventoried later. `Other` and `Next` are generic possibility-menu actions;
the rest are named editor actions.

| Layer | Registered menu actions |
| --- | --- |
| Basic | `Other`; `Next`; `Windows`; `Profile`; `Mode`; `Draw Instance`; `Edit Aspect`; `Define`; `Previous Diagram`; `Edit Picture` |
| Schematic | `Edit Schematic`; `Edit Schematic-Icon` |
| Gate Array | `Edit Functional-Model` |
| PCB | `Build Schematic`; `Edit Pin-Out`; `Edit PC-Layout`; `Edit Electrical`; `Edit Functional-Model`; `Visible Layers`; `Build Icon`; `Create Ratsnest`; `Delete Ratsnest`; `Update Ratsnest` |
| VLSI | `Compact`; `Edit Floor-Plan`; `Edit Mask`; `Pitch Match`; `Edit Virtual-Grid`; `Guts` |

`Next` assigns left to next possibility, middle to previous, and right to a
possibility menu. `Define` saves current diagram changes to a copy. `Guts` toggles
all layout-cell interiors with left or right and one cell with middle. The exact
visual presentation and ordering of these actions remains a runtime `TODO`.

## Shared pointer gestures and temporary submodes

The tables below transcribe the compiled mouse-command tables. `C`, `M`, `S`, and
`H` mean Control, Meta, Super, and Hyper. “Inherited” means that a mode starts with
the Basic table and then adds or replaces bindings.

### View operations

| Gesture | Operation |
| --- | --- |
| Right | Redisplay |
| C-Right | Recenter |
| C-M-Right | Zoom In |
| S-M-Right | Zoom Out |
| M-Right | View Region |
| S-Right | Surround |
| H-Right | View Menu |
| H-S-Right | Location |

### Basic editing operations

| Gesture | Operation | Role |
| --- | --- | --- |
| Left | Select | replace selection |
| C-Left | Add Select | extend selection |
| M-Left | Region Select | select within tracked region |
| S-Left | Unselect | remove from selection |
| H-Left | Select Other | cycle or choose an overlapping alternative |
| H-M-Left | Region Select Other | region-select alternate objects |
| H-C-Left | Select Connected | follow connectivity |
| H-S-Left | Add Select Other | extend with an alternate object |
| M-Middle | Move | track selected objects |
| C-Middle | Draw | draw the mode's default object |
| C-M-Middle | Copy | copy selected objects |
| H-Middle | Kill | put selected objects on the kill history |
| H-S-Middle | Wipe | delete without the ordinary yank path |
| H-C-Middle | Yank | restore killed material |
| S-Middle | Value | edit or inspect an object's value |
| S-C-Middle | Props | edit or inspect properties |
| S-M-C-Middle | Move To | move by accepted destination |

### Orientation, yank, and line tracking

| Temporary state | Gesture | Operation |
| --- | --- | --- |
| Orient | M-Left | Rotate |
| Orient | C-Left | Mirror X |
| Orient | S-Left | Mirror Y |
| Orient | any other chord | Done |
| Yank | M-Middle or H-C-Middle | Yank Pop |
| General object tracker | any chord not replaced by the tracker | Done |
| View-region tracker | any chord | Done |
| Drawing a line | Middle | Attach |
| Drawing a line | Left | Flip |
| Drawing a line | Right | Anchor |
| Drawing a line | C-Middle | End |
| Drawing a line | M-Middle | Horizontal |
| Drawing a line | M-Left | Vertical |
| Drawing a line | S-Left | Jog |
| Drawing a line | S-Middle | Angle |
| Drawing a line | any otherwise unassigned chord | Attach |

The temporary tables are significant because the same chord changes meaning during
a tracker. A static list of top-level bindings alone would not describe NS input
accurately.

## Mode-specific pointer gestures

### Picture and schematic modes

Picture mode inherits Basic and binds plain Middle to `Line`. Its Draw menu exposes
Rectangle, Text, Circle, Ellipse, Arc, Arrow, and nested Picture construction in
addition to lines. Schematic-Icon similarly binds Middle to a geometric line rather
than an electrical wire.

| Mode | Gesture | Operation |
| --- | --- | --- |
| Picture | Middle | Line |
| Schematic | Middle | Wire |
| Schematic | H-M-Right | Pop one hierarchy level |
| Schematic | H-C-Right | Push into hierarchy |
| Schematic | H-S-M-Left | Select Node |
| Schematic | H-S-M-Middle | Match Node |
| Schematic | H-S-M-Right | Surround Nodes |
| Schematic | S-M-Middle | Plot/Unplot Node |
| Schematic-Icon | Middle | Line |

Picture and Schematic both default to four-unit mouse quantization, ten-unit
point/line proximity, twelve-unit short-line tolerance, twelve-unit text height, and
ten-unit label height. Their selection-distance defaults differ: 20 for Picture and
32 for Schematic. These are compiled defaults, not runtime measurements of screen
pixels.

### RSIM mode

RSIM replaces most Basic bindings with node-oriented operations:

| Gesture | Operation | Established effect |
| --- | --- | --- |
| Left | Select | select an object/node presentation |
| C-Left | Add Select | extend selection |
| M-Left | Region Select | tracked regional selection |
| S-Left | Unselect | remove selection |
| H-Left | Select Other | choose an overlapping alternative |
| H-C-Left | Select Connected | follow electrical connectivity |
| Middle | Node Value | show the current simulated node value |
| C-Middle | Set Node Value | force/accept a simulation value |
| M-Middle | Rename Node | change the node name |
| C-M-Middle | Explain Cap | explain capacitance contributing to the node |
| S-Middle | `?` | apply the RSIM `?` operation |
| H-Middle | `!` | apply the RSIM `!` operation |
| H-S-Middle | Simulate | run/advance simulation |
| S-C-Middle | Plot Node | add node to waveform plot |
| S-C-Right | Unplot Node | remove node from waveform plot |
| S-M-Middle | Trace Node | enable event trace |
| S-M-C-Middle | Untrace Node | disable event trace |
| S-M-Left | Watch Node | add to watched-node state |
| S-M-C-Left | Unwatch Node | remove watched state |
| H-M-Right | Pop | leave hierarchy |
| H-C-Right | Push | enter hierarchy |
| H-S-M-Left | Select Node | select the related extracted node |
| H-S-M-Middle | Match Node | locate a corresponding node |
| H-S-M-Right | Surround Nodes | fit related nodes in the view |

The compiled table alone does not explain the punctuation operations well enough to
name their visible result. Their exact `?` and `!` behavior is therefore a runtime
**TODO**, not guessed from punctuation convention.

### PC-layout mode

| Gesture | Operation |
| --- | --- |
| Middle | Line |
| S-M-Middle | Identify |
| C-M-Left | Select Corresponding Icons |
| H-S-M-Middle | Swap Gates |
| H-S-M-C-Middle | Swap Pins |
| M-Left while orienting | Rotate |
| C-Left while orienting | Change Layers |
| any other orient chord | Done |

The mode defines a point-grid display and derives its mouse quantization and grid
spacing as one tenth of the PC-layout unit scale. Location reporting uses
PC-layout units rather than the Basic buffer unit.

### Floor-plan mode

| Gesture | Operation |
| --- | --- |
| Middle | Divider |
| H-S-Left | Corresponding Net |
| Middle while placing divider | Attach |
| any other divider chord | Attach |

The extremely large compiled selection-distance default (`10000`) appears deliberate
for floorplan correspondence rather than a typo to silently normalize. Runtime
confirmation of how it feels is still needed.

### Mask mode

| Gesture | Operation |
| --- | --- |
| Middle | Mask Rectangle |
| Right | Set Layer |
| S-M-Left | Describe Constraint |
| S-M-C-Left | Find Vertical Constraint |
| S-C-Left | Find Horizontal Constraint |
| H-M-Right | Pop |
| H-C-Right | Push |
| H-S-M-Left | Select Node |
| H-S-M-Middle | Match Node |
| H-S-M-Right | Surround Nodes |
| H-S-M-C-Left | What Layer |
| H-S-M-C-Middle | Match Creator |
| H-S-M-C-Right | Compactor Tools Menu |

Mask mode uses four-unit mouse quantization, a sixteen-unit grid, four-unit maximum
selection distance, and micron location reporting.

### Virtual-grid mode

| Gesture | Operation |
| --- | --- |
| Middle | Log |
| Right | Set Layer |
| C-Middle | Draw |
| S-M-Left | Describe Constraint |
| S-M-Middle | Connect |
| H-M-Middle | Disconnect |
| H-S-Left | Path Under |
| H-M-Right | Pop |
| H-M-C-Left | Remove X VG |
| H-M-C-Middle | Remove Y VG |
| H-C-Right | Push |
| H-S-C-Left | Add X VG |
| H-S-C-Middle | Add Y VG |
| H-S-M-Left | Select Node |
| H-S-M-Middle | Match Node |
| H-S-M-Right | Surround Nodes |
| H-S-M-C-Middle | Import Ports |

Virtual-grid mode uses a sixteen-unit quantization and grid, zero short-line
tolerance, two-unit point/line proximity, sixteen-unit following distance,
thirty-two-unit selection distance, and virtual-grid location units. Unlike
Schematic, its “draw” chord is C-Middle because plain Middle constructs a log.

## Basic-NS: the common graphical environment

### What it does

Basic-NS is both infrastructure and a usable picture editor. Its implementation
provides:

- persistent libraries, modules, aspects, attributes, property descriptors, and
  generator definitions;
- editable primitive objects, points, lines, rectangles, text, circles, ellipses,
  arcs, arrows, and nested diagram instances;
- transformations, selection sets, connectivity selection, kill/yank history,
  movement, copying, rotation, mirroring, tracked drawing, and grid-snapped views;
- quad-tree spatial indexing and damaged-region redisplay;
- hierarchy navigation, callers and unused-module analysis, aspect comparison, and
  one- or two-view inspection;
- technology objects shared by PCB and IC extensions;
- color-aware rendering, cached drawing images, hardcopy, and Concordia integration;
- readable Lisp-oriented library definitions plus binary helper selection and file
  format converters.

The picture editor is more than a diagnostic canvas. It has commands to add a title
frame and build slides, pie charts, bar graphs, and line graphs. Those builders are
compiled product features; their exact visual styles are runtime `TODO`s.

### Complete Basic command inventory

| Area | Registered commands |
| --- | --- |
| Frame and mode | `Set Mode`; `Exit Recursive Interactor`; menu actions `Windows`, `Profile`, and `Mode` |
| Diagram cleanup | `Clean Diagram`; `Recenter Parts` |
| Libraries | `Create Library`; `Load Library`; `Edit Library Options`; `Kill Libraries`; `Update Libraries`; `Rename Library`; `Clean Library Directory` |
| Modules and aspects | `Draw Instance`; `Edit Aspect`; `Create Generator`; `Edit Library Generators`; `Rename Module`; `Kill Modules`; `Load All Aspects`; `Show Unused Modules`; `Show Module Callers`; `Find Module`; `Kill Aspect`; `Revert Aspect`; `Compare Diagrams` |
| Properties | `Edit Property Descriptor`; `Delete Property Descriptor` |
| Persistence and output | `Save Diagrams`; `Show Diagram File Status`; `Hardcopy Diagrams`; `Set Technology` |
| Picture construction | `Add Title Frame`; `Build Slide`; `Build Pie Chart`; `Build Bar Graph`; `Build Line Graph` |
| Maintenance | `Test NS`; global `Install NS Password` |

`Install NS Password` and the protected `protection`, `basic`, and `file-support`
modules explain why media presence is not equivalent to a safely runnable editor.
The system declaration calls out password protection explicitly. This article does
not attempt to defeat it.

### Data and persistence behavior

The implementation distinguishes human-oriented Lisp definitions from compiled
helpers. A library can choose the newest Lisp or binary helper while preserving an
explicit file type. Diagram “Define” saves changes as definitions rather than taking
a memory snapshot; `Save Diagrams` and file-status commands operate at the aspect
file level. Generated aspects, property descriptors, technologies, and generators
are reconstructible definitions, while an editor buffer and its selection/history
are transient state.

This means NS data is not analogous to a VM checkpoint. The library/module/aspect
forms are design source in their own domain. Loading the VBins reconstructs program
behavior, while loading design libraries reconstructs electronic objects. The two
should not be collapsed into one “serialized image” category.

## Schematic-NS: capture, extraction, simulation, and timing

### Schematic capture and icon construction

Schematic mode changes the default drawn segment from a generic line to an electrical
wire and adds hierarchy- and node-oriented gestures. Its primitive menu contains
passive components, sources, devices, and connectivity objects, including resistors,
capacitors, inductors, transmission lines, voltage and current sources, controlled
sources, pulse and piecewise-linear sources, MOSFET variants, input/output objects,
bus widths, forks, and rippers. The exact icon artwork remains licensed compiled
data and is not reproduced here.

`Build Icon` derives or edits a module's Schematic-Icon representation. Its compiled
accept-values surface includes side-specific signal placement, aspect ratio, text
and stub sizes, gate-input naming, and a DeMorgan option. Icon construction therefore
is not merely drawing a rectangle around port names.

### Network extraction

The extractor walks hierarchy and turns schematic objects into networks, nodes,
devices, terminals, and paths. Source-visible checks cover:

- bus width and naming consistency;
- missing or ambiguous signal paths and repeated path iterations;
- global signals and hierarchy;
- selectable extraction environments;
- replacing a module with a schematic or functional-model aspect;
- device and terminal mappings, error highlighting, and correspondence back to
  visible objects.

Functional models use the shared Lisp object environment and four-state logic
symbols `0`, `1`, `X`, and `Z`. The 1987 paper describes the same mixed strategy:
schematic structure, behavioral Lisp, and extracted networks coexist in one data
environment instead of passing only flat netlist files between isolated tools.

### RSIM and waveform plots

RSIM is a switch-level simulator connected directly to schematic hierarchy. The
compiled implementation preserves node value setting, watched-node and traced-node
state, history, rename and capacitance explanation operations, hierarchy push/pop,
simulation steps measured in tenths of a nanosecond, and plot aspects. A plot can
add or remove nodes through the same pointer chords used from a schematic or RSIM
view.

The 1987 paper independently describes mouse or Lisp control, value inspection,
value forcing, stepping, hierarchy navigation, and mixed functional/switch-level
simulation. It also mentions a hardware accelerator used in the original project.
No accelerator is present in this Open Genera boundary, so its performance or
availability is not inferred from the paper.

### Electrical rules and timing analysis

Schematic ERC classifies drivers, consumers, direction, and tri-state behavior and
marks errors in relation to design objects. The timing analyzer adds clocks,
constraints, delay paths, critical-path analysis, ignored-path persistence, and
incremental update. Source-visible support for changing transistor width and tracing
functional-device clock constraints shows that it is connected to both schematic
and device data.

`Mach1000` support contains UNIX-server communication, a gate recognizer, and MIF
generation. The server protocol is positive implementation evidence, but no matching
server executable was found or run. Its operational status is therefore `TODO`.

### Complete Schematic command inventory

| Area | Registered commands |
| --- | --- |
| Capture and extraction | `Build Icon`; `Set Extraction Environment`; `Add Default Stubs`; `Replace Signal Name`; `Find Signal`; `Catalog Library` |
| Verification | `Electrical Rules Check` |
| Simulation | `Set Simulation Model`; `Set RSIM Debug Level`; `Create Plot Aspect` |
| Timing | `Define Clocks`; `Timing Analyze`; `Ignore Delay Path`; `Save Ignored Delay Paths`; `Restore Ignored Delay Paths`; `Update Timing Analysis`; `Change Transistor Width`; `Find Clock Constraints`; `Summarize Clock Constraints` |

The mouse-only RSIM operations in the preceding table are also user commands, but
they are not duplicate command-processor registrations and are therefore not counted
again here.

## Gate-Array-NS: technology mapping and estimation

Gate-Array-NS is the smallest of the five systems, but it is not an empty technology
catalog. Its four modules add:

- gate-array device and functional-model definitions above Schematic-NS;
- hierarchical gate counting with detail and name/matching filters;
- statistical wire-capacitance estimation and back annotation;
- process, array, package, and corner-oriented technology definitions.

The compiled constants name LSI Logic 7000, 9000, LCA10K, and SC15 families,
Toshiba 19G, and generic gate-array libraries. This proves that the code knows those
technology names; it does not prove that every matching proprietary cell library is
installed in the local media.

Its sole `NS` command-table registration is `Count Gate Array`. The acceptance and
reporting code can count hierarchy, distinguish matching classes, and vary report
detail. Statistical capacitance operates as an implementation service rather than a
separate named top-level command in the inspected files.

The 1987 paper says NS used rule-based technology mapping and was already applied to
gate-array and board designs. The released 36 media is later evidence of a concrete
tool, but the paper does not document the exact 36 technology list or command form.

## PCB-NS: packaging, board verification, and interchange

### Design flow and aspect model

PCB-NS extends a logical schematic into several linked representations:

1. extract a PCB-oriented network from the schematic;
2. define Pin-Out and Electrical aspects for parts and pins;
3. assign physical packages and reference designators;
4. initialize or update the PC-Layout aspect;
5. place packages, inspect layers, and maintain the ratsnest;
6. swap equivalent gates or pins while propagating the change back to schematics;
7. run board electrical checks and simulation-related transformations;
8. generate reports and interchange files;
9. import external placement or swap changes through back annotation.

The PCB extractor can build a block diagram under PCB rules. A separate
`Hierarchicalize Schematic` path raises global signals through hierarchy, rebuilds
icons, and creates a form appropriate for board-level RSIM. Compiled references to
PALCompiler show an integration point, but the corresponding product is not included
among the five NS systems.

### Pinout, packaging, and electrical data

Pin-Out aspects model package sections, physical pin numbers, common pins, NC pins,
implicit power/ground, and gate/pin swap sets. Package assignment can be incremental,
preserve fixed assignments, generate random reference designators for unresolved
parts, and force layout updates.

The dedicated Pin-Out editor contains explicit limits: its compiled diagnostics say
that shared pins and multiple gate types are not supported by that editor path. Other
import/export code can represent some shared-pin and multi-section cases. This is a
source-visible internal boundary, not a contradiction to erase.

Electrical aspects attach input/output direction, high/low current and loading, and
logic-level data to pins and buses. PCB ERC uses those attributes to detect:

- floating pins and signals tied incorrectly to power or ground;
- multiple outputs, or problematic mixtures of output, tri-state, open-collector,
  and bidirectional drivers;
- nets with no receiver or no driver;
- missing pullups or ECL termination;
- logic-level incompatibilities;
- low- and high-state overload;
- grounded ECL inputs.

The implementation maintains sets of possible “next” checks, allows individual rules
to be disabled, and relates reports back to schematic objects. It is not merely a
batch text checker.

### PC-layout editor and ratsnest

PC-Layout aspects contain the board outline, package icons, top and bottom layers,
placement, grid, and relationship to the extracted PCB network. Commands initialize
or update the layout from packaging, find off-grid icons, select icons corresponding
to a schematic selection, set visible layers, and report layer visibility.

Ratsnest commands create, delete, or update connection guides for all or selected
nodes and maintain an explicit no-ratsnest node set. The code checks package and
layout validity before constructing it. Gate and pin swapping update both layout and
schematic representations and honor the swap restrictions encoded in Pin-Out data.

### Reports

`Generate Report` includes parts lists, package summaries and area, pin lists, wire
lists, and bills of material. `Find Ref-Des` locates a reference designator in the
linked design. `Symbolics Part Number` and `Revert Part Number Table` remain command
registrations, but the separately declared vendor part-number data file is missing,
so results which depend on that table are `TODO`.

### SCICARDS, Cadnetix, and EDIF

The production interface is broader than a generic “netlist export”:

| Interface | Files or structures written/read | Purpose established by compiled evidence |
| --- | --- | --- |
| SCICARDS | net list, part list, part library, function subfile, optional position subfile, and cross-reference (`XREF`) | transfer connectivity, packages, functions, placement, and name mappings |
| Cadnetix SCICARDS-format | top/bottom SCICARDS lists plus cross-reference | board-system transfer with layer information |
| Cadnetix EDIF | EDIF 1.1.0 library, cells, schematic and mask-layout views, view maps, ports, pin numbers, reference designators, swap/permutable sets | convey component/library definitions needed by Cadnetix |
| Prior EDIF comparison | parsed design, module, port, pin, NC, implicit-signal, shape, and swap data | report changes between a previously emitted library and current NS data |
| Cadnetix back annotation | cross-reference, old/new or “was/is” changes, and position data | apply external placement, part, and swap changes to NS |
| SCICARDS back annotation | cross-reference and full pin data | apply SCICARDS-side changes |

The Cadnetix writer has an indentation option. Its prompt says compact output is
roughly 25 percent smaller for the expected files. That is a product estimate, not a
universal property of EDIF.

Compiled defaults name standard PCB library categories for connectors, discrete
parts, ECL, interface parts, LSI, PLD, RAM, ROM, and TTL. The associated library
files were not separately verified, so these are installed-path expectations rather
than a redistributable cell-library inventory.

### Complete PCB command inventory

| Area | Registered commands |
| --- | --- |
| Packaging and simulation preparation | `Assign Packages`; `Fix Random Packages`; `Hierarchicalize Schematic`; `Build Schematic`; `Build Block Diagram`; `Add Power Supplies` |
| Electrical checks | `Set ERC Rules`; `ERC Schematics`; `Disable ERC Rules` |
| Pinout and part data | `Save Pinout`; `Revert Part Number Table`; `Symbolics Part Number` |
| PC layout | `Set PC-Layout Grid`; `Initialize Layout`; `Update PC-Layout`; `Select PC-Layout Icons`; `Find Off-grid Icons`; `Set Visible Layer(s)`; `Show Layer Visibility`; `Find Node`; `Set Label Visibility` |
| Connectivity and swapping | `Rat's-nest`; `Update Rat's-nest`; `Set No-Rat's-nest Nodes`; pointer commands `Swap Gates` and `Swap Pins` |
| Reports | `Generate Report`; `Find Ref-Des` |
| Export and annotation | `Write SCICARDS Files`; `Write Cadnetix Files`; `Back-annotate from Cadnetix`; `Back-annotate From SCICARDS` |

## VLSI-NS: symbolic and physical integrated-circuit design

### Device and technology layer

VLSI-NS adds IC-oriented primitives and technology objects to the schematic/network
substrate. The compiled primitive definitions cover MOS devices, terminals,
contacts, resistive and source elements, and SPICE attributes. Technology objects
hold micron/lambda conversion, named layers and CIF names, legal contacts, minimum
dimensions and overhangs, compactor and DRC parameters, MOS process corners,
parasitics, and model constants.

The patch history is substantive historical evidence. Version 36 refined contact
specifications, technology accessors, complex-contact checking, derived DRC layers,
MOS size conversion, RSIM resistance, graph-compactor transforms, and mask creators.
This is not a dormant demo accidentally shipped with Genera.

### Virtual-grid layout

Virtual Grid is a symbolic IC-layout representation. It works with grid-aligned
logs, contacts, supports, rectangles, transistors, ports, and terminals; records
which layers connect; can add or remove X/Y grid structure; imports ports, including
buses; toggles internal “guts”; and extracts a network for comparison or checking.

Source-visible checks include floating terminals, illegal overlaps, power/ground
shorts, wrong well contacts, contact adequacy, and physical support. `Path Under`
and connect/disconnect gestures make topology, not merely appearance, part of the
editing model.

### Mask layout

Mask mode edits physical rectangles, terminals, contacts, and P/N transistor
geometry on named process layers. It supports visible and selectable layer sets,
micron-oriented location display, hierarchy, creator matching, and constraint
inspection. Some extraction and checking paths call separately distributed DRC or
Compose facilities. Because those systems are absent, VLSI-NS media presence alone
does not establish a complete physical verification flow.

### Compaction and pitch matching

The media contains two compaction generations: the older `Compact` implementation
and a constraint-graph compactor exposed as `Gcompact`. The latter can preprocess a
layout, show a constraint graph, inspect constraints on selected objects, report
unresolved constraints, reveal a critical path, and construct a symbolic stand-in.
Pitch matching adjusts compatible layout dimensions or terminals. A right-button
compactor tools path is also present in Mask mode.

The 1987 paper describes the same broad method: designers make structured datapaths
or generators by hand, use symbolic layout and compaction, and retain explicit
control over important regular structures. The released command and diagnostic
surface is richer than the paper's overview.

### Floorplanning

Floor-Plan aspects use slicing hierarchy, dividers, terminals, and ports. Compiled
parameters include placement and routing-related choices and Ivory-specific design
options. They prove the existence of a floorplanning representation, not that a
complete automatic place-and-route system is installed. `NS-Routers` and
`Timberwolf` are named in the wider distribution manifest but absent here.

### Network comparison and electrical checks

`Network Compare` compares extracted networks from any two aspects. The code can
match designs without relying solely on node names, check ports and devices, compare
transistor sizes, and highlight suspects while using two views for correspondence.
It is a bridge between logical and physical design, not a textual diff.

Transistor ERC checks ratio and topology conditions including keepers, transmission
gates, and path lengths. Mask-oriented checks include power-consumption analysis and
port consistency. The exact technology-specific thresholds depend on selected
technology objects and are not generalized here.

### SPICE and analog plots

The SPICE interface can:

- make local or remote runs;
- configure DC, AC, and transient analyses;
- select process corners and diffusion parasitics;
- generate a deck and retain input/output buffers;
- plot node voltage or source current;
- compare schematic and layout networks before using extracted parasitics;
- dispatch to a Chaos SPICE server or an HSPICE server.

Patch 36.23 adds explicit Chaos-versus-HSPICE remote dispatch and HSPICE options.
Patch 36.24 incorporates the SPICE Delay Path implementation. `Spice Delay Path`
turns a selected timing path into a generated schematic suitable for analog delay
analysis.

The separately declared `Spice` system is absent from the five-system media, and no
server was run. The command surface and protocol are established; a successful
simulation in this preserved environment is not.

### Complete VLSI command inventory

| Area | Registered commands |
| --- | --- |
| Constraint-graph compaction | `Gcompact`; `Show Critical Path`; `Show Constraint Graph`; `Show Constraints On`; `Show Unresolved Constraints`; `Build Symbolic Standin` |
| Other compaction | `Compact`; `Show Compaction Constraints`; `Pitch Match` |
| Physical verification | `Check For Floating Terminals`; `Find Physical Supports`; `Check Ports`; `Network Compare`; `Transistor Electrical Rules Check`; `Check Power Consumption` |
| SPICE | `Spice`; `Set Spice Options`; `Spice Delay Path` |

The mode gestures `Set Layer`, `Describe Constraint`, `Find Vertical Constraint`,
`Find Horizontal Constraint`, `What Layer`, `Match Creator`, `Compactor Tools Menu`,
`Connect`, `Disconnect`, `Path Under`, grid add/remove, and `Import Ports` are part of
the user-visible command surface even though they are not separate command-processor
registrations.

## End-to-end workflows

The implementation and the 1987 paper support four overlapping workflows. They are
not rigid wizards; a Lisp-machine user can enter at an intermediate aspect, call
commands from Lisp, or replace parts with generators or functional models.

### Hierarchical schematic and digital verification

```text
Library / Module
      |
      +--> Schematic <--> Schematic-Icon
                |
                +--> extracted hierarchical network
                         |
                         +--> schematic ERC
                         +--> functional models + RSIM
                         +--> RSIM plot aspects
                         +--> timing analysis and critical paths
```

### Gate-array estimation

```text
Schematic network
      |
      +--> rule/technology mapping
      +--> gate-array count and utilization report
      +--> statistical wire capacitance annotation
      +--> updated timing/simulation data
```

### Printed-circuit-board flow

```text
Schematic network
      |
      +--> Pin-Out + Electrical aspects
      +--> package assignment / reference designators
      +--> PC-Layout placement + ratsnest + swaps
      +--> PCB ERC and reports
      +--> SCICARDS / Cadnetix EDIF
                     |
                     +--> external placement or editing
                     +--> Cadnetix / SCICARDS back annotation
```

### Integrated-circuit flow

```text
Schematic / functional model
      |
      +--> RSIM and timing analysis
      +--> Virtual-Grid symbolic layout
      |         |
      |         +--> compaction / pitch matching
      |         +--> network extraction
      +--> Mask physical layout
      +--> Floor-Plan
      |
      +--> network compare, transistor ERC, power checks
      +--> SPICE deck / remote run / plots
```

The shared objects are the architectural point. A selected timing path can become a
SPICE schematic; a physical node can be matched back to another aspect; a PCB swap
can update a schematic; a layout network can be compared to its logical source.

## Data products and interchange boundary

| Product | Kind | Meaningful extraction boundary |
| --- | --- | --- |
| NS library/module/aspect definitions | Lisp-oriented design definitions plus optional binary helpers | recoverable design source if the licensed design files themselves are available; not present merely because editor VBins are present |
| VBin program modules | L-BIN format-5 loader programs | declarative metadata and compiled effects can be analyzed; original Lisp source cannot be reproduced exactly |
| RSIM state and plots | live network values, histories, watched/traced nodes, plot aspects | plot/aspect definitions may persist; arbitrary live simulator state is not proven to be a portable checkpoint |
| Timing data | clocks, constraints, delay paths, ignored paths, analysis caches | ignored paths have explicit save/restore commands; derived caches can be recomputed only with dependencies and technology data |
| SCICARDS files | several ASCII manufacturing/design exchange files | meaningful external netlist, package, function, position, and cross-reference artifacts |
| EDIF 1.1.0 | textual interchange library | meaningful component/library and view data, but not a full NS editor state |
| Back-annotation files | XREF, position, was/is, and pin records | meaningful deltas that require the corresponding NS design and mappings |
| SPICE deck/output | textual simulator interchange and result buffers | meaningful if the model libraries/server dialect are known; not proof of a completed run |
| Mask/virtual-grid/floorplan aspects | structured physical-design objects | meaningful design source; not equivalent to screenshots or raster images |
| Hardcopy | rendered diagrams | evidence of appearance only, not an editable design substitute |

## What the paper establishes—and what release 36 adds

The 1987 Ivory paper is the best public primary overview, but it is not a command
manual for this later media.

| Topic | 1987 paper | Release-36 compiled evidence | Boundary |
| --- | --- | --- | --- |
| Language and model | Common Lisp, New Flavors, shared diagram/electrical-network objects | library/module/aspect hierarchy, typed presentations, buffer/view/editor machinery | compatible levels of description; neither expands “NS” |
| Schematic capture | graphical and Lisp hardware description, hierarchy, technology mapping | exact modes, icon builder, extraction environments, buses, error highlighting, commands and gestures | release adds implementational detail |
| Simulation | RSIM through mouse or Lisp; hierarchy; functional/switch mix; SPICE local/remote; hardware accelerator | exact node operations, watch/trace/history, plot aspects, Chaos/HSPICE dispatch | accelerator not found in release boundary |
| Physical IC design | virtual grid, manual datapaths and generators, compaction, slicing floorplan, place/route, comparison, DRC | two compactors, pitch matcher, floorplan mode, network compare, mask and virtual-grid checks | routers, DRC, Compose, Timberwolf absent here |
| Project use | gate-array and board work; Ivory verification; roughly 50,000 Lisp lines at that time | dedicated Gate-Array-NS and PCB-NS production modules and later patches | line count and 1987 scale must not be projected onto version 36 |
| Performance/process | large verification jobs parallelized; approximately 30 CPU days in one account | no preserved job log or runtime benchmark | historical project result, not a benchmark for Open Genera |

Release 36 also exposes details not apparent in the paper: SCICARDS and Cadnetix EDIF
production interfaces, board back annotation, X-terminal modifier and tracker fixes,
color-display support, HSPICE dispatch, a second constraint-graph compactor, and a
long trail of contact/technology corrections. Conversely, the paper's full internal
environment included supporting systems not present in the five shipped directories.

## Relationship to MIT CADR and LM-3 material

No direct NS source, system declaration, or implementation was found in the public
MIT System 46 snapshot at Git commit
[`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af)
or in the maintained LM-3 System 303 Fossil tree at check-in
[`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).
The appropriate comparison is therefore capability and artifact boundary, not a
source-line lineage claim.

### What System 46 preserves

The public System 46 tree contains 324 `.DRW` files totaling 4,776,539 bytes and 86
`.PLT` files totaling 669,231 bytes. Its README identifies them as SUDS material and
says the surviving drawings appear to be CADR4 schematics; it also records that one
Chaosnet-board SUDS file may have been lost from a damaged tape. The museum's
[visual-assets inventory](mit-cadr/visual-assets-inventory.md#suds-drawings-and-plot-streams)
records the exact census and rights boundary.

System 46 also contains the public
[`DPLT` renderer](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/dplt.63).
It reads 36-bit SUDS `.PLT` streams in two passes, decodes vectors, text, and diamond
records, finds bounds, rotates/scales the result, adds a frame/title, and writes
Press output for a Dover printer. It explicitly does not support rotated characters,
pads, and some PC-related material. DPLT is a plot consumer, not the SUDS editor.

### What System 303 preserves

The LM-3 tree retains an evolved
[`io1/dplt.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Fdplt.lisp)
with bounding-box-aware versions, richer SUDS font mapping and styles, and an
additional path for text reports. It also retains eight documentation `.DRW` files
but no companion `.PLT` exports for those eight at the pinned check-in. The complete
SUDS drawing editor is still absent.

Two LM-3 site declarations can look relevant by name but do not close the gap:

- [`site/amord.system`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=site%2Famord.system)
  registers an external AMORD rule/TMS tree on an `OZ` host;
- [`site/spice-plot.system`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=site%2Fspice-plot.system)
  registers external `structures`, `window`, `parse-spice`, `plot`, and `random`
  files on another `OZ` path.

Those declarations establish historical integration points only. Their external
trees are not in the public checkout, and neither declaration is Symbolics NS.

### Safe historical conclusion

SUDS proves that structured electronic drawings and Lisp-machine plot tooling
predate the preserved NS release. NS proves that Symbolics later shipped an
integrated schematic, simulation, PCB, gate-array, and IC environment. The inspected
evidence does **not** prove that NS is a port, rewrite, or direct descendant of SUDS.
Shared subject matter and three-button graphical editing are insufficient lineage
evidence.

## Runtime and screenshot status

This is a visible application dossier without a runtime image for a documented
reason:

1. the five systems are present as licensed contributed media, not proved resident
   in the clean base world;
2. Basic-NS's declaration and compiled command surface contain password protection;
3. loading would evaluate proprietary L-BIN programs and could request absent site,
   documentation, technology, server, or router dependencies;
4. the fresh read-only registration/package probe failed before the VLM executed, so
   even package and SCT registration state remains an explicit `TODO`; loading or
   bypassing protection was outside the bounded audit;
5. a generic Listener capture would not show NS behavior and would be decorative,
   so none is substituted.

The failed pre-runtime record is session `d43-ns-registration-20260718`, generation
1. Bubblewrap could not execute its `/usr/bin/bash` sandbox helper. The action count
is zero; neither the base nor private world changed; no shutdown signal was needed;
`forced_stop` and `state_may_be_incomplete` are both false. The base-world SHA-256 is
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` and the VLM
SHA-256 is `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`.
These are host preflight facts, not a Genera or NS runtime observation.

**Screenshot TODO:** after establishing a licensed, authorized NS world and complete
dependency inventory, use the Genera Xvfb harness to capture the NS frame itself.
At minimum verify Select-`S`, the one- and two-view configurations, the live Bucky
legend, mode menu, one Schematic state, one RSIM plot, and one physical-layout state.
Review each selected screenshot under the repository's
[publication policy](screenshot-publication-rights-review.md); do not publish
extracted icon or library artwork as though it were a runtime screenshot.

## Preservation and rights boundary

- The five NS trees, decoded forms, strings, diagrams, recovered icons, libraries,
  and any future run products remain licensed local inputs. This article publishes
  original factual analysis, small identifiers, counts, and checksums only.
- The inert parser used for this audit was an analysis instrument, not a source
  decompiler or redistribution path. No decoded proprietary form file is tracked.
- A future generic VBin inspector can be tracked if it is implemented independently
  from licensed code and emits user-supplied local output, but its default output
  must remain ignored when applied to proprietary media.
- Public System 46 sources and drawings retain their own MIT license and provenance.
  LM-3-only derivatives require their own provenance review; public Fossil browsing
  is not by itself a license grant.
- Runtime screenshots are governed per image and use. They do not authorize bulk
  extraction of fonts, icons, masks, schematics, documentation, or cell libraries.

## Source-visible limits and open questions

- **TODO: expand NS.** Locate a contemporary NS manual title page, release note,
  author statement, or source comment that defines the initials.
- **TODO: runtime registration.** In a fresh isolated world, query the package and
  SCT registration state without loading the systems; record the exact result.
- **TODO: authorized startup.** Determine the legitimate password/site procedure and
  required translation files. Do not bypass the protection module.
- **TODO: missing systems.** Inventory lawful media for NS-DOC, NS-Tutorial,
  NS-Routers, DRC, SPICE, HP, Timberwolf, Compose, LSI Logic Support, VLSI Hacks,
  PALCompiler, and technology/cell libraries.
- **TODO: external services.** Reconstruct the documented server dialects for
  Mach1000, Chaos SPICE, and HSPICE in a network-isolated test environment.
- **TODO: part-number data.** Establish whether `symbolics-part-number-data.bin` was
  omitted intentionally and how the commands degrade without it.
- **TODO: punctuation gestures.** Exercise RSIM `?` and `!` and record their exact
  visible effects.
- **TODO: formats.** Recover representative user-owned NS library, EDIF, SCICARDS,
  back-annotation, SPICE, and plot fixtures, then document their syntax without
  publishing licensed vendor libraries.
- **TODO: source/manual/runtime discrepancies.** Compare the compiled command tables
  against NS-DOC if lawful documentation media is recovered, and test all three
  button meanings for multi-action menus.
- **TODO: lineage.** Seek direct historical evidence before asserting any SUDS-to-NS
  implementation lineage.

## Sources and verification

- Neil Weste, Chris Terman, Howard Shrobe, David Sarrazin, David Tan, Kalman Reti,
  Eric Nestler, Henry Minsky, Alan Corry, Jim Cherry, and Clark Baker,
  [“The Symbolics Ivory Design and Verification Strategy”](https://www.bitsavers.org/pdf/symbolics/I_Machine/Ivory_Design_Verification_198707.pdf),
  IEEE ICCD 1987, pages 506–511.
- MIT CADR System 46 public source,
  [Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af),
  especially the [release README](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/README)
  and [`DPLT`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/dplt.63).
- LM-3 maintained System 303 Fossil tree,
  [check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  especially [`DPLT`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Fdplt.lisp),
  [`AMORD`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=site%2Famord.system),
  and [`SPICE-PLOT`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=site%2Fspice-plot.system).
- Licensed local Open Genera contributed NS media: the five evidence-set identities
  above; the latest plain declarations are `basic-ns/defsystem.lisp.~9~`,
  `schematic-ns/defsystem.lisp.~3~`, `gate-array-ns/defsystem.lisp.~1~`,
  `pcb-ns/defsystem.lisp.~2~`, and `vlsi-ns/defsystem.lisp.~3~`. Inspected locally;
  not redistributed.

Last verified: 2026-07-18.

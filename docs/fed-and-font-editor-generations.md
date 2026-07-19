---
type: Historical Article
title: FED and the Font Editor generations
description: A source-, help-, and runtime-grounded guide to the bitmap font editors preserved across MIT CADR, LM-3 System 303, and Symbolics Genera materials.
tags: [lisp-machine, mit-cadr, lm-3, genera, fed, font-editor, bitmap-editor]
timestamp: 2026-07-18T08:41:58-04:00
---

# FED and the Font Editor generations

FED and the later Genera Font Editor are interactive bitmap-glyph editors. They
let a designer alter a magnified raster, character metrics, and font-wide
metrics, then update the live font or write a font file. They are not outline or
vector-font editors. Genera does have separate support for scalable hardcopy
fonts, but that support is outside the Font Editor described here; see
[Extracting resident fonts from a Genera world](genera/extracting-resident-fonts.md#raster-display-fonts-and-outline-hardcopy-fonts).

There is no evidence for a simple sequence in which each surviving `FED` file
replaced the preceding one. The System 46 archive contains an old-window FED, an
`XFED` variant, and a flavor/new-window implementation whose historical source
listing calls it `NFED`. Their archived dates overlap. The maintained LM-3
System 303 tree contains a much larger FED with gray-plane, register, and
optional frame-grabber facilities. Genera 8.5 distributes a separate Dynamic
Windows Font Editor implemented on a reusable Bitmap Editor framework.

This page treats each inspected implementation as its own release-bounded
program. “Complete” command or binding lists mean complete for the literal
tables and handlers in the pinned source, not for site patches, dynamically
loaded extensions, or a different release.

## Programs and evidence boundary

| Program | Preserved implementation | What is established | Runtime evidence |
| --- | --- | --- | --- |
| Old-window FED | System 46 `src/lmio1/fed.165` | Full source, keyboard and mouse dispatch, metrics, display, sample, merge, and KST file operations. | No compatible System 46 load band is currently wired to the harness. |
| XFED | System 46 `src/lmio1/xfed.4` | Full source and an exact comparison with `fed.165`. The meaning of the `X` prefix is not established. | No compatible System 46 load band is currently wired to the harness. |
| New-window FED, historically listed as NFED | System 46 `src/lmwin/fed.73` | Full flavor-based source, generated source Help, menu and key tables, and KST/QFASL/AL paths. This is the FED named by the System 46 package declaration. | No compatible System 46 load band is currently wired to the harness. |
| System 303 FED | LM-3 check-in `4df393c`, `l/sys/window/fed.lisp` | Full maintained source: frame, menus, gray plane, registers, file formats, unsaved-change tracking, and optional frame grabber. | The preserved System 303-0 band does not contain the optional FED system; loading it attempted to reach an unavailable configured file server. No editor UI was reached. |
| Genera Font Editor | Licensed Genera 8.5 `sys.sct/bitmap-editor/` source and compiled files | Full distributed implementation of the Font Editor and inherited Bitmap Editor commands, plus a five-part installed Font Editor manual from an earlier documentation release. | The cold base world did not have the application loaded: the Select gesture had no visible effect and `Edit Font` was not a command name. No editor UI was reached. |
| Genera legacy `FED` | Installed Help/software-selector naming only | A separately named legacy program is present in the product's Help inventory. No matching legacy implementation was found in the distributed source tree inspected here. | Not reached. Its features and relationship to the five-part Font Editor book remain `TODO`. |

`FED` is consistently described by the sources as a font editor, but this audit
did not find a primary-source declaration that it is an acronym with a longer
expansion. `XFED` is therefore not expanded speculatively. `NFED` is an exact
historical filename in the System 46 file map, whose description says it is a
font editor using some of the new window system. The preserved implementation
is named `fed.73`, and the package declaration loads `LMWIN; FED QFASL`; this
page uses “new-window FED” for the implementation and “NFED” only for the
historical listing evidence.

## The common editing model

All inspectable generations share a core model:

- a magnified plane whose cells represent bitmap pixels;
- a character box that records horizontal extent, baseline, and font height;
- font-wide line spacing, baseline, and cursor or blinker dimensions;
- a current font and character, with a command to copy the edited raster back
  into the live font;
- a sample string and an all-characters display for judging the result at normal
  size; and
- file conversion paths that bridge live font objects and historical font
  formats.

The visible grid is a view of an effectively extensible plane, not necessarily
the exact compact raster stored for the glyph. Saving computes a compact
character descriptor and retains advance width and left-kern information. This
is why moving the character box and drawing pixels are distinct operations.

The important persistence distinction is also shared by the later versions:
**saving a character into the live font is not the same action as writing a font
file**. A character can be current and edited in memory without the containing
font having been written to persistent storage.

## System 46 old-window FED

### Architecture and visible surface

The old implementation builds one `FED-WINDOW-CLASS` in a single-frame window.
The window owns the scaled grid, the editable plane, character-box coordinates,
a non-mouse cursor, typeout stream, current font and character, and sample
string. The default requested window is 700 by 600 pixels and the initial grid
scale is 14 host pixels per glyph cell.

The label shows the selected font, character code and glyph, and sample text.
At a scale of one the character-box lines are suppressed; below six the grid
points are suppressed. Redisplay tracks a changed rectangle so a point edit
need not redraw the entire plane.

Selecting a font can use an already bound font, load its QFASL from the font
directory, or create a new descriptor after confirmation. Selecting a character
copies its current raster and metrics into the edit plane. Merge copies another
character into the current plane. Save replaces the selected live character.
Font parameters include line spacing, baseline, blinker height, blinker width,
and default space width; the character box supplies the current character width
and left kern.

The all-font display labels each glyph with the corresponding default-font
character, so a non-alphabetic font can be identified by character position.
The sample string uses the font under edit. Reflection accepts an axis and
rotation turns the glyph right by 90 degrees.

### Complete literal keyboard table

The source folds lowercase letters to uppercase and accumulates decimal digits
as a numeric argument. The movement keys use that argument, or derive a power-of-
two distance from Control/Meta modifier bits when no explicit argument was
typed.

| Key or key family | Operation |
| --- | --- |
| Four screen-motion arrow keys | Shift the viewed plane. |
| Four non-mouse-cursor direction keys (`[`, `]`, backslash, and slash glyphs on the historical keyboard) | Move the non-mouse cursor. |
| `Space` | No operation; also completes typeout. |
| `H` | Home the view on the character box. |
| `@` | Set display scale; default 14 or use the numeric argument. |
| `F` | Select, load, or create a font. |
| `C` | Select a character. A Control variant keeps the existing edit-plane data instead of first loading the selected glyph. |
| `M` | Merge a character into the edit plane. |
| `S` | Save the edited character into the selected live font. |
| `E` | Erase the edit plane. |
| `P` | Set font parameters. |
| `B` | Enter a Lisp break. This implementation command is omitted from its short Help text. |
| `X`, `Y` | Set the non-mouse cursor coordinate from the numeric argument. |
| `D` | Display the complete font. |
| `V` | Set the sample string. |
| Reflect key | Reflect using an axis selected from the command's argument. |
| Circle-Plus | Rotate the character 90 degrees right. |
| `R` | Read a KST font file. |
| `W` | Write a KST font file. |
| `.` | Complement the cell under the non-mouse cursor. |
| `?`, `Help` | Show the compact command summary. |
| `Form`/Clear | Clean the frame and force redisplay. |
| `0`–`9` | Accumulate the next command's numeric argument. |
| `a`–`z` | Dispatch as the corresponding uppercase command. |

### Mouse table

| Gesture | Operation |
| --- | --- |
| Left drag over the grid | Complement each newly entered cell. Returning to a cell in another part of the stroke can therefore complement it again. |
| Middle drag near a character-box edge | Move that edge. |
| Right | No grid operation in the literal dispatch table. |

The distinction between complementing and setting matters for reconstructing
the feel of the editor: a stroke over an already black point erases it. XFED and
the later editors change that default.

### Files and preservation

The interactive file commands expose KST only. KST was the PDP-10/ITS font
interchange format; it is a source-like textual/binary-word representation, not
a screenshot of the edit plane. The museum's public
[CADR font recovery](mit-cadr/font-sources-and-recovery.md) parses KST alongside
AST and Alto sources without using a load band.

## System 46 XFED

`xfed.4` is a near-copy of `fed.165`, with a handful of deliberate interaction
changes. The archive dates `XFED 3`, `XFED 4`, and its QFASL to 14 March 1980,
after the dated old FED and NFED entries. That establishes coexistence in the
archive, not a documented product succession.

### Exact functional differences from `fed.165`

| Area | Old FED | XFED |
| --- | --- | --- |
| Default requested frame | 700 by 600 | 1000 by 1000 |
| Package declaration | No package in the file mode line | `FED` package in the file mode line |
| Left drag | Complement cells | Set cells |
| Middle drag | Move character-box edge | Move character-box edge |
| Right drag | Undefined | Clear cells |
| `.` | Complement cursor cell | Set cursor cell |
| `,` | Undefined | Clear cursor cell |
| `Z` | Undefined | Erase the four-connected black region containing the cursor cell |
| All-font display | Compares the iterated character directly with the current character | Guards the comparison when there is no current character |

XFED's region eraser recurses only through horizontal and vertical neighbors;
diagonal contact does not join two regions. Apart from the listed changes, an
exact source diff shows the same font/character selection, metrics, merge, save,
sample, transform, KST I/O, numeric argument, redisplay, and command structure.
The `B` break command remains present and undocumented by the short Help text.

The most defensible interpretation is therefore “an interaction experiment or
variant of old FED.” What `X` was intended to mean is `TODO`.

## System 46 new-window FED, or NFED lineage

### Architecture and layout

The flavor-based `src/lmwin/fed.73` is a substantial architectural rewrite. It
uses grid, plane, character-box, and layout flavors rather than the old
`DEFCLASS` window. Its frame contains:

- a prompt pane;
- a typeout pane for font displays and Help;
- the main grid/edit pane; and
- a command menu.

The grid still defaults to scale 14 and suppresses grid points below scale six,
but it has incremental redisplay degrees and plane-aware redraw. The menu items
are exactly `Erase`, `Home`, `Save`, and `Draw line`.

The draw mode begins in XOR, or flip, mode. Middle-click cycles the raster ALU
through `ANDCA` (erase), `XOR` (flip), and `IOR` (draw). This source-level
default is easy to miss in a feature list: the first unmodified left stroke can
erase existing pixels as well as set blank ones.

### Complete literal input table

| Input | Operation |
| --- | --- |
| Left drag | Draw using the current ANDCA/XOR/IOR mode. |
| Middle click | Cycle erase, flip, and draw modes. |
| Right drag | Move a character-box edge. |
| Four screen-motion arrows | Shift the viewed plane. |
| Four hand/cursor arrows | Move the non-mouse cursor. |
| `Space` | No operation. |
| `H` | Home the view. |
| `@` | Set display scale. |
| `F` | Select, load, or create a font. |
| `C` | Select a character; Control-C selects without first replacing the edit plane with that character. |
| `M` | Merge a character. Modifier bits select the alternate merge prompt path. |
| `S` | Save the current character into the live font. |
| `E` | Erase the plane. |
| `P` | Set line spacing, baseline, blinker height, and blinker width. |
| `X`, `Y` | Set non-mouse cursor coordinates. |
| `D` | Display the entire font. |
| `V` | Set the sample string. |
| Reflect key | Reflect the glyph. |
| Circle-Plus | Rotate right. |
| `R` | Read KST. |
| Control-R | Read QFASL. |
| Control-Meta-R | Read Alto AL format. |
| `W` | Write KST. |
| Control-W | Write QFASL. |
| `.` | Complement the non-mouse-cursor cell. |
| `?`, `Help` | Show the source-embedded command summary. |
| `Form` | Redisplay the screen. |
| `0`–`9` | Accumulate a numeric argument. |
| `a`–`z` | Dispatch as uppercase. |

The handlers establish all of these variants; the source-embedded Help also
confirms the Control-R and Control-W QFASL paths. QFASL input loads a compiled
font definition; QFASL output dumps the selected symbol value. The
Control-Meta-R AL path is source-established but omitted from that short Help,
and is read-only. Ordinary KST read and write retain a per-font default
pathname.

### Features and implementation findings

Font selection displays the font after choosing it, and can create a descriptor
for an absent name. Save updates both the descriptor and the live display font.
It warns when the character box is incompatible with the font's height or
baseline and when pixels would be clipped outside the stored vertical range.

`Display font` marks each position using the default character and uses the
edited version of the current character. `Sample` renders a chosen string.
`Draw line` is exposed through the menu. A spline-drawing function is present in
the source but is not installed in either the literal keyboard table or the
menu; it is a source-visible dormant capability, not an advertised command.

The tracked, non-evaluating Help recovery preserves the public source strings
for this generation in
[`lmwin/fed.73.help.lisp`](assets/mit-cadr-online-help/source/lmwin/fed.73.help.lisp),
with the old FED and XFED Help beside it. These are implementation help strings,
not a substitute for observing a runnable System 46 build.

## LM-3 System 303 FED

### Provenance and system status

The maintained LM-3 tree at check-in
[`4df393c`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
declares `FONT-UTILITIES` as a normal component but FED as optional software
loadable by the user. Its FED system reads the font definitions and loads image
tools, font conversion, and the window implementation. The program is also
registered on system key `F` with the label `Font Edit`.

The source file is a maintained composite, not an untouched release artifact.
Its header attributes “vanilla FED” to Richard Stallman and calls that portion
public domain, while later sections say they were copied from a Release 3 file
in October 1986 and other sections add frame-grabber facilities. The narrow
header statement is not treated here as a license for every line in the
composite.

### Full frame and data model

The standard frame is full-screen and contains, from top to bottom, a command
menu, main raster grid, a label/sample pane, a row of six explicitly declared
register panes, and a prompt pane. The source also carries a register-count
calculation bounded from two to eight, but no call site connects it to the six
declared panes; dynamic register-count behavior is therefore not claimed.
Register display scale decreases for taller fonts so the row cannot consume the
whole frame.

The main grid has two one-bit planes:

- the **black plane**, which is the editable glyph saved into the font; and
- the **gray plane**, a movable reference or merge source.

The label contains mouse-sensitive font, character, character-code, line-height,
baseline, blinker-height, blinker-width, width, and sample-string fields. An
asterisk beside the character code marks unsaved raster changes. The sample and
all-font display use the edited raster even before it is stored: a global list
of FED windows tracks which font/character each window is editing. The same
tracking warns when another FED window is editing a target character.

### Complete standard command menu

| Menu item | Left | Middle | Right or alternate behavior |
| --- | --- | --- | --- |
| `Character` | Select by typed character/name | Select by numeric code | Load a character into the gray plane |
| `Font` | Choose from loaded fonts | Copy the current font to a new name | Display the whole font |
| `Save Char` | Save to the current font/character | No operation | Store into an explicitly chosen font/character |
| `Home` | Center the character box | — | — |
| `Erase Plane` | Clear black | No operation | Clear gray |
| `Move Plane` | Move both planes | No operation | Move gray relative to black |
| `Exchange` | Exchange black and gray | — | — |
| `Merge` | Merge gray into black with the current operation | No operation | Choose copy, set, clear, or flip |
| `Rotate` | Rotate right 90 degrees | — | — |
| `Reflect` | Choose an axis and reflect | — | — |
| `Stretch Char` | Supply rational X and Y scale factors | — | — |
| `Rectangle` | Clear a selected rectangle | No operation | Choose clear, set, or flip for a rectangle |
| `Draw (Sp)Line` | Draw a two-point line | No operation | Draw a multi-point spline |
| `Display Scale` | Set grid scale | — | — |
| `Files` | Read a font file | No operation | Write a font file |
| `Help` | Choose Intro, General, Menu, or Keyboard Help | — | — |

### Optional frame-grabber menu

If the color subsystem exists, the frame selects an extended configuration with
a threshold slider and medium-resolution color-screen support. It adds:

| Menu item | Left | Right |
| --- | --- | --- |
| `Camera` | Momentary camera flow-through while held | Continue flow-through until Space |
| `Crop` | Interactively select a source rectangle; right-click ends cropping | — |
| `Snap` | Threshold the crop into the black plane | Threshold it into the gray plane |
| `Med. Res. File` | Load the medium-resolution screen | Save the medium-resolution screen |

This configuration is conditional on runtime color hardware support. The
museum's monochrome System 303 harness did not reach FED, so none of these
frame-grabber operations has runtime confirmation here.

### Drawing, transformations, and registers

The main pane starts in `Latch` mode. Left-drag draws the inverse of the first
cell encountered for the duration of the stroke. Middle-click cycles `Latch`,
`Draw`, `Erase`, and `Flip`; right-drag moves a character-box edge; a right
double-click opens the system menu. Lines and splines use the current draw mode,
except Latch behaves as draw for those shape commands.

Stretch accepts separate integer numerator and denominator values for X and Y.
Reflection offers horizontal, vertical, and both diagonal axes. The gray-plane
merge operations are:

- copy gray as the new black plane;
- set every black bit corresponding to a gray bit;
- clear every corresponding black bit; or
- flip every corresponding black bit.

Each register stores a raster plus its character-box geometry. Left-click saves
black into the register; middle-click replaces black with the register; and
right-click opens this complete operation set: clear register, save black, save
gray, restore to black, copy to black or gray, set bits in black or gray, clear
bits in black or gray, and flip bits in black or gray.

### Complete literal keyboard table

| Key or key family | Operation |
| --- | --- |
| Four screen-motion arrows | Shift the view. |
| Four hand arrows | Move the non-mouse cursor. |
| `Space`, `Rubout`, `Return` | No operation and flush outstanding typeout. |
| `H` | Home. |
| `@` | Set scale. |
| `F` | Select a font. |
| `C` | Select a character. |
| `M` | Merge a character. |
| `S` | Save the current character. |
| `E` | Erase the black plane. |
| first literal `X` registration | Set cursor X. |
| `Y` | Set cursor Y. |
| `D` | Display the font. |
| `V` | Set sample string. |
| Rotate key | Rotate right. |
| `R` | Read a font file. |
| `W` | Write a font file. |
| second literal `X` registration | Exchange black and gray planes. |
| `.` | Complement the non-mouse-cursor cell. |
| Reflect key | Reflect the character. |
| `?`, `Help` | Open FED Help. |
| `Form` | Force redisplay. |
| `0`–`9` | Accumulate a numeric argument. |
| `a`–`z` | Dispatch as uppercase. |

There are two sequential `X` entries in the source table. Setup writes them in
order into the same array, so static analysis indicates the later Exchange
Planes entry shadows Set X. The embedded keyboard Help also calls `X` exchange,
although another Help passage still discusses `X` and `Y` as coordinate setters.
Because the optional system could not be loaded, the actual built dispatch was
not observed. The source-level collision and likely shadowing are established;
runtime behavior remains `TODO`.

### Fonts, saving, and files

Font selection can choose a loaded font, load a QFASL found in the font
directory, or create a new font. Character selection is by character or octal
code. Save compacts the black plane to a character descriptor, retains left kern
and advance width, and warns about incompatible height/baseline or pixels that
would be lost above or below the stored character region.

The file menu is broader than the keyboard letter suggests:

| Format | Read | Write | Role in the source |
| --- | --- | --- | --- |
| KST | Yes | Yes | MIT/ITS interchange |
| QFASL | Yes | Yes | Compiled Lisp font object |
| AC | Yes | Yes | Xerox format |
| AST | Yes | Yes | Asterisk-based font source |
| AL | Yes | No | Alto font format |
| KS | Yes | No | Alto-related legacy format |

Again, `Save Char` changes the selected live font; `Files` writes a persistent
font representation. The implementation maintains separate KST and AST default
pathnames where available.

### Source findings beyond the embedded Help

- Multiple FED windows share edited-character awareness. All-font and sample
  output can show an unsaved edit from another FED instead of the installed live
  glyph.
- Unsaved changes are represented explicitly and shown with an asterisk. The
  source warns on character changes and cross-window collisions; Help text that
  says a change is simply lost does not describe every implementation path.
- The frame-grabber configuration is chosen at instantiation time. The source
  warns against saving a live FED instance in a load band because color and
  monochrome environments instantiate differently.
- The duplicate `X` binding is an implementation inconsistency not evident from
  a clean feature list.

## Genera 8.5 Font Editor

### A separate Dynamic Windows implementation

The Genera Font Editor is not the System 303 `FED-FRAME` source with renamed
menus. Its program framework inherits from a reusable `bitmap-editor` and the
Dynamic Windows Help Program. The system declaration classifies Bitmap Editor
as a basic, non-advertised system and loads raster-plane support, color helpers,
Bitmap Editor, Stipple Editor, and Font Editor serially after the graphic-editing
dependency.

The framework is selected by the `{` system key when loaded and also exports a
global `Edit Font` command. It has two configurations:

- **Tall**: title, sample, and large grid at left; Help, Undo, draw mode, Draw,
  Gray, Font, parameter, character, and register panes at right; command
  interactor below.
- **Wide**: title, sample, grid, registers, controls, and command interactor
  stacked horizontally across the wider frame, with menus arranged in columns.

Both contain a scrollable/typeout-capable grid, a 128-entry character pane,
accept-values panes for edit and font parameters, a sample pane, and raster
registers. The character pane is hard-coded to the first 128 indices; a source
comment leaves proper character-set scrolling as unfinished work.

The default state uses character width 10, grid scale 10, baseline height 10,
and total height 12. In this specialization only the left and right bounding-box
components are draggable. Font height and baseline are changed through the font
parameter pane rather than by dragging the top, baseline, or bottom edges.

### Font-menu commands

| Command | Behavior and gestures |
| --- | --- |
| `Configure` | Choose Tall or Wide; ordinary left uses the default command, right presents the choices explicitly. |
| `List Fonts` | Left lists loaded fonts; Shift-Left includes fonts not loaded; right accepts explicit options including name matching. |
| `Show Font` | Display a font, using the current in-editor BFD when appropriate. |
| `Edit Font` | Load/select an existing font or offer to create an unknown name. Shift-Left on the menu invokes Copy Font. |
| `Copy Font` | Copy a loaded font object to a new name, with confirmation before replacing an existing name. |
| `Edit Character` | Select a character by one-character input, character-set name, or an octal index valid for the character set. |
| `Read File` | Infer a registered read format from the pathname type or prompt for one, read it, and select the resulting font. |
| `Write File` | Infer or prompt for a registered write format and serialize the current font/BFD. |
| `Save Char` | Store the edited raster and metrics into the current in-memory font/BFD. |
| `Set Sample` | Replace the sample string; undoable. |
| `Rename Char` | Change the character position at which the edited raster will next be saved; undoable. |
| `Gray Char` | Load a chosen character, font, and scale into the gray plane; undoable. |
| `Exit` | Offer to save a modified character, clear current state, and bury the frame. |

Font names in `List Fonts`/`Show Font` output are presentations: selecting one
can invoke Edit Font or Show Font without retyping it. A separate presentation
translator makes displayed character objects selectable for editing or loading
into gray.

### Inherited Draw and Gray menus

The Font Editor inherits this complete visible Bitmap Editor menu surface:

| Menu | Commands and gesture variants |
| --- | --- |
| Draw | `Clear All`; `Move Black`; `Stretch` (left column, Shift-Left row, right choose); `Rotate` (90, -90, or 180 degrees about a point); `Reflect` (left horizontal, Shift-Left vertical, Meta-Left diagonal, Meta-Middle reverse diagonal, right explicit arguments); `Draw Line`; `Draw Spline`; `Draw Rect`; `Flood`; `Set Scale`; `Zoom/Expand`; `Move View`; `Center View`; and `Configure`. |
| Gray | `Swap Gray`; `Clear Gray`; `Merge Gray` (left with current operation, Shift-Left merge then clear gray, right explicit arguments); `Move Gray`; `Swap Rgn`; and the Font Editor's `Gray Char`. |

`Draw Polygon` exists as a command but has no menu accelerator, so it is
available through the full command interface rather than the visible Draw menu.
Flood fails with a command error if the selected region is not closed. Line and
spline commands survive from old FED even though the source notes that low glyph
resolution limits their usefulness without subsequent pixel editing.

For a normal one-bit font, the drawing-mode pane contains `Draw`, `Erase`, and
`Flip`. Bitmap Editor also supports `Foreground` and `Background` modes for
richer image element types, but those are not additional colors in an ordinary
bit font.

### Mouse and modifier behavior

| Gesture | Operation |
| --- | --- |
| Left or drag | Draw with the selected mode. |
| Control-Left | Erase for bit fonts. |
| Meta-Left | Draw for bit fonts. |
| Control-Meta-Left | No-op drawing mode, useful while continuing a tracked gesture without changing cells. |
| Middle on a grid point | Cycle Draw to Erase to Flip to Draw. |
| Left on an empty register | Store black into it. |
| Left on a nonempty register | Retrieve it into black. |
| Register context menu | Retrieve into black or gray, store black or gray, or clear. |
| Left near the bounding box | Drag the box or selected movable edge. |
| Shift-Middle near an edge | Snap to the nearest edge and drag it. |

Control and Meta are sampled while the mouse is moving, not just when the stroke
begins. A user can therefore press or release a modifier during one drag to
change its operation. The default source setting suppresses command echo for
ordinary point drawing, avoiding a command transcript for every pixel.

### Complete explicit keyboard accelerators

The framework inherits general Dynamic Windows command entry and the command
interactor. These are the Font Editor's literal single-key accelerators:

| Key | Command |
| --- | --- |
| `F` | Edit Font |
| `C` | Edit Character |
| `S` | Save Char |
| `U` | Undo |
| `R` | Redo |
| `Refresh` | Refresh the editor display |
| `Meta-Help` | Program Help |
| `Control-Meta-Help` | Help for a specific command/accelerator |
| `Help` | Short Font Editor help and directions to accelerator Help |
| `Control-Help` | List the active single-character accelerators |

There is deliberately no asserted one-key accelerator for `Gray Char`: a source
comment considers `G` but does not install it. Menu commands without a key remain
available from the menu or command interactor.

### Character metrics, sample, and save behavior

Genera represents the editable font as a BFD and the selected glyph as a BCD.
The character parser understands one literal character, a character-set name,
or an octal code within the selected set. Editing a missing position creates a
new blank character at the font's default advance.

The sample pane renders the edited glyph in place of each occurrence of the
current character, so changes can be judged before Save Char. Its incremental
redisplayer remembers only up to 10 pixels of left and top kern around the
edited image. That source-visible “magic number” is a preview limitation, not a
font-format limit.

Changing font, changing character, or exiting offers to save a modified
character. Drawing without a current character triggers a confirmation before
proceeding to another selection. Save compacts the occupied raster, records
advance width and left kern, and warns before clipping ink outside the vertical
font box. The implementation deliberately does not preserve per-character top
kern in its save path; vertical alignment comes from the font-wide baseline and
height. Font parameters expose height, baseline, blinker width, and blinker
height; edit parameters expose the character width and view/bounding-box state.

Undo/redo covers font and character selection, sample and rename changes,
loading gray, pixel and shape edits, plane operations, registers, transforms,
scale/view changes, and bounding-box manipulation. Writing a file is a
persistence action, not an inverse raster edit, and is not represented as an
undoable transformation in the inspected source.

### Registered file formats

The file commands query a registry rather than hard-coding one menu. The matching
Genera 8.5 font I/O source registers:

| Format | Read | Write | Source description |
| --- | --- | --- | --- |
| BFD | Yes | Yes | Standard 3600 font format |
| Default binary file type | Yes | Yes | Compiled-code binary font file |
| PXL | Yes | Yes | Unix TeX raster-font format |
| BDF | Yes | Yes | Adobe Bitmap Distribution Format |
| AST | Yes | Yes | Asterisk-based legacy format |
| KST | Yes | Yes | MIT ITS legacy format |
| AC | Yes | Yes | Xerox legacy format |
| AL | Yes | No | Xerox/Alto legacy format |

When a pathname's canonical type names an available operation, the Font Editor
uses it automatically; otherwise it prompts from only the formats that implement
the requested read or write side. The conversion routines normalize older font
descriptors into BFDs for editing.

### Manual, source, and release differences

The licensed media includes five Sage binary files titled *Font Editor*. Their
83 records cover concepts, entry and exit, drawing, gray plane, registers,
transformations, files, parameters, and mouse sensitivities. The document's own
front matter identifies Release 6.0, while these installed binaries were compiled
on 25 August 1993 under system version 451 and Sage 439. They are valuable
intended-use evidence but are not assumed to be a complete Genera 8.5 behavioral
specification.

Two examples show why the implementation was audited independently:

- the manual presents the user workflow, but the source establishes the hard-
  coded 128-character pane and 10-pixel sample-preview kern limit; and
- the source exposes `Draw Polygon` through command entry without a visible menu
  accelerator and considers, but does not bind, a `G` accelerator for Gray Char.

The manual payload remains ignored under `build/help/genera/` and is not linked
from publishable documentation. The tracked
[Genera Help extraction note](genera/online-help-and-documentation-recovery.md)
describes how to reproduce the local decode without distributing the prose.

## What happened to legacy FED in Genera?

The Genera software inventory names both a legacy `FED` and the newer Font
Editor. An exhaustive search of the distributed source inspected for this page
found the modern Bitmap Editor/Font Editor implementation and references to
“old FED,” but not a separately loadable legacy FED implementation. The
five-part installed book calls its subject Font Editor and overlaps conceptually
with the modern program; that does not prove that every record describes the
Genera 8.5 implementation, nor that the book is the Help for the separately
named legacy activity.

Until a system declaration, implementation file, activity registration, or live
launch establishes the relationship, the responsible catalog state is:

- legacy `FED`: name and historical presence established; implementation,
  features, bindings, and entry procedure `TODO`;
- modern Font Editor: implementation and source-level command surface
  established as documented above; and
- Release 6.0 Font Editor book: intended-use evidence with an explicit release
  boundary, not silently reassigned to either name.

## Cross-generation comparison

| Capability | Old FED | XFED | New-window FED | System 303 FED | Genera Font Editor |
| --- | --- | --- | --- | --- | --- |
| Main point stroke | Complement | Set | Erase/flip/draw ALU, initially flip | Latch/draw/erase/flip, initially latch | Draw/erase/flip, initially draw |
| Gray reference plane | No | No | No | Yes | Yes |
| Reusable registers | No | No | No | Yes, with geometry | Yes, raster only |
| Visible command menu | No | No | Four items | Full FED menu | Dynamic Windows Draw/Gray/Font menus |
| Undo/redo | No explicit history | No explicit history | No explicit history | No general undo history | Integrated undo/redo |
| Connected flood | No | Erase four-connected region | No exposed flood | Rectangle operations, no general flood command | Closed-region flood |
| Line/spline | No | No | Line visible; spline dormant in source | Both visible | Both visible; polygon command also exists |
| Font display/sample | Yes/yes | Yes/yes | Yes/yes | Yes/yes, including other FEDs' unsaved edits | Yes/yes, using current BFD and edited glyph |
| File formats exposed by editor | KST | KST | KST, QFASL, AL read | KST, QFASL, AC, AL, KS, AST | BFD, binary, PXL, BDF, AST, KST, AC, AL |
| Optional image capture | No | No | No | Medium-resolution frame grabber when color exists | No frame grabber in Font Editor; richer Bitmap Editor element types are separate |
| Runtime UI verified in this museum | No | No | No | Blocked before optional system load | Blocked because system was not loaded in the cold world |

The progression is not simply “more formats and more buttons.” System 303 FED's
registers retain character-box geometry, whereas Genera Bitmap Editor registers
are raster snippets. Genera gains general undo, Dynamic Windows presentations,
and a reusable image-editing substrate, but its Font Editor intentionally fixes
vertical glyph alignment at font level and limits direct bounding-box dragging
to horizontal edges.

## Runtime attempts and screenshot status

### System 303-0

The isolated CADR session `d30-fed-cadr-20260718`, generation 1, ran from
08:14:54 to 08:19:14 EDT on 18 July 2026. The base and private disk began as
SHA-256 `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The pinned public system source was `4df393c`, the private copy matched it, and
the executed `usim` SHA-256 was
`707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be`.

Calling FED by package name reported an undefined function because the optional
system was not resident. `(make-system 'fed :noconfirm)` then tried to retrieve
its configured source/binaries from `AMS-BRIDGE-1` and stopped with “Host not
responding.” The harness intentionally supplies no guest-visible file service.
This proves that the editor is absent from this band and that its configured
load path needs a file server; it does **not** prove that the FED implementation
itself fails.

The session stopped cleanly (`forced_stop: false`, `state_may_be_incomplete:
false`), both emulator and Xvfb exited with status zero, and the base disk was
unchanged. Raw captures show only the listener and load error. They are not
application evidence and were not selected for publication.

**Screenshot TODO:** build or obtain a rights-clear System 303 band with the
optional FED system already loaded, or provide the configured source tree
through a research file service, then capture the standard FED frame, gray-plane
merge, register menu, and—only if the required color subsystem can be reproduced—
the extended frame-grabber configuration.

### Genera 8.5

The clean Genera attempt is generation 3 of
`d30-font-editor-genera-20260718`, from 08:31:16 to 08:33:01 EDT on 18 July
2026. It used the licensed 54,804,480-byte `Genera-8-5.vlod`, SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`,
and VLM SHA-256
`9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`.
The action log records `Select` plus `{`, followed by direct command input
`Edit Font`.

The Select gesture left the cold listener unchanged and the direct command was
reported as not a command name. Static source establishes that `{` and `Edit
Font` are registered when the Bitmap Editor system is loaded, so the bounded
runtime conclusion is that the application was not loaded into this cold base
world. No attempt was made to broaden the isolated guest with a Symbolics site
or file service merely to satisfy this page.

The action log has four intent/outcome records and SHA-256
`b7299b03e8e8799b9bc3e60b57fc54fc2c16d350700f179525b09c51c317c09a`.
Shutdown reached the prompt, accepted confirmation, and made cleanup progress,
then encountered the already documented VLM cleanup deadlock and required a
bounded forced stop. Accordingly `forced_stop` and `state_may_be_incomplete` are
true; host shutdown was not orderly. The private and base world hashes remained
unchanged. The harness did not invoke Save World or create a process checkpoint,
and whether an in-guest save occurred remains unknown rather than inferred from
shutdown.

Raw captures show only the unchanged listener and command error. They do not
show the Font Editor, add no useful visual evidence to this article, and were
not selected for rights review or publication.

**Screenshot TODO:** in a fresh isolated session, load the licensed Bitmap
Editor system through an appropriately configured local Genera site, then
capture only the minimum scholarly evidence needed: the initial Font Editor
frame, one character with black/gray planes and metrics, one register or
transform interaction, and the format chooser. Each image must separately pass
the [runtime screenshot publication review](screenshot-publication-rights-review.md).

## Artifact identities

### Public MIT and LM-3 source

| Artifact-relative source | Bytes | Lines | SHA-256 |
| --- | ---: | ---: | --- |
| System 46 `src/lmio1/fed.165` | 45,423 | 965 | `06e39f1cfdb9fedb854a12b34c7500154bf07170999089641b81e7db72813ad5` |
| System 46 `src/lmio1/xfed.4` | 46,803 | 996 | `3f8b149b2f1fd431add42505ca62452b50de432ed7d82acfd89e14f24bf714d2` |
| System 46 `src/lmwin/fed.73` | 51,650 | 1,238 | `4ed4a9bc27bff080d2556b353909754552b6d5a51671fe9a4206ad1cd61c5c28` |
| LM-3 `l/sys/window/fed.lisp` | 137,801 | 3,374 | `57f7e15d01bdfe8856a88b47a1202ace0a0b107264a9047cf12dfc81ce9eb23c` |
| LM-3 `l/sys/sys/sysdcl.lisp` | 25,396 | 751 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` |

The System 46 sources are from public commit
`8e978d7d1704096a63edd4386a3b8326a2e584af` and carry the snapshot's
three-clause BSD license. The LM-3 rows match maintained Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.

### Licensed Genera implementation and Help

These identities permit local reinspection without publishing the proprietary
files or decoded Help. Paths are relative to the purchased release's `sys.sct`
tree.

| Artifact-relative path | Bytes | SHA-256 |
| --- | ---: | --- |
| `bitmap-editor/font-editor.lisp.~124~` | 33,589 | `ebe1564d4523c899eeb6229f085e0945c07f30a0010230e8c82914204864a8a6` |
| `bitmap-editor/font-editor.vbin.~3~` | 51,280 | `e3f8197d7b5b134af72441c7801b0f476578165c160e651a4728567f56f49a27` |
| `bitmap-editor/bitmap-editor.lisp.~284~` | 99,439 | `adf7a77c865743ec3c0d225789cd6f9e2535f08cf4565a56a7633230fc3f09fd` |
| `bitmap-editor/bitmap-editor.vbin.~3~` | 146,740 | `5a354631c9e659a553a909f6ba056695daf3ab038e2ea1187477acec2cd8c4ad` |
| `bitmap-editor/raster-plane.lisp.~67~` | 28,982 | `f2a56137eec430fd19b8ca7d332ff40b292f90d688314c18600f09529aeed2c6` |
| `bitmap-editor/sysdcl.lisp.~49~` | 3,288 | `8b513b8f584dc852d6254985d58aaf2e45ef8a75fb76b87bcc473306d7fb643a` |
| `bitmap-editor/documentation.sab.~40~` | 110,371 | `ecb968669c3f3df14f8ef2f8df850461160ee645cd05024223015b077dfe46c8` |
| `io1/bfd-misc.lisp.~1521~` | 31,955 | `51f7abfb588509ad0395481791c9809f8e8c94f84e9b86c1cd8041fbdedb7feb` |
| `io1/old-font-descriptor.lisp.~1509~` | 68,124 | `1aad0218626cb5995ebf3de3207b30bc6f7df5a0f828c1f099ce97f9e2184061` |
| `io1/pxl.lisp.~1520~` | 20,654 | `a1ebcf9dff32a8950b557c9765f2ff67466e1e9dd3a29bd5de8d627333a84bfb` |

The installed Font Editor book consists of five Sage binary files:

| Logical file | Bytes | Records | Compiled | SHA-256 |
| --- | ---: | ---: | --- | --- |
| `doc/installed-440/fed/fed1.sab` | 271,216 | 28 | 1993-08-25 17:00:55 | `4499f3d82284b4a95b8bc12ffaeabb379c7750210cec301f8e3d9fc033261d6b` |
| `doc/installed-440/fed/fed2.sab` | 24,103 | 14 | 1993-08-25 17:01:07 | `f52d564d806e42673991ad29f1d661b9a9ac00a0ed5b29f93fbbd844d664b844` |
| `doc/installed-440/fed/fed3.sab` | 790,618 | 23 | 1993-08-25 17:01:23 | `f67ef7c4f9654ed6bc63fd7f63c58d02bc9e2cf34439aa01c49577de470d9ac7` |
| `doc/installed-440/fed/fed4.sab` | 23,138 | 10 | 1993-08-25 17:01:50 | `111fd0f362cb8db961acbd3b37cf7e82733ac1a5162c83f14dc6d9f748cf9892` |
| `doc/installed-440/fed/fed5.sab` | 8,250 | 8 | 1993-08-25 17:01:55 | `38da0f2acd1576eaf4139fcb6abe6db26b3aaa11b4a5f334ba147b8e8f33d58d` |

All five record system version `[451,0]` and Sage version `[439,0]`. The decoded
copies remain local and ignored. This article paraphrases findings and contains
no recovered glyph raster, font file, manual passage, or proprietary source.

## Open questions

- What did the `X` in `XFED` mean, and was the variant deployed or only tested?
- Can the historical `NFED` filename be tied to a particular earlier version of
  `lmwin/fed.73` more precisely than the file map and flavor listing allow?
- Does a build of System 303 reproduce the likely `X`-binding shadow, or did a
  loader/patch alter the command table?
- Which exact release first added gray planes, registers, unsaved-change
  tracking, and the optional frame-grabber extensions?
- Where is the Genera activity or implementation separately named legacy `FED`,
  and how does it relate to the Release 6.0 Font Editor manual?
- Once Bitmap Editor can be loaded into the isolated Genera world, do the live
  menu labels, initial configuration, and character-pane behavior agree with
  the distributed source?

## Sources

- MIT CADR System 46,
  [`LMIO1; FED 165`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fed.165),
  [`LMIO1; XFED 4`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/xfed.4), and
  [`LMWIN; FED 73`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/fed.73),
  revision `8e978d7`; verified 2026-07-18.
- MIT CADR System 46,
  [`LMWIN` file map](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/filmap.2),
  [`FED` package declaration](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/pkgdcl.230), and
  [archive date inventory](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/wall.3),
  verified 2026-07-18.
- MIT CADR System 46,
  [source license](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/LICENSE),
  verified 2026-07-18.
- LM-3 System 303,
  [`window/fed.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/window/fed.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
  and
  [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  maintained check-in `4df393c`; verified 2026-07-18.
- Licensed Symbolics Genera 8.5 implementation and installed Font Editor Help,
  identified by artifact-relative path and checksum above; inspected locally
  2026-07-18 and neither linked nor redistributed.
- [MIT CADR font sources and recovery](mit-cadr/font-sources-and-recovery.md),
  [Genera resident font catalog](genera/font-catalog.md), and
  [the two computer-use harnesses](mit-cadr/cadr-computer-use-harness.md),
  [Genera](genera/genera-computer-use-harness.md), for the surrounding
  preservation and runtime methods.

Last verified: 2026-07-18.

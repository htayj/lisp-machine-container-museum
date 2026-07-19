---
type: Historical Article
title: Bitmap, stipple, and raster paint editors on CADR and Genera
description: A source-, help-, and runtime-grounded guide to MIT PAINT and NPAINT and the Symbolics Genera Bitmap and Stipple editors, including their complete local controls, data models, workflows, formats, limitations, and preservation status.
tags: [lisp-machine, mit-cadr, lm-3, genera, paint, bitmap-editor, stipple-editor, raster-graphics]
timestamp: 2026-07-18T08:51:05-04:00
---

# Bitmap, stipple, and raster paint editors on CADR and Genera

The MIT CADR and Symbolics Genera materials preserve two quite different ideas
of an interactive raster editor.

- CADR `PAINT` is a full-screen, direct-framebuffer painting program. Its
  patterns, brushes, menu, work surface, and volatile saved copy all live in or
  mirror the screen raster. It offers freehand patterned painting, single-pixel
  drawing, lines, circles, and bitmap-font text, but no durable image-file
  workflow.
- Genera's Bitmap Editor is a selectable Dynamic Windows application over a
  reusable, coordinate-aware raster-plane library. It edits named image objects,
  supports one-bit and deeper rasters, keeps black and gray planes, registers,
  an explicit crop box, undo history, geometric transforms, image-file import
  and export, and hardcopy.
- Genera's Stipple Editor inherits the Bitmap Editor machinery but specializes
  the bounding box as a repeating one-bit tile. Its ordinary `Save` produces a
  live stipple object; it does not by itself create a persistent file.

These are a conceptual family, not a proven straight source lineage. In
particular, the Genera implementation inspected here does not identify the CADR
`PAINT` source as its ancestor. Its closest explicit implementation context is
the later Font Editor framework described in
[FED and the Font Editor generations](fed-and-font-editor-generations.md).

“Complete” below means complete for the local command definitions, menu cells,
and gestures in the pinned implementations. It does not mean that a site patch,
dynamically loaded image-format system, or another Genera release cannot add a
command or format.

## Programs and evidence boundary

| Program | Preserved evidence | Established status | Runtime status in this audit |
| --- | --- | --- | --- |
| System 46 `PAINT` | Public `LMIO1; PAINT 7`, `DRAW 21`, loader, and PAINT QFASL at commit `8e978d7` | Complete source-visible UI and framebuffer implementation; the loader targets the compiled PAINT artifact. | No System 46 load band is currently connected to the harness. |
| System 46 `NPAINT` | Public `LMIO1; NPAINT 10` | An older, object/message-based implementation of the same `PAINT` entry point. | No System 46 runtime observation. |
| Maintained LM-3 `NPAINT` | Public `demo/npaint.lisp` and `io1/draw.lisp` at check-in `4df393c` | A lightly modernized copy of the System 46 NPAINT source, retained outside the active `HACKS` system. | System 303-0 did not have `PAINT` loaded. Loading the source was blocked before evaluation by the preserved machine's file-service/pathname setup. |
| Genera Bitmap Editor | Licensed Genera 8.5 source and installed Help | Complete implementation-level architecture, commands, gestures, image-object workflow, and source/help discrepancies. | Not run in this audit; the licensed Genera harness was reserved by a parallel application audit. |
| Genera Stipple Editor | Licensed Genera 8.5 source and the installed Graphic Editor book | Complete implementation-level specialization and installed command dictionary. | Not run in this audit. |

The public
[archive inventory](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/wall.3#L525-L554)
dates `NPAINT 10` to 14 January 1979, `PAINT 7` and `DRAW 21` to
16 February 1980, and the compiled PAINT and DRAW artifacts to 3 March 1980.
This establishes that `PAINT 7` is the later source in this snapshot. It does
not prove that the surviving QFASL was compiled byte-for-byte from that exact
source generation.

Both public source generations define a function named `PAINT`
([later source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/paint.7#L84-L90),
[older source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/npaint.10#L102-L120));
neither defines an `NPAINT` entry point. `NPAINT` is therefore a historical
file name here, not the program name typed by the operator. No primary source
inspected in this audit expands the initial `N`, so its meaning remains unknown.

## CADR PAINT

### What the two source generations represent

The later `PAINT 7` and older `NPAINT 10` expose essentially the same visible
program, but they represent their raster regions differently.

`NPAINT 10` defines a `PAINT-AREA-CLASS` whose instances know a source array,
origin, dimensions, and optional buffer array. Brush and paint selection copy
the chosen patch into a buffer, and BITBLT composes those buffered bits into the
screen. The maintained LM-3 file changes old quoted message selectors to the
newer form and adds a mode line, but an exact diff shows no redesign of the UI.

`PAINT 7` replaces that object protocol with compact structures and specialized
halfword operations over the screen buffer. Its `PAINT-AREA` carries both
one-bit and 32-bit views of the same storage, and its inner brush routine aligns
pattern words and combines them directly. This is an optimization and data-model
rewrite, not evidence for a different visible application.

The later file also declares `PAINT-LINE-ITEM`, `PAINT-PATH`, and `PAINT-TEXT`
structures. The active UI does not build a retained object scene from them.
Painting and shape commits alter the framebuffer immediately; these declarations
should not be misread as an Illustrator-like document model.

`DRAW 21` supplies the vector and circle rasterizers used by PAINT. It offers
both ordinary and raster-coordinate entry points. The raster variants use the
screen convention of an upper-left origin and increasing Y downward, and accept
logical raster operations such as IOR, AND-complement, and XOR.

### Startup and visible layout

The entry point is `PAINT`, with an optional input routine and a flag controlling
initialization. The default input routine is the mouse. With initialization
enabled, PAINT clears the screen and reconstructs the pattern and brush palette.

The program expects the old display representation for which its screen and
halfword-array operations were written. The later source explicitly switches to
the CPT screen when the current screen has an incompatible plane mask and notes
that this version is intended for 32-bit television storage. This is one reason
that source presence alone does not establish portability to the maintained
System 303 window environment.

The screen is divided functionally rather than into independent windows:

- a strip near the top holds nine paint-pattern swatches followed by eight
  brush swatches;
- the main framebuffer is the drawing surface, including the regions occupied
  by the palette and menu;
- the lower-left portion is temporarily made the console stream for prompts;
- a 120-by-12-pixel label at the upper right shows the current mode; and
- the menu is drawn directly into the screen rather than hosted in a separate
  window pane.

Because the UI is part of the same raster, `Restore Pallet` (the spelling in the
source) is a functional repair command. It redraws palette bits that painting or
other screen activity has damaged. It also reruns palette initialization, so it
resets the primary paint, alternate paint, and brush to their source defaults.

### Mouse-switch protocol

The source names the physical controls `top`, `middle`, and `bottom`; this page
retains those names rather than guessing how a particular host mouse maps them.

| Control | Context | Effect |
| --- | --- | --- |
| Top switch | Over a paint swatch | Make that swatch the current primary paint immediately. |
| Top switch | Over a brush swatch | Select that brush immediately. |
| Top switch | Over the menu | Point at a menu item and make its mode pending. |
| Middle switch | A menu mode is pending | Enter or execute the pending mode and clear the menu cursor. |
| Middle switch | Ordinary painting modes | Apply the primary paint or advance the current modal operation. |
| Bottom switch | Ordinary painting modes | Apply the alternate paint; initially that paint is all zeroes and therefore acts as an eraser. |
| Bottom switch | Line/circle mode | Toggle between line and circle, including while a rubber-band preview is active. |
| Bottom switch | Text mode | If the typed argument names a bound array, adopt that array as the text font and clear the pending text. |

After entering `Select Brush`, `Select Paint`, or `Select Alternate Paint`, the
operator points at the desired swatch and presses a drawing switch. The three
handlers do not distinguish middle from bottom, so either dispatches the same
selection and returns to Normal mode. Top over the palette remains the direct
primary-paint/brush shortcut described above.

The brush cursor is clamped so that half its width and height remain within the
screen. It blinks by XOR when idle. PAINT slows the blink while painting, and
some modes suppress it because cursor XOR would interfere with rapid drawing.

### Complete menu surface

The
[literal four menus](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/paint.7#L142-L160)
are:

| Menu | Entries in source order | Status |
| --- | --- | --- |
| Paint | `Select Menu`, `Draw Menu`, `Area Menu`, `Restore Pallet`, `Normal Mode`, `Xor Mode`, `Exit` | All have handlers. |
| Select | `Select Brush`, `Select Paint`, `Select Alternate Paint`, `Paint Menu`, `Exit` | All have handlers. |
| Draw | `Draw Direct`, `Draw Lines And Circles`, `Text`, `Paint Menu`, `Exit` | All have handlers. |
| Area | `Save Screen`, `Restore Screen`, `Mouse Upper Left`, `Mouse Lower Right`, `Define Area`, `Show Area`, `Select Menu`, `Paint Menu`, `Exit` | The first two and final navigation/exit cells have handlers. No definition or command property for the four middle area labels occurs in `PAINT 7`, `NPAINT 10`, or maintained LM-3 NPAINT. |

The four unimplemented Area labels are not merely absent from a manual: they are
inserted into the live source-defined menu without corresponding dispatch
definitions. They are best catalogued as stale or unfinished cells. Whether the
old menu package ignored them cleanly or signaled an error is a runtime `TODO`.

### Complete mode behavior

| Mode | Middle switch | Bottom switch | Preview and completion |
| --- | --- | --- | --- |
| Normal | Clear the brush mask region, combine the selected repeating paint through the mask, and write it back. | Perform the same operation with alternate paint. | Continuous while held. |
| XOR | XOR the brush mask into the picture; the selected primary paint pattern is not consulted. | Use ordinary alternate-paint composition, not XOR. | Continuous while held. This asymmetry is literal implementation behavior. |
| Draw Direct | Set the pointed screen pixel to one. | Set the pointed pixel to zero. | Continuous, with cursor blinking inhibited. |
| Draw Lines And Circles | First press sets the base point; second press commits the preview with IOR and returns to base-point state. | Toggle line/circle. | The moving candidate is repeatedly drawn and erased with XOR. |
| Text | Commit the blinking text at the current mouse point and clear the argument for the next placement. | Treat the argument as a possible bound font-array name. | Pending text is rendered in XOR using the current font, initially the screen default. |
| Exit | Selecting the menu cell enters its exit handler immediately. | No separate bottom-switch binding. | Restores the previous console output structure and returns true. |

The XOR-mode bottom-switch behavior is easy to miss in a feature summary. XOR
does not globally transform both drawing buttons into toggles; it changes only
the primary/middle path.

### Keyboard input

PAINT does not have a command-key table comparable to Zwei. Its keyboard path is
small and modal:

| Key | Effect |
| --- | --- |
| `Break` | Exit PAINT. |
| `Escape` | Invoke the ordinary keyboard escape handler. |
| `Rubout` | Remove the final character from the pending argument string, if any. |
| Any character code below octal 200 | Attempt to append it to the fixed 50-character pending argument array; the source has no explicit overflow handling. |
| Modifier bits | Discarded before dispatch. |

Ordinary typed characters matter visibly only in Text mode. The source interns
the whole pending string when the bottom switch is used to choose a font; it
accepts the choice only when the resulting symbol is bound to an array. This is
a powerful but unsafe historical interface: it selects a live Lisp array by
symbol name rather than choosing from a validated font menu.

Text is not retained as editable text. Its XOR preview is committed directly to
the screen raster. PAINT does not remember a string, font, or position object
that can later be selected and changed.

### Pattern and brush palette

The source contains nine paint seeds, each four rows high, and eight brush
seeds, each sixteen rows high. Initialization expands them into live UI rasters:

- each paint swatch occupies 40 by 40 pixels; the four-row seed repeats
  vertically and its short bit sequence repeats horizontally with phase
  alignment;
- each brush swatch occupies 20 by 20 pixels; its sixteen source rows are
  shifted into the displayed mask and the remaining area is padding; and
- paint swatches begin 42 pixels apart, while brushes begin 24 pixels apart.

This corrects two tempting but wrong readings of the source constants: the
paint swatches are not 32 by 32, and the brush swatches are not merely the
16-by-16 seed arrays. The user selects the expanded screen regions.

The initial alternate paint is the first, all-zero pattern. The initial primary
paint is the fifth pattern in source order, and the initial brush is the fourth
mask. Visual names such as “spray”, “brick”, or “circle” are not assigned here:
the source provides bit rows but no authoritative semantic names, and a runtime
palette has not yet been reached.

The older NPAINT buffers a selected pattern or brush, insulating its active
semantics from later damage to the visible swatch. The optimized PAINT source
instead reads from the live screen location during its halfword composition.
That architectural difference makes `Restore Pallet` especially consequential,
but a complete behavioral comparison after overwriting a selected PAINT-7
swatch remains a runtime `TODO`.

### Save and restore are volatile screen snapshots

`Save Screen` allocates an `ART-16B` array if necessary and copies the complete
framebuffer halfword array into it. `Restore Screen` copies that array back; if
no saved array is bound, it does nothing.

There is no pathname, image header, archive member, or file-format selector in
this workflow. The saved object is a Lisp-memory copy of the whole screen,
including the editor UI, not a durable painting document. It is closer to a
single volatile framebuffer checkpoint than to either an image archive or a VM
snapshot: it contains screen words only, not the Lisp process, menus, globals,
or machine state needed to resume PAINT.

The loader reinforces this narrow boundary. `LOAD.PAINT` loads compiled Mouse,
Menu, and Paint components; it does not install an image codec or persistent
painting format.

### Maintained LM-3 status and fresh runtime probe

The LM-3 Fossil tree retains NPAINT as
[`l/sys/demo/npaint.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/demo/npaint.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
with the draw primitives in `l/sys/io1/draw.lisp`. The active
[`HACKS` system](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
lists ABACUS, ALARM, BEEPS, CROCK, DOCTOR, MUNCH, QIX, and other demos, but not
NPAINT. The file is therefore retained source, not a declared default HACKS
component.

A fresh isolated System 303-0 run on 18 July 2026 established:

1. `(FBOUNDP 'PAINT)` returned `NIL` in the booted load band.
2. Loading `SYS: DEMO; NPAINT` requested a login to the configured
   `AMS-BRIDGE-1` file host and failed because that host was unavailable.
3. A bounded attempt to use the harness's local bridge reached its special
   `lispm` login, but host-keyboard pathname punctuation was translated into an
   incorrect guest pathname before source evaluation.
4. The session was stopped cleanly without modifying its private disk or source
   copies.

This run proves only that PAINT is not preloaded and that the retained source is
not presently loadable through the default preserved file-service path. It does
not prove that NPAINT is incompatible with System 303. No PAINT UI appeared, so
the run supplies no confirmation for menu rendering, palette appearance, or the
four stale Area cells.

The ignored capture `0004-fboundp-paint.png` has PNG SHA-256
`a170e293a11855520e7c92c2163b09333a533310aecc6d614187744a003f2552`
and pixel SHA-256
`58033154753f9e1c4f572c6077f6708e1028ec2bcb11ced70e288bb0c9c6a190`.
It was not curated into the museum: a screenshot of a false `FBOUNDP` result
does not materially illustrate PAINT's visible behavior. Publication should
wait for a successfully reached application state and the per-image review in
[the screenshot rights policy](screenshot-publication-rights-review.md).

## Genera's shared raster-plane editor framework

The Genera implementation separates the raster model from the visible
applications. Its `bitmap-editor` framework is not itself selectable. It
inherits the Undo Program, defines the shared commands and presentations, and
is then inherited by the standalone Bitmap Editor, Stipple Editor, and Font
Editor.

The subsystem declaration loads, in order, the raster plane, color adapters,
Bitmap Editor, Stipple Editor, and Font Editor after the broader graphic-editing
substrate. It is categorized as basic source but is not advertised as an
independent optional product.

### Raster-plane data model

A raster plane records:

- an optional underlying raster array;
- an external X and Y origin;
- logical width and height;
- array element type; and
- a default element, zero for integer element types.

The external coordinate space is unbounded in principle. Reading outside the
allocated logical rectangle returns the default. The first write lazily creates
at least a 32-by-32 backing raster. A write before the current origin reallocates
and shifts the previous contents; growth to the right or bottom rounds backing
storage upward in blocks of 256 pixels horizontally and 100 rows vertically.
Negative editing coordinates are therefore legitimate, not an error or merely
a viewport trick.

An `image-raster-plane` adds a color map. The library can find the nonzero filled
area, draw or clear planes, copy with a Boolean or fill ALU, swap complete planes
or rectangular subplanes, shift origins, reflect about four axes, rotate by
90, -90, or 180 degrees, duplicate or remove rows and columns, draw filled
rectangles and lines, render arbitrary graphics through a temporary bitmap
stream, flood a connected region, and manufacture the changed subplane needed
for undo.

Clearing a plane fills its allocated storage with the default and then resets
logical width and height to zero. It does not necessarily release the backing
array. Moving a plane normally changes its origin instead of copying pixels.

### Editor state and coordinate systems

The base editor owns:

- a **black plane**, the image being edited and saved;
- a **gray plane**, a 25-percent-gray reference and merge layer;
- cached display rasters and presentations for the grid and sample;
- display offsets, initially ten cells in each direction;
- scale, initially ten display pixels per raster cell;
- a dynamically sized array of registers;
- a movable bounding box;
- current drawing mode and foreground/background fill ALUs; and
- an edited flag.

Editing coordinate `(0, 0)` is the upper-left corner of the editing box, with Y
increasing downward. Black, gray, and register planes use those editing
coordinates and may extend into negatives. The displayed copy instead uses
scaled, scrolled window coordinates.

The distinction matters when moving the bounding box. After a box move, the
implementation shifts the origins of black, gray, and register planes by the
opposite amount while updating the display offset. The magnified grid therefore
appears unchanged, but the one-to-one sample moves. This command changes the
image's coordinate interpretation, not just a decorative crop outline.

### Redisplay, presentations, and undo

The grid is a Dynamic Windows presentation surface. Incremental redisplay
updates both visible pixels and the remembered image in presentation history.
The latter is necessary so that dismissing a typeout overlay restores current
bits rather than an old copy. Grid lines are displayed only at scale four or
greater. The gray plane is drawn through a 25-percent stipple, and the sample is
shown at actual size.

Point strokes record the old value of each modified cell. Larger operations save
the affected subplane or an invertible operation. Undo, Redo, Skip, and Clear
Undo History come from the inherited Undo Program; Help and Command Help come
from the Help Program where that program is inherited. This is a genuine action
history, not a second saved framebuffer.

## Genera Bitmap Editor

### Entry and pane layout

The selectable program's pretty name is `Bitmap editor`, and its Select key is
`}`. Code can also call `EDIT-IMAGE` or `EDIT-BITMAP`, choosing writable,
fixed-size, or read-only behavior and optionally waiting for the activity to
finish.

The standard frame contains:

- a one-line title;
- an actual-size sample at the upper left;
- a dynamically tiled register pane at the upper right;
- a large magnified grid;
- Help and Undo/Redo/Skip menus;
- a central drawing-command menu;
- current drawing-mode and gray-plane menus; and
- a four-line scrolling command interactor.

The main application defaults to a 64-by-64 bounding box when no image is
selected. `Create Image` accepts width and height of at least one, depths 1, 2,
4, 8, or 24 bits per pixel, and optionally supplies standard color maps for
four- or eight-bit images.

### Direct drawing gestures

| Gesture on a grid point | Immediate operation |
| --- | --- |
| Left press and drag | Draw through the current mode; a continuous stroke can change modifiers while it is in progress. |
| Control-Left | Temporarily erase in one-bit mode, or paint the background value in foreground/background mode. |
| Meta-Left | Temporarily draw in one-bit mode, or paint the foreground value in foreground/background mode. |
| Control-Meta-Left | Pass over points without altering them. |
| Middle | Cycle `Draw` to `Erase`, `Erase` to `Flip`, `Flip` to `Draw`; for deep rasters cycle `Foreground` and `Background`. |

The implementation recomputes Control and Meta state during a drag, not only on
the initial press. A user can therefore switch a single gesture between setting,
clearing, and passing over cells without releasing the mouse.

One-bit images expose Draw, Erase, and Flip. When the selected image has a
non-bit element type, the editor automatically switches to Foreground and
Background fill modes. `Set Pixel` changes either fill value, can sample a value
from a grid point, and can use the color chooser when a color map exists.

No application-specific character key table occurs in the source. Command names
are entered through the command interactor, while the menus and presentations
provide mouse accelerators. The `}` Select key is the only literal
application-selection character defined locally. Ordinary Dynamic Windows Help,
completion, editing, and command-processor controls remain inherited and are not
duplicated as if they were Bitmap Editor commands.

### Complete shared command inventory

The following table covers every source-defined command in the base Bitmap
Editor table, grouped by purpose.

| Group | Commands | Function and important arguments |
| --- | --- | --- |
| Drawing state | `Set Drawing Mode`, `Set Pixel` | Choose Draw/Erase/Flip or Foreground/Background; assign foreground or background pixel value. |
| Primitive drawing | `Draw Point`, `Draw Line`, `Draw Rectangle`, `Draw Polygon`, `Draw Spline`, `Flood Region` | Draw a stroke; two-point line; filled rectangle; polygon; cubic spline with at least three points; connected-region flood from a seed. |
| Black plane | `Clear All`, `Move Black`, `Stretch Column`, `Stretch Row`, `Rotate`, `Reflect Horizontally`, `Reflect Vertically`, `Reflect Diagonally` | Clear black and gray; translate black; duplicate/remove a selected row or column; rotate 90, -90, or 180 degrees; reflect across horizontal, vertical, or either diagonal axis. |
| Gray plane | `Swap Gray`, `Clear Gray`, `Merge Gray`, `Move Gray`, `Swap Region` | Exchange whole black/gray planes; clear gray; combine gray into black with a drawing ALU and optional clear-after; translate gray; exchange a selected rectangle. |
| View | `Refresh`, `Set Scale`, `Zoom by Factor`, `Zoom/Expand`, `Move View`, `Center View` | Force redisplay; set positive integer scale; multiply scale; fit a selected rectangle; pan; center the box. |
| Bounding box | `Move Bounding Box`, `Snap Bounding Box` | Drag the whole box or one edge; attach the nearest eligible edge/corner to a point and continue dragging. |
| Registers | `Retrieve Register Into Black`, `Retrieve Register Into Gray`, `Store Black Into Register`, `Store Gray Into Register`, `Clear Register` | Recall, save, or clear a dynamically allocated register plane. |

The Bitmap Editor program adds:

| Command | Operation |
| --- | --- |
| `Refit Bounding Box` | Fit to the nonzero black-plane area, with a minimum one-by-one box; fixed-size editing recenters the existing size. |
| `Edit Image` | Offer to save the current modified image, then edit another named image. |
| `Create Image` | Create an initially invisible named image with chosen dimensions, depth, and optional default color map. |
| `Save Image` | Copy the bounding-box region back into the live named image, subject to read-only/fixed-size policy. |
| `Hardcopy Bitmap` | Print the raster with printer, portrait/landscape/best-fit orientation, and numeric or best-fit scale. |
| `Done` | Offer to save a modified image, clear the editor's current image, and bury the frame. |
| `Read Image File` | Invoke the shared Images importer. |
| `Write Image File` | Invoke the shared Images exporter. |

It also inherits `Help`, `Command Help`, `Undo`, `Redo`, `Undo Skip`, and
`Clear Undo History`. The installed Bitmap Editor Help command dictionary is
older: it describes a dedicated `Read MacPaint File` command and omits the
source-defined `Set Pixel` and generic `Write Image File`. The implementation,
not that older topic list, establishes the current local command table.

### Menu and presentation accelerators

| Surface | Gesture | Command |
| --- | --- | --- |
| Drawing-mode label | Left/Select | Make that mode current. |
| Drawing-mode label | Menu/Right | For Foreground or Background, choose a new pixel value. |
| Grid point | Middle | Toggle the current mode as described above. |
| `Merge Gray` menu item | Left | Merge with the default/current arguments. |
| `Merge Gray` menu item | Shift-Left | Merge and then clear gray. |
| `Merge Gray` menu item | Right | Prompt for merge arguments. |
| `Stretch` menu item | Left | Stretch a column. |
| `Stretch` menu item | Shift-Left | Stretch a row. |
| `Stretch` menu item | Right | Choose row or column and arguments. |
| `Reflect` menu item | Left | Reflect horizontally. |
| `Reflect` menu item | Shift-Left | Reflect vertically. |
| `Reflect` menu item | Meta-Left | Reflect across one diagonal. |
| `Reflect` menu item | Meta-Middle | Reflect across the reverse diagonal. |
| `Reflect` menu item | Right | Choose axis and center/row/column. |
| Grid point, reflect translator | Left | Reflect horizontally about that row. |
| Grid point, reflect translator | Middle | Reflect vertically about that column. |
| Grid point, reflect translator | Control-Left | Reflect diagonally about that point. |
| Grid point, reflect translator | Control-Middle | Reflect about the reverse diagonal through that point. |
| Grid point, reflect translator | Right | Choose an axis through that point. |
| Grid point, rotate translator | Left/Select | Rotate 90 degrees counterclockwise about that point. |
| Grid point, rotate translator | Right | Choose 90, -90, or 180 degrees. |
| Bounding box or exposed edge | Left | Drag the deepest presented object: normally the edge when one is under the pointer, otherwise the whole box. |
| Bounding box | Shift-Left | Drag the whole box regardless of an edge presentation. |
| Grid point near the box | Shift-Middle | Snap the closest edge or corner within four cells to the point and drag. |
| Register | Select/Left when empty | Store black into it. |
| Register | Select/Left when occupied | OR its contents into black. |
| Register's operation menu | Contextual choices | Retrieve into black or gray, store black or gray, or clear. The source does not assign a unique literal mouse character to every choice. |

Register retrieval is not replacement. The implementation copies the register
into the destination with Boolean IOR, so existing set bits remain set. Storing
does replace the register, carries the image color map, and upgrades the
register's element type when the edited image depth changes. Every register
operation is undoable.

### Shape semantics and a flood discrepancy

Lines and rectangles use direct raster-plane primitives; rectangles are filled.
Polygon and spline drawing render through a temporary bitmap stream and then
copy the result through the current ALU. Polygon and spline require at least
three points. Shape commands save the affected subplane for undo.

For Draw/Erase/Flip mode, `Flood Region` deliberately uses XOR, so it complements
the four-connected region whose pixels match the seed. In Foreground/Background
mode it fills with the selected pixel value.

The active flood implementation always returns a raster plane, but the command
still tests for a false result and reports that the region is not closed. That
error path belonged to the commented-out previous algorithm, which returned
false when it could not find enclosing boundaries. It is unreachable through
the active definition inspected here.

There is a second source-visible edge case. The active algorithm defines its
maximum coordinate as origin plus width or height and tests it inclusively. For
a default-zero region connected to the raster edge, reads at that one-past edge
also return zero, so the result can include a one-cell apron outside the logical
plane. Runtime confirmation and a determination of whether later patches mask
this effect remain `TODO`.

### Scale and bounding-box edge cases

`Set Scale` accepts only a positive integer. `Zoom/Expand` enforces a minimum
scale of one. `Zoom by Factor`, however, accepts any number and passes the
rounded product to the same internal setter without validating the result. A
factor of zero, a negative factor, or a small factor that rounds to zero can
therefore install a scale that other redisplay code does not expect. This is a
source-visible validation gap, not yet a reproduced runtime failure.

`Refit Bounding Box` examines nonzero black pixels only; gray reference pixels do
not enlarge the result. Saving crops to the editing edges derived from the box.
In read-only mode, saving back is rejected. In fixed-size mode, the box is kept
at the image's size and copied only within the original dimensions.

### Named images, files, and formats

The persistence path has three distinct layers:

1. edits alter the Bitmap Editor's black raster plane;
2. `Save Image` copies the bounding-box region into a live Genera named-image
   object; and
3. `Write Image File` serializes a chosen named image through a currently
   registered image-file-format handler.

Stopping after step 2 does not necessarily write a host or Lisp-machine file.
Conversely, `Read Image File` can read several explicit or wildcard pathnames,
optionally rotate or trim each result, attach its source pathname and format,
assign a unique name when necessary, and register the resulting images. The
user then chooses one with `Edit Image`.

The file-format registry is dynamic. The base Image Substrate always defines
Symbolics `BIN`; distributed source modules additionally define handlers for
XBM, PBM, PPM, CBM, XIM, XWD, Utah RLE, TIFF, PCX, IMG, GIF, and Truevision,
while separate Color and PostScript systems define their own image and
PostScript handlers. Which names appear in a running Bitmap Editor depends on
which systems and patches are loaded.

`BIN` is a Symbolics binary form-dump containing image objects and can be loaded
to reconstitute those objects. It is serialized application data, not a disk
archive and not a VM snapshot. The other listed formats are image interchanges
with different read/write capabilities; source presence should not be promoted
to a claim that every handler is active or fully interoperable in the cold
museum world.

The generic reader still contains special options for PICT and MacPaint,
including optional Macintosh file headers and rotation guidance. No PICT or
MacPaint `DEFINE-IMAGE-FILE-FORMAT` registration was found in the inspected
distributed source tree, while the older installed Help exposes a dedicated
MacPaint command. This is release/help drift or a missing separately loaded
component, not evidence that MacPaint is available in the audited runtime.

### Deep-raster support is real but qualified

The implementation creates and displays 2-, 4-, 8-, and 24-bit rasters, carries
color maps through black, gray, and register planes, draws menu swatches for
foreground/background values, and replaces Boolean Draw/Erase/Flip with fill
modes for non-bit images. Those are concrete deep-raster facilities.

The same source labels its color adapter as a collection of “kludges” and
contains an old save-path comment saying an adjustment is temporary until the
editor supports deep rasters, even though the code preserves the current plane's
element type. The defensible conclusion is partial and historically layered
color support, not “one-bit only” and not “fully verified 24-bit paint program.”
Actual editing, color-map selection, and round-trip results for every supported
depth remain runtime `TODO`s.

## Genera Stipple Editor

### Purpose and layout

The Stipple Editor designs the repeating one-bit fill patterns used by the
Graphic Editor and graphics substrate. It is a selectable program named
`Stipple editor` with Select key `|`, and the Graphic Editor can also open it as
a modal designer that returns a new stipple object.

Its fixed 500-by-500 frame contains, in order:

- a one-line title;
- a sample occupying roughly the top quarter of the remaining space;
- the magnified editing grid;
- a two-line accepting-values pane for `Name` and optional `Gray level` from
  zero through one;
- the drawing-mode menu;
- the draw-command menu; and
- a three-line command interactor.

There is no register pane, no separate gray-command menu, and no standalone
image sample/register split. The black and gray planes and base command table
still exist through inheritance.

### Tile and sample representation

A new editor starts with an 8-by-8 bounding box. Editing an existing stipple
uses its declared repeat width and height and fits the grid with an extra factor
of four. The sample first copies the bounding-box cell horizontally into a
raster whose width is the least common multiple of the cell width and 32, then
tiles that raster across the pane. Any cell or box change therefore invalidates
the complete sample.

The least-common-multiple padding is a storage and BITBLT alignment detail, not
an enlargement of the logical repeat. On save, the resulting stipple array
records the original cell width as its X phase and retains the chosen name and
gray-level metadata.

### Controls and complete local command surface

Stipple drawing uses the same grid gestures, one-bit Draw/Erase/Flip modes,
Control/Meta temporary modes, shapes, transforms, black/gray planes, view,
bounding box, Help, and undo commands listed for the base Bitmap Editor.

Its complete installed/source command set is therefore:

- `Center View`, `Clear All`, `Clear Gray`, `Clear Undo History`, `Command Help`,
  `Draw Line`, `Draw Point`, `Draw Polygon`, `Draw Rectangle`, `Draw Spline`,
  `Flood Region`, `Help`, `Merge Gray`, `Move Black`, `Move Bounding Box`,
  `Move Gray`, `Move View`, `Refresh`, all three named Reflection commands,
  `Rotate`, `Set Drawing Mode`, `Set Pixel`, `Set Scale`, `Snap Bounding Box`,
  both Stretch commands, `Swap Gray`, `Swap Region`, `Undo`, `Redo`, `Undo
  Skip`, `Zoom by Factor`, and `Zoom/Expand`;
- `Save`, which constructs the current live stipple object; and
- `Done`/`Exit Stipple Editor`, which returns the object to a modal caller or
  buries the standalone activity.

The inherited register command names also occur in the installed Stipple Editor
dictionary: clear, retrieve into black/gray, and store black/gray. This conflicts
with the implementation layout. There is no register pane to present a register
argument, and store/undo code requests that pane when redrawing. The commands
are inherited at the command-table level, but usable register interaction in
Stipple Editor is not established. Treat it as a source/help inconsistency until
a live run determines whether the command processor hides, rejects, or errors
on those operations.

Gray-plane commands are similarly absent from a visible gray menu but have
ordinary command arguments and remain inherited by name. Their usability should
also be confirmed in the running activity rather than inferred from menu
absence.

Like the Bitmap Editor, the Stipple Editor defines no local character-command
table beyond its `|` Select key. `Name` and `Gray level` are edited in the
accepting-values pane; commands are invoked through menus, presentations, or the
command interactor.

### Save, Done, and persistence

`Save` constructs a `GRAPHICS:STIPPLE-ARRAY`, copies the bounding-box cell across
the aligned width, and stores it as the object currently being edited. `Done`
returns that object when the editor was opened modally or clears it and buries
the ordinary selectable activity.

For a newly designed pattern, the reliable implementation-level workflow is
therefore **edit, Save, then Done**. `Done` alone does not reconstruct the array
from unsaved grid changes.

The installed Graphic Editor book says that a new stipple remains embedded in
drawings that use it but is not retained in the sample-pattern menu across a
reboot. Its statement that stipples cannot be saved refers to this absence of a
persistent interactive Save-to-file workflow, not to an inability to create a
live stipple object.

The source contains a separate `WRITE-DEFSTIPPLE-FORM` utility. It writes a Lisp
definition form containing the repeat dimensions, name, and bit rows. No
Stipple Editor command calls it. It is a valuable preservation/export path, but
using it requires explicit Lisp evaluation or a museum script and should not be
described as a visible menu feature.

## Cross-system comparison

| Question | CADR PAINT | Genera Bitmap Editor | Genera Stipple Editor |
| --- | --- | --- | --- |
| Authoritative editable object | The live screen framebuffer | Extensible black raster plane plus bounding box, later copied into a named image | One-bit tile in the black plane, later copied into a stipple array |
| Secondary plane | No | Gray reference/merge plane | Inherited gray plane |
| Brushes/patterns | Eight fixed brush masks and nine fixed repeating paints drawn into the screen | Pixel brush plus drawing modes; no equivalent fixed brush-shape palette in this implementation | Pixel editing of one repeating pattern |
| Shapes | Direct points, lines, circles, bitmap-font text | Points, filled rectangles, lines, polygons, cubic splines, flood | Same inherited shapes |
| Coordinates | Physical screen raster | Unbounded editing coordinates with negative values and a separate view | Same raster-plane coordinates, bounded logically by repeat box |
| Undo | No operation history; one full-screen volatile save slot | Per-action undo/redo/skip history | Inherited per-action history |
| Durable save | None in PAINT | Named image in memory, then generic file writer | No direct file command; live stipple object, with a source-only definition writer |
| Color/depth | One-bit drawing semantics over old screen storage | One-bit and source-supported 2/4/8/24-bit images, with qualified color support | One-bit stipple cells plus gray-level metadata |
| UI model | One full-screen loop, direct menu and palette pixels | Dynamic Windows panes, command processor, presentations, menus | Specialized Dynamic Windows frame over the same base framework |

The biggest discontinuity is persistence. CADR's `Save Screen` is a volatile
copy of visible words. Genera's `Save Image` produces a named application object,
and `Write Image File` separately serializes it. Stipple `Save` constructs a
graphics design object but still leaves persistent definition writing outside
the visible activity.

## Implementation findings not evident from the manuals

The source audit adds or corrects the following points:

1. System 46 `NPAINT` and `PAINT` are source generations of the same `PAINT`
   entry point, not two independently invokable applications.
2. Four Area-menu labels have no handler in either public CADR generation or
   the LM-3 copy.
3. PAINT's XOR mode changes only the primary/middle drawing path; alternate
   paint remains ordinary composition.
4. CADR's paint and brush UI regions are 40-by-40 and 20-by-20 expanded rasters,
   not the seed dimensions.
5. PAINT saves the complete framebuffer in memory and has no image file format.
6. Bitmap Editor register retrieval OR-composes into the destination instead of
   replacing it.
7. Modifier state is re-read during a Bitmap Editor stroke, allowing mode
   changes without releasing the mouse.
8. `Set Pixel` and generic image writing are present in current source even
   though the older Bitmap Help dictionary does not list them.
9. The current flood function makes the old “region not closed” command error
   unreachable and has an inclusive one-past-edge case for boundary-connected
   default pixels.
10. `Zoom by Factor` can install a zero or negative scale because it bypasses
    the positive-integer validation used by `Set Scale`.
11. Stipple Help inherits register commands although the Stipple frame has no
    register pane.
12. Stipple `Save` makes a live tiled object; durable Lisp-source export exists
    only as an unexposed utility.

## Preservation and reconstruction guidance

### CADR

The public source is sufficient to reconstruct PAINT's algorithms, menus,
palette seeds, and controls without extracting a proprietary load band. A
faithful runnable reconstruction still needs an old-screen compatibility layer
or a port of the framebuffer assumptions. The maintained LM-3 NPAINT is useful
as a cross-check, but its presence in the Fossil repository does not make it an
active System 303 application.

A future runtime recovery should:

1. make the pinned `demo/npaint.lisp` available through the harness's local file
   service without changing its bytes;
2. record whether legacy `DEFCLASS` and direct screen operations load in System
   303;
3. capture the initial palette and all four menus;
4. test every mouse-switch path, especially the four handlerless Area labels;
5. demonstrate Normal, XOR, direct, line, circle, and text modes on disposable
   pixels; and
6. retain the session and only curate the smallest screenshot needed for the
   resulting historical claim.

### Genera

The licensed source and installed Help remain local, ignored research inputs.
This article paraphrases behavior and records checksums; it does not reproduce
source or Help payloads. A future live audit should use the isolated Genera
harness and separately exercise:

- a one-bit named image and a deep image;
- all five drawing modes and mid-stroke modifiers;
- black/gray merging and register OR retrieval;
- crop-box movement versus view movement;
- the flood and zoom edge cases;
- generic format availability in the actual loaded world;
- Stipple Save-then-Done and Done-without-Save; and
- inherited register and gray commands in the pane-reduced Stipple frame.

No Genera screenshot is included because no Bitmap or Stipple frame was reached
in this audit. Source-derived pane descriptions are labeled as such and must not
be silently promoted to runtime observations. When a frame is reached, review a
specific, minimal screenshot under
[the publication policy](screenshot-publication-rights-review.md) and place only
the reviewed image in `docs/assets/genera-screenshots/`.

Related museum material includes the public
[CADR visual-assets inventory](mit-cadr/visual-assets-inventory.md),
[CADR color inks and raster patterns](mit-cadr/color-inks-and-raster-patterns.md),
and [the Genera image/world recovery boundary](genera/recovering-code-and-assets-from-worlds.md).

## Evidence and provenance

### Public CADR and LM-3 files

| Artifact | Size | SHA-256 | Role |
| --- | ---: | --- | --- |
| System 46 `src/lmio1/paint.7` | 33,675 | `c5dd82f468f0ab685c2588615f69789220b114f212c966a0595107cb6ebcf60b` | Later direct-screen implementation |
| System 46 `src/lmio1/npaint.10` | 38,832 | `7969c4e49f907f638529feb347dcc0d6a860c1b662a295f3d3ecabd6b8979cc9` | Older buffered-object implementation |
| System 46 `src/lmio1/draw.21` | 13,160 | `a3490fb55ee56246c741171a751d56a4b225b14571c4c417db09cd7f324ae510` | Line and circle rasterizers |
| System 46 `src/lmio1/load.paint` | 89 | `f79e151c58d573946fbaf0448c2a88ea71a7b3561ab725a462a04156505cfab7` | Compiled-component loader |
| System 46 `src/lmio1/paint.qfasl` | 20,787 | `6ca641c88bcd9c38e177ec36388431bffceaa4ce55f18b164607eaa056406468` | Preserved compiled PAINT artifact |
| LM-3 `l/sys/demo/npaint.lisp` | 38,829 | `4bb4419317211db252a06632519424d0ac4b532419059662a49d5e887e64a0c5` | Maintained NPAINT copy |
| LM-3 `l/sys/io1/draw.lisp` | 13,212 | `5db9b81fe33f14ca447ec4715c0b75227a2fe2a6253f7fb26ed26c46d3506098` | Maintained draw primitives |

The System 46 snapshot is pinned at Git commit
`8e978d7d1704096a63edd4386a3b8326a2e584af`. The maintained LM-3 source is
pinned at Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
They were verified locally on 18 July 2026.

### Licensed Genera research inputs

| Logical artifact | Size | SHA-256 | Evidence use |
| --- | ---: | --- | --- |
| `bitmap-editor/bitmap-editor.lisp.~284~` | 99,439 | `adf7a77c865743ec3c0d225789cd6f9e2535f08cf4565a56a7633230fc3f09fd` | Program framework, commands, panes, gestures, images, registers, bounding box |
| `bitmap-editor/raster-plane.lisp.~67~` | 28,982 | `f2a56137eec430fd19b8ca7d332ff40b292f90d688314c18600f09529aeed2c6` | Raster representation, transforms, flood, growth |
| `bitmap-editor/stipple-editor.lisp.~15~` | 10,677 | `7cf4f5e637c912c90fbd42923ce46662648c82f354987795af277ea213230bac` | Stipple frame, tiling, Save/Done, source-form writer |
| `bitmap-editor/sysdcl.lisp.~49~` | 3,288 | `8b513b8f584dc852d6254985d58aaf2e45ef8a75fb76b87bcc473306d7fb643a` | Subsystem order and category |
| `bitmap-editor/color-kludges.lisp.~4~` | 7,830 | `697dc88dc864e808e1fe32d84cf9183ca9db7a760d13b8128d15b4923b26846f` | Deep-raster/color rendering adapters |
| `image-substrate/file-formats.lisp.~27~` | 38,632 | `0cf15874adb102eb2f7951d12069ea820bdd19e5995482819cac5adf729d8021` | Dynamic registry, BIN, generic read/write commands |
| Extracted Bitmap Editor Help text | 32,916 | `151a2f4500a1865afcc5df2e28110e6158c5ed21f52332d0e252cebede60c562` | 143-record installed command and program dictionary |
| Extracted *Using the Graphic Editor* text | 78,709 | `46676e83a32cee62c2743ff03a6d2d7d01be76958feda4940c826d8ad48a954d` | Stipple workflow and command dictionary |

The source and decoded Help remain ignored local inputs. The table is
evidence-only metadata and does not convey a redistribution claim.

### System 303 runtime record

| Field | Value |
| --- | --- |
| Session | `d31-paint-cadr-20260718`, generation 1 |
| Load band | `System 303-0` |
| Base and private disk at start | `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` |
| Private disk after stop | `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` (unchanged) |
| Public umbrella revision | `d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6` |
| Public System / USite / Chaos revisions | `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; `8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`; `db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e` |
| Public usim check-in | `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` |
| Private source revisions at copy time | Same System, USite, and Chaos revisions as above |
| Private System / USite / Chaos tree hashes | `21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`; `adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81`; `34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87` (all unchanged during the run) |
| `usim_sha256_at_start` / `usim_sha256_at_exec` | `707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be` / same |
| Private machine artifacts | `promh.mcr` `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6`; `promh.sym` `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d`; `ucadr.sym` `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |
| Toolchain | Python 3.11.14; Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`; manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d` |
| Selected window | `LOCAL-CADR [running]`, 768 by 963 at `(0,0)` |
| Final status | `usim` exit 0; Xvfb exit 0; `forced_stop: false`; `state_may_be_incomplete: false` |

The execution-time usim hash comes from `run.json`, not from a screenshot
sidecar. Raw session files and all unreviewed captures remain under ignored
`build/cadr-computer-use/` storage.

## Public sources

- MIT CADR System 46,
  [`LMIO1; PAINT 7`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/paint.7),
  [`NPAINT 10`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/npaint.10),
  [`DRAW 21`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/draw.21),
  [`LOAD.PAINT`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/load.paint),
  and the [archive inventory](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/wall.3).
- System 46 [source license](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/LICENSE).
- LM-3 System 303,
  [`demo/npaint.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/demo/npaint.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`io1/draw.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/draw.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  and the [`HACKS` system declaration](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).

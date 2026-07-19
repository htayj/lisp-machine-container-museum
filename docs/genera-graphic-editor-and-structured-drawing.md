---
type: Artifact Analysis
title: Genera Graphic Editor and structured drawing
description: An evidence-graded study of the Symbolics object drawing editor, its complete command and gesture surface, data model, file formats, integrations, and preservation boundary.
tags: [genera, graphic-editor, concordia, dynamic-windows, structured-graphics, preservation]
timestamp: 2026-07-18T09:10:00-04:00
---

# Genera Graphic Editor and structured drawing

## Conclusion

The Genera Graphic Editor is an object-based, two-dimensional illustration editor.
It keeps named drawings as ordered collections of editable entities, not as one flat
bitmap. A drawing can combine geometric shapes, curves, text, live Dynamic Windows
presentations, and raster images; entities retain control points, drawing options,
stacking order, grouping, and transforms. The editor can emit the same drawing as a
native editable drawing file, compact encoded graphics for Concordia, generated Lisp
drawing code, a raster image, or hardcopy.

This is not the Bitmap Editor and it is not established as a descendant or port of
the MIT CADR SUDS editor. The public CADR sets preserve SUDS `.DRW` data and `.PLT`
output plus a DPLT renderer, but not a complete runnable SUDS editor. Similarity at
the level of “structured drawing” is therefore not evidence of a direct lineage.

At the inspected Open Genera media boundary, the implementation contains:

- 16 registered entity types, of which 12 have samples in the always-visible Shapes
  pane, three more are constructible through `Create Entity`, and one (`Image`) must
  instead be created with `Add Image`;
- 13 interactive transform types;
- 57 active Graphic Editor-specific named commands, plus six inherited Help and
  Undo commands, for a source-defined surface of 63 commands;
- a seven-setting interaction-style form, a six-field display-parameter pane, and
  extensive entity, hardcopy, and drawing defaults;
- Dynamic Windows presentation semantics that can make an entity denote a typed Lisp
  object when the drawing is displayed outside the editor.

The installed help corpus has 61 unique topics named as Graphic Editor commands. It
omits three active implementation commands (`Read Image File`, `Write Image File`,
and `Convert File Format`) and still documents the separately named `Rotate Entity`
command, whose definition is commented out in the inspected source. Rotation remains
available through `Transform Entity`.

A fresh isolated Genera 8.5 harness run did not produce an editor frame. The base
world contained none of the `GRAPHIC-EDITOR`, `GRAPHIC-INPUT`, or `UNDO-PROGRAM`
packages, and `Select-G` made no visible change. Loading an optional licensed system
would have required a guest-side media path that the isolated session deliberately
did not provide. This page therefore has no published runtime screenshot and does not
claim that source-visible menus were exercised in that world.

## Scope and evidence notation

This page keeps four evidence classes separate:

- **Source** means direct inspection of the licensed local Open Genera source and
  system records identified by checksum below. Only original analysis and short
  identifiers are published; no licensed source is reproduced.
- **Installed help** means structural inspection of locally recovered Sage records.
  The recovered prose and embedded pictures remain ignored licensed output. Counts,
  topic names, and disagreements are reported as evidence.
- **Manual** means the public archival
  [Symbolics Concordia](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Symbolics-Concordia.pdf)
  PDF, especially “Getting Started with the Graphic Editor,” “Creating Shapes with
  the Graphic Editor,” and the “Dictionary of Graphic Editor Commands,” printed
  pages 237–316. This consolidated PDF is dated February 2018; that date describes
  the archival rendering and is not treated as the date of every underlying product
  statement.
- **Runtime observation** means the 2026-07-18 isolated Xvfb harness session described
  below. It establishes only what happened in that exact world and session.

“Complete” below means complete for the active definitions and installed records in
the inspected media snapshot. It does not assert that every earlier Symbolics release,
site patch, experimental subsystem, or separately loaded image format package had the
same surface.

## Release identity and component boundary

The media does not contain one version number called “the Graphic Editor version.”
Its system directories were written on 1998-09-04 in a source world reporting System
452.16 and identify three separately versioned components:

| System | Released version | Role in the declarations |
| --- | ---: | --- |
| `Graphic Editing` | 441 | Unadvertised substrate: `UNDO-PROGRAM`, `GRAPHIC-INPUT`, drawing utilities, and `GrEd-Doc`. |
| `Graphic Editor` | 440 | Unadvertised application: entities, transforms, editor frame, file format, and ZWEI integration. Depends on `Graphic Editing`. |
| `GrEd-Doc` | 432 | Installed Graphic Editor documentation system. |

The source snapshot also records Images 431.2, Image Substrate 440.4, Bitmap Editor
441, Graphics Support 431, and Symbolics Concordia 444 in that source world's system
header. Those are dependency-context versions, not aliases for Graphic Editor 440.
The fresh runnable world identifies itself as Genera 8.5, but the runtime test proved
that the Graphic Editor implementation was not resident there. Media presence and
world load state must not be conflated.

The system declaration marks both `graphic-editing` and `graphic-editor` with
`advertised-in nil`. It loads `defs`, `graphic-entities`, `transform`,
`graphic-editor`, `interim-file-format`, and `zwei` serially after the substrate.
MacDraw and QuickDraw PICT support are conditional modules: they are loaded only with
MacIvory Support and only on 3600 or IMach machine types. A separate
`graphic-editor-experiments` system is described as being for “the brave”; it is
outside this released-surface inventory.

## Identity, entry points, and Concordia integration

**Source:** the standalone Dynamic Windows program framework is named
`graphic-editor` and assigns Select key `G`. When the system is loaded, `Select-G`
selects its frame. It inherits the `help-program` and `undo-program` frameworks and
the `accept-values-pane` command table.

**Manual:** Concordia supplies a second route through its Graphic Editor subactivity,
documented as Super-Select-G or the corresponding Concordia selector. The standalone
and Concordia routes are not independent editors: they share the same global drawing
list, and a drawing created through one route is available through the other.

**Source:** the sharing is literal. Every program instance's
`graphic-editor-loaded-drawings` method reads and writes the process-global
`*all-loaded-drawings*` list. Selecting a drawing moves it to the front of that list,
giving it history-like recency ordering.

The application exposes three further integration paths:

1. A Sage picture type named `:graphic-editor` supplies an argument reader, a compact
   binary encoding callback, and an edit callback. Concordia can awaken the editor,
   select the named drawing, wait for `Done`, and receive the edited drawing.
2. The standard ZWEI command table gains `Insert Graphic Editor Drawing`, `Insert
   Graphic Editor Drawing Code`, and `Insert Image`. The first embeds compact encoded
   graphics; the second inserts an editable Lisp function that redraws the entities.
3. `Copy Drawing to Image`, `Add Image`, and `Edit Image` connect object drawings to
   the named-image and Bitmap Editor subsystems. The relationship is asymmetric:
   object entities remain editable in Graphic Editor, while an inserted image is one
   raster entity whose pixels are edited by Bitmap Editor.

These integration points explain why Graphic Editor belongs both to the Genera
graphics environment and to Concordia's structured-document workflow. See also the
separate [Dynamic Windows and presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md)
and [bitmap, stipple, and raster editor](bitmap-stipple-and-raster-paint-editors.md)
studies.

## Program frame and persistent state

### Pane layout

The source declares one fixed `main` configuration:

| Pane | Source-defined role |
| --- | --- |
| Title | Centered `Graphic Editor` program title. |
| Drawing | Typeout-capable display pane with ragged border, optional top and left rulers, horizontal and vertical scroll bars, a bottom drawing label, and white borders. |
| Interactor | Four-line command and output pane. Named commands not exposed in a menu can be typed here. |
| Help menu | A fixed one-item `Help` menu. |
| Undo menu | Fixed `Undo`, `Redo`, and `Skip` items. |
| I/O menu | Fixed drawing/file lifecycle and hardcopy items. |
| Selection menu | Fixed selection and grouping items. |
| Drawing menu | Dynamically assembled top-level entity commands in four columns. |
| View menu | Dynamically assembled display-transform commands. |
| Parameter menu | An always-visible Accept Values pane for handles, grid, pointer position, quantization, and rulers. |
| Registers | Three visible object registers, each displaying a scaled preview of stored entities. |
| Shapes | Mouse-sensitive samples of the 12 entity types that define sample geometry. |

The bottom label is more than a title. It displays the drawing name, associated file
when one exists, and a `[Not saved]` marker when the modified flag is set.

### Fixed and dynamic menu membership

The table records membership, not a runtime-verified pixel order. Fixed grouping and
row/column arrangement come from the framework declaration; dynamic membership comes
from the active command definitions and explicit menu handlers.

| Pane | Complete source-defined labels at this boundary |
| --- | --- |
| Help | `Help` |
| Undo | `Undo`, `Redo`, `Skip`; `Clear Undo History` is command-line only. |
| I/O | `Kill Drawing`, `Rename Drawing`, `Select Drawing`, `Read File`, `Write File`, `Hardcopy`, `Done` |
| Selection | `Deselect`, `Select`, `Select All`, `Select Region`, `Group`, `Ungroup` |
| Drawing | `Align`, `Bury`, `Change`, `Copy`, `Copy/Move`, `Copy/Transform`, `Create`, `Defaults`, `Delete`, `Delete All`, `Move`, `Raise`, `Transform` |
| View | `Center View`, `Fit View`, `Move View`, `Refresh`, `Reset View`, `Zoom by Factor`, `Zoom/Contract`, `Zoom/Expand` |

`Rotate` is not in the active Drawing-menu set: the separate command definition is
inside a block comment. The `Rotate` and `Rotate n degrees` choices inside
`Transform`, however, are active.

### Drawing and entity model

A drawing stores a name, optional associated file, modified flag, adjustable vector
of entities, selected-entity set, six-number view transform, and a “sketch” rendering
flag. Entities are ordered in the vector from back to front; raising, burying, and
restacking operate on that order. Selection is stored separately and sorted by the
entities' graphics priority.

Coordinates pass through three layers documented by the implementation:

1. device/window units are pixels, with the display's usual upper-left origin;
2. drawing/view units use a lower-left Cartesian origin and a per-drawing view
   transform;
3. user-visible ruler units are centimeters, inches, or pixels, converted through a
   separate display transform.

The initial constants are 35 pixels per centimeter, 90 pixels per inch, and 1.25
pixels per point. These are application constants for this source snapshot, not a
claim about physical calibration of every display.

Each entity has a name, outline and inside drawing-option property lists,
presentation data, its own control handles, computed bounding-box handles, and an
optional link to the entity from which it was copied. Shape-specific state stores
points, radii, angles, text sizing, arrow parameters, or image raster and scale.
Groups recursively contain entities and temporarily implode their Dynamic Windows
presentations into one group presentation.

### Presentation-bearing graphics

Graphic Editor entities can carry a presentation type and object. Inside the editor's
own Drawing pane, the implementation deliberately presents the entity as an editor
object so selection and manipulation continue to work. When the same drawing is sent
to another stream, a valid presentation-bearing entity wraps its graphics in a
Dynamic Windows presentation of the chosen type and object.

This is a semantic feature, not merely a hyperlink rectangle: the rendered figure can
participate in presentation translators and command input according to the object's
type. Generated Lisp drawing code preserves the wrapper when the presentation object
and type can be made printable. The compact binary path limits defaults to the set of
presentation types the graphics encoder declares encodable.

## Entity and shape inventory

### The 12 visible shape samples

| Shape | Stored structure and creation interaction |
| --- | --- |
| Rectangle | Four rectilinear vertices; drag a bounding rectangle. Moving a corner can turn it into a more general rectilinear polygon. |
| Triangle | Three vertices entered interactively. |
| Circle | Center and one radius; a moved handle can make its two radii unequal. |
| Rectilinear Ellipse | Axis-aligned center and x/y radii. |
| Oval | Center, two radii, and rotation; uses the oval drawing primitive. |
| Ellipse | General center, radii, and rotation. |
| Circular Arc/Sector | Center, radius, start angle, end angle, and optional second radius. Entry uses either endpoints-and-bow or center-and-radii according to interaction style. |
| Polygon | Point sequence, optional closure, and optional rounded or midpoint-spline corners. |
| Rectilinear Lines | Orthogonal point sequence with optional closure and corner shaping. |
| Freehand Curve | Sampled point sequence collected while dragging. |
| Text | String, character style, position, one of eight transform/sizing modes, and optional second control point. |
| Line | Two endpoints plus optional arrowheads at the start, end, or both, with configurable head length and base width. |

The samples are live defaults previews: changing outline, fill, character-style,
arrow, or rounding defaults causes the Shapes pane to be regenerated with the new
appearance.

### Registered types not shown as samples

| Type | Status |
| --- | --- |
| Quarter Ellipse | Constructible through `Create Entity`; two endpoints define one quarter of an ellipse. A degenerate case falls back to a line. |
| Be'zier Cubic | Constructible through `Create Entity`; endpoints are followed by two intermediate control points. The spelling shown here follows the installed type name. |
| Cubic Spline | Constructible through `Create Entity`; accepts a point sequence and uses cyclic relaxation when the points close. |
| Image | Registered as an entity so it can be serialized, selected, transformed, and rendered, but its ordinary entity-input method reports that an image cannot be entered that way. `Add Image` is the valid constructor. |

`Group` is another entity flavor, but it is intentionally absent from the Create
chooser. It is produced only by grouping existing entities. The right-click Create
chooser is built from all 16 registered shape entries, so source inspection exposes a
minor edge case that the visible samples hide: it can offer `Image`, but selecting
that route reaches the deliberate input error instead of creating one.

## Complete named-command inventory

### Counting rule and help comparison

The command count is reproducible from the licensed source without executing it:

1. remove top-level `#|| ... ||#` block comments from `graphic-editor.lisp.~351~`;
2. count the active `define-graphic-editor-command` forms and the active macro forms
   that expand into them: 53;
3. add `Show File Drawings` and `Convert File Format`, defined directly into the
   command table by `interim-file-format.lisp.~19~`: 2;
4. add `Read Image File` and `Write Image File`, explicitly installed from the Images
   subsystem: 2;
5. add the four commands inherited from `undo-program` and the two inherited Help
   commands: 6.

The result is 63 active named commands. Disabled debugging forms (`Where Am I`,
`Warp Mouse`, `Describe Entity`, and `Show Missing Help`) and the block-commented
`Rotate Entity` form are not counted.

The five recovered Graphic Editor Sage inputs contain 61 unique record topics ending
in “Graphic Editor Command.” Relative to the source-defined surface, they omit the
two generic Images commands and `Convert File Format`, and add the inactive separate
`Rotate Entity` command. This is why a documentation-topic count must not be used as
an implementation-command count.

### Drawing, file, image, output, and program commands

| Command | Operands and effect at this source boundary |
| --- | --- |
| `Select Drawing` | Accepts a loaded drawing or a string. A new string creates and selects a new drawing; an existing drawing moves to the front of the shared loaded list. |
| `Show Loaded Drawings` | Reports loaded drawings grouped by associated file and marks modified drawings not yet saved. |
| `Kill Drawing` | Undoably removes a chosen drawing. Killing the current drawing selects another loaded drawing or creates a new empty one. |
| `Read File` | Accepts a sequence of pathnames, expands wildcards, canonicalizes newest versions, reads every drawing, and warns before replacing modified or no-longer-present drawings from the same files. |
| `Write File` | Associates the current drawing with a pathname, then writes every loaded drawing associated with that pathname. |
| `Save Drawing` | Saves a chosen sequence or `All`; unassociated drawings prompt for a pathname. It can query when saving unmodified drawings or implicitly saving other modified drawings in a shared file. |
| `Rename Drawing` | Changes the current drawing's nonempty string name and updates the pane label. |
| `Set Drawing File` | Associates a drawing with a pathname or no file without itself saving. If an existing, previously unseen file is named, it can offer to read that file first. |
| `Copy Drawing` | Deep-copies the source drawing's entities, selection mapping, and view transform under a new name; the copy starts modified. |
| `Copy Drawing to Image` | Rasterizes the current drawing at a positive scale into a newly named image and makes it the default image. |
| `Show File Drawings` | Reads the `drawings-in-file` pathname attribute and lists drawing names without loading their bodies; accepts wildcards. |
| `Convert File Format` | Reads and rewrites each selected native drawing file using current format version 3; accepts wildcards. This is a mutating migration command. |
| `Read Image File` | Installed from Images. Accepts pathname and format plus `Rotate` and `Trim`; adds the decoded result to named images. Read formats documented in the installed command contract are BIN, Compact Bitmap, EPS/Macintosh, Gem IMG, GIF, Macintosh-by-type, MacPaint, PC Paintbrush, PICT, Portable Bitmap, PostScript, TIFF, Truevision, Utah RLE, X Bitmap, X Window Dump, and Xim. |
| `Write Image File` | Installed from Images. Accepts image, pathname, and format. Its documented write set is BIN, Compact Bitmap, EPS/Macintosh, MacPaint, PICT, Portable Bitmap, PostScript/EPSF, TIFF, and X Bitmap. |
| `Hardcopy Drawing` | Sends chosen loaded drawings to a printer or file with portrait/landscape and clip/scale/multiple-page handling. A single drawing written to a capable file stream gets an attempted EPS bounding box. |
| `Hardcopy File` | Hardcopies drawings associated with a pathname, reading and retaining the file's drawings first if necessary. |
| `Done` | Deselects the program frame and returns the current drawing through the editor mailbox used by callers such as Concordia. It does not itself write a drawing file. |

### Entity creation, selection, editing, and stacking commands

| Command | Operands and effect at this source boundary |
| --- | --- |
| `Add Image` | Accepts a named image plus independent x and y scale factors, positions it with the mouse, and adds one selected image entity undoably. |
| `Create Entity` | Accepts one registered shape plus optional starting coordinates, runs that shape's interactive input method, assigns a shape-derived serial name, and selects the new entity. |
| `Delete All` | Undoably clears every entity and the selection from the current drawing. |
| `Delete Entity` | Undoably removes the chosen or currently selected entities. |
| `Select Entity` | Selects a sequence of existing entities, optionally clearing the prior selection. Selection changes are themselves undoable. |
| `Select All` | Adds every current entity to the selected set. |
| `Select Entity and Move Selected` | Selects specified entities and immediately starts moving the resulting selected set. This is the hold-after-click path. |
| `Select Region` | Sweeps a rectangle and selects only entity presentations wholly contained in it; an option controls whether prior selection is cleared. |
| `Deselect Entity` | Undoably removes specified entities, defaulting to the entire selected set, from the selection. |
| `Move Entity Handle` | Drags one movable control handle and records the inverse displacement for undo. The manual correctly notes that the handle presentation makes this a mouse-only practical operation. |
| `Rename Entity` | Changes one entity's unique name, rejecting a case-insensitive duplicate; undo restores the old name. |
| `Move Entity` | Applies an interactive translation to selected entities. |
| `Transform Entity` | Applies one of the 13 interactive affine transform types listed below; the last transform type becomes the next chooser default. |
| `Copy Entity` | Copies selected entities and offsets them by 20 drawing units by default, adjusted to at least one grid unit when mouse quantization is on. |
| `Copy and Move Entity` | Copies the chosen entities and interactively translates the copies. |
| `Copy and Transform Entity` | Copies the chosen entities and applies a selected interactive transform to the copies. |
| `Align Entity` | Aligns selected entities by left/right/center/no x alignment and top/bottom/center/no y alignment, optionally aligning to the current grid. Defaults are left, no y alignment, and grid use matching grid visibility. |
| `Bury Entity` | Moves chosen entities to the beginning of the entity array while preserving their relative order, then redraws the affected overlap region. |
| `Raise Entity` | Moves chosen entities to the end of the entity array while preserving their relative order. |
| `Restack Entities` | For chosen entities that overlap, presents a reorder interface and replaces their stacking positions with the chosen sequence. It errors when fewer than two overlap. |
| `Change Entity` | Edits options common to the chosen entities: shape-specific state, outline, fill, and presentation data. A group cannot be jointly changed with other entities because no common option set is defined. |
| `Change Text String` | Changes only the strings of selected text entities while retaining their other text and drawing options. |
| `Edit Image` | Opens one selected image entity in Bitmap Editor, preferring its still-cached named-image raster when equal to the stored raster and otherwise editing the entity bitmap. Multiple images are rejected. |
| `Define New Pattern` | Invokes the Stipple Editor, interns a saved design in the `STIPPLES` package, and adds it to the available stipple and pattern lists. |
| `Group Entity` | Replaces selected entities with one recursively containing group entity and implodes their presentations. |
| `Ungroup Entity` | Replaces selected group entities with their contained entities and restores their individual presentations. |

### View, ruler, defaults, and register commands

| Command | Operands and effect at this source boundary |
| --- | --- |
| `Edit Ruler` | Edits unit, ruler visibility and increments, current grid size when relevant, and the page-outline overlay. |
| `Edit Defaults` | Edits initial options for subsequently created entities, command defaults, and the current drawing's sketch flag; the change is undoable. |
| `Edit Interaction Style` | Edits all seven global interaction variables listed below. Unlike entity defaults, these are process variables rather than per-drawing state. |
| `Refresh` | Redisplays the drawing while preserving the viewport. |
| `Zoom by Factor` | Composes a uniform scale with the drawing's view transform, default factor 4, preserving the viewport center. |
| `Reset View` | Undoably restores the identity view transform. |
| `Move View` | Takes two points and translates the view by their vector. |
| `Center View` | Translates the view so the entity bounding-box center coincides with the visible pane center; errors for an empty drawing. |
| `Fit View` | Uniformly scales and translates the entire nonempty entity bounding box to fit the drawing pane. |
| `Zoom/Expand` | Sweeps a nonempty region and makes that region occupy the whole pane. |
| `Zoom/Contract` | Sweeps a nonempty region and scales the previously visible view down to fit inside it. |
| `Retrieve Register` | Copies a register's entities into the drawing at a mouse-chosen position and optionally clears the register; the combined operation is undoable. |
| `Store into Register` | Copies selected entities into a named register, creating additional keyboard-only registers when a new name is given; optional `Delete Too` moves rather than copies them. |
| `Clear Register` | Undoably replaces a register's contents with empty state and resets its preview scale. |

### Inherited Help and Undo commands

| Command | Inherited behavior used by Graphic Editor |
| --- | --- |
| `Help` | Enters the standard Help program flow for a topic or mouse-selected command/shape/register context. |
| `Command Help` | Supplies standard help for command names and their operands. |
| `Undo` | Undoes the current history element, or a specifically selected element. Right-clicking the menu item opens a history chooser. |
| `Redo` | Redoes the next element or a specifically selected history element. A branch choice is requested when needed. |
| `Undo Skip` | Advances the current history position without replaying the selected operation. |
| `Clear Undo History` | Drops the whole history so its retained entity and drawing state can be reclaimed. It is not in the fixed three-item Undo pane. |

The undo history is a tree, not a single stack. Performing a new undoable operation
after moving backward retains the old successor and adds a new branch. `Undo` and
`Redo` right-click choosers linearize the tree for selection, while `Undo Skip`
chooses among immediate successor branches without applying the chosen element.

## Transform inventory

`Transform Entity` and `Copy and Transform Entity` use the same 13 active types:

| Transform | Interaction and result |
| --- | --- |
| 2 Point | Two points define a translation vector. |
| 4 Point | A starting and ending vector define translation and rotation. |
| 6 Point | Two triangles define the general affine mapping, including translation, rotation, scale, reflection, and shear. |
| Move | Interactive translation with image or outline feedback. |
| Reflect About Line | Two points define the mirror line; a zero-length line yields identity. |
| Reflect About Origin | Negates both axes about a chosen, center, or corner origin. |
| Rotate | Interactive rotation about the configured origin. |
| Rotate n degrees | Counterclockwise numeric angle from -360 through 360 degrees; default 90. |
| Scale | Uniform interactive scale about the configured origin. |
| Scale into Box | Uniform scale and translation that fit the entity bounds inside a swept nonempty box. |
| Shear | Interactive shear. |
| Stretch | Independent interactive x/y scale about the configured origin. |
| Stretch into Box | Independent x/y scale and translation that fill a swept box. |

The general transform is applied recursively to groups. Shape semantics can still
produce non-obvious results: for example, the manual warns that reflecting an arc can
select its complementary arc rather than merely flipping the displayed segment.
Without a loaded runtime frame, that release-specific visible result remains a
manual claim rather than a new runtime observation here.

## Keyboard and mouse interaction

### Keyboard surface

The active application source defines only one editor-selection key: `Select-G`.
There is no Graphic Editor-specific keystroke command table analogous to Zmacs's
large keymap. Named commands are entered in the four-line interactor using Dynamic
Windows Command Processor parsing, completion, histories, mouse-sensitive argument
presentations, and Accept Values forms. `Help` displays command completions and the
ordinary system input editor supplies editing and abort gestures; those inherited
keys are not reclassified here as Graphic Editor bindings.

The public Concordia manual also describes Super-Select-G for the Concordia
subactivity. That binding is Concordia-owned, not declared by the standalone
`graphic-editor` framework inspected here.

The manual's screen-image workflow uses Function-0-Q to create a named image before
`Add Image`. A compatibility block in `graphic-entities.lisp.~217~` would install a
different Super-Shift-Q “pass a screen image to Graphic Editor” function, but the
whole block is commented out. It is not an active binding in this source inventory.

### Menus and command arguments

- Left on a command menu item performs its default action. Middle requests help.
  The manual says Right in the Drawing pane opens an operations menu; the exact
  runtime contents were not reachable in the base world.
- Right on `Select Drawing` or `Kill Drawing` chooses from a drawing menu instead of
  accepting the default. Right on `Create` opens the registered-shape chooser.
- For entity commands, Left uses the selected set when one exists. Right chooses an
  entity when none is selected or opens an Accept Values form for additional
  operands. Commands whose additional operand is itself an interactive transform
  use their specialized chooser.
- Right on `Undo` or `Redo` opens the branching history chooser; Left uses the
  current/default element.
- Middle on a shape requests its shape-specific help, and Middle on a register
  requests register help.

### Drawing-pane gestures

| Context | Gesture | Source/help-defined effect |
| --- | --- | --- |
| Entity | Left | Select this entity and clear the prior selection. |
| Entity | Left, move while held | Select it and move the resulting selected set. |
| Entity | Shift-Left | Add it to the selected set. |
| Entity | Shift-Left, move while held | Add it, then move the entire selected set. |
| Movable handle | Left and drag | Reshape the entity by moving that control point. |
| Entity | Middle | Copy it with the default offset. |
| Entity | Middle, move while held | Copy and interactively move the copy. |
| Entity | Right | Open entity operations according to the manual. |
| Entity | Control-Middle or Control-Meta-Middle | Store into the leftmost register. The overview help says `c-Middle`; the command topic says `c-m-Middle`; source names the abstract `:yank-word` gesture. Runtime is needed to resolve the physical modifier mapping. |
| Ordinary/text/image entity | Control-Meta-Right | Source installs competing `:modify` translators: general Change, text-string Change, and Edit Image. Installed help assigns ordinary entities to Change and images to Edit Image, but also describes text characteristic editing. Translator precedence remains a runtime TODO. |
| Blank drawing | Left | Deselect the selected set. |
| Blank drawing | Left and drag | Sweep a contained-entity selection, clearing the old set. |
| Blank drawing | Shift-Left and drag | Sweep a contained-entity selection and add it to the old set. |
| Blank drawing | Middle and drag | Create a line, or an arrow when arrow defaults request one. |
| Blank drawing | Meta-Left and drag | Create another entity of the last-created shape. |

The source decides “click” versus “hold to move” by watching both mouse displacement
and button state; movement greater than four pixels starts the drag path.

### Multi-point shape gestures

Polygon, rectilinear-line, cubic-spline, and related point-sequence inputs share this
complete click classifier:

| Gesture | Effect |
| --- | --- |
| Left | Add the current point. |
| Shift-Left | Add the current point and finish. |
| Middle | Add the nearest already entered point, within an eight-pixel search threshold. |
| Shift-Middle | Add the nearest existing point and finish. |
| Right | Finish without adding a point. |
| Control-Left | Add a point forced to the current grid even when ordinary pointer quantization is off. |
| Control-Shift-Left | Add a grid-forced point and finish. |

The last two grid gestures are active source-visible behavior absent from the public
manual's point-entry table. A point sequence must contain at least two points.

### Register gestures

Three registers are displayed from left to right as `Register-1` through
`Register-3`. Left on an empty register stores the selected entities; Left on a
nonempty register retrieves a copy and then waits for Left to place it. Middle or
Abort cancels placement. Right supplies register operations including Clear. The
typed `Store into Register` command can create more named registers than are visible;
they remain retrievable by name.

## Display, appearance, and behavior defaults

### Always-visible parameter pane

| Field | Complete choices or behavior |
| --- | --- |
| Handles | `Control points`, `Control if selected`, `Bounding box`, or `Box if selected`. Initial value: bounding box only for selected entities. Lines always use their control points. |
| Display grid | Yes or No. Initial value: No. |
| Grid size | Positive user units; visible when either the grid display or pointer quantization needs it. Initial value: 1 centimeter. |
| Show mouse position | Shows user coordinates beside the pointer. Initial value: No. |
| Quantize mouse position | Rounds effective pointer coordinates to the nearest grid point. Initial value: No. |
| Display rulers | Shows the top and left margin rulers. Initial value: No. |

`Edit Ruler` selects centimeters, inches, or pixels. Changing unit resets suggested
major, minor, and grid increments to `1/.1/1` centimeters, `1/1/8/1` inches, or
`100/10/20` pixels. It can also show an 8.5-by-11-inch hardcopy outline with an inner
dashed region. The overlay is an editing guide and is not itself a drawing entity.

### Interaction-style form

The implementation registers all seven of these variables in one Accept Values form:

| Setting | Choices | Initial value |
| --- | --- | --- |
| Erase before moving | Do not erase, erase, or partially erase | Erase |
| Moving feedback | Image or outline | Image |
| Select transform origin | Choose, center, or corner of entity bounds | Choose |
| Text entry mode | One-line interactor input or Accept Values menu | Line of text |
| Circular arc input | Center and two radii, or two endpoints and bow | Two endpoints and bow |
| Default highlighting | Entity outline or bounding box | Outline |
| Sticky command defaults | Whether selected command options become later defaults | No |

These settings are global variables in the loaded Lisp world. They are neither stored
in each drawing nor serialized with the native drawing file.

### Entity and command defaults

`Edit Defaults` covers four different classes of state:

- **Entity-specific defaults:** polygon corners can be unrounded, rounded with a
  numeric radius, or smoothed by a midpoint cubic spline; text has a character style;
  lines can have start and/or end arrowheads with dimensions; and entities can have a
  default presentation type. When a presentation type is active, creation also asks
  for an object of that type.
- **Outline defaults:** not drawn, opaque, or non-opaque; thickness; solid or dashed
  with a dash pattern; for thickness greater than one, black/white/gray/pattern/color,
  butt/square/round ends, and miter/bevel/round/no joints.
- **Inside defaults:** not drawn, opaque, or non-opaque, filled black, white, gray,
  stipple pattern, or color when the output device supports color.
- **Command and drawing defaults:** zoom factor (initially 4), hardcopy behavior for
  oversize drawings (initially multiple pages), hardcopy orientation (portrait),
  numeric rotation (90 degrees), and the current drawing's faster-but-less-accurate
  sketch flag (initially false).

The initial outline property list contains only `opaque`; ordinary renderer defaults
supply its thickness and pattern. The initial inside list is opaque gray level .25.
Global entity defaults dynamically collect unrounded polygons, the system null text
style, no arrowheads, and no presentation type.

**Source-visible possible defect:** the Accept Values code offers four line-joint
choices, but when the chosen value is not `miter`, the inspected assignment stores
`miter` rather than the selected value. Source alone therefore suggests that bevel,
round, and no-joint choices are lost. This was not runtime-tested and is retained as
a probable implementation defect, not rewritten into a claim about every patched
release.

Text has eight transform modes organized by two decisions. It can preserve the
selected font or choose a different-size font as geometry scales. Within either
family, only the start can move, horizontal spacing can stretch, orientation/slope
can change, or glyphs can both tilt and stretch. This is why text remains a structured
entity rather than becoming outlines at creation time.

## File formats, encodings, and output paths

### Native editable drawing files

The native drawing file is a Genera dumped-forms container, default pathname type
`BIN`; it is not SVG, PostScript, a bitmap archive, or a VM snapshot. Writing calls
`sys:dump-forms-to-file` on a form that assigns the serialized drawings to
`*the-drawings*`. Reading calls the Lisp Machine binary loader in the Graphic Editor
package and reconstructs drawing and entity flavor instances.

The file carries generic pathname attributes for:

- `drawing-file-version`, currently 3;
- `drawings-in-file`, the list of drawing names;
- package identity for reading the forms.

A drawing's dumped form retains its name, entity vector, view transform, and sketch
flag. The associated pathname and modified flag are reconstructed by the reader, and
the selected set is not serialized. Entity forms retain the concrete flavor and its
shape variables and drawing/presentation options; control handles are rebuilt after
loading.

Version conversion is narrow and explicit. Versions before 2 and 3 translate older
text sizing keywords to the current eight-mode representation. The
[Genera 8.3 Release Notes](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Release_Notes.pdf)
also record an image compatibility repair: Concordia 3.1 replaced one `scale` slot
with independent `scale-x` and `scale-y`; the repaired reader recognizes the old
single scale and maps it to both axes. The inspected image-entity initializer contains
that compatibility mapping.

Before taking the native path, the reader checks file metadata for QuickDraw PICT or
MacDraw input. `FILE-TYPE` `PICT` selects the conditional PICT converter. `FILE-TYPE`
`DRWG` plus creator signature `MDRW` selects the conditional MacDraw converter. Those
modules are platform- and MacIvory-Support-dependent, so their presence in the source
declaration does not prove they are callable in an Open Genera VLM world.

Because native files are loaded as dumped Lisp forms, they belong on the trusted-data
side of a preservation boundary. A portable extractor should parse the FASD/dumped
form grammar inertly and whitelist reconstruction forms; it should not “extract” a
drawing by evaluating an untrusted file inside a museum world.

### Other representations

| Representation | What is retained and what it is for |
| --- | --- |
| Compact binary graphics | `drawing-binary-encoding` translates the drawing's lower-left bounds to the origin and asks the Genera graphics encoder to record its drawing operations. Concordia and ZWEI use this compact display form. It is optimized for replay, not for recovering the editor's full flavor graph. |
| Generated Lisp | `drawing-code` and `print-drawing-code` emit a drawing function composed from Graphics calls, group recursion, options, and printable presentation wrappers. This is source-like replay code, not the original hand-written source of an illustration. |
| Raster named image | `Copy Drawing to Image` draws into a bitmap at a selected scale. Entity editability and typed presentation semantics are flattened to pixels. |
| Images within drawings | `Add Image` stores raster, dimensions, position, name, and independent x/y scale as one object entity. Moving and affine transformation remain structured at the entity level, but pixel editing is delegated. |
| Hardcopy | Graphics are replayed to the hardcopy stream with portrait/landscape and clip/scale/multiple-page policy. A one-drawing file output attempts EPSF bounding-box metadata. |

The public
[Programming the User Interface](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf)
manual's advanced graphics chapter lists the corresponding binary encode/decode
facilities and identifies Concordia Graphic Editor illustrations as users of that
compacted graphics path (PDF page 1774). This independently corroborates the source
integration without treating the installed licensed picture payloads as publishable
assets.

## Architecture and dependencies

| Layer | Graphic Editor use |
| --- | --- |
| Dynamic Windows program framework | Pane layout, command loop, command tables, presentations, translators, menus, Accept Values, typeout, and Help inheritance. |
| `undo-program` | Branching undo elements and the four inherited commands. This is shipped in the `Graphic Editing` substrate rather than being a general Genera core package in the inspected declaration. |
| `graphic-input` | Pointer blinkers, coordinate display and quantization, drag feedback, point/shape entry, transforms, erasing and restoring presentations, and sample menus. |
| Graphics | Geometric primitives, transforms, scan conversion, stipple/color, bounding boxes, compact encoding, bitmap output, and drawing streams. |
| Images and Bitmap/Stipple Editor | Named-image file I/O, image entities, raster editing, screen-image workflows, and custom fill patterns. |
| Sage/Concordia | Picture type, compact illustration storage, edit callback, and structured-document embedding. |
| ZWEI | Commands to insert compact drawings, generated drawing code, and images into editor buffers. |
| Hardcopy/PostScript | Printer/file rendering, multipage behavior, and optional EPS bounding box. |
| MacIvory Support | Conditional MacDraw and PICT import modules. |

There is no private “canvas widget” concealing the data model. The Drawing pane is a
Dynamic Windows display/typeout stream; entities are drawn as presentations, and the
selection gestures are presentation-to-command translators. This explains behaviors
that look unusually semantic compared with later widget-based paint programs: menu
arguments can be filled by clicking drawing objects, group presentations can be
imploded and exploded, and the same output becomes a domain presentation outside the
editor.

## Findings not safely obtained from the manual alone

| Finding | Evidence and confidence |
| --- | --- |
| Separate `Rotate Entity` is inactive, but rotation is not absent | **High-confidence source finding.** Its command form is block-commented “Since in Transform”; both Rotate transform types remain active. The installed help and public dictionary still list the separate command. |
| Help and implementation counts differ | **High-confidence structural finding.** 61 unique installed Graphic Editor command topics versus 63 active source-defined commands, with the exact three omissions and one extra identified above. |
| The point input protocol has two grid-only gestures | **High-confidence source finding.** Control-Left and Control-Shift-Left are in the active click classifier but absent from the manual's point-entry table. |
| `Image` is offered by the all-types Create chooser but rejects ordinary creation | **High-confidence source finding.** The entity is registered; the chooser iterates the registry; its input method deliberately signals an error. |
| Bitmap editing is not integrated into undo | **High-confidence source limitation.** `Edit Image` contains an explicit implementation TODO saying it should be undoable and saves no pre-edit raster. It also rejects more than one image at a time. |
| Transform notification is unfinished | **High-confidence source limitation, user effect unknown.** `note-entities-transform` is an empty stub even though move, handle motion, and alignment call it. No manual contract establishes what notification was intended. |
| Non-miter joint choices appear to be discarded | **Probable source defect; runtime TODO.** The chooser accepts bevel, round, and none but the assignment stores miter for any non-miter choice. |
| Register modifier documentation disagrees with itself | **Installed-help disagreement.** The overview says Control-Middle; the command topic says Control-Meta-Middle. Source records only the abstract `:yank-word` gesture. |
| Drawings are shared more broadly than frames | **High-confidence source finding.** The standalone and Concordia editors share one process-global loaded-drawing list, not merely copies synchronized through files. |
| Logout saving is narrower than “save everything” | **High-confidence source finding.** A default-enabled application logout initialization offers to save modified drawings that already have files. Modified drawings with no associated file are not included in that automatic query. |
| File replacement is guarded | **High-confidence source finding.** The editor records last read/write file identity and creation information, warns when disk state differs, and separately warns about modified or missing drawings before a reread. |
| The old direct screen-to-editor function key is not active | **High-confidence source finding.** Its compatibility code and key installation are inside a block comment, despite manual workflows that still discuss screen capture through named images. |

These findings illustrate why the manual is evidence of intended use, not a complete
behavioral specification. Conversely, an unexercised source branch is not proof of
its rendered appearance. The unresolved physical gesture mappings and Accept Values
joint behavior remain TODOs until the optional editor can be run.

## Runtime attempt and screenshot boundary

### Result

Fresh isolated session `d32-graphic-editor-20260718`, generation 1, booted the licensed
base world successfully. In Dynamic Lisp Listener 1 the exact nonmutating query

```lisp
,(mapcar (function find-package)
         '("GRAPHIC-EDITOR" "GRAPHIC-INPUT" "UNDO-PROGRAM"))
```

returned `(NIL NIL NIL)`. The next recorded action sent Select followed by `g`.
After three seconds the selected Genera window remained the same Listener, with no
editor frame, message, or other visible change.

This proves that those packages and the Select binding were absent from this world at
that time. It does not prove that the systems cannot be loaded from the licensed
distribution. The session had no guest-visible host file service and loading optional
media was intentionally outside its nonmutating scope.

### Portable run provenance

| Item | Recorded identity |
| --- | --- |
| Session/window | `d32-graphic-editor-20260718`, generation 1; main window ID `4194310`, title `Genera on DIS-LOCAL-HOST`, 1200 by 900 at `(72,55)` on Xvfb `:200`. |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`; private copy matched at start and remained byte-identical at stop. |
| Debugger | `VLM_debugger`, 346,880 bytes, SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`. |
| VLM | `genera`, 1,533,760 bytes, execution SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`. |
| Purchased archive identity | `opengenera2.tar.bz2`, 206,213,430 bytes, SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`. |
| Configuration | Private `.VLM`, 285 bytes, execution SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`. |
| Legacy-command preload | Execution SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`; source SHA-256 `a4d126dbb6fd6f4903835bbb41c39652cfc53c91e942267dc9166c1c938c36e7`. |
| X compatibility preload | Execution SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`; source SHA-256 `4db1dee8e71d5ddc5cfd8289ecc3607738370ac97f856853786cfe713e94e392`. |
| RFC 868 responder | Source and execution SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`; one request and reply validated, evidence SHA-256 `36a22d8f4a25e1590202b4ac6ddb6632ab1ee066455ee7c0ce4988fb0daaae5a`, responder exit 0. |
| Harness sources | Shell entry `e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05`; Python harness `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; namespace helper `17a3e297930eef45a6f59a349f92ec1f6dc99b2c4d5caa2392dc0521636af01c`; VLM helper `cbf9ee0520b4892325266ed17afba8f1b663e7d266fea6d80de9cf98de17d2f8`. |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`, Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`; Python 3.11.14, Xorg Xvfb 21.1.21, xdotool 3.20211022.1, ImageMagick 6.9.13-5. |

The Bubblewrap run used separate user, mount, network, PID, IPC, and hostname
namespaces. Host root was hidden; the Guix store, exact helpers, and exact X socket
were read-only; only the private runtime was writable. The private `tun0` network had
no default/external route or guest-visible file service. Xvfb disabled MIT-SHM and
live verification found it absent. Both exact pinned guest-relay X substitutions were
observed before the session reached `running`; nonmatching writes were delegated.

The action log contains four entries—intent and outcome for the package query, then
intent and outcome for keys `F1`, `g`—and has SHA-256
`a9a27d01c1d43e854115691d5410dc8ded48298cca23d8d578d845d7f832484f`.
Two 1200-by-900 raw research captures remain in the ignored session tree:

| Capture | PNG SHA-256 | Pixel SHA-256 | Meaning |
| --- | --- | --- | --- |
| `0002-package-query.png` | `0a1d54875bac06ed08a068774176949d198a04a08ce7f71d4f69f7dfa8c9de9c` | `d24e89d8f9a7129e7e347965f079ef88061f94a597c18c080099565166e95a95` | Listener showing `(NIL NIL NIL)`. |
| `0003-select-g.png` | `865612be081dc8038a3572ec3d3b3b241b6f7eeb2b7201afd58490cbf85b64ce` | `15f7f9513b45b11f20b477466b982d629f92d8ece2eefdbb7afe6aa4b2090817` | Same Listener after Select-G; no Graphic Editor frame. |

Neither image is published: a Listener and vendor startup screen does not evidence
Graphic Editor's visible behavior, so copying it into the curated screenshot tree
would add screen content without supporting this article's application claims. A
future representative screenshot requires a safely loaded Graphic Editor frame, a
minimal synthetic drawing, and the image-specific review in
[Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md).

Shutdown evidence is deliberately separated. The VLM showed its shutdown prompt,
accepted `yes`, and showed cleanup progress, then reached the already characterized
confirmed stall. The harness bounded the wait and sent `SIGKILL`.
`forced_after_confirmed_shutdown_stall`, `forced_stop`, and
`state_may_be_incomplete` are true; `orderly_vlm_host_shutdown` is false. The harness
did not invoke Save World or create a host process checkpoint;
`save_world_performed` and `guest_checkpoint_created` remain unknown. The private and
base worlds were unchanged, so no persisted world mutation is inferred.

## CADR and LM-3 boundary

The public System 46 snapshot at commit
`8e978d7d1704096a63edd4386a3b8326a2e584af` and the maintained LM-3 System 303
Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`
were checked through the repository's existing
[visual-assets inventory](mit-cadr/visual-assets-inventory.md#suds-drawings-and-plot-streams)
and [software-area catalog](mit-cadr/software-areas-and-applications.md).

Those bounded sets establish:

- 324 SUDS `.DRW` files totaling 4,776,539 bytes;
- 86 `.PLT` streams totaling 669,231 bytes;
- a System 46 and System 303 DPLT program that reads 36-bit SUDS plot output and
  reproduces vector, text, and diamond commands for Dover/Press output;
- no complete runnable SUDS drawing editor in either inspected software set.

DPLT is a consumer and printer path for already exported plot streams, not evidence
of the editor that created `.DRW`. The SUDS artifacts are valuable structured-drawing
evidence, but this audit found no source-level names, file format, or implementation
chain tying Genera Graphic Editor 440 to SUDS. A historical relationship is therefore
**unknown**, not “obviously the same editor.” Decoding SUDS `.DRW` remains a separate
preservation task and should not borrow the Genera native-file decoder by analogy.

## Licensed artifact identities

All paths in this section are portable logical media locations. The underlying files
remain local licensed inputs.

### Principal source files

| `SYS:GRAPHIC-EDITOR;` file | Bytes | SHA-256 |
| --- | ---: | --- |
| `DEFS.LISP.~1~` | 4,707 | `4d093b08a242171c1afed583c3f1008f35193e52b95fe59dbc274e1837f94a96` |
| `DRAWING-FUNCTIONS.LISP.~20~` | 11,746 | `32816bed3036a3b8b7805c12b0a8ef514a449e9911b8ed31c57e4e17914b5259` |
| `GRAPHIC-EDITING-SYSDCL.LISP.~20~` | 5,036 | `2e43d308da6409e93b9927baeef3de7a7be7742d63e05b781698b612a42af04b` |
| `GRAPHIC-EDITOR-DOC.LISP.~16~` | 4,580 | `0c03a4ac21bb701d5962467da2ac2afadfb6ff0dd1eb5db0ad57f8936936aecd` |
| `GRAPHIC-EDITOR-SYSDCL.LISP.~28~` | 4,274 | `76d3f1ee146cbc1df901574e85e44a22a36e09eb893a145ff45edecbd70ad8f8` |
| `GRAPHIC-EDITOR.LISP.~351~` | 133,916 | `d041ed45c1bf5fd8c27f96d3383e3fac07f81efc918270ae3e0fb1011a968c4d` |
| `GRAPHIC-ENTITIES.LISP.~217~` | 96,716 | `d314d2b3bd7dc980b765f7a563c1288e5de465167dfe7e45676ba44eef0657d6` |
| `GRAPHIC-INPUT.LISP.~186~` | 97,192 | `ad8a61298245200bccb7febe532730078d39d0517ca8b85f9e8729fbfb633d2f` |
| `INTERIM-FILE-FORMAT.LISP.~19~` | 9,658 | `27214364b0f8ae1905eea6f019a06684b802b468881a8ee507c39aa3b22d2f77` |
| `TRANSFORM.LISP.~48~` | 13,975 | `4673be0a803858aaf099119e8aa00d697a90ca51d64a462aeee71b37361848bd` |
| `UNDO.LISP.~16~` | 12,680 | `ce9e4a764cda0615c0771a55b3430e0a2c96d4e74cd8d0d910b50f61efaf7e9f` |
| `ZWEI.LISP.~9~` | 5,447 | `2fefc01e894605c0563d4ba35cd4a83fe6d322f6a6212a74bc21cf620134e185` |

### System and help evidence

| Artifact | Bytes | SHA-256 | Evidence retained |
| --- | ---: | --- | --- |
| `GRAPHIC-EDITING.SYSTEM-DIR.~154~` | 11,614 | `7e4d8f401a2657a6bada3565c75747685becd047e641ab3568cae2e02de0e766` | Released 441 and source-world header. |
| `GRAPHIC-EDITOR.SYSTEM-DIR.~188~` | 14,271 | `2c55c82c81bd5cca7e4908e62e8ba87db3e55db57cbcff1f2d852dc33073daea` | Released 440 and source-world header. |
| `GRED-DOC.SYSTEM-DIR.~83~` | 8,689 | `66f474555f27abc1102faa658de27955a46429140ccc742133b241513f359184` | Released 432 and source-world header. |
| `DOCUMENTATION.SAB.~111~` | 556,419 | `e8f695ea55be41f09351fefdec9fcb3e3182cf359e40e990af8eab93c668d6f6` | 126 records, 58 embedded pictures, 395,255 embedded byte-array bytes. |
| `USING-GRED.SAB.~136~` | 853,599 | `c39a1528900e39e7e7c39aafbad55bb8226f86627c117407704f31f95869a011` | 92 records, 53 embedded pictures, 679,645 embedded byte-array bytes. |
| `GRAPHICS-IN-DOC.SAB.~69~` | 75,638 | `c5448cfff633e14c14387f415e3821b229765a3abac66358fb9e2318d5eb9d51` | 15 records and 8 pictures. |
| `PICTURE-RECORDS.SAB.~19~` | 24,077 | `024cc636348da8035b105ae57b4a0e7a2ffc196325f3a3fe47bd10d552884307` | 5 picture-bearing records. |
| `SHARED-DOCUMENTATION.SAB.~12~` | 6,602 | `c9e5b26d6c76a1fb415e7154572ed8c3211694e850467708ab68f89fce82ae96` | 9 shared records. |
| `CP6.SAB.~50~` | 76,382 | `26e2b0a9a81295f7d3af4aab7c91a51c0bd04c9873dec96d646d873413297d51` | Installed global command contracts for image file I/O. |

The public Concordia PDF inspected for the manual comparison is 3,121,750 bytes,
508 pages, SHA-256
`4b4625068731f1da52d2c0c8d0b50baf76c41707d237b9909339f378d22b7dfe`.

## Open questions and next preservation work

- Provide the isolated world a rights-safe, read-only path to the already owned
  optional system binaries, load exactly Graphic Editing 441 and Graphic Editor 440,
  and repeat the Select-G test without configuring a Symbolics site.
- Capture a minimal frame and synthetic geometry through the harness, verify actual
  menu ordering, right-click menus, Control-Middle versus Control-Meta-Middle,
  Control-Meta-Right translator precedence, and non-miter line-joint behavior.
- Review only the smallest representative frame/synthetic-drawing screenshot under
  the repository's per-image four-factor process; do not publish installed Help
  pictures or a decorative interaction sequence.
- Build an inert native drawing-file inspector that recognizes the version-3 dumped
  forms and whitelists `remake-drawing`/`remake-entity` data without evaluating Lisp.
- Compare older system directories and release media to establish when the
  `graphic-editing` substrate, Sage picture type, and current entity registry first
  appeared. Copyright-year ranges alone are not sufficient lineage evidence.
- Decode CADR SUDS `.DRW` independently, then compare its actual object and transform
  model with Genera only after both formats are established.

## Sources

- Symbolics, [*Symbolics Concordia*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Symbolics-Concordia.pdf),
  “Getting Started with the Graphic Editor,” “Creating Shapes with the Graphic
  Editor,” “Managing Drawings,” and “Dictionary of Graphic Editor Commands,” printed
  pages 237–316.
- Symbolics, [*Genera 8.3 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Release_Notes.pdf),
  “Graphic Editor Image Scaling Fixed,” printed page 309.
- Symbolics, [*Programming the User Interface*](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf),
  “Other Advanced Facilities for Graphic Output,” printed page 1774.
- Local licensed source and installed Sage artifacts identified by exact byte size and
  SHA-256 above; inspected without adding their content to Git.
- [Visual assets in the MIT CADR and LM-3 software](mit-cadr/visual-assets-inventory.md)
  and [MIT CADR and LM-3 software areas and applications](mit-cadr/software-areas-and-applications.md),
  for the pinned public SUDS/DPLT boundary.
- [Operating Genera through the Xvfb computer-use harness](genera/genera-computer-use-harness.md),
  for the execution and provenance model used by the runtime attempt.

Last verified: 2026-07-18.

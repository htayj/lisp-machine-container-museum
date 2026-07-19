---
type: Historical Article
title: CLIM 2 demonstrations and tutorial programs on Genera
description: A manual-, source-, media-, and runtime-bounded guide to every CLIM Demo, CLIM Tutorial frame, and CLIM test-suite program shipped with the inspected Genera 8.5 media.
tags: [genera, clim, clim-2, demonstrations, tutorial, applications, preservation]
timestamp: 2026-07-18T13:03:27-04:00
---

# CLIM 2 demonstrations and tutorial programs on Genera

Symbolics CLIM 2 shipped a small application museum of its own. The inspected
Genera 8.5 media registers seventeen `CLIM Demo` chooser entries: sixteen
ordinary demonstrations plus a Test Suite launcher whose body must be loaded
separately. It also contains five successive Fifteen Puzzle tutorial frames, two
source stages of a least-squares plotter, and Tic-Tac-Toe. They are teaching
programs, not product-quality address management,
aviation, CAD, painting, process administration, or development tools.

This article accounts for every exact D59 census name. It records the visible
model, all application-defined commands, controls, keys, and presentation
gestures, the state and file formats, source architecture, dependencies, and
meaningful discrepancies between the manual and implementation. It deliberately
does not copy the licensed source or installed tutorial prose.

The implementations could not be launched in the preserved base world. A fresh,
isolated Genera harness run established that no CLIM package, feature, or
CLIM-named system was loaded. The descriptions below are therefore **manual and
source findings**, not claims of observed pixels. Every program retains an
explicit screenshot TODO instead of substituting an ordinary Genera Listener
image for the missing application.

## Scope, evidence, and interaction conventions

The evidence layers answer different questions:

| Evidence | What it establishes | Boundary |
| --- | --- | --- |
| Symbolics *Common Lisp Interface Manager (CLIM), Release 2.0* | The tutorial progression, intended demonstration techniques, launch procedure, and supported CLIM concepts. | Public contemporary manual. It is not exhaustive about controls or source defects. |
| Recovered installed CLIM User's Guide and tutorial books | The same shipped documentation as Genera Help, including its exact release-local topic organization. | Licensed decoded text remains ignored under `build/help/genera/`; this article paraphrases it. |
| Licensed `SYS:CLIM;REL-2;DEMO;`, `TUTORIAL;`, and `TEST;` source | Exact frames, panes, commands, gestures, defaults, algorithms, data, conditional compilation, stubs, and defects described below. | Inspected locally; no proprietary source or compiled body is reproduced or tracked. |
| Compiled `.vbin` inventory | The twenty Demo modules and the test suite were shipped as compiled artifacts. | Presence does not establish that they were loaded into the saved world. The Tutorial directory is source-only in this media copy. |
| Isolated Genera runtime | CLIM was absent from the base world, so none of these frames was runnable without adding a guest-visible optional-system path. | Session and hashes are recorded in the runtime section. |

All programs are CLIM application frames. A frame owns application state and a
layout of panes; its command table owns typed commands and menu inheritance;
presentations connect displayed objects to Lisp objects; translators turn a
gesture over a presentation into a command; `accepting-values` and gadgets form
dialogs; output records retain visible structure; and incremental redisplay
updates selected records rather than blindly redrawing a whole pane. Those are
portable CLIM concepts. Genera-specific activity registration, Select keys,
filesystem calls, process operations, and printer integration are identified as
such.

Application tables below use CLIM's semantic gesture names. On the inspected
Genera port, `Select` is the ordinary left-button action, `Describe` is the
ordinary middle-button action, and `Delete` is Shift-Middle. A source-defined
modified gesture is spelled out literally. `Edit` is retained by name where the
application relies on the port's standard edit gesture; no unverified physical
mapping is invented. Right invokes the context menu of currently applicable
presentation translators. The complete common 36-command input editor,
activation, completion, abort, and command-entry bindings are documented once in
[CLIM 2 on Symbolics Genera](clim-2-on-genera.md#complete-default-genera-interaction-inventory)
and apply to accepted text in these frames unless an application shadows them.

### Loading and the chooser

`CLIM Demo` is a distinct optional system requiring `CLIM`. Its declaration
loads the package and chooser first, then the listener, graphics, CAD, navigation
data and functions, puzzle, address book, Thinkadot, plotter, color chooser,
graphics editor, bitmap editor, Ico, browser, Peek, custom-record demo, and
Activity demo. On Genera, `Demonstrate CLIM` invokes the chooser; portable code
can call the chooser entry point. The chooser sorts the registered display names,
adds `Exit`, and repeatedly runs the selected starter with one frame manager.
The installed patch directory records CLIM Demo 72 as both released and latest;
that is the release boundary for this inventory.

The declared menu names are Address Book, Bitmap Editor, Browser, CAD Demo,
Color Chooser, Activity Demo, Flight Planner, Graphics Demos, Graphics Editor,
Ico Demo, Lisp Listener, Peek, Plotting Demo, 15 Puzzle, Custom Output Records,
Thinkadot, and Test Suite. `Test Suite` is registered unconditionally, but its
starter does nothing unless the separately supplied test function is already
defined. This is a source-visible integration trap: loading `CLIM Demo` alone
does not load the test body.

`CLIM Tutorial` is another system requiring CLIM. It compiles the five puzzle
stages, the two least-squares stages, and Tic-Tac-Toe only when its
`Compile-Tutorial` feature is enabled. Both least-squares files define a frame
named `lsq`; they are successive alternatives, not two simultaneous applications.

## address-book

`address-book` is a volatile, shared address list that demonstrates presentations
and incremental redisplay. It has a current-address pane, a sorted names pane,
and an interactor. Five sample contacts seed a global list; every Address Book
frame in the same Lisp shares that list.

| Direct interaction | Effect |
| --- | --- |
| `New` | Opens an accepting-values dialog for Name, Address, and Number, all strings. |
| `Delete` | Deletes the current address. |
| `Quit` | Exits the frame. |
| Select a displayed name | Makes that entry current. |
| Delete an address presentation | Removes that entry. |
| Select its Name, Address, or Number field | Accepts a replacement value for just that field; renaming also resorts the names pane. |

Entries are sorted by the substring after the final space in the name, making
the last word act like a surname. The implementation rejects a new entry whose
name matches an existing name case-insensitively, but gives no duplicate warning.
There is no save, load, import, export, or address-book file format. The manual
summarizes lookup, add, remove, and edit; the shared global database, sort rule,
and silent duplicate suppression are source-only findings.

Dependencies are CLIM Demo, accepting-values, presentations, and incremental
redisplay. Safety impact is limited to volatile Lisp state. **Screenshot/runtime
TODO:** launch and capture the names/current-address/edit states after CLIM and
Genera-CLIM can be loaded into an unsaved isolated world; currently blocked by
the absent CLIM system.

## CLIM bitmap-editor

The CLIM `bitmap-editor` is an 8-by-8 pattern exercise, not the full Genera
Dynamic Windows Bitmap Editor documented in
[Bitmap, stipple, and raster paint editors](bitmap-stipple-and-raster-paint-editors.md).
Its three panes are an accepting-values palette, a magnified cell grid, and a
live preview of the resulting CLIM pattern. Defaults are eight rows, eight
columns, ten-pixel cells, and a two-entry black/white palette.

| Direct interaction or control | Effect |
| --- | --- |
| Select a grid cell | Advances that cell to the next palette index and refreshes the preview. |
| Palette radio choices | Select a nominal current color. The cell command does not use it. |
| `Add Color` | Opens `color-chooser` and appends the returned color. |
| `Edit Color` | No operation; explicitly left as an exercise. |
| `Delete Color` | No operation; explicitly left as an exercise. |
| `Choose Options` | Opens sliders for Rows and Columns, each 1–256, and Cell Size, 10–100. |
| `Quit` | Exits the frame. |

Resizing allocates a new array, preserves the overlapping old rectangle, fills
new cells with palette index zero, and relays out the frame. The preview builds
a CLIM `pattern` from the index array and palette. The manual explains the grid
and preview connection but does not disclose three important implementation
facts: selecting a cell cycles rather than paints with `current-color`, both
color-editing buttons are stubs, and there is no save/load/export path. No image
file is read or written.

Dependencies are CLIM Demo, accepting-values, gadgets, colors, patterns, and the
demo color chooser. Safety impact is confined to volatile pattern and palette
state; the program performs no filesystem I/O. **Screenshot/runtime TODO:**
capture palette, grid, preview,
and Options after optional CLIM loading is possible; the base world has no CLIM.

## browser

`browser` is an extensible graph/text browser over live Lisp and Genera objects.
Its scrollable graph pane uses incremental redisplay, its interactor accepts
commands, and a modeless control pane selects the browser family and rendering
options.

| Control-pane field | Choices or range |
| --- | --- |
| Browser type and subtype | Function: callees/callers; Class: superclasses/subclasses; Package: uses/used-by; Filesystem: filesystem; Lisp object: objects. |
| Starting depth | Integer 1–10. |
| Merge duplicate nodes | Boolean. |
| Automatic snapshots | Boolean; snapshots precede root/type changes when enabled. |

| Command or gesture | Effect |
| --- | --- |
| Display → `Show Graph` | Accepts one object, a sequence, or an existing node as roots and generates the graph. |
| Display → `Decache` | Clears roots, nodes, and the graph pane. |
| Display → `Redisplay` | Forces graph redisplay. |
| Display → `Hardcopy` | Writes PostScript to a file or a Genera PostScript printer; options are file (home `GRAPH-HARDCOPY.PS` by default), printer, portrait/landscape, and scale-to-fit. |
| `Set Graph Type` | Named/typed command selecting graphical or textual rendering; it is not a top menu item. |
| Snapshot → `Snapshot` | Copies the current graph configuration into volatile frame state. |
| Snapshot → `Show Snapshots` | Presents saved snapshots in the interactor. |
| Snapshot → `Recover Snapshot` | Restores a selected snapshot. Select on a displayed snapshot is the direct translator. |
| Delete a snapshot | Removes that snapshot. |
| `Quit` | Exits the frame. |
| Select a node | Expands its inferiors one level when more objects exist. |
| Describe a non-leaf node | Hides its inferiors. |
| Describe a leaf with superiors | Deletes that leaf from its superior links. The two Describe translators are disjoint by their testers. |
| Shift-Left a node | Makes the selected underlying object the new graph root. |
| Delete a node | Replaces it by an ellipsis; Select the ellipsis to restore the node. |
| Context menu → `Show Node Superiors` | Grows the graph in the opposite subtype direction. It intentionally has no direct gesture. |
| Control-Meta-Left a class node | Adds a subnode listing direct slots. |
| Control-Meta-Middle a class node | Adds a subnode listing directly specialized methods. |
| Control-Meta-Left a package node | Adds a subnode of exported symbols. |
| Delete a subnode | Removes that slots, methods, or exported-symbol subnode. |

Function browsing inspects compiled callers/callees; class and package browsing
use live CLOS/package metadata; filesystem browsing reads guest directories. The
Lisp-object browser is more dangerous: a list whose first element names a
function can be evaluated, and a symbol can be resolved through its value. Use it
only on trusted input. Hardcopy mutates the guest filesystem or contacts a
configured printer. Snapshots are not files and do not survive the Lisp image.

The manual documents graph selection, adding/removing/hiding/ellipsizing nodes,
and hardcopy. Source adds the exact control ranges, snapshot behavior, subnode
gestures, and two defects/oddities: the exported-symbol subnode reuses an
“instance variables” title, and no persistence exists for snapshots. A source
comment also describes editing the underlying object, but the inspected command
table defines no corresponding browser translator; this remains an unimplemented
or stale-comment feature, not a documented control.

The Genera activity declaration contains raw byte `0x03` as its Select key. That
byte is preserved as source evidence, but its intended Symbolics key name is not
asserted without runtime or character-encoding confirmation.

Dependencies are CLIM Demo plus Genera CLOS, packages, filesystem, compiler
cross-reference data, and optional hardcopy services according to browser type.
**Screenshot/runtime TODO:** capture the control pane and at least class and
package graphs after CLIM becomes loadable in isolation; currently no browser
frame can be created.

## cad-demo

`cad-demo` is a gate-level logic drawing demonstration. A single design pane is
also its output history. It can place And gates, Or gates, constant Logic One,
and constant Logic Zero components; wires connect outputs to inputs. Components
and pins are custom output records and presentations rather than a separate CAD
document format.

| Command | Key | Operation |
| --- | --- | --- |
| `Create` | C | Chooses one of the four component types, then accepts a blank-area position. |
| `Connect` | none | Accepts an output and then an input and draws the connection. |
| `Move` | none | Accepts a component and tracks the pointer while dragging it. |
| `Show` | none | Accepts an output with the Describe gesture and displays its Boolean expression. |
| `Clear` | L | Erases all components and wires. |
| `Refresh` | R | Rebuilds the visible design from the retained records. |
| `Setup` | S | Creates the canned demonstration circuit. |
| `Exit` | X | Exits the frame. |

The manual emphasizes custom output records, custom highlighting,
menu-directed commands, and record dragging. It also explicitly warns that a
feedback circuit can crash the demo. Source inspection shows no save/load,
netlist, interchange, or hardcopy format, no implemented scale command, and an
ignored `Swap Layouts` experiment guarded out because only one layout exists.
State exists only in memory.

This is not an electrical simulator or production CAD tool; do not use it for a
real circuit. Dependencies are CLIM Demo, formatted/output records,
presentations, and pointer tracking. **Screenshot/runtime TODO:** capture the
Setup circuit plus a selected component and equation only in a disposable CLIM
world; currently blocked by absent CLIM.

## color-chooser

`color-chooser` is a linked RGB/IHS color-selection dialog. The frame has no menu
bar: a color swatch, six vertical sliders, and an `Exit` push button are the
entire direct surface.

| Control | Range and behavior |
| --- | --- |
| Red, Green, Blue | Each 0.000–1.000. Dragging or committing a value updates the swatch and recomputes the IHS sliders. |
| Intensity | 0 to square root of 3. Changing it updates RGB. |
| Hue, Saturation | Each 0.000–1.000. Changing either updates RGB. |
| `Exit` | Leaves the frame and returns the current RGB color to its caller. |

Both drag and value-changed callbacks synchronize the two coordinate systems
continuously. A dynamic palette uses a mutable dynamic color; other displays are
repainted. There is no color-library file, persistence, textual import, or named
color management. The User's Guide describes the linked sliders and swatch; the
dynamic-color branch and precise ranges come from source.

Dependencies are CLIM Demo, physical slider gadgets, color conversion, and a
color-capable or stipple-fallback port. Safety impact is confined to volatile
frame and palette state. **Screenshot/runtime TODO:** capture the
swatch and both linked slider groups after CLIM loading is restored; currently
blocked.

## demo-app

The chooser calls `demo-app` “Activity Demo.” It is a demonstration of CLIM's
`activity-frame` substrate rather than a domain application. Each frame divides
its space between an interactor and an otherwise blank display pane, and can
create or select peer activity frames.

| Command or gesture | Effect |
| --- | --- |
| `New` | Prompts for a name, defaulting to `Untitled-N`, and opens a 300-by-250 child frame. |
| `Select Frame` | Accepts one of the existing activity frames and selects it. |
| `Funky Add` | Accepts a number, adds a random integer from -10 through 9, and presents the result. |
| Select a displayed number | Invokes `Funky Add` using that number. |
| `Exit` | Exits the current activity frame. |

The untitled counter is shared; results and frames are volatile. No document or
interchange format exists. The installed demo chapter does not describe this
program, so its purpose, two-pane layout, random range, and translator are
source-only findings. Source attribution includes portions credited to Franz.

Dependencies are CLIM Demo, `activity-frame`, presentations, and a random-number
generator. **Screenshot/runtime TODO:** capture two named peer frames and the
number translator when CLIM is available; currently blocked by the unloaded
system.

## flight-planner

`flight-planner` is a presentation-rich aviation teaching demo over a built-in,
historical New England data set. Its large map pane occupies roughly three
quarters of the frame and an interactor occupies the rest. It is **not an
airworthy planner**: the navigation rows are fixed historical demo data, are not
current or authoritative, and must never be used for real navigation.

The data model has ground positions, routes, Victor airways, aircraft, flight
plans, winds, and navigation-log rows. The source contains 164 literal navigation
rows, then filters them to latitude 41–44 and longitude 70–74 for the visible
region. It also builds coastlines and sample aircraft. A navigation row encodes
an identifier, short name, kind, frequency, long name, latitude degrees/minutes,
longitude degrees/minutes, and variation/elevation fields. This is an internal
Lisp table, not a supported import file.

| Command or direct gesture | Operation |
| --- | --- |
| `Zoom In` / `Zoom Out` | Changes map scale by 1.5 around the center. |
| `Show Map` | Rebuilds the map display. |
| `Add` | Chooses Ground Position, Route, Victor Airway, or Aircraft and opens the corresponding typed interaction. |
| `Describe` | Describes a selected concrete map/domain object. Describe over an object is the direct translator. |
| `Edit` | Edits a selected aircraft. Edit over an aircraft is the direct translator. |
| `Plan Flight` | Accepts a route and flight parameters, then opens a navigation log and analysis window. Edit over a route invokes this higher-priority command. |
| `Show Distance` | Accepts two route-start objects and reports nautical miles and true course. |
| Delete an object | Removes a displayed ground position, route, airway, or aircraft. |
| Select a named ground position | Starts `Add Route` from that point. |
| Select a map position while latitude/longitude is requested | Supplies the coordinates under the pointer. |
| `Exit` | Exits the frame. |

`Add Ground Position` accepts name, long name, kind (airport, VOR,
named-intersection, or visual checkpoint), latitude, longitude, and altitude
0–60,000. `Add Route` and `Add Victor Airway` accept a starting
airport/intersection/VOR and then waypoints until `NIL`; an airway also has a
name. `Add Aircraft` accepts identifier, type, preferred altitude, cruise speed,
fuel consumption, maximum fuel, and hourly cost.

The flight-plan dialog accepts VFR, IFR, or DVFR; aircraft; equipment; true
airspeed; departure time; altitude; remarks; fuel; alternate; pilot contact;
1–500 people aboard; and aircraft color. Time is entered in an hour/minute form;
wind uses direction and speed. The computed result is an in-memory navigation
log and analysis, not a filed plan and not a durable document.

The manual highlights presentation-type inheritance, custom highlighting,
dialogs, and table formatting. Source inspection adds several non-manual limits:
wind defaults to zero, rows outside the fixed bounds silently disappear, a
comment flags the inverse coordinate calculation's Y value, and the aircraft
editor accepts a new hourly cost but fails to assign it before restoring the old
value. That last item is a source-visible edit bug pending runtime confirmation.

Dependencies are CLIM Demo, `navdata`, trigonometric/numeric code, presentations,
tables, dialogs, and Genera display services. No filesystem operation is defined.
**Screenshot/runtime TODO:** after CLIM can be loaded, capture the bounded map and
a synthetic route/log with a conspicuous “historical demo—do not navigate”
caption; currently blocked.

## graphics-demo

`graphics-demo` is a menu of self-running CLIM drawing examples. It has an
800-by-600 demonstration pane and a short explanation pane.

| Menu command | Visible behavior |
| --- | --- |
| `Spin` | Repeats a colored shape under affine rotation. |
| `Big Spin` | Adds scaling to produce a rotating spiral. |
| `CBS Logo` | Composes circles, an ellipse, and crosshairs. |
| `Polygons` | Animates nested 3-, 5-, and 8-sided polygons with pauses. |
| `Circles` | Draws a grid of circles in random colors. |
| `Maze` | Generates a maze, pauses, then draws its solution in green. |
| `Exit` | Exits the frame. |

While the demo's timed-wait routine is active, an ordinary character ends the
current wait and a pointer event exits the whole frame. These are the only
application-defined direct gestures; the seven commands have no declared
accelerator keys. The examples exercise transformations, inks, lines, polygons,
circles, random generation, and timed redisplay. They load no assets and save no
data. The manual states the color/stipple fallback and transformation purpose;
the exact animations and early-exit behavior are source findings. Portions are
credited to International Lisp Associates.

Dependencies are CLIM Demo, CLIM drawing and affine transformations, colors or
stipple fallback, random-number generation, and timed gesture input. Safety
impact is limited to volatile drawing, short waits, and operator-triggered frame
exit; the demos perform no file I/O.

**Screenshot/runtime TODO:** capture one transformation example and the solved
maze, as two distinct visible claims, after CLIM can run; the present world has
no CLIM.

## graphics-editor

`graphics-editor` is the User's Guide's “Boxes-and-Wires Editor.” It demonstrates
selection, pointer tracking, handles, command-table grouping, and incremental
redisplay. A scrollable canvas and modeless options pane can be arranged in
horizontal or vertical layouts.

| Direct interaction | Effect |
| --- | --- |
| Select-drag blank canvas | Creates a numbered oval or rectangle. A click without movement only deselects. |
| Select a box | Makes it the selected object. |
| Describe-drag a box | Moves it while attached arrows track. |
| Describe-drag a handle | Resizes the selected box. |
| Delete a box | Removes it and cleans up attached arrows. |
| Thickness choices | Sets 1, 2, 3, or 4; immediately updates the selected box. |
| Line Style | Solid or dashed; immediately updates the selected box. |
| Shape | Oval or rectangle; immediately updates the selected box. |

| Menu command | Key | Effect |
| --- | --- | --- |
| File → `Quit` | Meta-X | Exits. |
| Edit → `Deselect` | none | Clears the selection. |
| Edit → `Delete` | Control-D | Deletes the selected object. |
| Edit → `Clear` | none | Clears the scene. |
| Edit → `Redisplay` | Meta-R | Forces redisplay. |
| Options → `Change Layout` | Meta-L | Toggles the option-pane arrangement. |

New boxes are numbered monotonically and automatically arrow-connected from the
previous box, so the demo is not a general free-wiring editor despite its manual
name. Source comments call the private reusable object substrate “Zdrava”; it is
not a CLIM product facility. The File menu contains no Open, Save, Import, or
Export command, and there is no document format. Deleting a box cascades to its
arrows.

The manual describes boxes, tracking wires, selection, redisplay ticks, bounding
rectangles, command-table groups, and graphical option presentations. Automatic
chain wiring, click-without-drag behavior, and the lack of persistence are
source findings. Dependencies are CLIM Demo, presentations, pointer tracking,
incremental redisplay, and the private demo object substrate. Safety impact is
confined to volatile scene state. **Screenshot/runtime TODO:** capture creation,
selection handles,
and tracked arrows in a disposable loaded world; currently blocked.

## ico-frame

`ico-frame`, registered as “Ico Demo,” animates a bouncing, rotating
icosahedron. Its source credits Xerox, portions to Franz, and says the algorithm
was taken from the traditional X11 `ico` demo and improved. This is explicit
lineage, unlike similarity-based attribution.

| Control | Key | Effect |
| --- | --- | --- |
| `Throw ball` | T | Starts the animation worker. |
| `Catch ball` | C | Requests and waits for the worker to stop. |
| `Quit` | Q | Stops animation, releases layered colors, and exits. |
| `Time` | none | Boolean option controlling timing display. |
| Face/edge subset | none | Chooses faces, edges, both, or neither. |
| Line style | none | Thin or thick. |
| Buffering | none | Single, double, or triple on a dynamic-palette display. |

The geometry has twelve vertices and twenty faces. The object is approximately
150 by 150 pixels, starts with velocity 13 by 9, rotates five degrees around both
X and Y per frame, performs hidden-face selection, and bounces at the pane
boundary. Repaint can start the animation automatically. The worker and dynamic
palette layers are released on Catch/Quit, but an abnormal failure could still
leave a process or colors until cleanup.

No model file or animation export exists. Dependencies are CLIM Demo, process
support, transformations, dynamic colors, and optional multi-buffering. The
safety concern is the background worker and temporary palette allocation: normal
Catch/Quit cleans both up, while an abnormal failure may require disposable-world
cleanup.
**Screenshot/runtime TODO:** capture both face-and-edge rendering and the options
pane after CLIM loading; a static image cannot prove motion, so the caption must
state what was source-established versus observed.

## lisp-listener

`lisp-listener` is a CLIM command-or-form REPL with one scrollable interactor and
no menu bar. It accepts Lisp forms or CLIM commands, presents returned values as
reusable objects, maintains the Common Lisp `*`, `**`, `***`, `/`, `//`, `///`,
`+`, `++`, `+++`, and `-` histories, and supplies a nested in-pane restart UI
unless native debugging is selected. On Genera, End is an additional activation
gesture.

| Command | Direct binding or operation |
| --- | --- |
| `Invoke Restart` | Select a displayed restart; Use/Store Value may accept and evaluate a replacement form. |
| `Describe Error` | Displays the current debugger condition and restarts. |
| `Use Native Debugger` | Toggles the native debugger versus the nested CLIM debugger hook. |
| `Edit Function` | Invokes `ED`; Edit a displayed function is the translator. |
| `Clear Output History` | Control-Meta-L on Genera. |
| `Copy Output History` | Writes the textual output history to a pathname. |
| `Show Homedir` | Lists the user's home directory. |
| `Show Directory` | Lists a pathname with size, modification time, and author. |
| `Show File` | Displays a pathname; Select a pathname invokes it. |
| `Edit File` | Invokes `ED`; Edit a pathname invokes it. |
| `Delete File` | Deletes a sequence of pathnames. A pathname context-menu translator supplies one file. |
| `Expunge Directory` | Genera-only destructive expunge. |
| `Copy File` | Demonstration stub: reports what it would copy but performs no copy. |
| `Compile File` | Compiles one or more pathnames; also available from a pathname context menu. |
| `Load File` | Loads one or more pathnames; also available from a pathname context menu. |
| `Demonstrate CLIM` | Enters the demo chooser on the same port. |
| `Quit` | Exits the listener. |
| `Hardcopy File` | Demonstration stub: accepts a file (Describe on a pathname), fictitious printer (Select supplies it), normal/sideways orientation, query flag, and conditional spreadsheet reflection, then only reports the request. |
| `Show Some Commands` | Displays sample command objects as presentations. |

Select on an output expression supplies the underlying value when it matches the
current input context; Describe constructs a form to describe the object;
Super-Middle constructs a description of the presentation record itself. The
source defines a Genera Select key, but its encoded character cannot be decoded
with high confidence from the extracted file; the public manual identifies the
standalone activity as Select Lambda. This manual/source correspondence should be
verified at runtime before treating the extraction as exact keyboard evidence.

The User's Guide notes the custom top level, patterned prompt, translators,
scrollable history, and that `*debug-io*` is not normally rebound to this window.
Source inspection reveals the complete command inventory and the two convincing
stubs. The listener is security-sensitive: arbitrary typed forms are evaluated;
Use/Store Value can evaluate forms; compile/load execute code; edit, output-history
copy, delete, and expunge mutate guest files. Run only trusted forms and pathnames
inside a disposable world.

Dependencies are CLIM Demo, the Common Lisp evaluator/compiler, Genera filesystem
and editor integration, conditions/restarts, and the shared CLIM input editor.
**Screenshot/runtime TODO:** capture a harmless multiple-value evaluation and a
nested synthetic error after CLIM becomes loadable; the generic Dynamic Lisp
Listener is not a substitute.

## peek-frame

`peek-frame`, registered as “Peek,” is a small process-status and process-control
demo. It incrementally redraws a table of Process, State, and Activity, with the
time and current refresh condition above it. The default interval is one second.

| Command or gesture | Effect |
| --- | --- |
| `Options` | Dialog booleans: Show GC, Show LISP Processes, Show OS Processes. |
| `Faster` | Divides the refresh interval by two. |
| `Slower` | Multiplies the refresh interval by two. |
| `Pause` | Toggles automatic refresh. |
| `Redisplay` | Forces a refresh. |
| Select a process | Opens the applicable presentation menu. |
| `Activate Process` / `Deactivate Process` | Changes the selected Lisp process's runnable state. |
| `Destroy Process` | Destructively kills the selected process. |
| `Restart Process` | Restarts the selected process. |
| `Exit` | Exits the frame. |

The User's Guide only calls it a small process-status program demonstrating
incremental redisplay. Source inspection changes the Genera interpretation of
two options: the GC branch prints that statistics are unknown on this port, and
OS-process enumeration exists only for Lucid and Allegro, so enabling Show OS
Processes on Genera adds no OS rows. A source comment mentions an `Update`
command, but no such command is defined; `Redisplay` is the actual control.

Process actions are live and destructive. Exercise Activate, Deactivate,
Destroy, or Restart only in an isolated disposable world and never against a
needed service. There is no data file or export format. Dependencies are CLIM
Demo and `clim-sys` process introspection/control. **Screenshot/runtime TODO:**
capture the table and Options dialog only after CLIM can be loaded; destructive
commands should be verified on a synthetic expendable process.

## plot-demo

`plot-demo`, registered as “Plotting Demo,” combines a graph pane, modeless
options pane, editable data table, and interactor. Its initial five-by-four
array has an X column of years and three city series. The same data can be shown
as a line plot, bar graph, or pie chart.

| Direct control or command | Effect |
| --- | --- |
| Graph Type | Plot, Bar, or Pie. |
| Plot ranges | Plot exposes Min X, Max X, Min Y, Max Y; Bar exposes Min/Max Y; Pie has no range controls. |
| Select X label / `Edit X Label` | Edits the horizontal label. |
| Select Y label / `Edit Y Label` | Edits a series label. |
| Select data point / `Edit Data Point` | Edits the chosen numeric cell. |
| Describe graph line, graph point, or dragged graph region | Reports the selected semantic object. |
| Delete graph line | Removes the selected series. |
| Describe-drag blank graph area | Scrolls the graph by pointer tracking. |
| Select-drag when a command requests `graph-region` | Draws and returns a rectangular region. |
| `Redisplay` | Forces graph redisplay. |
| `Add New Column` | Duplicates the last series and its label. |
| `Add New Row` | Duplicates the last row and X value. |
| `Random Update` | Performs ten random non-X data changes, redisplaying each. |
| `Save As Data` | Writes the data format below, with overwrite confirmation. |
| `Load Data` | Reads that format and replaces the frame data. |
| `Quit` | Exits. |

`Print Graph` exists only in the Allegro conditional branch; it is not a Genera
command. Likewise, only Edit X Label, Edit Y Label, Edit Data Point, and Quit are
menu items on Genera; the remaining named commands are entered through the
command processor or presentation gestures.

The save format is exactly three Common Lisp printed objects in order: the
X-label list, Y-label list, and plot-data array. There is no required extension,
schema tag, version, or validation. Loading untrusted files is unsafe because it
uses the Lisp reader and then assumes compatible objects and dimensions. Saving
supersedes the selected file after confirmation.

The manual highlights pointer tracking, formatted output, a modeless dialog, and
drag scrolling. Source adds the exact format and a suspicious method signature:
the X/Y-label presentation methods use a `typep`-shaped parameter where sibling
methods use a `type` parameter. Because a compiled VBin exists but the app was not
run, this is recorded as a source anomaly, not a proven runtime failure.

Dependencies are CLIM Demo, graph/table formatting, accepting-values,
presentations, filesystem streams for save/load, and the Lisp reader/printer.
**Screenshot/runtime TODO:** capture all three graph types and a table edit after
CLIM loading; currently blocked.

## puzzle

`puzzle`, registered as “15 Puzzle,” is the polished Demo-system version of the
4-by-4 sliding puzzle. Fifteen numbered cells and one gap are presented in a
large fixed text display with incremental redisplay.

| Interaction | Effect |
| --- | --- |
| Select a cell in the gap's row or column | Slides the entire intervening run toward the gap, not merely one adjacent tile. Illegal cells are not sensitive. |
| `Scramble` | Generates a randomized, parity-correct solvable position. |
| `Exit` | Exits. |
| Any ordinary character in the custom command reader | Exits the frame; Abort and End retain their command-loop meanings. |

The move translator uses a tester to expose only legal row/column cells, and a
custom highlighter outlines a candidate. The scramble routine repairs parity
rather than accepting an arbitrary unsolvable permutation. State is volatile;
there is no puzzle file, undo, move counter, or saved game.

The manual identifies direct manipulation, table formatting, and incremental
redisplay, while the exact multi-cell rule, solvability repair, keyboard exit,
and no-persistence boundary come from source. Dependencies are CLIM Demo,
presentations, formatted tables, and incremental redisplay. **Screenshot/runtime
TODO:** capture a scrambled board with one legal highlighted move after CLIM can
be loaded; currently blocked.

## scigraph

`scigraph`, registered as “Custom Output Records,” is a performance demonstration
for output-record design, not a general scientific plotting package. A caption
pane occupies the upper fifth and a vertically scrollable display accumulates
examples until cleared.

| Command | Operation |
| --- | --- |
| Examples → `Example 1` | Generates 1,000 noisy sine points using ordinary CLIM output/presentation records. |
| Examples → `Example 2` | Gives every point its own custom displayed output record. |
| Examples → `Example 3` | Stores the data set in a custom container record and uses point records plus binary-search-assisted hit testing. |
| `Clear` | Clears accumulated examples. |
| `Exit` | Exits. |

Each run displays elapsed time. The data are generated in memory and are neither
loaded nor saved. Points remain presentations, but this frame defines no command
translator for them. The manual reports that its third representation was about
three times faster than the first for this application; that is a contemporary
manual result, not a measurement reproduced by this audit.

Dependencies are CLIM Demo, custom output-record protocols, presentations,
timing, and random-number generation. Safety impact is limited to volatile point
generation, allocation, and timing. **Screenshot/runtime TODO:** capture all
three labeled results in one controlled run and record their measured times only
after CLIM can be loaded; currently blocked.

## thinkadot

`thinkadot` simulates the mechanical Think-a-Dot finite-state toy. Eight binary
diverter nodes form a fixed network beneath three entry chutes, with left and
right exit indicators. Light and dark dots encode each diverter's current state.

| Interaction | Effect |
| --- | --- |
| Select one of the three entry chutes | Drops a marble through the deterministic path, flips every traversed diverter, and marks the exit. |
| `Reset-Left` | Points all diverters left and clears both exits. |
| `Reset-Right` | Points all diverters right and clears both exits. |
| `Exit` | Exits. |

The path is computed and the state display changes; the source does not animate a
visible marble travelling through each edge. The state is volatile and has no
file format. The manual identifies the mechanical toy; the eight-node model,
instantaneous update, and exact reset semantics are source findings.

Dependencies are CLIM Demo, presentations, and incremental redisplay.
**Screenshot/runtime TODO:** capture the initial state and one post-drop state
after CLIM loading, explicitly avoiding a claim of path animation; currently
blocked.

## fifteen-puzzle-1

`fifteen-puzzle-1` is the tutorial's deliberately elementary first frame. A
fixed-width, very-large text pane shows the solved 4-by-4 grid, and a command-menu
pane supplies four buttons. The frame has no ordinary menu bar.

| Command-menu control | Effect |
| --- | --- |
| `Down` | Moves the tile immediately above the gap downward, when one exists. |
| `Up` | Moves the tile immediately below the gap upward. |
| `Left` | Moves the tile immediately right of the gap left. |
| `Right` | Moves the tile immediately left of the gap right. |

Each command swaps one adjacent tile; there are no presentations, pointer moves,
Reset, Scramble, or Exit command. Closing the application therefore depends on
the surrounding frame/window facility. The stage teaches the minimum application
frame: state slots, commands, application and command-menu panes, layout, and a
display function. State is an in-memory 4-by-4 array and always starts solved.

The tutorial manual presents this as the elementary application before adding
semantic output. Source confirms the exact button semantics and the conspicuous
lack of an exit path. Dependencies are CLIM Tutorial, application-frame panes,
a command-menu pane, and ordinary table/text output. Safety impact is confined
to volatile puzzle state. **Screenshot/runtime TODO:** capture the solved board and
four-button command pane after CLIM Tutorial can be loaded; currently blocked by
absent CLIM.

## fifteen-puzzle-2

`fifteen-puzzle-2` replaces four directional buttons with presentation-based
direct manipulation. Each numbered cell is presented as a `puzzle-piece` carrying
its encoded position.

| Command or gesture | Effect |
| --- | --- |
| Select a numbered cell | If the gap shares its row or column, slides every intervening tile; otherwise performs no move. |
| `Reset` | Restores the solved 1–15 ordering. |
| `Exit` | Exits the frame. |

The `Move` command takes integer row and column arguments; the presentation
translator supplies them from the selected cell. This stage has no translator
tester, so even a geometrically illegal cell can be selected and dispatched; the
move routine then finds no path and leaves the board unchanged. The frame relies
on ordinary post-command display rather than targeted redraw. There is no
scramble or persistence.

The tutorial uses this version to introduce presentations, translators, and clean
frame exit. Dependencies are CLIM Tutorial, presentations, a translator, and
formatted table output; safety impact is confined to volatile puzzle state.
**Screenshot/runtime TODO:** capture a legal sensitive tile and a
multi-cell slide when the tutorial system is runnable; currently blocked.

## fifteen-puzzle-3

`fifteen-puzzle-3` keeps the second stage's `Move`, `Reset`, `Exit`, and Select
interaction, but disables the normal display-after-every-command path. It stores
the output record for each cell and manually erases, replaces, and reinstalls the
records touched by a move.

This is “incremental redisplay the hard way”: explicit presentation/output-record
bookkeeping is the teaching subject, not a user-visible feature. The frame adds
record storage, fixed character width and line height, and a reset path that
clears the pane and reconstructs every record. It still has no translator tester,
scramble, undo, saved game, or file format.

The direct controls are exactly Select a piece, `Reset`, and `Exit`, with the same
legal-move semantics as stage 2. Dependencies are CLIM Tutorial, presentations,
and direct output-record erasure/replacement; safety impact is confined to volatile
puzzle and display-record state. **Screenshot/runtime TODO:** one final board
image
cannot prove the manual record operations; after CLIM loads, capture before/after
screens and retain timing/record inspection as local evidence. Currently blocked.

## fifteen-puzzle-4

`fifteen-puzzle-4` removes stage 3's explicit record table and expresses each cell
with `updating-output`. CLIM's incremental redisplay compares the cell's cached
value under a stable position identifier and updates changed cells.

User-visible behavior remains Select a piece, `Reset`, and `Exit`; a legal
same-row/column selection slides all intervening tiles, and an illegal selection
does nothing. There is still no translator tester, so pointer sensitivity does not
yet communicate legality before dispatch. No state is persisted.

The tutorial's point is architectural: stage 3 and stage 4 should look the same,
but stage 4 delegates record reconciliation to CLIM. Dependencies are CLIM
Tutorial, presentations, `updating-output`, and incremental redisplay; safety
impact is confined to volatile puzzle and output-record state.
**Screenshot/runtime TODO:**
capture the board plus an output-record inspection or controlled redraw trace
after loading CLIM, because pixels alone cannot establish the implementation
difference. Currently blocked.

## fifteen-puzzle-5

`fifteen-puzzle-5` is the completed tutorial progression. It keeps stage 4's
`updating-output` structure and adds a translator tester that calls the same
move-path calculation used by the command. Only pieces sharing the gap's row or
column are now sensitive. It also defines an input reader for puzzle pieces.

The complete direct surface remains Select a legal piece, `Reset`, and `Exit`;
there are no keys, scramble, undo, score, save, or load commands. The progression
across all five frames is therefore:

| Stage | New teaching mechanism |
| --- | --- |
| `fifteen-puzzle-1` | Frame state, panes, layout, display, and menu commands. |
| `fifteen-puzzle-2` | Presentations and a presentation-to-command translator. |
| `fifteen-puzzle-3` | Manual output-record erasure and replacement. |
| `fifteen-puzzle-4` | Declarative incremental redisplay with stable identifiers. |
| `fifteen-puzzle-5` | Context-sensitive translator testing and piece input. |

This exact progression is established jointly by the tutorial manual and the
five source files. Stage 5 depends on CLIM Tutorial, presentations,
`updating-output`, incremental redisplay, a translator tester, and presentation
input; safety impact is confined to volatile puzzle state. **Screenshot/runtime
TODO:** capture pointer sensitivity over
one legal and one illegal cell once CLIM is runnable; currently blocked.

## lsq

`lsq` is a least-squares plotting tutorial supplied in two successive source
stages. Both files define the same frame, presentation types, and many of the
same functions; loading the second after the first replaces definitions. Treat
them as two versions of one lesson, not as simultaneously selectable frames.

Both stages have a drawing layout and a tabular layout, default axes from 0.0 to
1.0, no initial points, incremental graph/equation display, and polynomial
least-squares fitting by a general linear-regression routine using Cholesky
factorization. The curve menu offers Linear, Quadratic, and Cubic; a fit requires
enough points, then displays an equation and correlation. Points, fits, and axis
settings are volatile; neither stage reads or writes a data file.

### First source stage

| Command or gesture | Effect |
| --- | --- |
| Select blank plot area | Adds a real-valued point at the inverse-transformed coordinates. |
| Delete a point | Removes it. |
| Edit a point | Opens an accepting-values dialog for new X and Y. |
| `Set Axis Ranges` | Accepts X/Y minima and maxima; a button encompasses all points. |
| `Fit Curve` | Chooses Linear, Quadratic, or Cubic and computes the fit. |
| `Switch Display` | Switches between plot and table/equation layouts. |
| `Exit` | Exits. |

Source inspection exposes three first-stage defects not stated in the tutorial:

- the visible-range predicate compares the Y limits with the point's X value,
  so some points can be wrongly included or omitted;
- point deletion and alteration both name an unused `dummy-data-points` slot that
  this first frame does not define. An unused `with-slots` symbol macro need not
  perform a slot read, so this is stale source baggage rather than proof that
  Delete/Edit must fail;
- `Switch Display` enables or disables `com-zoom-in` and `com-zoom-out`, but this
  source stage defines neither command.

These are strong source findings, but they remain runtime TODOs because the frame
could not be launched.

### Second source stage

The second stage adds a data-set name, placeholder rows, sorting, direct table
editing, zoom, and richer options.

| Command, gesture, or table control | Effect |
| --- | --- |
| Select blank plot area | Adds a point. |
| Delete a real or placeholder point | Removes that row. |
| Primary Sort / Secondary Sort | Each chooses X, Y, or Set; the unused third key breaks ties. |
| `Click here to enter new data` | Adds a placeholder row. Editing X, Y, and Set in the accepting-values table promotes it to real data once X and Y are numeric. |
| `Zoom In (magnify)` | Tracks a rectangle and maps that data subset to the full graph. |
| `Zoom Out (contract)` | Tracks a rectangle in which to place the old full graph. |
| `Options` | Chooses Y-as-function-of-X or X-as-function-of-Y; accepts all four axis limits; a button includes all points with a five-percent margin. |
| `Fit Curve` | Computes Linear, Quadratic, or Cubic. |
| `Switch Display` | Alternates plot and table/equation layouts and enables zoom only in the plot. |
| `Exit` | Exits. |

Direct table editing replaces the first stage's Edit gesture. The second stage
still contains the same Y-range-versus-X comparison error in point visibility.
The manual focuses on dialogs, mouse input, presentation translators, menus,
formatted tables, multiple layouts, points, transforms, and coordinate spaces;
source inspection supplies the exact sorting and promotion behavior and the
defects.

Dependencies are CLIM Tutorial, accepting-values, presentations, transformations,
incremental redisplay, formatted tables, and numeric linear algebra. Safety impact
is volatile computation only. **Screenshot/runtime TODO:** separately capture
stage 1 and stage 2 so replacement definitions are not confused, and verify every
source defect in an unsaved CLIM world; currently blocked.

## Tic-Tac-Toe

`Tic-Tac-Toe` is the tutorial's 3-by-3 graphical game. The board pane occupies
nine tenths of the frame and a status pane the remainder. X and O are graphical
presentations under a `board-position` type hierarchy, and both panes use
incremental redisplay.

| State | Enabled direct interactions |
| --- | --- |
| Stopped/editing | Select any cell to cycle Empty → X → O → Empty; `Play (user X)`; `Play (program X)`; `Reset`; `Exit`. |
| Playing | Select an empty cell for the user's move; the program responds immediately; `Reset`; `Exit`. Play and position editing are disabled. |
| Won or drawn | The game returns to stopped state; status displays the X/O winner or a cat's game. |

Starting play from an edited nonterminal board counts X and O marks to determine
whose turn it is. Starting from a terminal position first clears the board. If the
program is X, it makes the initial move before returning input.

The source-level move priority is: take an immediate win; block an immediate
loss; create a fork; block one fork or force play when there are multiple fork
points; take the center; otherwise take the first available corner. When the AI
has several accumulated candidate points, selection among them is random. This is
a compact tactical player, not a general game-search engine. There is no final
edge-square fallback after the center and corners; an unusual edited position
could therefore leave the move routine without coordinates, a source-visible risk
that needs runtime confirmation. There is no network play, score history, undo,
saved board, or file format.

The tutorial uses the program to teach presentation-type inheritance, command
enablement, and graphics transformations. Source adds the editable-start-position
semantics and exact tactical policy. Dependencies are CLIM Tutorial,
presentations, transformations, command enablement, incremental redisplay, and
random selection among equivalent moves. Safety impact is confined to volatile
game state. **Screenshot/runtime TODO:** capture editing,
active play, and a terminal status after CLIM Tutorial can run; currently blocked.

## clim-tests

`clim-tests` is an interactive conformance, regression, visual-inspection, and
benchmark workbench. It is not an automated pass/fail harness. A small caption
pane explains the selected test and a scrollable display pane shows the result or
accepts follow-up input. On Genera it registers Select Circle.

The top command bar is Graphics, Redisplay, Benchmarks, Output Recording,
Formatted Output, Presentations, Menus and Dialogs, and Exit. Selecting a displayed
`form` presentation evaluates it. Many tests deliberately sleep, refresh, open
menus/dialogs, or wait for input, so “test completed” does not imply correctness;
the researcher judges the visible result against the caption.

### All active Genera test commands

The source contains 73 `define-test` forms, but four are guarded by `#+Allegro`:
`read-image-test`, `clos-metaobjects-graph`, `hairy-graph-formatting`, and
`more-simple-menus`. The Genera frame therefore receives **69** active test
commands:

| Menu | Count | Exact source command identifiers active on Genera |
| --- | ---: | --- |
| Graphics | 27 | `basic-graphics-inks`; `basic-graphics-shapes`; `basic-line-styles`; `blue-gettysburg`; `colored-inks`; `draw-enstyled-text`; `draw-some-arcs`; `draw-some-bezier-curves`; `draw-some-circles`; `draw-some-points`; `draw-some-rectangles`; `gettysburg`; `negative-extent`; `patterned-graphics-shapes`; `pixmap-test`; `points-and-lines`; `region-contains-point-tests`; `region-contains-region-tests`; `region-equal-tests`; `region-intersects-region-tests`; `rotated-scaled-circles`; `rotated-scaled-rectangles`; `rotated-text`; `scaled-rotated-circles`; `scaled-rotated-rectangles`; `styled-gettysburg`; `transformed-graphics-shapes`. |
| Output Recording | 5 | `cursorpos-table`; `draw-bullseye`; `ordering-test-1`; `ordering-test-2a`; `ordering-test-2b`. |
| Formatted Output | 16 | `cell-coordinates`; `checkerboard`; `column-table`; `comprehensive-table-tests`; `equal-width-table`; `equalized-multiple-columns-table`; `filled-output`; `mixed-table`; `multiple-columns-table`; `nested-table`; `offset-graph`; `offset-table`; `row-table`; `simple-borders`; `simple-graph`; `text-formatting`. |
| Redisplay | 6 | `graphics-redisplay-1`; `graphics-redisplay-2`; `redisplay-border`; `redisplay-graph`; `redisplay-overlapping`; `simple-redisplay`. |
| Presentations | 4 | `drag-and-drop-tests`; `highlighting-tests`; `string-accept`; `string-stream-accept`. |
| Menus and Dialogs | 11 | `choose-compass-direction`; `gadgets-dialog`; `graphical-menu`; `graphics-dialog`; `graphics-dialog-options`; `graphics-dialog-own-window`; `input-editor-tests`; `ozone-dialog`; `readonly-gadget-dialog`; `simple-menu`; `simple-spreadsheet`. |

The graphics group covers primitive shapes, transforms in both composition orders,
arcs/Bezier curves, points, text styles, named and constructed inks, patterns,
pixmaps, line caps/joins/dashes, negative extents, and region relations. Gettysburg
variants are text-rendering fixtures, not on-line documentation. Output-recording
tests exercise refresh and overlapping hit-test ordering. Formatted-output tests
cover rows, columns, equalization, nesting, cells, item filling, graphs, borders,
offsets, and mixed text/graphics. Redisplay tests mutate cached records, overlap,
borders, graphics, and graphs.

The presentation tests include repeated integer highlighting and string drag/drop
loops. Menus and Dialogs covers a simple nested activity menu, graphical icons,
the four compass directions, a 3-by-3 integer spreadsheet, drawing-option dialogs,
member/subset/boolean and numeric/text gadgets, an intentionally extreme field
position, read-only views, and repeated input-editor accepts. These can remain in
input loops until the operator aborts.

### All benchmark controls and names

`Run Benchmarks` asks for a result pathname and comment, runs all benchmarks, and
optionally writes a Lisp result list. `Run Benchmarks To Dummy File` runs the same
set with an optional destination. `Generate Report` accepts an output pathname and
multiple label/input-file pairs, reads their result lists, and writes a comparative
text report. Each of the following 39 benchmarks is also an individual menu command:

| Family | Exact benchmark names |
| --- | --- |
| Lines | `line-drawing`; `unrecorded-line-drawing`; `medium-line-drawing`; `cached-medium-line-drawing`; `transformed-line-drawing`; `thick-line-drawing`; `clipped-line-drawing`. |
| Shapes | `shape-drawing`; `unrecorded-shape-drawing`; `transformed-shape-drawing`; `thick-shape-drawing`; `filled-shape-drawing`; `stippled-shape-drawing`; `clipped-shape-drawing`. |
| Text | `text-output`; `unrecorded-text-output`; `stylish-text-output`; `clipped-text-output`. |
| Scrolling and refresh | `text-scrolling`; `graphics-scrolling`; `text-refresh`; `graphics-refresh`. |
| Presentation sensitivity | `find-shape-presentations`; `highlight-shape-presentations`; `find-textual-presentations`; `highlight-textual-presentations`; `highlight-menu-items`. |
| Formatting | `simple-table-formatting`; `compound-table-formatting`; `graphic-table-formatting`; `simple-graph-formatting`. |
| Redisplay | `basic-redisplay`; `graphic-redisplay`; `compound-redisplay`. |
| Menus and dialogs | `simple-menu-choose`; `cached-menu-choose`; `simple-dialog`; `window-dialog`; `compound-dialog`. |

Benchmark results are printed Common Lisp lists, preceded by semicolon comments.
The report generator skips comment lines and calls the Lisp reader on the next
object. Do not feed it untrusted files. Running tests can evaluate selected forms,
read or write guest files through benchmark/report paths, allocate heavily, sleep,
open modal UI, wait indefinitely, and stress redisplay or GC. Run only in a fresh
isolated copy with synthetic paths.

The test VBin is shipped separately from `CLIM Demo`; the demo driver checks
whether its entry function is bound and silently does nothing otherwise. The four
Allegro exclusions also correct a tempting but false “73 Genera tests” count. The
Allegro-only image test reads four X11 bitmap files from `/usr/include/X11/bitmaps`;
Genera never compiles that path.

Dependencies are the separately loaded CLIM test body, the CLIM graphics,
formatted-output, output-recording, presentation, redisplay, menu/dialog, and
benchmark facilities, plus Genera timing and filesystem services for result
files. The preceding risks make a disposable world and synthetic paths mandatory.

**Screenshot/runtime TODO:** after deliberate isolated loading, capture one
representative state from each of the seven test families, not a bulk gallery, and
record manual judgment separately from execution success. The current base world
cannot create `clim-tests`.

## Cross-program manual and source findings

The public User's Guide describes fifteen Demo programs. The source registry adds
Activity Demo and a conditional Test Suite entry, neither of which receives a
program section in that manual chapter. Conversely, the Test Suite entry is only a
launcher probe; without separately loading its body, choosing it has no visible
effect. This makes the source registry, not the prose chapter, the authoritative
menu census.

The guide tells readers to load `CLIM-DEMOS`, while the inspected system declaration
defines and imports `clim-demo` with pretty name `CLIM Demo`. No alias named
`CLIM-DEMOS` was found in the inspected declaration. The plural spelling is retained
as a manual/source discrepancy rather than silently “corrected” into evidence of an
additional system.

The programs also expose a useful spectrum of CLIM architecture:

| Technique | Strongest examples |
| --- | --- |
| Presentations and translators | Browser, Flight Planner, Lisp Listener, Puzzle, Thinkadot, Tic-Tac-Toe |
| Incremental redisplay | Address Book, Browser, Graphics Editor, Peek, Plot, tutorial puzzles 4–5, LSQ, Tic-Tac-Toe |
| Custom output records | CAD Demo and Scigraph |
| Accepting-values/modeless control panes | Bitmap Editor, Browser, Plot, LSQ |
| Physical gadgets | Color Chooser and Ico options |
| Multiple frame layouts or frames | Graphics Editor, LSQ, Activity Demo |
| Pointer tracking | CAD movement, Graphics Editor, Plot regions/scrolling, LSQ zoom |
| Background processing | Ico animation |
| Host integration | Browser hardcopy/filesystem, Listener files/editor/compiler, Peek processes |

This range is historically important: the examples teach typed semantic interaction
and retained output structure rather than a widget/callback-only model. It does not
make each example a finished product. In particular, the User's Guide itself calls
the new demos instructional and not product quality.

### Declared lineage and attribution

Attribution below is taken from the shipped source headers and comments. It does not
try to infer authorship from coding style.

| Files/programs | Declared lineage in the inspected source |
| --- | --- |
| Address Book | 1990 International Lisp Associates copyright inside the Symbolics media wrapper. |
| CLIM Bitmap Editor and Plot | Franz copyright ranges beginning in 1985/1986 and continuing through 1993. |
| CAD Demo and Graphics Demo | Symbolics copyright with portions credited to International Lisp Associates. |
| Activity Demo | Symbolics copyright with portions credited to Franz. |
| Ico | Xerox 1989/1990, portions Franz 1992; algorithm explicitly described as derived from the X11 `ico` demo and improved. |
| Peek | BBN Systems and Technologies copyright for 1990–1992 inside the Symbolics media wrapper. |
| Browser, Color Chooser, Flight Planner, Graphics Editor, Lisp Listener, Puzzle, Scigraph, Thinkadot, tutorial, and test suite | Symbolics headers; no more specific external ancestry is asserted by the inspected files. |

Several source RCS headers range from October through December 1992, while copyright
notices extend into 1993 and the media wrapper into the later Open Genera era. Those
are different provenance layers: an RCS revision timestamp is not the product-media
publication date, and a later legal wrapper is not evidence that the example was
designed in 1998.

## Runtime record and screenshot decision

The runtime evidence is reused from the fresh CLIM core audit because it asks the
exact prerequisite question for every frame on this page. Rebooting the same
unchanged base world would not make an absent package or system present.

| Field | Recorded value |
| --- | --- |
| Session | `d28-d29-ui-clim-20260718`, generation 3 |
| Window | `Genera on DIS-LOCAL-HOST`, 1200 by 900 |
| Isolation | Bubblewrap with separate user, mount, network, PID, IPC, and hostname namespaces; read-only Guix store and exact X socket/helpers; no external route or guest-visible host file service |
| Base/private world | `Genera-8-5.vlod`, 54,804,480 bytes, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` before and after; both unchanged |
| Debugger | 346,880 bytes; SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| VLM | 1,533,760 bytes; start/exec SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| Configuration | SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |
| Exact-command interposer | SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7` at execution |
| Typed X/exact-relay compatibility preload | SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1` at execution |
| RFC 868 responder | SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`; one validated request/reply; exit status 0; completion SHA-256 `09386bd959f4ecb8de0d2813d6d3d75ca4ded7e75d278a317c28ca14c2210b9b` |
| X security/compatibility | MIT-SHM disabled and live-verified absent; both exact guest-relay substitutions observed before `running` |
| Relevant input | Listener queries for every system name containing `CLIM`, then `(list (find-package "CLIM") (member :clim *features*))` |
| Relevant result | System scan `NIL`; package/feature result `(NIL NIL)` |
| Action record | 28 intent/outcome records for the combined D28/D29 session; generation-3 action-log SHA-256 `4a9092f81f257295b8be15311418e57e9eaad5f7299fcebab532d6860f928041` |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`; Python 3.11.14; Xorg Server 21.1.21; Bubblewrap 0.11.0 |
| Shutdown | Prompt, confirmation, and cleanup progress observed; known VLM cleanup stall required bounded forced stop; not orderly; state may be incomplete; no harness process checkpoint; Save World and guest checkpoint remain unknown |

The final system scan searched all registered system names for `CLIM`, rather than
only a hand-picked six-name list. The package and feature check independently
corroborates absence: the CLIM declaration would create the package and push CLIM
features when loaded. The optional source media exists on the host, but the sandbox
deliberately exposes no guest file service. No `Load System CLIM` attempt was made,
because it could only test missing site/media configuration or widen the isolation
boundary; it could not safely reach these frames in the current setup.

Two raw Listener captures record those negative results. They remain ignored and
unpublished: `0010-clim-system-status-runtime.png` is 11,748 bytes, PNG SHA-256
`50cfae39733ca7815ca0dd150aa1d659987ada8a2961f593610fe43dcab97b0c`, normalized
pixel SHA-256 `82dca042cd4c94cc0560999ff96836a0aa6c571898387a68c73e6d6f6ef0d6e1`;
`0011-clim-package-feature-status.png` is 11,852 bytes, PNG SHA-256
`cc64888a59e7850ae526ca08cc17ba050d4d8832eb1b9df8d2a9a724e5abbccc`, normalized
pixel SHA-256 `8de9dc9ccbb2da887f29f57cdeb265aac1a2517f29942d9efa6a3b85af4056bc`.
Neither depicts a D59 program, so neither meets the museum's evidentiary usefulness
threshold. There is no publishable application screenshot to review under the
[screenshot publication policy](screenshot-publication-rights-review.md).

## Artifact identities

All paths in these tables are portable paths below the licensed
`sys.sct/clim/rel-2/` media root. They disclose no machine-specific location and no
source contents.

### Demo source manifest

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `demo/address-book.lisp.~38~` | 11,969 | `b071cac0edee92e2cc33f3efed908e40838d0f4b74b0af501fc2c51b19695723` |
| `demo/bitmap-editor.lisp.~14~` | 8,239 | `eed55ba9278303874c31683a24645a94e270c0d6b2c7eb26b492c13cd107af2c` |
| `demo/browser.lisp.~31~` | 61,067 | `22473fd02e6dbebf4b626559e21d0d3e8d5dda6e9d14621efd1a27431239a95e` |
| `demo/cad-demo.lisp.~175~` | 35,288 | `b2e03c7916861b6b274e898bf604cd413a8a7e807807281f08ba96a54e2fb089` |
| `demo/color-editor.lisp.~12~` | 9,755 | `b3bc5bd3b34f69de25d9089848bb2d171b1598d98cc4145027021272e01edb55` |
| `demo/custom-records.lisp.~6~` | 22,333 | `63dc3eb3f572112ff03dfea71b24dc45cb8370a882a264af5575262153f84d10` |
| `demo/demo-activity.lisp.~9~` | 6,092 | `9cc9175c1160b96bb47534f910d6d49bcf8dfbe4ce3b31594e78a5af488946eb` |
| `demo/demo-driver.lisp.~73~` | 5,230 | `bc09592aede9804420ed1dcebfccd67bbacff3098cd9687bbaa3eab1dcff0277` |
| `demo/demo-prefill.lisp.~32~` | 27,110 | `89797624a058f783def73268cdc5d6a39c72185fe53b0ec178b686b4d4003960` |
| `demo/graphics-demos.lisp.~77~` | 11,706 | `21fb045211cbf6a79876592fa84e2829832c1d4670400171b76cda32f367db76` |
| `demo/graphics-editor.lisp.~19~` | 25,705 | `5e45f4caa635dc67be3fe6125d92f5fdd7b9a65ec7ee6e510be37bdf2d01f5ab` |
| `demo/ico.lisp.~25~` | 21,756 | `7e3f72724694cdd3c14d1f90a07448de80ae3ed87d7cc63190fc9fd3f40fc29f` |
| `demo/listener.lisp.~137~` | 26,716 | `ed08efc91dd44336540b3682553fd7cf9ab4b2b5522342dc98d024785bd7ef30` |
| `demo/navdata.lisp.~21~` | 16,365 | `d55ce65b7c23f3ca7a40011686371271a8e6d77b785e140c6169bcdb9da481a6` |
| `demo/navfun.lisp.~148~` | 64,310 | `349f565e8b9e6fc3e97d6ebe229f5fdb7d051b44927d5be8ba334aaab9e41f1b` |
| `demo/peek-frame.lisp.~3~` | 14,091 | `4b4a292a1f67274ae2b93bc548e75bd18b834b04c4d55b1645234f13ba74d59f` |
| `demo/plot.lisp.~26~` | 29,987 | `14e7cb587bcb84af5888d5b7961f254fab2262c5b04ec12cde70b54418750baf` |
| `demo/packages.lisp.~17~` | 4,283 | `2ecdba882616741807bb28990eee329e3689a98f11a7b22546aad5e9e65cc0fc` |
| `demo/puzzle.lisp.~88~` | 9,367 | `45a561ca7e02e2351fb8752b374770c6a3193cb9085ab32114233ef9d89befec` |
| `demo/thinkadot.lisp.~38~` | 9,356 | `fc0184401cd6de47e572eb5894ff944c92a833c59fd531c0294926aa283f6b83` |
| `demo/sysdcl.lisp.~71~` | 5,486 | `5ae55a763d365386197d2b4b8ed1bf5f746164f610d3a742b9f5b53a4f5b6251` |
| `demo/patch/clim-demo.system-dir.~58~` | 4,123 | `e3edf77db06164103bf2dd84f1d4d57d61394f0ff35420f5593781783c910cad` |

The Demo directory contains twenty versioned VBin modules totaling 617,368 bytes,
including package and prefill support. A portable manifest consisting of each
VBin's SHA-256 and basename has SHA-256
`1bdde9f8f107abf6415695dce1bc884aa8c650d6127ee272e20cab80d6ea4dbb`.
This compiled census corroborates distribution, not loading or behavioral success.

### Tutorial and test source manifest

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `tutorial/clim-tutorial-system-definition.lisp.~4~` | 3,885 | `e94c292444889e84b3194722b8215e93cd6b577ade622f7aeaf38b34166b4aca` |
| `tutorial/least-squares-1.lisp.~3~` | 27,376 | `47def7b59a14eddd9c58a74bd37a28cf9a2ef1d676f95768848f005e1b88bb6a` |
| `tutorial/least-squares-2.lisp.~3~` | 35,989 | `d5fdee126a3b321e0fafd857987098d161e44ef8fb97542f02b6e4d555bf6422` |
| `tutorial/puzzle-1.lisp.~3~` | 5,038 | `8ed1b9043aa6ad816ec8b0a93ca40778b5bb8a812f47c870435c23fa94f3d772` |
| `tutorial/puzzle-2.lisp.~4~` | 5,940 | `591a3c82d24d3b89a583f6986c6a45ce542f06bfe961254d691ab5538a9cdd9d` |
| `tutorial/puzzle-3.lisp.~2~` | 6,756 | `5267757e80b8a96f543bc0a18ee8031a43b5d64aac556af0314572945aa9a398` |
| `tutorial/puzzle-4.lisp.~2~` | 6,079 | `426585aca8c4358fdda21ae3f44cec889d9290e029ebe19305bcfbf11aca3f5c` |
| `tutorial/puzzle-5.lisp.~2~` | 6,269 | `d53f172c29acd5a5b0c0612fa6a2bf7deab50a2b53c130f3ed96d615a1182102` |
| `tutorial/tic-tac-toe.lisp.~2~` | 15,383 | `9b4d4bdb17b558bb59fd427046cf649fe082892d760c9d8e24b131e1538632a4` |
| `test/test-suite.lisp.~121~` | 121,575 | `25997893ac3fcb44c20bcf40ed2781bdaf6133aea6f6c67d4c34706698ce4889` |
| `test/test-suite.vbin.~6~` | 269,118 | `902d99205d76dca16d2110a2fbab83c9f378b05e1939a1a178781487aea49ba7` |

No tutorial VBin is present in the inspected Tutorial directory; the declaration
and source are present. This does not prove Symbolics never distributed compiled
tutorials elsewhere, only that this media path is source-only.

### Installed Help source identities

These are hashes of the ignored licensed SAB inputs as recorded by the inert Help
extractor, not hashes of prose reproduced here.

| Logical artifact | Source bytes | Source SHA-256 | Records |
| --- | ---: | --- | ---: |
| `doc/clim/ug.sab` (`ug.sab.~180~`) | 124,755 | `fca774decf0685f4620f587384660833cb925893b3ebb09d4cc2f9ca3972baa4` | 31 |
| `doc/clim/tutorial-root.sab` (`tutorial-root.sab.~23~`) | 5,850 | `42c54f74621ba8dcfebfc94a47980d123d135a257febf2a3bd3578daedb5389f` | 3 |
| `doc/clim/tutorial-fifteen-puzzle.sab` (`~43~`) | 87,346 | `b8ada47990ae4777949f703b2ad98ded74bc2754b4de563500c32a30e96eb372` | 18 |
| `doc/clim/tutorial-least-squares.sab` (`~22~`) | 32,611 | `b478976205a9e51b1fd7902fce89aa556d714c81d5b78b9fe3013d84f0b2394b` | 11 |
| `doc/clim/tutorial-tic-tac-toe.sab` (`~17~`) | 11,570 | `1c47579d7f3341460f0c67353e6708010d1e1b8aac0d45404293279766882265` | 5 |
| `doc/clim/tutorial-fifteen-puzzle-code.sab` (`~18~`) | 20,980 | `5d479f0ba841990ac2e1faae4cf9868202bad8808358b922567c43539d5bd371` | 5 |
| `doc/clim/tutorial-least-squares-code.sab` (`~7~`) | 25,977 | `785925949c84813e0a314cdaa745fb84f4e96213c0b402b74d55fdd3f4da74b8` | 1 |
| `doc/clim/tutorial-tic-tac-toe-code.sab` (`~13~`) | 14,397 | `9ab7182b45a661e0b88bb5c6bd0bbd17ee49a67ea54f22cefd8878112ea5a0d8` | 1 |

## Preservation and future verification

- Keep every licensed source, VBin, SAB, decoded Help file, restored world, and raw
  harness capture untracked. This page contains evidence metadata and original
  analysis only.
- Restore CLIM and Genera-CLIM into a fresh private world through a deliberately
  configured, read-only guest media service. Load CLIM Demo, CLIM Tutorial, and
  the test suite separately; do not save over the base world.
- Verify each source anomaly independently: bitmap current-color behavior; CAD
  feedback failure; browser package-subnode title; Flight Planner cost edit and
  coordinate warning; Plot label methods; LSQ slot/zoom/visibility defects; Peek's
  absent Genera GC/OS data; and Test Suite conditional counts.
- Use only synthetic address, filesystem, package, process, graph, navigation, and
  benchmark data. Never operate Flight Planner as an aviation tool or Peek against
  an important process.
- Curate the minimum screenshots needed for substantive claims. Keep raw sequences
  local; review every selected image under the four-factor policy; exclude Help
  prose, third-party artwork, and decorative galleries.
- Do not use modern McCLIM, Allegro CLIM, or LispWorks CLIM output as a proxy for
  this Genera port. They can help explain portable architecture, but only the
  licensed Genera runtime can verify these exact frames.

## Sources

- Symbolics, [*Common Lisp Interface Manager (CLIM), Release 2.0*](https://bitsavers.org/pdf/symbolics/software/genera_8/Common_Lisp_Interface_Manager__CLIM__Release_2.0.pdf),
  especially the Fifteen Puzzle, Tic-Tac-Toe, and Least Squares tutorial chapters;
  “Using the CLIM Demos”; and the application-frame, presentations, output-record,
  redisplay, formatted-output, gadget, and command chapters.
- Symbolics, [*CLIM 2.0 Release Notes and Installation Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/CLIM_2.0_Release_Notes_and_Installation_Guide.pdf),
  for release-local loading, compatibility, and port context.
- Licensed Open Genera 2.0 / Genera 8.5 `SYS:CLIM;REL-2;DEMO;`, `TUTORIAL;`, and
  `TEST;` declarations, source, compiled inventory, patch metadata, and recovered
  installed Help identified above; inspected 2026-07-18.
- [CLIM 2 on Symbolics Genera](clim-2-on-genera.md), for the portable/native layer
  boundary, full common input-editor bindings, optional-system census, and the same
  isolated runtime prerequisite probe.

Last verified: 2026-07-18.

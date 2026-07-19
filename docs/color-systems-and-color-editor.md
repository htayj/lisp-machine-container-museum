---
type: Historical Article
title: Color systems, the Genera Color Editor, and CADR color experiments
description: An evidence-bounded guide to indexed and direct color, the complete Genera Color Editor and Color Palette interaction surfaces, and the distinct MIT CADR color mechanisms and experiments.
tags: [genera, mit-cadr, lm-3, color, color-editor, color-palette, graphics, preservation]
timestamp: 2026-07-18T09:32:00-04:00
---

# Color systems, the Genera Color Editor, and CADR color experiments

The Genera Color Editor is a component editor for live color objects, not a paint
program and not a direct continuation of the MIT CADR's `COLORHACK`. It presents
one or more three-slider color models, updates a large specimen pane, and either
uses direct RGB drawing or temporarily manages an indexed color map. Its companion
Color Palette selects, interpolates, organizes, and serializes libraries of color
objects. The two tools are separate interfaces shipped by one experimental
`COLOR-EDITOR` system.

The public CADR material represents an earlier and much smaller layer: a four-bit
indexed framebuffer, sixteen mutable color-map entries, drawing primitives, and a
set of laboratory or demonstration programs. Those programs are chronological and
conceptual antecedents to later interactive color work, but no inspected source
establishes that Genera's Color Editor descended from `COLORHACK`, `COLXOR`, or
`CAFE`. This page keeps the lineages distinct.

The preserved Open Genera world did not yield a Color Editor window in the current
isolated runtime. Its main X screen reported 24 useful bits per pixel, but no Color
subsystem screen was registered, `COLOR:EDIT-COLOR` was not resident, and loading
`COLOR-EDITOR` required the unavailable site file server. Thus a 24-bit host or X
transport must not be mistaken for a configured Genera color workstation. The
current visible presentation remained black and white, and this article does not
substitute the monochrome fallback selector for the real Color Editor.

## Evidence and release boundaries

| Evidence set | What it establishes | Boundary |
| --- | --- | --- |
| MIT CADR System 46 public source | The distributed color-screen substrate, indexed map operations, raster drawing, and the transition away from the old `COLOR-INKS` cache. | Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af`; the public tree contains no `CAFE`, `COLXOR`, or `COLORHACK` source. |
| LM-3 System 303 public Fossil source | The maintained color library and the three color experiment files, plus their changing inclusion in `HACKS`. | `sys` check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; this is a restoration branch, not a 1980s release date. |
| Licensed Open Genera 2.0 / Genera 8.5 media | `COLOR` 427.1, `COLOR-EDITOR` 421.0, Graphics Toolkit 23.0, implementation source, system directories, and the in-system Color documentation. | Conclusions apply to the exact local media identified below. No licensed source, decoded Help, palette, or screenshot is tracked by this page. |
| Isolated Open Genera runtime | The base world's screen depth, absent registered Color screen, absent resident editor entry point, and failed disconnected load. | Session `d33-color-systems-20260718`, generation 1, 2026-07-18. It did not reach the application UI. |

The Genera system declaration says that `COLOR-EDITOR` was created in the Symbolics
Graphics Division in November 1983 and revised in December 1987 to include Graphics
Toolkit. The main editor file records a February 1984 creation date. `COLORHACK`
credits work from December 1982 and June 1983. Those dates establish overlap and
sequence, not code ancestry.

## Two ways pixels become colors

“Indexed” and “direct” describe how pixel data select displayed RGB values. They do
not describe vector versus raster graphics; both systems discussed here ultimately
draw pixels.

| Model | Pixel interpretation | Consequence for an editor |
| --- | --- | --- |
| Indexed or pseudocolor | One pixel index selects a slot whose red, green, and blue values are stored in a color map. Genera's common eight-bit case has 256 possible indices. | Changing a map slot can recolor every pixel carrying that index without rewriting the framebuffer. The editor must share, reserve, or temporarily replace scarce map slots. |
| Genera direct color | A pixel supplies independent eight-bit red, green, and blue fields. Each field still passes through its corresponding map, normally initialized as an intensity ramp. | Approximately 16.7 million RGB combinations are addressable. The editor can compute an RGB drawing ALU instead of allocating a private pseudocolor ramp. |
| CADR color TV | A four-bit pixel indexes one of sixteen mutable RGB entries. Each entry has eight-bit red, green, and blue components. | Geometry and apparent color are independent: animation can leave pixel indices fixed and alter only the sixteen-entry map. |

Genera's protocol makes the distinction observable. A screen's
`:COLOR-MAP-DESCRIPTION` returns `:INDEPENDENT` for a direct-color map and
`:DEPENDENT` for pseudocolor. The Color Editor's `:ASK` mode uses exactly that third
return value. The wider Color implementation also understands 8-, 12-, and 24-bit
map modes, selectable map segments, and transparent or replacement overlays.
Available combinations depend on the controller; these are software capabilities,
not a claim that every Symbolics machine had every board.

The `COLOR` system is correspondingly much larger than the editor. Its serial build
includes Graphics Support, common color-map and control protocols, allocation,
machine-specific common code, general drawing, slave bitmaps, overlays, frame
grabbers, controller drivers, commands, documentation, and synchronization programs.
The declarations name CAD Buffer I and II, standard, high-resolution, chroma,
low-resolution, VME, Univision, NuBus, NuVista, FrameThrower, and X modules. The
small `simple-color-map-mixin` exposes only `:8-BIT`, a dependent map, and no overlay;
the common layer supplies the broader abstraction.

## Genera Color Editor architecture

`COLOR-EDITOR` is declared experimental, patchable, and source-distributed. It
depends on the latest `GRAPHICS-TOOLKIT` and `COLOR` systems, then loads
`BASIC-SLIDER`, `COLOR-PALETTE`, and `COLOR-EDITOR` in that order. The inspected
system directory marks 421 as both released and latest. It was generated in Open
Genera 2.0 on an 8-bit pseudocolor X screen, which is useful provenance but does not
mean that the editor is resident in every distribution world.

The UI predates the Dynamic Windows application-frame style. Its `COLOR-EDITOR`
flavor combines:

- an editor state and constraint-layout mixin;
- a virtual color map and color-map allocator;
- `TV:TEMPORARY-WINDOW-MIXIN`, added because exposing an ordinary window could
  otherwise destroy the underlying color display;
- a property list for interactive configuration;
- a bordered constraint frame with a shared input/output buffer.

The frame contains one specimen pane, one command-menu pane, and nine reusable
slider panes. A selected model consumes three sliders. The layout activates as many
complete three-slider groups as fit; it does not expose a partial model. Resizing
recomputes the slider capacity, and the constraint set is rebuilt from the active
panes.

### Entry points and return values

| Entry | Behavior in the inspected source |
| --- | --- |
| `Load System Color-editor` | Loads Color Editor, Color Palette, Graphics Toolkit, and Color dependencies. This is a Command Processor form, not Lisp function syntax. |
| `Edit Color` | Global Command Processor command; calls `COLOR:EDIT-COLOR`. |
| `Select Color` | Global Command Processor command; calls `COLOR-PALETTE:POP-UP-COLOR-PALETTE`. |
| `COLOR:EDIT-COLOR` | Reuses an existing editor window or creates one on a color screen. On success it returns the edited input object, a new color object, or `NIL` after Abort. If no color editor window can be made, it calls the black-and-white chooser. |
| `COLOR:COLOR-EDITOR` | Function alias for `COLOR:EDIT-COLOR`. |
| `COLOR-PALETTE:POP-UP-COLOR-PALETTE` | Finds or creates a color screen, preserves pointer and pan/zoom state, optionally forces zoom 2, and invokes the palette. It returns the selected color or `NIL` on cancellation. |
| `COLOR:COLOR-DEMO` then **Edit Color** | Documented practice path that loads the editor, but does not give the caller the returned object. |

When an input object is supplied, the editor duplicates it through RGB and commits
RGB values back to that same object only on **Done**. **Abort** returns `NIL` without
that commit. When no object is supplied, the inspected source constructs a new
`STANDARD-COLOR` and initializes it to RGB `(0.5, 0.5, 1.0)`, a light blue. This
contradicts the chapter's claim that the initial specimen is the last color used.
Runtime testing on a loaded 421 system is still required to determine whether a
patch changed one side of that discrepancy.

The wrapper preserves the previous mouse sheet and location, color-screen pan and
zoom, and—when using a private indexed map—the screen's prior map. Closing or
deexposing the temporary editor injects an Abort event. No Save World or application
file write occurs merely by editing a color.

### How the sliders work

Each slider's left and right endpoints are recomputed by copying the current color,
setting only that component to its minimum and maximum, and interpolating between
the two. Other components therefore remain fixed while the background answers the
question “what would this color look like across this component's range?”

Pressing any mouse button in a slider enters the same tracker. The implementation
grabs the mouse, hides its blinker, maps horizontal position linearly into the
component range, and clamps at the endpoints. While the button remains down it makes
only low-cost updates; on release it performs the full redisplay and, for indexed
mode, commits the managed map. The documented mouse line says **L: move slider
here**, but the event method itself does not distinguish left, middle, and right.

There is no Color Editor application keymap. The top-level loop acts on structured
mouse/menu events and ignores ordinary character input. Clicking the specimen pane
with any button opens the System Menu; its mouse documentation is **CLICK FOR SYSTEM
MENU**.

### Color models exposed by this source

The **Model** dialog is built dynamically from the current value object's
`:LIST-COLOR-SPACES`; each entry has independent **Yes** and **No** choices. With the
default `STANDARD-COLOR`, the inspected flavor composition provides four models:

| Model | Sliders and source ranges | Notes |
| --- | --- | --- |
| RGB | Red, Green, Blue; each 0.0–1.0 | Normalized component values. |
| IHS | Intensity 0.0–sqrt(3), Hue 0.0–1.0, Saturation 0.0–1.0 | Hue is circular; the editor abbreviates Intensity and Saturation as Int and Sat when side labels are used. |
| Hexcone-IHS | Hexcone Intensity, Hue, Saturation; each 0.0–1.0 | Uses a different solid geometry from the trigonometric IHS conversion. |
| YIQ | Y 0.0–1.0, I -0.60–0.60, Q -0.52–0.52 | Represents luminance and two chrominance axes. |

The common source also defines CMY conversion and a CMY mixin, but does not mix it
into `STANDARD-COLOR`. It contains RGB/YUV conversion functions but no YUV object
mixin in this file. The Color documentation says standard objects provide YUV as
well. That is another release or patch disagreement to test rather than resolve by
guesswork.

### Complete Color Editor menu and configuration surface

| Main item | Effect |
| --- | --- |
| **Done** | Commit RGB to the supplied object, or return the new value object; close the edit. |
| **Model** | Open **Choose Models**, rebuild active three-slider groups, and redraw. Multiple models may be active simultaneously. |
| **Config** | Open **Select Configuration** with every option listed below. |
| **Abort** | Return `NIL` without committing to the supplied object. |

| Config field | Exact choices | Default and implementation effect |
| --- | --- | --- |
| Display Size | Small `.2`; Medium `.3`; Large `.4` | Medium; fraction of the frame assigned to the specimen pane. |
| Numeric Redisplay Mode | Continuous; Incremental | Incremental; continuous updates while tracking, incremental updates at the full release-time redisplay. |
| Numeric Display? | Yes; No | No. Turning it on forces side labels off; turning it off forces side labels on. |
| Number of Color Segments | 20, 40, 60, 100 | 60; a direct-color ramp is drawn with this many sections, bounded also by pane width. In indexed mode, available map slots and active panes determine the effective count. |
| Color Mode | Use Standard Palette; Use best; Use color map | Source values are `T`, `:ASK`, and `NIL`. `:ASK` chooses direct drawing only for an independent map; `NIL` allocates a private indexed map. |

The manual describes a separate **Side Labels?** choice. In `COLOR-EDITOR.LISP.72`
that row is commented out, while the numeric-display setting forcibly selects the
opposite label layout. This page reports the source-visible 421 surface; the
documented extra row remains a runtime TODO.

### Direct versus indexed rendering inside the editor

In direct mode, the specimen pane converts the current RGB values into an RGB ALU,
and every slider ramp computes its segment colors the same way. In indexed mode, the
editor creates a virtual map with one object per hardware slot. Slot zero is left
outside its default allocation, the final slot is initialized white and likewise
excluded, and the specimen pane claims one required slot beginning at slot one. The
remaining slots are divided among active slider bars, limited by the requested
segment count and each pane's pixel width.

The indexed path explains two visible effects described in the manual: ramps may
have fewer than the requested 60 colors, and taking over a pseudocolor map can make
other simultaneously visible indexed images change appearance. The editor restores
its saved map when the edit unwinds.

## Genera Color Palette

The Color Palette is the persistent-selection side of the system. A page is 48
chips—four rows of twelve—with a selected-color specimen, function boxes, and page
selectors. Its initial rows are:

1. grays from black to white;
2. bright saturated hues around the color wheel;
3. darkened versions of those hues;
4. desaturated versions of those hues.

The implementation represents a palette as a Graphics Toolkit `ROW-DATABASE` with
row length 12, and the collection of named palettes as a `LIST-DATABASE`. An empty
chip is `NIL`, displayed by the legacy layout as a small point rather than as a
white color.

### Complete chip and row gestures

| Gesture over a chip | Filled chip | Empty chip |
| --- | --- | --- |
| Left | Copy that chip into the selected-color box. If the palette is short-lived, also exit with it. | Copy the selected color into that slot. |
| Middle | Recompute the entire row as an interpolation from its first to its last chip. | Fill the gap bounded by the nearest nonempty chips to the left and right. |
| Right | Delete the chip. | Leave it empty. |
| Shift-left | Replace the row with the next of the four initial row sets: grays, bright colors, dark colors, desaturated colors. | Same row operation. |
| Shift-middle | Repeat the last row-menu operation on this row. | Same row operation. |
| Shift-right | Open the row menu listed below. | Same row operation. |

Interpolation is not a naive component-by-component RGB ramp. `RINGLESS-INTERP`
first interpolates RGB, then independently interpolates intensity and writes that
intensity back. The source says this avoids the dark band that ordinary RGB
interpolation can produce in a round brush.

The full-row implementation has an unresolved arithmetic anomaly: for twelve slots
it rewrites slots 1 through 11 using a divisor of 10, so the final interpolation
factor is 1.1 rather than 1.0. The intended endpoint behavior described by the
manual must be checked in the running release before treating this as a visible bug.

The Shift-right row menu is complete in the inspected source:

| Row command | Operation |
| --- | --- |
| Delete Row | Replace all twelve cells with `NIL`. |
| Reverse Row | Reverse chip order. |
| Shift Row | Rotate the row one position to the right. |
| Desat Row | Subtract 0.05 from each chip's hexcone saturation. |
| Saturate Row | Add 0.05 to each chip's hexcone saturation. |
| Lighten Row | Add 0.05 to each chip's hexcone intensity. |
| Darken Row | Subtract 0.05 from each chip's hexcone intensity. |

The page source uses the special characters `MOUSE-L-2` and `MOUSE-R-2` for the
shifted left and shifted right gestures; Genera's mouse documentation maps those
characters to **sh-L** and **sh-R**. They are not additional undocumented commands.

### Complete function-box and page surface

| Function box | Effect |
| --- | --- |
| Exit | Return the selected color. With an input object, write the selected RGB values into it. |
| Rows | Choose Grays, Colors, Dark Colors, Desat Colors, or Delete, then choose Row 1, 2, 3, or 4. |
| Edit | Invoke `COLOR:EDIT-COLOR` on the selected color and replace the selection with a successful result. |
| Libr | Open the library menu below. |
| Abort | Return `NIL`; the wrapper restores the original input object's RGB values if necessary. |

| Library item | Effect |
| --- | --- |
| Select | Make another in-memory named palette current. |
| New Library | Create an empty palette, prompt for a name, register it, and select it. |
| Make Copy | Copy the current palette, prompt for a name, register it, and select it. |
| Delete from Memory | Select and confirm removal of an in-memory palette. |
| Erase Current Library | Confirm, then remove every page and row from the current palette. |
| Save to File | Select one or more libraries, choose a Graphics Toolkit project, and serialize each selected object. |
| Read from File | Choose a project and one or more palette object files, then load them into the object registry. |

An **Append** implementation remains in `GENERAL-SAVING-MENUS`, but its menu entry is
commented out. It is not part of the current user-facing list.

The selector column contains the current page number plus **1**, **-**, and **+**.
**1** returns to the first page. Left on **-** or **+** moves one page, middle moves
one row, and right moves five pages. Palette top-level character input is not a
command surface: ordinary characters beep. Text entry is meaningful only in the
name, project, and file-choice dialogs.

### What a saved palette file is

A saved palette is neither a bitmap nor a plain RGB table. Each `PAINT-COLOR` has a
FASD reconstruction form containing red, green, and blue initialization values. The
Graphics Toolkit external-object machinery walks a selected palette, resolves its
project, and calls `SYS:DUMP-FORMS-TO-FILE` on a form that adds the reconstructed
object to its class library. Loading resolves an external tag to the project's
palette subdirectory with canonical type `IBIN` and evaluates the dumped form.

This is therefore a Genera serialized object/form file with executable load
semantics. It is meaningful inside the corresponding Graphics Toolkit and class
environment, but it is not an interchange palette comparable to GPL, ACT, or a raw
RGB file. A preservation converter should parse it inertly and emit explicit rows,
slots, RGB triples, names, and source provenance rather than loading untrusted
serialized forms.

The manual's older workflow says that **Save to File** prompts for a pathname. The
inspected Graphics Toolkit source instead chooses a registered project and resolves
its palette subdirectory. This source/manual difference also needs runtime 421
verification.

One source boundary matters for visual reconstruction: the current
`COLOR-PALETTE.LISP.56` marks its old layout object, window resource, and item
construction methods as disabled until a newer Paint version is installed. The
active behavior methods and manual establish the operations, but the exact pixel
layout can depend on definitions supplied by Paint. It should be captured from a
running 421 configuration rather than reconstructed from the disabled block alone.

## MIT CADR color substrate

System 46's active `LMWIN; COLOR 33` defines a 576-by-454 `COLOR-SCREEN` with four
bits per pixel. Because the source uses octal notation, map sizes `20` and final
index `17` mean decimal 16 and 15; component maximum `377` means decimal 255. The
screen stores indices, while a 16-by-3 `ART-8B` array mirrors the hardware RGB map.

At warm initialization the code probes the color controller. Only a successful
probe programs synchronization, installs the **Color Window** System Menu entry,
and permits exposure of the screen. A failed probe removes that entry. The library
provides:

- synchronized and immediate map writes, whole-map transfer, map reads, fills,
  primary, spectrum, grayscale, and random maps;
- bars, stripes, crosshatches, rectangles, points, lines, characters, and strings;
- map-only animations such as random flashing and gradual exchanges;
- a `COLOR-SCREEN` font conversion path for ordinary one-bit fonts.

The active System 46 implementation uses one refillable 8-by-1 four-bit array as a
solid `BITBLT` source. The older `LMIO; COLOR 69` instead cached sixteen 8-by-8
arrays under the misleadingly broad name `COLOR-INKS`. They are implementation
tiles, not a palette or authored art. The dedicated
[color inks and raster patterns article](mit-cadr/color-inks-and-raster-patterns.md)
documents that transition and the separate monochrome gray/stipple system.

System 303 `WINDOW; COLOR 70` retains the indexed screen and map, uses
`TV:STANDARD-SCREEN`, initializes the primary map when hardware is present, and
documents **Color Window** in the System Menu. It adds `RECTANGLE` as the preferred
width-and-height API while retaining endpoint-based `COLOR-BITBLT` as obsolete
compatibility.

There is no high-level color object, selectable model set, named palette library, or
file format in this CADR layer. Apparent colors are mutable hardware state; a saved
four-bit framebuffer alone cannot reproduce its appearance without the matching
map.

## CADR experiments: three distinct programs

The three experiment files survive in the LM-3 restoration tree but not in the
public System 46 snapshot. `SYSDECL.LISP.198` included all three in `HACKS`;
`SYSDECL.LISP.200` comments them out with “leave out color stuff.” Their source still
exists, and `COLXOR` still contains a `DEFDEMO` registration, but the pinned System
303 `HACKS` build does not load them by default.

### COLORHACK: library and two small interactive mixers

`COLORHACK.LISP.8` is primarily a library. Its function named `COLORHACK` contains
only a documentation string; calling it does not launch an application. A user must
load the file and call `USE-COLOR-SCREEN`, which caches screen geometry and creates
an RGB counter window and a color-screen mixer window.

Its feature surface is:

- named RGB triples for black, white, red, green, blue, lime, cyan, and violet;
- single-slot get/set, whole-map read/write/print, black, random, linearly shaded,
  interactive-definition, melt, and wandering-map operations;
- direct pixel, clipped pixel, line, clipped line, character, string, outline
  circle, filled circle, and overlapping-primary-circle drawing;
- `DEFINE-COLOR`, which edits one map slot while an ordinary window displays its
  red, green, and blue values in octal;
- `MIX-COLOR`, which displays overlapping red, green, and blue circles and edits the
  seven nonempty combinations.

For both interactive mixers, hold left to increase red, middle to increase green,
and right to increase blue. Double-clicking and holding changes the sign and
decreases that component. Any keyboard input terminates the mixer and returns an RGB
list. There are no menus and no palette-file commands.

Source inspection exposes a preservation defect: `READ-MAP` terminates when the
loop variable equals `*LAST-COLOR*`, so it copies indices 0 through 14 but not index
15. `WITHOUT-CLOBBERING-MAP` consequently cannot be assumed to preserve the final
slot unless it was already valid in the save array.

### COLXOR: geometry plus color-map motion

`COLXOR.LISP.55` increments four-bit pixel indices while symmetric line and wedge
routines build patterns. The visible motion then comes mainly from cycling or
perturbing map entries. This cleanly demonstrates the separation between indexed
geometry and its current colors.

If the file is loaded with the demo framework available, **Color TV Hacks** contains:

| Demo | Operation and termination |
| --- | --- |
| Smoking Clover | Clear the color screen, install a random map, draw Gosper's symmetric wedge pattern, then animate the map through `COLOR-GUARD`; any pending terminal input stops the animation. |
| Cafe Slide | Run the separate cafe-wall illusion below; the menu documentation asks for Space to begin. |
| Color Mash | Perturb successive map entries; any pending terminal input stops it. |
| Color March | Shift changing RGB values down the map; any pending terminal input stops it. |
| Random Ramp | Fill the sixteen entries once with bounded random RGB values; finite operation. |
| Brighten | Install a finite red/green/blue intensity arrangement intended to make the display more visible. |

`COLOR-RAMP` is present in source but its demo entry is commented out as unable to
work. The guarded top-level demonstrations notify the user when the color hardware
probe fails instead of writing blindly to absent hardware.

### CAFE: map-animated cafe-wall illusion

`CAFE.LISP.9` is not a color editor. Its unmarked integer constant `22` is octal in
this Base-8 file, so it draws an 18-by-18 cafe-wall pattern, not 22 by 22, with a
spacer one-sixteenth of a row high. `CCH` assigns black, white, and middle gray to
three map entries for a static illusion; `CCHC` sinusoidally exchanges the first two
gray levels.

`CAFE-SLIDE` draws a finer striped checker. Each row starts with one stripe in
background index 0; subsequent stripes cycle dynamic indices 1 through 14 on even
rows and use them in reverse order on odd rows; index 15 is the spacer. Source
comments call the dynamic range 1 through 16, but the Base-8 code bounds are octal
`1` through `16`. It waits for one character before animation;
the demo menu calls that character Space, but the function accepts any character.
It then repeatedly sweeps map entries in opposite gray directions. A later
`:TYI-NO-HANG` exit test is commented out, so there is no application-level stop key
after motion begins; process or Abort control is required.

Revision 9 changed its fill call from endpoint-based `COLOR-BITBLT` to
width-and-height `COLOR:RECTANGLE` without changing endpoint-shaped arguments. Static
inspection therefore suggests oversized or clipped rectangles, but only a color-TV
runtime can establish the visible result. It remains an explicit TODO, not a claimed
historical behavior.

## Runtime observation and screenshot boundary

The Genera probe used the isolated
[Genera Xvfb harness](genera/genera-computer-use-harness.md). The relevant ordered
actions were:

1. An overlong combined probe timed out during host typing and was never evaluated;
   the stuck key was released and the input was cleared.
2. `(list (send tv:main-screen :bits-per-pixel) (send tv:main-screen
   :useful-bits-per-pixel))` returned `(24 24)`.
3. A guarded call to `COLOR:FIND-COLOR-SCREEN` with `:CREATE-P NIL`, `:ERROR-P NIL`,
   and `:WHICH :ALL` returned `NIL`.
4. A probe for the unsupported `:COLOR-P` message entered the error handler. In its
   evaluator, `(fboundp (quote color:edit-color))` returned `NIL`; Control-Z then
   returned to the listener top level.
5. `Load System Color Editor` was rejected because the parser treated `Editor` as
   an extra keyword. After clearing that input, the documented token
   `Load System COLOR-EDITOR` treated the name as an unknown system and tried to read
   `DIS-SYS-HOST:>sys>site>color-editor.system.newest`, producing a site-login
   prompt. Control-Z and Abort returned to the listener.

| Runtime item | Portable record |
| --- | --- |
| Session | `d33-color-systems-20260718`, generation 1; action log 34 records, SHA-256 `7a07192271f9597037dc7cbb134c1f4d2998e2a1910bcdc6a00c531daafdb86b` |
| World | `Genera-8-5.vlod`, 54,804,480 bytes, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| VLM | `genera`, 1,533,760 bytes, SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| Debugger | `VLM_debugger`, 346,880 bytes, SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Compatibility inputs | X preload `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`; ifconfig preload `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`; RFC 868 responder `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`; config `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |
| Execution envelope | Bubblewrap user, mount, network, PID, IPC, and hostname isolation; private `tun0` without an external route or host file service; Xvfb 1440x1100x24 with MIT-SHM verified absent. Main Genera client 1200x900, title `Genera on DIS-LOCAL-HOST`. |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`, channel commit `230aa373f315f247852ee07dff34146e9b480aec`; CPython 3.11.14. |
| Shutdown | Prompt observed, `yes` sent and accepted, cleanup progress observed, then bounded force after the known VLM cleanup stall. `forced_stop` and `state_may_be_incomplete` are true. Base and private world hashes remained unchanged. Save World and guest checkpoint status remain unknown; the harness created no host-process checkpoint. |

Raw 1200-by-900 evidence captures remain ignored in the session tree. The depth
result capture has PNG SHA-256
`7a9d178d183dca460ec52a75142f456bf2529c259ba4b50c16a8bebb393a16a0`
and pixel SHA-256
`87b8d0de2b0b798895562cffac020214bbfed41191200c9fc80c7b0b9488ff15`;
the no-color-screen result has PNG SHA-256
`84d1f6a1b9862699a184c241c219c99690fc84557fafa3924a037b0617cd8b5a`
and pixel SHA-256
`ab72fc1b2370812735fd975335941a97fd4fb30319944b0860453dcd856de44a`;
the disconnected load result has PNG SHA-256
`4572a540d1367a8344b7bae11c89efdbca874ebd1d71420eb356c18ee404480d`
and pixel SHA-256
`9288d7770d27f91a64d3f9522be30a7bc735935d268ff6984c685792189e9449`.

No screenshot is published here. None of those captures shows the Color Editor or
Color Palette, so a listener/error screenshot would be misleading evidence for the
visible application and would not justify an additional copyrighted image. A
representative application capture remains blocked until the licensed subsystem can
be loaded locally and a real Color screen reached; any selected image must then pass
the repository's
[image-specific publication review](screenshot-publication-rights-review.md).

No new CADR runtime was claimed. The standard CADR harness does not expose the
maintained emulator's optional `-a` color-TV launch path, and the pinned System 303
`HACKS` declaration excludes the three source files. A defensible runtime test must
add a provenance-recorded color display path, load the exact files without changing
the public originals, and capture both the ordinary and color clients. Until then,
the CADR sections above are source analysis, not observed output.

## Preservation record

The licensed source and documentation were inspected in place and remain untracked.
Logical or media-relative names are used here instead of host paths.

| Licensed Genera artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `opengenera2.tar.bz2` | 206,213,430 | `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| `Genera-8-5.vlod` | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| `color/color-editor/sysdcl.lisp.~6~` | 3,675 | `aaee69416e5d31227d266f9ce84b0e83b9fcbceded4f5a8ca344434b38d7148c` |
| `color/color-editor/basic-slider.lisp.~25~` | 12,277 | `6d2483159997886f3f2e114bcfe308b96665f82d2cee7661fd48594d92f89eab` |
| `color/color-editor/color-palette.lisp.~56~` | 35,160 | `f38a06dcbcf33c2db658cc0ca2682d3793c7002d788cd991791a8295f07b5811` |
| `color/color-editor/color-editor.lisp.~72~` | 33,236 | `9717a8628f9ed5af6de7b7aac1b4fa021d4df350cc82ac7ba353d045e2070450` |
| `color/color-editor/color-editor.system-dir.~99~` | 2,082 | `2c68fb32430a5c2f1eae3477df93c4714a300e2f68159caea9b1f66ff94b5ed4` |
| `window/colors.lisp.~23~` | 41,944 | `5978600d367b50c87134e4f86ddda6bba2f25471251ee02802b0ac474d9aa5e2` |
| `color/sysdcl.lisp.~115~` | 8,315 | `3d83babdace0a33566a0a3ca26d1b2730b9f5993975198dfc718d071bd9d1d89` |
| `color/common-color.lisp.~621~` | 93,090 | `703e11ecdad7087fe2812c4d352ff7fbb3a0c55533728bb4f5e8c1a507aa93c1` |
| `color/simple-color-hardware.lisp.~174~` | 26,903 | `1b9ff835d8bf6d0d01af465fb7d0da24f845b6c950404572e02fd9f1b7c57031` |
| `color/color.system-dir.~176~` | 3,823 | `63a7a19887fd5bbc68c48697db62c09cf13c12cefadc4fe9a2143f49c675f52e` |
| `color/graphics-toolkit/menu-items.lisp.~225~` | 143,924 | `077dca8895731f6ea2e04a27df97d9efc69e7c014b17b19b5e7c02cdc7327265` |
| `color/graphics-toolkit/database.lisp.~59~` | 25,155 | `d0df4feccdb961a2af717e39815a215ade82544cd160e0a27ab1edee5cf01d85` |
| `color/doc/color-ch7-editing-colors-interactively.sab.~21~` | 32,636 | `b4d3dd1fade92f60035ab28631a3356bbfa18a3d10333dd6b84e7ac3730e4340` |

The chapter is Sage Binary format 7 with 12 records. It was decoded only under the
ignored Help tree using the tracked inert extractor described in
[recovering Genera on-line documentation](genera/online-help-and-documentation-recovery.md).
No decoded vendor prose is linked or committed here.

System 46 source observations use the public repository at commit
`8e978d7d1704096a63edd4386a3b8326a2e584af`:

| Public System 46 artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lmio/color.69` | 20,844 | `7cb1cab3b96a031dc9ba83765b8b5cc285cc9e1e8a528ca828f8680cdb813cc2` |
| `src/lmwin/color.33` | 27,200 | `d9d12f0cb03a1d24b2d35fe80aa9ac20846cfb701b07ab04360606ab80fa782e` |
| `src/lmwin/color.qfasl` | 24,416 | `5ca940ec55dfa2ac03c04b6a9458c054e63363beced30fcb16ff574292238294` |

LM-3 observations use `sys` check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
The audited private source copy recorded public revision
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`
and tree SHA-256
`21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`
at copy and execution start.

| Public LM-3 artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `window/color.lisp.70` | 32,431 | `38e577c94d4ff73e92a48d8368aecb5298f33112bb57421e579168a97b674d62` |
| `demo/colorhack.lisp.8` | 26,219 | `3bac643b508464c3e31e5524982efe0410b3fcea09c2975e3750e0a98166d33c` |
| `demo/colxor.lisp.55` | 13,394 | `839135407e86b10091694ec0cd52d46dcace47aa75fdd974f7514b2e74e05707` |
| `demo/cafe.lisp.9` | 6,064 | `3794600d089d148640c48c95a3bb806bc09188eb3fbbde4f3770d8dc13c1f0a2` |
| `sys/sysdcl.lisp.198` | 20,014 | `dae699d297c2be588adeb1a5ce1f14a197623ca64e963f335a436327280a1255` |
| `sys/sysdcl.lisp.200` | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` |

## Preservation implications

- Preserve an indexed framebuffer together with its active map and map mode. Pixel
  values alone do not preserve displayed colors or map-animation timing.
- Record whether a Genera capture used a dependent or independent map, the segment
  number, overlays, and any map allocation made by the application.
- Treat Genera `IBIN` palette libraries as serialized executable objects. An
  extractor should decode forms inertly, retain names and empty slots, and never
  require loading licensed or untrusted content into a live world.
- Do not reconstruct the Color Palette layout from the disabled source block as if
  it were proven runtime geometry. Capture the definitions actually supplied by the
  paired Paint and Graphics Toolkit versions.
- Keep the CADR experiments separate from the Color Editor in catalogs. A shared
  color map and similar mouse-controlled RGB idea do not establish one program or
  one source lineage.
- Preserve octal notation when transcribing CADR values or translate it explicitly;
  otherwise 16-entry arrays and 255-level components are easily misreported as 20
  and 377 decimal.

## Open questions and runtime TODOs

- Provide the isolated Genera guest with a read-only, provenance-pinned local source
  service sufficient to load `COLOR-EDITOR` 421 and its exact dependencies, without
  exposing the purchased tree or creating a general host file service.
- Determine whether `FIND-COLOR-SCREEN :CREATE-P T` can construct a usable Color
  screen on the Open Genera X client once the system is loaded. The current result
  with `:CREATE-P NIL` proves only that none was registered.
- Capture and review one Color Editor state and one Color Palette state, including
  Model, Config, row, and library menus, then resolve the “last color,” Side Labels,
  YUV, and disabled-layout source/manual discrepancies against runtime 421.
- Extend the CADR harness with the pinned `usim` optional color-TV path and provenance
  for both X clients; manually load the excluded demo files in a fresh private disk.
- Test `CAFE-SLIDE` geometry and termination, `COLORHACK`'s final-slot restore, and
  the exact visible map behavior. Publish only the minimum reviewed screenshots
  needed to support those findings.
- Search earlier Symbolics source history, if lawfully available, for direct reuse
  or attribution between the MIT experiments and the 1983–1984 Color Editor. Until
  such evidence appears, their relationship remains contextual rather than genetic.
- Document the physical monitor, phosphor, transfer, and calibration assumptions
  behind the CADR's nominal eight-bit RGB map values.

## Sources

- MIT CADR System 46,
  [`LMIO; COLOR 69`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/color.69)
  and active
  [`LMWIN; COLOR 33`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/color.33),
  revision `8e978d7`; verified 2026-07-18.
- LM-3 System 303,
  [`WINDOW; COLOR 70`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fcolor.lisp.70),
  [`COLORHACK 8`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fcolorhack.lisp.8),
  [`COLXOR 55`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fcolxor.lisp.55), and
  [`CAFE 9`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fcafe.lisp.9),
  check-in `4df393c`; verified 2026-07-18.
- LM-3 System 303,
  [`HACKS` declaration](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=sys%2Fsysdcl.lisp.200),
  and the maintained `usim`
  [optional color-TV launch path](https://tumbleweed.nu/r/usim/file?ci=330d8248ec2e12af071e287920e681600f75df9f&name=usim.c),
  verified 2026-07-18.
- Symbolics, licensed Open Genera 2.0 / Genera 8.5 media: `COLOR` 427.1,
  `COLOR-EDITOR` 421.0, Graphics Toolkit 23.0, the exact source artifacts in the
  preservation table, and Sage chapter **Editing Colors Interactively**. Inspected
  locally 2026-07-18; no licensed source or decoded chapter is reproduced here.
- Symbolics,
  [X Window System User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_X_Window_System_User_s_Guide.pdf),
  especially the X client's color-support boundary; verified 2026-07-18.
- Museum background:
  [CADR color inks and raster patterns](mit-cadr/color-inks-and-raster-patterns.md),
  [Open Genera worlds and VLOD](genera/world-loads-and-vlod.md), and the
  [Genera computer-use harness](genera/genera-computer-use-harness.md).

Last verified: 2026-07-18.

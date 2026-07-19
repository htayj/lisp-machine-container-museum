---
type: Historical Article
title: The Genera HACKS demonstration suite
description: A source-, descriptor-, manual-, and runtime-bounded guide to all 18 Genera HACKS demonstrations, their visible behavior, controls, implementation, and historical boundaries.
tags: [genera, open-genera, hacks, demonstrations, graphics, sound, preservation]
timestamp: 2026-07-18T12:07:58-04:00
---

# The Genera HACKS demonstration suite

Genera's `Hacks` system is an optional museum-piece collection of small graphical,
interactive, and sound demonstrations. It is not one monolithic application. The
inspected release supplies **18 modern demonstration descriptors**: seventeen wrap
individual programs and the eighteenth, `HACKS`, opens the older all-in-one menu.
The programs range from an abacus and punched-card editor to XOR geometry, cellular
automata, clocks, spline drawing, fractals, and short synthesized sounds.

This page accounts for every descriptor in the release-bounded census. It describes
the Genera versions rather than silently treating the public MIT CADR or maintained
LM-3 implementations as substitutes. The longer cross-generation histories of
[MUNCH](../mit-cadr/munch.md) and
[LEXIPHAGE](../mit-cadr/lexiphage.md) remain in their dedicated articles and are
linked rather than repeated here.

The inspected source and descriptor media establish the complete intended suite,
but the preserved base world cannot currently run it. A fresh isolated session found
no loaded `Hacks` system, no function-bound HACKS entry points, and no loaded
demonstration definitions. Looking up the default descriptor directory reached the
unconfigured-site login path. Consequently, the visible descriptions below are
implementation findings, not claims of observed pixels, except where the runtime
boundary is stated explicitly.

## Evidence and release boundaries

| Evidence | What it establishes | Boundary |
| --- | --- | --- |
| Symbolics *Genera 8.1 Release Notes* | The general demonstration facility, its seven commands, lazy descriptor loading, options, restrictions, and default `SYS:SITE;*.DEMO.NEWEST` search path. | Public manual; pages 88–94. It specifies the facility, not the HACKS implementations. |
| Symbolics *Genera 8.3 Software Installation Guide* | `Hacks` is an optional system containing Genera demos, has no dependency on another loadable system, and is loaded with `Load System Hacks`. | Public manual; UX guide page 28 and 3600 guide page 31. |
| Licensed Open Genera 2.0 / Genera 8.5 media | `HACKS` 440.0, all 18 descriptor revisions, the system declaration, implementation source, fonts, component directory, and release directory. | Exact local media identified in the provenance tables. No licensed source, descriptor text, font, binary, or raw screenshot is tracked by this article. |
| Maintained LM-3 source | Same-named older modules and entry points, including Abacus, the clocks, GEB patterns, Hollerith editor, Munch, Lexiphage, Life, Qix, Rotate, Splines, TV Bug, and Worm. | Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; a maintained restoration tree, not a date for the Genera code. |
| Isolated Open Genera runtime | The system and descriptor registry are absent from the fresh base world; the default site lookup is not usable without site configuration. | Session `d58-hacks-20260718`, generation 1. No HACKS application window was reached. |

The release directory marks 440 as both the released and latest HACKS version. Its
component directory was written on 30 September 1997 in an Open Genera 2.0 / Genera
8.5 environment on a 1280 by 976, eight-bit pseudocolor X screen. That records the
build environment, not a minimum display requirement and not a claim about the
current 24-bit Xvfb transport.

## How the suite is assembled

The system declaration separates two jobs:

1. `demo-definitions` installs the eighteen text descriptors under `SYS:SITE;`.
2. `Hacks` loads shared menu/window definitions, eight bitmap fonts, those
   descriptors, and the implementation modules in parallel.

Every descriptor names `Hacks` as its required system and uses the suite's common
legal-notice function. Referring to an unloaded demonstration first loads only its
small descriptor. The first run then initializes it; initialization asks before
loading any missing required system and loads accepted systems silently without
further queries. Descriptor discovery therefore does **not** prove that the
implementation is resident.

The modern facility exposes this complete command surface:

| Command | Operation and defaults in the inspected implementation |
| --- | --- |
| `Show Demonstration Names` | Lists loaded and unloaded descriptors alphabetically; listed objects are presentation-sensitive. |
| `Run Demonstration name` | Initializes if necessary, shows instructions by default, and uses descriptor defaults unless `Specify Options Yes` is supplied. |
| `Initialize Demonstration name` | Performs required-system loading and the optional initializer; `Force` defaults to No and reruns initialization when Yes. |
| `Show Demonstration Summary name` | Displays the descriptor's short summary. |
| `Show Demonstration Instructions name` | Displays controls and mentions interactive options when the demonstration has them. |
| `Show Demonstration Legal Notice name` | Calls or prints the descriptor's legal notice. |
| `Show Demonstration Background Information name` | Displays the optional historical or explanatory note. |

The 8.1 manual lists `More Processing` and `Output Destination` for `Run
Demonstration`. The inspected later source explicitly suppresses the output-
destination keyword and directly defines only `Show Instructions` and `Specify
Options`. This is a manual/source difference, not silently normalized documentation.

### Restrictions and options

`large-screen-only` means at least 750 pixels wide and 500 pixels high **inside** the
screen. `local-screen-only` rejects a `TV:BASIC-REMOTE-SCREEN`.
`local-terminal-only` rejects a terminal for which `SYS:REMOTE-TERMINAL-P` is true.
These are independent checks.

| Descriptor | Options and descriptor defaults | Restrictions |
| --- | --- | --- |
| `ABACUS` | none | large screen; local terminal |
| `BIRDS` | Slowness = 0; nonnegative integer | large screen; local terminal |
| `CROCK` | none | local terminal |
| `DIGITAL-CROCK` | none | local screen; local terminal |
| `ESCHER` | Slowness = 0; nonnegative integer | large screen; local terminal |
| `GODEL` | Slowness = 2048; nonnegative integer | large screen; local terminal |
| `HACKS` | none | local terminal |
| `HOLLERITH-EDITOR` | none | large screen; local terminal |
| `LEXIPHAGE` | String = `LEXIPHAGE` | large screen; local terminal |
| `LIFE` | none | large screen; local terminal |
| `MUNCHING-SQUARES` | none | local screen; local terminal |
| `MUNCHING-TUNES` | Magic Constant = `#o1001` and Start Point = `#o571565`, both positive integers; Slowness = `#o30000` and Pitch = 3, both nonnegative integers | local screen; local terminal |
| `QIX` | Length = 64; positive integer | local terminal |
| `ROTATE` | none | large screen; local terminal |
| `SPLINES` | none | local terminal |
| `TV-BUG` | Slowness = 10000, a nonnegative integer; Window = selected window or a `TV:SHEET` | local terminal |
| `WORM` | none | local terminal |
| `ZOWIE` | none | local screen; local terminal |

`Slowness` is a count for a busy loop, not calibrated wall-clock time. Several
implementation files use octal reader bases; values shown with `#o` above preserve
the descriptor's radix explicitly. The Munching Tunes defaults are 513, 193397, and
12288 in decimal.

### Display, font, raster, and sound substrates

The demonstrations do not all draw in the same way:

- Abacus uses the `ABACUS` bitmap font for bead states.
- Munching Squares uses `TOG` switch glyphs and `43VXMS` for its large numeric
  value; Lexiphage also uses `43VXMS`.
- Worm uses the purpose-built `WORM` font as four kinds of paint spot.
- Crock selects `OENG50`, `OENG25`, or the normal TV font according to radius.
- Digital Crock builds seven-stroke digits in raster arrays rather than loading a
  digit font.
- TV Bug embeds four 32 by 32 one-bit animation frames directly in its source.
- Birds, Escher, Godel, Qix, Rotate, Splines, and Life use drawing or BitBlt
  primitives.
- Munching Tunes and Zowie use the Lisp-machine beep/music facilities and do not
  require a visible animation.

The full recovered Genera font inventory and evidence boundary are documented in
the [font catalog](font-catalog.md). Those licensed fonts and all recovered glyph
products remain ignored local artifacts.

## ABACUS

`ABACUS` runs `HACKS:ABACUS-DEMO`. It opens a two-pane frame: a large graphical
ten-column abacus and a small listener-like command pane. Each decimal digit is
represented by one upper five-bead decision and one lower zero-through-four bead
position. The window object is retained and reused on later invocations.

### Complete controls

| Input | Effect |
| --- | --- |
| decimal integer, then Space or Return | Replace the displayed value. The first character must be a digit. |
| `+` followed by an integer | Add it, moving changed digits in sequence. |
| `-` followed by an integer | Subtract it, moving changed digits in sequence. |
| `=` | Print the current value in the command pane. |
| Mouse-Left on a bead | Set that decimal digit to the bead position clicked. |
| `End` | Deselect the frame and complete the descriptor run. |
| unsupported key or a click outside a valid bead | Beep; leave the value unchanged. |

**Implementation findings beyond the descriptor:** values wrap modulo
10,000,000,000, and negative results are normalized into that ten-digit range. The
mouse-bead editor is implemented but omitted from the modern instructions.
Addition and subtraction animate one changed decimal position at a time rather than
simply redrawing the final value.

The maintained LM-3 tree has the same `ABACUS-DEMO` entry family; Genera adds the
modern descriptor and retains the older `DEFDEMO` registration for the HACKS menu.
No current runtime image is claimed because neither entry point was resident.

## BIRDS

`BIRDS` calls `HACKS:BIRDS-DEMO` with a nonnegative Slowness value. It does not draw
literal bird artwork. Each frame XORs two triangles that share two vertices. Four
moving points advance at fixed rates in a 513-pixel square, with modular coordinates
folded around the midpoint to produce billiard-like reflections.

The series contains five rate pairs for the third point—`(2,3)`, `(3,4)`,
`(16,24)`, `(128,192)`, and `(255,257)`—while the fourth point swaps each pair.
The two shared points use `(1,1)` and `(2,2)`. A presentation ends at its repeat
point; the series then waits before continuing.

### Complete controls

| State | Input | Effect |
| --- | --- | --- |
| animation running | Space | Pause; Space again resumes. |
| animation running | any ordinary key other than End or Rubout | Source behavior is the same pause-and-wait path as Space; a second ordinary key resumes. |
| animation running or paused | `Rubout` | Abandon this rate set and advance to the next. |
| animation running or paused | `End` | Exit the complete Birds series. |
| completed presentation | Space, Rubout, or another non-End key | Continue to the next presentation. |
| completed presentation | `End` | Exit. |

The broader “any ordinary key” pause behavior is source-visible and is not stated in
the descriptor. Slowness adds busy work between frames. This implementation remains
in the same GEB program family found in the maintained LM-3 source, but the five-
presentation Genera descriptor defaults and current source are the release boundary
for this section.

## CROCK

`CROCK` runs `HACKS:CROCK-DEMO`, an analog wall clock in a reusable square window.
It draws a circular face with numerals 1 through 12, a thin second hand, and two
filled irregular hand outlines. The hour hand is quantized to quarter hours, the
minute hand to half minutes, and the second hand to seconds. Resizing recomputes the
radius, hand scale, and numeral font.

The clock is also a chimer. At each half hour it plays a short lead-in and one bong;
at an exact hour it plays the lead-in and bongs the displayed hour count. This audio
behavior is in the implementation but absent from the descriptor summary.

### Complete controls

| Input | Effect |
| --- | --- |
| `End` | Documented way to finish and bury the clock. |
| any other character | The wrapper waits for one character without checking which character it is, so it also finishes and buries the clock. |
| window resize | Refit the face and select a large, medium, or normal numeral font. |

The demo buries rather than destroys its cached window. The maintained LM-3 source
contains the same clock and `CROCK-DEMO` family; this article does not infer that its
timing or audio device behavior is identical to Open Genera.

## DIGITAL-CROCK

`DIGITAL-CROCK` runs `HACKS:DC-DEMO`. A centered window shows `HH:MM:SS` using seven
geometric strokes per digit and two fixed colons. The first hour digit is blank for
single-digit hours. Unlike the analog face, the digit producer uses the hour returned
by `TIME:GET-TIME` directly, so the source describes a 24-hour display.

Each update renders the old and new glyphs into temporary rasters, XORs them to
obtain only the changed strokes, applies that delta to a retained image, and copies
the result to the screen. This is a small demonstration of incremental raster
updating as much as a clock.

### Complete controls

| Input | Effect |
| --- | --- |
| `End` | Documented exit; buries the digital-clock window. |
| any other character | Also exits, because the wrapper accepts one character without discriminating it. |

When `CROCK`'s `PLAY-TIME` function is present—as it is after a complete HACKS
load—the digital clock conditionally invokes the same half-hour/hour chime. Its
hourly bong count is the hour modulo 12, so noon and midnight reach zero explicit
bongs after the lead-in in the inspected source. That edge behavior still needs a
runtime confirmation.

The descriptor's local-screen restriction is stricter than Crock's. No reason is
invented for it. The implementation descends through the same `DC` program family
present in maintained LM-3 source.

## ESCHER

`ESCHER` calls `HACKS:ESCHER-DEMO`. Two reflected points define a line segment; the
program XORs that line and three mirror images, giving fourfold symmetry. As the
endpoints advance and reflect, drawing the same pixel twice erases it, so changing
lace-like line fields emerge without a retained scene model.

The five presentations use endpoint velocity pairs
`(2,1)/(4,3)`, `(0,1)/(3,2)`, `(1,2)/(2,3)`, `(0,2)/(1,3)`, and
`(0,1)/(2,3)`. Each ends when its complete coordinate state returns to a repeat
corner.

### Complete controls

| State | Input | Effect |
| --- | --- | --- |
| animation running | Space | Pause; Space again resumes. |
| animation running | another ordinary key | The source takes the same pause path; a second ordinary key resumes. |
| running or paused | `Rubout` | Skip the current velocity pair. |
| running or paused | `End` | Exit the series. |
| completed presentation | any non-End key | Continue to the next pair. |
| completed presentation | `End` | Exit. |

Slowness is a per-frame busy-loop count. “Escher” is the program's established name;
the inspected evidence does not assert a specific M. C. Escher work as its source.
The GEB module and old HACKS registration have maintained LM-3 counterparts; the
modern five-entry wrapper is Genera evidence.

## GODEL

`GODEL` exposes the single-line motion underlying Escher. It XORs one segment between
two independently moving, reflected endpoints, with no fourfold copies. The result
lets a viewer distinguish the trajectory generator from Escher's symmetry layer.

The media filename is `GOEDEL.DEMO`, but the descriptor symbol, displayed name, and
implementation functions use `GODEL`. The spelling difference is preserved rather
than “corrected.” Slowness defaults to 2048 busy-loop iterations.

### Complete menu and controls

Mouse-Left chooses one of these six exact velocity pairs: `(0,1)/(1,0)`,
`(1,2)/(2,3)`, `(0,1)/(3,2)`, `(2,1)/(4,3)`, `(0,2)/(1,3)`, or
`(0,1)/(2,3)`. The seventh menu item exits and is the default.

| State | Input | Effect |
| --- | --- | --- |
| menu | Mouse-Left on a pair | Run that pair. |
| menu | Mouse-Left on Exit | Exit; Exit is also the menu's declared default. |
| display running | Space | Pause; Space again resumes. |
| display running | another ordinary key | The implementation follows the same pause-and-wait path. |
| running or paused | `Rubout` | Return to the pair menu. |
| running or paused | `End` | Exit the complete Godel demo. |
| completed display | any non-End key | Return to the menu. |
| completed display | `End` | Exit. |

The same GEB functions and velocity menu exist in the maintained LM-3 family. No
runtime screen was available in the current world.

## HACKS

`HACKS` is the compatibility entry point `HACKS:DEMO`, not another visual algorithm.
It opens the older mouse menu built by active `DEFDEMO` forms. The modern descriptor
itself warns that this path is less instructive than running the individual
descriptors.

The inspected build registers these seventeen top-level entries, sorted
alphabetically at display time:

| Old-menu entry | Modern descriptor relationship |
| --- | --- |
| Abacus | `ABACUS` |
| Birds (xor'ing triangles) | `BIRDS` |
| Crock | `CROCK` |
| Digital Crock | `DIGITAL-CROCK` |
| Escher (xor'ing lines) | `ESCHER` |
| Godel (Insides of Escher) | `GODEL`; opens the six-choice submenu |
| Multiple Hollerith Editor | `HOLLERITH-EDITOR` |
| Lexiphage | `LEXIPHAGE` |
| Life | `LIFE` |
| Munching Squares | `MUNCHING-SQUARES` |
| Munching Tunes | `MUNCHING-TUNES`; old interface offers Beginning and Interesting submenu choices |
| QIX | `QIX` |
| Rotate | `ROTATE` |
| Splines | `SPLINES` |
| TV bug | `TV-BUG` |
| Worm | `WORM` |
| Zowie | `ZOWIE` |

### Complete umbrella controls

| Input/state | Effect |
| --- | --- |
| Mouse-Left on an item | Evaluate that entry or open its submenu. |
| Move the pointer off a menu without choosing | Dismiss that menu; dismissing the master menu exits `HACKS`. |
| error or Abort inside a child demo | The wrapper offers a restart back to the HACKS menu. |
| child waiting for a character | Its own End/Abort behavior applies. |
| child not accepting input | Control-Abort is the legacy escape described by the modern wrapper. |

The old chooser removes four entries on a remote screen and eight on a small screen,
using prefix matching so names with parenthetical suffixes still match. Several
obsolete `DEFDEMO` forms remain inside comments—single-card Hollerith Editor, Atan,
Live Bounce, Dance, Green Hornet, and Circles—but comments do not populate the live
menu. Counting source-like text without respecting those comments would overstate
the application surface.

## HOLLERITH-EDITOR

`HOLLERITH-EDITOR` calls `HACKS:EDIT-MULTIPLE-CARDS`. It draws an 80-column card
marked as an IBM 5081, prints the entered characters across its top, and places
rectangular holes in the appropriate row positions. After each nonblank card it
shifts the previous screen image five pixels left and twenty pixels upward, then
draws the next card, producing a visible stack.

### Complete controls and accepted input

| Input | Effect |
| --- | --- |
| supported graphic character | Uppercase it, append it to the current card, print it, and draw its punches. |
| `Rubout` | Remove the most recent character and reconstruct the labels revealed by erased holes; beep if the card is empty. |
| `Clear` | Erase all characters and holes on the current card. |
| Return or `End` | Finish the current card. If it is blank, exit the complete demonstration. |
| unsupported character or a character after column 80 | Beep and leave the current card unchanged. |

The exact repertoire is space, `A`–`Z`, `0`–`9`, and the punctuation encoded by the
source table: period, right parenthesis, right bracket, less-than, underscore, plus,
exclamation, dollar, asterisk, left bracket, greater-than, ampersand, minus, slash,
apostrophe, left parenthesis, quotation mark, number sign, percent, equals, at sign,
circumflex, comma, backslash, and semicolon. Lowercase letters are accepted but
stored as uppercase.

The “full rubout capability” is literal implementation behavior: unlike a physical
punched card, the on-screen card can unpunch its latest column or clear the whole
card. The function also accumulates all completed cards into a newline-separated
string, although the demonstration runner ignores that return value. The modern
descriptor maps to the **Multiple** Hollerith Editor; the single-card old
registration is commented out. Maintained LM-3 source contains the same editor
family.

## LEXIPHAGE

`LEXIPHAGE` calls `HACKS:LEXIPHAGE` with a String option whose default is its own
name. It centers that text in a short window using `43VXMS`, pauses briefly, and
moves a triangular upper jaw, lower jaw, and teeth from left to right. Alternating
jaw depth creates a chewing motion, while erase triangles remove both the preceding
mouth image and the text it has crossed.

There are no ordinary controls and no input poll. Once started, it runs to completion;
an external Abort is the only early interruption path. The descriptor attributes the
idea to John Doty. The implementation returns a small completion value that the
demonstration facility does not display specially.

The System 46 scan-line version, maintained LM-3 triangle version, Genera relationship,
PDP-10 antecedent, geometry, and attribution evidence are treated in
[LEXIPHAGE: a word-eating display hack](../mit-cadr/lexiphage.md). This page adds only
the Genera descriptor default, restriction, and exact local implementation boundary.

## LIFE

`LIFE` runs `HACKS:RUN-LIFE`, Conway's cellular automaton in a reusable 128 by 128
HOF window. The wrapper clears the window and draws one horizontal line through its
vertical midpoint as the seed. Each computed generation is copied back to the
window, and its zero-based generation counter is written at the home cursor.

The implementation represents the eight-neighbor count as three one-bit planes and
two carry rasters. A sequence of BitBlts adds each shifted neighbor image, then keeps
cells with three neighbors or live cells with two, while rejecting the four-or-more
plane. The source comments describe 65 BitBlts per generation and a later revision
that accepts either windows or raster arrays, accepts a generation limit, and handles
multi-bit screens.

### Complete controls

| Input | Effect |
| --- | --- |
| `End` | Documented exit. |
| any character | Actual implementation check; any pending character ends the generation loop. |

The entry defaults to at most 100,000 generations, although user input normally ends
it first. The descriptor says Clark Baker translated the program from Smalltalk and
identifies an August 1981 *Byte* appearance; the source header dates the local program
to November 1981 and records later modification. Those statements establish the
declared lineage, not that every later line is a direct magazine transcription.

## MUNCHING-SQUARES

`MUNCHING-SQUARES` runs `HACKS:MUNCH` with its implementation default of `#o401`
(257 decimal). It displays the current 16-bit parameter, a 16-switch register, a
256 by 256 raster, and an on-screen help pane. The accumulator repeatedly adds the
parameter modulo 65536; the low byte is X and low-byte XOR high-byte is Y; the pixel
at that location is toggled.

### Complete Genera controls

| Input | Effect |
| --- | --- |
| Mouse click on a switch | Toggle that bit; the rightmost switch is the least-significant bit. |
| `Tab`, `Q`, `W`, `E`, `R`, `T`, `Y`, `U`, `I`, `O`, `P`, `(`, `)`, Backspace, Page, Complete | Toggle the corresponding switch positions from high to low across the 3600-style row. |
| octal digit `0`–`7` | Shift the parameter left three bits and append that digit. |
| Clear Input | Set the parameter to zero. |
| `+` or Space | Increment it. |
| `-` | Decrement it. |
| `<` or `~` | Shift left, appending zero. |
| `=` | Shift left, appending one. |
| `>` | Shift right. |
| `N` | Select the next higher 16-bit number having the same count of one bits. |
| Clear Screen | Clear and restart the drawing without changing the parameter. |
| Square | Pause drawing. |
| Resume | Resume drawing. |
| `End` | Exit. |

Every numeric change is masked back to 16 bits, clears the raster, resets the
accumulator, and updates both the octal number and switch panes. Mouse-generated
switch values enter the same keyboard queue as keys.

The PDP-1 origin, HAKMEM relationship, System 46 implementation, LM-3 evolution,
switch-register design, and source links are documented in
[MUNCH and Munching Squares](../mit-cadr/munch.md). The dedicated article should be
used for that history; this section fixes the Genera key row and windowed defaults.

## MUNCHING-TUNES

`MUNCHING-TUNES` feeds the arithmetic skeleton of Munching Squares into the beep
facility instead of plotting pixels. It advances a modular accumulator by the magic
constant, XORs the lower and upper portions to obtain a frequency value, shifts that
value by Pitch, and emits one beep whose duration is Slowness.

| Option | Default | Implementation role |
| --- | ---: | --- |
| Magic Constant | `#o1001` (513) | Increment added to the accumulator. |
| Start Point | `#o571565` (193397) | Initial position; chosen by the descriptor as an interesting part of the sequence. |
| Slowness | `#o30000` (12288) | Duration argument to the beep primitive. |
| Pitch | 3 | Left-shift applied to the derived frequency. |

### Complete controls

| Input | Effect |
| --- | --- |
| `End` | Documented stop. |
| any character | Actual loop condition; any pending character stops and returns the current accumulator. |

The old HACKS menu exposes two fixed presets, beginning and interesting, while the
modern descriptor exposes all four values. There is no graphical output. The reason
for retaining a local-screen restriction on this audio-only entry is not established
by the inspected source and remains unguessed.

## QIX

`QIX` calls `HACKS:QIX` with a Length default of 64. Two independently wandering
endpoints define one XOR line. Each endpoint's X and Y velocity performs a bounded
random walk and reflects at the window edges. A circular history erases the line
that is Length steps old, producing a moving cluster rather than an indefinitely
filled screen.

### Complete controls

| Input | Effect |
| --- | --- |
| `End` | Documented exit. |
| any character | Actual source condition; stops the animation. The cleanup loop XOR-erases the retained trail. |

The Length option controls trail persistence, not segment length. Its Common Lisp
type is `(INTEGER (0))`: the parenthesized lower bound is exclusive, so zero is
correctly rejected before the circular-list constructor is called.

No relationship to the arcade game's rules is inferred from the name. Maintained
LM-3 source contains an older Qix implementation in the same function family; this
section is bounded to the Genera descriptor and source.

## ROTATE

`ROTATE` runs `HACKS:RUN-ROTATE`. It first draws a radial fan from the upper-left
corner and places a large italic `Symbolics` label near the center. On request it
copies a fixed 512 by 512 region into a temporary one-bit raster and rotates that
raster clockwise in place.

The algorithm repeatedly halves a quadrant mask. Each of the nine levels for a
512-pixel image performs fifteen BitBlts and redisplays the intermediate raster. The
descriptor states the general count as `2 + 15*log2(N)`, or 137 BitBlts for 512,
and records about five seconds on its historical target. That timing is not applied
to the current VLM.

### Complete controls

| Input | Effect |
| --- | --- |
| Space | Rotate clockwise once, then wait again. |
| any other character except End | Source behavior also initiates one rotation; Space is the documented convention, not an enforced key. |
| `End` | Exit. |

The underlying function requires a square power-of-two raster, while this wrapper
always chooses 512. The descriptor and source attribute the algorithm to a Smalltalk
program published in the August 1981 *Byte* and record a November 1981 local creation
date plus a January 1982 installation change. Maintained LM-3 source preserves the
same `RUN-ROTATE` family.

## SPLINES

`SPLINES` runs `HACKS:SPLINES-IN-WINDOW`, selecting a reusable drawing window inset
slightly from the screen edges. It gathers pointer-selected control points and calls
the window's cubic-spline primitive either in relaxed open mode or cyclic closed
mode. Control-point dots are removed before the curve is drawn; completed curves
remain, so multiple independent curves accumulate until exit.

### Complete controls

| Input | Effect |
| --- | --- |
| Mouse-Left | Add a control point and draw a small XOR marker. A consecutive duplicate is ignored. |
| Mouse-Middle | Finish the current point set and draw a relaxed open cubic spline. |
| Mouse-Right | Finish the point set, append the first point again, and draw a cyclic closed cubic spline. |
| Middle or Right with fewer than two distinct points | Beep; draw no curve. |
| `End` | Exit when the point collector observes the pending key. |
| another character | Beep and start another collection cycle. |
| Control-Abort | Descriptor-documented unconditional escape through the surrounding command machinery. |

The on-screen mouse documentation includes `End`, although the modern prose
instructions emphasize Control-Abort. The default line width is four pixels and the
spline precision is 20 samples per segment. The duplicate-point test exists because
the historical spline method could divide by zero on identical successive points.
This source-level limitation is not visible in the descriptor.

Maintained LM-3 source contains the same Splines window and relaxed/cyclic choice.
No live Genera spline was reached in the current world.

## TV-BUG

`TV-BUG` calls `HACKS:TVBUG`. It starts a 32 by 32 creature near the bottom center of
the chosen sheet and advances it upward one pixel per animation phase. Four embedded
one-bit frames provide the walking poses. The implementation precomputes XOR
first-difference rasters that both move and change the creature without redrawing
the entire window.

| Option | Default | Meaning |
| --- | --- | --- |
| Slowness | 10000 | Busy-loop delay between phases. |
| Window | selected window | A `TV:SHEET`, or the special selected-window token, which the descriptor maps to the terminal I/O stream. |

### Complete controls

| Input/state | Effect |
| --- | --- |
| `End` | Documented stop. |
| any character | Actual polling condition; terminates and XOR-erases the remaining creature. |
| creature reaches the top | Ends automatically and erases the final frame. |

The four embedded rasters are meaningful visual assets, not a font file. They remain
inside licensed source and are neither extracted nor tracked here. Maintained LM-3
source has the same TV Bug family, but its historical default delay differs; the
modern descriptor's 10000 is the Genera default.

## WORM

`WORM` draws layered fractal paths attributed by the descriptor to Gosper and
Holloway. It first runs a large glyph along a recursive terdragon path to find and
paint an initial surface. It then presets six cooperative stack groups at staggered
positions. Their `WORM`-font glyphs use different raster operations—paint, erase,
XOR, and combinations—so successive paths carve stripes, gray regions, and black
regions into that surface.

The descriptor exposes no options, but the implementation entry defaults to bit
selector 0, recursion order 7, and an octal-coordinate starting point. Generation
labels and numeric command prefixes use **base 9**, a source-visible fact not stated
in the descriptor prose.

### Complete controls

| Input | Effect |
| --- | --- |
| `P` | Run continuously until any character is typed; the stopping character is consumed. |
| base-9 `n` then `R` | Run until generation `n`. |
| base-9 `n` then `N` | Run the next `n` generations. |
| base-9 `n` then `S` | Run to the next boundary for recursion order `n`, computed in powers of three. |
| `End` | Signal the demo's exit restart and close the window. |

Digits `0` through `8` accumulate a prefix. The command reminder remains visible in
the window and the title shows the current generation in base 9. The six walkers are
coroutines implemented as stack groups, not independent host threads. Maintained
LM-3 source preserves the same Worm/terdragon family; exact pixel results still need
a Genera runtime capture.

## ZOWIE

`ZOWIE` is a short sound-only demonstration. It sends a fixed compact note-and-tempo
string to `HACKS:PLAY-STRING`; that interpreter maps keyboard-like note letters to an
equal-tempered scale, treats repeated letters as longer notes, and recognizes rests
and tempo changes. Zowie resets the common speed first, changes it within the phrase,
and returns when the fixed sequence is exhausted.

There are no ordinary controls and the phrase does not poll for input. The descriptor
says only to listen and describes the effect as the sound of a presidential hotline
in the “Flint” movies. This article preserves that descriptor attribution without
guessing a specific film, recording, or musical quotation.

The local-screen and local-terminal restrictions are both present even though the
entry produces no designed visual state. Their historical rationale is unknown. A
meaningful runtime test must establish whether the identified VLM exposes audible
beeps; a screenshot would not document this program's substantive output.

## Findings not evident from the descriptor prose

Several suite-wide conclusions come from implementation inspection rather than the
manual summaries:

- many programs document `End` or Space but actually treat **any** character as
  stop, continue, rotate, or pause input;
- Abacus has a complete mouse bead editor and ten-digit modular arithmetic;
- both clocks can chime, and the digital clock uses incremental stroke deltas;
- the legacy HACKS menu contains exactly the seventeen individual programs, while
  several tempting `DEFDEMO` strings survive only inside comments;
- Godel uses one moving XOR segment, while Escher adds fourfold reflection and Birds
  adds two shared-base triangles;
- Munching Tunes and Zowie have no intended visible animation despite local-screen
  restrictions;
- Splines accepts `End`, ignores consecutive duplicate points, and accumulates
  completed curves;
- TV Bug stores four animation frames as source rasters rather than a font; and
- Worm's visible generation and numeric command language are base 9.

These findings are release-bounded. They do not establish that a site patch, a
different HACKS release, or a physical Symbolics console behaved identically.

## Runtime observation and screenshot status

Session `d58-hacks-20260718`, generation 1, started at
`2026-07-18T11:54:37-04:00` on a private 1200 by 900 X client. The Listener reported
an `X-SCREEN::X-REAL-SCREEN` with 1200 by 852 usable pixels and
`SYS:REMOTE-TERMINAL-P = NIL`. A read-only probe then established:

- package `HACKS` existed, but `SCT:GET-SYSTEM-VERSION "Hacks"` returned `NIL`;
- `SCT:FIND-SYSTEM-NAMED` found no loaded HACKS system;
- `HACKS:DEMO`, `ABACUS-DEMO`, `CROCK-DEMO`, `MUNCH`, `QIX`, `WORM`, and `ZOWIE`
  had no symbols or function bindings in that package;
- the loaded-demonstration hash table contained zero entries; and
- querying `SYS:SITE;*.DEMO.NEWEST` reached the world's `Please login` prompt because
  the world was not configured for a local site and the sandbox exposes no file
  service.

The first raw evidence capture is 1200 by 900 pixels, PNG SHA-256
`9a34c290a4692c1797ba95df7a6c53369098171b83f5ddb5cbf9db8238db19b2`, pixel SHA-256
`1127907f205c8663a2f8f1e09a290e967020a8b0f7e7d8475fecdf8dc1a268ae`, after action
log count 2 and action-log hash
`e892f6ba4ae0b79481c449401212c0c6ca8712f68394d9dae4eb6fa14af3f550`.
It is retained only in the ignored session tree.

No screenshot is published on this page. The captures show a generic Dynamic Lisp
Listener and a site-login prompt, not one of the programs documented here; publishing
one would be decorative rather than evidence of HACKS behavior. The exact blocker is
the absent loadable system plus inaccessible `SYS:SITE` descriptor path. A future
capture requires a disposable, isolated, rights-compatible way to expose the exact
licensed HACKS media to the guest, followed by an image-specific review under the
[screenshot publication policy](../screenshot-publication-rights-review.md).

Shutdown reached the VLM prompt, sent and accepted confirmation, and observed cleanup
progress, then encountered the known cleanup stall and required bounded force. The
final record is `forced-stopped`, `state_may_be_incomplete = true`, and not orderly.
The base and private worlds were unchanged. `save_world_performed` and
`guest_checkpoint_created` remain unknown; the harness created no host checkpoint.

## Open questions and next runtime work

- Load HACKS 440 into a fresh private world through a minimal read-only media path
  without turning the harness into a configured Symbolics site.
- Recheck the `local-screen-only` predicate on the actual X real screen once a
  descriptor is loaded; screen type alone is not the predicate result.
- Exercise the digital clock's noon/midnight chime edge instead of resolving it from
  code inspection alone.
- Confirm whether all “any character” exits behave as the source indicates through
  the current X key translation.
- Capture only representative states needed for analysis—for example Abacus mouse
  editing, one Escher/Godel comparison, a Hollerith card, Munch controls, Splines,
  TV Bug, and Worm—rather than a decorative gallery.
- Test the two sound-only entries with an auditable audio path; screenshots cannot
  prove that Munching Tunes or Zowie was heard.

## Local artifact provenance

Paths below use Genera logical names so the record is portable. The byte counts and
hashes identify the licensed local inputs without publishing them.

### Demonstration descriptors

| Logical file and revision | Bytes | SHA-256 |
| --- | ---: | --- |
| `SYS:SITE;ABACUS.DEMO.11` | 3,705 | `a59dc581ce9e8771f634c1a1224b925eac41dd90fd5f19b3b080143fc82085e7` |
| `SYS:SITE;BIRDS.DEMO.9` | 3,933 | `39ef02cb45d469886e1aca7a301eeb7dfd541c88dd7b66601ca52752810fe96f` |
| `SYS:SITE;CROCK.DEMO.9` | 3,218 | `a0c479587b9aa497880e91f29139227505ea7e1c54b2bc7ef638e8c70726204c` |
| `SYS:SITE;DIGITAL-CROCK.DEMO.9` | 3,253 | `64d785c127a58676b0f041e063bb51f452611c952afca907c38e1ef4ba7f3056` |
| `SYS:SITE;ESCHER.DEMO.11` | 3,961 | `b4c5c5aec3d18e600840d4fde369338367eb495ff6871b720adc78bedf903811` |
| `SYS:SITE;GOEDEL.DEMO.15` | 4,991 | `2409a2916051965dd076c3fd66e64605690e4f0be949e56e1b62a98ffeca0357` |
| `SYS:SITE;HACKS.DEMO.2` | 4,268 | `b8652be365c1be3da8fdfb08385c33aff561fdc34e7abdc5414ae9321eb7dc20` |
| `SYS:SITE;HOLLERITH-EDITOR.DEMO.8` | 3,390 | `fa8f3415a3c224912876d075163e07f3d741611cb320f2f46cf5be45a78f3ad5` |
| `SYS:SITE;LEXIPHAGE.DEMO.10` | 3,399 | `919e5ee73c89a0905e8139ebe846b89bf1915f68e7ea1adf97f62403e8520c60` |
| `SYS:SITE;LIFE.DEMO.9` | 3,922 | `e24be63bb6c9df41893de8737c26ad4278a4d381027cb4cbcdd43d232c3951bb` |
| `SYS:SITE;MUNCHING-SQUARES.DEMO.9` | 3,627 | `03129976aee043b47f4c08e2c5a6af5af6334115a12986a8527aeb1a7c10940d` |
| `SYS:SITE;MUNCHING-TUNES.DEMO.8` | 3,503 | `600e334768d561f11ecf650aaa2e214eab9840b9a7599cc56d3cc4becaa5172f` |
| `SYS:SITE;QIX.DEMO.14` | 3,295 | `b039e778a64df05873f5a4399ee84b3b605904dbfd608d2c205a95f23b4784c6` |
| `SYS:SITE;ROTATE.DEMO.9` | 3,824 | `251d4783a9dcd2648b9bd6c5d230d1b070562fcf23e2565ad46102be1bfe5e83` |
| `SYS:SITE;SPLINES.DEMO.7` | 3,994 | `c3e8f06bd7ccbd0db6c6ffb6793f5639f055b23f854171a2b8bf30f1f78eb561` |
| `SYS:SITE;TV-BUG.DEMO.10` | 3,423 | `a1e187c2061a18c43fa56f9520a50b8d8c7171b32d703e22e3022da44adcdc5f` |
| `SYS:SITE;WORM.DEMO.10` | 3,636 | `3bc542394ac4dd965b19c2a8b88404abce6e84f2a7129da717c5665a6d4beba9` |
| `SYS:SITE;ZOWIE.DEMO.9` | 3,432 | `10deb352ffd0287ba2e8fb06d121437c659d62626fc04bbd74d2bf0eac9916c1` |

### Implementation and registry source

| Logical file and revision | Programs covered | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `SYS:DEMO;HAKDEF.4015` | old menu, HOF windows, filtering, legal notice | 9,153 | `18a2f67d2445b332710f758ea87bd27622125f86502492020f2f07a6321cf31b` |
| `SYS:DEMO;ABACUS.4011` | Abacus | 11,928 | `2faf43112722ccc26e1d3be339887e3f75559c95797118e6917f4d8286ff52b9` |
| `SYS:DEMO;CROCK.4010` | Crock and shared chime | 12,133 | `e4040853a25781de8ce92b29552ecbdc93372b7084ff638aaeb06de7704b919c` |
| `SYS:DEMO;DC.4006` | Digital Crock | 11,332 | `caee0231af72cc4cb4ee0c057ad46f34470da6f3a337df8eeb92add060088fdb` |
| `SYS:DEMO;DLWHAK.4014` | Splines and TV Bug | 17,117 | `695c46c41a3ffb452da43e6ce51c106ba77d8331e6928c3e36e56e7c76ab49e9` |
| `SYS:DEMO;GEB.4008` | Birds, Escher, and Godel | 17,885 | `7d8cd369ddaf877ad34069da3475a37c62eb83ea0560ad630bcc401dad3ff894` |
| `SYS:DEMO;HCEDIT.4011` | Hollerith Editor | 12,687 | `1fb43a7c57bcf8d87ab873c42eac5371d8595a1571dffa219bd0dccefd377bb4` |
| `SYS:DEMO;MUNCH.4010` | Munching Squares | 15,724 | `f81fb365c3357a2c72e95e5af4c01694c499d1e0abc618c71d6e0603aa67610e` |
| `SYS:DEMO;OHACKS.4009` | Lexiphage, Munching Tunes, and Zowie | 22,527 | `2a3a5e8dd5ea25c29647864aaa2a7bbbdc7de09f63dbcbc348590e0870c69cc1` |
| `SYS:DEMO;ORGAN.4005` | common note-string interpreter used by Zowie and Crock | 11,383 | `f3b8009656c9c49d2f1aa775b5d0321baf7d9f31c76e44f51bc5a9afad92f8c1` |
| `SYS:DEMO;QIX.4003` | Qix | 5,400 | `5c1271b899c5bf69d020d0591db9afec40f2cf77d8ed0651346e3919eb95b9a4` |
| `SYS:DEMO;ROTATE.4013` | Rotate and Life | 10,421 | `c9728943972e91e78aec4d7fc738584e696a393571554371650c0572812e7d22` |
| `SYS:DEMO;WORM.4011` | Worm | 7,836 | `5a413f5d44de44760d97c2053bbf0984059ffab8c3c0bc409a8c2e9d79b0724b` |
| `SYS:DEMO;SYSDCL.26` | system and descriptor declarations | 4,254 | `e8ea9055cb97f18912094bbc7adc325cc02ad76441d8883b05f940ef58f56432` |
| `SYS:DEMO;PATCH;HACKS.SYSTEM-DIR.143` | released/latest HACKS version map | 6,273 | `840f359083ba0965742fbd95a94e19ddaf48452e2551b26d4d8b42379874be87` |
| `SYS:DEMO;PATCH;HACKS-440.COMPONENT-DIR.2` | exact HACKS 440 component revisions | 3,860 | `bdbe471c65d60e954a0db316ab652fc45d754c2845780db095c55ab2a5653d74` |
| `SYS:SYS2;DEMONSTRATION.5` | general descriptor and command facility | 20,358 | `bad25944a17e5af64a0875a4a00d51be9e99af2dde3cb6f10aa5b2ce874b8057` |

The runtime used the 54,804,480-byte base VLOD with SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`,
the VLM executable with SHA-256
`9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`,
and the debugger with SHA-256
`2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`.
See the [Genera harness article](genera-computer-use-harness.md) for the sandbox,
preload, time-responder, and shutdown evidence model.

## Sources

- Symbolics, [*Genera 8.1 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.1_Release_Notes.pdf),
  pages 88–94, demonstration facility; verified 2026-07-18. Local PDF:
  1,020,591 bytes, SHA-256
  `4b26763c71ada2ddd3dc4019e83f70df9ff242857a99e5d5326ca68f0be23225`.
- Symbolics, [*Genera 8.3 Software Installation Guide for UX Family Machines*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_UX_Family_Machines.pdf),
  page 28, Hacks installation; verified 2026-07-18. Local PDF: 498,160 bytes,
  SHA-256
  `f8c09d757e08c65094676b76f5ad8d2e95d4b1309962c60cf26d463e57c2a126`.
- Symbolics, [*Genera 8.3 Software Installation Guide for 3600 Family Machines*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_3600_Family_Machines.pdf),
  page 31, corroborating Hacks installation; verified 2026-07-18. Local PDF:
  543,814 bytes, SHA-256
  `e30becd77fcf4e1491c1377cbed452eaaaf05efa4965843e72f5b06108b46551`.
- LM-3, [`HACKS` system declaration](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  and the maintained [`demo` source tree](https://tumbleweed.nu/r/lm-3/dir?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=demo),
  check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`;
  verified 2026-07-18.
- MIT CADR System 46, [`LMIO1; HACKS 189`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189),
  commit `8e978d7d1704096a63edd4386a3b8326a2e584af`; historical source for several
  antecedent display and sound hacks; verified 2026-07-18.
- Repository companion studies: [MUNCH and Munching Squares](../mit-cadr/munch.md),
  [LEXIPHAGE](../mit-cadr/lexiphage.md),
  [Genera font catalog](font-catalog.md), and
  [Genera computer-use harness](genera-computer-use-harness.md).

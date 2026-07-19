---
type: Reimplementation Specification
title: MIT CADR and LM-3 TV window system reimplementation specification
description: A reconstruction-grade behavioral and architectural specification of screens, sheets, streams, exposure, input, menus, frames, constraints, scrolling, and screen management in the MIT CADR and LM-3 TV system.
tags: [mit-cadr, lm-3, tv, window-system, reimplementation, specification, preservation]
timestamp: 2026-07-19T00:37:30-04:00
---

# MIT CADR and LM-3 TV window system reimplementation specification

## Status and reconstruction claim

This document specifies enough of the TV window system to build a new,
implementation-independent system with the same architecture and externally visible
behavior as the preserved Lisp Machine software. The primary compatibility target is
the runnable **LM-3 System 303-0** environment. MIT **System 46** is a separately
identified historical profile, not an interchangeable source tree. A conforming
implementation can choose either profile or implement both.

The target through T4 is semantic and behavioral compatibility, not a bit-identical
world image or drop-in compatibility with every historical Lisp caller. The
specification covers the object model, state transitions, coordinate and raster
rules, locking, stream behavior, exposure and saved-bit algorithms, input routing,
mouse ownership, menus, scroll windows, frames, constraints, the System Menu, and
conformance tests. It does not require CADR microcode, 36-bit object representation,
Flavors internals, or the original compiled instruction sequences. Those can be
replaced if the normative behavior remains the same. Exact historical package,
symbol, lambda-list, multiple-value, condition, method-combination, and load-order
compatibility is reserved as T5 and is not claimed by this document.

Three boundaries remain important:

- Public System 46 source establishes source-visible behavior. Preserved QFASLs
  corroborate compiled module and symbol surfaces only; they neither prove method
  bodies nor necessarily match the highest readable source generation beside them.
  Neither witness proves the contents of the later System 303 band.
- The maintained LM-3 source and the `System 303-0` band are independently identified.
  A source result is not labeled as observed band behavior unless the harness
  exercised it or the live image was introspected.
- A requirement marked `TODO-RUNTIME` is sufficiently specified from source or a
  manual to implement, but has not yet been compared with the preserved running band.
  It must not be used as evidence of pixel-perfect compatibility.

## Normative language and evidence codes

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
normative. “Historical implementation” describes the inspected software without
requiring a new implementation to use the same technique. Exact Lisp symbols are
written in code font; a new implementation may expose idiomatic aliases while
retaining them in a compatibility layer.

Every substantial requirement has one or more evidence codes:

| Code | Meaning |
| --- | --- |
| `S46-SRC` | Direct inspection of the pinned public System 46 source |
| `S46-QF` | A public System 46 QFASL survives for the named module; this is compiled-artifact corroboration, not proof that it matches the latest readable revision |
| `303-SRC` | Direct inspection of the pinned maintained LM-3 System 303 source |
| `303-RUN` | Direct behavior in the preserved `System 303-0` band through the Xvfb harness |
| `MIT-MAN` | Contemporary MIT Lisp Machine or window-system manual material |
| `MIT-WP209` | Moon and Wechsler's user-level operations paper, explicitly accurate as of System 67; corroboration of the visible model, not System 46 or System 303 implementation evidence |
| `INFERRED` | An implementation-independent rule synthesized from the sources; the synthesis is identified rather than presented as original terminology |
| `TODO-RUNTIME` | Implemented or documented in a primary source, but not yet exercised in the preserved band |

The evidence code describes support, not priority. When source, compiled inventory,
manual, and runtime differ, the release-specific runtime wins for that observed band;
the disagreement remains in the record.

## Compatibility profiles and levels

### Release profiles

| Profile | Required target | Deliberate boundary |
| --- | --- | --- |
| `TV-46` | MIT System 46 source behavior at Git revision `8e978d7d1704096a63edd4386a3b8326a2e584af` | No live compatible System 46 band has yet been exercised; visible claims remain source/manual based |
| `TV-303` | LM-3 `system-303` source at Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` and the `System 303-0` band | The Fossil branch is a maintained restoration; its modern check-in date is not a historical authorship date |
| `TV-DUAL` | Both profiles behind explicit feature/version selection | Must not silently average different menus, confirmation policy, selection registries, or attribute protocols |

The `TV-46` source profile and the preserved System 46 compiled surface are not
identical labels. In particular, `stream.qfasl` has a `stream.10`-level definition
surface while the highest readable file is `stream.14`; the exact boundary is
recorded under [Compiled-artifact method and source skew](#compiled-artifact-method-and-source-skew).

### Conformance levels

| Level | Name | Required facilities |
| --- | --- | --- |
| T0 | Raster substrate | Screen arrays, coordinate rules, clipping, Boolean ALU operations, BITBLT, rectangles, lines, and bitmap-font drawing |
| T1 | Sheet and stream core | Sheet tree, geometry and margins, cursors, blinkers, text output, input buffer, locking, activation, exposure, deexposure, refresh, and saved bits |
| T2 | Interactive windows | Selection, processes, keyboard focus and typeahead, mouse routing and ownership, who-line state and pointer documentation, labels, borders, and typeout behavior |
| T3 | Reusable UI families | Menus, multiple choice, temporary/typeout windows, scroll windows and bars, item sensitivity, frames, panes, and constraint layout |
| T4 | Environment integration | System Menu, System-key registry, recent-window selection, Screen Editor hooks, screen manager, multiple screens, and boot ordering |
| T5 | Historical source compatibility (reserved) | Exhaustive public package/symbol inventory, exact lambda lists and defaults, multiple values, conditions, Flavors method combinations, compatibility aliases, and module/load contracts sufficient to run unmodified historical clients; not claimable from this revision |

A product may claim a lower level without implementing the higher ones. It MUST state
its release profile and level together, such as `TV-303/T3`. T0 through T4 are enough
to recreate the architecture and tested user-visible behavior described here; they
do not by themselves promise that arbitrary System 46 or System 303 application
source will compile unchanged.

## Evidence ledger

| Subsystem | Readable implementation | Compiled or band evidence | Observed behavior | Contemporary description |
| --- | --- | --- | --- | --- |
| Raster, fonts, and sheets | `tvdefs`, `sheet`, `stream`, `shwarm`, `graphics` in both public source lines | System 46 QFASLs corroborate module/symbol surfaces with an exact `stream` version skew; the System 303 band draws the observed desktop and applications | Integrated applications exercise raster output; a focused listener probe confirms exact negative-origin inside clipping and reversible XOR | MIT *Lisp Machine Manual*, “The TV Display” and “The Window System” |
| Exposure, priority, and screen management | `sheet`, `baswin`, `scrman` | Corresponding System 46 QFASLs; resident System 303 windows render overlapping menu/sheet states | System Menu appeared and disappeared over the Listener; no before/after restoration-region hash yet exists | MIT operations and window documentation |
| Keyboard, mouse, and selection | `stream`, `basstr`, `mouse`, `proces` | System 46 compiled modules; active System 303 input and selection registries | Right click opens System Menu, pointer hover changes documentation, System selection and typed Listener input work | MIT keyboard, mouse, and window chapters |
| Typeout and notifications | `typwin`, `basstr`, selection/process mixins | System 46 `typwin`, `basstr`, and `proces` QFASLs | Integrated typeout/error windows are visible in applications, but the overlay and interesting-window state machines have not been isolated | MIT window selection and notification material |
| Menus, scroll, choices | `menu`, `scroll`, `tscrol`, `choice`, `typwin` | System 46 QFASLs for all five families | Three-column System Menu, menu highlighting, ZWEI Help menus, and application choices | MIT menu and window documentation |
| Frames and constraints | `frame` | System 46 `frame.qfasl`; frame objects are resident in the running System 303 environment | ZWEI, Inspector, Peek, Zmail, and Screen Editor show pane/frame composition | MIT frame and constraint documentation plus application manuals |
| Who line and color | `shwarm`, `tvdefs`, `color` | Corresponding System 46 QFASLs; live band has a monochrome who line | Item-dependent mouse documentation is observed; process/file transitions and all color behavior remain unexercised | MIT who-line and color-screen material |
| Environment integration | `sysmen`, `scred`, `wholin`, system declarations | Corresponding compiled modules where preserved; `System 303-0` is the live artifact | Exact System Menu, live System Help registry, Screen Editor menu, and who line captured | MIT operations manual |

The runtime column establishes representative integration, not every destructive or
timing-sensitive branch. The test suite below identifies the remaining probes.

### Release-bounded operations-paper corroboration

Moon and Wechsler's April 1981 MIT AI Laboratory Working Paper 209,
[*Operating the Lisp Machine*](https://dspace.mit.edu/bitstream/handle/1721.1/41042/AI_WP_209.pdf?sequence=2&isAllowed=y)
([stable MIT record](https://hdl.handle.net/1721.1/41042)),
materially corroborates the user-visible model: bit-raster screens allocated among
programs and menus, windows as independent subdisplays and streams, selection as
keyboard focus, exposed/deexposed states, rectangular cursor blinkers, popup menus,
`Output Hold`, notification for deexposed output, and selection causing exposure
(especially §§2.1-2.3). The examined 2,586,142-byte PDF has SHA-256
`a16d45f5d425e05c6df7c67a5d785c3dd62424a37bed5be8575b7ebbf1e8ff23`.

The paper explicitly says that it is a draft accurate as of **System 67** and is not
guaranteed to remain fully accurate. It therefore supplies `MIT-WP209` corroboration
for concepts and visible interaction only. It is not evidence for System 46 or
System 303 array redirection, coordinates, clipping, ALUs, saved-bit algorithms,
lock ordering, API names, or release deltas. Any claim derived from it MUST retain
the System 67 qualifier beside the claim; source and runtime evidence govern the two
profiles specified here.

## Architectural decomposition

The TV system is a hierarchy of active display objects rather than a compositor of
independent top-level pixel buffers. The following ordering is normative even when a
new implementation uses different modules:

1. A raster device supplies one or more addressable planes and Boolean block transfer.
2. A `SCREEN` is the root `SHEET` for one display and supplies its pixel storage and
   device properties.
3. A `SHEET` owns a rectangular coordinate space, output state, optional off-screen
   saved bits, inferiors, exposed inferiors, and synchronization state.
4. Stream mixins make a sheet accept character and keyboard operations.
5. Window mixins add activation, selection, process, label, border, mouse, typeout,
   and screen-management policy.
6. Menus, scroll windows, choices, and frames are composed from those protocols.
7. The screen manager, System Menu, and selection registries coordinate the complete
   tree.

This order matters. A frame pane is still a sheet and stream; a menu is not a second
host toolkit; a temporary menu protects and restores ordinary TV pixels; and the
who line participates in the same input and selection environment.

## Coordinate, rectangle, and raster model

### Coordinate system

- The origin MUST be the top-left of a screen or sheet. X increases right and Y
  increases down. (`S46-SRC`, `303-SRC`, `MIT-MAN`)
- Rectangles MUST use half-open edges `[left,right) × [top,bottom)`. Width is
  `right-left`; height is `bottom-top`. High-level clipped rectangle operations may
  accept a negative origin and discard the portion before the clip edge; they issue
  no raster primitive when the post-clip width or height is nonpositive. Negative
  requested dimensions are not a general high-level drawing feature. Signed
  dimensions at the lower-level historical BITBLT boundary are different: internal
  move code uses their signs to select overlap-safe traversal. (`S46-SRC`,
  `303-SRC`, `303-RUN`)
- A sheet's `x-offset` and `y-offset` are relative to its superior. Drawing
  coordinates and cursor positions are local to the sheet. Device coordinates are
  obtained by summing offsets through the superior chain. (`S46-SRC`, `303-SRC`)
- An inferior MUST remain entirely within its superior before it becomes exposed
  and while an exposed move or reshape commits. An attempted violating visible
  operation MUST fail before changing visible geometry. Activation establishes
  membership and ordering but is not, by itself, evidence that every inactive
  construction path performed the same containment check. (`S46-SRC`, `303-SRC`)
- Margins are local nonnegative widths. The inside rectangle is
  `[left-margin,width-right-margin) × [top-margin,height-bottom-margin)`.
  (`S46-SRC`, `303-SRC`)

### Screen pixel storage

A screen implementation MUST expose these logical properties even if the host GPU or
framebuffer differs:

```text
Screen {
  name
  width, height
  bits_per_pixel
  raster_storage
  locations_per_line
  default_font
  device_properties
  root_sheet_state
}
```

`TV-46` MUST support the historical one-bit monochrome path. Multi-plane or indexed
color MAY be supplied through the screen's depth and properties; it MUST NOT change
the sheet coordinate or hierarchy rules. The compatibility layer SHOULD expose a
pixel array and the coarser backing-word view expected by diagnostic software.

### Boolean raster operations

The compatibility raster substrate MUST implement the ALU selectors directly
established by the manuals and inspected source. A backend MAY implement all 16
Boolean functions of source bit `S` and destination bit `D`, but this audit has not
established stable public names or identical multi-plane semantics for that complete
truth-table set. The required compatibility names are:

| Name | Result | Typical use |
| --- | --- | --- |
| `ALU-SETA` | `S` | copy source; save or restore bits |
| `ALU-IOR` | `S OR D` | draw set source bits |
| `ALU-XOR` | `S XOR D` | reversible blinkers and highlights |
| `ALU-ANDCA` | `D AND NOT S` | erase through a one-bit mask |
| `ALU-SETZ` | `0` | clear destination |

`BITBLT(alu,width,height,source,sx,sy,destination,dx,dy)` MUST combine the
corresponding pixels over the requested rectangle. It MUST produce memmove-like
results for overlapping source and destination regions: traversal direction or an
equivalent temporary representation MUST prevent source pixels from being destroyed
before use. It MUST preserve pixels outside the destination rectangle. (`S46-SRC`,
`303-SRC`, `MIT-MAN`)

Clipping is operation- and release-specific:

- In System 46, `:DRAW-RECTANGLE` translates inside-relative coordinates and clips
  on all four inside edges. Its stream `:BITBLT` only limits destination width and
  height at the right and bottom; negative origins are not repaired. The
  `:BITBLT-FROM-SHEET`, `:PIXEL`, and `:SET-PIXEL` methods add no explicit clipping.
  A safe implementation MAY add checked variants, but MUST NOT label that extension
  exact `TV-46` behavior. (`stream.14:L133-L172`; `S46-SRC`)
- System 303 adds `BITBLT-CLIPPED`, which clips both source and destination against
  all four array edges, and its sheet methods use inside-aware clipping. Its source
  contract says negative dimensions are not allowed; the readable body clamps the
  resulting extents to zero and omits the primitive BITBLT when either extent is
  zero, but does not visibly establish that a negative argument signals a condition.
  Negative dimensions are therefore outside the public `BITBLT-CLIPPED` contract,
  not a required error result. (`window/sheet.lisp:L33-L57`,
  `window/shwarm.lisp:L94-L201`; `303-SRC`)
- The low-level BITBLT used for margin and overlap moves still permits signed
  dimensions as a traversal-direction convention. A host backend may normalize the
  operation through an immutable temporary copy, but MUST preserve the same final
  pixels. (`sheet.383:L758-L782`; `S46-SRC`, `303-SRC`)

### Lines, rectangles, and text

- Axis-aligned fills MUST reduce to a clipped rectangle operation.
- System 46 `:DRAW-LINE` accepts a `DRAW-END-POINT` argument whose default is true;
  after inside-coordinate translation and clipping it passes that flag to the
  `%DRAW-LINE` microcoded primitive. `:DRAW-LINES` deliberately passes false for
  every segment, which makes it suitable for closed polygons without drawing shared
  terminal points twice. A reconstruction MUST preserve that endpoint-control
  contract. The inspected public tree declares but does not contain a readable body
  for `%DRAW-LINE`; exact tie breaking, octant pixel sets, and reversal invariance
  remain `TODO-RUNTIME`, not normative claims. (`stream.14:L508-L573`; `S46-SRC`)
- A font is a fixed-height collection of bitmap glyphs with baseline, default width,
  optional per-character widths, optional left kern, optional indexing for wide
  glyphs, and an optional character-existence table. Wide glyphs occupy the
  indexing-table interval between a character entry and the following terminal
  entry. A NIL existence table means every character code is assumed to exist, not
  that none do. (`tvdefs.181:L342-L385`; `sheet.383:L507-L545`; `S46-SRC`)
- A sheet font map MUST normalize to 26 entries. A shorter nonempty map repeats its
  last font through entry 25. Entry zero supplies the initial current font and
  default character width. The common baseline is the maximum mapped-font baseline;
  line height is the maximum mapped character-cell height plus vertical spacing
  (`VSP`, initially 2 in `TV-46`). Each glyph is vertically adjusted to that common
  baseline. (`sheet.383:L507-L545`; `S46-SRC`)
- Raster extent and cursor advance are distinct. Drawing applies left kern, draws
  every indexed raster segment, and advances by a per-character width when present
  or the font default otherwise; italic or kerned pixels may extend beyond the
  nominal advance. A character is positioned by aligning its baseline with the
  sheet baseline.
- Character drawing MUST use the sheet's character ALU; erasing and blank areas MUST
  use its erase ALU. Reverse video is expressed by changing those logical operations,
  not by changing character codes.
- If a glyph is missing according to a font's existence table, the compatibility
  layer SHOULD fall back according to the target profile rather than reading
  uninitialized raster data.

The [font source and recovery](font-sources-and-recovery.md) and
[font-use audit](font-usage-audit.md) specify the public font representation and
release-bounded uses. Font bytes are inputs to this window specification, not
redefined here.

## Core object and state model

### `SHEET`

A conforming sheet MUST retain the following logical state:

```text
Sheet {
  name
  superior: Sheet | null
  inferiors: ordered list<Sheet>
  exposed_inferiors: ordered subset of inferiors
  active: boolean derived from membership in superior.inferiors
  exposed: boolean
  x_offset, y_offset, width, height
  margins: {left, top, right, bottom}
  screen_array: visible or saved raster mapping | null
  old_screen_array: mapping used when direct visible storage is unavailable
  bit_array: optional persistent off-screen backing
  temporary_bit_array: optional underlay saved by a temporary window
  locked_temporary_windows: list<Sheet>
  cursor_x, cursor_y, more_vpos
  font_map, current_font, baseline, baseline_adjustment, line_height, char_width
  char_alu, erase_alu
  flags
  blinkers: list<Blinker>
  deexposed_typeout_action
  lock_owner_or_temporary_owners, recursive_lock_count
  invisible_to_mouse
  screen_manager_metadata
}
```

An implementation MAY derive fields or store them in components. It MUST preserve
the following distinct predicates:

| Predicate | Meaning |
| --- | --- |
| Active | The sheet is a current inferior of its superior and participates in management |
| Exposed | The sheet is in the superior's exposed set and has completed the logical expose transition |
| Device-visible | The sheet and every ancestor map ultimately to an exposed physical screen |
| Selected | The global keyboard-selection target is this window or a selecting alias resolves to it |
| Mouse owner | The mouse overseer currently dispatches to it, or it has explicitly seized ownership |

Conflating these states breaks saved bits, frames, and temporary menus. An exposed
inferior of a deexposed saved-bits parent can be logically exposed without appearing
on the physical display.

### `SCREEN`

A screen MUST be a sheet with no superior, fixed zero-relative origin, physical
storage, device depth, default font, and a mouse-blinker collection. It MUST reject an
attempt to expose it at a different origin. Multiple screens MUST form independent
root trees, while selection and mouse-screen policy MAY span them. (`S46-SRC`,
`303-SRC`)

### `BLINKER`

```text
Blinker {
  sheet
  position or follows_sheet_cursor
  visibility: hidden | solid | blink | selected-only-on | selected-only-off
  deselected_visibility
  phase
  half_period
  time_until_toggle
  renderer_and_arguments
  geometry
}
```

A blinker renderer MUST be reversible. The rectangular and character blinkers use
XOR-like complementing so the same operation removes the mark. Before any output can
touch a blinker rectangle, the sheet MUST “open” that blinker by removing its visible
phase. A later clock opportunity restores the phase appropriate to visibility and
selection. This prevents typeout from baking a cursor into the backing pixels.

Changing a blinker's position, size, renderer, sheet, or visibility MUST first remove
its old visible effect. A cursor-following blinker derives its position from the
sheet; a roving mouse blinker does not need a text cursor owner.

### Input buffer

The input system has both a global hardware/software keyboard queue and private
per-stream I/O buffers. The selected window caches one selected I/O buffer. A reader
first drains its private buffer; only a reader whose private buffer is the selected
I/O buffer may then drain global typeahead. An unselected reader waits even if the
global queue is nonempty. The historical manuals do not promise deterministic
arbitration between two readers of one shared stream, so a compatibility layer MUST
NOT invent such a guarantee. (`S46-SRC`, `303-SRC`, `MIT-MAN`)

Each I/O buffer is a circular queue with an input pointer, output pointer, capacity,
optional input/output and interrupt hooks, state, and property list. One slot is
reserved so equal pointers unambiguously mean empty; `(input+1) mod capacity ==
output` means full. Pointer updates MUST be atomic relative to keyboard and mouse
producers. (`S46-SRC`, `303-SRC`)

The state controls whether data can be inserted or removed. A producer MUST NOT
overwrite unread input. In the inspected System 46 ingress path, a full buffer simply
does not receive the additional key; no source branch establishes a beep or blocking
write. The compatibility profile MUST preserve that drop behavior unless a later
runtime probe establishes a different `TV-303` path. `TYI-NO-HANG` returns
immediately when empty; `LISTEN` reports availability without consuming; `UNTYI`
makes one item available again according to the stream contract; forced input enters
the target buffer or structured-blip path rather than pretending to be a physical
device transition.

## Construction, sizing, and decoration grammar

### Creation transaction and initial state

`TV-46` `WINDOW-CREATE` is an ordered construction sequence under delayed screen
management, not allocation followed by unrelated public mutations. A compatible
implementation MUST preserve this observable order:

```text
allocate the requested flavor in sheet storage
enter delayed screen management
  invoke :INIT with a private copy of the option list
  if saved backing exists, force access and perform a complete refresh
  if :ACTIVATE-P, activate
  if :EXPOSE-P, expose with the supplied or default exposure arguments
leave delayed screen management; if its queue is nonempty, flush/reconcile it once as a batch
return the initialized object
```

`:INIT` is recursively sheet-locked. A queued screen-management pass cannot run
between initialization steps, and the object does not enter the superior's active
inferior traversal until activation. Arbitrary flavor initialization methods may
still have side effects; the source does not promise global rollback or isolation if
one of them fails. `TV-303` retains this construction model while treating the older
`MAKE-WINDOW` name as a compatibility entry and changing the Flavors initialization
method combination; an adapter MAY accept both names but MUST keep profile-specific
warnings and argument behavior separate. (`sheet.383:L371-L387`,
`tvdefs.181:L585-L606`, `window/sheet.lisp:L671-L691`; `S46-SRC`, `303-SRC`)

The `TV-46` sheet initializer accepts at least these option families:

- outer geometry: `:LEFT`/`:X`, `:TOP`/`:Y`, `:RIGHT`, `:BOTTOM`, and `:EDGES`;
- pixel, inside, or character-based width and height;
- font map and vertical spacing;
- blinker creation, renderer, and deselected visibility;
- reverse video, More processing, integral sizing, and saved bits; and
- right-margin marker, line truncation, and backspace policy.

Its defaults include vertical spacing 2, More enabled, a rectangular following
blinker whose deselected visibility is `:ON`, and output initially held while the
sheet is not displayable. Normal video uses `ALU-IOR` for glyphs and `ALU-ANDCA` for
erase; reverse video exchanges those roles. An implementation MUST install all
derived font, margin, ALU, cursor, blinker, and exception state before activation.
(`sheet.383:L397-L456`; `S46-SRC`)

### Size deduction precedence

Construction MUST solve size options by the historical precedence rather than by
host-widget defaults:

1. Compute fonts, line height, and decoration margins before interpreting character
   sizes.
2. Numeric character width means `count * default-character-width + left-margin +
   right-margin`. For string width, `TV-46` uses the final X advance returned by
   `SHEET-STRING-LENGTH`, while `TV-303` uses its maximum-X result; each then adds the
   horizontal margins.
3. Numeric character height means `count * line-height + top-margin + bottom-margin`.
   In `TV-46`, string height is `(1 + number-of-CR-characters) * line-height` plus
   vertical margins. In `TV-303`, string height is the vertical result of
   `SHEET-COMPUTE-MOTION` plus margins.
4. `TV-303` clamps decoded character width and height to the superior's inside width
   and height. The inspected `TV-46` decoder does not perform those clamps.
5. If an origin is absent but the opposite edge and an explicit size exist, derive
   the origin from them.
6. Otherwise an absent left/top defaults to the superior's inside left/top. If width
   or height remains absent, subtract that chosen origin from the explicitly supplied
   right/bottom edge; use the superior's inside right/bottom only when the
   corresponding opposite edge is also absent.
7. Integral sizing adjusts the bottom margin so the inside height contains a whole
   number of text lines.
8. Set the initial cursor to the inside top-left in whole-sheet coordinates.

Redundant fields follow that precedence; they do not generically signal a conflict.
For example, an already bound origin and explicit size can make a supplied
right/bottom redundant. In `TV-303`, processing `:EDGES` clears any width/height
already accumulated from defaults so the supplied edges control deduction, and it
explicitly rejects nonpositive edge width or height. Other invalid results MUST NOT
be assigned a historically invented error condition: reproduce the selected source
path or declare a safety-corrected validation extension.
(`sheet.383:L507-L591`, `shwarm.162:L730-L785`,
`window/sheet.lisp:L704-L789`; `S46-SRC`, `303-SRC`)

### Resize and margin transaction

On its successful path, changing size, margins, borders, or a label MUST preserve
this operation order:

1. erase obsolete margin pixels while the old geometry is still valid;
2. preserve the cursor relative to the old inside origin;
3. parse options, update margin fields, and derive offsets and outer dimensions;
4. deexpose children that no longer fit;
5. remove blinkers, recompute font/integral sizing, and clamp cursor and blinker
   positions;
6. grow backing arrays when necessary without discarding retained pixels;
7. redirect the stable screen-array view to the new storage, offset, and stride;
8. move surviving inside pixels with overlap-safe signed BITBLT and clear newly
   uncovered or unreachable storage; and
9. erase/refresh the new margin regions and hand any queued damage to screen
   management.

The readable `TV-46` method is not atomic on failure: it erases old margins before
option parsing, mutates recognized margin fields as it walks the option list, and
sets geometry before later raster work. A strict historical-failure profile MAY
reproduce those partial effects. The recommended safety-corrected rule is
`INFERRED`: validate and stage the mutation, then commit atomically or restore the old
geometry and pixels. An implementation using that rule MUST disclose that its abort
behavior is safer than exact `TV-46`; it MUST still produce the same successful final
state and MUST NOT reinterpret retained client pixels as margin pixels.
(`sheet.383:L681-L827`; `S46-SRC`, `303-SRC`, `INFERRED`)

### Border descriptor grammar

The `TV-46` border option has this grammar:

| Form | Meaning |
| --- | --- |
| `NIL` | no borders |
| atom | apply one descriptor to left, top, right, and bottom |
| side property list | replace only named `:LEFT`, `:TOP`, `:RIGHT`, or `:BOTTOM` entries |
| number | standard rectangular-border function with that thickness |
| `T` or function symbol | default rectangular or named drawing function with its declared default thickness |
| canonical side entry | drawing function plus left/top/right/bottom contributions |

Thickness contributes to the corresponding margin, plus the `TV-46` default extra
border margin of one pixel. Canonical draw coordinates may express right or bottom
positions as negative offsets from current width or height; reshape MUST resolve
them against the new dimensions. (`baswin.428:L675-L809`; `S46-SRC`)

`TV-303` additionally canonicalizes a side whose extent in its perpendicular axis is
zero to the sentinel `:ZERO`. `DRAW-BORDERS` skips that side, but the non-NIL sentinel
still contributes the configured extra border margin. This is observably different
from `NIL`, which removes the side and its extra margin. The later parser also folds
existing margins into canonical coordinates in left, right, top, bottom order;
implementations MUST NOT substitute `NIL` for `:ZERO`.
(`window/baswin.lisp:L898-L1024`; `303-SRC`)

### Label measurement grammar

In `TV-46`, a label occupies a top or bottom margin, defaults its text to the window
name, and uses a configurable label font. In `TV-303`, accepted descriptors include
string, font, `:TOP`/`:BOTTOM`, vertical spacing, centering, multiline extent, and
boxed variants. Label height MUST be measured before final inside geometry. For a
nonempty string the later code measures it through the sheet motion engine using a
line increment of `font-character-height + (label-vsp or 2)`; without a label string
it reserves one font-character height. Centering changes horizontal placement, and
boxed variants add their rule space to the relevant margin.

Drawing, erasing, or changing a label MUST preserve the client cursor. A label
change reparses the descriptor, recomputes margins, marks/restores the decoration
region, and redraws through margin refresh rather than emitting client text.
(`baswin.428:L812-L945`, `window/baswin.lisp:L1047-L1342`; `S46-SRC`, `303-SRC`)

## Concurrency and sheet access

### Locks

Each sheet has a recursive normal lock and can also be temporarily locked by one or
more temporary windows. Normal ownership is by the executing process or an equivalent
unique identity. Reacquisition by the owner increments a count; release decrements it
and frees the lock at zero. (`S46-SRC`, `303-SRC`)

A conforming implementation MUST obey these rules:

1. Geometry, exposure, saved-bit changes, and direct sheet drawing occur while the
   affected sheet is stable against incompatible changes.
2. Locking a sheet for drawing also prevents blinkers from independently changing
   the pixels being updated.
3. A temporary window may lock every exposed overlapping target without permanently
   deexposing it. It MUST acquire the whole compatible set or wait and retry; a
   partial set MUST be unwound.
4. Waiting MUST occur with scheduler inhibition or the host equivalent released.
   After waking, geometry and ownership MUST be rechecked because the world can have
   changed.
5. Reparenting an active subtree MUST preserve or recompute inherited lock accounting
   so no descendant appears unlocked while an ancestor transaction owns it.

A modern implementation MAY use mutexes, condition variables, and transaction
objects. It MUST retain the retry-after-wait behavior and MUST NOT hold a global
non-reentrant lock while calling an arbitrary window method.

### Preparing a sheet

Before direct raster access, the implementation MUST:

1. acquire or verify compatible sheet access;
2. remove intersecting visible blinkers;
3. select or map the correct raster storage and depth;
4. clip the operation to the appropriate local region;
5. perform the update; and
6. permit blinkers to reappear after the grouped operation.

Several consecutive drawing operations MAY reuse prepared state, but a process switch,
storage remap, exposure change, or different target MUST invalidate that state.

## Geometry and hierarchy protocols

### Activation and deactivation

`ACTIVATE` makes a sheet an active inferior without necessarily exposing it. It MUST
be idempotent. It MUST insert the sheet into the superior's active inferior order and
propagate device-stride parameters through the subtree. (`S46-SRC`, `303-SRC`)

Activation and containment are separate assertions. The inspected source directly
rejects out-of-superior geometry when a sheet is exposed or an exposed position
change commits; activation alone does not prove that every inactive geometry was
already displayable. A caller MAY prepare an inactive sheet before final placement,
but `EXPOSE` MUST reject it until its bounds fit the superior's inside rectangle.
(`sheet.383:L1018-L1047`; `S46-SRC`, `303-SRC`)

`DEACTIVATE` MUST first deexpose the sheet, then remove it from the superior's active
inferiors. Killing a base sheet includes deactivation, followed by any higher-level
resource and process cleanup. A deactivated sheet MUST NOT be exposed until activated
again.

### Moving, reshaping, and reparenting

- Moving a deexposed sheet changes its offsets and remaps any direct superior-backed
  view without touching visible pixels.
- Moving an exposed non-temporary sheet MUST deexpose every overlapping sibling that
  would violate exclusivity, then atomically update its mapping and position.
- Moving an exposed temporary sheet SHOULD use deexpose/re-expose so its saved
  underlay remains correct.
- Reshaping MUST validate bounds and minimum inside dimensions before committing.
  Persistent backing storage must grow when needed and must clear unreachable tail
  storage when shrinking so stale pixels do not reappear on regrowth.
- Reparenting MUST deexpose first, remove active membership from the old superior,
  change inherited raster parameters, install membership under the new superior, and
  request screen management for both affected regions.

Higher-level wrappers MUST notify a frame or superior through inferior-change
protocols so constraint layouts cannot be bypassed by a pane reshaping itself.

## Exposure, deexposure, and saved bits

### Invariants

The implementation MUST maintain all of these invariants:

1. `exposed_inferiors` is an ordered subset of `inferiors`.
2. Two ordinary exposed siblings do not overlap. Temporary windows are the explicit
   exception and protect their underlay with temporary locks and saved pixels.
3. A sheet cannot be device-visible if an ancestor lacks visible or saved backing.
4. A sheet with persistent `bit_array` can retain its own contents while deexposed.
5. A sheet without persistent backing relies on redisplay or the still-valid pixels
   inherited from its superior; it MUST NOT save another window's pixels by mistake.
6. Selection cannot remain inside a subtree being deexposed.
7. Mouse dispatch cannot remain inside an invisible subtree.

### Expose algorithm

The following pseudocode is normative at the behavior level:

```text
expose(sheet, turn_on_blinkers=false, bits_action=default, x=current_x, y=current_y):
  require sheet is active, unless sheet is a root screen
  choose bits_action = restore if persistent backing exists else clean
  retry:
    validate target geometry within superior
    if target origin changed: move sheet safely; retry
    if already exposed: return no-change
    ensure superior provides visible or saved raster access
    if sheet is temporary:
      determine all exposed overlapping targets
      if mouse currently dispatches to one, force mouse reconsideration and wait
      atomically acquire compatible temporary locks on all; otherwise wait and retry
    else:
      deexpose every overlapping exposed sibling; if any wait occurred, retry
    mark logical exposure and insert at the front of superior.exposed_inferiors
    map sheet.screen_array to superior storage when visible
    if temporary: save the exact underlay rectangle
    perform bits_action:
      noop     -> retain current device pixels
      restore  -> restore persistent saved pixels and refresh dependent adornments
      clean    -> home cursor and perform complete redisplay
    update blinker selection state
    expose retained inferiors as required
    wake mouse routing
    return changed
```

The implementation MAY optimize, but it MUST retain validation, atomic overlap
handling, saved-underlay ordering, and retry after waiting. (`S46-SRC`, `303-SRC`)

### Deexpose algorithm

```text
deexpose(sheet, save_bits=default, screen_bits_action=noop,
         remove_from_superior=true):
  if selected window is sheet or descendant: deselect it
  if not exposed: return no-change
  force mouse routing out of sheet and descendants
  if forced saving requested and no persistent backing exists: allocate it
  if saving enabled and backing exists: copy current pixels to backing
  if temporary:
    restore the saved underlay before releasing every temporary lock
  else:
    deexpose or detach exposed inferiors as required by backing policy
    perform the requested uncovered-area action
  clear visible raster mapping where it is no longer valid
  remove from superior.exposed_inferiors when requested
  mark not exposed
  invoke screen management for uncovered regions
  wake mouse routing
```

A temporary window MUST restore its underlay even when aborted. Cleanup SHOULD use an
unwind-protect/finally mechanism. This is the mechanism that permits a momentary menu
to disappear without requiring the underlying application to repaint everything.

### Bury, expose order, and visibility

The front of `exposed_inferiors` is the top of the local stacking order. Expose moves
a sheet to the front. Bury moves it below applicable siblings and invokes the
superior's screen-management protocol. If no other window can cover the vacated
region, the superior clears or redisplays it according to policy.

The order is local to each superior. A frame pane cannot jump above its frame by
changing its position among siblings.

### Priority and automatic exposure

Each superior maintains an ordered active-inferior list and a separate exposed
subset. Reordering is stable and occurs atomically. The intended comparator is:

1. an exposed inferior sorts ahead of a deexposed inferior;
2. two exposed inferiors retain their existing stacking order, regardless of numeric
   priority;
3. equal priorities retain their existing order;
4. among deexposed unequal-priority inferiors, an explicit numeric priority sorts
   ahead of `NIL`/default priority; and
5. among two numeric priorities, the numerically higher value sorts ahead.

`BURY` deexposes the target and moves it to the end of its stable priority class. It
does not override another class's numeric priority. Changing priority accepts only a
number or `NIL` and schedules screen reconciliation. (`S46-SRC`, `303-SRC`)

The two release profiles differ at a source defect. System 46
`sheet.383:L345-L369` contains an impossible branch,
`(AND (NULL PRI-S1) PRI-S1)`, where the adjacent comment requires testing `PRI-S2`.
System 303 `window/sheet.lisp:L645-L669` uses the corrected
`(AND (NULL PRI-S1) PRI-S2)`. Therefore:

- a named strict-priority-bug mode layered on `TV-46` MAY reproduce the malformed
  `NIL`-versus-number case, but MUST identify it as a defect-compatibility option and
  contain any resulting type error; and
- `TV-46` without that optional mode, `TV-303`, and `TV-DUAL` SHOULD use the
  corrected comparator above. (`S46-SRC`, `303-SRC`, `INFERRED`, `TODO-RUNTIME`)

Deexposed visibility is distinct from exposure. A deexposed sheet contributes saved
pixels to uncovered regions only when it has a backing bit array and its priority is
`NIL` or nonnegative. Automatic exposure considers active, deexposed, fully contained
inferiors in priority order, excludes priority `-1` or lower, and exposes a candidate
only if it is uncovered and would not cover an earlier candidate. If this operation
leaves the mouse screen with no selected window, it selects the first eligible named
window. (`S46-SRC`, `303-SRC`, `TODO-RUNTIME`)

Damage is queued by superior and rectangle. A rectangle already contained by a
queued rectangle for that sheet is discarded; a new enclosing rectangle replaces
contained entries. Dequeueing groups regions for one sheet, skips a locked sheet in
nonblocking passes, services other sheets, and retries later. The System 46
background interval is ten ticks, described in source as approximately one sixth of
a second. A new damage engine MAY use different storage, but MUST retain region
coalescing, per-sheet locking, eventual retry, and independence from an unrelated
locked sheet. (`S46-SRC`, `303-SRC`, `TODO-RUNTIME`)

### Refresh

`REFRESH` accepts a kind of work rather than a Boolean:

| Kind | Required result |
| --- | --- |
| complete redisplay | Reconstruct all pixels and decorations from application/window state |
| use old bits | Restore or retain saved pixels, then repair borders, labels, blinkers, and invalid portions |
| margins only | Repair border/label/margin material without discarding the inside |
| damaged region | Redraw only the intersection when the class supports it; otherwise escalate safely |

The base sheet MAY clear for a complete refresh. Higher-level streams and applications
override the method to replay their own model. Therefore saved bits and refresh are
complementary: one preserves pixels; the other reconstructs them.

### Screen management

Screen management reconciles rectangles made visible by deexposure, movement,
reshaping, or hierarchy changes. It MUST operate in superior-local coordinates,
subtract the coverage of higher exposed inferiors, then ask the appropriate lower
window or superior to restore each remaining rectangle. It MAY temporarily delay
management across a group of operations, but the outermost group MUST reconcile the
accumulated damage before returning to ordinary interaction.

## Text stream specification

### Stream protocol

A basic TV stream MUST support at least:

```text
TYO, STRING-OUT, LINE-OUT
TYI, TYI-NO-HANG, UNTYI, LISTEN, CLEAR-INPUT, FORCE-KBD-INPUT
FRESH-LINE, READ-CURSORPOS, SET-CURSORPOS, HOME-CURSOR
CLEAR-SCREEN, CLEAR-EOL, CLEAR-EOF
INSERT-LINE, DELETE-LINE, INSERT-CHAR, DELETE-CHAR
DRAW-RECTANGLE, BEEP, NOTIFY
RUBOUT-HANDLER or profile-equivalent input editing entry
```

The object MUST be usable through the Lisp stream calling convention for its profile,
not only through host-language methods.

### Cursor and character processing

- Cursor X and Y are local pixel positions, normally constrained to the inside
  rectangle.
- Printable characters draw at the current position, using left kern and the full
  indexed glyph raster, then advance independently by the character width.
- Return moves to the inside left edge. Line feed advances by line height. The usual
  CRLF performs both. Backspace moves according to the profile flag and must not move
  outside the left inside edge.
- Tab advances to the next configured tab stop; a compatibility implementation MUST
  reproduce profile tab arithmetic, not use host terminal tabs.
- Font-change characters select entries in the font map. The sheet recomputes
  baseline adjustment so mixed fonts share a baseline.
- An otherwise printable code whose existence-table bit is absent follows the
  profile's missing-character path. When the existence table itself is NIL, every
  code is treated as present.
- Nonprinting effectors are state transitions, not host-terminal escape sequences.
  Return, line feed, tab, backspace, font selection, and profile control codes update
  cursor/exception state; an unhandled invisible effector is rendered through the
  visible-lozenge compatibility path rather than silently discarded.
- A line-overflow exception either wraps, truncates, draws a right-margin marker, or
  delegates to a class-specific handler according to sheet flags and stream method.
- End-of-page sets the appropriate exception state before invoking scrolling,
  wraparound, or More processing.

`:STRING-OUT` MAY batch raster operations, but MUST finish with the same glyphs,
advance, font, exception flags, and logical cursor as repeated `TYO`, except where a
profile explicitly documents an optimized boundary. `SHEET-LINE-OUT` is a separate
editor redisplay primitive: it draws at most one line in its normal mode and returns
the next input index and resulting X, but deliberately leaves the actual sheet cursor
undefined. Generic code MUST NOT infer `LINE-OUT` semantics from it. The no-op stream
completion messages `:CLEAR-OUTPUT`, `:FORCE-OUTPUT`, `:FINISH`, and `:CLOSE` are
required compatibility responses for readable late System 46 source even though the
preserved older `stream.qfasl` symbol surface lacks them.
(`shwarm.162:L338-L465`, `stream.14:L490-L503`; `S46-SRC`, `S46-QF`, `303-SRC`)

### Exception dispatch and More processing

The sheet's packed exception field represents output hold, end page, More, and a
residual invalid state. Its dispatcher MUST test them in this order:

```text
output hold -> end page -> More -> residual exception error
```

The order is observable because one handler can set or clear another state. End of
line can draw the profile's right-margin marker, move to inside left on the next
line, clear that line, and service a pending More. End of page homes or wraps to the
top, clears the new target line, and schedules the next More threshold. The threshold
is derived from line height and the penultimate available text line; its delayed
marker means “arm on the next pass,” not simply `cursor-y >= inside-bottom`.
(`sheet.383:L1289-L1416`, `window/sheet.lisp:L1873-L1927`; `S46-SRC`, `303-SRC`)

When More is enabled and output crosses the armed threshold, the default handler
MUST perform one same-stream transaction:

1. clear the More flag and temporarily defer rearming;
2. clear the end of the current line and draw `**MORE**` in font-map entry zero
   without ordinary stream side effects;
3. perform the configured input operation, normally `:TYI`, honoring the profile's
   hold/stop characters and permitted timeout;
4. erase the prompt and restore the prior cursor X without damaging adjacent output;
5. set the resulting end-page/wrap or input-wait state; and
6. return the character read, including NIL when the chosen timeout path permits it.

Ordinary input resets the threshold. Global and per-sheet flags may disable More.
This is an exception-handler state machine within the raster stream, not a separate
modal dialog. (`sheet.383:L1289-L1416`, `window/sheet.lisp:L1929-L1990`;
`S46-SRC`, `303-SRC`, `MIT-MAN`)

### Deexposed typeout action matrix

Output held because a sheet is deexposed MUST dispatch on the selected profile's
action before obtaining a drawable mapping:

| Action | `TV-46` behavior |
| --- | --- |
| `:NORMAL` | wait until output becomes possible, then retry against current state |
| `:ERROR` | signal output-on-deexposed-sheet without drawing |
| `:PERMIT` | permit output only when a valid backing screen array exists |
| `:EXPOSE` | expose the sheet through the normal exposure transaction, then retry |
| list/form | invoke the specified custom message or form, then re-evaluate state |
| unknown | signal an error without changing pixels or exposure |

`TV-303` adds `:NOTIFY`, which sends `:NOTICE :OUTPUT` and then follows the common
output-hold wait rather than silently exposing the sheet. `:PERMIT` clears the packed
output-hold flag only when a backing `SCREEN-ARRAY` is present. Because that clearing
happens in the exception path on an actual output attempt rather than at deexposure,
software can distinguish “writing was permitted” from “a deexposed write was
attempted.” A reconstruction MUST retain this first-write detection and MUST NOT
model `:PERMIT` as an unobservable Boolean bypass. No action may draw through a stale
mapping into a sibling occupying the old visible rectangle.
(`sheet.383:L1418-L1445`, `window/sheet.lisp:L1992-L2021`; `S46-SRC`, `303-SRC`)

## Window, process, and selection model

### Window composition

The historical implementation uses Flavors mixins. A new implementation MAY use
classes or components, but it SHOULD keep capabilities independently composable:

| Capability | Contract |
| --- | --- |
| essential/base sheet | Geometry, hierarchy, exposure, raster mapping, locks |
| stream | Character and keyboard I/O |
| borders and labels | Reserve margins and redraw adornments |
| selectable | Name, selection/deselection, input focus, recent history |
| process | Associate or create the executing process/stack group |
| mouse | Hit testing, pointer cursor, movement and button methods |
| save bits | Persistent off-screen raster while deexposed |
| temporary | Save and restore underlay while exposed above ordinary windows |
| typeout | Overlay or subsidiary output with delayed removal |
| scroll | Model-based scrolling and scroll-bar semantics |
| pane/frame | Superior-controlled selection and geometry |

The base compatibility flavor names SHOULD remain available, but compatibility is
judged by required methods and behavior rather than linearized class identity.

### Selection

Selecting a window MUST:

1. resolve any pane or alias to the actual selectable frame/window;
2. activate and expose the required ancestry;
3. deselect the previous target and adjust its blinkers;
4. move pending typeahead to the old target before switching the selected input
   buffer;
5. set the global selected window and input buffer;
6. update recent-selection order;
7. enable selected visibility for the new blinkers;
8. select or wake its process when appropriate; and
9. update the who line and mouse routing.

Selection MUST be idempotent except for explicitly documented cycling behavior.
Deexposing or killing the selected subtree MUST trigger a safe replacement or leave a
known no-selection state.

Only one top-level **selection team** can own keyboard input. A frame/team leader is
the selection identity while its current representative pane can supply the effective
I/O buffer, process, status, notification stream, and blinkers. Selecting another pane
inside the same team changes that representative without creating a second top-level
keyboard owner. Mouse selection MUST run outside the global mouse process when it can
block on exposure or process work.

`TV-303` generalizes this with recursive selection substitutes. A conforming later
profile MUST resolve the ultimate substitute for selection lists and forwarding, and
support its release-specific deselection/restoration modes (`:DONT-SAVE`,
`:BEGINNING`, `:LAST`, and `:FIRST`). A new memory-safe implementation SHOULD detect
a substitute cycle and signal a bounded error; the inspected recursion has no proved
cycle guard, so this safety behavior must be identified as a deliberate correction
rather than a historical observation.

The recent-selection structure is a unique, NIL-padded MRU sequence. It excludes the
current target, removes duplicates and dead/deactivated entries, filters for the
requested eligibility, and falls back to an idle Listener when nothing usable
remains. `TV-46` grows its vector in blocks of ten; a new representation may differ
but MUST reproduce the observable order and filters.

### Process association

A process-owning window associates a process and stack group with its stream. Input
selection directs keyboard events to the window's I/O buffer; it does not blindly run
application code in the keyboard interrupt path. Creation MAY start a process;
selection MAY wake or reset one according to its class. Arrest, reset, kill, and error
notification are process operations surfaced through window management.

Call, Break, and Abort address the effective selected process. Call arrests or
suspends the busy context and selects a Listener-like control context; Break forces a
break in the associated process; Abort resets it. A window that merely reports a
process does not necessarily own its lifetime, while a process-owning mixin creates
or adopts a process and kills the owned process only after inherited window cleanup.

## Keyboard and mouse input

### Keyboard routing

Keyboard ingress MUST be one atomic decision against the current selected I/O buffer:

1. Snapshot the selected buffer, its property list, raw/converted input mode, and
   available capacity.
2. In raw mode, enqueue the raw code and run the optional input interrupt only when
   space exists.
3. Otherwise translate the hardware code to a Lisp Machine character and record
   keyboard activity.
4. Recognize Terminal/Escape and System prefixes before ordinary enqueueing.
5. Intercept Call and Abort as asynchronous selected-window operations unless the
   buffer requests super-image mode.
6. Enqueue an ordinary converted character and invoke its input interrupt only when
   space exists.

This ordering is observable: Call/Abort cannot appear as ordinary text in normal
mode, and a prefix key cannot leak to an application before the selector reads its
suffix. (`S46-SRC`, `303-SRC`)

Before a System or Terminal operation changes selection, pending ordinary typeahead
MUST be transferred in order from the global queue to the old selected window's
private buffer, up to its defined capacity. This prevents text intended for the old
window from following focus. The prefix and its selector suffix are control input and
MUST NOT be transferred as ordinary text.

Terminal command entries contain a character, function, documentation, and options.
The default execution path runs the command outside the keyboard process;
`:KEYBOARD-PROCESS` opts into that process and `:TYPEAHEAD` requests preservation of
pending old-window input. Unknown options in the `TV-46` registry are forward-compatible
and SHOULD be ignored. Terminal Help enumerates the effective registry.

System selection runs in its own control process. Help or `?` reports the live
registry; Rubout cancels; a concrete window is selected directly; a flavor/program
kind first searches and cycles existing matching windows before using its separately
declared creation path. Invalid or absent non-creatable targets beep. `TV-303` MUST
provide mutable add/remove registration and MUST NOT freeze the five entries observed
in one fresh band as a universal list.

### Mouse overseer

One mouse process or equivalent event loop MUST:

1. read relative movement and button transitions;
2. apply device scaling and clamp to the selected mouse screen;
3. update the roving pointer blinker;
4. choose the deepest eligible exposed sheet under the pointer unless ownership is
   seized;
5. deliver enter/leave or `HANDLE-MOUSE` transitions when jurisdiction changes;
6. send motion and button events in coordinates local to the owning sheet; and
7. reconsider ownership when visibility, hierarchy, selection, or the handler asks.

Hit testing MUST respect `invisible_to_mouse`, active/exposed ancestry, stacking
order, and any method/capability filter supplied by the caller. (`S46-SRC`, `303-SRC`)

The ownership value has two sentinels in addition to a concrete sheet: an anonymous
grab suppresses normal target actions when the owner cannot name a window, and a Stop
state suspends mouse dispatch. The overseer MUST catch a handler failure at its outer
boundary so one application cannot permanently kill global pointer service.

For ordinary, non-grabbed button dispatch, the order is: concrete owner's button
method; eligible exposed handler immediately under the pointer; mouse selection;
desktop/System Menu fallback. The default System 46 behavior selects asynchronously
on Left and opens the System Menu on Right. A keyboard-mouse window instead encodes a
click in an already selected input window into its I/O buffer; right double-click
opens the System Menu. Some forced mouse blips can overtake pending keyboard input in
another queue. A strict compatibility mode MUST preserve and document that ordering
hazard rather than falsely promise one merged event queue.

Default `TV-46` tracking has configurable physical/device thresholds: 10 pixels of
scroll-bar entry reluctance, a 3-pixel sensing strip, 300 pixels of exit reluctance,
10 inches/second maximum scroll-entry speed, and a 30 inches/second fast-motion
threshold with a temporary 40-pixel cross. A host implementation MUST calibrate
physical-speed quantities instead of treating CSS pixels as inches. A hysteretic
window retains ownership within a 25-pixel halo. These are profile defaults, not
universal constants.

### Seizing and releasing the mouse

A modal interaction MAY seize the mouse for a particular sheet or for an anonymous
operation. While seized, ordinary under-pointer jurisdiction MUST not steal events.
Release MUST wake the overseer and recompute the owner from current geometry. If a
temporary window would cover the current mouse target, exposure MUST first force the
overseer out of that target or wait; this prevents dispatch into visually inaccessible
state.

### Buttons and pointer documentation

Button events preserve button identity, press/release transition, and modifier state.
The compatibility layer SHOULD expose logical Left, Middle, and Right names while
allowing a host mapping. Bounce filtering and double-click recognition belong above
raw transition capture and MUST use profile-configurable time thresholds.

A mouse-sensitive window SHOULD update the who line with the actions currently
available at the pointer and under the present modifier/button context. Leaving the
sensitive region MUST clear or replace that documentation.

The standard scroll-bar gestures in `TV-46` are:

| Gesture | Required interpretation |
| --- | --- |
| Left single | Place the item/position under the pointer at the top |
| Left double | Place that item/position at the bottom |
| Right single | Move so the current top appears at the pointer |
| Right double | Move so the current bottom appears at the pointer |
| Middle single | Proportional or continuous positioning |
| Middle double | Unused |

Entry is allowed only from the proper side, below the speed threshold, and after
reluctance; high-speed crossing passes through. Exit uses the larger hysteresis
region. If the drawing lock is unavailable during exit, visual cleanup MUST be
deferred without blocking the mouse service.

## Decoration refresh behavior

The construction grammar above defines border and label parsing and their margin
contributions. At refresh time those decorations remain outside client content:
recompute the effective inside rectangle, move retained inside pixels when its origin
changes, clear newly exposed strips, then draw border and label methods in the margin
refresh phase. A label change marks the margin dirty and MUST be repaired even when
saved client bits are reusable. A border or label renderer MUST use the sheet's
prepared raster transaction and MUST leave the client cursor unchanged.

## Menus and choices

### System-window resources

Reusable infrastructure windows are created through a registry keyed by symbolic
type. An entry supplies a creator, whether multiple live instances are permitted, a
reusability/busy predicate, and per-screen instances. A request first reuses an
eligible object on the requested screen. For a busy singleton it either waits or
reports unavailability according to the call; otherwise it creates, reparents to the
screen root, and returns the instance. Unknown types are errors. This registry is the
extension point for Screen Editor, choice windows, inspectors, debuggers, and similar
tools; they MUST NOT be hidden host-global singletons.

### Menu item grammar

A menu item is semantic data, not only a string. The compatibility representation
MUST support:

```text
MenuItem {
  display_label_or_form
  return_value
  action: return | evaluate_form | call_function
  documentation
  font_or_style
  selectable_when_or_restriction
  optional_submenu_or_profile_metadata
}
```

The `TV-46` shorthand expansion is precise:

| Item shape | Display | Selection semantics |
| --- | --- | --- |
| atom | printed/display name | return the atom |
| cons whose cdr is an atom | car as label | return cdr |
| two-element proper list | first element | return second element |
| three-or-more list | first element | interpret operator and argument in the tail |

The defined operators are `:VALUE` (return without evaluation), `:EVAL`, `:FUNCALL`,
`:NO-SELECT`, `:WINDOW-OP`, `:KBD`, and `:MENU` for a submenu. Unknown operators MUST
signal an error rather than degrade to values. A no-side-effects query may inspect
only simple/`:VALUE` cases and MUST NOT evaluate an arbitrary item while asking what
it would do. Item properties include `:FONT`; `TV-303` also supplies per-item
`:DOCUMENTATION`.

Dynamic item lists are recomputed before the operations defined by their class. If a
producer has side effects, permanently caching one result is nonconforming. A new
implementation SHOULD snapshot one list for an active choose transaction and label
that as its evaluation boundary until exact later runtime behavior is measured.

### Geometry and interaction

- The menu computes row/column geometry from its item extents, requested orientation,
  maximum dimensions, label, and margins.
- Moving the pointer into a selectable item highlights it reversibly and publishes
  its documentation. Moving away removes both.
- A selection runs the item's declared action and returns its semantic value. A
  disabled item cannot run and SHOULD give visual or audible feedback.
- A momentary menu saves the covered pixels, holds the necessary temporary locks,
  tracks until selection or cancellation, and restores the exact underlay on exit.
- Leaving a pop-up or using the aborting button cancels without invoking an item.

The system MUST support ordinary momentary choice, command menus, dynamic menus, and
multiple-choice state. `TV-303/T3` MUST also retain the documented multicolumn and
who-line behavior of its maintained implementation.

An ordinary chooser tracks current, last, and chosen items separately. The click that
first exposes an unexposed menu MUST only expose it; it does not also choose an item.
Any button can choose the current item in the basic chooser, with ordinary
double-click/System meanings suppressed inside that transaction. Sparse final
columns MUST use the computed row/column item map so a point cannot select a phantom
grid cell.

A command menu posts a structured `(:MENU item button-data menu)` blip into its I/O
buffer instead of evaluating application work in the mouse process. A multiple menu
toggles ordinary items and uses a distinguished completion item such as **Do It** to
return selected values. A momentary menu must deactivate and restore its underlay
before running the chosen action; deactivation or blocking work runs outside the
mouse process.

### Choice interfaces

A choice item binds a visible label/control to a mutable value and a declared kind,
such as Boolean, one-of, or action. The choice display MUST derive its current mark
from the value, update only after a valid gesture, and run any declared callback after
the model change. Done and Abort have distinct commit semantics when the containing
interface supports a transaction.

The profile includes three related facilities:

- margin choices map labeled boxes in a margin to callbacks; a hit starts the callback
  outside the mouse process and a miss beeps;
- multiple-choice windows retain Boolean values, implication rules, displayed boxes,
  completion choices, a saved pre-invocation snapshot, and a completion/abort result;
  implication propagation follows declaration order and MUST detect an oscillating or
  cyclic conflict in a safe implementation; and
- variable-value forms support Boolean, one-of, numeric, string, Lisp-form, function,
  and action-like descriptors at the selected release boundary. Editing parses into a
  temporary value before assignment; Rubout before any input leaves the model
  unchanged; a parse/type failure reports and retries rather than publishing a
  half-read value.

The modal choice transaction saves the old selected window and values, exposes the
form, loops until Done/Abort/deexposure, and restores selection on every exit. Abort
restores the snapshot and returns no committed choice.

## Scrolling and typeout windows

### Model-based scroll window

A scroll window retains an application display model independent of pixels:

```text
ScrollState {
  display_item_model
  top_item, target_top_item, bottom_item
  screen_image: ordered visible entries with line extents
  truncation_policy
  selected_or_sensitive_items
  optional_typeout_window
}
```

Redisplay walks the model from `top_item`, converts entries into one or more display
lines, records their screen extents, and stops at the inside bottom. A full redisplay
reconstructs the image; an incremental redisplay MAY retain unchanged entries but
MUST invalidate entries whose content, position, font metrics, selection, or window
width changed.

Relative scrolling reuses pixels with BITBLT when safe and draws newly exposed
lines. Absolute scrolling chooses a top item from the requested fraction or item
position. The screen image is a cache, never the authoritative application model.

### Scroll bar

The scroll bar occupies a margin strip. Its thumb/markers derive from the visible
range relative to total items. Pointer movement near the configured strip can engage
scrolling after hysteresis; dragging maps position to an absolute target; button
gestures above or below the thumb request relative movement. The bar MUST erase or
redraw when margins, visible range, total size, or always-visible policy changes.

### Typeout overlay

A typeout window is subordinate transient output for Help, errors, or long command
results. It grows over its superior's inside rectangle, is excluded from ordinary
screen management and mouse selection, and aliases the superior in selection lists.
An owning window can construct the overlay from a flavor/options specification and
MUST resize it while deexposed whenever the owner's inside rectangle changes.
(`typwin.53:L197-L251`; `S46-SRC`, `S46-QF`, `303-SRC`)

The overlay retains at least:

```text
TypeoutState {
  superior
  bottom_reached: pixel_y | null
  incomplete: boolean
  had_mouse: boolean
  sensitive_items: list<{type, object, left, top, right, bottom}>
}
```

First exposure resets `bottom_reached` and marks the overlay incomplete. Any
character/string/line output marks it incomplete. Cursor movement preserves the
greatest vertical extent reached; clear-screen, clear-to-end, refresh without saved
bits, and end-of-page handling mark or invalidate the affected extent. Deexposure
clears the reached extent, and `MAKE-COMPLETE` marks the transient result consumed.
Selecting the owner while incomplete selects the typeout representative; deexposing
that representative returns selection to the superior before its pixels disappear.
(`typwin.53:L295-L341`; `S46-SRC`, `303-SRC`, `TODO-RUNTIME`)

The overlay handles pointer events only over the region actually reached by output.
Outside that region it converts coordinates to the superior, forwards motion or the
button event, and sends one final transition so stale highlighting can be removed.
Crossing into the overlay disables the owner's text blinkers; crossing back restores
them. This is partial-region delegation, not a full-window modal grab.
(`typwin.53:L256-L293`; `S46-SRC`, `TODO-RUNTIME`)

A mouse-sensitive typeout item stores semantic type, application object, and its
rendered rectangle. Refresh, clear, new typeout exposure, and end-of-page transitions
MUST discard regions whose pixels no longer represent that object. Motion highlights
the current item. Left-single posts a structured
`(:TYPEOUT-EXECUTE operation object)` action to the I/O buffer; right-single may
open the type-specific operation menu in another process; right-double invokes the
System Menu. Application work MUST NOT execute in the mouse process.
(`typwin.53:L6-L193`; `S46-SRC`, `303-SRC`, `TODO-RUNTIME`)

`EXPOSE-FOR-TYPEOUT` activates before taking the sheet drawing lock, exposes without
clearing retained output, waits until exposure is real if the superior currently has
no screen array, homes the cursor, and clears only to end of line. This order avoids
the superior/typeout lock inversion documented in `typwin.53:L343-L355`. Removal
either restores saved underlay or requests owner redisplay. Automatic removal on the
next input and explicit More continuation remain class policies, not assumptions of
every typeout window. (`S46-SRC`, `S46-QF`, `TODO-RUNTIME`)

## Frames, panes, and constraint layout

### Frame contract

A frame is a superior window whose inferiors are panes. The frame owns pane geometry,
exposure, and selection. A pane's attempt to expose, deexpose, bury, move, or select
is forwarded through the frame so the frame remains coherent. Selecting a pane
normally selects the frame and records that pane as the frame's current input pane.

A frame MUST expose, deexpose, activate, kill, and restore its panes as one managed
unit. The frame's selection name represents the complete application; panes normally
do not appear as independent System-key programs.

### Pane definitions

A constraint frame maps stable pane names to pane instances. A pane definition
specifies at least a flavor/capability set and initialization options. The frame MUST
support lookup by name, sending an operation to a named pane, and broadcasting to all
or all exposed panes.

### Constraint representation

The layout model is a tree. Interior nodes stack children horizontally or vertically;
leaves refer to panes or whitespace. Named configurations choose a tree and set of
panes; pane substitutions are resolved before calculation. Unknown panes,
substitutions, and configurations MUST fail before visible mutation.
(`S46-SRC`, `303-SRC`)

The historical size language includes:

| Form | Required interpretation |
| --- | --- |
| fixnum | Exact pixels on the stacking axis |
| float | Proportion of the total axis extent passed to this calculation level |
| `:EVEN` | Equal share of the final descriptor group's remaining extent |
| `:FIXED` | For a pane leaf, retain its current extent on the stacking axis |
| `:LIMIT (min max [unit [pane]]) rule` | Prefix another rule with optional lower/upper bounds and optional line/character conversion |
| `:ASK-WINDOW` | Ask the pane for its constraint |
| `:ASK` | Invoke the declared receiver/method with sizing context |
| `:FUNCALL` | Invoke a supplied function |
| `:EVAL` | Evaluate the supplied form in the historical configuration context |
| `:BLANK` | Reserve non-pane space and draw it white, black, or with a supplied function |

Line and character units convert through the pane's current cell dimensions and
margins. Ask callbacks receive remaining extent, total extent, and stacking
orientation. Nested horizontal/vertical nodes change the sizing axis. The parser
MUST reject an unknown special keyword, duplicate/missing pane name, invalid unit or
rounding form, repeated incompatible stacking node, a mixed `:EVEN`/non-even group,
or an `:EVEN` group before the final descriptor group. System 46 recognizes an
`:IF` node shape but its implementation signals that conditional constraints are
not implemented; `TV-46` MUST preserve that bounded failure rather than silently
choose a branch. (`frame.120:L455-L527`, `L551-L717`; `S46-SRC`,
`TODO-RUNTIME`)

The solver MUST:

1. parse names and macros into a validated tree;
2. calculate raw extents in descriptor order, passing current remaining and total
   context to extensible rules;
3. calculate the final `:EVEN` group from the remaining extent;
4. round line/character constraints to whole cells and add margins;
5. apply declared minima and maxima in the source-defined rounding phase;
6. assign cumulative positions on the stacking axis and the full available size on
   the cross axis; and
7. verify that every configured pane accepts its candidate edges.

Configuration application is a two-phase transaction:

```text
set_configuration(name):
  resolve and parse name, panes, substitutions, and constraint tree
  calculate all candidate extents and positions without changing pane edges
  ask every pane to verify its complete candidate rectangle
  if any pane rejects: return its reason or "Not all panes fit"; mutate nothing
  deexpose panes belonging to the old configuration as required
  commit every accepted edge
  draw configured blank regions
  expose the new configuration's panes in configuration order
  reread or invalidate cached positions
```

Verification stops at the first rejection, but no earlier pane may retain candidate
geometry. A frame resize performs recomputation while its panes are deexposed so a
half-old/half-new layout is never visible. Blank nodes consume exact layout extent
but never become panes. (`S46-SRC`, `303-SRC`, `INFERRED`, `TODO-RUNTIME`)
The calculation, rounding, and positioning paths are
`frame.120:L719-L876`; configuration verification/application is
`frame.120:L260-L452`.

`TV-303/T3` MUST permit named configurations and runtime configuration changes. A
change invalidates current constraint positions, recomputes all pane edges, exposes
the configured panes, and deexposes panes not in the new configuration. System 303
integrates the frame's selected pane with the general selection-substitute mechanism;
System 46 uses the earlier frame-selected-pane forwarding. Both MUST remain one
selection team.

## System Menu and program selection

The complete user-facing inventories and release differences are specified in
[System Menu and program selection](system-menu-and-select.md). The reconstruction
contract is:

- Right-button invocation creates a temporary menu at the pointer and retains the
  window originally under the pointer as the target of “this window” operations.
- `TV-46` provides the eight-item main page and seven-item Other page described in
  that dossier.
- `TV-303` provides the observed Windows, This window, and Programs columns. Its
  program column is mutable at run time.
- The pointer menu registry, System-key registry, and recent-window array are three
  distinct data structures.
- System-key selection cycles existing instances by registered kind and can have a
  separate creation path. Control-System requests creation in `TV-303`; Help reports
  the live effective registry.
- Recent-window commands prune dead/unselectable entries and preserve typeahead at
  the old window during the focus change.
- Saved screen layouts retain live window references, exposure/order, geometry, and
  selection. They are not serialized desktops or VM snapshots.

![The live System 303 three-column System Menu over the Lisp Listener, with window-management operations and pointer documentation.](../assets/mit-cadr-screenshots/system-menu.png)

> Runtime observation: the preserved `System 303-0` band displayed this exact
> temporary menu after a right click in the Listener. The
> [curated asset catalog](../assets/mit-cadr-screenshots/index.md) records session,
> input, image hashes, and the image-specific copyright basis. This bounded
> scholarly image establishes visible integration and popup removal, not
> bit-identical underlay restoration or any destructive command path.

## Notifications and interesting windows

Notifications are delivered through the selected window/team, not through an
unrelated host-global toast layer. A selected window supplies a notification stream
or printing policy, and a frame forwards that policy to its current representative
pane. (`S46-SRC`, `303-SRC`, `MIT-MAN`)

The system maintains an **interesting-window** registry for background windows that
want attention. System 46 uses a unique window list; System 303 uses an alist capable
of retaining associated notification state. Repeated attention for one window MUST
not create duplicate registry entries. Selecting or deactivating the window removes
its entry, and Terminal 0 S selects an eligible interesting window. Dead or
deactivated entries MUST be pruned. Registry order follows the selected release; a
new implementation MUST NOT claim chronological ordering without evidence.
(`basstr.163:L760-L810`; `window/basstr.lisp:L1684-L1760`; `S46-SRC`,
`303-SRC`, `MIT-MAN`, `TODO-RUNTIME`)

A process that first requests terminal I/O without an ordinary terminal lazily
acquires a background Lisp interactor. The system labels and associates it with that
process, clears and activates it, rings the bell, marks it interesting, and dispatches
the pending stream operation. Merely creating a process MUST NOT allocate or expose
this window. (`S46-SRC`, `S46-QF`, `TODO-RUNTIME`)

The notification transaction is:

1. if an error's target is already exposed, suppress a redundant general
   notification;
2. otherwise wait until a selected window/team exists;
3. obtain that team's notification stream;
4. ring the bell and print the short bracketed notification; and
5. for a hidden error target, permit the originating process to wait until that
   target is selected for attention.

A window's deexposed-typein policy can request `:NOTIFY`, turning attempted
background input into interesting-window state instead of consuming unrelated
keyboard input. Exact flavor defaults and user-visible wording remain
`TODO-RUNTIME`; the routing and lifecycle above are source/manual requirements.
(`basstr.163:L814-L895`; `S46-SRC`, `303-SRC`, `MIT-MAN`,
`TODO-RUNTIME`)

## Who line

The apparent two-line who line is a separate screen, even when a host compositor
presents one framebuffer. Main-screen windows cannot overlap it and the pointer
cannot enter its coordinate space. The first row displays contextual mouse
documentation. The second displays time, login/user state, the effective process's
package and run state, and file or network activity. The documentation row and each
status field are separate windows. (`S46-SRC`, `303-SRC`, `MIT-MAN`)

Each field retains an update function, prior logical state, and horizontal extent.
Periodic or event-driven update recomputes it and redraws only when the logical value
changed. Updating is deferred while globally inhibited, while its lock is held, or
while output is blocked; a run-state-only pass need not redraw time, user, or file
fields. A host implementation MAY schedule differently, but MUST preserve field
independence and state-based redraw suppression. (`S46-SRC`, `303-SRC`, `MIT-MAN`,
`TODO-RUNTIME`; `tvdefs.181:L328-L340`, `shwarm.162:L949-L1067`)

Mouse documentation resolves in this order:

1. explicit `WHO-LINE-MOUSE-GRABBED-DOCUMENTATION` during a grab or modal phase;
2. `:WHO-LINE-DOCUMENTATION-STRING` from the deepest current window and semantic
   item under the pointer; and
3. the release's default or blank string.

Changing only the current menu/typeout/scroll item MUST invalidate this field. The
live System 303 System Menu and Screen Editor captures confirm item-dependent
documentation for **Attributes** and **Reshape**. They do not establish every
modifier or grabbed-documentation transition. (`303-RUN`, `TODO-RUNTIME`)

Package and run state normally describe the process returned by `:PROCESS` from the
selected window after frame/substitute resolution. A non-`NIL` `WHO-LINE-PROCESS`
pins another process across selection changes; `LAST-WHO-LINE-PROCESS` records the
most recently described process, including `NIL` when none exists. Run state derives
from Lisp Machine process status, run reasons, and wait state, not merely host-thread
liveness. (`S46-SRC`, `303-SRC`, `MIT-MAN`, `TODO-RUNTIME`)

The file/network field maintains separate registries of open streams and active
servers. Streams supply their short pathname through the historical who-line string
operation; server connection closure removes its entry. These registries are not the
notification/interesting-window registry. (`303-SRC`, `MIT-MAN`, `TODO-RUNTIME`)

At T2, a conforming implementation MUST supply the separate screen boundary,
pointer documentation, selected-process package/run state, and per-field cache. At
T4 it MUST also support process pinning and file/server lifecycle operations.

## Color screen profile

Color is a screen capability inside TV, not a second window system. Geometry,
selection, exposure, menus, frames, temporary windows, and stream protocols remain
unchanged; raster operations apply to all pixel bits. (`S46-SRC`, `303-SRC`,
`MIT-MAN`)

The standard CADR color-screen profile is 576 by 454 pixels, four bits per pixel,
with sixteen simultaneously addressable palette indices. Each palette entry stores
eight-bit red, green, and blue intensity. A `TV-46` or `TV-303` implementation that
claims the color option MUST expose those logical dimensions/depth and an indexed
color map, even if host display hardware uses true color. (`S46-SRC`, `303-SRC`,
`MIT-MAN`; `color.33:L223-L249`, `window/color.lisp:L267-L301`)

The CADR hardware does not provide reliable palette readback. The implementation
therefore keeps a sixteen-by-three byte shadow array and routes ordinary color-map
writes through an API that updates both hardware and shadow. A synchronized write
waits for retrace to avoid a visible glitch. The immediate form is valid only when
the caller already knows it is in vertical retrace. Bulk installation precomputes
the hardware writes, updates the shadow, and synchronizes the transfer. A host
backend MAY replace XBUS operations with an atomic palette call, but MUST preserve
the logical shadow and ordering. (`S46-SRC`, `303-SRC`, `TODO-RUNTIME`;
`color.33:L87-L220`, `window/color.lisp:L115-L190`)

The color screen object exists as profile state even when hardware is absent, but it
MUST NOT expose as a usable physical screen. System 46 conditionally adds a Color
Window entry to its auxiliary menu; System 303 conditionally adds it to the Windows
column. Color font parsing converts or selects compatible raster fonts; this does not
introduce vector fonts. (`S46-SRC`, `303-SRC`)

The current `System 303-0` harness run is monochrome. No palette timing, color
temporary-window restoration, or four-bit ALU claim is labeled `303-RUN`; those
remain `TODO-RUNTIME` or emulator-unit-test work.

## Screen Manager and Screen Editor integration

The screen manager maintains priority/order policy beyond raw exposure. A sheet can
request automatic exposure, deexposed visibility handling, restoration of uncovered
rectangles, and ordering. Batching screen changes MUST end with one reconciliation.

The Screen Editor operates on this live tree rather than a copied layout model. Its
command set, edge transaction model, validation, and one-level imperfect Undo are
specified in [Screen Editor and Frame-Up](../screen-editor-and-frame-up.md). A
`TV-303/T4` implementation MUST expose enough protocols for that tool to enumerate
active inferiors, inspect/set edges, expose/bury, create/kill, expand, and edit
attributes without bypassing frame ownership.

![The live System 303 Screen Editor command menu over the Lisp Listener; the pointer is on Reshape and its documentation appears in the who line.](../assets/mit-cadr-screenshots/screen-editor-menu.png)

> Runtime observation: session `layout-tools-20260718` displayed the complete
> 15-item System 303 Screen Editor menu and item-specific **Reshape** documentation.
> The researcher exited without changing window geometry. This reviewed image
> confirms the visible menu inventory and documentation path, not reshape, Undo,
> constraint verification, or destructive commands. Its PNG SHA-256 is
> `87cb86efce54505176e82157a09aab6a0ba693359012afefc02f33e01c525c6e`;
> complete copyright basis and portable provenance are in the
> [curated asset catalog](../assets/mit-cadr-screenshots/index.md).

## Boot and initialization order

The `TV-303` system declaration loads definitions before the operational modules. The
behavioral dependency order is:

```text
TV definitions
  -> screen manager and screen/sheet core
  -> drawing, blinkers, and warm display operations
  -> base windows and who line
  -> mouse and base streams
  -> stream adapter, graphics, and menus
  -> combined methods
  -> System Menu, Screen Editor, typeout, scrolling, frames, choices
  -> application windows
```

No application window may be created before the required base combined methods are
installed. Startup MUST create the physical screen, who line, mouse process/blinker,
initial selectable Listener, selection/input routing, and screen-management state in
an order that never sends input to an uninitialized buffer.

## Release-specific deltas

The following are normative profile differences, not optional presentation choices:

| Facility | `TV-46` | `TV-303` |
| --- | --- | --- |
| System declaration | Monolithic `TV` module list in the System 46 system source | Maintained `DEFSYSTEM TV` with the later module set in `sys/sysdcl.lisp` |
| Deexposed priority comparison | NIL-versus-numeric branch repeats `PRI-S1` and is defective | Corrected branch tests `PRI-S2`; stable sort is explicit |
| System Menu | Main menu plus Other submenu | Observed three-column Windows / This window / Programs menu |
| Reset/Kill confirmation | Source paths do not contain the later pointer confirmations | Maintained paths confirm before destructive action |
| System-key table | Static core alist with subsystem additions | Mutable add/remove registry, duplicate suppression in Help, explicit creation path |
| Screen Editor | 13 operation entries | 15 operations, adding Create (expand) and Attributes |
| Window attributes | No later fixed attribute form | Fixed variable-value attribute editor in the inspected maintained source |
| Frame representative | Dedicated selected-pane forwarding | General selection-substitute mechanism |
| Interesting windows | Unique window list | Alist capable of associated notification state |
| Color menu entry | Conditional auxiliary-menu entry | Conditional Windows-column entry |
| Multiple screens and restoration | Present in evolving form | Maintained code expands all-screen selection and management behavior |

More differences MAY be added only with exact source or runtime evidence. A dual
implementation MUST select them as a coherent profile.

## Cross-subsystem transaction order

These integration rules are normative even when individual services pass isolated
tests:

1. **Selection before key eligibility.** Install the new process/I/O-buffer
   association within the selection transaction before global keyboard input can
   drain to it.
2. **Old typeahead before target switch.** Transfer already typed ordinary input to
   the old selected buffer before a System or Terminal command selects another
   target.
3. **Mouse work outside the overseer.** Selection, callbacks, menu actions, and
   potentially blocking application work run in another process or enter a structured
   I/O blip.
4. **Final motion before ownership exit.** The old mouse handler receives the motion
   needed to remove highlight/feedback before jurisdiction changes.
5. **All overlap locks before saved-under pixels.** Temporary exposure acquires the
   complete compatible lock set before copying or drawing any part of the popup.
6. **Restore popup before its action.** A momentary menu deactivates and restores the
   target before invoking code that may inspect or draw that target.
7. **Constraint verification before pane mutation.** Every pane accepts candidate
   edges before any pane retains them.
8. **Screen Editor menu removal before state capture.** `TV-303` deactivates its
   transient command menu before reading the live screen state to edit.
9. **Parse before value assignment.** A choice/value form publishes a new value only
   after parsing and type validation succeed.
10. **Notification through the selected team.** Bell and text destination resolve
    through the effective selected frame/pane policy.
11. **Who-line process after substitute resolution.** Package/run state follows the
    effective selected pane unless explicitly pinned.
12. **Semantic hit-map invalidation with pixels.** Scroll and typeout item regions
    are invalidated in the same transition that clears, moves, or replaces their
    rendered pixels.

These rules are synthesized from method/wrapper order across the public sources
(`S46-SRC`, `303-SRC`, `INFERRED`). Existing `303-RUN` images confirm only menu
appearance/removal and item documentation. Queue order, lock order, verification
rollback, notification routing, and hit-map invalidation remain `TODO-RUNTIME`.

## Failure semantics and defensive requirements

A compatible reconstruction MUST detect and report at least:

- exposing a deactivated sheet;
- exposing or moving outside the superior;
- invalid or nonpositive sheet extent, and operation extents outside the explicitly
  signed internal move contract;
- impossible margins or frame constraints;
- an unknown expose/refresh bits action;
- drawing through a missing/stale raster mapping;
- releasing a lock not owned by the caller;
- an input-buffer overflow attempt;
- a menu action on a disabled or vanished item;
- selecting or operating on a killed window;
- changing a pane geometry behind its frame;
- failure to acquire every required temporary lock;
- an invalid priority or an explicitly selected strict-priority-bug comparison
  failure;
- an unknown pane/configuration, malformed constraint group, unsupported System 46
  conditional constraint, or pane rejection;
- a selection-substitute cycle in a safety-corrected implementation;
- a typeout hit region whose rendered pixels were invalidated; and
- a color-map operation outside its index/channel or synchronization contract.

An error MUST leave hierarchy membership, exposure ordering, saved pixels, locks, and
selection in a coherent state. Destructive UI operations SHOULD request confirmation
where the chosen release profile does. Host exceptions MUST be translated into a
window-system condition or safe debugger path rather than abandoning a visible
temporary window with its underlay locked.

## Reference protocol inventory

This inventory names the compatibility surface by behavior. It is intentionally more
stable than an exhaustive list of private helper functions.

| Protocol family | Required operations |
| --- | --- |
| Identity and hierarchy | name, superior, inferiors, exposed inferiors, ancestry, screen, active/exposed predicates |
| Geometry | size, inside size, margins, edges, set edges, set position, set superior, verify edges, coordinate translation |
| Lifecycle | init, activate, deactivate, expose, deexpose, bury, refresh, kill |
| Raster | screen array, prepare/access, draw point/line/rectangle/character, BITBLT, clear, save/restore bits |
| Text stream | TYO/TYI, string/line output, cursor, insert/delete, More processing, rubout handler, notify/beep |
| Input | I/O buffer access, listen, no-hang, untyi, clear/force input, selected input buffer |
| Selection/process | selection name/kind, select/deselect, mouse-select, process/stack group, reset/arrest/kill |
| Mouse | handle, moves, buttons, sensitive item, cursor/blinker, seize/release, scroll-bar behavior, documentation |
| Decorations | borders, label, margin refresh, reverse video, font map |
| Screen management | order inferiors, damaged/uncovered area, autoexpose, restore area, delayed reconciliation |
| Frame | pane lookup/name, select pane, create pane, configuration lookup/set/redefine, layout recomputation |
| Menu/choice | set item list, compute geometry, choose, execute item, multiple choice, dynamic refresh |
| Scroll/typeout | display model, redisplay, position, relative/absolute scroll, item lookup/mutation, partial-region forwarding, completeness, typeout removal |
| Attention/status | notification stream, interesting-window lifecycle, who-line documentation/process pin, file/server fields |
| Indexed color | bits per pixel, color-map shadow, synchronized/immediate palette write, compatible raster-font parsing |

Private compatibility users that depend on a specific method name can be supported by
a thin symbol/message adapter over these operations.

## Conformance test suite

Each test records the release profile, pixel depth, input sequence, logical event
trace, final model state, and framebuffer hash or region comparison when applicable.
Timing tests use ranges because the historical scheduler and a modern event loop need
not have identical instruction timing.

### T0 raster tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `TV-R01` | Half-open rectangle | Only pixels inside `[l,r) × [t,b)` change |
| `TV-R02` | Established Boolean ALUs | `SETA`, `IOR`, `XOR`, `ANDCA`, and `SETZ` match every one-bit source/destination pair; any advertised extension names its extra truth tables and depth semantics |
| `TV-R03` | Overlapping BITBLT in four directions | Result equals copying from an immutable pre-operation source |
| `TV-R04` | Rectangle clip at every inside edge | No margin, sibling, or host pixel changes; a wholly clipped or nonpositive post-clip operation invokes no primitive |
| `TV-R05` | Line endpoint control | Default `:DRAW-LINE` includes its terminal point, explicit false omits it, and every `:DRAW-LINES` segment uses the false path; exact octant tie breaking and reversal pixel equality do not gate conformance until a runtime or readable-microcode oracle closes the TODO |
| `TV-R06` | Variable-width/kerned text | Cursor and pixels match font metrics and baseline alignment |
| `TV-R07` | Reverse video | Character and erase operations exchange foreground/background behavior without changing text metrics |
| `TV-R08` | Missing glyph | Profile fallback occurs without out-of-bounds raster access |
| `TV-R09` | Four-bit indexed color | All 16 indices survive draw/BITBLT/save/restore and map through the software palette shadow |
| `TV-R10` | Runtime negative-origin vector | On a sheet whose inside origin is `(2,2)`, `(40,30,-20,-10)` changes exactly physical `[2,22) × [2,22)`; applying XOR twice restores the region exactly |
| `TV-R11` | Profile clipping boundary | `TV-46` preserves or explicitly fences the partially checked BITBLT/pixel API; for nonnegative dimensions `TV-303` clips the common translated source/destination intersection on all four sides, and a zero post-clip extent invokes no primitive; negative `BITBLT-CLIPPED` dimensions are outside the historical public contract and are not required to signal |
| `TV-R12` | Signed low-level overlap move | Every sign/direction combination used by margin and reshape moves equals an immutable-source copy and leaves exterior pixels untouched |

### T1 sheet and stream tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `TV-S01` | Activate/deactivate idempotence | Membership has no duplicates; deactivate removes exposure first |
| `TV-S02` | Illegal exposure | A deactivated or out-of-bounds sheet fails with no state/pixel change |
| `TV-S03` | Ordinary overlap | Exposing an overlapping sibling deexposes the prior one and preserves ordering |
| `TV-S04` | Saved bits | A backed sheet retains exact contents across cover/deexpose/re-expose |
| `TV-S05` | Redisplay without backing | Re-exposure invokes complete application refresh rather than showing foreign pixels |
| `TV-S06` | Temporary underlay | A momentary sheet restores the exact pre-exposure pixels on normal exit and abort |
| `TV-S07` | Temporary lock rollback | Failure to acquire one overlap lock releases every earlier acquisition |
| `TV-S08` | Blinker-safe typeout | Drawing through the cursor region leaves text correct and one final cursor phase only |
| `TV-S09` | Cursor controls | Return, line feed, CRLF, tab, backspace, home, insert, and delete match profile rules |
| `TV-S10` | More processing | Crossing the penultimate-line threshold prompts once in font zero; ordinary, hold/stop, and permitted-timeout inputs take their profile paths; prompt erasure restores X and surrounding pixels; the returned input and rearmed state match the transaction |
| `TV-S11` | Deexposed output matrix | `:NORMAL`, `:ERROR`, `:PERMIT`, `:EXPOSE`, custom, and unknown actions take distinct `TV-46` paths without stale writes; `TV-303 :NOTIFY` sends the output notice before the common wait, while an actual `:PERMIT` attempt clears hold only when backing exists |
| `TV-S12` | Reparent subtree | Geometry, device stride, active membership, exposure, and locks remain coherent |
| `TV-S13` | Recursive normal lock | Owner recursion and final release work; non-owner release fails safely |
| `TV-S14` | Circular input buffer | Empty/full boundary, wraparound, hooks, no-hang, and non-overwrite behavior match the contract |
| `TV-S15` | Priority classes | Exposed and equal-priority stability, numeric order, NIL comparison, and bury-within-class match the chosen release behavior |
| `TV-S16` | Damage queue coalescing | Contained regions collapse; disjoint same-sheet regions share one reconciliation transaction |
| `TV-S17` | Locked damage entry | One locked sheet is skipped and retried without delaying an independently serviceable sheet |
| `TV-S18` | Font-map and output equivalence | One-, two-, and 26-entry font maps normalize by repeat-last; baseline and line height use the mapped maxima; NIL existence means all present; wide-glyph terminal indexing, kerned raster extent, and independent advance are honored; repeated `TYO` and `STRING-OUT` finish equivalently, while no cursor assertion is made after `SHEET-LINE-OUT` |
| `TV-S19` | Ordered construction | Delayed screen management surrounds init, saved-backing complete refresh, activation, and optional exposure in that order with profile defaults installed first; a nonempty accumulated queue flushes once as a batch, while an empty queue causes no invented reconciliation |
| `TV-S20` | Size deduction | Origin+opposite-edge+size combinations follow precedence; a right/bottom without size bounds the extent; `TV-46` CR-counted string height and unclamped string dimensions differ from `TV-303` motion-measured/clamped dimensions; `TV-303 :EDGES` overrides prior/default size and rejects only its established nonpositive case; redundant fields are not generically rejected |
| `TV-S21` | Margin, border, and label mutation | Retained client pixels and relative cursor survive margin movement; zero-width `TV-303` sides canonicalize to `:ZERO`, draw nothing, but retain extra margin; multiline/centered/boxed labels reserve measured space and never move the client cursor |
| `TV-S22` | Packed exception priority | Simultaneous hold, end-page, and More bits dispatch in hold/end-page/More order; a residual unknown state signals only after the established handlers and leaves pixels coherent |
| `TV-S23` | Resize failure policy | A strict `TV-46` failure profile exposes the documented erase/mutate-before-late-work ordering; a declared safety-corrected profile stages or restores the change and is labeled `INFERRED`; neither result is attributed to the other profile |

### T2 interaction tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `TV-I01` | Selection transaction | Old typeahead stays with old window; new focus, process, blinkers, recency, and who line update together |
| `TV-I02` | Selected subtree deexposure | Selection leaves the disappearing subtree before pixels are reclaimed |
| `TV-I03` | Mouse hit test | Deepest eligible exposed sheet receives local coordinates in correct stacking order |
| `TV-I04` | Mouse seize/release | Seized owner receives events; release immediately recomputes ordinary owner |
| `TV-I05` | Cover current mouse target | Temporary exposure forces leave/reconsideration before coverage |
| `TV-I06` | Sensitive documentation | Enter/move/modifier/leave changes highlight and who-line text without residue |
| `TV-I07` | Border/margin redefinition | Inside pixels move correctly; new strips clear; label/border repaint |
| `TV-I08` | Process reset/arrest | Operation targets the window under the menu and leaves the manager responsive |
| `TV-I09` | Interesting-window lifecycle | Repeated notification is unique; select/deactivate prunes; Terminal 0 S chooses the eligible target |
| `TV-I10` | Who-line precedence and pin | Grabbed/item/default documentation and selected/pinned process state resolve in the specified order |

### T3 reusable-family tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `TV-U01` | Menu item expansion | String and structured items display, document, return, call, and disable correctly |
| `TV-U02` | Momentary menu cancel | Moving out or aborting runs no item and restores exact underlay |
| `TV-U03` | Dynamic menu | Recomputed list changes geometry and hit regions without stale selection |
| `TV-U04` | Multiple choice | Marks reflect model values and callbacks occur only after valid changes |
| `TV-U05` | Scroll full redisplay | Screen-image entries exactly cover the rendered visible model range |
| `TV-U06` | Incremental scroll | Reused pixels equal a full redraw and exposed lines are newly rendered |
| `TV-U07` | Scroll bar mapping | Relative and absolute gestures reach correct model targets and update thumb |
| `TV-U08` | Typeout overlay | Removal restores or redisplays owner with no locked or stale region |
| `TV-U09` | Frame selection | Selecting a pane selects its frame and the configured pane, not an independent top-level program |
| `TV-U10` | Constraint minima/maxima | Solver distributes exact parent size and rejects impossible trees atomically |
| `TV-U11` | Constraint rounding | Child edges are contiguous with no gaps/overlap and final edge equals parent edge |
| `TV-U12` | Configuration change | Correct panes expose/deexpose and all names/edges remain valid |
| `TV-U13` | Constraint rejection transaction | A rejecting pane leaves every pane at its prior edges and returns the source-defined failure reason |
| `TV-U14` | Typeout partial ownership | Written extent receives item interaction; lower area forwards with converted coordinates and no stale highlight |
| `TV-U15` | Choice parse/abort | Parse failure and first Rubout do not assign; deexposure restores snapshot and previous selection |

### T4 environment tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `TV-E01` | System Menu invocation | Correct profile menu appears at pointer and retains original target window |
| `TV-E02` | Live System Help | Output reflects the effective mutable/static registry, not a hard-coded application list |
| `TV-E03` | System-key cycling | Repeated selection cycles matching existing instances; creation policy remains separate |
| `TV-E04` | Recent-window rotation | Dead entries prune and positive, negative, zero, and exposed-window variants follow profile rules |
| `TV-E05` | Saved layout | Restores live objects, geometry, exposure order, and selection; killed objects are not fabricated |
| `TV-E06` | Delayed screen management | A batch produces the same final pixels/tree as immediate reconciliation without intermediate corruption |
| `TV-E07` | Screen Editor protocol | Every non-destructive command operates through live window/frame protocols and one-level Undo limitations match the profile |
| `TV-E08` | Multiple screens | Mouse-screen selection, hit testing, screen-local coordinates, and all-screen selection remain distinct |
| `TV-E09` | Priority autoexposure | Uncovered candidates expose in corrected priority order; priority -1 does not; no-selection fallback is bounded |
| `TV-E10` | Notification destination | Selected frame/pane supplies the stream; a hidden error target enters the attention path without a host-global substitute |

## Preserved-system comparison procedure

Use the [CADR computer-use harness](cadr-computer-use-harness.md) with a fresh named
session. A comparison run MUST retain the identities required by that harness guide,
including band and disk hashes, public and private source revisions, private tree and
machine-artifact hashes, start-time and execution-time emulator hashes, toolchain,
ordered actions, screenshot/pixel hashes, and shutdown state.

Safe probes SHOULD use researcher-created windows and data. Tests that kill, reset,
reshape, or arrest shared system windows require an expendable private session.
System 46 visible tests remain `TODO-RUNTIME` until a compatible band is available.

### Focused System 303 sheet-core observation

The named harness session `tv-core-spec-20260718`, generation 1, exercised a
researcher-entered rectangle operation in `System 303-0`. The selected live Lisp
Listener reported outer edges `(0 0 768 939)`, inside edges `(2 2 766 925)`, selected
status, saved bits enabled, `exposed-p=T`, output-hold zero, and one following
rectangular blinker. These values describe that object at the observation instant,
not class defaults. (`303-RUN`)

The exact input operation was issued twice:

```lisp
(send tv:selected-window ':draw-rectangle 40 30 -20 -10 tv:alu-xor)
```

Because the listener inside origin was physical `(2,2)`, inside clipping predicts a
20 by 20 intersection at half-open physical rectangle `[2,22) × [2,22)`. Comparing
the pre-operation and first-operation captures found exactly 400 changed pixels,
with inclusive changed bounds `(2,2)` through `(21,21)`. Comparing the top-left 40
by 40 region before the first XOR and after the second found zero changed pixels.
The running band therefore confirms negative-origin inside clipping and reversible
XOR for `:DRAW-RECTANGLE`; it does not by itself confirm generic BITBLT clipping or
the complete ALU space. (`303-RUN`)

Portable session provenance:

| Field | Value |
| --- | --- |
| Load band and base/private disk SHA-256 at start | `System 303-0`; `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` |
| Public revisions at start | `chaos=db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e`; `l=d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6`; `system=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; `usim=330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`; `usite=8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e` |
| Private copy-time revisions | `chaos=db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e`; `system=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; `usite=8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e` |
| Private copied tree SHA-256 | `chaos=34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87`; `system=21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`; `usite=adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81` |
| Emulator SHA-256 at start and execution | `707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be` for both |
| Private machine artifacts SHA-256 | `promh.mcr=2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6`; `promh.sym=e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d`; `ucadr.sym=9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec` |
| Capture hashes, PNG / pixels | pre-XOR `f5b5bfc6ec830ab227c843d72e05714f60a37f35758122d94735734b5638cf5d` / `13bf175f424b506c52b8512f3453cc51d57f1c9aeada040888a876c42868079d`; clipped `8ea2d452542bb1d513a4562bbeea5eee42286113d3893d326ea09227338d84d5` / `da86e0ad00fcc4a7540afc1bf2a53c77e9f977dd62e7abfa8044bca8757fe0dc`; restored `ddbc94e5a5ba262942ed05a43226a38464d45bb6913d34ad49661cb94b56ec50` / `831578d70fb1422c1d6e1fd6e8c347ff6ec53d0b583e5b39e1dee4594e3307c2` |
| Shutdown | `usim_exit_status=0`; `forced_stop=false`; `state_may_be_incomplete=false`; base disk unchanged |

The focused input sequence recovered the Listener with Abort, queried the selected
window and its source associations, recorded the pre-XOR state, issued the two
identical operations, and stopped cleanly. Raw captures remain in the ignored
session tree and are not linked or published here because intermediate date/error
states are not needed for the scholarly claim.

Live `:SOURCE-FILE-NAME` properties associated key callable TV definitions with
logical source areas `SYS: WINDOW; SHEET` and `SHWARM`; the pathname version queried
as `:UNSPECIFIC`. This proves resident callable behavior plus a source-area
association. It does **not** identify the compiled source revision or show that the
band was built from the pinned Fossil checkout. The session did not query
`TYPEP`/`COMPILED-FUNCTION-P` on symbol functions, method functions, or combined
Flavor methods, so it also makes no compiled-function-object representation claim.

## System 303 runtime closure probes

The following 15 probes close source-derived interaction requirements without using
operational or licensed payloads as tracked test fixtures. Each probe remains
`TODO-RUNTIME` until a named harness run records both screen evidence and semantic
state. Existing screenshots provide the stated visible baselines only.

| Probe | Safe live setup and action | Required observation | Requirements closed |
| --- | --- | --- | --- |
| `P0` priority/damage | Create overlapping disposable windows with `NIL`, negative, and positive priorities; bury, deexpose, dirty saved bits, and briefly hold one sheet lock | Stable priority classes, corrected NIL behavior, autoexposure, saved-bit restoration, and independent queue progress | priority comparator, bury, damage coalescing, lock retry |
| `P1` keyboard/typeahead | Create two disposable Lisp Listeners; type ordinary text followed immediately by a System selector; inspect both input streams | Text remains with the old Listener; prefix/suffix are not application text | selected-buffer gate, typeahead transfer, prefix ordering |
| `P2` MRU | Create/select A, B, C; deactivate B; use previous/Terminal rotations in both directions | Exact eligibility, pruning, fallback, and rotation order | MRU and recent-window semantics |
| `P3` process/who line | Put one disposable Listener process into a named wait; switch windows and pin/unpin the who-line process | Package/run-state follows effective selection, then the pin, then selection again | process association, who-line pin/cache |
| `P4` nested mouse | Create a parent/child handler pair; cross child, parent, clipped edge, and another inferior | Deepest owner, local coordinates, final cleanup motion, and documentation precedence | hit testing, ownership exit, who-line item resolution |
| `P5` hysteresis/menu | Open a disposable momentary menu; move just inside and outside the 25-pixel halo | Retention, dismissal, pointer warp, and restored underlay | mouse hysteresis and momentary-menu exit |
| `P6` scroll bar | Populate a numbered text-scroll window; perform all six button/double-click variants with slow and fast entry | Exact top/bottom/proportional targets, unused gesture, entry reluctance, deferred cleanup | scroll protocol and mouse thresholds |
| `P7` menu grammar | Build a safe menu whose operators append symbols to a private log and post one command blip | Every item form/operator, expose-only first click, sparse hit map, dynamic reevaluation, and exact blip | menu grammar and execution |
| `P8` temporary pixels | Render a researcher-created pattern; hash the rectangle; show/dismiss nested popups with one induced lock conflict | All-or-none locks and bit-identical restoration at each nesting level | temporary exposure/deexposure transaction |
| `P9` constraints | Create a disposable fixed/proportional/even frame with one pane that rejects a candidate; resize and switch configuration | Raw/rounded extents, complete preflight rollback, blank extent, and commit/expose order | constraint grammar and two-phase transaction |
| `P10` choices | Use disposable multiple-choice and value forms; test implications, conflicting rules, bad number, first Rubout, and deexposure | Deterministic propagation, retry without assignment, abort snapshot, and selection restoration | choice transaction and parsing |
| `P11` typeout | Produce partial mouse-sensitive typeout over a test pane; move/click above and below `bottom_reached`; complete and output again | Partial-region forwarding, exact execute blip, invalidation, completeness, and blinker transfer | typeout overlay state machine |
| `P12` notifications | Have a disposable background process write/request input through a hidden window, repeat, then select/deactivate it | Lazy one-time interactor, unique interesting entry, bell/text routing, and lifecycle removal | notification and interesting-window semantics |
| `P13` Screen Editor | In an expendable generation, move and Undo a disposable test window and reject one reshape, then exit | Menu deactivates before snapshot, edge rollback, one-level Undo limits, and selection restoration | Screen Editor transaction; the 15-item menu is already a `303-RUN` baseline |
| `P14` color | Only when an emulated color device is available: create a color window, cycle all indices, cover it with a temporary window, and restore | Four-bit pixels, shadow palette, menu registration, ALU preservation, and restored color indices | color profile; otherwise emulator-unit-test only |

For queue, lock, and process assertions, a screenshot is insufficient. The probe MUST
also print or inspect a compact researcher-created event/state trace. Raw captures
remain under ignored `build/cadr-computer-use/`; only a minimum reviewed screenshot
needed for substantive documentation may enter the curated asset tree.

## Known unknowns and required follow-up

- Closed runtime point: System 303 inside-relative negative-origin rectangle clipping
  and double-XOR restoration are now exact 400-pixel observations, as recorded
  above. Generic BITBLT and pixel accessor clipping remain separate claims.
- `TODO-RUNTIME`: compare the exact System 303 line walker, overlapping and signed
  BITBLT edge cases, robust source/destination clipping, tab stops, and More prompt
  control characters against small synthetic live windows rather than only
  integrated application output.
- `TODO-RUNTIME`: exercise persistent save-bits and no-save-bits siblings with
  controlled pixel patterns and verify restoration hashes.
- `TODO-RUNTIME`: exercise each deexposed-typeout action without operational data.
- `TODO-RUNTIME`: compare all scroll-bar buttons, hysteresis thresholds, and absolute
  mapping with a synthetic list.
- `TODO-RUNTIME`: exercise constraint rounding at minimum, maximum, odd remainder,
  and impossible sizes in a researcher-created frame.
- `TODO-RUNTIME`: determine whether the System 303 band ever exercises the corrected
  NIL-versus-numeric priority branch differently from its maintained source.
- `TODO-RUNTIME`: exercise typeout `bottom_reached`, incomplete/complete selection,
  semantic-item invalidation, and forwarding outside the written extent.
- `TODO-RUNTIME`: exercise background-interactor allocation, duplicate notification,
  Terminal 0 S, and hidden-error wait behavior; exact bell/text wording is not yet a
  runtime claim.
- `TODO-RUNTIME`: measure who-line field refresh cadence, process pinning, and
  file/server field arbitration independently of the already observed item
  documentation.
- `TODO-RUNTIME`: no current run exposes CADR color hardware; palette retrace and
  four-bit temporary restoration remain source/manual or emulator-unit evidence.
- `TODO-RUNTIME`: obtain and run a compatible System 46 load band before making any
  System 46 pixel or timing claim.
- Except for the bounded `stream` symbol-surface result below, the exact relationship
  between each public System 46 QFASL and the highest readable source generation in
  its directory has not been proved from build logs. QFASL presence and symbol
  inventory are corroboration, not body or source-version identity.
- Host keyboard and mouse mappings are emulator integration. Historical electrical
  scan codes and physical ergonomics are outside this specification.

## Artifact identities

### Compiled-artifact method and source skew

The System 46 QFASLs were inspected inertly: the audit reused the evacuation and
nibble-decoding helpers from the tracked public-asset extractor, then considered
only plausible FASL `SYMBOL` and `STRING` group payloads. It never loaded or
evaluated a QFASL. For `tvdefs`, `sheet`, `baswin`, `shwarm`, and `frame`, every
simple top-level function, macro, variable, flavor, and method flavor/message name
from the highest readable companion source was present in the compiled module's
symbol inventory. That corroborates a definition surface only; it does not establish
method bodies, constants, lambda lists, or whether a source-visible defect was
compiled. (`S46-QF`)

`stream.qfasl` supplies an exact counterexample to treating the highest source and
compiled file as one witness. Its symbol inventory contains
`DRAW-RECTANGLE-INSIDE-CLIPPED` and lacks `%DRAW-RECTANGLE-CLIPPED`, matching the
change present by `stream.10`. It also lacks all nine later names:

```text
CLEAR-OUTPUT  CLOSE  CURGEN  DRAW-CUBIC-SPLINE  FINISH
FORCE-OUTPUT  INCREMENT-CURSORPOS  LINE-IN  SPLINE
```

Source history adds splines and `:DRAW-CUBIC-SPLINE` in `stream.11`, generic stream
completion/close methods and `:LINE-IN` in `.12`, and `:INCREMENT-CURSORPOS` in
`.13`; `.14` retains that relevant surface. The strongest justified conclusion is
therefore that the preserved `stream.qfasl` has a **`stream.10`-level definition
surface**. Its bodies have not been disassembled. A compiled-surface-compatible
System 46 facade MUST treat those nine names as later extensions, not as proved
members of the compiled module. (`S46-QF`)

### Public System 46 representatives

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lmwin/tvdefs.181` | 27,621 | `db0557fdd1e869d29119781501139281773da67f67200660c5e578278b3c1b6e` |
| `src/lmwin/sheet.383` | 68,328 | `4f874b747b47599fadeee83abe6ef16a3a06f5ffecba9ecadc0613e6274ad024` |
| `src/lmwin/baswin.428` | 56,577 | `2ee1f487e6d14bec5bfc52a1e64b04963b8b1120a4d291be329995de92339dd4` |
| `src/lmwin/stream.10` | 28,337 | `c966a334e723617445db2fa750cca92f6cedfcb09b9f4d3b9b5712e641aad81f` |
| `src/lmwin/stream.14` | 41,227 | `3a41c4752da5b84f2ed88b1b8e3c215c54ceda75f4db28d3bb461fdc2e30b499` |
| `src/lmwin/mouse.149` | 40,629 | `2bf88baf3a881a47be520fdbd0e1fa0fa45c0e8fa0c5eb0dc349ed5b8877585d` |
| `src/lmwin/menu.29` | 44,154 | `dc750a73f9c5983b913890f159c118075f8b5c1566cc0f2420f5637f2f5439a2` |
| `src/lmwin/frame.120` | 40,532 | `a43a7eed0cd7ebe7e9a8ffabdb402f354702e2071443a313ca7378ad91a40ed0` |
| `src/lmwin/scrman.144` | 30,539 | `15c29e616fa464a45327f51c8ae63fd4740e29ddf92486c0715aae709d5b9878` |
| `src/lmwin/sysmen.105` | 28,436 | `c203bc08b5550edefb1928349179fc54c483655d273077294211eb778daff6f1` |
| `src/lmwin/tvdefs.qfasl` | 41,328 | `cf7bcab7255313e33e6689f1eca5ccc7d0b8bbb031081536f46fa26c7a741443` |
| `src/lmwin/sheet.qfasl` | 66,995 | `f21f72a9c3450c742da91fc30d31f29df3f4bc84e9191ae0245ff0ec0b8addaf` |
| `src/lmwin/stream.qfasl` | 29,463 | `ea6337f43755a20b94d239b1d57d8d12a68a8709a40bebb4602848f163d0c141` |
| `src/lmwin/scrman.qfasl` | 25,378 | `5cd8f94a04a383db8cd255476bd2283f800b284f87c54b9cb2bb0622cb5e1f51` |
| `src/lmwin/basstr.qfasl` | 33,941 | `622ca5c92187d4e444e47da80aa12c3c75b50dbea14d9da133465eaad4746921` |
| `src/lmwin/baswin.qfasl` | 64,455 | `f2925a6b8e0f912f3af686083909ad6a0d5f1a2b29e16b9011db8edab19cc335` |
| `src/lmwin/mouse.qfasl` | 30,902 | `ba1cf8f8472de06e126ce8c60806797f79ac50e399a9baedb848ca5d5530add5` |
| `src/lmwin/menu.qfasl` | 68,259 | `84ccd9cd7e8eea30174889604d140934a41d7bbd75bfa011baac871548704a7f` |
| `src/lmwin/frame.qfasl` | 65,998 | `c43107fd603217184933618a3f1b9dad1f2e6b5fab4c72e93c859f01c4aed795` |
| `src/lmwin/sysmen.qfasl` | 33,301 | `b2b75fc4c0f0a9876a994e3c058e1699b487511165bfdae2ed8a845aff64d753` |
| `src/lmwin/proces.qfasl` | 19,739 | `25fe02c86653e213b3d91353ffed2f656041211104403785c8a38d46aa079be3` |
| `src/lmwin/choice.qfasl` | 78,021 | `63848e971713a0fc27debaac5ac211e1a173dfa96ee71db8dde8fc9c84e538cc` |
| `src/lmwin/scroll.qfasl` | 39,238 | `07a2bec9f67658b9c5badd668bff52d17dfd211ab3b9407c34c947f73e95c44a` |
| `src/lmwin/tscrol.qfasl` | 23,759 | `26f82c8753c2e5969d979df251673af3e9263d03469c0e361ef9f77c55dd22cf` |
| `src/lmwin/scred.qfasl` | 40,893 | `b1de273791b4466692c011c724d6d31e013bea4a1ba84116bfcd083b7d6ed8bd` |
| `src/lmwin/shwarm.qfasl` | 37,592 | `ef6a96f88fd01f4402b6f670506903b47ae03b37d5b302b14d97cce377039e21` |
| `src/lmwin/color.qfasl` | 24,416 | `5ca940ec55dfa2ac03c04b6a9458c054e63363beced30fcb16ff574292238294` |
| `src/lmwin/typwin.qfasl` | 37,912 | `c834382fa22f777733f6447f0dbab610307d6357c34310abcd961d68c7ea9489` |

These compiled files were inventoried and hashed, not disassembled in this audit.
`S46-QF` therefore corroborates that each module family had a compiled payload in
the public snapshot; it does not prove that the QFASL was produced from the highest
numbered readable source beside it.

### Preserved System 303 runtime

The primary behavior witness is public `disk-sys-303-0.img`, 269,562,880 bytes,
SHA-256 `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The harness guide records the current source, emulator, machine artifacts, and
per-session evidence. The maintained source identities for representative modules
are pinned by the System 303 Fossil check-in in the Sources section. The runtime
closure table above distinguishes those source identities from behavior not yet
exercised in the band.

## Sources

- MIT System 46, pinned public
  [`tvdefs.181`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/tvdefs.181),
  [`sheet.383`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sheet.383),
  [`stream.14`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/stream.14),
  [`shwarm.162`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/shwarm.162),
  [`basstr.163`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/basstr.163),
  [`baswin.428`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/baswin.428),
  [`mouse.149`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/mouse.149),
  [`menu.29`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/menu.29),
  [`frame.120`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/frame.120),
  [`scrman.144`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/scrman.144),
  [`sysmen.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sysmen.105),
  [`typwin.53`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/typwin.53),
  [`choice.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/choice.12),
  [`scroll.141`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/scroll.141),
  [`tscrol.41`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/tscrol.41),
  [`scred.62`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/scred.62), and
  [`color.33`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/color.33).
- MIT, [*Lisp Machine Manual*, third edition](https://bitsavers.org/pdf/mit/cadr/chinual_3rdEd_Mar81.pdf),
  especially “The TV Display” and window-system material.
- David A. Moon and Allan C. Wechsler,
  [*Operating the Lisp Machine*](https://dspace.mit.edu/bitstream/handle/1721.1/41042/AI_WP_209.pdf?sequence=2&isAllowed=y)
  ([stable MIT record](https://hdl.handle.net/1721.1/41042)),
  MIT Artificial Intelligence Laboratory Working Paper 209 (April 1981), explicitly
  accurate as of System 67; especially §§2.1-2.3 for user-visible corroboration.
- MIT System 46, pinned public
  [TV manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/tv.76),
  [window-system draft](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/window.manual), and
  [operations manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/operat.27).
- LM-3, pinned System 303
  [`tvdefs.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Ftvdefs.lisp),
  [`sheet.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsheet.lisp),
  [`stream.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fstream.lisp),
  [`shwarm.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fshwarm.lisp),
  [`graphics.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fgraphics.lisp),
  [`scrman.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fscrman.lisp),
  [`basstr.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbasstr.lisp),
  [`baswin.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbaswin.lisp),
  [`mouse.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fmouse.lisp),
  [`menu.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fmenu.lisp),
  [`frame.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fframe.lisp),
  [`sysmen.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsysmen.lisp),
  [`typwin.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Ftypwin.lisp),
  [`choice.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fchoice.lisp),
  [`scred.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fscred.lisp), and
  [`color.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fcolor.lisp).
- Repository runtime studies,
  [CADR computer-use harness](cadr-computer-use-harness.md),
  [System Menu and selection](system-menu-and-select.md), and
  [Screen Editor and Frame-Up](../screen-editor-and-frame-up.md).

Last verified: 2026-07-19.

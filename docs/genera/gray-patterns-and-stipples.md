---
type: Artifact Analysis
title: Gray patterns, textures, and stipples in Symbolics Genera
description: Exact source-grounded # and . diagrams of every active and inactive named Genera stipple in the selected source, plus dynamic pattern protocols, storage, selection, customization, uses, and runtime reachability evidence.
tags: [genera, graphics, stipples, gray, raster, dynamic-windows, preservation]
timestamp: 2026-07-26T08:02:00-04:00
---

# Gray patterns, textures, and stipples in Symbolics Genera

## Conclusion

Genera's selected source defines 37 active named, periodic one-bit stipples:

- twelve TV gray masks simulate intermediate coverage by repeating set and clear
  pixels; and
- twenty-five general textures provide hatches, rain, tracks, lines, masonry,
  hearts, diamonds, parquet, and weaves.

They share the same raster-array mechanism but occupy different registries. They are
not fonts, RGB colors, or CLIM opacity objects.

The same file also preserves six named gray experiments inside a Lisp block comment.
They are documented below because they are part of the historical source artifact,
but they are not evaluated definitions and must not be counted as installed Genera
choices. Beyond fixed bit arrays, the file defines nine pattern classes/protocol
roles whose output may depend on the device or supplied drawing procedure. Those
objects do not necessarily have a finite `#`/`.` cell.

The names are approximate coverage percentages. `12%-GRAY` is exactly 12.5% set
pixels, `9%-GRAY` is 1/11, `8%-GRAY` is 1/12, `7%-GRAY` is 1/14,
`6%-GRAY` is 1/16, and `5.5%-GRAY` is 1/18. `HES-GRAY` also has 12.5%
coverage but deliberately lacks numeric gray-level metadata, so it is available as a
named TV pattern without participating in automatic nearest-density selection.

The `#` and `.` diagrams below are exact transformations of the selected Genera 8.5
source declarations:

- `#` means the source stipple bit is one;
- `.` means the source stipple bit is zero; and
- each diagram is one smallest visible period, except where the implementation
  intentionally stores a taller repeated cell for speed.

A set bit is not intrinsically “black.” The drawing ALU, foreground, reverse-video
state, opacity choice, and output device determine what the bit does. The diagrams
describe the mask, not a calibrated display luminance.

## The complete TV gray set

### Dense and compatibility grays

These first five retain the patterns familiar from the MIT CADR and LM-3 window
systems:

```text
50%-GRAY   25%-GRAY   75%-GRAY   33%-GRAY   HES-GRAY
.#         #...       .###       #..        #...
#.         ..#.       ##.#       .#.        ....
           .#..       #.##       ..#        ..#.
           ...#       ###.                  ....
```

`25%-GRAY` has a four-row visible period as drawn above, but Genera declares a
32-row logical cell containing that sequence eight times. The source says the taller
cell makes the vertical dotted line extending from a horizontal scroll bar draw
faster. This is a storage/performance choice, not a different visible texture.

`HES-GRAY` and `12%-GRAY` have equal set-bit density but different periods and dot
placement:

```text
HES-GRAY  4 by 4          12%-GRAY  8 by 8
#...                       #.......
....                       ...#....
..#.                       ......#.
....                       .#......
                           ....#...
                           .......#
                           ..#.....
                           .....#..
```

The inspected source does not expand `HES`; its historical meaning remains unknown.

### Ten percent

```text
10%-GRAY  10 by 10
#.........
...#......
......#...
.........#
..#.......
.....#....
........#.
.#........
....#.....
.......#..
```

Every row and column contains one set bit. The diagonal advances by three columns
modulo ten.

### Approximately nine percent

```text
9%-GRAY  11 by 11
#..........
.......#...
...#.......
..........#
......#....
..#........
.........#.
.....#.....
.#.........
........#..
....#......
```

This cell contains 11 set bits out of 121, exactly 1/11 or about 9.09%.

### Approximately eight percent

```text
8%-GRAY  12 by 3
#...........
....#.......
........#...
```

The cell contains three set bits out of 36, exactly 1/12 or about 8.33%.

### Approximately seven percent

```text
7%-GRAY  14 by 7
#.............
....#.........
........#.....
............#.
..#...........
......#.......
..........#...
```

The cell contains seven set bits out of 98, exactly 1/14 or about 7.14%.

### Approximately six percent

```text
6%-GRAY  16 by 8
#...............
......#.........
............#...
..#.............
........#.......
..............#.
....#...........
..........#.....
```

The cell contains eight set bits out of 128, exactly 1/16 or 6.25%.

### Approximately five and a half percent

```text
5.5%-GRAY  18 by 18
#.................
.....#............
..........#.......
...............#..
..#...............
.......#..........
............#.....
.................#
....#.............
.........#........
..............#...
.#................
......#...........
...........#......
................#.
...#..............
........#.........
.............#....
```

The cell contains 18 set bits out of 324, exactly 1/18 or about 5.56%.

## The complete general texture set

These 25 stipples are declared with `:PATTERN T`. Unlike the TV grays, they do not
carry numeric density metadata and do not participate in automatic gray-level
selection. Names beginning `SOUTHEAST` slope down and right in the diagrams;
`SOUTHWEST` is the reflected direction.

### Hatches

```text
SOUTHEAST-DENSE-HATCH  3 by 3    SOUTHWEST-DENSE-HATCH  3 by 3
#..                              ..#
.#.                              .#.
..#                              #..

SOUTHEAST-THIN-HATCH  5 by 5     SOUTHWEST-THIN-HATCH  5 by 5
#....                            ....#
.#...                            ...#.
..#..                            ..#..
...#.                            .#...
....#                            #....

SOUTHEAST-THICK-HATCH  5 by 5    SOUTHWEST-THICK-HATCH  5 by 5
##...                            #...#
.##..                            ...##
..##.                            ..##.
...##                            .##..
#...#                            ##...
```

Their explicit menu names are respectively **SE Dense**, **SW Dense**,
**SE Hatch**, **SW Hatch**, **SE Thick**, and **SW Thick**.

### Rain and tracks

```text
SOUTHEAST-RAIN  4 by 4   SOUTHWEST-RAIN  4 by 4
#...                     ...#
.#..                     ..#.
..#.                     .#..
....                     ....

ALT-RAIN  4 by 8         TRACKS  8 by 8
#...                     .#......
.#..                     #.#.....
..#.                     ........
....                     ........
#...                     ......#.
...#                     .....#.#
..#.                     ........
....                     ........
```

The first two have the explicit menu names **SE Rain** and **SW Rain**.
`ALT-RAIN` alternates the diagonal direction in its lower half. `TRACKS` places two
short, separated chevron-like pairs in an eight-row cell; the source provides no
more specific semantic explanation.

### Dashed and continuous lines

```text
HORIZONTAL-DASHES  4 by 6   VERTICAL-DASHES  6 by 6
##..                         #..#..
....                         #..#..
....                         #.....
..##                         #.....
....                         ...#..
....                         ...#..

HORIZONTAL-LINES  1 by 4     VERTICAL-LINES  4 by 1
#                            #...
.
.
.
```

The explicit menu names are **Horiz Dashes**, **Vert Dashes**, **Horiz Lines**, and
**Vert Lines**.

### Bricks and tiles

```text
BRICKS  8 by 10       HALF-BRICKS  8 by 6   DOUBLE-BRICKS  8 by 10
....#...              #...#...               ....#...
....#...              #...#...               ....#...
....#...              #...#...               ....#...
....#...              #...#...               ....#...
########              #...#...               ....#...
#.......              ########               ....#...
#.......                                     ....#...
#.......                                     ....#...
#.......                                     ....#...
########                                     ########
```

```text
TILES  8 by 8
#.......
#.......
.#.....#
..#####.
....#...
....#...
...#.#..
###...##
```

The brick masks draw mortar-like horizontal and vertical boundaries. `HALF-BRICKS`
uses two half-width divisions in every row; `BRICKS` offsets the vertical division
between its upper and lower halves; `DOUBLE-BRICKS` retains one division over the
entire tall cell. This visual description follows the bits and does not assert an
undocumented architectural convention.

### Hearts and diamonds

```text
HEARTS  8 by 8          SMALL-DIAMONDS  4 by 4
.##.##..                #...
#..#..#.                .#.#
#..#..#.                ..#.
.#...#..                .#.#
..#.#...
...#....
........
........
```

```text
LARGE-DIAMONDS  8 by 8          FILLED-DIAMONDS  8 by 8
#.......                         ########
.#.....#                         .#######
..#...#.                         ..#####.
...#.#..                         ...###..
....#...                         ....#...
...#.#..                         ...###..
..#...#.                         ..#####.
.#.....#                         .#######
```

`LARGE-DIAMONDS` has the explicit menu name **Diagonals**, while
`FILLED-DIAMONDS` is presented as **Diamonds**. This naming difference matters:
the Lisp symbol and user-facing label are not always the same.

### Parquet and weaves

```text
PARQUET  8 by 8       WEAVE8  8 by 8       WEAVE8B  8 by 8
#.......              ..#...#.              ........
##.....#              ......#.              ......#.
..#...#.              #####.#.              .###..#.
...###..              ......#.              ......#.
....#...              ..#...#.              ........
...#....              ..#.....              ..#.....
..#.....              #.#.####              ..#..###
.#......              ..#.....              ..#.....
```

`WEAVE8B` is sparser than `WEAVE8`; neither declaration supplies a longer printable
name or a density.

## Inactive named gray experiments

The following six declarations occur inside a block comment. These are exact
transcriptions of their cells, but **inactive** means the selected source does not
evaluate, register, or offer them merely by loading this file.

```text
MEDIUM-GRAY  2 by 2       ALT-4-GRAY  4 by 4
.#                         #...
#.                         ....
                           ..#.
                           ....
```

```text
ALT-6-GRAY  6 by 6        ALT-8-GRAY  8 by 8
#.....                     #.......
......                     ........
......                     ........
...#..                     ........
......                     ....#...
......                     ........
                           ........
                           ........
```

```text
ALT-4-DARK-GRAY  4 by 4   ALT-6-DARK-GRAY  6 by 6
.###                       .#####
####                       ######
##.#                       ######
####                       ###.##
                           ######
                           ######
```

`MEDIUM-GRAY` duplicates the active 50% cell under another name.
`ALT-4-GRAY`, `ALT-6-GRAY`, and `ALT-8-GRAY` contain two isolated one bits;
their dark counterparts complement the corresponding 4-by-4 and 6-by-6 cells.
No inactive 8-by-8 dark complement is present in this block. The source comment
does not state why these candidates were retired or retained as commentary.

## Dimensions and density metadata

The declaration gives height first and width second. The following table uses the
more familiar width-by-height order:

| Name | Declared logical cell | Smallest visible period | Set bits | Exact coverage | Automatic gray-level candidate |
| --- | ---: | ---: | ---: | ---: | --- |
| `50%-GRAY` | 2 by 2 | 2 by 2 | 2/4 | 50% | yes |
| `25%-GRAY` | 4 by 32 | 4 by 4 | 32/128 | 25% | yes |
| `75%-GRAY` | 4 by 4 | 4 by 4 | 12/16 | 75% | yes |
| `33%-GRAY` | 3 by 3 | 3 by 3 | 3/9 | 33⅓% | yes |
| `HES-GRAY` | 4 by 4 | 4 by 4 | 2/16 | 12.5% | no |
| `12%-GRAY` | 8 by 8 | 8 by 8 | 8/64 | 12.5% | yes |
| `10%-GRAY` | 10 by 10 | 10 by 10 | 10/100 | 10% | yes |
| `9%-GRAY` | 11 by 11 | 11 by 11 | 11/121 | 9.0909…% | yes |
| `8%-GRAY` | 12 by 3 | 12 by 3 | 3/36 | 8.3333…% | yes |
| `7%-GRAY` | 14 by 7 | 14 by 7 | 7/98 | 7.142857…% | yes |
| `6%-GRAY` | 16 by 8 | 16 by 8 | 8/128 | 6.25% | yes |
| `5.5%-GRAY` | 18 by 18 | 18 by 18 | 18/324 | 5.5555…% | yes |

The metadata density is computed by counting one bits and dividing by logical width
times height. The percentages in names are therefore labels, not separately stored
measurements.

## Construction and physical storage

`MAKE-STIPPLE` validates that the number of supplied row patterns equals the declared
height. It then:

1. computes a physical raster width as `LCM(logical-width, 32)`;
2. allocates a one-bit `STIPPLE-ARRAY` with that physical width;
3. repeats each logical row horizontally across the physical row;
4. records the logical width as `x-phase`; and
5. retains optional name and gray-level metadata in the array leader.

The physical array can therefore be wider than the diagram. For example, a 10-bit
logical row occupies a 160-bit physical row and an 18-bit row occupies a 288-bit
physical row. `STIPPLE-ARRAY-REPEAT-SIZE` reports the logical X phase and declared
height, not merely the physical raster width.

`TV:MAKE-GRAY` remains as a compatibility wrapper around `MAKE-STIPPLE`, converting
its older octal-pattern arguments into binary rows. `TV:MAKE-BINARY-GRAY` is another
old name for the newer constructor.

## Dynamic patterns that are not fixed bit cells

The complete pattern abstraction in this file is larger than the 37 active raster
stipple names. All nine roles below ultimately participate through
`PATTERN-CALL-WITH-DRAWING-PARAMETERS`; only the raster-backed cases necessarily
yield a periodic one-bit source.

| Class or protocol role | Observable contract in the selected source |
| --- | --- |
| `BASIC-PATTERN` | Root protocol. A subclass must arrange for a drawing continuation to run with pattern-specific drawing parameters. |
| `DEVICE-PATTERN` | Passes itself as the drawing operation's `:PATTERN`; the output device interprets it. |
| `RASTER-DEVICE-PATTERN` | Requires a device-specific method that computes a raster source and drawing parameters. |
| `RASTER-SLICE-DEVICE-PATTERN` | Computes and draws successive raster slices rather than requiring one complete source. |
| `LGP:POSTSCRIPT-DEVICE-PATTERN` | Emits PostScript-specific pattern output on the printer path. It has no universal screen tile to transcribe. |
| `SIMPLE-PATTERN` | Stores an arbitrary list of drawing keyword/value arguments and applies that bundle around the continuation. |
| `DEVICE-CONDITIONAL-PATTERN` | Chooses the first matching branch among `:COLOR`, `:POSTSCRIPT`, `:WINDOW`, and `OTHERWISE`, then delegates to that branch's pattern. |
| `TWO-COLOR-STIPPLE` | On color streams, combines one raster stipple with separate one-bit and zero-bit color ALUs; on non-color streams, delegates an opaque ordinary stipple. |
| `CONTRASTING-PATTERN` | Selects a cyclic color or an index-derived monochrome gray level intended to distinguish adjacent indexed regions. |

The last two concrete helpers further demonstrate why “all patterns” cannot mean
only one-bit cells:

- `TWO-COLOR-STIPPLE` combines a one-bit stipple with two colors. On a color
  device, one bits use the first color and zero bits use the second through two
  color ALUs. On a monochrome device it falls back to the ordinary opaque stipple
  interpretation.
- `CONTRASTING-PATTERN` generates distinct selections by index. On color devices
  its six-color cycle is red, blue, green, yellow, cyan, and magenta. On monochrome
  devices it computes alternating gray levels. For a requested count of six the
  exact index sequence is:

| Index | Color result | Monochrome gray level |
| ---: | --- | ---: |
| 0 | red | 0 |
| 1 | blue | 5/6 |
| 2 | green | 1/3 |
| 3 | yellow | 1/2 |
| 4 | cyan | 2/3 |
| 5 | magenta | 1/6 |

`SIMPLE-PATTERN` and `DEVICE-CONDITIONAL-PATTERN` are combinators, not additional
shipped named textures. A program can construct arbitrarily many instances. Their
meaningful demonstration is therefore the selection/effect table above rather than
inventing a fictitious periodic bitmap.

## How a requested gray level is selected

The gray registry starts with the two endpoints:

- true at density 1; and
- null at density 0.

Each stipple declared with numeric gray metadata is inserted by density. A requested
intermediate gray on a monochrome raster device is bracketed in that descending
registry and resolved to the nearer entry. Equal distance selects the darker,
higher-density entry. `HES-GRAY` is absent from this numeric registry because its
declaration does not request gray-level metadata.

The drawing path then combines the selected gray with any explicit tile or stipple.
If both are present it constructs a temporary raster whose period is large enough
for both and intersects the masks. Its one-bit and zero-bit ALUs depend on the
requested drawing operation and `:OPAQUE`:

- a one bit performs the standardized drawing ALU;
- an opaque zero bit erases; and
- a non-opaque zero bit leaves the destination unchanged.

On a functioning color stream, an intermediate `:GRAY-LEVEL` normally becomes a
direct achromatic color rather than a monochrome stipple. If color allocation fails,
the implementation falls back to the nearest stipple. A specified color rendered on
a black-and-white stream is reduced to an intensity-derived gray level and then to a
stipple. Thus “gray level” is a device-independent drawing request, while these
twelve arrays are the monochrome realization and fallback.

## User and programmer customization

### Screen options

The named TV grays are added to `TV:*GRAY-ARRAYS*`, together with `None`, `Black`,
and `White`. **Set Screen Options** constructs live choices from that list for
screens supporting:

- **Background gray pattern**, used for otherwise unused screen areas; and
- **Partially exposed window gray pattern**, used for deexposed inferiors.

The setting accepts a registered symbol or an array, so a nonstandard current value
can remain available alongside the built-ins. The source builds the choice order
from the actual registry rather than from a separately sorted density menu. The
precise menu order and resulting screen appearance remain a runtime TODO.

### Defining and finding stipples

`DEFSTIPPLE` is the main definition interface. Its options can:

- assign a printable name;
- calculate or supply a numeric density;
- add the symbol to the TV screen-gray list; and
- add the array to the separate general pattern list.

`FIND-STIPPLE-NAMED` accepts a string, symbol, or stipple object and searches the
`STIPPLES` package by printable name. The Stipple Editor can add a created stipple to
the live `GRAPHICS:*STIPPLE-ARRAYS*` registry. That makes customization a live Lisp
object/registry operation, not the installation of a PNG texture file.

The twelve grays use `:TV-GRAY`; the southeast/southwest hatches, rain,
tracks, lines, bricks, hearts, diamonds, parquet, and weave textures use
`:PATTERN`. They share the array mechanism but belong to different user-facing
registries.

## Verified uses in the selected source

Direct references establish these roles:

| Gray | Source-established uses |
| --- | --- |
| `50%-GRAY` | Dynamic Windows drop shadows and scroll-bar shafts; patterned margins in Statice and Flavor Examiner; layout-designer and herald borders; Zmacs gray block diagrams; Bitmap Editor background/check fields |
| `25%-GRAY` | Bitmap Editor plane display, Color GENEX viewport gunsight, Joshua widget backgrounds and planning-example blocks |
| `75%-GRAY` | Zmacs failed/invalid diagram end caps and one Joshua planning-example block |
| `33%-GRAY` | Dynamic Windows scroll-bar car, NSage diagram separators, BFD bitmap combination, and Joshua planning-example blocks |
| `HES-GRAY` | central span of Zmacs engrayed text, Graphic Editor raster feedback, and color allocator masks |
| `10%-GRAY` | Dynamic Windows region-to-sequence highlighting and one Joshua planning-example block |
| `6%-GRAY` | one Joshua planning-example block |
| `5.5%-GRAY` | sparse masks in color allocation |

No direct application reference outside definition/translation infrastructure was
found for `12%-GRAY`, `9%-GRAY`, `8%-GRAY`, or `7%-GRAY` in the selected tree.
That does not make them dead: all four are reachable through numeric gray-level
selection and the TV screen-gray registry.

The Dynamic Windows-to-CLIM converter explicitly maps the numeric stipples from
5.5% through 75% to corresponding scalar densities. It omits `HES-GRAY`, matching
the absence of numeric metadata. This is a conversion rule, not proof that native
Dynamic Windows stipples and CLIM designs are the same objects.

The general texture symbols are used primarily through
`GRAPHICS:*PATTERN-STIPPLE-ARRAYS*`, so the absence of a literal symbol reference is
not evidence that a texture is unreachable. Direct selected-source references do
establish:

- the Dynamic Windows graphics tests use `HEARTS`, `SOUTHEAST-RAIN`,
  `SOUTHWEST-RAIN`, `HORIZONTAL-DASHES`, `PARQUET`, `WEAVE8`, and
  `FILLED-DIAMONDS`;
- the formatted-output tests exercise `VERTICAL-LINES`, `HORIZONTAL-LINES`,
  `FILLED-DIAMONDS`, and `HEARTS`;
- `FILLED-DIAMONDS` is tested through the two-color-stipple protocol; and
- Graphic Editor and Stipple Editor enumerate or extend the live registries rather
  than hard-code every pattern name.

No direct non-test literal reference was found for the other general texture symbols
in the selected tree. They remain live registry choices; their application-specific
historical use is an open question rather than something inferred from their names.

## What these diagrams do not show

The diagrams establish array bits and periodicity. They do not establish:

- which phase lands at a particular window origin;
- whether one bits appear dark or light under a selected ALU and reverse-video mode;
- physical pixel aspect, monitor response, or perceived gray;
- color-screen allocation and gamma behavior;
- printer or PostScript halftoning; or
- device-specific rendering of the general texture library.

No runtime screenshot is published for this article. A synthetic sheet containing
all masks—or one screenshot per mask—would be an extracted-asset or bulk gallery
rather than evidence of a particular application interaction, and the repository's
screenshot policy excludes that use. The exact functional bit diagrams are the
minimum technical notation needed to analyze every fixed mask.

A fresh isolated runtime probe was nevertheless performed on 2026-07-26. In session
`stipple-catalog-20260726`, the Dynamic Lisp Listener rejected `Stipple Editor` as
an activity name, and direct evaluation reported `FED::EDIT-STIPPLE` undefined in
the running world. The unsuccessful listener captures remain in the ignored session
tree and are not suitable publication evidence of the editor. This establishes only
that the editor was not loaded/reachable through those two routes in this world; it
does not contradict the retained source or prove that the subsystem cannot be
loaded. A reviewed screenshot remains a `TODO` until the actual editor or a
substantively discussed live pattern use can be reached.

### Runtime probe provenance

The ordered input record was:

1. type `Select Activity Stipple Editor` and Return; the Command Processor parsed
   `Stipple` as the proposed activity and rejected it;
2. try the documented Select/vertical-bar route both sequentially and as a held
   Select chord; neither selected an editor in this X-key mapping;
3. try `Select Activity Stipple-Editor`; the correction interaction did not clear
   the earlier proposal cleanly, so this attempt is not evidence about that spelling;
4. clear the correction input with Rubout events and evaluate the public-package
   spelling `(FED:EDIT-STIPPLE STIPPLES:HEARTS)`; the reader reported that the
   external symbol does not exist; and
5. clear again and evaluate `(FED::EDIT-STIPPLE STIPPLES:HEARTS)`; the evaluator
   reported the function undefined.

The failed Select-key attempt is retained as an input-mapping uncertainty. Only
steps 1, 4, and 5 support the reachability conclusion.

| Runtime item | Recorded value |
| --- | --- |
| Session and generation | `stipple-catalog-20260726`, generation 1 |
| Archive | `opengenera2.tar.bz2`; 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world at start | 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| Debugger | 346,880 bytes; SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| VLM executable | 1,533,760 bytes; start and execution SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| Compatibility preloads | exact-ifconfig SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`; X compatibility SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1` |
| Configuration and responder | config SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`; responder SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb` |
| RFC 868 result | one validated local raw-Ethernet reply; evidence SHA-256 `122361dff5cdf182c896e7a6953e0857059cac6aae3b0dd02e7a0568db455a87`; responder exit 0 |
| Isolation | Bubblewrap private user, mount, network, PID, IPC, and hostname namespaces; read-only Guix store and exact helpers/X socket; private writable runtime; no default/external route or host file service |
| X safety/compatibility | MIT-SHM disabled and absent; both pinned guest-relay substitutions observed; nonmatching writes delegated |
| Selected window | XID 4194310, title `Genera on DIS-LOCAL-HOST`, 1200 by 900 at host X position 72,55 |
| Toolchain | manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`; Python 3.11.14; Xorg Server 21.1.21 |
| Final action log | 32 intents/outcomes; SHA-256 `2d08da961cadfdbb73843e395932485e324728a843525b4747426edd29bcf6fe` |

Two raw captures are useful for reproducing the negative result but are not curated
museum screenshots:

| Raw capture | PNG SHA-256 | Pixel SHA-256 | What it establishes |
| --- | --- | --- | --- |
| `0001-stipple-editor-initial.png` | `405b03632bfd484c782de192683cab97345ed1942aa0a92d4553b450bb559750` | `26c509f26b98df25ed1b65d332d758dc3d014e64dc4c26858faa1c4e398cbc12` | Command Processor rejection of the spaced activity proposal |
| `0007-stipple-editor-hearts-live.png` | `8b11a9151c64d99da0438e64c329e7adf849cb02c1a9114c6a6699460895570a` | `e2bbb6b0257d8386860046aa1ad65afab2306c7336e906e0f9f790a6d23ad4aa` | listener report that `FED::EDIT-STIPPLE` is undefined |

At stop, the private and base worlds still matched the starting hash. The harness
sent `yes`, the VLM accepted confirmation and began cleanup, then encountered the
known cleanup stall and required bounded forced termination. Therefore
`forced_stop` and `state_may_be_incomplete` are true and orderly host shutdown is
false. The harness did not invoke Save World or create a host checkpoint;
`save_world_performed` and `guest_checkpoint_created` remain unknown.

## Relationship to CADR and to color grays

The first five patterns match the public CADR/LM-3 gray family documented in
[Color inks and raster patterns in the MIT CADR software](../mit-cadr/color-inks-and-raster-patterns.md).
Genera adds the lower-density progression and a general registry/pattern protocol.
This establishes continuity of pattern data and purpose; it does not by itself date
each intermediate revision or identify the author.

Genera's Color Palette separately defines achromatic color objects from 5% through
95% in five-percent steps. Those are RGB/IHS-domain colors for color output, not
these one-bit stipple arrays. See [Color systems and the Color
Editor](../color-systems-and-color-editor.md) and
[Inks, faces, and character styles](inks-faces-and-character-styles.md) for those
boundaries.

## Preservation record

The source path prefix is the licensed media's `sys.sct/`; paths below are portable
artifact identifiers, not repository links.

| Artifact | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `dynamic-windows/graphics-patterns.lisp.~12~` | 19,323 | `83a6515079302d4fdf7d69fdf4b6b131d619e5edb3c34651effe099fb7a991ac` | constructors, all active and inactive fixed declarations, registries, general pattern protocol |
| `dynamic-windows/raster-graphics-mixin.lisp.~157~` | 118,783 | `c78ca3292c788f46a0fefdcd5f2f86357498dc48b7b583eef717831728024c09` | device selection, color fallback, mask combination, opaque/transparent ALUs |
| `window/set-options-commands.lisp.~42~` | 37,422 | `b26f08610db9c73105be56f843ab61ac18c642f098d73555b2b881e05aa70e9a` | screen gray choices and application |
| `zwei/style.lisp.~123~` | 49,844 | `14425902c9cc283588127f811dbcb87004197d40e34a0e19e9fe91fd17f592ca` | engrayed text and gray block diagrams |
| `dynamic-windows/dynamic-window-mixins.lisp.~204~` | 139,058 | `d1c9db01f37982f10efdd5f7f21dff938a437c4b1f80633c04054158be87a482` | shadows and scroll-bar patterns |
| `conversion-tools/dw-to-clim.lisp.~50~` | 123,785 | `46de18026baecae99595c486d973539e24ff467e0082996460d56b88a5446c8c` | native-stipple to numeric CLIM conversion |
| `color/color-editor/color-palette.lisp.~56~` | 35,160 | `f38a06dcbcf33c2db658cc0ca2682d3793c7002d788cd991791a8295f07b5811` | distinct continuous color-gray palette |
| `bitmap-editor/stipple-editor.lisp.~15~` | 10,677 | `7cf4f5e637c912c90fbd42923ce46662648c82f354987795af277ea213230bac` | retained editor framework, raster sample, save and registry integration |

The diagrams were generated during the audit by stripping nested Lisp block comments,
separately parsing active and block-commented `DEFSTIPPLE` forms, validating the
declared row count and width, counting set bits, finding the smallest exactly
repeating row sequence for the gray analysis, and translating `1` to `#` and `0` to
`.`. The transcription contains only the 37 active and six inactive small functional
periodic masks necessary to analyze the mechanism; it omits implementation forms.
No licensed source file, executable object, raster asset, or generated image is
tracked.

A case-insensitive, hidden-file-inclusive search of the complete selected
`sys.sct/` tree found every `DEFSTIPPLE` occurrence in
`dynamic-windows/graphics-patterns.lisp.~12~` and no declaration in another source
file. There are 44 textual matches: one macro-emitted definition form, 37 active
declarations, and six block-commented declarations. This establishes completeness
for `DEFSTIPPLE` declarations in this selected source tree, not for the unbounded
set of pattern objects that applications can construct dynamically.

## Open questions

- Exercise **Set Screen Options** in the isolated Genera world and record the exact
  choice order, defaults, mutation timing, and rollback behavior.
- Load or otherwise reach the Stipple Editor in a fresh isolated world, then capture
  one reviewed, application-specific editor state under the screenshot publication
  policy.
- Determine the historical expansion of `HES`, if contemporary evidence exists.
- Test phase alignment across window origins, nested patterns, transformed drawing,
  reverse video, and hardcopy devices.
- Audit earlier lawful Symbolics source generations to date the addition of each
  lower-density stipple and the move from TV-only grays to the general pattern
  registry.
- Find source or runtime evidence for historical application uses of each texture
  that currently appears only through the general registry or test programs.

## Sources

- Symbolics, licensed Open Genera 2.0 / Genera 8.5 media, exact selected artifacts
  above; inspected locally 2026-07-26. No licensed source file or generated raster
  asset is reproduced.
- Symbolics, [Programming the User Interface](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf),
  for the supported drawing-state and raster-graphics context; verified 2026-07-26.
- Museum companions:
  [CADR color inks and raster patterns](../mit-cadr/color-inks-and-raster-patterns.md),
  [Genera inks, faces, and character styles](inks-faces-and-character-styles.md),
  [Color systems and the Color Editor](../color-systems-and-color-editor.md), and
  [Bitmap, stipple, and raster paint editors](../bitmap-stipple-and-raster-paint-editors.md).

Last verified: 2026-07-26.

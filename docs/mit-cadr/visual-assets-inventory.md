---
type: Artifact Analysis
title: Visual assets in the MIT CADR and LM-3 software
description: An evidence-graded inventory of stored pictures, graphical fonts, paint patterns, hardware drawings, and procedural imagery in public CADR and LM-3 sources.
tags: [mit-cadr, lm-3, graphics, visual-assets, preservation]
timestamp: 2026-07-17T01:22:13-04:00
---

# Visual assets in the MIT CADR and LM-3 software

## Conclusion

The preserved CADR software contains substantially more visual material than its
ordinary text fonts, but almost none of it looks like a modern image file on disk.
The complete public System 46 tree contains no PNG, GIF, JPEG, PBM, or XBM files.
Instead, its visual assets occur as Lisp Machine font objects, serialized Lisp
arrays, XGP scan records, source-defined bit patterns, SUDS drawings and plot
streams, and textual coordinate data.

Two standalone System 46 pictures can be decoded deterministically. `10LEAF`
reconstructs its stored array exactly; `SCANIN CWH3` is normalized to the occupied
black-pixel crop:

- `10LEAF` is a 255 by 255, eight-bit grayscale photograph of leafy branches,
  serialized as a QFASL array;
- `SCANIN CWH3` is a one-bit scan of page 3 of an unidentified mathematics text,
  used as input to the `SCAN` display demo and emitted as a translated crop.

Both recovered images remain local research outputs. Their occurrence in the
released source tree does not by itself establish the authorship or redistribution
rights of the photograph or scanned page. This repository therefore tracks the
non-evaluating decoder and its evidence, not either reconstructed PNG.

The maintained LM-3 System 303 tree contains several graphical font atlases absent from
the public System 46 snapshot, including abacus pieces, an animated beetle, worm
marks, tally marks, pane diagrams, and the MIT *mens et manus* figures. Because the
inspected Fossil check-in has no repository-level license file, this repository does
not copy or publish decoded LM-3 glyph data.

## Scope and classification

This audit compared two public source snapshots:

- the complete `src/` tree of
  [`mietek/mit-cadr-system-software`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
  at commit `8e978d7d1704096a63edd4386a3b8326a2e584af`, representing System 46;
- the LM-3 Fossil repository's System 303 check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.

The search combined a complete filename and extension inventory with binary-aware
string searches, inert QFASL decoding, contemporary file-format documentation, and
inspection of executable consumers. A file is called an asset here when it stores a
reusable picture, symbol, pattern, or drawing. A program such as MUNCH which creates
new imagery at runtime is instead classified as a visual program.

| Class | Examples | Preservation meaning |
| --- | --- | --- |
| Stored raster pictures | `10LEAF`, `SCANIN CWH3` | Pixel content can be reconstructed without running CADR Lisp. |
| Graphical font atlases | `BUG`, `MOUSE`, `SHIP`, LM-3 `ICONS`, `TVBUG`, `WORM` | The font container doubles as a sprite or symbol store. |
| Source-defined patterns | PAINT fills and brushes, label halftone, FED gray tile | The bitmap is a small Lisp constant or is generated deterministically. |
| Structured drawings | SUDS `.DRW` and `.PLT` files | These are drawing or plot command data, not flat screenshots. |
| Text and coordinate diagrams | `figs.texsq1`, `flavor.pictur` | Visual layout survives as numbers or spatial text. |
| Formatted document output | Ten System 46 `.xgp` bodies, LM-3 `menu.press` | Page-description or printer output is visual evidence, but not a reusable runtime picture. |
| Procedural graphics | MUNCH, LEXIPHAGE, PICT, GEB, QIX | Source or compiled-object evidence describes a process, not a stored final image. |

## Standalone System 46 pictures

### `10LEAF`

The media inventory lists both `LMIO1; 10LEAF POINTS` and `LMIO1; 10LEAF QFASL`.
The source program
[`CVPTS`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/cvpts.30#L17-L106)
reads the point representation into a 255 by 255 `ART-8B` array, supplies a
30-element array leader and `PICTURE-HANDLER`, clips values above octal `377`, and
dumps the result. The color display command
[`PUT-UP-PICT`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/color.33#L447-L467)
defaults to `:10LEAF`, installs a gray color map, scales the data to sixteen display
levels, and centers it on the screen.

Inert reconstruction of the QFASL produces exactly 65,025 pixels, with values from
0 through 255 and 91 distinct values. The result is a low-contrast photograph of
leaves and branches, not a generated test gradient.

| Public input | Bytes | SHA-256 |
| --- | ---: | --- |
| `lmio1/10leaf.points` | 82,240 | `04eba7ba8179e54532bf3f356e69ab111cc885077ed201dd2bdee11e8304e1b5` |
| `lmio1/10leaf.qfasl` | 81,524 | `d1f1b12907c79d58685cdbf2f6be9c55352b12a521d07ee0a68848372496f28a` |

### `SCANIN CWH3`

`lmdemo/scanin.cwh3` is not a QFASL. It is a sequence of XGP `SCN` interface
records in evacuated PDP-10 words. The record layout and the switch between
run-length and image modes are documented by the contemporary
[`XGP` interface specification](https://github.com/PDP-10/its/blob/8ea145f42cabccfad054321a35e1493c1c67970c/doc/info/xgp.24#L545-L606);
the System 46
[`XGP` writer](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/xgp.21#L90-L180)
establishes the bit order used by the Lisp Machine.

The file contains exactly 789 records: 714 run-length rows, 74 image-mode rows,
and one final cut record. Its 125,498 black pixels occupy a 1,270 by 1,695 bounding
box. The reconstructed content is page 3 of a mathematics text explaining binomial
coefficients and Pascal's Triangle. Its title, author, publisher, and copyright
status remain **TODO**.

The PNG translates that bounding box to an origin of `(0, 0)` and omits the blank
coordinate space around it. `catalog.json` retains the original line range, cut
coordinate, interface width, and half-open bounding box. The result is therefore a
deterministic normalized rendering of the stored pixels, not an assertion that the
original XGP page canvas had the PNG's dimensions.

The System 303
[`LMTAPE` inventory](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=1394-1409&name=doc%2Flmtape.text)
explicitly maps logical `LMDEMO SCAN` to `LMDEMO SCANIN CWH3` while listing `PICT`
separately. This establishes that the page is input to the `SCAN` demo and prevents
conflating it with the independent procedural `PICT` hack.

| Public input | Bytes | SHA-256 |
| --- | ---: | --- |
| `lmdemo/scanin.cwh3` | 72,987 | `7ea79051ea81d7a3382164a6cf5fdee7f8ee7d4d0393372f70440dbfd421e824` |

## Reconstructing the pictures locally

[`extract-cadr-visual-assets.py`](../../scripts/extract-cadr-visual-assets.py)
verifies the exact System 46 source revision's license and input hashes before it
decodes either picture. It shares the bounded QFASL object parser used by the font
recovery pipeline, recognizes only the exact `CVPTS` named-array conversion form,
and never evaluates Lisp. Its XGP path parses only the reviewed `SCANIN` record
envelope.

From a checkout whose argument is the public repository's `src/` directory:

```sh
python3 scripts/extract-cadr-visual-assets.py \
  /path/to/mit-cadr-system-software/src \
  --output build/visual-assets/mit-cadr

python3 scripts/extract-cadr-visual-assets.py \
  /path/to/mit-cadr-system-software/src \
  --output build/visual-assets/mit-cadr \
  --check
```

When the pinned public source checkout is available, the optional integration test
exercises license and artifact verification, both real decoders, PNG/catalog output,
and the CLI check path:

```sh
MIT_CADR_SYSTEM46_SRC=/path/to/mit-cadr-system-software/src \
  python3 -m unittest -v \
  tests.test_visual_assets.PinnedSystem46IntegrationTests
```

The output directory contains `10leaf.png`, `scanin-cwh3.png`, and a deterministic
`catalog.json`. The entire directory is ignored by Git. Do not move these outputs
into `docs/assets/` unless their content rights are established separately.

## Graphical fonts as sprite and symbol stores

The CADR font representation is also a convenient indexed bitmap container. Several
“fonts” are better understood as small sprite atlases:

- `MOUSE` stores mouse arrows, rectangle corners, scrolling marks, and meter
  indicators;
- `ARROW` stores visible representations of format effectors as well as old window
  system blinkers;
- `TOG` stores switch-register state glyphs used by the display hacks;
- `SHIP` stores a torpedo, a sun, and two sets of 32 rotated ship sprites for
  Spacewar;
- `BUG` stores four 33-row beetle drawings in character positions A through D. A
  contemporary EINE bug report instructs the user to fill continuation lines with
  those characters as a redisplay stress case. It does not establish that the four
  glyphs were animated in System 46;
- `SEARCH` stores ten visibly labeled extended-search operators. Later maintained
  LM-3 source establishes their exact editor functions, from opening and closing a
  nesting level through “any character.”

The tracked [font sheets](../assets/mit-cadr-fonts/) and
[compiled-font sheets](../assets/mit-cadr-qfasl-fonts/) show these public
System 46 artifacts. Their application evidence is maintained in the
[font usage audit](font-usage-audit.md), rather than inferred from appearance alone.

## LM-3-only graphical fonts

The following compiled names are present in maintained System 303 and absent from
the complete public System 46 tree. “Absent” is a snapshot comparison, not a claim
that the LM-3 restoration created them or that they never existed in another earlier
MIT software set.

| Font or data | Established content and use | Evidence grade |
| --- | --- | --- |
| `ABACUS` | Glyph A is an empty vertical rod and B is a diamond bead on the rod; the program draws B for a set bead and A otherwise. | [Direct runtime](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fabacus.lisp&ln=14-96) |
| `TALLY` | A print-base handler emits glyph 5 for complete groups of five and glyph 1 for the remainder. | [Direct runtime](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fdlwhak.lisp&ln=158-180) |
| `TVBUG` and `TVBGAR` | Four beetle frames. The retained code XORs successive 32 by 32 arrays and BITBLTs a walking bug upward; an older commented version cycles `TVBUG` A through D. | [Direct runtime](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fdlwhak.lisp&ln=186-234) |
| `WORM` | Five graphical glyphs survive. Source names and uses four of them, `BLACK`, `GRAY`, `STRIPE`, and `BIG`, to draw recursive wormlets; the purpose of the fifth glyph at code 7 is **TODO**. | [Definitions and loading](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fworm.lisp&ln=20-70), [direct drawing use](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fworm.lisp&ln=148-162) |
| `MIT` | Two standing *mens et manus* figures, separately and combined. Period bug mail identifies the font as a fallback for MIT machines without mugshot art. | [Documented use](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=doc%2Fbug.lispm41&ln=5662-5675) |
| `ICONS` | Arrows, pointing hands, key and lock forms, fill samples, X forms, and a small `1983 MIT` mark. An archived external Viewer listing uses octal 110, the pointing hand, as a mouse blinker. | [Documented external use](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=doc%2Fbug.lispm23&ln=766-833) |
| `PANES` | Eighteen miniature pane-subdivision diagrams. | **TODO:** appearance established; no consumer found. |
| `TIMES.9ROM` | Despite its filename, QFASL magic and the serialized binding identify it as the bitmap font `FONTS:TR9`, not raw ROM firmware. | Container identity only. |

A local row-major comparison found the four `TVBGAR` arrays bit-for-bit identical to
the first 32 raster rows of System 46
[`BUG.KST`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmfont/bug.kst)
glyphs A through D. That 733-byte public input has SHA-256
`ad3ed4d542d5058d44d77dc2102410fbc6b1169403f75f1840e4e94fc68b52b8`.
`TVBUG.QFASL` uses the same motif but changes or adds internal markings. This
cross-check establishes lineage between the public beetle source and the later
animation data without assuming that every artifact is byte-identical.

### LM-3 integrity snapshot

These values describe the exact System 303 check-in inspected on 2026-07-17.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `fonts/abacus.qfasl` | 1,108 | `cf75bcb16dfb293ffaff580aafa80c1adab1955f957107bd6ca2d8a4ea2f30c2` |
| `fonts/icons.qfasl` | 17,352 | `b8ac53bf5e08d2522275e39f9233429dec0db38cd4bf6ab4fcfbd603f6731109` |
| `fonts/mit.qfasl` | 7,840 | `cc05b998c21d0ce77355135369357257aa501c8fbca9800591a7394d771fe05f` |
| `fonts/panes.qfasl` | 5,060 | `a444c2969421bcdfa8cfcd58d62fadf2531e5b37874f4150a19d067a42c1eb9e` |
| `fonts/tally.qfasl` | 3,648 | `7bc36b5323ede27c1e6ec97cd61f7cfd37ca2a6da3e986e873655dd7c281cd6c` |
| `fonts/tvbug.qfasl` | 1,904 | `916245010fea659bd0db28bdc4cc5eb39a164e335a5973443810cc54069efc4b` |
| `demo/tvbgar.qfasl` | 740 | `ed50c226d5d34eabd2420acfd3dd6f03e3470802ca8ba64f9d036f59bbb7af43` |
| `fonts/worm.qfasl` | 1,888 | `4fb028df0b2f2d617b105e639af2220b63a0b923627d8bf856473ba71947a2e9` |
| `demo/wormch.ast` | 607 | `24d48c12a4bd73c8aa1a2a93ccbd037d463ee39bf4329798a99c37c5d5d73b41` |
| `fonts/times.9rom` | 13,728 | `7066fdf16bfeee00cf39eada7d86a5e3d55cb69772684d417dac0728dbed5469` |

## PAINT fills, brushes, and window-system patterns

System 46 PAINT embeds nine repeating four-row paint patterns and eight sixteen-row
brush masks in Lisp source. `INIT-PAINTS` tiles the paint patterns into 32 by 32
selectors and the brush masks into 16 by 16 selectors; the source also identifies
the erasing paint, initial paint, and initial brush by list position. The individual
shape names are **TODO** because the source supplies none. The values and selector
roles are explicit in
[`paint.7`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/paint.7#L571-L669).

Two other source-defined display textures have exact UI roles:

- [`LABELS-HALFTONE`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/window.217#L659-L688)
  is a 50 percent alternating checker tile NORed over old-window labels when
  `HALFTONE-LABELS-FLAG` is active;
- the font editor's
  [`GRAY-ARRAY`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/fed.73#L170-L177)
  is a generated 40 by 4 checker tile XORed over a selected grid point.

These are patterns, not hidden picture files. The separate
[color inks and raster patterns](color-inks-and-raster-patterns.md) article explains
the indexed color maps and named monochrome stipples in their display context.

## SUDS drawings and plot streams

The System 46 tree contains a large hardware-design corpus:

| Extension | Files | Bytes | Established interpretation |
| --- | ---: | ---: | --- |
| `.drw` | 324 | 4,776,539 | SUDS drawing/editor material. |
| `.plt` | 86 | 669,231 | 36-bit plot streams containing vector, text, and diamond commands. |
| `.patxy` | 3 | 20,195 | Adjacent CADR memory-board fabrication/layout data; exact render semantics are **TODO**. |
| `.ray` | 3 | 575,360 | Adjacent design/manufacturing data; not classified as a picture without a decoder. |
| `.augat` | 2 | 412,671 | Adjacent design/manufacturing data; not classified as a picture without a decoder. |

The
[`README`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/README#L26-L30)
records that one SUDS file for the Chaosnet board may have been lost from a damaged
tape and later says that the surviving SUDS files
[`appear to be CADR4 schematics`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/README#L69-L74).
The
[`DPLT` reader](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/dplt.63#L121-L185)
explicitly describes `.PLT` as 36-bit files from SUDS and decodes vector, text, and
diamond items for Dover output.

Eight particularly useful `lmdoc` drawings survive as `CHOD1`, `CHODAM`, `CHODI`,
`CHODTM`, `FIG1`, `FIG2`, `FIG3`, and `FIG5`. Their labels and placement in the CADR
documentation identify data paths, microinstruction fields, timing, memory/PDL/VMAP
structure, and system or network topology. System 46 has companion `.PLT` exports
for all of those names except `FIG5`; System 303 has the eight `.DRW` revisions but
no companion `.PLT` files. These are structured technical drawings, not runtime
screen assets.

## Other bounded candidates

- [`lispm1/figs.texsq1`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm1/figs.texsq1)
  is a 9,179-byte ASCII file containing two named coordinate
  sets, `LH24` and `RH24`, with 382 and 385 points. Its consumer and intended visual
  role remain **TODO**. SHA-256:
  `4906646490f0d6776b43e2723aeb096d6f6a36994bdbfcc6ff713fd2fd655d01`.
- [`lmwind/flavor.pictur`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/flavor.pictur)
  is a 726-byte spatial ASCII diagram of window flavor
  relationships, not a bitmap. SHA-256:
  `1f804bb67f631fc384c3ff0b7b6bec16092059f26b01db75ca4547002f1d999c`.
- an archived
  [Color-Ad source payload](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/arc.smldir#L614-L659)
  constructs a 10 by 10 diagonal color cursor at load time. It is a procedural
  archive fragment rather than stored raster data.
- the System 46
  [`lmwind/` directory](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind)
  contains ten formatted `.xgp` document bodies:
  `baswin`, `choice`, `frame`, `operat`, `sheet`, `stream`, `tscrol`, `typout`,
  `window`, and `winman`, totaling 382,258 bytes. They preserve visual/document
  output and even supply font-use evidence, but they are not reusable runtime image
  assets;
- [`window/menu.press`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fmenu.press)
  in System 303 is likewise a formatted Press document rather than a runtime screen
  image.

## Procedural imagery is a separate category

Several visually important CADR programs contain no recoverable final picture:

- [MUNCH](munch.md) generates its XOR pattern from arithmetic and an interactive
  switch register;
- [LEXIPHAGE](lexiphage.md) animates jaws erasing text rendered in `43VXMS`;
- `PICT` survives in System 46 only as the 9,773-byte compiled artifact
  [`lmdemo/pict.qfasl`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdemo/pict.qfasl), SHA-256
  `441432ea110f2e14a646053f62611976a79c55e30647278feb43d6a013527dbc`.
  Non-evaluating symbol and string inspection exposes `RANDOM-POINT-VECTOR`,
  `DRAW-LINE`, `CIRCLE`, `HYPERBOLA`, `CYCLE`, `POLY-CYCLE`, and `WARP`; that is
  enough to classify it as procedural, but not to claim recovery of its original
  source;
- the GEB/GODEL/ESCHER/KUPFER material, QIX, Spacewar, and many display hacks
  similarly generate frames from code and state.

Preserving these requires source, runtime behavior, and interaction semantics rather
than merely exporting an image. A screenshot can illustrate one run, but it is not a
substitute for the program.

## Open questions

- Identify the book, edition, and rights status of the `SCANIN CWH3` page.
- Establish the photographer and publication rights of `10LEAF`.
- Find a consumer or documentation for `figs.texsq1` and determine what its two
  coordinate fields represent.
- Decode the SUDS `.DRW` editor format and the `.PATXY`, `.RAY`, and `.AUGAT`
  manufacturing formats without treating all of them as image formats by default.
- Find an executable consumer for the LM-3 `PANES` font and establish whether the
  full `ICONS` atlas had a standard system role.
- Locate authoritative license or provenance metadata for the maintained LM-3
  Fossil corpus before tracking derived glyph sheets from its LM-3-only artifacts.

Last verified: 2026-07-17.

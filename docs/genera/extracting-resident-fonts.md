---
type: Preservation Note
title: Extracting resident fonts from a Genera world
description: Reproducible local extraction of resident Genera 8.5 screen fonts into BDF, normalized records, and specimen sheets without redistributing licensed assets.
tags: [genera, open-genera, vlod, fonts, preservation]
timestamp: 2026-07-16T15:15:02-04:00
---

# Extracting resident fonts from a Genera world

## Bottom line

The tracked `scripts/extract-genera-fonts.py` program recovers the one-bit glyphs and
display metrics of resident `FONT` objects directly from a little-endian VLM VLOD V2
world. For the inspected Genera 8.5 base world it finds 89 distinct font objects. A
separate symbol walk finds 90 bindings because `TV:*DEFAULT-FONT*` and
`FONTS:CPTFONT` point to the same object.

The recovered BDF files, normalized JSON records, and PNG specimen sheets remain
derivative copies of licensed Symbolics material. They are generated under
`build/fonts/genera/`, which is ignored by Git, and must not be committed or
redistributed. The extractor contains no font bitmaps and is the preservation
deliverable that can be shared.

## Reproduce the extraction

The examples assume the licensed Open Genera installation is in the repository's
usual local-only `.lm-home` directory. List the resident fonts without writing any
derived files:

```sh
python3 scripts/extract-genera-fonts.py \
  .lm-home/opengenera/runtime/Genera-8-5.vlod \
  --list
```

Extract the complete local collection:

```sh
python3 scripts/extract-genera-fonts.py \
  .lm-home/opengenera/runtime/Genera-8-5.vlod \
  --output build/fonts/genera \
  --clean
```

Validate the decoded world objects against the BDF and BFD files supplied with the
same licensed Genera release:

```sh
python3 scripts/extract-genera-fonts.py \
  .lm-home/opengenera/runtime/Genera-8-5.vlod \
  --output build/fonts/genera \
  --clean \
  --reference-bdf-dir \
    .lm-home/opengenera/runtime/sys.sct/x11/fonts/bdf/genera \
  --reference-bfd-dir \
    .lm-home/opengenera/runtime/sys.sct/fonts/tv
```

One font or glyph can be inspected without extracting the whole collection:

```sh
python3 scripts/extract-genera-fonts.py \
  .lm-home/opengenera/runtime/Genera-8-5.vlod \
  --font CPTFONT --glyph 0o101
```

`--glyph` accepts Python-style hexadecimal or octal notation. Run `--help` for sheet
scale, column-count, and filtering options.

An existing output directory is rejected unless `--clean` is explicit. Clean mode
removes only the extractor-owned `bdf`, `json`, `sheets`, manifest, and validation
paths; it refuses to proceed if the directory contains an unrecognized entry. This
prevents renamed or removed fonts from leaving stale derivatives in a later run.

## Generated files

Each extraction writes:

- `manifest.json`, with source filename, byte size, SHA-256 digest, format, font
  count, metrics, and generated relative paths;
- `json/*.json`, normalized glyph rasters and metrics for machine inspection;
- `bdf/*.bdf`, a portable reconstruction of the represented display font;
- `sheets/*.png`, deterministic visual inventories of all represented glyphs; and
- `validation.json` when either reference-directory option is supplied.

The specimen sheets sort glyphs by code and label them in octal, the convention used
by much Lisp-machine documentation and source material. A pale horizontal line in
each cell marks the decoded baseline. The dark pixels are positioned using the
resident advance, left-kern, vertical offset, raster height, and baseline values; the
sheet is therefore also a visual check of placement rather than only a bitmap dump.

Do not link these local sheets from the public catalog or copy them into `docs/`.
Their predictable location is `build/fonts/genera/sheets/<lowercase-name>.png`, for
example `build/fonts/genera/sheets/cptfont.png`.

## What the decoder reconstructs

The program reads the VLOD header and load map, reconstructs tagged Qs at their
Genera virtual addresses, follows forwarding pointers, and recognizes rank-two
one-bit arrays whose named structure is `FONT`. It then decodes the array leader,
packed raster, per-character existence, width, indexing, and left-kern tables. It
also handles the historical non-spacing character slots that some fonts retain above
their apparent array fill pointer; simply iterating to the fill pointer would omit
those glyphs.

This is an effect-level reconstruction of the resident screen asset. It preserves the
represented pixels and the basic metrics needed to position them. It does not claim
to recreate byte-identical source BFD or BDF files, comments, discarded authoring
properties, source filenames, or an earlier tool's choice of compact glyph rectangle.
For preservation of the supplied authoring representation, the licensed release's
separate font files remain preferable to a heap reconstruction.

## Raster display fonts and outline hardcopy fonts

All 89 objects recovered by this extractor are raster fonts: each is a rank-two,
one-bit `FONT` array containing display pixels and associated metrics. This agrees
with Genera's documented screen-font model and with the BDF representations supplied
for the Genera X client. Scaling or rotating an image made from one of these fonts
does not turn its stored representation into an outline font.

That result must not be generalized to mean that Genera had no outline-font support.
The licensed Genera 8.5 PostScript hardcopy source has a separate font abstraction
with both built-in and downloadable outline-font classes. Built-in PostScript device
fonts are selected by family and point size. For downloadable fonts, Genera can read
Bitstream `BSFONT` character contours, retain their outline segments, and emit the
used contours as a scalable PostScript Type 3 font. The same hardcopy implementation
also supports downloadable bitmap fonts. These objects are not named one-bit `FONT`
arrays, so the resident-screen-font extractor neither enumerates nor converts them.

A low-level audit of the exact base world identified below enumerated every mapped
data-page Q with the tracked VLOD reader, found the compiled outline-font machinery
and two symbol objects named `BS-FONT`, and checked every reference to those symbols.
It found no property-list association of the form used to register a loaded Bitstream
font family. The evidence therefore supports this narrower conclusion: the base world
contains the implementation, but does not appear to contain a configured downloadable
Bitstream outline-font library. This reference audit is not a complete heap
decompiler, so it is not formal proof that no unreachable contour-shaped object could
exist.

For preservation work, the useful distinction is:

| Layer | Representation in this investigation |
| --- | --- |
| Genera screen and X-client fonts | One-bit raster `FONT` objects and BDF files |
| Built-in PostScript printer fonts | Device resources selected by name and scale; their glyph data need not be in the world |
| Downloadable Bitstream hardcopy fonts | Outline objects supported by Genera, but no registered payload identified in this base world |

## Validation result

The matching Genera 8.5 release provides two useful, independent comparisons. The
validation command above produced these results:

| Reference set | Result for the 89 resident fonts |
| --- | --- |
| Binary BFD files in `sys.sct/fonts/tv` | 88 matches for every compared runtime field; `40VR` differs only because seven character codes occur in the BFD but not in the resident object, while every shared glyph matches. |
| X BDF files in `sys.sct/x11/fonts/bdf/genera` | 82 matches for every compared glyph field; five differ only in represented character codes (`40VR`, `CPTFONTCC`, `CPTFONTI`, `MOUSE`, and `TVFONT`); `EUREX21I` and `TVFONTI` have substantive shared-glyph differences. |

The BFD comparison covers font name, line spacing, baseline, default width,
character-code set, per-character advance, and positioned pixels. The BDF
comparison covers character-code set, `DWIDTH`, `BBX`, and bitmap. It deliberately
does not claim equality for untested properties, comments, scalable-width convention,
or file bytes. The two substantive BDF differences are retained as findings, not
silently normalized away. Whether they reflect a different source revision, a
load-time transformation, or another cause remains `TODO`; the matching BFD fields
show that the world decoder agrees with the supplied native font assets for those
objects within this comparison boundary.

## Artifact and implementation scope

The observations on this page apply to this exact licensed local artifact:

- filename: `Genera-8-5.vlod`;
- size: 54,804,480 bytes;
- SHA-256: `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`;
- format accepted by the extractor: little-endian VLM VLOD V2.

The decoder is intentionally narrower than a general Genera heap reader. It supports
the VLOD operations and array layouts needed by this world and fails on a wrong cookie
or unsupported structure rather than treating arbitrary data as a font. Results for
another release or an incremental world must be validated again.

For the distinction between resident assets and original source files, see
[Recovering code and assets from a Genera world](recovering-code-and-assets-from-worlds.md).
For the complete evidence-graded inventory, see the
[Genera 8.5 resident font catalog](font-catalog.md).

## Sources

- Symbolics, [*Programming the User Interface*](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf),
  especially PDF pages 344–347, for screen-font representation and metrics.
- Symbolics, [*Open Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf),
  “Font Support in the Genera X Client,” for the supplied X BDF fonts.
- X Consortium, [*Glyph Bitmap Distribution Format 2.1*](https://www.x.org/releases/X11R7.0/doc/PDF/bdf.pdf),
  for the public BDF interchange format.
- Licensed Genera 8.5 source inspected locally, identified without quotation or
  redistribution: `sys.sct/io1/lfont-defs.lisp.~2~`,
  `sys.sct/io1/bfd.lisp.~135~`, `sys.sct/io1/bfd-misc.lisp.~1521~`, and
  `sys.sct/io1/pxl.lisp.~1520~` for screen fonts, plus
  `sys.sct/hardcopy/postscript.lisp.~1681~` for built-in, bitmap-downloadable, and
  outline-downloadable hardcopy font handling.

Last verified: 2026-07-16.

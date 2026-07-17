---
type: Artifact Analysis
title: MIT CADR compiled QFASL font recovery
description: Non-evaluating recovery of 19 public System 46 compiled font artifacts into inspectable BDF, JSON, and PNG derivatives.
tags: [mit-cadr, fonts, qfasl, compiled-artifacts, preservation]
timestamp: 2026-07-17T01:17:24-04:00
---

# MIT CADR compiled QFASL font recovery

## Conclusion

All 19 reviewed compiled font files in the public System 46 `src/lmfont` tree are
recoverable as runtime bitmap-font objects. They are serialized `FONT` arrays in
QFASL containers, not load-band snapshots and not opaque native-code programs. The
repository's
[`extract-cadr-qfasl-fonts.py`](../../scripts/extract-cadr-qfasl-fonts.py) decodes
them without evaluating Lisp, applying functions, loading compiled code, or running
an emulator.

The recovered corpus contains 17 runtime logical names that have no matching AST,
KST, Alto, or cold-font source representation in this snapshot. The remaining two
files, `N43XMS` and `NTOG`, are older compiled artifacts that bind the source-backed
runtime names `FONTS:43VXMS` and `FONTS:TOG`. Keeping those two under their artifact
names preserves version evidence instead of silently replacing the source-derived
fonts.

The tracked derivatives are preservation exports of the serialized runtime state.
They are meaningfully usable as bitmap fonts, but they are not recovered authoring
source: comments, compiler inputs, construction history, and any higher-level design
intent were already absent from the QFASLs.

## Public provenance and scope

The inputs are from the public
[`mietek/mit-cadr-system-software`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmfont)
repository at commit `8e978d7d1704096a63edd4386a3b8326a2e584af`. Its
[`src/README` provenance note](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/README)
identifies the material as a System 46 snapshot recovered from MIT AI Laboratory ITS
backup tapes. The accompanying
[`src/LICENSE`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/LICENSE)
is the three-clause BSD license and is copied beside the generated assets.

This work uses only those public CADR files. It does not inspect a VLOD, a load band,
or licensed Symbolics Genera media. That boundary is important: the public outputs in
this page may be tracked, while recovered Genera glyph data remains local and
ignored.

The extractor uses a closed manifest of the 19 reviewed inputs. It verifies each
filename, byte length, SHA-256 digest, and the source license digest before decoding.
The exact per-file provenance, decoded-word digest, QFASL operation inventory,
metrics, tables, and output paths are in the tracked
[`catalog.json`](../assets/mit-cadr-qfasl-fonts/catalog.json).

## Why a QFASL can contain a font

A Lisp Machine QFASL is a serialized object-and-operation stream used by the fast
loader. The full format can express executable actions such as `EVAL`, `APPLY`,
compiled-function construction, and microcode linkage; it is therefore not safe to
treat an arbitrary QFASL as passive data. The contemporary
[`FASL-OPS` table](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qdefs.326#L191-L217)
defines that larger operation language.

These 19 files use a much smaller, inert subset. Across the corpus, the only
operations observed are:

- table references, symbols, package symbols, strings, fixed integers, and lists;
- array construction and numeric or object-array initialization;
- stores into an array leader and one `FONTS` symbol value;
- whack and file terminators.

There are no evaluation, application, compiled-function, relocation, or microcode
operations. The museum extractor implements only the 14 observed operations and
rejects every other opcode. It also rejects unsupported FASL parameter references,
displaced arrays, unexpected named structures, inconsistent group lengths, malformed
packing, multiple initializations, and oversized object graphs. This is a deliberately
non-evaluating decoder, not a general QFASL loader.

The original loader describes each operation as a recursively decoded group and
stores constructed values in a FASL table for later references; see
[`FASL-GROUP`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qfasl.283#L186-L221)
and the contemporary
[`array operations`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qfasl.283#L351-L406).
The extractor models only enough of that object graph to reconstruct and validate one
serialized `FONT` binding per file.

## Encoding layers

The public files first require the same ITS tape-evacuation reversal used for the
source-font recovery. That stage reconstructs PDP-10 36-bit words from the repository
bytes. Each recovered word then contributes two 16-bit QFASL nibbles, at bits 20–35
and 4–19; the low four bits must be zero. The stream begins with the two octal magic
values `143150` and `071660`, the values checked by the historical
[`FASLOAD`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qfasl.283#L62-L88).

QFASL arrays can pack several historical array element types. The font corpus needs
`ART-1B` raster and existence bits, `ART-8B` width tables, `ART-16B` indexing tables,
`ART-32B` signed 24-bit left-kern values, and generic `ART-Q` arrays. The 24-bit
payload of an `ART-32B` element follows the historical
[`ARRAY-BITS-PER-ELEMENT` definition](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qcom.434#L491-L504);
the remaining byte is a Lisp Machine Q tag rather than another eight payload bits.

## Reconstructing the runtime `FONT`

The serialized raster is a one-dimensional `ART-1B` array whose leader is a named
`FONT` structure. The contemporary
[`FONT` definition](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/tvdefs.52#L12-L38)
records character and raster heights, fixed width, raster packing, baseline, optional
width, left-kern, indexing and existence tables, blinker metrics, and the font name.

The extractor validates the leader and raster as one coherent object before export:

- raster width is between 1 and 32 bits;
- baseline lies within the declared character cell;
- rasters per word and words per character agree with the declared dimensions;
- optional tables have the exact historical 128- or 129-entry sizes;
- an indexing table starts at zero, is monotonic, and ends at the raster-storage
  count;
- packed initializers have the exact required halfword count and valid padding and
  Q tags;
- the raster array contains exactly the number of bits implied by its metrics;
- the next-plane slot is `NIL`, so the single-plane exporter cannot silently lose a
  linked plane;
- the QFASL binds exactly one `FONT` object to the expected `FONTS` symbol.

Wide characters are not cropped to their apparent ink. The historical
[`FONT-GET-PIXEL`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fntcnv.28#L93-L136)
uses the indexing table to select one or more physical raster-width stripes. The BDF,
JSON, and sheet exports follow that lookup exactly and retain the complete physical
storage/draw width, including blank compiler padding. If a characters-exist table is
absent, all 128 slots are exported because the `FONT` definition says they must be
assumed to exist. `SHIP` is the exception with an explicit table: it exports 67
codes, precisely `000`, `001`, `040`, and `100` through `177` in octal.

### Screen-controller ordering caveat

The QFASL does not say whether its raster was built for a 16-bit or 32-bit screen
controller. The contemporary
[`FONT` comments](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/tvdefs.52#L4-L9)
say those controllers require differently ordered fonts, while the
[`FCMP` entry points](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fcmp.66#L29-L75)
reverse the raster Qs only in 32-bit mode. No controller-mode field appears in the
serialized leader.

The extractor therefore exports the logical bit-array coordinates read by
`FONT-GET-PIXEL`, which the source-backed rendering controls independently support.
It does not assign controller provenance or invite a second raw-Q bit reversal. A
preservation tool interpreting raster Q words directly must obtain the controller
mode from evidence outside the `FONT` object.

## Recovered artifacts

`W`, `K`, `I`, and `E` below mean character-width, left-kern, indexing, and
characters-exist tables. “Raster width” is the physical stripe width, not a guessed
ink bounding box.

| Artifact | Input | Runtime name | Height | Baseline | Raster width | Exported glyphs | Tables |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `20VR` | `20vr.qfasl` | `20VR` | 20 | 15 | 22 | 128 | W |
| `31VR` | `31vr.qfasl` | `31VR` | 31 | 25 | 25 | 128 | W |
| `40VR` | `40vr.qfasl` | `40VR` | 40 | 30 | 32 | 128 | WI |
| `BIGVG` | `bigvg.qfasl` | `BIGVG` | 25 | 20 | 21 | 128 | WKE |
| `CPT-13FG` | `3213fg.qfasl` | `CPT-13FG` | 13 | 11 | 8 | 128 | none |
| `CPT-HL10` | `32hl10.qfasl` | `CPT-HL10` | 12 | 9 | 16 | 128 | W |
| `CPT-HL10B` | `3hl10b.qfasl` | `CPT-HL10B` | 12 | 9 | 16 | 128 | W |
| `CPT-TR10I` | `3tr10i.qfasl` | `CPT-TR10I` | 12 | 9 | 16 | 128 | W |
| `GERM35` | `germ35.qfasl` | `GERM35` | 40 | 31 | 16 | 128 | WI |
| `HL12BI` | `hl12bi.qfasl` | `HL12BI` | 14 | 11 | 16 | 128 | WE |
| `MEDFNB` | `medfnb.qfasl` | `MEDFNB` | 13 | 11 | 9 | 128 | WKE |
| `S30CHS` | `s30chs.qfasl` | `S30CHS` | 30 | 30 | 30 | 128 | none |
| `S35GER` | `s35ger.qfasl` | `S35GER` | 35 | 30 | 29 | 128 | W |
| `SAIL12` | `sail12.qfasl` | `SAIL12` | 14 | 11 | 8 | 128 | W |
| `SEARCH` | `search.qfasl` | `SEARCH` | 12 | 8 | 32 | 128 | WKIE |
| `SHIP` | `ship.qfasl` | `SHIP` | 19 | 10 | 19 | 67 | KE |
| `TR12B1` | `tr12b1.qfasl` | `TR12B1` | 16 | 13 | 16 | 128 | W |
| `N43XMS` | `n43xms.qfasl` | `43VXMS` | 43 | 35 | 31 | 128 | WI |
| `NTOG` | `ntog.qfasl` | `TOG` | 29 | 20 | 20 | 128 | none |

The artifact and runtime names differ in three noteworthy cases. `N43XMS` and
`NTOG` bind `FONTS:43VXMS` and `FONTS:TOG`; `SHIP` binds `FONTS:SHIP` even though its
serialized leader-name slot is `NIL`. `GERM35` has a bare `GERM35` leader name while
its exported binding is `FONTS:GERM35`. The binding is the operative runtime name;
the catalog retains the leader value rather than normalizing the discrepancy away.

The preserved
[`LMFONT` inventory](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/wall.3#L331-L383)
dates `N43XMS` and `NTOG` to October 16, 1978, and the corresponding `43VXMS` and
`TOG` QFASLs to March 11, 1980. “Older” here is therefore an inventory-backed
version distinction, not an inference from the `N` prefix.

The separate [font usage audit](font-usage-audit.md) establishes application roles
only where source evidence supports them. Recovery does not turn a filename, font
shape, or compiled presence into evidence of purpose.

## Semantic cross-checks

Six comparisons test both the decoder and the boundary between compiled artifacts
and source-derived fonts:

| Compiled input | Source-derived reference | Result |
| --- | --- | --- |
| `hl10.qfasl` | `hl10.bdf` | All 95 source-represented glyphs match in character height, baseline, advance, set-pixel coordinates, and physical bitmap cell. |
| `43vxms.qfasl` | `43vxms.bdf` | All 70 source-represented glyphs match in height, baseline, advance, and set-pixel coordinates. All 70 physical widths differ because the compiled export retains 32-pixel storage stripes while the source-derived BDF crops blank padding. |
| `arrow.qfasl` | `arrow.bdf` | All 14 source-represented glyphs match in height, baseline, advance, and set-pixel coordinates. All 14 physical widths differ because the compiled export retains complete storage stripes. |
| `bigfnt.qfasl` | `bigfnt-kst.bdf` | All 128 glyphs match in height, baseline, advance, and set-pixel coordinates, exercising the generic array-dumper form. Physical widths differ for 125 glyphs because the source-derived BDF crops blank padding. |
| `ntog.qfasl` | `tog.bdf` | All eight source-represented glyphs also match in physical bitmap cell. A separate digest-pinned comparison with the newer `tog.qfasl` finds the same reconstructed glyph storage and metrics; the newer reconstructed leader adds one final `NIL` slot. |
| `n43xms.qfasl` | `43vxms.bdf` | A real older variant, not an exact match. See below. |

Here “rendering match” has a deliberately narrow, machine-readable definition:
character height, baseline, advances, and coordinates of every set pixel agree for
every source-represented glyph. A separate physical-cell result compares bitmap
dimensions and offsets. Blank storage padding therefore remains visible as evidence
without becoming a false decoding failure. Extra compiled character slots are listed
but do not make a source-represented comparison fail.

The compiled-version comparison pins both `ntog.qfasl` and `tog.qfasl`. Their QFASL
operation streams and table layouts differ and are inventoried separately in the
catalog; they are not byte- or serialization-identical. After both streams are
reconstructed, their runtime `FONT` bindings have the same raster-Q digest, glyph
storage, metrics, and common leader values. The sole reconstructed-object difference
is the newer leader's explicit final `NIL` at index `20` octal.

The first four controls cover both QFASL forms emitted by the contemporary font
compiler. Its direct
[`FASDUMP-FONT`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fcmp.66#L171-L225)
path explicitly writes the font leader, auxiliary arrays, raster Qs, and symbol
binding; later files use the generic array dumper but reconstruct to the same runtime
model.

### The older `N43XMS` variant

`N43XMS` has raster width 31, while the source-derived/current `43VXMS` has raster
width 32. A direct runtime-coordinate comparison differs for 69 of the 70
source-represented glyphs. That is the correct preservation result: the exporter does
not invent a universal offset or force an old compiled artifact to equal newer
source.

For analysis only, shifting the compiled pixels one column left gives the closest
alignment. After that alignment there are no compiled-only pixels, but 429
source-only pixels remain. They all occur at logical source column 30 across 26
glyphs. This establishes a precise relationship between the versions; it does not
establish why the older artifact omitted those pixels or whether the difference was
intentional. The unshifted runtime raster remains the exported `N43XMS` font.

The complete code lists and counts for this comparison are retained in
[`catalog.json`](../assets/mit-cadr-qfasl-fonts/catalog.json), rather than reduced to
a claim that the variants are “basically the same.”

## Reproduce the tracked assets

From the repository root, set `CADR_CHECKOUT` to a checkout of the public repository
and verify its exact revision:

```sh
CADR_CHECKOUT=../mit-cadr-system-software
test "$(git -C "$CADR_CHECKOUT" rev-parse HEAD)" = \
  8e978d7d1704096a63edd4386a3b8326a2e584af
python3 scripts/extract-cadr-qfasl-fonts.py \
  "$CADR_CHECKOUT/src/lmfont" \
  --output docs/assets/mit-cadr-qfasl-fonts \
  --reference-assets docs/assets/mit-cadr-fonts \
  --clean
```

`--reference-assets` performs the six semantic comparisons and records them in the
catalog. `--clean` replaces only extractor-owned paths and refuses a destination that
contains unrecognized entries.

The generated public derivatives are:

- [`catalog.json`](../assets/mit-cadr-qfasl-fonts/catalog.json), with exact input
  provenance, QFASL inventories, object observations, metrics, and comparisons;
- [`bdf/`](../assets/mit-cadr-qfasl-fonts/bdf/), containing 19 portable bitmap fonts;
- [`json/`](../assets/mit-cadr-qfasl-fonts/json/), containing 19 normalized,
  per-glyph inspection records;
- [`sheets/`](../assets/mit-cadr-qfasl-fonts/sheets/), containing 19 PNG specimen
  sheets labeled with octal character codes;
- [`LICENSE.source`](../assets/mit-cadr-qfasl-fonts/LICENSE.source), copied from the
  public source snapshot.

## Preservation boundary

This recovery is closer to extracting a serialized object than decompiling a program.
The QFASLs retain glyph bits, runtime metrics, optional tables, and the destination
symbol, so those effects can be exported faithfully. They do not retain enough
information to recreate the original AST, KST, or Alto authoring representation or
to say how a designer produced a glyph. A generated BDF is therefore a useful
recovered font, but a reconstructed derivative rather than historical source code.

The operation inventory is specific to these reviewed files. The absence of
executable operations here must not be generalized to arbitrary QFASLs. Any future
compiled-font additions require their own digest-pinned review before admission to
the manifest.

## Open questions

- Compare these exports with the same objects loaded in a running System 46 world.
  That would independently exercise the historical loader and renderer.
- Establish from period source or release evidence why `N43XMS` has a 31-pixel
  physical stripe and omits the pixels present at source column 30 in the newer
  `43VXMS` representation.
- Locate additional primary evidence for the 14 compiled-only runtime names whose
  application purpose remains `TODO` in the usage audit.

Last verified: 2026-07-17.

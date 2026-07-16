---
type: Artifact Analysis
title: MIT CADR font sources and recovery
description: Source-first recovery of the public MIT CADR bitmap fonts into inspectable BDF files and font-sheet images.
tags: [mit-cadr, fonts, source-recovery, preservation]
timestamp: 2026-07-16T13:36:54-04:00
---

# MIT CADR font sources and recovery

## Conclusion

The source-represented CADR font corpus can be recovered directly from the public
source tree. There is no reason to mine a load band, emulator heap, or Symbolics VLOD
for these fonts. The repository's
[`extract-cadr-fonts.py`](../../scripts/extract-cadr-fonts.py) reconstructs the
archived PDP-10 words, decodes the font source formats, and emits portable BDF fonts
and PNG font sheets.

Against revision `8e978d7d1704096a63edd4386a3b8326a2e584af` of the public
[`src/lmfont` tree](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmfont),
the default extraction emits 150 font artifacts representing 88 logical names. The
difference is intentional: 62 source variants have materially different glyphs or
metrics and are preserved separately rather than silently collapsed.

These outputs are normalized preservation derivatives. They retain character codes,
declared metrics, and every recoverable set pixel, including pixels outside some
Alto records' declared extents. They are not claimed to be byte-identical QFASL
files, runnable CADR font objects, or byte-for-byte reproductions of what historical
`FNTCNV` would load.

## Provenance and licensing

The input is the public `mietek/mit-cadr-system-software` repository at commit
`8e978d7d1704096a63edd4386a3b8326a2e584af`. Its `src/README` identifies the material
as an early MIT AI Laboratory CADR snapshot, System 46, recovered from four ITS
backup tapes. The source license is the three-clause BSD license, despite the
README's informal description of it as an "MIT license". The exact
[`src/LICENSE`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/LICENSE)
is copied beside the generated assets as `LICENSE.source`.

There is an unresolved date discrepancy in the public provenance record. The tape
labels transcribed in `src/README` say `10/17/81`, while the extracted archive filename
contains `101780`. This page does not choose between them; establishing the exact tape
date remains a TODO.

## Why the files need decoding

Files under `src/lmfont` are not ordinary host-byte copies of their historical ITS
contents. They use Alan Bawden's evacuated representation of PDP-10 data. The first
stage therefore reverses the text escapes and quoted binary-word encoding to recover
36-bit words. The implementation follows the public
[`itstar` unpacker](https://github.com/PDP-10/itstar/blob/56ac56918ca5a134d9bd9882b519003108ab4581/unpack.c)
rather than treating the apparent ASCII as a modern text file.

The extractor then handles these source containers and formats:

| Input | Recovery rule | Evidence |
| --- | --- | --- |
| `arc.ast's` | Read the `ARC!!!` directory, allocation descriptors, and block chains; ignore directory entries marked deleted; parse each live member as AST font source. `DMARCD` describes `ARC!!!` as its "new flavor" archive convention. | The archive logic is checked against the contemporary [`DMARCD`](https://github.com/PDP-10/its/blob/8ea145f42cabccfad054321a35e1493c1c67970c/src/sysen2/dmarcd.31) implementation. |
| `ar1.1` | Read a second `ARC!!!` container whose members are Xerox Alto `CONVERT` font sources. Preserve both ITS names, select the greatest numeric second name, and retain character-pointer and declared-extent findings for every member. | The public [`AR1 1` archive](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmfont/ar1.1) is decoded with the same ARC logic; its payload structure matches the CADR Alto reader and the contemporary Xerox format description. |
| `.ast` | Read the header and form-feed-delimited glyph pages, including per-glyph width and left-kern metrics. | The recovered structure follows the CADR compiler's [`RD-AST`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fcmp.66#L228-L318) reader. |
| `.kst` | Read the PDP-10 interchange header, character records, raster words, and end marker. | CADR [`FNTCNV`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fntcnv.28#L1-L17) identifies KST as the PDP-10 interchange format; the ITS [`KST format`](https://github.com/PDP-10/its/blob/8ea145f42cabccfad054321a35e1493c1c67970c/doc/xfont/kst.format) document supplies the record layout. |
| `.al` | Decode Xerox Alto `CONVERT` font data using the semantics implemented by CADR `FNTCNV`. | See the [`ALTO .AL` loader](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fntcnv.28#L747-L819) and the Xerox [font-format description](https://xeroxparcarchive.computerhistory.org/indigo/printingdocs/.FONTFORMATS.PRESS%211.pdf), pages 12–13. |
| `.cldfnt` | Optionally decode the compiler's textual cold-font dump. | [`MAKE-COLD-FONT`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/fcmp.66#L79-L100) writes this representation. It is excluded by default because the archive already contains TVFONT's AST font source. |

An ARC allocation descriptor counts logical 1024-word file blocks; that count is
not the number of physical nodes in the data-block chain. The extractor derives the
declared word length from the logical count, then independently checks every physical
node's header/trailer agreement, predecessor and successor links, final marker, and
aggregate word length. Both counts are retained in the catalog.

Compiled `.qfasl`, `.oqfasl`, and `.unfasl` files in the directory are deliberately
not inputs to this source-first process.

## Extraction result

The inspected `arc.ast's` directory has 72 entries: 71 live AST font source members
and one ignored older `CLAR12` entry. All 71 live members parse. The separate `ar1.1`
archive has 63 live Alto members under 62 logical names because `PRONTO` has versions
1 and 2; numeric ITS version selection chooses version 2. After source precedence and
duplicate handling, the emitted set comprises:

- 71 fonts from live AST font source archive members;
- 11 additional fonts from standalone AST font sources;
- six emitted KST sources, including four new logical names and two divergent
  variants;
- 62 selected Alto sources from `ar1.1`, adding the logical names `CLRE14` and
  `PRONTO` and retaining 60 materially different historical variants.

Twelve alternate sources normalize to the same metrics and glyphs as an already
emitted representation and are recorded in the catalog without being emitted again:
standalone AST font sources for `43VXMS`, `APL14`, `ARR10`, and `TONTO`; KST sources
for `BUG` and `TOG`; and standalone Alto sources for `TR10`, `TR10B`, `TR12`,
`TR12I`, `TR14`, and `TR18` that equal their `ar1.1` members. "Same" here means
semantic equality after decoding, not byte-for-byte equality of unlike containers.

The 62 emitted variants consist of two KST variants and 60 `ar1.1` Alto variants:

- `ARROW-KST` and `BIGFNT-KST` retain the divergent KST representations;
- names ending in `-AL-AR1` retain historical Alto representations when a
  higher-precedence AST or KST representation has the same logical name.

The archive catalog also retains the unselected `PRONTO 1` source record. It is not
emitted as another font because contemporary numeric version selection chooses
`PRONTO 2`.

### Character-pointer partial Alto members

All 63 `ar1.1` members have a valid archive and Alto structure, but seven member
versions contain one or two objectively impossible control-character pointers. The
extractor does not mask, reinterpret, or invent those glyphs. It omits only the bad
character record and marks the character-pointer integrity as `partial`. Six selected
outputs are affected:

| Selected source | Omitted octal codes |
| --- | --- |
| `CLARGK 1` | `003`, `004` |
| `HIP10A 1` | `003`, `004` |
| `PRNT10 1` | `001` |
| `PRONTO 2` | `003` |
| `PRT12B 1` | `001` |
| `SMT14A 1` | `003`, `004` |

The seventh partial member is the unselected `PRONTO 1`. Its version-2 successor
repairs code `004` but retains the invalid code `003`. `--strict` still succeeds
because these are explicit partial recoveries rather than rejected sources; the
catalog records each bad raw pointer, error, omitted code, member hash, and selection
decision.

### Declared-extent recovery in Alto members

Character-pointer integrity and raster-extent recovery are separate findings. A
member can have a complete pointer table while containing set pixels outside the
dimensions declared by its Alto metrics. In this source revision, 45 emitted
`ar1.1` fonts have 142 character-code records with horizontal set pixels beyond the
declared advance. In the selected `PRT12B 1` member, code `030` has a second nonzero
row at Y=15 even though the declared line height is 15, whose zero-based nominal
range ends at Y=14.

The extractor preserves those observed pixels by widening or extending the
normalized glyph raster as needed while retaining the declared advance and line
height as metrics. This is an explicit recovery transformation, not a correction to
the historical source and not evidence that the affected records were byte-for-byte
loadable by the historical `FNTCNV` path. The catalog reports declared-extent
recovery separately from bad character pointers so that a structurally complete
member is not mislabeled as pointer-partial. Whether any out-of-extent pixels were
intentional, tolerated by a particular historical build, or reflect source damage is
TODO; the decoded records alone do not establish that explanation.

The public source files `tr12.al` and `tr14.al` are byte-identical. The catalog records
that archival fact without inferring why the two names were retained.

## Reproduce the tracked assets

From this repository's root, set `CADR_CHECKOUT` to a checkout of the public source
repository and verify its revision before extracting:

```sh
CADR_CHECKOUT=../mit-cadr-system-software
test "$(git -C "$CADR_CHECKOUT" rev-parse HEAD)" = \
  8e978d7d1704096a63edd4386a3b8326a2e584af
python3 scripts/extract-cadr-fonts.py \
  "$CADR_CHECKOUT/src/lmfont" \
  --output docs/assets/mit-cadr-fonts \
  --clean \
  --omit-json \
  --strict
```

`--clean` replaces only the extractor-owned asset paths and refuses a destination
containing unrecognized entries. This makes a regeneration remove obsolete filenames
instead of silently retaining artifacts from an older source or naming rule.

The tracked derivatives are:

- [`catalog.json`](../assets/mit-cadr-fonts/catalog.json), containing source hashes,
  decoded metrics, archive observations, duplicate decisions, variants, and output
  paths;
- [`bdf/`](../assets/mit-cadr-fonts/bdf/), containing 150 portable bitmap fonts;
- [`sheets/`](../assets/mit-cadr-fonts/sheets/), containing 150 PNG font sheets whose
  glyph labels use octal character codes;
- [`LICENSE.source`](../assets/mit-cadr-fonts/LICENSE.source), the license shipped with
  the public source snapshot.

Omit `--omit-json` when per-font normalized JSON is useful for analysis. The catalog,
BDF, and sheets are still written either way.

## Source-only coverage boundary

The 88 logical names are all names recoverable from the AST, KST, Alto, and optional
cold-font source representations in this exact snapshot. They are not every compiled
font present in `src/lmfont`, and this page does not claim that every CADR font ever
used has been recovered.

Nineteen additional `.qfasl` files decode as compiled `FONT` objects but have no
matching source representation in this snapshot. They represent 17 additional
runtime logical names: `20VR`, `31VR`, `40VR`, `BIGVG`, `CPT-13FG`, `CPT-HL10`,
`CPT-HL10B`, `CPT-TR10I`, `GERM35`, `HL12BI`, `MEDFNB`, `S30CHS`, `S35GER`,
`SAIL12`, `SEARCH`, `SHIP`, and `TR12B1`. The remaining two compiled files,
`N43XMS` and `NTOG`, are older compiled versions of the source-backed `43VXMS` and
`TOG` names. QFASL decoding is a separate compiled-artifact recovery task and is left
as TODO rather than mixed into this source-first extractor.

## Uses established by source references

Font names alone are not evidence of purpose. The following uses are grounded in
direct references in the same public source snapshot. Application-specific uses for
the remaining fonts are **TODO** until similarly direct evidence is cataloged.

| Font | Established use | Direct evidence |
| --- | --- | --- |
| `CPTFONT` | Default font of the main screen; also the first font QFASL in the cold-load list. | [`tvdefs.181`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/tvdefs.181#L166-L193), [`coldut.22`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/coldut.22#L957-L971) |
| `MEDFNT` | Screen menu font and questionnaire text. | [`menu.29`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/menu.29#L103-L116), [`quest.42`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/quest.42#L196-L207) |
| `HL12I` | Italic font for special choices in multiple-choice menus. | [`menu.29`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/menu.29#L778-L804) |
| `MOUSE` | Character 6 supplies the standard mouse blinker. | [`mouse.149`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/mouse.149#L138-L149) |
| `HL10`, `HL10B` | Unselected and selected choice text, respectively. | [`choice.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/choice.12#L757-L764) |
| `TR10I` | Default font for margin-scroll-region messages. | [`choice.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/choice.12#L201-L211) |
| `MEDFNB` | System-menu choices including action and abort entries. This font is one of the QFASL-only coverage TODOs, not an emitted source derivative. | [`sysmen.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sysmen.105#L204-L216) |
| `5X5` | Tiny text drawn inside compact boxed screen elements. | [`shwarm.162`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/shwarm.162#L864-L881) |
| `HL12B` | The inspector's `Empty` label. | [`inspct.80`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/inspct.80#L30-L41) |
| `METS`, `BIGFNT` | A questionnaire label and questionnaire text, respectively. | [`quest.42`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/quest.42#L77-L86), [`quest.42`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/quest.42#L390-L404) |
| `43VXMS` | Numeric display in the `MUNCH` display hack and text in `LEXIPHAGE`. | [`hacks.189`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L207-L222), [`hacks.189`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L470-L484) |
| `TOG` | Switch-register glyphs in the display hacks. | [`hacks.189`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L307-L333) |

## Open questions

- Resolve the `10/17/81` versus `101780` source-tape date discrepancy from primary
  media documentation.
- Recover and cross-check the 19 public QFASL-only compiled font files without
  conflating that work with source recovery.
- Catalog source-backed application uses for the fonts not listed above.
- Compare the normalized outputs with fonts loaded by a running System 46 image. That
  would test the complete historical compilation path, but it is not required to
  recover the public source glyphs.

Last verified: 2026-07-16.

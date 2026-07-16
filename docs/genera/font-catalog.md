---
type: Artifact Analysis
title: Genera 8.5 resident font catalog
description: Evidence-graded inventory of all 89 distinct fonts resident in the inspected Genera 8.5 base world, with unknown application uses left as TODO.
tags: [genera, open-genera, fonts, catalog, preservation]
timestamp: 2026-07-16T12:29:47-04:00
---

# Genera 8.5 resident font catalog

## Bottom line

The inspected Genera 8.5 base world contains 89 distinct resident `FONT` objects and
90 symbol bindings. The extra binding is an alias: `TV:*DEFAULT-FONT*` and
`FONTS:CPTFONT` point to the same `CPTFONT` object. Exact resident `FONT-SPECS`
mappings establish a style or character-set role for 86 objects. No such mapping was
found for `40VR`, `EINY8`, or `VT100`.

A character-style mapping is not proof that a particular application uses a font.
The table therefore keeps resident style or role separate from application-specific
use. An application cell says literal `TODO` unless a direct call site or world
reference was established. This avoids inferring purpose from a suggestive font name
or appearance.

## Evidence grades

| Grade | Meaning |
| --- | --- |
| `A` | Decoded directly from the identified VLOD. |
| `B` | Established by a direct call site or mapping in the matching licensed Genera source tree. |
| `A+B` | VLOD evidence corroborated by the matching licensed source tree. |
| `TODO` | Purpose was not established at the requested confidence. |

The tuple notation in the resident column is `family/face/size`, decoded from the
world's `FONT-SPECS` properties. It records how Genera can select a resident font; it
does not assert where an end user would encounter it. “Standard,” “symbol,” “mouse,”
“arrow,” and similar character-set statements are included only where the decoded
mapping and matching font-selection source establish that role.

## Complete inventory

| Font object | Resident style or role | Grade | Application-specific use | Grade |
| --- | --- | --- | --- | --- |
| `40VR` | TODO | `TODO` | The distributed color-demo `DRAW-DATE` function selects `FONTS:40VR` to render the current date; this was not observed as an active base-world style mapping. | `B` |
| `5X5` | FIX/UPPERCASE/VERY-SMALL | `A` | TODO | `TODO` |
| `BIGFNT` | FIX/ROMAN/VERY-LARGE | `A` | TODO | `TODO` |
| `BIGFNTB` | FIX/BOLD/VERY-LARGE | `A` | TODO | `TODO` |
| `BIGFNTBI` | FIX/BOLD-ITALIC/VERY-LARGE | `A` | TODO | `TODO` |
| `BIGFNTI` | FIX/ITALIC/VERY-LARGE | `A` | TODO | `TODO` |
| `BOXFONT` | Stand-in font for undefined styles on the standard and symbol character sets. | `A+B` | TODO | `TODO` |
| `CPTFONT` | World default font and FIX/ROMAN/NORMAL screen-style font; also bound as `TV:*DEFAULT-FONT*`. | `A` | TODO | `TODO` |
| `CPTFONTB` | FIX/BOLD-EXTENDED/NORMAL | `A` | TODO | `TODO` |
| `CPTFONTBI` | FIX/BOLD-ITALIC/NORMAL | `A` | TODO | `TODO` |
| `CPTFONTC` | FIX/CONDENSED/NORMAL | `A` | TODO | `TODO` |
| `CPTFONTCB` | FIX/BOLD/NORMAL | `A` | TODO | `TODO` |
| `CPTFONTCC` | FIX/EXTRA-CONDENSED/NORMAL | `A` | TODO | `TODO` |
| `CPTFONTI` | FIX/ITALIC/NORMAL | `A` | TODO | `TODO` |
| `DUTCH14` | DUTCH/ROMAN/LARGE | `A` | TODO | `TODO` |
| `DUTCH14B` | DUTCH/BOLD/LARGE | `A` | TODO | `TODO` |
| `DUTCH14BI` | DUTCH/BOLD-ITALIC/LARGE | `A` | TODO | `TODO` |
| `DUTCH14I` | DUTCH/ITALIC/LARGE | `A` | TODO | `TODO` |
| `DUTCH20` | DUTCH/ROMAN/VERY-LARGE | `A` | TODO | `TODO` |
| `DUTCH20B` | DUTCH/BOLD/VERY-LARGE | `A` | TODO | `TODO` |
| `DUTCH20BI` | DUTCH/BOLD-ITALIC/VERY-LARGE | `A` | TODO | `TODO` |
| `DUTCH20I` | DUTCH/ITALIC/VERY-LARGE | `A` | TODO | `TODO` |
| `EDSYMBOL12` | Editor-symbol character set and SYMBOLS-IN-EDITOR-BUFFER faces, including FIX and body-family mappings. | `A+B` | TODO | `TODO` |
| `EINY7` | FIX/ROMAN, ITALIC, BOLD, BOLD-ITALIC, BOLD-EXTENDED, CONDENSED, and EXTRA-CONDENSED at VERY-SMALL. | `A` | TODO | `TODO` |
| `EINY8` | TODO | `TODO` | TODO | `TODO` |
| `EUREX21I` | EUREX/ITALIC/VERY-LARGE | `A` | TODO | `TODO` |
| `EUREX24I` | EUREX/ITALIC/HUGE | `A` | TODO | `TODO` |
| `HIPPO10` | GREEK/SMALLBODY for FIX, CENTURYSCHOOLBOOK-BODY, and SANS-SERIF-BODY. | `A` | TODO | `TODO` |
| `HIPPO12` | GREEK at NORMAL, SMALL, LARGE, and title sizes for FIX and body families; also DEVICE-FONT/HIPPO12/NORMAL. | `A` | TODO | `TODO` |
| `HL10` | SWISS/ROMAN, CONDENSED, and CONDENSED-CAPS at SMALL. | `A` | TODO | `TODO` |
| `HL10B` | SWISS/BOLD, BOLD-EXTENDED, and BOLD-CONDENSED-CAPS at SMALL. | `A` | TODO | `TODO` |
| `HL10BI` | SWISS/BOLD-ITALIC/SMALL | `A` | TODO | `TODO` |
| `HL10I` | SWISS/ITALIC/SMALL | `A` | TODO | `TODO` |
| `HL12` | SWISS/ROMAN/NORMAL | `A` | TODO | `TODO` |
| `HL12B` | SWISS/BOLD/NORMAL | `A` | TODO | `TODO` |
| `HL12BI` | SWISS/BOLD-ITALIC/NORMAL | `A` | TODO | `TODO` |
| `HL12I` | SWISS/ITALIC/NORMAL | `A` | TODO | `TODO` |
| `HL14` | SWISS/ROMAN and CONDENSED at LARGE. | `A` | TODO | `TODO` |
| `HL14B` | SWISS/BOLD and BOLD-EXTENDED at LARGE. | `A` | TODO | `TODO` |
| `HL14BI` | SWISS/BOLD-ITALIC/LARGE | `A` | TODO | `TODO` |
| `HL14I` | SWISS/ITALIC/LARGE | `A` | TODO | `TODO` |
| `HL8` | SWISS/ROMAN/VERY-SMALL | `A` | TODO | `TODO` |
| `HL8B` | SWISS/BOLD/VERY-SMALL | `A` | TODO | `TODO` |
| `HL8BI` | SWISS/BOLD-ITALIC/VERY-SMALL | `A` | TODO | `TODO` |
| `HL8I` | SWISS/ITALIC/VERY-SMALL | `A` | TODO | `TODO` |
| `JESS11` | JESS/ROMAN/SMALL | `A` | TODO | `TODO` |
| `JESS11B` | JESS/BOLD/SMALL | `A` | TODO | `TODO` |
| `JESS11I` | JESS/ITALIC/SMALL | `A` | TODO | `TODO` |
| `JESS13` | JESS/ROMAN/NORMAL | `A` | TODO | `TODO` |
| `JESS13B` | JESS/BOLD/NORMAL | `A` | TODO | `TODO` |
| `JESS13I` | JESS/ITALIC/NORMAL | `A` | TODO | `TODO` |
| `JESS14` | JESS/ROMAN/LARGE | `A` | TODO | `TODO` |
| `JESS14B` | JESS/BOLD/LARGE | `A` | TODO | `TODO` |
| `JESS14I` | JESS/ITALIC/LARGE | `A` | TODO | `TODO` |
| `MATH10` | MATH/SMALLBODY for FIX, CENTURYSCHOOLBOOK-BODY, and SANS-SERIF-BODY. | `A` | TODO | `TODO` |
| `MATH12` | MATH at NORMAL, SMALL, LARGE, and title sizes for FIX and body families. | `A` | TODO | `TODO` |
| `MEDFNT` | FIX/ROMAN/LARGE | `A` | TODO | `TODO` |
| `MEDFNTB` | FIX/BOLD/LARGE | `A` | TODO | `TODO` |
| `MEDFNTBI` | FIX/BOLD-ITALIC/LARGE | `A` | TODO | `TODO` |
| `MEDFNTI` | FIX/ITALIC/LARGE | `A` | TODO | `TODO` |
| `MOUSE` | FIX/ROMAN/NORMAL for the mouse character set. | `A+B` | TODO | `TODO` |
| `NARROW` | FIX/ROMAN/NORMAL for the arrow character set. | `A+B` | TODO | `TODO` |
| `SWISS12-CCAPS` | SWISS/CONDENSED-CAPS/NORMAL | `A` | TODO | `TODO` |
| `SWISS12B-CCAPS` | SWISS/BOLD-CONDENSED-CAPS/NORMAL | `A` | TODO | `TODO` |
| `SWISS20` | SWISS/ROMAN/VERY-LARGE | `A` | TODO | `TODO` |
| `SWISS20B` | SWISS/BOLD/VERY-LARGE | `A` | TODO | `TODO` |
| `SWISS20BI` | SWISS/BOLD-ITALIC/VERY-LARGE | `A` | TODO | `TODO` |
| `SWISS20I` | SWISS/ITALIC/VERY-LARGE | `A` | TODO | `TODO` |
| `SYMBOL10` | SYMBOL/SMALLBODY for FIX, CENTURYSCHOOLBOOK-BODY, and SANS-SERIF-BODY. | `A` | TODO | `TODO` |
| `SYMBOL12` | Symbol character set and SYMBOL faces at normal, small, large, and title sizes across FIX and body families; also SWISS/ROMAN/NORMAL. | `A+B` | TODO | `TODO` |
| `TINY` | FIX/ROMAN, ITALIC, BOLD, and BOLD-ITALIC at TINY. | `A` | TODO | `TODO` |
| `TR10` | DUTCH/ROMAN/SMALL | `A` | TODO | `TODO` |
| `TR10B` | DUTCH/BOLD/SMALL | `A` | TODO | `TODO` |
| `TR10BI` | DUTCH/BOLD-ITALIC/SMALL | `A` | TODO | `TODO` |
| `TR10I` | DUTCH/ITALIC/SMALL | `A` | TODO | `TODO` |
| `TR12` | DUTCH/ROMAN/NORMAL | `A` | TODO | `TODO` |
| `TR12B` | DUTCH/BOLD/NORMAL | `A` | TODO | `TODO` |
| `TR12BI` | DUTCH/BOLD-ITALIC/NORMAL | `A` | TODO | `TODO` |
| `TR12I` | DUTCH/ITALIC/NORMAL | `A` | TODO | `TODO` |
| `TR8` | DUTCH/ROMAN/VERY-SMALL | `A` | TODO | `TODO` |
| `TR8B` | DUTCH/BOLD/VERY-SMALL | `A` | TODO | `TODO` |
| `TR8BI` | DUTCH/BOLD-ITALIC/VERY-SMALL | `A` | TODO | `TODO` |
| `TR8I` | DUTCH/ITALIC/VERY-SMALL | `A` | TODO | `TODO` |
| `TVFONT` | FIX/ROMAN, CONDENSED, and EXTRA-CONDENSED at SMALL. | `A` | TODO | `TODO` |
| `TVFONTB` | FIX/BOLD-EXTENDED/SMALL | `A` | TODO | `TODO` |
| `TVFONTBI` | FIX/BOLD-ITALIC/SMALL | `A` | TODO | `TODO` |
| `TVFONTCB` | FIX/BOLD/SMALL | `A` | TODO | `TODO` |
| `TVFONTI` | FIX/ITALIC/SMALL | `A` | TODO | `TODO` |
| `VT100` | TODO | `TODO` | The ANSI terminal simulator selects `FONTS:VT100` as its alternate graphic character set for VT100-compatible terminal handling. | `A+B` |

## Specimen sheets

Run the tracked extractor as described in
[Extracting resident fonts from a Genera world](extracting-resident-fonts.md) to
produce one PNG sheet per table row under `build/fonts/genera/sheets/`. The filename
is the lowercase font object name plus `.png`; `SWISS12-CCAPS`, for example, becomes
`swiss12-ccaps.png`. Sheets label character codes in octal and mark each decoded
baseline with a pale horizontal line.

The PNGs are intentionally absent from this repository. They contain rendered copies
of licensed glyphs, so even the visual catalog remains a local research output rather
than a public museum asset.

## Limits and next research steps

The widespread `TODO` values do not mean the fonts were unused. They mean that this
bounded investigation did not assign a direct application call site to them. Raising
confidence requires a broader cross-reference of compiled functions and source call
sites, or tracing style selection in a running world. Appearance, naming conventions,
and analogous CADR uses are not sufficient evidence for a Genera application claim.

Three resident objects require special follow-up:

- `EINY8`: no resident `FONT-SPECS` mapping or non-inventory reference was
  established;
- `40VR`: its source call site is known, but no active base-world style mapping was
  found; and
- `VT100`: its terminal role is established even though it has no resident
  `FONT-SPECS` mapping.

The separate [extraction note](extracting-resident-fonts.md#validation-result) records
the BDF differences for `EUREX21I` and `TVFONTI`; those format-comparison findings do
not change the style mappings recorded here.

## Reproducibility record

- artifact: licensed `Genera-8-5.vlod`;
- size: 54,804,480 bytes;
- SHA-256: `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`;
- inventory method: direct offline traversal of named rank-two one-bit `FONT` arrays,
  followed by a symbol-binding and `FONT-SPECS` property scan;
- result: 89 distinct objects, 90 bindings, 86 objects with exact resident style
  mappings, and three without such mappings.

Licensed Genera 8.5 source evidence was inspected locally and is identified here only
by artifact-relative path, without quotation or redistribution:

- `sys.sct/sys2/character-styles.lisp.~214~` for character-style font selection;
- `sys.sct/nsage/defs-io.lisp.~51~` and
  `sys.sct/nsage/sage-defs.lisp.~417~` for character-set roles;
- `sys.sct/network/telnet.lisp.~1600~` for the ANSI/VT100 alternate graphics use;
- `sys.sct/color/demo/testpat.lisp.~36~` for `DRAW-DATE` and `40VR`; and
- `sys.sct/sys/sysdcl.lisp.~1059~` for system font declarations.

Last verified: 2026-07-16.

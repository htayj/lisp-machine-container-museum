---
type: Historical Article
title: LEXIPHAGE, the Lisp Machine word eater
description: The purpose, animation mechanics, font use, attribution, and three preserved source forms of the LEXIPHAGE display demo.
tags: [mit-cadr, lm-3, graphics, demos, fonts, preservation]
timestamp: 2026-07-17T00:05:30-04:00
---

# LEXIPHAGE, the Lisp Machine word eater

## Conclusion

`LEXIPHAGE` is a display demo that renders a word and makes a moving mouth consume it
from left to right. The LM-3 System 303 demo registry describes its purpose directly
as “the word eater” and says that it is based on a hack by John Doty. That supports
the purpose and underlying-hack attribution; it does **not** establish that Doty wrote
every preserved implementation.

In System 46 it lives in `LMIO; HACKS`, which the contemporary Lisp Machine Manual
describes as a collection of useful functions whose organization had not yet been
settled. The later System 303 menu supplies a clearer demo context than the earlier
source does.

LEXIPHAGE is not a lexical analyzer, text editor, or data-destruction utility. The
CADR versions change screen pixels only. Both accept optional display text, defaulting
to `LEXIPHAGE`; System 46 returns `LEXIPHAGE!`, while the System 303 rewrite returns
`Lexiphage!`.

## Preserved implementations

Three related source forms survive in the public material:

| Source | Display input | Mouth mechanism | Evidence boundary |
| --- | --- | --- | --- |
| `MOON; LEXIPH 12` | A separately stored `LEXIMG PHAGE` bitmap | Two trigonometric line-segment jaws drawn and erased by PDP-10 TV routines | A separate PDP-10/TV Lisp implementation. The source does not state its chronological relationship to the CADR versions. |
| System 46 `LMIO1; HACKS 189` | Optional text rendered in `43VXMS` | Rebinds the line rasterizer's point callback so a per-scanline frontier erases the text behind two jaw edges | The compact historical CADR implementation. |
| LM-3 System 303 `DEMO; OHACKS 39` | Optional centered text rendered in `43VXMS` | Draws and erases filled jaw and tooth triangles in a dedicated window | A later window-system rewrite and the source of the explicit word-eater and John Doty description. |

The common behavior strongly indicates a family relationship, but no inspected
comment supplies a complete porting history. It would be unsafe to call any one file
“the original” solely from its directory, syntax, or apparent age.

## Purpose and attribution

System 303 registers the function in `HACKS:DEMO` with
[`DEFDEMO "Lexiphage"`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=352-354&name=demo%2Fohacks.lisp.39).
The short description explicitly supplies both “word eater” and “based on a hack by
John Doty.” A preserved 1980 System 46 implementation does not include that prose, so
the later registry is valuable corroborating context from the LM-3 Fossil tree.

The preserved program sources do not explain the construction of the name. A later
retrospective does, but belongs to a different evidence class.

### Retrospective origin account

A [Lexiphage history page](https://www.kaleberg.com/lexiphage/index.html), revised in
2001 after correspondence with John Doty, reproduces his recollection that he wrote
an original version possibly in late 1972 on an HP desktop calculator at the National
Scientific Balloon Facility. In that account, other one-line-display animations
inspired a word to enter, be chomped, and end with a burp effect. The page parses the
name as roots meaning “word” and “eater” and says the program was later reimplemented
on the MIT-AI PDP-10 for the Knight display.

This is useful retrospective evidence and is consistent with System 303's direct
“based on a hack by John Doty” statement. It is nevertheless a recollection relayed
by a third-party page almost three decades later. It neither dates nor assigns
authorship to the preserved source files. The page also describes an ITS version that
accepted an arbitrary word and used an old-English font, whereas the preserved
`moon/lexiph.12` loads a fixed bitmap. They must not be assumed to be the same
revision. No inspected evidence supports associating the mouth with a particular
commercial character.

## How the System 46 CADR version works

The complete compact implementation is only 44 lines in
[`hacks.189`, lines 470-513](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L470-L513).
After the `HACKS` file is loaded, its public shape is:

```lisp
(LEXIPHAGE &optional (TEXT "LEXIPHAGE"))
```

It is noninteractive: there are no keyboard reads or controls in this function.

### Text and state

The function first requires `FONTS:43VXMS`; if the font is unbound, it reports an
error asking for `LMFONT; 43VXMS QFASL`. It then:

1. creates or reuses a text-output structure using only `43VXMS`;
2. clears it and writes the requested text at raster position octal `(140, 60)`, or
   decimal `(96, 48)`;
3. records the cursor's resulting right edge, so traversal follows rendered width
   rather than character count; and
4. clears a 94-entry, 16-bit array that stores one horizontal frontier per scanline.

The public AST describes `43VXMS` as a 43-pixel-high proportional raster font. Text
beginning at y=48 therefore fits within the jaw's approximately y=44 through y=92
span. That fit is derived from the metrics and geometry; no comment explicitly says
it was the design rationale. See the museum's
[`43VXMS` specimen sheet](../assets/mit-cadr-fonts/sheets/43vxms.png) and the broader
[font usage audit](font-usage-audit.md).

### A line rasterizer turned into an erasing frontier

The key technique is a dynamic binding of `DRAW-PLOT`'s function cell to
`LEXIPHAGE-1`. The normal `DRAW-LINE` routine still chooses the raster points for two
jaw edges, but each point now passes through the replacement callback.

For every scanline, `LEXIPHAGE-1` remembers the previous jaw x-coordinate. When the
new point moves right, it clears all pixels between the old and new frontiers; when it
moves left, it removes the old frontier point. It then records and illuminates the new
point. The result is a moving outline with a horizontally cleared region behind it:
the pre-rendered word disappears as the jaws pass.

This is a small but instructive example of Lisp Machine dynamism. The program reuses
the generic line algorithm while temporarily replacing the low-level operation that
a plotted point means.

### Jaw motion

The source file declares base 8, so its undecorated geometry constants are octal. For
each x position, it draws two lines from a common point at y=68 decimal to endpoints
at `(x + d, 36 + d)` and `(x + d, 100 - d)`. The endpoints are symmetric around the
centerline. `d` advances from 8 through 25 decimal, closing the mouth, then resets to
8. An empty 512-iteration loop paces each step; it establishes no portable frame rate.

After the traversal reaches the rendered right edge, the function returns
`"LEXIPHAGE!"` without waiting for input.

## How the LM-3 System 303 rewrite works

System 303's
[`demo/ohacks.lisp.39`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=258-354&name=demo%2Fohacks.lisp.39)
keeps the same premise but replaces the callback trick with window drawing methods:

1. Load `43VXMS` if necessary and create a 300-pixel-tall saved-bits window.
2. Measure the optional string, center it horizontally and vertically, and render it.
3. Pause in a fixed busy loop so the user can read the word.
4. Move an apex from 64 pixels left of the word until the mouth's leading edge has
   passed about 23 pixels beyond its right edge.
5. Cycle a vertical opening value from 24 down to zero, drawing upper and lower filled
   triangular jaws plus smaller tooth triangles.
6. After another fixed delay, erase the jaw shapes and filled regions swept behind
   them. Repeating this one pixel farther right consumes the text.

The file's base is 8, but the named `MOUTH-X`, `MOUTH-Y`, and `TOOTH-Y` constants use
trailing decimal points and therefore specify decimal widths of 40, 4, and 10 pixels.
The bare `100`, `30`, and `HALF-STRING-HEIGHT` value `30` are octal, accounting for
the 64- and 24-pixel values above. The target string remains font-rendered raster
text; the jaws and teeth are graphics primitives, not characters from a mouth font.
As in System 46, there is no keyboard control inside `LEXIPHAGE` itself.

The `HACKS` system definition loads `OHACKS`, and `DEFDEMO` adds the resulting form to
the interactive `HACKS:DEMO` menu. Direct calls to `HACKS:LEXIPHAGE` also appear in
preserved diagnostic material, but the demo menu is the source-backed presentation
context.

## The separate PDP-10 TV Lisp form

[`moon/lexiph.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/lexiph.12#L1-L88)
uses a different graphics environment. `DISPLAY-LEXIPHAGE` clears a raw TV array and
attempts to fill it from `DSK:MOON;LEXIMG PHAGE`. After a two-second pause, `GOBBLE`
moves paired line-segment jaws toward the right while sine and cosine tables close the
mouth. Low-level PDP-10 assembly routines control real-time execution and line
drawing.

The same jaw engine also serves `CHOMP-BAG`, which loads a separate `BAG LUNCH`
bitmap, and a `HAKMEM` entry point that directs the effect to a specified TTY. These
names demonstrate reuse of the animation mechanism; they do not establish why the
main function was named LEXIPHAGE.

The public snapshot contains the Lisp source, a compiled `lexi.phage` artifact, and
the referenced image under the host-normalized name `moon/leximg.phage`. It does not
contain the separate `BAG LUNCH` bitmap used by `CHOMP-BAG`. Reproducing and capturing
the exact PDP-10 display remains a runtime `TODO`, but the main LEXIPHAGE image input
is not missing.

## Preservation record

The System 46 and PDP-10 observations use the public
[`mietek/mit-cadr-system-software`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
snapshot at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af`:

| File | Size | SHA-256 |
| --- | ---: | --- |
| `src/lmio1/hacks.189` | 29,390 bytes | `041b2d551f22a136adbc162c8b4d17c64825bef28356b02cdd4a417d2518a871` |
| `src/moon/lexiph.12` | 10,705 bytes | `ef898c430dfddb6a41481e6578de383e88a02c6a1ee473b23ea19e6df6f16e95` |
| `src/moon/lexi.phage` | 5,428 bytes | `05a70c9aa284a0c8b2bbdf6575009abfd5a08361623e2b8de7db29811805ea30` |
| `src/moon/leximg.phage` | 10,120 bytes | `078f2d1cf897423d34319c2ae9d7d3b320928154b071edeee3d0a056f4d57a76` |

The LM-3 observations use the public `sys` Fossil repository's
[`system-303` check-in](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9),
`4df393c68d7f083ce42d5c377039d26043cc18a9`:

| File | Size | SHA-256 |
| --- | ---: | --- |
| `demo/ohacks.lisp.39` | 20,605 bytes | `762ecaf7d5b2c21c860d01be4fcbc81265cb2b9d25c7aa18feefa6ac2745ecb0` |
| `io1/hacks.lisp.190` | 29,454 bytes | `af883767227b6035e65919c72443e30fdad7d9b33d70aa166a627c5ab0137b33` |

System 303 is a maintained LM-3 restoration branch. Its explicit description and
rewritten implementation are corroborating CADR-family sources, not evidence that its
exact UI was present in System 46.

## Open questions

- What is the exact authorship and porting sequence among the PDP-10 TV, System 46,
  and later window-system implementations?
- Does “based on a hack by John Doty” refer to the idea, the first implementation, or
  a specific intermediate version?
- Where is the separate `BAG LUNCH` bitmap referenced by `CHOMP-BAG`?
- How do the two CADR animations look and pace on the preserved System 46 and System
  303 worlds? This article is based on source analysis, not a runtime comparison.
- Did contemporary documentation explain the name? None was found in the inspected
  public trees.

## Sources

- MIT CADR System 46,
  [`LMIO1; HACKS 189`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L470-L513).
- Separate PDP-10 TV Lisp source,
  [`MOON; LEXIPH 12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/lexiph.12#L1-L112).
- Lisp Machine Manual,
  [`HACKS` introduction](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/fd_hac.50#L1-L7).
- LM-3 `sys` Fossil repository, System 303,
  [`DEMO; OHACKS 39`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=258-354&name=demo%2Fohacks.lisp.39).
- Kaleberg,
  [Lexiphage definition and retrospective John Doty account](https://www.kaleberg.com/lexiphage/index.html),
  revised after correspondence dated 6 May 2001.

Last verified: 2026-07-17.

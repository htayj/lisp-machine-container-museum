---
type: Historical Article
title: MUNCH and Munching Squares on the MIT CADR
description: The purpose, 16-bit XOR plotting algorithm, controls, display fonts, and preserved System 46 and LM-3 implementations of MUNCH.
tags: [mit-cadr, lm-3, graphics, demos, hakmem, fonts]
timestamp: 2026-07-17T00:07:41-04:00
---

# MUNCH and Munching Squares on the MIT CADR

## Conclusion

`MUNCH` is an interactive CADR implementation of **Munching Squares**, a classic
point-display hack associated with the PDP-1. It is a graphics demonstration, not a
file utility or part of the Lisp evaluator. A 16-bit parameter controls the order in
which a simple XOR relation visits a 256 by 256 field; changing that parameter yields
the moving squares, lattices, and related patterns for which the hack is known.

The contemporary Lisp Machine Manual describes `LMIO; HACKS` more generally as a
holding place for useful functions whose organization had not yet been settled. The
later LM-3 tree turns MUNCH into a named menu demo, but that later presentation should
not be projected backward onto System 46.

The public sources preserve two useful CADR layers:

| Source layer | What survives |
| --- | --- |
| System 46, `LMIO1; HACKS 189` | A compact implementation that draws directly in the current terminal sheet, prints its value in `43VXMS`, and represents the parameter with `TOG` switch glyphs. |
| LM-3 System 303, `DEMO; MUNCH 17` | A later window-system implementation with separate plot, octal-number, clickable switch-register, and help panes. Its demo registration explicitly calls Munching Squares a classic PDP-1 display hack. |

The System 303 source is the better guide to the version exposed by the current LM-3
tree. The System 46 source remains important historical evidence for the earlier CADR
implementation. They share the same plotting core but are not the same program text.

## Historical identity

The System 303 demo description identifies Munching Squares as
“a classic display hack from the PDP-1” in
[`demo/munch.lisp.17`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=336-343&name=demo%2Fmunch.lisp.17).
This agrees with HAKMEM, MIT AI Memo 239: item 146 reports a very small display
program thought to have been discovered by Jackson Wright on the RLE PDP-1, and item
147 characterizes the display as successive views of `Y = X XOR T`.

That is evidence for the hack's earlier identity, not for authorship of either Lisp
Machine port. Neither inspected CADR source file names its porter or author. The
attribution to Jackson Wright should therefore attach to the reported PDP-1 hack, not
automatically to the preserved CADR code.

## The common plotting engine

Both CADR implementations maintain a 16-bit accumulator and a 16-bit parameter. In
equivalent modern notation, each point is:

```text
accumulator = (accumulator + parameter) mod 65536
x = accumulator & 0xff
t = (accumulator >> 8) & 0xff
y = x XOR t
pixel[x, y] = pixel[x, y] XOR 1
```

The exact System 46 loop appears in
[`hacks.189`, lines 290-298](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L290-L298).
Its `177777` and `377` literals are octal masks for 16 and 8 bits, and `LDB 1010`
selects the other 8-bit field. The System 303 rewrite retains the same operations in
[`MUNCH-BITS-PANE :DO-MUNCHING`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=258-294&name=demo%2Fmunch.lisp.17).

The code toggles an existing pixel instead of merely setting it. This matters: a
second visit removes a point. Parameter changes reset the accumulator and clear the
plot, making each selection a fresh traversal.

### Mathematical interpretation

The following is derived analysis of the code, not a source comment. If the parameter
is odd, repeated addition permutes all 65,536 possible 16-bit accumulator values
before repeating. Splitting each value into two bytes and mapping `(x, t)` to
`(x, x XOR t)` is also one-to-one. One full cycle therefore toggles every pixel in the
256 by 256 field exactly once, but the parameter controls the order in which the field
is traversed. Even parameters have shorter modular cycles and visit subsets of the
field, producing different repetitions.

With parameter 1, the low byte walks across `x` while the high byte changes more
slowly, closely exposing HAKMEM's `Y = X XOR T` description. The default is octal
`401`, decimal 257. Both source generations also suggest octal `1`, `10421`, `11111`,
and `100001`, but neither explains why those particular examples were selected.

## The LM-3 System 303 presentation

The LM-3 tree's `HACKS` system loads `MUNCH` as a dedicated demo module alongside
the older miscellaneous hacks in `OHACKS`; see
[`sys/sysdcl.lisp.200`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=358-372&name=sys%2Fsysdcl.lisp.200).
Once that system is present, Munching Squares is available from `HACKS:DEMO` and as
`HACKS:MUNCH`.

The System 303 window has four panes:

- an octal parameter display labeled `Munching Squares`;
- a centered 256 by 256 plotting pane;
- a 16-position graphical switch register; and
- persistent keyboard help.

The pane construction and font selection are explicit in
[`demo/munch.lisp.17`, lines 185-256](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=185-256&name=demo%2Fmunch.lisp.17).
The displayed number is formatted in octal. The switch pane uses `FONTS:TOG`, can be
changed with the mouse, and groups bits visually by alternating glyph colors.
The reusable switch mixin identifies TOG character codes `060`/`061` as one off/on
switch pair, `062`/`063` as a second-color pair, and `101` through `104` as indicator
lights; the source does not expand the font name `TOG`. See
[`demo/munch.lisp.17`, lines 1-25](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&ln=1-25&name=demo%2Fmunch.lisp.17).

### System 303 controls

These are the actions implemented by
[`MUNCH-PROCESS-CHAR`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=296-341&name=demo%2Fmunch.lisp.17),
not reconstructed from key names alone:

| Input | Effect |
| --- | --- |
| `END` | Exit the demo. |
| `N` | Select the next higher number with the same count of one bits. |
| digits `0` through `9` | Replace the value with `8 * value + digit`. The code really accepts `8` and `9`, even though the number pane prints octal. |
| `CLEAR-INPUT` | Set the value to zero. |
| `+`, `SPACE`, or hand up | Increment. |
| `-` or hand left | Shift left, inserting zero. |
| `=` | Shift left, inserting one. |
| hand right | Shift right. |
| hand down | Decrement. |
| `CLEAR-SCREEN` | Clear and restart without changing the value. |
| `HOLD-OUTPUT` or `STOP-OUTPUT` | Pause plotting. |
| `RESUME` | Resume plotting. |
| `NETWORK` through `\` row keys | Toggle individual parameter bits. |
| mouse click on a switch | Toggle that switch and restart the plot. |

Every numeric result is masked back to 16 bits before plotting resumes.
These are Lisp Machine character names, not guaranteed host-key bindings. A preserved
1984 bug exchange says that this help assumed an LM-2 keyboard and discusses updating
it for the then-current keyboard; mapping the named characters on an emulator remains
a `TODO`. See
[`doc/bug.lispm18.2`, lines 3449-3479](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&ln=3449-3479&name=doc%2Fbug.lispm18.2).

## The compact System 46 implementation

The 1980 System 46 `HACKS` version operates in the selected terminal rather than a
four-pane frame. It clears the terminal, installs a 16-switch display, prints the
current value at the top, and plots until a hardware character becomes available.
Its setup and input loop are preserved in
[`hacks.189`, lines 190-298](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L190-L298).

This version temporarily installs `CPTFONT` and `43VXMS`, using `43VXMS` explicitly
for the current numeric value. Its switch-register helper loads `TOG` when necessary
and chooses glyphs from the font according to each bit's value and display color; see
[`CREATE-SWITCH-REGISTER`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L307-L356).
The museum's recovered public specimens are the
[`43VXMS` sheet](../assets/mit-cadr-fonts/sheets/43vxms.png) and
[`TOG` sheet](../assets/mit-cadr-fonts/sheets/tog.png).

The older dispatch supports `BREAK`, `ESCAPE`, digits, `CLEAR`, `+`, shifts, `FORM`,
`?`, and a row of bit-toggle keys. There are unresolved discrepancies between that
dispatch and its printed help: the help says `SPACE` increments where the visible
branch tests `+`, describes an `M` operation where the source tests character octal
`025`, and advertises `CIRCLE-PLUS` single stepping without a corresponding explicit
branch. These may reflect stale help or keyboard-encoding behavior, but static source
inspection cannot choose between them. Runtime testing on the preserved keyboard
paths remains a `TODO`.

## The HAKMEM helper

Both versions define `NHNWSNOOB`, expanded by their source comment as “next higher
number with same number of one bits.” It isolates the lowest set bit, carries that bit
left, then moves the remaining changed bits to the low end. The implementation matches
Bill Gosper's HAKMEM item 175 and special-cases zero to zero. In MUNCH this lets a user
move among parameters with the same binary population count, often changing pattern
geometry without changing how many switches are on.

`MUNCHING-TUNES` is a separate sound demo. The System 303 menu describes it as
computer-composed music based on the Munching Squares algorithm, but it computes beep
frequencies and does not call the screen `MUNCH` function. Its source is adjacent in
[`demo/ohacks.lisp.39`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&ln=146-166&name=demo%2Fohacks.lisp.39).

## Preservation record

The System 46 observations use the public
[`mietek/mit-cadr-system-software`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
snapshot at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af`:

| File | Size | SHA-256 |
| --- | ---: | --- |
| `src/lmio1/hacks.189` | 29,390 bytes | `041b2d551f22a136adbc162c8b4d17c64825bef28356b02cdd4a417d2518a871` |
| `src/lmio1/hacks.qfasl` | 22,884 bytes | `da2a263d4762bbae56bdae4188bc42685d86e7638a59d4fdfc92c90150a80f60` |

The recovered media inventory dates `HACKS` source versions 188 and 189 to 27 July
1980 and the preserved QFASL to 31 July 1980. That ordering does not by itself prove
which exact source produced the compiled file.

The LM-3 observations use the public `sys` Fossil repository's
[`system-303` check-in](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9),
`4df393c68d7f083ce42d5c377039d26043cc18a9`:

| File | Size | SHA-256 |
| --- | ---: | --- |
| `demo/munch.lisp.17` | 12,190 bytes | `5f4b9408e1485709dfc04d5a587465a8f3244c6132df793ffd3feaa75bc7622e` |
| `io1/hacks.lisp.190` | 29,454 bytes | `af883767227b6035e65919c72443e30fdad7d9b33d70aa166a627c5ab0137b33` |
| `demo/ohacks.lisp.39` | 20,605 bytes | `762ecaf7d5b2c21c860d01be4fcbc81265cb2b9d25c7aa18feefa6ac2745ecb0` |

System 303 is a maintained LM-3 restoration branch, not a synonym for the System 46
snapshot. Claims above are attached to the source generation that supports them.

## Open questions

- Who wrote or ported the System 46 and later window-system CADR implementations?
- How do the contradictory System 46 help keys behave with each emulated historical
  keyboard path?
- What effects were intended by the recommended constants beyond what static
  arithmetic demonstrates?
- Does the current System 303 world reproduce every drawing and pause behavior in the
  checked-in source? No runtime comparison was performed for this article.

## Sources

- M. Beeler, R. W. Gosper, and R. Schroeppel,
  [HAKMEM, MIT AI Memo 239](https://dspace.mit.edu/handle/1721.1/6086), 1972,
  especially items 146, 147, and 175; the
  [searchable programming-hacks transcription](https://www.inwap.com/pdp10/hbaker/hakmem/hacks.html#item146)
  is useful for navigation.
- MIT CADR System 46,
  [`LMIO1; HACKS 189`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L190-L371),
  with dates from the
  [recovered media inventory](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/wall.3#L543-L545).
- Lisp Machine Manual,
  [`HACKS` introduction](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/fd_hac.50#L1-L7).
- LM-3 `sys` Fossil repository, System 303,
  [`DEMO; MUNCH 17`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo%2Fmunch.lisp.17).

Last verified: 2026-07-17.

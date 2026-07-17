---
type: Artifact Analysis
title: MIT CADR font usage audit
description: Evidence-graded uses and explicit unknowns for every source-backed and compiled-only font in the pinned System 46 snapshot.
tags: [mit-cadr, fonts, source-analysis, user-interface, preservation]
timestamp: 2026-07-16T22:51:56-04:00
---

# MIT CADR font usage audit

## Conclusion

The pinned System 46 source snapshot does **not** establish a purpose for every
recovered font. It does, however, support a complete evidence-graded audit:

- 15 of the 88 source-backed logical names are selected by executable CADR Lisp
  code for an identifiable screen or application role;
- three names are demonstrably selected by XGP or Dover document workflows, but
  the name match does not prove that those printer resources contain the same
  raster data as the recovered CADR screen-font sources;
- two more have a specific use described by contemporary documentation or a bug
  report, without a surviving executable selection site;
- one was reported as frequently used, but the report gives no purpose;
- six are loaded by the standard `FONTS` package without an identified consumer;
- 46 occur only in the source-archive compilation list, and 15 only as recoverable
  source representations.

Thus 20 source-backed names have a specific, evidence-supported role and 68 have
an explicit **TODO: no application purpose established**. “No purpose established”
does not mean “never used”: font names could be entered interactively, constructed
dynamically, or referenced only from compiled programs absent from this tree.

The separate set of 17 compiled-only logical names is less complete. Executable
source establishes roles for `MEDFNB` and `SHIP`; the other 15 remain qualified
runtime, load, or inventory observations with purpose `TODO`.

The machine-readable companion is the
[`font-usage-catalog.json`](font-usage-catalog.json). It has one entry for every
source-backed logical name and every compiled-only logical name. The 62 retained
alternate source representations inherit the result of their logical name; the
snapshot contains no evidence that an application selected one recovered source
variant rather than another.

## Scope and method

The audit uses the complete `src/` tree of
[`mietek/mit-cadr-system-software`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
at commit `8e978d7d1704096a63edd4386a3b8326a2e584af`, the same revision used by the
[source recovery](font-sources-and-recovery.md).

For each of the 88 logical names in the tracked asset catalog, the audit searched
case-insensitively for:

- exact symbols, including `FONTS:<name>`;
- ITS filenames such as `LMFONT;<name>` and QFASL load declarations;
- editor mode lines, document-font directives, generated XGP font tables, manuals,
  bug mail, and source comments;
- binary files treated as text, which exposed otherwise missed evidence in an
  archived editor environment and generated document output;
- plausible aliases only when another source established the mapping.

Every surviving context was read manually. Common-word collisions such as `BUG`,
`MOUSE`, `SEARCH`, and `SHIP` were rejected unless the context was font-specific.
The `ST6`, `ST8`, and `ST10` strings in `cadr/stat.drw` are hardware signal labels,
not font uses. The ordinary word “pronto” is not evidence for `PRONTO`.

The zero-hit boundary is necessarily limited. The window system can
[construct and load an `LMFONT` filename from a symbol](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sheet.382#L483-L504),
and ZWEI can
[read an arbitrary font ID from the minibuffer](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/font.22#L69-L85)
or load names computed from
[buffer font metadata](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/font.22#L101-L120).
This is why the negative result is “no specific use established by preserved
literal references,” never “unused.”

Two shared references define important negative boundaries:

- [`fcmp.xfile`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmfont/fcmp.xfile#L1-L92)
  calls its list essentially the archive directory, copies out the AST members, and
  compiles them. Presence there proves a source-build operation, not an application
  role.
- [`pkgdcl.230`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/pkgdcl.230#L61-L81)
  declares the standard `FONTS` package files. Presence there proves planned system
  loading, not why a font was loaded.

## Evidence classes

| Class | Source-backed count | What it establishes |
| --- | ---: | --- |
| Direct runtime | 15 | Executable Lisp selects the font for the stated role. |
| Document-output name match | 3 | A printer/document resource with the same name is selected; raster identity is unproved. |
| Documented use | 2 | Contemporary prose identifies a specific use; no executable selector survives. |
| Reported use, no purpose | 1 | Use is reported, but its intended role is unknown. |
| Standard load, no purpose | 6 | The system loads it, but no consumer was identified. |
| Source build only | 46 | It is compiled from the font archive, but no consumer was identified. |
| Source only | 15 | A source representation survives, but no build, load, or consumer reference was identified. |
| **Total** | **88** | Every source-backed logical name is accounted for exactly once. |

## Direct runtime uses

These are the strongest findings because executable source selects the font object.

| Logical name | Established role | Direct evidence |
| --- | --- | --- |
| `43VXMS` | Numeric/current-value display in `MUNCH`; text in `LEXIPHAGE`. | [`hacks.188`, `MUNCH`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.188#L207-L222), [`hacks.188`, `LEXIPHAGE`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.188#L470-L484) |
| `5X5` | Tiny text in compact boxed screen elements and labels in the system-menu layout. | [`shwarm.160`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/shwarm.160#L864-L881), [`sysmen.104`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sysmen.104#L564-L572) |
| `ARROW` | Glyphs for otherwise invisible format-effectors; old-window mouse and rectangle-selection blinkers. | [`tv.347`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/tv.347#L140-L160), [`mouse.139`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/mouse.139#L168-L203) |
| `BIGFNT` | SUPDUP's conspicuous machine-in-use message, prominent questionnaire buttons, and the `PRINT-BIG` helper. | [`supser.66`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/supser.66#L684-L710), [`quest.42`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/quest.42#L391-L401), [`hacks.188`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.188#L527-L539) |
| `CPTFON` / `CPTFONT` | Default font of the cold-load, CPT, and main screens and their initial text-output structures. `CPTFON` is the source/QFASL artifact name whose cold load provides runtime `FONTS:CPTFONT`; this is an operational name mapping, not evidence for a separate runtime `FONTS:CPTFON` alias. | [`coldut.22`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/coldut.22#L957-L965), [`tv.347`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/tv.347#L487-L507), [`shwarm.160`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/shwarm.160#L887-L900) |
| `HL10` | Unselected choice text in the choose-variable-values interface. | [`choice.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/choice.12#L751-L763) |
| `HL10B` | Selected choice text in the choose-variable-values interface. | [`choice.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/choice.12#L757-L763) |
| `HL12B` | The inspector window's `Empty` label. | [`inspct.80`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/inspct.80#L26-L39) |
| `HL12I` | Special choices displayed at the top of multiple-choice menus. | [`menu.29`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/menu.29#L782-L802) |
| `MEDFNT` | Default screen-menu font and questionnaire button text. | [`menu.29`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/menu.29#L101-L116), [`quest.42`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/quest.42#L198-L207) |
| `METS` | Default label font of the questionnaire frame. | [`quest.42`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/quest.42#L78-L84) |
| `MOUSE` | Standard mouse, rectangle-selection, and scrolling blinkers; also meter indicator strings. | [`mouse.149`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/mouse.149#L141-L148), [`ppk.2`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/ppk.2#L100-L110) |
| `TOG` | Switch-register state glyphs in the display hacks. | [`hacks.189`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189#L307-L333) |
| `TR10I` | Default font for new-window-system margin-scroll messages such as `More above` and `More below`. | [`choice.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/choice.12#L201-L211) |
| `TVFONT` | Formatted numeric tick labels on an SB dial face. | [`ppk.2`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/ppk.2#L82-L96) |

## Document-output name matches

These references establish use of a printer or formatter resource with the same
name. They do **not** establish that the XGP or Dover resource is byte-for-byte or
glyph-for-glyph identical to the recovered `LMFONT` screen source.

| Logical name | Qualified finding | Evidence |
| --- | --- | --- |
| `25FR3` | Configured as an XGP document font, including font 0 for the Lisp Machine progress report and font 5 in a CADR document. The recovered AST names the same `25FR3 KST` source, but exact print-time raster identity is unverified. | [`paper.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/paper.105#L1-L19), [`cadr.164`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/cadr.164#L1-L10), [`25fr3.ast`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmfont/25fr3.ast#L1-L8) |
| `GACHA8` | The preserved editor environment assigns it to normal text when reformatting Interlisp prettyprinter output for Dover. Which recovered AST or Alto raster variant corresponds to the printer font is unknown. | [`lunar.:ej`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/lunar.%3Aej#L492-L505) |
| `MATH10` | Generated XGP output actually selects slot 9 twice for an error-handler right-arrow prompt and once for a greater-than-or-equal relation; the other eight preserved XGP bodies only declare it. Exact recovered raster-variant identity is unverified. | [`operat.xgp`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/operat.xgp#L883), [`stream.xgp`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/stream.xgp#L238), [XGP font-selection format](https://github.com/PDP-10/its/blob/8ea145f42cabccfad054321a35e1493c1c67970c/doc/info/xgp.24#L427-L432) |

## Contemporary use without a surviving selector

| Logical name | Evidence boundary | Evidence |
| --- | --- | --- |
| `PRT12B` | A bug report reproduces variable-width wrapping with `PRT12B` menu text. This establishes menu use, but not a specific application's role. | [`bug.omail`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/bug.omail#L2465-L2478) |
| `TR12I` | Old-window-system option documentation names it as the default for top and bottom margin-scroll legends. The retained new-window implementation instead uses `TR10I`. | [`option.info`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/option.info#L219-L225), [`choice.12`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/choice.12#L201-L211) |
| `HL12` | A user reported using `HL12`, `HL12I`, and `HL12B` frequently in multi-font files. The report does not say what `HL12` signified, so its purpose remains `TODO`. | [`bugs.old`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/bugs.old#L2693-L2703) |

## No application purpose established

Every name below is an explicit negative audit result for this snapshot. No role is
inferred from an abbreviation, apparent family resemblance, glyph shape, or metric.

### Loaded by the standard FONTS package

The package declaration loads these six fonts, but the complete source scan found no
consumer that establishes a purpose:

| Font | Result |
| --- | --- |
| `HL6` | **TODO:** standard load; no application purpose established. |
| `HL7` | **TODO:** standard load; no application purpose established. |
| `METSI` | **TODO:** standard load; no application purpose established. |
| `TR8` | **TODO:** standard load; no application purpose established. |
| `TR8B` | **TODO:** standard load; no application purpose established. |
| `TR8I` | **TODO:** standard load; no application purpose established. |

### Present only in the source-build list

These 46 names occur in the AST archive compilation list, but no standard load or
application role was identified:

| Font | Font | Font | Font |
| --- | --- | --- | --- |
| `APL14` | `ARR10` | `BLKF10` | `BUG` |
| `CHA` | `CHAS` | `CLAR` | `CLAR12` |
| `CLAR14` | `CLARB` | `CLARGK` | `CLRE14` |
| `GACH10` | `GACH12` | `GATES3` | `GATS3A` |
| `HIP10A` | `HIPO10` | `HL14` | `HL18` |
| `HL7I` | `HL8` | `HL8B` | `MAT10A` |
| `MATH16` | `MUSC10` | `NONM` | `NONS` |
| `PLNK16` | `PRNT10` | `SMT10` | `SMT10A` |
| `SMT14` | `SMT14A` | `ST10` | `ST6` |
| `ST8` | `TNTO14` | `TNTOB` | `TONTO` |
| `TR10` | `TR10B` | `TR12` | `TR12B` |
| `TR14` | `TR18` |  |  |

Each cell means **TODO: source build only; no application purpose established**.

### Present only as recoverable source

These 15 names have a source representation in the tracked recovery catalog, but no
source-build-list, standard-load, or application-role reference was identified:

| Font | Font | Font |
| --- | --- | --- |
| `13FG` | `13FGB` | `14FR3` |
| `16FG` | `40VSHD` | `CM10` |
| `CM12` | `CYR12` | `GLS7X9` |
| `HAFONT` | `HL7B` | `HL7BI` |
| `PRONTO` | `SAIL10` | `SWFONT` |

Each cell means **TODO: recovered source only; no application purpose established**.

## Compiled-only fonts

These names are not among the 88 source-backed derivatives. They survive only as
compiled font files in this snapshot and must not be silently merged with a
similarly named source-backed font.

| Logical name | Classification | Established finding |
| --- | --- | --- |
| `MEDFNB` | Direct runtime | Selected for the `Any`, `Do It`, and `Abort` system-menu entries. [`sysmen.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sysmen.105#L121-L128) |
| `SHIP` | Direct runtime | Spacewar character-blinker glyphs for torpedoes, suns, and differently oriented ships. [`load.swar`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/load.swar#L1-L5), [`swar.2`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/swar.2#L267-L274) |
| `CPT-TR10I` | Reported use, no purpose | A bug report records it in adjacent Zwei text runs, but gives no intended role. Physical file `3TR10I`. [`bug.omail`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/bug.omail#L1507-L1516) |
| `S30CHS` | Runtime observation, no purpose | A bug report inspects the font object's array leader; no purpose is given. [`bug.nlispm`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/bug.nlispm#L1621-L1625) |
| `HL12BI` | Standard load, no purpose | Listed by the `FONTS` package; no consumer identified. |
| `SEARCH` | Standard load, no purpose | Listed as `LMFONT; SEARCH QFASL`; unrelated `NZWEI; SEARCH` code is not font evidence. |
| `20VR` | Inventory only | **TODO:** no purpose established. |
| `31VR` | Inventory only | **TODO:** no purpose established. |
| `40VR` | Inventory only | **TODO:** no purpose established. |
| `BIGVG` | Inventory only | **TODO:** no purpose established. |
| `CPT-13FG` | Inventory only | **TODO:** physical file `3213FG`; no purpose established. |
| `CPT-HL10` | Inventory only | **TODO:** physical file `32HL10`; no purpose established. |
| `CPT-HL10B` | Inventory only | **TODO:** physical file `3HL10B`; no purpose established. |
| `GERM35` | Inventory only | **TODO:** no purpose established. |
| `S35GER` | Inventory only | **TODO:** no purpose established. |
| `SAIL12` | Inventory only | **TODO:** no purpose established. |
| `TR12B1` | Inventory only | **TODO:** no purpose established. |

The common compiled-file evidence is the preserved
[`LMFONT` media inventory](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/wall.3#L314-L392).
`N43XMS` and `NTOG` are older compiled files corresponding to the source-backed
`43VXMS` and `TOG` names. They occur only in that inventory; the established uses of
the newer logical names are not automatically claims about those older artifacts.

## Alias and identity decisions

- `CPTFON` is the source/QFASL artifact whose cold load provides runtime
  `FONTS:CPTFONT`. This is an operational artifact-to-object mapping, not evidence
  that two runtime Lisp symbols are aliases. This specific mapping is directly
  evidenced; it is not a general rule for similar names.
- `HIPO10` is not equated with `HIPPO10`, which occurs in generated XGP font tables.
  The snapshot supplies no alias declaration, and the checked XGP bodies do not
  select the `HIPPO10` slot.
- `CPT-HL10`, `CPT-HL10B`, and `CPT-TR10I` are distinct compiled logical names, not
  aliases for the source-backed `HL10`, `HL10B`, and `TR10I` rows.
- `TR12B1` is not treated as an alias for `TR12B`; no mapping was found.
- `MAT10A` and `MATH10` are separate archive entries.

## Open questions

- Decompile or otherwise inspect the 17 QFASL-only font objects without conflating
  compiled-artifact recovery with source recovery.
- Search additional period load bands, user files, source tapes, manuals, and
  application QFASLs for the 68 source-backed and 15 compiled-only names whose
  purpose remains `TODO`.
- Compare the running System 46 `FONTS` package and editor font maps with this static
  source audit. That can discover dynamically loaded names, but a single running
  world still would not prove every historical use.
- Establish whether the `25FR3`, `GACHA8`, and `MATH10` printer resources are derived
  from, or merely share names with, the recovered `LMFONT` raster sources.

Last verified: 2026-07-16.

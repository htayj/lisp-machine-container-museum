---
type: Artifact Analysis
title: CLOE development and runtime environment
description: An evidence-limited reconstruction of Symbolics CLOE Developer, its Intel delivery runtime, CLIM and Windows integration, migration workflow, Listener, debugger, files, controls, release lineage, and absence from the preserved Open Genera world.
tags: [genera, cloe, common-lisp, ms-dos, windows, unix, clim, development-environment, preservation]
timestamp: 2026-07-18T10:58:00-04:00
---

# CLOE development and runtime environment

CLOE was a paired Symbolics development-and-delivery environment, not an
application installed in this museum's Open Genera world. The **CLOE Developer**
ran on a Symbolics computer under Genera and gave a developer a target-aware Lisp
environment, System Construction Tool integration, migration commands, and a CLOE
Listener. The **CLOE Runtime**, also called the **CLOE Application Generator** in
the manuals, ran the resulting Common Lisp program on an Intel PC. In the best
documented 3.1 configuration, that delivery machine ran MS-DOS and could start
Microsoft Windows 3.0 in Standard mode to host a Symbolics CLIM port.

That conclusion has a strict boundary. The inspected licensed media has one CLOE-
named file: a 163,134-byte compiled Sage documentation database. It has no CLOE
system declaration, package source, compiled product, PC executable, virtual-memory
image, page file, or demo payload. A fresh base-world probe likewise found no CLOE
packages, features, or loaded system. Generic CLIM, CLOS, System Construction, and
Common Lisp files contain compatibility branches and documentation for CLOE, but
those branches are not the product.

Consequently this article reconstructs documented behavior and the development
contract. It does **not** claim to have run CLOE Developer, DOS CLOE, the Windows
front end, the CLOE Listener, or a CLOE CLIM application. There is no published
runtime screenshot: a generic Genera Listener proving absence would show no CLOE
behavior, while the external PC software needed for a representative CLOE screen is
not in the preserved media.

## Scope and evidence classes

“Complete” here means every product layer, target, installation or system name,
delivery file kind, named operation, Listener/debugger control, and key binding that
can be recovered from the inspected documentation. It also means recording where a
complete answer is impossible. In particular, the documentation teaches command
completion but does not enumerate the complete CLOE Listener command table. Without
the implementation or a runnable runtime, inventing the missing commands would be
worse than leaving a bounded TODO.

| Evidence | What it establishes | What it cannot establish |
| --- | --- | --- |
| Licensed `doc/cloe` Sage database | 3.1 installation, release, migration, runtime, Windows, CLIM, Listener, debugger, file, and control documentation | implementation details, whether every record was published in one book, or actual 3.1 runtime behavior |
| Licensed CLIM and Common Lisp Help | documented portability contract, generic CLOE reader conditionals, CLIM gestures, System Construction behavior, and compatibility restrictions | presence of the CLOE product or exact behavior of an unavailable executable |
| Public Symbolics manuals | independently accessible primary-source cross-checks for CLIM, System Construction, the Developer/runtime distinction, and language restrictions | a complete 3.1 reference manual or later product source |
| Full licensed-media manifest | exact local absence of any other CLOE-named artifact | absence from every Symbolics release ever distributed |
| Fresh isolated Genera 8.5 probe | packages, features, and loaded-system state of this base world | whether CLOE could run if separately restored and licensed |

The licensed bodies remain ignored local inputs. This page publishes original
analysis, short interface labels needed to identify the historical workflow, and
portable checksums. It does not reproduce the recovered manuals, source bodies, or
PC payloads.

## What CLOE was

The most useful model is a development pipeline split across two machines:

```text
Genera on a Symbolics computer
  CLOE Developer + SCT system declaration + target-aware Listener
       |  Migrate System / Migrate File / Migrate Precompiled System
       v
Intel 386 or 486 PC under MS-DOS
  CLOE Runtime / Application Generator
       |  compile and load on the PC; save a VMI delivery image
       v
optional Windows 3.0 Standard-mode front end
  WINFE + CLOE CLIM port + delivered application
```

The pipeline was deliberately **not** a cross-compiler. The Developer generated a
target compilation plan and migrated sources, journals, and system bookkeeping. The
386 runtime compiled the application for itself. A separately shipped component such
as CLOE Flavors could instead arrive precompiled for the delivery environment and be
migrated as a loadable-but-not-compilable system.

The public [Program Development Utilities
manual](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf)
explains the design tradeoff. A generic Common Lisp Developer targeted the portable
least common denominator of many Common Lisps. CLOE Developer targeted Symbolics'
own CLOE Runtime, so the two ends could share a richer dialect and purpose-built
migration knowledge. That did not make the two environments identical: performance
and final compilation still had to be tested on the delivery PC.

The inspected primary documents do not expand the word “CLOE.” Contemporary
third-party catalogs often supply an expansion, but this dossier does not elevate it
to a vendor-established fact without a primary witness.

## Product layers and target boundary

| Layer | Where it ran | Established purpose | Status in this museum |
| --- | --- | --- | --- |
| CLOE Developer | Genera 8.1 on a Symbolics computer | target-aware Lisp development, a CLOE activity and Listener, migration, and delivery preparation | documented only; absent from media and base world |
| CLOE Installation | Genera | copy selected runtime products from restored distribution media to a PC host | named in documentation; system absent |
| CLOE Runtime / Application Generator | Intel delivery machine | compile, load, debug, and save a Common Lisp application as a PC virtual-memory image | documented only; no executable or image preserved |
| CLOE CLIM | MS-DOS plus Windows 3.0 Standard mode | CLIM port, Window Front End, Listener, and graphical application delivery | documented only; no `WINFE.EXE`, VMI, or PC environment preserved |
| Low-level `WIN` interface | the CLOE Windows runtime | start Windows programs, a command shell, Notepad, and a file chooser | four documented functions; implementation absent and interface described as unstable |
| CLOE Flavors | compiled on a CLOE delivery environment | optional compatibility system loaded as runtime system `CLOEFL` | migration and load procedure documented; payload absent |
| `CLOE-UI` and `CLOE-WINDOW-DEMOS` | apparently a Genera-side, older CLOE Window System configuration | names only; an older installation draft calls them the User Interface and Window Demos systems | editorial 2.0 residue, not established 3.1 products in this media |
| CLIM demos | CLOE Runtime, and generic counterparts under Genera | examples of presentations, graphics, a Listener, and application frames | behavior documented; generic CLIM demo source exists, but no CLOE runtime exists to exercise it |

The final two rows must not be merged. `CLOE-WINDOW-DEMOS` is named only inside a
commented-out older installation block. The 3.1 CLIM demo instructions are active
documentation for a different demo set on the delivery PC.

### Supported and historical platforms

The release-bounded target matrix is:

| Environment | Evidence-backed statement |
| --- | --- |
| Developer host | The active 3.1 installation guide requires Genera 8.1. It includes world-file examples for both 3600-family (`.load`) and Ivory (`.ilod`) machines. An older Genera 8.0 prerequisite survives only inside editorial commentary. |
| Delivery CPU | The 3.1 prerequisite discusses 386- and 486-based PCs; runtime and migrated product names consistently identify the generated code as 386 code. |
| MS-DOS | One prerequisite says MS-DOS 3.1 or later, while the 3.1 CLIM compatibility statement says 3.3 or later. The evidence therefore supports 3.1 for the non-CLIM generator and the stricter 3.3 floor for the documented CLIM configuration; it does not justify silently choosing one global minimum. |
| Windows | Microsoft Windows 3.0 in Standard mode is required for CLOE CLIM. CLOE is started from DOS first and then starts Windows; it is not launched from an already-running Windows session. |
| Unix | Public and older installed manuals describe a 386 Unix delivery option, and the Sage database retains System V 3.x installation records inherited from 2.0. An active 3.1 clarification says those Unix-oriented examples do not describe a supported 3.1 target. They are lineage evidence, not 3.1 installation instructions. |

The [CLIM Release 2.0
manual](https://bitsavers.org/pdf/symbolics/software/genera_8/Common_Lisp_Interface_Manager__CLIM__Release_2.0.pdf)
contains a Cloe-specific chapter but itself says that the documented CLOE 3.1
Developer uses CLIM 1.0. Thus “CLIM 2.0 manual contains CLOE material” must not be
rewritten as “CLOE 3.1 shipped CLIM 2.0.”

## Media census and absence proof

The purchased Open Genera media was inventoried as a portable manifest: relative
pathname, byte size, and SHA-256 for every file, sorted bytewise. The media root has
5,078 files totaling 242,585,012 bytes; the manifest SHA-256 is
`b99be9b197d049e87c85fabcd96f948711b3d97708153c1bd870214bf5883f54`.
Exactly one relative pathname contains `cloe`, case-insensitively:

| Licensed artifact | Bytes | SHA-256 | Meaning |
| --- | ---: | --- | --- |
| `sys.sct/doc/cloe/cloe-sig.sab.~92~` | 163,134 | `3d61ad6333f044be120fe85a7c95512259e5f1e4a97252f3046dd5cda8604ea7` | compiled Sage documentation database |

There is no `sys.sct/cloe/` product directory and no CLOE-named `.system`,
`sysdcl`, component directory, Lisp source, VBin, FAS, VMI, EXE, page file, or
archive. This is an exact statement about this manifest, not a claim about other
historical release tapes.

The documentation file is Sage format 7, evacuated version 92, with 61 records and
no embedded byte-array payload. Its attributes say that version 92 was compiled on
20 December 1993 with System 451.22 and Sage 439.0 from logical source version 91.
The local inert extractor recovered 113,988 bytes of plain research text and a
structured JSON tree; both remain under the ignored licensed-help build tree.

### Compatibility references are not product source

A static, non-evaluating scan of the licensed Lisp source Help inventory found 17
candidate forms containing `CLOE` across ten files:

| Context | Forms | What the references do |
| --- | ---: | --- |
| CLOS implementation | 11 in seven files | reader-conditionals adapt allocation, documentation storage, method construction, declarations, and function-spec behavior for `CLOE-Runtime` |
| Generic CLIM demo Listener | 1 | selects CLOE/Genera auto-activation behavior in a portable Listener |
| contributed Macsyma system declaration | 3 | chooses CLOE pathname separators and `.lsp`/`.fas` defaults |
| CLIM documentation declaration | 1 | includes the external `SYS:DOC;CLOE;CLOE-SIG` database in the CLIM documentation set |
| Lisp syntax infrastructure | 1 | comments on a package-construction hook needed by CLOE |

These are compatibility seams in shared systems. None defines the CLOE package,
runtime, Windows port, Developer activity, migration commands, or Listener.

The wider Help corpus contains 67 Sage files whose decoded text mentions CLOE:
2,263 records and 5,024,146 source bytes, with selected-manifest SHA-256
`7783ba11855d36a542ca3350aac32b9b38172dc67949e5f2d9a16c2cec6dbf9c`.
Most are Common Lisp dictionary compatibility notes. A string hit in such a manual
is documentation *about* another implementation, not proof that implementation is
installed.

### Filtering editorial commentary

The plain-text extractor deliberately preserves all decoded strings, including Sage
`COMMENTARY` environments. The structured tree finds 25 such blocks across 13 of
the 61 CLOE records. They include author notes about reusing the 2.0 guide,
commented Unix material, retired Window System strings, and edits proposed for
“Release 4.0.” Those blocks were editorial input, not rendered instructions.

This distinction changes several conclusions:

- `CLOE-UI` and `CLOE-WINDOW-DEMOS` are known names, but their only substantive
  installation description is commented older material.
- Unix System V records survive in the database, but the 3.1 path corrects Unix
  examples to DOS separators and does not establish a supported Unix 3.1 product.
- annotations saying material was removed or replaced for 4.0 establish editorial
  intent, not that CLOE 4.0 shipped.
- a longer draft dialog-key table is inside commentary; the rendered CLIM table has
  only the active Abort and Exit rows recorded below.

## Release lineage

The evidence establishes a document lineage more confidently than a complete sales
release chronology:

| Version evidence | Established conclusion |
| --- | --- |
| 1.1 | The public [Genera User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf) gives sample implementation strings for CLOE Developer 1.1 and Application Generator 1.1. These are examples from an earlier documentation layer, not the version in the local 3.1 guide. |
| 2.0 | Editorial metadata says the installation material was adapted from the 2.0 guide and that its Unix and old Window System material was retained for possible reuse. |
| 3.0 | The compiled root retains internal references to a 3.0 release-note root and a 3.0 reference manual. The latter manual is not present as a separate artifact. |
| 3.0.2 | One complete record is titled `CLOE 3.0.2 Release Notes`; it describes a CLIM maintenance release and a change from physical pointer gestures to portable gesture names. |
| 3.1 | The visible root, installation guide, feature summary, target compatibility, Listener, Windows, and migration records consistently identify 3.1. This is the principal release reconstructed here. |
| 4.0 | Several Sage commentary blocks mark sections for removal or replacement in 4.0. No 4.0 product media, source, manual root, or runtime registration was found, so shipped status is TODO. |

The database's 296 per-record modification timestamps range from July 1990 through
December 1993. That range describes document editing, not necessarily product
release dates.

## Developer installation and entry

The documented Developer installation expected a site-configured Genera 8.1 world,
a local or network cartridge-tape drive, enough LMFS space for the restored product,
and IP-TCP when migration to a PC was required. The active guide estimates about 300
LMFS records for the Developer and roughly 5,000 FEP blocks for an incremental world
containing it. Older, larger User Interface and Window Demo estimates occur only in
commentary and are not 3.1 requirements.

The active operations are:

| Operation | Role |
| --- | --- |
| `Load System CLOE` | load the Developer into a Genera world |
| `Select Activity CLOE` | enter the Developer window |
| `SELECT K` | documented activity-selection accelerator for that window |
| `Migrate System` | transfer a defined application's source, journals, and target compilation plan |
| `Migrate File` | transfer an individual development file |
| `Show System Definition CLOE-FLAVORS` | make the optional Flavors definition known without loading the entire system |
| `Migrate Precompiled System CLOEFL` | install a system already compiled on the target architecture |
| `Make CLIM Available` | expose Genera-loaded CLIM facilities to the CLOE Developer Listener |

The guide also describes making a dedicated incremental Genera world containing the
Developer. That historical procedure used ordinary Genera `Load System`, `Save
World`, IDS, boot-file, and FEP operations; those are installation mechanics, not
CLOE application features. This museum did not load the system or invoke any save.

### Installation and distribution identifiers

Not every name in the document has the same status:

| Name | Evidence status | Interpretation |
| --- | --- | --- |
| `CLOE` | active instruction | Genera Developer system |
| `CLOE-INSTALLATION` | active instruction | Genera-side runtime installer; provides `Install CLOE` |
| `CLOE-FLAVORS` | active migration instruction | Genera-side definition for the precompiled compatibility product |
| `CLOEFL` | active runtime instruction | short system name loaded on the PC |
| `CLOE-RUNTIME-MSDOS-386`, `CLOE-MSDOS-CLIM-386` | retained distribution-selection names | likely tape product groups, but no matching product records are in this media |
| `CLOE-RUNTIME-UNIX-386` | commented/dormant | older Unix distribution identifier, not a supported 3.1 target |
| `CLOE-UI` | editorial string only | older “CLOE User Interface” or Window System identifier; implementation and precise purpose TODO |
| `CLOE-WINDOW-DEMOS` | editorial string only | older Window Demos identifier; demo inventory and operation TODO |
| `CLOE-LEGAL-NOTICE` | commented restore guidance | named legal-notice distribution component; absent here |

## Delivery workflow on the PC

The documented application workflow is:

1. Define the application as an SCT system on Genera. CLOE-aware declarations
   preserve ordinary options and use target fields such as `:name`, `:pretty-name`,
   `:short-name`, and `:root-pathname-for-delivery`.
2. Develop and test in the CLOE Developer dialect, while remembering that target
   performance and PC-specific behavior are not simulated exactly.
3. Use `Migrate System` to move source, journals, and the generated compilation plan
   to the delivery host. Use `Migrate File` for a single file, or `Migrate
   Precompiled System` for already-built target binaries.
4. Start the base Runtime or CLOE CLIM VMI from DOS. Load the migrated system
   declaration and compile on the 386. The public System Construction manual limits
   the 386-side `compile-system` interface to `:recompile`, `:version`, `:verbose`,
   `:compile-print`, and `:root-path`.
5. Load the application. For CLIM, defining an application frame automatically
   defines a CLOE program; otherwise call `cloe:define-program` explicitly.
6. Call `cloe:save-program` to produce a virtual-memory image. The public CLIM
   manual documents `:simulate` for a test run without writing the image.
7. Start the saved image with the appropriate DOS activator or batch wrapper.

`cloe:define-program` requires a second argument containing the program arguments;
the 3.1 release note corrects older examples that omitted it. Both
`cloe:define-program` and `cloe:save-program` accept `:loop`. When false, choosing
the program-top-level restart exits to DOS; when true, it re-enters the application's
top level. This is a delivery behavior, not merely a build flag.

For a migrated precompiled Flavors system, the PC Listener loads system `CLOEFL`
with a target root path. The documentation then defines and saves a program to make
a new VMI containing Flavors. Because the payload is precompiled, it can be loaded
but not rebuilt from source in that delivery environment.

## Files and serialization boundary

CLOE delivery used several very different file types. A VMI is a saved CLOE virtual-
memory program image; it is closer to an application Lisp image than to a source
archive. The page file is temporary virtual-memory backing. Neither should be
mistaken for an ordinary Genera VLOD world, and neither is present here.

| Suffix or file | Role established by the 3.1 documents |
| --- | --- |
| `.LSP` | default Lisp source; `.L` is an alternate source/system-bookkeeping suffix and is also used for `INIT.L` startup |
| `.FAS` | 3.1 compiled Lisp file; the release note explicitly corrects older `.B` examples to `.FAS` |
| `.VMI` | loadable/saved CLOE virtual-memory image, including base, CLIM, and delivered application images |
| `.PAG` | temporary paging file; selected by the DOS `CLOEP` environment variable or a current-directory default |
| `.BAT` | DOS startup wrapper that invokes an image activator with a VMI |
| `.EXE` | host executable such as the image activator, configuration utility, Windows front end, or Standard-mode stub |
| `.ZIP` | compressed distribution archive restored from floppy media |
| `SYSTEM.LSP`, `FILES.LSP`, `PATCH.LSP`, `PKGDCL.FAS` | migrated System Construction bookkeeping and compiled package definition shown by the Flavors example |
| `LOGHOSTS.LSP` | default logical-host translation file; `CLOETRANS` or a Lisp variable can select another file |

The distribution records name these roles and representative files:

- base and CLIM images: `CLOE.VMI`, `CLOECLIM.VMI`, and the spelling
  `CLOE-CLIM.VMI` in an older list;
- image activators: `VMRESTOR.EXE`/the command spelling `VMRESTORE`, and
  `CLIMREST.EXE`;
- configuration: `CFIG386.EXE`;
- Windows integration: `WINFE.EXE` and `STDSTUB.EXE`;
- startup: `CLOE.BAT` and `CLOE-CLIM.BAT`;
- page backing: `CLOE.PAG`;
- Lisp payloads: `METER.FAS` and the Listener binary `CLOELIST.FAS`; and
- installation packaging: `CLOECLIM.ZIP`, `INSTALL.BAT`, decompression tools,
  and a readme.

Some records use alternate spellings or older filenames. The source needed to map
every alias to an exact release is absent, so the table preserves those variants
instead of normalizing them away.

The older public Program Development Utilities manual says a CLOE compiled file has
type `.B`. The local 3.1 release record says that such examples are wrong for 3.1
and should say `.FAS`. This is release drift, not a contradiction to be resolved by
choosing whichever manual is more convenient.

## CLIM and Windows integration

### Runtime startup and process relationship

The documented 3.1 CLIM sequence starts from DOS, not Windows:

1. invoke the CLOE CLIM batch/image startup;
2. optionally set `WIN::*WINFE-EXE*` if `WINFE.EXE` is not on the DOS path;
3. call `win:start-windows`, or create `clim:find-port` with server path
   `(:cloe)`; and
4. start the CLIM application after Windows and its only supported CLOE port exist.

The Window Front End initially provides a terminal window. It wraps at the edge
rather than scrolling. CLIM applications normally occupy most or all of the screen,
and a window must have input focus before it receives typing. Clicking a window
gives it focus.

The manual models Windows as a subprocess started after CLOE. Once Windows is
running, calling the Lisp `exit` path first can strand it. The documented shutdown is
the window Close operation or `Alt-F4` for CLOE followed by `Alt-F4` for Windows and
confirmation. This process model is a fact about that DOS/Windows 3.0 runtime; it is
not a statement about Open Genera's host X process.

The CLOE CLIM port has no server-path options beyond `(:cloe)`. A CLIM application
can compile, load, or write files before or after Windows starts, but it needs Windows
to create and operate its graphical frames. The documentation warns against saving a
program while live CLIM windows exist; load the application and save the image before
opening Windows/CLIM state.

### Developer-side CLIM

CLIM itself was not supposed to be migrated as part of an application. In the
Developer workflow, one loaded `CLIM` and the desired Genera or PostScript port in
an ordinary Genera Listener, then issued `Make CLIM Available` from the CLOE
Listener. A debugger reached while experimenting with a CLIM frame appeared on the
CLOE Listener, not inside the CLIM window.

The manual recommends exposing the Listener and experimental CLIM frame side by
side so that the debugger remains visible. For a target-oriented layout, it suggests
designing against the PC's intended VGA or higher-resolution dimensions. These are
documented external-development practices. The current Genera museum world cannot
demonstrate them because the Developer is absent.

### Low-level Windows functions

The 3.1 database describes four functions:

| Function | Documented effect |
| --- | --- |
| `WIN:NOTEPAD` | start Notepad, optionally opening a file |
| `WIN:COMMAND` | start a DOS command shell, optionally run one command and return; `Alt-Tab` switches between shell and Windows |
| `WIN:RUN-WINDOWS-APPLICATION` | start an `.EXE`, with an optional Windows show-state integer; return true or signal the Windows error code |
| `WIN:SELECT-FILE-DIALOG-BOX` | present a Windows-style file chooser for a supplied window ID, default pattern, and caption; return a pathname string or false |

The same documentation says the non-CLIM Windows layer was a low-level interface
supplied in `WINDOWS.LSP` and `WHEADER.LSP`, already compiled into the base image,
and likely to change. That is a compatibility escape hatch, not a stable toolkit
contract. The file-dialog cross-reference is marked for removal in editorial 4.0
commentary, although its standalone function record remains in the 3.1 database.

## CLOE Listener and debugger

Two top levels are described:

- the base CLOE CLIM VMI has a TTY-style read/evaluate/print loop with rubout and
  activation when a complete form terminator arrives; after Windows starts, the same
  basic terminal behavior is available in the Window Front End; and
- the separately loadable CLIM Listener adds a scrollable output history,
  mouse-sensitive expressions, multi-line input, completion, command recall,
  clipboard input, and both Emacs- and PC-style editing keys.

The development Listener accepts Lisp forms or colon-prefixed commands. Space can
complete a command name and move to its arguments. `F1` gives contextual completion
help, and colon followed by `F1` requests the available command set. Within the
Listener-interface record, the only named ordinary colon command is `:Clear Output
History`; the migration workflow separately names `:Migrate Precompiled System`.
Therefore a complete Listener command inventory remains **TODO: requires the
unavailable Listener command table or a runnable CLOE runtime**.

Listener history output is presentation-sensitive. The documented default gestures
are Left to paste an object into input, Middle to describe it, and Right to show an
object-specific menu. Clipboard input is inserted with `F6` and must contain one
complete Lisp expression; the guide recommends loading a file instead of pasting
multiple forms one by one.

### Break, debugger, and stuck states

| Control | Documented behavior |
| --- | --- |
| `Control-C` | enter the ordinary break/debugger path; in CLIM it also returns focus to and exposes the Front End |
| `Control-F6` | enter the separate system/Front-End break even when the CLIM Listener is wedged; documented as unchangeable |
| `%` | request a restart by number in the debugger |
| `Control-B` | brief stack backtrace |
| `Control-N` | next frame, moving away from the error frame |
| `Control-P` | previous frame, moving toward the error frame |
| `?` | list debugger commands and restarts |

Restart choices and backtrace frames are mouse-sensitive; clicking a frame selects
it, and displayed objects can be described. The guide distinguishes a busy garbage
collection, shown by an hourglass cursor, from a damaged Listener. Its recovery path
uses `Control-F6`, a Lisp Listener Top Level choice, and `:Clear Output History` if
redisplay is overwriting itself. Closing the Windows process is the last documented
resort. None of these paths was exercised in this museum.

## Complete documented CLOE Listener bindings

This is the complete 29-action table rendered by the CLOE 3.1 Listener record. A
dash means the document gives no binding in that style. On the PC, `Alt` corresponds
to Emacs `Meta`.

| Action | Emacs-style binding | PC/Windows binding |
| --- | --- | --- |
| Abort input | `Escape` | `Escape` |
| Beginning of buffer | `Alt-<` | `Control-Home` |
| End of buffer | `Alt->` | `Control-End` |
| Forward character | `Control-F` | `Right Arrow` |
| Forward word | `Alt-F` | `Control-Right Arrow` |
| Backward character | `Control-B` | `Left Arrow` |
| Backward word | `Alt-B` | `Control-Left Arrow` |
| Beginning of line | `Control-A` | `Home` |
| End of line | `Control-E` | `End` |
| Next line | `Control-N` | `Down Arrow` |
| Previous line | `Control-P` | `Up Arrow` |
| Rub out character | `Backspace` | `Backspace` |
| Delete character | `Control-D` | — |
| Rub out word | `Alt-Backspace` | `Control-Backspace` |
| Delete word | `Alt-D` | — |
| Clear all input | — | `Delete` |
| Kill line | `Control-K` | — |
| Transpose characters | `Control-T` | — |
| Show argument list | `Control-Shift-A` | — |
| Show value | `Control-Shift-V` | — |
| Yank from kill ring | `Control-Y` | — |
| Yank from history | `F3` | `F3` |
| Yank next history/kill item | `Alt-Y` | — |
| Scroll forward | `Control-V` | `Page Down` |
| Scroll backward | `Alt-V` | `Page Up` |
| Help/possibilities | — | `F1` |
| Paste Windows clipboard | — | `F6` |
| Break | `Control-C` | `Control-C` |
| System/Front-End break | `Control-F6` | `Control-F6` |

The prose says `F3` recalls the first history form and `Alt-Y` continues backward
through history. That is more specific than the table's generic “history yank” and
“yank next” labels, so both descriptions are retained.

## Generic CLIM controls documented for CLOE

The installed and public CLIM 2.0 guide supplies a larger generic input-editor table.
It is relevant to the documented CLOE CLIM port, but it must not overwrite the
release-specific 3.1 Listener table above. In particular, this later table includes
sexp and case operations that the 3.1 CLOE-specific table does not list.

### Gestures and command entry

| Interaction | CLOE CLIM mapping |
| --- | --- |
| activate input | `Return`; unlike Genera, no additional `End` activation is documented |
| abort CLIM input | `Escape`; documented as not rebindable on CLOE |
| break/suspend analogue | `Control-C`, entering a Lisp break rather than suspending a process |
| complete | `Tab` |
| show possibilities | `F1` or Right-click |
| introduce a command | colon |
| complete/terminate command name | `Space` |
| terminate command argument | `Space` |
| preview command in a dialog | no default CLOE gesture |
| select presentation | Left-click |
| describe presentation | Middle-click or `A-Right` (the manual's PC notation) |
| presentation menu | Right-click |

The generic gesture map has no CLOE mapping for the Genera-only delete, edit, and
modify gestures. The 3.0.2 release record further says applications should use
semantic gesture names such as `:describe` and `:edit`, not physical button specs.

### Generic CLIM input-editor table

| Action | CLOE key or keys |
| --- | --- |
| Forward character | `Control-F`, `Right Arrow` |
| Forward word | `Meta-F`, `Control-Right Arrow` |
| Forward sexp | `Control-Meta-F` |
| Backward character | `Control-B`, `Left Arrow` |
| Backward word | `Meta-B`, `Control-Left Arrow` |
| Backward sexp | `Control-Meta-B` |
| Beginning of line | `Control-A`, `Home` |
| End of line | `Control-E`, `End` |
| Next line | `Control-N`, `Down Arrow` |
| Previous line | `Control-P`, `Up Arrow` |
| Beginning of buffer | `Meta-<`, `Control-Home` |
| End of buffer | `Meta->`, `Control-End` |
| Delete character | `Control-D` |
| Delete word | `Meta-D` |
| Delete sexp | `Control-Meta-D` |
| Rub out character | `Rubout` |
| Rub out word | `Meta-Rubout` |
| Rub out sexp | `Control-Meta-Rubout` |
| Kill line | no CLOE key in this table |
| Clear all input | `Delete` |
| Insert new line | no CLOE key in this table |
| Insert parentheses | no CLOE key in this table |
| Transpose characters | `Control-T` |
| Transpose words | `Meta-T` |
| Transpose sexps | `Control-Meta-T` |
| Upcase word | `Meta-U` |
| Downcase word | `Meta-L` |
| Capitalize word | `Meta-C` |
| Show argument list | `Control-Shift-A` |
| Show variable value | `Control-Shift-V` |
| Show documentation string | `Control-Shift-D` |
| Yank from kill ring | `Control-Y` |
| Yank from history | `Control-Meta-Y` |
| Yank next item | `Meta-Y` |
| Scroll forward | `Control-V`, `Scroll` |
| Scroll backward | `Meta-V`, `Meta-Scroll` |

In an active `accepting-values` dialog, `Escape` aborts and `Return` exits when a
field is not being edited. The installed Sage tree contains draft next/previous-field
rows inside `COMMENTARY`; the rendered public manual omits them, so they are not
advertised here as active bindings. The guide documents no special menu keystrokes.

## Demos and visible applications

The active 3.1 runtime documentation describes four CLIM demos:

| Demo | Documented purpose and visible behavior | Evidence limit |
| --- | --- | --- |
| Flight simulator | a map of eastern Massachusetts with selectable airports and visual references, distance queries, and flight-plan construction; demonstrates accepting presented objects | CLOE-specific source and runtime absent |
| Graphics | application frame with interaction pane, menu, and explanatory area; exercises CLIM graphics and displays color as stipples on monochrome output | exact drawings and controls not recovered |
| Lisp Listener | small presentation-based read/evaluate/print loop with mouse documentation, scrollback, input editing, paste, and describe | generic CLIM demo source exists, but it is not proof of the unavailable CLOE port's pixels |
| Mini-CAD | prototype logic-circuit editor for AND/OR gates, selectable gates and nodes, a setup example, and a Show operation | document warns that feedback circuits fail; implementation absent |

The demo driver is a CLIM menu with an Exit choice. The documented system can be
compiled and loaded through `CLIM-DEMO`, then entered with
`clim-demo:start-demo`. The 3.1 text contains a corrupted target label in this
record, so this page relies on the surrounding, consistent MS-DOS/386 evidence
rather than guessing at the damaged characters.

No screenshots of these demos are published. A screenshot from generic Genera CLIM
would document Genera CLIM, not CLOE CLIM; a reconstruction on modern Windows would
be a reimplementation, not a runtime observation.

## Language and system compatibility contract

### Feature identity

The public Genera User's Guide documents these environment distinctions:

- `CLOE` and `SYMBOLICS` features identify both halves;
- `CLOE-DEVELOPER` distinguishes the Genera development side; and
- `CLOE-RUNTIME` distinguishes the PC Application Generator.

It also describes the Developer as reporting Symbolics/Genera machine and software
identity while the Application Generator reports Intel and MS-DOS or Unix identity.
Those examples span older documentation and should not be used to re-enable Unix in
the 3.1 support matrix.

The 3.1 feature record adds or emphasizes enhanced ephemeral GC, CLIM 1.0, the CLIM
Listener, Symbolics CLOS, logical pathnames, double-precision floats, multiple
lifetime classes, new memory placement, and performance guidance. The active memory
records describe a multi-generation ephemeral collector, optional statification
before the final saved image, and configuration controls for how much extended
memory remains available to Windows.

### Confirmed restrictions and differences

The public [Symbolics Common Lisp Programming Constructs
manual](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Common_Lisp_Programming_Constructs.pdf)
and [Language Concepts
manual](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Common_Lisp_Language_Concepts.pdf)
record a portability boundary rather than perfect Genera emulation. Important
documented differences include:

- CLOE has no Genera automatic Flavors-to-CLOS conversion tool, and neither
  environment supports mixing CLOS and Flavors inheritance or dispatch directly;
- Genera-only CLOS locators and the `:locator` slot option are unavailable;
- several Flavors options tied to locatives, special instance-variable bindings,
  custom area keywords, or removing `vanilla-flavor` are unavailable;
- several Genera-only `make-array` storage, leader, and named-structure options are
  unavailable;
- obsolete Zetalisp lambda-list keywords are unavailable;
- the Runtime's source, compiled, and pathname conventions differ from Genera's;
- the Runtime does not provide a uniform site identity and instead uses CLOE
  variables/defaults;
- redirecting `*terminal-io*` is unsafe because cleanup depends on it, while the
  ordinary standard, error, query, trace, and debug streams can be redirected; and
- control-character input follows PC/ASCII behavior, which can differ from Genera
  character objects.

This is a representative architecture boundary, not an attempted republication of
the hundreds of per-function compatibility notes across the 67 Help witnesses. For
an application, the authoritative rule was to develop against the CLOE dialect and
then compile and test in the actual Runtime.

### CLIM restrictions

The local CLIM guide's preliminary-port note says most CLIM Release 1 functionality
was present but not the adaptive toolkit, the full color compositing model, or
documented underlying protocols. The later CLIM 2.0 dictionary adds these concrete
port boundaries:

- `:cloe` is the only CLOE port type and has no port options;
- patterned design support is narrower than the general CLIM model, including a
  fixed tiling-offset restriction in the documented implementation; and
- the generic package examples need reader-conditionals or shadowing because the
  exact Common Lisp/CLIM symbol conflicts depend on the implementation.

These are documented compatibility claims. With neither the port source nor runtime,
the museum cannot determine which limitations were fixed between preliminary,
1.0/3.1, and later documentation states.

## Fresh Genera 8.5 load-state observation

Session `d44-cloe-registration-20260718`, generation 1, ran one read-only form in
Dynamic Lisp Listener 1 on 18 July 2026. It queried four packages, three feature
symbols, and five systems using the loaded-only form of `sct:find-system-named`; it
did not load a system or trigger a site lookup.

All four packages were absent: `CLOE`, `WIN`, `CLOE-RUNTIME`, and
`CLOE-DEVELOPER`. All three features were absent: `CLOE`, `CLOE-DEVELOPER`, and
`CLOE-RUNTIME`. All five loaded-system queries returned no: `CLOE`,
`CLOE-INSTALLATION`, `CLOE-FLAVORS`, `CLOE-UI`, and `CLOE-WINDOW-DEMOS`.
This proves only the base world's load state. It agrees with, but is logically
separate from, the host-media manifest.

The session used the 54,804,480-byte Genera 8.5 world
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`,
1,533,760-byte VLM
`9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`,
346,880-byte debugger
`2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`,
configuration
`5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`,
legacy-command preload
`f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`,
and X compatibility preload
`acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`.
The private world remained identical to the base.

The Bubblewrap run isolated user, mount, network, PID, IPC, and hostname namespaces,
exposed no host root, external route, or guest file service, and used a private Xvfb
with MIT-SHM disabled and verified absent. Both exact guest-X compatibility
substitutions and the one-shot RFC 868 response were observed. The action log has two
intent/outcome entries and SHA-256
`d21ab43f8f114b03ade70a5962c57dcf279229f1cefc4aca0d1da4bb7bbeb82e`.

A local 1200 by 900 evidence capture has PNG SHA-256
`146816e2e696f800e3770b555f2c5028ea4ac9efcf17940f8a358865e14b1498`
and normalized pixel SHA-256
`7efeeb18880a468601255561445357c6505f77f6af1a22e75395803230d6fa1b`.
It remains in the ignored session tree because it is only a generic Listener showing
negative registration results, not a CLOE application state.

Shutdown reached its prompt, sent and accepted confirmation, and observed cleanup,
then reproduced the known bounded VLM cleanup stall and required force-stop.
`orderly_vlm_host_shutdown` is false; `forced_after_confirmed_shutdown_stall` and
`state_may_be_incomplete` are true. The harness did not invoke Save World or create a
host process checkpoint. `save_world_performed` and `guest_checkpoint_created`
remain unknown, while the private world file's unchanged hash establishes that no
world bytes were persisted.

## Documentation coverage of the 61-record database

This compact inventory prevents a few prominent records from standing in for the
whole recovered corpus. Ranges identify the database order, not page numbers in a
printed book.

| Records | Topics present |
| --- | --- |
| 1–6 | 3.1 release/install root, installation guide, distribution media, CLOE/CLIM install, common questions, and runtime-install root |
| 7–12 | migrate precompiled Flavors, load Flavors, load CLOE CLIM, DOS programming hints, DOS runtime files, and defining the PC host in Genera |
| 13–17 | retained Unix installation, Flavors, runtime-file, kernel, and host-definition records; historical/dormant for the 3.1 boundary |
| 18–28 | Developer installation, boot file, saved world, activity selection, patches, load, tape restore, getting started, prerequisites, Application Generator prerequisites, and Developer prerequisites |
| 29–38 | release-note root, suffixes, DOS/Windows compatibility, additional documentation, low-level Windows access, physical/logical pathnames, memory-management changes, memory allocation, and CLIM demos |
| 39–43 | other Windows applications plus file chooser, Notepad, DOS shell, and general Windows-application functions |
| 44–54 | Listener overview/load/base image, break, debugger, stuck states, cut/paste, commands, complete Listener bindings, startup GC, and demos |
| 55–58 | `:loop` clarification, Unix-example correction, `define-program` correction, and a tracking-pointer cross-reference |
| 59 | 3.1 feature summary |
| 60 | 3.0.2 release notes and semantic-gesture compatibility change |
| 61 | duplicate/general CLOE CLIM notes covering install, Listener, Windows applications, demos, and memory; useful as a cross-check, not assumed to be a separate shipped manual |

Several referenced topics have no corresponding record in the file, including the
full CLOE foreign-function interface and the 3.0 reference manual. Their behavior is
TODO unless another licensed or public primary witness is recovered.

## Open questions and preservation priorities

1. **Recover an authoritative CLOE 3.1 product distribution.** The executable,
   Developer source/system definition, runtime VMI, Windows front end, and Listener
   command table are all absent here.
2. **Find the standalone 3.0/3.1 reference manual.** It should resolve the foreign-
   function interface, complete Runtime SCT contract, program-image format, and
   command inventory.
3. **Establish the status of CLOE 4.0.** Editorial annotations alone are insufficient
   evidence of a shipped release.
4. **Identify `CLOE-UI` and `CLOE-WINDOW-DEMOS`.** Present evidence gives names and
   old storage estimates but not reliable features, controls, or screenshots.
5. **Preserve a legally acquired DOS/Windows machine image if found.** A future
   harness should keep raw captures ignored, record exact disk/image hashes, and
   publish only reviewed, claim-specific screenshots.
6. **Reconcile filename variants and the damaged demo target label.** Do not repair
   historical text by intuition.

Until those witnesses are found, the strongest accurate museum label is:
**CLOE is extensively documented as an external Genera-to-PC development and
delivery system, but it is not installed or recoverable from this Open Genera media
set.**

## Public primary sources

The public PDFs were verified on 18 July 2026:

| Vendor manual | Local verification |
| --- | --- |
| [Common Lisp Interface Manager (CLIM), Release 2.0](https://bitsavers.org/pdf/symbolics/software/genera_8/Common_Lisp_Interface_Manager__CLIM__Release_2.0.pdf) | 1,638,498 bytes; 564 PDF pages; SHA-256 `41f54457eceeb875a9f1f2a735b289fcbd4e9ad95dc6a844924192674e40598c` |
| [Program Development Utilities](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf) | 2,292,247 bytes; 420 PDF pages; SHA-256 `2c6e23e4a0f969cb7962b71f0ed0eb390b47e394195f6ed9e7a862ba33914d6f` |
| [Genera User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf) | 1,377,112 bytes; 190 PDF pages; SHA-256 `a38dd9a070d5a0069aa5baa084d3ed1b8be698587e28ffc5efa9c78db36e5ad8` |
| [Symbolics Common Lisp Programming Constructs](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Common_Lisp_Programming_Constructs.pdf) | 1,171,518 bytes; 387 PDF pages; SHA-256 `b2dfa7a74920c8c5707b04b4f148012132f619d1d9317991d786ef5297cfc957` |
| [Symbolics Common Lisp Language Concepts](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Common_Lisp_Language_Concepts.pdf) | 1,275,353 bytes; 443 PDF pages; SHA-256 `43775b21b592610e33950b3de84b3f5030071877b0f6f385a013b54f8979b6f1` |

Related museum context is in [CLIM 2 on
Genera](clim-2-on-genera.md), [Dynamic Lisp
Listener](genera/dynamic-lisp-listener.md), [system construction, patches, worlds,
and distribution](system-construction-patches-worlds-and-distribution.md), and the
[Genera computer-use harness](genera/genera-computer-use-harness.md).

---
type: Historical Article
title: Macsyma 421 on Lisp machines
description: An evidence-bounded guide to the Symbolics Macsyma 421 symbolic mathematics environment, its architecture, user interface, mathematical facilities, editors, help system, and earlier MIT Lisp-machine lineage.
tags: [genera, mit-cadr, lm-3, macsyma, symbolic-mathematics, display-editor, plotting, preservation]
timestamp: 2026-07-18T10:28:00-04:00
---

# Macsyma 421 on Lisp machines

Macsyma on a Lisp Machine was a complete symbolic-mathematics environment, not
merely an editor mode or a small algebra library. The inspected Symbolics
Macsyma 421 release contains 167 installed implementation components spanning
the evaluator, parser, two-dimensional display, simplifier, rational functions,
algebra, calculus, matrices, equation solving, special functions, plotting,
translation, editors, on-line Help, and Genera integration. Its Genera frame
adds typed mathematical presentations, topic and command menus, mouse operations
on displayed subexpressions, a plotting window, and both text and structural
expression editors.

The museum can establish those facts from the licensed but untracked release
media, compiled-object inspection, the product's local Help database, public
historical sources, and a controlled Genera run. It cannot yet show the running
Macsyma frame: the purchased media includes the contributed product, but the
museum's clean Genera 8.5 base world does not have Macsyma registered or loaded.
Exact behavior which depends on loading that product is therefore marked
`TODO`, rather than inferred from menus or manuals.

The evidence also corrects an important catalog boundary. The public MIT CADR
System 46 tree and maintained LM-3 System 303 tree do not contain the Macsyma
product source, but that does **not** mean Lisp Machines only had a Macsyma
editing mode. Contemporary MIT material describes the port, and LM-3 bug and
patch records identify worlds carrying experimental Macsyma releases. “Editor
mode only” is accurate only as a description of the source files preserved in
those two public trees.

## Scope and evidence classes

This dossier distinguishes four kinds of evidence:

- **Public source evidence** covers the MIT System 46 editor integration and
  contemporary descriptions, later LM-3 bug and patch records, and an older
  public DOE Macsyma Lisp-Machine supervisor retained by the Maxima project.
- **Licensed media observation** covers the exact Macsyma 421 system
  declaration, component inventory, compiled user-interface metadata, patch
  directory, and Help-topic structure. No licensed implementation or Help text
  is reproduced here.
- **Interpretation** connects those implementation surfaces into a workflow.
  Interpretations are labelled where the exact visible effect has not been run.
- **Runtime observation** covers only the clean Open Genera 2.0 / Genera 8.5
  world. It proves that this particular base world lacks the product; it does
  not test an installed Macsyma 421 system.

“Complete” in the command tables means every Macsyma-specific top-level and
nested menu entry recovered from the exact 421 compiled media, plus every
Macsyma-specific editor gesture found in the audited manual and compiled
modules. It does not mean every inherited Genera command, every mathematical
function among the 2,510 Help topics, every site extension, or an effective
keymap reconstructed from a product which has not been loaded.

## Release and artifact boundary

The inspected local release directory identifies `Macsyma` as released system
421 and latest system 421, written for Open Genera 2.0 / Genera 8.5 on 6 August
1998. Its component declaration describes experimental Macsyma 421.0 one day
earlier. The patch directory reaches released patch 421.45, while one source-
world header records Macsyma 421.43. These are related but different version
layers: system version, patch version, and the version loaded in the world which
wrote a file.

| Licensed local artifact | Bytes | SHA-256 | What was used |
| --- | ---: | --- | --- |
| Complete 216-file Macsyma 421 tree, deterministic relative-path/content manifest | 4,265,771 payload bytes; 19,977-byte manifest | `9aa95b10827a9f2156cabfce3787389ca0d4d8c2089cda78fff291f1866228de` (manifest) | File census and release layout |
| `defs/sysdcl.lisp.~382~` | 14,509 | `da1cee54215bdbf769cb8495ac49d40abfebcbae99a0a65446f7b34da70b5943` | System architecture and platform conditionals |
| `manual/engrman.mdoc.~941~` | 1,069,409 | `e0db5fd7482d5044d9d16f04aa800ff8fb3f14bf6385d85b68605b868e054098` | Topic census and documented interaction |
| `macsyma.component-dir` | 17,672 | `036f39cbc25b1d4be507e18951c31ea67b872461106cf96f3f967d0a4716d80f` | Exact installed 421 component list |
| `macsyma.system-dir` | 1,465 | `d2be2ffba38592d8b33c754ff9d86ef2aab415687f7310b13ba1846c1e24b4a6` | Released and experimental version registration |
| `macsyma.patch-dir` | 5,600 | `735a38335489435015cfaa33f69c1f838ed30e8c4f3191b08c1a53f548e16933` | Patch extent and source-world headers |

The tree contains 211 versioned compiled modules, one Lisp system declaration,
one manual database, and the three system/component/patch directory records.
The copyright notices identify proprietary Macsyma, Inc. material with portions
originating at MIT. The directory, decoded Help, compiled modules, and raw
runtime captures remain untracked. This page records facts and checksums, not
recovered proprietary code or documentation.

## Lineage: MIT Macsyma, CADR, LM-3, and Symbolics

Macsyma began as an MIT Project MAC symbolic-manipulation system. Richard
Fateman's first-person retrospective describes its Algol-like user language,
Pratt-style extensible parser, multiple mathematical representations, exact
arithmetic, two-dimensional display, and the 1982 code release which became the
common ancestor of the DOE and Symbolics lines. That paper is a historical and
technical witness, not a description of every Symbolics 421 interface.

The Lisp-Machine port existed well before the 1998 media inspected here:

- MIT System 46 `lmdoc/paper.105` says most of Macsyma had been ported and
  compiled for the Lisp Machine and that most facilities worked, while noting
  remaining exceptions. That is contemporary port status, not a product
  inventory.
- `lmdoc/kbdpro.3` documents the Macsyma use of Control-] for a progress or
  elapsed-time report.
- `nzwei/modes.49` supplies a Macsyma editing mode. Its presence proves editor
  integration, not the contents of a load band.
- LM-3 `zwei/bugs.bugs` and `zwei/bug.zwei` refer to experimental Macsyma
  versions in actual Lisp-Machine worlds. `patch/system-99.patch-directory`
  likewise records a source world containing Experimental Macsyma 6. Those
  records establish product presence in the lineage even though the maintained
  public System 303 source tree omits the product implementation.
- The public Maxima archive retains an older `archive/src/lmsup.lisp` supervisor
  which creates a Macsyma listener and registers it on the System and Select
  keys. It is valuable corroboration of the MIT/DOE interface lineage, but it is
  **not** source for Symbolics Macsyma 421. In particular, its Select-A binding
  must not be projected onto the later product without runtime evidence.

The practical conclusion is narrow: public CADR and LM-3 trees can document the
integration points and historical presence, while the licensed Symbolics media
documents the later product. They are not interchangeable source witnesses.

## System architecture

The 421 declaration defines a patchable `Macsyma` system maintained by Macsyma,
Inc. It has conditionals for Lisp Machines, CLOE, VAX/VMS, Unix/AKCL, the VLM,
36xx machines, and I-machines. The selected compiled suffix varies accordingly:
`.vbin` for the VLM, `.ibin` for Ivory, and `.bin` on earlier Lisp Machines.

The declaration names 219 paths in total, including platform-only branches,
autoloaded libraries, and commented or obsolete modules. The component
directory's 167 inputs per target architecture are the authoritative installed
core. Counting those installed inputs by directory gives:

| Family | Components | Principal responsibility |
| --- | ---: | --- |
| `defs` | 2 | Packages, macros, compatibility, and system-wide declarations |
| `base` | 12 | Evaluator, parser, display, command loop, variables, and core data behavior |
| `system` | 31 | Supervisor, files, status, user language, translation support, and system services |
| `simp` | 11 | General simplification and expression normalization |
| `ratfn` | 30 | Rational/polynomial representation, factoring, GCD, resultants, and canonical forms |
| `algebra` | 7 | Higher-level algebraic transformations and equations |
| `analysis` | 12 | Limits, series, transforms, differential equations, and analysis utilities |
| `integration` | 5 | Indefinite, definite, Risch, and special integration machinery |
| `solve` | 8 | Algebraic equation and root solving |
| `specfn` | 3 | Special functions |
| `plot` | 6 | Plot calculation, graphics streams, 2-D/3-D drawing, and Lisp-Machine plot windows |
| `transl` | 19 | Macsyma-to-Lisp translation and compilation |
| `lispm` | 7 | Genera frame, Help, editor, buffer, TeX, installation, and window integration |
| `tools` | 9 | Trace, options, utilities, and developer support |
| `db` | 4 | Algebraic database and rule facilities |
| `pgms` | 1 | Bundled program support |

This organization explains why “extracting the source from the world” is the
wrong preservation model. Macsyma 421 is a loadable multi-file Genera system.
Its distributed implementation is mostly compiled `.vbin` modules, and the
world is only the live state into which they may be loaded. Compiled modules
retain names, constants, calls, menus, dispatch tables, and other behaviorally
meaningful structure, but not necessarily the original source syntax, comments,
local names, macro forms, or file organization.

## User language and listener workflow

Macsyma's top level combines a mathematical expression language with a live
Lisp implementation beneath it. Input is not ordinary Common Lisp:

- a semicolon terminates an input and displays its result;
- a dollar sign terminates an input while suppressing result display;
- functions use mathematical call syntax such as `factor(expression)`;
- assignment, lists, arrays, loops, conditionals, functions, rules, and option
  variables form a programmable user language;
- noun and verb forms distinguish an unevaluated operation from requesting its
  evaluation; and
- Lisp remains available for system extension and implementation work.

The parser and display share operator knowledge. A user-defined input operator
can therefore participate in output notation as well as parsing. Internal
mathematical objects are Lisp structures, but Macsyma maintains several
specialized representations rather than forcing all calculations through one
printed form: general expressions, rational/polynomial forms, Poisson series,
Taylor series, matrices, exact integers and ratios, floating and big-float
numbers, and noun forms can coexist.

Three asynchronous controls are documented for the Lisp-Machine session:

| Gesture | Effect |
| --- | --- |
| Control-Abort | Abort the current computation to the innermost Macsyma top level. |
| Control-Suspend | Enter a Macsyma break. `EXIT;` resumes and `ABORT;` flushes the suspended computation. |
| Control-] | Print elapsed/progress information without interrupting the calculation. |

The exact disposition of partially computed state after each interrupt remains
a runtime `TODO` for the installed 421 product.

## The Genera frame

Compiled 421 metadata defines a `MACSYMA-FRAME` with a listener, a topic pane,
a command-menu pane, and a separate plot pane/window. Mathematical input and
output are presentation objects: the interface can associate a displayed
subexpression or command name with the underlying Macsyma object and offer
operations appropriate to it.

The topic pane has eight top-level categories:

| Algebra | Calculus | Graphics | Matrices |
| --- | --- | --- | --- |
| Parts | Trig | Utilities | Help |

For a topic, left selects it, middle sets related options, and right offers
actions. For a command, left accepts its typed arguments; middle offers related
commands or Describe; right opens an action menu which can prompt, describe,
run an example, or show related commands. The product also has a keyboard menu
style in which numbered items are selected with the number followed by `;`.

`PREFERRED_MENU_STYLE` chooses mouse or keyboard menus. Mouse popups are the
Symbolics implementation; the numbered keyboard form is the portable fallback.
`PREFERRED_GREETING_STYLE` chooses a displayed, multi-font greeting or a plain
printed form. These variables make the interface intentionally adaptable to
workstations and terminal-like implementations.

### Complete top-level command menu

The eight topic menus expose 69 top-level command entries:

| Topic | Count | Commands |
| --- | ---: | --- |
| Algebra | 10 | Allroots, Combine, Distrib, Divide, Expand, Factor, Product, Ratsimp, Solve, Sum |
| Calculus | 8 | Diff, Ieqn, Integrate, Laplace, Limit, Ode, Residue, Taylor |
| Graphics | 6 | Graph, Nameplot, Plot, Plot3d, Review_Plot, Replot |
| Matrices | 11 | Array, Determinant, Eigenvectors, Invert, Matrix, Makelist, Triangularize, Setelmx, Setify, Sort, Submatrix |
| Parts | 11 | Conjugate, Coeff, Denom, Lhs, Num, First, Pickapart, Rhs, Realpart, Map, Subst |
| Trig | 8 | Demoivre, Fourier, Exponentialize, Logarc, Poissimp, Trigexpand, Trigreduce, Trigsimp |
| Utilities | 9 | Fortran, Initialize_Macsyma, Load, Printfile, Save, String, Writefile, Trace, Tex |
| Help | 6 | Apropos, Demo, Describe, Example, Primer, Usage |

The 77 compiled popup constants are these 69 commands plus the eight topic
selectors. This table is an interface inventory, not a claim that every command
is applicable to every selected expression.

### Complete recovered nested menu inventory

Forty-nine top-level commands have nested panels. The compiled definitions name
264 distinct entries across those panels; repeated helpers such as `Distrib`
and `Multthru` are counted once in that distinct total.

| Parent | Nested commands |
| --- | --- |
| Array | Array, Listarray, Fillarray, Rearray, Arrayinfo, Remarray |
| Matrix | Matrix, Augcoefmatrix, Coefmatrix, Copymatrix, Diagmatrix, Ematrix, Entermatrix, Genmatrix, Genvector, Ident, Zeromatrix |
| Determinant | Determinant, Det, Newdet, Permanent |
| Submatrix | Submatrix, Col, Minor, Row |
| Setelmx | Setelmx, Addcol, Addrow |
| Eigenvectors | Eigenvectors, Charpoly, Eigenvalues, Ncharpoly |
| Triangularize | Triangularize, Rank, Echelon, Jordanform |
| Makelist | Makelist, Delete, Length, Copylist, Reverse, Sublist, Assoc, Max, Min, Cons, Endcons, Append |
| Setify | Setify, Union, Intersect, Complement, Setdifference, Symmdifference, Powerset, Subset, Permutations, Permutations_Lex |
| Sort | Sort, Orderless, Ordergreat, Unorder |
| Invert | Invert, Transpose, Adjoint |
| Nameplot | Nameplot, Killplots, Loadplots, Saveplots |
| Plot | Plot, Adaplot2, Adaparamplot2, Paramplot, Plot2_Vector_Field |
| Graph | Graph, Graph3d |
| Plot3d | Plot3d, Contourplot |
| Integrate | Integrate, Antidiff, Changevar, Defint, Ldefint, Risch, Romberg, Specint, Tldefint |
| Diff | Diff, Depends, Gendiff, Gradef, Ratdiff, Remove |
| Ode | Ode, Desolve, Diffsol, Bc2, Ic1, Ic2, Ode2, Odefi, Runge_Kutta, Series, Taylor_Ode |
| Laplace | Laplace, Atvalue, Ilt |
| Limit | Limit, Tlimit |
| Taylor | Taylor, Pade, Powerseries, Taylor_Revert, Taylor_Solve, Taylorinfo, Deftaylor |
| Fortran | Fortran, Gentran, Collapse, Optimize |
| Initialize_Macsyma | Initialize_Macsyma, Kill, Remfunction, Remvalue |
| Load | Load, Batch, Batchload, Batcon, Convert_Obsolete_Save_File, Loadfile |
| Printfile | Printfile, Filename_Merge, File_Search, Filelength, Filelist, Listfiles, Probefile, Qlistfiles, Renamefile, Delfile |
| String | String, Args, Grind, Playback |
| Trace | Trace, Dispfun, Fundef, Untrace |
| Writefile | Writefile, Appendfile, Closefile, Stringout |
| Tex | Tex, Write_Tex_File, Close_Tex_File, Tex_Into_Buffer |
| Poissimp | Poissimp, Intopois, Outofpois, Printpois, Poistimes, Poisplus, Poisexpt, Poisdiff, Poisint, Poissubst, Poismap |
| Fourier | Fourier, Totalfourier, Fft |
| Allroots | Allroots, Realroots, Nroots |
| Solve | Solve, Linsolve, Algsys, Matsolve, Eliminate, Resultant, Grobner |
| Product | Product, Prodcontract, Bashindices, Niceindices |
| Sum | Sum, Intosum, Nusum, Sumcontract, Unsum |
| Factor | Factor, Algfac, Factorsum, Factorout, Gcfactor, Gfactor, Gfactorsum, Horner, Nthroot, Polydecomp, Sqfr |
| Combine | Combine, Factcomb, Logcontract, Minfactorial, Radcan, Rootscontract, Scsimp, Xthru |
| Expand | Expand, Distrib, Multthru, Partfrac, Rat, Ratexpand, Ratvars |
| Divide | Divide, Bezout, Content, Ezgcd, Fasttimes, Gcd, Mod, Numfactor, Poly_Discriminant, Powers, Quotient, Remainder |
| Ratsimp | Ratsimp, Fullratsimp |
| Distrib | Distrib, Multthru |
| Subst | Subst, Fullratsubst, Lratsubst, Ratsubst, Substinpart, Substpart |
| Realpart | Realpart, Cabs, Carg, Conjugate, Imagpart, Polarform, Rectform |
| Map | Map, Fullmap, Fullmapl, Maplist, Matrixmap, Scanmap |
| Denom | Denom, Ratdenom |
| Num | Num, Ratnumer |
| Coeff | Coeff, Bothcoeff, Ratcoef |
| Pickapart | Pickapart, Dpart, Inpart, Nterms, Part, Reveal |
| First | First, Last, Rest |

The product also defines option-variable menus and typed accepting-values
prompts associated with topics and commands. Those settings are data-driven;
the exact values visible in a particular session depend on loaded modules and
current state. A live option-panel census is a `TODO`.

## Direct manipulation of mathematical output

Compiled gesture descriptions establish the following operations on selected
displayed expressions or subexpressions:

| Gesture | Recovered operation |
| --- | --- |
| Meta-Left | Expand the selected expression. |
| Meta-Right | Factor the selected expression. |
| Control-Meta-Middle | Run `Substpart`, prompting for the replacement expression. |
| Control-Meta-Left | Replace the selected operator through `Substpart`. |
| Control-Meta-Shift-Middle | Run `Subst` on the selected expression. |
| Super-Left | Open or reveal an elided expression. |
| Super-Right | Close or elide an expression. |
| Control-Meta-Right | Offer other operations: Distrib, Evaluate, Multthru, Radcan, Ratsimp, Ratexpand, Simplify, Trigexpand, Trigreduce, Trigsimp, or an Other prompt. |

The 421 code also contains a middle-click `DLINE-IDENTITY` operation on a
display line. Its name suggests transferring or identifying a displayed result,
but the exact visible effect is **TODO** until the product is run or the function
is reconstructed at higher confidence. The product exposes facilities for users
to add and remove Macsyma mouse commands, so this table describes the recovered
core rather than a closed extension mechanism.

## Mathematical capability map

The Help database is a command reference rather than a formal algorithmic
specification. The following map combines the installed module families, menu
surfaces, and topic summaries without promising that a particular problem is
solvable or fast:

| Area | Recovered facilities |
| --- | --- |
| Algebra and canonical forms | Expansion and distribution; factoring; polynomial and rational canonical forms; GCD, resultants, discriminants, quotient/remainder, square-free decomposition, radicals, logarithmic combination, and expression combination |
| Simplification | General simplifier; `Ratsimp` and `Fullratsimp`; trigonometric, Poisson-series, radical, and rational simplification; option-controlled canonicalization |
| Equations and roots | Symbolic solve, linear systems, algebraic systems, matrix solve, elimination, resultants, Groebner support, numerical and real roots, and differential-equation helpers |
| Calculus | Differentiation, dependencies and derivative properties; limits; Taylor and power series; Padé forms; indefinite and definite integration; Risch and special integration; numerical quadrature |
| Transforms and special functions | Laplace and inverse Laplace transforms, Fourier facilities and FFT, trigonometric transformations, and special-function modules |
| Matrices and linear algebra | Matrix construction and entry; determinant, inverse, transpose, adjoint, rank, echelon and triangular forms, eigenvalues/eigenvectors, characteristic polynomials, Jordan form, submatrices, and coefficient matrices |
| Collections and combinatorics | Lists, sets, union/intersection/difference, subsets, powersets, permutations, sorting, arrays, and mapping |
| Numeric computation | Exact integers and rational numbers, complex numbers, machine floating point, big floats, numerical roots, quadrature, and optimization/translation support |
| Rules and database | Pattern rules, algebraic database facilities, assumptions/options, and user-extensible syntax and semantics |
| Programming and translation | Functions, arrays, control constructs, batch files, translated/compiled Macsyma programs, optimized generated expressions, and FORTRAN output |
| Files and production | Load, batch and save operations; file inspection and renaming; transcripts; expression grinding; TeX conversion; buffer insertion; printing and hardcopy routes |

This breadth was one of Macsyma's defining achievements, but it also made global
options and representation changes significant. A loaded package can alter
syntax, simplification, or defaults. Reproducible historical experiments should
therefore record the system and patch version, loaded files, option values, input,
and whether results came from exact or approximate arithmetic.

## Plotting and graphics

Macsyma 421 includes six installed plotting components plus Lisp-Machine graphics
and plot-window integration. The recovered interface spans:

- ordinary 2-D function plots, parametric plots, adaptive plots, vector fields,
  implicit plots, graphs, and pole-zero style displays;
- 3-D surfaces, faces and data plots, contours, 3-D graphs, parametric and vector
  plots, and complex-function plotting;
- axes, scale, points, labels, line style, superposition, screen position,
  coordinate system, perspective, tessellation, and color settings;
- plot animation and a view-control dialog; and
- named plot lifecycle operations: save, load, kill, review, replot, and hardcopy.

`PLOTMODE` distinguishes display and Tektronix-oriented output in the
documentation. The plot modules create a Lisp-Machine plot window and graphics
stream rather than merely emitting a host image file. The exact appearance,
default colors, menus, and hardcopy destinations in 421 are runtime `TODO`s.

## Help and self-documentation

The local engineering-manual database is a line-oriented ASCII topic store in
which `&` begins a topic. A structural scan found:

| Measure | Count |
| --- | ---: |
| Topics | 2,510 |
| Function-like headings | 1,505 |
| Operator, atom, option, or other headings | 1,005 |
| Headings stating defaults | 501 |
| Topics with an Example route | 936 |
| Topics with a Demo route | 164 |
| Topics with a Usage route | 224 |
| Topics with See-also links | 1,149 |
| Topics with a Load route | 28 |

Summary topics cover algebra, arrays, calculus, files, floating-point numbers,
geometry, integration, matrices, ordinary differential equations, plotting,
quadrature, rules, statistics, strings, tensors, and trigonometry.

The main Help entry points are `Primer`, `Describe`, `Usage`, `Example`, `Demo`,
and `Apropos`. A query ending with `?` asks for command-line help. The compiled
Lisp-Machine Help frame maintains an index, current/previous/next topics,
contexts, hypertext links, and actions which launch examples or demonstrations.
This is deeper integration than a flat manual viewer: Help records can lead back
into executable product content.

The museum's Genera Help extractor may recover this database into ignored local
output for analysis, but neither the decoded topics nor the proprietary source
are committed. See [On-line Help recovery](genera/online-help-and-documentation-recovery.md) for
the reproducible local procedure and rights boundary.

## Expression editors

Macsyma 421 contains three distinct editing routes: a linear MEDIT command, a
structural Display Editor, and Zmacs buffer integration. They should not be
collapsed into “the Macsyma editor.”

### MEDIT

`MEDIT(expression)` edits an optional expression; without one it uses the
previous saved input according to the manual. Its compact command language ends
commands with `$$`; another `$$` exits and evaluates the edited form.

The audited manual documents the following useful MEDIT commands. It does not
label that list exhaustive, so neither does this article:

| Command | Operation |
| --- | --- |
| `nC` | Move forward `n` characters. |
| `nR` | Move backward `n` characters. |
| `nSstring$` | Search for a string. |
| `(` and `)` | Move across a balanced parenthesized expression. |
| `[` and `]` | Move across a balanced bracketed expression. |
| `nD` | Delete `n` characters and save them. |
| `nK` | Kill through a carriage return and save it; `0K` applies to the left side. |
| `Istring$` | Insert a string. |
| `GR` | Yank the saved material. |
| `$$` | Finish a command; at the outer prompt, exit and evaluate. |

Strings recovered from the compiled legacy editor independently expose buffer
display, forward/backward character motion, up/down line motion, deletion,
forward/backward killing, search, insertion, and yank. Exact additional command
letters are `TODO` pending a trustworthy uncompile or live command-help display.

### Display Editor

The Display Editor is a structural editor for mathematical expression trees. Its
screen consists of a mode line naming the Macsyma Display Editor, mode, and
buffer; an expression area; and a minibuffer. Expression input in the minibuffer
is terminated with `;`.

Recovered control machinery contains single-character and Control-X dispatch
tables, user key assignment, key and command description, a live “list keys”
operation, extended-command entry, quit, refresh, debug, exit, expression
evaluation, and return to Emacs. The effective default character-to-command map
has not yet been extracted; publishing guessed keys would be worse than a
clearly bounded inventory.

The expression operations are:

- move forward or backward by branch, to previous or next level, or to the top;
- select the first or last branch;
- grow or shrink the selected region;
- delete, replace, transpose, or copy the region;
- kill following branches;
- simplify or evaluate the region;
- add, multiply, divide, or exponentiate the region;
- expand, factor, differentiate, integrate, multiply through, perform partial
  fractions, or rationally simplify the region; and
- assign the current expression.

The buffer operations are:

- copy a region or whole expression;
- insert or replace an expression;
- visit first, last, previous, or next expression;
- transpose or delete expressions;
- kill following expressions;
- redisplay or change the window;
- select a buffer; and
- list buffers.

**TODO:** load the exact 421 product, invoke its List Keys operation, and record
the complete effective default keymap and mode-specific overrides. This is the
one substantial keybinding gap in the recovered editor interface.

### Zmacs integration

The Macsyma buffer mode recovered from `buffer.vbin` supplies:

| Key or command | Effect |
| --- | --- |
| Control-Shift-E | Generic Evaluate Region |
| Tab | Indent Relative |
| Evaluate Buffer | Evaluate the current Macsyma buffer. |
| Evaluate Region | Evaluate the selected region. |
| Compile Buffer | Compile the buffer. |
| Translate Buffer | Translate the buffer through the Macsyma translator. |

The integration can insert an expression or TeX rendering into a Zmacs buffer.
The TeX module includes `Convert Expression to TeX`, which reads an expression
in the minibuffer; `TEX_INTO_BUFFER` and `INTO_BUFFER` provide programmatic
routes. For inherited editor motion, file, buffer, search, and definition
commands, see [From EINE to ZWEI and Zmacs](lisp-machine-text-editors.md).

## Files, batch work, translation, and debugging

Macsyma is both interactive and file-oriented:

- `Load`, `Loadfile`, `Batch`, and `Batchload` bring programs or command files
  into a session;
- `Save` and the obsolete-save conversion route preserve or migrate product
  data in product-defined formats;
- `Writefile`, `Appendfile`, `Closefile`, and `Stringout` record output;
- the file menu can merge names, search, probe, list, rename, and delete files;
- `Playback` revisits prior input;
- `Trace`, `Dispfun`, `Fundef`, and `Untrace` expose program structure and
  execution; and
- the translator and optimizer turn user-language programs or expressions into
  compiled Lisp-level behavior, with FORTRAN and general code-generation paths.

The Lisp substrate means ordinary Genera debugging and source tools can also be
relevant after translation, but the exact handoff between a Macsyma-level error,
the Macsyma break loop, and the Genera debugger must be observed in a loaded
421 session. See [Tracing, stepping, breakpoints, and call analysis](trace-stepper-breakpoints-and-call-analysis.md)
for the general Lisp-machine facilities.

## Controlled Genera 8.5 observation

A fresh network-isolated session `d42-macsyma-registration-20260718`, generation
1, booted the exact museum base world on 18 July 2026. Read-only listener queries
returned `NIL` for both `MACSYMA` and `CLIMAX` packages. An error-contained
`SCT:GET-SYSTEM-VERSION` query for `Macsyma` returned `NIL` plus the suppressed
condition, confirming that the clean world did not know the system.

No contributed module was loaded, no file service was exposed, and no Save World
operation occurred. The action log contains 36 intent/outcome records and has
SHA-256 `31a5bd4e6287d1fd708ea4a8840a4db43fd31c05320c25a9ac8afa779edc9430`.
The base and private world both ended with SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`.
The VLM accepted its host shutdown confirmation and began cleanup, then hit the
known bounded cleanup stall and was force-stopped. Unsaved Lisp state was
discarded.

This observation establishes only absence from the base world. The purchased
media's 421 component directory remains positive evidence that the product is
available as an optional contributed system.

## Screenshot decision

No screenshot is published for this dossier yet. The only runtime image reached
was the ordinary Dynamic Lisp Listener showing the negative registration query;
it does not show Macsyma and adds little visual evidence beyond the recorded
result. Publishing it would not satisfy the repository's “representative visible
state” goal.

**TODO:** stage the licensed Macsyma directory only inside a disposable ignored
harness session, load the product through ordinary Genera system mechanisms
without bypassing any product checks, exercise the listener, command/topic panes,
Display Editor, Help frame, and representative plot, then review the smallest
necessary images individually under
[the screenshot publication policy](screenshot-publication-rights-review.md).
Any accepted images should support analysis of interface behavior; they should
not reproduce manual/Help pages, demos dominated by third-party artwork, or a
decorative gallery.

## Preservation implications

For meaningful preservation, retain these layers separately:

1. the licensed, unmodified 421 distribution and its system/component/patch
   records;
2. checksums and an evidence-only inventory which can be published safely;
3. inert tools for local compiled-object and Help analysis;
4. the Genera/VLM world and loader needed to run the product;
5. recorded loaded systems, patches, option values, and test inputs for every
   behavioral result; and
6. public lineage witnesses from MIT, LM-3, and DOE/Maxima without representing
   them as the exact Symbolics source.

Uncompiling `.vbin` modules can recover a behaviorally useful Lisp-like model:
global definitions, constants, calls, control flow, dispatch tables, and UI data
can often be reconstructed. It cannot promise the original source. The best
museum description should therefore call such output reconstructed or
decompiled behavior, cite the exact binary, and preserve uncertainty about lost
names, macros, declarations, and comments.

## Open questions

- `TODO`: load unmodified Macsyma 421 through supported Genera mechanisms and
  record the exact startup command, product checks, greeting, Select activity,
  frame layout, and patch version.
- `TODO`: run Display Editor's List Keys operation and publish the complete
  effective key table, distinguishing defaults, user bindings, and inherited
  editor operations.
- `TODO`: determine the exact visible behavior of middle-click
  `DLINE-IDENTITY` from runtime or high-confidence reconstruction.
- `TODO`: exercise one representative operation in each mathematical family and
  record defaults which materially affect the result; do not extrapolate
  algorithm coverage from one example.
- `TODO`: verify plot defaults, color use, view-control behavior, animation, and
  hardcopy destinations in the exact 421 environment.
- `TODO`: compare the public DOE Lisp-Machine implementation to 421 at the
  definition/algorithm level without copying proprietary code into the public
  tree.

## Public sources and verification

- Richard J. Fateman, [*A Review of Macsyma*](https://www.bitsavers.org/pdf/mit/macsyma/Fateman_ReviewOfMaxima_1982.pdf),
  first written 1982–1984 and lightly revised in 2001; lineage, language,
  representation, display, and documentation context.
- V. Kajler and N. Soiffer,
  [*A Survey of User Interfaces for Computer Algebra Systems*](https://people.eecs.berkeley.edu/~fateman/temp/kajler-soiffer.pdf);
  historical context for the 1979 display editor and later Symbolics
  mouse/menu interface.
- MIT AI Laboratory,
  [*Getting Started Computing at the AI Lab*](https://dspace.mit.edu/bitstream/handle/1721.1/41180/AI_WP_235.pdf),
  AI Working Paper 235; contemporary availability and port context.
- MIT CADR System 46, pinned public
  [`nzwei/modes.49`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/modes.49),
  [`lmdoc/kbdpro.3`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/kbdpro.3), and
  [`lmdoc/paper.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/paper.105),
  commit `8e978d7d1704096a63edd4386a3b8326a2e584af`.
- Maintained LM-3 System 303,
  [`zwei/modes.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Fmodes.lisp),
  [`zwei/bugs.bugs`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Fbugs.bugs),
  [`zwei/bug.zwei`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Fbug.zwei), and
  [`patch/system-99.patch-directory`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=patch%2Fsystem-99.patch-directory),
  check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
- Maxima public source archive,
  [`archive/src/lmsup.lisp`](https://sourceforge.net/p/maxima/code/ci/663177dac0d6d093e1b4f947fba4c81c34104f1b/tree/archive/src/lmsup.lisp),
  commit `663177dac0d6d093e1b4f947fba4c81c34104f1b`; local file 19,544 bytes,
  SHA-256 `b104d42a0ba82a50ac8400520a262d4dbe0a3ae87449d79e70772ae6b4717323`.

Public links and changing repositories last verified 2026-07-18. Licensed media
observations were performed locally on the same date and are not redistribution
links.

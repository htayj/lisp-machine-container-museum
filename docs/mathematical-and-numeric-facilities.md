---
type: Historical Article
title: Mathematical and numeric facilities on CADR and Genera
description: A source, manual, Help, and runtime dossier on the MATH matrix package, rational and complex arithmetic, numeric interfaces, and infix readers from MIT System 46 through LM-3 System 303 and Symbolics Genera 8.5.
tags: [mit-cadr, lm-3, genera, math, matrices, numerics, rational, complex, infix]
timestamp: 2026-07-18T10:40:23-04:00
---

# Mathematical and numeric facilities on CADR and Genera

The Lisp machines did not have a single monolithic “mathematics application.”
They had a small `MATH` package for matrix operations, a much deeper numeric
substrate in the base Lisp system, and an optional algebraic reader that translated
infix notation into ordinary Lisp forms. The maintained LM-3 System 303 source
provides exact rational and complex arithmetic and a particularly rich infix
grammar. Genera retains the same eight matrix functions, moves its language-facing
numeric contract to Symbolics Common Lisp, and replaces the old infix parser with a
smaller implementation.

These facilities are APIs rather than a dedicated visible application. Their normal
entry points are Lisp forms typed in a Listener or called by programs. There is no
separate Math frame, command table, keymap, or menu to inventory. This dossier
therefore uses an infrastructure completeness grain: every supported `MATH` entry
point; every documented numeric category and public function family; the public
rational/complex layer; and every token and operator in both infix grammars. It does
not enumerate private arithmetic dispatchers, microcode handlers, compiler
optimizers, or every machine instruction. [Macsyma](macsyma-421-symbolic-mathematics-environment.md)
is the separate symbolic-mathematics product. Its editor mode alone does not prove
load-band contents, while contemporary port documentation and LM-3 world records do
establish real Lisp-Machine Macsyma installations; the linked dossier preserves that
distinction.

## Evidence and release boundaries

| Boundary | Evidence inspected | What it establishes |
| --- | --- | --- |
| MIT CADR System 46 | Public source at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` and the third-edition Lisp Machine Manual | The early `MATH` module, matrix algorithms, an early transcendental implementation, and the absence of the later `RAT` and `INFIX` modules from this snapshot |
| LM-3 System 303 | Maintained public Fossil tree at check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`, tagged `system-303`; contemporary manual source; patch files; and a fresh System 303 runtime session | The later matrix interface, rational/complex representation, complete old infix grammar, numeric manual categories, patch history, and observed behavior |
| Symbolics Genera 8.5 | Licensed Open Genera source; locally decoded installed Help used only as evidence; public Genera 8 manuals and release notes; and a fresh isolated runtime session | The Genera matrix implementation, Common Lisp compatibility links, documented numeric dictionary, reduced infix grammar, and a reproducible runtime/source conflict |

The public MIT snapshot is historical evidence. The public LM-3 Fossil tree is a
maintained restoration line and is not silently presented as the same source release.
The Genera source, world, decoded Help, and runtime captures remain licensed local
inputs and are neither reproduced nor linked from this article. Public links and
local artifact hashes were verified on 2026-07-18.

## Where the facilities live

### System 46

System 46 declares package `MATH` with one load module, `AI: LISPM2; MATRIX QFASL`.
The package declaration allocates 100 symbols, but package size is not an API count.
The matrix manual and implementation agree on eight intended user functions. The
core `SYSTEM-INTERNALS` numeric file is loaded independently of `MATH`; it supplies
integer square root, square root, logarithm, exponential and trigonometric routines,
and exponentiation support.

No `RAT` or `INFIX` module corresponding to the later System 303 files was found in
the pinned System 46 load inventory. That is a statement about this source boundary,
not about every MIT or LMI Lisp-machine release.

### LM-3 System 303

System 303 still declares `MATH` as the single `SYS: SYS2; MATRIX` module. The base
system separately loads:

| Module | Role |
| --- | --- |
| `SYS2; NUMDEF` | Numeric representation constants and constructors for ratios and complex numbers |
| `SYS2; NUMER` | Transcendental functions, float conversion/decomposition, rounding, and numeric dispatch |
| `SYS2; RAT` | Rational and complex accessors, exact conversion, rationalization, conjugation, phase, and generic arithmetic |
| `IO1; INFIX` | A reader extension that parses algebraic notation into Lisp forms |

This separation is historically useful: `MATH` is matrix algebra, while ratios,
complex numbers, elementary functions, and infix reading are core Lisp facilities.
The `MATH` package grows from 100 to 200 allocated symbols, but the exported matrix
interface remains deliberately small.

### Genera 8.5

Genera declares `MATH` as a subsystem of `UTILITIES`; its serial source component is
still `sys2/matrix`. The base `SYSTEM` separately loads numeric definitions,
transcendentals, floating-point support, bignums, double floats, complex arithmetic,
and rational arithmetic. The infix reader belongs to `Development-Utilities`, not
the `MATH` subsystem or the Common Lisp standard.

This load boundary explains three user-visible facts:

- ordinary Common Lisp numeric operations are available without loading `MATH`;
- matrix functions use the `MATH:` package and may be loaded as part of Utilities;
- the infix reader can be absent even when arithmetic and matrices are present.

## The complete `MATH` interface

The following eight functions are the complete intended System 46 interface and the
complete exported functional interface in System 303 and Genera. System 303 and
Genera additionally export the `SINGULAR-MATRIX` condition.

| Entry point | Arguments | Contract at the inspected release boundaries |
| --- | --- | --- |
| `LIST-2D-ARRAY` | `array` | Convert a rank-two array to a row-major list of lists. It does not accept a vector. |
| `FILL-2D-ARRAY` | `array list` | Fill a rank-two array from successive sublists. Both the outer list and each selected inner list wrap when too short. System 46 and System 303 fall through with no explicit useful value; Genera explicitly returns `array`. |
| `MULTIPLY-MATRICES` | `matrix-1 matrix-2 &optional matrix-3` | Multiply compatible rank-one or rank-two arrays; store into the optional result array or allocate a result. Rank-one orientation differs by release and is detailed below. |
| `INVERT-MATRIX` | `matrix &optional into-matrix` | Copy a square rank-two matrix, invert it by Gauss–Jordan elimination with pivot selection, and return the destination. A supplied destination must have the same square shape. |
| `TRANSPOSE-MATRIX` | `matrix &optional into-matrix` | Transpose a rank-two array into a supplied or newly allocated array. In-place operation is a special case and consequently requires a square shape. |
| `DETERMINANT` | `matrix` | Return the determinant of a square rank-two array. The algorithm changes from recursive cofactors in System 46 to LU decomposition in System 303 and Genera. |
| `DECOMPOSE` | `a &optional lu ps` in System 46/System 303; `a &optional lu ps ignore` in Genera | Compute an LU decomposition with scaled partial row pivoting. Return the combined lower/upper matrix and row-permutation vector. Supplied output arrays are reused. Genera's fourth optional argument is accepted but unused. |
| `SOLVE` | `lu ps b &optional x` | Given the results of `DECOMPOSE` and a right-hand-side vector, perform forward and back substitution and return the solution vector, reusing `x` if supplied. |
| `SINGULAR-MATRIX` | condition, System 303 and Genera | An arithmetic-error condition signaled by decomposition or inversion when no usable pivot exists. It reports that the matrix is singular. |

Internal predicates such as `1D-ARRAYP`/`2D-ARRAYP`, the old recursive helper
`DET-1`, and the later destructive `PERMUTATION-SIGN` helper are implementation
details, not additional supported `MATH` applications or commands.

### Matrix representation and result types

Matrices are ordinary Lisp arrays. `AREF`, array element types, displacement, and
the general storage system therefore govern their representation. There is no
separate matrix object, sparse format, symbolic coefficient type, or matrix editor.
Arithmetic dispatch is ordinary `+`, `-`, `*`, and division, so exact rationals and
complex elements can participate when the surrounding numeric implementation and
array element type permit them.

The later decomposition sources avoid allocating an integer-specialized `LU` array
when division may produce non-integers: when the input element type is a subtype of
integer, a general element type is chosen. Optional destinations give callers
allocation control but also make shape and alias rules part of the contract.

### Rank-one arrays changed meaning

The manuals' shorthand “matrix” obscures a real compatibility break:

| Release | Rank-one interpretation in multiplication | Consequence |
| --- | --- | --- |
| System 46 source | A vector is treated as an `N×1` column. As the first operand it can therefore form an outer product only with a compatible `1×M` second operand; as the second operand it supports matrix-by-vector multiplication. | The implementation attempts rank-one support even though the short manual description calls the arguments two-dimensional. Later patches show that this code had vector defects. |
| Maintained System 303 | A first-operand vector is treated as a `1×N` row; a second-operand vector is an `N×1` column. The result is a vector when the corresponding result dimension is one. | Both `vector × matrix` and `matrix × vector` take the conventional orientations. Runtime produced `(13 16)` for `#(1 2) × #2A((3 4) (5 6))`. |
| Genera 8.5 source | A vector is again uniformly treated as an `N×1` column. | `matrix × vector` works and returns a vector. `vector × matrix` generally fails unless the second matrix has one row, in which case it is an outer product. Runtime produced `#(11 17)` for a 2×2 matrix times `#(1 2)` and rejected the reverse order. |

System 303 patch 98.36 records failures on vectors and careless result-array types.
Patch 98.42 then explicitly fixes `vector × matrix`. The final maintained source
implements row-vector semantics but retains an old comment saying that a rank-one
array is `N×1`. The code, patch history, manual, and runtime agree with one another;
the comment is stale. Genera's later source comment and implementation agree on
column-vector semantics. Portable code must not infer the orientation merely from
the function name.

### What the manuals and Help omit or contradict

The System 46 matrix manual describes both multiplication operands as
two-dimensional, while its source already attempts vector support. The maintained
System 303 array manual corrects this and explicitly allows one- or two-dimensional
operands; its final implementation and the runtime agree, notwithstanding the stale
`N×1` source comment.

Genera's installed Help regresses to saying that multiplication matrices are
two-dimensional. The licensed implementation accepts rank-one arrays, and the live
matrix-by-vector result proves that this is reachable behavior in the inspected
world. Help does accurately preserve a separate inversion limitation: conformally
displaced arrays do not work. It also prints `DECOMPOSE`'s fourth `ignore` argument
without explaining it; direct source inspection establishes that the argument is
genuinely unused compatibility surface. These are not editorial guesses—the first
is a Help/source/runtime contradiction and the latter two are Help/source
cross-checks.

### Aliasing and displacement

System 303 and Genera protect the exact case where `matrix-3` is the same forwarded
array object as either input: multiplication uses a temporary, copies the result
back, and returns the requested destination. The source explicitly checks identity,
not overlapping displacement. Two distinct displaced arrays that share storage can
therefore still overlap in ways the safeguard does not detect.

Genera's installed Help separately warns that inversion does not work on conformally
displaced arrays. Its implementation uses `DECODE-RASTER-ARRAY`, spans, one-dimensional
array registers, and direct storage access for speed; the restriction is not a
general statement that displaced arrays are invalid Lisp arrays.

### Algorithms and lineage

The matrix file credits the linear-equation routines to Forsythe and Moler's
*Computer Solution of Linear Algebraic Systems* (1967). Across the releases:

- `INVERT-MATRIX` uses Gauss–Jordan inversion. For each row it chooses the largest
  absolute entry in an unused column, records the chosen columns, pivots, and finally
  permutes the result.
- `DECOMPOSE` forms a combined `L-I+U` array and a permutation vector. It scales rows
  by their largest-magnitude element, chooses a scaled pivot, and performs Gaussian
  elimination without physically moving rows.
- `SOLVE` interprets the permutation vector, performs forward substitution through
  the implicit unit-diagonal lower triangle, then back substitution through the
  upper triangle.
- System 46 `DETERMINANT` recursively expands cofactors and uses two bit arrays to
  track free rows and columns. System 303 and Genera reuse `DECOMPOSE`, multiply the
  diagonal of `U`, and correct the sign from the row permutation. A singular
  condition is converted to determinant zero.

All three matrix sources still say that iterative improvement is not implemented.
That is a concrete unfinished numerical path: `SOLVE` returns the direct LU result
and does not perform residual-based refinement.

Genera 8 release notes report substantial performance improvements to multiplication,
transpose, and inversion. Source inspection explains the direction of that work:
the Genera file decodes raster arrays once, retains row spans, uses array-register
declarations, and accesses storage through one-dimensional operations inside the
inner loops.

## Numeric model and public categories

### System 46 boundary

The System 46 `NUMER` source implements `ISQRT`, `SQRT`, `LOG`, `EXP`, sine and
cosine in radians and degrees, one- and two-argument arctangent, and hard or slow
exponentiation paths. It handles fixnums, bignums, and short/full floating formats.
No later-style `RAT` module was located at this boundary, so this article does not
project System 303's ratio and complex representation backward onto System 46.

### System 303 representation

System 303's numeric definitions add exact ratios and complex numbers as
three-word extended-number objects. Constructors enforce canonical forms:

- a ratio never retains denominator zero, never retains denominator one, and is
  reduced to an integer when division is exact;
- a rational complex number with zero imaginary part becomes its real part;
- complex components are either both rational or use the same floating type;
- integer and rational arithmetic is exact until a floating operand requests a
  floating result.

The source defines a 17-bit short-float significand model and a 31-bit single-float
significand with an 11-bit exponent field. These representation constants are
implementation facts, not promises that every arithmetic path has the same
intermediate precision.

The complete public rational/complex utility layer defined directly by System 303
`RAT` is:

| Function | Meaning |
| --- | --- |
| `NUMERATOR`, `DENOMINATOR` | Return the two canonical components of a rational; an integer has denominator one. |
| `REALPART`, `IMAGPART` | Return complex components; a real number has imaginary part zero. |
| `RATIONAL` | Convert a rational unchanged or recover the exact rational value represented by a floating datum. |
| `RATIONALIZE` | Find a simpler rational compatible with an optional tolerance. `NIL` regards all represented bits as valid; a positive integer gives the number of valid bits; a negative integer is minus the count of low bits to ignore; a float gives relative uncertainty as a ratio of the input magnitude. |
| `CONJUGATE` | Negate the imaginary component of a complex number; return a real unchanged. |
| `PHASE` | Return the polar angle, with sign-sensitive real-axis cases. |
| `CIS` | Construct `cos(angle) + i sin(angle)`. |
| `SIGNUM` | Return zero for zero, otherwise a unit-magnitude value in the same direction. |

`RATIONALIZE` uses continued-fraction reasoning to choose the simplest rational in
the permitted interval. It is not merely a decimal printer or a fixed-denominator
approximation.

The contemporary System 303 numeric manual and Genera Help preserve an important
language boundary: ZetaLisp integer division truncates the quotient toward zero and
leaves a remainder with the dividend's sign, whereas Common Lisp `/` returns an
integer or exact ratio as appropriate for rational arguments. An infix expression's
division meaning consequently depends on the readtable/file syntax selected by the
later Genera reader.

### Genera's Common Lisp numeric contract

Genera documents the Common Lisp numeric tower as:

```text
number
├── real
│   ├── rational
│   │   ├── integer (fixnum or bignum internally)
│   │   └── ratio
│   └── float (single or double)
└── complex
```

Rationals are exact and limited by available memory rather than a fixed magnitude.
The installed type documentation gives the Genera fixnum interval as
`-2^31` through `2^31-1`; larger integers become bignums without changing their
Common Lisp type relationship. Ratios are normalized, a positive denominator is
used, and an integral quotient is represented as an integer. Complex numbers whose
imaginary part is exact zero can canonicalize to a real.

For mixed arguments, the installed coercion table converts rational plus
single-float to single-float, rational plus double-float to double-float,
single-float plus double-float to double-float, and a complex/noncomplex pair to
complex. `MAX` and `MIN` are documented exceptions that do not coerce their returned
argument. A single-float computation is not silently widened merely because its
result overflows while a double float could hold it; callers must request the wider
format. These are language-level coercion rules, distinct from the implementation's
intermediate arithmetic.

The Common Lisp and ZetaLisp names must not be conflated:

| Interface | Genera source behavior |
| --- | --- |
| `CL:RATIONAL` | Permanently linked to `SI:EXACT-RATIONAL`; a float becomes the exact ratio represented by its bits. |
| `CL:RATIONALIZE` | Permanently linked to `ZL:RATIONAL`; returns the simplest rational that would round back to the float. |
| `CL:/` | Linked to `SYS:RATIONAL-QUOTIENT`; the Common Lisp implementation defines unary reciprocal and repeated exact division through its internal rational-quotient operation. |
| `ZL:/` | Legacy ZetaLisp division interface; under the ZetaLisp source readtable the literal slash in this package-qualified name is typed `ZL://`. Code that requires Common Lisp exact-quotient semantics should not substitute it by spelling alone. |

The licensed `RAT` source contains a commented-out complex branch in exact-rational
conversion and says it cannot be right because the result must satisfy `RATIONALP`.
This is an unfinished/dead path, not evidence that `CL:RATIONAL` accepts complex
arguments.

### Complete documented numeric interface grain

The Genera installed numeric dictionary and short-form category documentation were
reconciled with the licensed implementation. At the promised public grain, the
complete families are below. Names identified as legacy remain documented entry
points; private `%` arithmetic dispatchers and compiler-only helpers are excluded.

| Category | Documented interface |
| --- | --- |
| Numeric predicates | `COMPLEXP`, `FLOATP`, `INTEGERP`, `NUMBERP`, `RATIONALP`, `ZEROP`, `PLUSP`, `MINUSP`, `ODDP`, `EVENP`; legacy `FIXP`, `FIXNUMP`, `FLONUMP`, `BIGP`, `SIGNP` |
| Comparisons and extrema | `/=`, `<`, `<=`, `=`, `>`, `>=`, `MAX`, `MIN`; legacy `LESSP`, `GREATERP`, and documented Lisp-machine character synonyms |
| Basic arithmetic | `+`, `-`, `*`, `/`, `1+`, `1-`, `ABS`, `CONJUGATE`, `GCD`, `LCM`, `REM`, `MOD`, `EXPT`, `SQRT`, `ISQRT`, `SIGNUM`; legacy word and `$` aliases for arithmetic operators |
| Exponential and logarithmic | `EXP`, one- or two-argument `LOG` |
| Circular and polar | `SIN`, `COS`, `TAN`, `SIND`, `COSD`, `TAND`, `CIS`, `ASIN`, `ACOS`, one- or two-argument `ATAN`, `PHASE` |
| Hyperbolic | `SINH`, `COSH`, `TANH`, `ASINH`, `ACOSH`, `ATANH` |
| Rational and floating conversion | `RATIONAL`, `RATIONALIZE`, `FLOAT`; legacy `DFLOAT` and older `FLOAT` forms |
| Integral rounding | `FLOOR`, `CEILING`, `TRUNCATE`, `ROUND`, and floating-result `FFLOOR`, `FCEILING`, `FTRUNCATE`, `FROUND`; legacy `FIX`, `FIXR` |
| Number components | `NUMERATOR`, `DENOMINATOR`, `COMPLEX`, `REALPART`, `IMAGPART` |
| Float inquiry and scaling | `DECODE-FLOAT`, `INTEGER-DECODE-FLOAT`, `FLOAT-DIGITS`, `FLOAT-PRECISION`, `FLOAT-RADIX`, `FLOAT-SIGN`, `SCALE-FLOAT` |
| Integer Boolean operations | `LOGIOR`, `LOGXOR`, `LOGAND`, `LOGEQV`, `LOGNAND`, `LOGNOR`, `LOGANDC1`, `LOGANDC2`, `LOGORC1`, `LOGORC2`, `BOOLE`, `LOGNOT`, `ASH`, `INTEGER-LENGTH`, `LOGCOUNT`, `LOGBITP`, `LOGTEST`, plus documented legacy aliases |
| Byte fields | `BYTE`, `BYTE-POSITION`, `BYTE-SIZE`, `DPB`, `DEPOSIT-FIELD`, `LDB-TEST`, `LDB`, `MASK-FIELD`, `SCL:DEPOSIT-BYTE`, `SCL:LOAD-BYTE` |
| Random numbers | `MAKE-RANDOM-STATE`, `RANDOM`, `RANDOM-STATE-P`, `SCL:RANDOM-NORMAL`, `SI:RANDOM-CREATE-ARRAY`, `SI:RANDOM-INITIALIZE`, legacy `GLOBAL:RANDOM`, and `*RANDOM-STATE*` |
| Machine-dependent operations | `SYS:%32-BIT-PLUS`, `SYS:%32-BIT-DIFFERENCE`, `SCL:LSH`, `SCL:ROT`, `SYS:%LOGDPB`, `SYS:%LOGLDB` |

The compatibility surface hidden by the phrase “legacy aliases” is finite. The
numeric dictionary additionally names `GLOBAL:+$`, `GLOBAL:PLUS`, `GLOBAL:-$`,
`GLOBAL:DIFFERENCE`, `GLOBAL:MINUS`, `GLOBAL:*$`, `GLOBAL:TIMES`, `GLOBAL:/`,
`GLOBAL:/$`, `GLOBAL:QUOTIENT`, `GLOBAL:1+$`, `GLOBAL:ADD1`, `GLOBAL:1-$`,
`GLOBAL:SUB1`, `GLOBAL:GCD`, `GLOBAL:\`, `GLOBAL:REMAINDER`, `GLOBAL:EXPT`,
`GLOBAL:^`, `GLOBAL:^$`, `GLOBAL:SQRT`, `GLOBAL:LOG`, `GLOBAL:ATAN`,
`GLOBAL:ATAN2`, `GLOBAL:DFLOAT`, `GLOBAL:FLOAT`, `GLOBAL:FIX`, `GLOBAL:FIXR`,
and `GLOBAL:RANDOM`. The corresponding predicate/comparison compatibility names
are `FIXP`, `FIXNUMP`, `FLONUMP`, `BIGP`, `SIGNP`, `LESSP`, and `GREATERP`.
The integer-bit compatibility group adds `GLOBAL:LOGAND`, `GLOBAL:LOGIOR`,
`GLOBAL:LOGXOR`, `GLOBAL:HAIPART`, `GLOBAL:HAULONG`, and `GLOBAL:BIT-TEST`.

`BOOLE`'s documented operation constants are `BOOLE-CLR`, `BOOLE-SET`,
`BOOLE-1`, `BOOLE-2`, `BOOLE-C1`, `BOOLE-C2`, `BOOLE-AND`, `BOOLE-IOR`,
`BOOLE-XOR`, `BOOLE-EQV`, `BOOLE-NAND`, `BOOLE-NOR`, `BOOLE-ANDC1`,
`BOOLE-ANDC2`, `BOOLE-ORC1`, and `BOOLE-ORC2`. These select Boolean truth
tables; they are not sixteen additional arithmetic algorithms.

The same documentation exposes the usual numeric constants and controls: `PI`,
`MOST-POSITIVE-FIXNUM`, `MOST-NEGATIVE-FIXNUM`, and the `MOST-POSITIVE-*`,
`MOST-NEGATIVE-*`, `LEAST-POSITIVE-*`, `LEAST-NEGATIVE-*`, `*-EPSILON`, and
`*-NEGATIVE-EPSILON` families for the Common Lisp short, single, double, and long
float names. The `SCL:LEAST-{POSITIVE,NEGATIVE}-NORMALIZED-*` family distinguishes
normalized extrema for those four names. Genera implements two underlying float
precisions; the four Common Lisp format names include aliases rather than proving
four distinct representations. `SYS:SINGLE-FLOAT-P` and `SYS:DOUBLE-FLOAT-P` are
also indexed low-level predicates.

Reader/printer controls are `*PRINT-BASE*`, `*PRINT-RADIX*`, `*READ-BASE*`,
`*READ-DEFAULT-FLOAT-FORMAT*`, `SCL:*PRINT-EXACT-FLOAT-VALUE*`, legacy `BASE` and
`IBASE`, and the internal documented extended-ibase signed/unsigned reader
variables. The special form
`WITHOUT-FLOATING-UNDERFLOW-TRAPS` establishes a dynamic region in which underflow
does not enter the normal trap path.

The implementation goes deeper than the public summary. It handles normalized and
denormalized single and double floats, trap/exception state, integer promotion,
and machine arithmetic. It also contains `NEXTAFTER`, although that name was not
found in the installed short-form public dictionary and is therefore recorded here
as source-visible rather than promoted into the documented interface.

Genera 8 release notes report fixes for denormalized square roots, double-float
square-root rounding, logarithms of large bignums and ratios, logarithm coercion,
and a `FLOOR` underflow path. These are evidence that the numeric substrate was an
actively corrected implementation, not only a static Common Lisp compatibility
table.

## Infix readers

Both readers are Pratt-style top-down operator-precedence parsers. They consume a
compact algebraic language and return Lisp forms; evaluation remains the ordinary
Lisp evaluator's job. In the System 303 readtable, sharp sign followed by Altmode
(Escape on a modern terminal approximation) enters infix reading, and a closing
Altmode terminates the expression. The Genera Help describes the corresponding
reader as a convenience notation, not a complete or intended-to-be-extensible
programming language.

### Lexical rules

| Facility | System 303 | Genera 8.5 |
| --- | --- | --- |
| Symbols | Ordinary symbol tokens; backslash quotes a character into a symbol | Start with a letter or underscore; subsequent characters can be letters, digits, or underscore; backslash quotes a character |
| Numbers | Any numeric token accepted by the underlying reader, including real and imaginary forms | Decimal-style tokens with optional fraction and exponent; exponent markers include `E`, `B`, `S`, and `D` |
| Strings | Ordinary reader strings are accepted | No direct string-token production in the infix tokenizer; use `!` to read an ordinary Lisp string or form |
| Escape to Lisp | `!` reads one ordinary Lisp object | `!` reads one ordinary Lisp object |
| Comments | `% ... %` | No corresponding percent-comment token in the inspected parser |
| Termination | Closing Altmode at top level | Reader terminator supplied by the invoking readtable/stream |

### Full System 303 grammar

The table is ordered from strongest to weakest binding. Decimal numbers are the
source's binding powers.

| Binding | Syntax | Lisp form or behavior |
| --- | --- | --- |
| 200 | `a[i,j]` | `(AREF a i j)` |
| 200 | `f(a,b)` | `(f a b)` |
| 200 | grouping `(a)`; comma-separated `(a,b,...)` | Grouping or `(PROGN a b ...)` |
| prefix | `[a,b,...]` | `(LIST a b ...)` |
| 180 left / 20 right | `place : value` | `(SETF place value)`; low right binding admits a whole conditional or assignment value |
| 140 left / 139 right | `a ^ b` | `(EXPT a b)`; right associative |
| 120 | `*`, `/` | Repeated multiplication or division. The source spells a literal slash as `//` under Lisp-machine reader escaping; that is not a two-slash infix token. A `CLI:/` definition supplies the Common Lisp interface variant. |
| 100 | binary `+`, `-` | Repeated addition or subtraction |
| prefix 100 | unary `+`, `-` | Identity or negation |
| 95 | `a . b` | `(LIST* a b)` |
| 95 | `a @ b` | `(APPEND a b)` |
| 80 | Lisp Machine character code 006 | `(MEMQ left right)` membership test; the source character's expansion/name is not guessed here |
| 80 | `<`, `>`, `=`, `≤`, `≥`, `≠` | Corresponding comparison form |
| prefix 70 | `NOT a` | `(NOT a)` |
| 60 | `a AND b` | `(AND a b)` |
| 50 | `a OR b` | `(OR a b)` |
| conditional | `IF c THEN a` and `IF c THEN a ELSE b`; comma-separated branch forms are allowed | Expands to `WHEN` without an else, `UNLESS` when the then branch is empty, or `IF`, wrapping multiple then forms in `PROGN`; condition parses at power 45 and branches at power 25 |
| delimiters | comma, closing bracket/parenthesis, `THEN`, `ELSE`, Altmode | End the current subexpression at the appropriate nesting level |

The old implementation's `DEFINFIX`, `DEFPREFIX`, `DEFDELIMITER`, and
`DEFREPINFIX` macros make additional operators mechanically definable. The
contemporary reader manual gives only a short example and directs readers to the
source for more detail; the table above is therefore intentionally source-derived.

### Full Genera 8.5 grammar

Genera keeps the central arithmetic and conditional language but removes several
System 303 forms:

| Binding | Syntax | Lisp form or behavior |
| --- | --- | --- |
| 200 | `a[i,j]` | `(AREF a i j)` |
| 200 | `f(a,b)` | Function call |
| 200 | grouping `(a)`; comma-separated `(a,b,...)` | Grouping or `PROGN` |
| 200 prefix | `!object` | Read one ordinary Lisp object |
| 180 left / 20 right | `place : value` | `SETF` |
| 140 left / 139 right | `a ^ b` | right-associative `EXPT` |
| 120 | `*`, `/` | multiplication or division; the division form maps to `ZL:/` or `CL:/` according to the readtable's file syntax. The implementation's `//` spelling is Lisp-machine source escaping for one literal slash. |
| 100 | binary and unary `+`, `-` | arithmetic or sign |
| 80 | `<`, `=`, `>`, `≤`, `≠`, `≥` | comparisons; the three non-ASCII operators are Lisp-machine characters in the source |
| prefix 70 | `NOT a` | `NOT` |
| 60 | `a AND b` | `AND` |
| 50 | `a OR b` | `OR` |
| conditional | `IF c THEN a` and optional `ELSE b` | `IF`; condition and branches retain the older 45/25 parsing split |
| delimiters | comma, close bracket/parenthesis, `THEN`, `ELSE`, terminator | End the current subexpression |

The Genera source explicitly rejects prefix `[`; the old list literal is not merely
undocumented. Dot/`LIST*`, at-sign/`APPEND`, the code-006 membership operator,
strings, and percent comments are also absent from the inspected tokenizer/parser;
the comparison glyphs remain. The source uses internal setup functions and a table of
`infix-key` structures, so extension is technically possible, but installed Help
explicitly says the notation is not intended as an extensible or full language.

The Genera source includes a substantial `TEST-INFIX-READER` fixture. Its automatic
invocation is block-commented with an initialization/loading-order concern. In the
live Listener the function ran, but many comparisons differed only because expected
forms were compiled in `SI`/ZetaLisp package context while actual forms were read in
`CL-USER`; rebinding `*PACKAGE*` removed some but not all differences. The test is
therefore useful source evidence, not a context-independent installed conformance
command.

## Runtime observations

### Maintained System 303

The fresh CADR session `d27-math-20260718`, generation 1, booted load band
`System 303-0` in the Xvfb harness. Exact listener inputs established:

| Input intent | Observed result |
| --- | --- |
| Multiply `#2A((1 2) (3 4))` by `#2A((5 6) (7 8))`, then call `MATH:LIST-2D-ARRAY` | `((19 22) (43 50))` |
| Return determinant of `#2A((1 2) (3 4))`, `RATIONAL` of short float `0.5`, and `RATIONALIZE` of short float `0.1` | `(-2 1\2 1\10)`; this printer uses backslash as the ratio separator |
| Multiply vector `#(1 2)` by `#2A((3 4) (5 6))` and inspect both result elements | `(13 16)` |
| Parse `1+2*3` with `SI:INFIX-TEST` | Without a terminator the parser reached end of input and entered the error handler; appending an actual Altmode character returned `(+ 1 (* 2 3))` |

The session ran from 2026-07-18 08:02:20 to 08:11:22 EDT. The base and private
disk hash was
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`
at start and stop. The System source copy was Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`
with tree hash
`21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`;
it did not change. Both `usim_sha256_at_start` and `usim_sha256_at_exec` were
`707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be`.
The simulator exited zero without a forced stop, and
`state_may_be_incomplete` is false.

The selected window was `LOCAL-CADR [running]`, X window `2097202`, at 768×963
on display `:90`. Current public revisions at start were `system`
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
`usim` `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`,
`l` `d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6`,
`chaos` `db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e`,
and `usite` `8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`.
The private copy-time revisions for `system`, `chaos`, and `usite` matched those
values. Their tree hashes were respectively
`21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`,
`34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87`,
and `adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81`;
none changed after copying.

Private machine-artifact hashes at start were `promh.mcr`
`2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6`,
`promh.sym` `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d`,
and `ucadr.sym` `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a`.
The reproducible toolchain used Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`,
manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`,
Python 3.11.14, Xorg Server 21.1.21, ImageMagick 6.9.13-5, and xdotool
3.20211022.1. Final `run.json` SHA-256 was
`b191e52b8b730e80f73fcb383fcf79d2c34f904cdefcb122f66b90874bd281b8`;
the cleanly stopped simulator state was
`f7ae340093e34cf6258842238fc3a25dd98bf672b4a358f34bd3e7bfa51e9a84`.

### Genera 8.5

The fresh session `d27-math-genera-20260718`, generation 1, ran the licensed
`Genera-8-5.vlod` through the repository's isolated Genera harness. It confirmed
matrix multiplication, Common Lisp rational conversion, Genera's column-vector
orientation, and presence of `SI:INFIX-READ`. It also exposed a serious conflict:

| Input intent | Observed result |
| --- | --- |
| Multiply the same two 2×2 matrices | `((19 22) (43 50))` |
| `CL:RATIONAL 0.5` and `CL:RATIONALIZE 0.1` | `1/2` and `1/10` |
| Matrix times `#(1 2)` | `#(11 17)` |
| `#(1 2)` times the same 2×2 matrix | Incompatible-matrices error, matching the source's `N×1` interpretation |
| Determinant of `#2A((1 2) (3 4))` | `0`, although the mathematical result and System 303 result are `-2` |
| `MATH:DECOMPOSE` of that nonsingular matrix | `SINGULAR-MATRIX` |
| `SYS:RATIONAL-QUOTIENT 1 4`, `CL:/ 1 4`, and inversion of diagonal matrix `#2A((2 0) (0 2))` | `0`, `0`, and `((0 0) (0 0))` respectively |
| Directly call `SI:INFIX-READ` on a host-constructed string ending in `#\ALTMODE` | The character arrived as Escape rather than the parser's raw Lisp-machine terminator and entered the error handler; no parse result is claimed |
| Run `SI:TEST-INFIX-READER`, then rerun with `*PACKAGE*` bound to `SI` | The fixture ran; the package binding removed some expected/actual symbol mismatches, while division-symbol and escaped-symbol mismatches remained |

The last three results are **not documented Genera semantics**. The licensed source
links `CL:/` to rational quotient, implements Common Lisp `/` through exact rational
division, and uses that operation in decomposition and inversion; the manuals define
ratios as exact. `CL:RATIONAL` and `CL:RATIONALIZE` also behaved correctly in the
same run. The evidence therefore establishes a reproducible defect or incompatibility
in this exact world/VLM execution path, not that Genera normally truncates Common
Lisp division. It remains open whether the cause lies in the world build, public VLM
arithmetic-op implementation, invocation context, or another compatibility boundary.

The action log preserves all 18 input intents and their linked dispatch outcomes in
order. The research sequence was: the combined product/determinant/conversion form;
the determinant alone; decomposition with both returned values; `Control-Z` from the
resulting debugger; simple rational-quotient arities; the quotient/division/inverse
form; vector-first multiplication; `Control-Z` from its incompatibility error;
matrix-first multiplication plus `FBOUNDP`; the direct string/Altmode parser attempt;
`Control-Z`; the self-test in the Listener package and then in `SI`; a function-link
identity probe that included the problematic literal `ZL://` reader spelling;
`Control-Z`; two narrower identity-probe retries separated by the literal
`KP_Subtract` key. The last three
function-identity probes never yielded a trustworthy Lisp value and support no claim
in this article. This distinction is why the source link declaration, rather than a
runtime identity result, grounds the `CL:/` linkage statement.

The Genera session ran from 08:12:04 to 08:21:43 EDT in separate user, mount,
network, PID, IPC, and hostname namespaces. It had no external or default route and
no guest-visible host file service. The archive was 206,213,430 bytes with SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`;
the 54,804,480-byte base and private world hash was
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`
at start and stop. The VLM hash was
`9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`,
and the action log contains 36 linked intent/outcome records with SHA-256
`c7fc6bad3bb717c0b745375a9b838f190c0ca2a7b208f68885af5bbe06639547`.
Both exact X-protocol substitutions and the supervised RFC 868 request/reply were
observed before the harness reported the system running.

The selected main window was `Genera on DIS-LOCAL-HOST`, X window `4194310`,
at 1200×900 and host-display position `(72,55)` on display `:200`. In addition to
the world and VLM hashes above, the debugger hash was
`2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`,
the exact-command `ifconfig` preload was
`f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`,
the X compatibility preload was
`acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`,
the RFC 868 responder was
`cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`,
and configuration was
`5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`.
Xvfb did not advertise MIT-SHM. The responder evidence hash was
`290773368004b41628d3cede011ad5066e850f10eae3df2c19857855f59c36bc`,
its completion record was
`4318628ff9f26622e10dacc316aa1b4c418418408b9a4a3c1e48274820395da8`,
and the responder exited zero.

Tracked harness-source hashes were: entry point
`e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05`,
Python harness
`bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`,
namespace helper
`17a3e297930eef45a6f59a349f92ec1f6dc99b2c4d5caa2392dc0521636af01c`,
VLM helper
`cbf9ee0520b4892325266ed17afba8f1b663e7d266fea6d80de9cf98de17d2f8`,
`ifconfig` interposer source
`a4d126dbb6fd6f4903835bbb41c39652cfc53c91e942267dc9166c1c938c36e7`,
and X interposer source
`4db1dee8e71d5ddc5cfd8289ecc3607738370ac97f856853786cfe713e94e392`.
The toolchain used the same Guix channel and manifest recorded for CADR, with
Python 3.11.14, Bubblewrap 0.11.0, Xorg Server 21.1.21, GCC 15.2.0,
ImageMagick 6.9.13-5, and xdotool 3.20211022.1. Final `run.json` SHA-256 was
`4d04c2d06bc4c701a2782e366b4bfaa517da7bf7c1f04a677dbdc9ac8ced5975`.

The private world did not change. The harness did not invoke Save World or create a
host process checkpoint; `save_world_performed` and `guest_checkpoint_created`
remain unknown rather than inferred. On shutdown the VLM accepted confirmation and
began cleanup, then reached the already documented Cold Load mutex stall and required
bounded `SIGKILL`. Accordingly `forced_stop` and `state_may_be_incomplete` are true,
`orderly_vlm_host_shutdown` is false, and only unsaved Lisp state was discarded.

## Screenshot and publication status

No screenshot is published with this dossier. `MATH`, numeric functions, and the
infix parser have no dedicated visible application state: the runtime evidence is a
generic Listener containing the exact textual inputs and results already transcribed
above. Representative raw research captures are nevertheless hash-identified:

| Session and raw capture | Dimensions | PNG SHA-256 | Pixel SHA-256 | Evidentiary state |
| --- | --- | --- | --- | --- |
| System 303 generation 1, `0004-matrix-product.png` | 768×963 | `4129298dd58413d56a709ff4638ad86545e61ffb8a2328aa51f8fff1db5fcc4b` | `a98059bd927322c51f2dfc43c431fa6bd3dbead0b71d3697014961daff92a906` | Matrix product |
| System 303 generation 1, `0005-determinant-rationals.png` | 768×963 | `3f5a8277cb832243f7700b5e42ede0b75088915b13a2e96a2bf6ed036f8918fb` | `24fab3ed7fc232468bc78e99ec596034ed77ab5fcca12c12110bc58ffe0c7243` | Determinant and rational conversion |
| System 303 generation 1, `0007-vector-matrix-elements.png` | 768×963 | `7dc9f7be0ad1018ade6d5450c10b05fcda498328cd6ec09db61e803af42afdd4` | `283c0a1f621ac08bb800c27bb9f54f700e7e6de868088171f9a816b0c2904a8d` | Row-vector multiplication |
| System 303 generation 1, `0009-infix-parse-terminated.png` | 768×963 | `6d5b2d86d9fec67adddc22daf759cc8799eb78ab32022becf39cf2bd2fae3ab2` | `87fabf277516994d008e57bbfd8b6f64c5bc8dab1a1e7428e47458f5c6a2d95f` | Correctly terminated infix parse |
| Genera generation 1, `0002-matrix-and-rationals.png` | 1200×900 | `00a2d533eb5064cefb950f478bc336de85dc09669e1ef60677d17348efea31fe` | `ace4798dd80e1d11bd6caf291c67b0b735cd043e643cbe0754071d8d02572180` | Matrix product, anomalous determinant, and conversions |
| Genera generation 1, `0006-quotient-and-inverse.png` | 1200×900 | `9ef5a56323bb966ba6ad7e209c23fa4020e3c5d0532a5757d72b08a0a91fc0f3` | `965951181b462d983ca8630a188783ee44ed75f8e4db9dc29cb9c28d1bd56522` | Direct quotient and inverse anomaly |
| Genera generation 1, `0008-column-vector-and-infix-presence.png` | 1200×900 | `30d34fa9818a0b3ed90835c02bd6c1defdb737cbb627c5ab3c97b47432251cef` | `8566f1e59959c34c53e559689c36d0ae7f6b83058098565e37546501582d7924` | Column-vector result and loaded infix reader |
| Genera generation 1, `0010-infix-self-test.png` | 1200×900 | `6b2631a446a8d625f7bacdcd95d70519621b824c6a90211af5ae5f8875576ffa` | `126db34c2d6bfa8e6e565d1d624aeb73bb9168da0116b9f31ecfebf183ddc541` | Package-sensitive self-test output |

The CADR sidecars record the start-time `usim` hash; the separately recorded
execution-time hash above is joined from `run.json`, not attributed to the sidecars.
All raw captures and sidecars remain in the ignored session trees. No candidate image
was selected for publication, so no image-specific fair-use determination was made
and no licensed screenshot entered the tracked documentation. This is an
API/infrastructure dossier, not an undocumented visible application whose interface
has been described without operating it.

## Artifact provenance

### Public source files

| Boundary and file | Bytes | SHA-256 |
| --- | ---: | --- |
| System 46 `lispm2/matrix.2` | 12,554 | `8868c6059a306306ae1ed518f312deb456820ce0173f6cc1fcfc9fcf31cf35dd` |
| System 46 `lmman/math.3` | 4,071 | `95a12edc7257a6ddf3e2e42c3159ab1ee593186bffe14d01ad241781340760c0` |
| System 46 `lispm2/numer.23` | 6,156 | `faaf0ee3f43e3678b3d662bde65d44fab37b9896e487b1507e7d104488b0fcef` |
| System 303 `sys2/matrix.lisp` | 16,857 | `9f5a93b84d844e2e153b53284add1826203c088d3a1ea5cae9f7f9c548e17cb5` |
| System 303 `sys2/numdef.lisp` | 8,656 | `bca4df798be7604e76a1dd3067a1733ef1e1e13c12fb35c70fdf71aa3c5c5105` |
| System 303 `sys2/rat.lisp` | 12,764 | `65ace13307592ad7ab8e8eb8d47b8709252dab5e4c2f02ac6a21edf985ca504b` |
| System 303 `sys2/numer.lisp` | 31,189 | `0ba436c8c4d21a9d0caebdde7df3f8205c1f9e62429b32ee8ac54a3164b3eee7` |
| System 303 `io1/infix.lisp` | 15,912 | `1210376edb7cfc70d98fb30f6cd7a2f505880e2223b82ff7dfc6f00c09bc050f` |
| System 303 array manual source | — | `e7e2ce62fb10115916044bdbf0d61a09a0234642b94bd6d59ab2ee8abaa845c9` |
| System 303 numeric manual source | — | `7e96ed8e970408178242365e5d712755a6d1df9535dc0359c56b63dc2b2e28a1` |
| System 303 reader/printer manual source | — | `da553b50097be0be805dd5f7fb371d70d6c0bf86ed54b2e7e6fa69296ffe8e39` |

### Licensed Genera evidence

The following hashes identify local inputs without reproducing them:

| Portable archive-relative source | Bytes | SHA-256 |
| --- | ---: | --- |
| `sys.sct/sys2/matrix.lisp.~4014~` | 18,668 | `f103a669a909b6a2c4b6cc8df5f6a614c40f6e77d77c2e7e9f27fd4aea3c7bd6` |
| `sys.sct/sys2/rat.lisp.~94~` | 23,964 | `88af4a01b5e195bb910b8ad1110232639897e3f8ef421d9ec5a53288843a2bef` |
| `sys.sct/sys2/numer.lisp.~117~` | 30,897 | `78426813e5d5dca0916f5f6c6c11bb67fc6824f3b59bf589b5e4f00490027085` |
| `sys.sct/sys2/lnumer-defs.lisp.~35~` | 20,071 | `afa994b93c01cfd2f769c8436d50d928c8151534e8aacfbc68169e63b822ee7a` |
| `sys.sct/sys2/lnumer.lisp.~147~` | 85,831 | `d850adb9c66255eda40549576bc1db38e709f2c2c3acc81f7e1a2488448604c6` |
| `sys.sct/clcp/permanent-links.lisp.~67~` | 7,955 | `d4f7ccc0e0b17f0014df54d8b46158f34ed5923934365ae5d2f025c31db106e1` |
| `sys.sct/clcp/functions.lisp.~322~` | 57,422 | `a01a9c5032ed1abfc2839f2b1ac5d2788fd4e19e76af31b173b5a15a6f4e72fa` |
| `sys.sct/io1/infix.lisp.~36~` | 23,730 | `42bce9b97f6a3f5287f19cb2c8a731530cc0980cf29f8f9c2af8517274fa9e37` |

The installed Help source artifacts used for cross-checking were the array chapter
(`76a25fea7a5dabe863128518b1b4d263fc2618fe3294fe9b2ea8f1d19a007154`),
condition chapter
(`0df549ca1d2c3518c62111e5620c7dbc12da610424b6192ce4d1df4f11730550`),
numeric short forms
(`77ee6d5e1e378ce873b84acddacd09d29221b0c37e0086f7206da72dee7a59b5`),
numeric types
(`4e41f0abcc75396c485a4dc909c3f81559109515cdeb361aa99cbf4c2ee38dcc`),
and the no-prefix numeric dictionary index
(`eeaebd5a682eb37c1b95e4e2bcfa366e64c3b2dfec96df72b27d5d425f67d68d`).
These are source-payload hashes from the inert extractor metadata, not hashes of
tracked recovered prose.

## Preservation and rights

The System 46 source and exact revision are public, and the maintained LM-3 Fossil
links below expose the public restoration source used for comparison. The Genera
source, VLOD, decoded Help, action logs, and raw screenshots remain ignored local
inputs. This article records interfaces, algorithms, discrepancies, short function
names, and hashes in original prose; it does not distribute licensed source or Help
text.

The runtime arithmetic anomaly makes retaining the exact world, VLM, action log,
and shutdown evidence particularly important. A future VLM or world build must be
tested as a separate evidence boundary rather than silently replacing this result.

## Open questions

- Why does this exact Genera 8.5 world/public-VLM combination truncate
  `SYS:RATIONAL-QUOTIENT 1 4` and `CL:/ 1 4`, contrary to source, manual, and other
  rational behavior? The defect should be reduced below `MATH` before matrix
  determinant or inversion is used as a VLM conformance test.
- Was Genera's return to uniform `N×1` vector semantics an intentional compatibility
  decision, a performance-oriented rewrite consequence, or an accidental regression
  from System 303? The inspected source establishes behavior but not rationale.
- The System 303 infix source's code-006 membership character is preserved by code
  value. Its authoritative historical glyph/name remains `TODO`; this article does
  not guess from a modern encoding.
- The Genera infix self-test should be rerun in its intended package and readtable
  initialization context before treating fixture mismatches as parser defects.
- Iterative improvement is explicitly unfinished in all inspected matrix lineages.
  No separate implementation was found in the bounded releases.

## Primary sources

- MIT System 46, pinned [`MATRIX.2`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/matrix.2),
  [`MATH.3`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/math.3), and
  [`NUMER.23`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/numer.23).
- MIT, [*Lisp Machine Manual*, third edition](https://bitsavers.org/pdf/mit/cadr/chinual_3rdEd_Mar81.pdf).
- LM-3 maintained System 303, pinned [`matrix.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/matrix.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`numdef.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/numdef.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`rat.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/rat.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`numer.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/numer.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [`infix.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/infix.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).
- LM-3 maintained System 303, pinned [array manual source](https://tumbleweed.nu/r/lm-3/file/l/sys/man/fd-arr.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [numeric manual source](https://tumbleweed.nu/r/lm-3/file/l/sys/man/fd-num.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [reader/printer manual source](https://tumbleweed.nu/r/lm-3/file/l/sys/man/rdprt.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).
- Symbolics, [*Symbolics Common Lisp: Language Concepts*](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Common_Lisp_Language_Concepts.pdf).
- Symbolics, [*Genera 8.0 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.0_Release_Notes.pdf).

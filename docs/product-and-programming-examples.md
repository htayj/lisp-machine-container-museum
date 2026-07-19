---
type: Historical Article
title: Product and programming examples in Genera
description: A source-, manual-, catalog-, and runtime-grounded guide to the core Genera, Joshua, Statice, Color, and CL-HTTP example programs in the inspected Open Genera media.
tags: [lisp-machine, genera, examples, dynamic-windows, joshua, jericho, statice, color, cl-http]
timestamp: 2026-07-18T13:09:46-04:00
---

# Product and programming examples in Genera

The inspected Open Genera media contains a rich programming museum inside the
product tree: small Dynamic Windows frames, staged tutorials, rule-system
demonstrations, database case studies, graphics and hardware tests, Web examples,
benchmarks, and site-configuration templates. They are not forty-nine additional
commercial products merely because some use `DEFINE-PROGRAM-FRAMEWORK`. This page
documents what each example is for, how a user or programmer operates it, what it
actually exercises, and what remains unverified at run time.

The most important boundary is availability. The source is present in the purchased
media, but the fresh Genera 8.5 world used by this museum does not have Joshua,
Statice, or CL-HTTP ready to use, and it has no registered Color screen on which
Color Demo has been shown to run. The core `examples` system is itself a
source-distribution declaration rather than a compiled installable product. Source
analysis therefore establishes the interfaces below; it does not establish that the
frames successfully run in this exact Open Genera/VLM configuration. Representative
runtime captures remain TODOs, not descriptions filled in from memory.

## Scope and classification

This dossier uses five labels consistently:

| Label | Meaning here |
| --- | --- |
| **Application example** | A sustained interactive frame, browser endpoint, or other user-facing sample that demonstrates application construction. It is still an example, not a separately marketed product. |
| **Tutorial** | Source or an interactive lesson whose principal purpose is to teach an API, language, or progression of designs. |
| **Test or benchmark** | A correctness, performance, display, or hardware exercise. A visually elaborate test is not automatically an end-user application. |
| **Support or operational sample** | Reusable substrate, configuration, server, persistence, or site-initialization code. Some such files are unsafe to run unchanged. |
| **Optional or missing at run time** | Source exists in the media, but a required product, service, device, database, client, or control artifact is absent from the fresh world or has not been connected safely. |

“Complete” has a bounded meaning. This page accounts for every file in the five
example collections named by the pinned software catalog; gives a separate section
to each of the fourteen concrete example program frameworks; inventories each
framework's own panes, commands, fixed keys, and presentation gestures; and accounts
for the Color Demo and CL-HTTP selectors at their native registry/export grain. It
does not turn every helper function into a fictitious command, repeat every inherited
Joshua or Dynamic Windows command, or reproduce licensed source and example data.
The owning product dossiers provide the inherited interfaces:

- [Dynamic Windows and presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md);
- [Joshua and Jericho](joshua-rule-and-inference-environment.md);
- [Statice](statice-persistent-object-and-database-environment.md);
- [Color systems and the Color Editor](color-systems-and-color-editor.md); and
- [CL-HTTP and contributed Web systems](cl-http-and-contributed-web-systems.md).

## Evidence, release, and rights boundary

The audit used the byte-exact, highest evacuated revisions under the licensed
`sys.sct` tree. The purchased archive is 206,213,430 bytes with SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
The extracted `sys.sct` tree inspected locally contains 5,075 files totaling
174,490,231 bytes. Those licensed files remain untracked.

The starting denominator is the pinned
[Genera software-area and application census](genera/software-areas-and-applications.md),
then checked again against the five source collections rather than copied from its
summary prose. The catalog's principal registry carrier,
`sct/system-info.lisp.~206~`, is 85,747 bytes with SHA-256
`8f3196dbadb0c6eb77c35e148aa8618fd05a6cd36b2e68bbe671c0dcd4f95607`.
The framework list was independently recovered from defining forms so a product
registry omission could not erase a source example.

For each collection, the manifest hash below was made by sorting relative pathnames
bytewise, recording `relative-path`, byte count, and SHA-256 for every regular file,
then hashing the resulting lines. It anchors both the denominator and the exact
media state without publishing the payload.

| Portable collection root below `sys.sct/` | Files | Bytes | Manifest SHA-256 | Character of collection |
| --- | ---: | ---: | --- | --- |
| `examples/` | 21 | 241,137 | `5739fc2d7d5a514c820d7442749ef7417d2f8d546b4cada957a8be0bc3473bff` | core source-distribution examples |
| `joshua/examples/` | 31 | 1,339,128 | `a882f302db33985b78b7488ad4cb2a53ef567dd40fdfd3f2ca6bbd2fc785d475` | Jericho sources plus compiled forms |
| `statice/examples/` | 8 | 87,530 | `6300900fda88836f77ad4168ab2886057436b15ecef2fbe9c5eb10bf3e6b07ec` | source examples loaded by the development system |
| `color/demo/` | 18 | 445,086 | `742ec9fdf0cdd454fbeb67e925f3387675a8f882d7997faea0f6e7ee1a36a936` | nine sources and nine compiled forms |
| `contributed/cl-http/examples/` | 47 | 975,573 | `3ee3266f5c7bc08a21718ac110fa3d54b70e59830574a46d3f268b4d1c9ff32a` | Lisp examples, browser/client artifacts, and nested period formats |

The core and Joshua example headers include a customer-incorporation notice in many
files. That historical notice is evidence about those exact files, not a basis for
redistributing the rest of the licensed media. Statice, Color, and the local CL-HTTP
contribution carry their own notices and provenance. This article publishes only
names, short control labels, hashes, and original analysis. It does not copy source
bodies, compiled forms, tutorial prose, pictures, fonts, Web assets, or example data.

Manuals establish intended programming models and documented workflows. Source
establishes the exact frames, defaults, controls, side effects, unfinished paths, and
several discrepancies the manuals do not expose. Existing isolated sessions establish
only base-world load state. These evidence classes are kept separate throughout.

## Core Genera examples

`examples/sysdcl.lisp` defines `examples` solely “for distribution.” It requests
source distribution and rejects binary distribution. Its main teaching module uses
`:LISP-EXAMPLE`; an additional ordinary-Lisp benchmark module names Gabriel and
Server Finger, with Server Finger also present in the teaching module. The media has
no matching `examples.system-dir` record.
Consequently **Load System Examples** is not established as an operator workflow;
the intended use is to inspect, compile, or evaluate selected examples in a suitable
development environment.

The 21-file denominator is 17 example Lisp files, their `sysdcl`, and three text
files used by the File Server and Teach Zmacs examples. This matters for safety as
well as cataloging. The directory mixes harmless local
calculators with printer output, FEP audio, global Zmacs key changes, background
network services, and an example file-server initialization. Loading the directory
as one undifferentiated demo bundle would be the wrong preservation experiment.

### `avv-pane-test`

**Classification:** application example for an explicit Accepting Values pane.

The framework's pretty name is **Test**, while its visible title pane reads **Test
Frame**; its direct Select key is `A`. It also has an Accepting Values pane labeled
**AVV Should Be Here**, a display, and a Listener.
The pane edits three frame state variables directly:

| Field | Presentation | Initial source value |
| --- | --- | --- |
| Half Life | integer | 2,400 |
| Log File | pathname | `local:>log.file` |
| Start time | universal time | 1986-08-01 00:00:00 |

Its only application command, **Show State**, prints the three current values. The
command table also inherits full colon commands, standard arguments and scrolling,
and the Accepting Values pane commands; it defines no single-character command
accelerators.

Source-only finding: the later `accept-two` definition in the same file also claims
Select `A`. The effective registration after evaluating the complete file is a
runtime question; this page does not promise that Select `A` will reach
`avv-pane-test` in a combined load.

### `accept-two`

**Classification:** application example for the default program-state Accepting
Values handler.

The frame exposes three editable single-float state variables—**First month** 200.0,
**Second month** 50.0, and **Third month** 100.0—in a generated Accepting Values
pane. A title, ordinary display, and four-line interactor complete the layout. Its
only application command, **Summarize Data**, prints the quarterly sum and mean.
Unlike `avv-pane-test`, this example demonstrates that prompt, type, and initial value
metadata on state variables are sufficient for the standard pane handler.

It also declares Select `A`. Its command table inherits the colon full command,
standard arguments, input editor compatibility, and Accepting Values pane command
tables; it has no fixed command accelerators of its own. The duplicate Select
registration is the same unresolved combined-load issue noted above.

### `calculator`

**Classification:** application example and advanced Dynamic Windows programming
tutorial.

The calculator deliberately has no ordinary command-menu pane. A display pane is
painted as a four-by-four keypad, and each displayed oval is installed as a command
presentation. The value pane shows the current floating-point number. Select `+`
opens the frame.

| Row | Visible controls |
| --- | --- |
| 1 | `7`, `8`, `9`, `+` |
| 2 | `4`, `5`, `6`, `-` |
| 3 | `1`, `2`, `3`, `*` |
| 4 | `Enter`, `0`, `.`, `/` |

Every digit and arithmetic operator works both as a one-key accelerator and as a
left-selected displayed key. `.` enters the fractional state. Return or the
**Enter** oval pushes the displayed value. An arithmetic operator pops the previous
value, using 0.0 if the stack is empty, applies the selected Common Lisp function to
that value and the current display, and begins a new entry. The state machine
distinguishes a new value that should push the old display, a post-Enter value that
must not push it again, continued integer entry, and a numeric fractional-place
multiplier.

There is no clear, backspace, sign-change, memory, precedence, or error-recovery
control in this example. Operations are immediate stack operations, not an infix
expression evaluator. The source explicitly calls the custom command-menu handler
support advanced and undocumented; this is an implementation teaching sample, not a
finished desk calculator.

### `employee-editor`

**Classification:** application example tied to the **User Interface Application
Example** chapter of *Programming the User Interface*.

Select `*` opens a four-pane frame: title, employee display, command menu, and a
four-line interactor. Loading the file creates two sample employee Flavor instances
and adds them to a global list. The frame itself has no inherited command tables and
no fixed accelerators.

| Control | Effect |
| --- | --- |
| **Show Employees** | Prints a table of employee name and retired status. |
| **Change Status** | Accepts an employee with confirmation and toggles the retired flag. |
| Select an employee in a string input context | Translates the employee presentation to the person's name string. |
| Middle-click an unretired employee | Directly marks that employee retired. It cannot directly unretire a person. |
| Default employee-to-command translation | Builds **Change Status** for the selected employee; the source does not specify a physical gesture, so this page does not invent one. |

The direct middle-button action is intentionally contrasted with the command-based
translator. The source calls the direct mutation dangerous because it bypasses the
program command loop. That makes the file a compact lesson in why presentation
actions and presentation-to-command translators are not behaviorally equivalent.

### `life`

**Classification:** final application-example stage of a four-file Common Lisp Life
tutorial.

Select Square opens a **Life** title, graphics display, and ten-line Listener. The
frame owns a nominal 30-cell-axis board and next-generation board. Live cells are
drawn as 5-by-5 filled rectangles. The update implements the familiar Life rule:
birth with three neighbors and survival with two or three.

| Command | Argument and effect |
| --- | --- |
| **Initialize** | Randomizes the board and draws it. |
| **Step** | Number of generations, integer at least 1, default 1; advances and redraws. |

There is no application-specific cell-click gesture or run-until-stopped control.
The frame inherits colon commands, standard arguments, and input-editor compatibility
but defines no single-key command accelerators.

The complete staged lesson is important context:

1. `common-lisp-life` supplies global arrays and text-oriented functions;
2. `common-lisp-life-with-graphics` replaces the display with raster rectangles;
3. `common-lisp-life-with-commands` adds the global **Play Life** command, defaulting
   to three generations; and
4. `common-lisp-life-with-program-framework` encapsulates board state and UI in the
   `life` frame, with **Step** defaulting to one generation.

Those are successive source lessons, not four independent Life products.

### Accepting Values function examples

**Classification:** three callable tutorials, not program frames.

`accepting-values.lisp` supplies:

- `CHOOSE-DISPLAY-METHOD`, whose **Redisplay method** choice is None, String, or
  Function and whose second field appears conditionally;
- `READ-ROWS-OF-NUMBERS`, which maintains a dynamically growing list of integer
  sequences and always offers one additional row; and
- `EIGHT-PUZZLE`, which displays a 3-by-3 array and makes only numbered cells
  adjacent to the blank into Accepting Values command buttons. Selecting one moves
  it toward the blank, with mouse documentation saying Up, Down, Left, or Right.

`EIGHT-PUZZLE` returns the resulting array but contains no solved-state detector,
move counter, reset command, or victory display. It demonstrates command buttons and
redisplay, not a completed puzzle game.

### Audio examples (`audio-examples`)

**Classification:** callable hardware tutorials and performance tests.

`SINE-WAVE`, `SAW-WAVE`, and `SQUARE-WAVE` accept a frequency, program the audio
facility, and continue until any character is typed. `%BEEP-IGNORING-MOST-ISSUES`
accepts frequency and duration; its name and comments explicitly warn that it omits
conditions required of a production beep implementation. `PLAY-AUDIO-SAMPLE-ARRAY`
wires and plays a bounded sample array. `PLAY-DISK-FILE` uses eight tuned, 40-page
buffers and direct FEP disk DMA because its comments say ordinary LMFS overhead is
too high for the required sample rate. `POLYPHONIC-MUSE` accepts one through six
voices, defaults to four, and produces a random diatonic walk until keyboard input.

These require Genera audio microcode/facilities, suitable hardware emulation, and—for
disk playback—a compatible FEP file. No such path is established in the Open Genera
harness. They must not be described as silent pure-Lisp demonstrations.

### Constraint-frame language stages

**Classification:** window-layout tests and tutorial source.

`constraint-frame-language1`, `constraint-frame-language2`, and
`constraint-frame-language3` build progressively more elaborate TV constraint
frames rather than Dynamic Windows program frameworks. Stage 1 defines several
configurations, including configurations explicitly named or commented as buggy, and
instructs the programmer to call `TEST` from a small Listener. Stage 2 focuses the
pane and constraint arrangement. Stage 3 calls `TEST-MENU` and compares menu sizing
with short and long item sets. The user operates the generated menus with ordinary
TV menu selection; no example-specific keybinding is defined.

These files are valuable regression fixtures for constraint calculation. Their
intentionally problematic configurations must not be normalized into a claim that
every layout is a supported application design.

### Flavor Life

**Classification:** object-system tutorial.

`flavor-life.lisp` reimplements Life to demonstrate `DEFFLAVOR`, generic functions,
methods, component Flavors, `:AND` method combination, message sending, and arrays.
`PLAY-LIFE-GAME` accepts an optional generation count whose source default is 10.
It creates/selects a **Game of Life** window, builds a random board, animates the
requested generations, waits briefly, and buries the window. There is no command
menu or in-game mouse editing. The source explicitly values clarity about Flavors
over Life performance.

### Gabriel benchmark suite (`gabriel-benchmarks`)

**Classification:** performance benchmark, not a visible application.

The Common Lisp translation identifies itself as the Richard Gabriel suite used to
produce Symbolics benchmark values. `RUN-SERIES` writes implementation information
and results to a stream; `RUN-SERIES-TO-FILE` targets the FEP file system to avoid
network disruption while scheduling is inhibited. The file includes the classic
Tak/Stak/Ctak/Takl/Takr, Boyer, Browse, destructive-list, Traverse, Deriv/DDeriv,
Div2, FFT, Puzzle, Triang, file/terminal I/O, and polynomial families. Its suite
runner excludes the I/O benchmarks from the normal series.

Unlike the collection-wide rights assumptions one might otherwise infer, this exact
benchmark source explicitly identifies itself as public domain. That statement is
specific to this file and does not propagate to neighboring examples.

Performance results would be properties of the exact VLM, world, scheduler, host,
and timing path. The presence of the source is not a benchmark result, and this
museum has not published one.

### Hardcopy font catalog (`hardcopy-stream-example`)

**Classification:** printer-output tutorial.

`FONT-CATALOG-PAGE` accepts a font and optional printer, creates a hardcopy stream,
and prints catalog pages that alternate characters 32 through 126 between `FIX9` and
the chosen font, with boxes and headings. Its observable result is printer output,
not a screen font sheet. Running it can queue or produce physical output, so a future
test needs a disposable file-backed or otherwise non-destructive printer target. See
[hardcopy, press, printing, and plot output](hardcopy-press-printing-and-plot-output.md).

### Incremental-redisplay tests

**Classification:** interactive redisplay tests.

`REDISPLAY-TEST-1` performs three redisplays, pausing for one character before each
mutation, and returns the redisplayer. `REDISPLAY-TEST-2` and `2A` share a helper
that performs four redisplays separated by characters; they contrast ordinary
redisplayable output with independently redisplayable formatting. The tests mutate
global symbols and the global list `*L*`. Their controls are simply “type one
character to advance,” not a command table.

### File-server initialization example

**Classification:** operational/site template; unsafe to run unchanged.

`file-server-init-file.text` is a historical initialization sample, not an inert
tutorial page. It configures and secures file, print, and download services; tunes
virtual-memory and buffer state; establishes automatic bug reporting; and contains
site-specific assumptions and names. Evaluating a translated copy can start services,
alter access policy, and persist machine state. Its value is as an example of site
operations, and any live study requires a line-by-line side-effect review in an
isolated disposable world.

### Server Finger

**Classification:** substantial network/service sample.

`server-finger.lisp` scans configured namespaces and Lisp Machines, caches user,
idle, location, and last-seen information, can maintain a local disk copy, schedules
background refreshes, augments the name-server path, and defines a `:SITE-NAMES`
byte-stream server. Its user query paths include individual names and Busy, Idle, and
All-style summaries. The default background refresh interval in the source is ten
minutes, while a later initialization path starts with fifteen minutes.

This file changes global network service behavior and can start processes and write
its database. It is not the same as the smaller Statice `finger-hack` example below,
and it must never be loaded merely to see what it does on a museum network.

### Teach Zmacs

**Classification:** interactive editor tutorial plus global keymap extension.

The global **Teach Zmacs** command copies the master tutorial to
`teach-zmacs-copy.text` in the user's home directory and opens the copy in Zmacs. If
a matching copy is already being edited, it asks whether to continue. Loading the
source also installs Triangle as “next section” and Square as “previous section” in
the global Zmacs command table. Those macros search for section separators and
recenter the buffer.

The load-time global key mutation and user-file copy are real side effects. The
collection stores the implementation, short information text, and master lesson as
`teach-zmacs.lisp`, `teach-zmacs-info.text`, and `teach-zmacs-master.text`.
The tutorial text is licensed documentation and remains untracked; its recovery
evidence is discussed in
[Genera on-line documentation recovery](genera/online-help-and-documentation-recovery.md).

## Joshua and Jericho examples

Jericho is the optional Joshua demonstration and test system. The 31-file collection
contains 16 top-level source files, 12 corresponding compiled files, and three patch
or system-directory records. Its declaration loads
the shared demo substrate, a chess font, rule and object examples, the seven-demo
suite frame, automated tests, and benchmarks. The individual frames inherit the
`Joshua-Demo-Program` command table, but their own controls are inventoried below.
`widgetsim` additionally names the Global and User tables. `DIAL-DEMO` instead
inherits Global, full colon commands, standard arguments, and input-editor
compatibility with accelerators disabled. Only the suite (`J`) and dial (Circle)
declare direct Select keys; the six embedded subframes are normally reached through
Jericho's chooser.
The fresh base world contained none of the Joshua packages and did not know the
system without attempting a disconnected site-file lookup, so every visible result
in this section is source-established and runtime-TODO.

### `cryptarithmetic`

**Classification:** interactive constraint-solving application example.

The **Cryptarithmetic Solver** frame has panes for letter possibilities, the current
problem and solver status, guesses, search statistics, suggested problems, commands,
and a four-line interactor. Its application commands are:

| Command | Inputs and effect |
| --- | --- |
| **Clear Problem** | Clears Joshua state, cached problem data, guesses, and the principal displays. |
| **Solve Problem** | Accepts `addend + augend = sum`, an optional sequence of letter-to-digit clues, and a Search Boolean; initializes the solver and updates assignments, carries, guesses, backtracks, and solution status. |

Suggested problems are presentations with four intended gestures: left uses clues
and search, middle ignores clues and searches, Shift-left uses clues without search,
and Shift-middle uses neither clues nor search. Left-selecting an ordinary displayed
problem solves it without clues and with search.

Source-only discrepancy: **Solve Problem** explicitly ignores its `do-search`
argument and passes literal true to the solver. The two “without search” gesture
variants therefore build different commands but appear to execute the same search
path. This is a high-confidence source finding and an explicit runtime TODO. The
letter-possibilities pane also repeats its redisplay-function option with two
different values; its effective macro-expanded behavior should be observed rather
than inferred from keyword order.

### `DIAL-DEMO`

**Classification:** minimal Joshua object/attached-action tutorial.

Select Circle opens a semicircular 0-to-100 dial above a fifteen-line Listener. The
frame defines no application commands. The programmer enters ordinary Joshua forms
in the Listener to assert or retract the `speed` slot of one object. An attached
action erases the old pointer and draws the new one as the predication's truth value
changes.

Numeric values outside 0 through 100 are clamped only for drawing; the source does
not claim that the stored Joshua value is rewritten. This example demonstrates the
connection between logical object state and incremental display behavior, not a
general instrument-control application.

### `ht-demo`

**Classification:** interactive expert-system application example.

The **Hardware Troubleshooter** presents the standard five-component “polybox”
circuit: two adders, three multipliers, five input ports, and two output ports. Its
panes show the circuit, solver status, observation/simulation conflicts, reasoning,
commands, title, and interactor.

| Command | Inputs and effect |
| --- | --- |
| **Reset Values** | Clears observed port values, then simulation and diagnosis state. |
| **Reset Simulation** | Clears simulated values and the Joshua database, then resets diagnosis. |
| **Reset Diagnosis** | Marks all components working, clears the diagnosis tick, and resets the reasoning view. |
| **Set Values** | Accepts **Defaults** or one circuit port; a port accepts an integer or None. Defaults install the source's standard seven observations. |
| **Simulate Circuit** | Requests any missing input observations, tells circuit facts, runs rules, computes output values, and displays conflicts. Cached tick values suppress unnecessary reruns. |
| **Diagnose Circuit** | Simulates if needed, retracts working assumptions in turn, traces candidates backward through feeders, and marks working, suspect, or broken component states. |
| **Show Database** | Prints current Joshua predications without backward rules. |
| **Explain Thing** | Explains a selected port, component, or predication in the reasoning pane. Some negative explanations are explicitly unfinished. |

Presentation gestures provide a second control surface: middle explains; left sets a
port or the default set; Shift-left resets values; Shift-middle resets simulation or
diagnosis according to the presentation type; and Control-Shift-left simulates or
diagnoses according to the selected object. Same-gesture pairs are dispatched by
typed presentation testers, not two unconditional commands.

The separate `ht-example-modelled` file implements the polybox with Joshua object
types, LTMS dependencies, and user-level ATMS-style candidate calculation. The frame
source itself says it needs a switch for the modelled version; no such visible switch
is defined. This dossier therefore does not claim that `ht-demo` can toggle between
the two implementations.

### `modelling-tutor`

**Classification:** interactive, stepwise Joshua programming tutorial.

The **Modelling Tutor** frame shows six coordinated technical views: Joshua's database
contents, the example's backing model, an evaluated Lisp session, a forward-trigger
view, and backward variable- and constant-trigger views. A title, command menu, and
four-line interactor complete the layout.

| Command | Effect |
| --- | --- |
| **Clear Displays** | Clears the six tutorial display panes. |
| **Tutor Data Modelling** | Runs a scripted lesson showing how a custom predicate stores, asks, tells, and removes food facts. |
| **Tutor Trigger Modelling** | Accepts Static or Dynamic and walks through the corresponding rule-trigger construction and removal path. |

Each lesson step prints original commentary, optionally prints and evaluates one
form, redisplays the relevant panes, visually grays panes that are temporarily
irrelevant, and waits for one raw character before advancing. The source records a UI
bug: the blinking cursor remains in the interactor rather than the Lisp-display pane
that accepts the character. The tutorials also deliberately undefine rules and clear
the database as they proceed, so their state is not a passive slideshow.

### `blocks-demo`

**Classification:** interactive planning application example.

The **Blocks World** frame shows a graphical block world and robot hand, reasoning
goals, the generated robot program, commands, title, and interactor. It uses a
domain-independent planner that first attempts linear refinement and can fall back to
STRIPS-style replanning.

| Command | Inputs and effect |
| --- | --- |
| **Reset Blocks** | Optional Clear History Boolean, default false; rebuilds the default world and hand and refreshes facts. |
| **Show Database** | Rebuilds world facts and prints stored true/false predications without backward inference. |
| **Put Block** | Selects a top block and another block or Table; an optional command can be joined as a conjunctive goal. The resulting plan is animated. |
| **Clear Block** | Selects a block whose top should be clear; also accepts an optional conjunctive command and animates the plan. |

Left-clicking a displayed block starts a partially filled **Put Block** command;
middle-clicking starts **Clear Block**. Both leave remaining arguments editable. The
demo counts bounded stack-overflow recoveries, reports planning failures, and shows
the actual goal and program rather than merely teleporting blocks.

### `jericho-demo-suite`

**Classification:** umbrella application, test runner, and demo chooser.

Select `J` or the global **Demonstrate Joshua** command opens **Jericho**. Its title
is itself a presentation action that opens a chooser. **Choose Demo** selects one of
seven configurations:

1. Introduction;
2. Factory Simulation;
3. Modelling Tutor;
4. N Queens Solver;
5. Hardware Trouble Shooter;
6. Blocks World Planner; or
7. Cryptarithmetic Solver.

The six application configurations embed the corresponding program frame and run its
own command top level; the introduction has a picture, title, and interactor. Three
local developer commands—**Eval Form**, **Refresh Screen**, and **Clear History**—are
normally secret rather than advertised demo controls. **Eval Form** accepts a
confirmed Lisp form and evaluates it, so it is a debugging escape hatch, not a safe
public feature. Its implementation evaluates the confirmed form and then tries to
print the result to a pane named `demo-interactor`; the Jericho framework instead
defines `interactor`, and no active `demo-interactor` definition appears in the
inspected catalog. Evaluation may therefore occur before result display or command
completion fails. Reaching this command at run time and establishing its exact
failure behavior remain TODOs.

Two additional global controls exercise the registered test layer: **Test Joshua**
selects tests or All, clears between them, and reports pass/fail totals;
**Benchmark Joshua** selects benchmarks or All, defaults to three iterations, and
reports timing plus rule, merge, and matcher activity. `DIAL-DEMO` is not one of the
seven chooser configurations.

### `n-queens`

**Classification:** interactive LTMS constraint/search application example.

The **N Queens** frame has a chessboard, statistics, a scrolling solution list,
commands, title, and interactor. The board defaults to five by five.

| Command | Inputs and effect |
| --- | --- |
| **Set Board Size** | Integer 1 through 8; replaces and redraws the board. |
| **Solve Queens** | Display Board Boolean, default true; Get All Solutions accepts true, false, or Ask, default true. False stops after the first solution; Ask prompts after each; true enumerates all. |

The solver uses Joshua's TMS as search control without application rules, records
solutions and contradictions, and prints standard chess coordinates only for an
eight-by-eight board. It loads a `CHESS15` font for queen glyphs. The board cells are
not defined as application command gestures; board size and solve policy are entered
through commands.

`n-queens-backward` and `n-queens-mixed` are separate source lessons, not this frame.
The former is a Prolog-style backward-rule permutation search and warns about stack
growth; the latter combines Lisp with forward and backward rules.

### `widgetsim`

**Classification:** interactive rule/object simulation application example.

The **Factory Simulator** displays a production model, produced output, a three-by-three
production-time matrix, a two-column command menu, title, and four-line Listener.
Initialization creates three buffers, three factories, and three widget types. The
simulation limit defaults to 20 time steps; new input widgets are random.

| Command | Inputs and effect |
| --- | --- |
| **Set Simulation Time Limit** | Sets the integer stop time. |
| **Initialize** | Clears Joshua state, rebuilds objects/connections/capacities, and completely redisplays. |
| **Refresh** | Forces complete redisplay; it is not advertised in the menu. |
| **Run** | Advances until current time reaches the configured limit. |
| **Do Steps** | Advances the requested integer number of steps. |
| **Change Capacity Value** | Selects a capacity slot and accepts a new expression, then tells the new logical value. |
| **Set Production Matrix Entry** | Secret/non-menu command used by the matrix presentation; prompts for a new numeric value. |
| **Change Production Time** | Menu command accepting a matrix entry and new number. |

The Modify gesture on a displayed production-matrix entry invokes **Set Production
Matrix Entry**. The source identifies a race in the output rule when two items finish
simultaneously. Runtime work should therefore check both the visible matrix editing
and this simultaneous-completion case rather than presenting the simulator as a
validated manufacturing model.

### Other Joshua example modules

The rest of `joshua/examples/` supplies substrate, callable examples, tests, and
alternative algorithms. They are accounted for here so the seven Jericho choices do
not erase the rest of the collection.

| Module | Classification and established purpose | Direct operation or blocker |
| --- | --- | --- |
| `demosthenes` | Support substrate | Defines the shared Joshua demo command table, base frame Flavor, pane redisplay helpers, centering, and bounded stack-overflow helper. It is not a selectable demo. |
| `ht-example-modelled` | Tutorial/alternate hardware-troubleshooting implementation | `DO-POLYBOX` and `DIAGNOSE` exercise Joshua object types, LTMS, conflicts, and user-level candidate sets; `DRAW-POLYBOX` is callable. It is not wired to a visible frame switch. |
| `im-my-own-grampaw` | Backward-rule tutorial | `INITIAL-GRAMPAW` installs the family facts and `FIND-OWN-GRANDPARENT` queries a male or female reflexive grandparent. No frame or command table. |
| `n-queens-backward` | Algorithm tutorial | Query a backward-rule permutation solver; source warns that an eight-queen query can require stack growth. |
| `n-queens-mixed` | Algorithm tutorial | Tell an initial `QUEENS-SOLUTION` and ask for completed solutions using mixed Lisp/forward/backward behavior. |
| `object-modelling-tests` | Automated tests | Registers resistor, molecule, inverter, and related object/path tests with Jericho's test runner; not an application. |
| `planning-examples` before `blocks-demo` | Planner tutorial/benchmark | Contains the general planner and a “ratiocinative simian”/monkey-and-bananas problem callable through benchmark helpers. The Blocks frame is only one client of the planner. |
| `tms-examples` before `n-queens` | TMS tutorials/tests | `MIDSUMMER-WORLD` demonstrates dependency-directed consistency and `TWEETY` demonstrates default reasoning and retraction before the N-Queens UI. |
| `package-definitions` and `jericho-defsystem` | Packaging support | Establish packages, load order, font, source/compiled modules, and dependencies; neither is interactive. |

## Statice examples

`Statice-Examples` is a parallel, source-distributed subsystem of the optional
Statice development system. Seven of its eight files are programming examples; only
`books` defines a program framework. Every database pathname in these samples is a
historical site value, not a portable museum default.

### `books`

**Classification:** interactive persistent-database application example.

Select Page opens **Books**, a simple bookkeeping frame backed by a Statice schema
with accounts, entries, and budget items. Its display switches among account
activity, budget, summary, or **No current account**; a command menu and four-line
interactor complete the frame. It inherits full colon commands, standard arguments,
and standard scrolling, but installs no fixed key accelerators. The source says the
programmer must first create a database and account entities.

| Command | Menu? | Inputs and effect |
| --- | --- | --- |
| **Clear** | no | Clears display history. |
| **Create Account** | no | Name and optional starting balance, default 0.0; creates an account and makes it current. |
| **Show Account** | yes | Selects an account for the display. |
| **Set Range** | yes | Starting date defaults to two months ago; ending date defaults to now. |
| **Add Entry** | yes | Account, amount, description, optional budget item for checking accounts, date, and remarks; creates a transaction entry and running balance. |
| **Compute Late Fee** | yes | Account and date, default the 16th; computes a proposed 1.5-percent value, allows editing it, and creates an entry. |
| **Hardcopy Account** | yes | Account and printer; produces a landscape account report. |
| **Add Budget Item** | no | Description and allocation; creates the entity. |
| **Show Budget** | yes | Selects the budget display. |
| **Hardcopy Budget** | yes | Printer; produces a landscape budget report. |
| **Backup Database** | yes | Pathname; calls the Statice model dumper. |
| **Show Summary** | yes | Selects the account-summary display. |
| **Hardcopy Summary** | yes | Printer; produces a landscape summary report. |

Selecting a displayed entry invokes a direct **Modify Entry** action. An Accepting
Values window edits date, description, optional budget item, amount, balance, and
remarks inside a transaction, then redisplays.

This is intentionally concrete rather than generic. The source hardcodes a historical
database portal, treats a checking account specially, assumes a recurring 185.00
amount for payment calculations, names a special `Checkbook` account in summaries,
and supplies a site-style default backup pathname. Empty accounts can also reach
code that expects a last entry. **Show Summary** tells the user to specify a range
when none is set but then continues into comparisons that use the missing dates; the
top level catches serious errors and retries only a bounded number of times. A
faithful demonstration therefore needs a
researcher-created schema/data fixture and should preserve these historical
assumptions as findings, not silently repair them.

The hardcopy and dump commands produce external artifacts. They must be directed to
disposable targets, and the backing DBFS database must be a rights-clear test store,
not a purchased or historical database.

### Other Statice example files

| File | Classification | What it demonstrates | Runtime and safety boundary |
| --- | --- | --- | --- |
| `bank-example` | Minimal transaction tutorial | Account schema plus create, deposit, transfer, and total functions. The transfer signals after making both mutations, relying on transaction abort to prevent an overdrawn commit. | Historical `leek:` portal; requires a disposable database. |
| `university-example` | Query/schema tutorial | Inheritance among people/students/instructors, relationships, sets, a multiple index, sorted and constrained `FOR-EACH` queries, CLOS methods, fixture creation, and a name-completion presentation type. | `UINIT` creates extensive sample data at a historical portal; no frame. |
| `presentation-type` | UI integration support | Generic completion for entities named by a string attribute, with prefix, apropos, restrictions, quick counts, and common-prefix calculation. | Requires an open Statice database and schema supplied by a client. |
| `extended-types` | Datatype tutorial/test | Handlers for enumerations, strings excluding a character, halfword vectors, tiny rationals, packed bytes, complex values, pathnames, and images; illustrates encode/decode/read/write/equality/null operations. | Low-level storage code; test only on disposable data. |
| `image` | Raster persistence tutorial | Creates base and displaced bit-raster snapshots in Statice and draws them after retrieval. | Historical `beet:` portal and graphics display; the generated grid is algorithmic, not a bundled picture. |
| `joshua-example` | Cross-product persistence experiment | Stores shallow Joshua predication terms as Statice node/symbol/logic-variable entities and implements custom fetch/insert plus graphing. | Source explicitly admits format and transaction-side-effect assumptions; requires both optional products. It is not complete Joshua persistence. |
| `finger-hack` | Debugging/operational sample | Clients periodically write login, idle, site, software, and hardware data to Statice; load-time warm/login/logout hooks manage a timer. A server-side name-service replacement is retained inside a block comment. | Can start background processes and write user/machine data every two minutes. Never load unchanged with private identities or a real site database. |

The fresh world had no Statice, DBFS, or related packages or loaded systems. The
exact Browser, server, backup, and schema boundaries are documented in the
[Statice dossier](statice-persistent-object-and-database-environment.md).

## Color Demo examples

`Color-Demo` is an experimental, explicitly unsupported system of “color hacks,
test patterns and the like.” Its declaration serially loads `test-patterns`,
`testpat`, `hacks`, `mirror`, `spheres-demo`, `fog`, `fog-figures`, `aos-hacks`, and
`curve`. `mirror` and `fog-figures` are support/data modules; the other seven files
register 47 literal menu entries, including a duplicated **Clear Window** in two
lists and one conditionally installed copyright-stamp test.

The system adds **Color Demo** to the System Menu and a global **Demonstrate Color**
command. That command optionally forces a new screen or accepts an existing color
window or color screen. A display-window operation can also start the selector on a
window. Inside the selector:

- the pointer menu chooses a demo or switches among **major demos**, **test
  patterns**, and **bar patterns**;
- a terminal character exits the selector, and most continuous animations also stop
  when either the demo window or terminal receives input;
- each registry item declares whether it needs no map, any map, the standard map, a
  temporary changed map, an eight-bit-only change, or a deliberately retained new
  map; and
- the selector snapshots and restores map state when its declaration requires it.

This is a color-screen and color-map application, not a collection that can be
validated from a monochrome Listener.

### Registered major demos

| Source | Menu entries | Established behavior and controls |
| --- | --- | --- |
| `aos-hacks` | **ballantine**, **movie**, **triangles** | Additive-color, pulsating triangle/sphere animations. Any input stops their loops; hardware pan/zoom state is restored where used. |
| `curve` | **snake** | A smoothly shaded growing snake with a bright temporary eight-bit map; input stops the current run/restart loop. |
| `fog` | **Finger of God**, **Symbolics Logos** | Logo/figure rendering and color-plane or map animation. **Finger of God** changes map segments until input. `fog-figures` supplies encoded geometry rather than another menu item. |
| `hacks` | **wandering window**, **mouse pan//zoom window**, **munching spheres**, **color QIX**, **color Mandala**, **color mixing**, **Pan and Zoom using the mouse**, **mandelbrot images** | Viewport, mouse pan/zoom, shaded-sphere, wandering-line/symmetry, color-composition, and image/map demonstrations. The pan/zoom entries use hardware/window mouse operations; continuous drawing stops on input. Mandelbrot opens its own image/action menu and depends on the Images system and external image names. |
| `spheres-demo` | **spheres demo** | A staged exercise of map segments, overlays, cursor/pan, and sphere drawing intended to demonstrate color hardware features; terminal input can interrupt stages. |

### Registered test and static-display demos

| Source | Menu entries | Established behavior or dependency |
| --- | --- | --- |
| `hacks` | **edit color map**, **show color map**, **shaded circles**, **hexcone cube**, **rgb cube**, **Color Intensity Ramps** | Map editing/visualization, shaded primitive tests, two color-space cubes, and binary intensity ramps. **edit color map** enters the right-button map-parameter path. |
| `hacks` | conditional **Copyright Notice** | If installed, left places a notice at the pointer box and middle aborts. Because it stamps content, it is not a neutral display test. |
| `test-patterns` | **Clear Window** in both test-pattern and bar lists; **test grid**; **resolution chart**; **test colors and gray scales** | Clear, geometry/resolution, chip, and ramp tests. The duplicate entry is one operation exposed in two categories. |
| `test-patterns` | **full field 100% bars**, **full field 75% bars**, **bars + reverse bars**, **bars + red field**, **bars + luminance**, **smpte color bars**, **fcc color bars** | Full-field and composite bar patterns for visual/display evaluation. The source names the intended SMPTE/FCC patterns; calibration accuracy is not runtime-verified. |
| `test-patterns` | **10 step gray bars**, **10 step color bars**, **20 step gray bars**, **20 step color bars**, **Continuous Gray Ramps** | Discrete and continuous ramp tests that temporarily change an eight-bit map where required. |
| `test-patterns` | **standardize color maps**, **Color Map Squares**, **Keep this color map**, **Dac output test** | Map reset/inspection/retention and a visual DAC diagnostic. **Keep this color map** deliberately changes the selector's saved baseline. The DAC test's visual interpretation assumes period hardware and monitor behavior. |
| `test-patterns` | **grab frame**, **load or save image**, **color editor** | Optional bridges to a frame grabber, Images, and Color Editor. They are missing-device/system paths, not guaranteed built-ins of Color Demo. |
| `testpat` | **Grays/Spectrum on grid** | Draws grid, dots, circles, gray/color washes, and date using dependent- or independent-map behavior. |

Counting both category registrations, the tables account for all 47 literal
`DEF-COLOR-DEMO` forms: 3 in `aos-hacks`, 1 in `curve`, 2 in `fog`, 15 in `hacks`,
1 in `spheres-demo`, 24 in `test-patterns`, and 1 in `testpat`. `mirror` supplies
the wandering-window implementation and `fog-figures` supplies many encoded figure
paths, but neither adds a selector entry.

The fresh runtime had a 24-bit X screen but no registered Genera Color screen; the
Color Editor entry point was absent, and a disconnected system load failed. This is
why there is no claim that 24-bit X depth alone makes these indexed-map and overlay
demos work. See the [Color systems dossier](color-systems-and-color-editor.md) for
the exact screen/map models and runtime record.

## CL-HTTP and contributed Web examples

The CL-HTTP contribution is an optional family rather than one example program. Its
47-file `examples/` tree resolves exactly to 14 Lisp sources, 10 compiled forms, one
MCF specification text, four Flower Layers JPEGs, 15 current and older Java source or
class files, and three stored VRML scenes. Functional rows below group a compiled
form with its source and group the Java generations as one Twistdown example; the
assets remain separately rights-bounded. The controls are browser or plug-in
controls, not Genera keybindings.

### Top-level and nested example applications

| Example | Classification | Controls and result | Critical dependency or risk |
| --- | --- | --- | --- |
| Access-control browser | Application example | Describe realm, group, access-control object, or user; search for and edit a user. Edit fields include ID, personal name, email, realm, groups, new group, password/confirmation, remove-password and delete choices, Reset, and Submit. | Mutates credentials. Protection differs among pages; do not expose. |
| Client remote procedure call | Protocol example | POST supplies a Lisp function and arguments; response is a Lisp S-expression. No ordinary human form. | Deliberate remote code execution, even though the sample limits it to local-host subnet. |
| Configuration | Operational template | Resets/configures server variables, subnets, logs, export paths, and can enable service. | Historical site values and network side effects. |
| Documentation search | Browser tutorial | Substring, module multi-selection, Lisp type, show-documentation and external-only choices, Reset, and Submit; related URL and symbol searches. | Can expose implementation documentation if exported carelessly. |
| Browser Lisp Listener | Application example | Typeout, S-expression Typein, hidden history, Revert, and Eval. | Arbitrary Lisp evaluation; local/private flags do not make it safe for untrusted users. |
| Log window | Monitoring application example | Server statistics, refresh rate 0–999, history size 0–999, activity menu, Reset, and Submit; supports live notifications. | Long-lived server response and administrative information. |
| Mail archive/index | Application example | Author/date/subject/conversation and forward/backward views; message number/range/conversation selection; content/header formats; reply/post fields and Send; optional full-text Search. | Requires a supplied archive and mail configuration; source records incomplete MIME, HTML, encoding, and search support. |
| Slide-show generator | UI generator | Previous, Next, Title, timed HTTP Refresh, and optional continuous wrap. | Concrete test show is ignored; browser behavior targets Netscape-era extensions. |
| MCF directory map | Plug-in example | Emits a directory map for Apple's HotSauce client. | Directory says 0.95 while output identifies 0.9 and an incomplete subset; period client required. |
| Twistdown Tree | Java applet example | Arrows expand/collapse branches; selecting node text navigates. | Modern browsers do not run the bundled applet. |
| VRML scenes | 3-D graphics examples | Three stored scenes plus generated cube fields and a parameterized surface with six numeric fields. | Requires VRML 1.0 viewer; the referenced `vrml.html` parameter page is absent. |
| LambdaVista and stemmer | Information-retrieval examples | Index/search form and optional Porter-style term stemming. | Lambda IR is optional, and initialization does not install stemming automatically. |

### Aggregate `exports` example surface

`examples/exports.lisp` is executable configuration, not a passive list. Loading it
constructs accounts and realms, exports source and document trees, installs computed
handlers, and conditionally initializes other systems. It does not unconditionally
perform the final service-enable call, but it prepares a large historically unsafe
surface.

| Behavior group | Demonstration surface | Boundary |
| --- | --- | --- |
| Documentation, source, multimedia, icon, and distribution exports | Static trees, frames, GIF/audio/MPEG examples, source indexes, and downloadable distribution paths | Can publish licensed source/docs or assets; never load unchanged. |
| Header/reload, CGI/server-variable, and environment pages | Echo and introspection of request/server state | Can disclose host and request data. |
| Computed forms | Add, delete, select, and armored hidden-state forms | Form-processing lessons, not authenticated applications by default. |
| Image maps | CERN/NCSA server maps, client maps, a class-diagram inspector, and coordinate echo | Period browser behavior and separate image rights. |
| Authentication and credential status | Basic and Digest demonstration users, realms, groups, and status | Includes fixed demo passwords; Digest does not encrypt traffic. |
| PUT | Upload-directory example | Block-commented and inactive, but unsafe if revived casually. |
| Color chooser and RGB mixer | Background/foreground/link colors, random push interval, RGB values 0–255, keyword choice, Reset, Submit | Possible remote-background fetch; mixer conditional on W3P. |
| Cookies | Name, Value, Domain, Path, Expires, Delete, Reset, Submit | Demonstrates browser state and scope. |
| Macintalk and JavaScript | Generated speech and moving status text | Depends on period media/browser facilities. |
| Flower Layers | Four-image selection with Netscape Layers show/hide | Requires Netscape 4-era behavior and separately reviewed JPEG rights. |
| MCF, W3P, proxy docs, and port-specific docs | Conditional examples for optional systems and other Common Lisp ports | Presence is not proof that each optional tree or external client is usable on Genera. |
| Log/password directories and administrative activities | Server logs, configuration, ACL editing, and password data | Restrict to a disposable loopback fixture with invented credentials. |
| LambdaVista and historical paper exports | Conditional IR index/search and project-paper directory | Requires supplied content and rights review. |

The complete endpoint/file-level evidence and security analysis lives in
[CL-HTTP and contributed Web systems](cl-http-and-contributed-web-systems.md). A
fresh isolated probe found all nine principal systems and ten packages absent. A
future experiment must load only a hand-selected harmless endpoint behind a
loopback-only client/server fixture; the aggregate export file is specifically
excluded.

## Cross-example source findings

Several implementation facts are easy to lose if these files are described only as
“sample applications”:

| Finding | Evidence and conclusion |
| --- | --- |
| Framework count is not product count. | The pinned catalog finds 51 literal framework forms and 49 concrete frames, but only 14 are example frames in this dossier. A macro census measures program definitions, not marketed applications. |
| Core `examples` is not a normal compiled system. | Its source says the definition is distribution-only, distributes sources, and does not distribute binaries; no matching installed system-directory record was found. |
| Two core frames claim Select `A`. | `avv-pane-test` and `accept-two` are sequential definitions in one file. Effective registration is unverified and must not be guessed. |
| Cryptarithmetic's no-search controls are ineffective in source. | The command ignores its Boolean and always passes true to the solver. Runtime confirmation remains pending. |
| Modelling Tutor has a documented input-focus bug. | Every step accepts a raw character in the Lisp display, while the source says the visible cursor stays in the interactor. |
| Hardware Troubleshooter has two implementations but no established toggle. | A modelled object/LTMS source exists; the frame source asks for a switch but defines none. |
| WidgetSim records a same-time completion race. | The output-rule comment says two completed items can race. This is part of the example, not a museum inference. |
| Books is intentionally site- and policy-specific. | Historical portal/printer/backup defaults, a special checkbook, and a fixed recurring amount are embedded in the sample. |
| Statice Joshua storage is not general serialization. | Its own source assumes shallow predications composed of symbols and logic variables and ignores some transaction-side-effect concerns. |
| Color menu declarations are preservation metadata. | Per-item map policies tell a future emulator whether state must be available, standardized, temporarily changed, restored, or deliberately retained. |
| CL-HTTP examples are executable exposure policy. | The aggregate file creates authentication objects and exports trees/handlers; it is not safe to treat it as documentation data. |

## MIT CADR and LM-3 boundary

This page does not manufacture a parallel CADR “examples product.” The public System
46 snapshot contains source and compiled demonstrations, and the maintained LM-3
System 303 tree has a `HACKS` system plus 34 canonical files under `demo/`, but that
material is already classified by registration, load declaration, source entry point,
and runtime evidence in the
[MIT CADR and LM-3 software census](mit-cadr/software-areas-and-applications.md).
Individual games, editors, diagnostics, Munch, Lexiphage, DOCTOR, Paint, color
experiments, and visual assets remain with their own dossiers.

For D60's narrower comparison, incidental example functions and personal working
files are **not** promoted to installed applications merely because they survive in a
source snapshot. System 46 evidence remains pinned to Git revision
`8e978d7d1704096a63edd4386a3b8326a2e584af`; maintained System 303 evidence remains
pinned separately to Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
Neither tree is silently used as source for the licensed Genera examples above.

## Runtime and screenshot status

The existing Genera harness sessions provide a consistent negative baseline:

| Collection | Existing runtime evidence | What it does and does not prove |
| --- | --- | --- |
| Core `examples` | No dedicated example was loaded. Static inspection found a distribution-only source system and no same-named installed system directory. | Source interfaces are established; frame registration, Select collisions, and visible behavior are not. |
| Joshua/Jericho | Session `d40-joshua-registration-20260718` found the principal packages absent and system lookup unresolved in the disconnected base world. | Does not prove the licensed optional product cannot be loaded. |
| Statice | Session `d41-statice-20260718` found six packages and seven loaded systems absent. | Does not validate DBFS, a sample schema, or `books`. |
| Color | Session `d33-color-systems-20260718` found 24-bit X depth but no registered Color screen or editor entry point; disconnected loading failed. | X depth alone does not establish Color Demo map/overlay behavior. |
| CL-HTTP | Session `d49-cl-http-readonly-20260718` found the principal systems and packages absent and started no service. | Does not test an endpoint or browser. |

The negative Listener captures remain in ignored session trees. None shows an example
application, so publishing one here would be decorative evidence of absence. No
runtime screenshot is published on this page.

**TODO — core application captures:** create a private source bridge that exposes
only the selected licensed file to a disposable isolated world; load one example at a
time; first exercise the calculator, employee editor, Life, and the two Accepting
Values frames; record the effective Select `A` behavior; and capture only the states
needed to support the resulting observations.

**TODO — optional products:** load Jericho, Statice, Color Demo, and a minimal CL-HTTP
subset separately, never in one omnibus session. Give Statice an invented disposable
DBFS schema and records; give CL-HTTP only a loopback client and harmless selected
export; give Color a verified Color screen/map path; and keep Joshua facts confined to
the private world. Do not run printer, FEP audio, file-server initialization,
name-server, credential-editing, aggregate Web export, frame-grabber, or real-mail
paths merely to obtain a screenshot.

Any selected image must be reviewed under
[the screenshot publication policy](screenshot-publication-rights-review.md), placed
under `docs/assets/genera-screenshots/`, and accompanied by the full Genera harness
provenance. Bulk tutorial steps, bundled pictures, Help prose, source, Web assets, and
font material are outside the screenshot policy and remain excluded.

## Principal licensed-source identities

The following carrier files anchor the framework and collection claims. Paths are
portable release paths; evacuated suffixes are recorded separately so a lawful media
holder can repeat the inspection.

| Portable path | Revision | Bytes | SHA-256 | Evidence role |
| --- | ---: | ---: | --- | --- |
| `examples/sysdcl.lisp` | 10 | 1,568 | `94a31445ab601eb85442e4346406a5816b05cc035ac1fcd6d2f56b04396d27fe` | distribution-only collection declaration |
| `examples/define-program-framework.lisp` | 2 | 11,133 | `c0309e2583fe0252893ca18d604aa45efc6a111e78e54f7b701b73cc5d15ef08` | `avv-pane-test`, `accept-two`, and `calculator` |
| `examples/ui-application-example.lisp` | 2 | 5,693 | `76ba17d09f48262b62f6919e40a1be2a750632a0e59e5bc236f8e34cca68cab5` | `employee-editor` and presentation actions |
| `examples/common-lisp-life-with-program-framework.lisp` | 1 | 4,402 | `7f33dc9abc036cd112fb484b266ce013f32f4c274ef3eb1e5021341373031ebf` | final `life` stage |
| `joshua/examples/jericho-defsystem.lisp` | 206 | 1,856 | `0d6eb856af6d9d9898c3f256977fed491ed6dcb12c90aa1128b18f947c3b5a66` | Jericho composition |
| `joshua/examples/cryptarithmetic.lisp` | 209 | 91,307 | `0f7d0d6daaae9cec3b1a835f964147bd37d4bdbc43347a909b5ee8fb11d20a22` | solver frame, commands, and gestures |
| `joshua/examples/dial-demo.lisp` | 2 | 3,793 | `f2b5e7e3a6884922d051370e51ad1736782e822059a5202d560c1891c3806dc9` | attached-action dial |
| `joshua/examples/ht-example.lisp` | 207 | 66,441 | `73431bc415344dddcc63f1e1aa9432bbf24dedd5a6eab03a968e78389a26bf1b` | troubleshooter frame and rule workflow |
| `joshua/examples/model-tutor.lisp` | 207 | 43,760 | `9e4307170050eb72266f2d88d4563bdad7b4d077d4944834ab71eb1809d4fbd3` | modelling tutor and acknowledgement bug |
| `joshua/examples/planning-examples.lisp` | 211 | 67,206 | `66adc8471050693ef7ee3c0669d8e47ad8faa0894912e090f2b13c26c7873685` | planner, monkey example, and Blocks frame |
| `joshua/examples/samaritan.lisp` | 222 | 76,437 | `63954b44d0237b071317e759e106bd5d4805be2d6c34254d56385ed345afe984` | test/benchmark registries and Jericho suite |
| `joshua/examples/tms-examples.lisp` | 207 | 30,857 | `87c68d4f78e80436db10ec985ec7130ddff09beeea4cf5d3b422235f4315278c` | TMS lessons and N-Queens frame |
| `joshua/examples/widget-factory.lisp` | 11 | 25,692 | `5b79248e6eb60239c19df845fefa7ee40dce69e5f890fe8e8c704c84e1b4fe77` | factory simulator |
| `statice/examples/books.lisp` | 4 | 20,318 | `09d51dcc36c3b19d10801edcfda7e638e3f3261ba428523770ae4f2cb4ee3cd0` | Statice Books frame and schema |
| `color/color-demo-sysdcl.lisp` | 7 | 3,844 | `3d51f6e7e449f67ce2ecb1ecd234837eb0d6f843e8345c175a13ae2958679059` | Color Demo load order and unsupported status |
| `color/demo/test-patterns.lisp` | 80 | 40,777 | `83a56e4fb3cbfbbcc92de82ef141b897e045ce99befa982cff5bbedb8c1cf99b` | selector, global command, map policies, and 24 registrations |
| `contributed/cl-http/examples/exports.lisp` | 287 | 113,166 | `7ba0aa8acee3a1f0c03b2e3356a813d600e6d03dbbeee6f5d373a756e9e74e29` | aggregate Web example exports and risks |

No file in this table is copied into the tracked documentation. The table is an
evidence index only.

## Preservation implications and next work

- Preserve examples with their owning product and release declarations. A source
  sample without Dynamic Windows, Joshua, Statice, Color, or CL-HTTP dependencies is
  not a self-contained executable artifact.
- Retain the example's classification. Tests, tutorials, and operational templates
  should not be promoted to end-user applications in a generated museum site.
- Preserve exact source-visible defects and omissions. The Cryptarithmetic Boolean,
  Modelling Tutor cursor, modelled-HT switch, WidgetSim race, Books assumptions, and
  missing VRML page are historical behavior evidence.
- Treat site and device examples as active programs. File-server initialization,
  Finger services, Statice timers, printer streams, audio DMA, frame grabbing, Web
  exports, credential mutation, and mail sending need explicit fixtures and
  containment.
- Join a future screenshot to the exact source carrier, optional-system versions,
  world/VLOD, harness run, input sequence, and result. A screenshot cannot establish
  source lineage, and source cannot substitute for an observed display.
- Keep licensed source, binaries, tutorial documents, example data, raster assets,
  Java classes, and generated captures under ignored local trees. This page's
  evidence-only catalog does not relax those boundaries.

## Sources

- Symbolics, [*Programming the User Interface*](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf), especially the User Interface Application Example, program-framework, Accepting Values, command, and presentation material; verified 2026-07-18.
- Symbolics, [*User's Guide to Basic Joshua*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Users-Guide-to-Basic-Joshua.pdf), archival PDF, 177 pages; verified 2026-07-18.
- Symbolics, [*Joshua Reference Manual*](https://ocw.mit.edu/courses/6-871-knowledge-based-applications-systems-spring-2005/resources/joshua_reference/), MIT OpenCourseWare copy, 274 pages; verified 2026-07-18.
- Symbolics, [*Statice User's Guide*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Statice.pdf), Statice 2.0 for Genera 8.0; verified 2026-07-18.
- Symbolics, [*Release Notes for Statice 2.1*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Release-Notes-for-Statice-2.1.pdf); verified 2026-07-18.
- Symbolics, [*Open Genera Beta II Release Notes*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_Beta_II_Release_Notes.pdf), for the contributed CL-HTTP family; verified 2026-07-18.
- John C. Mallery, [“A Common LISP Hypermedia Server”](https://archives.iw3c2.org/www1/PdfWWW94/jcma.pdf), First International World Wide Web Conference, 1994; verified 2026-07-18.
- Symbolics, [*X Window System User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_X_Window_System_User_s_Guide.pdf), for the Open Genera X client's color boundary; verified 2026-07-18.
- Licensed Open Genera 2.0/Genera 8.5 source, system directories, compiled forms, and local read-only runtime records identified by hash above; inspected 2026-07-18, not redistributed.

Last verified: 2026-07-18.

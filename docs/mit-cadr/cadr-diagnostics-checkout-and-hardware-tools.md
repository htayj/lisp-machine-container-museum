---
type: Historical Article
title: CADR diagnostics, checkout, and hardware tools
description: A source-grounded guide to the CADR machine diagnostics, memory and disk checkout, PROM and embedded-controller assemblers, continuity tester, probe drive, and Chaos interface tester.
tags: [mit-cadr, lm-3, diagnostics, hardware, prom, chaosnet, preservation]
timestamp: 2026-07-18T11:38:36-04:00
---

# CADR diagnostics, checkout, and hardware tools

The CADR's hardware service environment was software running on another Lisp
Machine, not a self-contained ROM monitor.  Its programs could reset a separate
CADR, exercise individual data paths and memories, load a diagnostic microprogram,
write a disk block, program a set of bootstrap PROMs, move a pair of physical test
probes across wire-list coordinates, and substitute a candidate Chaosnet board for
the live network interface.  These are engineering instruments with distinct
workflows, not ordinary applications that happen to have austere interfaces.

That distinction matters in a museum.  Nearly every meaningful operation in this
article requires hardware which the Xvfb harness does not emulate, and several
operations deliberately destroy target state.  A Lisp Listener prompt proves only
that a function name is callable.  It does not demonstrate the diagnostic, so this
page uses the complete maintained public source surface, cross-checks the earlier
System 46 source, and leaves runtime captures deferred until a disposable debuggee
and appropriate peripheral models exist.

## Scope and evidence boundary

The companion [microcode, microassembler, and console-debugger article](cadr-microcode-microassembler-and-console-debugger.md)
documents `CC`, its register formats, all of its interactive commands, microload
formats, and `CCWHY` crash analysis.  This article begins where that console becomes
an instrument platform: machine tests, destructive checkout, peripheral tools, and
small embedded-processor assemblers.  `CCWHY` is not counted twice merely because it
calls parity and memory-location helpers from the diagnostic modules.

| Evidence | What it establishes | Limit |
| --- | --- | --- |
| Public MIT CADR System 46 tree at Git revision `8e978d7` | Earlier releases of the CADR diagnostic, memory, disk, PROM, continuity, probe, and Chaos-board code | A source snapshot, not a running System 46 load band or surviving test stand |
| Maintained LM-3 System 303 tree at Fossil check-in `4df393c` | The later released `CADR-DEBUGGER` composition and the complete source-visible entry points audited here | Presence in the tree does not establish attached CADR, disk, programmer, probe table, or Chaos cable hardware |
| Local System 303 band under the museum harness | A possible host Lisp Machine and the exact ordinary runtime release | There is no second disposable CADR debuggee; `usim` does not model the historical continuity table, PROM programmer, or physical network test fixture |

The word *complete* below means complete at the operator-entry-point and functional
family grain for the named System 303 modules.  Tiny register readers and internal
test-loop helpers are explained with the tool that owns them rather than promoted to
separate applications.

## The shared diagnostic architecture

The maintained `CADR-DEBUGGER` system loads a layered host-side stack:

1. `LDBG` chooses a low-level access path and turns reads, writes, resets, map
   operations, and status requests into Busint, serial, or Chaos debug transactions.
2. `CC` supplies symbolic register and memory access, execution control, display, and
   the console command language.
3. `DIAGS`, `DMON`, `ZERO`, and `CADLD` reset and test machine structures, discover
   memory, install diagnostic microcode, and load or compare machine images.
4. `DCHECK` and `CCDISK` reuse physical-memory and debug paths for disk-controller
   checkout and pack operations.
5. `WHY`, QF remote-object modules, and salvage code interpret a failed machine at a
   higher level.  Those controls belong to the console and storage dossiers.

`LDBG` is therefore infrastructure rather than an additional user program.  Its
`DBG-ACCESS-PATH` can select `BUSINT`, `SERIAL`, or `CHAOS`; its public operations
cover reset, status, low- and high-address reads and writes, odd-parity serial
characters, Chaos debug cycles, Unibus-map setup/read/write/clear, Xbus access, and
interrupt-status decoding.  Chaos debug cycles can address data, status, reset,
analog input, and the internal or external 8748 spaces.  A later tool can consequently
perform the same logical test against local registers or a remote target without
embedding transport code throughout the diagnostic.

## Machine checkout with `CC-TEST-MACHINE`

`CC-TEST-MACHINE` is an ordered bring-up sequence.  It raises the console's
low-level diagnostic verbosity, clears pending serial input when necessary, advises
the engineer to ground the `-TPTSE` test point on the control-memory boards, forcibly
resets the entire target, and restores the intended mode before running these groups:

| Order | Test group | Structures exercised |
| ---: | --- | --- |
| 1 | Data paths | Instruction register, PC, MD, VMA, M and A memory, pushdown pointer, PI, PDL buffer, Q, control memory, location counter, A/M pass paths, left/right ALU shifts, Unibus map, and Busint buffers |
| 2 | Fast address tests | M, A, PDL, control and dispatch memories, stack memory, maps, and the Unibus map named in the release table |
| 3 | Control-memory banks | Each 4K bank separately, because the source notes distinct address drivers |
| 4 | Stack-pointer logic | SPC pointer and push/pop behavior |
| 5 | Shifter logic | Left and right masks, masker, shifter, and the location counter's effect on shift operations |
| 6 | Output-address registers | The OA low/high paths used to modify a following microinstruction |
| 7 | Dispatch | Dispatch-memory addressing and execution behavior |
| 8 | Clock | Processor clock behavior and measurement |

This order is diagnostic logic, not presentation.  A failure in an early pass can
localize a basic path before a later composite test introduces more possible causes.
The data-path machinery writes floating-one and floating-zero patterns, detects stuck
and unexpectedly coupled bits, searches for shorts, and prints suspect-bit sets.  The
address and memory routines add gross-data, parity, continuous fill/read, scope-loop,
and bank-localization paths.

`CC-OTHER-TESTS` is a second, explicitly separate suite for the PC incrementer, spy
instruction register, incrementer, arithmetic conditional jumps, gross data across
the declared memories, and A-, M-, and PDL-address logic.  The module also contains
specialized control-memory parity, C-memory-board, microstack-to-PC, OPC, ALU speed,
divide, and PDL push/pop tests.  These are callable engineering probes rather than a
single pass/fail dashboard.

### I/O board checks

`CC-TEST-IO-BOARD` combines three kinds of physical evidence:

- keyboard tests read the target keyboard through the debug path and ask for
  particular keys;
- `CHATST`, described below, can be rebound to the debug interface to exercise the
  target Chaos board;
- serial tests check series data and the EIA/RS-232 signal bits.

The source's separation between a local and debug-interface keyboard is important:
the host's working keyboard is not evidence that the target I/O board passes.

## Memory monitor and machine initialization

`CC-RUN-MTEST` is a controller around the `MEMD` memory-test microprogram.  It first
discovers the target's main memory in 16K-word regions and fast-address-tests every
detected board.  Unless told that the image is already loaded, it then calls
`CC-ZERO-ENTIRE-MACHINE`, reads `SYS: UBIN; MEMD ULOAD`, installs that microcode, and
sets up a straight virtual-to-physical map.  The caller may constrain the tested
address range or offset the map.

The runner executes test numbers 0 through 7: the Lisp loop terminates when the
octal counter reaches `10`.  Ordinary mode stops for an engineer at a diagnostic
halt.  `CC-RUN-MTEST-AUTO` proceeds through recognized wrong-data stops, counts up to
100 errors per test, and accumulates bitwise summaries for addresses and erroneous
data.  An unexpected micro-PC still drops into `CC`; Space aborts the current test.
This is more informative than a boolean memory test because the accumulated AND/OR
patterns expose lines which are always or sometimes involved.

`DMON` also supplies synchronous-TV-memory read, write, fill, check, speed, and scope
loops plus fast address tests for main and display memory.  These functions presume
the corresponding hardware; they are not an image-viewing application.

### What “zero the entire machine” means

`CC-ZERO-ENTIRE-MACHINE` invalidates the console's saved state, optionally hard-resets
the target, disables PROM and error halts at slow speed, and then rewrites major
processor state.  It clears the PDL buffer, both map levels, A and M memory, dispatch
memory, control memory, and the microstack.  Short microprograms run inside the target
to clear structures faster than individual host transactions.

This is intentionally destructive.  It is a bring-up primitive for a just-powered
machine, not a harmless “clear diagnostics” command.  `CADLD` then provides the
opposite direction of the workflow: `CC-UCODE-LOADER` installs an MCR/ULOAD image,
`COMPARE-MCR-FILE` and `CC-COMPARE-UCODE-WD` compare target microcode to files, and
the main-memory load/compare functions install or verify a load image.  The
microassembler dossier describes the file structures those routines consume.

## Disk checkout and controller tools

Disk engineering is split between `DCHECK`, which stages electrical/controller
tests, and `CCDISK`, which provides general remote disk operations.  The
[disk-label and file-system-repair dossier](disk-labels-packs-and-file-system-repair.md)
documents pack labels, partitions, formatting, salvage, and preservation-safe
recovery in depth.  The exact checkout sequence belongs here because it explains the
hardware test's escalating risk.

### The seven `DCHECK` stages

`DCHECK` reports whether the controller identifies itself as Trident, Marksman,
unused, or unmodified Trident, but deliberately does not infer the `MARKSMAN-P`
software setting from possibly broken identification hardware.

| Stage | Operation | Risk and interpretation |
| ---: | --- | --- |
| 1 | Write and read the disk-address register | Establishes any Unibus/Xbus response before finer diagnosis. |
| 2 | Write zero and find bits stuck at one | Suggests broken input/output data-path wiring. |
| 3 | Walk a one through the 28-bit register | Separates stuck-zero bits from other bits spuriously rising. |
| 3.5 | Observe the block counter | Checks disk rotation and index/sector pulse logic. |
| 3.6 | Recalibrate the selected unit | Establishes a known mechanical cylinder reference. |
| 4 | Seek first to cylinder 814 and then through halving cylinder values | Exercises disk-bus bits and basic command logic; the program warns that the drive moves violently. Space or `BYPASS-SEEKS` skips this portion. |
| 5 | Make CLP and CCW addresses point at nonexistent memory | Verifies NXM status and memory-address behavior. This and later stages are rejected when `USE-LOCAL-DISK` selected the host's own disk. |
| 6 | Write and read disk block 1 | **Destructive.** Writes floating-one, floating-zero, and address-as-data patterns, then diagnoses dropped/picked data and implicated address bits. |
| 7 | Read power-of-two cylinders | Uses header-compare failures to expose disk-bus address faults, then directs the engineer toward formatting and ECC tests. |

`USE-LOCAL-DISK` is not merely a flag: it substitutes local physical-memory access
functions and device addresses, after which `DCHECK` stops before the remote-only
memory-chain and write tests.  That global rebinding is another reason not to invoke
the code casually in the museum band.

Beyond the staged pass, `DCHECK` includes write/read patterns, repeated reads, whole
track decode/rewrite, track formatting, deliberate bit corruption, and ECC tests.
`CCDISK` can initialize and analyze a controller, print its error log and label,
perform raw and queued transfers, save or restore data, copy partitions, select the
current microload or load band, check page-hash-table accessibility, and format a
pack.  Some names sound observational while still reaching a live controller; the
storage dossier supplies the operation-by-operation safety classification.

## PROM programmer

`PROMP` controls a separate PROM programmer over the Lisp Machine's serial
interface.  Its contemporary header instructs an operator to place a “System 19”
programmer in remote mode and records 300 baud at MIT versus 1200 baud at Symbolics.
Those are release observations, not universal settings for a modern substitute.

The complete operator workflow is:

| Entry point | Behavior |
| --- | --- |
| `PROGRAMMER-RESET` | Creates the eight-data-bit serial stream if needed, resets the controller, and queries the device word limit, byte size, and voltage/status geometry. It must precede ordinary use. |
| `PROGRAMMER-COMMAND` | Sends a controller command, optionally reads a fixed-size result, and interprets `>` as success, `F` as failure, and `?` as unknown. |
| `PROGRAMMER-READ-RAM` / `PROGRAMMER-WRITE-RAM` | Exchanges programmer RAM using Intel Intellec 8/MDS format 83, with hexadecimal records and checksums. A read checksum failure resets and retries. |
| `PROGRAMMER-UNWEDGE` | Resets, enters input mode, resets again, and reads error status. |
| `PROGRAMMER-PROGRAM-PROM` | Downloads an array, retries controller write errors, reads RAM back, verifies both supplied data and zero-filled remainder, then enters the physical-device step. |
| `PROGRAMMER-WRITE-PROM` | Asks for a fresh device, performs blank and bad-bit checks with explicit proceed confirmations, programs it, and verifies it. This operation is irreversible for one-time-programmable parts. |
| `PROGRAMMER-READ-PROM` | Loads the inserted device into a named Lisp array and records location and checksum properties. |
| `PROGRAMMER-READ-PROM-FILE` / `PROGRAMMER-WRITE-PROM-FILE` | Converts the Lisp Machine's standard textual PROM form: `PROM`, property/value metadata such as `LOCATION` and `SUM-CHECK`, addressed octal bytes, then `END`. |
| `PROGRAMMER-MAKE-BOOTSTRAP` | Reads and programs the six CADR bootstrap devices at board positions 1B19, 1B17, 1C20, 1D16, 1E19, and 1E17. An optional `FROM` argument resumes at a selected device. |

The program verifies programmer RAM before it offers to burn the device.  This is a
useful source-visible design detail absent from a one-line media inventory: failures
in serial transfer are separated from failures in blank checking, programming, or
device verification.

## Embedded-controller assemblers

Two compact, two-pass assemblers generate firmware images for peripheral processors.
They are Lisp-data assemblers rather than text-file command-line tools.  A program
symbol carries source forms on its `CODE` property; assembly saves an addressed byte
list on `ASSEMBLED-CODE`, binds the symbol to a zero-filled PROM-image array, and
records the symbol itself as its `LOCATION`.

### Intel 8x48/8x41 assembler

`AS8748` and `AS8741` select the processor variant; the generic `AS` accepts
`:AS8748` or `:AS8741`.  Pass one assigns bare-symbol labels and computes locations.
Pass two resolves expressions and emits bytes.  `(= address)` moves the program
counter, numbers and one-element expressions emit raw bytes, `(/# expression)` is
the immediate operand form, and `JB-UNDER-MASK` turns a one-bit mask into the
corresponding `JB0` through `JB7` instruction.

The supported instruction surface, grouped by its dispatch implementation, is:

- arithmetic and increment/decrement: `ADD`, `ADDC`, `INC`, `DEC`;
- page, indirect, decrement, and conditional branches: `JMP`, `JMPP`, `DJNZ`,
  `JB0`–`JB7`, `JC`, `JNC`, `JF0`, `JF1`, `JZ`, `JNZ`, `JTF`, `JT0`, `JT1`,
  `JNT0`, `JNT1`, plus 8741-specific `JNIBF` and `JOBF` and 8748-specific `JNI`;
- logic and movement: `ORL`, `ANL`, `XRL`, `MOV`, `MOVX`, `MOVP`, `MOVP3`,
  `CLR`, `CPL`, `SWAP`, `XCH`, `RL`, `RLC`, `RR`, `RRC`;
- control and I/O: `CALL`, `RET`, `RETR`, `NOP`, `EN`, `DIS`, `STRT`, `STOP`,
  `OUTL`, `OUT`, `IN`, `INS`, and `SEL`.

The parser recognizes `R0`–`R7`, `@R0`, `@R1`, accumulator `A`, timer `T`, status
words `PSW` and `STS`, and instruction-specific port/bus operands.  It checks page
limits on short branches and rejects instructions assigned to the other processor
variant.

### Intel 8x51 assembler

The 8x51 assembler was converted from the earlier tool in 1982 and retains the same
two-pass, `CODE`-property model.  It adds direct byte names, `(BIT register number)`
specifiers, accumulator/carry/data-pointer addressing, relative and absolute jump
sizes, and `AS-LOAD-ASSEMBLED-CODE`, which can write the result through
`RC-WRITE-UMEM` into a target microcontroller memory interface.

Its implemented families are `ADD`, `ADDC`, `SUBB`, `XCH`, `XCHD`; `SJMP`, `AJMP`,
`LJMP`, `ACALL`, `LCALL`, `JC`, `JNC`, `JZ`, `JNZ`, `JB`, `JNB`, `JBC`, `DJNZ`,
and `CJNE`; `INC` and `DEC`; `ORL`, `ANL`, `XRL`; `MOV`, `MOVX`, `PUSH`, `POP`;
`CLR`, `SETB`, and `CPL`; and the single-byte operations `DA`, `DIV`,
`JMP-TO-DPTR+A`, `MOVC-A-@A+DPTR`, `INC-PC-THEN-MOVC-A-@A+PC`, `MUL`, `NOP`,
`RET`, `RETI`, `RL`, `RLC`, `RR`, `RRC`, and `SWAP`.

Named direct-byte registers include `ACC`, `B`, `PSW`, `SP`, `DPH`, `DPL`, ports
`P0`–`P3`, interrupt-control names, timer registers, and serial control/buffer names.
The source separately marks only those special-function registers which are bit
addressable.  This prevents a byte-address name from silently being accepted where
the processor requires a bit address.

These assemblers are not speculative utilities: the public keyboard source records
an 8748 firmware assembly/programming path, and the distribution list ships both
assemblers beside `PROMP`, `CDRIVE`, and `CTEST`.  Their output is nevertheless
firmware data, not CADR microcode; the full CADR microassembler is documented
separately.

## Continuity tester (`CTEST`)

`CTEST` turns physical-design wire lists into an executable probe itinerary.  It
supports two board-coordinate grammars named `MPG216` and `LG684`, parses connector,
socket, paddle, jack, and DEC-style pin locators, and maps those logical names to
table coordinates.  The high-level `TEST-ICMEM` path reads `CADRWD;ICMEM3 WLR` and
sets up two boards; `TEST-CADR` reads `CADRWD;CADR4 WLR` and sets up four.

`CTEST-READIN` reads the wire-list text, locates and parses signal runs, then performs
two travel optimizations.  It first chooses which endpoint the left probe should
take by X position and sorts that phase; it then greedily chooses the next run with
the least combined Manhattan travel for both probes.  The code can calculate total
travel, exhaustively permute small neighborhoods, or randomize intermediate runs for
further experimentation.

For each multi-point net, `CTEST-TRY-TESTING` first places the probes at the two
endpoints.  A passing endpoint test accepts the run.  A failure makes
`CTEST-TEST-SEGMENTS` test every adjacent segment so the recorded result names the
smaller broken span.  Bad runs are checkpointed as Lisp data, can be read back, and
can be retested without repeating the entire wire list.  Special expected responses
exist for ground and +5V as well as an ordinary signal net.

The source does not display a graphical circuit diagram.  Its visible interface is
Listener text, questions, beeps, and the motion of the physical probes.  Describing
it as an automated continuity-test planner is more accurate than calling it a CAD
viewer.

## Probe drive (`CDRIVE`)

`CDRIVE` operates two stepper-driven probes through the general I/O address at octal
`764126`.  Each `PROBE-CLASS` object tracks step positions, up/down state, the other
probe, calibration, and cumulative error.  Movement raises the probe before stepping,
can ramp toward a configured speed, and orders X/Y motion to reduce collision risk:
when probes move apart, X goes first; when they move toward each other, Y goes first.

Calibration stores board-specific correction points.  The calibrator weights them
by inverse distance squared and reduces the influence of a farther point shadowed in
nearly the same direction by a nearer point.  This yields an interpolated X/Y
correction instead of a single global scale.  The probe can center on a pin, spiral
outward until it climbs onto a pin, center on grounded metal, define its location by
a textual pin name, and recalibrate individual boards.

The safety paths are historically revealing.  If a probe appears stuck at the top,
the code cycles the other probe to provide a mechanical shock and retries a bounded
number of times.  If a raised probe never reports clear, it disables the down command
and enters a correctable error rather than continuing indefinitely.  These checks
reduce risk; they do not make emulated or unattended execution safe.

### Manual probe controls

Manual control usurps the mouse, returns the distance moved, and recognizes the full
following surface:

| Input | New-keyboard effect | Old-keyboard effect |
| --- | --- | --- |
| `(` / `[` | X −1 / X −16 | Old `[` / `{` perform X −1 / X −16 |
| `)` / `]` | X +1 / X +16 | Old `]` / `}` perform X +1 / X +16 |
| backquote / `~` | Y +1 / Y +16 | Old backslash / `|` perform Y +1 / Y +16 |
| backslash / `|` | Y −1 / Y −16 | Old slash / Control-N-character perform Y −1 / Y −16 |
| Control/Meta modifiers | Multiply the step by powers of two; Top is decoded separately | Same scaling rule |
| Alt | Recursively enter slow manual control for the other probe | Same |
| Rubout | Leave manual control | Same |
| Mouse button 1 | Toggle this probe up/down | Same |
| Mouse button 2 | Center on ground | Same |
| Mouse button 3 | Center on a pin | Same |

`SETUP` asks the operator to align the right probe over `1A01-10` and the left over
`1AJ1-1`, calibrates the right probe, moves it clear, and then calibrates the left.
This physical starting condition is part of the program's semantics and cannot be
replaced by synthesizing keystrokes in Xvfb.

## Chaos interface-board tester (`CHATST`)

`CHATST` operates at raw interface-register level.  `SET-BASE-ADDRESS` defaults to
octal `764140`, derives the board-register addresses, and reads the cable/host number.
Setting `CHATST-USE-DEBUG` redirects its register access through `LDBG` to a board in
the debuggee rather than the local machine.

The standard `CHATST` pass resets the board and runs floating-one, floating-zero,
address, octal `52525`, all-zero, and all-one patterns.  By default it sends four raw
packets per pattern in hardware loopback and four on the cable.  It deliberately does
not create a properly formatted Chaos header, exercise interrupts, or prove bus-grant
logic.  `SET-NCP-BASE-ADDRESS` is the separate, invasive step that makes the candidate
board the live NCP interface; its own documentation requires a bus-grant jumper.

The complete operator-level families are:

- setup and patterns: `SET-BASE-ADDRESS`, `SET-PATTERN`, packet length,
  receive-all, and local-versus-debug selection;
- bounded raw tests: `CHATST`, `CHATST-ONCE`, transmit preparation, receive and data
  comparison, reset, and decoded status;
- scope/loop tests: transmit/receive-until-key, packet-to-echo-host, continuous send,
  “buzz,” and interval-timer loops;
- formatted echo checks: header construction, repeated echo, one-shot echo, status,
  bit-count, address, header, payload, CRC, and collision/abort validation;
- observation and endurance: receive-all network monitor, null-packet soak counters,
  and a continuous rotating-pattern test with timestamped error logging and an error
  percentage cutoff;
- service substitution: `SET-NCP-BASE-ADDRESS`, which reinitializes the NCP against
  the selected board.

The receive path distinguishes correct returned data accompanied by a CRC indication
from corrupt data.  The source specifically warns that the former often points to a
CRC-generator fault and that a single pattern, especially all zeros, cannot expose
every board error.  That is a high-confidence implementation finding which a short
program inventory would miss.

`CHATST-MONITOR` is an on-line cable monitor in the historical sense: it watches live
Chaos traffic and prints packet words or a shortened header/tail summary.  It is not
an Internet service or a general packet-capture file format.  The broader
[network-services article](../network-services-and-site-utilities.md) explains the
NCP and service layer built above the board.

## Runtime and screenshot status

There is deliberately no screenshot for these programs yet.  A representative
capture would need to show a real diagnostic result, not an ordinary Listener with a
function name typed into it.  The current one-machine System 303 harness lacks:

- a separately disposable CADR debuggee and Busint/serial/Chaos debug fixture;
- controller and scratch-pack state safe for `DCHECK` stage 6 or formatting;
- the serial PROM programmer and a sacrificial device;
- the probe table, controller, calibrated board placement, and matching WLR inputs;
- a test Chaos board, cable peer, and bus-grant arrangement isolated from the running
  NCP.

**Screenshot TODO:** add reviewed images only after one of those fixtures produces a
bounded, reproducible and historically meaningful visible result.  Retain raw logs,
state, and captures under the ignored CADR computer-use tree; review any selected PNG
under the repository's [screenshot publication policy](../screenshot-publication-rights-review.md).

## Preservation and emulation implications

These sources define useful future peripheral tests.  An emulator implementation can
be checked against observable invariants rather than just boot success: control and
dispatch parity behavior, map clearing, disk status and MA movement, Chaos bit counts
and CRC indications, serial protocol acknowledgements, and exact register patterns.
The destructive routines must run against disposable copies, and physical-motion or
one-time-programming actions need explicit stubs or operator interlocks.

The source also preserves interfaces beyond the CPU schematic: board pin grammars,
probe calibration mathematics, WLR run planning, PROM record syntax, embedded
firmware assembly dialects, and troubleshooting logic.  Recovering only a load band
would preserve executable code but would make much of this engineering intent harder
to interpret.

## Reproducible source record

The maintained System 303 files inspected locally matched these portable records:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| `cc/diags.lisp` | 90,295 | `c06a82063e1af1fb17c3ec4a9cf110b611be86999724e9e605c9b92aee1a7991` |
| `cc/dmon.lisp` | 23,489 | `99117f946955134531dc02a10c218d15a35d8e57be37e818e825701c572d4ba1` |
| `cc/ldbg.lisp` | 14,409 | `fd2b9726fce45e3bf4bbf723b980767422d410d1b656a59e630fff5f07e460a9` |
| `cc/zero.lisp` | 4,957 | `81ac96c4e75a75f2a4b734c077c5dcac2dbba153c2293300da0133af05fab386` |
| `cc/cadld.lisp` | 8,328 | `9e171a1705fbcac206ba06c06dafe36ed51d4c216884f66502388c02e7654662` |
| `cc/ccdisk.lisp` | 25,698 | `09c969c8859388c31379b840f6b8ce86739be02aaa9f50c1714d5d889867fd9b` |
| `cc/dcheck.lisp` | 41,008 | `38476cd27139e9d226b6ea3b0c3d0a98c03b473d08e54eca127f71033c594e8a` |
| `io1/promp.lisp` | 13,916 | `69f044e4d96b38e549aeede5529878d00dc14a4ea24a9a3631dcfd9837832038` |
| `io1/cdrive.lisp` | 30,474 | `286c68c5484b6540080d0cbba77486db6f6c3fc92ab39c99f89a4b5bcefbb22c` |
| `demo/ctest.lisp` | 37,912 | `ed47e12ff9edb56725cffd1d8afa0fb73f7e1143d0c5f60bbc984bc013c85c9f` |
| `network/chaos/chatst.lisp` | 24,753 | `821e3d9a1766362bfe940aef3d60fcc42cbf6c1f8ece0f35af8664ab143fca96` |
| `io1/as8748.lisp` | 17,664 | `a1aef6e87a14e28c07f57b2d257bcb087c8e67f61b8d15e5e99fd17806395f71` |
| `io1/as8751.lisp` | 21,324 | `6dd647392f2412cfc4b9c9c7798c0ece598fbad030cf948980846c926e5ddd9f` |

Checks were made with `sha256sum` against the public System 303 tree.  No licensed
Genera source or recovered proprietary payload appears in this article.

## Sources

- MIT CADR System 46 public source at revision
  [`8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7b50fe3c9411bd351b866d6590eb63b68e/src),
  especially `src/lcadr/diags.101`, `dmon.34`, `ldbg.29`, and `ccdisk.87`;
  `src/lmcons/zero.10`, `cadld.26`, and `dcheck.81`; and `src/lmio1/promp.4`,
  `cdrive.90`, `ctest.99`, and `chatst.37`.
- LM-3 project, maintained System 303 sources
  [`cc/diags.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/diags.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`cc/dmon.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/dmon.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`cc/ldbg.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/ldbg.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`cc/zero.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/zero.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`cc/cadld.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/cadld.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`cc/dcheck.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/dcheck.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`io1/promp.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/promp.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`io1/cdrive.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/cdrive.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`demo/ctest.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/demo/ctest.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`network/chaos/chatst.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/network/chaos/chatst.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`io1/as8748.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/as8748.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  and [`io1/as8751.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/as8751.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  Fossil check-in `4df393c`.
- [CADR on-line help recovery](online-help-and-documentation-recovery.md), including
  the public `DCHECK` and `CHATST` help declarations from the System 46 corpus.

Last verified: 2026-07-18.

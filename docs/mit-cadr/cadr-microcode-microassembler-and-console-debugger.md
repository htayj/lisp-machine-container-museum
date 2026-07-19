---
type: Architecture Note
title: CADR microcode, microassembler, and console debugger
description: A source-grounded guide to the CADR microcode build pipeline, incremental microassembly, microload artifacts, and the complete release-bounded console-debugger interface.
tags: [mit-cadr, lm-3, microcode, microassembler, console-debugger, preservation]
timestamp: 2026-07-18T11:26:44-04:00
---

# CADR microcode, microassembler, and console debugger

The CADR engineering environment is a closed loop rather than three unrelated
utilities. Lisp source describes the processor's microprogram; the `CONS-LAP`
microassembler turns that source into control-, dispatch-, and A-memory images plus
symbols and error metadata; the microload writer packages those images for the CADR;
and the `CC` console uses the same register map and symbols to inspect, control, and
diagnose a second machine. The maintained LM-3 tree makes this relationship explicit:
the released `CADR` system consists of `CADR-MICRO-ASSEMBLER` and
`CADR-DEBUGGER`, while `UCODE` is a separate Make-System description for the
machine's microprogram.

This is not a normal source-level debugger running inside the program it examines.
`CC` is a DDT-like hardware console on one Lisp machine for a separate CADR
*debuggee*. Depending on the release and configuration, it reaches that target through
the bus interface, a serial path, or Chaosnet. It can stop and reset the processor,
rewrite its memories and maps, patch microinstructions, alter its mode register, and
start scope loops. Those powers explain both its historical value and why opening a
window in the museum's single-machine harness would not constitute a meaningful or
safe runtime demonstration.

## Evidence boundary

The public System 46 snapshot and maintained LM-3 System 303 tree represent different
points in this toolchain's development:

| Evidence | What it establishes | Important limit |
| --- | --- | --- |
| MIT CADR System 46 source at revision `8e978d7` | The monolithic `UCADR` microprogram, two-pass assembler, MCR/ULOAD writers, incremental image machinery, and an earlier `CC` command loop | The public snapshot is a historical file collection, not a reconstructed running System 46 band. Its `cc.516` file does not contain every later crash-analysis command. |
| LM-3 System 303 source at Fossil check-in `4df393c` | The split 23-module `UCODE` system, released component declarations, later console transport and crash-analysis layers, and the complete source-installed command surface audited below | Source presence does not prove that a configured second debuggee or its physical interfaces exist in the runnable museum environment. |
| Local System 303 load band | A runnable ordinary Lisp Machine environment under the CADR harness | It is the would-be *debugger host*, not an isolated second debuggee. No debug cable, synthetic peer, or reversible target-memory fixture has yet been established. |

The detailed command inventory is therefore source-complete for the maintained
System 303 files named by the `CADR-DEBUGGER` system declaration. It also calls out
the observable System 46 differences. It does not claim every personal diagnostic
function in every historical file revision, and it leaves the hardware test programs
to [CADR diagnostics, checkout, and hardware tools](cadr-diagnostics-checkout-and-hardware-tools.md).

## The released system composition

System 303 declares the top-level `CADR` system as two components:

- `CADR-MICRO-ASSEMBLER`, in package `MICRO-ASSEMBLER` with nicknames `UA` and
  `MICRO-ASSEMBLER`, compiles `CADRLP`, `CDMP`, `QWMCR`, `FREAD`, and `USYMLD`
  after reading the common register, microinstruction, and assembler symbol
  definitions from `QCOM`, `DEFMIC`, and `CADSYM`;
- `CADR-DEBUGGER`, in package `CADR` with nickname `CC`, loads the console and
  QF remote-object machinery together with symbol loading, low-level access,
  diagnostic, disk, crash-analysis, patch-location, and salvage modules. It reads
  `CADREG` so the console and assembler agree on the processor's register-address
  space.

The separation is meaningful. The assembler can build and manipulate an image without
executing it. The console can load or compare a microcode image, select the symbol table
matching a debuggee's microcode version, and use those symbols to turn raw hardware
state into microinstruction names, Lisp objects, stack frames, and crash explanations.

The System 46 tree has the same architectural pieces but normally presents the main
microprogram as the 734,408-byte monolithic `src/lcadr/ucadr.694`. The maintained
System 303 `UCODE` declaration instead lets Make-System microassemble 23 ordered source
modules:

| Order | Module | Principal responsibility indicated by its name and source organization |
| ---: | --- | --- |
| 1 | `UC-PARAMETERS` | Global machine and assembly parameters; it must precede `UC-CADR`. |
| 2 | `UC-CADR` | Core CADR definitions and common microcode. |
| 3 | `UC-MACROCODE` | Macroinstruction interpreter. |
| 4 | `UC-CALL-RETURN` | Calling, return, and frame machinery. |
| 5 | `UC-STORAGE-ALLOCATION` | Allocation paths. |
| 6 | `UC-FCTNS` | General microcoded functions. |
| 7 | `UC-ARRAY` | Array operations. |
| 8 | `UC-LOGICAL` | Logical operations. |
| 9 | `UC-ARITH` | Arithmetic operations. |
| 10 | `UC-STRING` | String operations. |
| 11 | `UC-TRANSPORTER` | Data-type and garbage-collector transport. |
| 12 | `UC-STACK-CLOSURE` | Stack-closure support. |
| 13 | `UC-METER` | Microcode metering support. |
| 14 | `UC-HACKS` | Miscellaneous specialized routines. |
| 15 | `UC-TV` | Display operations. |
| 16 | `UC-TRACK-MOUSE` | Pointer tracking. |
| 17 | `UC-PAGE-FAULT` | Paging faults and recovery. |
| 18 | `UC-DISK` | Disk operations. |
| 19 | `UC-INTERRUPT` | Interrupt handling. |
| 20 | `UC-CHAOS` | Chaosnet support. |
| 21 | `UC-STACK-GROUPS` | Stack-group switching. |
| 22 | `UC-COLD-DISK` | Cold-start disk path. |
| 23 | `UC-MC` | Final microcompiler/microcode support layer. |

`UC-PUP` appears as a commented-out component. That is evidence of a contemplated or
older Pup layer, not evidence that the maintained System 303 `UCODE` build includes
it.

## How `CONS-LAP` represents microinstructions

Microcode source is Lisp data. An assembler symbol's value is itself a small
expression evaluated by `CONS-LAP-EVAL`; field names, instruction classes, addresses,
and composed byte specifications can consequently participate in the same symbolic
calculation. The fixed symbol vocabulary comes from `CADSYM`, while source files add
user symbols during an assembly.

The assembler recognizes four localities:

- `I-MEM` for control-memory microinstructions;
- `D-MEM` for dispatch-memory words;
- `A-MEM` for A-memory words and constants;
- `M-MEM` for the small M-memory view, whose hardware locations overlap the first
  part of A memory.

An instruction is built by composing symbolic fields. The major instruction contexts
are ALU, byte, jump, and dispatch. A supplied destination constrains the instruction
to a class that can write it; an I-memory address context implies a jump; a D-memory
context implies a dispatch; M- and A-memory sources together imply an ALU operation.
After composition, the assembler checks incompatible indicators, supplies defaults,
allocates constants, and applies CADR-specific transformations such as byte-field
rotation.

The source-level pseudo-operations fall into these complete functional families:

| Family | Forms or mechanisms | Effect |
| --- | --- | --- |
| Layout and symbols | bare labels, `LOCALITY`, `LOC`, `LOC-MODULO`, `DEF-DATA-FIELD`, `DEF-NEXT-FIELD`, `SET` | Select a memory, position its location counter, and define symbolic values or fields. |
| Dispatch construction | `START-DISPATCH`, `END-DISPATCH`, dispatch arms and constants | Allocate and populate aligned dispatch-memory blocks while connecting them to control-memory instructions. |
| Source generation | `REPEAT`, `IF`, `BEGIN-COMMENT`/`END-COMMENT` | Repeat or conditionally include assembly forms and deliberately ignore bounded regions. |
| Entrypoints and linkage | `MISC-INST-ENTRY`, `MC-LINKAGE`, `MC-LINKAGE-VALUE`, `MC-ENTRY-ADR`, `MISC-ENTRY-ADR` | Publish microcoded instruction entrypoints and allow later incremental modules to refer to earlier memory locations or values. |
| Errors and reserved locations | `ERROR-TABLE`, `MICRO-CODE-ILLEGAL-ENTRY-HERE` | Associate trap sites with error-table records and mark an intentionally illegal entry. |
| Field expressions | `FIELD`, `BYTE-FIELD`, `LISP-BYTE`, `ALL-BUT-LISP-BYTE`, `BYTE-MASK`, `BYTE-VALUE`, arithmetic composition, and `I-ARG` | Construct and position instruction fields and literal values. |
| OA modification | `OA-LOW-CONTEXT`, `OA-HI-CONTEXT` | Assemble a microinstruction as data suitable for the CADR's output-address mechanism, which modifies the following instruction. |

This table is complete at the language-family grain. `CADSYM` defines a much larger
machine-specific vocabulary of register, function-source, destination, ALU, jump,
dispatch, and byte-operation names; treating each symbolic field value as a separate
user command would obscure rather than describe the assembler language.

## The two passes

`CONS-LAP-SYSTEM` performs two passes over the ordered inputs.

1. Pass one assigns symbols and memory locations, allocates dispatch ranges, records
   linkage, and measures each module's control-memory extent. Only after layout does it
   set the M- and A-constant bases.
2. Pass two replays the sources from the initial state, evaluates each storage word,
   writes the I-, D-, and A-memory arrays, records entrypoints and error-table data,
   and verifies that the constant bases and memory limits remained consistent.

The assembler then stores the deduplicated M and A constant lists into A memory and
records the exact memory ranges contributed by the assembly. Errors retain the last
label and word offset, which gives an engineer a source-relative failure position
without a separate textual assembler listing.

The Make-System integration is more than a convenience wrapper. The
`:MICRO-ASSEMBLE` transformation collects all component pathnames and defers one
combined assembly until the system's files have been considered. It chooses the next
MCR version from the existing output, supports the fast reader declared by `UCODE`,
and preserves the ordered module boundary while producing one machine image.

## Outputs and preservation formats

The normal system build can write three mutually supporting artifacts:

| Artifact | Writer | Contents and purpose |
| --- | --- | --- |
| `MCR` | `WRITE-MCR-FILE` | The loadable microcode image: section 1 control memory, section 2 dispatch memory, section 3 main-memory microcode-symbol area, and section 4 A memory. An optional leading section-3 record identifies a base microcode version. |
| `SYM` | `WRITE-SYMBOL-TABLE-FILE` | Symbolic memory names and assembler state used by the console and incremental assembler. Negative record markers distinguish assembler state (`-4`), symbols (`-2`), and end of file (`-1`). |
| `TBL` and error-table output | `WRITE-TBL-FILE` and `WRITE-ERROR-TABLE` | Location/linkage information and the mapping from microcode trap points to Lisp error descriptions. |

MCR is a structured load image, not a serialized Lisp heap. Its writer emits words as
16-bit pieces. A control-memory word occupies four such pieces; A-memory words use two;
dispatch words include the value plus computed odd parity. The section-3 record points
to a page-aligned array of tagged fixnums containing the microcode entrypoint image.
This is why a debugger can load raw machine state and still recover symbolic meaning.

`CONS-DUMP-MEMORIES` provides a separate textual `ULOAD` path. It writes addressed
I-, D-, and A-memory records, the microcode-symbol area's origin and contents, and a
symbol list terminated by negative markers. It is a loader interchange artifact, not
an alternate source language and not a world snapshot.

For preservation, the source, MCR, SYM, TBL, and error table answer different
questions. The source explains intended behavior; the MCR preserves the executable
machine state; SYM makes it intelligible; and the table/error files connect that state
to entrypoints and failures. Keeping only the MCR would preserve effects but discard
much of the recoverable engineering vocabulary.

## Incremental microassembly

System 303's `USYMLD` layer treats the running microcode plus later assemblies as a
stack of modules. `ADD-ASSEMBLY` reads the current machine's microcode version,
assembles a source file against the previous assembler state, merges only its occupied
I-, D-, and A-memory locations into an in-memory `UCODE-IMAGE`, and records the
module's source, definitions, linkage table, symbols, entrypoints, and post-assembly
state.

The corresponding operations are:

| Operation | Meaning |
| --- | --- |
| `ADD-ASSEMBLY` | Assemble and merge a new module against the current image. A newer version of the same generic pathname first replaces the top module. |
| `DUMP-MODULE` | Write a QFASL whose loading reconstructs the module rather than rerunning its source assembly. It includes enough CADR register constants for the first user module. |
| `RELOAD-MODULE` | Recreate a dumped module, rejecting a mismatched base microcode version or predecessor-module chain. |
| `UNLOAD-MODULE` | Remove the top module from the loaded-machine view while retaining its image record. |
| `FLUSH-MODULE` | Remove the top module from both the loaded view and the image's module stack. |

Unload and flush are deliberately last-in, first-out: the source rejects removal of a
non-top module. This is a small linker's dependency rule embedded in the development
environment. The `MC-LINKAGE`, microcoded-instruction entry, and misc-instruction
mechanisms let a later module refer to stable meanings rather than baking in
unexplained addresses.

## What the console debugger controls

Calling `CC` initializes an octal command loop in the `CADR` package. Its fixed status
region shows the target PC, output bus, symbolic PC, decoded instruction register,
processor error status, bus-interface status, and up to eight user-selected RAID
registers. It then parses DDT-style expressions rather than Lisp forms.

The register-address namespace is intentionally flat even though the hardware is not:

| Syntax | Address space |
| --- | --- |
| `n@C`, `n@D`, `n@P` | Control memory, dispatch memory, and PDL buffer. |
| `n@1`, `n@2` | First- and second-level maps. |
| `n@A`, `n@M`, `n@U` | A memory, M memory, and micro-return stack. |
| `FS n`, `FD n` | Functional sources and destinations. |
| `CC n`, `CSW n` | Special console registers and control switches. |
| `RAIDR n`, `CIB n`, `OPC n` | Persistent status-display selections, console instruction buffers, and the eight old-PC slots. |
| `200000+n` | Physical main-memory location `n` in the pinned CADR register map. |
| `1000000+n` | Virtual main-memory location `n`. |
| `n@G` | Set the starting PC/address. |
| `@Q` or `Q` | Reuse the last value, optionally adding a prefix. |

The prose header still says that physical memory begins at octal `100000`; both the
System 46 `cadreg.10` and System 303 `cadreg.lisp` constants set it to octal `200000`.
The constants and actual range decoder are authoritative here. This is a concrete
source/manual-comment discrepancy.

### Word display and editing modes

An underscore followed by a mode decodes the accumulated value. A backquote invokes
the same descriptor language as type-in from zero; an apostrophe edits the fields of
the previous value. In field input, Escape completes, `?` lists completions, Space
accepts a syllable or default, and apostrophe-mode Space can retain the old field.

| Suffix | System 46 | System 303 | Meaning |
| --- | :---: | :---: | --- |
| `_nn` | yes | yes | Rotate the 32-bit value left by octal `nn`. |
| `_H` | yes | yes | Two halfwords. |
| `_B` | yes | yes | Four bytes, right to left. |
| `_Q` | yes | yes | Decode a tagged Lisp Q. |
| `_A` | yes | yes | Decode an array header. |
| `__` | yes | yes | Decode a console register address symbolically. |
| `_U` | yes | yes | Decode the current assembler-style microinstruction format. |
| `_V` | yes | yes | Decode the older microinstruction format. |
| `_S` | yes | yes | Print a remote Lisp object with bounded print level and length. |
| `_#` | yes | yes | List set-bit numbers. |
| `_I` | yes | **no** | Decode a macroinstruction in `cc.516`; the System 303 header still advertises it, but its live descriptor table omits `I`. |
| `_T` | no | yes | Show four bytes as characters. |
| `_N` | no | yes | Show a signed word. |

The missing System 303 `_I` entry and inactive Control-T binding below are findings
from comparing the parser's live tables with its inherited introductory comments.
They should not be silently restored on the authority of the comments alone.

### Direct command keys

These are all direct operations installed by the System 303 command loop, plus the
parser-level exits and selectors required to use them:

| Input | Effect |
| --- | --- |
| `/` | Open and examine the accumulated register address; remember it as the open location. |
| Return | Deposit a supplied value into the open location, close it, and end the line. With no value it only closes. |
| Line Feed | Deposit if needed, close, then open the next register. |
| Up Arrow | Deposit if needed, close, then open the preceding register. |
| Space or `+` | Preserve the accumulated argument so another number or operator can extend the expression. |
| Page / Control-L | Clear the page and request a status-display refresh. |
| `=` | Save a supplied value as the last value, then print it numerically. |
| `G` | Write the starting-address register from the accumulated value. |
| Control-N | Single-step once by default; a prefix supplies the step register's count or stop address. |
| Control-R | Reset the target with zero or the supplied value. |
| `Q` | Return the last value plus zero or the supplied prefix. |
| Control-S | Stop the target, invalidate cached saved state, refresh Q-field interpretation, and redisplay status. |
| Control-P | Run until the target stops or input arrives, then stop it and refresh cached state. |
| Tab | Treat the supplied or last value as a Lisp pointer and open its virtual-memory address. |
| `105 FOOBAR` | Historical bootstrap shorthand: reset, set start address 1, and proceed. Other arguments print an error. |
| Altmode | Leave the CC loop for Lisp. |
| `.` | Reuse the last open register address. |

System 46 additionally binds Control-T to a remote-console relay; Control-S leaves
that relay. In System 303 the function remains but its `CC-COMMAND` property form is
commented out. `:HERE` and `:THERE` still choose which console path `:P` uses.

### All System 303 colon commands

The audit found 44 unique colon commands across the released System 303 debugger
modules. `:/?` derives its own listing by scanning the live `CC-COLON-CMD` properties,
so this is the same namespace the program intends to expose.

| Command | Behavior and argument |
| --- | --- |
| `:/?` | Print the installed colon-command names. |
| `:AREAS` | Enumerate active areas, region chains, origins, lengths, free and GC pointers, representation, and space type. |
| `:AREA` | Identify the area containing the prefix or last value. |
| `:ATOM name` | Find a remote symbol in an explicit or current package and show its value, function, property list, and package cells. |
| `:MAPS` | Decode first- and second-level map entries for the prefix or last virtual address, including access, status, meta bits, and physical page. |
| `:CHECK-MAP` | Compare hardware map contents with the remote page-hash table. |
| `:MEMSTAT` | Summarize resident pages in contiguous groups with area and mapping attributes. |
| `:PHYS-MEM-WORD-SEARCH` | Search physical words for the prefix value. The implementation stops at 128K and permits keyboard abort; its own comment labels that bound temporary. |
| `:FLAGS` | Decode the prefix or remote `M-FLAGS`, including trap, MAR, paging, interrupt, scavenger, transporter, and stack-group state. |
| `:DESCRIBE-REGION-BITS` | Decode map access/status, oldspace and extra-PDL meta bits, representation, space type, scavenging, and swap-in quantum. |
| `:PCHECK` | Calculate the parity-checker outputs expected for the last examined value/control-memory word; the module says other memories remain future work. |
| `:STKP` | Print stack-frame information. A positive count limits frames; no count prints all; a negative count reads directly from the PDL buffer. Input aborts a long listing. |
| `:BAKTRACE`, `:BACKTRACE` | Synonyms for a backtrace without arguments. |
| `:TRACE` | Trace the selected/current stack group and print frame arguments. A count limits frames; a negative count selects direct PDL-buffer access. |
| `:TRACEN` | The same traversal without printing arguments. |
| `:RELPC` | Print the function referenced by `M-AP` and the location counter relative to that FEF when possible. |
| `:CODE` | Disassemble the currently executing FEF, normally centered around its relative PC; argument 1 suppresses centering. |
| `:DISASSEMBLE`, `:DISASSEMBLE-FEF` | Synonyms in System 303: if the last value is a FEF pointer, ask for a center PC or `NIL` and disassemble it. System 46 exposes only the latter name in `cc.516`. |
| `:PF` | Interpret the open register as a frame's LP-FEF word and decode its function, call, exit, entry, and additional-data-information words. |
| `:DESCRIBE` | Decode the last value when it is a stack group, closure/entity, FEF, or instance, including remote object metadata and instance slots. |
| `:HERE` | Arrange for `:P` to connect the target to the debugger host's ITS-style console path. |
| `:THERE` | Arrange for `:P` to use the debuggee's own console. |
| `:LISTB` | List permanent and temporary control-memory breakpoints. |
| `:B` | Set a permanent breakpoint at the prefix or open control-memory location. |
| `:TB` | Set a temporary breakpoint there. |
| `:TBP` | Set a temporary breakpoint and proceed. |
| `:G` | Set starting address 1 and continue through the selected console path. |
| `:P` | Proceed; afterward remove all temporary breakpoints. |
| `:UB` | Remove the breakpoint at the prefix or open location. |
| `:UAB` | Remove all permanent and temporary breakpoints. |
| `:INTOFF` | Disable target hardware interrupts and sequence breaks. |
| `:INTON` | Re-enable them. This command is absent from the public System 46 `cc.516` base file. |
| `:START` | Reset the target, write the supplied PC, issue startup clocks, and run. |
| `:EX` | Clock the machine once to execute the debug instruction register. |
| `:LOWLEVEL` | Prompt for `NIL`, `T`, or `VERY`. `T` favors current hardware over saved state; `VERY` tries to avoid save-modify-restore perturbation and exposes only passive state. |
| `:MODE` | Symbolically decode the target mode register or supplied argument. |
| `:CHMODE` | Interactively edit and write the mode register through the field descriptor. |
| `:RESTORE` | Restore the full saved software state into hardware. |
| `:SCOPE` | Repeatedly execute the debug instruction register at full speed until input, then leave debug mode stopped. |
| `:WHY` | Classify processor, parity, bus, main-memory, disk, PROM, or software-stop evidence; print the micro-PC history and a targeted analysis when possible. |
| `:WHYSOFT` | Analyze PROM or software crash state directly, including micro- and macrocode backtraces when recoverable. |
| `:MAIL` | Compose a hardware bug report containing generated crash analysis and a place for the operator's account. It is a reporting command, not a repair. |

Breakpoints demonstrate how close this console is to the machine. `CC-SET-BREAKPOINT`
does not maintain an abstract debugger table alone: it reads a control-memory word and
sets its two-bit MF field to the breakpoint form, refusing locations outside C memory
or instructions already using an incompatible MF value. Removing the breakpoint
restores the instruction. Likewise, `_U`, `:CHMODE`, and `:SCOPE` share a symbolic
field-description language that can both display and *write* hardware state.

## Remote Lisp inspection and crash analysis

The QF layer gives CC a constrained object reader for the other machine. It can walk
remote conses, symbols, arrays, FEFs, stack groups, page tables, and selected structure
layouts without asking the failed Lisp environment to execute a normal inspector.
This is how `:TRACE`, `:ATOM`, `:DESCRIBE`, and `:CODE` can produce Lisp-level output
from raw memory.

Later System 303 crash analysis combines several evidence streams:

- processor error flags and the eight old-PC registers;
- bus-interface status reached through the selected Busint, serial, or Chaos path;
- disk-controller status and error-log words;
- the matching MCR symbol and microcode error tables;
- the micro-return stack and the macrocode stack group;
- known bootstrap-PROM halt locations and selected instruction patterns.

`WHY` can therefore distinguish a main-memory parity event, internal processor parity,
a disk error, a PROM halt, and certain software `ILLOP` paths. It can identify memory
board and bank from an address, offer a parity sweep, recognize errors signalled through
the microcode trap path, and report cases it does not understand. The frequent guarded
operations and explicit apologies on analysis failure are important: the program is a
heuristic assistant over possibly corrupt state, not a proof-producing oracle.

The historical hardware guide also names `CC:SALVAGE-EDITOR`, which copies editor
buffers across the debug cable from a failed machine. That unusual feature illustrates
the value of separating debugger and debuggee: useful user state can sometimes be
recovered even when the target cannot run Zmacs or its error handler.

## Runtime and screenshot status

No screenshot is published for this dossier. The present Xvfb harness operates one
System 303 environment. A substantive CC screen requires that environment to control
a second, disposable debuggee with a defined Busint, serial, or Chaos debug transport.
Without that fixture, a CC entry failure, empty status display, or ordinary Listener
probe would not verify the application described here.

The console's normal operations are also state-changing: even status acquisition can
save, clock, and restore machine state; stop, reset, breakpoint, map, interrupt, mode,
load, and scope commands act directly on the target. The safe follow-up is a synthetic
second CADR instance or transport mock with a discardable disk and recorded initial
memory, followed by read-only address/format probes and an image-specific screenshot
rights review. Until then, visible layout and live command behavior remain an explicit
`TODO`, not inferred runtime fact.

## Preservation implications

- Preserve the microcode sources *and* their ordering. A flat concatenation loses the
  System 303 module and incremental-build boundaries.
- Preserve MCR, SYM, TBL, and error-table versions together. A runnable microload
  without its matching symbols is materially harder to analyze.
- Treat ULOAD and MCR as load images, not worlds. They encode processor memories and
  loader metadata rather than a complete Lisp heap or VM snapshot.
- Keep `CADREG` with both assembler and debugger evidence. Its constants define the
  shared address vocabulary and resolve stale prose comments.
- Record which command inventory belongs to which release. System 46's active
  Control-T and `_I` mode, and System 303's omitted bindings plus added crash-analysis
  commands, should not be flattened into a fictional timeless interface.
- Never test disk, interrupt, mode, bootstrap, or scope operations against the only
  preservation copy. A CC runtime study needs a disposable debuggee by design.

## Open questions

- Build a two-instance, discardable CC fixture and determine which debug transport can
  be emulated faithfully without changing the preserved base disk.
- Capture a reviewed status-display screenshot after verifying only bounded read paths,
  then test deposit, stepping, and breakpoint behavior on known synthetic words.
- Determine from change history why the maintained System 303 descriptor table dropped
  `_I` while its introductory comment retained it, and why Control-T was disabled.
- Compare the split System 303 microcode modules byte-for-byte with the final monolithic
  System 46 source to distinguish refactoring from functional changes.
- Recover and document the exact MCR, SYM, and TBL versions used by the museum's
  System 303 load band without modifying or redistributing unrelated band content.

## Local artifact records

These checksums identify the public files inspected locally; paths are portable names
within the cited source trees.

| Release | File | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| System 46 | `src/lispm/cadrlp.119` | 61,698 | `ae714e0cfbdb7f47df8a4e316c234c098fd08b2015596beba9ac269ab2b915a4` |
| System 46 | `src/lispm/cdmp.42` | 4,209 | `c646b63ae83078ae0f6e3748635d9cd041234cd26867a3dab78c03c46af5868e` |
| System 46 | `src/lcadr/qwmcr.13` | 4,974 | `e36c45899b3a8b9d0c0e83762e764d25ed2da693ee7d856fd116ccbfc1dede16` |
| System 46 | `src/lispm2/usymld.151` | 39,683 | `74b9a0ea2c1901b9d880af44b78c7e0b97c2059eecb4a43cbbec80ab9245cf93` |
| System 46 | `src/lispm/cadsym.23` | 17,649 | `153769d886a346fc9af35c06d698e431d6eda70624cb80193b859f166be4d7c5` |
| System 46 | `src/lmcons/cc.516` | 101,897 | `e81c03f764a6e7e6840c476508b25276fc91eefaae854ca474285c62e63e2b9e` |
| System 46 | `src/lcadr/ucadr.694` | 734,408 | `b9a175471817769b7e984e4e8d034671d8c6e86743204d11482b3957df138dc7` |
| System 303 | `l/sys/sys/cadrlp.lisp` | 72,401 | `1e4373d9fee4d273e95cc30ad3ff184e6f1d79294ba7df56c0d27436c3b0b848` |
| System 303 | `l/sys/sys/qwmcr.lisp` | 5,299 | `b6ec6e0f92d39c9c81a931ba889f5abf829b381daa84ded7c04cd04204f30521` |
| System 303 | `l/sys/sys2/usymld.lisp` | 50,362 | `03c44095b3cde0a64f26c08034fa0fd6a416ba93f65ffae991a92c32295634b4` |
| System 303 | `l/sys/ucadr/ucode.lisp` | 957 | `9c971c0fcde57aeb7186ca5146bd15d8b8e7431152095d50f8fc2cc122985aa9` |
| System 303 | `l/sys/cc/cc.lisp` | 121,322 | `5fc56a38592eff66f0d7d4cab632d80a3af82f827af3e49d1a3bdf1e551b836c` |
| System 303 | `l/sys/cc/lcadrd.lisp` | 61,952 | `7b4b46abf8245062cd5da659d2dcfd408ad3ead15c291a2cdedd43e54bdac2ad` |
| System 303 | `l/sys/cc/ccwhy.lisp` | 20,801 | `72b8718faa0f8dfa73206588d2c457b9f9cc2604de02b075c2f2e796a112ab2c` |
| System 303 | `l/sys/cc/cc.help` | 11,791 | `5239dc3a478659f801eb9adf08a90b69363ed150abea5de6c71457a70fc4b030` |

## Sources

- MIT CADR System 46, [`CADRLP`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/cadrlp.119),
  [`CDMP`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/cdmp.42),
  [`QWMCR`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lcadr/qwmcr.13), and
  [`USYMLD`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/usymld.151),
  revision `8e978d7`; verified 2026-07-18.
- MIT CADR System 46,
  [`UCADR.694`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lcadr/ucadr.694),
  [`CADSYM.23`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/cadsym.23),
  [`CC.516`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmcons/cc.516), and
  [`CADREG.10`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmcons/cadreg.10),
  revision `8e978d7`; verified 2026-07-18.
- LM-3 System 303,
  [`sysdcl.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`ucode.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/ucadr/ucode.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [`cadrlp.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/cadrlp.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- LM-3 System 303,
  [`qwmcr.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/qwmcr.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`usymld.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/usymld.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [`cadsym.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/cadsym.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- LM-3 System 303,
  [`cc.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/cc.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`lcadrd.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/lcadrd.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`ccwhy.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/ccwhy.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`chploc.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/chploc.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [`cc.help`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/cc.help?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.

Last verified: 2026-07-18.

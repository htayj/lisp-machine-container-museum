---
type: Architecture Note
title: Ivory, FEP, and Open Genera VLM implementation layers
description: A source-, manual-, and runtime-grounded account of the Ivory architecture, physical FEP and IFEP control planes, Open Genera Life Support and VLM, boot and debugger controls, architecture-specific compiler systems, and adjacent platform facilities, with a CADR comparison.
tags: [genera, open-genera, ivory, i-machine, fep, ifep, vlm, life-support, compiler, linker, boot, debugger, mit-cadr, lm-3]
timestamp: 2026-07-18T13:10:00-04:00
---

# Ivory, FEP, and Open Genera VLM implementation layers

Open Genera does not emulate a complete Symbolics workstation around an unchanged
disk image. It implements the Ivory instruction architecture in a host process,
loads a Genera world into tagged virtual memory, and supplies the services that a
physical workstation obtained from its front-end processor. The VLM is therefore
both narrower and more integrated than a conventional whole-machine virtual
machine: Lisp execution is Ivory-compatible, while bootstrapping, paging, disks,
network attachment, the Cold Load display, and host process integration are Life
Support services running on the host.

That distinction explains several otherwise confusing names in an Open Genera
world. `I-ARCHITECTURE`, `I-LISP-COMPILER`, and `I-LINKER` are genuine
architecture-specific Genera systems. `FEP-FS` can report as loaded because some
shared definitions and save-world support are useful on the VLM, but Open Genera
does not thereby acquire the physical IFEP's top-level command processor or its
disk-resident FEP filesystem. `NETBOOT-STUBS` deliberately replaces physical
netboot behavior on the VLM. `BUS-ACCESS` can be present as a system name without
creating a VME bus in the host process.

This is an architecture dossier, not an entry for a Programs-menu application.
It documents the execution layers, boot and control workflows, host switches and
configuration resources, physical FEP commands, IFEP/VLM Debugger controls,
platform conditions, and the adjacent keyboard, embedding, compression, and
encryption systems at the same command-level grain used by the editor dossiers.
It links rather than repeats the deeper accounts of [world and VLOD files](genera/world-loads-and-vlod.md),
[system construction](system-construction-patches-worlds-and-distribution.md),
[embedding](rpc-embedding-ux-and-macintosh-integration.md), and the
[Cold Load stream](emergency-break-and-cold-load-stream.md).

## Evidence labels, scope, and rights boundary

Statements are marked when their evidence class matters:

- **Fact — public architecture/manual:** stated by a public Symbolics manual or
  architecture specification.
- **Fact — source:** established by an exact public or licensed source witness.
  Licensed source is summarized in original words and identified only by portable
  metadata; it is not reproduced.
- **Observation — runtime:** seen in the recorded isolated Open Genera session.
- **Inference:** an interpretation that joins two or more facts without pretending
  the source says those words.
- **Open question/TODO:** evidence is incomplete, contradictory, or not yet safe
  to obtain.

The inspected Genera source and runtime media came from the locally purchased Open
Genera archive. The archive, source bodies, world, debugger, raw captures, and
private runtime remain untracked. This page publishes original analysis, short
interface names needed to identify controls, and checksums sufficient to repeat
the examination on a lawfully held copy. It does not publish recovered proprietary
code, documentation prose, glyphs, or world data.

The public VLM source used for structural cross-checking is a modern descendant,
not the exact source tree from which the local historical executable was built.
Its findings are therefore labeled as source structure, while claims about the
museum executable come from its own identity and the runtime record.

## The implementation stack

The smallest useful model has six layers. The middle three are sometimes all
called “the emulator,” but their responsibilities and evidence differ.

| Layer | Physical Ivory workstation | Open Genera on a host | Evidence-backed role |
| --- | --- | --- | --- |
| User systems | Genera applications and services | The same broad Genera software environment, subject to VLM/platform exclusions | Editors, listeners, compilers, file and network clients, and optional products |
| Genera runtime | Ivory-targeted Lisp world | Ivory-targeted Lisp world loaded from a VLOD | Tagged objects, scheduler, storage, packages, compiled code, application state |
| Instruction architecture | Ivory I-machine hardware | Ivory interpreter in the VLM | Executes tagged Ivory instructions and architecture-defined traps, calls, bindings, and memory operations |
| Front-end/Life Support | IFEP processor, FEP filesystem, device and console firmware | Host Life Support library and service threads | Boot, virtual disks, paging, network packets, console/Cold Load, message channels, and host integration |
| Machine peripherals | SCSI disks, Ethernet, keyboard/display, optional buses | Host files, TUN/TAP or equivalent network attachment, X11, host processes | Concrete storage, packets, display and keyboard events, and host services |
| Operator control plane | IFEP top level and IFEP Debugger | VLM process options, configuration resources, Cold Load window, and VLM Debugger | Starts, pauses, diagnoses, resumes, and terminates the machine environment |

**Inference:** Open Genera is best described as a paravirtualized Lisp-machine
environment, provided “paravirtualized” is used descriptively rather than as a
claim that Symbolics used the later term. Genera communicates through explicit
coprocessor and queue interfaces, and the host implements services directly,
rather than pretending to be every physical controller at the electrical level.

### What a VLOD contributes

A VLOD supplies the serialized tagged world state that Life Support maps into the
VLM's virtual memory. It is not a source archive and it is not, by itself, a host
process checkpoint. The world contains compiled functions, Lisp objects, system
registries, symbols, resources, and application state; the host still constructs
the process, communication areas, X connection, virtual disks, and network
attachment around it. See [World loads and VLOD](genera/world-loads-and-vlod.md)
for format and extraction details.

**Fact — public manual:** host swap space extends the VLM's virtual memory during
one run. It does not turn the world into a resumable snapshot after the host
process exits.

**Observation — runtime:** the current harness copies a base VLOD to a private
session path before launch and never invokes `Save World`. It records whether the
copy changed but does not infer that any change represents a successful in-guest
save.

## Ivory's execution contract

### Tagged words and object-aware memory

**Fact — public architecture:** an Ivory architectural word has 40 significant
bits: a two-bit CDR code, a six-bit data type, and a 32-bit pointer or immediate
field. The tag is not merely debugger metadata. Memory cycles, instruction
dispatch, forwarding, traps, and garbage-collector cooperation can depend on it.

The architecture presents one word-addressed virtual address space. The lower
31/32 of that space is mapped—3,968 megawords—while the upper 128 megawords is an
unmapped zone used for architectural purposes. Architectural pages contain 256
words. These are I-machine quantities; a host file offset or Unix virtual-memory
page must not be substituted for them in preservation notes.

### Instructions, calls, and dynamic state

Common instructions can be packed as two 18-bit halfword instructions in one
tagged word. Full-word instructions and constants coexist with that representation,
and CDR-code sequencing affects instruction flow. The architecture directly
supports operations that a conventional untagged processor would normally leave
entirely to a language runtime:

| Architectural facility | Consequence for Genera |
| --- | --- |
| Type-coded operands and memory cycles | Object type checks, forwarding, and traps can occur at the machine boundary |
| Function-call and return machinery | Compiled Lisp calling conventions are coupled to the architecture rather than only a host C ABI |
| Generic dispatch support | Flavor and generic-function dispatch can use architecture-aware operations |
| Binding and catch support | Dynamic bindings and nonlocal control transfer have explicit machine-level assistance |
| Stack groups | Multiple Lisp execution contexts fit the architecture's stack model |
| Stack and instruction caches | Frequently used stack and instruction state has architecture-defined fast paths |
| Trap vectors and processor state | Exceptional conditions enter Genera through a defined machine/runtime interface |
| Coprocessor reads and writes | Guest code can request host/Life Support operations with exactly-once side effects |

**Fact — public architecture:** coprocessor reads and writes are side-effecting
operations whose architectural handling is designed to avoid accidental replay.
This is central to the VLM boundary: a “write” can request a world save or another
host service, not merely update ordinary Lisp memory.

### Ivory is not CADR microcode

Ivory is a later instruction architecture, not the CADR's writable microcode
control store translated into software. Genera's `I-LISP-COMPILER` emits Ivory
instructions; it does not assemble CADR microinstructions. The exact CADR chain is
documented in [CADR microcode, microassembler, and console debugger](mit-cadr/cadr-microcode-microassembler-and-console-debugger.md).

## Architecture-specific Genera systems

The licensed Open Genera system declarations establish the following build-time
boundaries. “Loaded in the observed world” means only that the system registry
returned `:NEWEST`; it does not prove every optional hardware path is usable.

| System | Declared machine condition | Composition and role | Observed 2026-07-18 |
| --- | --- | --- | --- |
| `I-ARCHITECTURE` | `:IMACH`, `:VLM` | I-machine system-definition support, instruction set, and operator definitions | `:NEWEST` |
| `I-LISP-COMPILER` | `:IMACH`, `:VLM` | Architecture definitions, compiler internals, front end, transforms, phase 3, Ivory back end, disassembler, and compiler entry points | `:NEWEST` |
| `I-LINKER` | `:IMACH`, `:VLM` | Ivory linker module | `:NEWEST` |
| `LISP-COMPILER` | architecture-selected | Selects the I-Lisp compiler for an I-machine or VLM world | Not separately probed in this run; documented in the compiler dossier |
| `FEP-FS` | system is `:3600`, `:IMACH`; selected modules include `:VLM` | Physical FEP filesystem on workstations; shared FEP-block definitions and VLM save-world support on Open Genera | `:NEWEST` |
| `NETBOOT` | `:3600`, `:IMACH` | Physical network bootstrap implementation | `:NEWEST`, but this does not override its platform condition |
| `NETBOOT-STUBS` | `:VLM` | VLM replacement that declines physical netboot | `:NEWEST` |
| `BUS-ACCESS` | `:IMACH` | VME bus access utility subsystem | `:NEWEST`, with no inference of VME hardware on VLM |
| `COMPRESSION` | release system | File compressor, decompressor, preambles, resources, and Command Processor UI | `:NEWEST` |
| `ENCRYPTION` | release system | Historical encryption core, Hermes method, and Zmacs commands | `:NEWEST` |
| `EMBEDDING` | VLM-relevant | Communication buffers, queues, channels, remote programs, keyboards, and host integration | `:NEWEST` |

### Compiler and linker pipeline

**Fact — source:** `I-LISP-COMPILER` is not one file named “compiler.” Its declared
order moves from architecture and internal definitions through optimization and
front-end transforms to an Ivory-specific back end, disassembly, and public
compiler entry points. `I-LINKER` is separately declared, allowing architecture
linking machinery to be rebuilt and patched without treating the entire language
front end as the same component.

The practical user commands—compile a definition, region, buffer, or file; inspect
warnings; disassemble; and load compiled output—belong to the
[runtime/compiler dossier](lisp-runtime-compiler-and-development-environment.md).
At this layer the important fact is target selection: the release declaration
selects the I-machine compiler for `:IMACH` and `:VLM`, so an Open Genera world is
executing Ivory-targeted compiled objects rather than recompiling every function
to the host's native instruction set.

**Observation — runtime:** the observed world reported machine model
`Virtual Lisp Machine` and microcode description `Ivory`, version 5. Those values
are guest-visible identity claims. They do not prove a physical Ivory chip is
present.

## Physical FEP and IFEP

“FEP” names a front-end processor role. On Symbolics workstations it owns an
operator environment below Genera: it initializes hardware, finds and loads worlds,
manages paging-file declarations, exposes disk and device maintenance, supplies a
Cold Load/diagnostic path, and can enter a debugger when Lisp is unavailable.
Ivory workstations use an IFEP implementation appropriate to their architecture.

The physical FEP has two things that must not be inferred from an Open Genera
system name:

1. a FEP-resident filesystem containing boot, world, microcode, configuration, and
   diagnostic material; and
2. a top-level command processor capable of operating before or without Genera.

**Fact — source:** the inspected Open Genera source subset contains VLM-applicable
FEP block-layout definitions and a VLM save-world path. The physical FEP stream,
access path, band, and world-substrate modules are not selected into the VLM path.
The presence of `FEP-FS` in the runtime system registry is therefore compatibility
and shared machinery, not evidence of a hidden disk-resident IFEP.

### The physical FEP filesystem

The FEP filesystem is the boot processor's storage namespace, distinct from the
Lisp Machine File System that Genera presents to ordinary applications. FEP
pathnames conventionally name a unit such as `FEP0:` and a root-relative file.
The exact representation and available artifact types vary across the 3600 and
Ivory families, but the operator-visible roles are stable enough to distinguish:

| FEP-side material | Operator role |
| --- | --- |
| `hello.boot`, `boot.boot`, and autoboot command files | Establish hardware/network/site settings and then select paging, world load, and start actions |
| Overlay or `.flod` files | Add nonresident FEP command modules or device/diagnostic support to the command tree |
| World/load files, including Ivory `.ilod` examples | Supply the tagged Lisp world chosen by `Load World` or related boot options |
| Paging files, commonly shown with `.page` examples | Back Lisp virtual memory after `Declare Paging Files`/`Add Paging File` |
| Microcode and FEP programs on applicable physical families | Supply 3600 microcode or loadable front-end support; these are not VLM host binaries |
| Crash/diagnostic records | Retain low-level failure evidence for later inspection from Lisp or the front end |
| Label, disk-type, and known-world metadata | Tell the FEP how to interpret devices and which artifacts are boot candidates |

**Fact — public manual:** FEP pathnames merge missing fields against a contextual
default and are case-insensitive. Supplying a name or type selects the newest
version by default. On Ivory, completion and `.newest` selection skip deleted but
unexpunged versions; an operator can explicitly name a version and use
`Add World File` when recovering a deleted-but-not-overwritten world hierarchy.
That recovery capability is another reason not to expunge or rewrite unique media
during an exploratory session.

`Mount`, `Show Directory`, and `Show File` expose the filesystem to the front-end
operator. `Find World Files`, `Add World File`, and `Show World Files` manage the
bootable-world inventory. `Set Default Disk Unit` and `Set LMFS FSPT Unit` connect
later operations to physical units and the Lisp filesystem partition table. At the
destructive end, `Create Initial FEP Filesystem`, `Disk Format`, `Set Disk Label`,
and restore commands can replace the metadata on which bootability depends.

**Inference:** the FEP filesystem is better compared to a service/boot partition
with its own command environment than to the complete Genera filesystem. That
analogy is only operational: it does not imply a Unix partition layout or file
format.

### Physical FEP input model

**Fact — public manual:** at the physical prompt, `HELP` describes command input;
Control-`/` or Control-`?` requests completion or a list of possibilities, and
pathnames have completion support. Boot files can invoke command sequences and
load FEP overlays. On Ivory hardware, Control-Abort can stop supported long-running
operations. Older 3600 documentation often prints hyphenated command names where
Ivory material prints spaces; this dossier uses the spaced display names.

The physical command set below is complete at the Site Operations command-name
grain. It does not enumerate every release-dependent keyword of every hardware
diagnostic. Commands marked **destructive/high risk** should never be explored on
unique media.

### Ordinary boot and operating commands

| Command | Role | Safety classification |
| --- | --- | --- |
| `Add Paging File` | Add a paging file to the active declaration | Stateful storage configuration |
| `Boot` | Execute the configured boot sequence | Starts or replaces machine state |
| `Clear Machine` | Clear machine state before a new load | Destructive to unsaved state |
| `Clear Paging Files` | Remove current paging-file declarations | Stateful; can prevent startup |
| `Clear Screen` | Erase the FEP display | Display-only |
| `Continue` | Resume the interrupted machine | Resumes execution |
| `Debug` | Enter the FEP debugger | Pauses/changes control context |
| `Declare More Paging Files` | Extend paging-file declarations | Stateful storage configuration |
| `Declare Paging Files` | Establish paging files | Stateful storage configuration |
| `Enable IDS` | Enable IDS support | Changes diagnostic/runtime policy |
| `Hello` | Identify or greet the FEP environment | Read-only |
| `Initialize Hardware Tables` | Rebuild hardware-description tables | Hardware-state mutation |
| `Load Microcode` | Load processor microcode | Replaces execution substrate |
| `Load World` | Load a selected Lisp world | Replaces unsaved Lisp state |
| `Mount` | Mount a device or filesystem | Stateful device operation |
| `Netboot` | Boot through the physical network path | Replaces machine state; network-dependent |
| `Reset FEP` | Reset the front end | Destructive to FEP session state |
| `Scan` | Scan for bootable/loadable material | Primarily inspection; may exercise devices |
| `Set Boot Options` | Change boot behavior | Persistent or session configuration |
| `Set Chaos Address` | Set the Chaosnet address | Network-identity mutation |
| `Set Default Disk Unit` | Choose the implicit disk | Configuration; wrong value can redirect later writes |
| `Set Display-string` | Change FEP display identification | Configuration |
| `Set Ethernet Address` | Set Ethernet identity | Network-identity mutation |
| `Set LMFS FSPT Unit` | Select the LMFS filesystem-partition-table unit | Storage configuration; high consequence |
| `Set Network Address` | Set a network address | Network-identity mutation |
| `Set Prompt` | Change prompt text | Display/session configuration |
| `Show Directory` | List a FEP directory | Read-only |
| `Show File` | Display a FEP file | Read-only; avoid licensed prose in publication captures |
| `Show Paging Files` | Display paging declarations | Read-only |
| `Shutdown` | Shut down the machine environment | Terminates execution; unsaved-state risk |
| `Start` | Start or warm-start the selected world | Resumes or replaces execution state |

### Color and display/device commands

| Command | Role | Safety classification |
| --- | --- | --- |
| `Attach Graphics Tablet` | Attach the configured tablet | Hardware-state mutation |
| `Clear Color Background Screen` | Clear the color background display | Display-only |
| `Color` | Select color operation/display mode | Display-state mutation |
| `Detach Graphics Tablet` | Detach the tablet | Hardware-state mutation |
| `Load Color Sync Program` | Load color-display synchronization support | Reconfigures display hardware |
| `Monochrome` | Select monochrome operation/display mode | Display-state mutation |
| `Set Color Monitor Type` | Select color monitor timing/type | Hardware configuration; wrong choice can lose display |
| `Set Console` | Select the console device | Control-path mutation |
| `Set Disk Label` | Modify a disk label | **Destructive/high risk** |
| `Set FEP Options` | Set front-end options | Configuration; effects depend on option |
| `Set Monitor Type` | Select monitor timing/type | Hardware configuration; wrong choice can lose display |
| `Show Disk Label` | Display disk-label data | Read-only |

`Set Disk Label`, despite appearing in the manual's color/platform grouping, is a
storage mutation and is classified by effect here rather than by chapter placement.

### Maintenance commands

| Command | Role | Safety classification |
| --- | --- | --- |
| `Add World File` | Add a world to the boot/world inventory | Stateful filesystem mutation |
| `Autoboot Delay` | Change automatic-boot delay | Boot-policy configuration |
| `Clear Command Tree` | Clear loaded FEP command overlays/tree | Stateful; can remove available controls until reload |
| `Clear World Files` | Clear the known-world inventory | **High risk** to bootability |
| `Compute Microcode Default` | Compute the 3600 microcode default | 3600-only maintenance calculation |
| `Create Initial FEP Filesystem` | Create an Ivory FEP filesystem | **Destructive/high risk; Ivory-only** |
| `Disable IDS` | Disable IDS support | Diagnostic/runtime policy mutation |
| `Disable Load To Paging Migration` | Disable load-to-paging migration | Storage/performance policy mutation |
| `Dismount` | Dismount a device/filesystem | Stateful; pending-use risk |
| `Enable Load To Paging Migration` | Enable load-to-paging migration | Storage/performance policy mutation |
| `Find All World Files` | Search all relevant media for worlds | Inspection with device I/O |
| `Find World Files` | Search configured media for worlds | Inspection with device I/O |
| `Load Sync Program` | Load display synchronization program | Reconfigures display hardware |
| `Reset Device` | Reset a selected device | Stateful; may interrupt I/O |
| `Reset Most` | Reset most machine/FEP state | **Destructive to unsaved state** |
| `Reset Video` | Reset video hardware | Display-state mutation |
| `Retension Cartridge Tape` | Retension tape media | Mechanical media operation; wear risk |
| `Set Monitor Type` | Set monitor type | Hardware configuration; also listed with display commands |
| `Set World To Netboot` | Select a world for network boot | Boot-policy mutation |
| `Show Command Modules` | List loaded FEP command modules | Read-only |
| `Show Configuration` | Display FEP/machine configuration | Read-only |
| `Show Disk Label` | Display a disk label | Read-only; also listed with display/platform commands |
| `Show Ethernet Address` | Display Ethernet identity | Read-only |
| `Show LMFS FSPT Unit` | Display selected LMFS FSPT unit | Read-only |
| `Show Serial` | Display serial identity/state | Read-only |
| `Show Status` | Display front-end status | Read-only |
| `Show Version` | Display FEP version | Read-only |
| `Show World Files` | Display known world files | Read-only |

### Expert and diagnostic commands

| Command | Role | Safety classification |
| --- | --- | --- |
| `Add Disk Type` | Add a disk geometry/type definition | Configuration; wrong geometry can make later writes destructive |
| `Clear Disk Counters` | Reset disk statistics | Diagnostic-state mutation |
| `Clear Disk Types` | Clear disk type definitions | **High risk** to disk usability |
| `Copy File` | Copy a FEP file | Writes destination; overwrite/version risk |
| `Debug` | Enter debugger | Control-context change; duplicate manual listing |
| `Disk Format` | Format a disk | **Destructive/high risk** |
| `Disk Restore` | Restore a disk from backup/media | **Destructive/high risk** to destination |
| `Enable Trap Handling` | Change low-level trap handling | Expert runtime mutation |
| `Load Complete World` | Load a complete world image | Replaces unsaved machine state |
| `Load FEP` | Load a FEP image | Replaces the front-end substrate |
| `Set Disk Type` | Assign disk geometry/type | **High consequence** if wrong |
| `Set Lisp Release` | Select Lisp release identity/default | Boot/load policy mutation |
| `Set Wired Addresses` | Set wired address ranges | Expert memory-layout mutation |
| `Show Disk Types` | Display disk-type definitions | Read-only |
| `Test A Memory` | Test a selected memory | Diagnostic; may be destructive depending on mode |
| `Test All` | Run broad hardware tests | Potentially destructive and long-running |
| `Test Location` | Test a selected memory location | Potentially mutating |
| `Test Disks` | Test disks | Media risk; mode-dependent writes |
| `Test Simple Main Memory` | Run simple main-memory test | Potentially destructive to memory state |
| `Test Main Memory` | Run main-memory diagnostics | Potentially destructive to memory state |

**Safety conclusion:** the `Show` family, directory scan, version, and status
commands are the preferred museum probes on duplicate physical media. Formatting,
filesystem creation, disk-label/type mutation, restore, memory tests, FEP loads,
and state-clearing commands require expendable copies and a recovery plan. None of
these physical commands should be typed into an Open Genera Lisp Listener merely
because a similarly named Genera command exists.

### FEP-related Genera Command Processor commands

These commands run from a Lisp Listener's Command Processor while Genera is
alive. They reach or prepare the physical FEP; they are not additional commands at
the FEP prompt. The direct surface in Site Operations is:

| Command | Direct arguments and options | Role and safety |
| --- | --- | --- |
| `Add Paging File` | Pathname; `:Prepend` Yes/No, default No | Add an existing FEP file as paging space; prepending makes it eligible immediately |
| `Create FEP File` | FEP file specification (default `FEP:>temporary.temp`); required size in FEP blocks | Allocate a FEP file, commonly paging or world-copy space; writes filesystem metadata |
| `Copy Flod Files` | `:Automatic`, `:Create Hello File`, `:Disk Unit`, `:From Directory`, `:Hosts`, `:Silent`, `:Version` | Install overlay files and, on Ivory, a consistent FEP kernel/backup; can rewrite boot support on one or more hosts |
| `Copy Microcode` | Version or pathname, destination; `:Update Boot File` | 3600-only microcode installation; changes the next boot substrate |
| `Copy World` | Source and destination; `:Automatic`, `:End Block`, `:File Set`, `:More Processing`, `:Output Destination`, `:Query`, `:Show Blocks Copied`, `:Start Block`, `:Transfer Mode`, `:Update Boot File` | Copy a complete/IDS world hierarchy or netboot core, optionally transfer-and-checksum and update boot policy; destination writes are high consequence |
| `Halt Machine` | No direct arguments | Stop Lisp and transfer control to the physical FEP; unsaved state remains at risk |
| `Show Machine Configuration` | Host; `:More Processing`, `:Output Destination` | Read board-level information for a reachable Symbolics machine; can disclose serial/network identifiers in captures |
| `Show Crash Data` | `:Interpreted`, `:Output Destination` | Recover the last FEP status/crash record into the new/current Lisp world; read-only until redirected to a file/buffer |

The world suffix is platform-significant: the manual identifies `.load` for
3600-family worlds and `.ilod` for Ivory worlds and restricts copies to compatible
families. `Copy World` also knows the parent relationship of Incremental Disk Save
worlds; it is not a raw one-file copy when parents are requested. Detailed world
construction and distribution behavior belongs in the
[system-construction dossier](system-construction-patches-worlds-and-distribution.md).

The manual also connects crash evidence to Zmacs `Insert Crash Data`, which inserts
the recovered record into the current editor buffer or a report. A museum capture
should show only the minimum synthetic or already-public diagnostic fields needed
for analysis; board serials, addresses, stack contents, and licensed report prose
must not be published by default.

### FEP-related maintainer functions

These are programmatic maintenance entry points rather than ordinary commands, but
they bound what the manual exposes beyond the Command Processor:

| Function | Role | Safety |
| --- | --- | --- |
| `si:fix-fep-block` | Diagnose one FEP block by unit/cylinder/head/sector and optionally perform a write-read repair | **Potentially destructive**; can splice, zero, replace, or delete affected file data; never use on LMFS |
| `si:fix-fep-file` | Apply the block diagnosis/repair workflow to every block in one FEP file | **Potentially destructive**; never use on LMFS |
| `si:machine-model` | Return machine-model identity and serial/revision values | Read-only, but identifiers may be sensitive in captures |
| `si:verify-fep-filesystem` | Verify a unit; `:fix-checkwords` can Ask, Yes, No, Silently, or Inform Only | Use `Inform Only`/No for preservation inspection; other modes write repairs |
| `si:print-fep-filesystem` | Print a textual description of a unit, default 0 | Read-only but may reveal filenames/site state |

**Observation — runtime:** `si:machine-model` returned `Virtual Lisp Machine` in
the recorded Open Genera session. The numeric identity was deliberately not
published. The FEP block/file repair functions were not invoked on the VLM.

## Open Genera Life Support and communication areas

Open Genera replaces the physical FEP's implementation with a host Life Support
layer. The public VLM source divides that work into initialization and termination,
world and virtual-disk handling, paging, network, console/Cold Load support, host
file and process facilities, and message-channel service.

### Defined communication regions

The modern public source declares four fixed communication regions in Ivory
address space:

| Region | Address | Declared size | Role visible in the source |
| --- | ---: | ---: | --- |
| Boot communication area | `0xFFFE0000` | 64 words | Initial boot parameters and host/guest handshake |
| Boot data area | `0xFFFE0040` | 64 words | Additional boot data immediately following BootComm |
| Embedded communication area | starts `0xFFFE0080` | at most `0x1FF80` words (130,944) | Shared embedded queues, buffers, and host service records |
| FEP communication area | `0xF8041000` | 256 words | FEP-compatible guest/Life Support interface records |
| System communication area | `0xF8041100` | 256 words | System-level guest/Life Support records |

**Fact — source:** structures and queue fields cover virtual disk, console, network,
RPC, SCSI, Cold Load, host-file, and command channels. The FEP-named area is a
compatibility ABI between guest code and Life Support.

**Inference:** retaining an address and structure named `FEPComm` lets Ivory-era
Genera code speak a familiar control protocol without requiring an actual IFEP
processor. It is an interface seam, not a simulated proof of physical hardware.

### Host process initialization sequence

The modern public `main` path establishes this order:

1. build configuration from defaults, files, and command-line values;
2. initialize the Ivory processor and Life Support;
3. load the world image;
4. load the VLM Debugger;
5. establish virtual-memory and world bounds;
6. initialize processor state; and
7. enter the instruction sequencer.

Termination is coordinated through a dedicated signal-wait path and Life Support
teardown. This public design does not establish that every historical binary exits
cleanly on every guest state; the current museum runtime observation below proves
a bounded forced stop in one paused-state case.

### Main display versus Cold Load display

The main Genera display is guest X11 traffic relayed through the VLM. The Cold Load
display is a separate Life Support control window used by the VLM Debugger and
early/failure states. They have independent display, geometry, iconic, foreground,
background, border-color, and border-width configuration resources.

The [Genera computer-use harness](genera/genera-computer-use-harness.md) protects
this boundary carefully. Its compatibility layer modifies only pinned, byte-exact
X11 requests needed by this old VLM on the isolated Xvfb and delegates other bytes
unchanged. It does not interpose world, TAP, arbitrary file, or unrelated socket
I/O.

## Starting Open Genera from the host

### Command-line switches

The public Open Genera guide documents these host controls. The table is complete
at the documented switch-name grain; build-conditional developer switches are
separated afterward.

| Switch | Value/role | Consequence or caution |
| --- | --- | --- |
| `-spy` | Yes/No, default No | Enables the obsolete remote spy/debug facility; exposes a powerful surface unsuitable for an untrusted network |
| `-diagnostic` | Hostname | Names the diagnostic host and is required by the guide when Spy is enabled |
| `-world` | Pathname | Chooses the primary licensed VLOD input |
| `-debugger` | Pathname | Chooses the low-level VLM Debugger image |
| `-network` | `SPECIFICATION`, or `UNIT,SPECIFICATION` with unit 0 through 7 | First form defines unit 0; binds each guest-visible network interface to configured host support |
| `-vm` | Megabytes; manual default 200 MB/40 megawords | Controls total host memory/swap limit including the loaded world; `:Continue` after a size halt raises the limit 25% |
| `-ids` | Yes/No, default No | Controls permission to **save** IDS worlds; booting an IDS remains possible when disabled |
| `-searchpath` | Colon-separated path | Sets the additional ancestor-world search path used when booting an IDS |
| `-display` | X display; defaults from `DISPLAY`, then local host | X11 target for the Genera screen |
| `-geometry` | Main window geometry | Size and placement |
| `-iconic` | Yes/No, default No | Starts the main window visible by default |
| `-foreground`, `-fg` | Main foreground color | Presentation only |
| `-background`, `-bg` | Main background color | Presentation only |
| `-bordercolor`, `-bd` | Main border color | Presentation only |
| `-borderwidth`, `-bw` | Main border width | Presentation only |
| `-coldloaddisplay`, `-cld` | Cold Load display; defaults to main display | X11 target for debugger/early console |
| `-coldloadgeometry`, `-clg` | Cold Load geometry | Size and placement |
| `-coldloadiconic`, `-cli` | Yes/No, default Yes | Starts Cold Load iconified by default and can hide the only useful failure display |
| `-coldloadforeground`, `-clfg` | Cold Load foreground color | Presentation only |
| `-coldloadbackground`, `-clbg` | Cold Load background color | Presentation only |
| `-coldloadbordercolor`, `-clbd` | Cold Load border color | Presentation only |
| `-coldloadborderwidth`, `-clbw` | Cold Load border width | Presentation only |

The release-era guide describes `-network` using numbered units. The current
museum executable was instead launched with the later TUN/TAP form
`tun0:10.0.0.2;mask=255.255.255.0;gateway=10.0.0.1`, and the modern public fork
explicitly describes TUN/TAP support. **Observation plus source cross-check:** this
is a real interface evolution; it is not appropriate to silently rewrite the old
manual's numeric syntax as though both releases documented the same parser.

**Fact — source, modern fork:** the inspected current public descendant adds
`-testfunction`. It also contains `-trace` and `-tracePOST` paths only in tracing
builds.

**Observation — binary audit:** printable strings in the local 1,533,760-byte VLM
contain `-testfunction` but not exact `-trace` or `-tracePOST` strings. String
absence is not parser proof, so those tracing switches remain build-conditional
and unverified for this executable.

### Configuration files and resources

Configuration is applied in increasing precedence:

1. built-in defaults;
2. `/var/lib/symbolics/.VLM`;
3. `.VLM` in the user's home directory;
4. `.VLM` in the current working directory; and
5. command-line switches.

The syntax follows X-resource conventions. A specific `genera.` resource is more
specific than a wildcard `*` resource. The effective ancestor-world search path can
come from the built-in default, `WORLDPATH`, a `worldSearchPath` resource, or the
higher-precedence `-searchpath` command-line value. It changes lookup, not the
contents of a world.

| Resource | Host switch counterpart | Role |
| --- | --- | --- |
| `genera.spy` | `-spy` | Remote spy/debug enablement |
| `genera.diagnosticHost` | `-diagnostic` | Diagnostic host |
| `genera.world` | `-world` | World image |
| `genera.debugger` | `-debugger` | VLM Debugger image |
| `genera.network` | `-network` | Network unit |
| `genera.virtualMemory` | `-vm` | Virtual-memory size |
| `genera.enableIDS` | `-ids` | IDS policy |
| `genera.worldSearchPath` | `-searchpath`/`WORLDPATH` | World lookup path |
| `genera.main.display` | `-display` | Main X display |
| `genera.main.geometry` | `-geometry` | Main geometry |
| `genera.main.iconic` | `-iconic` | Main iconic startup |
| `genera.main.foregroundColor` | `-foreground`/`-fg` | Main foreground |
| `genera.main.backgroundColor` | `-background`/`-bg` | Main background |
| `genera.main.borderColor` | `-bordercolor`/`-bd` | Main border color |
| `genera.main.borderWidth` | `-borderwidth`/`-bw` | Main border width |
| `genera.coldLoad.display` | `-coldloaddisplay`/`-cld` | Cold Load X display |
| `genera.coldLoad.geometry` | `-coldloadgeometry`/`-clg` | Cold Load geometry |
| `genera.coldLoad.iconic` | `-coldloadiconic`/`-cli` | Cold Load iconic startup |
| `genera.coldLoad.foregroundColor` | `-coldloadforeground`/`-clfg` | Cold Load foreground |
| `genera.coldLoad.backgroundColor` | `-coldloadbackground`/`-clbg` | Cold Load background |
| `genera.coldLoad.borderColor` | `-coldloadbordercolor`/`-clbd` | Cold Load border color |
| `genera.coldLoad.borderWidth` | `-coldloadborderwidth`/`-clbw` | Cold Load border width |

The Open Genera manual's minimum/default sizing belongs to its release era. The
modern source enforces a 125 MB minimum, while the manual describes 200 MB as the
default. The museum harness explicitly requests `2048` in its isolated
configuration; the guest reported 409.0 megawords requested and 398.0 megawords
available. These quantities should be recorded, not normalized into an invented
single “canonical” size.

## Pausing, resuming, saving, and shutting down

Four operations that sound similar have different persistence semantics.

| Operation | Control surface | What survives | What it does not prove |
| --- | --- | --- | --- |
| Pause without shutdown | `Halt Genera :Shutdown No` | VLM process, guest memory, and session swap remain while the process lives | No world file is saved |
| Resume | VLM Debugger `:Start` or `:Continue`, depending on state | Continues the in-process guest | Does not reload unsaved state after process exit |
| Save World | Genera save-world path using the VLM coprocessor interface | Writes a selected world file when it completes successfully | A changed private VLOD hash alone is not proof of success |
| Shutdown/host exit | `Halt Genera` with shutdown or VLM Debugger `:Shutdown` | Only state explicitly persisted before exit | Host swap and unsaved guest objects are not a checkpoint |

### `Halt Genera` controls

| Keyword | Values | Default/meaning |
| --- | --- | --- |
| `:Logout` | Yes/No | Yes; controls logout before halt |
| `:Shutdown` | Yes/No | Yes; No pauses while retaining the live VLM process |
| `:Query` | Yes/No/Confirm Only | Yes; controls queries, with `Confirm Only` retaining final confirmation behavior |
| `:Delay` | `None` or time interval | Five minutes when active servers warrant delay; otherwise none |
| `:Reason` | String | Records an operator-supplied reason |
| `:Simulate` | Yes/No | No; exercises/simulates the halt path without claiming the real terminal effect |

**Observation — runtime:** this session executed
`Halt Genera :Logout No :Shutdown No :Query No :Delay None`. The main screen then
directed the operator to use the VLM Debugger `:Start` command to continue. This
verifies the pause path and those keyword spellings in the Open Genera 8.5 world.

**Fact — public manual:** if `:Start` encounters a bad process, a first retry tries
the remaining processes; a second retry resets the offending process. That is a
recovery rule, not a guarantee that application invariants survive.

## IFEP and VLM Debugger

The VLM Debugger uses the Cold Load window and intentionally resembles the IFEP
Debugger. It is an address-oriented DDT-style debugger, not a full Lisp evaluator.
The public Open Genera guide says it includes the IFEP Debugger commands and
accelerators, then adds a small VLM top level.

The physical IFEP Debugger uses its arrow-shaped prompt; the Open Genera prompt is
`VLM Debugger:`. Named full-form debugger commands are entered through the
documented colon/Meta-X command path, while the compact keys below act directly.
That surface resemblance does not create an IFEP top-level command processor in
Open Genera.

### Input and display conventions

- Numbers use the current base, initially octal in the documented debugger. With
  Control, Meta, Super, or Hyper modifiers, relevant numeric arguments use decimal.
- A numeric argument followed by a dot establishes the point. The input reader is
  not an arithmetic expression evaluator.
- Symbolic addresses accept register names such as `%REGISTER-...`; `#'` selects a
  function cell and `'` selects a symbol address.
- Backquote input supports Q, O, and S object/input forms.
- Segment modifiers are `@V`, `@P`, `@R`, and `@U` for the documented virtual,
  physical, region, and unmapped/address-space interpretations.
- Escape/lozenge acts as a command modifier that changes a second or default
  argument where the command defines one.

The typeout formats are complete at the documented one-character format grain:

| Format | Display interpretation |
| --- | --- |
| `'` | Character |
| `#` | Bit numbers |
| `A` | Array header |
| `C` | Control register |
| `E` | Error trap |
| `I` | Instruction |
| `O` | Integer in the current base |
| `Q` | Lisp pointer |
| `S` | Lisp object |

### Point stack accelerators

| Keys | Effect |
| --- | --- |
| Control-Space | Push the current point |
| Control-U Control-Space | Pop and make the popped point current |
| Control-U Control-U Control-Space | Pop and discard |
| `0` Control-Space | Display the point stack |
| Control-Meta-Space | Exchange top points; a numeric argument rotates |

### Stack display commands

| Command | Accelerator(s) | Direct arguments/options |
| --- | --- | --- |
| `Show Argument` | Control-Meta-A | Argument number |
| `Show Backtrace` | Control-B, Meta-B, Control-Meta-B | Detailed, number of frames, step |
| `Show Compiled Code` | Control-Meta-D, Control-X D, Control-X Control-D | Function, PC, radius |
| `Show Frame` | Control-L, Meta-L, Control-X Control-L, Control-X Control-A | Clear window, detailed |
| `Show Function` | Control-Meta-F | Current/selected frame function |
| `Show Local` | Control-Meta-L | Local index |

### Stack motion commands

| Command | Accelerator | Direct arguments/options |
| --- | --- | --- |
| `Bottom` | Meta-`>` | Move to bottom frame |
| `Find Frame` | Control-S | Search string, detailed, reverse |
| `Next` | Control-N, Meta-N | Detailed, number of frames |
| `Previous` | Control-P, Meta-P | Detailed, number of frames |
| `Top` | Meta-`<` | Move to top frame |

### DDT location commands

| Command | Accelerator(s) | Role and options | Safety |
| --- | --- | --- | --- |
| `Describe Location` | `=` | Address, print-location choice, segment | Read-only |
| `Set Location Contents` | `^`, Return, Line, Space, or Backspace when a location is open and an argument is supplied | Set address, tag, or pointer; forwarding, format, segment, and then-show options | **Mutates halted world**; normally confirms, with the documented repeated-confirmation override requiring care |
| `Set Typeout Format` | Command form | Change subsequent display format | Debugger-session state only |
| `Show Location Contents` | `/`, `^`, Tab, Line, Space, Backspace | Show selected address with format and segment controls | Read-only unless confused with the set form |
| `Show Value in Format` | `;` | Display supplied tag/pointer in selected format | Read-only |

The same `^` character participates in context-dependent open-location behavior;
the operator must verify whether a location and argument are active before typing.
This is exactly the kind of compact debugger convention that makes casual
exploration unsafe.

### Lisp-object and address-description commands

| Command | Role | Safety |
| --- | --- | --- |
| `Describe Area` | Describe an area object/layout | Read-only |
| `Describe Physical Address` | Decode a physical address | Read-only |
| `Describe Region` | Describe a region | Read-only |
| `Describe Virtual Address` | Decode a virtual address | Read-only |
| `Symbol Function` | Find/show a symbol's function cell | Read-only |
| `Symbol Value` | Find/show a symbol's value cell | Read-only |

### Miscellaneous debugger commands

| Command | Accelerator | Arguments/options | Safety |
| --- | --- | --- | --- |
| `Abort` | Control-Z or Abort | Cancel current debugger operation | Control-flow change only |
| `Accelerator Help` | Control-Help | Describe accelerator keys | Read-only |
| `Debug Process` | Command form | Process, show-initial-frame choice | Changes examination context; does not by itself repair process |
| `Mail Bug Report` | Control-M | Number of frames, output destination | Writes/sends report; physical default can be a FEP crash file |
| `Set Base` | Command form | Numeric display/input base | Debugger-session state |
| `Set Debugger Options` | Command form | Follow Forwarding, Name Heuristication, Print Errors, Print Length, Print Level | Debugger-session state; affects interpretation/output |
| `Set Default Segment` | Command form | Segment | Debugger-session state |
| `Set Package` | Command form | Package for symbolic lookup | Debugger-session state |

**Open question/TODO:** verify whether `Mail Bug Report` in this Open Genera build
offers a host pathname destination or only release-era destinations. Do not send a
report or publish crash content merely to answer that question.

### VLM-only top-level commands

| Command | Role | Safety |
| --- | --- | --- |
| `:Continue` | Continue stopped Ivory execution | Resumes and mutates runtime state |
| `:Show Version` | Show VLM Debugger/version identity | Read-only |
| `:Shutdown` | Terminate the VLM | Destroys unsaved state |
| `:Start` | Start or warm-start Genera; resumes a pause made by `Halt Genera :Shutdown No` | Resumes/mutates runtime; retry can reset a bad process |
| `:Show Status` | Show virtual-machine status | Read-only |
| `:Clear Screen` | Erase the Cold Load display | Display-only |

**Open question/TODO — exact runtime capture:** extend the computer-use harness
window selector so an action can explicitly target the mapped Cold Load/VLM
Debugger window instead of always preferring the main Genera window. In a fresh
private session, pause with the verified `Halt Genera` form, capture `:Show Version`
and `:Show Status`, then use `:Start` and verify the listener resumes. Record the
ordered input ledger and review the specific image under the screenshot-publication
policy before adding it. No tracked screenshot is substituted here because the
current harness could not safely focus that window.

## Netboot, bus access, keyboard, and embedding

These facilities meet at the architecture boundary but are not interchangeable.

### Physical netboot versus VLM stubs

**Fact — source:** the full `NETBOOT` system is declared for physical 3600 and
I-machine targets. The VLM instead loads `NETBOOT-STUBS`. In the inspected stub,
the predicates and entry point that would request or perform netboot return false
or no action, while a required Ethernet-related constant remains defined for
compatibility.

**Conclusion:** Open Genera can use networking after host Life Support supplies an
interface, but it does not run the physical FEP netboot workflow. A loaded
`NETBOOT` registry entry must not be converted into a claim that the VLM fetched
its VLOD over the wire.

### Bus access

**Fact — source:** `BUS-ACCESS` is a utility subsystem conditioned for `:IMACH`
and names a VME-bus implementation. The corresponding VME implementation source
is absent from the inspected distributed subset, and no VME device is exposed by
the isolated VLM harness.

**Open question:** whether a particular physical Ivory model and release supported
each bus operation requires that model's hardware manual and the missing source
witness. Runtime `:NEWEST` status on VLM is insufficient evidence.

### Keyboard translation

The low-level keyboard system translates host/console key identities into the
Symbolics modifier and character model expected by Genera. Its declared source
includes keyboard layouts and PC keyboard support; the host X modifier map is
therefore part of the execution contract, not merely an aesthetic preference.

The user-facing Keyboard Control activity—inspect, test, compare, edit, revert,
print, and serialize mappings—is fully documented in
[RPC, embedding, UX, and Macintosh integration](rpc-embedding-ux-and-macintosh-integration.md).
This page records only the architecture consequence: a VLM can execute Ivory code
correctly while still being unusable if host keycodes/modifier maps do not satisfy
the expected translation layer.

### Embedding and host channels

The embedded communication area supports queues, buffers, message channels, host
files/processes, RPC, and remote-program services. That is a deliberate host
integration API, not evidence that the guest can access arbitrary host memory.
The museum harness narrows it further with namespaces, a private runtime tree,
read-only exact inputs/helpers, no external route, and no guest-visible file
service.

For transport agents, exported APIs, Keyboard Control, UX, MacIvory, HyperCard,
Mac-Dex, and platform exclusions, use the dedicated
[embedding dossier](rpc-embedding-ux-and-macintosh-integration.md).

## Compression and encryption at the platform boundary

Compression and encryption are ordinary Genera systems rather than I-machine
instructions, but their source declarations and user commands are adjacent to the
world/file pipeline and easy to misclassify as VLOD features. They operate on
files or editor buffers; they do not make a VLOD into an encrypted VM snapshot.

### `Compress File`

`Compress File` is installed in the File Command Processor table. Its direct
surface is:

| Argument | Choices/default | Effect |
| --- | --- | --- |
| Input files | One or more pathnames; wildcards supported | Compress each eligible file; directories and links are skipped |
| Destination | Destination pathname/directory | Select output location and version behavior |
| `Copy Properties` | Author, Creation, Both; default Both | Preserve selected source metadata |
| `Create Directories` | Yes, Error, Query; default Query | Create missing destination directories or stop/ask |
| `Translation Strategy` | Text, Binary, Query, Heuristicate | Choose byte/text treatment; default can be derived or Query |
| `Query` | Yes, No, Ask; default No, with Yes as an explicit mentioned value | Control per-file confirmation |
| `Preamble Type` | Symbolics (default), UNIX | Select compressed-file preamble/interchange convention |

Errors are handled per file rather than requiring the entire wildcard operation to
be described as atomic. Output can acquire a new file version, and copied metadata
and preamble choice are part of the artifact's provenance.

**Fact — source / possible defect:** the inspected UI definition for the
`Heuristicate` choice in `Compress File` supplies the internal value
`:DOCUMENTATION`, while the downstream translation logic expects
`:HEURISTICATE`. The decompression command maps that choice consistently. This is
a source-visible mismatch, not yet a proven runtime bug.

**TODO:** on scratch public-domain files in a private world, invoke `Compress File`
with `Translation Strategy Heuristicate`, record the actual accepted value and
output, and avoid publishing any licensed input or compressed derivative.

### `Decompress File`

| Argument | Choices/default | Effect |
| --- | --- | --- |
| Input files | One or more compressed pathnames; wildcards supported | Decompress eligible files; directories and links are skipped |
| Destination | Destination pathname/directory | Select output location/version |
| `Copy Properties` | Author, Creation, Both; default Both | Preserve selected metadata |
| `Create Directories` | Yes, Error, Query; default Query | Missing-directory policy |
| `Translation Strategy` | Text, Binary, Query, Heuristicate | Select output translation; this UI maps Heuristicate to the expected internal value |
| `Query` | Yes, No, Ask; default No | Per-file confirmation policy |

`Decompress File` obtains preamble/format information from the input; it therefore
does not expose the compressor's `Preamble Type` choice.

### Zmacs buffer encryption

The encryption system defines two direct Zmacs commands:

| Command | Prompt and scope | Observable/editor effect |
| --- | --- | --- |
| `Encrypt Buffer` | Hidden key entered twice for confirmation | Replaces the entire buffer under a write lock and records an undoable editor change |
| `Decrypt Buffer` | Hidden key entered once | Replaces the entire buffer under a write lock and records an undoable editor change |

**Fact — source:** the inspected implementation offers the historical Hermes
method through these commands. The algorithm is not reproduced here.

**Safety conclusion:** these facilities are historical compatibility and
preservation subjects, not modern confidentiality recommendations. An undo record
and hidden prompt do not establish contemporary cryptographic strength, secure key
erasure, authenticated encryption, or safe handling of secrets in editor swap or
world state. Zmail's separate encryption surface belongs in the
[Zmail command dossier](genera/zmail-commands-and-bindings.md).

## Platform and dependency matrix

| Facility | Physical 3600 | Physical Ivory | Open Genera VLM | Required external condition |
| --- | --- | --- | --- | --- |
| CADR microcode/console control | No; CADR family is separate | No | No | CADR/LM-3 hardware or `usim`, public load band, console harness |
| Ivory instruction execution | No | Ivory hardware | VLM Ivory interpreter | Correct world and architecture-compatible debugger/runtime |
| Physical FEP filesystem | 3600 FEP form | IFEP form | No physical filesystem; compatibility/shared definitions only | Physical boot media and FEP implementation |
| FEP/IFEP command top level | Yes | Yes | Replaced by host launch plus VLM Debugger | Physical console or Cold Load X window |
| Life Support | Not under that Open Genera host name | Physical front-end services | Host library/threads | Supported host ABI, world, debugger, virtual disks, X, network setup |
| Full physical netboot | Yes when configured | Yes when configured | Stubbed out | Boot server, interface, addresses, boot files |
| VME bus access | Model/release dependent | Declared I-machine utility | No bus exposed by museum harness | Appropriate physical bus and implementation |
| Main Genera display | Workstation console | Workstation console | Guest X stream relayed through VLM | Compatible X server and modifier map |
| Cold Load/debug display | FEP console | IFEP console | Separate VLM Cold Load X window | Compatible X server; correct window focus |
| Embedding/RPC channels | Platform/system dependent | Supported by embedding systems | Host/Life Support shared channel | Matching host-side service and allowed transport |
| Save World | Physical FEP/disk path | Physical FEP/disk path | Coprocessor request writes host-selected world file | Writable private destination, sufficient space, successful completion |
| Compression/encryption | Release dependent | Release system | Present in observed world | Source/destination access; historical format expectations |

## Boot and control workflows compared

### Physical Ivory workflow

1. IFEP initializes or verifies hardware and its filesystem.
2. Operator/autoboot policy selects boot options, microcode/processor support, world,
   paging files, and network/device configuration.
3. IFEP loads the world and starts Genera.
4. A halt or fatal failure can return control to IFEP/IFEP Debugger.
5. Operator may inspect, continue/start, load another world, or shut down.

Exact order varies by workstation model, release, and boot file. The command tables
above describe capabilities, not a universal recipe for unique museum hardware.

### Open Genera workflow

1. Host configuration selects the VLOD, VLM Debugger, memory, displays, search path,
   and network unit.
2. The host starts the VLM and Life Support, maps communication regions, and loads
   the world/debugger.
3. The Ivory interpreter executes Genera while Life Support services explicit
   queues and coprocessor requests.
4. `Halt Genera :Shutdown No` pauses to the VLM Debugger without writing a world.
5. `:Start` resumes the still-live process; `:Shutdown` terminates it; a separate
   successful Save World is required for a persistent new VLOD.

### Recovery hierarchy

Use the least invasive level that can answer the question:

1. inspect status/version and capture read-only evidence;
2. pause and resume without memory edits;
3. debug a selected process or examine addresses;
4. reset only a demonstrably bad process;
5. load a fresh private world;
6. mutate debugger locations, device structures, or boot media only on expendable
   copies with an exact rollback plan.

## Comparison with MIT CADR and LM-3

The CADR comparison is architectural, not a claim of direct source lineage.

| Concern | CADR/System 46 and LM-3 System 303 | Ivory/Open Genera |
| --- | --- | --- |
| Processor definition | Writable CADR microcode assembled from Lisp-family source | Fixed I-machine architecture implemented in Ivory hardware or VLM interpreter |
| Compiler target | CADR macroinstructions/microcoded operations | Ivory instructions from `I-LISP-COMPILER` |
| Low-level build artifacts | Microcode source to assembler products such as MCR and symbol tables | Architecture/compiler/linker systems plus world and VLM Debugger |
| Operator debugger | Separate console `CC` controls a CADR debuggee through console interfaces | Physical IFEP Debugger or VLM Debugger/Cold Load controls Ivory execution |
| Boot artifact | Load band plus microcode/emulator state | VLOD world plus debugger, Life Support configuration, and VLM process |
| Host emulator | Public `usim` emulates CADR hardware at the repository's runnable System 303 boundary | VLM interprets Ivory and directly supplies Life Support services |
| Front-end analogy | Console/debug and emulator substrate; not an Ivory IFEP filesystem | Physical FEP/IFEP on hardware, replaced by Life Support on VLM |

**Fact — public source:** public MIT System 46 at Git revision
`8e978d7d1704096a63edd4386a3b8326a2e584af` contains a monolithic `UCADR`
microprogram and its assembler/load tooling. Maintained LM-3 System 303 at Fossil
check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`
declares a 23-module `UCODE` system and later console/debug layers.

The maintained LM-3 tree is a restoration branch, not evidence that every later
file belonged to MIT System 46. Conversely, the System 46 snapshot is not a
behavioral specification for the runnable System 303 load band. The
[CADR microcode and console dossier](mit-cadr/cadr-microcode-microassembler-and-console-debugger.md)
keeps those revisions and command surfaces separate, and the
[CADR computer-use harness](mit-cadr/cadr-computer-use-harness.md) records actual
System 303 observations.

## Recorded Open Genera runtime observation

### Session and results

The ignored session was named
`d52-ivory-vlm-layers-20260718`, generation 1. It ran in the isolated Genera
computer-use harness from 2026-07-18 12:21:47 through 12:30:07 EDT.

| Probe | Exact observation | Interpretation boundary |
| --- | --- | --- |
| Initial listener | Open Genera 2.0; Genera 8.5; Genera program 9.0; DEC OSF/1 V127; 409.0M words requested, 398.0M available | Guest release and configured identity, not a configured Symbolics site |
| Main window | Title `Genera on DIS-LOCAL-HOST`; site unconfigured and servers disabled | Isolated museum state, not production network behavior |
| Machine model | `Virtual Lisp Machine` | Guest-visible model |
| Microcode description | `Ivory`, version 5 | Guest-visible architecture identity, not a physical chip |
| System registry | `I-ARCHITECTURE`, `I-LISP-COMPILER`, `I-LINKER`, `FEP-FS`, `NETBOOT`, `NETBOOT-STUBS`, `BUS-ACCESS`, `COMPRESSION`, `ENCRYPTION`, and `EMBEDDING` each returned `:NEWEST` | Loaded registry status, not proof that platform-excluded hardware paths work |
| Pause | `Halt Genera :Logout No :Shutdown No :Query No :Delay None` produced an instruction to use VLM Debugger `:Start` | Verifies pause workflow; no save occurred |

The complete action ledger includes failed/partial delivery of one overlong probe
and a subsequent input-clear recovery. Claims in the table rely only on successful
forms whose output was visible. The ordered action/outcome record has SHA-256
`7cf61cc0d2d1c049c09ba6f721d3e5f7e2b788b47310d0d10283ca554e25b1ad`.

### Execution environment and provenance

The runtime facts above are joined deliberately from the generation-level
`run.json`, ordered action ledger, and capture sidecars. A screenshot sidecar does
not claim to contain the execution-time VLM hash; that value comes from the run
record.

| Evidence item | Recorded value |
| --- | --- |
| Session/generation | `d52-ivory-vlm-layers-20260718`, generation 1 |
| Base and private VLOD at start | 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`; private matched base |
| Private VLOD at stop | SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`; unchanged during run |
| VLM Debugger | 346,880 bytes; SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| VLM executable at start and execution | 1,533,760 bytes; SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| Private `.VLM` | 285 bytes; SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`; requested virtual memory 2048 and IDS enabled |
| `ifconfig` compatibility preload | execution SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`; source SHA-256 `a4d126dbb6fd6f4903835bbb41c39652cfc53c91e942267dc9166c1c938c36e7` |
| X compatibility preload | execution SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`; source SHA-256 `4db1dee8e71d5ddc5cfd8289ecc3607738370ac97f856853786cfe713e94e392` |
| Harness entry/Python/helper | entry SHA-256 `e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05`; Python harness `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; VLM helper `cbf9ee0520b4892325266ed17afba8f1b663e7d266fea6d80de9cf98de17d2f8` |
| Isolation | Bubblewrap user, mount, network, PID, IPC, and hostname namespaces; host root hidden; exact X socket and read-only Guix store/helpers exposed; private runtime writable |
| Network | private `tun0`; host `10.0.0.1/24`, guest `10.0.0.2/24`; no default/external route; no guest-visible host file service |
| X server | Xvfb `1440x1100x24`; MIT-SHM disabled and live-verified absent; exact guest X substitutions observed before `running` |
| Window candidates | Cold Load XID `2097154`, `1024x768`, title `INTERNET` + vertical bar + `10.0.0.2 Cold Load Stream`; main XID `4194310`, `1200x900`, title `Genera on DIS-LOCAL-HOST`; harness selected main |
| RFC 868 responder | source/execution SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`; request frame `99436b7cb2393ba0d8b1691a9393b2bfdd7a33d7fc976461e721bb074542710c`; reply frame `a02e38e95ad2cd8b18444d258e37e2145f4edd0591ff06fdb9856fce2fc5465b`; one reply; responder exit status 0 |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`; Python 3.11.14; Xorg server 21.1.21; Bubblewrap 0.11.0; ImageMagick 6.9.13-5 |

The local VLM is an x86-64 ELF for Linux, contains debugging information, is not
stripped, and carries a GCC 3.4.5 compiler comment. These binary properties help
separate it from the modern public source head; they do not by themselves identify
an exact historical commit.

### Shutdown result

The harness stop began after Genera was already paused. It observed the shutdown
prompt and sent `yes`, but did not observe accepted confirmation or cleanup
progress. It therefore used its bounded forced stop and recorded:

- `forced_stop: true`;
- `forced_after_confirmed_shutdown_stall: false`;
- `state_may_be_incomplete: true`;
- private world unchanged; and
- `save_world_performed` and `guest_checkpoint_created` not established.

**Observation boundary:** this is not the separately documented running-state
cleanup path where the current public VLM begins cleanup and later stalls at a
Cold Load channel mutex. Here, confirmation acceptance itself was not observed.
The session is evidence for this exact paused-state run only, and it must not be
called an orderly shutdown.

### Screenshot status

Four raw local captures document the machine/architecture probe, implementation
system states, and pause message. They remain under ignored session storage:

| Capture | PNG SHA-256 | Pixel SHA-256 |
| --- | --- | --- |
| `0008-machine-and-ivory-runtime.png` | `f812bae98f3d430b8abee4fae9075ddc08e9a774de67de788d1cdaf5242a2e9a` | `8e16257350fff4d0869a76fbfb6ef409c3417eda31004e8e197c30fcfd1fc650` |
| `0009-implementation-layer-versions.png` | `89870e1cc266fc8d49cff5bdd830d21d1e9096f5b79586cb0ad0e13b1c5603de` | `b864846c346f2dc9accad0881ba4274a712cc8c6618f9cb541a4d9d3478b38a2` |
| `0010-implementation-layer-loaded-states.png` | `a2eef9ebdc89291dea7deaad6d9961c167487f1daaa8d2e402188edb185b77a3` | `f023882a99d80878269152f9bc5813c33dab23fbc71a3dfbd9dffc061249c1f0` |
| `0011-after-halt-request.png` | `657641e08c446c8333c89beffe67459a98776ab284357f2bb9cf666245e99dbc` | `619832e79ea747a2a77451d15c0a5c2ceacee0894f85a026be92dcc5f6d11e84` |

These are raw, unreviewed local evidence rather than curated assets. Before
publication, review a capture-specific scholarly need and crop, and record every
required run/configuration/input field in the curated catalog. A visible
architecture page would normally embed a reviewed runtime image; this page instead
ships with the explicit blocker because the central control surface—the Cold Load
window—was not safely selectable through the current harness.

## Failure modes and preservation safety

| Failure or confusion | Why it happens | Safe response |
| --- | --- | --- |
| Treating `FEP-FS :NEWEST` as a physical FEP | Shared definitions/save-world support retain the system name | Check machine conditions and module selection; describe VLM Life Support separately |
| Expecting `NETBOOT` to fetch the VLOD | Registry names coexist with VLM stubs | Inspect `NETBOOT-STUBS`; treat host-selected world path as the boot source |
| Enabling `-spy` for convenience | Old remote debugger sounds like a harmless status tool | Keep it disabled on untrusted networks; use isolated local harness evidence |
| Treating host swap as a checkpoint | Paused state survives while the process runs | Save a world explicitly and verify completion; never infer from swap existence |
| Calling forced termination orderly | Guest may accept a prompt or begin cleanup before host deadlock/timeout | Preserve every shutdown stage and forced-stop flag separately |
| Typing `Set Location Contents` while exploring | Compact DDT accelerators are context sensitive | Prefer `Show`/`Describe`; use memory mutation only on disposable copies |
| Running physical disk tests on unique media | Some diagnostics write or depend on mode | Image media first, use write blockers where possible, and test expendable copies |
| Assuming bus/system presence means hardware presence | Release worlds can retain declarations and loaded systems | Require device enumeration, source platform branch, and runtime operation evidence |
| Publishing Cold Load or Help screens wholesale | Control surfaces can expose licensed prose or diagnostic state | Capture only the minimum claim-bearing state and complete per-image rights review |
| Recommending Hermes encryption today | Historical UI resembles a current security feature | Describe for compatibility only; use modern authenticated encryption outside the museum system |

## Open questions and next evidence tasks

1. **VLM Debugger runtime:** add explicit Cold Load window selection to the harness,
   then verify `:Show Version`, `:Show Status`, and `:Start` with a fresh private VLOD.
2. **Screenshot publication:** review one minimal Cold Load/VLM Debugger capture and,
   if justified, add it with full portable provenance. Do not publish a gallery.
3. **Physical IFEP variants:** obtain model-specific Ivory manuals and compare the
   exact command/keyword differences across XL, NXP, MacIvory, and 3600 FEPs.
4. **Bus access witness:** locate an authoritative licensed or public implementation
   witness for the declared VME subsystem before documenting individual operations.
5. **Compression mismatch:** test `Heuristicate` only on scratch public-domain input
   and determine whether the UI mismatch is repaired elsewhere at runtime.
6. **Bug-report destination:** inspect the VLM Debugger's `Mail Bug Report` choices
   without transmitting or publishing crash contents.
7. **Historical VLM lineage:** identify the exact source revision/build recipe for
   the local GCC 3.4.5 executable; do not equate it with the modern public fork.

## Portable provenance

### Licensed local artifact set

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Purchased `opengenera2.tar.bz2` archive | 206,213,430 | `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base Open Genera world used for the private copy | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| VLM Debugger image | 346,880 | `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Local VLM executable | 1,533,760 | `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |

The ignored session's `run.json` also records configuration SHA-256
`5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`,
the exact execution-time VLM hash, private-copy hashes, harness-source hashes,
toolchain provenance, namespaces and network mode, and shutdown flags. The files
themselves must not be distributed. A curated screenshot must carry the applicable
full values into its tracked asset catalog rather than relying only on this table.

The extracted licensed `sys.sct` tree contained 5,075 files totaling 174,490,231
bytes. Selected source witnesses were:

| Relative witness | Bytes | SHA-256 | Claim supported |
| --- | ---: | --- | --- |
| `sys/sysdcl.lisp.~1059~` | 39,497 | `3bb5fad39feb2d174c53b94ea7b726a6f3fa3de1ec18a1293352bb68027c1584` | Top-level system composition and platform branches |
| `sys/utility-sysdcl.lisp.~133~` | 8,922 | `fa1a9008314855cc991457131fbcb5b46a8746db5aa22078abf7f7911e81baa0` | Utility-system declarations including bus access |
| `i-compiler/i-instruction-set.lisp.~12~` | 12,511 | `3a61307ca198cdd6eba22a3b968a2a2f6943a1abeec64406840225c59bcfd84e` | I-machine instruction definitions |
| `i-compiler/i-sysdef-support.lisp.~31~` | 17,534 | `71497a87540ec456a48438926a9575142aeeb3d7e6bcf4eec8ef82c9a6781d40` | I-machine system-definition support |
| `i-compiler/i-back-end.lisp.~371~` | 201,796 | `f7e0aaf936f5a58cbc126dcaa6ec4101dc2434ef88841905ff6c1ac3732452e4` | Ivory compiler back end |
| `i-compiler/disassemble.lisp.~60~` | 96,339 | `ff4870f426cfbfa8d5db15fc76143548ffbf6174fbfa617ecaa7779f7d7a7e8a` | I-machine disassembler |
| `i-sys/opdef.lisp.~103~` | 23,508 | `45a1b07f28b3f90f8de743dda0b89c6cc170720eb97f7f1a02291e62ecdbd7ea` | Architecture operator definitions |
| `i-sys/sysdef.lisp.~253~` | 91,492 | `d599bbfd90da6d656e4eb087bc2d7716f3b88c7ba06b1168b18c2e65f95f4566` | I-system declarations |
| `i-sys/sysdf1.lisp.~156~` | 56,542 | `9c449e686e3273d9f28fb4a4ad8e524a4307002c5d4e658f82659b195e8b54d3` | Architecture system grouping |
| `i-sys/linker.lisp.~26~` | 43,322 | `4ca72746d580673de732289bf8b3c2850de4d3b1a946033afb5dc9f71a27e71d` | I-linker implementation |
| `l-sys/deffepblock.lisp.~1~` | 5,922 | `c73693076929ea8905c3f0cf7e3bc8236f1e76c7d05e8ec37be0cf281e56b55b` | FEP-block layout definitions |
| `l-sys/disk-save.lisp.~158~` | 55,040 | `4709ea266a71715b0138a32b1e4eaa72afc9b832e39c86999aab2472ef99fcf9` | Physical/VLM save-world branches |
| `netboot/i-netboot-stubs.lisp.~2~` | 3,072 | `c46be84841fccf780ba6e00954e4cf4542ed7462a28ef63736e065dcb0c0e427` | VLM netboot no-op behavior |
| `compression/user-interface.lisp.~6~` | 23,689 | `25c54724d725f342be44a809d9528353a17cf077e051dcc0259af66fd484a382` | Compression/decompression command surface and mismatch |
| `encryption/core.lisp` witness | 8,788 | `52143f47725590d7e0f3273eb1ac78e2d562ba9615403572c82025cecd78fc48` | Encryption system core |
| `encryption/hermes.lisp` witness | 20,042 | `4de2400d0f0b493878d0f50442f4ffc269a07c5de13e5bed4d82ba0d6acc2b7d` | Hermes method |
| `encryption/zmacs.lisp` witness | 5,912 | `7b91fc9435934ebb85f740e72eb1d09335ea8326e42c95f6e13ca6923e0b74e0` | Direct editor commands |
| `embedding/keyboards/keyboard-layout.lisp.~113~` | 20,458 | `b0127eca4cfe454da6808f8684daf966a15173b6b07983ffac0e1421bc88a40c` | Keyboard translation/layout layer |

The encryption witness labels are normalized descriptions because the exact local
versioned filenames are not publication-relevant. The byte size and hash, not the
shorthand label, identify the inspected file.

### Public VLM source cross-check

The public descendant was inspected at Git commit
[`55b2a3b1cf884f827d85829713587657c435cb29`](https://github.com/LdBeth/osx-vlm/tree/55b2a3b1cf884f827d85829713587657c435cb29),
verified 2026-07-18.

| Public file | SHA-256 | Structural claim |
| --- | --- | --- |
| `README.md` | `4891f1150744800432cc8df1760fe2211dbcae4e5e5cfade6c4b21499789b49b` | Fork/platform description and stated fixes/extensions |
| `COPYING` | `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` | Public fork license file |
| `src/main.c` | `3d2c095e4ad7ed21525377d08be36cb8626f86c2068be5e836da2437257712ab` | Host initialization and sequencer path |
| `src/utilities.c` | `33028c87a53afb0eb00a67c3223265db09ccb9a9e4133f9fcb956ae9f9a5ff26` | Host utilities/options support |
| `life-support/initialization.c` | `5d16a3bf3ab74000d36f5a72876d32d05b1cfbd30961926637a354983a6a597b` | Life Support initialization/teardown |
| `life-support/embed.h` | `133fccaeaac78c76697037a4f52caa0b844759f5818753cb39a4c8e28fbaf6d5` | Embedded communication layout |
| `emulator/interfac.c` | `b6b9b91719200a2154159083a58bb2455e2fc2942a2313a365197d86846fa3c8` | Emulator/Life Support interface |
| `emulator/ivory.h` | `8ce5fa316eaa5728495297818f0e10730b990b1bd1e500f0a4b70bc65b7b5a65` | Ivory processor structures/constants |
| `emulator/FEPComm.h` | `0126ec87c85c3f4ec0d76ef8543b47b8d240fb261154a55130943a8b439b194e` | FEP communication area |
| `emulator/SystemComm.h` | `4a72d3183e219fa148f44cac0e7c7c7634c21d835d30a5f4026899aad6299c26` | System communication area |
| `emulator/BootComm.h` | `e69ea3da2a6f2753f2b166174bf9bdc33b3e84e6c649e214bc4ecba3b9074e70` | Boot communication/data areas |

The fork describes itself as an x86-64 Linux VLM derived through Brad Parker's
work and includes TUN/TAP networking plus later fixes and extensions; its
`COPYING` file is GPL version 3. That lineage statement and license apply to the
public fork, not automatically to the licensed Symbolics world, VLM Debugger, or
local historical executable. The exact ancestry of that executable remains a TODO.

### Public manuals

Public manual PDFs were verified on 2026-07-18:

| Manual | SHA-256 | Use in this dossier |
| --- | --- | --- |
| [I-Machine Architecture Specification](https://bitsavers.org/pdf/symbolics/I_Machine/I-Machine_Architecture_Specification.pdf) | `b45cd026d6930e27f9830efefc9ab8d7f1da01dd030ab6adf876d56603b34a89` | Tagged word, address space, instructions, traps, coprocessor contract |
| [Open Genera User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf) | `174563f2e7939c990b7e730911e1b4d49f30f7a172e942c2e3a107d906625874` | VLM/Life Support layers, debugger, pause/start/shutdown behavior |
| [Open Genera Installation Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_Installation_Guide.pdf) | `0606a9ccab4b5c57c540e140692cdb45ea74523d2c73d44fa604f51dedf300b2` | Host options, resources, paths, memory sizing |
| [Site Operations](https://bitsavers.org/pdf/symbolics/software/genera_8/Site_Operations.pdf) | `6812c8f6131954751ce8f5ca281a451546d9e61e75b34af106971889a3f384f2` | Physical FEP/IFEP command and debugger inventories |
| [Macroinstruction Set](https://bitsavers.org/pdf/symbolics/I_Machine/Macroinstruction_Set.pdf) | `2d11aa2d43f1573ee741de7cfc6b892ecdddf7d20f175611f6cb78d02a551c5c` | Instruction-set cross-check |
| [Function Calling, Message Passing, and Stack Group Switching](https://bitsavers.org/pdf/symbolics/I_Machine/Function_Calling_Message_Passing_Stack_Group_Switching.pdf) | `933e8f6f4150c3587d69d8335e10f63322b1f1427598732e0d31f7f3839def9e` | Call and stack-group architectural context |

## Public source links

- Public VLM descendant:
  [`main.c`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/src/main.c),
  [`initialization.c`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/life-support/initialization.c),
  [`embed.h`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/life-support/embed.h),
  [`FEPComm.h`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/emulator/FEPComm.h), and
  [`BootComm.h`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/emulator/BootComm.h),
  commit `55b2a3b`; verified 2026-07-18.
- MIT CADR System 46 public source:
  [`UCADR`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lcadr/ucadr.694),
  [`CADRLP`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/cadrlp.119), and
  [`CC`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmcons/cc.516),
  revision `8e978d7`; verified 2026-07-18.
- Maintained LM-3 System 303:
  [`sysdcl.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`ucode.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/ucadr/ucode.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [`cc.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/cc/cc.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.

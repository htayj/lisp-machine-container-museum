---
type: Artifact Analysis
title: Open Genera world loads and the VLOD format
description: Structure, snapshot semantics, and practical extraction limits of Open Genera VLOD world files.
tags: [genera, open-genera, vlod, preservation]
timestamp: 2026-07-16T10:47:32-04:00
---

# Open Genera world loads and the VLOD format

## Bottom line

A `.vlod` is not an archive and it is not a mountable disk or file-system image. It is
a VLM world-load file: a purpose-built, cold-bootable image of Genera's tagged virtual
memory, accompanied by a map that tells the emulator which words belong at which
virtual addresses.

The closest familiar analogy is a Lisp heap or core image prepared for restart. It is
also reasonable to call it snapshot-like, but it is not an arbitrary live VM suspend
snapshot: Genera deliberately shuts down and makes the world cold before asking the
host-side VLM to write selected virtual-memory ranges.

| Question | VLOD answer |
| --- | --- |
| Can `tar`, `unzip`, or a filesystem driver list its files? | No |
| Does it preserve Genera code and data objects? | Yes, as tagged memory words |
| Is it loaded into the VLM's virtual memory and booted? | Yes |
| Does it contain a normal Unix or LMFS directory tree? | No |
| Can a save contain only changes from another world? | Yes, through Incremental Disk Save (IDS) |
| Can it be inspected without booting Genera? | Yes, with format-aware experimental tools |
| Does low-level inspection immediately recover source files? | No; object decoding is a separate problem |

## What Symbolics meant by a world load

The *Open Genera User's Guide* describes the Genera environment as one large virtual
memory space containing the code and data objects of all loaded applications. It then
defines a world load as a complete image of that environment, frozen when saved. The
manual also says that a world can be composed of several files using IDS and that a
saved world is not subsequently modified.

That definition makes the archive-versus-snapshot distinction fairly decisive. The
VLM's `-world` option loads the named Lisp world into memory and boots it; a separate
path names the VLM debugger image.

In the licensed Genera 8.5 source inspected locally, Genera's pathname table calls the
format `:V-COLD-LOAD` with canonical suffix `VLOD`. The public VLM source calls it a
“VLM world file (.VLOD).” No primary source found during this investigation gave a
reliable prose expansion of the four letters, so this page does not invent one.

## On-disk organization

The public VLM implementation documents and reads the format directly. A VLOD has:

- a format cookie and version/architecture word;
- counts and locations used to interpret the header;
- in VLOD version 2, generation and parent timestamps for incremental worlds;
- a load map describing destination virtual addresses, word counts, and operations;
- page payloads containing Genera's tagged Lisp words.

A load-map entry can load words from file pages, fill memory with a constant, fill it
with an incrementing constant, or copy an already loaded memory range. The header and
load map use the older Ivory file packing. For VLM page payloads, each Lisp “Q” has a
32-bit data part and an 8-bit tag/type-and-CDR field. A VLM page contains 8,192 Qs;
the file stores its data and tags in separate block ranges. This is why a generic
`file` utility sees opaque `data`, while the emulator can map the contents into the
correct tagged virtual-memory addresses.

The host-side save path receives address/extent pairs from Genera, canonicalizes them
into load-map entries, writes the header, then writes the corresponding memory pages.
Genera offers both a complete save of the world and an incremental save of changed
pages. When loading an incremental file, the emulator locates its ancestors and merges
their load maps before populating memory.

## Snapshot-like, but deliberately cold

“VM snapshot” is useful shorthand only with a qualifier. Inspection of the licensed
Genera 8.5 disk-save source shows that a VLOD captures the object world after a
controlled save sequence. Genera stops normal activity, runs shutdown-related
actions, identifies regions and active stack pages to preserve, excludes temporary
and page-table areas, marks the state cold, and invokes the VLM's save-world
coprocessor operation.

It therefore does not mean “every byte of the Unix process plus all host device and X11
state at an arbitrary instant.” Unix swap acquired after boot is explicitly session
state and is not part of the immutable world load. Booting reconstructs the mapped
Genera memory and then follows Genera's cold-start initialization path.

## What can be extracted meaningfully?

### Standard archive extraction: no

There is no member table containing pathnames and file payloads, and no filesystem to
mount. Renaming a VLOD or feeding it to an archive program will not expose Genera
sources or documentation.

Open Genera release media keeps these concerns separate. The world file is one
artifact; the `sys.sct` hierarchy contains separately stored Lisp sources, compiled
systems, and documentation. If the goal is to study distributed source or manuals,
the extracted `sys.sct` tree is far more useful than mining the heap image.

The licensed release inspected for this museum produced a `sys.sct` tree of 5,075
files totaling about 174.5 MB (166.4 MiB), including 1,794 Lisp-source files, 1,453
compiled `.vbin` files, and 801 `.sab` documentation files. These are ordinary host
files extracted from the release media around the world image, not members extracted
from the VLOD.

### Structural and object-oriented inspection: yes

The format is sufficiently documented in VLM source to parse. The experimental Common
Lisp project [`worldtool`](https://github.com/LdBeth/worldtool) currently supports
operations including:

- dumping VLOD/ILOD headers and load maps;
- reading tagged Qs by virtual address;
- producing annotated architectural-memory dumps when given layout data;
- scanning strings, packed symbol print names, and symbol values;
- exporting a parsed world and round-tripping it through a writer;
- emitting and experimenting with newly constructed cold worlds.

This is meaningful extraction, but at the level of a language runtime image. Turning
tagged words into packages, symbols, arrays, functions, classes, source locations, and
other high-level objects requires knowledge of Genera's object layouts. A tool can
recover many strings and symbols before it can reconstruct every object graph. Booting
the world and using Genera's own introspection and export facilities remains the most
mature route for high-level exploration.

For the specific boundary between original source, symbolic disassembly, executable
low-level Lisp, and recoverable font data, see
[Recovering code and assets from a Genera world](recovering-code-and-assets-from-worlds.md).

`worldtool` is active experimental research rather than a stable archival standard.
Pin a revision and validate results before building preservation workflows around it.

## Observation of the museum's Genera 8.5 world

The licensed `Genera-8-5.vlod` inspected locally has this reproducibility record:

- size: 54,804,480 bytes;
- SHA-256: `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`;
- VLOD cookie: `0xA38A8988`;
- VLM format version/architecture value: `0x00800081` (version 2);
- 6,690 VLM blocks and 114 wired load-map entries;
- 10,952,704 tagged Qs described by those entries, all using raw data-page loads;
- base-world generation number `0`, so this file does not require a parent world.

Using `worldtool` revision
[`a2fdcfd`](https://github.com/LdBeth/worldtool/commit/a2fdcfd68e24f42a6f0cba92f01585139a6b54cf),
the `dump` command decoded the header and virtual-address map. Its `symbols --min 24`
scan found 42,258 character-array strings and 1,126 packed print-name runs, including
recognizable build messages, command prompts, and documentation strings. That is
direct evidence that useful semantic material can be recovered offline, even though it
is not file extraction.

The distribution also includes smaller `inc-...from-Genera-8-5.vlod` files. Those are
incremental worlds whose names and headers associate them with a base world. They
cannot in general be treated as standalone complete images. For example, the bundled
`inc-clim-from-Genera-8-5.vlod` reports generation `1`, and its recorded parent
timestamp exactly matches the inspected base world's timestamp.

## Related artifacts

- `VLM_debugger` is a separate small world image loaded into VLM memory for crash
  handling. It is not an unpacking program.
- `.ilod` is the corresponding Ivory world-load format handled by the same VLM world
  code.
- `.vbin` files in the source hierarchy are compiled Genera load files, not VLOD
  members.
- CADR `.lod` load bands belong to an older and different machine lineage. Similar
  names do not imply the same container format.

## Sources

- Symbolics, [*Open Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf),
  “Controlling Open Genera,” especially PDF pages 5–7.
- Symbolics, [*Open Genera Installation Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_Installation_Guide.pdf),
  “Disk Space Requirements for Open Genera” and “Machines and Worlds.”
- VLM source,
  [`world_tools.h` at revision `55b2a3b`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/include/world_tools.h),
  for cookies, page sizes, load-map operations, and world metadata.
- VLM source,
  [`world_tools.c` at revision `55b2a3b`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/src/world_tools.c),
  for loading, saving, parent-map merging, and page layout.
- Experimental `worldtool`,
  [`vlod.lisp` at revision `a2fdcfd`](https://github.com/LdBeth/worldtool/blob/a2fdcfd68e24f42a6f0cba92f01585139a6b54cf/src/vlod.lisp)
  and
  [`cli.lisp` at the same revision](https://github.com/LdBeth/worldtool/blob/a2fdcfd68e24f42a6f0cba92f01585139a6b54cf/src/cli.lisp).
- Licensed Genera 8.5 source inspected locally: `sys.sct/io/pathnm.lisp.~882~`
  (pathname type), `sys.sct/l-sys/disk-save.lisp.~158~` (complete and incremental
  save flow and memory-range selection), and `sys.sct/i-sys/sysdf1.lisp.~156~`
  (save-world coprocessor structures and world metadata). These artifact-relative
  names record provenance without redistributing or linking the proprietary files.

Last verified: 2026-07-16.

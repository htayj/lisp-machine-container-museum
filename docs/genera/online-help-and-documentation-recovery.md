---
type: Artifact Analysis
title: Genera on-line help and documentation recovery
description: How Genera stores Document Examiner records and runtime help, and how to recover the licensed corpus locally without executing serialized code.
tags: [genera, document-examiner, sage, online-help, preservation]
timestamp: 2026-07-17T01:58:16-04:00
---

# Genera on-line help and documentation recovery

Genera's on-line documentation is not a world snapshot and is not one plain-text
manual. The installed release-media corpus includes 801 indexed Sage Binary (`.sab`)
databases used by the Document Examiner, two Teach Zmacs text files, and a standalone
Macsyma documentation database. Help frames, Zmacs, the Command Processor, and
`DOCUMENTATION` also generate material from program definitions and compiled
debugging information.

The tracked extractor recovers every `.sab` record and the three reviewed standalone
files from a licensed `sys.sct` tree into ignored local output. It also makes a
separately labelled static inventory of help-bearing Lisp forms. No extracted Genera
prose, title catalog, picture, byte array, tutorial, manual, or docstring is tracked by
this repository.

## What “on-line help” includes here

This audit uses *on-line* in its historical sense: information deliberately displayed
by the running system, not information obtained from the Internet.

| Layer | Storage or producer | Recovery status |
| --- | --- | --- |
| Document Examiner corpus | Versioned `.sab` files throughout `sys.sct` | Complete for the inspected Open Genera 2.0 tree: 801 files and 17,266 records decoded |
| Teach Zmacs | Two text files plus a Lisp command and keyboard macros | The interactive tutorial and its associated usage instructions are copied only to ignored local output |
| Macsyma Help and `DESCRIBE` | `engrman.mdoc`, read by the compiled Macsyma help subsystem | The standalone database is copied only to ignored local output; its compiled consumer is inventoried |
| Extended and program help | Help Program topic mappings plus the Sage topic index | The underlying SAB records are decoded; mappings are inventoried from source |
| Zmacs self-documentation | `DEFCOM` documentation, documentation functions, key tables, and the Teach Zmacs tutorial | Static source candidates are inventoried; a live command-table census remains a `TODO` |
| Command Processor and Dynamic Windows help | Command definitions, presentation arguments, and help-topic mappings | Static source candidates are inventoried; macro-expanded and runtime-installed entries remain a `TODO` |
| Lisp API self-documentation | Definition properties and compiled-function debugging information | Literal source candidates are inventoried; compiled-only world data remains a `TODO` |

Ordinary comments, bug mail, change logs, and print-only production files are not
classified as on-line help merely because they contain explanatory writing.

## The native documentation path

The release README directs a user to map the `SYS` logical host to the mounted
`sys.sct` tree and select the Document Examiner. That is direct distribution evidence
that these files, rather than prose embedded solely in the VLOD, are the installed
on-line manuals.

The implementation divides responsibility as follows:

- `sys.sct/doc/doc.lisp.~282~` defines the Documentation Database system and loads
  the documentation modules. Its inspected file is 22,273 bytes with SHA-256
  `8c3d644786827b7ba3b2b3a3f406a7387b77debe21b01f6176a75d283e304cc3`.
- `sys.sct/doc/defbooks.lisp.~137~` registers 46 books in this release. Its inspected
  file is 17,539 bytes with SHA-256
  `142078aacc52c6c397b832f93ed249843939d4aaa4a084271b62c786cfe5604d`.
- `sys.sct/nsage/ddex/examiner.lisp.~81~` implements the Standard and Small Document
  Examiner programs, including document, candidate, bookmark, and command panes. Its
  inspected file is 31,580 bytes with SHA-256
  `dece335c917703acf440812d857af0e3e1d03dfe2b8118d21efcf6bfe4c22654`.
- `sys.sct/dynamic-windows/help-program.lisp.~4013~` maps program, command, menu, and
  option help requests to Sage topics. `sys.sct/window/help-frame.lisp.~22~` supplies
  the pop-up frame used by system, function, symbol, and debugger help. The system
  definition in `sys.sct/sys/extended-help.lisp.~21~` assembles those facilities.
- `sys.sct/zwei/doc.lisp.~110~` defines Zmacs' separate self-documentation choices and
  the path to its interactive tutorial.

These are licensed local observations, not files distributed by this repository.

## Standalone installed help

Searching the installed non-SAB text-like files and then requiring program-consumer
evidence found three additional documentation payloads. The distinction in the last
column matters: one file is packaged with an online tutorial but no direct display
call for it was found.

| Logical pathname | Bytes | SHA-256 | Evidence-backed role |
| --- | ---: | --- | --- |
| `examples/teach-zmacs-master.text` | 32,452 | `734c5fb7abe5d7c761678547bee147a6b786839d2afe13122311b156d62ae646` | The `Teach Zmacs` command copies this text to the user's home directory and opens the copy in Zmacs |
| `examples/teach-zmacs-info.text` | 1,607 | `dd6cddf956fba6120cb934562718cc87e0722aca0fb9ba92bef3c884636a7bd8` | Usage instructions explicitly describing the online tutorial; distributed in the same text module, but a direct runtime display consumer is not proved |
| `contributed/macsyma-421/manual/engrman.mdoc` | 1,069,409 | `e0db5fd7482d5044d9d16f04aa800ff8fb3f14bf6385d85b68605b868e054098` | Documentation database read by Macsyma's `DESCRIBE` and hypertext Help machinery |

For Teach Zmacs, the consumer evidence is in
`sys.sct/examples/teach-zmacs.lisp.~4~`, while
`sys.sct/examples/sysdcl.lisp.~10~` distributes both text files. The inspected files
are respectively 2,446 bytes with SHA-256
`e72b6f305323473bf025f2646e8a6d1126afa22c174b46f1ec07343a5f4e0437` and
1,568 bytes with SHA-256
`94a31445ab601eb85442e4346406a5816b05cc035ac1fcd6d2f56b04396d27fe`.

The Macsyma consumer survives here only as compiled source-bearing VBin files.
`tools/nmudoc.vbin.~1~` assigns `macsyma:manual;engrman.mdoc` as its documentation
file, and `tools/lmhelp.vbin.~1~` contains the Help frame, topic indexer, and file
reader. They are 5,562 and 16,470 bytes, with SHA-256
`33dd164321e744415803e0a40854d43e3a31f9bfbd0d56605174d7aa2ac55604` and
`04be6a3304e797ecf60f6cb09e0ef552bce33ef2371c2498383f878aacbc0656`.
This is evidence from inert compiled-object inspection, not execution of Macsyma.

## What a Sage Binary file contains

An SAB is a purpose-built serialized document database. It is closer to a compiled,
indexed object file than to either a ZIP archive or a VM snapshot.

The inspected reader and writer establish this layout:

1. a four-byte Sage identifier, zero in these files;
2. a one-byte compiled-data version;
3. a typed file-attribute alist;
4. two little-endian 32-bit pointers;
5. a sequence of documentation records;
6. an index of record topics, types, identifiers, search tokens, cross-references,
   and other indexed fields.

SAB values use one-byte type codes followed by typed payloads. The format represents
symbols with a per-scope symbol table, thin and styled strings, lists, environments,
Sage commands and macros, cross-references, pictures, and arbitrary eight-bit arrays.
Distribution files use both format 6 and format 7; Genera's format-7 reader explicitly
accepts version 6.

Some SAB indexes carry explicit byte ranges for each record. The compact distribution
form instead points to one contiguous record sequence and omits the redundant range
fields. The extractor supports and validates both layouts. It never invokes the Lisp
reader: serialized reader forms and function specifications remain inert source
strings.

Primary local format evidence is in:

- `sys.sct/nsage/install.lisp.~211~`, 38,973 bytes, SHA-256
  `f5f9e70fb024355a647173aaa5a113079043e18c54d964706b510f377cacf66e`;
- `sys.sct/nsage/sab-file.lisp.~122~`, 65,391 bytes, SHA-256
  `e8c40e1fd6705959c549083aafbaa22e969e0fbebb468c50502b1ee90a3e0685`;
- `sys.sct/concordia/indexer.lisp.~268~`, which writes record bodies and their indexes.

## Reproducible local extraction

From the repository root, with the purchased media prepared by the normal Open Genera
workflow:

```sh
python3 scripts/extract-genera-help.py \
  --sys-sct .lm-home/opengenera/runtime/sys.sct \
  --output build/help/genera \
  --clean
```

The ignored output contains:

- `catalog.json`: per-file hashes, selected Genera versions, record counts, format
  versions, normalized output paths, and aggregate provenance;
- `json/**/*.json`: structured, content-preserving decoded attributes, indexes,
  records, styled-text runs, references, and base64 byte arrays; the JSON is not a
  byte-for-byte round-trip representation of SAB symbol-table and reference layout;
- `text/**/*.txt`: convenience renderings that turn known Lisp Machine Return, Tab,
  and named key characters into readable host text without assigning unknown glyphs
  a false Unicode identity;
- `standalone/raw/**`: byte-for-byte local copies of the three reviewed standalone
  files, plus `standalone/text/**` convenience renderings;
- `lisp-source-help.jsonl`: exact local source spans for literal definition
  docstrings, Zmacs command documentation, command and option definitions, and forms
  bearing known Help or documentation registrations.

Use `--skip-lisp-source` when the native databases and standalone help are wanted
without the static Lisp inventory. Existing extractor-owned output requires
`--clean`; an unrecognized file, directory, or symbolic link anywhere in the
destination makes the script stop rather than delete it.

## Verified result for this release

The full local run completed without an SAB parse error:

- 801 logical SAB files in 102 directories;
- 53,186,374 source bytes;
- 17,266 documentation records;
- 800 format-7 files and one format-6 file;
- 285 styled strings;
- 850 picture directives;
- 937 embedded byte arrays containing 18,931,775 bytes.

The standalone pass selected three logical files totaling 1,103,468 bytes. Two have
direct runtime consumers; the Teach Zmacs usage file is retained as an explicitly
labelled associated-documentation candidate. The extractor's logical-path, NUL, and
binary-digest manifest framing gives SHA-256
`6a5043d68f03f4ab41eaed496e6fcf420bd45a18c43d48509c0bc9f2c0230fcf` for these
three files.

A sorted manifest in the form `SHA256  relative/physical/path` is 84,308 bytes and has
SHA-256 `21ac9a83a196357c98dadbbbd96c14040f3d8db08446479f240b40b874d4501e`.
The extractor's catalog uses a different unambiguous binary framing—logical path,
NUL, then the 32-byte digest—and records its corresponding manifest hash. These are
manifest digests, not hashes of a concatenated proprietary corpus.

The source pass selected 1,766 logical Lisp files from 1,794 versioned physical files
and recorded 7,809 candidate forms. The overlapping category counts are:

- 1,970 API-docstring candidates;
- 839 Zmacs `DEFCOM` documentation forms;
- 1,465 command or option definitions;
- 3,984 explicit Help or documentation forms.

Four version-controlled sources contain unmatched raw parentheses, including edit
journals and patch-oriented source forms that are not a balanced current source view:

- `joshua/examples/planning-examples.lisp`: one unmatched close;
- `version-control/compare-merge/compare-merge.lisp`: eleven unmatched closes;
- `version-control/compare-merge/editor-interfaces.lisp`: three unmatched opens and
  twenty-five unmatched closes;
- `version-control/patches/patches.lisp`: one unmatched close.

The catalog records both directions of imbalance instead of silently claiming the
static pass parsed these files semantically.

## Completeness boundary

The 801-file statement is a complete claim for native SABs below this exact `sys.sct`
root. The standalone list is the result of a consumer-backed audit of installed
text-like files, not a proof that no optional or dynamically named help database can
ever exist. Neither claim means that 17,266 records equal every string a running
Genera can show as help.

The running system can derive additional documentation from command tables, key
tables, flavor and class metadata, symbol properties, compiled-function debugging
information, optional systems, patches, and runtime mutation. Reader conditionals and
macros also mean a lexical source inventory cannot determine exactly what one world
loaded. A future high-confidence world audit should enumerate those registries in the
running world, compare them with this filesystem extraction, and retain disagreements.

## Rights and preservation boundary

The Open Genera media marks its software, data, and information as proprietary and
refers use and copying to a written license agreement that is not included in the
inspected tree. The expiration language in a government-rights notice is not evidence
that the material became public domain.

Consequently:

- keep all SAB files, standalone payloads, and decoded output under ignored
  `build/help/genera/`;
- do not commit topic/title catalogs, prose, pictures, byte arrays, or extracted
  docstrings;
- track only the original extractor, tests, non-content counts and hashes, and this
  independently written technical description.

This is the same preservation rule used for recovered Genera fonts: reproducibility
without redistributing licensed expression.

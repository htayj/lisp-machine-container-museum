---
type: Artifact Analysis
title: MIT CADR on-line help and documentation recovery
description: How CADR software constructs in-program help from source declarations, generated editor listings, key tables, and application handlers, with a tracked System 46 recovery corpus.
tags: [mit-cadr, lm-3, zwei, online-help, source-recovery, preservation]
timestamp: 2026-07-17T04:15:00-04:00
---

# MIT CADR on-line help and documentation recovery

MIT CADR System 46 does not have one help archive analogous to Genera's Sage Binary
databases. Its on-line help is mostly live program metadata: ZWEI command
documentation, Lisp function docstrings, flavor documentation, keyboard tables, and
application-specific Help handlers. A few standalone and generated ZWEI files sit
alongside that source.

The tracked recovery contains 949 help-bearing declarations in 944 exact source
contexts from 89 files, plus four standalone or generated files. It preserves public
System 46 source rather than reconstructing the final state of a particular load band.
The full machine-readable inventory and recovered forms are in the
[generated catalog](../assets/mit-cadr-online-help/catalog.md).

## What “on-line help” means in this audit

*On-line* has its historical meaning here: documentation deliberately reachable from
the running program. The audit includes a source construct when at least one of these
conditions holds:

1. a runtime command explicitly opens or displays the file;
2. ZWEI registers it as command, mode, option, key, or self-documentation metadata;
3. the Lisp `DOCUMENTATION` path can retrieve it as a definition docstring or
   documentation property;
4. a window, menu, mouse, error handler, editor, or application implements an explicit
   Help, `?`, `:DOCUMENT`, or `:DOCUMENTATION` endpoint;
5. it is a reviewed generated self-documentation artifact in the public source tree.

Comments, bug mail, change logs, and manuals with no identified in-program consumer
are excluded. Generated comparison files are retained but labelled separately from a
proven runtime display path.

## How CADR help works

### ZWEI self-documentation

ZWEI's Help dispatcher offers operations for a basic introduction, documenting a
key, documenting a named command, command apropos, undo, variable apropos, and finding
key bindings. The `B` operation attempts to view `AI: ZWEI; BASIC ZWEI`; the System 46
snapshot's corresponding `basic.zwei` is an explicit historical placeholder rather
than the missing introduction.

[`nzwei/doc.31`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/doc.31#L1-L110)
shows that a `DEFCOM` command normally has a display name and full documentation
property. The first line supplies short documentation, while a
`DOCUMENTATION-FUNCTION` can compute name, short, or full output dynamically. ZWEI's
brief and long Lisp-documentation commands then call the separate function metadata
path.

ZWEI also attaches `HOOK-DOCUMENTATION-FUNCTION` properties to command hooks. In the
pinned source, `AUTO-FILL-HOOK` and `EXPAND-ABBREV-HOOK` use that path to add
context-sensitive explanations when ZWEI documents a key.

Eight explicit `DEFPROP ... COMMAND-NAME` forms in
[`nzwei/dired.55`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/dired.55#L427-L500)
provide display names for DIRED commands. ZWEI's command display falls back to that
property, and its command-alist construction uses the same names; they are therefore
recovered as user-visible command metadata rather than generic Lisp properties.

[`nzwei/comc.75`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/comc.75#L149-L173)
contains those brief and long commands.

### Lisp and flavor documentation

`FUNCTION-DOCUMENTATION` searches symbol properties, source-level lambda forms, and
the `:DOCUMENTATION` entry in a compiled FEF's debugging information. Thus the same
string can support editor help and programmatic introspection without living in a
separate manual file.

[`lispm/qmisc.281`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qmisc.281#L1228-L1253)
implements that lookup. `DEFFLAVOR :DOCUMENTATION`, explicit `DEFPROP` and `PUTPROP`
forms, and `:DOCUMENTATION` methods provide parallel object-system paths.

### Key tables and application help

The keyboard and window systems construct more help at runtime. System and Escape key
tables carry printable descriptions; `KBD-ESC-INSTALL-FUNCTION` registers an action
with optional documentation; menus and windows answer documentation messages; and
programs such as PEEK, FED, the error handler, STEP, SUPDUP, and MUNCH implement their
own Help or `?` behavior.

For example,
[`lmio1/escape.6`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/escape.6#L70-L140)
defines the Escape-key registry, and its
[Help-key registrations](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/escape.6#L483-L486)
expose both one-key and all-key documentation.

## Recovered System 46 corpus

The extractor first selects the greatest numeric version for each directory-local,
case-folded source stem. In the pinned tree this yields 463 source files. It parses
historical Lisp bytes without evaluating forms, ignores comments and quoted data, and
retains the surrounding top-level form for every matched declaration. One backquoted
`DEFCOM` generator is retained as a template rather than misreported as a concrete
installed command.

The parser requires a source docstring to be followed by an executable body form; a
sole string body is a return value, not documentation. Help-character detection is
also a reviewed pathname-and-definition allowlist. CADR sources use `#/?` and
`#\HELP` as ordinary character data in music, punctuation, keyboard translation,
cursor glyphs, and device acknowledgements, so a raw token search would create false
Help handlers.

The 949 recovered records break down as follows:

| Declaration kind | Count |
| --- | ---: |
| ZWEI commands | 348, including 347 concrete commands and one generated template |
| Function, method, macro, and wrapper docstrings | 250 |
| Flavor documentation | 135 |
| Named Help handlers | 60 |
| ZWEI variables or options | 47 |
| Explicit documentation properties | 32 |
| Explicit ZWEI command display-name properties | 8 |
| Help-key handlers | 18 |
| Key registrations | 18 |
| ZWEI mode commands | 17 |
| Help tables | 9 |
| Documentation-message handlers | 6 |
| Documentation methods | 1 |

Of those records, 825 contain literal documentation strings, 30 preserve nonliteral
forms that compute or select documentation, and 94 are handlers whose bodies produce
help at runtime. Categories overlap: for example, a menu's mouse handler can be both
mouse documentation and an explicit Help endpoint.

The tracked asset directory contains 96 files totaling 2,003,292 bytes:

- `LICENSE.source`, copied from the pinned public source tree;
- `catalog.json` and the readable `catalog.md` inventory;
- 89 `.help.lisp` files containing only exact matched top-level source contexts, not
  silently reformatted whole source files;
- four byte-exact standalone or generated ZWEI artifacts.

Every catalog entry records original pathname, versioned filename, line and byte
spans, source kind, and SHA-256. Tests verify that each catalogued context hashes to
the bytes in its tracked recovery file.

## Standalone and generated ZWEI artifacts

| Source pathname | Bytes | SHA-256 | Interpretation |
| --- | ---: | --- | --- |
| `nzwei/basic.zwei` | 53 | `27ff8f344dc9bd48f4b3ee0178d9eb5df92626c3ef0969e36475203b3b63cc36` | Runtime Help-B target, but the preserved file is an explicit placeholder rather than the intended tutorial |
| `nzwei/_comnd.1` | 37,158 | `9cbd632e763c8ff150941f84ddb082edf56f123d513ff3e6c9ff2e6a3e598f36` | Generated listing of ZWEI command names, short documentation, and known bindings |
| `nzwei/emacs.comdif` | 7,950 | `6fec019a836715bc19be9ba36eec97e58d2fd23b4d1541ae9be07942eb0526c3` | Command-difference listing relative to the earlier EMACS environment; direct runtime opening is not proved |
| `nzwei/nzwei.comdif` | 4,831 | `d1ae94ca60fccf8ff078b3a77a0e01f359fab10e40ded085f6342b9886c2a712` | Added, renamed, and removed ZWEI command listing; direct runtime opening is not proved |

The two comparison files are documentation artifacts, but they are not promoted to
the same evidence grade as `basic.zwei`'s explicit consumer. Contemporary source-tree
notes describe their contents; that does not by itself prove a command displayed them.

## Reproducing the tracked recovery

From a checkout of the public source repository at commit
`8e978d7d1704096a63edd4386a3b8326a2e584af`:

```sh
python3 scripts/extract-cadr-help.py \
  --source /path/to/mit-cadr-system-software/src \
  --output docs/assets/mit-cadr-online-help \
  --clean
```

The extractor refuses a source tree whose copied license or four reviewed standalone
artifacts do not match the pinned byte sizes and hashes. It additionally verifies all
463 selected source files: 12,024,129 bytes, with manifest SHA-256
`efe818fc76d02c6c31afd6b0bbcdf43d89d277e871dedbee6562445be21d662d`.
The manifest hashes each file as sorted UTF-8 relative pathname, a NUL byte, and the
binary SHA-256 file digest. The complete catalog and aggregate declaration counts are
validated before `--clean` may replace a previous recovery.

The public source license is retained at
[`LICENSE.source`](../assets/mit-cadr-online-help/LICENSE.source). The original is
[`src/LICENSE`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/LICENSE).

## LM-3 System 303 cross-check

The maintained LM-3 Fossil tree corroborates the source-integrated architecture and
adds later material. At public `system-303` check-in
[`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9),
the metadata-only scan finds 10,090 matching metadata records from 10,073 unique source
forms in 562 files, plus eight standalone candidates. One source form can yield more
than one record when it carries multiple recognized kinds. The scan covers later
variable, structure, type, and
`SETF (DOCUMENTATION ...)` metadata, `DEFINE-COMMAND-DOCUMENTATION`, and a reviewed
65-definition Help-key dispatch set in addition to the System 46 mechanisms. The
inventory marks 188 generated-template records and labels patch contexts rather than claiming
that every lexical declaration was active in one running world.

The later source makes the breadth of *on-line documentation* especially visible:

- 1,196 executable `:DOCUMENTATION` fields have a following non-`NIL` value. Three
  `distribution/dist.lisp` occurrences are boolean directory-classification flags,
  leaving 1,193 help fields: 405 structure-slot descriptions, 244 typed flavor
  descriptions, five Site Data Editor class descriptions, 532 menu or UI properties,
  and seven live documentation-message clauses.
- The positional producer audit finds 141 signal descriptions, four resource
  descriptions, 74 demo-menu descriptions, 29 Common Lisp-style `CERROR` continuation
  descriptions, 13 `MULTIPLE-CERROR` proceed choices, 14 System-key registrations,
  and 43 typeout-item descriptions.
- Forty-five `DEFMETHOD` operations contain a segmented `DOCUMENTATION` name. Twenty-one
  return a sole literal string and 24 compute their result. A typeout-window
  `DEFWRAPPER`, two `:CASE-DOCUMENTATION` clauses, the central who-line renderer, and a
  ZWEI command-documentation handler add computed endpoints. Three `DEFSELECT` who-line
  clauses include one literal and two computed results. The scan records these endpoints
  without treating helper or routing infrastructure as additional payload.
- TFRAME contributes 29 command mouse descriptions and 29 corresponding long
  `:DOCUMENTATION` fields, plus 16 option descriptions. ZMail contributes 94 top-level
  command descriptions, 29 who-line updaters, 13 static who-line strings, 17 option
  associations, and 95 user-option presentation records across generated and direct
  constructors.
- Application-specific UI channels add one inspector `:BUTTON-DOCUMENTATION` property
  and its nonliteral documentation-string builder; two ZMail who-line override init
  properties, two setter payloads, and two dynamic bindings; 12 grabbed-mouse who-line
  bindings; five FED special-command mouse strings; and four ZWEI global mouse-blinker
  documentation bindings. `NIL` clearing and saved-value restoration forms are excluded
  because they introduce no source documentation.
- Four source initializers have direct consumers: Converse option help, ZWEI search
  help, the ZMail filter summary string, and ZMail's command-documentation alist. The
  Converse initializer is a second payload in a `DEFVAR` whose ordinary variable
  docstring is already a separate record, so it increases the record count without
  adding another unique source form.
- Source occurrences are intentionally not deduplicated across applied-patch and main
  source paths. The 29 string-first `CERROR` forms, for example, include a two-form
  Site Data Editor pair present in both places; the inventory preserves that provenance.

These application-specific records are consumer-backed. The inspector reads
[`BUTTON-DOCUMENTATION`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Finspct.lisp&ln=56-74)
and turns it into its who-line result. ZMail's override mixin
[`returns its dynamically bound or set string`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=zmail%2Fwindow.lisp&ln=78-86).
The central renderer is both
[`installed on the who-line field`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fwholin.lisp&ln=100-110)
and shown selecting grabbed-mouse or window-method documentation in its
[`runtime body`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fwholin.lisp&ln=646-672).
ZWEI's query-replace handler implements `:NAME`, `:SHORT`, and `:FULL` and is
[`installed as a DOCUMENTATION-FUNCTION`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=zwei%2Fcoms.lisp&ln=767-807).

The segmented-name sweep deliberately does not count every function containing the
word `DOCUMENTATION`. Flavor normalization only moves already inventoried flavor text
into generic Lisp documentation storage; the `wind/emack` request builds an offline
Bolio manual; and ZMail updater and append helpers orchestrate the already typed updater,
association, and payload records. Likewise, grouped `:CASE-DOCUMENTATION` routing in
method-combination machinery is not a second endpoint or source payload.

Across all mechanisms, 9,609 records point to literal strings, 190 to nonliteral source
forms, and 291 to computed handlers. The pinned producer audit also records meaningful
zeros: there are no `DEFINE-MAIL-TEMPLATE` or `DEFSIGNAL-FORMAT` invocations. All 33
`DEFINE-SETF-METHOD` occurrences—32 concrete forms and one generated template—omit a
documentation string, and the three `DEFINE-NOT-SETTABLE-MAIL-FILE-OPTION` forms install
bare option symbols rather than display or help metadata.

The parser does not invoke a Lisp reader. It nevertheless preserves source reader-object
boundaries for nested block comments, reader conditionals, read-time forms, pathnames,
vectors, structures, complex numbers, dimensioned arrays, radix-prefixed lists, and ZL
package-prefixed forms. Files explicitly declaring `Readtable:CL` use backslash quoting;
ZL and older System 46 sources retain slash quoting. This distinction is required both
for TFRAME's quoted strings and for ZL format strings that legitimately end in a
backslash.

The optional scan is pinned independently: its 1,044 eligible source and documentation
files total 25,493,051 bytes and have manifest SHA-256
`0758ba2f96f1764fe622d283e2f51277b5bf3060481b4019973767db5ad046ec` under the same
pathname-plus-file-digest convention as the System 46 manifest.

The standalone candidates are:

| Path | Bytes | SHA-256 | Note |
| --- | ---: | --- | --- |
| `zwei/teach-zmacs.text` | 29,879 | `f266019948f649915abe780d64fcce28d49ffe96ff65b9a48f9fa75475582076` | Later interactive editor tutorial |
| `zwei/<0x16>.comnd.text` | 37,158 | `9cbd632e763c8ff150941f84ddb082edf56f123d513ff3e6c9ff2e6a3e598f36` | Byte-identical to System 46 `_comnd.1`; the first filename byte is control-V |
| `zwei/emacs.comdif` | 7,950 | `6fec019a836715bc19be9ba36eec97e58d2fd23b4d1541ae9be07942eb0526c3` | Byte-identical to the System 46 comparison file |
| `cc/cc.help` | 11,791 | `5239dc3a478659f801eb9adf08a90b69363ed150abea5de6c71457a70fc4b030` | Compiler help candidate |
| `tape/newtape.info` | 14,688 | `cea331ada0f17e8aab63ff03329cafd8b558fea9b20a7d2f5925803828f939b1` | Restoration/tape information candidate |
| `tape/newtape-1.info` | 10,177 | `736b6c39a7191176fa6e97482c8e84f05780baf843cfb62d09c912610568d9d1` | Restoration/tape information candidate |
| `tape/newtape-2.info` | 17,035 | `3e59aed633e6fa09f0a75840e8dfb3e4218296de1e69c756d2edda44834c2fa2` | Restoration/tape information candidate |
| `tape/newtape.doc` | 9,554 | `dcfb3a92e95e072fd25157afbfde8af6e455576d49d118868fcc19ca432247e5` | Restoration/tape documentation candidate |

These are not all original MIT System 46 artifacts: the Fossil check-in is a
maintained System 303 restoration, and its tape material includes a later LMI
backport. The tree also contains conflicting redistribution signals: the
[restoration note describes a liberal license](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=tape%2F-read-me-.text&ln=1-13),
while the included
[historical copyright file requires prior written LMI permission for further distribution](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=tape%2Fcopyright.text&ln=1-12).
There is no repository-level license that clearly resolves every payload. For that reason the
optional LM-3 pass writes only paths, hashes, counts, structural or symbolic identities,
and non-text declaration metadata to ignored `build/help/mit-cadr/lm3-inventory.json`;
it does not copy source, documentation text, menu labels, or demo titles. Literal names
are replaced with kind-and-byte-offset identities before serialization.

Run that cross-check by adding:

```sh
python3 scripts/extract-cadr-help.py \
  --source /path/to/mit-cadr-system-software/src \
  --lm3-source /path/to/lm-3-system-303-checkout \
  --clean
```

## Completeness boundary

The tracked count is complete for declarations matching the reviewed mechanisms in
the pinned System 46 source snapshot. It is not a claim to reproduce a running load
band exactly. Macro expansion, reader conditionals, runtime table mutation,
site-local systems, and compiled-only FEF documentation can change what a particular
machine displays. A future load-band audit should enumerate live command tables,
keyboard repositories, properties, flavors, and compiled debugging records, then
compare that state with this source recovery.

## Sources

- MIT CADR System 46 source, commit
  [`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src),
  verified 2026-07-17.
- LM-3 `sys` Fossil repository, maintained System 303 check-in
  [`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9),
  verified 2026-07-17.

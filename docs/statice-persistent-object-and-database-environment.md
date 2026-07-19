---
type: Artifact Analysis
title: Statice persistent object and database environment
description: Source-, manual-, Help-, and artifact-grounded study of Symbolics Statice, its persistent object model, DBFS storage and server, Browser, commands, maintenance, transactions, and recovery.
tags: [genera, statice, database, persistent-objects, dbfs, application, source-code, preservation]
timestamp: 2026-07-18T10:30:05-04:00
---

# Statice persistent object and database environment

Statice is a persistent, shared object environment for Genera, not a serialized
Lisp world and not merely a B-tree library.  A program declares entity types in
Lisp, creates or opens a database stored in the Statice File System, and works
with entity handles that stand for records whose lifetime can exceed the current
process, machine, and world.  Transactions, page locks, a recovery log, local and
remote page clients, indexes, backup tools, a schema-aware Browser, and a
Command Processor interface turn that programming model into a database system.

The inspected Open Genera release divides the product into development,
run-time, server, Browser, documentation, and examples systems.  Its lower
layers are DBFS page/file service, records, areas, B*-tree indexes, schemas,
queries, and recovery.  The separately loadable contributed system named
`btree` is unrelated to those internal Statice indexes and must not be used to
explain their implementation.

This article reconstructs the product family without loading any optional
Statice system or creating a database.  It distinguishes four kinds of evidence
throughout:

- **Public manual:** intended Statice 2.0 behavior and the Statice 2.1 release
  notes.
- **Licensed source:** the later Open Genera source snapshot shipped with this
  museum's legitimately acquired media.
- **Local artifact observation:** names, sizes, hashes, dependency declarations,
  and inert Help-extraction counts; no proprietary body text is reproduced.
- **Runtime observation:** a safe probe of the base world, limited to package
  and already-loaded-system presence.  No Statice system was loaded and no
  namespace, file-system, partition, database, schema, or backup state was
  changed.

## Evidence and rights boundary

The local Statice source tree is licensed Symbolics material and remains
untracked.  This page publishes original analysis, short program and command
labels needed to identify the interface, and portable cryptographic evidence.
It does not reproduce source bodies, decoded Help prose, database examples, or
compiled payloads.

The licensed `sys.sct/statice/` subtree contains 172 files totaling 5,182,497
bytes.  A manifest made by sorting each relative pathname and hashing each file,
then hashing that manifest, has SHA-256
`1e1f10caa8b09c20efaf1aca62f069a1e00a9521d1d4bea0739b62525cd238d3`.
Selected evidence files are:

| Portable artifact | Bytes | SHA-256 | Use in this study |
| --- | ---: | --- | --- |
| `statice/sysdcl.lisp.~111~` | 3,874 | `65f969bf20786e1c97bcedc2f275f61d5c49252d2dfab9b92573dbfe37c5a679` | development-system declaration |
| `statice/runtime-sysdcl.lisp.~17~` | 5,895 | `140412218e60d99d3a47bbd1b0c6757e13cbc3f9197c1e2dadf33542eaae6f7c` | run-time dependency graph |
| `statice/server-sysdcl.lisp.~5~` | 4,964 | `c471dbe1f586fbfc1e64ecf0dbae20a1b790117951ad7e9b3f78ec65a49e87a7` | server, recovery, and backup layers |
| `statice/browser-sysdcl.lisp.~5~` | 3,196 | `5146f0a9f93a2deb6718c74144d59e05b57daae1fd4255a35695d0836a81e512` | Browser packaging |
| `statice/documentation/doc-sysdcl.lisp.~35~` | 4,543 | `300dc5875ba6a538bc82cb4c983c043b9472bcb6c24ec77654b90530c19ef0ee` | installed documentation inventory |
| `statice/statice-packages.lisp.~45~` | 21,790 | `759540c96712ac516c465e25b6485cd687f11d1d406ed957ba2c5d4450d4f036` | package, command-table, and interface boundary |
| `statice/development/browser.lisp.~41~` | 46,117 | `7fa700d6a1bbc212e7a7dd1dc2715c49482daca6d781fcf08475421f71fbbb7d` | panes, commands, gestures, queries, and edit conflict handling |
| `statice/development/defining-forms.lisp.~15~` | 43,378 | `0fc0c26894a3c4d0ce1593d32db6a4d30498dc2699acb95a7b964b9e43513f58` | schema and entity-type expansion |
| `statice/development/for-each.lisp.~4~` | 29,742 | `791153ebb1600fcbde56b21331899dad5f7dfe90286285bf609db3f6866d4306` | compiled query syntax |
| `statice/model/defs.lisp.~145~` | 70,165 | `ae034e0e37fb29918ce655f0075f7c0ae5f3a29a1283d17e9d2f4c55dd6e8729` | database, schema, type, attribute, and entity-handle objects |
| `statice/model/datatypes.lisp.~172~` | 200,858 | `43c15f32c80497fd2b31f282298c8380929b35c1c2014a1b36124a026baa23f0` | logical and physical data types |
| `statice/model/query.lisp.~47~` | 101,238 | `68744428c395aa2ae754dc46954d92dd989a63499ec204b0e9abeeea0fafdfda` | query planning and execution |
| `statice/model/update-schema.lisp.~29~` | 53,046 | `8055eb4de60abddd3f15d324c444ccfe76eecbd9ccd17551ffcefa8c854599fe` | schema comparison and update |
| `statice/storage/tree.lisp.~137~` | 74,421 | `33fd0532e1c80a80f1b578a23ad80f63e5153a32afcadeae796087d87415a5ce` | internal B*-tree implementation |
| `statice/storage/record.lisp.~226~` | 126,206 | `0aa3f0c609ce0b00878c5ad0324d7ef3333af177506e647566a84a665ec8e884` | entity and relationship records |
| `statice/file/client.lisp.~543~` | 55,043 | `e5befd3d51071cf0f1c6f0c7e242bb2d67df2ce8f77f7039270d572577d3a827` | page client and transaction boundary |
| `statice/file/common.lisp.~432~` | 103,253 | `cf130015f843c4c41cb9a25d9e05e79c7841f55a0d9e821ef1429fd313ea434f` | common page and file-system mechanisms |
| `statice/file/remote.lisp.~263~` | 40,640 | `4adcd6d519d07e6435968015e872cf11fc3043322a5219d5c3a5f7d18fb6c4c6` | remote page protocol |
| `statice/file/lock-order.lisp.~22~` | 12,720 | `c16bbcdc4aaa9340f2d0de99abff5c9c32b393385c8b0be6796ed24f3fd72491` | lock ordering and deadlock support |
| `statice/file/dbfs-pathnames.lisp.~30~` | 13,776 | `5053b1759124a44c5d424056f5d9871c67ba3257f4a0ddd84023d4b1d634d4db` | DBFS pathname behavior |
| `statice/utilities/runtime-utilities.lisp.~1~` | 21,238 | `cc8389c158477f3331b3c30fa5df5c5c726061a568ba480150b80511ce794cb2` | top-level commands and database copy |
| `statice/utilities/model-dumper.lisp.~36~` | 24,240 | `eeaee9020253e8704963cd703947a3810175461a89d4a23e29d9a1f14c188894` | source-form dump and load |

The public *Statice User's Guide* PDF is 1,346,186 bytes, 245 pages,
SHA-256 `8c6f10e9801f01bc95c789d2234b7e7068144290dc72bcc5c965b0987220cb8f`.
Its book-registration page identifies Statice 2.0 for Genera 8.0 and document
number 999979.  The PDF's 2018 creation metadata describes the scan or generated
copy, not the date of the historical product.  The public *Release Notes for
Statice 2.1* PDF is 61,690 bytes, seven pages, SHA-256
`b7dad36e1dd993c49fbc9b97f9e1cf07dc6fa290085fc9d69a809aa816ccdce3`.

## Release and source-version boundary

The local system registry reports released and latest version 466 for `Statice`,
`Statice-Runtime`, `Statice-Server`, and `Statice-Browser`, and version 426 for
`Statice-Documentation`.  Those are Genera system versions, not public Statice
product-version numbers; no evidence maps 466 to a marketed Statice release.
Consequently this page does not silently project every Open Genera source detail
back onto Statice 2.0 or 2.1.

That boundary matters.  The 2.1 notes describe entity handles as Flavors and say
that direct CLOS integration is not supported.  The later inspected source says
the user-visible layer underwent a Flavors-to-CLOS conversion, defines entity
handle classes with `defclass`, and has examples specialized with CLOS methods.
Lower layers still mix SCL/Flavors and Future Common Lisp machinery.  This is
release drift: the older manual and later media are each evidence for their own
state, not a contradiction to erase.

## Product map and load boundary

The family is layered deliberately:

| System | Declared role | Principal layers |
| --- | --- | --- |
| `Statice-Runtime` | deploy an application that uses an already defined schema | packages and unique IDs; DBFS kernel/client; record and index layers; model, query, schema update, DBFS directories, run-time utilities, model dumper, presentation types |
| `Statice-Server` | own disks, serve pages, recover, and back up | run-time plus UFS disk access; local and remote DBFS server; recovery; server setup; tertiary storage, volume librarian, maintenance, complete/fuzzy backup utilities |
| `Statice-Browser` | inspect and edit entities interactively | run-time plus the `Statice Browser` Dynamic Windows program |
| `Statice` | develop schemas and applications | run-time plus schema/access/type/query macros, Browser, and example source |
| `Statice-Documentation` | installed Documentation Examiner material | Statice topic, tutorial, operator, type, performance, error, and release-note books |

The run-time declaration resolves the following conceptual stack:

```text
application and entity methods
  -> defining/access/query macros (development system)
  -> schema, datatypes, entity handles, queries, schema update
  -> records and relationship records
  -> heaps, areas, B*-tree indexes, and scrolls
  -> DBFS directories and pathnames
  -> local or remote page client, locks, queues, and transactions
  -> UFS disk access, recovery log, backup, and server (server system)
```

The declarations mark development sources as distributable within Symbolics'
product machinery while most run-time/server internals are marked otherwise.
The purchased media nevertheless includes many Lisp source files beside compiled
VBINs.  Neither fact grants public redistribution rights; all such files remain
licensed inputs.

## Persistence model

### Template schema and real schema

A `define-schema` form creates a template schema in Lisp virtual memory.
`define-entity-type` adds persistent classes, inheritance, attributes, storage
hints, and generated access functions to that template.  `make-database` copies
the template into a new database as its real schema.  Thereafter the template
and real schema are distinct objects: administrators can add physical indexes
to one database without changing every database or the Lisp definition, and a
new program definition does not mutate existing storage by itself.

`with-database` associates a pathname with a schema and establishes a current
database for its body.  `open-database`, `with-current-database`,
`current-database`, and `terminate-database` expose the longer-lived connection
boundary.  A database's stored schema name must name a template schema present
in the Lisp world; the Browser likewise needs that package and schema loaded
before it can interpret persistent records.

### Entity types, attributes, and relationships

Entity types support multiple inherited attributes, although the 2.1 notes
forbid duplicate inherited attribute names.  An attribute can be scalar or
set-valued, nullable or `:no-nulls`, entity-valued or ordinary, unique, read
only, cached, initialized by a form, placed in an area or attribute set, and
given generated accessors.  Entity-valued attributes can declare an inverse,
so a relationship is navigable in both directions.  Type options choose areas,
type sets, clustering, constructors, initialization keywords, instance
variables, documentation, and multiple-attribute indexes.

An entity handle is a Lisp proxy for a persistent identity.  The handle stores
enough identity and database context to find the record; it is not the entire
entity serialized into the heap.  Unique IDs let references remain meaningful
across pages and sessions.  The server keeps its ID source in
`FEPn:>UNIQUE-ID.FEP.1`, a two-block FEP file.  The guide says the system can
recreate it if lost, but explicitly advises leaving it alone.

### Records and physical layout

The source separates entity records from relationship records:

- one entity record holds a persistent entity's scalar values and inherited
  slots;
- a set-valued relationship normally has a relationship record per member;
- a special unique one-to-many entity relationship can store the back pointer
  in the target entity record instead;
- areas group pages, while type sets and attribute sets identify the pages that
  hold particular kinds of records;
- clustering hints place entities or relationships that are likely to be read
  together near one another.

The 2.0 guide gives a Statice page as 1,152 bytes on 36xx machines and 1,280
bytes on Ivory machines.  One directory-property description also calls a block
1,152 bytes while parenthetically noting 1,280-byte Ivory FEP blocks.  Page size
is therefore a server/hardware format property, not a portable constant.
Database copy detects incompatible page sizes and directs the user to textual
Dump/Load instead.

The page cache has a configurable buffer-replacement limit.  Least-recently used
pages can be reclaimed only when they are not held by a transaction; pages above
the configured limit are treated as most-recently used.  A database can thus be
larger than Lisp virtual memory, but long transactions can pin enough pages to
defeat replacement.

### Indexes are physical, not semantic

Statice indexes are B*-tree structures in the `Statice-Index` layer.  They sort
keys and accelerate access without changing which entities satisfy a query.
The product supports normal attribute indexes, inverse indexes for relationship
directions, exact and case-sensitive variants where applicable, and indexes on
several attributes.  A multiple index can service predicates that constrain a
leading subsequence of its fields; arbitrary trailing-only conditions do not
have the same ordered access path.

The query planner can intersect several applicable indexes.  Without one it
scans the smallest suitable physical population: a type set, attribute set, or
area.  Adding an index therefore trades storage and update/lock work for query
speed.  The 2.1 notes additionally report that indexes can improve deletion
speed, not only lookup.

## Data types

The 2.0 interface accepts the following built-in or compound type specifiers for
persistent attributes:

- `statice:all-but-entity`, `statice:alist-member`, `boolean`, `character`,
  `double-float`, `statice:entity-handle`, `statice:image`, `integer`,
  `statice:limited-string`, `member`, `dw:member-sequence`, `statice:pathname`,
  `single-float`, `string`, `string-char`, `symbol`, `t`,
  `time:time-interval`, `time:time-interval-60ths`, `time:universal-time`, and
  vectors of unsigned elements sized 1, 2, 4, 8, 16, 32 bits or `fixnum`;
- application-defined logical types, whose handlers map a logical Lisp value
  to an underlying physical Statice representation.

The permissive type `t` uses Genera's binary dumper.  The manual establishes
support for numbers, characters, strings, symbols, arrays, recursive lists,
compiled code, generic functions, symbol-cell locatives, and Flavors that supply
a dump form.  It excludes most other locatives, dynamic and lexical closures,
logic variables, stack groups, and circular objects.  This facility persists a
value inside a Statice record; it does not turn an arbitrary live Genera process
or world into a database snapshot.

The documented unsupported type-specifier list is `and`, `array`, `atom`,
`common`, `compiled-function`, `cons`, `function`, `hash-table`, `instance`,
`list`, `locative`, `not`, `or`, `package`, `random-state`, `readtable`,
`satisfies`, `sequence`, `simple-array`, `simple-vector`, `stream`, `structure`,
`sys:dynamic-closure`, `sys:generic-function`, `sys:lexical-closure`, and
`values`.  The distinction is between a supported Statice storage type and an
ordinary Lisp type name, not between Lisp and non-Lisp data.

## Query, update, and transaction semantics

### Query language

`for-each` is the compiled query form.  It binds an entity variable, compiles
predicates against the known schema, selects access paths, and evaluates a body
for each result.  The dynamic `for-each*` and `count-entities*` variants accept
type and condition data at run time.  The 2.1 notes place two important limits
on `for-each*`: one entity variable per call, and no iteration over set-valued
attributes.  The later source still contains those entry points, but this study
did not load the system to test whether release 466 retains the limits.

The Browser source's exact comparison vocabulary is:

| Family | Operators |
| --- | --- |
| numeric/general ordering | `=`, `not-equal`, `<`, `>`, `<=`, `>=` |
| membership/identity | `any`, `eq`, `eql`, `equal` |
| case-insensitive strings | `string-prefix`, `string-search`, `string-equal`, `string-greaterp`, `string-lessp`, `string-not-greaterp`, `string-not-lessp` |
| exact-case strings | `string-prefix-exact`, `string-search-exact`, `string=`, `string-not-equal`, `string<`, `string>`, `string<=`, `string>=` |

The Browser asks for attribute/value/operator triples in an Accept Values form.
Program code can express richer compiled conditions and ordering.  Index
selection is an optimization underneath the truth conditions; a query still has
the same intended result when it falls back to a scan.

### Transaction contract

`with-transaction` establishes the supported atomic update boundary.  A normal
return commits; a nonlocal exit or process death aborts.  Nested transactions do
not independently commit: the outermost transaction owns the eventual commit or
abort.  The manual promises atomicity, isolation, and persistence of committed
changes across failures.

The page layer uses two-phase, page-granularity locking:

- an unlocked page can acquire a shared read lock or exclusive write lock;
- a transaction retains acquired locks until commit or abort;
- an upgrade from read to write can participate in a deadlock;
- the detector handles two-way, n-way, and upgrade cycles and aborts the
  youngest transaction in a detected cycle;
- a restartable abort normally retries, with a documented default retry limit
  of 100.

This retry behavior is semantically visible.  Any non-database side effect in a
transaction body can occur more than once.  The 2.1 notes therefore advise
small transactions, avoiding irreversible effects, avoiding unnecessary
nesting, and never overriding the internal `without-aborts` protection.  The
debugging variable `*restart-testing*` deliberately forces retry paths.

A client or server failure aborts unfinished work.  A server failure aborts the
transactions using that server across clients.  The 2.1 notes also say not to
warm boot while Statice locks are held: world recovery is not a substitute for
the database transaction protocol.

### Schema change

Changing a template schema does not rewrite a real schema.  `Update Database
Schema` compares them and plans actions.  Compatible changes include adding or
deleting entity types and attributes, and adding or deleting indexes, type sets,
and function/attribute sets.  New attributes begin null or empty.  Deleting a
type deletes its entities, and deleting an attribute does not necessarily
recover its occupied space.

Changes to inheritance, an entity type's area, or an attribute's stored type,
cardinality, uniqueness, null policy, or area can require rebuilding rather
than in-place update.  Dumping and loading through source form is the general
cross-format reconstruction path.

Two independent warnings make `Update Database Schema` unsafe to recommend for
preservation work:

1. the Statice 2.1 release notes explicitly say not to use it because of
   reliability problems and say to back up first if it must be used;
2. the later inspected `update-schema.lisp.~29~` contains a source comment that
   warnings when data will be lost are still to be done, immediately noting
   cascading entity and tuple deletion.

The second point is source-visible behavior not disclosed by the 2.0 command
description.  This museum performed no schema update.

## Programming interface inventory

The 2.0 operator dictionary names 83 public operators.  The table below is a
complete name inventory, grouped by purpose.  It is intentionally a map rather
than a substitute for the manual's argument lists and conditions.

| Count | Purpose | Complete operator-name inventory |
| ---: | --- | --- |
| 7 | definition and basic use | `define-schema`, `define-entity-type`, `make-database`, `with-database`, `with-transaction`, `for-each`, `delete-entity` |
| 2 | set-valued attributes | `add-to-set`, `delete-from-set` |
| 9 | indexes | `make-index`, `make-inverse-index`, `make-multiple-index`, `delete-index`, `delete-inverse-index`, `delete-multiple-index`, `index-exists`, `inverse-index-exists`, `multiple-index-exists` |
| 4 | array/string portions | `attribute-value-array-portion`, `attribute-value-length`, `set-attribute-value-array-portion`, `do-text-lines` |
| 4 | database lifetime | `open-database`, `with-current-database`, `current-database`, `terminate-database` |
| 10 | dynamic access and query | `attribute-value`, `set-attribute-value-to-null`, `inverse-attribute-value`, `attribute-value-null-p`, `make-entity`, `for-each*`, `add-to-set*`, `delete-from-set*`, `count-entities*`, `do-text-lines*` |
| 5 | clustering, testing, tuning, and UI | `with-cluster`, `*restart-testing*`, `dbfs:set-buffer-replacement-parameters`, `view-entity`, `statice-utilities:entity-named-by-string-attribute` |
| 11 | extensible logical types | `statice-type:define-value-type`, `statice-type:define-handler-flavor`, `statice-type:encode-value`, `statice-type:decode-value`, `statice-type:read-value`, `statice-type:value-equal`, `statice-type:size-of-value`, `statice-type:write-value`, `statice-type:record-equal`, `statice-type:record-compare`, `statice-type:value-compare` |
| 31 | schema inspection | `get-real-schema`, `get-template-schema`, `get-real-schema-name`, `get-template-entity-type`, `schema-name`, `schema-types`, `type-name`, `type-parent-names`, `type-attributes`, `type-area-name`, `type-set-exists`, `type-multiple-indexes`, `attribute-name`, `attribute-function-name`, `attribute-type`, `attribute-value-type`, `attribute-value-is-set`, `attribute-unique`, `attribute-read-only`, `attribute-area-name`, `attribute-set-exists`, `attribute-index-exists`, `attribute-index-average-size`, `attribute-inverse-index-exists`, `attribute-inverse-index-exact-exists`, `attribute-inverse-index-average-size`, `attribute-no-nulls`, `attribute-inverse-function-name`, `multiple-index-attribute-names`, `multiple-index-unique`, `multiple-index-case-sensitive` |

The counts sum to 83.  Generated entity accessors and constructors are
application-specific and therefore do not add fixed names to this release-level
inventory.

### Development workflow

A normal development sequence is:

1. load the development system and define a schema plus entity types;
2. create a DBFS database from the template, or open an existing database whose
   schema name matches a loaded template;
3. create entities and relationships inside small transactions;
4. add physical indexes after measuring real access patterns;
5. query with compiled `for-each`, or use dynamic operators and the Browser for
   exploration;
6. dump source-form data or take a complete server backup before risky schema or
   storage work;
7. terminate an exact-copy source before opening its clone, because the copy
   preserves unique identities.

The shipped example system includes book, bank, university, image, extensible
type, presentation-type, Joshua, and finger-oriented examples.  They establish
integration surfaces but are not separate Statice products.  Exhaustive example
walkthroughs are deferred to the repository's D60 examples dossier.

## Statice File System and server topology

### DBFS as a Genera file-system type

The Statice File System is registered in a namespace as a File System object of
type `DBFS`.  It lives on a Symbolics server host, but clients address its
namespace name rather than embedding that host in every database pathname.  A
site can therefore move the file-system service while preserving logical names.
More than one Statice file system can reside on a host.

A DBFS pathname has a host and directory components, for example
`IRIS:>DIRECTORY>DATABASE`, but no ordinary file type or version.  Lookup is
case-insensitive while names preserve case.  Relative pathnames, directory
wildcards, completion, and directory commands are supported.  The exposed file
properties are author, creation date, comment, directory status, and length in
blocks.

This namespace resemblance does not make a database an ordinary byte stream:

| Ordinary file operation | DBFS behavior established by manual/source |
| --- | --- |
| `Open` for reading or writing | rejected; only probe, probe-link, and probe-directory directions are accepted |
| Show Directory / Dired | supported for database and directory names |
| Create Directory | supported |
| Delete File / Delete Directory | supported and immediate; there is no undelete or expunge stage |
| Rename File | supported |
| Copy File / Show File | not a way to copy or print database contents; use Statice-specific copy, dump, or Browser operations |
| links | not supported |

The DBFS root directory is represented in a directory database, rooted from the
FEP `.UFD`.  The server stores partition information, a log descriptor, and the
directory root identity as file-system metadata.  `Create Statice File System`
constructs that managed structure; it is not synonymous with making one user
database.

### Local and remote clients

A local client reaches the server's disk layer directly.  A remote client asks
the host for a server process, then uses pooled connections for page requests;
idle connections can be scavenged.  Two services divide the work:

- `DBFS-PAGE`, documented at TCP port 569, carries synchronous page requests;
- `ASYNCH-DBFS-PAGE`, documented at TCP port 568, sends reverse notifications
  such as cached-page invalidation.

The asynchronous channel improves cache behavior but is not the sole correctness
mechanism.  The 2.0 manual describes TCP and Chaos service registrations.  The
2.1 notes say to use TCP because the Chaos path is unreliable.  The later
Open Genera command source only constructs TCP service triplets.  This is a
specific release difference, not evidence that the older manual invented its
Chaos configuration.

The commands' keyword is visibly named `TCP Not Present`.  In the later source,
setting it makes the procedure treat the TCP tuple as already present and return
without updating the host object.  That matches its documentation—do not add the
tuple—although the resulting “already has” status message is potentially
misleading.

## Recovery, backup, and interchange

### Log and failure recovery

The server's recovery log grows automatically and records enough page activity
to abort unfinished work and restore a consistent committed state after a
failure.  It is part of the server layer, not a user-level audit trail.  A
complete backup is supported.  The manual also describes a continuous archive
design but says that facility is currently unsupported; this page does not turn
that design into a shipped capability.

### Complete backup and restore

The Statice File System Operations program manages volume sets and volume
sequences.  A complete backup can run without disabling the file system.  A
complete restore is destructive: it first removes the databases currently in
the selected Statice file system, after confirmation, then restores the backup.
`Compare Backup Volume Set` compares saved and current pages.

The volume library is itself a Statice database.  It tracks volume identities,
backup runs, files, and notes, and supports queries such as backup history and
finding the volume that contains a named database or file ID.  The manual names
cartridge and industry-standard tape choices and local or remote tape drives;
its recommendation is remote tape over TCP.  The media also includes fuzzy
backup compiled modules.  Their source is not present, so their algorithm and
supported user contract remain a `TODO`; their names alone do not justify a
claim of online incremental backup.

### Selective restore

Selective Restore exposes the following decisions:

- target Statice File System;
- whether to disable it for the restore;
- one or more database path patterns;
- whether to repatriate recovered files, with `Yes`, `No`, or `Query` policy;
- name-conflict action: leave, rename existing, replace existing, load under a
  unique name, or query;
- automatic or manual volume selection;
- tape device and volume host;
- detailed-progress display.

The 2.0 manual advises application programmers to leave repatriation off by
default.  Selective recovery is still a server administration operation; it is
not a transaction-level undo command.

### Database dump/load source form

`Dump Database` writes a textual reconstruction file to an ordinary file system.
Its control records include domain, relation, committed-domain, and index forms;
its data records describe entities and relationship data.  Dump holds one long
consistent transaction, whereas Load commits many smaller transactions.  Load
therefore reconstructs logical contents but is not a byte-for-byte image restore.
Clustering is re-established during the load.

The manual warns that this source form can be larger than the original binary
database and can run into the historical LMFS file-size limit of approximately
15 MB.  It is nevertheless the portable path between servers with different
Statice page sizes.  The later Open Genera source adds a `Data Only` option to
`Load Database`; that option is absent from the 2.0 command dictionary and
loads records against an existing schema rather than rebuilding schema/index
definitions.

An exact `Copy Statice Database` preserves unique IDs.  The source and its copy
must not both remain open: terminate the first before opening the duplicate.
This is an identity collision constraint, not just a filename rule.

### Persistence artifacts at a glance

| Artifact | Meaning | Snapshot-like? | Preservation consequence |
| --- | --- | --- | --- |
| DBFS database | schema, records, relationships, indexes, and page metadata | no; managed page database | preserve with matching server format or dump/load |
| Statice File System | namespace, directory database, partitions, log, and many databases | closer to a storage service than a VM image | requires server topology and recovery metadata |
| recovery log | uncommitted/committed recovery state | no | pair with the file-system state; do not present as user history |
| complete backup volume set | server-level backup of a Statice File System | media image at the database-service level, not machine state | preserve volume order, labels, library metadata, server page format, and restore procedure |
| Dump Database output | textual logical reconstruction | no | most portable and inspectable form, but large and not byte-identical |
| Genera world/VLOD | Lisp world containing code, schemas, and possibly open handles | yes, world/load image | does not by itself contain or commit the external DBFS page store |

## Command Processor surface

Loading the Statice run-time/development utilities installs a `Statice` Command
Processor table.  The later source and compiled interface define exactly 13
Statice-specific top-level commands:

| Command | Purpose and principal arguments |
| --- | --- |
| Add ASYNCH DBFS PAGE Service | update one host's namespace service list; host plus `TCP Not Present` switch |
| Add DBFS PAGE Service | update the synchronous page service on one host; same switch |
| Add Statice Partition | add an FEP partition pathname and size in blocks to a named local Statice File System |
| Copy Statice Database | source/destination; optional author, comment, and creation-date properties; directory-creation policy; query policy |
| Create Statice File System | name; `Locally`; directory partition, maximum directory entries, initial log blocks, and repeated data partition/size entries |
| Delete Statice File System | name and `Locally`; confirms destruction of the entire file system and its databases |
| Dump Database | DBFS database pathname and ordinary destination pathname |
| Load Database | DBFS destination, ordinary source pathname, `If Exists` error/create policy, and later-source `Data Only` boolean |
| Set Database Schema Name | DBFS pathname and schema symbol; confirms before changing the stored association |
| Show All Statice File Systems | namespace, defaulting to all/search path |
| Show Database Schema | DBFS pathname; reconstructs a definition from stored schema metadata |
| Show Statice Partitions | local Statice File System |
| Update Database Schema | DBFS pathname; plans, reports, confirms, and performs the dangerous comparison/update described above |

Ordinary `Show Directory`, `Create Directory`, `Rename File`, and `Delete File`
commands remain applicable to the DBFS namespace within the restrictions above.

### Schema reconstruction is intentionally lossy

`Show Database Schema` can reconstruct entity area/type-set/multiple-index
options and attribute unique/index/inverse-index/area/attribute-set/no-nulls
options.  The source does not reconstruct all source-level choices.  It omits at
least attribute caching, initialization forms, inverse forms, clustering,
accessor/reader/writer names, and read-only declarations, plus entity constructor,
conc-name, default-init plist, documentation, initialization-keyword,
instance-variable, and own-cluster choices.  Its output is useful evidence about
the real schema, not guaranteed recovery of the author's original declarations.

### Two source-only command findings

The later `Copy Statice Database` source offers `:comment` in the accepted
property list but tests for `:copy-comment` when binding the internal copy flag.
On the inspected source this mismatch appears to prevent the requested comment
property from being copied.  The matching VBIN has the same source version, but
runtime confirmation remains a `TODO` because the system was not loaded.

The later `Load Database` source exposes `Data Only`; the 2.0 command dictionary
does not.  This is a later user-facing addition rather than an undocumented
option inferred from an internal helper.

## Statice Browser

The program object is named `Statice-Browser` and displays the title `Statice
Browser`.  It is a Dynamic Windows system-menu program that inherits the Help
Program, colon full-command, standard-arguments, and standard-scrolling command
tables.  The manual starts it with `Select B` or the System menu.  Its job is to
open an existing database whose schema definition is already in the world,
construct queries, inspect result sets, and view or edit entity attributes.

### Window structure

The source defines six panes:

1. a title pane naming the open database and state;
2. a viewer/typeout pane for the selected entity and explanatory output;
3. `Current Candidates`, holding the active query's entity handles;
4. `Queries`, retaining result-set objects that can be reselected;
5. a `Commands` interactor;
6. a `Command Menu` pane.

The fixed top-level menu contains exactly `Open Database`, `Query`, `Begin
Edits`, `End Edits`, `Abort Edits`, and `Help`.  Viewer output and the two
history panes are separate: selecting a query changes the candidate source;
selecting a candidate changes the viewed entity.

### Complete Browser-defined command surface

The inspected Browser source defines 13 program commands.  Inherited Help and
scrolling commands remain available but are not relabeled as Browser-defined.

| # | Command | Direct key/menu | Effect and arguments |
| ---: | --- | --- | --- |
| 1 | Clear | command | clear pane histories, pathname/schema state, candidates, and saved result sets |
| 2 | Remove Typeout Window | `Space` | remove the transient typeout window without echoing a command name |
| 3 | Open Database | top menu | accept a DBFS database pathname; require matching loaded schema/package; reset previous state |
| 4 | Query | top menu | accept entity type and attribute/operator/value rows; count candidate size, confirm a large result, then execute |
| 5 | Begin Edits | top menu | start queueing Browser edits instead of writing each one immediately |
| 6 | Abort Edits | top menu | discard the queued edit set |
| 7 | End Edits | top menu | compare and commit queued changes; `Compare Attributes` is None/Changed/All, default Changed; `Difference Action` is Query/Abort/Ignore, default Query |
| 8 | Describe Attribute | presentation command | describe the selected schema attribute |
| 9 | Next Candidate | `Control-N` | move forward by integer count, default 1; numeric and `Control-U` arguments are accepted |
| 10 | Previous Candidate | `Control-P` | move backward by integer count, default 1; numeric and `Control-U` arguments are accepted |
| 11 | Select Candidate | presentation command | make a candidate entity current |
| 12 | View Entity | presentation command | display a functional entity handle in the Browser |
| 13 | Select Query | presentation command | switch to a retained result set |

No other fixed Browser keybindings were found in this source.  Standard Dynamic
Windows editing, scrolling, completion, abort, and Help behavior comes from the
inherited command tables and can be site- or release-sensitive; this article
does not invent editor-style bindings for them.

### Presentation gestures

| Presented object | Gesture established by source | Result |
| --- | --- | --- |
| candidate entity in `Current Candidates` | left | `Select Candidate` |
| query/result set in `Queries` | left | `Select Query` |
| functional entity handle in the Browser | left | `View Entity` |
| attribute name | middle | `Describe Attribute` |
| abbreviated set value | contextual menu choice | display more members of the set |
| `pop-up-image` value | presentation action labelled `Show Image` | open the image; the source uses a generic gesture and does not pin a physical button |

The Browser displays only the first three members of a set-valued attribute,
then an ellipsis and remaining count.  That limit is a source constant, not a
manual approximation.  Attribute values are presented as editable forms unless
the schema marks the attribute read-only, exposing the inherited Dynamic Windows
structure-slot modification action.

### Immediate and deferred editing

Outside an edit session, changing one displayed attribute opens its own
transaction and writes it.  The source explicitly does not recheck that value
against the value originally displayed, so a concurrent change can be
overwritten.

`Begin Edits` instead records proposed values.  At `End Edits`, the Browser opens
a transaction, compares current storage with the old displayed values according
to the chosen policy, and writes the queued updates.  Under `Query`, each
conflict presents old, current, and proposed values and asks how to proceed.  A
source-only qualification is important: the comparison loops filter through
the storage handler's `indexable-p`.  Thus the displayed `All` or `Changed`
policy does not visibly prove comparison of every non-indexable extensible value.
Runtime confirmation of that edge case remains a `TODO`.

Another source-visible detail is that Query counts entities in one transaction
and retrieves them in a later transaction.  The confirmation estimate and the
final result therefore need not describe one atomic snapshot if another client
commits between those phases.  The result container accommodates the eventual
fetch; the displayed count should be read as an estimate at confirmation time.

### Screenshot status

**Screenshot TODO:** the base licensed world did not have the Statice packages
or Browser system loaded, and the safe probe deliberately did not load optional
software or create a database.  A meaningful Browser capture additionally needs
a disposable, rights-cleared test database and loaded matching template schema.
Without those prerequisites, a blank or error window would not verify the
query, presentation, or edit behavior described here.  No screenshot is
published in place of that missing runtime evidence.

## Statice File System Operations program

The server administration application displays `Statice File System Operations`
and has internal program name `DBFS-OPERATIONS`.  The manual and installed Help
say to load `DBFS-Utilities`, then use `Select Shift-D`.  Its upper pane is a
command menu; the lower pane is a Lisp interaction/directory pane.  Commands can
be typed, selected from the menu, or invoked from presented directory entries.
Accept Values gathers command options, and End executes the form.

### Complete top-menu inventory

The compiled maintenance module contains exactly these 19 top-menu labels in
the inspected release:

| # | Menu command | Purpose |
| ---: | --- | --- |
| 1 | Complete Backup | write a complete Statice File System backup volume set |
| 2 | Compare Backup Volume Set | compare backed-up pages with the selected file system |
| 3 | Complete Restore | destructively replace current databases from a complete backup |
| 4 | Selective Restore | recover selected database paths under explicit conflict policy |
| 5 | Show Backup History | query recorded runs for a Statice File System |
| 6 | Find Backup Volumes | locate volumes by database filename or file ID |
| 7 | Describe Backup Volume | show label/library information for a tape volume |
| 8 | Initialize Backup Volume | label and register a backup volume |
| 9 | Create Statice File System | create the DBFS directory, log, and partition configuration |
| 10 | Describe Statice File System | report its server and storage configuration |
| 11 | Delete Statice File System | destroy the file system and all its databases after confirmation |
| 12 | Show All Statice File Systems | enumerate namespace-registered DBFS services |
| 13 | Enable Statice File System | enable one local file system |
| 14 | Disable Statice File System | disable one local file system |
| 15 | Enable Statice | start the Statice/DBFS service layer |
| 16 | Disable Statice | shut down the service layer |
| 17 | Add Statice Partition | attach an FEP partition and size |
| 18 | Show Statice Partitions | list configured partitions |
| 19 | Help | enter program Help |

The lower pane additionally installs ordinary or Statice command-table entries
for Show Directory, Create Statice File System, Delete File, Rename File, Show
File, Expunge Directory, Copy Statice Database, Delete Statice File System, Show
All Statice File Systems, Add Statice Partition, and Show Statice Partitions.
`Show DBFS Meters` also exists as an internal command.  Their presence does not
override DBFS's restrictions: for example, ordinary Show File cannot display
database pages as a text file.

`Find Backup Volumes` appears in the later compiled program and prompts for a
file name or file ID.  It is absent from the public 2.0 command dictionary, so
it is a source/binary-visible later addition.  No more elaborate search options
are asserted.

### Maintenance option surfaces

Complete Backup, Compare Backup Volume Set, and Complete Restore share a core
Accept Values surface: Statice File System, volume-set name, volume sequence
number, device, volume host, and detailed-progress display.  Complete Restore
adds the destructive replacement confirmation.

Selective Restore supplies the complete policy set listed in the recovery
section.  Describe Backup Volume asks for the tape type/device and volume host;
Describe Statice File System asks for the file-system name; Enable/Disable File
System and Show Backup History select a file system; Find Backup Volumes accepts
the filename-or-ID search key.  Initialization and device-specific prompts can
vary with installed tape support, so this article does not claim an exact
hardware menu without a loaded runtime.

### Maintenance screenshot status

**Screenshot TODO:** `DBFS-Utilities` was not loaded in the base world and this
study did not load it.  A publishable maintenance screenshot should be made only
in a disposable server configuration, because even opening Accept Values beside
live DBFS presentations risks inviting a destructive Complete Restore, Delete,
partition, or enable/disable action.  The future capture must stop before End,
record the exact menu and options, and undergo the repository's screenshot
rights review.

## Installed on-line documentation

The tracked inert extractor described in [Recovering Genera on-line Help and
documentation](genera/online-help-and-documentation-recovery.md) reads SAB and
source Help structures without evaluating licensed forms.  Its ignored local
catalog identifies 24 Statice SAB files totaling 885,139 source bytes, 320
documentation records, 1,863 embedded command objects or references, and two
picture objects.  The command-object total is an internal serialization count,
not 1,863 distinct Statice commands.

Three books are installed with the base documentation run time:

| Logical Help source | Bytes | SHA-256 | Records | Command objects | Pictures |
| --- | ---: | --- | ---: | ---: | ---: |
| `doc/installed-440/statice-rt/statice1.sab` | 79,892 | `aa697b2f036fb57a82ab04ce0e6a330c3b428c8b5dd9b76d1a5888799d02865e` | 31 | 28 | 2 |
| `doc/installed-440/statice-rt/statice2.sab` | 29,966 | `44fe8569ef556ffc8f38c45a1c17afd880ffa1c0127b9db28cbf9a423537e1cb` | 14 | 66 | 0 |
| `doc/installed-440/statice-rt/statice3.sab` | 15,305 | `dd925e1d6853769f2ad3f4d18ddde3594c5ae19227bcb059c58773e77bd21e12` | 17 | 8 | 0 |

The 21 product documentation SABs cover installation, buffer replacement,
errors, extensible types, hints, operators, performance, release notes, tools,
five topic divisions, four tutorial divisions, and types.  Their decoded prose
and pictures remain under ignored `build/help/genera/`; this article links the
tracked recovery method, not those licensed outputs.

The evidence-producing files at verification time were:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/extract-genera-help.py` | 55,939 | `e59440906a0092afe28ca514be9e7afdf6c21ca1009b765a710f0a4121f13a74` |
| ignored `catalog.json` | 577,696 | `a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed` |
| ignored `lisp-source-help.jsonl` | 9,817,347 | `8e59a784b805808e86b84be58fea8622f64fb3e79d7d0603ef64ce0ed1365190` |

The extracted Help confirms the Browser's `Select B` and the operations
program's `Select Shift-D` invocation, while the inspected program source and
compiled menu establish the later exact command sets.  Help is therefore one
evidence class, not a substitute for implementation inspection.

## Why the contributed `btree` system is not Statice storage

Open Genera media also registers a contributed CL-HTTP-adjacent system named
`btree`, pretty name `Binary Tree`, version 34.  Its three source modules define
classes and mixins for balancing ordinary binary-tree objects and include graph
commands and test code.  The ten-file, 97,433-byte subtree including compiled
files and journals has portable manifest SHA-256
`1734ca18619218085f009f6bf24676c9868f921b051eb1ff332e1ba0c68b2855`.

Statice does not declare this system as a dependency.  Its package exports
`make-btree-index` with the explicit description “Create a B* tree index,” and
its own storage `tree`, `scroll`, and `interface` modules implement that index
layer.  Occurrences of Statice names in the contributed system's journal are
merely the full loaded-system header recorded when a Binary Tree patch was made.
The similarly named facilities therefore have this bounded relationship:

| Facility | Data structure | Product role |
| --- | --- | --- |
| Statice internal index | page-backed B*-tree over persistent keys | database query/update access path |
| contributed `btree` | balanced binary-tree classes/mixins over Lisp objects | independent contributed library, later used near CL-HTTP material |

## Bounded CADR and LM-3 comparison

The public MIT CADR System 46 source snapshot was checked at Git commit
`8e978d7d1704096a63edd4386a3b8326a2e584af`.  A case-insensitive whole-tree
search over 1,895 files found no exact `Statice`, `DBFS`, `persistent object`,
`B-tree`, or `B* tree` term.  The tree does contain its own local file system,
file servers, directories, and ordinary in-world databases; those are not a
Statice persistent-object product.

The LM-3 System 303 Fossil export was checked at check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
Among 4,917 files, the exact bounded search found two versioned copies of one
[historical bug-board text](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fbug.lispm42),
not a Statice implementation.  That text embeds a 1987 Symbolics patch header
whose loaded-system census includes Experimental
Statice 30.0, DBFS 34.14, Statice-Index 6.0, Statice-Record 14.1,
Statice-Model 27.48, Statice Documentation 1.0, DBFS-directory 9.8, and
Statice-Utilities 2.5.  It is useful contemporary evidence that Statice ran in
the Symbolics development environment associated with the quoted patch, but it
does not make Statice part of the LM-3 System 303 source tree.

This bounded result supports “no CADR/LM-3 counterpart found in the two pinned
trees,” not the broader claim that no MIT Lisp Machine ever hosted related
research or connected to a later Statice server.

## Runtime load-state observation

The fresh [Genera computer-use harness](genera/genera-computer-use-harness.md)
session `d41-statice-20260718`, generation 2, evaluated one read-only form in
Dynamic Lisp Listener 1.  It called only `find-package`, loaded-only
`sct:find-system-named`, and `find-symbol`; it did not load a system, create a
namespace object, enable a service, or touch DBFS storage.

All six probed packages were absent: `STATICE`, `STATICE-MODEL`,
`STATICE-INDEX`, `DBFS`, `DBFS-DIR`, and `UFS`.  All seven loaded-only system
queries returned no: `Statice`, `Statice-Runtime`, `Statice-Server`,
`Statice-Browser`, `Statice-Documentation`, `DBFS-Utilities`, and contributed
`BTREE`.  With no `STATICE` package, the `STATICE-BROWSER` program symbol was
also absent.  This proves the base world's load state, not absence from the
licensed media and not failure of the products when deliberately loaded.

The session used the 54,804,480-byte Genera 8.5 world
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`,
1,533,760-byte VLM
`9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`,
346,880-byte debugger
`2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`,
15,248-byte ifconfig preload
`f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`,
21,280-byte X compatibility preload
`acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`,
and configuration
`5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`.
The Bubblewrap mode isolated user, mount, network, PID, IPC, and hostname
namespaces; exposed no host root, external route, or guest-visible host file
service; and used an MIT-SHM-disabled private Xvfb whose absence was verified.
Both pinned guest-X substitutions and the one-shot RFC 868 reply were observed.

The ordered action log contains two intent/outcome records and has SHA-256
`88f1577aede328c7ee24028d3e7f39b5d11716fab32ecc0cb70750d6f7ae24a2`.
A local 1200 by 900 evidence capture showed the complete results; PNG SHA-256 is
`875169201fe548ff9c0521e8f5c0342c9ac22ee36d57c6cab5fa0098310c6df3`
and normalized pixel SHA-256 is
`1c44a93f0afdce969207f11e4ac16f27ef49badeb1c43ac74fc74eb67c10e5a6`.
It remains in the ignored session tree because it shows only the probe, not a
visible Statice application state worth publishing.

The private world hash remained identical to the base.  The harness did not
invoke Save World or create a process checkpoint.  Shutdown reached its prompt,
sent and accepted confirmation, and observed cleanup progress, then encountered
the already characterized VLM cleanup stall and required bounded forced
termination.  `forced_stop` and `state_may_be_incomplete` are true;
`orderly_vlm_host_shutdown` is false.  No database or server had been opened, so
the run supplies load-state evidence only.

## Preservation and emulation implications

- A VLOD containing Statice code is not a Statice database backup.  Preserve the
  DBFS store, recovery and directory metadata, page-size/server identity, and
  backup or dump path separately.
- A textual Dump Database is a logical reconstruction.  It is preferable for
  cross-machine recovery, but it does not preserve byte layout, free pages,
  exact index shape, or the author's original schema source.
- `Show Database Schema` is not a source-code decompiler.  Its reconstruction
  omits documented source-level options, and later schema evolution can make it
  differ from the original declaration even when it is accurate about storage.
- An exact database copy duplicates entity identities.  Record the source and
  copy relationship and never use both as independent live databases without a
  verified identity-migration procedure.
- Preserve command/source/manual drift explicitly.  The TCP-only later source,
  CLOS conversion, `Data Only`, `Find Backup Volumes`, incomplete update warnings,
  and likely comment-copy mismatch should not be backported into a generic
  “Statice always behaved this way” account.
- Keep recovered SABs, VBINs, Lisp source, database pages, dumps, and screenshots
  out of the tracked tree unless their rights are established independently.
  Short command labels and original functional analysis do not authorize
  distribution of the underlying licensed implementation or documentation.
- A future emulator validation should begin with a disposable test file system
  and schema, test commit/abort and crash recovery before schema update, and
  preserve every pre-operation disk/volume identity.  Destructive maintenance
  commands must never be exercised against the purchased base media.

## Open questions

- **TODO:** map system version 466 and documentation version 426 to an exact
  marketed Statice release, if surviving release media or patch records establish
  the relationship.
- **TODO:** safely load Statice into a disposable derived world, create a
  rights-clear test schema/database on disposable DBFS storage, and exercise the
  Browser and operations frame through the Xvfb harness.
- **TODO:** verify whether release 466 still imposes the documented Statice 2.1
  `for-each*` limitations.
- **TODO:** confirm at run time whether Browser conflict comparison omits
  non-indexable values and whether its count/fetch phase can visibly diverge
  under a concurrent commit.
- **TODO:** confirm the `:comment` versus `:copy-comment` source mismatch against
  the loaded command and copied properties in a disposable database.
- **TODO:** establish the exact algorithm and supported contract of the
  source-absent fuzzy-backup modules; do not infer it from filenames.
- **TODO:** determine which backup device choices the preserved environment can
  actually configure without real tape hardware, and whether a file-backed,
  non-destructive test path exists.
- **TODO:** recover a complete compatibility matrix for 36xx and Ivory page,
  FEP-block, and backup formats from server source plus real media observations.

## Sources

- Symbolics, [*Statice User's Guide*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Statice.pdf),
  Statice 2.0 for Genera 8.0, document 999979; verified 2026-07-18.
- Symbolics, [*Release Notes for Statice 2.1*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Release-Notes-for-Statice-2.1.pdf),
  verified 2026-07-18.
- MIT CADR System 46 source snapshot,
  [commit `8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src),
  bounded comparison verified 2026-07-18.
- LM-3 System 303 Fossil export,
  [check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  bounded local comparison verified 2026-07-18.  The Fossil restoration tree is
  used as a separate historical witness and is not treated as the System 46
  source release.
- Licensed Open Genera Statice media, 172-file local manifest identified above;
  source, binary, Help, and system-declaration inspection performed 2026-07-18.

Last verified: 2026-07-18.

---
type: specification
title: Zmail mail-file format semantics
description: Exact release-bounded parser, serializer, recognition, option, property, failure, and conformance contracts for the System 303 and Genera 8.5 Zmail mail-file adapters.
timestamp: 2026-07-19T18:44:32-04:00
---

# Zmail mail-file format semantics

## Reconstruction claim

This document is the normative storage-format companion to the
[Zmail and mail composition reimplementation specification](zmail-and-mail-composition-reimplementation-specification.md).
It closes the text-format boundary for these two profiles:

- `C303-STORAGE`: the maintained LM-3 System 303 implementation in public source;
  and
- `G85-STORAGE-SRC`: the separately preserved System 452.1 / Zmail 442.0 source
  profile used to specify Genera 8.5 behavior.

The two profiles are not aliases. In particular, C303 and G85 disagree about Text
input, Unix boundaries, malformed Tenex input, Babyl error containment, status
properties, format discovery, and save architecture. An implementation selects one
profile per buffer and MUST NOT average those differences.

The compatibility boundary is the observable storage behavior defined here for
those exact source profiles. It excludes package/API compatibility, interactive
Zmail behavior outside mail-file I/O, and claims about untested preserved worlds.

This is a semantic and logical-character-I/O specification. It defines Lisp-machine
character records, message boundaries, property mappings, state transitions,
ordering, and failures. It
does not publish licensed Genera source or recovered mail, and it does not claim
that the logical characters specified here have one release-independent host-octet
encoding. Exact G85 KBIN words and their byte serialization remain a local licensed
oracle.

## Normative language and evidence classes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. Evidence labels mean:

| Label | Meaning |
| --- | --- |
| `C303-SRC` | direct observation of the public maintained LM-3 source at the pinned Fossil check-in |
| `G85-SRC` | direct local observation of the hashed licensed source profile; only original prose and non-secret identities appear here |
| `MANUAL` | public manual or release-note comparison, not a substitute for executable source |
| `INFERENCE` | consequence derived from source-visible control flow and stated as such |
| `TODO-RUNTIME` | exact preserved-world or byte observation still required |

An implementation claiming a strict row MUST implement the source behavior even
when a safer extension would be preferable. A safer extension MUST be selectable and
reported separately.

## Exact release and artifact profile

### Public C303 evidence

The public source is maintained LM-3, not pristine 1983 media. The selected Fossil
check-in is
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.

| Logical path | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `zmail/mfiles.lisp` | 68,281 | `663346b2927fbd9988b9fd754747ed472430d8a25ed90732e2a60bad3a6456e4` | common buffer, read loop, write-only Text, load/save state |
| `zmail/mfhost.lisp` | 48,590 | `4f388328fb4554d6f6d9979ba72981d2ac93bd14efa52d490cbf39c1cca8fce0` | ITS/Rmail/Babyl/Tenex/Unix/VMS formats and host selection |
| `zmail/defs.lisp` | identity inherited from the D08 source ledger | identity inherited from the D08 source ledger | status-property order and Text separator option |
| `zwei/primit.lisp` | 44,003 | `c75513e9dbe055368c868dd26addf42acba2d8c47d83dbb612b13c1c6d7d84db` | buffer-pointer construction and the forced-Text null-start failure boundary |

The canonical public links are in [Sources](#sources-and-verification).

### Licensed G85 source evidence

These suffixes identify local evidence without publishing its machine-specific root.
The complete 47-file selection and its content digests are in the
[declared-build source manifest](genera/zmail-declared-build-source-manifest.md).

| Portable suffix | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `sys.sct/zmail/mail-files.lisp.~1566~` | 205,514 | `1ade0babfa463a4c2780165f64f59ce4d25191d93af7770f7bf571d440ef3648` | shared loader/writer, Text, retry and format verification |
| `sys.sct/zmail/foreign-mail-file-formats.lisp.~1520~` | 57,759 | `6eabd4f8ce57fa85b48542a8c415528c331f78d37101b2e89db23642e91f32ee` | ITS/Rmail/Babyl/Tenex/Unix |
| `sys.sct/zmail/directory-mail.lisp.~1505~` | 11,544 | `d5b62077554e07496313aea9a864181d2db04cb60246def44ad7740e1e36debe` | Directory index and per-message files |
| `sys.sct/zmail/mailbox-pathnames.lisp.~1507~` | 25,415 | `86aba9f0cc4b2f2366ceddfbe5c272875f2d51460c9a170289ca0406c3cb9fb7` | host-specific possible/default/actual format rules |
| `sys.sct/zmail/kbin/buffer.lisp.~1511~` | 14,113 | `07c45298489141b5c75492b733c826c5468a2a0efbbad6db926058592319efc6` | KBIN buffer integration |
| `sys.sct/zmail/kbin/defs.lisp.~1512~` | local manifest | `544dd752725bf141c024212be979a69e13d9a6ea13bea2d500d536fc051e6f3f` | KBIN constants and representation definitions |
| `sys.sct/zmail/kbin/dump-defs.lisp.~1505~` | local manifest | `00fc429415ef537e38f52ab661fd5133b3cf9672c4530554dbb2b54e6ac66ee9` | KBIN writer definitions |
| `sys.sct/zmail/kbin/dump.lisp.~1519~` | local manifest | `bd45fd83efd76c919da23da4a4ef2e90c4e6e01644f081769a0b0524c75e4ff5` | KBIN writer |
| `sys.sct/zmail/kbin/level-1-defs.lisp.~1501~` | local manifest | `eed22620f1afb98928f703dd3dce2d415aa25767c315a58082aeb9985aa6710f` | KBIN level-1 definitions |
| `sys.sct/zmail/kbin/load-defs.lisp.~1501~` | local manifest | `519fe69efdb04d82cab903bc68363ff148111bb742203af1ef1f4b0c77e42d91` | KBIN loader definitions |
| `sys.sct/zmail/kbin/load.lisp.~1521~` | local manifest | `f6f08e2fc45afb6d3356b92992476fc27610c3d00d1b11ddc85eb18b09f4b50b` | KBIN loader |
| `sys.sct/zmail/kbin/trace.lisp.~1501~` | local manifest | `e4ef5888046569985a927af769eef9a5bc9142c9dcef63ef5e4c77beec5600e0` | KBIN tracing support |

The G85 source profile is not automatically identical to the preserved
`Genera-8-5.vlod` world. Any function-level world claim needs a separate oracle
record.

## Compatibility levels and selectable overlays

| Claim | Required behavior |
| --- | --- |
| `FMT-L1` | message and option data model; deterministic adapter dispatch; no external file mutation |
| `FMT-L2-C303` | exact C303 Rmail, Babyl, Tenex, Unix and VMS semantics, the source-visible unsupported Text-load path, host selection, and the public logical-fixture obligations below |
| `FMT-L2-G85-TEXT` | exact G85 Babyl, Rmail, Tenex, Unix, Directory and Text semantics; locally verified G85 serializer hashes are allowed but not published |
| `FMT-L2-G85-KBIN` | all G85 text semantics plus exact KBIN recognition, decoding, encoding, upgrade and failure behavior against local licensed fixtures |
| `FMT-L3-RUNTIME` | selected `FMT-L2` plus preserved-world comparison and timing-visible background I/O behavior |

`FMT-L2-G85-TEXT` may register KBIN as unavailable. It MUST NOT expose an in-memory
stub under the historical name. `FMT-L2-G85-KBIN` remains blocked by
`TODO-RUNTIME-ZM-G85-KBIN-BYTES` until exact licensed byte fixtures can be exercised
locally without entering the repository.

## Common abstract data model

### Buffer state

Each mail-file buffer owns at least:

| Field | Contract |
| --- | --- |
| profile | immutable `C303-STORAGE` or `G85-STORAGE-SRC` selector |
| adapter | exact format flavor and registration identity |
| pathname | translated pathname plus original host-family classification |
| stream | absent, input-open, output-open, failed, or closed-with-result |
| file identity | source-visible stream/file information used for conflict detection |
| header | ordered raw file-header records plus parsed property list |
| messages | ordered message identities; each has real wrapper interval, visible interval, status and ticks |
| append policy | source profile's option, not an adapter-independent boolean default |
| status | exact profile state; generic `loading`/`saving` labels may not erase release-specific states |
| partial I/O | last complete record/message, source position, stream result and pending external work |

The real message interval contains format wrapper material. The visible interval
excludes status/separator material and may exclude original headers. Moving a message
between incompatible adapters rewrites the wrapper and may reformat headers; a clone
MUST NOT treat every message as one undifferentiated byte string.

### Line model

Source line objects do not store a trailing newline as part of their active character
length. The loader receives a line, its active length and an EOF flag. Specifications
below use these tokens:

| Token | Meaning |
| --- | --- |
| `<CR>` | Lisp-machine Return line separator in source-visible character output |
| `<LF>` | linefeed in a foreign-file count where explicitly stated |
| `<CRLF>` | two PDP-10-counted characters produced for one Return |
| `<US>` | ASCII Unit Separator, code 31, the ITS/Babyl out-of-band delimiter |
| `<FF>` | formfeed/page, code 12 |
| `<TAB>` | horizontal tab |
| `<EOF>` | end-of-stream indication, not a stored character |

Fixture notation is descriptive; tracked documentation does not contain recovered
licensed mail bytes.

### Reader result algebra

The reader's boundary callback returns:

| Result | Meaning |
| --- | --- |
| `nil` | current line does not end the message |
| `true` | current line belongs to and ends the current message |
| integer `n` | first `n` characters belong to this message; optional remainder seeds the next |
| `start-next` | current line is excluded from this message and retained as the first line of the next |

Format state is reset to `nil` at each new message. The common reader sets its start
line only after a nonblank line is seen, but it still invokes the adapter callback
with a null start on blank input. If that callback reports an end, later buffer-
pointer construction can fault on the null start; a whitespace-only file therefore
cannot be assigned a generic no-message result without the adapter-specific branch.

### G85 third boundary value

G85 adds an explicit `new-line` remainder value for a numeric split. It truncates the
current line to the included prefix and stores `new-line` as the next message seed.
C303's Tenex implementation instead mutates the line graph when recovering a
mid-line boundary. These are not equivalent failure traces.

## Recognition and construction transactions

The exact existing/new-file precedence is incorporated from the parent D08
specification. This section defines the format probes that transaction invokes.

### C303 host computation

Every content probe reads the first line and resets the stream pointer to zero.

| Host family | No-stream default | Existing content choice | Append result | Possible interactive formats |
| --- | --- | --- | --- | --- |
| ITS | Rmail | exact first line `Babyl Options:` selects Babyl; otherwise Rmail | true only for Rmail first line `*APPEND*` | Rmail, Babyl |
| Tenex family | Babyl | exact Babyl marker selects Babyl; otherwise Tenex | always true | Tenex, Babyl |
| Unix | Babyl | exact Babyl marker selects Babyl; otherwise Unix | always true | Babyl, Unix |
| VMS | Babyl | first line exactly one formfeed selects VMS; otherwise Babyl | always true | Babyl, VMS |

Rmail's `*APPEND*` test is reached only in the non-Babyl ITS branch. The C303 source
contains no generic magic-priority pipeline.

### G85 host computation

G85 separates four generics: native choices, pathname-derived default, host fallback,
and content-derived actual format. Text is appended to a host's native choice list if
the native method omitted it.

| Host | Native/possible formats in order | Pathname default | Fallback | Existing-content priority |
| --- | --- | --- | --- | --- |
| LMFS/native | Babyl, Rmail, Directory, KBIN, Text | canonical Babyl/KBIN/Rmail type | Babyl | KBIN, Babyl, Directory marker, else character-compatible Rmail |
| ITS | Rmail, Babyl, KBIN, Text | canonical Babyl/Rmail/KBIN type | Rmail | KBIN, Babyl, else character-compatible Rmail |
| Tenex family | Tenex, Babyl, KBIN, Text | canonical Babyl/KBIN type | Babyl | KBIN, Babyl, else character-compatible Tenex |
| Unix | Unix, Babyl, KBIN, Text | raw `RMAIL` without type means Babyl; otherwise canonical Babyl/KBIN type | Unix | KBIN, Babyl, else character-compatible Unix |
| Macintosh | Babyl, Rmail, KBIN, Text | canonical Babyl/KBIN/Rmail type | Babyl | KBIN, Babyl, else character-compatible Rmail |

Tenex and Unix host option methods define Append as true for every format. Comments
that LMFS/Mac defaults should become KBIN are non-executable and MUST NOT change the
strict table.

### G85 probe order and pointer invariant

KBIN recognition precedes Babyl recognition. KBIN accepts either its native element
type or a four-character narrow stream. The latter constructs 16-bit opcode/version
pairs in normal and byte-swapped order, accepts only the exact format opcode and a
version within the source bounds, and resets the pointer. Babyl then checks the exact
first line `Babyl Options:` and resets the pointer. Directory checks the exact first
line `*Mail file directory*` and resets the pointer. Host fallback runs last.

Every normal return and every reported apparent-format path MUST leave the stream at
offset zero. A short four-character read, fat character, unsupported element type or
failed bound check is a KBIN nonmatch, not an exception-driven KBIN selection.

## C303 shared text loader and writer

### Load algorithm

For each message the C303 loop:

1. restores a retained start line from the previous call, if present;
2. otherwise reads a line with leader metadata;
3. at EOF with no nonempty line, returns no message when none was started, or supplies
   the adapter's canonical last line when a message was started;
4. skips leading lines containing only spaces or tabs when choosing the real start;
5. calls the adapter boundary method with line, active length, state, EOF and the
   message's first line;
6. when the callback returns an end result, constructs pointers from the retained
   start and publishes the message; a null start can fault before publication;
7. retains a `start-next` line or a line inserted by callback recovery for the next
   invocation; and
8. resets adapter state before the next message.

Previously published messages remain in the array if a later format parser fails.

### Write pipeline

New or moved messages are parsed before copying when necessary, receive the target
adapter's real header and trailer, have their end marker normalized, and have visible
headers reformatted only when source and destination formats are not header-compatible.
Status-in-file updates occur before serialization when the message tick exceeds the
buffer's status-update tick.

C303 uses the source buffer's line graph as its serialization representation. It does
not define one universal atomic replacement. An implementation must expose its
selected host's stream close/version result and must retain dirty/partial state on
error.

## C303 Rmail contract

### Grammar and boundary

~~~text
rmail-file    = [ append-line CR ] *rmail-message
append-line   = "*APPEND*"
rmail-message = message-text delimiter-line CR
delimiter-line = *prefix-char US *delimiter-tail
delimiter-tail = *(SP / TAB / FF)
~~~

`US` may occur at any index in the delimiter line. The boundary is valid only when
every later character is space, tab or formfeed. The visible message ends immediately
before `US`; the real wrapper consumes the whole delimiter line and starts the next
message on the following line. At EOF after message text, the loader supplies a
canonical one-character `US` line.

### Header and options

The exact first line `*APPEND*` is a file header and sets Append true. It is removed
from the message stream and retained in the buffer header. Any other first line is
message input and leaves Append false. Updating options inserts or removes precisely
that header line.

### Serialization

Before each appended message, the target normalizes the previous message end to a
line containing `US`. A message moved into Rmail receives no leading wrapper and one
Return as its real trailer. Header parsing is the ITS header parser. Rmail persists no
per-message status record beyond message header/body text.

## C303 Babyl contract

### File envelope

~~~text
babyl-file      = option-section US [ FF ] CR *babyl-message
option-section  = 1*option-line
babyl-message   = *blank-line status-line CR original-area eooh-line CR display-and-body
                  delimiter-line CR
eooh-line       = "*** EOOH ***"
delimiter-line  = US [ FF ]
~~~

The option reader appends each input line to the header interval and stops at the
first line containing `US`; it does not require `US` to be the only character. The
first-message locator searches the header interval for that line. If it contains only
`US`, C303 appends `FF` before returning the following line as the first message.

For a newly constructed Babyl file, Version defaults to 5 and the header ends in
`US`. A newly inserted message receives a leading blank line, `*** EOOH ***`, a
following blank line, and a trailing Return. When normalizing an existing message,
the final delimiter is `US FF` except for the final non-append normalization path,
where bare `US` is allowed. The in-memory message end is before the delimiter.

### Option-line grammar

An option line is split at its first colon. Its name is uppercased and interned as an
option key. With no colon, the value is Boolean true. With a colon, spaces and tabs
immediately following it are skipped. The remainder is decoded as follows:

| First value character | Result |
| --- | --- |
| `(`, quote, slash, or decimal digit | one Lisp object read with keyword package and decimal print/read base |
| anything else | remaining characters as an untrimmed string |
| no remaining characters after a colon | an array-index failure occurs before a value can be produced |

Known option-specific parsers override the generic rule. Unknown option keys and
values are retained in the property list. When updating the file, C303 edits a known
line in place, removes it when all properties represented by that line became false,
and appends nonfalse known properties not previously represented. `Babyl Options:` is
forced to be the first logical property.

The empty-tail failure is a strict C303 edge, not an invitation to substitute NIL or
an empty string: after whitespace skipping leaves the index at active length, the
generic branch indexes that position while testing the special-character set. An
unknown option whose value is an empty string can fail again during generic printing,
which likewise inspects character zero. A safety-corrected overlay MAY preserve an
empty string, but MUST report the divergence. G85 adds an explicit empty-tail parse
case, although its generic printer retains the empty-string character-zero defect.

### C303 Babyl option map

| Serialized name | Internal result | Parse/print rule |
| --- | --- | --- |
| `Babyl Options:` | `BABYL-P = true` | presence marker; printed first |
| `Version:` | numeric Version | decimal number; values outside inclusive 4–5 signal a continuable error and retain the parsed value/result path |
| `No Reformation` | Boolean | no value means true |
| `Gmsgs-Host:` | string or false | generic string handling |
| `Owner:` | string or false | generic string handling |
| `Mail:` | ordered pathname list | comma-separated, whitespace skipped before each item, merged against Zmail pathname defaults |
| `Append:` | Append and Reverse-New-Mail | absent value means Append true; otherwise octal bit 0 is Append and bit 1 is Reverse; printer emits one octal digit/mask |
| `Summary-Window-Format:` | Lisp object | one Lisp object in the selected reader environment |
| `Keywords:` or `Labels:` | keyword registry and original spelling string | comma-separated entries; an optional prefix through `=` is discarded when determining the keyword name |
| `Sort:` | sort selector | case-insensitive menu name or true when valueless |
| `Delete-Expired:` | yes/no/ask selector | case-insensitive menu name or true when valueless |

The settable list is Append, Reverse-New-Mail, Version, Mail, Owner, Sort,
Delete-Expired, No Reformation, Summary-Window-Format and Gmsgs-Host. Babyl-P and
the keyword registry fields are not ordinary UI-settable options.

### Version 5 status grammar

~~~text
status-v5    = reformatted "," basic-labels "," user-labels
reformatted = "0" / nonzero-text
basic-labels = *(SP basic-name ",")
user-labels  = *(SP user-name ",")
~~~

The parser is comma-driven. `0` means not reformatted; any other first field means
reformatted. Basic names are case-insensitively resolved through this ordered C303
table: `last`, `unseen`, `deleted`, `bad-header`, `answered`, `forwarded`,
`redistributed`, `filed`, `recent`. `badHeader` is first normalized to `bad-header`.
An unknown basic name signals a Zmail error. User names reuse a case-insensitive
keyword registry entry or create an interned uppercase symbol while retaining the
first observed display spelling.

The serializer emits basic labels in exactly the table order, then user keywords in
message order. Every emitted label is preceded by one space and followed by a comma.

### Version 4 status grammar

A v4 status line begins with optional `D` for Deleted, followed by an octal integer,
followed by zero or more space-plus-`{keyword}` items. The five low bit positions map,
in order, to Reformatted, Unseen, Losing-Headers, Answered and Filed; bit 1 is XORed
with octal 2 so the stored sense represents Seen rather than Unseen. Serialization
starts with octal `10000`, adds those property bits, applies the Seen inversion,
appends each keyword in braces, and overwrites the first character with `D` when
Deleted.

### Header split and malformed input

C303 skips blank lines to find the status line, parses it, then searches up to the
message end for `*** EOOH ***`. When found, lines after the status and before the
sentinel are the original header area, and the visible message starts on the line
after the sentinel. If the sentinel is absent, the selected C303 method does **not**
raise the explicit contained `BAD-BABYL-MSG` condition introduced in G85; it leaves
the status line as the split reference and starts visible text on its following line.
Strict compatibility preserves this malformed-input result.

The blank-line skip has no end-of-message guard. A wrapper containing only blank
lines can therefore walk beyond the real interval and fail; C303 does not convert
that case into G85's contained Null-Message condition.

## C303 Tenex contract

### Status record

~~~text
tenex-status = received-date "," decimal-byte-count ";" octal-status
~~~

The date prefix ends immediately before the comma. The so-called byte count is the
decimal field between comma and semicolon. At this layer it is a PDP-10 logical
character count: an ordinary stored character contributes one and each Lisp-machine
Return contributes two for the foreign CRLF representation. The status field is
octal. Low bits, after XOR with one, map in order to Unseen, Deleted, Always-Show and
Answered.

Boundary recognition and later status parsing are deliberately different. The
boundary method recognizes only comma, later semicolon, and a decimal count between
them; it does not validate the date or octal status. The before-parse method accepts
any nonempty first line with comma and later semicolon, stores a false Received-Date
when date parsing fails, and may signal while parsing the octal flags. Whether or not
those delimiters exist, it then moves the visible message start to the following
line. A strict clone MUST preserve this unconditional first-line hiding.

The byte count covers the visible message region and counts every Return as two
PDP-10 characters. On rewrite, the received date falls back from Received-Date to
Date and then the current time; the status field is exactly 12 octal digits; and the
timezone text, date, clock and decimal byte count are regenerated.

### Boundary state machine

Let `remaining` be the current Tenex state.

1. The first line is probed for comma, semicolon and a decimal count. A recognizable
   line installs that count without subtracting the status line. An unrecognizable
   one enters recovery state `1`.
2. If `remaining >= line-length`, subtract `line-length + 2`; the message ends after
   the line when the result is nonpositive.
3. Otherwise the expected boundary is inside or before the line. Search from the
   expected offset for a comma and later semicolon whose intervening field is a
   decimal count. This test still does not validate a date or status field.
4. If such a probable next status exists and the expected offset was nonzero, insert
   a Return at that offset, add two to the previous message's stored byte count, end
   the current message, and let the common reader consume the newly split suffix on
   its next iteration. The newly parsed count is returned as callback state but is
   discarded when the common reader resets state for the next message.
5. If no probable status is found, set state to `1`, do not end the message, and scan
   each later line until one resembles a status line.

Two strict defects follow from those rules. Recovery state `1` splits a later
candidate at character index one, so the first character remains attached to the
malformed message and the suffix begins one character into the candidate. A declared
count of zero is also not treated as end-of-message on the status line: on a later
nonempty candidate, entry state zero suppresses the split but returns true, causing
that whole candidate line to remain in the preceding real interval rather than seed
the next message. These are source-profile results, not recommended repair policy.

The nonzero-offset repair mutates the in-memory source text and, when the original
status count can still be parsed, its earlier status count. It is not strict rejection
and it is not transactional. A safe parser MAY offer rejection as a separate mode.

## C303 Unix contract

### Boundary recognition

The first nonblank line starts a message. A later line starts the next message only
when all these tests pass:

1. it starts exactly with `From `;
2. it contains another space after the beginning of the sender portion;
3. after that position, one of the configured weekday names occurs; and
4. at least one decimal digit occurs after the weekday occurrence.

At EOF the final active line length terminates the message. The boundary line is
retained as `start-next`. Unlike G85, a bare `From ` prefix is insufficient.

### Envelope parse and synthesized headers

The envelope parser examines a consecutive run of lines beginning `From ` or
`>From ` and selects the last line in that run as its parse candidate; if no movement
was possible, it uses the original first line. Starting after the five-character
marker, it grows the sender field word by word until the next word matches a weekday
abbreviation. Address and date errors are stored as report strings rather than
re-signaled by this helper.

The fixed start offset remains five even when the selected candidate starts with the
six-character `>From ` prefix. Thus a selected escaped candidate is not generically
unescaped: its leading `>` changes the field alignment and can yield an empty or
malformed sender parse. Only the first real line is later hidden, so any additional
candidate lines remain in the visible interval. A clone MUST NOT turn this narrow,
source-visible scan into mboxrd unescaping.

Only the first real line is removed from the visible interval. Parsed envelope sender
and date are stored as `UNIX-FROM-HEADER`; the date supplies Received-Date and, if
missing, Date; the sender supplies From if missing. The selected source does not
define a general mboxrd body unescaper. Consecutive `>From ` handling above is an
envelope-parse heuristic, not permission to claim complete `>From` round-trip support.

### Serialization

The C303 rewrite test compares current and saved From address entries pairwise for
equal Name and Host fields but does **not** compare list lengths. Because the parallel
loop stops with the shorter list, equal common prefixes—including two empty lists—can
suppress a needed rewrite. Otherwise it rewrites or inserts a `From ` line, prints the
current address list, then an optional ctime-shaped date using decoded Received-Date.
The ordinary message headers follow. The source has no adapter method that escapes
arbitrary body lines beginning `From `; strict conformance MUST test both the
prefix-length defect and the absence of body escaping rather than silently claiming
modern mbox compatibility.

## C303 VMS contract

### Detection and boundaries

VMS is selected only on a VMS pathname when the first line equals one formfeed. Each
message begins with a formfeed line; a later formfeed line is retained as the next
message start. EOF ends the current message. The formfeed wrapper is excluded from
visible text. A new message receives formfeed-plus-Return before its content and one
Return after it.

### Header variants

The first visible line is parsed as a fixed VMS From record. The sender occupies the
12-character field after the `FROM:<TAB>` prefix, trimmed of spaces; the following
date portion is parsed if possible, with an error report string retained on failure.

If that sender is exactly `CHAOSMAIL`, the remaining message is parsed as ordinary
headers. Otherwise the parser conditionally consumes, in order:

1. a `TO:<TAB>` line, split at commas into nonempty space-trimmed names on the
   pathname host; then
2. a `SUBJ:<TAB>` line, whose value is the substring after the tab.

The fixed sender/date always supplies Received-Date and missing Date/From properties.
On reformat, the writer emits a CHAOSMAIL-style From line derived from Received-Date
or Date, prints known ordinary headers, inserts a blank line, and removes the old
visible header region. Multics is not registered in this profile.

## C303 Text contract

Text is write-only by declared capability. It leaves headers visually unchanged and
replaces each message's final line with the configured Text separator. The ordinary
arbitrary-format command excludes it because `MAIL-FILE-REPARSABLE-P` is false.

The source comment says an attempted read should yield no messages, but the selected
method body and common reader do not implement that comment. The boundary callback
returns true for every line. For a non-space/tab line the common reader sets `START`
and publishes that one-line message. If the first line, or any line after a completed
one-line message, is blank or contains only spaces/tabs, `START` remains null but the
callback still returns true; the reader then calls buffer-pointer construction with
that null line and reaches a fault before another message can be published. Thus a
forced low-level load over consecutive nonblank lines yields one message per line
until EOF or the first blank logical line. The exact runtime condition object and
cleanup after the blank-line failure remain
`TODO-RUNTIME-ZM-C303-TEXT-FORCED`. This is executable control-flow analysis
(`C303-SRC`), not a System 303 band observation.

A port MAY reject reopening a Text buffer, matching the supported UI boundary, or
label it as lossy. Such behavior is a safety/policy overlay. A port that exposes the
forced low-level path under strict source semantics MUST reproduce both its one-
message-per-consecutive-nonblank-line result and its blank-line failure boundary,
and MUST NOT report the source comment as observed behavior.

## G85 shared text loader and writer

### Verification before message input

Starting a load changes the buffer to `:LOADING`, opens with the adapter's element
type, verifies the format, loads any file header, queues mail checks, then reads
messages. The default verifier rejects an incompatible stream element type, a KBIN
signature, and the Babyl marker. An invalid byte size causes a reopen with default
element type and an apparent-format condition.

On the first eligible wrong-format condition, the caller aborts this load, changes
the existing buffer's flavor to the supplied apparent format, and retries. A
condition without an apparent format is re-signaled. Later retries use the explicit
different-format restart. Explicit Format and interactive format selection disable
the automatic first switch. These format errors occur after buffer construction and
must preserve the parent specification's retry order.

### Load algorithm

For every text adapter other than Directory and KBIN, G85:

1. restores `NEXT-MSG-START-LINE`, otherwise reads the next line;
2. returns no message at EOF when no message exists and the line is absent or empty;
3. constructs a message only on the first line that is not entirely space or tab;
4. invokes the four-argument boundary method;
5. inserts the whole line for `nil`/`true`, the positive prefix for a positive integer,
   no characters for `start-next` or integer zero;
6. saves the boundary's explicit remainder or retained current line as the next
   start; and
7. returns the complete message plus whether more input may remain.

The generic parse wrapper converts an uncaught message parse error into Unparseable
under an explicit “mark and continue” restart. Format-specific before methods may
instead attach a contained condition and return. Parsing is lazy and may happen
after the structural load, so “file loaded” does not imply every message header was
successfully interpreted.

### Save algorithm

G85 owns a per-save structure with Current-Message and an adapter-specific slot.
Text formats place an interval stream in that slot; KBIN replaces it. A save from
`:IDLE` skips file output when neither modification tick exceeds the buffer tick,
but still enters `:SAVED` so finish work can run. Otherwise it:

1. enters `:SAVING`;
2. opens the selected pathname and element type for output, superseding only when
   the pathname's version semantics require it;
3. writes the file header;
4. writes messages in increasing sequence index while updating Current-Message;
5. enters `:SAVED` only after all message writes return; and
6. finishes the save, pending-inbox work, identity/ticks and close in the common
   profile-defined order.

An error during message `n` leaves prior output already written. Retry may resume
with retained saving state and an explicit start index. An abort closes/abandons by
the common save method and does not imply rollback of external versions or
Directory member files.

## G85 Rmail contract

G85 Rmail uses the same exact `*APPEND*` header and ITS `US` delimiter grammar as
C303, with these release-visible differences:

- the ITS boundary callback also returns true at EOF, so a final unterminated message
  is complete without fabricating a canonical delimiter line;
- verification first applies the G85 default rejection of wrong element type, KBIN
  and Babyl, then consumes `*APPEND*` into the header interval if present;
- each serialized message begins on a fresh line; and
- after each serialized message the ITS mixin writes a fresh line followed by `US`.

Rmail's only settable file option is Append. Updating it replaces the entire header
interval with either `*APPEND*` plus Return or an empty interval and marks the
sequence hard-modified.

## G85 Babyl contract

### Envelope and version

G85 requires the first line to equal `Babyl Options:`. It reads option lines into the
header interval until EOF or a line containing `US`, but the `US` line itself is not
inserted as an option line. Versions 4 and 5 are accepted. Version is initialized to
the format default, 5, before header parsing, so an absent Version line retains 5;
only an explicitly parsed absent-number or out-of-range value signals the selected
source condition. This is defaulting, not an on-disk upgrade transaction.

Saving writes the updated option header, a fresh line and `US`; each message then
writes `FF CR`, its wrapper/header/body representation, a fresh line and the ITS
`US` terminator. A new v5 message leader is exactly a nonempty status line `0,,`,
then `*** EOOH ***`, then a blank line. A new v4 leader uses `0` instead.

### Generic and specific option decoding

The first-colon split and generic value classes match C303, except that option keys
are keywords and an empty post-colon tail is explicitly the empty string. Lisp
objects are read in a standard I/O environment. Unknown lines are preserved; update
logic changes only options in the buffer's declared possible set, and retains the
relative order of existing lines. Babyl-P is forced first.

The explicit empty-string parse does not imply an exact empty-string round trip for
an unknown option. The generic printer tests character zero before choosing display
syntax and can fail on an empty string. Known options with their own printers follow
those printers instead. Conformance therefore records this failure rather than
normalizing it away.

| Serialized option | G85 result/delta |
| --- | --- |
| `Babyl Options:` | Babyl-P true, forced first |
| `Version:` | inclusive 4–5 version |
| `Owner:` | string or false |
| `Mail:` | ordered pathnames parsed/printed with the heuristic maybe-hosted pathname routines |
| `Gmsgs-Host:` | parser/printer is registered, but this key is not in the Babyl buffer's declared Possible or Settable lists |
| `Append:` | same octal Append/Reverse bits as C303 |
| `Reformat-Headers-P:` | true, false, Save-Both or source menu value; this new option takes precedence over legacy controls |
| `No Reformation` | legacy compatibility input; not settable through the G85 Babyl option list |
| `No Original:` | true, false or Save-Original legacy input; not settable through the G85 Babyl option list |
| `Sort:` / `Delete-Expired:` | selected menu value or true when valueless |
| `Summary-Window-Format:` | selected G85 summary format, defaulting to `:DEFAULT` |
| `Reformat-Template:` | Lisp object read in the user package |
| `Keywords:` / `Labels:` | keyword spellings and registry, with `Labels` printed for v5 and `Keywords` for v4 |

The declared possible list has 15 keys: Append, Babyl-P, Reformat-Headers-P, both
legacy reformatting keys, Reverse-New-Mail, Version, Mail, Owner, Sort,
Delete-Expired, Keywords, Keywords-String, Summary-Window-Format and
Reformat-Template. The settable subset has 10: Append, Reformat-Headers-P,
Reverse-New-Mail, Version, Mail, Owner, Sort, Delete-Expired,
Summary-Window-Format and Reformat-Template. Sticky options are Append, Babyl-P and
Version.

### Reformatting-option normalization

If Reformat-Headers-P is explicitly present, it wins:

| Reformat-Headers-P | No Reformation after normalization | No Original after normalization |
| --- | --- | --- |
| `:SAVE-BOTH` | false | false |
| false | true | false |
| true | false | false |

If it is absent, No Reformation true produces Reformat-Headers-P false. Otherwise No
Original `:SAVE-ORIGINAL` produces true, false produces `:SAVE-BOTH`, and true also
produces true. These legacy pairs are not one-to-one; retaining the explicit new
property is therefore observable.

### Status mapping

The v4 bit/keyword grammar remains the C303 grammar. G85 v5 uses the same three-field
shape but has these exact deltas:

- nonzero Reformatted is stored as `:IN-FILE`, not Boolean true;
- basic labels parse against this order: Last, Last-Undeleted, Unseen, Deleted,
  Losing-Headers, Unparseable, Answered, Forwarded, Redistributed, Redirected,
  Filed, Sent, Recent;
- Losing-Headers, Unparseable and Redirected are parseable but flagged not to be
  serialized as basic status labels;
- two distinct `bad-header` entries map to Losing-Headers and Unparseable; the first
  case-insensitive match controls parsing;
- label fields without a leading space are accepted for Unix RMAIL compatibility;
  and
- user labels are interned in the keyword package.

The writer emits only non-ignored basic properties in table order and user keywords
in message order. Recent is persistable only at version 5 or later.

### Contained malformed-message behavior

A blank-only message receives a Null-Message condition in Unparseable. A status parse
failure is wrapped as a Bad-Babyl-Message condition and stored in Unparseable. A
missing `*** EOOH ***` before the visible message end is handled the same way. These
cases return from the format's before-parse method without moving the visible start
past a valid sentinel. They do not abort the whole mail-file load by default.

When valid, lines after the status and before `*** EOOH ***` become an
Original-Headers-Interval; lines through the sentinel are reassigned to the real
wrapper; and visible text starts after the sentinel. Parsing prefers the original
header interval and normalizes a parsed `Re`-family subject key to Subject before
later daemons observe it.

## G85 Tenex contract

### Probable status predicate

A line is a probable status line only when it contains a comma, a later semicolon,
and all three fields parse without error as an RFC822 date-time, a base-10 integer
byte count with no junk, and an unsigned base-8 integer status with no junk. The
predicate returns the parsed date, count and flags together; a failure returns four
false values. As in C303, the source-named byte count drives logical foreign-file
character positions here; it is not a count of bytes in a modern host encoding.

### Boundary state machine

1. On the first line, a probable status installs its byte count; count zero ends the
   message on that line. A non-status line enters `:NO-STATUS-LINE` recovery.
2. EOF with an empty line ends a partial message.
3. In `:NO-STATUS-LINE`, non-status lines remain in the current malformed message.
   The next probable status line is retained as `start-next` and ends it.
4. For numeric state smaller than the current active line length, the first `state`
   characters end this message and a newly allocated copy of the remaining
   characters seeds the next message.
5. Otherwise subtract `line-length + 2`, and end after this line when the new value is
   nonpositive.

Unlike C303, G85 does not insert a Return into the current line or rewrite the prior
status count during a short-count repair. Its numeric split and explicit remainder
are observable.

The before-parse method marks a message with an invalid leading status line
Unparseable, but a valid one stores Received-Date, maps the XOR-one low flags to
Unseen, Deleted, Always-Show and Answered, and moves visible text past the status.

### Serialization

The status writer chooses time from Received-Date, then Date (using the first numeric
member where necessary), then current time. It produces a two-digit day, short month,
year, time, timezone forced to a leading hyphen where needed, decimal byte count and
12-digit octal flags. The count is computed by running the actual message—including
epsilon encoding and original-header choice—through a counting stream where Return
counts as two characters. The real message end is first normalized to a line
boundary.

## G85 Unix contract

### Strict boundary delta

After the first line, **every** line whose first five characters are exactly `From `
starts the next message. G85 performs no C303 weekday/digit plausibility test. EOF
ends the current message at the active line length. Therefore body text beginning
`From ` splits a message unless an external producer escaped it; the selected writer
does not provide a general body-line escaping pass.

### Envelope and visible interval

The first real line is treated as the Unix envelope and removed from the visible
interval when nonempty. Its sender ends at the first space after the marker; the rest
is parsed as a universal time. Address or time failures become an error object stored
as Unix-From-Header and later Losing-Headers rather than immediately aborting the
file.

Trailing blank lines are normalized by deleting from the last nonblank endpoint to
the real end, inserting exactly two Returns, and placing the visible end before the
final blank-line wrapper. Parsed envelope values fill missing Received-Date, Date and
From. When it synthesizes Date or From headers, it inserts them at the visible start,
adds a blank line, records the new Headers-End pointer, fills missing hosts in To/Cc/
From from the pathname host, and refreshes the summary when those values changed.

### Serialization

The selected source contains two strict serializer defects that a compatibility
profile MUST expose rather than repair silently:

- A list-valued Date is reduced to its minimum. A list-valued Received-Date is also
  reduced, but the result is mistakenly assigned to the local Date variable while
  the original list remains in Received-Date. The later precedence expression still
  selects that list and can pass it to time decoding.
- When a parsed envelope is an error object, the method constructs a fallback saved
  envelope property using the user's local address and Received-Date, Date or current
  time. If it rewrites the physical line, however, it prints the current From header
  value rather than that fallback address. With no current From value, the stored
  property can name the local user while the emitted envelope sender is empty.

Outside those defects, the rewrite predicate requires equal From-list lengths, an
existing `From ` marker, and pairwise-equal Name and Host fields; otherwise it
rewrites or inserts the record and then re-normalizes the two-Return trailer. The
emitted date is ctime-shaped local date text. A safety-corrected overlay MAY use the
minimum Received-Date and the fallback address consistently, but MUST identify both
changes.

## G85 Directory contract

### Index grammar

~~~text
directory-index = marker CR *option-line CR CR *message-path-line CR
marker          = "*Mail file directory*"
~~~

The marker must be the exact first line. Options use the Babyl option parser and stop
at EOF or the first empty line. Directory-Mail-File true is forced as the first
property and Version defaults to the highest Babyl version. The declared Possible
list is Directory-Mail-File, Version, Append, Reverse-New-Mail, Mail, Owner, Sort,
Delete-Expired, Keywords, Keywords-String, Summary-Window-Format and
Reformat-Template. The settable subset omits Directory-Mail-File, Version, Keywords
and Keywords-String.

Every later line is parsed as a pathname against Zmail pathname defaults; a nonempty
final line is accepted even when its read also reports EOF. Structural load creates
an empty message with a File-ID tuple containing the member pathname, no file info and
the file tick; it does not open the member. The same pathname object is pushed onto
the buffer's remembered member list, so that list is in reverse index-read order.

### Lazy member parse

On first parse, a member with absent info is opened and copied into the message's real
interval. Only after copy does the implementation record stream Info and member file
tick. The first member line is always parsed as a v5 Babyl status line and excluded
from visible text, regardless of the Directory Version option. Failure opening a
member leaves the index message unchanged. Failure during copy can leave partially
inserted real-interval text, while the File-ID's Info remains false and its old tick
remains; there is no rollback before a retry.

### Save and allocation order

Before this method runs, the common save predicate updates modified status lines and
the Directory option header. For each message in sequence order, Directory then:

1. allocate a File-ID if absent;
2. rewrite the member only when its real-interval tick exceeds the member file tick;
3. close the member, then record Info and a new tick; and
4. write its pathname to the index using the Dired string representation.

Allocation uses an in-memory `[next, reserved-upper)` cache. When the cache is absent,
it reads the first line of `UID.LISP` or starts at 1, then installs `[lower, 0)` in the
buffer. When absent or exhausted, it computes `upper = lower + 200`, stores that upper
in the in-memory cache **before** opening/writing `UID.LISP`, and only after the write
returns does it return and increment the prior lower value. A UID-write failure thus
leaves `[lower, upper)` looking usable in memory even though the durable reservation
did not complete; a retry in the same buffer can allocate `lower` without rewriting
the UID file. This source-visible partial failure MUST be preserved by strict mode or
corrected only in a named safety overlay. A member pathname has decimal name, type
`MSG`, and newest version.

The common finish method closes the index stream, records its Info, clears the stream,
deletes inserted inboxes, advances the buffer tick, and sets status to `:IDLE`.
Directory's after method then enumerates current member pathnames, deletes each
previously known pathname object not `MEMQ`-present in that list while ignoring
File-Not-Found, and finally replaces its remembered list with sequence order. Thus
member writes and UID reservation precede the index commit, while stale-member
deletion follows the commit and even the transition to `:IDLE`; no encompassing
rollback exists. A non-File-Not-Found deletion error escapes with the committed index
and idle status but before the remembered list is replaced.

## G85 Text contract

Text is non-reparsable and is excluded from arbitrary-format choices. Its boundary
callback ends only at EOF, so strict G85 input creates one large message for a
nonblank file. Serialization always chooses reformatted rather than original headers,
writes a fresh line after each message, emits the configured Text separator, and
finishes on a fresh line.

This one-message input result differs from C303's forced source path, which terminates
and publishes at every nonblank logical line. Both releases nevertheless declare Text
non-reparsable, so neither result should be advertised as a supported interchange
format.

## G85 KBIN boundary

KBIN is a 16-bit preparsed representation with its own element type, saving state,
opcode/version signature, loader, writer and upgrade behavior. The exact eight-file
implementation is part of the declared historical build closure, but licensed byte
sequences and recovered message content cannot be committed here.

A strict KBIN claim therefore requires a local oracle record containing:

- hashes and sizes of synthetic, locally generated fixtures rather than purchased
  mailbox content;
- format version, opcode and byte-order recognition result;
- parsed message/property digest and insertion order;
- writer output hash, round-trip digest and exact failure point;
- old-version upgrade and Reparse-All result; and
- source-manifest content and selection digests.

The repository report MUST include only those identities and results. Until
`TODO-RUNTIME-ZM-G85-KBIN-BYTES` is closed, the conformance report MUST mark KBIN
unavailable; it may still claim `FMT-L2-G85-TEXT`.

## Property preservation matrix

| Format/profile | Persisted outside ordinary message headers | Not safely round-tripped by the adapter |
| --- | --- | --- |
| C303 Rmail | Append file header | internal status, keyword registry |
| C303 Babyl v4 | five bit properties, Deleted marker, user keywords; file options | properties outside v4 bit set; malformed/unknown basic status |
| C303 Babyl v5 | ordered saved-basic set, user keywords; file options | nonlisted internal properties |
| C303 Tenex | Received-Date and four status bits | user keywords and other internal status |
| C303 Unix | envelope sender/date | arbitrary mbox escaping; unrelated internal status |
| C303 VMS | fixed/CHAOSMAIL sender/date plus parsed header values | general internal status |
| C303 Text | each written message's text and configured separator; read is unsupported | original grouping and all internal status; forced source path treats consecutive nonblank logical lines as one-line messages and faults when an end is reported with a null start on blank input |
| G85 Rmail | Append file header | internal status and keyword registry |
| G85 Babyl v4 | v4 bits and keywords; normalized file options | newer status properties |
| G85 Babyl v5 | non-ignored saved-basic properties, user keywords, original/reformatted-header relationship; file options | ignored Bad-Header/Redirected labels as basic storage labels |
| G85 Tenex | Received-Date and four status bits | user keywords and other internal status |
| G85 Unix | envelope sender/date | body `From ` escaping and unrelated internal status |
| G85 Directory | v5 status leader, ordinary message content, per-message file identity and index order | atomicity across UID, members, index and deletion |
| G85 Text | reformatted headers/body and separator | original headers, boundaries and internal status |
| G85 KBIN | implementation-defined preparsed property graph | not claimable without the local byte oracle |

Ordinary mail header parsing may derive many additional properties in memory. That
does not make them format metadata.

## Failure and abort matrix

| ID | Trigger | C303 strict result | G85 strict result |
| --- | --- | --- | --- |
| `FMT-F01` | wrong explicit format | parser/host-specific error; no automatic universal switch | wrong-format condition; explicit choice disables first automatic apparent-format switch |
| `FMT-F02` | first automatic format mismatch | host computer normally selected before construction | abort current load, change same buffer flavor only when apparent format exists, retry once |
| `FMT-F03` | explicit unsupported Babyl version | continuable error from option parse | signaled option error under load/retry machinery; an omitted Version retains default 5 |
| `FMT-F04` | missing Babyl EOOH | no dedicated contained error; visible start follows status line | attach contained Bad-Babyl condition to Unparseable and stop format before-parse work |
| `FMT-F05` | malformed Babyl status | Zmail error may escape parsing | contained Bad-Babyl condition in Unparseable |
| `FMT-F06` | malformed Tenex first status | boundary state becomes 1; later candidate is split at index one, and before-parse always hides the first real line | malformed prefix forms one message until next probable status and is marked Unparseable |
| `FMT-F07` | nonzero Tenex count ends mid-line | split line graph at the remaining-count index and add two to the prior count when parseable | truncate current line at numeric index and carry a copied remainder; prior count untouched |
| `FMT-F08` | Unix body begins `From ` | only becomes boundary if weekday/digit heuristic passes | unconditional boundary after first line |
| `FMT-F09` | Unix envelope parse error | report strings may populate sender/date slots | error object becomes Unix-From-Header and Losing-Headers |
| `FMT-F10` | Text reopened through forced low-level path | unsupported by the normal chooser; consecutive nonblank lines yield one message each, but an initial or intervening blank/space-tab-only line reaches null-start pointer construction and faults; adjacent comment instead predicts no messages | one large message for nonblank input |
| `FMT-F11` | Directory member missing | format absent | index message remains; lazy open fails when parsed |
| `FMT-F12` | Directory UID write fails | format absent | allocation stops before member/index output, but the advanced cache upper remains and a same-buffer retry can allocate without durable reservation |
| `FMT-F13` | Directory member write fails | format absent | earlier UID reservation/member writes remain; index sequence not globally rolled back |
| `FMT-F14` | Directory stale-member delete fails | format absent | File-Not-Found ignored; another file error escapes after index commit and `:IDLE`, before remembered member-list replacement |
| `FMT-F15` | message write `n` fails | prior stream/file output and dirty state exposed | prior messages already written; Current-Message identifies `n`; retry/abort is explicit |
| `FMT-F16` | output close/version failure | exact host stream state retained | buffer must not become clean merely because message loop finished |
| `FMT-F17` | KBIN wrong element type/version | format absent | typed wrong-format/nonmatch behavior; exact byte result reserved locally |

No row implies a whole-file transaction. A conforming host abstraction records
whether its file service created a version, superseded in place, or left a partial
stream.

## Exact logical-character fixtures

### Fixture codec

The fixtures below are generated from ASCII text plus the token table in
[Line model](#line-model). `CR` terminates each logical line. A test runner MUST
record both its token stream and its host octet encoding; conformance at this layer is
against tokens. This avoids pretending that Lisp-machine characters, PDP-10 file
characters and modern POSIX bytes are one encoding.

For each fixture, the test oracle records:

~~~text
profile, adapter, host-family, option inputs,
token-stream-before, structural-message-count,
per-message real-token-span, visible-token-span, ordered status properties,
token-stream-after-normalize, condition/restart trace, final buffer/file state
~~~

### Public C303 fixture set

| Fixture | Logical input | Exact required observation |
| --- | --- | --- |
| `C303-RM-01` | `*APPEND* CR` + one RFC-style message + `CR US CR` | Rmail selected on ITS, Append true, header excluded, one message, visible end before `US` |
| `C303-RM-02` | message text ending `abc US SP TAB FF CR` | delimiter valid at index 3; `abc` belongs to visible message |
| `C303-RM-03` | message text ending `US "x" CR` then EOF | that line is content, not a delimiter; canonical EOF delimiter closes one message |
| `C303-B5-01` | `Babyl Options: CR Version: 5 CR Labels: work CR US FF CR 0, unseen,, work, CR` + original headers + `*** EOOH *** CR` + display/body + `US CR` | Babyl selected; Version 5; Unseen true; one Work keyword; original interval and display interval distinct |
| `C303-B5-02` | same envelope with `badHeader` basic label | alias resolves to Losing-Headers |
| `C303-B5-03` | v5 status with unknown basic label | Zmail status-line error at that label; no invented keyword conversion |
| `C303-B4-01` | Version 4 and status `D10000 {work}` | Deleted true; bit map and Work keyword decoded with Seen inversion |
| `C303-BAD-EOOH-01` | valid status followed directly by ordinary header/body and delimiter | no G85-style contained Bad-Babyl condition; visible start is line after status |
| `C303-BAD-EMPTY-OPTION-01` | unknown option line ending immediately after `:` | array-index failure at active length; no invented empty-string value |
| `C303-BAD-VERSION-01` | `Version: 3` | continuable unsupported-version condition records parsed value and selected continue/abort path |
| `C303-TX-00` | valid Tenex status whose decimal count is zero, followed by a nonempty line and EOF | zero does not terminate on the status line; following text remains in that message and the visible interval begins after status |
| `C303-TX-REPAIR-01` | declared count ending inside a later line that also contains a probable next status | Return inserted at expected offset, previous count increased by two, completed prefix retained, next status reused |
| `C303-TX-SCAN-01` | malformed status followed by text then a probable status line | recovery state scans linewise; candidate splits at index one, leaving its first character in the malformed message and reusing only its suffix |
| `C303-UX-01` | two conventional mbox messages with weekday and digits in second envelope | two messages; second envelope retained as `start-next` |
| `C303-UX-FALSE-01` | body line `From prose without a calendar token` | one message; line remains body content |
| `C303-UX-ESC-01` | consecutive initial `From ` and `>From ` lines | last candidate is parsed at fixed offset five despite its six-character marker; only the first real line is hidden and no generic unescape occurs |
| `C303-UX-PREFIX-01` | current and saved From lists with equal first entry but unequal lengths | prefix-only comparison suppresses rewrite |
| `C303-VMS-01` | `FF CR FROM:<TAB>` fixed sender/date, optional To then Subject, body, next `FF` | VMS selected on VMS host; fixed fields consumed in exact order; next formfeed retained |
| `C303-VMS-CHAOS-01` | `FF CR FROM:<TAB>CHAOSMAIL...` plus ordinary headers | ordinary header parser used; fixed fallback still supplies absent date/from |
| `C303-TEXT-01` | force the low-level Text reader over two consecutive nonblank lines, then separately over initial and intervening blank/space-tab-only lines | two one-line messages in the first case; null-start pointer-construction failure before publication at each blank case; normal arbitrary-format UI does not offer Text; exact runtime condition/cleanup remain the named oracle |

The public fixture generator MAY materialize these token streams as tracked test data
once it records the chosen character encoding and source revision. It MUST retain the
token oracle above so a POSIX newline conversion cannot silently change the claim.

### G85 local semantic fixture set

The following fixture descriptions are trackable; generated bytes and mail content
remain local if produced by the licensed implementation.

| Fixture | Action | Required semantic result |
| --- | --- | --- |
| `G85-RM-EOF-01` | load one Rmail message without final `US` | EOF closes the message without a synthesized delimiter line |
| `G85-B5-01` | parse every serializable and ignored v5 basic status property | serializable order exact; Losing-Headers, Unparseable and Redirected not emitted as basic labels |
| `G85-B5-NOSPACE-01` | basic/user labels without leading spaces | accepted under Unix-RMAIL compatibility branch |
| `G85-BAD-EOOH-01` | omit sentinel | contained Bad-Babyl condition stored in Unparseable; whole file remains structurally loaded |
| `G85-BAD-EMPTY-OPTION-01` | parse then save an unknown option with an empty post-colon tail | parse produces empty string; generic printing reaches its character-zero defect |
| `G85-REFORMAT-01` | exhaust explicit new and legacy option combinations | normalization table exact; explicit new property wins |
| `G85-TX-SPLIT-01` | byte count ends inside line | exact prefix visible in first message and copied suffix seeds next; prior status-record characters unchanged |
| `G85-TX-NOSTATUS-01` | malformed region then valid status | malformed region is one Unparseable message; valid status starts next |
| `G85-UX-FALSE-01` | body line beginning `From ` without a date | it starts the next message, unlike C303 |
| `G85-UX-TRAILER-01` | zero, one and many trailing blank lines | every parsed message normalizes to the exact two-Return real trailer relationship |
| `G85-DIR-LAZY-01` | index three members, parse only second | structural count three; only second member opened/content-loaded |
| `G85-DIR-UID-01` | allocate 201 new members | first reservation advances UID upper by 200; exhaustion reserves next 200 before returning member 201 |
| `G85-UX-MULTIDATE-01` | save with list-valued Received-Date | minimum is assigned to Date but original Received-Date list still wins later precedence; record resulting time-decode failure/result |
| `G85-UX-FALLBACK-01` | save an error-valued envelope with no current From header | saved envelope property receives local-address fallback while rewritten physical sender is empty |
| `G85-DIR-FAIL-01` | inject failure at UID write, each member write, index line, stale delete | source-order partial files, File-IDs, ticks, cache bounds, status and remembered-path list match the failure matrix |
| `G85-TEXT-01` | read a nonblank multi-line file | exactly one message; capability remains non-reparsable |
| `G85-KBIN-01` | local synthetic fixtures in normal/swapped byte order and every version boundary | local-only recognition/parse/write/upgrade hashes; report contains no bytes |

## Conformance procedure

### Adapter enumeration

For each selected profile, enumerate the registry and compare exact name, flavor,
registration order, host applicability, settable/possible/sticky options,
reparsability and element type. Required denominators are:

| Profile | Registered selectable formats |
| --- | --- |
| C303 | 6: Rmail, Babyl, Tenex, Unix, VMS, Text |
| G85 | 7: Rmail, Babyl, KBIN, Tenex, Unix, Directory, Text |

Directory is G85-only; VMS is C303-only. Text counts even though its chooser/read
capability is restricted.

### Parser-state exhaustiveness

Tests MUST cover every boundary return class and every state tag:

- ITS delimiter at index zero and nonzero, permitted and forbidden suffixes, EOF;
- Tenex first-line numeric, zero, positive, malformed, mid-line split, exact-line end,
  EOF partial, entry-state-zero candidate loss and state-one scan recovery;
- Unix first line, later valid/false boundary, consecutive `>From ` candidates,
  unequal From-list lengths, empty EOF and envelope parse error;
- VMS first/later formfeed and EOF; and
- C303/G85 Text's opposite callbacks, including C303 initial/intervening blank input
  with a null start.

For every failure point, compare complete message count, retained next-line state,
real/visible interval spans and any mutation of source text.

### Option round-trip

For Babyl v4 and v5, feed every declared option as valueless, empty, string, Lisp
object and invalid input where applicable. Empty generic values are failure cases in
the strict profiles described above, not unconditional round-trip cases. Verify:

1. first-colon and whitespace rules;
2. known parser dispatch;
3. unknown option retention;
4. ordered update-in-place versus append/delete behavior;
5. keyword spelling/order preservation;
6. version transition rewriting of every message status line; and
7. G85 reformatting normalization; and
8. C303 empty-tail parse failure and both profiles' generic empty-string print
   failure.

A round trip compares the normalized logical token stream and ordered property graph;
it does not require preservation of source text which the selected writer explicitly
normalizes.

### Save fault injection

Inject failure before open, after header character `n`, before/after every message,
during epsilon encode, during close/info/version update, and during each Directory
phase. The report MUST distinguish:

- bytes/characters accepted by the external stream;
- last complete logical record and message;
- current adapter saving state;
- buffer status and dirty ticks;
- external file/version/member identities; and
- retry, skip, abort and cleanup results.

### Cross-profile differential tests

At minimum, run the same synthetic corpus through both profiles and assert these
differences rather than merely allowing them:

| ID | Differential |
| --- | --- |
| `DIFF-01` | forced Text input: C303 one message per consecutive nonblank logical line and a null-start failure on blank input, G85 one message for the whole nonblank file; both advertise the format as non-reparsable |
| `DIFF-02` | Unix false `From ` line: C303 retains when date heuristic fails, G85 splits |
| `DIFF-03` | Tenex mid-line count repair: C303 mutates/increments, G85 copies suffix |
| `DIFF-04` | Missing Babyl EOOH: C303 no contained-format condition, G85 Unparseable condition |
| `DIFF-05` | v5 Reformatted: C303 Boolean true, G85 `:IN-FILE` |
| `DIFF-06` | status property tables and ignored serialization entries differ |
| `DIFF-07` | format set: C303 VMS versus G85 Directory/KBIN |

## Observable diagnostics

A conforming implementation exposes a structured trace record for each operation:

~~~text
profile, adapter, host-family, pathname-class,
selection-source, probe-order, stream-position-before/after,
buffer-state-before/after, message-index, boundary-input/result/state,
option/status parse result, mutation order,
condition, restart, partial-output, external identity
~~~

Diagnostics MUST use logical fixture identities or hashes rather than including
private mail content. An unrecognized format is distinct from a recognized format
whose message is malformed.

## Security and rights boundary

- Never commit licensed source, purchased mail files, recovered mail, KBIN bytes or
  local absolute paths.
- G85 fixtures SHOULD be synthetic and created inside a disposable private harness
  session. Only sizes, hashes, semantic digests and original prose may enter docs.
- Public C303 logical fixtures may be tracked with the pinned public source and its
  license, but must contain no private addresses or imported third-party mail.
- A runtime screenshot is neither useful nor required for this nonvisual format
  contract. Any future UI screenshot about format selection follows the repository's
  separate curated screenshot policy.
- A file's presence in a public Fossil browser does not establish the rights to a
  separate message payload used for testing.

## Known unknowns and nonclaims

- `TODO-RUNTIME-ZM-G85-KBIN-BYTES`: exact licensed KBIN opcode stream, version upgrade,
  property representation and error boundaries need local synthetic-oracle closure.
- `TODO-RUNTIME-ZM-G85-FORMATS`: source behavior has not yet been exhaustively
  compared with each resident format method in the preserved Genera 8.5 world.
- `TODO-RUNTIME-ZM-C303-FORMATS`: the available System 303 band does not presently
  reach a working Zmail frame, so source-defined format behavior lacks a runtime
  band oracle.
- `TODO-RUNTIME-ZM-C303-TEXT-FORCED`: invoke the Text flavor's low-level reader
  directly on disposable consecutive-nonblank, initial-blank and intervening-blank
  files in a runnable matching source environment. Confirm the two one-line messages
  for the first fixture and record the exact condition, partial array and cleanup
  after the null-start pointer-construction failures. Also establish whether an
  uninspected wrapper ever enforces the adjacent zero-message comment. This oracle
  does not change Text's unsupported normal-chooser status.
- This document does not specify filesystem wire encodings, QFASL layout, VLOD
  representation, SMTP/Chaos transport, Mailer queues, or arbitrary RFC conformance.
- “Unix” here means the selected historical adapters. Neither profile is claimed as
  a complete modern mbox, mboxo, mboxrd, mboxcl or mboxcl2 implementation.

## Sources and verification

- LM-3 maintained System 303,
  [`zmail/mfiles.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmfiles.lisp),
  common reader/writer and Text; verified 2026-07-19.
- LM-3 maintained System 303,
  [`zmail/mfhost.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmfhost.lisp),
  Rmail, Babyl, Tenex, Unix and VMS; verified 2026-07-19.
- LM-3 maintained System 303,
  [`zmail/defs.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fdefs.lisp),
  status-property order and Text separator; verified 2026-07-19.
- LM-3 maintained System 303,
  [`zwei/primit.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Fprimit.lisp),
  buffer-pointer construction used by the forced-Text null-start analysis; verified
  2026-07-19.
- Symbolics, [*Editing and Mail*, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  user-visible format comparison; verified 2026-07-19.
- Licensed local System 452.1 / Zmail 442.0 source suffixes and hashes in the evidence
  table and [declared-build manifest](genera/zmail-declared-build-source-manifest.md),
  inspected 2026-07-19. No source text or recovered message payload is reproduced.
- [Zmail and mail composition reimplementation specification](zmail-and-mail-composition-reimplementation-specification.md),
  normative parent for lifecycle, selection, inbox, background and UI behavior.

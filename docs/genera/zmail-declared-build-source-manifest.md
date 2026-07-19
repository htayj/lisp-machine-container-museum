---
type: Preservation Note
title: Genera Zmail declared-build source manifest
description: Evidence-only metadata for the 47 source members selected by the preserved System 452.1 and Zmail 442.0 build declaration.
tags: [genera, zmail, source-code, manifest, provenance, preservation]
timestamp: 2026-07-19T18:44:32-04:00
---

# Genera Zmail declared-build source manifest

The inspected Zmail system declaration selects exactly 47 source files: a 37-file
application core, the RTC compile/load dependency, the one-file Converse subsystem,
and eight KBIN subsystem files. This page records identities only. It contains no
source text and does not grant permission to redistribute the licensed local inputs.

The selected source profile is System 452.1 / Zmail 442.0. The declaration itself,
`sys.sct/zmail/system.lisp.~81~`, identifies the build graph but is not one of the 47
members. The separate Zwei Mail editor and Mailer system are also outside this
denominator.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` state normative requirements for manifest
serialization and validation; other prose describes the evidence boundary.

## Closure totals

| Denominator | Members | Bytes | Selection-v1 SHA-256 | Content-v1 SHA-256 |
| --- | ---: | ---: | --- | --- |
| application core | 37 | 1,781,224 | `925a26d7f23c3eb8c40f39ddb2821b200f321860809169acc3b454eaefe293f8` | `263df1e5a3329d60daf5cb5c931eb656c682cf405777a44a087601f582388e45` |
| complete declared build | 47 | 2,076,239 | `d0b7ccf46f870005dcdfb676cf55cce6ba9ab6122f0d2bd7994de4ea70630306` | `327c325390e71dbc45ae8da530921134da2e524b0bc70503819d941ac2898eae` |

The ten declared-build additions total 295,015 bytes. RTC is the load-only dependency
used while compiling the RFC822 header lexer. Converse and KBIN are declared
subsystems. Whether a reimplementation claims their user-visible behavior is a
separate conformance question; it does not change this historical build denominator.

## Canonical serialization

The authoritative records below have four tab-separated fields with no header:

1. lowercase logical pathname relative to `sys.sct/`, without a source generation;
2. exact portable selected pathname, including its `.~generation~` suffix;
3. decimal byte count with no separators; and
4. lowercase 64-character SHA-256 of the file bytes.

`selection-v1` is the UTF-8 encoding of these records sorted by the byte sequence of
field 1 under the C locale. Fields are separated by one U+0009 TAB, records by one
U+000A LF, and the final record has an LF. Its aggregate is SHA-256 over those exact
bytes.

`content-v1` is the same ordering and encoding after projecting each record to fields
1, 3, and 4, again separated by one TAB and terminated by LF. This version-independent
projection is the historical content-closure digest used by the Zmail dossier and
reimplementation specification. `selection-v1` additionally binds the exact selected
generation filenames.

The 37-file application core is the full record set excluding `io/rtc.lisp`, every
`zmail/converse/` record, and every `zmail/kbin/` record.

<!-- zmail-selection-v1-begin -->
~~~text
io/rtc.lisp	sys.sct/io/rtc.lisp.~61~	50545	d95dabfd5dd572c28275b4004f4ac7977384ddb2b3559ecb31c4856459546e7e
zmail/button-panes.lisp	sys.sct/zmail/button-panes.lisp.~1505~	9966	79a815ad174a986df7d52cdaa1fd59a566b960d609e1053f68a6c74700305b8b
zmail/calendar.lisp	sys.sct/zmail/calendar.lisp.~1522~	63648	56b4c387f6e8e0ee4d18a606de86b0604ef84ae1dcba1f991b00a18016dc763c
zmail/chaos-mail.lisp	sys.sct/zmail/chaos-mail.lisp.~1513~	16192	b0249787e79f99afab140390c376bddae30d75c7d346a76bc46843c2a35a36f2
zmail/collections.lisp	sys.sct/zmail/collections.lisp.~1552~	123015	96ec840410068e90b18d3008cecc346905c93af01bd2b1a2d8d73e79eb1ca345
zmail/commands.lisp	sys.sct/zmail/commands.lisp.~1600~	120174	4b00879c28268561def2e2ee34a34026f73aca9dc8f5a4cb6077a66af342adf1
zmail/compile-flavor-methods.lisp	sys.sct/zmail/compile-flavor-methods.lisp.~90~	6650	9534690fd8a3e389f4c127626fa77b4346adc04cf84641327b88d77a6abd186b
zmail/converse/converse.lisp	sys.sct/zmail/converse/converse.lisp.~1564~	89288	bd15925898941848626bb4fa051a56d70f23e9547aff58deb8bf2c6a1e493bd9
zmail/date-expressions.lisp	sys.sct/zmail/date-expressions.lisp.~1510~	32363	0a5473edf65cba3a6be3d347ef8558829083272f534b9a7ce0e5aaf0e5496b71
zmail/definitions.lisp	sys.sct/zmail/definitions.lisp.~1552~	98226	f5c96f713e3105acb78d1a79de3d0739afd361f297b3a9b6b647fd4638144aa6
zmail/digest.lisp	sys.sct/zmail/digest.lisp.~1511~	11326	da5cb1c40f2d92eb1316500908490a833fbc6e133fb6f9cbdf7866cc5d625661
zmail/directory-mail.lisp	sys.sct/zmail/directory-mail.lisp.~1505~	11544	d5b62077554e07496313aea9a864181d2db04cb60246def44ad7740e1e36debe
zmail/eco-commands.lisp	sys.sct/zmail/eco-commands.lisp.~5~	8529	b0253ddbf6512993a92aab745961f91221e6c117847712705fd8458751061983
zmail/fat-strings.lisp	sys.sct/zmail/fat-strings.lisp.~1524~	42622	f108a30547a5a74705ad6e1465920de40bad369ced4a1e6b12155d892d17edc7
zmail/filter.lisp	sys.sct/zmail/filter.lisp.~1549~	99538	368e8846de981b91fa4d5e03a6714bb9b2b6c009f6ebc8fb01b77a1a6a113cd0
zmail/foreign-mail-file-formats.lisp	sys.sct/zmail/foreign-mail-file-formats.lisp.~1520~	57759	6eabd4f8ce57fa85b48542a8c415528c331f78d37101b2e89db23642e91f32ee
zmail/headers-lexer-rfc822.lisp	sys.sct/zmail/headers-lexer-rfc822.lisp.~1502~	4571	7399e72016a6dbf26e058fa2addb24dbb3c3640cce7023543dd25257a114be51
zmail/headers-parser-rfc822.lisp	sys.sct/zmail/headers-parser-rfc822.lisp.~1528~	76997	00462eb3b4247aaa407917890e3189fdb65c48497cffaf36b6a4c8e0fda1103f
zmail/headers.lisp	sys.sct/zmail/headers.lisp.~1534~	66205	6cd3f2217511c8a7d453806ef97d7cf7ad01c399b3affcfa32e9b69d8f796c49
zmail/kbin/buffer.lisp	sys.sct/zmail/kbin/buffer.lisp.~1511~	14113	07c45298489141b5c75492b733c826c5468a2a0efbbad6db926058592319efc6
zmail/kbin/defs.lisp	sys.sct/zmail/kbin/defs.lisp.~1512~	11043	544dd752725bf141c024212be979a69e13d9a6ea13bea2d500d536fc051e6f3f
zmail/kbin/dump-defs.lisp	sys.sct/zmail/kbin/dump-defs.lisp.~1505~	16217	00fc429415ef537e38f52ab661fd5133b3cf9672c4530554dbb2b54e6ac66ee9
zmail/kbin/dump.lisp	sys.sct/zmail/kbin/dump.lisp.~1519~	53614	bd45fd83efd76c919da23da4a4ef2e90c4e6e01644f081769a0b0524c75e4ff5
zmail/kbin/level-1-defs.lisp	sys.sct/zmail/kbin/level-1-defs.lisp.~1501~	5451	eed22620f1afb98928f703dd3dce2d415aa25767c315a58082aeb9985aa6710f
zmail/kbin/load-defs.lisp	sys.sct/zmail/kbin/load-defs.lisp.~1501~	5719	519fe69efdb04d82cab903bc68363ff148111bb742203af1ef1f4b0c77e42d91
zmail/kbin/load.lisp	sys.sct/zmail/kbin/load.lisp.~1521~	41329	f6f08e2fc45afb6d3356b92992476fc27610c3d00d1b11ddc85eb18b09f4b50b
zmail/kbin/trace.lisp	sys.sct/zmail/kbin/trace.lisp.~1501~	7696	e4ef5888046569985a927af769eef9a5bc9142c9dcef63ef5e4c77beec5600e0
zmail/lexer-generator.lisp	sys.sct/zmail/lexer-generator.lisp.~1505~	10676	b830870247cadaabd6eca932c2249ef21e84db75bf125f3143de3779b8e9d5e0
zmail/local-mail.lisp	sys.sct/zmail/local-mail.lisp.~1512~	10310	6cc4544cc0fd7a0c42a652f2cbb8aa01f47c5c57204014da614e01b33d56ef4d
zmail/mail-access-paths.lisp	sys.sct/zmail/mail-access-paths.lisp.~1517~	18387	85d12d2141a66feeb852ef2ccb9a5e0401f51e65b53336a3e697b4f22d7b9103
zmail/mail-files.lisp	sys.sct/zmail/mail-files.lisp.~1566~	205514	1ade0babfa463a4c2780165f64f59ce4d25191d93af7770f7bf571d440ef3648
zmail/mail.lisp	sys.sct/zmail/mail.lisp.~1571~	152833	6885d44e951270f9b9b4ebde5a2500fd674d4282599ba7c81e1fce017cb38c3a
zmail/mailbox-pathnames.lisp	sys.sct/zmail/mailbox-pathnames.lisp.~1507~	25415	86aba9f0cc4b2f2366ceddfbe5c272875f2d51460c9a170289ca0406c3cb9fb7
zmail/message-encryption.lisp	sys.sct/zmail/message-encryption.lisp.~1510~	9741	bc8673dc4d1436bddd06448dd2ac96c458697f55af3fae891361b68a45fffecb
zmail/multiple-choice-menus.lisp	sys.sct/zmail/multiple-choice-menus.lisp.~1505~	10373	5efb9f16155c63fec40780fe0c2719ce344d16936f1058a73511e77a75a84f2b
zmail/parser-generator.lisp	sys.sct/zmail/parser-generator.lisp.~1505~	20870	724b54426e89bbe0520bde65752e6fae939d0d756a0a57884089d28e7910cd4d
zmail/profile.lisp	sys.sct/zmail/profile.lisp.~1517~	48182	55af687c2b52606472544722a9ee5fd3a06534e5496dc5111baadeec84cfddd3
zmail/references.lisp	sys.sct/zmail/references.lisp.~1515~	51440	db8288cedf8463e1a52aaad7e8766875e7c8b7461c1379d0783be06b412a2c37
zmail/rfc822-date-time-parser.lisp	sys.sct/zmail/rfc822-date-time-parser.lisp.~1502~	14567	196db332740802bffb272e56527dc10955f23faa12e6034575151e0620a38451
zmail/rule.lisp	sys.sct/zmail/rule.lisp.~1504~	13078	c8916147921c14b21980568ec589935b7cb9197ca01cbb9908bd1a6b8d25b09c
zmail/smtp.lisp	sys.sct/zmail/smtp.lisp.~1537~	38265	8f01f92630a0683b0ab25902b6dee6a1b4d936c2ebbd3e857f8ca89cf5471a0d
zmail/template-library.lisp	sys.sct/zmail/template-library.lisp.~1515~	34808	cae90e282b1c7d51ec49ad344c79846cfdf7c443304719170912319f917fc239
zmail/template.lisp	sys.sct/zmail/template.lisp.~1525~	53216	45fef5b1ff1a446d98408d5eaa82464ae32e4d5da1b94dfdcc761242c7da79c9
zmail/top.lisp	sys.sct/zmail/top.lisp.~1561~	76649	814f6571649adda39594b006cb9375f23c48f6d32da7bb158a0acefbdc09d089
zmail/undo.lisp	sys.sct/zmail/undo.lisp.~1508~	21428	14235694c675776b169cff77babceb9710bd286e0ca2eb527ed6623a2798385f
zmail/universe.lisp	sys.sct/zmail/universe.lisp.~1511~	55488	2500d0ca328476e5e7cac343b7cf13cd01b64f1f61524fd47e4b09c87333c2a5
zmail/window.lisp	sys.sct/zmail/window.lisp.~1538~	60659	4e81d597dbf3d6453ddad7efe70a9b2787fb8c8f9c586fd5116117feac535afc
~~~
<!-- zmail-selection-v1-end -->

## Validation

From the repository root, the following read-only Bash check extracts the canonical
records, verifies both aggregate forms, and compares every record with a local licensed
source tree. Set `source_root` to the directory which contains `sys.sct/`; do not put
that machine-specific path into published output.

~~~bash
set -euo pipefail

manifest=docs/genera/zmail-declared-build-source-manifest.md
: "${OPEN_GENERA_SOURCE_ROOT:?set this to the local directory containing sys.sct}"
source_root=$OPEN_GENERA_SOURCE_ROOT

records() {
  awk '
    /^<!-- zmail-selection-v1-begin -->$/ { inside = 1; next }
    /^<!-- zmail-selection-v1-end -->$/ { inside = 0 }
    inside && $0 != "~~~text" && $0 != "~~~" { print }
  ' "$manifest"
}

core_records() {
  records | awk -F '\t' '
    $1 != "io/rtc.lisp" &&
    $1 !~ /^zmail\/converse\// &&
    $1 !~ /^zmail\/kbin\//
  '
}

records | sha256sum
core_records | sha256sum
records | cut -f1,3,4 | sha256sum
core_records | cut -f1,3,4 | sha256sum

records | while IFS=$'\t' read -r logical selected bytes expected; do
  file="$source_root/$selected"
  test -f "$file"
  test "$(stat -c '%s' "$file")" = "$bytes"
  test "$(sha256sum "$file" | cut -d' ' -f1)" = "$expected"
done
~~~

The four printed digests, in order, MUST be the complete selection-v1, core
selection-v1, complete content-v1, and core content-v1 values in the table above. A
successful final loop is silent. Hash equality establishes identity of the inspected
files, not redistribution rights or function-level identity with a running world.

## Evidence boundary

The member set is transcribed from the locally preserved
`sys.sct/zmail/system.lisp.~81~` declaration and its Converse and KBIN subsystem
declarations. Selected generations, sizes, and hashes were verified locally on
2026-07-19. The source-profile identity comes from
`sys.sct/zmail/patch/zmail.system-dir.~262~`. Both files remain licensed local inputs;
only their portable names and cryptographic identities are published here.

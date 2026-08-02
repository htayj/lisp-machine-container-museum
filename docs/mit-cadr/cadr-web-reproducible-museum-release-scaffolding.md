---
type: Technical Note
title: CADR-WEB reproducible museum release evidence scaffolding
description: The deterministic logical manifest, closed static inventory, direct-input provenance, browser matrix, rights, guide, and bounded receipt-admission scaffold prepared for M14 without claiming CW4.
tags: [mit-cadr, cadr-web, release, offline, provenance, conformance]
timestamp: 2026-08-02T16:46:00-04:00
---

# CADR-WEB reproducible museum release evidence scaffolding

## Reconstruction claim and scope

M14 now has an executable deterministic release **scaffold**, not a CW4
release. A closed static-inventory policy copies six public repository resources and generates
six release documents. The verifier checks every byte, rejects extra files and
symlinks, confines every policy source and output component without following a
symlink, and rejects named default external primitives. It deliberately omits
`cadr.wasm`, the audio worklet, private media, and unresolved joined M11–M13
evidence.

It does not claim a runnable CADR machine, browser compatibility, a runtime
no-network result, a closed CW gate, CSP enforcement, or a publishable release.

No release evidence is published yet. Each v2 package binds its committed Git
revision and tree, Git and Node versions and executable hashes, generator
identity, and the Git blob identity of every direct input. The builder invokes a
fixed absolute Git executable rather than trusting `PATH`, requires every current
input to be a regular non-symlink file exactly equal to its tracked `HEAD` blob,
admits only exact `100644` or `100755` Git tree entries, requires current
executable bits to agree with that mode, and writes the package from the captured
blob bytes. The test independently
constructs two clean source extractions and compares their manifest and archive
bytes; adversarial tests also substitute a failing `git` earlier in `PATH` and an
ignored untracked package input. That static reproducibility result is not browser
runtime, runtime-offline, licensing, or CW4 evidence.

## Normative language

`MUST` and `MUST NOT` identify the scaffold's normative packaging and evidence
requirements. They do not assert a historical CADR release mechanism.

## Selected profile and conformance level

The selected profile is `CADR-WEB-303/CW4-MUSEUM/scaffold-only`. It supplies a
deterministic package-policy and verification model, not a runnable CADR machine,
browser compatibility, or a release artifact. Its conformance level is no higher
than static scaffold verification; every CW0–CW4 gate and browser row remains
`not-evaluated`.

## Evidence and provenance state

`TEST-M14` is source-visible implementation and synthetic adversarial-test evidence
for the generator, archive verifier, and receipt boundary. It does not establish
browser behavior, CSP behavior, or a hardware/runtime result. The tracked evidence
policy now defines a receipt envelope, a candidate derived from the exact canonical
logical manifest, normalized admitted records, stable M6--M14 case and blocker IDs,
and a same-process branded deterministic aggregation. Manual status and free-form evidence cannot advance a gate
or browser row. The compiled production adapter registry is empty, so every supplied
receipt currently rejects; zero receipts deterministically retain every gate and
browser row at `not-evaluated` and the release claim at `none`.

## Architecture and trust model

| File | Role |
| --- | --- |
| `cadr-m14-package-policy.json` | Closed URL/output/source/media-type/rights inventory, distinct static-inventory and runtime-offline dispositions, private exclusions, unresolved components |
| `cadr-m14-rights-policy.json` | Rights classifications, non-grant notice, forbidden bundle classes |
| `cadr-m14-browser-matrix.json` | Required Blink, Gecko, and WebKit rows, explicit evidence authority, static-inventory status, runtime-offline `not-evaluated`, and an empty registered-adapter set |
| `cadr-m14-evidence-policy.json` | Canonical v1 future-case registry, stable M6–M14 blocker IDs, case-to-definition-of-done mapping, and a deliberately empty production authority set |
| `cadr-m14-gates.json` | v3 CW0–CW4 ledger bound to the exact evidence-policy SHA-256; every gate remains `not-evaluated` |
| `build-cadr-m14-release.mjs` | Copier, generators, logical manifest/source map, componentwise-confined closed-inventory verifier, and archive verifier |
| `cadr-m14-evidence.mjs` | Pure candidate derivation, confined receipt/result/cleanup capture, compiled adapter admission boundary, and deterministic aggregation; its production registry is empty |
| `run-cadr-m14-compatibility.mjs` | Bounded collector for exact-schema, untrusted private adapter attestations; it cannot advance a browser row |

Canonical JSON is UTF-8 with recursively sorted object keys, no insignificant
whitespace, and one terminal LF. The logical epoch is one. Wall-clock time,
output directory, uid, and absolute source paths are absent. The manifest
records package-relative paths, URLs, media types, byte counts, and SHA-256
identities. The source map associates every output, including both canonical
roots, with exact direct inputs and a named transformation. Its provenance binds
the Git revision/tree, Git version and executable hash, Node version and
executable hash, exact generator bytes, and each tracked input's Git blob.
Each direct-input record also carries its exact admitted Git mode. It contains no
absolute source paths or source text.

Every generated JSON root is verified as canonical bytes before its values are
used: the logical manifest and its build-provenance/file records, rights provenance
and rights/assignment records, source map and mapping/source/generator records,
and generated browser matrix and row records all use exact no-extra-field schemas.
Their package and repository path fields are canonical relative paths (except the
defined package URLs), and every textual field rejects all absolute POSIX path
tokens (including punctuation-adjacent forms), Windows-drive paths, `file:` URIs,
Windows UNC and rooted-backslash paths, and both current-user and named-user
tilde-home paths. A future metadata extension therefore needs a new explicit schema,
generator, verifier, and test rather than becoming inert unverified data.

Policy source and package-output paths use a canonical slash-relative grammar:
they reject absolute paths, `.` and `..` components, doubled separators, backslash
forms, and ancestor symlinks. A package URL is either `/` for `index.html` or the
exact slash-prefixed package output path; query, fragment, alternate, and escaping
forms are not policy URL forms. The output command accepts only one direct child of
`build/cadr-m14/` and rejects replacement, traversal, and absolute-path forms.

The admission command accepts one canonical logical manifest, one confined receipt
directory, and one new output file below a direct `build/cadr-m14/` home. It reads
receipt, result, and cleanup bytes once from regular non-symlink files; receipt paths
and free-form mappings never become an authority. The receipt must repeat the
candidate's exact logical-manifest, source-closure, artifact-set, and toolchain-set
hashes. Producer and verifier identity come from the policy, must be distinct, and
must have different primary program-closure hashes. A registered case adapter then
validates the captured case-specific result; it cannot choose the case's milestone,
definition-of-done, or blocker mapping.

The stable case, blocker, definition-of-done, and gate projection has a separately
pinned normative digest, so a coherent rename or remapping cannot redefine success
merely by updating the outer policy hash. Adapter-visible JSON is recursively frozen,
and admission captures the verifier outcome, cleanup state, result hash, and policy
mapping before invoking adapter code. Each successful admitted record is itself
recursively frozen and carries a module-private in-process identity. Aggregation
accepts only those exact objects returned by the same process's admission boundary;
a serialized, copied, or hand-constructed record cannot advance a gate.

## Failure and recovery boundary

The verifier walks the complete package and rejects missing, additional,
symbolic-link, or non-regular entries. Its bounded scan rejects named HTTP,
WebSocket, `fetch`, `EventSource`, `sendBeacon`, `XMLHttpRequest`, remote dynamic
and static `import`/`export`, CSS `@import` and `url`, remote `importScripts`, and
remote Worker, SharedWorker, `URL`, Request, service-worker, and AudioWorklet
resource forms. Missing resources are fatal and must never be fetched.

This proves only a closed static packaged-byte inventory with no detected named
default external primitive. It does **not** prove that a browser has no network
capability, that CSP is correctly enforced, or that runtime resource paths are
complete; runtime-offline behavior remains `not-evaluated`.

The collector can run an exact-schema private attestation under Bubblewrap with a
fresh network namespace (`--unshare-net`), only the package, a read-only private
attestation directory, `/proc`, `/dev`, and the minimum host runtime roots mounted.
It does not mount host `/`, accept arbitrary Bubblewrap/PATH/argv fields, or publish
private paths. The adapter payload is untrusted even after this runtime network
denial. The matrix contains no registered, pinned real browser adapter, executable,
or tool identity, so every such record remains an `untrusted-attestations-only`
result and the Blink, Gecko, and WebKit rows remain `not-evaluated`. That sandbox
property is not browser runtime no-network evidence.

An invalid source, URL, output, symlink, schema field, inventory member, rights
assignment, archive byte, or adapter field MUST fail before it becomes a release
claim. The generator never replaces an existing output or archive. It does not
recover by fetching a missing resource, following a symlink, accepting extra
attestation data, or changing a gate; remediation is to construct a new isolated
output from corrected, policy-conforming inputs.

Admission is all-or-nothing. A wrong candidate, source, artifact, toolchain,
policy, profile, authority, verifier outcome, result hash, cleanup hash, schema,
duplicate receipt bytes, or second receipt for a case rejects the complete input set
and writes no aggregation. A conformance failure makes its case, blockers,
definition-of-done clauses, and affected gates fail; a later receipt cannot erase it
because conflicting case attempts are rejected. Infrastructure failure and incomplete
evidence remain retained attempts but leave the case `not-evaluated`. Failed cleanup
fails a case; unknown cleanup cannot pass it. Even an injected synthetic all-pass
registry produces `releaseClaim: none`: enabling a claim is a later policy/schema
change, not an aggregation outcome.

## Rights, guide, and report

The scaffold makes no blanket license conclusion. Repository-authored
reconstruction material remains `review-required-before-release` with
`NOASSERTION`. Licensed Symbolics/Open Genera inputs, user CADR bands and
overlays, raw computer-use sessions, and unreviewed recovered assets are
forbidden from the bundle.
The reasons are distinct: Symbolics/Open Genera media are licensed private
inputs, while public CADR/System 303 artifacts remain excluded here when their
authoritative redistribution provenance has not been established. Public
availability is not treated as a license grant.

Every copied and generated file has exactly one rights assignment. The
generated user guide covers private import, controls, save/export, reset,
rights, static-inventory scope, and the unevaluated runtime-offline boundary. It states that pause/reset is not a save and only
an acknowledged durable commit may be called saved. The conformance report
renders CW0–CW4 and the browser matrix with release claim `none`; static
packaging cannot change a gate.

## Conformance and oracle status

```sh
node scripts/build-cadr-m14-release.mjs --output build/cadr-m14/release
node tests/test_cadr_m14_release.mjs
node tests/test_cadr_m14_evidence.mjs
node scripts/run-cadr-m14-compatibility.mjs
```

The test creates two independent clean source extractions and compares logical
manifests and complete deterministic archives byte-for-byte. It also verifies
the guide/report nonclaims, complete rights assignments, and proves that an
extra file, archive corruption, or injected named external primitive breaks
verification. It exercises absolute, traversal, doubled-separator, alternate-URL,
and ancestor-symlink path adversaries; rejects malformed, extra, and mismatched
private adapter data; rejects manual gate status and free-form evidence forgery; and
confirms that even successful sandboxed attestations do not change the browser
matrix. The compatibility command without `--execute` refuses. No browser matrix,
runtime-offline, or CW4 evidence has been recorded.

The receipt test builds a disposable exact-source candidate, exercises zero-receipt
production aggregation and production rejection of supplied receipts, then injects
only in-memory synthetic authorities and adapters. It covers pass, partial,
infrastructure, conformance, and cleanup outcomes; every candidate identity field;
authority forgery and non-independence; result mutation; duplicate/conflicting and
noncanonical receipts; getters, private-path text, traversal, symlink capture, and
deterministic ordering. It also proves that an all-pass synthetic aggregation cannot
claim a release.

## Known unknowns and next oracle

Remaining work is to join final M11–M13 artifacts, add the final Wasm/worklet
with exact rights and build identities, join M10 host-cleanup and state
evidence with every transitive supervisor input, implement and register reviewed
case-specific adapters with exact executable/tool identities before accepting a
browser result, run all browser rows under a runtime no-network oracle, bind
validated CW0–CW4 evidence to the exact provenanced inputs,
and complete the release rights review. Until then
the only permitted outcome is
`scaffold-only` with release claim `none`.

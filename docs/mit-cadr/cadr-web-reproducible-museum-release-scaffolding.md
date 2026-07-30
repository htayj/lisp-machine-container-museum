---
type: Technical Note
title: CADR-WEB reproducible offline museum release scaffolding
description: The deterministic logical manifest, closed offline package, source-map, browser-matrix, rights, guide, and conformance-report contracts prepared for M14 without claiming CW4.
tags: [mit-cadr, cadr-web, release, offline, provenance, conformance]
timestamp: 2026-07-30T07:53:01-04:00
---

# CADR-WEB reproducible offline museum release scaffolding

## Reconstruction claim and scope

M14 now has an executable deterministic release **scaffold**, not a CW4
release. A closed policy copies six public repository resources and generates
six release documents. The verifier checks every byte, rejects extra files and
symlinks, confines every policy source and output component without following a
symlink, and rejects named default external primitives. It deliberately omits
`cadr.wasm`, the audio worklet, private media, and unresolved joined M11–M13
evidence.

It does not claim a runnable CADR machine, browser compatibility, an offline
browser result, a closed CW gate, CSP enforcement, or a publishable release.

No build hash is published yet: the current worktree is not a clean committed
closure. A later evidence record must name the Git commit, Git tree, exact
closure status and status digest, plus the generated manifest/archive identities.
Until a clean committed build is reproduced, even those artifact hashes are local
diagnostics rather than release evidence.

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
for the generator, archive verifier, and collector boundary. It does not establish
browser behavior, CSP behavior, or a hardware/runtime result. Each manifest records
the current source closure's commit, tree, textual status, and status digest so a
future clean build can bind its artifacts to a specific source state rather than
reusing these uncommitted diagnostics.

## Architecture and trust model

| File | Role |
| --- | --- |
| `cadr-m14-package-policy.json` | Closed URL/output/source/media-type/rights inventory, logical epoch zero, private exclusions, unresolved components |
| `cadr-m14-rights-policy.json` | Rights classifications, non-grant notice, forbidden bundle classes |
| `cadr-m14-browser-matrix.json` | Required Blink, Gecko, and WebKit rows with denied networking and an empty registered-adapter set |
| `cadr-m14-gates.json` | CW0–CW4 ledger, initially `not-evaluated` |
| `build-cadr-m14-release.mjs` | Copier, generators, logical manifest/source map, componentwise-confined closed-inventory verifier, and archive verifier |
| `run-cadr-m14-compatibility.mjs` | Bounded collector for exact-schema, untrusted private adapter attestations; it cannot advance a browser row |

Canonical JSON is UTF-8 with recursively sorted object keys, no insignificant
whitespace, and one terminal LF. The logical epoch is zero. Wall-clock time,
output directory, uid, and absolute source paths are absent. The manifest
records package-relative paths, URLs, media types, byte counts, and SHA-256
identities. The source map associates every output, including its canonical
roots, with tracked source/policy identities and a named transformation.
The manifest also records the current commit, tree, and source-closure status;
the status controls whether a later evidence record is eligible for binding.

Every generated JSON root is verified as canonical bytes before its values are
used: the logical manifest and its source-control/file records, rights provenance
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

## Failure and recovery boundary

The verifier walks the complete package and rejects missing, additional,
symbolic-link, or non-regular entries. Its bounded scan rejects named HTTP,
WebSocket, `fetch`, `EventSource`, `sendBeacon`, `XMLHttpRequest`, remote dynamic
and static `import`/`export`, CSS `@import` and `url`, remote `importScripts`, and
remote Worker, SharedWorker, `URL`, Request, service-worker, and AudioWorklet
resource forms. Missing resources are fatal and must never be fetched.

This proves only a closed, self-contained packaged-byte inventory with no detected
named default external primitive. It does **not** prove that a browser has no
network capability, that CSP is correctly enforced, or that runtime resource paths
are complete; CSP and browser runtime behavior remain open obligations.

The collector can run an exact-schema private attestation under Bubblewrap with a
fresh network namespace (`--unshare-net`), only the package, a read-only private
attestation directory, `/proc`, `/dev`, and the minimum host runtime roots mounted.
It does not mount host `/`, accept arbitrary Bubblewrap/PATH/argv fields, or publish
private paths. The adapter payload is untrusted even after this runtime network
denial. The matrix contains no registered, pinned real browser adapter, executable,
or tool identity, so every such record remains an `untrusted-attestations-only`
result and the Blink, Gecko, and WebKit rows remain `not-evaluated`.

An invalid source, URL, output, symlink, schema field, inventory member, rights
assignment, archive byte, or adapter field MUST fail before it becomes a release
claim. The generator never replaces an existing output or archive. It does not
recover by fetching a missing resource, following a symlink, accepting extra
attestation data, or changing a gate; remediation is to construct a new isolated
output from corrected, policy-conforming inputs.

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
rights, and offline behavior. It states that pause/reset is not a save and only
an acknowledged durable commit may be called saved. The conformance report
renders CW0–CW4 and the browser matrix with release claim `none`; static
packaging cannot change a gate.

## Conformance and oracle status

```sh
node scripts/build-cadr-m14-release.mjs --output build/cadr-m14/release
node tests/test_cadr_m14_release.mjs
node scripts/run-cadr-m14-compatibility.mjs
```

The test builds twice in different empty directories and compares logical
manifests and complete deterministic archives byte-for-byte. It also verifies
the guide/report nonclaims, complete rights assignments, and proves that an
extra file, archive corruption, or injected named external primitive breaks
verification. It exercises absolute, traversal, doubled-separator, alternate-URL,
and ancestor-symlink path adversaries; rejects malformed, extra, and mismatched
private adapter data; and confirms that even successful sandboxed attestations do
not change the browser matrix. The compatibility command without `--execute`
refuses. No browser matrix or CW4 runtime evidence has been recorded.

## Known unknowns and next oracle

Remaining work is to join final M11–M13 artifacts, add the final Wasm/worklet
with exact rights and build identities, join M10 host-cleanup and state
evidence with every transitive supervisor input, run all browser rows offline,
register real adapters with exact executable/tool identities before accepting a
browser result, bind validated CW0–CW4 evidence to a clean committed source closure,
reproduce from a clean checkout, and complete the release rights review. Until then
the only permitted outcome is
`scaffold-only` with release claim `none`.

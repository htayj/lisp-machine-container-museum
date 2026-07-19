---
name: write-reimplementation-specs
description: Write deep, implementation-ready reimplementation specifications for historical, proprietary, undocumented, or versioned software from source code, binaries or bytecode, world or image state, runtime behavior, manuals, papers, and preserved artifacts. Use when Codex must specify, reconstruct, clone, or independently recreate a window system, UI framework, application, protocol, file format, VM, runtime, or other system; when releases disagree; when licensed evidence cannot be redistributed; or when compatibility claims need explicit profiles, failure semantics, oracle gaps, and conformance tests.
---

# Write Reimplementation Specs

Produce an implementable, release-bounded contract rather than an architectural
overview or API inventory. Make every compatibility claim traceable to evidence and
turn every unresolved behavior into a named test obligation.

## Load the supporting material

- Read [references/evidence-model.md](references/evidence-model.md) before analyzing
  historical, proprietary, compiled, or conflicting evidence.
- Read [references/contract-patterns.md](references/contract-patterns.md) when defining
  state machines, operation order, failure behavior, compatibility surfaces, or tests.
- When drafting a new specification document, start it from
  [assets/reimplementation-spec-template.md](assets/reimplementation-spec-template.md)
  when its repository has no stronger local template. Remove irrelevant sections.
- Run `scripts/audit_spec.py` on any Markdown specification you create or materially
  change before handoff. Do not require it for a plan-only or chat-only audit. Treat
  it as a structural backstop, not as proof that the technical claims are correct.

## Workflow

### 1. Read local authority first

Within the user's evidence and access boundary, read the repository guidance, writing
guide, relevant existing documentation, rights policy, and build/test entry points.
Do not open a source the user excludes merely because it would make the task easier.
Preserve public-versus-licensed, historical-versus-maintained, and tracked-versus-
local boundaries already established there.

Inspect the actual evidence instead of relying on manuals alone. Use primary sources
where available: source, compiled artifacts, runtime state, original manuals, and
contemporary papers. Browse when a referenced source is not local or current facts
need verification.

### 2. Bound the claim before researching details

Name each target release, artifact, patch level, revision, or selectable profile.
Record stable identities such as checksums, byte sizes, version strings, or pinned
commits. Never average incompatible releases into a fictional implementation.

State the compatibility grain or independent compatibility axes explicitly:

1. architecture and conceptual model;
2. semantic programming model;
3. observable behavioral compatibility;
4. public API compatibility;
5. drop-in historical source compatibility;
6. file, wire, or serialized representation compatibility;
7. ABI, bytecode, binary, or image compatibility; and
8. timing/performance or visual/pixel identity where those are genuinely required.

Claim only the levels the evidence closes. Reserve a higher level when exact package
names, signatures, defaults, values, errors, load surfaces, or binary layouts remain
unknown. Do not use “complete,” “exact,” or “full” without defining its boundary.

### 3. Build an evidence ledger

Assign concise evidence codes and use them consistently. Keep at least these classes
distinct when present:

- readable source;
- compiled artifact, bytecode, world, firmware, or image state;
- direct runtime observation;
- manual or reference documentation;
- contemporary paper or design report;
- implementation-independent inference; and
- unresolved runtime or static-analysis obligation.

For every subsystem, map the exact witness, source span or symbol surface, runtime
probe, and manual/paper cross-check. Record disagreement instead of choosing the most
convenient witness. A symbol inventory does not prove a compiled method body; readable
source does not prove that the preserved image loaded it; a screenshot does not prove
hidden object identity.

### 4. Decompose the system by contracts

Derive the layer graph and ownership boundaries. Then specify, as applicable:

- objects, records, identifiers, types, and persistent state;
- coordinate systems, units, encodings, and data layout;
- invariants and legal/illegal state combinations;
- lifecycle phases and state transitions;
- operation preconditions, effects, ordering, and return values;
- concurrency, locking, callback, retry, and atomicity rules;
- failure, abort, partial-mutation, rollback, and recovery behavior;
- input routing, output recording, caching, and invalidation;
- complete application binding trees: direct keys, modifiers, contexts and modes,
  prefixes and every reachable multi-stage leaf, numeric arguments and repetition,
  pointer or presentation gestures, menu accelerators, precedence, fallthrough,
  Help exposure, and unbound behavior;
- extension points, registration, enumeration, and module boundaries;
- boot, load, shutdown, reuse, and reconfiguration order; and
- release-specific deltas and deliberate safety corrections.

Use pseudocode for required effects, not copied implementation expression. Label a
clean-room data structure or safer transaction rule as inference when the historical
implementation does not establish it.

### 5. Close behavior with runtime oracles

Design the smallest harmless probe that distinguishes competing implementations.
Prefer synthetic inputs and disposable objects. Capture the input sequence, relevant
state trace, result, pixel or data hash, environment identity, and clean shutdown.

Use screenshots only for bounded visible claims. Link each published image to its
provenance and rights record. Do not infer timing, dispatch, cache state, object
identity, restoration, or destructive behavior from pixels alone.

If execution is unavailable or unsafe, retain a `TODO-RUNTIME`-style obligation with
the exact setup, action, expected discriminating result, and claim it would close.
Never guess merely to eliminate a TODO.

### 6. Write the normative specification

Lead with the reconstruction claim and its exclusions. Define normative language and
evidence codes. Present release profiles and cumulative conformance levels before
subsystem details.

For each subsystem, move from data model to invariants to transitions to failure
behavior. Include semantic protocol inventories, but do not mistake operation names
for a callable historical API. If claiming source compatibility, include packages or
namespaces, operator kinds, complete signatures or macro grammars, defaults, return
and multiple values, conditions/restarts, aliases, method-combination behavior, and
load/module contracts.

For every interactive application, include one complete effective binding inventory
per selected profile, directly or through a named normative in-repository companion.
A flat list is insufficient when dispatch has prefixes,
contexts, modes, panes, modifier normalization, presentation translators, or
shadowing: render those relationships as a tree or equivalent exact mapping down to
every reachable leaf. Specify unknown and unbound fallbacks and add an exhaustive
enumeration test. If the application owns no bindings, say so with evidence and
separate inherited substrate bindings from application-owned ones.

End with conformance tests, comparison procedure, known unknowns, artifact identities,
and primary sources. Keep observations, inference, and requirements visibly distinct.

### 7. Cross-review adversarially

Use independent read-only reviewers for separable subsystems and a final whole-spec
pass when practical. Ask reviewers to find:

- lifecycle or transaction-order contradictions;
- requirements unsupported by the cited witness;
- broad claims with incomplete API/module coverage;
- accidental release averaging;
- source/world/runtime/manual disagreement hidden by wording;
- inferred architecture presented as historical fact;
- ambiguous variables or overloaded type names;
- incomplete binding trees, omitted prefix leaves, or inherited bindings presented
  as application-owned;
- missing failure and abort paths;
- tests too weak to distinguish incompatible implementations;
- incorrect line spans, checksums, links, or screenshot identities; and
- proprietary payload, long quotation, secret, or machine-path leakage.

Resolve blockers in the document and rerun the review. Do not declare success from a
review of stale bytes.

### 8. Validate and integrate

Run the bundled audit, the repository's Markdown/static-site checks, local-link
checks, artifact/hash checks, and relevant implementation tests. For an OKF-style
repository, update frontmatter timestamps only after meaningful edits and link new
pages from their section and root indexes.

Report what the specification makes recreatable now, what stronger compatibility
level remains reserved, which oracle probes remain open, and which licensed inputs
stay local. Commit or publish only when the user asks.

## Non-negotiable boundaries

- Do not equate a manual with the implementation.
- Do not equate readable source with the running artifact.
- Do not equate symbol presence with body semantics.
- Do not turn a screenshot into a hidden-state claim.
- Do not publish licensed source, extracted payloads, or proprietary bytes merely
  because they were useful evidence.
- Do not replace uncertainty with an attractive modern design.
- Do not promise unmodified historical-source compatibility without an exact public
  interface and selected-module closure audit.
- Do not promise binary compatibility without layout, ABI, encoding, relocation,
  and loader evidence.

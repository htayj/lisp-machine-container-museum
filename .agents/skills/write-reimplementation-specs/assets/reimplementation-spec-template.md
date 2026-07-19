---
type: Reimplementation Specification
title: <Exact system and release> reimplementation specification
description: <One-sentence statement of the reconstruction boundary and strongest supported compatibility claim.>
timestamp: <ISO-8601 timestamp>
---

# <Exact system and release> reimplementation specification

<!--
Copy this file into the target repository. Apply its local metadata, citation,
rights, and linking rules. Replace every angle-bracket placeholder and remove
irrelevant optional sections. Do not let the presence of a heading substitute for
technical closure.
-->

## Status and reconstruction claim

<!-- Lead with the strongest claim the evidence actually closes. -->

This specification targets <release, build, artifact, configuration, and dependency
boundary>. A conforming implementation <state what it can reproduce>.

It claims:

- <semantic or behavioral compatibility>;
- <source/API compatibility, if closed>; and
- <representation, ABI, timing, or visual compatibility, if closed>.

It does not claim:

- <explicit nonclaim>;
- <stronger compatibility level reserved for future work>; or
- <unverified release or configuration>.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` have their usual requirements meanings.
Each substantial rule carries an evidence code or is covered by the section evidence
map.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `SRC` | Readable source at <revision> | <surface or behavior> | That the preserved runtime loaded it |
| `ART` | Compiled artifact, image, firmware, or capture | <resident surface or bytes> | Missing bodies, provenance, or source identity |
| `RUN` | Direct runtime observation | <observed artifact behavior> | Untested branches or other releases |
| `MAN` | Original manual or reference | <documented contract> | Exhaustive implementation behavior |
| `PAP` | Contemporary paper or design report | <dated design intent> | Later implementation details |
| `INF` | Implementation-independent inference | <necessary reconstructed rule> | Historical implementation expression |
| `TODO-RUNTIME` | Unclosed oracle obligation | Nothing yet | Must not be promoted to observed fact |

When witnesses disagree, <state profile-specific precedence and preservation rule>.

## Compatibility profiles and levels

### Release profiles

| Profile | Exact target | Dependencies/configuration | Deliberate deltas |
| --- | --- | --- | --- |
| `<P1>` | <artifact and release identity> | <boundary> | <none or listed changes> |
| `<P2>` | <artifact and release identity> | <boundary> | <coherent release difference> |

<!-- Use a matrix instead of cumulative levels when compatibility axes do not nest. -->

### Conformance levels

| Level | Includes | Excludes or reserves |
| --- | --- | --- |
| `<L0>` | <substrate/data-model behavior> | <higher behavior> |
| `<L1>` | `<L0>` plus <interactive or integration behavior> | <exact historical API> |
| `<LX>` | <closed exact surface> | <ABI/binary identity if unclosed> |

## Evidence ledger

| Subsystem or claim | Source witness | Artifact/runtime witness | Manual/paper witness | Status |
| --- | --- | --- | --- | --- |
| <subsystem> | <file, symbol, revision, span> | <artifact/probe> | <stable citation> | <normative/inferred/open> |

## Architecture and ownership boundaries

<!-- Distinguish target-owned behavior from substrate and client behavior. -->

```text
<client layer>
    -> <target subsystem>
        -> <runtime or platform substrate>
```

- <Layer> owns <observable contract>.
- <Layer> depends on <narrow dependency> but does not inherit <unrelated behavior>.

## Semantic data and state model

### <Object or record>

| Field | Meaning | Observable constraints | Evidence |
| --- | --- | --- | --- |
| `<field>` | <meaning> | <identity, lifetime, units, or range> | `<code>` |

### Invariants

1. <Invariant over externally meaningful state.>
2. <Distinct predicates that must not be collapsed.>
3. <Ownership, generation, cache, registry, or lifetime invariant.>

## Complete input and gesture binding trees

<!--
Required for an interactive application. A named normative in-repository companion
may hold the exact inventory, but this section must state that incorporation and its
scope. Separate application-owned bindings from inherited substrate bindings. If
there are no application-specific bindings, state that fact with its evidence. Do
not omit unreachable, shadowed, or unbound cases.
-->

| Context/mode/pane | Direct gesture | Modifier or argument handling | Operation | Shadowing/fallthrough/unbound result | Evidence |
| --- | --- | --- | --- | --- | --- |
| <context> | <key, pointer chord, presentation gesture, or menu accelerator> | <normalization/repeat> | <leaf> | <precedence or fallback> | `<code>` |

```text
<prefix or staged-dispatch root>
├─ <prefix/key> -> <subtree or exact leaf>
│  ├─ <next key> -> <leaf>
│  └─ <unbound/default> -> <beep, cancel, self-insert, fallthrough, etc.>
└─ <other direct gesture> -> <leaf>
```

State how the effective tree is enumerated or dumped at runtime, how mutable
registrations invalidate it, and which generic environment bindings remain outside
the application's ownership boundary.

## Lifecycle and transaction model

### <Operation or phase>

Preconditions:

- <valid state and inputs>.

Required order:

1. Validate <input and generation>.
2. Acquire or reserve <resource>.
3. Apply <first externally significant mutation>.
4. Commit at <precise point>.
5. Notify, redraw, or invoke callbacks <inside/outside lock rule>.
6. Release temporary state on success or nonlocal exit.

Postconditions:

- <result and final model state>.

Failure and abort behavior:

- <condition or error> leaves <coherent state>;
- <partial effect> is <rolled back, retained, retried, or invalidated>; and
- <cleanup> runs for cancellation and nonlocal exit.

## Normative subsystem contracts

### <Subsystem>

#### Inputs, outputs, defaults, and limits

<Specify units, encodings, coordinate spaces, defaults, return values, and limits.>

#### State transitions and algorithms

```text
<representation-independent behavioral pseudocode>
```

#### Ordering, concurrency, and callbacks

<Specify lock ownership, wait/retry, atomicity, callback-under-lock restrictions,
cache invalidation, and interleavings that affect observable behavior.>

#### Failure and recovery

<Specify invalid inputs, stale state, partial delivery, rollback, diagnostics, and
the state from which the caller can continue.>

## Cross-subsystem ordering

| Transaction | Required order | Commit point | Abort cleanup |
| --- | --- | --- | --- |
| <transaction> | <A before B before C> | <observable boundary> | <restored state> |

## Release deltas and extensions

- `<P1>`: <historical behavior>.
- `<P2>`: <different historical behavior>.
- Optional safety-corrected extension: <inferred safer rule, not attributed to the target>.

## Reference semantic protocol inventory

<!-- This is behavior-oriented. Do not call it the exact historical API. -->

| Operation family | Inputs | Results/effects | Failure behavior | Evidence |
| --- | --- | --- | --- | --- |
| <semantic operation> | <typed inputs> | <values and state change> | <conditions/cleanup> | `<code>` |

## Exact source-interface and module closure

<!-- Keep this section only when source/drop-in compatibility is claimed or reserved. -->

| Package/namespace and symbol | Kind | Complete signature or grammar | Values | Conditions/restarts | Module/load contract | Evidence | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <name> | <function/macro/class/etc.> | <arguments, defaults, options> | <including multiple values> | <exact surface> | <dependency/order> | `<code>` | `<ID>` |

| Selected module | Coverage status | Missing closure |
| --- | --- | --- |
| <module> | <normative/partial/infrastructure/compatibility-only/test-only> | <symbols or load behavior> |

## Conformance test suite

Every test records the selected profile, artifact/environment identity, logical input
trace, semantic result, final state, and bytes, regions, pixels, or timings only where
they are part of the claim.

| ID | Level/profile | Setup and action | Objective pass condition | Evidence closed |
| --- | --- | --- | --- | --- |
| `<T-001>` | `<P1>/<L0>` | <positive path> | <observable result and final state> | <claim> |
| `<T-002>` | `<P1>/<L0>` | <invalid or boundary input> | <error and unchanged/recovered state> | <claim> |
| `<T-003>` | `<P1>/<L1>` | <abort or concurrent path> | <ordering, cleanup, and retry result> | <claim> |
| `<T-004>` | `<P1>` versus `<P2>` | <same discriminating input> | <profile-specific results> | <release delta> |
| `<T-BINDINGS>` | all interactive profiles | Enumerate every context, prefix path, modifier, pointer/presentation gesture, leaf, shadowed entry, and one unbound value | Dump is isomorphic to the normative binding trees and every injected path reaches exactly its specified result | complete input contract |

## Preserved-system comparison procedure

1. Verify <artifact checksum/version and environment>.
2. Start from <reproducible clean state>.
3. Apply <synthetic, harmless input sequence>.
4. Record <semantic/event trace> and <bounded visible or byte evidence>.
5. Shut down cleanly and preserve <researcher-owned result and provenance>.
6. Incorporate a result only into the profile actually exercised.

### Runtime closure probes

| Obligation | Setup and action | Discriminating outcomes | Claim closed |
| --- | --- | --- | --- |
| `TODO-RUNTIME-1` | <safe exact probe> | <outcome A versus B> | <specific rule> |

## Known unknowns and nonclaims

- <Behavior not yet exercised or decoded>.
- <Stronger compatibility surface awaiting an inventory>.
- <Historical provenance that cannot be established from current witnesses>.

## Artifact identities

| Role | Portable identity | Size/checksum/revision | Rights/publication boundary |
| --- | --- | --- | --- |
| Source | <repository and pinned commit> | <revision> | <public or restricted> |
| Runtime artifact | <release filename or version> | <bytes and SHA-256> | <local-only if licensed> |
| Tool/harness | <name and version/commit> | <revision> | <publication status> |

## Sources

- <Pinned primary source link and verification date>.
- <Original manual, paper, or artifact inventory>.

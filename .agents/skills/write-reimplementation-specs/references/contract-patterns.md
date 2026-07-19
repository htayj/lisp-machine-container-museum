# Contract and conformance patterns

## Contents

- [Document architecture](#document-architecture)
- [State and data contracts](#state-and-data-contracts)
- [Lifecycle and transaction contracts](#lifecycle-and-transaction-contracts)
- [Coordinates, encodings, and layout](#coordinates-encodings-and-layout)
- [Concurrency and callbacks](#concurrency-and-callbacks)
- [Failure and recovery](#failure-and-recovery)
- [API and module closure](#api-and-module-closure)
- [Conformance design](#conformance-design)
- [Runtime comparison procedure](#runtime-comparison-procedure)
- [Adversarial review checklist](#adversarial-review-checklist)

## Document architecture

Use only applicable sections, but preserve this information order:

1. direct reconstruction claim and nonclaims;
2. normative language and evidence codes;
3. release/artifact profiles and conformance levels;
4. evidence ledger and section evidence map;
5. layer graph and dependency/ownership boundaries;
6. data and object model;
7. subsystem contracts;
8. cross-subsystem operation order;
9. failure, abort, recovery, and defensive behavior;
10. semantic protocol inventory;
11. exact API/module closure boundary;
12. conformance suite;
13. preserved-system comparison procedure;
14. known unknowns and oracle backlog;
15. artifact identities; and
16. primary sources and verification date.

Lead each subsystem with a direct conclusion. Follow with the witness, rules, and
tests. Avoid long historical narrative inside normative algorithms.

## State and data contracts

Define every externally meaningful entity. Use implementation-independent records:

```text
Entity {
  stable identity
  ownership and parent/child relationships
  configuration
  mutable state
  derived state
  cached or persisted state
  lifecycle marker
}
```

Separate predicates that can vary independently. Examples include active/exposed/
visible/selected, registered/loaded/instantiated/running, valid/dirty/displayed, or
permitted/attempted/committed.

For each entity specify:

- creator and owner;
- legal references and lifetime;
- canonicalization and equality;
- default and derived values;
- mutation authority;
- serialization or backing-store behavior;
- invalidation and reclamation; and
- introspection requirements.

State invariants as testable propositions. Prefer “ordered subset,” “exactly one,”
“never overlaps except,” or “commit together or neither” over vague prose.

## Lifecycle and transaction contracts

Split overloaded “initialization” into actual phases. Common phases include:

```text
DEFINE -> REGISTER -> INSTANTIATE -> INITIALIZE -> ACTIVATE/SELECT
       -> RUN -> REUSE -> RECONFIGURE -> DEACTIVATE/DEEXPOSE -> KILL
```

Include only phases established for the selected system. State which phase owns:

- validation;
- registry changes;
- object allocation;
- default and caller-supplied state;
- child/pane creation;
- resource acquisition;
- visibility or publication;
- top-level execution;
- reuse/reset; and
- cleanup.

Specify successful order and abnormal order separately. Do not call a sequence atomic
when source mutates state before a later failure. If selecting safer staged behavior,
name it as an inferred or safety-corrected profile.

For each transaction define:

```text
preconditions
locks or ownership
validation point
first externally visible mutation
ordered effects
callbacks and reentrancy
commit point
result/values
failure before commit
failure after partial mutation
retry/rollback/cleanup
```

## Coordinates, encodings, and layout

Name every coordinate or unit space and conversion:

- device, root, parent, object, inside/client, viewport, logical, and physical;
- inclusive versus half-open edges;
- signed versus unsigned dimensions;
- clipping order;
- rounding and overflow;
- byte/word/bit order;
- alignment, stride, padding, and indexing; and
- text baseline, raster extent, and advance.

Keep release-specific clipping or parsing defects visible. Do not infer low-level
walker behavior from a wrapper parameter. Reserve exact tie breaking or pixel sets
for source/microcode/runtime evidence.

For declarative layout, define option precedence. Test every pair that can conflict:
origin/size/opposite edge, explicit/default size, content-measured/fixed size, minimum/
maximum, and rounding remainder.

## Concurrency and callbacks

Define ownership and serialization domains before choosing host primitives. Specify:

- lock scope and recursion;
- lock ordering;
- condition/wakeup predicates;
- state to recheck after waiting;
- partial acquisition unwind;
- process/thread affinity;
- interrupt/event producers;
- callback points; and
- operations forbidden while holding a lock.

Do not hold a non-reentrant global lock across arbitrary application callbacks unless
the historical contract requires it. Label modern weak references, immutable
snapshots, transactional indexes, or generation caches as inference.

## Failure and recovery

Inventory invalid inputs and invalid states. For each, define:

- whether behavior is outside contract, a no-op, a condition/error, a restartable
  failure, a wait/retry, or historical undefined behavior;
- which state or pixels may already have changed;
- whether callbacks ran;
- how locks/resources are released;
- whether the object remains usable; and
- what strict and safety-corrected profiles do differently.

Distinguish “source comments say invalid” from “source signals.” A body that clamps to
zero and skips a primitive does not establish a signaled error.

Specify abort at stable interaction boundaries. Test cleanup of temporary windows,
saved state, pending input, transactions, and process ownership.

## API and module closure

A semantic protocol inventory should name required operations by meaning. It is
enough for semantic/behavioral reconstruction, but not for drop-in source claims.

For public API or historical-source compatibility, inventory:

| Surface | Required detail |
| --- | --- |
| Name | package/namespace, symbol, aliases, visibility |
| Kind | function, macro, message, generic, method, variable, type, condition |
| Call | complete signature or grammar, optional/key defaults, evaluation rules |
| Result | values, multiple values, mutation, ownership |
| Failure | conditions, errors, restarts, partial effects |
| Dispatch | inheritance, precedence, method combination, handler resolution |
| Load | defining module, dependencies, cold/warm order, feature gates |

Create a selected-module coverage table so a loaded component cannot silently vanish:

| Module/group | Behavioral status | API/source-compatibility status | TODO |
| --- | --- | --- | --- |

Use `normative`, `partial`, `infrastructure`, `test-only`, or `unclassified`. Do not
infer a module's purpose from its filename alone.

For binary compatibility, add object/tag layout, ABI, calling convention, instruction
or wire encoding, relocation, alignment, version negotiation, and loader behavior.

## Conformance design

Make each test distinguish at least two plausible implementations. Record:

- target profile and level;
- fixture and initial state;
- exact input/action;
- observable trace;
- final state and result;
- byte/pixel/region comparison when applicable; and
- cleanup/integrity condition.

Organize tests by cumulative level or subsystem. Include:

- happy paths and boundary values;
- option-precedence matrices;
- state-transition and lifecycle order;
- simultaneous flags/events to prove priority;
- overlap, clipping, signed dimensions, and aliasing;
- cache/redefinition/invalidation;
- concurrency/wakeup/partial acquisition;
- abort before and after visible mutation;
- extension registration and dynamic enumeration;
- degraded or remote/noninteractive paths;
- release deltas; and
- strict versus safety-corrected behavior.

Avoid tests such as “window opens” or “output looks right” when the contract concerns
dispatch, object identity, or restoration. Pair screenshots with a compact state or
event trace.

## Runtime comparison procedure

Keep the procedure reproducible and non-destructive:

1. Verify the base artifact identity.
2. Copy mutable state into an isolated run area.
3. Record toolchain and emulator/runtime identities.
4. Establish a synthetic fixture with known contents.
5. Perform one discriminating action sequence.
6. Capture output plus state/event trace.
7. Undo or terminate cleanly.
8. Verify base immutability and private-state disposition.
9. Publish only reviewed, policy-permitted evidence.

Give every TODO probe an identifier, setup, action, expected alternatives, and claim
closed. Separate emulator-unit tests from preserved-runtime observations.

## Adversarial review checklist

Require a reviewer to answer:

- Does the opening claim match the actual API/module/test coverage?
- Are releases and artifacts named rather than blended?
- Can every MUST be traced to evidence or explicit inference?
- Does every state transition name preconditions and failure effects?
- Are construction, activation, selection, top-level execution, reuse, and kill
  ordered without invented hooks?
- Are dimensions, coordinate spaces, endpoints, clipping, and rounding unambiguous?
- Are “invalid,” “reject,” “atomic,” “complete,” and “exact” supported literally?
- Are compiled/world claims narrower than source-body claims?
- Are runtime observations bounded to the exact exercised path?
- Are manuals and papers release-bounded?
- Does every selected module have a stated coverage status?
- Can tests reject a plausible but incompatible implementation?
- Are source spans, sizes, hashes, links, and screenshot pixels current?
- Are all proprietary inputs local and all published images rights-reviewed?
- Do TODOs state how to close them rather than merely naming uncertainty?

# Evidence and compatibility model

## Contents

- [Compatibility ladder](#compatibility-ladder)
- [Evidence classes](#evidence-classes)
- [Claim rules](#claim-rules)
- [Conflict resolution](#conflict-resolution)
- [Provenance records](#provenance-records)
- [Licensed and clean-room evidence](#licensed-and-clean-room-evidence)
- [Runtime and screenshot evidence](#runtime-and-screenshot-evidence)
- [Common evidence failures](#common-evidence-failures)

## Compatibility ladder

Define levels cumulatively only when higher levels truly include lower ones. Otherwise
use independent profiles.

| Grain | What it promises | Minimum closure evidence |
| --- | --- | --- |
| Architectural | Same layers, responsibilities, and information flow | Layer graph, ownership, major state, lifecycle |
| Semantic | Same domain objects and operation meanings | Data model, invariants, transitions, values, errors |
| Behavioral | Same externally observable results for declared cases | Runtime oracles and discriminating conformance tests |
| Public API | New clients can target a declared interface | Namespaces, names, signatures, defaults, values, errors |
| Historical source | Selected old clients compile and run unchanged | Complete used API/macro/module manifest plus black-box tests |
| File/wire representation | Existing serialized data or peers interoperate | Grammar, encoding, versioning, limits, malformed-input behavior |
| Binary/artifact | Existing binary clients or artifacts load unchanged | ABI/layout/tags, encodings, relocation, loader and version rules |
| Timing or visual identity | Declared latency/order bounds or pixels match | Stable measurement procedure, tolerances, and target-specific oracles |

Do not let “source-level” mean both semantic operations and exact callable surface.
Use “semantic programming model” for the former. Reserve “drop-in source compatible”
for the latter.

Identify the profile as `release/artifact + compatibility grain + conformance level`.
Examples: `R3/behavioral/L2`, `firmware-1.8/API`, or `world-452/source-subset-mail`.

## Evidence classes

Assign local codes, such as `R3-SRC` or `IMAGE-RUN`, rather than requiring these exact
names.

| Class | Establishes | Does not establish |
| --- | --- | --- |
| Readable source | Selected definition and source-visible order at an identified revision | That a compiled/running artifact contains that definition |
| Compiled binary/bytecode | Encoded constants, symbols, entry points, instructions, or data in the inspected artifact | Original source expression, intent, or another build's behavior |
| World/image/snapshot | Resident definitions, objects, configuration, and state in one preserved image | Clean boot order or behavior in every image/release |
| Runtime observation | Result of the recorded input in the recorded environment | Unobserved branches, hidden state, general timing, or source provenance |
| Manual/reference | Intended and supported public behavior for its release | Exhaustive implementation behavior or later patches |
| Contemporary paper | Design model, chronology, motivation, and paper-era limits | Exact behavior of another release |
| Inference | A reconstruction rule needed to preserve established observations | Historical representation or algorithm |
| TODO/oracle | A precise unresolved claim and how to discriminate it | A result |

Treat comments, debug strings, tests, examples, generated declarations, symbol tables,
and file names as narrower evidence. State exactly what each proves.

## Claim rules

Use these rules for every normative paragraph:

1. Attach a direct evidence code or mark the paragraph as inference.
2. Bound the evidence to a release or artifact.
3. Distinguish inspected behavior from selected reconstruction policy.
4. State negative evidence narrowly: “not found in the selected files/search,” not
   “does not exist.”
5. Preserve source-visible defects when claiming strict compatibility, or name a
   safety-corrected profile and test the divergence.
6. Turn incomplete runtime confirmation into a named oracle, not a weakened
   untraceable assertion.
7. Avoid exact pixel, timing, ordering, or error claims when the available witness
   exposes only a wrapper or declaration.

Use a section evidence map when the document is large:

| Specification section | Source/binary witness | Runtime witness | Manual/paper | Status |
| --- | --- | --- | --- | --- |
| lifecycle | file and line span | probe/session | chapter | closed / inferred / TODO |

Keep line spans within the identified file and revalidate them after edits or source
version changes.

## Conflict resolution

Do not define one universal evidence precedence. Resolve by the claim being made:

- For an observed preserved artifact, runtime wins only for the exercised path.
- For source-profile behavior, the selected source controls even if another image
  differs.
- For supported public API, the release manual controls the advertised contract, but
  source/runtime deviations must remain documented.
- For chronology and intent, prefer contemporary design records and release notes.
- For clean-room architecture, use inference only after extracting observable
  invariants from primary evidence.

Record a disagreement as a matrix:

| Question | Source | Compiled/image | Runtime | Manual/paper | Specification decision |
| --- | --- | --- | --- | --- | --- |

Do not silently choose the newest file, highest version number, most convenient
manual sentence, or most modern design.

## Provenance records

Record enough non-secret metadata to reproduce each claim:

- artifact-relative filename;
- byte size and cryptographic checksum;
- release, patch level, build ID, commit, or media identifier;
- tool and relevant version;
- exact command or deterministic procedure;
- input sequence and environment boundary;
- start/stop integrity state for mutable images;
- output or screenshot checksum; and
- verification date.

Avoid machine-specific absolute paths in publishable documents. Use repository-
relative paths or artifact-relative paths. Keep raw session logs local when they
contain licensed output, personal paths, secrets, or excessive copyrighted material.

## Licensed and clean-room evidence

Separate access to evidence from permission to redistribute it. Inspecting a licensed
source tree can support original behavioral analysis without making the source a
tracked deliverable.

Publish only what repository policy permits, typically:

- original descriptions of behavior and architecture;
- public interface names needed for interoperability;
- small, necessary, attributed excerpts within policy;
- file identities, counts, checksums, and source spans;
- independently written pseudocode;
- black-box tests and synthetic inputs; and
- reviewed screenshots used for bounded scholarship.

Keep proprietary source bodies, extracted fonts/assets/help, decoded bulk output,
world images, and purchased media local and ignored. Do not make a legal conclusion
for downstream users; state the publication boundary and applicable repository
policy.

When proposing a new architecture, label it `INFERRED` (or the local equivalent).
Prefer immutable descriptors, transactions, indexes, or modern locks when useful, but
do not attribute them to the historical system unless evidence does.

## Runtime and screenshot evidence

Design a runtime oracle around one disputed variable. Record:

```text
profile/artifact
initial state
synthetic input
operation sequence
state/event trace
observable result
cleanup and integrity result
claim closed
```

Use reversible or disposable operations. Avoid destructive administrative actions,
network exposure, real credentials, and writes to base media.

For screenshots, record the source session, immediate input, crop/transform, byte
hash, decoded-pixel hash when useful, dimensions, and rights basis. State both what
the image establishes and what it cannot establish.

Do not use a screenshot alone to prove:

- callback or handler selection;
- object identity;
- saved-bit restoration;
- cache invalidation;
- lifecycle ordering;
- absence of hidden state; or
- behavior after an unperformed command.

Pair pixels with an event/state trace when the claim concerns those facts.

## Common evidence failures

Reject these patterns during review:

- **Release averaging:** merge early source, late manual, and current runtime into one
  unnamed system.
- **Symbol-surface overclaim:** infer method bodies from names in a binary.
- **Source-is-runtime assumption:** label a readable definition as observed behavior.
- **Manual completeness assumption:** omit source-visible defaults, defects, or
  recovery paths.
- **Paper time travel:** apply a paper-era limitation to a later patched release.
- **Screenshot omniscience:** infer hidden semantic state from a static frame.
- **Inference laundering:** present a clean-room design choice as historical fact.
- **TODO erasure:** invent a likely result rather than preserve an oracle gap.
- **Rights collapse:** commit proprietary payload because metadata about it is safe.
- **Compatibility inflation:** call a semantic protocol table drop-in source
  compatibility without exact signatures and module closure.

---
type: Editorial Guide
title: Writing and research guide
description: Conventions for evidence-based, preservation-conscious museum documentation in the repository's OKF bundle.
tags: [documentation, okf, preservation, research]
timestamp: 2026-07-19T04:36:35-04:00
---

# Writing and research guide

## Purpose and audience

Write for readers interested in Lisp history who may not already know Lisp-machine
terminology. A page should still contain enough technical precision for an emulator
author or preservation researcher to reproduce its conclusions.

The repository is the source of truth. The documentation may later be rendered by a
static-site generator, but it should remain useful as plain Markdown in Git and on a
terminal.

## Open Knowledge Format profile

The `docs/` tree targets the draft [Open Knowledge Format 0.1 specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md).
This is a deliberately minimal compatibility layer rather than a commitment to a
particular renderer or agent platform.

Every concept page other than the reserved `index.md` and `log.md` filenames begins
with YAML frontmatter containing:

```yaml
---
type: Artifact Analysis
title: Short human-readable title
description: One sentence suitable for an index or search result.
tags: [genera, preservation]
timestamp: 2026-07-16T10:43:25-04:00
---
```

The `type`, `title`, `description`, and `timestamp` fields are required by this
repository's profile. `tags` is strongly encouraged. Use descriptive, stable types;
current examples include `Artifact Analysis`, `Architecture Note`, `Historical
Article`, `Preservation Note`, and `Editorial Guide`. Update the timestamp only for a
meaningful content change, not formatting churn.

Directory `index.md` files contain no frontmatter. The bundle-root `index.md` is the
sole exception and declares `okf_version: "0.1"`. Indexes should link direct child
concepts and subdirectories with a one-sentence description. A `log.md` is optional;
Git history remains authoritative unless maintaining a reader-oriented update log
becomes useful.

OKF 0.1 is a young draft. Keep the content ordinary Markdown and the metadata small
so a future version change or different static-site generator remains a mechanical
migration.

## Recommended page shape

Use only the sections a topic needs, usually in this order:

1. A direct summary or bottom line.
2. Historical or architectural context.
3. Verified details and how the mechanism works.
4. Local artifact observations or experiments.
5. Practical implications for preservation or emulation.
6. Open questions.
7. Sources and verification date.

Label inference as inference. A local observation proves something about the inspected
artifact, not necessarily every release or every Lisp machine.

## Source selection

Prefer sources in this order:

1. Original vendor or project manuals and release notes.
2. Contemporary source code and media inventories.
3. Papers, technical reports, and first-person accounts by implementers.
4. Reproducible inspection of the museum's local artifacts.
5. Secondary histories, used with attribution when primary evidence is unavailable.

Link to the exact document or source file, not a search-results page. Pin code links to
a commit when later edits could change the evidence. Include page or section names for
PDF manuals. Add a `Last verified: YYYY-MM-DD` line when a page depends on a changing
external project.

Do not copy long passages from copyrighted manuals or source files. Paraphrase and use
the shortest quotation that establishes a point.

Manuals describe intended and supported behavior, but do not exhaust the Lisp
Machine's implementation or every shipped interaction. An application study must
also inspect its code and, when the artifact is runnable, exercise it through the
appropriate harness. Actively record meaningful behavior, defaults, incomplete
features, and source/manual/runtime contradictions that are not evident from the
manual. Keep those evidence classes separate instead of choosing the most convenient
one as automatically authoritative.

A reimplementation specification has a stricter burden than an architectural study.
Name the exact release or selectable compatibility profiles, record source,
compiled-artifact or world, runtime, manual, and paper evidence separately, and mark
untested claims as test obligations. Define the externally meaningful objects and
state, invariants, transitions, operation ordering, failure and abort behavior,
extension points, and conformance cases. If preserved releases disagree, expose the
difference as profile behavior; do not synthesize a historically nonexistent average.
Do not call a specification complete merely because it inventories public function
names. State the remaining oracle probes and the compatibility grain that the current
evidence can actually support.

Every interactive application specification also needs, directly or through a named
normative in-repository companion, a complete input-binding inventory for each
selected release profile. Record direct keys, modifier-sensitive
variants, pane/mode/context overrides, prefix keys and every reachable multi-stage
leaf, numeric arguments and repeats, pointer and presentation gestures, menu
accelerators, precedence and shadowing, fallthrough, Help exposure, and unbound
behavior. Express prefix families as a tree or equivalent exact mapping and include
an exhaustive conformance test against the effective runtime table. Distinguish
application-owned bindings from inherited window-system, editor, command-processor,
or CLIM bindings. If there are no application-specific bindings, say so and cite the
evidence.

## Local artifact notes

Do not put private absolute paths into publishable pages. Identify an artifact with a
portable record such as:

- filename and release;
- exact byte size;
- cryptographic checksum;
- inspection command and tool revision;
- whether the result came from public or licensed media.

Never check purchased Open Genera archives, extracted proprietary trees, world images,
credentials, host inventories, or other private machine state into the documentation.

## Runtime screenshots and behavioral verification

When a page documents a visible CADR or Genera application, subsystem, or
interaction, use that system's Xvfb computer-use harness. Do not rely on recollection
for uncertain window titles, menu entries, commands, interaction order, or displayed
results. Reproduce the behavior, record the input sequence, and capture the relevant
state. If the behavior cannot be reached with confidence, label it as an open
question or `TODO` instead of guessing.

Provide a representative screenshot for each distinct visible state discussed by the
page. Use descriptive alt text and a nearby caption that identifies the image as a
runtime observation and states the application, relevant action, load band, and
verification date. Screenshots support a behavioral claim; they do not replace source
or manual evidence for historical intent, lineage, or behavior on other releases.

For both systems, every raw PNG, JSON sidecar, log, disk, world, configuration,
framebuffer dump, and session state remains in the appropriate ignored computer-use
tree. A screenshot selected for publication requires an image- and use-specific
copyright review. Permission is one possible basis, but a documented application of
U.S. fair use may also support publication. Do not infer either a blanket ban from a
licensed runtime or blanket permission from public source availability.

The canonical review and selection rules are in
[Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md).
In short, publish only images needed as evidence beside substantive criticism,
scholarship, research, or historical analysis. Record the four-factor basis, use only
the number and extent needed, and do not publish bulk sequences, decorative galleries,
substantial Help or manual prose, artwork or third-party media, private data, or
material subject to an unreviewed known contract restriction.

Place a reviewed CADR image in `docs/assets/mit-cadr-screenshots/` and a reviewed
Genera image in `docs/assets/genera-screenshots/`. Retain portable provenance in the
article or asset catalog: session and generation, action sequence, release and
artifact identities, dimensions, PNG and pixel hashes, and clean or forced shutdown
status. Use a caption that identifies the runtime observation, underlying
rightsholder interest, fair-use purpose, and lack of endorsement. Curated screenshot
files are excluded from any repository-wide software or content license unless an
asset-specific notice expressly says otherwise.

Do not publish machine-specific paths or link documentation to ignored build output.
If a capture has not passed review, retain it locally and add an explicit screenshot
TODO that identifies the unresolved issue instead of using a generic permission-only
placeholder.

For Genera, an orderly VLM host exit does not establish that the guest saved or
checkpointed memory. Likewise, a shutdown confirmation accepted by the VLM does not
by itself establish orderly process exit. Record prompt, confirmation, cleanup
progress, and any bounded forced termination as separate observations.

The system-specific provenance and execution boundaries are documented in
[Operating CADR through the Xvfb computer-use harness](mit-cadr/cadr-computer-use-harness.md)
and
[Operating Genera through the Xvfb computer-use harness](genera/genera-computer-use-harness.md).

## Markdown conventions

- Use one H1 heading per file.
- Use lowercase, hyphen-separated filenames.
- Use relative links for other pages and files in this repository.
- Use ordinary fenced code blocks and portable GFM pipe tables.
- Use only the OKF YAML frontmatter described above; avoid renderer-specific fields,
  shortcodes, or link syntax until a site generator has deliberately been selected.
- Link new pages from the relevant collection index. Promote broadly useful entry
  points to [the main index](index.md).

Operational instructions belong primarily in the root README. The knowledge base
should explain history, architecture, formats, provenance, and lessons that outlast a
particular host setup.

## Sources

- Google Cloud Platform, [Open Knowledge Format 0.1 specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md),
  revision `d44368c`, verified 2026-07-16.

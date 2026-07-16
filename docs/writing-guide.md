---
type: Editorial Guide
title: Writing and research guide
description: Conventions for evidence-based, preservation-conscious museum documentation in the repository's OKF bundle.
tags: [documentation, okf, preservation, research]
timestamp: 2026-07-16T10:43:25-04:00
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

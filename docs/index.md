---
okf_version: "0.1"
---

# Lisp Machine Museum knowledge base

This is the durable research and interpretation layer of the repository. It records
what the preserved systems are, how their artifacts work, and what we learn while
running and studying them.

The root [README](../README.md) remains the practical guide to launching the museum.
These pages are written as portable Markdown so they can become the source of a future
public static site without moving the canonical content elsewhere.

The `docs/` directory is an Open Knowledge Format 0.1 bundle. OKF adds a small,
machine-readable metadata layer while retaining ordinary Markdown as the source.

## Collections

- [Symbolics Genera and Open Genera](genera/index.md) - The later Symbolics system,
  its Virtual Lisp Machine, and preserved Open Genera artifacts.
- [MIT CADR and LM-3](mit-cadr/index.md) - The earlier public MIT Lisp Machine
  lineage represented by CADR-compatible software and emulation.

## Start here

- [Open Genera world loads and the VLOD format](genera/world-loads-and-vlod.md) explains
  what a `.vlod` contains, why it is closer to a cold heap snapshot than an archive,
  and what can currently be recovered from one.
- [Recovering code and assets from a Genera world](genera/recovering-code-and-assets-from-worlds.md)
  explains what “decompiled Lisp” can honestly mean and how resident fonts differ
  from their original source files.
- [Extracting resident fonts from a Genera world](genera/extracting-resident-fonts.md)
  provides the reproducible local-only VLOD workflow and links the evidence-graded
  catalog of all 89 fonts in the inspected world.
- [MIT CADR font sources and recovery](mit-cadr/font-sources-and-recovery.md) explains
  the public source-first pipeline and catalogs the trackable BDF and PNG derivatives.
- [MIT CADR compiled QFASL font recovery](mit-cadr/compiled-qfasl-font-recovery.md)
  documents the separate non-evaluating extraction of 19 public runtime font objects
  and the evidence distinguishing them from authoring source.
- [MIT CADR font usage audit](mit-cadr/font-usage-audit.md) identifies source-backed
  roles where the pinned source supports them and leaves evidence-bounded `TODO`s for
  every unresolved name.

## Editorial principles

The museum favors primary sources and reproducible artifact inspection. Pages should
separate verified facts from local observations, interpretation, and unanswered
questions. Licensed historical software is described but not redistributed.

See the [writing and research guide](writing-guide.md) for the OKF profile, page
conventions, and evidence rules.

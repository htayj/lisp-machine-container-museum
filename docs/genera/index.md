# Symbolics Genera and Open Genera

This collection covers Genera as a Lisp-machine operating environment and Open Genera
as its Virtual Lisp Machine implementation hosted on Unix.

## Articles

- [Zmacs in Symbolics Genera](zmacs.md) documents the ZWEI substrate, object
  model, Zmacs application, development features, modes, source/manual
  discrepancies, and isolated Genera 8.5 observations; its
  [binding companion](zmacs-keybindings.md) enumerates the inspected configured
  tables, while the [named-command audit](zmacs-named-commands.md) records the
  counts, categories, and installation semantics of 277 source candidates
  without publishing the exact licensed-source inventory.
- [Operating Genera through the Xvfb computer-use harness](genera-computer-use-harness.md) -
  How authenticated, network-isolated private sessions turn real VLM keyboard,
  pointer, and screenshot observations into evidence without distributing licensed
  artifacts, and distinguish accepted shutdown confirmation from the current forced
  cleanup stall and from in-guest Save World.
- [World loads and the VLOD format](world-loads-and-vlod.md) - How a VLM world stores
  Genera's tagged virtual memory and what can be recovered from it.
- [Recovering code and assets from a world](recovering-code-and-assets-from-worlds.md)
  - The boundary between original source, decompiled executable representations, and
  effect-preserving recovery of resident fonts and other assets.
- [Extracting resident fonts from a Genera world](extracting-resident-fonts.md) - The
  reproducible local-only workflow for decoding licensed world-resident fonts into
  BDF, normalized records, and specimen sheets.
- [Genera 8.5 resident font catalog](font-catalog.md) - Evidence-graded styles,
  character-set roles, application uses, and explicit unknowns for all 89 distinct
  font objects in the inspected base world.
- [Genera on-line help and documentation recovery](online-help-and-documentation-recovery.md)
  - The indexed Sage Binary corpus, Document Examiner and runtime help layers, and a
  complete local-only decode of all 801 licensed documentation databases plus three
  consumer-audited standalone help files.

## Assets

- [Curated Genera runtime screenshots](../assets/genera-screenshots/) - Six
  capture-specific-reviewed Zmacs states with exact raw mappings, action-prefix
  provenance, image hashes, shutdown evidence, fair-use scope, and project-license
  exclusion.

## Planned areas

- the Ivory architecture and the Virtual Lisp Machine;
- cold boot, world building, and incremental disk save;
- Genera's object, package, system, and file models;
- Dynamic Windows, presentations, and the development environment;
- networking and the relationship between the VLM and its Unix host;
- release-media provenance and responsible preservation of licensed artifacts.

For launch and host-integration instructions, see the root
[Open Genera guide](../../README.md#open-genera).

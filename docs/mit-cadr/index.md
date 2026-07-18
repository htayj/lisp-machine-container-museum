# MIT CADR and LM-3

This collection covers the MIT CADR Lisp Machine lineage represented in the museum by
the public LM-3 software and the `usim` emulator.

## Articles

- [EINE, the first Lisp Machine editor](eine.md) studies the exact late-1977
  recipe-derived source corpus, definition-oriented file model, graphical
  interaction, and source-visible incomplete behavior; its
  [binding companion](eine-keybindings.md) inventories every initial keyboard,
  prefix, named-command, and mouse entry.
- [ZWEI and Zmacs on the MIT CADR and LM-3](zwei-and-zmacs.md) documents the
  reusable editing substrate, Zmacs application, public System 46 source gap,
  maintained System 303 implementation, and verified runtime behavior; its
  [binding companion](zwei-zmacs-keybindings.md) gives release-bounded tables.
- [Operating CADR through the Xvfb computer-use harness](cadr-computer-use-harness.md)
  documents the sentinel-owned private-session architecture, hardened screenshot
  provenance, shared-executable verification, observed System 303 interactions, and
  the current warm-resume limitation.
- [MIT CADR on-line help and documentation recovery](online-help-and-documentation-recovery.md)
  explains ZWEI self-documentation, Lisp and flavor metadata, key and application
  Help handlers, the tracked 949-declaration System 46 recovery, and the
  metadata-only LM-3 cross-check.
- [Visual assets in the MIT CADR and LM-3 software](visual-assets-inventory.md)
  inventories the native picture, sprite-font, paint-pattern, SUDS drawing, and
  procedural graphics forms, with a local-only decoder for two standalone System 46
  pictures.
- [Color inks and raster patterns in the MIT CADR software](color-inks-and-raster-patterns.md)
  explains why `COLOR-INKS` is a legacy solid-fill cache rather than a fixed
  palette, shows the source-defined color maps, and distinguishes the window
  system's named gray stipples.
- [MUNCH and Munching Squares on the MIT CADR](munch.md) explains the classic
  PDP-1-derived XOR display algorithm, its interactive switch register, and the
  distinct System 46 and LM-3 System 303 implementations.
- [LEXIPHAGE, the Lisp Machine word eater](lexiphage.md) traces the text-eating
  animation through its compact CADR, later LM-3, and separate PDP-10 TV source
  forms, including its `43VXMS` font use and evidence-bounded attribution.
- [MIT CADR font sources and recovery](font-sources-and-recovery.md) explains how the
  public source representations are decoded into the tracked BDF fonts and PNG font
  sheets, without reading a load band or VLOD.
- [MIT CADR compiled QFASL font recovery](compiled-qfasl-font-recovery.md) explains
  the separate non-evaluating recovery of 19 public serialized runtime font objects,
  including exact source cross-checks and two older compiled versions.
- [MIT CADR font usage audit](font-usage-audit.md) records the evidence-backed role
  or explicit `TODO` boundary for every source-backed and compiled-only font name.

## Generated assets and local outputs

- [Curated MIT CADR runtime screenshots](../assets/mit-cadr-screenshots/) contain
  four exact System 303 Zmacs framebuffer captures with session provenance and an
  asset-specific fair-use review; the PNGs are excluded from any project-wide
  license.
- [MIT CADR System 46 on-line help assets](../assets/mit-cadr-online-help/)
  contain four standalone files, 89 exact source-context files, the public source
  license, and machine-readable and readable catalogs.
- Reconstructed `10LEAF` and `SCANIN CWH3` pictures intentionally remain untracked
  under `build/visual-assets/mit-cadr/` while their content rights are unresolved.
- [CADR color-map specimen](../assets/mit-cadr-color-inks/palettes.png) shows three
  idealized, source-derived mappings of the sixteen four-bit pixel indexes.
- [MIT CADR font assets](../assets/mit-cadr-fonts/) contains the source-provenance
  catalog, 150 BDF fonts, 150 font-sheet images, and a copy of the public source
  license.
- [MIT CADR compiled QFASL font assets](../assets/mit-cadr-qfasl-fonts/) contains the
  compiled-artifact catalog and 19 BDF, normalized JSON, and PNG sheet exports.
- [MIT CADR font usage catalog](font-usage-catalog.json) is the machine-readable
  companion to the per-font source audit.

## Planned areas

- CADR architecture and microcode;
- cold-load and distribution load bands;
- disk images and the relationship between load bands and the file system;
- the Lisp Machine user environment and keyboard conventions;
- the provenance and lineage of the LM-3 repositories used by this museum;
- comparisons with later Symbolics Genera mechanisms, with differences kept explicit.

For current launch, build, and LOD-inspection commands, see the root
[CADR / LM-3 guide](../../README.md#cadr--lm-3).

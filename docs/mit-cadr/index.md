# MIT CADR and LM-3

This collection covers the MIT CADR Lisp Machine lineage represented in the museum by
the public LM-3 software and the `usim` emulator.

## Articles

- [MIT CADR font sources and recovery](font-sources-and-recovery.md) explains how the
  public source representations are decoded into the tracked BDF fonts and PNG font
  sheets, without reading a load band or VLOD.
- [MIT CADR compiled QFASL font recovery](compiled-qfasl-font-recovery.md) explains
  the separate non-evaluating recovery of 19 public serialized runtime font objects,
  including exact source cross-checks and two older compiled versions.
- [MIT CADR font usage audit](font-usage-audit.md) records the evidence-backed role
  or explicit `TODO` boundary for every source-backed and compiled-only font name.

## Generated public assets

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

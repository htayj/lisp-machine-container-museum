# C-M3 upstream adapter framing

The M3-P2 upstream adapter emits three sidecars. All integer fields in the
binary stream are unsigned little-endian. NDJSON is UTF-8 with one compact
`sort_keys=True` JSON object and one LF per line.

## `CDRM3AD1`

The 32-byte header is:

| Offset | Width | Value |
| ---: | ---: | --- |
| 0 | 8 | `CDRM3AD1` |
| 8 | 4 | schema `1` |
| 12 | 4 | digest width `32` |
| 16 | 8 | boundary count |
| 24 | 8 | requested slots |

One 32-byte digest follows for every boundary `S0..S(requested_slots)`.
Its SHA-256 preimage is exactly:

```text
"CDRM3AD1\0" ||
u32le(1) || u64le(S) || u32le(phase) ||
for tag 1..60: u32le(tag) || u32le(width) || value:width little-endian
```

Phase is `0` at S0, `1` after an executed slot, and `2` after an inhibited
slot. Tags 1–60 are the common scalar inventory in
`cadr_oracle_native.c::state_scalars`; cycle and 48-bit-word tags have width
eight and all other tags have width four. The 48-bit words are masked and
booleans are normalized to zero or one before hashing.

The 32-byte footer contains `CDRM3AE1` at offset 0, observed count at offset 8,
terminal status at offset 16, and zero reserved bytes.

## `CDRM3BUS1`

The first NDJSON object has exactly `schema`, `schema_version`, and
`requested_slots`. Every later object has:

```text
record, post_slot_s, intra_slot_sequence, direction,
physical_word_address, write_value, read_result,
bus_error_after, interrupt_status_after
```

The sequence is zero-based within each post-slot S. Reads set `write_value` to
zero; writes set `read_result` to zero. `direction` is exactly `read` or
`write`.

## `CDRM3DISK1`

The metadata line has the same shape as `CDRM3BUS1`. Every disk object contains
all of these fields, including zero/`none` values when a field is inapplicable:

```text
record, post_slot_s, intra_slot_sequence, action,
register_direction, register_offset, input_value, returned_value,
command, clp, da, lma, status, reset,
done_interrupt_enable, attention_interrupt_enable, interrupt_action,
request_ready, request_direction, request_clp, request_cylinder,
request_head, request_block, selected_unit, selected_configured,
selected_online, selected_read_only, selected_fault, selected_attention,
selected_seek_error, selected_cylinder, selected_head, selected_lba,
media_action
```

Actions are `register`, `interrupt`, `request`, `block`, or `completion`.
`register_direction` is `read`, `write`, or `none`; `interrupt_action` is
`assert`, `deassert`, or `none`; `request_direction` is `read`, `compare`, or
`none`; and `media_action` is `request`, `block`, `completion`, or `none`.
The comparator consumes typed objects in file order and reports the first
boundary, sequence, and field mismatch.

## Reproducible upstream build

The disposable copied upstream source is compiled with file, macro, and debug
prefix mapping to `/usr/src/cadr-m3-upstream`, `SOURCE_DATE_EPOCH=0`, and an
explicit SHA-1 linker build ID. The capture records those settings and the
resulting executable hash. This keeps the executable identity and therefore
the identity-bearing raw `CDRTRC1` stream independent of the random staging
directory; the three adapter sidecars remain the normative cross-core
comparison artifacts.

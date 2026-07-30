#ifndef CADR_M9_INPUT_H
#define CADR_M9_INPUT_H

/*
 * CDRINP1 is the M8/M9 browser-to-core ingress record.  It is deliberately
 * separate from the scheduler wire format: native usim accepts keyboard and
 * mouse input at the device boundary, not as a synthetic timer event.
 *
 * All fields are little-endian.  The exact 40-byte record is:
 *
 *   0  [8]  "CDRINP1\\0"
 *   8  u16  schema (1)
 *  10  u16  kind (keyboard=1, pointer EDGE32=2)
 *  12  u32  flags (zero)
 *  16  u64  machine generation
 *  24  u64  shared ingress ordinal (strictly next)
 *  32  u32  payload
 *  36  u32  reserved (zero)
 */

#include <stdint.h>

#define CADR_M9_INPUT_RECORD_BYTES UINT32_C(40)
#define CADR_M9_INPUT_SCHEMA UINT16_C(1)
#define CADR_M9_INPUT_KIND_KEYBOARD UINT16_C(1)
#define CADR_M9_INPUT_KIND_POINTER UINT16_C(2)

#endif

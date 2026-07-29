#ifndef CADR_STATE_V4_H
#define CADR_STATE_V4_H

#include <stdint.h>
#include "cadr_state.h"

/* Additive M4 digest.  CDRSTATE1/2/3 byte contracts are unchanged. */
#define CADR_STATE_V4_SCHEMA_VERSION UINT32_C(1)
cadr_status cadr_state_v4_digest(const cadr_machine_state *state, uint8_t digest[CADR_SHA256_BYTES]);

#endif

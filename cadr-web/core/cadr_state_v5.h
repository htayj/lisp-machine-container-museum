#ifndef CADR_STATE_V5_H
#define CADR_STATE_V5_H

#include <stdint.h>

#include "cadr_state.h"

/* Additive M5 digest; CDRSTATE1 through CDRSTATE4 remain frozen. */
#define CADR_STATE_V5_SCHEMA_VERSION UINT32_C(1)
cadr_status cadr_state_v5_digest(const cadr_machine_state *state,
                                 uint8_t digest[CADR_SHA256_BYTES]);

#endif

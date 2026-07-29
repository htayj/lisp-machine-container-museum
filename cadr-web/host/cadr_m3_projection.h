#ifndef CADR_M3_PROJECTION_H
#define CADR_M3_PROJECTION_H

#include "cadr_host_api.h"
#include "cadr_state.h"

#include <stdint.h>

#define CADR_M3_PROJECTION_SCHEMA UINT32_C(1)
#define CADR_M3_PROJECTION_PHASE_S0 UINT32_C(0)
#define CADR_M3_PROJECTION_PHASE_EXECUTED UINT32_C(1)
#define CADR_M3_PROJECTION_PHASE_INHIBITED UINT32_C(2)

/* Native-only M3-P2 common-scalar projection; no public ABI surface. */
cadr_status cadr_m3_projection_digest(const cadr_machine_state *state,
                                      uint64_t boundary, uint32_t phase,
                                      uint8_t digest[CADR_SHA256_BYTES]);

#endif

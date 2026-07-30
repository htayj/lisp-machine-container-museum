#ifndef CADR_M6_FAST_RUN_H
#define CADR_M6_FAST_RUN_H

/*
 * M6-DEVID1-only bulk runner.  The core scheduler remains the sole authority
 * for one-slot execution; this helper merely keeps the repeated calls inside
 * C so a protocol-v4 client never transfers a per-slot digest or depends on a
 * host timer.  It is deliberately not part of cadr_host_api.h.
 */
#include "cadr_machine.h"

#include <stdint.h>

#define CADR_M6_FAST_RUN_MAX_SLOTS UINT32_C(1048576)
#define CADR_M6_FAST_RUN_RECORD_BYTES UINT32_C(128)
#define CADR_M6_FAST_RUN_SCHEMA_VERSION UINT32_C(1)

#define CADR_M6_FAST_RUN_REASON_ENDPOINT UINT32_C(1)
#define CADR_M6_FAST_RUN_REASON_DEBUG_CHANGED UINT32_C(2)
#define CADR_M6_FAST_RUN_REASON_WAITING_FOR_HOST UINT32_C(3)
#define CADR_M6_FAST_RUN_REASON_FATAL UINT32_C(4)

typedef struct cadr_m6_fast_run_result {
    uint32_t reason;
    uint32_t status;
    uint32_t requested_slots;
    uint32_t reserved0;
    uint64_t completed_slots;
    uint64_t microinstruction_delta;
    uint64_t pre_boundary;
    uint64_t post_boundary;
    uint64_t debug_before;
    uint64_t debug_after;
    uint32_t persistent_status;
    uint32_t lifecycle;
    uint64_t outstanding_request_id;
} cadr_m6_fast_run_result;

/* The output record is always CDRM6FAST1/1/128 and all bytes not named by
 * the layout are zero.  A valid stop is represented in the record; only a
 * malformed call or impossible internal counter transition returns an error.
 */
cadr_status cadr_m6_fast_run(cadr_machine *machine, uint32_t requested_slots,
                             cadr_m6_fast_run_result *out_result);
cadr_status cadr_m6_fast_run_serialize(const cadr_m6_fast_run_result *result,
                                        uint8_t bytes[CADR_M6_FAST_RUN_RECORD_BYTES]);

#if defined(CADR_M6_FAST_RUN_TESTING)
typedef void (*cadr_m6_fast_run_test_hook)(cadr_machine *machine,
                                           uint64_t completed_slots);
void cadr_m6_fast_run_test_set_hook(cadr_m6_fast_run_test_hook hook);
#endif

#endif

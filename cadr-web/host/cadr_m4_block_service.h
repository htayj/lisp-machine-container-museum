/*
 * M4-D0 host-side immutable block service.
 *
 * This is deliberately a host helper, not part of cadr_host_api.h.  The core
 * owns request identity and device state; this helper only snapshots a range
 * from an immutable image and delivers the matching completion at a guest
 * boundary chosen by the caller.  It has no wall-clock, thread, or callback
 * scheduling dependency, so the same schedule is usable by native and wasm
 * harnesses.
 */
#ifndef CADR_M4_BLOCK_SERVICE_H
#define CADR_M4_BLOCK_SERVICE_H

#include "cadr_host_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CADR_M4_BLOCK_SERVICE_BLOCK_BYTES UINT32_C(1024)
#define CADR_M4_BLOCK_SERVICE_MAX_COMPLETION_BYTES UINT32_C(1048576)

#define CADR_M4_BLOCK_FAULT_NONE             UINT32_C(0)
#define CADR_M4_BLOCK_FAULT_STATUS_FAILED    (UINT32_C(1) << 0U)
#define CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE  (UINT32_C(1) << 1U)
#define CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK   (UINT32_C(1) << 2U)
#define CADR_M4_BLOCK_FAULT_KNOWN \
    (CADR_M4_BLOCK_FAULT_STATUS_FAILED | CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE | \
     CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK)

/*
 * `expected_image_byte_count` binds a service instance to the selected image
 * identity at construction.  It is intentionally a byte-count check only;
 * the caller must verify the pinned image digest before exposing its bytes.
 * `latency_ticks` is guest time, never elapsed host time.  Profile M4-D0 uses
 * zero, which means issue and delivery occur in the same between-boundaries
 * service turn; the core dispatches the queued completion on its next run.
 */
typedef struct cadr_m4_block_service_config {
    const uint8_t *image_bytes;
    uint64_t image_byte_count;
    uint64_t expected_image_byte_count;
    uint64_t latency_ticks;
    uint32_t block_bytes;
    uint32_t fault_mask;
} cadr_m4_block_service_config;

typedef struct cadr_m4_block_service_event {
    uint32_t request_seen;
    uint32_t completion_delivered;
    uint32_t host_status;
    uint32_t reserved0;
    uint64_t issue_tick;
    uint64_t due_tick;
    uint64_t delivery_tick;
    uint64_t generation;
    uint64_t request_id;
    uint64_t first_block;
    uint32_t block_count;
    uint32_t block_bytes;
    uint64_t completion_byte_count;
} cadr_m4_block_service_event;

typedef struct cadr_m4_block_service {
    const uint8_t *image_bytes;
    uint64_t image_byte_count;
    uint64_t latency_ticks;
    uint64_t issue_tick;
    uint64_t due_tick;
    cadr_host_request request;
    uint64_t first_block;
    uint32_t block_count;
    uint32_t block_bytes;
    uint32_t host_status;
    uint32_t fault_mask;
    uint32_t pending;
    uint8_t completion_bytes[CADR_M4_BLOCK_SERVICE_MAX_COMPLETION_BYTES];
} cadr_m4_block_service;

cadr_status cadr_m4_block_service_init(
    cadr_m4_block_service *service,
    const cadr_m4_block_service_config *config);

/*
 * Poll exactly once between machine boundaries.  A successful return with an
 * empty event means that no request was pending.  `guest_tick` is normally
 * the immediately preceding `cadr_machine_info.clock_slots_completed`.
 */
cadr_status cadr_m4_block_service_poll(
    cadr_m4_block_service *service, cadr_machine *machine, uint64_t guest_tick,
    cadr_m4_block_service_event *event);

#ifdef __cplusplus
}
#endif

#endif

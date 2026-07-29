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
#define CADR_M4_BLOCK_SERVICE_MAX_DESCRIPTOR_BYTES UINT32_C(64)

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
    cadr_status (*read_range)(void *context, uint64_t byte_offset,
                              uint8_t *out_bytes, uint64_t byte_count);
    void *read_context;
    uint64_t image_byte_count;
    uint64_t expected_image_byte_count;
    uint64_t latency_ticks;
    uint32_t block_bytes;
    uint32_t fault_mask;
    /* Zero operation/occurrence and UINT64_MAX block mean "any". */
    uint32_t fault_operation;
    uint32_t reserved0;
    uint64_t fault_first_block;
    uint64_t fault_occurrence;
} cadr_m4_block_service_config;

typedef struct cadr_m4_block_service_event {
    uint32_t request_seen;
    uint32_t completion_delivered;
    uint32_t host_status;
    uint32_t operation;
    uint32_t overlay_prepared;
    uint32_t overlay_committed;
    uint32_t overlay_discarded;
    uint32_t overlay_replayed;
    uint32_t fault_mask;
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
    uint64_t descriptor_byte_count;
    uint64_t request_payload_byte_count;
    uint64_t transaction_id;
    uint64_t overlay_generation;
    uint8_t descriptor[CADR_M4_BLOCK_SERVICE_MAX_DESCRIPTOR_BYTES];
    uint8_t descriptor_sha256[CADR_SHA256_BYTES];
    uint8_t request_payload_sha256[CADR_SHA256_BYTES];
    uint8_t page_sha256[CADR_SHA256_BYTES];
} cadr_m4_block_service_event;

typedef struct cadr_m4_block_service {
    cadr_status (*read_range)(void *context, uint64_t byte_offset,
                              uint8_t *out_bytes, uint64_t byte_count);
    void *read_context;
    uint64_t image_byte_count;
    uint64_t latency_ticks;
    uint64_t issue_tick;
    uint64_t due_tick;
    cadr_host_request_m4 request;
    uint64_t first_block;
    uint32_t block_count;
    uint32_t block_bytes;
    uint32_t host_status;
    uint32_t fault_mask;
    uint32_t active_fault_mask;
    uint32_t pending;
    uint32_t staged;
    uint32_t overlay_valid;
    uint32_t replay;
    uint32_t fault_operation;
    uint32_t reserved0;
    uint64_t fault_first_block;
    uint64_t fault_occurrence;
    uint64_t fault_match_count;
    uint64_t transaction_id;
    uint64_t overlay_generation;
    uint64_t committed_generation;
    uint64_t committed_request_id;
    uint64_t committed_transaction_id;
    uint8_t descriptor[CADR_M4_BLOCK_SERVICE_MAX_DESCRIPTOR_BYTES];
    uint8_t descriptor_sha256[CADR_SHA256_BYTES];
    uint8_t request_payload_sha256[CADR_SHA256_BYTES];
    uint8_t page_sha256[CADR_SHA256_BYTES];
    uint8_t staged_bytes[CADR_M4_BLOCK_SERVICE_BLOCK_BYTES];
    uint8_t overlay_bytes[CADR_M4_BLOCK_SERVICE_BLOCK_BYTES];
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

uint64_t cadr_m4_block_service_overlay_generation(
    const cadr_m4_block_service *service);

/* M4 snapshots are unavailable until a later format owns volatile media. */
cadr_status cadr_m4_block_service_snapshot_status(
    const cadr_m4_block_service *service);
cadr_status cadr_m4_block_service_snapshot_size(
    const cadr_m4_block_service *service, cadr_machine *machine,
    const cadr_snapshot_request *request, uint64_t *out_size);
cadr_status cadr_m4_block_service_snapshot_save(
    const cadr_m4_block_service *service, cadr_machine *machine,
    const cadr_snapshot_request *request, uint8_t *bytes, uint64_t capacity,
    uint64_t *out_written);
cadr_status cadr_m4_block_service_snapshot_restore(
    const cadr_m4_block_service *service,
    const cadr_snapshot_request *request, const uint8_t *bytes,
    uint64_t byte_count, cadr_machine **out_machine);

void cadr_m4_block_service_discard(cadr_m4_block_service *service);

#ifdef __cplusplus
}
#endif

#endif

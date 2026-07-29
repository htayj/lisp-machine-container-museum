#ifndef CADR_EVENT_STATE_H
#define CADR_EVENT_STATE_H

#include <stdint.h>

#define CADR_MAX_HOST_DESCRIPTOR_BYTES 64U

/* Core-owned request and copied completion queue; no host resource survives. */
typedef struct cadr_event_state {
    uint64_t generation;
    uint64_t next_request_id;
    uint64_t outstanding_request_id;
    uint64_t last_completed_request_id;
    uint8_t request_descriptor[CADR_MAX_HOST_DESCRIPTOR_BYTES];
    uint64_t request_descriptor_byte_count;
    uint8_t request_payload[CADR_MAX_HOST_REQUEST_PAYLOAD_BYTES];
    uint64_t request_payload_byte_count;
    uint64_t expected_completion_byte_count;
    uint8_t *completion_bytes;
    uint64_t completion_byte_count;
    uint32_t outstanding_operation;
    uint32_t completion_host_status;
    uint32_t completion_queued;
    uint32_t persistent_status;
    uint32_t unexpected_bus_operation;
    uint32_t reserved0;
} cadr_event_state;

#endif

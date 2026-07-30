#ifndef CADR_M6_DISK_EVIDENCE_H
#define CADR_M6_DISK_EVIDENCE_H

/*
 * M6-DEVID1's bounded continuation witness.  This is deliberately separate
 * from the frozen M4 CDRDISKEVID1 log: the latter remains a 512-record
 * producer/serializer with its original overflow semantics.
 */
#include "cadr_disk_evidence.h"

#include <stdint.h>

#define CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY CADR_DISK_EVIDENCE_CAPACITY
#define CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES UINT64_C(512)
#define CADR_M6_DISK_EVIDENCE_POLICY_CODE UINT32_C(1)
#define CADR_M6_DISK_EVIDENCE_POLICY_ID "M6-PREFIX512-TAILSHA256-v1"

#ifndef CADR_M6_DEVID_MAX_TOTAL_EVENTS
#define CADR_M6_DEVID_MAX_TOTAL_EVENTS UINT64_C(0x7fffffffffffffff)
#endif

typedef struct cadr_m6_disk_evidence_state {
    uint64_t total_accepted;
    uint64_t per_kind[9];
    uint64_t tail_event_count;
    uint64_t first_omitted_sequence;
    uint64_t last_sequence;
    uint64_t last_post_slot;
    uint32_t last_intra_slot;
    uint32_t have_last;
    cadr_disk_evidence_tuple last_after;
    uint64_t selected_maximum;
    uint32_t tail_started;
    uint32_t limit_exceeded;
    uint8_t tail_sha256[CADR_SHA256_BYTES];
    uint64_t limit_attempt_post_slot;
    uint32_t limit_attempt_intra_slot;
    uint32_t limit_reason;
    uint8_t limit_rejected_event_sha256[CADR_SHA256_BYTES];
} cadr_m6_disk_evidence_state;

void cadr_m6_disk_evidence_cold_power_on(cadr_m6_disk_evidence_state *state);

/* `event` must already contain all final hashes.  No input may be changed by
 * a successful or rejected append except the M6 summary state and, for the
 * first 512 accepted events, the exact frozen M4 prefix log. */
cadr_status cadr_m6_disk_evidence_append(
    cadr_m6_disk_evidence_state *state, cadr_disk_evidence_log *prefix,
    const cadr_disk_evidence_event *event);

/* Constructs the one final event consumed by append.  This is the sole M6
 * controller-producer path; notably write DELIVERY copies delivery_sha256
 * from raw completion bytes before replacing page_sha256 with payload. */
cadr_status cadr_m6_disk_evidence_produce_final_event(
    cadr_m6_disk_evidence_state *state, cadr_disk_evidence_log *prefix,
    uint64_t post_slot, const cadr_disk_evidence_tuple *after,
    uint32_t kind, uint32_t flags, uint64_t first, uint64_t second,
    uint32_t value, uint32_t detail, uint32_t operation,
    const uint8_t *request_descriptor, uint64_t request_descriptor_byte_count,
    const uint8_t *request_payload, uint64_t request_payload_byte_count,
    const uint8_t *event_bytes, uint64_t event_byte_count);

/* Exact 384-byte canonical record used both by the frozen prefix and tail. */
void cadr_m6_disk_evidence_encode_event(
    uint8_t bytes[CADR_DISK_EVIDENCE_RECORD_BYTES],
    const cadr_disk_evidence_event *event);

int cadr_m6_disk_evidence_tail_started(const cadr_m6_disk_evidence_state *state);
int cadr_m6_disk_evidence_limit_exceeded(const cadr_m6_disk_evidence_state *state);

/* Writes the fixed CDRM6E1 record and validates all internal relationships. */
cadr_status cadr_m6_disk_evidence_summary_serialize(
    const cadr_m6_disk_evidence_state *state,
    const cadr_disk_evidence_log *prefix, uint8_t *bytes,
    uint64_t capacity, uint64_t *written);

#endif

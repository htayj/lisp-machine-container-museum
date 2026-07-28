#ifndef CADR_TRACE_ENGINE_H
#define CADR_TRACE_ENGINE_H

/* Internal CDRGTRC1 producer.  This is not part of cadr_host_api.h. */

#include <stdint.h>

#include "cadr_state_v2.h"

#define CADR_TRACE_SELECTOR_MICRO_PC          (UINT64_C(1) << 0U)
#define CADR_TRACE_SELECTOR_DECODED_WORD      (UINT64_C(1) << 1U)
#define CADR_TRACE_SELECTOR_A_SOURCE          (UINT64_C(1) << 2U)
#define CADR_TRACE_SELECTOR_M_SOURCE          (UINT64_C(1) << 3U)
#define CADR_TRACE_SELECTOR_DESTINATION       (UINT64_C(1) << 4U)
#define CADR_TRACE_SELECTOR_Q                 (UINT64_C(1) << 5U)
#define CADR_TRACE_SELECTOR_VMA               (UINT64_C(1) << 6U)
#define CADR_TRACE_SELECTOR_MD                (UINT64_C(1) << 7U)
#define CADR_TRACE_SELECTOR_MACRO_PC          (UINT64_C(1) << 8U)
#define CADR_TRACE_SELECTOR_FAULT             (UINT64_C(1) << 9U)
#define CADR_TRACE_SELECTOR_INTERRUPT         (UINT64_C(1) << 10U)
#define CADR_TRACE_SELECTOR_DEVICE_TRANSACTION (UINT64_C(1) << 11U)
#define CADR_TRACE_SELECTOR_KNOWN             ((UINT64_C(1) << 12U) - UINT64_C(1))

#define CADR_TRACE_EVENT_CLOCK                UINT64_C(1)
#define CADR_TRACE_EVENT_INTERRUPT            UINT64_C(2)
#define CADR_TRACE_EVENT_DEVICE               UINT64_C(4)
#define CADR_TRACE_EVENT_FAULT                UINT64_C(8)
#define CADR_TRACE_EVENT_HALT                 UINT64_C(16)
#define CADR_TRACE_EVENT_KNOWN                (CADR_TRACE_EVENT_CLOCK | CADR_TRACE_EVENT_INTERRUPT | CADR_TRACE_EVENT_DEVICE | CADR_TRACE_EVENT_FAULT | CADR_TRACE_EVENT_HALT)

#define CADR_TRACE_BOUNDARY_EXECUTED UINT16_C(1)
#define CADR_TRACE_BOUNDARY_INHIBITED UINT16_C(2)
#define CADR_TRACE_BOUNDARY_HALT UINT16_C(4)
#define CADR_TRACE_BOUNDARY_CHECKPOINT UINT16_C(8)

#define CADR_TRACE_REASON_COMPLETE_LIMIT UINT32_C(0)
#define CADR_TRACE_REASON_COMPLETE_HALT UINT32_C(1)
#define CADR_TRACE_REASON_ABORT UINT32_C(2)
#define CADR_TRACE_REASON_FAILURE UINT32_C(3)

#define CADR_TRACE_TRANSACTION_READ UINT32_C(0)
#define CADR_TRACE_TRANSACTION_WRITE UINT32_C(1)
#define CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD UINT32_C(1)
#define CADR_TRACE_ERROR_MASK_KNOWN \
    (UINT32_C(000001) | UINT32_C(000010) | UINT32_C(000040))
#define CADR_TRACE_MAX_DEVICE_TRANSACTIONS UINT32_C(64)
#define CADR_TRACE_DEVICE_TRANSACTION_BYTES UINT32_C(44)
#define CADR_TRACE_MAX_RECORD_BYTES UINT32_C(16384)
#define CADR_TRACE_MAX_RECORDS UINT64_C(1000000)
#define CADR_TRACE_MAX_RING_RECORDS UINT32_C(1024)

/*
 * Transport changes only the retained projection.  Both modes execute the
 * same semantic chain and use the same immutable header identity.  Hash-only
 * deliberately owns no raw-record ring, so a caller never stalls merely
 * because output has not been drained.
 */
#define CADR_TRACE_TRANSPORT_FULL UINT32_C(0)
#define CADR_TRACE_TRANSPORT_HASH_ONLY UINT32_C(1)

typedef struct cadr_trace_device_transaction {
    uint32_t read_write_kind;
    /* v1 has exactly one normalized address space: CADR physical words. */
    uint32_t address_space;
    uint64_t address;
    /* `value` is the raw request (zero for a read); `result` is its response. */
    uint32_t value;
    uint32_t result;
    uint32_t status;
    /* Raw CADR bus-interface u16 latches, carried in u32 containers. */
    uint32_t interrupt_before;
    uint32_t interrupt_after;
    uint32_t error_before;
    uint32_t error_after;
} cadr_trace_device_transaction;

typedef struct cadr_trace_engine_config {
    uint64_t first_boundary;
    uint64_t selector_mask;
    uint64_t event_mask;
    uint32_t ring_record_capacity;
    uint32_t transport_mode;
    uint32_t reserved0;
    uint8_t profile_sha256[CADR_SHA256_BYTES];
    uint8_t artifact_set_sha256[CADR_SHA256_BYTES];
    uint8_t input_schedule_sha256[CADR_SHA256_BYTES];
} cadr_trace_engine_config;

typedef struct cadr_trace_slot_events {
    uint32_t clock_present;
    uint32_t interrupt_present;
    uint32_t fault_present;
    uint32_t halt_present;
    uint32_t reserved0;
    uint64_t tick_before;
    uint64_t tick_after;
    uint64_t clock_decision;
    uint32_t interrupt_before;
    uint32_t interrupt_after;
    uint32_t interrupt_level;
    uint32_t interrupt_pending;
    uint32_t fault_before;
    uint32_t fault_after;
    uint32_t fault_code;
    uint32_t fault_value_valid;
    uint32_t halt_code;
} cadr_trace_slot_events;

/* Shared semantic-latch validator used by trace emission and snapshot restore. */
cadr_status cadr_trace_latches_validate(const cadr_machine_state *state);

/*
 * Start attaches one bounded, core-owned ring in FULL mode, or a semantic-only
 * engine in HASH_ONLY mode.  FULL capacity must admit one boundary plus every
 * selected slot-event class (1 + popcount(event_mask)); HASH_ONLY has no ring.
 * The masks and identity values become immutable until destroy.  The state cache
 * must already be rebuilt.
 */
cadr_status cadr_trace_engine_start(cadr_machine_state *state,
                                    const cadr_trace_engine_config *config);
void cadr_trace_engine_stop(cadr_machine_state *state);
int cadr_trace_engine_active(const cadr_machine_state *state);

/*
 * Reserve the exact record slot before the corresponding guest mutation.
 * A caller that receives NOT_READY must make no guest-visible mutation and may
 * drain then retry.  `record_*` consumes the matching reservation atomically.
 */
cadr_status cadr_trace_engine_slot_preflight(cadr_machine_state *state);
cadr_status cadr_trace_engine_preflight_event(cadr_machine_state *state,
                                               uint64_t event_class);
cadr_status cadr_trace_engine_stage_device_transaction(
    cadr_machine_state *state, const cadr_trace_device_transaction *transaction);
cadr_status cadr_trace_engine_slot_close(cadr_machine_state *state,
                                         const cadr_trace_slot_events *events);
cadr_status cadr_trace_engine_slot_abort(cadr_machine_state *state);

/* Called after a preflighted state transition, at the instruction boundary. */
cadr_status cadr_trace_engine_record_boundary(cadr_machine_state *state,
                                              uint16_t boundary_flags);
cadr_status cadr_trace_engine_record_clock(cadr_machine_state *state,
                                           uint64_t tick_before,
                                           uint64_t tick_after,
                                           uint64_t decision);
cadr_status cadr_trace_engine_record_interrupt(cadr_machine_state *state,
                                               uint32_t before,
                                               uint32_t after,
                                               uint32_t level,
                                               uint32_t pending);
cadr_status cadr_trace_engine_record_fault(cadr_machine_state *state,
                                           uint32_t before,
                                           uint32_t after,
                                           uint32_t code,
                                           uint32_t valid);
cadr_status cadr_trace_engine_record_halt(cadr_machine_state *state,
                                          uint32_t code);
cadr_status cadr_trace_engine_record_device_request_issue(
    cadr_machine_state *state, uint32_t operation, uint32_t status,
    uint64_t generation, uint64_t request_id,
    const uint8_t descriptor_sha256[CADR_SHA256_BYTES],
    uint64_t descriptor_length, uint64_t expected_completion_length);
cadr_status cadr_trace_engine_record_device_completion(
    cadr_machine_state *state, uint32_t code, uint32_t operation,
    uint32_t result, uint32_t status, uint64_t generation, uint64_t request_id,
    const uint8_t payload_sha256[CADR_SHA256_BYTES], uint64_t payload_length);

/* Terminal finalization advances neither the semantic chain nor guest state. */
cadr_status cadr_trace_engine_finish(cadr_machine_state *state, uint32_t reason);

/* Raw CDRGTRC1 output is drained in complete-record units only. */
cadr_status cadr_trace_engine_header(const cadr_machine_state *state,
                                     uint8_t output[256]);
cadr_status cadr_trace_engine_drain(cadr_machine_state *state,
                                    uint8_t *output, uint64_t capacity,
                                    uint64_t *written, uint64_t *records);
cadr_status cadr_trace_engine_semantic_digest(const cadr_machine_state *state,
                                              uint8_t digest[CADR_SHA256_BYTES]);
uint64_t cadr_trace_engine_record_count(const cadr_machine_state *state);

/* Narrow test seam, absent from normal core builds and the public ABI. */
#ifdef CADR_TRACE_ENGINE_TESTING
void cadr_trace_engine_test_sha256(const uint8_t *bytes, uint64_t count,
                                   uint8_t digest[CADR_SHA256_BYTES]);
cadr_status cadr_trace_engine_test_set_record_count(cadr_machine_state *state,
                                                     uint64_t record_count);
#endif

#endif

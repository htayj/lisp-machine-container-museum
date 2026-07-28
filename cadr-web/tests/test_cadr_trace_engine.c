#define CADR_STATE_V2_TESTING 1
#define CADR_TRACE_ENGINE_TESTING 1
#include "cadr_trace_engine.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static uint16_t get16(const uint8_t *bytes)
{
    return (uint16_t)((uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8U));
}

static uint32_t get32(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
        ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t get64(const uint8_t *bytes)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) value |= (uint64_t)bytes[index] << (index * 8U);
    return value;
}

typedef void (*sha256_function)(const uint8_t *bytes, uint64_t count,
                                uint8_t digest[CADR_SHA256_BYTES]);

static void check_sha256_vectors(const sha256_function function)
{
    static const uint8_t empty_digest[CADR_SHA256_BYTES] = {
        0xe3U, 0xb0U, 0xc4U, 0x42U, 0x98U, 0xfcU, 0x1cU, 0x14U,
        0x9aU, 0xfbU, 0xf4U, 0xc8U, 0x99U, 0x6fU, 0xb9U, 0x24U,
        0x27U, 0xaeU, 0x41U, 0xe4U, 0x64U, 0x9bU, 0x93U, 0x4cU,
        0xa4U, 0x95U, 0x99U, 0x1bU, 0x78U, 0x52U, 0xb8U, 0x55U
    };
    static const uint8_t abc_digest[CADR_SHA256_BYTES] = {
        0xbaU, 0x78U, 0x16U, 0xbfU, 0x8fU, 0x01U, 0xcfU, 0xeaU,
        0x41U, 0x41U, 0x40U, 0xdeU, 0x5dU, 0xaeU, 0x22U, 0x23U,
        0xb0U, 0x03U, 0x61U, 0xa3U, 0x96U, 0x17U, 0x7aU, 0x9cU,
        0xb4U, 0x10U, 0xffU, 0x61U, 0xf2U, 0x00U, 0x15U, 0xadU
    };
    static const uint8_t multi_digest[CADR_SHA256_BYTES] = {
        0x24U, 0x8dU, 0x6aU, 0x61U, 0xd2U, 0x06U, 0x38U, 0xb8U,
        0xe5U, 0xc0U, 0x26U, 0x93U, 0x0cU, 0x3eU, 0x60U, 0x39U,
        0xa3U, 0x3cU, 0xe4U, 0x59U, 0x64U, 0xffU, 0x21U, 0x67U,
        0xf6U, 0xecU, 0xedU, 0xd4U, 0x19U, 0xdbU, 0x06U, 0xc1U
    };
    static const uint8_t abc[] = "abc";
    static const uint8_t multi[] =
        "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq";
    uint8_t actual[CADR_SHA256_BYTES];
    function(NULL, 0U, actual);
    CHECK(memcmp(actual, empty_digest, sizeof(actual)) == 0);
    function(abc, sizeof(abc) - 1U, actual);
    CHECK(memcmp(actual, abc_digest, sizeof(actual)) == 0);
    function(multi, sizeof(multi) - 1U, actual);
    CHECK(memcmp(actual, multi_digest, sizeof(actual)) == 0);
}

static void test_sha256_known_answers(void)
{
    check_sha256_vectors(cadr_state_v2_test_sha256);
    check_sha256_vectors(cadr_trace_engine_test_sha256);
}

static cadr_machine_state *new_state(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    if (state == NULL) return NULL;
    state->memory.main_memory_pages = 1U;
    state->memory.mapped_words = CADR_MAIN_MEMORY_WORDS_PER_PAGE;
    state->events.generation = UINT64_C(1);
    state->events.next_request_id = UINT64_C(1);
    if (cadr_state_v2_rebuild(state) != CADR_STATUS_OK) {
        free(state);
        return NULL;
    }
    return state;
}

static void destroy_state(cadr_machine_state *state)
{
    if (state == NULL) return;
    cadr_trace_engine_stop(state);
    free(state);
}

static cadr_trace_engine_config trace_config(uint32_t transport,
                                             uint32_t capacity,
                                             uint64_t selectors,
                                             uint64_t events)
{
    cadr_trace_engine_config config;
    uint32_t index;
    (void)memset(&config, 0, sizeof(config));
    config.transport_mode = transport;
    config.ring_record_capacity = capacity;
    config.selector_mask = selectors;
    config.event_mask = events;
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        config.profile_sha256[index] = (uint8_t)(UINT8_C(0x10) + index);
        config.artifact_set_sha256[index] = (uint8_t)(UINT8_C(0x40) + index);
        config.input_schedule_sha256[index] = (uint8_t)(UINT8_C(0x70) + index);
    }
    return config;
}

static void set_complete_latches(cadr_machine_state *state)
{
    cadr_trace_state *trace = &state->trace;
    trace->valid_mask = CADR_TRACE_LATCH_VALID_PIPELINE |
        CADR_TRACE_LATCH_VALID_DECODED_WORD |
        CADR_TRACE_LATCH_VALID_A_SOURCE |
        CADR_TRACE_LATCH_VALID_M_SOURCE |
        CADR_TRACE_LATCH_VALID_DESTINATION |
        CADR_TRACE_LATCH_VALID_Q |
        CADR_TRACE_LATCH_VALID_VMA |
        CADR_TRACE_LATCH_VALID_MD |
        CADR_TRACE_LATCH_VALID_MACRO_PC |
        CADR_TRACE_LATCH_VALID_FAULT |
        CADR_TRACE_LATCH_VALID_INTERRUPT |
        CADR_TRACE_LATCH_VALID_CLASS_OUTCOME;
    trace->pre_p0_pc = 1U; trace->pre_p1_pc = 2U;
    trace->pre_next_micro_pc = 3U; trace->pre_opc = 4U;
    trace->post_p0_pc = 2U; trace->post_p1_pc = 3U;
    trace->post_next_micro_pc = 4U; trace->post_opc = 1U;
    trace->raw_fetched_word = UINT64_C(0x1234);
    trace->effective_word = UINT64_C(0x5678);
    trace->a_address = 17U; trace->a_value = UINT32_C(0x11111111);
    trace->m_source_kind = 0U; trace->m_address = 3U;
    trace->m_value = UINT32_C(0x22222222);
    trace->destination_kind = 1U; trace->destination_address = 4U;
    trace->post_destination_value = UINT32_C(0x33333333);
    trace->pre_q = 1U; trace->post_q = 2U;
    trace->pre_vma = 3U; trace->post_vma = 4U;
    trace->pre_md = 5U; trace->post_md = 6U; trace->md_delayed_phase = 0U;
    trace->pre_macro_pc = 7U; trace->post_macro_pc = 8U;
    trace->pre_fault = 0U; trace->post_fault = 0U; trace->fault_code = 0U;
    trace->pre_interrupt_status = 0U; trace->post_interrupt_status = 0U;
    trace->interrupt_level = 0U; trace->post_interrupt_pending = 0U;
    trace->class_outcome = 1U;
}

static void test_initial_record_and_preflight_backpressure(void)
{
    cadr_machine_state *state = new_state();
    cadr_trace_engine_config config;
    cadr_trace_slot_events events;
    uint8_t header[256];
    uint8_t output[CADR_TRACE_MAX_RECORD_BYTES];
    uint8_t before[CADR_SHA256_BYTES];
    uint8_t after[CADR_SHA256_BYTES];
    uint64_t written;
    uint64_t records;
    if (state == NULL) {
        CHECK(0);
        return;
    }
    config = trace_config(CADR_TRACE_TRANSPORT_FULL, 1U, 0U, 0U);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_count(state) == 1U);
    CHECK(cadr_trace_engine_header(state, header) == CADR_STATUS_OK);
    CHECK(get64(header + 24U) == UINT64_MAX);
    CHECK(cadr_trace_engine_drain(state, output, sizeof(output), &written, &records) ==
          CADR_STATUS_OK);
    CHECK(records == 1U);
    CHECK(written == get32(output));
    CHECK(get16(output + 4U) == 4U);
    CHECK(get16(output + 6U) == 0U);
    CHECK(get64(output + 8U) == 0U);
    CHECK(get64(output + 16U) == 0U);
    CHECK(get64(output + 24U) == 0U);
    CHECK(get64(output + 32U) == 0U);
    CHECK(get32(output + 40U) == 0U);
    CHECK(get16(output + 48U) == 100U);
    CHECK(memcmp(output + 56U, header + 112U, CADR_SHA256_BYTES) == 0);

    /* Refill the one-slot ring with the initial record, then prove preflight is
     * non-mutating when no slot is available. */
    cadr_trace_engine_stop(state);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(state, before) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_NOT_READY);
    CHECK(cadr_state_v2_digest(state, after) == CADR_STATUS_OK);
    CHECK(memcmp(before, after, CADR_SHA256_BYTES) == 0);
    CHECK(state->clock_slots_completed == 0U);
    CHECK(cadr_trace_engine_drain(state, output, sizeof(output), &written, &records) ==
          CADR_STATUS_OK);
    CHECK(records == 1U);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    state->clock_slots_completed = 1U;
    state->cpu.microinstructions_executed = 1U;
    CHECK(cadr_trace_engine_record_boundary(state, CADR_TRACE_BOUNDARY_EXECUTED) ==
          CADR_STATUS_OK);
    (void)memset(&events, 0, sizeof(events));
    CHECK(cadr_trace_engine_slot_close(state, &events) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_drain(state, output, sizeof(output), &written, &records) ==
          CADR_STATUS_OK);
    CHECK(records == 1U && get16(output + 4U) == 1U);
    CHECK(cadr_trace_engine_finish(state, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_header(state, header) == CADR_STATUS_OK);
    CHECK(get64(header + 24U) == 3U);
    destroy_state(state);
}

static void record_equivalent_trace(cadr_machine_state *state,
                                    cadr_trace_engine_config *config)
{
    cadr_trace_device_transaction transaction;
    cadr_trace_slot_events events;
    uint8_t descriptor_digest[CADR_SHA256_BYTES];
    uint8_t completion_digest[CADR_SHA256_BYTES];
    uint32_t index;
    CHECK(cadr_trace_engine_start(state, config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    (void)memset(&transaction, 0, sizeof(transaction));
    transaction.read_write_kind = CADR_TRACE_TRANSACTION_READ;
    transaction.address_space = CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD;
    transaction.address = UINT32_C(0400);
    transaction.status = CADR_STATUS_OK;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_OK);
    state->clock_slots_completed = 1U;
    state->cpu.microinstructions_executed = 1U;
    set_complete_latches(state);
    CHECK(cadr_trace_engine_record_boundary(state, CADR_TRACE_BOUNDARY_EXECUTED) ==
          CADR_STATUS_OK);
    (void)memset(&events, 0, sizeof(events));
    events.clock_present = 1U;
    events.tick_before = 0U;
    events.tick_after = 1U;
    events.clock_decision = 1U;
    state->bus.guest_tick = 1U;
    CHECK(cadr_trace_engine_slot_close(state, &events) == CADR_STATUS_OK);
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        descriptor_digest[index] = (uint8_t)(UINT8_C(0xa0) + index);
        completion_digest[index] = (uint8_t)(UINT8_C(0xc0) + index);
    }
    CHECK(cadr_trace_engine_preflight_event(state, CADR_TRACE_EVENT_DEVICE) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_device_request_issue(
              state, CADR_HOST_OPERATION_BLOCK_READ, CADR_STATUS_OK, 1U, 1U,
              descriptor_digest, UINT64_MAX, UINT64_MAX - UINT64_C(1)) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_preflight_event(state, CADR_TRACE_EVENT_DEVICE) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_device_completion(
              state, 2U, CADR_HOST_OPERATION_BLOCK_READ, CADR_HOST_RESULT_OK,
              CADR_STATUS_OK, 1U, 1U, completion_digest, UINT64_MAX) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_finish(state, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_OK);
}

static void test_full_and_hash_only_agree(void)
{
    cadr_machine_state *full = new_state();
    cadr_machine_state *hash_only = new_state();
    cadr_trace_engine_config full_config;
    cadr_trace_engine_config hash_config;
    uint8_t full_digest[CADR_SHA256_BYTES];
    uint8_t hash_digest[CADR_SHA256_BYTES];
    uint8_t *output;
    uint64_t written;
    uint64_t records;
    uint32_t offset = 0U;
    static const uint16_t kinds[] = { 4U, 1U, 2U, 2U, 2U, 2U, 3U };
    uint32_t index;
    if (full == NULL || hash_only == NULL) {
        CHECK(0);
        destroy_state(full);
        destroy_state(hash_only);
        return;
    }
    full_config = trace_config(CADR_TRACE_TRANSPORT_FULL, 8U,
                               CADR_TRACE_SELECTOR_KNOWN,
                               CADR_TRACE_EVENT_CLOCK | CADR_TRACE_EVENT_DEVICE);
    hash_config = full_config;
    hash_config.transport_mode = CADR_TRACE_TRANSPORT_HASH_ONLY;
    hash_config.ring_record_capacity = 0U;
    record_equivalent_trace(full, &full_config);
    record_equivalent_trace(hash_only, &hash_config);
    CHECK(cadr_trace_engine_semantic_digest(full, full_digest) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_semantic_digest(hash_only, hash_digest) == CADR_STATUS_OK);
    CHECK(memcmp(full_digest, hash_digest, CADR_SHA256_BYTES) == 0);
    CHECK(cadr_trace_engine_record_count(full) == 7U);
    CHECK(cadr_trace_engine_record_count(hash_only) == 7U);
    CHECK(cadr_trace_engine_drain(hash_only, NULL, 0U, &written, &records) ==
          CADR_STATUS_OK);
    CHECK(written == 0U && records == 0U);

    output = malloc((size_t)CADR_TRACE_MAX_RECORD_BYTES * 8U);
    CHECK(output != NULL);
    if (output != NULL) {
        CHECK(cadr_trace_engine_drain(full, output,
                                      (uint64_t)CADR_TRACE_MAX_RECORD_BYTES * 8U,
                                      &written, &records) == CADR_STATUS_OK);
        CHECK(records == 7U);
        for (index = 0U; index < 7U && offset < written; ++index) {
            const uint32_t length = get32(output + offset);
            CHECK(length != 0U && length <= written - offset);
            CHECK(get16(output + offset + 4U) == kinds[index]);
            CHECK(get64(output + offset + 8U) == index);
            offset += length;
        }
        CHECK(offset == written);
        free(output);
    }
    destroy_state(full);
    destroy_state(hash_only);
}

static void test_latch_and_transaction_domains(void)
{
    cadr_machine_state *state = new_state();
    cadr_trace_device_transaction transaction;
    if (state == NULL) {
        CHECK(0);
        return;
    }
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_OK);
    state->trace.raw_fetched_word = UINT64_C(1) << 48U;
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.raw_fetched_word = 0U;
    state->trace.pre_p0_pc = UINT32_C(0x4000);
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.pre_p0_pc = 0U;
    state->trace.a_address = UINT32_C(1024);
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.a_address = 0U;
    state->trace.m_address = 1U;
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.m_address = 0U;
    state->trace.destination_address = 1U;
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.destination_address = 0U;
    state->trace.valid_mask = CADR_TRACE_LATCH_VALID_CLASS_OUTCOME;
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.class_outcome = 1U;
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_OK);
    state->trace.valid_mask = 0U;
    state->trace.class_outcome = 0U;
    state->trace.post_interrupt_status = UINT32_C(0140260);
    state->trace.post_interrupt_pending = 1U;
    state->trace.interrupt_level = UINT32_C(0260);
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_OK);
    state->trace.interrupt_level = 0U;
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.post_interrupt_status = 0U;
    state->trace.post_interrupt_pending = 0U;
    state->trace.reserved0 = 1U;
    CHECK(cadr_trace_latches_validate(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->trace.reserved0 = 0U;

    (void)memset(&transaction, 0, sizeof(transaction));
    transaction.read_write_kind = CADR_TRACE_TRANSACTION_READ;
    transaction.address_space = CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD;
    transaction.status = CADR_STATUS_OK;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_OK);
    transaction.read_write_kind = 2U;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    transaction.read_write_kind = CADR_TRACE_TRANSACTION_READ;
    transaction.address_space = 2U;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    transaction.address_space = CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD;
    transaction.address = UINT32_C(020000000);
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    transaction.address = 0U; transaction.value = 1U;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    transaction.value = 0U; transaction.read_write_kind = CADR_TRACE_TRANSACTION_WRITE;
    transaction.result = 1U;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    transaction.result = 0U; transaction.status = CADR_STATUS_HOST_FAILURE;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    transaction.status = CADR_STATUS_OK; transaction.interrupt_after = UINT32_C(0x10000);
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    transaction.interrupt_after = 0U; transaction.error_after = UINT32_C(0100);
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_INVALID_ARGUMENT);
    destroy_state(state);
}

static void test_record_limit_reserves_terminal(void)
{
    cadr_machine_state *state = new_state();
    cadr_trace_engine_config config;
    cadr_trace_device_transaction transaction;
    cadr_trace_slot_events events;
    if (state == NULL) {
        CHECK(0);
        return;
    }
    config = trace_config(CADR_TRACE_TRANSPORT_HASH_ONLY, 0U, 0U,
                          CADR_TRACE_EVENT_DEVICE);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_test_set_record_count(
              state, CADR_TRACE_MAX_RECORDS - UINT64_C(3)) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    (void)memset(&transaction, 0, sizeof(transaction));
    transaction.read_write_kind = CADR_TRACE_TRANSACTION_READ;
    transaction.address_space = CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD;
    transaction.status = CADR_STATUS_OK;
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_OK);
    state->clock_slots_completed = 1U;
    state->cpu.microinstructions_executed = 1U;
    set_complete_latches(state);
    CHECK(cadr_trace_engine_record_boundary(state, CADR_TRACE_BOUNDARY_EXECUTED) ==
          CADR_STATUS_OK);
    (void)memset(&events, 0, sizeof(events));
    CHECK(cadr_trace_engine_slot_close(state, &events) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_count(state) ==
          CADR_TRACE_MAX_RECORDS - UINT64_C(1));
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_NOT_READY);
    CHECK(cadr_trace_engine_finish(state, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_count(state) == CADR_TRACE_MAX_RECORDS);
    destroy_state(state);
}

static void test_halt_event_ordering(void)
{
    cadr_machine_state *state = new_state();
    cadr_trace_engine_config config;
    cadr_trace_slot_events events;
    if (state == NULL) {
        CHECK(0);
        return;
    }
    config = trace_config(CADR_TRACE_TRANSPORT_HASH_ONLY, 0U, 0U,
                          CADR_TRACE_EVENT_HALT);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_preflight_event(state, CADR_TRACE_EVENT_HALT) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    state->clock_slots_completed = 1U;
    state->cpu.microinstructions_executed = 1U;
    CHECK(cadr_trace_engine_record_boundary(state,
                                            CADR_TRACE_BOUNDARY_EXECUTED |
                                            CADR_TRACE_BOUNDARY_HALT) ==
          CADR_STATUS_OK);
    (void)memset(&events, 0, sizeof(events));
    events.halt_present = 1U;
    events.halt_code = CADR_STATUS_HALTED;
    CHECK(cadr_trace_engine_slot_close(state, &events) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_preflight_event(state, CADR_TRACE_EVENT_HALT) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_trace_engine_finish(state, CADR_TRACE_REASON_COMPLETE_HALT) ==
          CADR_STATUS_OK);
    destroy_state(state);
}

static void test_compound_slot_lifecycle(void)
{
    cadr_machine_state *state = new_state();
    cadr_trace_engine_config config;
    cadr_trace_slot_events events;
    if (state == NULL) {
        CHECK(0);
        return;
    }
    config = trace_config(CADR_TRACE_TRANSPORT_HASH_ONLY, 0U, 0U,
                          CADR_TRACE_EVENT_KNOWN);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_preflight_event(state, CADR_TRACE_EVENT_DEVICE) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_trace_engine_finish(state, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_NOT_READY);
    CHECK(cadr_trace_engine_slot_abort(state) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    state->clock_slots_completed = 1U;
    state->cpu.microinstructions_executed = 1U;
    set_complete_latches(state);
    CHECK(cadr_trace_engine_record_boundary(state, CADR_TRACE_BOUNDARY_EXECUTED) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_abort(state) == CADR_STATUS_INVALID_ARGUMENT);
    (void)memset(&events, 0, sizeof(events));
    CHECK(cadr_trace_engine_slot_close(state, &events) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_count(state) == 2U);
    CHECK(cadr_trace_engine_finish(state, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_count(state) == 3U);
    destroy_state(state);
}

static void test_compound_ring_capacity_and_transaction_ceiling(void)
{
    cadr_machine_state *state = new_state();
    cadr_trace_engine_config config;
    cadr_trace_device_transaction transaction;
    cadr_trace_slot_events events;
    uint8_t output[CADR_TRACE_MAX_RECORD_BYTES];
    uint64_t written;
    uint64_t records;
    uint32_t index;
    if (state == NULL) {
        CHECK(0);
        return;
    }
    config = trace_config(CADR_TRACE_TRANSPORT_FULL, 5U, 0U,
                          CADR_TRACE_EVENT_KNOWN);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_INVALID_ARGUMENT);

    config = trace_config(CADR_TRACE_TRANSPORT_FULL, 6U, 0U,
                          CADR_TRACE_EVENT_KNOWN);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_NOT_READY);
    CHECK(cadr_trace_engine_drain(state, output, sizeof(output), &written, &records) ==
          CADR_STATUS_OK);
    CHECK(records == 1U);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_abort(state) == CADR_STATUS_OK);
    cadr_trace_engine_stop(state);

    config = trace_config(CADR_TRACE_TRANSPORT_HASH_ONLY, 0U,
                          CADR_TRACE_SELECTOR_DEVICE_TRANSACTION,
                          CADR_TRACE_EVENT_DEVICE);
    CHECK(cadr_trace_engine_start(state, &config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(state) == CADR_STATUS_OK);
    (void)memset(&transaction, 0, sizeof(transaction));
    transaction.read_write_kind = CADR_TRACE_TRANSACTION_READ;
    transaction.address_space = CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD;
    transaction.status = CADR_STATUS_OK;
    for (index = 0U; index < CADR_TRACE_MAX_DEVICE_TRANSACTIONS; ++index) {
        transaction.address = index;
        CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
              CADR_STATUS_OK);
    }
    CHECK(cadr_trace_engine_stage_device_transaction(state, &transaction) ==
          CADR_STATUS_GUEST_FAULT);
    CHECK(cadr_trace_engine_slot_abort(state) == CADR_STATUS_INVALID_ARGUMENT);
    state->clock_slots_completed = 1U;
    state->cpu.microinstructions_executed = 1U;
    CHECK(cadr_trace_engine_record_boundary(state, CADR_TRACE_BOUNDARY_EXECUTED) ==
          CADR_STATUS_OK);
    (void)memset(&events, 0, sizeof(events));
    CHECK(cadr_trace_engine_slot_close(state, &events) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_count(state) == 3U);
    CHECK(cadr_trace_engine_finish(state, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_OK);
    destroy_state(state);
}

static void test_finished_trace_is_terminal_and_transport_equivalent(void)
{
    cadr_machine_state *full = new_state();
    cadr_machine_state *hash_only = new_state();
    cadr_trace_engine_config full_config;
    cadr_trace_engine_config hash_config;
    cadr_trace_slot_events events;
    uint8_t full_state_before[CADR_SHA256_BYTES];
    uint8_t full_state_after[CADR_SHA256_BYTES];
    uint8_t hash_state_before[CADR_SHA256_BYTES];
    uint8_t hash_state_after[CADR_SHA256_BYTES];
    uint8_t full_digest_before[CADR_SHA256_BYTES];
    uint8_t full_digest_after[CADR_SHA256_BYTES];
    uint8_t hash_digest_before[CADR_SHA256_BYTES];
    uint8_t hash_digest_after[CADR_SHA256_BYTES];
    uint8_t output[CADR_TRACE_MAX_RECORD_BYTES * 3U];
    uint64_t written;
    uint64_t records;
    uint64_t full_count;
    uint64_t hash_count;
    if (full == NULL || hash_only == NULL) {
        CHECK(0);
        destroy_state(full);
        destroy_state(hash_only);
        return;
    }
    full_config = trace_config(CADR_TRACE_TRANSPORT_FULL, 3U, 0U,
                               CADR_TRACE_EVENT_DEVICE);
    hash_config = trace_config(CADR_TRACE_TRANSPORT_HASH_ONLY, 0U, 0U,
                               CADR_TRACE_EVENT_DEVICE);
    CHECK(cadr_trace_engine_start(full, &full_config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_start(hash_only, &hash_config) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(full) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_preflight(hash_only) == CADR_STATUS_OK);
    full->clock_slots_completed = 1U;
    full->cpu.microinstructions_executed = 1U;
    hash_only->clock_slots_completed = 1U;
    hash_only->cpu.microinstructions_executed = 1U;
    set_complete_latches(full);
    set_complete_latches(hash_only);
    CHECK(cadr_trace_engine_record_boundary(full, CADR_TRACE_BOUNDARY_EXECUTED) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_boundary(hash_only,
                                            CADR_TRACE_BOUNDARY_EXECUTED) ==
          CADR_STATUS_OK);
    (void)memset(&events, 0, sizeof(events));
    CHECK(cadr_trace_engine_slot_close(full, &events) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_slot_close(hash_only, &events) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_finish(full, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_finish(hash_only, CADR_TRACE_REASON_COMPLETE_LIMIT) ==
          CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(full, full_state_before) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(hash_only, hash_state_before) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_semantic_digest(full, full_digest_before) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_semantic_digest(hash_only, hash_digest_before) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_record_count(full) == 3U);
    CHECK(cadr_trace_engine_record_count(hash_only) == 3U);
    CHECK(memcmp(full_digest_before, hash_digest_before,
                 CADR_SHA256_BYTES) == 0);

    CHECK(cadr_trace_engine_slot_preflight(full) == CADR_STATUS_NOT_READY);
    CHECK(cadr_trace_engine_slot_preflight(hash_only) == CADR_STATUS_NOT_READY);
    CHECK(cadr_trace_engine_preflight_event(full, CADR_TRACE_EVENT_DEVICE) ==
          CADR_STATUS_NOT_READY);
    CHECK(cadr_trace_engine_preflight_event(hash_only, CADR_TRACE_EVENT_DEVICE) ==
          CADR_STATUS_NOT_READY);
    CHECK(cadr_state_v2_digest(full, full_state_after) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(hash_only, hash_state_after) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_semantic_digest(full, full_digest_after) ==
          CADR_STATUS_OK);
    CHECK(cadr_trace_engine_semantic_digest(hash_only, hash_digest_after) ==
          CADR_STATUS_OK);
    full_count = cadr_trace_engine_record_count(full);
    hash_count = cadr_trace_engine_record_count(hash_only);
    CHECK(memcmp(full_state_before, full_state_after,
                 CADR_SHA256_BYTES) == 0);
    CHECK(memcmp(hash_state_before, hash_state_after,
                 CADR_SHA256_BYTES) == 0);
    CHECK(memcmp(full_digest_before, full_digest_after,
                 CADR_SHA256_BYTES) == 0);
    CHECK(memcmp(hash_digest_before, hash_digest_after,
                 CADR_SHA256_BYTES) == 0);
    CHECK(full_count == 3U && hash_count == 3U);

    CHECK(cadr_trace_engine_drain(full, output, sizeof(output), &written, &records) ==
          CADR_STATUS_OK);
    CHECK(records == 3U && written != 0U);
    CHECK(get16(output + get32(output) + get32(output + get32(output)) + 4U) ==
          3U);
    CHECK(cadr_trace_engine_drain(hash_only, NULL, 0U, &written, &records) ==
          CADR_STATUS_OK);
    CHECK(records == 0U && written == 0U);
    destroy_state(full);
    destroy_state(hash_only);
}

/* Used by the Python codec test: bytes come from the C producer, not a Python
 * re-encoder.  Normal test invocation never writes a fixture. */
static int emit_cross_parse_fixture(const char *path)
{
    cadr_machine_state *state = new_state();
    cadr_trace_engine_config config;
    uint8_t header[256];
    uint8_t *records;
    uint64_t written;
    uint64_t count;
    FILE *stream;
    int failed = 0;
    if (state == NULL) return 1;
    config = trace_config(CADR_TRACE_TRANSPORT_FULL, 8U,
                          CADR_TRACE_SELECTOR_KNOWN,
                          CADR_TRACE_EVENT_CLOCK | CADR_TRACE_EVENT_DEVICE);
    record_equivalent_trace(state, &config);
    records = malloc((size_t)CADR_TRACE_MAX_RECORD_BYTES * 8U);
    if (records == NULL || cadr_trace_engine_header(state, header) != CADR_STATUS_OK ||
        cadr_trace_engine_drain(state, records,
                                (uint64_t)CADR_TRACE_MAX_RECORD_BYTES * 8U,
                                &written, &count) != CADR_STATUS_OK || count != 7U) {
        free(records);
        destroy_state(state);
        return 1;
    }
    stream = fopen(path, "wb");
    if (stream == NULL) {
        failed = 1;
    } else {
        if (fwrite(header, 1U, sizeof(header), stream) != sizeof(header) ||
            fwrite(records, 1U, (size_t)written, stream) != (size_t)written) {
            failed = 1;
        }
        if (fclose(stream) != 0) failed = 1;
    }
    free(records);
    destroy_state(state);
    return failed;
}

int main(int argc, char **argv)
{
    if (argc == 3 && strcmp(argv[1], "--emit") == 0) {
        return emit_cross_parse_fixture(argv[2]);
    }
    if (argc != 1) return 2;
    test_sha256_known_answers();
    test_initial_record_and_preflight_backpressure();
    test_full_and_hash_only_agree();
    test_halt_event_ordering();
    test_compound_slot_lifecycle();
    test_compound_ring_capacity_and_transaction_ceiling();
    test_finished_trace_is_terminal_and_transport_equivalent();
    test_latch_and_transaction_domains();
    test_record_limit_reserves_terminal();
    if (failures != 0) return 1;
    (void)puts("cadr_trace_engine: ok");
    return 0;
}

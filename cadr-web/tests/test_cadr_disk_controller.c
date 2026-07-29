#include "cadr_bus_device.h"
#include "cadr_processor_memory.h"
#include "cadr_state_v2.h"
#include "cadr_state_v3.h"
#include "cadr_disk_evidence.h"

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

static cadr_machine_state *new_state(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    CHECK(state != NULL);
    if (state != NULL) {
        cadr_bus_device_cold_power_on(state);
        cadr_processor_memory_set_main_memory_pages(state, 2U);
        state->lifecycle = CADR_MACHINE_RUNNING;
        state->events.generation = 1U;
        state->events.next_request_id = 1U;
        state->events.persistent_status = CADR_STATUS_OK;
    }
    return state;
}

static void put_le32(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void test_cold_reset_and_0405(void)
{
    cadr_machine_state *state = new_state();
    uint32_t value = 0U;
    if (state == NULL) return;
    CHECK(cadr_disk_read(state, 0U, &value) == CADR_STATUS_OK);
    CHECK(value == 1U);
    state->devices.disk.status |= CADR_DISK_STATUS_FAULT |
        CADR_DISK_STATUS_SEEK_ERROR | CADR_DISK_STATUS_ATTENTION |
        CADR_DISK_STATUS_ANY_ATTENTION;
    CHECK(cadr_disk_write(state, 0U, UINT32_C(0405)) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK(state->devices.disk.status ==
          (CADR_DISK_STATUS_NOT_ACTIVE | CADR_DISK_STATUS_SEEK_ERROR));
    state->devices.disk.status = CADR_DISK_STATUS_NOT_ACTIVE |
        CADR_DISK_STATUS_FAULT | CADR_DISK_STATUS_SEEK_ERROR |
        CADR_DISK_STATUS_ATTENTION | CADR_DISK_STATUS_ANY_ATTENTION;
    /* Recalibrate retains only the three unit-select bits 28..30.  A nonzero
     * unit plus an independent cylinder distinguishes the hardware mask from
     * the old octal constant, which accidentally retained neither. */
    state->devices.disk.disk_address = UINT32_C(0x30050010);
    CHECK(cadr_disk_write(state, 0U, UINT32_C(01405)) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK(state->devices.disk.disk_address == UINT32_C(0x30000000));
    CHECK(state->devices.disk.status == (CADR_DISK_STATUS_NOT_ACTIVE |
                                         CADR_DISK_STATUS_ATTENTION |
                                         CADR_DISK_STATUS_ANY_ATTENTION));
    CHECK(cadr_disk_write(state, 0U, UINT32_C(016)) == CADR_STATUS_OK);
    CHECK(cadr_disk_read(state, 0U, &value) == CADR_STATUS_OK && value == 0U);
    CHECK(cadr_disk_write(state, 0U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_read(state, 0U, &value) == CADR_STATUS_OK && value == 1U);
    free(state);
}

static void test_status_masks_are_safe_under_complement(void)
{
    uint32_t status = CADR_DISK_STATUS_NOT_ACTIVE | CADR_DISK_STATUS_INTERRUPT |
        CADR_DISK_STATUS_ATTENTION;
    status &= ~CADR_DISK_STATUS_INTERRUPT;
    CHECK(status == (CADR_DISK_STATUS_NOT_ACTIVE | CADR_DISK_STATUS_ATTENTION));
    status &= ~CADR_DISK_STATUS_ATTENTION;
    CHECK(status == CADR_DISK_STATUS_NOT_ACTIVE);
}

static void test_ccw_read_completion_and_interrupt(void)
{
    cadr_machine_state *state = new_state();
    uint8_t block[CADR_DISK_BLOCK_BYTES];
    cadr_block_read_descriptor descriptor;
    uint32_t word = 0U;
    if (state == NULL) return;
    (void)memset(block, 0, sizeof(block));
    put_le32(block, UINT32_C(0x78563412));
    put_le32(block + 4U, UINT32_C(0xfedcba98));
    CHECK(cadr_processor_memory_main_write(state, 0U, UINT32_C(0x00000100)) ==
          CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 0U, UINT32_C(04000)) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 1U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 2U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK(state->events.outstanding_operation == CADR_HOST_OPERATION_BLOCK_READ);
    CHECK(state->events.expected_completion_byte_count == CADR_DISK_BLOCK_BYTES);
    (void)memcpy(&descriptor, state->events.request_descriptor, sizeof(descriptor));
    CHECK(descriptor.first_block == 0U);
    CHECK(descriptor.block_count == 1U);
    CHECK(descriptor.block_bytes == CADR_DISK_BLOCK_BYTES);
    CHECK(cadr_disk_apply_block_read_completion(state, CADR_HOST_RESULT_OK,
                                                block, sizeof(block)) == CADR_STATUS_OK);
    CHECK(cadr_processor_memory_main_read(state, UINT32_C(0x100), &word) ==
          CADR_STATUS_OK && word == UINT32_C(0x78563412));
    CHECK(cadr_processor_memory_main_read(state, UINT32_C(0x101), &word) ==
          CADR_STATUS_OK && word == UINT32_C(0xfedcba98));
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_NOT_ACTIVE) != 0U);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_INTERRUPT) != 0U);
    CHECK((state->bus.interrupt_status & UINT16_C(040000)) != 0U);
    free(state);
}

static void test_ccw_nxm_and_profile_delta(void)
{
    cadr_machine_state *state = new_state();
    if (state == NULL) return;
    CHECK(cadr_disk_write(state, 1U, UINT32_C(0x0010ffff)) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 2U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_NXM) != 0U);
    state->devices.disk.compatibility_profile = CADR_DISK_COMPAT_USIM_330D;
    CHECK(cadr_disk_write(state, 0U, UINT32_C(016)) == CADR_STATUS_OK);
    /* Reset preserves the explicit selected compatibility profile. */
    CHECK(state->devices.disk.compatibility_profile == CADR_DISK_COMPAT_USIM_330D);
    free(state);
}

static void test_chained_ccw_uses_chs_carry(void)
{
    cadr_machine_state *state = new_state();
    uint8_t block[CADR_DISK_BLOCK_BYTES] = {0};
    cadr_block_read_descriptor descriptor;
    if (state == NULL) return;
    CHECK(cadr_processor_memory_main_write(state, 0U, UINT32_C(0x00000101)) ==
          CADR_STATUS_OK);
    CHECK(cadr_processor_memory_main_write(state, 1U, UINT32_C(0x00000200)) ==
          CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 1U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 2U, UINT32_C(0x10)) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_apply_block_read_completion(state, CADR_HOST_RESULT_OK,
                                                block, sizeof(block)) ==
          CADR_STATUS_WAITING_FOR_HOST);
    CHECK(state->devices.disk.disk_address == UINT32_C(0x00000100));
    /* Match the core's post-dispatch clearing before it asks for CCW two. */
    state->events.outstanding_request_id = 0U;
    state->events.outstanding_operation = CADR_HOST_OPERATION_NONE;
    state->events.request_descriptor_byte_count = 0U;
    state->events.expected_completion_byte_count = 0U;
    CHECK(cadr_disk_continue(state) == CADR_STATUS_OK);
    (void)memcpy(&descriptor, state->events.request_descriptor, sizeof(descriptor));
    CHECK(descriptor.first_block == CADR_DISK_T300_BLOCKS_PER_TRACK);
    CHECK(descriptor.block_count == 1U);
    free(state);
}

static void test_block_write_copies_one_page_and_accepts_empty_completion(void)
{
    cadr_machine_state *state = new_state();
    cadr_block_write_descriptor descriptor;
    uint32_t word = 0U;
    if (state == NULL) return;
    CHECK(cadr_processor_memory_main_write(state, 0U, UINT32_C(0x00000100)) ==
          CADR_STATUS_OK);
    CHECK(cadr_processor_memory_main_write(state, UINT32_C(0x100), UINT32_C(0x78563412)) ==
          CADR_STATUS_OK);
    CHECK(cadr_processor_memory_main_write(state, UINT32_C(0x101), UINT32_C(0xfedcba98)) ==
          CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 0U, UINT32_C(011)) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 1U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 2U, 1U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK(state->events.outstanding_operation == CADR_HOST_OPERATION_BLOCK_WRITE);
    CHECK(state->events.expected_completion_byte_count == 0U);
    CHECK(state->events.request_payload_byte_count == CADR_DISK_BLOCK_BYTES);
    (void)memcpy(&descriptor, state->events.request_descriptor, sizeof(descriptor));
    CHECK(descriptor.first_block == 1U && descriptor.block_count == 1U &&
          descriptor.block_bytes == CADR_DISK_BLOCK_BYTES);
    CHECK(state->events.request_payload[0] == UINT8_C(0x12));
    CHECK(state->events.request_payload[1] == UINT8_C(0x34));
    CHECK(state->events.request_payload[4] == UINT8_C(0x98));
    CHECK(cadr_processor_memory_main_read(state, UINT32_C(0x100), &word) ==
          CADR_STATUS_OK && word == UINT32_C(0x78563412));
    CHECK(cadr_disk_apply_block_write_completion(state, CADR_HOST_RESULT_OK,
                                                 NULL, 0U) == CADR_STATUS_OK);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_NOT_ACTIVE) != 0U);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_FAULT) == 0U);
    free(state);
}

static void test_offline_and_end_of_media_are_distinct(void)
{
    cadr_machine_state *state = new_state();
    uint8_t block[CADR_DISK_BLOCK_BYTES] = {0};
    const uint32_t final_address =
        ((CADR_DISK_T300_CYLINDERS - 1U) << 16U) |
        ((CADR_DISK_T300_HEADS - 1U) << 8U) |
        (CADR_DISK_T300_BLOCKS_PER_TRACK - 1U);
    if (state == NULL) return;

    CHECK(cadr_disk_write(state, 1U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 2U, UINT32_C(0x10000000)) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_OFFLINE) != 0U);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_SEEK_ERROR) == 0U);
    CHECK(state->events.outstanding_operation == CADR_HOST_OPERATION_NONE);

    free(state);
    state = new_state();
    if (state == NULL) return;
    CHECK(cadr_processor_memory_main_write(state, 0U, UINT32_C(0x00000101)) ==
          CADR_STATUS_OK);
    CHECK(cadr_processor_memory_main_write(state, 1U, UINT32_C(0x00000200)) ==
          CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 1U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 2U, final_address) == CADR_STATUS_OK);
    CHECK(cadr_disk_write(state, 3U, 0U) == CADR_STATUS_OK);
    CHECK(state->events.next_request_id == 2U);
    CHECK(cadr_disk_apply_block_read_completion(state, CADR_HOST_RESULT_OK,
                                                block, sizeof(block)) ==
          CADR_STATUS_OK);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_SEEK_ERROR) != 0U);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_OFFLINE) == 0U);
    CHECK((state->devices.disk.status & CADR_DISK_STATUS_NOT_ACTIVE) != 0U);
    CHECK(state->devices.disk.transfer_active == 0U);
    CHECK(state->events.next_request_id == 2U);
    free(state);
}

static void test_state_v3_includes_disk_only_state(void)
{
    cadr_machine_state *state = new_state();
    static const uint8_t default_vector[CADR_SHA256_BYTES] = {
        UINT8_C(0x79), UINT8_C(0xdf), UINT8_C(0xe5), UINT8_C(0x3c),
        UINT8_C(0x69), UINT8_C(0x5b), UINT8_C(0x89), UINT8_C(0x9a),
        UINT8_C(0x1b), UINT8_C(0xaf), UINT8_C(0xbd), UINT8_C(0x87),
        UINT8_C(0xec), UINT8_C(0x1c), UINT8_C(0x4c), UINT8_C(0xec),
        UINT8_C(0x42), UINT8_C(0xcf), UINT8_C(0x73), UINT8_C(0xe1),
        UINT8_C(0xc7), UINT8_C(0xb8), UINT8_C(0x23), UINT8_C(0x95),
        UINT8_C(0xe9), UINT8_C(0x2e), UINT8_C(0x0a), UINT8_C(0x28),
        UINT8_C(0x4e), UINT8_C(0x0d), UINT8_C(0x85), UINT8_C(0xf4)
    };
    uint8_t first[CADR_SHA256_BYTES];
    uint8_t second[CADR_SHA256_BYTES];
    if (state == NULL) return;
    CHECK(cadr_state_v2_rebuild(state) == CADR_STATUS_OK);
    CHECK(cadr_state_v3_digest(state, first) == CADR_STATUS_OK);
    CHECK(memcmp(first, default_vector, sizeof(first)) == 0);
    state->devices.disk.command_list_pointer = UINT32_C(0123456);
    CHECK(cadr_state_v3_digest(state, second) == CADR_STATUS_OK);
    CHECK(memcmp(first, second, sizeof(first)) != 0);
    free(state);
}

static void test_disk_evidence_wire_bounds_and_reset_history(void)
{
    cadr_machine_state *state = new_state();
    uint8_t bytes[CADR_DISK_EVIDENCE_HEADER_BYTES + CADR_DISK_EVIDENCE_RECORD_BYTES + 16U];
    uint64_t written = UINT64_MAX;
    uint32_t before;
    if (state == NULL) return;
    CHECK(cadr_disk_evidence_record(&state->disk_evidence,
                                    CADR_DISK_EVIDENCE_REGISTER_WRITE, 0U,
                                    1U, 2U, 3U, 4U, NULL, 0U) == CADR_STATUS_OK);
    (void)memset(bytes, UINT8_C(0xa5), sizeof(bytes));
    CHECK(cadr_disk_evidence_serialize(&state->disk_evidence, bytes,
                                       CADR_DISK_EVIDENCE_HEADER_BYTES + CADR_DISK_EVIDENCE_RECORD_BYTES,
                                       &written) == CADR_STATUS_OK);
    CHECK(written == CADR_DISK_EVIDENCE_HEADER_BYTES + CADR_DISK_EVIDENCE_RECORD_BYTES);
    CHECK(bytes[written] == UINT8_C(0xa5));
    CHECK(bytes[written + 15U] == UINT8_C(0xa5));
    written = UINT64_MAX;
    CHECK(cadr_disk_evidence_serialize(&state->disk_evidence, bytes,
                                       CADR_DISK_EVIDENCE_HEADER_BYTES + CADR_DISK_EVIDENCE_RECORD_BYTES - 1U,
                                       &written) == CADR_STATUS_WRONG_LENGTH);
    CHECK(written == 0U);
    before = state->disk_evidence.count;
    CHECK(cadr_disk_write(state, 0U, UINT32_C(016)) == CADR_STATUS_OK);
    CHECK(state->disk_evidence.count > before);
    state->disk_evidence.count = CADR_DISK_EVIDENCE_CAPACITY;
    state->disk_evidence.overflowed = 0U;
    CHECK(cadr_disk_evidence_record(&state->disk_evidence,
                                    CADR_DISK_EVIDENCE_STATE, 0U, 0U, 0U,
                                    0U, 0U, NULL, 0U) == CADR_STATUS_GUEST_FAULT);
    CHECK(cadr_disk_evidence_serialize(&state->disk_evidence, bytes,
                                       sizeof(bytes), &written) == CADR_STATUS_NOT_READY);
    CHECK(cadr_disk_write(state, 0U, 0U) == CADR_STATUS_GUEST_FAULT);
    free(state);
}

int main(void)
{
    test_cold_reset_and_0405();
    test_status_masks_are_safe_under_complement();
    test_ccw_read_completion_and_interrupt();
    test_ccw_nxm_and_profile_delta();
    test_chained_ccw_uses_chs_carry();
    test_block_write_copies_one_page_and_accepts_empty_completion();
    test_offline_and_end_of_media_are_distinct();
    test_state_v3_includes_disk_only_state();
    test_disk_evidence_wire_bounds_and_reset_history();
    if (failures != 0) return 1;
    (void)puts("cadr_disk_controller: ok");
    return 0;
}

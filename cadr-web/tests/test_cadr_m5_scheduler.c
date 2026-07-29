#include "cadr_bus_device.h"
#include "cadr_boundary_state.h"
#include "cadr_machine.h"
#include "cadr_m4_media.h"
#include "cadr_state_v2.h"

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

static cadr_machine *running_machine(void)
{
    static const uint8_t empty_mutation_sha256[CADR_SHA256_BYTES] = {
        0xd2U,0xb2U,0x1aU,0x8fU,0xbbU,0xb3U,0x1eU,0xa2U,
        0xdaU,0x26U,0xe9U,0x43U,0x97U,0x86U,0x5bU,0x79U,
        0xa2U,0x2fU,0x06U,0x20U,0xa2U,0xedU,0x2dU,0xc9U,
        0xeeU,0x50U,0x92U,0x4dU,0x4aU,0xe2U,0x1eU,0x86U
    };
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_machine_config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine != NULL) {
        machine->state.lifecycle = CADR_MACHINE_RUNNING;
        machine->state.scheduler.phase = CADR_SCHEDULER_PHASE_BOUNDARY_READY;
        machine->state.scheduler.hidden_policy = CADR_SCHEDULER_HIDDEN_PAUSE;
        machine->state.devices.initialized = 1U;
        machine->state.devices.disk.compatibility_profile = CADR_DISK_COMPAT_SYSTEM_303;
        machine->state.devices.disk.status = CADR_DISK_STATUS_NOT_ACTIVE;
        CHECK(cadr_canonical_rebuild(&machine->state) == CADR_STATUS_OK);
        (void)memcpy(machine->state.canonical.mutation_sha256, empty_mutation_sha256,
                     sizeof(empty_mutation_sha256));
        machine->state.canonical.initialized = 1U;
        CHECK(cadr_state_v2_rebuild(&machine->state) == CADR_STATUS_OK);
    }
    return machine;
}

static cadr_scheduler_event event(uint32_t kind, uint32_t value)
{
    cadr_scheduler_event result;
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M5;
    result.struct_size = (uint32_t)sizeof(result);
    result.kind = kind;
    result.generation = UINT64_C(1);
    result.value = value;
    return result;
}

static void test_iob_fifo_registers_and_interrupt(void)
{
    cadr_machine *machine = running_machine();
    uint16_t value = 0U;
    uint32_t index;
    if (machine == NULL) return;
    cadr_bus_set_interrupt_status(&machine->state, UINT16_C(02000));
    CHECK(cadr_iob_write(&machine->state, 0764112U, UINT16_C(4)) == CADR_STATUS_OK);
    CHECK(cadr_iob_keyboard_event(&machine->state, UINT16_C(0123)) == CADR_STATUS_OK);
    CHECK((machine->state.devices.iob.csr & UINT32_C(040)) != 0U);
    CHECK((machine->state.bus.interrupt_status & UINT16_C(01774)) == UINT16_C(0260));
    for (index = 0U; index < CADR_IOB_KEY_QUEUE_LEN; ++index) {
        CHECK(cadr_iob_keyboard_event(&machine->state, (uint16_t)(index + 1U)) ==
              CADR_STATUS_OK);
    }
    CHECK(cadr_iob_keyboard_event(&machine->state, UINT16_C(0777)) ==
          CADR_STATUS_QUEUE_FULL);
    CHECK(cadr_iob_read(&machine->state, 0764100U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0123));
    CHECK((machine->state.devices.iob.csr & UINT32_C(040)) == 0U);
    CHECK(cadr_iob_clock_tick(&machine->state, 1U) == CADR_STATUS_OK);
    CHECK(cadr_iob_device_service(&machine->state) == CADR_STATUS_OK);
    CHECK(cadr_iob_read(&machine->state, 0764100U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(1));
    CHECK(cadr_iob_read(&machine->state, 0764124U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(1));
    cadr_machine_destroy(machine);
}

static void test_scheduler_ingress_is_release_and_tick_bounded(void)
{
    cadr_machine *machine = running_machine();
    cadr_scheduler_event input;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    if (machine == NULL) return;
    CHECK(cadr_machine_scheduler_transcript_start(machine) == CADR_STATUS_OK);
    CHECK(cadr_iob_write(&machine->state, 0764112U, UINT16_C(4)) == CADR_STATUS_OK);
    input = event(CADR_SCHED_EVENT_CLOCK, 1U);
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    CHECK(machine->state.devices.iob.sixty_cycle_clock == UINT16_C(0));
    input = event(CADR_SCHED_EVENT_KEYBOARD, UINT32_C(01234));
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    input = event(CADR_SCHED_EVENT_SEQUENCE_BREAK, 0U);
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    CHECK(machine->state.scheduler.count == 3U);
    input.due_tick = 1U;
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    input.due_tick = 0U;
    input.abi_minor = CADR_ABI_MINOR_M4;
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_ABI_MISMATCH);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(machine->state.scheduler.count == 1U);
    CHECK(machine->state.devices.iob.sixty_cycle_clock == UINT16_C(1));
    CHECK(machine->state.devices.iob.scancode ==
          ((UINT32_C(1) << 16U) | UINT32_C(01234)));
    CHECK((machine->state.cpu.interrupt_control & (UINT32_C(1) << 26U)) != 0U);
    {
        uint8_t transcript[376];
        uint64_t transcript_bytes = 0U;
        CHECK(cadr_machine_scheduler_transcript_size(machine, &transcript_bytes) == CADR_STATUS_OK);
        CHECK(transcript_bytes == UINT64_C(376));
        CHECK(cadr_machine_scheduler_transcript_copy(machine, transcript,
                                                      sizeof(transcript), &transcript_bytes) == CADR_STATUS_OK);
        CHECK(memcmp(transcript, "CDRM5TR1", 8U) == 0);
        CHECK(transcript[16U + 24U] == CADR_SCHED_EVENT_CLOCK);
        CHECK(transcript[136U + 24U] == CADR_SCHED_EVENT_KEYBOARD);
        CHECK(transcript[256U + 24U] == CADR_SCHED_EVENT_SEQUENCE_BREAK);
        CHECK(transcript[16U + 8U] == 1U);
    }
    cadr_machine_destroy(machine);
}

static void test_legacy_run_rejects_stranded_m5_state(void)
{
    cadr_machine *machine = running_machine();
    cadr_scheduler_event input;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4, (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    uint16_t observed;
    uint8_t witness[CADR_SHA256_BYTES];
    uint64_t total;
    if (machine == NULL) return;
    /* Arrange a raw IOB poll which would be visible only in the old,
     * accidentally-M5 loop: A is consumed, B remains queued and ready to
     * become the next scancode at the first 0x10000 poll. */
    CHECK(cadr_iob_write(&machine->state, 0764112U, UINT16_C(4)) == CADR_STATUS_OK);
    CHECK(cadr_iob_keyboard_event(&machine->state, UINT16_C(0123)) == CADR_STATUS_OK);
    CHECK(cadr_iob_keyboard_event(&machine->state, UINT16_C(0456)) == CADR_STATUS_OK);
    CHECK(cadr_iob_read(&machine->state, 0764100U, &observed) == CADR_STATUS_OK);
    CHECK(observed == UINT16_C(0123));
    CHECK(machine->state.devices.iob.key_queue_count == 1U);
    input = event(CADR_SCHED_EVENT_KEYBOARD, UINT32_C(0777));
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    total = machine->state.scheduler.transcript_total_count;
    (void)memcpy(witness, machine->state.scheduler.transcript_witness_sha256,
                 sizeof(witness));
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_NOT_READY);
    CHECK(result.clock_slots_completed == 0U);
    CHECK(machine->state.scheduler.count == 1U);
    CHECK(machine->state.scheduler.transcript_total_count == total);
    CHECK(memcmp(machine->state.scheduler.transcript_witness_sha256,
                 witness, sizeof(witness)) == 0);
    CHECK(machine->state.devices.iob.scancode == ((UINT32_C(1) << 16U) | UINT32_C(0123)));
    CHECK(machine->state.devices.iob.key_queue_count == 1U);
    run.abi_minor = CADR_ABI_MINOR_M5;
    result.abi_minor = CADR_ABI_MINOR_M5;
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(result.clock_slots_completed == 1U);
    CHECK(machine->state.scheduler.count == 0U);
    cadr_machine_destroy(machine);
}

static void test_due_group_is_atomic_when_csr_enable_is_cleared(void)
{
    cadr_machine *machine = running_machine();
    cadr_scheduler_event events[2];
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    uint32_t index;
    if (machine == NULL) return;
    CHECK(cadr_iob_write(&machine->state, 0764112U, UINT16_C(4)) == CADR_STATUS_OK);
    CHECK(cadr_iob_keyboard_event(&machine->state, UINT16_C(1)) == CADR_STATUS_OK);
    for (index = 0U; index < CADR_IOB_KEY_QUEUE_LEN; ++index) {
        CHECK(cadr_iob_keyboard_event(&machine->state, (uint16_t)(index + 2U)) ==
              CADR_STATUS_OK);
    }
    /* Writing low CSR enables only clears bit 2; bit 5 remains ready. */
    CHECK(cadr_iob_write(&machine->state, 0764112U, 0U) == CADR_STATUS_OK);
    CHECK((machine->state.devices.iob.csr & UINT32_C(040)) != 0U);
    events[0] = event(CADR_SCHED_EVENT_CLOCK, 1U);
    events[1] = event(CADR_SCHED_EVENT_KEYBOARD, UINT32_C(0777));
    CHECK(cadr_machine_schedule_events(machine, events, 2U) == CADR_STATUS_OK);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_QUEUE_FULL);
    CHECK(result.clock_slots_completed == 0U);
    CHECK(machine->state.devices.iob.sixty_cycle_clock == 0U);
    CHECK(machine->state.scheduler.count == 2U);
    cadr_machine_destroy(machine);
}

static void test_queue_rejections_and_rational_clock(void)
{
    cadr_machine *machine = running_machine();
    cadr_scheduler_event input;
    uint32_t index;
    if (machine == NULL) return;
    input = event(CADR_SCHED_EVENT_CLOCK, 1U);
    input.due_tick = UINT64_C(1);
    for (index = 0U; index < CADR_SCHEDULER_EVENT_CAPACITY; ++index) {
        input.due_tick = (uint64_t)index + UINT64_C(1);
        CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    }
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_QUEUE_FULL);
    CHECK(machine->state.scheduler.count == CADR_SCHEDULER_EVENT_CAPACITY);
    machine->state.scheduler.count = 0U;
    machine->state.scheduler.next_insertion_sequence = 0U;
    input.due_tick = 0U;
    machine->state.clock_slots_completed = 1U;
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_INVALID_ARGUMENT);
    machine->state.clock_slots_completed = 0U;
    input.flags = 1U;
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_INVALID_ARGUMENT);
    input.flags = 0U;
    input.kind = CADR_SCHED_EVENT_KEYBOARD;
    input.value = UINT32_C(1);
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    input.value = UINT32_C(2);
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_AMBIGUOUS_SCHEDULE);
    CHECK(machine->state.scheduler.count == 1U);
    machine->state.devices.tv_mode = UINT32_C(1) << 3U;
    CHECK(cadr_iob_clock_tick(&machine->state, 1U) == CADR_STATUS_OK);
    CHECK(machine->state.devices.iob.usec_clock == UINT32_C(16666));
    CHECK(machine->state.devices.iob.usec_phase == UINT32_C(40));
    CHECK((machine->state.devices.tv_mode & (UINT32_C(1) << 4U)) != 0U);
    CHECK((machine->state.bus.interrupt_status & UINT16_C(040000)) != 0U);
    CHECK(cadr_iob_clock_tick(&machine->state, 1U) == CADR_STATUS_OK);
    CHECK(machine->state.devices.iob.usec_clock == UINT32_C(33333));
    CHECK(machine->state.devices.iob.usec_phase == UINT32_C(20));
    cadr_machine_destroy(machine);
}

static void test_sequence_break_uses_canonical_interrupt_control_write(void)
{
    cadr_machine *machine = running_machine();
    cadr_scheduler_event input;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    if (machine == NULL) return;
    machine->state.cpu.interrupt_control = UINT32_C(1) << 28U;
    cadr_bus_set_xbus_nxm(&machine->state);
    CHECK((machine->state.bus.error_status & CADR_BUS_ERROR_XBUS_NXM) != 0U);
    input = event(CADR_SCHED_EVENT_SEQUENCE_BREAK, 0U);
    CHECK(cadr_machine_schedule_event(machine, &input) == CADR_STATUS_OK);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK((machine->state.cpu.interrupt_control & (UINT32_C(1) << 26U)) != 0U);
    CHECK((machine->state.bus.error_status & CADR_BUS_ERROR_XBUS_NXM) == 0U);
    cadr_machine_destroy(machine);
}

static void test_transcript_drain_is_chunking_independent(void)
{
    cadr_machine *whole = running_machine();
    cadr_machine *chunked = running_machine();
    cadr_run_request one = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_request three = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 3U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    uint8_t before_drain[CADR_SHA256_BYTES];
    uint8_t after_drain[CADR_SHA256_BYTES];
    uint8_t chunked_digest[CADR_SHA256_BYTES];
    uint8_t bytes[376];
    uint64_t written = 0U;
    uint32_t index;
    if (whole == NULL || chunked == NULL) {
        cadr_machine_destroy(whole); cadr_machine_destroy(chunked); return;
    }
    CHECK(cadr_machine_scheduler_transcript_start(whole) == CADR_STATUS_OK);
    CHECK(cadr_machine_scheduler_transcript_start(chunked) == CADR_STATUS_OK);
    for (index = 0U; index < 3U; ++index) {
        cadr_scheduler_event input = event(CADR_SCHED_EVENT_CLOCK, 1U);
        input.due_tick = index;
        CHECK(cadr_machine_schedule_event(whole, &input) == CADR_STATUS_OK);
    }
    CHECK(cadr_machine_run(whole, &three, &result) == CADR_STATUS_OK);
    CHECK(whole->state.scheduler.transcript_total_count == UINT64_C(3));
    CHECK(cadr_machine_state_v5_digest(whole, before_drain) == CADR_STATUS_OK);
    CHECK(cadr_machine_scheduler_transcript_drain(whole, bytes, sizeof(bytes), &written) == CADR_STATUS_OK);
    CHECK(written == UINT64_C(376));
    CHECK(whole->state.scheduler.transcript_count == 0U);
    CHECK(cadr_machine_state_v5_digest(whole, after_drain) == CADR_STATUS_OK);
    CHECK(memcmp(before_drain, after_drain, sizeof(before_drain)) == 0);
    for (index = 0U; index < 3U; ++index) {
        cadr_scheduler_event input = event(CADR_SCHED_EVENT_CLOCK, 1U);
        input.due_tick = index;
        CHECK(cadr_machine_schedule_event(chunked, &input) == CADR_STATUS_OK);
        CHECK(cadr_machine_run(chunked, &one, &result) == CADR_STATUS_OK);
        CHECK(cadr_machine_scheduler_transcript_drain(chunked, bytes, sizeof(bytes), &written) == CADR_STATUS_OK);
    }
    CHECK(chunked->state.scheduler.transcript_total_count == UINT64_C(3));
    CHECK(cadr_machine_state_v5_digest(chunked, chunked_digest) == CADR_STATUS_OK);
    CHECK(memcmp(after_drain, chunked_digest, sizeof(after_drain)) == 0);
    cadr_machine_destroy(whole);
    cadr_machine_destroy(chunked);
}

static cadr_status run_one_scheduled_clock(cadr_machine *machine)
{
    cadr_scheduler_event input = event(CADR_SCHED_EVENT_CLOCK, 1U);
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    input.due_tick = machine->state.clock_slots_completed;
    if (cadr_machine_schedule_event(machine, &input) != CADR_STATUS_OK) return CADR_STATUS_INVALID_ARGUMENT;
    return cadr_machine_run(machine, &run, &result);
}

/* These fixture helpers deliberately reseal each mutated snapshot.  The
 * rejection cases below consequently exercise the M5 directory/chunk/state
 * decoder rather than the outer SHA-256 tamper check. */
enum {
    M5_SNAPSHOT_HEADER_BYTES = 264U,
    M5_SNAPSHOT_DIRECTORY_ENTRY_BYTES = 64U,
    M5_SNAPSHOT_TRAILER_BYTES = 32U,
    M5_SNAPSHOT_DIRECTORY_SHA_OFFSET = 232U,
    M5_SNAPSHOT_CHUNK_DISK = 9U,
    M5_SNAPSHOT_CHUNK_SCHEDULER = 10U,
    M5_SNAPSHOT_TYPE10_IOB_CSR_OFFSET = 0U,
    M5_SNAPSHOT_TYPE10_IOB_SCANCODE_OFFSET = 4U,
    M5_SNAPSHOT_TYPE10_FIFO_READ_OFFSET = 24U,
    M5_SNAPSHOT_TYPE10_FIFO_WRITE_OFFSET = 28U,
    M5_SNAPSHOT_TYPE10_NEXT_INSERTION_OFFSET = 56U,
    M5_SNAPSHOT_TYPE10_SCHEDULER_COUNT_OFFSET = 64U,
    M5_SNAPSHOT_TYPE10_SCHEDULER_RESERVED_OFFSET = 76U,
    M5_SNAPSHOT_TYPE10_TRANSCRIPT_COUNT_OFFSET = 120U,
    M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET = 132U,
    M5_SNAPSHOT_TRANSCRIPT_BYTES = 120U,
    M5_SNAPSHOT_TRANSCRIPT_INSERTION_OFFSET = 16U,
    M5_SNAPSHOT_TRANSCRIPT_ORDER_OFFSET = 28U,
    M5_SNAPSHOT_TRANSCRIPT_INTERRUPT_AFTER_OFFSET = 44U,
    M5_SNAPSHOT_TRANSCRIPT_INTERRUPT_CONTROL_AFTER_OFFSET = 52U,
    M5_SNAPSHOT_TRANSCRIPT_IOB_CSR_AFTER_OFFSET = 60U,
    M5_SNAPSHOT_TRANSCRIPT_LOCATION_COUNTER_AFTER_OFFSET = 68U,
    M5_SNAPSHOT_TRANSCRIPT_USEC_CLOCK_AFTER_OFFSET = 92U,
    M5_SNAPSHOT_TRANSCRIPT_SCANCODE_AFTER_OFFSET = 108U,
    M5_SNAPSHOT_TRANSCRIPT_FIFO_AFTER_OFFSET = 116U
};

static uint32_t m5_snapshot_get_u32(const uint8_t *bytes)
{
    return (uint32_t)bytes[0U] | ((uint32_t)bytes[1U] << 8U) |
        ((uint32_t)bytes[2U] << 16U) | ((uint32_t)bytes[3U] << 24U);
}

static uint64_t m5_snapshot_get_u64(const uint8_t *bytes)
{
    uint64_t result = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        result |= (uint64_t)bytes[index] << (index * 8U);
    }
    return result;
}

static void m5_snapshot_put_u32(uint8_t *bytes, uint32_t value)
{
    uint32_t index;
    for (index = 0U; index < 4U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static void m5_snapshot_put_u64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static uint8_t *m5_snapshot_chunk_entry(uint8_t *bytes, uint32_t type)
{
    const uint32_t count = m5_snapshot_get_u32(bytes + 20U);
    const uint64_t directory_offset = m5_snapshot_get_u64(bytes + 40U);
    uint32_t index;
    for (index = 0U; index < count; ++index) {
        uint8_t *entry = bytes + (size_t)directory_offset +
            (size_t)index * M5_SNAPSHOT_DIRECTORY_ENTRY_BYTES;
        if (m5_snapshot_get_u32(entry) == type) return entry;
    }
    return NULL;
}

static int m5_snapshot_reseal(uint8_t *bytes, size_t byte_count)
{
    const uint64_t directory_offset = m5_snapshot_get_u64(bytes + 40U);
    const uint64_t directory_bytes = m5_snapshot_get_u64(bytes + 48U);
    if (byte_count < M5_SNAPSHOT_HEADER_BYTES + M5_SNAPSHOT_TRAILER_BYTES ||
        m5_snapshot_get_u64(bytes + 32U) != byte_count ||
        directory_offset > byte_count || directory_bytes > byte_count - directory_offset) {
        return 0;
    }
    cadr_m4_media_sha256(bytes + (size_t)directory_offset, directory_bytes,
                         bytes + M5_SNAPSHOT_DIRECTORY_SHA_OFFSET);
    cadr_m4_media_sha256(bytes, (uint64_t)(byte_count - M5_SNAPSHOT_TRAILER_BYTES),
                         bytes + byte_count - M5_SNAPSHOT_TRAILER_BYTES);
    return 1;
}

static int m5_snapshot_reseal_chunk(uint8_t *bytes, size_t byte_count, uint32_t type)
{
    uint8_t *entry = m5_snapshot_chunk_entry(bytes, type);
    uint64_t offset;
    uint64_t length;
    if (entry == NULL) return 0;
    offset = m5_snapshot_get_u64(entry + 8U);
    length = m5_snapshot_get_u64(entry + 16U);
    if (offset > byte_count || length > byte_count - offset) return 0;
    cadr_m4_media_sha256(bytes + (size_t)offset, length, entry + 32U);
    return m5_snapshot_reseal(bytes, byte_count);
}

static uint8_t *m5_snapshot_copy(const uint8_t *source, size_t byte_count)
{
    uint8_t *copy = malloc(byte_count);
    if (copy != NULL) (void)memcpy(copy, source, byte_count);
    return copy;
}

static uint8_t *m5_snapshot_fixture(size_t *out_byte_count, int with_transcript)
{
    cadr_machine *machine = running_machine();
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    cadr_scheduler_event clock = event(CADR_SCHED_EVENT_CLOCK, 1U);
    cadr_scheduler_event keyboard = event(CADR_SCHED_EVENT_KEYBOARD, UINT32_C(0123));
    cadr_scheduler_event queued_keyboard = event(CADR_SCHED_EVENT_KEYBOARD, UINT32_C(0124));
    cadr_scheduler_event sequence_break = event(CADR_SCHED_EVENT_SEQUENCE_BREAK, 0U);
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    uint8_t *bytes = NULL;
    uint64_t size = 0U;
    uint64_t written = 0U;

    if (out_byte_count != NULL) *out_byte_count = 0U;
    if (machine == NULL || out_byte_count == NULL) {
        cadr_machine_destroy(machine);
        return NULL;
    }
    if (with_transcript != 0) {
        CHECK(cadr_machine_scheduler_transcript_start(machine) == CADR_STATUS_OK);
        machine->state.devices.iob.csr = UINT32_C(4);
        cadr_bus_set_interrupt_status(&machine->state, UINT16_C(02000));
        clock.due_tick = machine->state.clock_slots_completed;
        keyboard.due_tick = machine->state.clock_slots_completed;
        sequence_break.due_tick = machine->state.clock_slots_completed;
        queued_keyboard.due_tick = machine->state.clock_slots_completed + UINT64_C(1);
        CHECK(cadr_machine_schedule_event(machine, &clock) == CADR_STATUS_OK);
        CHECK(cadr_machine_schedule_event(machine, &keyboard) == CADR_STATUS_OK);
        CHECK(cadr_machine_schedule_event(machine, &sequence_break) == CADR_STATUS_OK);
        CHECK(cadr_machine_schedule_event(machine, &queued_keyboard) == CADR_STATUS_OK);
        run.clock_slot_budget = 2U;
        CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
        CHECK(machine->state.scheduler.transcript_count == 4U);
    }
    CHECK(cadr_machine_snapshot_size(machine, &request, &size) == CADR_STATUS_OK);
    if (size != 0U && size <= (uint64_t)SIZE_MAX) bytes = malloc((size_t)size);
    CHECK(bytes != NULL);
    if (bytes != NULL) {
        CHECK(cadr_machine_snapshot_save(machine, &request, bytes, size, &written) == CADR_STATUS_OK);
        if (written != size) {
            free(bytes);
            bytes = NULL;
        }
    }
    cadr_machine_destroy(machine);
    if (bytes != NULL) *out_byte_count = (size_t)size;
    return bytes;
}

static uint8_t *m5_snapshot_extend_type10(const uint8_t *source, size_t byte_count,
                                           size_t *out_byte_count)
{
    uint8_t *copy;
    uint8_t *entry;
    const size_t payload_end = byte_count - M5_SNAPSHOT_TRAILER_BYTES;
    if (out_byte_count != NULL) *out_byte_count = 0U;
    if (byte_count == SIZE_MAX || byte_count < M5_SNAPSHOT_TRAILER_BYTES) return NULL;
    copy = malloc(byte_count + 1U);
    if (copy == NULL) return NULL;
    (void)memcpy(copy, source, payload_end);
    copy[payload_end] = 0U;
    (void)memcpy(copy + payload_end + 1U, source + payload_end,
                 M5_SNAPSHOT_TRAILER_BYTES);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    if (entry == NULL) {
        free(copy);
        return NULL;
    }
    m5_snapshot_put_u64(copy + 32U, (uint64_t)(byte_count + 1U));
    m5_snapshot_put_u64(entry + 16U, m5_snapshot_get_u64(entry + 16U) + 1U);
    if (!m5_snapshot_reseal_chunk(copy, byte_count + 1U, M5_SNAPSHOT_CHUNK_SCHEDULER)) {
        free(copy);
        return NULL;
    }
    if (out_byte_count != NULL) *out_byte_count = byte_count + 1U;
    return copy;
}

static void m5_snapshot_restore_rejects(const uint8_t *bytes, size_t byte_count)
{
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    cadr_machine *restored = NULL;
    CHECK(cadr_machine_snapshot_restore(&request, bytes, (uint64_t)byte_count, &restored) !=
          CADR_STATUS_OK);
    CHECK(restored == NULL);
    cadr_machine_destroy(restored);
}

static void m5_snapshot_restore_accepts(const uint8_t *bytes, size_t byte_count)
{
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    cadr_machine *restored = NULL;
    CHECK(cadr_machine_snapshot_restore(&request, bytes, (uint64_t)byte_count, &restored) ==
          CADR_STATUS_OK);
    CHECK(restored != NULL);
    cadr_machine_destroy(restored);
}

static void test_m5_snapshot_corruption_rejections(void)
{
    uint8_t *base;
    uint8_t *transcript_base;
    uint8_t *copy;
    uint8_t *entry;
    uint8_t *payload;
    size_t byte_count = 0U;
    size_t transcript_byte_count = 0U;
    size_t extended_byte_count = 0U;

    base = m5_snapshot_fixture(&byte_count, 0);
    transcript_base = m5_snapshot_fixture(&transcript_byte_count, 1);
    if (base == NULL || transcript_base == NULL) {
        free(base);
        free(transcript_base);
        return;
    }
    m5_snapshot_restore_accepts(base, byte_count);
    m5_snapshot_restore_accepts(transcript_base, transcript_byte_count);

    /* Required scheduler chunk absent. */
    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        m5_snapshot_put_u32(entry, 11U);
        CHECK(m5_snapshot_reseal(copy, byte_count));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    /* The allocation frontier accounts for both executed and pending events. */
    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u64(payload + M5_SNAPSHOT_TYPE10_NEXT_INSERTION_OFFSET, 1U);
        CHECK(m5_snapshot_reseal_chunk(copy, byte_count, M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    /* A second scheduler type is rejected rather than silently selected. */
    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_DISK);
    CHECK(entry != NULL);
    if (entry != NULL) {
        m5_snapshot_put_u32(entry, M5_SNAPSHOT_CHUNK_SCHEDULER);
        CHECK(m5_snapshot_reseal(copy, byte_count));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    /* Known chunks must be required. */
    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        m5_snapshot_put_u32(entry + 4U, 0U);
        CHECK(m5_snapshot_reseal(copy, byte_count));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    /* Directory reserved bits are semantic format fields, not padding. */
    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        m5_snapshot_put_u64(entry + 24U, 1U);
        CHECK(m5_snapshot_reseal(copy, byte_count));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    /* The extra byte is correctly chunk- and snapshot-hashed; only the exact
     * scheduler-record decoder rejects the resulting type-10 length. */
    copy = m5_snapshot_extend_type10(base, byte_count, &extended_byte_count);
    CHECK(copy != NULL);
    if (copy != NULL) m5_snapshot_restore_rejects(copy, extended_byte_count);
    free(copy);

    /* M3+ disk witness is checked after its chunk has passed integrity. */
    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_DISK);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        payload[64U] ^= UINT8_C(1);
        CHECK(m5_snapshot_reseal_chunk(copy, byte_count, M5_SNAPSHOT_CHUNK_DISK));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_IOB_CSR_OFFSET, UINT32_C(0100));
        CHECK(m5_snapshot_reseal_chunk(copy, byte_count, M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_IOB_SCANCODE_OFFSET, UINT32_C(0x20000));
        CHECK(m5_snapshot_reseal_chunk(copy, byte_count, M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_FIFO_READ_OFFSET, 0U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_FIFO_WRITE_OFFSET, 1U);
        CHECK(m5_snapshot_reseal_chunk(copy, byte_count, M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_SCHEDULER_COUNT_OFFSET,
                            CADR_SCHEDULER_EVENT_CAPACITY + 1U);
        CHECK(m5_snapshot_reseal_chunk(copy, byte_count, M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(base, byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_SCHEDULER_RESERVED_OFFSET, 1U);
        CHECK(m5_snapshot_reseal_chunk(copy, byte_count, M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, byte_count);
    }
    free(copy);

    /* These two mutations preserve all framing and hashes, leaving the M5
     * transcript ordering and insertion-uniqueness rules as the rejector. */
    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            M5_SNAPSHOT_TRANSCRIPT_BYTES +
                            M5_SNAPSHOT_TRANSCRIPT_ORDER_OFFSET, 0U);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            M5_SNAPSHOT_TRANSCRIPT_INTERRUPT_AFTER_OFFSET, 0U);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        const uint64_t first_insertion = m5_snapshot_get_u64(
            copy + (size_t)m5_snapshot_get_u64(entry + 8U) +
            M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
            M5_SNAPSHOT_TRANSCRIPT_INSERTION_OFFSET);
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u64(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            M5_SNAPSHOT_TRANSCRIPT_BYTES +
                            M5_SNAPSHOT_TRANSCRIPT_INSERTION_OFFSET, first_insertion);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    /* The captured clock, keyboard, and sequence-break rows must describe
     * their actual selected device transitions, not merely in-range values. */
    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            M5_SNAPSHOT_TRANSCRIPT_USEC_CLOCK_AFTER_OFFSET, 0U);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            M5_SNAPSHOT_TRANSCRIPT_BYTES +
                            M5_SNAPSHOT_TRANSCRIPT_IOB_CSR_AFTER_OFFSET, UINT32_C(4));
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            M5_SNAPSHOT_TRANSCRIPT_BYTES +
                            M5_SNAPSHOT_TRANSCRIPT_SCANCODE_AFTER_OFFSET, 0U);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            2U * M5_SNAPSHOT_TRANSCRIPT_BYTES +
                            M5_SNAPSHOT_TRANSCRIPT_INTERRUPT_CONTROL_AFTER_OFFSET, 0U);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            2U * M5_SNAPSHOT_TRANSCRIPT_BYTES +
                            M5_SNAPSHOT_TRANSCRIPT_LOCATION_COUNTER_AFTER_OFFSET, 0U);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    copy = m5_snapshot_copy(transcript_base, transcript_byte_count);
    entry = m5_snapshot_chunk_entry(copy, M5_SNAPSHOT_CHUNK_SCHEDULER);
    CHECK(entry != NULL);
    if (entry != NULL) {
        payload = copy + (size_t)m5_snapshot_get_u64(entry + 8U);
        m5_snapshot_put_u32(payload + M5_SNAPSHOT_TYPE10_TRANSCRIPT_RECORDS_OFFSET +
                            3U * M5_SNAPSHOT_TRANSCRIPT_BYTES +
                            M5_SNAPSHOT_TRANSCRIPT_FIFO_AFTER_OFFSET, 0U);
        CHECK(m5_snapshot_reseal_chunk(copy, transcript_byte_count,
                                       M5_SNAPSHOT_CHUNK_SCHEDULER));
        m5_snapshot_restore_rejects(copy, transcript_byte_count);
    }
    free(copy);

    free(base);
    free(transcript_base);
}

static void test_capture_backpressure_and_cumulative_witness(void)
{
    enum { EVENT_COUNT = 300 };
    cadr_machine *off = running_machine();
    cadr_machine *coarse = running_machine();
    cadr_machine *fine = running_machine();
    cadr_machine *blocked = running_machine();
    uint8_t buffer[16U + CADR_SCHEDULER_TRANSCRIPT_CAPACITY * 120U];
    uint8_t off_digest[CADR_SHA256_BYTES];
    uint8_t coarse_digest[CADR_SHA256_BYTES];
    uint8_t fine_digest[CADR_SHA256_BYTES];
    uint64_t written = 0U;
    uint32_t index;
    if (off == NULL || coarse == NULL || fine == NULL || blocked == NULL) {
        cadr_machine_destroy(off); cadr_machine_destroy(coarse);
        cadr_machine_destroy(fine); cadr_machine_destroy(blocked); return;
    }
    CHECK(cadr_machine_scheduler_transcript_start(coarse) == CADR_STATUS_OK);
    CHECK(cadr_machine_scheduler_transcript_start(fine) == CADR_STATUS_OK);
    for (index = 0U; index < EVENT_COUNT; ++index) {
        CHECK(run_one_scheduled_clock(off) == CADR_STATUS_OK);
        CHECK(run_one_scheduled_clock(coarse) == CADR_STATUS_OK);
        CHECK(run_one_scheduled_clock(fine) == CADR_STATUS_OK);
        if (coarse->state.scheduler.transcript_count == CADR_SCHEDULER_TRANSCRIPT_CAPACITY) {
            CHECK(cadr_machine_scheduler_transcript_drain(coarse, buffer, sizeof(buffer), &written) == CADR_STATUS_OK);
        }
        if (fine->state.scheduler.transcript_count == 17U) {
            CHECK(cadr_machine_scheduler_transcript_drain(fine, buffer, sizeof(buffer), &written) == CADR_STATUS_OK);
        }
    }
    CHECK(off->state.scheduler.transcript_count == 0U);
    CHECK(off->state.scheduler.transcript_total_count == EVENT_COUNT);
    CHECK(cadr_machine_scheduler_transcript_drain(coarse, buffer, sizeof(buffer), &written) == CADR_STATUS_OK);
    CHECK(cadr_machine_scheduler_transcript_drain(fine, buffer, sizeof(buffer), &written) == CADR_STATUS_OK);
    CHECK(cadr_machine_scheduler_transcript_finish(coarse) == CADR_STATUS_OK);
    CHECK(cadr_machine_scheduler_transcript_finish(fine) == CADR_STATUS_OK);
    CHECK(coarse->state.scheduler.transcript_total_count == EVENT_COUNT);
    CHECK(fine->state.scheduler.transcript_total_count == EVENT_COUNT);
    CHECK(memcmp(coarse->state.scheduler.transcript_witness_sha256,
                 fine->state.scheduler.transcript_witness_sha256,
                 CADR_SHA256_BYTES) == 0);
    CHECK(cadr_machine_state_v5_digest(off, off_digest) == CADR_STATUS_OK);
    CHECK(cadr_machine_state_v5_digest(coarse, coarse_digest) == CADR_STATUS_OK);
    CHECK(cadr_machine_state_v5_digest(fine, fine_digest) == CADR_STATUS_OK);
    CHECK(memcmp(off_digest, coarse_digest, CADR_SHA256_BYTES) == 0);
    CHECK(memcmp(coarse_digest, fine_digest, CADR_SHA256_BYTES) == 0);

    CHECK(cadr_machine_scheduler_transcript_start(blocked) == CADR_STATUS_OK);
    for (index = 0U; index < CADR_SCHEDULER_TRANSCRIPT_CAPACITY; ++index) {
        CHECK(run_one_scheduled_clock(blocked) == CADR_STATUS_OK);
    }
    {
        const uint64_t total_before = blocked->state.scheduler.transcript_total_count;
        const uint32_t clock_before = blocked->state.devices.iob.sixty_cycle_clock;
        cadr_scheduler_event input = event(CADR_SCHED_EVENT_CLOCK, 1U);
        cadr_run_request run = {
            CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_request), 0U, 1U
        };
        cadr_run_result result = {
            CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_run_result), 0U,
            0U, 0U, 0U, 0U
        };
        input.due_tick = blocked->state.clock_slots_completed;
        CHECK(cadr_machine_schedule_event(blocked, &input) == CADR_STATUS_OK);
        CHECK(cadr_machine_run(blocked, &run, &result) == CADR_STATUS_QUEUE_FULL);
        CHECK(result.clock_slots_completed == 0U);
        CHECK(blocked->state.scheduler.transcript_total_count == total_before);
        CHECK(blocked->state.devices.iob.sixty_cycle_clock == clock_before);
        CHECK(blocked->state.scheduler.count == 1U);
    }
    cadr_machine_destroy(off); cadr_machine_destroy(coarse);
    cadr_machine_destroy(fine); cadr_machine_destroy(blocked);
}

static void test_snapshot_preserves_pending_capture_without_changing_witness(void)
{
    cadr_machine *source = running_machine();
    cadr_machine *restored = NULL;
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    uint8_t before[CADR_SHA256_BYTES];
    uint8_t after[CADR_SHA256_BYTES];
    uint8_t drained[136];
    uint8_t *snapshot = NULL;
    uint64_t bytes = 0U;
    uint64_t written = 0U;
    if (source == NULL) return;
    CHECK(cadr_machine_scheduler_transcript_start(source) == CADR_STATUS_OK);
    CHECK(run_one_scheduled_clock(source) == CADR_STATUS_OK);
    CHECK(cadr_machine_state_v5_digest(source, before) == CADR_STATUS_OK);
    CHECK(cadr_machine_snapshot_size(source, &request, &bytes) == CADR_STATUS_OK);
    snapshot = malloc((size_t)bytes);
    CHECK(snapshot != NULL);
    if (snapshot != NULL) {
        CHECK(cadr_machine_snapshot_save(source, &request, snapshot, bytes, &written) == CADR_STATUS_OK);
        CHECK(written == bytes);
        CHECK(cadr_machine_snapshot_restore(&request, snapshot, bytes, &restored) == CADR_STATUS_OK);
    }
    if (restored != NULL) {
        CHECK(restored->state.scheduler.transcript_capture_enabled == 1U);
        CHECK(restored->state.scheduler.transcript_count == 1U);
        CHECK(restored->state.scheduler.transcript_total_count == 1U);
        CHECK(cadr_machine_scheduler_transcript_drain(restored, drained, sizeof(drained), &written) == CADR_STATUS_OK);
        CHECK(written == sizeof(drained));
        CHECK(cadr_machine_scheduler_transcript_drain(restored, drained, sizeof(drained), &written) == CADR_STATUS_OK);
        CHECK(written == UINT64_C(16));
        CHECK(cadr_machine_state_v5_digest(restored, after) == CADR_STATUS_OK);
        CHECK(memcmp(before, after, sizeof(before)) == 0);
        CHECK(cadr_machine_scheduler_transcript_finish(restored) == CADR_STATUS_OK);
    }
    free(snapshot);
    cadr_machine_destroy(restored);
    cadr_machine_destroy(source);
}

static void test_legacy_snapshot_upgrades_to_roundtrippable_m5(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_machine_config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_snapshot_request m3 = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    cadr_snapshot_request m5 = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    cadr_machine *source = NULL;
    cadr_machine *upgraded = NULL;
    cadr_machine *roundtrip = NULL;
    uint8_t *m3_bytes = NULL;
    uint8_t *m5_bytes = NULL;
    uint64_t m3_size = 0U;
    uint64_t m5_size = 0U;
    uint64_t written = 0U;
    uint8_t v5_digest[CADR_SHA256_BYTES];
    CHECK(cadr_machine_create(&config, &source) == CADR_STATUS_OK);
    if (source == NULL) return;
    source->state.artifacts.boot_configuration_ingressed = 1U;
    source->state.artifacts.control_store_ingressed = 1U;
    source->state.artifacts.base_disk_verified = 1U;
    CHECK(cadr_machine_cold_power_on(source) == CADR_STATUS_OK);
    CHECK(cadr_machine_boot(source) == CADR_STATUS_OK);
    /* V5 is callable directly at the post-boot boundary; no V2 or batch
     * caller may be required to warm its derived cache first. */
    source->state.trace.state_v2.initialized = 0U;
    CHECK(cadr_machine_state_v5_digest(source, v5_digest) == CADR_STATUS_OK);
    CHECK(source->state.trace.state_v2.initialized != 0U);
    source->state.devices.disk.status = CADR_DISK_STATUS_NOT_ACTIVE |
        CADR_DISK_STATUS_ATTENTION;
    source->state.devices.disk.command = UINT32_C(012);
    CHECK(cadr_machine_snapshot_size(source, &m3, &m3_size) == CADR_STATUS_OK);
    m3_bytes = malloc((size_t)m3_size);
    CHECK(m3_bytes != NULL);
    if (m3_bytes != NULL) {
        CHECK(cadr_machine_snapshot_save(source, &m3, m3_bytes, m3_size, &written) == CADR_STATUS_OK);
        CHECK(cadr_machine_snapshot_restore(&m5, m3_bytes, written, &upgraded) == CADR_STATUS_OK);
    }
    if (upgraded != NULL) {
        CHECK(upgraded->state.scheduler.phase == CADR_SCHEDULER_PHASE_BOUNDARY_READY);
        CHECK(upgraded->state.scheduler.hidden_policy == CADR_SCHEDULER_HIDDEN_PAUSE);
        upgraded->state.trace.state_v2.initialized = 0U;
        CHECK(cadr_machine_state_v5_digest(upgraded, v5_digest) == CADR_STATUS_OK);
        CHECK(upgraded->state.trace.state_v2.initialized != 0U);
        CHECK(cadr_machine_snapshot_size(upgraded, &m5, &m5_size) == CADR_STATUS_OK);
        m5_bytes = malloc((size_t)m5_size);
        CHECK(m5_bytes != NULL);
        if (m5_bytes != NULL) {
            CHECK(cadr_machine_snapshot_save(upgraded, &m5, m5_bytes, m5_size, &written) == CADR_STATUS_OK);
            CHECK(cadr_machine_snapshot_restore(&m5, m5_bytes, written, &roundtrip) == CADR_STATUS_OK);
        }
    }
    free(m3_bytes); free(m5_bytes);
    cadr_machine_destroy(roundtrip); cadr_machine_destroy(upgraded); cadr_machine_destroy(source);
}

static void test_failure_digest_includes_staged_write_payload(void)
{
    cadr_machine *machine = running_machine();
    uint8_t descriptor[24] = {0};
    uint8_t payload[1024] = {0};
    uint8_t digest[CADR_SHA256_BYTES];
    if (machine == NULL) return;
    descriptor[16] = 1U; descriptor[20] = 0U; descriptor[21] = 4U;
    CHECK(cadr_core_issue_host_request_m4(&machine->state,
          CADR_HOST_OPERATION_BLOCK_WRITE, descriptor, sizeof(descriptor),
          payload, sizeof(payload), 0U) == CADR_STATUS_OK);
    CHECK(machine->state.events.request_payload_byte_count == sizeof(payload));
    CHECK(cadr_machine_state_v5_digest(machine, digest) == CADR_STATUS_NOT_READY);
    CHECK(cadr_machine_state_v5_failure_digest(machine, digest) == CADR_STATUS_OK);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_iob_fifo_registers_and_interrupt();
    test_scheduler_ingress_is_release_and_tick_bounded();
    test_legacy_run_rejects_stranded_m5_state();
    test_due_group_is_atomic_when_csr_enable_is_cleared();
    test_queue_rejections_and_rational_clock();
    test_sequence_break_uses_canonical_interrupt_control_write();
    test_transcript_drain_is_chunking_independent();
    test_capture_backpressure_and_cumulative_witness();
    test_snapshot_preserves_pending_capture_without_changing_witness();
    test_legacy_snapshot_upgrades_to_roundtrippable_m5();
    test_m5_snapshot_corruption_rejections();
    test_failure_digest_includes_staged_write_payload();
    if (failures != 0) return 1;
    (void)puts("cadr_m5_scheduler: ok");
    return 0;
}

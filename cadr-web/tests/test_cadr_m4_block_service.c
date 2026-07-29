#define _POSIX_C_SOURCE 200809L
#include "cadr_m4_block_service.h"
#include "cadr_m4_file_range_reader.h"
#include "cadr_machine.h"
#include "cadr_trace_engine.h"

#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static int failures;

typedef struct memory_reader {
    const uint8_t *bytes;
    uint64_t byte_count;
    uint32_t fail;
} memory_reader;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static void put_u32_le(uint8_t bytes[4], uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void put_u64_le(uint8_t bytes[8], uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static cadr_status read_memory_range(void *context, uint64_t byte_offset,
                                     uint8_t *out_bytes, uint64_t byte_count)
{
    const memory_reader *reader = context;
    if (reader == NULL || out_bytes == NULL || reader->fail != 0U ||
        byte_offset > reader->byte_count ||
        byte_count > reader->byte_count - byte_offset ||
        byte_count > SIZE_MAX) {
        return CADR_STATUS_HOST_FAILURE;
    }
    (void)memcpy(out_bytes, reader->bytes + (size_t)byte_offset,
                 (size_t)byte_count);
    return CADR_STATUS_OK;
}

static cadr_machine *running_machine(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR, (uint32_t)sizeof(cadr_machine_config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine != NULL) machine->state.lifecycle = CADR_MACHINE_RUNNING;
    return machine;
}

static void issue_read(cadr_machine *machine, uint64_t first_block,
                       uint32_t block_count, uint32_t block_bytes,
                       uint64_t completion_bytes)
{
    uint8_t descriptor[sizeof(cadr_block_read_descriptor)] = {0};
    put_u64_le(descriptor, first_block);
    put_u32_le(descriptor + 8U, block_count);
    put_u32_le(descriptor + 12U, block_bytes);
    CHECK(cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_BLOCK_READ,
                                          descriptor, sizeof(descriptor),
                                          completion_bytes) == CADR_STATUS_OK);
}

static void issue_write(cadr_machine *machine, uint64_t transaction_id,
                        uint64_t first_block, const uint8_t payload[1024])
{
    uint8_t descriptor[sizeof(cadr_block_write_descriptor)] = {0};
    put_u64_le(descriptor, transaction_id);
    put_u64_le(descriptor + 8U, first_block);
    put_u32_le(descriptor + 16U, 1U);
    put_u32_le(descriptor + 20U, 1024U);
    CHECK(cadr_core_issue_host_request_m4(
              &machine->state, CADR_HOST_OPERATION_BLOCK_WRITE,
              descriptor, sizeof(descriptor), payload, 1024U, 0U) ==
          CADR_STATUS_OK);
}

static cadr_m4_block_service_config config_for(memory_reader *reader,
                                                const uint8_t *image,
                                                uint64_t byte_count)
{
    reader->bytes = image;
    reader->byte_count = byte_count;
    reader->fail = 0U;
    cadr_m4_block_service_config config = {
        .read_range = read_memory_range,
        .read_context = reader,
        .image_byte_count = byte_count,
        .expected_image_byte_count = byte_count,
        .latency_ticks = 0U,
        .block_bytes = CADR_M4_BLOCK_SERVICE_BLOCK_BYTES,
        .fault_mask = CADR_M4_BLOCK_FAULT_NONE,
        .fault_operation = CADR_HOST_OPERATION_NONE,
        .fault_first_block = UINT64_MAX,
        .fault_occurrence = 0U
    };
    return config;
}

static void test_zero_tick_delivery_snapshots_immutable_bytes(void)
{
    uint8_t image[2048];
    cadr_machine *machine = running_machine();
    cadr_m4_block_service service;
    cadr_m4_block_service_config config;
    cadr_m4_block_service_event event;
    memory_reader reader;
    uint32_t index;

    for (index = 0U; index < sizeof(image); ++index) image[index] = (uint8_t)index;
    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 1U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 77U, &event) == CADR_STATUS_OK);
    CHECK(event.request_seen == 1U);
    CHECK(event.completion_delivered == 1U);
    CHECK(event.issue_tick == 77U);
    CHECK(event.due_tick == 77U);
    CHECK(event.delivery_tick == 77U);
    CHECK(event.host_status == CADR_HOST_RESULT_OK);
    CHECK(machine->state.events.completion_queued == 1U);
    CHECK(machine->state.events.completion_byte_count == 1024U);
    CHECK(machine->state.events.completion_bytes[0] == image[1024]);
    image[1024] ^= UINT8_C(0xff);
    CHECK(machine->state.events.completion_bytes[0] != image[1024]);
    cadr_machine_destroy(machine);
}

static void test_tick_delay_is_guest_time_only(void)
{
    uint8_t image[1024] = {0};
    cadr_machine *machine = running_machine();
    cadr_m4_block_service service;
    cadr_m4_block_service_config config;
    cadr_m4_block_service_event event;
    memory_reader reader;
    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    config.latency_ticks = 1U;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 0U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 11U, &event) == CADR_STATUS_OK);
    CHECK(event.request_seen == 1U);
    CHECK(event.completion_delivered == 0U);
    CHECK(event.due_tick == 12U);
    CHECK(machine->state.events.completion_queued == 0U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 11U, &event) == CADR_STATUS_OK);
    CHECK(event.request_seen == 0U);
    CHECK(event.completion_delivered == 0U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 12U, &event) == CADR_STATUS_OK);
    CHECK(event.completion_delivered == 1U);
    CHECK(event.delivery_tick == 12U);
    cadr_machine_destroy(machine);
}

static void test_malformed_and_truncated_ranges_fail_with_exact_payload(void)
{
    uint8_t image[1023] = {0};
    cadr_machine *machine = running_machine();
    cadr_m4_block_service service;
    cadr_m4_block_service_config config;
    cadr_m4_block_service_event event;
    memory_reader reader;
    uint32_t index;

    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 0U, 1U, 512U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 1U, &event) == CADR_STATUS_OK);
    CHECK(event.host_status == CADR_HOST_RESULT_FAILED);
    CHECK(event.completion_delivered == 1U);
    CHECK(machine->state.events.completion_byte_count == 1024U);
    for (index = 0U; index < 1024U; ++index) {
        CHECK(machine->state.events.completion_bytes[index] == 0U);
    }
    cadr_machine_destroy(machine);

    machine = running_machine();
    if (machine == NULL) return;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 0U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 2U, &event) == CADR_STATUS_OK);
    CHECK(event.host_status == CADR_HOST_RESULT_FAILED);
    CHECK(event.completion_delivered == 1U);
    cadr_machine_destroy(machine);
}

static void test_faults_and_wrong_image_identity_are_detectable(void)
{
    uint8_t image[1024] = {0};
    cadr_machine *machine = running_machine();
    cadr_m4_block_service service;
    cadr_m4_block_service_config config;
    cadr_m4_block_service_event event;
    memory_reader reader;

    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    config.expected_image_byte_count += 1U;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_ARTIFACT_MISMATCH);
    config = config_for(&reader, image, sizeof(image));
    config.fault_mask = CADR_M4_BLOCK_FAULT_STATUS_FAILED |
                        CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 0U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 3U, &event) == CADR_STATUS_OK);
    CHECK(event.due_tick == 4U);
    CHECK(event.completion_delivered == 0U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 4U, &event) == CADR_STATUS_OK);
    CHECK(event.host_status == CADR_HOST_RESULT_FAILED);
    CHECK(event.completion_delivered == 1U);
    cadr_machine_destroy(machine);

    machine = running_machine();
    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    config.fault_mask = CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 0U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 5U, &event) == CADR_STATUS_OK);
    CHECK(event.host_status == CADR_HOST_RESULT_OK);
    CHECK(machine->state.events.completion_bytes[0] == 1U);
    cadr_machine_destroy(machine);

    machine = running_machine();
    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    config.fault_mask = CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE;
    config.fault_occurrence = 2U;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 0U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 6U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.fault_mask == CADR_M4_BLOCK_FAULT_NONE);
    CHECK(service.fault_match_count == 1U);
    CHECK(cadr_m4_block_service_snapshot_status(&service) ==
          CADR_STATUS_NOT_READY);
    cadr_m4_block_service_discard(&service);
    CHECK(cadr_m4_block_service_snapshot_status(&service) == CADR_STATUS_OK);
    cadr_machine_destroy(machine);
}

static void test_native_file_range_reader_is_exact_and_read_only(void)
{
    char path[] = "/tmp/cadr-m4-range-XXXXXX";
    uint8_t input[2048];
    uint8_t output[1024];
    cadr_m4_file_range_reader reader = { -1, 0U };
    int descriptor;
    uint32_t index;
    ssize_t written;
    for (index = 0U; index < sizeof(input); ++index) {
        input[index] = (uint8_t)index;
    }
    descriptor = mkstemp(path);
    CHECK(descriptor >= 0);
    if (descriptor < 0) return;
    written = write(descriptor, input, sizeof(input));
    CHECK(written == (ssize_t)sizeof(input));
    CHECK(close(descriptor) == 0);
    CHECK(cadr_m4_file_range_reader_open(&reader, path, sizeof(input)) ==
          CADR_STATUS_OK);
    CHECK(cadr_m4_file_range_reader_read(&reader, 1024U, output,
                                         sizeof(output)) == CADR_STATUS_OK);
    CHECK(memcmp(output, input + 1024U, sizeof(output)) == 0);
    CHECK(cadr_m4_file_range_reader_read(&reader, 1025U, output,
                                         sizeof(output)) ==
          CADR_STATUS_HOST_FAILURE);
    cadr_m4_file_range_reader_close(&reader);
    CHECK(cadr_m4_file_range_reader_open(&reader, path, sizeof(input) + 1U) ==
          CADR_STATUS_ARTIFACT_MISMATCH);
    CHECK(unlink(path) == 0);
}

static void test_boot_scratch_overlay_commits_and_shadows_base(void)
{
    uint8_t image[2048] = {0};
    uint8_t payload[1024];
    cadr_machine *machine = running_machine();
    cadr_m4_block_service service;
    cadr_m4_block_service_config config;
    cadr_m4_block_service_event event;
    memory_reader reader;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
        (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
        (uint32_t)sizeof(cadr_run_result), 0U, 0U, 0U, 0U, 0U
    };
    cadr_reset_request reset = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
        (uint32_t)sizeof(cadr_reset_request), 0U
    };
    cadr_snapshot_request snapshot = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    uint64_t snapshot_size = 0U;
    uint32_t index;
    if (machine == NULL) return;
    for (index = 0U; index < sizeof(payload); ++index) {
        payload[index] = (uint8_t)(index ^ UINT32_C(0x5a));
    }
    config = config_for(&reader, image, sizeof(image));
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_write(machine, 1U, 1U, payload);
    CHECK(cadr_m4_block_service_poll(&service, machine, 8U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.request_seen == 1U && event.completion_delivered == 1U);
    CHECK(event.operation == CADR_HOST_OPERATION_BLOCK_WRITE);
    CHECK(event.overlay_prepared == 1U && event.overlay_committed == 1U);
    CHECK(event.overlay_generation == 1U);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 1U);
    CHECK(cadr_m4_block_service_snapshot_status(&service) ==
          CADR_STATUS_NOT_READY);
    CHECK(cadr_m4_block_service_snapshot_size(
              &service, machine, &snapshot, &snapshot_size) ==
          CADR_STATUS_NOT_READY);
    CHECK(machine->state.events.completion_queued == 1U);

    /* The acknowledged media write is visible before controller application. */
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(result.clock_slots_completed == 0U);
    CHECK(result.completions_applied == 1U);
    CHECK(cadr_machine_reset(machine, &reset) == CADR_STATUS_OK);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 1U);
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    issue_read(machine, 1U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 9U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.operation == CADR_HOST_OPERATION_BLOCK_READ);
    CHECK(machine->state.events.completion_queued == 1U);
    CHECK(memcmp(machine->state.events.completion_bytes, payload,
                 sizeof(payload)) == 0);
    cadr_m4_block_service_discard(&service);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 0U);
    cadr_machine_destroy(machine);
}

static void test_write_replay_is_idempotent(void)
{
    uint8_t image[2048] = {0};
    uint8_t payload[1024];
    cadr_machine *first = running_machine();
    cadr_machine *replay = NULL;
    cadr_machine *stale = NULL;
    cadr_m4_block_service service;
    cadr_m4_block_service_config config;
    cadr_m4_block_service_event event;
    memory_reader reader;
    uint32_t index;
    if (first == NULL) return;
    first->state.events.generation = 2U;
    for (index = 0U; index < sizeof(payload); ++index) {
        payload[index] = (uint8_t)(index ^ UINT32_C(0xa5));
    }
    config = config_for(&reader, image, sizeof(image));
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_write(first, 1U, 1U, payload);
    CHECK(cadr_m4_block_service_poll(&service, first, 10U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.overlay_committed == 1U);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 1U);
    cadr_machine_destroy(first);

    replay = running_machine();
    if (replay == NULL) return;
    replay->state.events.generation = 2U;
    issue_write(replay, 1U, 1U, payload);
    CHECK(cadr_m4_block_service_poll(&service, replay, 11U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.request_seen == 1U && event.completion_delivered == 1U);
    CHECK(event.overlay_replayed == 1U);
    CHECK(event.overlay_prepared == 0U && event.overlay_committed == 0U);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 1U);
    cadr_machine_destroy(replay);

    stale = running_machine();
    if (stale == NULL) return;
    issue_write(stale, 1U, 1U, payload);
    CHECK(cadr_m4_block_service_poll(&service, stale, 12U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.request_seen == 1U && event.completion_delivered == 1U);
    CHECK(event.host_status == CADR_HOST_RESULT_FAILED);
    CHECK(event.overlay_prepared == 0U && event.overlay_committed == 0U &&
          event.overlay_replayed == 0U);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 1U);
    cadr_machine_destroy(stale);
}

static void test_reset_races_and_targeted_faults(void)
{
    uint8_t image[2048] = {0};
    uint8_t payload[1024] = {0};
    cadr_machine *machine = running_machine();
    cadr_m4_block_service service;
    cadr_m4_block_service_config config;
    cadr_m4_block_service_event event;
    memory_reader reader;
    cadr_reset_request reset = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
        (uint32_t)sizeof(cadr_reset_request), 0U
    };
    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    config.latency_ticks = 1U;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_write(machine, 1U, 1U, payload);
    CHECK(cadr_m4_block_service_poll(&service, machine, 1U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.overlay_prepared == 1U &&
          event.completion_delivered == 0U);
    CHECK(cadr_machine_reset(machine, &reset) == CADR_STATUS_OK);
    CHECK(cadr_m4_block_service_poll(&service, machine, 2U, &event) !=
          CADR_STATUS_OK);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 0U);
    CHECK(service.staged == 0U && service.pending == 0U);
    cadr_machine_destroy(machine);

    machine = running_machine();
    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_write(machine, 1U, 1U, payload);
    CHECK(cadr_m4_block_service_poll(&service, machine, 2U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.overlay_committed == 1U);
    CHECK(machine->state.events.completion_queued == 1U);
    CHECK(cadr_machine_reset(machine, &reset) == CADR_STATUS_OK);
    CHECK(cadr_m4_block_service_overlay_generation(&service) == 1U);
    CHECK(machine->state.events.completion_queued == 0U);
    cadr_machine_destroy(machine);

    machine = running_machine();
    if (machine == NULL) return;
    config = config_for(&reader, image, sizeof(image));
    config.fault_mask = CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE;
    config.fault_operation = CADR_HOST_OPERATION_BLOCK_READ;
    config.fault_first_block = 0U;
    config.fault_occurrence = 1U;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 1U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 3U, &event) ==
          CADR_STATUS_OK);
    CHECK(machine->state.events.completion_bytes[0] == 0U);
    {
        cadr_run_request run = {
            CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
            (uint32_t)sizeof(cadr_run_request), 0U, 1U
        };
        cadr_run_result result = {
            CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
            (uint32_t)sizeof(cadr_run_result), 0U, 0U, 0U, 0U, 0U
        };
        CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    }
    issue_read(machine, 0U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 4U, &event) ==
          CADR_STATUS_OK);
    CHECK(event.fault_mask == CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE);
    CHECK(machine->state.events.completion_bytes[0] == 1U);
    cadr_machine_destroy(machine);
}

static void test_payload_write_is_traceable_before_publication(void)
{
    uint8_t payload[1024] = {0};
    cadr_machine *machine = running_machine();
    cadr_trace_engine_config trace;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
        (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
        (uint32_t)sizeof(cadr_run_result), 0U, 0U, 0U, 0U, 0U
    };
    uint64_t before;
    if (machine == NULL) return;
    (void)memset(&trace, 0, sizeof(trace));
    trace.event_mask = CADR_TRACE_EVENT_DEVICE;
    trace.transport_mode = CADR_TRACE_TRANSPORT_HASH_ONLY;
    CHECK(cadr_state_v2_rebuild(&machine->state) == CADR_STATUS_OK);
    CHECK(cadr_trace_engine_start(&machine->state, &trace) == CADR_STATUS_OK);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(result.clock_slots_completed == 1U);
    before = cadr_trace_engine_record_count(&machine->state);
    issue_write(machine, 1U, 1U, payload);
    CHECK(machine->state.events.request_payload_byte_count == sizeof(payload));
    CHECK(machine->state.events.outstanding_request_id == 1U);
    CHECK(cadr_trace_engine_record_count(&machine->state) == before + 1U);
    cadr_trace_engine_stop(&machine->state);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_zero_tick_delivery_snapshots_immutable_bytes();
    test_tick_delay_is_guest_time_only();
    test_malformed_and_truncated_ranges_fail_with_exact_payload();
    test_faults_and_wrong_image_identity_are_detectable();
    test_native_file_range_reader_is_exact_and_read_only();
    test_boot_scratch_overlay_commits_and_shadows_base();
    test_write_replay_is_idempotent();
    test_reset_races_and_targeted_faults();
    test_payload_write_is_traceable_before_publication();
    if (failures != 0) return 1;
    (void)puts("cadr_m4_block_service: ok");
    return 0;
}

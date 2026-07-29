#include "cadr_m4_block_service.h"
#include "cadr_machine.h"

#include <stdio.h>
#include <string.h>

static int failures;

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

static cadr_m4_block_service_config config_for(const uint8_t *image,
                                                uint64_t byte_count)
{
    cadr_m4_block_service_config config = {
        image, byte_count, byte_count, 0U,
        CADR_M4_BLOCK_SERVICE_BLOCK_BYTES, CADR_M4_BLOCK_FAULT_NONE
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
    uint32_t index;

    for (index = 0U; index < sizeof(image); ++index) image[index] = (uint8_t)index;
    if (machine == NULL) return;
    config = config_for(image, sizeof(image));
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

    if (machine == NULL) return;
    config = config_for(image, sizeof(image));
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
    uint32_t index;

    if (machine == NULL) return;
    config = config_for(image, sizeof(image));
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
    cadr_m4_block_service_config config = config_for(image, sizeof(image));
    cadr_m4_block_service_event event;

    if (machine == NULL) return;
    config.expected_image_byte_count += 1U;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_ARTIFACT_MISMATCH);
    config = config_for(image, sizeof(image));
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
    config = config_for(image, sizeof(image));
    config.fault_mask = CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE;
    CHECK(cadr_m4_block_service_init(&service, &config) == CADR_STATUS_OK);
    issue_read(machine, 0U, 1U, 1024U, 1024U);
    CHECK(cadr_m4_block_service_poll(&service, machine, 5U, &event) == CADR_STATUS_OK);
    CHECK(event.host_status == CADR_HOST_RESULT_OK);
    CHECK(machine->state.events.completion_bytes[0] == 1U);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_zero_tick_delivery_snapshots_immutable_bytes();
    test_tick_delay_is_guest_time_only();
    test_malformed_and_truncated_ranges_fail_with_exact_payload();
    test_faults_and_wrong_image_identity_are_detectable();
    if (failures != 0) return 1;
    (void)puts("cadr_m4_block_service: ok");
    return 0;
}

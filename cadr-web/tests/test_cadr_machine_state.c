#include "cadr_machine.h"
#include "cadr_host_api.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static cadr_machine_config config(void)
{
    cadr_machine_config value = {0};
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    value.profile = CADR_PROFILE_CADR_WEB_303;
    return value;
}

static cadr_host_request request(void)
{
    cadr_host_request value = {0};
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    return value;
}

static cadr_host_completion completion_from(const cadr_host_request *request_value)
{
    cadr_host_completion value = {0};
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    value.operation = request_value->operation;
    value.host_status = CADR_HOST_RESULT_OK;
    value.generation = request_value->generation;
    value.request_id = request_value->request_id;
    value.completion_byte_count = request_value->completion_byte_count;
    return value;
}

static cadr_run_request run_request(void)
{
    cadr_run_request value = {0};
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    value.clock_slot_budget = 1U;
    return value;
}

static cadr_run_result run_result(void)
{
    cadr_run_result value = {0};
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    return value;
}

static void test_descriptor_copy_backpressure_and_block_completion(void)
{
    cadr_machine *machine = NULL;
    cadr_machine_config machine_config = config();
    cadr_block_read_descriptor descriptor = { 7U, 2U, 256U };
    cadr_host_request host_request = request();
    cadr_host_completion completion;
    cadr_run_request run = run_request();
    cadr_run_result result = run_result();
    uint8_t copied[sizeof(descriptor)] = {0};
    uint8_t completion_bytes[512] = {0};
    cadr_block_read_descriptor copied_descriptor;

    CHECK(cadr_machine_create(&machine_config, &machine) == CADR_STATUS_OK);
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    CHECK(cadr_machine_issue_host_request(
              machine, CADR_HOST_OPERATION_BLOCK_READ,
              (const uint8_t *)&descriptor, sizeof(descriptor),
              sizeof(completion_bytes)) == CADR_STATUS_OK);
    descriptor.first_block = 99U;
    CHECK(cadr_machine_issue_host_request(
              machine, CADR_HOST_OPERATION_BLOCK_READ,
              (const uint8_t *)&descriptor, sizeof(descriptor),
              sizeof(completion_bytes)) == CADR_STATUS_WAITING_FOR_HOST);
    CHECK(cadr_machine_next_host_request(machine, &host_request, copied,
                                         sizeof(copied) - 1U) ==
          CADR_STATUS_WRONG_LENGTH);
    CHECK(cadr_machine_next_host_request(machine, &host_request, copied,
                                         sizeof(copied)) == CADR_STATUS_OK);
    memcpy(&copied_descriptor, copied, sizeof(copied_descriptor));
    CHECK(copied_descriptor.first_block == 7U);
    completion = completion_from(&host_request);
    CHECK(cadr_machine_complete_host_request(
              machine, &completion, completion_bytes,
              sizeof(completion_bytes)) == CADR_STATUS_OK);
    completion_bytes[0] = 1U;
    CHECK(machine->state.events.completion_bytes[0] == 0U);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(result.completions_applied == 1U);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    cadr_machine_destroy(machine);
}

static void test_two_machine_interleaving(void)
{
    cadr_machine *first = NULL;
    cadr_machine *second = NULL;
    cadr_machine_config machine_config = config();
    cadr_network_descriptor first_descriptor = { 1U, 4U };
    cadr_network_descriptor second_descriptor = { 2U, 8U };
    cadr_host_request first_request = request();
    cadr_host_request second_request = request();
    uint8_t first_copy[sizeof(first_descriptor)];
    uint8_t second_copy[sizeof(second_descriptor)];
    cadr_network_descriptor first_copied_descriptor;
    cadr_network_descriptor second_copied_descriptor;

    CHECK(cadr_machine_create(&machine_config, &first) == CADR_STATUS_OK);
    CHECK(cadr_machine_create(&machine_config, &second) == CADR_STATUS_OK);
    first->state.lifecycle = CADR_MACHINE_RUNNING;
    second->state.lifecycle = CADR_MACHINE_RUNNING;
    CHECK(cadr_machine_issue_host_request(
              first, CADR_HOST_OPERATION_NETWORK,
              (const uint8_t *)&first_descriptor, sizeof(first_descriptor), 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_issue_host_request(
              second, CADR_HOST_OPERATION_NETWORK,
              (const uint8_t *)&second_descriptor, sizeof(second_descriptor), 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_next_host_request(first, &first_request, first_copy,
                                         sizeof(first_copy)) == CADR_STATUS_OK);
    CHECK(cadr_machine_next_host_request(second, &second_request, second_copy,
                                         sizeof(second_copy)) == CADR_STATUS_OK);
    memcpy(&first_copied_descriptor, first_copy, sizeof(first_copied_descriptor));
    memcpy(&second_copied_descriptor, second_copy, sizeof(second_copied_descriptor));
    CHECK(first_copied_descriptor.frame_sequence == 1U);
    CHECK(second_copied_descriptor.frame_sequence == 2U);
    CHECK(first_request.request_id == 1U);
    CHECK(second_request.request_id == 1U);
    cadr_machine_destroy(first);
    cadr_machine_destroy(second);
}

static void test_reset_preserves_machine_cycles(void)
{
    cadr_machine *machine = NULL;
    cadr_machine_config machine_config = config();
    cadr_reset_request reset = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_reset_request), 0U
    };
    CHECK(cadr_machine_create(&machine_config, &machine) == CADR_STATUS_OK);
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    machine->state.clock_slots_completed = 123U;
    machine->state.cpu.microinstructions_executed = 99U;
    CHECK(cadr_machine_reset(machine, &reset) == CADR_STATUS_OK);
    CHECK(machine->state.clock_slots_completed == 123U);
    CHECK(machine->state.cpu.microinstructions_executed == 99U);
    CHECK(machine->state.lifecycle == CADR_MACHINE_POWERED);
    cadr_machine_destroy(machine);
}

static void test_known_reserved_fields_reject_without_mutation(void)
{
    cadr_machine *machine = NULL;
    cadr_machine_config machine_config = config();
    cadr_run_request run = run_request();
    cadr_run_result result = run_result();
    cadr_run_result result_before;
    cadr_network_descriptor descriptor = { 1U, 4U };
    cadr_host_request host_request = request();
    cadr_host_completion completion;
    cadr_machine_state *state_before;
    uint64_t generation_before;
    uint64_t request_before;
    uint32_t queued_before;

    CHECK(cadr_machine_create(&machine_config, &machine) == CADR_STATUS_OK);
    state_before = malloc(sizeof(*state_before));
    CHECK(state_before != NULL);
    if (state_before == NULL) {
        cadr_machine_destroy(machine);
        return;
    }
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    generation_before = machine->state.events.generation;
    request_before = machine->state.events.outstanding_request_id;
    queued_before = machine->state.events.completion_queued;
    *state_before = machine->state;
    run.reserved0 = 1U;
    result_before = result;
    CHECK(cadr_machine_run(machine, &run, &result) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&result, &result_before, sizeof(result)) == 0);
    CHECK(machine->state.events.generation == generation_before);
    CHECK(machine->state.events.outstanding_request_id == request_before);
    CHECK(machine->state.events.completion_queued == queued_before);
    CHECK(memcmp(&machine->state, state_before, sizeof(*state_before)) == 0);

    CHECK(cadr_machine_issue_host_request(
              machine, CADR_HOST_OPERATION_NETWORK,
              (const uint8_t *)&descriptor, sizeof(descriptor), 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_next_host_request(
              machine, &host_request, (uint8_t *)&descriptor,
              sizeof(descriptor)) ==
          CADR_STATUS_OK);
    completion = completion_from(&host_request);
    completion.reserved0 = 1U;
    generation_before = machine->state.events.generation;
    request_before = machine->state.events.outstanding_request_id;
    queued_before = machine->state.events.completion_queued;
    *state_before = machine->state;
    CHECK(cadr_machine_complete_host_request(machine, &completion, NULL, 0U) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(machine->state.in_host_completion == 0U);
    CHECK(machine->state.events.generation == generation_before);
    CHECK(machine->state.events.outstanding_request_id == request_before);
    CHECK(machine->state.events.completion_queued == queued_before);
    CHECK(machine->state.events.completion_bytes == NULL);
    CHECK(memcmp(&machine->state, state_before, sizeof(*state_before)) == 0);
    free(state_before);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_descriptor_copy_backpressure_and_block_completion();
    test_two_machine_interleaving();
    test_reset_preserves_machine_cycles();
    test_known_reserved_fields_reject_without_mutation();
    if (failures != 0) return 1;
    (void)puts("cadr_machine_state: ok");
    return 0;
}

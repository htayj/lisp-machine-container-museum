#include "cadr_boundary_state.h"
#include "cadr_machine.h"
#include "cadr_host_api.h"

#include <stdio.h>
#include <string.h>

static int failures;

static const uint8_t trace_profile_sha256[CADR_SHA256_BYTES] = {
    0x1bU,0x8dU,0x63U,0xdbU,0x98U,0xacU,0xd4U,0x6eU,
    0x40U,0xadU,0xf9U,0x9aU,0x8aU,0x3cU,0xebU,0x5eU,
    0x05U,0x58U,0xd4U,0xacU,0x02U,0x7cU,0xb2U,0xcbU,
    0x4aU,0x43U,0x96U,0x65U,0xb1U,0x4bU,0x5dU,0x2aU
};
static const uint8_t trace_artifact_sha256[CADR_SHA256_BYTES] = {
    0xe9U,0x6eU,0x6fU,0xf9U,0x03U,0xc2U,0x3cU,0xceU,
    0xa7U,0x07U,0xecU,0xe0U,0xe9U,0xa8U,0x72U,0xa8U,
    0xa7U,0x77U,0x71U,0xa6U,0x66U,0x3eU,0x3bU,0x91U,
    0x9eU,0xabU,0xa2U,0x1eU,0x22U,0xf2U,0xf9U,0x41U
};

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static void digest_hex(const uint8_t digest[CADR_SHA256_BYTES], char output[65])
{
    uint32_t index;
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        (void)snprintf(output + index * 2U, 3U, "%02x", digest[index]);
    }
}

static cadr_machine *synthetic_machine(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine != NULL) {
        machine->state.artifacts.boot_configuration_ingressed = 1U;
        machine->state.artifacts.control_store_ingressed = 1U;
        machine->state.artifacts.base_disk_verified = 1U;
        CHECK(cadr_machine_cold_power_on(machine) == CADR_STATUS_OK);
        CHECK(cadr_machine_boot(machine) == CADR_STATUS_OK);
    }
    return machine;
}

static cadr_run_result run_slots(cadr_machine *machine, uint64_t slots)
{
    cadr_run_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_request), 0U, slots
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    CHECK(cadr_machine_run(machine, &request, &result) == CADR_STATUS_OK);
    return result;
}

static void test_clock_slots_and_interleaving(void)
{
    cadr_machine *first = synthetic_machine();
    cadr_machine *second = synthetic_machine();
    cadr_boundary_state first_boundary;
    cadr_boundary_state second_boundary;
    uint8_t first_digest[CADR_SHA256_BYTES];
    uint8_t second_digest[CADR_SHA256_BYTES];
    char digest_text[65];
    cadr_run_result result;
    uint32_t index;

    if (first == NULL || second == NULL) return;
    CHECK(cadr_machine_boundary_digest(first, first_digest) ==
          CADR_STATUS_OK);
    digest_hex(first_digest, digest_text);
    CHECK(strcmp(
              digest_text,
              "850fa86fd4c235b7f5d016e6d56dc689"
              "5595851c1ac6d0603315263377cdd995") == 0);
    result = run_slots(first, 1U);
    CHECK(result.clock_slots_completed == 1U);
    CHECK(result.microinstructions_executed == 0U);
    CHECK(cadr_machine_boundary_state(first, &first_boundary) ==
          CADR_STATUS_OK);
    CHECK(first_boundary.trace_decoded == 0U);
    CHECK(first_boundary.flags == CADR_BOUNDARY_INHIBITED);
    result = run_slots(first, 1U);
    CHECK(result.microinstructions_executed == 1U);
    CHECK(cadr_machine_boundary_state(first, &first_boundary) ==
          CADR_STATUS_OK);
    CHECK(first_boundary.trace_decoded == 1U);
    CHECK(first_boundary.trace_pc == first_boundary.p0_pc);
    for (index = 0U; index < 64U; ++index) {
        (void)run_slots(first, 1U);
        (void)run_slots(second, 1U);
    }
    (void)run_slots(second, 2U);
    CHECK(cadr_machine_boundary_state(first, &first_boundary) == CADR_STATUS_OK);
    CHECK(cadr_machine_boundary_state(second, &second_boundary) == CADR_STATUS_OK);
    CHECK(memcmp(&first_boundary, &second_boundary, sizeof(first_boundary)) == 0);
    CHECK(cadr_machine_boundary_digest(first, first_digest) == CADR_STATUS_OK);
    CHECK(cadr_machine_boundary_digest(second, second_digest) == CADR_STATUS_OK);
    CHECK(memcmp(first_digest, second_digest, sizeof(first_digest)) == 0);
    CHECK(first->state.events.outstanding_request_id == 0U);
    CHECK(first->state.events.unexpected_bus_operation == 0U);
    cadr_machine_destroy(first);
    cadr_machine_destroy(second);
}

static void test_run_budget_overflow_is_fail_closed(void)
{
    cadr_machine *machine = synthetic_machine();
    cadr_run_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    if (machine == NULL) return;
    machine->state.clock_slots_completed = UINT64_MAX;
    CHECK(cadr_machine_run(machine, &request, &result) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(machine->state.clock_slots_completed == UINT64_MAX);
    machine->state.clock_slots_completed = 0U;
    machine->state.cpu.microinstructions_executed = UINT64_MAX;
    CHECK(cadr_machine_run(machine, &request, &result) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(machine->state.cpu.microinstructions_executed == UINT64_MAX);
    cadr_machine_destroy(machine);
}

static void test_streaming_ingress_fail_closed(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR, (uint32_t)sizeof(cadr_machine_config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_artifact_ingress ingress = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR, (uint32_t)sizeof(cadr_artifact_ingress),
        CADR_ARTIFACT_BASE_DISK, UINT64_C(269562880)
    };
    cadr_snapshot_request snapshot = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    cadr_machine *machine = NULL;
    uint64_t snapshot_size = UINT64_C(99);
    uint8_t byte = 0U;
    cadr_trace_config trace = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(cadr_trace_config),
        0U, 0U, CADR_TRACE_SELECTOR_KNOWN, CADR_TRACE_EVENT_KNOWN,
        8U, CADR_TRACE_TRANSPORT_FULL, 0U, 0U, {0}, {0}, {0}
    };

    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine == NULL) return;
    ingress.abi_minor = CADR_ABI_MINOR_M2;
    CHECK(cadr_machine_import_artifact_stream_begin(machine, &ingress) ==
          CADR_STATUS_ABI_MISMATCH);
    ingress.abi_minor = CADR_ABI_MINOR;
    CHECK(cadr_machine_import_artifact_stream_begin(machine, &ingress) == CADR_STATUS_OK);
    (void)memcpy(trace.profile_sha256, trace_profile_sha256, CADR_SHA256_BYTES);
    (void)memcpy(trace.artifact_set_sha256, trace_artifact_sha256, CADR_SHA256_BYTES);
    CHECK(cadr_machine_import_artifact_stream_chunk(machine, 0U, NULL, 0U) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(machine->state.artifacts.stream_active == 0U);
    CHECK(machine->state.artifacts.base_disk_verified == 0U);
    CHECK(cadr_machine_import_artifact_stream_begin(machine, &ingress) == CADR_STATUS_OK);
    /* One-shot ingress and snapshots cannot observe/commit a partial stream. */
    CHECK(cadr_machine_import_artifact(machine, &ingress, &byte, 1U) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_machine_snapshot_size(machine, &snapshot, &snapshot_size) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(snapshot_size == 0U);
    CHECK(cadr_machine_trace_start(machine, &trace) == CADR_STATUS_NOT_READY);
    CHECK(cadr_machine_import_artifact_stream_chunk(machine, 1U, &byte, 1U) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(machine->state.artifacts.stream_active == 0U);
    CHECK(machine->state.artifacts.base_disk_verified == 0U);
    /* A bad interleaving clears scratch and permits a fresh, independent retry. */
    CHECK(cadr_machine_import_artifact_stream_begin(machine, &ingress) == CADR_STATUS_OK);
    CHECK(cadr_machine_import_artifact_stream_finish(machine) == CADR_STATUS_WRONG_LENGTH);
    CHECK(machine->state.artifacts.stream_active == 0U);
    CHECK(machine->state.artifacts.base_disk_verified == 0U);
    cadr_machine_destroy(machine);
}

static void test_mutation_ordinal_overflow_is_fail_closed(void)
{
    cadr_machine *machine = synthetic_machine();
    if (machine == NULL) return;
    machine->state.canonical.mutation_ordinal = UINT64_MAX;
    machine->state.canonical.mutation_count = 0U;
    machine->state.canonical.overflowed = 0U;
    cadr_canonical_write_u32(&machine->state, 2U, 0U, 0U, 1U);
    CHECK(machine->state.canonical.mutation_ordinal == UINT64_MAX);
    CHECK(machine->state.canonical.mutation_count == 0U);
    CHECK(machine->state.canonical.overflowed == 1U);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_clock_slots_and_interleaving();
    test_run_budget_overflow_is_fail_closed();
    test_streaming_ingress_fail_closed();
    test_mutation_ordinal_overflow_is_fail_closed();
    if (failures != 0) return 1;
    (void)puts("cadr_core_integration: ok");
    return 0;
}

#include "cadr_boundary_state.h"
#include "cadr_machine.h"
#include "cadr_host_api.h"

#include <stdio.h>
#include <string.h>

static int failures;

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

static void test_m1_prefix_limit_is_fail_closed(void)
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
    machine->state.clock_slots_completed = UINT64_C(100000);
    CHECK(cadr_machine_run(machine, &request, &result) ==
          CADR_STATUS_INVALID_ARGUMENT);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_clock_slots_and_interleaving();
    test_m1_prefix_limit_is_fail_closed();
    if (failures != 0) return 1;
    (void)puts("cadr_core_integration: ok");
    return 0;
}

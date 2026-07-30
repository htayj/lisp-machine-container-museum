#include "cadr_bus_device.h"
#include "cadr_machine.h"
#include "cadr_m6_fast_run.h"
#include "cadr_state_v2.h"

#include <stdio.h>
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
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M6, (uint32_t)sizeof(cadr_machine_config),
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
        machine->state.canonical.initialized = 1U;
        CHECK(cadr_state_v2_rebuild(&machine->state) == CADR_STATUS_OK);
    }
    return machine;
}

static void partial_write_hook(cadr_machine *machine, uint64_t completed_slots)
{
    if (completed_slots == 1U) {
        CHECK(cadr_diagnostic_write(&machine->state, 0766000U,
                                    UINT16_C(0x4d36)) == CADR_STATUS_OK);
    }
}

static void wait_hook(cadr_machine *machine, uint64_t completed_slots)
{
    if (completed_slots == 1U) {
        machine->state.events.outstanding_request_id = UINT64_C(7);
        machine->state.events.completion_queued = 0U;
    }
}

static void wait_and_debug_hook(cadr_machine *machine, uint64_t completed_slots)
{
    if (completed_slots == 1U) {
        CHECK(cadr_diagnostic_write(&machine->state, 0766000U,
                                    UINT16_C(0x4d36)) == CADR_STATUS_OK);
        machine->state.events.outstanding_request_id = UINT64_C(9);
        machine->state.events.completion_queued = 0U;
    }
}

static void fatal_and_debug_hook(cadr_machine *machine, uint64_t completed_slots)
{
    if (completed_slots == 1U) {
        CHECK(cadr_diagnostic_write(&machine->state, 0766002U,
                                    UINT16_C(0x4131)) == CADR_STATUS_OK);
        machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
        machine->state.lifecycle = CADR_MACHINE_GUEST_FAULTED;
    }
}

static void test_bounds_endpoint_and_record(void)
{
    cadr_machine *machine = running_machine();
    cadr_m6_fast_run_result result;
    uint8_t bytes[CADR_M6_FAST_RUN_RECORD_BYTES];
    if (machine == NULL) return;
    CHECK(cadr_m6_fast_run(machine, 0U, &result) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m6_fast_run(machine, CADR_M6_FAST_RUN_MAX_SLOTS + 1U, &result) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m6_fast_run(machine, 3U, &result) == CADR_STATUS_OK);
    CHECK(result.reason == CADR_M6_FAST_RUN_REASON_ENDPOINT);
    CHECK(result.status == CADR_STATUS_OK);
    CHECK(result.requested_slots == 3U);
    CHECK(result.completed_slots == 3U);
    CHECK(result.post_boundary - result.pre_boundary == 3U);
    CHECK(cadr_m6_fast_run_serialize(&result, bytes) == CADR_STATUS_OK);
    CHECK(memcmp(bytes, "CDRM6FAST1", 10U) == 0);
    CHECK(bytes[10] == 0U && bytes[11] == 0U && bytes[12] == 0U && bytes[13] == 0U);
    CHECK(bytes[104] == 0U && bytes[127] == 0U);
    cadr_machine_destroy(machine);
}

static void test_partial_debug_stops_at_first_slot(void)
{
    cadr_machine *machine = running_machine();
    cadr_m6_fast_run_result result;
    if (machine == NULL) return;
    cadr_m6_fast_run_test_set_hook(partial_write_hook);
    CHECK(cadr_m6_fast_run(machine, 4U, &result) == CADR_STATUS_OK);
    CHECK(result.reason == CADR_M6_FAST_RUN_REASON_DEBUG_CHANGED);
    CHECK(result.status == CADR_STATUS_OK);
    CHECK(result.completed_slots == 1U);
    CHECK(result.post_boundary - result.pre_boundary == 1U);
    CHECK(result.debug_before == 0U);
    CHECK(result.debug_after == UINT64_C(0x4d36));
    cadr_m6_fast_run_test_set_hook(NULL);
    cadr_machine_destroy(machine);
}

static void test_wait_and_fatal_priority(void)
{
    cadr_machine *machine = running_machine();
    cadr_m6_fast_run_result result;
    if (machine == NULL) return;
    cadr_m6_fast_run_test_set_hook(wait_hook);
    CHECK(cadr_m6_fast_run(machine, 4U, &result) == CADR_STATUS_OK);
    CHECK(result.reason == CADR_M6_FAST_RUN_REASON_WAITING_FOR_HOST);
    CHECK(result.status == CADR_STATUS_WAITING_FOR_HOST);
    CHECK(result.completed_slots == 1U);
    CHECK(result.outstanding_request_id == UINT64_C(7));
    cadr_m6_fast_run_test_set_hook(NULL);
    cadr_machine_destroy(machine);

    machine = running_machine();
    if (machine == NULL) return;
    cadr_m6_fast_run_test_set_hook(wait_and_debug_hook);
    CHECK(cadr_m6_fast_run(machine, 4U, &result) == CADR_STATUS_OK);
    CHECK(result.reason == CADR_M6_FAST_RUN_REASON_WAITING_FOR_HOST);
    CHECK(result.status == CADR_STATUS_WAITING_FOR_HOST);
    CHECK(result.completed_slots == 1U);
    CHECK(result.debug_before == 0U);
    CHECK(result.debug_after == UINT64_C(0x4d36));
    CHECK(result.outstanding_request_id == UINT64_C(9));
    cadr_m6_fast_run_test_set_hook(NULL);
    cadr_machine_destroy(machine);

    machine = running_machine();
    if (machine == NULL) return;
    cadr_m6_fast_run_test_set_hook(fatal_and_debug_hook);
    CHECK(cadr_m6_fast_run(machine, 4U, &result) == CADR_STATUS_OK);
    CHECK(result.reason == CADR_M6_FAST_RUN_REASON_FATAL);
    CHECK(result.status == CADR_STATUS_GUEST_FAULT);
    CHECK(result.completed_slots == 1U);
    CHECK(result.debug_after == UINT64_C(0x41310000));
    cadr_m6_fast_run_test_set_hook(NULL);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_bounds_endpoint_and_record();
    test_partial_debug_stops_at_first_slot();
    test_wait_and_fatal_priority();
    if (failures != 0) return 1;
    (void)puts("cadr_m6_fast_run: ok");
    return 0;
}

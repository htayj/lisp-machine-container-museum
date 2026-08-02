#include "cadr_m12_machine_adapter.h"

#include <stdio.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        ++failures; \
    } \
} while (0)

static cadr_machine *fresh_running_machine(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;

    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine != NULL) {
        /* The adapter's boundary contract is independent of a boot-media
         * campaign.  This isolated, all-zero test machine has no pending host
         * work and exercises exactly one portable outer-slot callback. */
        machine->state.lifecycle = CADR_MACHINE_RUNNING;
        machine->state.cpu.p1_pc = UINT32_C(0123);
        machine->state.cpu.location_counter = UINT32_C(0456);
    }
    return machine;
}

static void test_breakpoint_prevents_execution(void)
{
    cadr_machine *machine = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_breakpoint breakpoint = {
        1U, CADR_M12_BREAKPOINT_MICRO_PC_BEFORE, UINT64_C(0123)
    };
    cadr_m12_inspector_lease lease;
    uint32_t value = 0U;
    uint8_t stop[CADR_M12_STOP_BYTES];

    (void)memset(&adapter, 0, sizeof(adapter));
    if (machine == NULL) return;
    machine->state.cpu.a_memory[7] = UINT32_C(0x10203040);
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, machine) == CADR_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_breakpoint_set(&adapter, 4U, &breakpoint) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_micro_step(&adapter) == CADR_M12_STATUS_DEBUG_STOP);
    CHECK(machine->state.clock_slots_completed == 0U);
    CHECK(cadr_m12_machine_adapter_stop_copy(&adapter, stop) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_stop_decode(stop, &adapter.debugger.last_stop) == CADR_M12_STATUS_OK);
    CHECK(adapter.debugger.last_stop.reason == CADR_M12_STOP_BREAKPOINT);
    CHECK(adapter.debugger.last_stop.breakpoint_index == 4U);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &lease) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &lease,
                                        CADR_M12_ARRAY_A_MEMORY, 7U, &value) ==
          CADR_M12_STATUS_OK);
    CHECK(value == UINT32_C(0x10203040));
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(machine);
}

static void test_micro_step_runs_one_slot_and_stales_inspection(void)
{
    cadr_machine *machine = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_inspector_lease lease;
    uint64_t before_clock;

    (void)memset(&adapter, 0, sizeof(adapter));
    if (machine == NULL) return;
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, machine) == CADR_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &lease) == CADR_M12_STATUS_OK);
    before_clock = machine->state.clock_slots_completed;
    CHECK(cadr_m12_machine_adapter_micro_step(&adapter) == CADR_M12_STATUS_OK);
    CHECK(machine->state.clock_slots_completed == before_clock + UINT64_C(1));
    CHECK(adapter.debugger.clock_slots_completed == machine->state.clock_slots_completed);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &lease,
                                        CADR_M12_ARRAY_M_MEMORY, 0U,
                                        &machine->state.cpu.m_memory[0]) ==
          CADR_M12_STATUS_STALE_GENERATION);
    /* An arbitrary micro-PC is not silently treated as a macro boundary. */
    CHECK(cadr_m12_machine_adapter_macro_step(&adapter) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(machine);
}

static void test_rebind_invalidates_leases(void)
{
    cadr_machine *first = fresh_running_machine();
    cadr_machine *second = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_inspector_lease old_lease;
    cadr_m12_inspector_lease new_lease;
    uint32_t value = 0U;

    (void)memset(&adapter, 0, sizeof(adapter));
    if (first == NULL || second == NULL) {
        cadr_machine_destroy(first);
        cadr_machine_destroy(second);
        return;
    }
    second->state.cpu.m_memory[3] = UINT32_C(0x55667788);
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, first) == CADR_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &old_lease) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_rebind(&adapter, second) == CADR_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &old_lease,
                                        CADR_M12_ARRAY_M_MEMORY, 3U, &value) ==
          CADR_M12_STATUS_STALE_GENERATION);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &new_lease) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &new_lease,
                                        CADR_M12_ARRAY_M_MEMORY, 3U, &value) ==
          CADR_M12_STATUS_OK);
    CHECK(value == UINT32_C(0x55667788));
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(first);
    cadr_machine_destroy(second);
}

static void test_public_system_303_macro_entry_is_not_inferred(void)
{
    cadr_machine *machine = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_breakpoint breakpoint = {
        1U, CADR_M12_BREAKPOINT_MICRO_PC_BEFORE, UINT64_C(0164)
    };

    (void)memset(&adapter, 0, sizeof(adapter));
    if (machine == NULL) return;
    /* QMLP is the System 303 source-defined normal macro fetch loop.  A
     * before breakpoint proves macro-step accepted that explicit source
     * boundary without executing the unbooted synthetic machine. */
    machine->state.cpu.p1_pc = UINT32_C(0164);
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, machine) == CADR_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_breakpoint_set(&adapter, 1U, &breakpoint) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_macro_step(&adapter) == CADR_M12_STATUS_DEBUG_STOP);
    CHECK(adapter.debugger.last_stop.breakpoint_index == 1U &&
          adapter.debugger.last_stop.micro_pc_before == UINT32_C(0164));
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(machine);
}

static void test_pointer_free_configuration_snapshot(void)
{
    cadr_machine *machine = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_breakpoint breakpoint = {
        1U, CADR_M12_BREAKPOINT_RAW_LC_BEFORE, UINT64_C(0456)
    };
    uint8_t snapshot[CADR_M12_CONFIG_SNAPSHOT_BYTES];

    (void)memset(&adapter, 0, sizeof(adapter));
    if (machine == NULL) return;
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, machine) == CADR_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_breakpoint_set(&adapter, 5U, &breakpoint) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_config_snapshot_serialize(&adapter, snapshot) ==
          CADR_STATUS_OK);
    CHECK(memcmp(snapshot, "CDRM12C1", 8U) == 0);
    CHECK(cadr_m12_machine_adapter_breakpoint_clear(&adapter, 5U) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_config_snapshot_restore(&adapter, snapshot) ==
          CADR_STATUS_OK && adapter.debugger.breakpoints[5].enabled == 1U &&
          adapter.debugger.breakpoints[5].value == UINT64_C(0456));
    snapshot[60] = 1U;
    CHECK(cadr_m12_machine_adapter_config_snapshot_restore(&adapter, snapshot) ==
          CADR_STATUS_INVALID_ARGUMENT && adapter.debugger.breakpoints[5].enabled == 1U);
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(machine);
}

static void test_installed_trace_filter_is_copied_and_applied(void)
{
    cadr_machine *machine = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_trace_filter filter = {
        CADR_M12_TRACE_FILTER_MICRO_PC | CADR_M12_TRACE_FILTER_CLOCK_RANGE |
            CADR_M12_TRACE_FILTER_FAULT,
        UINT32_C(0123), UINT64_C(3), UINT64_C(5)
    };
    cadr_m12_trace_record matching = { UINT64_C(4), UINT32_C(0123), 1U, 0U };
    cadr_m12_trace_record other_pc = { UINT64_C(4), UINT32_C(0124), 1U, 0U };

    (void)memset(&adapter, 0, sizeof(adapter));
    if (machine == NULL) return;
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, machine) == CADR_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_trace_filter_matches(&adapter, &matching) == 0);
    CHECK(cadr_m12_machine_adapter_trace_filter(&adapter, &filter) == CADR_M12_STATUS_OK);
    /* Caller mutation cannot change the installed copy. */
    filter.micro_pc = UINT32_C(0777);
    CHECK(cadr_m12_machine_adapter_trace_filter_matches(&adapter, &matching) != 0);
    CHECK(cadr_m12_machine_adapter_trace_filter_matches(&adapter, &other_pc) == 0);
    filter.first_clock_slot = UINT64_C(9);
    filter.last_clock_slot = UINT64_C(8);
    CHECK(cadr_m12_machine_adapter_trace_filter(&adapter, &filter) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m12_machine_adapter_trace_filter_matches(&adapter, &matching) != 0);
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(machine);
}

static void test_atomic_rebind_with_configuration_snapshot(void)
{
    cadr_machine *first = fresh_running_machine();
    cadr_machine *second = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_breakpoint breakpoint = {
        1U, CADR_M12_BREAKPOINT_RAW_LC_BEFORE, UINT64_C(0456)
    };
    cadr_m12_inspector_lease old_lease;
    cadr_m12_inspector_lease final_lease;
    cadr_m12_machine_adapter adapter_before;
    uint8_t snapshot[CADR_M12_CONFIG_SNAPSHOT_BYTES];
    uint32_t value = 0U;

    (void)memset(&adapter, 0, sizeof(adapter));
    if (first == NULL || second == NULL) {
        cadr_machine_destroy(first);
        cadr_machine_destroy(second);
        return;
    }
    first->state.cpu.a_memory[2] = UINT32_C(0x11111111);
    second->state.cpu.a_memory[2] = UINT32_C(0x22222222);
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, first) == CADR_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_breakpoint_set(&adapter, 7U, &breakpoint) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_machine_adapter_config_snapshot_serialize(&adapter, snapshot) ==
          CADR_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &old_lease) ==
          CADR_M12_STATUS_OK);

    adapter.domain.next_incarnation = UINT64_MAX;
    CHECK(cadr_m12_machine_adapter_rebind_config_snapshot(
              &adapter, second, snapshot) ==
          CADR_M12_STATUS_INCARNATION_EXHAUSTED);
    CHECK(adapter.machine == first);
    CHECK(cadr_m12_inspector_lease_read(
              &adapter.debugger, &old_lease, CADR_M12_ARRAY_A_MEMORY, 2U,
              &value) == CADR_M12_STATUS_OK && value == UINT32_C(0x11111111));
    adapter.domain.next_incarnation = UINT64_MAX - UINT64_C(1);

    snapshot[60] = 1U;
    CHECK(cadr_m12_machine_adapter_rebind_config_snapshot(
              &adapter, second, snapshot) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(adapter.machine == first);
    CHECK(cadr_m12_inspector_lease_read(
              &adapter.debugger, &old_lease, CADR_M12_ARRAY_A_MEMORY, 2U,
              &value) == CADR_M12_STATUS_OK && value == UINT32_C(0x11111111));

    snapshot[60] = 0U;
    CHECK(cadr_m12_machine_adapter_rebind_config_snapshot(
              &adapter, second, snapshot) == CADR_STATUS_OK);
    CHECK(adapter.machine == second && adapter.debugger.breakpoints[7].enabled == 1U);
    CHECK(adapter.inspector_owner.incarnation == UINT64_MAX - UINT64_C(1) &&
          adapter.domain.next_incarnation == UINT64_MAX);
    CHECK(cadr_m12_inspector_lease_read(
              &adapter.debugger, &old_lease, CADR_M12_ARRAY_A_MEMORY, 2U,
              &value) == CADR_M12_STATUS_STALE_GENERATION);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &final_lease) ==
          CADR_M12_STATUS_OK);

    /* UINT64_MAX-1 is issued exactly once.  Its successor is the unissued
     * exhaustion sentinel, and the immediately following attempt cannot
     * retire that owner or invalidate its lease. */
    (void)memcpy(&adapter_before, &adapter, sizeof(adapter_before));
    CHECK(cadr_m12_machine_adapter_rebind(&adapter, first) ==
          CADR_M12_STATUS_INCARNATION_EXHAUSTED);
    CHECK(memcmp(&adapter, &adapter_before, sizeof(adapter)) == 0);
    CHECK(cadr_m12_inspector_lease_read(
              &adapter.debugger, &final_lease, CADR_M12_ARRAY_A_MEMORY, 2U,
              &value) == CADR_M12_STATUS_OK && value == UINT32_C(0x22222222));
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(first);
    cadr_machine_destroy(second);
}

/* The M12 identity tuple is deliberately process-local and pointer-bearing.
 * Stable-address reuse retains one monotonic domain sequence, so even an
 * adversarial old-lease read after a new owner is installed must stay stale. */
static void test_adapter_lifetime_reuse_copy_and_exhaustion(void)
{
    cadr_machine *first = fresh_running_machine();
    cadr_machine *second = fresh_running_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_machine_adapter copied;
    cadr_m12_machine_adapter adapter_before;
    cadr_m12_inspector_lease first_lease;
    cadr_m12_inspector_lease second_lease;
    uint8_t snapshot[CADR_M12_CONFIG_SNAPSHOT_BYTES];
    uint32_t value = 0U;
    uint64_t first_generation;
    uint64_t next_incarnation;

    (void)memset(&adapter, 0, sizeof(adapter));
    if (first == NULL || second == NULL) {
        cadr_machine_destroy(first);
        cadr_machine_destroy(second);
        return;
    }
    first->state.cpu.a_memory[4U] = UINT32_C(0x11112222);
    second->state.cpu.a_memory[4U] = UINT32_C(0x33334444);
    /* A failed initial-boundary check is a nonmutating preflight.  The exact
     * same semantically virgin storage remains usable after correction. */
    first_generation = first->state.events.generation;
    (void)memcpy(&adapter_before, &adapter, sizeof(adapter_before));
    first->state.events.generation = 0U;
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, first) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&adapter, &adapter_before, sizeof(adapter)) == 0);
    first->state.events.generation = first_generation;
    CHECK(second->state.events.generation == first_generation);
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, first) == CADR_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &first_lease) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &first_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 4U, &value) ==
          CADR_M12_STATUS_OK && value == UINT32_C(0x11112222));

    /* A byte copy must not make its copied machine or owner routes usable. */
    (void)memcpy(&copied, &adapter, sizeof(copied));
    CHECK(cadr_m12_machine_adapter_config_snapshot_serialize(&copied, snapshot) ==
          CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m12_machine_adapter_trace_filter_matches(&copied, NULL) == 0);
    cadr_m12_machine_adapter_destroy(&copied);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &first_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 4U, &value) ==
          CADR_M12_STATUS_OK && value == UINT32_C(0x11112222));

    /* Rebinding has a no-mutation exhaustion preflight.  In particular the
     * old owner remains registered and its live lease remains readable. */
    next_incarnation = adapter.domain.next_incarnation;
    adapter.domain.next_incarnation = UINT64_MAX;
    (void)memcpy(&adapter_before, &adapter, sizeof(adapter_before));
    CHECK(cadr_m12_machine_adapter_rebind(&adapter, second) ==
          CADR_M12_STATUS_INCARNATION_EXHAUSTED);
    CHECK(memcmp(&adapter, &adapter_before, sizeof(adapter)) == 0);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &first_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 4U, &value) ==
          CADR_M12_STATUS_OK && value == UINT32_C(0x11112222));
    adapter.domain.next_incarnation = next_incarnation;

    cadr_m12_machine_adapter_destroy(&adapter);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &first_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 4U, &value) ==
          CADR_M12_STATUS_STALE_GENERATION);

    /* A destroyed adapter also preserves exhaustion as a nonmutating result. */
    adapter.domain.next_incarnation = UINT64_MAX;
    (void)memcpy(&adapter_before, &adapter, sizeof(adapter_before));
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, second) ==
          CADR_M12_STATUS_INCARNATION_EXHAUSTED);
    CHECK(memcmp(&adapter, &adapter_before, sizeof(adapter)) == 0);
    adapter.domain.next_incarnation = next_incarnation;

    /* This is legal reuse at the exact same adapter address after teardown. */
    CHECK(cadr_m12_machine_adapter_initialize(&adapter, second) == CADR_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&adapter.debugger, &second_lease) ==
          CADR_M12_STATUS_OK);
    CHECK(second_lease.debugger_token == first_lease.debugger_token &&
          second_lease.owner_token == first_lease.owner_token &&
          second_lease.generation == first_lease.generation &&
          second_lease.owner_incarnation > first_lease.owner_incarnation);
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &second_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 4U, &value) ==
          CADR_M12_STATUS_OK && value == UINT32_C(0x33334444));
    CHECK(cadr_m12_inspector_lease_read(&adapter.debugger, &first_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 4U, &value) ==
          CADR_M12_STATUS_STALE_GENERATION);
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(first);
    cadr_machine_destroy(second);
}

int main(void)
{
    test_breakpoint_prevents_execution();
    test_micro_step_runs_one_slot_and_stales_inspection();
    test_rebind_invalidates_leases();
    test_public_system_303_macro_entry_is_not_inferred();
    test_pointer_free_configuration_snapshot();
    test_installed_trace_filter_is_copied_and_applied();
    test_atomic_rebind_with_configuration_snapshot();
    test_adapter_lifetime_reuse_copy_and_exhaustion();
    return failures == 0 ? 0 : 1;
}

#include "cadr_m12_machine_adapter.h"

#include <string.h>

/* SHA-256("CADR-WEB-303/ABI1.10/protocol-v7/C-M12-DBG-v1"). */
static const uint8_t cadr_m12_profile_sha256[CADR_M12_SHA256_BYTES] = {
    0x8cU,0x0eU,0xf8U,0x55U,0x05U,0x48U,0x5aU,0xacU,
    0xfdU,0xbfU,0x42U,0xd4U,0xefU,0xefU,0x41U,0x6eU,
    0x7aU,0x4cU,0x09U,0x64U,0xfbU,0xc5U,0x90U,0x37U,
    0xd2U,0x34U,0xb4U,0xe4U,0x99U,0xb9U,0xf1U,0xa0U
};

static cadr_m12_boundary cadr_m12_machine_boundary(const cadr_machine *machine)
{
    cadr_m12_boundary boundary = { 0U, 0U, 0U, 0U };
    if (machine != NULL) {
        boundary.micro_pc = machine->state.cpu.p1_pc;
        boundary.raw_lc = machine->state.cpu.location_counter;
        boundary.fault = machine->state.cpu.guest_fault != 0U ? 1U : 0U;
        boundary.device_request =
            machine->state.events.outstanding_request_id != 0U &&
            machine->state.events.completion_queued == 0U ? 1U : 0U;
    }
    return boundary;
}

static int cadr_m12_adapter_valid(const cadr_m12_machine_adapter *adapter)
{
    return adapter != NULL && adapter->initialized == 1U &&
        adapter->reserved0 == 0U && adapter->machine != NULL;
}

static void cadr_m12_put32(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void cadr_m12_put64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
}

static uint32_t cadr_m12_get32(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
        ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t cadr_m12_get64(const uint8_t *bytes)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) value |= (uint64_t)bytes[index] << (index * 8U);
    return value;
}

static int cadr_m12_snapshot_breakpoint_valid(const cadr_m12_breakpoint *breakpoint)
{
    if (breakpoint->enabled == 0U) return breakpoint->kind == 0U && breakpoint->value == 0U;
    if (breakpoint->enabled != 1U || breakpoint->kind < CADR_M12_BREAKPOINT_MICRO_PC_BEFORE ||
        breakpoint->kind > CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER) return 0;
    if ((breakpoint->kind == CADR_M12_BREAKPOINT_MICRO_PC_BEFORE ||
         breakpoint->kind == CADR_M12_BREAKPOINT_RAW_LC_BEFORE) && breakpoint->value > UINT32_MAX) return 0;
    return (breakpoint->kind != CADR_M12_BREAKPOINT_FAULT_AFTER &&
            breakpoint->kind != CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER) ||
        breakpoint->value == UINT64_C(1);
}

static cadr_status cadr_m12_config_snapshot_decode(
    const cadr_machine *machine,
    const uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES],
    cadr_m12_breakpoint candidate[CADR_M12_MAX_BREAKPOINTS])
{
    uint32_t index;
    uint32_t offset = 64U;
    if (machine == NULL || bytes == NULL || candidate == NULL ||
        memcmp(bytes, "CDRM12C1", 8U) != 0 ||
        cadr_m12_get32(bytes + 8U) != UINT32_C(1) ||
        cadr_m12_get32(bytes + 12U) != CADR_M12_CONFIG_SNAPSHOT_BYTES ||
        memcmp(bytes + 16U, cadr_m12_profile_sha256,
               CADR_M12_SHA256_BYTES) != 0 ||
        cadr_m12_get64(bytes + 48U) != machine->state.events.generation ||
        cadr_m12_get32(bytes + 56U) != CADR_M12_MAX_BREAKPOINTS ||
        cadr_m12_get32(bytes + 60U) != 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    for (index = 0U; index < CADR_M12_MAX_BREAKPOINTS; ++index) {
        candidate[index].enabled = cadr_m12_get32(bytes + offset); offset += 4U;
        candidate[index].kind = cadr_m12_get32(bytes + offset); offset += 4U;
        candidate[index].value = cadr_m12_get64(bytes + offset); offset += 8U;
        if (!cadr_m12_snapshot_breakpoint_valid(&candidate[index])) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    }
    return offset == CADR_M12_CONFIG_SNAPSHOT_BYTES ?
        CADR_STATUS_OK : CADR_STATUS_INVALID_ARGUMENT;
}

static cadr_m12_status cadr_m12_machine_complete_slot(
    void *context, const cadr_m12_boundary *before,
    cadr_m12_slot_completion *completion)
{
    cadr_m12_machine_adapter *adapter = context;
    cadr_run_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12, (uint32_t)sizeof(cadr_run_request),
        0U, UINT64_C(1)
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12, (uint32_t)sizeof(cadr_run_result),
        0U, 0U, 0U, 0U, 0U
    };
    cadr_m12_boundary actual_before;
    cadr_m12_boundary after;
    cadr_status status;

    if (!cadr_m12_adapter_valid(adapter) || before == NULL || completion == NULL) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    actual_before = cadr_m12_machine_boundary(adapter->machine);
    if (memcmp(&actual_before, before, sizeof(actual_before)) != 0) {
        return CADR_M12_STATUS_STALE_GENERATION;
    }
    status = cadr_machine_run(adapter->machine, &request, &result);
    if (status != CADR_STATUS_OK) return status;
    if (result.clock_slots_completed != UINT64_C(1)) {
        return CADR_M12_STATUS_NOT_READY;
    }
    after = cadr_m12_machine_boundary(adapter->machine);
    completion->complete_slots = 1U;
    completion->inhibited = adapter->machine->state.trace.last_slot_inhibited != 0U
        ? 1U : 0U;
    completion->micro_pc_after = after.micro_pc;
    completion->raw_lc_after = after.raw_lc;
    completion->fault_after = after.fault;
    completion->device_request_after = after.device_request;
    return CADR_M12_STATUS_OK;
}

/*
 * System 303's public UC-MACROCODE source places the normal and debugger
 * macro instruction loops at QMLP=0164 and DMLP=0200 respectively.  These
 * are the only boundaries this adapter recognizes: a macro step begins at one
 * of these fetch loops and returns immediately before the next such loop.  It
 * deliberately does not infer a boundary from location-counter movement,
 * decoded words, a trap, or an arbitrary micro-PC.
 */
#define CADR_M12_SYSTEM_303_QMLP UINT32_C(0164)
#define CADR_M12_SYSTEM_303_DMLP UINT32_C(0200)

static cadr_m12_dispatch_answer cadr_m12_machine_dispatch_system_303(
    void *context, uint32_t micro_pc)
{
    (void)context;
    return micro_pc == CADR_M12_SYSTEM_303_QMLP ||
        micro_pc == CADR_M12_SYSTEM_303_DMLP ? CADR_M12_DISPATCH_YES :
        CADR_M12_DISPATCH_NO;
}

static cadr_m12_status cadr_m12_machine_bind_owner(
    cadr_m12_machine_adapter *adapter)
{
    cadr_m12_direct_arrays arrays;
    if (!cadr_m12_adapter_valid(adapter)) return CADR_M12_STATUS_INVALID_ARGUMENT;
    (void)memset(&arrays, 0, sizeof(arrays));
    arrays.a_memory = adapter->machine->state.cpu.a_memory;
    arrays.m_memory = adapter->machine->state.cpu.m_memory;
    arrays.dispatch_memory = adapter->machine->state.cpu.dispatch_memory;
    arrays.pdl = adapter->machine->state.cpu.pdl;
    arrays.micro_stack = adapter->machine->state.cpu.micro_stack;
    arrays.a_memory_count = 1024U;
    arrays.m_memory_count = 32U;
    arrays.dispatch_memory_count = 2048U;
    arrays.pdl_count = 1024U;
    arrays.micro_stack_count = 32U;
    return cadr_m12_inspector_owner_bind(&adapter->debugger,
                                         &adapter->inspector_owner, &arrays);
}

cadr_status cadr_m12_machine_adapter_initialize(
    cadr_m12_machine_adapter *adapter, cadr_machine *machine)
{
    cadr_m12_boundary initial;
    cadr_m12_status status;
    if (adapter == NULL || machine == NULL || adapter->initialized != 0U ||
        adapter->machine != NULL || adapter->reserved0 != 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(adapter, 0, sizeof(*adapter));
    status = cadr_m12_incarnation_domain_initialize(&adapter->domain);
    if (status != CADR_M12_STATUS_OK) return status;
    initial = cadr_m12_machine_boundary(machine);
    status = cadr_m12_debugger_initialize(&adapter->debugger, &adapter->domain,
                                          &initial, machine->state.events.generation,
                                          cadr_m12_profile_sha256);
    if (status != CADR_M12_STATUS_OK) return status;
    adapter->machine = machine;
    adapter->initialized = 1U;
    adapter->debugger.clock_slots_completed = machine->state.clock_slots_completed;
    adapter->debugger.boundary_ordinal = machine->state.clock_slots_completed;
    status = cadr_m12_machine_bind_owner(adapter);
    if (status != CADR_M12_STATUS_OK) {
        (void)memset(adapter, 0, sizeof(*adapter));
        return status;
    }
    return CADR_STATUS_OK;
}

cadr_status cadr_m12_machine_adapter_rebind(
    cadr_m12_machine_adapter *adapter, cadr_machine *machine)
{
    cadr_m12_boundary initial;
    cadr_m12_status status;
    if (!cadr_m12_adapter_valid(adapter) || machine == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    status = cadr_m12_inspector_owner_retire(&adapter->debugger,
                                             &adapter->inspector_owner);
    if (status != CADR_M12_STATUS_OK) return status;
    initial = cadr_m12_machine_boundary(machine);
    status = cadr_m12_debugger_reinitialize(&adapter->debugger, &adapter->domain,
                                            &initial, machine->state.events.generation,
                                            cadr_m12_profile_sha256);
    if (status != CADR_M12_STATUS_OK) return status;
    adapter->machine = machine;
    adapter->debugger.clock_slots_completed = machine->state.clock_slots_completed;
    adapter->debugger.boundary_ordinal = machine->state.clock_slots_completed;
    return cadr_m12_machine_bind_owner(adapter);
}

void cadr_m12_machine_adapter_destroy(cadr_m12_machine_adapter *adapter)
{
    if (!cadr_m12_adapter_valid(adapter)) return;
    (void)cadr_m12_inspector_owner_retire(&adapter->debugger,
                                          &adapter->inspector_owner);
    (void)memset(adapter, 0, sizeof(*adapter));
}

cadr_m12_status cadr_m12_machine_adapter_breakpoint_set(
    cadr_m12_machine_adapter *adapter, uint32_t index,
    const cadr_m12_breakpoint *breakpoint)
{
    return cadr_m12_adapter_valid(adapter) ?
        cadr_m12_breakpoint_set(&adapter->debugger, index, breakpoint) :
        CADR_M12_STATUS_NOT_READY;
}

cadr_m12_status cadr_m12_machine_adapter_breakpoint_clear(
    cadr_m12_machine_adapter *adapter, uint32_t index)
{
    return cadr_m12_adapter_valid(adapter) ?
        cadr_m12_breakpoint_clear(&adapter->debugger, index) :
        CADR_M12_STATUS_NOT_READY;
}

cadr_m12_status cadr_m12_machine_adapter_resume_one_boundary(
    cadr_m12_machine_adapter *adapter)
{
    return cadr_m12_adapter_valid(adapter) ?
        cadr_m12_resume_one_boundary(&adapter->debugger) : CADR_M12_STATUS_NOT_READY;
}

cadr_m12_status cadr_m12_machine_adapter_micro_step(
    cadr_m12_machine_adapter *adapter)
{
    return cadr_m12_adapter_valid(adapter) ?
        cadr_m12_micro_step(&adapter->debugger, cadr_m12_machine_complete_slot,
                            adapter) : CADR_M12_STATUS_NOT_READY;
}

cadr_m12_status cadr_m12_machine_adapter_macro_step(
    cadr_m12_machine_adapter *adapter)
{
    return cadr_m12_adapter_valid(adapter) ?
        cadr_m12_macro_step(&adapter->debugger, cadr_m12_machine_complete_slot,
                            cadr_m12_machine_dispatch_system_303, adapter) :
        CADR_M12_STATUS_NOT_READY;
}

cadr_m12_status cadr_m12_machine_adapter_stop_copy(
    const cadr_m12_machine_adapter *adapter,
    uint8_t output[CADR_M12_STOP_BYTES])
{
    if (!cadr_m12_adapter_valid(adapter) || output == NULL ||
        adapter->debugger.have_stop == 0U) return CADR_M12_STATUS_NOT_READY;
    return cadr_m12_stop_encode(&adapter->debugger.last_stop, output);
}

cadr_m12_status cadr_m12_machine_adapter_trace_filter(
    cadr_m12_machine_adapter *adapter,
    const cadr_m12_trace_filter *filter)
{
    if (!cadr_m12_adapter_valid(adapter)) return CADR_M12_STATUS_NOT_READY;
    if (cadr_m12_trace_filter_validate(filter) != CADR_M12_STATUS_OK) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    /* Validation precedes the sole visible mutation.  A copied fixed-width
     * record makes installed-filter state independent of caller storage. */
    adapter->trace_filter = *filter;
    adapter->trace_filter_installed = 1U;
    return CADR_M12_STATUS_OK;
}

int cadr_m12_machine_adapter_trace_filter_matches(
    const cadr_m12_machine_adapter *adapter,
    const cadr_m12_trace_record *record)
{
    if (!cadr_m12_adapter_valid(adapter) ||
        adapter->trace_filter_installed != 1U) {
        return 0;
    }
    return cadr_m12_trace_filter_matches(&adapter->trace_filter, record);
}

cadr_status cadr_m12_machine_adapter_config_snapshot_serialize(
    const cadr_m12_machine_adapter *adapter,
    uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES])
{
    uint32_t index;
    uint32_t offset = 64U;
    if (!cadr_m12_adapter_valid(adapter) || bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    (void)memset(bytes, 0, CADR_M12_CONFIG_SNAPSHOT_BYTES);
    (void)memcpy(bytes, "CDRM12C1", 8U);
    cadr_m12_put32(bytes + 8U, UINT32_C(1));
    cadr_m12_put32(bytes + 12U, CADR_M12_CONFIG_SNAPSHOT_BYTES);
    (void)memcpy(bytes + 16U, cadr_m12_profile_sha256, CADR_M12_SHA256_BYTES);
    cadr_m12_put64(bytes + 48U, adapter->machine->state.events.generation);
    cadr_m12_put32(bytes + 56U, CADR_M12_MAX_BREAKPOINTS);
    for (index = 0U; index < CADR_M12_MAX_BREAKPOINTS; ++index) {
        const cadr_m12_breakpoint *breakpoint = &adapter->debugger.breakpoints[index];
        if (!cadr_m12_snapshot_breakpoint_valid(breakpoint)) return CADR_STATUS_INVALID_ARGUMENT;
        cadr_m12_put32(bytes + offset, breakpoint->enabled); offset += 4U;
        cadr_m12_put32(bytes + offset, breakpoint->kind); offset += 4U;
        cadr_m12_put64(bytes + offset, breakpoint->value); offset += 8U;
    }
    return offset == CADR_M12_CONFIG_SNAPSHOT_BYTES ? CADR_STATUS_OK : CADR_STATUS_INVALID_ARGUMENT;
}

cadr_status cadr_m12_machine_adapter_config_snapshot_restore(
    cadr_m12_machine_adapter *adapter,
    const uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES])
{
    cadr_m12_breakpoint candidate[CADR_M12_MAX_BREAKPOINTS];
    if (!cadr_m12_adapter_valid(adapter) ||
        cadr_m12_config_snapshot_decode(adapter->machine, bytes, candidate) !=
            CADR_STATUS_OK) return CADR_STATUS_INVALID_ARGUMENT;
    (void)memcpy(adapter->debugger.breakpoints, candidate, sizeof(candidate));
    return CADR_STATUS_OK;
}

cadr_status cadr_m12_machine_adapter_rebind_config_snapshot(
    cadr_m12_machine_adapter *adapter, cadr_machine *machine,
    const uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES])
{
    cadr_m12_breakpoint candidate[CADR_M12_MAX_BREAKPOINTS];
    cadr_m12_boundary initial;
    cadr_m12_status status;
    /*
     * This is the complete pre-commit validation set.  In particular, reserve
     * the next nonrecycled owner incarnation before retiring the current
     * owner, so exhaustion cannot create a partially rebound adapter.
     */
    if (!cadr_m12_adapter_valid(adapter) || machine == NULL ||
        cadr_m12_config_snapshot_decode(machine, bytes, candidate) !=
            CADR_STATUS_OK) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (adapter->domain.next_incarnation == UINT64_MAX) {
        return (cadr_status)CADR_M12_STATUS_INCARNATION_EXHAUSTED;
    }
    initial = cadr_m12_machine_boundary(machine);
    if (machine->state.events.generation == 0U ||
        initial.fault > 1U || initial.device_request > 1U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }

    status = cadr_m12_inspector_owner_retire(&adapter->debugger,
                                             &adapter->inspector_owner);
    if (status != CADR_M12_STATUS_OK) return status;
    status = cadr_m12_debugger_reinitialize(
        &adapter->debugger, &adapter->domain, &initial,
        machine->state.events.generation, cadr_m12_profile_sha256);
    if (status != CADR_M12_STATUS_OK) return status;
    adapter->machine = machine;
    adapter->debugger.clock_slots_completed =
        machine->state.clock_slots_completed;
    adapter->debugger.boundary_ordinal =
        machine->state.clock_slots_completed;
    status = cadr_m12_machine_bind_owner(adapter);
    if (status != CADR_M12_STATUS_OK) return status;
    (void)memcpy(adapter->debugger.breakpoints, candidate, sizeof(candidate));
    return CADR_STATUS_OK;
}

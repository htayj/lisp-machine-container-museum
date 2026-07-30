#include "cadr_m6_fast_run.h"

#include "cadr_bus_device.h"

#include <string.h>

#if defined(CADR_M6_FAST_RUN_TESTING)
static cadr_m6_fast_run_test_hook cadr_m6_fast_run_hook;

void cadr_m6_fast_run_test_set_hook(cadr_m6_fast_run_test_hook hook)
{
    cadr_m6_fast_run_hook = hook;
}
#endif

static void cadr_m6_fast_put32(uint8_t *bytes, uint32_t value)
{
    uint32_t index;
    for (index = 0U; index < 4U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static void cadr_m6_fast_put64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static uint32_t cadr_m6_fast_is_waiting(const cadr_machine *machine,
                                        cadr_status status)
{
    return status == CADR_STATUS_WAITING_FOR_HOST ||
        (machine->state.events.outstanding_request_id != 0U &&
         machine->state.events.completion_queued == 0U) ? 1U : 0U;
}

static uint32_t cadr_m6_fast_is_fatal(const cadr_machine *machine,
                                      cadr_status status)
{
    if (machine->state.events.persistent_status != CADR_STATUS_OK) return 1U;
    return status != CADR_STATUS_OK && status != CADR_STATUS_WAITING_FOR_HOST ?
        1U : 0U;
}

static void cadr_m6_fast_fill(cadr_machine *machine, uint32_t requested_slots,
                              uint64_t pre_boundary, uint64_t debug_before,
                              uint64_t micro_before,
                              cadr_m6_fast_run_result *out_result)
{
    out_result->requested_slots = requested_slots;
    out_result->reserved0 = 0U;
    out_result->pre_boundary = pre_boundary;
    out_result->post_boundary = machine->state.clock_slots_completed;
    out_result->debug_before = debug_before & UINT64_C(0xffffffffffff);
    out_result->debug_after = cadr_diagnostic_debug_instruction(&machine->state);
    out_result->microinstruction_delta =
        machine->state.cpu.microinstructions_executed - micro_before;
    out_result->persistent_status = machine->state.events.persistent_status;
    out_result->lifecycle = machine->state.lifecycle;
    out_result->outstanding_request_id = machine->state.events.outstanding_request_id;
}

cadr_status cadr_m6_fast_run(cadr_machine *machine, uint32_t requested_slots,
                             cadr_m6_fast_run_result *out_result)
{
    cadr_run_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M6, (uint32_t)sizeof(cadr_run_request),
        0U, 1U
    };
    cadr_run_result run_result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M6, (uint32_t)sizeof(cadr_run_result),
        CADR_STATUS_OK, 0U, 0U, 0U, 0U
    };
    uint64_t pre_boundary;
    uint64_t debug_before;
    uint64_t micro_before;
    uint32_t settlement_seen = 0U;
    cadr_status status = CADR_STATUS_OK;

    if (machine == NULL || out_result == NULL || requested_slots == 0U ||
        requested_slots > CADR_M6_FAST_RUN_MAX_SLOTS) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(out_result, 0, sizeof(*out_result));
    pre_boundary = machine->state.clock_slots_completed;
    debug_before = cadr_diagnostic_debug_instruction(&machine->state);
    micro_before = machine->state.cpu.microinstructions_executed;

    while (out_result->completed_slots < requested_slots) {
        uint64_t completed_before = out_result->completed_slots;
        (void)memset(&run_result, 0, sizeof(run_result));
        run_result.abi_major = CADR_ABI_MAJOR;
        run_result.abi_minor = CADR_ABI_MINOR_M6;
        run_result.struct_size = (uint32_t)sizeof(run_result);
        status = cadr_machine_run(machine, &request, &run_result);
        if (run_result.clock_slots_completed > 1U ||
            out_result->completed_slots > UINT64_MAX -
                run_result.clock_slots_completed) {
            return CADR_STATUS_HOST_FAILURE;
        }
        out_result->completed_slots += run_result.clock_slots_completed;
#if defined(CADR_M6_FAST_RUN_TESTING)
        if (cadr_m6_fast_run_hook != NULL) {
            cadr_m6_fast_run_hook(machine, out_result->completed_slots);
        }
#endif
        /* Fatal and wait take precedence over a coincident debug transition;
         * both are observed after exactly the completed slot, never later. */
        if (cadr_m6_fast_is_fatal(machine, status) != 0U) {
            cadr_m6_fast_fill(machine, requested_slots, pre_boundary,
                              debug_before, micro_before, out_result);
            out_result->reason = CADR_M6_FAST_RUN_REASON_FATAL;
            out_result->status = out_result->persistent_status != CADR_STATUS_OK ?
                out_result->persistent_status : status;
            return CADR_STATUS_OK;
        }
        if (cadr_m6_fast_is_waiting(machine, status) != 0U) {
            cadr_m6_fast_fill(machine, requested_slots, pre_boundary,
                              debug_before, micro_before, out_result);
            out_result->reason = CADR_M6_FAST_RUN_REASON_WAITING_FOR_HOST;
            out_result->status = CADR_STATUS_WAITING_FOR_HOST;
            return CADR_STATUS_OK;
        }
        if (cadr_diagnostic_debug_instruction(&machine->state) != debug_before) {
            cadr_m6_fast_fill(machine, requested_slots, pre_boundary,
                              debug_before, micro_before, out_result);
            out_result->reason = CADR_M6_FAST_RUN_REASON_DEBUG_CHANGED;
            out_result->status = CADR_STATUS_OK;
            return CADR_STATUS_OK;
        }
        if (out_result->completed_slots == requested_slots) {
            cadr_m6_fast_fill(machine, requested_slots, pre_boundary,
                              debug_before, micro_before, out_result);
            out_result->reason = CADR_M6_FAST_RUN_REASON_ENDPOINT;
            out_result->status = CADR_STATUS_OK;
            return CADR_STATUS_OK;
        }
        /* The only successful zero-slot turn is M5's queued-completion
         * settlement. A second one cannot make progress and fails closed. */
        if (run_result.clock_slots_completed == 0U) {
            if (status != CADR_STATUS_OK || settlement_seen != 0U ||
                completed_before != out_result->completed_slots) {
                return CADR_STATUS_HOST_FAILURE;
            }
            settlement_seen = 1U;
        }
    }
    return CADR_STATUS_HOST_FAILURE;
}

cadr_status cadr_m6_fast_run_serialize(const cadr_m6_fast_run_result *result,
                                        uint8_t bytes[CADR_M6_FAST_RUN_RECORD_BYTES])
{
    if (result == NULL || bytes == NULL ||
        result->requested_slots == 0U ||
        result->requested_slots > CADR_M6_FAST_RUN_MAX_SLOTS ||
        result->completed_slots > result->requested_slots ||
        result->pre_boundary > result->post_boundary ||
        result->post_boundary - result->pre_boundary != result->completed_slots ||
        result->reason < CADR_M6_FAST_RUN_REASON_ENDPOINT ||
        result->reason > CADR_M6_FAST_RUN_REASON_FATAL ||
        (result->debug_before & ~UINT64_C(0xffffffffffff)) != 0U ||
        (result->debug_after & ~UINT64_C(0xffffffffffff)) != 0U ||
        result->reserved0 != 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(bytes, 0, CADR_M6_FAST_RUN_RECORD_BYTES);
    (void)memcpy(bytes, "CDRM6FAST1", 10U);
    cadr_m6_fast_put32(bytes + 16U, CADR_M6_FAST_RUN_SCHEMA_VERSION);
    cadr_m6_fast_put32(bytes + 20U, CADR_M6_FAST_RUN_RECORD_BYTES);
    cadr_m6_fast_put32(bytes + 24U, result->reason);
    cadr_m6_fast_put32(bytes + 28U, result->status);
    cadr_m6_fast_put32(bytes + 32U, result->requested_slots);
    cadr_m6_fast_put64(bytes + 40U, result->completed_slots);
    cadr_m6_fast_put64(bytes + 48U, result->microinstruction_delta);
    cadr_m6_fast_put64(bytes + 56U, result->pre_boundary);
    cadr_m6_fast_put64(bytes + 64U, result->post_boundary);
    cadr_m6_fast_put64(bytes + 72U, result->debug_before);
    cadr_m6_fast_put64(bytes + 80U, result->debug_after);
    cadr_m6_fast_put32(bytes + 88U, result->persistent_status);
    cadr_m6_fast_put32(bytes + 92U, result->lifecycle);
    cadr_m6_fast_put64(bytes + 96U, result->outstanding_request_id);
    return CADR_STATUS_OK;
}

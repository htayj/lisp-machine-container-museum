/* Read-only semantic gate for an M6 native Listener oracle. */
#include "cadr_m6_listener_probe.h"

#include <stddef.h>

uint32_t cadr_m6_listener_probe(const struct cadr_m6_listener_snapshot *snapshot)
{
    if (snapshot == NULL || snapshot->abi != CADR_M6_LISTENER_PROBE_ABI) {
        return CADR_M6_LISTENER_PROBE_BLOCKED_NO_OBJECT_DECODER;
    }
    if (snapshot->initial_listener_identity == UINT64_C(0) ||
        snapshot->selected_window_identity != snapshot->initial_listener_identity ||
        snapshot->initial_listener_is_lisp_listener == 0U ||
        snapshot->initial_listener_is_exposed == 0U ||
        snapshot->listener_lisp_listener_p_is_idle == 0U ||
        snapshot->listener_owner_process_live == 0U ||
        snapshot->listener_owner_stack_group_live == 0U ||
        snapshot->listener_stack_at_read_for_top_level == 0U ||
        snapshot->listener_input_buffer_empty == 0U ||
        snapshot->listener_has_no_partial_form == 0U ||
        snapshot->boot_prompt_phase_accepted == 0U ||
        snapshot->disk_busy != 0U || snapshot->host_request_pending != 0U ||
        snapshot->oracle_quiescent_suffix_confirmed == 0U) {
        return CADR_M6_LISTENER_PROBE_NOT_READY;
    }
    return CADR_M6_LISTENER_PROBE_READY;
}

const char *cadr_m6_listener_probe_status_name(uint32_t status)
{
    switch (status) {
    case CADR_M6_LISTENER_PROBE_READY:
        return "listener-ready";
    case CADR_M6_LISTENER_PROBE_NOT_READY:
        return "not-ready";
    case CADR_M6_LISTENER_PROBE_BLOCKED_NO_OBJECT_DECODER:
        return "blocked-no-object-decoder";
    default:
        return "invalid";
    }
}

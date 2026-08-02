#include "cadr_m12_debugger.h"

#include <stddef.h>
#include <string.h>

#define CADR_M12_STOP_SCHEMA UINT32_C(1)
#define CADR_M12_PROVENANCE_SCHEMA UINT32_C(1)
#define CADR_M12_BUG_SCHEMA UINT32_C(1)
#define CADR_M12_NO_BREAKPOINT UINT32_C(0xffffffff)
#define CADR_M12_INSPECTOR_OWNER_LIVE UINT32_C(1)
#define CADR_M12_INCARNATION_DOMAIN_LIVE UINT32_C(1)
#define CADR_M12_DEBUGGER_LIVE UINT32_C(1)

static const uint8_t cadr_m12_stop_magic[12] = {
    'C','D','R','D','B','G','S','T','O','P','1',0
};
static const uint8_t cadr_m12_provenance_magic[8] = {
    'C','D','R','P','R','O','V','1'
};
static const uint8_t cadr_m12_bug_magic[8] = {
    'C','D','R','B','U','G','1',0
};

static void put32(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void put64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static uint32_t get32(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
        ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t get64(const uint8_t *bytes)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        value |= (uint64_t)bytes[index] << (index * 8U);
    }
    return value;
}

static int all_zero(const uint8_t *bytes, uint32_t count)
{
    uint32_t index;
    for (index = 0U; index < count; ++index) {
        if (bytes[index] != 0U) return 0;
    }
    return 1;
}

static int boolean(uint32_t value)
{
    return value <= 1U;
}

static int domain_zero(const cadr_m12_incarnation_domain *domain)
{
    return domain != NULL && domain->self_token == 0U &&
        domain->next_incarnation == 0U && domain->lifecycle == 0U &&
        domain->reserved0 == 0U;
}

static int domain_valid(const cadr_m12_incarnation_domain *domain)
{
    return domain != NULL && domain->self_token == (uintptr_t)domain &&
        domain->next_incarnation != 0U &&
        domain->lifecycle == CADR_M12_INCARNATION_DOMAIN_LIVE &&
        domain->reserved0 == 0U;
}

static int breakpoint_kind_valid(uint32_t kind)
{
    return kind >= CADR_M12_BREAKPOINT_MICRO_PC_BEFORE &&
        kind <= CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER;
}

static int breakpoint_valid(const cadr_m12_breakpoint *breakpoint)
{
    if (breakpoint == NULL || !boolean(breakpoint->enabled)) return 0;
    if (breakpoint->enabled == 0U) return breakpoint->kind == 0U &&
        breakpoint->value == 0U;
    if (!breakpoint_kind_valid(breakpoint->kind)) return 0;
    if ((breakpoint->kind == CADR_M12_BREAKPOINT_MICRO_PC_BEFORE ||
         breakpoint->kind == CADR_M12_BREAKPOINT_RAW_LC_BEFORE) &&
        breakpoint->value > UINT32_MAX) return 0;
    if ((breakpoint->kind == CADR_M12_BREAKPOINT_FAULT_AFTER ||
         breakpoint->kind == CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER) &&
        breakpoint->value != 1U) return 0;
    return 1;
}

static int stop_record_zero(const cadr_m12_stop_record *record)
{
    return record->reason == 0U && record->breakpoint_index == 0U &&
        record->generation == 0U && record->boundary_ordinal == 0U &&
        record->clock_slot == 0U && record->micro_pc_before == 0U &&
        record->raw_lc_before == 0U && record->micro_pc_after == 0U &&
        record->raw_lc_after == 0U && record->fault_after == 0U &&
        record->device_request_after == 0U && record->inhibited_after == 0U &&
        record->run_ordinal == 0U && record->operation_slots == 0U &&
        all_zero(record->profile_sha256, CADR_M12_SHA256_BYTES);
}

/* Virgin validation is semantic and never examines padding bytes. */
int cadr_m12_debugger_is_virgin(const cadr_m12_debugger *debugger)
{
    uint32_t index;
    if (debugger == NULL || debugger->current.micro_pc != 0U ||
        debugger->current.raw_lc != 0U || debugger->current.fault != 0U ||
        debugger->current.device_request != 0U ||
        !stop_record_zero(&debugger->last_stop) ||
        !all_zero(debugger->profile_sha256, CADR_M12_SHA256_BYTES) ||
        debugger->generation != 0U || debugger->clock_slots_completed != 0U ||
        debugger->boundary_ordinal != 0U || debugger->run_ordinal != 0U ||
        debugger->self_token != 0U || debugger->incarnation_domain != NULL ||
        debugger->incarnation_domain_token != 0U ||
        debugger->inspector_owner != NULL ||
        debugger->inspector_owner_token != 0U ||
        debugger->inspector_owner_incarnation != 0U || debugger->paused != 0U ||
        debugger->have_stop != 0U || debugger->suppression_armed != 0U ||
        debugger->suppression_breakpoint_index != 0U ||
        debugger->lifecycle != 0U || debugger->reserved0 != 0U) return 0;
    for (index = 0U; index < CADR_M12_MAX_BREAKPOINTS; ++index) {
        if (debugger->breakpoints[index].enabled != 0U ||
            debugger->breakpoints[index].kind != 0U ||
            debugger->breakpoints[index].value != 0U) return 0;
    }
    return 1;
}

static int debugger_valid(const cadr_m12_debugger *debugger)
{
    uint32_t index;
    if (debugger == NULL || debugger->self_token != (uintptr_t)debugger ||
        debugger->lifecycle != CADR_M12_DEBUGGER_LIVE ||
        debugger->reserved0 != 0U || !boolean(debugger->paused) ||
        !boolean(debugger->have_stop) ||
        !boolean(debugger->suppression_armed) || debugger->generation == 0U ||
        !boolean(debugger->current.fault) ||
        !boolean(debugger->current.device_request) ||
        all_zero(debugger->profile_sha256, CADR_M12_SHA256_BYTES)) return 0;
    if (debugger->incarnation_domain == NULL ||
        debugger->incarnation_domain_token !=
            (uintptr_t)debugger->incarnation_domain ||
        !domain_valid(debugger->incarnation_domain)) return 0;
    if ((debugger->inspector_owner == NULL) !=
            (debugger->inspector_owner_token == 0U) ||
        (debugger->inspector_owner == NULL) !=
            (debugger->inspector_owner_incarnation == 0U) ||
        (debugger->inspector_owner != NULL &&
         debugger->inspector_owner_token !=
             (uintptr_t)debugger->inspector_owner)) return 0;
    if (debugger->suppression_armed != 0U &&
        (debugger->suppression_breakpoint_index >= CADR_M12_MAX_BREAKPOINTS ||
         debugger->have_stop == 0U ||
         debugger->last_stop.breakpoint_index !=
             debugger->suppression_breakpoint_index)) return 0;
    for (index = 0U; index < CADR_M12_MAX_BREAKPOINTS; ++index) {
        if (!breakpoint_valid(&debugger->breakpoints[index])) return 0;
    }
    return 1;
}

static int match_breakpoint(const cadr_m12_breakpoint *breakpoint,
                            const cadr_m12_boundary *boundary,
                            uint64_t clock_slot, uint32_t kind)
{
    if (breakpoint->enabled == 0U || breakpoint->kind != kind) return 0;
    switch (kind) {
    case CADR_M12_BREAKPOINT_MICRO_PC_BEFORE:
        return boundary->micro_pc == (uint32_t)breakpoint->value;
    case CADR_M12_BREAKPOINT_RAW_LC_BEFORE:
        return boundary->raw_lc == (uint32_t)breakpoint->value;
    case CADR_M12_BREAKPOINT_CLOCK_SLOT_AFTER:
        return clock_slot == breakpoint->value;
    case CADR_M12_BREAKPOINT_FAULT_AFTER:
        return boundary->fault != 0U;
    case CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER:
        return boundary->device_request != 0U;
    default:
        return 0;
    }
}

/* Kind ordering, then fixed record index, is part of the Phase 1 result. */
static uint32_t find_match(const cadr_m12_debugger *debugger,
                           const cadr_m12_boundary *boundary,
                           uint64_t clock_slot, uint32_t first_kind,
                           uint32_t last_kind, uint32_t suppressed_index)
{
    uint32_t kind;
    for (kind = first_kind; kind <= last_kind; ++kind) {
        uint32_t index;
        for (index = 0U; index < CADR_M12_MAX_BREAKPOINTS; ++index) {
            if (index != suppressed_index && match_breakpoint(
                    &debugger->breakpoints[index], boundary, clock_slot, kind)) {
                return index;
            }
        }
    }
    return CADR_M12_NO_BREAKPOINT;
}

static void save_stop(cadr_m12_debugger *debugger, uint32_t reason,
                      uint32_t breakpoint_index,
                      const cadr_m12_boundary *before,
                      const cadr_m12_boundary *after, uint32_t inhibited,
                      uint64_t operation_slots)
{
    cadr_m12_stop_record *record = &debugger->last_stop;
    (void)memset(record, 0, sizeof(*record));
    record->reason = reason;
    record->breakpoint_index = breakpoint_index;
    record->generation = debugger->generation;
    record->boundary_ordinal = debugger->boundary_ordinal;
    record->clock_slot = debugger->clock_slots_completed;
    record->micro_pc_before = before->micro_pc;
    record->raw_lc_before = before->raw_lc;
    record->micro_pc_after = after->micro_pc;
    record->raw_lc_after = after->raw_lc;
    record->fault_after = after->fault;
    record->device_request_after = after->device_request;
    record->inhibited_after = inhibited;
    record->run_ordinal = debugger->run_ordinal;
    record->operation_slots = operation_slots;
    (void)memcpy(record->profile_sha256, debugger->profile_sha256,
                 CADR_M12_SHA256_BYTES);
    debugger->have_stop = 1U;
}

static cadr_m12_status check_before(cadr_m12_debugger *debugger,
                                    uint64_t operation_slots)
{
    const uint32_t suppressed = debugger->suppression_armed != 0U ?
        debugger->suppression_breakpoint_index : CADR_M12_NO_BREAKPOINT;
    const uint32_t match = find_match(debugger, &debugger->current,
                                      debugger->clock_slots_completed,
                                      CADR_M12_BREAKPOINT_MICRO_PC_BEFORE,
                                      CADR_M12_BREAKPOINT_RAW_LC_BEFORE,
                                      suppressed);
    /* Suppression has exactly one boundary of scope, even if no record matches. */
    debugger->suppression_armed = 0U;
    if (match == CADR_M12_NO_BREAKPOINT) return CADR_M12_STATUS_OK;
    save_stop(debugger, CADR_M12_STOP_BREAKPOINT, match, &debugger->current,
              &debugger->current, 0U, operation_slots);
    return CADR_M12_STATUS_DEBUG_STOP;
}

static cadr_m12_status execute_one(cadr_m12_debugger *debugger,
                                   cadr_m12_clock_slot_callback callback,
                                   void *context, uint64_t operation_slots,
                                   uint64_t *completed_operation_slots)
{
    cadr_m12_slot_completion completion;
    cadr_m12_boundary before;
    cadr_m12_boundary after;
    cadr_m12_status status;
    uint32_t match;

    status = check_before(debugger, operation_slots);
    if (status != CADR_M12_STATUS_OK) return status;
    if (debugger->clock_slots_completed == UINT64_MAX ||
        debugger->generation == UINT64_MAX || debugger->boundary_ordinal == UINT64_MAX ||
        debugger->run_ordinal == UINT64_MAX) return CADR_M12_STATUS_INVALID_ARGUMENT;
    before = debugger->current;
    (void)memset(&completion, 0, sizeof(completion));
    debugger->paused = 0U;
    status = callback(context, &before, &completion);
    debugger->paused = 1U;
    if (status != CADR_M12_STATUS_OK) {
        /* A callback cannot manufacture debugger terminal outcomes.  These
         * exact propagated statuses are the only nonterminal core outcomes
         * admitted by the isolated Phase 1 seam. */
        switch (status) {
        case UINT32_C(2):  /* invalid argument */
        case UINT32_C(7):  /* host failure */
        case UINT32_C(8):  /* waiting for host */
        case UINT32_C(9):  /* not ready */
        case UINT32_C(10): /* profile mismatch */
        case UINT32_C(11): /* artifact mismatch */
        case UINT32_C(12): /* guest fault */
        case UINT32_C(14): /* reentrant */
        case UINT32_C(15): /* no memory */
        case UINT32_C(16): /* halted */
        case UINT32_C(17): /* queue full */
        case UINT32_C(18): /* ambiguous schedule */
            return status;
        default:
            return CADR_M12_STATUS_INVALID_ARGUMENT;
        }
    }
    if (completion.complete_slots > 1U || !boolean(completion.inhibited) ||
        !boolean(completion.fault_after) || !boolean(completion.device_request_after)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    if (completion.complete_slots == 0U) return CADR_M12_STATUS_NOT_READY;

    after.micro_pc = completion.micro_pc_after;
    after.raw_lc = completion.raw_lc_after;
    after.fault = completion.fault_after;
    after.device_request = completion.device_request_after;
    debugger->current = after;
    debugger->clock_slots_completed += 1U;
    debugger->generation += 1U;
    debugger->boundary_ordinal += 1U;
    debugger->run_ordinal += 1U;
    *completed_operation_slots += 1U;
    match = find_match(debugger, &after, debugger->clock_slots_completed,
                       CADR_M12_BREAKPOINT_CLOCK_SLOT_AFTER,
                       CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER,
                       CADR_M12_NO_BREAKPOINT);
    if (match == CADR_M12_NO_BREAKPOINT) return CADR_M12_STATUS_OK;
    save_stop(debugger, CADR_M12_STOP_BREAKPOINT, match, &before, &after,
              completion.inhibited, *completed_operation_slots);
    return CADR_M12_STATUS_DEBUG_STOP;
}

cadr_m12_status cadr_m12_incarnation_domain_initialize(
    cadr_m12_incarnation_domain *domain)
{
    if (!domain_zero(domain)) return CADR_M12_STATUS_INVALID_ARGUMENT;
    domain->self_token = (uintptr_t)domain;
    domain->next_incarnation = UINT64_C(1);
    domain->lifecycle = CADR_M12_INCARNATION_DOMAIN_LIVE;
    return CADR_M12_STATUS_OK;
}

static int debugger_initialize_arguments_valid(
    const cadr_m12_incarnation_domain *domain,
    const cadr_m12_boundary *initial, uint64_t generation,
    const uint8_t profile_sha256[CADR_M12_SHA256_BYTES])
{
    return domain_valid(domain) && initial != NULL && profile_sha256 != NULL &&
        generation != 0U && boolean(initial->fault) &&
        boolean(initial->device_request) &&
        !all_zero(profile_sha256, CADR_M12_SHA256_BYTES);
}

static void debugger_initialize_commit(
    cadr_m12_debugger *debugger, cadr_m12_incarnation_domain *domain,
    const cadr_m12_boundary *initial, uint64_t generation,
    const uint8_t profile_sha256[CADR_M12_SHA256_BYTES])
{
    (void)memset(debugger, 0, sizeof(*debugger));
    debugger->current = *initial;
    debugger->generation = generation;
    debugger->self_token = (uintptr_t)debugger;
    debugger->incarnation_domain = domain;
    debugger->incarnation_domain_token = (uintptr_t)domain;
    debugger->paused = 1U;
    debugger->lifecycle = CADR_M12_DEBUGGER_LIVE;
    (void)memcpy(debugger->profile_sha256, profile_sha256,
                 CADR_M12_SHA256_BYTES);
}

cadr_m12_status cadr_m12_debugger_initialize(
    cadr_m12_debugger *debugger, cadr_m12_incarnation_domain *domain,
    const cadr_m12_boundary *initial, uint64_t generation,
    const uint8_t profile_sha256[CADR_M12_SHA256_BYTES])
{
    if (!cadr_m12_debugger_is_virgin(debugger) ||
        !debugger_initialize_arguments_valid(domain, initial, generation,
                                            profile_sha256)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    debugger_initialize_commit(debugger, domain, initial, generation,
                               profile_sha256);
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_debugger_reinitialize(
    cadr_m12_debugger *debugger, cadr_m12_incarnation_domain *domain,
    const cadr_m12_boundary *initial, uint64_t generation,
    const uint8_t profile_sha256[CADR_M12_SHA256_BYTES])
{
    if (!debugger_valid(debugger) || debugger->paused == 0U ||
        debugger->inspector_owner != NULL || domain == NULL ||
        domain != debugger->incarnation_domain ||
        !debugger_initialize_arguments_valid(domain, initial, generation,
                                            profile_sha256)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    debugger_initialize_commit(debugger, domain, initial, generation,
                               profile_sha256);
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_breakpoint_set(cadr_m12_debugger *debugger,
                                         uint32_t index,
                                         const cadr_m12_breakpoint *breakpoint)
{
    if (!debugger_valid(debugger) || debugger->paused == 0U ||
        index >= CADR_M12_MAX_BREAKPOINTS || breakpoint == NULL ||
        !breakpoint_valid(breakpoint) || breakpoint->enabled == 0U) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    debugger->breakpoints[index] = *breakpoint;
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_breakpoint_clear(cadr_m12_debugger *debugger,
                                           uint32_t index)
{
    if (!debugger_valid(debugger) || debugger->paused == 0U ||
        index >= CADR_M12_MAX_BREAKPOINTS) return CADR_M12_STATUS_INVALID_ARGUMENT;
    (void)memset(&debugger->breakpoints[index], 0,
                 sizeof(debugger->breakpoints[index]));
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_resume_one_boundary(cadr_m12_debugger *debugger)
{
    if (!debugger_valid(debugger) || debugger->paused == 0U ||
        debugger->have_stop == 0U ||
        debugger->last_stop.reason != CADR_M12_STOP_BREAKPOINT ||
        debugger->last_stop.breakpoint_index >= CADR_M12_MAX_BREAKPOINTS) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    debugger->suppression_armed = 1U;
    debugger->suppression_breakpoint_index = debugger->last_stop.breakpoint_index;
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_micro_step(cadr_m12_debugger *debugger,
                                     cadr_m12_clock_slot_callback callback,
                                     void *context)
{
    uint64_t completed = 0U;
    if (!debugger_valid(debugger) || debugger->paused == 0U || callback == NULL) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    return execute_one(debugger, callback, context, 0U, &completed);
}

cadr_m12_status cadr_m12_macro_step(cadr_m12_debugger *debugger,
                                     cadr_m12_clock_slot_callback callback,
                                     cadr_m12_dispatch_oracle dispatch_oracle,
                                     void *context)
{
    uint64_t completed = 0U;
    cadr_m12_dispatch_answer answer;
    cadr_m12_status status;
    if (!debugger_valid(debugger) || debugger->paused == 0U || callback == NULL) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    if (dispatch_oracle == NULL) return CADR_M12_STATUS_ORACLE_UNAVAILABLE;
    /* QMLP/DMLP dispatch PCs have no inferred fallback in Phase 1. */
    answer = dispatch_oracle(context, debugger->current.micro_pc);
    if (answer == CADR_M12_DISPATCH_UNAVAILABLE) return CADR_M12_STATUS_ORACLE_UNAVAILABLE;
    if (answer != CADR_M12_DISPATCH_NO && answer != CADR_M12_DISPATCH_YES) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    if (answer != CADR_M12_DISPATCH_YES) return CADR_M12_STATUS_INVALID_ARGUMENT;

    for (;;) {
        status = execute_one(debugger, callback, context, completed, &completed);
        if (status != CADR_M12_STATUS_OK) return status;
        answer = dispatch_oracle(context, debugger->current.micro_pc);
        if (answer == CADR_M12_DISPATCH_UNAVAILABLE) {
            return CADR_M12_STATUS_ORACLE_UNAVAILABLE;
        }
        if (answer != CADR_M12_DISPATCH_NO && answer != CADR_M12_DISPATCH_YES) {
            return CADR_M12_STATUS_INVALID_ARGUMENT;
        }
        /* The next dispatch PC is reached but has not been executed. */
        if (answer == CADR_M12_DISPATCH_YES) return CADR_M12_STATUS_OK;
        if (completed == CADR_M12_MACRO_SLOT_LIMIT) {
            save_stop(debugger, CADR_M12_STOP_MACRO_LIMIT,
                      CADR_M12_NO_BREAKPOINT, &debugger->current,
                      &debugger->current, 0U, completed);
            return CADR_M12_STATUS_LIMIT_REACHED;
        }
    }
}

static int arrays_valid(const cadr_m12_direct_arrays *arrays)
{
    return arrays != NULL && arrays->a_memory != NULL && arrays->m_memory != NULL &&
        arrays->dispatch_memory != NULL && arrays->pdl != NULL &&
        arrays->micro_stack != NULL && arrays->a_memory_count == 1024U &&
        arrays->m_memory_count == 32U && arrays->dispatch_memory_count == 2048U &&
        arrays->pdl_count == 1024U && arrays->micro_stack_count == 32U;
}

cadr_m12_status cadr_m12_inspector_owner_bind(
    cadr_m12_debugger *debugger, cadr_m12_inspector_owner *owner,
    const cadr_m12_direct_arrays *arrays)
{
    cadr_m12_incarnation_domain *domain;
    uint64_t incarnation;
    if (!debugger_valid(debugger) || debugger->paused == 0U ||
        debugger->inspector_owner != NULL || owner == NULL ||
        !arrays_valid(arrays) ||
        owner->self_token != 0U || owner->debugger_token != 0U ||
        owner->incarnation != 0U || owner->lifecycle != 0U ||
        owner->reserved0 != 0U || owner->arrays.a_memory != NULL ||
        owner->arrays.m_memory != NULL || owner->arrays.dispatch_memory != NULL ||
        owner->arrays.pdl != NULL || owner->arrays.micro_stack != NULL ||
        owner->arrays.a_memory_count != 0U ||
        owner->arrays.m_memory_count != 0U ||
        owner->arrays.dispatch_memory_count != 0U ||
        owner->arrays.pdl_count != 0U ||
        owner->arrays.micro_stack_count != 0U) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    domain = debugger->incarnation_domain;
    /* All object and shape checks above precede the only allocation result.
     * UINT64_MAX is the exhausted sentinel: it is never issued or wrapped. */
    if (domain->next_incarnation == UINT64_MAX) {
        return CADR_M12_STATUS_INCARNATION_EXHAUSTED;
    }
    incarnation = domain->next_incarnation;
    /* This reservation and the following publication have no fallible path;
     * a successful domain incarnation is never recycled. */
    domain->next_incarnation = incarnation + 1U;
    owner->self_token = (uintptr_t)owner;
    owner->debugger_token = debugger->self_token;
    owner->incarnation = incarnation;
    owner->arrays = *arrays;
    owner->lifecycle = CADR_M12_INSPECTOR_OWNER_LIVE;
    debugger->inspector_owner = owner;
    debugger->inspector_owner_token = (uintptr_t)owner;
    debugger->inspector_owner_incarnation = owner->incarnation;
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_inspector_owner_retire(
    cadr_m12_debugger *debugger, cadr_m12_inspector_owner *owner)
{
    if (!debugger_valid(debugger) || debugger->paused == 0U || owner == NULL ||
        debugger->inspector_owner != owner ||
        debugger->inspector_owner_token != (uintptr_t)owner ||
        owner->self_token != (uintptr_t)owner ||
        owner->debugger_token != debugger->self_token ||
        owner->incarnation != debugger->inspector_owner_incarnation ||
        owner->lifecycle != CADR_M12_INSPECTOR_OWNER_LIVE ||
        owner->reserved0 != 0U || !arrays_valid(&owner->arrays)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    /* Clear every debugger route before invalidating the owner.  A later read
     * of an old lease returns stale without touching owner or array storage. */
    debugger->inspector_owner = NULL;
    debugger->inspector_owner_token = 0U;
    debugger->inspector_owner_incarnation = 0U;
    (void)memset(owner, 0, sizeof(*owner));
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_inspector_lease_open(
    const cadr_m12_debugger *debugger, cadr_m12_inspector_lease *lease)
{
    const cadr_m12_inspector_owner *owner;
    if (!debugger_valid(debugger) || debugger->paused == 0U ||
        lease == NULL || debugger->inspector_owner == NULL) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    owner = debugger->inspector_owner;
    if (owner->self_token != (uintptr_t)owner ||
        owner->debugger_token != debugger->self_token ||
        owner->incarnation != debugger->inspector_owner_incarnation ||
        owner->lifecycle != CADR_M12_INSPECTOR_OWNER_LIVE ||
        owner->reserved0 != 0U || !arrays_valid(&owner->arrays)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(lease, 0, sizeof(*lease));
    lease->debugger_token = debugger->self_token;
    lease->owner_token = (uintptr_t)owner;
    lease->generation = debugger->generation;
    lease->owner_incarnation = owner->incarnation;
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_inspector_lease_read(
    const cadr_m12_debugger *debugger, const cadr_m12_inspector_lease *lease,
    uint32_t array_kind, uint32_t index, uint32_t *value)
{
    const cadr_m12_inspector_owner *owner;
    const uint32_t *source = NULL;
    uint32_t count = 0U;
    if (!debugger_valid(debugger) || lease == NULL || value == NULL ||
        debugger->paused == 0U ||
        lease->debugger_token != debugger->self_token ||
        lease->generation != debugger->generation ||
        debugger->inspector_owner == NULL ||
        lease->owner_token != debugger->inspector_owner_token ||
        lease->owner_incarnation != debugger->inspector_owner_incarnation) {
        return CADR_M12_STATUS_STALE_GENERATION;
    }
    owner = debugger->inspector_owner;
    if (owner->self_token != (uintptr_t)owner ||
        owner->debugger_token != debugger->self_token ||
        owner->incarnation != lease->owner_incarnation ||
        owner->lifecycle != CADR_M12_INSPECTOR_OWNER_LIVE ||
        owner->reserved0 != 0U || !arrays_valid(&owner->arrays)) {
        return CADR_M12_STATUS_STALE_GENERATION;
    }
    switch (array_kind) {
    case CADR_M12_ARRAY_A_MEMORY:
        source = owner->arrays.a_memory; count = owner->arrays.a_memory_count; break;
    case CADR_M12_ARRAY_M_MEMORY:
        source = owner->arrays.m_memory; count = owner->arrays.m_memory_count; break;
    case CADR_M12_ARRAY_DISPATCH_MEMORY:
        source = owner->arrays.dispatch_memory; count = owner->arrays.dispatch_memory_count; break;
    case CADR_M12_ARRAY_PDL:
        source = owner->arrays.pdl; count = owner->arrays.pdl_count; break;
    case CADR_M12_ARRAY_MICRO_STACK:
        source = owner->arrays.micro_stack; count = owner->arrays.micro_stack_count; break;
    default:
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    if (index >= count) return CADR_M12_STATUS_INVALID_ARGUMENT;
    *value = source[index];
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_trace_filter_validate(
    const cadr_m12_trace_filter *filter)
{
    if (filter == NULL || (filter->flags & ~CADR_M12_TRACE_FILTER_KNOWN) != 0U ||
        ((filter->flags & CADR_M12_TRACE_FILTER_CLOCK_RANGE) != 0U &&
         filter->first_clock_slot > filter->last_clock_slot)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    return CADR_M12_STATUS_OK;
}

int cadr_m12_trace_filter_matches(const cadr_m12_trace_filter *filter,
                                  const cadr_m12_trace_record *record)
{
    if (cadr_m12_trace_filter_validate(filter) != CADR_M12_STATUS_OK ||
        record == NULL || !boolean(record->fault) || !boolean(record->device_request)) {
        return 0;
    }
    if ((filter->flags & CADR_M12_TRACE_FILTER_MICRO_PC) != 0U &&
        record->micro_pc != filter->micro_pc) return 0;
    if ((filter->flags & CADR_M12_TRACE_FILTER_CLOCK_RANGE) != 0U &&
        (record->clock_slot < filter->first_clock_slot ||
         record->clock_slot > filter->last_clock_slot)) return 0;
    if ((filter->flags & CADR_M12_TRACE_FILTER_FAULT) != 0U && record->fault == 0U) return 0;
    if ((filter->flags & CADR_M12_TRACE_FILTER_DEVICE_REQUEST) != 0U &&
        record->device_request == 0U) return 0;
    return 1;
}

static int stop_record_valid(const cadr_m12_stop_record *record)
{
    if (record == NULL || (record->reason != CADR_M12_STOP_BREAKPOINT &&
                           record->reason != CADR_M12_STOP_MACRO_LIMIT) ||
        record->generation == 0U || !boolean(record->fault_after) ||
        !boolean(record->device_request_after) || !boolean(record->inhibited_after) ||
        all_zero(record->profile_sha256, CADR_M12_SHA256_BYTES)) return 0;
    if ((record->reason == CADR_M12_STOP_BREAKPOINT &&
         record->breakpoint_index >= CADR_M12_MAX_BREAKPOINTS) ||
        (record->reason == CADR_M12_STOP_MACRO_LIMIT &&
         (record->breakpoint_index != CADR_M12_NO_BREAKPOINT ||
          record->operation_slots != CADR_M12_MACRO_SLOT_LIMIT))) return 0;
    return 1;
}

cadr_m12_status cadr_m12_stop_encode(
    const cadr_m12_stop_record *record,
    uint8_t output[CADR_M12_STOP_BYTES])
{
    if (!stop_record_valid(record) || output == NULL) return CADR_M12_STATUS_INVALID_ARGUMENT;
    (void)memset(output, 0, CADR_M12_STOP_BYTES);
    (void)memcpy(output, cadr_m12_stop_magic, sizeof(cadr_m12_stop_magic));
    put32(output + 12U, CADR_M12_STOP_SCHEMA);
    put32(output + 16U, CADR_M12_STOP_BYTES);
    put32(output + 24U, record->reason);
    put32(output + 28U, record->breakpoint_index);
    put64(output + 32U, record->generation);
    put64(output + 40U, record->boundary_ordinal);
    put64(output + 48U, record->clock_slot);
    put32(output + 56U, record->micro_pc_before);
    put32(output + 60U, record->raw_lc_before);
    put32(output + 64U, record->micro_pc_after);
    put32(output + 68U, record->raw_lc_after);
    put32(output + 72U, record->fault_after);
    put32(output + 76U, record->device_request_after);
    put32(output + 80U, record->inhibited_after);
    put64(output + 88U, record->run_ordinal);
    put64(output + 96U, record->operation_slots);
    (void)memcpy(output + 104U, record->profile_sha256, CADR_M12_SHA256_BYTES);
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_stop_decode(
    const uint8_t input[CADR_M12_STOP_BYTES], cadr_m12_stop_record *record)
{
    cadr_m12_stop_record decoded;
    if (input == NULL || record == NULL ||
        memcmp(input, cadr_m12_stop_magic, sizeof(cadr_m12_stop_magic)) != 0 ||
        get32(input + 12U) != CADR_M12_STOP_SCHEMA ||
        get32(input + 16U) != CADR_M12_STOP_BYTES || get32(input + 20U) != 0U ||
        get32(input + 84U) != 0U) return CADR_M12_STATUS_INVALID_ARGUMENT;
    (void)memset(&decoded, 0, sizeof(decoded));
    decoded.reason = get32(input + 24U);
    decoded.breakpoint_index = get32(input + 28U);
    decoded.generation = get64(input + 32U);
    decoded.boundary_ordinal = get64(input + 40U);
    decoded.clock_slot = get64(input + 48U);
    decoded.micro_pc_before = get32(input + 56U);
    decoded.raw_lc_before = get32(input + 60U);
    decoded.micro_pc_after = get32(input + 64U);
    decoded.raw_lc_after = get32(input + 68U);
    decoded.fault_after = get32(input + 72U);
    decoded.device_request_after = get32(input + 76U);
    decoded.inhibited_after = get32(input + 80U);
    decoded.run_ordinal = get64(input + 88U);
    decoded.operation_slots = get64(input + 96U);
    (void)memcpy(decoded.profile_sha256, input + 104U, CADR_M12_SHA256_BYTES);
    if (!stop_record_valid(&decoded)) return CADR_M12_STATUS_INVALID_ARGUMENT;
    *record = decoded;
    return CADR_M12_STATUS_OK;
}

static int provenance_valid(const cadr_m12_provenance *provenance)
{
    return provenance != NULL && !all_zero(provenance->profile_sha256, CADR_M12_SHA256_BYTES) &&
        !all_zero(provenance->core_sha256, CADR_M12_SHA256_BYTES) &&
        !all_zero(provenance->snapshot_sha256, CADR_M12_SHA256_BYTES);
}

cadr_m12_status cadr_m12_provenance_encode(
    const cadr_m12_provenance *provenance,
    uint8_t output[CADR_M12_PROVENANCE_BYTES])
{
    if (!provenance_valid(provenance) || output == NULL) return CADR_M12_STATUS_INVALID_ARGUMENT;
    (void)memset(output, 0, CADR_M12_PROVENANCE_BYTES);
    (void)memcpy(output, cadr_m12_provenance_magic,
                 sizeof(cadr_m12_provenance_magic));
    put32(output + 8U, CADR_M12_PROVENANCE_SCHEMA);
    put32(output + 12U, CADR_M12_PROVENANCE_BYTES);
    put32(output + 20U, CADR_M12_ABI_MAJOR);
    put32(output + 24U, CADR_M12_ABI_MINOR);
    put32(output + 28U, CADR_M12_PROTOCOL_VERSION);
    (void)memcpy(output + 32U, provenance->profile_sha256, CADR_M12_SHA256_BYTES);
    (void)memcpy(output + 64U, provenance->core_sha256, CADR_M12_SHA256_BYTES);
    (void)memcpy(output + 96U, provenance->snapshot_sha256, CADR_M12_SHA256_BYTES);
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_provenance_decode(
    const uint8_t input[CADR_M12_PROVENANCE_BYTES],
    cadr_m12_provenance *provenance)
{
    cadr_m12_provenance decoded;
    if (input == NULL || provenance == NULL ||
        memcmp(input, cadr_m12_provenance_magic,
               sizeof(cadr_m12_provenance_magic)) != 0 ||
        get32(input + 8U) != CADR_M12_PROVENANCE_SCHEMA ||
        get32(input + 12U) != CADR_M12_PROVENANCE_BYTES ||
        get32(input + 16U) != 0U || get32(input + 20U) != CADR_M12_ABI_MAJOR ||
        get32(input + 24U) != CADR_M12_ABI_MINOR ||
        get32(input + 28U) != CADR_M12_PROTOCOL_VERSION) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    (void)memcpy(decoded.profile_sha256, input + 32U, CADR_M12_SHA256_BYTES);
    (void)memcpy(decoded.core_sha256, input + 64U, CADR_M12_SHA256_BYTES);
    (void)memcpy(decoded.snapshot_sha256, input + 96U, CADR_M12_SHA256_BYTES);
    if (!provenance_valid(&decoded)) return CADR_M12_STATUS_INVALID_ARGUMENT;
    *provenance = decoded;
    return CADR_M12_STATUS_OK;
}

static int safe_summary(const uint8_t *summary, uint32_t summary_bytes)
{
    uint32_t index;
    if (summary_bytes != 0U && summary == NULL) return 0;
    for (index = 0U; index < summary_bytes; ++index) {
        if (summary[index] < 0x20U || summary[index] > 0x7eU ||
            summary[index] == '/' || summary[index] == '\\' ||
            summary[index] == ':') return 0;
    }
    return 1;
}

static int bug_records_agree(uint32_t terminal_status,
                             const cadr_m12_stop_record *stop,
                             const cadr_m12_provenance *provenance)
{
    if (terminal_status == CADR_M12_STATUS_DEBUG_STOP) {
        if (stop->reason != CADR_M12_STOP_BREAKPOINT) return 0;
    } else if (terminal_status == CADR_M12_STATUS_LIMIT_REACHED) {
        if (stop->reason != CADR_M12_STOP_MACRO_LIMIT ||
            stop->operation_slots != CADR_M12_MACRO_SLOT_LIMIT) return 0;
    } else {
        return 0;
    }
    return memcmp(stop->profile_sha256, provenance->profile_sha256,
                  CADR_M12_SHA256_BYTES) == 0;
}

cadr_m12_status cadr_m12_bug_encode(
    uint32_t terminal_status,
    const uint8_t stop[CADR_M12_STOP_BYTES],
    const uint8_t provenance[CADR_M12_PROVENANCE_BYTES],
    const uint8_t *summary, uint32_t summary_bytes,
    uint8_t *output, uint64_t output_capacity, uint64_t *written)
{
    const uint64_t total = CADR_M12_BUG_HEADER_BYTES + (uint64_t)summary_bytes;
    cadr_m12_stop_record stop_record;
    cadr_m12_provenance provenance_record;
    if (written == NULL || output == NULL ||
        (terminal_status != CADR_M12_STATUS_DEBUG_STOP &&
         terminal_status != CADR_M12_STATUS_LIMIT_REACHED) ||
        total > CADR_M12_BUG_MAX_BYTES || output_capacity < total) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    /* The public bound is established before summary scanning or record reads. */
    if (!safe_summary(summary, summary_bytes) ||
        cadr_m12_stop_decode(stop, &stop_record) != CADR_M12_STATUS_OK ||
        cadr_m12_provenance_decode(provenance, &provenance_record) !=
            CADR_M12_STATUS_OK ||
        !bug_records_agree(terminal_status, &stop_record, &provenance_record)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(output, 0, CADR_M12_BUG_HEADER_BYTES);
    (void)memcpy(output, cadr_m12_bug_magic, sizeof(cadr_m12_bug_magic));
    put32(output + 8U, CADR_M12_BUG_SCHEMA);
    put32(output + 12U, CADR_M12_BUG_HEADER_BYTES);
    put64(output + 16U, total);
    put32(output + 24U, terminal_status);
    put32(output + 28U, summary_bytes);
    (void)memcpy(output + 40U, stop, CADR_M12_STOP_BYTES);
    (void)memcpy(output + 176U, provenance, CADR_M12_PROVENANCE_BYTES);
    if (summary_bytes != 0U) {
        (void)memcpy(output + CADR_M12_BUG_HEADER_BYTES, summary, summary_bytes);
    }
    *written = total;
    return CADR_M12_STATUS_OK;
}

cadr_m12_status cadr_m12_bug_validate(const uint8_t *input,
                                      uint64_t input_bytes)
{
    uint64_t total;
    uint32_t summary_bytes;
    cadr_m12_stop_record stop_record;
    cadr_m12_provenance provenance_record;
    if (input == NULL || input_bytes < CADR_M12_BUG_HEADER_BYTES ||
        input_bytes > CADR_M12_BUG_MAX_BYTES) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    total = get64(input + 16U);
    summary_bytes = get32(input + 28U);
    if (memcmp(input, cadr_m12_bug_magic, sizeof(cadr_m12_bug_magic)) != 0 ||
        get32(input + 8U) != CADR_M12_BUG_SCHEMA ||
        get32(input + 12U) != CADR_M12_BUG_HEADER_BYTES || total != input_bytes ||
        total != CADR_M12_BUG_HEADER_BYTES + (uint64_t)summary_bytes ||
        (get32(input + 24U) != CADR_M12_STATUS_DEBUG_STOP &&
         get32(input + 24U) != CADR_M12_STATUS_LIMIT_REACHED) ||
        get64(input + 32U) != 0U ||
        cadr_m12_stop_decode(input + 40U, &stop_record) != CADR_M12_STATUS_OK ||
        cadr_m12_provenance_decode(input + 176U, &provenance_record) !=
            CADR_M12_STATUS_OK ||
        !bug_records_agree(get32(input + 24U), &stop_record,
                           &provenance_record) ||
        !safe_summary(input + CADR_M12_BUG_HEADER_BYTES, summary_bytes)) {
        return CADR_M12_STATUS_INVALID_ARGUMENT;
    }
    return CADR_M12_STATUS_OK;
}

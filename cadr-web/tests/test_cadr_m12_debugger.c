#include "cadr_m12_debugger.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        ++failures; \
    } \
} while (0)

typedef struct slot_fixture {
    uint32_t increment;
    uint32_t zero_completion;
    uint32_t inhibited;
    uint32_t fault;
    uint32_t device_request;
    uint64_t calls;
} slot_fixture;

static cadr_m12_status slot_callback(void *context,
                                     const cadr_m12_boundary *before,
                                     cadr_m12_slot_completion *completion)
{
    slot_fixture *fixture = context;
    fixture->calls += 1U;
    completion->complete_slots = fixture->zero_completion == 0U ? 1U : 0U;
    completion->inhibited = fixture->inhibited;
    completion->micro_pc_after = before->micro_pc + fixture->increment;
    completion->raw_lc_after = before->raw_lc + 1U;
    completion->fault_after = fixture->fault;
    completion->device_request_after = fixture->device_request;
    return CADR_M12_STATUS_OK;
}

static cadr_m12_status status_callback(void *context,
                                       const cadr_m12_boundary *before,
                                       cadr_m12_slot_completion *completion)
{
    (void)before;
    (void)completion;
    return *(const uint32_t *)context;
}

typedef struct dispatch_fixture {
    uint32_t first;
    uint32_t next;
    uint32_t unavailable;
} dispatch_fixture;

typedef struct macro_fixture {
    slot_fixture slot;
    dispatch_fixture dispatch;
} macro_fixture;

static cadr_m12_dispatch_answer dispatch_oracle(void *context, uint32_t micro_pc)
{
    const dispatch_fixture *fixture = context;
    if (fixture->unavailable != 0U) return CADR_M12_DISPATCH_UNAVAILABLE;
    return micro_pc == fixture->first || micro_pc == fixture->next ?
        CADR_M12_DISPATCH_YES : CADR_M12_DISPATCH_NO;
}

static cadr_m12_dispatch_answer invalid_dispatch_oracle(void *context,
                                                        uint32_t micro_pc)
{
    (void)context;
    (void)micro_pc;
    return (cadr_m12_dispatch_answer)99;
}

static cadr_m12_status macro_slot_callback(void *context,
                                           const cadr_m12_boundary *before,
                                           cadr_m12_slot_completion *completion)
{
    macro_fixture *fixture = context;
    return slot_callback(&fixture->slot, before, completion);
}

static cadr_m12_dispatch_answer macro_dispatch_oracle(void *context,
                                                       uint32_t micro_pc)
{
    macro_fixture *fixture = context;
    return dispatch_oracle(&fixture->dispatch, micro_pc);
}

static void profile_hash(uint8_t output[CADR_M12_SHA256_BYTES], uint8_t seed)
{
    uint32_t index;
    for (index = 0U; index < CADR_M12_SHA256_BYTES; ++index) {
        output[index] = (uint8_t)(seed + index);
    }
}

static void fresh_debugger(cadr_m12_debugger *debugger,
                           cadr_m12_incarnation_domain *domain,
                           uint32_t micro_pc, uint32_t raw_lc, uint8_t seed)
{
    cadr_m12_boundary initial = { micro_pc, raw_lc, 0U, 0U };
    uint8_t hash[CADR_M12_SHA256_BYTES];
    profile_hash(hash, seed);
    (void)memset(debugger, 0, sizeof(*debugger));
    (void)memset(domain, 0, sizeof(*domain));
    CHECK(cadr_m12_incarnation_domain_initialize(domain) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_debugger_initialize(debugger, domain, &initial, UINT64_C(9), hash) ==
          CADR_M12_STATUS_OK);
}

/* Leave every padding byte poisoned while setting every semantic field to its
 * virgin value.  Initialization must not depend on object representation. */
static void poison_debugger_padding(cadr_m12_debugger *debugger)
{
    uint32_t index;
    (void)memset(debugger, 0xa5, sizeof(*debugger));
    for (index = 0U; index < CADR_M12_MAX_BREAKPOINTS; ++index) {
        debugger->breakpoints[index].enabled = 0U;
        debugger->breakpoints[index].kind = 0U;
        debugger->breakpoints[index].value = 0U;
    }
    debugger->current.micro_pc = 0U;
    debugger->current.raw_lc = 0U;
    debugger->current.fault = 0U;
    debugger->current.device_request = 0U;
    debugger->last_stop.reason = 0U;
    debugger->last_stop.breakpoint_index = 0U;
    debugger->last_stop.generation = 0U;
    debugger->last_stop.boundary_ordinal = 0U;
    debugger->last_stop.clock_slot = 0U;
    debugger->last_stop.micro_pc_before = 0U;
    debugger->last_stop.raw_lc_before = 0U;
    debugger->last_stop.micro_pc_after = 0U;
    debugger->last_stop.raw_lc_after = 0U;
    debugger->last_stop.fault_after = 0U;
    debugger->last_stop.device_request_after = 0U;
    debugger->last_stop.inhibited_after = 0U;
    debugger->last_stop.run_ordinal = 0U;
    debugger->last_stop.operation_slots = 0U;
    (void)memset(debugger->last_stop.profile_sha256, 0,
                 CADR_M12_SHA256_BYTES);
    (void)memset(debugger->profile_sha256, 0, CADR_M12_SHA256_BYTES);
    debugger->generation = 0U;
    debugger->clock_slots_completed = 0U;
    debugger->boundary_ordinal = 0U;
    debugger->run_ordinal = 0U;
    debugger->self_token = 0U;
    debugger->incarnation_domain = NULL;
    debugger->incarnation_domain_token = 0U;
    debugger->inspector_owner = NULL;
    debugger->inspector_owner_token = 0U;
    debugger->inspector_owner_incarnation = 0U;
    debugger->paused = 0U;
    debugger->have_stop = 0U;
    debugger->suppression_armed = 0U;
    debugger->suppression_breakpoint_index = 0U;
    debugger->lifecycle = 0U;
    debugger->reserved0 = 0U;
}

static cadr_m12_breakpoint breakpoint(uint32_t kind, uint64_t value)
{
    cadr_m12_breakpoint result = { 1U, kind, value };
    return result;
}

static void test_profile_and_before_suppression(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    cadr_m12_breakpoint pc = breakpoint(CADR_M12_BREAKPOINT_MICRO_PC_BEFORE, 10U);
    slot_fixture fixture = { 1U, 0U, 0U, 0U, 0U, 0U };

    fresh_debugger(&debugger, &domain, 10U, 20U, 1U);
    CHECK(CADR_M12_STATUS_DEBUG_STOP == 19U);
    CHECK(CADR_M12_STATUS_LIMIT_REACHED == 20U);
    CHECK(strcmp(CADR_M12_PROFILE,
                 "CADR-WEB-303/ABI1.7/protocol-v7/C-M12-DBG-v1") == 0);
    CHECK(cadr_m12_breakpoint_set(&debugger, 5U, &pc) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_breakpoint_set(&debugger, 2U, &pc) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_micro_step(&debugger, slot_callback, &fixture) ==
          CADR_M12_STATUS_DEBUG_STOP);
    CHECK(fixture.calls == 0U && debugger.last_stop.breakpoint_index == 2U &&
          debugger.last_stop.micro_pc_before == 10U);
    CHECK(cadr_m12_resume_one_boundary(&debugger) == CADR_M12_STATUS_OK);
    /* One-boundary suppression skips record 2, never the independently
     * matching record 5.  It is not a blanket condition suppression. */
    CHECK(cadr_m12_micro_step(&debugger, slot_callback, &fixture) ==
          CADR_M12_STATUS_DEBUG_STOP);
    CHECK(fixture.calls == 0U && debugger.last_stop.breakpoint_index == 5U &&
          debugger.suppression_armed == 0U);
    CHECK(cadr_m12_breakpoint_clear(&debugger, 2U) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_breakpoint_clear(&debugger, 5U) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_resume_one_boundary(&debugger) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_micro_step(&debugger, slot_callback, &fixture) ==
          CADR_M12_STATUS_OK);
    CHECK(fixture.calls == 1U && debugger.clock_slots_completed == 1U &&
          debugger.current.micro_pc == 11U && debugger.generation == 10U);
}

static void test_complete_inhibited_and_zero_slot(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    slot_fixture inhibited = { 1U, 0U, 1U, 0U, 0U, 0U };
    slot_fixture zero = { 1U, 1U, 0U, 0U, 0U, 0U };
    uint64_t clock_before;
    uint64_t generation_before;

    fresh_debugger(&debugger, &domain, 30U, 40U, 2U);
    CHECK(cadr_m12_micro_step(&debugger, slot_callback, &inhibited) ==
          CADR_M12_STATUS_OK);
    CHECK(inhibited.calls == 1U && debugger.clock_slots_completed == 1U &&
          debugger.current.micro_pc == 31U);
    clock_before = debugger.clock_slots_completed;
    generation_before = debugger.generation;
    CHECK(cadr_m12_micro_step(&debugger, slot_callback, &zero) ==
          CADR_M12_STATUS_NOT_READY);
    CHECK(zero.calls == 1U && debugger.clock_slots_completed == clock_before &&
          debugger.generation == generation_before && debugger.current.micro_pc == 31U);
}

static void test_post_ordering_and_leases(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    cadr_m12_breakpoint clock = breakpoint(CADR_M12_BREAKPOINT_CLOCK_SLOT_AFTER, 1U);
    cadr_m12_breakpoint fault = breakpoint(CADR_M12_BREAKPOINT_FAULT_AFTER, 1U);
    slot_fixture fixture = { 1U, 0U, 1U, 1U, 0U, 0U };
    uint32_t a_memory[1024] = { 0 };
    uint32_t m_memory[32] = { 0 };
    uint32_t dispatch_memory[2048] = { 0 };
    uint32_t pdl[1024] = { 0 };
    uint32_t micro_stack[32] = { 0 };
    cadr_m12_direct_arrays arrays = {
        a_memory, m_memory, dispatch_memory, pdl, micro_stack,
        1024U, 32U, 2048U, 1024U, 32U
    };
    cadr_m12_inspector_owner owner = { 0 };
    cadr_m12_inspector_lease lease;
    uint32_t value = 0U;

    fresh_debugger(&debugger, &domain, 50U, 60U, 3U);
    a_memory[42] = UINT32_C(0xabcdef01);
    CHECK(cadr_m12_inspector_owner_bind(&debugger, &owner, &arrays) ==
          CADR_M12_STATUS_OK);
    CHECK(owner.debugger_token == debugger.self_token &&
          debugger.self_token == (uintptr_t)&debugger);
    CHECK(cadr_m12_inspector_lease_open(&debugger, &lease) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&debugger, &lease,
                                        CADR_M12_ARRAY_A_MEMORY, 42U, &value) ==
          CADR_M12_STATUS_OK && value == UINT32_C(0xabcdef01));
    CHECK(cadr_m12_breakpoint_set(&debugger, 20U, &clock) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_breakpoint_set(&debugger, 10U, &fault) == CADR_M12_STATUS_OK);
    /* Kind priority beats record position: clock-after precedes fault-after. */
    CHECK(cadr_m12_micro_step(&debugger, slot_callback, &fixture) ==
          CADR_M12_STATUS_DEBUG_STOP);
    CHECK(debugger.last_stop.breakpoint_index == 20U &&
          debugger.last_stop.inhibited_after == 1U && debugger.current.fault == 1U);
    CHECK(cadr_m12_inspector_lease_read(&debugger, &lease,
                                        CADR_M12_ARRAY_A_MEMORY, 42U, &value) ==
          CADR_M12_STATUS_STALE_GENERATION);
    CHECK(cadr_m12_inspector_lease_open(&debugger, &lease) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&debugger, &lease,
                                        CADR_M12_ARRAY_A_MEMORY, 1024U, &value) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m12_inspector_owner_retire(&debugger, &owner) ==
          CADR_M12_STATUS_OK);
}

static void test_retired_inspector_storage_is_never_dereferenced(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    cadr_m12_inspector_owner *owner = calloc(1U, sizeof(*owner));
    cadr_m12_direct_arrays arrays = { 0 };
    cadr_m12_inspector_lease lease;
    cadr_m12_inspector_lease replacement_lease;
    cadr_m12_boundary initial = { 70U, 80U, 0U, 0U };
    uint8_t hash[CADR_M12_SHA256_BYTES];
    uint32_t value = 0U;

    fresh_debugger(&debugger, &domain, 70U, 80U, 8U);
    CHECK(owner != NULL);
    arrays.a_memory = calloc(1024U, sizeof(uint32_t));
    arrays.m_memory = calloc(32U, sizeof(uint32_t));
    arrays.dispatch_memory = calloc(2048U, sizeof(uint32_t));
    arrays.pdl = calloc(1024U, sizeof(uint32_t));
    arrays.micro_stack = calloc(32U, sizeof(uint32_t));
    arrays.a_memory_count = 1024U;
    arrays.m_memory_count = 32U;
    arrays.dispatch_memory_count = 2048U;
    arrays.pdl_count = 1024U;
    arrays.micro_stack_count = 32U;
    CHECK(owner != NULL && arrays.a_memory != NULL && arrays.m_memory != NULL &&
          arrays.dispatch_memory != NULL && arrays.pdl != NULL &&
          arrays.micro_stack != NULL);
    if (owner == NULL || arrays.a_memory == NULL || arrays.m_memory == NULL ||
        arrays.dispatch_memory == NULL || arrays.pdl == NULL ||
        arrays.micro_stack == NULL) {
        free((void *)arrays.a_memory);
        free((void *)arrays.m_memory);
        free((void *)arrays.dispatch_memory);
        free((void *)arrays.pdl);
        free((void *)arrays.micro_stack);
        free(owner);
        return;
    }
    ((uint32_t *)arrays.a_memory)[1] = UINT32_C(0x10203040);
    CHECK(cadr_m12_inspector_owner_bind(&debugger, owner, &arrays) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&debugger, &lease) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&debugger, &lease,
                                        CADR_M12_ARRAY_A_MEMORY, 1U, &value) ==
          CADR_M12_STATUS_OK && value == UINT32_C(0x10203040));
    CHECK(cadr_m12_inspector_owner_retire(&debugger, owner) ==
          CADR_M12_STATUS_OK);
    profile_hash(hash, 8U);
    /* Reinitialize the same debugger storage with the same generation, then
     * reuse the same retired owner address.  The old lease must not revive. */
    CHECK(cadr_m12_debugger_reinitialize(&debugger, &domain, &initial,
                                         UINT64_C(9), hash) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_owner_bind(&debugger, owner, &arrays) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&debugger, &replacement_lease) ==
          CADR_M12_STATUS_OK);
    CHECK(replacement_lease.owner_incarnation != lease.owner_incarnation);
    CHECK(cadr_m12_inspector_lease_read(&debugger, &replacement_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 1U, &value) ==
          CADR_M12_STATUS_OK && value == UINT32_C(0x10203040));
    CHECK(cadr_m12_inspector_lease_read(&debugger, &lease,
                                        CADR_M12_ARRAY_A_MEMORY, 1U, &value) ==
          CADR_M12_STATUS_STALE_GENERATION);
    CHECK(cadr_m12_inspector_owner_retire(&debugger, owner) ==
          CADR_M12_STATUS_OK);
    free((void *)arrays.a_memory);
    free((void *)arrays.m_memory);
    free((void *)arrays.dispatch_memory);
    free((void *)arrays.pdl);
    free((void *)arrays.micro_stack);
    free(owner);
    /* ASan proves this stale path reads neither the retired owner nor arrays. */
    CHECK(cadr_m12_inspector_lease_read(&debugger, &lease,
                                        CADR_M12_ARRAY_A_MEMORY, 1U, &value) ==
          CADR_M12_STATUS_STALE_GENERATION);
}

static void test_copied_debugger_rejects_before_owner_dereference(void)
{
    cadr_m12_debugger original;
    cadr_m12_debugger copied;
    cadr_m12_incarnation_domain domain;
    cadr_m12_inspector_owner *owner = calloc(1U, sizeof(*owner));
    cadr_m12_direct_arrays arrays = { 0 };
    cadr_m12_inspector_lease lease;

    fresh_debugger(&original, &domain, 81U, 82U, 17U);
    arrays.a_memory = calloc(1024U, sizeof(uint32_t));
    arrays.m_memory = calloc(32U, sizeof(uint32_t));
    arrays.dispatch_memory = calloc(2048U, sizeof(uint32_t));
    arrays.pdl = calloc(1024U, sizeof(uint32_t));
    arrays.micro_stack = calloc(32U, sizeof(uint32_t));
    arrays.a_memory_count = 1024U;
    arrays.m_memory_count = 32U;
    arrays.dispatch_memory_count = 2048U;
    arrays.pdl_count = 1024U;
    arrays.micro_stack_count = 32U;
    CHECK(owner != NULL && arrays.a_memory != NULL && arrays.m_memory != NULL &&
          arrays.dispatch_memory != NULL && arrays.pdl != NULL &&
          arrays.micro_stack != NULL);
    if (owner == NULL || arrays.a_memory == NULL || arrays.m_memory == NULL ||
        arrays.dispatch_memory == NULL || arrays.pdl == NULL ||
        arrays.micro_stack == NULL) {
        free((void *)arrays.a_memory);
        free((void *)arrays.m_memory);
        free((void *)arrays.dispatch_memory);
        free((void *)arrays.pdl);
        free((void *)arrays.micro_stack);
        free(owner);
        return;
    }
    CHECK(cadr_m12_inspector_owner_bind(&original, owner, &arrays) ==
          CADR_M12_STATUS_OK);
    (void)memcpy(&copied, &original, sizeof(copied));
    CHECK(cadr_m12_inspector_owner_retire(&original, owner) ==
          CADR_M12_STATUS_OK);
    free((void *)arrays.a_memory);
    free((void *)arrays.m_memory);
    free((void *)arrays.dispatch_memory);
    free((void *)arrays.pdl);
    free((void *)arrays.micro_stack);
    free(owner);
    /* ASan proves copied.self_token is rejected before copied's dangling
     * inspector_owner route can be dereferenced. */
    CHECK(cadr_m12_inspector_lease_open(&copied, &lease) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
}

static void test_semantic_virgin_ignores_padding(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain = { 0 };
    cadr_m12_boundary initial = { 21U, 22U, 0U, 0U };
    uint8_t hash[CADR_M12_SHA256_BYTES];
    const uint8_t *representation;
    uint32_t index;
    uint32_t poisoned = 0U;

    poison_debugger_padding(&debugger);
    representation = (const uint8_t *)&debugger;
    for (index = 0U; index < (uint32_t)sizeof(debugger); ++index) {
        if (representation[index] == UINT8_C(0xa5)) poisoned = 1U;
    }
    CHECK(poisoned == 1U);
    profile_hash(hash, 18U);
    CHECK(cadr_m12_incarnation_domain_initialize(&domain) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_debugger_initialize(&debugger, &domain, &initial,
                                       UINT64_C(9), hash) == CADR_M12_STATUS_OK);
    CHECK(debugger.self_token == (uintptr_t)&debugger && debugger.lifecycle != 0U);
}

static void test_incarnation_domain_lifecycle(void)
{
    cadr_m12_incarnation_domain zero_domain = { 0 };
    cadr_m12_incarnation_domain invalid_domain = { 0 };
    cadr_m12_incarnation_domain domain = { 0 };
    cadr_m12_incarnation_domain copied_domain;
    cadr_m12_incarnation_domain moved_domain;
    cadr_m12_debugger debugger = { 0 };
    cadr_m12_debugger copied_debugger = { 0 };
    cadr_m12_boundary initial = { 1U, 2U, 0U, 0U };
    uint8_t hash[CADR_M12_SHA256_BYTES];
    uint8_t debugger_before[sizeof(debugger)];
    uint8_t domain_before[sizeof(domain)];

    profile_hash(hash, 12U);
    invalid_domain.next_incarnation = 1U;
    (void)memcpy(debugger_before, &debugger, sizeof(debugger));
    CHECK(cadr_m12_debugger_initialize(&debugger, &zero_domain, &initial,
                                       UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&debugger, debugger_before, sizeof(debugger)) == 0);
    CHECK(cadr_m12_incarnation_domain_initialize(&invalid_domain) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m12_incarnation_domain_initialize(&domain) == CADR_M12_STATUS_OK &&
          domain.self_token == (uintptr_t)&domain && domain.next_incarnation == 1U);
    (void)memcpy(domain_before, &domain, sizeof(domain));
    CHECK(cadr_m12_incarnation_domain_initialize(&domain) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&domain, domain_before, sizeof(domain)) == 0);
    domain.reserved0 = 1U;
    CHECK(cadr_m12_debugger_initialize(&debugger, &domain, &initial,
                                       UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    (void)memcpy(&domain, domain_before, sizeof(domain));
    domain.lifecycle = 0U;
    CHECK(cadr_m12_debugger_initialize(&debugger, &domain, &initial,
                                       UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    (void)memcpy(&domain, domain_before, sizeof(domain));
    CHECK(cadr_m12_debugger_initialize(&debugger, &domain, &initial,
                                       UINT64_C(9), hash) == CADR_M12_STATUS_OK);
    /* A second call is not reinitialization: the virgin API rejects it. */
    (void)memcpy(debugger_before, &debugger, sizeof(debugger));
    CHECK(cadr_m12_debugger_initialize(&debugger, &domain, &initial,
                                       UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&debugger, debugger_before, sizeof(debugger)) == 0);

    copied_domain = domain;
    CHECK(cadr_m12_debugger_initialize(&copied_debugger, &copied_domain,
                                       &initial, UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    (void)memcpy(&moved_domain, &domain, sizeof(moved_domain));
    (void)memset(&domain, 0, sizeof(domain));
    CHECK(cadr_m12_debugger_initialize(&copied_debugger, &moved_domain,
                                       &initial, UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
}

static void test_reinitialize_requires_no_live_owner(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    cadr_m12_incarnation_domain other_domain = { 0 };
    cadr_m12_boundary initial = { 31U, 32U, 0U, 0U };
    uint8_t hash[CADR_M12_SHA256_BYTES];
    uint32_t a_memory[1024] = { 0 };
    uint32_t m_memory[32] = { 0 };
    uint32_t dispatch_memory[2048] = { 0 };
    uint32_t pdl[1024] = { 0 };
    uint32_t micro_stack[32] = { 0 };
    cadr_m12_direct_arrays arrays = {
        a_memory, m_memory, dispatch_memory, pdl, micro_stack,
        1024U, 32U, 2048U, 1024U, 32U
    };
    cadr_m12_inspector_owner owner = { 0 };
    uint8_t debugger_before[sizeof(debugger)];
    uint8_t domain_before[sizeof(domain)];
    uint8_t owner_before[sizeof(owner)];

    fresh_debugger(&debugger, &domain, 30U, 31U, 13U);
    profile_hash(hash, 14U);
    CHECK(cadr_m12_incarnation_domain_initialize(&other_domain) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_owner_bind(&debugger, &owner, &arrays) ==
          CADR_M12_STATUS_OK);
    (void)memcpy(debugger_before, &debugger, sizeof(debugger));
    (void)memcpy(domain_before, &domain, sizeof(domain));
    (void)memcpy(owner_before, &owner, sizeof(owner));
    CHECK(cadr_m12_debugger_reinitialize(&debugger, &domain, &initial,
                                         UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&debugger, debugger_before, sizeof(debugger)) == 0 &&
          memcmp(&domain, domain_before, sizeof(domain)) == 0 &&
          memcmp(&owner, owner_before, sizeof(owner)) == 0);
    CHECK(cadr_m12_inspector_owner_retire(&debugger, &owner) == CADR_M12_STATUS_OK);
    (void)memcpy(debugger_before, &debugger, sizeof(debugger));
    CHECK(cadr_m12_debugger_reinitialize(&debugger, &other_domain, &initial,
                                         UINT64_C(9), hash) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&debugger, debugger_before, sizeof(debugger)) == 0);
    CHECK(cadr_m12_debugger_reinitialize(&debugger, &domain, &initial,
                                         UINT64_C(9), hash) == CADR_M12_STATUS_OK);
}

static void test_one_domain_serializes_two_debuggers(void)
{
    cadr_m12_incarnation_domain domain = { 0 };
    cadr_m12_debugger first = { 0 };
    cadr_m12_debugger second = { 0 };
    cadr_m12_boundary initial = { 40U, 41U, 0U, 0U };
    uint8_t hash[CADR_M12_SHA256_BYTES];
    uint32_t a_memory[1024] = { 0 };
    uint32_t m_memory[32] = { 0 };
    uint32_t dispatch_memory[2048] = { 0 };
    uint32_t pdl[1024] = { 0 };
    uint32_t micro_stack[32] = { 0 };
    cadr_m12_direct_arrays arrays = {
        a_memory, m_memory, dispatch_memory, pdl, micro_stack,
        1024U, 32U, 2048U, 1024U, 32U
    };
    cadr_m12_inspector_owner first_owner = { 0 };
    cadr_m12_inspector_owner second_owner = { 0 };
    cadr_m12_inspector_lease first_lease;
    cadr_m12_inspector_lease second_lease;
    uint32_t value = 0U;

    profile_hash(hash, 15U);
    CHECK(cadr_m12_incarnation_domain_initialize(&domain) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_debugger_initialize(&first, &domain, &initial, UINT64_C(9), hash) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_debugger_initialize(&second, &domain, &initial, UINT64_C(9), hash) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_owner_bind(&first, &first_owner, &arrays) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&first, &first_lease) == CADR_M12_STATUS_OK);
    /* One caller-serialized domain may allocate distinct simultaneous owners
     * for distinct stable debugger identities. */
    CHECK(cadr_m12_inspector_owner_bind(&second, &second_owner, &arrays) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_open(&second, &second_lease) == CADR_M12_STATUS_OK &&
          second_lease.owner_incarnation > first_lease.owner_incarnation);
    CHECK(cadr_m12_inspector_lease_read(&first, &first_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 0U, &value) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&second, &second_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 0U, &value) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_owner_retire(&first, &first_owner) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_lease_read(&first, &first_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 0U, &value) ==
          CADR_M12_STATUS_STALE_GENERATION);
    CHECK(cadr_m12_inspector_lease_read(&second, &second_lease,
                                        CADR_M12_ARRAY_A_MEMORY, 0U, &value) ==
          CADR_M12_STATUS_OK);
    CHECK(cadr_m12_inspector_owner_retire(&second, &second_owner) ==
          CADR_M12_STATUS_OK);
}

static void test_incarnation_exhaustion_is_nonmutating(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    uint32_t a_memory[1024] = { 0 };
    uint32_t m_memory[32] = { 0 };
    uint32_t dispatch_memory[2048] = { 0 };
    uint32_t pdl[1024] = { 0 };
    uint32_t micro_stack[32] = { 0 };
    cadr_m12_direct_arrays arrays = {
        a_memory, m_memory, dispatch_memory, pdl, micro_stack,
        1024U, 32U, 2048U, 1024U, 32U
    };
    cadr_m12_inspector_owner owner = { 0 };
    uint8_t debugger_before[sizeof(debugger)];
    uint8_t domain_before[sizeof(domain)];
    uint8_t owner_before[sizeof(owner)];

    fresh_debugger(&debugger, &domain, 50U, 51U, 16U);
    domain.next_incarnation = UINT64_MAX;
    (void)memcpy(debugger_before, &debugger, sizeof(debugger));
    (void)memcpy(domain_before, &domain, sizeof(domain));
    (void)memcpy(owner_before, &owner, sizeof(owner));
    CHECK(cadr_m12_inspector_owner_bind(&debugger, &owner, &arrays) ==
          CADR_M12_STATUS_INCARNATION_EXHAUSTED);
    CHECK(memcmp(&debugger, debugger_before, sizeof(debugger)) == 0 &&
          memcmp(&domain, domain_before, sizeof(domain)) == 0 &&
          memcmp(&owner, owner_before, sizeof(owner)) == 0);
}

static void test_callback_status_allowlist(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    uint32_t status = CADR_M12_STATUS_DEBUG_STOP;

    fresh_debugger(&debugger, &domain, 90U, 91U, 9U);
    CHECK(cadr_m12_micro_step(&debugger, status_callback, &status) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(debugger.have_stop == 0U && debugger.clock_slots_completed == 0U);
    status = CADR_M12_STATUS_LIMIT_REACHED;
    CHECK(cadr_m12_micro_step(&debugger, status_callback, &status) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(debugger.have_stop == 0U && debugger.clock_slots_completed == 0U);
    status = UINT32_C(21);
    CHECK(cadr_m12_micro_step(&debugger, status_callback, &status) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    status = UINT32_C(7);
    CHECK(cadr_m12_micro_step(&debugger, status_callback, &status) ==
          UINT32_C(7));
    CHECK(debugger.have_stop == 0U && debugger.clock_slots_completed == 0U);
}

static void test_macro_oracle_and_limit(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    macro_fixture fixture = {
        { 1U, 0U, 0U, 0U, 0U, 0U }, { 100U, 103U, 0U }
    };
    cadr_m12_debugger unlimited;
    cadr_m12_incarnation_domain unlimited_domain;
    macro_fixture one = {
        { 1U, 0U, 0U, 0U, 0U, 0U }, { 200U, UINT32_MAX, 0U }
    };
    cadr_m12_debugger unavailable;
    cadr_m12_incarnation_domain unavailable_domain;
    cadr_m12_debugger invalid;
    cadr_m12_incarnation_domain invalid_domain;
    dispatch_fixture unavailable_dispatch = { 300U, 0U, 1U };

    fresh_debugger(&debugger, &domain, 100U, 0U, 4U);
    fresh_debugger(&unlimited, &unlimited_domain, 200U, 0U, 5U);
    fresh_debugger(&unavailable, &unavailable_domain, 300U, 0U, 6U);
    fresh_debugger(&invalid, &invalid_domain, 301U, 0U, 7U);
    CHECK(cadr_m12_macro_step(&debugger, macro_slot_callback, NULL, &fixture) ==
          CADR_M12_STATUS_ORACLE_UNAVAILABLE);
    CHECK(cadr_m12_macro_step(&debugger, macro_slot_callback, macro_dispatch_oracle, &fixture) ==
          CADR_M12_STATUS_OK);
    CHECK(fixture.slot.calls == 3U && debugger.current.micro_pc == 103U &&
          debugger.clock_slots_completed == 3U);
    CHECK(cadr_m12_macro_step(&unavailable, slot_callback, dispatch_oracle,
                              &unavailable_dispatch) == CADR_M12_STATUS_ORACLE_UNAVAILABLE);
    CHECK(cadr_m12_macro_step(&invalid, slot_callback, invalid_dispatch_oracle,
                              NULL) == CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m12_macro_step(&unlimited, macro_slot_callback, macro_dispatch_oracle, &one) ==
          CADR_M12_STATUS_LIMIT_REACHED);
    CHECK(one.slot.calls == CADR_M12_MACRO_SLOT_LIMIT &&
          unlimited.clock_slots_completed == CADR_M12_MACRO_SLOT_LIMIT &&
          unlimited.last_stop.reason == CADR_M12_STOP_MACRO_LIMIT &&
          unlimited.last_stop.operation_slots == CADR_M12_MACRO_SLOT_LIMIT);
}

static void test_filter_and_fixed_records(void)
{
    cadr_m12_debugger debugger;
    cadr_m12_incarnation_domain domain;
    cadr_m12_breakpoint pc = breakpoint(CADR_M12_BREAKPOINT_MICRO_PC_BEFORE, 7U);
    cadr_m12_stop_record decoded;
    cadr_m12_stop_record macro_stop_record;
    cadr_m12_stop_record bad_macro_stop_record;
    cadr_m12_provenance provenance;
    cadr_m12_provenance mismatched_provenance;
    cadr_m12_provenance decoded_provenance;
    cadr_m12_trace_filter filter = {
        CADR_M12_TRACE_FILTER_MICRO_PC | CADR_M12_TRACE_FILTER_CLOCK_RANGE |
        CADR_M12_TRACE_FILTER_FAULT,
        7U, 2U, 5U
    };
    cadr_m12_trace_record trace = { 3U, 7U, 1U, 0U };
    uint8_t stop[CADR_M12_STOP_BYTES];
    uint8_t macro_stop[CADR_M12_STOP_BYTES];
    uint8_t prov[CADR_M12_PROVENANCE_BYTES];
    uint8_t mismatch_prov[CADR_M12_PROVENANCE_BYTES];
    uint8_t *bug;
    uint8_t *large_summary;
    uint8_t short_bug[1] = { 0U };
    uint64_t written = 0U;
    const uint32_t max_summary_bytes =
        (uint32_t)(CADR_M12_BUG_MAX_BYTES - CADR_M12_BUG_HEADER_BYTES);
    const uint8_t summary[] = "macro limit follows reproducible trace digest";

    fresh_debugger(&debugger, &domain, 7U, 8U, 7U);
    CHECK(cadr_m12_breakpoint_set(&debugger, 0U, &pc) == CADR_M12_STATUS_OK);
    CHECK(cadr_m12_micro_step(&debugger, slot_callback, NULL) ==
          CADR_M12_STATUS_DEBUG_STOP);
    CHECK(cadr_m12_stop_encode(&debugger.last_stop, stop) == CADR_M12_STATUS_OK);
    CHECK(memcmp(stop, "CDRDBGSTOP1", 11U) == 0 && stop[11] == 0U &&
          stop[16] == CADR_M12_STOP_BYTES && stop[17] == 0U);
    CHECK(cadr_m12_stop_decode(stop, &decoded) == CADR_M12_STATUS_OK &&
          decoded.breakpoint_index == 0U && decoded.micro_pc_before == 7U);
    stop[84] = 1U;
    CHECK(cadr_m12_stop_decode(stop, &decoded) == CADR_M12_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_m12_stop_encode(&debugger.last_stop, stop) == CADR_M12_STATUS_OK);

    (void)memcpy(provenance.profile_sha256, debugger.profile_sha256,
                 CADR_M12_SHA256_BYTES);
    profile_hash(provenance.core_sha256, 30U);
    profile_hash(provenance.snapshot_sha256, 60U);
    CHECK(cadr_m12_provenance_encode(&provenance, prov) == CADR_M12_STATUS_OK);
    CHECK(memcmp(prov, "CDRPROV1", 8U) == 0 &&
          cadr_m12_provenance_decode(prov, &decoded_provenance) == CADR_M12_STATUS_OK &&
          memcmp(decoded_provenance.core_sha256, provenance.core_sha256,
                 CADR_M12_SHA256_BYTES) == 0);

    CHECK(cadr_m12_trace_filter_validate(&filter) == CADR_M12_STATUS_OK &&
          cadr_m12_trace_filter_matches(&filter, &trace) != 0);
    CHECK(cadr_m12_bug_validate(short_bug, sizeof(short_bug)) ==
          CADR_M12_STATUS_INVALID_ARGUMENT);
    trace.clock_slot = 6U;
    CHECK(cadr_m12_trace_filter_matches(&filter, &trace) == 0);
    filter.first_clock_slot = 6U;
    filter.last_clock_slot = 5U;
    CHECK(cadr_m12_trace_filter_validate(&filter) == CADR_M12_STATUS_INVALID_ARGUMENT);

    bug = malloc((size_t)CADR_M12_BUG_MAX_BYTES);
    large_summary = malloc(max_summary_bytes);
    CHECK(bug != NULL && large_summary != NULL);
    if (bug != NULL && large_summary != NULL) {
        (void)memset(large_summary, 'x', max_summary_bytes);
        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_DEBUG_STOP, stop, prov,
                                  summary, (uint32_t)(sizeof(summary) - 1U), bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) == CADR_M12_STATUS_OK);
        CHECK(written == CADR_M12_BUG_HEADER_BYTES + sizeof(summary) - 1U &&
              cadr_m12_bug_validate(bug, written) == CADR_M12_STATUS_OK);
        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_DEBUG_STOP, stop, prov,
                                  (const uint8_t *)"/private", 8U, bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);
        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_DEBUG_STOP, stop, prov,
                                  large_summary, max_summary_bytes, bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_OK);
        CHECK(written == CADR_M12_BUG_MAX_BYTES &&
              cadr_m12_bug_validate(bug, written) == CADR_M12_STATUS_OK);
        /* Oversize bounds are checked before touching any supplied address. */
        CHECK(cadr_m12_bug_encode(
                  CADR_M12_STATUS_DEBUG_STOP,
                  stop,
                  prov,
                  (const uint8_t *)(uintptr_t)1,
                  max_summary_bytes + 1U,
                  bug,
                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);
        CHECK(cadr_m12_bug_validate((const uint8_t *)(uintptr_t)1,
                                    CADR_M12_BUG_MAX_BYTES + 1U) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);

        macro_stop_record = debugger.last_stop;
        macro_stop_record.reason = CADR_M12_STOP_MACRO_LIMIT;
        macro_stop_record.breakpoint_index = UINT32_MAX;
        macro_stop_record.operation_slots = CADR_M12_MACRO_SLOT_LIMIT;
        CHECK(cadr_m12_stop_encode(&macro_stop_record, macro_stop) ==
              CADR_M12_STATUS_OK);
        bad_macro_stop_record = macro_stop_record;
        bad_macro_stop_record.operation_slots =
            CADR_M12_MACRO_SLOT_LIMIT - 1U;
        CHECK(cadr_m12_stop_encode(&bad_macro_stop_record, macro_stop) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);
        CHECK(cadr_m12_stop_encode(&macro_stop_record, macro_stop) ==
              CADR_M12_STATUS_OK);

        /* BUG-X01/X02: status and embedded stop reason are bidirectional. */
        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_DEBUG_STOP, macro_stop, prov,
                                  summary, (uint32_t)(sizeof(summary) - 1U), bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);
        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_LIMIT_REACHED, stop, prov,
                                  summary, (uint32_t)(sizeof(summary) - 1U), bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);
        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_LIMIT_REACHED, macro_stop, prov,
                                  summary, (uint32_t)(sizeof(summary) - 1U), bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_OK);
        CHECK(cadr_m12_bug_validate(bug, written) == CADR_M12_STATUS_OK);
        /* Valid record bytes with only status changed exercise decode checks. */
        bug[24] = (uint8_t)CADR_M12_STATUS_DEBUG_STOP;
        CHECK(cadr_m12_bug_validate(bug, written) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);

        /* BUG-X03: stop and provenance profile digests must agree. */
        mismatched_provenance = provenance;
        mismatched_provenance.profile_sha256[0] ^= UINT8_C(0xff);
        CHECK(cadr_m12_provenance_encode(&mismatched_provenance, mismatch_prov) ==
              CADR_M12_STATUS_OK);
        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_DEBUG_STOP, stop,
                                  mismatch_prov, summary,
                                  (uint32_t)(sizeof(summary) - 1U), bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);

        CHECK(cadr_m12_bug_encode(CADR_M12_STATUS_DEBUG_STOP, stop, prov,
                                  summary, (uint32_t)(sizeof(summary) - 1U), bug,
                                  CADR_M12_BUG_MAX_BYTES, &written) ==
              CADR_M12_STATUS_OK);
        bug[32] = 1U;
        CHECK(cadr_m12_bug_validate(bug, written) ==
              CADR_M12_STATUS_INVALID_ARGUMENT);
    }
    free(large_summary);
    free(bug);
}

int main(void)
{
    test_profile_and_before_suppression();
    test_complete_inhibited_and_zero_slot();
    test_post_ordering_and_leases();
    test_retired_inspector_storage_is_never_dereferenced();
    test_copied_debugger_rejects_before_owner_dereference();
    test_semantic_virgin_ignores_padding();
    test_incarnation_domain_lifecycle();
    test_reinitialize_requires_no_live_owner();
    test_one_domain_serializes_two_debuggers();
    test_incarnation_exhaustion_is_nonmutating();
    test_callback_status_allowlist();
    test_macro_oracle_and_limit();
    test_filter_and_fixed_records();
    if (failures != 0) {
        (void)fprintf(stderr, "%d C-M12 tests failed\n", failures);
        return EXIT_FAILURE;
    }
    (void)puts("C-M12 debugger tests passed");
    return EXIT_SUCCESS;
}

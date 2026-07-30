#ifndef CADR_M12_DEBUGGER_H
#define CADR_M12_DEBUGGER_H

/*
 * C-M12 Phase 1 debugger model.  This is deliberately outside cadr_host_api.h
 * until the cumulative ABI 1.10 and protocol v7 are integrated.  It never executes a core
 * slot itself: a future core adapter supplies the narrow callback below.
 */

#include <stdint.h>

#define CADR_M12_PROFILE \
    "CADR-WEB-303/ABI1.10/protocol-v7/C-M12-DBG-v1"
#define CADR_M12_ABI_MAJOR UINT32_C(1)
#define CADR_M12_ABI_MINOR UINT32_C(10)
#define CADR_M12_PROTOCOL_VERSION UINT32_C(7)

#define CADR_M12_MAX_BREAKPOINTS UINT32_C(64)
#define CADR_M12_MACRO_SLOT_LIMIT UINT64_C(1048576)
#define CADR_M12_STOP_BYTES UINT32_C(136)
#define CADR_M12_PROVENANCE_BYTES UINT32_C(128)
#define CADR_M12_BUG_HEADER_BYTES UINT32_C(304)
#define CADR_M12_BUG_MAX_BYTES UINT64_C(1048576)
#define CADR_M12_SHA256_BYTES UINT32_C(32)

typedef uint32_t cadr_m12_status;

#define CADR_M12_STATUS_OK               UINT32_C(0)
#define CADR_M12_STATUS_INVALID_ARGUMENT UINT32_C(2)
#define CADR_M12_STATUS_STALE_GENERATION UINT32_C(3)
#define CADR_M12_STATUS_NOT_READY        UINT32_C(9)
#define CADR_M12_STATUS_ORACLE_UNAVAILABLE UINT32_C(13)
/* These are response statuses, never durable machine lifecycle values. */
#define CADR_M12_STATUS_DEBUG_STOP       UINT32_C(19)
#define CADR_M12_STATUS_LIMIT_REACHED    UINT32_C(20)
/* This is a nonterminal, operation-scoped allocator result.  It is not a
 * debugger lifecycle or protocol terminal status. */
#define CADR_M12_STATUS_INCARNATION_EXHAUSTED UINT32_C(21)

typedef enum cadr_m12_breakpoint_kind {
    CADR_M12_BREAKPOINT_MICRO_PC_BEFORE = 1,
    CADR_M12_BREAKPOINT_RAW_LC_BEFORE = 2,
    CADR_M12_BREAKPOINT_CLOCK_SLOT_AFTER = 3,
    CADR_M12_BREAKPOINT_FAULT_AFTER = 4,
    CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER = 5
} cadr_m12_breakpoint_kind;

typedef enum cadr_m12_stop_reason {
    CADR_M12_STOP_BREAKPOINT = 1,
    CADR_M12_STOP_MACRO_LIMIT = 2
} cadr_m12_stop_reason;

typedef enum cadr_m12_direct_array_kind {
    CADR_M12_ARRAY_A_MEMORY = 1,
    CADR_M12_ARRAY_M_MEMORY = 2,
    CADR_M12_ARRAY_DISPATCH_MEMORY = 3,
    CADR_M12_ARRAY_PDL = 4,
    CADR_M12_ARRAY_MICRO_STACK = 5
} cadr_m12_direct_array_kind;

typedef enum cadr_m12_dispatch_answer {
    CADR_M12_DISPATCH_NO = 0,
    CADR_M12_DISPATCH_YES = 1,
    CADR_M12_DISPATCH_UNAVAILABLE = 2
} cadr_m12_dispatch_answer;

typedef struct cadr_m12_boundary {
    uint32_t micro_pc;
    uint32_t raw_lc;
    uint32_t fault;
    uint32_t device_request;
} cadr_m12_boundary;

/* A completed outer slot is exactly one.  An inhibited completed slot has
 * complete_slots == 1 and inhibited == 1.  A zero completion changes neither
 * debugger boundary state nor generation. */
typedef struct cadr_m12_slot_completion {
    uint32_t complete_slots;
    uint32_t inhibited;
    uint32_t micro_pc_after;
    uint32_t raw_lc_after;
    uint32_t fault_after;
    uint32_t device_request_after;
} cadr_m12_slot_completion;

typedef struct cadr_m12_breakpoint {
    uint32_t enabled;
    uint32_t kind;
    uint64_t value;
} cadr_m12_breakpoint;

typedef struct cadr_m12_stop_record {
    uint32_t reason;
    uint32_t breakpoint_index;
    uint64_t generation;
    uint64_t boundary_ordinal;
    uint64_t clock_slot;
    uint32_t micro_pc_before;
    uint32_t raw_lc_before;
    uint32_t micro_pc_after;
    uint32_t raw_lc_after;
    uint32_t fault_after;
    uint32_t device_request_after;
    uint32_t inhibited_after;
    uint64_t run_ordinal;
    uint64_t operation_slots;
    uint8_t profile_sha256[CADR_M12_SHA256_BYTES];
} cadr_m12_stop_record;

typedef struct cadr_m12_provenance {
    uint8_t profile_sha256[CADR_M12_SHA256_BYTES];
    uint8_t core_sha256[CADR_M12_SHA256_BYTES];
    uint8_t snapshot_sha256[CADR_M12_SHA256_BYTES];
} cadr_m12_provenance;

typedef struct cadr_m12_direct_arrays {
    const uint32_t *a_memory;
    const uint32_t *m_memory;
    const uint32_t *dispatch_memory;
    const uint32_t *pdl;
    const uint32_t *micro_stack;
    uint32_t a_memory_count;
    uint32_t m_memory_count;
    uint32_t dispatch_memory_count;
    uint32_t pdl_count;
    uint32_t micro_stack_count;
} cadr_m12_direct_arrays;

/*
 * Caller-owned, process-local identity domain for inspector-owner leases.
 * It MUST be zero-initialized and initialized once at a stable address with
 * cadr_m12_incarnation_domain_initialize.  It MUST NOT be copied, moved,
 * serialized, or reinitialized while any debugger, owner, or lease can refer
 * to its lineage.  The caller serializes all users of one domain.
 */
typedef struct cadr_m12_incarnation_domain {
    uintptr_t self_token;
    uint64_t next_incarnation;
    uint32_t lifecycle;
    uint32_t reserved0;
} cadr_m12_incarnation_domain;

/* The owner fences direct array lifetime independently from a lease.  It must
 * be zero-initialized, bound at a stable address, and retired before the owner
 * or any of its arrays cease to exist.  A retired zeroed owner may be rebound;
 * its new incarnation does not revive an old lease. */
typedef struct cadr_m12_inspector_owner {
    uintptr_t self_token;
    uintptr_t debugger_token;
    uint64_t incarnation;
    cadr_m12_direct_arrays arrays;
    uint32_t lifecycle;
    uint32_t reserved0;
} cadr_m12_inspector_owner;

typedef struct cadr_m12_inspector_lease {
    uintptr_t debugger_token;
    uintptr_t owner_token;
    uint64_t generation;
    uint64_t owner_incarnation;
} cadr_m12_inspector_lease;

/* This describes an already retained trace item.  Filtering is a pure
 * predicate; no C-M12 API drains, consumes, or owns trace records. */
typedef struct cadr_m12_trace_record {
    uint64_t clock_slot;
    uint32_t micro_pc;
    uint32_t fault;
    uint32_t device_request;
} cadr_m12_trace_record;

#define CADR_M12_TRACE_FILTER_MICRO_PC UINT32_C(1)
#define CADR_M12_TRACE_FILTER_CLOCK_RANGE UINT32_C(2)
#define CADR_M12_TRACE_FILTER_FAULT UINT32_C(4)
#define CADR_M12_TRACE_FILTER_DEVICE_REQUEST UINT32_C(8)
#define CADR_M12_TRACE_FILTER_KNOWN \
    (CADR_M12_TRACE_FILTER_MICRO_PC | CADR_M12_TRACE_FILTER_CLOCK_RANGE | \
     CADR_M12_TRACE_FILTER_FAULT | CADR_M12_TRACE_FILTER_DEVICE_REQUEST)

typedef struct cadr_m12_trace_filter {
    uint32_t flags;
    uint32_t micro_pc;
    uint64_t first_clock_slot;
    uint64_t last_clock_slot;
} cadr_m12_trace_filter;

/* A debugger is caller-owned, zero-initialized, and bound to its address by
 * initialization.  A live debugger MUST NOT be copied, moved, or serialized;
 * use cadr_m12_debugger_reinitialize for ownerless same-domain reuse. */
typedef struct cadr_m12_debugger {
    cadr_m12_breakpoint breakpoints[CADR_M12_MAX_BREAKPOINTS];
    cadr_m12_boundary current;
    cadr_m12_stop_record last_stop;
    uint8_t profile_sha256[CADR_M12_SHA256_BYTES];
    uint64_t generation;
    uint64_t clock_slots_completed;
    uint64_t boundary_ordinal;
    uint64_t run_ordinal;
    uintptr_t self_token;
    cadr_m12_incarnation_domain *incarnation_domain;
    uintptr_t incarnation_domain_token;
    cadr_m12_inspector_owner *inspector_owner;
    uintptr_t inspector_owner_token;
    uint64_t inspector_owner_incarnation;
    uint32_t paused;
    uint32_t have_stop;
    uint32_t suppression_armed;
    uint32_t suppression_breakpoint_index;
    uint32_t lifecycle;
    uint32_t reserved0;
} cadr_m12_debugger;

typedef cadr_m12_status (*cadr_m12_clock_slot_callback)(
    void *context, const cadr_m12_boundary *before,
    cadr_m12_slot_completion *completion);
typedef cadr_m12_dispatch_answer (*cadr_m12_dispatch_oracle)(
    void *context, uint32_t micro_pc);

cadr_m12_status cadr_m12_debugger_initialize(
    cadr_m12_debugger *debugger, cadr_m12_incarnation_domain *domain,
    const cadr_m12_boundary *initial,
    uint64_t generation,
    const uint8_t profile_sha256[CADR_M12_SHA256_BYTES]);
cadr_m12_status cadr_m12_incarnation_domain_initialize(
    cadr_m12_incarnation_domain *domain);
/* Reinitialization never changes domain identity.  It is permitted only for
 * a valid paused debugger with no live owner, so existing leases are already
 * stale and a later bind receives a nonrecycled domain incarnation. */
cadr_m12_status cadr_m12_debugger_reinitialize(
    cadr_m12_debugger *debugger, cadr_m12_incarnation_domain *domain,
    const cadr_m12_boundary *initial,
    uint64_t generation,
    const uint8_t profile_sha256[CADR_M12_SHA256_BYTES]);
cadr_m12_status cadr_m12_breakpoint_set(cadr_m12_debugger *debugger,
                                         uint32_t index,
                                         const cadr_m12_breakpoint *breakpoint);
cadr_m12_status cadr_m12_breakpoint_clear(cadr_m12_debugger *debugger,
                                           uint32_t index);
/* Arms only the breakpoint that caused the last stop, for the current single
 * boundary.  Every other matching breakpoint remains effective. */
cadr_m12_status cadr_m12_resume_one_boundary(cadr_m12_debugger *debugger);
cadr_m12_status cadr_m12_micro_step(cadr_m12_debugger *debugger,
                                     cadr_m12_clock_slot_callback callback,
                                     void *context);
cadr_m12_status cadr_m12_macro_step(cadr_m12_debugger *debugger,
                                     cadr_m12_clock_slot_callback callback,
                                     cadr_m12_dispatch_oracle dispatch_oracle,
                                     void *context);

cadr_m12_status cadr_m12_inspector_owner_bind(
    cadr_m12_debugger *debugger, cadr_m12_inspector_owner *owner,
    const cadr_m12_direct_arrays *arrays);
cadr_m12_status cadr_m12_inspector_owner_retire(
    cadr_m12_debugger *debugger, cadr_m12_inspector_owner *owner);
cadr_m12_status cadr_m12_inspector_lease_open(
    const cadr_m12_debugger *debugger, cadr_m12_inspector_lease *lease);
cadr_m12_status cadr_m12_inspector_lease_read(
    const cadr_m12_debugger *debugger, const cadr_m12_inspector_lease *lease,
    uint32_t array_kind, uint32_t index, uint32_t *value);

cadr_m12_status cadr_m12_trace_filter_validate(
    const cadr_m12_trace_filter *filter);
int cadr_m12_trace_filter_matches(const cadr_m12_trace_filter *filter,
                                  const cadr_m12_trace_record *record);

cadr_m12_status cadr_m12_stop_encode(
    const cadr_m12_stop_record *record,
    uint8_t output[CADR_M12_STOP_BYTES]);
cadr_m12_status cadr_m12_stop_decode(
    const uint8_t input[CADR_M12_STOP_BYTES], cadr_m12_stop_record *record);
cadr_m12_status cadr_m12_provenance_encode(
    const cadr_m12_provenance *provenance,
    uint8_t output[CADR_M12_PROVENANCE_BYTES]);
cadr_m12_status cadr_m12_provenance_decode(
    const uint8_t input[CADR_M12_PROVENANCE_BYTES],
    cadr_m12_provenance *provenance);
/* CDRBUG1 carries only a stop record, fixed digests, and a restricted short
 * summary.  It has no fields for mutable media, raw arrays, pixels, input
 * events, or local paths. */
cadr_m12_status cadr_m12_bug_encode(
    uint32_t terminal_status,
    const uint8_t stop[CADR_M12_STOP_BYTES],
    const uint8_t provenance[CADR_M12_PROVENANCE_BYTES],
    const uint8_t *summary, uint32_t summary_bytes,
    uint8_t *output, uint64_t output_capacity, uint64_t *written);
cadr_m12_status cadr_m12_bug_validate(const uint8_t *input,
                                      uint64_t input_bytes);

#endif

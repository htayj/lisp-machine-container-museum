#ifndef CADR_M6_LISTENER_PROBE_H
#define CADR_M6_LISTENER_PROBE_H

#include <stdint.h>

/*
 * Read-only M6 Listener-ready conjunction.  A future native object decoder
 * fills this record from one instruction-boundary snapshot; this module never
 * follows guest pointers, writes guest memory, or interprets framebuffer bits.
 *
 * Source basis: SYS: WINDOW; BASWIN defines LISP-LISTENER :LISP-LISTENER-P as
 * :IDLE exactly when its process is outside SI:LISP-TOP-LEVEL-INSIDE-EVAL.
 */
#define CADR_M6_LISTENER_PROBE_ABI UINT32_C(2)

enum cadr_m6_listener_probe_status {
    CADR_M6_LISTENER_PROBE_READY = 1,
    CADR_M6_LISTENER_PROBE_NOT_READY = 2,
    CADR_M6_LISTENER_PROBE_BLOCKED_NO_OBJECT_DECODER = 3
};

struct cadr_m6_listener_snapshot {
    uint32_t abi;
    /* The exact tagged-object identity bound to TV:INITIAL-LISP-LISTENER. */
    uint64_t initial_listener_identity;
    /* The selected window must be that same exact object, not merely its class. */
    uint64_t selected_window_identity;
    uint32_t initial_listener_is_lisp_listener;
    uint32_t initial_listener_is_exposed;
    uint32_t listener_lisp_listener_p_is_idle;
    uint32_t listener_owner_process_live;
    uint32_t listener_owner_stack_group_live;
    uint32_t listener_stack_at_read_for_top_level;
    uint32_t listener_input_buffer_empty;
    uint32_t listener_has_no_partial_form;
    uint32_t boot_prompt_phase_accepted;
    uint32_t disk_busy;
    uint32_t host_request_pending;
    /* Derived by the boundary oracle, not inferred from a host-side timeout. */
    uint32_t oracle_quiescent_suffix_confirmed;
};

uint32_t cadr_m6_listener_probe(const struct cadr_m6_listener_snapshot *snapshot);
const char *cadr_m6_listener_probe_status_name(uint32_t status);

#endif

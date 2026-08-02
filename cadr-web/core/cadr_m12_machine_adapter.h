#ifndef CADR_M12_MACHINE_ADAPTER_H
#define CADR_M12_MACHINE_ADAPTER_H

/*
 * C-M12's narrow integration seam.  The adapter owns the nonserializable
 * debugger/domain/inspector identities; the machine remains the sole owner of
 * mutable CADR state.  It deliberately exposes no write route into the core.
 */

#include "cadr_m12_debugger.h"
#include "cadr_machine.h"

typedef struct cadr_m12_machine_adapter {
    cadr_m12_incarnation_domain domain;
    cadr_m12_debugger debugger;
    cadr_m12_inspector_owner inspector_owner;
    cadr_machine *machine;
    /* Host-side view state.  It is deliberately not part of CDRM12C1: a
     * breakpoint configuration restore must not silently import a different
     * viewer's trace-selection policy. */
    cadr_m12_trace_filter trace_filter;
    uint32_t trace_filter_installed;
    uint32_t initialized;
    uint32_t reserved0;
} cadr_m12_machine_adapter;

#define CADR_M12_CONFIG_SNAPSHOT_BYTES UINT32_C(1088)

/* The caller must zero-initialize storage before the first initialize call.
 * Destroy clears the active payload but retains the same-address domain's
 * nonrecycled incarnation sequence for safe later reuse. */
cadr_m12_status cadr_m12_machine_adapter_initialize(
    cadr_m12_machine_adapter *adapter, cadr_machine *machine);
/* A successful reset or snapshot replacement invalidates all leases before
 * this call rebinds the stable adapter to the replacement machine. */
cadr_m12_status cadr_m12_machine_adapter_rebind(
    cadr_m12_machine_adapter *adapter, cadr_machine *machine);
/* Purely validates that a later rebind may reserve a distinct owner
 * incarnation.  This is used before an enclosing transaction changes core
 * state, so CADR_M12_STATUS_INCARNATION_EXHAUSTED cannot leave an adapter
 * detached from its machine. */
cadr_m12_status cadr_m12_machine_adapter_rebind_preflight(
    const cadr_m12_machine_adapter *adapter, const cadr_machine *machine);
void cadr_m12_machine_adapter_destroy(cadr_m12_machine_adapter *adapter);

cadr_m12_status cadr_m12_machine_adapter_breakpoint_set(
    cadr_m12_machine_adapter *adapter, uint32_t index,
    const cadr_m12_breakpoint *breakpoint);
cadr_m12_status cadr_m12_machine_adapter_breakpoint_clear(
    cadr_m12_machine_adapter *adapter, uint32_t index);
cadr_m12_status cadr_m12_machine_adapter_resume_one_boundary(
    cadr_m12_machine_adapter *adapter);
cadr_m12_status cadr_m12_machine_adapter_micro_step(
    cadr_m12_machine_adapter *adapter);
cadr_m12_status cadr_m12_machine_adapter_macro_step(
    cadr_m12_machine_adapter *adapter);
cadr_m12_status cadr_m12_machine_adapter_stop_copy(
    const cadr_m12_machine_adapter *adapter,
    uint8_t output[CADR_M12_STOP_BYTES]);
cadr_m12_status cadr_m12_machine_adapter_trace_filter(
    cadr_m12_machine_adapter *adapter,
    const cadr_m12_trace_filter *filter);
/* A retained-trace owner calls this predicate before it exposes one already
 * retained record.  C-M12 does not own, drain, or serialize that trace. */
int cadr_m12_machine_adapter_trace_filter_matches(
    const cadr_m12_machine_adapter *adapter,
    const cadr_m12_trace_record *record);
/* CDRM12C1 is a fixed, pointer-free breakpoint configuration snapshot.  It
 * does not revive inspector leases, stop records, pause state, or callbacks. */
cadr_status cadr_m12_machine_adapter_config_snapshot_serialize(
    const cadr_m12_machine_adapter *adapter, uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES]);
cadr_status cadr_m12_machine_adapter_config_snapshot_restore(
    cadr_m12_machine_adapter *adapter, const uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES]);
/*
 * Atomically rebinds a live adapter to an unpublished replacement machine and
 * adopts one already validated-by-layout CDRM12C1 configuration.  Every
 * machine/config/domain precondition is checked before the live inspector
 * owner is retired.  After that retirement the remaining reinitialization,
 * owner bind, and breakpoint publication have no fallible branch.
 */
cadr_m12_status cadr_m12_machine_adapter_rebind_config_snapshot(
    cadr_m12_machine_adapter *adapter, cadr_machine *machine,
    const uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES]);

#endif

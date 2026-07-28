#ifndef CADR_MACHINE_H
#define CADR_MACHINE_H

#include "cadr_state.h"

/* This definition is deliberately internal; public clients see an opaque type. */
struct cadr_machine {
    cadr_machine_state state;
};

/* Internal device-module contract; it is intentionally absent from the ABI. */
cadr_status cadr_machine_issue_host_request(cadr_machine *machine,
                                            uint32_t operation,
                                            const uint8_t *descriptor_bytes,
                                            uint64_t descriptor_byte_count,
                                            uint64_t completion_byte_count);

void cadr_canonical_write_u32(cadr_machine_state *state, uint32_t family,
                              uint32_t index, uint32_t old_value,
                              uint32_t new_value);

/* State-only integration seams used by atomic snapshot restore. */
cadr_status cadr_canonical_rebuild(cadr_machine_state *state);
cadr_status cadr_boundary_digest_state(
    const cadr_machine_state *state,
    uint8_t digest[CADR_SHA256_BYTES]);

#endif

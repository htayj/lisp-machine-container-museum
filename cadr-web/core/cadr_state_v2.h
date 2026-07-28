#ifndef CADR_STATE_V2_H
#define CADR_STATE_V2_H

/*
 * Internal CDRSTATE2 continuation-state digest contract.
 *
 * This interface deliberately has no public-ABI entry point.  The host-facing
 * snapshot and trace layers bind the resulting digest, while production write
 * paths call the narrowly typed update hooks below.  No hook changes M1's
 * CDRSTATE1 mutation transcript.
 */

#include <stdint.h>

#include "cadr_state.h"

enum cadr_state_v2_root {
    CADR_STATE_V2_ROOT_PROM = 0,
    CADR_STATE_V2_ROOT_IMEM = 1,
    CADR_STATE_V2_ROOT_AMEM = 2,
    CADR_STATE_V2_ROOT_MMEM = 3,
    CADR_STATE_V2_ROOT_DISPATCH = 4,
    CADR_STATE_V2_ROOT_PDL = 5,
    CADR_STATE_V2_ROOT_SPC = 6,
    CADR_STATE_V2_ROOT_L1 = 7,
    CADR_STATE_V2_ROOT_L2 = 8,
    CADR_STATE_V2_ROOT_MAIN_RAM = 9,
    CADR_STATE_V2_ROOT_TV_SYNC = 10,
    CADR_STATE_V2_ROOT_TV_SCREEN = 11,
    CADR_STATE_V2_ROOT_BUS_MAPS = 12
};

enum cadr_state_v2_schema_kind {
    CADR_STATE_V2_SCHEMA_SCALAR = 1,
    CADR_STATE_V2_SCHEMA_BYTES = 2,
    CADR_STATE_V2_SCHEMA_ROOT = 3
};

typedef struct cadr_state_v2_schema_entry {
    uint32_t tag;
    uint32_t kind;
    const char *name;
} cadr_state_v2_schema_entry;

/*
 * The current schema is an intentionally explicit review boundary: adding a
 * logical continuation field requires updating this ledger, the tagged
 * serializer, and the state-schema coverage test in lockstep.
 */
#define CADR_STATE_V2_SCHEMA_VERSION UINT32_C(1)

uint32_t cadr_state_v2_schema_entry_count(void);
const cadr_state_v2_schema_entry *cadr_state_v2_schema_entries(void);

/* Full O(state) cache construction; call at controlled import/restore edges. */
cadr_status cadr_state_v2_rebuild(cadr_machine_state *state);

/* A bulk state rewrite invalidates roots until the lifecycle owner rebuilds them. */
void cadr_state_v2_invalidate(cadr_machine_state *state);

/* Recomputes only the logical CDRSTATE2 stream from scalars and cached roots. */
cadr_status cadr_state_v2_digest(const cadr_machine_state *state,
                                 uint8_t digest[CADR_SHA256_BYTES]);

/*
 * Write hooks update one bounded Merkle path after the owning array element has
 * been written.  They are no-ops before `cadr_state_v2_rebuild`, allowing cold
 * construction to populate state without a partial cache.
 */
void cadr_state_v2_note_u64_write(cadr_machine_state *state,
                                  enum cadr_state_v2_root root,
                                  uint32_t index);
void cadr_state_v2_note_u32_write(cadr_machine_state *state,
                                  enum cadr_state_v2_root root,
                                  uint32_t index);
void cadr_state_v2_note_u8_write(cadr_machine_state *state,
                                 enum cadr_state_v2_root root,
                                 uint32_t index);
void cadr_state_v2_note_bus_map_write(cadr_machine_state *state,
                                      uint32_t index);

/* Completion bytes are logical state while their allocation pointer is not. */
void cadr_state_v2_note_completion_changed(cadr_machine_state *state);

/* A debug/test-only consistency check: fresh cache roots must equal cached roots. */
cadr_status cadr_state_v2_verify_cache(const cadr_machine_state *state);

/* Narrow test seam, absent from normal core builds and the public ABI. */
#ifdef CADR_STATE_V2_TESTING
void cadr_state_v2_test_sha256(const uint8_t *bytes, uint64_t count,
                               uint8_t digest[CADR_SHA256_BYTES]);
#endif

#endif

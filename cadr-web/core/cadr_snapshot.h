/*
 * CDRSNAP1 is the internal, deterministic state-transfer representation for
 * the selected CADR-WEB-303 profile.  It is deliberately not part of the
 * host ABI: a host may only receive a restored machine after the core's
 * semantic-state verifier has accepted it.
 */
#ifndef CADR_SNAPSHOT_H
#define CADR_SNAPSHOT_H

#include <stdint.h>

#include "cadr_machine.h"

#ifdef __cplusplus
extern "C" {
#endif

#define CADR_SNAPSHOT_CDRSTATE2_BYTES CADR_SHA256_BYTES
#define CADR_SNAPSHOT_CDRSTATE1_BYTES CADR_SHA256_BYTES
#define CADR_SNAPSHOT_FORMAT_MAJOR UINT16_C(1)
#define CADR_SNAPSHOT_FORMAT_MINOR UINT16_C(0)

typedef struct cadr_snapshot_metadata {
    uint32_t profile;
    uint32_t lifecycle;
    uint32_t artifact_mask;
    uint32_t storage_binding_flags;
    uint64_t storage_overlay_generation;
    uint64_t clock_slots_completed;
    uint64_t microinstructions_executed;
    uint8_t selected_profile_sha256[CADR_SHA256_BYTES];
    uint8_t artifact_set_sha256[CADR_SHA256_BYTES];
    uint8_t cdrstate1_digest[CADR_SNAPSHOT_CDRSTATE1_BYTES];
    uint8_t cdrstate2_digest[CADR_SNAPSHOT_CDRSTATE2_BYTES];
} cadr_snapshot_metadata;

/*
 * The core owns all derived continuation caches.  A restore caller supplies
 * one rebuild routine which MUST reconstruct both the legacy canonical
 * Merkle nodes and trace.state_v2 from the decoded semantic state.  It may
 * change only those two derived cache families, and MUST leave trace.engine
 * NULL.  The snapshot parser hashes every serialized semantic field before
 * and after it runs and rejects a semantic mutation.
 */
typedef cadr_status (*cadr_snapshot_derived_rebuild_fn)(
    cadr_machine_state *state, void *context);

/*
 * This is called after the cache rebuild and semantic-stability check, before
 * the staged state is published.  It is where the integrated core verifies
 * CDRSTATE2 and any selected-profile boundary digest.  Return a non-OK status
 * to abort the restore atomically.
 */
typedef cadr_status (*cadr_snapshot_state_validate_fn)(
    const cadr_machine_state *state,
    const cadr_snapshot_metadata *metadata,
    void *context);

typedef struct cadr_snapshot_restore_hooks {
    cadr_snapshot_derived_rebuild_fn rebuild_derived;
    cadr_snapshot_state_validate_fn validate_state;
    void *context;
} cadr_snapshot_restore_hooks;

/*
 * Computes the exact byte count of the canonical CDRSNAP1 serialization.
 * Both digest arguments are already computed from the same logical state:
 * frozen M1 CDRSTATE1 and full M2 CDRSTATE2. This layer binds but does not
 * independently define either digest.
 */
cadr_status cadr_snapshot_size(const cadr_machine_state *state,
                               const uint8_t cdrstate1_digest[
                                   CADR_SNAPSHOT_CDRSTATE1_BYTES],
                               const uint8_t cdrstate2_digest[
                                   CADR_SNAPSHOT_CDRSTATE2_BYTES],
                               uint64_t *out_byte_count);

/* Writes exactly cadr_snapshot_size bytes; out_written is zero on failure. */
cadr_status cadr_snapshot_serialize(
    const cadr_machine_state *state,
    const uint8_t cdrstate1_digest[CADR_SNAPSHOT_CDRSTATE1_BYTES],
    const uint8_t cdrstate2_digest[CADR_SNAPSHOT_CDRSTATE2_BYTES],
    uint8_t *out_bytes,
    uint64_t out_capacity,
    uint64_t *out_written);

/*
 * Parses into a newly allocated, staged state.  hooks and both callbacks are
 * required.  On any failure *out_state is NULL and out_metadata is zeroed;
 * no partially decoded state escapes.  Destroy parsed state with the helper
 * below, not cadr_machine_destroy.
 */
cadr_status cadr_snapshot_parse(const uint8_t *bytes,
                                uint64_t byte_count,
                                const cadr_snapshot_restore_hooks *hooks,
                                cadr_machine_state **out_state,
                                cadr_snapshot_metadata *out_metadata);

void cadr_snapshot_state_destroy(cadr_machine_state *state);

#ifdef __cplusplus
}
#endif

#endif

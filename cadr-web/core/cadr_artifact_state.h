#ifndef CADR_ARTIFACT_STATE_H
#define CADR_ARTIFACT_STATE_H

#include <stdint.h>

#include "cadr_host_api.h"

/*
 * Exact profile identities are verified before these bits become observable.
 * The streaming fields are host-ingress scratch state: no guest-visible
 * artifact bit changes until the complete ordered byte stream verifies.
 */
typedef struct cadr_artifact_stream_sha256 {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t block_used;
} cadr_artifact_stream_sha256;

typedef struct cadr_artifact_state {
    uint32_t boot_configuration_ingressed;
    uint32_t control_store_ingressed;
    uint32_t base_disk_verified;
    uint32_t prom_symbols_verified;
    uint32_t microcode_symbols_verified;
    uint32_t reserved0[3];
    uint32_t stream_active;
    uint32_t stream_artifact_kind;
    uint64_t stream_byte_count;
    uint64_t stream_offset;
    cadr_artifact_stream_sha256 stream_sha256;
} cadr_artifact_state;

#endif

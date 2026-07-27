#ifndef CADR_CANONICAL_STATE_H
#define CADR_CANONICAL_STATE_H

#include <stdint.h>

#define CADR_CANONICAL_MAX_SLOT_MUTATIONS 3U

typedef struct cadr_canonical_state {
    uint64_t mutation_ordinal;
    uint64_t first_mutation_ordinal;
    uint32_t mutation_count;
    uint32_t initialized;
    uint32_t overflowed;
    uint8_t mutation_events[CADR_CANONICAL_MAX_SLOT_MUTATIONS][32];
    uint8_t mutation_sha256[32];
    uint8_t amem_nodes[2048][32];
    uint8_t mmem_nodes[64][32];
    uint8_t pdl_nodes[2048][32];
    uint8_t spc_nodes[64][32];
    uint8_t l1_nodes[4096][32];
    uint8_t l2_nodes[2048][32];
} cadr_canonical_state;

#endif

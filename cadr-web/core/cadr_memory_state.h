#ifndef CADR_MEMORY_STATE_H
#define CADR_MEMORY_STATE_H

#include <stdint.h>

/* Instance-owned control-store, virtual-map, and 32-bit main-memory state. */
#define CADR_MAIN_MEMORY_MAX_PAGES 16384U
#define CADR_MAIN_MEMORY_WORDS_PER_PAGE 256U

typedef struct cadr_memory_state {
    uint64_t mapped_words;
    uint32_t initialized;
    uint32_t main_memory_pages;
    uint64_t prom[512];
    uint64_t imem[16U * 1024U];
    uint32_t l1_map[2048];
    uint32_t l2_map[1024];
    uint32_t main_memory[CADR_MAIN_MEMORY_MAX_PAGES][CADR_MAIN_MEMORY_WORDS_PER_PAGE];
} cadr_memory_state;

#endif

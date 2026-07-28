#ifndef CADR_TRACE_STATE_H
#define CADR_TRACE_STATE_H

#include <stdint.h>

/*
 * CDRSTATE2 cache geometry.
 *
 * These are cache nodes, not continuation state.  Every leaf represents a
 * fixed-size logical block and every parent is a binary Merkle node.  Keeping
 * the largest RAM tree at page granularity costs a little over one MiB per
 * machine instead of a 256 MiB word-leaf tree, while an individual RAM write
 * still touches a bounded 256-word page and fourteen parents rather than all
 * four million words at a boundary.
 */
#define CADR_STATE_V2_SHA256_BYTES UINT32_C(32)
#define CADR_STATE_V2_ROOT_COUNT UINT32_C(13)

#define CADR_STATE_V2_PROM_LEAVES UINT32_C(16)
#define CADR_STATE_V2_IMEM_LEAVES UINT32_C(256)
#define CADR_STATE_V2_AMEM_LEAVES UINT32_C(32)
#define CADR_STATE_V2_MMEM_LEAVES UINT32_C(1)
#define CADR_STATE_V2_DISPATCH_LEAVES UINT32_C(64)
#define CADR_STATE_V2_PDL_LEAVES UINT32_C(32)
#define CADR_STATE_V2_SPC_LEAVES UINT32_C(1)
#define CADR_STATE_V2_L1_LEAVES UINT32_C(64)
#define CADR_STATE_V2_L2_LEAVES UINT32_C(32)
#define CADR_STATE_V2_MAIN_RAM_LEAVES UINT32_C(16384)
#define CADR_STATE_V2_TV_SYNC_LEAVES UINT32_C(16)
#define CADR_STATE_V2_TV_SCREEN_LEAVES UINT32_C(128)
#define CADR_STATE_V2_BUS_MAP_LEAVES UINT32_C(16)

#define CADR_STATE_V2_PROM_NODES (CADR_STATE_V2_PROM_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_IMEM_NODES (CADR_STATE_V2_IMEM_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_AMEM_NODES (CADR_STATE_V2_AMEM_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_MMEM_NODES (CADR_STATE_V2_MMEM_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_DISPATCH_NODES (CADR_STATE_V2_DISPATCH_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_PDL_NODES (CADR_STATE_V2_PDL_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_SPC_NODES (CADR_STATE_V2_SPC_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_L1_NODES (CADR_STATE_V2_L1_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_L2_NODES (CADR_STATE_V2_L2_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_MAIN_RAM_NODES (CADR_STATE_V2_MAIN_RAM_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_TV_SYNC_NODES (CADR_STATE_V2_TV_SYNC_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_TV_SCREEN_NODES (CADR_STATE_V2_TV_SCREEN_LEAVES * UINT32_C(2))
#define CADR_STATE_V2_BUS_MAP_NODES (CADR_STATE_V2_BUS_MAP_LEAVES * UINT32_C(2))

/* Validity is explicit so inhibited slots never expose stale decoded latches. */
#define CADR_TRACE_LATCH_VALID_PIPELINE UINT32_C(1)
#define CADR_TRACE_LATCH_VALID_DECODED_WORD UINT32_C(2)
#define CADR_TRACE_LATCH_VALID_A_SOURCE UINT32_C(4)
#define CADR_TRACE_LATCH_VALID_M_SOURCE UINT32_C(8)
#define CADR_TRACE_LATCH_VALID_DESTINATION UINT32_C(16)
#define CADR_TRACE_LATCH_VALID_Q UINT32_C(32)
#define CADR_TRACE_LATCH_VALID_VMA UINT32_C(64)
#define CADR_TRACE_LATCH_VALID_MD UINT32_C(128)
#define CADR_TRACE_LATCH_VALID_MACRO_PC UINT32_C(256)
#define CADR_TRACE_LATCH_VALID_FAULT UINT32_C(512)
#define CADR_TRACE_LATCH_VALID_INTERRUPT UINT32_C(1024)
#define CADR_TRACE_LATCH_VALID_CLASS_OUTCOME UINT32_C(2048)
#define CADR_TRACE_LATCH_VALID_KNOWN \
    (CADR_TRACE_LATCH_VALID_PIPELINE | CADR_TRACE_LATCH_VALID_DECODED_WORD | \
     CADR_TRACE_LATCH_VALID_A_SOURCE | CADR_TRACE_LATCH_VALID_M_SOURCE | \
     CADR_TRACE_LATCH_VALID_DESTINATION | CADR_TRACE_LATCH_VALID_Q | \
     CADR_TRACE_LATCH_VALID_VMA | CADR_TRACE_LATCH_VALID_MD | \
     CADR_TRACE_LATCH_VALID_MACRO_PC | CADR_TRACE_LATCH_VALID_FAULT | \
     CADR_TRACE_LATCH_VALID_INTERRUPT | CADR_TRACE_LATCH_VALID_CLASS_OUTCOME)

/* Defined privately by cadr_trace_engine.c; allocation address is never state. */
typedef struct cadr_trace_engine cadr_trace_engine;

typedef struct cadr_state_v2_cache {
    uint32_t initialized;
    uint32_t schema_version;
    uint64_t rebuild_ordinal;
    uint8_t roots[CADR_STATE_V2_ROOT_COUNT][CADR_STATE_V2_SHA256_BYTES];
    uint8_t completion_root[CADR_STATE_V2_SHA256_BYTES];
    uint8_t prom_nodes[CADR_STATE_V2_PROM_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t imem_nodes[CADR_STATE_V2_IMEM_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t amem_nodes[CADR_STATE_V2_AMEM_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t mmem_nodes[CADR_STATE_V2_MMEM_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t dispatch_nodes[CADR_STATE_V2_DISPATCH_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t pdl_nodes[CADR_STATE_V2_PDL_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t spc_nodes[CADR_STATE_V2_SPC_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t l1_nodes[CADR_STATE_V2_L1_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t l2_nodes[CADR_STATE_V2_L2_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t main_ram_nodes[CADR_STATE_V2_MAIN_RAM_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t tv_sync_nodes[CADR_STATE_V2_TV_SYNC_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t tv_screen_nodes[CADR_STATE_V2_TV_SCREEN_NODES][CADR_STATE_V2_SHA256_BYTES];
    uint8_t bus_map_nodes[CADR_STATE_V2_BUS_MAP_NODES][CADR_STATE_V2_SHA256_BYTES];
} cadr_state_v2_cache;

/*
 * Reserved instance-owned canonical trace/snapshot position.  The first M1
 * fields retain their names and meanings; M2 adds an explicit valid mask and
 * pre/post detail latch.  A tracer's ring, drain cursor, and output bytes live
 * in a separate engine allocation and are intentionally not continuation state.
 */
typedef struct cadr_trace_state {
    uint64_t instruction_ordinal;
    uint64_t event_sequence;
    uint64_t raw_fetched_word;
    uint64_t effective_word;
    uint32_t pc;
    uint32_t store_selector;
    uint32_t operation;
    uint32_t a_address;
    uint32_t m_address;
    uint32_t a_value;
    uint32_t m_value;
    uint32_t instruction_memory;
    uint32_t functional_m_source;
    uint32_t effective_popj;
    uint32_t last_slot_executed;
    uint32_t last_slot_inhibited;
    uint32_t decoded;
    uint32_t valid_mask;
    uint32_t pre_destination;
    uint32_t pre_q;
    uint32_t pre_vma;
    uint32_t pre_md;
    uint32_t pre_macro_pc;
    uint32_t post_destination_value;
    uint32_t post_q;
    uint32_t post_vma;
    uint32_t post_md;
    uint32_t post_macro_pc;
    uint32_t post_fault;
    uint32_t post_interrupt_status;
    uint32_t post_interrupt_pending;
    uint32_t class_outcome;
    uint32_t pre_p0_pc;
    uint32_t pre_p1_pc;
    uint32_t pre_next_micro_pc;
    uint32_t pre_opc;
    uint32_t post_p0_pc;
    uint32_t post_p1_pc;
    uint32_t post_next_micro_pc;
    uint32_t post_opc;
    uint32_t m_source_kind;
    uint32_t destination_kind;
    uint32_t destination_address;
    uint32_t md_delayed_phase;
    uint32_t pre_fault;
    uint32_t fault_code;
    uint32_t pre_interrupt_status;
    uint32_t pre_interrupt_pending;
    uint32_t interrupt_level;
    uint32_t reserved0;
    cadr_state_v2_cache state_v2;
    cadr_trace_engine *engine;
} cadr_trace_state;

#endif

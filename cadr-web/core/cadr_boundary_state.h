#ifndef CADR_BOUNDARY_STATE_H
#define CADR_BOUNDARY_STATE_H

#include <stdint.h>

#include "cadr_host_api.h"

typedef struct cadr_boundary_state {
    uint64_t clock_slot_ordinal;
    uint64_t microinstructions_executed;
    uint64_t p0;
    uint64_t p1;
    uint64_t debug_ir;
    uint64_t instruction_write_register;
    uint64_t raw_fetched_word;
    uint64_t effective_word;
    uint64_t first_mutation_ordinal;
    uint64_t mutation_count;
    uint8_t mutation_sha256[CADR_SHA256_BYTES];
    uint32_t p0_pc;
    uint32_t p1_pc;
    uint32_t next_micro_pc;
    uint32_t location_counter;
    uint32_t q;
    uint32_t old_q;
    uint32_t vma;
    uint32_t md;
    uint32_t pending_md;
    uint32_t pending_md_delay;
    uint32_t dispatch_constant;
    uint32_t interrupt_control;
    uint32_t interrupt_status;
    uint32_t interrupt_pending;
    uint32_t micro_stack_pointer;
    uint32_t pdl_pointer;
    uint32_t pdl_index;
    uint32_t oa_low;
    uint32_t oa_high;
    uint32_t oa_low_pending;
    uint32_t oa_high_pending;
    uint32_t decoded_a_address;
    uint32_t decoded_m_address;
    uint32_t decoded_a_data;
    uint32_t decoded_m_data;
    uint32_t decoded_class;
    uint32_t effective_popj;
    uint32_t alu_out;
    uint32_t alu_carry;
    uint32_t output_bus;
    uint32_t opc;
    uint32_t main_memory_pages;
    uint32_t bus_error_status;
    uint32_t trace_pc;
    uint32_t trace_store_selector;
    uint32_t trace_operation;
    uint32_t trace_a_address;
    uint32_t trace_m_address;
    uint32_t trace_a_value;
    uint32_t trace_m_value;
    uint32_t trace_instruction_memory;
    uint32_t trace_functional_m_source;
    uint32_t trace_effective_popj;
    uint32_t trace_decoded;
    uint32_t flags;
} cadr_boundary_state;

#define CADR_BOUNDARY_EXECUTED UINT32_C(1)
#define CADR_BOUNDARY_INHIBITED UINT32_C(2)
#define CADR_BOUNDARY_HALTED UINT32_C(4)
#define CADR_BOUNDARY_PROM_DISABLED UINT32_C(8)
#define CADR_BOUNDARY_VMA_OK UINT32_C(16)

cadr_status cadr_machine_boundary_state(cadr_machine *machine,
                                        cadr_boundary_state *out_state);
cadr_status cadr_machine_boundary_digest(cadr_machine *machine,
                                         uint8_t digest[CADR_SHA256_BYTES]);

#endif

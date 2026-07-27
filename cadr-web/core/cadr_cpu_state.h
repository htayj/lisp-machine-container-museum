#ifndef CADR_CPU_STATE_H
#define CADR_CPU_STATE_H

#include <stdint.h>

/* Instance-owned System 303 microengine state.  See usim-port/COPYING.md. */
typedef struct cadr_cpu_state {
    uint64_t microinstructions_executed;
    uint32_t guest_fault;
    uint64_t p0;
    uint64_t p1;
    uint64_t debug_ir;
    uint64_t instruction_write_register;
    uint32_t p0_pc;
    uint32_t p1_pc;
    uint32_t next_micro_pc;
    uint32_t a_memory[1024];
    uint32_t m_memory[32];
    uint32_t dispatch_memory[2048];
    uint32_t pdl[1024];
    uint32_t micro_stack[32];
    uint32_t micro_stack_pointer;
    uint32_t dispatch_constant;
    uint32_t pdl_pointer;
    uint32_t pdl_index;
    uint32_t vma;
    uint32_t md;
    uint32_t location_counter;
    uint32_t oa_low;
    uint32_t oa_high;
    uint32_t opc;
    uint32_t q;
    uint32_t old_q;
    uint32_t interrupt_control;
    uint32_t pending_md;
    uint32_t pending_md_delay;
    uint32_t alu_carry;
    uint32_t alu_out;
    uint32_t out;
    uint32_t interrupt_pending;
    uint32_t decoded_a_address;
    uint32_t decoded_m_address;
    uint32_t decoded_a_data;
    uint32_t decoded_m_data;
    uint32_t decoded_initial_m_data;
    uint32_t decoded_class;
    uint32_t effective_popj;
    uint8_t p0_imem;
    uint8_t p1_imem;
    uint8_t inhibit;
    uint8_t oa_low_pending;
    uint8_t oa_high_pending;
    uint8_t halted;
    uint8_t prom_disabled;
    uint8_t vma_ok;
    uint8_t main_memory_nxm;
} cadr_cpu_state;

#endif

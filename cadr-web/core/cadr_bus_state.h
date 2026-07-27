#ifndef CADR_BUS_STATE_H
#define CADR_BUS_STATE_H

#include <stdint.h>

#define CADR_UNIBUS_MAP_PAGES 16U

typedef struct cadr_diagnostic_latches {
    uint64_t instruction;
    uint64_t debug_instruction;
    uint32_t opc;
    uint32_t next_micro_pc;
    uint32_t output_bus;
    uint32_t m_source;
    uint32_t a_source;
    uint8_t machine_error;
    uint8_t single_step_done;
    uint8_t running;
    uint8_t write_map;
    uint8_t destination_spc;
    uint8_t instruction_write;
    uint8_t instruction_modify;
    uint8_t pdl_write;
    uint8_t spc_push;
    uint8_t instruction_parity;
    uint8_t nop;
    uint8_t vma_ok;
    uint8_t jump_condition;
    uint8_t next_pc_source;
    uint8_t reserved0;
} cadr_diagnostic_latches;

/* Instance-owned bus-interface and Unibus-map state. */
typedef struct cadr_bus_state {
    uint64_t guest_tick;
    uint32_t interrupt_pending;
    uint16_t interrupt_status;
    uint16_t error_status;
    uint16_t unibus_map[CADR_UNIBUS_MAP_PAGES];
    uint16_t unibus_halfword[CADR_UNIBUS_MAP_PAGES];
    cadr_diagnostic_latches diagnostic;
    uint8_t nxm_inhibited;
    uint8_t reserved0[3];
} cadr_bus_state;

#endif

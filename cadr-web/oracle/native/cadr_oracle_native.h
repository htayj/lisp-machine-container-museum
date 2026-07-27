#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/*
 * This header is copied into the disposable oracle worktree.  It is never
 * included by the unpatched upstream checkout.
 */

enum cadr_oracle_family {
    CADR_ORACLE_IMEM = 1,
    CADR_ORACLE_AMEM = 2,
    CADR_ORACLE_MMEM = 3,
    CADR_ORACLE_DMEM = 4,
    CADR_ORACLE_PDL = 5,
    CADR_ORACLE_SPC = 6,
    CADR_ORACLE_L1_MAP = 7,
    CADR_ORACLE_L2_MAP = 8,
    CADR_ORACLE_MAIN_MEMORY = 9,
    CADR_ORACLE_TV_MEMORY = 10,
    CADR_ORACLE_COLOR_TV_MEMORY = 11,
    CADR_ORACLE_COLOR_MAP = 12,
    CADR_ORACLE_UNIBUS_MAP = 13,
    CADR_ORACLE_PROM = 14,
    CADR_ORACLE_UNIBUS_BUFFER = 15,
    CADR_ORACLE_INTERRUPT = 20,
    CADR_ORACLE_BUS_READ = 21,
    CADR_ORACLE_BUS_WRITE = 22,
    CADR_ORACLE_IOB_READ = 23,
    CADR_ORACLE_IOB_WRITE = 24,
    CADR_ORACLE_DISK_READ = 25,
    CADR_ORACLE_DISK_WRITE = 26,
    CADR_ORACLE_TAPE_READ = 27,
    CADR_ORACLE_TAPE_WRITE = 28,
    CADR_ORACLE_CHAOS_READ = 29,
    CADR_ORACLE_CHAOS_WRITE = 30
    ,CADR_ORACLE_BUS_INTERFACE_STATE = 31
    ,CADR_ORACLE_DISK_STATE = 32
    ,CADR_ORACLE_TV_STATE = 33
    ,CADR_ORACLE_COLOR_TV_STATE = 34
    ,CADR_ORACLE_CHAOS_STATE = 35
    ,CADR_ORACLE_TAPE_STATE = 36
    ,CADR_ORACLE_IOB_STATE = 37
};

void cadr_oracle_start(uint64_t slot_limit);
void cadr_oracle_slot_begin(bool inhibited);
void cadr_oracle_slot_end(bool halted);
void cadr_oracle_finish(bool halted);

void cadr_oracle_write_u32(uint32_t family, uint32_t index,
                           uint32_t old_value, uint32_t new_value);
void cadr_oracle_write_u64(uint32_t family, uint32_t index,
                           uint64_t old_value, uint64_t new_value);
void cadr_oracle_event_u32(uint32_t family, uint32_t index,
                           uint32_t value, uint32_t disposition);
void cadr_oracle_main_memory_page_changed(uint32_t page_number);
void cadr_oracle_external_event(uint32_t source, uint32_t event,
                                const char *detail);
void cadr_oracle_latch_fetched(uint64_t raw_word, uint32_t pc,
                               bool instruction_memory);
void cadr_oracle_latch_decoded(uint64_t effective_word, uint32_t operation,
                               bool effective_popj, uint32_t a_address,
                               uint32_t m_address, bool functional_m_source,
                               uint32_t a_value, uint32_t m_value);
void cadr_oracle_latch_inhibited(void);
uint32_t cadr_oracle_alu_behavior(uint32_t pc, uint32_t alu_operation,
                                  uint32_t value);

void cadr_oracle_snapshot_begin(uint32_t family);
void cadr_oracle_snapshot_u32(uint32_t tag, uint32_t value);
void cadr_oracle_snapshot_u64(uint32_t tag, uint64_t value);
void cadr_oracle_snapshot_bytes(uint32_t tag, const void *bytes, size_t length);
void cadr_oracle_snapshot_end(void);
void cadr_oracle_refresh_device_states(void);

uint32_t cadr_oracle_main_memory_word(uint32_t word_address);

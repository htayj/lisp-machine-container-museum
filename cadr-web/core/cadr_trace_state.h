#ifndef CADR_TRACE_STATE_H
#define CADR_TRACE_STATE_H

#include <stdint.h>

/* Reserved instance-owned canonical trace/snapshot position. */
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
} cadr_trace_state;

#endif

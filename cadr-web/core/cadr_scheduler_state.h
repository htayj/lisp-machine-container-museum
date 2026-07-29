#ifndef CADR_SCHEDULER_STATE_H
#define CADR_SCHEDULER_STATE_H

#include <stdint.h>

#define CADR_SCHEDULER_EVENT_CAPACITY 64U
#define CADR_SCHEDULER_TRANSCRIPT_CAPACITY 256U

typedef struct cadr_scheduler_transcript_record {
    uint64_t due_tick;
    uint64_t generation;
    uint64_t insertion_sequence;
    uint32_t kind;
    uint32_t order;
    uint32_t flags;
    uint32_t value;
    uint32_t interrupt_before;
    uint32_t interrupt_after;
    uint32_t interrupt_control_before;
    uint32_t interrupt_control_after;
    uint32_t iob_csr_before;
    uint32_t iob_csr_after;
    uint32_t location_counter_before;
    uint32_t location_counter_after;
    uint32_t tv_mode_before;
    uint32_t tv_mode_after;
    uint32_t sixty_cycle_before;
    uint32_t sixty_cycle_after;
    uint32_t usec_clock_before;
    uint32_t usec_clock_after;
    uint32_t usec_phase_before;
    uint32_t usec_phase_after;
    uint32_t scancode_before;
    uint32_t scancode_after;
    uint32_t fifo_count_before;
    uint32_t fifo_count_after;
} cadr_scheduler_transcript_record;

typedef struct cadr_scheduler_event_state {
    uint64_t due_tick;
    uint64_t generation;
    uint64_t insertion_sequence;
    uint32_t kind;
    uint32_t flags;
    uint32_t value;
    uint32_t reserved0;
} cadr_scheduler_event_state;

typedef struct cadr_scheduler_state {
    cadr_scheduler_event_state events[CADR_SCHEDULER_EVENT_CAPACITY];
    uint64_t next_insertion_sequence;
    uint32_t count;
    uint32_t phase;
    uint32_t hidden_policy;
    uint32_t reserved0;
    /* This is the semantic, append-only witness.  The transcript array below is
     * merely a bounded host transport buffer and may be drained at any time. */
    uint64_t transcript_total_count;
    uint8_t transcript_witness_sha256[32];
    cadr_scheduler_transcript_record transcript[CADR_SCHEDULER_TRANSCRIPT_CAPACITY];
    uint32_t transcript_count;
    uint32_t transcript_capture_enabled;
    uint32_t transcript_reserved0;
} cadr_scheduler_state;

#define CADR_SCHEDULER_PHASE_BOUNDARY_READY UINT32_C(0)
#define CADR_SCHEDULER_HIDDEN_PAUSE          UINT32_C(1)

#endif

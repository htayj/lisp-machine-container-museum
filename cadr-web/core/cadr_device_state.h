#ifndef CADR_DEVICE_STATE_H
#define CADR_DEVICE_STATE_H

#include <stdint.h>

#include "cadr_disk_state.h"

#define CADR_TV_WORDS 32768U
#define CADR_IOB_KEY_QUEUE_LEN 10U

typedef struct cadr_iob_state {
    uint32_t csr;
    uint32_t scancode;
    uint32_t usec_clock;
    uint32_t usec_latched;
    uint32_t usec_phase;
    uint16_t sixty_cycle_clock;
    uint16_t key_queue[CADR_IOB_KEY_QUEUE_LEN];
    uint32_t key_queue_read;
    uint32_t key_queue_write;
    uint32_t key_queue_count;
} cadr_iob_state;

/*
 * Only selected-profile state with implemented M1 semantics is represented.
 * O1 observed no disk, tape, Chaos, color-TV, or audio transaction, so those
 * controllers remain typed fail-closed stubs rather than plausible snapshots.
 */
typedef struct cadr_device_state {
    uint64_t event_sequence;
    uint32_t initialized;
    uint32_t tv_mode;
    uint32_t tv_vert_spacing;
    uint32_t tv_sync_ptr;
    uint8_t tv_sync_ram[4096];
    uint32_t tv_screen[CADR_TV_WORDS];
    cadr_disk_state disk;
    cadr_iob_state iob;
} cadr_device_state;

#endif

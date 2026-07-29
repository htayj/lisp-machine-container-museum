#ifndef CADR_DEVICE_STATE_H
#define CADR_DEVICE_STATE_H

#include <stdint.h>

#include "cadr_disk_state.h"

#define CADR_TV_WORDS 32768U

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
} cadr_device_state;

#endif

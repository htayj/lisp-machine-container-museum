#ifndef CADR_DEVICE_STATE_H
#define CADR_DEVICE_STATE_H

#include <stdint.h>

#include "cadr_disk_state.h"

#if defined(CADR_M11_CORE)
/* Live audio ownership is deliberately outside CDRSNAP1.  The machine owns
 * the model and rebonds this pointer after every reconstructed state; no
 * host pointer is a semantic CADR state field. */
typedef struct cadr_audio_model cadr_audio_model;
#endif

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
#if defined(CADR_M9_CORE)
    /* M8/M9 ingress state is profile-local.  It intentionally has no generic
     * scheduler representation: CDRINP1 is delivered at a completed machine
     * boundary and maps directly to the selected IOB register semantics. */
    uint16_t mouse_x;
    uint16_t mouse_y;
    uint32_t input_sequence;
    uint64_t input_ingress_ordinal;
#endif
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
#if defined(CADR_M11_CORE)
    cadr_audio_model *audio_model;
#endif
} cadr_device_state;

#endif

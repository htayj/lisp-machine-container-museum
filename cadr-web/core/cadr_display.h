#ifndef CADR_DISPLAY_H
#define CADR_DISPLAY_H

#if !defined(CADR_M7_CORE)
#error "cadr_display.h is available only in the M7 core profile"
#endif

#include <stdint.h>

#include "cadr_host_api.h"
#include "cadr_state.h"

#define CADR_DISPLAY_WIDTH UINT32_C(768)
#define CADR_DISPLAY_HEIGHT UINT32_C(963)
#define CADR_DISPLAY_STRIDE_WORDS UINT32_C(24)
#define CADR_DISPLAY_ACTIVE_WORDS UINT32_C(23112)
#define CADR_DISPLAY_BACKING_WORDS UINT32_C(32768)
#define CADR_DISPLAY_CDRDISP1_HEADER_BYTES UINT64_C(80)
#define CADR_DISPLAY_CDRDISP1_RECT_BYTES UINT64_C(16)
#define CADR_DISPLAY_CDRDISP1_VERSION UINT16_C(1)
#define CADR_DISPLAY_FLAG_FULL UINT32_C(1)
#define CADR_DISPLAY_FLAG_ZERO_IS_BLACK UINT32_C(2)
#define CADR_DISPLAY_CLEAN_WORD UINT8_C(255)

/* Derived renderer state: it is intentionally absent from cadr_machine_state,
 * CDRSTATE digests, and CDRSNAP1.  min/max are word columns, max-exclusive. */
typedef struct cadr_display_tracker {
    uint64_t framebuffer_generation;
    uint32_t mirror[CADR_DISPLAY_ACTIVE_WORDS];
    uint8_t min_word[CADR_DISPLAY_HEIGHT];
    uint8_t max_word[CADR_DISPLAY_HEIGHT];
    uint32_t last_tv_polarity;
    uint32_t full_refresh;
    uint32_t failed;
} cadr_display_tracker;

typedef struct cadr_display_rect {
    uint32_t x;
    uint32_t y;
    uint32_t width;
    uint32_t height;
} cadr_display_rect;

void cadr_display_tracker_initialize(cadr_display_tracker *tracker,
                                     const cadr_machine_state *state);
cadr_status cadr_display_tracker_prepare_reinitialize(
    cadr_display_tracker *tracker, uint64_t *out_generation);
void cadr_display_tracker_commit_reinitialize(
    cadr_display_tracker *tracker, const cadr_machine_state *state,
    uint64_t generation);
cadr_status cadr_display_tracker_sync(cadr_display_tracker *tracker,
                                      const cadr_machine_state *state);
cadr_status cadr_display_record_validate(const uint8_t *bytes,
                                         uint64_t byte_count);

#endif

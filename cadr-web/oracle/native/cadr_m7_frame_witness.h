#ifndef CADR_M7_FRAME_WITNESS_H
#define CADR_M7_FRAME_WITNESS_H

#include <stdint.h>

/*
 * M7's source-local, one-shot framebuffer witness.  The caller supplies the
 * post-slot machine-cycle boundary, never the pre-increment cycle number from
 * the diagnostic-register write itself.
 */
int cadr_m7_frame_witness_capture(uint64_t boundary);
uint32_t cadr_m7_frame_witness_failed(void);

#endif

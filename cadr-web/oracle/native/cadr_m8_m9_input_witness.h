#ifndef CADR_M8_M9_INPUT_WITNESS_H
#define CADR_M8_M9_INPUT_WITNESS_H

#include <stdint.h>

/* These hooks are called by the disposable native patch before either native
 * input function touches IOB CSR, the keyboard FIFO, mouse state, A-memory,
 * or interrupt state.  A nonzero result is fail-closed by the patched caller. */
int cadr_m8_m9_input_witness_keyboard(uint64_t boundary, uint32_t iob_csr_before,
                                      int code, int keydown);
int cadr_m8_m9_input_witness_pointer(uint64_t boundary, uint32_t iob_csr_before,
                                     int x, int y, int buttons);

#endif

#ifndef CADR_M8_M9_INPUT_DRIVER_H
#define CADR_M8_M9_INPUT_DRIVER_H

#include <stdint.h>

/* The inert, explicit native campaign driver.  It reads no input unless the
 * complete private pathname is supplied through CADR_M8_M9_INPUT_SCRIPT. */
int cadr_m8_m9_input_driver_init(void);
int cadr_m8_m9_input_driver_boundary(uint64_t boundary);
/* The M6 witness may become complete before this explicitly scheduled input
 * continuation begins.  The patched private loop may halt only after both
 * its M6 witness and this driver have reached their terminal states. */
int cadr_m8_m9_input_driver_complete(void);

#endif

#ifndef CADR_M3_NATIVE_OBSERVER_SINK_H
#define CADR_M3_NATIVE_OBSERVER_SINK_H

#include <stdint.h>
#include <stdio.h>

/* Host-only sink control.  The portable core sees only the conditional hooks. */
int cadr_m3_native_observer_open(FILE *bus, FILE *disk, uint64_t slots);
void cadr_m3_native_observer_slot(uint64_t value);
int cadr_m3_native_observer_failed(void);
void cadr_m3_native_observer_close(void);

#endif

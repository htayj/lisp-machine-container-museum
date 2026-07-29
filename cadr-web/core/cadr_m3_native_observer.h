#ifndef CADR_M3_NATIVE_OBSERVER_H
#define CADR_M3_NATIVE_OBSERVER_H

#if defined(CADR_M3_NATIVE_OBSERVER)
#include "cadr_state.h"
void cadr_m3_native_observer_bus(const cadr_machine_state *, const char *, uint32_t, uint32_t, uint32_t);
void cadr_m3_native_observer_disk(const cadr_machine_state *, const char *, const char *, uint32_t, uint32_t, uint32_t);
void cadr_m3_native_observer_disk_interrupt(const cadr_machine_state *, const char *);
#else
#define cadr_m3_native_observer_bus(state, direction, address, write_value, read_result) ((void)0)
#define cadr_m3_native_observer_disk(state, action, direction, offset, input, result) ((void)0)
#define cadr_m3_native_observer_disk_interrupt(state, action) ((void)0)
#endif
#endif

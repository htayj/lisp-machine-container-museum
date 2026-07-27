#ifndef CADR_STATE_H
#define CADR_STATE_H

#include <stdint.h>

#include "cadr_artifact_state.h"
#include "cadr_bus_state.h"
#include "cadr_canonical_state.h"
#include "cadr_cpu_state.h"
#include "cadr_device_state.h"
#include "cadr_event_state.h"
#include "cadr_memory_state.h"
#include "cadr_trace_state.h"

/* The uexec-derived microengine state is composed in cpu and memory above. */

/* The Sol decomposition composes all mutable state beneath one machine owner. */
typedef struct cadr_machine_state {
    cadr_cpu_state cpu;
    cadr_memory_state memory;
    cadr_bus_state bus;
    cadr_canonical_state canonical;
    cadr_device_state devices;
    cadr_event_state events;
    cadr_trace_state trace;
    cadr_artifact_state artifacts;
    uint64_t clock_slots_completed;
    uint32_t lifecycle;
    uint32_t in_host_completion;
    uint32_t profile;
    uint32_t reserved0;
} cadr_machine_state;

#endif

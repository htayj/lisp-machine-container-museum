#ifndef CADR_ARTIFACT_STATE_H
#define CADR_ARTIFACT_STATE_H

#include <stdint.h>

#include "cadr_host_api.h"

/* Exact profile identities are verified before these bits become observable. */
typedef struct cadr_artifact_state {
    uint32_t boot_configuration_ingressed;
    uint32_t control_store_ingressed;
    uint32_t base_disk_verified;
    uint32_t prom_symbols_verified;
    uint32_t microcode_symbols_verified;
    uint32_t reserved0[3];
} cadr_artifact_state;

#endif

#ifndef CADR_M7_DEVID_FAILURE_H
#define CADR_M7_DEVID_FAILURE_H

#include <stdint.h>

#define CADR_M7_DEVID_FAILURE_RECORD_BYTES UINT32_C(64)

enum {
    CADR_M7_DEVID_FAILURE_SITE_NONE = 0U,
    CADR_M7_DEVID_FAILURE_SITE_PHYSICAL_BUS_READ = 1U,
    CADR_M7_DEVID_FAILURE_SITE_PHYSICAL_BUS_WRITE = 2U,
    CADR_M7_DEVID_FAILURE_SITE_GUARDED_BUS_READ = 3U,
    CADR_M7_DEVID_FAILURE_SITE_GUARDED_BUS_WRITE = 4U,
    CADR_M7_DEVID_FAILURE_SITE_IOB_DEVICE_SERVICE = 5U,
    CADR_M7_DEVID_FAILURE_SITE_CORE_UNCLASSIFIED = 255U
};

enum {
    CADR_M7_DEVID_FAILURE_DIRECTION_NONE = 0U,
    CADR_M7_DEVID_FAILURE_DIRECTION_READ = 1U,
    CADR_M7_DEVID_FAILURE_DIRECTION_WRITE = 2U
};

/* Derived failure evidence.  It is deliberately excluded from snapshots and
 * canonical machine digests and is populated only by M7-DEVID terminal paths. */
typedef struct cadr_m7_devid_failure_state {
    uint32_t valid;
    uint32_t site;
    uint32_t direction;
    uint32_t address;
    uint32_t value;
    uint32_t result;
} cadr_m7_devid_failure_state;

#endif

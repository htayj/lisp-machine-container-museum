#include "cadr_bus_device.h"

/*
 * O1 reaches no disk register transaction.  Media, unit, CCW, completion, and
 * interrupt semantics are therefore outside M1 rather than partially faked.
 */
cadr_status cadr_disk_read(cadr_machine_state *const state,
                           const uint32_t offset,
                           uint32_t *const out_value)
{
    (void)state;
    (void)offset;
    (void)out_value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_disk_write(cadr_machine_state *const state,
                            const uint32_t offset,
                            const uint32_t value)
{
    (void)state;
    (void)offset;
    (void)value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

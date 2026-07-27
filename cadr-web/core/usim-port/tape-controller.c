#include "cadr_bus_device.h"

/*
 * O1 reaches no tape transaction.  Register reads and GO are typed stops until
 * the drive/media transaction contract is implemented as a later milestone.
 */
cadr_status cadr_tape_read(cadr_machine_state *const state,
                           const uint32_t uaddr,
                           uint16_t *const out_value)
{
    (void)state;
    (void)uaddr;
    (void)out_value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_tape_write(cadr_machine_state *const state,
                            const uint32_t uaddr,
                            const uint16_t value)
{
    (void)state;
    (void)uaddr;
    (void)value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

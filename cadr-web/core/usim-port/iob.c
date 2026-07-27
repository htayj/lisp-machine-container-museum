#include "cadr_bus_device.h"

/*
 * O1 reaches no I/O-board transaction.  Keyboard, mouse, timer, audio, serial,
 * and Chaos behavior therefore stop before returning a synthetic register.
 */
cadr_status cadr_iob_read(cadr_machine_state *const state,
                          const uint32_t uaddr,
                          uint16_t *const out_value)
{
    (void)state;
    (void)uaddr;
    (void)out_value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_iob_write(cadr_machine_state *const state,
                           const uint32_t uaddr,
                           const uint16_t value)
{
    (void)state;
    (void)uaddr;
    (void)value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

#include "cadr_bus_device.h"

/* Chaos transport and controller transactions are absent from O1. */
cadr_status cadr_uch11_read_csr(cadr_machine_state *const state,
                                uint16_t *const out_value)
{
    (void)state;
    (void)out_value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_uch11_write_csr(cadr_machine_state *const state,
                                 const uint16_t value)
{
    (void)state;
    (void)value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

#include "cadr_bus_device.h"

/*
 * The selected System 303 profile has color TV disabled.  Bus-adaptor.c does
 * not decode its ranges, so historical probe reads receive the generic
 * unmapped-Xbus zero/NXM result.  Direct calls are integration errors.
 */
cadr_status cadr_colortv_read(cadr_machine_state *const state,
                              const uint32_t offset,
                              uint32_t *const out_value)
{
    (void)state;
    (void)offset;
    (void)out_value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_colortv_write(cadr_machine_state *const state,
                               const uint32_t offset,
                               const uint32_t value)
{
    (void)state;
    (void)offset;
    (void)value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_colortv_control_read(cadr_machine_state *const state,
                                      const uint32_t offset,
                                      uint32_t *const out_value)
{
    (void)state;
    (void)offset;
    (void)out_value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_colortv_control_write(cadr_machine_state *const state,
                                       const uint32_t offset,
                                       const uint32_t value)
{
    (void)state;
    (void)offset;
    (void)value;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

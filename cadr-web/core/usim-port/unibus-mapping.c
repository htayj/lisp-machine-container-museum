#include "cadr_bus_device.h"
#include "cadr_state_v2.h"

cadr_status cadr_unibus_map_read(cadr_machine_state *const state, const uint32_t uaddr,
                                 uint16_t *const out_value)
{
    uint32_t page;
    if (out_value == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (uaddr < 0766140U || uaddr > 0766176U || (uaddr & 1U) != 0U) {
        *out_value = 0U; cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
    page = (uaddr - 0766140U) >> 1U;
    *out_value = state->bus.unibus_map[page];
    return CADR_STATUS_OK;
}

cadr_status cadr_unibus_map_write(cadr_machine_state *const state, const uint32_t uaddr,
                                  const uint16_t value)
{
    uint32_t page;
    if (uaddr < 0766140U || uaddr > 0766176U || (uaddr & 1U) != 0U) {
        cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
    page = (uaddr - 0766140U) >> 1U;
    state->bus.unibus_map[page] = value;
    cadr_state_v2_note_bus_map_write(state, page);
    return CADR_STATUS_OK;
}

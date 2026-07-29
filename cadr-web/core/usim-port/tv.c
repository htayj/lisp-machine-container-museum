#include "cadr_bus_device.h"
#include "cadr_state_v2.h"

static int tv_sync_prom_enabled(const cadr_machine_state *const state)
{
    return (state->devices.tv_vert_spacing & UINT32_C(0200)) == 0U;
}

void cadr_tv_clock_assert(cadr_machine_state *const state)
{
    /* Pinned X11 tv.c path: vertical service is gated by TV enable, records
     * a device request before it raises the shared Xbus interrupt. */
    if ((state->devices.tv_mode & (UINT32_C(1) << 3U)) != 0U) {
        state->devices.tv_mode |= UINT32_C(1) << 4U;
        cadr_bus_assert_xbus_interrupt(state);
    }
}

cadr_status cadr_tv_read(cadr_machine_state *const state, const uint32_t offset, uint32_t *const out_value)
{
    if (out_value == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (offset >= CADR_TV_WORDS) { *out_value = 0U; cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE; }
    *out_value = state->devices.tv_screen[offset];
    return CADR_STATUS_OK;
}

cadr_status cadr_tv_write(cadr_machine_state *const state, const uint32_t offset, const uint32_t value)
{
    if (offset >= CADR_TV_WORDS) { cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE; }
    state->devices.tv_screen[offset] = value;
    cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_TV_SCREEN, offset);
    return CADR_STATUS_OK;
}

cadr_status cadr_tv_control_read(cadr_machine_state *const state, const uint32_t offset, uint32_t *const out_value)
{
    if (out_value == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (offset == 0U) { *out_value = state->devices.tv_mode; return CADR_STATUS_OK; }
    if (offset == 1U) { *out_value = (tv_sync_prom_enabled(state) != 0) ? 0U : state->devices.tv_sync_ram[state->devices.tv_sync_ptr]; return CADR_STATUS_OK; }
    *out_value = 0U; cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_tv_control_write(cadr_machine_state *const state, const uint32_t offset, const uint32_t value)
{
    switch (offset) {
    case 0U: state->devices.tv_mode = value; return CADR_STATUS_OK;
    case 1U:
        if (tv_sync_prom_enabled(state) == 0) {
            state->devices.tv_sync_ram[state->devices.tv_sync_ptr] = (uint8_t)value;
            cadr_state_v2_note_u8_write(state, CADR_STATE_V2_ROOT_TV_SYNC,
                                        state->devices.tv_sync_ptr);
        }
        return CADR_STATUS_OK;
    case 2U: state->devices.tv_sync_ptr = value & UINT32_C(0xfff); return CADR_STATUS_OK;
    case 3U: state->devices.tv_vert_spacing = value; return CADR_STATUS_OK;
    default: cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
}

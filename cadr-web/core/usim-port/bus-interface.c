#include "cadr_bus_device.h"

void cadr_bus_set_interrupt_status(cadr_machine_state *const state, const uint16_t value)
{
    state->bus.interrupt_status = value;
    state->bus.interrupt_pending =
        (value & UINT16_C(0140000)) != 0U ? UINT32_C(1) : UINT32_C(0);
    state->cpu.interrupt_pending = state->bus.interrupt_pending;
}

uint32_t cadr_bus_interrupt_pending(const cadr_machine_state *const state)
{
    return state->bus.interrupt_pending;
}

void cadr_bus_assert_unibus_interrupt(cadr_machine_state *const state,
                                      const uint16_t vector)
{
    if ((state->bus.interrupt_status & UINT16_C(02000)) != 0U) {
        cadr_bus_set_interrupt_status(
            state,
            (uint16_t)((state->bus.interrupt_status & ~UINT16_C(01774)) |
                       UINT16_C(0100000) | (vector & UINT16_C(01774))));
    }
}

void cadr_bus_deassert_unibus_interrupt(cadr_machine_state *const state)
{
    if ((state->bus.interrupt_status & UINT16_C(0100000)) != 0U) {
        cadr_bus_set_interrupt_status(
            state,
            (uint16_t)(state->bus.interrupt_status &
                       (uint16_t)~(UINT16_C(01774) |
                                   UINT16_C(0100000))));
    }
}

void cadr_bus_assert_xbus_interrupt(cadr_machine_state *const state)
{
    cadr_bus_set_interrupt_status(
        state, (uint16_t)(state->bus.interrupt_status | UINT16_C(040000)));
}

void cadr_bus_deassert_xbus_interrupt(cadr_machine_state *const state)
{
    cadr_bus_set_interrupt_status(
        state, (uint16_t)(state->bus.interrupt_status & ~UINT16_C(040000)));
}

void cadr_bus_processor_interrupt_control_written(
    cadr_machine_state *const state, const uint32_t new_control)
{
    if ((new_control & (UINT32_C(1) << 28U)) != 0U) {
        cadr_bus_runtime_reset(state);
    }
}

void cadr_bus_set_xbus_nxm(cadr_machine_state *const state)
{
    if (state->bus.nxm_inhibited == 0U) state->bus.error_status |= CADR_BUS_ERROR_XBUS_NXM;
}

void cadr_bus_set_unibus_nxm(cadr_machine_state *const state)
{
    if (state->bus.nxm_inhibited == 0U) state->bus.error_status |= CADR_BUS_ERROR_UNIBUS_NXM;
}

void cadr_bus_set_unibus_map_error(cadr_machine_state *const state)
{
    state->bus.error_status |= CADR_BUS_ERROR_UNIBUS_MAP;
}

void cadr_bus_interface_reset(cadr_machine_state *const state)
{
    state->bus.error_status = 0U;
    state->bus.nxm_inhibited = 0U;
}

cadr_status cadr_bus_interface_read(cadr_machine_state *const state, const uint32_t uaddr,
                                    uint16_t *const out_value)
{
    if (out_value == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    switch (uaddr) {
    case 0766040U: *out_value = state->bus.interrupt_status; return CADR_STATUS_OK;
    case 0766044U: *out_value = state->bus.error_status; return CADR_STATUS_OK;
    case 0766100U:
    case 0766104U: return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    default: *out_value = 0U; cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
}

cadr_status cadr_bus_interface_write(cadr_machine_state *const state, const uint32_t uaddr,
                                     const uint16_t value)
{
    switch (uaddr) {
    case 0766040U:
        cadr_bus_set_interrupt_status(
            state,
            (uint16_t)((state->bus.interrupt_status & ~UINT16_C(036001)) |
                       (value & UINT16_C(036001))));
        return CADR_STATUS_OK;
    case 0766042U:
        cadr_bus_set_interrupt_status(
            state,
            (uint16_t)((state->bus.interrupt_status & ~UINT16_C(0101774)) |
                       (value & UINT16_C(0101774))));
        return CADR_STATUS_OK;
    case 0766044U: state->bus.error_status = 0U; return CADR_STATUS_OK;
    case 0766100U:
    case 0766102U:
    case 0766110U:
    case 0766112U: return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    case 0766114U: return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    default: cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
}

#include "cadr_bus_device.h"

/*
 * M5 is the selected U303 I/O-board subset.  It is derived from the pinned
 * usim iob.c/kbd.c witness: CSR<5> is keyboard-ready, CSR<2> enables vector
 * 0260, reading the low keyboard half consumes ready, and a ten-entry FIFO
 * holds subsequent events.  Wall time, SDL and signal timers remain outside
 * this deterministic core.
 */

#define CADR_IOB_KBD_LOW UINT32_C(0764100)
#define CADR_IOB_KBD_HIGH UINT32_C(0764102)
#define CADR_IOB_CSR UINT32_C(0764112)
#define CADR_IOB_USEC_LOW UINT32_C(0764120)
#define CADR_IOB_USEC_HIGH UINT32_C(0764122)
#define CADR_IOB_60_HZ UINT32_C(0764124)
#define CADR_IOB_CSR_KEYBOARD_INTERRUPT UINT32_C(1) << 2U
#define CADR_IOB_CSR_KEYBOARD_READY UINT32_C(1) << 5U
#define CADR_IOB_KEYBOARD_VECTOR UINT16_C(0260)

static void cadr_iob_present_next(cadr_machine_state *state)
{
    cadr_iob_state *iob = &state->devices.iob;
    if ((iob->csr & CADR_IOB_CSR_KEYBOARD_READY) != 0U ||
        iob->key_queue_count == 0U) return;
    iob->scancode = UINT32_C(1) << 16U;
    iob->scancode |= iob->key_queue[iob->key_queue_read];
    iob->key_queue_read = (iob->key_queue_read + 1U) % CADR_IOB_KEY_QUEUE_LEN;
    iob->key_queue_count -= 1U;
    if ((iob->csr & CADR_IOB_CSR_KEYBOARD_INTERRUPT) != 0U) {
        iob->csr |= CADR_IOB_CSR_KEYBOARD_READY;
        cadr_bus_assert_unibus_interrupt(state, CADR_IOB_KEYBOARD_VECTOR);
    }
}

cadr_status cadr_iob_clock_tick(cadr_machine_state *const state,
                                const uint32_t ticks)
{
    cadr_iob_state *iob;
    uint32_t phase;
    if (state == NULL || ticks != 1U) return CADR_STATUS_INVALID_ARGUMENT;
    iob = &state->devices.iob;
    /* INF-M5-USEC-1M-OVER-60-v1: a selected 60 Hz event advances an exact
     * rational microsecond phase, rather than borrowing host wall time or
     * accumulating a fixed 16667-us drift.  The u32 clock deliberately
     * wraps while usec_phase retains the remainder in [0, 59]. */
    cadr_tv_clock_assert(state); /* monochrome TV, before counter */
    phase = iob->usec_phase + UINT32_C(1000000);
    iob->usec_clock += phase / UINT32_C(60);
    iob->usec_phase = phase % UINT32_C(60);
    iob->sixty_cycle_clock = (uint16_t)(iob->sixty_cycle_clock + UINT16_C(1));
    return CADR_STATUS_OK;
}

cadr_status cadr_iob_device_service(cadr_machine_state *const state)
{
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_iob_present_next(state);
    return CADR_STATUS_OK;
}

cadr_status cadr_iob_keyboard_event(cadr_machine_state *const state,
                                     const uint16_t event)
{
    cadr_iob_state *iob;
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    iob = &state->devices.iob;
    if ((iob->csr & CADR_IOB_CSR_KEYBOARD_READY) == 0U) {
        iob->scancode = (UINT32_C(1) << 16U) | event;
        if ((iob->csr & CADR_IOB_CSR_KEYBOARD_INTERRUPT) != 0U) {
            iob->csr |= CADR_IOB_CSR_KEYBOARD_READY;
            cadr_bus_assert_unibus_interrupt(state, CADR_IOB_KEYBOARD_VECTOR);
        }
        return CADR_STATUS_OK;
    }
    if (iob->key_queue_count == CADR_IOB_KEY_QUEUE_LEN) return CADR_STATUS_QUEUE_FULL;
    iob->key_queue[iob->key_queue_write] = event;
    iob->key_queue_write = (iob->key_queue_write + 1U) % CADR_IOB_KEY_QUEUE_LEN;
    iob->key_queue_count += 1U;
    return CADR_STATUS_OK;
}
cadr_status cadr_iob_read(cadr_machine_state *const state,
                          const uint32_t uaddr,
                          uint16_t *const out_value)
{
    if (state == NULL || out_value == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    switch (uaddr) {
    case CADR_IOB_KBD_LOW:
        *out_value = (uint16_t)state->devices.iob.scancode;
        state->devices.iob.csr &= ~CADR_IOB_CSR_KEYBOARD_READY;
        return CADR_STATUS_OK;
    case CADR_IOB_KBD_HIGH:
        *out_value = (uint16_t)(state->devices.iob.scancode >> 16U);
        state->devices.iob.csr &= ~CADR_IOB_CSR_KEYBOARD_READY;
        return CADR_STATUS_OK;
    case CADR_IOB_CSR: *out_value = (uint16_t)state->devices.iob.csr; return CADR_STATUS_OK;
    case CADR_IOB_USEC_LOW:
        state->devices.iob.usec_latched = state->devices.iob.usec_clock;
        *out_value = (uint16_t)state->devices.iob.usec_latched;
        return CADR_STATUS_OK;
    case CADR_IOB_USEC_HIGH:
        *out_value = (uint16_t)(state->devices.iob.usec_latched >> 16U);
        return CADR_STATUS_OK;
    case CADR_IOB_60_HZ: *out_value = state->devices.iob.sixty_cycle_clock; return CADR_STATUS_OK;
    default: *out_value = 0U; return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
}

cadr_status cadr_iob_write(cadr_machine_state *const state,
                           const uint32_t uaddr,
                           const uint16_t value)
{
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (uaddr == CADR_IOB_CSR) {
        state->devices.iob.csr = (state->devices.iob.csr & ~UINT32_C(017)) |
            ((uint32_t)value & UINT32_C(017));
        return CADR_STATUS_OK;
    }
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

#include "cadr_bus_device.h"

#if defined(CADR_M11_CORE)
#include "cadr_audio_model.h"
#endif

/*
 * M5 is the selected U303 I/O-board subset.  It is derived from the pinned
 * usim iob.c/kbd.c witness: CSR<5> is keyboard-ready, CSR<2> enables vector
 * 0260, reading the low keyboard half consumes ready, and a ten-entry FIFO
 * holds subsequent events.  Wall time, SDL and signal timers remain outside
 * this deterministic core.
 */

#define CADR_IOB_KBD_LOW UINT32_C(0764100)
#define CADR_IOB_KBD_HIGH UINT32_C(0764102)
#define CADR_IOB_MOUSE_Y UINT32_C(0764104)
#define CADR_IOB_MOUSE_X UINT32_C(0764106)
#define CADR_IOB_BEEP UINT32_C(0764110)
#define CADR_IOB_CSR UINT32_C(0764112)
#define CADR_IOB_USEC_LOW UINT32_C(0764120)
#define CADR_IOB_USEC_HIGH UINT32_C(0764122)
#define CADR_IOB_60_HZ UINT32_C(0764124)
#define CADR_IOB_CSR_KEYBOARD_INTERRUPT UINT32_C(1) << 2U
#define CADR_IOB_CSR_KEYBOARD_READY UINT32_C(1) << 5U
#define CADR_IOB_CSR_MOUSE_INTERRUPT UINT32_C(1) << 1U
#define CADR_IOB_CSR_MOUSE_READY UINT32_C(1) << 4U
#define CADR_IOB_KEYBOARD_VECTOR UINT16_C(0260)
#define CADR_IOB_MOUSE_VECTOR UINT16_C(0264)

#if defined(CADR_M11_CORE)
static cadr_status cadr_iob_beep(cadr_machine_state *state,
                                 uint32_t half_wavelength_us)
{
    cadr_audio_status status;
    cadr_audio_model *model;
    uint64_t post_slot;
    if (state == NULL || half_wavelength_us == 0U) return CADR_STATUS_INVALID_ARGUMENT;
    model = state->devices.audio_model;
    if (model == NULL || state->clock_slots_completed == UINT64_MAX) {
        return CADR_STATUS_NOT_READY;
    }
    post_slot = state->clock_slots_completed + UINT64_C(1);
    status = cadr_audio_model_accept_beep_job(
        model, post_slot, half_wavelength_us,
        state->cpu.m_memory[22U] & UINT32_C(0x00ffffff));
    if (status == CADR_AUDIO_STATUS_OK) return CADR_STATUS_OK;
    if (status == CADR_AUDIO_STATUS_BACKPRESSURE) return CADR_STATUS_QUEUE_FULL;
    /* More than one BEEP transition in one outer slot has no selected-profile
     * ordering witness.  Preserve the first event and fail closed. */
    return status == CADR_AUDIO_STATUS_INVALID_ARGUMENT ? CADR_STATUS_NOT_READY :
        CADR_STATUS_INVALID_ARGUMENT;
}
#endif

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

#if defined(CADR_M9_CORE)
cadr_status cadr_iob_pointer_event(cadr_machine_state *const state,
                                    const uint32_t edge32)
{
    cadr_iob_state *iob;
    const uint32_t x = edge32 & UINT32_C(0x3ff);
    const uint32_t y = (edge32 >> 10U) & UINT32_C(0x3ff);
    const uint32_t buttons = (edge32 >> 20U) & UINT32_C(07);
    const uint32_t changed = (edge32 >> 23U) & UINT32_C(07);
    if (state == NULL || (edge32 & UINT32_C(0xf0000000)) != 0U ||
        x >= UINT32_C(768) || y >= UINT32_C(963) ||
        (changed != 0U && (changed & (changed - 1U)) != 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    iob = &state->devices.iob;
    /* Pinned usim iob.c packs the two raw encoder bits in mouse X and the
     * tail/middle/head switches in mouse Y.  Browser EDGE32 has no raw
     * encoder source, so both raw bits are the explicit zero value. */
    iob->mouse_x = (uint16_t)x;
    iob->mouse_y = (uint16_t)(y |
        ((buttons & UINT32_C(01)) << 12U) |
        ((buttons & UINT32_C(02)) << 12U) |
        ((buttons & UINT32_C(04)) << 12U));
    iob->csr |= CADR_IOB_CSR_MOUSE_READY;
    /* Selected X11 mouse.c asserts vector 0264 for every accepted event.
     * The maintained SDL3 iob_set_mouse_ready alternative gates this on
     * CSR<1>; that alternate behavior is not the CADR-WEB-303 X11 profile. */
    cadr_bus_assert_unibus_interrupt(state, CADR_IOB_MOUSE_VECTOR);
    return CADR_STATUS_OK;
}
#endif

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
#if defined(CADR_M11_CORE)
    case CADR_IOB_BEEP:
        *out_value = 0U;
        return cadr_iob_beep(state, UINT32_C(0x00ffffff));
#endif
#if defined(CADR_M9_CORE)
    case CADR_IOB_MOUSE_Y:
        *out_value = state->devices.iob.mouse_y;
        state->devices.iob.csr &= ~CADR_IOB_CSR_MOUSE_READY;
        return CADR_STATUS_OK;
    case CADR_IOB_MOUSE_X:
        *out_value = state->devices.iob.mouse_x;
        return CADR_STATUS_OK;
#endif
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
#if defined(CADR_M11_CORE)
    if (uaddr == CADR_IOB_BEEP) return cadr_iob_beep(state, value);
#endif
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

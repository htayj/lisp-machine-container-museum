#include "cadr_bus_device.h"
#include "cadr_m3_native_observer.h"
#include "cadr_processor_memory.h"
#include "cadr_state_v2.h"
#include "cadr_trace_engine.h"
#include "cadr_disk_evidence.h"

#include <string.h>

static cadr_status xbus_read(cadr_machine_state *state, uint32_t paddr, uint32_t *out_value);
static cadr_status xbus_write(cadr_machine_state *state, uint32_t paddr, uint32_t value);

/*
 * This is the sole M2 physical-word transaction crossover.  The Unibus helper
 * deliberately calls the private xbus functions below, so a mapped Unibus
 * transfer produces one normalized physical transaction instead of nested
 * synthetic entries.
 */
static cadr_status cadr_trace_bus_transaction(cadr_machine_state *state,
                                              uint32_t read_write_kind,
                                              uint32_t paddr, uint32_t value,
                                              uint32_t result,
                                              cadr_status status,
                                              uint16_t interrupt_before,
                                              uint16_t error_before)
{
    cadr_trace_device_transaction transaction;
    transaction.read_write_kind = read_write_kind;
    transaction.address_space = CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD;
    transaction.address = paddr;
    transaction.value = value;
    transaction.result = result;
    transaction.status = status;
    transaction.interrupt_before = interrupt_before;
    transaction.interrupt_after = state->bus.interrupt_status;
    transaction.error_before = error_before;
    transaction.error_after = state->bus.error_status;
    return cadr_trace_engine_stage_device_transaction(state, &transaction);
}

void cadr_bus_device_cold_power_on(cadr_machine_state *const state)
{
    cadr_state_v2_invalidate(state);
    cadr_disk_evidence_reset(&state->disk_evidence);
    (void)memset(&state->bus, 0, sizeof(state->bus));
    (void)memset(&state->devices, 0, sizeof(state->devices));
    state->devices.disk.compatibility_profile = CADR_DISK_COMPAT_SYSTEM_303;
    state->devices.disk.status = CADR_DISK_STATUS_NOT_ACTIVE;
    cadr_bus_set_interrupt_status(state, 0U);
    state->devices.initialized = 1U;
}

/* BUS.INIT resets the bus interface and tape controller; map/display/disk
 * contents are not silently discarded by the selected upstream reset path. */
void cadr_bus_runtime_reset(cadr_machine_state *const state)
{
    cadr_bus_interface_reset(state);
}

static cadr_status memory_read(cadr_machine_state *const state, const uint32_t paddr, uint32_t *const out_value)
{
    if (out_value == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (cadr_processor_memory_main_read(state, paddr, out_value) ==
        CADR_PROCESSOR_MEMORY_NXM) {
        cadr_bus_set_xbus_nxm(state);
    }
    return CADR_STATUS_OK;
}

static cadr_status memory_write(cadr_machine_state *const state, const uint32_t paddr, const uint32_t value)
{
    if (cadr_processor_memory_main_write(state, paddr, value) ==
        CADR_PROCESSOR_MEMORY_NXM) {
        cadr_bus_set_xbus_nxm(state);
    }
    return CADR_STATUS_OK;
}

static cadr_status xbus_io_read(cadr_machine_state *const state, const uint32_t paddr, uint32_t *const out_value)
{
    if (paddr >= 017000000U && paddr <= 017077777U) return cadr_tv_read(state, paddr - 017000000U, out_value);
    if (paddr >= 017377760U && paddr <= 017377767U) return cadr_tv_control_read(state, paddr - 017377760U, out_value);
    if (paddr >= 017377774U && paddr <= 017377777U) return cadr_disk_read(state, paddr - 017377774U, out_value);
    *out_value = 0U; cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

static cadr_status xbus_io_write(cadr_machine_state *const state, const uint32_t paddr, const uint32_t value)
{
    if (paddr >= 017000000U && paddr <= 017077777U) return cadr_tv_write(state, paddr - 017000000U, value);
    if (paddr >= 017377760U && paddr <= 017377767U) return cadr_tv_control_write(state, paddr - 017377760U, value);
    if (paddr >= 017377774U && paddr <= 017377777U) return cadr_disk_write(state, paddr - 017377774U, value);
    cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

static cadr_status xbus_read(cadr_machine_state *const state, const uint32_t paddr, uint32_t *const out_value)
{
    const uint32_t page = paddr >> 8U;
    if (page <= 035773U) return memory_read(state, paddr, out_value);
    if (page >= 036000U && page <= 036777U) return xbus_io_read(state, paddr, out_value);
    *out_value = 0U; cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

static cadr_status xbus_write(cadr_machine_state *const state, const uint32_t paddr, const uint32_t value)
{
    const uint32_t page = paddr >> 8U;
    if (page <= 035773U) return memory_write(state, paddr, value);
    if (page >= 036000U && page <= 036777U) return xbus_io_write(state, paddr, value);
    cadr_bus_set_xbus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_unibus_read16(cadr_machine_state *const state, const uint32_t uaddr, uint16_t *const out_value)
{
    uint32_t page;
    uint16_t map;
    uint32_t paddr;
    uint32_t word;
    cadr_status status;
    if (state == NULL || out_value == NULL || uaddr > UINT32_C(0777777)) return CADR_STATUS_INVALID_ARGUMENT;
    if (uaddr >= 0140000U && uaddr <= 0177777U) {
        page = (uaddr - 0140000U) / 02000U; map = state->bus.unibus_map[page];
        if ((map & UINT16_C(0100000)) == 0U) {
            *out_value = 0U;
            cadr_bus_set_unibus_map_error(state);
            return CADR_STATUS_OK;
        }
        paddr = ((uint32_t)(map & UINT16_C(037777)) << 8U) | ((uaddr >> 2U) & UINT32_C(0377));
        if ((map & UINT16_C(037777)) >= UINT16_C(037000)) { *out_value = ((uaddr & 2U) == 0U) ? (uint16_t)state->cpu.md : (uint16_t)(state->cpu.md >> 16U); return CADR_STATUS_OK; }
        if ((uaddr & 2U) != 0U) { *out_value = state->bus.unibus_halfword[page]; return CADR_STATUS_OK; }
        status = xbus_read(state, paddr, &word);
        *out_value = (uint16_t)word;
        state->bus.unibus_halfword[page] = (uint16_t)(word >> 16U);
        cadr_state_v2_note_bus_map_write(state, page);
        return status;
    }
    if (uaddr >= 0764000U && uaddr <= 0764176U) return cadr_iob_read(state, uaddr, out_value);
    if (uaddr >= 0766000U && uaddr <= 0766036U) return cadr_diagnostic_read(state, uaddr, out_value);
    if (uaddr >= 0766040U && uaddr <= 0766136U) return cadr_bus_interface_read(state, uaddr, out_value);
    if (uaddr >= 0766140U && uaddr <= 0766176U) return cadr_unibus_map_read(state, uaddr, out_value);
    if (uaddr >= 0772520U && uaddr <= 0772532U) return cadr_tape_read(state, uaddr, out_value);
    *out_value = 0U; cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_unibus_write16(cadr_machine_state *const state, const uint32_t uaddr, const uint16_t value)
{
    uint32_t page;
    uint16_t map;
    uint32_t paddr;
    uint32_t word;
    if (state == NULL || uaddr > UINT32_C(0777777)) return CADR_STATUS_INVALID_ARGUMENT;
    if (uaddr >= 0140000U && uaddr <= 0177777U) {
        page = (uaddr - 0140000U) / 02000U; map = state->bus.unibus_map[page];
        if ((map & UINT16_C(0100000)) == 0U ||
            (map & UINT16_C(040000)) == 0U) {
            cadr_bus_set_unibus_map_error(state);
            return CADR_STATUS_OK;
        }
        paddr = ((uint32_t)(map & UINT16_C(037777)) << 8U) | ((uaddr >> 2U) & UINT32_C(0377));
        if ((map & UINT16_C(037777)) >= UINT16_C(037000)) { if ((uaddr & 2U) == 0U) state->cpu.md = (state->cpu.md & UINT32_C(0xffff0000)) | value; else state->cpu.md = (state->cpu.md & UINT32_C(0xffff)) | ((uint32_t)value << 16U); return CADR_STATUS_OK; }
        if ((uaddr & 2U) == 0U) {
            state->bus.unibus_halfword[page] = value;
            cadr_state_v2_note_bus_map_write(state, page);
            return CADR_STATUS_OK;
        }
        word = ((uint32_t)value << 16U) | state->bus.unibus_halfword[page]; return xbus_write(state, paddr, word);
    }
    if (uaddr >= 0764000U && uaddr <= 0764176U) return cadr_iob_write(state, uaddr, value);
    if (uaddr >= 0766000U && uaddr <= 0766036U) return cadr_diagnostic_write(state, uaddr, value);
    if (uaddr >= 0766040U && uaddr <= 0766136U) return cadr_bus_interface_write(state, uaddr, value);
    if (uaddr >= 0766140U && uaddr <= 0766176U) return cadr_unibus_map_write(state, uaddr, value);
    if (uaddr >= 0772520U && uaddr <= 0772532U) return cadr_tape_write(state, uaddr, value);
    cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

cadr_status cadr_bus_read32(cadr_machine_state *const state, const uint32_t paddr, uint32_t *const out_value)
{
    const uint32_t page = paddr >> 8U;
    uint16_t interrupt_before;
    uint16_t error_before;
    uint16_t word;
    cadr_status status;
    if (state == NULL || out_value == NULL || paddr > UINT32_C(017777777)) return CADR_STATUS_INVALID_ARGUMENT;
    interrupt_before = state->bus.interrupt_status;
    error_before = state->bus.error_status;
    if (page < 037000U) {
        status = xbus_read(state, paddr, out_value);
    } else if (page <= 037777U) {
        status = cadr_unibus_read16(state,
                                    (((page - 037000U) << 8U) |
                                     (paddr & UINT32_C(255))) << 1U,
                                    &word);
        *out_value = word;
    } else {
        *out_value = 0U;
        cadr_bus_set_xbus_nxm(state);
        status = CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
    if (cadr_trace_bus_transaction(state, CADR_TRACE_TRANSACTION_READ, paddr,
                                   0U, *out_value, status, interrupt_before,
                                   error_before) != CADR_STATUS_OK) {
        return CADR_STATUS_GUEST_FAULT;
    }
    cadr_m3_native_observer_bus(state, "read", paddr, 0U, *out_value);
    return status;
}

cadr_status cadr_bus_write32(cadr_machine_state *const state, const uint32_t paddr, const uint32_t value)
{
    const uint32_t page = paddr >> 8U;
    uint16_t interrupt_before;
    uint16_t error_before;
    cadr_status status;
    if (state == NULL || paddr > UINT32_C(017777777)) return CADR_STATUS_INVALID_ARGUMENT;
    interrupt_before = state->bus.interrupt_status;
    error_before = state->bus.error_status;
    if (page < 037000U) {
        status = xbus_write(state, paddr, value);
    } else if (page <= 037777U) {
        status = cadr_unibus_write16(state,
                                     (((page - 037000U) << 8U) |
                                      (paddr & UINT32_C(255))) << 1U,
                                     (uint16_t)value);
    } else {
        cadr_bus_set_xbus_nxm(state);
        status = CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
    if (cadr_trace_bus_transaction(state, CADR_TRACE_TRANSACTION_WRITE, paddr,
                                   value, 0U, status, interrupt_before,
                                   error_before) != CADR_STATUS_OK) {
        return CADR_STATUS_GUEST_FAULT;
    }
    cadr_m3_native_observer_bus(state, "write", paddr, value, 0U);
    return status;
}

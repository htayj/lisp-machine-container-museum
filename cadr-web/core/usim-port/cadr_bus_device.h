#ifndef CADR_BUS_DEVICE_H
#define CADR_BUS_DEVICE_H

/*
 * Deterministic, instance-owned adaptation of the public BSD usim bus/device
 * subset recorded in source-map.json.  This is an internal core interface;
 * it deliberately is not part of cadr_host_api.h.
 */
#include <stdint.h>
#include <stddef.h>

#include "cadr_host_api.h"
#include "cadr_state.h"

#define CADR_BUS_ERROR_XBUS_NXM UINT16_C(000001)
#define CADR_BUS_ERROR_UNIBUS_NXM UINT16_C(000010)
#define CADR_BUS_ERROR_UNIBUS_MAP UINT16_C(000040)

void cadr_bus_device_cold_power_on(cadr_machine_state *state);
void cadr_bus_runtime_reset(cadr_machine_state *state);
cadr_status cadr_bus_read32(cadr_machine_state *state, uint32_t paddr, uint32_t *out_value);
cadr_status cadr_bus_write32(cadr_machine_state *state, uint32_t paddr, uint32_t value);
cadr_status cadr_unibus_read16(cadr_machine_state *state, uint32_t uaddr, uint16_t *out_value);
cadr_status cadr_unibus_write16(cadr_machine_state *state, uint32_t uaddr, uint16_t value);

void cadr_bus_interface_reset(cadr_machine_state *state);
void cadr_bus_set_interrupt_status(cadr_machine_state *state, uint16_t value);
uint32_t cadr_bus_interrupt_pending(const cadr_machine_state *state);
void cadr_bus_assert_unibus_interrupt(cadr_machine_state *state, uint16_t vector);
void cadr_bus_deassert_unibus_interrupt(cadr_machine_state *state);
void cadr_bus_assert_xbus_interrupt(cadr_machine_state *state);
void cadr_bus_deassert_xbus_interrupt(cadr_machine_state *state);
void cadr_bus_processor_interrupt_control_written(cadr_machine_state *state,
                                                  uint32_t new_control);
void cadr_bus_set_xbus_nxm(cadr_machine_state *state);
void cadr_bus_set_unibus_nxm(cadr_machine_state *state);
void cadr_bus_set_unibus_map_error(cadr_machine_state *state);
cadr_status cadr_bus_interface_read(cadr_machine_state *state, uint32_t uaddr, uint16_t *out_value);
cadr_status cadr_bus_interface_write(cadr_machine_state *state, uint32_t uaddr, uint16_t value);
cadr_status cadr_unibus_map_read(cadr_machine_state *state, uint32_t uaddr, uint16_t *out_value);
cadr_status cadr_unibus_map_write(cadr_machine_state *state, uint32_t uaddr, uint16_t value);
void cadr_diagnostic_set_latches(cadr_machine_state *state,
                                 const cadr_diagnostic_latches *latches);
uint64_t cadr_diagnostic_debug_instruction(const cadr_machine_state *state);
cadr_status cadr_diagnostic_read(cadr_machine_state *state, uint32_t uaddr, uint16_t *out_value);
cadr_status cadr_diagnostic_write(cadr_machine_state *state, uint32_t uaddr, uint16_t value);
cadr_status cadr_tv_read(cadr_machine_state *state, uint32_t offset, uint32_t *out_value);
cadr_status cadr_tv_write(cadr_machine_state *state, uint32_t offset, uint32_t value);
cadr_status cadr_tv_control_read(cadr_machine_state *state, uint32_t offset, uint32_t *out_value);
cadr_status cadr_tv_control_write(cadr_machine_state *state, uint32_t offset, uint32_t value);
cadr_status cadr_colortv_read(cadr_machine_state *state, uint32_t offset, uint32_t *out_value);
cadr_status cadr_colortv_write(cadr_machine_state *state, uint32_t offset, uint32_t value);
cadr_status cadr_colortv_control_read(cadr_machine_state *state, uint32_t offset, uint32_t *out_value);
cadr_status cadr_colortv_control_write(cadr_machine_state *state, uint32_t offset, uint32_t value);
cadr_status cadr_iob_read(cadr_machine_state *state, uint32_t uaddr, uint16_t *out_value);
cadr_status cadr_iob_write(cadr_machine_state *state, uint32_t uaddr, uint16_t value);
cadr_status cadr_disk_read(cadr_machine_state *state, uint32_t offset, uint32_t *out_value);
cadr_status cadr_disk_write(cadr_machine_state *state, uint32_t offset, uint32_t value);
cadr_status cadr_tape_read(cadr_machine_state *state, uint32_t uaddr, uint16_t *out_value);
cadr_status cadr_tape_write(cadr_machine_state *state, uint32_t uaddr, uint16_t value);
cadr_status cadr_uch11_read_csr(cadr_machine_state *state, uint16_t *out_value);
cadr_status cadr_uch11_write_csr(cadr_machine_state *state, uint16_t value);

#endif

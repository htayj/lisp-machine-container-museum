#include "cadr_bus_device.h"
#include "cadr_processor_memory.h"

#include <stdio.h>
#include <stdlib.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", \
                      __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static cadr_machine_state *new_state(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    CHECK(state != NULL);
    if (state != NULL) {
        cadr_bus_device_cold_power_on(state);
        cadr_processor_memory_set_main_memory_pages(state, 1U);
    }
    return state;
}

static void test_authoritative_ram_map_and_reset(void)
{
    cadr_machine_state *state = new_state();
    uint16_t halfword = UINT16_C(0xffff);
    uint32_t word = 0U;
    if (state == NULL) return;

    CHECK(cadr_unibus_read16(state, 0140000U, &halfword) ==
          CADR_STATUS_OK);
    CHECK(halfword == 0U);
    CHECK((state->bus.error_status & CADR_BUS_ERROR_UNIBUS_MAP) != 0U);
    CHECK(cadr_unibus_map_write(state, 0766140U, UINT16_C(0100000)) ==
          CADR_STATUS_OK);
    CHECK(cadr_unibus_write16(state, 0140000U, UINT16_C(0777)) ==
          CADR_STATUS_OK);
    CHECK((state->bus.error_status & CADR_BUS_ERROR_UNIBUS_MAP) != 0U);
    CHECK(cadr_bus_read32(state, 0U, &word) == CADR_STATUS_OK);
    CHECK(word == 0U);
    CHECK(cadr_unibus_map_write(state, 0766140U, UINT16_C(0140000)) ==
          CADR_STATUS_OK);
    CHECK(cadr_unibus_write16(state, 0140000U, UINT16_C(012345)) ==
          CADR_STATUS_OK);
    CHECK(cadr_unibus_write16(state, 0140002U, UINT16_C(067001)) ==
          CADR_STATUS_OK);
    CHECK(cadr_bus_read32(state, 0U, &word) == CADR_STATUS_OK);
    CHECK(word == (((uint32_t)UINT16_C(067001) << 16U) |
                   UINT16_C(012345)));

    state->cpu.main_memory_nxm = 0U;
    CHECK(cadr_bus_read32(state, UINT32_C(0400), &word) == CADR_STATUS_OK);
    CHECK(word == UINT32_MAX);
    CHECK(state->cpu.main_memory_nxm == 1U);
    CHECK((state->bus.error_status & CADR_BUS_ERROR_XBUS_NXM) != 0U);

    state->devices.tv_screen[0] = UINT32_C(0x12345678);
    cadr_bus_runtime_reset(state);
    CHECK(state->bus.unibus_map[0] == UINT16_C(0140000));
    CHECK(state->devices.tv_screen[0] == UINT32_C(0x12345678));
    cadr_bus_device_cold_power_on(state);
    CHECK(state->bus.unibus_map[0] == 0U);
    CHECK(state->devices.tv_screen[0] == 0U);
    free(state);
}

static void test_disabled_color_probe_and_typed_stubs(void)
{
    cadr_machine_state *state = new_state();
    uint32_t value = UINT32_C(0xa5a5a5a5);
    uint16_t value16 = UINT16_C(0xa5a5);
    if (state == NULL) return;

    CHECK(cadr_bus_write32(state, 017200000U, 1U) ==
          CADR_STATUS_UNIMPLEMENTED_DEVICE);
    CHECK((state->bus.error_status & CADR_BUS_ERROR_XBUS_NXM) != 0U);
    state->bus.error_status = 0U;
    CHECK(cadr_bus_read32(state, 017200000U, &value) ==
          CADR_STATUS_UNIMPLEMENTED_DEVICE);
    CHECK(value == 0U);
    CHECK((state->bus.error_status & CADR_BUS_ERROR_XBUS_NXM) != 0U);

    value = UINT32_C(0xa5a5a5a5);
    CHECK(cadr_colortv_read(state, 0U, &value) ==
          CADR_STATUS_UNIMPLEMENTED_DEVICE);
    CHECK(value == UINT32_C(0xa5a5a5a5));
    CHECK(cadr_disk_read(state, 0U, &value) == CADR_STATUS_OK);
    CHECK(value == 1U);
    CHECK(cadr_tape_read(state, 0772520U, &value16) ==
          CADR_STATUS_UNIMPLEMENTED_DEVICE);
    CHECK(value16 == UINT16_C(0xa5a5));
    CHECK(cadr_uch11_read_csr(state, &value16) ==
          CADR_STATUS_UNIMPLEMENTED_DEVICE);
    CHECK(value16 == UINT16_C(0xa5a5));
    free(state);
}

static void test_interrupt_status_and_processor_reset_trigger(void)
{
    cadr_machine_state *state = new_state();
    uint16_t value = 0U;
    if (state == NULL) return;

    cadr_bus_set_interrupt_status(state, UINT16_C(02000));
    CHECK(cadr_bus_interrupt_pending(state) == 0U);
    cadr_bus_assert_unibus_interrupt(state, UINT16_C(0260));
    CHECK(cadr_bus_interrupt_pending(state) == 1U);
    CHECK(state->cpu.interrupt_pending == 1U);
    CHECK((state->bus.interrupt_status & UINT16_C(01774)) ==
          UINT16_C(0260));
    cadr_bus_deassert_unibus_interrupt(state);
    CHECK(cadr_bus_interrupt_pending(state) == 0U);
    cadr_bus_set_interrupt_status(state, UINT16_C(0260));
    cadr_bus_deassert_unibus_interrupt(state);
    CHECK(state->bus.interrupt_status == UINT16_C(0260));
    cadr_bus_assert_xbus_interrupt(state);
    CHECK(cadr_bus_interrupt_pending(state) == 1U);
    cadr_bus_deassert_xbus_interrupt(state);
    CHECK(cadr_bus_interrupt_pending(state) == 0U);

    CHECK(cadr_unibus_map_write(state, 0766140U, UINT16_C(0140000)) ==
          CADR_STATUS_OK);
    state->bus.error_status = CADR_BUS_ERROR_XBUS_NXM;
    cadr_bus_processor_interrupt_control_written(
        state, UINT32_C(1) << 28U);
    CHECK(state->bus.error_status == 0U);
    CHECK(state->bus.unibus_map[0] == UINT16_C(0140000));

    CHECK(cadr_bus_interface_write(state, 0766040U, UINT16_C(036001)) ==
          CADR_STATUS_OK);
    CHECK(cadr_bus_interface_write(state, 0766042U, UINT16_C(0101774)) ==
          CADR_STATUS_OK);
    CHECK(cadr_bus_interface_read(state, 0766040U, &value) ==
          CADR_STATUS_OK);
    CHECK(value == UINT16_C(0137775));
    CHECK(state->cpu.interrupt_pending == 1U);
    free(state);
}

static void test_diagnostic_latches_and_debug_instruction(void)
{
    cadr_machine_state *state = new_state();
    cadr_diagnostic_latches latches = {0};
    uint16_t value = 0U;
    if (state == NULL) return;

    latches.instruction = UINT64_C(0x0000aabbccddeeff);
    latches.opc = UINT32_C(012345);
    latches.next_micro_pc = UINT32_C(06701);
    latches.output_bus = UINT32_C(0x12345678);
    latches.m_source = UINT32_C(0x89abcdef);
    latches.a_source = UINT32_C(0x76543210);
    latches.machine_error = 1U;
    latches.single_step_done = 1U;
    latches.running = 1U;
    latches.write_map = 1U;
    latches.destination_spc = 1U;
    latches.instruction_write = 1U;
    latches.instruction_modify = 1U;
    latches.pdl_write = 1U;
    latches.spc_push = 1U;
    latches.instruction_parity = 1U;
    latches.nop = 1U;
    latches.vma_ok = 1U;
    latches.jump_condition = 1U;
    latches.next_pc_source = 3U;
    cadr_diagnostic_set_latches(state, &latches);

    CHECK(cadr_diagnostic_read(state, 0766000U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0xeeff));
    CHECK(cadr_diagnostic_read(state, 0766002U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0xccdd));
    CHECK(cadr_diagnostic_read(state, 0766004U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0xaabb));
    CHECK(cadr_diagnostic_read(state, 0766020U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0xffff));
    CHECK(cadr_diagnostic_read(state, 0766022U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0x3f3f));
    CHECK(cadr_diagnostic_read(state, 0766024U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0xcdef));
    CHECK(cadr_diagnostic_read(state, 0766030U, &value) == CADR_STATUS_OK);
    CHECK(value == UINT16_C(0x3210));

    CHECK(cadr_diagnostic_write(state, 0766000U, UINT16_C(0x1122)) ==
          CADR_STATUS_OK);
    CHECK(cadr_diagnostic_write(state, 0766002U, UINT16_C(0x3344)) ==
          CADR_STATUS_OK);
    CHECK(cadr_diagnostic_write(state, 0766004U, UINT16_C(0x5566)) ==
          CADR_STATUS_OK);
    CHECK(cadr_diagnostic_debug_instruction(state) ==
          UINT64_C(0x556633441122));
    free(state);
}

int main(void)
{
    test_authoritative_ram_map_and_reset();
    test_disabled_color_probe_and_typed_stubs();
    test_interrupt_status_and_processor_reset_trigger();
    test_diagnostic_latches_and_debug_instruction();
    if (failures != 0) return 1;
    (void)puts("cadr_bus_device: ok");
    return 0;
}

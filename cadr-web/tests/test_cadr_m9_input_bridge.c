#include <stdint.h>
#include <string.h>

#include "cadr_machine.h"
#include "usim-port/cadr_bus_device.h"

static void put16(uint8_t *at, uint16_t value)
{
    at[0] = (uint8_t)value;
    at[1] = (uint8_t)(value >> 8U);
}

static void put32(uint8_t *at, uint32_t value)
{
    uint32_t index;
    for (index = 0U; index < 4U; ++index) at[index] = (uint8_t)(value >> (index * 8U));
}

static void put64(uint8_t *at, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) at[index] = (uint8_t)(value >> (index * 8U));
}

static void input_record(uint8_t bytes[CADR_M9_INPUT_RECORD_BYTES], uint16_t kind,
                         uint64_t generation, uint64_t ordinal, uint32_t payload)
{
    (void)memset(bytes, 0, CADR_M9_INPUT_RECORD_BYTES);
    (void)memcpy(bytes, "CDRINP1", 7U);
    put16(bytes + 8U, CADR_M9_INPUT_SCHEMA);
    put16(bytes + 10U, kind);
    put64(bytes + 16U, generation);
    put64(bytes + 24U, ordinal);
    put32(bytes + 32U, payload);
}

static cadr_machine *running_machine(void)
{
    const cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M9, (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK || machine == NULL) return NULL;
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    machine->state.scheduler.phase = CADR_SCHEDULER_PHASE_BOUNDARY_READY;
    machine->state.events.generation = UINT64_C(9);
    /* Keyboard interrupts enabled, mouse interrupts deliberately disabled:
     * selected X11 mouse.c still asserts vector 0264 unconditionally. */
    machine->state.devices.iob.csr = (UINT32_C(1) << 2U);
    machine->state.bus.interrupt_status = UINT16_C(02000);
    return machine;
}

int main(void)
{
    cadr_machine *machine = running_machine();
    uint8_t record[CADR_M9_INPUT_RECORD_BYTES];
    uint16_t value = 0U;
    uint32_t edge;
    if (machine == NULL) return 1;

    input_record(record, CADR_M9_INPUT_KIND_KEYBOARD, UINT64_C(9), UINT64_C(1), UINT32_C(0101));
    if (cadr_machine_m9_input_deliver(machine, record, sizeof(record)) != CADR_STATUS_OK ||
        machine->state.devices.iob.scancode != UINT32_C(0x10041) ||
        (machine->state.devices.iob.csr & (UINT32_C(1) << 5U)) == 0U ||
        machine->state.devices.iob.input_sequence != 1U ||
        machine->state.devices.iob.input_ingress_ordinal != UINT64_C(1)) {
        cadr_machine_destroy(machine); return 1;
    }

    edge = UINT32_C(123) | (UINT32_C(456) << 10U) | (UINT32_C(5) << 20U) |
        (UINT32_C(1) << 23U);
    input_record(record, CADR_M9_INPUT_KIND_POINTER, UINT64_C(9), UINT64_C(2), edge);
    if (cadr_machine_m9_input_deliver(machine, record, sizeof(record)) != CADR_STATUS_OK ||
        machine->state.devices.iob.mouse_x != UINT16_C(123) ||
        machine->state.devices.iob.mouse_y != (uint16_t)(UINT16_C(456) | UINT16_C(050000)) ||
        (machine->state.devices.iob.csr & (UINT32_C(1) << 4U)) == 0U ||
        (machine->state.bus.interrupt_status & UINT16_C(0100000)) == 0U ||
        (machine->state.bus.interrupt_status & UINT16_C(01774)) != UINT16_C(0264) ||
        machine->state.devices.iob.input_sequence != 2U) {
        cadr_machine_destroy(machine); return 1;
    }
    if (cadr_iob_read(&machine->state, UINT32_C(0764104), &value) != CADR_STATUS_OK ||
        value != (uint16_t)(UINT16_C(456) | UINT16_C(050000)) ||
        (machine->state.devices.iob.csr & (UINT32_C(1) << 4U)) != 0U ||
        cadr_iob_read(&machine->state, UINT32_C(0764106), &value) != CADR_STATUS_OK ||
        value != UINT16_C(123)) {
        cadr_machine_destroy(machine); return 1;
    }

    /* The all-up word follows the same native keyboard ingress path and is
     * queued behind the still-ready key; it is not a fake scheduler event. */
    input_record(record, CADR_M9_INPUT_KIND_KEYBOARD, UINT64_C(9), UINT64_C(3), UINT32_C(0x8000));
    if (cadr_machine_m9_input_deliver(machine, record, sizeof(record)) != CADR_STATUS_OK ||
        machine->state.devices.iob.key_queue_count != 1U ||
        machine->state.devices.iob.input_sequence != 3U) {
        cadr_machine_destroy(machine); return 1;
    }
    input_record(record, CADR_M9_INPUT_KIND_POINTER, UINT64_C(9), UINT64_C(3), edge);
    if (cadr_machine_m9_input_deliver(machine, record, sizeof(record)) != CADR_STATUS_STALE_GENERATION ||
        machine->state.devices.iob.input_sequence != 3U) {
        cadr_machine_destroy(machine); return 1;
    }
    input_record(record, CADR_M9_INPUT_KIND_POINTER, UINT64_C(9), UINT64_C(4),
                 UINT32_C(768));
    if (cadr_machine_m9_input_deliver(machine, record, sizeof(record)) != CADR_STATUS_INVALID_ARGUMENT ||
        machine->state.devices.iob.input_ingress_ordinal != UINT64_C(3)) {
        cadr_machine_destroy(machine); return 1;
    }
    cadr_machine_destroy(machine);
    return 0;
}

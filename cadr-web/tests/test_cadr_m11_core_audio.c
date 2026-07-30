#include "cadr_machine.h"
#include "usim-port/cadr_bus_device.h"

#include <stdio.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        ++failures; \
    } \
} while (0)

int main(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M11,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_reset_request reset = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M11,
        (uint32_t)sizeof(cadr_reset_request), 0U
    };
    cadr_machine *machine = NULL;
    cadr_audio_cursor cursor;
    uint16_t ignored = UINT16_C(0xffff);

    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine == NULL) return 1;
    CHECK(machine->state.devices.audio_model == &machine->audio);
    /* Cold power clears the semantic device state, then must restore the
     * machine-owned M11 binding before resetting its live authority. */
    machine->state.artifacts.boot_configuration_ingressed = 1U;
    machine->state.artifacts.control_store_ingressed = 1U;
    machine->state.artifacts.base_disk_verified = 1U;
    CHECK(cadr_machine_cold_power_on(machine) == CADR_STATUS_OK);
    CHECK(machine->state.lifecycle == CADR_MACHINE_POWERED &&
          machine->state.devices.audio_model == &machine->audio &&
          machine->audio.count == 0U &&
          machine->audio.generation == UINT64_C(2));
    machine->state.cpu.m_memory[22] = UINT32_C(125000);
    CHECK(cadr_iob_write(&machine->state, UINT32_C(0764110), UINT16_C(500)) ==
          CADR_STATUS_OK);
    CHECK(cadr_audio_model_peek(&machine->audio, &cursor) == CADR_AUDIO_STATUS_OK &&
          cursor.sequence == 0U && cursor.event[16] == UINT8_C(1) &&
          cursor.frames_remaining == CADR_AUDIO_FRAMES_PER_PACKET);
    /* Two transitions in one outer slot intentionally do not guess an order. */
    CHECK(cadr_iob_read(&machine->state, UINT32_C(0764110), &ignored) ==
          CADR_STATUS_NOT_READY && ignored == 0U);
    machine->state.clock_slots_completed = UINT64_C(1);
    CHECK(cadr_iob_read(&machine->state, UINT32_C(0764110), &ignored) ==
          CADR_STATUS_OK && ignored == 0U);
    CHECK(machine->audio.count == UINT32_C(4));
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    CHECK(cadr_machine_reset(machine, &reset) == CADR_STATUS_OK &&
          machine->audio.count == 0U &&
          machine->state.devices.audio_model == &machine->audio);
    cadr_machine_destroy(machine);
    return failures == 0 ? 0 : 1;
}

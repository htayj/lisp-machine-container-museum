#include "cadr_machine.h"
#include "usim-port/cadr_bus_device.h"

#include <stdio.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        ++failures; \
    } \
} while (0)

static void put16(uint8_t *at, uint16_t value)
{
    at[0] = (uint8_t)value;
    at[1] = (uint8_t)(value >> 8U);
}

static void put32(uint8_t *at, uint32_t value)
{
    uint32_t index;
    for (index = 0U; index < 4U; ++index) {
        at[index] = (uint8_t)(value >> (index * 8U));
    }
}

static void put64(uint8_t *at, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        at[index] = (uint8_t)(value >> (index * 8U));
    }
}

static void input_record(uint8_t bytes[CADR_M9_INPUT_RECORD_BYTES], uint64_t generation,
                         uint64_t ordinal, uint16_t keyboard_word)
{
    (void)memset(bytes, 0, CADR_M9_INPUT_RECORD_BYTES);
    (void)memcpy(bytes, "CDRINP1", 7U);
    put16(bytes + 8U, CADR_M9_INPUT_SCHEMA);
    put16(bytes + 10U, CADR_M9_INPUT_KIND_KEYBOARD);
    put64(bytes + 16U, generation);
    put64(bytes + 24U, ordinal);
    put32(bytes + 32U, keyboard_word);
}

static int emit_generation_two_audio(const char *path)
{
    cadr_audio_incarnation_allocator allocator = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_model model = { 0 };
    uint8_t bytes[CADR_AUDIO_SNAPSHOT_MAX_BYTES];
    uint32_t written = 0U;
    FILE *output = NULL;
    int ok = 0;
    if (path == NULL ||
        cadr_audio_incarnation_allocator_initialize(&allocator, UINT64_C(1)) !=
            CADR_AUDIO_STATUS_OK ||
        cadr_audio_authority_initialize(&authority, &allocator,
            UINT64_C(0x4344524d31324155), UINT64_C(1), UINT64_C(0)) !=
            CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_initialize(&model, &authority, UINT64_C(2),
            CADR_AUDIO_RENDERER_USIM_SDL3_SINE) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_snapshot_serialize(&model, bytes,
            sizeof(bytes), &written) != CADR_AUDIO_STATUS_OK) goto done;
    output = fopen(path, "wb");
    if (output == NULL || fwrite(bytes, 1U, written, output) != written ||
        fclose(output) != 0) { output = NULL; goto done; }
    output = NULL;
    ok = 1;
done:
    if (output != NULL) (void)fclose(output);
    if (model.authority != NULL) (void)cadr_audio_model_destroy(&model);
    if (authority.lifecycle != 0U) (void)cadr_audio_authority_destroy(&authority);
    return ok ? 0 : 1;
}

int main(int argc, char **argv)
{
    const cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    cadr_audio_cursor cursor;
    uint8_t record[CADR_M9_INPUT_RECORD_BYTES];

    if (argc == 3 && strcmp(argv[1], "--emit-generation-two-audio") == 0) {
        return emit_generation_two_audio(argv[2]);
    }
    if (argc != 1) return 2;

    CHECK(CADR_ABI_MINOR == CADR_ABI_MINOR_M12);
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine == NULL) return 1;
    /* M12 composes M11: a cold start must retain the host-owned binding while
     * clearing the semantic device record. */
    machine->state.artifacts.boot_configuration_ingressed = 1U;
    machine->state.artifacts.control_store_ingressed = 1U;
    machine->state.artifacts.base_disk_verified = 1U;
    CHECK(cadr_machine_cold_power_on(machine) == CADR_STATUS_OK);
    CHECK(machine->state.devices.audio_model == &machine->audio &&
          machine->audio.count == 0U &&
          machine->audio.generation == machine->state.events.generation &&
          machine->audio.generation == UINT64_C(1));
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    machine->state.scheduler.phase = CADR_SCHEDULER_PHASE_BOUNDARY_READY;
    machine->state.events.generation = UINT64_C(9);
    machine->state.devices.iob.csr = UINT32_C(1) << 2U;
    machine->state.clock_slots_completed = UINT64_C(41);
    machine->state.cpu.m_memory[22U] = UINT32_C(125000);

    input_record(record, UINT64_C(9), UINT64_C(1), UINT16_C(0101));
    CHECK(cadr_machine_m9_input_deliver(machine, record, sizeof(record)) == CADR_STATUS_OK);
    CHECK(machine->state.devices.iob.scancode == UINT32_C(0x10041));
    CHECK(machine->state.devices.iob.input_ingress_ordinal == UINT64_C(1));
    CHECK(machine->state.devices.iob.input_sequence == UINT32_C(1));

    /* CDRINP1 has committed at the ready boundary before the same boundary's
     * IOB BEEP request emits its post-slot M11 event.  The two streams retain
     * their distinct sequence domains. */
    CHECK(cadr_iob_write(&machine->state, UINT32_C(0764110), UINT16_C(500)) ==
          CADR_STATUS_OK);
    CHECK(cadr_audio_model_peek(&machine->audio, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(cursor.sequence == UINT64_C(0));
    CHECK(cursor.generation == UINT64_C(1));
    CHECK(cursor.event[16U] == UINT8_C(42));
    CHECK(cursor.event[40U] == UINT8_C(0xf4) && cursor.event[41U] == UINT8_C(0x01));
    CHECK(machine->state.devices.iob.input_ingress_ordinal == UINT64_C(1));
    CHECK(machine->state.devices.iob.input_sequence == UINT32_C(1));
    CHECK(cadr_iob_write(&machine->state, UINT32_C(0764110), UINT16_C(500)) ==
          CADR_STATUS_NOT_READY);

    /* Selected reconstruction invariant: the ordinal is authoritative and
     * input_sequence is exactly its low 32 bits.  Validation precedes IOB
     * mutation, wraps modulo 2^32, and exhausts at UINT64_MAX. */
    machine->state.devices.iob.input_ingress_ordinal = UINT64_C(10);
    machine->state.devices.iob.input_sequence = UINT32_C(9);
    {
        const cadr_iob_state before = machine->state.devices.iob;
        input_record(record, UINT64_C(9), UINT64_C(11), UINT16_C(0102));
        CHECK(cadr_machine_m9_input_deliver(machine, record, sizeof(record)) ==
              CADR_STATUS_STALE_GENERATION);
        CHECK(memcmp(&before, &machine->state.devices.iob, sizeof(before)) == 0);
    }
    machine->state.devices.iob.input_ingress_ordinal = UINT64_C(0xfffffffe);
    machine->state.devices.iob.input_sequence = UINT32_C(0xfffffffe);
    input_record(record, UINT64_C(9), UINT64_C(0xffffffff), UINT16_C(0102));
    CHECK(cadr_machine_m9_input_deliver(machine, record, sizeof(record)) == CADR_STATUS_OK);
    CHECK(machine->state.devices.iob.input_sequence == UINT32_C(0xffffffff));
    input_record(record, UINT64_C(9), UINT64_C(0x100000000), UINT16_C(0103));
    CHECK(cadr_machine_m9_input_deliver(machine, record, sizeof(record)) == CADR_STATUS_OK);
    CHECK(machine->state.devices.iob.input_sequence == UINT32_C(0));
    input_record(record, UINT64_C(9), UINT64_C(0x100000001), UINT16_C(0104));
    CHECK(cadr_machine_m9_input_deliver(machine, record, sizeof(record)) == CADR_STATUS_OK);
    CHECK(machine->state.devices.iob.input_sequence == UINT32_C(1));
    machine->state.devices.iob.input_ingress_ordinal = UINT64_MAX;
    machine->state.devices.iob.input_sequence = UINT32_MAX;
    {
        const cadr_iob_state before = machine->state.devices.iob;
        input_record(record, UINT64_C(9), UINT64_C(0), UINT16_C(0105));
        CHECK(cadr_machine_m9_input_deliver(machine, record, sizeof(record)) ==
              CADR_STATUS_STALE_GENERATION);
        CHECK(memcmp(&before, &machine->state.devices.iob, sizeof(before)) == 0);
    }

    cadr_machine_destroy(machine);
    return failures == 0 ? 0 : 1;
}

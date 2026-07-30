/* Synthetic native CDRSNAP1 input for the cross-target M7 framebuffer gate. */
#include "cadr_boundary_state.h"
#include "cadr_bus_device.h"
#include "cadr_machine.h"
#include "cadr_state_v2.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static cadr_machine *frame_machine(void)
{
    static const uint8_t empty_mutation_sha256[CADR_SHA256_BYTES] = {
        0xd2U,0xb2U,0x1aU,0x8fU,0xbbU,0xb3U,0x1eU,0xa2U,
        0xdaU,0x26U,0xe9U,0x43U,0x97U,0x86U,0x5bU,0x79U,
        0xa2U,0x2fU,0x06U,0x20U,0xa2U,0xedU,0x2dU,0xc9U,
        0xeeU,0x50U,0x92U,0x4dU,0x4aU,0xe2U,0x1eU,0x86U
    };
    const cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK) return NULL;
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    machine->state.scheduler.phase = CADR_SCHEDULER_PHASE_BOUNDARY_READY;
    machine->state.scheduler.hidden_policy = CADR_SCHEDULER_HIDDEN_PAUSE;
    machine->state.devices.initialized = 1U;
    machine->state.devices.disk.compatibility_profile = CADR_DISK_COMPAT_SYSTEM_303;
    machine->state.devices.disk.status = CADR_DISK_STATUS_NOT_ACTIVE;
    machine->state.devices.tv_screen[0U] = UINT32_C(0x80000001);
    machine->state.devices.tv_screen[25U] = UINT32_C(0x00000002);
    if (cadr_canonical_rebuild(&machine->state) != CADR_STATUS_OK) {
        cadr_machine_destroy(machine);
        return NULL;
    }
    (void)memcpy(machine->state.canonical.mutation_sha256,
                 empty_mutation_sha256, sizeof(empty_mutation_sha256));
    machine->state.canonical.initialized = 1U;
    if (cadr_state_v2_rebuild(&machine->state) != CADR_STATUS_OK) {
        cadr_machine_destroy(machine);
        return NULL;
    }
    return machine;
}

int main(int argc, char **argv)
{
    cadr_machine *machine;
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5,
        (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    uint8_t *bytes = NULL;
    uint64_t byte_count = 0U;
    uint64_t written = 0U;
    FILE *output = NULL;
    int result = 1;
    if (argc != 2) return 2;
    machine = frame_machine();
    if (machine == NULL ||
        cadr_machine_snapshot_size(machine, &request, &byte_count) != CADR_STATUS_OK ||
        byte_count == 0U || byte_count > (uint64_t)SIZE_MAX) goto done;
    bytes = malloc((size_t)byte_count);
    if (bytes == NULL ||
        cadr_machine_snapshot_save(machine, &request, bytes, byte_count,
                                   &written) != CADR_STATUS_OK ||
        written != byte_count) goto done;
    output = fopen(argv[1], "wb");
    if (output == NULL ||
        fwrite(bytes, 1U, (size_t)written, output) != (size_t)written ||
        fclose(output) != 0) {
        output = NULL;
        goto done;
    }
    output = NULL;
    result = 0;
done:
    if (output != NULL) (void)fclose(output);
    free(bytes);
    cadr_machine_destroy(machine);
    return result;
}

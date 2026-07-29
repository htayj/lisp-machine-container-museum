/* Native CDRSNAP1 producer plus continuation transcript for the M3 interop gate. */
int cadr_m3_native_unused_main(int argc, char **argv);
#define main cadr_m3_native_unused_main
#include "cadr_m3_native.c"
#undef main

static int parse_slots(const char *text, uint64_t *out)
{
    char *end;
    errno = 0;
    *out = strtoull(text, &end, 10);
    return errno == 0 && *text != '\0' && *end == '\0' && *out != 0U;
}

int main(int argc, char **argv)
{
    cadr_machine_config config = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(config), 0U, CADR_PROFILE_CADR_WEB_303, 0U };
    cadr_run_request run = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(run), 0U, 1U };
    cadr_run_result result = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(result), 0U, 0U, 0U, 0U, 0U };
    cadr_snapshot_request snapshot_request = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(snapshot_request), 0U };
    cadr_machine *machine = NULL;
    uint8_t *snapshot = NULL;
    uint64_t pre, post, snapshot_size = 0U, written = 0U, ordinal, count = 0U;
    FILE *snapshot_file = NULL, *transcript = NULL;
    cadr_status status = CADR_STATUS_OK;
    int ok = 0;
    if (argc != 10 || !parse_slots(argv[6], &pre) || !parse_slots(argv[7], &post)) return 2;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK ||
        !load_artifact(machine, CADR_ARTIFACT_BOOT_CONFIGURATION, argv[1]) ||
        !load_artifact(machine, CADR_ARTIFACT_CONTROL_STORE, argv[2]) ||
        !load_artifact(machine, CADR_ARTIFACT_PROM_SYMBOLS, argv[3]) ||
        !load_artifact(machine, CADR_ARTIFACT_MICROCODE_SYMBOLS, argv[4]) ||
        !load_artifact(machine, CADR_ARTIFACT_BASE_DISK, argv[5]) ||
        cadr_machine_cold_power_on(machine) != CADR_STATUS_OK || cadr_machine_boot(machine) != CADR_STATUS_OK) goto done;
    for (ordinal = 0U; ordinal < pre; ++ordinal) {
        if (cadr_machine_run(machine, &run, &result) != CADR_STATUS_OK) goto done;
    }
    /*
     * The interoperability fixture must exercise M3's D0 extension rather
     * than merely carrying the implied M2 quiescent disk.  This is a valid,
     * inactive System-303 controller state: it records an attention condition
     * and its enabled source without creating an outstanding host request.
     */
    machine->state.devices.disk.command = UINT32_C(012);
    machine->state.devices.disk.status = CADR_DISK_STATUS_NOT_ACTIVE |
        CADR_DISK_STATUS_ATTENTION;
    machine->state.devices.disk.attention_interrupt_enable = 1U;
    if (cadr_machine_snapshot_size(machine, &snapshot_request, &snapshot_size) != CADR_STATUS_OK ||
        snapshot_size == 0U || snapshot_size > (uint64_t)SIZE_MAX) goto done;
    snapshot = malloc((size_t)snapshot_size);
    if (snapshot == NULL || cadr_machine_snapshot_save(machine, &snapshot_request, snapshot,
        snapshot_size, &written) != CADR_STATUS_OK || written != snapshot_size) goto done;
    snapshot_file = fopen(argv[8], "wb");
    if (snapshot_file == NULL || fwrite(snapshot, 1U, (size_t)written, snapshot_file) != written ||
        fclose(snapshot_file) != 0) { snapshot_file = NULL; goto done; }
    snapshot_file = NULL;
    transcript = fopen(argv[9], "wb");
    if (transcript == NULL || !write_header(transcript, post) || !write_boundary(transcript, machine)) goto done;
    count = 1U;
    for (ordinal = 0U; ordinal < post; ++ordinal) {
        status = cadr_machine_run(machine, &run, &result);
        if (!write_boundary(transcript, machine)) { status = CADR_STATUS_HOST_FAILURE; break; }
        count += 1U;
        if (status != CADR_STATUS_OK) break;
    }
    if (!write_footer(transcript, count, status) || fclose(transcript) != 0) { transcript = NULL; goto done; }
    transcript = NULL;
    ok = status == CADR_STATUS_OK && count == post + UINT64_C(1);
done:
    if (snapshot_file != NULL) (void)fclose(snapshot_file);
    if (transcript != NULL) (void)fclose(transcript);
    free(snapshot);
    cadr_machine_destroy(machine);
    return ok ? 0 : 1;
}

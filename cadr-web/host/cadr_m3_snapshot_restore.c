/* Native CDRSNAP1 M3 restore plus CDRSTATE1/2/3 continuation transcript. */
int cadr_m3_native_unused_main(int argc, char **argv);
#define main cadr_m3_native_unused_main
#include "cadr_m3_native.c"
#undef main

static int parse_restore_slots(const char *text, uint64_t *out)
{
    char *end;
    errno = 0;
    *out = strtoull(text, &end, 10);
    return errno == 0 && *text != '\0' && *end == '\0' && *out != 0U;
}

int main(int argc, char **argv)
{
    cadr_snapshot_request request = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(request), 0U };
    cadr_run_request run = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(run), 0U, 1U };
    cadr_run_result result = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(result), 0U, 0U, 0U, 0U, 0U };
    cadr_machine *machine = NULL;
    FILE *input = NULL, *output = NULL;
    uint8_t *bytes = NULL;
    struct stat stat_before;
    uint64_t slots, size, ordinal, count = 0U;
    cadr_status status = CADR_STATUS_OK;
    int success = 0;

    if (argc != 4 || !parse_restore_slots(argv[2], &slots)) return 2;
    input = fopen(argv[1], "rb");
    if (input == NULL || fstat(fileno(input), &stat_before) != 0 ||
        stat_before.st_size <= 0 || (uint64_t)stat_before.st_size > (uint64_t)SIZE_MAX) {
        goto done;
    }
    size = (uint64_t)stat_before.st_size;
    bytes = malloc((size_t)size);
    if (bytes == NULL || fread(bytes, 1U, (size_t)size, input) != (size_t)size ||
        cadr_machine_snapshot_restore(&request, bytes, size, &machine) != CADR_STATUS_OK) {
        goto done;
    }
    if (machine->state.devices.disk.status !=
            (CADR_DISK_STATUS_NOT_ACTIVE | CADR_DISK_STATUS_ATTENTION) ||
        machine->state.devices.disk.command != UINT32_C(012) ||
        machine->state.devices.disk.attention_interrupt_enable != 1U) {
        goto done;
    }
    output = fopen(argv[3], "wb");
    if (output == NULL || !write_header(output, slots) || !write_boundary(output, machine)) {
        goto done;
    }
    count = 1U;
    for (ordinal = 0U; ordinal < slots; ++ordinal) {
        status = cadr_machine_run(machine, &run, &result);
        if (!write_boundary(output, machine)) {
            status = CADR_STATUS_HOST_FAILURE;
            break;
        }
        count += 1U;
        if (status != CADR_STATUS_OK) break;
    }
    if (!write_footer(output, count, status) || fclose(output) != 0) {
        output = NULL;
        goto done;
    }
    output = NULL;
    success = status == CADR_STATUS_OK && count == slots + UINT64_C(1);
done:
    if (input != NULL) (void)fclose(input);
    if (output != NULL) (void)fclose(output);
    free(bytes);
    cadr_machine_destroy(machine);
    return success ? 0 : 1;
}

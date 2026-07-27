#include "cadr_boundary_state.h"
#include "cadr_host_api.h"

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

static int load_artifact(cadr_machine *machine, uint32_t kind, const char *name)
{
    struct stat metadata;
    cadr_artifact_ingress ingress = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_artifact_ingress), kind, 0U
    };
    FILE *stream;
    uint8_t *bytes;
    size_t size;
    cadr_status status;

    if (stat(name, &metadata) != 0 || metadata.st_size < 0 ||
        (uintmax_t)metadata.st_size > SIZE_MAX) {
        (void)fprintf(stderr, "cannot size artifact %s: %s\n", name,
                      strerror(errno));
        return 0;
    }
    size = (size_t)metadata.st_size;
    bytes = size == 0U ? NULL : malloc(size);
    if (size != 0U && bytes == NULL) {
        (void)fprintf(stderr, "cannot allocate artifact %s\n", name);
        return 0;
    }
    stream = fopen(name, "rb");
    if (stream == NULL) {
        (void)fprintf(stderr, "cannot read artifact %s\n", name);
        free(bytes);
        return 0;
    }
    if ((size != 0U && fread(bytes, 1U, size, stream) != size) ||
        fclose(stream) != 0) {
        (void)fprintf(stderr, "cannot read artifact %s\n", name);
        free(bytes);
        return 0;
    }
    ingress.byte_count = size;
    status = cadr_machine_import_artifact(machine, &ingress, bytes, size);
    free(bytes);
    if (status != CADR_STATUS_OK) {
        (void)fprintf(stderr, "artifact %s rejected with status %u\n",
                      name, status);
        return 0;
    }
    return 1;
}

static void write_boundary(FILE *stream, uint64_t ordinal,
                           const cadr_boundary_state *boundary,
                           const uint8_t digest[CADR_SHA256_BYTES])
{
    uint32_t index;
    (void)fprintf(stream,
                  "%llu %u %u %012llx %012llx %u %u %u %u %u %08x %08x ",
                  (unsigned long long)ordinal,
                  boundary->p0_pc, boundary->next_micro_pc,
                  (unsigned long long)boundary->raw_fetched_word,
                  (unsigned long long)boundary->effective_word,
                  boundary->flags, boundary->trace_operation,
                  boundary->trace_a_address, boundary->trace_m_address,
                  boundary->trace_decoded, boundary->trace_a_value,
                  boundary->trace_m_value);
    (void)fprintf(stream, "%llu %llu ",
                  (unsigned long long)boundary->first_mutation_ordinal,
                  (unsigned long long)boundary->mutation_count);
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        (void)fprintf(stream, "%02x", boundary->mutation_sha256[index]);
    }
    (void)fputc(' ', stream);
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        (void)fprintf(stream, "%02x", digest[index]);
    }
    (void)fputc('\n', stream);
}

int main(int argc, char **argv)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_run_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_result), 0U,
        0U, 0U, 0U, 0U
    };
    cadr_machine_info info = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_machine_info), 0U,
        0U, 0U, 0U, 0U, 0U,
        0U, 0U, 0U, 0U, 0U, 0U, 0U
    };
    cadr_boundary_state boundary = {0};
    cadr_machine *machine = NULL;
    FILE *output;
    uint8_t digest[CADR_SHA256_BYTES];
    uint64_t slots;
    uint64_t ordinal;
    char *end;
    cadr_status status;

    if (argc != 8) {
        (void)fprintf(stderr,
            "usage: %s CONFIG PROM PROM-SYMBOLS UCODE-SYMBOLS DISK SLOTS OUTPUT\n",
            argv[0]);
        return 2;
    }
    errno = 0;
    slots = strtoull(argv[6], &end, 10);
    if (errno != 0 || *argv[6] == '\0' || *end != '\0' || slots == 0U) return 2;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK) return 1;
    if (!load_artifact(machine, CADR_ARTIFACT_BOOT_CONFIGURATION, argv[1]) ||
        !load_artifact(machine, CADR_ARTIFACT_CONTROL_STORE, argv[2]) ||
        !load_artifact(machine, CADR_ARTIFACT_PROM_SYMBOLS, argv[3]) ||
        !load_artifact(machine, CADR_ARTIFACT_MICROCODE_SYMBOLS, argv[4]) ||
        !load_artifact(machine, CADR_ARTIFACT_BASE_DISK, argv[5]) ||
        cadr_machine_cold_power_on(machine) != CADR_STATUS_OK ||
        cadr_machine_boot(machine) != CADR_STATUS_OK) {
        cadr_machine_destroy(machine);
        return 1;
    }
    output = fopen(argv[7], "wb");
    if (output == NULL) {
        cadr_machine_destroy(machine);
        return 1;
    }
    (void)cadr_machine_boundary_state(machine, &boundary);
    (void)cadr_machine_boundary_digest(machine, digest);
    write_boundary(output, 0U, &boundary, digest);
    status = CADR_STATUS_OK;
    for (ordinal = 1U; ordinal <= slots; ++ordinal) {
        status = cadr_machine_run(machine, &request, &result);
        (void)cadr_machine_boundary_state(machine, &boundary);
        (void)cadr_machine_boundary_digest(machine, digest);
        write_boundary(output, ordinal, &boundary, digest);
        if (status != CADR_STATUS_OK) break;
    }
    if (fclose(output) != 0) status = CADR_STATUS_HOST_FAILURE;
    if (cadr_machine_query(machine, &info) != CADR_STATUS_OK) {
        status = CADR_STATUS_HOST_FAILURE;
    }
    if (cadr_machine_boundary_state(machine, &boundary) != CADR_STATUS_OK) {
        status = CADR_STATUS_HOST_FAILURE;
    }
    (void)fprintf(stderr,
        "status=%u requested=%llu completed_slots=%llu boundary=%llu "
        "microinstructions=%llu "
        "p0_pc=%u next_micro_pc=%u raw_word=%012llx "
        "effective_word=%012llx flags=%u\n",
        status, (unsigned long long)slots,
        (unsigned long long)info.clock_slots_completed,
        (unsigned long long)boundary.clock_slot_ordinal,
        (unsigned long long)info.microinstructions_executed,
        boundary.p0_pc, boundary.next_micro_pc,
        (unsigned long long)boundary.raw_fetched_word,
        (unsigned long long)boundary.effective_word, boundary.flags);
    cadr_machine_destroy(machine);
    return status == CADR_STATUS_OK && ordinal > slots ? 0 : 1;
}

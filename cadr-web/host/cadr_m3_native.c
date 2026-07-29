/* Native side of the M3 CDRSTATE1+CDRSTATE2 differential transcript. */
#define _POSIX_C_SOURCE 200809L
#include "cadr_boundary_state.h"
#include "cadr_host_api.h"
#include "cadr_machine.h"
#include "cadr_state_v3.h"
#include "cadr_m3_projection.h"
#include "cadr_m3_native_observer_sink.h"

#include <errno.h>
#include <stdint.h>
#include <sys/stat.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define M3_HEADER_BYTES 32U
#define M3_FOOTER_BYTES 32U
#define M3_DIGEST_BYTES (CADR_SHA256_BYTES * 3U)

static void put32le(uint8_t *out, uint32_t value)
{
    out[0] = (uint8_t)value; out[1] = (uint8_t)(value >> 8U);
    out[2] = (uint8_t)(value >> 16U); out[3] = (uint8_t)(value >> 24U);
}

static void put64le(uint8_t *out, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) out[index] = (uint8_t)(value >> (index * 8U));
}

static int load_artifact(cadr_machine *machine, uint32_t kind, const char *path)
{
    cadr_artifact_ingress ingress = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(ingress), kind, 0U
    };
    FILE *input = fopen(path, "rb");
    uint8_t *bytes = NULL;
    struct stat stat_before;
    struct stat stat_after;
    uint64_t byte_count;
    uint64_t offset;
    int ok = 0;
    if (input == NULL || stat(path, &stat_before) != 0 || stat_before.st_size < 0) goto done;
    byte_count = (uint64_t)stat_before.st_size;
    ingress.byte_count = byte_count;
    if (kind == CADR_ARTIFACT_BASE_DISK) {
        bytes = malloc(UINT32_C(1048576));
        if (bytes == NULL || cadr_machine_import_artifact_stream_begin(machine, &ingress) != CADR_STATUS_OK) goto done;
        for (offset = 0U; offset < ingress.byte_count; offset += UINT32_C(1048576)) {
            const size_t count = (size_t)((ingress.byte_count - offset) < UINT32_C(1048576)
                ? (ingress.byte_count - offset) : UINT32_C(1048576));
            if (fread(bytes, 1U, count, input) != count ||
                cadr_machine_import_artifact_stream_chunk(machine, offset, bytes, count) != CADR_STATUS_OK) goto done;
        }
        ok = cadr_machine_import_artifact_stream_finish(machine) == CADR_STATUS_OK &&
            stat(path, &stat_after) == 0 && stat_after.st_dev == stat_before.st_dev &&
            stat_after.st_ino == stat_before.st_ino && stat_after.st_size == stat_before.st_size &&
            stat_after.st_mtim.tv_sec == stat_before.st_mtim.tv_sec &&
            stat_after.st_mtim.tv_nsec == stat_before.st_mtim.tv_nsec;
        goto done;
    }
    if (byte_count > (uint64_t)SIZE_MAX) goto done;
    bytes = malloc((size_t)byte_count);
    if (bytes == NULL || fread(bytes, 1U, (size_t)byte_count, input) != (size_t)byte_count) goto done;
    ok = cadr_machine_import_artifact(machine, &ingress, bytes, ingress.byte_count) == CADR_STATUS_OK;
done:
    if (input != NULL) (void)fclose(input);
    free(bytes);
    return ok;
}

static int write_header(FILE *output, uint64_t slots)
{
    uint8_t bytes[M3_HEADER_BYTES] = { 0U };
    (void)memcpy(bytes, "CDRM3TR1", 8U);
    put32le(bytes + 8U, M3_DIGEST_BYTES);
    put64le(bytes + 12U, slots + UINT64_C(1));
    put64le(bytes + 20U, slots);
    return fwrite(bytes, 1U, sizeof(bytes), output) == sizeof(bytes);
}

static int write_boundary(FILE *output, cadr_machine *machine)
{
    uint8_t bytes[M3_DIGEST_BYTES];
    return cadr_machine_boundary_digest(machine, bytes) == CADR_STATUS_OK &&
        cadr_machine_state_v2_digest(machine, bytes + CADR_SHA256_BYTES) == CADR_STATUS_OK &&
        cadr_state_v3_digest(&machine->state, bytes + CADR_SHA256_BYTES * 2U) == CADR_STATUS_OK &&
        fwrite(bytes, 1U, sizeof(bytes), output) == sizeof(bytes);
}

static int write_footer(FILE *output, uint64_t count, cadr_status terminal_status)
{
    uint8_t bytes[M3_FOOTER_BYTES] = { 0U };
    (void)memcpy(bytes, "CDRM3END", 8U);
    put64le(bytes + 8U, count);
    put32le(bytes + 16U, terminal_status);
    return fwrite(bytes, 1U, sizeof(bytes), output) == sizeof(bytes);
}

static int write_projection_header(FILE *output, uint64_t slots)
{
    uint8_t bytes[32] = {0U};
    (void)memcpy(bytes, "CDRM3AD1", 8U);
    put32le(bytes + 8U, 1U);
    put32le(bytes + 12U, CADR_SHA256_BYTES);
    put64le(bytes + 16U, slots + UINT64_C(1));
    put64le(bytes + 24U, slots);
    return fwrite(bytes, 1U, sizeof(bytes), output) == sizeof(bytes);
}

static int write_projection_record(FILE *output, const cadr_machine *machine,
                                   uint64_t boundary)
{
    uint8_t digest[CADR_SHA256_BYTES];
    const uint32_t phase = boundary == 0U ? CADR_M3_PROJECTION_PHASE_S0 :
        (machine->state.trace.last_slot_inhibited != 0U ?
         CADR_M3_PROJECTION_PHASE_INHIBITED : CADR_M3_PROJECTION_PHASE_EXECUTED);
    return cadr_m3_projection_digest(&machine->state, boundary, phase, digest) ==
            CADR_STATUS_OK &&
        fwrite(digest, 1U, sizeof(digest), output) == sizeof(digest);
}

static int write_projection_footer(FILE *output, uint64_t count,
                                   cadr_status terminal_status)
{
    uint8_t bytes[32] = {0U};
    (void)memcpy(bytes, "CDRM3AE1", 8U);
    put64le(bytes + 8U, count);
    put32le(bytes + 16U, terminal_status);
    return fwrite(bytes, 1U, sizeof(bytes), output) == sizeof(bytes);
}

int main(int argc, char **argv)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_run_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(result),
        0U, 0U, 0U, 0U, 0U
    };
    cadr_machine *machine = NULL;
    FILE *output = NULL;
    FILE *adapter = NULL;
    FILE *bus = NULL;
    FILE *disk = NULL;
    char *end;
    uint64_t slots;
    uint64_t count = 0U;
    uint64_t ordinal;
    cadr_status status = CADR_STATUS_OK;
    int success = 0;

    if (argc != 8 && argc != 11) {
        (void)fprintf(stderr, "usage: %s CONFIG PROM PROM-SYMBOLS UCODE-SYMBOLS DISK SLOTS OUTPUT [ADAPTER BUS DISK]\\n", argv[0]);
        return 2;
    }
    errno = 0;
    slots = strtoull(argv[6], &end, 10);
    if (errno != 0 || *argv[6] == '\0' || *end != '\0' || slots == 0U || slots == UINT64_MAX) return 2;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK ||
        !load_artifact(machine, CADR_ARTIFACT_BOOT_CONFIGURATION, argv[1]) ||
        !load_artifact(machine, CADR_ARTIFACT_CONTROL_STORE, argv[2]) ||
        !load_artifact(machine, CADR_ARTIFACT_PROM_SYMBOLS, argv[3]) ||
        !load_artifact(machine, CADR_ARTIFACT_MICROCODE_SYMBOLS, argv[4]) ||
        !load_artifact(machine, CADR_ARTIFACT_BASE_DISK, argv[5]) ||
        cadr_machine_cold_power_on(machine) != CADR_STATUS_OK ||
        cadr_machine_boot(machine) != CADR_STATUS_OK) goto done;
    output = fopen(argv[7], "wb");
    if (output == NULL || !write_header(output, slots) || !write_boundary(output, machine)) goto done;
    if (argc == 11) {
        adapter = fopen(argv[8], "wb");
        bus = fopen(argv[9], "w");
        disk = fopen(argv[10], "w");
        if (adapter == NULL || bus == NULL || disk == NULL ||
            !write_projection_header(adapter, slots) ||
            !cadr_m3_native_observer_open(bus, disk, slots) ||
            !write_projection_record(adapter, machine, 0U)) goto done;
    }
    count = 1U;
    for (ordinal = 1U; ordinal <= slots; ++ordinal) {
        if (bus != NULL) cadr_m3_native_observer_slot(ordinal);
        status = cadr_machine_run(machine, &request, &result);
        if (!write_boundary(output, machine)) { status = CADR_STATUS_HOST_FAILURE; break; }
        if (adapter != NULL && !write_projection_record(adapter, machine, ordinal)) {
            status = CADR_STATUS_HOST_FAILURE; break;
        }
        count += 1U;
        if (bus != NULL && cadr_m3_native_observer_failed()) {
            status = CADR_STATUS_HOST_FAILURE; break;
        }
        if (status != CADR_STATUS_OK) break;
    }
    if ((adapter != NULL &&
         (!write_projection_footer(adapter, count, status) || fclose(adapter) != 0)) ||
        (bus != NULL && (cadr_m3_native_observer_failed() || fclose(bus) != 0)) ||
        (disk != NULL && fclose(disk) != 0) ||
        !write_footer(output, count, status) || fclose(output) != 0) {
        output = NULL; adapter = NULL; bus = NULL; disk = NULL;
        goto done;
    }
    cadr_m3_native_observer_close();
    output = NULL;
    adapter = NULL; bus = NULL; disk = NULL;
    success = status == CADR_STATUS_OK && count == slots + UINT64_C(1);
done:
    cadr_m3_native_observer_close();
    if (output != NULL) (void)fclose(output);
    if (adapter != NULL) (void)fclose(adapter);
    if (bus != NULL) (void)fclose(bus);
    if (disk != NULL) (void)fclose(disk);
    cadr_machine_destroy(machine);
    return success ? 0 : 1;
}

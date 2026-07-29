/* Native M4-D0 runner: immutable disk service between every guest boundary. */
#define _POSIX_C_SOURCE 200809L
#include "cadr_boundary_state.h"
#include "cadr_host_api.h"
#include "cadr_machine.h"
#include "cadr_m4_block_service.h"
#include "cadr_m3_native_observer_sink.h"
#include "cadr_m3_projection.h"
#include "cadr_state_v3.h"

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

static int read_file(const char *path, uint8_t **out_bytes, uint64_t *out_count)
{
    struct stat metadata;
    FILE *stream = NULL;
    uint8_t *bytes = NULL;
    size_t count;
    if (path == NULL || out_bytes == NULL || out_count == NULL || stat(path, &metadata) != 0 ||
        metadata.st_size <= 0 || (uintmax_t)metadata.st_size > SIZE_MAX) return 0;
    count = (size_t)metadata.st_size;
    stream = fopen(path, "rb");
    if (stream == NULL) return 0;
    bytes = malloc(count);
    if (bytes == NULL || fread(bytes, 1U, count, stream) != count) {
        (void)fclose(stream);
        free(bytes);
        return 0;
    }
    if (fclose(stream) != 0) { free(bytes); return 0; }
    *out_bytes = bytes;
    *out_count = count;
    return 1;
}

static int import_artifact(cadr_machine *machine, uint32_t kind,
                           const uint8_t *bytes, uint64_t count)
{
    cadr_artifact_ingress ingress = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(cadr_artifact_ingress), kind, count
    };
    uint64_t offset;
    if (kind != CADR_ARTIFACT_BASE_DISK) {
        return cadr_machine_import_artifact(machine, &ingress, bytes, count) == CADR_STATUS_OK;
    }
    if (cadr_machine_import_artifact_stream_begin(machine, &ingress) != CADR_STATUS_OK) return 0;
    for (offset = 0U; offset < count; offset += UINT32_C(1048576)) {
        const uint64_t remaining = count - offset;
        const uint32_t chunk = remaining < UINT32_C(1048576) ? (uint32_t)remaining : UINT32_C(1048576);
        if (cadr_machine_import_artifact_stream_chunk(machine, offset, bytes + offset, chunk) != CADR_STATUS_OK) {
            return 0;
        }
    }
    return cadr_machine_import_artifact_stream_finish(machine) == CADR_STATUS_OK;
}

static void hex(const uint8_t bytes[CADR_SHA256_BYTES], char output[65])
{
    static const char digits[] = "0123456789abcdef";
    uint32_t index;
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        output[index * 2U] = digits[bytes[index] >> 4U];
        output[index * 2U + 1U] = digits[bytes[index] & UINT8_C(15)];
    }
    output[64] = '\0';
}

static int write_boundary(FILE *output, uint64_t ordinal, cadr_machine *machine,
                          const cadr_m4_block_service_event *events,
                          uint64_t event_count)
{
    uint8_t state1[CADR_SHA256_BYTES];
    uint8_t state2[CADR_SHA256_BYTES];
    uint8_t state3[CADR_SHA256_BYTES];
    char first[65];
    char second[65];
    char third[65];
    const uint32_t interrupt = (machine->state.devices.disk.status & CADR_DISK_STATUS_INTERRUPT) != 0U ? 1U : 0U;
    if (cadr_machine_boundary_digest(machine, state1) != CADR_STATUS_OK ||
        cadr_machine_state_v2_digest(machine, state2) != CADR_STATUS_OK ||
        cadr_state_v3_digest(&machine->state, state3) != CADR_STATUS_OK) return 0;
    hex(state1, first); hex(state2, second); hex(state3, third);
    if (fprintf(output, "S %llu %s %s %s ", (unsigned long long)ordinal,
                first, second, third) < 0) return 0;
    if (event_count == 0U && fputc('-', output) == EOF) return 0;
    for (uint64_t index = 0U; index < event_count; ++index) {
        const cadr_m4_block_service_event *event = &events[index];
        int separator = index != 0U ? 1 : 0;
        if (event->request_seen != 0U && fprintf(output,
            "%sI,%llu,%llu,%llu,%llu,%llu,%u,%u,%llu", separator != 0 ? ";" : "",
            (unsigned long long)event->issue_tick, (unsigned long long)event->due_tick,
            (unsigned long long)event->generation, (unsigned long long)event->request_id,
            (unsigned long long)event->first_block, event->block_count, event->block_bytes,
            (unsigned long long)event->completion_byte_count) < 0) return 0;
        if (event->request_seen != 0U) separator = 1;
        if (event->completion_delivered != 0U && fprintf(output, "%sC,%llu,%u",
            separator != 0 ? ";" : "", (unsigned long long)event->delivery_tick,
            event->host_status) < 0) return 0;
    }
    return fprintf(output, ";Q,%u\n", interrupt) >= 0;
}

static int append_service_event(cadr_m4_block_service_event **events,
                                uint64_t *count, uint64_t *capacity,
                                const cadr_m4_block_service_event *event)
{
    cadr_m4_block_service_event *grown;
    uint64_t next_capacity;
    if (event->request_seen == 0U && event->completion_delivered == 0U) return 1;
    if (*count == *capacity) {
        if (*capacity > UINT64_MAX / 2U ||
            *capacity * 2U > (uint64_t)SIZE_MAX / sizeof(**events)) return 0;
        next_capacity = *capacity == 0U ? 4U : *capacity * 2U;
        grown = realloc(*events, (size_t)next_capacity * sizeof(*grown));
        if (grown == NULL) return 0;
        *events = grown;
        *capacity = next_capacity;
    }
    (*events)[*count] = *event;
    *count += 1U;
    return 1;
}

static int write_projection_header(FILE *output, uint64_t slots)
{
    uint8_t bytes[32] = {0}; uint32_t index;
    (void)memcpy(bytes, "CDRM3AD1", 8U);
    bytes[8] = 1U; bytes[12] = CADR_SHA256_BYTES;
    for (index = 0U; index < 8U; ++index) {
        bytes[16U + index] = (uint8_t)((slots + 1U) >> (index * 8U));
        bytes[24U + index] = (uint8_t)(slots >> (index * 8U));
    }
    return fwrite(bytes, 1U, sizeof(bytes), output) == sizeof(bytes);
}

static int write_projection_record(FILE *output, cadr_machine *machine,
                                   uint64_t boundary)
{
    uint8_t digest[CADR_SHA256_BYTES]; uint32_t phase;
    if (boundary == 0U) phase = CADR_M3_PROJECTION_PHASE_S0;
    else phase = machine->state.trace.last_slot_inhibited != 0U
        ? CADR_M3_PROJECTION_PHASE_INHIBITED : CADR_M3_PROJECTION_PHASE_EXECUTED;
    return cadr_m3_projection_digest(&machine->state, boundary, phase, digest) == CADR_STATUS_OK &&
        fwrite(digest, 1U, sizeof(digest), output) == sizeof(digest);
}

static int write_projection_footer(FILE *output, uint64_t count, cadr_status status)
{
    uint8_t bytes[32] = {0}; uint32_t index;
    (void)memcpy(bytes, "CDRM3AE1", 8U);
    for (index = 0U; index < 8U; ++index) bytes[8U + index] = (uint8_t)(count >> (index * 8U));
    for (index = 0U; index < 4U; ++index) bytes[16U + index] = (uint8_t)(status >> (index * 8U));
    return fwrite(bytes, 1U, sizeof(bytes), output) == sizeof(bytes);
}

int main(int argc, char **argv)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(cadr_machine_config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(cadr_run_request), 0U, 1U
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(cadr_run_result), 0U, 0U, 0U, 0U, 0U
    };
    const uint32_t kinds[5] = { 1U, 2U, 4U, 5U, 3U };
    uint8_t *artifacts[5] = { NULL, NULL, NULL, NULL, NULL };
    uint64_t counts[5] = { 0U, 0U, 0U, 0U, 0U };
    cadr_machine *machine = NULL;
    cadr_m4_block_service service;
    cadr_m4_block_service_config service_config;
    cadr_m4_block_service_event event;
    cadr_m4_block_service_event *events = NULL;
    uint64_t event_count = 0U;
    uint64_t event_capacity = 0U;
    FILE *output = NULL;
    FILE *adapter = NULL;
    FILE *bus = NULL;
    FILE *disk = NULL;
    char *end;
    uint64_t slots;
    uint64_t ordinal;
    cadr_status status = CADR_STATUS_OK;
    int success = 0;
    uint32_t index;

    if (argc != 8 && argc != 11) return 2;
    errno = 0;
    slots = strtoull(argv[6], &end, 10);
    if (errno != 0 || *argv[6] == '\0' || *end != '\0' || slots == 0U || slots == UINT64_MAX) return 2;
    for (index = 0U; index < 5U; ++index) {
        if (!read_file(argv[index + 1U], &artifacts[index], &counts[index])) goto done;
    }
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK) goto done;
    for (index = 0U; index < 5U; ++index) {
        if (!import_artifact(machine, kinds[index], artifacts[index], counts[index])) goto done;
    }
    service_config.image_bytes = artifacts[4];
    service_config.image_byte_count = counts[4];
    service_config.expected_image_byte_count = counts[4];
    service_config.latency_ticks = 0U;
    service_config.block_bytes = CADR_M4_BLOCK_SERVICE_BLOCK_BYTES;
    service_config.fault_mask = CADR_M4_BLOCK_FAULT_NONE;
    if (cadr_m4_block_service_init(&service, &service_config) != CADR_STATUS_OK ||
        cadr_machine_cold_power_on(machine) != CADR_STATUS_OK ||
        cadr_machine_boot(machine) != CADR_STATUS_OK) goto done;
    output = fopen(argv[7], "w");
    if (output == NULL || fputs("CDRM4TX1\n", output) == EOF) goto done;
    if (argc == 11) {
        adapter = fopen(argv[8], "wb"); bus = fopen(argv[9], "w"); disk = fopen(argv[10], "w");
        if (adapter == NULL || bus == NULL || disk == NULL ||
            !write_projection_header(adapter, slots) ||
            !cadr_m3_native_observer_open(bus, disk, slots)) goto done;
    }
    (void)memset(&event, 0, sizeof(event));
    if (!write_boundary(output, 0U, machine, NULL, 0U)) goto done;
    if (adapter != NULL && !write_projection_record(adapter, machine, 0U)) goto done;
    for (ordinal = 1U; ordinal <= slots; ++ordinal) {
        /* A completion is queued between guest slots.  The following call may
         * apply it and report OK with zero completed slots; consume that host
         * transition internally rather than emitting a fabricated boundary. */
        event_count = 0U;
        if (bus != NULL) cadr_m3_native_observer_slot(ordinal);
        for (;;) {
            status = cadr_machine_run(machine, &run, &result);
            (void)memset(&event, 0, sizeof(event));
            if (status == CADR_STATUS_OK || status == CADR_STATUS_WAITING_FOR_HOST) {
                const cadr_status poll = cadr_m4_block_service_poll(
                    &service, machine, machine->state.clock_slots_completed, &event);
                if (poll != CADR_STATUS_OK) { status = poll; break; }
                if (!append_service_event(&events, &event_count, &event_capacity, &event)) {
                    status = CADR_STATUS_NO_MEMORY; break;
                }
                if (status == CADR_STATUS_WAITING_FOR_HOST && event.completion_delivered != 0U) {
                    status = CADR_STATUS_OK;
                }
            }
            if (result.clock_slots_completed != 0U || status != CADR_STATUS_OK) break;
        }
        if (result.clock_slots_completed == 0U) break;
        if (!write_boundary(output, ordinal, machine, events, event_count)) { status = CADR_STATUS_HOST_FAILURE; break; }
        if (adapter != NULL && !write_projection_record(adapter, machine, ordinal)) { status = CADR_STATUS_HOST_FAILURE; break; }
        if (bus != NULL && cadr_m3_native_observer_failed()) { status = CADR_STATUS_HOST_FAILURE; break; }
        if (status != CADR_STATUS_OK) break;
    }
    if ((bus != NULL && cadr_m3_native_observer_failed()) ||
        (adapter != NULL && (!write_projection_footer(adapter, ordinal, status) || fclose(adapter) != 0)) ||
        (bus != NULL && fclose(bus) != 0) || (disk != NULL && fclose(disk) != 0) || fclose(output) != 0) { output = NULL; adapter = NULL; bus = NULL; disk = NULL; goto done; }
    if (bus != NULL) cadr_m3_native_observer_close();
    output = NULL;
    adapter = NULL; bus = NULL; disk = NULL;
    success = status == CADR_STATUS_OK && ordinal > slots;
done:
    cadr_m3_native_observer_close();
    if (output != NULL) (void)fclose(output);
    if (adapter != NULL) (void)fclose(adapter);
    if (bus != NULL) (void)fclose(bus);
    if (disk != NULL) (void)fclose(disk);
    free(events);
    for (index = 0U; index < 5U; ++index) free(artifacts[index]);
    cadr_machine_destroy(machine);
    return success ? 0 : 1;
}

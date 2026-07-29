/* Native M4-D0 runner: immutable disk service between every guest boundary. */
#define _POSIX_C_SOURCE 200809L
#include "cadr_boundary_state.h"
#include "cadr_host_api.h"
#include "cadr_machine.h"
#include "cadr_m4_block_service.h"
#include "cadr_m4_file_range_reader.h"
#include "cadr_m4_controller_transcript.h"
#include "cadr_m4_media.h"
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

static int write_file(const char *path, const uint8_t *bytes,
                      uint64_t byte_count)
{
    FILE *stream;
    int ok;
    if (path == NULL || bytes == NULL || byte_count > (uint64_t)SIZE_MAX) {
        return 0;
    }
    stream = fopen(path, "wb");
    if (stream == NULL) return 0;
    ok = fwrite(bytes, 1U, (size_t)byte_count, stream) ==
        (size_t)byte_count;
    if (fclose(stream) != 0) ok = 0;
    return ok;
}

static void controller_transcript_config(
    cadr_m4_controller_transcript_config *config)
{
    static const uint8_t profile[CADR_SHA256_BYTES] = {
        0x1bU,0x8dU,0x63U,0xdbU,0x98U,0xacU,0xd4U,0x6eU,
        0x40U,0xadU,0xf9U,0x9aU,0x8aU,0x3cU,0xebU,0x5eU,
        0x05U,0x58U,0xd4U,0xacU,0x02U,0x7cU,0xb2U,0xcbU,
        0x4aU,0x43U,0x96U,0x65U,0xb1U,0x4bU,0x5dU,0x2aU
    };
    static const uint8_t artifacts[CADR_SHA256_BYTES] = {
        0xe9U,0x6eU,0x6fU,0xf9U,0x03U,0xc2U,0x3cU,0xceU,
        0xa7U,0x07U,0xecU,0xe0U,0xe9U,0xa8U,0x72U,0xa8U,
        0xa7U,0x77U,0x71U,0xa6U,0x66U,0x3eU,0x3bU,0x91U,
        0x9eU,0xabU,0xa2U,0x1eU,0x22U,0xf2U,0xf9U,0x41U
    };
    (void)memset(config, 0, sizeof(*config));
    (void)memcpy(config->profile_sha256, profile, sizeof(profile));
    (void)memcpy(config->artifact_set_sha256, artifacts, sizeof(artifacts));
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

static int import_disk(cadr_machine *machine,
                       cadr_m4_file_range_reader *reader)
{
    cadr_artifact_ingress ingress = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M3,
        (uint32_t)sizeof(cadr_artifact_ingress),
        CADR_ARTIFACT_BASE_DISK, reader->byte_count
    };
    uint8_t *chunk = NULL;
    uint64_t offset;
    int success = 0;
    if (cadr_machine_import_artifact_stream_begin(machine, &ingress) !=
        CADR_STATUS_OK) {
        return 0;
    }
    chunk = malloc(UINT32_C(1048576));
    if (chunk == NULL) goto done;
    for (offset = 0U; offset < reader->byte_count;
         offset += UINT32_C(1048576)) {
        const uint64_t remaining = reader->byte_count - offset;
        const uint32_t count = remaining < UINT32_C(1048576)
            ? (uint32_t)remaining : UINT32_C(1048576);
        if (cadr_m4_file_range_reader_read(reader, offset, chunk, count) !=
                CADR_STATUS_OK ||
            cadr_machine_import_artifact_stream_chunk(machine, offset, chunk,
                                                      count) != CADR_STATUS_OK) {
            goto done;
        }
    }
    success = cadr_machine_import_artifact_stream_finish(machine) ==
        CADR_STATUS_OK;
done:
    free(chunk);
    if (success == 0) (void)cadr_machine_import_artifact_stream_abort(machine);
    return success;
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

static int append_media_turn(cadr_m4_media_turn **turns, uint64_t *count,
                             uint64_t *capacity,
                             const cadr_m4_media_turn *turn)
{
    cadr_m4_media_turn *grown;
    uint64_t next_capacity;
    if (*count == *capacity) {
        if (*capacity > UINT64_MAX / 2U ||
            *capacity * 2U >
                (uint64_t)SIZE_MAX / sizeof(**turns)) {
            return 0;
        }
        next_capacity = *capacity == 0U ? 16U : *capacity * 2U;
        grown = realloc(*turns, (size_t)next_capacity * sizeof(*grown));
        if (grown == NULL) return 0;
        *turns = grown;
        *capacity = next_capacity;
    }
    (*turns)[*count] = *turn;
    *count += 1U;
    return 1;
}

static void request_media_turn(
    cadr_m4_media_turn *turn, const cadr_m4_block_service_event *event,
    uint32_t actor, uint64_t ordinal, uint64_t overlay_generation,
    const uint8_t overlay_root[CADR_SHA256_BYTES])
{
    (void)memset(turn, 0, sizeof(*turn));
    turn->ordinal = ordinal;
    turn->actor = actor;
    turn->operation = event->operation;
    turn->actor_status = CADR_STATUS_OK;
    turn->guest_tick = event->issue_tick;
    turn->generation = event->generation;
    turn->request_id = event->request_id;
    turn->descriptor_byte_count = event->descriptor_byte_count;
    turn->request_payload_byte_count =
        event->request_payload_byte_count;
    turn->expected_completion_byte_count =
        event->completion_byte_count;
    (void)memcpy(turn->descriptor, event->descriptor,
                 sizeof(turn->descriptor));
    (void)memcpy(turn->descriptor_sha256, event->descriptor_sha256,
                 CADR_SHA256_BYTES);
    (void)memcpy(turn->request_payload_sha256,
                 event->request_payload_sha256, CADR_SHA256_BYTES);
    if (event->operation == CADR_HOST_OPERATION_BLOCK_WRITE) {
        (void)memcpy(turn->page_sha256, event->page_sha256,
                     CADR_SHA256_BYTES);
    } else {
        cadr_m4_media_sha256(NULL, 0U, turn->page_sha256);
    }
    turn->overlay_generation = overlay_generation;
    (void)memcpy(turn->overlay_root_sha256, overlay_root,
                 CADR_SHA256_BYTES);
}

static int append_media_service_event(
    const cadr_m4_media_header *header,
    cadr_m4_media_turn **turns, uint64_t *count, uint64_t *capacity,
    const cadr_m4_block_service_event *event,
    uint64_t *overlay_generation,
    uint8_t overlay_root[CADR_SHA256_BYTES],
    cadr_m4_media_turn *pending_apply, uint32_t *apply_pending)
{
    cadr_m4_media_turn turn;
    if (event->request_seen != 0U) {
        request_media_turn(&turn, event, CADR_M4_MEDIA_ACTOR_ISSUE,
                           *count, *overlay_generation, overlay_root);
        if (!append_media_turn(turns, count, capacity, &turn)) return 0;
        turn.actor = CADR_M4_MEDIA_ACTOR_CAPTURE;
        turn.ordinal = *count;
        if (!append_media_turn(turns, count, capacity, &turn)) return 0;
    }
    if (event->completion_delivered != 0U) {
        request_media_turn(&turn, event, CADR_M4_MEDIA_ACTOR_DELIVERY,
                           *count, *overlay_generation, overlay_root);
        turn.guest_tick = event->delivery_tick;
        turn.actor_status = event->host_status;
        turn.delivered_completion_byte_count =
            event->completion_byte_count;
        (void)memcpy(turn.page_sha256, event->page_sha256,
                     CADR_SHA256_BYTES);
        if (event->host_status == CADR_HOST_RESULT_FAILED) {
            turn.disposition = CADR_M4_MEDIA_DISPOSITION_ABORT;
        } else if (event->operation == CADR_HOST_OPERATION_BLOCK_WRITE) {
            if (event->overlay_committed == 0U ||
                *overlay_generation == UINT64_MAX) {
                return 0;
            }
            turn.disposition = CADR_M4_MEDIA_DISPOSITION_COMMIT;
            turn.overlay_generation = *overlay_generation + 1U;
        }
        if (!append_media_turn(turns, count, capacity, &turn)) return 0;
        if (turn.disposition == CADR_M4_MEDIA_DISPOSITION_COMMIT) {
            if (cadr_m4_media_overlay_root(
                    header, *turns, *count, overlay_root) !=
                CADR_STATUS_OK) {
                return 0;
            }
            *overlay_generation += 1U;
            (*turns)[*count - 1U].overlay_generation =
                *overlay_generation;
            (void)memcpy((*turns)[*count - 1U].overlay_root_sha256,
                         overlay_root, CADR_SHA256_BYTES);
        }
        *pending_apply = (*turns)[*count - 1U];
        *apply_pending = 1U;
    }
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
    cadr_m4_media_header media_header;
    cadr_m4_controller_transcript_config controller_config;
    cadr_m4_media_turn *media_turns = NULL;
    cadr_m4_media_turn pending_apply;
    uint64_t media_turn_count = 0U;
    uint64_t media_turn_capacity = 0U;
    uint64_t overlay_generation = 0U;
    uint8_t overlay_root[CADR_SHA256_BYTES];
    uint32_t apply_pending = 0U;
    uint32_t terminal_reached = 0U;
    uint8_t *media_bytes = NULL;
    uint64_t media_byte_count = 0U;
    uint64_t media_written = 0U;
    uint8_t *evidence_bytes = NULL;
    uint64_t evidence_byte_count = 0U;
    uint64_t evidence_written = 0U;
    FILE *output = NULL;
    FILE *adapter = NULL;
    FILE *bus = NULL;
    FILE *disk = NULL;
    char *end;
    uint64_t slots;
    uint64_t ordinal;
    cadr_status status = CADR_STATUS_OK;
    int success = 0;
    int semantic_only = 0;
    uint32_t index;
    cadr_m4_file_range_reader range_reader = { -1, 0U };
    struct stat disk_metadata;

    if (argc != 10 && argc != 13) return 2;
    errno = 0;
    slots = strtoull(argv[6], &end, 10);
    if (errno != 0 || *argv[6] == '\0' || *end != '\0' || slots == 0U || slots == UINT64_MAX) return 2;
    for (index = 0U; index < 4U; ++index) {
        if (!read_file(argv[index + 1U], &artifacts[index], &counts[index])) goto done;
    }
    if (stat(argv[5], &disk_metadata) != 0 || disk_metadata.st_size <= 0 ||
        cadr_m4_file_range_reader_open(
            &range_reader, argv[5], (uint64_t)disk_metadata.st_size) !=
            CADR_STATUS_OK) {
        goto done;
    }
    counts[4] = (uint64_t)disk_metadata.st_size;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK) goto done;
    for (index = 0U; index < 4U; ++index) {
        if (!import_artifact(machine, kinds[index], artifacts[index], counts[index])) goto done;
    }
    if (!import_disk(machine, &range_reader)) goto done;
    (void)memset(&service_config, 0, sizeof(service_config));
    service_config.read_range = cadr_m4_file_range_reader_read;
    service_config.read_context = &range_reader;
    service_config.image_byte_count = counts[4];
    service_config.expected_image_byte_count = counts[4];
    service_config.latency_ticks = 0U;
    service_config.block_bytes = CADR_M4_BLOCK_SERVICE_BLOCK_BYTES;
    service_config.fault_mask = CADR_M4_BLOCK_FAULT_NONE;
    service_config.fault_first_block = UINT64_MAX;
    if (cadr_m4_block_service_init(&service, &service_config) != CADR_STATUS_OK ||
        cadr_machine_cold_power_on(machine) != CADR_STATUS_OK ||
        cadr_machine_boot(machine) != CADR_STATUS_OK) goto done;
    semantic_only = strcmp(argv[7], "-") == 0;
    if (semantic_only == 0) {
        output = fopen(argv[7], "w");
        if (output == NULL || fputs("CDRM4TX1\n", output) == EOF) goto done;
    }
    cadr_m4_media_selected_base(&media_header);
    if (cadr_m4_media_overlay_root(
            &media_header, NULL, 0U, overlay_root) != CADR_STATUS_OK) {
        goto done;
    }
    if (argc == 13) {
        adapter = fopen(argv[10], "wb"); bus = fopen(argv[11], "w");
        disk = fopen(argv[12], "w");
        if (adapter == NULL || bus == NULL || disk == NULL ||
            !write_projection_header(adapter, slots) ||
            !cadr_m3_native_observer_open(bus, disk, slots)) goto done;
    }
    (void)memset(&event, 0, sizeof(event));
    if (semantic_only == 0 &&
        !write_boundary(output, 0U, machine, NULL, 0U)) {
        goto done;
    }
    if (adapter != NULL && !write_projection_record(adapter, machine, 0U)) goto done;
    for (ordinal = 1U; ordinal <= slots; ++ordinal) {
        uint32_t guest_slot_completed = 0U;
        uint32_t completion_requires_application = 0U;
        /*
         * A published boundary is quiescent.  Execute at most one guest slot,
         * service any request it issues, and consume the zero-slot completion
         * application before serializing state.  This keeps payload-bearing
         * request state out of the frozen CDRSTATE1/2/3 projections while
         * retaining every host actor turn in the media transcript.
         */
        event_count = 0U;
        if (bus != NULL) cadr_m3_native_observer_slot(ordinal);
        for (;;) {
            status = cadr_machine_run(machine, &run, &result);
            if (result.clock_slots_completed != 0U) {
                if (guest_slot_completed != 0U ||
                    result.clock_slots_completed != 1U) {
                    status = CADR_STATUS_HOST_FAILURE;
                    break;
                }
                guest_slot_completed = 1U;
            }
            if (completion_requires_application != 0U) {
                if (result.clock_slots_completed != 0U) {
                    status = CADR_STATUS_HOST_FAILURE;
                    break;
                }
                if (apply_pending == 0U || status != CADR_STATUS_OK) {
                    status = CADR_STATUS_HOST_FAILURE;
                    break;
                }
                pending_apply.actor = CADR_M4_MEDIA_ACTOR_APPLY;
                pending_apply.ordinal = media_turn_count;
                pending_apply.actor_status = CADR_STATUS_OK;
                pending_apply.guest_tick =
                    machine->state.clock_slots_completed;
                if (!append_media_turn(
                        &media_turns, &media_turn_count,
                        &media_turn_capacity, &pending_apply)) {
                    status = CADR_STATUS_NO_MEMORY;
                    break;
                }
                apply_pending = 0U;
                completion_requires_application = 0U;
            }
            (void)memset(&event, 0, sizeof(event));
            if (status == CADR_STATUS_OK || status == CADR_STATUS_WAITING_FOR_HOST) {
                const cadr_status poll = cadr_m4_block_service_poll(
                    &service, machine, machine->state.clock_slots_completed, &event);
                if (poll != CADR_STATUS_OK) { status = poll; break; }
                if (!append_service_event(&events, &event_count, &event_capacity, &event)) {
                    status = CADR_STATUS_NO_MEMORY; break;
                }
                if (!append_media_service_event(
                        &media_header, &media_turns, &media_turn_count,
                        &media_turn_capacity, &event, &overlay_generation,
                        overlay_root, &pending_apply, &apply_pending)) {
                    status = CADR_STATUS_HOST_FAILURE;
                    break;
                }
                if (event.completion_delivered != 0U) {
                    completion_requires_application = 1U;
                }
                if (status == CADR_STATUS_WAITING_FOR_HOST &&
                    event.completion_delivered != 0U) {
                    status = CADR_STATUS_OK;
                }
            }
            if (status != CADR_STATUS_OK) break;
            if (guest_slot_completed != 0U &&
                completion_requires_application == 0U &&
                service.pending == 0U) {
                break;
            }
        }
        if (guest_slot_completed == 0U) break;
        if (semantic_only == 0 &&
            !write_boundary(output, ordinal, machine, events, event_count)) {
            status = CADR_STATUS_HOST_FAILURE;
            break;
        }
        if (ordinal == UINT64_C(1029996) &&
            (machine->state.cpu.p0_pc != UINT32_C(0355) ||
             machine->state.cpu.p1_pc != UINT32_C(0356) ||
             machine->state.cpu.next_micro_pc != UINT32_C(0357) ||
             machine->state.events.outstanding_request_id != 0U)) {
            status = CADR_STATUS_PROFILE_MISMATCH;
            break;
        } else if (ordinal == UINT64_C(1029996)) {
            terminal_reached = 1U;
        }
        if (adapter != NULL && !write_projection_record(adapter, machine, ordinal)) { status = CADR_STATUS_HOST_FAILURE; break; }
        if (bus != NULL && cadr_m3_native_observer_failed()) { status = CADR_STATUS_HOST_FAILURE; break; }
        if (status != CADR_STATUS_OK) break;
    }
    if (status == CADR_STATUS_OK && ordinal > slots &&
        apply_pending == 0U) {
        cadr_m4_media_turn stable;
        if (cadr_m4_media_build_stable_turn(
                &machine->state, media_turn_count,
                machine->state.clock_slots_completed,
                overlay_generation, overlay_root, &stable) !=
                CADR_STATUS_OK ||
            !append_media_turn(
                &media_turns, &media_turn_count, &media_turn_capacity,
                &stable) ||
            cadr_m4_media_serialized_size(
                media_turn_count, &media_byte_count) != CADR_STATUS_OK ||
            media_byte_count > (uint64_t)SIZE_MAX) {
            status = CADR_STATUS_HOST_FAILURE;
        } else {
            media_bytes = malloc((size_t)media_byte_count);
            if (media_bytes == NULL ||
                cadr_m4_media_serialize(
                    &media_header, media_turns, media_turn_count,
                    media_bytes, media_byte_count, &media_written) !=
                    CADR_STATUS_OK ||
                media_written != media_byte_count) {
                status = CADR_STATUS_HOST_FAILURE;
            } else {
                if (!write_file(argv[8], media_bytes, media_byte_count)) {
                    status = CADR_STATUS_HOST_FAILURE;
                }
            }
        }
    }
    controller_transcript_config(&controller_config);
    controller_config.terminal_reached = terminal_reached;
    controller_config.terminal_boundary = UINT64_C(1029996);
    controller_config.p0_pc = UINT64_C(0355);
    controller_config.p1_pc = UINT64_C(0356);
    controller_config.next_micro_pc = UINT64_C(0357);
    if (status == CADR_STATUS_OK &&
        cadr_m4_controller_transcript_size(
            &machine->state.disk_evidence, &evidence_byte_count) ==
            CADR_STATUS_OK &&
        evidence_byte_count <= (uint64_t)SIZE_MAX) {
        evidence_bytes = malloc((size_t)evidence_byte_count);
        if (evidence_bytes == NULL ||
            cadr_m4_controller_transcript_serialize(
                &controller_config, &machine->state,
                &machine->state.disk_evidence, evidence_bytes,
                evidence_byte_count, &evidence_written) != CADR_STATUS_OK ||
            evidence_written != evidence_byte_count) {
            status = CADR_STATUS_HOST_FAILURE;
        } else {
            if (!write_file(argv[9], evidence_bytes,
                            evidence_byte_count)) {
                status = CADR_STATUS_HOST_FAILURE;
            }
        }
    } else if (status == CADR_STATUS_OK) {
        status = CADR_STATUS_HOST_FAILURE;
    }
    if ((bus != NULL && cadr_m3_native_observer_failed()) ||
        (adapter != NULL && (!write_projection_footer(adapter, ordinal, status) || fclose(adapter) != 0)) ||
        (bus != NULL && fclose(bus) != 0) ||
        (disk != NULL && fclose(disk) != 0) ||
        (output != NULL && fclose(output) != 0)) {
        output = NULL; adapter = NULL; bus = NULL; disk = NULL; goto done;
    }
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
    free(media_turns);
    free(media_bytes);
    free(evidence_bytes);
    for (index = 0U; index < 5U; ++index) free(artifacts[index]);
    cadr_m4_file_range_reader_close(&range_reader);
    cadr_machine_destroy(machine);
    return success ? 0 : 1;
}

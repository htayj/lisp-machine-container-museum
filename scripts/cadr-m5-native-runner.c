/* Private C-M5 source-oracle producer; compiled only with CADR_M5_ORACLE_TEST. */
#define _POSIX_C_SOURCE 200809L
#include "cadr_host_api.h"
#include "cadr_boundary_state.h"
#include "cadr_machine.h"
#include "cadr_m4_media.h"
#include "cadr_state_v4.h"
#include "cadr_state_v3.h"
#include "cadr_state_v2.h"
#include "cadr_state_v5.h"
#include "cadr_bus_device.h"

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#define DUE UINT64_C(500000)
#define LAST UINT64_C(565536)

static void hex(const uint8_t digest[CADR_SHA256_BYTES], char out[65])
{
    static const char digits[] = "0123456789abcdef";
    uint32_t index;
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        out[index * 2U] = digits[digest[index] >> 4U];
        out[index * 2U + 1U] = digits[digest[index] & 15U];
    }
    out[64] = '\0';
}

static int load(cadr_machine *machine, uint32_t kind, const char *path)
{
    cadr_artifact_ingress ingress = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M5,
        (uint32_t)sizeof(ingress), kind, 0U };
    FILE *stream = NULL;
    uint8_t *bytes = NULL;
    struct stat before, after;
    uint64_t offset;
    int ok = 0;
    stream = fopen(path, "rb");
    if (stream == NULL || fstat(fileno(stream), &before) != 0 || before.st_size < 0) goto done;
    ingress.byte_count = (uint64_t)before.st_size;
    if (kind == CADR_ARTIFACT_BASE_DISK) {
        bytes = malloc(UINT32_C(1048576));
        if (bytes == NULL || cadr_machine_import_artifact_stream_begin(machine, &ingress) != CADR_STATUS_OK) goto done;
        for (offset = 0U; offset < ingress.byte_count; offset += UINT32_C(1048576)) {
            size_t count = (size_t)((ingress.byte_count - offset) < UINT32_C(1048576) ?
                (ingress.byte_count - offset) : UINT32_C(1048576));
            if (fread(bytes, 1U, count, stream) != count ||
                cadr_machine_import_artifact_stream_chunk(machine, offset, bytes, count) != CADR_STATUS_OK) goto done;
        }
        ok = cadr_machine_import_artifact_stream_finish(machine) == CADR_STATUS_OK &&
            stat(path, &after) == 0 && before.st_dev == after.st_dev &&
            before.st_ino == after.st_ino && before.st_size == after.st_size &&
            before.st_mtim.tv_sec == after.st_mtim.tv_sec && before.st_mtim.tv_nsec == after.st_mtim.tv_nsec;
        goto done;
    }
    if (ingress.byte_count > (uint64_t)SIZE_MAX) goto done;
    bytes = malloc((size_t)ingress.byte_count);
    if (bytes == NULL || fread(bytes, 1U, (size_t)ingress.byte_count, stream) != (size_t)ingress.byte_count) goto done;
    ok = cadr_machine_import_artifact(machine, &ingress, bytes, ingress.byte_count) == CADR_STATUS_OK;
done:
    if (stream != NULL) (void)fclose(stream);
    free(bytes);
    return ok;
}

static int run(cadr_machine *machine, uint64_t slots)
{
    cadr_run_request request = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M5,
        (uint32_t)sizeof(request), 0U, 1U };
    cadr_run_result result = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M5,
        (uint32_t)sizeof(result), 0U, 0U, 0U, 0U, 0U };
    while (slots-- != 0U) {
        cadr_status status = cadr_machine_run(machine, &request, &result);
        if (status != CADR_STATUS_OK || result.clock_slots_completed != 1U) {
            (void)fprintf(stderr, "C-M5 native run status=%u completed=%llu\n", (unsigned)status,
                          (unsigned long long)result.clock_slots_completed);
            return 0;
        }
    }
    return 1;
}

static int schedule_probe(cadr_machine *machine)
{
    cadr_scheduler_event events[3];
    uint32_t index;
    (void)memset(events, 0, sizeof(events));
    for (index = 0U; index < 3U; ++index) {
        events[index].abi_major = CADR_ABI_MAJOR; events[index].abi_minor = CADR_ABI_MINOR_M5;
        events[index].struct_size = (uint32_t)sizeof(events[index]);
        events[index].due_tick = DUE; events[index].generation = machine->state.events.generation;
    }
    events[0].kind = CADR_SCHED_EVENT_CLOCK; events[0].value = 1U;
    events[1].kind = CADR_SCHED_EVENT_KEYBOARD; events[1].value = 1U;
    events[2].kind = CADR_SCHED_EVENT_SEQUENCE_BREAK;
    if (cadr_machine_schedule_events(machine, events, 3U) != CADR_STATUS_OK) {
        (void)fprintf(stderr, "C-M5 native scheduler ingress rejected\n");
        return 0;
    }
    cadr_m5_oracle_latch_disk_result(&machine->state);
    return 1;
}

static int emit(FILE *output, cadr_machine *machine, uint64_t boundary,
                const uint8_t transcript_sha[CADR_SHA256_BYTES])
{
    uint8_t state[CADR_SHA256_BYTES];
    char state_hex[65], transcript_hex[65];
    uint32_t sb = (machine->state.cpu.interrupt_control & (UINT32_C(1) << 26U)) != 0U;
    uint32_t external = machine->state.bus.interrupt_pending != 0U;
    {
        cadr_status v2_status = cadr_machine_state_v2_digest(machine, state);
        if (v2_status != CADR_STATUS_OK) {
            (void)fprintf(stderr, "C-M5 CDRSTATE2 cache warmup status=%u at S%llu\n",
                          (unsigned)v2_status, (unsigned long long)boundary);
            return 0;
        }
        cadr_status status = cadr_state_v5_digest(&machine->state, state);
        if (status != CADR_STATUS_OK) {
            (void)fprintf(stderr, "C-M5 CDRSTATE5 status=%u at S%llu\n", (unsigned)status,
                          (unsigned long long)boundary);
            (void)fprintf(stderr, "scheduler count=%u phase=%u iob queue=%u usec-phase=%u transcript count=%u total=%llu capture=%u reserved=%u\n",
                          (unsigned)machine->state.scheduler.count, (unsigned)machine->state.scheduler.phase,
                          (unsigned)machine->state.devices.iob.key_queue_count,
                          (unsigned)machine->state.devices.iob.usec_phase,
                          (unsigned)machine->state.scheduler.transcript_count,
                          (unsigned long long)machine->state.scheduler.transcript_total_count,
                          (unsigned)machine->state.scheduler.transcript_capture_enabled,
                          (unsigned)machine->state.scheduler.transcript_reserved0);
            (void)fprintf(stderr, "CDRSTATE4 status=%u\n", (unsigned)cadr_state_v4_digest(&machine->state, state));
            (void)fprintf(stderr, "CDRSTATE3 status=%u\n", (unsigned)cadr_state_v3_digest(&machine->state, state));
            (void)fprintf(stderr, "CDRSTATE2 status=%u init=%u schema=%u mutations=%u\n",
                          (unsigned)cadr_state_v2_digest(&machine->state, state),
                          (unsigned)machine->state.trace.state_v2.initialized,
                          (unsigned)machine->state.trace.state_v2.schema_version,
                          (unsigned)machine->state.canonical.mutation_count);
            (void)fprintf(stderr, "events gen=%llu next=%llu outstanding=%llu last=%llu descriptor=%llu payload=%llu expected=%llu completion=%llu queued=%u operation=%u persistent=%u\n",
                          (unsigned long long)machine->state.events.generation,
                          (unsigned long long)machine->state.events.next_request_id,
                          (unsigned long long)machine->state.events.outstanding_request_id,
                          (unsigned long long)machine->state.events.last_completed_request_id,
                          (unsigned long long)machine->state.events.request_descriptor_byte_count,
                          (unsigned long long)machine->state.events.request_payload_byte_count,
                          (unsigned long long)machine->state.events.expected_completion_byte_count,
                          (unsigned long long)machine->state.events.completion_byte_count,
                          (unsigned)machine->state.events.completion_queued,
                          (unsigned)machine->state.events.outstanding_operation,
                          (unsigned)machine->state.events.persistent_status);
            return 0;
        }
    }
    hex(state, state_hex); hex(transcript_sha, transcript_hex);
    return fprintf(output, "{\"boundary\":%llu,\"cdrstate5_sha256\":\"%s\",\"cdrm5tr1_current_sha256\":\"%s\",\"sequence_break_pending\":%s,\"external_interrupt_pending\":%s}\n",
                   (unsigned long long)boundary, state_hex, transcript_hex,
                   sb != 0U ? "true" : "false", external != 0U ? "true" : "false") > 0;
}

/* The raw transcript is a first-class differential artifact.  Keep it beside
 * the JSON projection so the shared Python parser can reject malformed bytes
 * before the differential runner accepts their SHA-256. */
static int write_transcript_sidecar(const char *output_path, const uint8_t *bytes,
                                    uint64_t byte_count)
{
    static const char suffix[] = ".cdrm5tr1";
    size_t output_length;
    char *path;
    FILE *stream;
    int ok;
    if (output_path == NULL || bytes == NULL || byte_count > (uint64_t)SIZE_MAX) return 0;
    output_length = strlen(output_path);
    if (output_length > SIZE_MAX - sizeof(suffix)) return 0;
    path = malloc(output_length + sizeof(suffix));
    if (path == NULL) return 0;
    (void)memcpy(path, output_path, output_length);
    (void)memcpy(path + output_length, suffix, sizeof(suffix));
    stream = fopen(path, "wb");
    if (stream == NULL) ok = 0;
    else {
        ok = fwrite(bytes, 1U, (size_t)byte_count, stream) == (size_t)byte_count;
        if (fclose(stream) != 0) ok = 0;
    }
    free(path);
    return ok;
}

int main(int argc, char **argv)
{
    cadr_machine_config config = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M5,
        (uint32_t)sizeof(config), 0U, CADR_PROFILE_CADR_WEB_303, 0U };
    cadr_machine *machine = NULL;
    FILE *output = NULL;
    uint8_t *transcript = NULL;
    uint64_t transcript_bytes = 0U, written = 0U, boundary;
    uint8_t transcript_sha[CADR_SHA256_BYTES];
    int ok = 0;
    if (argc != 10 || strcmp(argv[6], "500000") != 0 || strcmp(argv[7], "565536") != 0 || strlen(argv[9]) != 64U) return 2;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK ||
        !load(machine, CADR_ARTIFACT_BOOT_CONFIGURATION, argv[1]) ||
        !load(machine, CADR_ARTIFACT_CONTROL_STORE, argv[2]) ||
        !load(machine, CADR_ARTIFACT_PROM_SYMBOLS, argv[3]) ||
        !load(machine, CADR_ARTIFACT_MICROCODE_SYMBOLS, argv[4]) ||
        !load(machine, CADR_ARTIFACT_BASE_DISK, argv[5]) ||
        cadr_machine_cold_power_on(machine) != CADR_STATUS_OK ||
        cadr_machine_boot(machine) != CADR_STATUS_OK || !run(machine, DUE) ||
        cadr_machine_scheduler_transcript_start(machine) != CADR_STATUS_OK ||
        !schedule_probe(machine)) goto done;
    output = fopen(argv[8], "wb");
    if (output == NULL || fprintf(output, "{\"schema\":\"CDRM5D1\",\"schema_version\":1,\"target\":\"CADR-WEB-303/ABI1.4/C-M5-SCHED-v1\",\"producer\":\"native\",\"due_boundary\":500000,\"final_boundary\":565536,\"schedule\":\"INF-M5-PRE-SLOT-v1\",\"hook\":\"source-oracle-disk-xbus-result-latch-v1\",\"ingress\":{\"clock\":\"scheduler-event\",\"keyboard\":\"scheduler-event\",\"sequence_break\":\"scheduler-event\",\"disk_xbus\":\"test-only-post-acceptance-latch\"},\"cdrm5tr1_schema\":\"CDRM5TR1\",\"cdrm5tr1_version\":4,\"cdrm5tr1_record_bytes\":120,\"projected_markers\":{\"sequence_break_clear_boundary\":502997,\"external_interrupt_clear_boundary\":505102},\"disk_sha256_before\":\"%s\",\"disk_sha256_after\":\"%s\",\"keyboard_scheduler_value\":1,\"projected_keyboard_scancode\":65537}\n", argv[9], argv[9]) < 0) goto done;
    if (!run(machine, 1U)) goto done;
    {
        cadr_status transcript_status = cadr_machine_scheduler_transcript_size(machine, &transcript_bytes);
        if (transcript_status != CADR_STATUS_OK || transcript_bytes == 0U ||
            transcript_bytes > (uint64_t)SIZE_MAX) {
            (void)fprintf(stderr, "C-M5 transcript status=%u bytes=%llu count=%u\n",
                          (unsigned)transcript_status, (unsigned long long)transcript_bytes,
                          (unsigned)machine->state.scheduler.transcript_count);
            goto done;
        }
    }
    transcript = malloc((size_t)transcript_bytes);
    if (transcript == NULL || cadr_machine_scheduler_transcript_copy(machine, transcript, transcript_bytes, &written) != CADR_STATUS_OK || written != transcript_bytes) {
        (void)fprintf(stderr, "C-M5 transcript copy failed bytes=%llu written=%llu\n",
                      (unsigned long long)transcript_bytes, (unsigned long long)written);
        goto done;
    }
    if (!write_transcript_sidecar(argv[8], transcript, written)) {
        (void)fprintf(stderr, "C-M5 transcript sidecar write failed\n");
        goto done;
    }
    cadr_m4_media_sha256(transcript, written, transcript_sha);
    if (!emit(output, machine, DUE, transcript_sha)) goto done;
    for (boundary = DUE + 1U; boundary <= LAST; ++boundary) {
        if (!run(machine, 1U) || !emit(output, machine, boundary, transcript_sha)) goto done;
    }
    ok = fclose(output) == 0; output = NULL;
done:
    if (output != NULL) (void)fclose(output);
    free(transcript); cadr_machine_destroy(machine);
    return ok ? 0 : 1;
}

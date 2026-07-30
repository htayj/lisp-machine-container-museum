/*
 * Native M13-F03 allocation and sanitizer probe.
 *
 * The M13 profile is a browser wrapper around the selected ABI1.10 C core.
 * JavaScript-only parsers (the v8 envelope, M10 IndexedDB wrapper, browser
 * metadata, and provisional artifact policy) cannot be covered by a native C
 * sanitizer.  This probe deliberately covers the C parsers and state machines
 * reachable from the selected lower ABI: CDRSNAP1 restore, CDRM4MEDIA1
 * compare/root construction, copied host completion, CDRGTRC1 start, CDRAUDS1
 * audio snapshot adoption, and CDRM12C1 debugger configuration restore.
 *
 * The runner invokes each allocating scenario once without a fault and once
 * for every observed allocation ordinal.  An injected allocation failure must
 * return NO_MEMORY and leave the scenario's specified pre-commit state intact.
 * This is M13-F03 evidence only; it does not close C-M13 or browser/M10 gates.
 */

#ifdef malloc
#undef malloc
#endif
#ifdef calloc
#undef calloc
#endif
#ifdef realloc
#undef realloc
#endif

#include "cadr_audio_model.h"
#include "cadr_host_api.h"
#include "cadr_m12_machine_adapter.h"
#include "cadr_m4_media.h"
#include "cadr_machine.h"
#include "cadr_snapshot.h"
#include "cadr_state_v2.h"
#include "cadr_trace_engine.h"

#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define M13_F03_MAX_POINTS 64U
#define M13_F03_FILE_BYTES 128U

typedef struct allocation_point {
    const char *kind;
    char file[M13_F03_FILE_BYTES];
    int line;
} allocation_point;

static uint64_t allocation_attempt;
static uint64_t allocation_fail_at;
static allocation_point allocation_points[M13_F03_MAX_POINTS];
static uint32_t allocation_point_count;

static void record_allocation(const char *kind, const char *file, int line)
{
    if (allocation_point_count < M13_F03_MAX_POINTS) {
        allocation_point *const point = &allocation_points[allocation_point_count];
        point->kind = kind;
        (void)snprintf(point->file, sizeof(point->file), "%s", file);
        point->line = line;
    }
    allocation_point_count += 1U;
    allocation_attempt += UINT64_C(1);
}

void *cadr_m13_f03_malloc_at(size_t size, const char *file, int line)
{
    record_allocation("malloc", file, line);
    return allocation_attempt == allocation_fail_at ? NULL : malloc(size);
}

void *cadr_m13_f03_calloc_at(size_t count, size_t size,
                              const char *file, int line)
{
    record_allocation("calloc", file, line);
    return allocation_attempt == allocation_fail_at ? NULL : calloc(count, size);
}

void *cadr_m13_f03_realloc_at(void *pointer, size_t size,
                               const char *file, int line)
{
    record_allocation("realloc", file, line);
    return allocation_attempt == allocation_fail_at ? NULL : realloc(pointer, size);
}

static void allocation_reset(uint64_t fail_at)
{
    allocation_attempt = 0U;
    allocation_fail_at = fail_at;
    allocation_point_count = 0U;
    (void)memset(allocation_points, 0, sizeof(allocation_points));
}

static int fail(const char *message)
{
    (void)fprintf(stderr, "M13-F03 failure: %s\n", message);
    return 0;
}

/* A deliberately synthetic ABI fixture.  It takes the selected core through
 * its real cold/power/boot state transitions but never opens preserved media
 * or makes a historical System 303 runtime claim. */
static cadr_machine *make_fixture_machine(void)
{
    const cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    cadr_status status = cadr_machine_create(&config, &machine);
    if (status != CADR_STATUS_OK || machine == NULL) {
        (void)fprintf(stderr, "M13-F03 fixture create status=%" PRIu32 "\n", status);
        return NULL;
    }
    machine->state.artifacts.boot_configuration_ingressed = 1U;
    machine->state.artifacts.control_store_ingressed = 1U;
    machine->state.artifacts.base_disk_verified = 1U;
    status = cadr_machine_cold_power_on(machine);
    if (status != CADR_STATUS_OK) {
        (void)fprintf(stderr, "M13-F03 fixture cold-power status=%" PRIu32 "\n", status);
        cadr_machine_destroy(machine);
        return NULL;
    }
    status = cadr_machine_boot(machine);
    if (status != CADR_STATUS_OK) {
        (void)fprintf(stderr, "M13-F03 fixture boot status=%" PRIu32 "\n", status);
        cadr_machine_destroy(machine);
        return NULL;
    }
    status = cadr_state_v2_rebuild(&machine->state);
    if (status != CADR_STATUS_OK) {
        (void)fprintf(stderr, "M13-F03 fixture cache-rebuild status=%" PRIu32 "\n", status);
        cadr_machine_destroy(machine);
        return NULL;
    }
    return machine;
}

static int queue_network_completion(cadr_machine *machine)
{
    const cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(3) };
    const uint8_t bytes[3] = { UINT8_C(0xaa), UINT8_C(0xbb), UINT8_C(0xcc) };
    const cadr_host_completion completion = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12, (uint32_t)sizeof(cadr_host_completion),
        CADR_HOST_OPERATION_NETWORK, CADR_HOST_RESULT_OK, 0U,
        machine->state.events.generation, machine->state.events.next_request_id, sizeof(bytes)
    };
    if (cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                        (const uint8_t *)&descriptor,
                                        sizeof(descriptor), sizeof(bytes)) != CADR_STATUS_OK) {
        return 0;
    }
    /* issue_host_request consumes next_request_id, so bind the actual request. */
    if (completion.request_id != machine->state.events.outstanding_request_id) {
        return 0;
    }
    return cadr_machine_complete_host_request(machine, &completion, bytes, sizeof(bytes)) ==
        CADR_STATUS_OK;
}

static int scenario_machine_create(uint64_t fault)
{
    const cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = (cadr_machine *)(uintptr_t)UINT64_C(1);
    cadr_status status;
    allocation_reset(fault);
    status = cadr_machine_create(&config, &machine);
    if (fault != 0U) {
        if (status != CADR_STATUS_NO_MEMORY || machine != NULL) return fail("machine create was not atomic");
    } else if (status != CADR_STATUS_OK || machine == NULL) {
        return fail("machine create did not succeed");
    }
    cadr_machine_destroy(machine);
    return 1;
}

static int scenario_host_completion(uint64_t fault)
{
    cadr_machine *machine = make_fixture_machine();
    const cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(3) };
    const uint8_t bytes[3] = { UINT8_C(0x12), UINT8_C(0x34), UINT8_C(0x56) };
    cadr_host_completion completion;
    cadr_status status;
    int ok = 1;
    if (machine == NULL) return fail("could not set up host completion");
    if (cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                        (const uint8_t *)&descriptor,
                                        sizeof(descriptor), sizeof(bytes)) != CADR_STATUS_OK) {
        cadr_machine_destroy(machine);
        return fail("could not issue host completion request");
    }
    completion = (cadr_host_completion){
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12, (uint32_t)sizeof(completion),
        CADR_HOST_OPERATION_NETWORK, CADR_HOST_RESULT_OK, 0U,
        machine->state.events.generation, machine->state.events.outstanding_request_id, sizeof(bytes)
    };
    allocation_reset(fault);
    status = cadr_machine_complete_host_request(machine, &completion, bytes, sizeof(bytes));
    if (fault != 0U) {
        if (status != CADR_STATUS_NO_MEMORY || machine->state.events.completion_queued != 0U ||
            machine->state.events.completion_bytes != NULL || machine->state.in_host_completion != 0U) {
            ok = fail("host-completion allocation failure mutated the pending state");
        }
    } else if (status != CADR_STATUS_OK || machine->state.events.completion_queued != 1U ||
               machine->state.events.completion_byte_count != sizeof(bytes) ||
               memcmp(machine->state.events.completion_bytes, bytes, sizeof(bytes)) != 0) {
        ok = fail("host completion did not retain an exact copied payload");
    }
    cadr_machine_destroy(machine);
    return ok;
}

static int snapshot_bytes_with_completion(uint8_t **out_bytes, uint64_t *out_count)
{
    cadr_machine *machine = make_fixture_machine();
    const cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    uint64_t count = 0U;
    uint64_t written = 0U;
    uint8_t *bytes = NULL;
    int ok = 0;
    if (out_bytes == NULL || out_count == NULL || machine == NULL) goto done;
    if (!queue_network_completion(machine) ||
        cadr_machine_snapshot_size(machine, &request, &count) != CADR_STATUS_OK ||
        count == 0U || count > (uint64_t)SIZE_MAX) goto done;
    bytes = malloc((size_t)count);
    if (bytes == NULL || cadr_machine_snapshot_save(machine, &request, bytes, count, &written) !=
        CADR_STATUS_OK || written != count) goto done;
    *out_bytes = bytes;
    *out_count = count;
    bytes = NULL;
    ok = 1;
done:
    free(bytes);
    cadr_machine_destroy(machine);
    return ok;
}

static int scenario_snapshot_restore(uint64_t fault)
{
    const cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M12, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    uint8_t *bytes = NULL;
    uint64_t count = 0U;
    cadr_machine *restored = (cadr_machine *)(uintptr_t)UINT64_C(1);
    cadr_status status;
    int ok = 1;
    if (!snapshot_bytes_with_completion(&bytes, &count)) return fail("could not create CDRSNAP1 input");
    allocation_reset(fault);
    status = cadr_machine_snapshot_restore(&request, bytes, count, &restored);
    if (fault != 0U) {
        if (status != CADR_STATUS_NO_MEMORY || restored != NULL) {
            ok = fail("CDRSNAP1 restore allocation failure published a candidate");
        }
    } else if (status != CADR_STATUS_OK || restored == NULL ||
               restored->state.events.completion_queued != 1U ||
               restored->state.events.completion_byte_count != 3U) {
        ok = fail("CDRSNAP1 restore did not reproduce the queued completion");
    }
    cadr_machine_destroy(restored);
    free(bytes);
    return ok;
}

static void put32le(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void put64le(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
}

static void media_request(cadr_m4_media_turn *turn, uint64_t ordinal,
                          uint32_t actor, const uint8_t payload[1024])
{
    (void)memset(turn, 0, sizeof(*turn));
    turn->ordinal = ordinal;
    turn->actor = actor;
    turn->operation = CADR_HOST_OPERATION_BLOCK_WRITE;
    turn->actor_status = CADR_STATUS_OK;
    turn->guest_tick = 100U + ordinal;
    turn->generation = 17U;
    turn->request_id = 3U;
    turn->descriptor_byte_count = 24U;
    turn->request_payload_byte_count = 1024U;
    put64le(turn->descriptor, 3U);
    put64le(turn->descriptor + 8U, 1U);
    put32le(turn->descriptor + 16U, 1U);
    put32le(turn->descriptor + 20U, 1024U);
    cadr_m4_media_sha256(turn->descriptor, 24U, turn->descriptor_sha256);
    cadr_m4_media_sha256(payload, 1024U, turn->request_payload_sha256);
    (void)memcpy(turn->page_sha256, turn->request_payload_sha256, CADR_SHA256_BYTES);
}

static int make_media_document(uint8_t **out_bytes, uint64_t *out_count)
{
    cadr_machine *machine = make_fixture_machine();
    cadr_m4_media_header header;
    cadr_m4_media_turn turns[5];
    uint8_t root[CADR_SHA256_BYTES];
    uint8_t payload[1024];
    uint8_t *bytes = NULL;
    uint64_t count = 0U;
    uint64_t written = 0U;
    cadr_status status;
    int ok = 0;
    if (out_bytes == NULL || out_count == NULL || machine == NULL) goto done;
    cadr_m4_media_selected_base(&header);
    for (uint32_t index = 0U; index < 1024U; ++index) payload[index] = (uint8_t)index;
    media_request(&turns[0], 0U, CADR_M4_MEDIA_ACTOR_ISSUE, payload);
    status = cadr_m4_media_overlay_root(&header, turns, 0U, root);
    if (status != CADR_STATUS_OK) goto done;
    (void)memcpy(turns[0].overlay_root_sha256, root, CADR_SHA256_BYTES);
    media_request(&turns[1], 1U, CADR_M4_MEDIA_ACTOR_CAPTURE, payload);
    (void)memcpy(turns[1].overlay_root_sha256, root, CADR_SHA256_BYTES);
    media_request(&turns[2], 2U, CADR_M4_MEDIA_ACTOR_DELIVERY, payload);
    turns[2].disposition = CADR_M4_MEDIA_DISPOSITION_COMMIT;
    status = cadr_m4_media_overlay_root(&header, turns, 3U, root);
    if (status != CADR_STATUS_OK) goto done;
    turns[2].overlay_generation = 1U;
    (void)memcpy(turns[2].overlay_root_sha256, root, CADR_SHA256_BYTES);
    media_request(&turns[3], 3U, CADR_M4_MEDIA_ACTOR_APPLY, payload);
    turns[3].disposition = CADR_M4_MEDIA_DISPOSITION_COMMIT;
    turns[3].overlay_generation = 1U;
    (void)memcpy(turns[3].overlay_root_sha256, root, CADR_SHA256_BYTES);
    status = cadr_m4_media_build_stable_turn(&machine->state, 4U, 104U, 1U, root, &turns[4]);
    if (status != CADR_STATUS_OK) goto done;
    status = cadr_m4_media_serialized_size(5U, &count);
    if (status != CADR_STATUS_OK || count > (uint64_t)SIZE_MAX) goto done;
    bytes = malloc((size_t)count);
    status = bytes == NULL ? CADR_STATUS_NO_MEMORY :
        cadr_m4_media_serialize(&header, turns, 5U, bytes, count, &written);
    if (status != CADR_STATUS_OK || written != count) goto done;
    *out_bytes = bytes;
    *out_count = count;
    bytes = NULL;
    ok = 1;
done:
    free(bytes);
    cadr_machine_destroy(machine);
    return ok;
}

static int scenario_media_compare(uint64_t fault)
{
    uint8_t *bytes = NULL;
    uint64_t count = 0U;
    cadr_m4_media_difference difference = { 0U, 0U, 0U, 0U };
    cadr_status status;
    int ok = 1;
    if (!make_media_document(&bytes, &count)) return fail("could not create CDRM4MEDIA1 input");
    allocation_reset(fault);
    status = cadr_m4_media_compare(bytes, count, bytes, count, &difference);
    if (fault != 0U) {
        if (status != CADR_STATUS_NO_MEMORY) ok = fail("CDRM4MEDIA1 parser did not return NO_MEMORY");
    } else if (status != CADR_STATUS_OK) {
        ok = fail("CDRM4MEDIA1 parser did not accept its canonical document");
    }
    free(bytes);
    return ok;
}

static int scenario_media_root(uint64_t fault)
{
    cadr_m4_media_header header;
    cadr_m4_media_turn turn;
    uint8_t root[CADR_SHA256_BYTES];
    uint8_t before[CADR_SHA256_BYTES];
    cadr_status status;
    cadr_m4_media_selected_base(&header);
    (void)memset(&turn, 0, sizeof(turn));
    turn.actor = CADR_M4_MEDIA_ACTOR_DELIVERY;
    turn.operation = CADR_HOST_OPERATION_BLOCK_WRITE;
    turn.disposition = CADR_M4_MEDIA_DISPOSITION_COMMIT;
    turn.descriptor[8] = UINT8_C(1);
    (void)memset(root, 0xa5, sizeof(root));
    (void)memcpy(before, root, sizeof(root));
    allocation_reset(fault);
    status = cadr_m4_media_overlay_root(&header, &turn, 1U, root);
    if (fault != 0U) {
        if (status != CADR_STATUS_NO_MEMORY || memcmp(root, before, sizeof(root)) != 0) {
            return fail("CDRM4MEDIA1 overlay root failure was not atomic");
        }
    } else if (status != CADR_STATUS_OK || memcmp(root, before, sizeof(root)) == 0) {
        return fail("CDRM4MEDIA1 overlay root did not produce a root");
    }
    return 1;
}

static int scenario_trace_start(uint64_t fault)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    cadr_trace_engine_config config;
    cadr_status status;
    int ok = 1;
    if (state == NULL) return fail("could not allocate trace fixture");
    state->memory.main_memory_pages = 1U;
    state->memory.mapped_words = CADR_MAIN_MEMORY_WORDS_PER_PAGE;
    state->events.generation = 1U;
    state->events.next_request_id = 1U;
    if (cadr_state_v2_rebuild(state) != CADR_STATUS_OK) {
        free(state);
        return fail("could not build trace fixture cache");
    }
    (void)memset(&config, 0, sizeof(config));
    config.transport_mode = CADR_TRACE_TRANSPORT_FULL;
    config.ring_record_capacity = 1U;
    allocation_reset(fault);
    status = cadr_trace_engine_start(state, &config);
    if (fault != 0U) {
        if (status != CADR_STATUS_NO_MEMORY || state->trace.engine != NULL) {
            ok = fail("CDRGTRC1 start allocation failure attached an engine");
        }
    } else if (status != CADR_STATUS_OK || state->trace.engine == NULL) {
        ok = fail("CDRGTRC1 start did not attach an engine");
    }
    cadr_trace_engine_stop(state);
    free(state);
    return ok;
}

static int scenario_audio_snapshot(void)
{
    cadr_audio_model source = { 0 };
    cadr_audio_model target = { 0 };
    cadr_audio_authority source_authority = { 0 };
    cadr_audio_authority target_authority = { 0 };
    cadr_audio_incarnation_allocator source_allocator = { 0 };
    cadr_audio_incarnation_allocator target_allocator = { 0 };
    uint8_t bytes[CADR_AUDIO_SNAPSHOT_HEADER_BYTES + CADR_AUDIO_CANONICAL_EVENT_BYTES];
    uint8_t adopted[sizeof(target)];
    uint32_t written = 0U;
    int ok = 1;
    if (cadr_audio_incarnation_allocator_initialize(&source_allocator, 1U) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_incarnation_allocator_initialize(&target_allocator, 1U) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_authority_initialize(&source_authority, &source_allocator, 11U, 1U, 0U) !=
            CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_initialize(&source, &source_authority, 7U,
                                    CADR_AUDIO_RENDERER_NO_AUDIO) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_accept_beep_job(&source, 9U, 744U, 1058U) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_snapshot_serialize(&source, bytes, sizeof(bytes), &written) !=
            CADR_AUDIO_STATUS_OK ||
        cadr_audio_authority_initialize(&target_authority, &target_allocator, 12U, 2U, 0U) !=
            CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_initialize(&target, &target_authority, 99U,
                                    CADR_AUDIO_RENDERER_NO_AUDIO) != CADR_AUDIO_STATUS_OK) {
        return fail("could not set up CDRAUDS1 fixture");
    }
    if (cadr_audio_model_snapshot_adopt(&target, bytes, written) != CADR_AUDIO_STATUS_OK ||
        target.count != source.count || target.generation != source.generation) {
        ok = fail("CDRAUDS1 adoption did not reproduce the audio state");
    }
    (void)memcpy(adopted, &target, sizeof(adopted));
    bytes[0] ^= UINT8_C(1);
    if (cadr_audio_model_snapshot_adopt(&target, bytes, written) != CADR_AUDIO_STATUS_INVALID_ARGUMENT) {
        ok = fail("CDRAUDS1 malformed magic was accepted");
    }
    if (memcmp(&target, adopted, sizeof(adopted)) != 0) {
        ok = fail("CDRAUDS1 malformed input modified the adopted audio state");
    }
    return ok;
}

static int scenario_m12_config(uint64_t fault)
{
    cadr_machine *machine = make_fixture_machine();
    cadr_m12_machine_adapter adapter;
    cadr_m12_breakpoint breakpoint = { 1U, CADR_M12_BREAKPOINT_MICRO_PC_BEFORE, 0123U };
    uint8_t bytes[CADR_M12_CONFIG_SNAPSHOT_BYTES];
    cadr_m12_breakpoint retained;
    int ok = 1;
    if (machine == NULL) return fail("could not set up CDRM12C1 fixture");
    /* Fixture creation is covered by machine-create; CDRM12C1 itself has no
     * selected dynamic allocation. */
    allocation_reset(fault);
    (void)memset(&adapter, 0, sizeof(adapter));
    if (cadr_m12_machine_adapter_initialize(&adapter, machine) != CADR_STATUS_OK ||
        cadr_m12_machine_adapter_breakpoint_set(&adapter, 4U, &breakpoint) != CADR_M12_STATUS_OK ||
        cadr_m12_machine_adapter_config_snapshot_serialize(&adapter, bytes) != CADR_STATUS_OK) {
        cadr_machine_destroy(machine);
        return fail("could not encode CDRM12C1");
    }
    if (cadr_m12_machine_adapter_breakpoint_clear(&adapter, 4U) != CADR_M12_STATUS_OK ||
        cadr_m12_machine_adapter_config_snapshot_restore(&adapter, bytes) != CADR_STATUS_OK ||
        adapter.debugger.breakpoints[4].enabled != 1U) {
        ok = fail("CDRM12C1 did not atomically restore a breakpoint");
    }
    retained = adapter.debugger.breakpoints[4];
    bytes[60] ^= UINT8_C(1);
    if (cadr_m12_machine_adapter_config_snapshot_restore(&adapter, bytes) != CADR_STATUS_INVALID_ARGUMENT ||
        memcmp(&retained, &adapter.debugger.breakpoints[4], sizeof(retained)) != 0) {
        ok = fail("CDRM12C1 malformed input modified debugger configuration");
    }
    cadr_m12_machine_adapter_destroy(&adapter);
    cadr_machine_destroy(machine);
    return ok;
}

static int run_scenario(const char *name, uint64_t fault)
{
    if (strcmp(name, "machine-create") == 0) return scenario_machine_create(fault);
    if (strcmp(name, "host-completion") == 0) return scenario_host_completion(fault);
    if (strcmp(name, "snapshot-restore") == 0) return scenario_snapshot_restore(fault);
    if (strcmp(name, "media-compare") == 0) return scenario_media_compare(fault);
    if (strcmp(name, "media-root") == 0) return scenario_media_root(fault);
    if (strcmp(name, "trace-start") == 0) return scenario_trace_start(fault);
    if (strcmp(name, "audio-snapshot") == 0 && fault == 0U) return scenario_audio_snapshot();
    if (strcmp(name, "m12-config") == 0 && fault == 0U) return scenario_m12_config(fault);
    return fail("unknown scenario or an unsupported allocation injection");
}

static void json_string(const char *text)
{
    const unsigned char *cursor = (const unsigned char *)text;
    (void)putchar('"');
    while (*cursor != '\0') {
        if (*cursor == '"' || *cursor == '\\') (void)putchar('\\');
        if (*cursor >= 0x20U) (void)putchar(*cursor);
        cursor += 1;
    }
    (void)putchar('"');
}

static void report(const char *scenario, uint64_t fault, int success)
{
    uint32_t index;
    (void)printf("{\"schema\":\"cadr-m13-f03-native-probe-v1\",\"scenario\":");
    json_string(scenario);
    (void)printf(",\"fault_at\":%" PRIu64 ",\"allocation_count\":%" PRIu64
                 ",\"allocation_points\":[", fault, allocation_attempt);
    for (index = 0U; index < allocation_point_count && index < M13_F03_MAX_POINTS; ++index) {
        if (index != 0U) (void)putchar(',');
        (void)printf("{\"kind\":"); json_string(allocation_points[index].kind);
        (void)printf(",\"file\":"); json_string(allocation_points[index].file);
        (void)printf(",\"line\":%d}", allocation_points[index].line);
    }
    (void)printf("],\"result\":\"");
    (void)fputs(success != 0 ? "pass" : "fail", stdout);
    (void)puts("\"}");
}

int main(int argc, char **argv)
{
    uint64_t fault = 0U;
    char *end = NULL;
    int success;
    if (argc != 2 && argc != 3) {
        (void)fprintf(stderr, "usage: %s SCENARIO [FAIL_AT]\n", argv[0]);
        return 64;
    }
    if (argc == 3) {
        fault = strtoull(argv[2], &end, 10);
        if (end == argv[2] || *end != '\0' || fault == 0U) {
            (void)fputs("FAIL_AT must be a positive decimal allocation ordinal\n", stderr);
            return 64;
        }
    }
    allocation_reset(0U);
    success = run_scenario(argv[1], fault);
    report(argv[1], fault, success);
    return success != 0 ? 0 : 1;
}

/*
 * M3 headless wasm32 adapter.  This file owns the browser-facing ABI only;
 * all CADR execution continues through the portable cadr_machine ABI.
 */
#include "cadr_boundary_state.h"
#include "cadr_disk_evidence.h"
#include "cadr_host_api.h"
#include "cadr_machine.h"
#include "cadr_bus_device.h"
#include "cadr_state_v3.h"
#include "cadr_state_v4.h"
#include "cadr_state_v5.h"
#include "cadr_wasm_adapter.h"
#include "cadr_wasm_memory.h"
#include "cadr_wasm_runtime.h"
#include "cadr_trace_engine.h"

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define CADR_WASM_EXPORT(name) __attribute__((export_name(name)))

static cadr_machine *cadr_wasm_machine;
static uint8_t *cadr_wasm_input;
static uint32_t cadr_wasm_input_capacity;
static uint8_t *cadr_wasm_output;
static uint8_t *cadr_wasm_meta;
static uint8_t *cadr_wasm_snapshot;
static uint64_t cadr_wasm_snapshot_capacity;
static uint64_t cadr_wasm_snapshot_written;
static uint8_t *cadr_wasm_snapshot_input;
static uint64_t cadr_wasm_snapshot_input_capacity;
static uint32_t cadr_wasm_restore_used;

#define CADR_WASM_TRANSFER_BYTES UINT32_C(1048576)
#define CADR_WASM_OUTPUT_BYTES UINT32_C(96)
#define CADR_WASM_META_BYTES UINT32_C(32)
#define CADR_WASM_HOST_REQUEST_BYTES \
    (CADR_MAX_HOST_DESCRIPTOR_BYTES + CADR_MAX_HOST_REQUEST_PAYLOAD_BYTES)
#if defined(CADR_M5_WASM)
#define CADR_WASM_SNAPSHOT_ABI_MINOR CADR_ABI_MINOR_M5
#define CADR_WASM_ACTIVE_ABI_MINOR CADR_ABI_MINOR_M5
#elif defined(CADR_M4_WASM)
#define CADR_WASM_SNAPSHOT_ABI_MINOR CADR_ABI_MINOR_M3
#define CADR_WASM_ACTIVE_ABI_MINOR CADR_ABI_MINOR_M4
#else
#define CADR_WASM_SNAPSHOT_ABI_MINOR CADR_ABI_MINOR_M3
#define CADR_WASM_ACTIVE_ABI_MINOR CADR_ABI_MINOR_M3
#endif

static void cadr_wasm_meta_result(uint64_t first, uint64_t second);
/* ABI1.2's nine-chunk CDRSNAP1 adds one directory entry and the D0 disk chunk. */
#define CADR_WASM_SNAPSHOT_MAX_BYTES UINT32_C(18126780)
#define CADR_WASM_COMPLETION_MAX_BYTES UINT32_C(1048576)
#define CADR_WASM_TRACE_ARENA_MAX_BYTES \
    (CADR_TRACE_MAX_RING_RECORDS * (CADR_TRACE_MAX_RECORD_BYTES + sizeof(uint32_t)) + UINT32_C(4096))
/*
 * A no-free module can retain: old, parsed, cache-copy, and replacement
 * machine states; both snapshot arenas; full trace storage; two queued host
 * completion payloads; and its shared transfer/output buffers.  The margin
 * below is reserved for static data, stack, alignment, and small metadata.
 */
#define CADR_WASM_RESTORE_DYNAMIC_PEAK_BYTES \
    (UINT32_C(4) * sizeof(cadr_machine) + UINT32_C(2) * CADR_WASM_SNAPSHOT_MAX_BYTES + \
     CADR_WASM_TRACE_ARENA_MAX_BYTES + UINT32_C(2) * CADR_WASM_COMPLETION_MAX_BYTES + \
     CADR_WASM_TRANSFER_BYTES + CADR_WASM_OUTPUT_BYTES + CADR_WASM_META_BYTES)
_Static_assert(CADR_WASM_RESTORE_DYNAMIC_PEAK_BYTES < CADR_WASM_MEMORY_BYTES,
               "M3 128 MiB arena must admit the bounded restore peak");

/* The adapter writes only fixed-width byte records across the JS boundary. */
_Static_assert(sizeof(cadr_machine_config) == 24U, "wasm machine config layout");
_Static_assert(sizeof(cadr_artifact_ingress) == 24U, "wasm artifact ingress layout");
_Static_assert(sizeof(cadr_run_request) == 24U, "wasm run request layout");
_Static_assert(sizeof(cadr_run_result) == 48U, "wasm run result layout");
_Static_assert(sizeof(cadr_trace_config) == 152U, "wasm trace config layout");
_Static_assert(sizeof(cadr_trace_finish_request) == 24U, "wasm trace finish layout");
_Static_assert(sizeof(cadr_snapshot_request) == 16U, "wasm snapshot request layout");
_Static_assert(CADR_MAX_HOST_DESCRIPTOR_BYTES <= CADR_WASM_TRANSFER_BYTES,
               "host request descriptor must fit the bounded wasm transfer arena");

static const uint8_t cadr_wasm_profile_sha256[CADR_SHA256_BYTES] = {
    0x1bU,0x8dU,0x63U,0xdbU,0x98U,0xacU,0xd4U,0x6eU,
    0x40U,0xadU,0xf9U,0x9aU,0x8aU,0x3cU,0xebU,0x5eU,
    0x05U,0x58U,0xd4U,0xacU,0x02U,0x7cU,0xb2U,0xcbU,
    0x4aU,0x43U,0x96U,0x65U,0xb1U,0x4bU,0x5dU,0x2aU
};
static const uint8_t cadr_wasm_artifact_set_sha256[CADR_SHA256_BYTES] = {
    0xe9U,0x6eU,0x6fU,0xf9U,0x03U,0xc2U,0x3cU,0xceU,
    0xa7U,0x07U,0xecU,0xe0U,0xe9U,0xa8U,0x72U,0xa8U,
    0xa7U,0x77U,0x71U,0xa6U,0x66U,0x3eU,0x3bU,0x91U,
    0x9eU,0xabU,0xa2U,0x1eU,0x22U,0xf2U,0xf9U,0x41U
};

static void cadr_wasm_put64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
}

static void cadr_wasm_put32(uint8_t *bytes, uint32_t value)
{
    uint32_t index;
    for (index = 0U; index < 4U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
}

static cadr_status cadr_wasm_ensure_machine(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_machine_config), 0U,
        CADR_PROFILE_CADR_WEB_303, 0U
    };
    if (cadr_wasm_machine != NULL) return CADR_STATUS_OK;
    return cadr_machine_create(&config, &cadr_wasm_machine);
}

CADR_WASM_EXPORT("cadr_wasm_create")
uint32_t cadr_wasm_create(void)
{
    if (cadr_wasm_machine != NULL) {
        /* M3 modules are single-run: instantiate a fresh module to restart. */
        return CADR_STATUS_NOT_READY;
    }
    return cadr_wasm_ensure_machine();
}

CADR_WASM_EXPORT("cadr_wasm_input_reserve")
uint32_t cadr_wasm_input_reserve(uint32_t byte_count)
{
    if (byte_count == 0U || byte_count > CADR_WASM_TRANSFER_BYTES) return 0U;
    if (byte_count <= cadr_wasm_input_capacity) {
        return (uint32_t)(uintptr_t)cadr_wasm_input;
    }
    cadr_wasm_input = malloc(CADR_WASM_TRANSFER_BYTES);
    if (cadr_wasm_input == NULL) return 0U;
    cadr_wasm_input_capacity = CADR_WASM_TRANSFER_BYTES;
    return (uint32_t)(uintptr_t)cadr_wasm_input;
}

CADR_WASM_EXPORT("cadr_wasm_stream_begin")
uint32_t cadr_wasm_stream_begin(uint32_t artifact_kind, uint32_t byte_count_low,
                                uint32_t byte_count_high)
{
    cadr_artifact_ingress ingress = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_artifact_ingress), artifact_kind,
        ((uint64_t)byte_count_high << 32U) | byte_count_low
    };
    cadr_status status = cadr_wasm_ensure_machine();
    if (status != CADR_STATUS_OK) return status;
    return cadr_machine_import_artifact_stream_begin(cadr_wasm_machine, &ingress);
}

CADR_WASM_EXPORT("cadr_wasm_stream_chunk")
uint32_t cadr_wasm_stream_chunk(uint32_t offset_low, uint32_t offset_high,
                                uint32_t byte_count)
{
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    if (byte_count == 0U || cadr_wasm_input == NULL ||
        byte_count > cadr_wasm_input_capacity) {
        /* Delegate malformed chunks so the core clears active stream scratch. */
        return cadr_machine_import_artifact_stream_chunk(
            cadr_wasm_machine, ((uint64_t)offset_high << 32U) | offset_low,
            NULL, byte_count);
    }
    return cadr_machine_import_artifact_stream_chunk(
        cadr_wasm_machine, ((uint64_t)offset_high << 32U) | offset_low,
        cadr_wasm_input, byte_count);
}

CADR_WASM_EXPORT("cadr_wasm_stream_finish")
uint32_t cadr_wasm_stream_finish(void)
{
    return cadr_wasm_machine == NULL ? CADR_STATUS_NOT_READY :
        cadr_machine_import_artifact_stream_finish(cadr_wasm_machine);
}

CADR_WASM_EXPORT("cadr_wasm_stream_abort")
uint32_t cadr_wasm_stream_abort(void)
{
    return cadr_wasm_machine == NULL ? CADR_STATUS_NOT_READY :
        cadr_machine_import_artifact_stream_abort(cadr_wasm_machine);
}

CADR_WASM_EXPORT("cadr_wasm_import")
uint32_t cadr_wasm_import(uint32_t artifact_kind, uint32_t byte_count)
{
    cadr_artifact_ingress ingress = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR,
        (uint32_t)sizeof(cadr_artifact_ingress), artifact_kind, byte_count
    };
    cadr_status status = cadr_wasm_ensure_machine();
    if (status != CADR_STATUS_OK) return status;
    if (byte_count == 0U || cadr_wasm_input == NULL ||
        byte_count > cadr_wasm_input_capacity) return CADR_STATUS_INVALID_ARGUMENT;
    return cadr_machine_import_artifact(cadr_wasm_machine, &ingress,
                                        cadr_wasm_input, byte_count);
}

CADR_WASM_EXPORT("cadr_wasm_cold_power_on")
uint32_t cadr_wasm_cold_power_on(void)
{
    return cadr_wasm_machine == NULL ? CADR_STATUS_NOT_READY :
        cadr_machine_cold_power_on(cadr_wasm_machine);
}

CADR_WASM_EXPORT("cadr_wasm_boot")
uint32_t cadr_wasm_boot(void)
{
    return cadr_wasm_machine == NULL ? CADR_STATUS_NOT_READY :
        cadr_machine_boot(cadr_wasm_machine);
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_reset")
#endif
uint32_t cadr_wasm_reset(void)
{
    cadr_reset_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M5, (uint32_t)sizeof(cadr_reset_request), 0U
    };
    return cadr_wasm_machine == NULL ? CADR_STATUS_NOT_READY :
        cadr_machine_reset(cadr_wasm_machine, &request);
}

CADR_WASM_EXPORT("cadr_wasm_run")
uint32_t cadr_wasm_run(uint32_t clock_slots)
{
    cadr_run_request request = {
        CADR_ABI_MAJOR, CADR_WASM_ACTIVE_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_request), 0U, clock_slots
    };
    cadr_run_result result = {
        CADR_ABI_MAJOR, CADR_WASM_ACTIVE_ABI_MINOR,
        (uint32_t)sizeof(cadr_run_result), 0U, 0U, 0U, 0U, 0U
    };
    cadr_status status;
    if (cadr_wasm_machine == NULL || clock_slots == 0U) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_machine_run(cadr_wasm_machine, &request, &result);
    cadr_wasm_meta_result(result.clock_slots_completed,
                          result.microinstructions_executed);
    return status;
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_schedule_event")
#endif
uint32_t cadr_wasm_schedule_event(uint32_t kind, uint32_t flags,
                                  uint32_t due_low, uint32_t due_high,
                                  uint32_t generation_low, uint32_t generation_high,
                                  uint32_t value, uint32_t reserved0)
{
    cadr_scheduler_event event;
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    (void)memset(&event, 0, sizeof(event));
    event.abi_major = CADR_ABI_MAJOR;
    event.abi_minor = CADR_ABI_MINOR_M5;
    event.struct_size = (uint32_t)sizeof(event);
    event.kind = kind;
    event.flags = flags;
    event.due_tick = ((uint64_t)due_high << 32U) | due_low;
    event.generation = ((uint64_t)generation_high << 32U) | generation_low;
    event.value = value;
    event.reserved0 = reserved0;
    return cadr_machine_schedule_event(cadr_wasm_machine, &event);
}

static uint32_t cadr_wasm_get32le(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
        ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_schedule_events")
#endif
uint32_t cadr_wasm_schedule_events(uint32_t event_count, uint32_t byte_count)
{
    cadr_scheduler_event events[CADR_SCHEDULER_EVENT_CAPACITY];
    uint32_t index;
    if (cadr_wasm_machine == NULL || event_count == 0U ||
        event_count > CADR_SCHEDULER_EVENT_CAPACITY ||
        byte_count != event_count * UINT32_C(32) || cadr_wasm_input == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    for (index = 0U; index < event_count; ++index) {
        const uint8_t *wire = cadr_wasm_input + index * UINT32_C(32);
        cadr_scheduler_event *event = &events[index];
        (void)memset(event, 0, sizeof(*event));
        event->abi_major = CADR_ABI_MAJOR; event->abi_minor = CADR_ABI_MINOR_M5;
        event->struct_size = (uint32_t)sizeof(*event);
        event->kind = cadr_wasm_get32le(wire); event->flags = cadr_wasm_get32le(wire + 4U);
        event->due_tick = (uint64_t)cadr_wasm_get32le(wire + 8U) |
            ((uint64_t)cadr_wasm_get32le(wire + 12U) << 32U);
        event->generation = (uint64_t)cadr_wasm_get32le(wire + 16U) |
            ((uint64_t)cadr_wasm_get32le(wire + 20U) << 32U);
        event->value = cadr_wasm_get32le(wire + 24U); event->reserved0 = cadr_wasm_get32le(wire + 28U);
    }
    return cadr_machine_schedule_events(cadr_wasm_machine, events, event_count);
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_scheduler_transcript_start")
#endif
uint32_t cadr_wasm_scheduler_transcript_start(void)
{
    return cadr_wasm_machine == NULL ? CADR_STATUS_NOT_READY :
        cadr_machine_scheduler_transcript_start(cadr_wasm_machine);
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_scheduler_transcript")
#endif
uint32_t cadr_wasm_scheduler_transcript(void)
{
    uint64_t byte_count = 0U;
    uint64_t written = 0U;
    cadr_status status;
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_machine_scheduler_transcript_size(cadr_wasm_machine, &byte_count);
    if (status != CADR_STATUS_OK || byte_count > CADR_WASM_TRANSFER_BYTES) return
        status == CADR_STATUS_OK ? CADR_STATUS_WRONG_LENGTH : status;
    if (cadr_wasm_input_reserve((uint32_t)byte_count) == 0U) return CADR_STATUS_NO_MEMORY;
    status = cadr_machine_scheduler_transcript_drain(cadr_wasm_machine, cadr_wasm_input,
                                                      byte_count, &written);
    cadr_wasm_meta_result(written, 0U);
    return status;
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_scheduler_transcript_finish")
#endif
uint32_t cadr_wasm_scheduler_transcript_finish(void)
{
    return cadr_wasm_machine == NULL ? CADR_STATUS_NOT_READY :
        cadr_machine_scheduler_transcript_finish(cadr_wasm_machine);
}

#if defined(CADR_M5_ORACLE_TEST)
CADR_WASM_EXPORT("cadr_wasm_m5_oracle_latch_disk_result")
uint32_t cadr_wasm_m5_oracle_latch_disk_result(void)
{
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    cadr_m5_oracle_latch_disk_result(&cadr_wasm_machine->state);
    return CADR_STATUS_OK;
}

CADR_WASM_EXPORT("cadr_wasm_m5_oracle_observation")
uint32_t cadr_wasm_m5_oracle_observation(void)
{
    const cadr_machine_state *state;
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    state = &cadr_wasm_machine->state;
    (void)memset(cadr_wasm_output, 0, CADR_WASM_OUTPUT_BYTES);
    cadr_wasm_put64(cadr_wasm_output, state->clock_slots_completed);
    cadr_wasm_put32(cadr_wasm_output + 8U, state->cpu.interrupt_control);
    cadr_wasm_put32(cadr_wasm_output + 12U, state->cpu.location_counter);
    cadr_wasm_put32(cadr_wasm_output + 16U, state->bus.interrupt_status);
    cadr_wasm_put32(cadr_wasm_output + 20U, state->bus.interrupt_pending);
    cadr_wasm_put32(cadr_wasm_output + 24U, state->devices.disk.status);
    cadr_wasm_put32(cadr_wasm_output + 28U, state->devices.tv_mode);
    cadr_wasm_put32(cadr_wasm_output + 32U, state->devices.iob.sixty_cycle_clock);
    cadr_wasm_put32(cadr_wasm_output + 36U, state->devices.iob.usec_clock);
    cadr_wasm_put32(cadr_wasm_output + 40U, state->devices.iob.csr);
    cadr_wasm_put32(cadr_wasm_output + 44U, state->devices.iob.scancode);
    cadr_wasm_put64(cadr_wasm_output + 48U, state->cpu.p0);
    cadr_wasm_put64(cadr_wasm_output + 56U, state->cpu.p1);
    cadr_wasm_put32(cadr_wasm_output + 64U, state->cpu.next_micro_pc);
    return CADR_STATUS_OK;
}
#endif

CADR_WASM_EXPORT("cadr_wasm_output_pointer")
uint32_t cadr_wasm_output_pointer(void)
{
    if (cadr_wasm_output == NULL) cadr_wasm_output = malloc(CADR_WASM_OUTPUT_BYTES);
    return (uint32_t)(uintptr_t)cadr_wasm_output;
}

CADR_WASM_EXPORT("cadr_wasm_meta_pointer")
uint32_t cadr_wasm_meta_pointer(void)
{
    if (cadr_wasm_meta == NULL) cadr_wasm_meta = malloc(CADR_WASM_META_BYTES);
    return (uint32_t)(uintptr_t)cadr_wasm_meta;
}

static void cadr_wasm_meta_result(uint64_t first, uint64_t second)
{
    if (cadr_wasm_meta == NULL) {
        cadr_wasm_meta = malloc(CADR_WASM_META_BYTES);
        if (cadr_wasm_meta == NULL) return;
    }
    cadr_wasm_put64(cadr_wasm_meta, first);
    cadr_wasm_put64(cadr_wasm_meta + 8U, second);
}

CADR_WASM_EXPORT("cadr_wasm_boundary_digest")
uint32_t cadr_wasm_boundary_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    return cadr_machine_boundary_digest(cadr_wasm_machine, cadr_wasm_output);
}

CADR_WASM_EXPORT("cadr_wasm_state_v2_digest")
uint32_t cadr_wasm_state_v2_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    return cadr_machine_state_v2_digest(cadr_wasm_machine,
                                        cadr_wasm_output + CADR_SHA256_BYTES);
}

/* The third digest is appended, preserving M3's existing 64-byte leaf. */
CADR_WASM_EXPORT("cadr_wasm_state_v3_digest")
uint32_t cadr_wasm_state_v3_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    if (cadr_wasm_machine->state.events.request_payload_byte_count != 0U) {
        return CADR_STATUS_NOT_READY;
    }
    return cadr_state_v3_digest(&cadr_wasm_machine->state,
                                cadr_wasm_output + CADR_SHA256_BYTES * 2U);
}

/*
 * Output record at cadr_wasm_output (all little-endian, 48 bytes):
 * u32 operation, u32 reserved, u64 generation, u64 request-id,
 * u64 descriptor-byte-count, u64 completion-byte-count,
 * u64 request-payload-byte-count. The descriptor and copied request payload
 * occupy adjacent bounded regions in cadr_wasm_input. Neither record is a C
 * struct across the JS boundary.
 */
CADR_WASM_EXPORT("cadr_wasm_host_next_request")
uint32_t cadr_wasm_host_next_request(void)
{
    cadr_host_request_m4 request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M4, (uint32_t)sizeof(cadr_host_request_m4),
        CADR_HOST_OPERATION_NONE, 0U, 0U, 0U, 0U, 0U
    };
    cadr_status status;
    if (cadr_wasm_machine == NULL || cadr_wasm_input == NULL ||
        cadr_wasm_output == NULL || cadr_wasm_input_capacity < CADR_WASM_HOST_REQUEST_BYTES) {
        return CADR_STATUS_NOT_READY;
    }
    status = cadr_machine_next_host_request_m4(
        cadr_wasm_machine, &request, cadr_wasm_input, CADR_MAX_HOST_DESCRIPTOR_BYTES,
        cadr_wasm_input + CADR_MAX_HOST_DESCRIPTOR_BYTES,
        cadr_wasm_input_capacity - CADR_MAX_HOST_DESCRIPTOR_BYTES);
    if (status != CADR_STATUS_OK) return status;
    (void)memset(cadr_wasm_output, 0, CADR_WASM_OUTPUT_BYTES);
    cadr_wasm_put32(cadr_wasm_output, request.operation);
    cadr_wasm_put64(cadr_wasm_output + 8U, request.generation);
    cadr_wasm_put64(cadr_wasm_output + 16U, request.request_id);
    cadr_wasm_put64(cadr_wasm_output + 24U, request.descriptor_byte_count);
    cadr_wasm_put64(cadr_wasm_output + 32U, request.completion_byte_count);
    cadr_wasm_put64(cadr_wasm_output + 40U, request.request_payload_byte_count);
    return CADR_STATUS_OK;
}

CADR_WASM_EXPORT("cadr_wasm_host_complete")
uint32_t cadr_wasm_host_complete(uint32_t operation, uint32_t host_status,
                                 uint32_t generation_low, uint32_t generation_high,
                                 uint32_t request_low, uint32_t request_high,
                                 uint32_t byte_count)
{
    cadr_host_completion completion = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR, (uint32_t)sizeof(cadr_host_completion),
        operation, host_status, 0U,
        ((uint64_t)generation_high << 32U) | generation_low,
        ((uint64_t)request_high << 32U) | request_low,
        byte_count
    };
    if (cadr_wasm_machine == NULL || byte_count > cadr_wasm_input_capacity ||
        (byte_count != 0U && cadr_wasm_input == NULL)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return cadr_machine_complete_host_request(cadr_wasm_machine, &completion,
                                              cadr_wasm_input, byte_count);
}

/* Meta word 0 is the visible disk status; word 1 is XBUS interrupt pending. */
CADR_WASM_EXPORT("cadr_wasm_disk_observation")
uint32_t cadr_wasm_disk_observation(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_meta == NULL) return CADR_STATUS_NOT_READY;
    cadr_wasm_meta_result(cadr_wasm_machine->state.devices.disk.status,
                          cadr_wasm_machine->state.bus.interrupt_pending);
    return CADR_STATUS_OK;
}

CADR_WASM_EXPORT("cadr_wasm_boot_media_observation")
uint32_t cadr_wasm_boot_media_observation(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_meta == NULL) {
        return CADR_STATUS_NOT_READY;
    }
    cadr_wasm_put64(cadr_wasm_meta,
                    cadr_wasm_machine->state.cpu.p0_pc);
    cadr_wasm_put64(cadr_wasm_meta + 8U,
                    cadr_wasm_machine->state.cpu.p1_pc);
    cadr_wasm_put64(cadr_wasm_meta + 16U,
                    cadr_wasm_machine->state.cpu.next_micro_pc);
    cadr_wasm_put64(cadr_wasm_meta + 24U,
                    cadr_wasm_machine->state.events.outstanding_request_id);
    return CADR_STATUS_OK;
}

CADR_WASM_EXPORT("cadr_wasm_disk_evidence")
uint32_t cadr_wasm_disk_evidence(void)
{
    uint64_t byte_count;
    uint64_t written = 0U;
    cadr_status status;
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_disk_evidence_serialized_size(
        &cadr_wasm_machine->state.disk_evidence, &byte_count);
    if (status != CADR_STATUS_OK) return status;
    if (byte_count == 0U || byte_count > CADR_WASM_TRANSFER_BYTES) {
        return CADR_STATUS_WRONG_LENGTH;
    }
    if (cadr_wasm_input_reserve((uint32_t)byte_count) == 0U) {
        return CADR_STATUS_NO_MEMORY;
    }
    status = cadr_disk_evidence_serialize(
        &cadr_wasm_machine->state.disk_evidence, cadr_wasm_input,
        byte_count, &written);
    if (status != CADR_STATUS_OK || written != byte_count) {
        return status == CADR_STATUS_OK ? CADR_STATUS_HOST_FAILURE : status;
    }
    cadr_wasm_meta_result(byte_count, 0U);
    return CADR_STATUS_OK;
}

/*
 * Output record (all little endian): u32 lifecycle, u32 artifact bitmask,
 * u64 clock slots, u64 microinstructions, u64 generation, u64 next request,
 * u64 outstanding request, u64 last completed request, u32 status, u32
 * profile.  Artifact bits 0..4 are boot config, control store, base disk,
 * PROM symbols, and microcode symbols respectively.
 */
CADR_WASM_EXPORT("cadr_wasm_machine_info")
uint32_t cadr_wasm_machine_info(void)
{
    cadr_machine_info info = {
        .abi_major = CADR_ABI_MAJOR,
        .abi_minor = CADR_ABI_MINOR,
        .struct_size = (uint32_t)sizeof(cadr_machine_info)
    };
    uint32_t artifacts;
    cadr_status status;
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_machine_query(cadr_wasm_machine, &info);
    if (status != CADR_STATUS_OK) return status;
    artifacts = (info.boot_configuration_ingressed << 0U) |
        (info.control_store_ingressed << 1U) |
        (info.base_disk_verified << 2U) |
        (cadr_wasm_machine->state.artifacts.prom_symbols_verified << 3U) |
        (cadr_wasm_machine->state.artifacts.microcode_symbols_verified << 4U);
    (void)memset(cadr_wasm_output, 0, CADR_WASM_OUTPUT_BYTES);
    cadr_wasm_put32(cadr_wasm_output, info.lifecycle);
    cadr_wasm_put32(cadr_wasm_output + 4U, artifacts);
    cadr_wasm_put64(cadr_wasm_output + 8U, info.clock_slots_completed);
    cadr_wasm_put64(cadr_wasm_output + 16U, info.microinstructions_executed);
    cadr_wasm_put64(cadr_wasm_output + 24U, info.generation);
    cadr_wasm_put64(cadr_wasm_output + 32U, info.next_request_id);
    cadr_wasm_put64(cadr_wasm_output + 40U, info.outstanding_request_id);
    cadr_wasm_put64(cadr_wasm_output + 48U,
                    cadr_wasm_machine->state.events.last_completed_request_id);
    cadr_wasm_put32(cadr_wasm_output + 56U, info.persistent_status);
    cadr_wasm_put32(cadr_wasm_output + 60U, cadr_wasm_machine->state.profile);
    return CADR_STATUS_OK;
}

CADR_WASM_EXPORT("cadr_wasm_trace_start")
uint32_t cadr_wasm_trace_start(uint32_t transport_mode, uint32_t capacity,
                               uint32_t selector_low, uint32_t selector_high,
                               uint32_t event_low, uint32_t event_high)
{
    cadr_trace_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(cadr_trace_config),
        0U, 0U, 0U, 0U, capacity, transport_mode, 0U, 0U,
        {0}, {0}, {0}
    };
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    (void)memcpy(config.profile_sha256, cadr_wasm_profile_sha256, CADR_SHA256_BYTES);
    (void)memcpy(config.artifact_set_sha256, cadr_wasm_artifact_set_sha256, CADR_SHA256_BYTES);
    config.selector_mask = ((uint64_t)selector_high << 32U) | selector_low;
    config.event_mask = ((uint64_t)event_high << 32U) | event_low;
    config.first_boundary = cadr_wasm_machine->state.clock_slots_completed;
    return cadr_machine_trace_start(cadr_wasm_machine, &config);
}

CADR_WASM_EXPORT("cadr_wasm_trace_header")
uint32_t cadr_wasm_trace_header(void)
{
    uint64_t written = 0U;
    cadr_status status;
    if (cadr_wasm_machine == NULL || cadr_wasm_input == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_machine_trace_header(cadr_wasm_machine, cadr_wasm_input,
                                       cadr_wasm_input_capacity, &written);
    cadr_wasm_meta_result(written, 0U);
    return status;
}

CADR_WASM_EXPORT("cadr_wasm_trace_drain")
uint32_t cadr_wasm_trace_drain(void)
{
    uint64_t written = 0U;
    uint64_t records = 0U;
    cadr_status status;
    if (cadr_wasm_machine == NULL || cadr_wasm_input == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_machine_trace_drain(cadr_wasm_machine, cadr_wasm_input,
                                      cadr_wasm_input_capacity, &written, &records);
    cadr_wasm_meta_result(written, records);
    return status;
}

CADR_WASM_EXPORT("cadr_wasm_trace_digest")
uint32_t cadr_wasm_trace_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    return cadr_machine_trace_digest(cadr_wasm_machine, cadr_wasm_output);
}

CADR_WASM_EXPORT("cadr_wasm_trace_count")
uint32_t cadr_wasm_trace_count(void)
{
    uint64_t count = 0U;
    cadr_status status;
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_machine_trace_count(cadr_wasm_machine, &count);
    cadr_wasm_meta_result(count, 0U);
    return status;
}

CADR_WASM_EXPORT("cadr_wasm_trace_finish")
uint32_t cadr_wasm_trace_finish(uint32_t reason)
{
    cadr_trace_finish_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2,
        (uint32_t)sizeof(cadr_trace_finish_request), reason, 0U, 0U
    };
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    return cadr_machine_trace_finish(cadr_wasm_machine, &request);
}

CADR_WASM_EXPORT("cadr_wasm_snapshot_size")
uint32_t cadr_wasm_snapshot_size(void)
{
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_WASM_SNAPSHOT_ABI_MINOR, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    uint64_t size = 0U;
    cadr_status status;
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_machine_snapshot_size(cadr_wasm_machine, &request, &size);
    cadr_wasm_meta_result(size, 0U);
    return status;
}

CADR_WASM_EXPORT("cadr_wasm_snapshot_save")
uint32_t cadr_wasm_snapshot_save(void)
{
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_WASM_SNAPSHOT_ABI_MINOR, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    uint64_t size = 0U;
    uint64_t written = 0U;
    cadr_status status;
    if (cadr_wasm_machine == NULL) return CADR_STATUS_NOT_READY;
    status = cadr_machine_snapshot_size(cadr_wasm_machine, &request, &size);
    if (status != CADR_STATUS_OK) return status;
    if (size > CADR_WASM_SNAPSHOT_MAX_BYTES) return CADR_STATUS_NO_MEMORY;
    if (cadr_wasm_snapshot == NULL) {
        cadr_wasm_snapshot = malloc(CADR_WASM_SNAPSHOT_MAX_BYTES);
        if (cadr_wasm_snapshot == NULL) return CADR_STATUS_NO_MEMORY;
        cadr_wasm_snapshot_capacity = CADR_WASM_SNAPSHOT_MAX_BYTES;
    }
    status = cadr_machine_snapshot_save(cadr_wasm_machine, &request,
                                        cadr_wasm_snapshot, cadr_wasm_snapshot_capacity,
                                        &written);
    if (status == CADR_STATUS_OK) cadr_wasm_snapshot_written = written;
    cadr_wasm_meta_result(written, 0U);
    return status;
}

CADR_WASM_EXPORT("cadr_wasm_snapshot_pointer")
uint32_t cadr_wasm_snapshot_pointer(void)
{
    return (uint32_t)(uintptr_t)cadr_wasm_snapshot;
}

/*
 * An independently allocated CDRSNAP1 input region.  The caller writes the
 * exact byte count returned by native cadr_machine_snapshot_save, then calls
 * cadr_wasm_snapshot_restore_import with that same count.  This is separate
 * from the one-megabyte artifact/trace transfer buffer.
 */
CADR_WASM_EXPORT("cadr_wasm_snapshot_input_reserve")
uint32_t cadr_wasm_snapshot_input_reserve(uint32_t byte_count)
{
    if (byte_count == 0U || byte_count > CADR_WASM_SNAPSHOT_MAX_BYTES) return 0U;
    if (cadr_wasm_snapshot_input == NULL) {
        cadr_wasm_snapshot_input = malloc(CADR_WASM_SNAPSHOT_MAX_BYTES);
        if (cadr_wasm_snapshot_input == NULL) return 0U;
        cadr_wasm_snapshot_input_capacity = CADR_WASM_SNAPSHOT_MAX_BYTES;
    }
    return (uint32_t)(uintptr_t)cadr_wasm_snapshot_input;
}

static uint32_t cadr_wasm_snapshot_replace(const uint8_t *bytes,
                                           uint64_t byte_count)
{
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_WASM_SNAPSHOT_ABI_MINOR, (uint32_t)sizeof(cadr_snapshot_request), 0U
    };
    cadr_machine *restored = NULL;
    cadr_machine *old;
    cadr_status status;
    uintptr_t allocation_mark;
    if (bytes == NULL || byte_count == 0U) return CADR_STATUS_NOT_READY;
    if (cadr_wasm_restore_used != 0U) return CADR_STATUS_NOT_READY;
    allocation_mark = cadr_wasm_allocator_mark();
    status = cadr_machine_snapshot_restore(&request, bytes, byte_count, &restored);
    if (status != CADR_STATUS_OK) {
        cadr_wasm_allocator_rollback(allocation_mark);
        return status;
    }
    old = cadr_wasm_machine;
    cadr_wasm_machine = restored;
    cadr_wasm_restore_used = 1U;
    if (old != NULL) cadr_machine_destroy(old);
    return CADR_STATUS_OK;
}

CADR_WASM_EXPORT("cadr_wasm_snapshot_restore_import")
uint32_t cadr_wasm_snapshot_restore_import(uint32_t byte_count)
{
    if (cadr_wasm_snapshot_input == NULL || byte_count == 0U ||
        (uint64_t)byte_count > cadr_wasm_snapshot_input_capacity) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return cadr_wasm_snapshot_replace(cadr_wasm_snapshot_input, byte_count);
}

CADR_WASM_EXPORT("cadr_wasm_snapshot_restore")
uint32_t cadr_wasm_snapshot_restore(void)
{
    return cadr_wasm_snapshot_replace(cadr_wasm_snapshot,
                                      cadr_wasm_snapshot_written);
}

/*
 * The probe has no host-endian or implementation-defined signed-shift input.
 * Its eight words establish the M3 fixed-width contract in a byte-addressable
 * response buffer: unsigned wrap, signed-to-unsigned representation, logical
 * shift, zero-count rotate behavior, 48-bit masking, byte encoding, pointer
 * width, and multiplication-wrap behavior.
 */
CADR_WASM_EXPORT("cadr_wasm_portability_probe")
uint32_t cadr_wasm_portability_probe(void)
{
    uint32_t *out;
    uint8_t *bytes;
    const uint64_t micro = UINT64_C(0xffffffffffffffff) & UINT64_C(0x0000ffffffffffff);
    const uint32_t encoded = UINT32_C(0x78563412);
    if (cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    out = (uint32_t *)cadr_wasm_output;
    bytes = (uint8_t *)out;
    out[0] = UINT32_MAX + UINT32_C(1);
    out[1] = (uint32_t)(int32_t)-1;
    out[2] = UINT32_C(0x80000000) >> 31U;
    out[3] = UINT32_C(0x12345678); /* zero-count rotate is deliberately identity. */
    out[4] = (uint32_t)(micro >> 32U);
    bytes[20] = (uint8_t)encoded;
    bytes[21] = (uint8_t)(encoded >> 8U);
    bytes[22] = (uint8_t)(encoded >> 16U);
    bytes[23] = (uint8_t)(encoded >> 24U);
    out[6] = (uint32_t)sizeof(void *);
    out[7] = UINT32_C(0xffffffff) * UINT32_C(2);
    return CADR_STATUS_OK;
}

CADR_WASM_EXPORT("cadr_wasm_state_v4_digest")
uint32_t cadr_wasm_state_v4_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) {
        return CADR_STATUS_NOT_READY;
    }
    return cadr_state_v4_digest(&cadr_wasm_machine->state,
                                cadr_wasm_output);
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_state_v5_digest")
#endif
uint32_t cadr_wasm_state_v5_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    return cadr_machine_state_v5_digest(cadr_wasm_machine, cadr_wasm_output);
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_scheduler_digest")
#endif
uint32_t cadr_wasm_scheduler_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    return cadr_machine_scheduler_digest(cadr_wasm_machine, cadr_wasm_output);
}

#if defined(CADR_M5_WASM)
CADR_WASM_EXPORT("cadr_wasm_state_v5_failure_digest")
#endif
uint32_t cadr_wasm_state_v5_failure_digest(void)
{
    if (cadr_wasm_machine == NULL || cadr_wasm_output == NULL) return CADR_STATUS_NOT_READY;
    return cadr_machine_state_v5_failure_digest(cadr_wasm_machine, cadr_wasm_output);
}

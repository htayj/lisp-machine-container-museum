/*
 * CADR-WEB portable-core host ABI, M1 foundation.
 *
 * This is a fixed-width C ABI for one opaque, externally serialized machine.
 * The host supplies transient input bytes only to the calls which name them;
 * the core copies accepted bytes before those calls return.  It has no host
 * reentry registration surface and does not accept host resource handles.
 */
#ifndef CADR_HOST_API_H
#define CADR_HOST_API_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CADR_ABI_MAJOR UINT32_C(1)
#define CADR_ABI_MINOR_M1 UINT32_C(0)
#define CADR_ABI_MINOR_M2 UINT32_C(1)
#define CADR_ABI_MINOR_M3 UINT32_C(2)
#define CADR_ABI_MINOR_M4 UINT32_C(3)
#define CADR_ABI_MINOR_M5 UINT32_C(4)
/* M6 is an ABI1.4 protocol extension, not an ABI-minor increment. */
#define CADR_ABI_MINOR_M6 UINT32_C(4)
#define CADR_ABI_MINOR_M7 UINT32_C(5)
#define CADR_ABI_MINOR_M11 UINT32_C(6)
#define CADR_ABI_MINOR_M9 UINT32_C(8)
/* M12 debugger/snapshot is ABI1.9; the browser-safe scalar inspector is the
 * next additive M12 surface and therefore ABI1.10. */
#define CADR_ABI_MINOR_M12 UINT32_C(10)
#define CADR_ABI_MINOR_M13_AUDIO UINT32_C(11)
#if defined(CADR_M13_AUDIO_CORE)
#define CADR_ABI_MINOR CADR_ABI_MINOR_M13_AUDIO
#elif defined(CADR_M12_CORE)
#define CADR_ABI_MINOR CADR_ABI_MINOR_M12
#elif defined(CADR_M9_CORE)
#define CADR_ABI_MINOR CADR_ABI_MINOR_M9
#elif defined(CADR_M11_CORE)
#define CADR_ABI_MINOR CADR_ABI_MINOR_M11
#elif defined(CADR_M7_CORE)
#define CADR_ABI_MINOR CADR_ABI_MINOR_M7
#else
#define CADR_ABI_MINOR CADR_ABI_MINOR_M6
#endif
#define CADR_SHA256_BYTES UINT32_C(32)
#define CADR_MAX_HOST_REQUEST_PAYLOAD_BYTES UINT32_C(1024)

typedef uint32_t cadr_status;

#define CADR_STATUS_OK                    UINT32_C(0)
#define CADR_STATUS_ABI_MISMATCH          UINT32_C(1)
#define CADR_STATUS_INVALID_ARGUMENT      UINT32_C(2)
#define CADR_STATUS_STALE_GENERATION      UINT32_C(3)
#define CADR_STATUS_DUPLICATE_COMPLETION  UINT32_C(4)
#define CADR_STATUS_WRONG_COMPLETION      UINT32_C(5)
#define CADR_STATUS_WRONG_LENGTH          UINT32_C(6)
#define CADR_STATUS_HOST_FAILURE          UINT32_C(7)
#define CADR_STATUS_WAITING_FOR_HOST      UINT32_C(8)
#define CADR_STATUS_NOT_READY             UINT32_C(9)
#define CADR_STATUS_PROFILE_MISMATCH      UINT32_C(10)
#define CADR_STATUS_ARTIFACT_MISMATCH     UINT32_C(11)
#define CADR_STATUS_GUEST_FAULT           UINT32_C(12)
#define CADR_STATUS_UNIMPLEMENTED_DEVICE  UINT32_C(13)
#define CADR_STATUS_REENTRANT             UINT32_C(14)
#define CADR_STATUS_NO_MEMORY             UINT32_C(15)
#define CADR_STATUS_HALTED                 UINT32_C(16)
#define CADR_STATUS_QUEUE_FULL             UINT32_C(17)
#define CADR_STATUS_AMBIGUOUS_SCHEDULE     UINT32_C(18)

/* Lifecycle values are observable state, not a host control channel. */
#define CADR_MACHINE_COLD                 UINT32_C(0)
#define CADR_MACHINE_POWERED              UINT32_C(1)
#define CADR_MACHINE_RUNNING              UINT32_C(2)
#define CADR_MACHINE_GUEST_FAULTED        UINT32_C(3)

#define CADR_PROFILE_CADR_WEB_303         UINT32_C(1)

/* Request and artifact kinds are fixed-width ABI values. */
#define CADR_HOST_OPERATION_NONE          UINT32_C(0)
#define CADR_HOST_OPERATION_BLOCK_READ    UINT32_C(1)
#define CADR_HOST_OPERATION_BLOCK_WRITE   UINT32_C(2)
#define CADR_HOST_OPERATION_PRESENT       UINT32_C(3)
#define CADR_HOST_OPERATION_AUDIO         UINT32_C(4)
#define CADR_HOST_OPERATION_NETWORK       UINT32_C(5)

#define CADR_HOST_RESULT_OK               UINT32_C(0)
#define CADR_HOST_RESULT_FAILED           UINT32_C(1)

#define CADR_ARTIFACT_BOOT_CONFIGURATION  UINT32_C(1)
#define CADR_ARTIFACT_CONTROL_STORE       UINT32_C(2)
#define CADR_ARTIFACT_BASE_DISK           UINT32_C(3)
#define CADR_ARTIFACT_PROM_SYMBOLS         UINT32_C(4)
#define CADR_ARTIFACT_MICROCODE_SYMBOLS    UINT32_C(5)

#define CADR_TRACE_SELECTOR_MICRO_PC           (UINT64_C(1) << 0U)
#define CADR_TRACE_SELECTOR_DECODED_WORD       (UINT64_C(1) << 1U)
#define CADR_TRACE_SELECTOR_A_SOURCE           (UINT64_C(1) << 2U)
#define CADR_TRACE_SELECTOR_M_SOURCE           (UINT64_C(1) << 3U)
#define CADR_TRACE_SELECTOR_DESTINATION        (UINT64_C(1) << 4U)
#define CADR_TRACE_SELECTOR_Q                  (UINT64_C(1) << 5U)
#define CADR_TRACE_SELECTOR_VMA                (UINT64_C(1) << 6U)
#define CADR_TRACE_SELECTOR_MD                 (UINT64_C(1) << 7U)
#define CADR_TRACE_SELECTOR_MACRO_PC           (UINT64_C(1) << 8U)
#define CADR_TRACE_SELECTOR_FAULT              (UINT64_C(1) << 9U)
#define CADR_TRACE_SELECTOR_INTERRUPT          (UINT64_C(1) << 10U)
#define CADR_TRACE_SELECTOR_DEVICE_TRANSACTION (UINT64_C(1) << 11U)
#define CADR_TRACE_SELECTOR_KNOWN              ((UINT64_C(1) << 12U) - UINT64_C(1))

#define CADR_TRACE_EVENT_CLOCK     UINT64_C(1)
#define CADR_TRACE_EVENT_INTERRUPT UINT64_C(2)
#define CADR_TRACE_EVENT_DEVICE    UINT64_C(4)
#define CADR_TRACE_EVENT_FAULT     UINT64_C(8)
#define CADR_TRACE_EVENT_HALT      UINT64_C(16)
#define CADR_TRACE_EVENT_KNOWN     (CADR_TRACE_EVENT_CLOCK | CADR_TRACE_EVENT_INTERRUPT | CADR_TRACE_EVENT_DEVICE | CADR_TRACE_EVENT_FAULT | CADR_TRACE_EVENT_HALT)

#define CADR_TRACE_TRANSPORT_FULL      UINT32_C(0)
#define CADR_TRACE_TRANSPORT_HASH_ONLY UINT32_C(1)

#define CADR_TRACE_REASON_COMPLETE_LIMIT UINT32_C(0)
#define CADR_TRACE_REASON_COMPLETE_HALT  UINT32_C(1)
#define CADR_TRACE_REASON_ABORT          UINT32_C(2)
#define CADR_TRACE_REASON_FAILURE        UINT32_C(3)

#define CADR_TRACE_HEADER_BYTES UINT32_C(256)

typedef struct cadr_machine cadr_machine;

/* Every public ABI record begins with these three fields. */
typedef struct cadr_abi_info {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t reserved0;
} cadr_abi_info;

typedef struct cadr_machine_config {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t flags;
    uint32_t profile;
    uint32_t reserved0;
} cadr_machine_config;

/* The selected profile, not this record, supplies exact size and digest. */
typedef struct cadr_artifact_ingress {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t artifact_kind;
    uint64_t byte_count;
} cadr_artifact_ingress;

typedef struct cadr_reset_request {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t flags;
} cadr_reset_request;

/* Issued by a core module and copied out by cadr_machine_next_host_request. */
typedef struct cadr_host_request {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t operation;
    uint64_t generation;
    uint64_t request_id;
    uint64_t descriptor_byte_count;
    uint64_t completion_byte_count;
} cadr_host_request;

/* ABI 1.3 request record with a copied core-owned request payload. */
typedef struct cadr_host_request_m4 {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t operation;
    uint64_t generation;
    uint64_t request_id;
    uint64_t descriptor_byte_count;
    uint64_t completion_byte_count;
    uint64_t request_payload_byte_count;
} cadr_host_request_m4;

/* completion_byte_count must exactly equal the transient byte_count argument. */
typedef struct cadr_host_completion {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t operation;
    uint32_t host_status;
    uint32_t reserved0;
    uint64_t generation;
    uint64_t request_id;
    uint64_t completion_byte_count;
} cadr_host_completion;

typedef struct cadr_run_request {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t reserved0;
    uint64_t clock_slot_budget;
} cadr_run_request;

typedef struct cadr_run_result {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t terminal_status;
    uint64_t clock_slots_completed;
    uint64_t microinstructions_executed;
    uint64_t completions_applied;
    uint64_t reserved0;
} cadr_run_result;

/* ABI 1.4 deterministic scheduler ingress.  The caller supplies guest-time
 * ordering; the core neither samples nor infers host time. */
#define CADR_SCHED_EVENT_SEQUENCE_BREAK UINT32_C(1)
#define CADR_SCHED_EVENT_CLOCK          UINT32_C(2)
#define CADR_SCHED_EVENT_KEYBOARD       UINT32_C(3)

/* No optional scheduler-event flags are defined by C-M5-SCHED-v1. */
#define CADR_SCHED_EVENT_FLAGS_KNOWN     UINT32_C(0)

typedef struct cadr_scheduler_event {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t kind;
    uint32_t flags;
    uint64_t due_tick;
    uint64_t generation;
    uint32_t value;
    uint32_t reserved0;
} cadr_scheduler_event;

typedef struct cadr_machine_info {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t lifecycle;
    uint64_t generation;
    uint64_t next_request_id;
    uint64_t outstanding_request_id;
    uint64_t clock_slots_completed;
    uint64_t microinstructions_executed;
    uint32_t outstanding_operation;
    uint32_t waiting_for_host;
    uint32_t completion_queued;
    uint32_t boot_configuration_ingressed;
    uint32_t control_store_ingressed;
    uint32_t base_disk_verified;
    uint32_t persistent_status;
} cadr_machine_info;

#if defined(CADR_M7_CORE)
/* M7 derived display-tracker view.  The tracker is intentionally excluded
 * from CDRSTATE and CDRSNAP1; machine_generation binds its raw framebuffer. */
typedef struct cadr_display_info {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t reserved0;
    uint64_t machine_generation;
    uint64_t framebuffer_generation;
    uint32_t width;
    uint32_t height;
    uint32_t stride_words;
    uint32_t backing_words;
    uint32_t active_words;
    uint32_t tv_mode;
    uint32_t full_refresh;
    uint32_t failed;
} cadr_display_info;
#endif

typedef struct cadr_block_read_descriptor {
    uint64_t first_block;
    uint32_t block_count;
    uint32_t block_bytes;
} cadr_block_read_descriptor;

typedef struct cadr_block_write_descriptor {
    uint64_t transaction_id;
    uint64_t first_block;
    uint32_t block_count;
    uint32_t block_bytes;
} cadr_block_write_descriptor;

typedef struct cadr_present_descriptor {
    uint64_t framebuffer_generation;
    uint32_t x;
    uint32_t y;
    uint32_t width;
    uint32_t height;
} cadr_present_descriptor;

typedef struct cadr_audio_descriptor {
    uint64_t audio_generation;
    uint64_t guest_timestamp;
    uint32_t encoding;
    uint32_t frame_count;
} cadr_audio_descriptor;

typedef struct cadr_network_descriptor {
    uint64_t frame_sequence;
    uint64_t frame_byte_count;
} cadr_network_descriptor;

typedef struct cadr_trace_config {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t flags;
    uint64_t first_boundary;
    uint64_t selector_mask;
    uint64_t event_mask;
    uint32_t ring_record_capacity;
    uint32_t transport_mode;
    uint32_t reserved0;
    uint32_t reserved1;
    uint8_t profile_sha256[CADR_SHA256_BYTES];
    uint8_t artifact_set_sha256[CADR_SHA256_BYTES];
    uint8_t input_schedule_sha256[CADR_SHA256_BYTES];
} cadr_trace_config;

typedef struct cadr_trace_finish_request {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t reason;
    uint32_t reserved0;
    uint32_t reserved1;
} cadr_trace_finish_request;

typedef struct cadr_snapshot_request {
    uint32_t abi_major;
    uint32_t abi_minor;
    uint32_t struct_size;
    uint32_t flags;
} cadr_snapshot_request;

#if defined(__cplusplus)
#define CADR_ABI_STATIC_ASSERT(condition, message) static_assert(condition, message)
#else
#define CADR_ABI_STATIC_ASSERT(condition, message) _Static_assert(condition, message)
#endif

CADR_ABI_STATIC_ASSERT(sizeof(cadr_abi_info) == 16U, "cadr_abi_info layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_machine_config) == 24U, "cadr_machine_config layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_artifact_ingress) == 24U, "cadr_artifact_ingress layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_reset_request) == 16U, "cadr_reset_request layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_host_request) == 48U, "cadr_host_request layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_host_request_m4) == 56U, "cadr_host_request_m4 layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_host_completion) == 48U, "cadr_host_completion layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_run_request) == 24U, "cadr_run_request layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_run_result) == 48U, "cadr_run_result layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_scheduler_event) == 48U, "scheduler event layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_machine_info) == 88U, "cadr_machine_info layout");
#if defined(CADR_M7_CORE)
CADR_ABI_STATIC_ASSERT(sizeof(cadr_display_info) == 64U, "cadr_display_info layout");
#endif
CADR_ABI_STATIC_ASSERT(sizeof(cadr_block_read_descriptor) == 16U, "block read descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_block_write_descriptor) == 24U, "block write descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_present_descriptor) == 24U, "present descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_audio_descriptor) == 24U, "audio descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_network_descriptor) == 16U, "network descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_trace_config) == 152U, "trace config layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_trace_finish_request) == 24U, "trace finish layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_snapshot_request) == 16U, "snapshot request layout");

#undef CADR_ABI_STATIC_ASSERT

void cadr_get_abi_info(cadr_abi_info *out_info);

cadr_status cadr_machine_create(const cadr_machine_config *config,
                                cadr_machine **out_machine);
void cadr_machine_destroy(cadr_machine *machine);

/* Exact ingress copies bytes into the cold machine; it never retains the input. */
cadr_status cadr_machine_import_artifact(cadr_machine *machine,
                                         const cadr_artifact_ingress *ingress,
                                         const uint8_t *bytes,
                                         uint64_t byte_count);
/*
 * Ordered zero-copy ingress for artifacts too large for a WASM transfer
 * buffer.  M3 supports the selected immutable base-disk artifact only.
 * Begin and every chunk are non-committing; finish publishes the verified
 * artifact bit atomically. A malformed active chunk or failed active finish
 * discards that stream. Rejection of an unrelated operation while a stream is
 * active leaves the stream intact.
 */
cadr_status cadr_machine_import_artifact_stream_begin(
    cadr_machine *machine, const cadr_artifact_ingress *ingress);
cadr_status cadr_machine_import_artifact_stream_chunk(
    cadr_machine *machine, uint64_t offset, const uint8_t *bytes,
    uint64_t byte_count);
cadr_status cadr_machine_import_artifact_stream_finish(cadr_machine *machine);
cadr_status cadr_machine_import_artifact_stream_abort(cadr_machine *machine);
cadr_status cadr_machine_cold_power_on(cadr_machine *machine);
cadr_status cadr_machine_boot(cadr_machine *machine);
cadr_status cadr_machine_reset(cadr_machine *machine,
                               const cadr_reset_request *request);
/* M5 accepts only explicitly timestamped, one-way scheduler events. */
cadr_status cadr_machine_schedule_event(cadr_machine *machine,
                                        const cadr_scheduler_event *event);
/* One all-or-nothing M5 ingress transaction.  Sequence numbers are assigned
 * only after every record and same-boundary ambiguity has been validated. */
cadr_status cadr_machine_schedule_events(cadr_machine *machine,
                                         const cadr_scheduler_event *events,
                                         uint32_t event_count);
/* Detailed CDRM5TR1 transport capture is opt-in.  The semantic cumulative
 * witness advances whether or not capture is active; capture merely retains
 * bounded per-event records until the host drains them. */
cadr_status cadr_machine_scheduler_transcript_start(cadr_machine *machine);
cadr_status cadr_machine_scheduler_transcript_size(const cadr_machine *machine,
                                                    uint64_t *out_byte_count);
cadr_status cadr_machine_scheduler_transcript_copy(const cadr_machine *machine,
                                                    uint8_t *bytes, uint64_t capacity,
                                                    uint64_t *out_written);
cadr_status cadr_machine_scheduler_transcript_drain(cadr_machine *machine,
                                                     uint8_t *bytes, uint64_t capacity,
                                                     uint64_t *out_written);
cadr_status cadr_machine_scheduler_transcript_finish(cadr_machine *machine);

/* Hosts observe issued work here; they cannot create a request. */
cadr_status cadr_machine_next_host_request(cadr_machine *machine,
                                           cadr_host_request *out_request,
                                           uint8_t *descriptor_bytes,
                                           uint64_t descriptor_capacity);
cadr_status cadr_machine_next_host_request_m4(
    cadr_machine *machine, cadr_host_request_m4 *out_request,
    uint8_t *descriptor_bytes, uint64_t descriptor_capacity,
    uint8_t *request_payload_bytes, uint64_t request_payload_capacity);
cadr_status cadr_machine_complete_host_request(cadr_machine *machine,
                                               const cadr_host_completion *completion,
                                               const uint8_t *bytes,
                                               uint64_t byte_count);
cadr_status cadr_machine_run(cadr_machine *machine,
                             const cadr_run_request *request,
                             cadr_run_result *out_result);
cadr_status cadr_machine_query(cadr_machine *machine,
                               cadr_machine_info *out_info);

#if defined(CADR_M7_CORE)
/* M7 CDRDISP1 output is canonical little-endian raw display words: bit zero
 * is the leftmost pixel.  tv_mode bit 2 selects only the displayed black/white
 * polarity; it never changes the raw word bits. */
cadr_status cadr_machine_display_info(cadr_machine *machine,
                                      cadr_display_info *out_info);
cadr_status cadr_machine_display_update_size(cadr_machine *machine,
                                             uint64_t *out_byte_count);
cadr_status cadr_machine_display_update_take(
    cadr_machine *machine, uint64_t expected_machine_generation,
    uint64_t expected_framebuffer_generation, uint8_t *bytes,
    uint64_t capacity, uint64_t *out_written);
cadr_status cadr_machine_display_full_size(cadr_machine *machine,
                                           uint64_t *out_byte_count);
cadr_status cadr_machine_display_full_copy(cadr_machine *machine,
                                           uint8_t *bytes, uint64_t capacity,
                                           uint64_t *out_written);
#endif

/* ABI 1.1 deterministic tracing; all output storage remains host-owned. */
cadr_status cadr_machine_trace_start(cadr_machine *machine,
                                     const cadr_trace_config *config);
cadr_status cadr_machine_trace_header(const cadr_machine *machine,
                                      uint8_t *bytes, uint64_t capacity,
                                      uint64_t *out_written);
cadr_status cadr_machine_trace_drain(cadr_machine *machine,
                                     uint8_t *bytes, uint64_t capacity,
                                     uint64_t *out_written,
                                     uint64_t *out_records);
cadr_status cadr_machine_trace_finish(cadr_machine *machine,
                                      const cadr_trace_finish_request *request);
cadr_status cadr_machine_trace_digest(const cadr_machine *machine,
                                      uint8_t digest[CADR_SHA256_BYTES]);
cadr_status cadr_machine_trace_count(const cadr_machine *machine,
                                     uint64_t *out_record_count);

/* Snapshot restore always constructs a fresh machine and publishes atomically. */
cadr_status cadr_machine_snapshot_size(cadr_machine *machine,
                                       const cadr_snapshot_request *request,
                                       uint64_t *out_byte_count);
cadr_status cadr_machine_snapshot_save(cadr_machine *machine,
                                       const cadr_snapshot_request *request,
                                       uint8_t *bytes, uint64_t capacity,
                                       uint64_t *out_written);
cadr_status cadr_machine_snapshot_restore(
    const cadr_snapshot_request *request,
    const uint8_t *bytes, uint64_t byte_count,
    cadr_machine **out_machine);

#ifdef __cplusplus
}
#endif

#endif

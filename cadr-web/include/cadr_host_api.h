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
#define CADR_ABI_MINOR UINT32_C(0)
#define CADR_SHA256_BYTES UINT32_C(32)

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
CADR_ABI_STATIC_ASSERT(sizeof(cadr_host_completion) == 48U, "cadr_host_completion layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_run_request) == 24U, "cadr_run_request layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_run_result) == 48U, "cadr_run_result layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_machine_info) == 88U, "cadr_machine_info layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_block_read_descriptor) == 16U, "block read descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_block_write_descriptor) == 24U, "block write descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_present_descriptor) == 24U, "present descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_audio_descriptor) == 24U, "audio descriptor layout");
CADR_ABI_STATIC_ASSERT(sizeof(cadr_network_descriptor) == 16U, "network descriptor layout");

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
cadr_status cadr_machine_cold_power_on(cadr_machine *machine);
cadr_status cadr_machine_boot(cadr_machine *machine);
cadr_status cadr_machine_reset(cadr_machine *machine,
                               const cadr_reset_request *request);

/* Hosts observe issued work here; they cannot create a request. */
cadr_status cadr_machine_next_host_request(cadr_machine *machine,
                                           cadr_host_request *out_request,
                                           uint8_t *descriptor_bytes,
                                           uint64_t descriptor_capacity);
cadr_status cadr_machine_complete_host_request(cadr_machine *machine,
                                               const cadr_host_completion *completion,
                                               const uint8_t *bytes,
                                               uint64_t byte_count);
cadr_status cadr_machine_run(cadr_machine *machine,
                             const cadr_run_request *request,
                             cadr_run_result *out_result);
cadr_status cadr_machine_query(cadr_machine *machine,
                               cadr_machine_info *out_info);

#ifdef __cplusplus
}
#endif

#endif

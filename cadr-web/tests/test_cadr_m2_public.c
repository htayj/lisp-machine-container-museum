#include "cadr_host_api.h"
#include "cadr_boundary_state.h"
#include "cadr_machine.h"
#include "cadr_state_v2.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static const uint8_t profile_sha256[CADR_SHA256_BYTES] = {
    0x1bU,0x8dU,0x63U,0xdbU,0x98U,0xacU,0xd4U,0x6eU,
    0x40U,0xadU,0xf9U,0x9aU,0x8aU,0x3cU,0xebU,0x5eU,
    0x05U,0x58U,0xd4U,0xacU,0x02U,0x7cU,0xb2U,0xcbU,
    0x4aU,0x43U,0x96U,0x65U,0xb1U,0x4bU,0x5dU,0x2aU
};

static const uint8_t artifact_sha256[CADR_SHA256_BYTES] = {
    0xe9U,0x6eU,0x6fU,0xf9U,0x03U,0xc2U,0x3cU,0xceU,
    0xa7U,0x07U,0xecU,0xe0U,0xe9U,0xa8U,0x72U,0xa8U,
    0xa7U,0x77U,0x71U,0xa6U,0x66U,0x3eU,0x3bU,0x91U,
    0x9eU,0xabU,0xa2U,0x1eU,0x22U,0xf2U,0xf9U,0x41U
};

static cadr_machine *booted_machine(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M1, (uint32_t)sizeof(config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine == NULL) return NULL;
    machine->state.artifacts.boot_configuration_ingressed = 1U;
    machine->state.artifacts.control_store_ingressed = 1U;
    machine->state.artifacts.base_disk_verified = 1U;
    CHECK(cadr_machine_cold_power_on(machine) == CADR_STATUS_OK);
    CHECK(cadr_machine_boot(machine) == CADR_STATUS_OK);
    return machine;
}

static cadr_snapshot_request snapshot_request(void)
{
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2,
        (uint32_t)sizeof(request), 0U
    };
    return request;
}

static cadr_trace_config trace_config(uint32_t transport)
{
    cadr_trace_config config;
    (void)memset(&config, 0, sizeof(config));
    config.abi_major = CADR_ABI_MAJOR;
    config.abi_minor = CADR_ABI_MINOR_M2;
    config.struct_size = (uint32_t)sizeof(config);
    config.ring_record_capacity = 8U;
    config.transport_mode = transport;
    config.selector_mask = CADR_TRACE_SELECTOR_KNOWN;
    config.event_mask = CADR_TRACE_EVENT_KNOWN;
    (void)memcpy(config.profile_sha256, profile_sha256, CADR_SHA256_BYTES);
    (void)memcpy(config.artifact_set_sha256, artifact_sha256, CADR_SHA256_BYTES);
    return config;
}

static uint64_t trace_fixture_word(uint32_t class_value, uint32_t low)
{
    return ((uint64_t)class_value << 43U) | low;
}

static int write_public_trace(cadr_machine *machine, const char *path,
                              uint64_t expected_records)
{
    uint8_t header[CADR_TRACE_HEADER_BYTES];
    uint8_t records[16384];
    uint64_t header_bytes = 0U;
    uint64_t record_bytes = 0U;
    uint64_t record_count = 0U;
    FILE *output = NULL;
    int ok = 0;
    if (machine == NULL || path == NULL ||
        cadr_machine_trace_header(machine, header, sizeof(header),
                                  &header_bytes) != CADR_STATUS_OK ||
        cadr_machine_trace_drain(machine, records, sizeof(records),
                                 &record_bytes, &record_count) !=
            CADR_STATUS_OK ||
        header_bytes != sizeof(header) || record_count != expected_records) {
        goto done;
    }
    output = fopen(path, "wb");
    if (output == NULL ||
        fwrite(header, 1U, sizeof(header), output) != sizeof(header) ||
        fwrite(records, 1U, (size_t)record_bytes, output) !=
            (size_t)record_bytes ||
        fclose(output) != 0) {
        output = NULL;
        goto done;
    }
    output = NULL;
    ok = 1;
done:
    if (output != NULL) (void)fclose(output);
    return ok ? 0 : 1;
}

static int emit_public_trace(const char *path)
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_finish_request finish = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish),
        CADR_TRACE_REASON_COMPLETE_HALT, 0U, 0U
    };
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run),
        0U, 1U
    };
    cadr_run_result result;
    int ok = 0;
    if (machine == NULL || path == NULL) goto done;

    /*
     * The fixture still uses the public trace and run ABI.  Direct state
     * access only primes a deterministic microinstruction: unconditional
     * JUMP with the halt control field set.  Clearing inhibit removes the
     * boot pipeline bubble, making the emitted boundary and HALT event real
     * results of the public cadr_machine_run call.
     */
    machine->state.cpu.inhibit = 0U;
    machine->state.cpu.prom_disabled = 1U;
    machine->state.cpu.p1 =
        trace_fixture_word(1U, (UINT32_C(1) << 10U) |
                           (UINT32_C(1) << 5U) | UINT32_C(7));
    machine->state.cpu.p1_imem = 1U;
    machine->state.cpu.next_micro_pc = 1U;
    config.ring_record_capacity = 16U;
    if (cadr_machine_trace_start(machine, &config) != CADR_STATUS_OK) goto done;
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    if (cadr_machine_run(machine, &run, &result) != CADR_STATUS_HALTED ||
        result.clock_slots_completed != 1U ||
        cadr_machine_trace_finish(machine, &finish) != CADR_STATUS_OK ||
        write_public_trace(machine, path, 4U) != 0) {
        goto done;
    }
    ok = 1;
done:
    cadr_machine_destroy(machine);
    return ok ? 0 : 1;
}

static int emit_public_completion_trace(const char *path)
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_finish_request finish = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish),
        CADR_TRACE_REASON_FAILURE, 0U, 0U
    };
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run),
        0U, 1U
    };
    cadr_run_result result;
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(0) };
    cadr_host_completion completion;
    cadr_host_completion rejected;
    int ok = 0;
    if (machine == NULL || path == NULL) goto done;
    config.ring_record_capacity = 16U;
    if (cadr_machine_trace_start(machine, &config) != CADR_STATUS_OK) goto done;
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    if (cadr_machine_run(machine, &run, &result) != CADR_STATUS_OK ||
        result.clock_slots_completed != 1U ||
        cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                        (const uint8_t *)&descriptor,
                                        sizeof(descriptor), 0U) !=
            CADR_STATUS_OK) {
        goto done;
    }
    (void)memset(&completion, 0, sizeof(completion));
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR_M2;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = machine->state.events.generation;
    completion.request_id = machine->state.events.outstanding_request_id;
    rejected = completion;
    rejected.generation += UINT64_C(1);
    if (cadr_machine_complete_host_request(machine, &rejected, NULL, 0U) !=
            CADR_STATUS_STALE_GENERATION ||
        cadr_machine_complete_host_request(machine, &completion, NULL, 0U) !=
            CADR_STATUS_OK ||
        cadr_machine_run(machine, &run, &result) !=
            CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        result.completions_applied != 1U ||
        cadr_machine_trace_finish(machine, &finish) != CADR_STATUS_OK ||
        write_public_trace(machine, path, 7U) != 0) {
        goto done;
    }
    ok = 1;
done:
    cadr_machine_destroy(machine);
    return ok ? 0 : 1;
}

static int completion_trace_digest(uint32_t transport,
                                   uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(transport);
    cadr_trace_finish_request finish = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish),
        CADR_TRACE_REASON_FAILURE, 0U, 0U
    };
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run),
        0U, 1U
    };
    cadr_run_result result;
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(0) };
    cadr_host_completion completion;
    cadr_host_completion rejected;
    int ok = 0;
    if (machine == NULL || digest == NULL) goto done;
    config.ring_record_capacity = 16U;
    config.event_mask = CADR_TRACE_EVENT_DEVICE;
    if (cadr_machine_trace_start(machine, &config) != CADR_STATUS_OK) goto done;
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    if (cadr_machine_run(machine, &run, &result) != CADR_STATUS_OK ||
        cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                        (const uint8_t *)&descriptor,
                                        sizeof(descriptor), 0U) !=
            CADR_STATUS_OK) {
        goto done;
    }
    (void)memset(&completion, 0, sizeof(completion));
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR_M2;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = machine->state.events.generation;
    completion.request_id = machine->state.events.outstanding_request_id;
    rejected = completion;
    rejected.generation += UINT64_C(1);
    if (cadr_machine_complete_host_request(machine, &rejected, NULL, 0U) !=
            CADR_STATUS_STALE_GENERATION ||
        cadr_machine_complete_host_request(machine, &completion, NULL, 0U) !=
            CADR_STATUS_OK ||
        cadr_machine_run(machine, &run, &result) !=
            CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        cadr_machine_trace_finish(machine, &finish) != CADR_STATUS_OK ||
        cadr_machine_trace_digest(machine, digest) != CADR_STATUS_OK) {
        goto done;
    }
    ok = 1;
done:
    cadr_machine_destroy(machine);
    return ok ? 0 : 1;
}

static void test_minor_negotiation(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M1, (uint32_t)sizeof(config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    cadr_machine_info info;
    cadr_snapshot_request request = snapshot_request();
    uint64_t count = 0U;
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    (void)memset(&info, 0, sizeof(info));
    info.abi_major = CADR_ABI_MAJOR;
    info.abi_minor = CADR_ABI_MINOR_M1;
    info.struct_size = (uint32_t)sizeof(info);
    CHECK(cadr_machine_query(machine, &info) == CADR_STATUS_OK);
    CHECK(info.abi_minor == CADR_ABI_MINOR_M1);
    request.abi_minor = CADR_ABI_MINOR_M1;
    CHECK(cadr_machine_snapshot_size(machine, &request, &count) ==
          CADR_STATUS_ABI_MISMATCH);
    config.abi_minor = CADR_ABI_MINOR + 1U;
    cadr_machine_destroy(machine);
    machine = NULL;
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_ABI_MISMATCH);
    CHECK(machine == NULL);
}

static void test_m2_cache_is_lazy_and_reset_preserves_active_trace(void)
{
    cadr_machine *machine = booted_machine();
    cadr_snapshot_request snapshot = snapshot_request();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_reset_request reset = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(reset), 0U
    };
    uint64_t snapshot_size = 0U;
    uint64_t record_count = 0U;
    uint64_t clock_before;
    if (machine == NULL) return;

    /* M1 lifecycle work must not construct M2's full-RAM cache. */
    CHECK(machine->state.trace.state_v2.initialized == 0U);
    CHECK(cadr_machine_snapshot_size(machine, &snapshot, &snapshot_size) ==
          CADR_STATUS_OK);
    CHECK(snapshot_size != 0U);
    CHECK(machine->state.trace.state_v2.initialized != 0U);

    CHECK(cadr_machine_trace_start(machine, &config) == CADR_STATUS_OK);
    clock_before = machine->state.clock_slots_completed;
    CHECK(cadr_machine_reset(machine, &reset) == CADR_STATUS_NOT_READY);
    CHECK(machine->state.clock_slots_completed == clock_before);
    CHECK(cadr_machine_trace_count(machine, &record_count) == CADR_STATUS_OK);
    CHECK(record_count == 1U);
    cadr_machine_destroy(machine);
}

static void test_snapshot_fresh_restore_pending_and_queued(void)
{
    cadr_machine *source = booted_machine();
    cadr_machine *first = NULL;
    cadr_machine *second = NULL;
    cadr_machine *queued = NULL;
    cadr_snapshot_request request = snapshot_request();
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(0) };
    cadr_host_completion completion;
    uint8_t digest_source[CADR_SHA256_BYTES];
    uint8_t digest_first[CADR_SHA256_BYTES];
    uint8_t digest_state2[CADR_SHA256_BYTES];
    uint8_t *bytes;
    uint64_t size = 0U;
    uint64_t written = 0U;
    if (source == NULL) return;
    CHECK(cadr_machine_issue_host_request(source, CADR_HOST_OPERATION_NETWORK,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor), 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_snapshot_size(source, &request, &size) == CADR_STATUS_OK);
    bytes = malloc((size_t)size);
    CHECK(bytes != NULL);
    if (bytes == NULL) {
        cadr_machine_destroy(source);
        return;
    }
    CHECK(cadr_machine_snapshot_save(source, &request, bytes, size, &written) ==
          CADR_STATUS_OK);
    CHECK(written == size);
    CHECK(cadr_machine_boundary_digest(source, digest_source) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(&source->state, digest_state2) == CADR_STATUS_OK);
    CHECK(memcmp(bytes + 168U, digest_source, CADR_SHA256_BYTES) == 0);
    CHECK(memcmp(bytes + 200U, digest_state2, CADR_SHA256_BYTES) == 0);
    CHECK(cadr_machine_snapshot_restore(&request, bytes, size, &first) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_snapshot_restore(&request, bytes, size, &second) ==
          CADR_STATUS_OK);
    CHECK(first != NULL && second != NULL && first != second && first != source);
    CHECK(first->state.events.outstanding_request_id ==
          source->state.events.outstanding_request_id);
    CHECK(second->state.events.request_descriptor_byte_count ==
          sizeof(descriptor));
    CHECK(cadr_machine_boundary_digest(first, digest_first) == CADR_STATUS_OK);
    CHECK(memcmp(digest_source, digest_first, sizeof(digest_source)) == 0);

    (void)memset(&completion, 0, sizeof(completion));
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR_M1;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = source->state.events.generation;
    completion.request_id = source->state.events.outstanding_request_id;
    CHECK(cadr_machine_complete_host_request(source, &completion, NULL, 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_snapshot_save(source, &request, bytes, size, &written) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_snapshot_restore(&request, bytes, written, &queued) ==
          CADR_STATUS_OK);
    CHECK(queued != NULL);
    if (queued != NULL) {
        CHECK(queued->state.events.completion_queued == 1U);
        CHECK(queued->state.events.completion_byte_count == 0U);
        CHECK(queued->state.events.completion_bytes == NULL);
    }
    free(bytes);
    cadr_machine_destroy(source);
    cadr_machine_destroy(first);
    cadr_machine_destroy(second);
    cadr_machine_destroy(queued);
}

static void test_public_trace_identity_and_transport(void)
{
    cadr_machine *full = booted_machine();
    cadr_machine *hash = booted_machine();
    cadr_trace_config full_config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_config hash_config = trace_config(CADR_TRACE_TRANSPORT_HASH_ONLY);
    cadr_trace_finish_request finish = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish),
        CADR_TRACE_REASON_COMPLETE_LIMIT, 0U, 0U
    };
    uint8_t full_digest[CADR_SHA256_BYTES];
    uint8_t hash_digest[CADR_SHA256_BYTES];
    uint8_t header[CADR_TRACE_HEADER_BYTES];
    uint8_t records[4096];
    uint64_t written = 0U;
    uint64_t count = 0U;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run),
        0U, 1U
    };
    cadr_run_result full_result;
    cadr_run_result hash_result;
    if (full == NULL || hash == NULL) {
        cadr_machine_destroy(full);
        cadr_machine_destroy(hash);
        return;
    }
    full_config.ring_record_capacity = 5U;
    CHECK(cadr_machine_trace_start(full, &full_config) ==
          CADR_STATUS_INVALID_ARGUMENT);
    full_config.ring_record_capacity = 8U;
    full_config.profile_sha256[0] ^= UINT8_C(1);
    CHECK(cadr_machine_trace_start(full, &full_config) ==
          CADR_STATUS_PROFILE_MISMATCH);
    full_config.profile_sha256[0] ^= UINT8_C(1);
    CHECK(cadr_machine_trace_start(full, &full_config) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_start(hash, &hash_config) == CADR_STATUS_OK);
    (void)memset(&full_result, 0, sizeof(full_result));
    full_result.abi_major = CADR_ABI_MAJOR;
    full_result.abi_minor = CADR_ABI_MINOR_M2;
    full_result.struct_size = (uint32_t)sizeof(full_result);
    hash_result = full_result;
    CHECK(cadr_machine_run(full, &run, &full_result) == CADR_STATUS_OK);
    CHECK(cadr_machine_run(hash, &run, &hash_result) == CADR_STATUS_OK);
    CHECK(full_result.clock_slots_completed == 1U);
    CHECK(memcmp(&full_result, &hash_result, sizeof(full_result)) == 0);
    CHECK(cadr_machine_trace_header(full, header, sizeof(header), &written) ==
          CADR_STATUS_OK);
    CHECK(written == CADR_TRACE_HEADER_BYTES);
    CHECK(cadr_machine_trace_finish(full, &finish) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_finish(hash, &finish) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(full, full_digest) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(hash, hash_digest) == CADR_STATUS_OK);
    CHECK(memcmp(full_digest, hash_digest, sizeof(full_digest)) == 0);
    CHECK(cadr_machine_trace_count(full, &count) == CADR_STATUS_OK);
    CHECK(count == 3U);
    CHECK(cadr_machine_trace_drain(full, records, sizeof(records), &written,
                                   &count) == CADR_STATUS_OK);
    CHECK(count == 3U && written != 0U);
    cadr_machine_destroy(full);
    cadr_machine_destroy(hash);
}

static void test_trace_start_rejects_pending_request(void)
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(0) };
    if (machine == NULL) return;
    CHECK(cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor), 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_trace_start(machine, &config) == CADR_STATUS_NOT_READY);
    cadr_machine_destroy(machine);
}

static void test_preboundary_host_events_are_retryable(void)
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(0) };
    cadr_host_completion completion;
    uint8_t before[CADR_SHA256_BYTES];
    uint8_t after[CADR_SHA256_BYTES];
    if (machine == NULL) return;
    CHECK(cadr_machine_trace_start(machine, &config) == CADR_STATUS_OK);
    CHECK(cadr_machine_boundary_digest(machine, before) == CADR_STATUS_OK);
    CHECK(cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor), 0U) ==
          CADR_STATUS_NOT_READY);
    (void)memset(&completion, 0, sizeof(completion));
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR_M2;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = 1U;
    completion.request_id = 1U;
    CHECK(cadr_machine_complete_host_request(machine, &completion, NULL, 0U) ==
          CADR_STATUS_NOT_READY);
    CHECK(machine->state.events.outstanding_request_id == 0U);
    CHECK(machine->state.events.completion_queued == 0U);
    CHECK(machine->state.in_host_completion == 0U);
    CHECK(cadr_machine_boundary_digest(machine, after) == CADR_STATUS_OK);
    CHECK(memcmp(before, after, sizeof(before)) == 0);
    cadr_machine_destroy(machine);
}

static void test_completion_trace_transport_parity(void)
{
    uint8_t full[CADR_SHA256_BYTES];
    uint8_t hash[CADR_SHA256_BYTES];
    CHECK(completion_trace_digest(CADR_TRACE_TRANSPORT_FULL, full) == 0);
    CHECK(completion_trace_digest(CADR_TRACE_TRANSPORT_HASH_ONLY, hash) == 0);
    CHECK(memcmp(full, hash, sizeof(full)) == 0);
}

static void test_trace_backpressure_is_nonmutating(void)
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run),
        0U, 1U
    };
    cadr_run_result result;
    uint8_t before[CADR_SHA256_BYTES];
    uint8_t after[CADR_SHA256_BYTES];
    uint8_t trace_before[CADR_SHA256_BYTES];
    uint8_t trace_after[CADR_SHA256_BYTES];
    uint8_t records[16384];
    uint64_t written = 0U;
    uint64_t count = 0U;
    if (machine == NULL) return;
    config.ring_record_capacity = 1U;
    config.event_mask = 0U;
    CHECK(cadr_machine_trace_start(machine, &config) == CADR_STATUS_OK);
    CHECK(cadr_machine_boundary_digest(machine, before) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(machine, trace_before) == CADR_STATUS_OK);
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_NOT_READY);
    CHECK(result.clock_slots_completed == 0U);
    CHECK(cadr_machine_boundary_digest(machine, after) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(machine, trace_after) == CADR_STATUS_OK);
    CHECK(memcmp(before, after, sizeof(before)) == 0);
    CHECK(memcmp(trace_before, trace_after, sizeof(trace_before)) == 0);
    CHECK(cadr_machine_trace_drain(machine, records, sizeof(records), &written,
                                   &count) == CADR_STATUS_OK);
    CHECK(count == 1U && written != 0U);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(result.clock_slots_completed == 1U);
    cadr_machine_destroy(machine);
}

static void test_finished_trace_rejects_later_public_run(void)
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_finish_request finish = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish),
        CADR_TRACE_REASON_COMPLETE_LIMIT, 0U, 0U
    };
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run), 0U, 1U
    };
    cadr_run_result result;
    uint8_t state_before[CADR_SHA256_BYTES];
    uint8_t state_after[CADR_SHA256_BYTES];
    uint8_t digest_before[CADR_SHA256_BYTES];
    uint8_t digest_after[CADR_SHA256_BYTES];
    uint8_t records[16384];
    uint64_t written = 0U;
    uint64_t count_before = 0U;
    uint64_t count_after = 0U;
    uint64_t drained = 0U;
    if (machine == NULL) return;

    config.event_mask = 0U;
    config.ring_record_capacity = 2U;
    CHECK(cadr_machine_trace_start(machine, &config) == CADR_STATUS_OK);
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_drain(machine, records, sizeof(records), &written,
                                   &drained) == CADR_STATUS_OK);
    CHECK(drained == 2U);
    CHECK(cadr_machine_trace_finish(machine, &finish) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(&machine->state, state_before) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(machine, digest_before) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_count(machine, &count_before) == CADR_STATUS_OK);

    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_NOT_READY);
    CHECK(result.clock_slots_completed == 0U);
    CHECK(cadr_state_v2_digest(&machine->state, state_after) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(machine, digest_after) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_count(machine, &count_after) == CADR_STATUS_OK);
    CHECK(memcmp(state_before, state_after, sizeof(state_before)) == 0);
    CHECK(memcmp(digest_before, digest_after, sizeof(digest_before)) == 0);
    CHECK(count_before == count_after);

    CHECK(cadr_machine_trace_drain(machine, records, sizeof(records), &written,
                                   &drained) == CADR_STATUS_OK);
    CHECK(drained == 1U && written != 0U);
    CHECK(((uint16_t)records[4] | ((uint16_t)records[5] << 8U)) == 3U);
    cadr_machine_destroy(machine);
}

static void test_finished_trace_blocks_host_ingress(uint64_t event_mask)
{
    cadr_machine *issue_machine = booted_machine();
    cadr_machine *completion_machine = booted_machine();
    cadr_trace_config issue_config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_config completion_config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_finish_request finish = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish),
        CADR_TRACE_REASON_COMPLETE_LIMIT, 0U, 0U
    };
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run), 0U, 1U
    };
    cadr_run_result result;
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(0) };
    cadr_host_completion completion;
    uint8_t state_before[CADR_SHA256_BYTES];
    uint8_t state_after[CADR_SHA256_BYTES];
    uint8_t digest_before[CADR_SHA256_BYTES];
    uint8_t digest_after[CADR_SHA256_BYTES];
    uint64_t count_before = 0U;
    uint64_t count_after = 0U;
    if (issue_machine == NULL || completion_machine == NULL) {
        cadr_machine_destroy(issue_machine);
        cadr_machine_destroy(completion_machine);
        return;
    }
    issue_config.event_mask = event_mask;
    issue_config.ring_record_capacity = 3U;
    completion_config.event_mask = event_mask;
    completion_config.ring_record_capacity = event_mask == CADR_TRACE_EVENT_DEVICE
        ? 4U : 3U;

    CHECK(cadr_machine_trace_start(issue_machine, &issue_config) == CADR_STATUS_OK);
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    CHECK(cadr_machine_run(issue_machine, &run, &result) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_finish(issue_machine, &finish) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(&issue_machine->state, state_before) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(issue_machine, digest_before) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_count(issue_machine, &count_before) == CADR_STATUS_OK);
    CHECK(cadr_machine_issue_host_request(
              issue_machine, CADR_HOST_OPERATION_NETWORK,
              (const uint8_t *)&descriptor, sizeof(descriptor), 0U) ==
          CADR_STATUS_NOT_READY);
    CHECK(cadr_state_v2_digest(&issue_machine->state, state_after) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(issue_machine, digest_after) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_count(issue_machine, &count_after) == CADR_STATUS_OK);
    CHECK(memcmp(state_before, state_after, sizeof(state_before)) == 0);
    CHECK(memcmp(digest_before, digest_after, sizeof(digest_before)) == 0);
    CHECK(count_before == count_after);

    CHECK(cadr_machine_trace_start(completion_machine, &completion_config) ==
          CADR_STATUS_OK);
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    CHECK(cadr_machine_run(completion_machine, &run, &result) == CADR_STATUS_OK);
    CHECK(cadr_machine_issue_host_request(
              completion_machine, CADR_HOST_OPERATION_NETWORK,
              (const uint8_t *)&descriptor, sizeof(descriptor), 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_trace_finish(completion_machine, &finish) == CADR_STATUS_OK);
    (void)memset(&completion, 0, sizeof(completion));
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR_M2;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = completion_machine->state.events.generation;
    completion.request_id = completion_machine->state.events.outstanding_request_id;
    CHECK(cadr_state_v2_digest(&completion_machine->state, state_before) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(completion_machine, digest_before) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_trace_count(completion_machine, &count_before) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_complete_host_request(completion_machine, &completion,
                                             NULL, 0U) == CADR_STATUS_NOT_READY);
    CHECK(cadr_state_v2_digest(&completion_machine->state, state_after) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(completion_machine, digest_after) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_trace_count(completion_machine, &count_after) ==
          CADR_STATUS_OK);
    CHECK(memcmp(state_before, state_after, sizeof(state_before)) == 0);
    CHECK(memcmp(digest_before, digest_after, sizeof(digest_before)) == 0);
    CHECK(count_before == count_after);
    CHECK(completion_machine->state.events.completion_queued == 0U);
    cadr_machine_destroy(issue_machine);
    cadr_machine_destroy(completion_machine);
}

static void test_completion_apply_backpressure_is_nonmutating(void)
{
    cadr_machine *machine = booted_machine();
    cadr_trace_config config = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(0) };
    cadr_host_completion completion;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run),
        0U, 1U
    };
    cadr_run_result result;
    uint8_t before[CADR_SHA256_BYTES];
    uint8_t after[CADR_SHA256_BYTES];
    uint8_t trace_before[CADR_SHA256_BYTES];
    uint8_t trace_after[CADR_SHA256_BYTES];
    uint8_t records[8192];
    uint64_t written = 0U;
    uint64_t count = 0U;
    if (machine == NULL) return;
    config.ring_record_capacity = 4U;
    config.event_mask = CADR_TRACE_EVENT_DEVICE;
    CHECK(cadr_machine_trace_start(machine, &config) == CADR_STATUS_OK);
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_OK);
    CHECK(cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor), 0U) ==
          CADR_STATUS_OK);
    (void)memset(&completion, 0, sizeof(completion));
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR_M2;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = machine->state.events.generation;
    completion.request_id = machine->state.events.outstanding_request_id;
    CHECK(cadr_machine_complete_host_request(machine, &completion, NULL, 0U) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_boundary_digest(machine, before) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(machine, trace_before) == CADR_STATUS_OK);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_NOT_READY);
    CHECK(result.completions_applied == 0U);
    CHECK(machine->state.events.completion_queued == 1U);
    CHECK(cadr_machine_boundary_digest(machine, after) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_digest(machine, trace_after) == CADR_STATUS_OK);
    CHECK(memcmp(before, after, sizeof(before)) == 0);
    CHECK(memcmp(trace_before, trace_after, sizeof(trace_before)) == 0);
    CHECK(cadr_machine_trace_drain(machine, records, sizeof(records), &written,
                                   &count) == CADR_STATUS_OK);
    CHECK(count == 4U && written != 0U);
    CHECK(cadr_machine_run(machine, &run, &result) ==
          CADR_STATUS_UNIMPLEMENTED_DEVICE);
    CHECK(result.completions_applied == 1U);
    cadr_machine_destroy(machine);
}

static void test_restored_continuation_trace_is_identical(void)
{
    cadr_machine *source = booted_machine();
    cadr_machine *restored = NULL;
    cadr_snapshot_request snapshot = snapshot_request();
    cadr_trace_config source_trace = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_config restored_trace = trace_config(CADR_TRACE_TRANSPORT_FULL);
    cadr_trace_finish_request finish = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish),
        CADR_TRACE_REASON_COMPLETE_LIMIT, 0U, 0U
    };
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run),
        0U, 2U
    };
    cadr_run_result source_result;
    cadr_run_result restored_result;
    uint8_t *snapshot_bytes;
    uint8_t source_records[16384];
    uint8_t restored_records[16384];
    uint8_t source_header[CADR_TRACE_HEADER_BYTES];
    uint8_t restored_header[CADR_TRACE_HEADER_BYTES];
    uint64_t snapshot_size = 0U;
    uint64_t written = 0U;
    uint64_t source_written = 0U;
    uint64_t restored_written = 0U;
    uint64_t source_count = 0U;
    uint64_t restored_count = 0U;
    if (source == NULL) return;
    source_trace.ring_record_capacity = 16U;
    restored_trace.ring_record_capacity = 16U;
    CHECK(cadr_machine_snapshot_size(source, &snapshot, &snapshot_size) ==
          CADR_STATUS_OK);
    snapshot_bytes = malloc((size_t)snapshot_size);
    CHECK(snapshot_bytes != NULL);
    if (snapshot_bytes == NULL) {
        cadr_machine_destroy(source);
        return;
    }
    CHECK(cadr_machine_snapshot_save(source, &snapshot, snapshot_bytes,
                                     snapshot_size, &written) == CADR_STATUS_OK);
    CHECK(cadr_machine_snapshot_restore(&snapshot, snapshot_bytes, written,
                                        &restored) == CADR_STATUS_OK);
    free(snapshot_bytes);
    if (restored == NULL) {
        cadr_machine_destroy(source);
        return;
    }
    CHECK(cadr_machine_trace_start(source, &source_trace) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_start(restored, &restored_trace) == CADR_STATUS_OK);
    (void)memset(&source_result, 0, sizeof(source_result));
    source_result.abi_major = CADR_ABI_MAJOR;
    source_result.abi_minor = CADR_ABI_MINOR_M2;
    source_result.struct_size = (uint32_t)sizeof(source_result);
    restored_result = source_result;
    CHECK(cadr_machine_run(source, &run, &source_result) == CADR_STATUS_OK);
    CHECK(cadr_machine_run(restored, &run, &restored_result) == CADR_STATUS_OK);
    CHECK(memcmp(&source_result, &restored_result, sizeof(source_result)) == 0);
    CHECK(cadr_machine_trace_finish(source, &finish) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_finish(restored, &finish) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_header(source, source_header,
                                    sizeof(source_header), &written) ==
          CADR_STATUS_OK);
    CHECK(cadr_machine_trace_header(restored, restored_header,
                                    sizeof(restored_header), &written) ==
          CADR_STATUS_OK);
    CHECK(memcmp(source_header, restored_header, sizeof(source_header)) == 0);
    CHECK(cadr_machine_trace_drain(source, source_records,
                                   sizeof(source_records), &source_written,
                                   &source_count) == CADR_STATUS_OK);
    CHECK(cadr_machine_trace_drain(restored, restored_records,
                                   sizeof(restored_records), &restored_written,
                                   &restored_count) == CADR_STATUS_OK);
    CHECK(source_written == restored_written);
    CHECK(source_count == restored_count);
    CHECK(memcmp(source_records, restored_records,
                 (size_t)source_written) == 0);
    cadr_machine_destroy(source);
    cadr_machine_destroy(restored);
}

int main(int argc, char **argv)
{
    if (argc == 3 && strcmp(argv[1], "--emit") == 0) {
        return emit_public_trace(argv[2]);
    }
    if (argc == 3 && strcmp(argv[1], "--emit-completion") == 0) {
        return emit_public_completion_trace(argv[2]);
    }
    if (argc != 1) return 2;
    test_minor_negotiation();
    test_m2_cache_is_lazy_and_reset_preserves_active_trace();
    test_snapshot_fresh_restore_pending_and_queued();
    test_public_trace_identity_and_transport();
    test_trace_start_rejects_pending_request();
    test_preboundary_host_events_are_retryable();
    test_completion_trace_transport_parity();
    test_trace_backpressure_is_nonmutating();
    test_finished_trace_rejects_later_public_run();
    test_finished_trace_blocks_host_ingress(0U);
    test_finished_trace_blocks_host_ingress(CADR_TRACE_EVENT_DEVICE);
    test_completion_apply_backpressure_is_nonmutating();
    test_restored_continuation_trace_is_identical();
    if (failures != 0) return 1;
    (void)puts("cadr_m2_public: ok");
    return 0;
}

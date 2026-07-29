#define _POSIX_C_SOURCE 200809L
#include "cadr_host_api.h"

#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

static const uint8_t profile_sha256[CADR_SHA256_BYTES] = {
    0x1bU,0x8dU,0x63U,0xdbU,0x98U,0xacU,0xd4U,0x6eU,0x40U,0xadU,0xf9U,0x9aU,0x8aU,0x3cU,0xebU,0x5eU,
    0x05U,0x58U,0xd4U,0xacU,0x02U,0x7cU,0xb2U,0xcbU,0x4aU,0x43U,0x96U,0x65U,0xb1U,0x4bU,0x5dU,0x2aU
};
static const uint8_t artifact_sha256[CADR_SHA256_BYTES] = {
    0xe9U,0x6eU,0x6fU,0xf9U,0x03U,0xc2U,0x3cU,0xceU,0xa7U,0x07U,0xecU,0xe0U,0xe9U,0xa8U,0x72U,0xa8U,
    0xa7U,0x77U,0x71U,0xa6U,0x66U,0x3eU,0x3bU,0x91U,0x9eU,0xabU,0xa2U,0x1eU,0x22U,0xf2U,0xf9U,0x41U
};

int main(int argc, char **argv)
{
    cadr_snapshot_request sr = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M3, (uint32_t)sizeof(sr), 0U };
    cadr_trace_config tc;
    cadr_trace_finish_request finish = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(finish), CADR_TRACE_REASON_COMPLETE_LIMIT, 0U, 0U };
    cadr_run_request run = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run), 0U, 0U };
    cadr_run_result rr = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(rr), 0U, 0U, 0U, 0U, 0U };
    cadr_machine_info info = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(info), 0U,
        0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U
    };
    cadr_machine *machine = NULL;
    FILE *input = NULL, *output = NULL, *raw_output = NULL;
    uint8_t *snapshot = NULL, digest[CADR_SHA256_BYTES];
    uint8_t *trace_bytes = NULL;
    struct stat stat_before;
    uint64_t count, slots, index, size, written, records;
    uint32_t mode;
    char *end;
    int result = 1;
    if (argc != 5 && argc != 6) {
        return 2;
    }
    errno = 0;
    mode = (uint32_t)strtoul(argv[1], &end, 10);
    if (errno != 0 || argv[1][0] == '\0' || *end != '\0' || mode > 1U) {
        return 2;
    }
    errno = 0;
    slots = strtoull(argv[3], &end, 10);
    if (errno != 0 || argv[3][0] == '\0' || *end != '\0' || slots == 0U) {
        return 2;
    }
    input = fopen(argv[2], "rb");
    if (input == NULL || fstat(fileno(input), &stat_before) != 0 ||
        stat_before.st_size <= 0) {
        goto done;
    }
    size = (uint64_t)stat_before.st_size;
    if (size > (uint64_t)SIZE_MAX) {
        goto done;
    }
    snapshot = malloc((size_t)size);
    if (snapshot == NULL || fread(snapshot, 1U, (size_t)size, input) != (size_t)size ||
        cadr_machine_snapshot_restore(&sr, snapshot, size, &machine) != CADR_STATUS_OK ||
        cadr_machine_query(machine, &info) != CADR_STATUS_OK) {
        goto done;
    }
    (void)memset(&tc, 0, sizeof(tc));
    tc.abi_major = CADR_ABI_MAJOR;
    tc.abi_minor = CADR_ABI_MINOR_M2;
    tc.struct_size = (uint32_t)sizeof(tc);
    tc.first_boundary = info.clock_slots_completed;
    tc.selector_mask = CADR_TRACE_SELECTOR_KNOWN;
    tc.event_mask = CADR_TRACE_EVENT_KNOWN;
    tc.ring_record_capacity = 512U;
    tc.transport_mode = mode;
    (void)memcpy(tc.profile_sha256, profile_sha256, sizeof(profile_sha256));
    (void)memcpy(tc.artifact_set_sha256, artifact_sha256, sizeof(artifact_sha256));
    if (cadr_machine_trace_start(machine, &tc) != CADR_STATUS_OK) {
        goto done;
    }
    run.clock_slot_budget = slots;
    if (cadr_machine_run(machine, &run, &rr) != CADR_STATUS_OK ||
        rr.clock_slots_completed != slots) {
        goto done;
    }
    if (cadr_machine_trace_finish(machine,&finish) != CADR_STATUS_OK ||
        cadr_machine_trace_count(machine,&count) != CADR_STATUS_OK ||
        cadr_machine_trace_digest(machine,digest) != CADR_STATUS_OK) {
        goto done;
    }
    if (argc == 6) {
        trace_bytes = malloc(UINT32_C(1048576));
        raw_output = fopen(argv[5], "wb");
        if (trace_bytes == NULL || raw_output == NULL ||
            cadr_machine_trace_header(machine, trace_bytes, UINT32_C(1048576),
                                      &written) != CADR_STATUS_OK ||
            fwrite(trace_bytes, 1U, (size_t)written, raw_output) != (size_t)written ||
            cadr_machine_trace_drain(machine, trace_bytes, UINT32_C(1048576),
                                     &written, &records) != CADR_STATUS_OK ||
            records != count ||
            fwrite(trace_bytes, 1U, (size_t)written, raw_output) != (size_t)written ||
            fclose(raw_output) != 0) {
            raw_output = NULL;
            goto done;
        }
        raw_output = NULL;
    }
    output = fopen(argv[4], "wb");
    if (output == NULL || fprintf(output, "%" PRIu64 " ", count) < 0) {
        goto done;
    }
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        if (fprintf(output, "%02x", digest[index]) < 0) {
            goto done;
        }
    }
    if (fputc('\n', output) == EOF || fclose(output) != 0) {
        output = NULL;
        goto done;
    }
    output = NULL;
    result = 0;
done:
    if (output != NULL) {
        (void)fclose(output);
    }
    if (input != NULL) {
        (void)fclose(input);
    }
    if (raw_output != NULL) {
        (void)fclose(raw_output);
    }
    free(snapshot);
    free(trace_bytes);
    cadr_machine_destroy(machine);
    return result;
}

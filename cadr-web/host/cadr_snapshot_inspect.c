#include "cadr_host_api.h"

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

static int read_file(const char *path, uint8_t **out_bytes, uint64_t *out_count)
{
    FILE *stream;
    long end;
    uint8_t *bytes;
    size_t count;
    *out_bytes = NULL;
    *out_count = 0U;
    stream = fopen(path, "rb");
    if (stream == NULL) return 0;
    if (fseek(stream, 0L, SEEK_END) != 0) {
        (void)fclose(stream);
        return 0;
    }
    end = ftell(stream);
    if (end < 0L || fseek(stream, 0L, SEEK_SET) != 0) {
        (void)fclose(stream);
        return 0;
    }
    count = (size_t)end;
    bytes = malloc(count == 0U ? 1U : count);
    if (bytes == NULL) {
        (void)fclose(stream);
        return 0;
    }
    if (count != 0U && fread(bytes, 1U, count, stream) != count) {
        free(bytes);
        (void)fclose(stream);
        return 0;
    }
    if (fclose(stream) != 0) {
        free(bytes);
        return 0;
    }
    *out_bytes = bytes;
    *out_count = (uint64_t)count;
    return 1;
}

int main(int argc, char **argv)
{
    cadr_snapshot_request request = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2,
        (uint32_t)sizeof(request), 0U
    };
    cadr_machine_info info;
    cadr_machine *machine = NULL;
    uint8_t *bytes;
    uint64_t count;
    cadr_status status;
    if (argc != 2) {
        (void)fprintf(stderr, "usage: %s SNAPSHOT.cdrsnap1\n", argv[0]);
        return 2;
    }
    if (!read_file(argv[1], &bytes, &count)) {
        (void)fprintf(stderr, "%s: read failed (errno=%d)\n", argv[1], errno);
        return 1;
    }
    status = cadr_machine_snapshot_restore(&request, bytes, count, &machine);
    free(bytes);
    if (status != CADR_STATUS_OK) {
        (void)fprintf(stderr, "%s: invalid snapshot (status=%u)\n",
                      argv[1], status);
        return 1;
    }
    info.abi_major = CADR_ABI_MAJOR;
    info.abi_minor = CADR_ABI_MINOR_M2;
    info.struct_size = (uint32_t)sizeof(info);
    status = cadr_machine_query(machine, &info);
    if (status == CADR_STATUS_OK) {
        (void)printf(
            "lifecycle=%u clock_slots=%llu microinstructions=%llu "
            "generation=%llu outstanding_request=%llu operation=%u queued=%u\n",
            info.lifecycle,
            (unsigned long long)info.clock_slots_completed,
            (unsigned long long)info.microinstructions_executed,
            (unsigned long long)info.generation,
            (unsigned long long)info.outstanding_request_id,
            info.outstanding_operation, info.completion_queued);
    }
    cadr_machine_destroy(machine);
    return status == CADR_STATUS_OK ? 0 : 1;
}

#define _FILE_OFFSET_BITS 64
#define _POSIX_C_SOURCE 200809L

#include "cadr_m4_file_range_reader.h"

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stddef.h>
#include <stdint.h>
#include <sys/stat.h>
#include <unistd.h>

cadr_status cadr_m4_file_range_reader_open(
    cadr_m4_file_range_reader *reader, const char *path,
    uint64_t expected_byte_count)
{
    struct stat metadata;
    int descriptor;
    if (reader == NULL || path == NULL || expected_byte_count == 0U ||
        expected_byte_count > (uint64_t)INT64_MAX) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    reader->descriptor = -1;
    reader->byte_count = 0U;
    descriptor = open(path, O_RDONLY);
    if (descriptor < 0) return CADR_STATUS_HOST_FAILURE;
    if (fstat(descriptor, &metadata) != 0 || !S_ISREG(metadata.st_mode) ||
        metadata.st_size <= 0 ||
        (uint64_t)metadata.st_size != expected_byte_count) {
        (void)close(descriptor);
        return CADR_STATUS_ARTIFACT_MISMATCH;
    }
    reader->descriptor = descriptor;
    reader->byte_count = expected_byte_count;
    return CADR_STATUS_OK;
}

cadr_status cadr_m4_file_range_reader_read(
    void *context, uint64_t byte_offset, uint8_t *out_bytes,
    uint64_t byte_count)
{
    cadr_m4_file_range_reader *reader = context;
    uint64_t completed = 0U;
    if (reader == NULL || reader->descriptor < 0 || out_bytes == NULL ||
        byte_offset > reader->byte_count ||
        byte_count > reader->byte_count - byte_offset ||
        byte_offset > (uint64_t)INT64_MAX ||
        byte_count > (uint64_t)SSIZE_MAX) {
        return CADR_STATUS_HOST_FAILURE;
    }
    while (completed < byte_count) {
        const ssize_t result = pread(
            reader->descriptor, out_bytes + (size_t)completed,
            (size_t)(byte_count - completed),
            (off_t)(byte_offset + completed));
        if (result < 0 && errno == EINTR) continue;
        if (result <= 0) return CADR_STATUS_HOST_FAILURE;
        completed += (uint64_t)result;
    }
    return CADR_STATUS_OK;
}

void cadr_m4_file_range_reader_close(cadr_m4_file_range_reader *reader)
{
    if (reader == NULL) return;
    if (reader->descriptor >= 0) (void)close(reader->descriptor);
    reader->descriptor = -1;
    reader->byte_count = 0U;
}

#ifndef CADR_M4_FILE_RANGE_READER_H
#define CADR_M4_FILE_RANGE_READER_H

#include "cadr_host_api.h"

#include <stdint.h>

typedef struct cadr_m4_file_range_reader {
    int descriptor;
    uint64_t byte_count;
} cadr_m4_file_range_reader;

cadr_status cadr_m4_file_range_reader_open(
    cadr_m4_file_range_reader *reader, const char *path,
    uint64_t expected_byte_count);

cadr_status cadr_m4_file_range_reader_read(
    void *context, uint64_t byte_offset, uint8_t *out_bytes,
    uint64_t byte_count);

void cadr_m4_file_range_reader_close(cadr_m4_file_range_reader *reader);

#endif

#include "cadr_m4_media.h"

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define CADR_M4_MEDIA_COMPARE_MAX_BYTES (UINT64_C(64) * UINT64_C(1024) * UINT64_C(1024))

static int read_file(const char *path, uint8_t **out_bytes, uint64_t *out_count)
{
    FILE *stream;
    long end;
    size_t byte_count;
    uint8_t *bytes;
    *out_bytes = NULL;
    *out_count = 0U;
    stream = fopen(path, "rb");
    if (stream == NULL) return 0;
    if (fseek(stream, 0L, SEEK_END) != 0 || (end = ftell(stream)) < 0L ||
        fseek(stream, 0L, SEEK_SET) != 0 || (uint64_t)end > CADR_M4_MEDIA_COMPARE_MAX_BYTES ||
        (uint64_t)end > (uint64_t)SIZE_MAX) {
        (void)fclose(stream);
        return 0;
    }
    byte_count = (size_t)end;
    bytes = malloc(byte_count == 0U ? 1U : byte_count);
    if (bytes == NULL) {
        (void)fclose(stream);
        return 0;
    }
    if ((byte_count != 0U && fread(bytes, 1U, byte_count, stream) != byte_count) ||
        fclose(stream) != 0) {
        free(bytes);
        return 0;
    }
    *out_bytes = bytes;
    *out_count = (uint64_t)byte_count;
    return 1;
}

static int validate_one(const char *label, const uint8_t *bytes, uint64_t byte_count)
{
    cadr_m4_media_difference unused;
    const cadr_status status = cadr_m4_media_compare(bytes, byte_count, bytes, byte_count, &unused);
    if (status == CADR_STATUS_OK) return 1;
    (void)fprintf(stderr, "%s: invalid CDRM4MEDIA1 transcript (status=%u)\n", label, status);
    return 0;
}

int main(int argc, char **argv)
{
    uint8_t *left = NULL, *right = NULL;
    uint64_t left_count, right_count;
    cadr_m4_media_difference difference;
    cadr_status status;
    if (argc != 3) {
        (void)fprintf(stderr, "usage: %s LEFT.cdrm4media1 RIGHT.cdrm4media1\n", argv[0]);
        return 2;
    }
    if (!read_file(argv[1], &left, &left_count)) {
        (void)fprintf(stderr, "%s: read failed or exceeds %llu bytes (errno=%d)\n", argv[1],
                      (unsigned long long)CADR_M4_MEDIA_COMPARE_MAX_BYTES, errno);
        return 1;
    }
    if (!read_file(argv[2], &right, &right_count)) {
        (void)fprintf(stderr, "%s: read failed or exceeds %llu bytes (errno=%d)\n", argv[2],
                      (unsigned long long)CADR_M4_MEDIA_COMPARE_MAX_BYTES, errno);
        free(left);
        return 1;
    }
    if (!validate_one(argv[1], left, left_count) || !validate_one(argv[2], right, right_count)) {
        free(left);
        free(right);
        return 1;
    }
    status = cadr_m4_media_compare(left, left_count, right, right_count, &difference);
    free(left);
    free(right);
    if (status == CADR_STATUS_OK) {
        (void)puts("CDRM4MEDIA1 canonical equality: ok");
        return 0;
    }
    if (status == CADR_STATUS_ARTIFACT_MISMATCH) {
        if (difference.turn_ordinal == UINT64_MAX) {
            (void)fprintf(stderr, "CDRM4MEDIA1 mismatch: turn=header byte=%llu left=%02x right=%02x\n",
                          (unsigned long long)difference.byte_offset,
                          difference.left_byte, difference.right_byte);
        } else {
            (void)fprintf(stderr, "CDRM4MEDIA1 mismatch: turn=%llu byte=%llu left=%02x right=%02x\n",
                          (unsigned long long)difference.turn_ordinal,
                          (unsigned long long)difference.byte_offset,
                          difference.left_byte, difference.right_byte);
        }
    } else {
        (void)fprintf(stderr, "CDRM4MEDIA1 comparison failed (status=%u)\n", status);
    }
    return 1;
}

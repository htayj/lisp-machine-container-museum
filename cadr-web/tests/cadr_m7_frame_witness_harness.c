#include <stdbool.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#include "cadr_m7_frame_witness.h"

uint32_t tv_screen_buffer[32768];
uint32_t tv_width;
uint32_t tv_height;

static uint32_t mode;
static bool black_on_white;

bool tv_is_black_on_white(void)
{
    return black_on_white;
}

void tv_control_read(uint32_t offset, uint32_t *value)
{
    if (offset != 0U) abort();
    *value = mode;
}

static uint32_t get32le(const unsigned char *at)
{
    return (uint32_t)at[0] | ((uint32_t)at[1] << 8U) |
           ((uint32_t)at[2] << 16U) | ((uint32_t)at[3] << 24U);
}

static uint64_t get64le(const unsigned char *at)
{
    uint64_t value = 0U;
    unsigned index;
    for (index = 0U; index != 8U; ++index)
        value |= (uint64_t)at[index] << (index * 8U);
    return value;
}

static uint32_t expected_word(uint32_t index)
{
    return index * UINT32_C(0x10204081);
}

static int expect_missing_output(const char *output)
{
    (void)output;
    if (unsetenv("CADR_M7_FRAME_OUTPUT") != 0) return 1;
    return cadr_m7_frame_witness_capture(UINT64_C(982990214)) == 0 ? 1 :
        (cadr_m7_frame_witness_failed() != 0U ? 0 : 1);
}

static int expect_existing_output_is_not_replaced(const char *output)
{
    FILE *file = fopen(output, "wb");
    char bytes[4] = { 'o', 'l', 'd', '\n' };
    char observed[4];
    if (file == NULL || fwrite(bytes, 1U, sizeof(bytes), file) != sizeof(bytes) ||
        fclose(file) != 0 || setenv("CADR_M7_FRAME_OUTPUT", output, 1) != 0)
        return 1;
    if (cadr_m7_frame_witness_capture(UINT64_C(982990214)) == 0 ||
        cadr_m7_frame_witness_failed() == 0U) return 1;
    file = fopen(output, "rb");
    if (file == NULL || fread(observed, 1U, sizeof(observed), file) != sizeof(observed) ||
        fclose(file) != 0) return 1;
    return memcmp(bytes, observed, sizeof(bytes)) == 0 ? 0 : 1;
}

static int expect_serialized_capture(const char *output)
{
    unsigned char bytes[64U + 23112U * 4U];
    struct stat information;
    FILE *file;
    uint32_t index;
    size_t read_count;

    tv_width = 768U;
    tv_height = 963U;
    mode = 4U;
    black_on_white = true;
    for (index = 0U; index != 23112U; ++index)
        tv_screen_buffer[index] = expected_word(index);
    if (setenv("CADR_M7_FRAME_OUTPUT", output, 1) != 0 ||
        cadr_m7_frame_witness_capture(UINT64_C(982990214)) != 0 ||
        lstat(output, &information) != 0 || !S_ISREG(information.st_mode) ||
        (information.st_mode & 0777U) != 0600U ||
        information.st_size != (off_t)sizeof(bytes)) return 1;
    file = fopen(output, "rb");
    if (file == NULL) return 1;
    read_count = fread(bytes, 1U, sizeof(bytes), file);
    if (fclose(file) != 0 || read_count != sizeof(bytes)) return 1;
    if (memcmp(bytes, "CDRM7N1", 7U) != 0 || bytes[7] != 0U ||
        get32le(bytes + 8U) != 1U || get32le(bytes + 12U) != 64U ||
        get64le(bytes + 16U) != UINT64_C(982990214) ||
        get32le(bytes + 24U) != 768U || get32le(bytes + 28U) != 963U ||
        get32le(bytes + 32U) != 4U || get32le(bytes + 36U) != 1U ||
        get32le(bytes + 40U) != 32768U || get32le(bytes + 44U) != 23112U ||
        get32le(bytes + 48U) != 92448U || get32le(bytes + 52U) != 0U ||
        get32le(bytes + 64U) != expected_word(0U) ||
        get32le(bytes + 64U + (23111U * 4U)) != expected_word(23111U)) return 1;
    for (index = 56U; index != 64U; ++index)
        if (bytes[index] != 0U) return 1;
    /* The one-shot primitive rejects a second capture instead of silently
     * overwriting a conclusion associated with a different guest boundary. */
    return cadr_m7_frame_witness_capture(UINT64_C(982990215)) != 0 &&
        cadr_m7_frame_witness_failed() != 0U ? 0 : 1;
}

static void initialize_valid_tv(void)
{
    uint32_t index;
    tv_width = 768U;
    tv_height = 963U;
    mode = 4U;
    black_on_white = true;
    for (index = 0U; index != 23112U; ++index)
        tv_screen_buffer[index] = expected_word(index);
}

static int output_is_absent(const char *output)
{
    struct stat information;
    return lstat(output, &information) != 0 && errno == ENOENT ? 0 : 1;
}

static int expect_failure(const char *mode_name, const char *output)
{
    struct stat information;
    initialize_valid_tv();
    if (strcmp(mode_name, "relative") == 0) {
        if (setenv("CADR_M7_FRAME_OUTPUT", "relative.cdrm7n1", 1) != 0) return 1;
    } else {
        if (setenv("CADR_M7_FRAME_OUTPUT", output, 1) != 0) return 1;
    }
    if (strcmp(mode_name, "geometry") == 0) tv_height = 962U;
    else if (strcmp(mode_name, "bow") == 0) mode = 0U;
    else if (strcmp(mode_name, "short-write") == 0) {
        if (setenv("CADR_M7_FRAME_TEST_FAIL_SECOND_WRITE", "1", 1) != 0) return 1;
    } else if (strcmp(mode_name, "after-link") == 0) {
        if (setenv("CADR_M7_FRAME_TEST_FAIL_AFTER_LINK", "1", 1) != 0) return 1;
    } else if (strcmp(mode_name, "symlink") == 0) {
        if (symlink("/dev/null", output) != 0) return 1;
    }
    if (cadr_m7_frame_witness_capture(UINT64_C(982990214)) == 0 ||
        cadr_m7_frame_witness_failed() == 0U) return 1;
    if (strcmp(mode_name, "relative") == 0) return 0;
    if (strcmp(mode_name, "symlink") == 0)
        return lstat(output, &information) == 0 && S_ISLNK(information.st_mode) ? 0 : 1;
    return output_is_absent(output);
}

int main(int argc, char **argv)
{
    if (argc != 3) return 2;
    if (strcmp(argv[1], "success") == 0) return expect_serialized_capture(argv[2]);
    if (strcmp(argv[1], "missing") == 0) return expect_missing_output(argv[2]);
    if (strcmp(argv[1], "occupied") == 0) return expect_existing_output_is_not_replaced(argv[2]);
    if (strcmp(argv[1], "relative") == 0 || strcmp(argv[1], "geometry") == 0 ||
        strcmp(argv[1], "bow") == 0 || strcmp(argv[1], "short-write") == 0 ||
        strcmp(argv[1], "after-link") == 0 || strcmp(argv[1], "symlink") == 0)
        return expect_failure(argv[1], argv[2]);
    return 2;
}

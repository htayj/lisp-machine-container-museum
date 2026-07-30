#include <fcntl.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#include "cadr_m8_m9_input_witness.h"

static uint32_t get32(const unsigned char *at)
{
    return (uint32_t)at[0] | ((uint32_t)at[1] << 8U) |
        ((uint32_t)at[2] << 16U) | ((uint32_t)at[3] << 24U);
}

static uint64_t get64(const unsigned char *at)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) value |= (uint64_t)at[index] << (index * 8U);
    return value;
}

int main(int argc, char **argv)
{
    unsigned char bytes[128];
    struct stat information;
    int descriptor;
    if (argc != 2) return 2;
    if (setenv("CADR_M8_M9_INPUT_WITNESS", argv[1], 1) != 0 ||
        cadr_m8_m9_input_witness_keyboard(UINT64_C(101), UINT32_C(04), 65, 1) != 0 ||
        cadr_m8_m9_input_witness_pointer(UINT64_C(102), UINT32_C(024), 123, 456, 3) != 0 ||
        stat(argv[1], &information) != 0 || (information.st_mode & 0777) != 0600 ||
        information.st_size != (off_t)sizeof(bytes)) return 1;
    descriptor = open(argv[1], O_RDONLY);
    if (descriptor < 0 || read(descriptor, bytes, sizeof(bytes)) != (ssize_t)sizeof(bytes) ||
        close(descriptor) != 0) return 1;
    if (memcmp(bytes, "CDRM8N1", 7U) != 0 || get32(bytes + 8U) != 1U ||
        get32(bytes + 12U) != 64U || get32(bytes + 16U) != 1U ||
        get64(bytes + 24U) != UINT64_C(101) || get32(bytes + 32U) != 4U ||
        get32(bytes + 36U) != 65U || get32(bytes + 40U) != 1U ||
        get32(bytes + 52U) != 0U || memcmp(bytes + 64U, "CDRM8N1", 7U) != 0 ||
        get32(bytes + 80U) != 2U || get64(bytes + 88U) != UINT64_C(102) ||
        get32(bytes + 96U) != 024U || get32(bytes + 100U) != 3U ||
        get32(bytes + 108U) != 123U || get32(bytes + 112U) != 456U ||
        get32(bytes + 116U) != 1U) return 1;
    if (unsetenv("CADR_M8_M9_INPUT_WITNESS") != 0 ||
        cadr_m8_m9_input_witness_keyboard(UINT64_C(103), 0U, 66, 1) != 0) return 1;
    if (setenv("CADR_M8_M9_INPUT_WITNESS", "relative", 1) != 0 ||
        cadr_m8_m9_input_witness_keyboard(UINT64_C(104), 0U, 67, 1) == 0) return 1;
    return 0;
}

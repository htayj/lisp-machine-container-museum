#include "cadr_m8_m9_input_witness.h"
#include "cadr_m8_m9_input_driver.h"

#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define CADR_M8_M9_NATIVE_RECORD_BYTES UINT32_C(64)
#define CADR_M8_M9_KIND_KEYBOARD UINT32_C(1)
#define CADR_M8_M9_KIND_POINTER UINT32_C(2)

static uint32_t record_ordinal;

/* The direct oracle links the driver's strong definition, which brackets only
 * its explicit 207-row campaign.  The X11 witness does not link that driver:
 * retaining this weak true default preserves observation of genuine X11 input
 * while excluding no source path there. */
int __attribute__((weak))
cadr_m8_m9_input_driver_dispatch_active(void)
{
    return 1;
}

static void put32le(unsigned char *at, uint32_t value)
{
    uint32_t index;
    for (index = 0U; index < 4U; ++index) at[index] = (unsigned char)(value >> (index * 8U));
}

static void put64le(unsigned char *at, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) at[index] = (unsigned char)(value >> (index * 8U));
}

static int write_all(int descriptor, const unsigned char *bytes, size_t count)
{
    size_t written = 0U;
    while (written != count) {
        const ssize_t result = write(descriptor, bytes + written, count - written);
        if (result < 0) {
            if (errno == EINTR) continue;
            return -1;
        }
        if (result == 0) return -1;
        written += (size_t)result;
    }
    return 0;
}

static int open_output(const char *path)
{
    struct stat information;
    int descriptor;
    if (path == NULL) return -2;
    if (path[0] != '/') return -1;
    descriptor = open(path, O_WRONLY | O_APPEND | O_CLOEXEC | O_NOFOLLOW);
    if (descriptor < 0 && errno == ENOENT) {
        descriptor = open(path, O_WRONLY | O_APPEND | O_CREAT | O_EXCL |
                          O_CLOEXEC | O_NOFOLLOW, S_IRUSR | S_IWUSR);
    }
    if (descriptor < 0) return -1;
    if (fstat(descriptor, &information) != 0 || !S_ISREG(information.st_mode) ||
        information.st_nlink != 1 || (information.st_mode & 0777) != 0600) {
        (void)close(descriptor);
        return -1;
    }
    return descriptor;
}

static int emit(uint32_t kind, uint64_t boundary, uint32_t csr,
                int first, int second, int x, int y)
{
    const char *path = getenv("CADR_M8_M9_INPUT_WITNESS");
    unsigned char bytes[CADR_M8_M9_NATIVE_RECORD_BYTES] = {0};
    int descriptor;
    if (path == NULL) return 0; /* The patch is inert unless its campaign names a sidecar. */
    if (record_ordinal == UINT32_MAX) return -1;
    descriptor = open_output(path);
    if (descriptor < 0) return -1;
    (void)memcpy(bytes, "CDRM8N1", 7U);
    put32le(bytes + 8U, UINT32_C(1));
    put32le(bytes + 12U, CADR_M8_M9_NATIVE_RECORD_BYTES);
    put32le(bytes + 16U, kind);
    put64le(bytes + 24U, boundary);
    put32le(bytes + 32U, csr);
    put32le(bytes + 36U, (uint32_t)first);
    put32le(bytes + 40U, (uint32_t)second);
    put32le(bytes + 44U, (uint32_t)x);
    put32le(bytes + 48U, (uint32_t)y);
    put32le(bytes + 52U, record_ordinal);
    record_ordinal += 1U;
    if (write_all(descriptor, bytes, sizeof(bytes)) != 0 || fsync(descriptor) != 0) {
        (void)close(descriptor);
        return -1;
    }
    return close(descriptor) == 0 ? 0 : -1;
}

int cadr_m8_m9_input_witness_keyboard(uint64_t boundary, uint32_t iob_csr_before,
                                      int code, int keydown)
{
    return emit(CADR_M8_M9_KIND_KEYBOARD, boundary, iob_csr_before,
                code, keydown, 0, 0);
}

int cadr_m8_m9_input_witness_pointer(uint64_t boundary, uint32_t iob_csr_before,
                                     int x, int y, int buttons)
{
    return emit(CADR_M8_M9_KIND_POINTER, boundary, iob_csr_before,
                buttons, 0, x, y);
}

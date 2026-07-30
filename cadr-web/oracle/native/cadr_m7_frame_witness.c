#include "cadr_m7_frame_witness.h"

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#include "tv.h"

#define CADR_M7_FRAME_WIDTH UINT32_C(768)
#define CADR_M7_FRAME_HEIGHT UINT32_C(963)
#define CADR_M7_FRAME_STRIDE_WORDS UINT32_C(24)
#define CADR_M7_FRAME_BACKING_WORDS UINT32_C(32768)
#define CADR_M7_FRAME_ACTIVE_WORDS \
    (CADR_M7_FRAME_STRIDE_WORDS * CADR_M7_FRAME_HEIGHT)
#define CADR_M7_FRAME_HEADER_BYTES UINT32_C(64)
#define CADR_M7_FRAME_PAYLOAD_BYTES \
    (CADR_M7_FRAME_ACTIVE_WORDS * UINT32_C(4))

/* `tv_mode` is source-local.  The public control read is the non-mutating
 * source-side observation for the header; the direct framebuffer copy below
 * deliberately never touches an X11/SDL surface or screenshot writer. */
extern bool tv_is_black_on_white(void);

static int attempted;
static int failed;

#ifdef CADR_M7_FRAME_WITNESS_TESTING
static unsigned test_write_calls;

static int test_failure(const char *name)
{
    return getenv(name) != NULL;
}
#else
static int test_failure(const char *name)
{
    (void)name;
    return 0;
}
#endif

static void put32le(unsigned char *at, uint32_t value)
{
    unsigned index;
    for (index = 0U; index != 4U; ++index) {
        at[index] = (unsigned char)(value >> (index * 8U));
    }
}

static void put64le(unsigned char *at, uint64_t value)
{
    unsigned index;
    for (index = 0U; index != 8U; ++index) {
        at[index] = (unsigned char)(value >> (index * 8U));
    }
}

static int write_all(int descriptor, const void *source, size_t byte_count)
{
    const unsigned char *bytes = source;
    size_t written = 0U;
#ifdef CADR_M7_FRAME_WITNESS_TESTING
    if (test_failure("CADR_M7_FRAME_TEST_FAIL_SECOND_WRITE") &&
        test_write_calls++ != 0U) {
        errno = EIO;
        return -1;
    }
#endif
    while (written != byte_count) {
        ssize_t result = write(descriptor, bytes + written, byte_count - written);
        if (result < 0) {
            if (errno == EINTR) continue;
            return -1;
        }
        if (result == 0) return -1;
        written += (size_t)result;
    }
    return 0;
}

static int temporary_path(const char *output, char *temporary, size_t capacity)
{
    const int count = snprintf(temporary, capacity, "%s.tmp-%ld", output,
                               (long)getpid());
    return count > 0 && (size_t)count < capacity ? 0 : -1;
}

static int fsync_parent_directory(const char *path)
{
    char copy[PATH_MAX];
    char *slash;
    int descriptor;
    if (strlen(path) >= sizeof(copy)) return -1;
    (void)memcpy(copy, path, strlen(path) + 1U);
    slash = strrchr(copy, '/');
    if (slash == NULL) return -1;
    if (slash == copy) slash[1] = '\0';
    else *slash = '\0';
    descriptor = open(copy, O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    if (descriptor < 0) return -1;
    if (fsync(descriptor) != 0) {
        (void)close(descriptor);
        return -1;
    }
    return close(descriptor) == 0 ? 0 : -1;
}

static int header_and_frame(const char *output, uint64_t boundary)
{
    unsigned char header[CADR_M7_FRAME_HEADER_BYTES] = {0};
    unsigned char words[CADR_M7_FRAME_ACTIVE_WORDS * 4U];
    char temporary[PATH_MAX];
    struct stat information;
    uint32_t mode = 0U;
    uint32_t bow;
    uint32_t index;
    int descriptor = -1;
    int published = 0;
    int result = -1;

    if (output == NULL || output[0] != '/' || output[0] == '\0' ||
        lstat(output, &information) == 0 || errno != ENOENT ||
        tv_width != CADR_M7_FRAME_WIDTH || tv_height != CADR_M7_FRAME_HEIGHT ||
        sizeof(tv_screen_buffer[0]) != 4U) return -1;
    tv_control_read(0U, &mode);
    bow = tv_is_black_on_white() ? 1U : 0U;
    if (((mode >> 2U) & 1U) != bow) return -1;
    if (temporary_path(output, temporary, sizeof(temporary)) != 0) return -1;
    descriptor = open(temporary, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW |
                      O_CLOEXEC, S_IRUSR | S_IWUSR);
    if (descriptor < 0) return -1;
    if (fstat(descriptor, &information) != 0 || !S_ISREG(information.st_mode) ||
        information.st_nlink != 1) goto done;

    (void)memcpy(header, "CDRM7N1", 7U);
    /* byte 7 remains zero: the seven-character magic has a fixed 8-byte slot. */
    put32le(header + 8U, 1U);
    put32le(header + 12U, CADR_M7_FRAME_HEADER_BYTES);
    put64le(header + 16U, boundary);
    put32le(header + 24U, CADR_M7_FRAME_WIDTH);
    put32le(header + 28U, CADR_M7_FRAME_HEIGHT);
    put32le(header + 32U, mode);
    put32le(header + 36U, bow);
    put32le(header + 40U, CADR_M7_FRAME_BACKING_WORDS);
    put32le(header + 44U, CADR_M7_FRAME_ACTIVE_WORDS);
    put32le(header + 48U, CADR_M7_FRAME_PAYLOAD_BYTES);
    put32le(header + 52U, 0U);
    for (index = 0U; index != CADR_M7_FRAME_ACTIVE_WORDS; ++index) {
        put32le(words + index * 4U, tv_screen_buffer[index]);
    }
    if (write_all(descriptor, header, sizeof(header)) != 0 ||
        write_all(descriptor, words, sizeof(words)) != 0 || fsync(descriptor) != 0 ||
        close(descriptor) != 0) {
        descriptor = -1;
        goto done;
    }
    descriptor = -1;
    /* link(2) is no-replace publication. The producer and runner require an
     * otherwise empty private run directory, so the hard-link operation also
     * makes a completed capture appear atomically to the comparator. */
    if (link(temporary, output) != 0) goto done;
    /* From this point a failure must retract the published hard link.  Do not
     * treat a successful link as success until temporary-name removal and the
     * directory durability barrier have both completed. */
    published = 1;
    if (test_failure("CADR_M7_FRAME_TEST_FAIL_AFTER_LINK") ||
        unlink(temporary) != 0 || fsync_parent_directory(output) != 0) goto done;
    result = 0;

done:
    if (descriptor >= 0) (void)close(descriptor);
    if (result != 0) {
        (void)unlink(temporary);
        if (published) {
            (void)unlink(output);
            (void)fsync_parent_directory(output);
        }
    }
    return result;
}

int cadr_m7_frame_witness_capture(uint64_t boundary)
{
    const char *output;
    if (attempted) {
        failed = 1;
        return -1;
    }
    attempted = 1;
    output = getenv("CADR_M7_FRAME_OUTPUT");
    if (header_and_frame(output, boundary) != 0) {
        failed = 1;
        return -1;
    }
    return 0;
}

uint32_t cadr_m7_frame_witness_failed(void)
{
    return failed != 0 ? 1U : 0U;
}

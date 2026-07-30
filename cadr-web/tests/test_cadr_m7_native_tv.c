/* Exercise the pinned native usim TV implementation directly, without an X
 * backend.  This is the source-side checkpoint paired with the M7 renderer's
 * raw framebuffer test; it is not a synthetic alternate rasterizer. */
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "tv.h"

int trace_level;
int trace_facilities;

void trace(int facility, int priority, const char *format, ...);
void assert_xbus_interrupt(void);
void bus_interface_set_xbus_nxm(void);
void tv_reset(void);

void trace(int facility, int priority, const char *format, ...)
{
    va_list arguments;
    (void)facility;
    (void)priority;
    (void)format;
    va_start(arguments, format);
    va_end(arguments);
}

void assert_xbus_interrupt(void) {}
void bus_interface_set_xbus_nxm(void) {}

extern uint32_t tv_bitmap[];

static int failures;
#define CHECK(condition) do { if (!(condition)) { \
    (void)fprintf(stderr, "FAIL %s:%d: %s\\n", __FILE__, __LINE__, #condition); ++failures; \
} } while (0)

static void read_pbm_bits(const char *path, char *bits, size_t bit_count)
{
    FILE *file = fopen(path, "rb");
    char header[64];
    size_t count = 0U;
    int byte;
    if (file == NULL) { ++failures; return; }
    CHECK(fgets(header, (int)sizeof(header), file) != NULL && strcmp(header, "P1\n") == 0);
    CHECK(fgets(header, (int)sizeof(header), file) != NULL && strcmp(header, "768 963\n") == 0);
    while ((byte = fgetc(file)) != EOF && count < bit_count) {
        if (byte == '0' || byte == '1') bits[count++] = (char)byte;
    }
    CHECK(count == bit_count);
    (void)fclose(file);
}

int main(int argc, char **argv)
{
    static const char default_path[] = "build/cadr-m7-native-tv.pbm";
    const char *path = default_path;
    char bits[802] = { 0 };
    if (argc > 2) return 2;
    if (argc == 2) path = argv[1];
    tv_monitor = 1;
    tv_init();
    CHECK(tv_width == 768U && tv_height == 963U);
    CHECK((tv_width * tv_height) / 32U == 23112U);
    tv_reset();
    tv_control_write(0U, 0U);
    tv_screen_write(0U, UINT32_C(0x80000001));
    tv_screen_write(25U, UINT32_C(0x00000002));
    CHECK(tv_bitmap[0] == UINT32_C(0xffffffff));
    CHECK(tv_bitmap[1] == UINT32_C(0xff000000));
    CHECK(tv_bitmap[31] == UINT32_C(0xffffffff));
    tv_control_write(0U, 4U);
    CHECK(tv_bitmap[0] == UINT32_C(0xff000000));
    CHECK(tv_bitmap[1] == UINT32_C(0xffffffff));
    CHECK(tv_bitmap[31] == UINT32_C(0xff000000));
    tv_save_screenshot((char *)path);
    read_pbm_bits(path, bits, sizeof(bits));
    CHECK(bits[0] == '1' && bits[1] == '0' && bits[30] == '0' && bits[31] == '1');
    CHECK(bits[32] == '0');
    CHECK(bits[768U + 33U] == '1');
    if (argc == 1) (void)remove(path);
    if (failures != 0) return 1;
    (void)puts("cadr M7 native TV test passed");
    return 0;
}

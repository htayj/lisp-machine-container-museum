#include "cadr_m8_m9_input_driver.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

extern void kbd_event(int code, int keydown);
extern void mouse_event(int x, int y, int buttons);

struct input_event {
    uint64_t boundary;
    uint32_t kind;
    uint32_t first;
    uint32_t second;
    uint32_t third;
};

static FILE *script;
static struct input_event next;
static int initialized;
static int have_next;
static int failed;
static int dispatch_active;
static uint64_t previous_boundary;

static int read_next(void)
{
    char kind[16];
    unsigned long long boundary;
    unsigned first;
    unsigned second;
    unsigned third;
    int count;
    if (script == NULL) return 0;
    count = fscanf(script, "%llu %15s %u %u %u", &boundary, kind,
                   &first, &second, &third);
    if (count == EOF) {
        if (!feof(script)) failed = 1;
        (void)fclose(script); script = NULL; have_next = 0;
        return failed == 0 ? 0 : -1;
    }
    if (count != 5 || (strcmp(kind, "keyboard") != 0 && strcmp(kind, "pointer") != 0) ||
        boundary <= previous_boundary || first > UINT32_MAX || second > UINT32_MAX ||
        third > UINT32_MAX) {
        failed = 1; return -1;
    }
    next.boundary = (uint64_t)boundary;
    next.kind = strcmp(kind, "keyboard") == 0 ? 1U : 2U;
    next.first = first; next.second = second; next.third = third;
    previous_boundary = next.boundary; have_next = 1;
    return 0;
}

int cadr_m8_m9_input_driver_init(void)
{
    const char *path = getenv("CADR_M8_M9_INPUT_SCRIPT");
    char magic[24] = {0};
    if (initialized) return -1;
    initialized = 1;
    if (path == NULL) return 0;
    if (path[0] != '/') return -1;
    script = fopen(path, "r");
    if (script == NULL || fscanf(script, "%23s", magic) != 1 ||
        strcmp(magic, "CADR-M8-M9-INPUT-v1") != 0) {
        if (script != NULL) (void)fclose(script);
        script = NULL; failed = 1; return -1;
    }
    return read_next();
}

int cadr_m8_m9_input_driver_boundary(uint64_t boundary)
{
    if (!initialized || failed) return -1;
    if (have_next && boundary > next.boundary) return -1;
    while (have_next && boundary == next.boundary) {
        if (next.kind == 1U) {
            if (next.first > 0177U || next.second > 1U || next.third != 0U) return -1;
            dispatch_active = 1;
            kbd_event((int)next.first, (int)next.second);
            dispatch_active = 0;
        } else {
            if (next.first >= 768U || next.second >= 963U || next.third > 3U) return -1;
            dispatch_active = 1;
            mouse_event((int)next.first, (int)next.second, (int)next.third);
            dispatch_active = 0;
        }
        have_next = 0;
        if (read_next() != 0) return -1;
    }
    return 0;
}

int cadr_m8_m9_input_driver_dispatch_active(void)
{
    return dispatch_active;
}

int cadr_m8_m9_input_driver_complete(void)
{
    return initialized && !failed && script == NULL && !have_next;
}

/*
 * Freestanding wasm32 support for the CADR-WEB core.
 *
 * This is intentionally not a general C library.  The M3 module has one
 * monotonically growing allocation arena, no filesystem, no clock, no
 * threads, and no imported host callbacks.  CADR artifact bytes are copied
 * into a host-controlled transfer allocation only while the core validates
 * and imports them; the selected M3 core does not retain the disk payload.
 */
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "cadr_wasm_memory.h"
#include "cadr_wasm_runtime.h"

#define CADR_WASM_ARENA_LIMIT CADR_WASM_MEMORY_BYTES
#define CADR_WASM_ALIGNMENT UINT32_C(16)

extern unsigned char __heap_base;

static uintptr_t cadr_wasm_next;

static uintptr_t cadr_wasm_align_up(uintptr_t value)
{
    return (value + (CADR_WASM_ALIGNMENT - UINT32_C(1))) &
           ~(CADR_WASM_ALIGNMENT - UINT32_C(1));
}

uintptr_t cadr_wasm_allocator_mark(void)
{
    return cadr_wasm_next;
}

void cadr_wasm_allocator_rollback(uintptr_t mark)
{
    /* Marks originate from this allocator; never move the bump cursor forward. */
    if (mark <= cadr_wasm_next) cadr_wasm_next = mark;
}

void *malloc(size_t size)
{
    uintptr_t start;
    uintptr_t end;

    if (cadr_wasm_next == 0U) cadr_wasm_next = cadr_wasm_align_up((uintptr_t)&__heap_base);
    start = cadr_wasm_next;
    if (size > UINT32_MAX - start) return NULL;
    end = cadr_wasm_align_up(start + (uintptr_t)size);
    if (end < start || end > CADR_WASM_ARENA_LIMIT) return NULL;
    cadr_wasm_next = end;
    return (void *)start;
}

void *calloc(size_t count, size_t size)
{
    void *result;
    if (count != 0U && size > SIZE_MAX / count) return NULL;
    result = malloc(count * size);
    if (result != NULL) (void)memset(result, 0, count * size);
    return result;
}

void free(void *pointer)
{
    /* M3 performs no operation which needs a reusable allocation. */
    (void)pointer;
}

void *memcpy(void *destination, const void *source, size_t count)
{
    uint8_t *out = (uint8_t *)destination;
    const uint8_t *in = (const uint8_t *)source;
    size_t index;
    for (index = 0U; index < count; ++index) out[index] = in[index];
    return destination;
}

void *memset(void *destination, int value, size_t count)
{
    uint8_t *out = (uint8_t *)destination;
    size_t index;
    for (index = 0U; index < count; ++index) out[index] = (uint8_t)value;
    return destination;
}

int memcmp(const void *left, const void *right, size_t count)
{
    const uint8_t *a = (const uint8_t *)left;
    const uint8_t *b = (const uint8_t *)right;
    size_t index;
    for (index = 0U; index < count; ++index) {
        if (a[index] != b[index]) return a[index] < b[index] ? -1 : 1;
    }
    return 0;
}

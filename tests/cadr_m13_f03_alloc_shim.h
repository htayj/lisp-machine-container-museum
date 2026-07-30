/* Test-only deterministic allocation injection for M13-F03.
 *
 * This header is supplied with compiler -include before each selected core
 * translation unit.  It imports the system allocator declarations before it
 * substitutes direct allocation calls, so the production sources do not need
 * a test-only conditional.  The harness translation unit undefines the
 * macros before defining the three functions below and therefore calls the
 * real libc allocator.
 */
#ifndef CADR_M13_F03_ALLOC_SHIM_H
#define CADR_M13_F03_ALLOC_SHIM_H

#include <stddef.h>
#include <stdlib.h>

void *cadr_m13_f03_malloc_at(size_t size, const char *file, int line);
void *cadr_m13_f03_calloc_at(size_t count, size_t size,
                              const char *file, int line);
void *cadr_m13_f03_realloc_at(void *pointer, size_t size,
                               const char *file, int line);

#define malloc(size) cadr_m13_f03_malloc_at((size), __FILE__, __LINE__)
#define calloc(count, size) cadr_m13_f03_calloc_at((count), (size), __FILE__, __LINE__)
#define realloc(pointer, size) cadr_m13_f03_realloc_at((pointer), (size), __FILE__, __LINE__)

#endif

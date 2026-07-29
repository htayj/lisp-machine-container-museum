/* CADR-WEB's deliberately small freestanding allocation surface. */
#ifndef CADR_WASM_STDLIB_H
#define CADR_WASM_STDLIB_H

#include <stddef.h>

void *malloc(size_t size);
void *calloc(size_t count, size_t size);
void free(void *pointer);

#endif

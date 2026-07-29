/* CADR-WEB's deliberately small freestanding byte-operation surface. */
#ifndef CADR_WASM_STRING_H
#define CADR_WASM_STRING_H

#include <stddef.h>

void *memcpy(void *destination, const void *source, size_t count);
void *memset(void *destination, int value, size_t count);
int memcmp(const void *left, const void *right, size_t count);

#endif

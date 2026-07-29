/* Minimal freestanding C11 size and null definitions for wasm32. */
#ifndef CADR_WASM_STDDEF_H
#define CADR_WASM_STDDEF_H

typedef unsigned int size_t;
typedef int ptrdiff_t;
#define SIZE_MAX 4294967295U
#define NULL ((void *)0)
#define offsetof(type, member) __builtin_offsetof(type, member)

#endif

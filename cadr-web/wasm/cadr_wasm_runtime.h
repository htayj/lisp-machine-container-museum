/* Internal allocation checkpointing for bounded M3 restore transactions. */
#ifndef CADR_WASM_RUNTIME_H
#define CADR_WASM_RUNTIME_H

#include <stdint.h>

uintptr_t cadr_wasm_allocator_mark(void);
void cadr_wasm_allocator_rollback(uintptr_t mark);

#endif

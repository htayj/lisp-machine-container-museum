#ifndef CADR_PROCESSOR_MEMORY_H
#define CADR_PROCESSOR_MEMORY_H

/*
 * BSD-derived from the pinned usim 330d8248... U303 source profile.
 * See COPYING.md and source-map.json.  This is an internal, instance-only API.
 */

#include <stdint.h>

#include "cadr_state.h"

enum {
    CADR_PROCESSOR_MEMORY_OK = CADR_STATUS_OK,
    CADR_PROCESSOR_MEMORY_NXM = CADR_STATUS_UNIMPLEMENTED_DEVICE
};

typedef cadr_status (*cadr_processor_memory_bus_read32)(
    cadr_machine_state *state, uint32_t paddr, uint32_t *value);
typedef cadr_status (*cadr_processor_memory_bus_write32)(
    cadr_machine_state *state, uint32_t paddr, uint32_t value);

typedef struct cadr_processor_memory_bus {
    cadr_processor_memory_bus_read32 read32;
    cadr_processor_memory_bus_write32 write32;
} cadr_processor_memory_bus;

void cadr_canonical_write_u32(cadr_machine_state *state, uint32_t family,
                              uint32_t index, uint32_t old_value,
                              uint32_t new_value);

void cadr_processor_memory_reset(cadr_machine_state *state);
void cadr_processor_memory_boot(cadr_machine_state *state);
void cadr_processor_memory_set_main_memory_pages(cadr_machine_state *state,
                                                  uint32_t page_count);
cadr_status cadr_processor_memory_main_read(cadr_machine_state *state,
                                            uint32_t paddr, uint32_t *value);
cadr_status cadr_processor_memory_main_write(cadr_machine_state *state,
                                             uint32_t paddr, uint32_t value);
cadr_status cadr_processor_memory_main_access(cadr_machine_state *state,
                                              uint32_t write, uint32_t paddr,
                                              uint32_t *value);
uint32_t cadr_processor_memory_vtop(const cadr_machine_state *state, uint32_t vaddr,
                                    uint32_t *l1_data, uint32_t *l2_data,
                                    uint32_t *page_number, uint32_t *write_allowed,
                                    uint32_t *access_allowed);
void cadr_processor_memory_write_map(cadr_machine_state *state, uint32_t vma,
                                     uint32_t md);
/*
 * bus is transient and never retained.  Main RAM and processor A-memory are
 * resolved here; the hook receives only physical device/bus cycles.
 */
cadr_status cadr_processor_memory_virtual_access(
    cadr_machine_state *state, const cadr_processor_memory_bus *bus,
    uint32_t write, uint32_t vaddr, uint32_t *value);
/* RAM-only standalone profile; non-memory physical cycles become NXM. */
void cadr_processor_memory_step(cadr_machine_state *state);
/* Production composition point for the deterministic bus/device layer. */
void cadr_processor_memory_step_with_bus(cadr_machine_state *state,
                                         const cadr_processor_memory_bus *bus);

#endif

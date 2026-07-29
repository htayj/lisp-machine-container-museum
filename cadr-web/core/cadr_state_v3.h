#ifndef CADR_STATE_V3_H
#define CADR_STATE_V3_H

#include <stdint.h>

#include "cadr_state.h"

/*
 * M3 extension: SHA-256 over the literal nine bytes `CDRSTATE3`, schema:u32le,
 * CDRSTATE2[32], then disk fields in this exact order: pending_first_block:u64le,
 * compatibility_profile, command, command_list_pointer, disk_address,
 * last_memory_address, pending_ccw_address, pending_memory_address, pending_ccw,
 * status, transfer_active, reset_condition, done_interrupt_enable,
 * attention_interrupt_enable, reserved0 (each remaining field u32le).
 */
#define CADR_STATE_V3_SCHEMA_VERSION UINT32_C(1)

cadr_status cadr_state_v3_digest(const cadr_machine_state *state,
                                 uint8_t digest[CADR_SHA256_BYTES]);

#endif

#ifndef CADR_M6_DEBUG_IR_WITNESS_H
#define CADR_M6_DEBUG_IR_WITNESS_H

#include <stdint.h>

/* The clock-control register is intentionally not a witness register. */
#define CADR_M6_DEBUG_IR_LOW UINT32_C(0766000)
#define CADR_M6_DEBUG_IR_MID UINT32_C(0766002)
#define CADR_M6_DEBUG_IR_HIGH UINT32_C(0766004)
#define CADR_M6_DEBUG_IR_FORBIDDEN UINT32_C(0766006)

#define CADR_M6_FORM_A_WORD0 UINT16_C(0x4d36)
#define CADR_M6_FORM_A_WORD1 UINT16_C(0x4131)
#define CADR_M6_FORM_A_WORD2 UINT16_C(0xa55a)
#define CADR_M6_FORM_B_WORD0 UINT16_C(0x4d36)
#define CADR_M6_FORM_B_WORD1 UINT16_C(0x4232)
#define CADR_M6_FORM_B_WORD2 UINT16_C(0x5aa5)
#define CADR_M6_FORM_C_WORD0 UINT16_C(0x4d36)
#define CADR_M6_FORM_C_WORD1 UINT16_C(0x4944)
#define CADR_M6_FORM_C_WORD2 UINT16_C(0x4c45)
#define CADR_M6_C_LISTENER_IDLE_TIMEOUT UINT64_C(100000000)
#define CADR_M6_C_LISTENER_IDLE_CLEANUP_HOLD UINT64_C(1000000)

enum cadr_m6_witness_kind {
    CADR_M6_WITNESS_NONE = 0, CADR_M6_WITNESS_A = 1,
    CADR_M6_WITNESS_B = 2, CADR_M6_WITNESS_C = 3
};

uint32_t cadr_m6_debug_ir_address_allowed(uint32_t address);
uint32_t cadr_m6_debug_ir_match(uint16_t low, uint16_t middle, uint16_t high);

/* All schedule lines are consumed at their exact guest-cycle boundary.  The
 * producer is deliberately unable to synthesize a write or a boundary. */
void cadr_m6_witness_init(void);
void cadr_m6_witness_debug_write(uint64_t boundary, uint32_t address,
                                 uint16_t value, uint64_t debug_ir);
int cadr_m6_witness_boundary(uint64_t boundary, uint64_t debug_ir,
                             uint32_t observed_iob_csr, uint32_t observed_kbd_scancode,
                             uint16_t sixty_cycle_clock, uint32_t disk_busy,
                             uint32_t host_request_pending);
void cadr_m6_witness_finish(int halted);

#endif
